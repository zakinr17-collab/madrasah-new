/*
 * Credential view/reset/export patch for student and teacher admin pages.
 * Does not reveal hashed passwords; only shows cached temporary passwords or newly reset passwords.
 */
(function () {
    'use strict';

    const STUDENT_KEY = 'cbt_print_credentials';
    const TEACHER_KEY = 'teacher_temporary_credentials';

    function state() { return window.appState || {}; }
    function isPrivileged() {
        const role = String(state().role || '').toLowerCase();
        return ['admin', 'bos', 'boss', 'superadmin'].includes(role);
    }
    function esc(value) {
        const raw = String(value ?? '');
        if (typeof window.escapeHtml === 'function') return window.escapeHtml(raw);
        return raw.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
    }
    function readList(key) {
        try {
            const parsed = JSON.parse(sessionStorage.getItem(key) || '[]');
            return Array.isArray(parsed) ? parsed : [];
        } catch (_) {
            return [];
        }
    }
    function writeCredential(type, credential) {
        const key = type === 'teacher' ? TEACHER_KEY : STUDENT_KEY;
        const idKey = type === 'teacher' ? 'teacherId' : 'studentId';
        const list = readList(key).filter(item => String(item && item[idKey] || '') !== String(credential[idKey] || ''));
        list.push(credential);
        try { sessionStorage.setItem(key, JSON.stringify(list)); } catch (_) {}
    }
    function findCredential(type, person) {
        const key = type === 'teacher' ? TEACHER_KEY : STUDENT_KEY;
        const idKey = type === 'teacher' ? 'teacherId' : 'studentId';
        const list = readList(key);
        const byId = list.find(c => String(c && c[idKey] || '') === String(person && person.id || ''));
        const byUsername = list.find(c => c && c.username && String(c.username).toLowerCase() === String(person && person.username || '').toLowerCase());
        return byId || byUsername || null;
    }
    function visiblePassword(type, person) {
        const role = String(state().role || state().currentUser?.role || '').toLowerCase();
        if (type === 'student' && role === 'admin' && person?.passwordDisplay) {
            return String(person.passwordDisplay);
        }
        const c = findCredential(type, person);
        if (c && c.temporaryPassword) return String(c.temporaryPassword);
        return '';
    }
    function generatePassword(person) {
        const seed = String((person && (person.nis || person.nip || person.username || person.id)) || Date.now()).replace(/[^a-zA-Z0-9]/g, '').slice(-5) || '2026';
        const random = Math.random().toString(36).slice(2, 6).toUpperCase();
        return 'Mb#' + seed + random;
    }
    function studentById(id) {
        return (state().students || []).find(s => String(s.id) === String(id));
    }
    function teacherById(id) {
        return (state().teachers || []).find(t => String(t.id) === String(id));
    }
    function payloadForStudent(student, password) {
        return {
            nis: student.nis || '',
            name: student.name || '',
            classId: student.classId || student.class_id || '',
            username: student.username || '',
            password,
            role: student.role || 'student'
        };
    }
    function payloadForTeacher(teacher, password) {
        const phone = teacher.phone || teacher.no_hp || '';
        const gender = teacher.gender || teacher.jenis_kelamin || 'L';
        const address = teacher.address || teacher.alamat || '';
        return {
            nip: teacher.nip || '',
            nuptk: teacher.nuptk || '',
            name: teacher.name || '',
            phone,
            no_hp: phone,
            email: teacher.email || '',
            gender,
            jenis_kelamin: gender,
            address,
            alamat: address,
            bio: teacher.bio || '',
            username: teacher.username || '',
            password,
            photo: teacher.photo || '',
            photoHistory: teacher.photoHistory || [],
            mapel: teacher.mapel || []
        };
    }
    function showToast(message, type) {
        if (typeof window.showToast === 'function') window.showToast(message, type || 'info');
    }
    async function copyText(value) {
        try {
            await navigator.clipboard.writeText(value);
            showToast('Password berhasil disalin.', 'success');
        } catch (_) {
            showToast('Salin manual password yang tampil.', 'info');
        }
    }
    function renderPasswordBox(type, person, password) {
        const label = type === 'teacher' ? 'guru' : 'siswa';
        const known = Boolean(password);
        return `
            <div class="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
                <div class="flex justify-between gap-3 text-xs"><span class="text-slate-500">Nama</span><strong class="text-right text-slate-800">${esc(person.name || '-')}</strong></div>
                <div class="flex justify-between gap-3 text-xs"><span class="text-slate-500">Username</span><strong class="font-mono text-right text-slate-800">${esc(person.username || '-')}</strong></div>
                <div class="pt-2 border-t border-slate-200">
                    <p class="text-[10px] uppercase font-bold text-slate-500 mb-1">Password yang bisa ditampilkan</p>
                    ${known ? `<div class="flex items-center justify-between gap-2 bg-white border border-emerald-200 rounded-xl px-3 py-2"><strong id="credential-visible-password" class="font-mono text-emerald-700 text-sm">${esc(password)}</strong><button type="button" id="credential-copy-current" class="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-bold">Salin</button></div>` : `<div class="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-800">Password lama akun ${label} tersimpan aman sebagai hash, jadi tidak bisa dibaca kembali. Gunakan tombol reset untuk membuat password baru yang langsung tampil.</div>`}
                </div>
            </div>
        `;
    }
    window.openResetPasswordModal = function (id, type = 'student') {
        if (!isPrivileged()) {
            showToast('Hanya admin yang dapat melihat atau reset password.', 'error');
            return;
        }
        const kind = type === 'teacher' ? 'teacher' : 'student';
        const person = kind === 'teacher' ? teacherById(id) : studentById(id);
        if (!person) {
            showToast(kind === 'teacher' ? 'Data guru tidak ditemukan.' : 'Data siswa tidak ditemukan.', 'error');
            return;
        }
        const password = visiblePassword(kind, person);
        const modal = document.getElementById('modal-container');
        if (!modal) return;
        const title = kind === 'teacher' ? 'Password Guru' : 'Password Siswa';
        modal.innerHTML = `
            <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
                <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 space-y-4">
                    <div class="flex items-start justify-between gap-3 border-b border-slate-100 pb-3">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center"><i class="fa-solid fa-key"></i></div>
                            <div><h3 class="font-black text-slate-900 text-base">${title}</h3><p class="text-xs text-slate-500">Lihat password yang tersedia atau buat password baru.</p></div>
                        </div>
                        <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    ${renderPasswordBox(kind, person, password)}
                    <div class="bg-rose-50 border border-rose-100 rounded-2xl p-3 text-[11px] text-rose-700">Reset akan mengganti password login akun ini. Setelah reset, password baru akan tampil dan ikut dipakai untuk export selama sesi admin ini.</div>
                    <div id="credential-reset-result" class="hidden bg-emerald-50 border border-emerald-200 rounded-2xl p-3 text-xs"></div>
                    <div class="flex justify-end gap-2 pt-1">
                        <button type="button" onclick="closeModal()" class="px-4 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold">Tutup</button>
                        <button type="button" id="credential-reset-btn" class="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold">Reset & Tampilkan Password Baru</button>
                    </div>
                </div>
            </div>
        `;
        const copyBtn = document.getElementById('credential-copy-current');
        if (copyBtn && password) copyBtn.addEventListener('click', () => copyText(password));
        const resetBtn = document.getElementById('credential-reset-btn');
        if (resetBtn) resetBtn.addEventListener('click', () => resetPassword(kind, person));
    };
    async function resetPassword(type, person) {
        const resetBtn = document.getElementById('credential-reset-btn');
        const result = document.getElementById('credential-reset-result');
        const password = generatePassword(person);
        if (resetBtn) {
            resetBtn.disabled = true;
            resetBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin mr-1"></i>Menyimpan...';
        }
        try {
            const url = type === 'teacher' ? `/api/teachers/${encodeURIComponent(person.id)}` : `/api/students/${encodeURIComponent(person.id)}`;
            const body = type === 'teacher' ? payloadForTeacher(person, password) : payloadForStudent(person, password);
            const response = await fetch(url, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });
            const data = await response.json();
            if (!response.ok || !data.success) throw new Error(data.message || 'Gagal reset password.');
            const credential = type === 'teacher'
                ? { teacherId: String(person.id), username: body.username, temporaryPassword: password }
                : { studentId: String(person.id), username: body.username, temporaryPassword: password };
            writeCredential(type, credential);
            if (result) {
                result.classList.remove('hidden');
                result.innerHTML = `<div class="font-bold text-emerald-800 mb-1">Password baru berhasil dibuat</div><div class="flex items-center justify-between gap-2 bg-white border border-emerald-200 rounded-xl px-3 py-2"><strong class="font-mono text-emerald-700">${esc(password)}</strong><button type="button" id="credential-copy-new" class="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-[11px] font-bold">Salin</button></div>`;
                document.getElementById('credential-copy-new')?.addEventListener('click', () => copyText(`Username: ${body.username}\nPassword: ${password}`));
            }
            showToast('Password baru berhasil disimpan.', 'success');
            if (type === 'teacher' && typeof window.loadTeachersFromServer === 'function') await window.loadTeachersFromServer();
            if (type === 'student' && typeof window.loadStudentsFromServer === 'function') await window.loadStudentsFromServer();
            if (state().currentRoute === 'guru' && typeof window.renderTeacherModule === 'function') window.renderTeacherModule(document.getElementById('view-container'));
            if (state().currentRoute === 'siswa' && typeof window.renderStudentModule === 'function') window.renderStudentModule(document.getElementById('view-container'));
        } catch (err) {
            showToast(err.message || 'Gagal reset password.', 'error');
        } finally {
            if (resetBtn) {
                resetBtn.disabled = false;
                resetBtn.innerHTML = 'Reset & Tampilkan Password Baru';
            }
        }
    }
    function patchTeacherTable() {
        if (!isPrivileged()) return;
        const container = document.getElementById('view-container');
        if (!container || state().currentRoute !== 'guru') return;
        const rows = Array.from(container.querySelectorAll('tbody tr'));
        rows.forEach((row, idx) => {
            if (row.__credentialPatched) return;
            const teacher = (state().teachers || [])[idx];
            if (!teacher || !teacher.id) return;
            const actionCell = row.querySelector('td:last-child');
            if (!actionCell) return;
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'p-2 bg-amber-50 text-amber-700 rounded-xl hover:bg-amber-100 transition cursor-pointer';
            button.title = 'Lihat/reset password guru';
            button.innerHTML = '<i class="fa-solid fa-key text-xs"></i>';
            button.addEventListener('click', () => window.openResetPasswordModal(teacher.id, 'teacher'));
            actionCell.insertBefore(button, actionCell.firstChild);
            row.__credentialPatched = true;
        });
    }
    const originalRenderTeacher = window.renderTeacherModule;
    if (typeof originalRenderTeacher === 'function' && !originalRenderTeacher.__credentialWrapped) {
        window.renderTeacherModule = async function (container) {
            const result = await originalRenderTeacher.apply(this, arguments);
            setTimeout(patchTeacherTable, 0);
            return result;
        };
        window.renderTeacherModule.__credentialWrapped = true;
    }
    function classNameFor(student) {
        const cls = (state().classes || []).find(c => String(c.id) === String(student.classId || student.class_id));
        return cls ? cls.name : '-';
    }
    function exportPassword(student) {
        return visiblePassword('student', student) || '';
    }
    window.exportStudentsToExcel = function () {
        if (!window.XLSX) {
            showToast('Library Excel belum siap.', 'error');
            return;
        }
        const classFilter = window.studentClassFilter || '';
        let students = Array.isArray(state().students) ? [...state().students] : [];
        if (classFilter && classFilter !== 'all') students = students.filter(s => String(s.classId || s.class_id) === String(classFilter));
        students.sort((a, b) => String(a.nis || a.id || '').localeCompare(String(b.nis || b.id || ''), undefined, { numeric: true, sensitivity: 'base' }));
        if (!students.length) {
            showToast('Tidak ada data murid untuk diekspor.', 'warning');
            return;
        }
        const missing = students.filter(s => !exportPassword(s)).length;
        const data = students.map((s, idx) => ({
            No: idx + 1,
            NIS: s.nis || '-',
            'Nama Lengkap': s.name || '',
            Kelas: classNameFor(s),
            Username: s.username || '',
            Password: exportPassword(s)
        }));
        const ws = window.XLSX.utils.json_to_sheet(data);
        ws['!cols'] = [{ wch: 5 }, { wch: 15 }, { wch: 30 }, { wch: 15 }, { wch: 18 }, { wch: 22 }];
        const wb = window.XLSX.utils.book_new();
        window.XLSX.utils.book_append_sheet(wb, ws, 'Data Murid');
        const label = classFilter === 'all' || !classFilter ? 'Semua_Kelas' : classNameFor({ classId: classFilter }).replace(/\s+/g, '_');
        window.XLSX.writeFile(wb, `Data_Siswa_${label}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        showToast(missing ? `Export selesai. ${missing} password lama tidak bisa dibaca karena tersimpan hash.` : 'Data murid berhasil diekspor ke Excel!', missing ? 'warning' : 'success');
        if (typeof window.closeModal === 'function') window.closeModal();
    };
    window.__credentialPatch = { patchTeacherTable, visiblePassword };
    setInterval(patchTeacherTable, 1000);
})();
