var appState = window.appState || {};
// CBT & Academic Modules: Bank Soal, Gemini AI Generator, Assessment, Monitoring, Evaluasi, Nilai & Jurnal

function qbEscapeHtml(value) {
    const raw = String(value ?? '');
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(raw);
    return raw.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function qbEscapeAttr(value) {
    const raw = String(value ?? '');
    if (typeof window.escapeHtmlAttr === 'function') return window.escapeHtmlAttr(raw);
    return qbEscapeHtml(raw);
}
function qbInlineArg(value) {
    return qbEscapeAttr(JSON.stringify(String(value ?? '')));
}

function qbDecodeLegacyEntities(value) {
    let text = String(value ?? '');
    if (!text || !/&(?:amp|lt|gt|quot|apos|#0*39|#x0*27);/i.test(text)) return text;

    // Normalize legacy/pre-escaped question text back to literal characters.
    // HTML sinks must still call qbEscapeHtml/renderCbtTableCell afterwards.
    for (let pass = 0; pass < 2; pass++) {
        const next = text
            .replace(/&amp;/gi, '&')
            .replace(/&lt;/gi, '<')
            .replace(/&gt;/gi, '>')
            .replace(/&quot;/gi, '"')
            .replace(/&apos;|&#0*39;|&#x0*27;/gi, "'");
        if (next === text) break;
        text = next;
    }
    return text;
}

function qbSafeImageSrc(value) {
    let raw = String(value ?? '').trim();
    if (!raw) return '';
    try {
        if (typeof window.getPhotoHtmlSrc === 'function') {
            const resolved = window.getPhotoHtmlSrc(raw);
            if (resolved) raw = String(resolved).trim();
        }
    } catch (_) {}
    if (/^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(raw)) {
        return qbEscapeAttr(raw);
    }
    try {
        const parsed = new URL(raw, window.location?.origin || 'http://localhost');
        if (['http:', 'https:', 'blob:'].includes(parsed.protocol)) {
            return qbEscapeAttr(raw);
        }
    } catch (_) {}
    return '';
}

function qbCreatedTime(item) {
    if (!item || typeof item !== 'object') return 0;

    const dateCandidates = [
        item.createdAt,
        item.created_at,
        item.createdOn,
        item.timestamp
    ];
    for (const value of dateCandidates) {
        if (!value) continue;
        const time = new Date(value).getTime();
        if (Number.isFinite(time) && time > 0) return time;
    }

    // Banyak data lama memakai Date.now() di dalam ID (BG..., Q_..., dll).
    // Gunakan timestamp itu agar data lama juga bisa diurutkan terbaru -> terlama.
    const idMatch = String(item.id || '').match(/(\d{13})/);
    if (idMatch) {
        const time = Number(idMatch[1]);
        if (Number.isFinite(time) && time > 0) return time;
    }

    return 0;
}

function qbSortNewestFirst(items) {
    const original = Array.isArray(items) ? [...items] : [];
    return [...original].sort((a, b) => {
        const timeA = qbCreatedTime(a);
        const timeB = qbCreatedTime(b);
        if (timeA !== timeB) return timeB - timeA;

        // Data lama tanpa timestamp umumnya ditambahkan ke ujung array.
        // Balik fallback-nya supaya item yang paling baru tetap tampil di atas.
        return original.indexOf(b) - original.indexOf(a);
    });
}

async function loadQuestionBankFromServer(force = false) {
    // QUESTION_BANK_LOAD_GUARD: an empty bank is a valid loaded state, not a reason to refetch forever.
    if (appState._questionBankLoadPromise && !force) return appState._questionBankLoadPromise;
    if (appState._questionBankLoaded && !force) return true;

    const task = (async () => {
        let ok = false;
        try {
            const [grpRes, qRes] = await Promise.all([
                fetch('/api/question-bank-groups').then(r => r.ok ? r.json() : ({ success: false })).catch(() => ({ success: false })),
                fetch('/api/questions').then(r => r.ok ? r.json() : ({ success: false })).catch(() => ({ success: false }))
            ]);
            if (grpRes && grpRes.success && Array.isArray(grpRes.groups)) {
                appState.questionBankGroups = grpRes.groups;
                ok = true;
            }
            if (qRes && qRes.success && Array.isArray(qRes.questions)) {
                appState.questionBank = qRes.questions;
                ok = true;
            }
        } catch (e) {
            console.warn('loadQuestionBankFromServer error:', e);
        } finally {
            appState._questionBankLoaded = true;
            appState._questionBankLoadError = ok ? '' : 'Gagal memuat bank soal dari server.';
        }
        return ok;
    })();

    appState._questionBankLoadPromise = task;
    try {
        return await task;
    } finally {
        appState._questionBankLoadPromise = null;
    }
}
window.loadQuestionBankFromServer = loadQuestionBankFromServer;

function getTeacherAllowedSubjects() {
    if (appState.role !== 'teacher') {
        return appState.subjects || [];
    }
    const currentTeacher = appState.currentUser;
    if (!currentTeacher) return [];
    
    let teacherMapelList = Array.isArray(currentTeacher.mapel) 
        ? [...currentTeacher.mapel] 
        : (currentTeacher.mapel ? [currentTeacher.mapel] : []);
        
    if (appState.teachers && Array.isArray(appState.teachers)) {
        const found = appState.teachers.find(t => 
            String(t.id || '') === String(currentTeacher.id || '') || 
            String(t.username || '') === String(currentTeacher.username || '') || 
            (t.nip && String(t.nip) === String(currentTeacher.nip || ''))
        );
        if (found && Array.isArray(found.mapel)) {
            found.mapel.forEach(m => {
                if (!teacherMapelList.includes(m)) teacherMapelList.push(m);
            });
        }
    }

    if (teacherMapelList.length === 0) {
        return [];
    }
    
    // Normalisasi untuk pencocokan toleran (menghilangkan spasi berlebih, huruf besar/kecil, karakter simbol &)
    const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const matched = (appState.subjects || []).filter(s => {
        const sNormName = normalize(s.name);
        const sNormCode = normalize(s.code);
        const sId = String(s.id || '').trim();

        return teacherMapelList.some(m => {
            const mNorm = normalize(m);
            const mId = String(m || '').trim();
            return mId === sId ||
                   mNorm === sNormName || 
                   mNorm === sNormCode;
        });
    });

    return matched;
}

function renderQuestionBankModule(container) {
    if (!container) container = document.getElementById('view-container');
    if (!container) return;

    const questionBank = Array.isArray(appState.questionBank) ? appState.questionBank : [];
    const allQuestionBankGroups = Array.isArray(appState.questionBankGroups) ? appState.questionBankGroups : [];
    const subjects = Array.isArray(appState.subjects) ? appState.subjects : [];
    const classes = Array.isArray(appState.classes) ? appState.classes : [];

    // Jika data belum termuat di RAM, muat dari server secara otomatis
    if (!appState._questionBankLoaded && (allQuestionBankGroups.length === 0 || questionBank.length === 0) && !appState._loadingQuestionBank) {
        appState._loadingQuestionBank = true;
        container.innerHTML = `
            <div class="bg-white p-12 rounded-3xl text-center text-slate-500 font-semibold border border-slate-100 shadow-sm">
                <i class="fa-solid fa-spinner animate-spin text-2xl text-emerald-600 block mb-3"></i>
                <span class="text-sm">Memuat data bank soal dari server...</span>
            </div>
        `;
        loadQuestionBankFromServer().then(() => {
            appState._loadingQuestionBank = false;
            renderQuestionBankModule(container);
        }).catch(() => {
            appState._loadingQuestionBank = false;
            renderQuestionBankModule(container);
        });
        return;
    }

    const isTeacher = appState.role === 'teacher';
    let questionBankGroups = allQuestionBankGroups;
    let allowedSubjectNames = '';

    if (isTeacher) {
        const allowed = getTeacherAllowedSubjects();
        const allowedIds = allowed.map(s => String(s.id));
        const allowedNames = allowed.map(s => String(s.name).toLowerCase());
        const normalize = (str) => String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const allowedNormNames = allowed.map(s => normalize(s.name));

        allowedSubjectNames = allowed.map(s => qbEscapeHtml(s.name)).join(', ') || 'Belum diatur';

        // Filter ketat: Hanya bank soal yang sesuai dengan mapel yang diampu oleh guru ini
        questionBankGroups = allQuestionBankGroups.filter(bg => {
            const bgSubId = String(bg.subjectId || '').trim();
            if (allowedIds.includes(bgSubId)) return true;

            // Cari objek mapel dari bg.subjectId
            const sub = subjects.find(s => String(s.id) === bgSubId);
            if (sub && (allowedIds.includes(String(sub.id)) || allowedNames.includes(String(sub.name).toLowerCase()))) {
                return true;
            }

            // Cek jika subjectId / code di group menggunakan nama mapel langsung
            const normBgSub = normalize(bgSubId);
            const normBgCode = normalize(bg.code);
            return allowedNormNames.some(an => an === normBgSub || normBgSub.includes(an) || normBgCode.includes(an));
        });
    }

    // Samakan UX dengan Jadwal Ujian: item terbaru selalu tampil paling atas.
    questionBankGroups = qbSortNewestFirst(questionBankGroups);

    const activeCode = appState.activeBankGroupCode || '';

    if (!activeCode) {
        container.innerHTML = `
            <div class="space-y-6 pb-8">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                    <div>
                        <h1 class="text-xl sm:text-2xl font-bold text-slate-800">Bank Soal Madrasah</h1>
                        <p class="text-xs text-slate-400 mt-0.5">
                            ${isTeacher 
                                ? `Bank Soal Mapel Anda: <span class="font-semibold text-emerald-700">${allowedSubjectNames}</span> (${questionBankGroups.length} Bank Soal)` 
                                : `Kelola semua bank soal madrasah (${questionBankGroups.length} Bank Soal, ${questionBank.length} Butir Soal)`
                            }
                        </p>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button type="button" onclick="openConvertQuestionModal()" class="px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-2xl text-xs shadow flex items-center space-x-2 transition cursor-pointer">
                            <i class="fa-solid fa-arrows-rotate"></i><span>Convert Soal</span>
                        </button>
                        <button type="button" onclick="openQuestionBankGroupModal()" class="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl text-xs shadow flex items-center space-x-2 transition cursor-pointer">
                            <i class="fa-solid fa-plus"></i><span>Tambah Soal</span>
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    ${questionBankGroups.length === 0 ? `
                        <div class="bg-white p-12 rounded-3xl text-center text-slate-400 text-sm border col-span-2 space-y-3">
                            <i class="fa-solid fa-box-open text-4xl text-slate-300"></i>
                            <p class="font-semibold text-slate-600">
                                ${isTeacher 
                                    ? `Belum ada bank soal untuk mata pelajaran Anda (${allowedSubjectNames}).` 
                                    : 'Belum ada kode bank soal di sistem.'
                                }
                            </p>
                            <p class="text-xs text-slate-400">Klik tombol "Tambah Soal" di atas untuk membuat bank soal baru.</p>
                        </div>
                    ` : questionBankGroups.map(bg => {
                        const subObj = subjects.find(s => String(s.id) === String(bg.subjectId));
                        const clsObj = classes.find(c => String(c.id) === String(bg.classId));
                        const count = questionBank.filter(q => q && String(q.code).trim().toLowerCase() === String(bg.code).trim().toLowerCase()).length;

                        return `
                            <div class="bg-white p-6 rounded-3xl border shadow-sm space-y-4 flex flex-col justify-between hover:border-emerald-500 transition">
                                <div>
                                    <div class="flex justify-between items-start">
                                        <span class="px-3 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl font-mono">${qbEscapeHtml(bg.code)}</span>
                                        <button type="button" onclick="deleteQuestionBankGroup(${qbInlineArg(bg.id)})" class="text-rose-400 hover:text-rose-600 p-1 cursor-pointer"><i class="fa-solid fa-trash"></i></button>
                                    </div>
                                    <h3 class="font-bold text-slate-800 text-base mt-3">${qbEscapeHtml(subObj ? subObj.name : (bg.code || 'Mata Pelajaran'))} - ${qbEscapeHtml(clsObj ? clsObj.name : 'Kelas')}</h3>
                                    <p class="text-xs text-slate-500 mt-1"><i class="fa-solid fa-book-open mr-1.5 text-emerald-600"></i>Total Butir Soal: <b>${count} Soal</b></p>
                                </div>
                                <div class="grid grid-cols-2 gap-2 mt-2">
                                    <button type="button" onclick="selectQuestionBankGroup(${qbInlineArg(bg.code)})" class="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl text-xs shadow transition cursor-pointer">Kelola Soal</button>
                                    <button type="button" onclick="openPreviewQuestionBankModal(${qbInlineArg(bg.code)})" class="py-2.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-2xl text-xs shadow transition cursor-pointer"><i class="fa-solid fa-eye mr-1"></i>Pratinjau</button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        return;
    }

    const group = questionBankGroups.find(bg => String(bg.code) === String(activeCode));
    if (!group) {
        appState.activeBankGroupCode = null;
        renderQuestionBankModule(container);
        return;
    }
    const subObj = subjects.find(s => String(s.id) === String(group?.subjectId));
    const clsObj = classes.find(c => String(c.id) === String(group?.classId));
    const questions = qbSortNewestFirst(
        questionBank.filter(q => q && String(q.code).trim().toLowerCase() === String(activeCode).trim().toLowerCase())
    );

    container.innerHTML = `
        <div class="space-y-6 pb-8">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div class="flex items-center space-x-3">
                    <button type="button" onclick="appState.activeBankGroupCode = null; renderQuestionBankModule(document.getElementById('view-container'));" class="p-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl text-slate-700 transition">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div>
                        <span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold font-mono">${qbEscapeHtml(activeCode)}</span>
                        <h1 class="text-lg sm:text-xl font-bold text-slate-800 mt-1">${qbEscapeHtml(subObj ? subObj.name : '')} - ${qbEscapeHtml(clsObj ? clsObj.name : '')}</h1>
                    </div>
                </div>

                <div class="flex flex-wrap gap-2 w-full sm:w-auto">
                    <button type="button" onclick="openAddSingleQuestionModal(${qbInlineArg(activeCode)})" class="px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl text-xs shadow flex items-center space-x-2 transition">
                        <i class="fa-solid fa-plus"></i><span>Tambah Soal</span>
                    </button>
                    <button type="button" onclick="openAIGeneratorModal(${qbInlineArg(activeCode)})" class="px-3.5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-2xl text-xs shadow flex items-center space-x-2 transition">
                        <i class="fa-solid fa-wand-magic-sparkles"></i><span>Generate AI</span>
                    </button>
                    <button type="button" onclick="openQuestionImportModal(${qbInlineArg(activeCode)})" class="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl text-xs shadow flex items-center space-x-2 transition">
                        <i class="fa-solid fa-file-arrow-up"></i><span>Import Soal</span>
                    </button>
                    <button type="button" onclick="openPreviewQuestionBankModal(${qbInlineArg(activeCode)})" class="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-xs font-semibold shadow flex items-center space-x-2 transition cursor-pointer">
                        <i class="fa-solid fa-eye"></i><span>Pratinjau & Cetak</span>
                    </button>
                </div>
            </div>

            <div class="space-y-4">
                ${questions.length === 0 ? `
                    <div class="bg-white p-12 rounded-3xl text-center text-slate-400 text-sm border">Belum ada butir soal dalam kode ini. Klik "Tambah Soal", "Generate AI" atau "Import Soal" untuk mengisi bank soal.</div>
                ` : questions.map((q, idx) => `
                    <div class="bg-white p-5 rounded-3xl border shadow-sm space-y-3">
                        <div class="flex justify-between items-center">
                            <div class="flex items-center space-x-2">
                                <span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl">Soal No. ${idx + 1}</span>
                                <span class="px-2.5 py-1 ${q.type === 'essay' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'} text-xs font-semibold rounded-xl uppercase">${q.type === 'essay' ? 'Essay' : 'Pilihan Ganda'}</span>
                            </div>
                            <div class="flex items-center space-x-1.5">
                                <button type="button" onclick="openEditSingleQuestionModal(${qbInlineArg(q.id)})" class="p-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl transition cursor-pointer" title="Edit Soal">
                                    <i class="fa-solid fa-pen-to-square text-xs"></i>
                                </button>
                                <button type="button" onclick="deleteIndividualQuestion(${qbInlineArg(q.id)})" class="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition cursor-pointer" title="Hapus Soal">
                                    <i class="fa-solid fa-trash-can text-xs"></i>
                                </button>
                            </div>
                        </div>
                        <p class="font-semibold text-slate-800 text-sm sm:text-base leading-relaxed">${qbEscapeHtml(q.question || '')}</p>
                        ${((q.imageUrl || q.image) && (!q.question || !q.question.includes(q.imageUrl || q.image))) ? `
                            <div class="my-2">
                                <img src="${qbSafeImageSrc(q.imageUrl || q.image)}" class="max-h-56 rounded-2xl border border-slate-200 object-contain shadow-sm" alt="Gambar Soal"/>
                            </div>
                        ` : ''}
                        ${q.type === 'essay' ? `
                            <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-900 space-y-1">
                                <p class="font-bold">Kunci Esay:</p>
                                <p>${qbEscapeHtml(q.answer || '')}</p>
                            </div>
                        ` : `
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                                ${(q.options || []).map((opt, oIdx) => {
                                    const letter = String.fromCharCode(65 + oIdx);
                                    const rawAns = String(q.answer || q.answerKey || '').trim();
                                    const isMatch = opt === q.answer || rawAns.toUpperCase() === letter || rawAns.toUpperCase() === opt.toUpperCase() || (q.correctOptionText && q.correctOptionText === opt);
                                    return `
                                        <div class="p-2.5 rounded-xl border ${isMatch ? 'bg-emerald-50 border-emerald-300 font-bold text-emerald-800' : 'bg-slate-50 border-slate-100 text-slate-700'}">
                                            <span class="font-bold mr-1">${letter}.</span> ${qbEscapeHtml(opt)}
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `}
                        ${q.explanation ? `
                            <div class="p-2.5 bg-slate-50 border rounded-2xl text-xs text-slate-600">
                                <span class="font-bold text-slate-700">Pembahasan:</span> ${qbEscapeHtml(q.explanation)}
                            </div>
                        ` : ''}
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    if (typeof window.renderMathInElementSafely === 'function') {
        window.renderMathInElementSafely(container);
    }
}

function selectQuestionBankGroup(code) {
    appState.activeBankGroupCode = code;
    renderQuestionBankModule(document.getElementById('view-container'));
}

function openQuestionBankGroupModal() {
    const allowedSubjects = getTeacherAllowedSubjects();
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4">
                <div class="flex justify-between items-center"><h3 class="font-bold text-slate-800">Tambah Bank Soal Baru</h3><button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg"></i></button></div>
                <form onsubmit="saveQuestionBankGroup(event)" class="space-y-3 text-xs sm:text-sm">
                    <div>
                        <label class="block text-xs uppercase text-slate-500 mb-1">Kode Soal</label>
                        <input type="text" id="gb-code" value="KODE-SOAL-${appState.questionBankGroups.length + 1}" required class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl font-mono">
                    </div>
                    <div>
                        <label class="block text-xs uppercase text-slate-500 mb-1">Mata Pelajaran</label>
                        <select id="gb-mapel" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl" required>
                            ${allowedSubjects.map(s => `<option value="${qbEscapeAttr(s.id)}">${qbEscapeHtml(s.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs uppercase text-slate-500 mb-1">Kelas</label>
                        <select id="gb-kelas" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl" required>
                            ${(appState.classes || []).map(c => `<option value="${qbEscapeAttr(c.id)}">${qbEscapeHtml(c.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex justify-end space-x-2 pt-2">
                        <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 rounded-xl">Batal</button>
                        <button type="submit" class="px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold">Simpan</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

async function saveQuestionBankGroup(e) {
    e.preventDefault();
    const code = document.getElementById('gb-code').value.trim();
    const subjectId = document.getElementById('gb-mapel').value;
    const classId = document.getElementById('gb-kelas').value;

    if (!code) { showToast('Kode wajib diisi.', 'error'); return; }

    const newGroup = { id: 'BG' + Date.now(), code, subjectId, classId, createdAt: new Date().toISOString() };
    appState.questionBankGroups.push(newGroup);

    try {
        await fetch('/api/question-bank-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newGroup)
        });
    } catch (err) {}

    saveState('questionBankGroups');
    closeModal();
    showToast('Bank soal berhasil disimpan!', 'success');
    renderQuestionBankModule(document.getElementById('view-container'));
}

async function deleteQuestionBankGroup(id) {
    showConfirmModal('Apakah Anda yakin ingin menghapus bank soal ini? Semua soal di dalamnya akan terpengaruh.', async () => {
        const groupToDelete = appState.questionBankGroups.find(bg => String(bg.id) === String(id));
        appState.questionBankGroups = appState.questionBankGroups.filter(bg => String(bg.id) !== String(id));
        saveState('questionBankGroups');

        if (groupToDelete) {
            appState.questionBank = (appState.questionBank || []).filter(q => String(q.code) !== String(groupToDelete.code));
            saveState('questionBank');
        }

        try {
            await fetch(`/api/question-bank-groups/${id}`, {
                method: 'DELETE'
            });
        } catch (err) {}

        showToast('Bank soal berhasil dihapus!', 'success');
        renderQuestionBankModule(document.getElementById('view-container'));
    });
}

async function deleteIndividualQuestion(id) {
    showConfirmModal('Apakah Anda yakin ingin menghapus butir soal ini?', async () => {
        appState.questionBank = (appState.questionBank || []).filter(q => String(q.id) !== String(id));
        saveState('questionBank');

        try {
            await fetch(`/api/questions/${id}`, {
                method: 'DELETE'
            });
        } catch (err) {}

        showToast('Butir soal berhasil dihapus!', 'success');
        renderQuestionBankModule(document.getElementById('view-container'));
    });
}

function openAIGeneratorModal(code) {
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div id="modal-content-box" class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4">
                <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-2">
                        <div class="w-8 h-8 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                            <i class="fa-solid fa-layer-group"></i>
                        </div>
                        <h3 class="font-bold text-slate-800 text-sm sm:text-base">
                            <span>Penyusunan Butir Soal Hybrid</span>
                        </h3>
                    </div>
                    <button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg text-slate-400 hover:text-slate-600"></i></button>
                </div>
                <form id="hybrid-gen-soal-form" class="space-y-3 text-xs sm:text-sm">
                    <div>
                        <label class="block text-xs uppercase text-slate-500 mb-1">Topik Materi</label>
                        <input type="text" id="ai-gen-topic" required class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl" placeholder="Contoh: Hukum Tajwid & Mad Thabi'i">
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs uppercase text-slate-500 mb-1">Jumlah PG</label>
                            <input type="number" id="ai-gen-mc-count" value="5" min="0" max="30" required class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl">
                        </div>
                        <div>
                            <label class="block text-xs uppercase text-slate-500 mb-1">Jumlah Esay</label>
                            <input type="number" id="ai-gen-essay-count" value="0" min="0" max="15" required class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl">
                        </div>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs uppercase text-slate-500 mb-1">Opsi PG</label>
                            <select id="ai-gen-option-count" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl">
                                <option value="4">Sampai D (4 Opsi)</option>
                                <option value="5" selected>Sampai E (5 Opsi)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs uppercase text-slate-500 mb-1">Tingkat Kesulitan</label>
                            <select id="ai-gen-level" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl">
                                <option value="Mudah">Mudah</option>
                                <option value="Sedang" selected>Sedang</option>
                                <option value="Sulit">Sulit</option>
                            </select>
                        </div>
                    </div>
                    <div class="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                        <button type="button" onclick="closeModal()" class="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition">Batal</button>
                        <button type="button" onclick="executeNonAIGenerator(event, '${code}')" class="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow flex items-center space-x-1.5 cursor-pointer transition">
                            <i class="fa-solid fa-calculator"></i><span>Generate Non-AI</span>
                        </button>
                        <button type="button" onclick="executeAIGenerator(event, '${code}')" class="px-3.5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-bold shadow flex items-center space-x-1.5 cursor-pointer transition">
                            <i class="fa-solid fa-wand-magic-sparkles"></i><span>Generate AI</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function executeNonAIGenerator(e, code) {
    if (e) e.preventDefault();
    const topicInput = document.getElementById('ai-gen-topic');
    const topic = topicInput ? topicInput.value.trim() : '';
    if (!topic) {
        showToast('Mohon isi Topik Materi terlebih dahulu!', 'error');
        if (topicInput) topicInput.focus();
        return;
    }
    const mcCount = parseInt(document.getElementById('ai-gen-mc-count').value) || 5;
    const essayCount = parseInt(document.getElementById('ai-gen-essay-count').value) || 0;
    const optionCount = parseInt(document.getElementById('ai-gen-option-count').value) || 5;
    const level = document.getElementById('ai-gen-level').value;

    const group = appState.questionBankGroups.find(bg => String(bg.code) === String(code));
    const generatedItems = [];

    // Construct Standard Non-AI MC Questions
    for (let i = 1; i <= mcCount; i++) {
        let qText = '';
        let opts = [];
        let ans = 'A';
        let expl = '';

        if (i === 1) {
            qText = `Berdasarkan kajian materi tentang "${topic}", manakah pernyataan berikut yang paling tepat mendefinisikan prinsip dasarnya?`;
            opts = optionCount === 5 
                ? [`Prinsip fundamental dan konseptual yang melandasi ${topic}`, `Sekadar pemahaman teoretis tanpa implikasi praktis`, `Penerapan parsial yang tidak terikat norma keilmuan`, `Metode alternatif yang bersifat spekulatif`, `Pandangan umum yang belum terverifikasi`]
                : [`Prinsip fundamental dan konseptual yang melandasi ${topic}`, `Sekadar pemahaman teoretis tanpa implikasi praktis`, `Penerapan parsial yang tidak terikat norma keilmuan`, `Metode alternatif yang bersifat spekulatif`];
            ans = opts[0];
            expl = `Prinsip fundamental pada topik ${topic} menekankan pemahaman konsep yang mendalam dan aplikatif.`;
        } else if (i === 2) {
            qText = `Perhatikan karakteristik dari "${topic}". Di bawah ini yang merupakan ciri utama dan implikasinya secara kontekstual adalah...`;
            opts = optionCount === 5 
                ? [`Mengedepankan keteraturan, ketelitian, dan nilai manfaat nyata`, `Hanya berlaku dalam kondisi khusus tanpa kaidah tetap`, `Mengabaikan proses dan hanya berorientasi pada hasil akhir`, `Tidak memiliki keterkaitan dengan ranah sikap dan keterampilan`, `Berdiri sendiri tanpa berhubungan dengan disiplin ilmu lainnya`]
                : [`Mengedepankan keteraturan, ketelitian, dan nilai manfaat nyata`, `Hanya berlaku dalam kondisi khusus tanpa kaidah tetap`, `Mengabaikan proses dan hanya berorientasi pada hasil akhir`, `Tidak memiliki keterkaitan dengan ranah sikap dan keterampilan`];
            ans = opts[0];
            expl = `Karakteristik materi ${topic} menonjolkan keteraturan berpikir serta implementasi nilai-nilai kebaikan.`;
        } else if (i === 3) {
            qText = `Dalam konteks pemecahan masalah sehari-hari yang berkaitan dengan "${topic}", langkah pertama yang paling bijaksana untuk dilakukan adalah...`;
            opts = optionCount === 5 
                ? [`Mengidentifikasi permasalahan secara kritis dan merujuk pada landasan yang valid`, `Mengambil keputusan secara tergesa-gesa tanpa analisis`, `Menyerahkan penyelesaian masalah tanpa upaya penelaahan`, `Menolak masukan objektif dari pihak lain`, `Membiarkan persoalan berkembang tanpa solusi terencana`]
                : [`Mengidentifikasi permasalahan secara kritis dan merujuk pada landasan yang valid`, `Mengambil keputusan secara tergesa-gesa tanpa analisis`, `Menyerahkan penyelesaian masalah tanpa upaya penelaahan`, `Menolak masukan objektif dari pihak lain`];
            ans = opts[0];
            expl = `Identifikasi kritis dan rujukan yang sahih merupakan pilar utama pemecahan masalah pada materi ${topic}.`;
        } else {
            qText = `Analisis kasus: Penerapan kaidah ${topic} pada situasi ${i}. Apa hikmah atau manfaat utama yang diperoleh peserta didik?`;
            opts = optionCount === 5 
                ? [`Menumbuhkan sikap istiqomah, nalar kritis, dan tanggung jawab moral`, `Memperoleh kemudahan instan tanpa proses pembelajaran`, `Membatasi kreativitas dalam bereksplorasi`, `Menghindari tugas-tugas kolaboratif di kelas`, `Menghafal rumus/teori tanpa memahami maknanya`]
                : [`Menumbuhkan sikap istiqomah, nalar kritis, dan tanggung jawab moral`, `Memperoleh kemudahan instan tanpa proses pembelajaran`, `Membatasi kreativitas dalam bereksplorasi`, `Menghindari tugas-tugas kolaboratif di kelas`];
            ans = opts[0];
            expl = `Pembelajaran ${topic} bertujuan menginternalisasi nilai-nilai karakter luhur dan daya nalar kritis.`;
        }

        generatedItems.push({
            type: 'mc',
            question: qText,
            options: opts,
            answer: ans,
            explanation: expl
        });
    }

    // Construct Standard Non-AI Essay Questions
    for (let j = 1; j <= essayCount; j++) {
        let essayQ = '';
        let essayExpl = '';
        if (j === 1) {
            essayQ = `Jelaskan secara komprehensif pengertian, landasan dalil/teori, dan ruang lingkup dari "${topic}"!`;
            essayExpl = `Rubrik penilaian mencakup: kejelasan definisi, ketepatan rujukan dalil/teori, serta kedalaman pemaparan ruang lingkup.`;
        } else if (j === 2) {
            essayQ = `Berikan analisis mendalam mengenai pentingnya penerapan "${topic}" dalam kehidupan bermasyarakat di era modern saat ini!`;
            essayExpl = `Rubrik penilaian mencakup: kemampuan analisis kritis, kepekaan sosial kontekstual, dan orisinalitas gagasan.`;
        } else {
            essayQ = `Uraikan langkah-langkah konkret dan solusi pemecahan masalah apabila terjadi kendala dalam pelaksanaan ${topic}!`;
            essayExpl = `Rubrik penilaian mencakup: sistematika solusi, rasionalitas tindakan, dan pendekatan solutif.`;
        }
        generatedItems.push({
            type: 'essay',
            question: essayQ,
            options: [],
            answer: essayExpl,
            explanation: essayExpl
        });
    }

    if (!appState.questionBank) appState.questionBank = [];

    generatedItems.forEach((item, idx) => {
        const qId = 'Q_' + Date.now() + '_' + idx;
        appState.questionBank.push({
            id: qId,
            code: code,
            subjectId: group ? group.subjectId : (appState.subjects[0]?.id || ''),
            classId: group ? group.classId : (appState.classes[0]?.id || ''),
            type: item.type || 'mc',
            question: item.question,
            options: item.options || [],
            answer: item.answer || '',
            explanation: item.explanation || ''
        });
    });

    saveState('questionBank');
    closeModal();
    showToast(`Berhasil menyusun ${generatedItems.length} butir soal Non-AI (Template Standar)!`, 'success');
    renderQuestionBankModule(document.getElementById('view-container'));
}

async function executeAIGenerator(e, code) {
    if (e) e.preventDefault();
    const topicInput = document.getElementById('ai-gen-topic');
    const topic = topicInput ? topicInput.value.trim() : '';
    if (!topic) {
        showToast('Mohon isi Topik Materi terlebih dahulu!', 'error');
        if (topicInput) topicInput.focus();
        return;
    }
    const mcCount = parseInt(document.getElementById('ai-gen-mc-count').value) || 5;
    const essayCount = parseInt(document.getElementById('ai-gen-essay-count').value) || 0;
    const optionCount = parseInt(document.getElementById('ai-gen-option-count').value) || 5;
    const level = document.getElementById('ai-gen-level').value;

    const group = appState.questionBankGroups.find(bg => String(bg.code) === String(code));

    const submitBtn = e ? (e.target.tagName === 'BUTTON' ? e.target : e.target.querySelector('button[type="submit"]')) : null;
    const origHtml = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Generating AI...`;
    }

    try {
        const response = await fetch('/api/gemini/generate-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic, mcCount, essayCount, optionCount, level })
        });
        const data = await response.json();

        let generatedItems = data.data || [];
        if (!Array.isArray(generatedItems) || generatedItems.length === 0) {
            // Fallback default mock generated questions if offline
            generatedItems = Array.from({ length: mcCount }).map((_, i) => ({
                type: 'mc',
                question: `Soal ${i + 1} tentang ${topic}: Apa prinsip utama materi ini?`,
                options: optionCount === 5 ? ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D', 'Opsi E'] : ['Opsi A', 'Opsi B', 'Opsi C', 'Opsi D'],
                answer: 'Opsi A',
                explanation: 'Penjelasan materi madrasah.'
            }));
        }

        generatedItems.forEach((item, idx) => {
            const qId = 'Q_' + Date.now() + '_' + idx;
            appState.questionBank.push({
                id: qId,
                code: code,
                subjectId: group ? group.subjectId : (appState.subjects[0]?.id || ''),
                classId: group ? group.classId : (appState.classes[0]?.id || ''),
                type: item.type || 'mc',
                question: item.question,
                options: item.options || (optionCount === 5 ? ['A', 'B', 'C', 'D', 'E'] : ['A', 'B', 'C', 'D']),
                answer: item.answer || item.options?.[0] || 'A',
                explanation: item.explanation || ''
            });
        });

        saveState('questionBank');
        closeModal();
        showToast(`Berhasil generate ${generatedItems.length} soal AI Gemini!`, 'success');
        renderQuestionBankModule(document.getElementById('view-container'));
    } catch (err) {
        console.error('Error generating:', err);
        showToast('Terjadi kesalahan saat generate AI.', 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = origHtml;
        }
    }
}

function downloadWordTemplate(code) {
    openPreviewQuestionBankModal(code || appState.activeBankGroupCode);
}

function openPreviewQuestionBankModal(code) {
    const activeCode = code || appState.activeBankGroupCode || '';
    const group = (appState.questionBankGroups || []).find(bg => String(bg.code) === String(activeCode));
    const subObj = (appState.subjects || []).find(s => String(s.id) === String(group?.subjectId));
    const clsObj = (appState.classes || []).find(c => String(c.id) === String(group?.classId));
    const questions = (appState.questionBank || []).filter(q => q && String(q.code) === String(activeCode));

    const madrasahName = (appState.madrasahInfo && appState.madrasahInfo.name) ? appState.madrasahInfo.name : 'MADRASAH ALIYAH / TSANAWIYAH / IBTIDAIYAH';
    const madrasahAddress = (appState.madrasahInfo && appState.madrasahInfo.address) ? appState.madrasahInfo.address : 'Jl. Pendidikan No. 1 - Kemenag RI';

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4 animate-fade-in">
            <div id="modal-content-box" class="bg-white w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col h-[92vh] overflow-hidden">
                <!-- Top Header -->
                <div class="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
                    <div class="flex items-center space-x-3">
                        <div class="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-2xl">
                            <i class="fa-solid fa-file-invoice text-lg"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-sm sm:text-base text-white">Pratinjau & Cetak Naskah Soal Ujian</h3>
                            <p class="text-xs text-slate-400">Kode: <span class="font-mono text-emerald-400 font-bold">${qbEscapeHtml(activeCode || 'BANK')}</span> | ${qbEscapeHtml(subObj ? subObj.name : 'Mapel')} - ${qbEscapeHtml(clsObj ? clsObj.name : 'Kelas')} (${questions.length} Soal)</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="text-slate-400 hover:text-white p-2 rounded-xl transition cursor-pointer">
                        <i class="fa-solid fa-xmark text-xl"></i>
                    </button>
                </div>

                <!-- Controls Bar -->
                <div class="px-6 py-3 bg-slate-50 border-b flex flex-wrap items-center justify-between gap-3 text-xs text-slate-700 shrink-0">
                    <div class="flex items-center space-x-4">
                        <label class="flex items-center space-x-2 cursor-pointer font-semibold">
                            <input type="checkbox" id="preview-toggle-keys" onchange="togglePreviewAnswers(this.checked)" class="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4">
                            <span>Tampilkan Kunci Jawaban</span>
                        </label>
                        <label class="flex items-center space-x-2 cursor-pointer font-semibold">
                            <input type="checkbox" id="preview-toggle-exp" onchange="togglePreviewExplanations(this.checked)" class="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4">
                            <span>Tampilkan Pembahasan</span>
                        </label>
                    </div>

                    <div class="flex items-center space-x-2">
                        <button type="button" onclick="printQuestionPaper('question-paper-document')" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow transition cursor-pointer">
                            <i class="fa-solid fa-print"></i><span>Cetak / PDF</span>
                        </button>
                        <button type="button" onclick="downloadWordFromPreview(${qbInlineArg(activeCode)})" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow transition cursor-pointer">
                            <i class="fa-solid fa-file-word"></i><span>Unduh Word (.doc)</span>
                        </button>
                        <button type="button" onclick="openExportCbtTableFilterModal(${qbInlineArg(activeCode)})" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center space-x-1.5 shadow transition cursor-pointer">
                            <i class="fa-solid fa-table"></i><span>Cetak Tabel CBT Word</span>
                        </button>
                        <button type="button" onclick="closeModal()" class="px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-semibold transition cursor-pointer">
                            Batal
                        </button>
                    </div>
                </div>

                <!-- Paper Body Container -->
                <div class="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-200/60">
                    <div id="question-paper-document" class="max-w-4xl mx-auto bg-white p-8 sm:p-12 shadow-md rounded-2xl border text-slate-900 space-y-6 font-serif">
                        <!-- KOP MADRASAH -->
                        <div class="text-center border-b-4 border-double border-slate-900 pb-4 space-y-1">
                            <h2 class="text-base sm:text-lg font-bold uppercase tracking-wider font-sans">${qbEscapeHtml(madrasahName)}</h2>
                            <h1 class="text-lg sm:text-xl font-black uppercase tracking-widest text-slate-900 font-sans">PENILAIAN AKHIR SEMESTER / ASESMEN MADRASAH</h1>
                            <p class="text-xs text-slate-600 font-sans italic">${qbEscapeHtml(madrasahAddress)}</p>
                        </div>

                        <!-- METADATA TABEL -->
                        <div class="grid grid-cols-2 gap-2 text-xs font-sans border p-3 rounded-xl bg-slate-50/50">
                            <div><b>Mata Pelajaran:</b> ${qbEscapeHtml(subObj ? subObj.name : '-')}</div>
                            <div><b>Kelas / Semester:</b> ${qbEscapeHtml(clsObj ? clsObj.name : '-')} / Ganjil</div>
                            <div><b>Kode Soal:</b> ${qbEscapeHtml(activeCode || '-')}</div>
                            <div><b>Waktu / Bentuk:</b> 90 Menit / PG & Essay</div>
                        </div>

                        <!-- PETUNJUK UMUM -->
                        <div class="text-[11px] font-sans bg-amber-50/60 p-3 rounded-xl border border-amber-200/60 space-y-0.5">
                            <p class="font-bold text-amber-900">Petunjuk Pengerjaan Soal:</p>
                            <ol class="list-decimal list-inside space-y-0.5 text-amber-800">
                                <li>Isikan identitas Anda pada Lembar Jawaban yang telah disediakan.</li>
                                <li>Periksa dan bacalah setiap butir soal dengan cermat sebelum menjawab.</li>
                                <li>Untuk soal Pilihan Ganda, pilihlah salah satu jawaban yang paling tepat.</li>
                            </ol>
                        </div>

                        <hr class="border-slate-300 my-4"/>

                        <!-- DAFTAR SOAL -->
                        <div class="space-y-6 text-sm font-sans">
                            ${questions.length === 0 ? `
                                <div class="p-8 text-center text-slate-400 italic">Belum ada soal pada bank soal ini.</div>
                            ` : questions.map((q, idx) => `
                                <div class="space-y-2 border-b border-slate-100 pb-4">
                                    <div class="flex items-start space-x-2">
                                        <span class="font-bold min-w-[24px] text-slate-900">${idx + 1}.</span>
                                        <div class="flex-1 space-y-2">
                                            <p class="font-medium text-slate-900 leading-relaxed">${qbEscapeHtml(q.question || '')}</p>
                                            
                                            ${(q.imageUrl || q.image) ? `
                                                <div class="my-2">
                                                    <img src="${qbSafeImageSrc(q.imageUrl || q.image)}" class="max-h-56 rounded-lg border object-contain" alt="Gambar Soal"/>
                                                </div>
                                            ` : ''}

                                            ${q.type === 'essay' ? `
                                                <div class="text-xs text-slate-500 italic py-1">[ Soal Uraian / Essay ]</div>
                                                <div class="preview-key-box hidden p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1 mt-2">
                                                    <span class="font-bold block uppercase text-[10px] text-amber-700">Kunci Jawaban Essay:</span>
                                                    <p>${qbEscapeHtml(q.answer || '-')}</p>
                                                </div>
                                            ` : `
                                                <div class="flex flex-col space-y-1.5 text-xs text-slate-800 pt-1">
                                                    ${(() => {
                                                        let optsList = [];
                                                        if (Array.isArray(q.options)) {
                                                            optsList = q.options;
                                                        } else if (q.options && typeof q.options === 'object') {
                                                            ['A', 'B', 'C', 'D', 'E'].forEach(letter => {
                                                                if (q.options[letter] !== undefined && q.options[letter] !== null && q.options[letter] !== '') {
                                                                    optsList.push(q.options[letter]);
                                                                }
                                                            });
                                                        }
                                                        return optsList.map((opt, oIdx) => {
                                                            const charLabel = String.fromCharCode(65 + oIdx);
                                                            return `
                                                                <div class="flex items-start space-x-2">
                                                                    <span class="font-bold min-w-[20px] text-slate-900">${charLabel}.</span>
                                                                    <div class="flex-1 leading-relaxed">${qbEscapeHtml(opt)}</div>
                                                                </div>
                                                            `;
                                                        }).join('');
                                                    })()}
                                                </div>
                                                <div class="preview-key-box hidden text-xs font-bold text-emerald-800 mt-2 p-2.5 bg-emerald-50 border border-emerald-200/80 rounded-xl">
                                                    Kunci Jawaban: <span class="font-black text-emerald-950">${qbEscapeHtml(q.answer || 'A')}</span>
                                                </div>
                                            `}

                                            ${q.explanation ? `
                                                <div class="preview-exp-box hidden p-2.5 bg-slate-100 border rounded-xl text-xs text-slate-600 mt-2">
                                                    <span class="font-bold text-slate-800">Pembahasan:</span> ${qbEscapeHtml(q.explanation)}
                                                </div>
                                            ` : ''}
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Render KaTeX Math equations on the paper document immediately!
    setTimeout(() => {
        const paper = document.getElementById('question-paper-document');
        if (paper && typeof window.renderMathInElementSafely === 'function') {
            window.renderMathInElementSafely(paper);
        }
    }, 50);
}

function togglePreviewAnswers(show) {
    const keys = document.querySelectorAll('.preview-key-box');
    keys.forEach(k => {
        if (show) k.classList.remove('hidden');
        else k.classList.add('hidden');
    });
}

function togglePreviewExplanations(show) {
    const exps = document.querySelectorAll('.preview-exp-box');
    exps.forEach(e => {
        if (show) e.classList.remove('hidden');
        else e.classList.add('hidden');
    });
}

function printQuestionPaper(paperId) {
    const paper = document.getElementById(paperId);
    if (!paper) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast('Gagal membuka jendela cetak. Izinkan pop-up di browser.', 'error');
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Cetak Naskah Soal Ujian</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
            <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/contrib/auto-render.min.js"></script>
            <style>
                @media print {
                    body { padding: 0; background: white; }
                    .no-print { display: none !important; }
                    @page { size: A4; margin: 15mm; }
                }
                body { font-family: 'Times New Roman', Times, serif; }
            </style>
        </head>
        <body class="p-8 bg-white">
            ${paper.outerHTML}
            <script>
                document.addEventListener('DOMContentLoaded', function() {
                    if (window.renderMathInElement) {
                        window.renderMathInElement(document.body, {
                            delimiters: [
                                {left: '$$', right: '$$', display: true},
                                {left: '$', right: '$', display: false}
                            ]
                        });
                    }
                    setTimeout(function() {
                        window.print();
                    }, 500);
                });
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function downloadWordFromPreview(code) {
    const paper = document.getElementById('question-paper-document');
    if (!paper) return;

    let htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>Cetak Soal Word</title>
            <style>
                body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.3; }
                h1, h2, h3 { font-family: 'Arial', sans-serif; text-align: center; }
                table { width: 100%; border-collapse: collapse; }
                td, th { padding: 4px; }
            </style>
        </head>
        <body>
            ${paper.innerHTML}
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Naskah_Soal_${code || 'Madrasah'}.doc`;
    a.click();
    showToast('Naskah Soal berhasil diunduh ke Word (.doc)!', 'success');
}

// Export CBT Word Table with Number Range Filter
function openExportCbtTableFilterModal(code) {
    const activeCode = code || appState.activeBankGroupCode || '';
    const questions = appState.questionBank.filter(q => q && String(q.code) === String(activeCode));

    if (!questions || questions.length === 0) {
        showToast('Tidak ada soal pada kode soal ini untuk dicetak.', 'error');
        return;
    }

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                <!-- Header -->
                <div class="p-5 bg-gradient-to-r from-indigo-600 to-blue-700 text-white flex justify-between items-center shrink-0">
                    <div class="flex items-center space-x-3">
                        <div class="p-2.5 bg-white/10 rounded-2xl">
                            <i class="fa-solid fa-table text-lg"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-base leading-tight">Cetak Tabel CBT Word</h3>
                            <p class="text-xs text-indigo-100 font-medium">Kode Soal: <span class="font-mono font-bold underline">${activeCode}</span> (${questions.length} Soal Tersedia)</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Form Body -->
                <form onsubmit="executeExportCbtTableWord(event, '${activeCode}')" class="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5">Pilih Nomor Soal yang Dicetak</label>
                        <div class="space-y-2.5">
                            <label class="flex items-center space-x-3 p-3 border border-slate-200 rounded-2xl hover:bg-slate-50 cursor-pointer transition">
                                <input type="radio" name="cbt-num-filter-mode" value="all" checked onchange="toggleCbtNumFilterInput('all')" class="text-indigo-600 focus:ring-indigo-500 h-4 w-4">
                                <div>
                                    <span class="font-bold text-slate-800 text-xs block">Semua Nomor Soal</span>
                                    <span class="text-[11px] text-slate-400">Mencetak seluruh ${questions.length} butir soal (Nomor 1 s/d ${questions.length})</span>
                                </div>
                            </label>

                            <label class="flex items-center space-x-3 p-3 border border-slate-200 rounded-2xl hover:bg-slate-50 cursor-pointer transition">
                                <input type="radio" name="cbt-num-filter-mode" value="include" onchange="toggleCbtNumFilterInput('include')" class="text-indigo-600 focus:ring-indigo-500 h-4 w-4">
                                <div>
                                    <span class="font-bold text-slate-800 text-xs block">Pilih Nomor Tertentu Saja</span>
                                    <span class="text-[11px] text-slate-400">Hanya mencetak nomor soal tertentu yang ditentukan</span>
                                </div>
                            </label>

                            <label class="flex items-center space-x-3 p-3 border border-slate-200 rounded-2xl hover:bg-slate-50 cursor-pointer transition">
                                <input type="radio" name="cbt-num-filter-mode" value="exclude" onchange="toggleCbtNumFilterInput('exclude')" class="text-indigo-600 focus:ring-indigo-500 h-4 w-4">
                                <div>
                                    <span class="font-bold text-slate-800 text-xs block">Semua Kecuali Nomor Tertentu</span>
                                    <span class="text-[11px] text-slate-400">Mencetak semua nomor kecuali nomor yang dikecualikan</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <!-- Input Box for include/exclude -->
                    <div id="cbt-num-input-container" class="hidden space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <label id="cbt-num-input-label" class="block text-xs font-bold text-slate-700">Daftar Nomor Soal:</label>
                        <input type="text" id="cbt-num-filter-input" class="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold focus:ring-2 focus:ring-indigo-500" placeholder="misal: 1, 2, 5-10, 15" />
                        <p class="text-[11px] text-slate-500 italic">
                            * Gunakan koma untuk nomor terpisah dan tanda hubung untuk rentang nomor.<br>
                            Contoh: <code class="bg-white px-1 py-0.5 rounded border border-slate-200">1, 3, 5-10</code> (pilih nomor 1, 3, serta 5 sampai 10).
                        </p>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex justify-end items-center space-x-2 pt-3 border-t border-slate-100">
                        <button type="button" onclick="closeModal()" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition cursor-pointer text-xs">
                            Batal
                        </button>
                        <button type="submit" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold shadow-md transition flex items-center space-x-2 cursor-pointer text-xs">
                            <i class="fa-solid fa-file-word"></i>
                            <span>Unduh Tabel CBT Word</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function toggleCbtNumFilterInput(mode) {
    const container = document.getElementById('cbt-num-input-container');
    const label = document.getElementById('cbt-num-input-label');
    const input = document.getElementById('cbt-num-filter-input');

    if (!container) return;

    if (mode === 'all') {
        container.classList.add('hidden');
        if (input) input.required = false;
    } else if (mode === 'include') {
        container.classList.remove('hidden');
        if (label) label.textContent = 'Masukkan Nomor Soal yang Ingin Dicetak:';
        if (input) {
            input.required = true;
            input.placeholder = 'misal: 1, 2, 5-10, 15';
            input.focus();
        }
    } else if (mode === 'exclude') {
        container.classList.remove('hidden');
        if (label) label.textContent = 'Masukkan Nomor Soal yang DIKECUALIKAN:';
        if (input) {
            input.required = true;
            input.placeholder = 'misal: 3, 7, 12-14';
            input.focus();
        }
    }
}

function parseNumberListSet(inputStr, totalCount) {
    if (!inputStr) return new Set();
    const result = new Set();
    const parts = inputStr.split(/[,;\s]+/);
    for (const part of parts) {
        if (!part.trim()) continue;
        if (part.includes('-')) {
            const [startStr, endStr] = part.split('-');
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            if (!isNaN(start) && !isNaN(end)) {
                const min = Math.min(start, end);
                const max = Math.max(start, end);
                for (let i = min; i <= max; i++) {
                    if (i >= 1 && i <= totalCount) result.add(i);
                }
            }
        } else {
            const num = parseInt(part, 10);
            if (!isNaN(num) && num >= 1 && num <= totalCount) {
                result.add(num);
            }
        }
    }
    return result;
}

function executeExportCbtTableWord(e, code) {
    if (e) e.preventDefault();

    const activeCode = code || appState.activeBankGroupCode || '';
    const allQuestions = appState.questionBank.filter(q => q && String(q.code) === String(activeCode));

    if (!allQuestions || allQuestions.length === 0) {
        showToast('Tidak ada soal pada kode ini.', 'error');
        return;
    }

    const mode = document.querySelector('input[name="cbt-num-filter-mode"]:checked')?.value || 'all';
    const inputVal = document.getElementById('cbt-num-filter-input')?.value || '';
    const numSet = parseNumberListSet(inputVal, allQuestions.length);

    let selectedQuestions = [];

    if (mode === 'include') {
        if (numSet.size === 0) {
            showToast('Harap masukkan nomor soal valid yang ingin dicetak.', 'error');
            return;
        }
        selectedQuestions = allQuestions.filter((_, idx) => numSet.has(idx + 1));
    } else if (mode === 'exclude') {
        if (numSet.size === 0) {
            showToast('Harap masukkan nomor soal yang ingin dikecualikan.', 'error');
            return;
        }
        selectedQuestions = allQuestions.filter((_, idx) => !numSet.has(idx + 1));
    } else {
        selectedQuestions = allQuestions;
    }

    if (selectedQuestions.length === 0) {
        showToast('Tidak ada soal yang sesuai dengan kriteria filter nomor.', 'error');
        return;
    }

    // Build CBT Word tables
    const tablesHtml = selectedQuestions.map((q, idx) => {
        const isEssay = q.type === 'essay';
        const tsVal = isEssay ? 'ESY' : '1';
        const kdVal = '1';

        // Extract options
        let optA = '', optB = '', optC = '', optD = '', optE = '';
        if (Array.isArray(q.options)) {
            optA = q.options[0] || '';
            optB = q.options[1] || '';
            optC = q.options[2] || '';
            optD = q.options[3] || '';
            optE = q.options[4] || '';
        } else if (q.options && typeof q.options === 'object') {
            optA = q.options.A || '';
            optB = q.options.B || '';
            optC = q.options.C || '';
            optD = q.options.D || '';
            optE = q.options.E || '';
        }

        // Answer key letter helper
        let kjVal = 'A';
        if (isEssay) {
            kjVal = q.answer || 'ESAY';
        } else {
            let rawAns = q.answer !== undefined && q.answer !== null ? String(q.answer).trim() : '';
            if (/^[A-Ea-e]$/.test(rawAns)) {
                kjVal = rawAns.toUpperCase();
            } else if (/^[0-4]$/.test(rawAns)) {
                const num = parseInt(rawAns, 10);
                kjVal = String.fromCharCode(65 + num);
            } else {
                let opts = [];
                if (Array.isArray(q.options)) {
                    opts = q.options;
                } else if (q.options && typeof q.options === 'object') {
                    opts = [q.options.A, q.options.B, q.options.C, q.options.D, q.options.E];
                }
                const matchOpsiLetter = rawAns.match(/^(?:Opsi\s+)?([A-Ea-e])[\s.:]*/i);
                if (matchOpsiLetter) {
                    kjVal = matchOpsiLetter[1].toUpperCase();
                } else if (opts.length > 0) {
                    const foundIdx = opts.findIndex(opt => opt && String(opt).trim().toLowerCase() === rawAns.toLowerCase());
                    if (foundIdx !== -1) {
                        kjVal = String.fromCharCode(65 + foundIdx);
                    } else if (q.correctOptionText) {
                        const textIdx = opts.findIndex(opt => opt && String(opt).trim().toLowerCase() === String(q.correctOptionText).trim().toLowerCase());
                        if (textIdx !== -1) {
                            kjVal = String.fromCharCode(65 + textIdx);
                        } else {
                            kjVal = 'A';
                        }
                    } else {
                        kjVal = 'A';
                    }
                } else if (rawAns.length > 0 && /^[A-Ea-e]/i.test(rawAns)) {
                    kjVal = rawAns.charAt(0).toUpperCase();
                } else {
                    kjVal = 'A';
                }
            }
        }
        const qNum = idx + 1;

        return `
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 0px; page-break-inside: avoid; border: 1.5pt solid #94a3b8; mso-padding-alt: 4pt 6pt 4pt 6pt;">
                <tbody>
                    <tr style="background-color: #fef08a; font-weight: bold; border-bottom: 1pt solid #cbd5e1;">
                        <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; text-align: center; background-color: #fde047; color: #1e293b; font-weight: bold; mso-para-margin: 0cm;">TS</td>
                        <td style="padding: 4pt 6pt; color: #1e293b; font-weight: bold; mso-para-margin: 0cm;">${qbEscapeHtml(tsVal)}</td>
                    </tr>
                    <tr style="background-color: #fef08a; font-weight: bold; border-bottom: 1pt solid #cbd5e1;">
                        <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; text-align: center; background-color: #fde047; color: #1e293b; font-weight: bold; mso-para-margin: 0cm;">KD</td>
                        <td style="padding: 4pt 6pt; color: #1e293b; font-weight: bold; mso-para-margin: 0cm;">${qbEscapeHtml(kdVal)}</td>
                    </tr>
                    <tr style="background-color: #fef08a; font-weight: bold; border-bottom: 1pt solid #cbd5e1;">
                        <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; text-align: center; background-color: #fde047; color: #1e293b; font-weight: bold; mso-para-margin: 0cm;">KJ</td>
                        <td style="padding: 4pt 6pt; color: #1e293b; font-weight: bold; mso-para-margin: 0cm;">${qbEscapeHtml(kjVal)}</td>
                    </tr>
                    <tr style="background-color: #d1fae5; font-weight: bold; border-bottom: 1pt solid #cbd5e1;">
                        <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; text-align: center; background-color: #a7f3d0; color: #064e3b; font-weight: bold; mso-para-margin: 0cm;">ABS</td>
                        <td style="padding: 4pt 6pt; color: #064e3b; mso-para-margin: 0cm;">${qbEscapeHtml(q.explanation || '')}</td>
                    </tr>
                    <tr style="background-color: #ffffff; border-bottom: 1pt solid #cbd5e1;">
                        <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; font-weight: bold; text-align: center; vertical-align: top; background-color: #f8fafc; color: #334155; mso-para-margin: 0cm;">${qNum}.</td>
                        <td style="padding: 4pt 6pt; font-weight: 600; color: #0f172a; line-height: 1.4; mso-para-margin: 0cm;">${qbEscapeHtml(q.question || '')}</td>
                    </tr>
                    ${!isEssay ? `
                    <tr style="background-color: #ffffff; border-bottom: 1pt solid #e2e8f0;">
                        <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; font-weight: bold; text-align: center; background-color: #f8fafc; color: #334155; mso-para-margin: 0cm;">A</td>
                        <td style="padding: 4pt 6pt; color: #334155; mso-para-margin: 0cm;">${qbEscapeHtml(optA)}</td>
                    </tr>
                    <tr style="background-color: #ffffff; border-bottom: 1pt solid #e2e8f0;">
                        <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; font-weight: bold; text-align: center; background-color: #f8fafc; color: #334155; mso-para-margin: 0cm;">B</td>
                        <td style="padding: 4pt 6pt; color: #334155; mso-para-margin: 0cm;">${qbEscapeHtml(optB)}</td>
                    </tr>
                    <tr style="background-color: #ffffff; border-bottom: 1pt solid #e2e8f0;">
                        <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; font-weight: bold; text-align: center; background-color: #f8fafc; color: #334155; mso-para-margin: 0cm;">C</td>
                        <td style="padding: 4pt 6pt; color: #334155; mso-para-margin: 0cm;">${qbEscapeHtml(optC)}</td>
                    </tr>
                    <tr style="background-color: #ffffff; border-bottom: 1pt solid #e2e8f0;">
                        <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; font-weight: bold; text-align: center; background-color: #f8fafc; color: #334155; mso-para-margin: 0cm;">D</td>
                        <td style="padding: 4pt 6pt; color: #334155; mso-para-margin: 0cm;">${qbEscapeHtml(optD)}</td>
                    </tr>
                    ${optE ? `
                    <tr style="background-color: #ffffff; border-bottom: 1pt solid #cbd5e1;">
                        <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; font-weight: bold; text-align: center; background-color: #f8fafc; color: #334155; mso-para-margin: 0cm;">E</td>
                        <td style="padding: 4pt 6pt; color: #334155; mso-para-margin: 0cm;">${qbEscapeHtml(optE)}</td>
                    </tr>
                    ` : ''}
                    ` : ''}
                </tbody>
            </table>
            <p style="margin: 0 !important; padding: 0 !important; mso-para-margin: 0cm !important; height: 12pt; line-height: 12pt;">&nbsp;</p>
        `;
    }).join('');

    const group = (appState.questionBankGroups || []).find(bg => String(bg.code) === String(activeCode));
    const subObj = (appState.subjects || []).find(s => String(s.id) === String(group?.subjectId));

    const fullDocHtml = `
        <html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns:m="http://schemas.microsoft.com/office/2004/12/omml" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <title>Cetak Tabel CBT ${activeCode}</title>
            <!--[if gte mso 9]>
            <xml>
             <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
              <w:DoNotOptimizeForBrowser/>
             </w:WordDocument>
            </xml>
            <![endif]-->
            <style>
                @page { size: A4; margin: 1.5cm; }
                body, table, td, p, div, span {
                    font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
                    font-size: 10pt;
                    color: #1e293b;
                    line-height: 1.35;
                    margin: 0 !important;
                    padding: 0;
                    mso-para-margin: 0cm !important;
                    mso-line-height-rule: exactly;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 0px;
                    page-break-inside: avoid;
                    border: 1.5pt solid #cbd5e1;
                    mso-padding-alt: 4pt 6pt 4pt 6pt;
                }
                td {
                    border: 1pt solid #cbd5e1;
                    padding: 4pt 6pt;
                    font-size: 10pt;
                    vertical-align: top;
                }
            </style>
        </head>
        <body>
            <h3 style="font-family: Arial, sans-serif; font-size: 13pt; font-weight: bold; color: #0f172a; margin: 0 0 10pt 0 !important;">Extraordinary CBT Table - ${activeCode} (${subObj ? subObj.name : ''})</h3>
            ${tablesHtml}
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff' + fullDocHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Tabel_CBT_${activeCode}_${selectedQuestions.length}Soal.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    closeModal();
    showToast(`Berhasil mengunduh Tabel CBT Word (${selectedQuestions.length} Soal)!`, 'success');
}

// Grades Matrix
window.getGradeCategoriesForClassAndSubject = function(classId, subjectName) {
    if (!classId) return ['Harian 1'];
    const activeKey = String(classId).trim() + '_' + String(subjectName || 'ALL').trim();
    const sId = String(classId).trim().toLowerCase();
    const subName = String(subjectName || 'ALL').trim().toLowerCase();

    if (!appState.customGradeColumns) {
        appState.customGradeColumns = JSON.parse(localStorage.getItem('madrasah_customGradeColumns') || '{}');
    }
    const customCats = (appState.customGradeColumns[activeKey] || []).map(c => String(c).trim()).filter(Boolean);

    // Get categories that currently have recorded grades for this exact class and subject
    let existingCats = Array.from(new Set(
        (appState.grades || [])
            .filter(g => {
                if (!g) return false;
                const gClsId = String(g.classId || '').trim().toLowerCase();
                if (gClsId !== sId) return false;
                
                const gSub = String(g.subjectName || '').trim().toLowerCase();
                const matchesSubject = (subName === 'all' || (gSub && gSub === subName));
                return matchesSubject && g.category;
            })
            .map(g => String(g.category).trim())
            .filter(Boolean)
    ));

    // Combine custom columns and recorded grades for this specific class and subject
    const categories = Array.from(new Set([...customCats, ...existingCats]));
    
    // If empty for this class and subject, initialize default 'Harian 1' for this specific key
    if (categories.length === 0) {
        categories.push('Harian 1');
        if (!appState.customGradeColumns[activeKey]) {
            appState.customGradeColumns[activeKey] = ['Harian 1'];
        }
        safeSetLocalStorage('madrasah_customGradeColumns', appState.customGradeColumns);
    }
    return categories;
};

function renderGradesModule(container) {
    if (!appState.gradeCategories || !Array.isArray(appState.gradeCategories)) {
        const savedCats = localStorage.getItem('madrasah_gradeCategories') || localStorage.getItem('madrasah_grade_categories');
        appState.gradeCategories = savedCats ? JSON.parse(savedCats) : ['Harian 1'];
    }
    if (!appState.grades || !Array.isArray(appState.grades)) {
        appState.grades = JSON.parse(localStorage.getItem('madrasah_grades') || '[]');
    }
    if (!appState.customGradeColumns) {
        appState.customGradeColumns = JSON.parse(localStorage.getItem('madrasah_customGradeColumns') || '{}');
    }

    // Determine active class and subject
    const classes = appState.classes || [];
    let selectedClassId = appState.activeGradeClassId || localStorage.getItem('madrasah_activeGradeClassId');
    
    // Auto-detect class with grades if current selectedClassId has no grades
    if (!selectedClassId || !classes.some(c => String(c.id) === String(selectedClassId))) {
        const classWithGrades = classes.find(c => (appState.grades || []).some(g => String(g.classId) === String(c.id)));
        selectedClassId = classWithGrades ? classWithGrades.id : (classes[0] ? classes[0].id : '');
    }

    let selectedSubject = appState.activeGradeSubject || localStorage.getItem('madrasah_activeGradeSubject') || 'ALL';
    
    appState.activeGradeClassId = selectedClassId;
    appState.activeGradeSubject = selectedSubject;
    safeSetLocalStorage('madrasah_activeGradeClassId', selectedClassId);
    safeSetLocalStorage('madrasah_activeGradeSubject', selectedSubject);
    
    const categories = window.getGradeCategoriesForClassAndSubject(selectedClassId, selectedSubject);
    const classStudents = (appState.students || []).filter(s => String(s.classId || s.class_id) === String(selectedClassId));
    
    // Build list of distinct subjects (from appState.subjects and from appState.grades)
    const baseSubjects = (appState.subjects || []).map(s => s.name);
    const subjectsInGrades = (appState.grades || []).map(g => g.subjectName).filter(Boolean);
    const allSubjectNames = Array.from(new Set([...baseSubjects, ...subjectsInGrades]));

    // Total grades count for selected class
    const gradesForThisClass = (appState.grades || []).filter(g => String(g.classId) === String(selectedClassId));
    const totalRecordedInClass = gradesForThisClass.filter(g => g.score !== undefined && g.score !== null).length;

    container.innerHTML = `
        <div class="space-y-6 pb-8">
            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                        <h1 class="text-xl sm:text-2xl font-bold text-slate-800">Manajemen Nilai Murid</h1>
                        <p class="text-xs text-slate-400 mt-1">Kelola, input, dan lihat hasil import nilai CBT per kelas dan mata pelajaran secara otomatis</p>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        <span class="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold border border-emerald-200">
                            <i class="fa-solid fa-database mr-1"></i> Total Database: ${(appState.grades || []).length} Nilai
                        </span>
                        <span class="px-3.5 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold border border-indigo-200">
                            <i class="fa-solid fa-graduation-cap mr-1"></i> Kelas Ini: ${totalRecordedInClass} Nilai
                        </span>
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Pilih Kelas</label>
                        <select onchange="handleGradeClassChange(this.value)" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl text-sm font-semibold focus:bg-white focus:ring-1 focus:ring-emerald-500">
                            <option value="">-- Pilih Kelas --</option>
                            ${classes.map(c => {
                                const cGradesCount = (appState.grades || []).filter(g => String(g.classId) === String(c.id)).length;
                                return `<option value="${c.id}" ${String(selectedClassId) === String(c.id) ? 'selected' : ''}>${c.name} ${cGradesCount > 0 ? `(${cGradesCount} Nilai)` : ''}</option>`;
                            }).join('')}
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Mata Pelajaran</label>
                        <select onchange="handleGradeSubjectChange(this.value)" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl text-sm font-semibold focus:bg-white focus:ring-1 focus:ring-emerald-500">
                            <option value="ALL" ${selectedSubject === 'ALL' || !selectedSubject ? 'selected' : ''}>-- Semua Mata Pelajaran --</option>
                            ${allSubjectNames.map(sName => `<option value="${sName}" ${selectedSubject === sName ? 'selected' : ''}>${sName}</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>

            ${!selectedClassId ? `
                <div class="bg-white p-12 rounded-3xl text-center text-slate-400 text-sm border border-slate-100">Pilih kelas terlebih dahulu untuk menginput atau melihat nilai.</div>
            ` : `
                <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                    <div class="flex flex-wrap justify-between items-center border-b pb-4 gap-3">
                        <div class="flex items-center space-x-2">
                            <h3 class="font-bold text-slate-800">Matriks Penilaian Murid</h3>
                            <button type="button" onclick="openAddGradeColumnModal()" class="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-semibold border border-emerald-200 transition flex items-center space-x-1 cursor-pointer">
                                <i class="fa-solid fa-plus"></i><span>Tambah Kolom Nilai</span>
                            </button>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button type="button" onclick="exportGradesMatrixExcel()" class="px-4 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-bold shadow transition flex items-center space-x-1 cursor-pointer">
                                <i class="fa-solid fa-file-excel"></i><span>Ekspor Excel</span>
                            </button>
                            <button type="button" onclick="printGradesMatrix()" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-semibold shadow transition flex items-center space-x-1 cursor-pointer">
                                <i class="fa-solid fa-file-word"></i><span>Cetak Word</span>
                            </button>
                            <button type="button" onclick="saveAllMatrixGrades()" class="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-2xl text-xs font-semibold shadow transition cursor-pointer flex items-center space-x-1.5">
                                <i class="fa-solid fa-floppy-disk"></i>
                                <span>Simpan Semua Nilai</span>
                            </button>
                        </div>
                    </div>

                    ${categories.length === 0 ? `
                        <div class="p-8 text-center text-slate-400 text-sm bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                            <i class="fa-solid fa-folder-open text-2xl mb-2 text-slate-300 block"></i>
                            Belum ada kolom nilai. Klik tombol <span class="font-semibold text-slate-600">"Tambah Kolom Nilai"</span> di atas atau import dari Evaluasi CBT untuk menampilkan kolom penilaian.
                        </div>
                    ` : `
                        <div class="overflow-x-auto">
                            <table class="w-full text-left border-collapse min-w-[600px]">
                                <thead>
                                    <tr class="bg-slate-50 text-xs text-slate-600 uppercase font-semibold border-b">
                                        <th class="p-3 w-16 text-center">No</th>
                                        <th class="p-3">NIS</th>
                                        <th class="p-3 text-center w-16">Foto Profil</th>
                                        <th class="p-3">Nama Murid</th>
                                        ${categories.map(cat => {
                                            const catName = typeof cat === 'string' ? cat : (cat && (cat.name || cat.title || cat.category) ? (cat.name || cat.title || cat.category) : String(cat));
                                            const safeCatAttr = String(catName).replace(/'/g, "\\'").replace(/"/g, '&quot;');
                                            return `
                                                <th class="p-3 text-center group select-none">
                                                    <div class="inline-flex items-center justify-center gap-1.5 font-bold text-slate-700 bg-slate-100/70 hover:bg-slate-200/70 px-2.5 py-1.5 rounded-xl transition">
                                                        <span class="cursor-pointer hover:text-emerald-700 transition" onclick="renameGradeCategory('${safeCatAttr}')" title="Klik untuk mengubah nama judul">${catName}</span>
                                                        <div class="flex items-center gap-0.5">
                                                            <button type="button" onclick="renameGradeCategory('${safeCatAttr}')" class="p-1 hover:bg-emerald-100 text-slate-400 hover:text-emerald-700 rounded-lg transition cursor-pointer" title="Ubah Nama Judul Nilai">
                                                                <i class="fa-solid fa-pen-to-square text-[10px]"></i>
                                                            </button>
                                                            <button type="button" onclick="confirmDeleteGradeCategory('${safeCatAttr}')" class="p-1 hover:bg-rose-100 text-slate-400 hover:text-rose-600 rounded-lg transition cursor-pointer" title="Hapus Kolom Nilai Ini">
                                                                <i class="fa-solid fa-trash-can text-[10px]"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </th>
                                            `;
                                        }).join('')}
                                    </tr>
                                </thead>
                                <tbody class="divide-y text-sm">
                                    ${classStudents.map((st, idx) => {
                                        const photoHtml = st.photo 
                                            ? `<img src="${window.getPhotoHtmlSrc ? window.getPhotoHtmlSrc(st.photo) : ''}" class="w-10 h-10 rounded-full object-cover border border-emerald-200 shadow-xs mx-auto cursor-pointer hover:scale-110 transition ring-2 ring-emerald-500/20" onclick="showPhotoPopup('${st.photo}', 'Foto Profil - ${st.name}')" referrerPolicy="no-referrer" alt="Foto Profil" title="Klik untuk memperbesar Foto Profil">`
                                            : `<div class="w-10 h-10 rounded-full bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200 mx-auto font-bold text-xs shadow-xs" title="Belum ada foto profil">${(st.name || 'S').charAt(0).toUpperCase()}</div>`;
                                        
                                        return `
                                            <tr class="hover:bg-slate-50/50">
                                                <td class="p-3 text-center font-mono text-xs text-slate-500">${idx + 1}</td>
                                                <td class="p-3 font-mono text-xs font-bold text-emerald-700">${st.nis}</td>
                                                <td class="p-3 text-center">${photoHtml}</td>
                                                <td class="p-3 font-semibold text-slate-800">${st.name}</td>
                                                ${categories.map(cat => {
                                                    const g = (appState.grades || []).find(item => {
                                                        if (!item) return false;
                                                        const sMatch = String(item.studentId || '').trim() === String(st.id || '').trim() || 
                                                                       String(item.studentId || '').trim() === String(st.nis || '').trim() || 
                                                                       (item.studentId && st.name && String(item.studentId).trim().toLowerCase() === String(st.name).trim().toLowerCase()) ||
                                                                       (item.studentName && st.name && String(item.studentName).trim().toLowerCase() === String(st.name).trim().toLowerCase());
                                                        const cMatch = String(item.category || '').trim().toLowerCase() === String(cat || '').trim().toLowerCase();
                                                        const classMatch = !item.classId || String(item.classId).trim() === String(selectedClassId).trim();
                                                        const itemSub = String(item.subjectName || '').trim().toLowerCase();
                                                        const selSub = String(selectedSubject || 'ALL').trim().toLowerCase();
                                                        const subMatch = (selSub === 'all') ? true : (itemSub === selSub);
                                                        return classMatch && sMatch && cMatch && subMatch;
                                                    });
                                                    const val = (g && g.score !== undefined && g.score !== null) ? g.score : '';
                                                    return `<td class="p-3 text-center"><input type="number" min="0" max="100" data-student="${st.id}" data-category="${cat}" value="${val}" onchange="handleSingleGradeChange('${st.id}', '${cat}', this.value)" class="grade-input-cell w-20 px-3 py-1.5 bg-slate-50 border rounded-2xl text-center text-sm font-bold text-slate-800 focus:bg-white focus:ring-1 focus:ring-emerald-500" placeholder="0-100"></td>`;
                                                }).join('')}
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    `}
                </div>
            `}
        </div>
    `;
}

function handleGradeClassChange(classId) {
    saveCurrentDOMGradesToState();
    appState.activeGradeClassId = classId;
    safeSetLocalStorage('madrasah_activeGradeClassId', classId);
    renderGradesModule(document.getElementById('view-container'));
}

function handleGradeSubjectChange(subjectName) {
    saveCurrentDOMGradesToState();
    appState.activeGradeSubject = subjectName;
    safeSetLocalStorage('madrasah_activeGradeSubject', subjectName);
    renderGradesModule(document.getElementById('view-container'));
}

function saveCurrentDOMGradesToState() {
    const classId = appState.activeGradeClassId;
    const subjectName = (appState.activeGradeSubject && appState.activeGradeSubject !== 'ALL') ? appState.activeGradeSubject : ((appState.subjects && appState.subjects[0]?.name) || 'Mata Pelajaran');
    const inputs = document.querySelectorAll('.grade-input-cell');
    if (!inputs || inputs.length === 0) return;

    if (!appState.grades) appState.grades = JSON.parse(localStorage.getItem('madrasah_grades')) || [];

    inputs.forEach(input => {
        const studentId = input.getAttribute('data-student');
        const category = input.getAttribute('data-category');
        const val = input.value.trim();
        if (val !== '') {
            const score = Number(val);
            const idx = appState.grades.findIndex(g => 
                String(g.classId || classId) === String(classId) &&
                String(g.studentId) === String(studentId) && 
                String(g.category || '').trim().toLowerCase() === String(category || '').trim().toLowerCase() && 
                String(g.subjectName || '').trim().toLowerCase() === String(subjectName).trim().toLowerCase()
            );
            if (idx >= 0) {
                appState.grades[idx].score = score;
                appState.grades[idx].classId = classId;
                appState.grades[idx].subjectName = subjectName;
            } else {
                appState.grades.push({
                    id: 'GRD_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
                    classId,
                    studentId,
                    subjectName,
                    category,
                    score
                });
            }
        }
    });

    safeSetLocalStorage('madrasah_grades', appState.grades);
}

function handleSingleGradeChange(studentId, category, val) {
    const classId = appState.activeGradeClassId;
    const subjectName = (appState.activeGradeSubject && appState.activeGradeSubject !== 'ALL') ? appState.activeGradeSubject : ((appState.subjects && appState.subjects[0]?.name) || 'Mata Pelajaran');
    if (!appState.grades) appState.grades = JSON.parse(localStorage.getItem('madrasah_grades')) || [];

    const valTrim = String(val || '').trim();
    if (valTrim === '') return;

    const score = Number(valTrim);
    const idx = appState.grades.findIndex(g => 
        String(g.classId || classId) === String(classId) &&
        String(g.studentId) === String(studentId) && 
        String(g.category || '').trim().toLowerCase() === String(category || '').trim().toLowerCase() && 
        String(g.subjectName || '').trim().toLowerCase() === String(subjectName).trim().toLowerCase()
    );

    if (idx >= 0) {
        appState.grades[idx].score = score;
        appState.grades[idx].classId = classId;
        appState.grades[idx].subjectName = subjectName;
    } else {
        appState.grades.push({
            id: 'GRD_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
            classId,
            studentId,
            subjectName,
            category,
            score
        });
    }

    safeSetLocalStorage('madrasah_grades', appState.grades);
    if (typeof saveState === 'function') saveState('grades');
    
    // Save to server
    fetch('/api/grades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ classId, studentId, subjectName, category, score })
    }).catch(e => console.warn('Error saving grade to server:', e));
}

async function saveAllMatrixGrades() {
    saveCurrentDOMGradesToState();

    const classId = appState.activeGradeClassId;
    const subjectName = appState.activeGradeSubject || (appState.subjects[0]?.name || '');
    const inputs = document.querySelectorAll('.grade-input-cell');
    if (!appState.grades) appState.grades = JSON.parse(localStorage.getItem('madrasah_grades')) || [];

    const payloadList = [];
    inputs.forEach(input => {
        const studentId = input.getAttribute('data-student');
        const category = input.getAttribute('data-category');
        const val = input.value.trim();
        if (val !== '') {
            payloadList.push({
                classId,
                studentId,
                subjectName,
                category,
                score: Number(val)
            });
        }
    });

    safeSetLocalStorage('madrasah_grades', appState.grades);
    saveState('grades');

    if (payloadList.length > 0) {
        try {
            await fetch('/api/grades', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ grades: payloadList })
            });
        } catch (err) {
            console.warn('Error saving grades in bulk:', err);
        }
    }

    showToast(`Berhasil menyimpan ${payloadList.length} data nilai siswa!`, 'success');
}

function openAddGradeColumnModal() {
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div class="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-4">
                <div class="flex justify-between items-center">
                    <h3 class="font-bold flex items-center space-x-2">
                        <i class="fa-solid fa-plus-circle text-emerald-600"></i>
                        <span>Tambah Kolom Nilai</span>
                    </h3>
                    <button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>
                <div>
                    <label class="block text-xs uppercase text-slate-500 mb-1">Judul / Kategori Kolom Nilai</label>
                    <input type="text" id="new-grade-col-name" placeholder="Contoh: Praktikum 1, Kuis Bab 2" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl text-sm font-semibold"/>
                </div>
                <div class="flex justify-end space-x-2 pt-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 rounded-xl text-xs font-semibold">Batal</button>
                    <button type="button" onclick="confirmAddGradeColumn()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow">Tambah</button>
                </div>
            </div>
        </div>
    `;
}

function confirmAddGradeColumn() {
    const nameInput = document.getElementById('new-grade-col-name');
    const colName = nameInput ? nameInput.value.trim() : '';
    if (!colName) {
        showToast('Judul kolom nilai tidak boleh kosong!', 'error');
        return;
    }

    const selectedClassId = appState.activeGradeClassId;
    const selectedSubject = appState.activeGradeSubject || 'ALL';
    const activeKey = String(selectedClassId) + '_' + String(selectedSubject);

    if (!appState.customGradeColumns) {
        appState.customGradeColumns = {};
    }

    const categories = window.getGradeCategoriesForClassAndSubject(selectedClassId, selectedSubject);
    if (categories.some(c => String(c).toLowerCase() === colName.toLowerCase())) {
        showToast('Nama kategori nilai sudah ada!', 'error');
        return;
    }

    // Preserve all existing on-screen typed inputs
    saveCurrentDOMGradesToState();

    if (!appState.customGradeColumns[activeKey]) {
        appState.customGradeColumns[activeKey] = [];
    }
    appState.customGradeColumns[activeKey].push(colName);
    safeSetLocalStorage('madrasah_customGradeColumns', appState.customGradeColumns);
    saveState('customGradeColumns');

    // Also update global gradeCategories for general fallback/compatibility
    if (!appState.gradeCategories) {
        appState.gradeCategories = [];
    }
    if (!appState.gradeCategories.includes(colName)) {
        appState.gradeCategories.push(colName);
        safeSetLocalStorage('madrasah_gradeCategories', appState.gradeCategories);
        saveState('gradeCategories');
    }

    fetch('/api/grade-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category: colName, gradeCategories: appState.gradeCategories })
    }).catch(err => console.warn('Error saving category to server:', err));

    closeModal();
    showToast(`Kolom "${colName}" berhasil ditambahkan!`, 'success');
    renderGradesModule(document.getElementById('view-container'));
}

function renameGradeCategory(oldCategory) {
    if (!oldCategory) return;
    saveCurrentDOMGradesToState();

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-5">
                <div class="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h3 class="font-bold text-slate-800 text-base flex items-center gap-2">
                        <i class="fa-solid fa-pen-to-square text-emerald-600"></i>
                        <span>Ubah Nama Judul Nilai</span>
                    </h3>
                    <button type="button" onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1 rounded-lg">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <div class="space-y-3">
                    <label class="block text-xs uppercase font-semibold text-slate-500">Nama Judul Saat Ini: <span class="font-bold text-slate-800">${oldCategory}</span></label>
                    <div>
                        <span class="block text-xs font-semibold text-slate-600 mb-1">Nama Judul Baru</span>
                        <input type="text" id="input-rename-grade-cat" value="${oldCategory.replace(/"/g, '&quot;')}" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white" placeholder="Ketik nama judul baru...">
                    </div>
                </div>

                <div class="flex items-center justify-between pt-2">
                    <button type="button" onclick="confirmDeleteGradeCategory('${oldCategory.replace(/'/g, "\\'")}')" class="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold border border-rose-200 transition flex items-center gap-1.5 cursor-pointer">
                        <i class="fa-solid fa-trash-can"></i>
                        <span>Hapus Kolom</span>
                    </button>

                    <div class="flex items-center gap-2">
                        <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer">Batal</button>
                        <button type="button" onclick="confirmRenameGradeCategory('${oldCategory.replace(/'/g, "\\'")}')" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer flex items-center gap-1.5">
                            <i class="fa-solid fa-floppy-disk"></i>
                            <span>Simpan Nama</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const inp = document.getElementById('input-rename-grade-cat');
        if (inp) {
            inp.focus();
            inp.select();
        }
    }, 100);
}

function confirmRenameGradeCategory(oldCategory) {
    const input = document.getElementById('input-rename-grade-cat');
    const newCategory = input ? input.value.trim() : '';

    if (!newCategory) {
        showToast('Nama judul nilai tidak boleh kosong!', 'warning');
        return;
    }

    if (newCategory.toLowerCase() === oldCategory.toLowerCase()) {
        closeModal();
        return;
    }

    const oldLower = String(oldCategory).trim().toLowerCase();
    const selectedClassId = appState.activeGradeClassId;
    const selectedSubject = appState.activeGradeSubject || 'ALL';
    const activeKey = String(selectedClassId) + '_' + String(selectedSubject);

    // 1. Update in customGradeColumns
    if (!appState.customGradeColumns) {
        appState.customGradeColumns = {};
    }
    if (appState.customGradeColumns[activeKey]) {
        appState.customGradeColumns[activeKey] = appState.customGradeColumns[activeKey].map(c => {
            if (String(c).trim().toLowerCase() === oldLower) {
                return newCategory;
            }
            return c;
        });
    }

    // 2. Update global fallback
    if (!appState.gradeCategories || !Array.isArray(appState.gradeCategories)) {
        appState.gradeCategories = [];
    }

    let found = false;
    appState.gradeCategories = appState.gradeCategories.map(c => {
        if (String(c).trim().toLowerCase() === oldLower) {
            found = true;
            return newCategory;
        }
        return c;
    });

    if (!found) {
        appState.gradeCategories.push(newCategory);
    }

    appState.gradeCategories = Array.from(new Set(appState.gradeCategories));

    // 3. Update all matching grade items
    let updatedCount = 0;
    if (appState.grades && Array.isArray(appState.grades)) {
        appState.grades.forEach(g => {
            if (String(g.classId) === String(selectedClassId) && 
                (selectedSubject === 'ALL' || !g.subjectName || String(g.subjectName).trim().toLowerCase() === String(selectedSubject).trim().toLowerCase()) &&
                String(g.category || '').trim().toLowerCase() === oldLower) {
                g.category = newCategory;
                updatedCount++;
            }
        });
    }

    safeSetLocalStorage('madrasah_customGradeColumns', appState.customGradeColumns);
    safeSetLocalStorage('madrasah_gradeCategories', appState.gradeCategories);
    safeSetLocalStorage('madrasah_grade_categories', appState.gradeCategories);
    safeSetLocalStorage('madrasah_grades', appState.grades);
    
    if (typeof saveState === 'function') {
        saveState('customGradeColumns');
        saveState('gradeCategories');
        saveState('grades');
    }

    fetch('/api/grade-categories/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldCategory: oldCategory, newCategory: newCategory })
    }).catch(err => console.warn('Error syncing updated category to server:', err));

    closeModal();
    showToast(`Judul nilai "${oldCategory}" berhasil diubah menjadi "${newCategory}"!`, 'success');
    renderGradesModule(document.getElementById('view-container'));
}

function confirmDeleteGradeCategory(categoryToDelete) {
    if (!categoryToDelete) return;

    const catName = typeof categoryToDelete === 'string' ? categoryToDelete : (categoryToDelete.name || categoryToDelete.title || String(categoryToDelete));
    const safeCatAttr = String(catName).replace(/'/g, "\\'").replace(/"/g, '&quot;');

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    modal.classList.remove('hidden');
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-5 text-center">
                <div class="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl shadow-inner">
                    <i class="fa-solid fa-trash-can"></i>
                </div>
                <div class="space-y-2">
                    <h3 class="text-lg font-bold text-slate-800">Hapus Kolom Nilai</h3>
                    <p class="text-sm text-slate-600">
                        Apakah Anda yakin ingin menghapus kolom nilai <strong class="text-slate-900">"${catName}"</strong>?
                    </p>
                    <p class="text-xs text-rose-600 bg-rose-50 p-2.5 rounded-xl border border-rose-200">
                        <i class="fa-solid fa-triangle-exclamation mr-1"></i>
                        Seluruh nilai murid pada kolom ini akan dihapus secara permanen.
                    </p>
                </div>
                <div class="flex items-center justify-center gap-3 pt-2">
                    <button type="button" onclick="closeModal()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition">
                        Batal
                    </button>
                    <button type="button" onclick="executeDeleteGradeCategory('${safeCatAttr}')" class="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer flex items-center gap-1.5">
                        <i class="fa-solid fa-trash-can"></i>
                        <span>Ya, Hapus Kolom</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

async function executeDeleteGradeCategory(categoryToDelete) {
    if (!categoryToDelete) return;

    // 1. Save currently edited DOM grades first so unrelated changes are not lost
    saveCurrentDOMGradesToState();

    const catName = typeof categoryToDelete === 'string' ? categoryToDelete : (categoryToDelete.name || categoryToDelete.title || String(categoryToDelete));
    const catLower = String(catName).trim().toLowerCase();

    const selectedClassId = appState.activeGradeClassId;
    const selectedSubject = appState.activeGradeSubject || 'ALL';
    const activeKey = String(selectedClassId) + '_' + String(selectedSubject);

    // 2. Remove from customGradeColumns
    if (!appState.customGradeColumns) {
        appState.customGradeColumns = {};
    }
    if (appState.customGradeColumns[activeKey]) {
        appState.customGradeColumns[activeKey] = appState.customGradeColumns[activeKey].filter(c => {
            return String(c).trim().toLowerCase() !== catLower;
        });
    }

    // 3. Remove category from gradeCategories array
    if (appState.gradeCategories && Array.isArray(appState.gradeCategories)) {
        appState.gradeCategories = appState.gradeCategories.filter(c => {
            const cStr = typeof c === 'string' ? c : (c.name || c.title || '');
            return cStr.trim().toLowerCase() !== catLower;
        });
    } else {
        appState.gradeCategories = [];
    }

    // 4. Purge grades ONLY for this specific class & subject and deleted category
    if (appState.grades && Array.isArray(appState.grades)) {
        appState.grades = appState.grades.filter(g => {
            const sMatch = String(g.classId) === String(selectedClassId);
            const subMatch = selectedSubject === 'ALL' || !g.subjectName || String(g.subjectName).trim().toLowerCase() === String(selectedSubject).trim().toLowerCase();
            const cMatch = String(g.category || '').trim().toLowerCase() === catLower;
            return !(sMatch && subMatch && cMatch);
        });
    }

    // 5. Save to local storage
    safeSetLocalStorage('madrasah_customGradeColumns', appState.customGradeColumns);
    safeSetLocalStorage('madrasah_gradeCategories', appState.gradeCategories);
    safeSetLocalStorage('madrasah_grade_categories', appState.gradeCategories);
    safeSetLocalStorage('madrasah_grades', appState.grades);

    // 6. Delete from server
    try {
        await fetch(`/api/grade-categories/${encodeURIComponent(catName)}`, {
            method: 'DELETE'
        });
    } catch (err) {
        console.warn('Error deleting category on server:', err);
    }

    // 7. Broadcast & sync state
    if (typeof saveState === 'function') {
        saveState('customGradeColumns');
        saveState('gradeCategories');
        saveState('grades');
    }

    closeModal();
    showToast(`Kolom nilai "${catName}" berhasil dihapus.`, 'info');
    renderGradesModule(document.getElementById('view-container'));
}

window.renameGradeCategory = renameGradeCategory;
window.confirmRenameGradeCategory = confirmRenameGradeCategory;
window.confirmDeleteGradeCategory = confirmDeleteGradeCategory;
window.executeDeleteGradeCategory = executeDeleteGradeCategory;

function printGradesMatrix() {
    saveCurrentDOMGradesToState();
    const classId = appState.activeGradeClassId;
    const rawSubjectName = appState.activeGradeSubject || 'ALL';
    const subjectName = (rawSubjectName && rawSubjectName !== 'ALL') ? rawSubjectName : 'Semua Mata Pelajaran';
    const cls = (appState.classes || []).find(c => String(c.id) === String(classId));
    const categories = window.getGradeCategoriesForClassAndSubject(classId, rawSubjectName);
    const classStudents = (appState.students || []).filter(s => String(s.classId || s.class_id) === String(classId));

    let htmlContent = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Rekap Nilai</title><style>table { border-collapse: collapse; width: 100%; font-family: sans-serif; font-size: 12px; } th, td { border: 1px solid #cbd5e1; padding: 8px; text-align: center; } th { background-color: #f1f5f9; } td:nth-child(3) { text-align: left; }</style></head><body>`;
    htmlContent += `<h2>Laporan Rekap Nilai Siswa</h2>`;
    htmlContent += `<p><b>Kelas:</b> ${cls ? cls.name : '-'}<br><b>Mata Pelajaran:</b> ${subjectName}</p><br/>`;
    htmlContent += `<table><thead><tr><th>No</th><th>NIS</th><th>Nama Siswa</th>`;
    categories.forEach(cat => {
        htmlContent += `<th>${cat}</th>`;
    });
    htmlContent += `</tr></thead><tbody>`;

    classStudents.forEach((st, idx) => {
        htmlContent += `<tr><td>${idx + 1}</td><td>${st.nis || ''}</td><td>${st.name || ''}</td>`;
        categories.forEach(cat => {
            const g = (appState.grades || []).find(item => {
                const sMatch = String(item.studentId) === String(st.id) || String(item.studentId) === String(st.nis) || String(item.studentId).toLowerCase() === String(st.name || '').toLowerCase() || (item.studentName && String(item.studentName).toLowerCase() === String(st.name || '').toLowerCase());
                const cMatch = String(item.category || '').trim().toLowerCase() === String(cat || '').trim().toLowerCase();
                const subMatch = !rawSubjectName || rawSubjectName === 'ALL' || !item.subjectName || String(item.subjectName || '').trim().toLowerCase() === String(rawSubjectName || '').trim().toLowerCase();
                return sMatch && cMatch && subMatch;
            });
            htmlContent += `<td>${(g && g.score !== undefined && g.score !== null) ? g.score : '-'}</td>`;
        });
        htmlContent += `</tr>`;
    });

    htmlContent += `</tbody></table></body></html>`;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Rekap_Nilai_${cls ? cls.name : 'Kelas'}_${subjectName}.doc`;
    a.click();
    showToast('Rekap nilai berhasil dicetak ke Word (.doc)!', 'success');
}

function exportGradesMatrixExcel() {
    saveCurrentDOMGradesToState();
    const classId = appState.activeGradeClassId;
    const rawSubjectName = appState.activeGradeSubject || 'ALL';
    const subjectName = (rawSubjectName && rawSubjectName !== 'ALL') ? rawSubjectName : 'Semua Mata Pelajaran';
    const cls = (appState.classes || []).find(c => String(c.id) === String(classId));
    const categories = window.getGradeCategoriesForClassAndSubject(classId, rawSubjectName);
    const classStudents = (appState.students || []).filter(s => String(s.classId || s.class_id) === String(classId));

    if (!cls) {
        showToast('Pilih kelas terlebih dahulu.', 'warning');
        return;
    }

    const data = classStudents.map((st, idx) => {
        const row = {
            'No': idx + 1,
            'NIS': st.nis || '-',
            'Nama Murid': st.name,
            'Kelas': cls.name,
            'Mata Pelajaran': subjectName
        };
        categories.forEach(cat => {
            const g = (appState.grades || []).find(item => {
                const sMatch = String(item.studentId) === String(st.id) || String(item.studentId) === String(st.nis) || String(item.studentId).toLowerCase() === String(st.name || '').toLowerCase() || (item.studentName && String(item.studentName).toLowerCase() === String(st.name || '').toLowerCase());
                const cMatch = String(item.category || '').trim().toLowerCase() === String(cat || '').trim().toLowerCase();
                const subMatch = !rawSubjectName || rawSubjectName === 'ALL' || !item.subjectName || String(item.subjectName || '').trim().toLowerCase() === String(rawSubjectName || '').trim().toLowerCase();
                return sMatch && cMatch && subMatch;
            });
            row[cat] = (g && g.score !== undefined && g.score !== null) ? g.score : '-';
        });
        return row;
    });

    if (window.XLSX) {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Matriks Nilai");
        XLSX.writeFile(workbook, `Rekap_Nilai_${cls.name}_${subjectName}.xlsx`);
        showToast('Rekap nilai Excel (.xlsx) berhasil diunduh!', 'success');
    } else {
        let csvContent = "data:text/csv;charset=utf-8,No,NIS,Nama Murid,Kelas,Mata Pelajaran";
        categories.forEach(cat => { csvContent += `,"${cat}"`; });
        csvContent += "\n";
        data.forEach(r => {
            csvContent += `${r['No']},"${r['NIS']}","${r['Nama Murid']}","${r['Kelas']}","${r['Mata Pelajaran']}"`;
            categories.forEach(cat => { csvContent += `,"${r[cat]}"`; });
            csvContent += "\n";
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Rekap_Nilai_${cls.name}_${subjectName}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('Rekap nilai CSV berhasil diunduh!', 'success');
    }
}

// Journal Module
function renderJournalModule(container) {
    const subjects = appState.subjects || [];
    const classes = appState.classes || [];
    const currentSub = appState.activeJournalSubjectId || '';
    const currentClass = appState.activeJournalClassId || '';
    const subObj = subjects.find(s => String(s.id) === String(currentSub));
    const classObj = classes.find(c => String(c.id) === String(currentClass));
    const filteredJournals = (currentSub && currentClass) ? (appState.journals || []).filter(j => String(j.subjectId) === String(currentSub) && String(j.classId) === String(currentClass)) : [];

    let contentHtml = '';

    if (!currentSub) {
        // Phase 1: Select Subject
        contentHtml = `
            <div class="max-w-xl mx-auto bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-5 text-center my-6">
                <div class="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto text-2xl">
                    <i class="fa-solid fa-book-open"></i>
                </div>
                <h3 class="font-bold text-slate-800 text-lg">Pilih Mata Pelajaran</h3>
                <p class="text-xs text-slate-500">Silakan pilih mata pelajaran untuk mulai memunculkan pilihan kartu jurnal kelas.</p>
                <div class="space-y-4 text-left pt-2">
                    <div>
                        <label class="block text-xs uppercase font-semibold text-slate-500 mb-1.5">Mata Pelajaran</label>
                        <select onchange="appState.activeJournalSubjectId = this.value; renderJournalModule(document.getElementById('view-container'))" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            <option value="">-- Pilih Mata Pelajaran --</option>
                            ${subjects.map(s => `<option value="${qbEscapeAttr(s.id)}">${qbEscapeHtml(s.name)} (${qbEscapeHtml(s.code || '')})</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>
        `;
    } else if (currentSub && !currentClass) {
        // Phase 2: Show Class Cards for Selected Subject
        contentHtml = `
            <div class="space-y-6">
                <!-- Selected Subject Bar -->
                <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center text-lg">
                            <i class="fa-solid fa-book-open-reader"></i>
                        </div>
                        <div>
                            <span class="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wide">Mata Pelajaran Terpilih</span>
                            <h2 class="text-sm font-bold text-emerald-900">${qbEscapeHtml(subObj ? subObj.name : '')} (${qbEscapeHtml(subObj ? subObj.code : '')})</h2>
                        </div>
                    </div>
                    <button type="button" onclick="appState.activeJournalSubjectId = ''; renderJournalModule(document.getElementById('view-container'))" class="px-3.5 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-emerald-200 font-bold rounded-xl text-xs transition cursor-pointer flex items-center space-x-1.5 shadow-sm">
                        <i class="fa-solid fa-arrow-left"></i><span>Ganti Mapel</span>
                    </button>
                </div>

                <div class="space-y-3">
                    <h3 class="font-bold text-slate-700 text-sm flex items-center space-x-2">
                        <i class="fa-solid fa-chalkboard-user text-emerald-600"></i>
                        <span>Pilih Kartu Kelas untuk Mengelola Jurnal</span>
                    </h3>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        ${classes.map(c => {
                            const count = (appState.journals || []).filter(j => String(j.subjectId) === String(currentSub) && String(j.classId) === String(c.id)).length;
                            return `
                                <div class="bg-white p-5 rounded-2xl border border-slate-100 hover:border-emerald-200 shadow-sm flex flex-col justify-between space-y-4 hover:shadow transition duration-200">
                                    <div class="flex items-start justify-between">
                                        <div class="space-y-1">
                                            <div class="text-slate-800 font-extrabold text-sm uppercase">${qbEscapeHtml(c.name)}</div>
                                            <div class="text-[10px] text-slate-400 font-medium">Angkatan: ${qbEscapeHtml(c.generation || '-')}</div>
                                        </div>
                                        <div class="px-2 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-[10px] font-extrabold text-emerald-700 whitespace-nowrap">
                                            ${count} Jurnal
                                        </div>
                                    </div>
                                    <button type="button" onclick="appState.activeJournalClassId = ${qbInlineArg(c.id)}; renderJournalModule(document.getElementById('view-container'))" class="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition cursor-pointer flex items-center justify-center space-x-1.5 shadow-sm">
                                        <i class="fa-solid fa-sliders"></i><span>Kelola & Generate Jurnal</span>
                                    </button>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    } else {
        // Phase 3: Manage journals for selected Subject + Class
        contentHtml = `
            <div class="space-y-6">
                <!-- Header Breadcrumb Info -->
                <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center text-lg">
                            <i class="fa-solid fa-list-check"></i>
                        </div>
                        <div>
                            <span class="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wide">Jurnal Mengajar Kelas</span>
                            <h2 class="text-sm font-bold text-emerald-900">${qbEscapeHtml(subObj ? subObj.name : '')} - Kelas ${qbEscapeHtml(classObj ? classObj.name : '')}</h2>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <button type="button" onclick="appState.activeJournalClassId = ''; renderJournalModule(document.getElementById('view-container'))" class="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-emerald-200 font-bold rounded-xl text-xs transition cursor-pointer flex items-center space-x-1.5 shadow-sm">
                            <i class="fa-solid fa-arrow-left"></i><span>Kembali Pilih Kelas</span>
                        </button>
                        <button type="button" onclick="downloadJournalAsWord()" class="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-bold rounded-xl text-xs transition cursor-pointer flex items-center space-x-1.5 shadow-sm">
                            <i class="fa-solid fa-file-word text-emerald-600"></i><span>Download Word</span>
                        </button>
                        <button type="button" onclick="openJournalModal()" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow transition cursor-pointer flex items-center space-x-1.5">
                            <i class="fa-solid fa-plus"></i><span>Tambah Jurnal</span>
                        </button>
                    </div>
                </div>

                <div class="space-y-4">
                    ${filteredJournals.length === 0 ? `
                        <div class="bg-white p-12 rounded-3xl text-center text-slate-400 text-sm border shadow-sm">
                            Belum ada jurnal mengajar untuk mata pelajaran dan kelas ini.<br>
                            Silakan klik <b>Tambah Jurnal</b> di atas untuk mencatat atau men-generate jurnal pertama Anda.
                        </div>
                    ` : filteredJournals.map(j => `
                        <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 hover:border-emerald-100 transition duration-150 space-y-3 relative group">
                            <div class="flex justify-between items-center">
                                <span class="text-xs font-bold text-emerald-700"><i class="fa-solid fa-calendar-days mr-1.5"></i>${qbEscapeHtml(j.date)}</span>
                                <div class="flex items-center gap-2">
                                    <span class="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-xl text-[10px] font-bold border border-emerald-100">Ketercapaian: ${qbEscapeHtml(j.achievement)}</span>
                                    <button type="button" onclick="openEditJournalModal(${qbInlineArg(j.id)})" class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs transition cursor-pointer" title="Edit Jurnal"><i class="fa-solid fa-pen-to-square"></i></button>
                                    <button type="button" onclick="deleteJournal(${qbInlineArg(j.id)})" class="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs transition cursor-pointer" title="Hapus Jurnal"><i class="fa-solid fa-trash"></i></button>
                                </div>
                            </div>
                            <h3 class="font-bold text-slate-800 text-base">Materi: ${qbEscapeHtml(j.material)}</h3>
                            <p class="text-xs text-slate-600 whitespace-pre-line leading-relaxed">${qbEscapeHtml(j.enrichment || '-')}</p>
                            ${j.notes ? `<p class="text-[11px] text-slate-400 italic mt-2">Catatan: ${qbEscapeHtml(j.notes)}</p>` : ''}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="space-y-6 pb-8">
            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 class="text-xl sm:text-2xl font-bold text-slate-800">Jurnal Mengajar Guru</h1>
                    <p class="text-xs text-slate-400 mt-1">Kelola dan generate laporan jurnal kegiatan belajar mengajar secara digital</p>
                </div>
            </div>

            ${contentHtml}
        </div>
    `;
}

window.onJournalSubjectChange = function(val) {};
window.onJournalClassChange = function(val) {};
window.submitJournalSelection = function() {};

function openJournalModal() {
    const modal = document.getElementById('modal-container');
    const todayStr = new Date().toISOString().split('T')[0];
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div id="modal-content-box" class="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-4">
                <div class="flex justify-between items-center"><h3 class="font-bold text-slate-800">Tambah Jurnal Mengajar</h3><button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg text-slate-400 hover:text-slate-600"></i></button></div>
                <form onsubmit="saveJournal(event)" class="space-y-3 text-xs sm:text-sm">
                    <div>
                        <label class="block text-xs uppercase text-slate-500 mb-1 font-semibold">Tanggal Kegiatan Jurnal</label>
                        <input type="date" id="j-date" value="${todayStr}" required class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl text-slate-800 font-medium">
                    </div>
                    <div><label class="block text-xs uppercase text-slate-500 mb-1 font-semibold">Materi / Topik</label><input type="text" id="j-mat" required placeholder="Contoh: Ketentuan Zakat Fitrah dan Maal" class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl"></div>
                    <div>
                        <div class="flex justify-between items-center mb-1">
                            <label class="block text-xs uppercase text-slate-500 font-semibold">Pengayaan / Uraian Kegiatan</label>
                            <div class="flex items-center space-x-1.5">
                                <button type="button" onclick="generateEnrichmentNonAI(event)" class="text-xs px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg border border-emerald-200 flex items-center space-x-1 cursor-pointer transition">
                                    <i class="fa-solid fa-calculator text-[10px]"></i><span>Isi Non-AI</span>
                                </button>
                                <button type="button" onclick="generateEnrichmentAI(event)" class="text-xs px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg border border-purple-200 flex items-center space-x-1 cursor-pointer transition">
                                    <i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i><span>Generate AI</span>
                                </button>
                            </div>
                        </div>
                        <textarea id="j-enrichment" rows="4" required placeholder="Uraian kegiatan pengayaan, pendalaman materi, dan tindak lanjut siswa..." class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl"></textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div><label class="block text-xs uppercase text-slate-500 mb-1 font-semibold">Ketercapaian</label><input type="text" id="j-ach" value="95%" required class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl"></div>
                        <div><label class="block text-xs uppercase text-slate-500 mb-1 font-semibold">Catatan Guru</label><input type="text" id="j-not" value="Siswa antusias dan aktif berdiskusi." required class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl"></div>
                    </div>
                    <div class="flex justify-end space-x-2 pt-2"><button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition">Batal</button><button type="submit" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold cursor-pointer shadow transition">Simpan Jurnal</button></div>
                </form>
            </div>
        </div>
    `;
}

function openEditJournalModal(id) {
    const journal = (appState.journals || []).find(j => String(j.id) === String(id));
    if (!journal) {
        showToast('Jurnal tidak ditemukan', 'error');
        return;
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const currentDate = journal.date || todayStr;
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div id="modal-content-box" class="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-4">
                <div class="flex justify-between items-center"><h3 class="font-bold text-slate-800">Edit Jurnal Mengajar</h3><button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg text-slate-400 hover:text-slate-600"></i></button></div>
                <form onsubmit="saveEditedJournal(event, ${qbInlineArg(journal.id)})" class="space-y-3 text-xs sm:text-sm">
                    <div>
                        <label class="block text-xs uppercase text-slate-500 mb-1 font-semibold">Tanggal Kegiatan Jurnal</label>
                        <input type="date" id="j-date" value="${qbEscapeAttr(currentDate)}" required class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl text-slate-800 font-medium">
                    </div>
                    <div><label class="block text-xs uppercase text-slate-500 mb-1 font-semibold">Materi / Topik</label><input type="text" id="j-mat" value="${qbEscapeAttr(journal.material || '')}" required class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl"></div>
                    <div>
                        <div class="flex justify-between items-center mb-1">
                            <label class="block text-xs uppercase text-slate-500 font-semibold">Pengayaan / Uraian Kegiatan</label>
                            <div class="flex items-center space-x-1.5">
                                <button type="button" onclick="generateEnrichmentNonAI(event)" class="text-xs px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg border border-emerald-200 flex items-center space-x-1 cursor-pointer transition">
                                    <i class="fa-solid fa-calculator text-[10px]"></i><span>Isi Non-AI</span>
                                </button>
                                <button type="button" onclick="generateEnrichmentAI(event)" class="text-xs px-2.5 py-1 bg-purple-50 hover:bg-purple-100 text-purple-700 font-bold rounded-lg border border-purple-200 flex items-center space-x-1 cursor-pointer transition">
                                    <i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i><span>Generate AI</span>
                                </button>
                            </div>
                        </div>
                        <textarea id="j-enrichment" rows="4" required class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl">${qbEscapeHtml(journal.enrichment || '')}</textarea>
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div><label class="block text-xs uppercase text-slate-500 mb-1 font-semibold">Ketercapaian</label><input type="text" id="j-ach" value="${qbEscapeAttr(journal.achievement || '95%')}" required class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl"></div>
                        <div><label class="block text-xs uppercase text-slate-500 mb-1 font-semibold">Catatan Guru</label><input type="text" id="j-not" value="${qbEscapeAttr(journal.notes || '')}" required class="w-full px-4 py-2.5 bg-slate-50 border rounded-2xl"></div>
                    </div>
                    <div class="flex justify-end space-x-2 pt-2"><button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition">Batal</button><button type="submit" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-semibold cursor-pointer shadow transition">Perbarui Jurnal</button></div>
                </form>
            </div>
        </div>
    `;
}

function generateEnrichmentNonAI(e) {
    if (e) e.preventDefault();
    const matInput = document.getElementById('j-mat');
    const topic = matInput ? matInput.value.trim() : '';
    if (!topic) {
        showToast('Mohon isi Materi / Topik terlebih dahulu!', 'error');
        if (matInput) matInput.focus();
        return;
    }

    const enrichmentTextarea = document.getElementById('j-enrichment');
    const standardText = `Kegiatan pembelajaran materi "${topic}" terlaksana secara interaktif dan kondusif. Peserta didik melakukan telaah literasi, diskusi kelompok kooperatif, dan mempresentasikan hasil pemahaman di depan kelas. Guru memberikan pendalaman konsep melalui studi kasus kontekstual, meluruskan miskonsepsi, serta memfasilitasi pengayaan bagi siswa yang telah tuntas capaian belajar.`;
    
    if (enrichmentTextarea) {
        enrichmentTextarea.value = standardText;
    }
    showToast('Berhasil mengisi uraian pengayaan Non-AI (Template Standar)!', 'success');
}

function saveEditedJournal(e, id) {
    e.preventDefault();
    if (!appState.journals) appState.journals = [];
    const idx = appState.journals.findIndex(j => String(j.id) === String(id));
    if (idx !== -1) {
        const selectedDate = document.getElementById('j-date')?.value || appState.journals[idx].date || new Date().toISOString().split('T')[0];
        appState.journals[idx].date = selectedDate;
        appState.journals[idx].material = document.getElementById('j-mat').value;
        appState.journals[idx].enrichment = document.getElementById('j-enrichment').value;
        appState.journals[idx].achievement = document.getElementById('j-ach').value;
        appState.journals[idx].notes = document.getElementById('j-not').value;
        saveState('journals');
        closeModal();
        showToast('Jurnal berhasil diperbarui!', 'success');
        renderJournalModule(document.getElementById('view-container'));
    }
}

function deleteJournal(id) {
    showConfirmModal('Apakah Anda yakin ingin menghapus jurnal ini?', async () => {
        appState.journals = (appState.journals || []).filter(j => String(j.id) !== String(id));
        saveState('journals');
        try {
            const response = await fetch(`/api/journals/${encodeURIComponent(id)}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
        } catch (err) {
            console.warn('Gagal menghapus jurnal di server:', err);
        }
        showToast('Jurnal berhasil dihapus!', 'success');
        renderJournalModule(document.getElementById('view-container'));
    });
}

async function generateEnrichmentAI(e) {
    const matInput = document.getElementById('j-mat');
    const topic = matInput ? matInput.value.trim() : '';
    if (!topic) {
        showToast('Mohon isi Materi / Topik terlebih dahulu untuk generate AI!', 'error');
        if (matInput) matInput.focus();
        return;
    }

    const enrichmentTextarea = document.getElementById('j-enrichment');
    const btn = e ? e.target.closest('button') : null;
    const originalHTML = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-1"></i> Generating...`;
    }

    try {
        const response = await fetch('/api/gemini/generate-enrichment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ topic })
        });
        const data = await response.json();
        if (data.success && data.text) {
            if (enrichmentTextarea) {
                enrichmentTextarea.value = data.text.trim();
            }
            showToast('Berhasil generate uraian pengayaan via AI!', 'success');
        } else {
            showToast(data.message || 'Gagal generate AI.', 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Terjadi kesalahan saat menghubungi server AI.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHTML;
        }
    }
}

function saveJournal(e) {
    e.preventDefault();
    const selectedDate = document.getElementById('j-date')?.value || new Date().toISOString().split('T')[0];
    appState.journals.push({
        id: 'J' + Date.now(),
        subjectId: appState.activeJournalSubjectId || (appState.subjects[0]?.id || ''),
        classId: appState.activeJournalClassId || '',
        date: selectedDate,
        material: document.getElementById('j-mat').value,
        enrichment: document.getElementById('j-enrichment').value,
        achievement: document.getElementById('j-ach').value,
        notes: document.getElementById('j-not').value
    });
    saveState('journals');
    closeModal();
    showToast('Jurnal berhasil disimpan!');
    renderJournalModule(document.getElementById('view-container'));
}

function downloadJournalAsWord() {
    const currentSub = appState.activeJournalSubjectId || (appState.subjects[0]?.id || '');
    const currentClass = appState.activeJournalClassId || '';
    const subObj = (appState.subjects || []).find(s => String(s.id) === String(currentSub));
    const classObj = (appState.classes || []).find(c => String(c.id) === String(currentClass));
    if (!subObj) {
        showToast('Mata pelajaran tidak ditemukan.', 'error');
        return;
    }
    const filteredJournals = (appState.journals || []).filter(j => String(j.subjectId) === String(currentSub) && String(j.classId) === String(currentClass));
    if (filteredJournals.length === 0) {
        showToast('Tidak ada data jurnal untuk diunduh.', 'error');
        return;
    }

    const schoolName = appState.settings?.schoolName || 'Madrasah Aliyah';
    const teacherName = appState.currentUser?.name || '-';

    let tableRows = '';
    filteredJournals.forEach((j, index) => {
        tableRows += `
            <tr>
                <td style="border: 1px solid #000000; padding: 8px; text-align: center;">${index + 1}</td>
                <td style="border: 1px solid #000000; padding: 8px; text-align: center; white-space: nowrap;">${j.date}</td>
                <td style="border: 1px solid #000000; padding: 8px;">${j.material}</td>
                <td style="border: 1px solid #000000; padding: 8px;">${j.enrichment ? j.enrichment.replace(/\\n/g, '<br>').replace(/\n/g, '<br>') : '-'}</td>
                <td style="border: 1px solid #000000; padding: 8px; text-align: center;">${j.achievement}</td>
                <td style="border: 1px solid #000000; padding: 8px;">${j.notes || '-'}</td>
            </tr>
        `;
    });

    const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset="utf-8">
            <title>Jurnal Mengajar - ${subObj.name} - Kelas ${classObj ? classObj.name : ''}</title>
            <style>
                body { font-family: 'Arial', sans-serif; line-height: 1.5; color: #000000; }
                h1 { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 5px; }
                .subtitle { text-align: center; font-size: 14px; margin-bottom: 25px; font-weight: bold; }
                .meta-table { width: 100%; margin-bottom: 20px; border-collapse: collapse; }
                .meta-table td { font-size: 12px; padding: 4px 0; border: none; }
                .journal-table { width: 100%; border-collapse: collapse; margin-top: 15px; }
                .journal-table th { background-color: #f2f2f2; border: 1px solid #000000; padding: 10px 8px; font-size: 12px; font-weight: bold; text-align: center; }
                .journal-table td { font-size: 11px; }
            </style>
        </head>
        <body>
            <h1>JURNAL MENGAJAR GURU</h1>
            <div class="subtitle">${schoolName.toUpperCase()}</div>

            <table class="meta-table">
                <tr>
                    <td style="width: 15%; font-weight: bold;">Mata Pelajaran</td>
                    <td style="width: 2%;">:</td>
                    <td style="width: 48%;">${subObj.name} (${subObj.code})</td>
                    <td style="width: 15%; font-weight: bold;">Guru Pengampu</td>
                    <td style="width: 2%;">:</td>
                    <td style="width: 18%;">${teacherName}</td>
                </tr>
                <tr>
                    <td style="font-weight: bold;">Kelas</td>
                    <td>:</td>
                    <td>${classObj ? classObj.name : '-'}</td>
                    <td style="font-weight: bold;">Tanggal Unduh</td>
                    <td>:</td>
                    <td>${new Date().toISOString().split('T')[0]}</td>
                </tr>
                <tr>
                    <td style="font-weight: bold;">Jumlah Jurnal</td>
                    <td>:</td>
                    <td>${filteredJournals.length} Jurnal</td>
                    <td></td>
                    <td></td>
                    <td></td>
                </tr>
            </table>

            <table class="journal-table">
                <thead>
                    <tr>
                        <th style="width: 5%; border: 1px solid #000000;">No</th>
                        <th style="width: 15%; border: 1px solid #000000;">Tanggal</th>
                        <th style="width: 25%; border: 1px solid #000000;">Materi / Topik Pembelajaran</th>
                        <th style="width: 35%; border: 1px solid #000000;">Pengayaan / Uraian Kegiatan</th>
                        <th style="width: 10%; border: 1px solid #000000;">Ketercapaian</th>
                        <th style="width: 10%; border: 1px solid #000000;">Catatan</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob(['\\ufeff' + htmlContent], {
        type: 'application/msword'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Jurnal_Mengajar_${subObj.name.replace(/[^a-zA-Z0-9]/g, '_')}_Kelas_${classObj ? classObj.name.replace(/[^a-zA-Z0-9]/g, '_') : ''}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Manual Single Question Addition & Editing
function openAddSingleQuestionModal(code) {
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div class="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-6 space-y-4 my-8">
                <div class="flex justify-between items-center pb-2 border-b">
                    <h3 class="font-bold text-slate-800 text-base flex items-center space-x-2">
                        <i class="fa-solid fa-plus-circle text-blue-600"></i>
                        <span>Tambah Soal Manual (${code})</span>
                    </h3>
                    <button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg text-slate-400 hover:text-slate-600"></i></button>
                </div>
                <form onsubmit="saveSingleQuestion(event, '${code}')" class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Jenis Soal</label>
                        <select id="single-q-type" onchange="toggleSingleQTypeOptions()" class="w-full p-2.5 bg-slate-50 border rounded-2xl text-xs font-semibold focus:ring-2 focus:ring-blue-500">
                            <option value="mc">Pilihan Ganda (PG)</option>
                            <option value="essay">Uraian / Essay</option>
                        </select>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Teks Soal (Dukungan Formula Math $ ... $)</label>
                        <textarea id="single-q-text" rows="3" required class="w-full p-3 bg-slate-50 border rounded-2xl text-xs focus:ring-2 focus:ring-blue-500" placeholder="Ketik butir soal di sini... Gunakan $2x + 5 = 15$ untuk rumus matematika."></textarea>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Gambar Soal (Opsional)</label>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input type="text" id="single-q-image-url" class="p-2.5 bg-slate-50 border rounded-2xl text-xs" placeholder="URL Gambar (http/https)..."/>
                            <input type="file" id="single-q-image-file" accept="image/*" onchange="handleSingleQImageUpload(event)" class="text-xs text-slate-500 file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"/>
                        </div>
                        <input type="hidden" id="single-q-image-base64" value=""/>
                        <div id="single-q-img-preview" class="hidden mt-2">
                            <img src="" id="single-q-preview-img" class="max-h-32 rounded-xl border object-contain"/>
                        </div>
                    </div>

                    <div id="single-q-options-container" class="space-y-2">
                        <label class="block text-xs font-bold text-slate-700 uppercase">Opsi Jawaban & Kunci</label>
                        <div class="grid grid-cols-1 gap-2">
                            <div class="flex items-center space-x-2">
                                <span class="w-6 font-bold text-xs text-slate-600">A.</span>
                                <input type="text" id="opt-A" class="flex-1 p-2 bg-slate-50 border rounded-xl text-xs" placeholder="Pilihan A"/>
                            </div>
                            <div class="flex items-center space-x-2">
                                <span class="w-6 font-bold text-xs text-slate-600">B.</span>
                                <input type="text" id="opt-B" class="flex-1 p-2 bg-slate-50 border rounded-xl text-xs" placeholder="Pilihan B"/>
                            </div>
                            <div class="flex items-center space-x-2">
                                <span class="w-6 font-bold text-xs text-slate-600">C.</span>
                                <input type="text" id="opt-C" class="flex-1 p-2 bg-slate-50 border rounded-xl text-xs" placeholder="Pilihan C"/>
                            </div>
                            <div class="flex items-center space-x-2">
                                <span class="w-6 font-bold text-xs text-slate-600">D.</span>
                                <input type="text" id="opt-D" class="flex-1 p-2 bg-slate-50 border rounded-xl text-xs" placeholder="Pilihan D"/>
                            </div>
                            <div class="flex items-center space-x-2">
                                <span class="w-6 font-bold text-xs text-slate-600">E.</span>
                                <input type="text" id="opt-E" class="flex-1 p-2 bg-slate-50 border rounded-xl text-xs" placeholder="Pilihan E"/>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase mb-1" id="single-q-ans-label">Kunci Jawaban</label>
                        <input type="text" id="single-q-answer" required class="w-full p-2.5 bg-slate-50 border rounded-2xl text-xs font-semibold focus:ring-2 focus:ring-blue-500" placeholder="Ketik kunci jawaban (Misal: A, B, C... atau teks esay)"/>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-slate-700 uppercase mb-1">Pembahasan / Penjelasan (Opsional)</label>
                        <textarea id="single-q-explanation" rows="2" class="w-full p-2.5 bg-slate-50 border rounded-2xl text-xs" placeholder="Penjelasan pembahasan soal..."></textarea>
                    </div>

                    <div class="flex justify-end space-x-2 pt-2 border-t">
                        <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold">Batal</button>
                        <button type="submit" class="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow">Simpan Soal</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function toggleSingleQTypeOptions() {
    const type = document.getElementById('single-q-type').value;
    const optContainer = document.getElementById('single-q-options-container');
    const ansLabel = document.getElementById('single-q-ans-label');
    const ansInput = document.getElementById('single-q-answer');

    if (type === 'essay') {
        if (optContainer) optContainer.classList.add('hidden');
        if (ansLabel) ansLabel.innerText = 'Kunci Jawaban Essay';
        if (ansInput) ansInput.placeholder = 'Ketik uraian jawaban kunci essay...';
    } else {
        if (optContainer) optContainer.classList.remove('hidden');
        if (ansLabel) ansLabel.innerText = 'Kunci Jawaban (Opsi A/B/C/D/E atau Teks Opsi)';
        if (ansInput) ansInput.placeholder = 'Ketik A, B, C, D, atau E...';
    }
}

function handleSingleQImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(evt) {
        document.getElementById('single-q-image-base64').value = evt.target.result;
        const previewDiv = document.getElementById('single-q-img-preview');
        const previewImg = document.getElementById('single-q-preview-img');
        if (previewDiv && previewImg) {
            previewImg.src = evt.target.result;
            previewDiv.classList.remove('hidden');
        }
    };
    reader.readAsDataURL(file);
}

function openEditSingleQuestionModal(qId) {
    const q = (appState.questionBank || []).find(item => String(item.id) === String(qId));
    if (!q) return;

    openAddSingleQuestionModal(q.code);

    setTimeout(() => {
        const typeEl = document.getElementById('single-q-type');
        const textEl = document.getElementById('single-q-text');
        const imgUrlEl = document.getElementById('single-q-image-url');
        const imgBase64El = document.getElementById('single-q-image-base64');
        const optA = document.getElementById('opt-A');
        const optB = document.getElementById('opt-B');
        const optC = document.getElementById('opt-C');
        const optD = document.getElementById('opt-D');
        const optE = document.getElementById('opt-E');
        const ansEl = document.getElementById('single-q-answer');
        const expEl = document.getElementById('single-q-explanation');

        if (typeEl) typeEl.value = q.type || 'mc';
        if (textEl) textEl.value = q.question || '';
        if (imgUrlEl) imgUrlEl.value = (q.imageUrl && !q.imageUrl.startsWith('data:')) ? q.imageUrl : '';
        if (imgBase64El) imgBase64El.value = q.imageUrl || q.image || '';

        if (q.imageUrl || q.image) {
            const previewDiv = document.getElementById('single-q-img-preview');
            const previewImg = document.getElementById('single-q-preview-img');
            if (previewDiv && previewImg) {
                previewImg.src = q.imageUrl || q.image;
                previewDiv.classList.remove('hidden');
            }
        }

        if (q.options && q.options.length > 0) {
            if (optA) optA.value = q.options[0] || '';
            if (optB) optB.value = q.options[1] || '';
            if (optC) optC.value = q.options[2] || '';
            if (optD) optD.value = q.options[3] || '';
            if (optE) optE.value = q.options[4] || '';
        }

        if (ansEl) ansEl.value = q.answer || '';
        if (expEl) expEl.value = q.explanation || '';

        toggleSingleQTypeOptions();

        // Update form submission to edit mode
        const form = document.querySelector('#modal-container form');
        if (form) {
            form.onsubmit = function(e) { saveSingleQuestion(e, q.code, q.id); };
        }
    }, 50);
}

function saveSingleQuestion(e, code, editQId = null) {
    e.preventDefault();
    const type = document.getElementById('single-q-type').value;
    const questionText = document.getElementById('single-q-text').value.trim();
    const imgUrl = document.getElementById('single-q-image-url').value.trim();
    const imgBase64 = document.getElementById('single-q-image-base64').value;
    const finalImage = imgBase64 || imgUrl || '';

    const optA = document.getElementById('opt-A').value.trim();
    const optB = document.getElementById('opt-B').value.trim();
    const optC = document.getElementById('opt-C').value.trim();
    const optD = document.getElementById('opt-D').value.trim();
    const optE = document.getElementById('opt-E').value.trim();

    let options = [];
    if (type === 'mc') {
        options = [optA, optB, optC, optD, optE].filter(o => o !== '');
        if (options.length === 0) options = ['A', 'B', 'C', 'D', 'E'];
    }

    let answerKey = (document.getElementById('single-q-answer')?.value || '').trim();
    // Normalize A/B/C/D/E to option text if matching option index
    if (type === 'mc') {
        const keyUpper = answerKey.toUpperCase();
        if (['A', 'B', 'C', 'D', 'E'].includes(keyUpper)) {
            const idx = keyUpper.charCodeAt(0) - 65;
            if (options[idx]) answerKey = options[idx];
        }
    }

    const explanation = (document.getElementById('single-q-explanation')?.value || '').trim();
    const group = (appState.questionBankGroups || []).find(bg => String(bg.code) === String(code));

    if (editQId) {
        if (!Array.isArray(appState.questionBank)) appState.questionBank = [];
        const idx = appState.questionBank.findIndex(item => String(item.id) === String(editQId));
        if (idx !== -1) {
            appState.questionBank[idx] = {
                ...appState.questionBank[idx],
                type,
                question: questionText,
                imageUrl: finalImage,
                options,
                answer: answerKey,
                explanation
            };
            showToast('Soal berhasil diperbarui!', 'success');
        }
    } else {
        const newId = 'Q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
        appState.questionBank.push({
            id: newId,
            code,
            subjectId: group ? group.subjectId : (appState.subjects[0]?.id || ''),
            classId: group ? group.classId : (appState.classes[0]?.id || ''),
            type,
            question: questionText,
            imageUrl: finalImage,
            options,
            answer: answerKey,
            explanation
        });
        showToast('Soal berhasil ditambahkan!', 'success');
    }

    saveState('questionBank');
    closeModal();
    renderQuestionBankModule(document.getElementById('view-container'));
}

// ==========================================
// Extraordinary CBT Template Question Converter
// ==========================================
let currentConvertedData = null;

const RAW_LATEX_COMMAND_PATTERN = /\\(?:frac|dfrac|tfrac|sqrt|int|iint|iiint|oint|sum|prod|lim|log|ln|sin|cos|tan|cot|sec|csc|alpha|beta|gamma|delta|theta|lambda|mu|pi|rho|sigma|phi|omega|infty|pm|mp|times|div|cdot|le|ge|neq|ne|approx|equiv|angle|vec|overline|underline|bar|hat|binom|left|right)\b/i;

function isPredominantlyLatexMath(value) {
    if (!value || !RAW_LATEX_COMMAND_PATTERN.test(String(value))) return false;

    let probe = String(value)
        .replace(/<[^>]+>/g, ' ')
        .replace(/\\\(|\\\)|\\\[|\\\]|\$\$/g, ' ')
        .replace(/\$/g, ' ')
        .replace(/\\[a-zA-Z]+\*?/g, ' ')
        .replace(/[{}\[\]()0-9_^=+\-*\/<>.,:;!?|&%~'"`\\]/g, ' ')
        .replace(/\b(?:dx|dy|dz|dt|du|dv|dw)\b/gi, ' ')
        .replace(/\b(?:sin|cos|tan|cot|sec|csc|log|ln|max|min|mod|gcd|lcm)\b/gi, ' ');

    const proseWords = probe.match(/\p{L}{3,}/gu) || [];
    return proseWords.length === 0;
}

function stripMathDelimitersForSingleExpression(value) {
    return String(value)
        .replace(/\$\$/g, '')
        .replace(/\$/g, '')
        .replace(/\\\(/g, '')
        .replace(/\\\)/g, '')
        .replace(/\\\[/g, '')
        .replace(/\\\]/g, '')
        .trim();
}

function autoConvertMathToLatex(str) {
    if (!str || typeof str !== 'string') return str;

    let text = str;

    // Step -1: Protect HTML tags (e.g. <img src="..." />, <br>, etc.)
    const protectedHtml = [];
    text = text.replace(/<[^>]+>/g, (match) => {
        protectedHtml.push(match);
        return `___HTML_TAG_${protectedHtml.length - 1}___`;
    });

    // Step 0: Pre-normalization of Word / MathType field artifacts (〖 and 〗 are field markers in MS Word, strip them)
    text = text.replace(/[〖〗【】⟦⟧〔〕]/g, '');
    text = text.replace(/[\u2212\u2013\u2014]/g, '-'); // Unicode minus and dashes -> '-'
    text = text.replace(/²/g, '^2').replace(/³/g, '^3').replace(/¹/g, '^1').replace(/⁰/g, '^0');

    // Helper to format math inner content cleanly before LaTeX wrapping
    function formatLatexMath(mathStr) {
        if (!mathStr) return '';
        let res = mathStr.trim();
        // Remove Word field delimiter artifacts inside
        res = res.replace(/[〖〗【】⟦⟧〔〕]/g, '');
        // Convert multi-digit/multi-char exponents: ^15 -> ^{15}, ^-3 -> ^{-3}, ^2x -> ^{2x}
        res = res.replace(/\^([0-9]{2,}|-[0-9]+|[a-zA-Z0-9\+\-\*]{2,})/g, '^{$1}');
        // Convert unicode / plain math operators to LaTeX commands
        res = res.replace(/×/g, ' \\times ');
        res = res.replace(/÷/g, ' \\div ');
        res = res.replace(/·/g, ' \\cdot ');
        res = res.replace(/≤/g, ' \\le ');
        res = res.replace(/≥/g, ' \\ge ');
        res = res.replace(/≠/g, ' \\ne ');
        res = res.replace(/±/g, ' \\pm ');
        res = res.replace(/°/g, '^\\circ ');
        res = res.replace(/∞/g, ' \\infty ');
        res = res.replace(/π/g, ' \\pi ');
        // Format fractions like (a+b)/(c+d) or 3/4 if not already \frac
        if (!res.includes('\\frac')) {
            res = res.replace(/\(([^)]+)\)\/\(([^)]+)\)/g, '\\frac{$1}{$2}');
            res = res.replace(/\(([^)]+)\)\/([a-zA-Z0-9]+)/g, '\\frac{$1}{$2}');
            res = res.replace(/\b([a-zA-Z0-9]+)\/\(([^)]+)\)/g, '\\frac{$1}{$2}');
        }
        // Normalize spaces around '='
        res = res.replace(/\s*=\s*/g, ' = ');
        // Clean up redundant spaces
        res = res.replace(/\s+/g, ' ').trim();
        return res;
    }

    // Helper to protect generated LaTeX blocks immediately
    const protectedLatex = [];
    function wrapAndProtect(innerStr) {
        if (!innerStr) return '';
        let clean = innerStr.trim();
        // Remove trailing punctuation like '.', '?', ',', ';' if accidentally captured at the end of the math block
        let trailingPunct = '';
        const punctMatch = clean.match(/([\.\,\?\;\:]+)$/);
        if (punctMatch) {
            trailingPunct = punctMatch[1];
            clean = clean.slice(0, -trailingPunct.length).trim();
        }
        if (!clean) return trailingPunct;

        const formatted = formatLatexMath(clean);
        protectedLatex.push(`\\(${formatted}\\)`);
        return `___LATEX_BLOCK_${protectedLatex.length - 1}___${trailingPunct}`;
    }

    // Step 0.5: Treat a math-only raw LaTeX line as one expression.
    // This fixes mixed input such as: \(x^2\) \frac{3}{4} + \sqrt{\(x^2+y^2\)}.
    // Existing delimiters inside the same math-only line are removed before one clean wrapper is added.
    if (isPredominantlyLatexMath(text)) {
        text = wrapAndProtect(stripMathDelimitersForSingleExpression(text));
    }

    // Step 1: Protect ALREADY EXISTING LaTeX blocks \( ... \), \[ ... \], $ ... $, $ ... $
    text = text.replace(/\$\$(.*?)\$\$/g, (m, inner) => wrapAndProtect(inner));
    text = text.replace(/\$([^\$\n]+)\$/g, (m, inner) => wrapAndProtect(inner));
    text = text.replace(/\\\(([\s\S]*?)\\\)/g, (m, inner) => wrapAndProtect(inner));
    text = text.replace(/\\\[([\s\S]*?)\\\]/g, (m, inner) => wrapAndProtect(inner));

    // Step 2: Fractions (e.g. (3x-1)/(x+2), (x-2)/5, 1/2(x+3), 3/4)
    text = text.replace(/\(([^)]+)\)\/\(([^)]+)\)/g, (match, num, den) => {
        return wrapAndProtect(`\\frac{${num.trim()}}{${den.trim()}}`);
    });
    text = text.replace(/\(([^)]+)\)\/([a-zA-Z0-9]+)/g, (match, num, den) => {
        return wrapAndProtect(`\\frac{${num.trim()}}{${den.trim()}}`);
    });
    text = text.replace(/\b([a-zA-Z0-9]+)\/\(([^)]+)\)/g, (match, num, den) => {
        return wrapAndProtect(`\\frac{${num.trim()}}{${den.trim()}}`);
    });
    text = text.replace(/\b(\d+)\/(\d+)\s*\(([^)]+)\)/g, (match, num, den, rest) => {
        return wrapAndProtect(`\\frac{${num}}{${den}}(${rest.trim()})`);
    });

    // Step 3: Factorials & Factorial Arithmetic (e.g. 4!+5!-3!, 5! / (5-2)!, n!/(k!(n-k)!), 4! + 5! - 3!)
    const factorialExprRegex = /((?:(?:\d+|\([^\)]+\)|[a-zA-Z]+)\!+)(?:\s*[\+\-\*\:\/x×÷\=]\s*(?:\d+|\([^\)]+\)|[a-zA-Z]+)\!*)+)/g;
    text = text.replace(factorialExprRegex, (match) => {
        return wrapAndProtect(match);
    });
    text = text.replace(/((?:\d+|\([^\)]+\)|[a-zA-Z]+)\!+)/g, (match) => {
        return wrapAndProtect(match);
    });

    // Step 4: Logarithms (e.g. ^2log 16, ^5log 25, ^3log(27), log_2(16))
    text = text.replace(/\^(\d+)\s*(?:log|Log)\s*(\(?\d+\)?|[a-zA-Z]+)/gi, (match, base, val) => {
        return wrapAndProtect(`^${base}\\log ${val}`);
    });
    text = text.replace(/\b(?:log|Log)_(\d+|[a-zA-Z])\s*\(([^)]+)\)/gi, (match, base, val) => {
        return wrapAndProtect(`\\log_{${base}}(${val.trim()})`);
    });

    // Step 5: Permutations & Combinations (e.g. 5P2, 5C2, P(5,2), C(5,2), nPr, nCr)
    text = text.replace(/\b(\d+|[a-zA-Z])\s*([PC])\s*(\d+|[a-zA-Z])\b/g, (match, n, type, r) => {
        return wrapAndProtect(`_{${n}}${type}_{${r}}`);
    });
    text = text.replace(/\b([PC])\s*\(\s*([^,\)]+)\s*,\s*([^,\)]+)\s*\)/g, (match, type, n, r) => {
        return wrapAndProtect(`${type}(${n.trim()}, ${r.trim()})`);
    });

    // Step 6: Trigonometric functions (e.g. sin 30°, cos 45°, tan x, sin(2x), cos(x+y), sin^2 x)
    text = text.replace(/\b(sin|cos|tan|cot|sec|csc|cosec)(?:\^2)?\s*\(\s*([^)]+)\s*\)/gi, (match, fn, arg) => {
        return wrapAndProtect(`\\${fn.toLowerCase()}(${arg.trim()})`);
    });
    text = text.replace(/\b(sin|cos|tan|cot|sec|csc|cosec)\s*(\d+(?:[\.,]\d+)?°?|\^o|[a-zA-Z0-9\^\circ]+)/gi, (match, fn, arg) => {
        let cleanArg = arg;
        if (/°|\^o|\^\{?\\circ\}?/.test(cleanArg)) {
            cleanArg = cleanArg.replace(/°|\^o|\^\{?\\circ\}?/, '') + '^\\circ';
        }
        return wrapAndProtect(`\\${fn.toLowerCase()} ${cleanArg}`);
    });

    // Step 7: Square roots (e.g. sqrt(x), sqrt(x^2+1), √x, √(2x+3), ^3√27)
    text = text.replace(/(?:sqrt|√)\s*\(([^)]+)\)/gi, (match, inner) => {
        return wrapAndProtect(`\\sqrt{${inner.trim()}}`);
    });
    text = text.replace(/(?:sqrt|√)\s*([a-zA-Z0-9]+)/gi, (match, inner) => {
        return wrapAndProtect(`\\sqrt{${inner.trim()}}`);
    });

    // Step 8: Angles & Geometric Notation (e.g. ∠ ACB, ∠AOB, \angle ABC)
    text = text.replace(/(?:∠|\\angle)\s*([A-Za-z0-9]+)/g, (match, name) => {
        return wrapAndProtect(`\\angle ${name}`);
    });

    // Step 9: Inverse functions & Function Compositions (e.g. f^-1(x), (f o g)(x), (fog)(x))
    text = text.replace(/\b([a-zA-Z])\^\{?-1\}?\(([a-zA-Z0-9]+)\)/g, (match, fName, varName) => {
        return wrapAndProtect(`${fName}^{-1}(${varName})`);
    });
    text = text.replace(/\(([a-zA-Z])\s*(?:o|\\circ)\s*([a-zA-Z])\)\(([a-zA-Z0-9]+)\)/g, (match, f1, f2, arg) => {
        return wrapAndProtect(`(${f1}\\circ ${f2})(${arg})`);
    });
    text = text.replace(/\(fog\)\(([a-zA-Z0-9]+)\)/gi, (match, arg) => {
        return wrapAndProtect(`(f\\circ g)(${arg})`);
    });
    text = text.replace(/\(gof\)\(([a-zA-Z0-9]+)\)/gi, (match, arg) => {
        return wrapAndProtect(`(g\\circ f)(${arg})`);
    });

    // Step 10: General Equations, Inequalities, Multi-term Arithmetic & Exponent Expressions
    // E.g. 3^2×81=3^n, (32b)^15, 2x^2 - 5x + 3 = 0, U_n = a + (n-1)b, 2x + 3y ≤ 12
    const masterMathRegex = /((?:(?:\([^\)]+\)|\b[0-9a-zA-Z\_]+)\s*[\^\_\!°√×÷\:\+\-\*\/\=\<\>≤≥≠±\~]\s*)+(?:\([^\)]+\)|\b[0-9a-zA-Z\^\_\!°√×÷\:\+\-\*\/\=\<\>≤≥≠±\~]+))/g;
    text = text.replace(masterMathRegex, (match) => {
        const trimmed = match.trim();
        // Ignore Indonesian common word combinations
        if (/^(i|ii|iii|iv|v|vi|a|b|c|d|e|dan|atau|maka|jika|pada|adalah|ke|di|yang|dengan|untuk|nilai|dari|hasil|banyak|titik|persamaan|fungsi|diketahui|tentukan|suku|jumlah)$/i.test(trimmed)) return match;
        if (!/[\d\^\!\_a-zA-Z\=\+\-\*\:\/×÷≤≥≠±]/.test(trimmed)) return match;
        return wrapAndProtect(trimmed);
    });

    // Step 11: Standalone Powers, Exponents & Subscripts (e.g. (32b)^15, x^2, 3^n, x_1, U_n)
    text = text.replace(/(\([a-zA-Z0-9\s\+\-\*]+\)\^\{?\-?[a-zA-Z0-9\+\-]+\}?)/g, (match) => {
        return wrapAndProtect(match);
    });
    text = text.replace(/\b([0-9]*[a-zA-Z0-9]\^\{?\-?[a-zA-Z0-9\+\-]+\}?)\b/g, (match) => {
        return wrapAndProtect(match);
    });
    text = text.replace(/\b([a-zA-Z])_\{?([a-zA-Z0-9\+\-]+)\}?\b/g, (match, v, sub) => {
        return wrapAndProtect(`${v}_{${sub}}`);
    });

    // Step 12: Standalone Degrees (e.g. 24,5°, 27,5°, 50°, 90°)
    text = text.replace(/(\d+(?:[\.,]\d+)?)\s*(?:°|\^o|\^\{?\\circ\}?)/g, (match, num) => {
        return wrapAndProtect(`${num}^\\circ`);
    });

    // Step 13: Restore protected LaTeX blocks
    text = text.replace(/___LATEX_BLOCK_(\d+)___/g, (match, idx) => {
        return protectedLatex[idx] || match;
    });

    // Step 14: Restore protected HTML tags
    text = text.replace(/___HTML_TAG_(\d+)___/g, (match, idx) => {
        return protectedHtml[idx] || match;
    });

    // Step 15: Cleanup any redundant double wrapping or broken braces
    text = text.replace(/\\\\\(/g, '\\(').replace(/\\\\\)/g, '\\)');
    text = text.replace(/\\\(\s*\\\((.*?)\\\)\s*\\\)/g, '\\($1\\)');
    text = text.replace(/\\\(\s*\$\s*(.*?)\s*\$\s*\\\)/g, '\\($1\\)');

    return text;
}

