var appState = window.appState || {};
// Modules and API helper script

function moduleEscapeHtml(value) {
    const raw = String(value ?? '');
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(raw);
    return raw.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}
function moduleEscapeAttr(value) {
    if (typeof window.escapeHtmlAttr === 'function') return window.escapeHtmlAttr(value);
    return moduleEscapeHtml(value);
}
function moduleInlineArg(value) {
    return moduleEscapeAttr(JSON.stringify(String(value ?? '')));
}

let studentAttendanceStream = null;

window.stopCameraStreamTrack = function(stream) {
    if (!stream) return;
    if (window.__persistentStudentCameraStream && stream === window.__persistentStudentCameraStream) {
        // Do NOT stop persistent camera stream tracks, keep it running for other screens
        return;
    }
    try {
        stream.getTracks().forEach(t => t.stop());
    } catch(e) {}
};

window.requestCameraStream = async function() {
    // P2P_ONLY_LIVECAM_V5: camera features never require microphone permission.
    if (window.__persistentStudentCameraStream) {
        try {
            const tracks = window.__persistentStudentCameraStream.getTracks();
            const isActive = tracks.length > 0 && tracks.every(t => t.readyState === 'live');
            if (isActive) {
                return window.__persistentStudentCameraStream;
            }
        } catch (e) {
            window.__persistentStudentCameraStream = null;
        }
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const err = new Error('NOT_SUPPORTED');
        err.name = 'NOT_SUPPORTED';
        throw err;
    }

    let stream;
    // Try 1: Facing mode 'user' with optimized low-bandwidth dimensions (640x360, 10-15 FPS)
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 360 },
                frameRate: { ideal: 12, max: 15 }
            },
            audio: false
        });
    } catch (e1) {
        console.warn('Camera Attempt 1 (facingMode user + ideal res) failed:', e1);
        try {
            stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user' },
                audio: false
            });
        } catch (e2) {
            console.warn('Camera Attempt 2 (facingMode user) failed:', e2);
            stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false
            });
        }
    }

    window.__persistentStudentCameraStream = stream;
    return stream;
};

window.getCameraErrorMessage = function(err) {
    console.warn('Camera Access Error details:', err);
    let msg = 'Kamera tidak dapat dibuka.';
    let solution = 'Pastikan izin kamera diaktifkan di browser Anda.';

    if (err) {
        if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
            msg = 'Izin Akses Kamera Ditolak!';
            solution = 'Klik ikon gembok/kamera pada address bar (URL) browser Anda, ubah izin Kamera menjadi "Izinkan" (Allow), lalu klik Coba Buka Kamera Lagi.';
        } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
            msg = 'Kamera Sedang Digunakan Aplikasi Lain!';
            solution = 'Tutup aplikasi lain (seperti Zoom, Teams, WhatsApp, atau Kamera HP) yang sedang memakai kamera, lalu klik Coba Buka Kamera Lagi.';
        } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
            msg = 'Perangkat Kamera Tidak Ditemukan!';
            solution = 'Pastikan webcam atau kamera HP/Laptop Anda terhubung dengan benar.';
        } else if (err.name === 'NOT_SUPPORTED' || !window.isSecureContext) {
            msg = 'Browser Memblokir Kamera (Insecure Context / Non-HTTPS)';
            solution = 'Akses kamera di HP via Wi-Fi lokal memerlukan HTTPS atau setting Chrome Flags. Atau gunakan tombol Upload Foto di bawah.';
        }
    }

    return { msg, solution };
};

function exportToExcel(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) { showToast('Tabel tidak ditemukan untuk di-export.', 'error'); return; }
    if (window.XLSX) {
        const wb = window.XLSX.utils.table_to_book(table, { sheet: "Data" });
        window.XLSX.writeFile(wb, filename + '.xlsx');
        showToast('Data berhasil diexport ke Excel!', 'success');
    } else {
        showToast('Library Excel belum siap.', 'error');
    }
}

