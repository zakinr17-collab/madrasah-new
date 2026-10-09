// Regression tests for the optional split learning companion (Node 22, no browser).
// Testing the real learningModule.js with a minimal DOM and CBT bridge mock.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'src/learningModule.js'), 'utf8');
const assessment = fs.readFileSync(path.join(root, 'src/assessmentModule.js'), 'utf8');
const backend = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
const checks = [
  ['Backend opt-in persistence', backend.includes("allowExamReference: raw.allowExamReference === undefined")],
  ['Backend display-mode persistence', backend.includes("learningDisplayMode: String(raw.learningDisplayMode")],
  ['CBT active-screen hook', assessment.includes("window.onLearningCbtScreenReady(String(sess.exam.id))")],
  ['CBT session teardown', assessment.includes("window.onLearningCbtSessionEnded()")],
  ['CBT trusted-reference focus guard', assessment.includes("window.isTrustedLearningReferenceFocus(String(activeExamSession.exam.id))")],
  ['LKPD screen ready signal', fs.readFileSync(path.join(root, 'src/lkpdModule.js'), 'utf8').includes('window.onLearningLkpdScreenReady(String(lkpd.id), String(stId))')],
  ['LKPD exit cleanup', fs.readFileSync(path.join(root, 'src/lkpdModule.js'), 'utf8').includes('window.onLearningLkpdSessionEnded()')]
];
for (const [name, passed] of checks) assert.ok(passed, name);

