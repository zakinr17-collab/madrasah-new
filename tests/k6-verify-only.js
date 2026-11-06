// VERIFY-ONLY: verifikasi jawaban siswa yang final verification-nya gagal karena
// jaringan tester drop di akhir soak test (answer_verification_fail).
// Tidak menulis apa pun ke server — hanya login, baca my-state, cocokkan jawaban.
//
// CARA PAKAI: file accounts-verify.local.json berisi array akun yang mau dicek,
// misal 315 akun yang terkena "final answer verification gagal".
// PENTING: EXAM_ID harus ujian soak yang sama (jawaban lama dibaca apa adanya).
//
// $env:BASE_URL = "https://madrasahku.ai.studio"
// $env:TENANT = "default"
// $env:EXAM_ID = "EX_MAT_WEB_xxx"
// $env:ACCOUNTS_FILE = "./accounts-verify.local.json"
// k6 run .\tests\k6-verify-only.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';
import { Rate, Counter, Trend } from 'k6/metrics';

const BASE_URL = String(__ENV.BASE_URL || 'https://madrasahku.ai.studio').replace(/\/+$/, '');
const TENANT = String(__ENV.TENANT || '').trim();
const EXAM_ID = String(__ENV.EXAM_ID || '').trim();
const VUS = Math.max(1, Number.parseInt(__ENV.VUS || '20', 10));
const ACCOUNTS_FILE = String(__ENV.ACCOUNTS_FILE || './accounts-verify.local.json');

if (!EXAM_ID) throw new Error('EXAM_ID wajib diisi.');

const accounts = new SharedArray('verify-accounts', () => {
  const parsed = JSON.parse(open(ACCOUNTS_FILE));
  if (!Array.isArray(parsed)) throw new Error('File akun harus berupa array JSON.');
  return parsed;
});

const loginFail = new Rate('verify_login_fail');
const stateFail = new Rate('verify_state_fail');
const mismatchFail = new Rate('verify_answer_mismatch_fail');
const verifiedOk = new Counter('verify_students_ok');
const verifiedStudents = new Counter('verify_students_checked');
const duration = new Trend('verify_duration', true);

export const options = {
  scenarios: {
    verify: {
      executor: 'shared-iterations',
      vus: VUS,
      iterations: accounts.length,
      maxDuration: '15m',
    },
  },
  thresholds: {
    verify_login_fail: ['rate==0'],
    verify_state_fail: ['rate==0'],
    verify_answer_mismatch_fail: ['rate==0'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

function tryJson(res) { try { return res.json(); } catch (_) { return null; } }

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

function sameAnswer(a, b) {
  try { return JSON.stringify(a) === JSON.stringify(b); } catch (_) { return String(a) === String(b); }
}

export default function () {
  const account = accounts[__ITER];
  if (!account?.username || !account?.password) {
    console.error(`akun index ${__ITER} tidak valid`);
    mismatchFail.add(1);
    return;
  }

  const startedAt = Date.now();
  const loginBody = { username: String(account.username), password: String(account.password) };
  const loginHeaders = { 'Content-Type': 'application/json' };
  if (TENANT) {
    loginBody.madrasahId = TENANT;
    loginBody.madrasahSlug = TENANT;
    loginHeaders['X-Madrasah-Id'] = TENANT;
  }

  const loginRes = http.post(`${BASE_URL}/api/login`, JSON.stringify(loginBody),
    { headers: loginHeaders, timeout: '30s' });
  const loginData = tryJson(loginRes);
  const token = String(loginData?.user?.token || loginData?.token || '');
  const loginOk = loginRes.status === 200 && token.length > 20;
  loginFail.add(!loginOk);
  if (!loginOk) {
    console.error(`login gagal: ${account.username} HTTP ${loginRes.status}`);
    verifiedStudents.add(1);
    duration.add(Date.now() - startedAt);
    return;
  }

  const effectiveTenant = String(TENANT || loginData?.user?.madrasahId || loginData?.user?.madrasahSlug || '').trim();
  const headers = authHeaders(token, effectiveTenant);
  const studentId = String(loginData?.user?.id || account.studentId || '');
  const tenantSuffix = effectiveTenant ? `&madrasahId=${encodeURIComponent(effectiveTenant)}` : '';

  let stateRes = null;
  let stateData = null;
  for (let attempt = 0; attempt < 4; attempt++) {
    stateRes = http.get(
      `${BASE_URL}/api/exam/my-state?examId=${encodeURIComponent(EXAM_ID)}${tenantSuffix}`,
      { headers, timeout: '30s' }
    );
    if (stateRes.status === 200) {
      stateData = tryJson(stateRes);
      break;
    }
    sleep(1 + attempt);
  }

  const stateOk = stateRes && stateRes.status === 200 && stateData?.answers;
  stateFail.add(!stateOk);
  if (!stateOk) {
    console.error(`my-state gagal: ${account.username} HTTP ${stateRes?.status}`);
    verifiedStudents.add(1);
    duration.add(Date.now() - startedAt);
    return;
  }

  // Cocokkan jawaban yang tersimpan server terhadap daftar jawaban benar
  // yang dibawa dari soak test (kolom "answers" pada akun di accounts-verify.local.json).
  const expected = account.answers || null;
  if (!expected || typeof expected !== 'object') {
    console.warn(`tidak ada snapshot jawaban utk ${account.username} — hanya cek state tersimpan`);
    verifiedStudents.add(1);
    verifiedOk.add(1);
    duration.add(Date.now() - startedAt);
    return;
  }

  let mismatches = 0;
  const stored = stateData.answers;
  for (const [qid, expectedAnswer] of Object.entries(expected)) {
    const has = Object.prototype.hasOwnProperty.call(stored, qid);
    if (!has || !sameAnswer(stored[qid], expectedAnswer)) {
      mismatches += 1;
      console.error(`MISMATCH: student=${account.username} question=${qid} stored=${has ? 'beda' : 'hilang'}`);
    }
  }
  mismatchFail.add(mismatches > 0);
  if (mismatches === 0) verifiedOk.add(1);
  verifiedStudents.add(1);
  duration.add(Date.now() - startedAt);
}
