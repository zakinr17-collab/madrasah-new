import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate, Counter } from 'k6/metrics';

const BASE_URL = String(__ENV.BASE_URL || 'https://madrasahku.ai.studio').replace(/\/+$/, '');
const TENANT = String(__ENV.TENANT || '').trim();
const EXAM_ID = String(__ENV.EXAM_ID || '').trim();
const VUS = Math.max(1, Number.parseInt(__ENV.VUS || '20', 10));
const ACCOUNT_OFFSET = Math.max(0, Number.parseInt(__ENV.ACCOUNT_OFFSET || '0', 10));
const ANSWERS_PER_STUDENT = Math.max(1, Number.parseInt(__ENV.ANSWERS_PER_STUDENT || '3', 10));
const RAMP_SECONDS = Math.max(0, Number.parseFloat(__ENV.RAMP_SECONDS || '20'));
const THINK_MIN = Math.max(0, Number.parseFloat(__ENV.THINK_MIN || '0.15'));
const THINK_MAX = Math.max(THINK_MIN, Number.parseFloat(__ENV.THINK_MAX || '0.45'));
const FINISH = String(__ENV.FINISH || '0') === '1';
const VIOLATION_RATE = Math.min(1, Math.max(0, Number.parseFloat(__ENV.VIOLATION_RATE || '0')));
const RECOVERY_RATE = Math.min(1, Math.max(0, Number.parseFloat(__ENV.RECOVERY_RATE || '0.10')));
const ACCOUNTS_FILE = String(__ENV.ACCOUNTS_FILE || './accounts.local.json');

if (!EXAM_ID) {
  throw new Error('EXAM_ID wajib diisi. Gunakan ID ujian LOAD TEST khusus, jangan ujian sungguhan.');
}

const accounts = new SharedArray('loadtest-accounts', () => {
  const parsed = JSON.parse(open(ACCOUNTS_FILE));
  if (!Array.isArray(parsed)) throw new Error('accounts.local.json harus berupa array JSON.');
  return parsed;
});

if (accounts.length < ACCOUNT_OFFSET + VUS) {
  throw new Error(`Akun tidak cukup. Dibutuhkan ${ACCOUNT_OFFSET + VUS}, tersedia ${accounts.length}.`);
}

const loginFail = new Rate('login_fail');
const startQuestionFail = new Rate('start_questions_fail');
const attemptStartFail = new Rate('attempt_start_fail');
const answerFail = new Rate('answer_fail');
const heartbeatFail = new Rate('heartbeat_fail');
const finishFail = new Rate('finish_fail');
const recoveryFail = new Rate('recovery_fail');
const successfulStudents = new Counter('successful_students');