// Execute the real TypeScript material sanitizer with isolated dependency stubs.
// This catches regressions in the actual online/offline shared API write path.
const sanitizeStart = backend.indexOf('function sanitizeLearningMaterialMutation(');
const sanitizeEnd = backend.indexOf('\nfunction learningProgressKey(', sanitizeStart);
assert.ok(sanitizeStart >= 0 && sanitizeEnd > sanitizeStart, 'Server material sanitizer found');
const sanitizerSource = backend.slice(sanitizeStart, sanitizeEnd);
const compiledSanitizer = require('esbuild').transformSync(sanitizerSource, {
  loader: 'ts', target: 'es2022'
}).code;
const sanitizeLearningMaterialMutation = vm.runInNewContext(
  compiledSanitizer + '\nsanitizeLearningMaterialMutation',
  {
    tagNewRecord: record => record,
    sanitizeLearningBlocks: raw => Array.isArray(raw) ? raw : [],
    isTeacherRequest: () => false,
    teacherCanUseLearningMaterialPayload: () => true,
    teacherCanUseLkpdPayload: () => true,
    teacherCanUseExamPayload: () => true,
    isItemForCurrentMadrasah: () => true,
    lkpdList: [], exams: [],
    crypto: { randomBytes: () => ({ toString: () => 'fixture' }) }
  }
);
const req = { user: { id: 'TEACHER-1' } };
const baseMaterial = { id: 'MATERIAL-1', title: 'Fixture', classes: ['ALL'] };
const openBook = sanitizeLearningMaterialMutation(req, {
  ...baseMaterial, learningDisplayMode: 'split', allowExamReference: true
});
assert.equal(openBook.learningDisplayMode, 'split', 'Split mode persists');
assert.equal(openBook.allowExamReference, true, 'Teacher opt-in persists');
const disabled = sanitizeLearningMaterialMutation(req, {
  ...baseMaterial, learningDisplayMode: 'sequential', allowExamReference: false
}, openBook);
assert.equal(disabled.learningDisplayMode, 'sequential', 'Teacher can disable split mode');
assert.equal(disabled.allowExamReference, false, 'Teacher can revoke open-book access');
const legacy = sanitizeLearningMaterialMutation(req, baseMaterial);
assert.equal(legacy.learningDisplayMode, 'sequential', 'Old content stays sequential');
assert.equal(legacy.allowExamReference, false, 'Old content is closed-book by default');
function testContext(allowExamReference = true) {
  let dock = null, confirmationCount = 0, styles = [];
  const classes = new Set();
  const document = {
    hidden: false,
    activeElement: null,
    head: { appendChild(style) { styles.push(style); } },
    body: {
      classList: { add(name) { classes.add(name); }, remove(name) { classes.delete(name); } },
      insertAdjacentHTML(_position, html) {
        if (html.includes('id="learning-split-dock"')) {
          dock = {
            html,
            getAttribute(name) {
              if (name === 'data-learning-companion-kind') return html.match(/data-learning-companion-kind="([^"]+)"/)?.[1] || null;
              if (name === 'data-learning-material-id') return html.match(/data-learning-material-id="([^"]+)"/)?.[1] || null;
              return null;
            },
            contains(target) { return target?.insideDock === true; },
            remove() { dock = null; },
            querySelector() { return null; },
            classList: { toggle() {} }
          };
        }
      }
    },
    getElementById(id) {
      if (id === 'learning-split-dock') return dock;
      if (id === 'learning-split-dock-style') return { remove() { styles = []; } };
      if (id === 'view-container') return { innerHTML: '' };
      return null;
    },
    createElement() { return { id: '', textContent: '' }; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {}
  };
  const user = { id: 'STUDENT-1', role: 'student' };
  const material = {
    id: 'MATERIAL-1', title: 'Pelajaran Kimia',
    examId: 'EXAM-1', lkpdId: 'LKPD-1', learningDisplayMode: 'split',
    allowExamReference, blocks: [{ type: 'text', content: 'Penjelasan atom' }]
  };
  const window = {
    appState: { role: 'student', currentUser: user, exams: [{ id: 'EXAM-1' }], lkpdList: [{ id: 'LKPD-1' }], settings: {} },
    __learningMaterials: [material],
    addEventListener() {},
    navigateTo() {},
    confirmStartStudentExam() { confirmationCount++; },
    openStudentLkpdWorksheetModal() {}
  };
  const context = vm.createContext({
    window, document, console,
    URL, setTimeout() {}, clearTimeout() {}, setInterval() {}, clearInterval() {},
    navigator: { onLine: true }, localStorage: {getItem() {return null;}, setItem() {}, removeItem() {}}
  });
  vm.runInContext(source, context, { filename: 'learningModule.js', timeout: 2000 });
  return { context, window, document, material, get dock() { return dock; },
    get confirmationCount() { return confirmationCount; }, classes };
}
(async function run() {
  const study = testContext(true);
  const youtube = vm.runInContext('learningYoutubeEmbedUrl("https://youtu.be/dQw4w9WgXcQ")', study.context);
  assert.equal(youtube, 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0&playsinline=1');
  assert.equal(vm.runInContext('learningYoutubeEmbedUrl("https://www.youtube.com.evil.org/watch?v=dQw4w9WgXcQ")', study.context), '');
  await study.window.openLinkedLearningExam('EXAM-1', 'MATERIAL-1');
  assert.equal(study.confirmationCount, 1, 'Original CBT confirmation must be invoked');
  assert.equal(study.dock, null, 'Do not show reference while confirming exam');
  study.window.onLearningCbtScreenReady('OTHER-EXAM');
  assert.equal(study.dock, null, 'Never show references for unrelated exams');
  study.window.onLearningCbtScreenReady('EXAM-1');
  assert.ok(study.dock, 'Authorized exam should show companion after active render');
  assert.ok(study.classes.has('learning-split-active'), 'Main view should split');
  study.document.activeElement = { tagName: 'IFRAME', insideDock: true };
  assert.equal(study.window.isTrustedLearningReferenceFocus('EXAM-1'), true);
  assert.equal(study.window.isTrustedLearningReferenceFocus('OTHER-EXAM'), false);
  study.document.activeElement = { tagName: 'IFRAME', insideDock: false };
  assert.equal(study.window.isTrustedLearningReferenceFocus('EXAM-1'), false, 'External iframes are not trusted');
  study.window.onLearningCbtSessionEnded();
  assert.equal(study.dock, null, 'Companion removed on CBT completion');
  assert.equal(study.classes.has('learning-split-active'), false);
  const closed = testContext(false);
  await closed.window.openLinkedLearningExam('EXAM-1', 'MATERIAL-1');
  closed.window.onLearningCbtScreenReady('EXAM-1');
  assert.equal(closed.dock, null, 'Default/closed-book exams must not show material');
  const cancel = testContext(true);
  await cancel.window.openLinkedLearningExam('EXAM-1', 'MATERIAL-1');
  cancel.window.onLearningCbtSessionEnded();
  cancel.window.onLearningCbtScreenReady('EXAM-1');
  assert.equal(cancel.dock, null, 'Cancelled exam must not leave a pending reference');
  const worksheet = testContext(true);
  await worksheet.window.openLinkedLearningLkpd('LKPD-1', 'MATERIAL-1');
  assert.equal(worksheet.dock, null, 'LKPD reference must wait until worksheet is ready');
  worksheet.window.onLearningLkpdScreenReady('LKPD-1', 'OTHER-STUDENT');
  assert.equal(worksheet.dock, null, 'Other student cannot get this reference');
  const worksheet2 = testContext(true);
  await worksheet2.window.openLinkedLearningLkpd('LKPD-1', 'MATERIAL-1');
  worksheet2.window.onLearningLkpdScreenReady('LKPD-1', 'STUDENT-1');
  assert.ok(worksheet2.dock, 'Verified worksheet should mount reference');
  worksheet2.window.onLearningLkpdSessionEnded();
  assert.equal(worksheet2.dock, null, 'Reference must be removed when LKPD exits');
  console.log('PASS: split learning contract, CBT and LKPD readiness, teacher opt-in, focus guard, cleanup, URL allowlist');
})().catch(err => { console.error(err); process.exitCode = 1; });
