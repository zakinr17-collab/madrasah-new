import assert from 'node:assert/strict';
import fs from 'node:fs';
import { KeyedSerialQueue } from '../src/keyedSerialQueue.js';
import './runtime-regression.ts';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function testSameKeySerializes() {
  const queue = new KeyedSerialQueue();
  const events: string[] = [];
  let releaseFirst: () => void = () => {};
  const hold = new Promise<void>((resolve) => { releaseFirst = resolve; });

  const first = queue.run('questions', async () => {
    events.push('first:start');
    await hold;
    events.push('first:end');
  });
  await sleep(5);

  const second = queue.run('questions', async () => {
    events.push('second:start');
    events.push('second:end');
  });
  await sleep(15);

  assert.deepEqual(events, ['first:start'], 'same-key task started before prior writer finished');
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(events, ['first:start', 'first:end', 'second:start', 'second:end']);
  assert.equal(queue.pendingKeys, 0);
}

async function testDifferentKeysCanProgress() {
  const queue = new KeyedSerialQueue();
  let releaseA: () => void = () => {};
  const holdA = new Promise<void>((resolve) => { releaseA = resolve; });
  let bRan = false;

  const a = queue.run('questions', async () => { await holdA; });
  await sleep(5);
  await queue.run('rooms', async () => { bRan = true; });
  assert.equal(bRan, true, 'different keys should not block each other');
  releaseA();
  await a;
}

async function testFailureDoesNotPoisonKey() {
  const queue = new KeyedSerialQueue();
  await assert.rejects(queue.run('questions', async () => {
    throw new Error('expected failure');
  }));
  let ran = false;
  await queue.run('questions', async () => { ran = true; });
  assert.equal(ran, true, 'failed writer poisoned the per-key queue');
}