export const options = {
  scenarios: {
    cbt_students: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: 1,
      maxDuration: '15m',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    checks: ['rate>0.99'],
    login_fail: ['rate<0.01'],
    start_questions_fail: ['rate<0.01'],
    attempt_start_fail: ['rate<0.01'],
    answer_fail: ['rate<0.01'],
    heartbeat_fail: ['rate<0.01'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function tryJson(res) {
  try { return res.json(); } catch (_) { return null; }
}

function authHeaders(token, tenant = '') {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Auth-Token': token,
    'X-User-Role': 'student',
  };
  if (tenant) headers['X-Madrasah-Id'] = tenant;
  return headers;
}

function tagged(headers, name) {
  return { headers, tags: { name }, timeout: '15s' };
}

function think() {
  if (THINK_MAX <= 0) return;
  sleep(THINK_MIN + (Math.random() * Math.max(0, THINK_MAX - THINK_MIN)));
}

function chooseAnswer(q) {
  const type = String(q?.type || '').toLowerCase();
  if (type === 'essay' || type === 'esay') return 'jawaban load test';
  if (Array.isArray(q?.options) && q.options.length > 0) return String(q.options[0]);
  return 'A';
}

function postJson(path, body, headers, name) {
  return http.post(`${BASE_URL}${path}`, JSON.stringify(body), tagged(headers, name));
}

function logFailure(label, res) {
  if (!res || res.status === 200) return;
  const body = String(res.body || '').replace(/\s+/g, ' ').slice(0, 500);
  console.error(`${label} gagal: HTTP ${res.status}${body ? ` - ${body}` : ''}`);
}

export default function () {
  const accountIndex = ACCOUNT_OFFSET + (__VU - 1);
  const account = accounts[accountIndex];
  if (!account?.username || !account?.password) {
    throw new Error(`Akun index ${accountIndex} tidak punya username/password.`);
  }

  // Stagger logins so a run is a controlled ramp, not one giant millisecond burst.
  if (RAMP_SECONDS > 0 && VUS > 1) {
    sleep(((__VU - 1) / (VUS - 1)) * RAMP_SECONDS);
  }

  const loginBody = {
    username: String(account.username),
    password: String(account.password),
  };
  const loginHeaders = { 'Content-Type': 'application/json' };
  if (TENANT) {
    loginBody.madrasahId = TENANT;
    loginBody.madrasahSlug = TENANT;
    loginHeaders['X-Madrasah-Id'] = TENANT;
  }
  const loginRes = postJson('/api/login', loginBody, loginHeaders, 'POST /api/login');

  const loginData = tryJson(loginRes);
  const token = String(loginData?.user?.token || loginData?.token || '');
  const loginOk = check(loginRes, {
    'login 200': (r) => r.status === 200,
    'login token tersedia': () => token.length > 20,
  });
  loginFail.add(!loginOk);
  if (!loginOk || !token) {
    logFailure('login', loginRes);
    return;
  }

  const effectiveTenant = String(
    TENANT ||
    loginData?.user?.madrasahId ||
    loginData?.user?.madrasahSlug ||
    ''
  ).trim();
  const headers = authHeaders(token, effectiveTenant);
  const studentId = String(loginData?.user?.id || account.studentId || '');
  const tenantQuery = effectiveTenant ? `?madrasahId=${encodeURIComponent(effectiveTenant)}` : '';

  const examsRes = http.get(
    `${BASE_URL}/api/exams${tenantQuery}`,
    tagged(headers, 'GET /api/exams')
  );
  check(examsRes, { 'daftar ujian 200': (r) => r.status === 200 });
  logFailure('daftar ujian', examsRes);

  // Current CBT lifecycle requires an active server session BEFORE locked questions are requested.
  const bootstrapStartRes = postJson('/api/exam/attempt/start', {
    studentId,
    examId: EXAM_ID,
  }, headers, 'POST /api/exam/attempt/start [bootstrap]');

  const bootstrapStartOk = check(bootstrapStartRes, {
    'attempt bootstrap 200': (r) => r.status === 200,
  });
  attemptStartFail.add(!bootstrapStartOk);
  if (!bootstrapStartOk) {
    logFailure('attempt bootstrap', bootstrapStartRes);
    return;
  }

  const questionsRes = postJson('/api/exam/attempt/start-questions', {
    studentId,
    examId: EXAM_ID,
  }, headers, 'POST /api/exam/attempt/start-questions');

  const questionsData = tryJson(questionsRes);
  const questions = Array.isArray(questionsData?.questions) ? questionsData.questions : [];
  const questionsOk = check(questionsRes, {
    'start-questions 200': (r) => r.status === 200,
    'soal tersedia': () => questions.length > 0,
  });
  startQuestionFail.add(!questionsOk);
  if (!questionsOk || questions.length === 0) {
    logFailure('start-questions', questionsRes);
    return;
  }

  // Resume once after question locking so server monitoring can synchronize totalQuestions
  // from the authoritative studentExamQuestions order without resetting the attempt.
  const syncStartRes = postJson('/api/exam/attempt/start', {
    studentId,
    examId: EXAM_ID,
  }, headers, 'POST /api/exam/attempt/start [sync]');

  const syncStartOk = check(syncStartRes, {
    'attempt sync 200': (r) => r.status === 200,
  });
  attemptStartFail.add(!syncStartOk);
  if (!syncStartOk) {
    logFailure('attempt sync', syncStartRes);
    return;
  }

  const answers = {};
  const answerCount = Math.min(ANSWERS_PER_STUDENT, questions.length);

  for (let i = 0; i < answerCount; i++) {
    const q = questions[i];
    const qId = String(q?.id || '');
    if (!qId) continue;

    const hbRes = postJson('/api/exam/heartbeat', {
      studentId,
      examId: EXAM_ID,
      currentIndex: i,
    }, headers, 'POST /api/exam/heartbeat');
    const hbOk = check(hbRes, { 'heartbeat 200': (r) => r.status === 200 });
    heartbeatFail.add(!hbOk);
    if (!hbOk) logFailure('heartbeat', hbRes);

    const answer = chooseAnswer(q);
    answers[qId] = answer;
    const answerRes = postJson('/api/exam/attempt/answer', {
      studentId,
      examId: EXAM_ID,
      questionId: qId,
      answer,
      currentIndex: i,
    }, headers, 'POST /api/exam/attempt/answer');
    const answerOk = check(answerRes, { 'answer 200': (r) => r.status === 200 });
    answerFail.add(!answerOk);
    if (!answerOk) logFailure('answer', answerRes);

    think();
  }

  // Optional: a small fraction simulates refresh/reconnect by starting the same attempt again.
  if (Math.random() < RECOVERY_RATE) {
    const recoveryRes = postJson('/api/exam/attempt/start', {
      studentId,
      examId: EXAM_ID,
    }, headers, 'POST /api/exam/attempt/start [recovery]');
    const recoveryOk = check(recoveryRes, { 'recovery start 200': (r) => r.status === 200 });
    recoveryFail.add(!recoveryOk);
    if (!recoveryOk) logFailure('recovery start', recoveryRes);
  }

  // Optional and OFF by default to avoid auto-blocking students across repeated runs.
  if (VIOLATION_RATE > 0 && Math.random() < VIOLATION_RATE) {
    const violationRes = postJson('/api/exam/violation', {
      studentId,
      examId: EXAM_ID,
      reason: 'Load test simulated tab switch',
      clientTimestamp: Date.now(),
    }, headers, 'POST /api/exam/violation');
    check(violationRes, { 'violation 200': (r) => r.status === 200 });
    if (violationRes.status !== 200) logFailure('violation', violationRes);
  }

  const summaryRes = http.get(
    `${BASE_URL}/api/exam/my-summary${tenantQuery}`,
    tagged(headers, 'GET /api/exam/my-summary')
  );
  check(summaryRes, { 'my-summary 200': (r) => r.status === 200 });
  logFailure('my-summary', summaryRes);

  // OFF by default so the same dedicated load-test exam can be reused while ramping 20 -> 800.
  if (FINISH) {
    const finishRes = postJson('/api/exam/attempt/finish', {
      studentId,
      examId: EXAM_ID,
      answers,
    }, headers, 'POST /api/exam/attempt/finish');
    const finishOk = check(finishRes, { 'finish 200': (r) => r.status === 200 });
    finishFail.add(!finishOk);
    if (!finishOk) logFailure('finish', finishRes);
  }

  successfulStudents.add(1);
}
