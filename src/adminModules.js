import JSZip from 'jszip';

var appState = window.appState || {};
// Admin Modules: Kelas, Guru, Siswa, Jadwal & Mapel

function adminEscapeHtml(value) {
    const raw = String(value ?? '');
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(raw);
    return raw.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function adminEscapeAttr(value) {
    if (typeof window.escapeHtmlAttr === 'function') return window.escapeHtmlAttr(value);
    return adminEscapeHtml(value);
}
function adminInlineArg(value) {
    return adminEscapeAttr(JSON.stringify(String(value ?? '')));
}

window.getClassGrades = function() {
    if (!appState.classGrades || !Array.isArray(appState.classGrades) || appState.classGrades.length === 0) {
        const fromClasses = (appState.classes || []).map(c => c.grade).filter(Boolean);
        const defaultGrades = ['VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
        appState.classGrades = Array.from(new Set([...defaultGrades, ...fromClasses]));
    }
    return appState.classGrades;
};

function renderClassModule(container) {
    if (!appState.teachers) {
        loadTeachersFromServer().then(() => renderClassModule(container));
        container.innerHTML = `<div class="p-8 text-center text-xs text-slate-500 font-semibold"><i class="fa-solid fa-spinner animate-spin text-lg text-emerald-600 block mb-2"></i> Memuat data kelas dan wali kelas...</div>`;
        return;
    }

    const isTeacher = ['teacher', 'guru'].includes(String(appState.role || '').toLowerCase());

    container.innerHTML = `
        <div class="space-y-6 pb-8">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100">
                <div>
                    <h1 class="text-xl sm:text-2xl font-bold text-slate-800">Manajemen Data Kelas</h1>
                    <p class="text-xs text-slate-400 mt-0.5">Tambah, Ubah, Hapus dan Cetak Data Rombongan Belajar</p>
                </div>
                <div class="flex flex-wrap gap-2 w-full sm:w-auto">
                    ${!isTeacher ? `
                        <button type="button" onclick="openClassModal()" class="flex-1 sm:flex-none px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-2xl text-xs shadow-md hover:bg-emerald-700 transition flex items-center justify-center space-x-1.5"><i class="fa-solid fa-plus text-[10px]"></i><span>Tambah Kelas</span></button>
                        <button type="button" onclick="openGradeModal()" class="flex-1 sm:flex-none px-4 py-2.5 bg-indigo-600 text-white font-semibold rounded-2xl text-xs shadow-md hover:bg-indigo-700 transition flex items-center justify-center space-x-1.5"><i class="fa-solid fa-layer-group text-[10px]"></i><span>Tambah / Kelola Tingkat</span></button>
                    ` : ''}
                </div>
            </div>
            <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="overflow-x-auto">
                    <table id="class-table" class="w-full text-left border-collapse min-w-[500px]">
                        <thead>
                            <tr class="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                                <th class="p-4">Kode Kelas</th>
                                <th class="p-4">Nama Kelas</th>
                                <th class="p-4">Tingkat</th>
                                <th class="p-4">Wali Kelas</th>
                                ${!isTeacher ? `<th class="p-4 text-center">Aksi</th>` : ''}
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 text-sm">
                            ${(appState.classes || []).map(c => {
                                const teacher = (appState.teachers || []).find(t => String(t.id) === String(c.homeroomTeacherId || c.homeroom_teacher_id));
                                const teacherName = teacher ? adminEscapeHtml(teacher.name) : '<span class="text-slate-400 italic text-xs">Belum ditentukan</span>';
                                return `
                                    <tr class="hover:bg-slate-50/50 transition">
                                        <td class="p-4 font-mono text-xs font-bold text-emerald-700">${adminEscapeHtml(c.id)}</td>
                                        <td class="p-4 font-semibold text-slate-800">${adminEscapeHtml(c.name)}</td>
                                        <td class="p-4"><span class="px-2.5 py-1 bg-slate-100 rounded-xl text-xs font-semibold">${adminEscapeHtml(c.grade)}</span></td>
                                        <td class="p-4 text-slate-700 font-medium">${teacherName}</td>
                                        ${!isTeacher ? `
                                        <td class="p-4 text-center space-x-2">
                                            <button type="button" onclick="openClassModal(${adminInlineArg(c.id)})" class="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition"><i class="fa-solid fa-pen text-xs"></i></button>
                                            <button type="button" onclick="deleteClass(${adminInlineArg(c.id)})" class="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition"><i class="fa-solid fa-trash text-xs"></i></button>
                                        </td>
                                        ` : ''}
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function filterHomeroomTeachers(searchQuery = '') {
    const listContainer = document.getElementById('homeroom-list-container');
    if (!listContainer) return;
    
    const query = searchQuery.toLowerCase().trim();
    
    if (query === '') {
        const currentTeacher = appState.teachers ? appState.teachers.find(t => String(t.id) === String(appState.tempSelectedTeacherId)) : null;
        let html = '';
        if (currentTeacher) {
            html += `
                <div class="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 text-xs mb-2 text-left">
                    <span class="text-[10px] uppercase font-bold text-emerald-600 block mb-1">Wali Kelas Terpilih:</span>
                    <div class="flex items-center justify-between">
                        <div>
                            <span class="font-bold text-slate-800">${adminEscapeHtml(currentTeacher.name)}</span>
                            <span class="text-[10px] text-slate-500 font-mono block">NIP: ${adminEscapeHtml(currentTeacher.nip || '-')}</span>
                        </div>
                        <button type="button" onclick="appState.tempSelectedTeacherId = ''; filterHomeroomTeachers('')" class="text-rose-600 hover:text-rose-800 font-semibold text-[10px]">Hapus</button>
                    </div>
                </div>
            `;
        }
        html += `<div class="text-xs text-slate-400 p-4 text-center font-medium">Ketik nama atau NIP guru untuk mencari wali kelas...</div>`;
        listContainer.innerHTML = html;
        return;
    }
    
    const teachers = appState.teachers || [];
    const filtered = teachers.filter(t => 
        (t.name && String(t.name).toLowerCase().includes(query)) || 
        (t.nip && String(t.nip).includes(query)) ||
        (t.username && String(t.username).toLowerCase().includes(query))
    );
    
    const isNoneChecked = !appState.tempSelectedTeacherId;
    let html = `
        <label class="flex items-center space-x-2.5 p-2 hover:bg-slate-100 rounded-xl cursor-pointer text-xs transition border-b border-slate-100/50">
            <input type="radio" name="homeroom-teacher-radio" value="" ${isNoneChecked ? 'checked' : ''} onchange="appState.tempSelectedTeacherId = ''; filterHomeroomTeachers('')" class="text-emerald-600 focus:ring-emerald-500 w-4 h-4">
            <div class="flex-1">
                <span class="font-semibold text-slate-500">-- Tanpa Wali Kelas --</span>
            </div>
        </label>
    `;
    
    if (filtered.length === 0) {
        html += `<div class="text-xs text-slate-400 p-4 text-center">Guru tidak ditemukan</div>`;
    } else {
        html += filtered.map(t => {
            const isChecked = String(t.id) === String(appState.tempSelectedTeacherId);
            return `
                <label class="flex items-center space-x-2.5 p-2 hover:bg-emerald-50 rounded-xl cursor-pointer text-xs transition">
                    <input type="radio" name="homeroom-teacher-radio" value="${adminEscapeAttr(t.id)}" ${isChecked ? 'checked' : ''} onchange="appState.tempSelectedTeacherId = this.value; filterHomeroomTeachers('')" class="text-emerald-600 focus:ring-emerald-500 w-4 h-4">
                    <div class="flex-1 text-left">
                        <span class="font-bold text-slate-800 block">${adminEscapeHtml(t.name)}</span>
                        <span class="text-[10px] text-slate-500 font-mono block">NIP: ${adminEscapeHtml(t.nip || '-')}</span>
                    </div>
                </label>
            `;
        }).join('');
    }
    
    listContainer.innerHTML = html;
}

function openClassModal(id = null) {
    const grades = getClassGrades();
    const defaultGrade = grades[0] || 'X';
    const classes = appState.classes || [];
    const item = id ? classes.find(c => String(c.id) === String(id)) : { id: 'C' + (classes.length + 1), name: '', grade: defaultGrade };
    if (!item) return;

    appState.tempSelectedTeacherId = item.homeroomTeacherId || item.homeroom_teacher_id || "";

    let gradeOptionsHtml = grades.map(g => `<option value="${g}" ${item.grade === g ? 'selected' : ''}>${g}</option>`).join('');
    if (item.grade && !grades.includes(item.grade)) {
        gradeOptionsHtml += `<option value="${item.grade}" selected>${item.grade}</option>`;
    }

    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center"><h3 class="font-bold text-slate-800">${id ? 'Edit Kelas' : 'Tambah Kelas'}</h3><button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg"></i></button></div>
                <form onsubmit="saveClass(event, '${id || ''}')" class="space-y-4">
                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Nama Kelas</label>
                        <input type="text" id="cls-name" value="${item.name || ''}" required class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm" placeholder="Contoh: VII-A atau X-IPA-1">
                    </div>
                    <div>
                        <div class="flex justify-between items-center mb-1">
                            <label class="block text-xs font-semibold uppercase text-slate-500">Tingkat</label>
                            <button type="button" onclick="openGradeModal()" class="text-[11px] text-indigo-600 font-bold hover:underline">+ Kelola Tingkat</button>
                        </div>
                        <select id="cls-grade" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold">
                            ${gradeOptionsHtml}
                        </select>
                    </div>
                    
                    <!-- Wali Kelas Search Section -->
                    <div class="border-t border-slate-100 pt-3">
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Pilih Wali Kelas (Pencarian Guru)</label>
                        <div class="relative mb-2">
                            <i class="fa-solid fa-magnifying-glass absolute left-3.5 top-3 text-slate-400 text-xs"></i>
                            <input type="text" id="homeroom-search" oninput="filterHomeroomTeachers(this.value)" placeholder="Cari nama, NIP, atau username guru..." class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs" autocomplete="off">
                        </div>
                        <div id="homeroom-list-container" class="max-h-36 overflow-y-auto border border-slate-200 rounded-2xl p-2 bg-slate-50 space-y-1">
                            <!-- Populated dynamically -->
                        </div>
                    </div>

                    <div class="flex justify-end space-x-2 pt-2">
                        <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 rounded-xl text-xs">Batal</button>
                        <button type="submit" class="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-semibold">Simpan</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    setTimeout(() => filterHomeroomTeachers(''), 50);
}

window.openGradeModal = function() {
    const grades = getClassGrades();
    const modal = document.getElementById('modal-container');
    if (!modal) return;

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-5">
                <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div class="flex items-center space-x-2">
                        <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs">
                            <i class="fa-solid fa-layer-group"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-800 text-sm sm:text-base">Kelola Tingkat Kelas</h3>
                            <p class="text-[10px] text-slate-400 font-medium">Tambah atau atur pilihan tingkat/fase kelas</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg text-slate-400 hover:text-slate-600"></i></button>
                </div>

                <!-- Form Tambah Tingkat Baru -->
                <form onsubmit="addNewGradeLevel(event)" class="space-y-3">
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-600 mb-1">Tambah Tingkat Baru</label>
                        <div class="flex space-x-2">
                            <input type="text" id="new-grade-input" required placeholder="Contoh: VII, VIII, IX, X, XI, XII, 1, 2..." class="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500">
                            <button type="submit" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs shadow transition shrink-0 flex items-center space-x-1">
                                <i class="fa-solid fa-plus text-[10px]"></i><span>Tambah</span>
                            </button>
                        </div>
                    </div>
                </form>

                <!-- Daftar Tingkat yang Tersedia -->
                <div class="space-y-2">
                    <label class="block text-xs font-bold uppercase text-slate-500">Daftar Tingkat Terdaftar (${grades.length})</label>
                    <div class="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-3 bg-slate-50 border border-slate-200/80 rounded-2xl">
                        ${grades.map(g => `
                            <div class="flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl shadow-sm text-xs font-bold text-slate-800">
                                <span>${g.replace(/</g, '&lt;')}</span>
                                <button type="button" onclick="deleteGradeLevel('${g.replace(/'/g, "\\'")}')" class="text-slate-400 hover:text-rose-600 ml-1 text-[11px]" title="Hapus tingkat ini">
                                    <i class="fa-solid fa-xmark"></i>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <div class="flex justify-end pt-2">
                    <button type="button" onclick="closeModal()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition">Selesai</button>
                </div>
            </div>
        </div>
    `;
};

window.addNewGradeLevel = function(e) {
    e.preventDefault();
    const input = document.getElementById('new-grade-input');
    if (!input) return;
    const val = input.value.trim().toUpperCase();
    if (!val) return;

    const grades = getClassGrades();
    if (grades.includes(val)) {
        showToast(`Tingkat ${val} sudah ada dalam daftar.`, 'warning');
        return;
    }

    grades.push(val);
    appState.classGrades = grades;
    saveState('classGrades');
    showToast(`Tingkat ${val} berhasil ditambahkan!`, 'success');
    openGradeModal();
    if (document.getElementById('view-container')) {
        renderClassModule(document.getElementById('view-container'));
    }
};

window.deleteGradeLevel = function(gradeVal) {
    showConfirmModal(`Apakah Anda yakin ingin menghapus tingkat '${gradeVal}' dari daftar?`, () => {
        let grades = getClassGrades();
        grades = grades.filter(g => g !== gradeVal);
        appState.classGrades = grades;
        saveState('classGrades');
        showToast(`Tingkat ${gradeVal} telah dihapus!`, 'success');
        openGradeModal();
        if (document.getElementById('view-container')) {
            renderClassModule(document.getElementById('view-container'));
        }
    });
};

async function saveClass(e, id) {
    if (e) e.preventDefault();
    const nameInput = document.getElementById('cls-name');
    const gradeInput = document.getElementById('cls-grade');
    if (!nameInput) return;
    const name = nameInput.value.trim();
    const grade = gradeInput ? gradeInput.value.trim() : 'X';
    if (!name) { showToast('Nama kelas wajib diisi!', 'error'); return; }

    try {
        const response = await fetch('/api/classes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: id || null, name, grade, homeroomTeacherId: appState.tempSelectedTeacherId })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menyimpan kelas.');

        const savedClass = data.class;
        const idx = appState.classes.findIndex(c => String(c.id) === String(id));
        if (idx >= 0) appState.classes[idx] = savedClass;
        else appState.classes.push(savedClass);

        // Sync local teachers to have updated homeroom_class_id
        if (appState.teachers) {
            appState.teachers.forEach(t => {
                if (String(t.id) === String(appState.tempSelectedTeacherId)) {
                    t.homeroom_class_id = String(savedClass.id);
                } else if (String(t.homeroom_class_id) === String(savedClass.id)) {
                    t.homeroom_class_id = "";
                }
            });
            saveState('teachers');
        }

        saveState('classes');
        closeModal();
        showToast('Kelas berhasil disimpan!', 'success');

        const container = document.getElementById('view-container');
        if (container) {
            if (appState.currentRoute === 'jadwal') {
                renderScheduleModule(container);
            } else if (appState.currentRoute === 'kelas') {
                renderClassModule(container);
            } else {
                renderScheduleModule(container);
            }
        }
    } catch (err) {
        showToast(err.message || 'Gagal menyimpan kelas', 'error');
    }
}

async function deleteClass(id) {
    const targetClass = (appState.classes || []).find(c => String(c.id) === String(id));
    const className = targetClass ? String(targetClass.name || targetClass.code || id) : String(id);
    showConfirmModal(`Hapus kelas "${className}"? Kelas yang masih memiliki siswa atau dipakai data akademik akan ditolak oleh server.`, async () => {
        try {
            const res = await fetch(`/api/classes/${id}`, { method: 'DELETE' });
            const data = await res.json().catch(() => null);
            if (!res.ok || !data || !data.success) {
                const err = new Error((data && data.message) || 'Gagal menghapus kelas');
                err.code = data && data.code ? data.code : '';
                err.references = data && data.references ? data.references : null;
                throw err;
            }

            appState.classes = (appState.classes || []).filter(c => String(c.id) !== String(id));
            saveState('classes');
            showToast(`Kelas "${className}" berhasil dihapus.`, 'success');

            const container = document.getElementById('view-container');
            if (container) {
                if (appState.currentRoute === 'jadwal') {
                    renderScheduleModule(container);
                } else if (appState.currentRoute === 'kelas') {
                    renderClassModule(container);
                } else {
                    renderScheduleModule(container);
                }
            }
        } catch (err) {
            showToast(err.message || 'Gagal menghapus kelas', 'error');
        }
    });
}

function openKelolaKelasModal() {
    const modal = document.getElementById('modal-container');
    if (!modal) return;

    const classes = appState.classes || [];
    const teachers = appState.teachers || [];

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-6 space-y-5 max-h-[90vh] flex flex-col">
                <div class="flex justify-between items-center pb-3 border-b border-slate-100 shrink-0">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-lg">
                            <i class="fa-solid fa-layer-group"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-slate-800 text-base sm:text-lg">Kelola & Edit Kelas</h3>
                            <p class="text-xs text-slate-400">Tambah, ubah nama/tingkat, atau hapus kelas pada roster</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition cursor-pointer">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <div class="flex justify-between items-center bg-slate-50 p-3.5 rounded-2xl border border-slate-150 shrink-0">
                    <span class="text-xs font-bold text-slate-600 uppercase tracking-wider">Total Terdaftar: ${classes.length} Kelas</span>
                    <button type="button" onclick="openClassModal()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-sm transition flex items-center space-x-1.5 cursor-pointer">
                        <i class="fa-solid fa-plus text-xs"></i>
                        <span>+ Tambah Kelas Baru</span>
                    </button>
                </div>

                <div class="flex-1 overflow-y-auto space-y-2.5 pr-1">
                    ${classes.length > 0 ? classes.map(c => {
                        const teacher = teachers.find(t => String(t.id) === String(c.homeroomTeacherId || c.homeroom_teacher_id));
                        const teacherName = teacher ? teacher.name : 'Belum ditentukan';
                        return `
                            <div class="flex items-center justify-between p-3.5 bg-white border border-slate-200/80 hover:border-emerald-300 rounded-2xl transition shadow-xs">
                                <div class="flex items-center space-x-3 truncate">
                                    <span class="px-2.5 py-1 bg-emerald-100 text-emerald-800 font-extrabold rounded-xl text-xs">${c.grade || 'X'}</span>
                                    <div class="truncate">
                                        <h4 class="font-extrabold text-slate-800 text-sm truncate">${c.name}</h4>
                                        <p class="text-[11px] text-slate-500 truncate"><i class="fa-solid fa-user-tie text-[10px] mr-1 text-slate-400"></i>Wali Kelas: ${teacherName}</p>
                                    </div>
                                </div>
                                <div class="flex items-center space-x-1.5 shrink-0 ml-2">
                                    <button type="button" onclick="openClassModal('${c.id}')" class="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-xl text-xs transition flex items-center space-x-1 cursor-pointer">
                                        <i class="fa-solid fa-pen text-[10px]"></i>
                                        <span>Edit</span>
                                    </button>
                                    <button type="button" onclick="deleteClass('${c.id}')" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-xl text-xs transition flex items-center space-x-1 cursor-pointer">
                                        <i class="fa-solid fa-trash text-[10px]"></i>
                                        <span>Hapus</span>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('') : `
                        <div class="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-2xl">
                            <p class="text-xs text-slate-400 italic">Belum ada kelas terdaftar. Klik "+ Tambah Kelas Baru" untuk menambahkan.</p>
                        </div>
                    `}
                </div>

                <div class="flex justify-end pt-3 border-t border-slate-100 shrink-0">
                    <button type="button" onclick="closeModal()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition cursor-pointer">Tutup</button>
                </div>
            </div>
        </div>
    `;
}

// Teacher Module
async function renderTeacherModule(container) {
    await loadTeachersFromServer();
    container.innerHTML = `
        <div class="space-y-6 pb-8">
            <div class="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div><h1 class="text-xl sm:text-2xl font-bold text-slate-800">Manajemen Data Guru</h1><p class="text-xs text-slate-400">Tambah, ubah data profil, foto, dan akun login dewan guru</p></div>
                <button type="button" onclick="openTeacherModal()" class="px-4 py-2.5 bg-emerald-600 text-white font-semibold rounded-2xl text-xs shadow hover:bg-emerald-700 transition flex items-center gap-2 cursor-pointer">
                    <i class="fa-solid fa-user-plus text-xs"></i>
                    <span>Tambah Guru</span>
                </button>
            </div>
            <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse min-w-[700px]">
                        <thead>
                            <tr class="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                                <th class="p-4 w-12 text-center">No</th>
                                <th class="p-4">NIP / NUPTK</th>
                                <th class="p-4 text-center">Profil</th>
                                <th class="p-4">Nama Lengkap</th>
                                <th class="p-4">Mata Pelajaran</th>
                                <th class="p-4">Kontak / HP</th>
                                <th class="p-4">Username</th>
                                <th class="p-4 text-center">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 text-sm">
                            ${(appState.teachers || []).map((t, idx) => {
                                const tMapels = (Array.isArray(t.mapel) ? t.mapel : (t.mapel ? [t.mapel] : [])).join(', ');
                                const teacherPhone = t.phone || t.no_hp || '';
                                return `
                                    <tr class="hover:bg-slate-50/50 transition">
                                        <td class="p-4 text-center text-xs text-slate-400">${idx + 1}</td>
                                        <td class="p-4 font-mono text-xs font-bold text-emerald-700">
                                            <div>${t.nip || '-'}</div>
                                            ${t.nuptk ? `<div class="text-[10px] text-slate-400 font-normal">NUPTK: ${t.nuptk}</div>` : ''}
                                        </td>
                                        <td class="p-4 text-center">
                                            <div class="w-11 h-11 rounded-2xl overflow-hidden mx-auto shadow-xs border border-slate-200 bg-slate-100 flex items-center justify-center cursor-pointer hover:scale-105 transition" onclick="${t.photo ? `showPhotoPopup('${t.photo}', 'Foto Profil - ${t.name.replace(/'/g, "\\'")}')` : `openTeacherModal('${t.id}')`}" title="${t.photo ? 'Klik untuk memperbesar foto' : 'Klik untuk tambah foto'}">
                                                ${t.photo ? `<img src="${window.getPhotoHtmlSrc ? window.getPhotoHtmlSrc(t.photo) : ''}" class="w-full h-full object-cover" referrerPolicy="no-referrer">` : `<i class="fa-solid fa-chalkboard-user text-slate-400 text-base"></i>`}
                                            </div>
                                        </td>
                                        <td class="p-4 font-semibold text-slate-800">
                                            <div>${t.name}</div>
                                            ${t.email ? `<div class="text-[11px] text-slate-400 font-normal"><i class="fa-regular fa-envelope text-slate-400 mr-1"></i>${t.email}</div>` : ''}
                                        </td>
                                        <td class="p-4"><span class="px-2.5 py-1 bg-teal-50 text-teal-700 rounded-xl text-xs">${tMapels || 'Umum'}</span></td>
                                        <td class="p-4 font-mono text-xs text-slate-600">
                                            ${teacherPhone ? `<a href="https://wa.me/${teacherPhone.replace(/[^0-9]/g, '')}" target="_blank" class="inline-flex items-center gap-1 text-emerald-700 hover:underline"><i class="fa-brands fa-whatsapp text-emerald-600"></i> ${teacherPhone}</a>` : '<span class="text-slate-400">-</span>'}
                                        </td>
                                        <td class="p-4 font-mono text-xs text-slate-600">${t.username}</td>
                                        <td class="p-4 text-center space-x-2 whitespace-nowrap">
                                            <button type="button" onclick="openTeacherModal('${t.id}')" class="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition cursor-pointer" title="Edit Profil & Data Guru"><i class="fa-solid fa-pen text-xs"></i></button>
                                            <button type="button" onclick="deleteTeacher('${t.id}')" class="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition cursor-pointer" title="Hapus Guru"><i class="fa-solid fa-trash text-xs"></i></button>
                                        </td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function openTeacherModal(id = null) {
    const teachers = appState.teachers || [];
    const subjects = appState.subjects || [];
    const item = id ? teachers.find(t => String(t.id) === String(id)) : { 
        id: '', 
        nip: '', 
        nuptk: '',
        name: '', 
        mapel: [subjects[0]?.name || 'Fikih'], 
        phone: '',
        email: '',
        address: '',
        gender: 'L',
        bio: '',
        username: '', 
        password: '',
        photo: ''
    };
    if (!item) return;

    const modal = document.getElementById('modal-container');
    const teacherMapels = Array.isArray(item.mapel) ? item.mapel : (item.mapel ? [item.mapel] : []);
    const phoneVal = item.phone || item.no_hp || '';
    const genderVal = item.gender || item.jenis_kelamin || 'L';
    const addressVal = item.address || item.alamat || '';

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center border-b pb-3">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <i class="fa-solid fa-chalkboard-user"></i>
                        </div>
                        <h3 class="font-bold text-slate-800">${id ? 'Edit Profil & Akun Guru' : 'Tambah Data Guru Baru'}</h3>
                    </div>
                    <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center cursor-pointer"><i class="fa-solid fa-xmark text-sm"></i></button>
                </div>

                <!-- Foto Profil Section -->
                <div class="flex items-center gap-4 bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80">
                    <div class="relative group shrink-0">
                        <div id="admin-tch-photo-preview" class="w-16 h-16 bg-emerald-100 text-emerald-800 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-inner overflow-hidden border-2 border-emerald-500/20">
                            ${item.photo ? `<img src="${window.getPhotoHtmlSrc ? window.getPhotoHtmlSrc(item.photo) : ''}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-user-tie text-emerald-600 text-xl"></i>`}
                        </div>
                    </div>
                    <div class="flex-1 space-y-1.5">
                        <div class="text-xs font-bold text-slate-700">Foto Profil Guru</div>
                        <p class="text-[11px] text-slate-400">Dapat diunggah dari file atau foto kamera langsung</p>
                        <div class="flex items-center gap-2 pt-1">
                            <label class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold cursor-pointer transition flex items-center gap-1.5">
                                <i class="fa-solid fa-upload text-[10px]"></i>
                                <span>Pilih Foto</span>
                                <input type="file" id="admin-tch-file-input" accept="image/*" class="hidden" onchange="previewAdminTeacherPhoto(event)">
                            </label>
                            ${item.photo ? `
                            <button type="button" onclick="removeAdminTeacherPhoto()" class="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-semibold transition">Hapus Foto</button>
                            ` : ''}
                        </div>
                    </div>
                    <input type="hidden" id="tch-photo-base64" value="${item.photo || ''}">
                </div>

                <form onsubmit="saveTeacher(event, '${id || ''}')" class="space-y-3 text-xs sm:text-sm">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">NIP</label>
                            <input type="text" id="tch-nip" value="${item.nip || ''}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono" placeholder="19800101...">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">NUPTK (Opsional)</label>
                            <input type="text" id="tch-nuptk" value="${item.nuptk || ''}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono" placeholder="Nomor Unik...">
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Nama Lengkap & Gelar</label>
                        <input type="text" id="tch-name" value="${item.name || ''}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl" placeholder="Nama Guru, S.Pd., M.Pd.">
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">No. HP / WhatsApp</label>
                            <input type="tel" id="tch-phone" value="${phoneVal}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono" placeholder="081234567890">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Email</label>
                            <input type="email" id="tch-email" value="${item.email || ''}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl" placeholder="guru@madrasah.sch.id">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Jenis Kelamin</label>
                            <select id="tch-gender" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer">
                                <option value="L" ${genderVal === 'L' ? 'selected' : ''}>Laki-laki</option>
                                <option value="P" ${genderVal === 'P' ? 'selected' : ''}>Perempuan</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Alamat Tinggal</label>
                            <input type="text" id="tch-address" value="${addressVal}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl" placeholder="Kota / Kabupaten">
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Mata Pelajaran yang Diampu</label>
                        <div class="space-y-1.5 max-h-32 overflow-y-auto p-2.5 bg-slate-50 border border-slate-200 rounded-2xl">
                            ${(appState.subjects || []).map(s => {
                                const isChecked = teacherMapels.includes(s.name);
                                return `<label class="flex items-center space-x-2 text-xs cursor-pointer"><input type="checkbox" name="tch-mapels" value="${s.name}" ${isChecked ? 'checked' : ''} class="rounded text-emerald-600"><span>${s.name} (${s.code || ''})</span></label>`;
                            }).join('')}
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-100">
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Username Login</label>
                            <input type="text" id="tch-user" value="${item.username || ''}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Password</label>
                            <input type="password" id="tch-pass" value="" autocomplete="new-password" minlength="8" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono" placeholder="${id ? 'Kosongkan jika tidak ingin mengganti password' : 'Kosongkan untuk password sementara otomatis'}">
                            <p class="text-[10px] text-slate-400 mt-1">${id ? 'Password lama tersimpan sebagai hash dan tidak ditampilkan.' : 'Jika dikosongkan, sistem membuat password sementara acak dan menampilkannya satu kali.'}</p>
                        </div>
                    </div>

                    <div class="flex justify-end space-x-2 pt-3 border-t">
                        <button type="button" onclick="closeModal()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-2xl font-semibold text-slate-700 transition cursor-pointer">Batal</button>
                        <button type="submit" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold shadow-md shadow-emerald-600/20 transition cursor-pointer">Simpan Data Guru</button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

function previewAdminTeacherPhoto(event) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        let base64 = e.target.result;
        if (window.compressBase64Image) {
            base64 = await window.compressBase64Image(base64);
        }
        const hiddenInp = document.getElementById('tch-photo-base64');
        if (hiddenInp) hiddenInp.value = base64;

        const previewBox = document.getElementById('admin-tch-photo-preview');
        if (previewBox) {
            previewBox.innerHTML = `<img src="${base64}" class="w-full h-full object-cover">`;
        }
    };
    reader.readAsDataURL(file);
}

function removeAdminTeacherPhoto() {
    const hiddenInp = document.getElementById('tch-photo-base64');
    if (hiddenInp) hiddenInp.value = '';
    const previewBox = document.getElementById('admin-tch-photo-preview');
    if (previewBox) {
        previewBox.innerHTML = `<i class="fa-solid fa-user-tie text-emerald-600 text-xl"></i>`;
    }
}

function showTeacherTemporaryCredential(credential) {
    if (!credential || !credential.temporaryPassword) return;
    try {
        const existing = JSON.parse(sessionStorage.getItem('teacher_temporary_credentials') || '[]');
        const list = Array.isArray(existing) ? existing.filter(item => String(item?.teacherId || '') !== String(credential.teacherId || '')) : [];
        list.push({
            teacherId: String(credential.teacherId || ''),
            username: String(credential.username || ''),
            temporaryPassword: String(credential.temporaryPassword || '')
        });
        sessionStorage.setItem('teacher_temporary_credentials', JSON.stringify(list));
    } catch (_) {}

    const overlay = document.createElement('div');
    overlay.className = 'fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4';
    const card = document.createElement('div');
    card.className = 'bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4';
    card.innerHTML = `
        <div class="w-12 h-12 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl"><i class="fa-solid fa-key"></i></div>
        <div>
            <h3 class="font-black text-slate-900 text-base">Password Sementara Guru</h3>
            <p class="text-xs text-slate-500 mt-1">Simpan sekarang. Password ini hanya ditampilkan setelah akun dibuat.</p>
        </div>
        <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
            <div><span class="text-slate-500">Username:</span> <strong id="teacher-temp-user" class="font-mono text-slate-900"></strong></div>
            <div><span class="text-slate-500">Password:</span> <strong id="teacher-temp-pass" class="font-mono text-amber-700"></strong></div>
        </div>
        <div class="flex justify-end gap-2">
            <button type="button" id="teacher-temp-copy" class="px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold">Salin</button>
            <button type="button" id="teacher-temp-close" class="px-4 py-2.5 bg-slate-800 text-white rounded-xl text-xs font-bold">Tutup</button>
        </div>
    `;
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    const userEl = card.querySelector('#teacher-temp-user');
    const passEl = card.querySelector('#teacher-temp-pass');
    if (userEl) userEl.textContent = String(credential.username || '');
    if (passEl) passEl.textContent = String(credential.temporaryPassword || '');
    card.querySelector('#teacher-temp-copy')?.addEventListener('click', async () => {
        const value = `Username: ${credential.username || ''}\nPassword: ${credential.temporaryPassword || ''}`;
        try {
            await navigator.clipboard.writeText(value);
            showToast('Kredensial guru berhasil disalin.', 'success');
        } catch (_) {
            showToast('Salin manual username dan password yang tampil.', 'info');
        }
    });
    card.querySelector('#teacher-temp-close')?.addEventListener('click', () => overlay.remove());
}

async function saveTeacher(e, id) {
    e.preventDefault();
    const nip = document.getElementById('tch-nip').value.trim();
    const nuptk = (document.getElementById('tch-nuptk')?.value || '').trim();
    const name = document.getElementById('tch-name').value.trim();
    const phone = (document.getElementById('tch-phone')?.value || '').trim();
    const email = (document.getElementById('tch-email')?.value || '').trim();
    const gender = document.getElementById('tch-gender')?.value || 'L';
    const address = (document.getElementById('tch-address')?.value || '').trim();
    const username = document.getElementById('tch-user').value.trim();
    const password = document.getElementById('tch-pass').value;
    const photo = document.getElementById('tch-photo-base64')?.value || '';
    const mapel = Array.from(document.querySelectorAll('input[name="tch-mapels"]:checked')).map(cb => cb.value);

    if (!nip || !name || !username) { showToast('NIP, Nama, Username wajib diisi.', 'error'); return; }

    const url = id && id !== 'null' ? `/api/teachers/${id}` : '/api/teachers';
    const method = id && id !== 'null' ? 'PUT' : 'POST';

    try {
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                nip, 
                nuptk, 
                name, 
                phone, 
                no_hp: phone, 
                email, 
                gender, 
                jenis_kelamin: gender, 
                address, 
                alamat: address, 
                username, 
                password, 
                photo, 
                mapel 
            })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menyimpan guru.');

        const generatedCredential = Array.isArray(data.credentials) && data.credentials.length > 0 ? data.credentials[0] : null;
        await loadTeachersFromServer();
        closeModal();
        showToast('Data guru berhasil disimpan!', 'success');
        renderTeacherModule(document.getElementById('view-container'));
        if (generatedCredential) showTeacherTemporaryCredential(generatedCredential);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function loadTeachersFromServer() {
    try {
        const response = await fetch('/api/teachers');
        const data = await response.json();
        if (response.ok && data.success) {
            appState.teachers = data.teachers;
            try {
                localStorage.setItem('madrasah_teachers', JSON.stringify(appState.teachers));
            } catch (e) {
                console.warn('LocalStorage error:', e);
            }
        }
    } catch (err) {
        console.error('Error loading teachers:', err);
    }
}

async function deleteTeacher(id) {
    showConfirmModal('Apakah Anda yakin ingin menghapus guru ini?', async () => {
        try {
            const res = await fetch(`/api/teachers/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Gagal menghapus guru');

            appState.teachers = (appState.teachers || []).filter(t => String(t.id) !== String(id));
            saveState('teachers');
            showToast('Guru berhasil dihapus!', 'success');
            renderTeacherModule(document.getElementById('view-container'));
        } catch (err) {
            showToast(err.message || 'Gagal menghapus guru', 'error');
        }
    });
}

// Teacher Profile Self-Management (Akun Guru: Edit Profil & Foto)
function renderTeacherProfile(container) {
    const currentId = appState.currentUser && appState.currentUser.id;
    const tch = currentId 
        ? ((appState.teachers || []).find(t => String(t.id) === String(currentId)) || appState.currentUser)
        : (appState.teachers && appState.teachers[0] ? appState.teachers[0] : {});

    const teacherMapels = Array.isArray(tch.mapel) ? tch.mapel : (tch.mapel ? [tch.mapel] : []);
    const phoneVal = tch.phone || tch.no_hp || '';
    const addressVal = tch.address || tch.alamat || '';
    const genderVal = tch.gender || tch.jenis_kelamin || 'L';
    const photoHistory = Array.isArray(tch.photoHistory) ? tch.photoHistory : [];

    container.innerHTML = `
        <div class="space-y-6 max-w-3xl mx-auto pb-10">
            <!-- Header Banner -->
            <div class="bg-white border border-slate-200/80 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
                <div class="flex flex-col sm:flex-row items-center sm:items-start gap-6 border-b border-slate-100 pb-6">
                    <div class="relative group shrink-0">
                        <div class="w-28 h-28 bg-emerald-50 text-emerald-800 rounded-3xl flex items-center justify-center text-4xl font-bold shadow-inner overflow-hidden border-2 border-emerald-500/30">
                            ${tch.photo ? `<img src="${window.getPhotoHtmlSrc ? window.getPhotoHtmlSrc(tch.photo) : ''}" class="w-full h-full object-cover" referrerPolicy="no-referrer">` : `<i class="fa-solid fa-chalkboard-user text-emerald-600"></i>`}
                        </div>
                        <button type="button" onclick="openTeacherPhotoSourceModal('${tch.id}')" class="absolute -bottom-2 -right-2 p-2.5 bg-emerald-600 text-white rounded-2xl cursor-pointer shadow-md hover:bg-emerald-700 hover:scale-105 active:scale-95 transition" title="Ganti Foto Profil Guru">
                            <i class="fa-solid fa-camera text-xs"></i>
                        </button>
                        <input type="file" id="teacher-gallery-input-${tch.id}" accept="image/*" class="hidden" onchange="uploadTeacherPhoto(event, '${tch.id}')">
                    </div>

                    <div class="text-center sm:text-left flex-1 space-y-1.5">
                        <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                            <span class="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold uppercase tracking-wider">Dewan Guru</span>
                            ${genderVal === 'P' ? '<span class="px-2.5 py-0.5 bg-rose-50 text-rose-700 rounded-full text-xs">Ustadzah</span>' : '<span class="px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">Ustadz</span>'}
                        </div>
                        <h1 class="text-xl sm:text-2xl font-extrabold text-slate-900">${tch.name || 'Dewan Guru'}</h1>
                        <p class="text-xs text-slate-500 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                            <span>NIP: <strong class="font-mono text-slate-800">${tch.nip || '-'}</strong></span>
                            ${tch.nuptk ? `<span>&bull;</span> <span>NUPTK: <strong class="font-mono text-slate-800">${tch.nuptk}</strong></span>` : ''}
                        </p>
                        <div class="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
                            ${teacherMapels.map(m => `<span class="px-2.5 py-0.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-xl text-xs font-semibold">${m}</span>`).join('') || '<span class="text-xs text-slate-400">Guru Umum</span>'}
                        </div>
                    </div>
                </div>

                <!-- Form Edit Profil Guru -->
                <form onsubmit="saveTeacherProfileSelf(event, '${tch.id}')" class="space-y-4 text-xs sm:text-sm">
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-600 mb-1">Nama Lengkap & Gelar</label>
                            <input type="text" id="prof-tch-name" value="${tch.name || ''}" required class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 font-semibold focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition">
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-600 mb-1">NIP (Nomor Induk Pegawai)</label>
                            <input type="text" id="prof-tch-nip" value="${tch.nip || ''}" required class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition">
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-600 mb-1">NUPTK (Jika Ada)</label>
                            <input type="text" id="prof-tch-nuptk" value="${tch.nuptk || ''}" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition" placeholder="Nomor Unik Pendidik...">
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-600 mb-1">Jenis Kelamin</label>
                            <select id="prof-tch-gender" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 cursor-pointer focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition">
                                <option value="L" ${genderVal === 'L' ? 'selected' : ''}>Laki-laki</option>
                                <option value="P" ${genderVal === 'P' ? 'selected' : ''}>Perempuan</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-600 mb-1">No. WhatsApp / HP</label>
                            <input type="tel" id="prof-tch-phone" value="${phoneVal}" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition" placeholder="Contoh: 081234567890">
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-600 mb-1">Email Guru</label>
                            <input type="email" id="prof-tch-email" value="${tch.email || ''}" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition" placeholder="nama.guru@gmail.com">
                        </div>
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-600 mb-1">Alamat Tinggal / Domisili</label>
                        <input type="text" id="prof-tch-address" value="${addressVal}" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition" placeholder="Alamat lengkap...">
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-600 mb-1">Catatan / Bio Singkat Guru</label>
                        <textarea id="prof-tch-bio" rows="2" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition" placeholder="Moto mengajar atau deskripsi singkat...">${tch.bio || ''}</textarea>
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-600 mb-1">Username Akun</label>
                            <input type="text" id="prof-tch-user" value="${tch.username || ''}" required class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition">
                        </div>
                        <div>
                            <label class="block text-xs font-bold uppercase text-slate-600 mb-1">Password Baru</label>
                            <input type="text" id="prof-tch-pass" value="${tch.password || ''}" required class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none transition">
                        </div>
                    </div>

                    <div class="flex justify-end pt-3">
                        <button type="submit" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-bold rounded-2xl shadow-md shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer">
                            <i class="fa-solid fa-check"></i>
                            <span>Simpan Perubahan Profil</span>
                        </button>
                    </div>
                </form>
            </div>

            <!-- Riwayat Foto Profil -->
            ${photoHistory.length > 0 ? `
            <div class="bg-white border border-slate-200/80 rounded-3xl p-6 shadow-xs space-y-3">
                <div class="flex items-center justify-between border-b pb-3">
                    <h3 class="font-bold text-sm text-slate-800 flex items-center gap-2">
                        <i class="fa-solid fa-images text-emerald-600"></i>
                        <span>Koleksi Riwayat Foto Guru</span>
                    </h3>
                    <span class="text-xs text-slate-400">${photoHistory.length} Foto</span>
                </div>
                <div class="flex flex-wrap gap-3 pt-1">
                    ${photoHistory.map((h, i) => {
                        const photoSrc = typeof h === 'string' ? h : h.photo;
                        const dateStr = (typeof h === 'object' && h.date) ? h.date : '-';
                        return `
                            <div class="w-20 group relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 p-1 text-center">
                                <img src="${window.getPhotoHtmlSrc ? window.getPhotoHtmlSrc(photoSrc) : ''}" class="w-full h-16 object-cover rounded-xl cursor-pointer hover:scale-105 transition" onclick="showPhotoPopup('${photoSrc}', 'Riwayat Foto Guru (${dateStr})')">
                                <div class="text-[9px] text-slate-400 mt-1 truncate">${dateStr}</div>
                                <button type="button" onclick="applyTeacherHistoryPhoto('${tch.id}', ${i})" class="w-full mt-1 py-0.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-[9px] transition cursor-pointer">Gunakan</button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
            ` : ''}
        </div>
    `;
}

function openTeacherPhotoSourceModal(teacherId) {
    const modal = document.getElementById('modal-container');
    if (!modal) return;
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100 p-6 space-y-6">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                            <i class="fa-solid fa-camera-retro"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-base text-slate-850">Ganti Foto Profil Guru</h3>
                            <p class="text-xs text-slate-500">Pilih sumber pengambilan foto Anda</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button type="button" onclick="openTeacherCameraCaptureModal('${teacherId}')" class="group p-5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl text-center flex flex-col items-center justify-center space-y-3 transition cursor-pointer shadow-xs">
                        <div class="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center text-xl shadow group-hover:scale-110 transition-transform">
                            <i class="fa-solid fa-camera"></i>
                        </div>
                        <div>
                            <p class="font-bold text-sm text-emerald-900">Ambil dari Kamera</p>
                            <p class="text-[11px] text-emerald-700 mt-0.5">Gunakan kamera perangkat langsung</p>
                        </div>
                    </button>

                    <button type="button" onclick="closeModal(); const inp = document.getElementById('teacher-gallery-input-${teacherId}'); if(inp) inp.click();" class="group p-5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-2xl text-center flex flex-col items-center justify-center space-y-3 transition cursor-pointer shadow-xs">
                        <div class="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl shadow group-hover:scale-110 transition-transform">
                            <i class="fa-solid fa-images"></i>
                        </div>
                        <div>
                            <p class="font-bold text-sm text-blue-900">Ambil di Galeri</p>
                            <p class="text-[11px] text-blue-700 mt-0.5">Pilih file foto dari memori</p>
                        </div>
                    </button>
                </div>

                <div class="pt-2 text-center">
                    <button type="button" onclick="closeModal()" class="text-xs font-semibold text-slate-500 hover:text-slate-700">Batal</button>
                </div>
            </div>
        </div>
    `;
}

let _activeTeacherProfileCamStream = null;

async function openTeacherCameraCaptureModal(teacherId) {
    const modal = document.getElementById('modal-container');
    if (!modal) return;
    
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
            <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 p-6 space-y-5">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div class="flex items-center gap-2">
                        <div class="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <i class="fa-solid fa-camera"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-base text-slate-850">Kamera Foto Profil Guru</h3>
                            <p class="text-xs text-slate-500">Posisikan wajah Anda dengan rapi</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeTeacherCameraModal()" class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="relative w-full h-72 bg-slate-900 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
                    <video id="teacher-profile-cam-video" autoplay muted playsinline class="w-full h-full object-cover" style="transform: scaleX(-1);"></video>
                    <canvas id="teacher-profile-cam-canvas" class="hidden"></canvas>
                    <div id="teacher-profile-cam-loading" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white p-4">
                        <i class="fa-solid fa-spinner fa-spin text-2xl text-emerald-400 mb-2"></i>
                        <p class="text-xs text-emerald-200 font-semibold">Mengakses kamera perangkat...</p>
                    </div>
                </div>

                <div class="flex items-center justify-between pt-2">
                    <button type="button" onclick="closeTeacherCameraModal()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer">
                        Kembali
                    </button>
                    <button type="button" onclick="snapTeacherCameraPhoto('${teacherId}')" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-2 cursor-pointer">
                        <i class="fa-solid fa-camera"></i> Ambil Foto Profil
                    </button>
                </div>
            </div>
        </div>
    `;

    const video = document.getElementById('teacher-profile-cam-video');
    const loading = document.getElementById('teacher-profile-cam-loading');
    try {
        const stream = await window.requestCameraStream();
        _activeTeacherProfileCamStream = stream;
        if (video) {
            video.srcObject = stream;
            video.play().catch(e => console.warn('Video play err:', e));
        }
        if (loading) loading.style.display = 'none';
    } catch (err) {
        if (loading) {
            loading.innerHTML = `
                <div class="text-center p-4 space-y-2">
                    <i class="fa-solid fa-triangle-exclamation text-rose-400 text-2xl"></i>
                    <p class="text-xs font-bold text-rose-200">Gagal mengakses kamera</p>
                    <p class="text-[10px] text-slate-300">Pastikan izin kamera di browser Anda sudah diaktifkan.</p>
                </div>
            `;
        }
    }
}

function closeTeacherCameraModal() {
    if (_activeTeacherProfileCamStream) {
        try {
            _activeTeacherProfileCamStream.getTracks().forEach(t => t.stop());
        } catch(e) {}
        _activeTeacherProfileCamStream = null;
    }
    const modal = document.getElementById('modal-container');
    if (modal) modal.innerHTML = '';
}

async function snapTeacherCameraPhoto(teacherId) {
    const video = document.getElementById('teacher-profile-cam-video');
    const canvas = document.getElementById('teacher-profile-cam-canvas');
    if (!video || !canvas) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);

    const rawBase64 = canvas.toDataURL('image/jpeg', 0.88);
    const base64Img = window.compressBase64Image ? await window.compressBase64Image(rawBase64) : rawBase64;

    closeTeacherCameraModal();
    await saveTeacherPhotoBase64(base64Img, teacherId);
}

async function uploadTeacherPhoto(event, teacherId) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(e) {
        let base64 = e.target.result;
        if (window.compressBase64Image) {
            base64 = await window.compressBase64Image(base64);
        }
        await saveTeacherPhotoBase64(base64, teacherId);
    };
    reader.readAsDataURL(file);
}

async function saveTeacherPhotoBase64(base64Img, teacherId) {
    try {
        const tchIdx = (appState.teachers || []).findIndex(t => String(t.id) === String(teacherId));
        if (tchIdx < 0) { showToast('Data guru tidak ditemukan.', 'error'); return; }

        const teacher = appState.teachers[tchIdx];
        const prevPhoto = teacher.photo || '';
        let photoHistory = Array.isArray(teacher.photoHistory) ? [...teacher.photoHistory] : [];

        if (prevPhoto && !photoHistory.some(h => (typeof h === 'string' ? h : h.photo) === prevPhoto)) {
            photoHistory.unshift({
                photo: prevPhoto,
                date: teacher.photoUpdated || new Date().toISOString().split('T')[0],
                type: 'initial',
                label: 'Foto Sebelumnya'
            });
        }

        const todayStr = new Date().toISOString().split('T')[0];
        photoHistory.unshift({
            photo: base64Img,
            date: todayStr,
            type: 'manual',
            label: `Upload Guru (${todayStr})`
        });

        const response = await fetch(`/api/teachers/${encodeURIComponent(teacherId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                name: teacher.name, 
                nip: teacher.nip,
                nuptk: teacher.nuptk || '',
                phone: teacher.phone || teacher.no_hp || '',
                no_hp: teacher.phone || teacher.no_hp || '',
                email: teacher.email || '',
                gender: teacher.gender || teacher.jenis_kelamin || 'L',
                address: teacher.address || teacher.alamat || '',
                bio: teacher.bio || '',
                username: teacher.username, 
                photo: base64Img,
                photoHistory: photoHistory,
                mapel: teacher.mapel || []
            })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || data.message || 'Gagal menyimpan foto profil.');
        }

        const updatedTeacher = data.teacher || {};
        appState.teachers[tchIdx].photo = updatedTeacher.photo || base64Img;
        appState.teachers[tchIdx].photoHistory = updatedTeacher.photoHistory || photoHistory;

        if (appState.currentUser && String(appState.currentUser.id) === String(teacherId)) {
            appState.currentUser.photo = appState.teachers[tchIdx].photo;
            appState.currentUser.photoHistory = appState.teachers[tchIdx].photoHistory;
            if (window.persistCurrentUser) appState.currentUser = window.persistCurrentUser(appState.currentUser) || appState.currentUser;
        }

        try {
            localStorage.setItem('madrasah_teachers', JSON.stringify(appState.teachers));
        } catch (err) {}

        showToast('Foto profil guru berhasil diperbarui!', 'success');
        if (appState.currentView === 'profil_guru') {
            renderTeacherProfile(document.getElementById('view-container'));
        }
    } catch (error) {
        console.error('ERROR SIMPAN FOTO GURU:', error);
        showToast(error.message || 'Gagal menyimpan foto profil.', 'error');
    }
}

async function applyTeacherHistoryPhoto(teacherId, historyIndex) {
    const tchIdx = (appState.teachers || []).findIndex(t => String(t.id) === String(teacherId));
    if (tchIdx < 0) return;
    const history = appState.teachers[tchIdx].photoHistory || [];
    const targetItem = history[historyIndex];
    if (!targetItem) return;
    const targetPhoto = typeof targetItem === 'string' ? targetItem : targetItem.photo;
    await saveTeacherPhotoBase64(targetPhoto, teacherId);
}

async function saveTeacherProfileSelf(e, teacherId) {
    e.preventDefault();
    const name = document.getElementById('prof-tch-name').value.trim();
    const nip = document.getElementById('prof-tch-nip').value.trim();
    const nuptk = document.getElementById('prof-tch-nuptk').value.trim();
    const gender = document.getElementById('prof-tch-gender').value;
    const phone = document.getElementById('prof-tch-phone').value.trim();
    const email = document.getElementById('prof-tch-email').value.trim();
    const address = document.getElementById('prof-tch-address').value.trim();
    const bio = document.getElementById('prof-tch-bio').value.trim();
    const username = document.getElementById('prof-tch-user').value.trim();
    const password = document.getElementById('prof-tch-pass').value;

    if (!name || !nip || !username) {
        showToast('Nama, NIP, dan Username wajib diisi.', 'error');
        return;
    }

    try {
        const tchIdx = (appState.teachers || []).findIndex(t => String(t.id) === String(teacherId));
        const currentTch = tchIdx >= 0 ? appState.teachers[tchIdx] : (appState.currentUser || {});

        const response = await fetch(`/api/teachers/${encodeURIComponent(teacherId)}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name,
                nip,
                nuptk,
                gender,
                jenis_kelamin: gender,
                phone,
                no_hp: phone,
                email,
                address,
                alamat: address,
                bio,
                username,
                password,
                photo: currentTch.photo || '',
                photoHistory: currentTch.photoHistory || [],
                mapel: currentTch.mapel || []
            })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Gagal menyimpan perubahan profil.');
        }

        if (tchIdx >= 0) {
            appState.teachers[tchIdx] = { ...appState.teachers[tchIdx], ...data.teacher };
        }
        if (appState.currentUser && String(appState.currentUser.id) === String(teacherId)) {
            appState.currentUser = { ...appState.currentUser, ...data.teacher };
            if (window.persistCurrentUser) appState.currentUser = window.persistCurrentUser(appState.currentUser) || appState.currentUser;
            const nameEl = document.getElementById('user-display-name');
            if (nameEl) nameEl.innerText = appState.currentUser.name || '';
        }

        try {
            localStorage.setItem('madrasah_teachers', JSON.stringify(appState.teachers));
        } catch (e) {}

        showToast('Profil guru berhasil diperbarui!', 'success');
        renderTeacherProfile(document.getElementById('view-container'));
    } catch (err) {
        showToast(err.message || 'Gagal menyimpan profil.', 'error');
    }
}

// Window globals
window.renderTeacherModule = renderTeacherModule;
window.openTeacherModal = openTeacherModal;
window.previewAdminTeacherPhoto = previewAdminTeacherPhoto;
window.removeAdminTeacherPhoto = removeAdminTeacherPhoto;
window.saveTeacher = saveTeacher;
window.loadTeachersFromServer = loadTeachersFromServer;
window.deleteTeacher = deleteTeacher;
window.renderTeacherProfile = renderTeacherProfile;
window.openTeacherPhotoSourceModal = openTeacherPhotoSourceModal;
window.openTeacherCameraCaptureModal = openTeacherCameraCaptureModal;
window.closeTeacherCameraModal = closeTeacherCameraModal;
window.snapTeacherCameraPhoto = snapTeacherCameraPhoto;
window.uploadTeacherPhoto = uploadTeacherPhoto;
window.saveTeacherPhotoBase64 = saveTeacherPhotoBase64;
window.applyTeacherHistoryPhoto = applyTeacherHistoryPhoto;
window.saveTeacherProfileSelf = saveTeacherProfileSelf;

// Student Module
function getCachedStudentTemporaryPassword(student) {
    if (!student) return '';
    const credentialRole = String(appState.role || '').toLowerCase();
    if (!['admin', 'bos', 'superadmin'].includes(credentialRole)) return '';
    try {
        const cached = JSON.parse(sessionStorage.getItem('cbt_print_credentials') || '[]');
        if (!Array.isArray(cached)) return '';
        const byId = cached.find(c => String(c?.studentId || '') === String(student.id || ''));
        const byUsername = cached.find(c => c?.username && String(c.username).toLowerCase() === String(student.username || '').toLowerCase());
        const credential = byId || byUsername;
        return credential?.temporaryPassword ? String(credential.temporaryPassword) : '';
    } catch (_) {
        return '';
    }
}

function escapeStudentCredentialHtml(value) {
    return adminEscapeHtml(value);
}

function renderStudentPasswordForAdmin(student) {
    const credentialRole = String(appState.role || '').toLowerCase();
    if (!['admin', 'bos', 'superadmin'].includes(credentialRole)) {
        return '<span class="text-[10px] text-slate-400">Tidak ditampilkan</span>';
    }
    const temporaryPassword = getCachedStudentTemporaryPassword(student);
    if (temporaryPassword) {
        return `<span class="font-mono text-xs text-slate-800">${escapeStudentCredentialHtml(temporaryPassword)}</span>`;
    }
    return `<button type="button" onclick="window.openResetPasswordModal ? window.openResetPasswordModal('${escapeStudentCredentialHtml(student?.id || '')}', 'student') : openStudentModal('${escapeStudentCredentialHtml(student?.id || '')}')" class="text-[10px] font-semibold text-amber-700 hover:text-amber-800 underline underline-offset-2" title="Password lama tersimpan sebagai hash dan tidak dapat dibaca kembali">Tersimpan aman · Reset</button>`;
}

function studentPasswordForExport(student) {
    return getCachedStudentTemporaryPassword(student) || 'Reset diperlukan';
}

function renderStudentModule(container) {
    // Auto-refresh students from server
    fetch('/api/students')
        .then(r => r.json())
        .then(data => {
            if (data && data.success && Array.isArray(data.students)) {
                appState.students = data.students;
            }
        })
        .catch(() => {});

    const isTeacher = ['teacher', 'guru'].includes(String(appState.role || '').toLowerCase());
    const classFilter = window.studentClassFilter || '';
    let filteredStudents = Array.isArray(appState.students) ? [...appState.students] : [];

    if (classFilter && classFilter !== 'all') {
        filteredStudents = filteredStudents.filter(s => String(s.classId || s.class_id) === String(classFilter));
    }

    // Sort by NIS / serial number ascending (smallest NIS on top)
    filteredStudents.sort((a, b) => {
        const nisA = String(a.nis || a.no_urut || a.id || '').trim();
        const nisB = String(b.nis || b.no_urut || b.id || '').trim();
        return nisA.localeCompare(nisB, undefined, { numeric: true, sensitivity: 'base' });
    });

    container.innerHTML = `
        <div class="space-y-6 pb-8">
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-100">
                <div><h1 class="text-xl sm:text-2xl font-bold text-slate-800">Manajemen Data Murid</h1><p class="text-xs text-slate-400">Kelola data murid madrasah</p></div>
                <div class="flex flex-wrap gap-2 w-full sm:w-auto">
                    ${!isTeacher ? `
                    <label class="px-3.5 py-2.5 bg-teal-600 text-white rounded-2xl text-xs font-semibold cursor-pointer shadow hover:bg-teal-700 transition">
                        Import
                        <input type="file" accept=".xlsx" class="hidden" onchange="importStudentsExcel(event)">
                    </label>
                    <label class="px-3.5 py-2.5 bg-sky-600 text-white rounded-2xl text-xs font-semibold cursor-pointer shadow hover:bg-sky-700 transition flex items-center gap-1">
                        <i class="fa-solid fa-file-zipper"></i> Upload Foto (ZIP)
                        <input type="file" accept=".zip" class="hidden" onchange="uploadStudentPhotosZip(event)">
                    </label>
                    <button type="button" onclick="openStudentModal()" class="px-4 py-2.5 bg-emerald-600 text-white rounded-2xl text-xs font-semibold shadow hover:bg-emerald-700 transition">Tambah</button>
                    <button type="button" onclick="downloadStudentTemplate()" class="px-3.5 py-2.5 bg-slate-100 text-slate-700 rounded-2xl text-xs font-semibold hover:bg-slate-200 transition"><i class="fa-solid fa-download mr-1"></i>Template</button>
                    <button type="button" onclick="deleteSelectedStudentsPage()" class="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-semibold shadow transition"><i class="fa-solid fa-trash mr-1"></i>Hapus Terpilih</button>
                    ` : ''}
                    <button type="button" onclick="openExportStudentModal()" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-semibold shadow transition"><i class="fa-solid fa-file-export mr-1.5"></i>Ekspor</button>
                </div>
            </div>

            <div class="bg-white p-4 rounded-3xl shadow-sm border border-slate-100 flex flex-wrap items-center gap-3">
                <label class="text-xs font-semibold uppercase text-slate-500">Filter Kelas:</label>
                <select id="filter-class-student" onchange="window.studentClassFilter=this.value; renderStudentModule(document.getElementById('view-container'));" class="w-64 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm">
                    <option value="">Semua Kelas</option>
                    <option value="all" ${classFilter === 'all' ? 'selected' : ''}>Tampilkan Semua</option>
                    ${(appState.classes || []).map(c => `<option value="${c.id}" ${String(classFilter) === String(c.id) ? 'selected' : ''}>${c.name}</option>`).join('')}
                </select>
            </div>

            <div class="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse min-w-[650px]">
                        <thead>
                            <tr class="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                                ${!isTeacher ? `<th class="p-4 text-center"><input type="checkbox" onchange="toggleSelectAllStudentsPage(this.checked)" class="w-4 h-4 rounded text-blue-600 cursor-pointer"></th>` : ''}
                                <th class="p-4">NIS</th>
                                <th class="p-4 text-center">Profil</th>
                                <th class="p-4">Nama</th>
                                <th class="p-4">Kelas</th>
                                <th class="p-4">Username</th>
                                <th class="p-4">Password</th>
                                ${!isTeacher ? `<th class="p-4 text-center">Aksi</th>` : ''}
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 text-sm">
                            ${filteredStudents.map(s => {
                                const cls = (appState.classes || []).find(c => String(c.id) === String(s.classId || s.class_id));
                                const activeExamKeys = Object.keys(appState.activeExamSessions || {});
                                const isOnline = activeExamKeys.some(k => k.startsWith(s.id + '_')) || (appState.chats && appState.chats.some(c => String(c.senderId) === String(s.id) && Date.now() - c.timestamp < 300000));
                                return `
                                    <tr class="hover:bg-slate-50/50 transition">
                                        ${!isTeacher ? `<td class="p-4 text-center"><input type="checkbox" class="student-page-checkbox w-4 h-4 rounded text-blue-600 cursor-pointer" value="${s.id}"></td>` : ''}
                                        <td class="p-4 font-mono text-xs font-bold text-emerald-700">${s.nis || '-'}</td>
                                        <td class="p-4 text-center">
                                            <div class="relative inline-block">
                                                <button type="button" onclick="showStudentProfileModal('${s.id}')" class="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden flex items-center justify-center bg-slate-100 hover:ring-2 hover:ring-emerald-500 transition mx-auto cursor-pointer focus:outline-none">
                                                    ${s.photo ? `<img src="${window.getPhotoHtmlSrc ? window.getPhotoHtmlSrc(s.photo) : ''}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-user text-slate-400 text-lg"></i>`}
                                                </button>
                                                <div class="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${isOnline ? 'bg-green-500' : 'bg-red-500'}"></div>
                                            </div>
                                        </td>
                                        <td class="p-4 font-semibold text-slate-800">${s.name}</td>
                                        <td class="p-4"><span class="px-2 py-0.5 bg-slate-100 rounded-lg text-xs">${cls ? cls.name : '-'}</span></td>
                                        <td class="p-4 font-mono text-xs">${s.username}</td>
                                        <td class="p-4 font-mono text-xs">${renderStudentPasswordForAdmin(s)}</td>
                                        ${!isTeacher ? `
                                        <td class="p-4 text-center space-x-2">
                                            <button type="button" onclick="openStudentModal('${s.id}')" class="p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition"><i class="fa-solid fa-pen text-xs"></i></button>
                                            <button type="button" onclick="deleteStudent('${s.id}')" class="p-2 bg-rose-50 text-rose-600 rounded-xl hover:bg-rose-100 transition"><i class="fa-solid fa-trash text-xs"></i></button>
                                        </td>
                                        ` : ''}
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;
}

function showStudentProfileModal(studentId) {
    const student = (appState.students || []).find(s => String(s.id) === String(studentId));
    if (!student) return;

    const cls = (appState.classes || []).find(c => String(c.id) === String(student.classId || student.class_id));
    const activeExamKeys = Object.keys(appState.activeExamSessions || {});
    const isOnline = activeExamKeys.some(k => k.startsWith(student.id + '_')) || (appState.chats && appState.chats.some(c => String(c.senderId) === String(student.id) && Date.now() - c.timestamp < 300000));

    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
            <div data-active-student-id="${adminEscapeAttr(student.id)}" class="bg-white w-full max-w-md sm:max-w-lg rounded-3xl shadow-2xl overflow-hidden relative max-h-[92vh] overflow-y-auto">
                <div class="h-32 bg-gradient-to-br from-emerald-500 to-teal-600 relative">
                    <button type="button" onclick="closeModal()" class="absolute top-4 right-4 w-8 h-8 flex items-center justify-center bg-white/20 hover:bg-white/40 text-white rounded-full transition"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="px-6 pb-6 relative">
                    <div class="-mt-16 flex justify-center mb-4 relative">
                        <div class="relative group">
                            <div class="w-32 h-32 rounded-full border-4 border-white shadow-lg overflow-hidden bg-white flex items-center justify-center text-slate-300 text-6xl relative">
                                ${student.photo ? `<img src="${window.getPhotoHtmlSrc ? window.getPhotoHtmlSrc(student.photo) : ''}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-user"></i>`}
                            </div>
                            <div class="absolute bottom-1 right-1 w-6 h-6 border-4 border-white rounded-full ${isOnline ? 'bg-green-500' : 'bg-red-500'} pointer-events-none"></div>
                            <button type="button" onclick="document.getElementById(${adminInlineArg('admin-std-photo-input-' + student.id)}).click()" class="absolute bottom-0 left-0 w-8 h-8 bg-emerald-600 hover:bg-emerald-700 text-white rounded-full flex items-center justify-center shadow-md transition cursor-pointer" title="Ganti/Upload Foto Profil">
                                <i class="fa-solid fa-camera text-xs"></i>
                            </button>
                            <input type="file" id="admin-std-photo-input-${adminEscapeAttr(student.id)}" accept="image/*" class="hidden" onchange="window.uploadStudentPhotoByAdmin(event, ${adminInlineArg(student.id)})">
                        </div>
                    </div>
                    <div class="text-center space-y-1 mb-5">
                        <h3 class="text-xl font-bold text-slate-800">${adminEscapeHtml(student.name)}</h3>
                        <p class="text-emerald-600 font-mono font-semibold">${adminEscapeHtml(student.nis || 'NIS Belum Diisi')}</p>
                        <p class="text-xs text-slate-500 bg-slate-100 inline-block px-3 py-1 rounded-full mt-1 font-medium">${adminEscapeHtml(cls ? cls.name : 'Kelas Tidak Diketahui')}</p>
                    </div>
                    
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                        <div class="bg-slate-50 rounded-2xl p-3.5 flex items-center gap-3">
                            <div class="w-9 h-9 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                                <i class="fa-solid fa-at text-xs"></i>
                            </div>
                            <div class="overflow-hidden">
                                <p class="text-[10px] text-slate-500 font-medium uppercase">Username</p>
                                <p class="text-xs font-semibold text-slate-800 truncate">${adminEscapeHtml(student.username)}</p>
                            </div>
                        </div>
                        <div class="bg-slate-50 rounded-2xl p-3.5 flex items-center gap-3">
                            <div class="w-9 h-9 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                                <i class="fa-solid fa-phone text-xs"></i>
                            </div>
                            <div class="overflow-hidden">
                                <p class="text-[10px] text-slate-500 font-medium uppercase">No. HP</p>
                                <p class="text-xs font-semibold text-slate-800 truncate">${adminEscapeHtml(student.no_hp || '-')}</p>
                            </div>
                        </div>
                    </div>

                    <!-- RIWAYAT & BEKAS FOTO PROFIL SISWA (ADMIN CONTROL) -->
                    <div class="mb-5">
                        ${window.renderStudentPhotoHistorySection ? window.renderStudentPhotoHistorySection(student) : ''}
                    </div>
                    
                    <div class="flex gap-2">
                        <button type="button" onclick="closeModal()" class="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-3 rounded-2xl font-semibold transition text-sm">
                            Tutup
                        </button>
                        ${(appState.settings?.chatEnabled === true || appState.settings?.chatEnabled === 'true') ? `
                        <button type="button" onclick="openChatWithStudent(${adminInlineArg(student.id)})" data-studentid="${adminEscapeAttr(student.id)}" class="student-chat-btn relative flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl font-semibold transition text-sm flex items-center justify-center gap-2">
                            <i class="fa-regular fa-comment-dots"></i> Chat Siswa
                        </button>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    modal.classList.remove('hidden');
    if (window.updateChatNotificationBadges) {
        setTimeout(window.updateChatNotificationBadges, 100);
    }
}

function openStudentModal(id = null) {
    const item = id ? appState.students.find(s => String(s.id) === String(id)) : { id: '', nis: '', name: '', classId: appState.classes[0]?.id || 'C1', username: '', password: '' };
    if (!item) return;

    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-3 text-xs sm:text-sm">
                <div class="flex justify-between items-center"><h3 class="font-bold text-slate-800">${id ? 'Edit Murid' : 'Tambah Murid'}</h3><button type="button" onclick="closeModal()"><i class="fa-solid fa-xmark text-lg"></i></button></div>
                <form onsubmit="saveStudent(event, ${adminInlineArg(id || '')})" class="space-y-3">
                    <div><label class="block text-xs uppercase text-slate-500 mb-1">NIS</label><input type="text" id="std-nis" value="${adminEscapeAttr(item.nis || '')}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl"></div>
                    <div><label class="block text-xs uppercase text-slate-500 mb-1">Nama</label><input type="text" id="std-name" value="${adminEscapeAttr(item.name || '')}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl"></div>
                    <div>
                        <label class="block text-xs uppercase text-slate-500 mb-1">Kelas</label>
                        <select id="std-class" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl">
                            ${(appState.classes || []).map(c => `<option value="${adminEscapeAttr(c.id)}" ${String(item.classId) === String(c.id) ? 'selected' : ''}>${adminEscapeHtml(c.name)}</option>`).join('')}
                        </select>
                    </div>
                    <div><label class="block text-xs uppercase text-slate-500 mb-1">Username</label><input type="text" id="std-user" value="${adminEscapeAttr(item.username || '')}" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl"></div>
                    <div><label class="block text-xs uppercase text-slate-500 mb-1">Password ${id ? '(opsional)' : '(otomatis jika kosong)'}</label><input type="password" id="std-pass" value="" autocomplete="new-password" placeholder="${id ? 'Kosongkan jika tidak diubah' : 'Kosongkan untuk membuat password aman otomatis'}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl"></div>
                    <div>
                        <label class="block text-xs uppercase text-slate-500 mb-1">Peran / Hak Akses Akun</label>
                        <select id="std-role" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-semibold">
                            <option value="student" ${item.role === 'class_leader' || item.role === 'ketua_kelas' ? '' : 'selected'}>Murid Biasa</option>
                            <option value="class_leader" ${item.role === 'class_leader' || item.role === 'ketua_kelas' ? 'selected' : ''}>Ketua Kelas (Akses Absensi Kelas)</option>
                        </select>
                    </div>
                    <div class="flex justify-end space-x-2 pt-2"><button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 rounded-xl">Batal</button><button type="submit" class="px-4 py-2 bg-emerald-600 text-white rounded-xl font-semibold">Simpan</button></div>
                </form>
            </div>
        </div>
    `;
}

async function saveStudent(e, id) {
    e.preventDefault();
    const nis = document.getElementById('std-nis').value.trim();
    const name = document.getElementById('std-name').value.trim();
    const classId = document.getElementById('std-class').value;
    const username = document.getElementById('std-user').value.trim();
    const password = document.getElementById('std-pass').value;
    const role = document.getElementById('std-role') ? document.getElementById('std-role').value : 'student';

    const url = id && id !== 'null' ? `/api/students/${id}` : '/api/students';
    const method = id && id !== 'null' ? 'PUT' : 'POST';

    const submitBtn = e.target.querySelector('button[type="submit"]');
    const originalBtnText = submitBtn ? submitBtn.innerHTML : '';
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1.5"></i>Menyimpan...';
    }

    try {
        const response = await fetch(url, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nis, name, classId, username, password, role })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menyimpan siswa.');

        if (data.credentials && data.credentials.length > 0) {
            try {
                const existing = JSON.parse(sessionStorage.getItem('cbt_print_credentials') || '[]');
                const map = new Map();
                existing.forEach(c => { if (c.studentId) map.set(String(c.studentId), c); });
                data.credentials.forEach(c => { if (c.studentId) map.set(String(c.studentId), c); });
                sessionStorage.setItem('cbt_print_credentials', JSON.stringify(Array.from(map.values())));
            } catch (err_cred) {
                console.warn("Gagal menyimpan credentials ke sessionStorage:", err_cred);
            }
        }

        if (!appState.students) appState.students = [];
        const savedStudent = data.student;
        const idx = appState.students.findIndex(s => String(s.id) === String(savedStudent.id));
        if (idx >= 0) {
            appState.students[idx] = savedStudent;
        } else {
            appState.students.push(savedStudent);
        }
        saveState('students');

        closeModal();
        showToast('Siswa berhasil disimpan!', 'success');
        renderStudentModule(document.getElementById('view-container'));

        // Load fully from server in background without blocking UI
        loadStudentsFromServer();
    } catch (err) {
        showToast(err.message, 'error');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalBtnText;
        }
    }
}

async function loadStudentsFromServer() {
    try {
        const response = await fetch('/api/students');
        const data = await response.json();
        if (response.ok && data.success) {
            appState.students = data.students;
            try {
                localStorage.setItem('madrasah_students', JSON.stringify(appState.students));
            } catch (e) {
                console.warn('LocalStorage error:', e);
            }
        }
    } catch (err) {
        console.error('Error loading students:', err);
    }
}

function compressImageBlob(blob) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = URL.createObjectURL(blob);
        img.onload = () => {
            const maxWidth = 800;
            const maxHeight = 800;
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round(height * (maxWidth / width));
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = Math.round(width * (maxHeight / height));
                height = maxHeight;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const base64 = canvas.toDataURL('image/jpeg', 0.88);
            URL.revokeObjectURL(img.src);
            resolve(base64);
        };
        img.onerror = (err) => {
            URL.revokeObjectURL(img.src);
            reject(err);
        };
    });
}

async function uploadStudentPhotosZip(event) {
    const file = event.target.files[0];
    if (!file) return;

    const inputEl = event.target;
    showToast('Sedang membaca file ZIP...', 'info');

    try {
        const jszip = new JSZip();
        const zip = await jszip.loadAsync(file);
        
        const photoUpdates = [];
        const fileNames = Object.keys(zip.files);
        
        const imageFiles = fileNames.filter(name => {
            const lowerName = name.toLowerCase();
            return (lowerName.endsWith('.png') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) &&
                   !name.includes('__MACOSX') && !name.startsWith('.');
        });

        if (imageFiles.length === 0) {
            throw new Error('Tidak ditemukan file gambar (.png, .jpg, .jpeg) di dalam ZIP.');
        }

        let processedCount = 0;

        const modal = document.getElementById('modal-container');
        modal.innerHTML = `
            <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in zoom-in duration-200">
                <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4 text-center">
                    <h3 class="font-bold text-slate-800 text-lg">Memproses Foto dari ZIP</h3>
                    <div class="w-16 h-16 bg-sky-50 rounded-full flex items-center justify-center mx-auto text-sky-600 animate-bounce">
                        <i class="fa-solid fa-file-zipper text-2xl"></i>
                    </div>
                    <div class="space-y-1">
                        <p class="text-sm font-semibold text-slate-700" id="zip-status-text">Mengekstrak dan mengecilkan ukuran gambar...</p>
                        <p class="text-xs text-slate-400" id="zip-progress-text">0 dari ${imageFiles.length} file gambar</p>
                    </div>
                    <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div class="bg-sky-500 h-full w-0 transition-all duration-150" id="zip-progress-bar"></div>
                    </div>
                </div>
            </div>
        `;

        const statusText = document.getElementById('zip-status-text');
        const progressText = document.getElementById('zip-progress-text');
        const progressBar = document.getElementById('zip-progress-bar');

        for (let i = 0; i < imageFiles.length; i++) {
            const fileName = imageFiles[i];
            const baseName = fileName.substring(fileName.lastIndexOf('/') + 1);
            const extIdx = baseName.lastIndexOf('.');
            const studentIdKey = extIdx !== -1 ? baseName.substring(0, extIdx).trim() : baseName.trim();

            if (!studentIdKey) continue;

            const zipFile = zip.files[fileName];
            const arrayBuffer = await zipFile.async('arraybuffer');
            
            let mimeType = 'image/jpeg';
            if (fileName.toLowerCase().endsWith('.png')) {
                mimeType = 'image/png';
            }

            try {
                const blob = new Blob([arrayBuffer], { type: mimeType });
                const base64Photo = await compressImageBlob(blob);
                
                photoUpdates.push({
                    nis: studentIdKey,
                    photo: base64Photo
                });
                
                processedCount++;
            } catch (err) {
                console.error(`Gagal memproses file ${fileName}:`, err);
            }

            const percentage = Math.round((i + 1) / imageFiles.length * 100);
            if (progressBar) progressBar.style.width = percentage + '%';
            if (progressText) progressText.innerText = `${i + 1} dari ${imageFiles.length} file gambar`;
        }

        if (statusText) statusText.innerText = 'Mengupload foto ke server...';

        const response = await fetch('/api/students/bulk-upload-photos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ photos: photoUpdates })
        });

        const resData = await response.json();
        if (!response.ok || !resData.success) {
            throw new Error(resData.message || 'Gagal menyimpan foto ke server.');
        }

        closeModal();
        showToast(`Berhasil memperbarui ${resData.updated} foto siswa berdasarkan NIS!`, 'success');
        
        loadStudentsFromServer().then(() => {
            renderStudentModule(document.getElementById('view-container'));
        });

    } catch (err) {
        closeModal();
        showToast(err.message || 'Gagal mengekstrak ZIP atau mengupload foto.', 'error');
    } finally {
        inputEl.value = '';
    }
}

window.uploadStudentPhotosZip = uploadStudentPhotosZip;

async function deleteStudent(id) {
    const student = (appState.students || []).find(s => String(s.id) === String(id));
    const studentNis = student ? String(student.nis || '').trim() : '';
    showConfirmModal('Apakah Anda yakin ingin menghapus murid ini? Seluruh data terkait (foto profil, riwayat absensi, dan nilai) akan dibersihkan.', async () => {
        try {
            const res = await fetch(`/api/students/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Gagal menghapus murid');

            appState.students = (appState.students || []).filter(s => String(s.id) !== String(id));
            if (Array.isArray(appState.attendance)) {
                appState.attendance = appState.attendance.filter(a => String(a.studentId) !== String(id) && (!studentNis || String(a.nis) !== studentNis));
                saveState('attendance');
            }
            if (Array.isArray(appState.grades)) {
                appState.grades = appState.grades.filter(g => String(g.studentId) !== String(id) && (!studentNis || String(g.nis) !== studentNis));
                saveState('grades');
            }
            saveState('students');
            showToast('Murid dan seluruh data terkait berhasil dihapus!', 'success');
            renderStudentModule(document.getElementById('view-container'));
        } catch (err) {
            showToast(err.message || 'Gagal menghapus murid', 'error');
        }
    });
}

function toggleSelectAllStudentsPage(checked) {
    document.querySelectorAll('.student-page-checkbox').forEach(cb => cb.checked = checked);
}

async function deleteSelectedStudentsPage() {
    const checkboxes = document.querySelectorAll('.student-page-checkbox:checked');
    const ids = Array.from(checkboxes).map(cb => cb.value);
    if (ids.length === 0) { showToast('Pilih murid yang ingin dihapus terlebih dahulu.', 'error'); return; }
    showConfirmModal(`Hapus ${ids.length} murid terpilih beserta seluruh riwayat absensi dan nilainya?`, async () => {
        try {
            const response = await fetch('/api/students/delete-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids })
            });
            const data = await response.json();
            if (response.ok && data.success) {
                const targetStudents = (appState.students || []).filter(s => ids.includes(String(s.id)));
                const nisSet = new Set(targetStudents.map(s => String(s.nis || '').trim()).filter(Boolean));
                
                appState.students = appState.students.filter(s => !ids.includes(String(s.id)));
                if (Array.isArray(appState.attendance)) {
                    appState.attendance = appState.attendance.filter(a => !ids.includes(String(a.studentId)) && (!a.nis || !nisSet.has(String(a.nis))));
                    saveState('attendance');
                }
                if (Array.isArray(appState.grades)) {
                    appState.grades = appState.grades.filter(g => !ids.includes(String(g.studentId)) && (!g.nis || !nisSet.has(String(g.nis))));
                    saveState('grades');
                }
                saveState('students');
                showToast(`${ids.length} murid beserta data terkait berhasil dihapus.`, 'success');
                renderStudentModule(document.getElementById('view-container'));
            } else {
                showToast(data.message || 'Gagal menghapus murid terpilih.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Terjadi kesalahan saat menghapus.', 'error');
        }
    });
}

function downloadStudentTemplate() {
    if (window.XLSX) {
        const wb = window.XLSX.utils.book_new();
        const ws = window.XLSX.utils.aoa_to_sheet([["nis", "name", "classId", "username", "password"], ["1001", "Ahmad", "C1", "siswa1", "Aman#1001"]]);
        window.XLSX.utils.book_append_sheet(wb, ws, "Murid");
        window.XLSX.writeFile(wb, "Template_Murid.xlsx");
        showToast('Template berhasil diunduh!');
    } else {
        showToast('Library Excel belum siap.', 'error');
    }
}

async function importStudentsExcel(e) {
    const file = e.target.files[0];
    if (!file) return;

    try {
        const data = await file.arrayBuffer();
        const wb = window.XLSX.read(new Uint8Array(data), { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = window.XLSX.utils.sheet_to_json(sheet);

        const response = await fetch('/api/students/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ students: rows })
        });
        const result = await response.json();

        if (result.success && result.credentials && result.credentials.length > 0) {
            try {
                const existing = JSON.parse(sessionStorage.getItem('cbt_print_credentials') || '[]');
                const map = new Map();
                existing.forEach(c => { if (c.studentId) map.set(String(c.studentId), c); });
                result.credentials.forEach(c => { if (c.studentId) map.set(String(c.studentId), c); });
                sessionStorage.setItem('cbt_print_credentials', JSON.stringify(Array.from(map.values())));
            } catch (err_cred) {
                console.warn("Gagal menyimpan credentials ke sessionStorage:", err_cred);
            }
        }

        await loadStudentsFromServer();
        showToast(`${result.imported || rows.length} siswa berhasil diimport!`, 'success');
        renderStudentModule(document.getElementById('view-container'));
    } catch (err) {
        showToast('Gagal mengimport Excel: ' + err.message, 'error');
    }
    e.target.value = '';
}

function openExportStudentModal() {
    const modal = document.getElementById('modal-container');
    const classFilter = window.studentClassFilter || '';
    const className = classFilter === 'all' || !classFilter ? 'Semua Kelas' : (appState.classes.find(c => String(c.id) === String(classFilter))?.name || '');
    
    let filteredStudents = Array.isArray(appState.students) ? [...appState.students] : [];
    if (classFilter && classFilter !== 'all') {
        filteredStudents = filteredStudents.filter(s => String(s.classId || s.class_id) === String(classFilter));
    }

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4 text-slate-800">
                <div class="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div>
                        <h3 class="font-bold text-base text-slate-800">Ekspor Data Murid</h3>
                        <p class="text-xs text-slate-400">Pilih format dokumen ekspor</p>
                    </div>
                    <button type="button" onclick="closeModal()" class="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition text-slate-400 hover:text-slate-600"><i class="fa-solid fa-xmark text-lg"></i></button>
                </div>
                
                <div class="bg-slate-50 rounded-2xl p-4 text-xs space-y-1.5 border border-slate-100">
                    <div class="flex justify-between"><span class="text-slate-500">Kelas Terpilih:</span><span class="font-semibold text-slate-700">${className}</span></div>
                    <div class="flex justify-between"><span class="text-slate-500">Jumlah Murid:</span><span class="font-bold text-emerald-600">${filteredStudents.length} Siswa</span></div>
                </div>

                <div class="grid grid-cols-2 gap-3 pt-2">
                    <button type="button" onclick="exportStudentsToExcel()" class="flex flex-col items-center justify-center p-4 bg-emerald-50 border border-emerald-100 rounded-2xl hover:bg-emerald-100 hover:border-emerald-200 transition group">
                        <div class="w-12 h-12 bg-emerald-600 text-white rounded-xl flex items-center justify-center text-xl mb-3 shadow-md shadow-emerald-600/10 group-hover:scale-105 transition duration-200">
                            <i class="fa-regular fa-file-excel"></i>
                        </div>
                        <span class="text-xs font-bold text-emerald-800">Format Excel</span>
                        <span class="text-[10px] text-emerald-600 mt-0.5">(.xlsx)</span>
                    </button>
                    
                    <button type="button" onclick="exportStudentsToWord()" class="flex flex-col items-center justify-center p-4 bg-blue-50 border border-blue-100 rounded-2xl hover:bg-blue-100 hover:border-blue-200 transition group">
                        <div class="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center text-xl mb-3 shadow-md shadow-blue-600/10 group-hover:scale-105 transition duration-200">
                            <i class="fa-regular fa-file-word"></i>
                        </div>
                        <span class="text-xs font-bold text-blue-800">Format Word</span>
                        <span class="text-[10px] text-blue-600 mt-0.5">(.doc)</span>
                    </button>
                </div>

                <div class="flex justify-end pt-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-semibold rounded-xl text-xs transition">Batal</button>
                </div>
            </div>
        </div>
    `;
}

function exportStudentsToExcel() {
    if (!window.XLSX) {
        showToast('Library Excel belum siap.', 'error');
        return;
    }
    const classFilter = window.studentClassFilter || '';
    let filteredStudents = Array.isArray(appState.students) ? [...appState.students] : [];

    if (classFilter && classFilter !== 'all') {
        filteredStudents = filteredStudents.filter(s => String(s.classId || s.class_id) === String(classFilter));
    }

    filteredStudents.sort((a, b) => {
        const nisA = String(a.nis || a.no_urut || a.id || '').trim();
        const nisB = String(b.nis || b.no_urut || b.id || '').trim();
        return nisA.localeCompare(nisB, undefined, { numeric: true, sensitivity: 'base' });
    });

    if (filteredStudents.length === 0) {
        showToast('Tidak ada data murid untuk diekspor.', 'warning');
        return;
    }

    const data = filteredStudents.map((s, idx) => {
        const cls = appState.classes.find(c => String(c.id) === String(s.classId || s.class_id));
        return {
            'No': idx + 1,
            'NIS': s.nis || '-',
            'Nama Lengkap': s.name,
            'Kelas': cls ? cls.name : '-',
            'Username': s.username,
            'Password': studentPasswordForExport(s)
        };
    });

    const ws = window.XLSX.utils.json_to_sheet(data);
    const wb = window.XLSX.utils.book_new();
    window.XLSX.utils.book_append_sheet(wb, ws, "Data Murid");
    
    const max_widths = [
        { wch: 5 },  // No
        { wch: 15 }, // NIS
        { wch: 30 }, // Nama
        { wch: 15 }, // Kelas
        { wch: 15 }, // Username
        { wch: 15 }  // Password
    ];
    ws['!cols'] = max_widths;

    const classLabel = classFilter === 'all' || !classFilter ? 'Semua_Kelas' : (appState.classes.find(c => String(c.id) === String(classFilter))?.name || '').replace(/\s+/g, '_');
    window.XLSX.writeFile(wb, `Data_Siswa_${classLabel}_${new Date().toISOString().slice(0,10)}.xlsx`);
    showToast('Data murid berhasil diekspor ke Excel!', 'success');
    closeModal();
}

function exportStudentsToWord() {
    const classFilter = window.studentClassFilter || '';
    let filteredStudents = Array.isArray(appState.students) ? [...appState.students] : [];

    if (classFilter && classFilter !== 'all') {
        filteredStudents = filteredStudents.filter(s => String(s.classId || s.class_id) === String(classFilter));
    }

    filteredStudents.sort((a, b) => {
        const nisA = String(a.nis || a.no_urut || a.id || '').trim();
        const nisB = String(b.nis || b.no_urut || b.id || '').trim();
        return nisA.localeCompare(nisB, undefined, { numeric: true, sensitivity: 'base' });
    });

    if (filteredStudents.length === 0) {
        showToast('Tidak ada data murid untuk diekspor.', 'warning');
        return;
    }

    const className = classFilter === 'all' || !classFilter ? 'Semua Kelas' : (appState.classes.find(c => String(c.id) === String(classFilter))?.name || '');

    const html = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
    <title>Laporan Data Murid</title>
    <!--[if gte mso 9]>
    <xml>
    <w:WordDocument>
    <w:View>Print</w:View>
    <w:Zoom>100</w:Zoom>
    </w:WordDocument>
    </xml>
    <![endif]-->
    <style>
    body { font-family: 'Arial', sans-serif; margin: 30px; color: #1e293b; }
    h1 { text-align: center; font-size: 18pt; font-weight: bold; margin-bottom: 5px; color: #0f172a; }
    h2 { text-align: center; font-size: 12pt; font-weight: normal; margin-top: 0; margin-bottom: 25px; color: #475569; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 10pt; text-align: left; }
    th { background-color: #f1f5f9; font-weight: bold; color: #334155; }
    .text-center { text-align: center; }
    .font-mono { font-family: 'Courier New', Courier, monospace; }
    </style>
    </head>
    <body>
    <h1>LAPORAN DATA MURID</h1>
    <h2>Madrasah Aliyah - Kelas: ${className}</h2>
    <p style="font-size: 9pt; color: #64748b; text-align: right;">Tanggal Unduh: ${new Date().toLocaleDateString('id-ID')}</p>
    <table>
    <thead>
    <tr>
    <th style="width: 5%; text-align: center;">No</th>
    <th style="width: 15%;">NIS</th>
    <th style="width: 35%;">Nama Lengkap</th>
    <th style="width: 15%;">Kelas</th>
    <th style="width: 15%;">Username</th>
    <th style="width: 15%;">Password</th>
    </tr>
    </thead>
    <tbody>
    ${filteredStudents.map((s, idx) => {
        const cls = appState.classes.find(c => String(c.id) === String(s.classId || s.class_id));
        return `
        <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td class="font-mono">${s.nis || '-'}</td>
        <td><b>${s.name}</b></td>
        <td>${cls ? cls.name : '-'}</td>
        <td class="font-mono">${s.username}</td>
        <td class="font-mono">${escapeStudentCredentialHtml(studentPasswordForExport(s))}</td>
        </tr>
        `;
    }).join('')}
    </tbody>
    </table>
    </body>
    </html>
    `;

    const blob = new Blob(['\ufeff' + html], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const fileClass = className.replace(/\s+/g, '_');
    a.download = `Data_Siswa_${fileClass}_${new Date().toISOString().slice(0,10)}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('Data murid berhasil diekspor ke Word!', 'success');
    closeModal();
}

// Schedule Module
function renderScheduleModule(container) {
    // Capture scroll positions before re-rendering
    const matrixScrollContainer = document.getElementById('roster-matrix-scroll-container');
    const savedMatrixScrollTop = matrixScrollContainer ? matrixScrollContainer.scrollTop : 0;
    const savedMatrixScrollLeft = matrixScrollContainer ? matrixScrollContainer.scrollLeft : 0;
    const savedWindowY = window.scrollY || document.documentElement.scrollTop || 0;

    const isTeacher = ['teacher', 'guru'].includes(String(appState.role || '').toLowerCase());
    const classes = appState.classes || [];
    const subjects = appState.subjects || [];
    const teachers = appState.teachers || [];
    const schedules = appState.schedules || [];
    const savedRosters = appState.savedRosters || [];
    const activeRosterId = appState.activeRosterId || null;
    const settings = appState.settings || {};

    const schoolName = settings.schoolName || 'MADRASAH ALIYAH NEGERI';
    const academicYear = settings.academicYear || '2026/2027';
    const semester = settings.semester || 'Ganjil';

    // Teacher Code Mapping (01, 02, 03...)
    const teacherCodeMap = {};
    teachers.forEach((t, idx) => {
        const code = String(idx + 1).padStart(2, '0');
        teacherCodeMap[t.id] = code;
    });

    container.innerHTML = `
        <div class="space-y-6 pb-8">
            <!-- Header Banner -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-3xl shadow-sm border border-slate-100">
                <div>
                    <h1 class="text-xl sm:text-2xl font-bold text-slate-800">Jadwal & Mata Pelajaran</h1>
                    <p class="text-xs text-slate-400">Roster Matriks KBM Interaktif (Langsung Edit di Kolom) & Auto-Scheduler</p>
                </div>
                <div class="flex flex-wrap gap-2 w-full sm:w-auto">
                    ${!isTeacher ? `
                    <button type="button" onclick="openAutoScheduleModal()" class="px-4 py-2.5 bg-indigo-600 text-white rounded-2xl text-xs font-semibold shadow hover:bg-indigo-700 transition flex items-center space-x-1.5 cursor-pointer">
                        <i class="fa-solid fa-wand-magic-sparkles"></i>
                        <span>Susun Otomatis Jadwal</span>
                    </button>
                    <button type="button" onclick="openSusunJadwalModal()" class="px-4 py-2.5 bg-slate-800 text-white rounded-2xl text-xs font-semibold shadow hover:bg-slate-900 transition flex items-center space-x-1.5 cursor-pointer">
                        <i class="fa-solid fa-calendar-plus"></i>
                        <span>Kelola / Susun Manual</span>
                    </button>
                    ` : ''}
                    <button type="button" onclick="openGenerateMingguAktifModal()" class="px-4 py-2.5 bg-blue-600 text-white rounded-2xl text-xs font-semibold shadow hover:bg-blue-700 transition flex items-center space-x-1.5 cursor-pointer">
                        <i class="fa-solid fa-calculator"></i>
                        <span>Generate Minggu Aktif</span>
                    </button>
                    ${!isTeacher ? `
                    <button type="button" onclick="openSubjectModal()" class="px-4 py-2.5 bg-teal-50 text-teal-700 rounded-2xl text-xs font-semibold border border-teal-200 hover:bg-teal-100 transition flex items-center space-x-1.5 cursor-pointer">
                        <i class="fa-solid fa-book-medical"></i>
                        <span>Tambah Mapel</span>
                    </button>
                    ` : ''}
                </div>
            </div>

            <!-- SECTION 1 (PALING ATAS): ROSTER PEMBELAJARAN MADRASAH (TAMPILAN KOLOM MATRIX PER KELAS) -->
            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 pb-2 border-b border-slate-100">
                    <div>
                        <h3 class="font-extrabold text-slate-850 text-base sm:text-lg flex items-center space-x-2">
                            <span class="w-2.5 h-6 bg-emerald-600 rounded-full inline-block"></span>
                            <span>ROSTER PEMBELAJARAN KBM MATRIKS PER KELAS</span>
                        </h3>
                        <p class="text-xs text-slate-500 font-medium">Anda dapat memilih Mapel & Kode Guru di dalam kolom tabel berikut!</p>
                    </div>
                    <div class="flex flex-wrap items-center gap-2">
                        ${!isTeacher ? `
                        <button type="button" onclick="openSaveRosterModal()" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition flex items-center space-x-1.5 shadow-sm cursor-pointer">
                            <i class="fa-solid fa-floppy-disk text-xs"></i>
                            <span>Simpan Roster</span>
                        </button>
                        <button type="button" onclick="openKelolaKelasModal()" class="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer">
                            <i class="fa-solid fa-layer-group text-xs"></i>
                            <span>Tambah / Edit Kelas</span>
                        </button>
                        <button type="button" onclick="openEditTimeSlotsModal()" class="px-3.5 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer">
                            <i class="fa-solid fa-clock text-xs"></i>
                            <span>Edit Jam & Waktu Slot</span>
                        </button>
                        ` : ''}
                        <button type="button" onclick="downloadRosterExcel()" class="px-3.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer">
                            <i class="fa-solid fa-file-excel text-xs"></i>
                            <span>Download Excel Roster</span>
                        </button>
                        <button type="button" onclick="printRosterJadwal()" class="px-3.5 py-1.5 bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 text-xs font-bold rounded-xl transition flex items-center space-x-1.5 cursor-pointer">
                            <i class="fa-solid fa-print text-xs"></i>
                            <span>Cetak Format Roster</span>
                        </button>
                    </div>
                </div>

                <!-- KARTU KECIL VERSI ROSTER TERSIMPAN -->
                <div class="bg-slate-50/80 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div class="flex items-center space-x-2">
                            <span class="w-2.5 h-2.5 bg-emerald-600 rounded-full inline-block"></span>
                            <h4 class="font-extrabold text-slate-800 text-xs uppercase tracking-wider">Versi Roster KBM Tersimpan (${savedRosters.length})</h4>
                            <span class="text-[11px] text-slate-400 font-normal hidden sm:inline">— Klik kartu untuk membuka & mengedit roster tersebut</span>
                        </div>
                        ${!isTeacher ? `
                        <button type="button" onclick="openSaveRosterModal()" class="self-start sm:self-auto px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl transition flex items-center space-x-1.5 shadow-xs cursor-pointer">
                            <i class="fa-solid fa-plus text-[10px]"></i>
                            <span>Simpan Versi Roster Saat Ini</span>
                        </button>
                        ` : ''}
                    </div>

                    <!-- Small Cards Container -->
                    <div class="flex flex-wrap gap-2.5 items-center">
                        ${renderSavedRosterCardsHTML(savedRosters, activeRosterId, !isTeacher)}
                    </div>
                </div>

                <!-- Matrix Roster View -->
                <div class="grid grid-cols-1 xl:grid-cols-4 gap-6">
                    <div id="roster-matrix-scroll-container" class="xl:col-span-3 overflow-auto max-h-[75vh] border border-emerald-800 rounded-2xl shadow-sm bg-white relative">
                        ${renderRosterMatrixHTML(classes, subjects, teachers, schedules, teacherCodeMap, !isTeacher)}
                    </div>

                    <!-- Side Legend: Daftar Kode Guru -->
                    <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                        <div class="flex items-center space-x-2 pb-2 border-b border-slate-200">
                            <i class="fa-solid fa-id-card text-emerald-700"></i>
                            <h4 class="font-bold text-slate-800 text-xs uppercase tracking-wider">Kode Guru Pengampu</h4>
                        </div>
                        <div class="max-h-[600px] overflow-y-auto space-y-1.5 pr-1">
                            ${teachers.map((t, idx) => {
                                const code = teacherCodeMap[t.id] || String(idx + 1).padStart(2, '0');
                                return `
                                    <div class="flex items-center space-x-2.5 p-2 bg-white rounded-xl border border-slate-150 text-xs hover:border-emerald-300 transition">
                                        <span class="w-7 h-7 bg-emerald-700 text-white font-black rounded-lg flex items-center justify-center text-[11px] shrink-0 shadow-xs">${code}</span>
                                        <div class="truncate">
                                            <span class="font-bold text-slate-800 block truncate">${t.name}</span>
                                            <span class="text-[10px] text-slate-400 block truncate">${Array.isArray(t.mapel) ? t.mapel.join(', ') : (t.mapel || '-')}</span>
                                        </div>
                                    </div>
                                `;
                            }).join('') || `<p class="text-xs text-slate-400 italic p-2 text-center">Belum ada data guru</p>`}
                        </div>
                    </div>
                </div>
            </div>

            <!-- SECTION 2 (TENGAH): DAFTAR DETAIL JADWAL TERPASANG -->
            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <div class="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div>
                        <h3 class="font-bold text-slate-800 text-base">Detail Daftar Jadwal Pelajaran Terpasang</h3>
                        <p class="text-xs text-slate-400">Entri jadwal terdaftar dalam sistem (dapat disaring/dihapus)</p>
                    </div>
                    ${!isTeacher ? `
                    <button type="button" onclick="openSusunJadwalModal()" class="px-3.5 py-1.5 bg-slate-800 text-white text-xs font-semibold rounded-xl hover:bg-slate-900 transition flex items-center space-x-1 cursor-pointer">
                        <i class="fa-solid fa-plus text-[10px]"></i>
                        <span>Tambah / Edit Slot</span>
                    </button>
                    ` : ''}
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse min-w-[650px]">
                        <thead>
                            <tr class="bg-slate-50 text-xs text-slate-500 uppercase font-bold border-b border-slate-200">
                                <th class="p-3 w-12 text-center">No</th>
                                <th class="p-3">Hari</th>
                                <th class="p-3">Kelas</th>
                                <th class="p-3">Mata Pelajaran</th>
                                <th class="p-3">Waktu</th>
                                <th class="p-3">Guru Pengampu</th>
                                ${!isTeacher ? `<th class="p-3 w-16 text-center">Aksi</th>` : ''}
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 text-xs">
                            ${schedules.map((sc, idx) => {
                                const cls = classes.find(c => String(c.id) === String(sc.classId));
                                const sub = subjects.find(s => String(s.id) === String(sc.subjectId));
                                const tch = teachers.find(t => String(t.id) === String(sc.teacherId || sc.teacher_id));
                                return `
                                    <tr class="hover:bg-slate-50/50 transition">
                                        <td class="p-3 text-center font-bold text-slate-500">${idx + 1}</td>
                                        <td class="p-3 font-bold text-emerald-700">${sc.day}</td>
                                        <td class="p-3 font-semibold text-slate-800">${cls ? cls.name : '-'}</td>
                                        <td class="p-3 font-semibold text-indigo-700">${sub ? sub.name : '-'}</td>
                                        <td class="p-3 font-mono text-slate-600">${sc.time}</td>
                                        <td class="p-3 font-medium text-slate-700">${tch ? tch.name : '-'}</td>
                                        ${!isTeacher ? `
                                        <td class="p-3 text-center">
                                            <button type="button" onclick="deleteSchedule('${sc.id}')" class="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition" title="Hapus Slot">
                                                <i class="fa-solid fa-trash-can"></i>
                                            </button>
                                        </td>
                                        ` : ''}
                                    </tr>
                                `;
                            }).join('') || `<tr><td colspan="7" class="p-6 text-center text-xs text-slate-400 italic">Belum ada jadwal terpasang. Klik 'Susun Otomatis' atau 'Susun Manual' untuk menambahkan.</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- SECTION 3 (BAWAH): DAFTAR MATA PELAJARAN -->
            <div class="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 space-y-4">
                <div class="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div>
                        <h3 class="font-bold text-slate-800 text-base">Daftar Mata Pelajaran (Mapel)</h3>
                        <p class="text-xs text-slate-400">Daftar seluruh kurikulum mata pelajaran madrasah</p>
                    </div>
                    ${!isTeacher ? `
                    <button type="button" onclick="openSubjectModal()" class="px-3.5 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-xl hover:bg-teal-700 transition flex items-center space-x-1 cursor-pointer">
                        <i class="fa-solid fa-plus text-[10px]"></i>
                        <span>Tambah Mapel Baru</span>
                    </button>
                    ` : ''}
                </div>
                <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    ${subjects.map(s => `
                        <div class="flex justify-between items-center p-3.5 bg-slate-50 border border-slate-150 rounded-2xl text-xs hover:border-teal-300 transition shadow-sm">
                            <div class="min-w-0 pr-2">
                                <div class="flex items-center gap-1.5 flex-wrap">
                                    <span class="font-extrabold text-slate-800 truncate">${escapeHtml(s.name)}</span>
                                    <span class="text-[9px] font-mono font-bold bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">ID: ${escapeHtml(s.id)}</span>
                                </div>
                                <span class="text-[10px] font-mono text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded-md inline-block mt-1 border border-teal-200">Kode: ${escapeHtml(s.code || '-')}</span>
                            </div>
                            ${!isTeacher ? `
                            <div class="flex items-center space-x-1 shrink-0">
                                <button type="button" onclick="openSubjectModal('${s.id}')" class="p-2 text-teal-600 hover:text-teal-800 hover:bg-teal-50 rounded-xl transition cursor-pointer" title="Edit Mapel">
                                    <i class="fa-solid fa-pen text-xs pointer-events-none"></i>
                                </button>
                                <button type="button" onclick="deleteSubject('${s.id}')" class="p-2 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer" title="Hapus Mapel">
                                    <i class="fa-solid fa-trash-can text-xs pointer-events-none"></i>
                                </button>
                            </div>
                            ` : ''}
                        </div>
                    `).join('') || `<p class="col-span-full p-4 text-center text-xs text-slate-400">Belum ada data mata pelajaran.</p>`}
                </div>
            </div>
        </div>
    `;

    // Restore scroll positions immediately
    const newScrollContainer = document.getElementById('roster-matrix-scroll-container');
    if (newScrollContainer) {
        newScrollContainer.scrollTop = savedMatrixScrollTop;
        newScrollContainer.scrollLeft = savedMatrixScrollLeft;
    }
    window.scrollTo({ top: savedWindowY, behavior: 'instant' });

    // Extra double-check with requestAnimationFrame to ensure smooth scroll lock
    requestAnimationFrame(() => {
        const sc = document.getElementById('roster-matrix-scroll-container');
        if (sc) {
            sc.scrollTop = savedMatrixScrollTop;
            sc.scrollLeft = savedMatrixScrollLeft;
        }
        window.scrollTo({ top: savedWindowY, behavior: 'instant' });
    });
}

// Generate HTML Matrix layout with inline direct edit support
function renderRosterMatrixHTML(classes, subjects, teachers, schedules, teacherCodeMap, isInteractive = true) {
    if (classes.length === 0) {
        return `<div class="p-8 text-center text-xs text-slate-400 font-semibold">Data kelas belum tersedia. Silakan tambah data kelas terlebih dahulu.</div>`;
    }

    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    const defaultTimeSlots = [
        { jamKe: '0', waktu: '07.00 - 07.40', type: 'upacara', label: 'UPACARA BENDERA' },
        { jamKe: '1', waktu: '07.40 - 08.20', type: 'kbm' },
        { jamKe: '2', waktu: '08.20 - 09.00', type: 'kbm' },
        { jamKe: '-', waktu: '09.00 - 09.20', type: 'istirahat', label: 'ISTIRAHAT' },
        { jamKe: '3', waktu: '09.20 - 10.00', type: 'kbm' },
        { jamKe: '4', waktu: '10.00 - 10.40', type: 'kbm' },
        { jamKe: '5', waktu: '10.40 - 11.20', type: 'kbm' },
        { jamKe: '6', waktu: '11.20 - 12.00', type: 'kbm' },
        { jamKe: '-', waktu: '12.00 - 13.00', type: 'istirahat', label: 'ISTIRAHAT / SHALAT' },
        { jamKe: '7', waktu: '13.00 - 13.40', type: 'kbm' },
        { jamKe: '8', waktu: '13.40 - 14.20', type: 'kbm' },
        { jamKe: '9', waktu: '14.20 - 15.00', type: 'kbm' }
    ];

    const timeSlots = (appState.timeSlots && appState.timeSlots.length > 0) ? appState.timeSlots : defaultTimeSlots;

    let rowsHtml = '';

    days.forEach((day, dayIdx) => {
        let isFirstDayRow = true;

        const visibleDaySlots = timeSlots.filter(slot => !(slot.type === 'upacara' && day !== 'Senin'));

        visibleDaySlots.forEach((slot) => {
            let rowContent = '';
            let isNewDayStart = false;

            if (isFirstDayRow) {
                isNewDayStart = true;
                const totalDayRows = visibleDaySlots.length;
                const dayTopBorderClass = dayIdx > 0 ? 'border-t-4 border-t-emerald-950' : '';
                rowContent += `<td rowspan="${totalDayRows}" class="p-2 border border-emerald-700 ${dayTopBorderClass} bg-emerald-900 text-white font-extrabold text-center text-xs uppercase tracking-wider sticky left-0 z-20 writing-mode-vertical sm:writing-mode-horizontal shadow-sm">${day}</td>`;
                isFirstDayRow = false;
            }

            const cellTopBorderClass = (isNewDayStart && dayIdx > 0) ? 'border-t-4 border-t-emerald-800' : '';

            rowContent += `
                <td class="p-1.5 border border-slate-200 ${cellTopBorderClass} font-mono text-[11px] text-center text-slate-700 font-bold bg-slate-50 sticky left-[64px] z-10 shadow-sm">${slot.waktu}</td>
                <td class="p-1.5 border border-slate-200 ${cellTopBorderClass} font-bold text-xs text-center text-emerald-800 bg-emerald-50/70 sticky left-[174px] z-10 shadow-sm">${slot.jamKe}</td>
            `;

            if (slot.type === 'istirahat' || slot.type === 'upacara') {
                rowContent += `
                    <td colspan="${classes.length * 2}" class="p-2 border border-amber-300 ${cellTopBorderClass} bg-amber-100/90 text-amber-950 font-black text-center text-xs tracking-widest uppercase shadow-xs">
                        ${slot.label}
                    </td>
                `;
            } else {
                classes.forEach((cls) => {
                    const sc = schedules.find(s => {
                        const dayMatch = String(s.day).toLowerCase() === day.toLowerCase();
                        const classMatch = String(s.classId) === String(cls.id);
                        let timeMatch = String(s.time).includes(slot.waktu) || slot.waktu.includes(String(s.time));
                        if (!timeMatch && s.time) {
                            if (slot.jamKe === '1' && s.time.includes('07:30')) timeMatch = true;
                            if (slot.jamKe === '2' && s.time.includes('08:30')) timeMatch = true;
                            if (slot.jamKe === '3' && s.time.includes('09:45')) timeMatch = true;
                            if (slot.jamKe === '4' && s.time.includes('10:45')) timeMatch = true;
                        }
                        return dayMatch && classMatch && timeMatch;
                    });

                    const currentSubjectId = sc ? sc.subjectId : '';
                    const currentTeacherId = sc ? (sc.teacherId || sc.teacher_id) : '';

                    if (isInteractive) {
                        // Interactive Dropdowns in Roster Matrix
                        const mapelSelectOptions = subjects.map(s => `
                            <option value="${s.id}" ${String(currentSubjectId) === String(s.id) ? 'selected' : ''}>${s.name}</option>
                        `).join('');

                        // Filter teachers based on chosen subject
                        const currentSubject = subjects.find(s => String(s.id) === String(currentSubjectId));
                        let filteredTeachers = teachers;

                        if (currentSubject && currentSubject.name) {
                            const matching = teachers.filter(t => {
                                if (!t.mapel) return false;
                                if (Array.isArray(t.mapel)) {
                                    return t.mapel.some(m => String(m).toLowerCase().includes(currentSubject.name.toLowerCase()) || currentSubject.name.toLowerCase().includes(String(m).toLowerCase()));
                                }
                                const mapelStr = String(t.mapel).toLowerCase();
                                const subName = currentSubject.name.toLowerCase();
                                return mapelStr.includes(subName) || subName.includes(mapelStr);
                            });
                            if (matching.length > 0) {
                                filteredTeachers = matching;
                            }
                        }

                        // Ensure current assigned teacher is present in options list
                        if (currentTeacherId && !filteredTeachers.some(t => String(t.id) === String(currentTeacherId))) {
                            const assignedTch = teachers.find(t => String(t.id) === String(currentTeacherId));
                            if (assignedTch) {
                                filteredTeachers = [assignedTch, ...filteredTeachers];
                            }
                        }

                        const currentTeacherCode = (currentTeacherId && teacherCodeMap[currentTeacherId]) ? teacherCodeMap[currentTeacherId] : '';

                        const teacherSelectOptions = filteredTeachers.map(t => {
                            const code = teacherCodeMap[t.id] || '';
                            return `<option value="${t.id}" ${String(currentTeacherId) === String(t.id) ? 'selected' : ''}>${code} - ${t.name}</option>`;
                        }).join('');

                        rowContent += `
                            <td class="p-1 border border-slate-200 ${cellTopBorderClass} text-xs bg-white min-w-[110px]">
                                <select onchange="updateRosterMatrixSubject('${day}', '${cls.id}', '${slot.waktu}', '${slot.jamKe}', this.value)" 
                                        class="w-full text-[11px] font-semibold text-slate-800 bg-slate-50 border border-slate-200 rounded-lg p-1 text-center appearance-none focus:bg-white focus:ring-1 focus:ring-emerald-500 cursor-pointer hover:border-emerald-400 transition"
                                        title="Pilih Mapel">
                                    <option value="CLEAR" ${!currentSubjectId ? 'selected' : ''}></option>
                                    ${mapelSelectOptions}
                                </select>
                            </td>
                            <td class="p-1 border border-slate-200 ${cellTopBorderClass} text-xs text-center bg-emerald-50/50 w-12">
                                <div class="relative w-full h-full flex items-center justify-center bg-emerald-100/80 border border-emerald-300 rounded-lg p-1 hover:bg-emerald-200 transition">
                                    <span class="font-extrabold text-emerald-950 text-[11px] text-center pointer-events-none select-none">${currentTeacherCode}</span>
                                    <select onchange="updateRosterMatrixTeacher('${day}', '${cls.id}', '${slot.waktu}', '${slot.jamKe}', this.value)" 
                                            class="absolute inset-0 opacity-0 w-full h-full cursor-pointer appearance-none text-center"
                                            title="Pilih Guru">
                                        <option value="CLEAR" ${!currentTeacherId ? 'selected' : ''}></option>
                                        ${teacherSelectOptions}
                                    </select>
                                </div>
                            </td>
                        `;
                    } else {
                        // Non-interactive display for print
                        if (sc) {
                            const sub = subjects.find(s => String(s.id) === String(sc.subjectId));
                            const tchCode = teacherCodeMap[currentTeacherId] || '';
                            const subName = sub ? (sub.name || sub.code) : '';
                            rowContent += `
                                <td class="p-1.5 border border-slate-200 ${cellTopBorderClass} text-xs font-semibold text-slate-800 bg-white truncate max-w-[110px]" title="${subName}">${subName}</td>
                                <td class="p-1.5 border border-slate-200 ${cellTopBorderClass} text-xs font-black text-emerald-800 text-center bg-emerald-50/70 w-9">${tchCode}</td>
                            `;
                        } else {
                            rowContent += `
                                <td class="p-1.5 border border-slate-200 ${cellTopBorderClass} text-xs text-slate-300 text-center bg-white"></td>
                                <td class="p-1.5 border border-slate-200 ${cellTopBorderClass} text-xs text-slate-300 text-center bg-slate-50/50 w-9"></td>
                            `;
                        }
                    }
                });
            }

            const trClass = (isNewDayStart && dayIdx > 0) 
                ? "border-t-4 border-t-emerald-800 hover:bg-slate-50/80 transition" 
                : "hover:bg-slate-50/80 transition";

            rowsHtml += `<tr class="${trClass}">${rowContent}</tr>`;
        });
    });

    return `
        <table class="w-full text-left border-collapse min-w-[950px] relative">
            <thead class="sticky top-0 z-30 bg-emerald-800 shadow-md">
                <tr class="bg-emerald-800 text-white border-b-2 border-emerald-900 text-xs font-black tracking-wider uppercase">
                    <th rowspan="2" class="p-2.5 border border-emerald-700 text-center w-16 min-w-[64px] sticky left-0 top-0 z-40 bg-emerald-800 shadow-sm">Hari</th>
                    <th rowspan="2" class="p-2.5 border border-emerald-700 text-center w-28 min-w-[110px] sticky left-[64px] top-0 z-40 bg-emerald-800 shadow-sm">Waktu</th>
                    <th rowspan="2" class="p-2.5 border border-emerald-700 text-center w-12 min-w-[48px] sticky left-[174px] top-0 z-40 bg-emerald-800 shadow-sm">Jam</th>
                    ${classes.map(c => `
                        <th colspan="2" class="p-2 border border-emerald-700 text-center font-extrabold text-sm bg-emerald-800 sticky top-0 z-30 shadow-xs">
                            <div class="flex items-center justify-center space-x-1.5">
                                <span>${c.name}</span>
                                ${isInteractive ? `
                                <button type="button" onclick="openClassModal('${c.id}')" class="p-1 hover:bg-emerald-600 rounded text-emerald-200 hover:text-white transition cursor-pointer" title="Edit Kelas ${c.name}">
                                    <i class="fa-solid fa-pen-to-square text-[11px]"></i>
                                </button>
                                <button type="button" onclick="deleteClass('${c.id}')" class="p-1 hover:bg-rose-600 rounded text-emerald-200 hover:text-white transition cursor-pointer" title="Hapus Kelas ${c.name}">
                                    <i class="fa-solid fa-trash-can text-[11px]"></i>
                                </button>
                                ` : ''}
                            </div>
                        </th>
                    `).join('')}
                </tr>
                <tr class="bg-emerald-700 text-white text-[10px] font-bold uppercase tracking-wider">
                    ${classes.map(() => `
                        <th class="p-1.5 border border-emerald-600 text-center sticky top-[38px] z-30 bg-emerald-700 shadow-xs">Mapel</th>
                        <th class="p-1.5 border border-emerald-600 text-center w-12 sticky top-[38px] z-30 bg-emerald-700 shadow-xs">Kode</th>
                    `).join('')}
                </tr>
            </thead>
            <tbody class="divide-y divide-slate-200">
                ${rowsHtml}
            </tbody>
        </table>
    `;
}

// Inline Direct Roster Cell Updating Functions
function updateRosterMatrixSubject(day, classId, slotWaktu, jamKe, subjectId) {
    appState.schedules = appState.schedules || [];

    const existingIndex = appState.schedules.findIndex(s => {
        const dayMatch = String(s.day).toLowerCase() === String(day).toLowerCase();
        const classMatch = String(s.classId) === String(classId);
        let timeMatch = String(s.time).includes(slotWaktu) || slotWaktu.includes(String(s.time));
        if (!timeMatch && s.time && jamKe) {
            if (jamKe === '1' && s.time.includes('07:30')) timeMatch = true;
            if (jamKe === '2' && s.time.includes('08:30')) timeMatch = true;
            if (jamKe === '3' && s.time.includes('09:45')) timeMatch = true;
            if (jamKe === '4' && s.time.includes('10:45')) timeMatch = true;
        }
        return dayMatch && classMatch && timeMatch;
    });

    if (!subjectId || subjectId === 'CLEAR') {
        if (existingIndex !== -1) {
            appState.schedules.splice(existingIndex, 1);
            saveState('schedules');
            showToast('Slot jadwal dikosongkan.', 'info');
        }
    } else {
        const sub = (appState.subjects || []).find(s => String(s.id) === String(subjectId));
        // Auto pick matching teacher
        let tch = (appState.teachers || []).find(t => {
            if (!t.mapel) return false;
            if (Array.isArray(t.mapel)) return t.mapel.includes(sub?.name);
            return String(t.mapel).includes(sub?.name || '');
        }) || appState.teachers[0];

        if (existingIndex !== -1) {
            appState.schedules[existingIndex].subjectId = subjectId;
            if (tch) appState.schedules[existingIndex].teacherId = tch.id;
            appState.schedules[existingIndex].time = slotWaktu;
        } else {
            appState.schedules.push({
                id: 'SCH_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
                day: day,
                classId: classId,
                subjectId: subjectId,
                time: slotWaktu,
                teacherId: tch ? tch.id : ''
            });
        }
        saveState('schedules');
        showToast(`Mata pelajaran ${sub ? sub.name : ''} terpasang!`, 'success');
    }

    const container = document.getElementById('view-container');
    if (container) renderScheduleModule(container);
}

function updateRosterMatrixTeacher(day, classId, slotWaktu, jamKe, teacherId) {
    appState.schedules = appState.schedules || [];

    const existingIndex = appState.schedules.findIndex(s => {
        const dayMatch = String(s.day).toLowerCase() === String(day).toLowerCase();
        const classMatch = String(s.classId) === String(classId);
        let timeMatch = String(s.time).includes(slotWaktu) || slotWaktu.includes(String(s.time));
        if (!timeMatch && s.time && jamKe) {
            if (jamKe === '1' && s.time.includes('07:30')) timeMatch = true;
            if (jamKe === '2' && s.time.includes('08:30')) timeMatch = true;
            if (jamKe === '3' && s.time.includes('09:45')) timeMatch = true;
            if (jamKe === '4' && s.time.includes('10:45')) timeMatch = true;
        }
        return dayMatch && classMatch && timeMatch;
    });

    if (existingIndex !== -1) {
        if (!teacherId || teacherId === 'CLEAR') {
            appState.schedules[existingIndex].teacherId = '';
        } else {
            appState.schedules[existingIndex].teacherId = teacherId;
            const tch = (appState.teachers || []).find(t => String(t.id) === String(teacherId));
            showToast(`Guru pengampu diubah ke: ${tch ? tch.name : ''}`, 'success');
        }
        saveState('schedules');
        const container = document.getElementById('view-container');
        if (container) renderScheduleModule(container);
    } else {
        showToast('Pilih Mata Pelajaran terlebih dahulu sebelum menentukan Guru.', 'warning');
    }
}

// Download Roster Excel Function
function downloadRosterExcel() {
    const classes = appState.classes || [];
    const subjects = appState.subjects || [];
    const teachers = appState.teachers || [];
    const schedules = appState.schedules || [];
    const settings = appState.settings || {};

    const schoolName = settings.schoolName || 'MADRASAH ALIYAH';
    const academicYear = settings.academicYear || '2025/2026';
    const semester = settings.semester || 'Ganjil';

    const teacherCodeMap = {};
    teachers.forEach((t, idx) => {
        teacherCodeMap[t.id] = String(idx + 1).padStart(2, '0');
    });

    const defaultTimeSlots = [
        { jamKe: '0', waktu: '07.00 - 07.40', type: 'upacara', label: 'UPACARA BENDERA' },
        { jamKe: '1', waktu: '07.40 - 08.20', type: 'kbm' },
        { jamKe: '2', waktu: '08.20 - 09.00', type: 'kbm' },
        { jamKe: '-', waktu: '09.00 - 09.20', type: 'istirahat', label: 'ISTIRAHAT' },
        { jamKe: '3', waktu: '09.20 - 10.00', type: 'kbm' },
        { jamKe: '4', waktu: '10.00 - 10.40', type: 'kbm' },
        { jamKe: '5', waktu: '10.40 - 11.20', type: 'kbm' },
        { jamKe: '6', waktu: '11.20 - 12.00', type: 'kbm' },
        { jamKe: '-', waktu: '12.00 - 13.00', type: 'istirahat', label: 'ISTIRAHAT / SHALAT' },
        { jamKe: '7', waktu: '13.00 - 13.40', type: 'kbm' },
        { jamKe: '8', waktu: '13.40 - 14.20', type: 'kbm' },
        { jamKe: '9', waktu: '14.20 - 15.00', type: 'kbm' }
    ];
    const timeSlots = (appState.timeSlots && appState.timeSlots.length > 0) ? appState.timeSlots : defaultTimeSlots;
    const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    const data = [];
    data.push([`ROSTER PEMBELAJARAN SEMESTER ${semester.toUpperCase()}`]);
    data.push([`${schoolName.toUpperCase()} TAHUN PELAJARAN ${academicYear}`]);
    data.push([]);

    const h1 = ['Hari', 'Waktu', 'Jam'];
    classes.forEach(c => {
        h1.push(c.name, '');
    });
    data.push(h1);

    const h2 = ['', '', ''];
    classes.forEach(() => {
        h2.push('Mapel', 'Kode Guru');
    });
    data.push(h2);

    days.forEach(day => {
        timeSlots.forEach(slot => {
            const row = [day, slot.waktu, slot.jamKe];
            if (slot.type === 'istirahat' || slot.type === 'upacara') {
                classes.forEach(() => {
                    row.push(slot.label || (slot.type === 'upacara' ? 'UPACARA' : 'ISTIRAHAT'), '');
                });
            } else {
                classes.forEach(cls => {
                    const sc = schedules.find(s => {
                        const dayMatch = String(s.day).toLowerCase() === String(day).toLowerCase();
                        const classMatch = String(s.classId) === String(cls.id);
                        let timeMatch = String(s.time).includes(slot.waktu) || slot.waktu.includes(String(s.time));
                        if (!timeMatch && s.time && slot.jamKe) {
                            if (slot.jamKe === '1' && s.time.includes('07:30')) timeMatch = true;
                            if (slot.jamKe === '2' && s.time.includes('08:30')) timeMatch = true;
                            if (slot.jamKe === '3' && s.time.includes('09:45')) timeMatch = true;
                            if (slot.jamKe === '4' && s.time.includes('10:45')) timeMatch = true;
                        }
                        return dayMatch && classMatch && timeMatch;
                    });
                    if (sc) {
                        const sub = subjects.find(s => String(s.id) === String(sc.subjectId));
                        const tchCode = teacherCodeMap[sc.teacherId] || '-';
                        row.push(sub ? (sub.name || sub.code) : '-', tchCode);
                    } else {
                        row.push('-', '-');
                    }
                });
            }
            data.push(row);
        });
    });

    data.push([]);
    data.push(['DAFTAR KODE GURU PENGAMPU:']);
    data.push(['Kode', 'Nama Guru', 'Mata Pelajaran Utama']);
    teachers.forEach((t, idx) => {
        const code = teacherCodeMap[t.id] || String(idx + 1).padStart(2, '0');
        const mapelStr = Array.isArray(t.mapel) ? t.mapel.join(', ') : (t.mapel || '-');
        data.push([code, t.name, mapelStr]);
    });

    if (window.XLSX) {
        const ws = window.XLSX.utils.aoa_to_sheet(data);
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, 'Roster KBM');
        window.XLSX.writeFile(wb, `Roster_Pembelajaran_${schoolName.replace(/\s+/g, '_')}_${academicYear.replace('/', '-')}.xlsx`);
        showToast('File Excel Roster berhasil diunduh!', 'success');
    } else {
        let htmlStr = '<table border="1" style="border-collapse:collapse;">';
        data.forEach(row => {
            htmlStr += '<tr>' + row.map(cell => `<td style="padding:4px;border:1px solid #ccc;">${cell !== undefined ? cell : ''}</td>`).join('') + '</tr>';
        });
        htmlStr += '</table>';
        const blob = new Blob(['\ufeff' + htmlStr], { type: 'application/vnd.ms-excel' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Roster_Pembelajaran_${schoolName.replace(/\s+/g, '_')}_${academicYear.replace('/', '-')}.xls`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('File Excel Roster berhasil diunduh!', 'success');
    }
}

// Edit Time Slots Modal (Supports Dynamic Add / Remove Rows & Auto Recalculation)
let currentEditingSlots = [];
let originalEditingSlots = [];
let currentKbmDuration = 40;

function parseTimeMinutes(str) {
    if (!str) return null;
    const match = str.match(/(\d{1,2})[:.](\d{2})/);
    if (!match) return null;
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    return h * 60 + m;
}

function parseSlotTimes(waktuStr) {
    if (!waktuStr) return null;
    const parts = waktuStr.split('-');
    if (parts.length < 2) return null;
    const start = parseTimeMinutes(parts[0].trim());
    const end = parseTimeMinutes(parts[1].trim());
    if (start === null || end === null || end <= start) return null;
    return { start, end, duration: end - start };
}

function formatMinutesToTime(mins) {
    mins = (mins + 1440) % 1440;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const hh = String(h).padStart(2, '0');
    const mm = String(m).padStart(2, '0');
    return `${hh}.${mm}`;
}

function openEditTimeSlotsModal() {
    const defaultTimeSlots = [
        { jamKe: '0', waktu: '07.00 - 07.40', type: 'upacara', label: 'UPACARA BENDERA' },
        { jamKe: '1', waktu: '07.40 - 08.20', type: 'kbm' },
        { jamKe: '2', waktu: '08.20 - 09.00', type: 'kbm' },
        { jamKe: '-', waktu: '09.00 - 09.20', type: 'istirahat', label: 'ISTIRAHAT' },
        { jamKe: '3', waktu: '09.20 - 10.00', type: 'kbm' },
        { jamKe: '4', waktu: '10.00 - 10.40', type: 'kbm' },
        { jamKe: '5', waktu: '10.40 - 11.20', type: 'kbm' },
        { jamKe: '6', waktu: '11.20 - 12.00', type: 'kbm' },
        { jamKe: '-', waktu: '12.00 - 13.00', type: 'istirahat', label: 'ISTIRAHAT / SHALAT' },
        { jamKe: '7', waktu: '13.00 - 13.40', type: 'kbm' },
        { jamKe: '8', waktu: '13.40 - 14.20', type: 'kbm' },
        { jamKe: '9', waktu: '14.20 - 15.00', type: 'kbm' }
    ];

    const sourceSlots = (appState.timeSlots && appState.timeSlots.length > 0) ? appState.timeSlots : defaultTimeSlots;
    originalEditingSlots = sourceSlots.map((s, idx) => ({
        ...s,
        _editKey: 'existing_' + idx
    }));
    currentEditingSlots = originalEditingSlots.map(s => ({ ...s }));

    // Detect KBM duration from first KBM slot if possible
    const firstKbm = currentEditingSlots.find(s => s.type === 'kbm');
    if (firstKbm) {
        const parsed = parseSlotTimes(firstKbm.waktu);
        if (parsed && parsed.duration > 0) {
            currentKbmDuration = parsed.duration;
        }
    }

    renderTimeSlotsModalContent();
}

function syncCurrentEditingSlotsFromDOM() {
    const rows = document.querySelectorAll('.slot-row-item');
    if (!rows || rows.length === 0) return;
    const updated = [];
    rows.forEach((row, idx) => {
        const jamKeInput = row.querySelector('.input-slot-jam');
        const waktuInput = row.querySelector('.input-slot-waktu');
        const typeSelect = row.querySelector('.select-slot-type');
        const labelInput = row.querySelector('.input-slot-label');

        updated.push({
            _editKey: row.dataset.slotKey || (currentEditingSlots[idx] && currentEditingSlots[idx]._editKey) || ('slot_' + Date.now() + '_' + idx),
            jamKe: jamKeInput ? jamKeInput.value.trim() : String(idx),
            waktu: waktuInput ? waktuInput.value.trim() : '',
            type: typeSelect ? typeSelect.value : 'kbm',
            label: labelInput ? labelInput.value.trim() : ''
        });
    });
    currentEditingSlots = updated;
}

function normalizeGeneratedJamKe() {
    let kbmNumber = 0;
    currentEditingSlots.forEach(slot => {
        if (!slot) return;
        if (slot.type === 'kbm') {
            kbmNumber += 1;
            slot.jamKe = String(kbmNumber);
            slot.label = '';
        } else if (slot.type === 'upacara') {
            slot.jamKe = '0';
            if (!slot.label) slot.label = 'UPACARA BENDERA';
        } else if (slot.type === 'istirahat') {
            slot.jamKe = '-';
            if (!slot.label) slot.label = 'ISTIRAHAT';
        }
    });
}

function normalizeSlotTimeKey(value) {
    const parsed = parseSlotTimes(value);
    return parsed ? (String(parsed.start) + '-' + String(parsed.end)) : '';
}

function legacyScheduleMatchesJamKe(scheduleTime, jamKe) {
    const value = String(scheduleTime || '');
    if (String(jamKe) === '1') return value.includes('07:30');
    if (String(jamKe) === '2') return value.includes('08:30');
    if (String(jamKe) === '3') return value.includes('09:45');
    if (String(jamKe) === '4') return value.includes('10:45');
    return false;
}

function migrateSchedulesForTimeSlotEdit(sourceSchedules, previousSlots, nextSlots) {
    const oldKbmSlots = (previousSlots || []).filter(slot => slot && slot.type === 'kbm');
    const nextKbmByKey = new Map(
        (nextSlots || [])
            .filter(slot => slot && slot.type === 'kbm' && slot._editKey)
            .map(slot => [String(slot._editKey), slot])
    );

    let migratedCount = 0;
    let removedCount = 0;
    const migratedSchedules = [];

    (Array.isArray(sourceSchedules) ? sourceSchedules : []).forEach(schedule => {
        const scheduleTimeKey = normalizeSlotTimeKey(schedule && schedule.time);
        let oldSlot = oldKbmSlots.find(slot =>
            scheduleTimeKey && normalizeSlotTimeKey(slot.waktu) === scheduleTimeKey
        );

        if (!oldSlot) {
            oldSlot = oldKbmSlots.find(slot => legacyScheduleMatchesJamKe(schedule && schedule.time, slot.jamKe));
        }

        // Schedules that cannot be tied to one of the edited roster slots are
        // preserved untouched (for example externally-created/manual schedules).
        if (!oldSlot || !oldSlot._editKey) {
            migratedSchedules.push({ ...schedule });
            return;
        }

        const nextSlot = nextKbmByKey.get(String(oldSlot._editKey));
        if (!nextSlot) {
            // The KBM slot was deleted or converted into a non-KBM slot.
            removedCount += 1;
            return;
        }

        const nextSchedule = { ...schedule };
        if (normalizeSlotTimeKey(nextSchedule.time) !== normalizeSlotTimeKey(nextSlot.waktu) ||
            String(nextSchedule.time || '') !== String(nextSlot.waktu || '')) {
            nextSchedule.time = nextSlot.waktu;
            migratedCount += 1;
        }
        migratedSchedules.push(nextSchedule);
    });

    return { schedules: migratedSchedules, migratedCount, removedCount };
}

function stripTimeSlotEditMetadata(slots) {
    return (Array.isArray(slots) ? slots : []).map(slot => {
        const clean = { ...slot };
        delete clean._editKey;
        return clean;
    });
}

function recalculateTimeSlots(startIndex = 0, syncFromDom = true) {
    if (syncFromDom) syncCurrentEditingSlotsFromDOM();
    const kbmInput = document.getElementById('kbm-duration-input');
    if (kbmInput) {
        currentKbmDuration = parseInt(kbmInput.value, 10) || 40;
    }

    if (!currentEditingSlots || currentEditingSlots.length === 0) return;

    let currentStart = 7 * 60; // default 07.00
    if (startIndex > 0 && currentEditingSlots[startIndex - 1]) {
        const prevTimes = parseSlotTimes(currentEditingSlots[startIndex - 1].waktu);
        if (prevTimes) {
            currentStart = prevTimes.end;
        }
    } else {
        const firstTimes = parseSlotTimes(currentEditingSlots[0].waktu);
        if (firstTimes) {
            currentStart = firstTimes.start;
        }
    }

    for (let i = startIndex; i < currentEditingSlots.length; i++) {
        const slot = currentEditingSlots[i];
        let duration = currentKbmDuration;

        const existingTimes = parseSlotTimes(slot.waktu);
        if (slot.type === 'istirahat' || slot.type === 'upacara') {
            if (existingTimes && existingTimes.duration > 0) {
                duration = existingTimes.duration;
            } else {
                duration = slot.type === 'istirahat' ? 20 : 40;
            }
        } else {
            duration = currentKbmDuration;
        }

        const newEnd = currentStart + duration;
        slot.waktu = `${formatMinutesToTime(currentStart)} - ${formatMinutesToTime(newEnd)}`;
        currentStart = newEnd;
    }

    renderTimeSlotsModalContent();
}

function handleSlotTimeChange(idx) {
    syncCurrentEditingSlotsFromDOM();
    recalculateTimeSlots(idx + 1, false);
}

function handleSlotTypeChange(idx) {
    syncCurrentEditingSlotsFromDOM();
    normalizeGeneratedJamKe();
    recalculateTimeSlots(idx, false);
}

function addTimeSlotRow() {
    syncCurrentEditingSlotsFromDOM();
    let lastEnd = '15.00';
    if (currentEditingSlots.length > 0) {
        const lastTimes = parseSlotTimes(currentEditingSlots[currentEditingSlots.length - 1].waktu);
        if (lastTimes) {
            lastEnd = formatMinutesToTime(lastTimes.end);
        }
    }
    const endMins = parseTimeMinutes(lastEnd) || 15 * 60;
    const nextEnd = endMins + currentKbmDuration;

    currentEditingSlots.push({
        _editKey: 'new_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
        jamKe: '',
        waktu: `${lastEnd} - ${formatMinutesToTime(nextEnd)}`,
        type: 'kbm',
        label: ''
    });
    normalizeGeneratedJamKe();
    renderTimeSlotsModalContent();
}

function deleteTimeSlotRow(idx) {
    syncCurrentEditingSlotsFromDOM();
    if (currentEditingSlots.length <= 1) {
        showToast('Minimal harus ada 1 slot waktu.', 'warning');
        return;
    }
    currentEditingSlots.splice(idx, 1);
    normalizeGeneratedJamKe();

    // The DOM still contains the row that was just removed from currentEditingSlots.
    // Recalculate directly from the updated array so the deleted row is not restored
    // by syncCurrentEditingSlotsFromDOM().
    recalculateTimeSlots(idx, false);
}

function renderTimeSlotsModalContent() {
    const modal = document.getElementById('modal-container');
    if (!modal) return;

    const rows = currentEditingSlots.map((slot, idx) => `
        <tr class="hover:bg-slate-50 transition text-xs slot-row-item" data-slot-key="${slot._editKey || ''}">
            <td class="p-2 text-center font-bold text-slate-500">${idx + 1}</td>
            <td class="p-2">
                <input type="text" value="${slot.jamKe}" class="input-slot-jam w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-center font-mono font-bold focus:ring-1 focus:ring-emerald-500">
            </td>
            <td class="p-2">
                <input type="text" value="${slot.waktu}" placeholder="07.00 - 07.40" 
                       onchange="handleSlotTimeChange(${idx})" 
                       class="input-slot-waktu w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-mono font-bold focus:ring-1 focus:ring-emerald-500">
            </td>
            <td class="p-2">
                <select onchange="handleSlotTypeChange(${idx})" class="select-slot-type w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg font-semibold focus:ring-1 focus:ring-emerald-500">
                    <option value="kbm" ${slot.type === 'kbm' ? 'selected' : ''}>KBM Pelajaran</option>
                    <option value="istirahat" ${slot.type === 'istirahat' ? 'selected' : ''}>Istirahat / Shalat</option>
                    <option value="upacara" ${slot.type === 'upacara' ? 'selected' : ''}>Upacara Bendera</option>
                </select>
            </td>
            <td class="p-2">
                <input type="text" value="${slot.label || ''}" placeholder="Contoh: ISTIRAHAT" class="input-slot-label w-full px-2 py-1.5 bg-white border border-slate-200 rounded-lg focus:ring-1 focus:ring-emerald-500">
            </td>
            <td class="p-2 text-center">
                <button type="button" onclick="deleteTimeSlotRow(${idx})" class="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition" title="Hapus Slot ini">
                    <i class="fa-solid fa-trash-can text-sm"></i>
                </button>
            </td>
        </tr>
    `).join('');

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-4xl rounded-3xl shadow-2xl p-6 space-y-4 max-h-[90vh] flex flex-col">
                <div class="flex justify-between items-center pb-3 border-b border-slate-150 shrink-0">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center">
                            <i class="fa-solid fa-clock text-sm"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-850 text-base">Kelola Jam & Waktu Slot Roster</h3>
                            <p class="text-[10px] text-slate-400 font-medium">Tambah, edit, atau hapus alokasi jam dan waktu pelajaran secara dinamis</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="p-1.5 hover:bg-slate-100 rounded-xl transition text-slate-400 hover:text-slate-600 cursor-pointer">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <form onsubmit="saveTimeSlots(event)" class="flex-1 overflow-y-auto space-y-4 pr-1">
                    <div class="flex flex-wrap justify-between items-center bg-slate-50 p-3 rounded-2xl border border-slate-200 gap-2">
                        <div class="flex items-center space-x-2">
                            <span class="text-xs font-bold text-slate-700">Total Slot Waktu: ${currentEditingSlots.length} Jam</span>
                        </div>
                        <div class="flex items-center space-x-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm">
                            <label class="text-xs font-semibold text-slate-600 flex items-center space-x-1">
                                <i class="fa-solid fa-clock text-emerald-600 text-xs"></i>
                                <span>Durasi 1 Jam KBM:</span>
                            </label>
                            <input type="number" id="kbm-duration-input" value="${currentKbmDuration}" min="10" max="180" 
                                   onchange="recalculateTimeSlots(0)" 
                                   class="w-16 px-2 py-1 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-bold text-center focus:bg-white focus:ring-1 focus:ring-emerald-500">
                            <span class="text-xs font-medium text-slate-500">menit</span>
                            <button type="button" onclick="recalculateTimeSlots(0)" 
                                    class="ml-1 px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center space-x-1 shadow-sm">
                                <i class="fa-solid fa-rotate text-[10px]"></i>
                                <span>Auto Hitung Waktu</span>
                            </button>
                        </div>
                    </div>

                    <table class="w-full text-left border-collapse border border-slate-200 rounded-xl overflow-hidden">
                        <thead>
                            <tr class="bg-slate-100 text-[10px] uppercase font-bold text-slate-600 border-b">
                                <th class="p-2 text-center w-10">No</th>
                                <th class="p-2 text-center w-20">Jam Ke</th>
                                <th class="p-2 w-40">Rentang Waktu</th>
                                <th class="p-2 w-36">Jenis Slot</th>
                                <th class="p-2">Label Istirahat / Upacara</th>
                                <th class="p-2 text-center w-12">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-150">
                            ${rows}
                        </tbody>
                    </table>

                    <div class="flex justify-between items-center pt-3 border-t border-slate-150 shrink-0">
                        <button type="button" onclick="addTimeSlotRow()" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow flex items-center space-x-1.5 cursor-pointer">
                            <i class="fa-solid fa-plus text-xs"></i>
                            <span>Tambah Baris Slot Jam</span>
                        </button>
                        <div class="flex space-x-2">
                            <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition">Batal</button>
                            <button type="submit" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition shadow">Simpan Waktu Slot</button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
}

async function saveTimeSlots(e) {
    if (e) e.preventDefault();
    syncCurrentEditingSlotsFromDOM();

    const kbmInput = document.getElementById('kbm-duration-input');
    if (kbmInput) {
        currentKbmDuration = parseInt(kbmInput.value, 10) || currentKbmDuration || 40;
    }

    normalizeGeneratedJamKe();

    const invalidSlot = currentEditingSlots.find(slot => !parseSlotTimes(slot && slot.waktu));
    if (invalidSlot) {
        showToast('Ada rentang waktu slot yang tidak valid. Gunakan format seperti 07.00 - 07.40.', 'error');
        return;
    }

    const migration = migrateSchedulesForTimeSlotEdit(
        appState.schedules || [],
        originalEditingSlots || [],
        currentEditingSlots || []
    );

    const persistedSlots = stripTimeSlotEditMetadata(currentEditingSlots);
    const nextSavedRosters = JSON.parse(JSON.stringify(appState.savedRosters || []));
    if (appState.activeRosterId && Array.isArray(nextSavedRosters)) {
        const activeRoster = nextSavedRosters.find(r => String(r.id) === String(appState.activeRosterId));
        if (activeRoster) {
            activeRoster.timeSlots = JSON.parse(JSON.stringify(persistedSlots));
            activeRoster.kbmDuration = currentKbmDuration;
            activeRoster.schedules = JSON.parse(JSON.stringify(migration.schedules));
        }
    }

    const submitButton = e && e.target ? e.target.querySelector('button[type="submit"]') : null;
    const originalButtonHtml = submitButton ? submitButton.innerHTML : '';
    if (submitButton) {
        submitButton.disabled = true;
        submitButton.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-1"></i>Menyimpan...';
    }

    try {
        const response = await fetch('/api/time-slots', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                timeSlots: persistedSlots,
                kbmDuration: currentKbmDuration,
                schedules: migration.schedules,
                savedRosters: nextSavedRosters
            })
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || !data.success) {
            throw new Error((data && data.message) || 'Server gagal menyimpan perubahan waktu roster.');
        }

        appState.timeSlots = Array.isArray(data.timeSlots) ? data.timeSlots : persistedSlots;
        appState.kbmDuration = Number(data.kbmDuration) || currentKbmDuration;
        appState.schedules = Array.isArray(data.schedules) ? data.schedules : migration.schedules;
        appState.savedRosters = Array.isArray(data.savedRosters) ? data.savedRosters : nextSavedRosters;

        safeSetLocalStorage('madrasah_timeSlots', appState.timeSlots);
        safeSetLocalStorage('madrasah_kbmDuration', appState.kbmDuration);
        safeSetLocalStorage('madrasah_schedules', appState.schedules);
        safeSetLocalStorage('madrasah_savedRosters', appState.savedRosters);

        let detail = '';
        if (migration.migratedCount > 0 || migration.removedCount > 0) {
            detail = ` (${migration.migratedCount} jadwal mengikuti waktu baru`;
            if (migration.removedCount > 0) detail += `, ${migration.removedCount} jadwal pada slot KBM yang dihapus dibersihkan`;
            detail += ')';
        }
        showToast('Waktu slot roster berhasil tersimpan permanen' + detail + '!', 'success');
        closeModal();

        const container = document.getElementById('view-container');
        if (container) renderScheduleModule(container);
    } catch (err) {
        console.error('Gagal menyimpan waktu slot roster:', err);
        showToast(err.message || 'Gagal menyimpan waktu slot roster.', 'error');
    } finally {
        if (submitButton) {
            submitButton.disabled = false;
            submitButton.innerHTML = originalButtonHtml;
        }
    }
}

// Print / Download Roster Function (Guaranteed to Work in all environments)
function printRosterJadwal() {
    const classes = appState.classes || [];
    const subjects = appState.subjects || [];
    const teachers = appState.teachers || [];
    const schedules = appState.schedules || [];
    const settings = appState.settings || {};

    const schoolName = settings.schoolName || 'MADRASAH ALIYAH NEGERI 1 TANJUNG JABUNG BARAT';
    const academicYear = settings.academicYear || '2026/2027';
    const semester = settings.semester || 'GANJIL';
    const principalName = settings.principalName || 'H. Heri Pasudi, S.Pd., M.Pd.';

    const teacherCodeMap = {};
    teachers.forEach((t, idx) => {
        teacherCodeMap[t.id] = String(idx + 1).padStart(2, '0');
    });

    const matrixHtml = renderRosterMatrixHTML(classes, subjects, teachers, schedules, teacherCodeMap, false);

    const legendHtml = teachers.map((t, idx) => {
        const code = teacherCodeMap[t.id] || String(idx + 1).padStart(2, '0');
        return `
            <tr>
                <td style="padding: 4px; border: 1px solid #cbd5e1; text-align: center; font-weight: bold; font-family: monospace;">${code}</td>
                <td style="padding: 4px; border: 1px solid #cbd5e1; font-weight: 600;">${t.name}</td>
            </tr>
        `;
    }).join('');

    const documentHtml = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>ROSTER PEMBELAJARAN SEMESTER ${semester.toUpperCase()} ${schoolName}</title>
            <style>
                @page { size: landscape; margin: 8mm; }
                body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 12px; color: #0f172a; font-size: 11px; background: white; }
                .header-box { text-align: center; background: #065f46; color: white; padding: 12px 16px; border-radius: 8px; margin-bottom: 12px; }
                .header-box h1 { margin: 0; font-size: 18px; font-weight: 900; letter-spacing: 1px; text-transform: uppercase; }
                .header-box h2 { margin: 4px 0 0 0; font-size: 14px; font-weight: 700; opacity: 0.95; text-transform: uppercase; }
                .content-grid { display: flex; gap: 12px; align-items: flex-start; }
                .main-table-container { flex: 1; overflow-x: auto; }
                .legend-container { width: 220px; flex-shrink: 0; }
                table { border-collapse: collapse; width: 100%; font-size: 10px; }
                th, td { border: 1px solid #94a3b8; }
                .footer-signatures { margin-top: 20px; display: flex; justify-content: space-between; text-align: center; }
                .sig-box { width: 30%; }
                .sig-space { height: 50px; }
                @media print {
                    .no-print { display: none !important; }
                }
            </style>
        </head>
        <body>
            <div class="header-box">
                <h1>ROSTER PEMBELAJARAN SEMESTER ${semester.toUpperCase()}</h1>
                <h2>${schoolName.toUpperCase()} TAHUN PELAJARAN ${academicYear}</h2>
            </div>

            <div class="content-grid">
                <div class="main-table-container">
                    ${matrixHtml}
                </div>
                <div class="legend-container">
                    <div style="background: #065f46; color: white; font-weight: bold; padding: 6px; text-align: center; border-radius: 4px 4px 0 0; font-size: 10px;">
                        NAMA GURU DAN KODE
                    </div>
                    <table>
                        <thead>
                            <tr style="background: #e2e8f0; font-weight: bold;">
                                <td style="padding: 4px; text-align: center; width: 40px;">Kode</td>
                                <td style="padding: 4px;">Nama Guru</td>
                            </tr>
                        </thead>
                        <tbody>
                            ${legendHtml || `<tr><td colspan="2" style="padding: 6px; text-align: center;">Belum ada guru</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="footer-signatures">
                <div class="sig-box">
                    <p style="margin: 0; font-weight: bold;">Waka Kurikulum</p>
                    <div class="sig-space"></div>
                    <p style="margin: 0; font-weight: bold; text-decoration: underline;">Nurfeni, S.Pd.</p>
                </div>
                <div class="sig-box">
                    <p style="margin: 0; font-weight: bold;">Mengetahui,</p>
                    <p style="margin: 0; font-weight: bold;">Kepala ${schoolName}</p>
                    <div class="sig-space"></div>
                    <p style="margin: 0; font-weight: bold; text-decoration: underline;">${principalName}</p>
                </div>
            </div>
        </body>
        </html>
    `;

    // Try popup window first, if blocked show in-page modal iframe
    let printWin = null;
    try {
        printWin = window.open('', '_blank');
    } catch(err) {}

    if (printWin) {
        printWin.document.write(documentHtml);
        printWin.document.close();
        setTimeout(() => {
            try { printWin.print(); } catch(e){}
        }, 500);
        return;
    }

    // Fallback printable modal popup
    const modal = document.getElementById('modal-container');
    if (!modal) return;

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-2 sm:p-4">
            <div class="bg-white w-full max-w-7xl rounded-3xl shadow-2xl p-4 sm:p-6 flex flex-col h-[95vh] overflow-hidden">
                <div class="flex justify-between items-center pb-3 border-b border-slate-150 shrink-0">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                            <i class="fa-solid fa-print text-sm"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-850 text-base">Pratinjau & Cetak Roster Pembelajaran</h3>
                            <p class="text-[10px] text-slate-400 font-medium">Format Roster Cetak Lanskap Madrasah</p>
                        </div>
                    </div>
                    <div class="flex items-center space-x-2">
                        <button type="button" onclick="triggerFramePrint()" class="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow flex items-center space-x-1.5 cursor-pointer">
                            <i class="fa-solid fa-print"></i>
                            <span>Cetak Sekarang (Print / PDF)</span>
                        </button>
                        <button type="button" onclick="closeModal()" class="p-1.5 hover:bg-slate-100 rounded-xl transition text-slate-400 hover:text-slate-600 cursor-pointer">
                            <i class="fa-solid fa-xmark text-lg"></i>
                        </button>
                    </div>
                </div>
                <div class="flex-1 bg-slate-100 rounded-2xl overflow-hidden mt-3 p-1">
                    <iframe id="roster-print-iframe" class="w-full h-full border-0 rounded-xl bg-white"></iframe>
                </div>
            </div>
        </div>
    `;

    setTimeout(() => {
        const iframe = document.getElementById('roster-print-iframe');
        if (iframe) {
            const frameDoc = iframe.contentWindow.document;
            frameDoc.open();
            frameDoc.write(documentHtml);
            frameDoc.close();
        }
    }, 100);
}

function triggerFramePrint() {
    const iframe = document.getElementById('roster-print-iframe');
    if (iframe && iframe.contentWindow) {
        iframe.contentWindow.print();
    } else {
        window.print();
    }
}

// ==========================================
// SAVED ROSTERS MANAGEMENT FUNCTIONS
// ==========================================

function renderSavedRosterCardsHTML(savedRosters, activeRosterId, canManage = true) {
    if (!Array.isArray(savedRosters) || savedRosters.length === 0) {
        return `
            <div class="w-full text-xs text-slate-500 italic py-2.5 px-3 bg-white rounded-xl border border-dashed border-slate-200 flex items-center space-x-2">
                <i class="fa-solid fa-circle-info text-emerald-600"></i>
                <span>Belum ada versi roster tersimpan. Klik tombol <strong>"Simpan Roster"</strong> untuk menyimpan susunan KBM saat ini sebagai versi roster tersimpan.</span>
            </div>
        `;
    }

    return savedRosters.map((r, idx) => {
        const isActive = String(r.id) === String(activeRosterId) || (idx === 0 && !activeRosterId);
        const count = Array.isArray(r.schedules) ? r.schedules.length : 0;
        const formattedTitle = r.title || `Roster ${idx + 1}`;
        
        return `
            <div onclick="loadSavedRoster('${r.id}')" 
                class="relative group cursor-pointer transition-all duration-200 p-3 rounded-2xl border ${
                    isActive 
                        ? 'bg-emerald-50/95 border-emerald-500 shadow-sm ring-2 ring-emerald-300/60' 
                        : 'bg-white border-slate-200 hover:border-emerald-400 hover:bg-slate-50/80 hover:shadow-xs'
                } flex items-center justify-between gap-3 min-w-[210px] max-w-[290px] shrink-0">
                
                <div class="space-y-1 min-w-0 flex-1">
                    <div class="flex items-center space-x-1.5">
                        <i class="fa-solid fa-calendar-week text-xs ${isActive ? 'text-emerald-700' : 'text-slate-400'}"></i>
                        <span class="font-extrabold text-xs truncate ${isActive ? 'text-emerald-950' : 'text-slate-800'}" title="${formattedTitle}">
                            ${formattedTitle}
                        </span>
                        ${isActive ? '<span class="px-1.5 py-0.5 bg-emerald-600 text-white text-[9px] font-black rounded-md uppercase tracking-wider shrink-0 shadow-xs">AKTIF</span>' : ''}
                    </div>
                    <div class="flex items-center space-x-2 text-[10px] ${isActive ? 'text-emerald-700 font-semibold' : 'text-slate-400'}">
                        <span><i class="fa-regular fa-clock mr-1"></i>${r.savedAt || 'Baru'}</span>
                        <span>•</span>
                        <span><i class="fa-solid fa-book-open mr-1"></i>${count} Jam</span>
                    </div>
                </div>

                ${canManage ? `
                <div class="flex items-center space-x-1 shrink-0 opacity-80 group-hover:opacity-100 transition">
                    <button type="button" onclick="event.stopPropagation(); openEditSavedRosterModal('${r.id}')" title="Ubah Nama Roster" class="w-6 h-6 rounded-lg bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-700 flex items-center justify-center transition cursor-pointer">
                        <i class="fa-solid fa-pen text-[10px]"></i>
                    </button>
                    <button type="button" onclick="event.stopPropagation(); openDeleteSavedRosterModal('${r.id}')" title="Hapus Roster Ini" class="w-6 h-6 rounded-lg bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-600 flex items-center justify-center transition cursor-pointer">
                        <i class="fa-solid fa-trash-can text-[10px]"></i>
                    </button>
                </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

function openSaveRosterModal() {
    const modal = document.getElementById('modal-container');
    if (!modal) return;

    appState.savedRosters = appState.savedRosters || [];
    const activeRoster = appState.savedRosters.find(r => String(r.id) === String(appState.activeRosterId));
    
    // Default suggested title
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    const defaultTitle = activeRoster ? activeRoster.title : `Roster Pembelajaran KBM (${dateStr})`;
    const currentScheduleCount = (appState.schedules || []).length;

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-5 border border-slate-100">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-9 h-9 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center font-bold">
                            <i class="fa-solid fa-floppy-disk text-base"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-800 text-base">Simpan Versi Roster KBM</h3>
                            <p class="text-xs text-slate-400">Simpan susunan jadwal saat ini ke kartu versi roster</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer">
                        <i class="fa-solid fa-xmark text-sm"></i>
                    </button>
                </div>

                <div class="space-y-4">
                    <div class="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-100 text-xs text-emerald-900 space-y-1">
                        <div class="font-bold flex items-center space-x-1.5">
                            <i class="fa-solid fa-circle-check text-emerald-600"></i>
                            <span>Ringkasan Data Roster Saat Ini:</span>
                        </div>
                        <p class="text-[11px] text-emerald-700">Terdapat <strong>${currentScheduleCount}</strong> entri jam pelajaran terpasang di matriks.</p>
                    </div>

                    <div>
                        <label class="block text-xs font-bold text-slate-700 mb-1.5">Nama / Judul Versi Roster <span class="text-rose-500">*</span></label>
                        <input type="text" id="roster-save-title" value="${defaultTitle}" placeholder="Misal: Roster Semester Ganjil 2026, Roster Ujian, dll" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-800 focus:bg-white focus:border-emerald-500 focus:outline-none font-semibold transition" />
                    </div>

                    ${activeRoster ? `
                    <div class="space-y-2 pt-1">
                        <label class="block text-xs font-bold text-slate-700">Opsi Penyimpanan:</label>
                        <label class="flex items-center space-x-2.5 p-3 rounded-2xl border border-slate-200 hover:border-emerald-400 cursor-pointer transition bg-slate-50/50">
                            <input type="radio" name="roster-save-mode" value="overwrite" checked class="accent-emerald-600">
                            <div class="text-xs">
                                <span class="font-bold text-slate-800 block">Perbarui Versi Aktif ("${activeRoster.title}")</span>
                                <span class="text-[10px] text-slate-400">Timpa versi roster ini dengan susunan jadwal terbaru</span>
                            </div>
                        </label>
                        <label class="flex items-center space-x-2.5 p-3 rounded-2xl border border-slate-200 hover:border-emerald-400 cursor-pointer transition bg-slate-50/50">
                            <input type="radio" name="roster-save-mode" value="new" class="accent-emerald-600">
                            <div class="text-xs">
                                <span class="font-bold text-slate-800 block">Simpan Sebagai Roster Baru</span>
                                <span class="text-[10px] text-slate-400">Buat kartu versi roster baru secara terpisah</span>
                            </div>
                        </label>
                    </div>
                    ` : ''}
                </div>

                <div class="flex justify-end gap-2.5 pt-2">
                    <button type="button" onclick="closeModal()" class="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-2xl transition cursor-pointer">Batal</button>
                    <button type="button" onclick="confirmSaveRoster()" class="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-2xl shadow-sm transition flex items-center space-x-1.5 cursor-pointer">
                        <i class="fa-solid fa-floppy-disk text-xs"></i>
                        <span>Simpan Versi Roster</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function confirmSaveRoster() {
    const titleInput = document.getElementById('roster-save-title');
    if (!titleInput) return;
    const title = titleInput.value.trim();

    if (!title) {
        showToast('Mohon masukkan nama / judul roster terlebih dahulu!', 'warning');
        return;
    }

    appState.savedRosters = appState.savedRosters || [];
    const modeEl = document.querySelector('input[name="roster-save-mode"]:checked');
    const mode = modeEl ? modeEl.value : 'new';
    const now = new Date();
    const formattedDate = now.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    let targetRosterId = null;

    if (mode === 'overwrite' && appState.activeRosterId) {
        const existingIdx = appState.savedRosters.findIndex(r => String(r.id) === String(appState.activeRosterId));
        if (existingIdx !== -1) {
            appState.savedRosters[existingIdx].title = title;
            appState.savedRosters[existingIdx].savedAt = formattedDate;
            appState.savedRosters[existingIdx].schedules = JSON.parse(JSON.stringify(appState.schedules || []));
            appState.savedRosters[existingIdx].timeSlots = JSON.parse(JSON.stringify(appState.timeSlots || []));
            appState.savedRosters[existingIdx].kbmDuration = appState.kbmDuration || 40;
            targetRosterId = appState.savedRosters[existingIdx].id;
        }
    }

    if (!targetRosterId) {
        targetRosterId = 'roster_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6);
        const newRoster = {
            id: targetRosterId,
            title: title,
            savedAt: formattedDate,
            schedules: JSON.parse(JSON.stringify(appState.schedules || [])),
            timeSlots: JSON.parse(JSON.stringify(appState.timeSlots || [])),
            kbmDuration: appState.kbmDuration || 40
        };
        appState.savedRosters.unshift(newRoster);
    }

    appState.activeRosterId = targetRosterId;
    localStorage.setItem('madrasah_activeRosterId', targetRosterId);
    saveState('savedRosters');

    showToast(`Versi Roster "${title}" berhasil disimpan!`, 'success');
    closeModal();

    const container = document.getElementById('view-container');
    if (container) renderScheduleModule(container);
}

function loadSavedRoster(rosterId) {
    if (!rosterId) return;
    appState.savedRosters = appState.savedRosters || [];
    const targetRoster = appState.savedRosters.find(r => String(r.id) === String(rosterId));

    if (!targetRoster) {
        showToast('Versi roster tidak ditemukan.', 'error');
        return;
    }

    appState.activeRosterId = targetRoster.id;
    appState.schedules = JSON.parse(JSON.stringify(targetRoster.schedules || []));

    if (Array.isArray(targetRoster.timeSlots) && targetRoster.timeSlots.length > 0) {
        appState.timeSlots = JSON.parse(JSON.stringify(targetRoster.timeSlots));
        safeSetLocalStorage('madrasah_timeSlots', appState.timeSlots);
        saveState('timeSlots');
    }
    if (targetRoster.kbmDuration) {
        appState.kbmDuration = targetRoster.kbmDuration;
        safeSetLocalStorage('madrasah_kbmDuration', appState.kbmDuration);
        saveState('kbmDuration');
    }

    localStorage.setItem('madrasah_activeRosterId', targetRoster.id);
    saveState('schedules');
    saveState('savedRosters');

    showToast(`Versi roster "${targetRoster.title}" berhasil dibuka!`, 'success');

    const container = document.getElementById('view-container');
    if (container) renderScheduleModule(container);
}

function openEditSavedRosterModal(rosterId) {
    appState.savedRosters = appState.savedRosters || [];
    const target = appState.savedRosters.find(r => String(r.id) === String(rosterId));
    if (!target) return;

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
            <div class="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-4 border border-slate-100">
                <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                    <h3 class="font-extrabold text-slate-800 text-sm flex items-center space-x-2">
                        <i class="fa-solid fa-pen text-emerald-600"></i>
                        <span>Ubah Nama Roster</span>
                    </h3>
                    <button type="button" onclick="closeModal()" class="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer">
                        <i class="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>
                <div>
                    <label class="block text-xs font-bold text-slate-700 mb-1">Nama Versi Roster</label>
                    <input type="text" id="roster-edit-title" value="${adminEscapeAttr(target.title)}" class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-emerald-500" />
                </div>
                <div class="flex justify-end gap-2 pt-2">
                    <button type="button" onclick="closeModal()" class="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 rounded-xl cursor-pointer">Batal</button>
                    <button type="button" onclick="confirmEditSavedRoster(${adminInlineArg(target.id)})" class="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer">Simpan</button>
                </div>
            </div>
        </div>
    `;
}

function confirmEditSavedRoster(rosterId) {
    const input = document.getElementById('roster-edit-title');
    if (!input) return;
    const newTitle = input.value.trim();
    if (!newTitle) {
        showToast('Nama roster tidak boleh kosong', 'warning');
        return;
    }

    appState.savedRosters = appState.savedRosters || [];
    const target = appState.savedRosters.find(r => String(r.id) === String(rosterId));
    if (target) {
        target.title = newTitle;
        saveState('savedRosters');
        showToast('Nama versi roster berhasil diperbarui!', 'success');
        closeModal();
        const container = document.getElementById('view-container');
        if (container) renderScheduleModule(container);
    }
}

function openDeleteSavedRosterModal(rosterId) {
    appState.savedRosters = appState.savedRosters || [];
    const target = appState.savedRosters.find(r => String(r.id) === String(rosterId));
    if (!target) return;

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-fadeIn">
            <div class="bg-white w-full max-w-sm rounded-3xl shadow-2xl p-6 space-y-4 border border-slate-100">
                <div class="flex items-center justify-between pb-2 border-b border-slate-100">
                    <div class="flex items-center space-x-2 text-rose-600">
                        <i class="fa-solid fa-triangle-exclamation text-base"></i>
                        <h3 class="font-extrabold text-slate-800 text-sm">Hapus Versi Roster</h3>
                    </div>
                    <button type="button" onclick="closeModal()" class="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer">
                        <i class="fa-solid fa-xmark text-xs"></i>
                    </button>
                </div>
                <div class="text-xs text-slate-600 leading-relaxed space-y-1">
                    <p>Apakah Anda yakin ingin menghapus versi roster <strong>"${adminEscapeHtml(target.title)}"</strong>?</p>
                    <p class="text-[11px] text-slate-400">Tindakan ini tidak dapat dibatalkan.</p>
                </div>
                <div class="flex justify-end gap-2 pt-2">
                    <button type="button" onclick="closeModal()" class="px-3.5 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer">Batal</button>
                    <button type="button" onclick="confirmDeleteSavedRoster(${adminInlineArg(target.id)})" class="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer">Hapus Roster</button>
                </div>
            </div>
        </div>
    `;
}

function confirmDeleteSavedRoster(rosterId) {
    appState.savedRosters = appState.savedRosters || [];
    const target = appState.savedRosters.find(r => String(r.id) === String(rosterId));
    if (!target) return;

    appState.savedRosters = appState.savedRosters.filter(r => String(r.id) !== String(rosterId));

    if (String(appState.activeRosterId) === String(rosterId)) {
        appState.activeRosterId = appState.savedRosters.length > 0 ? appState.savedRosters[0].id : null;
        if (appState.activeRosterId) {
            const first = appState.savedRosters[0];
            appState.schedules = JSON.parse(JSON.stringify(first.schedules || []));
            saveState('schedules');
        }
    }

    localStorage.setItem('madrasah_activeRosterId', appState.activeRosterId || '');
    saveState('savedRosters');

    showToast(`Versi roster "${target.title}" berhasil dihapus.`, 'info');
    closeModal();

    const container = document.getElementById('view-container');
    if (container) renderScheduleModule(container);
}

function deleteSavedRoster(rosterId) {
    openDeleteSavedRosterModal(rosterId);
}


function openSubjectModal(subjectId = null) {
    const modal = document.getElementById('modal-container');
    const existing = subjectId && appState.subjects ? appState.subjects.find(s => String(s.id) === String(subjectId)) : null;
    const isEdit = !!existing;

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 sm:p-7 space-y-4" onclick="event.stopPropagation()">
                <div class="flex justify-between items-center pb-2 border-b border-slate-100">
                    <div class="flex items-center space-x-2.5 text-teal-600">
                        <div class="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center font-bold">
                            <i class="fa-solid ${isEdit ? 'fa-pen-to-square' : 'fa-book'}"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-800 text-base">${isEdit ? 'Edit Mata Pelajaran' : 'Tambah Mapel Baru'}</h3>
                            <p class="text-[11px] text-slate-400 font-medium">${isEdit ? `Kunci ID Unik: <span class="font-mono font-bold text-teal-700">${escapeHtml(existing.id)}</span>` : 'Mata pelajaran baru madrasah'}</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <form onsubmit="saveSubject(event, '${isEdit ? existing.id : ''}')" class="space-y-3.5">
                    ${isEdit ? `<input type="hidden" id="sub-id" value="${escapeHtml(existing.id)}">` : ''}
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Kode Mapel <span class="text-rose-500">*</span></label>
                        <input type="text" id="sub-code" required value="${isEdit ? escapeHtml(existing.code || '') : ''}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500 uppercase" placeholder="Contoh: FQ, B.ARAB, MTK">
                    </div>
                    <div>
                        <label class="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Nama Mata Pelajaran <span class="text-rose-500">*</span></label>
                        <input type="text" id="sub-name" required value="${isEdit ? escapeHtml(existing.name || '') : ''}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-teal-500" placeholder="Contoh: Fikih, Bahasa Arab, Matematika">
                    </div>
                    <div class="flex justify-end items-center space-x-2 pt-3 border-t border-slate-100">
                        <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition cursor-pointer">Batal</button>
                        <button type="submit" class="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center space-x-1.5 cursor-pointer">
                            <i class="fa-solid fa-floppy-disk"></i>
                            <span>${isEdit ? 'Simpan Perubahan' : 'Simpan Mapel'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
}

async function saveSubject(e, editId = '') {
    e.preventDefault();
    const code = document.getElementById('sub-code').value.trim();
    const name = document.getElementById('sub-name').value.trim();
    const idInput = document.getElementById('sub-id');
    const id = idInput ? idInput.value.trim() : (editId || null);

    try {
        const url = id ? `/api/subjects/${id}` : '/api/subjects';
        const method = id ? 'PUT' : 'POST';
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, code, name })
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.message || 'Gagal menyimpan mapel.');

        await loadSubjectsFromServer();
        closeModal();
        showToast(data.message || (id ? 'Mata pelajaran berhasil diperbarui!' : 'Mata pelajaran berhasil ditambahkan!'), 'success');
        const container = document.getElementById('view-container');
        if (container) renderScheduleModule(container);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function loadSubjectsFromServer() {
    try {
        const response = await fetch('/api/subjects');
        const data = await response.json();
        if (response.ok && data.success) {
            appState.subjects = data.subjects;
            try {
                localStorage.setItem('madrasah_subjects', JSON.stringify(appState.subjects));
            } catch (e) {
                console.warn('LocalStorage error:', e);
            }
        }
    } catch (err) {
        console.error('Error loading subjects:', err);
    }
}

async function deleteSubject(id) {
    showConfirmModal('Hapus mata pelajaran ini?', async () => {
        try {
            const res = await fetch(`/api/subjects/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok || !data.success) throw new Error(data.message || 'Gagal menghapus mapel');

            appState.subjects = (appState.subjects || []).filter(s => String(s.id) !== String(id));
            saveState('subjects');
            showToast('Mata pelajaran dihapus!', 'success');
            renderScheduleModule(document.getElementById('view-container'));
        } catch (err) {
            showToast(err.message || 'Gagal menghapus mapel', 'error');
        }
    });
}

// Interactive Schedule Manager Functions
function openSusunJadwalModal() {
    const modal = document.getElementById('modal-container');
    
    // Build select options
    const classOptions = (appState.classes || []).map(c => `<option value="${c.id}">${c.name}</option>`).join('');
    const subjectOptions = (appState.subjects || []).map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    const teacherOptions = (appState.teachers || []).map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    
    // Schedules list html
    const schedulesList = (appState.schedules || []).map((sc, idx) => {
        const cls = (appState.classes || []).find(c => c.id === sc.classId);
        const sub = (appState.subjects || []).find(s => s.id === sc.subjectId);
        const tch = (appState.teachers || []).find(t => t.id === sc.teacherId || t.id === sc.teacher_id);
        return `
            <tr class="hover:bg-slate-50 transition text-xs">
                <td class="p-2.5 border border-slate-200 font-bold text-slate-800 text-center">${idx + 1}</td>
                <td class="p-2.5 border border-slate-200 font-semibold text-emerald-700">${sc.day}</td>
                <td class="p-2.5 border border-slate-200 font-medium text-slate-800">${cls ? cls.name : '-'}</td>
                <td class="p-2.5 border border-slate-200 font-medium text-slate-800">${sub ? sub.name : '-'}</td>
                <td class="p-2.5 border border-slate-200 text-slate-600 font-mono">${sc.time}</td>
                <td class="p-2.5 border border-slate-200 text-slate-600 font-medium">${tch ? tch.name : '-'}</td>
                <td class="p-2.5 border border-slate-200 text-center">
                    <button type="button" onclick="deleteSchedule('${sc.id}')" class="p-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg transition cursor-pointer">
                        <i class="fa-solid fa-trash-can text-xs"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-4xl rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col h-[85vh] overflow-hidden">
                <div class="flex justify-between items-center pb-4 border-b border-slate-150 shrink-0">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                            <i class="fa-solid fa-calendar-days text-sm"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-850 text-base">Penyusunan Jadwal Pelajaran</h3>
                            <p class="text-[10px] text-slate-400 font-medium">Tambah dan hapus jadwal KBM secara interaktif</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="p-1.5 hover:bg-slate-100 rounded-xl transition text-slate-400 hover:text-slate-600 cursor-pointer">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <div class="flex-1 overflow-y-auto py-5 space-y-6">
                    <!-- Form Tambah Jadwal -->
                    <form onsubmit="saveSchedule(event)" class="bg-slate-50/50 p-4 rounded-2xl border border-slate-150 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 shrink-0">
                        <div class="md:col-span-5"><h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider">Tambah Jadwal Baru</h4></div>
                        <div>
                            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Hari</label>
                            <select id="sch-day" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                <option value="Senin">Senin</option>
                                <option value="Selasa">Selasa</option>
                                <option value="Rabu">Rabu</option>
                                <option value="Kamis">Kamis</option>
                                <option value="Jumat">Jumat</option>
                                <option value="Sabtu">Sabtu</option>
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Kelas</label>
                            <select id="sch-class" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                ${classOptions}
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Mata Pelajaran</label>
                            <select id="sch-subject" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                ${subjectOptions}
                            </select>
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Waktu</label>
                            <input type="text" id="sch-time" placeholder="Contoh: 07:30 - 09:00" required class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Guru Pengampu</label>
                            <select id="sch-teacher" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500">
                                ${teacherOptions}
                            </select>
                        </div>
                        <div class="sm:col-span-2 md:col-span-5 flex justify-end pt-1">
                            <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition shadow flex items-center space-x-1 cursor-pointer">
                                <i class="fa-solid fa-plus text-[10px]"></i>
                                <span>Tambah Jadwal</span>
                            </button>
                        </div>
                    </form>

                    <!-- Tabel Daftar Jadwal -->
                    <div class="space-y-2">
                        <h4 class="text-xs font-bold text-slate-700 uppercase tracking-wider">Daftar Jadwal Terpasang</h4>
                        <div class="overflow-x-auto border border-slate-150 rounded-2xl bg-white shadow-sm">
                            <table class="w-full text-left border-collapse min-w-[700px]">
                                <thead>
                                    <tr class="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                        <th class="p-2.5 w-12 text-center">No</th>
                                        <th class="p-2.5">Hari</th>
                                        <th class="p-2.5">Kelas</th>
                                        <th class="p-2.5">Mata Pelajaran</th>
                                        <th class="p-2.5">Waktu</th>
                                        <th class="p-2.5">Guru Pengampu</th>
                                        <th class="p-2.5 w-16 text-center">Aksi</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    ${schedulesList || `<tr><td colspan="7" class="p-8 text-center text-xs text-slate-400 font-semibold"><i class="fa-solid fa-calendar-xmark text-lg block mb-1"></i> Belum ada jadwal terpasang.</td></tr>`}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="flex justify-end pt-4 border-t border-slate-150 shrink-0">
                    <button type="button" onclick="closeModal()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition shadow-sm cursor-pointer">
                        Selesai & Tutup
                    </button>
                </div>
            </div>
        </div>
    `;
}

function saveSchedule(e) {
    e.preventDefault();
    const day = document.getElementById('sch-day').value;
    const classId = document.getElementById('sch-class').value;
    const subjectId = document.getElementById('sch-subject').value;
    const time = document.getElementById('sch-time').value.trim();
    const teacherId = document.getElementById('sch-teacher').value;
    
    if (!time) {
        showToast('Waktu pelajaran wajib diisi!', 'error');
        return;
    }
    
    const newSch = {
        id: 'SCH_' + Date.now(),
        day,
        classId,
        subjectId,
        time,
        teacherId
    };
    
    appState.schedules = appState.schedules || [];
    appState.schedules.push(newSch);
    saveState('schedules');
    showToast('Jadwal berhasil ditambahkan!', 'success');
    
    // Refresh modal
    openSusunJadwalModal();
    // Refresh background
    renderScheduleModule(document.getElementById('view-container'));
}

function deleteSchedule(id) {
    showConfirmModal('Apakah Anda yakin ingin menghapus jadwal ini?', () => {
        appState.schedules = appState.schedules.filter(sc => String(sc.id) !== String(id));
        saveState('schedules');
        showToast('Jadwal berhasil dihapus!', 'success');
        
        // Refresh modal
        openSusunJadwalModal();
        // Refresh background
        renderScheduleModule(document.getElementById('view-container'));
    });
}

// Auto-Scheduler Module (Conflict-Free Schedule Generator)
function openAutoScheduleModal() {
    const modal = document.getElementById('modal-container');
    if (!modal) return;

    const daysList = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl p-6 sm:p-8 space-y-5 max-h-[90vh] overflow-y-auto">
                <div class="flex justify-between items-center pb-4 border-b border-slate-150">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                            <i class="fa-solid fa-wand-magic-sparkles text-lg"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-850 text-base sm:text-lg">Susun Otomatis Jadwal Pelajaran</h3>
                            <p class="text-xs text-slate-400 font-medium">Penyusunan otomatis bebas bentrokan guru & jam pelajaran</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition cursor-pointer">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <div class="space-y-4 text-xs">
                    <div class="p-3.5 bg-indigo-50/70 border border-indigo-200 text-indigo-900 rounded-2xl flex items-start space-x-2.5">
                        <i class="fa-solid fa-shield-check text-indigo-600 text-sm mt-0.5"></i>
                        <div>
                            <span class="font-bold text-xs">Algoritma Bebas Bentrokan (Anti-Collision):</span>
                            <p class="mt-0.5 text-[11px] leading-relaxed text-indigo-800">Sistem akan secara otomatis memverifikasi ketersediaan guru pengampu dan kelas pada tiap jam pelajaran. Tidak akan ada guru yang mengajar 2 kelas bersamaan atau kelas yang memiliki 2 mapel bersamaan.</p>
                        </div>
                    </div>

                    <div>
                        <label class="block font-bold text-slate-700 uppercase tracking-wider mb-2">1. Pilih Hari KBM</label>
                        <div class="grid grid-cols-3 sm:grid-cols-6 gap-2" id="auto-sch-days">
                            ${daysList.map(day => `
                                <label class="flex items-center space-x-2 p-2 bg-slate-50 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-100 transition">
                                    <input type="checkbox" value="${day}" checked class="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500">
                                    <span class="font-semibold text-slate-700">${day}</span>
                                </label>
                            `).join('')}
                        </div>
                    </div>

                    <div>
                        <label class="block font-bold text-slate-700 uppercase tracking-wider mb-2">2. Mode Penyusunan</label>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label class="flex items-start space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-indigo-50/50 border-indigo-200 transition">
                                <input type="radio" name="auto-sch-mode" value="replace" checked class="mt-0.5 text-indigo-600 focus:ring-indigo-500">
                                <div>
                                    <span class="font-bold text-slate-800 block">Reset & Susun Ulang</span>
                                    <span class="text-[10px] text-slate-500">Mengganti jadwal terpasang dengan jadwal otomatis baru</span>
                                </div>
                            </label>
                            <label class="flex items-start space-x-3 p-3 bg-slate-50 border border-slate-200 rounded-2xl cursor-pointer hover:bg-indigo-50/50 border-indigo-200 transition">
                                <input type="radio" name="auto-sch-mode" value="append" class="mt-0.5 text-indigo-600 focus:ring-indigo-500">
                                <div>
                                    <span class="font-bold text-slate-800 block">Tambahkan ke Jadwal Ada</span>
                                    <span class="text-[10px] text-slate-500">Menjaga jadwal lama dan mengisi slot jam yang masih kosong</span>
                                </div>
                            </label>
                        </div>
                    </div>

                    <div class="pt-3 flex justify-end space-x-2">
                        <button type="button" onclick="closeModal()" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">
                            Batal
                        </button>
                        <button type="button" onclick="processAutoSchedule()" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-md transition flex items-center space-x-2 cursor-pointer">
                            <i class="fa-solid fa-wand-magic-sparkles text-xs"></i>
                            <span>Jalankan Auto-Scheduler</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function processAutoSchedule() {
    const dayInputs = Array.from(document.querySelectorAll('#auto-sch-days input[type="checkbox"]:checked')).map(cb => cb.value);
    const mode = document.querySelector('input[name="auto-sch-mode"]:checked')?.value || 'replace';

    if (dayInputs.length === 0) {
        showToast('Pilih minimal 1 hari KBM!', 'error');
        return;
    }

    const classes = appState.classes || [];
    const subjects = appState.subjects || [];
    const teachers = appState.teachers || [];

    if (classes.length === 0) {
        showToast('Data kelas masih kosong. Silakan tambah data kelas terlebih dahulu.', 'error');
        return;
    }
    if (subjects.length === 0) {
        showToast('Data mata pelajaran masih kosong. Silakan tambah data mapel terlebih dahulu.', 'error');
        return;
    }

    const timeSlots = [
        '07:30 - 08:30',
        '08:30 - 09:30',
        '09:45 - 10:45',
        '10:45 - 11:45'
    ];

    const teacherBooked = {};
    const classBooked = {};

    dayInputs.forEach(d => {
        teacherBooked[d] = {};
        classBooked[d] = {};
        timeSlots.forEach(t => {
            teacherBooked[d][t] = new Set();
            classBooked[d][t] = new Set();
        });
    });

    if (mode === 'append' && Array.isArray(appState.schedules)) {
        appState.schedules.forEach(sc => {
            if (sc.day && sc.time && teacherBooked[sc.day] && teacherBooked[sc.day][sc.time]) {
                if (sc.teacherId) teacherBooked[sc.day][sc.time].add(String(sc.teacherId));
                if (sc.classId) classBooked[sc.day][sc.time].add(String(sc.classId));
            }
        });
    }

    const subjectTeacherMap = {};
    subjects.forEach((sub, sIdx) => {
        const matched = teachers.find(t => {
            const subNameStr = String(sub.name || '').toLowerCase();
            if (Array.isArray(t.mapel)) {
                return t.mapel.some(m => String(m).toLowerCase().includes(subNameStr) || subNameStr.includes(String(m).toLowerCase()));
            } else if (typeof t.mapel === 'string') {
                return t.mapel.toLowerCase().includes(subNameStr);
            }
            return false;
        });

        if (matched) {
            subjectTeacherMap[sub.id] = matched.id;
        } else if (teachers.length > 0) {
            subjectTeacherMap[sub.id] = teachers[sIdx % teachers.length].id;
        } else {
            subjectTeacherMap[sub.id] = null;
        }
    });

    const newSchedules = [];
    let conflictsEncountered = 0;

    classes.forEach((cls) => {
        let subIndex = 0;
        dayInputs.forEach((day) => {
            timeSlots.forEach((slot) => {
                if (classBooked[day][slot].has(String(cls.id))) return;

                let attempts = 0;
                let scheduled = false;

                while (attempts < subjects.length && !scheduled) {
                    const sub = subjects[(subIndex + attempts) % subjects.length];
                    const teacherId = subjectTeacherMap[sub.id];

                    const isTeacherBusy = teacherId && teacherBooked[day][slot].has(String(teacherId));

                    if (!isTeacherBusy) {
                        if (teacherId) teacherBooked[day][slot].add(String(teacherId));
                        classBooked[day][slot].add(String(cls.id));

                        newSchedules.push({
                            id: 'SCH_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
                            day: day,
                            classId: cls.id,
                            subjectId: sub.id,
                            time: slot,
                            teacherId: teacherId || ''
                        });

                        scheduled = true;
                        subIndex = (subIndex + attempts + 1) % subjects.length;
                    } else {
                        attempts++;
                    }
                }

                if (!scheduled) {
                    conflictsEncountered++;
                }
            });
        });
    });

    renderAutoSchedulePreviewModal(newSchedules, mode, dayInputs.length, conflictsEncountered);
}

function renderAutoSchedulePreviewModal(generatedList, mode, totalDays, conflicts) {
    const modal = document.getElementById('modal-container');
    if (!modal) return;

    window._tempAutoSchedules = generatedList;
    window._tempAutoScheduleMode = mode;

    const schedulesListHtml = generatedList.map((sc, idx) => {
        const cls = (appState.classes || []).find(c => String(c.id) === String(sc.classId));
        const sub = (appState.subjects || []).find(s => String(s.id) === String(sc.subjectId));
        const tch = (appState.teachers || []).find(t => String(t.id) === String(sc.teacherId));
        return `
            <tr class="hover:bg-slate-50 transition text-xs">
                <td class="p-2.5 border border-slate-200 text-center font-bold text-slate-700">${idx + 1}</td>
                <td class="p-2.5 border border-slate-200 font-bold text-emerald-700">${sc.day}</td>
                <td class="p-2.5 border border-slate-200 font-semibold text-slate-800">${cls ? cls.name : '-'}</td>
                <td class="p-2.5 border border-slate-200 font-semibold text-indigo-700">${sub ? sub.name : '-'}</td>
                <td class="p-2.5 border border-slate-200 font-mono text-slate-600">${sc.time}</td>
                <td class="p-2.5 border border-slate-200 text-slate-700 font-medium">${tch ? tch.name : '-'}</td>
            </tr>
        `;
    }).join('');

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-4xl rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col h-[85vh] overflow-hidden">
                <div class="flex justify-between items-center pb-4 border-b border-slate-150 shrink-0">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <i class="fa-solid fa-circle-check text-sm"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-850 text-base">Hasil Penyusunan Otomatis</h3>
                            <p class="text-[10px] text-slate-400 font-medium">Pratinjau jadwal pelajaran yang berhasil disusun tanpa bentrokan</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="p-1.5 hover:bg-slate-100 rounded-xl transition text-slate-400 hover:text-slate-600 cursor-pointer">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <div class="flex-1 overflow-y-auto py-4 space-y-4">
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                        <div class="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between">
                            <div>
                                <span class="text-[10px] font-bold text-emerald-600 uppercase">Total Terdaftar</span>
                                <h4 class="text-lg font-black text-emerald-800">${generatedList.length} Jadwal</h4>
                            </div>
                            <i class="fa-solid fa-calendar-check text-emerald-500 text-xl"></i>
                        </div>
                        <div class="p-3 bg-indigo-50 border border-indigo-200 rounded-2xl flex items-center justify-between">
                            <div>
                                <span class="text-[10px] font-bold text-indigo-600 uppercase">Status Konflik</span>
                                <h4 class="text-lg font-black text-indigo-800">${conflicts === 0 ? '0 Bentrokan (100% Aman)' : `${conflicts} Terlewati`}</h4>
                            </div>
                            <i class="fa-solid fa-shield-check text-indigo-500 text-xl"></i>
                        </div>
                        <div class="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between">
                            <div>
                                <span class="text-[10px] font-bold text-slate-500 uppercase">Mode Penerapan</span>
                                <h4 class="text-sm font-bold text-slate-800">${mode === 'replace' ? 'Reset & Timpa' : 'Tambahkan'}</h4>
                            </div>
                            <i class="fa-solid fa-sliders text-slate-400 text-xl"></i>
                        </div>
                    </div>

                    <div class="overflow-x-auto border border-slate-200 rounded-2xl bg-white">
                        <table class="w-full text-left border-collapse min-w-[650px]">
                            <thead>
                                <tr class="bg-slate-50 border-b border-slate-200 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    <th class="p-2.5 w-12 text-center">No</th>
                                    <th class="p-2.5">Hari</th>
                                    <th class="p-2.5">Kelas</th>
                                    <th class="p-2.5">Mata Pelajaran</th>
                                    <th class="p-2.5">Waktu</th>
                                    <th class="p-2.5">Guru Pengampu</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-100">
                                ${schedulesListHtml || `<tr><td colspan="6" class="p-6 text-center text-xs text-slate-400">Tidak ada jadwal yang dapat disusun.</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div class="flex justify-between items-center pt-4 border-t border-slate-150 shrink-0">
                    <button type="button" onclick="openAutoScheduleModal()" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition cursor-pointer">
                        <i class="fa-solid fa-arrow-left mr-1"></i> Kembali Opsional
                    </button>
                    <button type="button" onclick="applyAutoScheduleResult()" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-2xl transition shadow-md flex items-center space-x-1.5 cursor-pointer">
                        <i class="fa-solid fa-check text-sm"></i>
                        <span>Terapkan Jadwal Ke Sistem</span>
                    </button>
                </div>
            </div>
        </div>
    `;
}

function applyAutoScheduleResult() {
    const list = window._tempAutoSchedules || [];
    const mode = window._tempAutoScheduleMode || 'replace';

    if (mode === 'replace') {
        appState.schedules = list;
    } else {
        appState.schedules = [...(appState.schedules || []), ...list];
    }

    saveState('schedules');
    showToast('Jadwal pelajaran otomatis berhasil diterapkan ke sistem!', 'success');
    closeModal();
    renderScheduleModule(document.getElementById('view-container'));
}

// Generate Minggu Aktif Module
function openGenerateMingguAktifModal() {
    const modal = document.getElementById('modal-container');
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-5">
                <div class="flex justify-between items-center pb-3 border-b border-slate-100">
                    <div class="flex items-center space-x-2">
                        <div class="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <i class="fa-solid fa-calculator text-xs"></i>
                        </div>
                        <h3 class="font-extrabold text-slate-800 text-sm">Generate Minggu Aktif</h3>
                    </div>
                    <button type="button" onclick="closeModal()" class="text-slate-400 hover:text-slate-600 cursor-pointer"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tahun Ajaran</label>
                        <select id="ma-academic-year" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold">
                            <option value="2026/2027" selected>Tahun Ajaran 2026/2027</option>
                            <option value="2025/2026">Tahun Ajaran 2025/2026</option>
                            <option value="2027/2028">Tahun Ajaran 2027/2028</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Alokasi JP per Minggu (Default)</label>
                        <input type="number" id="ma-jp-per-week" value="4" min="1" max="20" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold">
                    </div>
                    <p class="text-[11px] text-slate-450 leading-relaxed">Sistem akan secara otomatis menyusun draf rincian minggu aktif ganjil dan genap berdasarkan kalender akademik madrasah KBC.</p>
                </div>
                <div class="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                    <button type="button" onclick="closeModal()" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition cursor-pointer">Batal</button>
                    <button type="button" onclick="generateMingguAktifResult()" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition font-semibold shadow cursor-pointer">Generate</button>
                </div>
            </div>
        </div>
    `;
}

function generateMingguAktifResult() {
    const academicYear = document.getElementById('ma-academic-year').value;
    const jpPerWeek = parseInt(document.getElementById('ma-jp-per-week').value) || 4;
    
    // Initialize detailed state
    window.currentMingguAktifData = {
        academicYear: academicYear,
        jpPerWeek: jpPerWeek,
        semesters: {
            ganjil: {
                name: 'Semester Ganjil (Satu)',
                months: [
                    { bulan: 'Juli', totalWeeks: 4, effectiveWeeks: 2, ineffectiveWeeks: 2, keterangan: 'PLS & Libur Awal Tahun' },
                    { bulan: 'Agustus', totalWeeks: 4, effectiveWeeks: 4, ineffectiveWeeks: 0, keterangan: '-' },
                    { bulan: 'September', totalWeeks: 5, effectiveWeeks: 4, ineffectiveWeeks: 1, keterangan: 'Asesmen Tengah Semester' },
                    { bulan: 'Oktober', totalWeeks: 4, effectiveWeeks: 4, ineffectiveWeeks: 0, keterangan: '-' },
                    { bulan: 'November', totalWeeks: 4, effectiveWeeks: 4, ineffectiveWeeks: 0, keterangan: '-' },
                    { bulan: 'Desember', totalWeeks: 5, effectiveWeeks: 1, ineffectiveWeeks: 4, keterangan: 'Asesmen Akhir Sem, Rapor & Libur' }
                ],
                activities: [
                    { kegiatan: 'Masa Pengenalan Lingkungan Sekolah (MPLS)', weeks: 1, keterangan: 'Juli minggu ke-3' },
                    { kegiatan: 'Libur Permulaan Tahun Ajaran', weeks: 1, keterangan: 'Juli minggu ke-1' },
                    { kegiatan: 'Asesmen Tengah Semester Ganjil', weeks: 1, keterangan: 'September minggu ke-4' },
                    { kegiatan: 'Asesmen Akhir Semester Ganjil', weeks: 1, keterangan: 'Desember minggu ke-1' },
                    { kegiatan: 'Class Meeting & Pembagian Rapor', weeks: 1, keterangan: 'Desember minggu ke-2' },
                    { kegiatan: 'Libur Semester Ganjil', weeks: 2, keterangan: 'Desember minggu ke-3 & ke-4' }
                ]
            },
            genap: {
                name: 'Semester Genap (Dua)',
                months: [
                    { bulan: 'Januari', totalWeeks: 4, effectiveWeeks: 3, ineffectiveWeeks: 1, keterangan: 'Libur Akhir Semester Ganjil' },
                    { bulan: 'Februari', totalWeeks: 4, effectiveWeeks: 4, ineffectiveWeeks: 0, keterangan: '-' },
                    { bulan: 'Maret', totalWeeks: 5, effectiveWeeks: 3, ineffectiveWeeks: 2, keterangan: 'Libur Awal Ramadhan & Pondok' },
                    { bulan: 'April', totalWeeks: 4, effectiveWeeks: 2, ineffectiveWeeks: 2, keterangan: 'Libur Idul Fitri' },
                    { bulan: 'Mei', totalWeeks: 4, effectiveWeeks: 4, ineffectiveWeeks: 0, keterangan: '-' },
                    { bulan: 'Juni', totalWeeks: 5, effectiveWeeks: 1, ineffectiveWeeks: 4, keterangan: 'PAT, Rapor & Libur Akhir Tahun' }
                ],
                activities: [
                    { kegiatan: 'Libur Awal Semester Ganjil', weeks: 1, keterangan: 'Januari minggu ke-1' },
                    { kegiatan: 'Libur Awal Ramadhan & Pondok Ramadhan', weeks: 2, keterangan: 'Maret minggu ke-2 & ke-3' },
                    { kegiatan: 'Libur Hari Raya Idul Fitri', weeks: 2, keterangan: 'April minggu ke-2 & ke-3' },
                    { kegiatan: 'Asesmen Akhir Tahun (PAT)', weeks: 1, keterangan: 'Juni minggu ke-1' },
                    { kegiatan: 'Pengolahan Rapor & Class Meeting', weeks: 1, keterangan: 'Juni minggu ke-2' },
                    { kegiatan: 'Libur Akhir Tahun Pelajaran', weeks: 2, keterangan: 'Juni minggu ke-3 & ke-4' }
                ]
            }
        }
    };
    
    renderMingguAktifReport();
}

function updateMonthValue(semester, idx, field, value) {
    const data = window.currentMingguAktifData;
    if (!data) return;
    
    let parsed = parseInt(value);
    if (isNaN(parsed) || parsed < 0) parsed = 0;
    
    data.semesters[semester].months[idx][field] = parsed;
    
    // Auto-calculate remaining if we changed total or effective
    const month = data.semesters[semester].months[idx];
    if (field === 'totalWeeks') {
        month.ineffectiveWeeks = Math.max(0, month.totalWeeks - month.effectiveWeeks);
    } else if (field === 'effectiveWeeks') {
        month.ineffectiveWeeks = Math.max(0, month.totalWeeks - month.effectiveWeeks);
    } else if (field === 'ineffectiveWeeks') {
        month.effectiveWeeks = Math.max(0, month.totalWeeks - month.ineffectiveWeeks);
    }
    
    // Update inputs directly in DOM to avoid focus loss
    const row = document.getElementById(`ma-row-${semester}-${idx}`);
    if (row) {
        const inpTotal = row.querySelector('.ma-input-total');
        const inpEff = row.querySelector('.ma-input-eff');
        const inpInEff = row.querySelector('.ma-input-ineff');
        if (inpTotal) inpTotal.value = month.totalWeeks;
        if (inpEff) inpEff.value = month.effectiveWeeks;
        if (inpInEff) inpInEff.value = month.ineffectiveWeeks;
    }
    
    recalculateMingguAktif();
}

function updateActivityValue(semester, idx, field, value) {
    const data = window.currentMingguAktifData;
    if (!data) return;
    
    if (field === 'weeks') {
        let parsed = parseInt(value);
        if (isNaN(parsed) || parsed < 0) parsed = 0;
        data.semesters[semester].activities[idx][field] = parsed;
    } else {
        data.semesters[semester].activities[idx][field] = value;
    }
    
    recalculateMingguAktif();
}

function updateJpPerWeek(value) {
    const data = window.currentMingguAktifData;
    if (!data) return;
    
    let parsed = parseInt(value);
    if (isNaN(parsed) || parsed < 1) parsed = 4;
    data.jpPerWeek = parsed;
    
    recalculateMingguAktif();
}

function recalculateMingguAktif() {
    const data = window.currentMingguAktifData;
    if (!data) return;
    
    let grandTotalEff = 0;
    
    ['ganjil', 'genap'].forEach(semester => {
        let sumTotal = 0;
        let sumEff = 0;
        let sumInEff = 0;
        let sumActivities = 0;
        
        data.semesters[semester].months.forEach(m => {
            sumTotal += m.totalWeeks;
            sumEff += m.effectiveWeeks;
            sumInEff += m.ineffectiveWeeks;
        });
        
        data.semesters[semester].activities.forEach(act => {
            sumActivities += act.weeks;
        });
        
        grandTotalEff += sumEff;
        
        // Update Sum elements in DOM
        const elTotal = document.getElementById(`ma-sum-${semester}-total`);
        const elEff = document.getElementById(`ma-sum-${semester}-eff`);
        const elInEff = document.getElementById(`ma-sum-${semester}-ineff`);
        const elAct = document.getElementById(`ma-sum-${semester}-act`);
        
        if (elTotal) elTotal.innerText = sumTotal;
        if (elEff) elEff.innerText = sumEff;
        if (elInEff) elInEff.innerText = sumInEff;
        if (elAct) elAct.innerText = sumActivities;
    });
    
    // Update summary text
    const jpPerWeek = data.jpPerWeek;
    const totalJp = grandTotalEff * jpPerWeek;
    
    const elSummary = document.getElementById('ma-summary-narrative');
    if (elSummary) {
        elSummary.innerHTML = `
            <div class="space-y-1">
                <p class="text-xs sm:text-sm font-bold text-slate-800">Uraian Perhitungan Jam Pelajaran (JP) Efektif:</p>
                <ul class="list-disc pl-5 text-[11px] sm:text-xs text-slate-600 space-y-1 leading-relaxed">
                    <li>Total Minggu Efektif Semester Ganjil & Genap = <span class="font-extrabold text-emerald-600 font-mono">${grandTotalEff} Minggu</span></li>
                    <li>Alokasi Waktu Pembelajaran per Minggu = <span class="font-bold text-slate-700 font-mono">${jpPerWeek} JP</span> / Minggu</li>
                    <li>Perhitungan Total JP Efektif = <span class="font-bold text-slate-700 font-mono">${grandTotalEff} Minggu &times; ${jpPerWeek} JP</span> = <span class="px-2 py-0.5 bg-emerald-50 text-emerald-700 font-extrabold rounded border border-emerald-100 font-mono text-sm">${totalJp} JP Efektif</span></li>
                </ul>
            </div>
        `;
    }
}

function renderMingguAktifReport() {
    const data = window.currentMingguAktifData;
    if (!data) return;
    
    const modal = document.getElementById('modal-container');
    
    const buildTablesHtml = (semester) => {
        const sem = data.semesters[semester];
        let monthsRows = '';
        let actRows = '';
        
        let sumTotal = 0;
        let sumEff = 0;
        let sumInEff = 0;
        sem.months.forEach((m, idx) => {
            sumTotal += m.totalWeeks;
            sumEff += m.effectiveWeeks;
            sumInEff += m.ineffectiveWeeks;
            
            monthsRows += `
                <tr id="ma-row-${semester}-${idx}" class="hover:bg-slate-50 transition text-slate-700">
                    <td class="border border-slate-200 p-2 text-center font-bold text-slate-800">${idx+1}</td>
                    <td class="border border-slate-200 p-2 font-semibold text-slate-800">${m.bulan}</td>
                    <td class="border border-slate-200 p-1">
                        <input type="number" value="${m.totalWeeks}" oninput="updateMonthValue('${semester}', ${idx}, 'totalWeeks', this.value)" class="ma-input-total w-full bg-slate-50 border border-slate-200 rounded-lg p-1 text-center font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                    </td>
                    <td class="border border-slate-200 p-1">
                        <input type="number" value="${m.effectiveWeeks}" oninput="updateMonthValue('${semester}', ${idx}, 'effectiveWeeks', this.value)" class="ma-input-eff w-full bg-emerald-50/50 border border-emerald-100 rounded-lg p-1 text-center font-extrabold text-emerald-700 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                    </td>
                    <td class="border border-slate-200 p-1">
                        <input type="number" value="${m.ineffectiveWeeks}" oninput="updateMonthValue('${semester}', ${idx}, 'ineffectiveWeeks', this.value)" class="ma-input-ineff w-full bg-amber-50/50 border border-amber-100 rounded-lg p-1 text-center font-bold text-amber-700 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                    </td>
                    <td class="border border-slate-200 p-1">
                        <input type="text" value="${escapeHtml(m.keterangan)}" oninput="window.currentMingguAktifData.semesters['${semester}'].months[${idx}].keterangan = this.value" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 text-slate-600 font-medium text-xs">
                    </td>
                </tr>
            `;
        });
        
        let sumActivities = 0;
        sem.activities.forEach((act, idx) => {
            sumActivities += act.weeks;
            actRows += `
                <tr class="hover:bg-slate-50 transition text-slate-700">
                    <td class="border border-slate-200 p-1">
                        <input type="text" value="${escapeHtml(act.kegiatan)}" oninput="updateActivityValue('${semester}', ${idx}, 'kegiatan', this.value)" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 text-slate-800 font-bold text-xs">
                    </td>
                    <td class="border border-slate-200 p-1">
                        <input type="number" value="${act.weeks}" oninput="updateActivityValue('${semester}', ${idx}, 'weeks', this.value)" class="w-full bg-amber-50/50 border border-amber-100 rounded-lg p-1 text-center font-extrabold text-amber-700 focus:outline-none focus:ring-1 focus:ring-emerald-500">
                    </td>
                    <td class="border border-slate-200 p-1">
                        <input type="text" value="${escapeHtml(act.keterangan)}" oninput="updateActivityValue('${semester}', ${idx}, 'keterangan', this.value)" class="w-full bg-slate-50 border border-slate-200 rounded-lg p-1 text-slate-600 font-medium text-xs">
                    </td>
                </tr>
            `;
        });
        
        return `
            <div class="space-y-4 bg-slate-50/40 p-4 sm:p-5 rounded-3xl border border-slate-150">
                <div class="flex justify-between items-center pb-2 border-b border-slate-200/60">
                    <h4 class="text-xs sm:text-sm font-extrabold text-slate-800 uppercase tracking-wide flex items-center space-x-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <span>${sem.name}</span>
                    </h4>
                    <span class="text-[10px] bg-slate-100 text-slate-500 font-bold px-2.5 py-1 rounded-full uppercase border">KBC - Minggu Efektif</span>
                </div>
                
                <div class="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    <!-- Column 1: Months / Weeks Rincian -->
                    <div class="space-y-2">
                        <span class="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Kolom 1: Rincian Distribusi Minggu</span>
                        <div class="overflow-x-auto border border-slate-150 rounded-2xl bg-white shadow-xs">
                            <table class="w-full text-left border-collapse text-[11px] min-w-[500px]">
                                <thead>
                                    <tr class="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b">
                                        <th class="border p-2 text-center w-10">No</th>
                                        <th class="border p-2">Bulan</th>
                                        <th class="border p-2 text-center w-20">Jml Minggu</th>
                                        <th class="border p-2 text-center w-24">Minggu Efektif</th>
                                        <th class="border p-2 text-center w-28">Minggu Tdk Efektif</th>
                                        <th class="border p-2">Keterangan</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${monthsRows}
                                    <tr class="bg-slate-50 text-slate-800 font-bold uppercase text-[10px] tracking-wider">
                                        <td colspan="2" class="border p-2.5 text-right uppercase font-extrabold text-slate-600">Total Jumlah:</td>
                                        <td id="ma-sum-${semester}-total" class="border p-2.5 text-center font-extrabold text-slate-800 font-mono text-xs">${sumTotal}</td>
                                        <td id="ma-sum-${semester}-eff" class="border p-2.5 text-center font-extrabold text-emerald-700 bg-emerald-50 font-mono text-xs">${sumEff}</td>
                                        <td id="ma-sum-${semester}-ineff" class="border p-2.5 text-center font-extrabold text-amber-700 bg-amber-50 font-mono text-xs">${sumInEff}</td>
                                        <td class="border p-2.5 text-slate-400 italic">Terhitung otomatis</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    
                    <!-- Column 2: Ineffective Activities Rincian -->
                    <div class="space-y-2">
                        <span class="text-[10px] uppercase font-bold tracking-wider text-slate-400 block">Kolom 2: Uraian Kegiatan Minggu Tidak Efektif</span>
                        <div class="overflow-x-auto border border-slate-150 rounded-2xl bg-white shadow-xs">
                            <table class="w-full text-left border-collapse text-[11px] min-w-[450px]">
                                <thead>
                                    <tr class="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider text-[10px] border-b">
                                        <th class="border p-2">Uraian Kegiatan Minggu Tidak Efektif</th>
                                        <th class="border p-2 text-center w-20">Jml Minggu</th>
                                        <th class="border p-2">Keterangan Waktu</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${actRows}
                                    <tr class="bg-slate-50 text-slate-800 font-bold uppercase text-[10px] tracking-wider">
                                        <td class="border p-2.5 text-right uppercase font-extrabold text-slate-600">Total Minggu Tidak Efektif:</td>
                                        <td id="ma-sum-${semester}-act" class="border p-2.5 text-center font-extrabold text-amber-700 bg-amber-50 font-mono text-xs">${sumActivities}</td>
                                        <td class="border p-2.5 text-slate-400 italic">Sesuai Rincian</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        `;
    };

    const ganjilHtml = buildTablesHtml('ganjil');
    const genapHtml = buildTablesHtml('genap');
    
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-7xl rounded-3xl shadow-2xl p-6 sm:p-8 flex flex-col h-[92vh] overflow-hidden">
                <div class="flex justify-between items-center pb-4 border-b border-slate-150 shrink-0">
                    <div class="flex items-center space-x-2.5">
                        <div class="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                            <i class="fa-solid fa-calculator text-sm"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-850 text-base">Hasil Rincian Analisis Minggu Aktif KBC</h3>
                            <p class="text-[10px] text-slate-400 font-medium">Tahun Ajaran Pelajaran: <span class="text-emerald-600 font-bold">${data.academicYear}</span> &middot; Kurikulum Berbasis Cinta (KBC)</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeModal()" class="p-1.5 hover:bg-slate-100 rounded-xl transition text-slate-400 hover:text-slate-600 cursor-pointer">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <!-- Scrollable Content -->
                <div class="flex-1 overflow-y-auto py-5 space-y-6 pr-1">
                    <!-- Alokasi JP Configurator Block -->
                    <div class="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shrink-0">
                        <div>
                            <h4 class="text-xs font-bold text-slate-800">Konfigurator Jam Pelajaran (JP)</h4>
                            <p class="text-[10px] text-slate-400 mt-0.5">Ubah alokasi JP per minggu untuk melakukan penyesuaian dinamis</p>
                        </div>
                        <div class="flex items-center space-x-2">
                            <label class="text-xs font-semibold text-slate-600">Alokasi JP per Minggu:</label>
                            <input type="number" value="${data.jpPerWeek}" oninput="updateJpPerWeek(this.value)" class="w-16 px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-center text-xs font-bold font-mono focus:ring-indigo-500">
                        </div>
                    </div>

                    <!-- Semester 1 (Ganjil) Tables -->
                    ${ganjilHtml}

                    <!-- Semester 2 (Genap) Tables -->
                    ${genapHtml}

                    <!-- Bottom Summary Box -->
                    <div id="ma-summary-narrative" class="bg-emerald-50/40 p-5 rounded-3xl border border-emerald-100/80 space-y-2">
                        <!-- Calculated dynamically via recalculateMingguAktif -->
                    </div>
                </div>

                <!-- Footer Actions -->
                <div class="flex justify-between items-center pt-4 border-t border-slate-150 shrink-0 gap-2">
                    <button type="button" onclick="printMingguAktifReport()" class="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-2xl transition shadow-md cursor-pointer flex items-center space-x-1.5">
                        <i class="fa-solid fa-print"></i>
                        <span>Cetak Laporan</span>
                    </button>
                    <button type="button" onclick="closeModal()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-2xl transition shadow-sm cursor-pointer">
                        Selesai & Tutup
                    </button>
                </div>
            </div>
        </div>
    `;
    
    // Trigger initial calculation
    recalculateMingguAktif();
}

function printMingguAktifReport() {
    const data = window.currentMingguAktifData;
    if (!data) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('Gagal membuka jendela cetak. Pastikan pop-up blocker dinonaktifkan.');
        return;
    }
    
    const buildPrintTableHtml = (semester) => {
        const sem = data.semesters[semester];
        let monthsRows = '';
        let actRows = '';
        
        let sumTotal = 0;
        let sumEff = 0;
        let sumInEff = 0;
        sem.months.forEach((m, idx) => {
            sumTotal += m.totalWeeks;
            sumEff += m.effectiveWeeks;
            sumInEff += m.ineffectiveWeeks;
            monthsRows += `
                <tr>
                    <td style="text-align: center;">${idx+1}</td>
                    <td><b>${m.bulan}</b></td>
                    <td style="text-align: center;">${m.totalWeeks}</td>
                    <td style="text-align: center; font-weight: bold; color: #047857;">${m.effectiveWeeks}</td>
                    <td style="text-align: center; font-weight: bold; color: #b45309;">${m.ineffectiveWeeks}</td>
                    <td>${m.keterangan}</td>
                </tr>
            `;
        });
        
        let sumActivities = 0;
        sem.activities.forEach(act => {
            sumActivities += act.weeks;
            actRows += `
                <tr>
                    <td><b>${act.kegiatan}</b></td>
                    <td style="text-align: center; font-weight: bold; color: #b45309;">${act.weeks}</td>
                    <td>${act.keterangan}</td>
                </tr>
            `;
        });
        
        return `
            <div class="sem-block">
                <h3>${sem.name.toUpperCase()}</h3>
                <div class="tables-grid">
                    <div class="col">
                        <h4>Rincian Distribusi Minggu</h4>
                        <table>
                            <thead>
                                <tr>
                                    <th style="width: 30px;">No</th>
                                    <th>Bulan</th>
                                    <th style="width: 50px;">Jml</th>
                                    <th style="width: 50px;">Efektif</th>
                                    <th style="width: 50px;">Tdk Ef</th>
                                    <th>Keterangan</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${monthsRows}
                                <tr class="total-row">
                                    <td colspan="2" style="text-align: right;">Total:</td>
                                    <td style="text-align: center;">${sumTotal}</td>
                                    <td style="text-align: center;">${sumEff}</td>
                                    <td style="text-align: center;">${sumInEff}</td>
                                    <td style="color: #64748b; font-style: italic;">Terhitung otomatis</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="col">
                        <h4>Rincian Minggu Tidak Efektif</h4>
                        <table>
                            <thead>
                                <tr>
                                    <th>Uraian Kegiatan</th>
                                    <th style="width: 50px;">Minggu</th>
                                    <th>Keterangan</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${actRows}
                                <tr class="total-row">
                                    <td style="text-align: right;">Total:</td>
                                    <td style="text-align: center;">${sumActivities}</td>
                                    <td style="color: #64748b; font-style: italic;">Sesuai Rincian</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
    };
    
    let totalEffGanjil = 0;
    data.semesters.ganjil.months.forEach(m => totalEffGanjil += m.effectiveWeeks);
    let totalEffGenap = 0;
    data.semesters.genap.months.forEach(m => totalEffGenap += m.effectiveWeeks);
    const grandTotalEff = totalEffGanjil + totalEffGenap;
    const totalJp = grandTotalEff * data.jpPerWeek;

    printWindow.document.write(`
        <html>
        <head>
            <title>Laporan Rincian Minggu Efektif - TA ${data.academicYear}</title>
            <style>
                @page {
                    size: landscape;
                    margin: 1.5cm;
                }
                body {
                    font-family: Arial, sans-serif;
                    color: #333;
                    margin: 0;
                    padding: 0;
                }
                .header {
                    text-align: center;
                    margin-bottom: 25px;
                    border-bottom: 3px double #334155;
                    padding-bottom: 15px;
                }
                .header h1 {
                    margin: 0;
                    font-size: 18px;
                    text-transform: uppercase;
                    color: #1e293b;
                }
                .header p {
                    margin: 5px 0 0 0;
                    font-size: 11px;
                    font-weight: bold;
                    color: #64748b;
                }
                .sem-block {
                    margin-bottom: 30px;
                    page-break-inside: avoid;
                }
                .sem-block h3 {
                    margin: 0 0 10px 0;
                    font-size: 13px;
                    color: #0f172a;
                    border-left: 4px solid #059669;
                    padding-left: 8px;
                }
                .tables-grid {
                    display: flex;
                    gap: 15px;
                }
                .col {
                    flex: 1;
                }
                .col h4 {
                    margin: 0 0 5px 0;
                    font-size: 10px;
                    text-transform: uppercase;
                    color: #64748b;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 10px;
                    background-color: #fff;
                }
                th, td {
                    border: 1px solid #cbd5e1;
                    padding: 6px;
                    text-align: left;
                }
                th {
                    background-color: #f8fafc;
                    font-weight: bold;
                    text-transform: uppercase;
                    font-size: 9px;
                }
                .total-row {
                    background-color: #f1f5f9;
                    font-weight: bold;
                }
                .summary-card {
                    margin-top: 25px;
                    padding: 15px;
                    background-color: #f0fdf4;
                    border: 1px solid #bbf7d0;
                    border-radius: 8px;
                    font-size: 11px;
                }
                .summary-card h4 {
                    margin: 0 0 8px 0;
                    font-size: 12px;
                    color: #166534;
                }
                .summary-card ul {
                    margin: 0;
                    padding-left: 20px;
                }
                .summary-card li {
                    margin-bottom: 4px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <h1>RINCIAN ANALISIS ALOKASI WAKTU MINGGU EFEKTIF & TIDAK EFEKTIF</h1>
                <p>TAHUN AJARAN PELAJARAN: ${data.academicYear} | KURIKULUM BERBASIS CINTA (KBC) </p>
            </div>
            
            ${buildPrintTableHtml('ganjil')}
            ${buildPrintTableHtml('genap')}
            
            <div class="summary-card">
                <h4>Uraian Perhitungan Jam Pelajaran (JP) Efektif Total:</h4>
                <ul>
                    <li>Total Minggu Efektif Semester Ganjil & Genap = <b>${grandTotalEff} Minggu</b></li>
                    <li>Alokasi Pembelajaran per Minggu = <b>${data.jpPerWeek} JP</b></li>
                    <li>Perhitungan Jam Pelajaran Efektif = <b>${grandTotalEff} Minggu &times; ${data.jpPerWeek} JP = ${totalJp} JP Efektif</b></li>
                </ul>
            </div>
            
            <div style="margin-top: 50px; display: flex; justify-content: space-between; font-size: 11px; page-break-inside: avoid;">
                <div>
                    <p>Mengetahui,</p>
                    <p style="margin-top: 60px;"><b>Kepala Madrasah</b></p>
                </div>
                <div>
                    <p>Jakarta, ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    <p style="margin-top: 60px;"><b>Guru Pengampu</b></p>
                </div>
            </div>
            
            <script>
                window.onload = function() {
                    window.print();
                    window.onafterprint = function() {
                        window.close();
                    }
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Window globals
window.renderClassModule = renderClassModule;
window.openKelolaKelasModal = openKelolaKelasModal;
window.openClassModal = openClassModal;
window.saveClass = saveClass;
window.deleteClass = deleteClass;
window.filterHomeroomTeachers = filterHomeroomTeachers;
window.renderTeacherModule = renderTeacherModule;
window.openTeacherModal = openTeacherModal;
window.saveTeacher = saveTeacher;
window.deleteTeacher = deleteTeacher;
window.loadTeachersFromServer = loadTeachersFromServer;
window.renderStudentModule = renderStudentModule;
window.showStudentProfileModal = showStudentProfileModal;
window.openStudentModal = openStudentModal;
window.saveStudent = saveStudent;
window.deleteStudent = deleteStudent;
window.loadStudentsFromServer = loadStudentsFromServer;
window.toggleSelectAllStudentsPage = toggleSelectAllStudentsPage;
window.deleteSelectedStudentsPage = deleteSelectedStudentsPage;
window.downloadStudentTemplate = downloadStudentTemplate;
window.importStudentsExcel = importStudentsExcel;
window.renderScheduleModule = renderScheduleModule;
window.openSubjectModal = openSubjectModal;
window.saveSubject = saveSubject;
window.deleteSubject = deleteSubject;
window.loadSubjectsFromServer = loadSubjectsFromServer;

// Exposed Scheduling and Minggu Aktif globals
window.downloadRosterExcel = downloadRosterExcel;
window.addTimeSlotRow = addTimeSlotRow;
window.deleteTimeSlotRow = deleteTimeSlotRow;
window.recalculateTimeSlots = recalculateTimeSlots;
window.handleSlotTimeChange = handleSlotTimeChange;
window.handleSlotTypeChange = handleSlotTypeChange;
window.printRosterJadwal = printRosterJadwal;
window.updateRosterMatrixSubject = updateRosterMatrixSubject;
window.updateRosterMatrixTeacher = updateRosterMatrixTeacher;
window.openEditTimeSlotsModal = openEditTimeSlotsModal;
window.saveTimeSlots = saveTimeSlots;
window.triggerFramePrint = triggerFramePrint;
window.openSusunJadwalModal = openSusunJadwalModal;
window.saveSchedule = saveSchedule;
window.deleteSchedule = deleteSchedule;
window.openAutoScheduleModal = openAutoScheduleModal;
window.processAutoSchedule = processAutoSchedule;
window.renderAutoSchedulePreviewModal = renderAutoSchedulePreviewModal;
window.applyAutoScheduleResult = applyAutoScheduleResult;
window.openGenerateMingguAktifModal = openGenerateMingguAktifModal;
window.generateMingguAktifResult = generateMingguAktifResult;
window.updateMonthValue = updateMonthValue;
window.updateActivityValue = updateActivityValue;
window.updateJpPerWeek = updateJpPerWeek;
window.recalculateMingguAktif = recalculateMingguAktif;
window.renderMingguAktifReport = renderMingguAktifReport;
window.printMingguAktifReport = printMingguAktifReport;


window.renderSavedRosterCardsHTML = renderSavedRosterCardsHTML;
window.openSaveRosterModal = openSaveRosterModal;
window.confirmSaveRoster = confirmSaveRoster;
window.loadSavedRoster = loadSavedRoster;
window.openEditSavedRosterModal = openEditSavedRosterModal;
window.confirmEditSavedRoster = confirmEditSavedRoster;
window.openDeleteSavedRosterModal = openDeleteSavedRosterModal;
window.confirmDeleteSavedRoster = confirmDeleteSavedRoster;
window.deleteSavedRoster = deleteSavedRoster;

// Automatically expose functions and state to window for global inline handlers
Object.assign(window, {
  renderSavedRosterCardsHTML,
  openSaveRosterModal,
  confirmSaveRoster,
  loadSavedRoster,
  openEditSavedRosterModal,
  confirmEditSavedRoster,
  openDeleteSavedRosterModal,
  confirmDeleteSavedRoster,
  deleteSavedRoster,
  downloadRosterExcel,
  addTimeSlotRow,
  deleteTimeSlotRow,
  recalculateTimeSlots,
  handleSlotTimeChange,
  handleSlotTypeChange,
  printRosterJadwal,
  updateRosterMatrixSubject,
  updateRosterMatrixTeacher,
  openEditTimeSlotsModal,
  saveTimeSlots,
  triggerFramePrint,
  openKelolaKelasModal,
  renderClassModule,
  filterHomeroomTeachers,
  openClassModal,
  saveClass,
  deleteClass,
  renderTeacherModule,
  openTeacherModal,
  saveTeacher,
  loadTeachersFromServer,
  deleteTeacher,
  renderStudentModule,
  showStudentProfileModal,
  openStudentModal,
  saveStudent,
  loadStudentsFromServer,
  deleteStudent,
  toggleSelectAllStudentsPage,
  deleteSelectedStudentsPage,
  downloadStudentTemplate,
  importStudentsExcel,
  openExportStudentModal,
  exportStudentsToExcel,
  exportStudentsToWord,
  renderScheduleModule,
  openSubjectModal,
  saveSubject,
  loadSubjectsFromServer,
  deleteSubject,
  openSusunJadwalModal,
  saveSchedule,
  deleteSchedule,
  openAutoScheduleModal,
  processAutoSchedule,
  renderAutoSchedulePreviewModal,
  applyAutoScheduleResult,
  openGenerateMingguAktifModal,
  generateMingguAktifResult,
  updateMonthValue,
  updateActivityValue,
  updateJpPerWeek,
  recalculateMingguAktif,
  renderMingguAktifReport,
  printMingguAktifReport
});