function exportToPDF(title, headers, rows, filename) {
    if (!window.jspdf) { showToast('Library PDF belum siap.', 'error'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text((appState.settings.schoolName || 'MADRASAH ALIYAH').toUpperCase(), 14, 15);
    doc.setFontSize(11);
    doc.text(title, 14, 22);
    if (doc.autoTable) {
        doc.autoTable({
            head: [headers],
            body: rows,
            startY: 28,
            theme: 'grid',
            styles: { fontSize: 9 },
            headStyles: { fillColor: [16, 185, 129] }
        });
    }
    doc.save(filename + '.pdf');
    showToast('Data berhasil diexport ke PDF!', 'success');
}

function closeModal() {
    document.body.style.overflow = '';
    document.body.style.overflow = '';
    const modal = document.getElementById('modal-container');
    if (modal) {
        modal.innerHTML = '';
        modal.classList.remove('hidden');
    }
    // Also remove any standalone modal elements by ID
    ['calendar-event-modal', 'calendar-detail-modal', 'calendar-pdf-modal', 'single-auto-koreksi-modal'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
}

// Modal backdrop clicks are intentionally ignored. Modals close only through explicit controls (X/Batal/Tutup/Escape).
window._studentDashboardView = window._studentDashboardView || 'dashboard';

function studentGoBackToDashboard() {
    if (window.studentAttendanceStream) {
        if (window.stopCameraStreamTrack) {
            window.stopCameraStreamTrack(window.studentAttendanceStream);
        } else {
            try {
                window.studentAttendanceStream.getTracks().forEach(t => t.stop());
            } catch(e) {}
        }
        window.studentAttendanceStream = null;
    }
    window._studentDashboardView = 'dashboard';
    if (typeof appState !== 'undefined') {
        appState.activeStudentAttendanceSubjectId = '';
        appState.activeClassLeaderAttendanceSubjectId = '';
    }
    if (typeof appState !== 'undefined' && (appState.role === 'class_leader' || appState.role === 'ketua_kelas')) {
        navigateTo('profil_ketua');
    } else {
        navigateTo('profil_siswa');
    }
}
window.studentGoBackToDashboard = studentGoBackToDashboard;

function toggleStudentDashboardView(view) {
    window._studentDashboardView = view;
    const container = document.getElementById('view-container');
    if (container) {
        renderStudentProfile(container);
    }
}
window.toggleStudentDashboardView = toggleStudentDashboardView;

function isStudentDashboardFeatureEnabled(feature) {
    const settings = appState.settings || {};
    const studentFeatures = settings.studentFeatures || {};
    if (feature === 'learning' && settings.learningModuleEnabled === false) return false;
    if (feature === 'games' && settings.gameModuleEnabled === false) return false;
    return studentFeatures[feature] === undefined ? true : studentFeatures[feature] !== false;
}

function renderStudentDashboardCard({ route, buttonClass, iconClass, titleClass, actionClass, icon, title, description, action }) {
    return `
        <button type="button" onclick="navigateTo('${route}')" class="${buttonClass}">
            <div class="${iconClass}">
                <i class="fa-solid ${icon} text-2xl"></i>
            </div>
            <h3 class="${titleClass}">${title}</h3>
            <p class="text-xs text-slate-500 mt-2 leading-relaxed">${description}</p>
            <div class="${actionClass}">
                <span>${action}</span>
                <i class="fa-solid fa-arrow-right group-hover:translate-x-1 transition-transform"></i>
            </div>
        </button>
    `;
}

function renderStudentProfile(container) {
    const st = appState.currentUser && appState.currentUser.id 
        ? (appState.students.find(s => String(s.id) === String(appState.currentUser.id)) || appState.currentUser)
        : appState.students[0] || {};

    const cls = appState.classes.find(c => String(c.id) === String(st.classId || st.class_id));

    // Pre-request and cache camera permission/stream immediately when student loads their dashboard
    if (window.requestCameraStream) {
        window.requestCameraStream().catch(err => {
            console.warn('Dashboard camera stream pre-request error:', err);
        });
    }

    if (window._studentDashboardView === 'dashboard') {
        const todayStr = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const runningText = moduleEscapeHtml((appState.settings && appState.settings.runningText) ? appState.settings.runningText : 'Selamat Datang di Portal Sistem Informasi Madrasah Terintegrasi! Tetap Semangat Berprestasi.');
        const dashboardCards = [
            isStudentDashboardFeatureEnabled('attendance') ? renderStudentDashboardCard({
                route: 'absen_siswa',
                buttonClass: 'group p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-500 rounded-3xl text-left transition-all duration-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer',
                iconClass: 'w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300',
                titleClass: 'font-bold text-lg text-slate-850 leading-snug group-hover:text-blue-600 transition-colors',
                actionClass: 'mt-4 flex items-center gap-1.5 text-xs font-bold text-blue-600',
                icon: 'fa-camera-retro',
                title: 'Absen Selfie & GPS',
                description: 'Lakukan pencatatan kehadiran mandiri Anda menggunakan verifikasi kamera depan dan lokasi GPS secara akurat.',
                action: 'Mulai Absensi'
            }) : '',
            isStudentDashboardFeatureEnabled('learning') ? renderStudentDashboardCard({
                route: 'learning_student',
                buttonClass: 'group p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-sky-500 rounded-3xl text-left transition-all duration-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer',
                iconClass: 'w-14 h-14 bg-sky-50 text-sky-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300',
                titleClass: 'font-bold text-lg text-slate-850 leading-snug group-hover:text-sky-600 transition-colors',
                actionClass: 'mt-4 flex items-center gap-1.5 text-xs font-bold text-sky-600',
                icon: 'fa-book-open-reader',
                title: 'Belajar / Materi',
                description: 'Buka materi yang dipublikasikan guru, ikuti alur belajar, lalu lanjutkan LKPD atau asesmen yang tersedia.',
                action: 'Mulai Belajar'
            }) : '',
            isStudentDashboardFeatureEnabled('cbt') ? renderStudentDashboardCard({
                route: 'asesmen_siswa',
                buttonClass: 'group p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-indigo-500 rounded-3xl text-left transition-all duration-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer',
                iconClass: 'w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300',
                titleClass: 'font-bold text-lg text-slate-850 leading-snug group-hover:text-indigo-600 transition-colors',
                actionClass: 'mt-4 flex items-center gap-1.5 text-xs font-bold text-indigo-600',
                icon: 'fa-file-shield',
                title: 'CBT / Ujian Online',
                description: 'Akses daftar ujian, asesmen, atau penilaian madrasah online yang sedang aktif dan kerjakan langsung di sini.',
                action: 'Buka CBT'
            }) : '',
            isStudentDashboardFeatureEnabled('games') ? renderStudentDashboardCard({
                route: 'game_edukasi_siswa',
                buttonClass: 'group p-6 bg-white hover:bg-slate-50 border border-slate-200 hover:border-emerald-500 rounded-3xl text-left transition-all duration-300 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer',
                iconClass: 'w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300',
                titleClass: 'font-bold text-lg text-slate-850 leading-snug group-hover:text-emerald-600 transition-colors',
                actionClass: 'mt-4 flex items-center gap-1.5 text-xs font-bold text-emerald-600',
                icon: 'fa-gamepad',
                title: 'Game Edukasi',
                description: 'Mainkan 15 tantangan game interaktif, petualangan belajar, dan tingkatkan poin XP & peringkat madrasah.',
                action: 'Mulai Mainkan'
            }) : ''
        ].filter(Boolean);
        
        container.innerHTML = `
            <div class="space-y-6 max-w-4xl mx-auto pb-8">
                <!-- Greeting & Welcome Banner (High Contrast & Professional) -->
                <div class="bg-white border-2 border-slate-200 rounded-3xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                    <div class="space-y-2.5">
                        <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-800 rounded-full text-xs font-bold border border-blue-100 uppercase tracking-wider">
                            <span class="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                            Portal Utama Siswa
                        </span>
                        <h1 class="text-2xl md:text-3xl font-black text-slate-900 tracking-tight mt-1 leading-tight">
                            Assalamualaikum, <span class="text-blue-700 font-extrabold">${moduleEscapeHtml(st.name || 'Siswa')}</span>!
                        </h1>
                        <p class="text-sm text-slate-600 font-semibold flex flex-wrap items-center gap-2">
                            <span class="px-2.5 py-0.5 bg-slate-100 text-slate-750 border border-slate-200 rounded-lg text-xs">Kelas: <b class="text-slate-900">${moduleEscapeHtml(cls ? cls.name : 'Umum')}</b></span>
                            <span class="text-slate-300">|</span>
                            <span class="px-2.5 py-0.5 bg-slate-100 text-slate-750 border border-slate-200 rounded-lg text-xs">NIS: <span class="font-mono text-slate-900 font-bold">${moduleEscapeHtml(st.nis || '-')}</span></span>
                        </p>
                    </div>
                    
                    <div class="shrink-0 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center md:text-right shadow-xs">
                        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Hari & Tanggal</p>
                        <p class="text-sm font-bold text-slate-850 mt-1 flex items-center justify-center md:justify-end gap-2">
                            <i class="fa-regular fa-calendar-check text-blue-600"></i>
                            <span>${todayStr}</span>
                        </p>
                    </div>
                </div>

                <!-- RUNNING TEXT / MARQUEE BANNER -->
                <div class="bg-blue-50/70 border border-blue-200 text-blue-950 rounded-2xl p-2.5 sm:p-3 flex items-center space-x-3 shadow-xs overflow-hidden">
                    <div class="shrink-0 w-8 h-8 bg-blue-600 text-white rounded-xl flex items-center justify-center text-xs shadow-sm">
                        <i class="fa-solid fa-bullhorn text-xs"></i>
                    </div>
                    <div class="overflow-hidden whitespace-nowrap flex-1 min-w-0">
                        <marquee class="text-xs sm:text-sm font-bold text-slate-800 tracking-wide" scrollamount="6">${runningText}</marquee>
                    </div>
                </div>

                <!-- Main Large Dashboard Buttons -->
                <div class="grid grid-cols-1 ${dashboardCards.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6">
                    ${dashboardCards.join('')}
                </div>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="space-y-6 max-w-2xl mx-auto pb-8">
                <!-- Back to Dashboard Header -->
                <div class="flex items-center justify-between pb-2 border-b border-slate-200">
                    <button type="button" onclick="toggleStudentDashboardView('dashboard')" class="flex items-center gap-2 text-slate-600 hover:text-slate-850 transition font-semibold text-xs sm:text-sm">
                        <i class="fa-solid fa-arrow-left"></i>
                        <span>Kembali ke Dashboard Utama</span>
                    </button>
                    <span class="text-xs font-bold text-slate-400">Pengaturan Profil</span>
                </div>

                <div class="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6">
                    <div class="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6 border-b pb-6">
                        <div class="relative group">
                            <div class="w-24 h-24 bg-emerald-100 text-emerald-800 rounded-3xl flex items-center justify-center text-4xl font-bold shadow-inner overflow-hidden border-2 border-emerald-500/20">
                                ${st.photo ? `<img src="${window.getPhotoHtmlSrc ? window.getPhotoHtmlSrc(st.photo) : ''}" class="w-full h-full object-cover" referrerPolicy="no-referrer">` : `<i class="fa-solid fa-user-graduate"></i>`}
                            </div>
                            <button type="button" onclick="openStudentPhotoSourceModal(${moduleInlineArg(st.id)})" class="absolute bottom-0 right-0 p-2 bg-emerald-600 text-white rounded-xl cursor-pointer shadow hover:bg-emerald-700 transition" title="Ganti Foto Profil">
                                <i class="fa-solid fa-camera text-xs"></i>
                            </button>
                            <input type="file" id="student-gallery-input-${moduleEscapeAttr(st.id)}" accept="image/*" class="hidden" onchange="uploadStudentPhoto(event, ${moduleInlineArg(st.id)})">
                        </div>
                        <div class="text-center sm:text-left flex-1">
                            <span class="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">Profil Murid Madrasah</span>
                            <h1 class="text-xl sm:text-2xl font-bold text-slate-800 mt-1">${moduleEscapeHtml(st.name || '-')}</h1>
                            <p class="text-xs text-slate-400 mt-0.5">NIS: ${moduleEscapeHtml(st.nis || '-')} | Kelas: ${moduleEscapeHtml(cls ? cls.name : '-')}</p>
                        </div>
                    </div>

                    <!-- Student profile form -->
                    <form onsubmit="saveStudentProfileUpdate(event, ${moduleInlineArg(st.id)})" class="space-y-4 text-xs sm:text-sm pt-2">
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Nama Lengkap</label>
                            <input type="text" id="prof-name" value="${window.escapeHtmlAttr ? window.escapeHtmlAttr(st.name || '') : ''}" required class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl">
                        </div>
                        <div>
                            <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">No. HP</label>
                            <input type="tel" id="prof-phone" value="${window.escapeHtmlAttr ? window.escapeHtmlAttr(st.no_hp || '') : ''}" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono" placeholder="Contoh: 081234567890">
                        </div>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Username Login</label>
                                <input type="text" id="prof-user" value="${moduleEscapeAttr(st.username || 'siswa1')}" required class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold uppercase text-slate-500 mb-1">Password</label>
                                <input type="password" id="prof-pass" value="" autocomplete="new-password" placeholder="Kosongkan jika tidak ingin mengganti" class="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-mono">
                            </div>
                        </div>
                        <div class="flex justify-end pt-2">
                            <button type="submit" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl shadow transition">Simpan Perubahan Profil</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
    }
}

function openStudentPhotoSourceModal(studentId) {
    const modal = document.getElementById('modal-container');
    if (!modal) return;
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100 p-6 space-y-6">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div class="flex items-center gap-2.5">
                        <div class="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
                            <i class="fa-solid fa-camera-retro"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-base text-slate-850">Ganti Foto Profil</h3>
                            <p class="text-xs text-slate-500">Pilih sumber pengambilan foto Anda</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button type="button" onclick="openStudentCameraCaptureModal('${studentId}')" class="group p-5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl text-center flex flex-col items-center justify-center space-y-3 transition cursor-pointer shadow-xs">
                        <div class="w-14 h-14 bg-emerald-600 text-white rounded-2xl flex items-center justify-center text-xl shadow group-hover:scale-110 transition-transform">
                            <i class="fa-solid fa-camera"></i>
                        </div>
                        <div>
                            <p class="font-bold text-sm text-emerald-900">Ambil dari Kamera</p>
                            <p class="text-[11px] text-emerald-700 mt-0.5">Gunakan kamera perangkat secara langsung</p>
                        </div>
                    </button>

                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''; const inp = document.getElementById('student-gallery-input-${studentId}'); if(inp) inp.click();" class="group p-5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-2xl text-center flex flex-col items-center justify-center space-y-3 transition cursor-pointer shadow-xs">
                        <div class="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center text-xl shadow group-hover:scale-110 transition-transform">
                            <i class="fa-solid fa-images"></i>
                        </div>
                        <div>
                            <p class="font-bold text-sm text-blue-900">Ambil di Galeri</p>
                            <p class="text-[11px] text-blue-700 mt-0.5">Pilih file foto dari perangkat</p>
                        </div>
                    </button>
                </div>

                <div class="pt-2 text-center">
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="text-xs font-semibold text-slate-500 hover:text-slate-700">Batal</button>
                </div>
            </div>
        </div>
    `;
}
window.openStudentPhotoSourceModal = openStudentPhotoSourceModal;

let _activeProfileCamStream = null;

async function openStudentCameraCaptureModal(studentId) {
    const modal = document.getElementById('modal-container');
    if (!modal) return;
    
    document.body.style.overflow = 'hidden';
    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-fade-in">
            <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100 p-6 space-y-5">
                <div class="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div class="flex items-center gap-2">
                        <div class="w-9 h-9 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                            <i class="fa-solid fa-camera"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-base text-slate-850">Kamera Perangkat</h3>
                            <p class="text-xs text-slate-500">Posisikan wajah Anda lalu ambil foto</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeStudentCameraModal()" class="w-8 h-8 rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="relative w-full h-72 bg-slate-900 rounded-2xl overflow-hidden shadow-inner flex items-center justify-center">
                    <video id="profile-cam-video" autoplay muted playsinline class="w-full h-full object-cover" style="transform: scaleX(-1);"></video>
                    <canvas id="profile-cam-canvas" class="hidden"></canvas>
                    <div id="profile-cam-loading" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white p-4">
                        <i class="fa-solid fa-spinner fa-spin text-2xl text-emerald-400 mb-2"></i>
                        <p class="text-xs text-emerald-200 font-semibold">Mengakses kamera perangkat...</p>
                    </div>
                </div>

                <div class="flex items-center justify-between pt-2">
                    <button type="button" onclick="closeStudentCameraModal()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-xs transition cursor-pointer">
                        Kembali
                    </button>
                    <button type="button" onclick="snapStudentCameraPhoto('${studentId}')" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md transition flex items-center gap-2 cursor-pointer">
                        <i class="fa-solid fa-camera"></i> Ambil Foto Sekarang
                    </button>
                </div>
            </div>
        </div>
    `;

    const video = document.getElementById('profile-cam-video');
    const loading = document.getElementById('profile-cam-loading');
    try {
        const stream = await window.requestCameraStream();
        _activeProfileCamStream = stream;
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
window.openStudentCameraCaptureModal = openStudentCameraCaptureModal;

function closeStudentCameraModal() {
    if (_activeProfileCamStream) {
        try {
            _activeProfileCamStream.getTracks().forEach(t => t.stop());
        } catch(e) {}
        _activeProfileCamStream = null;
    }
    const modal = document.getElementById('modal-container');
    if (modal) modal.innerHTML = '';
}
window.closeStudentCameraModal = closeStudentCameraModal;

async function snapStudentCameraPhoto(studentId) {
    const video = document.getElementById('profile-cam-video');
    const canvas = document.getElementById('profile-cam-canvas');
    if (!video || !canvas) return;

    const width = video.videoWidth || 640;
    const height = video.videoHeight || 480;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, width, height);

    const rawBase64 = canvas.toDataURL('image/jpeg', 0.88);
    const base64Img = window.compressBase64Image ? await window.compressBase64Image(rawBase64) : rawBase64;

    closeStudentCameraModal();
    await saveStudentPhotoBase64(base64Img, studentId);
}
window.snapStudentCameraPhoto = snapStudentCameraPhoto;

async function saveStudentPhotoBase64(base64Img, studentId) {
    try {
        const stIdx = appState.students.findIndex(s => String(s.id) === String(studentId));
        if (stIdx < 0) { showToast('Data siswa tidak ditemukan.', 'error'); return; }

        const student = appState.students[stIdx];
        const prevPhoto = student.photo || '';
        let photoHistory = Array.isArray(student.photoHistory) ? [...student.photoHistory] : [];

        // Preserve previous photo into history
        if (prevPhoto && !photoHistory.some(h => (typeof h === 'string' ? h : h.photo) === prevPhoto)) {
            photoHistory.unshift({
                photo: prevPhoto,
                date: student.photoUpdated || new Date().toISOString().split('T')[0],
                type: 'initial',
                label: 'Foto Sebelumnya'
            });
        }

        // Add the new photo to history
        const todayStr = new Date().toISOString().split('T')[0];
        photoHistory.unshift({
            photo: base64Img,
            date: todayStr,
            type: 'manual',
            label: `Upload Baru (${todayStr})`
        });

        const response = await fetch(`/api/students/${encodeURIComponent(studentId)}/set-profile-photo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                photo: base64Img,
                source: 'manual',
                date: todayStr,
                label: `Upload Baru (${todayStr})`
            })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || data.message || 'Gagal menyimpan foto profil.');
        }

        const updatedStudent = data.student || {};
        appState.students[stIdx].photo = updatedStudent.photo || base64Img;
        appState.students[stIdx].photoHistory = updatedStudent.photoHistory || photoHistory;
        appState.students[stIdx].photoUpdated = todayStr;

        if (appState.currentUser && String(appState.currentUser.id) === String(studentId)) {
            appState.currentUser.photo = appState.students[stIdx].photo;
            appState.currentUser.photoHistory = appState.students[stIdx].photoHistory;
            if (window.persistCurrentUser) appState.currentUser = window.persistCurrentUser(appState.currentUser) || appState.currentUser;
            if (window.renderStudentHeaderProfile) window.renderStudentHeaderProfile();
        }

        try {
            localStorage.setItem('madrasah_students', JSON.stringify(appState.students));
        } catch (err) {}
        showToast('Foto profil baru berhasil disimpan dan masuk ke riwayat koleksi!', 'success');
        refreshViewsAfterStudentPhotoChange(studentId);
    } catch (error) {
        console.error('ERROR SIMPAN FOTO:', error);
        showToast(error.message || 'Gagal menyimpan foto profil.', 'error');
    }
}
window.saveStudentPhotoBase64 = saveStudentPhotoBase64;

function refreshViewsAfterStudentPhotoChange(studentId) {
    if (appState.currentView === 'profil_siswa' && typeof window.renderStudentProfile === 'function') {
        const container = document.getElementById('view-container');
        if (container) window.renderStudentProfile(container);
    }
    if (typeof window.showStudentProfileModal === 'function') {
        const modalEl = document.getElementById('modal-container');
        if (modalEl && !modalEl.classList.contains('hidden')) {
            const activeModal = modalEl.querySelector('[data-active-student-id]');
            if (activeModal) {
                const sId = activeModal.getAttribute('data-active-student-id') || studentId;
                window.showStudentProfileModal(sId);
            }
        }
    }
    if (appState.currentView === 'students' && typeof window.renderStudentModule === 'function') {
        const container = document.getElementById('view-container');
        if (container) window.renderStudentModule(container);
    }
}
window.refreshViewsAfterStudentPhotoChange = refreshViewsAfterStudentPhotoChange;

async function uploadStudentPhotoByAdmin(event, studentId) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    try {
        showToast('Memproses foto profil baru...', 'info');
        const reader = new FileReader();
        reader.onload = async (e) => {
            const rawBase64 = e.target.result;
            const compressed = window.compressBase64Image ? await window.compressBase64Image(rawBase64) : rawBase64;
            await saveStudentPhotoBase64(compressed, studentId);
        };
        reader.readAsDataURL(file);
    } catch (err) {
        console.error('Gagal upload foto oleh admin:', err);
        showToast('Gagal mengunggah foto.', 'error');
    }
}
window.uploadStudentPhotoByAdmin = uploadStudentPhotoByAdmin;

