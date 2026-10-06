import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate, Counter, Trend } from 'k6/metrics';
import exec from 'k6/execution';

const BASE_URL = String(__ENV.BASE_URL || 'https://madrasahku.ai.studio').replace(/\/+$/, '');
const TENANT = String(__ENV.TENANT || '').trim();
const EXAM_ID = String(__ENV.EXAM_ID || '').trim();
const VUS = Math.max(1, Number.parseInt(__ENV.VUS || '300', 10));
const ACCOUNT_OFFSET = Math.max(0, Number.parseInt(__ENV.ACCOUNT_OFFSET || '0', 10));
const RAMP_SECONDS = Math.max(1, Number.parseFloat(__ENV.RAMP_SECONDS || '120'));
const HEALTH_INTERVAL = Math.max(0.25, Number.parseFloat(__ENV.HEALTH_INTERVAL || '1'));
const ACCOUNTS_FILE = String(__ENV.ACCOUNTS_FILE || './accounts.loadtest.local.json');

if (!EXAM_ID) {
  throw new Error('EXAM_ID wajib diisi. Gunakan ujian LOAD TEST baru/bersih, bukan ujian sungguhan.');
}

const accounts = new SharedArray('cbt-startup-diagnostic-accounts', () => {
  const parsed = JSON.parse(open(ACCOUNTS_FILE));
  if (!Array.isArray(parsed)) throw new Error('File akun harus berupa array JSON.');
  return parsed;
});

if (accounts.length < ACCOUNT_OFFSET + VUS) {
  throw new Error(`Akun tidak cukup. Dibutuhkan ${ACCOUNT_OFFSET + VUS}, tersedia ${accounts.length}.`);
}

const loginFail = new Rate('login_fail');
const attemptStartFail = new Rate('attempt_start_fail');
const startQuestionsFail = new Rate('start_questions_fail');
const syncFail = new Rate('sync_fail');
const healthFail = new Rate('health_fail');

const startupSuccess = new Counter('startup_success');
const loginSuccess = new Counter('login_success');
const attemptStartSuccess = new Counter('attempt_start_success');
const startQuestionsSuccess = new Counter('start_questions_success');
const syncSuccess = new Counter('sync_success');
const healthSuccess = new Counter('health_success');

const loginDuration = new Trend('login_duration', true);
const attemptStartDuration = new Trend('attempt_start_duration', true);
const startQuestionsDuration = new Trend('start_questions_duration', true);
const syncDuration = new Trend('sync_duration', true);
const healthDuration = new Trend('health_duration', true);

const STARTUP_MAX_SECONDS = Math.ceil(RAMP_SECONDS + 90);
const HEALTH_RUN_SECONDS = Math.ceil(RAMP_SECONDS + 45);

