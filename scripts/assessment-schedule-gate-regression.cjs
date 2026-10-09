// Assessment entry must stay accessible; only a specific assigned exam
// schedule may require completion of visible, published learning materials.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { transformSync } = require('esbuild');
const root = path.resolve(__dirname, '..');
const server = fs.readFileSync(path.join(root, 'server.ts'), 'utf8');
const assessment = fs.readFileSync(path.join(root, 'src/assessmentModule.js'), 'utf8');
const start = server.indexOf('function getLearningCompletionGateForSchedule(');
const end = server.indexOf('// Phase 2 Endpoint: Server-Authoritative Exam Attempt Start', start);
assert.ok(start >= 0 && end > start, 'Find real schedule gate from server source');
const sourceCode = transformSync(server.slice(start, end), { loader: 'ts', target: 'es2022' }).code;
const store = { lessonPlans: [], progress: [], classId: 'CLASS-A' };
const sandbox = {
  lessonPlans: store.lessonPlans,
  isLearningMaterialRecord: m => m.recordType === 'learning_material',
  isItemForCurrentMadrasah: m => m.tenant === 'MADRASAH-1',
  findStudentForRequest: (_req, sid) => ({
    student: String(sid) === 'STUDENT-1' ? { id: sid, classId: store.classId } : null,
    ambiguous: false
  }),
  studentCanAccessLearningMaterial: (student, material) =>
    material.status === 'published' &&
    (material.classes.includes('ALL') || material.classes.includes(student.classId)),
  learningProgressForRequest: () => store.progress
};
const gate = vm.runInNewContext(sourceCode + '\ngetLearningCompletionGateForSchedule', sandbox);
const req = { user: { id: 'STUDENT-1', role: 'student' } };
const make = (id, scheduleId, overrides={}) => ({
  id, recordType: 'learning_material', tenant: 'MADRASAH-1',
  title: 'Pelajaran '+id, status: 'published', classes: ['CLASS-A'],
  scheduleId, requiresCompletionForLinks: true, ...overrides
});
store.lessonPlans.push(make('A', 'EXAM-A'));
assert.equal(gate(req, 'EXAM-B', 'STUDENT-1'), null,
  'Unlinked schedule never locked by another schedule material');
assert.equal(gate(req, 'EXAM-A', 'STUDENT-1')?.code,
  'LEARNING_MATERIAL_REQUIRED', 'Only EXAM-A is locked');
store.progress.push({ materialId:'A', studentId:'STUDENT-1', status:'completed' });
assert.equal(gate(req, 'EXAM-A', 'STUDENT-1'), null, 'Completion unlocks only its schedule');
store.progress.length=0;
store.lessonPlans.length=0;
store.lessonPlans.push(
  make('DRAFT', 'EXAM-A', {status:'draft'}),
  make('OTHER-CLASS', 'EXAM-A', {classes:['CLASS-B']}),
  make('OTHER-TENANT', 'EXAM-A', {tenant:'MADRASAH-2'}),
  make('OPTIONAL', 'EXAM-A', {requiresCompletionForLinks:false})
);
assert.equal(gate(req, 'EXAM-A', 'STUDENT-1'), null,
  'Draft, other-class, other-madrasah, and optional material cannot lock schedule');
store.lessonPlans.push(make('LEGACY', undefined, { examId:'EXAM-OLD' }));
assert.equal(gate(req, 'EXAM-OLD', 'STUDENT-1')?.code, 'LEARNING_MATERIAL_REQUIRED',
  'Legacy examId schedule link remains supported');
assert.equal(gate(req, 'EXAM-NOT-LINKED', 'STUDENT-1'), null);
assert.equal(gate(req, '', 'STUDENT-1'), null);
assert.equal(gate(req, 'EXAM-OLD', 'UNKNOWN-STUDENT'), null);

assert.ok(assessment.includes('void annotateStudentSchedulePrerequisites(container, st.id || currUser.id'),
  'Schedule-only lock notices are rendered inside assessment list');
assert.ok(assessment.includes('data-learning-exam-schedule='),
  'Individual CBT cards carry a schedule identifier');
assert.ok(!assessment.includes('startStudentExam(exId);\n            return;'),
  'Opening assessment menu no longer auto-starts arbitrary saved attempt');
assert.ok(assessment.includes('if (!hasActiveSession) {\n        const learningGate = await enforceLearningScheduleMaterialGate(ex, stId);'),
  'Client gates only fresh attempts, not existing sessions');
assert.ok(server.includes('if (!canResumeAttempt &&'),
  'Server allows valid existing attempts to resume');
console.log('PASS: assessment menu unrestricted; material prerequisite restricted to selected published, eligible CBT schedule.');
