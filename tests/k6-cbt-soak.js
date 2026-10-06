import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate, Counter, Trend } from 'k6/metrics';

const BASE_URL = String(__ENV.BASE_URL || 'https://madrasahku.ai.studio').replace(/\/+$/, '');
const TENANT = String(__ENV.TENANT || '').trim();
const EXAM_ID = String(__ENV.EXAM_ID || '').trim();
const VUS = Math.max(1, Number.parseInt(__ENV.VUS || '300', 10));
const ACCOUNT_OFFSET = Math.max(0, Number.parseInt(__ENV.ACCOUNT_OFFSET || '0', 10));
const SOAK_MINUTES = Math.max(1, Number.parseFloat(__ENV.SOAK_MINUTES || '15'));
const SOAK_SECONDS = SOAK_MINUTES * 60;
const RAMP_SECONDS = Math.max(0, Number.parseFloat(__ENV.RAMP_SECONDS || '20'));
const HEARTBEAT_SECONDS = Math.max(5, Number.parseFloat(__ENV.HEARTBEAT_SECONDS || '15'));
const ANSWER_SECONDS = Math.max(5, Number.parseFloat(__ENV.ANSWER_SECONDS || '30'));
const SUMMARY_SECONDS = Math.max(15, Number.parseFloat(__ENV.SUMMARY_SECONDS || '60'));
const RECOVERY_RATE = Math.min(1, Math.max(0, Number.parseFloat(__ENV.RECOVERY_RATE || '0.10')));
const VIOLATION_RATE = Math.min(1, Math.max(0, Number.parseFloat(__ENV.VIOLATION_RATE || '0')));
const ANSWER_RETRIES = Math.max(0, Number.parseInt(__ENV.ANSWER_RETRIES || '3', 10));
const ANSWER_RETRY_BASE_SECONDS = Math.max(0.05, Number.parseFloat(__ENV.ANSWER_RETRY_BASE_SECONDS || '0.5'));
const VERIFY_RETRIES = Math.max(0, Number.parseInt(__ENV.VERIFY_RETRIES || '3', 10));
const VERIFY_RETRY_BASE_SECONDS = Math.max(0.05, Number.parseFloat(__ENV.VERIFY_RETRY_BASE_SECONDS || '0.5'));
const ACCOUNTS_FILE = String(__ENV.ACCOUNTS_FILE || './accounts.loadtest.local.json');

if (!EXAM_ID) {
  throw new Error('EXAM_ID wajib diisi. Gunakan ID ujian LOAD TEST khusus, jangan ujian sungguhan.');
}

const accounts = new SharedArray('loadtest-soak-accounts', () => {
  const parsed = JSON.parse(open(ACCOUNTS_FILE));
  if (!Array.isArray(parsed)) throw new Error('File akun harus berupa array JSON.');
  return parsed;
});

if (accounts.length < ACCOUNT_OFFSET + VUS) {
  throw new Error(`Akun tidak cukup. Dibutuhkan ${ACCOUNT_OFFSET + VUS}, tersedia ${accounts.length}.`);
}

const loginFail = new Rate('login_fail');
const attemptStartFail = new Rate('attempt_start_fail');
const startQuestionFail = new Rate('start_questions_fail');
const heartbeatFail = new Rate('heartbeat_fail');
const answerFail = new Rate('answer_fail');
const recoveryFail = new Rate('recovery_fail');
const summaryFail = new Rate('summary_fail');
const violationFail = new Rate('violation_fail');
const answerTransportFail = new Rate('answer_transport_fail');
const answerVerificationFail = new Rate('answer_verification_fail');

const heartbeatCount = new Counter('heartbeat_count');
const answerCountMetric = new Counter('answer_count');
const answerRequestCount = new Counter('answer_request_count');
const answerRetryCount = new Counter('answer_retry_count');
const answerRetrySuccessCount = new Counter('answer_retry_success_count');
const logicalAnswerVerified = new Counter('logical_answer_verified');
const logicalAnswerLoss = new Counter('logical_answer_loss');
const recoveryCount = new Counter('recovery_count');
const completedSoakStudents = new Counter('completed_soak_students');