function openConvertQuestionModal(activeCode = '') {
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-5 overflow-y-auto">
            <div class="bg-white w-full max-w-4xl rounded-3xl shadow-2xl p-5 sm:p-6 space-y-5 my-6 max-h-[92vh] flex flex-col">
                <!-- Modal Header -->
                <div class="flex justify-between items-center pb-3 border-b shrink-0">
                    <div>
                        <h3 class="font-bold flex items-center space-x-2 text-slate-800 text-base sm:text-lg">
                            <i class="fa-solid fa-arrows-rotate text-indigo-600"></i>
                            <span>Convert Soal ke Template Extraordinary CBT</span>
                        </h3>
                        <p class="text-xs text-slate-500 mt-0.5">Konversi otomatis teks soal menjadi format tabel Extraordinary CBT dengan rumus Matematika ter-LaTeX otomatis.</p>
                    </div>
                    <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition cursor-pointer"><i class="fa-solid fa-xmark text-sm"></i></button>
                </div>

                <!-- Modal Body -->
                <div class="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
                    <!-- Config Controls -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                        <div>
                            <label class="block font-bold text-slate-700 mb-1">Tipe Soal [TS]</label>
                            <select id="cvt-ts" class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs focus:ring-2 focus:ring-indigo-500">
                                <option value="PG">PG (Pilihan Ganda)</option>
                                <option value="PGX">PGX (Pilihan Ganda Kompleks)</option>
                                <option value="ESY">ESY (Esay / Uraian)</option>
                                <option value="SKT">SKT (Isian Singkat)</option>
                                <option value="JD">JD (Menjodohkan 1-1)</option>
                                <option value="BNR">BNR (Benar / Salah)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block font-bold text-slate-700 mb-1">Jumlah Opsi PG</label>
                            <select id="cvt-opt-count" class="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl font-bold text-xs focus:ring-2 focus:ring-indigo-500 text-indigo-900">
                                <option value="5">5 Opsi (A, B, C, D, E)</option>
                                <option value="4">4 Opsi (A, B, C, D)</option>
                            </select>
                        </div>
                        <div>
                            <label class="block font-bold text-slate-700 mb-1">Kode KD [KD]</label>
                            <input type="text" id="cvt-kd" value="1.0.1" class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-mono text-xs focus:ring-2 focus:ring-indigo-500"/>
                        </div>
                        <div>
                            <label class="block font-bold text-slate-700 mb-1">Default Kunci [KJ]</label>
                            <select id="cvt-kj" class="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs focus:ring-2 focus:ring-indigo-500">
                                <option value="A">A</option>
                                <option value="B">B</option>
                                <option value="C">C</option>
                                <option value="D">D</option>
                                <option value="E">E</option>
                            </select>
                        </div>
                        <div>
                            <label class="block font-bold text-slate-700 mb-1">Mode Deteksi Soal</label>
                            <select id="cvt-mode" class="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl font-bold text-xs focus:ring-2 focus:ring-indigo-500 text-indigo-900">
                                <option value="auto">Deteksi Otomatis (Smart Auto-Detect: 1., A., B...)</option>
                                <option value="enter">Per-Enter / Baris (Setiap Enter = Kolom Selanjutnya)</option>
                            </select>
                        </div>
                    </div>

                    <!-- Auto LaTeX Options -->
                    <div class="bg-indigo-50/80 p-3 rounded-2xl border border-indigo-100 flex flex-wrap items-center justify-between gap-2">
                        <label class="flex items-center space-x-2 text-indigo-900 font-bold cursor-pointer select-none">
                            <input type="checkbox" id="cvt-auto-math" checked class="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"/>
                            <span class="flex items-center space-x-1.5">
                                <i class="fa-solid fa-square-root-variable text-indigo-600 text-sm"></i>
                                <span>Auto-Convert Rumus Matematika ke LaTeX \\(...\\)</span>
                            </span>
                        </label>
                        <span class="text-[11px] text-indigo-600 italic">Deteksi fungsi, persamaan, pangkat, pecahan, sudut, dan derajat secara otomatis.</span>
                    </div>

                    <!-- Input Area Header & Actions -->
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <span class="font-bold text-slate-700 text-xs">Tempel / Copas Teks Soal ATAU Import File Word:</span>
                        <div class="flex flex-wrap items-center gap-2">
                            <label class="px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-sm border border-blue-200">
                                <i class="fa-solid fa-file-word text-blue-600"></i>
                                <span>Import File Word (.docx)</span>
                                <input type="file" id="cvt-word-input" accept=".docx, .doc, .txt, .html, .htm" onchange="handleConvertWordFileUpload(event)" class="hidden" />
                            </label>
                            ${activeCode ? `
                                <button type="button" onclick="loadActiveBankQuestionsToConvert(${qbInlineArg(activeCode)})" class="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 font-bold rounded-xl text-xs transition flex items-center space-x-1.5 cursor-pointer shadow-sm">
                                    <i class="fa-solid fa-file-import"></i><span>Muat Soal dari Bank Soal (${activeCode})</span>
                                </button>
                            ` : ''}
                        </div>
                    </div>

                    <div>
                        <textarea id="cvt-raw-text" rows="8" class="w-full p-3 bg-slate-50 border border-slate-300 rounded-2xl text-xs font-mono focus:bg-white focus:ring-2 focus:ring-indigo-500 transition leading-relaxed" placeholder="Tempel/Copas seluruh soal atau upload file Word di sini...&#10;&#10;Contoh format soal matematika:&#10;1. Jika f(x) = x^2 + 3x dan g(x) = 2x - 5, maka nilai (f+g)(x) adalah ....&#10;A. x^2 + 5x - 5&#10;B. x^2 + 3x + 5&#10;C. x^2 - 3x + 5&#10;D. x^2 - 3x - 5&#10;E. x^2 - 5x + 5&#10;Kunci: A&#10;&#10;2. Jika f(x) = 2x + 3, maka f^-1(x) adalah ....&#10;A. 1/2(x+3)&#10;B. 1/2(2x-3)&#10;C. 1/2(x-3)&#10;D. 1/2(x-2)&#10;E. 1/2(x+2)&#10;Kunci: C&#10;&#10;3. Besar ∠ ACB adalah ....&#10;A. 24,5°&#10;B. 27,5°&#10;C. 32,5°&#10;Kunci: A"></textarea>
                    </div>

                    <button type="button" onclick="runQuestionConversion(${qbInlineArg(activeCode)})" class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs shadow-md transition flex items-center justify-center space-x-2 cursor-pointer">
                        <i class="fa-solid fa-wand-magic-sparkles"></i><span>Convert Soal Sekarang</span>
                    </button>

                    <!-- Converted Result Section -->
                    <div id="cvt-result-container" class="hidden space-y-4 pt-4 border-t border-slate-200">
                        <div class="flex flex-wrap justify-between items-center gap-2">
                            <h4 class="font-bold text-slate-800 flex items-center space-x-2 text-sm">
                                <i class="fa-solid fa-circle-check text-emerald-600"></i>
                                <span>Hasil Convert Template Extraordinary CBT (<span id="cvt-count-badge">0</span> Soal)</span>
                            </h4>
                            <div class="flex flex-wrap gap-2">
                                <button type="button" onclick="openImportConvertedToBankModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-file-import"></i><span>Import ke Bank Soal</span>
                                </button>
                                <button type="button" onclick="downloadConvertedWordDoc()" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl text-xs shadow transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-file-word"></i><span>Download Word Tabel (.doc)</span>
                                </button>
                            </div>
                        </div>

                        <!-- Display Switch Tabs -->
                        <div class="bg-slate-100 p-1 rounded-2xl flex space-x-1 text-xs font-semibold">
                            <button type="button" id="tab-btn-text" onclick="switchConvertTab('text')" class="flex-1 py-1.5 rounded-xl bg-white shadow-sm text-indigo-700 text-center cursor-pointer transition">Teks Tabular (TSV)</button>
                            <button type="button" id="tab-btn-table" onclick="switchConvertTab('table')" class="flex-1 py-1.5 rounded-xl text-slate-600 hover:text-slate-900 text-center cursor-pointer transition">Pratinjau Tabel CBT</button>
                        </div>

                        <!-- Tab 1: TSV Text -->
                        <div id="cvt-tab-content-text" class="space-y-1">
                            <textarea id="cvt-output-text" readonly rows="10" class="w-full p-3.5 bg-slate-900 text-emerald-400 border border-slate-800 rounded-2xl text-xs font-mono leading-relaxed select-all shadow-inner"></textarea>
                            <p class="text-[11px] text-slate-500"><i class="fa-solid fa-lightbulb text-amber-500 mr-1"></i>Format di atas sudah menggunakan pemisah kolom Tab (\`\\t\`), rumus ter-LaTeX \\(...\\), dan dipisah enter 1 kali per nomor soal. Siap untuk langsung dicopas ke Microsoft Excel atau Word Table.</p>
                        </div>

                        <!-- Tab 2: Visual Table Preview -->
                        <div id="cvt-tab-content-table" class="hidden space-y-4">
                            <div id="cvt-table-preview-area" class="space-y-5 max-h-96 overflow-y-auto pr-1"></div>
                        </div>
                    </div>
                </div>

                <!-- Footer -->
                <div class="flex justify-between items-center pt-3 border-t shrink-0 text-xs">
                    <span class="text-slate-400 text-[11px]"><i class="fa-solid fa-shield-halved text-indigo-500 mr-1"></i>Extraordinary CBT Template Standard</span>
                    <button type="button" onclick="closeModal()" class="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold cursor-pointer transition">Tutup</button>
                </div>
            </div>
        </div>
    `;
}

function loadActiveBankQuestionsToConvert(activeCode) {
    const questions = appState.questionBank.filter(q => q && String(q.code) === String(activeCode));
    if (!questions || questions.length === 0) {
        showToast('Tidak ada soal ditemukan di bank soal ini.', 'error');
        return;
    }

    const formattedLines = [];
    questions.forEach((q, idx) => {
        const num = idx + 1;
        const qText = q.question || '';
        const opts = q.options || [];
        const optA = opts[0] || '';
        const optB = opts[1] || '';
        const optC = opts[2] || '';
        const optD = opts[3] || '';
        const optE = opts[4] || '';
        
        let kj = 'A';
        if (typeof q.answer === 'number' && q.answer >= 0 && q.answer < 5) {
            kj = String.fromCharCode(65 + q.answer);
        } else if (typeof q.answer === 'string' && q.answer.trim()) {
            const trimmedAns = q.answer.trim().toUpperCase();
            if (['A','B','C','D','E'].includes(trimmedAns)) {
                kj = trimmedAns;
            } else if (opts.indexOf(q.answer) !== -1) {
                kj = String.fromCharCode(65 + opts.indexOf(q.answer));
            }
        }

        formattedLines.push(`${num}. ${qText}`);
        if (optA) formattedLines.push(`A. ${optA}`);
        if (optB) formattedLines.push(`B. ${optB}`);
        if (optC) formattedLines.push(`C. ${optC}`);
        if (optD) formattedLines.push(`D. ${optD}`);
        if (optE) formattedLines.push(`E. ${optE}`);
        formattedLines.push(`Kunci: ${kj}`);
        formattedLines.push('');
    });

    const textarea = document.getElementById('cvt-raw-text');
    if (textarea) {
        textarea.value = formattedLines.join('\n');
    }
    showToast(`Berhasil memuat ${questions.length} soal ke area convert.`, 'success');
}

function renderCbtTableCell(text) {
    if (!text) return '';

    const sourceText = qbDecodeLegacyEntities(text);
    const previewText = RAW_LATEX_COMMAND_PATTERN.test(sourceText)
        ? autoConvertMathToLatex(sourceText)
        : sourceText;

    const escaped = sourceText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const hasLatex = /\\\([\s\S]*?\\\)|\\\[[\s\S]*?\\\]|\$\$[\s\S]*?\$\$|\$[^\$\n]+\$/.test(previewText);

    if (!hasLatex) {
        return `<span class="leading-relaxed">${escaped}</span>`;
    }

    return `
        <div class="space-y-1 my-0.5">
            <div class="font-mono text-xs text-slate-800 bg-slate-100/90 px-2.5 py-1.5 rounded-lg border border-slate-300 font-bold select-all break-words leading-relaxed tracking-tight shadow-2xs" title="Teks asli dengan tag LaTeX \...\">
                ${escaped}
            </div>
            <div class="text-xs text-indigo-950 bg-indigo-50/80 px-2.5 py-1.5 rounded-lg border border-indigo-200/80 flex items-center flex-wrap gap-2">
                <span class="text-[10px] font-extrabold text-indigo-700 uppercase tracking-wider shrink-0 bg-indigo-200/80 px-1.5 py-0.5 rounded shadow-2xs">Pratinjau Render:</span>
                <span class="katex-preview-block leading-relaxed font-semibold">${qbEscapeHtml(previewText)}</span>
            </div>
        </div>
    `;
}

function runQuestionConversion(activeCode = '') {
    const rawText = (document.getElementById('cvt-raw-text')?.value || '').trim();
    if (!rawText) {
        showToast('Silakan tempel/copas teks soal terlebih dahulu.', 'error');
        return;
    }

    const ts = document.getElementById('cvt-ts')?.value || 'PG';
    const optionCount = parseInt(document.getElementById('cvt-opt-count')?.value || '5', 10);
    const kd = document.getElementById('cvt-kd')?.value || '1.0.1';
    const kjDefault = document.getElementById('cvt-kj')?.value || 'A';
    const autoMath = document.getElementById('cvt-auto-math')?.checked ?? true;
    const mode = document.getElementById('cvt-mode')?.value || 'auto';

    const result = parseRawTextToCBTFormat(rawText, ts, kd, kjDefault, autoMath, mode, optionCount);
    if (!result.parsedQuestions || result.parsedQuestions.length === 0) {
        showToast('Gagal memproses soal. Silakan periksa kembali teks atau ubah Mode Deteksi Soal.', 'error');
        return;
    }

    currentConvertedData = result;

    const resultContainer = document.getElementById('cvt-result-container');
    const outputTextarea = document.getElementById('cvt-output-text');
    const countBadge = document.getElementById('cvt-count-badge');
    const previewArea = document.getElementById('cvt-table-preview-area');

    if (resultContainer) resultContainer.classList.remove('hidden');
    if (outputTextarea) outputTextarea.value = result.text;
    if (countBadge) countBadge.textContent = result.parsedQuestions.length;

    // Build Table Preview
    if (previewArea) {
        previewArea.innerHTML = result.parsedQuestions.map(q => `
            <div class="border border-slate-300 rounded-2xl overflow-hidden shadow-sm bg-white mb-4">
                <table class="w-full text-xs border-collapse">
                    <tbody>
                        <tr class="bg-amber-200/80 font-bold border-b border-slate-300">
                            <td class="w-16 p-2 border-r border-slate-300 text-center bg-amber-300/80 text-slate-800">TS</td>
                            <td class="p-2 font-semibold text-slate-800">${qbEscapeHtml(q.ts)}</td>
                        </tr>
                        <tr class="bg-amber-200/80 font-bold border-b border-slate-300">
                            <td class="p-2 border-r border-slate-300 text-center bg-amber-300/80 text-slate-800">KD</td>
                            <td class="p-2 font-semibold text-slate-800">${qbEscapeHtml(q.kd)}</td>
                        </tr>
                        <tr class="bg-amber-200/80 font-bold border-b border-slate-300">
                            <td class="p-2 border-r border-slate-300 text-center bg-amber-300/80 text-slate-800">KJ</td>
                            <td class="p-2 font-semibold text-slate-800">${qbEscapeHtml(q.kj)}</td>
                        </tr>
                        <tr class="bg-emerald-100/90 font-bold border-b border-slate-300">
                            <td class="p-2 border-r border-slate-300 text-center bg-emerald-200/90 text-emerald-900">ABS</td>
                            <td class="p-2">${qbEscapeHtml(q.abs || '')}</td>
                        </tr>
                        <tr class="bg-white border-b border-slate-300">
                            <td class="p-2 border-r border-slate-300 font-bold text-center align-top bg-slate-50 text-slate-700">${q.num}.</td>
                            <td class="p-2 font-semibold text-slate-900 leading-relaxed">${renderCbtTableCell(q.questionText)}</td>
                        </tr>
                        <tr class="bg-white border-b border-slate-200">
                            <td class="p-2 border-r border-slate-300 font-bold text-center bg-slate-50 text-slate-700">A</td>
                            <td class="p-2 text-slate-800">${renderCbtTableCell(q.options.A || '')}</td>
                        </tr>
                        <tr class="bg-white border-b border-slate-200">
                            <td class="p-2 border-r border-slate-300 font-bold text-center bg-slate-50 text-slate-700">B</td>
                            <td class="p-2 text-slate-800">${renderCbtTableCell(q.options.B || '')}</td>
                        </tr>
                        <tr class="bg-white border-b border-slate-200">
                            <td class="p-2 border-r border-slate-300 font-bold text-center bg-slate-50 text-slate-700">C</td>
                            <td class="p-2 text-slate-800">${renderCbtTableCell(q.options.C || '')}</td>
                        </tr>
                        <tr class="bg-white border-b ${optionCount >= 5 ? 'border-slate-200' : 'border-slate-300'}">
                            <td class="p-2 border-r border-slate-300 font-bold text-center bg-slate-50 text-slate-700">D</td>
                            <td class="p-2 text-slate-800">${renderCbtTableCell(q.options.D || '')}</td>
                        </tr>
                        ${optionCount >= 5 ? `
                        <tr class="bg-white border-b border-slate-300">
                            <td class="p-2 border-r border-slate-300 font-bold text-center bg-slate-50 text-slate-700">E</td>
                            <td class="p-2 text-slate-800">${renderCbtTableCell(q.options.E || '')}</td>
                        </tr>
                        ` : ''}
                    </tbody>
                </table>
            </div>
        `).join('');

        // Trigger KaTeX math rendering ONLY inside .katex-preview-block elements.
        // Normalize legacy HTML entities as plain text before KaTeX sees them.
        if (typeof renderMathInElement === 'function') {
            previewArea.querySelectorAll('.katex-preview-block').forEach(el => {
                const mathSource = qbDecodeLegacyEntities(el.textContent || '');
                el.textContent = mathSource;
                renderMathInElement(el, {
                    delimiters: [
                        {left: '$$', right: '$$', display: true},
                        {left: '$', right: '$', display: false},
                        {left: '\\(', right: '\\)', display: false},
                        {left: '\\[', right: '\\]', display: true}
                    ],
                    throwOnError: false
                });
            });
        }
    }

    showToast(`Berhasil mengkonversi ${result.parsedQuestions.length} paket soal!`, 'success');
}

function parseRawTextToCBTFormat(rawText, defaultTS = 'PG', defaultKD = '1.0.1', defaultKJ = 'A', autoMath = true, parseMode = 'auto', optionCount = 5) {
    if (!rawText || !rawText.trim()) return { text: '', parsedQuestions: [], optionCount };

    const lines = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const parsedQuestions = [];

    if (parseMode === 'enter') {
        let currentNum = 1;
        let step = 0; // 0: Question, 1: A, 2: B, 3: C, 4: D, 5: E/KJ
        let qText = '', optA = '', optB = '', optC = '', optD = '', optE = '', kj = defaultKJ;

        function pushEnterQuestion() {
            if (!qText.trim()) return;

            let finalQText = qText.trim();
            let finalA = optA.trim();
            let finalB = optB.trim();
            let finalC = optC.trim();
            let finalD = optD.trim();
            let finalE = optE.trim();

            if (autoMath) {
                finalQText = autoConvertMathToLatex(finalQText);
                finalA = autoConvertMathToLatex(finalA);
                finalB = autoConvertMathToLatex(finalB);
                finalC = autoConvertMathToLatex(finalC);
                finalD = autoConvertMathToLatex(finalD);
                if (optionCount >= 5) finalE = autoConvertMathToLatex(finalE);
            }

            const opts = { A: finalA, B: finalB, C: finalC, D: finalD };
            if (optionCount >= 5) opts.E = finalE;

            parsedQuestions.push({
                num: currentNum++,
                ts: defaultTS,
                kd: defaultKD,
                kj: (kj || defaultKJ).toUpperCase().trim(),
                abs: '',
                questionText: finalQText,
                options: opts
            });

            qText = ''; optA = ''; optB = ''; optC = ''; optD = ''; optE = ''; kj = defaultKJ;
            step = 0;
        }

        const keyRegex = /^\s*(?:Kunci|KJ|Jawaban|Kunci\s+Jawaban|Answer|Ans)\s*[:=]?\s*([A-Ea-e])/i;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (!trimmed) {
                if (step >= (optionCount === 4 ? 4 : 5)) {
                    pushEnterQuestion();
                }
                continue;
            }

            const keyMatch = trimmed.match(keyRegex);
            if (keyMatch) {
                kj = keyMatch[1].toUpperCase();
                pushEnterQuestion();
                continue;
            }

            let cleanText = trimmed;
            cleanText = cleanText.replace(/^(?:Soal|No\.?)?\s*\d+[\.\)\:\-]\s*/i, '');
            cleanText = cleanText.replace(/^[A-Ea-e][\.\)\:\-]\s*/i, '');

            if (step === 0) {
                qText = cleanText;
                step = 1;
            } else if (step === 1) {
                optA = cleanText;
                step = 2;
            } else if (step === 2) {
                optB = cleanText;
                step = 3;
            } else if (step === 3) {
                optC = cleanText;
                step = 4;
            } else if (step === 4) {
                optD = cleanText;
                if (optionCount === 4) {
                    step = 5;
                } else {
                    step = 5; // Will hold option E in 5-option mode
                }
            } else if (step === 5) {
                if (optionCount === 4) {
                    if (/^[A-Da-d]$/i.test(trimmed)) {
                        kj = trimmed.toUpperCase();
                        pushEnterQuestion();
                    } else if (/^(?:Kunci|KJ)/i.test(trimmed)) {
                        const m = trimmed.match(/([A-Da-d])/i);
                        if (m) kj = m[1].toUpperCase();
                        pushEnterQuestion();
                    } else {
                        pushEnterQuestion();
                        qText = cleanText;
                        step = 1;
                    }
                } else {
                    if (/^[A-Ea-e]$/i.test(trimmed)) {
                        kj = trimmed.toUpperCase();
                        pushEnterQuestion();
                    } else if (/^(?:Kunci|KJ)/i.test(trimmed)) {
                        const m = trimmed.match(/([A-Ea-e])/i);
                        if (m) kj = m[1].toUpperCase();
                        pushEnterQuestion();
                    } else {
                        optE = cleanText;
                        step = 6;
                    }
                }
            } else if (step === 6) {
                if (/^[A-Ea-e]$/i.test(trimmed)) {
                    kj = trimmed.toUpperCase();
                    pushEnterQuestion();
                } else if (/^(?:Kunci|KJ)/i.test(trimmed)) {
                    const m = trimmed.match(/([A-Ea-e])/i);
                    if (m) kj = m[1].toUpperCase();
                    pushEnterQuestion();
                } else {
                    pushEnterQuestion();
                    qText = cleanText;
                    step = 1;
                }
            }
        }

        pushEnterQuestion();
    } else {
        // Smart Auto Mode
        let currentQuestion = null;
        let currentOptions = {};
        let currentKey = null;
        let currentNum = 1;

        function pushQuestion() {
            if (!currentQuestion || !currentQuestion.text.trim()) return;

            let qText = currentQuestion.text.trim();
            let optA = currentOptions['A'] || '';
            let optB = currentOptions['B'] || '';
            let optC = currentOptions['C'] || '';
            let optD = currentOptions['D'] || '';
            let optE = currentOptions['E'] || '';

            if (autoMath) {
                qText = autoConvertMathToLatex(qText);
                optA = autoConvertMathToLatex(optA);
                optB = autoConvertMathToLatex(optB);
                optC = autoConvertMathToLatex(optC);
                optD = autoConvertMathToLatex(optD);
                if (optionCount >= 5) optE = autoConvertMathToLatex(optE);
            }

            const opts = { A: optA, B: optB, C: optC, D: optD };
            if (optionCount >= 5) opts.E = optE;

            parsedQuestions.push({
                num: currentNum,
                ts: defaultTS,
                kd: defaultKD,
                kj: (currentKey || defaultKJ).toUpperCase().trim(),
                abs: '',
                questionText: qText,
                options: opts
            });

            currentNum++;
            currentQuestion = null;
            currentOptions = {};
            currentKey = null;
        }

        const qNumRegex = /^(?:Soal|No\.?)?\s*(\d+)[\.\)\:\-\s]\s*(.*)/i;
        const optRegex = /^\s*[\(\[]?([A-Ea-e])[\.\)\:\-\s\]]\s*(.*)/;
        const keyRegex = /^\s*(?:Kunci|KJ|Jawaban|Kunci\s+Jawaban|Answer|Ans)\s*[:=]?\s*([A-Ea-e])/i;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();
            if (!trimmed) continue;

            const keyMatch = trimmed.match(keyRegex);
            if (keyMatch) {
                currentKey = keyMatch[1].toUpperCase();
                continue;
            }

            const qMatch = trimmed.match(qNumRegex);
            if (qMatch) {
                pushQuestion();
                currentQuestion = {
                    num: parseInt(qMatch[1], 10) || currentNum,
                    text: qMatch[2] || ''
                };
                continue;
            }

            const optMatch = trimmed.match(optRegex);
            if (optMatch && currentQuestion) {
                const letter = optMatch[1].toUpperCase();
                if (optionCount === 4 && letter === 'E') {
                    // Ignore option E if 4-option mode is selected
                } else {
                    currentOptions[letter] = optMatch[2] || '';
                }
                continue;
            }

            if (currentQuestion) {
                const numOptions = Object.keys(currentOptions).length;
                if ((numOptions >= optionCount || currentKey) && !trimmed.match(optRegex) && !trimmed.match(keyRegex)) {
                    pushQuestion();
                    currentQuestion = {
                        num: currentNum,
                        text: trimmed
                    };
                } else if (numOptions === 0) {
                    currentQuestion.text += (currentQuestion.text ? '\n' : '') + trimmed;
                } else {
                    const keys = Object.keys(currentOptions);
                    const lastKey = keys[keys.length - 1];
                    currentOptions[lastKey] += (currentOptions[lastKey] ? ' ' : '') + trimmed;
                }
            } else {
                currentQuestion = {
                    num: 1,
                    text: trimmed
                };
            }
        }

        pushQuestion();
    }

    const outputLines = [];
    for (let i = 0; i < parsedQuestions.length; i++) {
        const q = parsedQuestions[i];
        outputLines.push(`TS\t${q.ts}`);
        outputLines.push(`KD\t${q.kd}`);
        outputLines.push(`KJ\t${q.kj}`);
        outputLines.push(`ABS\t`);
        outputLines.push(`${q.num}.\t${q.questionText}`);
        outputLines.push(`A\t${q.options.A || ''}`);
        outputLines.push(`B\t${q.options.B || ''}`);
        outputLines.push(`C\t${q.options.C || ''}`);
        outputLines.push(`D\t${q.options.D || ''}`);
        if (optionCount >= 5) {
            outputLines.push(`E\t${q.options.E || ''}`);
        }

        if (i < parsedQuestions.length - 1) {
            outputLines.push(''); // enter 1x
        }
    }

    return {
        text: outputLines.join('\n'),
        parsedQuestions,
        optionCount
    };
}