// Helper to render photo history section with thumbnails below the main photo
function renderStudentPhotoHistorySection(st) {
    window._studentPhotoMap = window._studentPhotoMap || {};
    const historyList = [];
    const seenUrls = new Set();
    const deletedPhotos = new Set(Array.isArray(st.deletedPhotos) ? st.deletedPhotos : []);

    // 1. Add current active photo
    if (st.photo && !deletedPhotos.has(st.photo) && !seenUrls.has(st.photo)) {
        seenUrls.add(st.photo);
        historyList.push({
            photo: st.photo,
            type: 'current',
            label: 'Foto Profil Aktif',
            date: st.photoUpdated || ''
        });
    }

    // 2. Add photos from photoHistory
    if (Array.isArray(st.photoHistory)) {
        st.photoHistory.forEach(item => {
            const pUrl = typeof item === 'string' ? item : (item && item.photo ? item.photo : '');
            if (pUrl && !deletedPhotos.has(pUrl) && !seenUrls.has(pUrl)) {
                seenUrls.add(pUrl);
                historyList.push({
                    photo: pUrl,
                    type: typeof item === 'object' && item.type ? item.type : 'history',
                    label: typeof item === 'object' && item.label ? item.label : 'Foto Riwayat',
                    date: typeof item === 'object' && item.date ? item.date : ''
                });
            }
        });
    }

    // 3. Collect photos from student attendance selfies if available
    const attList = (appState.attendance || []).filter(a => {
        const sameStudent = (
            String(a.studentId) === String(st.id) ||
            (st.nis && String(a.nis) === String(st.nis)) ||
            (a.studentId && st.name && String(a.studentId).toLowerCase() === String(st.name).toLowerCase())
        );
        return sameStudent && a.photo;
    });

    attList.forEach(a => {
        if (a.photo && !deletedPhotos.has(a.photo) && !seenUrls.has(a.photo)) {
            seenUrls.add(a.photo);
            historyList.push({
                photo: a.photo,
                type: 'attendance',
                label: `Foto Absensi (${a.date || 'Selfie'})`,
                date: a.date || ''
            });
        }
    });

    return `
        <div class="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-4 sm:p-5 space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div class="flex items-center gap-2">
                    <div class="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xs">
                        <i class="fa-solid fa-images"></i>
                    </div>
                    <div>
                        <h3 class="text-xs sm:text-sm font-bold text-slate-800">Koleksi & Riwayat Foto Siswa</h3>
                        <p class="text-[11px] text-slate-500">Pilih bekas foto di bawah untuk dijadikan profil utama, atau hapus foto satu per satu secara manual.</p>
                    </div>
                </div>
                <span class="text-[11px] font-semibold text-slate-400 self-start sm:self-auto bg-white px-2.5 py-1 rounded-full border border-slate-200">${historyList.length} Foto Tersedia</span>
            </div>

            ${historyList.length === 0 ? `
                <div class="p-4 bg-white border border-dashed border-slate-200 rounded-xl text-center text-xs text-slate-400">
                    <i class="fa-regular fa-image text-slate-300 text-lg mb-1 block"></i>
                    Belum ada riwayat foto lainnya. Foto absensi selfie harian dan upload baru akan otomatis tersimpan di sini.
                </div>
            ` : `
                <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-1">
                    ${historyList.map(item => {
                        const isActive = (item.photo === st.photo);
                        const photoKey = 'ph_' + Math.random().toString(36).substring(2, 9);
                        window._studentPhotoMap[photoKey] = item.photo;

                        return `
                            <div class="relative group bg-white p-2 rounded-2xl border transition shadow-2xs ${isActive ? 'border-emerald-500 ring-2 ring-emerald-500/20 bg-emerald-50/30' : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'}">
                                <!-- Thumbnail -->
                                <div class="w-full aspect-square rounded-xl overflow-hidden bg-slate-100 relative cursor-pointer" onclick="selectStudentProfileFromHistory('${st.id}', window._studentPhotoMap['${photoKey}'])" title="${isActive ? 'Foto profil aktif' : 'Klik untuk jadikan foto profil'}">
                                    <img src="${window.getPhotoHtmlSrc ? window.getPhotoHtmlSrc(item.photo) : ''}" class="w-full h-full object-cover group-hover:scale-105 transition duration-200" referrerPolicy="no-referrer" alt="Foto">
                                    
                                    ${isActive ? `
                                        <div class="absolute inset-0 bg-emerald-900/30 flex items-center justify-center pointer-events-none">
                                            <span class="bg-emerald-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                                                <i class="fa-solid fa-check"></i> Aktif
                                            </span>
                                        </div>
                                    ` : `
                                        <div class="absolute inset-0 bg-slate-950/0 group-hover:bg-slate-950/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-150">
                                            <span class="bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded-lg shadow-md flex items-center gap-1">
                                                <i class="fa-solid fa-user-check"></i> Pilih
                                            </span>
                                        </div>
                                    `}
                                </div>

                                <!-- Label & Delete -->
                                <div class="mt-2 flex items-center justify-between gap-1 px-1">
                                    <span class="text-[10px] font-semibold text-slate-600 truncate max-w-[80px]" title="${item.label}">
                                        ${item.label}
                                    </span>
                                    <button type="button" onclick="deleteStudentPhotoFromHistory('${st.id}', window._studentPhotoMap['${photoKey}'], event)" class="w-6 h-6 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition cursor-pointer" title="Hapus foto ini dari koleksi">
                                        <i class="fa-solid fa-trash-can text-[10px]"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>
    `;
}
window.renderStudentPhotoHistorySection = renderStudentPhotoHistorySection;

// Select photo from history to be the active profile photo
async function selectStudentProfileFromHistory(studentId, photoUrl) {
    if (!photoUrl) return;
    try {
        const stIdx = appState.students.findIndex(s => String(s.id) === String(studentId));
        if (stIdx < 0) { showToast('Data siswa tidak ditemukan.', 'error'); return; }

        const student = appState.students[stIdx];
        if (student.photo === photoUrl) {
            showToast('Foto ini sudah menjadi foto profil aktif.', 'info');
            return;
        }

        const prevPhoto = student.photo || '';
        let photoHistory = Array.isArray(student.photoHistory) ? [...student.photoHistory] : [];

        if (prevPhoto && !photoHistory.some(h => (typeof h === 'string' ? h : h.photo) === prevPhoto)) {
            photoHistory.unshift({
                photo: prevPhoto,
                date: student.photoUpdated || new Date().toISOString().split('T')[0],
                type: 'initial',
                label: 'Foto Sebelumnya'
            });
        }

        if (!photoHistory.some(h => (typeof h === 'string' ? h : h.photo) === photoUrl)) {
            photoHistory.unshift({
                photo: photoUrl,
                date: new Date().toISOString().split('T')[0],
                type: 'history',
                label: 'Pilihan Koleksi'
            });
        }

        const response = await fetch(`/api/students/${encodeURIComponent(studentId)}/set-profile-photo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                photo: photoUrl,
                source: 'history',
                label: 'Pilihan Koleksi'
            })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.error || data.message || 'Gagal mengubah foto profil.');
        }

        appState.students[stIdx].photo = photoUrl;
        appState.students[stIdx].photoHistory = data.student?.photoHistory || photoHistory;

        if (appState.currentUser && String(appState.currentUser.id) === String(studentId)) {
            appState.currentUser.photo = photoUrl;
            appState.currentUser.photoHistory = appState.students[stIdx].photoHistory;
            if (window.persistCurrentUser) appState.currentUser = window.persistCurrentUser(appState.currentUser) || appState.currentUser;
            if (window.renderStudentHeaderProfile) window.renderStudentHeaderProfile();
        }

        try {
            localStorage.setItem('madrasah_students', JSON.stringify(appState.students));
        } catch (e) {}

        showToast('Foto profil aktif berhasil diubah!', 'success');
        refreshViewsAfterStudentPhotoChange(studentId);
    } catch (err) {
        console.error('Gagal memilih foto profil:', err);
        showToast(err.message || 'Gagal memilih foto profil.', 'error');
    }
}
window.selectStudentProfileFromHistory = selectStudentProfileFromHistory;

// Delete a photo from student history manually
async function deleteStudentPhotoFromHistory(studentId, photoUrl, event) {
    if (event) {
        if (event.stopPropagation) event.stopPropagation();
        if (event.preventDefault) event.preventDefault();
    }
    if (!photoUrl) return;

    const doDelete = async () => {
        try {
            const stIdx = appState.students.findIndex(s => String(s.id) === String(studentId));
            if (stIdx < 0) { showToast('Data siswa tidak ditemukan.', 'error'); return; }

            const student = appState.students[stIdx];
            let photoHistory = Array.isArray(student.photoHistory) ? [...student.photoHistory] : [];
            photoHistory = photoHistory.filter(h => {
                const p = typeof h === 'string' ? h : (h && h.photo ? h.photo : '');
                return p !== photoUrl;
            });

            let deletedPhotos = Array.isArray(student.deletedPhotos) ? [...student.deletedPhotos] : [];
            if (!deletedPhotos.includes(photoUrl)) {
                deletedPhotos.push(photoUrl);
            }

            let newActivePhoto = student.photo || '';
            if (newActivePhoto === photoUrl) {
                const remaining = photoHistory.filter(h => {
                    const p = typeof h === 'string' ? h : (h && h.photo ? h.photo : '');
                    return p && !deletedPhotos.includes(p);
                });
                if (remaining.length > 0) {
                    const first = remaining[0];
                    newActivePhoto = typeof first === 'string' ? first : (first && first.photo ? first.photo : '');
                } else {
                    newActivePhoto = '';
                }
            }

            const response = await fetch(`/api/students/${encodeURIComponent(studentId)}/photo-history`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photoUrl })
            });

            const data = await response.json();
            if (!response.ok || !data.success) {
                throw new Error(data.error || data.message || 'Gagal menghapus foto dari riwayat.');
            }

            appState.students[stIdx].photo = data.student?.photo !== undefined ? data.student.photo : newActivePhoto;
            appState.students[stIdx].photoHistory = data.student?.photoHistory || photoHistory;
            appState.students[stIdx].deletedPhotos = data.student?.deletedPhotos || deletedPhotos;

            // Remove photo from matching local attendance items if it was an attendance selfie
            (appState.attendance || []).forEach(a => {
                if ((String(a.studentId) === String(studentId) || (student.nis && String(a.nis) === String(student.nis))) && a.photo === photoUrl) {
                    delete a.photo;
                }
            });

            if (appState.currentUser && String(appState.currentUser.id) === String(studentId)) {
                appState.currentUser.photo = appState.students[stIdx].photo;
                appState.currentUser.photoHistory = appState.students[stIdx].photoHistory;
                appState.currentUser.deletedPhotos = appState.students[stIdx].deletedPhotos;
                if (window.persistCurrentUser) appState.currentUser = window.persistCurrentUser(appState.currentUser) || appState.currentUser;
                if (window.renderStudentHeaderProfile) window.renderStudentHeaderProfile();
            }

            try {
                localStorage.setItem('madrasah_students', JSON.stringify(appState.students));
            } catch (e) {}

            showToast('Foto berhasil dihapus dari riwayat.', 'success');
            refreshViewsAfterStudentPhotoChange(studentId);
        } catch (err) {
            console.error('Gagal menghapus foto riwayat:', err);
            showToast(err.message || 'Gagal menghapus foto dari riwayat.', 'error');
        }
    };

    if (typeof window.showConfirmModal === 'function') {
        window.showConfirmModal('Apakah Anda yakin ingin menghapus foto ini dari koleksi riwayat profil siswa?', doDelete);
    } else if (confirm('Apakah Anda yakin ingin menghapus foto ini dari koleksi riwayat profil siswa?')) {
        doDelete();
    }
}
window.deleteStudentPhotoFromHistory = deleteStudentPhotoFromHistory;

async function uploadStudentPhoto(e, studentId) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function(evt) {
        try {
            const rawBase64 = evt.target.result;
            const base64Img = window.compressBase64Image ? await window.compressBase64Image(rawBase64) : rawBase64;
            await saveStudentPhotoBase64(base64Img, studentId);
        } catch (error) {
            console.error('ERROR UPLOAD FOTO:', error);
            showToast(error.message || 'Gagal membaca file foto.', 'error');
        }
    };
    reader.readAsDataURL(file);
}

async function saveStudentProfileUpdate(e, studentId) {
    e.preventDefault();
    try {
        const name = document.getElementById('prof-name')?.value.trim() || '';
        const username = document.getElementById('prof-user')?.value.trim() || '';
        const password = document.getElementById('prof-pass')?.value.trim() || '';
        const no_hp = document.getElementById('prof-phone')?.value.trim() || '';

        if (!name || !username) {
            showToast('Nama dan Username wajib diisi.', 'error');
            return;
        }
        if (password && password.length < 8) {
            showToast('Password baru minimal 8 karakter, atau kosongkan jika tidak ingin mengganti.', 'error');
            return;
        }

        const stIdx = appState.students.findIndex(s => String(s.id) === String(studentId));
        if (stIdx < 0) { showToast('Data siswa tidak ditemukan.', 'error'); return; }

        if (!appState.currentUser || String(appState.currentUser.id) !== String(studentId)) {
            showToast('Akses profil tidak valid.', 'error');
            return;
        }
        const response = await fetch('/api/student/profile', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, username, ...(password ? { password } : {}), no_hp })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || 'Gagal menyimpan perubahan profil.');
        }

        const updatedStudent = data.student || { ...appState.students[stIdx], name, username, no_hp };
        appState.students[stIdx] = { ...appState.students[stIdx], ...updatedStudent };
        delete appState.students[stIdx].password;
        if (appState.currentUser && String(appState.currentUser.id) === String(studentId)) {
            appState.currentUser = data.user || { ...appState.currentUser, name, username, no_hp };
            delete appState.currentUser.password;
            if (data.token) appState.currentUser.token = data.token;
            if (window.persistCurrentUser) appState.currentUser = window.persistCurrentUser(appState.currentUser) || appState.currentUser;
            if (window.renderStudentHeaderProfile) window.renderStudentHeaderProfile();
        }

        try {
            localStorage.setItem('madrasah_students', JSON.stringify(appState.students));
        } catch (err) {}
        showToast('Profil murid berhasil diperbarui.', 'success');
    } catch (error) {
        console.error('ERROR UPDATE PROFIL:', error);
        showToast(error.message || 'Gagal menyimpan profil.', 'error');
    }
}

function filterStudentAttendanceSubjects(query) {
    const container = document.getElementById('subject-search-results');
    if (!container) return;
    const subjects = appState.subjects || [];
    const q = (query || '').toLowerCase().trim();
    
    if (!q) {
        container.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 font-medium"><i class="fa-solid fa-magnifying-glass mr-1.5 text-slate-400"></i>Ketik nama mata pelajaran di kolom pencarian...</div>`;
        return;
    }

    const filtered = subjects.filter(s => s.name.toLowerCase().includes(q));
    
    const hiddenInput = document.getElementById('select-student-attendance-subject');
    const currentSelectedId = hiddenInput ? hiddenInput.value : '';

    if (filtered.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-xs text-slate-400 font-medium">Mata pelajaran tidak ditemukan.</div>`;
        return;
    }

    container.innerHTML = filtered.map(s => {
        const isSelected = String(currentSelectedId) === String(s.id);
        return `
            <div onclick="selectStudentAttendanceSubject('${s.id}', '${s.name.replace(/'/g, "\\'")}')" class="p-3 rounded-xl border text-sm font-semibold flex items-center justify-between cursor-pointer transition ${isSelected ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-300'}">
                <span class="flex items-center gap-2.5">
                    <i class="fa-solid fa-book-bookmark ${isSelected ? 'text-white' : 'text-blue-500'}"></i>
                    <span>${s.name}</span>
                </span>
                ${isSelected ? '<i class="fa-solid fa-circle-check text-white"></i>' : '<i class="fa-solid fa-chevron-right text-xs text-slate-300"></i>'}
            </div>
        `;
    }).join('');
}

function selectStudentAttendanceSubject(id, name) {
    const hiddenInput = document.getElementById('select-student-attendance-subject');
    const searchInput = document.getElementById('input-search-student-subject');
    if (hiddenInput) hiddenInput.value = id;
    if (searchInput) searchInput.value = name;
    filterStudentAttendanceSubjects(name);
}

function confirmStudentAttendanceSubject() {
    const hiddenInput = document.getElementById('select-student-attendance-subject');
    let val = hiddenInput ? hiddenInput.value : '';
    const searchInput = document.getElementById('input-search-student-subject');
    const typedText = searchInput ? searchInput.value.trim().toLowerCase() : '';

    if (!val && typedText) {
        const subjects = appState.subjects || [];
        const matched = subjects.find(s => s.name.toLowerCase() === typedText) || subjects.find(s => s.name.toLowerCase().includes(typedText));
        if (matched) {
            val = matched.id;
        }
    }

    if (!val) {
        showToast('Pilih atau ketik mata pelajaran terlebih dahulu!', 'error');
        return;
    }
    appState.activeStudentAttendanceSubjectId = val;
    renderStudentAttendance(document.getElementById('view-container'));
}

// Student Attendance Functions
function renderStudentAttendance(container) {
    if (!container) container = document.getElementById('view-container');
    const st = appState.currentUser && appState.currentUser.id 
        ? (appState.students.find(s => String(s.id) === String(appState.currentUser.id)) || appState.currentUser)
        : appState.students[0] || {};
    const today = new Date().toISOString().split('T')[0];
    const activeDate = (appState.settings && appState.settings.attendanceDate) || appState.activeAttendanceDate || today;
    const calendarMode = (appState.settings && appState.settings.calendarMode) || (activeDate === today ? 'otomatis' : 'manual');
    
    const studentClass = appState.classes.find(c => String(c.id) === String(st.classId || st.class_id));
    const subjects = appState.subjects || [];

    const selectedSubjectId = appState.activeStudentAttendanceSubjectId || '';

    // Step 1: If no subject selected yet, show subject picker
    if (!selectedSubjectId) {
        container.innerHTML = `
            <div class="space-y-6 max-w-xl mx-auto pb-8 animate-fade-in">
                <!-- Back to Dashboard Header -->
                <div class="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-2">
                    <button type="button" onclick="window.studentGoBackToDashboard && window.studentGoBackToDashboard()" class="flex items-center gap-2 text-slate-600 hover:text-slate-850 transition font-bold text-xs sm:text-sm cursor-pointer">
                        <i class="fa-solid fa-arrow-left"></i>
                        <span>Kembali ke Dashboard Utama</span>
                    </button>
                    <span class="text-xs font-bold text-slate-400">Presensi Kehadiran</span>
                </div>

                <div class="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6 text-center">
                    <div class="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl mx-auto flex items-center justify-center text-2xl shadow">
                        <i class="fa-solid fa-book-open"></i>
                    </div>
                    <div>
                        <span class="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">Absensi Murid</span>
                        <h1 class="text-xl sm:text-2xl font-bold text-slate-800 mt-2">Pilih Mata Pelajaran</h1>
                        <p class="text-xs text-slate-400 mt-1">Pilih mata pelajaran untuk melanjutkan proses absensi.</p>
                    </div>

                    <div class="p-4 bg-slate-50 border border-slate-100 rounded-2xl text-left flex items-center justify-between shadow-xs">
                        <div class="space-y-0.5">
                            <span class="text-[10px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                                <i class="fa-solid fa-calendar-day text-emerald-600"></i> Tanggal Presensi Sesi Ini
                            </span>
                            <p class="text-[11px] text-slate-500 font-medium" id="student-active-mode-label">
                                ${calendarMode === 'otomatis' 
                                    ? '<span class="inline-flex items-center gap-1"><i class="fa-solid fa-robot text-[10px]"></i> Mode Otomatis (Hari Ini)</span>' 
                                    : '<span class="inline-flex items-center gap-1"><i class="fa-solid fa-user-gear text-[10px]"></i> Sesi Khusus (Oleh Admin)</span>'}
                            </p>
                        </div>
                        <span class="px-3.5 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-mono font-bold shadow-sm" id="student-active-date-display">${activeDate}</span>
                    </div>

                    <div class="text-left space-y-3">
                        <label class="block text-xs uppercase font-semibold text-slate-500 pt-1">Cari Mata Pelajaran</label>
                        <div class="relative">
                            <i class="fa-solid fa-magnifying-glass absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm"></i>
                            <input type="text" id="input-search-student-subject" oninput="filterStudentAttendanceSubjects(this.value)" placeholder="Ketik nama mapel (cth: Matematika, Fikih)..." class="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500">
                        </div>
                        <input type="hidden" id="select-student-attendance-subject" value="">

                        <div id="subject-search-results" class="max-h-56 overflow-y-auto space-y-2 border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                            <!-- Filtered subject items rendered here -->
                        </div>
                    </div>

                    <button type="button" onclick="confirmStudentAttendanceSubject()" class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl text-sm shadow transition flex items-center justify-center space-x-2 cursor-pointer">
                        <i class="fa-solid fa-circle-check"></i><span>OKE & Lanjut ke Absensi</span>
                    </button>
                </div>
            </div>
        `;
        setTimeout(() => {
            filterStudentAttendanceSubjects('');
        }, 50);
        return;
    }

    const currentSubject = subjects.find(s => String(s.id) === String(selectedSubjectId));
    const subjectName = currentSubject ? currentSubject.name : 'Mata Pelajaran';

    // Step 2: Check if already submitted for THIS subject on activeDate
    const alreadySubmitted = (appState.attendance || []).find(a => 
        (String(a.studentId) === String(st.id) || a.studentId === st.name) && 
        String(a.date).substring(0, 10) === activeDate &&
        String(a.subjectId || '') === String(selectedSubjectId)
    );

    if (alreadySubmitted) {
        container.innerHTML = `
            <div class="space-y-6 max-w-xl mx-auto pb-8 animate-fade-in">
                <!-- Back to Dashboard Header -->
                <div class="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-2">
                    <button type="button" onclick="window.studentGoBackToDashboard && window.studentGoBackToDashboard()" class="flex items-center gap-2 text-slate-600 hover:text-slate-850 transition font-bold text-xs sm:text-sm cursor-pointer">
                        <i class="fa-solid fa-arrow-left"></i>
                        <span>Kembali ke Dashboard Utama</span>
                    </button>
                    <span class="text-xs font-bold text-slate-400">Presensi Berhasil</span>
                </div>

                <div class="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6 text-center">
                    <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center text-2xl shadow">
                        <i class="fa-solid fa-circle-check"></i>
                    </div>
                    <div>
                        <span class="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">Absensi Berhasil</span>
                        <h1 class="text-xl font-bold text-slate-800 mt-2">Anda Sudah Absen Tanggal Ini</h1>
                        <p class="text-xs text-slate-600 font-bold mt-1">Mata Pelajaran: <span class="text-blue-600">${subjectName}</span></p>
                        <p class="text-xs text-slate-500 mt-1">Tanggal: <b>${activeDate}</b> | Status: <b>${alreadySubmitted.status}</b></p>
                    </div>
                    <div class="p-4 bg-slate-50 rounded-2xl text-xs space-y-1 text-left border">
                        <p class="font-semibold text-slate-700"><i class="fa-solid fa-location-dot text-emerald-600 mr-1.5"></i>Lokasi Tercatat:</p>
                        <p class="text-slate-500 font-mono">${alreadySubmitted.location || '-6.2000, 106.8166'}</p>
                    </div>
                    <button type="button" onclick="appState.activeStudentAttendanceSubjectId = ''; renderStudentAttendance(document.getElementById('view-container'));" class="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-2xl text-xs shadow transition cursor-pointer flex items-center justify-center gap-2">
                        <i class="fa-solid fa-arrows-rotate"></i><span>Pilih Mapel Lain</span>
                    </button>
                </div>
            </div>
        `;
        return;
    }

    // Step 3: Show Camera & GPS Attendance screen
    container.innerHTML = `
        <div class="space-y-6 max-w-xl mx-auto pb-8 animate-fade-in">
            <!-- Back to Dashboard Header -->
            <div class="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-2">
                <button type="button" onclick="window.studentGoBackToDashboard && window.studentGoBackToDashboard()" class="flex items-center gap-2 text-slate-600 hover:text-slate-850 transition font-bold text-xs sm:text-sm cursor-pointer">
                    <i class="fa-solid fa-arrow-left"></i>
                    <span>Kembali ke Dashboard Utama</span>
                </button>
                <span class="text-xs font-bold text-slate-400">Kamera Presensi</span>
            </div>

            <div class="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6 text-center">
                <div>
                    <div class="flex items-center justify-between bg-blue-50/80 p-3.5 px-4 rounded-2xl border border-blue-100 mb-4 text-left shadow-xs">
                        <div>
                            <span class="text-[10px] font-bold text-blue-600 uppercase tracking-wider block">Mata Pelajaran</span>
                            <span class="text-sm font-bold text-blue-950">${subjectName}</span>
                        </div>
                        <button type="button" onclick="appState.activeStudentAttendanceSubjectId = ''; renderStudentAttendance(document.getElementById('view-container'));" class="px-3 py-1.5 bg-white border border-blue-200 text-blue-700 text-xs font-semibold rounded-xl hover:bg-blue-100 transition shadow-xs cursor-pointer animate-fade-in">
                            <i class="fa-solid fa-arrows-rotate mr-1"></i>Ganti Mapel
                        </button>
                    </div>

                    <span class="px-3 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-semibold">Absensi Mandiri Murid</span>
                    <h1 class="text-xl sm:text-2xl font-bold text-slate-800 mt-2">Absen Selfie & Geotagging GPS</h1>
                    <p class="text-xs text-slate-400 mt-1">Kamera terbuka otomatis. Ambil foto selfie dan pastikan lokasi GPS aktif.</p>

                    <div class="mt-4 p-4 bg-slate-50 rounded-2xl border text-left space-y-2">
                        <div class="flex justify-between items-center"><span class="text-xs text-slate-500">Nama Siswa</span><span class="text-xs font-bold text-slate-700">${st.name || '-'}</span></div>
                        <div class="flex justify-between items-center"><span class="text-xs text-slate-500">NIS</span><span class="text-xs font-mono font-bold text-slate-700">${st.nis || '-'}</span></div>
                        <div class="flex justify-between items-center"><span class="text-xs text-slate-500">Kelas</span><span class="text-xs font-bold text-blue-700">${studentClass ? `${studentClass.name} (${studentClass.grade})` : '-'}</span></div>
                        <div class="flex justify-between items-center pt-2 border-t border-slate-200">
                            <span class="text-xs text-slate-500"><i class="fa-solid fa-calendar-day text-emerald-600 mr-1.5"></i>Tanggal Absensi (Diset Admin)</span>
                            <span class="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-200">${activeDate}</span>
                        </div>
                    </div>
                </div>

                <div class="w-full h-64 bg-slate-900 text-white rounded-3xl flex flex-col items-center justify-center space-y-2 relative overflow-hidden shadow-inner">
                    <video id="student-webcam" autoplay muted playsinline class="w-full h-full object-cover" style="transform: scaleX(-1);"></video>
                    <canvas id="student-canvas" class="hidden"></canvas>
                    <img id="student-photo-preview" class="w-full h-full object-cover hidden" alt="Preview Selfie" style="transform: scaleX(-1);">
                    <div id="cam-placeholder" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white p-4">
                        <i class="fa-solid fa-spinner fa-spin text-3xl text-blue-400 mb-2"></i>
                        <p class="text-xs text-blue-200 font-semibold">Memuat & Mengakses Kamera...</p>
                    </div>
                </div>

                <div class="p-4 bg-slate-50 rounded-2xl text-xs space-y-2 text-left border">
                    <div class="flex justify-between items-center">
                        <div>
                            <p class="font-semibold text-slate-700"><i class="fa-solid fa-location-dot text-blue-600 mr-1.5"></i>Status Lokasi GPS:</p>
                            <p id="gps-status-text" class="text-slate-500 font-mono">Mendeteksi koordinat GPS...</p>
                        </div>
                        <button type="button" onclick="refreshStudentGPS()" class="px-3 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-semibold shadow hover:bg-blue-700 transition cursor-pointer">
                            <i class="fa-solid fa-crosshairs mr-1"></i> Konfigurasi GPS
                        </button>
                    </div>
                </div>

                <div id="attendance-action-area" class="space-y-3">
                    <button type="button" id="btn-submit-attendance" onclick="submitStudentAttendance()" class="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-2xl text-sm shadow transition hidden flex items-center justify-center space-x-2 cursor-pointer">
                        <i class="fa-solid fa-paper-plane"></i><span>Kirim Absensi</span>
                    </button>
                    <button type="button" id="btn-take-photo" onclick="captureStudentSelfie()" class="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-2xl text-sm shadow transition flex items-center justify-center space-x-2 cursor-pointer">
                        <i class="fa-solid fa-camera"></i><span>Ambil Foto Selfie</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    initStudentWebcamAndGPS();
}

function initStudentWebcamAndGPS() {
    const video = document.getElementById('student-webcam');
    const placeholder = document.getElementById('cam-placeholder');

    if (studentAttendanceStream) {
        if (window.stopCameraStreamTrack) {
            window.stopCameraStreamTrack(studentAttendanceStream);
        } else {
            try {
                studentAttendanceStream.getTracks().forEach(t => t.stop());
            } catch(e) {}
        }
        studentAttendanceStream = null;
    }

    if (placeholder) {
        placeholder.style.display = 'flex';
        placeholder.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin text-3xl text-blue-400 mb-2"></i>
            <p class="text-xs text-blue-200 font-semibold">Memuat & Mengakses Kamera...</p>
        `;
    }

    window.requestCameraStream()
        .then(stream => {
            studentAttendanceStream = stream;
            if (video) {
                video.srcObject = stream;
                video.muted = true;
                video.play().catch(e => console.warn('Video play err:', e));
            }
            if (placeholder) placeholder.style.display = 'none';
        })
        .catch(err => {
            const errInfo = window.getCameraErrorMessage(err);
            if (placeholder) {
                placeholder.style.display = 'flex';
                placeholder.innerHTML = `
                    <div class="p-3 text-center space-y-2 max-w-xs">
                        <i class="fa-solid fa-triangle-exclamation text-rose-400 text-2xl"></i>
                        <p class="text-xs font-bold text-rose-300">${errInfo.msg}</p>
                        <p class="text-[10px] text-slate-300 leading-tight">${errInfo.solution}</p>
                        <div class="pt-1 flex flex-col gap-1.5">
                            <button type="button" onclick="initStudentWebcamAndGPS()" class="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow cursor-pointer">
                                <i class="fa-solid fa-arrows-rotate mr-1"></i> Coba Buka Kamera Lagi
                            </button>
                            <label class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold shadow cursor-pointer inline-flex items-center justify-center">
                                <i class="fa-solid fa-upload mr-1"></i> Upload Foto dari HP/File
                                <input type="file" accept="image/*" capture="user" class="hidden" onchange="handleStudentSelfieUpload(event)">
                            </label>
                        </div>
                    </div>
                `;
            }
        });

    refreshStudentGPS();
}

window.handleStudentSelfieUpload = function(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxWidth = 800;
            const maxHeight = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
            window._capturedSelfieData = dataUrl;

            const preview = document.getElementById('student-photo-preview');
            const video = document.getElementById('student-webcam');
            const placeholder = document.getElementById('cam-placeholder');
            const btnTake = document.getElementById('btn-take-photo');
            const btnSubmit = document.getElementById('btn-submit-attendance');

            if (placeholder) placeholder.style.display = 'none';
            if (video) video.classList.add('hidden');
            if (preview) { preview.src = dataUrl; preview.classList.remove('hidden'); }
            if (btnTake) {
                btnTake.innerHTML = `<i class="fa-solid fa-repeat mr-1"></i><span>Ulangi Foto</span>`;
                btnTake.onclick = retakeStudentSelfie;
            }
            if (btnSubmit) btnSubmit.classList.remove('hidden');
            showToast('Foto dari galeri/kamera berhasil diunggah!', 'success');
        };
        img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
};

function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = deg => deg * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function refreshStudentGPS() {
    const gpsText = document.getElementById('gps-status-text');
    if (gpsText) gpsText.innerHTML = 'Memperbarui koordinat GPS...';

    if (!navigator.geolocation) {
        if (gpsText) gpsText.innerHTML = '<span class="text-rose-600 font-semibold">Geolocation tidak didukung browser.</span>';
        window._currentLatLon = { latitude: -6.2000, longitude: 106.8166, accuracy: 5 };
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const accuracy = pos.coords.accuracy;

            window._currentLatLon = { latitude: lat, longitude: lng, accuracy: accuracy };

            try {
                const response = await fetch('/api/system-settings/location');
                const data = await response.json();
                const settings = data.settings || {};
                const schoolLat = Number(settings.schoolLatitude || -6.2000);
                const schoolLng = Number(settings.schoolLongitude || 106.8166);
                const radius = Number(settings.geofenceRadius || 100);

                const distance = calculateDistanceMeters(lat, lng, schoolLat, schoolLng);
                const distanceRounded = Math.round(distance);

                if (gpsText) {
                    if (distance <= radius) {
                        gpsText.innerHTML = `<span class="text-emerald-600 font-semibold">✓ Lokasi berada dalam radius sekolah</span><br>Lat: <b>${lat.toFixed(5)}</b>, Lng: <b>${lng.toFixed(5)}</b><br><span class="text-emerald-600 font-semibold">Jarak: ${distanceRounded} meter (Radius: ${radius} meter)</span>`;
                    } else {
                        gpsText.innerHTML = `<span class="text-rose-600 font-bold">✕ Lokasi berada DI LUAR radius sekolah</span><br>Lat: <b>${lat.toFixed(5)}</b>, Lng: <b>${lng.toFixed(5)}</b><br><span class="text-rose-600 font-bold">Jarak: ${distanceRounded} meter (Radius: ${radius} meter)</span>`;
                    }
                }
            } catch (err) {
                if (gpsText) gpsText.innerHTML = `Lat: <b>${lat.toFixed(5)}</b>, Lng: <b>${lng.toFixed(5)}</b>`;
            }
        },
        err => {
            console.warn('GPS location issue:', err);
            window._currentLatLon = { latitude: -6.2000, longitude: 106.8166, accuracy: 10 };
            if (gpsText) gpsText.innerHTML = `Lat: <b>-6.2000</b>, Lng: <b>106.8166</b> (Default Mode)`;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function captureStudentSelfie() {
    const video = document.getElementById('student-webcam');
    const canvas = document.getElementById('student-canvas');
    const preview = document.getElementById('student-photo-preview');
    const btnTake = document.getElementById('btn-take-photo');
    const btnSubmit = document.getElementById('btn-submit-attendance');

    if (!canvas) return;
    
    // High quality HD photo capture (Max dimension 800px, JPEG quality 0.82)
    const maxWidth = 800;
    const maxHeight = 800;
    let width = (video && video.videoWidth) ? video.videoWidth : 800;
    let height = (video && video.videoHeight) ? video.videoHeight : 600;

    if (width > height) {
        if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
        }
    } else {
        if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
        }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (video) {
        ctx.drawImage(video, 0, 0, width, height);
    }
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);

    window._capturedSelfieData = dataUrl;
    if (preview) { preview.src = dataUrl; preview.classList.remove('hidden'); }
    if (video) video.classList.add('hidden');
    if (btnTake) {
        btnTake.innerHTML = `<i class="fa-solid fa-repeat"></i><span>Ulangi Foto</span>`;
        btnTake.onclick = retakeStudentSelfie;
    }
    if (btnSubmit) btnSubmit.classList.remove('hidden');
    showToast('Foto selfie berhasil diambil & dikompres otomatis!', 'success');
}

function retakeStudentSelfie() {
    const video = document.getElementById('student-webcam');
    const preview = document.getElementById('student-photo-preview');
    const btnTake = document.getElementById('btn-take-photo');
    const btnSubmit = document.getElementById('btn-submit-attendance');

    if (preview) preview.classList.add('hidden');
    if (video) video.classList.remove('hidden');
    window._capturedSelfieData = null;
    if (btnTake) {
        btnTake.innerHTML = `<i class="fa-solid fa-camera"></i><span>Ambil Foto Selfie</span>`;
        btnTake.onclick = captureStudentSelfie;
    }
    if (btnSubmit) btnSubmit.classList.add('hidden');
}

async function submitStudentAttendance() {
    const requireSelfie = appState.settings?.requireSelfie !== false;
    const requireGps = appState.settings?.requireGps !== false;

    if (requireSelfie && !window._capturedSelfieData) {
        showToast('Wajib mengambil foto selfie terlebih dahulu!', 'error');
        return;
    }

    const currentUser = appState.currentUser;
    if (!currentUser) { showToast('Sesi siswa tidak ditemukan.', 'error'); return; }

    const gpsPoint = window._currentLatLon;
    const hasValidGps = !!gpsPoint &&
        Number.isFinite(Number(gpsPoint.latitude)) &&
        Number.isFinite(Number(gpsPoint.longitude));
    if (requireGps && !hasValidGps) {
        showToast('GPS belum tersedia atau tidak valid. Aktifkan lokasi lalu coba lagi.', 'error');
        return;
    }

    // Validate GPS Radius geofence before submitting
    let isOutsideRadius = false;
    let distanceRounded = 0;
    let radius = 100;
    try {
        const response = await fetch('/api/system-settings/location');
        const data = await response.json();
        const settings = data.settings || {};
        const schoolLat = Number(settings.schoolLatitude || -6.2000);
        const schoolLng = Number(settings.schoolLongitude || 106.8166);
        radius = Number(settings.geofenceRadius || 100);

        const currentLat = window._currentLatLon ? window._currentLatLon.latitude : -6.2000;
        const currentLng = window._currentLatLon ? window._currentLatLon.longitude : 106.8166;

        const distance = calculateDistanceMeters(currentLat, currentLng, schoolLat, schoolLng);
        distanceRounded = Math.round(distance);
        if (distance > radius) {
            isOutsideRadius = true;
        }
    } catch (err) {
        console.error('Error validating GPS location:', err);
    }

    if (requireGps && isOutsideRadius) {
        showToast(`Wajib GPS: Lokasi diluar radius! Jarak Anda: ${distanceRounded} meter (Maksimal radius: ${radius} meter). Absensi tidak dapat dikirim.`, 'error');
        return;
    }

    const student = (appState.students || []).find(s => 
        (currentUser.username && String(s.username).trim().toLowerCase() === String(currentUser.username).trim().toLowerCase()) ||
        (currentUser.id && String(s.id) === String(currentUser.id))
    ) || currentUser;
    const studentId = student.id || currentUser.id;
    const studentClassId = student.classId || student.class_id || currentUser.classId || currentUser.class_id || 'C1';
    const selectedSubjectId = appState.activeStudentAttendanceSubjectId || '';
    const todayIso = new Date().toISOString().split('T')[0];
    const chosenDate = todayIso;

    const attendanceData = {
        studentId: studentId,
        classId: studentClassId,
        subjectId: selectedSubjectId,
        date: chosenDate,
        status: 'HADIR',
        location: hasValidGps ? `${Number(gpsPoint.latitude)}, ${Number(gpsPoint.longitude)}` : '',
        photo: window._capturedSelfieData,
        note: ''
    };

    try {
        const response = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attendanceData)
        });

        const data = await response.json();
        if (response.status === 409 && data.already_attended) {
            showToast(data.message || 'Anda sudah melakukan absensi hari ini.', 'error');
            return;
        }

        if (!response.ok || !data.success) {
            showToast(data.message || 'Gagal menyimpan absensi.', 'error');
            return;
        }

        showToast('Absensi berhasil disimpan!', 'success');
        if (!Array.isArray(appState.attendance)) appState.attendance = [];
        appState.attendance.push(data.attendance);

        window._capturedSelfieData = null;

        renderStudentAttendance(document.getElementById('view-container'));
    } catch (err) {
        console.error('Error attendance:', err);
        showToast('Absensi berhasil disimpan ke mode lokal!', 'success');
        appState.attendance.push(attendanceData);
        saveState('attendance');
        renderStudentAttendance(document.getElementById('view-container'));
    }
}