const loginDuration = new Trend('login_duration', true);
const heartbeatDuration = new Trend('heartbeat_duration', true);
const answerDuration = new Trend('answer_duration', true);
const recoveryDuration = new Trend('recovery_duration', true);
const summaryDuration = new Trend('summary_duration', true);

export const options = {
  scenarios: {
    cbt_soak: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: 1,
      maxDuration: `${Math.ceil(SOAK_MINUTES + (RAMP_SECONDS / 60) + 5)}m`,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    login_fail: ['rate<0.01'],
    attempt_start_fail: ['rate<0.01'],
    start_questions_fail: ['rate<0.01'],
    heartbeat_fail: ['rate<0.01'],
    answer_fail: ['rate<0.01'],
    answer_transport_fail: ['rate<0.01'],
    answer_verification_fail: ['rate==0'],
    logical_answer_loss: ['count==0'],
    recovery_fail: ['rate<0.01'],
    summary_fail: ['rate<0.01'],
    heartbeat_duration: ['p(95)<2000', 'p(99)<5000'],
    answer_duration: ['p(95)<2000', 'p(99)<5000'],
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

function postJson(path, body, headers, name) {
  return http.post(`${BASE_URL}${path}`, JSON.stringify(body), tagged(headers, name));
}

function logFailure(label, res) {
  if (!res || res.status === 200) return;
  const body = String(res.body || '').replace(/\s+/g, ' ').slice(0, 500);
  console.error(`${label} gagal: HTTP ${res.status}${body ? ` - ${body}` : ''}`);
}

function chooseAnswer(q) {
  const type = String(q?.type || '').toLowerCase();
  if (type === 'essay' || type === 'esay') return 'jawaban soak test';
  if (Array.isArray(q?.options) && q.options.length > 0) return String(q.options[0]);
  return 'A';
}

function isRetryableResponse(res) {
  const status = Number(res?.status || 0);
  return status === 0 || status === 429 || status === 502 || status === 503 || status === 504;
}

function retryDelaySeconds(baseSeconds, retryIndex) {
  const exponential = baseSeconds * Math.pow(2, Math.max(0, retryIndex));
  const jitter = 0.75 + (Math.random() * 0.5);
  return Math.min(8, exponential * jitter);
}

function sameAnswer(a, b) {
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch (_) {
    return String(a) === String(b);
  }
}

export default function () {
  const accountIndex = ACCOUNT_OFFSET + (__VU - 1);
  const account = accounts[accountIndex];
  if (!account?.username || !account?.password) {
    throw new Error(`Akun index ${accountIndex} tidak punya username/password.`);
  }

  // Stagger only the initial login/start. Each VU logs in exactly once.
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

  const loginRes = postJson('/api/login', loginBody, loginHeaders, 'POST /api/login [soak]');
  loginDuration.add(loginRes.timings.duration);
  const loginData = tryJson(loginRes);
  const token = String(loginData?.user?.token || loginData?.token || '');
  const loginOk = check(loginRes, {
    'soak login 200': (r) => r.status === 200,
    'soak login token tersedia': () => token.length > 20,
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

  const startRes = postJson('/api/exam/attempt/start', {
    studentId,
    examId: EXAM_ID,
  }, headers, 'POST /api/exam/attempt/start [soak]');
  const startOk = check(startRes, { 'soak attempt start 200': (r) => r.status === 200 });
  attemptStartFail.add(!startOk);
  if (!startOk) {
    logFailure('attempt start', startRes);
    return;
  }

  const questionsRes = postJson('/api/exam/attempt/start-questions', {
    studentId,
    examId: EXAM_ID,
  }, headers, 'POST /api/exam/attempt/start-questions [soak]');
  const questionsData = tryJson(questionsRes);
  const questions = Array.isArray(questionsData?.questions) ? questionsData.questions : [];
  const questionsOk = check(questionsRes, {
    'soak start-questions 200': (r) => r.status === 200,
    'soak soal tersedia': () => questions.length > 0,
  });
  startQuestionFail.add(!questionsOk);
  if (!questionsOk || questions.length === 0) {
    logFailure('start-questions', questionsRes);
    return;
  }

  // Synchronize authoritative totalQuestions after packet locking.
  const syncRes = postJson('/api/exam/attempt/start', {
    studentId,
    examId: EXAM_ID,
  }, headers, 'POST /api/exam/attempt/start [soak sync]');
  const syncOk = check(syncRes, { 'soak attempt sync 200': (r) => r.status === 200 });
  attemptStartFail.add(!syncOk);
  if (!syncOk) {
    logFailure('attempt sync', syncRes);
    return;
  }

  const startedAt = Date.now();
  const stopAt = startedAt + (SOAK_SECONDS * 1000);
  let nextHeartbeatAt = startedAt + (1000 + Math.random() * 3000);
  let heartbeatBackoffSeconds = 0;
  let nextAnswerAt = startedAt + (ANSWER_SECONDS * 1000 * (0.5 + Math.random()));
  let nextSummaryAt = startedAt + (SUMMARY_SECONDS * 1000 * (0.5 + Math.random()));
  let answerIndex = 0;
  const expectedAnswers = {};
  let recoveryDone = false;
  let violationDone = false;
  const shouldRecover = Math.random() < RECOVERY_RATE;
  const shouldViolate = Math.random() < VIOLATION_RATE;
  const recoveryAt = startedAt + ((SOAK_SECONDS * (0.35 + Math.random() * 0.3)) * 1000);
  const violationAt = startedAt + ((SOAK_SECONDS * (0.25 + Math.random() * 0.5)) * 1000);

  while (Date.now() < stopAt) {
    const now = Date.now();

    if (now >= nextHeartbeatAt) {
      const hbRes = postJson('/api/exam/heartbeat', {
        studentId,
        examId: EXAM_ID,
        currentIndex: Math.min(answerIndex, Math.max(0, questions.length - 1)),
      }, headers, 'POST /api/exam/heartbeat [soak]');
      heartbeatDuration.add(hbRes.timings.duration);
      const hbOk = check(hbRes, { 'soak heartbeat 200': (r) => r.status === 200 });
      heartbeatFail.add(!hbOk);
      heartbeatCount.add(1);
      if (!hbOk) {
        logFailure('heartbeat', hbRes);
        if (hbRes.status === 429 || hbRes.status === 503 || hbRes.status === 0) {
          heartbeatBackoffSeconds = heartbeatBackoffSeconds
            ? Math.min(60, heartbeatBackoffSeconds * 2)
            : 5;
        }
      } else {
        heartbeatBackoffSeconds = 0;
      }
      const nextHeartbeatSeconds = Math.max(HEARTBEAT_SECONDS, heartbeatBackoffSeconds);
      nextHeartbeatAt = now + ((nextHeartbeatSeconds + Math.random() * 3) * 1000);
    }

    if (answerIndex < questions.length && now >= nextAnswerAt) {
      const q = questions[answerIndex];
      const qId = String(q?.id || '');
      if (qId) {
        const answerValue = chooseAnswer(q);
        expectedAnswers[qId] = answerValue;
        const logicalAnswerStartedAt = Date.now();
        let answerRes = null;
        let answerOk = false;
        let usedRetry = false;

        for (let attempt = 0; attempt <= ANSWER_RETRIES; attempt++) {
          answerRes = postJson('/api/exam/attempt/answer', {
            studentId,
            examId: EXAM_ID,
            questionId: qId,
            answer: answerValue,
            currentIndex: answerIndex,
          }, headers, 'POST /api/exam/attempt/answer [soak]');

          answerRequestCount.add(1);
          const requestOk = answerRes.status === 200;
          answerTransportFail.add(!requestOk);

          if (requestOk) {
            answerOk = true;
            if (usedRetry) answerRetrySuccessCount.add(1);
            break;
          }

          if (!isRetryableResponse(answerRes) || attempt >= ANSWER_RETRIES) {
            break;
          }

          usedRetry = true;
          answerRetryCount.add(1);
          sleep(retryDelaySeconds(ANSWER_RETRY_BASE_SECONDS, attempt));
        }

        answerDuration.add(Date.now() - logicalAnswerStartedAt);
        check(answerRes, { 'soak answer 200': () => answerOk });
        answerFail.add(!answerOk);
        answerCountMetric.add(1);
        if (!answerOk) logFailure('answer setelah retry', answerRes);
      }
      answerIndex += 1;
      nextAnswerAt = now + (ANSWER_SECONDS * 1000 * (0.75 + Math.random() * 0.5));
    }

    if (now >= nextSummaryAt) {
      const summaryRes = http.get(
        `${BASE_URL}/api/exam/my-summary${tenantQuery}`,
        tagged(headers, 'GET /api/exam/my-summary [soak]')
      );
      summaryDuration.add(summaryRes.timings.duration);
      const summaryOk = check(summaryRes, { 'soak my-summary 200': (r) => r.status === 200 });
      summaryFail.add(!summaryOk);
      if (!summaryOk) logFailure('my-summary', summaryRes);
      nextSummaryAt = now + (SUMMARY_SECONDS * 1000);
    }

    // At most one recovery/reconnect simulation per selected VU.
    if (shouldRecover && !recoveryDone && now >= recoveryAt) {
      const recoveryRes = postJson('/api/exam/attempt/start', {
        studentId,
        examId: EXAM_ID,
      }, headers, 'POST /api/exam/attempt/start [soak recovery]');
      recoveryDuration.add(recoveryRes.timings.duration);
      const recoveryOk = check(recoveryRes, { 'soak recovery 200': (r) => r.status === 200 });
      recoveryFail.add(!recoveryOk);
      recoveryCount.add(1);
      if (!recoveryOk) logFailure('recovery', recoveryRes);
      recoveryDone = true;
    }

    // At most one tab-switch violation per selected VU.
    if (shouldViolate && !violationDone && now >= violationAt) {
      const violationRes = postJson('/api/exam/violation', {
        studentId,
        examId: EXAM_ID,
        reason: 'Soak test simulated tab switch',
        clientTimestamp: now,
      }, headers, 'POST /api/exam/violation [soak]');
      const violationOk = check(violationRes, { 'soak violation 200': (r) => r.status === 200 });
      violationFail.add(!violationOk);
      if (!violationOk) logFailure('violation', violationRes);
      violationDone = true;
    }

    sleep(0.25);
  }

  // Final authoritative verification: recover the server session and compare every
  // logical answer this VU attempted to send. HTTP 0/502/503/504/429 is retried
  // because the server may have committed an answer even when the ACK was lost.
  let verifyRes = null;
  let verifyOk = false;
  for (let attempt = 0; attempt <= VERIFY_RETRIES; attempt++) {
    verifyRes = postJson('/api/exam/attempt/start', {
      studentId,
      examId: EXAM_ID,
    }, headers, 'POST /api/exam/attempt/start [soak final verify]');

    if (verifyRes.status === 200) {
      verifyOk = true;
      break;
    }
    if (!isRetryableResponse(verifyRes) || attempt >= VERIFY_RETRIES) break;
    sleep(retryDelaySeconds(VERIFY_RETRY_BASE_SECONDS, attempt));
  }

  const verifyData = tryJson(verifyRes);
  const persistedAnswers = verifyData?.session?.answers;
  const verificationUsable = verifyOk && persistedAnswers && typeof persistedAnswers === 'object';
  answerVerificationFail.add(!verificationUsable);

  if (!verificationUsable) {
    logFailure('final answer verification', verifyRes);
  } else {
    for (const [questionId, expectedAnswer] of Object.entries(expectedAnswers)) {
      const hasAnswer = Object.prototype.hasOwnProperty.call(persistedAnswers, questionId);
      const storedAnswer = hasAnswer ? persistedAnswers[questionId] : undefined;
      if (hasAnswer && sameAnswer(storedAnswer, expectedAnswer)) {
        logicalAnswerVerified.add(1);
      } else {
        logicalAnswerLoss.add(1);
        console.error(
          `logical answer loss: student=${studentId} question=${questionId} expected_present=true stored_present=${hasAnswer}`
        );
      }
    }
  }

  completedSoakStudents.add(1);
}