function switchConvertTab(tab) {
    const btnText = document.getElementById('tab-btn-text');
    const btnTable = document.getElementById('tab-btn-table');
    const contentText = document.getElementById('cvt-tab-content-text');
    const contentTable = document.getElementById('cvt-tab-content-table');

    if (tab === 'text') {
        btnText?.classList.add('bg-white', 'shadow-sm', 'text-indigo-700');
        btnText?.classList.remove('text-slate-600');
        btnTable?.classList.remove('bg-white', 'shadow-sm', 'text-indigo-700');
        btnTable?.classList.add('text-slate-600');
        contentText?.classList.remove('hidden');
        contentTable?.classList.add('hidden');
    } else {
        btnTable?.classList.add('bg-white', 'shadow-sm', 'text-indigo-700');
        btnTable?.classList.remove('text-slate-600');
        btnText?.classList.remove('bg-white', 'shadow-sm', 'text-indigo-700');
        btnText?.classList.add('text-slate-600');
        contentTable?.classList.remove('hidden');
        contentText?.classList.add('hidden');
    }
}

function copyConvertedTextToClipboard() {
    const outputTextarea = document.getElementById('cvt-output-text');
    if (!outputTextarea || !outputTextarea.value) {
        showToast('Belum ada hasil konversi untuk disalin.', 'error');
        return;
    }

    navigator.clipboard.writeText(outputTextarea.value).then(() => {
        showToast('Hasil convert berhasil disalin ke clipboard!', 'success');
    }).catch(err => {
        outputTextarea.select();
        document.execCommand('copy');
        showToast('Hasil convert disalin ke clipboard!', 'success');
    });
}