// Teacher Attendance Functions
function renderTeacherAttendance(container) {
    // Dynamically fetch the latest settings in the background to ensure real-time synchronization
    if (!window._isFetchingSettingsForTeacher) {
        window._isFetchingSettingsForTeacher = true;
        fetch('/api/settings')
            .then(r => r.json())
            .then(data => {
                window._isFetchingSettingsForTeacher = false;
                if (data && data.success && data.settings) {
                    const oldVal = appState.settings?.teacherAllowDatePicker;
                    appState.settings = { ...appState.settings, ...data.settings };
                    // Save to local storage to maintain consistency
                    localStorage.setItem('madrasah_settings', JSON.stringify(appState.settings));
                    
                    // If the setting changed, re-render to reflect immediately
                    const newVal = appState.settings?.teacherAllowDatePicker;
                    if (String(oldVal) !== String(newVal)) {
                        renderTeacherAttendance(container);
                    }
                }
            })
            .catch(() => {
                window._isFetchingSettingsForTeacher = false;
            });
    }

    const tch = appState.currentUser && appState.currentUser.id 
        ? (appState.teachers.find(t => String(t.id) === String(appState.currentUser.id)) || appState.currentUser)
        : appState.teachers[0] || {};
    const today = new Date().toISOString().split('T')[0];
    const isAllowDatePicker = appState.settings && (appState.settings.teacherAllowDatePicker === true || appState.settings.teacherAllowDatePicker === 'true');
    const selectedDate = isAllowDatePicker ? (window._activeTeacherSelectedDate || today) : today;
    const selectedType = window._activeTeacherSelectedType || 'MASUK';
    const alreadySubmitted = (appState.teacherAttendance || []).find(a => 
        String(a.teacherId) === String(tch.id) && 
        String(a.date).substring(0, 10) === selectedDate && 
        (a.type || 'MASUK') === selectedType
    );

    let innerHtml = `
        <div class="space-y-6 max-w-xl mx-auto pb-8 animate-fade-in">
            <div class="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-6 text-center">
                <div>
                    <span class="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">Absensi Mandiri Dewan Guru</span>
                    <h1 class="text-xl sm:text-2xl font-bold text-slate-800 mt-2">Absen Selfie & Geotagging GPS</h1>
                    <p class="text-xs text-slate-400 mt-1">Sistem akan memvalidasi koordinat lokasi Anda dengan radius sekolah.</p>

                    <div class="mt-5 p-4 bg-slate-50 rounded-2xl border text-left space-y-2">
                        <div class="flex justify-between items-center"><span class="text-xs text-slate-500">Nama Guru</span><span class="text-xs font-bold text-slate-700">${tch.name || '-'}</span></div>
                        <div class="flex justify-between items-center"><span class="text-xs text-slate-500">NIP</span><span class="text-xs font-mono font-bold text-slate-700">${tch.nip || '-'}</span></div>
                        <div class="flex justify-between items-center"><span class="text-xs text-slate-500">Mata Pelajaran</span><span class="text-xs font-bold text-emerald-700">${(tch.mapel || []).join(', ') || '-'}</span></div>
                    </div>
                </div>

                <!-- Tipe Absensi Selector -->
                <div class="space-y-2 text-left">
                    <label class="block text-xs font-bold text-slate-700 uppercase">Tipe Absensi Guru</label>
                    <div class="grid grid-cols-2 gap-2">
                        <button type="button" onclick="window._activeTeacherSelectedType = 'MASUK'; renderTeacherAttendance(document.getElementById('view-container'));" class="py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition border ${selectedType === 'MASUK' ? 'bg-emerald-600 text-white border-emerald-600 shadow' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}">
                            <i class="fa-solid fa-sign-in-alt"></i> Absen Masuk
                        </button>
                        <button type="button" onclick="window._activeTeacherSelectedType = 'PULANG'; renderTeacherAttendance(document.getElementById('view-container'));" class="py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition border ${selectedType === 'PULANG' ? 'bg-indigo-600 text-white border-indigo-600 shadow' : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'}">
                            <i class="fa-solid fa-sign-out-alt"></i> Absen Pulang
                        </button>
                    </div>
                </div>

                <!-- Pilihan Tanggal & Waktu (Jika diizinkan) -->
                ${isAllowDatePicker ? `
                <div class="p-4 bg-emerald-50 rounded-2xl border border-emerald-100 text-left space-y-3">
                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Tanggal Absensi</label>
                            <input type="date" id="teacher-attendance-date" value="${selectedDate}" onchange="window._activeTeacherSelectedDate = this.value; renderTeacherAttendance(document.getElementById('view-container'));" class="w-full px-4 py-2.5 bg-white border border-emerald-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        </div>
                        <div>
                            <label class="block text-[11px] font-bold text-slate-500 uppercase mb-1">Waktu Absensi</label>
                            <input type="time" id="teacher-attendance-time" value="${window._activeTeacherSelectedTime || (String(new Date().getHours()).padStart(2, '0') + ':' + String(new Date().getMinutes()).padStart(2, '0'))}" onchange="window._activeTeacherSelectedTime = this.value;" class="w-full px-4 py-2.5 bg-white border border-emerald-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                        </div>
                    </div>
                </div>
                ` : ''}

                <!-- Dynamic Action Area -->
                ${alreadySubmitted ? `
                    <div class="py-6 space-y-4 text-center">
                        <div class="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl mx-auto flex items-center justify-center text-2xl shadow animate-scale-up">
                            <i class="fa-solid fa-circle-check"></i>
                        </div>
                        <div>
                            <h2 class="text-lg font-bold text-slate-800">Anda Sudah Absen ${selectedType === 'MASUK' ? 'Masuk' : 'Pulang'}</h2>
                            <p class="text-xs text-slate-400 mt-1">Tanggal: ${selectedDate} ${alreadySubmitted.time ? '| Jam: ' + alreadySubmitted.time : ''} | Status: <b>${alreadySubmitted.status}</b></p>
                        </div>
                        <div class="p-4 bg-slate-50 rounded-2xl text-xs space-y-1 text-left border">
                            <p class="font-semibold text-slate-700"><i class="fa-solid fa-location-dot text-emerald-600 mr-1.5"></i>Lokasi Tercatat:</p>
                            <p class="text-slate-500 font-mono">${alreadySubmitted.location || '-6.2000, 106.8166'}</p>
                        </div>
                    </div>
                ` : `
                    <div class="space-y-6">
                        <div class="w-full h-64 bg-slate-900 text-white rounded-3xl flex flex-col items-center justify-center space-y-2 relative overflow-hidden shadow-inner">
                            <video id="teacher-webcam" autoplay muted playsinline class="w-full h-full object-cover" style="transform: scaleX(-1);"></video>
                            <canvas id="teacher-canvas" class="hidden"></canvas>
                            <img id="teacher-photo-preview" class="w-full h-full object-cover hidden" alt="Preview Selfie" style="transform: scaleX(-1);">
                            <div id="teacher-cam-placeholder" class="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white p-4">
                                <i class="fa-solid fa-spinner fa-spin text-3xl text-emerald-400 mb-2"></i>
                                <p class="text-xs text-emerald-200 font-semibold">Memuat & Mengakses Kamera...</p>
                            </div>
                        </div>

                        <div class="p-4 bg-slate-50 rounded-2xl text-xs space-y-2 text-left border">
                            <div class="flex justify-between items-center">
                                <div>
                                    <p class="font-semibold text-slate-700"><i class="fa-solid fa-location-dot text-emerald-600 mr-1.5"></i>Status Lokasi GPS:</p>
                                    <p id="teacher-gps-status-text" class="text-slate-500 font-mono">Mendeteksi koordinat GPS...</p>
                                </div>
                                <button type="button" onclick="refreshTeacherGPS()" class="px-3 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-semibold shadow hover:bg-emerald-700 transition">
                                    <i class="fa-solid fa-crosshairs mr-1"></i> Konfigurasi GPS
                                </button>
                            </div>
                        </div>

                        <div id="teacher-attendance-action-area" class="space-y-3">
                            <button type="button" id="btn-teacher-submit-attendance" onclick="submitTeacherAttendance()" class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-2xl text-sm shadow transition hidden flex items-center justify-center space-x-2">
                                <i class="fa-solid fa-paper-plane"></i><span>Kirim Absen ${selectedType === 'MASUK' ? 'Masuk' : 'Pulang'}</span>
                            </button>
                            <button type="button" id="btn-teacher-take-photo" onclick="captureTeacherSelfie()" class="w-full py-3.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-2xl text-sm shadow transition flex items-center justify-center space-x-2">
                                <i class="fa-solid fa-camera"></i><span>Ambil Foto Selfie</span>
                            </button>
                        </div>
                    </div>
                `}
            </div>
        </div>
    `;

    container.innerHTML = innerHtml;
    
    if (!alreadySubmitted) {
        initTeacherWebcamAndGPS();
    }
}

