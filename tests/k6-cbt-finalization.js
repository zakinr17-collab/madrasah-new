import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate, Counter, Trend } from 'k6/metrics';

const BASE_URL = String(__ENV.BASE_URL || 'https://madrasahku.ai.studio').replace(/\/+$/, '');
const TENANT = String(__ENV.TENANT || '').trim();
const EXAM_ID = String(__ENV.EXAM_ID || '').trim();
const VUS = Math.max(1, Number.parseInt(__ENV.VUS || '300', 10));
const ACCOUNT_OFFSET = Math.max(0, Number.parseInt(__ENV.ACCOUNT_OFFSET || '0', 10));
const RAMP_SECONDS = Math.max(0, Number.parseFloat(__ENV.RAMP_SECONDS || '120'));
const ANSWER_RETRIES = Math.max(0, Number.parseInt(__ENV.ANSWER_RETRIES || '3', 10));
const ANSWER_RETRY_BASE_SECONDS = Math.max(0.05, Number.parseFloat(__ENV.ANSWER_RETRY_BASE_SECONDS || '0.5'));
const FINISH_RETRIES = Math.max(0, Number.parseInt(__ENV.FINISH_RETRIES || '3', 10));
const FINISH_RETRY_BASE_SECONDS = Math.max(0.05, Number.parseFloat(__ENV.FINISH_RETRY_BASE_SECONDS || '0.5'));
const VERIFY_RETRIES = Math.max(0, Number.parseInt(__ENV.VERIFY_RETRIES || '4', 10));
const VERIFY_RETRY_BASE_SECONDS = Math.max(0.05, Number.parseFloat(__ENV.VERIFY_RETRY_BASE_SECONDS || '0.5'));
const ANSWER_DELAY_SECONDS = Math.max(0, Number.parseFloat(__ENV.ANSWER_DELAY_SECONDS || '0.05'));
const FINISH_JITTER_SECONDS = Math.max(0, Number.parseFloat(__ENV.FINISH_JITTER_SECONDS || '2'));
const ACCOUNTS_FILE = String(__ENV.ACCOUNTS_FILE || './accounts.loadtest.local.json');

if (!EXAM_ID) {
  throw new Error('EXAM_ID wajib diisi. Gunakan ID ujian LOAD TEST khusus, jangan ujian sungguhan.');
}

const accounts = new SharedArray('loadtest-finalization-accounts', () => {
  const parsed = JSON.parse(open(ACCOUNTS_FILE));
  if (!Array.isArray(parsed)) throw new Error('File akun harus berupa array JSON.');
  return parsed;
});

if (accounts.length < ACCOUNT_OFFSET + VUS) {
  throw new Error(`Akun tidak cukup. Dibutuhkan ${ACCOUNT_OFFSET + VUS}, tersedia ${accounts.length}.`);
}

const loginFail = new Rate('login_fail');
const preexistingCompletedFail = new Rate('preexisting_completed_fail');
const attemptStartFail = new Rate('attempt_start_fail');
const startQuestionsFail = new Rate('start_questions_fail');
const answerFail = new Rate('answer_fail');
const answerTransportFail = new Rate('answer_transport_fail');
const prefinishVerificationFail = new Rate('prefinish_verification_fail');
const finishFail = new Rate('finish_fail');
const finishTransportFail = new Rate('finish_transport_fail');
const postfinishStateFail = new Rate('postfinish_state_fail');
const postfinishSummaryFail = new Rate('postfinish_summary_fail');
const gradeVerificationFail = new Rate('grade_verification_fail');

const answerCount = new Counter('answer_count');
const answerRequestCount = new Counter('answer_request_count');
const answerRetryCount = new Counter('answer_retry_count');
const answerRetrySuccessCount = new Counter('answer_retry_success_count');
const logicalAnswerVerifiedBeforeFinish = new Counter('logical_answer_verified_before_finish');
const logicalAnswerLossBeforeFinish = new Counter('logical_answer_loss_before_finish');
const logicalAnswerVerifiedAfterFinish = new Counter('logical_answer_verified_after_finish');
const logicalAnswerLossAfterFinish = new Counter('logical_answer_loss_after_finish');
const finishRequestCount = new Counter('finish_request_count');
const finishRetryCount = new Counter('finish_retry_count');
const finishDirectSuccessCount = new Counter('finish_direct_success_count');
const finishReconciledSuccessCount = new Counter('finish_reconciled_success_count');
const completedFinalizationStudents = new Counter('completed_finalization_students');

