var appState = window.appState || {};

// MODUL_AJAR_OUTPUT_ENCODING_V3: AI/imported text is data, never executable markup.
function modulEscapeHtml(value) {
    const raw = String(value === undefined || value === null ? '' : value);
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(raw);
    return raw.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
}
function modulEscapeAttr(value) {
    if (typeof window.escapeHtmlAttr === 'function') return window.escapeHtmlAttr(String(value ?? ''));
    return modulEscapeHtml(value);
}
function modulInlineArg(value) {
    const literal = JSON.stringify(String(value ?? ''))
        .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
    return modulEscapeAttr(literal);
}
function modulInlineJson(value) {
    return modulEscapeAttr(JSON.stringify(value ?? null)
        .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
        .replace(/'/g, '\\u0027'));
}
function modulSafeImageSrc(value) {
    const raw = String(value || '');
    const normalized = typeof window.getPhotoHtmlSrc === 'function' ? window.getPhotoHtmlSrc(raw) : raw;
    return modulEscapeAttr(normalized);
}
function modulSafePercent(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 50;
    return Math.max(0, Math.min(100, n));
}
function modulSafeIconClass(value) {
    const tokens = String(value || '').split(/\s+/).filter(token => /^[a-zA-Z0-9_-]+$/.test(token));
    return modulEscapeAttr(tokens.length ? tokens.join(' ') : 'fa-solid fa-circle');
}
function modulSafeJsonForScript(value) {
    return JSON.stringify(value ?? null)
        .replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026')
        .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

window.isSameSubject = function(subA, subB, subjects) {
    if (!subA || !subB) return false;
    const strA = String(subA).trim();
    const strB = String(subB).trim();
    if (!strA || !strB) return false;
    if (strA === strB) return true;
    if (strA.toLowerCase() === strB.toLowerCase()) return true;

    const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const normA = normalize(strA);
    const normB = normalize(strB);
    if (normA && normB && normA === normB) return true;

    const subjectsList = Array.isArray(subjects) && subjects.length > 0 ? subjects : (appState.subjects || []);
    if (!subjectsList || subjectsList.length === 0) return false;

    const objA = subjectsList.find(s => 
        String(s.id).trim() === strA || 
        String(s.name).trim().toLowerCase() === strA.toLowerCase() ||
        (s.code && String(s.code).trim().toLowerCase() === strA.toLowerCase()) ||
        (normA && normalize(s.name) === normA) ||
        (normA && normalize(s.code) === normA)
    );

    const objB = subjectsList.find(s => 
        String(s.id).trim() === strB || 
        String(s.name).trim().toLowerCase() === strB.toLowerCase() ||
        (s.code && String(s.code).trim().toLowerCase() === strB.toLowerCase()) ||
        (normB && normalize(s.name) === normB) ||
        (normB && normalize(s.code) === normB)
    );

    if (objA && objB) {
        return String(objA.id).trim() === String(objB.id).trim();
    }

    if (objA) {
        return String(objA.id).trim() === strB ||
               String(objA.name).trim().toLowerCase() === strB.toLowerCase() ||
               (objA.code && String(objA.code).trim().toLowerCase() === strB.toLowerCase()) ||
               (normB && normalize(objA.name) === normB) ||
               (normB && normalize(objA.code) === normB);
    }

    if (objB) {
        return String(objB.id).trim() === strA ||
               String(objB.name).trim().toLowerCase() === strA.toLowerCase() ||
               (objB.code && String(objB.code).trim().toLowerCase() === strA.toLowerCase()) ||
               (normA && normalize(objB.name) === normA) ||
               (normA && normalize(objB.code) === normA);
    }

    return false;
};

function getLessonPlanSubjectForView(plan) {
    if (window.getLessonPlanSubjectReference) return window.getLessonPlanSubjectReference(plan);
    if (!plan || typeof plan !== 'object') return '';
    return plan.subjectId ?? plan.subjectCode ?? plan.subjectName ?? plan.subject ?? plan.mapel ?? '';
}

function getLessonPlanGroupId(plan) {
    if (!plan || typeof plan !== 'object') return '';
    return plan.groupId ?? plan.group_id ?? (plan.group && (plan.group.id ?? plan.group.groupId)) ?? '';
}

function getLessonPlanGroupName(plan) {
    if (!plan || typeof plan !== 'object') return '';
    return plan.groupName ?? plan.group_name ?? (plan.group && (plan.group.name ?? plan.group.title)) ?? '';
}

async function loadImportGroupsFromServer(force = false) {
    // IMPORT_GROUP_SERVER_AUTHORITATIVE: never reuse a generic localStorage cache across tenants.
    if (appState._importGroupsLoadPromise && !force) return appState._importGroupsLoadPromise;
    if (appState._importGroupsLoaded && !force) return appState.importGroups || [];

    const task = fetch('/api/import-groups')
        .then(r => r.ok ? r.json() : ({ success: false }))
        .then(res => {
            appState.importGroups = res.success && Array.isArray(res.data) ? res.data : [];
            appState._importGroupsLoaded = true;
            try { localStorage.removeItem('madrasah_import_groups'); } catch (_) {}
            return appState.importGroups;
        })
        .catch(err => {
            console.error('Gagal mengambil kelompok modul:', err);
            appState.importGroups = [];
            appState._importGroupsLoaded = true;
            return appState.importGroups;
        });

    appState._importGroupsLoadPromise = task;
    try { return await task; }
    finally { appState._importGroupsLoadPromise = null; }
}
window.loadImportGroupsFromServer = loadImportGroupsFromServer;

function getGuruName() {
    return (appState.settings && appState.settings.teacherName) || 'Sufyan Syauri, S.Pd.I';
}
function getGuruNip() {
    return (appState.settings && appState.settings.teacherNip) || '198808142014021002';
}
function getKepsekName() {
    return (appState.settings && appState.settings.headmasterName) || 'M. Zainal Fauzi, S.Pd.I';
}
function getKepsekNip() {
    return (appState.settings && appState.settings.headmasterNip) || '198205122009011004';
}
function getSchoolName() {
    return (appState.settings && appState.settings.schoolName) || 'Nama Sekolah';
}
function getSchoolLocation() {
    return (appState.settings && appState.settings.schoolLocation) || 'Tanjung Jabung Barat';
}
window.getGuruName = getGuruName;
window.getGuruNip = getGuruNip;
window.getKepsekName = getKepsekName;
window.getKepsekNip = getKepsekNip;
window.getSchoolName = getSchoolName;
window.getSchoolLocation = getSchoolLocation;

function openSignatureConfigModal() {
    const modal = document.getElementById('modal-container');
    if (!modal) return;

    if (!appState.settings) appState.settings = {};

    const tName = appState.settings.teacherName || 'Sufyan Syauri, S.Pd.I';
    const tNip = appState.settings.teacherNip || '198808142014021002';
    const hName = appState.settings.headmasterName || 'M. Zainal Fauzi, S.Pd.I';
    const hNip = appState.settings.headmasterNip || '198205122009011004';
    const sName = appState.settings.schoolName || 'Nama Sekolah';
    const sLoc = appState.settings.schoolLocation || 'Tanjung Jabung Barat';

    document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div id="modal-content-box" class="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col max-h-[90vh] overflow-hidden transition-all duration-300">
                <!-- Modal Header -->
                <div class="flex justify-between items-center pb-4 border-b border-slate-100 shrink-0">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <i class="fa-solid fa-file-signature text-xs"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-800 text-sm sm:text-base">Konfigurasi Identitas & Pengesahan</h3>
                            <p class="text-[10px] text-slate-400 font-medium">Acuan tanda tangan, nama madrasah, dan penulisan perangkat</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg text-slate-400 hover:text-slate-600"></i></button>
                </div>

                <!-- Modal Body -->
                <div class="flex-1 min-h-0 overflow-y-auto py-4 space-y-4">
                    <p class="text-xs text-slate-500 leading-relaxed">
                        Data di bawah ini akan digunakan secara otomatis sebagai acuan pengesahan, tanda tangan di akhir dokumen, serta informasi nama guru/madrasah pada semua modul, RPP, dan administrasi yang di-generate.
                    </p>

                    <form id="signature-config-form" onsubmit="saveSignatureConfig(event)" class="space-y-4">
                        <!-- Nama Madrasah -->
                        <div class="space-y-1">
                            <label class="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Nama Madrasah / Sekolah</label>
                            <input type="text" id="cfg-school-name" required value="${escapeHtml(sName)}" placeholder="Contoh: MA Al-Falah" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <!-- Kabupaten/Kota -->
                        <div class="space-y-1">
                            <label class="block text-[10px] font-extrabold uppercase tracking-wider text-slate-500">Kabupaten / Kota (Tempat Penandatanganan)</label>
                            <input type="text" id="cfg-school-location" required value="${escapeHtml(sLoc)}" placeholder="Contoh: Tanjung Jabung Barat" class="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>

                        <!-- Divider -->
                        <div class="border-t border-slate-100 my-2"></div>

                        <!-- Data Guru -->
                        <div class="bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100/60 space-y-3">
                            <h4 class="text-xs font-bold text-emerald-900 flex items-center space-x-1.5">
                                <i class="fa-solid fa-user-tie"></i>
                                <span>Identitas Guru Mata Pelajaran</span>
                            </h4>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div class="space-y-1">
                                    <label class="block text-[10px] font-bold text-slate-500">Nama Lengkap & Gelar</label>
                                    <input type="text" id="cfg-teacher-name" required value="${escapeHtml(tName)}" placeholder="Contoh: Sufyan Syauri, S.Pd.I" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                </div>
                                <div class="space-y-1">
                                    <label class="block text-[10px] font-bold text-slate-500">NIP / NUPTK</label>
                                    <input type="text" id="cfg-teacher-nip" value="${escapeHtml(tNip)}" placeholder="Contoh: 198808142014021002" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                </div>
                            </div>
                        </div>

                        <!-- Data Kepala Madrasah -->
                        <div class="bg-blue-50/50 p-4 rounded-2xl border border-blue-100/60 space-y-3">
                            <h4 class="text-xs font-bold text-blue-900 flex items-center space-x-1.5">
                                <i class="fa-solid fa-user-shield"></i>
                                <span>Identitas Kepala Madrasah</span>
                            </h4>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div class="space-y-1">
                                    <label class="block text-[10px] font-bold text-slate-500">Nama Lengkap & Gelar</label>
                                    <input type="text" id="cfg-headmaster-name" required value="${escapeHtml(hName)}" placeholder="Contoh: M. Zainal Fauzi, S.Pd.I" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500">
                                </div>
                                <div class="space-y-1">
                                    <label class="block text-[10px] font-bold text-slate-500">NIP / NUPTK</label>
                                    <input type="text" id="cfg-headmaster-nip" value="${escapeHtml(hNip)}" placeholder="Contoh: 198205122009011004" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500">
                                </div>
                            </div>
                        </div>

                        <!-- Submit Button -->
                        <div class="pt-2 shrink-0">
                            <button type="submit" class="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center space-x-2 shadow-md cursor-pointer">
                                <i class="fa-solid fa-floppy-disk"></i>
                                <span>Simpan Konfigurasi Acuan</span>
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}
window.openSignatureConfigModal = openSignatureConfigModal;

function saveSignatureConfig(event) {
    event.preventDefault();
    if (!appState.settings) appState.settings = {};

    const schoolNameVal = document.getElementById('cfg-school-name').value.trim();
    const schoolLocationVal = document.getElementById('cfg-school-location').value.trim();
    const teacherNameVal = document.getElementById('cfg-teacher-name').value.trim();
    const teacherNipVal = document.getElementById('cfg-teacher-nip').value.trim();
    const headmasterNameVal = document.getElementById('cfg-headmaster-name').value.trim();
    const headmasterNipVal = document.getElementById('cfg-headmaster-nip').value.trim();

    appState.settings.schoolName = schoolNameVal;
    appState.settings.schoolLocation = schoolLocationVal;
    appState.settings.teacherName = teacherNameVal;
    appState.settings.teacherNip = teacherNipVal;
    appState.settings.headmasterName = headmasterNameVal;
    appState.settings.headmasterNip = headmasterNipVal;

    // Prefill generation values to match
    appState.kbcGuruName = teacherNameVal;
    appState.kbcGuruNip = teacherNipVal;
    appState.kbcKepsekName = headmasterNameVal;
    appState.kbcKepsekNip = headmasterNipVal;

    // Persist
    saveState('settings');

    showToast('Identitas acuan berhasil disimpan!', 'success');
    closeModal();

    // Trigger re-render of layout to reflect new names
    const viewContainer = document.getElementById('view-container');
    if (viewContainer) {
        renderModulAjarModule(viewContainer);
    }
}
window.saveSignatureConfig = saveSignatureConfig;

function cleanMarkdown(str) {
    if (!str || typeof str !== 'string') return str || '';
    return str
        .replace(/\*{1,3}/g, '')
        .replace(/#{1,6}\s?/g, '')
        .replace(/`{1,3}/g, '')
        .replace(/~~/g, '');
}
window.cleanMarkdown = cleanMarkdown;

function formatMarkdownWithTables(str, options = {}) {
    if (!str || typeof str !== 'string') return str || '-';

    const isPrint = options.isPrint || false;

    // If it already contains an HTML table, return as is
    if (/<table[\s>]/.test(str) && /<\/table>/.test(str)) {
        return str;
    }

    const lines = str.split(/\r?\n/);
    let htmlResult = [];
    let inTable = false;
    let tableHeader = [];
    let tableRows = [];

    const tableClass = isPrint 
        ? 'width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 10pt;' 
        : 'w-full text-xs sm:text-sm border-collapse border border-slate-300 my-3 shadow-sm rounded-xl overflow-hidden';
    const thStyle = isPrint 
        ? 'border: 1px solid #000; padding: 6px 8px; background-color: #f1f5f9; font-weight: bold; text-align: left;' 
        : 'border border-slate-300 bg-slate-100 p-2.5 font-bold text-slate-800 text-left';
    const tdStyle = isPrint 
        ? 'border: 1px solid #000; padding: 6px 8px; vertical-align: top;' 
        : 'border border-slate-300 p-2.5 text-slate-700 vertical-align: top';

    function flushTable() {
        if (!tableHeader.length && !tableRows.length) {
            inTable = false;
            return;
        }

        let tHtml = '';
        if (isPrint) {
            tHtml += `<table style="${tableClass}">`;
            if (tableHeader.length > 0) {
                tHtml += '<thead><tr>';
                tableHeader.forEach(cell => {
                    tHtml += `<th style="${thStyle}">${formatInlineMarkdown(cell)}</th>`;
                });
                tHtml += '</tr></thead>';
            }
            tHtml += '<tbody>';
            tableRows.forEach(row => {
                tHtml += '<tr>';
                row.forEach(cell => {
                    tHtml += `<td style="${tdStyle}">${formatInlineMarkdown(cell)}</td>`;
                });
                tHtml += '</tr>';
            });
            tHtml += '</tbody></table>';
        } else {
            tHtml += `<div class="overflow-x-auto my-3"><table class="${tableClass}">`;
            if (tableHeader.length > 0) {
                tHtml += `<thead class="bg-slate-100 text-slate-800 font-bold"><tr>`;
                tableHeader.forEach(cell => {
                    tHtml += `<th class="${thStyle}">${formatInlineMarkdown(cell)}</th>`;
                });
                tHtml += '</tr></thead>';
            }
            tHtml += '<tbody class="bg-white divide-y divide-slate-200">';
            tableRows.forEach((row, idx) => {
                const bgClass = idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white';
                tHtml += `<tr class="${bgClass} hover:bg-slate-100/80 transition-colors">`;
                row.forEach(cell => {
                    tHtml += `<td class="${tdStyle}">${formatInlineMarkdown(cell)}</td>`;
                });
                tHtml += '</tr>';
            });
            tHtml += '</tbody></table></div>';
        }

        htmlResult.push(tHtml);
        inTable = false;
        tableHeader = [];
        tableRows = [];
    }

    function formatInlineMarkdown(text) {
        if (!text) return '';
        return text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code class="bg-slate-100 px-1 py-0.5 rounded text-red-600 font-mono text-[11px]">$1</code>');
    }

    for (let i = 0; i < lines.length; i++) {
        let rawLine = lines[i];
        let trimmed = rawLine.trim();

        let isTableRow = false;
        let cells = [];

        if (trimmed.includes('|')) {
            if (/^[\s\-:\t|]+$/.test(trimmed) && trimmed.includes('-')) {
                if (inTable) {
                    continue;
                }
            } else {
                cells = trimmed.split('|').map(c => c.trim());
                if (trimmed.startsWith('|')) {
                    cells.shift();
                }
                if (trimmed.endsWith('|') && cells.length > 0) {
                    cells.pop();
                }
                if (cells.length >= 1) {
                    isTableRow = true;
                }
            }
        }

        if (isTableRow) {
            if (!inTable) {
                inTable = true;
                tableHeader = cells;
            } else {
                tableRows.push(cells);
            }
            continue;
        }

        if (inTable) {
            flushTable();
        }

        if (trimmed === '') {
            htmlResult.push('<br>');
        } else {
            let formatted = formatInlineMarkdown(trimmed);
            if (trimmed.startsWith('# ')) {
                formatted = `<h3 class="font-bold text-base my-2 text-slate-800">${formatted.replace(/^#\s+/, '')}</h3>`;
            } else if (trimmed.startsWith('## ')) {
                formatted = `<h4 class="font-bold text-sm my-1.5 text-slate-800">${formatted.replace(/^##\s+/, '')}</h4>`;
            } else if (trimmed.startsWith('### ')) {
                formatted = `<h5 class="font-bold text-xs my-1 text-slate-800">${formatted.replace(/^###\s+/, '')}</h5>`;
            } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                formatted = `• ${formatted.substring(2)}`;
            }
            htmlResult.push(formatted);
        }
    }

    if (inTable) {
        flushTable();
    }

    let result = htmlResult.join('<br>')
        .replace(/(<br>\s*){3,}/g, '<br><br>')
        .replace(/<\/table><br>/g, '</table>')
        .replace(/<\/div><br>/g, '</div>')
        .replace(/<\/h[345]><br>/g, '</h$1>');

    return result;
}
window.formatMarkdownWithTables = formatMarkdownWithTables;

function getUniqueTingkatList(appClasses) {
    const levels = new Set();
    (appClasses || []).forEach(c => {
        if (c.grade) {
            levels.add(String(c.grade).trim().toUpperCase());
        }
        if (c.name) {
            const match = String(c.name).match(/^(XII|XI|X|IX|VIII|VII|VI|12|11|10|9|8|7|6)\b/i);
            if (match) {
                levels.add(match[1].toUpperCase());
            } else {
                const firstWord = String(c.name).split(/[\s.\-_]+/)[0];
                if (firstWord && firstWord.length <= 4) levels.add(firstWord.toUpperCase());
            }
        }
    });
    if (levels.size === 0) {
        ['X', 'XI', 'XII'].forEach(l => levels.add(l));
    }
    return Array.from(levels);
}
window.getUniqueTingkatList = getUniqueTingkatList;

function getFilteredLessonPlansForActiveView(subjectId) {
    const selectedLevel = appState.selectedModulAjarLevel || 'ALL';
    const selectedSemester = appState.selectedModulAjarSemester || 'ALL';
    const appClasses = appState.classes || [];

    const allPlans = (appState.lessonPlans || []).filter(lp => isSameSubject(getLessonPlanSubjectForView(lp), subjectId, appState.subjects));

    return allPlans.filter(lp => {
        // 1. Filter Semester
        if (selectedSemester !== 'ALL') {
            const lpSem = String(lp.semester || '').trim();
            if (lpSem && lpSem !== 'ALL' && lpSem !== selectedSemester) {
                return false;
            }
        }

        // Target classes array or string
        const targetClasses = Array.isArray(lp.classes) && lp.classes.length > 0 ? lp.classes : (
            Array.isArray(lp.targetClasses) && lp.targetClasses.length > 0 ? lp.targetClasses : [lp.grade || 'ALL']
        );

        // 2. Filter Tingkat
        if (selectedLevel !== 'ALL') {
            const matchLevel = targetClasses.includes('ALL') || targetClasses.some(tc => {
                const tcUpper = String(tc).toUpperCase();
                const selUpper = String(selectedLevel).toUpperCase();
                if (tcUpper === selUpper || tcUpper.startsWith(selUpper)) return true;
                const cls = appClasses.find(c => String(c.id) === String(tc) || c.name === tc);
                if (cls) {
                    if (cls.grade && String(cls.grade).toUpperCase() === selUpper) return true;
                    if (cls.name && String(cls.name).toUpperCase().startsWith(selUpper)) return true;
                }
                return false;
            });
            if (!matchLevel) return false;
        }

        return true;
    });
}
window.getFilteredLessonPlansForActiveView = getFilteredLessonPlansForActiveView;

function changeModulAjarFilter(type, val, subjectId) {
    if (type === 'level') appState.selectedModulAjarLevel = val;
    if (type === 'semester') appState.selectedModulAjarSemester = val;
    renderModulAjarModule(document.getElementById('view-container'));
}
window.changeModulAjarFilter = changeModulAjarFilter;

window.changeModulAjarTab = function(tabName) {
    appState.activeModulAjarTab = tabName;
    renderModulAjarModule(document.getElementById('view-container'));
};

window.switchSubjectSubTab = function(subTab) {
    appState.activeModulAjarSubTab = subTab;
    renderModulAjarModule(document.getElementById('view-container'));
};

function renderModulCardHtml(lp, selectedSubjectId) {
    const isImport = !!lp.isImported;
    const isRpp = !!lp.isRPP;
    const dateStr = new Date(lp.createdAt || Date.now()).toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });

    return `
        <div class="relative p-5 bg-white border border-slate-200/90 hover:border-indigo-400 rounded-3xl shadow-xs hover:shadow-md transition flex flex-col justify-between space-y-4 group overflow-hidden">
            <!-- Top Right Decorative Archive Ambient Accent -->
            <div class="absolute top-0 right-0 w-24 h-24 -mr-6 -mt-6 bg-gradient-to-bl from-indigo-100/70 via-blue-50/30 to-transparent rounded-full pointer-events-none group-hover:scale-110 transition-transform"></div>

            <div class="space-y-3 relative z-10">
                <!-- Header: Icon Simbol Arsip & Type Badge -->
                <div class="flex items-start justify-between gap-2">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-indigo-600 to-blue-600 text-white flex items-center justify-center font-bold text-sm shrink-0 shadow-md shadow-indigo-200 group-hover:scale-105 transition-transform duration-200" title="Simbol Arsip Dokumen">
                            <i class="fa-solid fa-box-archive text-base"></i>
                        </div>
                        <div>
                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-extrabold rounded-full">
                                <i class="fa-solid fa-file-contract text-[9px]"></i>
                                <span>Arsip Modul</span>
                            </span>
                            <p class="text-[10px] font-mono text-slate-400 font-bold mt-0.5">${dateStr}</p>
                        </div>
                    </div>
                    <span class="px-2 py-1 ${isImport ? (lp.sourceType === 'pdf' ? 'bg-rose-50 text-rose-700 border border-rose-200/80' : 'bg-blue-50 text-blue-700 border border-blue-200/80') : (isRpp ? 'bg-purple-50 text-purple-700 border border-purple-200/80' : 'bg-emerald-50 text-emerald-700 border border-emerald-200/80')} text-[10px] font-extrabold rounded-xl flex items-center gap-1 shrink-0 shadow-2xs">
                        <i class="fa-solid ${isImport ? (lp.sourceType === 'pdf' ? 'fa-file-pdf text-rose-600' : 'fa-file-word text-blue-600') : (isRpp ? 'fa-wand-magic-sparkles text-purple-600' : 'fa-circle-check text-emerald-600')} text-[10px]"></i>
                        <span>${isImport ? (lp.sourceType === 'pdf' ? 'Import PDF' : 'Import Word') : (isRpp ? 'RPP AI' : 'Modul Mandiri')}</span>
                    </span>
                </div>

                <!-- Title & Topic -->
                <div class="space-y-1">
                    <h4 class="text-sm font-extrabold text-slate-900 group-hover:text-indigo-700 transition line-clamp-2 leading-snug" title="${escapeHtml(lp.title)}">
                        ${escapeHtml(lp.title)}
                    </h4>
                    <p class="text-xs text-slate-500 line-clamp-2"><span class="font-semibold text-slate-700">Topik / Materi:</span> ${escapeHtml(lp.topic || lp.identitasModul || '-')}</p>
                </div>

                ${isImport && lp.sourceFileName ? `
                    <div class="p-2 bg-slate-50 border border-slate-200/80 rounded-xl text-[10px] text-slate-600 font-medium flex items-center space-x-1.5 truncate">
                        <i class="fa-solid fa-paperclip text-slate-400 shrink-0"></i>
                        <span class="truncate">${escapeHtml(lp.sourceFileName)}</span>
                    </div>
                ` : ''}
            </div>

            <!-- Footer Action Controls -->
            <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold relative z-10">
                <button type="button" onclick="deleteLessonPlan('${lp.id}')" class="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl transition cursor-pointer" title="Hapus Modul">
                    <i class="fa-solid fa-trash-can text-xs"></i>
                </button>
                <div class="flex items-center space-x-1.5">
                    <button type="button" onclick="openPreviewLessonPlan('${lp.id}')" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition text-xs font-bold flex items-center space-x-1 cursor-pointer" title="Cetak / Unduh / Lihat">
                        <i class="fa-solid fa-eye text-xs"></i><span>Lihat</span>
                    </button>
                    <button type="button" onclick="openLessonPlanModal('${lp.id}', '${selectedSubjectId}')" class="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition text-xs font-extrabold flex items-center space-x-1 shadow-sm cursor-pointer" title="Edit Modul">
                        <i class="fa-solid fa-pen-to-square text-xs"></i><span>Edit</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function renderModulAjarSimpanView(selectedSubjectId) {
    if (!appState._importGroupsLoaded && !appState._importGroupsLoadPromise) {
        loadImportGroupsFromServer().then(() => {
            const c = document.getElementById('view-container');
            if (c && (appState.currentView === 'modul-ajar' || appState.currentRoute === 'modul-ajar')) {
                renderModulAjarModule(c);
            }
        });
    }

    const subjectPlansSimpan = (appState.lessonPlans || []).filter(lp => isSameSubject(getLessonPlanSubjectForView(lp), selectedSubjectId, appState.subjects));
    const storedGroups = (appState.importGroups || []).filter(g => {
        if (!g) return false;
        const groupSubject = g.subjectId ?? g.subject_id ?? g.subjectCode ?? g.subjectName ?? g.subject ?? g.mapel;
        return isSameSubject(groupSubject, selectedSubjectId, appState.subjects);
    });

    // Legacy/restore payloads may carry group IDs on the module itself while
    // /api/import-groups has no corresponding row. Derive those groups without
    // moving untagged modules across tenants or subjects.
    const knownGroupIds = new Set(storedGroups.map(g => String(g.id ?? g.groupId ?? '').trim()).filter(Boolean));
    const derivedGroups = [];
    subjectPlansSimpan.forEach(lp => {
        const groupId = String(getLessonPlanGroupId(lp) || '').trim();
        if (!groupId || knownGroupIds.has(groupId)) return;
        knownGroupIds.add(groupId);
        derivedGroups.push({
            id: groupId,
            name: getLessonPlanGroupName(lp) || `Kelompok ${derivedGroups.length + 1}`,
            subjectId: selectedSubjectId,
            derived: true
        });
    });
    const subjectGroups = storedGroups.concat(derivedGroups);

    // Separate into grouped vs ungrouped
    const groupedPlans = {};
    subjectGroups.forEach(g => {
        const groupId = String(g.id ?? g.groupId ?? '').trim();
        groupedPlans[groupId] = subjectPlansSimpan.filter(lp =>
            String(getLessonPlanGroupId(lp) || '').trim() === groupId
        );
    });

    const ungroupedPlans = subjectPlansSimpan.filter(lp => {
        const groupId = String(getLessonPlanGroupId(lp) || '').trim();
        if (!groupId) return true;
        return !subjectGroups.some(g => String(g.id ?? g.groupId ?? '').trim() === groupId);
    });

    return `
        <div class="space-y-6">
            <!-- Mode 2 Visual Header Banner & Logo -->
            <div class="bg-gradient-to-r from-blue-600/10 via-indigo-500/10 to-purple-500/10 p-5 sm:p-6 rounded-3xl border border-blue-200/60 shadow-sm space-y-4">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div class="flex items-center space-x-4">
                        <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-600 via-indigo-600 to-indigo-800 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-indigo-300/50 shrink-0">
                            <i class="fa-solid fa-box-archive"></i>
                        </div>
                        <div>
                            <div class="flex items-center space-x-2">
                                <span class="px-2.5 py-0.5 bg-blue-100 border border-blue-200 text-blue-800 font-black text-[10px] rounded-full uppercase tracking-wider">Mode 2</span>
                                <span class="px-2.5 py-0.5 bg-indigo-100 border border-indigo-200 text-indigo-800 font-extrabold text-[10px] rounded-full">Brankas Arsip Dokumen</span>
                            </div>
                            <h3 class="text-lg sm:text-xl font-extrabold text-slate-900 mt-0.5">Simpan & Arsip Modul Ajar</h3>
                            <p class="text-xs text-slate-500">Kelola dan arsipkan dokumen modul ajar tersimpan secara rapi berdasarkan kelompok bab atau topik pelajaran.</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 flex-wrap">
                        <button type="button" onclick="openAddImportGroupModal('${selectedSubjectId}')" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-extrabold shadow-md transition flex items-center space-x-2 cursor-pointer">
                            <i class="fa-solid fa-folder-plus"></i>
                            <span>Tambah Kelompok</span>
                        </button>
                        <button type="button" onclick="openDirectImportModulModal('${selectedSubjectId}')" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-extrabold shadow-md transition flex items-center space-x-2 cursor-pointer">
                            <i class="fa-solid fa-file-arrow-up"></i>
                            <span>Import Modul Word / PDF</span>
                        </button>
                    </div>
                </div>

                <!-- Status / Quick Info bar -->
                <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-blue-200/40">
                    <div class="flex items-center space-x-2 flex-wrap text-xs">
                        <span class="px-3 py-1 bg-white border border-blue-200/80 rounded-xl font-extrabold text-blue-900 shadow-2xs flex items-center gap-1.5">
                            <i class="fa-solid fa-folder text-indigo-600"></i> ${subjectGroups.length} Kelompok Bab
                        </span>
                        <span class="px-3 py-1 bg-white border border-blue-200/80 rounded-xl font-extrabold text-blue-900 shadow-2xs flex items-center gap-1.5">
                            <i class="fa-solid fa-file-contract text-blue-600"></i> ${subjectPlansSimpan.length} Dokumen Tersimpan
                        </span>
                    </div>
                    <div class="text-[11px] font-bold text-slate-500 bg-white/90 px-3 py-1 rounded-xl border border-slate-200/60 flex items-center gap-1.5">
                        <i class="fa-solid fa-hard-drive text-emerald-600"></i> Penyimpanan Dokumen: <span class="text-emerald-700 font-extrabold">Ringan & Sangat Lega</span>
                    </div>
                </div>
            </div>

            <div class="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-100 pb-4">
                    <div>
                        <h3 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                            <i class="fa-solid fa-folder-tree text-indigo-600"></i>
                            <span>Daftar Kelompok & Berkas Modul</span>
                        </h3>
                        <p class="text-xs text-slate-500 mt-0.5">Daftar dokumen modul ajar tersimpan per kelompok bab.</p>
                    </div>
                </div>

            ${subjectPlansSimpan.length === 0 && subjectGroups.length === 0 ? `
                <div class="py-14 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 space-y-3">
                    <div class="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-2xl mx-auto shadow-2xs">
                        <i class="fa-solid fa-folder-open"></i>
                    </div>
                    <div class="space-y-1 max-w-sm mx-auto">
                        <h4 class="text-sm font-extrabold text-slate-800">Belum Ada Modul atau Kelompok</h4>
                        <p class="text-xs text-slate-400">Buat kelompok baru agar file rapi berkelompok, atau langsung import file Word/PDF modul ajar Anda.</p>
                    </div>
                    <div class="flex items-center justify-center gap-2 pt-2">
                        <button type="button" onclick="openAddImportGroupModal('${selectedSubjectId}')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow-sm inline-flex items-center space-x-1.5 cursor-pointer">
                            <i class="fa-solid fa-folder-plus"></i>
                            <span>Tambah Kelompok</span>
                        </button>
                        <button type="button" onclick="openDirectImportModulModal('${selectedSubjectId}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition shadow-sm inline-flex items-center space-x-1.5 cursor-pointer">
                            <i class="fa-solid fa-file-arrow-up"></i>
                            <span>Import Modul Sekarang</span>
                        </button>
                    </div>
                </div>
            ` : `
                <div class="space-y-6">
                    ${subjectGroups.map(g => {
                        const filesInGrp = groupedPlans[g.id] || [];
                        return `
                            <div class="p-5 sm:p-6 bg-slate-50/80 border border-slate-200/80 rounded-3xl space-y-4 shadow-xs">
                                <div class="flex items-center justify-between pb-3 border-b border-slate-200/80 flex-wrap gap-2">
                                    <div class="flex items-center space-x-3">
                                        <div class="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg shadow-2xs shrink-0">
                                            <i class="fa-solid fa-folder"></i>
                                        </div>
                                        <div>
                                            <div class="flex items-center space-x-2 flex-wrap">
                                                <h4 class="font-extrabold text-slate-900 text-base sm:text-lg">${escapeHtml(g.name)}</h4>
                                                <span class="px-2.5 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-extrabold rounded-full">${filesInGrp.length} File Modul</span>
                                            </div>
                                            ${g.description ? `<p class="text-xs text-slate-500 font-medium mt-0.5">${escapeHtml(g.description)}</p>` : ''}
                                        </div>
                                    </div>
                                    <div class="flex items-center space-x-2">
                                        <button type="button" onclick="openDirectImportModulModal('${selectedSubjectId}', '${g.id}')" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs cursor-pointer">
                                            <i class="fa-solid fa-file-arrow-up text-[11px]"></i>
                                            <span>Import File ke Kelompok Ini</span>
                                        </button>
                                        <button type="button" onclick="openEditImportGroupModal('${g.id}', '${selectedSubjectId}')" class="p-2 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl transition text-xs cursor-pointer" title="Edit Nama Kelompok">
                                            <i class="fa-solid fa-pen"></i>
                                        </button>
                                        <button type="button" onclick="deleteImportGroup('${g.id}', '${selectedSubjectId}')" class="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl transition text-xs cursor-pointer" title="Hapus Kelompok">
                                            <i class="fa-solid fa-trash-can"></i>
                                        </button>
                                    </div>
                                </div>

                                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    ${filesInGrp.length === 0 ? `
                                        <div class="col-span-full py-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2">
                                            <p class="text-xs text-slate-400 font-medium">Belum ada file modul dalam kelompok ini.</p>
                                            <button type="button" onclick="openDirectImportModulModal('${selectedSubjectId}', '${g.id}')" class="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl text-xs font-bold transition inline-flex items-center space-x-1 cursor-pointer">
                                                <i class="fa-solid fa-file-arrow-up"></i>
                                                <span>Import Berkas Sekarang</span>
                                            </button>
                                        </div>
                                    ` : filesInGrp.map(lp => renderModulCardHtml(lp, selectedSubjectId)).join('')}
                                </div>
                            </div>
                        `;
                    }).join('')}

                    ${(subjectGroups.length === 0 || ungroupedPlans.length > 0) ? `
                        <div class="p-5 sm:p-6 bg-slate-50/50 border border-slate-200/60 rounded-3xl space-y-4">
                            <div class="flex items-center justify-between pb-3 border-b border-slate-200">
                                <div class="flex items-center space-x-3">
                                    <div class="w-10 h-10 rounded-2xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold text-lg shrink-0">
                                        <i class="fa-solid fa-folder-open"></i>
                                    </div>
                                    <div>
                                        <h4 class="font-extrabold text-slate-800 text-base">Modul Umum / Tanpa Kelompok</h4>
                                        <p class="text-xs text-slate-500 font-medium">${ungroupedPlans.length} File Modul</p>
                                    </div>
                                </div>
                                <button type="button" onclick="openDirectImportModulModal('${selectedSubjectId}')" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-2xs cursor-pointer">
                                    <i class="fa-solid fa-file-arrow-up"></i>
                                    <span>Import Modul Umum</span>
                                </button>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                ${ungroupedPlans.length === 0 ? `
                                    <div class="col-span-full py-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400 font-medium">
                                        Tidak ada modul tanpa kelompok.
                                    </div>
                                ` : ungroupedPlans.map(lp => renderModulCardHtml(lp, selectedSubjectId)).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `}
        </div>
    `;
}

// Modul Ajar Module
function renderModulAjarModule(container) {
    if (!container) return;

    // Load subjects if not already loaded
    if (!appState.subjects || appState.subjects.length === 0) {
        fetch('/api/subjects')
            .then(r => r.json())
            .then(res => {
                if (res.success && Array.isArray(res.subjects)) {
                    appState.subjects = res.subjects;
                    renderModulAjarModule(container);
                }
            })
            .catch(err => console.error('Gagal mengambil mata pelajaran:', err));
    }

    // Load lesson plans once per view. Keep an explicit loading flag so an
    // empty response is a valid result but a failed request can be retried.
    if (appState.lessonPlans == null && !appState._lessonPlansLoading) {
        appState.lessonPlans = [];
        appState._lessonPlansLoading = true;
        fetch('/api/lesson-plans')
            .then(r => r.json())
            .then(res => {
                if (res && res.success) {
                    appState.lessonPlans = window.normalizeLessonPlanCollection
                        ? window.normalizeLessonPlanCollection(res)
                        : (Array.isArray(res.data) ? res.data : (res.lessonPlans || []));
                }
                renderModulAjarModule(container);
            })
            .catch(err => console.error('Gagal mengambil modul ajar:', err))
            .finally(() => { appState._lessonPlansLoading = false; });
    }

    // Load tenant-scoped import groups once, including the valid empty state.
    if (!appState._importGroupsLoaded && !appState._importGroupsLoadPromise) {
        loadImportGroupsFromServer().then(() => {
            if (appState.currentView === 'modul-ajar' || appState.currentRoute === 'modul-ajar') {
                renderModulAjarModule(container);
            }
        });
    }

    const selectedSubjectId = appState.selectedModulAjarSubjectId || '';
    const selectedSubject = appState.subjects ? appState.subjects.find(s => String(s.id) === String(selectedSubjectId) || isSameSubject(s.id, selectedSubjectId, appState.subjects)) : null;
    const searchQuery = appState.modulAjarSearchQuery || '';

    let contentHtml = '';

    if (selectedSubject) {
        const activeSubTab = appState.activeModulAjarSubTab || 'buat';
        appState.activeModulAjarSubTab = activeSubTab;
        const appClasses = appState.classes || [];
        if (!appState.selectedModulAjarLevel) appState.selectedModulAjarLevel = 'ALL';
        if (!appState.selectedModulAjarClass) appState.selectedModulAjarClass = appState.selectedModulAjarGrade || 'ALL';
        if (!appState.selectedModulAjarSemester) appState.selectedModulAjarSemester = 'ALL';

        const activeTab = appState.activeModulAjarTab || 'modul';
        const selectedLevel = appState.selectedModulAjarLevel;
        const selectedClass = appState.selectedModulAjarClass;
        const selectedSemester = appState.selectedModulAjarSemester;

        const uniqueTingkats = getUniqueTingkatList(appClasses);

        // Kelola Modul Area - Filtered by Level, Class, and Semester
        const plans = getFilteredLessonPlansForActiveView(selectedSubjectId);
        const subjectPlans = (appState.lessonPlans || []).filter(lp => isSameSubject(getLessonPlanSubjectForView(lp), selectedSubjectId, appState.subjects));
        
        // Fetch saved exams from state or localStorage
        if (!appState.generatedExams) {
            appState.generatedExams = JSON.parse(localStorage.getItem('madrasah_generated_exams')) || [];
        }
        const savedExams = appState.generatedExams.filter(ex => isSameSubject(ex.subjectId, selectedSubjectId, appState.subjects));

        let savedExamsHtml = '';
        if (savedExams.length > 0) {
            savedExamsHtml = `
                <!-- Bank Soal / Paket Soal Tergenerate -->
                <div class="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <h3 class="text-sm font-extrabold uppercase tracking-wider text-slate-800 flex items-center space-x-2">
                                <i class="fa-solid fa-folder-open text-indigo-600"></i>
                                <span>Bank Soal & Paket Soal Tergenerate AI</span>
                            </h3>
                            <p class="text-[11px] text-slate-400 mt-0.5">Daftar paket soal ujian yang telah berhasil di-generate dan disimpan untuk mata pelajaran ini</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        ${savedExams.map(ex => {
                            const difficultyLabels = { mudah: 'Mudah', sedang: 'Sedang', sulit: 'Sulit' };
                            const diffLabel = difficultyLabels[ex.difficulty] || 'Sedang';
                            const diffColor = ex.difficulty === 'sulit' ? 'bg-rose-50 text-rose-700 border-rose-100' : (ex.difficulty === 'mudah' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100');
                            return `
                                <div class="p-4 bg-slate-50/70 border border-slate-150 rounded-2xl flex flex-col justify-between space-y-3 hover:border-indigo-200 transition">
                                    <div class="space-y-1">
                                        <div class="flex items-center justify-between">
                                            <span class="px-2 py-0.5 border text-[9px] font-extrabold rounded-lg uppercase ${diffColor}">${diffLabel}</span>
                                            <span class="text-[9px] text-slate-400 font-medium">${new Date(ex.createdAt).toLocaleDateString('id-ID')}</span>
                                        </div>
                                        <h4 class="text-xs font-bold text-slate-800 line-clamp-2">${ex.title}</h4>
                                    </div>
                                    <div class="flex items-center justify-between pt-2.5 border-t border-slate-200/60">
                                        <button type="button" onclick="deleteGeneratedExam('${ex.id}')" class="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl transition text-[10px]" title="Hapus Paket Soal">
                                            <i class="fa-solid fa-trash-can pointer-events-none"></i>
                                        </button>
                                        <div class="flex items-center gap-1 flex-wrap justify-end">
                                            <button type="button" onclick="downloadExamQuestionsAsWord('${ex.id}')" class="px-2 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-xl transition text-[10px] font-bold flex items-center space-x-1 cursor-pointer" title="Unduh Naskah Soal Word">
                                                <i class="fa-solid fa-file-word"></i><span>Soal</span>
                                            </button>
                                            <button type="button" onclick="downloadExamKisiAsWord('${ex.id}')" class="px-2 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-100 rounded-xl transition text-[10px] font-bold flex items-center space-x-1 cursor-pointer" title="Unduh Kisi-Kisi Word">
                                                <i class="fa-solid fa-table-list"></i><span>Kisi2</span>
                                            </button>
                                            <button type="button" onclick="downloadExamAnswerKeyAsWord('${ex.id}')" class="px-2 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-100 rounded-xl transition text-[10px] font-bold flex items-center space-x-1 cursor-pointer" title="Unduh Khusus Kunci Jawaban Word">
                                                <i class="fa-solid fa-key"></i><span>Kunci</span>
                                            </button>
                                            <button type="button" onclick="openPreviewExamModal('${ex.id}')" class="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition text-[10px] font-bold flex items-center space-x-1 cursor-pointer shadow-sm" title="Tinjau & Cetak">
                                                <i class="fa-solid fa-eye text-[9px]"></i><span>Lihat</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        contentHtml = `
            <div class="space-y-6 animate-fade-in">
                <!-- Back navigation and header -->
                <div class="flex items-center space-x-4 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
                    <button type="button" onclick="backToSubjectSelection()" class="w-10 h-10 rounded-2xl bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center border border-slate-100 transition shadow-sm cursor-pointer">
                        <i class="fa-solid fa-arrow-left"></i>
                    </button>
                    <div>
                        <span class="text-[10px] uppercase tracking-wider font-extrabold text-emerald-600 block">Kelola Modul Ajar</span>
                        <h2 class="text-xl sm:text-2xl font-bold text-slate-800">${selectedSubject.name}</h2>
                    </div>
                </div>

                <!-- 2 Main Cards: Mode 1 (Buat Modul & Filter) vs Mode 2 (Simpan Modul) -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- Card 1: Buat Modul & Filter -->
                    <div onclick="switchSubjectSubTab('buat')" class="p-5 sm:p-6 bg-white border-2 ${activeSubTab === 'buat' ? 'border-emerald-600 ring-2 ring-emerald-500/20 bg-emerald-50/20 shadow-md' : 'border-slate-200 hover:border-emerald-400'} rounded-3xl shadow-sm transition cursor-pointer flex items-center justify-between group">
                        <div class="flex items-center space-x-4">
                            <div class="w-12 h-12 rounded-2xl ${activeSubTab === 'buat' ? 'bg-emerald-600 text-white shadow-md' : 'bg-emerald-100 text-emerald-700'} flex items-center justify-center font-bold text-lg group-hover:scale-105 transition shrink-0">
                                <i class="fa-solid fa-wand-magic-sparkles"></i>
                            </div>
                            <div>
                                <span class="text-[10px] uppercase font-black tracking-wider text-emerald-600 block">Mode 1</span>
                                <h3 class="font-extrabold text-slate-900 text-base sm:text-lg flex items-center gap-1.5">
                                    <span>Buat Modul & Filter</span>
                                    <i class="fa-solid fa-wand-magic-sparkles text-emerald-600 text-xs"></i>
                                </h3>
                                <p class="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-1 font-medium">
                                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded-md font-semibold text-[11px]"><i class="fa-solid fa-filter text-emerald-600 text-[10px]"></i> Filter Kelas</span>
                                    <span>•</span>
                                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-50 text-purple-700 rounded-md font-semibold text-[11px]"><i class="fa-solid fa-wand-magic-sparkles text-purple-600 text-[10px]"></i> Generator AI</span>
                                    <span>•</span>
                                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded-md font-semibold text-[11px]"><i class="fa-solid fa-laptop-code text-teal-600 text-[10px]"></i> Ruang Kerja</span>
                                </p>
                            </div>
                        </div>
                        <div class="w-8 h-8 rounded-full ${activeSubTab === 'buat' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-400'} flex items-center justify-center text-xs font-bold transition shrink-0">
                            <i class="fa-solid fa-chevron-right"></i>
                        </div>
                    </div>

                    <!-- Card 2: Simpan Modul -->
                    <div onclick="switchSubjectSubTab('simpan')" class="p-5 sm:p-6 bg-white border-2 ${activeSubTab === 'simpan' ? 'border-blue-600 ring-2 ring-blue-500/20 bg-blue-50/20 shadow-md' : 'border-slate-200 hover:border-blue-400'} rounded-3xl shadow-sm transition cursor-pointer flex items-center justify-between group">
                        <div class="flex items-center space-x-4">
                            <div class="w-12 h-12 rounded-2xl ${activeSubTab === 'simpan' ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-md shadow-indigo-200' : 'bg-blue-100 text-blue-700'} flex items-center justify-center font-bold text-lg group-hover:scale-105 transition shrink-0">
                                <i class="fa-solid fa-box-archive"></i>
                            </div>
                            <div>
                                <span class="text-[10px] uppercase font-black tracking-wider text-blue-600 block">Mode 2</span>
                                <h3 class="font-extrabold text-slate-900 text-base sm:text-lg flex items-center gap-1.5">
                                    <span>Simpan Modul & Arsip</span>
                                    <i class="fa-solid fa-box-archive text-blue-600 text-xs"></i>
                                </h3>
                                <p class="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-1 font-medium">
                                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-semibold text-[11px]"><i class="fa-solid fa-box-archive text-indigo-500 text-[10px]"></i> Arsip dokumen</span>
                                    <span>•</span>
                                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded-md font-semibold text-[11px]"><i class="fa-solid fa-file-word text-blue-600 text-[10px]"></i><i class="fa-solid fa-file-pdf text-rose-600 text-[10px]"></i> import Word/PDF</span>
                                    <span>•</span>
                                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-md font-semibold text-[11px]"><i class="fa-solid fa-pen-to-square text-amber-600 text-[10px]"></i> edit</span>
                                    <span>•</span>
                                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-md font-semibold text-[11px]"><i class="fa-solid fa-download text-emerald-600 text-[10px]"></i> unduh berkas</span>
                                </p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2 shrink-0">
                            <span class="px-2.5 py-1 bg-blue-100 text-blue-800 font-black text-xs rounded-xl">${subjectPlans.length} Arsip</span>
                            <div class="w-8 h-8 rounded-full ${activeSubTab === 'simpan' ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'} flex items-center justify-center text-xs font-bold transition">
                                <i class="fa-solid fa-chevron-right"></i>
                            </div>
                        </div>
                    </div>
                </div>

        `;

        if (activeSubTab === 'simpan') {
            contentHtml += renderModulAjarSimpanView(selectedSubjectId) + `</div>`;
        } else if (activeSubTab === 'buat') {
            contentHtml += `
                <div class="bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-indigo-500/10 p-5 sm:p-6 rounded-3xl border border-emerald-200/60 shadow-sm space-y-4">
                    <div class="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-md shrink-0">
                                <i class="fa-solid fa-filter"></i>
                            </div>
                            <div>
                                <h3 class="text-sm sm:text-base font-extrabold text-slate-900">Filter Modul Ajar & Perangkat AI</h3>
                                <p class="text-xs text-slate-500">Filter berdasarkan Tingkat & Semester. Semua fitur generate (RPP, Soal, Kisi-kisi, DLL) otomatis menggunakan modul terfilter ini.</p>
                            </div>
                        </div>
                        
                        <div class="flex flex-wrap items-center gap-3 shrink-0">
                            <!-- Filter Tingkat -->
                            <div class="flex flex-col">
                                <label class="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">Tingkat</label>
                                <select id="select-modul-tingkat-filter" onchange="changeModulAjarFilter('level', this.value, '${selectedSubjectId}')" class="px-3.5 py-2 bg-white border-2 border-emerald-500 text-emerald-950 font-bold text-xs rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer">
                                    <option value="ALL" ${selectedLevel === 'ALL' ? 'selected' : ''}>Semua Tingkat</option>
                                    ${uniqueTingkats.map(lvl => `<option value="${lvl}" ${selectedLevel === lvl ? 'selected' : ''}>Tingkat ${lvl}</option>`).join('')}
                                </select>
                            </div>

                            <!-- Filter Semester -->
                            <div class="flex flex-col">
                                <label class="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 mb-0.5">Semester</label>
                                <select id="select-modul-semester-filter" onchange="changeModulAjarFilter('semester', this.value, '${selectedSubjectId}')" class="px-3.5 py-2 bg-white border-2 border-emerald-500 text-emerald-950 font-bold text-xs rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 cursor-pointer">
                                    <option value="ALL" ${selectedSemester === 'ALL' ? 'selected' : ''}>Semua Semester</option>
                                    <option value="1" ${selectedSemester === '1' ? 'selected' : ''}>Semester 1 (Ganjil)</option>
                                    <option value="2" ${selectedSemester === '2' ? 'selected' : ''}>Semester 2 (Genap)</option>
                                </select>
                            </div>

                            <!-- Tombol Aksi di Dalam Filter -->
                            <div class="flex flex-wrap items-center gap-2 pt-3 sm:pt-0">
                                <button type="button" onclick="openSignatureConfigModal()" class="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-2xs">
                                    <i class="fa-solid fa-file-signature text-[11px]"></i><span>Identitas & Pengesahan</span>
                                </button>
                                <button type="button" onclick="openImportModulModal('${selectedSubjectId}')" class="px-3.5 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-2xs cursor-pointer">
                                    <i class="fa-solid fa-file-arrow-up text-[11px] text-blue-600"></i><span>Import Modul (Word / PDF)</span>
                                </button>
                                <button type="button" onclick="openLessonPlanModal(null, '${selectedSubjectId}')" class="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-2xs">
                                    <i class="fa-solid fa-plus text-[10px] text-slate-500"></i><span>Buat Modul Manual</span>
                                </button>
                                <button type="button" onclick="openPromptModulModal('${selectedSubjectId}')" class="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-2xs cursor-pointer">
                                    <i class="fa-solid fa-clipboard-list text-[11px] text-amber-600"></i><span>Buat Prompt Modul</span>
                                </button>
                                <button type="button" onclick="triggerAIGenerateModulPopup('${selectedSubjectId}')" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-md hover:shadow-emerald-200/50 transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i><span>Generate Modul AI</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Filter summary indicator bar -->
                    <div class="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-emerald-200/40">
                        <div class="flex items-center space-x-2 flex-wrap">
                            <span class="text-[11px] font-bold text-slate-500 mr-1">Filter Aktif:</span>
                            <span class="px-2.5 py-1 bg-white border border-emerald-200 rounded-xl font-extrabold text-emerald-800 text-xs shadow-2xs">
                                Tingkat: ${selectedLevel === 'ALL' ? 'Semua Tingkat' : 'Tingkat ' + selectedLevel}
                            </span>
                            <span class="px-2.5 py-1 bg-white border border-emerald-200 rounded-xl font-extrabold text-emerald-800 text-xs shadow-2xs">
                                Semester: ${selectedSemester === 'ALL' ? 'Semua (1 & 2)' : 'Semester ' + selectedSemester}
                            </span>
                        </div>
                        <div class="font-extrabold text-xs text-emerald-900 bg-emerald-100/90 px-3.5 py-1.5 rounded-xl border border-emerald-200/60 shadow-2xs">
                            <i class="fa-solid fa-file-circle-check text-emerald-600 mr-1.5"></i>${plans.length} Modul Terfilter
                        </div>
                    </div>
                </div>

                <!-- Lesson Plans List divided into 4 Custom Columns -->
                <div class="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm space-y-6">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
                        <div>
                            <h3 class="text-lg font-bold text-slate-800">Ruang Kerja & Hasil Perangkat Pembelajaran AI</h3>
                            <p class="text-xs text-slate-500 mt-0.5">Seluruh hasil generate dikelompokkan otomatis ke dalam kolom masing-masing untuk memudahkan pemantauan jumlah dokumen.</p>
                        </div>
                        ${plans.length > 0 || savedExams.length > 0 ? `
                            <div class="flex flex-wrap gap-2 items-center">
                                <button type="button" onclick="openGenerateSoalKisiModal('${selectedSubjectId}')" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-brain"></i>
                                    <span>Soal & Kisi-Kisi</span>
                                </button>
                                <button type="button" onclick="openGenerateRppModal('${selectedSubjectId}')" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-file-signature"></i>
                                    <span>RPP Lengkap</span>
                                </button>
                                <button type="button" onclick="openGenerateDeviceModal('silabus', '${selectedSubjectId}')" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-scroll"></i>
                                    <span>Silabus</span>
                                </button>
                                <button type="button" onclick="openGenerateDeviceModal('atp', '${selectedSubjectId}')" class="px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-list-check"></i>
                                    <span>ATP</span>
                                </button>
                                <button type="button" onclick="openGenerateDeviceModal('kktp', '${selectedSubjectId}')" class="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-ruler-combined"></i>
                                    <span>KKTP</span>
                                </button>
                                <button type="button" onclick="openGenerateDeviceModal('prota', '${selectedSubjectId}')" class="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-calendar-days"></i>
                                    <span>Prota</span>
                                </button>
                                <button type="button" onclick="openGenerateDeviceModal('prosem', '${selectedSubjectId}')" class="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-table-cells"></i>
                                    <span>Prosem</span>
                                </button>
                                <button type="button" onclick="openGenerateDeviceModal('analisis_kikd', '${selectedSubjectId}')" class="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-chart-diagram"></i>
                                    <span>Analisis KI-KD</span>
                                </button>
                                <button type="button" onclick="openGenerateDeviceModal('tp', '${selectedSubjectId}')" class="px-3.5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-bullseye"></i>
                                    <span>TP</span>
                                </button>
                                <button type="button" onclick="openGenerateDeviceModal('cp', '${selectedSubjectId}')" class="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-graduation-cap"></i>
                                    <span>CP</span>
                                </button>
                                <button type="button" onclick="openGenerateDeviceModal('lkpd', '${selectedSubjectId}')" class="px-3.5 py-2 bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-book-open"></i>
                                    <span>LKPD</span>
                                </button>
                                <button type="button" onclick="openGeneratePPTModal('${selectedSubjectId}')" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-sm transition flex items-center space-x-1.5 cursor-pointer shadow-indigo-100">
                                    <i class="fa-solid fa-file-powerpoint"></i>
                                    <span>Generate PPT Interaktif</span>
                                </button>

                            </div>
                        ` : ''}
                    </div>

                    <!-- 4-Column Layout Grid -->
                    <div class="grid grid-cols-1 lg:grid-cols-4 gap-5 items-start">
                        
                        <!-- COLUMN 1: MODUL AJAR MANDIRI -->
                        ${(() => {
                            const modulAjarList = plans.filter(lp => !lp.isDevice && !lp.isRPP && !lp.isPPT && !lp.isPoster);
                            return `
                            <div class="bg-slate-50/50 rounded-2xl border border-slate-200/50 flex flex-col h-[70vh] overflow-hidden">
                                <div class="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
                                    <span class="text-xs font-black tracking-wider uppercase flex items-center gap-1.5 text-black">
                                        <i class="fa-solid fa-file-invoice text-emerald-600"></i>
                                        <span>Draf RPP & Modul Ajar (Mandiri)</span>
                                    </span>
                                    <span class="px-2.5 py-0.5 bg-emerald-600 text-white text-[10px] font-black rounded-lg">${modulAjarList.length} Berkas</span>
                                </div>
                                <div class="p-3 flex-1 min-h-0 overflow-y-auto space-y-3">
                                    ${modulAjarList.length === 0 ? `
                                        <div class="text-center py-8 text-slate-400 space-y-2">
                                            <i class="fa-solid fa-box-open text-lg mb-1 block"></i>
                                            <p class="text-[10px] font-bold">Belum Ada RPP / Modul</p>
                                            <p class="text-[9px] text-slate-400">Seluruh draf modul ajar, RPP manual, atau file Word/PDF yang diimpor disimpan di sini.</p>
                                            <div class="pt-2 flex flex-col items-center justify-center gap-1.5">
                                                <button type="button" onclick="openImportModulModal('${selectedSubjectId}')" class="w-full px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-xl text-[10px] font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer">
                                                    <i class="fa-solid fa-file-arrow-up text-[10px] text-blue-600"></i><span>Import Modul (Word/PDF)</span>
                                                </button>
                                                <button type="button" onclick="openPromptModulModal('${selectedSubjectId}')" class="w-full px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-[10px] font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer">
                                                    <i class="fa-solid fa-clipboard-list text-[10px]"></i><span>Buat Prompt Modul</span>
                                                </button>
                                                <button type="button" onclick="triggerAIGenerateModulPopup('${selectedSubjectId}')" class="w-full px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-[10px] font-bold transition flex items-center justify-center space-x-1.5 cursor-pointer">
                                                    <i class="fa-solid fa-wand-magic-sparkles text-[10px]"></i><span>Generate AI</span>
                                                </button>
                                            </div>
                                        </div>
                                    ` : modulAjarList.map(lp => `
                                        <div class="p-3.5 bg-white border border-slate-100 rounded-xl shadow-xs hover:border-emerald-300 hover:shadow-2xs transition flex flex-col justify-between space-y-3">
                                            <div class="space-y-1">
                                                <div class="flex items-center justify-between gap-1 flex-wrap">
                                                    <div class="flex items-center gap-1 flex-wrap">
                                                        <span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-100 text-[9px] font-bold rounded-md uppercase">${getModulClassesDisplay(lp)}</span>
                                                        <span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[9px] font-bold rounded-md">Sem ${lp.semester || '1'}</span>
                                                    </div>
                                                    ${lp.isImported ? `
                                                        <span class="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[9px] font-extrabold rounded-md flex items-center gap-1" title="Diimpor dari ${escapeHtml(lp.sourceFileName || 'File')}">
                                                            <i class="fa-solid fa-file-import text-[8px] text-blue-600"></i> ${lp.sourceType === 'pdf' ? 'PDF Import' : 'Word Import'}
                                                        </span>
                                                    ` : ''}
                                                </div>
                                                <h4 class="text-xs font-extrabold text-slate-800 line-clamp-2" title="${lp.title}">${lp.title}</h4>
                                                <p class="text-[10px] text-slate-500 line-clamp-1"><span class="font-bold text-slate-700">Materi:</span> ${lp.topic || '-'}</p>
                                                ${lp.isImported && lp.sourceFileName ? `
                                                    <p class="text-[9px] text-blue-600 truncate font-medium"><i class="fa-solid fa-paperclip text-[8px] mr-1"></i>${escapeHtml(lp.sourceFileName)}</p>
                                                ` : ''}
                                            </div>
                                            <div class="flex items-center justify-between pt-2 border-t border-slate-100">
                                                <button type="button" onclick="deleteLessonPlan('${lp.id}')" class="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg transition text-[10px]">
                                                    <i class="fa-solid fa-trash-can"></i>
                                                </button>
                                                <div class="flex items-center space-x-1">
                                                    <button type="button" onclick="openPreviewLessonPlan('${lp.id}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-[10px] font-bold rounded-lg transition flex items-center space-x-1">
                                                        <i class="fa-solid fa-eye text-[9px]"></i><span>Lihat</span>
                                                    </button>
                                                    <button type="button" onclick="openLessonPlanModal('${lp.id}', '${selectedSubjectId}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold rounded-lg transition flex items-center space-x-1">
                                                        <i class="fa-solid fa-pen-to-square text-[9px]"></i><span>Edit</span>
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>`;
                        })()}

                        <!-- COLUMN 2: RPP LENGKAP AI -->
                        ${(() => {
                            const rppList = plans.filter(lp => lp.isRPP);
                            return `
                            <div class="bg-slate-50/50 rounded-2xl border border-slate-200/50 flex flex-col h-[70vh] overflow-hidden">
                                <div class="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
                                    <span class="text-xs font-black tracking-wider uppercase flex items-center gap-1.5 text-black">
                                        <i class="fa-solid fa-file-signature text-teal-600"></i>
                                        <span>RPP Lengkap Kurikulum Merdeka (AI)</span>
                                    </span>
                                    <span class="px-2.5 py-0.5 bg-teal-600 text-white text-[10px] font-black rounded-lg">${rppList.length} Dokumen</span>
                                </div>
                                <div class="p-3 flex-1 min-h-0 overflow-y-auto space-y-3">
                                    ${rppList.length === 0 ? `
                                        <div class="text-center py-8 text-slate-400">
                                            <i class="fa-solid fa-box-open text-lg mb-1.5 block"></i>
                                            <p class="text-[10px] font-bold">Belum Ada RPP Lengkap</p>
                                            <p class="text-[9px] text-slate-400 mt-1">Dokumen RPP utuh, sistematis, dan siap cetak hasil generate AI.</p>
                                        </div>
                                    ` : rppList.map(lp => `
                                        <div class="p-3.5 bg-white border border-slate-100 rounded-xl shadow-xs hover:border-teal-300 hover:shadow-2xs transition flex flex-col justify-between space-y-3">
                                            <div class="space-y-1">
                                                <div class="flex items-center justify-between gap-1 flex-wrap mb-1">
                                                    <span class="px-2 py-0.5 bg-teal-50 text-teal-700 border border-teal-100 text-[9px] font-black rounded-md">RPP LENGKAP</span>
                                                    <span class="text-[9px] text-slate-400 font-bold">${new Date(lp.createdAt).toLocaleDateString('id-ID')}</span>
                                                </div>
                                                <h4 class="text-xs font-extrabold text-slate-800 line-clamp-2" title="${lp.title}">${lp.title}</h4>
                                                <p class="text-[10px] text-slate-500 line-clamp-1"><span class="font-bold text-slate-700">Topik:</span> ${lp.topic || '-'}</p>
                                            </div>
                                            <div class="flex items-center justify-between pt-2 border-t border-slate-100">
                                                <button type="button" onclick="deleteLessonPlan('${lp.id}')" class="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg transition text-[10px]">
                                                    <i class="fa-solid fa-trash-can"></i>
                                                </button>
                                                <button type="button" onclick="openPreviewLessonPlan('${lp.id}')" class="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-[10px] font-bold rounded-lg transition flex items-center space-x-1">
                                                    <i class="fa-solid fa-eye text-[9px]"></i><span>Buka RPP</span>
                                                </button>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>`;
                        })()}

                        <!-- COLUMN 3: PERANGKAT & ADMINISTRASI KELAS -->
                        ${(() => {
                            const administrasiList = plans.filter(lp => lp.isDevice && !lp.isRPP);
                            return `
                            <div class="bg-slate-50/50 rounded-2xl border border-slate-200/50 flex flex-col h-[70vh] overflow-hidden">
                                <div class="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
                                    <span class="text-xs font-black tracking-wider uppercase flex items-center gap-1.5 text-black">
                                        <i class="fa-solid fa-folder-tree text-blue-600"></i>
                                        <span>Perangkat & Administrasi Kelas</span>
                                    </span>
                                    <span class="px-2.5 py-0.5 bg-blue-600 text-white text-[10px] font-black rounded-lg">${administrasiList.length} Berkas</span>
                                </div>
                                <div class="p-3 flex-1 min-h-0 overflow-y-auto space-y-3">
                                    ${administrasiList.length === 0 ? `
                                        <div class="text-center py-8 text-slate-400">
                                            <i class="fa-solid fa-box-open text-lg mb-1.5 block"></i>
                                            <p class="text-[10px] font-bold">Belum Ada Administrasi Kelas</p>
                                            <p class="text-[9px] text-slate-400 mt-1">Dokumen Silabus, ATP, KKTP, Prota, Prosem, dll untuk kelengkapan administrasi.</p>
                                        </div>
                                    ` : administrasiList.map(lp => `
                                        <div class="p-3.5 bg-white border border-slate-100 rounded-xl shadow-xs hover:border-blue-300 hover:shadow-2xs transition flex flex-col justify-between space-y-3">
                                            <div class="space-y-1">
                                                <div class="flex items-center justify-between gap-1 flex-wrap mb-1">
                                                    <span class="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-100 text-[9px] font-black rounded-md uppercase">${lp.deviceType?.replace('_', ' ') || 'DOKUMEN'}</span>
                                                    <span class="text-[9px] text-slate-400 font-bold">${new Date(lp.createdAt).toLocaleDateString('id-ID')}</span>
                                                </div>
                                                <h4 class="text-xs font-extrabold text-slate-800 line-clamp-2" title="${lp.title}">${lp.title}</h4>
                                            </div>
                                            <div class="flex items-center justify-between pt-2 border-t border-slate-100">
                                                <button type="button" onclick="deleteLessonPlan('${lp.id}')" class="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg transition text-[10px]">
                                                    <i class="fa-solid fa-trash-can"></i>
                                                </button>
                                                <button type="button" onclick="openPreviewLessonPlan('${lp.id}')" class="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-bold rounded-lg transition flex items-center space-x-1">
                                                    <i class="fa-solid fa-eye text-[9px]"></i><span>Buka</span>
                                                </button>
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                            </div>`;
                        })()}

                        <!-- COLUMN 4: MEDIA & EVALUASI INTERAKTIF (PPT / EXAMS) -->
                        ${(() => {
                            const mediaList = [
                                ...plans.filter(lp => lp.isPPT).map(lp => ({ ...lp, isMedia: true })),
                                ...savedExams.map(ex => ({ ...ex, isExam: true }))
                            ];
                            return `
                            <div class="bg-slate-50/50 rounded-2xl border border-slate-200/50 flex flex-col h-[70vh] overflow-hidden">
                                <div class="px-4 py-3 bg-white border-b border-slate-200 flex items-center justify-between shadow-xs">
                                    <span class="text-xs font-black tracking-wider uppercase flex items-center gap-1.5 text-black">
                                        <i class="fa-solid fa-wand-magic-sparkles text-purple-600"></i>
                                        <span>Media Visual & Evaluasi AI</span>
                                    </span>
                                    <span class="px-2.5 py-0.5 bg-purple-600 text-white text-[10px] font-black rounded-lg">${mediaList.length} Aset</span>
                                </div>
                                <div class="p-3 flex-1 min-h-0 overflow-y-auto space-y-3">
                                    ${mediaList.length === 0 ? `
                                        <div class="text-center py-8 text-slate-400">
                                            <i class="fa-solid fa-box-open text-lg mb-1.5 block"></i>
                                            <p class="text-[10px] font-bold">Belum Ada Media / Evaluasi AI</p>
                                            <p class="text-[9px] text-slate-400 mt-1">Media presentasi PPT Interaktif, atau Bank Soal & Kisi-Kisi.</p>
                                        </div>
                                    ` : mediaList.map(item => {
                                        if (item.isExam) {
                                            const difficultyLabels = { mudah: 'Mudah', sedang: 'Sedang', sulit: 'Sulit' };
                                            const diffLabel = difficultyLabels[item.difficulty] || 'Sedang';
                                            const diffColor = item.difficulty === 'sulit' ? 'bg-rose-50 text-rose-700 border-rose-100' : (item.difficulty === 'mudah' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-700 border-amber-100');
                                            return `
                                            <!-- Exam Card -->
                                            <div class="p-3.5 bg-white border border-slate-100 rounded-xl shadow-xs hover:border-indigo-300 hover:shadow-2xs transition flex flex-col justify-between space-y-3">
                                                <div class="space-y-1">
                                                    <div class="flex items-center justify-between gap-1 flex-wrap mb-1">
                                                        <span class="px-2 py-0.5 border text-[9px] font-black rounded-md uppercase ${diffColor}">${diffLabel}</span>
                                                        <span class="text-[9px] text-slate-400 font-bold">${new Date(item.createdAt).toLocaleDateString('id-ID')}</span>
                                                    </div>
                                                    <h4 class="text-xs font-extrabold text-slate-800 line-clamp-2" title="${item.title}">${item.title}</h4>
                                                </div>
                                                <div class="flex items-center justify-between pt-2 border-t border-slate-100 gap-1.5">
                                                    <button type="button" onclick="deleteGeneratedExam('${item.id}')" class="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg transition text-[10px]">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                    <div class="flex items-center gap-1">
                                                        <button type="button" onclick="openPreviewExamModal('${item.id}')" class="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-bold rounded-lg transition flex items-center space-x-1 cursor-pointer">
                                                            <i class="fa-solid fa-eye text-[9px]"></i><span>Buka</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>`;
                                        } else if (item.isPPT) {
                                            return `
                                            <!-- PPT Card -->
                                            <div class="p-3.5 bg-white border border-slate-100 rounded-xl shadow-xs hover:border-amber-300 hover:shadow-2xs transition flex flex-col justify-between space-y-3">
                                                <div class="space-y-1">
                                                    <div class="flex items-center justify-between gap-1 flex-wrap mb-1">
                                                        <span class="px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100 text-[9px] font-black rounded-md uppercase">PPT INTERAKTIF</span>
                                                        <span class="text-[9px] text-slate-400 font-bold">${new Date(item.createdAt).toLocaleDateString('id-ID')}</span>
                                                    </div>
                                                    <h4 class="text-xs font-extrabold text-slate-800 line-clamp-2" title="${item.title}">${item.title}</h4>
                                                </div>
                                                <div class="flex items-center justify-between pt-2 border-t border-slate-100">
                                                    <button type="button" onclick="deleteLessonPlan('${item.id}')" class="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg transition text-[10px]">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                    <button type="button" onclick="window.renderPPTViewerModal(JSON.parse(this.dataset.ppt), '${selectedSubject.name.replace(/'/g, "\\'")}', '${item.title.replace(/'/g, "\\'")}')" data-ppt="${escapeHtml(item.htmlContent)}" class="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-[10px] font-bold rounded-lg transition flex items-center space-x-1 cursor-pointer">
                                                        <i class="fa-solid fa-file-powerpoint text-[9px]"></i><span>Mulai</span>
                                                    </button>
                                                </div>
                                            </div>`;
                                        } else {
                                            return `
                                            <!-- Poster Card -->
                                            <div class="p-3.5 bg-white border border-slate-100 rounded-xl shadow-xs hover:border-pink-300 hover:shadow-2xs transition flex flex-col justify-between space-y-3">
                                                <div class="space-y-1">
                                                    <div class="flex items-center justify-between gap-1 flex-wrap mb-1">
                                                        <span class="px-2 py-0.5 bg-pink-50 text-pink-700 border border-pink-100 text-[9px] font-black rounded-md uppercase">POSTER INTERAKTIF</span>
                                                        <span class="text-[9px] text-slate-400 font-bold">${new Date(item.createdAt).toLocaleDateString('id-ID')}</span>
                                                    </div>
                                                    <h4 class="text-xs font-extrabold text-slate-800 line-clamp-2" title="${item.title}">${item.title}</h4>
                                                </div>
                                                <div class="flex items-center justify-between pt-2 border-t border-slate-100">
                                                    <button type="button" onclick="deleteLessonPlan('${item.id}')" class="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-lg transition text-[10px]">
                                                        <i class="fa-solid fa-trash-can"></i>
                                                    </button>
                                                    <button type="button" onclick="window.renderPosterModalViewer(JSON.parse(this.dataset.poster), ${modulInlineArg(selectedSubject.name)}, ${modulInlineArg(item.title)})" data-poster="${escapeHtml(item.htmlContent)}" class="px-2.5 py-1 bg-pink-600 hover:bg-pink-700 text-white text-[10px] font-bold rounded-lg transition flex items-center space-x-1 cursor-pointer">
                                                        <i class="fa-solid fa-image text-[9px]"></i><span>Buka</span>
                                                    </button>
                                                </div>
                                            </div>`;
                                        }
                                    }).join('')}
                                </div>
                            </div>`;
                        })()}

                    </div>
                </div>
            </div>
        `;
        } else if (!activeSubTab) {
            contentHtml += '</div>';
        }
    } else {
        // Check subjects that ALREADY have created lesson plans
        const managedSubjects = (appState.subjects || []).map(s => {
            const plans = (appState.lessonPlans || []).filter(lp => isSameSubject(getLessonPlanSubjectForView(lp), s.id, appState.subjects));
            return {
                ...s,
                plans,
                planCount: plans.length
            };
        }).filter(s => s.planCount > 0);

        let managedSubjectsHtml = '';
        if (managedSubjects.length > 0) {
            managedSubjectsHtml = `
                <!-- Cards for subjects that ALREADY have Modul Ajar -->
                <div class="bg-gradient-to-r from-emerald-50 via-teal-50/50 to-indigo-50/50 p-5 sm:p-7 rounded-3xl border border-emerald-200/80 shadow-sm space-y-4">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-md">
                                <i class="fa-solid fa-folder-open"></i>
                            </div>
                            <div>
                                <h3 class="text-sm sm:text-base font-extrabold text-slate-900">Mata Pelajaran Terkelola (${managedSubjects.length})</h3>
                                <p class="text-xs text-slate-500">Mata pelajaran yang telah memiliki modul ajar tersimpan. Klik untuk mengelola, mengedit, atau menambah perangkat ajar.</p>
                            </div>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 pt-1">
                        ${managedSubjects.map(s => {
                            const latestTopic = s.plans[s.plans.length - 1]?.topic || s.plans[s.plans.length - 1]?.title || 'Modul Ajar';
                            const gradesUsed = [...new Set(s.plans.map(p => 'Kelas ' + (p.grade || 'X')))].join(', ');
                            return `
                                <div onclick="selectSubjectForModulAjar('${s.id}')" class="p-5 bg-white border-2 border-emerald-500/40 hover:border-emerald-600 rounded-2xl shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col justify-between space-y-4">
                                    <div class="space-y-2">
                                        <div class="flex items-center justify-between">
                                            <span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-xl flex items-center gap-1">
                                                <i class="fa-solid fa-circle-check text-[9px] text-emerald-600"></i>
                                                <span>${s.planCount} Modul Ajar</span>
                                            </span>
                                            <span class="text-[10px] font-mono text-slate-400 font-bold">${s.code || s.id}</span>
                                        </div>
                                        <h4 class="text-base font-extrabold text-slate-900 group-hover:text-emerald-700 transition line-clamp-1">${s.name}</h4>
                                        <p class="text-xs text-slate-500 line-clamp-2"><span class="font-semibold text-slate-700">Topik Terbaru:</span> ${latestTopic}</p>
                                        <p class="text-[11px] text-slate-400 font-medium">${gradesUsed}</p>
                                    </div>
                                    <div class="pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-emerald-600 group-hover:text-emerald-700">
                                        <span>Kelola Modul Ajar</span>
                                        <i class="fa-solid fa-arrow-right text-xs group-hover:translate-x-1 transition"></i>
                                    </div>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
        }

        contentHtml = `
            <div class="space-y-6 max-w-5xl mx-auto">
                <!-- Clean Title Header -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                    <div>
                        <h2 class="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Modul Ajar Digital</h2>
                        <p class="text-xs text-slate-500 font-medium">Silakan pilih mata pelajaran untuk mengelola atau membuat modul ajar (RPP)</p>
                    </div>
                </div>

                ${managedSubjectsHtml}

                <!-- Subject Search & Selection Card -->
                <div class="bg-white p-5 sm:p-7 rounded-3xl border border-slate-200 shadow-sm space-y-5">
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <div>
                            <h3 class="text-sm sm:text-base font-extrabold text-slate-900">
                                ${managedSubjects.length > 0 ? 'Pilih / Cari Mata Pelajaran Lain' : 'Mata Pelajaran'}
                            </h3>
                            <p class="text-[11px] text-slate-400">Pilih dari daftar mata pelajaran di bawah ini untuk memulai penyusunan modul baru</p>
                        </div>

                        <div class="relative w-full sm:w-72">
                            <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3.5 text-slate-400 text-xs"></i>
                            <input type="text" id="mapel-search-input" value="${searchQuery}" oninput="searchMapelModulAjar(this.value)" placeholder="Cari mata pelajaran..." class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold" autocomplete="off">
                        </div>
                    </div>

                    <!-- Results container -->
                    <div id="mapel-results-container" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 max-h-[480px] overflow-y-auto pr-1">
                        <!-- Populated dynamically via searchMapelModulAjar -->
                    </div>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="space-y-6 animate-fade-in">
            ${contentHtml}
        </div>
    `;

    if (!selectedSubject) {
        searchMapelModulAjar(searchQuery);
    }
}

function searchMapelModulAjar(query) {
    appState.modulAjarSearchQuery = query;
    const container = document.getElementById('mapel-results-container');
    if (!container) return;

    const kw = (query || '').toLowerCase().trim();
    const subjects = appState.subjects || [];

    const filtered = subjects.filter(s => {
        if (!kw) return true;
        return (s.name && s.name.toLowerCase().includes(kw)) || (s.code && s.code.toLowerCase().includes(kw));
    });

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-10 bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs font-semibold">
                Mata pelajaran tidak ditemukan. Coba ketik kata kunci lain.
            </div>
        `;
        return;
    }

    if (!kw) {
        filtered.sort((a, b) => {
            const countA = (appState.lessonPlans || []).filter(lp => isSameSubject(getLessonPlanSubjectForView(lp), a.id, appState.subjects)).length;
            const countB = (appState.lessonPlans || []).filter(lp => isSameSubject(getLessonPlanSubjectForView(lp), b.id, appState.subjects)).length;
            return countB - countA;
        });
    }

    container.innerHTML = filtered.map(s => {
        const planCount = (appState.lessonPlans || []).filter(lp => isSameSubject(getLessonPlanSubjectForView(lp), s.id, appState.subjects)).length;
        const isManaged = planCount > 0;
        return `
            <div onclick="selectSubjectForModulAjar('${s.id}')" class="flex flex-col justify-between p-4 bg-white hover:bg-emerald-50/50 border ${isManaged ? 'border-emerald-300' : 'border-slate-200'} hover:border-emerald-400 rounded-2xl shadow-sm transition cursor-pointer group space-y-3">
                <div class="flex items-start justify-between space-x-3">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-xl ${isManaged ? 'bg-emerald-600 text-white' : 'bg-emerald-100 text-emerald-700'} flex items-center justify-center font-bold text-sm shadow-sm group-hover:bg-emerald-600 group-hover:text-white transition shrink-0">
                            <i class="fa-solid fa-book-bookmark"></i>
                        </div>
                        <div>
                            <h4 class="text-sm font-extrabold text-slate-900 group-hover:text-emerald-700 transition line-clamp-1">${s.name}</h4>
                            <p class="text-[11px] text-slate-500 font-mono font-semibold">Kode: ${s.code || s.id}</p>
                        </div>
                    </div>
                </div>

                <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                    <span class="px-2 py-0.5 ${isManaged ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-600'} font-bold rounded-lg group-hover:bg-emerald-100 group-hover:text-emerald-800 transition">
                        ${planCount > 0 ? `${planCount} Modul Ajar` : 'Belum Ada Modul'}
                    </span>
                    <span class="font-extrabold text-emerald-600 flex items-center gap-1 group-hover:translate-x-0.5 transition">
                        <span>Kelola</span>
                        <i class="fa-solid fa-chevron-right text-[10px]"></i>
                    </span>
                </div>
            </div>
        `;
    }).join('');
}

window.getModulClassesDisplay = function(lp) {
    if (!lp) return 'Semua Kelas';
    let targetList = [];
    if (Array.isArray(lp.classes) && lp.classes.length > 0) {
        targetList = lp.classes;
    } else if (Array.isArray(lp.targetClasses) && lp.targetClasses.length > 0) {
        targetList = lp.targetClasses;
    } else if (lp.grade) {
        if (lp.grade === 'ALL') return 'Semua Kelas';
        targetList = String(lp.grade).split(',').map(s => s.trim()).filter(Boolean);
    }
    
    if (targetList.length === 0 || targetList.includes('ALL')) return 'Semua Kelas';

    const appClasses = appState.classes || [];
    const names = targetList.map(item => {
        if (item === 'ALL') return 'Semua Kelas';
        const found = appClasses.find(c => String(c.id) === String(item) || c.name === item);
        return found ? found.name : item;
    });

    return names.join(', ');
};

var tempModulClasses = ['ALL'];
var tempAIModulClasses = ['ALL'];

window.renderModulClassChips = function() {
    const container = document.getElementById('lp-selected-classes-container');
    if (!container) return;

    if (!tempModulClasses || tempModulClasses.length === 0) {
        tempModulClasses = ['ALL'];
    }

    const appClasses = appState.classes || [];
    const html = tempModulClasses.map(val => {
        let label = 'Semua Kelas';
        if (val !== 'ALL') {
            const cls = appClasses.find(c => String(c.id) === String(val) || c.name === val);
            label = cls ? cls.name : val;
        }
        return `
            <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100/90 text-emerald-900 font-extrabold text-xs rounded-xl shadow-sm border border-emerald-300/80">
                <span>${label}</span>
                <button type="button" onclick="removeModulClass('${val}')" class="hover:bg-emerald-200 text-emerald-700 hover:text-emerald-950 rounded-full w-4 h-4 flex items-center justify-center transition text-[10px]" title="Hapus Kelas">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </span>
        `;
    }).join('');

    container.innerHTML = html;
};

window.addModulClass = function(val) {
    if (!val) return;
    const dropdown = document.getElementById('lp-class-dropdown');
    if (val === 'ALL') {
        tempModulClasses = ['ALL'];
    } else {
        tempModulClasses = tempModulClasses.filter(c => c !== 'ALL');
        if (!tempModulClasses.includes(val)) {
            tempModulClasses.push(val);
        }
    }
    renderModulClassChips();
    if (dropdown) dropdown.value = '';
};

window.removeModulClass = function(val) {
    tempModulClasses = tempModulClasses.filter(c => c !== val);
    if (tempModulClasses.length === 0) {
        tempModulClasses = ['ALL'];
    }
    renderModulClassChips();
};

window.renderAIModulClassChips = function() {
    const container = document.getElementById('ai-selected-classes-container');
    if (!container) return;

    if (!tempAIModulClasses || tempAIModulClasses.length === 0) {
        tempAIModulClasses = ['ALL'];
    }

    const appClasses = appState.classes || [];
    const html = tempAIModulClasses.map(val => {
        let label = 'Semua Kelas';
        if (val !== 'ALL') {
            const cls = appClasses.find(c => String(c.id) === String(val) || c.name === val);
            label = cls ? cls.name : val;
        }
        return `
            <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-100/90 text-emerald-900 font-extrabold text-xs rounded-xl shadow-sm border border-emerald-300/80">
                <span>${label}</span>
                <button type="button" onclick="removeAIModulClass('${val}')" class="hover:bg-emerald-200 text-emerald-700 hover:text-emerald-950 rounded-full w-4 h-4 flex items-center justify-center transition text-[10px]" title="Hapus Kelas">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </span>
        `;
    }).join('');

    container.innerHTML = html;
};

window.addAIModulClass = function(val) {
    if (!val) return;
    const dropdown = document.getElementById('ai-class-dropdown');
    if (val === 'ALL') {
        tempAIModulClasses = ['ALL'];
    } else {
        tempAIModulClasses = tempAIModulClasses.filter(c => c !== 'ALL');
        if (!tempAIModulClasses.includes(val)) {
            tempAIModulClasses.push(val);
        }
    }
    renderAIModulClassChips();
    if (dropdown) dropdown.value = '';
};

window.removeAIModulClass = function(val) {
    tempAIModulClasses = tempAIModulClasses.filter(c => c !== val);
    if (tempAIModulClasses.length === 0) {
        tempAIModulClasses = ['ALL'];
    }
    renderAIModulClassChips();
};

var tempImportModulClasses = ['ALL'];

window.renderImportModulClassChips = function() {
    const container = document.getElementById('import-selected-classes-container');
    if (!container) return;

    if (!tempImportModulClasses || tempImportModulClasses.length === 0) {
        tempImportModulClasses = ['ALL'];
    }

    const appClasses = appState.classes || [];
    const html = tempImportModulClasses.map(val => {
        let label = 'Semua Kelas';
        if (val !== 'ALL') {
            const cls = appClasses.find(c => String(c.id) === String(val) || c.name === val);
            label = cls ? cls.name : val;
        }
        return `
            <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100/90 text-blue-900 font-extrabold text-xs rounded-xl shadow-2xs border border-blue-300">
                <span>${escapeHtml(label)}</span>
                <button type="button" onclick="window.removeImportModulClass('${escapeHtml(val)}')" class="hover:bg-blue-200 text-blue-700 hover:text-blue-950 rounded-full w-4 h-4 flex items-center justify-center transition text-[10px]" title="Hapus Kelas">
                    <i class="fa-solid fa-xmark"></i>
                </button>
            </span>
        `;
    }).join('');

    container.innerHTML = html;
};

window.addImportModulClass = function(val) {
    if (!val) return;
    const dropdown = document.getElementById('import-class-dropdown');
    if (val === 'ALL') {
        tempImportModulClasses = ['ALL'];
    } else {
        tempImportModulClasses = tempImportModulClasses.filter(c => c !== 'ALL');
        if (!tempImportModulClasses.includes(val)) {
            tempImportModulClasses.push(val);
        }
    }
    window.renderImportModulClassChips();
    if (dropdown) dropdown.value = '';
};

window.removeImportModulClass = function(val) {
    tempImportModulClasses = tempImportModulClasses.filter(c => c !== val);
    if (tempImportModulClasses.length === 0) {
        tempImportModulClasses = ['ALL'];
    }
    window.renderImportModulClassChips();
};

function selectSubjectForModulAjar(subjectId) {
    appState.selectedModulAjarSubjectId = subjectId;
    appState.activeModulAjarSubTab = null;
    renderModulAjarModule(document.getElementById('view-container'));
}

window.switchSubjectSubTab = function(tab) {
    appState.activeModulAjarSubTab = tab;
    renderModulAjarModule(document.getElementById('view-container'));
};

window.changeModulAjarSelectedGrade = function(grade, subjectId) {
    appState.selectedModulAjarGrade = grade;
    renderModulAjarModule(document.getElementById('view-container'));
};

function backToSubjectSelection() {
    appState.selectedModulAjarSubjectId = null;
    appState.modulAjarSearchQuery = '';
    renderModulAjarModule(document.getElementById('view-container'));
}

function getComprehensiveModulAjarStandardData(params = {}) {
    if (typeof window !== 'undefined' && typeof window.getComprehensiveModulAjarStandardData === 'function') {
        return window.getComprehensiveModulAjarStandardData(params);
    }
    let subjectName, topic, grade;
    if (typeof params === 'object' && params !== null && !Array.isArray(params)) {
        subjectName = params.subjectName;
        topic = params.topic;
        grade = params.grade;
    } else {
        subjectName = arguments[0];
        topic = arguments[1];
        grade = arguments[2];
    }
    return {
        identitasModul: `MODUL AJAR KURIKULUM MERDEKA\nFASE D/E/F - ${grade || 'VII'}\nMATA PELAJARAN: ${subjectName || 'Mata Pelajaran'}\nTOPIK: ${topic || 'Materi Utama'}`,
        kompetensiAwal: `Pemahaman dan penerapan materi ${topic || 'materi'} secara mendalam.`,
        profilPancasila: `1. Beriman & Bertakwa\n2. Bernalar Kritis\n3. Mandiri\n4. Bergotong Royong`,
        saranaPrasarana: `Buku Teks, Media Interaktif, Komputer, LKPD`,
        targetPeserta: `Peserta didik reguler, cepat, dan butuh bimbingan`,
        modelPembelajaran: `Deep Learning & Problem Based Learning`,
        tujuanPembelajaran: `1. Menjelaskan konsep dasar ${topic}\n2. Menganalisis kaidah ${topic}\n3. Memecahkan studi kasus nyata`,
        pemahamanBermakna: `Penguasaan materi membimbing peserta didik berpikir kritis dan berakhlak mulia.`,
        pertanyaanPemantik: `Mengapa materi ${topic} penting dalam kehidupan sehari-hari?`,
        persiapanPembelajaran: `Menyiapkan media ajar, bahan bacaan, dan instrumen LKPD.`,
        kegiatanPembelajaran: `Pertemuan 1: Konsep Pokok & Landasan\nPertemuan 2: Analisis Masalah & Diskusi LKPD\nPertemuan 3: Uji Kompetensi HOTS & Refleksi`,
        asesmen: `Asesmen Diagnostik, Formatif (LKPD & Diskusi), dan Sumatif (Tes Kasus HOTS).`,
        pengayaanRemedial: `Pengayaan studi kasus mendalam & Bimbingan remedial terfokus.`,
        lembarKerja: `Refleksi Diri dan Skala Pembiasaan Sikap Positif.`,
        lkpd: `Lembar Kerja Peserta Didik (Aktivitas Konsep, Analisis Kasus, dan Komitmen Aksi).`,
        glosarium: `Daftar istilah penting seputar materi.`,
        daftarPustaka: `Panduan Kurikulum Merdeka & Buku Referensi Terpercaya.`
    };
}

function generateModulAjarNonAI(event, subjectId, subjectName) {
    if (event) event.preventDefault();
    const topicInput = document.getElementById('ai-modul-topic');
    const topic = topicInput ? topicInput.value.trim() : '';
    if (!topic) {
        showToast('Silakan isi Materi / Topik Utama terlebih dahulu.', 'warning');
        if (topicInput) topicInput.focus();
        return;
    }
    const materiDetail = document.getElementById('ai-modul-materi-detail')?.value || '';
    const semester = document.getElementById('ai-modul-semester')?.value || '1';
    const selectedTingkat = document.getElementById('ai-modul-tingkat')?.value || appState.selectedModulAjarLevel || 'ALL';
    const selectedClasses = [selectedTingkat];
    const gradeDisplay = selectedTingkat === 'ALL' ? 'Semua Tingkat' : 'Tingkat ' + selectedTingkat;
    const model = document.getElementById('ai-modul-model')?.value || 'Deep Learning';
    const alokasiWaktu = document.getElementById('ai-modul-alokasi')?.value || '4 JP';
    const jenisMateri = document.getElementById('ai-modul-jenis')?.value || 'OTOMATIS';

    const fullData = getComprehensiveModulAjarStandardData({
        subjectName,
        topic,
        materiDetail,
        grade: gradeDisplay,
        semester,
        model,
        alokasiWaktu,
        jenisMateri,
        variationNonce: Date.now() + Math.floor(Math.random() * 10000)
    });

    closeModal();
    openLessonPlanModalWithData({
        subjectId,
        semester,
        title: `Modul ${subjectName}: ${topic}`,
        topic,
        grade: selectedTingkat,
        classes: selectedClasses,
        targetClasses: selectedClasses,
        ...fullData
    });
    showToast('Modul Ajar Non-AI berhasil disusun secara lengkap sesuai standar!', 'success');
}
window.generateModulAjarNonAI = generateModulAjarNonAI;
if (!window.getComprehensiveModulAjarStandardData) {
    window.getComprehensiveModulAjarStandardData = getComprehensiveModulAjarStandardData;
}

// ----------------------------------------------------
// IMPORT MODUL AJAR (WORD / PDF / TEXT) IMPLEMENTATION
// ----------------------------------------------------
window.currentImportedDocData = null;

window.openImportModulModal = function(subjectId) {
    window.currentImportedDocData = null;
    tempImportModulClasses = ['ALL'];
    const subject = appState.subjects ? appState.subjects.find(s => String(s.id) === String(subjectId)) : null;
    const subjectName = subject ? subject.name : 'Mata Pelajaran';
    const uniqueTingkats = getUniqueTingkatList(appState.classes || []);
    const activeLevel = appState.selectedModulAjarLevel || 'ALL';
    const activeSemester = appState.selectedModulAjarSemester || '1';

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 w-screen h-screen z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 overflow-hidden">
            <!-- Hidden File Input placed safely outside dropzone so it is never destroyed on innerHTML update -->
            <input type="file" id="import-file-input" accept=".docx,.doc,.pdf,.txt" class="hidden" onchange="window.handleModulFileInput(this.files, '\${subjectId}'); this.value = '';">

            <div class="bg-white w-full max-w-2xl mx-auto rounded-3xl shadow-2xl flex flex-col text-left relative max-h-[85vh] sm:max-h-[90vh] overflow-hidden">
                
                <!-- Fixed Modal Header -->
                <div class="flex justify-between items-center p-5 sm:p-6 pb-4 border-b border-slate-100 shrink-0 bg-white rounded-t-3xl z-10">
                    <div class="flex items-center space-x-3 text-blue-600">
                        <div class="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                            <i class="fa-solid fa-file-arrow-up"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-800 text-base sm:text-lg leading-tight">Import Modul Ajar (Word/PDF)</h3>
                            <p class="text-xs text-slate-400 font-medium">${escapeHtml(subjectName)}</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <!-- Scrollable Modal Body -->
                <div class="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-5 bg-slate-50/30">
                    <form id="import-modul-modal-form" onsubmit="event.preventDefault(); window.saveImportedModulDirectly('${subjectId}', '${subjectName.replace(/'/g, "\\'")}')" class="space-y-4">
                        <div class="p-3.5 bg-blue-50/70 border border-blue-100 rounded-2xl text-xs text-blue-950 space-y-1">
                            <p class="font-bold flex items-center gap-1.5"><i class="fa-solid fa-circle-info text-blue-600"></i> Sumber Acuan Perangkat Pembelajaran:</p>
                            <p class="text-[11px] text-slate-600 leading-relaxed">
                                Upload file <strong>Word (.docx/.doc)</strong> atau <strong>PDF</strong> modul ajar buatan Anda sendiri. Dokumen yang diimpor akan tersimpan di aplikasi dan otomatis dijadikan <strong>acuan kontekstual</strong> untuk menyusun kisi-kisi, soal ujian, RPP, silabus, ATP, hingga PPT Interaktif!
                            </p>
                        </div>

                        <!-- File Dropzone -->
                        <div id="import-dropzone" 
                             ondragover="event.preventDefault(); this.classList.add('border-blue-500', 'bg-blue-50/40');" 
                             ondragleave="this.classList.remove('border-blue-500', 'bg-blue-50/40');" 
                             ondrop="window.handleModulFileDrop(event, '${subjectId}')"
                             onclick="document.getElementById('import-file-input')?.click()"
                             class="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/20 rounded-3xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center space-y-2">
                            <div class="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-blue-600 text-xl">
                                <i class="fa-solid fa-cloud-arrow-up"></i>
                            </div>
                            <div>
                                <p class="text-xs sm:text-sm font-extrabold text-slate-800">Klik untuk pilih file atau seret & lepas dokumen ke sini</p>
                                <p class="text-[11px] text-slate-400 font-medium mt-0.5">Mendukung Microsoft Word (.docx, .doc), Dokumen PDF, & Teks (.txt)</p>
                            </div>
                        </div>

                        <!-- File Parsed Info Area -->
                        <div id="import-file-status" class="hidden p-4 bg-white shadow-sm border border-slate-200 rounded-2xl space-y-3">
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div class="flex items-center space-x-3">
                                    <div id="import-status-icon" class="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-lg shrink-0">
                                        <i class="fa-solid fa-file-lines"></i>
                                    </div>
                                    <div class="min-w-0">
                                        <h4 id="import-status-filename" class="text-xs font-bold text-slate-800 truncate">Nama File</h4>
                                        <p id="import-status-meta" class="text-[10px] text-slate-500">0 KB • 0 Kata</p>
                                    </div>
                                </div>
                                <div class="flex items-center gap-2 shrink-0">
                                    <span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-lg flex items-center gap-1">
                                        <i class="fa-solid fa-check"></i> Siap Diolah
                                    </span>
                                    <button type="button" onclick="document.getElementById('import-file-input')?.click()" class="px-2.5 py-1 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-[10px] font-bold rounded-lg transition flex items-center gap-1 cursor-pointer">
                                        <i class="fa-solid fa-rotate"></i> Ganti File
                                    </button>
                                </div>
                            </div>
                            <!-- Extracted text preview snippet -->
                            <div class="space-y-1">
                                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Pratinjau Ekstraksi Teks Naskah Dokumen:</label>
                                <div id="import-text-preview" class="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 max-h-32 overflow-y-auto font-mono whitespace-pre-wrap leading-relaxed">
                                </div>
                            </div>
                        </div>

                        <div id="import-form-target" class="hidden space-y-4 pt-2">
                            <!-- Target Configuration Form -->
                            <!-- Target Kelas / Penyimpanan Rombel (Top Priority Placement) -->
                            <div class="space-y-2 bg-blue-50/40 p-4 rounded-2xl border border-blue-200/80">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                                        <i class="fa-solid fa-folder-closed text-blue-600 text-sm"></i>
                                        <span>Pilih Penyimpanan Kelas / Target Rombel <span class="text-rose-500">*</span></span>
                                    </label>
                                    <span class="text-[10px] text-blue-600 font-semibold hidden sm:inline">Bisa memilih lebih dari satu kelas</span>
                                </div>
                                <div class="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                                    <select id="import-class-dropdown" onchange="window.addImportModulClass(this.value)" class="flex-1 px-3.5 py-2.5 bg-white border border-blue-200 rounded-xl text-xs font-bold text-slate-800 cursor-pointer focus:ring-2 focus:ring-blue-500 shadow-xs">
                                        <option value="">-- Tambah Penyimpanan Kelas --</option>
                                        <option value="ALL">Semua Kelas (Universal)</option>
                                        ${(appState.classes || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                                    </select>
                                </div>
                                <div id="import-selected-classes-container" class="flex flex-wrap gap-1.5 p-2 bg-white rounded-xl border border-slate-200 min-h-[40px] items-center">
                                </div>
                            </div>

                            <div class="space-y-1.5">
                                <label class="block text-xs font-bold uppercase text-slate-600">Topik / Materi Pokok Modul <span class="text-rose-500">*</span></label>
                                <input type="text" id="import-modul-topic" required placeholder="Misal: Termodinamika, Ikatan Kimia, Fiqih Muamalah..." class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:bg-slate-50 focus:ring-2 focus:ring-blue-500">
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                <div class="space-y-1.5">
                                    <label class="block text-xs font-bold uppercase text-slate-600">Tingkat Target</label>
                                    <select id="import-modul-tingkat" class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer">
                                        <option value="ALL" ${activeLevel === 'ALL' ? 'selected' : ''}>Semua Tingkat</option>
                                        ${uniqueTingkats.map(lvl => `<option value="${lvl}" ${activeLevel === lvl ? 'selected' : ''}>Tingkat ${lvl}</option>`).join('')}
                                    </select>
                                </div>
                                <div class="space-y-1.5">
                                    <label class="block text-xs font-bold uppercase text-slate-600">Semester</label>
                                    <select id="import-modul-semester" class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer">
                                        <option value="1" ${activeSemester === '1' ? 'selected' : ''}>Semester 1 (Ganjil)</option>
                                        <option value="2" ${activeSemester === '2' ? 'selected' : ''}>Semester 2 (Genap)</option>
                                    </select>
                                </div>
                                <div class="space-y-1.5">
                                    <label class="block text-xs font-bold uppercase text-slate-600">Model Pembelajaran</label>
                                    <select id="import-modul-model" class="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer">
                                        <option value="Deep Learning" selected>Deep Learning</option>
                                        <option value="Problem Based Learning (PBL)">Problem Based Learning (PBL)</option>
                                        <option value="Project Based Learning (PjBL)">Project Based Learning (PjBL)</option>
                                        <option value="Discovery Learning">Discovery Learning</option>
                                        <option value="Inquiry Learning">Inquiry Learning</option>
                                        <option value="Contextual Teaching and Learning">Contextual Teaching</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </form>
                </div>

                <!-- Fixed Modal Actions Footer -->
                <div class="p-5 sm:p-6 pt-4 border-t border-slate-100 bg-white rounded-b-3xl shrink-0 z-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                    <button type="button" onclick="closeModal()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition cursor-pointer text-center order-2 sm:order-1">
                        Batal
                    </button>
                    
                    <!-- Only show initially empty/hidden container until parsing succeeds -->
                    <div id="import-form-actions-btns" class="hidden flex flex-col sm:flex-row items-stretch sm:items-center gap-2 order-1 sm:order-2 w-full sm:w-auto">
                        <button type="button" id="btn-save-import-direct" onclick="window.saveImportedModulDirectly('${subjectId}', '${subjectName.replace(/'/g, "\\'")}')" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-2xl text-xs font-bold shadow transition flex items-center justify-center space-x-1.5 cursor-pointer w-full sm:w-auto">
                            <i class="fa-solid fa-floppy-disk"></i>
                            <span>Simpan Sebagai Modul Acuan</span>
                        </button>
                        <button type="button" id="btn-structure-import-ai" onclick="window.structureImportedModulWithAI('${subjectId}', '${subjectName.replace(/'/g, "\\'")}')" class="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-extrabold shadow-md hover:shadow-blue-200 transition flex items-center justify-center space-x-1.5 cursor-pointer w-full sm:w-auto">
                            <i class="fa-solid fa-wand-magic-sparkles"></i>
                            <span>Strukturkan ke 21 Komponen (AI)</span>
                        </button>
                    </div>
                </div>

            </div>
        </div>
    `;
    window.renderImportModulClassChips();
};

window.handleModulFileDrop = function(event, subjectId) {
    event.preventDefault();
    const dropzone = document.getElementById('import-dropzone');
    if (dropzone) dropzone.classList.remove('border-blue-500', 'bg-blue-50/40');
    if (event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        window.handleModulFileInput(event.dataTransfer.files, subjectId);
    }
};

window.handleModulFileInput = async function(files, subjectId) {
    if (!files || files.length === 0) return;
    const file = files[0];
    const dropzone = document.getElementById('import-dropzone');
    const statusBox = document.getElementById('import-file-status');
    const statusIcon = document.getElementById('import-status-icon');
    const statusFilename = document.getElementById('import-status-filename');
    const statusMeta = document.getElementById('import-status-meta');
    const textPreview = document.getElementById('import-text-preview');
    const topicInput = document.getElementById('import-modul-topic');
    const formTarget = document.getElementById('import-form-target');
    const formActionsBtns = document.getElementById('import-form-actions-btns');

    // Always make dropzone visible and hide statusBox while processing new file
    if (dropzone) {
        dropzone.classList.remove('hidden');
        dropzone.innerHTML = `
            <div class="py-4 space-y-2 text-center text-blue-600">
                <i class="fa-solid fa-spinner fa-spin text-2xl"></i>
                <p class="text-xs font-bold">Membaca & Mengekstrak Dokumen...</p>
                <p class="text-[10px] text-slate-400 font-medium">${escapeHtml(file.name)}</p>
            </div>
        `;
    }
    if (statusBox) {
        statusBox.classList.add('hidden');
    }
    if (formTarget) formTarget.classList.add('hidden');
    if (formActionsBtns) formActionsBtns.classList.add('hidden');

    try {
        const fileExt = file.name.split('.').pop().toLowerCase();
        let base64 = '';
        let fileContent = '';
        let extractedText = '';

        // Try client-side extraction first for immediate feedback
        if (fileExt === 'txt') {
            fileContent = await file.text();
            extractedText = fileContent;
        } else if ((fileExt === 'docx' || fileExt === 'doc') && window.mammoth) {
            try {
                const arrayBuffer = await file.arrayBuffer();
                const textRes = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
                if (textRes && textRes.value && textRes.value.trim().length > 0) {
                    extractedText = textRes.value.trim();
                }
            } catch (mErr) {
                console.warn('Client-side Mammoth extraction warning:', mErr);
            }
        }

        // Read base64 for API call
        if (fileExt !== 'txt') {
            const reader = new FileReader();
            base64 = await new Promise((resolve, reject) => {
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
        }

        // Send to server API for enhanced/AI extraction
        try {
            const res = await fetch('/api/modul/parse-document', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fileName: file.name,
                    fileType: fileExt,
                    fileBase64: base64,
                    base64: base64,
                    textContent: fileContent || extractedText,
                    content: fileContent || extractedText
                })
            });

            const data = await res.json();
            if (res.ok && data.success && (data.extractedText || data.text)) {
                extractedText = data.extractedText || data.text;
            }
        } catch (apiErr) {
            console.warn('API document parse warning, using local extraction if available:', apiErr);
        }

        if (!extractedText || extractedText.trim().length === 0) {
            extractedText = `Dokumen ${file.name} terimpor. Berisi materi pembelajaran terstruktur.`;
        }

        const wordCount = extractedText.trim().split(/\s+/).length;

        window.currentImportedDocData = {
            fileName: file.name,
            fileType: fileExt,
            fileSize: file.size,
            text: extractedText,
            wordCount: wordCount
        };

        // Update UI
        if (dropzone) {
            dropzone.classList.add('hidden');
        }
        if (statusBox) {
            statusBox.classList.remove('hidden');
        }
        if (formTarget) formTarget.classList.remove('hidden');
        if (formActionsBtns) formActionsBtns.classList.remove('hidden');
        if (statusFilename) {
            statusFilename.textContent = file.name;
        }
        if (statusMeta) {
            const kb = (file.size / 1024).toFixed(1);
            statusMeta.textContent = `${kb} KB • ${wordCount.toLocaleString('id-ID')} Kata • ${extractedText.length.toLocaleString('id-ID')} Karakter`;
        }
        if (textPreview) {
            textPreview.textContent = extractedText.substring(0, 2000) + (extractedText.length > 2000 ? '\n\n... (sebagian teks dipotong untuk pratinjau ringkas)' : '');
        }

        // Auto clean topic from filename if empty
        if (topicInput && (!topicInput.value || topicInput.value.trim() === '')) {
            const cleanTopic = file.name
                .replace(/\.(docx|doc|pdf|txt)$/i, '')
                .replace(/modul\s*ajar\s*/gi, '')
                .replace(/rpp\s*/gi, '')
                .replace(/[_,-]+/g, ' ')
                .trim();
            topicInput.value = cleanTopic.charAt(0).toUpperCase() + cleanTopic.slice(1);
        }

        if (statusIcon) {
            if (fileExt === 'pdf') {
                statusIcon.className = 'w-10 h-10 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg';
                statusIcon.innerHTML = '<i class="fa-solid fa-file-pdf"></i>';
            } else if (fileExt === 'docx' || fileExt === 'doc') {
                statusIcon.className = 'w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-lg';
                statusIcon.innerHTML = '<i class="fa-solid fa-file-word"></i>';
            } else {
                statusIcon.className = 'w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center text-lg';
                statusIcon.innerHTML = '<i class="fa-solid fa-file-lines"></i>';
            }
        }

        showToast('Dokumen berhasil diekstrak dan siap diolah!', 'success');
    } catch(err) {
        showToast(err.message || 'Gagal membaca dokumen', 'error');
        if (dropzone) {
            dropzone.classList.remove('hidden');
            dropzone.innerHTML = `
                <div class="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 shadow-xs flex items-center justify-center text-rose-600 text-xl">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <div>
                    <p class="text-xs sm:text-sm font-extrabold text-rose-600">Gagal membaca dokumen. Klik untuk coba lagi.</p>
                    <p class="text-[11px] text-slate-400 font-medium mt-0.5">${escapeHtml(err.message || '')}</p>
                </div>
            `;
        }
    }
};

// Helper to parse and structure imported document text into 21 components
function parseAndStructureImportedDocumentText(docText, subjectName, topic, gradeDisplay, semester, model, fileName, fileType) {
    const cleanText = (docText || '').trim();

    // Helper regex to extract section between headers
    function extractSection(text, headerRegex, nextHeadersRegex) {
        const match = text.match(headerRegex);
        if (!match) return null;
        const startIndex = match.index + match[0].length;
        let restText = text.substring(startIndex);
        if (nextHeadersRegex) {
            const nextMatch = restText.match(nextHeadersRegex);
            if (nextMatch) {
                restText = restText.substring(0, nextMatch.index);
            }
        }
        return restText.trim();
    }

    const hasStructuredHeaders = /(INFORMASI\s*UMUM|IDENTITAS\s*MODUL|TUJUAN\s*PEMBELAJARAN|KEGIATAN\s*PEMBELAJARAN|LANGKAH\s*PEMBELAJARAN|ASESMEN|PENILAIAN|LEMBAR\s*KERJA|LKPD)/i.test(cleanText);

    let identitas = '';
    let kompetensiAwal = '';
    let profilPancasila = '';
    let sarana = '';
    let targetPeserta = '';
    let modelPembelajaran = model || 'Deep Learning';
    let tujuan = '';
    let pemahamanBermakna = '';
    let pertanyaanPemantik = '';
    let kegiatan = '';
    let asesmen = '';
    let pengayaanRemedial = '';
    let lkpd = '';
    let lembarKerja = '';
    let bahanAjar = '';
    let glosarium = '';
    let daftarPustaka = '';

    if (hasStructuredHeaders) {
        identitas = extractSection(cleanText, /(INFORMASI\s*UMUM|IDENTITAS\s*MODUL)[:\n]/i, /(KOMPETENSI\s*AWAL|PROFIL\s*PELAJAR|SARANA|TUJUAN)/i) || '';
        kompetensiAwal = extractSection(cleanText, /KOMPETENSI\s*AWAL[:\n]/i, /(PROFIL\s*PELAJAR|SARANA|TARGET|MODEL|TUJUAN)/i) || '';
        profilPancasila = extractSection(cleanText, /PROFIL\s*PELAJAR\s*PANCASILA[:\n]/i, /(SARANA|TARGET|MODEL|TUJUAN)/i) || '';
        sarana = extractSection(cleanText, /SARANA\s*(DAN|&)?\s*PRASARANA[:\n]/i, /(TARGET|MODEL|TUJUAN)/i) || '';
        targetPeserta = extractSection(cleanText, /TARGET\s*PESERTA\s*DIDIK[:\n]/i, /(MODEL|TUJUAN)/i) || '';
        modelPembelajaran = extractSection(cleanText, /MODEL\s*(DAN\s*METODE\s*)?PEMBELAJARAN[:\n]/i, /TUJUAN/i) || modelPembelajaran;
        tujuan = extractSection(cleanText, /(TUJUAN\s*PEMBELAJARAN|CAPAIAN\s*PEMBELAJARAN)[:\n]/i, /(PEMAHAMAN\s*BERMAKNA|PERTANYAAN\s*PEMANTIK|KEGIATAN|LANGKAH)/i) || '';
        pemahamanBermakna = extractSection(cleanText, /PEMAHAMAN\s*BERMAKNA[:\n]/i, /(PERTANYAAN\s*PEMANTIK|KEGIATAN|LANGKAH)/i) || '';
        pertanyaanPemantik = extractSection(cleanText, /PERTANYAAN\s*PEMANTIK[:\n]/i, /(KEGIATAN\s*PEMBELAJARAN|LANGKAH\s*PEMBELAJARAN)/i) || '';
        kegiatan = extractSection(cleanText, /(KEGIATAN\s*PEMBELAJARAN|LANGKAH-LANGKAH\s*PEMBELAJARAN|LANGKAH\s*PEMBELAJARAN)[:\n]/i, /(ASESMEN|PENILAIAN|PENGAYAAN|LKPD|LEMBAR\s*KERJA)/i) || '';
        asesmen = extractSection(cleanText, /(ASESMEN|PENILAIAN)[:\n]/i, /(PENGAYAAN|REMEDIAL|LKPD|LEMBAR\s*KERJA|GLOSARIUM)/i) || '';
        pengayaanRemedial = extractSection(cleanText, /(PENGAYAAN\s*(DAN|&)?\s*REMEDIAL)[:\n]/i, /(LKPD|LEMBAR\s*KERJA|BAHAN\s*AJAR|GLOSARIUM)/i) || '';
        lkpd = extractSection(cleanText, /(LEMBAR\s*KERJA\s*PESERTA\s*DIDIK|LKPD)[:\n]/i, /(BAHAN\s*AJAR|MATERI\s*AJAR|GLOSARIUM|DAFTAR\s*PUSTAKA)/i) || '';
        bahanAjar = extractSection(cleanText, /(BAHAN\s*AJAR|MATERI\s*AJAR|RINGKASAN\s*MATERI)[:\n]/i, /(GLOSARIUM|DAFTAR\s*PUSTAKA)/i) || '';
        glosarium = extractSection(cleanText, /GLOSARIUM[:\n]/i, /DAFTAR\s*PUSTAKA/i) || '';
        daftarPustaka = extractSection(cleanText, /DAFTAR\s*PUSTAKA[:\n]/i) || '';
    }

    if (!bahanAjar) bahanAjar = cleanText;
    if (!lembarKerja) lembarKerja = `**BAHAN BACAAN & URAIAN DOKUMEN IMPOR**\n\n${cleanText}`;

    if (!identitas) {
        identitas = `Penyusun: Tim Guru ${subjectName}\nInstansi: ${typeof getSchoolName === 'function' ? getSchoolName() : 'Madrasah / Sekolah'}\nTahun: ${new Date().getFullYear()}\nJenjang/Kelas: ${gradeDisplay}\nSemester: ${semester}\nAlokasi Waktu: 4 JP (2 Pertemuan)\nTopik: ${topic}`;
    }
    if (!kompetensiAwal) {
        kompetensiAwal = `Peserta didik telah memahami konsep dasar materi prasyarat sebelum mempelajari topik ${topic}.`;
    }
    if (!profilPancasila) {
        profilPancasila = `1. Bernalar Kritis: Menganalisis dan menelaah naskah materi ${topic}.\n2. Mandiri: Mengembangkan pemahaman belajar mandiri.\n3. Bergotong Royong: Berdiskusi dalam kelompok menelaah materi.\n4. Kreatif: Menyusun ringkasan dan gagasan dari materi ${topic}.`;
    }
    if (!sarana) {
        sarana = `Dokumen Bahan Ajar "${fileName || topic}", Laptop/PC, Proyektor, Papan Tulis, LKPD.`;
    }
    if (!targetPeserta) {
        targetPeserta = `Peserta Didik Reguler / Tipikal (Kapasitas Umum dengan Diferensiasi Pembelajaran).`;
    }
    if (!tujuan) {
        tujuan = `Setelah menelaah dan mempelajari naskah dokumen "${topic}", peserta didik mampu:\n1. Mengidentifikasi dan memahami fakta/konsep utama pada materi ${topic}.\n2. Menganalisis poin-poin penting serta penerapan materi ${topic} dalam diskusi kelompok dan latihan soal.\n3. Menyusun ringkasan dan merefleksikan pemahaman materi ${topic} secara kritis.`;
    }
    if (!pemahamanBermakna) {
        pemahamanBermakna = `Memahami materi ${topic} membantu peserta didik berpikir kritis dan menerapkan pengetahuan ini dalam kehidupan sehari-hari maupun studi lanjut.`;
    }
    if (!pertanyaanPemantik) {
        pertanyaanPemantik = `1. Apa hal menarik atau ide utama yang Anda temukan saat membaca materi ${topic}?\n2. Mengapa topik ${topic} ini penting untuk dipelajari dan dipahami?\n3. Bagaimana penerapan konsep materi ini dalam kehidupan sehari-hari?`;
    }
    if (!kegiatan) {
        kegiatan = `PERTEMUAN 1 & 2 (4 JP):\n\n1. Pendahuluan (15 Menit):\n- Guru membuka kelas dengan salam, berdoa, dan mengecek kehadiran.\n- Guru menyampaikan tujuan pembelajaran berbasis naskah dokumen "${topic}".\n- Apersepsi dan pertanyaan pemantik untuk menggugah minat siswa.\n\n2. Kegiatan Inti (90 Menit):\n- Mengamati & Membaca: Peserta didik membaca dan menelaah naskah materi "${topic}" secara cermat.\n- Menanya & Menalar: Peserta didik mencatat istilah-istilah penting, fakta, dan gagasan utama dari bacaan.\n- Diskusi Kelompok: Peserta didik berdiskusi kelompok mengerjakan soal analisis pada Lembar Kerja Peserta Didik (LKPD).\n- Presentasi: Setiap kelompok mempresentasikan hasil penelaahan materi ${topic} di depan kelas.\n\n3. Penutup (15 Menit):\n- Guru bersama peserta didik membuat kesimpulan akhir berdasarkan naskah materi.\n- Guru memberikan umpan balik, apresiasi, dan melakukan refleksi bersama.\n- Penutupan dan doa bersama.`;
    }
    if (!asesmen) {
        asesmen = `1. Asesmen Diagnostik (Sebelum Pembelajaran):\n- Pertanyaan pemantik dan tes diagnostik singkat tentang ${topic}.\n\n2. Asesmen Formatif (Selama Pembelajaran):\n- Observasi keaktifan diskusi kelompok saat menelaah naskah dokumen ${topic}.\n- Penilaian LKPD dan presentasi kelompok.\n\n3. Asesmen Sumatif (Akhir Pembelajaran):\n- Tes tertulis / penugasan pemahaman materi ${topic}.`;
    }
    if (!pengayaanRemedial) {
        pengayaanRemedial = `PENGAYAAN:\nBagi peserta didik yang telah menguasai materi ${topic}, diberikan tugas membaca literatur lanjutan dan membuat peta konsep terpadu.\n\nREMEDIAL:\nBagi peserta didik yang memerlukan bimbingan, diberikan pemahaman ulang pada bagian materi ${topic} yang belum dipahami serta latihan soal terbimbing.`;
    }
    if (!lkpd) {
        lkpd = `LEMBAR KERJA PESERTA DIDIK (LKPD)\nMata Pelajaran: ${subjectName}\nTopik/Materi: ${topic}\n\nPetunjuk Pengerjaan:\nBacalah naskah dokumen "${topic}" yang telah disediakan, lalu selesaikan tugas berikut:\n\n1. Analisis & Ringkasan:\nTuliskan 3 gagasan atau fakta utama yang dibahas dalam naskah materi ${topic}!\n\n2. Diskusi & Pemahaman:\nJelaskan istilah-istilah atau konsep penting yang terdapat pada bacaan tersebut!\n\n3. Studi Kasus / Penerapan:\nBagaimana relevansi atau penerapan materi ini dalam konteks kehidupan nyata?\n\n4. Kesimpulan:\nBuatlah rangkuman singkat (3-5 kalimat) mengenai isi keseluruhan materi ${topic}!`;
    }
    if (!glosarium) {
        glosarium = `Glosarium dan istilah-istilah penting yang terdapat pada naskah dokumen ${topic}.`;
    }
    if (!daftarPustaka) {
        daftarPustaka = `Dokumen Acuan Impor: ${fileName || topic} (${(fileType || 'doc').toUpperCase()})`;
    }

    return {
        identitasModul: identitas,
        kompetensiAwal: kompetensiAwal,
        profilPancasila: profilPancasila,
        saranaPrasarana: sarana,
        targetPeserta: targetPeserta,
        modelPembelajaran: modelPembelajaran,
        tujuanPembelajaran: tujuan,
        pemahamanBermakna: pemahamanBermakna,
        pertanyaanPemantik: pertanyaanPemantik,
        persiapanPembelajaran: `1. Menyiapkan dan mencetak naskah dokumen materi "${topic}".\n2. Menyiapkan media pembelajaran, LKPD, dan lembar penilaian.`,
        kegiatanPembelajaran: kegiatan,
        asesmen: asesmen,
        pengayaanRemedial: pengayaanRemedial,
        lkpd: lkpd,
        lembarKerja: lembarKerja,
        bahanAjar: bahanAjar,
        materiAjar: bahanAjar,
        materiDetail: cleanText,
        glosarium: glosarium,
        daftarPustaka: daftarPustaka
    };
}

window.saveImportedModulDirectly = async function(subjectId, subjectName) {
    const docData = window.currentImportedDocData;
    if (!docData || !docData.text) {
        showToast('Silakan pilih dan upload file dokumen terlebih dahulu!', 'error');
        return;
    }

    const topic = document.getElementById('import-modul-topic')?.value?.trim() || docData.fileName;
    const selectedTingkat = document.getElementById('import-modul-tingkat')?.value || 'ALL';
    const semester = document.getElementById('import-modul-semester')?.value || '1';
    const model = document.getElementById('import-modul-model')?.value || 'Deep Learning';
    const selectedClasses = (tempImportModulClasses && tempImportModulClasses.length > 0) ? [...tempImportModulClasses] : [selectedTingkat];
    const gradeDisplay = selectedClasses.includes('ALL') ? (selectedTingkat === 'ALL' ? 'Semua Tingkat' : 'Tingkat ' + selectedTingkat) : selectedClasses.join(', ');

    const btn = document.getElementById('btn-save-import-direct');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menyimpan...</span>';
    }

    const parsedData = parseAndStructureImportedDocumentText(
        docData.text,
        subjectName,
        topic,
        gradeDisplay,
        semester,
        model,
        docData.fileName,
        docData.fileType
    );

    const newModul = {
        id: 'imp_' + Date.now(),
        subjectId: subjectId,
        title: `Modul ${subjectName}: ${topic}`,
        topic: topic,
        grade: selectedTingkat,
        semester: semester,
        classes: selectedClasses,
        targetClasses: selectedClasses,
        isImported: true,
        sourceFileName: docData.fileName,
        sourceType: docData.fileType,
        extractedContent: docData.text,
        ...parsedData,
        createdAt: new Date().toISOString()
    };

    if (!appState.lessonPlans) appState.lessonPlans = [];
    appState.lessonPlans.push(newModul);

    try {
        await fetch('/api/lesson-plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newModul)
        });
        showToast(`Modul "${topic}" berhasil diimpor dan disimpan dengan materi aktual dokumen!`, 'success');
        closeModal();
        if (typeof renderModulAjarModule === 'function') {
            renderModulAjarModule(document.getElementById('view-container'));
        }
    } catch(e) {
        showToast('Modul tersimpan secara lokal di aplikasi.', 'info');
        closeModal();
        if (typeof renderModulAjarModule === 'function') {
            renderModulAjarModule(document.getElementById('view-container'));
        }
    }
};

// Direct Import & Archive for Mode 2 (Finished Documents, Multi-file Support & Grouping)
window.triggerDirectImportFileSelect = function(e) {
    if (e && typeof e.stopPropagation === 'function') {
        e.stopPropagation();
    }
    const input = document.getElementById('direct-import-file-input');
    if (input) {
        input.click();
    }
};

window.toggleDirectImportGroupCustomInput = function(selectEl) {
    const container = document.getElementById('direct-import-new-group-container');
    if (!container) return;
    if (selectEl.value === '__NEW__') {
        container.classList.remove('hidden');
        document.getElementById('direct-import-new-group-name')?.focus();
    } else {
        container.classList.add('hidden');
    }
};

window.openAddImportGroupModal = function(subjectId) {
    const subject = appState.subjects ? appState.subjects.find(s => String(s.id) === String(subjectId)) : null;
    const subjectName = subject ? subject.name : 'Mata Pelajaran';

    const modal = document.getElementById('modal-container');
    if (!modal) return;
    modal.classList.remove('hidden');

    document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5" onclick="event.stopPropagation()">
                <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div class="flex items-center space-x-3 text-indigo-600">
                        <div class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                            <i class="fa-solid fa-folder-plus"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-800 text-base sm:text-lg">Tambah Kelompok Modul</h3>
                            <p class="text-xs text-slate-400 font-medium">${escapeHtml(subjectName)}</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <form onsubmit="window.saveImportGroup(event, '${subjectId}')" class="space-y-4">
                    <div class="space-y-1.5">
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-500">Nama Kelompok / Folder <span class="text-rose-500">*</span></label>
                        <input type="text" id="group-name-input" required placeholder="Contoh: Bab 1 - Al-Qur'an, Modul Semester Ganjil, dst." class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>

                    <div class="space-y-1.5">
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-500">Deskripsi / Catatan Kelompok (Opsional)</label>
                        <textarea id="group-desc-input" rows="2" placeholder="Catatan ringkas mengenai cakupan dokumen dalam kelompok ini..." class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" style="resize:none;"></textarea>
                    </div>

                    <div class="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                        <button type="button" onclick="closeModal()" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer">
                            Batal
                        </button>
                        <button type="submit" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-1.5 cursor-pointer">
                            <i class="fa-solid fa-floppy-disk"></i>
                            <span>Simpan Kelompok</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
};

window.saveImportGroup = async function(event, subjectId) {
    if (event) event.preventDefault();
    const nameInput = document.getElementById('group-name-input');
    const descInput = document.getElementById('group-desc-input');
    const name = nameInput?.value?.trim();
    const desc = descInput?.value?.trim() || '';

    if (!name) {
        showToast('Nama kelompok tidak boleh kosong!', 'error');
        return;
    }

    if (!appState.importGroups) appState.importGroups = [];

    const subjectObj = (appState.subjects || []).find(s => isSameSubject(s.id, subjectId, appState.subjects));
    const canonicalSubId = subjectObj ? subjectObj.id : subjectId;

    const newGroup = {
        id: 'grp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
        subjectId: canonicalSubId,
        name: name,
        description: desc,
        createdAt: new Date().toISOString()
    };

    appState.importGroups.push(newGroup);
    appState._importGroupsLoaded = true;

    try {
        await fetch('/api/import-groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newGroup)
        });
    } catch(e) {
        console.warn('Gagal sync ke API import-groups:', e);
    }

    showToast(`Kelompok "${name}" berhasil dibuat!`, 'success');
    closeModal();
    if (typeof renderModulAjarModule === 'function') {
        renderModulAjarModule(document.getElementById('view-container'));
    }
};

window.openEditImportGroupModal = function(groupId, subjectId) {
    if (!appState.importGroups) return;
    const group = appState.importGroups.find(g => String(g.id) === String(groupId));
    if (!group) return;

    const modal = document.getElementById('modal-container');
    if (!modal) return;
    modal.classList.remove('hidden');

    document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5" onclick="event.stopPropagation()">
                <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div class="flex items-center space-x-3 text-indigo-600">
                        <div class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-lg">
                            <i class="fa-solid fa-pen-to-square"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-800 text-base sm:text-lg">Edit Kelompok Modul</h3>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <form onsubmit="window.updateImportGroup(event, '${groupId}', '${subjectId}')" class="space-y-4">
                    <div class="space-y-1.5">
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-500">Nama Kelompok / Folder <span class="text-rose-500">*</span></label>
                        <input type="text" id="edit-group-name-input" required value="${escapeHtml(group.name)}" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    </div>

                    <div class="space-y-1.5">
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-500">Deskripsi / Catatan Kelompok (Opsional)</label>
                        <textarea id="edit-group-desc-input" rows="2" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500" style="resize:none;">${escapeHtml(group.description || '')}</textarea>
                    </div>

                    <div class="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                        <button type="button" onclick="closeModal()" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer">
                            Batal
                        </button>
                        <button type="submit" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-1.5 cursor-pointer">
                            <i class="fa-solid fa-floppy-disk"></i>
                            <span>Simpan Perubahan</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
};

window.updateImportGroup = async function(event, groupId, subjectId) {
    if (event) event.preventDefault();
    const name = document.getElementById('edit-group-name-input')?.value?.trim();
    const desc = document.getElementById('edit-group-desc-input')?.value?.trim() || '';

    if (!name) {
        showToast('Nama kelompok tidak boleh kosong!', 'error');
        return;
    }

    if (appState.importGroups) {
        const group = appState.importGroups.find(g => String(g.id) === String(groupId));
        if (group) {
            group.name = name;
            group.description = desc;
            appState._importGroupsLoaded = true;
            try {
                await fetch('/api/import-groups', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(group)
                });
            } catch(e) {}
        }
    }

    showToast('Kelompok berhasil diperbarui!', 'success');
    closeModal();
    if (typeof renderModulAjarModule === 'function') {
        renderModulAjarModule(document.getElementById('view-container'));
    }
};

window.deleteImportGroup = async function(groupId, subjectId) {
    if (!confirm('Apakah Anda yakin ingin menghapus kelompok ini? File modul di dalamnya tidak akan dihapus, melainkan dipindahkan ke Modul Umum.')) {
        return;
    }

    if (appState.importGroups) {
        appState.importGroups = appState.importGroups.filter(g => String(g.id) !== String(groupId));
        appState._importGroupsLoaded = true;
        try {
            await fetch(`/api/import-groups/${groupId}`, {
                method: 'DELETE'
            });
        } catch(e) {}
    }

    if (appState.lessonPlans) {
        appState.lessonPlans.forEach(lp => {
            if (String(lp.groupId) === String(groupId)) {
                lp.groupId = '';
                try {
                    fetch('/api/lesson-plans', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(lp)
                    });
                } catch(e) {}
            }
        });
    }

    showToast('Kelompok dihapus. File modul telah dipindahkan ke Modul Umum.', 'info');
    if (typeof renderModulAjarModule === 'function') {
        renderModulAjarModule(document.getElementById('view-container'));
    }
};

window.openDirectImportModulModal = function(subjectId, preselectedGroupId = '') {
    window.currentImportedDocData = null;
    window.currentImportedDocsList = [];
    const subject = appState.subjects ? appState.subjects.find(s => isSameSubject(s.id, subjectId, appState.subjects)) : null;
    const subjectName = subject ? subject.name : 'Mata Pelajaran';
    const canonicalSubId = subject ? subject.id : subjectId;

    if (!appState._importGroupsLoaded && typeof window.loadImportGroupsFromServer === 'function') {
        window.loadImportGroupsFromServer().then(() => window.openDirectImportModulModal(subjectId, preselectedGroupId));
        return;
    }
    const subjectGroups = (appState.importGroups || []).filter(g => isSameSubject(g.subjectId, canonicalSubId, appState.subjects));

    const modal = document.getElementById('modal-container');
    if (!modal) return;
    modal.classList.remove('hidden');

    document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <input type="file" id="direct-import-file-input" accept=".docx,.doc,.pdf,.txt" multiple class="hidden" onchange="window.handleDirectModulFileInput(this.files, '${subjectId}', '${subjectName.replace(/'/g, "\\'")}'); this.value = '';">

            <div class="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5" onclick="event.stopPropagation()">
                <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div class="flex items-center space-x-3 text-blue-600">
                        <div class="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                            <i class="fa-solid fa-file-arrow-up"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-800 text-base sm:text-lg">Arsip & Simpan Modul Jadi</h3>
                            <p class="text-xs text-slate-400 font-medium">${escapeHtml(subjectName)}</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <div class="space-y-4">
                    <!-- Kelompok Selection -->
                    <div class="p-3.5 bg-indigo-50/60 border border-indigo-100 rounded-2xl space-y-2">
                        <div class="flex items-center justify-between">
                            <label class="block text-xs font-bold uppercase tracking-wider text-indigo-900">Kelompok Tempat Import</label>
                            <button type="button" onclick="openAddImportGroupModal('${subjectId}')" class="text-[11px] text-indigo-700 hover:text-indigo-900 font-bold underline flex items-center space-x-1 cursor-pointer">
                                <i class="fa-solid fa-plus text-[9px]"></i>
                                <span>Tambah Kelompok Baru</span>
                            </button>
                        </div>
                        <select id="direct-import-group-select" onchange="window.toggleDirectImportGroupCustomInput(this)" class="w-full px-3.5 py-2.5 bg-white border border-indigo-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
                            <option value="">-- Modul Umum / Tanpa Kelompok --</option>
                            ${subjectGroups.map(g => `<option value="${g.id}" ${String(g.id) === String(preselectedGroupId) ? 'selected' : ''}>📁 ${escapeHtml(g.name)}</option>`).join('')}
                            <option value="__NEW__">➕ + Buat Kelompok Baru...</option>
                        </select>
                        <div id="direct-import-new-group-container" class="hidden pt-1 space-y-1">
                            <input type="text" id="direct-import-new-group-name" placeholder="Ketik Nama Kelompok Baru (misal: Bab 1 - AI Dasar)..." class="w-full px-3.5 py-2 bg-white border border-indigo-300 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>
                    </div>

                    <p class="text-xs text-slate-600 leading-relaxed">
                        Pilih satu atau beberapa dokumen Word (.docx), PDF, atau Teks (.txt) modul ajar yang sudah jadi sekaligus. Semua dokumen akan langsung disimpan ke kelompok yang dipilih.
                    </p>

                    <!-- Dropzone Area -->
                    <div id="direct-import-dropzone"
                         onclick="window.triggerDirectImportFileSelect(event)"
                         ondragover="event.preventDefault(); this.classList.add('border-blue-500', 'bg-blue-50/40');"
                         ondragleave="this.classList.remove('border-blue-500', 'bg-blue-50/40');"
                         ondrop="event.preventDefault(); this.classList.remove('border-blue-500', 'bg-blue-50/40'); if(event.dataTransfer && event.dataTransfer.files) window.handleDirectModulFileInput(event.dataTransfer.files, '${subjectId}', '${subjectName.replace(/'/g, "\\'")}');"
                         class="border-2 border-dashed border-slate-300 hover:border-blue-500 bg-slate-50/50 hover:bg-blue-50/20 rounded-3xl p-6 text-center cursor-pointer transition space-y-3">
                        
                        <div class="w-12 h-12 rounded-2xl bg-white border border-slate-200 shadow-xs flex items-center justify-center text-blue-600 text-xl mx-auto pointer-events-none">
                            <i class="fa-solid fa-cloud-arrow-up"></i>
                        </div>
                        <div class="pointer-events-none">
                            <p class="text-xs sm:text-sm font-extrabold text-slate-800">Klik atau Seret Berkas ke Sini (Bisa Pilih Banyak File)</p>
                            <p class="text-[11px] text-slate-400 font-medium mt-0.5">Mendukung Word (.docx), PDF, & TXT sekaligus</p>
                        </div>
                        <div class="pt-1">
                            <button type="button" onclick="window.triggerDirectImportFileSelect(event)" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold inline-flex items-center space-x-1.5 shadow-sm transition cursor-pointer">
                                <i class="fa-solid fa-folder-open"></i>
                                <span>Pilih Berkas dari Laptop</span>
                            </button>
                        </div>
                    </div>

                    <!-- File List Status Container -->
                    <div id="direct-import-status" class="hidden p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-2">
                    </div>
                </div>

                <div class="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer">
                        Batal
                    </button>
                    <button type="button" id="btn-save-direct-import" onclick="window.confirmDirectImportSave('${subjectId}', '${subjectName.replace(/'/g, "\\'")}')" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow transition flex items-center space-x-1.5 cursor-pointer hidden">
                        <i class="fa-solid fa-floppy-disk"></i>
                        <span>Simpan ke Arsip Modul</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    // Automatically trigger native file explorer dialog immediately
    window.triggerDirectImportFileSelect();
};

window.renderDirectImportFileList = function(subjectId, subjectName) {
    const statusBox = document.getElementById('direct-import-status');
    const saveBtn = document.getElementById('btn-save-direct-import');
    const dropzone = document.getElementById('direct-import-dropzone');
    if (!statusBox) return;

    const list = window.currentImportedDocsList || [];
    if (list.length === 0) {
        statusBox.classList.add('hidden');
        if (saveBtn) saveBtn.classList.add('hidden');
        if (dropzone) dropzone.classList.remove('hidden');
        return;
    }

    if (dropzone) dropzone.classList.add('hidden');
    statusBox.classList.remove('hidden');
    if (saveBtn) {
        saveBtn.classList.remove('hidden');
        saveBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i><span>Simpan ${list.length} Modul ke Arsip</span>`;
    }

    statusBox.innerHTML = `
        <!-- TOP ACTIONS BAR (Replacing dropzone area right at the top) -->
        <div class="p-3.5 bg-slate-900 text-white rounded-2xl shadow-md space-y-2.5">
            <div class="flex items-center justify-between text-xs font-extrabold">
                <span class="flex items-center space-x-1.5 text-emerald-400">
                    <i class="fa-solid fa-circle-check"></i>
                    <span>${list.length} Berkas Modul Siap Disimpan</span>
                </span>
                <span class="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-lg border border-slate-700 font-medium">Aksi Utama</span>
            </div>
            
            <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                <button type="button" id="btn-save-direct-import-top" onclick="window.confirmDirectImportSave('${subjectId}', '${subjectName.replace(/'/g, "\\'")}')" class="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-extrabold shadow-md transition flex items-center justify-center space-x-2 cursor-pointer">
                    <i class="fa-solid fa-floppy-disk"></i>
                    <span>Simpan (${list.length} Modul) ke Arsip</span>
                </button>
                <button type="button" onclick="closeModal()" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold transition cursor-pointer text-center">
                    Batal
                </button>
                <button type="button" onclick="window.triggerDirectImportFileSelect(event)" class="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-blue-300 border border-slate-700 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1 shrink-0 cursor-pointer">
                    <i class="fa-solid fa-plus text-xs"></i>
                    <span>+ Tambah Berkas</span>
                </button>
            </div>
        </div>

        <!-- LIST OF SELECTED FILES -->
        <div class="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-2">
            <div class="flex items-center justify-between pb-2 border-b border-emerald-200/70 text-emerald-900 font-extrabold text-xs">
                <span class="flex items-center space-x-1.5">
                    <i class="fa-solid fa-folder-closed text-emerald-600"></i>
                    <span>Daftar Berkas Terpilih</span>
                </span>
                <span class="text-[10px] bg-emerald-200 text-emerald-900 px-2.5 py-0.5 rounded-lg font-bold">${list.length} Dokumen</span>
            </div>
            <div class="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                ${list.map((doc, idx) => `
                    <div class="flex items-center justify-between p-2.5 bg-white border border-emerald-100 rounded-xl shadow-2xs text-xs">
                        <div class="flex items-center space-x-2.5 min-w-0 pr-2">
                            <div class="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0 font-bold text-xs">
                                <i class="${doc.fileType === 'pdf' ? 'fa-solid fa-file-pdf text-rose-500' : (doc.fileType === 'txt' ? 'fa-solid fa-file-lines text-slate-500' : 'fa-solid fa-file-word text-blue-600')}"></i>
                            </div>
                            <div class="truncate">
                                <p class="font-bold text-slate-800 truncate">${escapeHtml(doc.fileName)}</p>
                                <p class="text-[10px] text-slate-400 font-medium">${(doc.fileSize / 1024).toFixed(1)} KB • ${doc.fileType.toUpperCase()}</p>
                            </div>
                        </div>
                        <button type="button" onclick="window.removeDirectImportFile(${idx}, '${subjectId}', '${subjectName.replace(/'/g, "\\'")}')" class="w-6 h-6 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center shrink-0 transition cursor-pointer" title="Hapus dari daftar">
                            <i class="fa-solid fa-xmark text-xs"></i>
                        </button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
};

window.removeDirectImportFile = function(index, subjectId, subjectName) {
    if (window.currentImportedDocsList && window.currentImportedDocsList[index]) {
        window.currentImportedDocsList.splice(index, 1);
    }
    if (window.currentImportedDocsList.length > 0) {
        window.currentImportedDocData = window.currentImportedDocsList[0];
    } else {
        window.currentImportedDocData = null;
    }
    window.renderDirectImportFileList(subjectId, subjectName);
};

async function parseSingleFileForImport(file) {
    const fileExt = file.name.split('.').pop().toLowerCase();

    // Preserve original binary file in Base64 for 100% exact loss-less download
    const sourceBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = err => reject(err);
        reader.readAsDataURL(file);
    });

    let extractedText = '';
    let htmlResult = '';

    if (fileExt === 'txt') {
        extractedText = await file.text();
        htmlResult = '<div class="space-y-3">' + extractedText.split(/\n\n+/).map(p => `<p class="leading-relaxed">${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('') + '</div>';
    } else if ((fileExt === 'docx' || fileExt === 'doc') && window.mammoth) {
        try {
            const arrayBuffer = await file.arrayBuffer();

            // Convert Word to rich HTML preserving tables, headings, lists, bold, italic, images
            const convRes = await window.mammoth.convertToHtml({ arrayBuffer: arrayBuffer });
            if (convRes && convRes.value) {
                htmlResult = convRes.value;
            }

            const textRes = await window.mammoth.extractRawText({ arrayBuffer: arrayBuffer });
            if (textRes && textRes.value) {
                extractedText = textRes.value.trim();
            }
        } catch(e) {
            console.warn('Mammoth import warning:', e);
        }
    } else if (fileExt === 'pdf' && window.pdfjsLib) {
        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let fullPdfText = '';
            let pagesHtml = [];
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const pageStrings = content.items.map(item => item.str);
                const pageText = pageStrings.join(' ');
                fullPdfText += pageText + '\n\n';
                pagesHtml.push(`<div class="mb-6 pb-4 border-b border-slate-100"><span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Halaman ${i}</span><div class="leading-relaxed whitespace-pre-wrap">${escapeHtml(pageText)}</div></div>`);
            }
            if (fullPdfText.trim()) extractedText = fullPdfText.trim();
            htmlResult = pagesHtml.join('');
        } catch(pErr) {
            console.warn('PDF import warning:', pErr);
        }
    }

    if (!extractedText && !htmlResult) {
        extractedText = `Dokumen ${file.name} tersimpan di arsip sebagai modul siap pakai.`;
        htmlResult = `<p>${escapeHtml(extractedText)}</p>`;
    }

    return {
        fileName: file.name,
        fileType: fileExt,
        fileSize: file.size,
        text: extractedText,
        htmlContent: htmlResult || `<div class="whitespace-pre-wrap">${escapeHtml(extractedText)}</div>`,
        sourceBase64: sourceBase64
    };
}

window.handleDirectModulFileInput = async function(files, subjectId, subjectName) {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    if (!window.currentImportedDocsList) {
        window.currentImportedDocsList = [];
    }

    const statusBox = document.getElementById('direct-import-status');
    if (statusBox) {
        statusBox.classList.remove('hidden');
        statusBox.innerHTML = `
            <div class="flex items-center space-x-3 p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-800 text-xs font-bold">
                <i class="fa-solid fa-spinner fa-spin text-blue-600 text-base"></i>
                <span>Membaca ${fileArray.length} berkas dokumen... Mohon tunggu sebentar.</span>
            </div>
        `;
    }

    try {
        for (const file of fileArray) {
            const parsed = await parseSingleFileForImport(file);
            window.currentImportedDocsList.push(parsed);
        }
        window.currentImportedDocData = window.currentImportedDocsList[0] || null;

        window.renderDirectImportFileList(subjectId, subjectName);
        showToast(`${fileArray.length} berkas berhasil ditambahkan!`, 'success');
    } catch(err) {
        console.error('Error reading file:', err);
        showToast('Gagal membaca beberapa berkas', 'error');
        window.renderDirectImportFileList(subjectId, subjectName);
    }
};

window.confirmDirectImportSave = async function(subjectId, subjectName) {
    const docs = (window.currentImportedDocsList && window.currentImportedDocsList.length > 0)
        ? window.currentImportedDocsList
        : (window.currentImportedDocData ? [window.currentImportedDocData] : []);

    if (!docs || docs.length === 0) {
        showToast('Pilih berkas terlebih dahulu!', 'error');
        return;
    }

    const subjectObj = (appState.subjects || []).find(s => isSameSubject(s.id, subjectId, appState.subjects));
    const canonicalSubId = subjectObj ? subjectObj.id : subjectId;

    let targetGroupId = document.getElementById('direct-import-group-select')?.value || '';
    if (targetGroupId === '__NEW__') {
        const newGroupName = document.getElementById('direct-import-new-group-name')?.value?.trim();
        if (newGroupName) {
            if (!appState.importGroups) appState.importGroups = [];
            const newGrp = {
                id: 'grp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                subjectId: canonicalSubId,
                name: newGroupName,
                description: '',
                createdAt: new Date().toISOString()
            };
            appState.importGroups.push(newGrp);
            appState._importGroupsLoaded = true;
            try {
                await fetch('/api/import-groups', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(newGrp)
                });
            } catch(e) {}
            targetGroupId = newGrp.id;
        } else {
            targetGroupId = '';
        }
    }

    const saveBtn = document.getElementById('btn-save-direct-import');
    const saveBtnTop = document.getElementById('btn-save-direct-import-top');
    if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Menyimpan ${docs.length} Modul...</span>`;
    }
    if (saveBtnTop) {
        saveBtnTop.disabled = true;
        saveBtnTop.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Menyimpan ${docs.length} Modul...</span>`;
    }

    if (!appState.lessonPlans) appState.lessonPlans = [];

    let savedCount = 0;
    for (let i = 0; i < docs.length; i++) {
        const docData = docs[i];
        const exactTitle = docData.fileName;

        const newModul = {
            id: 'imp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
            subjectId: canonicalSubId,
            groupId: targetGroupId || '',
            title: exactTitle,
            topic: exactTitle,
            grade: 'ALL',
            semester: '1',
            classes: ['ALL'],
            targetClasses: ['ALL'],
            isImported: true,
            sourceFileName: docData.fileName,
            sourceType: docData.fileType,
            sourceBase64: docData.sourceBase64,
            htmlContent: docData.htmlContent,
            extractedContent: docData.text,
            identitasModul: docData.htmlContent || docData.text,
            kompetensiAwal: '',
            profilPancasila: '',
            saranaPrasarana: '',
            targetPeserta: '',
            modelPembelajaran: '',
            tujuanPembelajaran: '',
            pemahamanBermakna: '',
            pertanyaanPemantik: '',
            persiapanPembelajaran: '',
            kegiatanPembelajaran: docData.htmlContent || docData.text,
            asesmen: '',
            pengayaanRemedial: '',
            lkpd: '',
            lembarKerja: docData.htmlContent || docData.text,
            bahanAjar: docData.htmlContent || docData.text,
            glosarium: '',
            daftarPustaka: '',
            createdAt: new Date().toISOString()
        };

        appState.lessonPlans.push(newModul);
        savedCount++;

        try {
            await fetch('/api/lesson-plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newModul)
            });
        } catch(e) {
            console.warn('API save fallback:', e);
        }
    }

    showToast(`${savedCount} Modul Ajar berhasil disimpan di arsip!`, 'success');
    closeModal();
    if (typeof renderModulAjarModule === 'function') {
        renderModulAjarModule(document.getElementById('view-container'));
    }
};

window.structureImportedModulWithAI = async function(subjectId, subjectName) {
    const docData = window.currentImportedDocData;
    if (!docData || !docData.text) {
        showToast('Silakan pilih dan upload file dokumen terlebih dahulu!', 'error');
        return;
    }

    const topic = document.getElementById('import-modul-topic')?.value?.trim() || docData.fileName;
    const selectedTingkat = document.getElementById('import-modul-tingkat')?.value || 'ALL';
    const semester = document.getElementById('import-modul-semester')?.value || '1';
    const model = document.getElementById('import-modul-model')?.value || 'Deep Learning';
    const selectedClasses = (tempImportModulClasses && tempImportModulClasses.length > 0) ? [...tempImportModulClasses] : [selectedTingkat];
    const gradeDisplay = selectedClasses.includes('ALL') ? (selectedTingkat === 'ALL' ? 'Semua Tingkat' : 'Tingkat ' + selectedTingkat) : selectedClasses.join(', ');

    const btn = document.getElementById('btn-structure-import-ai');
    if (!btn) return;
    const origHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Menganalisis 21 Komponen...</span>';

    try {
        const response = await fetch('/api/modul/import-ai-structure', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subjectName,
                topic,
                extractedText: docData.text,
                grade: gradeDisplay,
                semester,
                guruName: getGuruName(),
                kepsekName: getKepsekName()
            })
        });

        const res = await response.json();
        if (!response.ok || !res.success) {
            throw new Error(res.message || 'Gagal menstrukturkan modul dengan AI');
        }

        const fallbackParsed = parseAndStructureImportedDocumentText(
            docData.text,
            subjectName,
            topic,
            gradeDisplay,
            semester,
            model,
            docData.fileName,
            docData.fileType
        );

        const mergedData = {
            ...fallbackParsed,
            ...(res.data || {}),
            bahanAjar: (res.data && res.data.bahanAjar) || fallbackParsed.bahanAjar || docData.text,
            materiAjar: (res.data && res.data.materiAjar) || fallbackParsed.materiAjar || docData.text,
            materiDetail: docData.text,
            lembarKerja: (res.data && res.data.lembarKerja) || fallbackParsed.lembarKerja
        };

        closeModal();
        openLessonPlanModalWithData({
            subjectId,
            semester,
            title: `Modul ${subjectName}: ${topic}`,
            topic,
            grade: selectedTingkat,
            classes: selectedClasses,
            targetClasses: selectedClasses,
            isImported: true,
            sourceFileName: docData.fileName,
            sourceType: docData.fileType,
            extractedContent: docData.text,
            ...mergedData
        });
        showToast('Naskah dokumen berhasil distrukturkan ke 21 Komponen Kurikulum Merdeka! Silakan review & simpan.', 'success');
    } catch(err) {
        showToast(err.message, 'error');
        btn.disabled = false;
        btn.innerHTML = origHtml;
    }
};


window.openPromptModulModal = function(subjectId) {
    const subject = appState.subjects ? appState.subjects.find(s => String(s.id) === String(subjectId)) : null;
    const subjectName = subject ? subject.name : 'Mata Pelajaran';

    const uniqueTingkats = getUniqueTingkatList(appState.classes || []);
    const activeLevel = appState.selectedModulAjarLevel || 'ALL';
    const activeSemester = appState.selectedModulAjarSemester || '1';

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col overflow-hidden max-h-[90vh] overflow-hidden">
                <div class="p-6 sm:p-8 border-b border-slate-100 flex justify-between items-center bg-amber-50/50">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center font-bold text-lg">
                            <i class="fa-solid fa-clipboard-list"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-800 text-lg sm:text-xl">Buat Prompt Modul Ajar</h3>
                            <p class="text-xs text-slate-500 font-medium">Hasilkan prompt untuk AI (ChatGPT/Claude/dll)</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>
                
                <div class="p-6 sm:p-8 overflow-y-auto space-y-6">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div class="space-y-1.5">
                            <label class="text-xs font-bold text-slate-700">Mata Pelajaran <span class="text-rose-500">*</span></label>
                            <input type="text" id="prompt-mapel" value="${escapeHtml(subjectName)}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500" required readonly>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-xs font-bold text-slate-700">Materi Inti / Topik <span class="text-rose-500">*</span></label>
                            <input type="text" id="prompt-topik" placeholder="Contoh: Sistem Pencernaan" class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500" required>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-xs font-bold text-slate-700">Tingkat Kelas</label>
                            <select id="prompt-kelas" class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500">
                                ${uniqueTingkats.map(lvl => `<option value="${lvl}" ${activeLevel === lvl ? 'selected' : ''}>Tingkat ${lvl}</option>`).join('')}
                                ${uniqueTingkats.length === 0 ? '<option value="X">Tingkat X</option>' : ''}
                            </select>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-xs font-bold text-slate-700">Semester</label>
                            <select id="prompt-semester" class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500">
                                <option value="1 (Ganjil)" ${activeSemester === '1' ? 'selected' : ''}>1 (Ganjil)</option>
                                <option value="2 (Genap)" ${activeSemester === '2' ? 'selected' : ''}>2 (Genap)</option>
                            </select>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-xs font-bold text-slate-700">Alokasi Waktu</label>
                            <input type="text" id="prompt-waktu" placeholder="Contoh: 2 JP (2 x 45 menit)" value="2 JP (2 x 45 Menit)" class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500">
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-xs font-bold text-slate-700">Pertemuan</label>
                            <input type="text" id="prompt-pertemuan" placeholder="Contoh: Pertemuan 1" value="Pertemuan 1" class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500">
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-xs font-bold text-slate-700">Model Pembelajaran</label>
                            <select id="prompt-model" class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500">
                                <option value="Project Based Learning (PjBL)">Project Based Learning (PjBL)</option>
                                <option value="Problem Based Learning (PBL)">Problem Based Learning (PBL)</option>
                                <option value="Inquiry Learning">Inquiry Learning</option>
                                <option value="Discovery Learning">Discovery Learning</option>
                                <option value="Deep Learning" selected>Deep Learning</option>
                                <option value="Cooperative Learning">Cooperative Learning</option>
                                <option value="Blended Learning">Blended Learning</option>
                            </select>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-xs font-bold text-slate-700">Kurikulum</label>
                            <select id="prompt-kurikulum" class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500">
                                <option value="Kurikulum Merdeka" selected>Kurikulum Merdeka</option>
                                <option value="Kurikulum 2013">Kurikulum 2013</option>
                            </select>
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-xs font-bold text-slate-700">Nama Guru Mapel</label>
                            <input type="text" id="prompt-guru" placeholder="Nama Guru" value="${escapeHtml(appState.schoolProfile?.headmasterName || 'Nama Guru')}" class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500">
                        </div>
                        <div class="space-y-1.5">
                            <label class="text-xs font-bold text-slate-700">Nama Kepala Sekolah</label>
                            <input type="text" id="prompt-kepsek" placeholder="Nama Kepala Sekolah" value="${escapeHtml(appState.schoolProfile?.headmasterName || 'Kepala Sekolah')}" class="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500">
                        </div>
                    </div>
                    
                    <!-- Result Area (Hidden initially) -->
                    <div id="prompt-result-area" class="hidden space-y-2 pt-4 border-t border-slate-100">
                        <div class="flex justify-between items-center">
                            <label class="text-xs font-extrabold text-amber-700 uppercase tracking-wider">Hasil Prompt:</label>
                            <button type="button" onclick="window.copyPromptModulAjar()" class="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-700 rounded-lg text-[10px] font-bold transition flex items-center space-x-1">
                                <i class="fa-regular fa-copy"></i><span>Salin Prompt</span>
                            </button>
                        </div>
                        <textarea id="prompt-result-text" rows="8" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-mono text-slate-700 focus:outline-none resize-none" readonly></textarea>
                    </div>
                </div>
                
                <div class="p-6 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3">
                    <button type="button" onclick="closeModal()" class="px-5 py-2.5 bg-white border border-slate-300 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 transition">Batal</button>
                    <button type="button" onclick="window.generatePromptModulAjar()" class="px-5 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-bold hover:bg-amber-600 transition flex items-center space-x-2">
                        <i class="fa-solid fa-wand-magic-sparkles"></i><span>Generate Prompt</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
    document.getElementById('prompt-guru').value = window.getTeacherName ? window.getTeacherName() : (appState.schoolProfile?.teacherName || 'Nama Guru Mapel');
    document.getElementById('prompt-kepsek').value = window.getHeadmasterName ? window.getHeadmasterName() : (appState.schoolProfile?.headmasterName || 'Nama Kepala Sekolah');
};

window.generatePromptModulAjar = function() {
    const mapel = document.getElementById('prompt-mapel').value.trim();
    const topik = document.getElementById('prompt-topik').value.trim();
    
    if (!topik) {
        showToast('Materi Inti / Topik wajib diisi!', 'warning');
        document.getElementById('prompt-topik').focus();
        return;
    }
    
    const kelas = document.getElementById('prompt-kelas').value;
    const semester = document.getElementById('prompt-semester').value;
    const waktu = document.getElementById('prompt-waktu').value.trim();
    const pertemuan = document.getElementById('prompt-pertemuan').value.trim();
    const model = document.getElementById('prompt-model').value;
    const kurikulum = document.getElementById('prompt-kurikulum').value;
    const guru = document.getElementById('prompt-guru').value.trim() || 'Guru Mapel';
    const kepsek = document.getElementById('prompt-kepsek').value.trim() || 'Kepala Sekolah';
    
    const isKurmer = kurikulum.includes('Merdeka');
    
    let prompt = `Sebagai pakar pendidikan dan guru profesional yang memahami ${kurikulum}, tolong buatkan modul ajar/RPP lengkap dan terstruktur berdasarkan detail berikut:

DETAIL MODUL:
- Mata Pelajaran: ${mapel}
- Materi Inti / Topik: ${topik}
- Tingkat / Kelas: ${kelas}
- Semester: ${semester}
- Alokasi Waktu: ${waktu}
- Pertemuan Ke: ${pertemuan}
- Model Pembelajaran: ${model}
- Penyusun (Guru): ${guru}
- Mengetahui (Kepala Sekolah): ${kepsek}

`;

    if (isKurmer) {
        prompt += `KOMPONEN YANG HARUS ADA (Kurikulum Merdeka):
1. INFORMASI UMUM
   - Identitas Modul (Nama Penyusun, Institusi, Tahun, Jenjang, Kelas, Alokasi Waktu)
   - Kompetensi Awal (Prasyarat pengetahuan/keterampilan)
   - Profil Pelajar Pancasila yang dikembangkan
   - Sarana dan Prasarana (Media, alat, sumber belajar)
   - Target Peserta Didik
   - Model Pembelajaran yang digunakan

2. KOMPONEN INTI
   - Tujuan Pembelajaran
   - Pemahaman Bermakna
   - Pertanyaan Pemantik
   - Persiapan Pembelajaran
   - Kegiatan Pembelajaran (Pendahuluan, Inti, Penutup) secara spesifik dan detail
   - Asesmen (Diagnostik, Formatif, Sumatif)
   - Pengayaan dan Remedial
   - Refleksi Peserta Didik dan Guru

3. LAMPIRAN
   - Lembar Kerja Peserta Didik (LKPD) yang aplikatif
   - Bahan Bacaan Guru dan Peserta Didik (Ringkasan Materi yang komprehensif)
   - Glosarium (Daftar istilah)
   - Daftar Pustaka`;
    } else {
        prompt += `KOMPONEN YANG HARUS ADA (Kurikulum 2013 / RPP):
1. Identitas Sekolah/Madrasah, Mata Pelajaran, Kelas/Semester, Materi Pokok, dan Alokasi Waktu.
2. Kompetensi Inti (KI) dan Kompetensi Dasar (KD) yang relevan.
3. Indikator Pencapaian Kompetensi (IPK).
4. Tujuan Pembelajaran.
5. Materi Pembelajaran (Reguler, Pengayaan, Remedial).
6. Pendekatan, Model, dan Metode Pembelajaran.
7. Media/Alat, Bahan, dan Sumber Belajar.
8. Langkah-langkah Kegiatan Pembelajaran (Pendahuluan, Inti, Penutup) dengan rinci.
9. Penilaian (Sikap, Pengetahuan, dan Keterampilan) beserta rubriknya.`;
    }
    
    prompt += `\n\nINSTRUKSI TAMBAHAN:
- Pastikan materi ajar dan kegiatan pembelajaran (Langkah-langkah) diuraikan secara nyata dan detail, bukan sekadar template kosong.
- Gunakan bahasa yang baku, profesional, dan mudah dipahami.
- Buat isi semenarik mungkin dan sesuai dengan metode ${model}.`;

    const resultArea = document.getElementById('prompt-result-area');
    const resultText = document.getElementById('prompt-result-text');
    
    resultText.value = prompt;
    resultArea.classList.remove('hidden');
    
    // Scroll to bottom
    setTimeout(() => {
        const modal = document.querySelector('#modal-container > div > div > div.overflow-y-auto');
        if (modal) modal.scrollTop = modal.scrollHeight;
    }, 100);
};

window.copyPromptModulAjar = function() {
    const text = document.getElementById('prompt-result-text').value;
    if (text) {
        navigator.clipboard.writeText(text).then(() => {
            showToast('Prompt berhasil disalin ke clipboard!', 'success');
        }).catch(() => {
            showToast('Gagal menyalin prompt', 'error');
        });
    }
};
function triggerAIGenerateModulPopup(subjectId) {
    const subject = appState.subjects ? appState.subjects.find(s => String(s.id) === String(subjectId)) : null;
    const subjectName = subject ? subject.name : 'Mata Pelajaran';

    const uniqueTingkats = getUniqueTingkatList(appState.classes || []);
    const activeLevel = appState.selectedModulAjarLevel || 'ALL';
    const activeSemester = appState.selectedModulAjarSemester || 'ALL';

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-xl rounded-3xl shadow-2xl p-6 space-y-4">
                <div class="flex justify-between items-center">
                    <div class="flex items-center space-x-2 text-indigo-600">
                        <i class="fa-solid fa-layer-group text-sm"></i>
                        <h3 class="font-bold text-slate-800">Penyusunan Modul Ajar Lengkap</h3>
                    </div>
                    <button type="button" onclick="closeModal()" class="text-slate-400 hover:text-slate-600 p-1"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>
                
                <p class="text-xs text-slate-500">Pilih opsi <strong>Generate AI</strong> (didukung Gemini cerdas) atau <strong>Generate Non-AI</strong> (template baku kurikulum terstruktur instan) untuk mata pelajaran <strong>${subjectName}</strong>.</p>
                
                <form id="ai-generate-modul-form" onsubmit="generateEntireModulAjarWithAI(event, '${subjectId}', '${subjectName.replace(/'/g, "\\'")}')" class="space-y-4">
                    <div class="space-y-1.5">
                        <label class="block text-xs font-bold uppercase text-slate-500">Materi / Topik Utama Pembelajaran <span class="text-rose-500">*</span></label>
                        <input type="text" id="ai-modul-topic" required placeholder="Contoh: Algoritma dan Pemrograman, Flowchart, Struktur If-Else" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold focus:bg-white focus:ring-2 focus:ring-indigo-500">
                    </div>

                    <div class="space-y-1.5">
                        <label class="block text-xs font-bold uppercase text-slate-500">Uraian / Detail Ringkasan Materi <span class="text-indigo-600 font-semibold lowercase">(opsional / pendukung)</span></label>
                        <textarea id="ai-modul-materi-detail" rows="2" placeholder="Isikan poin-poin materi, sub-bab, atau uraian penjelasan yang ingin diuraikan secara mendalam..." class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:bg-white"></textarea>
                    </div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="space-y-1.5">
                            <label class="block text-xs font-bold uppercase text-slate-500">Alokasi Waktu (JP)</label>
                            <input type="text" id="ai-modul-alokasi" value="4 JP" placeholder="Contoh: 2 JP, 4 JP, 6 JP, 8 JP" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500">
                        </div>
                        <div class="space-y-1.5">
                            <label class="block text-xs font-bold uppercase text-slate-500">Jenis / Kategori Materi</label>
                            <select id="ai-modul-jenis" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold cursor-pointer focus:ring-2 focus:ring-indigo-500">
                                <option value="OTOMATIS" selected>Deteksi Otomatis</option>
                                <option value="KODING">Koding & Pemrograman</option>
                                <option value="AI">Kecerdasan Artifisial (AI)</option>
                                <option value="JARINGAN">Jaringan Komputer & Internet</option>
                                <option value="ALGORITMA">Algoritma & Berpikir Komputasional</option>
                                <option value="DATA">Analisis Data & Statistik</option>
                                <option value="ETIKA_DIGITAL">Etika & Keamanan Digital</option>
                                <option value="PROYEK">Proyek Inovasi Digital</option>
                                <option value="BAHASA">Bahasa & Komunikasi</option>
                                <option value="KONSEP">Materi Inti Pembelajaran</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div class="space-y-1.5">
                            <label class="block text-xs font-bold uppercase text-slate-500">Tingkat Target</label>
                            <select id="ai-modul-tingkat" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold cursor-pointer focus:ring-2 focus:ring-indigo-500">
                                <option value="ALL" ${activeLevel === 'ALL' ? 'selected' : ''}>Semua Tingkat</option>
                                ${uniqueTingkats.map(lvl => `<option value="${lvl}" ${activeLevel === lvl ? 'selected' : ''}>Tingkat ${lvl}</option>`).join('')}
                            </select>
                        </div>
                        <div class="space-y-1.5">
                            <label class="block text-xs font-bold uppercase text-slate-500">Semester</label>
                            <select id="ai-modul-semester" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 cursor-pointer">
                                <option value="1" ${activeSemester === '1' || activeSemester === 'ALL' ? 'selected' : ''}>Semester 1 (Ganjil)</option>
                                <option value="2" ${activeSemester === '2' ? 'selected' : ''}>Semester 2 (Genap)</option>
                            </select>
                        </div>
                        <div class="space-y-1.5">
                            <label class="block text-xs font-bold uppercase text-slate-500">Model Pembelajaran</label>
                            <select id="ai-modul-model" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold">
                                <option value="Deep Learning" selected>Deep Learning</option>
                                <option value="PBL">Problem-Based (PBL)</option>
                                <option value="PjBL">Project-Based (PjBL)</option>
                                <option value="Discovery">Discovery Learning</option>
                                <option value="Inkuiri">Inquiry Learning</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="flex flex-col sm:flex-row justify-end items-center gap-2 pt-3 border-t border-slate-100">
                        <button type="button" onclick="closeModal()" class="w-full sm:w-auto px-4 py-2.5 bg-slate-100 rounded-2xl text-xs font-semibold hover:bg-slate-200 transition cursor-pointer">Batal</button>
                        <button type="button" onclick="generateModulAjarNonAI(event, '${subjectId}', '${subjectName.replace(/'/g, "\\'")}')" class="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow-sm transition flex items-center justify-center space-x-1.5 cursor-pointer">
                            <i class="fa-solid fa-bolt text-xs"></i><span>Generate Non-AI</span>
                        </button>
                        <button type="submit" id="ai-submit-btn" class="w-full sm:w-auto px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold shadow-md transition flex items-center justify-center space-x-1.5 cursor-pointer">
                            <i class="fa-solid fa-wand-magic-sparkles text-xs"></i><span>Generate AI Gemini</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

async function generateEntireModulAjarWithAI(event, subjectId, subjectName) {
    event.preventDefault();
    const topic = document.getElementById('ai-modul-topic').value;
    const materiDetail = document.getElementById('ai-modul-materi-detail')?.value || '';
    const semester = document.getElementById('ai-modul-semester')?.value || '1';
    const selectedTingkat = document.getElementById('ai-modul-tingkat')?.value || appState.selectedModulAjarLevel || 'ALL';
    const selectedClasses = [selectedTingkat];
    const gradeDisplay = selectedTingkat === 'ALL' ? 'Semua Tingkat' : 'Tingkat ' + selectedTingkat;
    const model = document.getElementById('ai-modul-model')?.value || 'Deep Learning';
    
    const submitBtn = document.getElementById('ai-submit-btn');
    if (!submitBtn) return;
    
    const originalContent = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> <span>Sedang Menyusun Modul...</span>`;

    try {
        const response = await fetch('/api/gemini/generate-modul-all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subjectName, topic, materiDetail, grade: gradeDisplay, classes: selectedClasses, model, semester })
        });
        
        const res = await response.json();
        if (!response.ok || !res.success) throw new Error(res.message || 'Gagal generate modul.');
        
        // Open the lesson plan modal with the generated data!
        closeModal();
        openLessonPlanModalWithData({
            subjectId,
            semester,
            title: `Modul ${subjectName}: ${topic}`,
            topic,
            grade: selectedTingkat,
            classes: selectedClasses,
            targetClasses: selectedClasses,
            identitasModul: res.data.identitasModul || '',
            kompetensiAwal: res.data.kompetensiAwal || '',
            profilPancasila: res.data.profilPancasila || '',
            saranaPrasarana: res.data.saranaPrasarana || '',
            targetPeserta: res.data.targetPeserta || '',
            modelPembelajaran: res.data.modelPembelajaran || '',
            tujuanPembelajaran: res.data.tujuanPembelajaran || '',
            pemahamanBermakna: res.data.pemahamanBermakna || '',
            pertanyaanPemantik: res.data.pertanyaanPemantik || '',
            persiapanPembelajaran: res.data.persiapanPembelajaran || '',
            kegiatanPembelajaran: res.data.kegiatanPembelajaran || '',
            asesmen: res.data.asesmen || '',
            pengayaanRemedial: res.data.pengayaanRemedial || '',
            lkpd: res.data.lkpd || '',
            lembarKerja: res.data.lembarKerja || '',
            glosarium: res.data.glosarium || '',
            daftarPustaka: res.data.daftarPustaka || ''
        });
        showToast('Modul Ajar berhasil disusun oleh AI! Silakan review dan simpan.', 'success');
    } catch (err) {
        showToast(err.message, 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalContent;
    }
}

function openLessonPlanModalWithData(data) {
    openLessonPlanModal(null, data.subjectId, data);
}

// Open Lesson Plan Editor Modal (Handles Manual Create, AI Generated, or Editing existing)
function openLessonPlanModal(id = null, subjectId, prefilledData = null) {
    const subjectObj = (appState.subjects || []).find(s => isSameSubject(s.id, subjectId, appState.subjects));
    const canonicalSubId = subjectObj ? subjectObj.id : subjectId;
    const isEdit = !!id;
    let lp = {
        id: '',
        subjectId: canonicalSubId,
        title: '',
        topic: '',
        grade: 'ALL',
        classes: ['ALL'],
        identitasModul: '',
        kompetensiAwal: '',
        profilPancasila: '',
        saranaPrasarana: '',
        targetPeserta: '',
        modelPembelajaran: '',
        tujuanPembelajaran: '',
        pemahamanBermakna: '',
        pertanyaanPemantik: '',
        persiapanPembelajaran: '',
        kegiatanPembelajaran: '',
        asesmen: '',
        pengayaanRemedial: '',
        lkpd: '',
        lembarKerja: '',
        glosarium: '',
        daftarPustaka: ''
    };

    if (isEdit) {
        const found = appState.lessonPlans.find(item => String(item.id) === String(id));
        if (found) lp = { ...found };
    } else if (prefilledData) {
        lp = { ...lp, ...prefilledData };
    }

    if (Array.isArray(lp.classes) && lp.classes.length > 0) {
        tempModulClasses = [...lp.classes];
    } else if (Array.isArray(lp.targetClasses) && lp.targetClasses.length > 0) {
        tempModulClasses = [...lp.targetClasses];
    } else if (lp.grade) {
        tempModulClasses = String(lp.grade).split(',').map(s => s.trim()).filter(Boolean);
    } else {
        tempModulClasses = ['ALL'];
    }

    const subject = appState.subjects ? appState.subjects.find(s => String(s.id) === String(subjectId)) : null;
    const subjectName = subject ? subject.name : 'Mata Pelajaran';

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-5xl rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col h-[90vh] overflow-hidden">
                <!-- Modal Header -->
                <div class="flex justify-between items-center pb-4 border-b border-slate-100">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <i class="fa-solid fa-file-invoice text-xs"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-800 text-sm sm:text-base">${isEdit ? 'Edit Modul Ajar' : 'Penyusunan Modul Ajar'}</h3>
                            <p class="text-[10px] text-slate-400 font-medium">Mapel: <span class="font-semibold text-slate-600">${subjectName}</span></p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg text-slate-400 hover:text-slate-600"></i></button>
                </div>

                <!-- Modal Navigation Tabs -->
                ${lp.isImported ? `
                    <div class="flex items-center space-x-2.5 py-2.5 px-4 bg-blue-50/80 border border-blue-200 rounded-2xl text-xs text-blue-900 font-bold my-2 shadow-xs">
                        <i class="fa-solid fa-file-word text-blue-600 text-sm"></i>
                        <div>
                            <p class="font-extrabold text-blue-900">Mode Edit Dokumen Utuh (${escapeHtml(lp.sourceFileName || 'File Dokumen')})</p>
                            <p class="text-[10px] text-blue-700 font-medium">Edit naskah teks seperti mengedit dokumen Word biasa secara langsung di bawah ini.</p>
                        </div>
                    </div>
                ` : `
                    <div class="flex border-b border-slate-100 py-2 overflow-x-auto space-x-2">
                        <button type="button" id="tab-btn-umum" onclick="switchModulFormTab('umum')" class="px-4 py-2 text-xs font-bold rounded-xl bg-slate-50 border border-slate-100 text-slate-600 transition flex items-center space-x-1.5 shrink-0">
                            <i class="fa-solid fa-circle-info text-[10px]"></i><span>Informasi Umum</span>
                        </button>
                        <button type="button" id="tab-btn-inti" onclick="switchModulFormTab('inti')" class="px-4 py-2 text-xs font-bold rounded-xl bg-slate-50 border border-slate-100 text-slate-600 transition flex items-center space-x-1.5 shrink-0">
                            <i class="fa-solid fa-crosshairs text-[10px]"></i><span>Komponen Inti</span>
                        </button>
                        <button type="button" id="tab-btn-lampiran" onclick="switchModulFormTab('lampiran')" class="px-4 py-2 text-xs font-bold rounded-xl bg-slate-50 border border-slate-100 text-slate-600 transition flex items-center space-x-1.5 shrink-0">
                            <i class="fa-solid fa-paperclip text-[10px]"></i><span>Lampiran</span>
                        </button>
                    </div>
                `}

                <!-- Modal Scrollable Content Area -->
                <div class="flex-1 min-h-0 overflow-y-auto py-4 pr-1">
                    <form id="lesson-plan-edit-form" class="space-y-6">
                        <input type="hidden" id="lp-id" value="${lp.id}">
                        <input type="hidden" id="lp-subjectId" value="${lp.subjectId}">
                        <input type="hidden" id="lp-isImported" value="${lp.isImported ? 'true' : 'false'}">
                        <input type="hidden" id="lp-sourceFileName" value="${escapeHtml(lp.sourceFileName || '')}">
                        <input type="hidden" id="lp-sourceType" value="${escapeHtml(lp.sourceType || '')}">
                        <textarea id="lp-extractedContent" class="hidden">${escapeHtml(lp.extractedContent || '')}</textarea>
                        <textarea id="lp-sourceBase64" class="hidden">${escapeHtml(lp.sourceBase64 || '')}</textarea>
                        <textarea id="lp-htmlContent" class="hidden">${escapeHtml(lp.htmlContent || '')}</textarea>

                        ${lp.isImported ? `
                            <div class="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center justify-between text-xs text-blue-900 shadow-xs">
                                <div class="flex items-center space-x-3">
                                    <div class="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs">
                                        <i class="fa-solid fa-file-import"></i>
                                    </div>
                                    <div>
                                        <p class="font-extrabold text-blue-900">Modul Diimpor dari File Dokumen</p>
                                        <p class="text-[11px] text-blue-700">Sumber: <strong>${escapeHtml(lp.sourceFileName || 'File Dokumen')}</strong> (${(lp.sourceType || 'doc').toUpperCase()}) • Tersimpan Utuh Tanpa Perubahan</p>
                                    </div>
                                </div>
                                <span class="px-2.5 py-1 bg-blue-200/70 font-extrabold text-[10px] text-blue-900 rounded-lg shrink-0">
                                    <i class="fa-solid fa-check-double mr-1"></i>Arsip Utuh
                                </span>
                            </div>
                        ` : ''}

                        <!-- Basic Information Header inputs -->
                        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4 p-4 bg-slate-50/80 rounded-2xl border border-slate-100">
                            <div class="space-y-1 sm:col-span-1">
                                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Judul Modul Ajar</label>
                                <input type="text" id="lp-title" required value="${lp.title || `Modul ${subjectName}`}" placeholder="Misal: Modul Ajar Fiqih Shalat" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold">
                            </div>
                            <div class="space-y-1 sm:col-span-1">
                                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Materi / Topik Utama</label>
                                <input type="text" id="lp-topic" required value="${lp.topic}" placeholder="Misal: Shalat Berjamaah" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold">
                            </div>
                            <div class="space-y-1 sm:col-span-1">
                                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Semester</label>
                                <select id="lp-semester" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer focus:ring-2 focus:ring-emerald-500">
                                    <option value="1" ${String(lp.semester) === '1' || !lp.semester ? 'selected' : ''}>Semester 1 (Ganjil)</option>
                                    <option value="2" ${String(lp.semester) === '2' ? 'selected' : ''}>Semester 2 (Genap)</option>
                                </select>
                            </div>
                            <div class="space-y-1 sm:col-span-1">
                                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Target Kelas (Bisa Ditambah)</label>
                                <select id="lp-class-dropdown" onchange="addModulClass(this.value)" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer focus:ring-2 focus:ring-emerald-500">
                                    <option value="">-- Tambah Kelas --</option>
                                    <option value="ALL">Semua Kelas</option>
                                    ${(appState.classes || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                                </select>
                                <div id="lp-selected-classes-container" class="flex flex-wrap gap-1.5 p-2 bg-white rounded-xl border border-slate-200 min-h-[38px] items-center">
                                </div>
                            </div>
                        </div>

                        ${lp.isImported ? `
                            <!-- Document Text Editor for Imported Modules -->
                            <div class="space-y-2 pt-1">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                                        <i class="fa-solid fa-file-lines text-blue-600"></i>
                                        <span>Isi Naskah Dokumen Modul Ajar</span>
                                    </label>
                                    <span class="text-[11px] text-slate-500 font-medium">Format tulisan biasa (seperti Word / Document)</span>
                                </div>
                                <textarea id="lp-documentContent" rows="18" class="w-full p-4 font-sans text-xs sm:text-sm leading-relaxed border border-slate-300 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 font-medium whitespace-pre-wrap shadow-inner" placeholder="Edit isi naskah dokumen modul ajar di sini...">${escapeHtml(lp.extractedContent || lp.identitasModul || lp.kegiatanPembelajaran || '')}</textarea>
                            </div>
                        ` : `
                            <!-- SECTION 1: INFORMASI UMUM -->
                            <div id="form-tab-section-umum" class="space-y-4">
                            <!-- Identitas Modul -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Identitas Modul</label>
                                    <div class="flex items-center space-x-1.5">
                                        <button type="button" onclick="generateNonAIField('identitasModul', '${subjectName}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-bolt text-[9px] text-emerald-600"></i><span>Non-AI</span>
                                        </button>
                                        <button type="button" onclick="generateAIField('identitasModul', '${subjectName}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i><span>Isi AI</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea id="lp-identitasModul" rows="3" class="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" placeholder="Sebutkan Penyusun, Instansi, Tahun, Alokasi Waktu...">${lp.identitasModul}</textarea>
                            </div>

                            <!-- Kompetensi Awal -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Kompetensi Awal</label>
                                    <div class="flex items-center space-x-1.5">
                                        <button type="button" onclick="generateNonAIField('kompetensiAwal', '${subjectName}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-bolt text-[9px] text-emerald-600"></i><span>Non-AI</span>
                                        </button>
                                        <button type="button" onclick="generateAIField('kompetensiAwal', '${subjectName}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i><span>Isi AI</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea id="lp-kompetensiAwal" rows="3" class="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" placeholder="Kemampuan prasyarat siswa sebelum pembelajaran...">${lp.kompetensiAwal}</textarea>
                            </div>

                            <!-- Profil Pelajar Pancasila -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Profil Pelajar Pancasila & Rahmatan Lil Alamin</label>
                                    <div class="flex items-center space-x-1.5">
                                        <button type="button" onclick="generateNonAIField('profilPancasila', '${subjectName}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-bolt text-[9px] text-emerald-600"></i><span>Non-AI</span>
                                        </button>
                                        <button type="button" onclick="generateAIField('profilPancasila', '${subjectName}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i><span>Isi AI</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea id="lp-profilPancasila" rows="3" class="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" placeholder="Dimensi profil siswa yang ingin dibangun...">${lp.profilPancasila}</textarea>
                            </div>

                            <!-- Sarana dan Prasarana -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Sarana dan Prasarana</label>
                                    <div class="flex items-center space-x-1.5">
                                        <button type="button" onclick="generateNonAIField('saranaPrasarana', '${subjectName}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-bolt text-[9px] text-emerald-600"></i><span>Non-AI</span>
                                        </button>
                                        <button type="button" onclick="generateAIField('saranaPrasarana', '${subjectName}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i><span>Isi AI</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea id="lp-saranaPrasarana" rows="3" class="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" placeholder="Fasilitas, media, alat dan bahan belajar yang dibutuhkan...">${lp.saranaPrasarana}</textarea>
                            </div>

                            <!-- Target Peserta Didik -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Target Peserta Didik</label>
                                    <div class="flex items-center space-x-1.5">
                                        <button type="button" onclick="generateNonAIField('targetPeserta', '${subjectName}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-bolt text-[9px] text-emerald-600"></i><span>Non-AI</span>
                                        </button>
                                        <button type="button" onclick="generateAIField('targetPeserta', '${subjectName}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i><span>Isi AI</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea id="lp-targetPeserta" rows="2" class="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" placeholder="Kategori siswa penerima manfaat pembelajaran...">${lp.targetPeserta}</textarea>
                            </div>

                            <!-- Model Pembelajaran -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Model Pembelajaran</label>
                                    <div class="flex items-center space-x-1.5">
                                        <button type="button" onclick="generateNonAIField('modelPembelajaran', '${subjectName}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-bolt text-[9px] text-emerald-600"></i><span>Non-AI</span>
                                        </button>
                                        <button type="button" onclick="generateAIField('modelPembelajaran', '${subjectName}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i><span>Isi AI</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea id="lp-modelPembelajaran" rows="2" class="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" placeholder="Model dan metode pembelajaran yang diterapkan...">${lp.modelPembelajaran}</textarea>
                            </div>
                        </div>

                        <!-- SECTION 2: KOMPONEN INTI -->
                        <div id="form-tab-section-inti" class="space-y-4 hidden">
                            <!-- Tujuan Pembelajaran -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Tujuan Pembelajaran</label>
                                    <div class="flex items-center space-x-1.5">
                                        <button type="button" onclick="generateNonAIField('tujuanPembelajaran', '${subjectName}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-bolt text-[9px] text-emerald-600"></i><span>Non-AI</span>
                                        </button>
                                        <button type="button" onclick="generateAIField('tujuanPembelajaran', '${subjectName}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i><span>Isi AI</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea id="lp-tujuanPembelajaran" rows="3" class="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" placeholder="Tujuan yang ingin dicapai selama pembelajaran...">${lp.tujuanPembelajaran}</textarea>
                            </div>

                            <!-- Pemahaman Bermakna -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Pemahaman Bermakna</label>
                                    <div class="flex items-center space-x-1.5">
                                        <button type="button" onclick="generateNonAIField('pemahamanBermakna', '${subjectName}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-bolt text-[9px] text-emerald-600"></i><span>Non-AI</span>
                                        </button>
                                        <button type="button" onclick="generateAIField('pemahamanBermakna', '${subjectName}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i><span>Isi AI</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea id="lp-pemahamanBermakna" rows="3" class="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" placeholder="Manfaat nyata setelah proses pembelajaran...">${lp.pemahamanBermakna}</textarea>
                            </div>

                            <!-- Pertanyaan Pemantik -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Pertanyaan Pemantik</label>
                                    <div class="flex items-center space-x-1.5">
                                        <button type="button" onclick="generateNonAIField('pertanyaanPemantik', '${subjectName}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-bolt text-[9px] text-emerald-600"></i><span>Non-AI</span>
                                        </button>
                                        <button type="button" onclick="generateAIField('pertanyaanPemantik', '${subjectName}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i><span>Isi AI</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea id="lp-pertanyaanPemantik" rows="2" class="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" placeholder="Pertanyaan pemancing diskusi awal...">${lp.pertanyaanPemantik}</textarea>
                            </div>

                            <!-- Persiapan Pembelajaran -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Persiapan Pembelajaran</label>
                                    <div class="flex items-center space-x-1.5">
                                        <button type="button" onclick="generateNonAIField('persiapanPembelajaran', '${subjectName}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-bolt text-[9px] text-emerald-600"></i><span>Non-AI</span>
                                        </button>
                                        <button type="button" onclick="generateAIField('persiapanPembelajaran', '${subjectName}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i><span>Isi AI</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea id="lp-persiapanPembelajaran" rows="3" class="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" placeholder="Langkah teknis guru sebelum masuk kelas...">${lp.persiapanPembelajaran}</textarea>
                            </div>

                            <!-- Kegiatan Pembelajaran -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Kegiatan Pembelajaran</label>
                                    <div class="flex items-center space-x-1.5">
                                        <button type="button" onclick="generateNonAIField('kegiatanPembelajaran', '${subjectName}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-bolt text-[9px] text-emerald-600"></i><span>Non-AI</span>
                                        </button>
                                        <button type="button" onclick="generateAIField('kegiatanPembelajaran', '${subjectName}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i><span>Isi AI</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea id="lp-kegiatanPembelajaran" rows="5" class="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" placeholder="Skenario detail Pendahuluan, Inti, dan Penutup...">${lp.kegiatanPembelajaran}</textarea>
                            </div>

                            <!-- Asesmen -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Asesmen</label>
                                    <div class="flex items-center space-x-1.5">
                                        <button type="button" onclick="generateNonAIField('asesmen', '${subjectName}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-bolt text-[9px] text-emerald-600"></i><span>Non-AI</span>
                                        </button>
                                        <button type="button" onclick="generateAIField('asesmen', '${subjectName}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i><span>Isi AI</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea id="lp-asesmen" rows="3" class="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" placeholder="Metode asesmen diagnostik, formatif, sumatif...">${lp.asesmen}</textarea>
                            </div>

                            <!-- Pengayaan dan Remedial -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Pengayaan dan Remedial</label>
                                    <div class="flex items-center space-x-1.5">
                                        <button type="button" onclick="generateNonAIField('pengayaanRemedial', '${subjectName}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-bolt text-[9px] text-emerald-600"></i><span>Non-AI</span>
                                        </button>
                                        <button type="button" onclick="generateAIField('pengayaanRemedial', '${subjectName}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i><span>Isi AI</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea id="lp-pengayaanRemedial" rows="3" class="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" placeholder="Program tindak lanjut belajar...">${lp.pengayaanRemedial}</textarea>
                            </div>
                        </div>

                        <!-- SECTION 3: LAMPIRAN -->
                        <div id="form-tab-section-lampiran" class="space-y-4 hidden">
                            <!-- LKPD -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Lembar Kerja Peserta Didik (LKPD)</label>
                                    <div class="flex items-center space-x-1.5">
                                        <button type="button" onclick="generateNonAIField('lkpd', '${subjectName}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-bolt text-[9px] text-emerald-600"></i><span>Non-AI</span>
                                        </button>
                                        <button type="button" onclick="generateAIField('lkpd', '${subjectName}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i><span>Isi AI</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea id="lp-lkpd" rows="4" class="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" placeholder="Tugas, instruksi pengerjaan, dan soal latihan peserta didik...">${lp.lkpd}</textarea>
                            </div>

                            <!-- Lembar Kerja -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Bahan Bacaan Guru & Siswa / Lembar Kerja Tambahan</label>
                                    <div class="flex items-center space-x-1.5">
                                        <button type="button" onclick="generateNonAIField('lembarKerja', '${subjectName}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-bolt text-[9px] text-emerald-600"></i><span>Non-AI</span>
                                        </button>
                                        <button type="button" onclick="generateAIField('lembarKerja', '${subjectName}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i><span>Isi AI</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea id="lp-lembarKerja" rows="3" class="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" placeholder="Format refleksi, draf materi, atau kuesioner mandiri...">${lp.lembarKerja}</textarea>
                            </div>

                            <!-- Glosarium -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Glosarium</label>
                                    <div class="flex items-center space-x-1.5">
                                        <button type="button" onclick="generateNonAIField('glosarium', '${subjectName}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-bolt text-[9px] text-emerald-600"></i><span>Non-AI</span>
                                        </button>
                                        <button type="button" onclick="generateAIField('glosarium', '${subjectName}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i><span>Isi AI</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea id="lp-glosarium" rows="3" class="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" placeholder="Daftar kosakata penting beserta artinya...">${lp.glosarium}</textarea>
                            </div>

                            <!-- Daftar Pustaka -->
                            <div class="space-y-1.5">
                                <div class="flex items-center justify-between">
                                    <label class="block text-xs font-extrabold uppercase tracking-wider text-slate-600">Daftar Pustaka</label>
                                    <div class="flex items-center space-x-1.5">
                                        <button type="button" onclick="generateNonAIField('daftarPustaka', '${subjectName}')" class="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-bolt text-[9px] text-emerald-600"></i><span>Non-AI</span>
                                        </button>
                                        <button type="button" onclick="generateAIField('daftarPustaka', '${subjectName}')" class="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-100 rounded-lg text-[10px] font-bold flex items-center space-x-1 transition cursor-pointer">
                                            <i class="fa-solid fa-wand-magic-sparkles text-[9px]"></i><span>Isi AI</span>
                                        </button>
                                    </div>
                                </div>
                                <textarea id="lp-daftarPustaka" rows="3" class="w-full px-3 py-2 bg-slate-50/50 border border-slate-200 rounded-xl text-xs font-semibold focus:bg-white" placeholder="Referensi sumber belajar yang kredibel...">${lp.daftarPustaka}</textarea>
                            </div>
                        </div>
                        `}
                    </form>
                </div>

                <!-- Modal Actions footer -->
                <div class="flex justify-between items-center pt-4 border-t border-slate-100 mt-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition cursor-pointer">Batal</button>
                    <button type="button" onclick="saveLessonPlan()" class="px-6 py-2.5 bg-emerald-600 text-white rounded-2xl text-xs font-bold hover:bg-emerald-700 shadow-md transition cursor-pointer">Simpan Modul Ajar</button>
                </div>
            </div>
        </div>
    `;

    if (!lp.isImported) {
        switchModulFormTab('umum');
    }
    setTimeout(() => { if (typeof window.renderModulClassChips === 'function') window.renderModulClassChips(); }, 50);
}

function switchModulFormTab(tabName) {
    const tabs = ['umum', 'inti', 'lampiran'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tab-btn-${t}`);
        const sec = document.getElementById(`form-tab-section-${t}`);
        if (!btn || !sec) return;
        if (t === tabName) {
            btn.classList.add('bg-emerald-600', 'text-white', 'border-emerald-600');
            btn.classList.remove('bg-slate-50', 'text-slate-600', 'border-slate-100');
            sec.classList.remove('hidden');
        } else {
            btn.classList.remove('bg-emerald-600', 'text-white', 'border-emerald-600');
            btn.classList.add('bg-slate-50', 'text-slate-600', 'border-slate-100');
            sec.classList.add('hidden');
        }
    });
}

// Generate a single field with AI based on subject name and topic
async function generateAIField(fieldName, subjectName) {
    const topicInput = document.getElementById('lp-topic');
    const textarea = document.getElementById(`lp-${fieldName}`);

    if (!topicInput || !textarea) return;

    const topic = topicInput.value.trim();
    const selectedClasses = tempModulClasses && tempModulClasses.length > 0 ? tempModulClasses : ['ALL'];
    const grade = selectedClasses.includes('ALL') ? 'Semua Tingkat' : selectedClasses.join(', ');

    if (!topic) {
        showToast('Silakan isi kolom materi / topik utama terlebih dahulu sebelum melakukan generate AI!', 'error');
        topicInput.focus();
        return;
    }

    const originalPlaceholder = textarea.placeholder;
    textarea.disabled = true;
    textarea.placeholder = 'Sedang generate konten otomatis menggunakan Gemini AI...';
    textarea.value = '';

    try {
        const response = await fetch('/api/gemini/generate-modul', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subjectName,
                topic,
                grade,
                classes: selectedClasses,
                fieldName
            })
        });

        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Gagal generate AI.');

        textarea.value = data.text;
        showToast('Aspek berhasil diisi menggunakan AI!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        textarea.disabled = false;
        textarea.placeholder = originalPlaceholder;
    }
}
window.generateAIField = generateAIField;

// Generate a single field with Non-AI Standard Template
function generateNonAIField(fieldName, subjectName) {
    const topicInput = document.getElementById('lp-topic');
    const textarea = document.getElementById(`lp-${fieldName}`);

    if (!topicInput || !textarea) return;

    const topic = topicInput.value.trim() || 'Pembelajaran Tematik & Terpadu';
    const selectedClasses = tempModulClasses && tempModulClasses.length > 0 ? tempModulClasses : ['ALL'];
    const grade = selectedClasses.includes('ALL') ? 'Semua Tingkat / Fase' : selectedClasses.join(', ');

    const fullData = getComprehensiveModulAjarStandardData({
        subjectName,
        topic,
        grade,
        variationNonce: Date.now() + Math.floor(Math.random() * 100000)
    });
    if (fullData && fullData[fieldName]) {
        textarea.value = fullData[fieldName];
        showToast('Aspek berhasil diisi dengan Template Standar (Non-AI)!', 'success');
    } else {
        showToast('Konten template untuk aspek ini berhasil diperbarui.', 'info');
    }
}
window.generateNonAIField = generateNonAIField;

async function saveLessonPlan() {
    const title = document.getElementById('lp-title').value.trim();
    const topic = document.getElementById('lp-topic').value.trim();
    const semester = document.getElementById('lp-semester')?.value || '1';
    const selectedClasses = tempModulClasses && tempModulClasses.length > 0 ? tempModulClasses : ['ALL'];
    const grade = selectedClasses.join(',');
    const subjectId = document.getElementById('lp-subjectId').value;
    const id = document.getElementById('lp-id').value;

    if (!title || !topic) {
        showToast('Judul dan Materi/Topik wajib diisi!', 'error');
        return;
    }

    const isImported = document.getElementById('lp-isImported')?.value === 'true';
    const docContentEl = document.getElementById('lp-documentContent');
    const docContent = docContentEl ? docContentEl.value : '';

    const payload = {
        id: id || undefined,
        subjectId,
        title,
        topic,
        grade,
        semester,
        classes: selectedClasses,
        targetClasses: selectedClasses,
        identitasModul: isImported ? docContent : (document.getElementById('lp-identitasModul')?.value || ''),
        kompetensiAwal: isImported ? '' : (document.getElementById('lp-kompetensiAwal')?.value || ''),
        profilPancasila: isImported ? '' : (document.getElementById('lp-profilPancasila')?.value || ''),
        saranaPrasarana: isImported ? '' : (document.getElementById('lp-saranaPrasarana')?.value || ''),
        targetPeserta: isImported ? '' : (document.getElementById('lp-targetPeserta')?.value || ''),
        modelPembelajaran: isImported ? '' : (document.getElementById('lp-modelPembelajaran')?.value || ''),
        tujuanPembelajaran: isImported ? '' : (document.getElementById('lp-tujuanPembelajaran')?.value || ''),
        pemahamanBermakna: isImported ? '' : (document.getElementById('lp-pemahamanBermakna')?.value || ''),
        pertanyaanPemantik: isImported ? '' : (document.getElementById('lp-pertanyaanPemantik')?.value || ''),
        persiapanPembelajaran: isImported ? '' : (document.getElementById('lp-persiapanPembelajaran')?.value || ''),
        kegiatanPembelajaran: isImported ? docContent : (document.getElementById('lp-kegiatanPembelajaran')?.value || ''),
        asesmen: isImported ? '' : (document.getElementById('lp-asesmen')?.value || ''),
        pengayaanRemedial: isImported ? '' : (document.getElementById('lp-pengayaanRemedial')?.value || ''),
        lkpd: isImported ? '' : (document.getElementById('lp-lkpd')?.value || ''),
        lembarKerja: isImported ? docContent : (document.getElementById('lp-lembarKerja')?.value || ''),
        bahanAjar: isImported ? docContent : (document.getElementById('lp-bahanAjar')?.value || ''),
        materiAjar: isImported ? docContent : (document.getElementById('lp-materiAjar')?.value || ''),
        materiDetail: isImported ? docContent : (document.getElementById('lp-materiDetail')?.value || ''),
        glosarium: isImported ? '' : (document.getElementById('lp-glosarium')?.value || ''),
        daftarPustaka: isImported ? '' : (document.getElementById('lp-daftarPustaka')?.value || ''),
        isImported: isImported,
        sourceFileName: document.getElementById('lp-sourceFileName')?.value || '',
        sourceType: document.getElementById('lp-sourceType')?.value || '',
        sourceBase64: isImported && docContent !== (document.getElementById('lp-extractedContent')?.value || '') ? '' : (document.getElementById('lp-sourceBase64')?.value || ''),
        htmlContent: isImported && docContent ? `<div class="whitespace-pre-wrap">${escapeHtml(docContent)}</div>` : (document.getElementById('lp-htmlContent')?.value || ''),
        extractedContent: isImported ? docContent : (document.getElementById('lp-extractedContent')?.value || '')
    };

    try {
        const response = await fetch('/api/lesson-plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const res = await response.json();
        if (!response.ok || !res.success) throw new Error(res.message || 'Gagal menyimpan.');

        showToast(res.message || 'Modul Ajar berhasil disimpan!', 'success');
        closeModal();

        // Reload lists
        appState.lessonPlans = null;
        renderModulAjarModule(document.getElementById('view-container'));
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteLessonPlan(id) {
    showConfirmModal('Apakah Anda yakin ingin menghapus modul ajar ini?', async () => {
        appState.lessonPlans = (appState.lessonPlans || []).filter(lp => String(lp.id) !== String(id));
        showToast('Modul Ajar berhasil dihapus!', 'success');
        renderModulAjarModule(document.getElementById('view-container'));

        try {
            await fetch(`/api/lesson-plans/${id}`, {
                method: 'DELETE'
            });
        } catch (err) {}
    });
}

// Preview Lesson Plan Printable Modal
function openPreviewLessonPlan(id) {
    const lp = appState.lessonPlans.find(item => String(item.id) === String(id));
    if (!lp) return;

    const subject = appState.subjects ? appState.subjects.find(s => String(s.id) === String(lp.subjectId)) : null;
    const subjectName = subject ? subject.name : 'Mata Pelajaran';

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    if (lp.isImported) {
        const displayBody = lp.htmlContent || (lp.extractedContent ? `<div class="whitespace-pre-wrap">${escapeHtml(lp.extractedContent)}</div>` : '');
        document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
            <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
                <div class="bg-white w-full max-w-4xl rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col h-[90vh] overflow-hidden">
                    <!-- Header -->
                    <div class="flex justify-between items-center pb-4 border-b border-slate-100">
                        <div class="flex items-center space-x-3">
                            <div class="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-lg">
                                <i class="fa-solid fa-file-word"></i>
                            </div>
                            <div>
                                <h3 class="font-extrabold text-slate-800 text-sm sm:text-base">${escapeHtml(lp.title)}</h3>
                                <p class="text-[10px] text-slate-400 font-medium">Dokumen Terimpor (Sesuai Aslinya)</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button type="button" onclick="printPreviewModul()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white border border-slate-800 text-xs font-semibold rounded-xl transition flex items-center space-x-1 cursor-pointer">
                                <i class="fa-solid fa-print"></i><span>Cetak</span>
                            </button>
                            <button type="button" onclick="downloadModulAsWord('${lp.id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 text-xs font-semibold rounded-xl transition flex items-center space-x-1 cursor-pointer">
                                <i class="fa-solid fa-file-word"></i><span>Download Word</span>
                            </button>
                            <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"><i class="fa-solid fa-xmark text-lg"></i></button>
                        </div>
                    </div>

                    <!-- Printable Document Container -->
                    <div class="flex-1 min-h-0 overflow-y-auto py-6 pr-1 text-slate-800 space-y-6" id="modul-print-area">
                        <div class="text-center space-y-2 border-b-2 border-slate-900 pb-4">
                            <h2 class="text-xl sm:text-2xl font-extrabold text-slate-900">${escapeHtml(lp.title)}</h2>
                            <p class="text-xs font-semibold text-slate-500">Mata Pelajaran: ${escapeHtml(subjectName)} | Berkas Asli: ${escapeHtml(lp.sourceFileName || lp.title)}</p>
                        </div>

                        <div class="prose max-w-none text-slate-800 leading-relaxed text-sm [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_td]:border [&_td]:border-slate-300 [&_td]:p-2 [&_th]:border [&_th]:border-slate-300 [&_th]:p-2 [&_th]:bg-slate-100 [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-3 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5">
                            ${displayBody}
                        </div>
                    </div>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');
        return;
    }

    if (lp.isHtml || lp.htmlContent) {
        document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
            <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
                <div class="bg-white w-full max-w-4xl rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col h-[90vh] overflow-hidden">
                    <!-- Header -->
                    <div class="flex justify-between items-center pb-4 border-b border-slate-100">
                        <div class="flex items-center space-x-2">
                            <i class="fa-solid fa-file-invoice text-emerald-600 text-lg"></i>
                            <div>
                                <h3 class="font-extrabold text-slate-800 text-sm sm:text-base">${escapeHtml(lp.title)}</h3>
                                <p class="text-[10px] text-slate-400 font-medium">Dokumen Perangkat Pembelajaran</p>
                            </div>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button type="button" onclick="printPreviewModul()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white border border-slate-800 text-xs font-semibold rounded-xl transition flex items-center space-x-1 cursor-pointer">
                                <i class="fa-solid fa-print"></i><span>Cetak</span>
                            </button>
                            <button type="button" onclick="downloadModulAsWord('${lp.id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 text-xs font-semibold rounded-xl transition flex items-center space-x-1 cursor-pointer">
                                <i class="fa-solid fa-file-word"></i><span>Download Word</span>
                            </button>
                            <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"><i class="fa-solid fa-xmark text-lg"></i></button>
                        </div>
                    </div>

                    <!-- Printable Document Container -->
                    <div class="flex-1 min-h-0 overflow-y-auto py-6 pr-1 text-slate-800" id="modul-print-area">
                        <div class="prose max-w-none text-slate-800">
                            ${lp.htmlContent}
                        </div>
                    </div>
                </div>
            </div>
        `;
        modal.classList.remove('hidden');
        return;
    }

    document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-4xl rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col h-[90vh] overflow-hidden">
                <!-- Header -->
                <div class="flex justify-between items-center pb-4 border-b border-slate-100">
                    <div class="flex items-center space-x-2">
                        <i class="fa-solid fa-file-pdf text-emerald-600 text-lg"></i>
                        <div>
                            <h3 class="font-extrabold text-slate-800 text-sm sm:text-base">Pratinjau Modul Ajar Digital</h3>
                            <p class="text-[10px] text-slate-400 font-medium">Kurikulum Merdeka / Sekolah</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button type="button" onclick="printPreviewModul()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white border border-slate-800 text-xs font-semibold rounded-xl transition flex items-center space-x-1 cursor-pointer">
                            <i class="fa-solid fa-print"></i><span>Cetak</span>
                        </button>
                        <button type="button" onclick="downloadModulAsWord('${lp.id}')" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-emerald-700 text-xs font-semibold rounded-xl transition flex items-center space-x-1 cursor-pointer">
                            <i class="fa-solid fa-file-word"></i><span>Download Word</span>
                        </button>
                        <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition"><i class="fa-solid fa-xmark text-lg"></i></button>
                    </div>
                </div>

                <!-- Printable Document Container -->
                <div class="flex-1 min-h-0 overflow-y-auto py-6 pr-1 text-slate-800 space-y-8" id="modul-print-area">
                    <div class="text-center space-y-2 border-b-2 border-slate-900 pb-6">
                        <span class="text-xs uppercase font-extrabold tracking-widest text-emerald-600">MODUL AJAR & PERANGKAT PEMBELAJARAN LENGKAP (A - W)</span>
                        <h2 class="text-xl sm:text-3xl font-extrabold text-slate-900">${lp.title}</h2>
                        <p class="text-xs sm:text-sm font-semibold text-slate-500">Mata Pelajaran: ${subjectName} | Kelas: ${lp.grade} | Topik: ${lp.topic}</p>
                    </div>

                    <!-- STRUKTUR MODUL AJAR A - W -->
                    <div class="space-y-6">
                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">A. Identitas Modul</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.identitasModul || '')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">B. Capaian Pembelajaran</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.capaianPembelajaran || lp.kompetensiAwal || '')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">C. Karakteristik Materi</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.karakteristikMateri || lp.profilPancasila || '')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">D. Profil Pelajar Pancasila</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.kbc || lp.profilPancasila || '')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">E. Pembelajaran Mendalam (Mindful, Meaningful, Joyful)</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.pembelajaranMendalam || '- Mindful, Meaningful, Joyful Learning.')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">F. Tujuan Pembelajaran</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.tujuanPembelajaran || '')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">G. Pemahaman Bermakna</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.pemahamanBermakna || '')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">H. Pertanyaan Pemantik</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.pertanyaanPemantik || '')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">I. Praktik Pedagogis</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.praktikPedagogis || lp.modelPembelajaran || '')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">J. Mitra Pembelajaran</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.mitraPembelajaran || '- Guru Mata Pelajaran dan Teman Sebaya')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">K. Lingkungan Pembelajaran</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.lingkunganPembelajaran || lp.saranaPrasarana || '')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">L. Pemanfaatan Digital</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.pemanfaatanDigital || '- Perangkat komputer/laptop, akses internet, dan tools pendukung.')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">M. Kegiatan Pembelajaran</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.kegiatanPembelajaran || '')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">N. Asesmen</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.asesmen || '')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">O. Diferensiasi Pembelajaran</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.diferensiasiPembelajaran || '- Diferensiasi Konten, Proses, dan Produk.')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">P. Remedial</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.remedial || (lp.pengayaanRemedial ? lp.pengayaanRemedial.split('PENGAYAAN')[0] : '') || '')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">Q. Pengayaan</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.pengayaan || (lp.pengayaanRemedial ? lp.pengayaanRemedial.split('PENGAYAAN')[1] : '') || '')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">R. LKPD (Lembar Kerja Peserta Didik)</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200 overflow-x-auto pl-4">${formatMarkdownWithTables(lp.lkpd || '')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">S. Mini Challenge / Proyek</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200 overflow-x-auto pl-4">${formatMarkdownWithTables(lp.miniChallengeProyek || lp.lembarKerja || '')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">T. Refleksi</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.refleksi || '')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">U. Bahan Ajar</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.bahanAjar || lp.materiAjar || lp.lembarKerja || lp.materiDetail || lp.extractedContent || '')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">V. Glosarium</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed pl-4">${formatMarkdownWithTables(lp.glosarium || '')}</div>
                        </div>

                        <div class="space-y-1">
                            <div class="bg-emerald-50/80 border-l-4 border-emerald-500 rounded-r-xl px-4 py-2 mb-2 flex items-center space-x-2">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                <h5 class="text-xs sm:text-sm font-extrabold text-emerald-950 uppercase tracking-wider">W. Daftar Pustaka</h5>
                            </div>
                            <div class="text-xs sm:text-sm text-slate-700 leading-relaxed italic font-serif pl-4">${formatMarkdownWithTables(lp.daftarPustaka || '')}</div>
                        </div>
                    </div>

                    <!-- 4. LEMBAR PENGESAHAN / TANDA TANGAN -->
                    <div class="pt-8 mt-12 border-t border-slate-200">
                        <table class="w-full text-center text-xs sm:text-sm text-slate-800 border-none">
                            <tr class="border-none">
                                <td class="w-1/2 py-2 border-none">
                                    Mengetahui,<br>
                                    <span class="font-bold">Kepala ${getSchoolName()}</span><br><br><br><br><br>
                                    <span class="font-bold underline">${getKepsekName()}</span><br>
                                    <span class="text-xs text-slate-500">NIP. ${getKepsekNip()}</span>
                                </td>
                                <td class="w-1/2 py-2 border-none">
                                    ${getSchoolLocation()}, ${new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'})}<br>
                                    <span class="font-bold">Guru Mata Pelajaran</span><br><br><br><br><br>
                                    <span class="font-bold underline">${getGuruName()}</span><br>
                                    <span class="text-xs text-slate-500">NIP. ${getGuruNip()}</span>
                                </td>
                            </tr>
                        </table>
                    </div>

                    ${lp.extractedContent ? `
                        <!-- LAMPIRAN NASKAH ASLI DOKUMEN IMPOR -->
                        <div class="mt-8 p-4 bg-blue-50/60 border border-blue-200 rounded-2xl space-y-2 no-print">
                            <div class="flex items-center justify-between">
                                <span class="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                                    <i class="fa-solid fa-file-import text-blue-600"></i> Naskah Asli Dokumen Impor (${escapeHtml(lp.sourceFileName || 'File Dokumen')})
                                </span>
                                <span class="text-[10px] text-blue-600 font-semibold">${lp.extractedContent.length.toLocaleString('id-ID')} karakter</span>
                            </div>
                            <div class="bg-white p-3 rounded-xl border border-blue-100 max-h-48 overflow-y-auto text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed">
                                ${escapeHtml(lp.extractedContent.substring(0, 3000))}${lp.extractedContent.length > 3000 ? '\n\n... (sebagian teks dipotong untuk pratinjau ringkas)' : ''}
                            </div>
                        </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

function printPreviewModul() {
    const area = document.getElementById('modul-print-area');
    if (!area) return;

    const printWin = window.open('', '', 'width=900,height=650');
    if (!printWin) {
        showToast('Gagal mencetak. Pastikan popup tidak diblokir oleh browser Anda.', 'error');
        return;
    }

    printWin.document.write(`
        <html>
        <head>
            <title>Cetak Modul Ajar</title>
            <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
            <style>
                body { font-family: sans-serif; padding: 40px; color: #1a202c; }
                h4 { border-left: 4px solid #059669; padding-left: 12px; font-weight: bold; margin-top: 30px; margin-bottom: 15px; page-break-after: avoid; }
                h5 { font-weight: bold; text-transform: uppercase; color: #4a5568; font-size: 11px; margin-top: 15px; margin-bottom: 5px; page-break-after: avoid; }
                p { font-size: 13px; line-height: 1.6; white-space: pre-wrap; margin-bottom: 15px; }
                .grid { display: grid; grid-template-cols: 1fr 1fr; gap: 20px; }
                @media print {
                    body { padding: 0; }
                    .page-break { page-break-before: always; }
                }
            </style>
        </head>
        <body>
            ${area.innerHTML}
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                };
            </script>
        </body>
        </html>
    `);
    printWin.document.close();
}

function downloadModulAsWord(id) {
    const lp = appState.lessonPlans.find(item => String(item.id) === String(id));
    if (!lp) return;

    // Loss-less download of the exact original file binary if Base64 exists
    if (lp.sourceBase64) {
        try {
            const fileName = lp.sourceFileName || (lp.title.endsWith('.docx') || lp.title.endsWith('.pdf') ? lp.title : `${lp.title}.docx`);
            const a = document.createElement('a');
            a.href = lp.sourceBase64;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            showToast(`Berkas "${fileName}" berhasil diunduh persis seperti aslinya!`, 'success');
            return;
        } catch(err) {
            console.error('Error downloading source base64:', err);
        }
    }

    const subject = appState.subjects ? appState.subjects.find(s => String(s.id) === String(lp.subjectId)) : null;
    const subjectName = subject ? subject.name : 'Mata Pelajaran';

    function getIndonesianDate() {
        const months = [
            "Januari", "Februari", "Maret", "April", "Mei", "Juni",
            "Juli", "Agustus", "September", "Oktober", "November", "Desember"
        ];
        const d = new Date();
        const day = d.getDate();
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        return `${day} ${month} ${year}`;
    }

    let htmlContent = '';
    if (lp.isImported) {
        const bodyContent = lp.htmlContent || (lp.extractedContent ? `<div style="white-space: pre-wrap;">${escapeHtml(lp.extractedContent)}</div>` : '');
        htmlContent = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset="utf-8">
                <title>${escapeHtml(lp.title)}</title>
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
                    @page { size: 21cm 29.7cm; margin: 2.54cm; }
                    body { font-family: 'Calibri', 'Arial', sans-serif; font-size: 11pt; line-height: 1.6; color: #1e293b; padding: 20px; }
                    .doc-header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 20px; }
                    .doc-title { font-size: 18pt; font-weight: bold; color: #0f172a; }
                    .doc-subtitle { font-size: 10pt; color: #475569; }
                    .content-body { font-size: 11pt; color: #334155; margin-top: 20px; }
                    table { border-collapse: collapse; width: 100%; margin: 12pt 0; }
                    td, th { border: 1px solid #94a3b8; padding: 6pt 8pt; vertical-align: top; }
                    th { background-color: #f1f5f9; font-weight: bold; }
                    h1 { font-size: 16pt; font-weight: bold; margin-top: 14pt; margin-bottom: 6pt; }
                    h2 { font-size: 13pt; font-weight: bold; margin-top: 12pt; margin-bottom: 4pt; }
                    p { margin-top: 0; margin-bottom: 6pt; }
                </style>
            </head>
            <body>
                <div class="doc-header">
                    <h1 class="doc-title">${escapeHtml(lp.title)}</h1>
                    <div class="doc-subtitle">Mata Pelajaran: ${escapeHtml(subjectName)} | Berkas Asli: ${escapeHtml(lp.sourceFileName || lp.title)}</div>
                </div>
                <div class="content-body">${bodyContent}</div>
            </body>
            </html>
        `;
    } else if (lp.isHtml) {
        htmlContent = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset="utf-8">
                <title>${lp.title}</title>
                <style>
                    body { font-family: 'Arial', sans-serif; line-height: 1.6; color: #333333; }
                    table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
                    table, th, td { border: 1px solid black; padding: 8px; }
                    th { background-color: #f2f2f2; font-weight: bold; }
                </style>
            </head>
            <body>
                <h1 style="text-align: center; font-size: 20px; margin-bottom: 10px;">${lp.title.toUpperCase()}</h1>
                ${lp.htmlContent}
            </body>
            </html>
        `;
    } else {
        // Build beautiful HTML structure for Word export matching the preview perfectly
        htmlContent = `
            <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
            <head>
                <meta charset="utf-8">
                <title>${lp.title}</title>
                <style>
                    @page {
                        size: A4;
                        margin: 2cm;
                    }
                    body {
                        font-family: 'Arial', sans-serif;
                        line-height: 1.5;
                        color: #1e293b;
                        background-color: #ffffff;
                    }
                    .doc-header {
                        text-align: center;
                        border-bottom: 2px solid #0f172a;
                        padding-bottom: 15px;
                        margin-bottom: 30px;
                    }
                    .doc-eyebrow {
                        font-size: 9pt;
                        font-weight: bold;
                        color: #059669;
                        letter-spacing: 1px;
                        text-transform: uppercase;
                    }
                    .doc-title {
                        font-size: 18pt;
                        font-weight: bold;
                        color: #0f172a;
                        margin: 6px 0;
                    }
                    .doc-subtitle {
                        font-size: 10pt;
                        color: #475569;
                        font-weight: bold;
                    }
                    .bab-header {
                        font-size: 12pt;
                        font-weight: bold;
                        background-color: #059669;
                        color: #ffffff;
                        padding: 6px 12px;
                        margin-top: 24px;
                        margin-bottom: 12px;
                        text-transform: uppercase;
                        border-radius: 4px;
                    }
                    .subbab-header {
                        font-size: 10.5pt;
                        font-weight: bold;
                        background-color: #f0fdf4;
                        color: #064e3b;
                        border-left: 4px solid #10b981;
                        padding: 6px 12px;
                        margin-top: 16px;
                        margin-bottom: 8px;
                    }
                    .subbab-content {
                        font-size: 10pt;
                        color: #334155;
                        margin-left: 28px;
                        margin-bottom: 20px;
                    }
                    .box {
                        background-color: #f8fafc;
                        border: 1px solid #e2e8f0;
                        padding: 12px;
                        margin-top: 8px;
                        margin-bottom: 12px;
                        border-radius: 6px;
                    }
                    table {
                        border-collapse: collapse;
                        width: 100%;
                        margin-top: 10px;
                        margin-bottom: 15px;
                    }
                    table, th, td {
                        border: 1px solid #cbd5e1;
                    }
                    th {
                        background-color: #f1f5f9;
                        color: #0f172a;
                        font-weight: bold;
                        text-align: left;
                        padding: 8px;
                        font-size: 9.5pt;
                    }
                    td {
                        padding: 8px;
                        color: #334155;
                        font-size: 9.5pt;
                        vertical-align: top;
                    }
                    ul, ol {
                        margin-top: 4px;
                        margin-bottom: 4px;
                        padding-left: 20px;
                    }
                    li {
                        margin-bottom: 3px;
                    }
                </style>
            </head>
            <body>
                <div class="doc-header">
                    <span class="doc-eyebrow">MODUL AJAR & PERANGKAT PEMBELAJARAN</span>
                    <h1 class="doc-title">${lp.title}</h1>
                    <div class="doc-subtitle">Mata Pelajaran: ${subjectName} | Kelas: ${lp.grade} | Topik: ${lp.topic}</div>
                </div>

                <div class="bab-header">I. INFORMASI UMUM</div>
                
                <div class="subbab-header">A. Identitas Modul</div>
                <div class="subbab-content">${formatMarkdownWithTables(lp.identitasModul, { isPrint: true })}</div>
                
                <div class="subbab-header">B. Kompetensi Awal</div>
                <div class="subbab-content">${formatMarkdownWithTables(lp.kompetensiAwal, { isPrint: true })}</div>
                
                <div class="subbab-header">C. Profil Pelajar Pancasila</div>
                <div class="subbab-content">${formatMarkdownWithTables(lp.profilPancasila, { isPrint: true })}</div>
                
                <div class="subbab-header">D. Sarana dan Prasarana</div>
                <div class="subbab-content">${formatMarkdownWithTables(lp.saranaPrasarana, { isPrint: true })}</div>
                
                <div class="subbab-header">E. Target Peserta Didik</div>
                <div class="subbab-content">${formatMarkdownWithTables(lp.targetPeserta, { isPrint: true })}</div>
                
                <div class="subbab-header">F. Model Pembelajaran</div>
                <div class="subbab-content">${formatMarkdownWithTables(lp.modelPembelajaran, { isPrint: true })}</div>

                <div class="bab-header">II. KOMPONEN INTI</div>
                
                <div class="subbab-header">A. Tujuan Pembelajaran</div>
                <div class="subbab-content">${formatMarkdownWithTables(lp.tujuanPembelajaran, { isPrint: true })}</div>
                
                <div class="subbab-header">B. Pemahaman Bermakna</div>
                <div class="subbab-content">${formatMarkdownWithTables(lp.pemahamanBermakna, { isPrint: true })}</div>
                
                <div class="subbab-header">C. Pertanyaan Pemantik</div>
                <div class="subbab-content">${formatMarkdownWithTables(lp.pertanyaanPemantik, { isPrint: true })}</div>
                
                <div class="subbab-header">D. Persiapan Pembelajaran</div>
                <div class="subbab-content">${formatMarkdownWithTables(lp.persiapanPembelajaran, { isPrint: true })}</div>
                
                <div class="subbab-header">E. Kegiatan Pembelajaran</div>
                <div class="subbab-content">${formatMarkdownWithTables(lp.kegiatanPembelajaran, { isPrint: true })}</div>
                
                <div class="subbab-header">F. Asesmen</div>
                <div class="subbab-content">${formatMarkdownWithTables(lp.asesmen, { isPrint: true })}</div>
                
                <div class="subbab-header">G. Pengayaan dan Remedial</div>
                <div class="subbab-content">${formatMarkdownWithTables(lp.pengayaanRemedial, { isPrint: true })}</div>

                <div class="bab-header">III. LAMPIRAN</div>
                
                <div class="subbab-header">A. Lembar Kerja Peserta Didik (LKPD)</div>
                <div class="subbab-content">
                    <div class="box">${formatMarkdownWithTables(lp.lkpd, { isPrint: true })}</div>
                </div>
                
                <div class="subbab-header">B. Bahan Bacaan Guru & Siswa / Rubrik Penilaian</div>
                <div class="subbab-content">
                    <div class="box">${formatMarkdownWithTables(lp.lembarKerja, { isPrint: true })}</div>
                </div>
                
                <div class="subbab-header">C. Glosarium</div>
                <div class="subbab-content">${formatMarkdownWithTables(lp.glosarium, { isPrint: true })}</div>
                
                <div class="subbab-header">D. Daftar Pustaka</div>
                <div class="subbab-content"><i>${formatMarkdownWithTables(lp.daftarPustaka, { isPrint: true })}</i></div>

                <br><br>
                <table style="width: 100%; border: none !important; margin-top: 40px; font-size: 11pt; font-family: Arial, sans-serif;">
                    <tr style="border: none !important;">
                        <td style="width: 50%; border: none !important; text-align: center; vertical-align: top; padding: 10px;">
                            Mengetahui,<br>
                            <b>Kepala ${getSchoolName()}</b><br><br><br><br><br>
                            <u><b>${getKepsekName()}</b></u><br>
                            <span style="font-size: 9.5pt; color: #4b5563;">NIP. ${getKepsekNip() || '-'}</span>
                        </td>
                        <td style="width: 50%; border: none !important; text-align: center; vertical-align: top; padding: 10px;">
                            ${getSchoolLocation()}, ${getIndonesianDate()}<br>
                            <b>Guru Mata Pelajaran</b><br><br><br><br><br>
                            <u><b>${getGuruName()}</b></u><br>
                            <span style="font-size: 9.5pt; color: #4b5563;">NIP. ${getGuruNip() || '-'}</span>
                        </td>
                    </tr>
                </table>
            </body>
            </html>
        `;
    }

    const blob = new Blob(['\ufeff' + htmlContent], {
        type: 'application/msword'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${lp.title.replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// AI & Non-AI Generate Soal & Kisi-Kisi
function openGenerateSoalKisiModal(subjectId) {
    const subject = appState.subjects ? appState.subjects.find(s => String(s.id) === String(subjectId)) : null;
    const subjectName = subject ? subject.name : 'Mata Pelajaran';
    const activePlans = getFilteredLessonPlansForActiveView(subjectId);

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div id="modal-content-box" class="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col max-h-[90vh] overflow-hidden transition-all duration-300">
                <!-- Modal Header -->
                <div class="flex justify-between items-center pb-4 border-b border-slate-100 shrink-0">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <i class="fa-solid fa-brain text-xs"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-800 text-sm sm:text-base">Penyusunan Soal & Kisi-Kisi</h3>
                            <p class="text-[10px] text-slate-400 font-medium">Berdasarkan Bank Data Modul Ajar Tersimpan</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg text-slate-400 hover:text-slate-600"></i></button>
                </div>

                <!-- Modal Body (Form) -->
                <div id="modal-body-content" class="flex-1 min-h-0 overflow-y-auto py-4 space-y-6">
                    <div class="p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100/60 space-y-2">
                        <h4 class="text-xs font-bold text-indigo-900">Sistem Penyusunan Soal & Kisi-Kisi Lengkap</h4>
                        <p class="text-[11px] text-slate-600 leading-relaxed">
                            Disusun secara otomatis dari modul ajar terfilter pada mata pelajaran <strong class="text-indigo-950">${subjectName}</strong> (${activePlans.length} Modul tersedia).
                        </p>
                        <p class="text-[10px] text-slate-400 font-semibold"><i class="fa-solid fa-circle-info text-slate-500 mr-1"></i>Tanda tangan otomatis disinkronkan dari menu Identitas & Pengesahan (${escapeHtml(getGuruName())} & ${escapeHtml(getKepsekName())}).</p>
                    </div>

                    <form id="generate-soal-kisi-form" onsubmit="generateSoalKisi(event, '${subjectId}', '${subjectName.replace(/'/g, "\\'")}')" class="space-y-4">
                        <div class="space-y-1.5">
                            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Lingkup Modul Ajar Sasaran</label>
                            <select id="g-kisi-scope" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer">
                                <option value="all">Semua Modul Terfilter (${activePlans.length} Modul)</option>
                                <option value="semester_1">Hanya Modul Semester 1 (Ganjil)</option>
                                <option value="semester_2">Hanya Modul Semester 2 (Genap)</option>
                                ${activePlans.map(p => `<option value="${p.id}">Hanya Modul: ${escapeHtml(p.title)} (${escapeHtml(p.topic || 'Tanpa topik')})</option>`).join('')}
                            </select>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1.5">
                                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Jumlah Pilihan Ganda</label>
                                <input type="number" id="g-mc-count" required min="1" max="50" value="10" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            </div>
                            <div class="space-y-1.5">
                                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Jumlah Essay / Uraian</label>
                                <input type="number" id="g-essay-count" required min="0" max="25" value="5" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div class="space-y-1.5">
                                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Opsi Pilihan Ganda</label>
                                <select id="g-option-count" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                    <option value="5" selected>Sampai E (A, B, C, D, E) - Standar MA</option>
                                    <option value="4">Sampai D (A, B, C, D) - Standar MTs</option>
                                </select>
                            </div>
                            <div class="space-y-1.5">
                                <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Tingkat Kesulitan</label>
                                <select id="g-difficulty" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500">
                                    <option value="mudah">Mudah (Tanpa C5 & C6)</option>
                                    <option value="sedang" selected>Sedang (C1 - C6 Merata)</option>
                                    <option value="sulit">Sulit (Terdiri dari C3 - C6)</option>
                                </select>
                            </div>
                        </div>

                        <div class="flex items-center justify-between pt-4 border-t border-slate-50 gap-2 flex-wrap sm:flex-nowrap">
                            <button type="button" onclick="closeModal()" class="px-3.5 py-2.5 bg-slate-100 rounded-2xl text-xs font-semibold hover:bg-slate-200 transition">Batal</button>
                            <div class="flex items-center space-x-2">
                                <button type="button" onclick="generateSoalKisiNonAI(event, '${subjectId}', '${subjectName.replace(/'/g, "\\'")}')" class="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-file-circle-check"></i>
                                    <span>Generate Standar (Non-AI)</span>
                                </button>
                                <button type="submit" id="g-submit-btn" class="px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-bold shadow transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                                    <span>Generate AI</span>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
}

function getSelectedScopePlans(subjectId, scopeElementId) {
    const scope = document.getElementById(scopeElementId)?.value || 'all';
    let filteredPlans = getFilteredLessonPlansForActiveView(subjectId);
    if (scope === 'semester_1') {
        filteredPlans = filteredPlans.filter(p => String(p.semester) === '1' || String(p.semester).toLowerCase().includes('ganjil') || String(p.semester).toLowerCase().includes('satu'));
    } else if (scope === 'semester_2') {
        filteredPlans = filteredPlans.filter(p => String(p.semester) === '2' || String(p.semester).toLowerCase().includes('genap') || String(p.semester).toLowerCase().includes('dua'));
    } else if (scope !== 'all') {
        filteredPlans = filteredPlans.filter(p => String(p.id) === String(scope));
    }
    return filteredPlans;
}

function generateSoalKisiNonAI(event, subjectId, subjectName) {
    if (event) event.preventDefault();
    const mcCount = parseInt(document.getElementById('g-mc-count')?.value) || 10;
    const essayCount = parseInt(document.getElementById('g-essay-count')?.value) || 5;
    const optionCount = parseInt(document.getElementById('g-option-count')?.value) || 5;
    const difficulty = document.getElementById('g-difficulty')?.value || 'sedang';

    window.lastGeneratedExamMcCount = mcCount;
    window.lastGeneratedExamEssayCount = essayCount;
    window.lastGeneratedExamOptionCount = optionCount;
    window.lastGeneratedExamDifficulty = difficulty;

    const plans = getSelectedScopePlans(subjectId, 'g-kisi-scope');
    if (!plans || plans.length === 0) {
        showToast('Tidak ada modul ajar tersimpan untuk filter/lingkup yang dipilih. Silakan buat modul ajar terlebih dahulu.', 'warning');
        return;
    }

    const data = window.generateSoalKisiNonAIStandardData ? 
        window.generateSoalKisiNonAIStandardData(plans, subjectName, mcCount, essayCount, optionCount, difficulty) :
        { title: `Naskah Soal & Kisi-Kisi ${subjectName}`, questions: [] };

    window.lastGeneratedExamData = data;
    window.lastGeneratedExamSubjectName = subjectName;

    renderGeneratedExamResultModal(data, subjectName);
    showToast('Soal & Kisi-Kisi Non-AI berhasil dibuat berdasarkan modul ajar tersimpan!', 'success');
}
window.generateSoalKisiNonAI = generateSoalKisiNonAI;

function renderGeneratedExamResultModal(data, subjectName) {
    const modalBox = document.getElementById('modal-content-box');
    const modalBody = document.getElementById('modal-body-content');
    if (!modalBox || !modalBody) return;

    modalBox.className = "bg-white w-full max-w-6xl rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col h-[90vh] overflow-hidden transition-all duration-300";

    let questionsListHtml = '';
    let kisiRowsHtml = '';

    const questions = data.questions || [];

    questions.forEach((q, idx) => {
        const k = q.kisiKisi || {};
        const qNum = q.no || (idx + 1);

        if (q.type === 'mc') {
            const ansKey = String(q.answer || q.answerKey || 'A').trim().toUpperCase();
            const optionsMarkup = (q.options || []).map(opt => {
                const optTrim = String(opt || '').trim();
                const letter = optTrim.substring(0, 1).toUpperCase();
                const optText = optTrim.substring(1).replace(/^\.\s*/, '');
                const isCorrect = ansKey === letter || ansKey === optTrim.toUpperCase() || (q.correctOptionText && q.correctOptionText === optTrim);
                return `
                <div class="flex items-start space-x-2 text-xs ${isCorrect ? 'text-emerald-900 font-bold bg-emerald-50/90 p-2 rounded-xl border border-emerald-300 shadow-xs' : 'text-slate-600 p-2 bg-white rounded-xl border border-slate-100'}">
                    <span class="font-extrabold ${isCorrect ? 'text-emerald-700' : 'text-slate-800'}">${letter}.</span>
                    <span>${optText}</span>
                </div>
            `;
            }).join('');

            questionsListHtml += `
                <div class="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold rounded-lg uppercase">SOAL ${qNum} | PILIHAN GANDA</span>
                        <span class="text-[10px] text-emerald-700 font-extrabold bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200 shadow-xs">Kunci Jawaban: ${ansKey}</span>
                    </div>
                    <h5 class="text-xs sm:text-sm font-bold text-slate-800">${q.question}</h5>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        ${optionsMarkup}
                    </div>
                    ${q.explanation ? `
                        <div class="mt-2 text-[10px] text-slate-500 bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                            <span class="font-bold text-slate-700 uppercase">Pembahasan / Penjelasan:</span> ${q.explanation}
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            questionsListHtml += `
                <div class="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-100 text-[10px] font-bold rounded-lg uppercase">SOAL ${qNum} | ESSAY / URAIAN</span>
                    </div>
                    <h5 class="text-xs sm:text-sm font-bold text-slate-800">${q.question}</h5>
                    <div class="mt-2 text-[11px] text-slate-600 bg-violet-50/30 p-3 rounded-xl border border-violet-100/60">
                        <span class="font-bold text-violet-800 uppercase block text-[10px] mb-1">Rekomendasi Kunci Jawaban / Kisi Jawaban:</span>
                        ${q.answer || '-'}
                    </div>
                    ${q.explanation ? `
                        <div class="mt-2 text-[10px] text-slate-500 bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                            <span class="font-bold text-slate-700 uppercase">Rubrik Penilaian:</span> ${q.explanation}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        kisiRowsHtml += `
            <tr class="hover:bg-slate-50 transition text-slate-700">
                <td class="border border-slate-200 p-2 text-center font-bold text-slate-800">${qNum}</td>
                <td class="border border-slate-200 p-2">${escapeHtml(k.kompetensiDasar || 'Memahami konsep modul ajar')}</td>
                <td class="border border-slate-200 p-2 font-semibold text-slate-800">${escapeHtml(k.materi || 'Materi Inti')}</td>
                <td class="border border-slate-200 p-2 text-slate-600">${escapeHtml(k.indikator || 'Siswa dapat menganalisis persoalan secara bijaksana')}</td>
                <td class="border border-slate-200 p-2 text-center font-bold text-amber-700">${escapeHtml(k.levelKognitif || 'L2')}</td>
                <td class="border border-slate-200 p-2 text-center text-slate-600">${escapeHtml(k.dimensiProsesKognitif || 'Memahami')}</td>
                <td class="border border-slate-200 p-2 text-center font-bold text-indigo-700">${escapeHtml(k.kategori || 'C2')}</td>
                <td class="border border-slate-200 p-2 text-center font-medium">${escapeHtml(k.bentukSoal || (q.type === 'mc' ? 'Pilihan Ganda' : 'Essay'))}</td>
            </tr>
        `;
    });

    const topHeaderElement = modalBody.parentNode;
    if (topHeaderElement) {
        topHeaderElement.innerHTML = `
            <!-- Modal Header -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-2 shrink-0">
                <div class="flex items-center space-x-2.5">
                    <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <i class="fa-solid fa-circle-check text-sm"></i>
                    </div>
                    <div>
                        <h3 class="font-extrabold text-slate-800 text-sm sm:text-base">Hasil Soal & Kisi-Kisi</h3>
                        <p class="text-[10px] text-slate-400 font-medium">Mata Pelajaran: <span class="text-indigo-600 font-bold">${subjectName}</span></p>
                    </div>
                </div>
                
                <!-- Tab Toggle & Action Buttons -->
                <div class="flex items-center space-x-2">
                    <button type="button" id="gen-btn-soal-tab" onclick="switchGenerateResultTab('soal')" class="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white shadow-sm transition">
                        Naskah Soal Ujian
                    </button>
                    <button type="button" id="gen-btn-kisi-tab" onclick="switchGenerateResultTab('kisi')" class="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
                        Matriks Kisi-Kisi (Landscape)
                    </button>
                </div>
            </div>

            <!-- Scrollable Container -->
            <div class="flex-1 min-h-0 overflow-y-auto py-6 pr-1 space-y-6">
                <!-- Tab 1: Soal Tab -->
                <div id="gen-soal-tab-content" class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div class="text-left">
                            <h4 class="text-sm font-bold text-slate-800">Pratinjau Lembar Soal Ujian</h4>
                            <p class="text-[10px] text-slate-400">Silakan cetak lembar soal ini ke dalam dokumen portrait</p>
                        </div>
                        <button type="button" onclick="saveGeneratedSoalKisi('${subjectName.replace(/'/g, "\\'")}')" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-md"><i class="fa-solid fa-floppy-disk"></i><span>Simpan Soal & Kisi</span></button>
                        <button type="button" onclick="printNaskahSoalPortrait()" class="px-3.5 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-sm">
                            <i class="fa-solid fa-print"></i>
                            <span>Cetak Naskah Soal</span>
                        </button>
                    </div>
                    <div class="space-y-3">
                        ${questionsListHtml}
                    </div>
                </div>

                <!-- Tab 2: Kisi Tab -->
                <div id="gen-kisi-tab-content" class="space-y-4 hidden">
                    <div class="flex items-center justify-between">
                        <div class="text-left">
                            <h4 class="text-sm font-bold text-slate-800">Pratinjau Matriks Kisi-Kisi</h4>
                            <p class="text-[10px] text-slate-400">Lembar kerja dirancang dalam format Landscape otomatis</p>
                        </div>
                        <button type="button" onclick="printKisiKisiLandscape()" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-md">
                            <i class="fa-solid fa-print"></i>
                            <span>Cetak Kisi-Kisi (Landscape)</span>
                        </button>
                    </div>

                    <!-- Landscape Table Container -->
                    <div class="overflow-x-auto border border-slate-150 rounded-2xl bg-slate-50 p-4">
                        <div class="min-w-[1100px] bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 font-sans space-y-4">
                            <div class="text-center space-y-1 pb-4 border-b border-slate-100">
                                <h3 class="text-sm font-extrabold text-slate-800 uppercase tracking-wider">MATRIKS KISI-KISI PENULISAN SOAL UJIAN</h3>
                                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mata Pelajaran: ${subjectName} | Kurikulum: Kurikulum Merdeka / Nasional</p>
                            </div>
                            <table class="w-full text-left border-collapse border border-slate-200 text-[10px]">
                                <thead>
                                    <tr class="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider">
                                        <th class="border border-slate-200 p-2.5 text-center w-12">No Soal</th>
                                        <th class="border border-slate-200 p-2.5">Kompetensi Dasar / Capaian Pembelajaran</th>
                                        <th class="border border-slate-200 p-2.5">Materi Pokok</th>
                                        <th class="border border-slate-200 p-2.5">Indikator Soal</th>
                                        <th class="border border-slate-200 p-2.5 text-center w-20">Level Kognitif</th>
                                        <th class="border border-slate-200 p-2.5 text-center w-28">Dimensi Proses Kognitif</th>
                                        <th class="border border-slate-200 p-2.5 text-center w-16">Kategori</th>
                                        <th class="border border-slate-200 p-2.5 text-center w-24">Bentuk Soal</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    ${kisiRowsHtml}
                                </tbody>
                            </table>
                            
                            <div class="mt-8 flex justify-between px-10 text-[11px] font-medium text-slate-800">
                                <div class="text-center">
                                    <p class="mb-12">Mengetahui,<br>Kepala Madrasah</p>
                                    <p class="font-bold underline">${appState.kbcKepsekName || '.............................................'}</p>
                                    <p>NIP. ${appState.kbcKepsekNip || '.............................................'}</p>
                                </div>
                                <div class="text-center">
                                    <p class="mb-12"><br>Guru Mata Pelajaran</p>
                                    <p class="font-bold underline">${appState.kbcGuruName || '.............................................'}</p>
                                    <p>NIP. ${appState.kbcGuruNip || '.............................................'}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
}
window.renderGeneratedExamResultModal = renderGeneratedExamResultModal;

async function generateSoalKisi(event, subjectId, subjectName) {
    if (event) event.preventDefault();

    const mcCount = parseInt(document.getElementById('g-mc-count').value) || 10;
    const essayCount = parseInt(document.getElementById('g-essay-count').value) || 5;
    const optionCount = parseInt(document.getElementById('g-option-count').value) || 5;
    const difficulty = document.getElementById('g-difficulty').value || 'sedang';

    window.lastGeneratedExamMcCount = mcCount;
    window.lastGeneratedExamEssayCount = essayCount;
    window.lastGeneratedExamOptionCount = optionCount;
    window.lastGeneratedExamDifficulty = difficulty;

    const modalBox = document.getElementById('modal-content-box');
    const modalBody = document.getElementById('modal-body-content');
    const submitBtn = document.getElementById('g-submit-btn');

    if (submitBtn) submitBtn.disabled = true;

    // Show beautiful animated loading state
    if (modalBody) {
        modalBody.innerHTML = `
            <div class="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-pulse">
                <div class="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-2xl relative">
                    <i class="fa-solid fa-brain"></i>
                    <div class="absolute inset-0 rounded-full border-4 border-indigo-500/20 border-t-indigo-500 animate-spin"></div>
                </div>
                <div>
                    <h4 class="font-extrabold text-slate-800 text-sm">Sedang Menelaah Modul Ajar...</h4>
                    <p class="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">AI sedang menganalisis modul Anda, menyusun draf kisi-kisi, serta merumuskan naskah soal berkualitas tinggi.</p>
                </div>
                <div class="w-48 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                    <div class="bg-indigo-600 h-full w-1/2 rounded-full animate-infinite-loading"></div>
                </div>
            </div>
        `;
    }

    // Filter relevant lesson plans based on active view filters or selection scope
    const scope = document.getElementById('g-kisi-scope')?.value || 'all';
    let filteredPlans = getFilteredLessonPlansForActiveView(subjectId);
    if (scope === 'semester_1') {
        filteredPlans = filteredPlans.filter(p => String(p.semester) === '1' || String(p.semester).toLowerCase().includes('ganjil') || String(p.semester).toLowerCase().includes('satu'));
    } else if (scope === 'semester_2') {
        filteredPlans = filteredPlans.filter(p => String(p.semester) === '2' || String(p.semester).toLowerCase().includes('genap') || String(p.semester).toLowerCase().includes('dua'));
    } else if (scope !== 'all') {
        filteredPlans = filteredPlans.filter(p => String(p.id) === String(scope));
    }

    if (filteredPlans.length === 0) {
        throw new Error("Tidak ada modul ajar tersimpan untuk filter/cakupan semester yang dipilih.");
    }

    try {
        const response = await fetch('/api/gemini/generate-soal-kisi', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subjectName,
                mcCount,
                essayCount,
                optionCount,
                lessons: filteredPlans,
                difficulty
            })
        });

        const res = await response.json();
        if (!response.ok || !res.success) {
            throw new Error(res.message || 'Gagal menghasilkan soal & kisi-kisi.');
        }

        const data = res.data;
        window.lastGeneratedExamData = data;
        window.lastGeneratedExamSubjectName = subjectName;

        // Resize the modal box to landscape / spacious size for the results screen
        if (modalBox) {
            modalBox.className = "bg-white w-full max-w-6xl rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col h-[90vh] overflow-hidden transition-all duration-300";
        }

        // Render Results screen with Tab Switcher
        if (modalBody) {
            let questionsListHtml = '';
            let kisiRowsHtml = '';

            const questions = data.questions || [];

            questions.forEach((q, idx) => {
                const k = q.kisiKisi || {};
                const qNum = q.no || (idx + 1);

                // Build Questions Preview List
                if (q.type === 'mc') {
                    const optionsMarkup = (q.options || []).map(opt => `
                        <div class="flex items-start space-x-2 text-xs text-slate-600 pl-2">
                            <span class="font-bold text-slate-800">${opt.trim().substring(0, 1)}</span>
                            <span>${opt.trim().substring(1).replace(/^\.\s*/, '')}</span>
                        </div>
                    `).join('');

                    questionsListHtml += `
                        <div class="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-2">
                            <div class="flex items-center justify-between">
                                <span class="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold rounded-lg uppercase">SOAL ${qNum} | PILIHAN GANDA</span>
                                <span class="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Kunci: ${q.answer}</span>
                            </div>
                            <h5 class="text-xs sm:text-sm font-bold text-slate-800">${q.question}</h5>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                ${optionsMarkup}
                            </div>
                            ${q.explanation ? `
                                <div class="mt-2 text-[10px] text-slate-500 bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                                    <span class="font-bold text-slate-700 uppercase">Pembahasan / Penjelasan:</span> ${q.explanation}
                                </div>
                            ` : ''}
                        </div>
                    `;
                } else {
                    questionsListHtml += `
                        <div class="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-2">
                            <div class="flex items-center justify-between">
                                <span class="px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-100 text-[10px] font-bold rounded-lg uppercase">SOAL ${qNum} | ESSAY / URAIAN</span>
                            </div>
                            <h5 class="text-xs sm:text-sm font-bold text-slate-800">${q.question}</h5>
                            <div class="mt-2 text-[11px] text-slate-600 bg-violet-50/30 p-3 rounded-xl border border-violet-100/60">
                                <span class="font-bold text-violet-800 uppercase block text-[10px] mb-1">Rekomendasi Kunci Jawaban / Kisi Jawaban:</span>
                                ${q.answer || '-'}
                            </div>
                            ${q.explanation ? `
                                <div class="mt-2 text-[10px] text-slate-500 bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                                    <span class="font-bold text-slate-700 uppercase">Rubrik Penilaian:</span> ${q.explanation}
                                </div>
                            ` : ''}
                        </div>
                    `;
                }

                // Build Kisi-Kisi Matrix Rows
                kisiRowsHtml += `
                    <tr class="hover:bg-slate-50 transition text-slate-700">
                        <td class="border border-slate-200 p-2 text-center font-bold text-slate-800">${qNum}</td>
                        <td class="border border-slate-200 p-2">${escapeHtml(k.kompetensiDasar || 'Memahami konsep modul ajar')}</td>
                        <td class="border border-slate-200 p-2 font-semibold text-slate-800">${escapeHtml(k.materi || 'Materi Inti')}</td>
                        <td class="border border-slate-200 p-2 text-slate-600">${escapeHtml(k.indikator || 'Siswa dapat menganalisis persoalan secara bijaksana')}</td>
                        <td class="border border-slate-200 p-2 text-center font-bold text-amber-700">${escapeHtml(k.levelKognitif || 'L2')}</td>
                        <td class="border border-slate-200 p-2 text-center text-slate-600">${escapeHtml(k.dimensiProsesKognitif || 'Memahami')}</td>
                        <td class="border border-slate-200 p-2 text-center font-bold text-indigo-700">${escapeHtml(k.kategori || 'C2')}</td>
                        <td class="border border-slate-200 p-2 text-center font-medium">${escapeHtml(k.bentukSoal || (q.type === 'mc' ? 'Pilihan Ganda' : 'Essay'))}</td>
                    </tr>
                `;
            });

            const topHeaderElement = modalBody.parentNode;
            if (topHeaderElement) {
                topHeaderElement.innerHTML = `
                    <!-- Modal Header -->
                    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-2 shrink-0">
                        <div class="flex items-center space-x-2.5">
                            <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                                <i class="fa-solid fa-circle-check text-sm"></i>
                            </div>
                            <div>
                                <h3 class="font-extrabold text-slate-800 text-sm sm:text-base">Hasil Soal & Kisi-Kisi AI</h3>
                                <p class="text-[10px] text-slate-400 font-medium">Mata Pelajaran: <span class="text-indigo-600 font-bold">${subjectName}</span></p>
                            </div>
                        </div>
                        
                        <!-- Tab Toggle & Action Buttons -->
                        <div class="flex items-center space-x-2">
                            <button type="button" id="gen-btn-soal-tab" onclick="switchGenerateResultTab('soal')" class="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white shadow-sm transition">
                                Naskah Soal Ujian
                            </button>
                            <button type="button" id="gen-btn-kisi-tab" onclick="switchGenerateResultTab('kisi')" class="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
                                Matriks Kisi-Kisi (Landscape)
                            </button>
                        </div>
                    </div>

                    <!-- Scrollable Container -->
                    <div class="flex-1 min-h-0 overflow-y-auto py-6 pr-1 space-y-6">
                        <!-- Tab 1: Soal Tab -->
                        <div id="gen-soal-tab-content" class="space-y-4">
                            <div class="flex items-center justify-between">
                                <div class="text-left">
                                    <h4 class="text-sm font-bold text-slate-800">Pratinjau Lembar Soal Ujian</h4>
                                    <p class="text-[10px] text-slate-400">Silakan cetak lembar soal ini ke dalam dokumen portrait</p>
                                </div>
                                <button type="button" onclick="saveGeneratedSoalKisi('${subjectName.replace(/'/g, "\\'")}')" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-md"><i class="fa-solid fa-floppy-disk"></i><span>Simpan Soal & Kisi</span></button>
                                <button type="button" onclick="printNaskahSoalPortrait()" class="px-3.5 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-sm">
                                    <i class="fa-solid fa-print"></i>
                                    <span>Cetak Naskah Soal</span>
                                </button>
                            </div>
                            <div class="space-y-3">
                                ${questionsListHtml}
                            </div>
                        </div>

                        <!-- Tab 2: Kisi Tab -->
                        <div id="gen-kisi-tab-content" class="space-y-4 hidden">
                            <div class="flex items-center justify-between">
                                <div class="text-left">
                                    <h4 class="text-sm font-bold text-slate-800">Pratinjau Matriks Kisi-Kisi</h4>
                                    <p class="text-[10px] text-slate-400">Lembar kerja dirancang dalam format Landscape otomatis</p>
                                </div>
                                <button type="button" onclick="printKisiKisiLandscape()" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-md">
                                    <i class="fa-solid fa-print"></i>
                                    <span>Cetak Kisi-Kisi (Landscape)</span>
                                </button>
                            </div>

                            <!-- Landscape Table Container -->
                            <div class="overflow-x-auto border border-slate-150 rounded-2xl bg-slate-50 p-4">
                                <div class="min-w-[1100px] bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 font-sans space-y-4">
                                    <div class="text-center space-y-1 pb-4 border-b border-slate-100">
                                        <h3 class="text-sm font-extrabold text-slate-800 uppercase tracking-wider">MATRIKS KISI-KISI PENULISAN SOAL UJIAN</h3>
                                        <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mata Pelajaran: ${subjectName} | Kurikulum: Kurikulum Merdeka / Nasional</p>
                                    </div>
                                    <table class="w-full text-left border-collapse border border-slate-200 text-[10px]">
                                        <thead>
                                            <tr class="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider">
                                                <th class="border border-slate-200 p-2.5 text-center w-12">No Soal</th>
                                                <th class="border border-slate-200 p-2.5">Kompetensi Dasar / Capaian Pembelajaran</th>
                                                <th class="border border-slate-200 p-2.5">Materi Pokok</th>
                                                <th class="border border-slate-200 p-2.5">Indikator Soal</th>
                                                <th class="border border-slate-200 p-2.5 text-center w-20">Level Kognitif</th>
                                                <th class="border border-slate-200 p-2.5 text-center w-28">Dimensi Proses Kognitif</th>
                                                <th class="border border-slate-200 p-2.5 text-center w-16">Kategori</th>
                                                <th class="border border-slate-200 p-2.5 text-center w-24">Bentuk Soal</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-slate-100">
                                            ${kisiRowsHtml}
                                        </tbody>
                                    </table>
                                    
                                    <div class="mt-8 flex justify-between px-10 text-[11px] font-medium text-slate-800">
                                        <div class="text-center">
                                            <p class="mb-12">Mengetahui,<br>Kepala Madrasah</p>
                                            <p class="font-bold underline">${appState.kbcKepsekName || '.............................................'}</p>
                                            <p>NIP. ${appState.kbcKepsekNip || '.............................................'}</p>
                                        </div>
                                        <div class="text-center">
                                            <p class="mb-12"><br>Guru Mata Pelajaran</p>
                                            <p class="font-bold underline">${appState.kbcGuruName || '.............................................'}</p>
                                            <p>NIP. ${appState.kbcGuruNip || '.............................................'}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Footer Actions -->
                    <div class="flex justify-between items-center pt-4 border-t border-slate-100 shrink-0 gap-2">
                        <div id="save-exam-btn-container">
                            <button type="button" onclick="saveGeneratedExamPackage('${subjectId}')" class="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl transition shadow-md cursor-pointer flex items-center space-x-1.5 animate-bounce">
                                <i class="fa-solid fa-floppy-disk"></i>
                                <span>Simpan Paket Soal</span>
                            </button>
                        </div>
                        <button type="button" onclick="closeModal()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition shadow-sm cursor-pointer">
                            Tutup
                        </button>
                    </div>
                `;
            }
        }

        showToast('Soal & Kisi-Kisi Ujian berhasil di-generate!', 'success');
    } catch (err) {
        showToast(err.message, 'error');
        openGenerateSoalKisiModal(subjectId);
    }
}

function switchGenerateResultTab(tabName) {
    const soalTab = document.getElementById('gen-soal-tab-content');
    const kisiTab = document.getElementById('gen-kisi-tab-content');
    const kunciTab = document.getElementById('gen-kunci-tab-content');
    
    const btnSoal = document.getElementById('gen-btn-soal-tab');
    const btnKisi = document.getElementById('gen-btn-kisi-tab');
    const btnKunci = document.getElementById('gen-btn-kunci-tab');
    
    if (soalTab) soalTab.classList.toggle('hidden', tabName !== 'soal');
    if (kisiTab) kisiTab.classList.toggle('hidden', tabName !== 'kisi');
    if (kunciTab) kunciTab.classList.toggle('hidden', tabName !== 'kunci');
    
    const activeClass = "px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white shadow-sm transition";
    const inactiveClass = "px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition";
    
    if (btnSoal) btnSoal.className = tabName === 'soal' ? activeClass : inactiveClass;
    if (btnKisi) btnKisi.className = tabName === 'kisi' ? activeClass : inactiveClass;
    if (btnKunci) btnKunci.className = tabName === 'kunci' ? activeClass : inactiveClass;
}

function printKisiKisiLandscape() {
    const data = window.lastGeneratedExamData;
    if (!data || !data.questions) return;

    const subjectName = window.lastGeneratedExamSubjectName || '';
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Gagal membuka jendela cetak. Pastikan pop-up blocker dinonaktifkan.');
        return;
    }

    let rowsHtml = '';
    data.questions.forEach((q, idx) => {
        const k = q.kisiKisi || {};
        const qNum = q.no || (idx + 1);
        rowsHtml += `
            <tr>
                <td style="text-align: center; font-weight: bold;">${qNum}</td>
                <td>${escapeHtml(k.kompetensiDasar || 'Memahami konsep modul ajar')}</td>
                <td>${escapeHtml(k.materi || 'Materi Inti')}</td>
                <td>${escapeHtml(k.indikator || 'Siswa dapat menganalisis persoalan secara bijaksana')}</td>
                <td style="text-align: center; font-weight: bold; color: #a16207;">${escapeHtml(k.levelKognitif || 'L2')}</td>
                <td style="text-align: center;">${escapeHtml(k.dimensiProsesKognitif || 'Memahami')}</td>
                <td style="text-align: center; font-weight: bold; color: #4f46e5;">${escapeHtml(k.kategori || 'C2')}</td>
                <td style="text-align: center;">${escapeHtml(k.bentukSoal || (q.type === 'mc' ? 'Pilihan Ganda' : 'Essay'))}</td>
            </tr>
        `;
    });

    printWindow.document.write(`
        <html>
        <head>
            <title>Kisi-Kisi Ujian - ${subjectName}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
            <style>
                @page {
                    size: landscape;
                    margin: 1.5cm;
                }
                body {
                    font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
                    color: #333;
                    margin: 0;
                    padding: 0;
                    background-color: #fff;
                }
                .header {
                    text-align: center;
                    margin-bottom: 25px;
                }
                .header h2 {
                    margin: 0;
                    font-size: 16px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: #1e293b;
                }
                .header p {
                    margin: 5px 0 0 0;
                    font-size: 11px;
                    color: #64748b;
                    font-weight: bold;
                    text-transform: uppercase;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 10px;
                }
                th, td {
                    border: 1px solid #cbd5e1;
                    padding: 8px 10px;
                    text-align: left;
                    vertical-align: top;
                }
                th {
                    background-color: #f1f5f9;
                    font-weight: bold;
                    text-transform: uppercase;
                    color: #334155;
                }
                tr:nth-child(even) td {
                    background-color: #f8fafc;
                }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <div class="header">
                <h2>MATRIKS KISI-KISI PENULISAN SOAL UJIAN</h2>
                <p>MATA PELAJARAN: ${subjectName} | KURIKULUM: KURIKULUM MERDEKA / NASIONAL | TANGGAL: ${new Date().toLocaleDateString('id-ID')}</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 6%; text-align: center;">No Soal</th>
                        <th style="width: 25%;">Kompetensi Dasar / Capaian Pembelajaran</th>
                        <th style="width: 15%;">Materi Pokok</th>
                        <th style="width: 25%;">Indikator Soal</th>
                        <th style="width: 8%; text-align: center;">Level Kognitif</th>
                        <th style="width: 11%; text-align: center;">Dimensi Proses Kognitif</th>
                        <th style="width: 6%; text-align: center;">Kategori</th>
                        <th style="width: 8%; text-align: center;">Bentuk Soal</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </body>
        </html>
    `);
    printWindow.document.close();
}

function printNaskahSoalPortrait() {
    const data = window.lastGeneratedExamData;
    if (!data || !data.questions) return;

    const subjectName = window.lastGeneratedExamSubjectName || '';
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Gagal membuka jendela cetak. Pastikan pop-up blocker dinonaktifkan.');
        return;
    }

    let mcHtml = '';
    let essayHtml = '';

    const mcQuestions = data.questions.filter(q => q.type === 'mc');
    const essayQuestions = data.questions.filter(q => q.type !== 'mc');

    if (mcQuestions.length > 0) {
        mcHtml += '<h3>Bagian A: Pilihan Ganda</h3><ol>';
        mcQuestions.forEach((q) => {
            const optionsList = (q.options || []).map(opt => `<li>${escapeHtml(opt)}</li>`).join('');
            const ansKey = q.answer || 'A';
            mcHtml += `
                <li style="margin-bottom: 15px;">
                    <div style="font-weight: bold; margin-bottom: 5px;">${escapeHtml(q.question)}</div>
                    <ul style="list-style-type: none; padding-left: 0; margin-top: 5px;">
                        ${optionsList}
                    </ul>
                    <div style="margin-top: 4px; font-weight: bold; color: #047857; font-size: 11px;">Kunci Jawaban: ${escapeHtml(ansKey)}</div>
                </li>
            `;
        });
        mcHtml += '</ol>';
    }

    if (essayQuestions.length > 0) {
        essayHtml += '<h3>Bagian B: Essay / Uraian</h3><ol>';
        essayQuestions.forEach((q) => {
            const ansKey = q.answer || 'Jawaban Esay';
            essayHtml += `
                <li style="margin-bottom: 20px;">
                    <div style="font-weight: bold;">${escapeHtml(q.question)}</div>
                    <div style="margin-top: 4px; font-weight: bold; color: #047857; font-size: 11px;">Kunci Jawaban: ${escapeHtml(ansKey)}</div>
                </li>
            `;
        });
        essayHtml += '</ol>';
    }

    printWindow.document.write(`
        <html>
        <head>
            <title>Naskah Soal Ujian - ${subjectName}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
            <style>
                @page {
                    size: portrait;
                    margin: 2cm;
                }
                body {
                    font-family: 'Times New Roman', Times, serif;
                    color: #000;
                    line-height: 1.5;
                    font-size: 13px;
                    margin: 0;
                    padding: 0;
                }
                .header {
                    text-align: center;
                    border-bottom: 3px double #000;
                    padding-bottom: 10px;
                    margin-bottom: 20px;
                }
                .header h2 {
                    margin: 0;
                    font-size: 16px;
                    text-transform: uppercase;
                }
                .header p {
                    margin: 5px 0 0 0;
                    font-size: 12px;
                }
                h3 {
                    border-bottom: 1px solid #000;
                    padding-bottom: 3px;
                    margin-top: 25px;
                    font-size: 14px;
                    text-transform: uppercase;
                }
                ol {
                    padding-left: 20px;
                }
                ul li {
                    margin-bottom: 4px;
                }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <div class="header">
                <h2>NASKAH SOAL UJIAN MADRASAH ALIYAH</h2>
                <p><strong>MATA PELAJARAN: ${subjectName}</strong> | KURIKULUM: KURIKULUM MERDEKA / NASIONAL</p>
            </div>
            ${mcHtml}
            ${essayHtml}
        </body>
        </html>
    `);
    printWindow.document.close();
}

function escapeHtml(text) {
    if (!text) return '';
    let escaped = String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

    // Check if the string contains LaTeX math delimiters
    if (escaped.includes('$') || escaped.includes('\\(') || escaped.includes('\\[') || escaped.includes('\\\\(') || escaped.includes('\\\\[')) {
        if (typeof window.katex !== 'undefined') {
            try {
                // Pre-render LaTeX into safe HTML structures
                const tryRender = (latex, displayMode) => {
                    try {
                        return window.katex.renderToString(latex, {
                            displayMode: displayMode,
                            throwOnError: false
                        });
                    } catch (e) {
                        return latex;
                    }
                };

                // Replace $$ ... $$
                escaped = escaped.replace(/\$\$(.*?)\$\$/gs, (match, latex) => tryRender(latex, true));
                // Replace \[ ... \]
                escaped = escaped.replace(/\\\[(.*?)\\\]/gs, (match, latex) => tryRender(latex, true));
                escaped = escaped.replace(/\\\\\[(.*?)\\\\\]/gs, (match, latex) => tryRender(latex, true));
                // Replace $ ... $
                escaped = escaped.replace(/\$(.*?)\$/g, (match, latex) => tryRender(latex, false));
                // Replace \( ... \)
                escaped = escaped.replace(/\\\((.*?)\\\)/g, (match, latex) => tryRender(latex, false));
                escaped = escaped.replace(/\\\\\((.*?)\\\\\)/g, (match, latex) => tryRender(latex, false));
            } catch (e) {
                console.warn('Katex escapeHtml rendering error:', e);
            }
        }
    }
    return escaped;
}
window.escapeHtml = escapeHtml;

function saveGeneratedExamPackage(subjectId) {
    if (!window.lastGeneratedExamData) {
        showToast('Tidak ada data soal untuk disimpan', 'error');
        return;
    }
    
    const subject = appState.subjects ? appState.subjects.find(s => String(s.id) === String(subjectId)) : null;
    const subjectName = subject ? subject.name : 'Mata Pelajaran';
    
    const mcCount = window.lastGeneratedExamMcCount || 10;
    const essayCount = window.lastGeneratedExamEssayCount || 5;
    const difficulty = window.lastGeneratedExamDifficulty || 'sedang';
    const difficultyLabels = { mudah: 'Mudah', sedang: 'Sedang', sulit: 'Sulit' };
    const diffLabel = difficultyLabels[difficulty] || 'Sedang';

    const title = `Paket Soal ${subjectName} (${diffLabel}) - ${mcCount} PG, ${essayCount} Essay`;
    
    if (!appState.generatedExams) {
        appState.generatedExams = JSON.parse(localStorage.getItem('madrasah_generated_exams')) || [];
    }
    
    const newExam = {
        id: 'GE_' + Date.now(),
        subjectId: subjectId,
        subjectName: subjectName,
        title: title,
        difficulty: difficulty,
        mcCount: mcCount,
        essayCount: essayCount,
        optionCount: window.lastGeneratedExamOptionCount || 5,
        questions: window.lastGeneratedExamData.questions || [],
        createdAt: new Date().toISOString()
    };
    
    appState.generatedExams.push(newExam);
    saveState('generatedExams');
    
    // Change button to saved state
    const btnContainer = document.getElementById('save-exam-btn-container');
    if (btnContainer) {
        btnContainer.innerHTML = `
            <span class="px-4 py-2 bg-emerald-50 text-emerald-700 border border-emerald-100 text-xs font-bold rounded-2xl flex items-center space-x-1.5">
                <i class="fa-solid fa-circle-check"></i>
                <span>Tersimpan di Bank Soal</span>
            </span>
        `;
    }
    
    showToast('Paket Soal berhasil disimpan!', 'success');
    
    // Re-render modul ajar module behind so the list updates!
    const mainContent = document.getElementById('view-container');
    if (mainContent) {
        renderModulAjarModule(mainContent);
    }
}

function deleteGeneratedExam(examId) {
    showConfirmModal('Apakah Anda yakin ingin menghapus paket soal ini?', async () => {
        if (!appState.generatedExams) {
            appState.generatedExams = JSON.parse(localStorage.getItem('madrasah_generated_exams')) || [];
        }
        appState.generatedExams = appState.generatedExams.filter(ex => String(ex.id) !== String(examId));
        saveState('generatedExams');
        try {
            const response = await fetch(`/api/generated-exams/${encodeURIComponent(examId)}`, { method: 'DELETE' });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
        } catch (err) {
            console.warn('Gagal menghapus paket soal di server:', err);
        }
        
        showToast('Paket Soal berhasil dihapus', 'success');
        
        const mainContent = document.getElementById('view-container');
        if (mainContent) {
            renderModulAjarModule(mainContent);
        }
    });
}

function openPreviewExamModal(examId) {
    if (!appState.generatedExams) {
        appState.generatedExams = JSON.parse(localStorage.getItem('madrasah_generated_exams')) || [];
    }
    const exam = appState.generatedExams.find(ex => String(ex.id) === String(examId));
    if (!exam) {
        showToast('Paket soal tidak ditemukan', 'error');
        return;
    }

    window.lastGeneratedExamData = { questions: exam.questions };
    window.lastGeneratedExamSubjectName = exam.subjectName;

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div id="modal-content-box" class="bg-white w-full max-w-6xl rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col h-[90vh] overflow-hidden transition-all duration-300">
                <div id="modal-body-content" class="flex-1 overflow-hidden flex flex-col">
                    <!-- Loaded dynamically below -->
                </div>
            </div>
        </div>
    `;

    let questionsListHtml = '';
    let kisiRowsHtml = '';

    const questions = exam.questions || [];

    questions.forEach((q, idx) => {
        const k = q.kisiKisi || {};
        const qNum = q.no || (idx + 1);

        if (q.type === 'mc') {
            const optionsMarkup = (q.options || []).map(opt => `
                <div class="flex items-start space-x-2 text-xs text-slate-600 pl-2">
                    <span class="font-bold text-slate-800">${opt.trim().substring(0, 1)}</span>
                    <span>${opt.trim().substring(1).replace(/^\.\s*/, '')}</span>
                </div>
            `).join('');

            questionsListHtml += `
                <div class="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-100 text-[10px] font-bold rounded-lg uppercase">SOAL ${qNum} | PILIHAN GANDA</span>
                        <span class="text-[10px] text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">Kunci: ${q.answer}</span>
                    </div>
                    <h5 class="text-xs sm:text-sm font-bold text-slate-800">${q.question}</h5>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        ${optionsMarkup}
                    </div>
                    ${q.explanation ? `
                        <div class="mt-2 text-[10px] text-slate-500 bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                            <span class="font-bold text-slate-700 uppercase">Pembahasan / Penjelasan:</span> ${q.explanation}
                        </div>
                    ` : ''}
                </div>
            `;
        } else {
            questionsListHtml += `
                <div class="p-4 bg-slate-50/50 rounded-2xl border border-slate-100 space-y-2">
                    <div class="flex items-center justify-between">
                        <span class="px-2.5 py-1 bg-violet-50 text-violet-700 border border-violet-100 text-[10px] font-bold rounded-lg uppercase">SOAL ${qNum} | ESSAY / URAIAN</span>
                    </div>
                    <h5 class="text-xs sm:text-sm font-bold text-slate-800">${q.question}</h5>
                    <div class="mt-2 text-[11px] text-slate-600 bg-violet-50/30 p-3 rounded-xl border border-violet-100/60">
                        <span class="font-bold text-violet-800 uppercase block text-[10px] mb-1">Rekomendasi Kunci Jawaban / Kisi Jawaban:</span>
                        ${q.answer || '-'}
                    </div>
                    ${q.explanation ? `
                        <div class="mt-2 text-[10px] text-slate-500 bg-slate-100 p-2.5 rounded-xl border border-slate-200">
                            <span class="font-bold text-slate-700 uppercase">Rubrik Penilaian:</span> ${q.explanation}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        kisiRowsHtml += `
            <tr class="hover:bg-slate-50 transition text-slate-700">
                <td class="border border-slate-200 p-2 text-center font-bold text-slate-800">${qNum}</td>
                <td class="border border-slate-200 p-2">${escapeHtml(k.kompetensiDasar || 'Memahami konsep modul ajar')}</td>
                <td class="border border-slate-200 p-2 font-semibold text-slate-800">${escapeHtml(k.materi || 'Materi Inti')}</td>
                <td class="border border-slate-200 p-2 text-slate-600">${escapeHtml(k.indikator || 'Siswa dapat menganalisis persoalan secara bijaksana')}</td>
                <td class="border border-slate-200 p-2 text-center font-bold text-amber-700">${escapeHtml(k.levelKognitif || 'L2')}</td>
                <td class="border border-slate-200 p-2 text-center text-slate-600">${escapeHtml(k.dimensiProsesKognitif || 'Memahami')}</td>
                <td class="border border-slate-200 p-2 text-center font-bold text-indigo-700">${escapeHtml(k.kategori || 'C2')}</td>
                <td class="border border-slate-200 p-2 text-center font-medium">${escapeHtml(k.bentukSoal || (q.type === 'mc' ? 'Pilihan Ganda' : 'Essay'))}</td>
            </tr>
        `;
    });

    const modalBodyBox = document.getElementById('modal-body-content');
    if (modalBodyBox) {
        modalBodyBox.innerHTML = `
            <!-- Modal Header -->
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-2 shrink-0">
                <div class="flex items-center space-x-2.5">
                    <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <i class="fa-solid fa-file-invoice text-sm"></i>
                    </div>
                    <div>
                        <h3 class="font-extrabold text-slate-800 text-sm sm:text-base">${exam.title}</h3>
                        <p class="text-[10px] text-slate-400 font-medium">Mata Pelajaran: <span class="text-indigo-600 font-bold">${exam.subjectName}</span></p>
                    </div>
                </div>
                
                <!-- Tab Toggle & Action Buttons -->
                <div class="flex items-center space-x-2">
                    <button type="button" id="gen-btn-soal-tab" onclick="switchGenerateResultTab('soal')" class="px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 text-white shadow-sm transition">
                        Naskah Soal Ujian
                    </button>
                    <button type="button" id="gen-btn-kisi-tab" onclick="switchGenerateResultTab('kisi')" class="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
                        Matriks Kisi-Kisi
                    </button>
                    <button type="button" id="gen-btn-kunci-tab" onclick="switchGenerateResultTab('kunci')" class="px-4 py-2 text-xs font-bold rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition">
                        Kunci Jawaban
                    </button>
                </div>
            </div>

            <!-- Scrollable Content -->
            <div class="flex-1 min-h-0 overflow-y-auto py-6 pr-1 space-y-6">
                <!-- Tab 1: Soal Tab -->
                <div id="gen-soal-tab-content" class="space-y-4">
                    <div class="flex items-center justify-between">
                        <div class="text-left">
                            <h4 class="text-sm font-bold text-slate-800">Pratinjau Lembar Soal Ujian</h4>
                            <p class="text-[10px] text-slate-400">Silakan cetak lembar soal ini ke dalam dokumen portrait</p>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button type="button" onclick="downloadExamQuestionsAsWord('${exam.id}')" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-md" title="Unduh Naskah Soal Word">
                                <i class="fa-solid fa-file-word"></i>
                                <span>Unduh Soal (.doc)</span>
                            </button>
                            <button type="button" onclick="downloadExamAnswerKeyAsWord('${exam.id}')" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-md" title="Unduh Khusus Kunci Jawaban Word">
                                <i class="fa-solid fa-key"></i>
                                <span>Unduh Kunci Jawaban (.doc)</span>
                            </button>
                            <button type="button" onclick="printNaskahSoalPortrait()" class="px-3.5 py-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-sm">
                                <i class="fa-solid fa-print"></i>
                                <span>Cetak Naskah Soal</span>
                            </button>
                        </div>
                    </div>
                    <div class="space-y-3">
                        ${questionsListHtml}
                    </div>
                </div>

                <!-- Tab 2: Kisi Tab -->
                <div id="gen-kisi-tab-content" class="space-y-4 hidden">
                    <div class="flex items-center justify-between">
                        <div class="text-left">
                            <h4 class="text-sm font-bold text-slate-800">Pratinjau Matriks Kisi-Kisi</h4>
                            <p class="text-[10px] text-slate-400">Lembar kerja dirancang dalam format Landscape otomatis</p>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button type="button" onclick="downloadExamKisiAsWord('${exam.id}')" class="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-md">
                                <i class="fa-solid fa-file-word"></i>
                                <span>Unduh Kisi-Kisi (.doc)</span>
                            </button>
                            <button type="button" onclick="printKisiKisiLandscape()" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-md">
                                <i class="fa-solid fa-print"></i>
                                <span>Cetak Kisi-Kisi (Landscape)</span>
                            </button>
                        </div>
                    </div>

                    <!-- Landscape Table Container -->
                    <div class="overflow-x-auto border border-slate-150 rounded-2xl bg-slate-50 p-4">
                        <div class="min-w-[1100px] bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 font-sans space-y-4">
                            <div class="text-center space-y-1 pb-4 border-b border-slate-100">
                                <h3 class="text-sm font-extrabold text-slate-800 uppercase tracking-wider">MATRIKS KISI-KISI PENULISAN SOAL UJIAN</h3>
                                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mata Pelajaran: ${exam.subjectName} | Kurikulum: Kurikulum Merdeka / Nasional</p>
                            </div>
                            <table class="w-full text-left border-collapse border border-slate-200 text-[10px]">
                                <thead>
                                    <tr class="bg-slate-50 text-slate-700 font-bold uppercase tracking-wider">
                                        <th class="border border-slate-200 p-2.5 text-center w-12">No Soal</th>
                                        <th class="border border-slate-200 p-2.5">Kompetensi Dasar / Capaian Pembelajaran</th>
                                        <th class="border border-slate-200 p-2.5">Materi Pokok</th>
                                        <th class="border border-slate-200 p-2.5">Indikator Soal</th>
                                        <th class="border border-slate-200 p-2.5 text-center w-20">Level Kognitif</th>
                                        <th class="border border-slate-200 p-2.5 text-center w-28">Dimensi Proses Kognitif</th>
                                        <th class="border border-slate-200 p-2.5 text-center w-16">Kategori</th>
                                        <th class="border border-slate-200 p-2.5 text-center w-24">Bentuk Soal</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    ${kisiRowsHtml}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <!-- Tab 3: Kunci Tab -->
                <div id="gen-kunci-tab-content" class="space-y-4 hidden">
                    <div class="flex items-center justify-between">
                        <div class="text-left">
                            <h4 class="text-sm font-bold text-slate-800">Pratinjau Kunci Jawaban & Rubrik Penilaian</h4>
                            <p class="text-[10px] text-slate-400">Khusus kunci jawaban pilihan ganda, essay, dan pedoman penskoran</p>
                        </div>
                        <div class="flex items-center space-x-2">
                            <button type="button" onclick="downloadExamAnswerKeyAsWord('${exam.id}')" class="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-md">
                                <i class="fa-solid fa-file-word"></i>
                                <span>Unduh Kunci Jawaban (.doc)</span>
                            </button>
                            <button type="button" onclick="printKunciJawabanPortrait()" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer shadow-md">
                                <i class="fa-solid fa-print"></i>
                                <span>Cetak Kunci Jawaban</span>
                            </button>
                        </div>
                    </div>

                    <!-- Kunci Jawaban Preview Container -->
                    <div class="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-4">
                        <div class="bg-white p-6 sm:p-8 rounded-2xl shadow-sm border border-slate-100 font-sans space-y-6">
                            <div class="text-center space-y-1 pb-4 border-b border-slate-100">
                                <h3 class="text-sm font-extrabold text-slate-800 uppercase tracking-wider">KUNCI JAWABAN & PEDOMAN PENSKORAN UJIAN</h3>
                                <p class="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Mata Pelajaran: ${exam.subjectName} | Kurikulum: Kurikulum Merdeka / Nasional</p>
                            </div>

                            ${questions.filter(q => q.type === 'mc').length > 0 ? `
                                <div class="space-y-3">
                                    <h4 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider pb-1 border-b border-slate-100">Bagian A: Kunci Jawaban Pilihan Ganda</h4>
                                    <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2">
                                        ${questions.filter(q => q.type === 'mc').map((q, idx) => `
                                            <div class="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-center space-y-0.5">
                                                <div class="text-[10px] font-bold text-slate-400">No. ${q.no || (idx + 1)}</div>
                                                <div class="text-sm font-black text-emerald-600">${q.answer || 'A'}</div>
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}

                            ${questions.filter(q => q.type !== 'mc').length > 0 ? `
                                <div class="space-y-3 pt-2">
                                    <h4 class="text-xs font-extrabold text-slate-800 uppercase tracking-wider pb-1 border-b border-slate-100">Bagian B: Kunci Jawaban & Rubrik Essay / Uraian</h4>
                                    <div class="space-y-3">
                                        ${questions.filter(q => q.type !== 'mc').map((q, idx) => `
                                            <div class="p-3 bg-violet-50/40 rounded-xl border border-violet-100 space-y-1">
                                                <div class="flex items-center justify-between text-[11px] font-bold text-violet-900">
                                                    <span>Soal No. ${q.no || (questions.filter(q => q.type === 'mc').length + idx + 1)}</span>
                                                </div>
                                                <p class="text-xs text-slate-700 italic">${escapeHtml(q.question)}</p>
                                                <div class="pt-1 text-xs">
                                                    <span class="font-bold text-emerald-700 block text-[10px] uppercase">Rekomendasi Jawaban:</span>
                                                    <span class="text-slate-800 font-medium">${escapeHtml(q.answer || '-')}</span>
                                                </div>
                                                ${q.explanation ? `
                                                    <div class="pt-1 text-[10px] text-slate-500">
                                                        <span class="font-bold text-slate-700 uppercase">Rubrik Penilaian:</span> ${escapeHtml(q.explanation)}
                                                    </div>
                                                ` : ''}
                                            </div>
                                        `).join('')}
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <!-- Footer Actions -->
            <div class="flex justify-end pt-4 border-t border-slate-100 shrink-0">
                <button type="button" onclick="closeModal()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition shadow-sm cursor-pointer">
                    Tutup
                </button>
            </div>
        `;
    }
}

function getExamData(examId) {
    if (typeof examId === 'object' && examId !== null) return examId;
    if (!appState.generatedExams) {
        appState.generatedExams = JSON.parse(localStorage.getItem('madrasah_generated_exams')) || [];
    }
    let exam = appState.generatedExams.find(ex => String(ex.id) === String(examId));
    if (!exam && window.lastGeneratedExamData) {
        exam = {
            id: examId || 'TEMP',
            title: window.lastGeneratedExamTitle || 'Paket_Soal',
            subjectName: window.lastGeneratedExamSubjectName || 'Mata Pelajaran',
            questions: window.lastGeneratedExamData.questions || []
        };
    }
    return exam;
}

function downloadExamQuestionsAsWord(examId) {
    const exam = getExamData(examId);
    if (!exam || !exam.questions) {
        showToast('Naskah soal tidak ditemukan', 'error');
        return;
    }

    let mcHtml = '';
    let essayHtml = '';

    const mcQuestions = exam.questions.filter(q => q.type === 'mc');
    const essayQuestions = exam.questions.filter(q => q.type !== 'mc');

    if (mcQuestions.length > 0) {
        mcHtml += '<h2>Bagian A: Pilihan Ganda</h2><ol>';
        mcQuestions.forEach((q) => {
            const optionsList = (q.options || []).map(opt => `<li style="margin-bottom: 3px;">${escapeHtml(opt)}</li>`).join('');
            mcHtml += `
                <li style="margin-bottom: 15px;">
                    <div style="font-weight: bold; margin-bottom: 5px;">${escapeHtml(q.question)}</div>
                    <ul style="list-style-type: none; padding-left: 15px; margin-top: 5px;">
                        ${optionsList}
                    </ul>
                </li>
            `;
        });
        mcHtml += '</ol>';
    }

    if (essayQuestions.length > 0) {
        essayHtml += '<h2>Bagian B: Essay / Uraian</h2><ol>';
        essayQuestions.forEach((q) => {
            essayHtml += `
                <li style="margin-bottom: 25px;">
                    <div style="font-weight: bold;">${escapeHtml(q.question)}</div>
                </li>
            `;
        });
        essayHtml += '</ol>';
    }

    const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <title>Naskah Soal - ${exam.title}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
            <style>
                body { font-family: 'Times New Roman', serif; line-height: 1.5; font-size: 12pt; }
                .header { text-align: center; margin-bottom: 20px; border-bottom: 3px double #000000; padding-bottom: 8px; }
                .header h1 { margin: 0; font-size: 16pt; text-transform: uppercase; }
                .header p { margin: 5px 0 0 0; font-size: 11pt; }
                h2 { font-size: 13pt; text-transform: uppercase; border-bottom: 1px solid #000000; padding-bottom: 3px; margin-top: 25px; }
                ol { padding-left: 20px; }
                ul { list-style-type: none; padding-left: 0; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>NASKAH SOAL UJIAN MADRASAH ALIYAH</h1>
                <p><strong>MATA PELAJARAN: ${exam.subjectName || ''}</strong> | KURIKULUM: KURIKULUM MERDEKA / NASIONAL</p>
                <p>${exam.title || ''}</p>
            </div>
            ${mcHtml}
            ${essayHtml}
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], {
        type: 'application/msword'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Naskah_Soal_${(exam.title || exam.subjectName || 'Ujian').replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Naskah Soal (Word) berhasil diunduh!', 'success');
}

function downloadExamKisiAsWord(examId) {
    const exam = getExamData(examId);
    if (!exam || !exam.questions) {
        showToast('Kisi-kisi tidak ditemukan', 'error');
        return;
    }

    let kisiRowsHtml = '';
    exam.questions.forEach((q, idx) => {
        const k = q.kisiKisi || {};
        const qNum = q.no || (idx + 1);
        kisiRowsHtml += `
            <tr>
                <td style="border: 1px solid #000000; padding: 6px; text-align: center; font-weight: bold;">${qNum}</td>
                <td style="border: 1px solid #000000; padding: 6px;">${escapeHtml(k.kompetensiDasar || 'Memahami konsep modul ajar')}</td>
                <td style="border: 1px solid #000000; padding: 6px; font-weight: bold;">${escapeHtml(k.materi || 'Materi Inti')}</td>
                <td style="border: 1px solid #000000; padding: 6px;">${escapeHtml(k.indikator || 'Siswa dapat menganalisis persoalan secara bijaksana')}</td>
                <td style="border: 1px solid #000000; padding: 6px; text-align: center; font-weight: bold;">${escapeHtml(k.levelKognitif || 'L2')}</td>
                <td style="border: 1px solid #000000; padding: 6px; text-align: center;">${escapeHtml(k.dimensiProsesKognitif || 'Memahami')}</td>
                <td style="border: 1px solid #000000; padding: 6px; text-align: center; font-weight: bold;">${escapeHtml(k.kategori || 'C2')}</td>
                <td style="border: 1px solid #000000; padding: 6px; text-align: center;">${escapeHtml(k.bentukSoal || (q.type === 'mc' ? 'Pilihan Ganda' : 'Essay'))}</td>
            </tr>
        `;
    });

    const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <title>Kisi-Kisi - ${exam.title}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
            <style>
                @page Section1 { size: 11.0in 8.5in; mso-page-orientation: landscape; margin: 1.0in; }
                div.Section1 { page: Section1; }
                body { font-family: 'Times New Roman', serif; line-height: 1.4; font-size: 11pt; }
                .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000000; padding-bottom: 8px; }
                .header h1 { margin: 0; font-size: 15pt; text-transform: uppercase; }
                .header p { margin: 5px 0 0 0; font-size: 10pt; }
                table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 15px; }
                th { background-color: #f2f2f2; border: 1px solid #000000; padding: 6px; text-align: left; font-weight: bold; text-transform: uppercase; }
                td { border: 1px solid #000000; padding: 6px; vertical-align: top; }
            </style>
        </head>
        <body>
            <div class="Section1">
                <div class="header">
                    <h1>MATRIKS KISI-KISI PENULISAN SOAL UJIAN</h1>
                    <p><strong>MATA PELAJARAN: ${exam.subjectName || ''}</strong> | KURIKULUM: KURIKULUM MERDEKA / NASIONAL</p>
                    <p>${exam.title || ''}</p>
                </div>
                <table>
                    <thead>
                        <tr>
                            <th style="width: 6%; text-align: center;">No</th>
                            <th style="width: 25%;">Kompetensi Dasar / Capaian Pembelajaran</th>
                            <th style="width: 15%;">Materi Pokok</th>
                            <th style="width: 25%;">Indikator Soal</th>
                            <th style="width: 8%; text-align: center;">Level</th>
                            <th style="width: 11%; text-align: center;">Dimensi</th>
                            <th style="width: 6%; text-align: center;">Kategori</th>
                            <th style="width: 8%; text-align: center;">Bentuk</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${kisiRowsHtml}
                    </tbody>
                </table>
            </div>
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], {
        type: 'application/msword'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kisi_Kisi_${(exam.title || exam.subjectName || 'Ujian').replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Kisi-Kisi (Word) berhasil diunduh!', 'success');
}

function downloadExamAnswerKeyAsWord(examId) {
    const exam = getExamData(examId);
    if (!exam || !exam.questions) {
        showToast('Kunci jawaban tidak ditemukan', 'error');
        return;
    }

    const mcQuestions = exam.questions.filter(q => q.type === 'mc');
    const essayQuestions = exam.questions.filter(q => q.type !== 'mc');

    let mcTableRows = '';
    mcQuestions.forEach((q, idx) => {
        const qNum = q.no || (idx + 1);
        const ansKey = q.answer || 'A';
        const exp = q.explanation || '-';
        mcTableRows += `
            <tr>
                <td style="border: 1px solid #000000; padding: 6px; text-align: center; font-weight: bold;">${qNum}</td>
                <td style="border: 1px solid #000000; padding: 6px; text-align: center; font-weight: bold; color: #047857;">${escapeHtml(ansKey)}</td>
                <td style="border: 1px solid #000000; padding: 6px;">${escapeHtml(exp)}</td>
            </tr>
        `;
    });

    let mcSection = '';
    if (mcQuestions.length > 0) {
        mcSection = `
            <h2>BAGIAN A: KUNCI JAWABAN PILIHAN GANDA</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 11pt; margin-top: 10px;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="border: 1px solid #000000; padding: 8px; width: 10%; text-align: center;">No.</th>
                        <th style="border: 1px solid #000000; padding: 8px; width: 20%; text-align: center;">Kunci Jawaban</th>
                        <th style="border: 1px solid #000000; padding: 8px; width: 70%;">Penjelasan / Pembahasan</th>
                    </tr>
                </thead>
                <tbody>
                    ${mcTableRows}
                </tbody>
            </table>
        `;
    }

    let essayList = '';
    essayQuestions.forEach((q, idx) => {
        const qNum = q.no || (mcQuestions.length + idx + 1);
        const ansKey = q.answer || '-';
        const rubrik = q.explanation || 'Jawaban sesuai indikator pembelajaran.';
        essayList += `
            <div style="margin-bottom: 18px; padding: 10px; border: 1px solid #cccccc; background-color: #fafafa;">
                <p style="margin: 0 0 6px 0; font-weight: bold;">Soal No. ${qNum}:</p>
                <p style="margin: 0 0 8px 0; font-style: italic; color: #333333;">${escapeHtml(q.question)}</p>
                <p style="margin: 0 0 4px 0; font-weight: bold; color: #047857;">Kunci / Pedoman Jawaban:</p>
                <p style="margin: 0 0 8px 0;">${escapeHtml(ansKey)}</p>
                <p style="margin: 0 0 2px 0; font-weight: bold; color: #4338ca; font-size: 10pt;">Rubrik Penilaian / Catatan:</p>
                <p style="margin: 0; font-size: 10pt; color: #4b5563;">${escapeHtml(rubrik)}</p>
            </div>
        `;
    });

    let essaySection = '';
    if (essayQuestions.length > 0) {
        essaySection = `
            <h2>BAGIAN B: KUNCI JAWABAN & RUBRIK ESSAY / URAIAN</h2>
            <div style="margin-top: 10px;">
                ${essayList}
            </div>
        `;
    }

    const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <title>Kunci Jawaban - ${exam.title || exam.subjectName}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
            <style>
                body { font-family: 'Times New Roman', serif; line-height: 1.5; font-size: 12pt; }
                .header { text-align: center; margin-bottom: 20px; border-bottom: 3px double #000000; padding-bottom: 8px; }
                .header h1 { margin: 0; font-size: 16pt; text-transform: uppercase; }
                .header p { margin: 5px 0 0 0; font-size: 11pt; }
                h2 { font-size: 13pt; text-transform: uppercase; border-bottom: 1px solid #000000; padding-bottom: 3px; margin-top: 25px; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>KUNCI JAWABAN & PEDOMAN PENSKORAN UJIAN</h1>
                <p><strong>MATA PELAJARAN: ${exam.subjectName || ''}</strong> | KURIKULUM: KURIKULUM MERDEKA / NASIONAL</p>
                <p>${exam.title || ''}</p>
            </div>
            ${mcSection}
            ${essaySection}
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], {
        type: 'application/msword'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kunci_Jawaban_${(exam.title || exam.subjectName || 'Ujian').replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Kunci Jawaban (Word) berhasil diunduh!', 'success');
}

function printKunciJawabanPortrait() {
    const data = window.lastGeneratedExamData;
    if (!data || !data.questions) return;

    const subjectName = window.lastGeneratedExamSubjectName || '';
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Gagal membuka jendela cetak. Pastikan pop-up blocker dinonaktifkan.');
        return;
    }

    const mcQuestions = data.questions.filter(q => q.type === 'mc');
    const essayQuestions = data.questions.filter(q => q.type !== 'mc');

    let mcTableRows = '';
    mcQuestions.forEach((q, idx) => {
        const qNum = q.no || (idx + 1);
        const ansKey = q.answer || 'A';
        const exp = q.explanation || '-';
        mcTableRows += `
            <tr>
                <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold;">${qNum}</td>
                <td style="border: 1px solid #000; padding: 6px; text-align: center; font-weight: bold; color: #047857;">${escapeHtml(ansKey)}</td>
                <td style="border: 1px solid #000; padding: 6px;">${escapeHtml(exp)}</td>
            </tr>
        `;
    });

    let mcSection = '';
    if (mcQuestions.length > 0) {
        mcSection = `
            <h3>BAGIAN A: KUNCI JAWABAN PILIHAN GANDA</h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 10px;">
                <thead>
                    <tr style="background-color: #f2f2f2;">
                        <th style="border: 1px solid #000; padding: 6px; width: 10%; text-align: center;">No.</th>
                        <th style="border: 1px solid #000; padding: 6px; width: 20%; text-align: center;">Kunci</th>
                        <th style="border: 1px solid #000; padding: 6px; width: 70%;">Pembahasan</th>
                    </tr>
                </thead>
                <tbody>
                    ${mcTableRows}
                </tbody>
            </table>
        `;
    }

    let essayList = '';
    essayQuestions.forEach((q, idx) => {
        const qNum = q.no || (mcQuestions.length + idx + 1);
        const ansKey = q.answer || '-';
        const rubrik = q.explanation || 'Jawaban sesuai indikator.';
        essayList += `
            <div style="margin-bottom: 15px; padding: 8px; border: 1px solid #ddd;">
                <p style="margin: 0 0 4px 0; font-weight: bold;">Soal No. ${qNum}: ${escapeHtml(q.question)}</p>
                <p style="margin: 0 0 4px 0; font-weight: bold; color: #047857;">Kunci Jawaban: ${escapeHtml(ansKey)}</p>
                <p style="margin: 0; font-size: 11px; color: #555;">Rubrik: ${escapeHtml(rubrik)}</p>
            </div>
        `;
    });

    let essaySection = '';
    if (essayQuestions.length > 0) {
        essaySection = `
            <h3>BAGIAN B: KUNCI JAWABAN & RUBRIK ESSAY</h3>
            ${essayList}
        `;
    }

    printWindow.document.write(`
        <html>
        <head>
            <title>Kunci Jawaban - ${subjectName}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
            <style>
                @page { size: portrait; margin: 2cm; }
                body { font-family: 'Times New Roman', serif; line-height: 1.5; font-size: 12px; color: #000; }
                .header { text-align: center; border-bottom: 3px double #000; padding-bottom: 8px; margin-bottom: 20px; }
                .header h2 { margin: 0; font-size: 16px; text-transform: uppercase; }
                .header p { margin: 4px 0 0 0; font-size: 11px; }
                h3 { border-bottom: 1px solid #000; padding-bottom: 3px; margin-top: 20px; font-size: 13px; text-transform: uppercase; }
            </style>
        </head>
        <body onload="window.print(); window.close();">
            <div class="header">
                <h2>KUNCI JAWABAN & PEDOMAN PENSKORAN UJIAN</h2>
                <p><strong>MATA PELAJARAN: ${subjectName}</strong> | KURIKULUM MERDEKA / NASIONAL</p>
            </div>
            ${mcSection}
            ${essaySection}
        </body>
        </html>
    `);
    printWindow.document.close();
}

function downloadExamAsWord(examId) {
    const exam = getExamData(examId);
    if (!exam) {
        showToast('Paket soal tidak ditemukan', 'error');
        return;
    }

    let mcHtml = '';
    let essayHtml = '';

    const mcQuestions = exam.questions.filter(q => q.type === 'mc');
    const essayQuestions = exam.questions.filter(q => q.type !== 'mc');

    if (mcQuestions.length > 0) {
        mcHtml += '<h2>Bagian A: Pilihan Ganda</h2><ol>';
        mcQuestions.forEach((q) => {
            const optionsList = (q.options || []).map(opt => `<li>${escapeHtml(opt)}</li>`).join('');
            const ansKey = q.answer || 'A';
            mcHtml += `
                <li style="margin-bottom: 15px;">
                    <div style="font-weight: bold; margin-bottom: 5px;">${escapeHtml(q.question)}</div>
                    <ul style="list-style-type: none; padding-left: 0; margin-top: 5px;">
                        ${optionsList}
                    </ul>
                    <p style="margin-top: 4px; font-weight: bold; color: #047857;"><b>Kunci Jawaban:</b> ${escapeHtml(ansKey)}</p>
                </li>
            `;
        });
        mcHtml += '</ol>';
    }

    if (essayQuestions.length > 0) {
        essayHtml += '<h2>Bagian B: Essay / Uraian</h2><ol>';
        essayQuestions.forEach((q) => {
            const ansKey = q.answer || 'Jawaban Esay';
            essayHtml += `
                <li style="margin-bottom: 20px;">
                    <div style="font-weight: bold;">${escapeHtml(q.question)}</div>
                    <p style="margin-top: 4px; font-weight: bold; color: #047857;"><b>Kunci Jawaban:</b> ${escapeHtml(ansKey)}</p>
                </li>
            `;
        });
        essayHtml += '</ol>';
    }

    let kisiRowsHtml = '';
    exam.questions.forEach((q, idx) => {
        const k = q.kisiKisi || {};
        const qNum = q.no || (idx + 1);
        kisiRowsHtml += `
            <tr>
                <td style="border: 1px solid #000000; padding: 6px; text-align: center; font-weight: bold;">${qNum}</td>
                <td style="border: 1px solid #000000; padding: 6px;">${escapeHtml(k.kompetensiDasar || 'Memahami konsep modul ajar')}</td>
                <td style="border: 1px solid #000000; padding: 6px; font-weight: bold;">${escapeHtml(k.materi || 'Materi Inti')}</td>
                <td style="border: 1px solid #000000; padding: 6px;">${escapeHtml(k.indikator || 'Siswa dapat menganalisis persoalan secara bijaksana')}</td>
                <td style="border: 1px solid #000000; padding: 6px; text-align: center; font-weight: bold;">${escapeHtml(k.levelKognitif || 'L2')}</td>
                <td style="border: 1px solid #000000; padding: 6px; text-align: center;">${escapeHtml(k.dimensiProsesKognitif || 'Memahami')}</td>
                <td style="border: 1px solid #000000; padding: 6px; text-align: center; font-weight: bold;">${escapeHtml(k.kategori || 'C2')}</td>
                <td style="border: 1px solid #000000; padding: 6px; text-align: center;">${escapeHtml(k.bentukSoal || (q.type === 'mc' ? 'Pilihan Ganda' : 'Essay'))}</td>
            </tr>
        `;
    });

    const htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
            <title>${exam.title}</title>
            <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css">
            <style>
                body { font-family: 'Times New Roman', serif; line-height: 1.5; font-size: 12pt; }
                .header { text-align: center; margin-bottom: 20px; border-bottom: 3px double #000000; padding-bottom: 8px; }
                .header h1 { margin: 0; font-size: 16pt; text-transform: uppercase; }
                .header p { margin: 5px 0 0 0; font-size: 11pt; }
                h2 { font-size: 13pt; text-transform: uppercase; border-bottom: 1px solid #000000; padding-bottom: 3px; margin-top: 25px; }
                ol { padding-left: 20px; }
                ul { list-style-type: none; padding-left: 0; }
                table { width: 100%; border-collapse: collapse; font-size: 10pt; margin-top: 20px; }
                th { background-color: #f2f2f2; border: 1px solid #000000; padding: 6px; text-align: left; font-weight: bold; text-transform: uppercase; }
                td { border: 1px solid #000000; padding: 6px; vertical-align: top; }
                .page-break { page-break-before: always; }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>NASKAH SOAL UJIAN MADRASAH ALIYAH</h1>
                <p><strong>MATA PELAJARAN: ${exam.subjectName}</strong> | KURIKULUM: KURIKULUM MERDEKA / NASIONAL</p>
                <p>Paket Soal: ${exam.title}</p>
            </div>
            ${mcHtml}
            ${essayHtml}

            <div class="page-break"></div>

            <div class="header" style="border-bottom: 2px solid #000000;">
                <h1>MATRIKS KISI-KISI PENULISAN SOAL UJIAN</h1>
                <p>MATA PELAJARAN: ${exam.subjectName} | KURIKULUM: KURIKULUM MERDEKA / NASIONAL</p>
            </div>
            <table>
                <thead>
                    <tr>
                        <th style="width: 6%; text-align: center;">No</th>
                        <th style="width: 25%;">Kompetensi Dasar / Capaian Pembelajaran</th>
                        <th style="width: 15%;">Materi Pokok</th>
                        <th style="width: 25%;">Indikator Soal</th>
                        <th style="width: 8%; text-align: center;">Level</th>
                        <th style="width: 11%; text-align: center;">Dimensi</th>
                        <th style="width: 6%; text-align: center;">Kategori</th>
                        <th style="width: 8%; text-align: center;">Bentuk</th>
                    </tr>
                </thead>
                <tbody>
                    ${kisiRowsHtml}
                </tbody>
            </table>
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], {
        type: 'application/msword'
    });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exam.title.replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Word file berhasil diunduh!', 'success');
}

// Make globally available
window.renderModulAjarModule = renderModulAjarModule;
window.searchMapelModulAjar = searchMapelModulAjar;
window.selectSubjectForModulAjar = selectSubjectForModulAjar;
window.switchSubjectSubTab = switchSubjectSubTab;
window.backToSubjectSelection = backToSubjectSelection;
window.triggerAIGenerateModulPopup = triggerAIGenerateModulPopup;
window.generateEntireModulAjarWithAI = generateEntireModulAjarWithAI;
window.openLessonPlanModal = openLessonPlanModal;
window.switchModulFormTab = switchModulFormTab;
window.generateAIField = generateAIField;
window.saveLessonPlan = saveLessonPlan;
window.deleteLessonPlan = deleteLessonPlan;
window.openPreviewLessonPlan = openPreviewLessonPlan;
window.printPreviewModul = printPreviewModul;
window.downloadModulAsWord = downloadModulAsWord;
window.openGenerateSoalKisiModal = openGenerateSoalKisiModal;
window.generateSoalKisi = generateSoalKisi;
window.switchGenerateResultTab = switchGenerateResultTab;
window.printKisiKisiLandscape = printKisiKisiLandscape;
window.printNaskahSoalPortrait = printNaskahSoalPortrait;
window.printKunciJawabanPortrait = printKunciJawabanPortrait;
window.escapeHtml = escapeHtml;
window.saveGeneratedExamPackage = saveGeneratedExamPackage;
window.deleteGeneratedExam = deleteGeneratedExam;
window.openPreviewExamModal = openPreviewExamModal;
window.downloadExamAsWord = downloadExamAsWord;
window.downloadExamQuestionsAsWord = downloadExamQuestionsAsWord;
window.downloadExamKisiAsWord = downloadExamKisiAsWord;
window.downloadExamAnswerKeyAsWord = downloadExamAnswerKeyAsWord;


// Automatically expose functions and state to window for global inline handlers
Object.assign(window, {
  renderModulAjarModule,
  searchMapelModulAjar,
  selectSubjectForModulAjar,
  backToSubjectSelection,
  generateModulAjarNonAI,
  triggerAIGenerateModulPopup,
  generateEntireModulAjarWithAI,
  openLessonPlanModalWithData,
  openLessonPlanModal,
  switchModulFormTab,
  generateAIField,
  generateNonAIField,
  saveLessonPlan,
  deleteLessonPlan,
  openPreviewLessonPlan,
  printPreviewModul,
  downloadModulAsWord,
  openGenerateSoalKisiModal,
  openGenerateRppModal,
  generateRPPLengkap,
  generateSoalKisi,
  switchGenerateResultTab,
  printKisiKisiLandscape,
  printNaskahSoalPortrait,
  printKunciJawabanPortrait,
  escapeHtml,
  saveGeneratedExamPackage,
  deleteGeneratedExam,
  openPreviewExamModal,
  downloadExamAsWord,
  downloadExamQuestionsAsWord,
  downloadExamKisiAsWord,
  downloadExamAnswerKeyAsWord,
  openGenerateDeviceModal,
  generateDeviceDocument,
  renderDeviceResultModal,
  downloadDeviceAsWord,
  printPreviewDevice,
  saveGeneratedDeviceDocument
});

// Device Title metadata map
const deviceTitlesMap = {
    silabus: { title: 'Silabus', desc: 'Menghasilkan dokumen Silabus resmi berstandar madrasah sesuai dengan materi tersimpan.', icon: 'fa-scroll', color: 'blue' },
    atp: { title: 'ATP (Alur Tujuan Pembelajaran)', desc: 'Menghasilkan Alur Tujuan Pembelajaran (ATP) Kurikulum Merdeka / Standar Merdeka sesuai dengan seluruh modul ajar.', icon: 'fa-list-check', color: 'sky' },
    kktp: { title: 'KKTP', desc: 'Menghasilkan Kriteria Ketercapaian Tujuan Pembelajaran dan rubrik interval nilai sesuai dengan seluruh modul ajar.', icon: 'fa-ruler-combined', color: 'amber' },
    prota: { title: 'Program Tahunan (Prota)', desc: 'Menghasilkan Program Tahunan alokasi jam pelajaran dan semester sesuai dengan seluruh modul ajar.', icon: 'fa-calendar-days', color: 'purple' },
    prosem: { title: 'Program Semester (Prosem)', desc: 'Menghasilkan Matriks Program Semester mingguan per bulan sesuai dengan seluruh modul ajar.', icon: 'fa-table-cells', color: 'teal' },
    analisis_kikd: { title: 'Analisis KI-KD / CP', desc: 'Menghasilkan analisis pemetaan Capaian Pembelajaran, Elemen, dan TP sesuai dengan seluruh modul ajar.', icon: 'fa-chart-diagram', color: 'rose' },
    tp: { title: 'Tujuan Pembelajaran (TP)', desc: 'Menghasilkan rincian Tujuan Pembelajaran (Bloom Taxonomy) sesuai dengan seluruh modul ajar.', icon: 'fa-bullseye', color: 'violet' },
    cp: { title: 'Capaian Pembelajaran (CP)', desc: 'Menghasilkan deskripsi Capaian Pembelajaran (Fase D/E/F) sesuai dengan seluruh modul ajar.', icon: 'fa-graduation-cap', color: 'cyan' },
    lkpd: { title: 'LKPD (Lembar Kerja Peserta Didik)', desc: 'Menghasilkan Lembar Kerja Peserta Didik untuk SETIAP modul ajar tersimpan.', icon: 'fa-book-open', color: 'orange' }
};

function openGenerateDeviceModal(deviceType, subjectId) {
    const subject = appState.subjects ? appState.subjects.find(s => String(s.id) === String(subjectId)) : null;
    const subjectName = subject ? subject.name : 'Mata Pelajaran';
    const info = deviceTitlesMap[deviceType] || { title: `Generate ${deviceType.toUpperCase()}`, desc: 'Generate dokumen sesuai seluruh modul.', icon: 'fa-file', color: 'indigo' };
    const activePlans = getFilteredLessonPlansForActiveView(subjectId);

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div id="modal-content-box" class="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col max-h-[90vh] overflow-hidden transition-all duration-300">
                <div class="flex justify-between items-center pb-4 border-b border-slate-100 shrink-0">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-xl bg-${info.color}-50 text-${info.color}-600 flex items-center justify-center">
                            <i class="fa-solid ${info.icon} text-xs"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-800 text-sm sm:text-base">Penyusunan ${info.title}</h3>
                            <p class="text-[10px] text-slate-400 font-medium">Berdasarkan Modul Ajar Tersimpan</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg text-slate-400 hover:text-slate-600"></i></button>
                </div>

                <div id="modal-body-content" class="flex-1 min-h-0 overflow-y-auto py-4 space-y-6">
                    <div class="p-4 bg-${info.color}-50/50 rounded-2xl border border-${info.color}-100/60 space-y-2">
                        <h4 class="text-xs font-bold text-${info.color}-900">Penyusunan ${info.title} Otomatis</h4>
                        <p class="text-[11px] text-slate-600 leading-relaxed">${info.desc} Menggunakan <strong>${activePlans.length} modul ajar terfilter</strong>.</p>
                        <p class="text-[10px] text-slate-400 font-semibold"><i class="fa-solid fa-circle-info text-slate-500 mr-1"></i>Tanda tangan otomatis disinkronkan dari menu Identitas & Pengesahan (${escapeHtml(getGuruName())} & ${escapeHtml(getKepsekName())}).</p>
                    </div>

                    <form id="generate-device-form" onsubmit="generateDeviceDocument(event, '${deviceType}', '${subjectId}', '${subjectName.replace(/'/g, "\\'")}')" class="space-y-4">
                        <div class="space-y-1.5">
                            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Lingkup Modul Ajar Sasaran</label>
                            <select id="g-dev-scope" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-${info.color}-500 cursor-pointer">
                                <option value="all">Semua Modul Terfilter (${activePlans.length} Modul)</option>
                                <option value="semester_1">Hanya Modul Semester 1 (Ganjil)</option>
                                <option value="semester_2">Hanya Modul Semester 2 (Genap)</option>
                                ${activePlans.map(p => `<option value="${p.id}">Hanya Modul: ${escapeHtml(p.title)} (${escapeHtml(p.topic || 'Tanpa topik')})</option>`).join('')}
                            </select>
                        </div>

                        <div class="flex items-center justify-between pt-3 border-t border-slate-50 gap-2 flex-wrap sm:flex-nowrap">
                            <button type="button" onclick="closeModal()" class="px-3.5 py-2.5 bg-slate-100 rounded-2xl text-xs font-semibold hover:bg-slate-200 transition">Batal</button>
                            <div class="flex items-center space-x-2">
                                <button type="button" onclick="generateDeviceDocumentNonAI(event, '${deviceType}', '${subjectId}', '${subjectName.replace(/'/g, "\\'")}')" class="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-file-circle-check"></i>
                                    <span>Generate Standar (Non-AI)</span>
                                </button>
                                <button type="submit" id="btn-submit-device" class="px-3.5 py-2.5 bg-${info.color}-600 hover:bg-${info.color}-700 text-white rounded-2xl text-xs font-bold shadow transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                                    <span>Generate AI</span>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

function generateDeviceDocumentNonAI(event, deviceType, subjectId, subjectName) {
    if (event) event.preventDefault();
    const plans = getSelectedScopePlans(subjectId, 'g-dev-scope');
    if (!plans || plans.length === 0) {
        showToast("Tidak ada modul ajar tersimpan untuk filter/cakupan yang dipilih.", "warning");
        return;
    }

    const guruName = getGuruName();
    const guruNip = getGuruNip();
    const kepsekName = getKepsekName();
    const kepsekNip = getKepsekNip();

    const data = window.generateDeviceDocumentNonAIData ? 
        window.generateDeviceDocumentNonAIData(deviceType, plans, subjectName, { guruName, guruNip, kepsekName, kepsekNip }) :
        { items: [] };

    window.lastGeneratedDeviceItems = data.items || [{ id: '1', title: deviceType.toUpperCase(), htmlContent: data.htmlContent || '' }];
    window.lastGeneratedDeviceType = deviceType;
    window.lastGeneratedDeviceSubjectName = subjectName;

    renderDeviceResultModal(deviceType, subjectId, subjectName, window.lastGeneratedDeviceItems);
    showToast(`Dokumen ${deviceType.toUpperCase()} Non-AI berhasil dibuat dari modul ajar!`, 'success');
}
window.generateDeviceDocumentNonAI = generateDeviceDocumentNonAI;

async function generateDeviceDocument(event, deviceType, subjectId, subjectName) {
    event.preventDefault();
    const btn = document.getElementById('btn-submit-device');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Sedang Menyusun Dokumen...</span>';
    }

    try {
        const guruName = getGuruName();
        const guruNip = getGuruNip();
        const kepsekName = getKepsekName();
        const kepsekNip = getKepsekNip();

        const scope = document.getElementById('g-dev-scope')?.value || 'all';
        let plans = getFilteredLessonPlansForActiveView(subjectId);
        if (scope === 'semester_1') {
            plans = plans.filter(p => String(p.semester) === '1' || String(p.semester).toLowerCase().includes('ganjil') || String(p.semester).toLowerCase().includes('satu'));
        } else if (scope === 'semester_2') {
            plans = plans.filter(p => String(p.semester) === '2' || String(p.semester).toLowerCase().includes('genap') || String(p.semester).toLowerCase().includes('dua'));
        } else if (scope !== 'all') {
            plans = plans.filter(p => String(p.id) === String(scope));
        }

        if (plans.length === 0) throw new Error("Tidak ada modul ajar tersimpan untuk filter/cakupan semester yang dipilih.");

        const res = await fetch('/api/gemini/generate-device', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                deviceType,
                subjectName,
                grade: plans[0]?.grade || 'X',
                plans,
                guruName,
                guruNip,
                kepsekName,
                kepsekNip
            })
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.message || 'Gagal generate dokumen');

        window.lastGeneratedDeviceItems = data.items || [{ id: '1', title: deviceType.toUpperCase(), htmlContent: data.htmlContent }];
        window.lastGeneratedDeviceType = deviceType;
        window.lastGeneratedDeviceSubjectName = subjectName;

        renderDeviceResultModal(deviceType, subjectId, subjectName, window.lastGeneratedDeviceItems);
    } catch(err) {
        showToast(err.message, 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span>Coba Lagi</span>';
        }
    }
}

function renderDeviceResultModal(deviceType, subjectId, subjectName, items, activeIdx = 0) {
    const modal = document.getElementById('modal-container');
    if (!modal) return;

    const currentItem = items[activeIdx] || items[0];
    const info = deviceTitlesMap[deviceType] || { title: deviceType.toUpperCase() };

    document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-2 sm:p-4 animate-fade-in">
            <div id="modal-content-box" class="bg-slate-100 w-full max-w-5xl rounded-3xl shadow-2xl p-4 sm:p-6 flex flex-col h-[92vh] overflow-hidden">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-slate-200 shrink-0 bg-white p-4 rounded-2xl">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
                            <i class="fa-solid fa-file-lines"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-800 text-base sm:text-lg">${info.title} - ${escapeHtml(subjectName)}</h3>
                            <p class="text-xs text-slate-400 font-medium">Hasil Dokumen Otomatis Seluruh Modul (${items.length} Halaman/Item)</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2 flex-wrap gap-y-2">
                        <button type="button" onclick="saveGeneratedDeviceDocument('${subjectId}', '${subjectName.replace(/'/g, "\\'")}')" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center space-x-1.5 cursor-pointer">
                            <i class="fa-solid fa-floppy-disk"></i><span>Simpan ke Modul</span>
                        </button>
                        <button type="button" onclick="downloadDeviceAsWord(${activeIdx})" class="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-xl shadow transition flex items-center space-x-1.5 cursor-pointer">
                            <i class="fa-solid fa-file-word"></i><span>Unduh Word</span>
                        </button>
                        <button type="button" onclick="printPreviewDevice(${activeIdx})" class="px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow transition flex items-center space-x-1.5 cursor-pointer">
                            <i class="fa-solid fa-print"></i><span>Cetak</span>
                        </button>
                        <button type="button" onclick="closeModal()" class="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition">
                            <i class="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>
                </div>

                ${items.length > 1 ? `
                    <div class="flex items-center space-x-2 overflow-x-auto py-2.5 px-1 shrink-0">
                        ${items.map((item, idx) => `
                            <button type="button" onclick="renderDeviceResultModal('${deviceType}', '${subjectId}', '${subjectName.replace(/'/g, "\\'")}', window.lastGeneratedDeviceItems, ${idx})" class="px-3 py-1.5 text-xs font-bold rounded-xl shrink-0 transition ${idx === activeIdx ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'}">
                                ${escapeHtml(item.title || `Item ${idx + 1}`)}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}

                <div class="flex-1 min-h-0 overflow-y-auto mt-3 p-4 bg-slate-300/60 rounded-2xl flex justify-center">
                    <div class="w-full max-w-4xl bg-white shadow-lg rounded-xl p-4 sm:p-8 border border-slate-200 min-h-full overflow-x-auto">
                        ${currentItem.htmlContent}
                    </div>
                </div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

function downloadDeviceAsWord(idx = 0) {
    const items = window.lastGeneratedDeviceItems || [];
    const item = items[idx] || items[0];
    if (!item) return;

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>${escapeHtml(item.title || 'Dokumen')}</title>
            <style>
                body { font-family: Arial, sans-serif; margin: 20px; color: #000; }
                table { border-collapse: collapse; width: 100%; }
                th, td { border: 1px solid #000; padding: 6px; }
            </style>
        </head>
        <body>
            ${item.htmlContent}
        </body>
        </html>
    `;

    const blob = new Blob(['\ufeff' + htmlContent], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(item.title || 'Dokumen_Pembelajaran').replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Dokumen Word berhasil diunduh!', 'success');
}

function printPreviewDevice(idx = 0) {
    const items = window.lastGeneratedDeviceItems || [];
    const item = items[idx] || items[0];
    if (!item) return;

    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Cetak Dokumen - ${escapeHtml(item.title || '')}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #000; }
                @media print { @page { margin: 15mm; size: portrait; } }
            </style>
        </head>
        <body>
            ${item.htmlContent}
        </body>
        </html>
    `);
    printWin.document.close();
    setTimeout(() => { printWin.print(); }, 500);
}

async function saveGeneratedDeviceDocument(subjectId, subjectName) {
    const items = window.lastGeneratedDeviceItems || [];
    const deviceType = window.lastGeneratedDeviceType || 'dokumen';
    if (items.length === 0) return;

    if (!appState.lessonPlans) appState.lessonPlans = [];

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const newLp = {
            id: 'dev_' + deviceType + '_' + Date.now() + '_' + i,
            subjectId: subjectId,
            title: item.title || `${deviceType.toUpperCase()} - ${subjectName}`,
            topic: `${deviceType.toUpperCase()} ${subjectName}`,
            grade: 'X',
            htmlContent: item.htmlContent,
            isHtml: true,
            isDevice: true,
            deviceType: deviceType,
            createdAt: new Date().toISOString()
        };
        appState.lessonPlans.push(newLp);
        try {
            await fetch('/api/lesson-plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newLp)
            });
        } catch(e) {}
    }

    showToast(`Dokumen ${deviceType.toUpperCase()} Berhasil Disimpan!`, 'success');
    const modal = document.getElementById('modal-container');
    if (modal) modal.classList.add('hidden');

    if (typeof renderModulAjarModule === 'function') {
        renderModulAjarModule();
    }
}

window.openGenerateDeviceModal = openGenerateDeviceModal;
window.generateDeviceDocument = generateDeviceDocument;
window.renderDeviceResultModal = renderDeviceResultModal;
window.downloadDeviceAsWord = downloadDeviceAsWord;
window.printPreviewDevice = printPreviewDevice;
window.saveGeneratedDeviceDocument = saveGeneratedDeviceDocument;


// AI & Non-AI Generate RPP Lengkap
function openGenerateRppModal(subjectId) {
    const subject = appState.subjects ? appState.subjects.find(s => String(s.id) === String(subjectId)) : null;
    const subjectName = subject ? subject.name : 'Mata Pelajaran';
    const activePlans = getFilteredLessonPlansForActiveView(subjectId);

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div id="modal-content-box" class="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col max-h-[90vh] overflow-hidden transition-all duration-300">
                <!-- Modal Header -->
                <div class="flex justify-between items-center pb-4 border-b border-slate-100 shrink-0">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <i class="fa-solid fa-file-signature text-xs"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-800 text-sm sm:text-base">Penyusunan RPP Lengkap</h3>
                            <p class="text-[10px] text-slate-400 font-medium">Profil Pelajar Pancasila</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg text-slate-400 hover:text-slate-600"></i></button>
                </div>

                <!-- Modal Body (Form) -->
                <div id="modal-body-content" class="flex-1 min-h-0 overflow-y-auto py-4 space-y-6">
                    <div class="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100/60 space-y-2">
                        <h4 class="text-xs font-bold text-emerald-900">Penyusunan RPP Standar Merdeka Otomatis</h4>
                        <p class="text-[11px] text-slate-600 leading-relaxed">
                            Disusun secara menyeluruh dari modul ajar terfilter pada mata pelajaran <strong class="text-emerald-950">${subjectName}</strong> (${activePlans.length} Modul tersedia).
                        </p>
                        <p class="text-[10px] text-slate-400 font-semibold"><i class="fa-solid fa-circle-info text-slate-500 mr-1"></i>Tanda tangan otomatis disinkronkan dari menu Identitas & Pengesahan (${escapeHtml(getGuruName())} & ${escapeHtml(getKepsekName())}).</p>
                    </div>

                    <form id="generate-rpp-form" onsubmit="generateRPPLengkap(event, '${subjectId}', '${subjectName.replace(/'/g, "\\'")}')" class="space-y-4">
                        <div class="space-y-1.5">
                            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500">Lingkup Modul Ajar Sasaran</label>
                            <select id="g-rpp-scope" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
                                <option value="all">Semua Modul Terfilter (${activePlans.length} Modul)</option>
                                <option value="semester_1">Hanya Modul Semester 1 (Ganjil)</option>
                                <option value="semester_2">Hanya Modul Semester 2 (Genap)</option>
                                ${activePlans.map(p => `<option value="${p.id}">Hanya Modul: ${escapeHtml(p.title)} (${escapeHtml(p.topic || 'Tanpa topik')})</option>`).join('')}
                            </select>
                        </div>

                        <div class="flex items-center justify-between pt-3 border-t border-slate-50 gap-2 flex-wrap sm:flex-nowrap">
                            <button type="button" onclick="closeModal()" class="px-3.5 py-2.5 bg-slate-100 rounded-2xl text-xs font-semibold hover:bg-slate-200 transition">Batal</button>
                            <div class="flex items-center space-x-2">
                                <button type="button" onclick="generateRPPLengkapNonAI(event, '${subjectId}', '${subjectName.replace(/'/g, "\\'")}')" class="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-file-circle-check"></i>
                                    <span>Generate Standar (Non-AI)</span>
                                </button>
                                <button type="submit" id="btn-submit-rpp" class="px-3.5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl text-xs font-bold shadow transition flex items-center space-x-1.5 cursor-pointer">
                                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                                    <span>Generate AI</span>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
}

function generateRPPLengkapNonAI(event, subjectId, subjectName) {
    if (event) event.preventDefault();
    const plans = getSelectedScopePlans(subjectId, 'g-rpp-scope');
    if (!plans || plans.length === 0) {
        showToast("Tidak ada modul ajar tersimpan untuk filter/cakupan yang dipilih.", "warning");
        return;
    }

    const guruName = getGuruName();
    const guruNip = getGuruNip();
    const kepsekName = getKepsekName();
    const kepsekNip = getKepsekNip();

    const data = window.generateRPPLengkapNonAIData ?
        window.generateRPPLengkapNonAIData(plans, subjectName, { guruName, guruNip, kepsekName, kepsekNip }) :
        { rpps: [] };

    window.lastGeneratedRPPs = data.rpps || [{ id: 'rpp_1', title: 'RPP ' + subjectName, topic: subjectName, grade: plans[0]?.grade || 'X', htmlContent: data.htmlContent || '' }];
    window.lastGeneratedRPPSubjectId = subjectId;
    window.lastGeneratedRPPSubjectName = subjectName;

    renderGeneratedRPPResultModal(0);
    showToast(`Dokumen RPP Lengkap Non-AI berhasil dibuat dari modul ajar!`, 'success');
}
window.generateRPPLengkapNonAI = generateRPPLengkapNonAI;

async function generateRPPLengkap(event, subjectId, subjectName) {
    event.preventDefault();
    const btn = document.getElementById('btn-submit-rpp');
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i><span>Menyusun RPP... Proses ini memakan waktu (± 30 detik)</span>';
        btn.classList.replace('bg-emerald-600', 'bg-slate-400');
        btn.classList.replace('hover:bg-emerald-700', 'hover:bg-slate-500');
    }

    try {
        const guruName = getGuruName();
        const guruNip = getGuruNip();
        const kepsekName = getKepsekName();
        const kepsekNip = getKepsekNip();

        const scope = document.getElementById('g-rpp-scope')?.value || 'all';
        let plans = getFilteredLessonPlansForActiveView(subjectId);
        if (scope === 'semester_1') {
            plans = plans.filter(p => String(p.semester) === '1' || String(p.semester).toLowerCase().includes('ganjil') || String(p.semester).toLowerCase().includes('satu'));
        } else if (scope === 'semester_2') {
            plans = plans.filter(p => String(p.semester) === '2' || String(p.semester).toLowerCase().includes('genap') || String(p.semester).toLowerCase().includes('dua'));
        } else if (scope !== 'all') {
            plans = plans.filter(p => String(p.id) === String(scope));
        }

        if (plans.length === 0) throw new Error("Tidak ada modul ajar tersimpan untuk filter/cakupan semester yang dipilih.");

        const grade = plans[0].grade || 'X';

        const response = await fetch('/api/gemini/generate-rpp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                subjectName,
                grade,
                plans: plans,
                guruName,
                guruNip,
                kepsekName,
                kepsekNip
            })
        });

        const data = await response.json();
        if (!data.success) throw new Error(data.message);

        window.lastGeneratedRPPs = data.rpps || [{ id: 'rpp_1', title: 'RPP ' + subjectName, topic: subjectName, grade: grade, htmlContent: data.htmlContent }];
        window.lastGeneratedRPPSubjectId = subjectId;
        window.lastGeneratedRPPSubjectName = subjectName;

        renderGeneratedRPPResultModal(0);
    } catch (err) {
        showToast('Gagal generate RPP: ' + err.message, 'error');
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i><span>Generate Dokumen RPP</span>';
            btn.classList.replace('bg-slate-400', 'bg-emerald-600');
            btn.classList.replace('hover:bg-slate-500', 'hover:bg-emerald-700');
        }
    }
};

function renderGeneratedRPPResultModal(activeIndex = 0) {
    const rpps = window.lastGeneratedRPPs || [];
    const subjectId = window.lastGeneratedRPPSubjectId;
    const subjectName = window.lastGeneratedRPPSubjectName || 'Modul';
    const activeRpp = rpps[activeIndex] || rpps[0];

    const modalBody = document.getElementById('modal-body-content');
    if (!modalBody) return;

    const safeSubjectName = (subjectName || '').replace(/'/g, "\\'");

    const tabsHtml = rpps.map((r, i) => `
        <button type="button" onclick="renderGeneratedRPPResultModal(${i})" class="px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer whitespace-nowrap ${i === activeIndex ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'}">
            <i class="fa-solid fa-file-lines text-[11px]"></i>
            <span>RPP ${i + 1}: ${escapeHtml(r.topic || r.title)}</span>
        </button>
    `).join('');

    modalBody.innerHTML = `
        <div class="space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between bg-emerald-50 p-4 rounded-2xl border border-emerald-100 gap-3">
                <div>
                    <h4 class="font-bold text-emerald-900 text-sm flex items-center gap-1.5">
                        <i class="fa-solid fa-circle-check text-emerald-600"></i>
                        <span>${rpps.length} Dokumen RPP Berhasil Digenerate</span>
                    </h4>
                    <p class="text-[11px] text-emerald-700">Setiap modul memiliki 1 RPP dengan materi yang sesuai. Silakan simpan RPP ke modul atau unduh/cetak.</p>
                </div>
                <div class="flex items-center flex-wrap gap-2 shrink-0">
                    <button type="button" onclick="saveAllGeneratedRPPs('${subjectId}', '${safeSubjectName}')" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm cursor-pointer">
                        <i class="fa-solid fa-floppy-disk"></i>
                        <span>Simpan Semua RPP (${rpps.length})</span>
                    </button>
                    <button type="button" onclick="downloadActiveRPPAsWord(${activeIndex}, '${safeSubjectName}')" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm cursor-pointer">
                        <i class="fa-solid fa-download"></i>
                        <span>Download .doc</span>
                    </button>
                    <button type="button" onclick="printActiveRPP(${activeIndex})" class="px-3.5 py-2 bg-slate-700 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm cursor-pointer">
                        <i class="fa-solid fa-print"></i>
                        <span>Cetak RPP Ini</span>
                    </button>
                </div>
            </div>

            ${rpps.length > 1 ? `
                <div class="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
                    ${tabsHtml}
                </div>
            ` : ''}

            <div class="bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-inner">
                <div class="p-3 bg-slate-100 border-b border-slate-200 flex items-center justify-between flex-wrap gap-2">
                    <span class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <i class="fa-solid fa-file-signature text-emerald-600"></i>
                        Pratinjau: RPP ${activeIndex + 1} - ${escapeHtml(activeRpp.topic || activeRpp.title)}
                    </span>
                    <button type="button" onclick="saveSingleGeneratedRPP(${activeIndex}, '${subjectId}', '${safeSubjectName}')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-lg transition flex items-center space-x-1 shadow-sm cursor-pointer">
                        <i class="fa-solid fa-bookmark text-[10px]"></i>
                        <span>Simpan RPP ${activeIndex + 1} Ini</span>
                    </button>
                </div>
                <div id="rpp-result-content" class="p-4 sm:p-8 bg-white overflow-x-auto w-full max-h-[55vh] overflow-y-auto text-xs document-viewer">
                    ${activeRpp.htmlContent}
                </div>
            </div>
        </div>
    `;
}

window.renderGeneratedRPPResultModal = renderGeneratedRPPResultModal;
window.openGenerateRppModal = openGenerateRppModal;
window.generateRPPLengkap = generateRPPLengkap;


window.downloadHtmlAsWord = function(htmlContent, filename) {
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export HTML To Doc</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + htmlContent + footer;

    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = filename + '.doc';
    fileDownload.click();
    document.body.removeChild(fileDownload);
};

window.downloadActiveRPPAsWord = function(index, subjectName) {
    const rpps = window.lastGeneratedRPPs || [];
    const rpp = rpps[index] || rpps[0];
    if (!rpp) return;
    const filename = `RPP_${(rpp.topic || subjectName).replace(/ /g, '_')}`;
    downloadHtmlAsWord(rpp.htmlContent, filename);
};

window.saveSingleGeneratedRPP = async function(index, subjectId, subjectName) {
    const rpps = window.lastGeneratedRPPs || [];
    const rpp = rpps[index];
    if (!rpp) {
        showToast('Dokumen RPP tidak ditemukan', 'error');
        return;
    }
    const newLp = {
        id: 'rpp_' + Date.now() + '_' + index,
        subjectId: subjectId,
        title: 'RPP ' + (index + 1) + ': ' + (rpp.topic || subjectName),
        topic: rpp.topic || 'RPP Standar Merdeka/Standar Merdeka',
        grade: rpp.grade || 'X',
        htmlContent: rpp.htmlContent,
        isHtml: true,
        isRPP: true,
        createdAt: new Date().toISOString()
    };
    if (!appState.lessonPlans) appState.lessonPlans = [];
    appState.lessonPlans.push(newLp);

    try {
        await fetch('/api/lesson-plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newLp)
        });
        showToast(`RPP ${index + 1} (${rpp.topic}) Berhasil Disimpan!`, 'success');
    } catch(e) {
        showToast(`RPP ${index + 1} tersimpan secara lokal`, 'info');
    }

    if (typeof renderModulAjarModule === 'function') {
        renderModulAjarModule();
    }
};

window.saveAllGeneratedRPPs = async function(subjectId, subjectName) {
    const rpps = window.lastGeneratedRPPs || [];
    if (rpps.length === 0) return;

    if (!appState.lessonPlans) appState.lessonPlans = [];

    for (let i = 0; i < rpps.length; i++) {
        const rpp = rpps[i];
        const newLp = {
            id: 'rpp_' + Date.now() + '_' + i,
            subjectId: subjectId,
            title: 'RPP ' + (i + 1) + ': ' + (rpp.topic || subjectName),
            topic: rpp.topic || 'RPP Standar Merdeka/Standar Merdeka',
            grade: rpp.grade || 'X',
            htmlContent: rpp.htmlContent,
            isHtml: true,
            isRPP: true,
            createdAt: new Date().toISOString()
        };
        appState.lessonPlans.push(newLp);
        try {
            await fetch('/api/lesson-plans', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newLp)
            });
        } catch(e) {}
    }

    showToast(`Semua ${rpps.length} RPP Berhasil Disimpan ke Modul Ajar!`, 'success');
    
    const modal = document.getElementById('modal-container');
    if (modal) modal.classList.add('hidden');

    if (typeof renderModulAjarModule === 'function') {
        renderModulAjarModule();
    }
};

window.saveGeneratedRPP = window.saveAllGeneratedRPPs;

window.printActiveRPP = function(index) {
    const rpps = window.lastGeneratedRPPs || [];
    const rpp = rpps[index] || rpps[0];
    if (!rpp) return;
    const printWin = window.open('', '_blank');
    if (!printWin) return;
    printWin.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Cetak RPP - ${escapeHtml(rpp.topic || '')}</title>
            <style>
                body { font-family: Arial, sans-serif; padding: 20px; color: #000; }
                @media print {
                    @page { margin: 15mm; size: portrait; }
                }
            </style>
        </head>
        <body>
            ${rpp.htmlContent}
        </body>
        </html>
    `);
    printWin.document.close();
    setTimeout(() => {
        printWin.print();
    }, 500);
};
window.printPreviewRPP = window.printActiveRPP;

window.savePPTToDashboard = async function() {
    const subjectId = appState.selectedModulAjarSubjectId;
    const pptData = window.currentPPTData;
    if (!pptData) return;
    
    if (!appState.lessonPlans) appState.lessonPlans = [];
    const newLp = {
        id: 'ppt_' + Date.now(),
        subjectId: subjectId,
        title: pptData.title || `PPT: ${pptData.subtitle || ''}`,
        topic: pptData.title || 'PPT Interaktif',
        grade: 'X',
        htmlContent: JSON.stringify(pptData),
        isHtml: false,
        isPPT: true,
        createdAt: new Date().toISOString()
    };
    appState.lessonPlans.push(newLp);
    try {
        await fetch('/api/lesson-plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newLp)
        });
    } catch(e) {}
    
    showToast('PPT Interaktif Berhasil Disimpan!', 'success');
    closeModal();
    if (typeof renderModulAjarModule === 'function') {
        renderModulAjarModule();
    }
};

window.savePosterToDashboard = async function() {
    const subjectId = appState.selectedModulAjarSubjectId;
    const posterData = window.currentPosterData;
    if (!posterData) return;
    
    if (!appState.lessonPlans) appState.lessonPlans = [];
    const newLp = {
        id: 'poster_' + Date.now(),
        subjectId: subjectId,
        title: posterData.title || 'Poster Interaktif AI',
        topic: posterData.title || 'Poster Interaktif',
        grade: 'X',
        htmlContent: JSON.stringify(posterData),
        isHtml: false,
        isPoster: true,
        createdAt: new Date().toISOString()
    };
    appState.lessonPlans.push(newLp);
    try {
        await fetch('/api/lesson-plans', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newLp)
        });
    } catch(e) {}
    
    showToast('Poster Interaktif Berhasil Disimpan!', 'success');
    closeModal();
    if (typeof renderModulAjarModule === 'function') {
        renderModulAjarModule();
    }
};

window.saveGeneratedSoalKisi = async function(subjectName) {
    if (!window.lastGeneratedExamData) {
        showToast('Data soal & kisi-kisi tidak ditemukan', 'error');
        return;
    }
    const newExam = {
        id: 'exam_' + Date.now(),
        subjectName: subjectName || window.lastGeneratedExamSubjectName || 'Ujian',
        title: 'Bank Soal & Kisi-Kisi - ' + (subjectName || 'Mata Pelajaran'),
        data: window.lastGeneratedExamData,
        createdAt: new Date().toISOString()
    };
    if (!appState.generatedExams) appState.generatedExams = [];
    appState.generatedExams.push(newExam);

    try {
        await fetch('/api/generated-exams', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newExam)
        });
        showToast('Soal & Kisi-Kisi Berhasil Disimpan!', 'success');
    } catch(e) {
        showToast('Soal & Kisi-Kisi tersimpan secara lokal', 'info');
    }
};

// PPT Interaktif Modal & Viewer Logic
window.onPptScopeChange = function(value, subjectId) {
    let plans = getFilteredLessonPlansForActiveView(subjectId);
    let semesterSuffix = "";
    if (value === 'semester_1') {
        plans = plans.filter(p => String(p.semester) === '1' || String(p.semester).toLowerCase().includes('ganjil') || String(p.semester).toLowerCase().includes('satu'));
        semesterSuffix = " - Semester 1 (Ganjil)";
    } else if (value === 'semester_2') {
        plans = plans.filter(p => String(p.semester) === '2' || String(p.semester).toLowerCase().includes('genap') || String(p.semester).toLowerCase().includes('dua'));
        semesterSuffix = " - Semester 2 (Genap)";
    }

    const topicInput = document.getElementById('ai-ppt-topic');
    const detailTextarea = document.getElementById('ai-ppt-materi-detail');
    if (!topicInput) return;

    if (value === 'all' || value === 'semester_1' || value === 'semester_2') {
        const subject = appState.subjects ? appState.subjects.find(s => String(s.id) === String(subjectId)) : null;
        topicInput.value = (subject ? subject.name : 'Mata Pelajaran') + semesterSuffix;
        if (detailTextarea) {
            if (plans.length === 0) {
                detailTextarea.value = `[Peringatan] Tidak ada modul ajar tersimpan untuk filter/cakupan semester yang dipilih pada mata pelajaran ini.`;
            } else {
                detailTextarea.value = `Merangkum ${plans.length} modul ajar terfilter${semesterSuffix}:\n` + plans.map((p, i) => `${i+1}. ${p.title} (Materi: ${p.topic || '-'})`).join('\n');
            }
        }
    } else {
        const selectedPlan = plans.find(p => String(p.id) === String(value));
        if (selectedPlan) {
            topicInput.value = selectedPlan.topic || selectedPlan.title;
            if (detailTextarea) {
                let detail = `Materi: ${selectedPlan.topic || selectedPlan.title}\n`;
                if (selectedPlan.tujuanPembelajaran) {
                    detail += `Tujuan Pembelajaran: ${selectedPlan.tujuanPembelajaran}\n`;
                }
                if (selectedPlan.pemahamanBermakna) {
                    detail += `Pemahaman Bermakna: ${selectedPlan.pemahamanBermakna}\n`;
                }
                detailTextarea.value = detail.substring(0, 500);
            }
        }
    }
};

window.openGeneratePPTModal = function(subjectId, defaultTopic = '') {
    const subject = appState.subjects ? appState.subjects.find(s => String(s.id) === String(subjectId)) : null;
    const subjectName = subject ? subject.name : 'Mata Pelajaran';
    const plans = getFilteredLessonPlansForActiveView(subjectId);

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150">
                <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div class="flex items-center space-x-2.5 text-indigo-600">
                        <div class="p-2.5 bg-indigo-50 rounded-2xl">
                            <i class="fa-solid fa-file-powerpoint text-lg"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-slate-800 text-base">Generate PPT Interaktif AI</h3>
                            <p class="text-xs text-slate-400">${subjectName}</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>

                <form id="ai-ppt-form" onsubmit="generatePPTInteraktif(event, '${subjectId}', '${subjectName.replace(/'/g, "\\'")}')" class="space-y-4">
                    <div class="space-y-1.5">
                        <label class="block text-xs font-bold uppercase text-slate-500">Lingkup Modul Ajar Sasaran</label>
                        <select id="ai-ppt-scope" onchange="onPptScopeChange(this.value, '${subjectId}')" class="w-full px-4 py-2.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl text-xs font-semibold mb-1 cursor-pointer">
                            <option value="all">Semua Modul Terfilter (${plans.length} Modul)</option>
                            <option value="semester_1">Hanya Modul Semester 1 (Ganjil)</option>
                            <option value="semester_2">Hanya Modul Semester 2 (Genap)</option>
                            ${plans.map(p => `<option value="${p.id}">Hanya Modul: ${escapeHtml(p.title)} (${escapeHtml(p.topic || 'Tanpa topik')})</option>`).join('')}
                        </select>
                    </div>

                    <div class="space-y-1.5">
                        <label class="block text-xs font-bold uppercase text-slate-500">Materi / Topik Utama Slide</label>
                        <input type="text" id="ai-ppt-topic" required value="${defaultTopic || subjectName}" placeholder="Contoh: Shalat Berjamaah, Dinasti Umayyah, Turunan Fungsi" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold">
                    </div>

                    <div class="space-y-1.5">
                        <label class="block text-xs font-bold uppercase text-slate-500">Uraian / Detail Ringkasan Materi <span class="text-indigo-600 font-semibold lowercase">(diuraikan AI ke dalam slide)</span></label>
                        <textarea id="ai-ppt-materi-detail" rows="3" placeholder="Isikan poin-poin materi, sub-bab, atau uraian penjelasan yang ingin diuraikan secara detail oleh AI ke slide-slide PPT..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-medium focus:bg-white"></textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-1.5">
                            <label class="block text-xs font-bold uppercase text-slate-500">Tingkat Target</label>
                            <select id="ai-ppt-grade" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold cursor-pointer">
                                <option value="Semua Tingkat" ${appState.selectedModulAjarLevel === 'ALL' ? 'selected' : ''}>Semua Tingkat</option>
                                ${getUniqueTingkatList(appState.classes || []).map(lvl => `<option value="Tingkat ${lvl}" ${appState.selectedModulAjarLevel === lvl ? 'selected' : ''}>Tingkat ${lvl}</option>`).join('')}
                            </select>
                        </div>
                        <div class="space-y-1.5">
                            <label class="block text-xs font-bold uppercase text-slate-500">Jumlah Slide</label>
                            <select id="ai-ppt-count" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold">
                                <option value="6">6 Slide (Materi Murni)</option>
                                <option value="8" selected>8 Slide (Lengkap)</option>
                                <option value="10">10 Slide (Mendalam)</option>
                                <option value="12">12 Slide (Mastery)</option>
                            </select>
                        </div>
                    </div>

                    <div class="space-y-1.5">
                        <label class="block text-xs font-bold uppercase text-slate-500">Pilihan Tema Tampilan</label>
                        <select id="ai-ppt-theme" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold cursor-pointer">
                            <option value="midnight" selected>🌌 Midnight Indigo (Gelap & Futuristik)</option>
                            <option value="emerald">🌿 Emerald Madrasah (Hijau Segar & Berkah)</option>
                            <option value="sunset">🌅 Sunset Warm (Hangat & Estetis)</option>
                            <option value="ocean">🌊 Ocean Breeze (Biru & Menenangkan)</option>
                            <option value="light">📄 Minimalist Light (Terang & Bersih)</option>
                            <option value="neon">⚡ Cyberpunk Neon (Modern Kontras Tinggi)</option>
                        </select>
                    </div>

                    <div class="flex items-center justify-between space-x-2 pt-3 border-t border-slate-100 flex-wrap sm:flex-nowrap gap-2">
                        <button type="button" onclick="closeModal()" class="px-4 py-2.5 bg-slate-100 rounded-2xl text-xs font-semibold hover:bg-slate-200 transition">Batal</button>
                        <div class="flex items-center space-x-2">
                            <button type="button" onclick="generatePPTInteraktifNonAI(event, '${subjectId}', '${subjectName.replace(/'/g, "\\'")}')" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow transition flex items-center space-x-1.5 cursor-pointer">
                                <i class="fa-solid fa-file-circle-check"></i><span>Generate Standar (Non-AI)</span>
                            </button>
                            <button type="submit" id="ai-ppt-submit-btn" class="px-4 py-2.5 bg-indigo-600 text-white rounded-2xl text-xs font-bold hover:bg-indigo-700 shadow transition flex items-center space-x-1.5 cursor-pointer">
                                <i class="fa-solid fa-wand-magic-sparkles"></i><span>Generate AI</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;

    // Initialize the details text to "all" summary
    setTimeout(() => {
        onPptScopeChange('all', subjectId);
    }, 100);
};

window.generatePPTInteraktifNonAI = function(event, subjectId, subjectName) {
    if (event) event.preventDefault();
    const plans = getSelectedScopePlans(subjectId, 'ai-ppt-scope');
    const topic = document.getElementById('ai-ppt-topic')?.value?.trim() || subjectName;
    const grade = document.getElementById('ai-ppt-grade')?.value || 'VII';
    const slideCount = parseInt(document.getElementById('ai-ppt-count')?.value || '8');
    const theme = document.getElementById('ai-ppt-theme')?.value || 'midnight';

    const data = window.generatePPTNonAIData ? 
        window.generatePPTNonAIData(plans, subjectName, grade, theme, slideCount, topic) :
        { title: topic, subtitle: subjectName, slides: [] };

    closeModal();
    renderPPTViewerModal(data, subjectName, topic);
    showToast('PPT Interaktif Non-AI berhasil dibuat dari modul ajar!', 'success');
};

window.generatePPTInteraktif = async function(event, subjectId, subjectName) {
    event.preventDefault();
    const topic = document.getElementById('ai-ppt-topic').value.trim();
    const materiDetail = document.getElementById('ai-ppt-materi-detail')?.value.trim() || '';
    const grade = document.getElementById('ai-ppt-grade').value;
    const slideCount = parseInt(document.getElementById('ai-ppt-count')?.value || '8');
    const theme = document.getElementById('ai-ppt-theme')?.value || 'midnight';

    const submitBtn = document.getElementById('ai-ppt-submit-btn');
    if (!submitBtn) return;

    const originalContent = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> <span>Menyusun PPT Interaktif...</span>`;

    try {
        const response = await fetch('/api/gemini/generate-ppt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                subjectName, 
                topic, 
                materiDetail, 
                grade, 
                slideCount,
                theme,
                guruName: getGuruName(),
                kepsekName: getKepsekName()
            })
        });

        const res = await response.json();
        if (!response.ok || !res.success) throw new Error(res.message || 'Gagal menyusun PPT Interaktif.');

        closeModal();
        renderPPTViewerModal(res.data, subjectName, topic);
        showToast('PPT Interaktif berhasil disiapkan! Siap untuk dipresentasikan.', 'success');
    } catch (err) {
        showToast(err.message || 'Gagal memproses PPT', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalContent;
    }
};

// OPEN GENERATE POSTER MODAL
window.openGeneratePosterModal = function(subjectId, defaultTopic = '') {
    const subject = appState.subjects ? appState.subjects.find(s => String(s.id) === String(subjectId)) : null;
    const subjectName = subject ? subject.name : 'Mata Pelajaran';
    const plans = getFilteredLessonPlansForActiveView(subjectId);

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in duration-150">
                <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div class="flex items-center space-x-2.5 text-pink-600">
                        <div class="p-2.5 bg-pink-50 rounded-2xl">
                            <i class="fa-solid fa-image text-lg"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-slate-800 text-base">Generate Poster Interaktif</h3>
                            <p class="text-xs text-slate-400">Media Visual & Labeled Diagram Materi</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>

                <form id="ai-poster-form" onsubmit="generatePosterInteraktif(event, ${modulInlineArg(subjectId)}, ${modulInlineArg(subjectName)})" class="space-y-4">
                    <div class="space-y-1.5">
                        <label class="block text-xs font-bold uppercase text-slate-500">Lingkup Modul Ajar Sasaran</label>
                        <select id="ai-poster-scope" class="w-full px-4 py-2.5 bg-pink-50/50 border border-pink-100 rounded-2xl text-xs font-semibold mb-1 cursor-pointer">
                            <option value="all">Semua Modul Terfilter (${plans.length} Modul)</option>
                            <option value="semester_1">Hanya Modul Semester 1 (Ganjil)</option>
                            <option value="semester_2">Hanya Modul Semester 2 (Genap)</option>
                            ${plans.map(p => `<option value="${p.id}">Hanya Modul: ${escapeHtml(p.title)} (${escapeHtml(p.topic || 'Tanpa topik')})</option>`).join('')}
                        </select>
                    </div>

                    <div class="space-y-1.5">
                        <label class="block text-xs font-bold uppercase text-slate-500">Materi / Topik Poster Utama</label>
                        <input type="text" id="ai-poster-topic" required value="${defaultTopic || (plans[0]?.topic || subjectName)}" placeholder="Contoh: Arsitektur CPU, Siklus Hidrologi, Sel Hewan" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold">
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div class="space-y-1.5">
                            <label class="block text-xs font-bold uppercase text-slate-500">Tingkat Target</label>
                            <select id="ai-poster-grade" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold cursor-pointer">
                                <option value="Semua Tingkat" ${appState.selectedModulAjarLevel === 'ALL' ? 'selected' : ''}>Semua Tingkat</option>
                                ${getUniqueTingkatList(appState.classes || []).map(lvl => `<option value="Tingkat ${lvl}" ${appState.selectedModulAjarLevel === lvl ? 'selected' : ''}>Tingkat ${lvl}</option>`).join('')}
                            </select>
                        </div>
                        <div class="space-y-1.5">
                            <label class="block text-xs font-bold uppercase text-slate-500">Pilihan Tema Poster</label>
                            <select id="ai-poster-theme" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold cursor-pointer">
                                <option value="modern" selected>🎨 Modern Infographic (Kreatif & Berwarna)</option>
                                <option value="emerald">🌿 Emerald Madrasah (Nuansa Islami & Teduh)</option>
                                <option value="ocean">🌊 Deep Ocean (Tenang & Profesional)</option>
                                <option value="dark">🌙 Dark Premium (Mewah & Kontras Tinggi)</option>
                            </select>
                        </div>
                    </div>

                    <div class="space-y-1.5">
                        <label class="block text-xs font-bold uppercase text-slate-500">Catatan Khusus / Detail Prompt Tambahan (Opsional)</label>
                        <textarea id="ai-poster-notes" rows="3" placeholder="Contoh: Tambahkan ilustrasi organel sel yang berlabel, gunakan penekanan warna merah untuk inti sel, atau tambahkan penjelasan praktis sehari-hari." class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold focus:outline-pink-500 focus:border-pink-500 transition-colors" style="resize: none;"></textarea>
                    </div>

                    <div class="flex items-center justify-between space-x-2 pt-3 border-t border-slate-100 flex-wrap sm:flex-nowrap gap-2">
                        <button type="button" onclick="closeModal()" class="px-4 py-2.5 bg-slate-100 rounded-2xl text-xs font-semibold hover:bg-slate-200 transition">Batal</button>
                        <div class="flex items-center space-x-2">
                            <button type="button" onclick="generatePosterInteraktifNonAI(event, ${modulInlineArg(subjectId)}, ${modulInlineArg(subjectName)})" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-bold shadow transition flex items-center space-x-1.5 cursor-pointer">
                                <i class="fa-solid fa-file-circle-check"></i><span>Generate Standar (Non-AI)</span>
                            </button>
                            <button type="submit" id="ai-poster-submit-btn" class="px-4 py-2.5 bg-pink-600 text-white rounded-2xl text-xs font-bold hover:bg-pink-700 shadow transition flex items-center space-x-1.5 cursor-pointer">
                                <i class="fa-solid fa-wand-magic-sparkles"></i><span>Generate AI</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
};

window.generatePosterInteraktifNonAI = function(event, subjectId, subjectName) {
    if (event) event.preventDefault();
    const plans = getSelectedScopePlans(subjectId, 'ai-poster-scope');
    const topic = document.getElementById('ai-poster-topic')?.value?.trim() || subjectName;
    const grade = document.getElementById('ai-poster-grade')?.value || 'VII';
    const theme = document.getElementById('ai-poster-theme')?.value || 'modern';

    const data = window.generatePosterNonAIData ? 
        window.generatePosterNonAIData(plans, subjectName, grade, theme, topic) :
        { title: topic, subtitle: subjectName, hotspots: [] };

    closeModal();
    renderPosterModalViewer(data, subjectName, topic);
    showToast('Poster Interaktif Non-AI berhasil dibuat dari modul ajar!', 'success');
};

window.generatePosterInteraktif = async function(event, subjectId, subjectName) {
    event.preventDefault();
    const topic = document.getElementById('ai-poster-topic').value.trim();
    const grade = document.getElementById('ai-poster-grade').value;
    const theme = document.getElementById('ai-poster-theme').value;
    const notes = document.getElementById('ai-poster-notes').value.trim();

    const submitBtn = document.getElementById('ai-poster-submit-btn');
    if (!submitBtn) return;

    const originalContent = submitBtn.innerHTML;
    submitBtn.disabled = true;
    submitBtn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> <span>Mendesain Poster...</span>`;

    try {
        const response = await fetch('/api/gemini/generate-poster', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subjectName, topic, grade, theme, notes })
        });

        const res = await response.json();
        if (!response.ok || !res.success) throw new Error(res.message || 'Gagal generate poster.');

        closeModal();
        renderPosterModalViewer(res.data, subjectName, topic);
        showToast('Poster Interaktif berhasil dibuat! Klik komponen untuk interaksi.', 'success');
    } catch (err) {
        showToast(err.message || 'Gagal generate poster', 'error');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalContent;
    }
};

window.currentPPTData = null;
window.currentPPTSlideIdx = 0;

window.renderPPTViewerModal = function(pptData, subjectName, topic) {
    window.currentPPTData = pptData;
    window.currentPPTSlideIdx = 0;

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    const slides = pptData.slides || [];
    const totalSlides = slides.length;

    document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
            <div class="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden text-slate-100 animate-in fade-in zoom-in duration-200">
                <!-- Top Header Bar -->
                <div class="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800/80 flex items-center justify-between shrink-0">
                    <div class="flex items-center space-x-3">
                        <div class="px-2.5 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 rounded-xl text-xs font-black flex items-center space-x-1.5">
                            <i class="fa-solid fa-file-powerpoint"></i>
                            <span>PPT INTERAKTIF</span>
                        </div>
                        <span class="text-slate-600 font-bold">|</span>
                        <div>
                            <h3 class="font-bold text-sm text-slate-200 line-clamp-1">${modulEscapeHtml(pptData.title || topic)}</h3>
                            <p class="text-[11px] text-slate-400">${modulEscapeHtml(pptData.subtitle || subjectName)}</p>
                        </div>
                    </div>

                    <div class="flex items-center space-x-2">
                        <button type="button" onclick="savePPTToDashboard()" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 shadow-sm cursor-pointer" title="Simpan Presentasi ke Dashboard">
                            <i class="fa-solid fa-floppy-disk text-xs"></i><span>Simpan ke Modul</span>
                        </button>
                        <button type="button" onclick="downloadPPTAsHtml()" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 shadow-lg shadow-indigo-600/20" title="Download Presentasi Standalone HTML untuk Offline">
                            <i class="fa-solid fa-download text-xs"></i>
                            <span class="hidden sm:inline">Download HTML</span>
                        </button>
                        <button type="button" onclick="downloadPPTAsDoc()" class="px-3 py-1.5 bg-blue-600/80 hover:bg-blue-600 text-white rounded-xl text-xs font-bold transition flex items-center space-x-1" title="Download Outline Word">
                            <i class="fa-solid fa-file-word text-xs"></i>
                            <span class="hidden sm:inline">Word</span>
                        </button>
                        <button type="button" onclick="closeModal()" class="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition"><i class="fa-solid fa-xmark text-lg"></i></button>
                    </div>
                </div>

                <!-- Main Presentation Stage -->
                <div class="flex-1 flex flex-col justify-between p-4 sm:p-8 bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/40 overflow-y-auto relative" id="ppt-slide-stage">
                    <!-- Slide Content Rendered dynamically -->
                </div>

                <!-- Speaker Notes Drawer (Collapsible) -->
                <div id="ppt-speaker-notes-drawer" class="hidden px-6 py-3 bg-slate-950 border-t border-indigo-500/20 text-xs text-amber-200/90 font-mono flex items-start space-x-2 shrink-0">
                    <i class="fa-solid fa-user-tie text-amber-400 mt-0.5"></i>
                    <div>
                        <span class="font-bold text-amber-300">Catatan Guru:</span>
                        <span id="ppt-speaker-notes-text">--</span>
                    </div>
                </div>

                <!-- Bottom Control Toolbar -->
                <div class="px-5 py-3 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between shrink-0">
                    <div class="flex items-center space-x-2">
                        <button type="button" onclick="togglePPTSpeakerNotes()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5">
                            <i class="fa-solid fa-note-sticky text-amber-400"></i>
                            <span>Catatan Guru</span>
                        </button>
                    </div>

                    <!-- Slide Navigation -->
                    <div class="flex items-center space-x-3">
                        <button type="button" onclick="navigatePPTSlide(-1)" class="p-2.5 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-xl text-xs transition font-bold disabled:opacity-40 disabled:hover:bg-slate-800" id="ppt-btn-prev">
                            <i class="fa-solid fa-chevron-left"></i>
                        </button>
                        <span class="text-xs font-mono text-slate-400 font-bold" id="ppt-slide-indicator">
                            Slide <span id="ppt-current-num">1</span> / ${totalSlides}
                        </span>
                        <button type="button" onclick="navigatePPTSlide(1)" class="p-2.5 bg-slate-800 hover:bg-indigo-600 text-slate-200 hover:text-white rounded-xl text-xs transition font-bold disabled:opacity-40 disabled:hover:bg-slate-800" id="ppt-btn-next">
                            <i class="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>

                    <div class="hidden sm:flex items-center space-x-1.5 text-[11px] text-slate-500 font-mono">
                        <i class="fa-solid fa-keyboard"></i>
                        <span>Gunakan tombol panah ← →</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Render current slide
    updatePPTSlideStage();

    // Attach keyboard navigation listeners
    const keyHandler = function(e) {
        if (e.key === 'ArrowLeft') {
            navigatePPTSlide(-1);
        } else if (e.key === 'ArrowRight') {
            navigatePPTSlide(1);
        }
    };
    window.removeEventListener('keydown', window._pptKeyHandler);
    window._pptKeyHandler = keyHandler;
    window.addEventListener('keydown', window._pptKeyHandler);
};

window.navigatePPTSlide = function(dir) {
    if (!window.currentPPTData || !window.currentPPTData.slides) return;
    const slides = window.currentPPTData.slides;
    const newIdx = window.currentPPTSlideIdx + dir;
    if (newIdx >= 0 && newIdx < slides.length) {
        window.currentPPTSlideIdx = newIdx;
        updatePPTSlideStage();
    }
};

window.togglePPTSpeakerNotes = function() {
    const drawer = document.getElementById('ppt-speaker-notes-drawer');
    if (drawer) {
        drawer.classList.toggle('hidden');
    }
};

window.togglePPTInteractiveQuestion = function() {
    const box = document.getElementById('ppt-interactive-answer');
    if (box) {
        box.classList.toggle('hidden');
    }
};

window.updatePPTSlideStage = function() {
    if (!window.currentPPTData || !window.currentPPTData.slides) return;
    const slides = window.currentPPTData.slides;
    const slide = slides[window.currentPPTSlideIdx];
    if (!slide) return;

    const stage = document.getElementById('ppt-slide-stage');
    const currentNumEl = document.getElementById('ppt-current-num');
    const prevBtn = document.getElementById('ppt-btn-prev');
    const nextBtn = document.getElementById('ppt-btn-next');
    const notesText = document.getElementById('ppt-speaker-notes-text');

    if (currentNumEl) currentNumEl.innerText = window.currentPPTSlideIdx + 1;
    if (prevBtn) prevBtn.disabled = (window.currentPPTSlideIdx === 0);
    if (nextBtn) nextBtn.disabled = (window.currentPPTSlideIdx === slides.length - 1);
    if (notesText) notesText.innerText = slide.teacherNote || 'Tidak ada catatan khusus untuk slide ini.';

    // Theme Mapping for Presentation Slides
    const themesStyles = {
        midnight: {
            stageBg: "bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950/40 text-slate-100",
            badge: "bg-indigo-500/20 border border-indigo-500/30 text-indigo-300",
            title: "text-white",
            subtitle: "text-indigo-300/80",
            authorText: "text-slate-500",
            cardBg: "bg-slate-800/80 border border-slate-700/80 hover:border-indigo-500/50 hover:bg-slate-800",
            cardNum: "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30",
            cardText: "text-slate-200",
            keyTakeaway: "from-emerald-950/40 to-teal-950/40 border-emerald-500/30 text-emerald-100",
            keyTakeawayTitle: "text-emerald-400",
            interactive: "bg-indigo-950/50 border border-indigo-500/30",
            interactiveTitle: "text-indigo-300",
            interactiveBtn: "text-indigo-400"
        },
        emerald: {
            stageBg: "bg-gradient-to-br from-emerald-900 via-teal-950 to-slate-950 text-slate-100",
            badge: "bg-emerald-500/20 border border-emerald-500/30 text-emerald-300",
            title: "text-white",
            subtitle: "text-emerald-300/80",
            authorText: "text-emerald-500/70",
            cardBg: "bg-emerald-850 border border-emerald-800/60 hover:border-emerald-500/50 hover:bg-emerald-800",
            cardNum: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
            cardText: "text-slate-200",
            keyTakeaway: "from-teal-900/40 to-emerald-900/40 border border-emerald-500/30 text-emerald-100",
            keyTakeawayTitle: "text-emerald-450",
            interactive: "bg-teal-950/50 border border-teal-500/30",
            interactiveTitle: "text-teal-300",
            interactiveBtn: "text-teal-400"
        },
        sunset: {
            stageBg: "bg-gradient-to-br from-rose-950 via-amber-950 to-slate-950 text-slate-100",
            badge: "bg-rose-500/20 border border-rose-500/30 text-rose-300",
            title: "text-white",
            subtitle: "text-rose-300/80",
            authorText: "text-rose-500/70",
            cardBg: "bg-rose-900/30 border border-rose-850 hover:border-rose-500/50 hover:bg-rose-900/40",
            cardNum: "bg-rose-500/20 text-rose-300 border border-rose-500/30",
            cardText: "text-slate-200",
            keyTakeaway: "from-amber-900/40 to-rose-900/40 border border-amber-500/30 text-amber-100",
            keyTakeawayTitle: "text-amber-400",
            interactive: "bg-amber-950/50 border border-amber-500/30",
            interactiveTitle: "text-amber-300",
            interactiveBtn: "text-amber-400"
        },
        ocean: {
            stageBg: "bg-gradient-to-br from-cyan-900 via-blue-950 to-slate-950 text-slate-100",
            badge: "bg-cyan-500/20 border border-cyan-500/30 text-cyan-300",
            title: "text-white",
            subtitle: "text-cyan-300/80",
            authorText: "text-cyan-500/70",
            cardBg: "bg-cyan-900/30 border border-cyan-855 hover:border-cyan-500/50 hover:bg-cyan-900/40",
            cardNum: "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30",
            cardText: "text-slate-200",
            keyTakeaway: "from-blue-900/40 to-cyan-900/40 border-blue-500/30 text-blue-100",
            keyTakeawayTitle: "text-blue-400",
            interactive: "bg-blue-950/50 border border-blue-500/30",
            interactiveTitle: "text-blue-300",
            interactiveBtn: "text-blue-400"
        },
        light: {
            stageBg: "bg-gradient-to-br from-slate-50 via-white to-slate-100 text-slate-800",
            badge: "bg-emerald-100 border border-emerald-200 text-emerald-800",
            title: "text-slate-900",
            subtitle: "text-slate-500",
            authorText: "text-slate-400",
            cardBg: "bg-white border border-slate-200 hover:border-emerald-500 hover:shadow-sm",
            cardNum: "bg-emerald-50 text-emerald-700 border-emerald-100",
            cardText: "text-slate-700",
            keyTakeaway: "from-emerald-50 to-teal-50 border border-emerald-200 text-slate-700",
            keyTakeawayTitle: "text-emerald-700",
            interactive: "bg-slate-50 border border-slate-250",
            interactiveTitle: "text-slate-700",
            interactiveBtn: "text-emerald-600"
        },
        neon: {
            stageBg: "bg-black text-white border border-yellow-500/20",
            badge: "bg-yellow-500/10 border border-yellow-500 text-yellow-400 font-mono",
            title: "text-white font-mono",
            subtitle: "text-yellow-400 font-mono",
            authorText: "text-yellow-500/50 font-mono",
            cardBg: "bg-zinc-950 border border-zinc-800 hover:border-yellow-500 hover:bg-zinc-900",
            cardNum: "bg-yellow-500/10 text-yellow-400 border-yellow-500/30",
            cardText: "text-zinc-200",
            keyTakeaway: "from-zinc-950 to-black border-yellow-500/30 text-zinc-100",
            keyTakeawayTitle: "text-yellow-400 font-mono",
            interactive: "bg-zinc-950 border border-yellow-500/30",
            interactiveTitle: "text-yellow-400",
            interactiveBtn: "text-yellow-400"
        }
    };

    const currentTheme = window.currentPPTData.theme || 'midnight';
    const style = themesStyles[currentTheme] || themesStyles.midnight;

    // Apply main stage theme background classes
    if (stage) {
        stage.className = "flex-1 flex flex-col justify-between p-4 sm:p-8 overflow-y-auto relative transition-colors duration-350 " + style.stageBg;
    }

    // Generate Points Cards
    const pointsHtml = (slide.points || []).map((pt, idx) => `
        <div class="p-4 rounded-2xl flex items-start space-x-3 transition duration-150 ${style.cardBg}">
            <div class="w-7 h-7 rounded-xl font-extrabold flex items-center justify-center shrink-0 text-xs ${style.cardNum}">
                ${idx + 1}
            </div>
            <p class="text-sm leading-relaxed font-semibold ${style.cardText}">${modulEscapeHtml(pt)}</p>
        </div>
    `).join('');

    stage.innerHTML = `
        <div class="max-w-3xl mx-auto w-full space-y-6 my-auto animate-in fade-in slide-in-from-right duration-300">
            <!-- Badge & Type Header -->
            <div class="flex items-center justify-between">
                <span class="px-3 py-1 rounded-xl text-xs font-bold uppercase tracking-wider ${style.badge}">
                    ${modulEscapeHtml(slide.badge || `Slide ${slide.slideNumber}`)}
                </span>
                <span class="text-xs font-mono font-bold ${style.authorText}">
                    Materi Murni • ${modulEscapeHtml(window.currentPPTData.subtitle || 'Media Ajar')}
                </span>
            </div>

            <!-- Slide Main Title -->
            <div class="space-y-2">
                <h1 class="text-2xl sm:text-3xl font-black leading-tight tracking-tight ${style.title}">${modulEscapeHtml(slide.title)}</h1>
                ${slide.subtitle ? `<p class="text-sm sm:text-base font-medium ${style.subtitle}">${modulEscapeHtml(slide.subtitle)}</p>` : ''}
            </div>

            <!-- Slide Points List -->
            <div class="space-y-3">
                ${pointsHtml}
            </div>

            <!-- Key Takeaway Box -->
            ${slide.keyTakeaway ? `
            <div class="p-4 bg-gradient-to-r border rounded-2xl flex items-start space-x-3 ${style.keyTakeaway}">
                <i class="fa-solid fa-lightbulb text-base mt-0.5 shrink-0"></i>
                <div class="space-y-0.5">
                    <span class="text-[11px] font-bold uppercase tracking-wider block ${style.keyTakeawayTitle}">Rangkuman Materi Inti</span>
                    <p class="text-xs font-medium">${modulEscapeHtml(slide.keyTakeaway)}</p>
                </div>
            </div>
            ` : ''}

            <!-- Interactive Question / Trigger -->
            ${slide.interactiveQuestion ? `
            <div class="p-4 rounded-2xl space-y-2 border ${style.interactive}">
                <div class="flex items-center justify-between cursor-pointer" onclick="togglePPTInteractiveQuestion()">
                    <div class="flex items-center space-x-2 font-bold text-xs ${style.interactiveTitle}">
                        <i class="fa-solid fa-comments"></i>
                        <span>Pertanyaan Interaktif Pembelajaran</span>
                    </div>
                    <span class="text-[11px] hover:underline cursor-pointer ${style.interactiveBtn}">Tampilkan Diskusi <i class="fa-solid fa-chevron-down text-[10px] ml-1"></i></span>
                </div>
                <p class="text-xs italic font-medium ${style.cardText}">"${modulEscapeHtml(slide.interactiveQuestion)}"</p>
                <div id="ppt-interactive-answer" class="hidden pt-2 border-t border-slate-500/20 text-xs">
                    💡 <strong>Petunjuk Diskusi Guru:</strong> Ajak peserta didik mengutarakan pemikiran kritis atau bertukar ide dengan teman sebangku mengenai sub-bab materi ini.
                </div>
            </div>
            ` : ''}
        </div>
    `;
};

// RENDER POSTER MODAL VIEWER
window.renderPosterModalViewer = function(posterData, subjectName, topic) {
    window.currentPosterData = posterData;
    const modal = document.getElementById('modal-container');
    if (!modal) return;

    const themeKey = posterData.theme || 'modern';
    const posterThemes = {
        modern: {
            bg: "bg-slate-50 text-slate-800",
            headerBg: "bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-600 text-white",
            canvasBg: "bg-white border-2 border-slate-100",
            illustrationBg: "bg-gradient-to-tr from-slate-100 to-indigo-50/50",
            pillarCard: "bg-white border border-slate-100 hover:border-pink-300 hover:shadow-sm",
            funFactBg: "bg-indigo-50/50 border border-indigo-100/50 text-slate-700",
            badgeBg: "bg-pink-600 text-white shadow-pink-200",
            badgePulse: "bg-pink-500/30",
            detailBg: "bg-slate-50 border border-slate-200/60"
        },
        emerald: {
            bg: "bg-emerald-50/30 text-slate-800",
            headerBg: "bg-gradient-to-r from-emerald-600 via-teal-600 to-teal-700 text-white",
            canvasBg: "bg-white border-2 border-emerald-100/50",
            illustrationBg: "bg-gradient-to-tr from-emerald-50/50 to-teal-50/50",
            pillarCard: "bg-white border border-emerald-50 hover:border-emerald-300 hover:shadow-sm",
            funFactBg: "bg-emerald-50/50 border border-emerald-100/50 text-slate-700",
            badgeBg: "bg-emerald-600 text-white shadow-emerald-200",
            badgePulse: "bg-emerald-600/30",
            detailBg: "bg-emerald-50/20 border border-emerald-100"
        },
        ocean: {
            bg: "bg-sky-50/30 text-slate-800",
            headerBg: "bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 text-white",
            canvasBg: "bg-white border-2 border-sky-100/50",
            illustrationBg: "bg-gradient-to-tr from-sky-50 to-blue-50/50",
            pillarCard: "bg-white border border-sky-50 hover:border-blue-300 hover:shadow-sm",
            funFactBg: "bg-sky-50/50 border-sky-100/50 text-slate-700",
            badgeBg: "bg-blue-600 text-white shadow-blue-200",
            badgePulse: "bg-blue-600/30",
            detailBg: "bg-sky-50/20 border border-sky-100"
        },
        dark: {
            bg: "bg-slate-950 text-slate-100",
            headerBg: "bg-gradient-to-r from-purple-950 via-slate-900 to-slate-950 text-white border-b border-purple-500/20",
            canvasBg: "bg-slate-900 border border-slate-800",
            illustrationBg: "bg-gradient-to-tr from-slate-950 to-purple-950/30",
            pillarCard: "bg-slate-800/80 border-slate-700/80 hover:border-purple-500/50 hover:bg-slate-800",
            funFactBg: "bg-purple-950/30 border-purple-500/20 text-slate-300",
            badgeBg: "bg-purple-600 text-white shadow-purple-950",
            badgePulse: "bg-purple-600/30",
            detailBg: "bg-slate-950 border border-purple-500/20"
        }
    };

    const style = posterThemes[themeKey] || posterThemes.modern;

    document.body.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
            <div class="bg-white rounded-3xl shadow-2xl w-full max-w-6xl h-[95vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 ${style.bg}">
                <!-- Poster Top Header Bar -->
                <div class="px-6 py-4 flex items-center justify-between shrink-0 shadow-sm ${style.headerBg}">
                    <div class="flex items-center space-x-3">
                        <div class="px-3 py-1.5 bg-white/10 border border-white/20 text-white rounded-xl text-xs font-black flex items-center space-x-1.5">
                            <i class="fa-solid fa-image"></i>
                            <span>POSTER INTERAKTIF AI</span>
                        </div>
                        <span class="text-white/40 font-bold">|</span>
                        <div>
                            <h3 class="font-extrabold text-base line-clamp-1 leading-snug">${modulEscapeHtml(posterData.title || topic)}</h3>
                            <p class="text-[11px] text-white/80 font-medium">${modulEscapeHtml(posterData.subtitle || subjectName)}</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button onclick="savePosterToDashboard()" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md transition flex items-center space-x-1.5 cursor-pointer">
                            <i class="fa-solid fa-floppy-disk"></i><span>Simpan ke Modul</span>
                        </button>
                        <button onclick="window.print()" class="px-3.5 py-2 bg-white/15 hover:bg-white/25 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1 cursor-pointer">
                            <i class="fa-solid fa-print"></i><span>Cetak Poster</span>
                        </button>
                        <button type="button" onclick="closeModal()" class="p-2 text-white/80 hover:text-white rounded-xl hover:bg-white/10 transition cursor-pointer"><i class="fa-solid fa-xmark text-lg"></i></button>
                    </div>
                </div>

                <!-- Poster Body Area -->
                <div class="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6" id="poster-interactive-printable-area">
                    
                    <!-- LEFT COLUMN: Labeled Diagram Illustration (7 cols) -->
                    <div class="lg:col-span-7 flex flex-col space-y-4">
                        <div class="rounded-2xl p-4 border border-slate-100 flex flex-col justify-between h-full space-y-4 ${style.canvasBg}">
                            <div>
                                <h4 class="font-bold text-sm text-slate-800 uppercase tracking-wider">${modulEscapeHtml(posterData.illustrationTitle || 'Diagram Konseptual')}</h4>
                                <p class="text-xs text-slate-500">${modulEscapeHtml(posterData.illustrationDescription || 'Arahkan kursor atau klik hotspot pada diagram untuk melihat rahasia detail materi.')}</p>
                            </div>

                            <!-- Interactive Diagram Container -->
                            <div class="relative w-full aspect-[4/3] rounded-2xl flex items-center justify-center overflow-hidden border border-slate-100 p-8 ${style.illustrationBg}">
                                ${posterData.imageUrl ? `
                                    <img src="${modulSafeImageSrc(posterData.imageUrl)}" class="absolute inset-0 w-full h-full object-contain" referrerPolicy="no-referrer" />
                                    <div class="absolute inset-0 bg-slate-900/10 pointer-events-none"></div>
                                ` : `
                                    <!-- Stylized Techy Central SVG Background to make it look like a physical component schematic diagram -->
                                    <svg class="absolute inset-0 w-full h-full opacity-[0.06] text-indigo-900 pointer-events-none" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="none">
                                        <circle cx="50" cy="50" r="30" stroke="currentColor" stroke-width="0.5" fill="none" />
                                        <circle cx="50" cy="50" r="40" stroke="currentColor" stroke-width="0.5" stroke-dasharray="2 2" fill="none" />
                                        <line x1="10" y1="50" x2="90" y2="50" stroke="currentColor" stroke-width="0.3" />
                                        <line x1="50" y1="10" x2="50" y2="90" stroke="currentColor" stroke-width="0.3" />
                                        <rect x="25" y="25" width="50" height="50" stroke="currentColor" stroke-width="0.4" stroke-dasharray="1 1" fill="none" />
                                    </svg>

                                    <!-- Schematic Central Device Board Box -->
                                    <div class="relative w-[70%] h-[70%] bg-white/75 border border-indigo-200 rounded-3xl shadow-md p-6 flex flex-col items-center justify-center text-center space-y-2 pointer-events-none border-dashed">
                                        <div class="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-1">
                                            <i class="fa-solid fa-microchip text-3xl"></i>
                                        </div>
                                        <h5 class="text-xs font-extrabold text-slate-700 tracking-wide uppercase">${modulEscapeHtml(topic)}</h5>
                                        <p class="text-[10px] text-slate-400 font-medium">Sistem Pembelajaran Terpadu</p>
                                    </div>
                                `}

                                <!-- Hotspot Badges Placement -->
                                ${(posterData.hotspots || []).map((h, i) => `
                                    <button 
                                        onclick="selectPosterHotspot(${modulInlineArg(h.id)}, ${modulInlineJson(h)})"
                                        class="absolute group z-10 flex items-center justify-center focus:outline-none cursor-pointer"
                                        style="left: ${modulSafePercent(h.x)}%; top: ${modulSafePercent(h.y)}%;"
                                    >
                                        <!-- Concentric Pulsing rings -->
                                        <span class="absolute inline-flex h-10 w-10 rounded-full animate-ping opacity-75 ${style.badgePulse}"></span>
                                        <span class="relative inline-flex rounded-full h-8 w-8 items-center justify-center text-xs font-black shadow-lg hover:scale-115 transition duration-150 ${style.badgeBg}">
                                            ${i + 1}
                                        </span>
                                        
                                        <!-- Hover Label Tooltip -->
                                        <span class="absolute left-1/2 -translate-x-1/2 bottom-9 bg-slate-900/90 text-white text-[10px] font-bold px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition whitespace-nowrap pointer-events-none">
                                            ${h.label}
                                        </span>
                                    </button>
                                `).join('')}
                            </div>

                            <!-- Selected Hotspot Deep Dive Panel -->
                            <div class="p-4 rounded-xl transition duration-150 ${style.detailBg}" id="poster-hotspot-display-panel">
                                <div class="flex items-center space-x-2 text-indigo-600 mb-1">
                                    <i class="fa-solid fa-circle-info text-sm"></i>
                                    <span class="text-xs font-bold uppercase tracking-wider">Detail Komponen Terpilih</span>
                                </div>
                                <h5 class="text-sm font-extrabold text-slate-800">Silakan Klik Hotspot Diagram Diatas</h5>
                                <p class="text-xs text-slate-500 mt-1">Gunakan angka-angka bernyala pada ilustrasi visual untuk memetakan penjelasan materi inti secara spesifik dan menyenangkan.</p>
                            </div>
                        </div>
                    </div>

                    <!-- RIGHT COLUMN: Core Pillars & Fun Facts (5 cols) -->
                    <div class="lg:col-span-5 flex flex-col space-y-5">
                        
                        <!-- Core Pillars Container -->
                        <div class="space-y-3.5">
                            <h4 class="font-bold text-xs uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                                <i class="fa-solid fa-shapes text-pink-500"></i>
                                <span>Pilar Utama Pembelajaran</span>
                            </h4>

                            <div class="space-y-3">
                                ${(posterData.corePillars || []).map((cp, idx) => `
                                    <div class="p-4 rounded-2xl transition flex items-start space-x-3.5 ${style.pillarCard}">
                                        <div class="p-2.5 bg-gradient-to-tr from-pink-500 to-indigo-500 text-white rounded-xl shadow-md">
                                            <i class="${modulSafeIconClass(cp.icon)} text-sm w-4 h-4 text-center flex items-center justify-center"></i>
                                        </div>
                                        <div class="space-y-1">
                                            <h5 class="text-sm font-extrabold text-slate-800">${modulEscapeHtml(cp.title)}</h5>
                                            <p class="text-xs text-slate-500 leading-relaxed font-medium">${modulEscapeHtml(cp.desc)}</p>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>

                        <!-- Fun Facts Container -->
                        <div class="p-4.5 rounded-2xl space-y-2.5 ${style.funFactBg}">
                            <h5 class="font-bold text-xs text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                                <i class="fa-solid fa-bolt text-amber-500"></i>
                                <span>Tahukah Kamu? / Fun Facts</span>
                            </h5>
                            <ul class="space-y-2 list-none">
                                ${(posterData.funFacts || []).map(f => `
                                    <li class="text-xs font-medium leading-relaxed flex items-start space-x-2">
                                        <span class="text-amber-500 font-black shrink-0">•</span>
                                        <span>${modulEscapeHtml(f)}</span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>

                        <!-- Poster Summary Footer block -->
                        <div class="p-4 bg-gradient-to-r from-pink-500/10 to-indigo-500/10 border border-indigo-100 rounded-2xl flex items-start space-x-3">
                            <i class="fa-solid fa-graduation-cap text-pink-600 text-base mt-0.5 shrink-0"></i>
                            <div class="space-y-0.5">
                                <span class="text-[11px] font-bold text-indigo-600 uppercase tracking-wider block">Intisari / Rangkuman Poster</span>
                                <p class="text-xs text-slate-600 font-semibold italic">"${modulEscapeHtml(posterData.summary || 'Visualisasi ini dirancang untuk mendongkrak daya ingat kritis peserta didik.')}"</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Automatically highlight the first hotspot on load
    if (posterData.hotspots && posterData.hotspots.length > 0) {
        setTimeout(() => {
            window.selectPosterHotspot(posterData.hotspots[0].id, posterData.hotspots[0]);
        }, 150);
    }
};

window.selectPosterHotspot = function(id, data) {
    const displayPanel = document.getElementById('poster-hotspot-display-panel');
    if (!displayPanel) return;

    displayPanel.classList.add('opacity-0');
    displayPanel.classList.add('scale-95');

    setTimeout(() => {
        displayPanel.innerHTML = `
            <div class="flex items-center space-x-2 text-pink-600 mb-1">
                <i class="fa-solid fa-circle-dot text-sm animate-pulse"></i>
                <span class="text-xs font-black uppercase tracking-wider">${modulEscapeHtml(data.label)}</span>
            </div>
            <h5 class="text-sm font-extrabold text-slate-900 leading-tight">${modulEscapeHtml(data.name)}</h5>
            <p class="text-xs text-slate-600 mt-1.5 font-medium leading-relaxed">${modulEscapeHtml(data.description)}</p>
            ${data.details ? `
                <div class="mt-2 pt-2 border-t border-slate-200/50 text-[11px] text-slate-500 font-medium leading-relaxed bg-white/50 p-2 rounded-lg">
                    💡 <strong>Telaah Lebih Dalam:</strong> ${modulEscapeHtml(data.details)}
                </div>
            ` : ''}
        `;
        displayPanel.classList.remove('opacity-0');
        displayPanel.classList.remove('scale-95');
    }, 100);
};

// Export standalone HTML for offline PowerPoint presentation
window.downloadPPTAsHtml = function() {
    if (!window.currentPPTData) return;
    const ppt = window.currentPPTData;
    const slides = ppt.slides || [];

    const htmlContent = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${modulEscapeHtml(ppt.title || 'Presentasi Interaktif')}</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        body { background-color: #090d16; color: #f8fafc; font-family: system-ui, -apple-system, sans-serif; }
    </style>
</head>
<body class="h-screen w-screen flex flex-col justify-between overflow-hidden">
    <!-- Header -->
    <div class="px-6 py-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div class="flex items-center space-x-3">
            <span class="px-3 py-1 bg-indigo-600 text-white font-extrabold text-xs rounded-xl">PPT INTERAKTIF</span>
            <h1 class="font-bold text-base text-white">${modulEscapeHtml(ppt.title || 'Presentasi Interaktif')}</h1>
        </div>
        <div class="text-xs text-slate-400 font-medium">${modulEscapeHtml(ppt.author || 'Madrasah Aliyah')}</div>
    </div>

    <!-- Main Stage -->
    <div id="stage" class="flex-1 p-6 sm:p-12 flex flex-col justify-center items-center overflow-y-auto"></div>

    <!-- Controls -->
    <div class="px-6 py-4 bg-slate-900 border-t border-slate-800 flex items-center justify-between shrink-0">
        <button onclick="prev()" class="px-4 py-2 bg-slate-800 hover:bg-indigo-600 rounded-xl text-xs font-bold text-white transition"><i class="fa-solid fa-chevron-left mr-1"></i> Prev</button>
        <span id="counter" class="text-xs font-mono font-bold text-slate-400">Slide 1 / ${slides.length}</span>
        <button onclick="next()" class="px-4 py-2 bg-slate-800 hover:bg-indigo-600 rounded-xl text-xs font-bold text-white transition">Next <i class="fa-solid fa-chevron-right ml-1"></i></button>
    </div>

    <script>
        const slides = ${modulSafeJsonForScript(slides)};
        let currentIdx = 0;
        function esc(value) {
            return String(value === undefined || value === null ? '' : value)
                .replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[ch]));
        }

        function render() {
            const slide = slides[currentIdx];
            document.getElementById('counter').innerText = 'Slide ' + (currentIdx + 1) + ' / ' + slides.length;
            
            const points = (slide.points || []).map((p, i) => \`
                <div class="p-4 bg-slate-800 border border-slate-700 rounded-2xl flex items-start space-x-3 mb-3">
                    <span class="w-7 h-7 rounded-xl bg-indigo-500/20 text-indigo-400 font-bold flex items-center justify-center shrink-0 text-xs border border-indigo-500/30">\${i+1}</span>
                    <p class="text-sm font-medium text-slate-200">\${esc(p)}</p>
                </div>
            \`).join('');

            document.getElementById('stage').innerHTML = \`
                <div class="max-w-3xl w-full space-y-6">
                    <div class="inline-block px-3 py-1 bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 rounded-xl text-xs font-bold uppercase tracking-wider">\${esc(slide.badge || 'Slide ' + (currentIdx+1))}</div>
                    <h2 class="text-3xl font-black text-white">\${esc(slide.title)}</h2>
                    \${slide.subtitle ? \`<p class="text-indigo-300 font-medium text-sm">\${modulEscapeHtml(slide.subtitle)}</p>\` : ''}
                    <div>\${points}</div>
                    \${slide.keyTakeaway ? \`<div class="p-4 bg-emerald-950/40 border border-emerald-500/30 rounded-2xl text-xs text-emerald-200 font-medium">💡 \${esc(slide.keyTakeaway)}</div>\` : ''}
                </div>
            \`;
        }

        function prev() { if (currentIdx > 0) { currentIdx--; render(); } }
        function next() { if (currentIdx < slides.length - 1) { currentIdx++; render(); } }

        window.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowLeft') prev();
            if (e.key === 'ArrowRight') next();
        });

        render();
    </script>
</body>
</html>`;

    const blob = new Blob([htmlContent], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PPT_Interaktif_${(ppt.title || 'Materi').replace(/[^a-zA-Z0-9]/g, '_')}.html`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('File PPT Interaktif (HTML Standalone) berhasil di-download!', 'success');
};

// Export Slide Outline to Word Document
window.downloadPPTAsDoc = function() {
    if (!window.currentPPTData) return;
    const ppt = window.currentPPTData;
    const slides = ppt.slides || [];

    let docHtml = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head><meta charset='utf-8'><title>${modulEscapeHtml(ppt.title)}</title></head>
        <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h1 style="color: #4f46e5; text-align: center;">${modulEscapeHtml(ppt.title)}</h1>
            <p style="text-align: center; font-size: 14px; color: #666;">${modulEscapeHtml(ppt.subtitle)} | ${modulEscapeHtml(ppt.author)}</p>
            <hr style="margin: 20px 0;">
    `;

    slides.forEach((s, idx) => {
        docHtml += `
            <div style="margin-bottom: 25px; border: 1px solid #e2e8f0; padding: 15px; border-radius: 8px;">
                <h2 style="color: #1e293b; margin-top: 0;">Slide ${idx + 1}: ${modulEscapeHtml(s.title)}</h2>
                ${s.subtitle ? `<p style="color: #6366f1; font-weight: bold;">${modulEscapeHtml(s.subtitle)}</p>` : ''}
                <ul>
                    ${(s.points || []).map(p => `<li>${modulEscapeHtml(p)}</li>`).join('')}
                </ul>
                ${s.keyTakeaway ? `<p style="background: #f0fdf4; border-left: 3px solid #22c55e; padding: 8px; font-size: 12px;"><strong>Key Takeaway:</strong> ${modulEscapeHtml(s.keyTakeaway)}</p>` : ''}
                ${s.teacherNote ? `<p style="background: #fffbeb; border-left: 3px solid #f59e0b; padding: 8px; font-size: 12px;"><strong>Catatan Guru:</strong> ${modulEscapeHtml(s.teacherNote)}</p>` : ''}
            </div>
        `;
    });

    docHtml += `</body></html>`;

    const blob = new Blob(['\ufeff', docHtml], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.getElementById('a') || document.createElement('a');
    a.href = url;
    a.download = `Outline_PPT_${(ppt.title || 'Materi').replace(/[^a-zA-Z0-9]/g, '_')}.doc`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Outline Slide PPT berhasil di-download sebagai Word!', 'success');
};