function initTeacherWebcamAndGPS() {
    const video = document.getElementById('teacher-webcam');
    const placeholder = document.getElementById('teacher-cam-placeholder');

    if (window.teacherAttendanceStream) {
        try {
            window.teacherAttendanceStream.getTracks().forEach(t => t.stop());
        } catch(e) {}
        window.teacherAttendanceStream = null;
    }

    if (placeholder) {
        placeholder.style.display = 'flex';
        placeholder.innerHTML = `
            <i class="fa-solid fa-spinner fa-spin text-3xl text-emerald-400 mb-2"></i>
            <p class="text-xs text-emerald-200 font-semibold">Memuat & Mengakses Kamera...</p>
        `;
    }

    window.requestCameraStream()
        .then(stream => {
            window.teacherAttendanceStream = stream;
            if (video) {
                video.srcObject = stream;
                video.muted = true;
                video.play().catch(e => console.warn('Teacher video play err:', e));
            }
            if (placeholder) placeholder.style.display = 'none';
        })
        .catch(err => {
            const errInfo = window.getCameraErrorMessage(err);
            if (placeholder) {
                placeholder.style.display = 'flex';
                placeholder.innerHTML = `
                    <div class="p-3 text-center space-y-2 max-w-xs">
                        <i class="fa-solid fa-triangle-exclamation text-rose-400 text-2xl"></i>
                        <p class="text-xs font-bold text-rose-300">${errInfo.msg}</p>
                        <p class="text-[10px] text-slate-300 leading-tight">${errInfo.solution}</p>
                        <div class="pt-1 flex flex-col gap-1.5">
                            <button type="button" onclick="initTeacherWebcamAndGPS()" class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow cursor-pointer">
                                <i class="fa-solid fa-arrows-rotate mr-1"></i> Coba Buka Kamera Lagi
                            </button>
                            <label class="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl text-xs font-semibold shadow cursor-pointer inline-flex items-center justify-center">
                                <i class="fa-solid fa-upload mr-1"></i> Upload Foto dari HP/File
                                <input type="file" accept="image/*" capture="user" class="hidden" onchange="handleTeacherSelfieUpload(event)">
                            </label>
                        </div>
                    </div>
                `;
            }
        });

    refreshTeacherGPS();
}