function testServerGuards() {
  const server = fs.readFileSync('server.ts', 'utf8');
  const drizzleConfig = fs.readFileSync('drizzle.config.ts', 'utf8');
  const drizzleDb = fs.readFileSync('src/db/db.ts', 'utf8');
  const sqlConfig = fs.readFileSync('src/db/connectionConfig.ts', 'utf8');
  const app = fs.readFileSync('src/appScript.js', 'utf8');
  const chat = fs.readFileSync('src/chatModule.js', 'utf8');
  const modules = fs.readFileSync('src/modulesScript.js', 'utf8');
  const settingsMisc = fs.readFileSync('src/settingsAndMisc.js', 'utf8');
  const assessment = fs.readFileSync('src/assessmentModule.js', 'utf8');
  const learningModule = fs.readFileSync('src/learningModule.js', 'utf8');
  const modulAjar = fs.readFileSync('src/modulAjarModule.js', 'utf8');
  const mainEntry = fs.readFileSync('src/main.tsx', 'utf8');
  const indexHtml = fs.readFileSync('index.html', 'utf8');

  assert.match(server, /dbWriteQueue\.run\(key, \(\) => writeKeyToPostgresDirectUnlocked\(key\)\)/);
  assert.match(server, /app\.delete\("\/api\/exams\/:id", requireAuth, requireRole/);
  assert.match(server, /app\.put\("\/api\/settings", requireAuth, requireRole\(\['bos', 'superadmin'\]\)/);
  assert.match(server, /__tenantScopedSettingsV1/);
  assert.match(server, /function examStateKey\(/);
  assert.match(server, /filterExamStateMapForRequest/);
  assert.match(server, /clientTenant !== eventTenant/);
  assert.match(server, /ONLINE_RUNTIME_STARTING/);
  assert.match(server, /startOnlineRuntimeInitializationLoop\(\)/);
  assert.match(server, /ONLINE_STARTUP_NOT_READY/);
  assert.match(server, /Retry-After", "2"/);
  assert.match(server, /function isOnlineRuntimeUsable\(\)/);
  assert.equal(server.includes('process.env.DATABASE_URL'), false, 'DATABASE_URL runtime fallback must stay removed');
  assert.equal(server.includes('name: "DATABASE_URL"'), false, 'DATABASE_URL candidate must stay removed');
  assert.match(server, /activeDbSource: "SQL_HOST" \| "NONE"/);
  assert.match(sqlConfig, /env\.SQL_USER[\s\S]*env\.PGUSER[\s\S]*env\.SQL_ADMIN_USER/);
  assert.match(sqlConfig, /env\.SQL_PASSWORD[\s\S]*env\.PGPASSWORD[\s\S]*env\.SQL_ADMIN_PASSWORD/);
  assert.match(sqlConfig, /env\.SQL_DB_NAME[\s\S]*env\.PGDATABASE[\s\S]*cloud_sql_production_database/);
  assert.match(sqlConfig, /for \(const baseDir of \['\/cloudsql', '\/app\/cloudsql'\]\)/);
  assert.match(sqlConfig, /ONLINE SQL_HOST must be a Cloud SQL Unix socket path/);
  assert.match(sqlConfig, /No mounted Cloud SQL Unix socket was found/);
  assert.match(sqlConfig, /ONLINE_CLOUD_SQL_SOCKET_AMBIGUOUS/);
  assert.match(sqlConfig, /Multiple Cloud SQL sockets are mounted\. Set SQL_HOST or CLOUD_SQL_CONNECTION_NAME explicitly/);
  assert.match(server, /if \(!pool \|\| isDbQuotaExceeded\) \{[\s\S]*ONLINE_DATABASE_UNAVAILABLE: cannot persist \$\{key\}/);
  assert.match(server, /hasHydratedPersistentState = true;[\s\S]*await runOneTimeMigrations\(\)/);
  assert.match(server, /reason,[\s\S]*readyAt: onlineRuntimeReadyAt/);
  assert.match(server, /if \(!isOnlineMode && connection\.host !== 'localhost'\)/);
assert.equal(server.includes("connection.host === 'localhost' ? 2000"), false, 'offline localhost PostgreSQL must not use the legacy 2s timeout');
assert.match(server, /connectionTimeoutMillis,/);
assert.match(server, /const offlineHttpsRequested = !isTrustedCloudRunRuntime && isOfflineMode &&/);
assert.match(server, /https\.createServer\(\{ key: offlineHttpsOptions\.key, cert: offlineHttpsOptions\.cert \}, app\)/);
assert.equal(server.includes('const offlineHttpsRequested = isOnlineMode'), false, 'offline HTTPS must never be enabled by online mode');
assert.match(server, /Trusted Cloud Run always keeps the normal HTTP listener/);
assert.match(server, /offline-https-ca-cert\.pem/);
assert.match(server, /meta\?\.sanSignature === sanSignature/);
  for (const source of [server, drizzleConfig, drizzleDb]) {
    assert.match(source, /resolveSqlConnection\(/);
    assert.equal(source.includes('process.env.DATABASE_URL'), false);
    assert.equal(source.includes("'cloud_sql_development_database'"), false);
  }
  assert.match(server, /hasHydratedPersistentState[\s\S]*pool[\s\S]*!isDbQuotaExceeded/);
  assert.match(server, /mergeLessonPlanDbSources\(/);
  assert.match(server, /madrasah_lessonPlans/);
  assert.match(server, /madrasah_lesson_plans/);
  assert.match(server, /migrateLegacyLessonPlansTenantOwnership\(\)/);
  assert.match(server, /inferLegacyLessonPlanTenant\(/);
  assert.match(server, /filterLessonPlansForRequest\(req\)/);
  assert.match(server, /let learningProgress: any\[] = bootStore\['learningProgress'\] \|\| \[\]/);
  assert.match(server, /function studentCanAccessLearningMaterial\(/);
  assert.match(server, /function teacherCanUseLearningMaterialPayload\(/);
  assert.match(server, /app\.get\("\/api\/learning\/materials", requireAuth/);
  assert.match(server, /app\.post\("\/api\/learning\/materials", requireAuth, requireRole/);
  assert.match(server, /app\.get\("\/api\/learning\/progress", requireAuth/);
  assert.match(server, /app\.post\("\/api\/learning\/progress", requireAuth, requireRole/);
  assert.match(server, /const key = learningProgressKey\(req, authUser\.id, materialId\)/);
  assert.match(server, /source: 'server-authoritative'/);
  assert.match(server, /function learningEngagementPolicy\(/);
  assert.match(server, /function learningBlockIds\(/);
  assert.match(server, /const blocks = sanitizeLearningBlocks\(material\?\.blocks\)/);
  assert.match(server, /Baca materi minimal \$\{policy\.minActiveSeconds\} detik aktif sebelum selesai\./);
  assert.match(server, /Semua bagian materi harus terlihat sebelum selesai\./);
  assert.match(server, /const mergedActiveSeconds = Math\.max\(activeSeconds, Number\(existing\.activeSeconds \|\| 0\)\)/);
  assert.match(server, /const mergedViewedBlockIds = Array\.from\(new Set\(/);
  assert.match(server, /const existingCompleted = existing\.status === 'completed'/);
  assert.match(server, /if \(completionRequested && !existingCompleted\)/);
  assert.match(server, /viewedBlockIds: mergedViewedBlockIds/);
  assert.match(server, /learningProgress: filteredLearningProgress/);
  assert.match(server, /filteredLessonPlans = filteredLessonPlans[\s\S]*studentCanAccessLearningMaterial\(selfStudent, material\)/);
  assert.match(learningModule, /fetch\('\/api\/learning\/materials'/);
  assert.match(learningModule, /fetch\('\/api\/learning\/progress'/);
  assert.match(learningModule, /LEARNING_QUEUE_KEY/);
  assert.match(learningModule, /flushLearningProgressQueue/);
  assert.match(learningModule, /error\.noOfflineQueue = response\.status >= 400 && response\.status < 500/);
  assert.match(learningModule, /function startLearningTracker\(/);
  assert.match(learningModule, /learningState\(\)\.__activeLearningTracker = null/);
  assert.match(learningModule, /active: !document\.hidden && document\.hasFocus\(\)/);
  assert.match(learningModule, /button\.disabled = true/);
  assert.match(learningModule, /button\.removeAttribute\('onclick'\)/);
  assert.match(learningModule, /function engagementReady\(/);
  assert.match(learningModule, /data-learning-block-id/);
  assert.match(learningModule, /learningCompletionPayload\(material\)/);
  assert.match(learningModule, /learning-min-active-seconds/);
  assert.match(learningModule, /function normalizeLearningClassTargets\(/);
  assert.match(learningModule, /window\.addLearningClass = function/);
  assert.match(learningModule, /window\.removeLearningClass = function/);
  assert.match(learningModule, /id="learning-selected-classes"/);
  assert.match(learningModule, /classes: selectedClasses/);
  assert.match(server, /let classes = Array\.from\(new Set\(/);
  assert.match(server, /classes = \['ALL'\]/);
  assert.equal((server.match(/classes: normalizedTargetClasses/g) || []).length >= 2, true);
  assert.match(learningModule, /learning-require-all-blocks/);
  assert.match(learningModule, /Baca Aktif/);
  assert.match(learningModule, /LEARNING_CHECKPOINT_SECONDS = 12/);
  assert.match(learningModule, /function checkpointLearningTracker\(/);
  assert.match(learningModule, /savedActiveSeconds \* 1000/);
  assert.match(learningModule, /new Set\(Array\.isArray\(savedProgress\.viewedBlockIds\)/);
  assert.match(learningModule, /window\.addEventListener\('pagehide', tracker\.onPageHide\)/);
  assert.match(learningModule, /currentSeconds - tracker\.lastCheckpointSeconds >= LEARNING_CHECKPOINT_SECONDS/);
  assert.match(learningModule, /if \(!staffPreview && !alreadyCompleted\)/);
  assert.match(learningModule, /stopLearningTracker\(\{ checkpoint: false \}\)/);
  assert.match(server, /const learningAssetsDir = path\.join\(uploadsDir, "learning_assets"\)/);
  assert.match(server, /function parseSafePdfDataUrl\(/);
  assert.match(server, /function isTrustedLearningAssetUrl\(/);
  assert.match(server, /app\.post\("\/api\/learning\/assets", requireAuth, requireRole/);
  assert.match(server, /app\.get\("\/api\/learning-assets\/:assetId"/);
  assert.match(server, /resource_type: isPdf \? 'raw' : 'image'/);
  assert.match(server, /type === 'image' \|\| type === 'pdf'/);
  assert.match(learningModule, /handleLearningAssetSelection/);
  assert.match(learningModule, /uploadPendingLearningAssets/);
  assert.match(learningModule, /accept="image\/jpeg,image\/png,image\/webp,application\/pdf"/);
  assert.match(learningModule, /type === 'image'/);
  assert.match(learningModule, /type === 'pdf'/);
  assert.match(learningModule, /Buka PDF/);
  assert.match(app, /function navigateBack\(/);
  assert.match(app, /appState\.navigationHistory/);
  assert.match(app, /window\.stopLearningTrackerForNavigation/);
  assert.match(indexHtml, /id="global-back-bar"/);
  assert.match(indexHtml, /onclick="navigateBack\(\)"/);
  assert.match(server, /if \(status && !\['active', 'aktif', 'published'\]\.includes\(status\)\) return false;/);
  assert.match(server, /const createLkpdDraft = req\.body\?\.createLkpdDraft === true/);
  assert.match(server, /const createExamDraft = req\.body\?\.createExamDraft === true/);
  assert.match(server, /status: 'inactive',[\s\S]*sourceLearningMaterialId: material\.id/);
  assert.match(server, /status: 'Draft',[\s\S]*sourceLearningMaterialId: material\.id/);
  assert.match(server, /linkedActivities:[\s\S]*lkpdReady:[\s\S]*examReady:/);
  assert.match(learningModule, /__CREATE_DRAFT__/);
  assert.match(learningModule, /Buat draft LKPD otomatis/);
  assert.match(learningModule, /Buat draft asesmen otomatis/);
  assert.match(learningModule, /LKPD sedang disiapkan guru/);
  assert.match(learningModule, /Asesmen sedang disiapkan guru/);
  assert.match(learningModule, /openLearningLinkedActivityEditor/);
  assert.match(assessment, /const activatingDraft = Boolean\(existingExamForEdit && \['draft', 'inactive'\]\.includes\(existingEditStatus\)\)/);
  assert.match(assessment, /if \(!editId \|\| activatingDraft\)/);
  assert.match(assessment, /status: activatingDraft \? 'Active' : originalStatus/);
  assert.match(assessment, /Draft asesmen sudah dilengkapi dan diaktifkan\. 1 Token Ujian dikonsumsi saat aktivasi\./);
  assert.equal(learningModule.includes('madrasah_learning_done_'), false, 'learning completion must not use legacy local-only done keys');
  assert.match(app, /data-learning-menu="1" onclick="navigateTo\('learning_teacher'\)/);
  assert.match(app, /data-learning-menu="1" onclick="navigateTo\('learning_student'\)/);
  assert.match(settingsMisc, /set-learning-enabled/);
  assert.match(settingsMisc, /set-student-cbt-enabled/);
  assert.match(server, /__legacyTenantRecoveredV1/);
  assert.match(server, /lessonPlans: filteredTenant/);
  assert.match(server, /lessonPlans: filtered/);
  assert.match(app, /waitForServerRuntimeReady\(/);
  assert.match(app, /fetch\('\/api\/health'/);
  assert.equal(app.includes("fetch('/readyz'"), false, 'frontend startup must not poll a 503 readiness endpoint');
  assert.match(app, /runtimeReady = await waitForServerRuntimeReady\(45000\)/);
  assert.match(app, /runtimeReady = await waitForServerRuntimeReady\(15000\)/);
  assert.match(app, /normalizeLessonPlanCollection\(resData\)/);
  assert.match(settingsMisc, /normalizeLessonPlanCollection \? window\.normalizeLessonPlanCollection\(lpRes\)/);
  assert.match(modulAjar, /isSameSubject\(getLessonPlanSubjectForView\(lp\), s\.id, appState\.subjects\)/);
  assert.equal(modulAjar.includes("String(lp.subjectId) === String(s.id)"), false);
  assert.match(server, /flattenLessonPlanValue/);
  assert.match(app, /resolvePhotoUrl/);
  assert.match(app, /getPhotoHtmlSrc/);
  assert.match(mainEntry, /madrasah:runtime-ready/);
  assert.match(indexHtml, /id="app-initial-loader-status"/);
  const listenIndex = server.indexOf('app.listen(PORT, "0.0.0.0"');
  const backgroundInitIndex = server.lastIndexOf('startOnlineRuntimeInitializationLoop();');
  assert.equal(listenIndex >= 0, true, 'server listen marker missing');
  assert.equal(backgroundInitIndex > listenIndex, true, 'online DB initialization must run after the port is listening');
  assert.equal(server.includes('akan terus di-hydrate di latar belakang'), false, 'misleading one-shot hydration warning remains');
  assert.match(server, /try \{[\s\S]*os\.networkInterfaces\(\)[\s\S]*Network interface enumeration unavailable/);

  assert.match(server, /app\.put\("\/api\/student\/profile", requireAuth, requireRole/);
  assert.match(server, /const isStudentSelfServicePhotoMutation =[\s\S]*set-profile-photo[\s\S]*photo-history/);
  assert.match(server, /!staffRoles\.has\(role\) &&[\s\S]*!isStudentSelfServicePhotoMutation/);
  assert.match(server, /Siswa hanya dapat mengubah foto profil miliknya sendiri\./);
  assert.match(server, /Siswa hanya dapat menghapus riwayat foto miliknya sendiri\./);
  assert.match(server, /withTokenLedger\(async \(\) =>/);
  assert.match(server, /Permintaan top-up ini sudah diproses/);
  assert.match(server, /function examBroadcastStateKey\(/);
  assert.match(server, /CBT_EXAM_CASCADE_CLEANUP_V1/);
  assert.match(server, /function collectOrphanExamIdsForTenant\(/);
  assert.match(server, /function cleanupExamStateForExam\(/);
  assert.match(server, /legacyIdConflictsWithLkpd/);
  assert.match(server, /OFFLINE_LOCALSTORE_CBT_CLEANUP_V1/);
  assert.match(server, /app\.post\("\/api\/exams\/cleanup-orphan-state", requireAuth, requireRole\(\['admin', 'bos', 'superadmin'\]\)/);
  assert.match(server, /cleanupSummary = await cleanupExamStateForExam\(examId, examTenant/);
  assert.match(server, /State CBT ujian belum dapat dibersihkan\. Ujian tidak dihapus\./);
  assert.match(server, /function resolveExamViolationLogKey\(/);
  assert.match(server, /app\.get\("\/update_offline\.zip", requireAuth, requireRole/);
  assert.match(server, /maxPayload: 256 \* 1024/);
  assert.match(server, /Frame livecam terlalu besar/);
  assert.match(server, /function parseSafeRasterDataUrl\(/);
  assert.equal(server.includes('examViolationLogs[eId].unshift'), false);
  assert.match(server, /function runWithDbKeyLocks/);
  assert.match(server, /async function writeBatchToPostgresDirect/);
  assert.match(server, /await writeBatchToPostgresDirect\(normalizedItems\.map/);
  assert.match(server, /rewardAlreadyClaimed/);
  assert.match(server, /storeMutationQueue\.run\(rewardLockKey/);
  assert.match(server, /State sesi game terlalu besar/);
  assert.match(server, /Jawaban terlalu besar\. Maksimal 64 KB per soal/);
  assert.match(server, /Format frame livecam tidak valid/);
  assert.match(server, /function sanitizeMadrasahMemberView/);
  assert.match(server, /function teacherAllowedSubjectsForRequest/);
  assert.match(server, /function questionBankGroupsForRequest/);
  assert.match(server, /function questionsForRequest/);
  assert.match(server, /function examsForRequest/);
  assert.match(server, /Batch soal memuat mata pelajaran di luar assignment guru/);
  assert.match(server, /const scopedStudents = filterByMadrasah\(students \|\| \[\], req\)/);
  assert.equal(server.includes('if (isOnlineMode && isStudentSyncRole)'), false);
  assert.match(server, /const resolvedExam = resolveTenantItemIndexById\(examSource, eId, req\)/);
  assert.match(server, /app\.get\("\/api\/token-requests", requireAuth, requireRole/);
  assert.match(server, /LKPD_STUDENT_STATE_V1/);
  assert.match(server, /TEACHER_SYNC_SCOPE_V2/);
  assert.match(server, /TEACHER_MONITOR_SCOPE_V2/);
  assert.match(server, /TEACHER_LIVECAM_SCOPE_V1/);
  assert.match(server, /function teacherCanMonitorStudentRealtime\(/);
  assert.match(server, /Guru hanya dapat membuka livecam siswa pada ujian aktif yang diampu/);
  assert.match(server, /app\.post\("\/api\/exam\/livekit-token", requireAuth/);
  assert.match(server, /P2P_ONLY_LIVECAM_SERVER_V5/);
  assert.match(server, /teacherCanMonitorStudentRealtime\(wsReq, user, target\)/);
  assert.match(server, /LKPD_STUDENT_SUBMISSION_WRITE_SCOPE/);
  assert.match(server, /LKPD_REALTIME_EVENT_V2/);
  assert.match(server, /STUDENT_ATTENDANCE_POLICY_V1/);
  assert.match(server, /function validateStudentAttendancePolicy\(/);
  assert.match(server, /const policyError = validateStudentAttendancePolicy\(req, photo, location\)/);
  assert.match(server, /for \(const item of data\.slice\(0, 100\)\)/);
  assert.match(server, /status: 'HADIR',[\s\S]*note: '',[\s\S]*timestamp: Date\.now\(\)/);
  assert.match(modules, /GPS belum tersedia atau tidak valid/);
  assert.equal(modules.includes("location: window._currentLatLon ? \`${window._currentLatLon.latitude}, ${window._currentLatLon.longitude}\` : '-6.2000, 106.8166'"), false);
  assert.match(server, /saveDeltaBatchDb/);
  assert.match(server, /monitoringStateKeyAllowedForActor/);
  assert.match(server, /teacherCanUseLkpdPayload/);
  assert.match(server, /function normalizeStudentStoredRole\(/);
  assert.match(server, /role: normalizeStudentStoredRole\(student\.role\)/);
  assert.match(server, /app\.get\("\/api\/exam\/my-review", requireAuth, requireRole\(\[\'student\', \'siswa\', \'class_leader\', \'ketua_kelas\'\]\)/);
  const studentReviewRouteStart = server.indexOf('app.get("/api/exam/my-review"');
  const studentReviewRouteEnd = server.indexOf('\napp.', studentReviewRouteStart + 20);
  const studentReviewRoute = server.slice(studentReviewRouteStart, studentReviewRouteEnd > studentReviewRouteStart ? studentReviewRouteEnd : undefined);
  assert.match(studentReviewRoute, /sanitizeQuestionForStudent\(question\)/);
  assert.match(studentReviewRoute, /studentAnswer/);
  for (const forbidden of ['correctAnswer', 'correctOptionIndex', 'correctOptionLetter', 'isCorrect', 'explanation']) {
    assert.equal(studentReviewRoute.includes(forbidden), false, 'student review leaked secret field: ' + forbidden);
  }
  const studentReviewUiStart = assessment.indexOf('window.openStudentExamReviewModal = async function');
  const studentReviewUiEnd = assessment.indexOf('function reconcileStudentCbtServerSummary', studentReviewUiStart);
  const studentReviewUi = assessment.slice(studentReviewUiStart, studentReviewUiEnd);
  assert.match(studentReviewUi, /\/api\/exam\/my-review/);
  assert.match(studentReviewUi, /Pilihan Anda/);
  assert.equal(studentReviewUi.includes('isCorrectAnswer('), false, 'student review must not calculate correctness');
  assert.equal(studentReviewUi.includes('isOptionAnswerKey('), false, 'student review must not identify the answer key');
  assert.equal(studentReviewUi.includes('Pembahasan \/ Penjelasan'), false, 'student review must not expose explanations');
  const resultDownloadRouteStart = server.indexOf('app.get("/api/exam/my-result-download"');
  const resultDownloadRouteEnd = server.indexOf('\napp.', resultDownloadRouteStart + 20);
  const resultDownloadRoute = server.slice(resultDownloadRouteStart, resultDownloadRouteEnd > resultDownloadRouteStart ? resultDownloadRouteEnd : undefined);
  assert.match(resultDownloadRoute, /allowDownloadResult !== true/);
  assert.match(resultDownloadRoute, /grade\.isGraded === true/);
  assert.match(resultDownloadRoute, /grade\.finalScore !== undefined/);
  assert.match(resultDownloadRoute, /isMasterMultipleChoiceAnswerCorrect/);
  assert.match(resultDownloadRoute, /correctAnswer/);
  assert.match(resultDownloadRoute, /explanation/);
  const studentPdfStart = assessment.indexOf('async function downloadStudentExamPDF');
  const studentPdfEnd = assessment.indexOf('// Automatically expose functions', studentPdfStart);
  const studentPdfBlock = assessment.slice(studentPdfStart, studentPdfEnd);
  assert.match(studentPdfBlock, /\/api\/exam\/my-result-download/);
  assert.match(studentPdfBlock, /Kunci Jawaban/);
  assert.match(studentPdfBlock, /Pembahasan:/);
  assert.match(assessment, /ex\.allowDownloadResult && resultIsFinal/);
  assert.match(assessment, /PDF hasil tersedia setelah koreksi selesai/);
  assert.match(server, /function studentCanAccessExam\(/);
  assert.match(server, /filteredExams = selfStudent[\s\S]*studentCanAccessExam\(selfStudent, exam\)/);
  assert.match(server, /filteredLkpds = selfStudent[\s\S]*studentCanAccessLkpd\(selfStudent, lkpd\)/);
  assert.match(server, /list = ownStudent \? list\.filter\(\(exam: any\) => studentCanAccessExam\(ownStudent, exam\)\) : \[\]/);
  assert.match(server, /const stateContext = getExamAttemptContext\(req, authUser, sId, eId\)/);
  assert.match(server, /summaryIsStudent \|\| studentCanAccessExam\(summaryStudent\.student, ex\)/);
  assert.equal(server.includes('role: student.role || "student"'), false);
  assert.equal(server.includes('role: req.body.role || "student"'), false);
  assert.equal(server.includes('role: req.body.role ?? st.role'), false);
  assert.match(server, /app\.delete\("\/api\/lkpds\/:id", requireAuth, requireRole/);
  assert.match(server, /parsed\.studentId === String\(studentId\)/);
  assert.match(server, /parsed\.lkpdId === String\(lkpdId\)/);
  assert.equal(server.includes('Guru hanya dapat memonitor ujian mata pelajaran/bank soal yang diampu'), true);
  assert.match(server, /function lkpdStateKey\(/);
  assert.match(server, /function lkpdBroadcastStateKey\(/);
  assert.match(server, /function lkpdLegacyStateKeysForRequest\(/);
  assert.match(server, /function lkpdStateCandidateKeys\(/);
  assert.match(server, /migrateDeltaState\(blockedStudents, 'blockedStudents'\)/);
  assert.match(server, /queueDelta\('activeExamSessions', legacyKey, null\)/);
  assert.match(server, /await saveDeltaBatchDb\(deltaWrites\)/);
  assert.match(server, /const blocked = personalKeys\.some/);
  assert.match(server, /for \(const candidate of personalKeys\) delete nextMessages\[candidate\]/);
  assert.match(server, /const ownCandidates = \(students \|\| \[\]\)\.filter/);
  assert.match(server, /app\.post\("\/api\/lkpd\/student-state"/);
  const lkpdModule = fs.readFileSync('src/lkpdModule.js', 'utf8');
  assert.match(lkpdModule, /fetch\('\/api\/lkpd\/student-state'/);
  assert.equal(lkpdModule.includes("fetch('/api/exam-monitoring-state')"), false);
  assert.match(lkpdModule, /LKPD_REALTIME_CLIENT_V2/);
  assert.equal(lkpdModule.includes("fetch('/api/lkpds')"), true);
  assert.match(lkpdModule, /fetch\('\/api\/lkpds\/' \+ encodeURIComponent\(lkpdId\), \{ method: 'DELETE' \}\)/);
  assert.match(lkpdModule, /payload\.active === false/);
  assert.equal((lkpdModule.match(/Date\.now\(\) - lastSeenAt < 30000/g) || []).length >= 2, true);
  assert.equal(app.includes("/api/sync-state?key=lkpdList"), false);
  assert.match(app, /payload.type === 'lkpd_progress'/);

  assert.match(app, /sessionStorage\.setItem\(AUTH_SESSION_TOKEN_KEY/);
  assert.equal(app.includes("localStorage.setItem('madrasah_current_user', JSON.stringify(loggedInUser))"), false);
  assert.match(chat, /chatEscape\(msg\.text\)/);
  assert.equal(chat.includes('$' + '{msg.text}'), false);
  const staffAiRoutes = [
    '/api/gemini/generate-questions',
    '/api/gemini/generate-enrichment',
    '/api/gemini/generate-modul',
    '/api/gemini/generate-modul-all',
    '/api/modul/parse-document',
    '/api/modul/import-ai-structure',
    '/api/gemini/generate-modul2-general',
    '/api/gemini/generate-modul2-bab',
    '/api/gemini/generate-ppt',
    '/api/gemini/generate-poster',
    '/api/gemini/generate-kbc-document',
    '/api/gemini/generate-soal-kisi',
    '/api/gemini/generate-rpp',
    '/api/gemini/generate-device'
  ];
  const staffMiddlewareMarker = ", requireAuth, requireRole(['teacher', 'guru', 'admin', 'bos', 'superadmin'])";
  for (const route of staffAiRoutes) {
    assert.equal(server.includes('app.post("' + route + '"' + staffMiddlewareMarker), true, 'AI/module route is not explicitly staff-only: ' + route);
  }
  assert.match(server, /ID ujian ambigu lintas tenant\. Pilih madrasah target terlebih dahulu\./);
  assert.match(server, /ID LKPD ambigu lintas tenant\. Pilih madrasah target terlebih dahulu\./);
  assert.match(server, /TEACHER_SELF_UPDATE_SCOPE/);
  assert.match(server, /SUBJECT_RENAME_CASCADE/);
  assert.match(fs.readFileSync('src/cbtModules.js', 'utf8'), /QUESTION_BANK_LOAD_GUARD/);
  const orphanCleanupScript = fs.readFileSync('tests/cleanup-cbt-orphans.ps1', 'utf8');
  const soakCleanupScript = fs.readFileSync('tests/cleanup-cbt-soak.ps1', 'utf8');
  assert.match(orphanCleanupScript, /\/api\/exams\/cleanup-orphan-state/);
  assert.match(orphanCleanupScript, /\[switch\]\$DryRun/);
  assert.equal(soakCleanupScript.includes('[string]$AccountsPath = (Join-Path $PSScriptRoot'), false, 'PowerShell parameter binding must not depend on PSScriptRoot');
  assert.match(soakCleanupScript, /FallbackAccounts/);
  const cbtSource = fs.readFileSync('src/cbtModules.js', 'utf8');
  assert.match(cbtSource, /qbEscapeHtml\(q\.question \|\| ''\)/);
  assert.match(cbtSource, /qbSafeImageSrc\(q\.imageUrl \|\| q\.image\)/);
  assert.match(cbtSource, /qbEscapeHtml\(previewText\)/);
  assert.match(cbtSource, /function qbDecodeLegacyEntities\(value\)/);
  assert.match(cbtSource, /const sourceText = qbDecodeLegacyEntities\(text\)/);
  assert.match(cbtSource, /const mathSource = qbDecodeLegacyEntities\(el\.textContent \|\| ''\)/);
  assert.match(cbtSource, /el\.textContent = mathSource/);
  const gameSubmitStart = server.indexOf('app.post("/api/games/:id/submit"');
  const gameSubmitEnd = server.indexOf('\napp.', gameSubmitStart + 20);
  const gameSubmitRoute = server.slice(gameSubmitStart, gameSubmitEnd > gameSubmitStart ? gameSubmitEnd : undefined);
  assert.match(gameSubmitRoute, /isCorrect = \(normSubmitted === normTarget\);/);
  assert.doesNotMatch(gameSubmitRoute, /normSubmitted\.includes\(normTarget\)|normTarget\.includes\(normSubmitted\)/);
  assert.match(fs.readFileSync('src/modulAjarModule.js', 'utf8'), /IMPORT_GROUP_SERVER_AUTHORITATIVE/);
  assert.match(server, /=== examTenant/);
  assert.match(server, /=== lkpdTenant/);
  assert.equal(server.includes("const store = readLocalStore();\n    let lkpdList = store.lkpdList || [];"), false);
  assert.match(server, /default-src 'none'; style-src 'none'; script-src 'none'; sandbox/);

  for (const destructive of [
    'exams = [...otherExams, ...taggedIncoming]',
    'rooms = [...otherRooms, ...taggedIncoming]',
    'journals = [...otherJournals, ...taggedIncoming]',
    'calendarEvents = [...otherEvents, ...taggedIncoming]',
    'generatedExams = [...otherExams, ...taggedIncoming]'
  ]) {
    assert.equal(server.includes(destructive), false, 'destructive online batch pattern remains: ' + destructive);
  }

  for (const legacyKey of [
    'const key = sId + "_" + eId;',
    "const key = studentId + '_' + examId;",
    'const key = studentId + "_" + examId;'
  ]) {
    assert.equal(server.includes(legacyKey), false, 'unscoped CBT key remains: ' + legacyKey);
  }
}

await testSameKeySerializes();
await testDifferentKeysCanProgress();
await testFailureDoesNotPoisonKey();
testServerGuards();
console.log('Hardening regression passed.');