export const options = {
  scenarios: {
    cbt_startup: {
      executor: 'per-vu-iterations',
      exec: 'startupStudent',
      vus: VUS,
      iterations: 1,
      maxDuration: `${STARTUP_MAX_SECONDS}s`,
    },
    health_probe: {
      executor: 'constant-vus',
      exec: 'healthProbe',
      vus: 1,
      duration: `${HEALTH_RUN_SECONDS}s`,
      gracefulStop: '5s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    login_fail: ['rate<0.01'],
    attempt_start_fail: ['rate<0.01'],
    start_questions_fail: ['rate<0.01'],
    sync_fail: ['rate<0.01'],
    health_fail: ['rate<0.01'],
    login_duration: ['p(95)<2000', 'p(99)<5000'],
    attempt_start_duration: ['p(95)<2000', 'p(99)<5000'],
    start_questions_duration: ['p(95)<2000', 'p(99)<5000'],
    sync_duration: ['p(95)<2000', 'p(99)<5000'],
    health_duration: ['p(95)<1000', 'p(99)<2000'],
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

function requestOptions(headers, name, timeout = '15s') {
  return {
    headers,
    tags: { name },
    timeout,
  };
}

function postJson(path, body, headers, name) {
  return http.post(
    `${BASE_URL}${path}`,
    JSON.stringify(body),
    requestOptions(headers, name)
  );
}

function logFailure(label, res, accountIndex) {
  const status = Number(res?.status || 0);
  const duration = Number(res?.timings?.duration || 0).toFixed(2);
  const body = String(res?.body || '').replace(/\s+/g, ' ').slice(0, 300);
  console.error(
    `${label} gagal | accountIndex=${accountIndex} | HTTP ${status} | duration=${duration}ms${body ? ` | ${body}` : ''}`
  );
}

export function startupStudent() {
  const iterationIndex = Number(exec.scenario.iterationInTest);
  const accountIndex = ACCOUNT_OFFSET + iterationIndex;
  const account = accounts[accountIndex];

  if (!account?.username || !account?.password) {
    throw new Error(`Akun index ${accountIndex} tidak punya username/password.`);
  }

  // Sebarkan 300 bootstrap sesi secara merata, tetapi tiap siswa hanya melakukannya satu kali.
  if (RAMP_SECONDS > 0 && VUS > 1) {
    sleep((iterationIndex / (VUS - 1)) * RAMP_SECONDS);
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

  const loginRes = postJson('/api/login', loginBody, loginHeaders, 'POST /api/login [startup diagnostic]');
  loginDuration.add(loginRes.timings.duration);
  const loginData = tryJson(loginRes);
  const token = String(loginData?.user?.token || loginData?.token || '');
  const loginOk = check(loginRes, {
    'startup login 200': (r) => r.status === 200,
    'startup login token tersedia': () => token.length > 20,
  });
  loginFail.add(!loginOk);
  if (!loginOk || !token) {
    logFailure('login', loginRes, accountIndex);
    return;
  }
  loginSuccess.add(1);

  const effectiveTenant = String(
    TENANT ||
    loginData?.user?.madrasahId ||
    loginData?.user?.madrasahSlug ||
    ''
  ).trim();
  const headers = authHeaders(token, effectiveTenant);
  const studentId = String(loginData?.user?.id || account.studentId || '');

  const startRes = postJson('/api/exam/attempt/start', {
    studentId,
    examId: EXAM_ID,
  }, headers, 'POST /api/exam/attempt/start [startup diagnostic]');
  attemptStartDuration.add(startRes.timings.duration);
  const startOk = check(startRes, {
    'startup attempt/start 200': (r) => r.status === 200,
  });
  attemptStartFail.add(!startOk);
  if (!startOk) {
    logFailure('attempt/start', startRes, accountIndex);
    return;
  }
  attemptStartSuccess.add(1);

  const questionsRes = postJson('/api/exam/attempt/start-questions', {
    studentId,
    examId: EXAM_ID,
  }, headers, 'POST /api/exam/attempt/start-questions [startup diagnostic]');
  startQuestionsDuration.add(questionsRes.timings.duration);
  const questionsData = tryJson(questionsRes);
  const questions = Array.isArray(questionsData?.questions) ? questionsData.questions : [];
  const questionsOk = check(questionsRes, {
    'startup start-questions 200': (r) => r.status === 200,
    'startup soal tersedia': () => questions.length > 0,
  });
  startQuestionsFail.add(!questionsOk);
  if (!questionsOk || questions.length === 0) {
    logFailure('start-questions', questionsRes, accountIndex);
    return;
  }
  startQuestionsSuccess.add(1);

  // Sinkronisasi kedua sama dengan alur soak/browser: totalQuestions/state sudah authoritative.
  const syncRes = postJson('/api/exam/attempt/start', {
    studentId,
    examId: EXAM_ID,
  }, headers, 'POST /api/exam/attempt/start [startup sync diagnostic]');
  syncDuration.add(syncRes.timings.duration);
  const syncOk = check(syncRes, {
    'startup sync attempt/start 200': (r) => r.status === 200,
  });
  syncFail.add(!syncOk);
  if (!syncOk) {
    logFailure('attempt/start sync', syncRes, accountIndex);
    return;
  }
  syncSuccess.add(1);

  startupSuccess.add(1);
}

export function healthProbe() {
  const res = http.get(
    `${BASE_URL}/api/health`,
    requestOptions({}, 'GET /api/health [startup diagnostic]', '5s')
  );
  healthDuration.add(res.timings.duration);

  const ok = check(res, {
    'startup health 200': (r) => r.status === 200,
  });
  healthFail.add(!ok);

  if (ok) {
    healthSuccess.add(1);
  } else {
    console.error(`health gagal | HTTP ${res.status} | duration=${res.timings.duration.toFixed(2)}ms`);
  }

  sleep(HEALTH_INTERVAL);
}