window.handleTeacherSelfieUpload = function(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxWidth = 800;
            const maxHeight = 800;
            let width = img.width;
            let height = img.height;

            if (width > height) {
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width);
                    width = maxWidth;
                }
            } else {
                if (height > maxHeight) {
                    width = Math.round((width * maxHeight) / height);
                    height = maxHeight;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
            window._capturedSelfieData = dataUrl;

            const preview = document.getElementById('teacher-photo-preview');
            const video = document.getElementById('teacher-webcam');
            const placeholder = document.getElementById('teacher-cam-placeholder');
            const btnTake = document.getElementById('btn-teacher-take-photo');
            const btnSubmit = document.getElementById('btn-teacher-submit-attendance');

            if (placeholder) placeholder.style.display = 'none';
            if (video) video.classList.add('hidden');
            if (preview) { preview.src = dataUrl; preview.classList.remove('hidden'); }
            if (btnTake) {
                btnTake.innerHTML = `<i class="fa-solid fa-repeat mr-1"></i><span>Ulangi Foto</span>`;
                btnTake.onclick = retakeTeacherSelfie;
            }
            if (btnSubmit) btnSubmit.classList.remove('hidden');
            showToast('Foto dari galeri/kamera berhasil diunggah!', 'success');
        };
        img.src = evt.target.result;
    };
    reader.readAsDataURL(file);
};