function downloadConvertedTextFile() {
    if (!currentConvertedData || !currentConvertedData.text) {
        showToast('Belum ada data hasil konversi.', 'error');
        return;
    }

    const blob = new Blob([currentConvertedData.text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Extraordinary_CBT_Template_${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('File template berhasil diunduh.', 'success');
}

function downloadConvertedWordDoc() {
    if (!currentConvertedData || !currentConvertedData.parsedQuestions || currentConvertedData.parsedQuestions.length === 0) {
        showToast('Belum ada data hasil konversi untuk diunduh.', 'error');
        return;
    }

    const questions = currentConvertedData.parsedQuestions;
    const optionCount = currentConvertedData.optionCount || 5;

    const tablesHtml = questions.map(q => `
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 0px; page-break-inside: avoid; border: 1.5pt solid #94a3b8; mso-padding-alt: 4pt 6pt 4pt 6pt;">
            <tbody>
                <tr style="background-color: #fef08a; font-weight: bold; border-bottom: 1pt solid #cbd5e1;">
                    <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; text-align: center; background-color: #fde047; color: #1e293b; font-weight: bold; mso-para-margin: 0cm;">TS</td>
                    <td style="padding: 4pt 6pt; color: #1e293b; font-weight: bold; mso-para-margin: 0cm;">${qbEscapeHtml(q.ts)}</td>
                </tr>
                <tr style="background-color: #fef08a; font-weight: bold; border-bottom: 1pt solid #cbd5e1;">
                    <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; text-align: center; background-color: #fde047; color: #1e293b; font-weight: bold; mso-para-margin: 0cm;">KD</td>
                    <td style="padding: 4pt 6pt; color: #1e293b; font-weight: bold; mso-para-margin: 0cm;">${qbEscapeHtml(q.kd)}</td>
                </tr>
                <tr style="background-color: #fef08a; font-weight: bold; border-bottom: 1pt solid #cbd5e1;">
                    <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; text-align: center; background-color: #fde047; color: #1e293b; font-weight: bold; mso-para-margin: 0cm;">KJ</td>
                    <td style="padding: 4pt 6pt; color: #1e293b; font-weight: bold; mso-para-margin: 0cm;">${qbEscapeHtml(q.kj)}</td>
                </tr>
                <tr style="background-color: #d1fae5; font-weight: bold; border-bottom: 1pt solid #cbd5e1;">
                    <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; text-align: center; background-color: #a7f3d0; color: #064e3b; font-weight: bold; mso-para-margin: 0cm;">ABS</td>
                    <td style="padding: 4pt 6pt; color: #064e3b; mso-para-margin: 0cm;">${qbEscapeHtml(q.abs || '')}</td>
                </tr>
                <tr style="background-color: #ffffff; border-bottom: 1pt solid #cbd5e1;">
                    <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; font-weight: bold; text-align: center; vertical-align: top; background-color: #f8fafc; color: #334155; mso-para-margin: 0cm;">${q.num}.</td>
                    <td style="padding: 4pt 6pt; font-weight: 600; color: #0f172a; line-height: 1.4; mso-para-margin: 0cm;">${qbEscapeHtml(q.questionText)}</td>
                </tr>
                <tr style="background-color: #ffffff; border-bottom: 1pt solid #e2e8f0;">
                    <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; font-weight: bold; text-align: center; background-color: #f8fafc; color: #334155; mso-para-margin: 0cm;">A</td>
                    <td style="padding: 4pt 6pt; color: #334155; mso-para-margin: 0cm;">${qbEscapeHtml(q.options.A || '')}</td>
                </tr>
                <tr style="background-color: #ffffff; border-bottom: 1pt solid #e2e8f0;">
                    <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; font-weight: bold; text-align: center; background-color: #f8fafc; color: #334155; mso-para-margin: 0cm;">B</td>
                    <td style="padding: 4pt 6pt; color: #334155; mso-para-margin: 0cm;">${qbEscapeHtml(q.options.B || '')}</td>
                </tr>
                <tr style="background-color: #ffffff; border-bottom: 1pt solid #e2e8f0;">
                    <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; font-weight: bold; text-align: center; background-color: #f8fafc; color: #334155; mso-para-margin: 0cm;">C</td>
                    <td style="padding: 4pt 6pt; color: #334155; mso-para-margin: 0cm;">${qbEscapeHtml(q.options.C || '')}</td>
                </tr>
                <tr style="background-color: #ffffff; border-bottom: ${optionCount >= 5 ? '1pt solid #e2e8f0' : '1pt solid #cbd5e1'};">
                    <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; font-weight: bold; text-align: center; background-color: #f8fafc; color: #334155; mso-para-margin: 0cm;">D</td>
                    <td style="padding: 4pt 6pt; color: #334155; mso-para-margin: 0cm;">${qbEscapeHtml(q.options.D || '')}</td>
                </tr>
                ${optionCount >= 5 ? `
                <tr style="background-color: #ffffff; border-bottom: 1pt solid #cbd5e1;">
                    <td style="width: 60pt; padding: 4pt 6pt; border-right: 1pt solid #cbd5e1; font-weight: bold; text-align: center; background-color: #f8fafc; color: #334155; mso-para-margin: 0cm;">E</td>
                    <td style="padding: 4pt 6pt; color: #334155; mso-para-margin: 0cm;">${qbEscapeHtml(q.options.E || '')}</td>
                </tr>
                ` : ''}
            </tbody>
        </table>
        <p style="margin: 0 !important; padding: 0 !important; mso-para-margin: 0cm !important; mso-para-margin-top: 0cm !important; mso-para-margin-bottom: 0cm !important; height: 12pt; line-height: 12pt;">&nbsp;</p>
    `).join('');

    const fullDocHtml = `
        <html xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns:m="http://schemas.microsoft.com/office/2004/12/omml" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
            <meta charset="utf-8">
            <title>Hasil Convert Extraordinary CBT</title>
            <!--[if gte mso 9]>
            <xml>
             <w:WordDocument>
              <w:View>Print</w:View>
              <w:Zoom>100</w:Zoom>
              <w:DoNotOptimizeForBrowser/>
             </w:WordDocument>
            </xml>
            <![endif]-->
            <style>
                @page { size: A4; margin: 1.5cm; }
                body, table, td, p, div, span {
                    font-family: 'Calibri', 'Segoe UI', Arial, sans-serif;
                    font-size: 10pt;
                    color: #1e293b;
                    line-height: 1.35;
                    margin: 0 !important;
                    padding: 0;
                    mso-para-margin: 0cm !important;
                    mso-para-margin-top: 0cm !important;
                    mso-para-margin-bottom: 0cm !important;
                    mso-line-height-rule: exactly;
                }
                p {
                    margin: 0 !important;
                    padding: 0 !important;
                    mso-para-margin: 0cm !important;
                    mso-para-margin-top: 0cm !important;
                    mso-para-margin-bottom: 0cm !important;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 0px;
                    page-break-inside: avoid;
                    border: 1.5pt solid #cbd5e1;
                    mso-yfti-tbllook: 1184;
                    mso-padding-alt: 4pt 6pt 4pt 6pt;
                }
                td {
                    border: 1pt solid #cbd5e1;
                    padding: 4pt 6pt;
                    font-size: 10pt;
                    vertical-align: top;
                    mso-para-margin: 0cm !important;
                }
            </style>
        </head>
        <body>
            <h3 style="font-family: Arial, sans-serif; font-size: 14pt; font-weight: bold; color: #0f172a; margin: 0 0 12pt 0 !important; mso-para-margin-bottom: 12pt !important;">Extraordinary CBT Question Template</h3>
            ${tablesHtml}
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff' + fullDocHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Hasil_Convert_CBT_Tabel_${Date.now()}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast('File Word Tabel CBT berhasil diunduh.', 'success');
}

function openImportConvertedToBankModal() {
    if (!currentConvertedData || !currentConvertedData.parsedQuestions || currentConvertedData.parsedQuestions.length === 0) {
        showToast('Belum ada hasil konversi soal. Silakan konversi soal terlebih dahulu.', 'error');
        return;
    }

    const parsedQuestions = currentConvertedData.parsedQuestions;
    const allowedSubjects = getTeacherAllowedSubjects();
    const subjects = appState.subjects || [];
    const classes = appState.classes || [];
    let existingGroups = appState.questionBankGroups || [];

    if (appState.role === 'teacher') {
        const allowedIds = allowedSubjects.map(s => String(s.id));
        const filtered = existingGroups.filter(bg => allowedIds.includes(String(bg.subjectId)));
        if (filtered.length > 0) existingGroups = filtered;
    }

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]">
                <!-- Header -->
                <div class="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex justify-between items-center shrink-0">
                    <div class="flex items-center space-x-3">
                        <div class="p-2.5 bg-white/10 rounded-2xl">
                            <i class="fa-solid fa-file-import text-lg"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-base leading-tight">Import Hasil Convert ke Bank Soal</h3>
                            <p class="text-xs text-emerald-100 font-medium">Akan mengimpor <span class="font-bold underline">${parsedQuestions.length}</span> butir soal</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeImportBankModal()" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Form -->
                <form onsubmit="executeImportConvertedToBank(event)" class="p-6 overflow-y-auto space-y-5 text-xs sm:text-sm">
                    <!-- Choose Mode -->
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Tujuan Bank Soal</label>
                        <div class="grid grid-cols-2 gap-2">
                            <label id="lbl-mode-existing" class="flex items-center justify-center space-x-2 p-3 border-2 border-indigo-600 bg-indigo-50/60 rounded-2xl cursor-pointer transition">
                                <input type="radio" name="import-mode" value="existing" checked onchange="toggleImportBankMode('existing')" class="text-indigo-600 focus:ring-indigo-500 cursor-pointer">
                                <span class="font-bold text-indigo-950 text-xs">Pilih Bank Soal Ada</span>
                            </label>
                            <label id="lbl-mode-new" class="flex items-center justify-center space-x-2 p-3 border-2 border-slate-200 bg-white hover:bg-slate-50 rounded-2xl cursor-pointer transition">
                                <input type="radio" name="import-mode" value="new" onchange="toggleImportBankMode('new')" class="text-indigo-600 focus:ring-indigo-500 cursor-pointer">
                                <span class="font-bold text-slate-700 text-xs">+ Buat Kode Soal Baru</span>
                            </label>
                        </div>
                    </div>

                    <!-- Option 1: Existing Group -->
                    <div id="section-import-existing" class="space-y-2">
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-600">Pilih Bank Soal / Kode Soal <span class="text-rose-500">*</span></label>
                        ${existingGroups.length === 0 ? `
                            <div class="p-3 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-800">
                                Belum ada Bank Soal tersimpan. Silakan pilih <b>"+ Buat Kode Soal Baru"</b> di atas.
                            </div>
                        ` : `
                            <select id="import-bank-code-existing" class="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-2xl font-bold text-xs focus:ring-2 focus:ring-indigo-500 focus:bg-white transition">
                                ${existingGroups.map(bg => {
                                    const subj = subjects.find(s => String(s.id) === String(bg.subjectId));
                                    const cls = classes.find(c => String(c.id) === String(bg.classId));
                                    return `<option value="${qbEscapeAttr(bg.code)}">${qbEscapeHtml(bg.code)} - ${qbEscapeHtml(subj?.name || 'Umum')} (Kelas ${qbEscapeHtml(cls?.name || 'Semua')})</option>`;
                                }).join('')}
                            </select>
                        `}
                    </div>

                    <!-- Option 2: New Group Form -->
                    <div id="section-import-new" class="hidden space-y-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Kode Soal Baru <span class="text-rose-500">*</span></label>
                            <input type="text" id="import-bank-code-new" value="KODE-SOAL-${(appState.questionBankGroups || []).length + 1}" class="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl font-mono text-xs font-bold focus:ring-2 focus:ring-indigo-500" placeholder="misal: MTK-X-PAS-2026" />
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Mata Pelajaran <span class="text-rose-500">*</span></label>
                            <select id="import-bank-mapel" class="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500">
                                ${allowedSubjects.map(s => `<option value="${qbEscapeAttr(s.id)}">${qbEscapeHtml(s.name)}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">Kelas <span class="text-rose-500">*</span></label>
                            <select id="import-bank-kelas" class="w-full px-4 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500">
                                ${(appState.classes || []).map(c => `<option value="${qbEscapeAttr(c.id)}">${qbEscapeHtml(c.name)}</option>`).join('')}
                            </select>
                        </div>
                    </div>

                    <!-- Action Buttons -->
                    <div class="flex justify-end items-center space-x-2 pt-3 border-t border-slate-100">
                        <button type="button" onclick="closeImportBankModal()" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition cursor-pointer text-xs">
                            Batal
                        </button>
                        <button type="submit" id="btn-submit-import-bank" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold shadow-md transition flex items-center space-x-2 cursor-pointer text-xs">
                            <i class="fa-solid fa-cloud-arrow-up"></i>
                            <span>Proses Import ke Bank Soal</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function toggleImportBankMode(mode) {
    const secExisting = document.getElementById('section-import-existing');
    const secNew = document.getElementById('section-import-new');
    const lblExisting = document.getElementById('lbl-mode-existing');
    const lblNew = document.getElementById('lbl-mode-new');
    const inputCodeNew = document.getElementById('import-bank-code-new');

    if (mode === 'existing') {
        secExisting?.classList.remove('hidden');
        secNew?.classList.add('hidden');
        if (inputCodeNew) inputCodeNew.required = false;

        lblExisting?.classList.add('border-indigo-600', 'bg-indigo-50/60', 'text-indigo-950');
        lblExisting?.classList.remove('border-slate-200', 'bg-white', 'hover:bg-slate-50');

        lblNew?.classList.remove('border-indigo-600', 'bg-indigo-50/60', 'text-indigo-950');
        lblNew?.classList.add('border-slate-200', 'bg-white', 'hover:bg-slate-50');
    } else {
        secExisting?.classList.add('hidden');
        secNew?.classList.remove('hidden');
        if (inputCodeNew) inputCodeNew.required = true;

        lblNew?.classList.add('border-indigo-600', 'bg-indigo-50/60', 'text-indigo-950');
        lblNew?.classList.remove('border-slate-200', 'bg-white', 'hover:bg-slate-50');

        lblExisting?.classList.remove('border-indigo-600', 'bg-indigo-50/60', 'text-indigo-950');
        lblExisting?.classList.add('border-slate-200', 'bg-white', 'hover:bg-slate-50');
    }
}

function closeImportBankModal() {
    closeModal();
}

async function executeImportConvertedToBank(e) {
    if (e) e.preventDefault();

    if (!currentConvertedData || !currentConvertedData.parsedQuestions || currentConvertedData.parsedQuestions.length === 0) {
        showToast('Tidak ada data hasil konversi untuk diimpor.', 'error');
        return;
    }

    const mode = document.querySelector('input[name="import-mode"]:checked')?.value || 'existing';
    const parsedQuestions = currentConvertedData.parsedQuestions;
    const optionCount = currentConvertedData.optionCount || 5;

    let targetCode = '';
    let targetSubjectId = '';
    let targetClassId = '';

    if (mode === 'existing') {
        const codeSelect = document.getElementById('import-bank-code-existing');
        targetCode = codeSelect?.value || '';

        if (!targetCode) {
            showToast('Silakan pilih Bank Soal yang sudah ada atau pilih "Buat Kode Soal Baru".', 'error');
            return;
        }

        const group = (appState.questionBankGroups || []).find(bg => String(bg.code) === String(targetCode));
        targetSubjectId = group ? group.subjectId : (appState.subjects[0]?.id || '');
        targetClassId = group ? group.classId : (appState.classes[0]?.id || '');
    } else {
        targetCode = (document.getElementById('import-bank-code-new')?.value || '').trim();
        targetSubjectId = document.getElementById('import-bank-mapel')?.value || (appState.subjects[0]?.id || '');
        targetClassId = document.getElementById('import-bank-kelas')?.value || (appState.classes[0]?.id || '');

        if (!targetCode) {
            showToast('Kode soal baru wajib diisi.', 'error');
            return;
        }

        // Create new bank group if not existing
        let group = (appState.questionBankGroups || []).find(bg => String(bg.code) === String(targetCode));
        if (!group) {
            group = { id: 'BG' + Date.now(), code: targetCode, subjectId: targetSubjectId, classId: targetClassId };
            appState.questionBankGroups.push(group);

            try {
                await fetch('/api/question-bank-groups', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(group)
                });
            } catch (err) {}

            saveState('questionBankGroups');
        }
    }

    // Convert parsed questions to Bank Soal objects
    const newQuestions = [];
    parsedQuestions.forEach((q, idx) => {
        const isEssay = (q.ts || '').toUpperCase().includes('ESY') || (q.ts || '').toUpperCase().includes('ESSAY');

        const opts = [];
        if (q.options) {
            if (q.options.A !== undefined) opts.push(q.options.A);
            if (q.options.B !== undefined) opts.push(q.options.B);
            if (q.options.C !== undefined) opts.push(q.options.C);
            if (q.options.D !== undefined) opts.push(q.options.D);
            if (optionCount >= 5 && q.options.E !== undefined) opts.push(q.options.E);
        }

        const kjLetter = (q.kj || 'A').toUpperCase().trim();
        let answerVal = kjLetter;
        if (q.options && q.options[kjLetter] !== undefined) {
            answerVal = q.options[kjLetter];
        }

        const newQObj = {
            id: 'Q_' + Date.now() + '_' + idx + '_' + Math.random().toString(36).substr(2, 4),
            code: targetCode,
            subjectId: targetSubjectId,
            classId: targetClassId,
            type: isEssay ? 'essay' : 'mc',
            question: q.questionText || '',
            imageUrl: '',
            options: isEssay ? [] : opts,
            answer: answerVal,
            explanation: ''
        };

        appState.questionBank.push(newQObj);
        newQuestions.push(newQObj);
    });

    const importedIds = new Set(newQuestions.map(q => String(q.id)));
    try {
        const response = await fetch('/api/questions/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            // Batch endpoint keeps legacy replace-list semantics offline, so send the full current bank.
            body: JSON.stringify(appState.questionBank || [])
        });
        if (!response.ok) {
            let message = 'Gagal menyimpan hasil import ke server.';
            try {
                const payload = await response.json();
                if (payload?.message) message = String(payload.message);
            } catch (_) {}
            throw new Error(message);
        }
        saveState('questionBank');
    } catch (err) {
        appState.questionBank = (appState.questionBank || []).filter(q => !importedIds.has(String(q?.id || '')));
        showToast(err?.message || 'Gagal menyimpan hasil import ke Bank Soal.', 'error');
        return;
    }

    closeModal();
    showToast(`Berhasil mengimpor ${newQuestions.length} butir soal ke Bank Soal (${targetCode})!`, 'success');

    appState.activeBankGroupCode = targetCode;
    const viewContainer = document.getElementById('view-container');
    if (viewContainer) {
        renderQuestionBankModule(viewContainer);
    }
}

function extractTextAndImagesFromNode(node) {
    if (!node) return '';
    let result = '';

    function walk(child) {
        if (!child) return;
        if (child.nodeType === Node.TEXT_NODE) {
            result += child.textContent;
        } else if (child.nodeType === Node.ELEMENT_NODE) {
            const tagName = child.tagName.toLowerCase();
            if (tagName === 'img') {
                const src = child.getAttribute('src');
                if (src) {
                    const alt = child.getAttribute('alt') || '';
                    result += ` <img src="${src}" alt="${alt}" style="max-width: 100%; height: auto; display: inline-block; margin: 4px 0;" /> `;
                }
            } else if (tagName === 'br') {
                result += '\n';
            } else if (['p', 'div', 'tr', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'].includes(tagName)) {
                for (const grandChild of child.childNodes) {
                    walk(grandChild);
                }
                result += '\n';
            } else {
                for (const grandChild of child.childNodes) {
                    walk(grandChild);
                }
            }
        }
    }

    walk(node);
    return result;
}

function parseWordHtmlToText(html) {
    if (!html) return '';

    const temp = document.createElement('div');
    temp.innerHTML = html;

    const tables = temp.querySelectorAll('table');
    if (tables.length > 0) {
        const textParts = [];
        tables.forEach(table => {
            const rows = table.querySelectorAll('tr');
            let qNum = '', qText = '', optA = '', optB = '', optC = '', optD = '', optE = '', kj = '';
            let isCbtTable = false;

            rows.forEach(row => {
                const cells = Array.from(row.querySelectorAll('td, th')).map(c => extractTextAndImagesFromNode(c).trim());
                if (cells.length >= 2) {
                    const col1 = cells[0].toUpperCase();
                    const col2 = cells[1];

                    if (['TS', 'KD', 'ABS'].includes(col1)) {
                        isCbtTable = true;
                    } else if (col1 === 'KJ') {
                        isCbtTable = true;
                        kj = col2;
                    } else if (/^\d+[\.\)]?$/.test(col1) || col1.endsWith('.')) {
                        isCbtTable = true;
                        qNum = col1.replace(/\D/g, '');
                        qText = col2;
                    } else if (['A', 'B', 'C', 'D', 'E'].includes(col1)) {
                        isCbtTable = true;
                        if (col1 === 'A') optA = col2;
                        if (col1 === 'B') optB = col2;
                        if (col1 === 'C') optC = col2;
                        if (col1 === 'D') optD = col2;
                        if (col1 === 'E') optE = col2;
                    }
                }
            });

            if (isCbtTable && qText) {
                let block = `${qNum || '1'}. ${qText}`;
                if (optA) block += `\nA. ${optA}`;
                if (optB) block += `\nB. ${optB}`;
                if (optC) block += `\nC. ${optC}`;
                if (optD) block += `\nD. ${optD}`;
                if (optE) block += `\nE. ${optE}`;
                if (kj) block += `\nKunci: ${kj}`;
                textParts.push(block);
            } else {
                rows.forEach(r => {
                    const cellTexts = Array.from(r.querySelectorAll('td, th')).map(c => extractTextAndImagesFromNode(c).trim()).join(' | ');
                    if (cellTexts) textParts.push(cellTexts);
                });
            }
        });

        temp.querySelectorAll('table').forEach(t => t.remove());
        const otherText = extractTextAndImagesFromNode(temp);
        if (otherText.trim()) {
            textParts.unshift(otherText.trim());
        }

        return textParts.join('\n\n');
    }

    const fullText = extractTextAndImagesFromNode(temp);
    return fullText.replace(/\n{3,}/g, '\n\n').trim();
}

function handleConvertWordFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    showToast('Membaca file Word...', 'info');

    const processWithMammoth = (mammothInst) => {
        const reader = new FileReader();
        reader.onload = function(evt) {
            const arrayBuffer = evt.target.result;
            mammothInst.convertToHtml({ arrayBuffer: arrayBuffer })
                .then(function(result) {
                    const htmlContent = result.value || '';
                    const extractedText = parseWordHtmlToText(htmlContent);
                    const textarea = document.getElementById('cvt-raw-text');
                    if (textarea) {
                        textarea.value = extractedText;
                    }
                    showToast('Berhasil mengimpor teks dari file Word!', 'success');
                })
                .catch(function(err) {
                    console.warn('Mammoth convert error, falling back to raw text:', err);
                    const readerText = new FileReader();
                    readerText.onload = function(txtEvt) {
                        const textarea = document.getElementById('cvt-raw-text');
                        if (textarea) textarea.value = txtEvt.target.result;
                        showToast('Berhasil mengimpor teks file!', 'success');
                    };
                    readerText.readAsText(file);
                });
        };
        reader.readAsArrayBuffer(file);
    };

    if (window.mammoth) {
        processWithMammoth(window.mammoth);
    } else {
        import('mammoth').then(mod => {
            window.mammoth = mod.default || mod;
            processWithMammoth(window.mammoth);
        }).catch(err => {
            console.error('Failed to load mammoth:', err);
            const reader = new FileReader();
            reader.onload = function(evt) {
                const textarea = document.getElementById('cvt-raw-text');
                if (textarea) textarea.value = evt.target.result;
                showToast('Berhasil mengimpor teks file!', 'success');
            };
            reader.readAsText(file);
        });
    }
}

// Improved Multi-Format Question Import Modal
function openQuestionImportModal(code) {
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
            <div class="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-6 space-y-5 my-6">
                <div class="flex justify-between items-center pb-2 border-b">
                    <h3 class="font-bold flex items-center space-x-2 text-slate-800 text-base">
                        <i class="fa-solid fa-file-arrow-up text-emerald-600"></i>
                        <span>Import Soal (Word, Excel, Text)</span>
                    </h3>
                    <button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg text-slate-400 hover:text-slate-600"></i></button>
                </div>

                <!-- Template Download Options -->
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                    <p class="font-bold text-xs text-slate-700"><i class="fa-solid fa-download text-emerald-600 mr-1"></i> Download Template Resmi:</p>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <button type="button" onclick="downloadQuestionImportTemplateWord()" class="py-2.5 px-3 bg-white border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 rounded-xl font-semibold text-xs flex items-center justify-center space-x-2 shadow-sm transition">
                            <i class="fa-solid fa-file-word text-blue-600"></i><span>Template Word (.docx/.doc)</span>
                        </button>
                        <button type="button" onclick="downloadQuestionImportTemplateExcel()" class="py-2.5 px-3 bg-white border border-slate-200 hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 rounded-xl font-semibold text-xs flex items-center justify-center space-x-2 shadow-sm transition">
                            <i class="fa-solid fa-file-excel text-emerald-600"></i><span>Template Excel (.xlsx)</span>
                        </button>
                    </div>
                    <button type="button" onclick="openTemplateGuideModal()" class="w-full mt-1 py-1.5 text-[11px] text-emerald-700 font-bold hover:underline text-center cursor-pointer">
                        <i class="fa-solid fa-circle-info mr-1"></i> Lihat Contoh Format Teks & Rumus Matematika
                    </button>
                </div>

                <!-- File Drop / Upload -->
                <div class="space-y-2">
                    <label class="block text-xs font-bold uppercase text-slate-700">Opsi 1: Upload File (.docx, .doc, .pdf, .html, .htm, .zip, .xlsx, .csv, .txt)</label>
                    <div class="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-4 text-center transition bg-slate-50/50">
                        <i class="fa-solid fa-cloud-arrow-up text-2xl text-slate-400 mb-1"></i>
                        <p class="text-xs text-slate-600 mb-2 font-medium">Pilih file Word, PDF, Web Page (HTML/ZIP), Excel, atau Teks dari komputer Anda</p>
                        <input type="file" id="question-import-file" accept=".docx, .doc, .pdf, .html, .htm, .zip, .xlsx, .xls, .csv, .txt" onchange="handleQuestionImportFile(event, '${code}')" class="w-full text-xs text-slate-500 file:mr-auto file:mx-auto file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-emerald-600 file:text-white hover:file:bg-emerald-700 cursor-pointer"/>
                    </div>
                </div>

                <!-- Direct Paste Option -->
                <div class="space-y-2 pt-2 border-t">
                    <label class="block text-xs font-bold uppercase text-slate-700">Opsi 2: Tempel Teks Soal Langsung (Copy-Paste)</label>
                    <textarea id="direct-import-textarea" rows="4" class="w-full p-3 bg-slate-50 border rounded-2xl text-xs font-mono" placeholder="1. Soal nomor satu...&#10;A. Pilihan A&#10;B. Pilihan B&#10;Kunci: B&#10;Pembahasan: Penjelasan..."></textarea>
                    <button type="button" onclick="handleQuestionDirectTextImport('${code}')" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl text-xs shadow transition">
                        <i class="fa-solid fa-file-import mr-1"></i> Proses Import dari Teks
                    </button>
                </div>

                <div class="flex justify-end pt-2 border-t">
                    <button type="button" onclick="closeModal()" class="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold">Tutup</button>
                </div>
            </div>
        </div>
    `;
}

function openTemplateGuideModal() {
    const modal = document.getElementById('modal-container');
    const guideHtml = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-y-auto">
            <div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-6 space-y-4 my-6">
                <div class="flex justify-between items-center pb-2 border-b">
                    <h3 class="font-bold text-slate-800 text-base flex items-center space-x-2">
                        <i class="fa-solid fa-book-open text-emerald-600"></i>
                        <span>Panduan Format Import Extraordinary CBT & Rumus Matematika</span>
                    </h3>
                    <button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg text-slate-400"></i></button>
                </div>
                
                <div class="space-y-3 text-xs text-slate-600 leading-relaxed max-h-[60vh] overflow-y-auto pr-1">
                    <div class="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 text-emerald-900 space-y-1">
                        <p class="font-bold"><i class="fa-solid fa-bolt text-emerald-600 mr-1"></i> Mode Impor Super Efisien (HTML / ZIP & Smart Auto-Detect):</p>
                        <p class="text-[11px]"><b>1. Ekspor Word ke Web Page / ZIP:</b> Buka dokumen Word Anda -> Pilih <b>File -> Save As -> Web Page (*.htm; *.html)</b>. Jika ada gambar, zip file HTML bersama folder gambarnya dan upload file <b>.zip</b> atau <b>.html</b> langsung!</p>
                        <p class="text-[11px]"><b>2. Smart Math Auto-Formatter (Tanpa Tanda $):</b> Sistem kini secara otomatis mengenali ekspresi rumus matematika standar Word/Teks biasa seperti <code class="bg-emerald-100 px-1 rounded font-mono">(-2)^4</code>, <code class="bg-emerald-100 px-1 rounded font-mono">a^8b^3c^4 / a^2b^2c</code>, <code class="bg-emerald-100 px-1 rounded font-mono">3√5</code>, <code class="bg-emerald-100 px-1 rounded font-mono">^2Log 16</code>, <code class="bg-emerald-100 px-1 rounded font-mono">(fog)(x)</code>, dan <code class="bg-emerald-100 px-1 rounded font-mono">f^-1(x)</code> tanpa mengharuskan Anda mengetik tanda <code class="bg-emerald-100 px-1 rounded font-mono">$</code>!</p>
                    </div>

                    <div class="bg-amber-50 p-3 rounded-2xl border border-amber-200 text-amber-900 space-y-1">
                        <p class="font-bold"><i class="fa-solid fa-table-cells mr-1"></i> Format Tabel Extraordinary CBT Word:</p>
                        <p class="text-[11px]">Sistem mengenali tabel <b>Extraordinary CBT by shellrean</b> secara otomatis:</p>
                        <ul class="list-disc list-inside space-y-0.5 ml-1 font-mono text-[11px]">
                            <li><code class="bg-amber-100 px-1 rounded font-bold">TS</code>: Tipe Soal (<code class="bg-amber-100 px-1 rounded">PG</code> = Pilihan Ganda, <code class="bg-amber-100 px-1 rounded">ESY</code> = Essay/Uraian)</li>
                            <li><code class="bg-amber-100 px-1 rounded font-bold">KD</code>: Kode Kompetensi Dasar (misal <code class="bg-amber-100 px-1 rounded">1.0.1</code>)</li>
                            <li><code class="bg-amber-100 px-1 rounded font-bold">KJ</code>: Kunci Jawaban (<code class="bg-amber-100 px-1 rounded">A</code>, <code class="bg-amber-100 px-1 rounded">B</code>, <code class="bg-amber-100 px-1 rounded">C</code>, <code class="bg-amber-100 px-1 rounded">D</code>, <code class="bg-amber-100 px-1 rounded">E</code> atau teks kunci essay)</li>
                            <li><code class="bg-amber-100 px-1 rounded font-bold">ABS</code>: Acak/Absolut (Bisa dikosongkan)</li>
                            <li>Baris Nomor <code class="bg-amber-100 px-1 rounded font-bold">1.</code>, <code class="bg-amber-100 px-1 rounded font-bold">2.</code>: Isi Teks Soal</li>
                            <li>Baris <code class="bg-amber-100 px-1 rounded font-bold">A</code>, <code class="bg-amber-100 px-1 rounded font-bold">B</code>, <code class="bg-amber-100 px-1 rounded font-bold">C</code>, <code class="bg-amber-100 px-1 rounded font-bold">D</code>, <code class="bg-amber-100 px-1 rounded font-bold">E</code>: Pilihan Jawaban</li>
                        </ul>
                    </div>

                    <div class="bg-blue-50 p-3 rounded-2xl border border-blue-200 text-blue-900 space-y-1">
                        <p class="font-bold"><i class="fa-solid fa-square-root-variable mr-1"></i> Cara Memasukkan Rumus Matematika (Gunakan Simbol $ ... $):</p>
                        <p class="text-[11px]">Cukup apit rumus menggunakan tanda <code class="bg-blue-100 px-1 py-0.5 rounded font-mono">$...$</code> di Word:</p>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono mt-1">
                            <div class="bg-white p-2 rounded-xl border border-blue-100">
                                <b class="text-blue-700">1. Pangkat / Eksponen:</b><br/>
                                <code class="bg-blue-50 px-1 rounded">$(-2)^4$</code><br/>
                                <code class="bg-blue-50 px-1 rounded">$(2x^2y)^0$</code><br/>
                                <code class="bg-blue-50 px-1 rounded">$3^2 \\times 81 = 3^n$</code>
                            </div>
                            <div class="bg-white p-2 rounded-xl border border-blue-100">
                                <b class="text-blue-700">2. Pecahan / Pembagian:</b><br/>
                                <code class="bg-blue-50 px-1 rounded">$\\frac{a^8 b^3 c^4}{a^2 b^2 c}$</code><br/>
                                <code class="bg-blue-50 px-1 rounded">$\\frac{6^2 + 8^2}{2^2}$</code><br/>
                                <code class="bg-blue-50 px-1 rounded">$\\frac{3-4x}{x+3}$</code>
                            </div>
                            <div class="bg-white p-2 rounded-xl border border-blue-100">
                                <b class="text-blue-700">3. Bentuk Akar:</b><br/>
                                <code class="bg-blue-50 px-1 rounded">$\\sqrt[3]{5^5}$</code><br/>
                                <code class="bg-blue-50 px-1 rounded">$3\\sqrt{5} + 4\\sqrt{5}$</code><br/>
                                <code class="bg-blue-50 px-1 rounded">$2\\sqrt{50} + 3\\sqrt{8}$</code>
                            </div>
                            <div class="bg-white p-2 rounded-xl border border-blue-100">
                                <b class="text-blue-700">4. Logaritma & Fungsi:</b><br/>
                                <code class="bg-blue-50 px-1 rounded">$^2\\log 16$</code><br/>
                                <code class="bg-blue-50 px-1 rounded">$(f \\circ g)(x)$</code><br/>
                                <code class="bg-blue-50 px-1 rounded">$f^{-1}(x) = \\frac{x-2}{5}$</code>
                            </div>
                        </div>
                    </div>

                    <div class="space-y-1">
                        <p class="font-bold text-slate-800">Contoh Tabel Extraordinary CBT dengan Rumus Matematika:</p>
                        <pre class="bg-slate-900 text-emerald-300 p-4 rounded-2xl font-mono text-[11px] overflow-x-auto whitespace-pre-wrap select-all">
TS  | PG
KD  | 1.0.1
KJ  | E
ABS | 
1.  | Nilai dari $(-2)^4$ adalah ....
A   | 4
B   | -8
C   | 8
D   | -16
E   | 16

TS  | PG
KD  | 1.0.1
KJ  | A
ABS | 
2.  | Nilai dari $\\frac{a^8 b^3 c^4}{a^2 b^2 c}$ adalah ....
A   | $a^6 b c^3$
B   | $a^3 b^2 c^3$
C   | $a^6 b^4 c^3$
D   | $a^3 b^2 c^5$
E   | $a^6 b^3 c^2$
                        </pre>
                    </div>
                </div>

                <div class="flex justify-end space-x-2 pt-2 border-t">
                    <button type="button" onclick="downloadQuestionImportTemplateWord()" class="px-4 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold cursor-pointer">
                        <i class="fa-solid fa-file-word mr-1"></i> Unduh Template Word (.doc)
                    </button>
                    <button type="button" onclick="closeModal()" class="px-5 py-2 bg-slate-800 text-white rounded-xl text-xs font-semibold">Mengerti</button>
                </div>
            </div>
        </div>
    `;
    modal.innerHTML = guideHtml;
}

function downloadQuestionImportTemplateWord() {
    const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <meta charset='utf-8'>
            <title>Extraordinary CBT Template by shellrean</title>
            <style>
                body { font-family: Arial, sans-serif; font-size: 11pt; line-height: 1.5; color: #000; }
                h3 { font-size: 14pt; font-weight: bold; margin-bottom: 8px; }
                .perhatian { font-size: 10pt; margin-bottom: 12px; }
                .tipe-soal { font-size: 10pt; margin-bottom: 16px; }
                table { width: 100%; border-collapse: collapse; margin-bottom: 20px; page-break-inside: avoid; }
                td, th { border: 1px solid #000; padding: 5px 8px; font-size: 10pt; vertical-align: top; }
                .bg-ts { background-color: #FFF2CC; font-weight: bold; width: 60px; }
                .bg-ts-val { background-color: #FFF2CC; font-weight: bold; }
                .bg-kj { background-color: #E2EFDA; font-weight: bold; width: 60px; }
                .bg-kj-val { background-color: #E2EFDA; }
                .no-col { width: 35px; font-weight: bold; text-align: center; }
            </style>
        </head>
        <body>
            <h3>Extraordinary CBT Template by shellrean</h3>
            <div class="perhatian">
                <b>Perhatian:</b><br/>
                1. Dilarang membuat table selain format Extraordinary CBT<br/>
                2. Dilarang menyimpan floating image<br/>
            </div>
            <div class="tipe-soal">
                <b>Tipe soal wajib diisi pada baris [TS]</b><br/>
                1. PG : Pilihan ganda<br/>
                2. PGX : Pilihan ganda kompleks<br/>
                3. ESY : Esay / Uraian<br/>
                4. SKT : Isian singkat<br/>
                5. JD : Menjodohkan 1-1<br/>
                6. JDX : Menjodohkan 1-X<br/>
                7. URT : Mengurutkan<br/>
                8. STJ : Setuju tidak setuju<br/>
                9. BNR : Benar salah<br/>
            </div>
            <p style="font-size: 10pt; font-style: italic; margin-bottom: 15px;">Tipe soal pilihan ganda, disini kita mengisi TS dengan PG. Yang harus diperhatikan disini adalah KJ pastikan KJ tersedia pada opsi.</p>

            <!-- Soal 1: Eksponen -->
            <table>
                <tr><td class="bg-ts">TS</td><td class="bg-ts-val">PG</td></tr>
                <tr><td class="bg-ts">KD</td><td class="bg-ts-val">1.0.1</td></tr>
                <tr><td class="bg-kj">KJ</td><td class="bg-kj-val">E</td></tr>
                <tr><td class="bg-kj">ABS</td><td class="bg-kj-val"></td></tr>
                <tr><td class="no-col">1.</td><td>Nilai dari $(-2)^4$ adalah ....</td></tr>
                <tr><td class="no-col">A</td><td>4</td></tr>
                <tr><td class="no-col">B</td><td>-8</td></tr>
                <tr><td class="no-col">C</td><td>8</td></tr>
                <tr><td class="no-col">D</td><td>-16</td></tr>
                <tr><td class="no-col">E</td><td>16</td></tr>
            </table>

            <!-- Soal 2: Pecahan Eksponen -->
            <table>
                <tr><td class="bg-ts">TS</td><td class="bg-ts-val">PG</td></tr>
                <tr><td class="bg-ts">KD</td><td class="bg-ts-val">1.0.1</td></tr>
                <tr><td class="bg-kj">KJ</td><td class="bg-kj-val">A</td></tr>
                <tr><td class="bg-kj">ABS</td><td class="bg-kj-val"></td></tr>
                <tr><td class="no-col">2.</td><td>Nilai dari $\\frac{a^8 b^3 c^4}{a^2 b^2 c}$ adalah ....</td></tr>
                <tr><td class="no-col">A</td><td>$a^6 b c^3$</td></tr>
                <tr><td class="no-col">B</td><td>$a^3 b^2 c^3$</td></tr>
                <tr><td class="no-col">C</td><td>$a^6 b^4 c^3$</td></tr>
                <tr><td class="no-col">D</td><td>$a^3 b^2 c^5$</td></tr>
                <tr><td class="no-col">E</td><td>$a^6 b^3 c^2$</td></tr>
            </table>

            <!-- Soal 3: Bentuk Akar -->
            <table>
                <tr><td class="bg-ts">TS</td><td class="bg-ts-val">PG</td></tr>
                <tr><td class="bg-ts">KD</td><td class="bg-ts-val">1.0.1</td></tr>
                <tr><td class="bg-kj">KJ</td><td class="bg-kj-val">A</td></tr>
                <tr><td class="bg-kj">ABS</td><td class="bg-kj-val"></td></tr>
                <tr><td class="no-col">3.</td><td>Bentuk lain dari $\\sqrt[3]{5^5}$ adalah ....</td></tr>
                <tr><td class="no-col">A</td><td>$5^{\\frac{5}{3}}$</td></tr>
                <tr><td class="no-col">B</td><td>$5^{\\frac{3}{5}}$</td></tr>
                <tr><td class="no-col">C</td><td>$5^{\\frac{3}{3}}$</td></tr>
                <tr><td class="no-col">D</td><td>$3^{\\frac{3}{5}}$</td></tr>
                <tr><td class="no-col">E</td><td>$3^{\\frac{5}{3}}$</td></tr>
            </table>

            <!-- Soal 4: Logaritma -->
            <table>
                <tr><td class="bg-ts">TS</td><td class="bg-ts-val">PG</td></tr>
                <tr><td class="bg-ts">KD</td><td class="bg-ts-val">1.0.1</td></tr>
                <tr><td class="bg-kj">KJ</td><td class="bg-kj-val">C</td></tr>
                <tr><td class="bg-kj">ABS</td><td class="bg-kj-val"></td></tr>
                <tr><td class="no-col">4.</td><td>Nilai dari $^5\\log 25 + ^3\\log 27$ adalah ....</td></tr>
                <tr><td class="no-col">A</td><td>5</td></tr>
                <tr><td class="no-col">B</td><td>6</td></tr>
                <tr><td class="no-col">C</td><td>5</td></tr>
                <tr><td class="no-col">D</td><td>8</td></tr>
                <tr><td class="no-col">E</td><td>9</td></tr>
            </table>

            <!-- Soal 5: Fungsi Invers (Uraian / Essay) -->
            <table>
                <tr><td class="bg-ts">TS</td><td class="bg-ts-val">ESY</td></tr>
                <tr><td class="bg-ts">KD</td><td class="bg-ts-val">1.0.1</td></tr>
                <tr><td class="bg-kj">KJ</td><td class="bg-kj-val">$f^{-1}(x) = \\frac{x-2}{5}$</td></tr>
                <tr><td class="bg-kj">ABS</td><td class="bg-kj-val"></td></tr>
                <tr><td class="no-col">5.</td><td>Jika $f(x) = 5x + 2$, tentukan invers dari fungsi $f(x)$!</td></tr>
            </table>
        </body>
        </html>
    `;
    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'Extraordinary_CBT_Template_Matematika.doc';
    a.click();
    showToast('Template Extraordinary CBT Word Matematika berhasil diunduh!', 'success');
}

function downloadQuestionImportTemplateExcel() {
    if (!window.XLSX) {
        showToast('Library SheetJS belum siap.', 'error');
        return;
    }

    const templateData = [
        ["No", "Soal", "Gambar_URL", "Opsi_A", "Opsi_B", "Opsi_C", "Opsi_D", "Opsi_E", "Kunci_Jawaban", "Jenis_Soal", "Pembahasan"],
        [1, "Berapakah nilai x dari $3x - 6 = 12$?", "", "x = 4", "x = 6", "x = 8", "x = 10", "x = 12", "B", "PG", "3x = 18 maka x = 6"],
        [2, "Sebutkan rukun Islam yang pertama!", "", "", "", "", "", "", "Syahadat", "Essay", "Rukun islam pertama adalah syahadat."]
    ];

    const ws = XLSX.utils.aoa_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Template_Soal");
    XLSX.writeFile(wb, "Template_Import_Soal_Madrasah.xlsx");
    showToast('Template Excel (.xlsx) berhasil diunduh!', 'success');
}

function autoFormatMathExpressions(str) {
    if (!str) return '';
    let s = String(str).trim();
    if (!s) return '';

    // If string already contains explicit $ or \( or \[
    if (s.includes('$') || s.includes('\\(') || s.includes('\\[')) {
        return s;
    }

    // If string contains raw LaTeX commands (e.g. \frac{a}{b}, \sqrt{x}, \alpha, \times, etc.)
    if (/\\(frac|sqrt|text|begin|end|alpha|beta|gamma|theta|pi|infty|sum|int|lim|times|div|pm|le|ge|neq|approx|cdot|circ)/i.test(s)) {
        // Auto-wrap raw LaTeX command in math delimiters $ ... $
        return `$${s}$`;
    }

    // Convert Unicode superscripts: x², x³, x⁴, aⁿ
    s = s.replace(/([a-zA-Z0-9_\)\>]+)[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, function(match, base) {
        const supMap = {'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'};
        let exp = match.slice(base.length).split('').map(c => supMap[c] || c).join('');
        return `$${base}^{${exp}}$`;
    });

    // Convert Unicode subscripts: x₁, x₂
    s = s.replace(/([a-zA-Z0-9_\)\>]+)[₀₁₂₃₄₅₆₇₈₉]+/g, function(match, base) {
        const subMap = {'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'};
        let sub = match.slice(base.length).split('').map(c => subMap[c] || c).join('');
        return `$${base}_{${sub}}$`;
    });

    // Auto-detect math formulas without '$' and convert them
    // Exponents: (-2)^4, (2x^2y)^0, 3^2, 3^n, x^2
    s = s.replace(/(\(?[-+]?\w+\)?)\^(\w+|\(?[-+]?\d+\)?)/g, '$$$1^{$2}$$');

    // Square roots: √5, 3√5, √16, 2√50
    s = s.replace(/(\d*)\s*√(\w+|\d+)/g, '$$$1\\sqrt{$2}$$');

    // Logarithms: ^2Log 16, ^5Log 25, ^3Log 27
    s = s.replace(/\^(\d+)\s*(Log|log)\s*(\d+|\w+)/gi, '$$^{$1}\\text{Log } $3$$');

    // Composite & Inverse Functions: (fog)(x), f^-1(x)
    s = s.replace(/\(fog\)\(([^)]+)\)/gi, '$$(f \\circ g)($1)$$');
    s = s.replace(/f\^-1\(([^)]+)\)/gi, '$$f^{-1}($1)$$');

    // Fractions: (6^2+8^2)/2^2 or (3-4x)/(x+3)
    s = s.replace(/(\([^)]+\)|[a-zA-Z0-9^]+)\s*\/\s*(\([^)]+\)|[a-zA-Z0-9^]+)/g, function(m, num, den) {
        let cleanNum = num.replace(/^\(|\)$/g, '');
        let cleanDen = den.replace(/^\(|\)$/g, '');
        return `$\\frac{${cleanNum}}{${cleanDen}}$`;
    });

    s = s.replace(/\$\$/g, '$');
    return s;
}

function cleanAndFormatMathCellContent(cell) {
    if (!cell) return '';

    let inner = cell.innerHTML ? cell.innerHTML.trim() : '';

    inner = inner.replace(/([a-zA-Z0-9_\)\>]+)\s*<sup>([\s\S]*?)<\/sup>/gi, function(match, base, exp) {
        const cleanExp = exp.replace(/<[^>]+>/g, '').trim();
        const cleanBase = base.replace(/<[^>]+>/g, '').trim();
        return `$${cleanBase}^{${cleanExp}}$`;
    });

    inner = inner.replace(/<sup>([\s\S]*?)<\/sup>\s*(Log|log)/gi, function(match, exp, log) {
        const cleanExp = exp.replace(/<[^>]+>/g, '').trim();
        return `$^${cleanExp}\\text{Log}$`;
    });

    inner = inner.replace(/<sub>([\s\S]*?)<\/sub>/gi, function(match, sub) {
        const cleanSub = sub.replace(/<[^>]+>/g, '').trim();
        return `$_{${cleanSub}}$`;
    });

    const temp = document.createElement('div');
    temp.innerHTML = inner;

    // Remove hr and img elements
    temp.querySelectorAll('hr').forEach(hr => hr.remove());
    const imgs = temp.querySelectorAll('img');
    imgs.forEach(img => img.remove());

    let textContent = temp.textContent || temp.innerText || '';
    textContent = textContent.replace(/^[\-\—\–\―]{2,}$/gm, '').trim();

    let formattedText = autoFormatMathExpressions(textContent);

    return formattedText.trim();
}

function handleQuestionImportFile(e, code) {
    const file = e.target.files[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();

    if (fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv')) {
        // Excel Import
        const reader = new FileReader();
        reader.onload = function(evt) {
            try {
                const data = new Uint8Array(evt.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (rows.length < 2) {
                    showToast('File Excel kosong atau format tidak sesuai.', 'error');
                    return;
                }

                const group = appState.questionBankGroups.find(bg => String(bg.code) === String(code));
                let addedCount = 0;

                for (let i = 1; i < rows.length; i++) {
                    const row = rows[i];
                    if (!row || row.length === 0 || !row[1]) continue;

                    const qText = autoFormatMathExpressions(String(row[1] || '').trim());
                    const imgUrl = String(row[2] || '').trim();
                    const optA = autoFormatMathExpressions(String(row[3] || '').trim());
                    const optB = autoFormatMathExpressions(String(row[4] || '').trim());
                    const optC = autoFormatMathExpressions(String(row[5] || '').trim());
                    const optD = autoFormatMathExpressions(String(row[6] || '').trim());
                    const optE = autoFormatMathExpressions(String(row[7] || '').trim());
                    const keyVal = String(row[8] || '').trim();
                    const kindVal = String(row[9] || '').trim().toLowerCase();
                    const expVal = autoFormatMathExpressions(String(row[10] || '').trim());

                    let options = [optA, optB, optC, optD, optE].filter(o => o !== '');
                    const isEssay = kindVal === 'essay' || kindVal === 'esy' || options.length === 0;

                    let answerKey = keyVal;
                    if (!isEssay) {
                        const keyUpper = keyVal.toUpperCase();
                        if (['A', 'B', 'C', 'D', 'E'].includes(keyUpper)) {
                            const idx = keyUpper.charCodeAt(0) - 65;
                            if (options[idx]) answerKey = options[idx];
                        }
                    }

                    appState.questionBank.push({
                        id: 'Q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                        code: code,
                        subjectId: group ? group.subjectId : (appState.subjects[0]?.id || ''),
                        classId: group ? group.classId : (appState.classes[0]?.id || ''),
                        type: isEssay ? 'essay' : 'mc',
                        question: qText,
                        imageUrl: imgUrl,
                        options: isEssay ? [] : (options.length > 0 ? options : ['A', 'B', 'C', 'D', 'E']),
                        answer: answerKey || (isEssay ? 'Jawaban' : (options[0] || 'A')),
                        explanation: expVal
                    });
                    addedCount++;
                }

                saveState('questionBank');
                closeModal();
                showToast(`Berhasil import ${addedCount} soal dari Excel!`, 'success');
                renderQuestionBankModule(document.getElementById('view-container'));
            } catch (err) {
                console.error('Excel import error:', err);
                showToast('Gagal membaca file Excel. Pastikan format sesuai template.', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    } else if (fileName.endsWith('.zip') && window.JSZip) {
        // ZIP Archive containing HTML & Images
        const reader = new FileReader();
        reader.onload = async function(evt) {
            try {
                const zip = await window.JSZip.loadAsync(evt.target.result);
                let htmlFile = null;

                zip.forEach((relativePath, file) => {
                    if (!file.dir && (relativePath.endsWith('.html') || relativePath.endsWith('.htm'))) {
                        if (!htmlFile || relativePath.toLowerCase().includes('index') || relativePath.toLowerCase().includes('default')) {
                            htmlFile = file;
                        }
                    }
                });

                if (!htmlFile) {
                    showToast('File HTML (.html / .htm) tidak ditemukan di dalam archive ZIP.', 'error');
                    return;
                }

                let htmlText = await htmlFile.async('text');

                const imageEntries = [];
                zip.forEach((relativePath, file) => {
                    if (!file.dir && /\.(png|jpe?g|gif|webp|svg)$/i.test(relativePath)) {
                        imageEntries.push({ path: relativePath, file });
                    }
                });

                for (const imgEntry of imageEntries) {
                    const base64Data = await imgEntry.file.async('base64');
                    const ext = imgEntry.path.split('.').pop().toLowerCase();
                    const mimeType = ext === 'svg' ? 'image/svg+xml' : (ext === 'jpg' ? 'image/jpeg' : `image/${ext}`);
                    const dataUrl = `data:${mimeType};base64,${base64Data}`;

                    const cleanImgName = imgEntry.path.split('/').pop();
                    const regex = new RegExp(`(src=["'])([^"']*${cleanImgName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})(["'])`, 'gi');
                    htmlText = htmlText.replace(regex, `$1${dataUrl}$3`);
                }

                parseQuestionsFromTextOrHtml(htmlText, code);
                showToast('Berhasil membaca file HTML & Gambar dari ZIP!', 'success');
            } catch (err) {
                console.error('ZIP import error:', err);
                showToast('Gagal memproses file ZIP. Pastikan berisi file HTML & folder gambar Word.', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    } else if (fileName.endsWith('.html') || fileName.endsWith('.htm')) {
        // Standalone HTML / Web Page Import
        const reader = new FileReader();
        reader.onload = function(evt) {
            parseQuestionsFromTextOrHtml(evt.target.result, code);
        };
        reader.readAsText(file);
    } else if (fileName.endsWith('.pdf')) {
        // PDF Import using PDF.js
        const reader = new FileReader();
        reader.onload = async function(evt) {
            try {
                if (!window.pdfjsLib) {
                    showToast('Library PDF.js sedang dimuat, coba beberapa detik lagi.', 'error');
                    return;
                }
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdfjs/pdf.worker.min.js';
                const pdfData = new Uint8Array(evt.target.result);
                const pdf = await window.pdfjsLib.getDocument({ data: pdfData }).promise;
                
                let fullText = '';
                for (let i = 1; i <= pdf.numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    let lastY;
                    let text = '';
                    for (const item of textContent.items) {
                        if (lastY !== undefined && Math.abs(lastY - item.transform[5]) > 2) {
                            text += '\n';
                        } else if (lastY !== undefined && text.length > 0 && !text.endsWith(' ')) {
                            text += ' ';
                        }
                        text += item.str;
                        lastY = item.transform[5];
                    }
                    fullText += text + '\n\n';
                }

                parseQuestionsFromTextOrHtml(fullText, code);
                showToast('Berhasil membaca & mengekstrak teks dari file PDF!', 'success');
            } catch (err) {
                console.error('PDF import error:', err);
                showToast('Gagal membaca file PDF. Pastikan file tidak dikunci/password.', 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    } else if (fileName.endsWith('.docx')) {
        const processDocx = (mammothInstance) => {
            const reader = new FileReader();
            reader.onload = function(evt) {
                const arrayBuffer = evt.target.result;
                mammothInstance.convertToHtml({ arrayBuffer: arrayBuffer })
                    .then(function(result) {
                        const htmlContent = result.value;
                        parseQuestionsFromTextOrHtml(htmlContent, code);
                    })
                    .catch(function(err) {
                        console.warn('Mammoth import failed, falling back to raw text:', err);
                        const text = new TextDecoder('utf-8').decode(arrayBuffer);
                        parseQuestionsFromTextOrHtml(text, code);
                    });
            };
            reader.readAsArrayBuffer(file);
        };

        if (window.mammoth) {
            processDocx(window.mammoth);
        } else {
            import('mammoth').then(mod => {
                window.mammoth = mod.default || mod;
                processDocx(window.mammoth);
            }).catch(err => {
                console.error("Failed to load mammoth", err);
                const reader = new FileReader();
                reader.onload = function(evt) {
                    parseQuestionsFromTextOrHtml(evt.target.result, code);
                };
                reader.readAsText(file);
            });
        }
    } else {
        // Plain Text or .doc fallback
        const reader = new FileReader();
        reader.onload = function(evt) {
            parseQuestionsFromTextOrHtml(evt.target.result, code);
        };
        reader.readAsText(file);
    }
}

function handleQuestionDirectTextImport(code) {
    const textarea = document.getElementById('direct-import-textarea');
    if (!textarea || !textarea.value.trim()) {
        showToast('Ketik atau tempel teks soal terlebih dahulu.', 'error');
        return;
    }
    parseQuestionsFromTextOrHtml(textarea.value, code);
}

function parseQuestionsFromTextOrHtml(rawContent, code) {
    if (!rawContent) return;

    const group = appState.questionBankGroups.find(bg => String(bg.code) === String(code));
    let questionsToAdd = [];

    // 1. Extraordinary CBT Table Parser (if HTML tables are present from Mammoth / Word HTML)
    if (/<table[^>]*>/i.test(rawContent)) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = rawContent;
        const tables = tempDiv.querySelectorAll('table');

        tables.forEach(table => {
            const trs = Array.from(table.querySelectorAll('tr'));
            if (trs.length === 0) return;

            let ts = 'PG';
            let kd = '';
            let kj = '';
            let qText = '';
            let imgUrl = '';
            let options = [];
            let exp = '';

            trs.forEach(tr => {
                const cells = Array.from(tr.querySelectorAll('td, th')).map(c => {
                    const img = c.querySelector('img');
                    if (img && img.src && !imgUrl) {
                        imgUrl = img.src;
                    }
                    return cleanAndFormatMathCellContent(c);
                });

                if (cells.length === 0) return;

                const c0 = (cells[0] || '').trim();
                const c1 = cells.length > 1 ? (cells[1] || '').trim() : '';
                const c0Upper = c0.toUpperCase();

                if (c0Upper === 'TS') {
                    ts = c1.toUpperCase() || 'PG';
                } else if (c0Upper === 'KD') {
                    kd = c1;
                } else if (c0Upper === 'KJ') {
                    kj = c1;
                } else if (c0Upper === 'ABS') {
                    // ABS cell, skip
                } else if (/^\d+[\.\)]?$/.test(c0) || (/^\d+[\.\)]\s/.test(c0) && !qText)) {
                    qText = c1 || c0.replace(/^\d+[\.\)]\s*/, '');
                } else if (/^[A-E][\.\)]?$/i.test(c0)) {
                    if (c1) options.push(c1);
                } else if (c0Upper.startsWith('PEMBAHASAN') || c0Upper.startsWith('EXPLANATION')) {
                    exp = c1 || c0.replace(/^(PEMBAHASAN|EXPLANATION)[:\s]*/i, '');
                } else if (!qText && c0 && !['TS','KD','KJ','ABS'].includes(c0Upper)) {
                    qText = c0;
                }
            });

            if (qText) {
                const isEssay = ts.includes('ESY') || ts.includes('ESSAY') || options.length === 0;
                let answerKey = kj;
                if (!isEssay && ['A', 'B', 'C', 'D', 'E'].includes(kj.toUpperCase())) {
                    const idx = kj.toUpperCase().charCodeAt(0) - 65;
                    if (options[idx]) answerKey = options[idx];
                }

                questionsToAdd.push({
                    id: 'Q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
                    code: code,
                    subjectId: group ? group.subjectId : (appState.subjects[0]?.id || ''),
                    classId: group ? group.classId : (appState.classes[0]?.id || ''),
                    type: isEssay ? 'essay' : 'mc',
                    question: qText,
                    imageUrl: imgUrl || '',
                    options: isEssay ? [] : (options.length > 0 ? options : ['A', 'B', 'C', 'D', 'E']),
                    answer: answerKey || (isEssay ? 'Jawaban' : (options[0] || 'A')),
                    explanation: exp || ''
                });
            }
        });

        if (questionsToAdd.length > 0) {
            appState.questionBank.push(...questionsToAdd);
            saveState('questionBank');
            closeModal();
            showToast(`Berhasil mengimpor ${questionsToAdd.length} butir soal Extraordinary CBT!`, 'success');
            renderQuestionBankModule(document.getElementById('view-container'));
            return;
        }
    }

    // 2. Line-by-Line Fallback Parser (for plain text, Extraordinary CBT text lines, or non-table imports)
    let processed = rawContent.replace(/<img\s+[^>]*src=["']([^"']+)["'][^>]*>/gi, '\n[Gambar: $1]\n')
                               .replace(/<br\s*[\/]?>/gi, '\n')
                               .replace(/<\/p>/gi, '\n')
                               .replace(/<\/div>/gi, '\n')
                               .replace(/<\/tr>/gi, '\n')
                               .replace(/<\/li>/gi, '\n');

    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = processed;
    let cleanText = tempDiv.textContent || tempDiv.innerText || processed;

    cleanText = cleanText.replace(/Extraordinary CBT Template by shellrean/gi, '')
                        .replace(/TEMPLATE IMPORT SOAL MADRASAH/gi, '');

    const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(l => l);

    let addedCount = 0;
    let currentQ = null;
    let currentOptions = [];
    let currentAnswer = '';
    let currentImg = '';
    let currentExp = '';
    let currentTS = 'PG';

    const saveCurrent = () => {
        if (!currentQ || !currentQ.question) return;

        const qTextLower = currentQ.question.toLowerCase();
        const ansLower = String(currentAnswer || '').toLowerCase();
        const isEssay = currentTS.includes('ESY') || currentTS.includes('ESSAY') || currentOptions.length === 0 || qTextLower.includes('esay') || qTextLower.includes('essay') || ansLower.includes('esay') || ansLower.includes('essay');

        let answerKey = String(currentAnswer || '').replace(/\s*\((essay|esay)\)/i, '').trim();
        if (!isEssay) {
            const keyUpper = String(answerKey || '').toUpperCase();
            if (['A', 'B', 'C', 'D', 'E'].includes(keyUpper)) {
                const idx = keyUpper.charCodeAt(0) - 65;
                if (currentOptions[idx]) answerKey = currentOptions[idx];
            }
        }

        const finalQuestionText = autoFormatMathExpressions(currentQ.question.replace(/\s*\((essay|esay)\)/i, '').trim());
        const finalOptions = isEssay ? [] : (currentOptions.length > 0 ? currentOptions.map(opt => autoFormatMathExpressions(opt)) : ['A', 'B', 'C', 'D', 'E']);
        const finalExp = autoFormatMathExpressions(currentExp || '');

        appState.questionBank.push({
            id: 'Q_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            code: code,
            subjectId: group ? group.subjectId : (appState.subjects[0]?.id || ''),
            classId: group ? group.classId : (appState.classes[0]?.id || ''),
            type: isEssay ? 'essay' : 'mc',
            question: finalQuestionText,
            imageUrl: currentImg || '',
            options: finalOptions,
            answer: autoFormatMathExpressions(answerKey || (isEssay ? 'Jawaban' : (finalOptions[0] || 'A'))),
            explanation: finalExp
        });
        addedCount++;
        
        currentQ = null;
        currentOptions = [];
        currentAnswer = '';
        currentImg = '';
        currentExp = '';
        currentTS = 'PG';
    };

    lines.forEach(line => {
        const uLine = line.toUpperCase();
        if (uLine.startsWith('TS')) {
            const val = line.replace(/^TS[:\s]*/i, '').trim().toUpperCase();
            if (val) currentTS = val;
        } else if (uLine.startsWith('KD')) {
            // KD line, skip or store
        } else if (uLine.startsWith('KJ')) {
            currentAnswer = line.replace(/^KJ[:\s]*/i, '').trim();
        } else if (uLine.startsWith('ABS')) {
            // ABS line, skip
        } else if (/^\d+[\.\)]\s?/.test(line)) {
            saveCurrent();
            const qText = line.replace(/^\d+[\.\)]\s*/, '');
            currentQ = { question: qText };
        } else if (/^\[Gambar:\s*(.*?)\]/i.test(line)) {
            const match = line.match(/^\[Gambar:\s*(.*?)\]/i);
            if (match && match[1]) currentImg = match[1].trim();
        } else if (/^[A-Ea-e][\.\)]\s/.test(line) || (currentQ && /^[A-Ea-e]\s/.test(line))) {
            const optText = line.replace(/^[A-Ea-e][\.\)]?\s*/, '');
            currentOptions.push(optText);
        } else if (currentQ && /^[A-Ea-e]$/.test(line)) {
            // Option letter on its own line, push an empty option to be filled by the next line
            currentOptions.push('');
        } else if (/^(kunci\s*jawaban|kunci|jawaban|ans)[:\s]/i.test(line)) {
            currentAnswer = line.replace(/^(kunci\s*jawaban|kunci|jawaban|ans)[:\s]*/i, '').trim();
        } else if (/^(pembahasan|penjelasan|expl)[:\s]/i.test(line)) {
            currentExp = line.replace(/^(pembahasan|penjelasan|expl)[:\s]*/i, '').trim();
        } else if (currentQ) {
            if (currentExp) {
                currentExp += ' ' + line;
            } else if (currentOptions.length > 0 && currentOptions[currentOptions.length - 1] === '') {
                // Fill the empty option that was just a letter on the previous line
                currentOptions[currentOptions.length - 1] = line;
            } else if (currentOptions.length > 0) {
                currentOptions[currentOptions.length - 1] += ' ' + line;
            } else {
                currentQ.question += (currentQ.question ? ' ' : '') + line;
            }
        } else {
            if (line.length > 2 && !['TS','KD','KJ','ABS','PERHATIAN'].includes(uLine)) {
                saveCurrent();
                currentQ = { question: line };
            }
        }
    });
    saveCurrent();

    saveState('questionBank');
    closeModal();
    showToast(`Berhasil mengimpor ${addedCount} butir soal!`, 'success');
    renderQuestionBankModule(document.getElementById('view-container'));
}

// Exports
window.renderQuestionBankModule = renderQuestionBankModule;
window.selectQuestionBankGroup = selectQuestionBankGroup;
window.openQuestionBankGroupModal = openQuestionBankGroupModal;
window.saveQuestionBankGroup = saveQuestionBankGroup;
window.deleteQuestionBankGroup = deleteQuestionBankGroup;
window.deleteIndividualQuestion = deleteIndividualQuestion;
window.openAIGeneratorModal = openAIGeneratorModal;
window.executeNonAIGenerator = executeNonAIGenerator;
window.executeAIGenerator = executeAIGenerator;
window.generateEnrichmentNonAI = generateEnrichmentNonAI;
window.downloadWordTemplate = downloadWordTemplate;
window.openPreviewQuestionBankModal = openPreviewQuestionBankModal;
window.togglePreviewAnswers = togglePreviewAnswers;
window.togglePreviewExplanations = togglePreviewExplanations;
window.printQuestionPaper = printQuestionPaper;
window.downloadWordFromPreview = downloadWordFromPreview;
window.openQuestionImportModal = openQuestionImportModal;
window.openConvertQuestionModal = openConvertQuestionModal;
window.autoConvertMathToLatex = autoConvertMathToLatex;
window.loadActiveBankQuestionsToConvert = loadActiveBankQuestionsToConvert;
window.runQuestionConversion = runQuestionConversion;
window.parseRawTextToCBTFormat = parseRawTextToCBTFormat;
window.switchConvertTab = switchConvertTab;
window.copyConvertedTextToClipboard = copyConvertedTextToClipboard;
window.downloadConvertedTextFile = downloadConvertedTextFile;
window.downloadConvertedWordDoc = downloadConvertedWordDoc;
window.handleConvertWordFileUpload = handleConvertWordFileUpload;
window.parseWordHtmlToText = parseWordHtmlToText;
window.downloadQuestionImportTemplate = downloadQuestionImportTemplateWord;
window.downloadQuestionImportTemplateWord = downloadQuestionImportTemplateWord;
window.downloadQuestionImportTemplateExcel = downloadQuestionImportTemplateExcel;
window.handleQuestionImportFile = handleQuestionImportFile;
window.handleQuestionWordImport = handleQuestionImportFile;
window.handleQuestionDirectTextImport = handleQuestionDirectTextImport;
window.openTemplateGuideModal = openTemplateGuideModal;
window.openAddSingleQuestionModal = openAddSingleQuestionModal;
window.openEditSingleQuestionModal = openEditSingleQuestionModal;
window.toggleSingleQTypeOptions = toggleSingleQTypeOptions;
window.handleSingleQImageUpload = handleSingleQImageUpload;
window.saveSingleQuestion = saveSingleQuestion;
window.renderGradesModule = renderGradesModule;
window.handleGradeClassChange = handleGradeClassChange;
window.handleGradeSubjectChange = handleGradeSubjectChange;
window.handleSingleGradeChange = handleSingleGradeChange;
window.saveCurrentDOMGradesToState = saveCurrentDOMGradesToState;
window.saveAllMatrixGrades = saveAllMatrixGrades;
window.openAddGradeColumnModal = openAddGradeColumnModal;
window.confirmAddGradeColumn = confirmAddGradeColumn;
window.printGradesMatrix = printGradesMatrix;
window.exportGradesMatrixExcel = exportGradesMatrixExcel;
window.renderJournalModule = renderJournalModule;
window.openJournalModal = openJournalModal;
window.openEditJournalModal = openEditJournalModal;
window.saveEditedJournal = saveEditedJournal;
window.deleteJournal = deleteJournal;
window.saveJournal = saveJournal;
window.downloadJournalAsWord = downloadJournalAsWord;

window.openImportConvertedToBankModal = openImportConvertedToBankModal;
window.toggleImportBankMode = toggleImportBankMode;
window.closeImportBankModal = closeImportBankModal;
window.executeImportConvertedToBank = executeImportConvertedToBank;

window.openExportCbtTableFilterModal = openExportCbtTableFilterModal;
window.toggleCbtNumFilterInput = toggleCbtNumFilterInput;
window.executeExportCbtTableWord = executeExportCbtTableWord;

// Automatically expose functions and state to window for global inline handlers
Object.assign(window, {
  getTeacherAllowedSubjects,
  renderQuestionBankModule,
  selectQuestionBankGroup,
  openQuestionBankGroupModal,
  saveQuestionBankGroup,
  deleteQuestionBankGroup,
  deleteIndividualQuestion,
  openAIGeneratorModal,
  executeAIGenerator,
  downloadWordTemplate,
  openPreviewQuestionBankModal,
  togglePreviewAnswers,
  togglePreviewExplanations,
  printQuestionPaper,
  downloadWordFromPreview,
  openExportCbtTableFilterModal,
  toggleCbtNumFilterInput,
  executeExportCbtTableWord,
  renderGradesModule,
  handleGradeClassChange,
  handleGradeSubjectChange,
  handleSingleGradeChange,
  saveCurrentDOMGradesToState,
  saveAllMatrixGrades,
  openAddGradeColumnModal,
  confirmAddGradeColumn,
  printGradesMatrix,
  exportGradesMatrixExcel,
  renderJournalModule,
  openJournalModal,
  openEditJournalModal,
  saveEditedJournal,
  deleteJournal,
  generateEnrichmentNonAI,
  generateEnrichmentAI,
  saveJournal,
  downloadJournalAsWord,
  openQuestionImportModal,
  openConvertQuestionModal,
  autoConvertMathToLatex,
  loadActiveBankQuestionsToConvert,
  runQuestionConversion,
  parseRawTextToCBTFormat,
  switchConvertTab,
  copyConvertedTextToClipboard,
  downloadConvertedTextFile,
  downloadConvertedWordDoc,
  openImportConvertedToBankModal,
  toggleImportBankMode,
  closeImportBankModal,
  executeImportConvertedToBank,
  handleConvertWordFileUpload,
  parseWordHtmlToText,
  downloadQuestionImportTemplate: downloadQuestionImportTemplateWord,
  downloadQuestionImportTemplateWord,
  downloadQuestionImportTemplateExcel,
  handleQuestionImportFile,
  handleQuestionWordImport: handleQuestionImportFile,
  handleQuestionDirectTextImport,
  openTemplateGuideModal,
  openAddSingleQuestionModal,
  openEditSingleQuestionModal,
  toggleSingleQTypeOptions,
  handleSingleQImageUpload,
  saveSingleQuestion
});