const loginDuration = new Trend('login_duration', true);
const answerDuration = new Trend('answer_duration', true);
const prefinishVerifyDuration = new Trend('prefinish_verify_duration', true);
const finishDuration = new Trend('finish_duration', true);
const postfinishVerifyDuration = new Trend('postfinish_verify_duration', true);

export const options = {
  scenarios: {
    cbt_finalization: {
      executor: 'per-vu-iterations',
      vus: VUS,
      iterations: 1,
      maxDuration: `${Math.ceil((RAMP_SECONDS / 60) + 12)}m`,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    login_fail: ['rate==0'],
    preexisting_completed_fail: ['rate==0'],
    attempt_start_fail: ['rate==0'],
    start_questions_fail: ['rate==0'],
    answer_fail: ['rate==0'],
    answer_transport_fail: ['rate<0.01'],
    prefinish_verification_fail: ['rate==0'],
    logical_answer_loss_before_finish: ['count==0'],
    finish_fail: ['rate==0'],
    finish_transport_fail: ['rate<0.01'],
    postfinish_state_fail: ['rate==0'],
    postfinish_summary_fail: ['rate==0'],
    grade_verification_fail: ['rate==0'],
    logical_answer_loss_after_finish: ['count==0'],
    completed_finalization_students: [`count==${VUS}`],
    answer_duration: ['p(95)<2000', 'p(99)<5000'],
    finish_duration: ['p(95)<5000', 'p(99)<10000'],
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

function getJson(path, headers, name) {
  return http.get(`${BASE_URL}${path}`, tagged(headers, name));
}

function logFailure(label, res) {
  if (!res) {
    console.error(`${label} gagal: response kosong`);
    return;
  }
  const body = String(res.body || '').replace(/\s+/g, ' ').slice(0, 500);
  console.error(`${label} gagal: HTTP ${res.status}${body ? ` - ${body}` : ''}`);
}

function chooseAnswer(q) {
  const type = String(q?.type || '').toLowerCase();
  if (type === 'essay' || type === 'esay') return 'jawaban finalization test';
  if (Array.isArray(q?.options) && q.options.length > 0) return String(q.options[0]);
  return 'A';
}

function isRetryableStatus(status) {
  const code = Number(status || 0);
  return code === 0 || code === 429 || code === 502 || code === 503 || code === 504;
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

function buildTenantQuery(effectiveTenant) {
  return effectiveTenant ? `&madrasahId=${encodeURIComponent(effectiveTenant)}` : '';
}

function fetchMyState(headers, effectiveTenant, name) {
  const tenantSuffix = buildTenantQuery(effectiveTenant);
  return getJson(
    `/api/exam/my-state?examId=${encodeURIComponent(EXAM_ID)}${tenantSuffix}`,
    headers,
    name
  );
}

function fetchMySummary(headers, effectiveTenant, name) {
  const query = effectiveTenant ? `?madrasahId=${encodeURIComponent(effectiveTenant)}` : '';
  return getJson(`/api/exam/my-summary${query}`, headers, name);
}

function verifyExpectedAnswers(expectedAnswers, storedAnswers, verifiedMetric, lossMetric, label, studentId) {
  let losses = 0;
  const source = storedAnswers && typeof storedAnswers === 'object' ? storedAnswers : {};

  for (const [questionId, expectedAnswer] of Object.entries(expectedAnswers)) {
    const hasAnswer = Object.prototype.hasOwnProperty.call(source, questionId);
    const storedAnswer = hasAnswer ? source[questionId] : undefined;

    if (hasAnswer && sameAnswer(storedAnswer, expectedAnswer)) {
      verifiedMetric.add(1);
    } else {
      losses += 1;
      lossMetric.add(1);
      console.error(
        `${label}: student=${studentId} question=${questionId} expected_present=true stored_present=${hasAnswer}`
      );
    }
  }

  return losses === 0;
}

function verifyStateWithRetry(headers, effectiveTenant, expectedCompleted, namePrefix) {
  let lastRes = null;
  let data = null;

  for (let attempt = 0; attempt <= VERIFY_RETRIES; attempt++) {
    lastRes = fetchMyState(headers, effectiveTenant, `GET /api/exam/my-state [${namePrefix}]`);
    data = tryJson(lastRes);

    if (lastRes.status === 200) {
      const completed = data?.completed === true || data?.status === 'completed' || data?.status === 'force_finished';
      if (!expectedCompleted || completed) {
        return { ok: true, res: lastRes, data };
      }
    }

    if (!isRetryableStatus(lastRes.status) && lastRes.status !== 200) {
      break;
    }

    if (attempt < VERIFY_RETRIES) {
      sleep(retryDelaySeconds(VERIFY_RETRY_BASE_SECONDS, attempt));
    }
  }

  return { ok: false, res: lastRes, data };
}

function reconcileFinish(headers, effectiveTenant) {
  const reconciliation = verifyStateWithRetry(headers, effectiveTenant, true, 'finish reconcile');
  if (!reconciliation.ok) return { completed: false, state: reconciliation.data, res: reconciliation.res };

  const completed = reconciliation.data?.completed === true ||
    reconciliation.data?.status === 'completed' ||
    reconciliation.data?.status === 'force_finished';

  return { completed, state: reconciliation.data, res: reconciliation.res };
}

export default function () {
  const accountIndex = ACCOUNT_OFFSET + (__VU - 1);
  const account = accounts[accountIndex];

  if (!account?.username || !account?.password) {
    throw new Error(`Akun index ${accountIndex} tidak punya username/password.`);
  }

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

  const loginRes = postJson('/api/login', loginBody, loginHeaders, 'POST /api/login [finalization]');
  loginDuration.add(loginRes.timings.duration);
  const loginData = tryJson(loginRes);
  const token = String(loginData?.user?.token || loginData?.token || '');

  const loginOk = check(loginRes, {
    'finalization login 200': (r) => r.status === 200,
    'finalization login token tersedia': () => token.length > 20,
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

  const preState = verifyStateWithRetry(headers, effectiveTenant, false, 'preflight');
  const wasAlreadyCompleted = preState.ok && (
    preState.data?.completed === true ||
    preState.data?.status === 'completed' ||
    preState.data?.status === 'force_finished'
  );
  preexistingCompletedFail.add(wasAlreadyCompleted);

  check(preState.res, {
    'finalization preflight state 200': (r) => r?.status === 200,
    'finalization exam belum completed': () => !wasAlreadyCompleted,
  });

  if (!preState.ok || wasAlreadyCompleted) {
    if (!preState.ok) logFailure('preflight state', preState.res);
    if (wasAlreadyCompleted) {
      console.error(`preflight ditolak: student=${studentId} exam=${EXAM_ID} sudah completed. Gunakan ujian LOAD TEST baru/reset.`);
    }
    return;
  }

  const startRes = postJson('/api/exam/attempt/start', {
    studentId,
    examId: EXAM_ID,
  }, headers, 'POST /api/exam/attempt/start [finalization]');
  const startOk = check(startRes, { 'finalization attempt start 200': (r) => r.status === 200 });
  attemptStartFail.add(!startOk);

  if (!startOk) {
    logFailure('attempt start', startRes);
    return;
  }

  const questionsRes = postJson('/api/exam/attempt/start-questions', {
    studentId,
    examId: EXAM_ID,
  }, headers, 'POST /api/exam/attempt/start-questions [finalization]');
  const questionsData = tryJson(questionsRes);
  const questions = Array.isArray(questionsData?.questions) ? questionsData.questions : [];

  const questionsOk = check(questionsRes, {
    'finalization start-questions 200': (r) => r.status === 200,
    'finalization soal tersedia': () => questions.length > 0,
  });
  startQuestionsFail.add(!questionsOk);

  if (!questionsOk || questions.length === 0) {
    logFailure('start-questions', questionsRes);
    return;
  }

  const syncRes = postJson('/api/exam/attempt/start', {
    studentId,
    examId: EXAM_ID,
  }, headers, 'POST /api/exam/attempt/start [finalization sync]');
  const syncOk = check(syncRes, { 'finalization attempt sync 200': (r) => r.status === 200 });
  attemptStartFail.add(!syncOk);

  if (!syncOk) {
    logFailure('attempt sync', syncRes);
    return;
  }

  const expectedAnswers = {};

  for (let index = 0; index < questions.length; index++) {
    const q = questions[index];
    const questionId = String(q?.id || '');
    if (!questionId) continue;

    const answerValue = chooseAnswer(q);
    expectedAnswers[questionId] = answerValue;

    const logicalStartedAt = Date.now();
    let answerRes = null;
    let answerOk = false;
    let usedRetry = false;

    for (let attempt = 0; attempt <= ANSWER_RETRIES; attempt++) {
      answerRes = postJson('/api/exam/attempt/answer', {
        studentId,
        examId: EXAM_ID,
        questionId,
        answer: answerValue,
        currentIndex: index,
      }, headers, 'POST /api/exam/attempt/answer [finalization]');

      answerRequestCount.add(1);
      const requestOk = answerRes.status === 200;
      answerTransportFail.add(!requestOk);

      if (requestOk) {
        answerOk = true;
        if (usedRetry) answerRetrySuccessCount.add(1);
        break;
      }

      if (!isRetryableStatus(answerRes.status) || attempt >= ANSWER_RETRIES) {
        break;
      }

      usedRetry = true;
      answerRetryCount.add(1);
      sleep(retryDelaySeconds(ANSWER_RETRY_BASE_SECONDS, attempt));
    }

    answerDuration.add(Date.now() - logicalStartedAt);
    answerCount.add(1);
    answerFail.add(!answerOk);
    check(answerRes, { 'finalization logical answer tersimpan': () => answerOk });

    if (!answerOk) {
      logFailure('answer setelah retry', answerRes);
      return;
    }

    if (ANSWER_DELAY_SECONDS > 0) sleep(ANSWER_DELAY_SECONDS);
  }

  const prefinishStartedAt = Date.now();
  const prefinishState = verifyStateWithRetry(headers, effectiveTenant, false, 'prefinish verify');
  prefinishVerifyDuration.add(Date.now() - prefinishStartedAt);

  const prefinishUsable = prefinishState.ok &&
    prefinishState.data?.answers &&
    typeof prefinishState.data.answers === 'object' &&
    prefinishState.data?.completed !== true &&
    prefinishState.data?.status !== 'completed';

  prefinishVerificationFail.add(!prefinishUsable);
  check(prefinishState.res, {
    'prefinish my-state 200': (r) => r?.status === 200,
    'prefinish attempt masih aktif': () => prefinishUsable,
  });

  if (!prefinishUsable) {
    logFailure('prefinish verification', prefinishState.res);
    return;
  }

  const prefinishAnswersOk = verifyExpectedAnswers(
    expectedAnswers,
    prefinishState.data.answers,
    logicalAnswerVerifiedBeforeFinish,
    logicalAnswerLossBeforeFinish,
    'logical answer loss before finish',
    studentId
  );

  if (!prefinishAnswersOk) return;

  if (FINISH_JITTER_SECONDS > 0) {
    sleep(Math.random() * FINISH_JITTER_SECONDS);
  }

  const finishStartedAt = Date.now();
  let finishOk = false;
  let finishRes = null;
  let reconciled = false;

  for (let attempt = 0; attempt <= FINISH_RETRIES; attempt++) {
    finishRes = postJson('/api/exam/attempt/finish', {
      studentId,
      examId: EXAM_ID,
      answers: expectedAnswers,
    }, headers, 'POST /api/exam/attempt/finish [finalization]');

    finishRequestCount.add(1);
    const transportLikeFailure = isRetryableStatus(finishRes.status);
    finishTransportFail.add(transportLikeFailure);

    if (finishRes.status === 200) {
      finishOk = true;
      finishDirectSuccessCount.add(1);
      break;
    }

    // A lost finish response is ambiguous: the server may already have committed
    // completion. Reconcile authoritative state BEFORE deciding to submit again.
    if (transportLikeFailure || finishRes.status === 409) {
      const reconciliation = reconcileFinish(headers, effectiveTenant);
      if (reconciliation.completed) {
        finishOk = true;
        reconciled = true;
        finishReconciledSuccessCount.add(1);
        break;
      }
    }

    if (!transportLikeFailure || attempt >= FINISH_RETRIES) {
      break;
    }

    finishRetryCount.add(1);
    sleep(retryDelaySeconds(FINISH_RETRY_BASE_SECONDS, attempt));
  }

  finishDuration.add(Date.now() - finishStartedAt);
  finishFail.add(!finishOk);

  check(finishRes, {
    'finalization finish berhasil atau ter-reconcile': () => finishOk,
  });

  if (!finishOk) {
    logFailure('finish', finishRes);
    return;
  }

  if (reconciled) {
    console.log(`finish response terputus tetapi completion terkonfirmasi: student=${studentId}`);
  }

  const postfinishStartedAt = Date.now();
  const postState = verifyStateWithRetry(headers, effectiveTenant, true, 'postfinish verify');
  postfinishVerifyDuration.add(Date.now() - postfinishStartedAt);

  const postCompleted = postState.ok && (
    postState.data?.completed === true ||
    postState.data?.status === 'completed'
  );
  const sessionGone = postState.ok && postState.data?.status !== 'in_progress';
  const postStateUsable = postCompleted && sessionGone;

  postfinishStateFail.add(!postStateUsable);
  check(postState.res, {
    'postfinish my-state 200': (r) => r?.status === 200,
    'postfinish completed true': () => postCompleted,
    'postfinish session tidak aktif': () => sessionGone,
  });

  if (!postStateUsable) {
    logFailure('postfinish state', postState.res);
    return;
  }

  const postAnswersOk = verifyExpectedAnswers(
    expectedAnswers,
    postState.data?.answers,
    logicalAnswerVerifiedAfterFinish,
    logicalAnswerLossAfterFinish,
    'logical answer loss after finish',
    studentId
  );

  if (!postAnswersOk) return;

  let summaryRes = null;
  let summaryData = null;
  let summaryOk = false;

  for (let attempt = 0; attempt <= VERIFY_RETRIES; attempt++) {
    summaryRes = fetchMySummary(headers, effectiveTenant, 'GET /api/exam/my-summary [finalization verify]');
    summaryData = tryJson(summaryRes);

    const completedList = Array.isArray(summaryData?.completedExams) ? summaryData.completedExams : [];
    const publicKey = `${studentId}_${EXAM_ID}`;
    const grade = summaryData?.grades?.[publicKey];
    const activeSession = summaryData?.activeSessions?.[publicKey];

    const completedListed = completedList.map(String).includes(EXAM_ID);
    const gradePresent = grade && typeof grade === 'object';
    const inactive = !activeSession;

    if (summaryRes.status === 200 && completedListed && gradePresent && inactive) {
      summaryOk = true;
      break;
    }

    if (!isRetryableStatus(summaryRes.status) && summaryRes.status !== 200) {
      break;
    }

    if (attempt < VERIFY_RETRIES) {
      sleep(retryDelaySeconds(VERIFY_RETRY_BASE_SECONDS, attempt));
    }
  }

  const publicKey = `${studentId}_${EXAM_ID}`;
  const finalGrade = summaryData?.grades?.[publicKey];
  const completedListed = Array.isArray(summaryData?.completedExams) &&
    summaryData.completedExams.map(String).includes(EXAM_ID);
  const gradePresent = finalGrade && typeof finalGrade === 'object';
  const inactiveInSummary = !summaryData?.activeSessions?.[publicKey];

  postfinishSummaryFail.add(!summaryOk);
  gradeVerificationFail.add(!(gradePresent && finalGrade?.submissionType === 'normal'));

  check(summaryRes, {
    'postfinish my-summary 200': (r) => r?.status === 200,
    'postfinish exam ada di completedExams': () => completedListed,
    'postfinish grade tersedia': () => Boolean(gradePresent),
    'postfinish submissionType normal': () => finalGrade?.submissionType === 'normal',
    'postfinish active session sudah hilang': () => inactiveInSummary,
  });

  if (!summaryOk || !gradePresent || finalGrade?.submissionType !== 'normal') {
    logFailure('postfinish summary/grade', summaryRes);
    return;
  }

  completedFinalizationStudents.add(1);
}