function refreshTeacherGPS() {
    const gpsText = document.getElementById('teacher-gps-status-text');
    if (gpsText) gpsText.innerHTML = 'Memperbarui koordinat GPS...';

    if (!navigator.geolocation) {
        if (gpsText) gpsText.innerHTML = '<span class="text-rose-600 font-semibold">Geolocation tidak didukung browser.</span>';
        window._currentTeacherLatLon = { latitude: -6.2000, longitude: 106.8166, accuracy: 5 };
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async pos => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const accuracy = pos.coords.accuracy;

            window._currentTeacherLatLon = { latitude: lat, longitude: lng, accuracy: accuracy };

            try {
                const response = await fetch('/api/system-settings/location');
                const data = await response.json();
                const settings = data.settings || {};
                const schoolLat = Number(settings.schoolLatitude || -6.2000);
                const schoolLng = Number(settings.schoolLongitude || 106.8166);
                const radius = Number(settings.geofenceRadius || 100);

                const distance = calculateDistanceMeters(lat, lng, schoolLat, schoolLng);
                const distanceRounded = Math.round(distance);

                if (gpsText) {
                    if (distance <= radius) {
                        gpsText.innerHTML = `<span class="text-emerald-600 font-semibold">✓ Lokasi berada dalam radius sekolah</span><br>Lat: <b>${lat.toFixed(5)}</b>, Lng: <b>${lng.toFixed(5)}</b><br><span class="text-emerald-600 font-semibold">Jarak: ${distanceRounded} meter (Radius: ${radius} meter)</span>`;
                    } else {
                        gpsText.innerHTML = `<span class="text-rose-600 font-bold">✕ Lokasi berada DI LUAR radius sekolah</span><br>Lat: <b>${lat.toFixed(5)}</b>, Lng: <b>${lng.toFixed(5)}</b><br><span class="text-rose-600 font-bold">Jarak: ${distanceRounded} meter (Radius: ${radius} meter)</span>`;
                    }
                }
            } catch (err) {
                if (gpsText) gpsText.innerHTML = `Lat: <b>${lat.toFixed(5)}</b>, Lng: <b>${lng.toFixed(5)}</b>`;
            }
        },
        err => {
            console.warn('GPS location issue:', err);
            window._currentTeacherLatLon = { latitude: -6.2000, longitude: 106.8166, accuracy: 10 };
            if (gpsText) gpsText.innerHTML = `Lat: <b>-6.2000</b>, Lng: <b>106.8166</b> (Default Mode)`;
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
}

function captureTeacherSelfie() {
    const video = document.getElementById('teacher-webcam');
    const canvas = document.getElementById('teacher-canvas');
    const preview = document.getElementById('teacher-photo-preview');
    const btnTake = document.getElementById('btn-teacher-take-photo');
    const btnSubmit = document.getElementById('btn-teacher-submit-attendance');

    if (!canvas) return;
    
    // Compress photo for teachers to ~100kb (max dimension 640px, quality 0.70)
    // Resizing to 640x480 at 0.70 quality provides an extremely clear (jernih) and sharp result
    // while keeping the file size consistently around 70kb - 95kb.
    const maxWidth = 640;
    const maxHeight = 640;
    let width = (video && video.videoWidth) ? video.videoWidth : 640;
    let height = (video && video.videoHeight) ? video.videoHeight : 480;

    if (width > height) {
        if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
        }
    } else {
        if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
        }
    }

    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    
    if (video) {
        ctx.drawImage(video, 0, 0, width, height);
    }
    
    const dataUrl = canvas.toDataURL('image/jpeg', 0.70);

    window._capturedTeacherSelfieData = dataUrl;
    if (preview) { preview.src = dataUrl; preview.classList.remove('hidden'); }
    if (video) video.classList.add('hidden');
    if (btnTake) {
        btnTake.innerHTML = `<i class="fa-solid fa-repeat"></i><span>Ulangi Foto</span>`;
        btnTake.onclick = retakeTeacherSelfie;
    }
    if (btnSubmit) btnSubmit.classList.remove('hidden');
    showToast('Foto selfie berhasil diambil!', 'success');
}

function retakeTeacherSelfie() {
    const video = document.getElementById('teacher-webcam');
    const preview = document.getElementById('teacher-photo-preview');
    const btnTake = document.getElementById('btn-teacher-take-photo');
    const btnSubmit = document.getElementById('btn-teacher-submit-attendance');

    if (preview) preview.classList.add('hidden');
    if (video) video.classList.remove('hidden');
    window._capturedTeacherSelfieData = null;
    if (btnTake) {
        btnTake.innerHTML = `<i class="fa-solid fa-camera"></i><span>Ambil Foto Selfie</span>`;
        btnTake.onclick = captureTeacherSelfie;
    }
    if (btnSubmit) btnSubmit.classList.add('hidden');
}

async function submitTeacherAttendance() {
    if (!window._capturedTeacherSelfieData) {
        showToast('Ambil foto selfie terlebih dahulu!', 'error');
        return;
    }

    const currentUser = appState.currentUser;
    if (!currentUser) { showToast('Sesi guru tidak ditemukan.', 'error'); return; }

    let isOutsideRadius = false;
    let distanceRounded = 0;
    let radius = 100;
    try {
        const response = await fetch('/api/system-settings/location');
        const data = await response.json();
        const settings = data.settings || {};
        const schoolLat = Number(settings.schoolLatitude || -6.2000);
        const schoolLng = Number(settings.schoolLongitude || 106.8166);
        radius = Number(settings.geofenceRadius || 100);

        const currentLat = window._currentTeacherLatLon ? window._currentTeacherLatLon.latitude : -6.2000;
        const currentLng = window._currentTeacherLatLon ? window._currentTeacherLatLon.longitude : 106.8166;

        const distance = calculateDistanceMeters(currentLat, currentLng, schoolLat, schoolLng);
        distanceRounded = Math.round(distance);
        if (distance > radius) {
            isOutsideRadius = true;
        }
    } catch (err) {
        console.error('Error validating GPS location:', err);
    }

    if (isOutsideRadius) {
        showToast(`Lokasi diluar radius! Jarak Anda: ${distanceRounded} meter (Maksimal radius: ${radius} meter). Absensi tidak dapat dikirim.`, 'error');
        return;
    }

    const teacher = (appState.teachers || []).find(t => String(t.username).trim().toLowerCase() === String(currentUser.username).trim().toLowerCase()) || currentUser;
    const teacherId = teacher.id;

    let attendanceDate = new Date().toISOString().split('T')[0];
    let customTime = null;
    const isAllowDatePicker = appState.settings && (appState.settings.teacherAllowDatePicker === true || appState.settings.teacherAllowDatePicker === 'true');
    if (isAllowDatePicker) {
        if (window._activeTeacherSelectedDate) {
            attendanceDate = window._activeTeacherSelectedDate;
        }
        if (window._activeTeacherSelectedTime) {
            customTime = window._activeTeacherSelectedTime;
        }
    }

    const selectedType = window._activeTeacherSelectedType || 'MASUK';

    const attendanceData = {
        teacherId: teacherId,
        date: attendanceDate,
        status: 'HADIR',
        location: window._currentTeacherLatLon ? `${window._currentTeacherLatLon.latitude}, ${window._currentTeacherLatLon.longitude}` : '-6.2000, 106.8166',
        photo: window._capturedTeacherSelfieData,
        note: isOutsideRadius ? `Luar Radius (${distanceRounded}m)` : `Hadir (${distanceRounded}m)`,
        type: selectedType,
        time: customTime
    };

    try {
        const response = await fetch('/api/teacher-attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(attendanceData)
        });

        const data = await response.json();
        if (response.status === 409 && data.already_attended) {
            showToast(data.message || `Anda sudah melakukan absensi ${selectedType === 'PULANG' ? 'pulang' : 'masuk'} hari ini.`, 'error');
            return;
        }

        if (!response.ok || !data.success) {
            showToast(data.message || 'Gagal menyimpan absensi.', 'error');
            return;
        }

        showToast('Absensi guru berhasil disimpan!', 'success');
        if (!Array.isArray(appState.teacherAttendance)) appState.teacherAttendance = [];
        appState.teacherAttendance.push(data.teacherAttendance);

        window._capturedTeacherSelfieData = null;
        renderTeacherAttendance(document.getElementById('view-container'));
    } catch (err) {
        console.error('Error teacher attendance:', err);
        showToast('Absensi berhasil disimpan ke mode lokal!', 'success');
        if (!Array.isArray(appState.teacherAttendance)) appState.teacherAttendance = [];
        const fallbackAtt = {
            id: 'TATT_LOCAL_' + Date.now(),
            ...attendanceData,
            createdAt: new Date().toISOString()
        };
        appState.teacherAttendance.push(fallbackAtt);
        localStorage.setItem('madrasah_teacher_attendance', JSON.stringify(appState.teacherAttendance));
        renderTeacherAttendance(document.getElementById('view-container'));
    }
}

// Exports for window
window.closeModal = closeModal;
window.confirmStudentAttendanceSubject = confirmStudentAttendanceSubject;
window.renderStudentProfile = renderStudentProfile;
window.uploadStudentPhoto = uploadStudentPhoto;
window.saveStudentProfileUpdate = saveStudentProfileUpdate;
window.renderStudentAttendance = renderStudentAttendance;
window.refreshStudentGPS = refreshStudentGPS;
window.captureStudentSelfie = captureStudentSelfie;
window.retakeStudentSelfie = retakeStudentSelfie;
window.submitStudentAttendance = submitStudentAttendance;
window.initStudentWebcamAndGPS = initStudentWebcamAndGPS;
window.renderTeacherAttendance = renderTeacherAttendance;
window.refreshTeacherGPS = refreshTeacherGPS;
window.captureTeacherSelfie = captureTeacherSelfie;
window.retakeTeacherSelfie = retakeTeacherSelfie;
window.submitTeacherAttendance = submitTeacherAttendance;
window.initTeacherWebcamAndGPS = initTeacherWebcamAndGPS;
window.exportToExcel = exportToExcel;
window.exportToPDF = exportToPDF;

// Global Photo Popup Modal Function
function showPhotoPopup(photoUrl, title) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-fade-in">
            <div class="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-100 transform scale-95 transition-transform duration-300 relative" onclick="event.stopPropagation()">
                <div class="p-6 flex items-center justify-between border-b border-slate-100">
                    <h3 class="text-sm font-bold text-slate-800">${title || 'Foto Lampiran'}</h3>
                    <button type="button" onclick="closeModal()" class="w-8 h-8 rounded-full bg-slate-50 text-slate-500 hover:bg-slate-100 flex items-center justify-center transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                <div class="p-6 flex items-center justify-center bg-slate-900 h-96">
                    <img src="${window.getPhotoHtmlSrc ? window.getPhotoHtmlSrc(photoUrl) : ''}" class="max-w-full max-h-full object-contain rounded-2xl shadow-lg animate-scale-up" alt="Foto Besar" referrerPolicy="no-referrer">
                </div>
                <div class="p-4 bg-slate-50 flex justify-end">
                    <button type="button" onclick="closeModal()" class="px-5 py-2.5 bg-slate-850 hover:bg-slate-900 text-white font-semibold rounded-xl text-xs transition shadow cursor-pointer">Tutup</button>
                </div>
            </div>
        </div>
    `;
}

// Teacher Attendance Admin Dashboard
function renderTeacherAttendanceAdmin(container) {
    const today = new Date().toISOString().split('T')[0];
    const teacherAttendance = appState.teacherAttendance || [];
    const teachers = appState.teachers || [];

    let selectedTeacherDate = localStorage.getItem('madrasah_activeTeacherAttendanceDate') || today;
    if (!localStorage.getItem('madrasah_activeTeacherAttendanceDate')) {
        const hasToday = teacherAttendance.some(a => String(a.date).substring(0, 10) === today);
        if (!hasToday && teacherAttendance.length > 0) {
            const sortedDates = Array.from(new Set(teacherAttendance.map(a => String(a.date).substring(0, 10)).filter(Boolean))).sort().reverse();
            selectedTeacherDate = sortedDates[0] || today;
        }
    }

    container.innerHTML = `
        <div class="space-y-6 pb-8 animate-fade-in">
            <!-- Header Block -->
            <div class="bg-white p-6 sm:p-8 rounded-3xl shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <span class="px-3 py-1 bg-emerald-50 text-emerald-700 rounded-full text-xs font-semibold">Panel Admin</span>
                    <h1 class="text-xl sm:text-2xl font-bold text-slate-800 mt-1">Laporan Absensi Dewan Guru</h1>
                    <p class="text-xs text-slate-400 mt-0.5">Pantau absensi mandiri, verifikasi geotagging lokasi, dan foto selfie wajah para guru.</p>
                </div>
                <div class="flex items-center gap-3">
                    <button type="button" onclick="refreshTeacherAttendanceData(this)" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white rounded-xl text-xs font-semibold shadow transition flex items-center gap-1.5 cursor-pointer">
                        <i class="fa-solid fa-arrows-rotate"></i> Refresh Data
                    </button>
                    <input type="date" id="filter-teacher-date" value="${selectedTeacherDate}" onchange="if (window.safeSetLocalStorage) safeSetLocalStorage('madrasah_activeTeacherAttendanceDate', this.value); filterTeacherAttendance();" class="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <button type="button" onclick="exportTeacherAttendance()" class="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold shadow transition flex items-center gap-1.5">
                        <i class="fa-solid fa-file-excel"></i> Export Excel
                    </button>
                </div>
            </div>

            <!-- Stats Bar -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div class="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between shadow-xs">
                    <div>
                        <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total Dewan Guru</p>
                        <h3 class="text-xl font-extrabold text-slate-800 mt-1" id="stat-total-teachers">${teachers.length} Guru</h3>
                    </div>
                    <div class="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center"><i class="fa-solid fa-chalkboard-user"></i></div>
                </div>
                <div class="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between shadow-xs">
                    <div>
                        <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Hadir Hari Ini</p>
                        <h3 class="text-xl font-extrabold text-emerald-600 mt-1" id="stat-present-teachers">0 Guru</h3>
                    </div>
                    <div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center"><i class="fa-solid fa-user-check"></i></div>
                </div>
                <div class="bg-white p-5 rounded-2xl border border-slate-100 flex items-center justify-between shadow-xs">
                    <div>
                        <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Belum Presensi</p>
                        <h3 class="text-xl font-extrabold text-rose-500 mt-1" id="stat-absent-teachers">0 Guru</h3>
                    </div>
                    <div class="w-10 h-10 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center"><i class="fa-solid fa-user-clock"></i></div>
                </div>
            </div>

            <!-- List Table -->
            <div class="bg-white rounded-3xl border border-slate-200/80 overflow-hidden shadow-sm">
                <div class="p-6 border-b border-slate-100 flex items-center justify-between">
                    <h2 class="text-sm font-bold text-slate-800">Daftar Kehadiran Guru</h2>
                    <span class="text-xs text-slate-400" id="table-date-indicator">Hari Ini: ${today}</span>
                </div>
                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse text-xs" id="teacher-attendance-admin-table">
                        <thead>
                            <tr class="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-bold text-[10px] tracking-wider">
                                <th class="p-4">Nama Guru / NIP</th>
                                <th class="p-4">Mata Pelajaran</th>
                                <th class="p-4 border-l border-slate-200 bg-emerald-50/40 text-emerald-800 text-center">Absen Masuk (Check-In)</th>
                                <th class="p-4 border-l border-slate-200 bg-indigo-50/40 text-indigo-800 text-center">Absen Pulang (Check-Out)</th>
                            </tr>
                        </thead>
                        <tbody id="teacher-attendance-admin-tbody">
                            <!-- Populated dynamically -->
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    // Populate data
    filterTeacherAttendance();
}

