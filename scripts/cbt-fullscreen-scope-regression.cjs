const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const assessment = fs.readFileSync('src/assessmentModule.js', 'utf8');
const assessmentPublic = fs.readFileSync('public/assessmentModule.js', 'utf8');
const navigation = fs.readFileSync('src/appScript.js', 'utf8');
const navigationPublic = fs.readFileSync('public/appScript.js', 'utf8');
const lkpd = fs.readFileSync('src/lkpdModule.js', 'utf8');
const lkpdPublic = fs.readFileSync('public/lkpdModule.js', 'utf8');

assert.equal(assessment, assessmentPublic, 'CBT source and offline public copy diverged');
assert.equal(navigation, navigationPublic, 'Navigation source and offline public copy diverged');
assert.equal(lkpd, lkpdPublic, 'LKPD source and offline public copy diverged');
assert(!/requestFullscreen\s*\(/.test(lkpd), 'LKPD must never request browser fullscreen');
assert(assessment.includes('id="cbt-active-exam-screen"'), 'CBT player must have an explicit DOM scope');
assert(assessment.includes('exitCbtFullscreen();\n        const sidebar'), 'Successful submission must exit browser fullscreen');
assert(assessment.includes('if (isBlocked) {\n        exitCbtFullscreen();'), 'Blocked screen must exit fullscreen');
assert(assessment.includes('window.__onCbtRouteNavigation'), 'CBT must expose route-scoped fullscreen cleanup');
assert(navigation.includes('window.__onCbtRouteNavigation(route)'), 'Main navigation must release CBT fullscreen on page change');

const from = assessment.indexOf('let cbtFullscreenOwned = false;');
const until = assessment.indexOf('function getRetryAfterMs', from);
assert(from > 0 && until > from, 'CBT fullscreen helper could not be located');
const helper = assessment.slice(from, until);

function fixture({role = 'student', playerVisible = true, delayed = false} = {}) {
  let canSeePlayer = playerVisible;
  let openCalls = 0;
  let closeCalls = 0;
  let fulfill = null;
  const listeners = {};
  const sidebar = {style:{display:'none'}};
  const header = {style:{display:'none'}};
  const document = {
    fullscreenElement: null,
    getElementById: (id) => id === 'sidebar' ? sidebar :
      (id === 'cbt-active-exam-screen' && canSeePlayer ? {} : null),
    querySelector: (selector) => selector === 'header' ? header : null,
    addEventListener: (type, listener) => { listeners[type] = listener; },
    exitFullscreen: () => { closeCalls++; document.fullscreenElement = null; return Promise.resolve(); }
  };
  document.documentElement = {
    requestFullscreen: () => {
      openCalls++;
      if (delayed) return new Promise(resolve => { fulfill = () => { document.fullscreenElement = document.documentElement; resolve(); }; });
      document.fullscreenElement = document.documentElement;
      return Promise.resolve();
    }
  };
  const context = vm.createContext({
    appState: { role },
    document,
    window: {},
    Promise
  });
  vm.runInContext('let activeExamSession = { exam: { id: "exam-1" } };\n' + helper, context);
  return {
    context, document, listeners, sidebar, header,
    get openCalls() { return openCalls; },
    get closeCalls() { return closeCalls; },
    setVisible: (x) => { canSeePlayer = x; },
    finishRequest: () => fulfill?.()
  };
}

async function flush() {
  await new Promise(resolve => setImmediate(resolve));
}

async function run() {
  const student = fixture();
  student.context.window.requestCbtFullscreen();
  await flush();
  assert.equal(student.openCalls, 1, 'Student CBT player should enter fullscreen');
  student.context.window.__onCbtRouteNavigation('asesmen_siswa');
  assert.equal(student.closeCalls, 0, 'Navigating within CBT should keep fullscreen');
  student.context.window.__onCbtRouteNavigation('profil_siswa');
  await flush();
  assert.equal(student.closeCalls, 1, 'Navigating away must exit fullscreen');
  assert.equal(student.sidebar.style.display, '', 'Leaving player must restore sidebar');
  assert.equal(student.header.style.display, '', 'Leaving player must restore header');

  const teacher = fixture({role:'teacher'});
  teacher.context.window.requestCbtFullscreen();
  await flush();
  assert.equal(teacher.openCalls, 0, 'Teacher/admin must not get student CBT fullscreen');

  const missingPlayer = fixture({playerVisible:false});
  missingPlayer.context.window.requestCbtFullscreen();
  await flush();
  assert.equal(missingPlayer.openCalls, 0, 'CBT list/dashboard must not request fullscreen');

  const pending = fixture({delayed:true});
  pending.context.window.requestCbtFullscreen();
  pending.setVisible(false);
  pending.context.window.__onCbtRouteNavigation('learning_student');
  pending.finishRequest();
  await flush();
  assert.equal(pending.closeCalls, 1, 'A late fullscreen permission must not trap the next page');

  console.log('CBT fullscreen scope regression passed.');
}
run().catch(err => { console.error(err); process.exitCode = 1; });