function filterTeacherAttendance() {
    const filterDate = document.getElementById('filter-teacher-date')?.value || new Date().toISOString().split('T')[0];
    const tbody = document.getElementById('teacher-attendance-admin-tbody');
    const tableDateIndicator = document.getElementById('table-date-indicator');
    
    if (tableDateIndicator) {
        tableDateIndicator.innerText = `Tanggal Terpilih: ${filterDate}`;
    }

    if (!tbody) return;

    const teachers = appState.teachers || [];
    const atts = appState.teacherAttendance || [];

    // Filter attendances for selected date
    const dailyAtts = atts.filter(a => String(a.date).substring(0, 10) === filterDate);
    
    // Count teachers who have any attendance record today
    const presentTeachers = new Set();
    dailyAtts.forEach(a => {
        if (a.status && a.status !== 'BELUM PRESENSI') {
            presentTeachers.add(String(a.teacherId));
        }
    });
    const presentCount = presentTeachers.size;
    const absentCount = Math.max(0, teachers.length - presentCount);

    const statPresent = document.getElementById('stat-present-teachers');
    const statAbsent = document.getElementById('stat-absent-teachers');
    if (statPresent) statPresent.innerText = `${presentCount} Guru`;
    if (statAbsent) statAbsent.innerText = `${absentCount} Guru`;

    if (teachers.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="p-8 text-center text-slate-400">
                    <i class="fa-solid fa-user-slash text-2xl mb-2.5 text-slate-300"></i>
                    <p class="font-medium">Data dewan guru tidak ditemukan di sistem.</p>
                </td>
            </tr>
        `;
        return;
    }

    function getAttCellHtml(teacher, filterDate, att, type) {
        if (!att) {
            return `
                <td class="p-4 border-l border-slate-100 text-center">
                    <div class="flex flex-col items-center gap-1.5 justify-center">
                        <span class="text-[10px] text-slate-400 font-medium italic">Belum Presensi</span>
                        <select onchange="updateTeacherAttendanceAdmin('${teacher.id}', '${filterDate}', this.value, '${type}', this)" class="px-2 py-1 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold cursor-pointer hover:bg-slate-100 transition shadow-xs text-slate-500">
                            <option value="BELUM PRESENSI" selected>Set Absen</option>
                            <option value="HADIR">HADIR</option>
                            <option value="IZIN">IZIN</option>
                            <option value="SAKIT">SAKIT</option>
                            <option value="ALPA">ALPA</option>
                        </select>
                    </div>
                </td>
            `;
        }

        const currentStatus = att.status || 'HADIR';
        const timeStr = att.time ? att.time + ' WIB' : (att.createdAt ? new Date(att.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB' : '07:30 WIB');
        const locStr = att.location || '';
        const mapUrl = locStr && locStr !== 'Input Admin' ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locStr)}` : '#';
        
        let photoHtml = `
            <div class="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                <i class="fa-solid fa-user text-[10px]"></i>
            </div>
        `;
        if (att.photo) {
            photoHtml = `
                <div class="w-8 h-8 rounded-lg border border-slate-200 overflow-hidden cursor-pointer shadow-xs hover:scale-105 transition" onclick="showPhotoPopup('${att.photo}', 'Foto Selfie ${type === 'MASUK' ? 'Masuk' : 'Pulang'} - ${teacher.name}')">
                    <img src="${window.getPhotoHtmlSrc ? window.getPhotoHtmlSrc(att.photo) : ''}" class="w-full h-full object-cover" referrerPolicy="no-referrer">
                </div>
            `;
        }

        let statusHtml = `
            <select onchange="updateTeacherAttendanceAdmin('${teacher.id}', '${filterDate}', this.value, '${type}', this)" class="px-2 py-0.5 border rounded-lg text-[10px] font-bold cursor-pointer transition shadow-xs ${currentStatus === 'HADIR' ? 'bg-emerald-50 text-emerald-700 border-emerald-300' : (currentStatus === 'IZIN' ? 'bg-blue-50 text-blue-700 border-blue-300' : (currentStatus === 'SAKIT' ? 'bg-amber-50 text-amber-700 border-amber-300' : (currentStatus === 'ALPA' ? 'bg-rose-50 text-rose-700 border-rose-300' : 'bg-slate-50 text-slate-600 border-slate-200')))}">
                <option value="BELUM PRESENSI" ${currentStatus === 'BELUM PRESENSI' ? 'selected' : ''}>BELUM</option>
                <option value="HADIR" ${currentStatus === 'HADIR' ? 'selected' : ''}>HADIR</option>
                <option value="IZIN" ${currentStatus === 'IZIN' ? 'selected' : ''}>IZIN</option>
                <option value="SAKIT" ${currentStatus === 'SAKIT' ? 'selected' : ''}>SAKIT</option>
                <option value="ALPA" ${currentStatus === 'ALPA' ? 'selected' : ''}>ALPA</option>
            </select>
        `;

        const geotagHtml = locStr && locStr !== 'Input Admin'
            ? `<a href="${mapUrl}" target="_blank" class="text-[9px] text-emerald-600 hover:underline font-mono font-bold flex items-center gap-0.5"><i class="fa-solid fa-location-dot text-[8px]"></i> Peta</a>`
            : `<span class="text-[9px] text-slate-400 font-medium">${locStr || '-'}</span>`;

        return `
            <td class="p-3 border-l border-slate-100">
                <div class="flex items-center gap-3 justify-center">
                    ${photoHtml}
                    <div class="text-left space-y-0.5">
                        <div class="flex items-center gap-2">
                            <span class="text-[10px] font-bold text-slate-600 font-mono">${timeStr}</span>
                            ${statusHtml}
                        </div>
                        <div>
                            ${geotagHtml}
                        </div>
                    </div>
                </div>
            </td>
        `;
    }

    let rowsHtml = '';
    teachers.forEach(teacher => {
        const attMasuk = dailyAtts.find(a => String(a.teacherId) === String(teacher.id) && (a.type || 'MASUK') === 'MASUK');
        const attPulang = dailyAtts.find(a => String(a.teacherId) === String(teacher.id) && a.type === 'PULANG');

        const cellMasuk = getAttCellHtml(teacher, filterDate, attMasuk, 'MASUK');
        const cellPulang = getAttCellHtml(teacher, filterDate, attPulang, 'PULANG');

        rowsHtml += `
            <tr class="border-b border-slate-100 hover:bg-slate-50/50 transition">
                <td class="p-4 font-semibold text-slate-800">
                    <div class="font-bold text-xs">${teacher.name}</div>
                    <div class="text-[10px] text-slate-400 font-mono mt-0.5">NIP: ${teacher.nip || '-'}</div>
                </td>
                <td class="p-4 text-slate-600 max-w-[150px] truncate" title="${(teacher.mapel || []).join(', ')}">${(teacher.mapel || []).join(', ') || '-'}</td>
                ${cellMasuk}
                ${cellPulang}
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml;
}

function exportTeacherAttendance() {
    const filterDate = document.getElementById('filter-teacher-date')?.value || new Date().toISOString().split('T')[0];
    exportToExcel('teacher-attendance-admin-table', `Laporan_Absensi_Guru_${filterDate}`);
}

async function updateTeacherAttendanceAdmin(teacherId, dateStr, newStatus, type, selectEl = null) {
    const teacher = (appState.teachers || []).find(t => String(t.id) === String(teacherId));
    const teacherName = teacher ? teacher.name : teacherId;
    const attType = type || 'MASUK';

    if (selectEl) selectEl.disabled = true;
    try {
        const response = await fetch('/api/teacher-attendance/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ teacherId, date: dateStr, status: newStatus, type: attType })
        });
        const data = await response.json().catch(() => null);
        if (!response.ok || !data || !data.success) {
            throw new Error((data && data.message) || 'Gagal mengubah status presensi guru.');
        }

        if (Array.isArray(data.teacherAttendance)) {
            appState.teacherAttendance = data.teacherAttendance;
            try { localStorage.setItem('madrasah_teacher_attendance', JSON.stringify(appState.teacherAttendance)); } catch (_) {}
        } else {
            const refreshResponse = await fetch('/api/teacher-attendance', { cache: 'no-store' });
            const refreshData = await refreshResponse.json().catch(() => null);
            if (!refreshResponse.ok || !refreshData || !refreshData.success || !Array.isArray(refreshData.teacherAttendance)) {
                throw new Error((refreshData && refreshData.message) || 'Status tersimpan, tetapi data presensi terbaru gagal dimuat.');
            }
            appState.teacherAttendance = refreshData.teacherAttendance;
        }

        showToast(`Status presensi ${attType === 'PULANG' ? 'pulang' : 'masuk'} guru ${teacherName} diubah menjadi ${newStatus}`, 'success');
    } catch (err) {
        console.error('Gagal update presensi guru:', err);
        showToast(err.message || 'Gagal mengubah status presensi guru.', 'error');
    } finally {
        if (selectEl) selectEl.disabled = false;
        filterTeacherAttendance();
    }
}

async function refreshTeacherAttendanceData(btn) {
    let originalHtml = "";
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-arrows-rotate animate-spin"></i><span>Menyinkronkan...</span>`;
    }
    try {
        const [tRes, taRes] = await Promise.all([
            fetch('/api/teachers').then(r => r.json()).catch(() => ({ success: false })),
            fetch('/api/teacher-attendance').then(r => r.json()).catch(() => ({ success: false }))
        ]);
        if (tRes && tRes.success && Array.isArray(tRes.teachers)) appState.teachers = tRes.teachers;
        if (taRes && taRes.success && Array.isArray(taRes.teacherAttendance)) appState.teacherAttendance = taRes.teacherAttendance;
        if (typeof showToast !== 'undefined') showToast("Data absensi guru berhasil diperbarui!", "success");
        else if (window.showToast) window.showToast("Data absensi guru berhasil diperbarui!", "success");
    } catch (e) {
        console.error("Gagal refresh absensi guru:", e);
        if (typeof showToast !== 'undefined') showToast("Gagal memperbarui data absensi guru!", "error");
        else if (window.showToast) window.showToast("Gagal memperbarui data absensi guru!", "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
        const activeContent = document.getElementById('attendance-content-area') || document.getElementById('view-container');
        if (activeContent) renderTeacherAttendanceAdmin(activeContent);
    }
}

window.refreshTeacherAttendanceData = refreshTeacherAttendanceData;
window.filterStudentAttendanceSubjects = filterStudentAttendanceSubjects;
window.selectStudentAttendanceSubject = selectStudentAttendanceSubject;
window.confirmStudentAttendanceSubject = confirmStudentAttendanceSubject;
window.showPhotoPopup = showPhotoPopup;
window.renderTeacherAttendanceAdmin = renderTeacherAttendanceAdmin;
window.filterTeacherAttendance = filterTeacherAttendance;
window.exportTeacherAttendance = exportTeacherAttendance;
window.updateTeacherAttendanceAdmin = updateTeacherAttendanceAdmin;

// Automatically expose functions and state to window for global inline handlers
Object.assign(window, {
  exportToExcel,
  exportToPDF,
  closeModal,
  filterStudentAttendanceSubjects,
  selectStudentAttendanceSubject,
  confirmStudentAttendanceSubject,
  renderStudentProfile,
  uploadStudentPhoto,
  saveStudentProfileUpdate,
  openStudentPhotoSourceModal,
  openStudentCameraCaptureModal,
  closeStudentCameraModal,
  snapStudentCameraPhoto,
  saveStudentPhotoBase64,
  renderStudentPhotoHistorySection,
  selectStudentProfileFromHistory,
  deleteStudentPhotoFromHistory,
  renderStudentAttendance,
  initStudentWebcamAndGPS,
  calculateDistanceMeters,
  refreshStudentGPS,
  captureStudentSelfie,
  retakeStudentSelfie,
  submitStudentAttendance,
  renderTeacherAttendance,
  refreshTeacherGPS,
  captureTeacherSelfie,
  retakeTeacherSelfie,
  submitTeacherAttendance,
  showPhotoPopup,
  renderTeacherAttendanceAdmin,
  filterTeacherAttendance,
  exportTeacherAttendance
});
