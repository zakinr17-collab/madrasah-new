// ============================================================================
// MODUL GAME EDUKASI (EDUCATIONAL GAMES & GAMIFICATION ENGINE)
// CBT MADRASAH TERPADU - ALL 15 GAME MODES, XP, LEVEL, STREAK & LEADERBOARD
// ============================================================================

const appState = window.appState || {};
const safeSetLocalStorage = window.safeSetLocalStorage || function(k, v) { try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch(e){} };
const showToast = window.showToast || function(m, t) { console.log(m); };

function gameEscapeHtml(value) {
    const raw = String(value === undefined || value === null ? '' : value);
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(raw);
    return raw.replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[ch]));
}
function gameEscapeAttr(value) {
    const raw = String(value === undefined || value === null ? '' : value);
    if (typeof window.escapeHtmlAttr === 'function') return window.escapeHtmlAttr(raw);
    return gameEscapeHtml(raw);
}
function gameSafeImageSrc(value) {
    const raw = String(value || '');
    const normalized = typeof window.getPhotoHtmlSrc === 'function' ? window.getPhotoHtmlSrc(raw) : raw;
    return gameEscapeAttr(normalized);
}
function gameInlineArg(value) {
    const literal = JSON.stringify(String(value === undefined || value === null ? '' : value))
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
    return gameEscapeAttr(literal);
}

// --- CONFIRMATION MODAL POPUP HELPER ---
export function showGameConfirmModal({ title, message, confirmText = 'Ya, Hapus', cancelText = 'Batal', isDanger = true, onConfirm }) {
    const modalHtml = `
        <div id="game-confirm-modal-bg" class="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-fade-in">
            <div class="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-sm w-full overflow-hidden text-center p-6 space-y-4 my-8">
                <div class="w-16 h-16 ${isDanger ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'} rounded-3xl flex items-center justify-center text-2xl mx-auto shadow-inner">
                    <i class="fa-solid ${isDanger ? 'fa-trash-can' : 'fa-triangle-exclamation'}"></i>
                </div>
                <div>
                    <h3 class="text-lg font-black text-slate-900">${gameEscapeHtml(title || 'Konfirmasi Tindakan')}</h3>
                    <p class="text-xs text-slate-500 mt-1.5 leading-relaxed">${gameEscapeHtml(message || 'Apakah Anda yakin ingin melanjutkan tindakan ini? Data yang dihapus tidak dapat dipulihkan.')}</p>
                </div>
                <div class="grid grid-cols-2 gap-2.5 pt-2">
                    <button type="button" id="game-confirm-cancel-btn" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer">
                        ${gameEscapeHtml(cancelText)}
                    </button>
                    <button type="button" id="game-confirm-ok-btn" class="w-full py-2.5 ${isDanger ? 'bg-rose-600 hover:bg-rose-700 text-white' : 'bg-amber-500 hover:bg-amber-600 text-slate-950'} font-extrabold text-xs rounded-xl shadow-md transition cursor-pointer">
                        ${gameEscapeHtml(confirmText)}
                    </button>
                </div>
            </div>
        </div>
    `;

    const old = document.getElementById('game-confirm-modal-bg');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const bg = document.getElementById('game-confirm-modal-bg');
    const cancelBtn = document.getElementById('game-confirm-cancel-btn');
    const okBtn = document.getElementById('game-confirm-ok-btn');

    if (cancelBtn) cancelBtn.onclick = () => bg?.remove();
    if (okBtn) {
        okBtn.onclick = async () => {
            bg?.remove();
            if (typeof onConfirm === 'function') {
                await onConfirm();
            }
        };
    }
}
window.showGameConfirmModal = showGameConfirmModal;

// Master visibility toggle for student dashboard/sidebar
window.toggleGameModuleVisibilityMaster = async function(isEnabled) {
    if (!appState.settings) appState.settings = {};
    appState.settings.gameModuleEnabled = isEnabled;
    try {
        localStorage.setItem('madrasah_settings', JSON.stringify(appState.settings));
        await fetch('/api/settings', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ settings: appState.settings })
        });
    } catch(err) {
        console.warn('Failed to save gameModuleEnabled setting to server:', err);
    }
    
    if (typeof window.buildSidebar === 'function') {
        window.buildSidebar();
    }
    
    showToast(
        isEnabled 
            ? '✓ Menu Game Edukasi DIAKTIFKAN di dashboard & navigasi siswa.' 
            : '✓ Menu Game Edukasi DINONAKTIFKAN dari dashboard & navigasi siswa.',
        isEnabled ? 'success' : 'info'
    );
    renderGameAdminModule(document.getElementById('view-container'));
};

// --- GAMIFICATION HELPERS ---
export function calculateLevel(xp) {
    const safeXp = Math.max(0, parseInt(xp, 10) || 0);
    return Math.floor(safeXp / 250) + 1;
}

export function getXpProgress(xp) {
    const safeXp = Math.max(0, parseInt(xp, 10) || 0);
    const currentLevel = calculateLevel(safeXp);
    const currentLevelBaseXp = (currentLevel - 1) * 250;
    const nextLevelXp = currentLevel * 250;
    const currentLevelXp = safeXp - currentLevelBaseXp;
    const neededXp = 250;
    const percentage = Math.min(100, Math.round((currentLevelXp / neededXp) * 100));
    return {
        level: currentLevel,
        currentXp: currentLevelXp,
        neededXp,
        totalXp: safeXp,
        nextLevelTotalXp: nextLevelXp,
        percentage
    };
}

// 15 Game Mode Labels & Descriptions
export const GAME_TYPES = [
    { id: 'tebak_gambar', name: 'Tebak Gambar', icon: 'fa-image', color: 'emerald', desc: 'Lihat gambar & tebak nama atau fungsinya' },
    { id: 'tebak_kata', name: 'Tebak Kata', icon: 'fa-font', color: 'blue', desc: 'Isi petunjuk menggunakan kotak-kotak huruf' },
    { id: 'crossword', name: 'Teka-Teki Silang', icon: 'fa-puzzle-piece', color: 'indigo', desc: 'Kata mendatar & menurun saling bersilangan' },
    { id: 'susun_kata', name: 'Susun Kata', icon: 'fa-arrow-down-short-wide', color: 'violet', desc: 'Susun huruf yang diacak menjadi kata benar' },
    { id: 'word_search', name: 'Cari Kata', icon: 'fa-magnifying-glass', color: 'purple', desc: 'Cari istilah tersembunyi secara mendatar, menurun, atau diagonal' },
    { id: 'memory_match', name: 'Memory Match', icon: 'fa-brain', color: 'pink', desc: 'Cocokkan istilah dengan definisi' },
    { id: 'labirin', name: 'Labirin Benang Kusut', icon: 'fa-route', color: 'amber', desc: 'Susuri benang kusut dari item atas ke pasangan jawaban bawah' },
    { id: 'image_puzzle', name: 'Puzzle Gambar', icon: 'fa-border-all', color: 'lime', desc: 'Susun kembali 9 potongan gambar (3x3 grid) yang diacak' },
    { id: 'spot_difference', name: 'Cari Perbedaan', icon: 'fa-eye', color: 'rose', desc: 'Temukan titik perbedaan pada dua gambar' },
    { id: 'true_false', name: 'Benar atau Salah', icon: 'fa-circle-half-stroke', color: 'sky', desc: 'Tentukan apakah pernyataan benar atau salah' }
];

// Default Sample Seed Games if empty
export const SAMPLE_SEED_GAMES = [
    {
        id: 'GAME_SEED_1',
        title: 'Tebak Perangkat Komputer',
        gameType: 'tebak_kata',
        subjectId: 'Informatika',
        classId: 'Semua Kelas',
        difficulty: 'Mudah',
        timeLimit: 120,
        rewardXp: 100,
        status: 'active',
        prompt: 'Perangkat keras komputer yang digunakan untuk mengetik huruf, angka, dan simbol.',
        answerKey: 'KEYBOARD',
        hints: ['Mempunyai tombol QWERTY', 'Merupakan perangkat input utama'],
        imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?auto=format&fit=crop&w=600&q=80'
    },
    {
        id: 'GAME_SEED_2',
        title: 'Teka-Teki Silang Informatika Dasar',
        gameType: 'crossword',
        subjectId: 'Informatika',
        classId: 'Semua Kelas',
        difficulty: 'Sedang',
        timeLimit: 300,
        rewardXp: 150,
        status: 'active',
        prompt: 'Lengkapi Teka-Teki Silang berikut mengenai komponen komputer. Perhatikan kolom mendatar dan menurun!',
        crosswordData: {
            gridSize: { rows: 8, cols: 8 },
            clues: [
                { number: 1, direction: 'across', row: 1, col: 1, clue: 'Otak pemroses utama pada komputer (3 Huruf)', answer: 'CPU', points: 30, initialHint: true },
                { number: 2, direction: 'down', row: 1, col: 1, clue: 'Perangkat keras pengolah data utama (8 Huruf)', answer: 'COMPUTER', points: 50, initialHint: true },
                { number: 3, direction: 'across', row: 3, col: 1, clue: 'Modulasi sinyal jaringan internet (5 Huruf)', answer: 'MODEM', points: 30, initialHint: true },
                { number: 4, direction: 'across', row: 4, col: 1, clue: 'Perangkat pencetak dokumen kertas (7 Huruf)', answer: 'PRINTER', points: 40, initialHint: true }
            ]
        }
    },
    {
        id: 'GAME_SEED_3',
        title: 'Cari Kata - Komponen Hardware',
        gameType: 'word_search',
        subjectId: 'Informatika',
        classId: 'Semua Kelas',
        difficulty: 'Mudah',
        timeLimit: 180,
        rewardXp: 120,
        status: 'active',
        prompt: 'Temukan 4 kata hardware komputer dalam kumpulan huruf!',
        wordsToFind: ['MONITOR', 'MOUSE', 'MODEM', 'PRINTER']
    },
    {
        id: 'GAME_SEED_4',
        title: 'Memory Match - Istilah TIK',
        gameType: 'memory_match',
        subjectId: 'Informatika',
        classId: 'Semua Kelas',
        difficulty: 'Sedang',
        timeLimit: 150,
        rewardXp: 130,
        status: 'active',
        prompt: 'Buka kartu dan cocokkan perangkat komputer dengan fungsinya!',
        pairs: [
            { term: 'CPU', match: 'Otak Komputer' },
            { term: 'PRINTER', match: 'Mencetak Dokumen' },
            { term: 'KEYBOARD', match: 'Alat Mengetik' },
            { term: 'MONITOR', match: 'Menampilkan Gambar' }
        ]
    },
    {
        id: 'GAME_SEED_5',
        title: 'Benar atau Salah - Keamanan Siber',
        gameType: 'true_false',
        subjectId: 'Informatika',
        classId: 'Semua Kelas',
        difficulty: 'Mudah',
        timeLimit: 60,
        rewardXp: 80,
        status: 'active',
        prompt: 'Password yang kuat sebaiknya terdiri dari kombinasi huruf besar, huruf kecil, angka, dan simbol khusus.',
        correctAnswer: 'BENAR',
        explanation: 'Kombinasi Karakter Acak membuat password sangat sulit diretas oleh serangan brute-force.'
    }
];

// Default Sample Seed Game Modes (Adventure & Tower)
export const SAMPLE_SEED_GAME_MODES = [
    {
        id: 'MODE_SEED_1',
        title: 'Petualangan Peta Harta Karun TIK',
        modeType: 'adventure',
        subjectId: 'Informatika',
        classId: 'Semua Kelas',
        description: 'Jelajahi lokasi peta petualangan dari lokasi awal hingga menemukan peti harta karun TIK!',
        status: 'active',
        locations: [
            { id: 'loc_1', name: 'Pulau Pemula Komputer', gameId: 'GAME_SEED_1', icon: 'fa-island-tropical', desc: 'Selesaikan tebak perangkat komputer untuk membuka jalur petualangan.', x: 18, y: 78 },
            { id: 'loc_2', name: 'Hutan Kosakata TIK', gameId: 'GAME_SEED_3', icon: 'fa-tree', desc: 'Cari kata istilah hardware dalam hutan rimba.', x: 34, y: 48 },
            { id: 'loc_3', name: 'Gurun Teka-Teki Silang', gameId: 'GAME_SEED_2', icon: 'fa-mountain', desc: 'Pecahkan teka-teki silang komputer di gurun pasir.', x: 74, y: 30 },
            { id: 'loc_4', name: 'Peti Harta Karun AI & Siber', gameId: 'GAME_SEED_4', icon: 'fa-vault', desc: 'Buka peti harta karun dengan menyelesaikan game memory match!', x: 50, y: 62 }
        ]
    },
    {
        id: 'MODE_SEED_2',
        title: 'Quest Menara TIK & Siber',
        modeType: 'tower',
        subjectId: 'Informatika',
        classId: 'Semua Kelas',
        description: 'Panjat menara dari lantai paling bawah hingga puncak master TIK secara berurutan!',
        status: 'active',
        floors: [
            { id: 'flr_1', floorNumber: 1, name: 'Lantai 1: Perangkat Keras', gameId: 'GAME_SEED_1', desc: 'Uji pemahaman hardware dasar di pintu gerbang menara.' },
            { id: 'flr_2', floorNumber: 2, name: 'Lantai 2: Keamanan Siber', gameId: 'GAME_SEED_5', desc: 'Kuasai prinsip keamanan password di lantai 2.' },
            { id: 'flr_3', floorNumber: 3, name: 'Lantai 3: Kosakata TIK', gameId: 'GAME_SEED_3', desc: 'Temukan kata tersembunyi untuk naik ke lantai berikutnya.' },
            { id: 'flr_4', floorNumber: 4, name: 'Puncak Menara: Teka-Teki Silang', gameId: 'GAME_SEED_2', desc: 'Selesaikan teka-teki puncak menara untuk meraih gelar Master Menara!' }
        ]
    }
];

export function getActiveStudentId() {
    const currUser = appState.currentUser || {};
    return String(currUser.id || currUser.nisn || currUser.username || currUser.nis || 'default_student');
}

export function getStudentProgressForMode(modeId) {
    if (!appState.studentGameProgress) {
        try {
            appState.studentGameProgress = JSON.parse(localStorage.getItem('madrasah_student_game_progress')) || {};
        } catch(e) {
            appState.studentGameProgress = {};
        }
    }
    const studentId = getActiveStudentId();
    if (!appState.studentGameProgress[studentId]) {
        appState.studentGameProgress[studentId] = {};
    }
    if (!appState.studentGameProgress[studentId][modeId]) {
        appState.studentGameProgress[studentId][modeId] = { completedLocations: [], completedFloors: [], completedCatalogGames: [] };
    }
    return appState.studentGameProgress[studentId][modeId];
}

export function getGameModes() {
    if (!Array.isArray(appState.gameModes) || appState.gameModes.length === 0) {
        appState.gameModes = [...SAMPLE_SEED_GAME_MODES];
    }
    if (!appState.studentGameProgress) {
        try {
            appState.studentGameProgress = JSON.parse(localStorage.getItem('madrasah_student_game_progress')) || {};
        } catch(e) {
            appState.studentGameProgress = {};
        }
    }
    return appState.gameModes;
}

export async function saveGameModesToBackend() {
    try {
        await fetch('/api/sync-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'gameModes', data: appState.gameModes })
        });
    } catch (e) {
        console.warn("Sync gameModes failed, stored locally", e);
    }
}

// State for active played game session
let activeGameSession = null;
let activeGameTimer = null;

// ============================================================================
// ADMIN & GURU VIEW: RENDER GAME MANAGEMENT
// ============================================================================
window.toggleGameVisibilityForStudent = async function(isActive) {
    if (!appState.settings) appState.settings = {};
    appState.settings.isGameMenuVisibleForStudent = isActive;
    
    try {
        if (typeof window.saveSettingsToServer === 'function') {
            await window.saveSettingsToServer();
        } else {
            await fetch('/api/sync-state', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ key: 'settings', data: appState.settings })
            });
        }
        showToast(`Menu Game Edukasi kini ${isActive ? 'Aktif' : 'Nonaktif'} di akun siswa.`, isActive ? 'success' : 'info');
    } catch (e) {
        console.warn("Gagal simpan status visibilitas game:", e);
    }
};

export function renderGameAdminModule(container) {
    if (!container) return;

    const activeSubTab = window.__adminGameSubTab || 'kelola';

    if (!appState.gameMonitoringClassId) appState.gameMonitoringClassId = 'all';
    if (!appState.gameMonitoringGameId) appState.gameMonitoringGameId = 'all';
    if (!appState.gameMonitoringStatus) appState.gameMonitoringStatus = 'all';
    if (!appState.gameMonitoringSearch) appState.gameMonitoringSearch = '';
    if (!appState.gameMonitoringLivecamMode) appState.gameMonitoringLivecamMode = 'gambar';
    if (!appState.gameMonitoringStudentModes) appState.gameMonitoringStudentModes = {};

    const games = Array.isArray(appState.eduGames) && appState.eduGames.length > 0 ? appState.eduGames : SAMPLE_SEED_GAMES;
    if (!Array.isArray(appState.eduGames) || appState.eduGames.length === 0) {
        appState.eduGames = games;
    }

    const modes = getGameModes();

    const subjects = Array.isArray(appState.subjects) ? appState.subjects : [];
    const classes = Array.isArray(appState.classes) ? appState.classes : [];

    const activeFilterType = window.__gameFilterType || 'all';
    const activeFilterSubject = window.__gameFilterSubject || 'all';

    const filteredGames = games.filter(g => {
        if (activeFilterType !== 'all' && g.gameType !== activeFilterType) return false;
        if (activeFilterSubject !== 'all' && g.subjectId !== activeFilterSubject) return false;
        return true;
    });

    const totalActive = games.filter(g => g.status === 'active').length;
    const attempts = Array.isArray(appState.gameAttempts) ? appState.gameAttempts : [];
    const totalAttempts = attempts.length;
    const isGameModuleEnabled = appState.settings?.gameModuleEnabled !== false;
    ensureGameArenaAdminConfigLoaded();

    if (activeSubTab === 'arena-monitoring') {
        if (gameMonitoringPollTimer) {
            clearInterval(gameMonitoringPollTimer);
            gameMonitoringPollTimer = null;
        }
        container.innerHTML = `
            <div class="space-y-6 pb-12 animate-fade-in">
                <div class="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
                    <button type="button" onclick="window.__adminGameSubTab='kelola'; renderGameAdminModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-black bg-white text-slate-600 border border-slate-200 cursor-pointer"><i class="fa-solid fa-gamepad mr-1"></i> Kelola Game & Mode</button>
                    <button type="button" onclick="window.__adminGameSubTab='monitoring'; renderGameAdminModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-black bg-white text-slate-600 border border-slate-200 cursor-pointer"><i class="fa-solid fa-desktop mr-1"></i> Monitoring Game</button>
                    <button type="button" class="px-5 py-2.5 rounded-2xl text-xs font-black bg-fuchsia-600 text-white cursor-pointer"><i class="fa-solid fa-users-viewfinder mr-1"></i> Monitoring Arena <span class="ml-1 px-2 py-0.5 rounded-full bg-emerald-500 text-[9px]">LIVE</span></button>
                </div>
                <div class="bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 rounded-3xl p-5 sm:p-6 text-white border border-violet-500/30 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div><span class="text-[10px] font-black uppercase tracking-widest text-fuchsia-300">Teacher Arena View</span><h2 class="text-xl font-black mt-1">Monitoring Arena Siswa</h2><p class="text-xs text-slate-300 mt-1">Tampilan arena berasal dari state pertandingan yang sama dengan akun siswa. Semua avatar, posisi permainan, progress, dan status tim diperbarui otomatis.</p></div>
                    <div class="flex items-center gap-2">${renderGameArenaFxControl()}<button type="button" onclick="refreshAdminGameArenaMonitoring(true)" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black cursor-pointer"><i class="fa-solid fa-arrows-rotate mr-1"></i> Refresh</button></div>
                </div>
                <div id="game-arena-monitoring-content" class="space-y-5"><div class="p-10 text-center text-slate-500 font-bold"><i class="fa-solid fa-circle-notch fa-spin text-2xl text-fuchsia-500 block mb-2"></i>Menyiapkan arena live...</div></div>
            </div>
        `;
        window.refreshAdminGameArenaMonitoring(false);
        if (adminArenaMonitoringTimer) clearInterval(adminArenaMonitoringTimer);
        adminArenaMonitoringTimer = setInterval(() => window.refreshAdminGameArenaMonitoring(false), 1200);
        return;
    }

    if (adminArenaMonitoringTimer) {
        clearInterval(adminArenaMonitoringTimer);
        adminArenaMonitoringTimer = null;
    }

    if (activeSubTab === 'monitoring') {
        container.innerHTML = `
            <div class="space-y-6 pb-12 animate-fade-in">
                <!-- Sub-tab Navigation Header -->
                <div class="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
                    <button type="button" onclick="window.__adminGameSubTab = 'kelola'; renderGameAdminModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 shadow-sm">
                        <i class="fa-solid fa-gamepad text-sm"></i>
                        <span>Kelola Game & Mode</span>
                    </button>
                    <button type="button" onclick="window.__adminGameSubTab = 'monitoring'; renderGameAdminModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer bg-purple-600 text-white shadow-md">
                        <i class="fa-solid fa-desktop text-sm"></i>
                        <span>Dashboard Monitoring Game</span>
                        <span class="px-2 py-0.5 bg-emerald-500 text-white font-extrabold text-[9px] rounded-full animate-pulse ml-1">LIVE</span>
                    </button>
                    <button type="button" onclick="window.__adminGameSubTab='arena-monitoring'; renderGameAdminModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer bg-white text-slate-600 hover:bg-fuchsia-50 border border-slate-200 shadow-sm">
                        <i class="fa-solid fa-users-viewfinder text-sm text-fuchsia-600"></i><span>Monitoring Arena</span>
                    </button>
                </div>

                <!-- Dedicated Monitoring Banner -->
                <div class="bg-slate-950 border border-slate-800 text-white rounded-3xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-2xl flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-indigo-600/30">
                            <i class="fa-solid fa-gamepad"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <h2 class="font-extrabold text-lg sm:text-xl text-white">Dashboard Live Monitoring Game Edukasi</h2>
                                <span class="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse">
                                    LIVE AKTIF
                                </span>
                            </div>
                            <p class="text-xs text-slate-400">Pantau login aplikasi, aktivitas permainan, perolehan XP, dan foto/kamera live peserta secara terpisah.</p>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 flex-wrap">
                        <button type="button" onclick="openBroadcastGameMessageModal()" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-extrabold shadow transition cursor-pointer flex items-center gap-2">
                            <i class="fa-solid fa-bullhorn"></i>
                            <span>Kirim Siaran (Broadcast)</span>
                        </button>
                        <button type="button" onclick="toggleGameMonitoringLivecamMode()" class="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-extrabold border border-slate-700 shadow transition cursor-pointer flex items-center gap-2">
                            <i class="fa-solid ${appState.gameMonitoringLivecamMode === 'video' ? 'fa-video text-amber-400' : 'fa-image text-indigo-400'}"></i>
                            <span>Mode: ${appState.gameMonitoringLivecamMode === 'video' ? 'Video Live' : 'Foto Absen'}</span>
                        </button>
                        <button type="button" onclick="refreshGameMonitoringData()" class="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm transition cursor-pointer border border-slate-700" title="Refresh Data">
                            <i class="fa-solid fa-arrows-rotate"></i>
                        </button>
                    </div>
                </div>

                <!-- Main Monitoring Body -->
                <div class="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 space-y-5" id="game-monitoring-content">
                    <div class="p-8 text-center text-slate-400 font-bold">
                        <i class="fa-solid fa-circle-notch fa-spin text-2xl mb-2 text-indigo-400 block"></i>
                        Menyiapkan dashboard monitoring game...
                    </div>
                </div>
            </div>
        `;

        renderGameMonitoringDashboard();

        // Start auto polling interval
        if (gameMonitoringPollTimer) clearInterval(gameMonitoringPollTimer);
        gameMonitoringPollTimer = setInterval(() => {
            refreshGameMonitoringData(false);
        }, 2500);
        return;
    }

    if (gameMonitoringPollTimer) {
        clearInterval(gameMonitoringPollTimer);
        gameMonitoringPollTimer = null;
    }

    container.innerHTML = `
        <div class="space-y-6 pb-12 animate-fade-in">
            <!-- Sub-tab Navigation Header -->
            <div class="flex items-center gap-2 border-b border-slate-200 pb-3 overflow-x-auto">
                <button type="button" onclick="window.__adminGameSubTab = 'kelola'; renderGameAdminModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer bg-slate-900 text-white shadow-md">
                    <i class="fa-solid fa-gamepad text-sm"></i>
                    <span>Kelola Game & Mode</span>
                </button>
                <button type="button" onclick="window.__adminGameSubTab = 'monitoring'; renderGameAdminModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer bg-white text-slate-600 hover:bg-slate-100 border border-slate-200 shadow-sm">
                    <i class="fa-solid fa-desktop text-sm"></i>
                    <span>Dashboard Monitoring Game</span>
                    <span class="px-2 py-0.5 bg-emerald-500 text-white font-extrabold text-[9px] rounded-full animate-pulse ml-1">LIVE</span>
                </button>
                <button type="button" onclick="window.__adminGameSubTab='arena-monitoring'; renderGameAdminModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-black transition flex items-center gap-2 cursor-pointer bg-white text-slate-600 hover:bg-fuchsia-50 border border-slate-200 shadow-sm">
                    <i class="fa-solid fa-users-viewfinder text-sm text-fuchsia-600"></i><span>Monitoring Arena</span>
                </button>
            </div>

            <!-- Header Banner -->
            <div class="bg-gradient-to-r from-emerald-800 via-emerald-700 to-teal-800 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
                <div class="absolute -right-10 -bottom-10 w-60 h-60 bg-emerald-500/20 rounded-full blur-3xl pointer-events-none"></div>
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                    <div class="space-y-2">
                        <div class="flex items-center gap-3 flex-wrap">
                            <span class="text-xs font-bold tracking-widest text-emerald-200 uppercase bg-emerald-950/50 px-3 py-1 rounded-full border border-emerald-500/30 inline-flex items-center gap-1.5">
                                <i class="fa-solid fa-gamepad"></i> Modul Pembelajaran Interaktif
                            </span>
                            
                            <!-- Master Toggle Switch: Tampilkan di Siswa -->
                            <label class="inline-flex items-center gap-2 cursor-pointer bg-emerald-950/80 hover:bg-emerald-950 px-3 py-1 rounded-full border border-emerald-400/40 transition select-none shadow-sm" title="Saklar On/Off: Aktifkan untuk memunculkan menu Game Edukasi pada dashboard & navigasi siswa">
                                <span class="text-[11px] font-bold ${isGameModuleEnabled ? 'text-emerald-300' : 'text-slate-300'}">
                                    ${isGameModuleEnabled ? '🟢 Menu Siswa Aktif' : '⚪ Menu Siswa Nonaktif'}
                                </span>
                                <div class="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" onchange="toggleGameModuleVisibilityMaster(this.checked)" class="sr-only peer" ${isGameModuleEnabled ? 'checked' : ''}>
                                    <div class="w-8 h-4.5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3.5 after:w-3.5 after:transition-all peer-checked:bg-emerald-400"></div>
                                </div>
                            </label>
                            <button type="button" onclick="openGameEducationVisibilityModal()" class="inline-flex items-center gap-1.5 bg-indigo-950/80 hover:bg-indigo-900 px-3 py-1 rounded-full border border-indigo-400/40 text-[11px] font-bold text-indigo-200 transition cursor-pointer" title="Pilih kategori Game Edukasi yang tampil untuk siswa">
                                <i class="fa-solid fa-filter"></i> Pilih Kategori Siswa
                            </button>
                        </div>
                        <h1 class="text-2xl sm:text-3xl font-black tracking-tight">Manajemen Game Edukasi</h1>
                        <p class="text-xs sm:text-sm text-emerald-100 max-w-xl">
                            Buat dan kelola permainan edukasi interaktif serta Mode Adventure Roadmap & Mode Quest Tower untuk siswa.
                        </p>
                    </div>
                    
                    <!-- Action Buttons -->
                    <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0 w-full sm:w-auto">
                        <button type="button" onclick="openCreateGameModal()" class="px-5 py-3 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-extrabold text-xs rounded-2xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer">
                            <i class="fa-solid fa-plus text-sm"></i> <span>Buat Game Baru</span>
                        </button>
                        <button type="button" onclick="openCreateGameModeModal()" class="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-indigo-600/20 transition flex items-center justify-center gap-2 cursor-pointer">
                            <i class="fa-solid fa-map-location-dot text-sm"></i> <span>Buat Mode Game</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Stats Overview -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
                    <div class="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center text-xl shrink-0">
                        <i class="fa-solid fa-gamepad"></i>
                    </div>
                    <div>
                        <span class="text-xs font-bold text-slate-400 block uppercase">Total Game</span>
                        <span class="text-xl font-black text-slate-800">${games.length}</span>
                    </div>
                </div>
                <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
                    <div class="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center text-xl shrink-0">
                        <i class="fa-solid fa-map"></i>
                    </div>
                    <div>
                        <span class="text-xs font-bold text-slate-400 block uppercase">Mode Game</span>
                        <span class="text-xl font-black text-indigo-700">${modes.length} Mode</span>
                    </div>
                </div>
                <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
                    <div class="w-12 h-12 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center text-xl shrink-0">
                        <i class="fa-solid fa-users-viewfinder"></i>
                    </div>
                    <div>
                        <span class="text-xs font-bold text-slate-400 block uppercase">Dimainkan Siswa</span>
                        <span class="text-xl font-black text-slate-800">${totalAttempts} Kali</span>
                    </div>
                </div>
                <div class="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center space-x-4">
                    <div class="w-12 h-12 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center text-xl shrink-0">
                        <i class="fa-solid fa-trophy"></i>
                    </div>
                    <div>
                        <span class="text-xs font-bold text-slate-400 block uppercase">Leaderboard</span>
                        <button type="button" onclick="openGameLeaderboardModal()" class="text-xs font-bold text-emerald-600 hover:underline">Lihat Peringkat &rarr;</button>
                    </div>
                </div>
            </div>

            ${renderAdminArenaManagementSection()}

            <!-- SECTION: KARTU MODE GAME (ADVENTURE ROADMAP & TOWER QUEST) -->
            <div class="bg-gradient-to-br from-indigo-900 via-slate-900 to-slate-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl space-y-5 border border-indigo-500/30">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
                    <div>
                        <span class="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest bg-amber-950/80 px-3 py-1 rounded-full border border-amber-500/40 inline-block mb-1">
                            <i class="fa-solid fa-map-location-dot"></i> Mode Pembelajaran Berurutan
                        </span>
                        <h2 class="text-xl sm:text-2xl font-black text-slate-100">Pilihan Mode Game (Adventure Roadmap & Quest Tower)</h2>
                        <div class="flex items-center mt-1">
                            <p class="text-xs text-slate-300">
                                Pilih dan kelola alur permainan petualangan roadmap atau quest menara bertingkat untuk dimainkan oleh siswa.
                            </p>
                            <label class="flex items-center gap-2 cursor-pointer ml-4 bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl border border-white/10 transition group">
                                <input type="checkbox" onchange="window.toggleGameVisibilityForStudent(this.checked)" ${(appState.settings.isGameMenuVisibleForStudent !== false) ? 'checked' : ''} class="w-4 h-4 accent-emerald-500 cursor-pointer">
                                <span class="text-[10px] font-black uppercase tracking-wider text-slate-100 group-hover:text-emerald-400">Aktif di Siswa</span>
                            </label>
                        </div>
                    </div>
                    <div class="flex items-center gap-2.5 flex-wrap shrink-0">
                        <button type="button" onclick="openCreateGameModeModal()" class="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center gap-2 cursor-pointer">
                            <i class="fa-solid fa-plus"></i> <span>Tambah Mode Baru</span>
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                    ${modes.length === 0 ? `
                        <div class="col-span-full p-8 text-center text-slate-400 text-xs bg-slate-900/60 rounded-2xl border border-slate-800">
                            Belum ada Mode Game. Klik "Tambah Mode Baru" untuk membuat Mode Adventure atau Mode Tower.
                        </div>
                    ` : modes.map(m => {
                        const isAdventure = m.modeType === 'adventure';
                        const locationsCount = Array.isArray(m.locations) ? m.locations.length : 0;
                        const floorsCount = Array.isArray(m.floors) ? m.floors.length : 0;
                        const isActive = m.status !== 'inactive';

                        return `
                            <div class="bg-slate-800/90 rounded-2xl border ${!isActive ? 'border-slate-700 opacity-60' : isAdventure ? 'border-amber-500/40 hover:border-amber-400' : 'border-indigo-500/40 hover:border-indigo-400'} p-5 space-y-4 shadow-lg transition duration-200">
                                <div class="flex items-center justify-between gap-2">
                                    <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                        isAdventure ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                    }">
                                        <i class="fa-solid ${isAdventure ? 'fa-map' : 'fa-chess-rook'} mr-1"></i>
                                        ${isAdventure ? 'Mode Adventure (Roadmap)' : 'Mode Tower (Quest Menara)'}
                                    </span>
                                    <div class="flex items-center gap-2">
                                        <button type="button" onclick="toggleGameModeStatus('${m.id}')" class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 transition cursor-pointer ${isActive ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/30' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40 hover:bg-rose-500/30'}" title="Klik untuk mengubah status mode (Aktif/Nonaktif)">
                                            <span class="w-2 h-2 rounded-full ${isActive ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'}"></span>
                                            <span>${isActive ? 'Aktif' : 'Nonaktif'}</span>
                                        </button>
                                        <span class="text-[11px] font-bold text-slate-400">
                                            <i class="fa-solid fa-graduation-cap text-indigo-400 mr-1"></i> ${gameEscapeHtml(m.classId || 'Semua Kelas')}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <h3 class="text-lg font-black text-white leading-tight">${gameEscapeHtml(m.title)}</h3>
                                    <p class="text-xs text-slate-300 mt-1 line-clamp-2">${gameEscapeHtml(m.description || 'Alur tantangan berurutan bagi siswa.')}</p>
                                </div>

                                <div class="bg-slate-900/80 p-3 rounded-xl border border-slate-700/60 flex items-center justify-between text-xs font-bold text-slate-300">
                                    <span>Status Jalur:</span>
                                    <span class="${isAdventure ? 'text-amber-400' : 'text-indigo-400'} font-extrabold">
                                        ${isAdventure ? `${locationsCount} Lokasi Roadmap` : `${floorsCount} Lantai Quest Menara`}
                                    </span>
                                </div>

                                <div class="flex flex-wrap items-center gap-2 pt-1">
                                    <button type="button" onclick="${isAdventure ? `openManageAdventureRoadmapModal('${m.id}')` : `openManageTowerQuestModal('${m.id}')`}" class="flex-1 min-w-[140px] py-2.5 ${isAdventure ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'} font-black rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2 cursor-pointer">
                                        <i class="fa-solid fa-sliders"></i> <span>Kelola (${isAdventure ? 'Peta Harta' : 'Lantai Tower'})</span>
                                    </button>
                                    <button type="button" onclick="previewGameMode('${m.id}')" class="px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl text-xs shadow-md transition flex items-center justify-center gap-1.5 cursor-pointer" title="Pratinjau Mode Siswa">
                                        <i class="fa-solid fa-eye"></i> <span>Pratinjau</span>
                                    </button>
                                    <button type="button" onclick="openCreateGameModeModal('${m.id}')" class="p-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-xl transition cursor-pointer" title="Edit Metadata Mode">
                                        <i class="fa-solid fa-pen-to-square text-xs"></i>
                                    </button>
                                    <button type="button" onclick="deleteGameModeEntry('${m.id}')" class="p-2.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800/50 rounded-xl transition cursor-pointer" title="Hapus Mode">
                                        <i class="fa-solid fa-trash-can text-xs"></i>
                                    </button>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Filters & Controls for Individual Games -->
            <div class="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div class="flex flex-wrap items-center gap-3 w-full sm:w-auto">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-slate-500">Katalog Game:</span>
                        <select onchange="window.__gameFilterType = this.value; renderGameAdminModule(document.getElementById('view-container'));" class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700">
                            <option value="all" ${activeFilterType === 'all' ? 'selected' : ''}>Semua 15 Jenis Game</option>
                            ${GAME_TYPES.map(t => `<option value="${t.id}" ${activeFilterType === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                        </select>
                    </div>
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-bold text-slate-500">Mapel:</span>
                        <select onchange="window.__gameFilterSubject = this.value; renderGameAdminModule(document.getElementById('view-container'));" class="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-700">
                            <option value="all" ${activeFilterSubject === 'all' ? 'selected' : ''}>Semua Mata Pelajaran</option>
                            ${subjects.map(s => `<option value="${gameEscapeAttr(s.name || s.id)}" ${activeFilterSubject === (s.name || s.id) ? 'selected' : ''}>${gameEscapeHtml(s.name || s.id)}</option>`).join('')}
                        </select>
                    </div>
                </div>
                <div class="text-xs text-slate-400 font-semibold">
                    Menampilkan <span class="text-slate-800 font-extrabold">${filteredGames.length}</span> game individu
                </div>
            </div>

            <!-- Games Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                ${filteredGames.length === 0 ? `
                    <div class="col-span-full bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-3">
                        <div class="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto text-2xl">
                            <i class="fa-solid fa-gamepad"></i>
                        </div>
                        <h3 class="font-bold text-slate-700 text-base">Belum Ada Game Edukasi</h3>
                        <p class="text-xs text-slate-400 max-w-md mx-auto">
                            Klik tombol "Buat Game Baru" di atas untuk menambahkan tantangan permainan baru bagi siswa.
                        </p>
                    </div>
                ` : filteredGames.map(g => {
                    const typeInfo = GAME_TYPES.find(t => t.id === g.gameType) || { name: g.gameType, icon: 'fa-gamepad', color: 'emerald' };
                    const isInactive = g.status === 'inactive';

                    return `
                        <div class="bg-white rounded-3xl border ${isInactive ? 'border-slate-200 opacity-60' : 'border-slate-100'} shadow-sm hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4 relative group">
                            <div>
                                <div class="flex items-center justify-between gap-2 mb-3">
                                    <span class="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                                        <i class="fa-solid ${typeInfo.icon} text-emerald-600"></i> ${typeInfo.name}
                                    </span>
                                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                        g.difficulty === 'Mudah' ? 'bg-emerald-100 text-emerald-800' :
                                        g.difficulty === 'Sedang' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                                    }">
                                        ${gameEscapeHtml(g.difficulty || 'Mudah')}
                                    </span>
                                </div>
                                <h3 class="font-extrabold text-base text-slate-800 group-hover:text-emerald-700 transition line-clamp-1">${gameEscapeHtml(g.title)}</h3>
                                <p class="text-xs text-slate-500 mt-1 line-clamp-2">${gameEscapeHtml(g.prompt || 'Selesaikan tantangan untuk mendapatkan XP.')}</p>
                            </div>

                            <div class="space-y-3 pt-3 border-t border-slate-100 text-xs">
                                <div class="grid grid-cols-2 gap-2 text-[11px] font-semibold text-slate-500">
                                    <div><i class="fa-solid fa-book text-emerald-500 mr-1"></i> ${gameEscapeHtml(g.subjectId || 'Umum')}</div>
                                    <div><i class="fa-solid fa-graduation-cap text-indigo-500 mr-1"></i> ${gameEscapeHtml(g.classId || 'Semua Kelas')}</div>
                                    <div><i class="fa-solid fa-stopwatch text-amber-500 mr-1"></i> ${g.timeLimit ? g.timeLimit + ' Detik' : 'Tanpa Waktu'}</div>
                                    <div><i class="fa-solid fa-star text-yellow-500 mr-1"></i> +${g.rewardXp || 100} XP</div>
                                </div>

                                <button type="button" onclick="openGameContentEditorModal('${g.id}')" class="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-xs transition flex items-center justify-center gap-2 cursor-pointer">
                                    <i class="fa-solid fa-sliders"></i> Kelola Aturan & Soal Game
                                </button>

                                <div class="flex items-center gap-2 pt-1">
                                    <button type="button" onclick="launchGamePlayPreview('${g.id}')" class="flex-1 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition text-center cursor-pointer" title="Uji Coba Langsung">
                                        <i class="fa-solid fa-play text-[10px] mr-1"></i> Uji Coba
                                    </button>
                                    <button type="button" onclick="openEditGameMetadataModal('${g.id}')" class="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition cursor-pointer" title="Edit Metadata (Judul, Mapel, Kelas, Waktu, XP)">
                                        <i class="fa-solid fa-pen-to-square text-xs"></i>
                                    </button>
                                    <button type="button" onclick="toggleGameStatus('${g.id}')" class="p-2 ${g.status === 'active' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'} rounded-xl transition cursor-pointer" title="${g.status === 'active' ? 'Nonaktifkan Game' : 'Aktifkan Game'}">
                                        <i class="fa-solid ${g.status === 'active' ? 'fa-eye-slash' : 'fa-eye'} text-xs"></i>
                                    </button>
                                    <button type="button" onclick="deleteGameEntry('${g.id}')" class="p-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition cursor-pointer" title="Hapus Game">
                                        <i class="fa-solid fa-trash-can text-xs"></i>
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

// Global functions for Game Admin
window.renderGameAdminModule = renderGameAdminModule;

// ============================================================================
// GAME MODE MANAGEMENT MODALS (ADVENTURE & TOWER)
// ============================================================================
window.openCreateGameModeModal = function(existingMode = null) {
    if (typeof existingMode === 'string') {
        const modes = getGameModes();
        existingMode = modes.find(m => m.id === existingMode) || null;
    }
    const isEdit = !!existingMode;
    const mode = existingMode || {
        id: 'MODE_' + Date.now(),
        title: '',
        modeType: 'adventure',
        subjectId: 'Informatika',
        classId: 'Semua Kelas',
        description: '',
        status: 'active',
        locations: [],
        floors: []
    };

    const modalHtml = `
        <div id="game-mode-modal-bg" class="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-start justify-center p-4 overflow-y-auto animate-fade-in">
            <div class="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden my-4 sm:my-8 flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]">
                <div class="bg-gradient-to-r from-indigo-800 to-purple-900 p-6 text-white flex items-center justify-between shrink-0">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-xl shadow-md">
                            <i class="fa-solid fa-map-location-dot"></i>
                        </div>
                        <div>
                            <h3 class="font-black text-lg">${isEdit ? 'Edit Mode Game' : 'Buat Mode Game Baru'}</h3>
                            <p class="text-xs text-indigo-200">Pilih mode Adventure Roadmap atau Quest Tower.</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeGameModeModal()" class="w-8 h-8 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <form onsubmit="handleSaveGameModeForm(event, '${mode.id}')" class="p-6 space-y-4 text-xs font-medium text-slate-700">
                    <div>
                        <label class="block font-bold text-slate-800 mb-1">Judul Mode Game <span class="text-rose-500">*</span></label>
                        <input type="text" id="gm-title" value="${gameEscapeHtml(mode.title)}" required placeholder="Contoh: Petualangan Harta Karun TIK" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 font-bold">
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block font-bold text-slate-800 mb-1">Mata Pelajaran</label>
                            <select id="gm-subject" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500">
                                ${(appState.subjects || [{name:'Informatika'}]).map(s => `
                                    <option value="${gameEscapeAttr(s.name || s.id)}" ${mode.subjectId === (s.name || s.id) ? 'selected' : ''}>${gameEscapeHtml(s.name || s.id)}</option>
                                `).join('')}
                            </select>
                        </div>
                        <div>
                            <label class="block font-bold text-slate-800 mb-1">Target Kelas</label>
                            <select id="gm-class" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500">
                                <option value="Semua Kelas" ${mode.classId === 'Semua Kelas' ? 'selected' : ''}>Semua Kelas</option>
                                ${(appState.classes || []).map(c => `
                                    <option value="${gameEscapeAttr(c.name || c.id)}" ${mode.classId === (c.name || c.id) ? 'selected' : ''}>${gameEscapeHtml(c.name || c.id)}</option>
                                `).join('')}
                            </select>
                        </div>
                    </div>

                    <div>
                        <label class="block font-bold text-slate-800 mb-2">Pilih Jenis Mode Game <span class="text-rose-500">*</span></label>
                        <div class="grid grid-cols-2 gap-3">
                            <label id="lbl-mode-adventure" class="p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col items-center text-center gap-2 ${mode.modeType === 'adventure' ? 'border-amber-500 bg-amber-50' : 'border-slate-200 bg-slate-50'}" onclick="selectModeTypeChoice('adventure')">
                                <input type="radio" name="modeTypeRadio" value="adventure" ${mode.modeType === 'adventure' ? 'checked' : ''} class="hidden">
                                <span class="text-2xl">🗺️</span>
                                <span class="font-extrabold text-slate-800 text-xs">Mode Adventure</span>
                                <span class="text-[10px] text-slate-500 leading-tight">Road Map peta petualangan lokasi berurutan</span>
                            </label>

                            <label id="lbl-mode-tower" class="p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col items-center text-center gap-2 ${mode.modeType === 'tower' ? 'border-indigo-600 bg-indigo-50' : 'border-slate-200 bg-slate-50'}" onclick="selectModeTypeChoice('tower')">
                                <input type="radio" name="modeTypeRadio" value="tower" ${mode.modeType === 'tower' ? 'checked' : ''} class="hidden">
                                <span class="text-2xl">🏰</span>
                                <span class="font-extrabold text-slate-800 text-xs">Mode Tower</span>
                                <span class="text-[10px] text-slate-500 leading-tight">Sistem Quest Menara bertingkat dari bawah</span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label class="block font-bold text-slate-800 mb-1">Deskripsi Ringkas</label>
                        <textarea id="gm-desc" rows="2" placeholder="Selesaikan tantangan berurutan ini..." class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500">${gameEscapeHtml(mode.description || '')}</textarea>
                    </div>

                    <div class="pt-4 flex items-center justify-end gap-3 border-t border-slate-100">
                        <button type="button" onclick="closeGameModeModal()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer">
                            Batal
                        </button>
                        <button type="submit" class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow-lg shadow-indigo-600/20 transition cursor-pointer flex items-center gap-2">
                            <i class="fa-solid fa-floppy-disk"></i> Simpan & Kelola Mode
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const oldModal = document.getElementById('game-mode-modal-bg');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    window.__selectedModeType = mode.modeType || 'adventure';
};

window.selectModeTypeChoice = function(type) {
    window.__selectedModeType = type;
    const lblAdv = document.getElementById('lbl-mode-adventure');
    const lblTwr = document.getElementById('lbl-mode-tower');
    if (type === 'adventure') {
        if (lblAdv) { lblAdv.className = "p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col items-center text-center gap-2 border-amber-500 bg-amber-50"; }
        if (lblTwr) { lblTwr.className = "p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col items-center text-center gap-2 border-slate-200 bg-slate-50"; }
    } else {
        if (lblAdv) { lblAdv.className = "p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col items-center text-center gap-2 border-slate-200 bg-slate-50"; }
        if (lblTwr) { lblTwr.className = "p-4 rounded-2xl border-2 cursor-pointer transition flex flex-col items-center text-center gap-2 border-indigo-600 bg-indigo-50"; }
    }
};

window.closeGameModeModal = function() {
    const el = document.getElementById('game-mode-modal-bg');
    if (el) el.remove();
};

window.handleSaveGameModeForm = async function(e, modeId) {
    if (e) e.preventDefault();
    const modes = getGameModes();
    let mode = modes.find(m => m.id === modeId);
    const isNew = !mode;

    const title = (document.getElementById('gm-title')?.value || '').trim();
    const subjectId = document.getElementById('gm-subject')?.value || 'Informatika';
    const classId = document.getElementById('gm-class')?.value || 'Semua Kelas';
    const modeType = window.__selectedModeType || 'adventure';
    const description = (document.getElementById('gm-desc')?.value || '').trim();

    if (!title) {
        showToast("Judul Mode Game wajib diisi", "error");
        return;
    }

    if (isNew) {
        const games = Array.isArray(appState.eduGames) && appState.eduGames.length > 0 ? appState.eduGames : SAMPLE_SEED_GAMES;
        mode = {
            id: modeId,
            title,
            subjectId,
            classId,
            modeType,
            description,
            status: 'active',
            locations: modeType === 'adventure' ? [
                { id: 'loc_1', name: 'Pulau Pemula', gameId: games[0]?.id || 'GAME_SEED_1', icon: 'fa-island-tropical', desc: 'Lokasi pertama petualangan' },
                { id: 'loc_2', name: 'Hutan Tantangan', gameId: games[1]?.id || 'GAME_SEED_2', icon: 'fa-tree', desc: 'Lokasi kedua petualangan' }
            ] : [],
            floors: modeType === 'tower' ? [
                { id: 'flr_1', floorNumber: 1, name: 'Lantai 1: Gerbang', gameId: games[0]?.id || 'GAME_SEED_1', desc: 'Dasar tantangan lantai 1' },
                { id: 'flr_2', floorNumber: 2, name: 'Lantai 2: Ruang Uji', gameId: games[1]?.id || 'GAME_SEED_2', desc: 'Tantangan lantai 2' }
            ] : []
        };
        modes.push(mode);
    } else {
        mode.title = title;
        mode.subjectId = subjectId;
        mode.classId = classId;
        mode.modeType = modeType;
        mode.description = description;
    }

    await saveGameModesToBackend();
    closeGameModeModal();
    showToast(`Mode Game "${title}" berhasil disimpan!`, 'success');
    renderGameAdminModule(document.getElementById('view-container'));

    if (modeType === 'adventure') {
        openManageAdventureRoadmapModal(mode.id);
    } else {
        openManageTowerQuestModal(mode.id);
    }
};

window.deleteGameModeEntry = function(modeId) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    showGameConfirmModal({
        title: 'Hapus Mode Game',
        message: `Apakah Anda yakin ingin menghapus mode game "${mode?.title || 'ini'}"? Semua konfigurasi petualangan/menara di dalamnya akan dihapus.`,
        confirmText: 'Ya, Hapus Mode',
        onConfirm: async () => {
            appState.gameModes = modes.filter(m => m.id !== modeId);
            await saveGameModesToBackend();
            showToast("Mode Game telah dihapus.", "success");
            renderGameAdminModule(document.getElementById('view-container'));
        }
    });
};

window.toggleGameModeStatus = async function(modeId) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    mode.status = mode.status === 'inactive' ? 'active' : 'inactive';
    await saveGameModesToBackend();
    showToast(`Mode "${gameEscapeHtml(mode.title)}" sekarang ${mode.status === 'active' ? 'Aktif (Ditampilkan ke Siswa)' : 'Nonaktif (Disembunyikan dari Siswa)'}.`, 'success');
    renderGameAdminModule(document.getElementById('view-container'));
};

// ============================================================================
// TREASURE MAP COMPONENT (MULTI-THEME & CUSTOM IMAGE CARTOGRAPHY ENGINE)
// ============================================================================
export function renderTreasureMapComponent(mode, options = {}) {
    const {
        isEditable = false,
        isPreview = false,
        completedLocations = [],
        activeLocationId = null
    } = options;

    const locations = Array.isArray(mode.locations) ? mode.locations : [];
    const games = Array.isArray(appState.eduGames) && appState.eduGames.length > 0 ? appState.eduGames : SAMPLE_SEED_GAMES;
    const theme = mode.theme || (mode.customMapImage ? 'custom' : 'pirate');

    const defaultCoords = [
        { x: 18, y: 78 },
        { x: 34, y: 48 },
        { x: 74, y: 30 },
        { x: 50, y: 62 },
        { x: 22, y: 26 },
        { x: 78, y: 72 },
        { x: 48, y: 18 }
    ];

    // Ensure all locations have normalized x, y percentages
    const mappedLocs = locations.map((loc, idx) => {
        const def = defaultCoords[idx % defaultCoords.length];
        const x = typeof loc.x === 'number' ? loc.x : def.x;
        const y = typeof loc.y === 'number' ? loc.y : def.y;
        return { ...loc, x, y, originalIndex: idx };
    });

    // Generate SVG path coordinate strings (viewBox 0 0 1000 650)
    let pathD = '';
    if (mappedLocs.length > 1) {
        const p0 = { x: mappedLocs[0].x * 10, y: mappedLocs[0].y * 6.5 };
        pathD = `M ${p0.x} ${p0.y}`;
        for (let i = 1; i < mappedLocs.length; i++) {
            const prev = { x: mappedLocs[i - 1].x * 10, y: mappedLocs[i - 1].y * 6.5 };
            const curr = { x: mappedLocs[i].x * 10, y: mappedLocs[i].y * 6.5 };
            const dx = curr.x - prev.x;
            const dy = curr.y - prev.y;
            const cx1 = prev.x + dx * 0.3 - dy * 0.25;
            const cy1 = prev.y + dy * 0.3 + dx * 0.25;
            const cx2 = curr.x - dx * 0.3 - dy * 0.25;
            const cy2 = curr.y - dy * 0.3 + dx * 0.25;
            pathD += ` C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
        }
    }

    // THEME-SPECIFIC CONFIGURATION
    let containerStyle = '';
    let containerBorder = '';
    let trailStroke = '#dc2626';
    let trailShadow = '#785328';
    let compassHtml = '';
    let svgBackgroundContent = '';

    if (theme === 'custom' && mode.customMapImage) {
        // --- THEME: CUSTOM UPLOADED IMAGE ---
        containerBorder = 'border-4 border-slate-700 shadow-2xl';
        trailStroke = '#f59e0b';
        trailShadow = '#0f172a';
        svgBackgroundContent = `
            <image href="${mode.customMapImage}" x="0" y="0" width="1000" height="650" preserveAspectRatio="xMidYMid slice" />
            <rect width="1000" height="650" fill="black" opacity="0.15" />
        `;
    } else if (theme === 'galaxy') {
        // --- THEME: GALAXY / SPACE EXPEDITION ---
        containerBorder = 'border-4 border-cyan-500/60 shadow-2xl shadow-cyan-950/50';
        containerStyle = 'background: radial-gradient(ellipse at 50% 50%, #090d16 0%, #020617 100%);';
        trailStroke = '#06b6d4';
        trailShadow = '#3b82f6';
        compassHtml = `
            <div class="absolute top-4 right-5 z-10 opacity-80 pointer-events-none flex flex-col items-center">
                <svg width="60" height="60" viewBox="0 0 100 100" class="drop-shadow">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#06b6d4" stroke-width="1.5" stroke-dasharray="3 3"/>
                    <circle cx="50" cy="50" r="32" fill="none" stroke="#38bdf8" stroke-width="1"/>
                    <line x1="50" y1="10" x2="50" y2="90" stroke="#06b6d4" stroke-width="1.5"/>
                    <line x1="10" y1="50" x2="90" y2="50" stroke="#06b6d4" stroke-width="1.5"/>
                    <polygon points="50,15 54,45 50,50 46,45" fill="#38bdf8"/>
                    <circle cx="50" cy="50" r="4" fill="#06b6d4"/>
                    <text x="50" y="10" text-anchor="middle" font-size="8" font-weight="900" fill="#38bdf8" font-family="sans-serif">NAV-SYS</text>
                </svg>
            </div>
        `;
        svgBackgroundContent = `
            <!-- Stars & Constellations -->
            <g fill="#ffffff" opacity="0.8">
                <circle cx="80" cy="80" r="1.5"/><circle cx="150" cy="120" r="2"/><circle cx="280" cy="70" r="1"/>
                <circle cx="420" cy="110" r="1.8"/><circle cx="620" cy="60" r="2.2"/><circle cx="780" cy="130" r="1.5"/>
                <circle cx="910" cy="80" r="2"/><circle cx="120" cy="300" r="1.2"/><circle cx="880" cy="340" r="1.8"/>
                <circle cx="100" cy="540" r="2"/><circle cx="340" cy="580" r="1.5"/><circle cx="680" cy="560" r="2"/>
                <circle cx="920" cy="520" r="1.5"/><circle cx="500" cy="320" r="2.5"/>
            </g>
            <!-- Nebulae Clouds -->
            <ellipse cx="280" cy="220" rx="140" ry="80" fill="#6366f1" opacity="0.15" filter="blur(20px)" />
            <ellipse cx="720" cy="400" rx="160" ry="90" fill="#a855f7" opacity="0.15" filter="blur(20px)" />
            <!-- Giant Ringed Planet (Saturn-like) -->
            <g transform="translate(740, 200)">
                <ellipse cx="0" cy="0" rx="70" ry="18" fill="none" stroke="#38bdf8" stroke-width="4" transform="rotate(-20)" opacity="0.7"/>
                <circle cx="0" cy="0" r="36" fill="#1e293b" stroke="#0ea5e9" stroke-width="2"/>
                <ellipse cx="0" cy="0" rx="60" ry="14" fill="none" stroke="#06b6d4" stroke-width="2" transform="rotate(-20)" opacity="0.9"/>
                <text x="0" y="55" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#38bdf8" opacity="0.8">Planet Alpha</text>
            </g>
            <!-- Space Station / Colony Moon -->
            <g transform="translate(200, 480)">
                <circle cx="0" cy="0" r="42" fill="#0f172a" stroke="#818cf8" stroke-width="2"/>
                <circle cx="-12" cy="-10" r="8" fill="#1e1b4b" opacity="0.6"/>
                <circle cx="15" cy="12" r="10" fill="#1e1b4b" opacity="0.6"/>
                <text x="0" y="60" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="bold" fill="#a5b4fc" opacity="0.8">Stasiun Orbital</text>
            </g>
            <!-- Asteroid Field -->
            <g fill="#475569" stroke="#334155" stroke-width="1" opacity="0.7">
                <polygon points="450,180 460,175 465,185 455,190" />
                <polygon points="480,210 495,205 490,220 475,218" />
                <polygon points="520,195 530,190 535,202 525,205" />
            </g>
            <!-- Space Shuttle / Rocket -->
            <g transform="translate(380, 420) rotate(-45) scale(0.7)" fill="#38bdf8" stroke="#ffffff" stroke-width="1.5">
                <polygon points="0,-30 15,20 0,10 -15,20" />
                <polygon points="0,10 6,28 -6,28" fill="#f59e0b" stroke="none"/>
            </g>
        `;
    } else if (theme === 'jungle') {
        // --- THEME: JUNGLE / TROPICAL RAINFOREST ---
        containerBorder = 'border-4 border-[#14532d] shadow-2xl';
        containerStyle = 'background: radial-gradient(ellipse at 50% 50%, #064e3b 0%, #022c22 100%);';
        trailStroke = '#f59e0b';
        trailShadow = '#022c22';
        compassHtml = `
            <div class="absolute top-4 right-5 z-10 opacity-75 pointer-events-none flex flex-col items-center">
                <svg width="60" height="60" viewBox="0 0 100 100" class="drop-shadow">
                    <circle cx="50" cy="50" r="40" fill="none" stroke="#f59e0b" stroke-width="2"/>
                    <circle cx="50" cy="50" r="32" fill="none" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4 2"/>
                    <polygon points="50,10 56,44 50,50 44,44" fill="#fbbf24"/>
                    <polygon points="50,90 56,56 50,50 44,56" fill="#047857"/>
                    <circle cx="50" cy="50" r="6" fill="#10b981" stroke="#064e3b" stroke-width="2"/>
                    <text x="50" y="8" text-anchor="middle" font-size="9" font-weight="900" fill="#fde68a" font-family="serif">N</text>
                </svg>
            </div>
        `;
        svgBackgroundContent = `
            <!-- River Flow (Cyan meandering path) -->
            <path d="M 0 350 C 200 320, 350 420, 500 360 C 650 300, 800 480, 1000 420" fill="none" stroke="#0284c7" stroke-width="22" opacity="0.6" stroke-linecap="round" />
            <path d="M 0 350 C 200 320, 350 420, 500 360 C 650 300, 800 480, 1000 420" fill="none" stroke="#38bdf8" stroke-width="6" opacity="0.8" stroke-linecap="round" />
            <!-- Ancient Mayan Temple Pyramid (Center Left) -->
            <g transform="translate(240, 240)" fill="#047857" stroke="#065f46" stroke-width="2">
                <polygon points="0,80 120,80 100,50 20,50" fill="#065f46"/>
                <polygon points="20,50 100,50 85,25 35,25" fill="#047857"/>
                <polygon points="35,25 85,25 75,5 45,5" fill="#059669"/>
                <rect x="52" y="5" width="16" height="20" fill="#022c22" />
                <text x="60" y="102" text-anchor="middle" font-family="serif" font-size="12" font-weight="bold" fill="#6ee7b7">Kuil Kuno Maya</text>
            </g>
            <!-- Jungle Trees Canopy Clusters -->
            <g fill="#065f46" stroke="#022c22" stroke-width="1.5">
                <circle cx="100" cy="140" r="30"/><circle cx="130" cy="130" r="35"/><circle cx="160" cy="150" r="28"/>
                <circle cx="780" cy="220" r="35"/><circle cx="820" cy="200" r="40"/><circle cx="850" cy="230" r="30"/>
                <circle cx="480" cy="520" r="35"/><circle cx="520" cy="500" r="40"/>
            </g>
            <!-- Tropical Waterfall Lagoon (Right) -->
            <g transform="translate(800, 480)">
                <ellipse cx="0" cy="0" rx="60" ry="35" fill="#0284c7" stroke="#38bdf8" stroke-width="2" opacity="0.8"/>
                <text x="0" y="45" text-anchor="middle" font-family="serif" font-size="12" font-weight="bold" fill="#6ee7b7">Danau Zamrud</text>
            </g>
        `;
    } else if (theme === 'fantasy') {
        // --- THEME: FANTASY / MAGIC KINGDOM ---
        containerBorder = 'border-4 border-[#581c87] shadow-2xl shadow-purple-950/60';
        containerStyle = 'background: radial-gradient(ellipse at 50% 50%, #2e1065 0%, #0f051d 100%);';
        trailStroke = '#ec4899';
        trailShadow = '#4c1d95';
        compassHtml = `
            <div class="absolute top-4 right-5 z-10 opacity-80 pointer-events-none flex flex-col items-center">
                <svg width="60" height="60" viewBox="0 0 100 100" class="drop-shadow">
                    <circle cx="50" cy="50" r="38" fill="none" stroke="#ec4899" stroke-width="1.5"/>
                    <circle cx="50" cy="50" r="30" fill="none" stroke="#c084fc" stroke-width="1" stroke-dasharray="3 3"/>
                    <polygon points="50,12 55,45 50,50 45,45" fill="#f472b6"/>
                    <polygon points="50,88 55,55 50,50 45,55" fill="#a855f7"/>
                    <circle cx="50" cy="50" r="5" fill="#f43f5e"/>
                    <text x="50" y="9" text-anchor="middle" font-size="8" font-weight="900" fill="#f472b6" font-family="serif">ARCANE</text>
                </svg>
            </div>
        `;
        svgBackgroundContent = `
            <!-- Floating Magic Islands with Crystals -->
            <g transform="translate(220, 240)">
                <path d="M -70,0 C -50,-30, 50,-30, 70,0 C 50,40, 0,70, -70,0 Z" fill="#3b0764" stroke="#a855f7" stroke-width="2"/>
                <!-- Magic Crystals -->
                <polygon points="0,-45 -12,-15 12,-15" fill="#f472b6" stroke="#fff" stroke-width="1"/>
                <polygon points="-25,-35 -32,-15 -18,-15" fill="#c084fc" stroke="#fff" stroke-width="1"/>
                <polygon points="25,-35 18,-15 32,-15" fill="#c084fc" stroke="#fff" stroke-width="1"/>
                <text x="0" y="30" text-anchor="middle" font-family="serif" font-size="11" font-weight="bold" fill="#fbcfe8">Pulau Kristal Ajaib</text>
            </g>
            <!-- Royal Fantasy Spire Castle (Center Right) -->
            <g transform="translate(720, 260)" fill="#4c1d95" stroke="#c084fc" stroke-width="2">
                <rect x="-40" y="0" width="80" height="60" fill="#3b0764" />
                <polygon points="-40,0 -20,-50 0,0" fill="#7e22ce" />
                <polygon points="0,0 20,-50 40,0" fill="#7e22ce" />
                <polygon points="-15,0 0,-70 15,0" fill="#a855f7" />
                <polygon points="0,-70 10,-75 0,-80" fill="#f43f5e" stroke="none"/>
                <text x="0" y="85" text-anchor="middle" font-family="serif" font-size="12" font-weight="bold" fill="#fbcfe8">Kastil Mahkota</text>
            </g>
            <!-- Dragon Flying Silhouette -->
            <g transform="translate(480, 140) scale(0.6)" fill="#c084fc" opacity="0.6">
                <path d="M 0,0 Q 20,-40 60,-20 Q 20,-10 0,0 Q -20,-10 -60,-20 Q -20,-40 0,0 Z"/>
            </g>
        `;
    } else {
        // --- THEME: PIRATE ISLAND (DEFAULT AUTHENTIC PARCHMENT) ---
        containerBorder = 'border-4 border-[#785328] shadow-2xl';
        containerStyle = 'background: radial-gradient(ellipse at 50% 50%, #fbf3dc 0%, #f4e3be 60%, #dec498 100%);';
        trailStroke = '#dc2626';
        trailShadow = '#785328';
        compassHtml = `
            <div class="absolute top-4 right-5 z-10 opacity-75 pointer-events-none flex flex-col items-center">
                <svg width="64" height="64" viewBox="0 0 100 100" class="drop-shadow">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#785328" stroke-width="1.5" stroke-dasharray="3 3"/>
                    <circle cx="50" cy="50" r="36" fill="none" stroke="#785328" stroke-width="2"/>
                    <polygon points="50,8 55,45 50,50 45,45" fill="#991b1b"/>
                    <polygon points="50,8 50,50 45,45" fill="#b91c1c"/>
                    <polygon points="50,92 55,55 50,50 45,55" fill="#785328"/>
                    <polygon points="92,50 55,55 50,50 55,45" fill="#785328"/>
                    <polygon points="8,50 45,55 50,50 45,45" fill="#785328"/>
                    <polygon points="76,24 53,47 50,50 47,53" fill="#a16207"/>
                    <polygon points="24,24 47,47 50,50 53,47" fill="#a16207"/>
                    <polygon points="76,76 53,53 50,50 47,47" fill="#a16207"/>
                    <polygon points="24,76 47,53 50,50 53,53" fill="#a16207"/>
                    <circle cx="50" cy="50" r="5" fill="#dc2626" stroke="#451a03" stroke-width="1.5"/>
                    <text x="50" y="7" text-anchor="middle" font-size="10" font-weight="900" fill="#7f1d1d" font-family="serif">N</text>
                    <text x="50" y="99" text-anchor="middle" font-size="9" font-weight="900" fill="#785328" font-family="serif">S</text>
                    <text x="98" y="53" text-anchor="middle" font-size="9" font-weight="900" fill="#785328" font-family="serif">E</text>
                    <text x="3" y="53" text-anchor="middle" font-size="9" font-weight="900" fill="#785328" font-family="serif">W</text>
                </svg>
            </div>
        `;
        svgBackgroundContent = `
            <!-- Ocean Waves Textures (~ ~ ~) -->
            <g stroke="#8c6239" stroke-width="1.2" fill="none" opacity="0.45" stroke-linecap="round">
                <path d="M 50 120 Q 60 115 70 120 T 90 120" />
                <path d="M 120 180 Q 130 175 140 180 T 160 180" />
                <path d="M 820 100 Q 830 95 840 100 T 860 100" />
                <path d="M 880 150 Q 890 145 900 150 T 920 150" />
                <path d="M 70 560 Q 80 555 90 560 T 110 560" />
                <path d="M 450 600 Q 460 595 470 600 T 490 600" />
                <path d="M 850 560 Q 860 555 870 560 T 890 560" />
            </g>

            <!-- Island 1: West Coast Beach -->
            <g>
                <path d="M 60 420 C 80 360, 120 340, 180 350 C 260 360, 320 420, 310 520 C 300 600, 210 630, 130 620 C 70 610, 40 500, 60 420 Z" fill="none" stroke="#785328" stroke-width="1" stroke-dasharray="2 2" opacity="0.5" />
                <path d="M 70 430 C 90 375, 130 355, 190 365 C 250 375, 300 430, 295 515 C 285 585, 205 610, 140 600 C 85 590, 55 495, 70 430 Z" fill="#edd9ad" stroke="#5c3a1e" stroke-width="2.5" stroke-linejoin="round" />
                <g transform="translate(110, 480) scale(0.9)" stroke="#451a03" stroke-width="1.8" fill="#5c3a1e">
                    <path d="M 0 0 Q 8 -18 12 -32" fill="none"/>
                    <path d="M 12 -32 Q 5 -44 -6 -40 Q 3 -36 12 -32"/>
                    <path d="M 12 -32 Q 18 -48 30 -42 Q 22 -36 12 -32"/>
                    <path d="M 12 -32 Q 24 -28 34 -20 Q 22 -24 12 -32"/>
                </g>
                <text x="140" y="585" font-family="serif" font-size="12" font-style="italic" font-weight="bold" fill="#785328" opacity="0.8">Teluk Pemula</text>
            </g>

            <!-- Island 2: Central Mountains -->
            <g>
                <path d="M 220 220 C 260 140, 360 120, 440 150 C 520 180, 560 260, 530 350 C 490 440, 380 460, 300 440 C 230 420, 190 290, 220 220 Z" fill="none" stroke="#785328" stroke-width="1" stroke-dasharray="2 2" opacity="0.5" />
                <path d="M 230 230 C 270 155, 355 135, 430 160 C 505 185, 545 260, 515 340 C 480 425, 375 445, 305 425 C 240 405, 205 295, 230 230 Z" fill="#ebd4a2" stroke="#5c3a1e" stroke-width="2.5" stroke-linejoin="round" />
                <g stroke="#451a03" stroke-width="2" fill="#d8bc87">
                    <polygon points="320,290 355,230 390,290" />
                    <polygon points="270,320 305,255 340,320" />
                    <polygon points="370,310 405,245 440,310" />
                </g>
                <text x="315" y="380" font-family="serif" font-size="13" font-style="italic" font-weight="bold" fill="#785328" opacity="0.8">Rimba Pegunungan</text>
            </g>

            <!-- Island 3: East Cliff -->
            <g>
                <path d="M 640 140 C 720 80, 840 90, 900 160 C 960 240, 940 360, 880 410 C 800 460, 680 440, 640 370 C 600 300, 590 190, 640 140 Z" fill="none" stroke="#785328" stroke-width="1" stroke-dasharray="2 2" opacity="0.5" />
                <path d="M 650 150 C 725 95, 830 105, 885 170 C 940 245, 925 350, 870 395 C 795 440, 685 425, 650 360 C 615 295, 605 195, 650 150 Z" fill="#ebd4a2" stroke="#5c3a1e" stroke-width="2.5" stroke-linejoin="round" />
                <text x="710" y="220" font-family="serif" font-size="13" font-style="italic" font-weight="bold" fill="#785328" opacity="0.8">Tanjung Harta</text>
            </g>

            <!-- Island 4: Skull Rock Lagoon -->
            <g>
                <path d="M 420 480 C 470 440, 560 450, 590 510 C 620 570, 580 640, 500 645 C 430 650, 390 590, 410 530 Z" fill="#edd9ad" stroke="#5c3a1e" stroke-width="2.5" stroke-linejoin="round" />
                <g transform="translate(500, 540) scale(0.7)" stroke="#451a03" stroke-width="2" fill="#d1b27c">
                    <path d="M -20 -10 C -20 -30, 20 -30, 20 -10 C 20 10, 12 18, 12 25 L -12 25 C -12 18, -20 10, -20 -10 Z" />
                    <ellipse cx="-8" cy="-8" rx="4" ry="6" fill="#451a03" />
                    <ellipse cx="8" cy="-8" rx="4" ry="6" fill="#451a03" />
                </g>
                <text x="445" y="620" font-family="serif" font-size="12" font-style="italic" font-weight="bold" fill="#785328" opacity="0.8">Gua Rahasia</text>
            </g>

            <!-- Sailing Galleon Ship ⛵ -->
            <g transform="translate(180, 80) scale(0.65)" stroke="#451a03" stroke-width="2" fill="#785328">
                <path d="M 0 40 C 20 55, 60 55, 80 40 L 70 25 L 10 25 Z" fill="#5c3a1e" />
                <line x1="25" y1="25" x2="25" y2="-10" stroke-width="3" />
                <path d="M 25 -8 Q 45 -4 25 15 Z" fill="#f5f0dc" />
                <polygon points="55,-20 70,-26 55,-32" fill="#0f172a" />
            </g>

            <!-- Kraken Tentacles 🐙 -->
            <g transform="translate(730, 510) scale(0.6)" stroke="#451a03" stroke-width="2.5" fill="none">
                <path d="M 0 40 Q 15 0 35 10 Q 45 20 30 35 Q 20 20 15 40" fill="#a16207" opacity="0.7"/>
            </g>
        `;
    }

    return `
        <div class="relative w-full rounded-3xl overflow-hidden ${containerBorder} select-none" style="${containerStyle}">
            ${compassHtml}

            <!-- SVG Cartography Background Canvas -->
            <svg viewBox="0 0 1000 650" class="w-full h-auto block pointer-events-none" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));">
                ${svgBackgroundContent}

                <!-- THE DASHED TREASURE TRAIL PATH -->
                ${pathD ? `
                    <path class="adventure-trail-path" d="${pathD}" fill="none" stroke="${trailShadow}" stroke-width="7" stroke-dasharray="12 10" stroke-linecap="round" opacity="0.4" transform="translate(1, 2)" />
                    <path class="adventure-trail-path" d="${pathD}" fill="none" stroke="${trailStroke}" stroke-width="5" stroke-dasharray="12 10" stroke-linecap="round" />
                ` : ''}

                <!-- "X" Marks the Spot on Final Destination -->
                ${mappedLocs.length > 0 ? `
                    <g transform="translate(${mappedLocs[mappedLocs.length - 1].x * 10}, ${mappedLocs[mappedLocs.length - 1].y * 6.5})">
                        <line x1="-20" y1="-20" x2="20" y2="20" stroke="${trailStroke}" stroke-width="7" stroke-linecap="round" opacity="0.9" />
                        <line x1="20" y1="-20" x2="-20" y2="20" stroke="${trailStroke}" stroke-width="7" stroke-linecap="round" opacity="0.9" />
                    </g>
                ` : ''}
            </svg>

            <!-- HTML INTERACTIVE LOCATION PINS OVERLAY -->
            <div class="absolute inset-0 z-30 pointer-events-auto">
                ${mappedLocs.map((loc, idx) => {
                    const isFirst = idx === 0;
                    const isLast = idx === mappedLocs.length - 1;
                    const assignedGame = games.find(g => g.id === loc.gameId) || { id: games[0]?.id || 'GAME_SEED_1', title: 'Tantangan Game', rewardXp: 100 };
                    
                    const isDone = completedLocations.includes(loc.id);
                    const isUnlocked = isFirst || completedLocations.includes(mappedLocs[idx - 1]?.id);

                    const isCustomImage = loc.icon && (loc.icon.startsWith('http') || loc.icon.startsWith('data:'));
                    const iconHtml = isCustomImage 
                        ? `<img src="${loc.icon}" class="w-8 h-8 rounded-lg object-cover pointer-events-none" referrerPolicy="no-referrer" />` 
                        : `<i class="fa-solid ${loc.icon || (isLast ? 'fa-vault' : 'fa-compass')} ${isEditable ? '' : 'animate-bounce'} pointer-events-none"></i>`;

                    if (isEditable) {
                        // ADMIN / EDITOR MODE PIN: Draggable and Clickable to edit
                        return `
                            <div style="left: ${loc.x}%; top: ${loc.y}%; transform: translate(-50%, -50%);" 
                                 onmousedown="window.startDraggingMapPin(event, '${mode.id}', ${idx})" 
                                 ontouchstart="window.startDraggingMapPin(event, '${mode.id}', ${idx})" 
                                 class="adventure-map-pin absolute group cursor-move select-none z-40">
                                <div class="relative flex flex-col items-center justify-center p-1 transition transform hover:scale-115">
                                    <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-600 via-amber-500 to-yellow-600 text-white font-black shadow-2xl border-2 border-white flex items-center justify-center text-xl hover:ring-4 hover:ring-amber-400/50">
                                        ${iconHtml}
                                    </div>
                                    <span class="absolute -top-2 -right-2 w-6 h-6 bg-slate-950 text-amber-300 font-black text-[10px] rounded-full border border-amber-400 flex items-center justify-center shadow-lg">
                                        #${idx + 1}
                                    </span>
                                </div>

                                <!-- Tooltip / Badge Info Card -->
                                <div class="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 whitespace-nowrap bg-slate-950/95 text-white p-2.5 rounded-xl text-[11px] shadow-2xl border border-amber-500/40 pointer-events-none transition z-40 text-center">
                                    <strong class="text-amber-400 block font-extrabold">${gameEscapeHtml(loc.name || `Lokasi #${idx + 1}`)}</strong>
                                    <span class="text-slate-300 text-[10px] block">Game: ${gameEscapeHtml(assignedGame.title)}</span>
                                    <span class="text-[9px] text-emerald-400 font-bold block mt-0.5">🖱️ Tahan untuk Seret / Klik untuk Atur Game</span>
                                </div>
                            </div>
                        `;
                    }

                    // STUDENT VIEW & PREVIEW MODE PIN
                    return `
                        <div style="left: ${loc.x}%; top: ${loc.y}%; transform: translate(-50%, -50%);" class="absolute group z-30">
                            ${isDone ? `
                                <!-- Completed Location -->
                                <div class="flex flex-col items-center">
                                    <button type="button" onclick="launchInteractiveGameModal('${assignedGame.id}', ${isPreview}, { modeId: '${mode.id}', locationId: '${loc.id}' })" class="w-12 h-12 rounded-2xl bg-emerald-600 border-2 border-emerald-300 text-white font-black shadow-lg flex items-center justify-center text-xl cursor-pointer hover:scale-110 transition" title="Selesai (Klik untuk main lagi)">
                                        <i class="fa-solid fa-circle-check"></i>
                                    </button>
                                    <span class="mt-1 px-2.5 py-0.5 bg-emerald-950 text-emerald-200 font-extrabold text-[10px] rounded-full shadow-lg border border-emerald-500/40 whitespace-nowrap">
                                        ✓ ${gameEscapeHtml(loc.name)}
                                    </span>
                                </div>
                            ` : isUnlocked ? `
                                <!-- Active & Unlocked Location -->
                                <div class="flex flex-col items-center">
                                    <div class="relative">
                                        <div class="absolute -inset-2 bg-amber-400/50 rounded-full blur-sm animate-ping"></div>
                                        <button type="button" onclick="launchInteractiveGameModal('${assignedGame.id}', ${isPreview}, { modeId: '${mode.id}', locationId: '${loc.id}' })" class="relative w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-500 via-yellow-400 to-amber-600 text-slate-950 font-black shadow-2xl border-3 border-white flex items-center justify-center text-2xl cursor-pointer hover:scale-115 active:scale-95 transition">
                                            ${iconHtml}
                                        </button>
                                        <span class="absolute -top-2.5 -right-2.5 px-2 py-0.5 bg-rose-600 text-white font-black text-[10px] rounded-full border border-white shadow animate-pulse">
                                            ${isLast ? 'Peti Harta' : 'Buka!'}
                                        </span>
                                    </div>
                                    <button type="button" onclick="launchInteractiveGameModal('${assignedGame.id}', ${isPreview}, { modeId: '${mode.id}', locationId: '${loc.id}' })" class="mt-1.5 px-3 py-1 bg-slate-950 text-amber-300 hover:bg-slate-900 font-black text-xs rounded-xl shadow-xl border border-amber-400/60 whitespace-nowrap cursor-pointer transition flex items-center gap-1.5">
                                        <i class="fa-solid fa-play text-amber-400 text-[10px]"></i>
                                        <span>${gameEscapeHtml(loc.name)}</span>
                                    </button>
                                </div>
                            ` : `
                                <!-- Locked Location -->
                                <div class="flex flex-col items-center opacity-70">
                                    <div class="w-11 h-11 rounded-2xl bg-slate-950/80 text-slate-300 border border-slate-700 flex items-center justify-center text-base shadow">
                                        <i class="fa-solid fa-lock"></i>
                                    </div>
                                    <span class="mt-1 px-2 py-0.5 bg-slate-950/90 text-slate-300 font-bold text-[9px] rounded-full border border-slate-700 whitespace-nowrap">
                                        🔒 ${gameEscapeHtml(loc.name)}
                                    </span>
                                </div>
                            `}
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

// DRAG AND DROP HANDLER FOR ADVENTURE MAP PINS
window.startDraggingMapPin = function(event, modeId, locIndex) {
    if (event.type === 'mousedown' && event.button !== 0) return;
    
    event.preventDefault();
    event.stopPropagation();

    const isTouch = event.type.startsWith('touch');
    const startX = isTouch ? event.touches[0].clientX : event.clientX;
    const startY = isTouch ? event.touches[0].clientY : event.clientY;
    
    const pinEl = event.currentTarget;
    const mapWrapper = pinEl.closest('.relative.w-full');
    if (!mapWrapper) return;
    
    let hasMoved = false;
    let finalX = parseFloat(pinEl.style.left) || 50;
    let finalY = parseFloat(pinEl.style.top) || 50;
    
    const moveEvent = isTouch ? 'touchmove' : 'mousemove';
    const endEvent = isTouch ? 'touchend' : 'mouseup';
    
    const onMove = function(e) {
        const clientX = isTouch ? e.touches[0].clientX : e.clientX;
        const clientY = isTouch ? e.touches[0].clientY : e.clientY;
        
        if (Math.abs(clientX - startX) > 6 || Math.abs(clientY - startY) > 6) {
            hasMoved = true;
        }
        
        const rect = mapWrapper.getBoundingClientRect();
        let xPercent = ((clientX - rect.left) / rect.width) * 100;
        let yPercent = ((clientY - rect.top) / rect.height) * 100;
        
        xPercent = Math.max(3, Math.min(97, xPercent));
        yPercent = Math.max(3, Math.min(97, yPercent));
        
        pinEl.style.left = `${xPercent}%`;
        pinEl.style.top = `${yPercent}%`;
        
        finalX = xPercent;
        finalY = yPercent;

        // Live update adventure trail path d attribute
        const allPins = mapWrapper.querySelectorAll('.adventure-map-pin');
        let pts = [];
        allPins.forEach(p => {
            const lPx = parseFloat(p.style.left) / 100 * rect.width;
            const tPx = parseFloat(p.style.top) / 100 * rect.height;
            pts.push({
                x: (lPx / rect.width) * 1000,
                y: (tPx / rect.height) * 650
            });
        });
        if (pts.length > 1) {
            let newPathD = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
            for (let i = 1; i < pts.length; i++) {
                const prev = pts[i - 1];
                const curr = pts[i];
                const dx = curr.x - prev.x;
                const dy = curr.y - prev.y;
                const cx1 = prev.x + dx * 0.3 - dy * 0.25;
                const cy1 = prev.y + dy * 0.3 + dx * 0.25;
                const cx2 = curr.x - dx * 0.3 - dy * 0.25;
                const cy2 = curr.y - dy * 0.3 + dx * 0.25;
                newPathD += ` C ${cx1.toFixed(1)} ${cy1.toFixed(1)}, ${cx2.toFixed(1)} ${cy2.toFixed(1)}, ${curr.x.toFixed(1)} ${curr.y.toFixed(1)}`;
            }
            const paths = mapWrapper.querySelectorAll('.adventure-trail-path');
            paths.forEach(pathEl => pathEl.setAttribute('d', newPathD));
        }
    };
    
    const onEnd = async function(e) {
        document.removeEventListener(moveEvent, onMove);
        document.removeEventListener(endEvent, onEnd);
        
        if (!hasMoved) {
            openAddLocationModal(modeId, locIndex);
            return;
        }
        
        const modes = getGameModes();
        const mode = modes.find(m => m.id === modeId);
        if (mode && mode.locations && mode.locations[locIndex]) {
            mode.locations[locIndex].x = parseFloat(finalX.toFixed(1));
            mode.locations[locIndex].y = parseFloat(finalY.toFixed(1));
            await saveGameModesToBackend();
            showToast(`Posisi "${mode.locations[locIndex].name}" berhasil dipindahkan ke (${mode.locations[locIndex].x}%, ${mode.locations[locIndex].y}%)`, "success");
            renderGameAdminModule(document.getElementById('view-container'));
        }
    };
    
    document.addEventListener(moveEvent, onMove, { passive: false });
    document.addEventListener(endEvent, onEnd);
};

// ============================================================================
// PREVIEW GAME MODE MODAL (ADVENTURE & TOWER FOR TEACHERS)
// ============================================================================
window.previewGameMode = function(modeId) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    const games = Array.isArray(appState.eduGames) && appState.eduGames.length > 0 ? appState.eduGames : SAMPLE_SEED_GAMES;
    const isAdventure = mode.modeType === 'adventure';

    const modalHtml = `
        <div id="mode-preview-modal-bg" class="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-50 flex items-start justify-center p-3 sm:p-6 overflow-y-auto animate-fade-in">
            <div class="bg-slate-900 border-2 ${isAdventure ? 'border-amber-500/50' : 'border-indigo-500/50'} rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden my-4 sm:my-8 flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]">
                <!-- Header Banner -->
                <div class="bg-gradient-to-r ${isAdventure ? 'from-amber-900 via-yellow-900 to-amber-950' : 'from-indigo-950 via-slate-900 to-purple-950'} p-5 flex items-center justify-between border-b border-slate-800 shrink-0">
                    <div class="flex items-center space-x-3">
                        <div class="w-11 h-11 ${isAdventure ? 'bg-amber-500 text-slate-950' : 'bg-indigo-600 text-white'} rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg">
                            ${isAdventure ? '🗺️' : '🏰'}
                        </div>
                        <div>
                            <span class="text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-0.5 rounded-full inline-block">
                                <i class="fa-solid fa-eye mr-1"></i> Mode Pratinjau Guru (Simulasi Siswa)
                            </span>
                            <h3 class="text-lg font-black text-white">${gameEscapeHtml(mode.title)}</h3>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('mode-preview-modal-bg').remove()" class="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="p-5 sm:p-6 max-h-[82vh] overflow-y-auto space-y-4">
                    <div class="bg-indigo-950/60 p-3.5 rounded-2xl border border-indigo-700/40 text-xs text-indigo-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <span>ℹ️ Ini adalah simulasi tampilan yang akan dimainkan oleh siswa. Uji coba klik pada titik/lantai untuk mencoba permainan.</span>
                        <span class="text-[11px] font-bold text-amber-300 shrink-0">${isAdventure ? `${mode.locations?.length || 0} Titik Lokasi Peta` : `${mode.floors?.length || 0} Lantai Menara`}</span>
                    </div>

                    ${isAdventure ? renderTreasureMapComponent(mode, { isEditable: false, isPreview: true, completedLocations: [] }) : renderStudentTowerTab(games, mode.id, true)}
                </div>
            </div>
        </div>
    `;

    const oldModal = document.getElementById('mode-preview-modal-bg');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

// ============================================================================
// ADVENTURE ROADMAP EDITOR MODAL
// ============================================================================
window.openManageAdventureRoadmapModal = function(modeId) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    if (!Array.isArray(mode.locations)) mode.locations = [];
    const games = Array.isArray(appState.eduGames) && appState.eduGames.length > 0 ? appState.eduGames : SAMPLE_SEED_GAMES;
    const currentTheme = mode.theme || (mode.customMapImage ? 'custom' : 'pirate');

    const modalHtml = `
        <div id="manage-roadmap-modal-bg" class="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-start justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
            <div class="bg-amber-50 border-2 border-amber-300 rounded-3xl shadow-2xl max-w-4xl w-full overflow-hidden my-4 sm:my-8 flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] relative">
                <!-- Header Banner -->
                <div class="bg-gradient-to-r from-amber-900 via-amber-800 to-yellow-900 p-5 sm:p-6 text-amber-100 flex items-center justify-between shadow-md relative overflow-hidden shrink-0">
                    <div class="absolute right-2 -bottom-6 text-7xl opacity-15 pointer-events-none">🏴‍☠️</div>
                    <div class="flex items-center space-x-3 relative z-10">
                        <div class="w-12 h-12 bg-amber-500 text-slate-950 rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg">
                            🗺️
                        </div>
                        <div>
                            <span class="text-[10px] font-extrabold text-amber-300 uppercase tracking-widest bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-600/40 inline-block">
                                Kelola Peta Petualangan Harta Karun
                            </span>
                            <h3 class="font-black text-xl text-white">${gameEscapeHtml(mode.title)}</h3>
                            <p class="text-xs text-amber-200">Klik langsung titik pada peta untuk mengatur game edukasi yang dipasang.</p>
                        </div>
                    </div>
                    <div class="flex items-center gap-2 relative z-10">
                        <button type="button" onclick="previewGameMode('${mode.id}')" class="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow transition flex items-center gap-1.5 cursor-pointer">
                            <i class="fa-solid fa-eye"></i> <span>Pratinjau Siswa</span>
                        </button>
                        <button type="button" onclick="closeRoadmapModal()" class="w-9 h-9 bg-black/20 hover:bg-black/40 rounded-full flex items-center justify-center text-white transition cursor-pointer">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <div class="p-5 sm:p-6 space-y-6 max-h-[78vh] overflow-y-auto">
                    <!-- THEME SELECTION & CUSTOM MAP UPLOAD PANEL -->
                    <div class="bg-white p-4.5 rounded-2xl border-2 border-amber-200 shadow-sm space-y-3">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div>
                                <h4 class="font-black text-sm text-slate-800 flex items-center gap-2">
                                    <i class="fa-solid fa-palette text-amber-600"></i> Tema Desain Visual Peta
                                </h4>
                                <p class="text-[11px] text-slate-500">Pilih salah satu tema visual ilustrasi peta atau unggah gambar peta buatan Anda sendiri.</p>
                            </div>
                            ${mode.customMapImage ? `
                                <button type="button" onclick="clearCustomMapImage('${mode.id}')" class="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-700 font-bold text-xs rounded-xl transition cursor-pointer flex items-center gap-1 self-start sm:self-center">
                                    <i class="fa-solid fa-rotate-left"></i> <span>Reset ke Tema Vektor</span>
                                </button>
                            ` : ''}
                        </div>

                        <!-- Theme Selection Pills -->
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                            <button type="button" onclick="setAdventureMapTheme('${mode.id}', 'pirate')" class="p-3 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${currentTheme === 'pirate' && !mode.customMapImage ? 'border-amber-600 bg-amber-100/70 shadow-sm ring-2 ring-amber-400' : 'border-slate-200 hover:border-amber-300 bg-slate-50'}">
                                <span class="text-xl">🏴‍☠️</span>
                                <div class="mt-1">
                                    <strong class="text-xs font-bold text-slate-800 block">Bajak Laut</strong>
                                    <span class="text-[10px] text-slate-500">Perkamen Antik</span>
                                </div>
                            </button>

                            <button type="button" onclick="setAdventureMapTheme('${mode.id}', 'galaxy')" class="p-3 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${currentTheme === 'galaxy' && !mode.customMapImage ? 'border-cyan-500 bg-slate-900 text-white shadow-sm ring-2 ring-cyan-400' : 'border-slate-200 hover:border-cyan-300 bg-slate-50'}">
                                <span class="text-xl">🌌</span>
                                <div class="mt-1">
                                    <strong class="text-xs font-bold ${currentTheme === 'galaxy' && !mode.customMapImage ? 'text-cyan-300' : 'text-slate-800'} block">Galaksi Kosmik</strong>
                                    <span class="text-[10px] ${currentTheme === 'galaxy' && !mode.customMapImage ? 'text-slate-400' : 'text-slate-500'}">Antariksa & Planet</span>
                                </div>
                            </button>

                            <button type="button" onclick="setAdventureMapTheme('${mode.id}', 'jungle')" class="p-3 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${currentTheme === 'jungle' && !mode.customMapImage ? 'border-emerald-600 bg-emerald-950 text-white shadow-sm ring-2 ring-emerald-400' : 'border-slate-200 hover:border-emerald-300 bg-slate-50'}">
                                <span class="text-xl">🌴</span>
                                <div class="mt-1">
                                    <strong class="text-xs font-bold ${currentTheme === 'jungle' && !mode.customMapImage ? 'text-emerald-300' : 'text-slate-800'} block">Rimba Maya</strong>
                                    <span class="text-[10px] ${currentTheme === 'jungle' && !mode.customMapImage ? 'text-slate-400' : 'text-slate-500'}">Hutan & Kuil Kuno</span>
                                </div>
                            </button>

                            <button type="button" onclick="setAdventureMapTheme('${mode.id}', 'fantasy')" class="p-3 rounded-xl border-2 text-left transition cursor-pointer flex flex-col justify-between ${currentTheme === 'fantasy' && !mode.customMapImage ? 'border-purple-600 bg-purple-950 text-white shadow-sm ring-2 ring-purple-400' : 'border-slate-200 hover:border-purple-300 bg-slate-50'}">
                                <span class="text-xl">🔮</span>
                                <div class="mt-1">
                                    <strong class="text-xs font-bold ${currentTheme === 'fantasy' && !mode.customMapImage ? 'text-purple-300' : 'text-slate-800'} block">Kerajaan Sihir</strong>
                                    <span class="text-[10px] ${currentTheme === 'fantasy' && !mode.customMapImage ? 'text-slate-400' : 'text-slate-500'}">Kastil & Kristal</span>
                                </div>
                            </button>
                        </div>

                        <!-- Custom Map Image Upload -->
                        <div class="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50 p-3 rounded-xl">
                            <div class="flex items-center gap-2">
                                <i class="fa-solid fa-cloud-arrow-up text-amber-600 text-lg"></i>
                                <div>
                                    <strong class="text-xs text-slate-800 block">Atau Unggah Gambar Peta Sendiri (JPG / PNG):</strong>
                                    <span class="text-[10px] text-slate-500">${mode.customMapImage ? '✅ Gambar peta custom aktif digunakan.' : 'Gunakan gambar ilustrasi/peta sekolah/denah Anda sendiri.'}</span>
                                </div>
                            </div>
                            <div class="flex items-center gap-2">
                                <label class="px-4 py-2 bg-amber-700 hover:bg-amber-800 text-white font-bold text-xs rounded-xl shadow cursor-pointer transition flex items-center gap-1.5">
                                    <i class="fa-solid fa-file-image"></i>
                                    <span>${mode.customMapImage ? 'Ganti Gambar Peta' : 'Pilih File Gambar'}</span>
                                    <input type="file" accept="image/*" class="hidden" onchange="handleUploadCustomMapImage('${mode.id}', this)">
                                </label>
                            </div>
                        </div>
                    </div>

                    <!-- Instruction Card -->
                    <div class="bg-amber-100/90 p-4 rounded-2xl border border-amber-300 text-amber-950 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div class="space-y-0.5">
                            <strong class="font-black">💡 Titik Lokasi Peta Interaktif:</strong>
                            <p class="text-[11px]">Klik titik lokasi mana saja pada peta di bawah ini untuk mengubah nama, posisi koordinat, atau memasang game edukasi.</p>
                        </div>
                        <button type="button" onclick="openAddLocationModal('${mode.id}', null)" class="px-4 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-extrabold rounded-xl shadow transition shrink-0 flex items-center gap-1.5 cursor-pointer">
                            <i class="fa-solid fa-plus text-xs"></i> <span>Tambah Titik Lokasi Baru</span>
                        </button>
                    </div>

                    <!-- INTERACTIVE TREASURE MAP VIEW (Clickable Pins on Map) -->
                    <div class="space-y-2">
                        <div class="flex items-center justify-between text-xs font-bold text-amber-900 px-1">
                            <span>🗺️ Tampilan Visual Peta Petualangan:</span>
                            <span class="text-[11px] text-amber-700 font-extrabold">${mode.locations.length} Titik Lokasi Terpasang</span>
                        </div>
                        ${renderTreasureMapComponent(mode, { isEditable: true, isPreview: false, completedLocations: [] })}
                    </div>

                    <!-- LIST OF LOCATIONS TABLE / CARDS -->
                    <div class="space-y-3 pt-2">
                        <h4 class="font-black text-sm text-slate-800 flex items-center gap-2">
                            <i class="fa-solid fa-list-check text-amber-600"></i> Daftar Rincian Urutan Lokasi
                        </h4>

                        <div class="space-y-3">
                            ${mode.locations.length === 0 ? `
                                <div class="p-8 text-center text-amber-800/60 text-xs bg-amber-100/50 rounded-2xl border-2 border-dashed border-amber-300">
                                    Belum ada lokasi pada Roadmap ini. Klik "Tambah Titik Lokasi Baru" untuk memulai!
                                </div>
                            ` : mode.locations.map((loc, idx) => {
                                const assignedGame = games.find(g => g.id === loc.gameId) || { title: 'Belum dipasang game', gameType: 'tebak_kata' };
                                const isFirst = idx === 0;
                                const isLast = idx === mode.locations.length - 1;

                                return `
                                    <div class="bg-white p-4 rounded-2xl border-2 ${isFirst ? 'border-amber-500 bg-amber-50/40' : 'border-amber-200'} shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:shadow-md transition">
                                        <div class="flex items-center space-x-3.5">
                                            <div class="w-11 h-11 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center text-lg font-black shadow shrink-0">
                                                <i class="fa-solid ${loc.icon || 'fa-island-tropical'}"></i>
                                            </div>
                                            <div>
                                                <div class="flex items-center gap-2">
                                                    <span class="px-2 py-0.5 bg-amber-200 text-amber-900 font-black text-[10px] rounded-full uppercase">
                                                        Titik #${idx + 1}
                                                    </span>
                                                    ${isFirst ? '<span class="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">🚩 Mulai</span>' : ''}
                                                    ${isLast ? '<span class="text-[10px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded-full">❌ Puncak Harta Karun</span>' : ''}
                                                </div>
                                                <h5 class="font-extrabold text-slate-800 text-sm mt-0.5">${gameEscapeHtml(loc.name || `Lokasi ${idx + 1}`)}</h5>
                                                <p class="text-xs text-slate-500">Game: <strong class="text-indigo-700 font-bold">${gameEscapeHtml(assignedGame.title)}</strong> (X: ${loc.x}%, Y: ${loc.y}%)</p>
                                            </div>
                                        </div>

                                        <div class="flex items-center gap-1.5 self-end sm:self-center">
                                            ${idx > 0 ? `
                                                <button type="button" onclick="moveLocationOrder('${mode.id}', ${idx}, -1)" class="p-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl transition cursor-pointer" title="Naikkan Urutan">
                                                    <i class="fa-solid fa-arrow-up text-xs"></i>
                                                </button>
                                            ` : ''}
                                            ${idx < mode.locations.length - 1 ? `
                                                <button type="button" onclick="moveLocationOrder('${mode.id}', ${idx}, 1)" class="p-2 bg-amber-100 hover:bg-amber-200 text-amber-900 rounded-xl transition cursor-pointer" title="Turunkan Urutan">
                                                    <i class="fa-solid fa-arrow-down text-xs"></i>
                                                </button>
                                            ` : ''}
                                            <button type="button" onclick="openAddLocationModal('${mode.id}', ${idx})" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1">
                                                <i class="fa-solid fa-pen-to-square text-xs"></i> <span>Edit</span>
                                            </button>
                                            <button type="button" onclick="deleteLocationFromRoadmap('${mode.id}', ${idx})" class="p-2 bg-rose-100 hover:bg-rose-200 text-rose-700 rounded-xl transition cursor-pointer" title="Hapus Lokasi">
                                                <i class="fa-solid fa-trash-can text-xs"></i>
                                            </button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <div class="p-4 bg-amber-100/90 border-t border-amber-300 flex items-center justify-between">
                    <span class="text-xs font-bold text-amber-900">${mode.locations.length} Lokasi Terdaftar</span>
                    <button type="button" onclick="closeRoadmapModal(); renderGameAdminModule(document.getElementById('view-container'));" class="px-6 py-2.5 bg-amber-800 hover:bg-amber-900 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer">
                        ✓ Selesai & Simpan Roadmap
                    </button>
                </div>
            </div>
        </div>
    `;

    const oldModal = document.getElementById('manage-roadmap-modal-bg');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.setAdventureMapTheme = async function(modeId, theme) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    mode.theme = theme;
    delete mode.customMapImage;
    await saveGameModesToBackend();
    showToast(`Tema peta diubah menjadi ${theme.toUpperCase()}`, 'success');
    openManageAdventureRoadmapModal(modeId);
};

window.handleUploadCustomMapImage = function(modeId, inputElement) {
    if (!inputElement || !inputElement.files || !inputElement.files[0]) return;
    const file = inputElement.files[0];
    if (!file.type.startsWith('image/')) {
        showToast("Harap pilih file gambar (JPG, PNG, WebP).", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        const base64Data = e.target.result;
        const modes = getGameModes();
        const mode = modes.find(m => m.id === modeId);
        if (!mode) return;

        mode.customMapImage = base64Data;
        mode.theme = 'custom';
        await saveGameModesToBackend();
        showToast("Gambar peta kustom berhasil diunggah!", "success");
        openManageAdventureRoadmapModal(modeId);
    };
    reader.readAsDataURL(file);
};

window.clearCustomMapImage = async function(modeId) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    delete mode.customMapImage;
    mode.theme = 'pirate';
    await saveGameModesToBackend();
    showToast("Gambar kustom dihapus. Kembali ke tema Bajak Laut.", "success");
    openManageAdventureRoadmapModal(modeId);
};

window.closeRoadmapModal = function() {
    const el = document.getElementById('manage-roadmap-modal-bg');
    if (el) el.remove();
};

window.openAddLocationModal = function(modeId, locIndex = null) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    const defaultCoords = [
        { x: 18, y: 78 },
        { x: 34, y: 48 },
        { x: 74, y: 30 },
        { x: 50, y: 62 },
        { x: 22, y: 26 },
        { x: 78, y: 72 },
        { x: 48, y: 18 }
    ];

    const isEdit = locIndex !== null && mode.locations[locIndex];
    const defCoord = defaultCoords[(locIndex !== null ? locIndex : mode.locations.length) % defaultCoords.length];

    const loc = isEdit ? mode.locations[locIndex] : {
        id: 'loc_' + Date.now(),
        name: `Lokasi #${mode.locations.length + 1}`,
        gameId: '',
        icon: 'fa-island-tropical',
        desc: '',
        x: defCoord.x,
        y: defCoord.y
    };

    const posX = typeof loc.x === 'number' ? loc.x : defCoord.x;
    const posY = typeof loc.y === 'number' ? loc.y : defCoord.y;

    // Load or initialize direct game content
    if (!Array.isArray(appState.eduGames)) {
        appState.eduGames = [];
    }
    const actualGameId = loc.gameId || 'GAME_LOC_' + loc.id;
    let game = appState.eduGames.find(g => g.id === actualGameId);
    if (!game) {
        game = {
            id: actualGameId,
            title: `Game ${loc.name}`,
            gameType: 'tebak_kata',
            subjectId: mode.subjectId || 'Semua Subject',
            classId: mode.classId || 'Semua Kelas',
            difficulty: 'Mudah',
            timeLimit: 120,
            rewardXp: 100,
            status: 'active',
            prompt: 'Selesaikan tantangan berikut dengan cermat!',
            answerKey: 'KOMPUTER',
            hints: ['Perangkat komputasi utama'],
            wordsToFind: ['MONITOR', 'MOUSE', 'MODEM'],
            pairs: [
                { term: 'RAM', match: 'Memori Sementara' }
            ],
            crosswordData: {
                gridSize: { rows: 8, cols: 8 },
                clues: [
                    { number: 1, direction: 'across', row: 1, col: 1, clue: 'Pertanyaan mendatar', answer: 'JAWAB' }
                ]
            }
        };
    }

    // Keep deep copy in temp editing state
    window._tempEditingGame = JSON.parse(JSON.stringify(game));
    window._customIconBase64 = loc.icon && (loc.icon.startsWith('data:') || loc.icon.startsWith('http')) ? loc.icon : '';

    const isCustomIcon = !!window._customIconBase64;
    const presetIconOptions = [
        { val: 'fa-island-tropical', label: '🏝️ Pulau Utama' },
        { val: 'fa-tree', label: '🌴 Hutan Rimba' },
        { val: 'fa-mountain', label: '🏔️ Gurun Pasir' },
        { val: 'fa-vault', label: '🏴‍☠️ Peti Harta Karun' },
        { val: 'fa-chess-castle', label: '🏰 Kastil Tua' },
        { val: 'fa-skull', label: '☠️ Gua Rahasia' },
        { val: 'fa-anchor', label: '⚓ Pelabuhan Kapal' },
        { val: 'fa-gem', label: '💎 Permata Ajaib' }
    ];

    const iconOptionsHtml = presetIconOptions.map(opt => `
        <option value="${opt.val}" ${loc.icon === opt.val ? 'selected' : ''}>${opt.label}</option>
    `).join('');

    const modalHtml = `
        <div id="add-loc-modal-bg" class="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-60 flex items-center justify-center p-3 overflow-y-auto animate-fade-in">
            <div class="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-4xl w-full overflow-hidden my-4 flex flex-col max-h-[92vh]">
                <!-- Modal Header -->
                <div class="bg-amber-700 p-5 text-white flex items-center justify-between shrink-0">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-amber-600/80 rounded-xl flex items-center justify-center text-white text-lg">
                            <i class="fa-solid fa-map-location-dot"></i>
                        </div>
                        <div>
                            <h4 class="font-black text-sm">${isEdit ? 'Ubah Titik Lokasi & Buat Game Langsung' : 'Tambah Titik Lokasi & Buat Game Langsung'}</h4>
                            <p class="text-[10px] text-amber-100 font-semibold">Konfigurasikan lokasi peta di panel kiri dan buat gamenya langsung di panel kanan.</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('add-loc-modal-bg').remove()" class="text-white hover:text-amber-200 transition cursor-pointer p-1">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <!-- Dual Column Form -->
                <form onsubmit="window.handleSaveLocationForm(event, '${mode.id}', ${locIndex})" class="p-6 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 text-xs font-medium text-slate-700">
                    
                    <!-- Left Panel: Location Settings -->
                    <div class="space-y-4 border-r border-slate-100 pr-0 md:pr-6">
                        <div class="bg-amber-50 p-3 rounded-2xl border border-amber-100 flex items-center gap-2 text-amber-950 mb-2">
                            <i class="fa-solid fa-circle-info text-amber-600 text-lg"></i>
                            <div>
                                <h5 class="font-extrabold text-[12px]">Pengaturan Titik Peta</h5>
                                <p class="text-[10px] text-amber-800">Tentukan nama, deskripsi petunjuk, serta ikon penanda untuk titik lokasi harta ini.</p>
                            </div>
                        </div>

                        <div>
                            <label class="block font-bold text-slate-800 mb-1">Nama Titik Lokasi <span class="text-rose-500">*</span></label>
                            <input type="text" id="loc-name" value="${gameEscapeAttr(loc.name)}" required placeholder="Contoh: Hutan Kosakata TIK" oninput="if(document.getElementById('game-title')){document.getElementById('game-title').value = 'Game ' + this.value}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-amber-500 font-bold">
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label class="block font-bold text-slate-800 mb-1">Ikon Titik Lokasi</label>
                                <select id="loc-icon" onchange="window.handleLocIconChange(this.value)" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-xs">
                                    ${iconOptionsHtml}
                                    <option value="custom" ${isCustomIcon ? 'selected' : ''}>🖼️ Upload Gambar Custom...</option>
                                </select>
                            </div>
                            <div class="flex items-center gap-2 pt-5">
                                <div id="custom-icon-preview-container" class="${isCustomIcon ? '' : 'hidden'} shrink-0">
                                    ${isCustomIcon ? `<img src="${window._customIconBase64}" class="w-10 h-10 rounded-xl border border-amber-300 object-cover shadow-sm" />` : ''}
                                </div>
                                <div id="custom-icon-upload-div" class="${isCustomIcon ? '' : 'hidden'} flex-1">
                                    <input type="file" id="custom-icon-file" accept="image/*" onchange="window.uploadCustomIconImage(this)" class="w-full text-[10px] text-slate-500 file:mr-2 file:py-1 file:px-2.5 file:rounded-xl file:border-0 file:text-[10px] file:font-bold file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200 cursor-pointer" />
                                </div>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-3">
                            <div>
                                <label class="block font-bold text-slate-800 mb-1">Posisi di Peta (Preset)</label>
                                <select onchange="window.applyLocationCoordPreset(this.value)" class="w-full px-2 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white text-[11px]">
                                    <option value="">Pilih Posisi Preset...</option>
                                    <option value="18,78">Pantai Kiri Bawah</option>
                                    <option value="34,48">Rimba Tengah</option>
                                    <option value="74,30">Bukit Kanan Atas</option>
                                    <option value="50,62">Pusat Harta Karun</option>
                                    <option value="22,26">Puncak Barat Laut</option>
                                    <option value="78,72">Laguna Tenggara</option>
                                </select>
                            </div>
                            <div class="p-1 bg-slate-50 border border-slate-100 rounded-2xl text-[10px] text-slate-500 flex flex-col justify-center text-center">
                                <span class="font-bold text-amber-700">💡 Tips Seret-Drop</span>
                                <span>Kamu juga bisa menyeret langsung titik lokasi ini di peta tanpa menyetel manual koordinat!</span>
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-3 bg-amber-50/70 p-3 rounded-xl border border-amber-200/50">
                            <div>
                                <label class="block font-bold text-amber-950 mb-1">Posisi X (% Kiri): <span id="val-loc-x" class="font-extrabold text-amber-700">${posX}%</span></label>
                                <input type="range" id="loc-x" min="3" max="97" value="${posX}" oninput="document.getElementById('val-loc-x').innerText = this.value + '%'" class="w-full accent-amber-600">
                            </div>
                            <div>
                                <label class="block font-bold text-amber-950 mb-1">Posisi Y (% Atas): <span id="val-loc-y" class="font-extrabold text-amber-700">${posY}%</span></label>
                                <input type="range" id="loc-y" min="3" max="97" value="${posY}" oninput="document.getElementById('val-loc-y').innerText = this.value + '%'" class="w-full accent-amber-600">
                            </div>
                        </div>

                        <div>
                            <label class="block font-bold text-slate-800 mb-1">Deskripsi / Petunjuk Penjelajah</label>
                            <textarea id="loc-desc" rows="2" placeholder="Petunjuk khusus atau pesan rintangan bagi siswa ketika mengklik lokasi ini..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white">${gameEscapeHtml(loc.desc || '')}</textarea>
                        </div>
                    </div>

                    <!-- Right Panel: Direct Game Creator / Editor (Langkah ke-2) -->
                    <div id="loc-game-editor-container" class="space-y-4">
                        <!-- Rendered Reactively via renderLocGameFields -->
                    </div>

                    <!-- Footer Options -->
                    <div class="col-span-1 md:col-span-2 pt-4 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                        <button type="button" onclick="document.getElementById('add-loc-modal-bg').remove()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer text-xs">
                            Batal
                        </button>
                        <button type="submit" class="px-6 py-2.5 bg-amber-700 hover:bg-amber-800 text-white font-extrabold rounded-xl shadow-md transition cursor-pointer text-xs flex items-center gap-1.5">
                            <i class="fa-solid fa-floppy-disk"></i>
                            <span>Simpan Titik & Konten Game</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const oldModal = document.getElementById('add-loc-modal-bg');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Initial render of Game Fields
    window.renderLocGameFields();
};

window.handleLocIconChange = function(val) {
    const uploadDiv = document.getElementById('custom-icon-upload-div');
    const previewDiv = document.getElementById('custom-icon-preview-container');
    if (val === 'custom') {
        if (uploadDiv) uploadDiv.classList.remove('hidden');
        if (previewDiv) previewDiv.classList.remove('hidden');
    } else {
        if (uploadDiv) uploadDiv.classList.add('hidden');
        if (previewDiv) previewDiv.classList.add('hidden');
        window._customIconBase64 = '';
        if (previewDiv) previewDiv.innerHTML = '';
    }
};

window.uploadCustomIconImage = function(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        reader.onload = function(e) {
            const base64 = e.target.result;
            window._customIconBase64 = base64;
            const previewDiv = document.getElementById('custom-icon-preview-container');
            if (previewDiv) {
                previewDiv.innerHTML = `<img src="${base64}" class="w-10 h-10 rounded-xl border border-amber-300 object-cover shadow-sm animate-pulse" />`;
            }
        };
        reader.readAsDataURL(file);
    }
};

window.renderLocGameFields = function() {
    const game = window._tempEditingGame;
    const container = document.getElementById('loc-game-editor-container');
    if (!container || !game) return;

    const gameTypesHtml = GAME_TYPES.map(t => `
        <option value="${t.id}" ${game.gameType === t.id ? 'selected' : ''}>${t.name}</option>
    `).join('');

    container.innerHTML = `
        <div class="space-y-4 text-slate-700">
            <div class="bg-emerald-50 p-3.5 rounded-2xl border border-emerald-100/60 flex items-center gap-2.5 text-emerald-950">
                <div class="w-9 h-9 rounded-xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center text-base shrink-0 font-bold">
                    <i class="fa-solid fa-gamepad"></i>
                </div>
                <div>
                    <h5 class="font-extrabold text-[12px]">Konfigurasi Game Langsung (Instan)</h5>
                    <p class="text-[10px] text-emerald-800 leading-normal">Buat & atur konten pertanyaan game langsung pada titik ini, tanpa terikat katalog eksternal.</p>
                </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label class="block font-bold text-slate-800 mb-1 uppercase text-[10px]">Judul Game <span class="text-rose-500">*</span></label>
                    <input type="text" id="game-title" value="${gameEscapeAttr(game.title || '')}" required placeholder="Contoh: Game Tebak Hardware" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold focus:bg-white text-xs">
                </div>
                <div>
                    <label class="block font-bold text-slate-800 mb-1 uppercase text-[10px]">Jenis Game <span class="text-rose-500">*</span></label>
                    <select id="game-type" onchange="window.handleLocGameTypeChange(this.value)" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-emerald-800 focus:bg-white text-xs">
                        ${gameTypesHtml}
                    </select>
                </div>
            </div>

            <div class="grid grid-cols-3 gap-2">
                <div>
                    <label class="block font-bold text-slate-800 mb-1 uppercase text-[10px]">Kesulitan</label>
                    <select id="game-difficulty" class="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] focus:bg-white">
                        <option value="Mudah" ${game.difficulty === 'Mudah' ? 'selected' : ''}>Mudah</option>
                        <option value="Sedang" ${game.difficulty === 'Sedang' ? 'selected' : ''}>Sedang</option>
                        <option value="Sulit" ${game.difficulty === 'Sulit' ? 'selected' : ''}>Sulit</option>
                    </select>
                </div>
                <div>
                    <label class="block font-bold text-slate-800 mb-1 uppercase text-[10px]">Waktu (Detik)</label>
                    <input type="number" id="game-timelimit" value="${game.timeLimit || 120}" min="10" class="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-center font-bold">
                </div>
                <div>
                    <label class="block font-bold text-slate-800 mb-1 uppercase text-[10px]">Reward XP</label>
                    <input type="number" id="game-xp" value="${game.rewardXp || 100}" min="10" class="w-full px-2 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-center font-black text-amber-700">
                </div>
            </div>

            <div>
                <label class="block font-bold text-slate-800 mb-1 uppercase text-[10px]">Instruksi / Soal Utama Game <span class="text-rose-500">*</span></label>
                <textarea id="edit-content-prompt" rows="2" placeholder="Masukkan instruksi atau narasi tantangan bagi siswa..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:bg-white text-xs">${gameEscapeHtml(game.prompt || '')}</textarea>
            </div>

            <!-- Dynamic Question Content Area -->
            <div id="loc-specialized-editor-body" class="max-h-[35vh] overflow-y-auto pr-1 space-y-4">
                ${renderSpecializedGameEditor(game)}
            </div>
        </div>
    `;
};

window.handleLocGameTypeChange = function(newType) {
    if (!window._tempEditingGame) return;
    window._tempEditingGame.gameType = newType;
    
    const typeInfo = GAME_TYPES.find(t => t.id === newType) || { name: 'Game' };
    window._tempEditingGame.prompt = `Selesaikan tantangan ${typeInfo.name} berikut dengan cermat!`;
    
    if (newType === 'word_search') {
        window._tempEditingGame.wordsToFind = ['MONITOR', 'MOUSE', 'MODEM'];
    } else if (newType === 'memory_match' || newType === 'labirin') {
        window._tempEditingGame.pairs = [{ term: 'A', match: 'B' }];
    } else if (newType === 'crossword') {
        window._tempEditingGame.crosswordData = {
            gridSize: { rows: 8, cols: 8 },
            clues: [
                { number: 1, direction: 'across', row: 1, col: 1, clue: 'Pertanyaan mendatar', answer: 'JAWAB' }
            ]
        };
    }
    
    window.renderLocGameFields();
};

window.applyLocationCoordPreset = function(val) {
    if (!val) return;
    const parts = val.split(',');
    if (parts.length === 2) {
        const xInput = document.getElementById('loc-x');
        const yInput = document.getElementById('loc-y');
        if (xInput) {
            xInput.value = parts[0];
            document.getElementById('val-loc-x').innerText = parts[0] + '%';
        }
        if (yInput) {
            yInput.value = parts[1];
            document.getElementById('val-loc-y').innerText = parts[1] + '%';
        }
    }
};

window.handleSaveLocationForm = async function(e, modeId, locIndex) {
    if (e) e.preventDefault();
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    const name = (document.getElementById('loc-name')?.value || '').trim();
    const desc = (document.getElementById('loc-desc')?.value || '').trim();
    const x = parseInt(document.getElementById('loc-x')?.value || '50', 10);
    const y = parseInt(document.getElementById('loc-y')?.value || '50', 10);

    let icon = document.getElementById('loc-icon')?.value || 'fa-island-tropical';
    if (icon === 'custom' && window._customIconBase64) {
        icon = window._customIconBase64;
    }

    // Save direct game
    const game = window._tempEditingGame;
    if (game) {
        game.title = (document.getElementById('game-title')?.value || '').trim() || `Game ${name}`;
        game.difficulty = document.getElementById('game-difficulty')?.value || 'Mudah';
        game.timeLimit = parseInt(document.getElementById('game-timelimit')?.value, 10) || 120;
        game.rewardXp = parseInt(document.getElementById('game-xp')?.value, 10) || 100;
        
        const promptEl = document.getElementById('edit-content-prompt');
        if (promptEl) game.prompt = promptEl.value.trim();

        // Read specific type fields
        const type = game.gameType;
        if (type === 'tebak_gambar') {
            const h1 = document.getElementById('edit-tg-hint-1')?.value.trim();
            const h2 = document.getElementById('edit-tg-hint-2')?.value.trim();
            const h3 = document.getElementById('edit-tg-hint-3')?.value.trim();
            const h4 = document.getElementById('edit-tg-hint-4')?.value.trim();
            game.hints = [
                h1 || 'Clue 1: Perhatikan bentuk awal gambar',
                h2 || 'Clue 2: Perhatikan fungsi utama objek ini',
                h3 || 'Clue 3: Perhatikan warna dan karakteristiknya',
                h4 || 'Clue 4: Nama objek ini sangat populer'
            ];
            
            const imgEl = document.getElementById('edit-content-image');
            if (imgEl) game.imageUrl = imgEl.value.trim();
            const answerEl = document.getElementById('edit-content-answer');
            if (answerEl) game.answerKey = answerEl.value.trim().toUpperCase();
        } else if (type === 'tebak_kata' || type === 'susun_kata') {
            const answerEl = document.getElementById('edit-content-answer');
            if (answerEl) game.answerKey = answerEl.value.trim().toUpperCase();
            const imgEl = document.getElementById('edit-content-image');
            if (imgEl) game.imageUrl = imgEl.value.trim();
            const hintEl = document.getElementById('edit-content-hint');
            if (hintEl && hintEl.value.trim()) game.hints = [hintEl.value.trim()];
        } else if (type === 'true_false') {
            const tfEl = document.getElementById('edit-content-tf-correct');
            if (tfEl) game.correctAnswer = tfEl.value;
            const expEl = document.getElementById('edit-content-explanation');
            if (expEl) game.explanation = expEl.value.trim();
            const imgEl = document.getElementById('edit-content-image');
            if (imgEl) game.imageUrl = imgEl.value.trim();
        } else if (type === 'word_search') {
            const wordTagsContainer = document.getElementById('word-search-tags');
            if (wordTagsContainer) {
                const wordSpans = wordTagsContainer.querySelectorAll('span');
                if (wordSpans.length > 0) {
                    game.wordsToFind = [];
                    wordSpans.forEach(span => {
                        let text = span.innerText || span.textContent || '';
                        text = text.replace(/×/g, '').trim().toUpperCase();
                        if (text) game.wordsToFind.push(text);
                    });
                }
            }
        } else if (type === 'labirin') {
            const labirinOptInputs = document.querySelectorAll('.labirin-opt-text');
            if (labirinOptInputs.length > 0) {
                const options = [];
                let correctKey = '';
                labirinOptInputs.forEach((optInput) => {
                    const val = optInput.value.trim();
                    if (val) {
                        options.push(val);
                        const parent = optInput.closest('div');
                        const radio = parent ? parent.querySelector('.labirin-opt-radio') : null;
                        if (radio && radio.checked) {
                            correctKey = val;
                        }
                    }
                });
                if (options.length > 0) {
                    game.options = options;
                    if (correctKey) game.answerKey = correctKey;
                    else if (!game.answerKey) game.answerKey = options[0];
                }
            }
        } else if (type === 'memory_match') {
            const pairTermInputs = document.querySelectorAll('.pair-term-input');
            const pairMatchInputs = document.querySelectorAll('.pair-match-input');
            if (pairTermInputs.length > 0) {
                game.pairs = [];
                pairTermInputs.forEach((tInput, idx) => {
                    const term = tInput.value.trim();
                    const match = pairMatchInputs[idx] ? pairMatchInputs[idx].value.trim() : '';
                    if (term && match) game.pairs.push({ term, match });
                });
            }
        } else if (type === 'crossword') {
            const cwRows = document.querySelectorAll('.cw-clue-row');
            if (cwRows.length > 0) {
                const clues = [];
                cwRows.forEach((row, idx) => {
                    const num = parseInt(row.querySelector('.cw-no')?.value, 10) || (idx + 1);
                    const dir = row.querySelector('.cw-dir')?.value || 'across';
                    const r = parseInt(row.querySelector('.cw-row')?.value, 10) || 1;
                    const c = parseInt(row.querySelector('.cw-col')?.value, 10) || 1;
                    const clue = row.querySelector('.cw-clue')?.value.trim() || '';
                    const answer = row.querySelector('.cw-answer')?.value.trim().toUpperCase() || '';
                    const points = parseInt(row.querySelector('.cw-points')?.value, 10) || 20;
                    const initialHint = row.querySelector('.cw-hint-check')?.checked !== false;

                    if (clue && answer) {
                        clues.push({ number: num, direction: dir, row: r, col: c, clue, answer, points, initialHint });
                    }
                });
                if (clues.length > 0) {
                    game.crosswordData = { gridSize: { rows: 8, cols: 8 }, clues };
                }
            }
        }

        // Add or update to appState.eduGames
        if (!Array.isArray(appState.eduGames)) {
            appState.eduGames = [];
        }
        const existingIdx = appState.eduGames.findIndex(g => g.id === game.id);
        if (existingIdx !== -1) {
            appState.eduGames[existingIdx] = game;
        } else {
            appState.eduGames.push(game);
        }

        // Try putting to server
        try {
            await fetch(`/api/games/${game.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(game)
            });
        } catch (err) {
            console.error("Local save only for direct game");
        }
    }

    const newLoc = {
        id: locIndex !== null && mode.locations[locIndex] ? mode.locations[locIndex].id : 'loc_' + Date.now(),
        name,
        gameId: game ? game.id : (locIndex !== null && mode.locations[locIndex] ? mode.locations[locIndex].gameId : ''),
        icon,
        desc,
        x,
        y
    };

    if (locIndex !== null && mode.locations[locIndex]) {
        mode.locations[locIndex] = newLoc;
    } else {
        mode.locations.push(newLoc);
    }

    await saveGameModesToBackend();
    document.getElementById('add-loc-modal-bg')?.remove();
    showToast("Titik lokasi peta & Konten Game berhasil disimpan!", "success");
    openManageAdventureRoadmapModal(modeId);
};

window.moveLocationOrder = async function(modeId, index, delta) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode || !mode.locations) return;

    const newIdx = index + delta;
    if (newIdx < 0 || newIdx >= mode.locations.length) return;

    const temp = mode.locations[index];
    mode.locations[index] = mode.locations[newIdx];
    mode.locations[newIdx] = temp;

    await saveGameModesToBackend();
    openManageAdventureRoadmapModal(modeId);
};

window.deleteLocationFromRoadmap = function(modeId, index) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode || !mode.locations) return;
    const loc = mode.locations[index];

    showGameConfirmModal({
        title: 'Hapus Titik Lokasi Peta',
        message: `Apakah Anda yakin ingin menghapus titik lokasi "${loc?.name || `Lokasi #${index + 1}`}" dari peta petualangan ini?`,
        confirmText: 'Ya, Hapus Lokasi',
        onConfirm: async () => {
            mode.locations.splice(index, 1);
            await saveGameModesToBackend();
            document.getElementById('add-loc-modal-bg')?.remove();
            showToast("Titik lokasi telah dihapus.", "success");
            openManageAdventureRoadmapModal(modeId);
        }
    });
};

// ============================================================================
// TOWER QUEST EDITOR MODAL
// ============================================================================
window.openManageTowerQuestModal = function(modeId) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    if (!Array.isArray(mode.floors)) mode.floors = [];
    const games = Array.isArray(appState.eduGames) && appState.eduGames.length > 0 ? appState.eduGames : SAMPLE_SEED_GAMES;

    const modalHtml = `
        <div id="manage-tower-modal-bg" class="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-start justify-center p-4 overflow-y-auto animate-fade-in">
            <div class="bg-slate-900 border-2 border-indigo-500/40 rounded-3xl shadow-2xl max-w-3xl w-full overflow-hidden my-4 sm:my-8 flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)] relative text-white">
                <div class="bg-gradient-to-r from-indigo-950 via-slate-900 to-purple-950 p-6 text-white flex items-center justify-between shadow-md border-b border-indigo-800/60 shrink-0">
                    <div class="flex items-center space-x-3">
                        <div class="w-12 h-12 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-2xl font-black shadow-lg">
                            🏰
                        </div>
                        <div>
                            <span class="text-[10px] font-extrabold text-indigo-300 uppercase tracking-widest bg-indigo-950 px-2.5 py-0.5 rounded-full border border-indigo-800 inline-block">
                                Quest Menara Bertingkat
                            </span>
                            <h3 class="font-black text-xl text-white">${gameEscapeHtml(mode.title)}</h3>
                            <p class="text-xs text-slate-300">Kelola jumlah lantai quest menara dari paling bawah hingga puncak, beserta warna background tiap lantai.</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeTowerModal()" class="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
                    <div class="bg-indigo-950/80 p-4 rounded-2xl border border-indigo-700/60 text-indigo-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div class="space-y-0.5">
                            <strong class="font-black text-amber-300 flex items-center gap-1.5"><i class="fa-solid fa-wand-magic-sparkles text-amber-400"></i> Warna & Aturan Menara:</strong>
                            <p class="text-[11px] text-slate-300">Setiap naik lantai, warna background quest berubah otomatis atau dapat diatur manual per lantai.</p>
                        </div>
                        <div class="flex items-center gap-2 shrink-0">
                            <button type="button" onclick="autoApplyTowerFloorColors('${mode.id}')" class="px-3.5 py-2 bg-gradient-to-r from-purple-600 to-amber-500 hover:opacity-90 text-white font-extrabold rounded-xl shadow transition shrink-0 flex items-center gap-1.5 cursor-pointer text-xs" title="Otomatisasi gradasi warna lantai dari bawah hingga puncak">
                                <i class="fa-solid fa-palette text-xs"></i> <span>Otomatisasi Warna</span>
                            </button>
                            <button type="button" onclick="openAddFloorModal('${mode.id}', null)" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow transition shrink-0 flex items-center gap-1.5 cursor-pointer text-xs">
                                <i class="fa-solid fa-plus text-xs"></i> <span>Tambah Lantai</span>
                            </button>
                        </div>
                    </div>

                    <div class="space-y-3">
                        ${mode.floors.length === 0 ? `
                            <div class="p-10 text-center text-slate-400 text-xs bg-slate-950 rounded-2xl border-2 border-dashed border-slate-800">
                                Belum ada lantai menara. Klik "Tambah Lantai" untuk menambahkan lantai baru!
                            </div>
                        ` : `
                            <div class="space-y-3">
                                <div class="text-center py-2.5 bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 rounded-2xl border border-amber-500/40 text-amber-300 text-xs font-black flex items-center justify-center gap-2 shadow-sm">
                                    <span>👑</span> <span>PUNCAK MENARA QUEST (MAHKOTA EMAS)</span>
                                </div>

                                ${[...mode.floors].reverse().map((flr, revIdx) => {
                                    const actualIdx = mode.floors.length - 1 - revIdx;
                                    const assignedGame = games.find(g => g.id === flr.gameId) || { title: 'Belum dipasang game' };
                                    const isBottom = actualIdx === 0;
                                    const bgStyle = getTowerFloorBgStyle(flr, actualIdx, mode.floors.length);

                                    return `
                                        <div class="p-5 rounded-2xl border ${isBottom ? 'border-amber-500/60' : 'border-slate-700/80'} shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition duration-200" style="background: ${bgStyle};">
                                            <div class="flex items-center space-x-4">
                                                <div class="w-12 h-12 rounded-2xl ${isBottom ? 'bg-amber-500 text-slate-950 font-black' : 'bg-white/20 text-white font-bold backdrop-blur-xs'} flex items-center justify-center text-base shadow-md shrink-0 border border-white/20">
                                                    L${actualIdx + 1}
                                                </div>
                                                <div>
                                                    <div class="flex items-center gap-2 flex-wrap">
                                                        <span class="px-2.5 py-0.5 bg-slate-950/80 text-amber-400 font-extrabold text-[10px] rounded-full uppercase border border-amber-500/30">
                                                            Lantai #${actualIdx + 1}
                                                        </span>
                                                        ${isBottom ? '<span class="text-[10px] font-bold text-emerald-300 bg-emerald-950/90 px-2 py-0.5 rounded-full border border-emerald-700">🚪 Lantai Pintu Gerbang (Terbuka)</span>' : ''}
                                                        <span class="text-[10px] font-bold text-slate-200 bg-slate-950/60 px-2 py-0.5 rounded-full border border-white/10">
                                                            ${flr.bgMode === 'manual' ? '🎨 Manual' : '⚡ Otomatis'}
                                                        </span>
                                                    </div>
                                                    <h4 class="font-extrabold text-white text-sm mt-1 drop-shadow-sm">${gameEscapeHtml(flr.name || `Lantai ${actualIdx + 1}`)}</h4>
                                                    <p class="text-xs text-slate-200 mt-0.5">Game: <span class="font-bold text-amber-300">${gameEscapeHtml(assignedGame.title)}</span></p>
                                                </div>
                                            </div>

                                            <div class="flex items-center gap-2 self-end sm:self-center bg-slate-950/70 backdrop-blur-xs p-1.5 rounded-2xl border border-white/10">
                                                ${actualIdx < mode.floors.length - 1 ? `
                                                    <button type="button" onclick="moveFloorOrder('${mode.id}', ${actualIdx}, 1)" class="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition cursor-pointer" title="Naikkan Ke Atas">
                                                        <i class="fa-solid fa-arrow-up text-xs"></i>
                                                    </button>
                                                ` : ''}
                                                ${actualIdx > 0 ? `
                                                    <button type="button" onclick="moveFloorOrder('${mode.id}', ${actualIdx}, -1)" class="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition cursor-pointer" title="Turunkan Ke Bawah">
                                                        <i class="fa-solid fa-arrow-down text-xs"></i>
                                                    </button>
                                                ` : ''}
                                                <button type="button" onclick="openAddFloorModal('${mode.id}', ${actualIdx})" class="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1">
                                                    <i class="fa-solid fa-pen-to-square text-xs"></i> <span>Edit</span>
                                                </button>
                                                <button type="button" onclick="deleteFloorFromTower('${mode.id}', ${actualIdx})" class="p-2 bg-rose-950 hover:bg-rose-900 text-rose-300 rounded-xl transition cursor-pointer" title="Hapus Lantai">
                                                    <i class="fa-solid fa-trash-can text-xs"></i>
                                                </button>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        `}
                    </div>
                </div>

                <div class="p-5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-400">${mode.floors.length} Lantai Menara Dikonfigurasi</span>
                    <button type="button" onclick="closeTowerModal(); renderGameAdminModule(document.getElementById('view-container'));" class="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer">
                        ✓ Selesai & Simpan Menara
                    </button>
                </div>
            </div>
        </div>
    `;

    const oldModal = document.getElementById('manage-tower-modal-bg');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.closeTowerModal = function() {
    const el = document.getElementById('manage-tower-modal-bg');
    if (el) el.remove();
};

const TOWER_COLOR_PRESETS = [
    { id: 'slate', name: 'Dungeon Slate (Dasar)', gradient: 'linear-gradient(135deg, #0f172a, #1e293b)', bgHex: '#0f172a' },
    { id: 'emerald', name: 'Obsidian Emerald (Hutan)', gradient: 'linear-gradient(135deg, #064e3b, #047857)', bgHex: '#064e3b' },
    { id: 'cyan', name: 'Glacial Ice (Kubah Es)', gradient: 'linear-gradient(135deg, #0e7490, #0284c7)', bgHex: '#0e7490' },
    { id: 'sapphire', name: 'Deep Sapphire (Samudra)', gradient: 'linear-gradient(135deg, #1e3a8a, #2563eb)', bgHex: '#1e3a8a' },
    { id: 'purple', name: 'Mystic Spire (Kastil Sihir)', gradient: 'linear-gradient(135deg, #581c87, #9333ea)', bgHex: '#581c87' },
    { id: 'twilight', name: 'Twilight Sunset (Senja)', gradient: 'linear-gradient(135deg, #7c2d12, #ea580c)', bgHex: '#7c2d12' },
    { id: 'magma', name: 'Magma Crimson (Bara Api)', gradient: 'linear-gradient(135deg, #7f1d1d, #dc2626)', bgHex: '#7f1d1d' },
    { id: 'amber', name: 'Amber Treasury (Harta Karun)', gradient: 'linear-gradient(135deg, #78350f, #d97706)', bgHex: '#78350f' },
    { id: 'gold', name: 'Golden Apex (Puncak Emas)', gradient: 'linear-gradient(135deg, #854d0e, #eab308)', bgHex: '#854d0e' },
    { id: 'cyber', name: 'Cyber Teal (Futuristik)', gradient: 'linear-gradient(135deg, #022c22, #0d9488)', bgHex: '#022c22' },
    { id: 'dragon', name: 'Dragon Blood (Kastil Merah)', gradient: 'linear-gradient(135deg, #4c0519, #be123c)', bgHex: '#4c0519' }
];

window.getTowerFloorBgStyle = function(flr, floorIndex, totalFloors) {
    if (flr && flr.bgMode === 'manual') {
        if (flr.bgGradient && flr.bgGradient !== 'auto') return flr.bgGradient;
        if (flr.bgColor) return flr.bgColor;
    }
    if (flr && flr.bgGradient && flr.bgGradient !== 'auto') {
        return flr.bgGradient;
    }

    // Progressive automatic gradients based on floor elevation:
    const autoGradients = [
        'linear-gradient(135deg, #0f172a, #1e293b)', // L1: Deep Slate Ground
        'linear-gradient(135deg, #064e3b, #047857)', // L2: Emerald Grove
        'linear-gradient(135deg, #0e7490, #0284c7)', // L3: Cyan Spire
        'linear-gradient(135deg, #1e3a8a, #2563eb)', // L4: Sapphire Bastion
        'linear-gradient(135deg, #581c87, #9333ea)', // L5: Mystic Purple
        'linear-gradient(135deg, #7c2d12, #ea580c)', // L6: Twilight Citadel
        'linear-gradient(135deg, #7f1d1d, #dc2626)', // L7: Magma Chambers
        'linear-gradient(135deg, #78350f, #d97706)', // L8: Amber Vault
        'linear-gradient(135deg, #854d0e, #eab308)'  // L9+: Golden Peak
    ];

    if (!totalFloors || totalFloors <= 1) return autoGradients[0];
    const pct = Math.min(Math.max(floorIndex / (totalFloors - 1), 0), 1);
    const gradIdx = Math.min(Math.floor(pct * (autoGradients.length - 1)), autoGradients.length - 1);
    return autoGradients[gradIdx];
};

window.autoApplyTowerFloorColors = async function(modeId) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode || !Array.isArray(mode.floors) || mode.floors.length === 0) {
        showToast("Belum ada lantai untuk diwarnai", "warning");
        return;
    }
    const total = mode.floors.length;
    mode.floors.forEach((flr, idx) => {
        flr.bgMode = 'auto';
        flr.bgGradient = getTowerFloorBgStyle(null, idx, total);
        flr.bgColor = '';
        flr.bgPreset = 'auto';
    });
    await saveGameModesToBackend();
    showToast("✨ Warna latar gradasi semua lantai menara berhasil diotomatisasi!", "success");
    openManageTowerQuestModal(modeId);
};

window.openAddFloorModal = function(modeId, floorIndex = null) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    const isEdit = floorIndex !== null && mode.floors[floorIndex];
    const flr = isEdit ? mode.floors[floorIndex] : {
        id: 'flr_' + Date.now(),
        name: `Lantai #${mode.floors.length + 1}`,
        gameId: appState.eduGames[0]?.id || '',
        desc: '',
        bgMode: 'auto',
        bgPreset: 'auto',
        bgGradient: '',
        bgColor: '#0f172a'
    };

    const games = Array.isArray(appState.eduGames) && appState.eduGames.length > 0 ? appState.eduGames : SAMPLE_SEED_GAMES;
    const currentActualIdx = isEdit ? floorIndex : mode.floors.length;
    const currentTotal = isEdit ? mode.floors.length : mode.floors.length + 1;
    const currentStyle = getTowerFloorBgStyle(flr, currentActualIdx, currentTotal);

    const modalHtml = `
        <div id="add-flr-modal-bg" class="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-60 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
            <div class="bg-slate-900 text-white rounded-3xl border border-slate-800 shadow-2xl max-w-lg w-full overflow-hidden my-8">
                <div class="bg-gradient-to-r from-indigo-900 to-purple-900 p-5 text-white flex items-center justify-between border-b border-indigo-800">
                    <h4 class="font-black text-base">${isEdit ? 'Edit Lantai Menara' : 'Tambah Lantai Menara Baru'}</h4>
                    <button type="button" onclick="document.getElementById('add-flr-modal-bg').remove()" class="text-white hover:text-indigo-200 transition cursor-pointer">
                        <i class="fa-solid fa-xmark text-lg"></i>
                    </button>
                </div>

                <form onsubmit="handleSaveFloorForm(event, '${mode.id}', ${floorIndex})" class="p-6 space-y-4 text-xs font-medium text-slate-300">
                    <div>
                        <label class="block font-bold text-white mb-1">Nama Lantai <span class="text-rose-500">*</span></label>
                        <input type="text" id="flr-name" value="${gameEscapeAttr(flr.name)}" required placeholder="Contoh: Lantai 1: Hardware Dasar" class="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl focus:bg-slate-950 font-bold text-white">
                    </div>

                    <div>
                        <label class="block font-bold text-white mb-1">Pilih Game Edukasi Terhubung <span class="text-rose-500">*</span></label>
                        <select id="flr-game" class="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl focus:bg-slate-950 font-bold text-white">
                            ${games.map(g => `
                                <option value="${g.id}" ${flr.gameId === g.id ? 'selected' : ''}>[${g.gameType}] ${gameEscapeHtml(g.title)}</option>
                            `).join('')}
                        </select>
                    </div>

                    <div>
                        <label class="block font-bold text-white mb-1">Deskripsi Lantai</label>
                        <textarea id="flr-desc" rows="2" placeholder="Petunjuk khusus lantai ini..." class="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white">${gameEscapeHtml(flr.desc || '')}</textarea>
                    </div>

                    <!-- PENGATURAN WARNA BACKGROUND LANTAI -->
                    <div class="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 space-y-3">
                        <div class="flex items-center justify-between">
                            <label class="block font-black text-white text-xs flex items-center gap-1.5">
                                <i class="fa-solid fa-palette text-amber-400"></i> Warna Background Quest Lantai
                            </label>
                            <div class="flex items-center gap-2">
                                <label class="inline-flex items-center gap-1 text-[11px] font-bold text-slate-300 cursor-pointer">
                                    <input type="radio" name="flr-bg-mode" value="auto" ${flr.bgMode !== 'manual' ? 'checked' : ''} onchange="toggleFloorBgMode(this.value)" class="accent-indigo-500">
                                    <span>Otomatis</span>
                                </label>
                                <label class="inline-flex items-center gap-1 text-[11px] font-bold text-slate-300 cursor-pointer">
                                    <input type="radio" name="flr-bg-mode" value="manual" ${flr.bgMode === 'manual' ? 'checked' : ''} onchange="toggleFloorBgMode(this.value)" class="accent-indigo-500">
                                    <span>Manual</span>
                                </label>
                            </div>
                        </div>

                        <!-- Live Swatch Preview -->
                        <div id="flr-preview-swatch" class="p-4 rounded-xl border border-white/20 text-center transition-all duration-300 shadow-inner" style="background: ${gameEscapeAttr(currentStyle)};">
                            <span class="font-extrabold text-white text-xs drop-shadow-md">Preview Tampilan Lantai Quest</span>
                        </div>

                        <!-- Manual Color Picker Options -->
                        <div id="flr-manual-color-section" class="${flr.bgMode === 'manual' ? '' : 'hidden'} space-y-3 pt-1">
                            <div>
                                <label class="block text-[11px] font-bold text-slate-400 mb-1.5">Pilih Preset Tema Warna:</label>
                                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    ${TOWER_COLOR_PRESETS.map(p => `
                                        <button type="button" onclick="selectFloorColorPreset('${p.gradient}', '${p.bgHex}')" class="p-2 rounded-xl text-left border border-white/10 hover:border-amber-400 transition cursor-pointer flex items-center gap-2 group" style="background: ${p.gradient};">
                                            <span class="w-3 h-3 rounded-full bg-white/40 group-hover:scale-125 transition"></span>
                                            <span class="text-[10px] font-black text-white truncate drop-shadow-xs">${p.name}</span>
                                        </button>
                                    `).join('')}
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-3 pt-1">
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-400 mb-1">Custom Warna Hex (Solid):</label>
                                    <div class="flex items-center gap-2">
                                        <input type="color" id="flr-color-picker" value="${gameEscapeAttr(flr.bgColor || '#0f172a')}" onchange="updateFloorCustomColor(this.value)" class="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0 p-0">
                                        <input type="text" id="flr-color-hex" value="${gameEscapeAttr(flr.bgColor || '#0f172a')}" oninput="updateFloorCustomColor(this.value)" class="flex-1 px-2.5 py-1 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono uppercase">
                                    </div>
                                </div>
                                <div>
                                    <label class="block text-[10px] font-bold text-slate-400 mb-1">Custom CSS Gradient:</label>
                                    <input type="text" id="flr-gradient-val" value="${gameEscapeAttr(flr.bgGradient || '')}" placeholder="linear-gradient(...)" oninput="updateFloorCustomGradient(this.value)" class="w-full px-2.5 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white font-mono">
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="pt-3 flex items-center justify-end gap-2 border-t border-slate-800">
                        <button type="button" onclick="document.getElementById('add-flr-modal-bg').remove()" class="px-4 py-2 bg-slate-800 text-slate-300 font-bold rounded-xl cursor-pointer">
                            Batal
                        </button>
                        <button type="submit" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold rounded-xl shadow cursor-pointer">
                            Simpan Lantai
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const oldModal = document.getElementById('add-flr-modal-bg');
    if (oldModal) oldModal.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.toggleFloorBgMode = function(mode) {
    const sec = document.getElementById('flr-manual-color-section');
    const swatch = document.getElementById('flr-preview-swatch');
    if (mode === 'manual') {
        if (sec) sec.classList.remove('hidden');
        const grad = document.getElementById('flr-gradient-val')?.value;
        const hex = document.getElementById('flr-color-hex')?.value;
        if (swatch) swatch.style.background = grad || hex || '#0f172a';
    } else {
        if (sec) sec.classList.add('hidden');
        if (swatch) swatch.style.background = 'linear-gradient(135deg, #0f172a, #1e293b)';
    }
};

window.selectFloorColorPreset = function(gradient, bgHex) {
    const gradInput = document.getElementById('flr-gradient-val');
    const hexInput = document.getElementById('flr-color-hex');
    const colorPicker = document.getElementById('flr-color-picker');
    const swatch = document.getElementById('flr-preview-swatch');

    if (gradInput) gradInput.value = gradient;
    if (hexInput) hexInput.value = bgHex;
    if (colorPicker) colorPicker.value = bgHex;
    if (swatch) swatch.style.background = gradient;
};

window.updateFloorCustomColor = function(hex) {
    const hexInput = document.getElementById('flr-color-hex');
    const colorPicker = document.getElementById('flr-color-picker');
    const swatch = document.getElementById('flr-preview-swatch');

    if (hexInput) hexInput.value = hex;
    if (colorPicker) colorPicker.value = hex;
    if (swatch) swatch.style.background = hex;
};

window.updateFloorCustomGradient = function(grad) {
    const swatch = document.getElementById('flr-preview-swatch');
    if (swatch && grad) swatch.style.background = grad;
};

window.handleSaveFloorForm = async function(e, modeId, floorIndex) {
    if (e) e.preventDefault();
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode) return;

    const name = (document.getElementById('flr-name')?.value || '').trim();
    const gameId = document.getElementById('flr-game')?.value;
    const desc = (document.getElementById('flr-desc')?.value || '').trim();
    
    const bgModeRadio = document.querySelector('input[name="flr-bg-mode"]:checked');
    const bgMode = bgModeRadio ? bgModeRadio.value : 'auto';
    const bgGradient = (document.getElementById('flr-gradient-val')?.value || '').trim();
    const bgColor = (document.getElementById('flr-color-hex')?.value || '').trim();

    const newFlr = {
        id: floorIndex !== null && mode.floors[floorIndex] ? mode.floors[floorIndex].id : 'flr_' + Date.now(),
        name,
        gameId,
        desc,
        bgMode,
        bgGradient: bgMode === 'manual' ? bgGradient : '',
        bgColor: bgMode === 'manual' ? bgColor : ''
    };

    if (floorIndex !== null && mode.floors[floorIndex]) {
        mode.floors[floorIndex] = newFlr;
    } else {
        mode.floors.push(newFlr);
    }

    await saveGameModesToBackend();
    document.getElementById('add-flr-modal-bg')?.remove();
    showToast("Lantai menara & tema warna berhasil disimpan!", "success");
    openManageTowerQuestModal(modeId);
};

window.moveFloorOrder = async function(modeId, index, delta) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode || !mode.floors) return;

    const newIdx = index + delta;
    if (newIdx < 0 || newIdx >= mode.floors.length) return;

    const temp = mode.floors[index];
    mode.floors[index] = mode.floors[newIdx];
    mode.floors[newIdx] = temp;

    await saveGameModesToBackend();
    openManageTowerQuestModal(modeId);
};

window.deleteFloorFromTower = function(modeId, index) {
    const modes = getGameModes();
    const mode = modes.find(m => m.id === modeId);
    if (!mode || !mode.floors) return;
    const flr = mode.floors[index];

    showGameConfirmModal({
        title: 'Hapus Lantai Menara',
        message: `Apakah Anda yakin ingin menghapus "${flr?.name || `Lantai #${index + 1}`}" dari Quest Menara ini?`,
        confirmText: 'Ya, Hapus Lantai',
        onConfirm: async () => {
            mode.floors.splice(index, 1);
            await saveGameModesToBackend();
            document.getElementById('add-flr-modal-bg')?.remove();
            showToast("Lantai menara telah dihapus.", "success");
            openManageTowerQuestModal(modeId);
        }
    });
};

window.toggleGameStatus = async function(gameId) {
    if (!Array.isArray(appState.eduGames) || appState.eduGames.length === 0) {
        appState.eduGames = [...SAMPLE_SEED_GAMES];
    }
    const game = appState.eduGames.find(g => g.id === gameId);
    if (!game) return;

    game.status = game.status === 'active' ? 'inactive' : 'active';
    try {
        await fetch(`/api/games/${gameId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(game)
        });
        showToast(`Status game ${game.title} diubah menjadi ${game.status === 'active' ? 'Aktif' : 'Nonaktif'}.`, 'success');
        renderGameAdminModule(document.getElementById('view-container'));
    } catch (err) {
        showToast("Gagal memperbarui status game", "error");
    }
};

window.deleteGameEntry = function(gameId) {
    if (!Array.isArray(appState.eduGames)) appState.eduGames = [];
    const game = appState.eduGames.find(g => g.id === gameId);
    const gameTitle = game?.title || 'Game Edukasi';

    showGameConfirmModal({
        title: 'Hapus Game Edukasi',
        message: `Apakah Anda yakin ingin menghapus game "${gameTitle}"? Data dan riwayat skor game ini akan dihapus secara permanen.`,
        confirmText: 'Ya, Hapus Game',
        onConfirm: async () => {
            try {
                await fetch(`/api/games/${gameId}`, { method: 'DELETE' });
                appState.eduGames = appState.eduGames.filter(g => g.id !== gameId);
                showToast("Game berhasil dihapus", "success");
                renderGameAdminModule(document.getElementById('view-container'));
            } catch (err) {
                showToast("Gagal menghapus game", "error");
            }
        }
    });
};

// ============================================================================
// GAME EDITOR MODAL (2-STEP CREATION & SPECIALIZED GAME CONTENT MANAGER)
// ============================================================================

// STEP 1: Form Inisialisasi Metadata Game Baru
window.openCreateGameModal = function() {
    window.openGameMetadataModal(null);
};

// Edit Metadata untuk Game yang sudah ada
window.openEditGameMetadataModal = function(gameId) {
    if (!Array.isArray(appState.eduGames) || appState.eduGames.length === 0) {
        appState.eduGames = [...SAMPLE_SEED_GAMES];
    }
    const game = appState.eduGames.find(g => g.id === gameId);
    if (!game) return;
    window.openGameMetadataModal(game);
};

// Backwards compatibility wrapper
window.openEditGameModal = function(gameId) {
    window.openGameContentEditorModal(gameId);
};

// Step 1 Modal: Inisialisasi Jenis Game, Mapel, Kelas, Waktu, XP
window.openGameMetadataModal = function(existingGame = null) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const isEdit = !!existingGame;
    const g = existingGame || {
        id: 'GAME_' + Date.now(),
        title: '',
        gameType: 'tebak_kata',
        subjectId: 'Semua Subject',
        classId: 'Semua Kelas',
        difficulty: 'Mudah',
        timeLimit: 120,
        rewardXp: 100,
        status: 'active'
    };

    const subjects = Array.isArray(appState.subjects) ? appState.subjects : [];

    modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div class="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[90vh] overflow-hidden">
                <!-- Header -->
                <div class="p-6 bg-slate-900 text-white flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white text-lg font-bold shadow-md">
                            <i class="fa-solid fa-gamepad"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-base">${isEdit ? 'Edit Metadata Game Edukasi' : 'Buat Game Baru (Langkah 1/2)'}</h3>
                            <p class="text-xs text-slate-400">${isEdit ? 'Ubah informasi umum game edukasi.' : 'Atur jenis game, mata pelajaran, target kelas, durasi & reward nilai.'}</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="text-slate-400 hover:text-white p-2 text-lg">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Form Metadata -->
                <form id="game-metadata-form" onsubmit="${isEdit ? 'saveGameMetadataOnly(event)' : 'saveInitialGameMetadata(event)'}" class="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
                    <input type="hidden" id="edit-game-id" value="${g.id}">

                    <div class="space-y-1">
                        <label class="block font-bold text-slate-700 uppercase">Judul Permainan <span class="text-rose-500">*</span></label>
                        <input type="text" id="edit-game-title" required value="${gameEscapeAttr(g.title || '')}" placeholder="Contoh: Teka-Teki Silang Komputer Dasar" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>

                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="space-y-1">
                            <label class="block font-bold text-slate-700 uppercase">Jenis Game <span class="text-rose-500">*</span></label>
                            <select id="edit-game-type" ${isEdit ? 'disabled' : ''} class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-emerald-800">
                                ${GAME_TYPES.map(t => `<option value="${t.id}" ${g.gameType === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
                            </select>
                        </div>

                        <div class="space-y-1">
                            <label class="block font-bold text-slate-700 uppercase">Mata Pelajaran</label>
                            <select id="edit-game-subject" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                                <option value="Semua Subject">Semua Mata Pelajaran</option>
                                ${subjects.map(s => `<option value="${gameEscapeAttr(s.name || s.id)}" ${g.subjectId === (s.name || s.id) ? 'selected' : ''}>${gameEscapeHtml(s.name || s.id)}</option>`).join('')}
                            </select>
                        </div>

                        <div class="space-y-1">
                            <label class="block font-bold text-slate-700 uppercase">Target Kelas</label>
                            <select id="edit-game-class" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                                <option value="Semua Kelas" ${g.classId === 'Semua Kelas' ? 'selected' : ''}>Semua Kelas</option>
                                <option value="Kelas X" ${g.classId === 'Kelas X' ? 'selected' : ''}>Kelas X</option>
                                <option value="Kelas XI" ${g.classId === 'Kelas XI' ? 'selected' : ''}>Kelas XI</option>
                                <option value="Kelas XII" ${g.classId === 'Kelas XII' ? 'selected' : ''}>Kelas XII</option>
                            </select>
                        </div>

                        <div class="space-y-1">
                            <label class="block font-bold text-slate-700 uppercase">Tingkat Kesulitan</label>
                            <select id="edit-game-difficulty" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                                <option value="Mudah" ${g.difficulty === 'Mudah' ? 'selected' : ''}>Mudah</option>
                                <option value="Sedang" ${g.difficulty === 'Sedang' ? 'selected' : ''}>Sedang</option>
                                <option value="Sulit" ${g.difficulty === 'Sulit' ? 'selected' : ''}>Sulit</option>
                            </select>
                        </div>

                        <div class="space-y-1">
                            <label class="block font-bold text-slate-700 uppercase">Batas Waktu (Detik)</label>
                            <input type="number" id="edit-game-timelimit" value="${g.timeLimit || 120}" min="0" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                        </div>

                        <div class="space-y-1">
                            <label class="block font-bold text-slate-700 uppercase">Point / Nilai (Reward XP)</label>
                            <input type="number" id="edit-game-xp" value="${g.rewardXp || 100}" min="10" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-amber-700">
                        </div>
                    </div>

                    <div class="space-y-1">
                        <label class="block font-bold text-slate-700 uppercase">Status Permainan</label>
                        <select id="edit-game-status" class="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold">
                            <option value="active" ${g.status === 'active' ? 'selected' : ''}>Aktif</option>
                            <option value="inactive" ${g.status === 'inactive' ? 'selected' : ''}>Nonaktif</option>
                        </select>
                    </div>

                    <div class="p-3 bg-emerald-50 rounded-2xl border border-emerald-100 flex items-center gap-2.5 text-emerald-800 text-[11px] font-medium">
                        <i class="fa-solid fa-circle-info text-emerald-600 text-base"></i>
                        <span>${isEdit ? 'Perubahan metadata akan memperbarui kartu game ini.' : 'Setelah mengklik "Simpan & Atur Soal", kartu game ini akan otomatis dibuat & editor aturan khusus gamenya akan dibuka.'}</span>
                    </div>

                    <!-- Actions -->
                    <div class="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                        <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer">Batal</button>
                        <button type="submit" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer">
                            <span>${isEdit ? 'Simpan Metadata' : 'Oke / Simpan & Lanjut Atur Soal'}</span> <i class="fa-solid fa-arrow-right"></i>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;
};

// Simpan Inisialisasi Metadata (Langkah 1) & Langsung Buka Editor Soal Khusus (Langkah 2)
window.saveInitialGameMetadata = async function(event) {
    event.preventDefault();

    const id = document.getElementById('edit-game-id').value;
    const title = document.getElementById('edit-game-title').value.trim();
    const gameType = document.getElementById('edit-game-type').value;
    const subjectId = document.getElementById('edit-game-subject').value;
    const classId = document.getElementById('edit-game-class').value;
    const difficulty = document.getElementById('edit-game-difficulty').value;
    const timeLimit = parseInt(document.getElementById('edit-game-timelimit').value, 10) || 120;
    const rewardXp = parseInt(document.getElementById('edit-game-xp').value, 10) || 100;
    const status = document.getElementById('edit-game-status').value;

    const typeInfo = GAME_TYPES.find(t => t.id === gameType) || { name: 'Game' };

    // Default structure according to game type
    const newGame = {
        id,
        title,
        gameType,
        subjectId,
        classId,
        difficulty,
        timeLimit,
        rewardXp,
        status,
        prompt: `Selesaikan tantangan ${typeInfo.name} berikut dengan cermat!`,
        answerKey: 'KEYBOARD',
        hints: ['Petunjuk 1'],
        imageUrl: '',
        correctAnswer: 'BENAR',
        explanation: '',
        wordsToFind: ['MONITOR', 'MOUSE', 'MODEM'],
        pairs: [
            { term: 'CPU', match: 'Otak Komputer' },
            { term: 'RAM', match: 'Memori Sementara' }
        ],
        crosswordData: {
            gridSize: { rows: 8, cols: 8 },
            clues: [
                { number: 1, direction: 'across', row: 1, col: 1, clue: 'Otak pemroses utama komputer', answer: 'CPU' },
                { number: 2, direction: 'across', row: 3, col: 1, clue: 'Memori penyimpanan sementara', answer: 'RAM' }
            ]
        }
    };

    try {
        const res = await fetch('/api/games', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newGame)
        });
        const data = await res.json();
        if (data.success || res.ok) {
            if (!Array.isArray(appState.eduGames)) appState.eduGames = [];
            appState.eduGames.push(newGame);

            showToast(`Kartu game "${title}" berhasil dibuat! Silakan kelola aturan & soal gamenya.`, "success");
            
            // Refresh view to show newly created card in background
            if (typeof renderGameAdminModule === 'function') {
                renderGameAdminModule(document.getElementById('view-container'));
            }

            // Immediately open Specialized Content Editor
            window.openGameContentEditorModal(newGame.id);
        } else {
            showToast(data.message || "Gagal membuat game baru", "error");
        }
    } catch (err) {
        // Fallback local state save
        if (!Array.isArray(appState.eduGames)) appState.eduGames = [];
        appState.eduGames.push(newGame);
        showToast(`Kartu game "${title}" dibuat (Lokal)!`, "success");
        if (typeof renderGameAdminModule === 'function') {
            renderGameAdminModule(document.getElementById('view-container'));
        }
        window.openGameContentEditorModal(newGame.id);
    }
};

window.saveGameMetadataOnly = async function(event) {
    event.preventDefault();
    const id = document.getElementById('edit-game-id').value;
    const game = appState.eduGames.find(g => g.id === id);
    if (!game) return;

    game.title = document.getElementById('edit-game-title').value.trim();
    game.subjectId = document.getElementById('edit-game-subject').value;
    game.classId = document.getElementById('edit-game-class').value;
    game.difficulty = document.getElementById('edit-game-difficulty').value;
    game.timeLimit = parseInt(document.getElementById('edit-game-timelimit').value, 10) || 120;
    game.rewardXp = parseInt(document.getElementById('edit-game-xp').value, 10) || 100;
    game.status = document.getElementById('edit-game-status').value;

    try {
        await fetch(`/api/games/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(game)
        });
        showToast("Metadata game berhasil diperbarui!", "success");
        document.getElementById('modal-container').innerHTML = '';
        renderGameAdminModule(document.getElementById('view-container'));
    } catch (err) {
        showToast("Metadata game diperbarui (Lokal)", "info");
        document.getElementById('modal-container').innerHTML = '';
        renderGameAdminModule(document.getElementById('view-container'));
    }
};

// STEP 2: SPECIALIZED CONTENT & RULES EDITOR PER GAME MODE
window.openGameContentEditorModal = function(gameId) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    if (!Array.isArray(appState.eduGames) || appState.eduGames.length === 0) {
        appState.eduGames = [...SAMPLE_SEED_GAMES];
    }

    const game = appState.eduGames.find(g => g.id === gameId);
    if (!game) {
        showToast("Game tidak ditemukan", "error");
        return;
    }

    const typeInfo = GAME_TYPES.find(t => t.id === game.gameType) || { name: game.gameType, icon: 'fa-gamepad' };

    modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div class="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
                <!-- Header Banner -->
                <div class="p-6 bg-slate-900 text-white flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 bg-emerald-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg">
                            <i class="fa-solid ${typeInfo.icon}"></i>
                        </div>
                        <div>
                            <div class="flex items-center gap-2">
                                <span class="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 font-extrabold uppercase text-[10px] rounded-full border border-emerald-500/30">
                                    ${typeInfo.name}
                                </span>
                                <span class="text-xs text-slate-400 font-semibold">${gameEscapeHtml(game.subjectId || 'Umum')} • ${gameEscapeHtml(game.classId || 'Semua Kelas')}</span>
                            </div>
                            <h3 class="font-extrabold text-base text-white mt-0.5">${gameEscapeHtml(game.title)}</h3>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="text-slate-400 hover:text-white p-2 text-lg">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Info Notice -->
                <div class="px-6 py-2.5 bg-amber-50 border-b border-amber-100 flex items-center justify-between text-xs font-semibold text-amber-900">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-sliders text-amber-600"></i>
                        <span>Kelola Aturan, Petunjuk & Soal Khusus Game <strong>${typeInfo.name}</strong></span>
                    </div>
                    <span class="text-[11px] font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-lg">${game.timeLimit} Detik • +${game.rewardXp} XP</span>
                </div>

                <!-- Form Content Specific Editor -->
                <form id="game-content-form" onsubmit="saveGameContent(event, '${game.id}')" class="p-6 space-y-5 overflow-y-auto flex-1 text-xs">
                    
                    <!-- Common Prompt Field -->
                    <div class="space-y-1">
                        <label class="block font-bold text-slate-700 uppercase">Instruksi / Soal Utama Game <span class="text-rose-500">*</span></label>
                        <textarea id="edit-content-prompt" rows="2" placeholder="Masukkan instruksi atau narasi tantangan bagi siswa..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none">${gameEscapeHtml(game.prompt || '')}</textarea>
                    </div>

                    <!-- Dynamic Editor Content Container -->
                    <div id="specialized-game-editor-body">
                        ${renderSpecializedGameEditor(game)}
                    </div>

                    <!-- Footer Actions -->
                    <div class="flex items-center justify-between gap-3 pt-4 border-t border-slate-100">
                        <button type="button" onclick="launchGamePlayPreview('${game.id}')" class="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs transition flex items-center gap-2 cursor-pointer">
                            <i class="fa-solid fa-play"></i> <span>Uji Coba Game</span>
                        </button>
                        
                        <div class="flex items-center gap-2">
                            <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer">Batal</button>
                            <button type="submit" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition flex items-center gap-2 cursor-pointer">
                                <i class="fa-solid fa-floppy-disk"></i> <span>Simpan Konten Game</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;
};

// Renderer khusus untuk masing-masing jenis game
function renderSpecializedGameEditor(game) {
    const type = game.gameType || 'tebak_kata';

    // 1. TEKA-TEKI SILANG (CROSSWORD)
    if (type === 'crossword') {
        const clues = game.crosswordData?.clues || [
            { number: 1, direction: 'across', row: 1, col: 1, clue: 'Otak pemroses utama pada komputer (3 Huruf)', answer: 'CPU', points: 30, initialHint: true },
            { number: 2, direction: 'down', row: 1, col: 1, clue: 'Perangkat keras pengolah data utama (8 Huruf)', answer: 'COMPUTER', points: 50, initialHint: true },
            { number: 3, direction: 'across', row: 3, col: 1, clue: 'Modulasi sinyal jaringan internet (5 Huruf)', answer: 'MODEM', points: 30, initialHint: true },
            { number: 4, direction: 'across', row: 4, col: 1, clue: 'Perangkat pencetak dokumen kertas (7 Huruf)', answer: 'PRINTER', points: 40, initialHint: true }
        ];

        return `
            <div class="space-y-4 bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                <div class="flex items-center justify-between">
                    <h4 class="font-bold text-indigo-950 uppercase flex items-center gap-1.5 text-xs">
                        <i class="fa-solid fa-puzzle-piece text-indigo-600"></i> Daftar Petunjuk Teka-Teki Silang (Clues TTS)
                    </h4>
                    <button type="button" onclick="addCrosswordClueRowInput()" class="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs transition cursor-pointer">
                        + Tambah Soal TTS
                    </button>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr class="bg-indigo-100/70 text-indigo-900 font-bold">
                                <th class="p-2 rounded-l-lg w-10 text-center">No</th>
                                <th class="p-2 w-28">Arah</th>
                                <th class="p-2 w-20">Posisi (B,K)</th>
                                <th class="p-2">Petunjuk Soal</th>
                                <th class="p-2 w-32">Kunci Jawaban</th>
                                <th class="p-2 w-16 text-center">Poin</th>
                                <th class="p-2 w-12 text-center">Clue</th>
                                <th class="p-2 w-10 text-center rounded-r-lg">Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="crossword-clues-list" class="divide-y divide-indigo-100">
                            ${clues.map((c, idx) => `
                                <tr class="cw-clue-row">
                                    <td class="p-1 text-center">
                                        <input type="number" class="cw-no w-9 px-1 py-1 text-center bg-white border border-slate-200 rounded-lg font-bold text-xs" value="${c.number || idx+1}">
                                    </td>
                                    <td class="p-1">
                                        <select class="cw-dir w-full px-1.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-xs">
                                            <option value="across" ${c.direction === 'across' ? 'selected' : ''}>Mendatar</option>
                                            <option value="down" ${c.direction === 'down' ? 'selected' : ''}>Menurun</option>
                                        </select>
                                    </td>
                                    <td class="p-1">
                                        <div class="flex items-center gap-1 text-[11px]">
                                            <input type="number" min="1" max="15" class="cw-row w-9 px-1 py-1 bg-white border border-slate-200 rounded-lg font-bold text-center" value="${c.row || 1}" title="Baris (Row)">
                                            <input type="number" min="1" max="15" class="cw-col w-9 px-1 py-1 bg-white border border-slate-200 rounded-lg font-bold text-center" value="${c.col || 1}" title="Kolom (Col)">
                                        </div>
                                    </td>
                                    <td class="p-1">
                                        <input type="text" class="cw-clue w-full px-2 py-1 bg-white border border-slate-200 rounded-lg font-medium text-xs" value="${gameEscapeAttr(c.clue || '')}" placeholder="Petunjuk pertanyaan...">
                                    </td>
                                    <td class="p-1">
                                        <input type="text" class="cw-answer w-full px-2 py-1 bg-white border border-slate-200 rounded-lg font-extrabold uppercase text-indigo-700 text-xs" value="${gameEscapeAttr(c.answer || '')}" placeholder="JAWABAN">
                                    </td>
                                    <td class="p-1">
                                        <input type="number" min="5" step="5" class="cw-points w-14 px-1 py-1 bg-white border border-slate-200 rounded-lg font-bold text-amber-700 text-center text-xs" value="${c.points || 20}" title="Poin Kolom">
                                    </td>
                                    <td class="p-1 text-center">
                                        <input type="checkbox" class="cw-hint-check accent-emerald-600 w-4 h-4 cursor-pointer" ${c.initialHint !== false ? 'checked' : ''} title="Tampilkan huruf awal sebagai petunjuk">
                                    </td>
                                    <td class="p-1 text-center">
                                        <button type="button" onclick="this.closest('tr').remove()" class="text-rose-500 hover:text-rose-700 p-1">
                                            <i class="fa-solid fa-trash-can"></i>
                                        </button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    // 2. CARI KATA (WORD SEARCH)
    if (type === 'word_search') {
        const words = Array.isArray(game.wordsToFind) && game.wordsToFind.length > 0 ? game.wordsToFind : ['MONITOR', 'KEYBOARD', 'MOUSE'];
        const clue = (game.hints && game.hints[0]) || game.prompt || 'Hardware Computer';
        return `
            <div class="space-y-4 bg-purple-50/50 p-4 rounded-2xl border border-purple-100">
                <div class="flex items-center justify-between">
                    <h4 class="font-bold text-purple-950 uppercase flex items-center gap-1.5 text-xs">
                        <i class="fa-solid fa-magnifying-glass text-purple-600"></i> Aturan Soal & Clue Cari Kata (Word Search)
                    </h4>
                </div>

                <div class="space-y-1 bg-white p-3 rounded-2xl border border-purple-200">
                    <label class="block font-bold text-slate-700 text-xs uppercase">Clue / Petunjuk Utama Game <span class="text-rose-500">*</span></label>
                    <input type="text" id="edit-content-hint" value="${gameEscapeAttr(clue)}" placeholder="Misal: Hardware Computer / Perangkat Keras Komputer" class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-extrabold text-purple-950 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none">
                    <p class="text-[10px] text-slate-500 font-medium mt-1">Siswa akan melihat clue ini untuk menebak kata-kata kunci tersembunyi pada papan huruf.</p>
                </div>
                
                <div class="space-y-2 bg-white p-3 rounded-2xl border border-purple-200">
                    <label class="block font-bold text-slate-700 text-xs uppercase">Kunci Jawaban (Kata-kata Tersembunyi Dalam Grid):</label>
                    <div id="word-search-tags" class="flex items-center gap-2 flex-wrap min-h-[40px] p-2 bg-slate-50 border border-slate-200 rounded-xl">
                        ${words.map((w, idx) => `
                            <span class="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-900 font-extrabold rounded-full text-xs shadow-2xs">
                                ${w}
                                <button type="button" onclick="removeWordSearchTag(${idx})" class="text-purple-500 hover:text-purple-900 font-black ml-1 cursor-pointer">×</button>
                            </span>
                        `).join('')}
                    </div>

                    <div class="flex items-center gap-2 pt-1">
                        <input type="text" id="new-word-search-input" onkeydown="if(event.key==='Enter'){event.preventDefault();addWordSearchTag();}" placeholder="Masukkan kata baru (misal: MONITOR, KEYBOARD, MOUSE)..." class="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold uppercase text-purple-950 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none">
                        <button type="button" onclick="addWordSearchTag()" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl text-xs transition cursor-pointer shadow-sm">
                            + Tambah Kata
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // 3. MEMORY MATCH
    if (type === 'memory_match') {
        const pairs = Array.isArray(game.pairs) && game.pairs.length > 0 ? game.pairs : [{ term: '', match: '' }];
        return `
            <div class="space-y-4 bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                <div class="flex items-center justify-between">
                    <h4 class="font-bold text-amber-950 uppercase flex items-center gap-1.5 text-xs">
                        <i class="fa-solid fa-link text-amber-600"></i> Pasangan Pertanyaan & Definisi
                    </h4>
                    <button type="button" onclick="addPairRowInput()" class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition cursor-pointer">
                        + Tambah Pasangan
                    </button>
                </div>

                <div id="pairs-inputs-list" class="space-y-2">
                    ${pairs.map((p, idx) => `
                        <div class="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-xl shadow-2xs">
                            <input type="text" class="pair-term-input flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-amber-900" placeholder="Istilah / Soal ${idx+1} (misal: CPU)" value="${gameEscapeAttr(p.term || '')}">
                            <span class="text-amber-500 font-extrabold text-sm">&leftrightarrow;</span>
                            <input type="text" class="pair-match-input flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium" placeholder="Definisi / Jawaban (misal: Otak Komputer)" value="${gameEscapeAttr(p.match || '')}">
                            <button type="button" onclick="this.closest('div').remove()" class="p-1.5 text-rose-500 hover:text-rose-700">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 3B. LABIRIN BENANG KUSUT
    if (type === 'labirin') {
        const options = Array.isArray(game.options) && game.options.length > 0 
            ? game.options 
            : (game.answerKey ? [game.answerKey, 'RAM', 'Printer'] : ['CPU', 'RAM', 'Printer']);
        const currentAnswer = game.answerKey || options[0];

        return `
            <div class="space-y-4 bg-amber-50/50 p-4 rounded-2xl border border-amber-100">
                <div class="flex items-center justify-between">
                    <h4 class="font-bold text-amber-950 uppercase flex items-center gap-1.5 text-xs">
                        <i class="fa-solid fa-flag-checkered text-amber-600"></i> Pilihan Jawaban Finish (Baris Atas)
                    </h4>
                    <button type="button" onclick="addLabirinOptionRowInput()" class="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition cursor-pointer">
                        + Tambah Pilihan
                    </button>
                </div>
                <p class="text-[11px] text-slate-600 font-medium">Tentukan pilihan jawaban yang tampil di baris ATAS (FINISH). Pilih salah satu radio button sebagai Kunci Jawaban Benar.</p>

                <div id="labirin-options-list" class="space-y-2">
                    ${options.map((opt, idx) => `
                        <div class="flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-xl shadow-2xs">
                            <label class="flex items-center gap-1.5 cursor-pointer bg-amber-100/80 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg border border-amber-300 transition">
                                <input type="radio" name="labirin-correct-opt" class="labirin-opt-radio w-4 h-4 text-amber-600 focus:ring-amber-500 cursor-pointer" ${opt === currentAnswer || (idx === 0 && !options.includes(currentAnswer)) ? 'checked' : ''}>
                                <span class="text-[11px] font-black text-amber-950">Kunci Benar</span>
                            </label>
                            <input type="text" class="labirin-opt-text flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800" placeholder="Pilihan ${idx+1} (misal: ${idx===0?'CPU':(idx===1?'RAM':'Printer')})" value="${gameEscapeAttr(opt || '')}">
                            <button type="button" onclick="this.closest('div').remove()" class="p-1.5 text-rose-500 hover:text-rose-700">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }

    // 4. BENAR ATAU SALAH (TRUE / FALSE)
    if (type === 'true_false') {
        return `
            <div class="space-y-4 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
                <h4 class="font-bold text-emerald-950 uppercase flex items-center gap-1.5 text-xs">
                    <i class="fa-solid fa-circle-check text-emerald-600"></i> Aturan Kunci Benar atau Salah
                </h4>
                
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="space-y-1">
                        <label class="block font-bold text-slate-700">Pernyataan Di Atas Adalah:</label>
                        <select id="edit-content-tf-correct" class="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl font-extrabold text-emerald-700 text-sm">
                            <option value="BENAR" ${game.correctAnswer === 'BENAR' ? 'selected' : ''}>BENAR</option>
                            <option value="SALAH" ${game.correctAnswer === 'SALAH' ? 'selected' : ''}>SALAH</option>
                        </select>
                    </div>

                    <div class="space-y-1">
                        <label class="block font-bold text-slate-700">Penjelasan / Umbal Balik (Feedback)</label>
                        <input type="text" id="edit-content-explanation" value="${gameEscapeAttr(game.explanation || '')}" placeholder="Penjelasan edukatif setelah siswa menjawab..." class="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl font-medium">
                    </div>
                </div>
            </div>
        `;
    }

    // 5. TEBAK GAMBAR
    if (type === 'tebak_gambar') {
        return `
            <div class="space-y-4 bg-blue-50/50 p-4 rounded-2xl border border-blue-100">
                <h4 class="font-bold text-blue-950 uppercase flex items-center gap-1.5 text-xs">
                    <i class="fa-solid fa-image text-blue-600"></i> Upload Gambar Soal & Kunci Jawaban
                </h4>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div class="space-y-2 sm:col-span-2 bg-white p-3.5 rounded-2xl border border-blue-200">
                        <label class="block font-bold text-slate-800 text-xs">Upload File Gambar Soal (Bukan URL)</label>
                        <div class="flex items-center gap-3 flex-wrap">
                            <label class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold rounded-xl text-xs cursor-pointer transition shadow-sm inline-flex items-center gap-2">
                                <i class="fa-solid fa-file-image"></i> Pilih File Gambar
                                <input type="file" accept="image/*" class="hidden" onchange="handleImageFileUpload(event, 'tg-img-preview', 'edit-content-image')">
                            </label>
                            <button type="button" onclick="clearUploadedImage('tg-img-preview', 'edit-content-image')" class="px-3 py-2 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 font-bold rounded-xl text-xs transition">
                                <i class="fa-solid fa-trash-can mr-1"></i> Hapus Gambar
                            </button>
                        </div>
                        <input type="hidden" id="edit-content-image" value="${game.imageUrl || ''}">
                        <div class="mt-2">
                            <img id="tg-img-preview" src="${game.imageUrl || ''}" class="${game.imageUrl ? 'w-48 h-36 object-cover rounded-2xl border-2 border-blue-300 shadow-md' : 'hidden'}">
                        </div>
                    </div>

                    <div class="space-y-1 sm:col-span-2">
                        <label class="block font-bold text-slate-700">Kunci Jawaban (Satu Kata/Frasa)</label>
                        <input type="text" id="edit-content-answer" value="${gameEscapeAttr(game.answerKey || '')}" placeholder="Contoh: MONITOR" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-black uppercase text-blue-800 tracking-widest text-sm">
                    </div>

                    <!-- 4 Progressive Hints Input -->
                    <div class="space-y-3 sm:col-span-2 bg-white p-3.5 rounded-2xl border border-blue-200">
                        <label class="block font-bold text-blue-950 text-xs uppercase flex items-center gap-1.5">
                            <i class="fa-solid fa-key text-blue-600"></i> 4 Petunjuk Bantuan (Sejalan Dengan 4 Bagian Gambar Terbuka)
                        </label>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                            <div>
                                <span class="font-bold text-slate-600 block mb-1">Clue 1 (1/4 Gambar Terbuka)</span>
                                <input type="text" id="edit-tg-hint-1" value="${gameEscapeAttr((game.hints && game.hints[0]) || '')}" placeholder="Petunjuk ke-1 (misal: Perangkat keras output)..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                            </div>
                            <div>
                                <span class="font-bold text-slate-600 block mb-1">Clue 2 (2/4 Gambar Terbuka)</span>
                                <input type="text" id="edit-tg-hint-2" value="${gameEscapeAttr((game.hints && game.hints[1]) || '')}" placeholder="Petunjuk ke-2 (misal: Menampilkan grafik visual)..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                            </div>
                            <div>
                                <span class="font-bold text-slate-600 block mb-1">Clue 3 (3/4 Gambar Terbuka)</span>
                                <input type="text" id="edit-tg-hint-3" value="${gameEscapeAttr((game.hints && game.hints[2]) || '')}" placeholder="Petunjuk ke-3 (misal: Memiliki port HDMI/VGA)..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                            </div>
                            <div>
                                <span class="font-bold text-slate-600 block mb-1">Clue 4 (4/4 Gambar Terbuka Penuh)</span>
                                <input type="text" id="edit-tg-hint-4" value="${gameEscapeAttr((game.hints && game.hints[3]) || '')}" placeholder="Petunjuk ke-4 (misal: Berada di atas meja kerja)..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-medium">
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // 6. PUZZLE GAMBAR (3x3 IMAGE PUZZLE)
    if (type === 'image_puzzle') {
        const defaultImg = game.imageUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80';
        return `
            <div class="space-y-4 bg-lime-50/50 p-4 rounded-2xl border border-lime-100">
                <h4 class="font-bold text-lime-950 uppercase flex items-center gap-1.5 text-xs">
                    <i class="fa-solid fa-border-all text-lime-600"></i> Form File Gambar Puzzle (3x3 Grid - 9 Potongan)
                </h4>

                <div class="space-y-2 bg-white p-3.5 rounded-2xl border border-lime-200">
                    <label class="block font-bold text-slate-800 text-xs">Upload File Gambar Utama Untuk Dipecah Jadi 9 Bagian <span class="text-rose-500">*</span></label>
                    <div class="flex items-center gap-3 flex-wrap">
                        <label class="px-4 py-2 bg-lime-600 hover:bg-lime-700 text-white font-extrabold rounded-xl text-xs cursor-pointer transition shadow-sm inline-flex items-center gap-2">
                            <i class="fa-solid fa-file-image"></i> Pilih File Gambar
                            <input type="file" accept="image/*" class="hidden" onchange="handleImageFileUpload(event, 'pz-img-preview', 'edit-content-image')">
                        </label>
                        <button type="button" onclick="clearUploadedImage('pz-img-preview', 'edit-content-image')" class="px-3 py-2 bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 font-bold rounded-xl text-xs transition">
                            <i class="fa-solid fa-trash-can mr-1"></i> Hapus Gambar
                        </button>
                    </div>
                    <input type="hidden" id="edit-content-image" value="${defaultImg}">
                    <div class="mt-2">
                        <img id="pz-img-preview" src="${defaultImg}" class="w-44 h-44 object-cover rounded-2xl border-2 border-lime-400 shadow-md">
                    </div>
                    <p class="text-[10px] text-slate-500 font-medium mt-1">Sistem secara otomatis memotong gambar ini menjadi 9 bagian (3x3) dan mengacak posisinya. Tugas siswa menyusun gambar kembali hingga utuh dengan menukar bagian-bagian gambar.</p>
                </div>
            </div>
        `;
    }

    // DEFAULT / TEBAK KATA / SUSUN KATA
    return `
        <div class="space-y-4 bg-emerald-50/50 p-4 rounded-2xl border border-emerald-100">
            <h4 class="font-bold text-emerald-950 uppercase flex items-center gap-1.5 text-xs">
                <i class="fa-solid fa-key text-emerald-600"></i> Kunci Jawaban & Upload Gambar Soal
            </h4>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="space-y-1">
                    <label class="block font-bold text-slate-700">Kunci Jawaban Utuh <span class="text-rose-500">*</span></label>
                    <input type="text" id="edit-content-answer" value="${gameEscapeAttr(game.answerKey || '')}" placeholder="Contoh: KEYBOARD" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-black uppercase text-emerald-800 tracking-widest text-sm">
                </div>

                <div class="space-y-2 bg-white p-3 rounded-2xl border border-emerald-200">
                    <label class="block font-bold text-slate-700 text-xs">Upload Gambar (File Gambar)</label>
                    <div class="flex items-center gap-2 flex-wrap">
                        <label class="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs cursor-pointer transition shadow-xs inline-flex items-center gap-1.5">
                            <i class="fa-solid fa-upload"></i> Pilih File
                            <input type="file" accept="image/*" class="hidden" onchange="handleImageFileUpload(event, 'gen-img-preview', 'edit-content-image')">
                        </label>
                        <button type="button" onclick="clearUploadedImage('gen-img-preview', 'edit-content-image')" class="px-2.5 py-1.5 bg-slate-100 text-slate-600 hover:text-rose-600 font-bold rounded-xl text-xs transition">
                            Hapus
                        </button>
                    </div>
                    <input type="hidden" id="edit-content-image" value="${game.imageUrl || ''}">
                    <img id="gen-img-preview" src="${game.imageUrl || ''}" class="${game.imageUrl ? 'w-32 h-24 object-cover rounded-xl border border-emerald-300 mt-1' : 'hidden'}">
                </div>

                <div class="space-y-1 sm:col-span-2">
                    <label class="block font-bold text-slate-700">Petunjuk / Clue Tambahan</label>
                    <input type="text" id="edit-content-hint" value="${gameEscapeAttr((game.hints && game.hints[0]) || '')}" placeholder="Clue bantuan jika siswa kesulitan..." class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium">
                </div>
            </div>
        </div>
    `;
}

// SIMPAN KONTEN KHUSUS GAME
window.saveGameContent = async function(event, gameId) {
    event.preventDefault();

    const game = appState.eduGames.find(g => g.id === gameId);
    if (!game) return;

    const promptEl = document.getElementById('edit-content-prompt');
    if (promptEl) game.prompt = promptEl.value.trim();

    const answerEl = document.getElementById('edit-content-answer');
    if (answerEl) game.answerKey = answerEl.value.trim().toUpperCase();

    const imgEl = document.getElementById('edit-content-image');
    if (imgEl) game.imageUrl = imgEl.value.trim();

    const hintEl = document.getElementById('edit-content-hint');
    if (hintEl && hintEl.value.trim()) game.hints = [hintEl.value.trim()];

    if (game.gameType === 'tebak_gambar') {
        const h1 = document.getElementById('edit-tg-hint-1')?.value.trim();
        const h2 = document.getElementById('edit-tg-hint-2')?.value.trim();
        const h3 = document.getElementById('edit-tg-hint-3')?.value.trim();
        const h4 = document.getElementById('edit-tg-hint-4')?.value.trim();
        game.hints = [
            h1 || 'Clue 1: Perhatikan bentuk awal gambar',
            h2 || 'Clue 2: Perhatikan fungsi utama objek ini',
            h3 || 'Clue 3: Perhatikan warna dan karakteristiknya',
            h4 || 'Clue 4: Nama objek ini sangat populer'
        ];
    }

    const tfEl = document.getElementById('edit-content-tf-correct');
    if (tfEl) game.correctAnswer = tfEl.value;

    const expEl = document.getElementById('edit-content-explanation');
    if (expEl) game.explanation = expEl.value.trim();

    // Save Word Search Words
    const wordTagsContainer = document.getElementById('word-search-tags');
    if (wordTagsContainer) {
        const wordSpans = wordTagsContainer.querySelectorAll('span');
        if (wordSpans.length > 0) {
            game.wordsToFind = [];
            wordSpans.forEach(span => {
                let text = span.innerText || span.textContent || '';
                text = text.replace(/×/g, '').trim().toUpperCase();
                if (text) game.wordsToFind.push(text);
            });
        }
    }

    // Save Labirin Options
    const labirinOptInputs = document.querySelectorAll('.labirin-opt-text');
    if (labirinOptInputs.length > 0) {
        const options = [];
        let correctKey = '';
        labirinOptInputs.forEach((optInput) => {
            const val = optInput.value.trim();
            if (val) {
                options.push(val);
                const parent = optInput.closest('div');
                const radio = parent ? parent.querySelector('.labirin-opt-radio') : null;
                if (radio && radio.checked) {
                    correctKey = val;
                }
            }
        });
        if (options.length > 0) {
            game.options = options;
            if (correctKey) game.answerKey = correctKey;
            else if (!game.answerKey) game.answerKey = options[0];
        }
    }

    // Save Pairs
    const pairTermInputs = document.querySelectorAll('.pair-term-input');
    const pairMatchInputs = document.querySelectorAll('.pair-match-input');
    if (pairTermInputs.length > 0) {
        game.pairs = [];
        pairTermInputs.forEach((tInput, idx) => {
            const term = tInput.value.trim();
            const match = pairMatchInputs[idx] ? pairMatchInputs[idx].value.trim() : '';
            if (term && match) game.pairs.push({ term, match });
        });
    }

    // Save Crossword Clues
    const cwRows = document.querySelectorAll('.cw-clue-row');
    if (cwRows.length > 0) {
        const clues = [];
        cwRows.forEach((row, idx) => {
            const num = parseInt(row.querySelector('.cw-no')?.value, 10) || (idx + 1);
            const dir = row.querySelector('.cw-dir')?.value || 'across';
            const r = parseInt(row.querySelector('.cw-row')?.value, 10) || 1;
            const c = parseInt(row.querySelector('.cw-col')?.value, 10) || 1;
            const clue = row.querySelector('.cw-clue')?.value.trim() || '';
            const answer = row.querySelector('.cw-answer')?.value.trim().toUpperCase() || '';
            const points = parseInt(row.querySelector('.cw-points')?.value, 10) || 20;
            const initialHint = row.querySelector('.cw-hint-check')?.checked !== false;

            if (clue && answer) {
                clues.push({ number: num, direction: dir, row: r, col: c, clue, answer, points, initialHint });
            }
        });
        if (clues.length > 0) {
            game.crosswordData = { gridSize: { rows: 8, cols: 8 }, clues };
        }
    }

    try {
        await fetch(`/api/games/${gameId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(game)
        });
        showToast("Konten & aturan game berhasil disimpan!", "success");
        document.getElementById('modal-container').innerHTML = '';
        renderGameAdminModule(document.getElementById('view-container'));
    } catch (err) {
        showToast("Konten game disimpan (Lokal)", "info");
        document.getElementById('modal-container').innerHTML = '';
        renderGameAdminModule(document.getElementById('view-container'));
    }
};

// Helper row adders
window.addLabirinOptionRowInput = function() {
    const list = document.getElementById('labirin-options-list');
    if (!list) return;
    const idx = list.children.length + 1;
    const div = document.createElement('div');
    div.className = "flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-xl shadow-2xs";
    div.innerHTML = `
        <label class="flex items-center gap-1.5 cursor-pointer bg-amber-100/80 hover:bg-amber-200 px-2.5 py-1.5 rounded-lg border border-amber-300 transition">
            <input type="radio" name="labirin-correct-opt" class="labirin-opt-radio w-4 h-4 text-amber-600 focus:ring-amber-500 cursor-pointer">
            <span class="text-[11px] font-black text-amber-950">Kunci Benar</span>
        </label>
        <input type="text" class="labirin-opt-text flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-800" placeholder="Pilihan ${idx}" value="">
        <button type="button" onclick="this.closest('div').remove()" class="p-1.5 text-rose-500 hover:text-rose-700">
            <i class="fa-solid fa-trash-can"></i>
        </button>
    `;
    list.appendChild(div);
};

window.addCrosswordClueRowInput = function() {
    const list = document.getElementById('crossword-clues-list');
    if (!list) return;
    const count = list.children.length + 1;
    const tr = document.createElement('tr');
    tr.className = "cw-clue-row";
    tr.innerHTML = `
        <td class="p-1 text-center">
            <input type="number" class="cw-no w-9 px-1 py-1 text-center bg-white border border-slate-200 rounded-lg font-bold text-xs" value="${count}">
        </td>
        <td class="p-1">
            <select class="cw-dir w-full px-1.5 py-1 bg-white border border-slate-200 rounded-lg font-semibold text-xs">
                <option value="across">Mendatar</option>
                <option value="down">Menurun</option>
            </select>
        </td>
        <td class="p-1">
            <div class="flex items-center gap-1 text-[11px]">
                <input type="number" min="1" max="15" class="cw-row w-9 px-1 py-1 bg-white border border-slate-200 rounded-lg font-bold text-center" value="1" title="Baris (Row)">
                <input type="number" min="1" max="15" class="cw-col w-9 px-1 py-1 bg-white border border-slate-200 rounded-lg font-bold text-center" value="1" title="Kolom (Col)">
            </div>
        </td>
        <td class="p-1">
            <input type="text" class="cw-clue w-full px-2 py-1 bg-white border border-slate-200 rounded-lg font-medium text-xs" placeholder="Petunjuk pertanyaan ${count}...">
        </td>
        <td class="p-1">
            <input type="text" class="cw-answer w-full px-2 py-1 bg-white border border-slate-200 rounded-lg font-extrabold uppercase text-indigo-700 text-xs" placeholder="JAWABAN">
        </td>
        <td class="p-1">
            <input type="number" min="5" step="5" class="cw-points w-14 px-1 py-1 bg-white border border-slate-200 rounded-lg font-bold text-amber-700 text-center text-xs" value="20" title="Poin Kolom">
        </td>
        <td class="p-1 text-center">
            <input type="checkbox" class="cw-hint-check accent-emerald-600 w-4 h-4 cursor-pointer" checked title="Tampilkan huruf awal sebagai petunjuk">
        </td>
        <td class="p-1 text-center">
            <button type="button" onclick="this.closest('tr').remove()" class="text-rose-500 hover:text-rose-700 p-1">
                <i class="fa-solid fa-trash-can"></i>
            </button>
        </td>
    `;
    list.appendChild(tr);
};

window.addPairRowInput = function() {
    const list = document.getElementById('pairs-inputs-list');
    if (!list) return;
    const count = list.children.length + 1;
    const div = document.createElement('div');
    div.className = "flex items-center gap-2 bg-white p-2 border border-slate-200 rounded-xl shadow-2xs";
    div.innerHTML = `
        <input type="text" class="pair-term-input flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-amber-900" placeholder="Istilah ${count}">
        <span class="text-amber-500 font-extrabold text-sm">&leftrightarrow;</span>
        <input type="text" class="pair-match-input flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg font-medium" placeholder="Definisi / Pasangan ${count}">
        <button type="button" onclick="this.closest('div').remove()" class="p-1.5 text-rose-500 hover:text-rose-700">
            <i class="fa-solid fa-trash-can"></i>
        </button>
    `;
    list.appendChild(div);
};

window.addWordSearchTag = function() {
    const input = document.getElementById('new-word-search-input');
    if (!input || !input.value.trim()) return;
    const val = input.value.trim().toUpperCase();
    input.value = '';

    const container = document.getElementById('word-search-tags');
    if (!container) return;

    const span = document.createElement('span');
    span.className = "inline-flex items-center gap-1 px-3 py-1 bg-purple-100 text-purple-900 font-extrabold rounded-full text-xs";
    span.innerHTML = `
        ${val}
        <button type="button" onclick="this.parentElement.remove()" class="text-purple-500 hover:text-purple-900 font-black ml-1">×</button>
    `;
    container.appendChild(span);
};

window.removeWordSearchTag = function(idx) {
    const container = document.getElementById('word-search-tags');
    if (!container) return;
    if (container.children[idx]) {
        container.children[idx].remove();
    }
};

// ============================================================================
// STUDENT VIEW: GAME HUB, GAMIFICATION BANNER & LEADERBOARD
// ============================================================================
export function renderGameStudentModule(container) {
    if (!container) return;

    // Visibility Check
    if (appState.settings.isGameMenuVisibleForStudent === false) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center py-20 px-6 text-center space-y-6 animate-fade-in">
                <div class="w-24 h-24 bg-slate-100 text-slate-300 rounded-full flex items-center justify-center text-5xl">
                    <i class="fa-solid fa-gamepad"></i>
                </div>
                <div>
                    <h2 class="text-xl font-black text-slate-800">Menu Game Sedang Nonaktif</h2>
                    <p class="text-xs text-slate-500 max-w-md mx-auto mt-2 leading-relaxed">
                        Mohon maaf, menu Game Edukasi saat ini sedang dinonaktifkan oleh Bapak/Ibu Guru. Silakan fokus pada pengerjaan tugas atau materi lainnya.
                    </p>
                </div>
                <button type="button" onclick="window.studentGoBackToDashboard && window.studentGoBackToDashboard()" class="px-6 py-3 bg-slate-900 text-white font-extrabold text-xs rounded-2xl shadow-lg transition active:scale-95">
                    Kembali ke Dashboard
                </button>
            </div>
        `;
        return;
    }

    if (!appState.gameArenaStudentConfig) {
        ensureGameArenaStudentConfigLoaded();
        container.innerHTML = '<div class="p-12 text-center text-slate-500 font-bold"><i class="fa-solid fa-circle-notch fa-spin text-2xl text-indigo-500 block mb-3"></i>Menyiapkan pilihan Game Edukasi...</div>';
        return;
    }

    const currentStudent = appState.currentUser || {};
    const xp = currentStudent.gameXp || 0;
    const progress = getXpProgress(xp);
    const streak = currentStudent.dailyStreak || 1;

    const games = Array.isArray(appState.eduGames) && appState.eduGames.length > 0 ? appState.eduGames : SAMPLE_SEED_GAMES;
    
    // Mode status checking for conditional visibility
    const allModes = getGameModes();
    const activeAdventureModes = allModes.filter(m => m.modeType === 'adventure' && m.status !== 'inactive');
    const activeTowerModes = allModes.filter(m => m.modeType === 'tower' && m.status !== 'inactive');
    const visibleSections = appState.gameArenaStudentConfig.visibleSections || {};
    const sectionVisible = section => visibleSections[section]?.enabled !== false;
    const hasCatalog = sectionVisible('catalog');
    const hasAdventure = sectionVisible('treasure') && activeAdventureModes.length > 0;
    const hasTower = sectionVisible('tower') && activeTowerModes.length > 0;
    const hasArena = sectionVisible('arena') && appState.settings?.gameArenaEnabled !== false;
    const firstVisibleSubTab = hasCatalog ? 'katalog' : hasArena ? 'arena' : hasAdventure ? 'adventure' : hasTower ? 'tower' : 'katalog';

    let activeSubTab = window.__studentGameSubTab || firstVisibleSubTab;
    if (activeSubTab === 'katalog' && !hasCatalog) activeSubTab = firstVisibleSubTab;
    if (activeSubTab === 'adventure' && !hasAdventure) activeSubTab = firstVisibleSubTab;
    if (activeSubTab === 'tower' && !hasTower) activeSubTab = firstVisibleSubTab;
    if (activeSubTab === 'arena' && !hasArena) activeSubTab = firstVisibleSubTab;
    if (activeSubTab === 'escape') activeSubTab = firstVisibleSubTab;
    window.__studentGameSubTab = activeSubTab;

    const visibleSectionCount = [hasCatalog, hasArena, hasAdventure, hasTower].filter(Boolean).length;
    const showSubTabs = visibleSectionCount > 1;
    if (!visibleSectionCount) {
        container.innerHTML = '<div class="p-12 text-center text-slate-500 font-bold"><i class="fa-solid fa-gamepad text-3xl text-slate-300 block mb-3"></i>Belum ada kategori Game Edukasi yang diaktifkan untuk kelasmu.</div>';
        return;
    }

    container.innerHTML = `
        <div class="space-y-6 pb-16 animate-fade-in">
            <!-- Back to Dashboard Header -->
            <div class="flex items-center justify-between pb-3 border-b border-slate-200/60 mb-2">
                <button type="button" onclick="window.studentGoBackToDashboard && window.studentGoBackToDashboard()" class="flex items-center gap-2 text-slate-600 hover:text-slate-850 transition font-bold text-xs sm:text-sm cursor-pointer">
                    <i class="fa-solid fa-arrow-left"></i>
                    <span>Kembali ke Dashboard Utama</span>
                </button>
                <span class="text-xs font-bold text-slate-400">Game Edukasi Siswa</span>
            </div>

            <!-- Gamification Header Profile Banner -->
            <div class="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-2xl relative overflow-hidden border border-indigo-500/20">
                <div class="absolute -right-12 -top-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
                
                <div class="flex flex-col md:flex-row items-center justify-between gap-6 relative z-10">
                    <!-- Left Student Info -->
                    <div class="flex items-center space-x-4 text-center sm:text-left">
                        <div class="relative">
                            <div class="w-20 h-20 bg-gradient-to-tr from-amber-400 to-amber-200 rounded-3xl p-1 shadow-lg shadow-amber-500/20">
                                <div class="w-full h-full bg-slate-900 rounded-[22px] flex items-center justify-center text-3xl font-black text-amber-300 overflow-hidden">
                                    ${currentStudent.photo ? `<img src="${window.getPhotoHtmlSrc ? window.getPhotoHtmlSrc(currentStudent.photo) : ''}" class="w-full h-full object-cover">` : `<i class="fa-solid fa-gamepad"></i>`}
                                </div>
                            </div>
                            <span class="absolute -bottom-2 -right-2 px-2.5 py-0.5 bg-amber-500 text-slate-950 text-[10px] font-extrabold rounded-full shadow-md uppercase tracking-wider">
                                Lvl ${progress.level}
                            </span>
                        </div>
                        <div>
                            <span class="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest bg-indigo-950 px-2.5 py-1 rounded-full border border-indigo-800">
                                <i class="fa-solid fa-graduation-cap mr-1"></i> ${currentStudent.className || 'Siswa Madrasah'}
                            </span>
                            <h2 class="text-xl sm:text-2xl font-black mt-1 text-slate-100">${gameEscapeHtml(currentStudent.name || 'Siswa')}</h2>
                            
                            <!-- XP Progress Bar -->
                            <div class="mt-2 space-y-1 w-60 sm:w-72">
                                <div class="flex justify-between text-[11px] font-bold text-slate-300">
                                    <span>XP: ${progress.totalXp}</span>
                                    <span class="text-indigo-400">${progress.percentage}%</span>
                                </div>
                                <div class="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden p-0.5 border border-slate-700">
                                    <div class="h-full bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-400 rounded-full transition-all duration-500" style="width: ${progress.percentage}%"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Right Stats Counter Pills -->
                    <div class="flex items-center gap-3">
                        <div class="bg-slate-800/80 border border-slate-700/80 px-4 py-3 rounded-2xl text-center min-w-[100px]">
                            <span class="text-amber-400 text-lg block font-black">🔥 ${streak}</span>
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Daily Streak</span>
                        </div>
                        <div class="bg-slate-800/80 border border-slate-700/80 px-4 py-3 rounded-2xl text-center min-w-[100px]">
                            <span class="text-indigo-400 text-lg block font-black">⭐ ${progress.totalXp}</span>
                            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total XP</span>
                        </div>
                        <button type="button" onclick="openGameLeaderboardModal()" class="bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 px-4 py-3.5 rounded-2xl font-extrabold text-xs shadow-lg shadow-amber-500/20 transition cursor-pointer flex items-center gap-1.5">
                            <i class="fa-solid fa-trophy text-sm"></i>
                            <span>Peringkat</span>
                        </button>
                    </div>
                </div>
            </div>

            <!-- Sub Tabs Navigation (Conditional: Only visible if modes are active) -->
            ${showSubTabs ? `
                <div class="flex items-center space-x-2 border-b border-slate-200 pb-2 overflow-x-auto">
                    ${hasCatalog ? `
                        <button type="button" onclick="window.__studentGameSubTab='katalog'; renderGameStudentModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${activeSubTab === 'katalog' ? 'bg-slate-900 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'}">
                            🎮 Katalog Semua Game
                        </button>
                    ` : ''}
                    ${hasArena ? `
                        <button type="button" onclick="window.__studentGameSubTab='arena'; renderGameStudentModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${activeSubTab === 'arena' ? 'bg-fuchsia-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'}">
                            ⚔️ Game Arena
                        </button>
                    ` : ''}
                    ${hasAdventure ? `
                        <button type="button" onclick="window.__studentGameSubTab='adventure'; renderGameStudentModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${activeSubTab === 'adventure' ? 'bg-amber-500 text-slate-950 shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'}">
                            🗺️ Peta Petualangan Harta Karun (${activeAdventureModes.length})
                        </button>
                    ` : ''}
                    ${hasTower ? `
                        <button type="button" onclick="window.__studentGameSubTab='tower'; renderGameStudentModule(document.getElementById('view-container'));" class="px-5 py-2.5 rounded-2xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${activeSubTab === 'tower' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white text-slate-600 hover:bg-slate-100'}">
                            🏰 Quest Menara (${activeTowerModes.length})
                        </button>
                    ` : ''}
                </div>
            ` : ''}

            <!-- TAB CONTENT -->
            ${activeSubTab === 'arena' && hasArena ? renderStudentArenaTab(games) :
              activeSubTab === 'adventure' && hasAdventure ? renderStudentAdventureTab(games) :
              activeSubTab === 'tower' && hasTower ? renderStudentTowerTab(games) :
              hasCatalog ? renderStudentKatalogTab(games) :
              hasAdventure ? renderStudentAdventureTab(games) :
              hasTower ? renderStudentTowerTab(games) :
              renderStudentArenaTab(games)}
        </div>
    `;
}

window.renderGameStudentModule = renderGameStudentModule;

const GAME_ARENA_AVATARS = [
    { id: 'bintang', name: 'Bintang', icon: 'fa-star', shell: 'from-amber-300 to-orange-500', accent: 'text-amber-950', skin: '#f2c7a5', hair: '#3b2417', shirt: '#f59e0b' },
    { id: 'roket', name: 'Roket', icon: 'fa-rocket', shell: 'from-sky-300 to-indigo-600', accent: 'text-white', skin: '#d9a57f', hair: '#172554', shirt: '#2563eb' },
    { id: 'buku', name: 'Buku', icon: 'fa-book-open', shell: 'from-emerald-300 to-teal-600', accent: 'text-white', skin: '#efc3a1', hair: '#422006', shirt: '#059669' },
    { id: 'komet', name: 'Komet', icon: 'fa-meteor', shell: 'from-fuchsia-300 to-purple-700', accent: 'text-white', skin: '#c98f6a', hair: '#2e1065', shirt: '#9333ea' },
    { id: 'bulan', name: 'Bulan', icon: 'fa-moon', shell: 'from-slate-300 to-slate-700', accent: 'text-white', skin: '#e7b98f', hair: '#111827', shirt: '#475569' },
    { id: 'petir', name: 'Petir', icon: 'fa-bolt', shell: 'from-yellow-200 to-amber-500', accent: 'text-slate-900', skin: '#b97852', hair: '#451a03', shirt: '#eab308' }
];

const GAME_ARENA_MODE_META = [
    {
        id: 'laser_duel',
        title: 'Laser Duel',
        icon: '⚡',
        tag: '1 vs 1',
        gradient: 'from-slate-950 via-cyan-950 to-indigo-950',
        accent: 'text-cyan-700',
        description: 'Jawaban benar mendorong titik benturan laser. Streak memberi dorongan ekstra.'
    },
    {
        id: 'tug_war',
        title: 'Tarik Tambang Ilmu',
        icon: '🪢',
        tag: 'Tim Kelas',
        gradient: 'from-sky-300 via-emerald-200 to-emerald-400',
        accent: 'text-amber-700',
        description: 'Semua jawaban benar anggota tim menarik bendera menuju sisi kemenangan.'
    },
    {
        id: 'battle_royale',
        title: 'Battle Royale Energi',
        icon: '🛡️',
        tag: '2–24 Pemain',
        gradient: 'from-violet-950 via-fuchsia-950 to-slate-950',
        accent: 'text-fuchsia-700',
        description: 'Saat energi habis, jawab soal. Energi yang terkumpul dipakai untuk Energy Pulse ke shield lawan.'
    },
    {
        id: 'quiz_race',
        title: 'Quiz Racing',
        icon: '🏎️',
        tag: '2–20 Pemain',
        gradient: 'from-sky-950 via-blue-900 to-cyan-700',
        accent: 'text-blue-700',
        description: 'Jawaban benar menjadi jarak dan boost. Pemain pertama mencapai garis 100% memenangkan ronde.'
    },
    {
        id: 'base_battle',
        title: 'Base Battle',
        icon: '🏰',
        tag: 'Tim Strategi',
        gradient: 'from-amber-950 via-orange-900 to-rose-950',
        accent: 'text-orange-700',
        description: 'Jawaban benar menghasilkan mana untuk Attack, Shield, atau Repair base tim.'
    }
];

const GAME_ARENA_FX_LEVELS = ['full', 'light', 'eco'];
const GAME_ARENA_FX_LABELS = { full: '✨ Penuh', light: '⚡ Ringan', eco: '🔋 Hemat' };
const GAME_ARENA_ASSET_ROOT = '/assets/game-arena';
const GAME_ARENA_VEHICLES = ['speed-blue.svg','speed-red.svg','speed-green.svg','speed-yellow.svg','speed-purple.svg'];
const GAME_ARENA_PREMIUM_CHARACTER_IDS = new Set(['bintang','roket','buku','komet','bulan','petir']);
const GAME_ARENA_CHARACTER_ORDER = ['bintang','roket','buku','komet','bulan','petir'];
const GAME_ARENA_CHARACTER_POSES = ['idle','action','impact','victory'];
const GAME_ARENA_CHARACTER_SHEET = '/assets/game-arena/characters/arena-character-sheet.svg';
function gameArenaAsset(path){ return `${GAME_ARENA_ASSET_ROOT}/${String(path||'').replace(/^\/+/, '')}`; }
function gameArenaVehicleAsset(index=0){ return gameArenaAsset(`vehicles/${GAME_ARENA_VEHICLES[Math.abs(Number(index||0)) % GAME_ARENA_VEHICLES.length]}`); }
function gameArenaFxAsset(name){ return gameArenaAsset(`fx/${String(name||'').replace(/^\/+/, '')}.svg`); }
function gameArenaCharacterAsset(presetId){ const id=GAME_ARENA_PREMIUM_CHARACTER_IDS.has(String(presetId||''))?String(presetId):'bintang'; return gameArenaAsset(`characters/hero-${id}.svg`); }
function arenaStableHash(value) {
    let hash = 2166136261;
    const text = String(value ?? '');
    for (let i = 0; i < text.length; i++) {
        hash ^= text.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}
function arenaStableIndex(value, length) {
    const size = Math.max(1, Number(length || 1));
    return arenaStableHash(value) % size;
}
function gameArenaCharacterSprite(presetId, pose = 'idle') {
    const safePreset = GAME_ARENA_PREMIUM_CHARACTER_IDS.has(String(presetId || '')) ? String(presetId) : 'bintang';
    const safePose = GAME_ARENA_CHARACTER_POSES.includes(String(pose || '')) ? String(pose) : 'idle';
    const row = Math.max(0, GAME_ARENA_CHARACTER_ORDER.indexOf(safePreset));
    const col = Math.max(0, GAME_ARENA_CHARACTER_POSES.indexOf(safePose));
    const x = GAME_ARENA_CHARACTER_POSES.length > 1 ? (col / (GAME_ARENA_CHARACTER_POSES.length - 1)) * 100 : 0;
    const y = GAME_ARENA_CHARACTER_ORDER.length > 1 ? (row / (GAME_ARENA_CHARACTER_ORDER.length - 1)) * 100 : 0;
    return { safePreset, safePose, x, y };
}

let adminArenaFxSnapshots = Object.create(null);

function detectGameArenaFxQuality() {
    try {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return 'eco';
        const memory = Number(navigator.deviceMemory || 0);
        const cores = Number(navigator.hardwareConcurrency || 0);
        if ((memory && memory <= 3) || (cores && cores <= 4)) return 'light';
    } catch (_) {}
    return 'full';
}

function getGameArenaFxQuality() {
    try {
        const saved = String(localStorage.getItem('madrasah_arena_fx_quality') || '').toLowerCase();
        if (GAME_ARENA_FX_LEVELS.includes(saved)) return saved;
    } catch (_) {}
    return detectGameArenaFxQuality();
}

function setGameArenaFxQuality(level) {
    const next = GAME_ARENA_FX_LEVELS.includes(level) ? level : 'light';
    try { localStorage.setItem('madrasah_arena_fx_quality', next); } catch (_) {}
    document.querySelectorAll('[data-arena-fx]').forEach(el => el.setAttribute('data-arena-fx', next));
    document.querySelectorAll('[data-arena-fx-label]').forEach(el => { el.textContent = GAME_ARENA_FX_LABELS[next]; });
    return next;
}

window.cycleGameArenaFxQuality = function() {
    const current = getGameArenaFxQuality();
    const index = GAME_ARENA_FX_LEVELS.indexOf(current);
    const next = GAME_ARENA_FX_LEVELS[(index + 1) % GAME_ARENA_FX_LEVELS.length];
    setGameArenaFxQuality(next);
    showToast(`Efek Arena: ${GAME_ARENA_FX_LABELS[next]}`, 'info');
};

function renderGameArenaFxControl() {
    const level = getGameArenaFxQuality();
    return `<button type="button" onclick="cycleGameArenaFxQuality()" class="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[10px] font-black text-slate-200 cursor-pointer whitespace-nowrap" title="Ganti kualitas animasi Arena"><span data-arena-fx-label>${GAME_ARENA_FX_LABELS[level]}</span></button>`;
}

function ensureGameArenaFxStyles() {
    if (document.getElementById('game-arena-fx-styles')) return;
    const style = document.createElement('style');
    style.id = 'game-arena-fx-styles';
    style.textContent = `
        @keyframes arenaAvatarIdle { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-3px) rotate(1deg)} }
        @keyframes arenaBeamFlow { 0%{filter:brightness(.9);opacity:.72} 50%{filter:brightness(1.7);opacity:1} 100%{filter:brightness(.9);opacity:.72} }
        @keyframes arenaImpactPulse { 0%,100%{transform:translate(-50%,-50%) scale(.78);opacity:.72} 50%{transform:translate(-50%,-50%) scale(1.18);opacity:1} }
        @keyframes arenaRopeWobble { 0%,100%{transform:rotate(0deg)} 35%{transform:rotate(.6deg)} 70%{transform:rotate(-.6deg)} }
        @keyframes arenaFlagWave { 0%,100%{transform:translateX(-50%) rotate(-2deg)} 50%{transform:translateX(-50%) rotate(3deg)} }
        @keyframes arenaShieldGlow { 0%,100%{box-shadow:0 0 0 rgba(103,232,249,0)} 50%{box-shadow:0 0 22px rgba(103,232,249,.65)} }
        @keyframes arenaRaceSmoke { 0%{transform:translate(0,0) scale(.4);opacity:.65} 100%{transform:translate(-18px,-7px) scale(1.35);opacity:0} }
        @keyframes arenaBaseCritical { 0%,100%{filter:brightness(1)} 50%{filter:brightness(.72) saturate(1.4)} }
        @keyframes arenaSpark { 0%{transform:scale(.3) rotate(0);opacity:1} 100%{transform:scale(1.7) rotate(95deg);opacity:0} }
        @keyframes arenaBoostFlame { 0%,100%{transform:scaleX(.75);opacity:.55} 50%{transform:scaleX(1.25);opacity:1} }

        @keyframes arenaHudPulse { 0%,100%{opacity:.72;transform:scaleX(.98)} 50%{opacity:1;transform:scaleX(1)} }
        @keyframes arenaSceneDrift { 0%,100%{background-position:0 0,0 0} 50%{background-position:12px -8px,-10px 6px} }
        @keyframes arenaQuestionReveal { 0%{opacity:0;transform:translateY(5px)} 100%{opacity:1;transform:translateY(0)} }

        .arena-stage {
            isolation:isolate;
            min-height:clamp(260px, 34vw, 420px);
            box-shadow:inset 0 1px rgba(255,255,255,.12), 0 18px 40px rgba(15,23,42,.16);
        }
        .arena-stage::before {
            content:"";
            position:absolute;
            inset:0;
            pointer-events:none;
            z-index:0;
            opacity:.34;
            background-image:linear-gradient(135deg,rgba(255,255,255,.08) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.05) 50%,rgba(255,255,255,.05) 75%,transparent 75%);
            background-size:34px 34px;
            mix-blend-mode:screen;
            animation:arenaSceneDrift 12s ease-in-out infinite;
        }
        .arena-stage > *:not(.absolute):not(.fixed) { position:relative; z-index:1; }
        .arena-stage .arena-stage-hud,
        .arena-stage [data-arena-stage-hud],
        .arena-stage .arena-question-panel,
        .arena-stage [data-arena-question-panel] { animation:arenaQuestionReveal .35s ease-out both; }
        .arena-stage [data-arena-stage-hud] {
            border-bottom:1px solid rgba(255,255,255,.14);
            padding-bottom:.65rem;
        }
        .arena-stage [data-arena-stage-hud]::after {
            content:"";
            display:block;
            height:2px;
            margin-top:.5rem;
            border-radius:999px;
            background:linear-gradient(90deg,transparent,currentColor,transparent);
            animation:arenaHudPulse 2.4s ease-in-out infinite;
        }
        .arena-stage .arena-character-wrap { filter:drop-shadow(0 8px 6px rgba(15,23,42,.28)); }
        [data-arena-stage="laser_duel"] { background-image:radial-gradient(circle at 50% 42%,rgba(34,211,238,.18),transparent 36%),linear-gradient(135deg,#020617,#164e63 52%,#3b0764); }
        [data-arena-stage="tug_war"] { background-image:linear-gradient(180deg,rgba(255,255,255,.18),transparent 42%),repeating-linear-gradient(90deg,rgba(22,101,52,.08) 0 18px,transparent 18px 36px); }
        [data-arena-stage="battle_royale"] { background-image:radial-gradient(circle at 50% 52%,rgba(217,70,239,.22),transparent 34%),linear-gradient(135deg,#2e1065,#701a75 52%,#0f172a); }
        [data-arena-stage="quiz_race"] { background-image:repeating-linear-gradient(90deg,rgba(255,255,255,.05) 0 28px,transparent 28px 56px),linear-gradient(135deg,#082f49,#1d4ed8,#155e75); }
        [data-arena-stage="base_battle"] { background-image:linear-gradient(90deg,rgba(251,191,36,.1),transparent 48%,rgba(251,113,133,.1)),linear-gradient(135deg,#451a03,#7c2d12,#1c1917); }
        [data-arena-fx="eco"] .arena-stage::before { animation:none; opacity:.14; }
        @media (prefers-reduced-motion:reduce) {
            .arena-stage::before,
            .arena-stage [data-arena-stage-hud]::after,
            .arena-stage [data-arena-stage-hud],
            .arena-stage [data-arena-question-panel] { animation:none !important; }
        }

        [data-arena-fx="full"] .arena-character-core { animation:arenaAvatarIdle 2.4s ease-in-out infinite; transform-origin:center bottom; }
        [data-arena-fx="light"] .arena-character-core { animation:arenaAvatarIdle 3.6s ease-in-out infinite; transform-origin:center bottom; }
        [data-arena-fx="full"] .arena-laser-beam,
        [data-arena-fx="light"] .arena-laser-beam { animation:arenaBeamFlow .85s ease-in-out infinite; }
        [data-arena-fx="full"] .arena-laser-impact { animation:arenaImpactPulse .65s ease-in-out infinite; }
        [data-arena-fx="light"] .arena-laser-impact { animation:arenaImpactPulse 1.1s ease-in-out infinite; }
        [data-arena-fx="full"] .arena-tug-rope { animation:arenaRopeWobble 1.5s ease-in-out infinite; transform-origin:center; }
        [data-arena-fx="full"] .arena-tug-flag { animation:arenaFlagWave 1.1s ease-in-out infinite; transform-origin:center bottom; }
        [data-arena-fx="full"] .arena-shield-active,
        [data-arena-fx="light"] .arena-shield-active { animation:arenaShieldGlow 1.6s ease-in-out infinite; }
        [data-arena-fx="full"] .arena-racer-boost { animation:arenaBoostFlame .35s ease-in-out infinite; transform-origin:right center; }
        [data-arena-fx="full"] .arena-race-smoke { animation:arenaRaceSmoke .9s ease-out infinite; }
        [data-arena-fx="full"] .arena-race-smoke:nth-child(2) { animation-delay:.28s; }
        [data-arena-fx="light"] .arena-race-smoke:first-child { animation:arenaRaceSmoke 1.25s ease-out infinite; }
        [data-arena-fx="full"] .arena-tug-dust { animation:arenaRaceSmoke 1.15s ease-out infinite; }
        [data-arena-fx="full"] .arena-base-critical { animation:arenaBaseCritical 1.1s ease-in-out infinite; }
        [data-arena-fx="eco"] * { animation-duration:0s !important; animation-iteration-count:1 !important; }
        @media (prefers-reduced-motion: reduce) {
            [data-arena-fx] * { animation-duration:0s !important; animation-iteration-count:1 !important; scroll-behavior:auto !important; }
        }
    `;
    document.head.appendChild(style);
}

function ensureGameArenaReferenceStyles(){
    if (document.getElementById('game-arena-reference-styles')) return;
    const style = document.createElement('style');
    style.id = 'game-arena-reference-styles';
    style.textContent = `
        @keyframes arena2SpriteIdle { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-3px)} }
        @keyframes arena2SpriteAction { 0%,100%{transform:translateY(0) rotate(-1deg)} 50%{transform:translateY(-4px) rotate(2deg)} }
        @keyframes arena2Impact { 0%,100%{transform:translateX(0)} 30%{transform:translateX(-3px)} 60%{transform:translateX(3px)} }
        @keyframes arena2Victory { 0%,100%{transform:translateY(0) scale(1)} 50%{transform:translateY(-6px) scale(1.03)} }
        @keyframes arena2Ring { 0%{transform:translate(-50%,-50%) scale(.35);opacity:.95} 100%{transform:translate(-50%,-50%) scale(2.1);opacity:0} }
        @keyframes arena2Flash { 0%,100%{opacity:.6;filter:brightness(1)} 50%{opacity:1;filter:brightness(1.65)} }
        @keyframes arena2Smoke { 0%{transform:translate(0,0) scale(.45);opacity:.55} 100%{transform:translate(-18px,-10px) scale(1.5);opacity:0} }
        @keyframes arena2Vehicle { 0%,100%{transform:translate(-50%,-50%) rotate(-1deg)} 50%{transform:translate(-50%,calc(-50% - 2px)) rotate(1deg)} }

        .arena-character-sprite{
            background-repeat:no-repeat;
            background-size:400% 600%;
            background-position:var(--arena-sprite-x,0%) var(--arena-sprite-y,0%);
            background-origin:border-box;
            background-clip:border-box;
            filter:drop-shadow(0 8px 6px rgba(2,6,23,.34));
        }
        .arena-character-sprite[data-arena-pose="idle"]{animation:arena2SpriteIdle 2.8s ease-in-out infinite!important}
        .arena-character-sprite[data-arena-pose="action"]{animation:arena2SpriteAction 1.15s ease-in-out infinite!important}
        .arena-character-sprite[data-arena-pose="impact"]{animation:arena2Impact .55s ease-in-out infinite!important}
        .arena-character-sprite[data-arena-pose="victory"]{animation:arena2Victory 1.2s ease-in-out infinite!important}

        .arena-hd-character,.arena-hd-kart{height:auto!important;overflow:visible!important;filter:drop-shadow(0 7px 5px rgba(2,6,23,.34));transform-origin:50% 100%}
        .arena-hd-character{aspect-ratio:6/7}
        .arena-hd-kart{aspect-ratio:17/10}
        .arena-hd-character>svg,.arena-hd-kart>svg{display:block;width:100%;height:100%;overflow:visible}
        .arena-hd-character[data-arena-pose="idle"]{animation:arenaHdIdle 2.6s ease-in-out infinite}
        .arena-hd-character[data-arena-pose="action"]{animation:arenaHdAction .85s ease-in-out infinite}
        .arena-hd-character[data-arena-pose="impact"]{animation:arenaHdImpact .55s ease-in-out infinite}
        .arena-hd-character[data-arena-pose="victory"]{animation:arenaHdVictory 1s ease-in-out infinite}
        @keyframes arenaHdIdle{0%,100%{transform:translateY(0)}50%{transform:translateY(-2px)}}
        @keyframes arenaHdAction{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}
        @keyframes arenaHdImpact{0%,100%{transform:translateX(0)}35%{transform:translateX(-3px)}70%{transform:translateX(3px)}}
        @keyframes arenaHdVictory{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-6px) scale(1.04)}}

        .arena-ref-shell{
            background:#06182d;
            border:1px solid rgba(71,173,255,.3);
            border-radius:22px;
            overflow:hidden;
            box-shadow:0 22px 65px rgba(2,12,27,.42);
        }
        .arena-ref-wrap{display:grid;grid-template-rows:auto auto;min-height:0;overflow:hidden}
        .arena-ref-bottom{
            position:relative;
            z-index:20;
            display:grid;
            grid-template-columns:1fr;
            gap:10px;
            padding:12px;
            background:linear-gradient(180deg,#06182d,#04101f);
            border-top:1px solid rgba(110,196,255,.2);
        }
        .arena-ref-bottom>div{box-shadow:0 12px 30px rgba(1,10,23,.28)}

        .arena2-stage{
            position:relative;
            isolation:isolate;
            min-height:420px!important;
            aspect-ratio:16/9;
            overflow:hidden;
            border:0!important;
            border-radius:0!important;
            padding:0!important;
            box-shadow:none!important;
            color:white;
            background:#071a31;
        }
        .arena2-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-3;pointer-events:none;user-select:none}
        .arena2-vignette{position:absolute;inset:0;z-index:-2;pointer-events:none;background:linear-gradient(180deg,rgba(2,6,23,.15),rgba(2,6,23,.02) 42%,rgba(2,6,23,.5)),radial-gradient(circle at 50% 48%,transparent 30%,rgba(2,6,23,.3) 100%)}
        .arena2-hud{position:absolute;left:14px;right:14px;top:12px;z-index:45;display:grid;gap:8px}
        .arena2-hud-line{height:14px;display:flex;overflow:hidden;border-radius:999px;background:rgba(2,6,23,.72);border:1px solid rgba(255,255,255,.15)}
        .arena2-hud-side{display:flex;align-items:center;padding:0 8px;font-size:8px;font-weight:900;white-space:nowrap;overflow:hidden}
        .arena2-hud-side-a{justify-content:flex-start;background:linear-gradient(90deg,#0284c7,#22d3ee)}
        .arena2-hud-side-b{justify-content:flex-end;background:linear-gradient(270deg,#e11d48,#d946ef)}
        .arena2-hud-center{display:flex;justify-content:center}
        .arena-score-pill{display:inline-flex;align-items:center;gap:7px;border-radius:9px;padding:6px 10px;background:linear-gradient(180deg,rgba(15,47,86,.96),rgba(4,21,42,.92));border:1px solid rgba(117,203,255,.34);box-shadow:0 8px 20px rgba(0,0,0,.26),inset 0 1px rgba(255,255,255,.08)}
        .arena2-status{font-size:8px;font-weight:900;letter-spacing:.08em;color:#bae6fd;text-transform:uppercase}
        .arena2-title{font-size:12px;font-weight:900;text-shadow:0 2px 10px rgba(0,0,0,.45)}
        .arena2-hud-reference{display:grid!important;grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)!important;align-items:start!important;gap:10px!important}
        .arena2-hud-card{min-width:0;padding:8px 12px 9px;border-radius:18px;border:3px solid rgba(255,255,255,.72);box-shadow:0 8px 18px rgba(0,0,0,.28),inset 0 1px rgba(255,255,255,.25);backdrop-filter:blur(5px)}
        .arena2-hud-card-a{background:linear-gradient(135deg,rgba(2,88,181,.96),rgba(26,153,239,.92));border-color:#9de8ff}
        .arena2-hud-card-b{background:linear-gradient(225deg,rgba(172,20,58,.96),rgba(244,65,91,.92));border-color:#ffd3dd}
        .arena2-hud-card-label{font-size:10px;font-weight:1000;line-height:1.1;color:white;text-shadow:0 2px 5px rgba(0,0,0,.38);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .arena2-hud-card-meter{height:9px;margin-top:6px;border-radius:999px;background:rgba(2,6,23,.62);overflow:hidden;border:1px solid rgba(255,255,255,.2)}
        .arena2-hud-card-meter>span{display:block;height:100%;border-radius:inherit}
        .arena2-hud-card-a .arena2-hud-card-meter>span{background:linear-gradient(90deg,#86f1ff,#1ccfff,#1688ed)}
        .arena2-hud-card-b .arena2-hud-card-meter>span{margin-left:auto;background:linear-gradient(90deg,#ef3e58,#ff7b9c,#ffe3ea)}
        .arena2-hud-reference .arena2-hud-center{align-self:start}
        .arena2-hud-reference .arena-score-pill{min-width:160px;flex-direction:column;gap:1px;padding:7px 16px;border:3px solid rgba(255,255,255,.76);border-radius:16px;background:linear-gradient(180deg,rgba(9,38,78,.98),rgba(3,16,39,.96));box-shadow:0 8px 20px rgba(0,0,0,.35),inset 0 1px rgba(255,255,255,.16)}
        .arena2-hud-reference .arena2-title{font-size:14px;letter-spacing:.02em}
        .arena2-hud-reference .arena2-status{font-size:8px;color:#c9f4ff}
        [data-arena-hud-theme="laser"] .arena-score-pill{border-color:#9c83ff;box-shadow:0 0 18px rgba(86,78,255,.32),0 8px 20px rgba(0,0,0,.35)}
        [data-arena-hud-theme="race"] .arena-score-pill{border-color:#ffd34d}
        [data-arena-hud-theme="royale"] .arena-score-pill{border-color:#e5edf7}
        .arena2-playfield{position:absolute;left:4%;right:4%;top:22%;bottom:8%;z-index:10}
        .arena2-name{display:inline-flex;max-width:100%;align-items:center;justify-content:center;padding:3px 7px;border-radius:7px;background:rgba(3,14,31,.86);border:1px solid rgba(255,255,255,.2);font-size:8px;font-weight:900;line-height:1;color:#fff;box-shadow:0 5px 12px rgba(0,0,0,.25);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .arena2-stat{font-size:8px;font-weight:800;color:#dbeafe;text-shadow:0 1px 5px rgba(0,0,0,.8)}
        .arena2-glass{background:linear-gradient(180deg,rgba(7,35,63,.91),rgba(4,25,47,.78));border:1px solid rgba(110,196,255,.3);box-shadow:0 7px 20px rgba(0,0,0,.26),inset 0 1px rgba(255,255,255,.08);backdrop-filter:blur(7px)}
        .arena2-caption{position:absolute;left:50%;bottom:9px;transform:translateX(-50%);z-index:42;padding:4px 9px;border-radius:8px;background:rgba(2,12,28,.68);border:1px solid rgba(255,255,255,.1);font-size:8px;font-weight:800;color:#dbeafe;white-space:nowrap}

        .arena2-laser-field{height:100%;display:grid;grid-template-columns:minmax(78px,.7fr) minmax(160px,1.8fr) minmax(78px,.7fr);align-items:end;gap:12px}
        .arena2-fighter{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-width:0}
        .arena2-fighter-card{width:100%;max-width:150px;padding:6px;border-radius:11px;text-align:center;margin-bottom:5px}
        .arena2-laser-zone{position:relative;height:100%;min-width:0}
        .arena2-laser-track{position:absolute;left:0;right:0;top:54%;height:10px;transform:translateY(-50%)}
        .arena2-laser-beam{position:absolute;top:0;height:100%;border-radius:999px;transition:width .45s ease}
        .arena2-laser-a{left:0;background:linear-gradient(90deg,#0369a1,#67e8f9,#fff);box-shadow:0 0 24px rgba(34,211,238,.9)}
        .arena2-laser-b{right:0;background:linear-gradient(270deg,#a21caf,#f0abfc,#fff);box-shadow:0 0 24px rgba(217,70,239,.9)}
        .arena-laser-impact{position:absolute;top:50%;transform:translate(-50%,-50%);width:42px;height:42px;transition:left .45s ease;z-index:6}
        .arena-laser-impact::before{content:"";position:absolute;inset:0;border-radius:999px;background:radial-gradient(circle,#fff 0 10%,#67e8f9 13% 28%,#d946ef 36%,rgba(249,115,22,.75) 48%,transparent 69%);filter:drop-shadow(0 0 18px #fff);animation:arena2Flash .55s ease-in-out infinite}
        .arena-laser-impact::after{content:"";position:absolute;left:50%;top:50%;width:34px;height:34px;border:2px solid rgba(255,255,255,.9);border-radius:999px;animation:arena2Ring .75s ease-out infinite}

        .arena2-tug-field{height:100%;display:grid;grid-template-columns:minmax(120px,1fr) minmax(130px,.9fr) minmax(120px,1fr);align-items:end;gap:10px}
        .arena2-team{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:center;gap:3px;align-content:end;padding-bottom:7%}
        .arena2-team-member{width:clamp(42px,7vw,70px);text-align:center;min-width:0}
        .arena2-team-overflow{align-self:center;padding:5px 8px;border-radius:9px;background:rgba(2,12,28,.78);font-size:8px;font-weight:900}
        .arena2-tug-center{position:relative;height:100%}
        .arena-tug-rope{position:absolute;left:0;right:0;top:62%;height:11px;border-radius:999px;background:linear-gradient(#f59e0b,#92400e);box-shadow:0 5px 12px rgba(0,0,0,.45)}
        .arena-tug-flag{position:absolute;top:26%;transform:translateX(-50%);transition:left .45s ease;z-index:7;text-align:center}
        .arena2-flag-glyph{font-size:38px;filter:drop-shadow(0 4px 5px rgba(0,0,0,.45))}
        .arena2-flag-pole{width:5px;height:108px;background:#334155;border-radius:999px;margin:-8px auto 0}

        .arena2-br-field{position:relative;height:100%;border-radius:14px;overflow:hidden;background:radial-gradient(circle at 50% 48%,rgba(56,189,248,.08),rgba(2,6,23,.18) 55%,rgba(2,6,23,.42));border:1px solid rgba(125,211,252,.12)}
        .arena2-br-player{position:absolute;left:var(--arena-left);top:var(--arena-top);translate:-50% -50%;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;width:clamp(58px,8vw,92px);min-width:0;text-align:center;transition:left .35s ease,top .35s ease,opacity .25s ease;z-index:4}
        .arena2-br-player[data-eliminated="true"]{opacity:.42;filter:grayscale(.82)}
        .arena2-br-player[data-mine="true"]{z-index:7}
        .arena2-br-player[data-mine="true"] .arena-character-wrap{filter:drop-shadow(0 0 9px rgba(103,232,249,.95))}
        .arena2-br-copy{width:100%;padding:3px 4px;border-radius:7px;background:rgba(3,14,31,.82);border:1px solid rgba(125,211,252,.18);box-shadow:0 4px 10px rgba(0,0,0,.28)}
        .arena2-br-player[data-mine="true"] .arena2-br-copy{border-color:rgba(103,232,249,.82);box-shadow:0 0 0 1px rgba(103,232,249,.18),0 4px 12px rgba(0,0,0,.3)}
        .arena2-br-name{font-size:7px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .arena2-br-copy .arena2-stat{font-size:6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .arena2-br-meter{height:4px;border-radius:999px;background:rgba(2,6,23,.72);overflow:hidden;margin-top:2px}
        .arena2-br-meter>span{display:block;height:100%;background:linear-gradient(90deg,#22d3ee,#a855f7)}

        .arena2-race-field{height:100%;display:grid;grid-template-columns:minmax(105px,.42fr) minmax(0,1.58fr);gap:12px}
        .arena2-rank{padding:8px;border-radius:12px;overflow:hidden}
        .arena2-rank-row{display:grid;grid-template-columns:18px minmax(0,1fr) 34px;gap:5px;align-items:center;padding:3px 0;font-size:8px}
        .arena2-rank-no{width:18px;height:18px;border-radius:5px;background:#334155;display:flex;align-items:center;justify-content:center;font-weight:900}
        .arena2-rank-row[data-mine="true"] .arena2-rank-no{background:#0891b2}
        .arena2-rank-row:first-child .arena2-rank-no{background:#fbbf24;color:#0f172a}
        .arena2-race-track{position:relative;height:100%;display:grid;grid-template-rows:repeat(6,1fr);gap:2px;padding:3px 16px 3px 0}
        .arena2-race-lane{position:relative;border-bottom:1px dashed rgba(255,255,255,.25)}
        .arena2-race-finish{position:absolute;right:4px;top:0;bottom:0;border-right:4px dashed rgba(255,255,255,.82)}
        .arena-race-car{position:absolute;top:50%;transform:translate(-50%,-50%);transition:left .6s cubic-bezier(.2,.8,.2,1);z-index:4}
        .arena2-race-car-img{width:72px;height:42px;object-fit:contain;filter:drop-shadow(0 6px 4px rgba(0,0,0,.38))}
        .arena2-racer-name{position:absolute;left:50%;top:-10px;transform:translateX(-50%);max-width:82px}
        .arena-race-smoke{position:absolute;right:73%;top:58%;width:13px;height:13px;border-radius:999px;background:rgba(255,255,255,.55);filter:blur(2px);animation:arena2Smoke .9s ease-out infinite}

        .arena2-base-field{height:100%;display:grid;grid-template-columns:minmax(150px,1fr) minmax(80px,.48fr) minmax(150px,1fr);gap:12px;align-items:center}
        .arena2-base{position:relative;min-width:0;text-align:center}
        .arena2-base-card{padding:8px;border-radius:12px;margin-bottom:4px;text-align:left}
        .arena2-base-head{display:flex;justify-content:space-between;gap:6px;font-size:8px;font-weight:900}
        .arena2-base-meter{height:7px;margin-top:4px;border-radius:999px;background:rgba(2,6,23,.72);overflow:hidden}
        .arena2-base-meter>span{display:block;height:100%}
        .arena2-base-a .arena2-base-meter>span{background:linear-gradient(90deg,#22d3ee,#34d399)}
        .arena2-base-b .arena2-base-meter>span{background:linear-gradient(270deg,#fb7185,#fb923c)}
        .arena2-base-visual{position:relative;height:150px;display:flex;align-items:flex-end;justify-content:center}
        .arena-castle-img{display:none!important}
        .arena2-base-live-core{position:absolute;left:50%;bottom:10px;transform:translateX(-50%);width:82px;height:60px;border-radius:18px 18px 8px 8px;background:linear-gradient(180deg,#d9e2ea,#87939f);border:5px solid #596773;box-shadow:0 9px 16px rgba(2,6,23,.28)}
        .arena2-base-live-core::before{content:"";position:absolute;left:10px;right:10px;top:-20px;height:24px;border-radius:12px 12px 3px 3px;background:linear-gradient(180deg,#f2f6f9,#aeb9c2);border:4px solid #596773}
        .arena2-base-live-core::after{content:"";position:absolute;left:18px;right:18px;bottom:13px;height:7px;border-radius:5px;background:var(--arena-base-core,#1688ed);box-shadow:0 0 14px var(--arena-base-core,#1688ed)}
        .arena2-base-live-core[data-base-side="B"]{--arena-base-core:#ef3e58}
        .arena2-base-live-core[data-base-side="A"]{--arena-base-core:#1688ed}
        .arena2-base-live-core.is-shielded{box-shadow:0 0 0 4px rgba(103,232,249,.16),0 0 28px rgba(103,232,249,.55),0 9px 16px rgba(2,6,23,.28)}
        .arena2-base-core-ring{position:absolute;inset:-15px;border:3px solid color-mix(in srgb,var(--arena-base-core) 75%,white);border-radius:24px;opacity:.7;animation:arenaBaseShieldPulse 1.2s ease-in-out infinite}
        .arena2-base-live-core:not(.is-shielded) .arena2-base-core-ring{display:none}
        .arena2-base-core-bar{position:absolute;left:9px;right:9px;top:6px;height:5px;border-radius:999px;background:linear-gradient(90deg,#22d3ee,var(--arena-base-core));opacity:.95}
        @keyframes arenaBaseShieldPulse{0%,100%{transform:scale(.96);opacity:.42}50%{transform:scale(1.04);opacity:.92}}
        .arena-castle-img{width:min(145px,76%);height:145px;object-fit:contain;filter:drop-shadow(0 8px 7px rgba(0,0,0,.38))}
        .arena-shield-fx{position:absolute;left:50%;top:47%;transform:translate(-50%,-50%);width:155px;height:155px;opacity:.5;pointer-events:none}
        .arena2-base-team{display:flex;flex-wrap:wrap;justify-content:center;align-items:flex-end;gap:1px;min-height:48px;margin-top:-10px;position:relative;z-index:3}
        .arena2-base-mid{position:relative;height:100%;display:flex;align-items:center;justify-content:center}
        .arena2-base-beam{width:100%;height:4px;background:linear-gradient(90deg,#22d3ee,#fff,#fb7185);box-shadow:0 0 18px white;border-radius:999px}
        .arena2-base-mid img{position:absolute;width:70px;height:70px;object-fit:contain;mix-blend-mode:screen}

        .arena-hud-glass,.arena-answer-dark,.arena-action-tile{background:linear-gradient(180deg,rgba(9,37,67,.96),rgba(4,20,40,.96));border:1px solid rgba(121,201,255,.3);box-shadow:0 12px 28px rgba(1,10,23,.3),inset 0 1px rgba(255,255,255,.07);color:white}
        .arena-answer-option{background:rgba(11,39,70,.95);border:1px solid rgba(127,191,255,.32);color:#e8f6ff;box-shadow:inset 0 1px rgba(255,255,255,.07)}
        .arena-answer-option:hover{background:linear-gradient(90deg,#0284c7,#16a34a);color:#fff;border-color:rgba(255,255,255,.52)}
        .arena-action-tile:disabled{filter:grayscale(.65);opacity:.52}

        .arena-monitor-stage{position:relative;min-height:210px;overflow:hidden;border-radius:12px;background:#071a31;color:white}
        .arena-monitor-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.58}
        .arena-monitor-overlay{position:absolute;inset:0;background:linear-gradient(180deg,rgba(2,6,23,.15),rgba(2,6,23,.72));z-index:1}
        .arena-monitor-content{position:relative;z-index:2;height:210px;padding:9px}
        .arena-monitor-title{display:flex;align-items:center;justify-content:space-between;gap:6px;font-size:8px;font-weight:900}
        .arena-monitor-row{display:flex;align-items:center;gap:5px;min-width:0}
        .arena-monitor-progress{height:7px;flex:1;border-radius:999px;background:rgba(2,6,23,.72);overflow:hidden}
        .arena-monitor-progress>span{display:block;height:100%}
        .arena-monitor-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;margin-top:8px}
        .arena-monitor-player{min-width:0;padding:4px;border-radius:8px;background:rgba(2,12,28,.7);border:1px solid rgba(255,255,255,.12);text-align:center}
        .arena-monitor-player span{display:block;font-size:7px;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .arena-monitor-lanes{display:grid;gap:5px;margin-top:9px}
        .arena-monitor-lane{display:grid;grid-template-columns:62px 1fr 28px;align-items:center;gap:5px;font-size:7px;font-weight:900}
        .arena-monitor-base{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:13px}
        .arena-monitor-base-card{padding:8px;border-radius:9px;background:rgba(2,12,28,.72);border:1px solid rgba(255,255,255,.12)}

        @media(max-width:820px){
            .arena2-stage{min-height:390px!important;aspect-ratio:auto}
            .arena2-playfield{left:3%;right:3%;top:24%;bottom:7%}
            .arena2-laser-field{grid-template-columns:82px minmax(110px,1fr) 82px;gap:5px}
            .arena2-laser-field .arena-character-wrap{width:70px!important;height:90px!important}
            .arena2-tug-field{grid-template-columns:1fr minmax(82px,.55fr) 1fr;gap:4px}
            .arena2-team-member{width:44px}
            .arena2-team-member .arena-character-wrap{width:42px!important;height:54px!important}
            .arena2-br-player{width:64px}
            .arena2-br-player .arena-character-wrap{width:38px!important;height:50px!important}
            .arena2-race-field{grid-template-columns:92px 1fr;gap:7px}
            .arena2-race-car-img{width:58px;height:34px}
            .arena2-base-field{grid-template-columns:1fr 52px 1fr;gap:5px}
            .arena2-base-visual{height:130px}
            .arena-castle-img{height:124px}
        }
        @media(max-width:560px){
            .arena-ref-shell{border-radius:16px}
            .arena-ref-bottom{padding:8px}
            .arena2-stage{min-height:360px!important}
            .arena2-hud{left:8px;right:8px;top:8px}
            .arena2-title{font-size:10px}.arena2-status{font-size:7px}
            .arena2-hud-side{font-size:7px;padding:0 5px}
            .arena2-playfield{top:25%;bottom:6%}
            .arena2-laser-field{grid-template-columns:62px minmax(90px,1fr) 62px}
            .arena2-laser-field .arena-character-wrap{width:54px!important;height:72px!important}
            .arena2-fighter-card{display:none}
            .arena2-caption{display:none}
            .arena2-tug-field{grid-template-columns:1fr 68px 1fr}
            .arena2-team{gap:1px}
            .arena2-team-member{width:31px}
            .arena2-team-member .arena-character-wrap{width:29px!important;height:39px!important}
            .arena2-team-member .arena2-name{font-size:6px;padding:2px 3px}
            .arena2-br-player{width:50px}
            .arena2-br-player .arena-character-wrap{width:29px!important;height:39px!important}
            .arena2-br-copy{padding:2px 3px}
            .arena2-br-name{font-size:6px}
            .arena2-br-copy .arena2-stat{font-size:5px}
            .arena2-race-field{grid-template-columns:1fr}
            .arena2-rank{display:none}
            .arena2-race-car-img{width:48px;height:28px}
            .arena2-base-card{padding:5px}
            .arena2-base-visual{height:110px}.arena-castle-img{height:105px}
            .arena2-base-team .arena-character-wrap{width:28px!important;height:38px!important}
            .arena2-base-mid img{width:48px;height:48px}
        }
        @media(prefers-reduced-motion:reduce){
            .arena-character-sprite,.arena-laser-impact::before,.arena-laser-impact::after,.arena-race-smoke{animation:none!important}
        }
    `;
    document.head.appendChild(style);
}

function arenaFxScopeRoot(scope = document) {
    if (!scope) return document;
    if (scope.querySelector) return scope;
    return document;
}

function arenaFxStage(scope = document) {
    const root = arenaFxScopeRoot(scope);
    return root.querySelector?.('[data-arena-stage]') || null;
}

function arenaFxRacerTarget(root, playerId) {
    const holder = root?.querySelector?.(`[data-arena-racer-id="${CSS.escape(String(playerId || ''))}"]`);
    if (!holder) return null;
    return holder.classList?.contains('arena-race-car') ? holder : (holder.querySelector?.('.arena-race-car') || holder);
}

function arenaFxBurst(target, kind = 'spark', count = 8) {
    if (!target) return; const quality=getGameArenaFxQuality(); if(quality==='eco')return;
    const actualCount=quality==='full'?count:Math.min(4,count); const host=target.closest?.('[data-arena-stage]')||target.parentElement;if(!host)return;
    const hr=host.getBoundingClientRect(),r=target.getBoundingClientRect(),cx=r.left-hr.left+r.width/2,cy=r.top-hr.top+r.height/2;
    const color=kind==='repair'?'#86efac':kind==='shield'?'#67e8f9':kind==='boost'?'#fde047':'#f0abfc';
    const shock=document.createElement('span');shock.className='arena-fx-shock';shock.style.left=cx+'px';shock.style.top=cy+'px';shock.style.color=color;host.appendChild(shock);shock.addEventListener('animationend',()=>shock.remove(),{once:true});
    if(quality==='full'){for(let s=0;s<3;s++){const smoke=document.createElement('span');smoke.className='arena-fx-smoke';smoke.style.left=(cx+(s-1)*10)+'px';smoke.style.top=(cy+(s%2?7:-3))+'px';smoke.style.animationDelay=(s*70)+'ms';host.appendChild(smoke);smoke.addEventListener('animationend',()=>smoke.remove(),{once:true});}}
    for(let i=0;i<actualCount;i++){const p=document.createElement('span');p.style.cssText=`position:absolute;z-index:78;width:${quality==='full'?8:5}px;height:${quality==='full'?8:5}px;border-radius:9999px;background:${color};pointer-events:none;left:${cx}px;top:${cy}px;box-shadow:0 0 16px ${color};`;host.appendChild(p);const a=Math.PI*2*i/actualCount+(i%2?.2:0),d=quality==='full'?42+(i%3)*13:23;p.animate([{transform:'translate(-50%,-50%) scale(1)',opacity:1},{transform:`translate(calc(-50% + ${Math.cos(a)*d}px),calc(-50% + ${Math.sin(a)*d}px)) scale(.15)`,opacity:0}],{duration:quality==='full'?690:420,easing:'cubic-bezier(.16,.84,.44,1)'}).onfinish=()=>p.remove();}
    if(quality==='full')host.animate([{transform:'translateX(0)'},{transform:'translateX(-2px)'},{transform:'translateX(2px)'},{transform:'translateX(0)'}],{duration:250,easing:'ease-out'});
}

function arenaFxPulseElement(element, variant = 'correct') {
    if (!element || getGameArenaFxQuality() === 'eco') return;
    const frames = variant === 'hit'
        ? [{ filter:'brightness(1) saturate(1)', opacity:1 }, { filter:'brightness(1.8) saturate(1.45)', opacity:.82 }, { filter:'brightness(1.15) saturate(1.1)', opacity:1 }, { filter:'brightness(1) saturate(1)', opacity:1 }]
        : [{ filter:'brightness(1)', opacity:1 }, { filter:'brightness(1.6)', opacity:.9 }, { filter:'brightness(1)', opacity:1 }];
    element.animate(frames, { duration: variant === 'hit' ? 360 : 430, easing:'ease-out' });
}

function arenaFxTravel(fromEl, toEl, kind = 'energy', scope = document) {
    if (!fromEl || !toEl || getGameArenaFxQuality() === 'eco') return;
    const stage = arenaFxStage(scope) || fromEl.closest?.('[data-arena-stage]');
    if (!stage) return;
    const stageRect = stage.getBoundingClientRect();
    const a = fromEl.getBoundingClientRect();
    const b = toEl.getBoundingClientRect();
    const projectile = document.createElement('span');
    const glyph = kind === 'base' ? '✦' : '●';
    projectile.textContent = glyph;
    projectile.style.cssText = `position:absolute;z-index:60;pointer-events:none;left:${a.left-stageRect.left+a.width/2}px;top:${a.top-stageRect.top+a.height/2}px;color:${kind === 'base' ? '#fde047' : '#c084fc'};font-size:${kind === 'base' ? '24px' : '18px'};text-shadow:0 0 14px currentColor;`;
    stage.appendChild(projectile);
    const dx = (b.left + b.width/2) - (a.left + a.width/2);
    const dy = (b.top + b.height/2) - (a.top + a.height/2);
    projectile.animate([
        { transform:'translate(-50%,-50%) scale(.65)', opacity:.8 },
        { transform:`translate(calc(-50% + ${dx*.52}px), calc(-50% + ${dy*.52-14}px)) scale(1.25)`, opacity:1, offset:.55 },
        { transform:`translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.7)`, opacity:.25 }
    ], { duration:getGameArenaFxQuality()==='full'?560:400, easing:'cubic-bezier(.24,.8,.38,1)' }).onfinish = () => {
        projectile.remove();
        arenaFxPulseElement(toEl, 'hit');
        arenaFxBurst(toEl, kind === 'base' ? 'boost' : 'spark', 9);
    };
}

function arenaFxVictory(scope = document) {
    if (getGameArenaFxQuality() === 'eco') return;
    const stage = arenaFxStage(scope);
    if (!stage) return;
    const count = getGameArenaFxQuality() === 'full' ? 18 : 8;
    const fakeTarget = document.createElement('span');
    fakeTarget.style.cssText = 'position:absolute;left:50%;top:45%;width:1px;height:1px;';
    stage.appendChild(fakeTarget);
    arenaFxBurst(fakeTarget, 'boost', count);
    setTimeout(() => fakeTarget.remove(), 900);
}

function playGameArenaAnswerFx(previousState, nextState, isCorrect, scope = document) {
    if (!isCorrect || !nextState) return;
    const root = arenaFxScopeRoot(scope);
    const mode = nextState.mode;
    const meId = nextState?.me?.id;
    if (mode === 'laser_duel') {
        const impact = root.querySelector?.('.arena-laser-impact');
        arenaFxPulseElement(impact);
        arenaFxBurst(impact, 'spark', 10);
    } else if (mode === 'tug_war') {
        const flag = root.querySelector?.('.arena-tug-flag');
        arenaFxPulseElement(flag);
        const stage = arenaFxStage(root);
        if (stage && getGameArenaFxQuality() === 'full') {
            stage.animate([{transform:'translateX(0)'},{transform:'translateX(-2px)'},{transform:'translateX(2px)'},{transform:'translateX(0)'}],{duration:360});
        }
    } else if (mode === 'battle_royale') {
        const card = root.querySelector?.(`[data-arena-player-id="${CSS.escape(String(meId || ''))}"]`);
        arenaFxPulseElement(card);
        arenaFxBurst(card, 'shield', 8);
    } else if (mode === 'quiz_race') {
        const car = arenaFxRacerTarget(root, meId);
        arenaFxPulseElement(car);
        arenaFxBurst(car, 'boost', 7);
    } else if (mode === 'base_battle') {
        const side = nextState?.me?.side;
        const base = root.querySelector?.(`[data-arena-base-side="${side}"]`);
        arenaFxPulseElement(base);
        arenaFxBurst(base, 'boost', 7);
    }
}

function playGameArenaActionFx(previousState, nextState, action, targetId = '', scope = document) {
    if (!nextState) return;
    const root = arenaFxScopeRoot(scope);
    if (action === 'energy_pulse') {
        const sourceId = nextState?.me?.id;
        const from = root.querySelector?.(`[data-arena-player-id="${CSS.escape(String(sourceId || ''))}"]`);
        const to = root.querySelector?.(`[data-arena-player-id="${CSS.escape(String(targetId || ''))}"]`);
        arenaFxTravel(from, to, 'energy', root);
        return;
    }
    if (nextState.mode === 'base_battle') {
        const ownSide = nextState?.me?.side;
        const enemySide = ownSide === 'A' ? 'B' : 'A';
        const own = root.querySelector?.(`[data-arena-base-side="${ownSide}"]`);
        const enemy = root.querySelector?.(`[data-arena-base-side="${enemySide}"]`);
        if (action === 'base_attack') arenaFxTravel(own, enemy, 'base', root);
        if (action === 'base_shield') { arenaFxPulseElement(own); arenaFxBurst(own, 'shield', 10); }
        if (action === 'base_repair') { arenaFxPulseElement(own); arenaFxBurst(own, 'repair', 10); }
    }
}

function playGameArenaStateDeltaFx(previousState, nextState, scope = document) {
    if (!previousState || !nextState || previousState.mode !== nextState.mode) return;
    const root = arenaFxScopeRoot(scope);
    if (previousState.status !== 'finished' && nextState.status === 'finished') arenaFxVictory(root);

    if (nextState.mode === 'laser_duel' && Number(previousState.position) !== Number(nextState.position)) {
        const impact = root.querySelector?.('.arena-laser-impact');
        arenaFxPulseElement(impact);
        arenaFxBurst(impact, 'spark', 7);
    } else if (nextState.mode === 'tug_war' && Number(previousState.position) !== Number(nextState.position)) {
        arenaFxPulseElement(root.querySelector?.('.arena-tug-flag'));
    } else if (nextState.mode === 'battle_royale') {
        for (const player of nextState.players || []) {
            const prev = (previousState.players || []).find(p => String(p.id) === String(player.id));
            if (prev && Number(player.hp) < Number(prev.hp)) {
                const card = root.querySelector?.(`[data-arena-player-id="${CSS.escape(String(player.id))}"]`);
                arenaFxPulseElement(card, 'hit');
                arenaFxBurst(card, 'shield', 7);
            }
        }
    } else if (nextState.mode === 'quiz_race') {
        for (const player of nextState.players || []) {
            const prev = (previousState.players || []).find(p => String(p.id) === String(player.id));
            if (prev && Number(player.raceProgress) > Number(prev.raceProgress)) {
                const car = arenaFxRacerTarget(root, player.id);
                arenaFxPulseElement(car);
            }
        }
    } else if (nextState.mode === 'base_battle') {
        for (const side of ['A','B']) {
            const prevBase = previousState.base?.[side] || {};
            const nextBase = nextState.base?.[side] || {};
            const base = root.querySelector?.(`[data-arena-base-side="${side}"]`);
            if (Number(nextBase.hp) < Number(prevBase.hp) || Number(nextBase.shield) < Number(prevBase.shield)) {
                arenaFxPulseElement(base, 'hit'); arenaFxBurst(base, 'boost', 8);
            } else if (Number(nextBase.hp) > Number(prevBase.hp)) {
                arenaFxPulseElement(base); arenaFxBurst(base, 'repair', 7);
            } else if (Number(nextBase.shield) > Number(prevBase.shield)) {
                arenaFxPulseElement(base); arenaFxBurst(base, 'shield', 7);
            }
        }
    }
}

ensureGameArenaFxStyles();

let adminArenaMonitoringTimer = null;
let arenaAdminConfigLoading = false;
let arenaStudentConfigLoading = false;

function defaultClientArenaConfig() {
    const modes = {};
    GAME_ARENA_MODE_META.forEach(mode => {
        modes[mode.id] = { enabled: true, quickMatch: true, classIds: [], gameIds: [] };
    });
    return {
        version: 1,
        modes,
        visibleSections: {
            catalog: { enabled: true, classIds: [] },
            arena: { enabled: true, classIds: [] },
            treasure: { enabled: true, classIds: [] },
            tower: { enabled: true, classIds: [] }
        }
    };
}

function normalizeClientArenaConfig(raw) {
    const base = defaultClientArenaConfig();
    const source = raw && typeof raw === 'object' ? raw : {};
    GAME_ARENA_MODE_META.forEach(mode => {
        const item = source?.modes?.[mode.id] || {};
        base.modes[mode.id] = {
            enabled: item.enabled !== false,
            quickMatch: item.quickMatch !== false,
            classIds: Array.isArray(item.classIds) ? [...new Set(item.classIds.map(x => String(x || '')).filter(Boolean))] : [],
            gameIds: Array.isArray(item.gameIds) ? [...new Set(item.gameIds.map(x => String(x || '')).filter(Boolean))] : []
        };
    });
    const sectionSource = source?.visibleSections || {};
    ['catalog', 'arena', 'treasure', 'tower'].forEach(section => {
        const item = sectionSource[section];
        base.visibleSections[section] = {
            enabled: typeof item === 'boolean' ? item : item?.enabled !== false,
            classIds: Array.isArray(item?.classIds) ? [...new Set(item.classIds.map(x => String(x || '')).filter(Boolean))] : []
        };
    });
    return base;
}

async function loadGameArenaAdminConfig(force = false) {
    if (!force && appState.gameArenaAdminConfig) return appState.gameArenaAdminConfig;
    if (arenaAdminConfigLoading) return appState.gameArenaAdminConfig || defaultClientArenaConfig();
    arenaAdminConfigLoading = true;
    try {
        const res = await fetch('/api/game-arena/admin/config', { cache: 'no-store' });
        const data = await res.json();
        if (res.ok && data.success) {
            appState.gameArenaAdminConfig = normalizeClientArenaConfig(data.config);
        }
    } catch (_) {
    } finally {
        arenaAdminConfigLoading = false;
    }
    return appState.gameArenaAdminConfig || defaultClientArenaConfig();
}

function ensureGameArenaAdminConfigLoaded() {
    if (appState.gameArenaAdminConfig || arenaAdminConfigLoading) return;
    loadGameArenaAdminConfig(true).then(() => {
        if ((window.__adminGameSubTab || 'kelola') === 'kelola') {
            const container = document.getElementById('view-container');
            if (container) renderGameAdminModule(container);
        }
    });
}

async function loadGameArenaStudentConfig(force = false) {
    if (!force && appState.gameArenaStudentConfig) return appState.gameArenaStudentConfig;
    if (arenaStudentConfigLoading) return appState.gameArenaStudentConfig || defaultClientArenaConfig();
    arenaStudentConfigLoading = true;
    try {
        const res = await fetch('/api/game-arena/config', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error('Konfigurasi Game Edukasi tidak tersedia.');
        appState.gameArenaStudentConfig = normalizeClientArenaConfig(data.config);
    } catch (_) {
        appState.gameArenaStudentConfig = appState.gameArenaStudentConfig || defaultClientArenaConfig();
    } finally {
        arenaStudentConfigLoading = false;
    }
    return appState.gameArenaStudentConfig || defaultClientArenaConfig();
}

function ensureGameArenaStudentConfigLoaded() {
    if (appState.gameArenaStudentConfig || arenaStudentConfigLoading) return;
    loadGameArenaStudentConfig(true).then(() => {
        const container = document.getElementById('view-container');
        if (appState.currentRoute === 'game_edukasi_siswa' && container) renderGameStudentModule(container);
    });
}

function getArenaCompatibleAdminGames() {
    const allowed = new Set(['tebak_kata', 'tebak_gambar', 'susun_kata', 'true_false']);
    return (Array.isArray(appState.eduGames) ? appState.eduGames : [])
        .filter(game => game && game.status !== 'inactive' && allowed.has(String(game.gameType || '')));
}

function arenaClassLabel(config) {
    const ids = Array.isArray(config?.classIds) ? config.classIds : [];
    if (!ids.length) return 'Semua Kelas';
    const classes = Array.isArray(appState.classes) ? appState.classes : [];
    const names = ids.map(id => classes.find(c => String(c.id || c.code || c.name) === String(id))?.name || id);
    if (names.length <= 2) return names.join(', ');
    return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

function renderAdminArenaManagementSection() {
    const config = appState.gameArenaAdminConfig || defaultClientArenaConfig();
    const compatibleGames = getArenaCompatibleAdminGames();
    return `
        <div class="bg-gradient-to-br from-slate-950 via-violet-950 to-slate-950 p-6 sm:p-8 rounded-3xl text-white shadow-xl border border-violet-500/30 space-y-5">
            <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                    <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/30 text-fuchsia-200 text-[10px] font-black uppercase tracking-widest">
                        <i class="fa-solid fa-users-viewfinder"></i> Hosted Class Arena
                    </span>
                    <h2 class="text-xl sm:text-2xl font-black mt-2">Kelola Game Arena</h2>
                    <p class="text-xs text-slate-300 mt-1 max-w-2xl">Atur mode yang tampil, target kelas, sumber soal, dan apakah siswa boleh Quick Match. Untuk pembelajaran kelas, buat Hosted Room lalu mulai pertandingan dari Monitoring Arena.</p>
                </div>
                <button type="button" onclick="window.__adminGameSubTab='arena-monitoring'; renderGameAdminModule(document.getElementById('view-container'));" class="px-4 py-2.5 rounded-xl bg-fuchsia-600 hover:bg-fuchsia-500 text-white text-xs font-black cursor-pointer whitespace-nowrap">
                    <i class="fa-solid fa-tv mr-1"></i> Buka Monitoring Arena
                </button>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                ${GAME_ARENA_MODE_META.map(mode => {
                    const item = config.modes?.[mode.id] || { enabled: true, quickMatch: true, classIds: [], gameIds: [] };
                    const sourceCount = Array.isArray(item.gameIds) && item.gameIds.length ? item.gameIds.length : compatibleGames.length;
                    return `
                        <div class="rounded-2xl border ${item.enabled ? 'border-violet-400/30 bg-white/8' : 'border-slate-700 bg-slate-900/70 opacity-65'} p-4 space-y-3">
                            <div class="flex items-start justify-between gap-3">
                                <div><div class="text-2xl">${mode.icon}</div><h3 class="font-black text-sm mt-1">${gameEscapeHtml(mode.title)}</h3><p class="text-[10px] text-slate-400 mt-1">${gameEscapeHtml(mode.tag)}</p></div>
                                <button type="button" onclick="toggleGameArenaAdminMode('${mode.id}')" class="px-2.5 py-1 rounded-full text-[9px] font-black cursor-pointer ${item.enabled ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-400/30' : 'bg-slate-700 text-slate-300'}">${item.enabled ? 'AKTIF' : 'NONAKTIF'}</button>
                            </div>
                            <div class="grid grid-cols-2 gap-2 text-[9px]">
                                <div class="rounded-xl bg-slate-950/50 p-2"><span class="text-slate-500 block">Kelas</span><b class="text-slate-200">${gameEscapeHtml(arenaClassLabel(item))}</b></div>
                                <div class="rounded-xl bg-slate-950/50 p-2"><span class="text-slate-500 block">Sumber Soal</span><b class="text-slate-200">${sourceCount} game</b></div>
                                <div class="rounded-xl bg-slate-950/50 p-2 col-span-2"><span class="text-slate-500">Matchmaking</span><b class="float-right ${item.quickMatch ? 'text-cyan-300' : 'text-amber-300'}">${item.quickMatch ? 'Hosted + Quick Match' : 'Hosted Room Saja'}</b></div>
                            </div>
                            <div class="flex gap-2">
                                <button type="button" onclick="openGameArenaAdminConfigModal('${mode.id}')" class="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black cursor-pointer"><i class="fa-solid fa-sliders mr-1"></i> Kelola</button>
                                <button type="button" onclick="openGameArenaHostModal('${mode.id}')" ${item.enabled ? '' : 'disabled'} class="flex-1 py-2.5 rounded-xl ${item.enabled ? 'bg-fuchsia-600 hover:bg-fuchsia-500 cursor-pointer' : 'bg-slate-700 cursor-not-allowed'} text-white text-[10px] font-black"><i class="fa-solid fa-users mr-1"></i> Buat Room</button>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

window.toggleGameArenaAdminMode = async function(modeId) {
    const config = await loadGameArenaAdminConfig(true);
    if (!config.modes?.[modeId]) return;
    config.modes[modeId].enabled = !config.modes[modeId].enabled;
    await saveGameArenaAdminConfig(config);
};

window.openGameEducationVisibilityModal = async function() {
    const config = await loadGameArenaAdminConfig(true);
    const sections = [
        { id: 'catalog', icon: '🎮', title: 'Semua Katalog', desc: 'Game edukasi biasa yang tersedia.' },
        { id: 'arena', icon: '⚔️', title: 'Game Arena', desc: 'Pertandingan Arena yang di-host admin.' },
        { id: 'treasure', icon: '🗺️', title: 'Harta Karun', desc: 'Peta petualangan dan titik harta.' },
        { id: 'tower', icon: '🏰', title: 'Menara', desc: 'Quest menara bertingkat.' }
    ];
    const classes = Array.isArray(appState.classes) ? appState.classes : [];
    const modal = document.getElementById('modal-container');
    if (!modal) return;
    modal.innerHTML = `<div class="fixed inset-0 z-[125] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3">
        <div class="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl">
            <form onsubmit="saveGameEducationVisibility(event)">
                <div class="sticky top-0 z-10 bg-slate-950 text-white p-5 flex items-center justify-between">
                    <div><h3 class="font-black text-lg">🎮 Pilih Kategori Game untuk Siswa</h3><p class="text-[10px] text-slate-400">Kategori yang tidak dicentang tidak akan muncul di akun siswa.</p></div>
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="w-9 h-9 rounded-xl bg-slate-800 cursor-pointer"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <div class="p-5 space-y-4">
                    ${sections.map(section => {
                        const item = config.visibleSections?.[section.id] || { enabled: true, classIds: [] };
                        const selected = new Set(Array.isArray(item.classIds) ? item.classIds.map(String) : []);
                        return `<div class="rounded-2xl border border-slate-200 p-4 space-y-3">
                            <label class="flex items-start gap-3 cursor-pointer"><input id="game-section-${section.id}" type="checkbox" class="mt-1 h-4 w-4 accent-indigo-600" ${item.enabled !== false ? 'checked' : ''}><span><b class="text-sm text-slate-800">${section.icon} ${section.title}</b><small class="block text-[10px] text-slate-500 mt-1">${section.desc}</small></span></label>
                            <label class="block text-[10px] font-bold text-slate-500">Berlaku untuk kelas <select id="game-section-classes-${section.id}" multiple class="mt-1 w-full min-h-20 rounded-xl border border-slate-200 p-2 text-xs bg-slate-50"><option value="">Semua Kelas</option>${classes.map(item => { const id = String(item.id || item.code || item.name || ''); return id ? `<option value="${gameEscapeHtml(id)}" ${selected.has(id) ? 'selected' : ''}>${gameEscapeHtml(item.name || item.code || id)}</option>` : ''; }).join('')}</select><span class="font-normal text-slate-400">Kosongkan pilihan untuk semua kelas.</span></label>
                        </div>`;
                    }).join('')}
                    <div class="flex justify-end gap-2 pt-2"><button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 cursor-pointer">Batal</button><button type="submit" class="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black cursor-pointer">Simpan Tampilan Siswa</button></div>
                </div>
            </form>
        </div>
    </div>`;
};

window.saveGameEducationVisibility = async function(event) {
    event.preventDefault();
    const config = await loadGameArenaAdminConfig(true);
    config.visibleSections = {};
    for (const id of ['catalog', 'arena', 'treasure', 'tower']) {
        const select = document.getElementById(`game-section-classes-${id}`);
        config.visibleSections[id] = {
            enabled: Boolean(document.getElementById(`game-section-${id}`)?.checked),
            classIds: select ? [...select.selectedOptions].map(option => option.value).filter(Boolean) : []
        };
    }
    await saveGameArenaAdminConfig(config);
    const modal = document.getElementById('modal-container');
    if (modal) modal.innerHTML = '';
};

async function saveGameArenaAdminConfig(config) {
    try {
        const res = await fetch('/api/game-arena/admin/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ modes: config.modes, visibleSections: config.visibleSections })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Gagal menyimpan konfigurasi Arena.');
        appState.gameArenaAdminConfig = normalizeClientArenaConfig(data.config);
        appState.gameArenaStudentConfig = null;
        showToast('Konfigurasi Game Arena disimpan.', 'success');
        const container = document.getElementById('view-container');
        if (container) renderGameAdminModule(container);
        return true;
    } catch (err) {
        showToast(err?.message || 'Gagal menyimpan konfigurasi Arena.', 'error');
        return false;
    }
}

window.openGameArenaAdminConfigModal = async function(modeId) {
    const config = await loadGameArenaAdminConfig(true);
    const modeMeta = GAME_ARENA_MODE_META.find(item => item.id === modeId);
    const item = config.modes?.[modeId];
    if (!modeMeta || !item) return;
    const classes = Array.isArray(appState.classes) ? appState.classes : [];
    const games = getArenaCompatibleAdminGames();
    const modal = document.getElementById('modal-container');
    if (!modal) return;

    modal.innerHTML = `
        <div class="fixed inset-0 z-[120] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3">
            <div class="w-full max-w-3xl max-h-[92vh] overflow-y-auto bg-white rounded-3xl shadow-2xl">
                <form onsubmit="saveGameArenaModeAdminForm(event, '${modeId}')">
                    <div class="sticky top-0 z-10 bg-slate-950 text-white p-5 flex items-center justify-between">
                        <div><h3 class="font-black text-lg">${modeMeta.icon} Kelola ${gameEscapeHtml(modeMeta.title)}</h3><p class="text-[10px] text-slate-400">Target kelas, sumber soal, dan mode masuk siswa.</p></div>
                        <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="w-9 h-9 rounded-xl bg-slate-800 cursor-pointer"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                    <div class="p-5 space-y-5">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <label class="rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3 cursor-pointer"><div><b class="text-sm text-slate-800 block">Mode Aktif</b><span class="text-[10px] text-slate-500">Tampilkan kepada kelas yang dipilih.</span></div><input id="arena-admin-enabled" type="checkbox" ${item.enabled ? 'checked' : ''} class="w-5 h-5 accent-emerald-600"></label>
                            <label class="rounded-2xl border border-slate-200 p-4 flex items-center justify-between gap-3 cursor-pointer"><div><b class="text-sm text-slate-800 block">Quick Match</b><span class="text-[10px] text-slate-500">Jika mati, siswa hanya bisa masuk Hosted Room guru.</span></div><input id="arena-admin-quick" type="checkbox" ${item.quickMatch ? 'checked' : ''} class="w-5 h-5 accent-indigo-600"></label>
                        </div>

                        <div class="space-y-2">
                            <div><b class="text-xs text-slate-800">Target Kelas</b><p class="text-[10px] text-slate-500">Kosongkan semua pilihan untuk mengizinkan semua kelas.</p></div>
                            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-44 overflow-y-auto rounded-2xl bg-slate-50 border border-slate-200 p-3">
                                ${classes.map(cls => {
                                    const id = String(cls.id || cls.code || cls.name || '');
                                    const checked = item.classIds.includes(id);
                                    return `<label class="flex items-center gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 text-[10px] font-bold text-slate-700 cursor-pointer"><input type="checkbox" data-arena-class value="${gameEscapeAttr(id)}" ${checked ? 'checked' : ''} class="accent-indigo-600"> ${gameEscapeHtml(cls.name || cls.code || id)}</label>`;
                                }).join('') || '<p class="col-span-full text-xs text-slate-400">Belum ada data kelas.</p>'}
                            </div>
                        </div>

                        <div class="space-y-2">
                            <div><b class="text-xs text-slate-800">Sumber Soal Arena</b><p class="text-[10px] text-slate-500">Kosongkan semua pilihan untuk memakai semua game kompatibel yang aktif.</p></div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto rounded-2xl bg-slate-50 border border-slate-200 p-3">
                                ${games.map(game => {
                                    const id = String(game.id || '');
                                    const checked = item.gameIds.includes(id);
                                    return `<label class="flex items-start gap-2 rounded-xl bg-white border border-slate-200 px-3 py-2 text-[10px] text-slate-700 cursor-pointer"><input type="checkbox" data-arena-game value="${gameEscapeAttr(id)}" ${checked ? 'checked' : ''} class="mt-0.5 accent-fuchsia-600"><span><b class="block">${gameEscapeHtml(game.title || 'Game')}</b><span class="text-slate-400">${gameEscapeHtml(game.subjectId || 'Umum')} · ${gameEscapeHtml(game.classId || 'Semua Kelas')}</span></span></label>`;
                                }).join('') || '<p class="col-span-full text-xs text-slate-400">Belum ada game kompatibel aktif.</p>'}
                            </div>
                        </div>
                    </div>
                    <div class="sticky bottom-0 bg-white border-t border-slate-200 p-4 flex justify-end gap-2">
                        <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold cursor-pointer">Batal</button>
                        <button type="submit" class="px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black cursor-pointer"><i class="fa-solid fa-floppy-disk mr-1"></i> Simpan</button>
                    </div>
                </form>
            </div>
        </div>
    `;
};

window.saveGameArenaModeAdminForm = async function(event, modeId) {
    event?.preventDefault?.();
    const config = await loadGameArenaAdminConfig(true);
    const item = config.modes?.[modeId];
    if (!item) return;
    item.enabled = Boolean(document.getElementById('arena-admin-enabled')?.checked);
    item.quickMatch = Boolean(document.getElementById('arena-admin-quick')?.checked);
    item.classIds = Array.from(document.querySelectorAll('[data-arena-class]:checked')).map(el => String(el.value || ''));
    item.gameIds = Array.from(document.querySelectorAll('[data-arena-game]:checked')).map(el => String(el.value || ''));
    const ok = await saveGameArenaAdminConfig(config);
    if (ok) document.getElementById('modal-container').innerHTML = '';
};

window.openGameArenaHostModal = async function(modeId) {
    const config = await loadGameArenaAdminConfig(true);
    const modeMeta = GAME_ARENA_MODE_META.find(item => item.id === modeId);
    const item = config.modes?.[modeId];
    if (!modeMeta || !item || !item.enabled) return;
    const allowedIds = new Set(item.classIds || []);
    const classes = (Array.isArray(appState.classes) ? appState.classes : []).filter(cls => {
        const id = String(cls.id || cls.code || cls.name || '');
        return allowedIds.size === 0 || allowedIds.has(id) || allowedIds.has(String(cls.name || ''));
    });
    const modal = document.getElementById('modal-container');
    if (!modal) return;
    modal.innerHTML = `
        <div class="fixed inset-0 z-[120] bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3">
            <div class="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden">
                <form onsubmit="createHostedGameArenaRoom(event, '${modeId}')">
                    <div class="bg-slate-950 text-white p-5"><h3 class="font-black text-lg">${modeMeta.icon} Buat Hosted Room</h3><p class="text-[10px] text-slate-400">Siswa masuk lobby terlebih dahulu. Guru menentukan kapan permainan dimulai.</p></div>
                    <div class="p-5 space-y-3">
                        <label class="text-xs font-black text-slate-700">Kelas</label>
                        <select id="arena-host-class" required class="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold">
                            <option value="">Pilih kelas...</option>
                            ${classes.map(cls => {
                                const id = String(cls.id || cls.code || cls.name || '');
                                return `<option value="${gameEscapeAttr(id)}">${gameEscapeHtml(cls.name || cls.code || id)}</option>`;
                            }).join('')}
                        </select>
                        <div class="rounded-2xl bg-violet-50 border border-violet-200 p-3 text-[10px] text-violet-800"><b>Alur:</b> buat room → siswa membuka mode Arena → semua avatar muncul di Monitoring Arena → guru tekan Mulai.</div>
                    </div>
                    <div class="p-4 border-t border-slate-200 flex justify-end gap-2"><button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold cursor-pointer">Batal</button><button type="submit" class="px-4 py-2 rounded-xl bg-fuchsia-600 text-white text-xs font-black cursor-pointer">Buat Room</button></div>
                </form>
            </div>
        </div>
    `;
};

window.createHostedGameArenaRoom = async function(event, modeId) {
    event?.preventDefault?.();
    const classKey = String(document.getElementById('arena-host-class')?.value || '');
    if (!classKey) return;
    try {
        const res = await fetch('/api/game-arena/admin/rooms', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: modeId, classKey }) });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Gagal membuat Hosted Room.');
        document.getElementById('modal-container').innerHTML = '';
        showToast('Hosted Room Arena dibuat. Siswa sekarang dapat masuk lobby.', 'success');
        window.__adminGameSubTab = 'arena-monitoring';
        renderGameAdminModule(document.getElementById('view-container'));
    } catch (err) {
        showToast(err?.message || 'Gagal membuat Hosted Room Arena.', 'error');
    }
};

function renderAdminArenaRoomCard(room) {
    const state = room?.state;
    if (!state) return '';
    ensureGameArenaReferenceStyles();
    const meta = getGameArenaModeMeta(room.mode);
    const statusLabel = room.status === 'playing' ? '● LIVE' : room.status === 'waiting' ? 'LOBBY' : 'SELESAI';
    return `<div data-arena-monitor-room="${gameEscapeAttr(room.id)}" class="rounded-2xl bg-[#071a31] border border-sky-500/25 overflow-hidden shadow-xl min-w-0">
        <div class="px-3 py-2 flex items-center justify-between gap-2 border-b border-sky-500/20">
            <div class="min-w-0"><h3 class="font-black text-white text-xs truncate">${meta.icon} ${gameEscapeHtml(meta.title)} – Monitoring</h3><p class="text-[8px] text-slate-400 truncate">${gameEscapeHtml(room.className || room.classKey || 'Kelas')} · ${gameEscapeHtml(room.id)}</p></div>
            <span class="text-[8px] font-black ${room.status === 'playing' ? 'text-emerald-300' : room.status === 'waiting' ? 'text-amber-300' : 'text-slate-300'}">${statusLabel}</span>
        </div>
        <div class="p-2">${renderGameArenaMonitorStage(state)}</div>
        <div class="px-2 pb-2 flex gap-1 flex-wrap">
            ${room.status === 'waiting' ? `<button type="button" onclick="controlAdminGameArenaRoom('${room.id}','start')" class="px-2 py-1.5 rounded-lg bg-emerald-600 text-white text-[8px] font-black cursor-pointer">Mulai</button>` : ''}
            ${room.status === 'playing' ? `<button type="button" onclick="controlAdminGameArenaRoom('${room.id}','finish')" class="px-2 py-1.5 rounded-lg bg-amber-600 text-white text-[8px] font-black cursor-pointer">Selesai</button>` : ''}
            <button type="button" onclick="controlAdminGameArenaRoom('${room.id}','reset')" class="px-2 py-1.5 rounded-lg bg-slate-700 text-white text-[8px] font-black cursor-pointer">Reset</button>
            <button type="button" onclick="controlAdminGameArenaRoom('${room.id}','delete')" class="px-2 py-1.5 rounded-lg bg-rose-900 text-rose-100 text-[8px] font-black cursor-pointer">Hapus</button>
        </div>
    </div>`;
}

window.refreshAdminGameArenaMonitoring = async function(showNotice = false) {
    const container = document.getElementById('game-arena-monitoring-content');
    if (!container) return;
    try {
        const res = await fetch('/api/game-arena/admin/rooms', { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Gagal membaca room Arena.');
        const rooms = Array.isArray(data.rooms) ? data.rooms : [];
        const live = rooms.filter(room => room.status === 'playing').length;
        const waiting = rooms.filter(room => room.status === 'waiting').length;
        const players = rooms.reduce((sum, room) => sum + Number(room.playerCount || 0), 0);
        container.innerHTML = `
            <div class="grid grid-cols-3 gap-3">
                <div class="rounded-2xl bg-slate-950 border border-slate-800 p-4"><span class="text-[9px] uppercase font-black text-slate-500">Room</span><b class="text-2xl text-white block">${rooms.length}</b></div>
                <div class="rounded-2xl bg-slate-950 border border-emerald-900/40 p-4"><span class="text-[9px] uppercase font-black text-emerald-500">Live</span><b class="text-2xl text-emerald-300 block">${live}</b></div>
                <div class="rounded-2xl bg-slate-950 border border-indigo-900/40 p-4"><span class="text-[9px] uppercase font-black text-indigo-400">Siswa di Arena</span><b class="text-2xl text-indigo-200 block">${players}</b><span class="text-[9px] text-slate-500">${waiting} room lobby</span></div>
            </div>
            <div class="mt-5 grid gap-3" style="grid-template-columns:repeat(auto-fit,minmax(260px,1fr))">
                ${rooms.length ? rooms.map(renderAdminArenaRoomCard).join('') : `<div class="rounded-3xl border border-dashed border-slate-700 bg-slate-950/50 p-12 text-center"><div class="text-4xl mb-3">🎮</div><h3 class="font-black text-white">Belum ada Arena aktif</h3><p class="text-xs text-slate-400 mt-1">Buat Hosted Room dari tab Kelola Game & Mode, atau tunggu siswa memulai Quick Match.</p></div>`}
            </div>
        `;
        requestAnimationFrame(() => {
            rooms.forEach(room => {
                const previous = adminArenaFxSnapshots[room.id] || null;
                const card = container.querySelector(`[data-arena-monitor-room="${CSS.escape(String(room.id))}"]`);
                if (previous && card) playGameArenaStateDeltaFx(previous, room.state, card);
                adminArenaFxSnapshots[room.id] = room.state;
            });
            Object.keys(adminArenaFxSnapshots).forEach(roomId => {
                if (!rooms.some(room => String(room.id) === String(roomId))) delete adminArenaFxSnapshots[roomId];
            });
        });
        if (showNotice) showToast('Monitoring Arena diperbarui.', 'success');
    } catch (err) {
        container.innerHTML = `<div class="rounded-2xl bg-rose-950/40 border border-rose-900 p-5 text-rose-200 text-xs font-bold">${gameEscapeHtml(err?.message || 'Gagal memuat Monitoring Arena.')}</div>`;
    }
};

window.controlAdminGameArenaRoom = async function(roomId, action) {
    try {
        const res = await fetch('/api/game-arena/admin/room-action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId, action }) });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Aksi room gagal.');
        if (action === 'start') showToast('Pertandingan Arena dimulai.', 'success');
        if (action === 'finish') showToast('Pertandingan Arena diselesaikan.', 'info');
        await window.refreshAdminGameArenaMonitoring(false);
    } catch (err) {
        showToast(err?.message || 'Aksi Room Arena gagal.', 'error');
    }
};

let activeArenaSession = null;
let activeArenaPollTimer = null;

function getGameArenaModeMeta(mode) {
    return GAME_ARENA_MODE_META.find(item => item.id === mode) || GAME_ARENA_MODE_META[0];
}

function getGameArenaAvatarPreset(presetId) {
    return GAME_ARENA_AVATARS.find(item => item.id === presetId) || GAME_ARENA_AVATARS[0];
}

function getArenaAvatarHairSvg(presetId, hair) {
    const id = String(presetId || 'bintang');
    if (id === 'roket') return `<path d="M23 35C24 17 38 8 52 10c13 2 20 11 20 25-8-8-13-12-24-12-9 0-17 4-25 12Z" fill="${hair}"/><path d="M27 24c10-13 31-16 43-2-13-4-28-3-43 2Z" fill="rgba(255,255,255,.12)"/>`;
    if (id === 'buku') return `<path d="M22 35c0-16 12-26 28-26 15 0 28 10 28 27-5-5-10-8-15-9-4 7-12 9-21 5-7 6-13 5-20 3Z" fill="${hair}"/><circle cx="29" cy="25" r="5" fill="${hair}"/><circle cx="70" cy="26" r="5" fill="${hair}"/>`;
    if (id === 'komet') return `<path d="M20 37C19 19 30 7 49 7c17 0 29 12 29 29-10-7-17-11-27-10-10 1-19 5-31 11Z" fill="${hair}"/><path d="M58 10c11 2 18 8 22 17-9-4-18-6-27-5 4-5 5-8 5-12Z" fill="rgba(255,255,255,.14)"/>`;
    if (id === 'bulan') return `<path d="M20 38C18 22 28 9 48 8c20-1 31 12 31 29-8-4-15-6-22-5-8 1-15 4-22 0-5 4-10 6-15 6Z" fill="${hair}"/><path d="M24 20c10-9 30-12 46-3-15-3-31-2-46 3Z" fill="rgba(255,255,255,.1)"/>`;
    if (id === 'petir') return `<path d="M22 37C21 19 32 8 48 8c17 0 29 9 31 27l-12-7-7 6-9-8-9 8-8-6-12 9Z" fill="${hair}"/>`;
    return `<path d="M21 37C20 20 31 9 49 9c17 0 29 11 29 27-7-6-13-9-21-10-8 7-18 7-27 1-3 4-6 7-9 10Z" fill="${hair}"/><path d="M29 18c9-7 27-8 39-1-12-2-25-1-39 1Z" fill="rgba(255,255,255,.12)"/>`;
}

const GAME_ARENA_HD_BACKGROUNDS = Object.freeze({
    tug_war: '/assets/game-arena-hd/tug-schoolyard.svg',
    base_battle: '/assets/game-arena-hd/base-fortress.svg',
    battle_royale: '/assets/game-arena-hd/battle-map.svg',
    laser_duel: '/assets/game-arena-hd/laser-neon.svg',
    quiz_race: '/assets/game-arena-hd/quiz-track.svg'
});

function gameArenaHdBackground(mode) {
    return GAME_ARENA_HD_BACKGROUNDS[mode] || GAME_ARENA_HD_BACKGROUNDS.laser_duel;
}

function arenaHdPalette(side) {
    return side === 'B'
        ? { primary:'#e9345c', secondary:'#a7133d', light:'#ff86a2', glow:'#ff4f87', dark:'#5d102c', trim:'#fff0f4' }
        : { primary:'#1688ed', secondary:'#0759ad', light:'#79d8ff', glow:'#27cfff', dark:'#07366d', trim:'#eefaff' };
}

function arenaHdPropSvg(mode, palette, pose, defense) {
    const firing = pose === 'action';
    if (mode === 'laser_duel') {
        return `<g transform="translate(68 76)">
            <rect x="0" y="0" width="35" height="11" rx="5.5" fill="${palette.dark}" stroke="${palette.trim}" stroke-width="2"/>
            <rect x="25" y="2" width="18" height="7" rx="3.5" fill="${palette.glow}"/>
            <rect x="7" y="8" width="8" height="14" rx="4" fill="${palette.secondary}"/>
            ${firing ? `<path d="M43 5.5h34" stroke="${palette.glow}" stroke-width="7" stroke-linecap="round" opacity=".96"/><path d="M45 5.5h31" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>` : ''}
        </g>`;
    }
    if (mode === 'base_battle') {
        if (defense) {
            return `<g transform="translate(79 63)"><path d="M0 0Q22 2 30 12v24Q21 53 0 60Q-20 52-28 36V12Q-20 2 0 0Z" fill="${palette.primary}" stroke="${palette.trim}" stroke-width="4"/><path d="M0 8v42" stroke="${palette.light}" stroke-width="4" opacity=".75"/></g>`;
        }
        return `<g transform="translate(70 77)"><rect width="35" height="10" rx="5" fill="${palette.dark}" stroke="${palette.trim}" stroke-width="2"/><rect x="27" y="2" width="15" height="6" rx="3" fill="${palette.glow}"/>${firing ? `<path d="M42 5l22-8v16Z" fill="${palette.glow}" opacity=".92"/>` : ''}</g>`;
    }
    if (mode === 'battle_royale') {
        return `<g transform="translate(67 75)"><rect width="39" height="9" rx="4.5" fill="#252a35" stroke="${palette.trim}" stroke-width="1.8"/><rect x="7" y="-5" width="13" height="7" rx="3" fill="${palette.secondary}"/><rect x="8" y="8" width="8" height="15" rx="3" fill="#252a35"/>${firing ? `<path d="M39 4.5l19-9v18Z" fill="#ffd34d"/><circle cx="60" cy="4.5" r="5" fill="#fff4b5"/>` : ''}</g>`;
    }
    return '';
}

function renderArenaModeCharacter(mode, side, player, pose = 'idle', sizeClass = 'w-16', extraClass = '', bucketOverride = '') {
    const safeSide = side === 'B' ? 'B' : 'A';
    const palette = arenaHdPalette(safeSide);
    const key = String(player?.id || player?.name || 'arena');
    const female = arenaStableIndex(key, 2) === 1;
    const impact = pose === 'impact';
    const victory = pose === 'victory';
    const action = pose === 'action';
    const defense = mode === 'base_battle' && bucketOverride === 'defense';
    const cleanExtra = String(extraClass || '').replace(/scale-x-\[-1\]/g, '').trim();
    const facing = safeSide === 'B' ? 'translate(120 0) scale(-1 1)' : '';
    const bodyTransform = impact ? 'translate(3 8) rotate(9 60 82)' : victory ? 'translate(0 -3)' : action ? 'translate(2 0) rotate(-2 60 85)' : '';
    const eyeY = impact ? 51 : 49;
    const mouth = impact
        ? '<path d="M52 62q8-7 16 0" fill="none" stroke="#6f342c" stroke-width="2.5" stroke-linecap="round"/>'
        : victory
            ? '<path d="M51 60q9 10 18 0" fill="#b73542" stroke="#6f342c" stroke-width="2"/>'
            : '<path d="M55 61q5 4 10 0" fill="none" stroke="#6f342c" stroke-width="2" stroke-linecap="round"/>';
    const arms = victory
        ? `<g stroke="#f1ad82" stroke-width="11" stroke-linecap="round"><path d="M38 83L23 61"/><path d="M82 83l15-22"/></g><g fill="#f5b58e"><circle cx="20" cy="57" r="7"/><circle cx="100" cy="57" r="7"/></g>`
        : mode === 'tug_war' || action
            ? `<g stroke="#f1ad82" stroke-width="11" stroke-linecap="round"><path d="M39 83L62 85"/><path d="M80 82L68 86"/></g><g fill="#f5b58e"><circle cx="64" cy="86" r="7"/><circle cx="70" cy="86" r="7"/></g>`
            : `<g stroke="#f1ad82" stroke-width="10" stroke-linecap="round"><path d="M39 84L31 99"/><path d="M81 84l8 15"/></g>`;
    const headwear = female
        ? `<path d="M29 49Q28 18 60 13Q92 18 91 49Q85 28 60 27Q35 28 29 49Z" fill="#f8fbff" stroke="#cdd9e8" stroke-width="3"/><path d="M34 37Q44 19 60 18Q78 20 86 38" fill="none" stroke="${palette.primary}" stroke-width="6"/><path d="M33 45Q27 62 37 74L48 67Q41 58 43 47Z" fill="#f8fbff" stroke="#cdd9e8" stroke-width="2"/><path d="M87 45Q93 62 83 74L72 67Q79 58 77 47Z" fill="#f8fbff" stroke="#cdd9e8" stroke-width="2"/>`
        : `<path d="M32 35Q35 16 60 14Q84 16 88 35Q75 27 60 28Q45 27 32 35Z" fill="#111827"/><path d="M34 31Q39 11 60 10Q81 11 86 31Z" fill="#1f2937" stroke="#0b1019" stroke-width="3"/><path d="M35 39Q42 30 50 31L44 43Z" fill="#161b25"/><path d="M70 31Q79 31 85 40L76 44Z" fill="#161b25"/>`;
    const prop = arenaHdPropSvg(mode, palette, pose, defense);
    return `<span class="${sizeClass} ${cleanExtra} arena-character-wrap arena-hd-character block shrink-0 select-none pointer-events-none"
        data-arena-hd="true" data-arena-mode="${gameEscapeAttr(mode)}" data-arena-side="${safeSide}" data-arena-pose="${gameEscapeAttr(pose)}"
        role="img" aria-label="${gameEscapeAttr(player?.name || `Tim ${safeSide}`)}">
        <svg viewBox="0 0 120 140" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <g transform="${facing}"><g transform="${bodyTransform}">
            <ellipse cx="60" cy="131" rx="34" ry="7" fill="#020617" opacity=".24"/>
            <path d="M42 92L35 121Q35 129 47 130H55L57 98Z" fill="${palette.secondary}" stroke="${palette.dark}" stroke-width="3"/>
            <path d="M78 92L85 121Q85 129 73 130H65L63 98Z" fill="${palette.secondary}" stroke="${palette.dark}" stroke-width="3"/>
            <ellipse cx="44" cy="127" rx="14" ry="6" fill="#202734"/><ellipse cx="76" cy="127" rx="14" ry="6" fill="#202734"/>
            <path d="M38 75Q60 65 82 75L87 105Q60 115 33 105Z" fill="${palette.primary}" stroke="${palette.dark}" stroke-width="3"/>
            <path d="M50 72V108M70 72V108" stroke="${palette.light}" stroke-width="2" opacity=".55"/>
            ${arms}
            <circle cx="60" cy="49" r="29" fill="#f7ba91" stroke="#9e5f48" stroke-width="2.5"/>
            ${headwear}
            <g fill="#1b2430"><ellipse cx="49" cy="${eyeY}" rx="4.5" ry="6"/><ellipse cx="71" cy="${eyeY}" rx="4.5" ry="6"/></g>
            <g fill="#fff"><circle cx="50" cy="${eyeY-2}" r="1.8"/><circle cx="72" cy="${eyeY-2}" r="1.8"/></g>
            <path d="M47 42q5-4 10-1M63 41q5-3 10 1" fill="none" stroke="#4b2c28" stroke-width="2.2" stroke-linecap="round"/>
            ${mouth}
            <circle cx="39" cy="59" r="5" fill="#ef7f83" opacity=".32"/><circle cx="81" cy="59" r="5" fill="#ef7f83" opacity=".32"/>
            ${prop}
            ${impact ? `<g fill="#ffd54a"><path d="M91 31l4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1Z"/><path d="M100 59l3 6 7 1-5 4 1 7-6-4-6 4 2-7-5-4 6-1Z"/></g>` : ''}
          </g></g>
        </svg>
    </span>`;
}

function renderArenaQuizKart(player, sizeClass = 'w-20', extraClass = '', winner = false) {
    const key = String(player?.id || player?.name || 'racer');
    const index = arenaStableIndex(key, 4);
    const colors = [
        {p:'#1688ed',d:'#0759ad',l:'#79d8ff'},
        {p:'#e9345c',d:'#a7133d',l:'#ff86a2'},
        {p:'#21a55b',d:'#126638',l:'#7ee7a5'},
        {p:'#f4b72a',d:'#a56d00',l:'#ffe18a'}
    ][index];
    const female = index === 1 || index === 3;
    const cleanExtra = String(extraClass || '').replace(/scale-x-\[-1\]/g, '').trim();
    return `<span class="${sizeClass} ${cleanExtra} arena-character-wrap arena-hd-kart block shrink-0 select-none pointer-events-none"
      data-arena-hd="true" role="img" aria-label="${gameEscapeAttr(player?.name || 'Racer')}">
      <svg viewBox="0 0 170 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse cx="84" cy="89" rx="70" ry="8" fill="#020617" opacity=".25"/>
        <circle cx="40" cy="77" r="19" fill="#202734"/><circle cx="129" cy="77" r="19" fill="#202734"/>
        <circle cx="40" cy="77" r="9" fill="#77808d"/><circle cx="129" cy="77" r="9" fill="#77808d"/>
        <path d="M25 45Q83 29 143 47L151 76Q85 91 18 76Z" fill="${colors.p}" stroke="${colors.d}" stroke-width="4"/>
        <path d="M47 43Q83 32 122 43L112 61H58Z" fill="${colors.l}" opacity=".8"/>
        <rect x="65" y="54" width="40" height="24" rx="8" fill="#f7fbff" opacity=".92"/>
        <path d="M73 60q12-6 24 0v13q-12-6-24 0Z" fill="none" stroke="${colors.d}" stroke-width="4"/>
        <g transform="translate(57 4)">
          <circle cx="29" cy="25" r="21" fill="#f7ba91" stroke="#9e5f48" stroke-width="2"/>
          ${female ? `<path d="M8 28Q7 6 29 3Q51 6 50 29Q42 14 29 14Q16 14 8 28Z" fill="#fafcff" stroke="#d2dbe8" stroke-width="2"/><path d="M12 18Q20 6 29 6Q40 7 47 19" fill="none" stroke="${colors.p}" stroke-width="4"/>` : `<path d="M9 17Q12 2 29 1Q46 2 50 18Z" fill="#1f2937" stroke="#0b1019" stroke-width="2"/>`}
          <ellipse cx="22" cy="26" rx="3.5" ry="4.5" fill="#182231"/><ellipse cx="36" cy="26" rx="3.5" ry="4.5" fill="#182231"/>
          <path d="M22 35q7 7 14 0" fill="#b73542" stroke="#6f342c" stroke-width="1.5"/>
        </g>
        ${winner ? `<g transform="translate(134 6)"><path d="M6 0h24v20q0 18-12 18T6 20Z" fill="#ffc928" stroke="#a66b00" stroke-width="3"/><path d="M6 5H0q0 16 12 19M30 5h6q0 16-12 19" fill="none" stroke="#ffc928" stroke-width="6"/><path d="M18 37v12M8 50h20" stroke="#a66b00" stroke-width="5"/></g>` : ''}
      </svg>
    </span>`;
}

function renderGameArenaAvatar(presetId, sizeClass = 'w-16', extraClass = '', pose = 'idle') {
    const side = arenaStableIndex(presetId || 'arena', 2) ? 'B' : 'A';
    return renderArenaModeCharacter('base_battle', side, { id: presetId || 'arena', name: getGameArenaAvatarPreset(presetId).name }, pose, sizeClass, extraClass);
}

function getCurrentGameArenaAvatarId() {
    const currentId = String(appState.currentUser?.id || '');
    const storedStudent = (Array.isArray(appState.students) ? appState.students : [])
        .find(student => String(student?.id || '') === currentId);
    return String(
        appState.currentUser?.gameAvatar?.presetId ||
        storedStudent?.gameAvatar?.presetId ||
        'bintang'
    ).toLowerCase();
}

function getArenaCompatibleClientGames(games) {
    const allowed = new Set(['tebak_kata', 'tebak_gambar', 'susun_kata', 'true_false']);
    const student = appState.currentUser || {};
    const classKey = String(student.classId || student.class_id || student.className || student.kelas || '');
    const className = String(student.className || student.kelas || classKey || '');
    const filterCompatible = list => (Array.isArray(list) ? list : []).filter(game => {
        if (!game || game.status === 'inactive' || !allowed.has(String(game.gameType || ''))) return false;
        const targets = Array.isArray(game.classIds) && game.classIds.length ? game.classIds : [game.classId || ''];
        return targets.some(target => {
            const raw = String(target || '');
            const normalized = raw.trim().toLowerCase();
            return !normalized || normalized === 'semua kelas' || normalized === 'all' || normalized === '*' || raw === classKey || raw === className;
        });
    });
    const customPool = filterCompatible(games);
    return customPool.length ? customPool : filterCompatible(SAMPLE_SEED_GAMES);
}

function renderGameArenaModeCard(mode) {
    let preview = '';
    if (mode.id === 'laser_duel') {
        preview = `<img src="${gameArenaHdBackground('laser_duel')}" class="absolute inset-0 w-full h-full object-cover opacity-70" alt=""><div class="absolute inset-x-10 top-[52%] h-1 bg-gradient-to-r from-cyan-400 via-white to-fuchsia-500 shadow-[0_0_20px_white]"></div><div class="absolute left-5 bottom-1">${renderArenaModeCharacter('laser_duel','A',{id:'preview-laser-a',name:'Team A'},'action','w-16')}</div><div class="absolute right-5 bottom-1">${renderArenaModeCharacter('laser_duel','B',{id:'preview-laser-b',name:'Team B'},'action','w-16','scale-x-[-1]')}</div>`;
    } else if (mode.id === 'tug_war') {
        preview = `<img src="${gameArenaHdBackground('tug_war')}" class="absolute inset-0 w-full h-full object-cover opacity-75" alt=""><div class="absolute inset-x-12 top-[60%] h-2 rounded-full bg-amber-800"></div><div class="absolute left-1/2 top-[32%] -translate-x-1/2 text-3xl">🚩</div><div class="absolute left-6 bottom-1">${renderArenaModeCharacter('tug_war','A',{id:'preview-tug-a'},'action','w-16')}</div><div class="absolute right-6 bottom-1">${renderArenaModeCharacter('tug_war','B',{id:'preview-tug-b'},'action','w-16','scale-x-[-1]')}</div>`;
    } else if (mode.id === 'battle_royale') {
        const samples = [
            renderArenaModeCharacter('battle_royale','A',{id:'br-a1'},'idle','w-11'),
            renderArenaModeCharacter('battle_royale','A',{id:'br-a2'},'action','w-11'),
            renderArenaModeCharacter('battle_royale','A',{id:'br-a3'},'action','w-11'),
            renderArenaModeCharacter('battle_royale','B',{id:'br-b1'},'idle','w-11'),
            renderArenaModeCharacter('battle_royale','B',{id:'br-b2'},'action','w-11'),
            renderArenaModeCharacter('battle_royale','B',{id:'br-b3'},'victory','w-11')
        ].join('');
        preview = `<img src="${gameArenaHdBackground('battle_royale')}" class="absolute inset-0 w-full h-full object-cover opacity-65" alt=""><div class="absolute inset-4 grid grid-cols-3 gap-1 place-items-center">${samples}</div>`;
    } else if (mode.id === 'quiz_race') {
        preview = `<img src="${gameArenaHdBackground('quiz_race')}" class="absolute inset-0 w-full h-full object-cover opacity-70" alt=""><div class="absolute inset-x-4 top-7 space-y-3">${[0,1,2].map((idx)=>`<div class="relative h-7 border-b border-white/30"><span class="absolute -top-4" style="left:${[66,42,18][idx]}%">${renderArenaQuizKart({id:'preview-racer-'+idx},'w-20')}</span></div>`).join('')}</div><div class="absolute right-5 top-5 bottom-5 border-r-4 border-dashed border-white/70"></div>`;
    } else {
        preview = `<img src="${gameArenaHdBackground('base_battle')}" class="absolute inset-0 w-full h-full object-cover opacity-70" alt=""><img src="${gameArenaAsset('structures/fortress-blue.svg')}" class="absolute left-3 bottom-2 w-20 h-24 object-contain" alt=""><img src="${gameArenaAsset('structures/fortress-red.svg')}" class="absolute right-3 bottom-2 w-20 h-24 object-contain" alt=""><div class="absolute left-20 bottom-1">${renderArenaModeCharacter('base_battle','A',{id:'preview-base-a'},'action','w-14')}</div><div class="absolute right-20 bottom-1">${renderArenaModeCharacter('base_battle','B',{id:'preview-base-b'},'action','w-14','scale-x-[-1]')}</div>`;
    }

    return `
        <button type="button" onclick="openGameArenaMode('${mode.id}')" class="text-left rounded-3xl overflow-hidden border border-slate-200 bg-white shadow-sm hover:shadow-xl transition group cursor-pointer">
            <div class="h-40 bg-gradient-to-br ${mode.gradient} relative overflow-hidden">
                ${preview}
                <div class="absolute inset-0 bg-gradient-to-t from-slate-950/45 via-transparent to-transparent"></div>
                <span class="absolute top-4 left-4 px-3 py-1 rounded-full bg-slate-950/55 border border-white/20 text-white text-[10px] font-black uppercase">${gameEscapeHtml(mode.tag)}</span>
            </div>
            <div class="p-5">
                <h3 class="font-black text-lg text-slate-900 group-hover:${mode.accent} transition">${mode.icon} ${gameEscapeHtml(mode.title)}</h3>
                <p class="text-xs text-slate-500 mt-1 leading-relaxed">${gameEscapeHtml(mode.description)}</p>
                <div class="mt-4 inline-flex items-center gap-2 text-xs font-black ${mode.accent}">Masuk Arena <i class="fa-solid fa-arrow-right"></i></div>
            </div>
        </button>
    `;
}

function renderStudentArenaTab(games) {
    ensureGameArenaStudentConfigLoaded();
    const compatibleGames = getArenaCompatibleClientGames(games);
    const studentArenaConfig = appState.gameArenaStudentConfig || defaultClientArenaConfig();
    const visibleArenaModes = GAME_ARENA_MODE_META.filter(mode => studentArenaConfig.modes?.[mode.id]?.enabled !== false);
    return `
        <div class="space-y-6 animate-fade-in">
            <div class="bg-gradient-to-br from-slate-950 via-indigo-950 to-purple-950 rounded-3xl p-6 sm:p-8 text-white shadow-2xl border border-indigo-500/30 relative overflow-hidden">
                <div class="absolute -right-10 -top-10 w-52 h-52 rounded-full bg-indigo-500/10 blur-3xl"></div>
                <div class="relative z-10 flex flex-col lg:flex-row gap-6 lg:items-center lg:justify-between">
                    <div class="space-y-3 max-w-2xl">
                        <span class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-400/30 text-[10px] font-black uppercase tracking-[0.18em] text-fuchsia-200"><i class="fa-solid fa-bolt"></i> Madrasah Game Arena</span>
                        <h2 class="text-2xl sm:text-3xl font-black">5 mode PvP dan tim dalam satu Arena.</h2>
                        <p class="text-xs sm:text-sm text-indigo-100/80 leading-relaxed">Soal menjadi sumber daya gameplay: daya laser, tarikan tim, energi, boost balap, atau mana strategi. Arena terpisah dari CBT serta tidak meminta kamera maupun audio.</p>
                        <div class="flex flex-wrap gap-2 text-[10px] font-extrabold">
                            <span class="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10"><i class="fa-solid fa-gamepad mr-1"></i> ${visibleArenaModes.length} mode tersedia</span>
                            <span class="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10"><i class="fa-solid fa-book-open mr-1"></i> ${compatibleGames.length} tantangan kompatibel</span>
                            <span class="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10"><i class="fa-solid fa-shield-halved mr-1"></i> Kunci jawaban tetap di server</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                ${visibleArenaModes.length ? visibleArenaModes.map(mode => renderGameArenaModeCard(mode)).join('') : '<div class="col-span-full rounded-3xl bg-white border border-slate-200 p-10 text-center"><div class="text-4xl mb-2">🎮</div><h3 class="font-black text-slate-800">Belum ada mode Arena aktif untuk kelasmu</h3><p class="text-xs text-slate-500 mt-1">Guru dapat mengaktifkannya dari Kelola Game Arena.</p></div>'}
            </div>

        </div>
    `;
}

window.saveGameArenaAvatar = async function(presetId) {
    if (!GAME_ARENA_AVATARS.some(item => item.id === presetId)) return;
    try {
        const res = await fetch('/api/game-arena/avatar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ presetId })
        });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Gagal menyimpan avatar.');
        if (appState.currentUser) {
            appState.currentUser.gameAvatar = data.avatar || { presetId };
            safeSetLocalStorage('madrasah_current_user', appState.currentUser);
        }
        showToast('Avatar Arena diperbarui.', 'success');
        if (window.__studentGameSubTab === 'arena') renderGameStudentModule(document.getElementById('view-container'));
    } catch (err) {
        showToast(err?.message || 'Gagal menyimpan avatar Arena.', 'error');
    }
};

function getArenaMePlayer(state) {
    return (state?.players || []).find(player => String(player.id) === String(state?.me?.id || '')) || null;
}

function getArenaSidePlayers(state, side) {
    return arenaStablePlayers((state?.players || []).filter(player => player.side === side));
}

function renderArenaPlayerChip(player, fallbackLabel = 'Menunggu...') {
    if (!player) {
        return `<div class="flex items-center gap-2 opacity-60"><div class="w-11 h-11 rounded-xl border-2 border-dashed border-sky-300/45 flex items-center justify-center text-sky-200"><i class="fa-solid fa-user-plus"></i></div><span class="text-xs font-bold text-sky-100">${fallbackLabel}</span></div>`;
    }
    const preset = String(player.avatar?.presetId || 'bintang');
    return `<div class="flex items-center gap-2 min-w-0">${renderGameArenaAvatar(preset, 'w-11 h-11', 'shrink-0')}<div class="min-w-0"><div class="font-black text-xs text-white truncate">${gameEscapeHtml(player.name || 'Siswa')}</div><div class="text-[10px] text-sky-200 font-bold">Benar ${Number(player.correctAnswers || 0)} · Streak ${Number(player.streak || 0)}</div></div></div>`;
}

function arenaClamp(value, min = 0, max = 100) {
    return Math.max(min, Math.min(max, Number(value || 0)));
}

function arenaStatusText(state) {
    if (state?.status === 'playing') return 'LIVE';
    if (state?.status === 'finished') return 'SELESAI';
    return 'LOBBY';
}

function arenaPlayerPose(state, player) {
    if (!player) return 'idle';
    const hasHp = player.hp !== undefined && player.hp !== null && Number.isFinite(Number(player.hp));
    if (player.eliminated || (hasHp && Number(player.hp) <= 0)) return 'impact';
    if (state?.status === 'finished') {
        const individualWinner = state?.winnerPlayerId && String(state.winnerPlayerId) === String(player.id);
        const teamWinner = state?.winnerSide && String(state.winnerSide) === String(player.side);
        return individualWinner || teamWinner ? 'victory' : 'idle';
    }
    return state?.status === 'playing' ? 'action' : 'idle';
}

function arenaStablePlayers(players) {
    return [...(Array.isArray(players) ? players : [])].sort((a, b) => {
        const ah = arenaStableHash(a?.id || a?.name || '');
        const bh = arenaStableHash(b?.id || b?.name || '');
        if (ah !== bh) return ah - bh;
        return String(a?.id || '').localeCompare(String(b?.id || ''));
    });
}

function arenaBattlePosition(index) {
    const slots = [
        [9,16],[26,15],[42,17],[58,16],[74,15],[91,18],
        [12,38],[29,37],[45,39],[61,37],[77,39],[89,40],
        [9,61],[26,60],[42,62],[58,60],[74,61],[91,63],
        [12,82],[29,81],[45,83],[61,81],[77,82],[89,84]
    ];
    return slots[Math.abs(Number(index || 0)) % slots.length];
}

function renderArenaTopHud(title, status, leftLabel, rightLabel, leftPct, rightPct) {
    const safeLeft = arenaClamp(leftPct);
    const safeRight = arenaClamp(rightPct);
    const total = safeLeft + safeRight || 100;
    const leftWidth = (safeLeft / total) * 100;
    const rightWidth = 100 - leftWidth;
    const theme = String(title || '').toLowerCase().includes('laser') ? 'laser'
        : String(title || '').toLowerCase().includes('tambang') ? 'tug'
        : String(title || '').toLowerCase().includes('base') ? 'base'
        : String(title || '').toLowerCase().includes('battle royale') ? 'royale'
        : 'race';
    return `<div class="arena2-hud arena2-hud-reference" data-arena-hud-theme="${theme}">
        <div class="arena2-hud-card arena2-hud-card-a">
            <div class="arena2-hud-card-label">${gameEscapeHtml(leftLabel)}</div>
            <div class="arena2-hud-card-meter"><span style="width:${leftWidth}%"></span></div>
        </div>
        <div class="arena2-hud-center">
            <div class="arena-score-pill"><span class="arena2-title">${gameEscapeHtml(title)}</span><span class="arena2-status">${gameEscapeHtml(status)}</span></div>
        </div>
        <div class="arena2-hud-card arena2-hud-card-b">
            <div class="arena2-hud-card-label">${gameEscapeHtml(rightLabel)}</div>
            <div class="arena2-hud-card-meter"><span style="width:${rightWidth}%"></span></div>
        </div>
    </div>`;
}

function renderLaserArenaStage(state) {
    ensureGameArenaReferenceStyles();
    const left = getArenaSidePlayers(state, 'A')[0] || null;
    const right = getArenaSidePlayers(state, 'B')[0] || null;
    const position = arenaClamp(state.position, 5, 95);
    const quality = getGameArenaFxQuality();
    const leftPct = Math.round(position);
    const rightPct = 100 - leftPct;
    const fighter = (player, fallback, side) => {
        if (!player) return `<div class="arena2-fighter"><div class="arena2-fighter-card arena2-glass"><span class="arena2-stat">${fallback}</span></div></div>`;
        const pose = arenaPlayerPose(state, player);
        return `<div class="arena2-fighter ${side === 'B' ? 'arena2-fighter-b' : ''}">
            <div class="arena2-fighter-card arena2-glass"><div class="arena2-name">${gameEscapeHtml(player.name || 'Siswa')}</div><div class="arena2-stat mt-1">Benar ${Number(player.correctAnswers || 0)} · Streak ${Number(player.streak || 0)}</div></div>
            ${renderArenaModeCharacter('laser_duel', side, player, pose, 'w-32', side === 'B' ? 'scale-x-[-1]' : '')}
        </div>`;
    };
    return `<div data-arena-stage="laser_duel" data-arena-fx="${quality}" class="arena-stage arena2-stage">
        <img src="${gameArenaHdBackground('laser_duel')}" class="arena2-bg" alt="">
        <div class="arena2-vignette"></div>
        ${renderArenaTopHud('Laser Duel', arenaStatusText(state), `Tim A ${leftPct}%`, `Tim B ${rightPct}%`, leftPct, rightPct)}
        <div class="arena2-playfield">
            <div class="arena2-laser-field">
                ${fighter(left, 'Menunggu Tim A', 'A')}
                <div class="arena2-laser-zone">
                    <div class="arena2-laser-track">
                        <div class="arena-laser-beam arena2-laser-beam arena2-laser-a" style="width:${position}%"></div>
                        <div class="arena-laser-beam arena2-laser-beam arena2-laser-b" style="width:${100-position}%"></div>
                        <div class="arena-laser-impact" style="left:${position}%"></div>
                    </div>
                </div>
                ${fighter(right, 'Menunggu Tim B', 'B')}
            </div>
        </div>
        <div class="arena2-caption">Jawaban benar mendorong titik benturan ke arah lawan</div>
    </div>`;
}

function renderTugArenaStage(state) {
    ensureGameArenaReferenceStyles();
    const teamA = getArenaSidePlayers(state, 'A');
    const teamB = getArenaSidePlayers(state, 'B');
    const position = arenaClamp(state.position, 5, 95);
    const quality = getGameArenaFxQuality();
    const aPower = Math.round(100 - position);
    const bPower = Math.round(position);
    const team = (items, side) => {
        const visible = items.slice(0, 6);
        return `${visible.map(player => `<div class="arena2-team-member">
            ${renderArenaModeCharacter('tug_war', side, player, arenaPlayerPose(state, player), 'w-16', side === 'B' ? 'scale-x-[-1]' : '')}
            <div class="arena2-name">${gameEscapeHtml(player.name || 'Siswa')}</div>
        </div>`).join('')}${items.length > visible.length ? `<div class="arena2-team-overflow">+${items.length-visible.length}</div>` : ''}`;
    };
    return `<div data-arena-stage="tug_war" data-arena-fx="${quality}" class="arena-stage arena2-stage">
        <img src="${gameArenaHdBackground('tug_war')}" class="arena2-bg" alt="">
        <div class="arena2-vignette"></div>
        ${renderArenaTopHud('Tarik Tambang Ilmu', arenaStatusText(state), `Tim A · ${teamA.length} siswa`, `Tim B · ${teamB.length} siswa`, aPower, bPower)}
        <div class="arena2-playfield">
            <div class="arena2-tug-field">
                <div class="arena2-team arena-team-a">${team(teamA, 'A')}</div>
                <div class="arena2-tug-center">
                    <div class="arena-tug-rope"></div>
                    <div class="arena-tug-flag" style="left:${position}%"><div class="arena2-flag-glyph">🚩</div><div class="arena2-flag-pole"></div></div>
                </div>
                <div class="arena2-team arena-team-b">${team(teamB, 'B')}</div>
            </div>
        </div>
        <div class="arena2-caption">Tim A menarik ke kiri · Tim B menarik ke kanan</div>
    </div>`;
}

function renderBattleRoyaleArenaStage(state) {
    ensureGameArenaReferenceStyles();
    const players = arenaStablePlayers(state.players || []);
    const active = players.filter(player => !player.eliminated && Number(player.hp || 0) > 0);
    const meId = String(state.me?.id || '');
    const quality = getGameArenaFxQuality();
    const visible = players.slice(0, 24);
    return `<div data-arena-stage="battle_royale" data-arena-fx="${quality}" class="arena-stage arena2-stage">
        <img src="${gameArenaHdBackground('battle_royale')}" class="arena2-bg" alt="">
        <div class="arena2-vignette"></div>
        ${renderArenaTopHud('Battle Royale Energi', arenaStatusText(state), `${active.length} aktif`, `${players.length-active.length} eliminasi`, Math.max(1, active.length), Math.max(1, players.length-active.length))}
        <div class="arena2-playfield">
            <div class="arena2-br-field">
                ${visible.map((player,index) => {
                    const hp = Math.max(0, Number(player.hp || 0));
                    const hpPct = arenaClamp((hp / 3) * 100);
                    const mine = String(player.id) === meId;
                    const pos = arenaBattlePosition(index);
                    return `<div data-arena-player-id="${gameEscapeAttr(player.id)}" data-eliminated="${player.eliminated ? 'true' : 'false'}" data-mine="${mine ? 'true' : 'false'}" class="arena2-br-player" style="--arena-left:${pos[0]}%;--arena-top:${pos[1]}%">
                        ${renderArenaModeCharacter('battle_royale', player.side === 'B' ? 'B' : 'A', player, arenaPlayerPose(state, player), mine ? 'w-14' : 'w-12')}
                        <div class="arena2-br-copy">
                            <div class="arena2-br-name">${gameEscapeHtml(player.name || 'Siswa')}</div>
                            <div class="arena2-stat">${player.eliminated ? 'Penonton' : `Shield ${hp} · ⚡ ${Number(player.energy || 0)}`}</div>
                            <div class="arena2-br-meter"><span style="width:${hpPct}%"></span></div>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>
        ${players.length > 24 ? `<div class="arena2-caption">24 pemain ditampilkan · +${players.length-24} tetap aktif di ronde</div>` : ''}
    </div>`;
}

function renderQuizRaceArenaStage(state) {
    ensureGameArenaReferenceStyles();
    const sorted = [...(state.players || [])].sort((a, b) => Number(b.raceProgress || 0) - Number(a.raceProgress || 0) || String(a.id).localeCompare(String(b.id)));
    const meId = String(state.me?.id || '');
    const mePlayer = meId ? sorted.find(player => String(player.id) === meId) : null;
    const visible = sorted.slice(0, 5);
    if (mePlayer && !visible.some(player => String(player.id) === meId)) visible.push(mePlayer);
    const quality = getGameArenaFxQuality();
    return `<div data-arena-stage="quiz_race" data-arena-fx="${quality}" class="arena-stage arena2-stage">
        <img src="${gameArenaHdBackground('quiz_race')}" class="arena2-bg" alt="">
        <div class="arena2-vignette"></div>
        ${renderArenaTopHud('Quiz Racing', arenaStatusText(state), `${sorted.length} pembalap`, 'Garis finis 100%', 50, 50)}
        <div class="arena2-playfield">
            <div class="arena2-race-field">
                <div class="arena2-rank arena2-glass">
                    ${sorted.slice(0,6).map((player,index) => `<div class="arena2-rank-row" data-mine="${String(player.id)===meId?'true':'false'}"><b class="arena2-rank-no">${index+1}</b><span class="truncate font-black">${gameEscapeHtml(player.name || 'Siswa')}</span><b>${Math.round(arenaClamp(player.raceProgress))}%</b></div>`).join('')}
                </div>
                <div class="arena2-race-track">
                    ${visible.slice(0,6).map((player,index) => {
                        const progress = arenaClamp(player.raceProgress);
                        const mine = String(player.id) === meId;
                        const won = state.status === 'finished' && String(state.winnerPlayerId || '') === String(player.id);
                        return `<div class="arena2-race-lane"><div data-arena-racer-id="${gameEscapeAttr(player.id)}" class="arena-race-car arena-race-vehicle ${mine?'drop-shadow-[0_0_12px_rgba(34,211,238,.95)]':''}" style="left:${Math.max(5,Math.min(94,progress))}%"><span class="arena-race-smoke"></span>${renderArenaQuizKart(player, won ? 'w-16' : 'w-20', '', won)}<span class="arena2-name arena2-racer-name">${gameEscapeHtml(player.name || 'Siswa')}</span></div></div>`;
                    }).join('')}
                    <div class="arena2-race-finish"></div>
                </div>
            </div>
        </div>
    </div>`;
}

function renderBaseBattleArenaStage(state) {
    ensureGameArenaReferenceStyles();
    const teamA = getArenaSidePlayers(state, 'A');
    const teamB = getArenaSidePlayers(state, 'B');
    const a = state.base?.A || { hp: 100, shield: 0 };
    const b = state.base?.B || { hp: 100, shield: 0 };
    const hpA = arenaClamp(a.hp);
    const hpB = arenaClamp(b.hp);
    const shA = Math.max(0, Number(a.shield || 0));
    const shB = Math.max(0, Number(b.shield || 0));
    const quality = getGameArenaFxQuality();
    const teamLine = (items, side, shield) => {
        const visible = items.slice(0, 6);
        return `${visible.map(player => {
            const pose = arenaPlayerPose(state, player);
            const bucket = shield > 0 && pose !== 'impact' && pose !== 'victory' ? 'defense' : '';
            return renderArenaModeCharacter('base_battle', side, player, pose, 'w-11', side === 'B' ? 'scale-x-[-1]' : '', bucket);
        }).join('')}${items.length > visible.length ? `<span class="arena2-team-overflow">+${items.length-visible.length}</span>` : ''}`;
    };
    const base = (side, hp, shield, players, fortress, fallback, flip = false) => `<div data-arena-base-side="${side}" data-arena-base-hp="${hp}" data-arena-base-shield="${shield}" class="arena2-base arena2-base-${side.toLowerCase()} ${hp < 30 ? 'arena-base-critical' : ''}">
        <div class="arena2-base-card arena2-glass"><div class="arena2-base-head"><span>Tim ${side}</span><span>HP ${Math.round(hp)}/100</span></div><div class="arena2-base-meter"><span style="width:${hp}%"></span></div><div class="arena2-stat mt-1">Shield ${shield} · ${players.length} siswa</div></div>
        <div class="arena2-base-visual">
            <div class="arena2-base-live-core ${shield > 0 ? 'is-shielded' : ''}" data-base-side="${side}" data-base-shield="${shield}">
                <span class="arena2-base-core-ring"></span>
                <span class="arena2-base-core-bar" style="width:${hp}%"></span>
            </div>
            <img src="${gameArenaFxAsset('shield')}" class="arena-shield-fx arena-shield-active" style="display:${shield > 0 ? 'block' : 'none'};opacity:${Math.min(.78,.35 + Math.min(10, shield) * .04)}" alt="">
        </div>
        <div class="arena2-base-team">${teamLine(players, side, shield)}</div>
    </div>`;
    return `<div data-arena-stage="base_battle" data-arena-fx="${quality}" class="arena-stage arena2-stage">
        <img src="${gameArenaHdBackground('base_battle')}" class="arena2-bg" alt="">
        <div class="arena2-vignette"></div>
        ${renderArenaTopHud('Base Battle', arenaStatusText(state), `Tim A · HP ${Math.round(hpA)}`, `Tim B · HP ${Math.round(hpB)}`, hpA, hpB)}
        <div class="arena2-playfield">
            <div class="arena2-base-field">
                ${base('A', hpA, shA, teamA, 'fortress-blue.svg', 'bintang')}
                <div class="arena2-base-mid"><div class="arena2-base-beam"></div></div>
                ${base('B', hpB, shB, teamB, 'fortress-red.svg', 'komet', true)}
            </div>
        </div>
    </div>`;
}

function renderGameArenaStage(state) {
    ensureGameArenaReferenceStyles();
    if (state.mode === 'tug_war') return renderTugArenaStage(state);
    if (state.mode === 'battle_royale') return renderBattleRoyaleArenaStage(state);
    if (state.mode === 'quiz_race') return renderQuizRaceArenaStage(state);
    if (state.mode === 'base_battle') return renderBaseBattleArenaStage(state);
    return renderLaserArenaStage(state);
}

function renderGameArenaMonitorStage(state) {
    ensureGameArenaReferenceStyles();
    const mode = String(state?.mode || 'laser_duel');
    const meta = getGameArenaModeMeta(mode);
    const background = gameArenaHdBackground(mode);

    let body = '';
    if (mode === 'laser_duel') {
        const left = getArenaSidePlayers(state,'A')[0] || null;
        const right = getArenaSidePlayers(state,'B')[0] || null;
        const position = arenaClamp(state.position,5,95);
        body = `<div class="absolute left-2 right-2 bottom-3 flex items-end justify-between">
            ${left ? renderArenaModeCharacter('laser_duel','A',left,arenaPlayerPose(state,left),'w-12') : '<span></span>'}
            ${right ? renderArenaModeCharacter('laser_duel','B',right,arenaPlayerPose(state,right),'w-12','scale-x-[-1]') : '<span></span>'}
        </div><div class="absolute left-[20%] right-[20%] top-[55%] h-2"><div class="arena-laser-beam arena2-laser-beam arena2-laser-a" style="width:${position}%"></div><div class="arena-laser-beam arena2-laser-beam arena2-laser-b" style="width:${100-position}%"></div><div class="arena-laser-impact" style="left:${position}%"></div></div>`;
    } else if (mode === 'tug_war') {
        const pos = arenaClamp(state.position,5,95);
        const teamA = getArenaSidePlayers(state,'A'), teamB = getArenaSidePlayers(state,'B');
        body = `<div class="mt-8 text-[8px] font-black flex justify-between"><span>Tim A · ${teamA.length}</span><span>Tim B · ${teamB.length}</span></div><div class="relative mt-10 h-3 rounded-full bg-amber-800"><span class="arena-tug-flag absolute -top-8 -translate-x-1/2 text-xl" style="left:${pos}%">🚩</span></div>`;
    } else if (mode === 'battle_royale') {
        const players = arenaStablePlayers(state.players || []).slice(0,8);
        body = `<div class="arena-monitor-grid">${players.map(player => `<div data-arena-player-id="${gameEscapeAttr(player.id)}" class="arena-monitor-player ${player.eliminated?'opacity-40 grayscale':''}">${renderArenaModeCharacter('battle_royale',player.side === 'B' ? 'B' : 'A',player,arenaPlayerPose(state,player),'w-9')}<span>${gameEscapeHtml(player.name || 'Siswa')}</span><small class="text-[6px] text-cyan-200">🛡 ${Number(player.hp||0)} · ⚡ ${Number(player.energy||0)}</small></div>`).join('')}</div>`;
    } else if (mode === 'quiz_race') {
        const sorted = [...(state.players || [])].sort((a,b)=>Number(b.raceProgress||0)-Number(a.raceProgress||0)).slice(0,4);
        body = `<div class="arena-monitor-lanes">${sorted.map(player => { const p=arenaClamp(player.raceProgress); const won=state.status==='finished'&&String(state.winnerPlayerId||'')===String(player.id); return `<div data-arena-racer-id="${gameEscapeAttr(player.id)}" class="arena-monitor-lane"><span class="truncate">${gameEscapeHtml(player.name||'Siswa')}</span><div class="arena-monitor-progress"><span style="width:${p}%;background:linear-gradient(90deg,#22d3ee,#3b82f6)"></span></div>${renderArenaQuizKart(player,'w-9','',won)}</div>`; }).join('')}</div>`;
    } else {
        const a = state.base?.A || {hp:100,shield:0}, b = state.base?.B || {hp:100,shield:0};
        body = `<div class="arena-monitor-base"><div data-arena-base-side="A" class="arena-monitor-base-card"><b class="text-[8px]">Base A · HP ${Math.round(arenaClamp(a.hp))}</b><div class="arena-monitor-progress mt-2"><span style="width:${arenaClamp(a.hp)}%;background:#22d3ee"></span></div><small class="text-[7px] text-cyan-200">Shield ${Number(a.shield||0)}</small></div><div data-arena-base-side="B" class="arena-monitor-base-card"><b class="text-[8px]">Base B · HP ${Math.round(arenaClamp(b.hp))}</b><div class="arena-monitor-progress mt-2"><span style="width:${arenaClamp(b.hp)}%;background:#fb7185"></span></div><small class="text-[7px] text-rose-200">Shield ${Number(b.shield||0)}</small></div></div>`;
    }

    return `<div data-arena-stage="${gameEscapeAttr(mode)}" data-arena-fx="eco" class="arena-monitor-stage"><img src="${background}" class="arena-monitor-bg" alt=""><div class="arena-monitor-overlay"></div><div class="arena-monitor-content"><div class="arena-monitor-title"><span>${meta.icon} ${gameEscapeHtml(meta.title)}</span><span>${arenaStatusText(state)}</span></div>${body}</div></div>`;
}

function renderGameArenaActionPanel(state) {
    if (state.status !== 'playing') return '';
    const me = getArenaMePlayer(state);
    if (!me || me.eliminated) return '';

    if (state.mode === 'battle_royale') {
        const targets = (state.players || []).filter(player => String(player.id) !== String(me.id) && !player.eliminated && Number(player.hp || 0) > 0);
        if (Number(me.energy || 0) <= 0) return '';
        return `
            <div class="rounded-2xl arena-answer-dark p-4 sm:p-5">
                <div class="flex items-center justify-between gap-3 mb-3"><div><p class="text-[10px] font-black uppercase tracking-wider text-cyan-200">Energy Pulse</p><p class="text-xs text-slate-300">Gunakan energi sampai habis; setelah itu soal isi ulang muncul lagi.</p></div><span class="px-3 py-1.5 rounded-xl bg-fuchsia-600 text-white text-xs font-black">⚡ ${Number(me.energy || 0)}</span></div>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    ${targets.map(target => `<button type="button" onclick="submitGameArenaAction('energy_pulse', ${gameInlineArg(target.id)})" class="px-3 py-3 rounded-xl arena-action-tile hover:border-fuchsia-300 text-[10px] font-black transition cursor-pointer">✨ ${gameEscapeHtml(target.name)} · Shield ${Number(target.hp || 0)}</button>`).join('')}
                </div>
                <div id="game-arena-action-feedback" class="min-h-5 mt-2 text-center text-[10px] font-black text-cyan-200"></div>
            </div>`;
    }

    if (state.mode === 'base_battle') {
        const mana = Number(me.mana || 0);
        const btn = (action, cost, icon, label, desc) => `<button type="button" onclick="submitGameArenaAction('${action}')" ${mana < cost ? 'disabled' : ''} class="rounded-xl arena-action-tile p-3 text-left transition ${mana >= cost ? 'hover:border-emerald-300 cursor-pointer' : 'cursor-not-allowed'}"><div class="flex items-center justify-between"><span class="text-lg">${icon}</span><span class="text-[9px] font-black text-cyan-200">${cost} Mana</span></div><p class="mt-1 text-[11px] font-black">${label}</p><p class="text-[9px] text-slate-300">${desc}</p></button>`;
        return `
            <div class="rounded-2xl arena-answer-dark p-4 sm:p-5">
                <div class="flex items-center justify-between gap-3 mb-3"><div><p class="text-[10px] font-black uppercase tracking-wider text-cyan-200">Mana Anda</p><p class="text-xs text-slate-300">Tim ${gameEscapeHtml(me.side)} · pilih aksi untuk base battle.</p></div><span class="px-3 py-1.5 rounded-xl bg-violet-700 text-white text-xs font-black">🔮 ${mana}/100</span></div>
                <div class="grid grid-cols-3 gap-2">
                    ${btn('base_attack', 20, '✨', 'Attack', 'Kurangi pertahanan base lawan')}
                    ${btn('base_shield', 15, '🛡️', 'Shield', 'Tambah shield base tim')}
                    ${btn('base_repair', 25, '🔧', 'Repair', 'Pulihkan HP base tim')}
                </div>
                <div id="game-arena-action-feedback" class="min-h-5 mt-2 text-center text-[10px] font-black text-cyan-200"></div>
            </div>`;
    }

    return '';
}

function renderGameArenaFinishedPanel(state) {
    const me = getArenaMePlayer(state);
    const individual = state.mode === 'battle_royale' || state.mode === 'quiz_race';
    const won = individual
        ? String(state.winnerPlayerId || '') === String(state.me?.id || '')
        : Boolean(state.me?.side && state.winnerSide === state.me.side);
    const winnerPlayer = individual ? (state.players || []).find(player => String(player.id) === String(state.winnerPlayerId || '')) : null;
    const detail = individual
        ? (winnerPlayer ? `${gameEscapeHtml(winnerPlayer.name)} menyelesaikan ronde di posisi pertama.` : 'Ronde selesai tanpa pemenang aktif.')
        : (state.winnerSide ? `Tim ${gameEscapeHtml(state.winnerSide)} memenangkan ronde.` : 'Ronde selesai.');
    return `
        <div class="rounded-3xl ${won ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'} border p-6 text-center space-y-3">
            <div class="text-4xl">${won ? '🏆' : '🎮'}</div>
            <h3 class="font-black text-xl ${won ? 'text-emerald-800' : 'text-slate-800'}">${won ? 'Kamu memenangkan ronde!' : 'Ronde selesai.'}</h3>
            <p class="text-xs text-slate-500">${detail}</p>
            <button type="button" onclick="rematchGameArena()" class="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl text-xs font-black cursor-pointer"><i class="fa-solid fa-rotate-right mr-1"></i> Cari Ronde Baru</button>
        </div>`;
}

function renderGameArenaQuestionPanel(state, preservedDraft = '') {
    if (state.status === 'waiting') return `<div class="rounded-3xl bg-amber-50 border border-amber-200 p-6 text-center"><div class="text-3xl mb-2 animate-pulse">⏳</div><h3 class="font-black text-amber-900">Menunggu pemain lain dari ${gameEscapeHtml(state.className || 'kelasmu')}...</h3><p class="text-xs text-amber-700 mt-1">Pertandingan otomatis aktif setelah minimal dua siswa bergabung.</p></div>`;
    if (state.status === 'finished') return renderGameArenaFinishedPanel(state);

    const me = getArenaMePlayer(state);
    if (me?.eliminated) {
        return `<div class="rounded-3xl bg-slate-100 border border-slate-200 p-5 text-center"><div class="text-3xl">👀</div><h3 class="font-black text-slate-800 mt-2">Mode Penonton</h3><p class="text-xs text-slate-500 mt-1">Shield-mu sudah habis. Kamu tetap bisa melihat ronde sampai selesai.</p></div>`;
    }

    if (state.mode === 'battle_royale' && Number(me?.energy || 0) > 0) {
        return `<div class="rounded-3xl bg-violet-50 border border-violet-200 p-5 text-center"><p class="text-xs font-black text-violet-800">Energi masih tersedia. Gunakan Energy Pulse di atas sampai energi 0, lalu soal isi ulang berikutnya akan muncul.</p></div>`;
    }

    const question = state.question;
    if (!question) return `<div class="rounded-3xl bg-rose-50 border border-rose-200 p-6 text-center"><h3 class="font-black text-rose-800">Belum ada soal kompatibel.</h3><p class="text-xs text-rose-600 mt-1">Minta guru menyiapkan game Tebak Kata, Tebak Gambar, Susun Kata, atau Benar/Salah.</p></div>`;

    const rechargeLabel = state.mode === 'quiz_race'
        ? 'Boost Pengetahuan'
        : state.mode === 'base_battle'
            ? 'Isi Mana'
            : state.mode === 'battle_royale'
                ? 'Isi Energi'
                : 'Recharge Knowledge';

    return `
        <div data-arena-question-panel class="arena-question-panel rounded-2xl arena-answer-dark p-5 sm:p-6 space-y-4">
            <div class="flex items-center justify-between gap-3"><span class="px-3 py-1 rounded-lg bg-cyan-500/15 border border-cyan-300/30 text-cyan-100 text-[10px] font-black uppercase tracking-wider"><i class="fa-solid fa-battery-three-quarters mr-1"></i> ${rechargeLabel}</span><span class="text-[10px] font-bold text-slate-300">${gameEscapeHtml(question.title || 'Tantangan')}</span></div>
            ${question.imageUrl ? `<img src="${gameSafeImageSrc(question.imageUrl)}" class="w-full max-h-44 object-cover rounded-2xl border border-slate-200">` : ''}
            <p class="text-sm sm:text-base font-black text-white leading-relaxed">${gameEscapeHtml(question.prompt || '')}</p>
            ${Array.isArray(question.scrambledLetters) && question.scrambledLetters.length ? `
                <div class="flex flex-wrap items-center justify-center gap-2 rounded-2xl bg-violet-50 border border-violet-200 p-3">
                    <span class="w-full text-center text-[10px] font-black uppercase tracking-wider text-violet-700">Susun huruf berikut</span>
                    ${question.scrambledLetters.map(letter => `<span class="w-9 h-10 rounded-xl bg-white border border-violet-200 shadow-sm flex items-center justify-center text-base font-black text-violet-900">${gameEscapeHtml(letter)}</span>`).join('')}
                </div>
            ` : ''}
            ${question.type === 'choice' ? `<div class="grid grid-cols-2 gap-2">${(question.options || []).map((option,index) => `<button type="button" onclick="submitGameArenaAnswer(${gameInlineArg(option)})" class="px-4 py-3 rounded-xl arena-answer-option text-left text-xs font-black transition cursor-pointer"><span class="inline-flex w-5 h-5 mr-2 items-center justify-center rounded-md bg-white/10">${String.fromCharCode(65+index)}</span>${gameEscapeHtml(option)}</button>`).join('')}</div>` : `<form onsubmit="submitGameArenaTextAnswer(event)" class="flex flex-col sm:flex-row gap-2"><input id="game-arena-answer-input" value="${gameEscapeAttr(preservedDraft)}" autocomplete="off" placeholder="Ketik jawaban..." class="flex-1 px-4 py-3 rounded-xl bg-slate-950/70 border border-cyan-300/30 text-white text-sm font-black uppercase focus:outline-none focus:ring-2 focus:ring-cyan-300"><button type="submit" class="px-5 py-3 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-black cursor-pointer"><i class="fa-solid fa-bolt mr-1"></i> Kirim</button></form>`}
            <div id="game-arena-answer-feedback" class="min-h-5 text-center text-[11px] font-black text-cyan-100"></div>
        </div>`;
}

function renderGameArenaModalState(state) {
    const modal=document.getElementById('game-arena-modal');if(!modal||!state)return;ensureGameArenaReferenceStyles();
    const draft=document.getElementById('game-arena-answer-input')?.value||'';const body=modal.querySelector('[data-arena-body]');if(!body)return;
    body.innerHTML=`<div class="arena-ref-shell"><div class="arena-ref-wrap">${renderGameArenaStage(state)}<div class="arena-ref-bottom">${renderGameArenaActionPanel(state)}${renderGameArenaQuestionPanel(state,draft)}</div></div></div>`;
    const status=modal.querySelector('[data-arena-status]');if(status)status.textContent=state.status==='waiting'?'LOBBY':state.status==='finished'?'SELESAI':'● LIVE';
}

function mountGameArenaModal(mode) {
    document.getElementById('game-arena-modal')?.remove();
    const meta = getGameArenaModeMeta(mode);
    document.body.insertAdjacentHTML('beforeend', `
        <div id="game-arena-modal" class="fixed inset-0 z-[100] bg-slate-950/85 backdrop-blur-md p-2 sm:p-4 flex items-center justify-center">
            <div class="w-full max-w-5xl max-h-[96vh] overflow-y-auto rounded-[28px] bg-slate-100 border border-white/10 shadow-2xl">
                <div class="sticky top-0 z-20 bg-slate-950 text-white px-4 sm:px-6 py-4 flex items-center justify-between border-b border-slate-800">
                    <div>
                        <div class="flex items-center gap-2"><h2 class="font-black text-lg">${meta.icon} ${gameEscapeHtml(meta.title)}</h2><span data-arena-status class="px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-[9px] font-black uppercase">Menghubungkan</span></div>
                        <p class="text-[10px] text-slate-400 mt-0.5">Soal → resource → gameplay</p>
                    </div>
                    <div class="flex items-center gap-2">
                        ${renderGameArenaFxControl()}
                        <button type="button" onclick="closeGameArena()" class="w-10 h-10 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer"><i class="fa-solid fa-xmark"></i></button>
                    </div>
                </div>
                <div data-arena-body class="p-4 sm:p-6"><div class="py-16 text-center text-slate-500"><i class="fa-solid fa-circle-notch fa-spin text-3xl text-indigo-500"></i><p class="text-xs font-bold mt-3">Menyiapkan arena...</p></div></div>
            </div>
        </div>`);
}

window.openGameArenaMode = async function(mode) {
    if (!GAME_ARENA_MODE_META.some(item => item.id === mode)) return;
    if (activeArenaSession?.roomId) await window.closeGameArena(false);
    mountGameArenaModal(mode);
    activeArenaSession = { mode, roomId: '', state: null, submitting: false, actionPending: false, lastVersion: -1 };
    try {
        const res = await fetch('/api/game-arena/join', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode }) });
        const data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.message || 'Gagal masuk Arena.');
        activeArenaSession.roomId = data.state?.id || '';
        activeArenaSession.state = data.state;
        activeArenaSession.lastVersion = Number(data.state?.version ?? -1);
        renderGameArenaModalState(data.state);
        if (activeArenaPollTimer) clearInterval(activeArenaPollTimer);
        activeArenaPollTimer = setInterval(window.pollGameArenaState, 1200);
    } catch (err) {
        const body = document.querySelector('#game-arena-modal [data-arena-body]');
        if (body) body.innerHTML = `<div class="py-12 px-4 text-center"><div class="text-4xl mb-3">🛠️</div><h3 class="font-black text-slate-800">Arena belum bisa dimulai</h3><p class="text-xs text-slate-500 mt-2 max-w-lg mx-auto">${gameEscapeHtml(err?.message || 'Terjadi kesalahan saat masuk Arena.')}</p></div>`;
    }
};

window.pollGameArenaState = async function() {
    if (!activeArenaSession?.roomId) return;
    try {
        const res = await fetch(`/api/game-arena/state?roomId=${encodeURIComponent(activeArenaSession.roomId)}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok || !data.success) {
            if (res.status === 404) await window.closeGameArena(false);
            return;
        }
        const previousState = activeArenaSession.state;
        activeArenaSession.state = data.state;
        const nextVersion = Number(data.state?.version ?? -1);
        if (nextVersion !== activeArenaSession.lastVersion) {
            activeArenaSession.lastVersion = nextVersion;
            renderGameArenaModalState(data.state);
            requestAnimationFrame(() => playGameArenaStateDeltaFx(previousState, data.state, document.getElementById('game-arena-modal')));
        }
    } catch (_) {}
};

window.submitGameArenaTextAnswer = function(event) {
    event?.preventDefault?.();
    const input = document.getElementById('game-arena-answer-input');
    const answer = String(input?.value || '').trim();
    if (answer) window.submitGameArenaAnswer(answer);
};

window.submitGameArenaAnswer = async function(answer) {
    if (!activeArenaSession?.roomId || activeArenaSession.submitting || activeArenaSession.actionPending) return;
    const question = activeArenaSession.state?.question;
    if (!question?.id) return;
    activeArenaSession.submitting = true;
    const feedback = document.getElementById('game-arena-answer-feedback');
    if (feedback) { feedback.className = 'min-h-5 text-center text-[11px] font-black text-indigo-600'; feedback.textContent = 'Memeriksa jawaban...'; }
    try {
        const res = await fetch('/api/game-arena/answer', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId: activeArenaSession.roomId, questionId: question.id, submittedAnswer: String(answer || '') }) });
        const data = await res.json();
        if (!res.ok || !data.success) {
            if (data.state) {
                activeArenaSession.state = data.state;
                activeArenaSession.lastVersion = Number(data.state?.version ?? -1);
                renderGameArenaModalState(data.state);
            }
            throw new Error(data.message || 'Jawaban tidak dapat diproses.');
        }
        const previousState = activeArenaSession.state;
        activeArenaSession.state = data.state;
        activeArenaSession.lastVersion = Number(data.state?.version ?? -1);
        renderGameArenaModalState(data.state);
        requestAnimationFrame(() => playGameArenaAnswerFx(previousState, data.state, Boolean(data.isCorrect), document.getElementById('game-arena-modal')));
        const nextFeedback = document.getElementById('game-arena-answer-feedback');
        if (nextFeedback && data.state?.status === 'playing') {
            nextFeedback.className = `min-h-5 text-center text-[11px] font-black ${data.isCorrect ? 'text-emerald-600' : 'text-rose-600'}`;
            nextFeedback.textContent = data.eventText || (data.isCorrect ? `Benar! +${Number(data.gain || 0)}` : 'Belum tepat.');
        }
        if (!nextFeedback && data.eventText) showToast(data.eventText, data.isCorrect ? 'success' : 'info');
    } catch (err) {
        const currentFeedback = document.getElementById('game-arena-answer-feedback');
        if (currentFeedback) { currentFeedback.className = 'min-h-5 text-center text-[11px] font-black text-rose-600'; currentFeedback.textContent = err?.message || 'Gagal mengirim jawaban.'; }
        else showToast(err?.message || 'Gagal mengirim jawaban Arena.', 'error');
    } finally {
        if (activeArenaSession) activeArenaSession.submitting = false;
    }
};

window.submitGameArenaAction = async function(action, targetId = '') {
    if (!activeArenaSession?.roomId || activeArenaSession.actionPending || activeArenaSession.submitting) return;
    activeArenaSession.actionPending = true;
    const feedback = document.getElementById('game-arena-action-feedback');
    if (feedback) feedback.textContent = 'Memproses aksi...';
    try {
        const res = await fetch('/api/game-arena/action', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ roomId: activeArenaSession.roomId, action, targetId })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            if (data.state) {
                activeArenaSession.state = data.state;
                activeArenaSession.lastVersion = Number(data.state?.version ?? -1);
                renderGameArenaModalState(data.state);
            }
            throw new Error(data.message || 'Aksi tidak dapat diproses.');
        }
        const previousState = activeArenaSession.state;
        activeArenaSession.state = data.state;
        activeArenaSession.lastVersion = Number(data.state?.version ?? -1);
        renderGameArenaModalState(data.state);
        requestAnimationFrame(() => playGameArenaActionFx(previousState, data.state, action, targetId, document.getElementById('game-arena-modal')));
        const nextFeedback = document.getElementById('game-arena-action-feedback');
        if (nextFeedback) nextFeedback.textContent = data.eventText || 'Aksi berhasil.';
        else if (data.eventText && data.state?.status === 'playing') showToast(data.eventText, 'success');
    } catch (err) {
        const currentFeedback = document.getElementById('game-arena-action-feedback');
        if (currentFeedback) currentFeedback.textContent = err?.message || 'Aksi gagal.';
        else showToast(err?.message || 'Aksi Arena gagal.', 'error');
    } finally {
        if (activeArenaSession) activeArenaSession.actionPending = false;
    }
};

window.closeGameArena = async function(removeModal = true) {
    if (activeArenaPollTimer) { clearInterval(activeArenaPollTimer); activeArenaPollTimer = null; }
    const roomId = activeArenaSession?.roomId;
    activeArenaSession = null;
    if (roomId) {
        try { await fetch('/api/game-arena/leave', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ roomId }) }); } catch (_) {}
    }
    if (removeModal) document.getElementById('game-arena-modal')?.remove();
};

window.rematchGameArena = async function() {
    const mode = activeArenaSession?.mode;
    if (!mode) return;
    await window.closeGameArena(true);
    await window.openGameArenaMode(mode);
};

function renderStudentKatalogTab(games) {
    const activeGames = games.filter(g => g.status === 'active');
    const catProg = getStudentProgressForMode('CATALOG');
    const completedCatalog = catProg.completedCatalogGames || [];

    return `
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 animate-fade-in">
            ${activeGames.map(g => {
                const typeInfo = GAME_TYPES.find(t => t.id === g.gameType) || { name: g.gameType, icon: 'fa-gamepad' };
                const isDone = completedCatalog.includes(g.id);

                return `
                    <div class="bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 p-6 flex flex-col justify-between space-y-4 group">
                        <div class="space-y-3">
                            <div class="flex items-center justify-between">
                                <span class="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                                    <i class="fa-solid ${typeInfo.icon}"></i> ${typeInfo.name}
                                </span>
                                ${isDone ? '<span class="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 rounded-full text-[10px] font-black uppercase">🏆 Quest Selesai</span>' : '<span class="px-2.5 py-0.5 bg-slate-100 text-slate-600 rounded-full text-[10px] font-bold uppercase">Belum Selesai</span>'}
                            </div>

                            <h3 class="font-extrabold text-lg text-slate-850 group-hover:text-indigo-600 transition leading-snug">${gameEscapeHtml(g.title)}</h3>
                            <p class="text-xs text-slate-500 line-clamp-2">${gameEscapeHtml(g.prompt || 'Selesaikan permainan ini untuk menguji pengetahuanmu.')}</p>
                        </div>

                        <div class="pt-4 border-t border-slate-100 flex items-center justify-between">
                            <div class="text-xs font-bold text-amber-600 flex items-center gap-1">
                                <i class="fa-solid fa-star"></i> +${g.rewardXp || 100} XP
                            </div>
                            <button type="button" onclick="launchInteractiveGameModal('${g.id}')" class="px-5 py-2.5 ${isDone ? 'bg-slate-900 hover:bg-slate-800 text-white' : 'bg-indigo-600 hover:bg-indigo-700 text-white'} active:scale-95 font-extrabold text-xs rounded-2xl shadow-md transition flex items-center gap-2 cursor-pointer">
                                <span>${isDone ? 'Main Lagi' : 'Mainkan'}</span> <i class="fa-solid fa-play text-xs"></i>
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

function renderStudentAdventureTab(games) {
    const activeModes = getGameModes().filter(m => m.modeType === 'adventure' && m.status !== 'inactive');
    if (activeModes.length === 0) {
        return `
            <div class="bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-3">
                <div class="text-4xl">🗺️</div>
                <h3 class="font-extrabold text-slate-800 text-lg">Belum Ada Mode Adventure Aktif</h3>
                <p class="text-xs text-slate-500">Mode Petualangan sedang dinonaktifkan oleh guru. Silakan periksa tab Katalog Game.</p>
            </div>
        `;
    }

    const selectedModeId = window.__studentActiveAdventureModeId || activeModes[0].id;
    const mode = activeModes.find(m => m.id === selectedModeId) || activeModes[0];

    const progressObj = getStudentProgressForMode(mode.id);
    const completedLocs = progressObj.completedLocations || [];

    const locations = Array.isArray(mode.locations) ? mode.locations : [];
    const allCompleted = locations.length > 0 && locations.every(l => completedLocs.includes(l.id));

    return `
        <div class="space-y-6 animate-fade-in">
            <!-- Mode Selector & Header -->
            <div class="bg-gradient-to-br from-amber-900 via-amber-800 to-yellow-900 rounded-3xl p-6 sm:p-8 text-amber-100 shadow-xl border-2 border-amber-500/40 relative overflow-hidden">
                <div class="absolute -right-8 -bottom-8 text-8xl opacity-10 pointer-events-none">🏴‍☠️</div>
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                    <div>
                        <div class="flex items-center gap-2 mb-2">
                            <span class="px-3 py-1 bg-amber-500 text-slate-950 text-[10px] font-black uppercase rounded-full tracking-wider shadow">
                                🗺️ Mode Peta Harta Karun (Adventure)
                            </span>
                            <span class="text-xs text-amber-200 font-bold bg-amber-950/60 px-3 py-1 rounded-full border border-amber-600/30">
                                Target: ${mode.classId || 'Semua Kelas'}
                            </span>
                        </div>
                        <h2 class="text-2xl sm:text-3xl font-black text-white leading-tight">${gameEscapeHtml(mode.title)}</h2>
                        <p class="text-xs text-amber-100 max-w-xl mt-1">${gameEscapeHtml(mode.description || 'Klik titik lokasi pada peta harta karun untuk menaklukkan tantangan!')}</p>
                    </div>

                    ${activeModes.length > 1 ? `
                        <div class="bg-amber-950/80 p-3 rounded-2xl border border-amber-600/50 space-y-1 shrink-0 w-full sm:w-auto">
                            <label class="block text-[10px] font-extrabold text-amber-300 uppercase">Pilih Peta Petualangan:</label>
                            <select onchange="window.__studentActiveAdventureModeId=this.value; renderGameStudentModule(document.getElementById('view-container'));" class="w-full px-3 py-1.5 bg-amber-900 text-white font-bold text-xs rounded-xl border border-amber-600 focus:outline-none cursor-pointer">
                                ${activeModes.map(m => `<option value="${m.id}" ${m.id === mode.id ? 'selected' : ''}>${gameEscapeHtml(m.title)}</option>`).join('')}
                            </select>
                        </div>
                    ` : ''}
                </div>
            </div>

            ${allCompleted ? `
                <div class="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-3xl p-6 text-white text-center shadow-lg animate-bounce">
                    <div class="text-4xl mb-2">🎉🏆</div>
                    <h3 class="text-xl font-black">Selamat! Seluruh Peta Petualangan Telah Ditaklukkan!</h3>
                    <p class="text-xs text-emerald-100 mt-1">Kamu telah menyelesaikan semua tantangan lokasi pada peta ini. Raih peringkat tertinggi di Leaderboard!</p>
                </div>
            ` : ''}

            <!-- VISUAL TREASURE MAP VIEW (AUTHENTIC PIRATE MAP) -->
            <div class="space-y-4">
                <div class="flex items-center justify-between px-1">
                    <div class="flex items-center gap-2">
                        <span class="w-3 h-3 rounded-full bg-amber-500 animate-ping"></span>
                        <span class="text-xs font-black text-amber-950 uppercase tracking-wider">
                            Peta Eksplorasi Interaktif:
                        </span>
                    </div>
                    <span class="text-xs font-bold text-slate-500">
                        Progres: <strong class="text-amber-700">${completedLocs.length} / ${locations.length} Selesai</strong>
                    </span>
                </div>

                ${renderTreasureMapComponent(mode, { isEditable: false, isPreview: false, completedLocations: completedLocs })}
            </div>
        </div>
    `;
}

function renderStudentTowerTab(games, forceModeId = null, isPreview = false) {
    const allTowerModes = getGameModes().filter(m => m.modeType === 'tower');
    const modes = isPreview ? allTowerModes : allTowerModes.filter(m => m.status !== 'inactive');
    
    if (modes.length === 0) {
        return `
            <div class="bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-3">
                <div class="text-4xl">🏰</div>
                <h3 class="font-extrabold text-slate-800 text-lg">Belum Ada Quest Menara Aktif</h3>
                <p class="text-xs text-slate-500">Mode Quest Tower sedang dinonaktifkan oleh guru. Silakan periksa tab Katalog Game.</p>
            </div>
        `;
    }

    const selectedModeId = forceModeId || window.__studentActiveTowerModeId || modes[0].id;
    const mode = modes.find(m => m.id === selectedModeId) || modes[0];

    const progressObj = getStudentProgressForMode(mode.id);
    const completedFloors = progressObj.completedFloors || [];

    const floors = Array.isArray(mode.floors) ? mode.floors : [];
    const allCompleted = floors.length > 0 && floors.every(f => completedFloors.includes(f.id));

    return `
        <div class="space-y-6 animate-fade-in">
            <!-- Header Banner -->
            <div class="bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl border-2 border-indigo-500/40 relative overflow-hidden">
                <div class="absolute -right-8 -bottom-8 text-8xl opacity-10 pointer-events-none">🏰</div>
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                    <div>
                        <div class="flex items-center gap-2 mb-2">
                            <span class="px-3 py-1 bg-indigo-600 text-white text-[10px] font-black uppercase rounded-full tracking-wider shadow">
                                🏰 Mode Quest Menara (Tower System)
                            </span>
                            <span class="text-xs text-indigo-300 font-bold bg-indigo-950/80 px-3 py-1 rounded-full border border-indigo-800">
                                Target: ${mode.classId || 'Semua Kelas'}
                            </span>
                        </div>
                        <h2 class="text-2xl sm:text-3xl font-black text-white leading-tight">${gameEscapeHtml(mode.title)}</h2>
                        <p class="text-xs text-indigo-200 max-w-xl mt-1">${gameEscapeHtml(mode.description || 'Panjat lantai demi lantai menara quest!')}</p>
                    </div>

                    ${modes.length > 1 && !forceModeId ? `
                        <div class="bg-indigo-950/80 p-3 rounded-2xl border border-indigo-800 space-y-1 shrink-0 w-full sm:w-auto">
                            <label class="block text-[10px] font-extrabold text-indigo-300 uppercase">Pilih Menara Quest:</label>
                            <select onchange="window.__studentActiveTowerModeId=this.value; renderGameStudentModule(document.getElementById('view-container'));" class="w-full px-3 py-1.5 bg-slate-900 text-white font-bold text-xs rounded-xl border border-indigo-700 focus:outline-none cursor-pointer">
                                ${modes.map(m => `<option value="${m.id}" ${m.id === mode.id ? 'selected' : ''}>${gameEscapeHtml(m.title)}</option>`).join('')}
                            </select>
                        </div>
                    ` : ''}
                </div>
            </div>

            ${allCompleted ? `
                <div class="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 rounded-3xl p-6 text-slate-950 text-center shadow-lg animate-bounce">
                    <div class="text-4xl mb-2">👑🏆</div>
                    <h3 class="text-xl font-black">Selamat! Puncak Menara Berhasil Ditaklukkan!</h3>
                    <p class="text-xs font-bold text-slate-900 mt-1">Kamu meraih gelar Master Menara Quest! Terus tingkatkan skor XP kamu.</p>
                </div>
            ` : ''}

            <!-- TOWER VERTICAL STRUCTURE -->
            <div class="bg-slate-900/90 rounded-3xl p-6 sm:p-8 border border-indigo-800 shadow-2xl relative space-y-6">
                <!-- Crown Peak -->
                <div class="bg-gradient-to-r from-amber-500/20 via-yellow-500/30 to-amber-500/20 p-4 rounded-2xl border border-amber-500/40 text-center space-y-1">
                    <span class="text-2xl">👑</span>
                    <h3 class="text-sm font-black text-amber-300 uppercase tracking-widest">Puncak Menara Master TIK</h3>
                    <p class="text-[11px] text-slate-300">Taklukkan semua lantai dari bawah untuk meraih tahta puncak!</p>
                </div>

                <div class="max-w-2xl mx-auto space-y-4">
                    ${floors.length === 0 ? `
                        <div class="p-8 text-center text-slate-400 text-xs">
                            Belum ada lantai menara yang dikonfigurasi oleh guru.
                        </div>
                    ` : [...floors].reverse().map((flr, revIdx) => {
                        const actualIdx = floors.length - 1 - revIdx;
                        const isUnlocked = actualIdx === 0 || completedFloors.includes(floors[actualIdx - 1]?.id);
                        const isDone = completedFloors.includes(flr.id);
                        const assignedGame = games.find(g => g.id === flr.gameId) || { id: games[0]?.id || 'GAME_SEED_1', title: 'Tantangan Lantai', rewardXp: 100 };
                        const floorBgStyle = getTowerFloorBgStyle(flr, actualIdx, floors.length);

                        return `
                            <div class="p-5 rounded-2xl border-2 ${
                                isDone ? 'border-emerald-500/80 ring-2 ring-emerald-500/20' :
                                isUnlocked ? 'border-amber-400 shadow-xl ring-2 ring-amber-400/40' :
                                'border-slate-800/80 opacity-60'
                            } transition duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden" style="background: ${floorBgStyle};">
                                
                                <div class="flex items-center space-x-4 z-10">
                                    <div class="w-12 h-12 rounded-2xl ${
                                        isDone ? 'bg-emerald-600 text-white font-black' :
                                        isUnlocked ? 'bg-amber-500 text-slate-950 font-black shadow-lg shadow-amber-500/30' : 'bg-slate-800 text-slate-500'
                                    } flex items-center justify-center text-base shadow-md shrink-0 border border-white/20">
                                        L${actualIdx + 1}
                                    </div>

                                    <div>
                                        <div class="flex items-center gap-2 flex-wrap">
                                            <span class="px-2.5 py-0.5 bg-slate-950/80 text-amber-400 font-extrabold text-[10px] rounded-full uppercase border border-amber-500/30 backdrop-blur-xs">
                                                Lantai #${actualIdx + 1}
                                            </span>
                                            ${isDone ? '<span class="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 px-2 py-0.5 rounded-full border border-emerald-700">✓ Ditaklukkan</span>' : ''}
                                            ${!isUnlocked ? '<span class="text-[10px] font-bold text-slate-400 bg-slate-950/80 px-2 py-0.5 rounded-full border border-slate-700">🔒 Terkunci</span>' : ''}
                                        </div>

                                        <h4 class="font-extrabold text-white text-base mt-1 drop-shadow-md">${gameEscapeHtml(flr.name)}</h4>
                                        <p class="text-xs text-slate-200 line-clamp-1 drop-shadow-xs">${gameEscapeHtml(flr.desc || assignedGame.title)}</p>
                                    </div>
                                </div>

                                <div class="w-full sm:w-auto text-right shrink-0 z-10">
                                    ${isUnlocked ? `
                                        <button type="button" onclick="launchInteractiveGameModal('${assignedGame.id}', ${isPreview}, { modeId: '${mode.id}', floorId: '${flr.id}', floorName: decodeURIComponent('${encodeURIComponent(flr.name || '')}'), floorBg: decodeURIComponent('${encodeURIComponent(floorBgStyle || '')}') })" class="w-full sm:w-auto px-6 py-2.5 ${isDone ? 'bg-slate-900/80 hover:bg-slate-900 text-white border border-white/20' : 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-black shadow-lg shadow-amber-500/30'} font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center justify-center gap-2">
                                            <span>${isDone ? 'Panjat Lagi' : 'Panjat Lantai Ini'}</span>
                                            <i class="fa-solid fa-chess-rook text-xs"></i>
                                        </button>
                                    ` : `
                                        <button type="button" disabled class="w-full sm:w-auto px-5 py-2.5 bg-slate-950/70 text-slate-500 font-bold text-xs rounded-xl cursor-not-allowed border border-slate-800">
                                            <i class="fa-solid fa-lock mr-1"></i> Terkunci
                                        </button>
                                    `}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;
}

// ============================================================================
// LEADERBOARD MODAL (WITH CLASS FILTER)
// ============================================================================
window.openGameLeaderboardModal = async function() {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const classes = Array.isArray(appState.classes) ? appState.classes : [];

    modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in">
            <div class="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[85vh] overflow-hidden">
                <div class="p-6 bg-slate-900 text-white flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-amber-500 text-slate-950 rounded-2xl flex items-center justify-center text-xl font-black shadow-md">
                            🏆
                        </div>
                        <div>
                            <h3 class="font-extrabold text-base">Papan Peringkat (Leaderboard)</h3>
                            <p class="text-xs text-slate-400">Peringkat perolehan XP dan akumulasi poin game edukasi.</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="text-slate-400 hover:text-white p-2 text-lg">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Filter Per Kelas Bar -->
                <div class="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 text-xs flex-wrap">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-filter text-indigo-600"></i>
                        <span class="font-bold text-slate-700">Filter Berdasarkan Kelas:</span>
                    </div>
                    <select id="leaderboard-class-select" onchange="fetchAndRenderLeaderboard(this.value)" class="px-3.5 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-slate-800 text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none shadow-xs cursor-pointer">
                        <option value="all">🌟 Semua Kelas</option>
                        ${classes.map(c => `<option value="${c.id || c.name}">${c.name || c.className || c.id}</option>`).join('')}
                    </select>
                </div>

                <div class="p-6 overflow-y-auto space-y-4 text-xs">
                    <div id="leaderboard-table-container">
                        <div class="p-8 text-center text-slate-400 font-semibold">Memuat papan peringkat...</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    window.fetchAndRenderLeaderboard = async function(classFilter = 'all') {
        const tableContainer = document.getElementById('leaderboard-table-container');
        if (!tableContainer) return;
        tableContainer.innerHTML = `<div class="p-8 text-center text-slate-400 font-semibold"><i class="fa-solid fa-circle-notch fa-spin mr-2"></i>Memuat papan peringkat...</div>`;

        try {
            const url = classFilter && classFilter !== 'all' ? `/api/games/leaderboard?classId=${encodeURIComponent(classFilter)}` : '/api/games/leaderboard';
            const res = await fetch(url);
            const data = await res.json();
            const rankings = data.rankings || [];

            if (rankings.length === 0) {
                tableContainer.innerHTML = `<div class="p-8 text-center text-slate-400 font-semibold">Belum ada data skor game untuk kelas ini.</div>`;
                return;
            }

            tableContainer.innerHTML = `
                <div class="space-y-2">
                    ${rankings.map((r, idx) => {
                        const isTop1 = idx === 0;
                        const isTop2 = idx === 1;
                        const isTop3 = idx === 2;

                        return `
                            <div class="flex items-center justify-between p-3.5 rounded-2xl border ${
                                isTop1 ? 'bg-amber-50/90 border-amber-300 text-amber-950 shadow-sm' :
                                isTop2 ? 'bg-slate-100/90 border-slate-300 text-slate-900' :
                                isTop3 ? 'bg-amber-900/10 border-amber-800/30 text-amber-900' :
                                'bg-slate-50 border-slate-200/80 text-slate-800'
                            }">
                                <div class="flex items-center space-x-3">
                                    <div class="w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs ${
                                        isTop1 ? 'bg-amber-500 text-slate-950 shadow-md ring-2 ring-amber-300' :
                                        isTop2 ? 'bg-slate-400 text-white' :
                                        isTop3 ? 'bg-amber-700 text-white' : 'bg-slate-200 text-slate-600'
                                    }">
                                        ${idx === 0 ? '👑 1' : idx + 1}
                                    </div>
                                    <div>
                                        <h4 class="font-extrabold text-sm">${gameEscapeHtml(r.name)}</h4>
                                        <span class="text-[10px] text-slate-500 font-bold bg-white/80 px-2 py-0.5 rounded-md border border-slate-200 inline-block mt-0.5">${gameEscapeHtml(r.className || 'Siswa')} &middot; Lvl ${r.level}</span>
                                    </div>
                                </div>
                                <div class="text-right">
                                    <span class="block font-black text-amber-600 text-sm">${r.xp} XP</span>
                                    <span class="text-[10px] text-slate-400 font-semibold">🔥 ${r.dailyStreak || 1} Hari Streak</span>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        } catch (err) {
            if (tableContainer) tableContainer.innerHTML = `<div class="p-4 text-center text-rose-500">Gagal memuat papan peringkat.</div>`;
        }
    };

    fetchAndRenderLeaderboard('all');
};

// ============================================================================
// INTERACTIVE GAME PLAY LAUNCHER (CONTAINING THE 15 GAME ENGINES)
// ============================================================================
window.launchGamePlayPreview = function(gameId) {
    window.launchInteractiveGameModal(gameId, true);
};

window.launchInteractiveGameModal = function(gameId, isPreview = false, modeOptions = null) {
    if (!Array.isArray(appState.eduGames) || appState.eduGames.length === 0) {
        appState.eduGames = [...SAMPLE_SEED_GAMES];
    }
    const game = appState.eduGames.find(g => g.id === gameId);
    if (!game) {
        showToast("Game tidak ditemukan", "error");
        return;
    }

    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    activeGameSession = {
        game,
        startTime: Date.now(),
        score: 0,
        userAnswer: '',
        userInputs: [],
        isPreview,
        modeOptions: modeOptions || null
    };

    modalContainer.innerHTML = `
        <div class="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 z-50 animate-fade-in">
            <div id="active-game-window" class="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden">
                <!-- Top Game Header Bar -->
                <div class="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between gap-3">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white font-extrabold text-lg shadow-md">
                            <i class="fa-solid fa-gamepad"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-sm sm:text-base leading-snug line-clamp-1">${gameEscapeHtml(game.title)}</h3>
                            <span class="text-[10px] text-amber-400 font-bold uppercase tracking-wider mr-2">+${game.rewardXp || 100} XP</span>
                        </div>
                    </div>

                    <div class="flex items-center space-x-3">
                        <div id="game-timer-display" class="px-3 py-1.5 bg-slate-800 text-amber-300 border border-slate-700 rounded-xl text-xs font-black flex items-center gap-1.5">
                            <i class="fa-solid fa-clock"></i> <span id="game-timer-seconds">${game.timeLimit || 120}s</span>
                        </div>
                        <button type="button" onclick="closeActiveGameSession()" class="text-slate-400 hover:text-white p-2 text-lg cursor-pointer">
                            <i class="fa-solid fa-xmark"></i>
                        </button>
                    </div>
                </div>

                <!-- Main Interactive Game View Body -->
                <div id="game-session-body" class="p-6 overflow-y-auto flex-1 flex flex-col items-center justify-center space-y-6 text-center">
                    <!-- Engine dynamically loaded -->
                </div>
            </div>
        </div>
    `;

    // Start Timer Countdown
    let timeLeft = game.timeLimit || 120;
    if (activeGameTimer) clearInterval(activeGameTimer);

    activeGameTimer = setInterval(() => {
        timeLeft--;
        const timerEl = document.getElementById('game-timer-seconds');
        if (timerEl) timerEl.innerText = `${timeLeft}s`;

        if (timeLeft <= 0) {
            clearInterval(activeGameTimer);
            showToast("Waktu habis!", "warning");
            submitGameSessionAnswer();
        }
    }, 1000);

    // Render Game Specific Engine UI
    renderGameEngineUI(game);
};

window.closeActiveGameSession = function() {
    if (activeGameTimer) clearInterval(activeGameTimer);
    activeGameSession = null;
    document.getElementById('modal-container').innerHTML = '';
};

// ============================================================================
// GAME ENGINES RENDERER (ALL 15 INTERACTIVE GAME MODES)
// ============================================================================
function renderGameEngineUI(game) {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const gameType = game.gameType || 'tebak_kata';

    // ENGINE 1: TEBAK KATA / SIAPA AKU / LENGKAPI KATA
    if (gameType === 'tebak_gambar') {
        renderTebakGambarEngineUI(game);
        return;
    }
    if (gameType === 'tebak_kata') {
        const previewKeyLength = String(game.answerKey || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').length;
        const answerLength = Math.max(1, parseInt(game.answerLength, 10) || previewKeyLength || 8);

        container.innerHTML = `
            <div class="space-y-4 max-w-lg mx-auto w-full animate-fade-in">
                <!-- Prompt Card -->
                <div class="bg-emerald-50/90 p-5 rounded-2xl border border-emerald-200 space-y-2 text-center">
                    <span class="text-[10px] font-extrabold text-emerald-800 uppercase tracking-wider bg-emerald-200/70 px-3 py-1 rounded-full inline-block">
                        <i class="fa-solid fa-lightbulb mr-1"></i> Soal Tantangan
                    </span>
                    <p class="text-sm font-extrabold text-slate-800 leading-relaxed">${gameEscapeHtml(game.prompt || 'Selesaikan kata yang tepat.')}</p>
                    ${game.imageUrl ? `<img src="${gameSafeImageSrc(game.imageUrl)}" class="w-52 h-36 object-cover rounded-2xl border-2 border-emerald-300 mx-auto mt-3 shadow-sm">` : ''}
                    
                    ${game.hints && game.hints.length > 0 ? `
                        <div class="pt-2">
                            <button type="button" onclick="document.getElementById('hint-box-display').classList.toggle('hidden')" class="text-[11px] font-bold text-amber-700 hover:underline inline-flex items-center gap-1 cursor-pointer">
                                <i class="fa-solid fa-key text-amber-500"></i> Lihat Clue / Petunjuk
                            </button>
                            <div id="hint-box-display" class="hidden mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 font-semibold text-center">
                                ${gameEscapeHtml(game.hints.join(' • '))}
                            </div>
                        </div>
                    ` : ''}
                </div>

                <!-- Letter Boxes Array -->
                <div class="flex items-center justify-center gap-1.5 sm:gap-2 my-5 flex-wrap" id="letter-boxes-wrapper">
                    ${Array.from({ length: answerLength }).map((_, idx) => `
                        <div id="letter-box-${idx}" class="w-10 h-12 sm:w-12 sm:h-14 bg-white border-2 border-slate-300 rounded-2xl flex items-center justify-center text-xl sm:text-2xl font-black text-slate-800 shadow-xs transition-all duration-200">
                        </div>
                    `).join('')}
                </div>

                <!-- Direct Input Box (Alternative option) -->
                <div class="max-w-xs mx-auto">
                    <input type="text" id="direct-letter-input" oninput="syncDirectInputToBoxes(this.value)" placeholder="Atau ketik di sini..." class="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs font-bold uppercase focus:bg-white focus:ring-2 focus:ring-emerald-500">
                </div>

                <!-- Action Controls -->
                <div class="flex items-center justify-center gap-2 pt-1">
                    <button type="button" onclick="clearLetterBoxesInput()" class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer">
                        <i class="fa-solid fa-rotate-left mr-1"></i> Reset
                    </button>
                    <button type="button" onclick="backspaceLetterBoxInput()" class="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer">
                        <i class="fa-solid fa-delete-left mr-1"></i> Hapus
                    </button>
                    <button type="button" onclick="submitGameSessionAnswer()" class="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-md shadow-emerald-600/20 transition cursor-pointer">
                        🚀 Submit
                    </button>
                </div>

                <!-- On-Screen Virtual Keyboard -->
                <div class="pt-3 grid grid-cols-10 gap-1 sm:gap-1.5 max-w-md mx-auto">
                    ${['Q','W','E','R','T','Y','U','I','O','P','A','S','D','F','G','H','J','K','L','Z','X','C','V','B','N','M'].map(key => `
                        <button type="button" onclick="appendLetterBoxInput('${key}')" class="py-2.5 bg-slate-100 hover:bg-emerald-600 hover:text-white font-black text-xs sm:text-sm rounded-lg border border-slate-200 transition cursor-pointer active:scale-95">
                            ${key}
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        window.onkeydown = function(e) {
            if (!e || !e.key) return;
            const key = String(e.key).toUpperCase();
            if (key >= 'A' && key <= 'Z' && key.length === 1) {
                appendLetterBoxInput(key);
            } else if (e.key === 'Backspace') {
                backspaceLetterBoxInput();
            } else if (e.key === 'Enter') {
                submitGameSessionAnswer();
            }
        };
    }
    // ENGINE 2: SUSUN KATA (ANAGRAM)
    else if (gameType === 'susun_kata') {
        const serverScramble = Array.isArray(game.scrambledLetters)
            ? game.scrambledLetters.map(ch => String(ch || '').toUpperCase().replace(/[^A-Z0-9]/g, '')).filter(Boolean)
            : [];
        const previewKey = String(game.answerKey || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        const letters = serverScramble.length ? serverScramble : previewKey.split('');
        const scrambled = serverScramble.length ? [...serverScramble] : [...letters].sort(() => 0.5 - Math.random());

        activeGameSession.scrambledPool = scrambled;
        activeGameSession.selectedTiles = [];

        container.innerHTML = `
            <div class="space-y-6 max-w-lg mx-auto w-full animate-fade-in text-center">
                <div class="bg-violet-50 p-5 rounded-2xl border border-violet-200 space-y-2">
                    <span class="text-[10px] font-extrabold text-violet-800 uppercase tracking-wider bg-violet-200/60 px-3 py-1 rounded-full inline-block">
                        🔀 Susun Huruf
                    </span>
                    <p class="text-sm font-extrabold text-slate-800">${gameEscapeHtml(game.prompt || 'Susun huruf-huruf di bawah ini menjadi kata yang benar!')}</p>
                </div>

                <!-- Answer Slots -->
                <div class="flex items-center justify-center gap-2 min-h-[60px] p-3 bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl flex-wrap" id="anagram-slots-container">
                    <span id="anagram-placeholder" class="text-xs font-bold text-slate-400">Klik huruf di bawah untuk menyusun...</span>
                </div>

                <!-- Scrambled Tile Buttons -->
                <div class="flex items-center justify-center gap-2 flex-wrap max-w-md mx-auto" id="anagram-tiles-container">
                    ${scrambled.map((char, idx) => `
                        <button type="button" id="tile-btn-${idx}" onclick="pickAnagramTile(${idx}, '${char}')" class="w-12 h-14 bg-white hover:bg-violet-600 hover:text-white border-2 border-slate-200 text-slate-800 font-black text-xl rounded-2xl shadow-sm transition active:scale-95 cursor-pointer">
                            ${char}
                        </button>
                    `).join('')}
                </div>

                <div class="flex items-center justify-center gap-3 pt-2">
                    <button type="button" onclick="resetAnagramTiles()" class="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer">
                        <i class="fa-solid fa-rotate-left mr-1"></i> Reset
                    </button>
                    <button type="button" onclick="submitGameSessionAnswer()" class="px-6 py-2.5 bg-violet-600 hover:bg-violet-700 text-white font-extrabold rounded-xl text-xs shadow-md transition cursor-pointer">
                        🚀 Submit Jawaban
                    </button>
                </div>
            </div>
        `;
    }
    // ENGINE 3: BENAR ATAU SALAH
    else if (gameType === 'true_false') {
        container.innerHTML = `
            <div class="space-y-6 max-w-md mx-auto w-full animate-fade-in text-center">
                <div class="bg-slate-50 p-6 rounded-3xl border border-slate-200 space-y-3 shadow-xs">
                    <span class="text-xs font-extrabold text-sky-800 uppercase tracking-wider bg-sky-100 px-3 py-1 rounded-full">
                        🎯 Pernyataan Evaluasi
                    </span>
                    <p class="text-base font-extrabold text-slate-800 leading-relaxed">${gameEscapeHtml(game.prompt)}</p>
                </div>

                <div class="grid grid-cols-2 gap-4">
                    <button type="button" onclick="selectTrueFalseAnswer('BENAR')" class="py-6 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white font-black text-lg rounded-2xl shadow-lg transition cursor-pointer flex flex-col items-center justify-center gap-1">
                        <i class="fa-solid fa-circle-check text-2xl"></i>
                        <span>BENAR</span>
                    </button>
                    <button type="button" onclick="selectTrueFalseAnswer('SALAH')" class="py-6 bg-rose-500 hover:bg-rose-600 active:scale-95 text-white font-black text-lg rounded-2xl shadow-lg transition cursor-pointer flex flex-col items-center justify-center gap-1">
                        <i class="fa-solid fa-circle-xmark text-2xl"></i>
                        <span>SALAH</span>
                    </button>
                </div>
            </div>
        `;
    }
    // ENGINE 4: MEMORY MATCH
    else if (gameType === 'memory_match') {
        renderMemoryMatchEngineUI(game);
        return;
    }
    // ENGINE 5: PUZZLE GAMBAR (3x3 IMAGE PUZZLE)
    else if (gameType === 'image_puzzle') {
        renderImagePuzzleEngineUI(game);
        return;
    }
    // ENGINE 6: CARI KATA (WORD SEARCH)
    else if (gameType === 'word_search') {
        renderWordSearchEngineUI(game);
        return;
    }
    // ENGINE 7: TEKA-TEKI SILANG (CROSSWORD)
    else if (gameType === 'crossword') {
        renderCrosswordEngineUI(game);
        return;
    }
    // ENGINE 8: LABIRIN BENANG KUSUT
    else if (gameType === 'labirin') {
        renderLabirinEngineUI(game);
        return;
    }
    // FALLBACK / GENERAL GAME ENGINE (SPOT DIFFERENCE, PUZZLE GAMBAR, WORD PUZZLE, ETC)
    else {
        container.innerHTML = `
            <div class="space-y-5 max-w-md mx-auto w-full animate-fade-in text-center">
                <div class="bg-emerald-50 p-6 rounded-3xl border border-emerald-200 space-y-2">
                    <span class="text-xs font-extrabold text-emerald-800 uppercase tracking-wider bg-emerald-200/60 px-3 py-1 rounded-full">
                        🧩 Soal Permainan
                    </span>
                    <p class="text-sm font-extrabold text-slate-800">${gameEscapeHtml(game.prompt || 'Selesaikan permainan ini!')}</p>
                    ${game.imageUrl ? `<img src="${gameSafeImageSrc(game.imageUrl)}" class="w-48 h-32 object-cover rounded-xl border border-slate-200 mx-auto mt-2">` : ''}
                </div>

                <div class="space-y-3">
                    <input type="text" id="fallback-answer-input" placeholder="Ketik jawaban di sini..." class="w-full px-4 py-3 bg-white border border-slate-300 rounded-2xl font-black uppercase text-center text-emerald-800 focus:ring-2 focus:ring-emerald-500">
                    <button type="button" onclick="submitGameSessionAnswer()" class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-md transition cursor-pointer">
                        🚀 Submit Jawaban
                    </button>
                </div>
            </div>
        `;
    }
}

// ============================================================================
// GAME ENGINE HANDLERS (ANAGRAM, LETTER BOXES, MEMORY, MATCH PAIRS)
// ============================================================================
window.appendLetterBoxInput = function(letter) {
    if (!activeGameSession) return;

    const previewKeyLength = String(activeGameSession.game.answerKey || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').length;
    const answerLength = Math.max(1, parseInt(activeGameSession.game.answerLength, 10) || previewKeyLength || 8);

    if (activeGameSession.userInputs.length < answerLength) {
        activeGameSession.userInputs.push(letter);
        updateLetterBoxesVisual();
    }
};

window.backspaceLetterBoxInput = function() {
    if (!activeGameSession) return;
    activeGameSession.userInputs.pop();
    updateLetterBoxesVisual();
};

window.clearLetterBoxesInput = function() {
    if (!activeGameSession) return;
    activeGameSession.userInputs = [];
    const directEl = document.getElementById('direct-letter-input');
    if (directEl) directEl.value = '';
    updateLetterBoxesVisual();
};

window.syncDirectInputToBoxes = function(val) {
    if (!activeGameSession) return;
    const clean = String(val || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    activeGameSession.userInputs = clean.split('');
    updateLetterBoxesVisual();
};

function updateLetterBoxesVisual() {
    if (!activeGameSession) return;

    const previewKeyLength = String(activeGameSession.game.answerKey || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').length;
    const answerLength = Math.max(1, parseInt(activeGameSession.game.answerLength, 10) || previewKeyLength || 8);

    for (let i = 0; i < answerLength; i++) {
        const box = document.getElementById(`letter-box-${i}`);
        if (box) {
            const char = activeGameSession.userInputs[i] || '';
            box.innerText = char;
            if (char) {
                box.classList.add('border-emerald-500', 'bg-emerald-50');
            } else {
                box.classList.remove('border-emerald-500', 'bg-emerald-50');
            }
        }
    }
}

// Anagram Tile Picker
window.pickAnagramTile = function(idx, char) {
    if (!activeGameSession) return;
    const tileBtn = document.getElementById(`tile-btn-${idx}`);
    if (!tileBtn || tileBtn.disabled) return;

    tileBtn.disabled = true;
    tileBtn.classList.add('opacity-30', 'cursor-not-allowed');

    activeGameSession.selectedTiles.push({ idx, char });
    renderAnagramSlotsVisual();
};

function renderAnagramSlotsVisual() {
    const slotsContainer = document.getElementById('anagram-slots-container');
    if (!slotsContainer || !activeGameSession) return;

    const selected = activeGameSession.selectedTiles || [];
    if (selected.length === 0) {
        slotsContainer.innerHTML = `<span id="anagram-placeholder" class="text-xs font-bold text-slate-400">Klik huruf di bawah untuk menyusun...</span>`;
        return;
    }

    slotsContainer.innerHTML = selected.map((item, sIdx) => `
        <button type="button" onclick="removeAnagramSlotTile(${sIdx})" class="w-11 h-13 bg-violet-600 text-white font-black text-xl rounded-xl shadow-xs hover:bg-violet-700 transition cursor-pointer">
            ${item.char}
        </button>
    `).join('');
}

window.removeAnagramSlotTile = function(sIdx) {
    if (!activeGameSession || !activeGameSession.selectedTiles) return;
    const removed = activeGameSession.selectedTiles.splice(sIdx, 1)[0];
    if (removed) {
        const tileBtn = document.getElementById(`tile-btn-${removed.idx}`);
        if (tileBtn) {
            tileBtn.disabled = false;
            tileBtn.classList.remove('opacity-30', 'cursor-not-allowed');
        }
    }
    renderAnagramSlotsVisual();
};

window.resetAnagramTiles = function() {
    if (!activeGameSession) return;
    activeGameSession.selectedTiles = [];
    renderAnagramSlotsVisual();
    if (activeGameSession.scrambledPool) {
        activeGameSession.scrambledPool.forEach((_, idx) => {
            const tileBtn = document.getElementById(`tile-btn-${idx}`);
            if (tileBtn) {
                tileBtn.disabled = false;
                tileBtn.classList.remove('opacity-30', 'cursor-not-allowed');
            }
        });
    }
};

window.selectTrueFalseAnswer = function(answer) {
    if (!activeGameSession) return;
    activeGameSession.userAnswer = answer;
    submitGameSessionAnswer();
};

let selectedMemoryCard1 = null;
window.flipMemoryCardTile = function(idx, pairId) {
    const cardEl = document.getElementById(`card-tile-${idx}`);
    if (!cardEl || cardEl.classList.contains('matched')) return;

    const textEl = cardEl.querySelector('.card-text');
    const coverEl = cardEl.querySelector('.card-cover');

    textEl.classList.remove('hidden');
    coverEl.classList.add('hidden');
    cardEl.classList.add('bg-indigo-600', 'border-indigo-400');

    if (!selectedMemoryCard1) {
        selectedMemoryCard1 = { idx, pairId, cardEl };
    } else {
        if (selectedMemoryCard1.pairId === pairId && selectedMemoryCard1.idx !== idx) {
            cardEl.classList.add('matched', 'bg-emerald-600');
            selectedMemoryCard1.cardEl.classList.add('matched', 'bg-emerald-600');
            showToast("Pasangan Cocok!", "success");
            selectedMemoryCard1 = null;

            if (activeGameSession) {
                activeGameSession.matchedPairsCount = (activeGameSession.matchedPairsCount || 0) + 1;
                if (activeGameSession.matchedPairsCount >= (activeGameSession.totalPairsCount || 2)) {
                    setTimeout(() => {
                        submitGameSessionAnswer('COMPLETED', true);
                    }, 500);
                }
            }
        } else {
            setTimeout(() => {
                textEl.classList.add('hidden');
                coverEl.classList.remove('hidden');
                cardEl.classList.remove('bg-indigo-600', 'border-indigo-400');

                if (selectedMemoryCard1 && selectedMemoryCard1.cardEl) {
                    const text1 = selectedMemoryCard1.cardEl.querySelector('.card-text');
                    const cover1 = selectedMemoryCard1.cardEl.querySelector('.card-cover');
                    if (text1) text1.classList.add('hidden');
                    if (cover1) cover1.classList.remove('hidden');
                    selectedMemoryCard1.cardEl.classList.remove('bg-indigo-600', 'border-indigo-400');
                }
                selectedMemoryCard1 = null;
            }, 700);
        }
    }
};

window.selectMatchPairTerm = function(idx) {
    if (!activeGameSession) return;
    activeGameSession.selectedTermIdx = idx;
    document.querySelectorAll('[id^="term-btn-"]').forEach((btn, bIdx) => {
        if (bIdx === idx) {
            btn.classList.add('border-emerald-500', 'bg-emerald-50');
        } else {
            btn.classList.remove('border-emerald-500', 'bg-emerald-50');
        }
    });
};

window.selectMatchPairDef = function(matchIdx, pairId) {
    if (!activeGameSession || activeGameSession.selectedTermIdx === null) {
        showToast("Pilih istilah di kolom kiri dulu!", "warning");
        return;
    }

    const termIdx = activeGameSession.selectedTermIdx;
    activeGameSession.matchedPairsMap[termIdx] = pairId;

    const matchBtn = document.getElementById(`match-btn-${matchIdx}`);
    if (matchBtn) {
        matchBtn.classList.add('border-emerald-500', 'bg-emerald-50');
    }
    showToast(`Istilah ${termIdx+1} terhubung!`, "info");
    activeGameSession.selectedTermIdx = null;
};

window.submitMatchPairsAnswer = function() {
    submitGameSessionAnswer('COMPLETED', true);
};

window.toggleMarkWordFound = function(idx) {
    const chip = document.getElementById(`word-chip-${idx}`);
    if (!chip) return;
    chip.classList.toggle('bg-emerald-600');
    chip.classList.toggle('text-white');
    chip.classList.toggle('line-through');
};

// ============================================================================
// SUBMIT GAME SESSION & VALIDATE ON SERVER
// ============================================================================
window.submitGameSessionAnswer = async function(overrideAns = null, overridePassed = false, customXp = null) {
    if (!activeGameSession) return;
    if (activeGameTimer) clearInterval(activeGameTimer);

    let submittedAnswer = overrideAns || activeGameSession.userAnswer;

    if (!submittedAnswer && activeGameSession.selectedTiles && activeGameSession.selectedTiles.length > 0) {
        submittedAnswer = activeGameSession.selectedTiles.map(t => t.char).join('');
    }
    if (!submittedAnswer && activeGameSession.userInputs && activeGameSession.userInputs.length > 0) {
        submittedAnswer = activeGameSession.userInputs.join('');
    }
    const directInput = document.getElementById('direct-letter-input');
    if (!submittedAnswer && directInput && directInput.value) {
        submittedAnswer = (directInput.value || '').trim().toUpperCase();
    }
    const fallbackInput = document.getElementById('fallback-answer-input');
    if (!submittedAnswer && fallbackInput && fallbackInput.value) {
        submittedAnswer = (fallbackInput.value || '').trim().toUpperCase();
    }
    const cwInput = document.getElementById('crossword-input-box');
    if (!submittedAnswer && cwInput && cwInput.value) {
        submittedAnswer = (cwInput.value || '').trim().toUpperCase();
    }
    const escapeInput = document.getElementById('escape-passcode-input');
    if (!submittedAnswer && escapeInput && escapeInput.value) {
        submittedAnswer = (escapeInput.value || '').trim().toUpperCase();
    }

    const game = activeGameSession.game;
    const studentId = appState.currentUser ? appState.currentUser.id : 'STUDENT_GUEST';

    try {
        const res = await fetch(`/api/games/${game.id}/submit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                submittedAnswer,
                studentId,
                isPreview: activeGameSession.isPreview,
                passed: overridePassed,
                customXp: customXp
            })
        });
        const data = await res.json();

        const container = document.getElementById('game-session-body');
        if (!container) return;

        if (data.isCorrect) {
            if (appState.currentUser) {
                appState.currentUser.gameXp = data.newTotalXp || ((appState.currentUser.gameXp || 0) + (data.earnedXp || 100));
                appState.currentUser.dailyStreak = data.dailyStreak || appState.currentUser.dailyStreak || 1;
                safeSetLocalStorage('madrasah_current_user', appState.currentUser);
            }

            // Record Mode progression if played from Adventure or Tower mode or Catalog
            if (activeGameSession.modeOptions && activeGameSession.modeOptions.modeId) {
                const modeId = activeGameSession.modeOptions.modeId;
                const prog = getStudentProgressForMode(modeId);
                if (activeGameSession.modeOptions.locationId) {
                    if (!prog.completedLocations.includes(activeGameSession.modeOptions.locationId)) {
                        prog.completedLocations.push(activeGameSession.modeOptions.locationId);
                    }
                }
                if (activeGameSession.modeOptions.floorId) {
                    if (!prog.completedFloors.includes(activeGameSession.modeOptions.floorId)) {
                        prog.completedFloors.push(activeGameSession.modeOptions.floorId);
                    }
                }
                safeSetLocalStorage('madrasah_student_game_progress', appState.studentGameProgress);
            } else if (activeGameSession.gameId) {
                const catProg = getStudentProgressForMode('CATALOG');
                if (!catProg.completedCatalogGames) catProg.completedCatalogGames = [];
                if (!catProg.completedCatalogGames.includes(activeGameSession.gameId)) {
                    catProg.completedCatalogGames.push(activeGameSession.gameId);
                }
                safeSetLocalStorage('madrasah_student_game_progress', appState.studentGameProgress);
            }

            container.innerHTML = `
                <div class="space-y-5 animate-fade-in text-center py-4">
                    <div class="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto shadow-lg shadow-emerald-500/20 border-4 border-emerald-500">
                        🎉
                    </div>
                    <h2 class="text-2xl font-black text-emerald-800">Jawaban Benar! Hebat!</h2>
                    ${data.rewardVerified === false
                        ? '<p class="text-xs font-bold text-slate-500">Tantangan selesai. Mode interaktif ini tidak memberi XP tanpa verifikasi server.</p>'
                        : `<p class="text-xs font-bold text-slate-600">Kamu mendapatkan <span class="text-amber-600 font-extrabold">+${Number(data.earnedXp || 0)} XP</span></p>`}

                    <button type="button" onclick="closeActiveGameSession(); if(window.renderGameStudentModule) renderGameStudentModule(document.getElementById('view-container'));" class="px-8 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-2xl shadow-lg transition cursor-pointer">
                        Lanjutkan Belajar
                    </button>
                </div>
            `;
        } else {
            container.innerHTML = `
                <div class="space-y-5 animate-fade-in text-center py-4">
                    <div class="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center text-4xl mx-auto border-4 border-rose-500">
                        ❌
                    </div>
                    <h2 class="text-2xl font-black text-rose-800">Jawaban Belum Tepat</h2>
                    <p class="text-xs text-slate-500">Jawabanmu: <span class="font-bold text-slate-800">${gameEscapeHtml(submittedAnswer || '-')}</span></p>
                    <p class="text-xs font-bold text-slate-600 bg-slate-50 px-4 py-2 rounded-xl inline-block border border-slate-200">
                        Kunci jawaban diverifikasi aman di server.
                    </p>

                    <div class="pt-2">
                        <button type="button" onclick="launchInteractiveGameModal('${game.id}', ${activeGameSession.isPreview})" class="px-8 py-3 bg-slate-800 hover:bg-slate-900 text-white font-extrabold text-xs rounded-2xl shadow transition cursor-pointer">
                            Coba Lagi
                        </button>
                    </div>
                </div>
            `;
        }
    } catch (err) {
        showToast("Gagal memproses jawaban game", "error");
    }
};

// ============================================================================
// CROSSWORD (TTS) INTERACTIVE BOARD & GRID CALCULATOR
// ============================================================================
export function buildCrosswordGrid(cluesInput) {
    let clues = Array.isArray(cluesInput) && cluesInput.length > 0 ? cluesInput : [
        { number: 1, direction: 'across', row: 1, col: 1, clue: 'Otak pemroses utama pada komputer (3 Huruf)', answer: 'CPU', points: 30, initialHint: true },
        { number: 2, direction: 'down', row: 1, col: 1, clue: 'Perangkat keras pengolah data utama (8 Huruf)', answer: 'COMPUTER', points: 50, initialHint: true },
        { number: 3, direction: 'across', row: 3, col: 1, clue: 'Modulasi sinyal jaringan internet (5 Huruf)', answer: 'MODEM', points: 30, initialHint: true },
        { number: 4, direction: 'across', row: 4, col: 1, clue: 'Perangkat pencetak dokumen kertas (7 Huruf)', answer: 'PRINTER', points: 40, initialHint: true }
    ];

    const processedClues = clues.map((c, idx) => {
        const answer = String(c.answer || '').trim().toUpperCase().replace(/[^A-Z]/g, '');
        const length = Math.max(1, parseInt(c.length, 10) || answer.length || 1);
        return {
            id: `clue_${idx}`,
            clueIndex: idx,
            number: parseInt(c.number, 10) || (idx + 1),
            direction: c.direction === 'down' ? 'down' : 'across',
            row: parseInt(c.row, 10) || 1,
            col: parseInt(c.col, 10) || 1,
            clue: c.clue || 'Petunjuk teka-teki silang',
            answer,
            length,
            initialLetter: String(c.initialLetter || answer[0] || '').trim().toUpperCase().replace(/[^A-Z]/g, '').slice(0, 1),
            points: parseInt(c.points, 10) || Math.max(10, length * 10),
            initialHint: c.initialHint !== false
        };
    });

    let maxRow = 8;
    let maxCol = 8;

    processedClues.forEach(c => {
        const len = c.length;
        if (c.direction === 'across') {
            maxRow = Math.max(maxRow, c.row);
            maxCol = Math.max(maxCol, c.col + len - 1);
        } else {
            maxRow = Math.max(maxRow, c.row + len - 1);
            maxCol = Math.max(maxCol, c.col);
        }
    });

    const grid = {};
    for (let r = 1; r <= maxRow; r++) {
        for (let c = 1; c <= maxCol; c++) {
            grid[`${r}_${c}`] = {
                row: r,
                col: c,
                isCell: false,
                expected: '',
                number: null,
                clues: [],
                isInitialHint: false
            };
        }
    }

    processedClues.forEach(clue => {
        const len = clue.length;
        for (let i = 0; i < len; i++) {
            const r = clue.direction === 'across' ? clue.row : clue.row + i;
            const c = clue.direction === 'across' ? clue.col + i : clue.col;
            const key = `${r}_${c}`;

            if (grid[key]) {
                grid[key].isCell = true;
                grid[key].expected = clue.answer[i] || (i === 0 ? clue.initialLetter : '');
                if (i === 0) {
                    if (!grid[key].number) grid[key].number = clue.number;
                    if (clue.initialHint) grid[key].isInitialHint = true;
                }
                if (!grid[key].clues.includes(clue.id)) {
                    grid[key].clues.push(clue.id);
                }
            }
        }
    });

    return { grid, maxRow, maxCol, clues: processedClues };
}

function renderCrosswordEngineUI(game) {
    const rawClues = game.crosswordData?.clues;
    const { grid, maxRow, maxCol, clues } = buildCrosswordGrid(rawClues);

    activeGameSession.crosswordState = {
        grid,
        maxRow,
        maxCol,
        clues,
        activeClueId: clues[0]?.id || null,
        userCells: {},
        completedClues: {},
        totalScore: 0,
        maxPossibleScore: clues.reduce((acc, c) => acc + (c.points || 20), 0)
    };

    // Pre-fill initial hint letters
    Object.values(grid).forEach(cell => {
        if (cell.isCell && cell.isInitialHint && cell.expected) {
            activeGameSession.crosswordState.userCells[`${cell.row}_${cell.col}`] = cell.expected;
        }
    });

    renderCrosswordSessionLayout();
}

function renderCrosswordSessionLayout() {
    const container = document.getElementById('game-session-body');
    if (!container || !activeGameSession || !activeGameSession.crosswordState) return;

    const state = activeGameSession.crosswordState;
    const { grid, maxRow, maxCol, clues, activeClueId, userCells, completedClues, totalScore, maxPossibleScore } = state;

    const activeClue = clues.find(c => c.id === activeClueId) || clues[0];
    const acrossClues = clues.filter(c => c.direction === 'across');
    const downClues = clues.filter(c => c.direction === 'down');

    container.innerHTML = `
        <div class="space-y-4 max-w-4xl mx-auto w-full animate-fade-in text-left">
            
            <!-- Header Score & Target Banner -->
            <div class="bg-indigo-950 text-white p-4 rounded-2xl border border-indigo-800/80 shadow-lg flex flex-wrap items-center justify-between gap-3 text-xs">
                <div class="flex items-center space-x-3">
                    <div class="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center font-black text-lg text-white shadow-xs">
                        🧩
                    </div>
                    <div>
                        <div class="flex items-center gap-2">
                            <span class="px-2 py-0.5 bg-indigo-500/30 text-indigo-300 font-extrabold uppercase text-[10px] rounded-full">
                                Teka-Teki Silang (TTS)
                            </span>
                            <span class="text-amber-400 font-extrabold">${Object.keys(completedClues).length} / ${clues.length} Kolom Selesai</span>
                        </div>
                        <h4 class="font-bold text-sm text-slate-100 mt-0.5">${gameEscapeHtml(activeGameSession.game.prompt || 'Isi kolom mendatar dan menurun berikut!')}</h4>
                    </div>
                </div>

                <div class="flex items-center space-x-3 bg-slate-900/80 px-4 py-2 rounded-xl border border-indigo-700/50">
                    <div class="text-right">
                        <span class="text-[10px] font-bold text-slate-400 block uppercase">Total Poin TTS</span>
                        <span class="font-black text-amber-400 text-sm" id="cw-live-score">+${totalScore} / ${maxPossibleScore} poin</span>
                    </div>
                </div>
            </div>

            <!-- Main Crossword Area: Grid + Clues List -->
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                
                <!-- LEFT/TOP: THE INTERACTIVE 2D TTS GRID (7 Columns in LG) -->
                <div class="lg:col-span-7 bg-slate-950 p-4 sm:p-5 rounded-3xl border-2 border-indigo-900/50 shadow-2xl flex flex-col items-center justify-center space-y-3 overflow-x-auto">
                    
                    <span class="text-[10px] font-extrabold text-indigo-400 uppercase tracking-widest bg-indigo-950 px-3 py-1 rounded-full border border-indigo-800">
                        <i class="fa-solid fa-table-cells mr-1"></i> Board Kolom TTS (${maxRow}x${maxCol})
                    </span>

                    <!-- Grid Table -->
                    <div class="grid gap-1.5 p-2 bg-slate-900/90 rounded-2xl border border-slate-800 shadow-inner max-w-full overflow-x-auto" style="grid-template-columns: repeat(${maxCol}, minmax(0, 1fr));">
                        ${Array.from({ length: maxRow }).flatMap((_, rIdx) => {
                            const r = rIdx + 1;
                            return Array.from({ length: maxCol }).map((_, cIdx) => {
                                const c = cIdx + 1;
                                const key = `${r}_${c}`;
                                const cell = grid[key];

                                if (!cell || !cell.isCell) {
                                    return `<div class="w-8 h-8 sm:w-10 sm:h-10 bg-slate-950/60 rounded-xl border border-slate-900/80 pointer-events-none"></div>`;
                                }

                                const val = userCells[key] || '';
                                const isInitial = cell.isInitialHint && cell.expected;
                                const isActiveClueCell = activeClue && cell.clues.includes(activeClue.id);

                                return `
                                    <div class="relative w-8 h-8 sm:w-10 sm:h-10">
                                        ${cell.number ? `<span class="absolute top-0.5 left-1 text-[8px] font-black text-indigo-400 z-10 pointer-events-none">${cell.number}</span>` : ''}
                                        
                                        <input type="text"
                                               maxlength="1"
                                               data-row="${r}"
                                               data-col="${c}"
                                               id="cw-cell-${r}-${c}"
                                               value="${val}"
                                               onfocus="highlightCrosswordCell(${r}, ${c})"
                                               oninput="onCrosswordCellInputChange(this, ${r}, ${c})"
                                               onkeydown="onCrosswordCellKeyDown(event, ${r}, ${c})"
                                               class="w-full h-full text-center font-black text-sm sm:text-base uppercase rounded-xl border-2 transition-all duration-150 focus:outline-none ${
                                                   isActiveClueCell
                                                       ? 'bg-amber-100 border-amber-400 text-slate-950 shadow-md ring-2 ring-amber-400/50'
                                                       : isInitial
                                                           ? 'bg-indigo-950/80 border-indigo-500 text-emerald-300 font-extrabold'
                                                           : 'bg-slate-800 border-slate-700 text-white focus:bg-white focus:text-slate-950 focus:border-indigo-500'
                                               }">
                                    </div>
                                `;
                            });
                        }).join('')}
                    </div>

                    <!-- Selected Active Clue Input Quick Bar -->
                    ${activeClue ? `
                        <div class="w-full bg-slate-900 p-3 rounded-2xl border border-slate-800 space-y-2 text-left">
                            <div class="flex items-center justify-between text-xs">
                                <span class="font-extrabold text-amber-400 uppercase">
                                    ${activeClue.direction === 'across' ? '↔️ Mendatar' : '↕️ Menurun'} No. ${activeClue.number}
                                </span>
                                <span class="font-bold text-slate-400 text-[11px]">+${activeClue.points || 20} XP &middot; ${activeClue.length} Kolom Huruf</span>
                            </div>
                            <p class="text-xs font-bold text-slate-200">${gameEscapeHtml(activeClue.clue)}</p>
                            
                            <div class="flex items-center gap-2 pt-1">
                                <input type="text"
                                       id="cw-active-word-input"
                                       value="${getTypedWordForClue(activeClue)}"
                                       oninput="syncCrosswordWordInput(this.value)"
                                       placeholder="Ketik jawaban di sini..."
                                       class="flex-1 px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white font-extrabold uppercase text-xs focus:ring-2 focus:ring-indigo-500">
                                
                                <button type="button" onclick="checkCrosswordWord('${activeClue.id}')" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs shadow-md transition cursor-pointer">
                                    <i class="fa-solid fa-check mr-1"></i> Periksa
                                </button>
                            </div>
                        </div>
                    ` : ''}

                </div>

                <!-- RIGHT: DAFTAR PETUNJUK MENDATAR & MENURUN (5 Columns in LG) -->
                <div class="lg:col-span-5 space-y-4">
                    
                    <!-- TAB 1: MENDATAR (ACROSS) -->
                    <div class="bg-indigo-50/80 p-4 rounded-3xl border border-indigo-200 space-y-3">
                        <div class="flex items-center justify-between">
                            <h4 class="font-extrabold text-indigo-950 uppercase text-xs flex items-center gap-1.5">
                                <i class="fa-solid fa-arrows-left-right text-indigo-600"></i> Mendatar (${acrossClues.length})
                            </h4>
                            <span class="text-[10px] font-bold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-full">Soal Horizontal</span>
                        </div>

                        <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                            ${acrossClues.map(c => renderClueCard(c, activeClueId, completedClues)).join('')}
                        </div>
                    </div>

                    <!-- TAB 2: MENURUN (DOWN) -->
                    <div class="bg-amber-50/80 p-4 rounded-3xl border border-amber-200 space-y-3">
                        <div class="flex items-center justify-between">
                            <h4 class="font-extrabold text-amber-950 uppercase text-xs flex items-center gap-1.5">
                                <i class="fa-solid fa-arrows-up-down text-amber-600"></i> Menurun (${downClues.length})
                            </h4>
                            <span class="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">Soal Vertikal</span>
                        </div>

                        <div class="space-y-2 max-h-56 overflow-y-auto pr-1">
                            ${downClues.map(c => renderClueCard(c, activeClueId, completedClues)).join('')}
                        </div>
                    </div>

                    <!-- Submit All Button -->
                    <div class="pt-2">
                        <button type="button" onclick="submitGameSessionAnswer('COMPLETED', true)" class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-2xl shadow-lg transition flex items-center justify-center gap-2 text-xs cursor-pointer">
                            <span>🚀 Selesai & Submit Jawaban TTS</span>
                        </button>
                    </div>

                </div>

            </div>
        </div>
    `;
}

function renderClueCard(c, activeClueId, completedClues) {
    const isCompleted = completedClues[c.id];
    const isActive = activeClueId === c.id;

    return `
        <div onclick="selectCrosswordClue('${c.id}')"
             class="p-3 rounded-2xl border transition-all cursor-pointer ${
                 isCompleted
                     ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                     : isActive
                         ? 'bg-indigo-600 text-white border-indigo-700 shadow-md ring-2 ring-indigo-400'
                         : 'bg-white border-slate-200 text-slate-800 hover:border-indigo-400'
             }">
            <div class="flex items-center justify-between gap-2">
                <span class="font-black text-xs">No. ${c.number} (${c.length} Kolom)</span>
                <span class="text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    isCompleted
                        ? 'bg-emerald-200 text-emerald-800'
                        : isActive
                            ? 'bg-indigo-800 text-amber-300'
                            : 'bg-slate-100 text-amber-700'
                }">
                    ${isCompleted ? '✓ Selesai (+ ' + c.points + ' poin)' : '+' + c.points + ' poin'}
                </span>
            </div>
            <p class="text-xs font-semibold mt-1 leading-snug ${isActive ? 'text-indigo-100' : 'text-slate-700'}">${gameEscapeHtml(c.clue)}</p>
        </div>
    `;
}

function getTypedWordForClue(clue) {
    if (!activeGameSession || !activeGameSession.crosswordState) return '';
    const { userCells } = activeGameSession.crosswordState;
    let word = '';
    for (let i = 0; i < clue.length; i++) {
        const r = clue.direction === 'across' ? clue.row : clue.row + i;
        const c = clue.direction === 'across' ? clue.col + i : clue.col;
        word += (userCells[`${r}_${c}`] || '');
    }
    return word;
}

window.selectCrosswordClue = function(clueId) {
    if (!activeGameSession || !activeGameSession.crosswordState) return;
    activeGameSession.crosswordState.activeClueId = clueId;
    renderCrosswordSessionLayout();
};

window.highlightCrosswordCell = function(r, c) {
    if (!activeGameSession || !activeGameSession.crosswordState) return;
    const { grid } = activeGameSession.crosswordState;
    const key = `${r}_${c}`;
    const cell = grid[key];
    if (cell && cell.clues.length > 0) {
        if (!cell.clues.includes(activeGameSession.crosswordState.activeClueId)) {
            activeGameSession.crosswordState.activeClueId = cell.clues[0];
            renderCrosswordSessionLayout();
        }
    }
};

window.onCrosswordCellInputChange = function(inputEl, r, c) {
    if (!activeGameSession || !activeGameSession.crosswordState) return;
    const state = activeGameSession.crosswordState;
    const val = String(inputEl.value || '').toUpperCase().replace(/[^A-Z]/g, '');
    inputEl.value = val;

    state.userCells[`${r}_${c}`] = val;

    const activeClue = state.clues.find(clue => clue.id === state.activeClueId);
    if (activeClue) {
        const typed = getTypedWordForClue(activeClue);
        if (typed.length === activeClue.length) {
            checkCrosswordWord(activeClue.id);
        } else if (val) {
            const nextR = activeClue.direction === 'across' ? r : r + 1;
            const nextC = activeClue.direction === 'across' ? c + 1 : c;
            const nextEl = document.getElementById(`cw-cell-${nextR}-${nextC}`);
            if (nextEl) nextEl.focus();
        }
    }

    const activeWordInput = document.getElementById('cw-active-word-input');
    if (activeWordInput && activeClue) {
        activeWordInput.value = getTypedWordForClue(activeClue);
    }
};

window.onCrosswordCellKeyDown = function(e, r, c) {
    if (!activeGameSession || !activeGameSession.crosswordState) return;
    const state = activeGameSession.crosswordState;
    const activeClue = state.clues.find(clue => clue.id === state.activeClueId);

    if (e.key === 'Backspace' && !state.userCells[`${r}_${c}`]) {
        if (activeClue) {
            const prevR = activeClue.direction === 'across' ? r : r - 1;
            const prevC = activeClue.direction === 'across' ? c - 1 : c;
            const prevEl = document.getElementById(`cw-cell-${prevR}-${prevC}`);
            if (prevEl) prevEl.focus();
        }
    }
};

window.syncCrosswordWordInput = function(val) {
    if (!activeGameSession || !activeGameSession.crosswordState) return;
    const state = activeGameSession.crosswordState;
    const activeClue = state.clues.find(clue => clue.id === state.activeClueId);
    if (!activeClue) return;

    const clean = String(val || '').toUpperCase().replace(/[^A-Z]/g, '');

    for (let i = 0; i < activeClue.length; i++) {
        const r = activeClue.direction === 'across' ? activeClue.row : activeClue.row + i;
        const c = activeClue.direction === 'across' ? activeClue.col + i : activeClue.col;
        const char = clean[i] || '';
        state.userCells[`${r}_${c}`] = char;

        const cellInput = document.getElementById(`cw-cell-${r}-${c}`);
        if (cellInput) cellInput.value = char;
    }
};

window.checkCrosswordWord = async function(clueId) {
    if (!activeGameSession || !activeGameSession.crosswordState) return;
    const state = activeGameSession.crosswordState;
    const clue = state.clues.find(c => c.id === clueId);
    if (!clue) return;

    const typed = getTypedWordForClue(clue);
    if (typed.length !== clue.length) {
        showToast(`Lengkapi ${clue.length} huruf untuk nomor ${clue.number}.`, "info");
        return;
    }

    let isCorrect = false;
    if (clue.answer) {
        // Staff preview may retain the full answer locally.
        isCorrect = typed === clue.answer;
    } else {
        try {
            const response = await fetch(`/api/games/${encodeURIComponent(activeGameSession.game.id)}/check`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    challenge: 'crossword',
                    clueIndex: clue.clueIndex,
                    submittedAnswer: typed
                })
            });
            const data = await response.json().catch(() => ({ success: false }));
            if (!response.ok || !data.success) {
                showToast(data.message || 'Gagal memeriksa jawaban TTS.', 'error');
                return;
            }
            isCorrect = data.isCorrect === true;
        } catch (_) {
            showToast('Koneksi validasi TTS terputus. Coba lagi.', 'error');
            return;
        }
    }

    if (isCorrect) {
        if (!state.completedClues[clue.id]) {
            state.completedClues[clue.id] = true;
            state.totalScore += (clue.points || 20);
            showToast(`🎉 Jawaban TTS ${clue.direction === 'across' ? 'Mendatar' : 'Menurun'} No. ${clue.number} BENAR! (+${clue.points || 20} poin)`, "success");

            const liveScoreEl = document.getElementById('cw-live-score');
            if (liveScoreEl) liveScoreEl.innerText = `+${state.totalScore} / ${state.maxPossibleScore} poin`;

            if (Object.keys(state.completedClues).length >= state.clues.length) {
                setTimeout(() => {
                    submitGameSessionAnswer('COMPLETED', true);
                }, 600);
            } else {
                renderCrosswordSessionLayout();
            }
        } else {
            showToast("Kolom ini sudah diselesaikan!", "info");
        }
    } else {
        showToast(`Jawaban No. ${clue.number} belum tepat! Periksa kembali huruf pada kolom.`, "warning");
    }
};

window.onkeydown = null;

// ============================================================================
// IMAGE FILE UPLOAD HELPERS FOR GAME EDITORS
// ============================================================================
window.handleImageFileUpload = function(event, previewImgId, hiddenInputId) {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        if (window.showToast) window.showToast('File harus berupa gambar (JPG, PNG, WebP).', 'warning');
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const rawDataUrl = e.target.result;

        // Compress image using canvas down to max 800px & 0.75 quality to keep payloads light
        const img = new Image();
        img.onload = function() {
            const canvas = document.createElement('canvas');
            const maxDim = 800;
            let width = img.width;
            let height = img.height;

            if (width > maxDim || height > maxDim) {
                if (width > height) {
                    height = Math.round((height * maxDim) / width);
                    width = maxDim;
                } else {
                    width = Math.round((width * maxDim) / height);
                    height = maxDim;
                }
            }

            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);

            const hiddenInput = document.getElementById(hiddenInputId);
            if (hiddenInput) hiddenInput.value = compressedDataUrl;

            const previewImg = document.getElementById(previewImgId);
            if (previewImg) {
                previewImg.src = compressedDataUrl;
                previewImg.classList.remove('hidden');
            }

            const previewContainer = document.getElementById(previewImgId + '-container');
            if (previewContainer) previewContainer.classList.remove('hidden');

            if (window.showToast) window.showToast('Foto berhasil diunggah!', 'success');
        };
        img.onerror = function() {
            // Fallback if image load fails
            const hiddenInput = document.getElementById(hiddenInputId);
            if (hiddenInput) hiddenInput.value = rawDataUrl;

            const previewImg = document.getElementById(previewImgId);
            if (previewImg) {
                previewImg.src = rawDataUrl;
                previewImg.classList.remove('hidden');
            }
        };
        img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
};

window.clearUploadedImage = function(previewImgId, hiddenInputId) {
    const hiddenInput = document.getElementById(hiddenInputId);
    if (hiddenInput) hiddenInput.value = '';

    const previewImg = document.getElementById(previewImgId);
    if (previewImg) {
        previewImg.src = '';
        previewImg.classList.add('hidden');
    }

    const previewContainer = document.getElementById(previewImgId + '-container');
    if (previewContainer) previewContainer.classList.add('hidden');

    const fileInput = document.getElementById(previewImgId + '-file-input');
    if (fileInput) fileInput.value = '';
};

// ============================================================================
// ENGINE TEBAK GAMBAR PROGRESIF (1/4 QUADRANT + 4 CLUES + DYNAMIC SCORE)
// ============================================================================
window.renderTebakGambarEngineUI = function(game) {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const rawHints = Array.isArray(game.hints) ? game.hints : [game.hints || ''];
    const hints = [];
    for (let i = 0; i < 4; i++) {
        hints.push((rawHints[i] || `Petunjuk ${i + 1}`).trim());
    }

    activeGameSession.tebakGambarState = {
        game,
        revealedCount: 1, // Opens 1/4 first
        hints,
        baseXp: Number(game.rewardXp) || 100,
        typedLetters: []
    };

    renderTebakGambarLayout();
};

window.renderTebakGambarLayout = function() {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const state = activeGameSession.tebakGambarState;
    if (!state) return;

    const game = state.game;
    const revealed = state.revealedCount; // 1, 2, 3, or 4
    const baseXp = state.baseXp;
    
    // XP multiplier: 1 tile = 100%, 2 tiles = 75%, 3 tiles = 50%, 4 tiles = 25%
    const multiplier = (5 - revealed) / 4;
    const potentialXp = Math.max(10, Math.round(baseXp * multiplier));

    const isCovered1 = revealed < 1;
    const isCovered2 = revealed < 2;
    const isCovered3 = revealed < 3;
    const isCovered4 = revealed < 4;

    container.innerHTML = `
        <div class="space-y-5 max-w-lg mx-auto w-full animate-fade-in">
            <!-- Header status & XP Badge -->
            <div class="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-4 rounded-2xl shadow-md flex items-center justify-between">
                <div>
                    <span class="text-[10px] uppercase tracking-wider font-extrabold bg-white/20 px-2.5 py-0.5 rounded-full inline-block mb-1">
                        🖼️ Tebak Gambar Progresif
                    </span>
                    <h3 class="text-sm font-black">${gameEscapeHtml(game.title || 'Tebak Gambar')}</h3>
                </div>
                <div class="text-right">
                    <span class="text-[10px] text-emerald-100 font-bold block">Potensi Nilai/XP</span>
                    <span class="text-lg font-black text-amber-300 bg-black/30 px-3 py-1 rounded-xl inline-block border border-amber-400/30">
                        +${potentialXp} XP
                    </span>
                </div>
            </div>

            <!-- Image with 4 Quadrant Cover Overlays -->
            <div class="relative w-full aspect-square max-w-[300px] mx-auto rounded-3xl overflow-hidden border-4 border-slate-800 shadow-xl bg-slate-900">
                ${game.imageUrl ? `
                    <img src="${gameSafeImageSrc(game.imageUrl)}" class="w-full h-full object-cover">
                ` : `
                    <div class="w-full h-full flex items-center justify-center text-slate-500 font-bold text-xs p-4 text-center">
                        (Gambar tidak tersedia)
                    </div>
                `}

                <!-- Quadrant 1 (Top-Left) -->
                <div class="absolute top-0 left-0 w-1/2 h-1/2 border-r border-b border-white/20 flex items-center justify-center transition-all duration-500 ${isCovered1 ? 'bg-slate-950/95 backdrop-blur-md' : 'bg-transparent pointer-events-none'}">
                    ${isCovered1 ? '<span class="text-2xl font-black text-slate-500">🔒 1</span>' : '<span class="text-[10px] font-bold text-emerald-400 bg-black/60 px-2 py-0.5 rounded-full absolute top-2 left-2">Bagian 1</span>'}
                </div>

                <!-- Quadrant 2 (Top-Right) -->
                <div class="absolute top-0 right-0 w-1/2 h-1/2 border-l border-b border-white/20 flex items-center justify-center transition-all duration-500 ${isCovered2 ? 'bg-slate-950/95 backdrop-blur-md' : 'bg-transparent pointer-events-none'}">
                    ${isCovered2 ? '<span class="text-2xl font-black text-slate-500">🔒 2</span>' : '<span class="text-[10px] font-bold text-emerald-400 bg-black/60 px-2 py-0.5 rounded-full absolute top-2 right-2">Bagian 2</span>'}
                </div>

                <!-- Quadrant 3 (Bottom-Left) -->
                <div class="absolute bottom-0 left-0 w-1/2 h-1/2 border-r border-t border-white/20 flex items-center justify-center transition-all duration-500 ${isCovered3 ? 'bg-slate-950/95 backdrop-blur-md' : 'bg-transparent pointer-events-none'}">
                    ${isCovered3 ? '<span class="text-2xl font-black text-slate-500">🔒 3</span>' : '<span class="text-[10px] font-bold text-emerald-400 bg-black/60 px-2 py-0.5 rounded-full absolute bottom-2 left-2">Bagian 3</span>'}
                </div>

                <!-- Quadrant 4 (Bottom-Right) -->
                <div class="absolute bottom-0 right-0 w-1/2 h-1/2 border-l border-t border-white/20 flex items-center justify-center transition-all duration-500 ${isCovered4 ? 'bg-slate-950/95 backdrop-blur-md' : 'bg-transparent pointer-events-none'}">
                    ${isCovered4 ? '<span class="text-2xl font-black text-slate-500">🔒 4</span>' : '<span class="text-[10px] font-bold text-emerald-400 bg-black/60 px-2 py-0.5 rounded-full absolute bottom-2 right-2">Bagian 4</span>'}
                </div>
            </div>

            <!-- Reveal Control Button -->
            <div class="text-center space-y-1">
                ${revealed < 4 ? `
                    <button type="button" onclick="revealNextTebakGambarTile()" class="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition cursor-pointer inline-flex items-center gap-2">
                        <span>🔓 Buka Gambar Ke-${revealed + 1} & Clue Ke-${revealed + 1}</span>
                        <span class="bg-amber-950/20 px-2 py-0.5 rounded-md text-[10px] text-amber-950 font-bold">-25% XP</span>
                    </button>
                    <p class="text-[10px] font-semibold text-slate-500">Membuka bagian gambar baru akan membuka clue berikutnya, namun nilai berkurang 25%.</p>
                ` : `
                    <span class="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-4 py-2 rounded-xl inline-block">
                        ✨ Seluruh 4 bagian gambar & 4 clue telah terbuka!
                    </span>
                `}
            </div>

            <!-- Clues Section (4 Clues) -->
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <h4 class="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <i class="fa-solid fa-lightbulb text-amber-500"></i> Petunjuk & Clue Progresif (${revealed}/4 Terbuka)
                </h4>
                <div class="grid grid-cols-1 gap-2">
                    ${state.hints.map((hint, idx) => {
                        const isUnlocked = idx < revealed;
                        return `
                            <div class="p-2.5 rounded-xl text-xs transition-all ${isUnlocked ? 'bg-amber-50/90 border border-amber-300 text-amber-950 font-medium' : 'bg-slate-100 border border-slate-200 text-slate-400 italic'}">
                                <div class="flex items-center justify-between">
                                    <span class="font-extrabold ${isUnlocked ? 'text-amber-800' : 'text-slate-400'}">Clue ${idx + 1}:</span>
                                    <span class="text-[10px] font-bold ${isUnlocked ? 'text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full' : 'text-slate-400'}">
                                        ${isUnlocked ? 'Terbuka' : 'Terkunci 🔒'}
                                    </span>
                                </div>
                                <p class="mt-1 text-[11px] ${isUnlocked ? 'font-semibold text-slate-800' : 'text-slate-400'}">
                                    ${gameEscapeHtml(isUnlocked ? (hint || `Petunjuk bagian ${idx + 1}`) : `Buka bagian gambar ke-${idx + 1} untuk melihat clue ini.`)}
                                </p>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Answer Input Section -->
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3 text-center">
                <label class="block text-xs font-extrabold text-slate-700 uppercase tracking-wider">
                    Masukkan Jawaban Tebak Gambar
                </label>

                <input type="text" id="tebak-gambar-input-box" value="${state.typedLetters.join('')}" oninput="activeGameSession.tebakGambarState.typedLetters = this.value.toUpperCase().replace(/[^A-Z0-9]/g, '').split(''); updateTebakGambarDisplay();" placeholder="Ketik jawaban di sini..." class="w-full text-center tracking-widest font-black text-lg p-3 border-2 border-emerald-400 focus:border-emerald-600 rounded-xl outline-none uppercase bg-emerald-50/30 text-emerald-950">

                <div class="flex items-center justify-center gap-2 pt-1">
                    <button type="button" onclick="activeGameSession.tebakGambarState.typedLetters = []; updateTebakGambarDisplay();" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition cursor-pointer">
                        Reset
                    </button>
                    <button type="button" onclick="submitTebakGambarAnswer()" class="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer">
                        Kirim Jawaban (+${potentialXp} XP)
                    </button>
                </div>
            </div>
        </div>
    `;
};

window.revealNextTebakGambarTile = function() {
    const state = activeGameSession.tebakGambarState;
    if (!state) return;
    if (state.revealedCount < 4) {
        state.revealedCount++;
        renderTebakGambarLayout();
        if (window.showToast) {
            window.showToast(`Bagian gambar ${state.revealedCount} & Clue ${state.revealedCount} terbuka! (Nilai sekarang: ${Math.round(state.baseXp * ((5 - state.revealedCount) / 4))} XP)`, "info");
        }
    }
};

window.updateTebakGambarDisplay = function() {
    const state = activeGameSession.tebakGambarState;
    if (!state) return;
    const inputEl = document.getElementById('tebak-gambar-input-box');
    if (inputEl) {
        inputEl.value = state.typedLetters.join('');
    }
};

window.submitTebakGambarAnswer = function() {
    const state = activeGameSession.tebakGambarState;
    if (!state) return;

    const inputEl = document.getElementById('tebak-gambar-input-box');
    const userAns = inputEl ? inputEl.value.trim().toUpperCase() : state.typedLetters.join('').trim().toUpperCase();

    if (!userAns) {
        if (window.showToast) window.showToast('Ketikkan jawabanmu terlebih dahulu!', 'warning');
        return;
    }

    const revealed = state.revealedCount;
    const baseXp = state.baseXp;
    const multiplier = (5 - revealed) / 4;
    const earnedXp = Math.max(10, Math.round(baseXp * multiplier));

    submitGameSessionAnswer(userAns, false, earnedXp);
};

// ============================================================================
// ENGINE CARI KATA (WORD SEARCH WITH CLUE & DYNAMIC GRID GENERATOR)
// ============================================================================
window.generateWordSearchGrid = function(wordsToFind) {
    const cleanWords = (Array.isArray(wordsToFind) ? wordsToFind : [])
        .map(w => String(w || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, ''))
        .filter(w => w.length > 0);

    if (cleanWords.length === 0) {
        cleanWords.push('MONITOR', 'KEYBOARD', 'MOUSE');
    }

    let maxLen = 0;
    cleanWords.forEach(w => { if (w.length > maxLen) maxLen = w.length; });

    const rows = Math.max(10, Math.min(12, maxLen + 2));
    const cols = Math.max(10, Math.min(12, maxLen + 2));

    const grid = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push('');
        }
        grid.push(row);
    }

    const directions = [
        [0, 1],   // Horizontal L->R
        [1, 0],   // Vertical T->B
        [1, 1],   // Diagonal TL->BR
        [0, -1],  // Horizontal R->L
        [-1, 0],  // Vertical B->T
        [-1, 1],  // Diagonal BL->TR
    ];

    const placedWordsInfo = [];

    cleanWords.forEach(word => {
        let placed = false;
        let attempts = 0;
        const maxAttempts = 150;

        while (!placed && attempts < maxAttempts) {
            attempts++;
            const dir = directions[Math.floor(Math.random() * directions.length)];
            const dr = dir[0];
            const dc = dir[1];

            const minR = dr < 0 ? word.length - 1 : 0;
            const maxR = dr > 0 ? rows - word.length : rows - 1;
            const minC = dc < 0 ? word.length - 1 : 0;
            const maxC = dc > 0 ? cols - word.length : cols - 1;

            if (minR > maxR || minC > maxC) continue;

            const startR = Math.floor(Math.random() * (maxR - minR + 1)) + minR;
            const startC = Math.floor(Math.random() * (maxC - minC + 1)) + minC;

            let canPlace = true;
            for (let i = 0; i < word.length; i++) {
                const r = startR + dr * i;
                const c = startC + dc * i;
                const existing = grid[r][c];
                if (existing !== '' && existing !== word[i]) {
                    canPlace = false;
                    break;
                }
            }

            if (canPlace) {
                const coords = [];
                for (let i = 0; i < word.length; i++) {
                    const r = startR + dr * i;
                    const c = startC + dc * i;
                    grid[r][c] = word[i];
                    coords.push({ r, c, char: word[i] });
                }
                placedWordsInfo.push({ word, coords });
                placed = true;
            }
        }

        if (!placed) {
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c <= cols - word.length; c++) {
                    let canPlace = true;
                    for (let i = 0; i < word.length; i++) {
                        if (grid[r][c + i] !== '' && grid[r][c + i] !== word[i]) {
                            canPlace = false;
                            break;
                        }
                    }
                    if (canPlace) {
                        const coords = [];
                        for (let i = 0; i < word.length; i++) {
                            grid[r][c + i] = word[i];
                            coords.push({ r, c: c + i, char: word[i] });
                        }
                        placedWordsInfo.push({ word, coords });
                        placed = true;
                        break;
                    }
                }
                if (placed) break;
            }
        }
    });

    const alpha = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (grid[r][c] === '') {
                grid[r][c] = alpha[Math.floor(Math.random() * alpha.length)];
            }
        }
    }

    return { grid, placedWordsInfo, words: cleanWords, rows, cols };
};

window.renderWordSearchEngineUI = function(game) {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const rawWords = Array.isArray(game.wordsToFind) && game.wordsToFind.length > 0 
        ? game.wordsToFind 
        : ['MONITOR', 'KEYBOARD', 'MOUSE'];

    const clueText = (game.hints && game.hints[0]) || game.prompt || 'Hardware Computer';
    const gridData = generateWordSearchGrid(rawWords);

    activeGameSession.wordSearchState = {
        game,
        gridData,
        clueText,
        foundWords: [],
        foundCells: [],
        selectedCells: [],
    };

    renderWordSearchLayout();
};

window.renderWordSearchLayout = function() {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const state = activeGameSession.wordSearchState;
    if (!state) return;

    const { gridData, clueText, foundWords, foundCells, selectedCells } = state;
    const { grid, words, rows, cols } = gridData;

    const totalWords = words.length;
    const foundCount = foundWords.length;
    const isAllFound = foundCount >= totalWords;

    const currentSelectedWord = selectedCells.map(cell => cell.char).join('');

    container.innerHTML = `
        <div class="space-y-4 max-w-lg mx-auto w-full animate-fade-in text-center">
            
            <!-- Clue Header Banner -->
            <div class="bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 text-white p-4 rounded-2xl shadow-md border border-purple-500/30 text-left">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] uppercase font-black bg-white/20 px-2.5 py-0.5 rounded-full tracking-wider">
                        🔍 Cari Kata (Word Search)
                    </span>
                    <span class="text-xs font-black text-purple-200 bg-black/30 px-3 py-1 rounded-xl">
                        ${foundCount} / ${totalWords} Kata Ditemukan
                    </span>
                </div>

                <div class="mt-2 space-y-0.5">
                    <span class="text-[10px] font-bold text-purple-200 block uppercase tracking-wide">Petunjuk / Clue Utama:</span>
                    <h3 class="text-base font-black text-amber-300 flex items-center gap-2">
                        <i class="fa-solid fa-lightbulb text-amber-400"></i> ${gameEscapeHtml(clueText)}
                    </h3>
                </div>
            </div>

            <!-- Target Words Status -->
            <div class="bg-purple-50 p-3.5 rounded-2xl border border-purple-200 space-y-2">
                <p class="text-xs font-bold text-slate-700 flex items-center justify-center gap-1">
                    <span>Temukan ${totalWords} kata tersembunyi berdasarkan clue di atas:</span>
                </p>
                <div class="flex items-center justify-center gap-2 flex-wrap">
                    ${words.map((w, idx) => {
                        const isFound = foundWords.includes(w);
                        return `
                            <span class="px-3 py-1.5 rounded-full text-xs font-black transition-all flex items-center gap-1.5 ${isFound ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-300' : 'bg-slate-100 text-slate-600 border border-slate-200 shadow-2xs'}">
                                <span>${isFound ? '✅ ' + w : '🔒 Kata ' + (idx + 1)}</span>
                                <span class="text-[10px] font-semibold ${isFound ? 'text-emerald-200' : 'text-slate-400'}">(${w.length} hrf)</span>
                            </span>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Currently Selected Word Box -->
            <div class="bg-slate-900 p-3 rounded-2xl border border-slate-800 flex items-center justify-between gap-2 shadow-inner">
                <div class="flex-1 text-left px-2">
                    <span class="text-[10px] text-slate-400 font-bold block uppercase">Kata Terpilih Saat Ini:</span>
                    <span class="text-sm font-black text-amber-300 tracking-widest min-h-[20px] inline-block font-mono">
                        ${currentSelectedWord || '<span class="text-slate-600 font-sans text-xs italic font-normal">Tekan huruf pada papan untuk membentuk kata...</span>'}
                    </span>
                </div>
                ${selectedCells.length > 0 ? `
                    <div class="flex items-center gap-1">
                        <button type="button" onclick="clearWordSearchSelection()" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer">
                            Reset
                        </button>
                        <button type="button" onclick="checkSelectedWordSearch()" class="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs rounded-xl shadow-md transition cursor-pointer">
                            Cek Kata
                        </button>
                    </div>
                ` : ''}
            </div>

            <!-- Interactive Letter Grid -->
            <div class="bg-slate-950 p-3.5 rounded-3xl border-4 border-slate-800 shadow-xl max-w-sm mx-auto">
                <div class="grid gap-1" style="grid-template-columns: repeat(${cols}, minmax(0, 1fr));">
                    ${grid.flatMap((rowArr, r) => rowArr.map((char, c) => {
                        const cellKey = `${r}-${c}`;
                        const isFound = foundCells.includes(cellKey);
                        const isSelected = selectedCells.some(cell => cell.r === r && cell.c === c);

                        let btnClass = "aspect-square w-full font-black text-xs sm:text-sm rounded-lg transition-all duration-150 cursor-pointer flex items-center justify-center select-none ";
                        
                        if (isFound) {
                            btnClass += "bg-emerald-500 text-white font-extrabold shadow-md ring-2 ring-emerald-300 animate-pulse";
                        } else if (isSelected) {
                            btnClass += "bg-amber-400 text-slate-950 font-extrabold scale-105 shadow-md ring-2 ring-amber-300";
                        } else {
                            btnClass += "bg-slate-800 hover:bg-slate-700 text-slate-200 active:scale-95";
                        }

                        return `
                            <button type="button" onclick="toggleSelectWordSearchCell(${r}, ${c})" class="${btnClass}">
                                ${char}
                            </button>
                        `;
                    })).join('')}
                </div>
            </div>

            <!-- Action Area -->
            <div class="pt-2">
                ${isAllFound ? `
                    <div class="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl text-emerald-900 space-y-2">
                        <div class="text-sm font-black flex items-center justify-center gap-2 text-emerald-700">
                            <span>🎉 SELAMAT! SEMUA KATA TERSEMBUNYI BERHASIL DITEMUKAN!</span>
                        </div>
                        <p class="text-xs font-semibold text-emerald-800">Kamu mendapatkan poin penuh +${state.game.rewardXp || 120} XP!</p>
                        <button type="button" onclick="submitGameSessionAnswer('COMPLETED', true)" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg transition cursor-pointer inline-flex items-center gap-2">
                            <span>🚀 Klaim Hasil & Selesaikan Game</span>
                        </button>
                    </div>
                ` : `
                    <button type="button" onclick="submitGameSessionAnswer('INCOMPLETE', ${foundCount === totalWords})" class="px-6 py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-xl shadow-md transition cursor-pointer">
                        Selesaikan Game (${foundCount}/${totalWords} Kata)
                    </button>
                `}
            </div>
        </div>
    `;
};

window.toggleSelectWordSearchCell = function(r, c) {
    const state = activeGameSession.wordSearchState;
    if (!state) return;

    const cellKey = `${r}-${c}`;
    if (state.foundCells.includes(cellKey)) {
        if (window.showToast) window.showToast('Huruf ini sudah menjadi bagian dari kata yang kamu temukan!', 'info');
        return;
    }

    const char = state.gridData.grid[r][c];

    const existingIdx = state.selectedCells.findIndex(cell => cell.r === r && cell.c === c);
    if (existingIdx >= 0) {
        if (existingIdx === state.selectedCells.length - 1) {
            state.selectedCells.pop();
        } else {
            state.selectedCells = state.selectedCells.slice(0, existingIdx);
        }
    } else {
        state.selectedCells.push({ r, c, char });
    }

    renderWordSearchLayout();
    checkSelectedWordSearch(true);
};

window.clearWordSearchSelection = function() {
    const state = activeGameSession.wordSearchState;
    if (!state) return;
    state.selectedCells = [];
    renderWordSearchLayout();
};

window.checkSelectedWordSearch = function(isSilent = false) {
    const state = activeGameSession.wordSearchState;
    if (!state || state.selectedCells.length === 0) return;

    const formedWord = state.selectedCells.map(c => c.char).join('');
    const reversedFormedWord = formedWord.split('').reverse().join('');

    const targetWords = state.gridData.words;
    
    let matchedWord = null;
    targetWords.forEach(w => {
        if (!state.foundWords.includes(w)) {
            if (formedWord === w || reversedFormedWord === w) {
                matchedWord = w;
            }
        }
    });

    if (matchedWord) {
        state.foundWords.push(matchedWord);
        
        state.selectedCells.forEach(cell => {
            const key = `${cell.r}-${cell.c}`;
            if (!state.foundCells.includes(key)) {
                state.foundCells.push(key);
            }
        });

        state.selectedCells = [];

        if (window.showToast) {
            window.showToast(`✨ Hore! Kamu menemukan kata '${matchedWord}'!`, 'success');
        }

        renderWordSearchLayout();

        if (state.foundWords.length >= targetWords.length) {
            if (window.showToast) {
                window.showToast('🏆 Luar biasa! Semua kata tersembunyi berhasil ditemukan!', 'success');
            }
        }
    } else if (!isSilent) {
        if (window.showToast) {
            window.showToast(`Kata '${formedWord}' belum tepat. Coba susun huruf kembali!`, 'warning');
        }
    }
};

// ============================================================================
// ENGINE MEMORY MATCH (KARTU MEMORI FLIP MATCHING)
// ============================================================================
window.renderMemoryMatchEngineUI = function(game) {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const rawPairs = Array.isArray(game.pairs) && game.pairs.length > 0 
        ? game.pairs 
        : [
            { term: 'CPU', match: 'Otak Utama Komputer' },
            { term: 'KEYBOARD', match: 'Alat Papan Ketik' },
            { term: 'MONITOR', match: 'Layar Tampilan Visual' },
            { term: 'PRINTER', match: 'Pencetak Dokumen' }
        ];

    const rawCards = [];
    rawPairs.forEach((pair, pairIdx) => {
        const termText = String(pair.term || '').trim();
        const matchText = String(pair.match || '').trim();
        if (termText && matchText) {
            rawCards.push({ id: `term_${pairIdx}`, text: termText, cardType: 'Istilah', pairId: pairIdx });
            rawCards.push({ id: `match_${pairIdx}`, text: matchText, cardType: 'Definisi', pairId: pairIdx });
        }
    });

    if (rawCards.length === 0) {
        rawCards.push(
            { id: 'term_0', text: 'CPU', cardType: 'Istilah', pairId: 0 },
            { id: 'match_0', text: 'Otak Utama Komputer', cardType: 'Definisi', pairId: 0 },
            { id: 'term_1', text: 'KEYBOARD', cardType: 'Istilah', pairId: 1 },
            { id: 'match_1', text: 'Alat Papan Ketik', cardType: 'Definisi', pairId: 1 }
        );
    }

    const shuffledCards = rawCards.sort(() => Math.random() - 0.5).map((c, index) => ({
        idx: index,
        id: c.id,
        text: c.text,
        cardType: c.cardType,
        pairId: c.pairId,
        isFlipped: false,
        isMatched: false
    }));

    activeGameSession.memoryMatchState = {
        game,
        cards: shuffledCards,
        pairsCount: Math.floor(rawCards.length / 2),
        selectedIndices: [],
        isLock: false,
        attempts: 0,
        matchedPairsCount: 0
    };

    renderMemoryMatchLayout();
};

window.renderMemoryMatchLayout = function() {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const state = activeGameSession.memoryMatchState;
    if (!state) return;

    const { game, cards, pairsCount, attempts, matchedPairsCount } = state;
    const isCompleted = matchedPairsCount >= pairsCount;

    container.innerHTML = `
        <div class="space-y-5 max-w-lg mx-auto w-full animate-fade-in text-center">
            
            <!-- Header Scoreboard & Instruction -->
            <div class="bg-gradient-to-r from-pink-600 via-rose-600 to-purple-700 text-white p-4 rounded-2xl shadow-md border border-pink-400/30 text-left flex items-center justify-between">
                <div>
                    <span class="text-[10px] uppercase font-black bg-white/20 px-2.5 py-0.5 rounded-full tracking-wider inline-block mb-1">
                        🧠 Memory Match (Kartu Memori)
                    </span>
                    <h3 class="text-sm font-black text-amber-200">${gameEscapeHtml(game.title || 'Cocokkan Kartu Memori')}</h3>
                    <p class="text-xs text-pink-100 font-medium mt-0.5">${gameEscapeHtml(game.prompt || 'Balikkan 2 kartu untuk menemukan pasangan istilah dan definisi!')}</p>
                </div>
                <div class="text-right space-y-1">
                    <span class="text-[10px] text-pink-200 font-bold block uppercase">Pasangan</span>
                    <span class="text-sm font-black text-amber-300 bg-black/30 px-3 py-1 rounded-xl inline-block border border-amber-300/30">
                        ${matchedPairsCount} / ${pairsCount}
                    </span>
                    <span class="text-[10px] text-pink-200 block font-semibold">Mencoba: ${attempts}x</span>
                </div>
            </div>

            <!-- Memory Card Grid -->
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
                ${cards.map((c, idx) => {
                    if (c.isMatched) {
                        return `
                            <div class="min-h-[100px] p-3 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white border-2 border-emerald-300 flex flex-col items-center justify-center text-center shadow-md scale-98 transition-all">
                                <span class="text-[9px] font-black uppercase tracking-wider bg-black/20 px-2 py-0.5 rounded-full mb-1 text-emerald-100">
                                    ✓ ${c.cardType}
                                </span>
                                <span class="text-xs font-black leading-tight">${c.text}</span>
                            </div>
                        `;
                    } else if (c.isFlipped) {
                        return `
                            <div class="min-h-[100px] p-3 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 text-white border-2 border-amber-400 flex flex-col items-center justify-center text-center shadow-lg scale-102 transition-all">
                                <span class="text-[9px] font-black uppercase tracking-wider bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full mb-1">
                                    ${c.cardType}
                                </span>
                                <span class="text-xs font-black leading-tight text-amber-200">${c.text}</span>
                            </div>
                        `;
                    } else {
                        return `
                            <button type="button" onclick="handleMemoryCardClick(${idx})" class="min-h-[100px] p-3 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 text-slate-300 border-2 border-slate-700 hover:border-pink-500/50 flex flex-col items-center justify-center text-center shadow-md transition-all duration-200 cursor-pointer active:scale-95 group">
                                <span class="text-2xl mb-1 group-hover:scale-110 transition-transform">🎴</span>
                                <span class="text-[10px] font-extrabold text-slate-400 group-hover:text-pink-300">Kartu #${idx + 1}</span>
                            </button>
                        `;
                    }
                }).join('')}
            </div>

            <!-- Controls & Completion -->
            <div class="pt-2">
                ${isCompleted ? `
                    <div class="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl text-emerald-900 space-y-2 animate-bounce-short">
                        <div class="text-sm font-black text-emerald-800 flex items-center justify-center gap-2">
                            <span>🎉 SEMUA KARTU MEMORI BERHASIL DICOCOKKAN!</span>
                        </div>
                        <p class="text-xs font-semibold text-emerald-700">Kamu menyelesaikan seluruh ${pairsCount} pasangan kartu dalam ${attempts}x percobaan!</p>
                        <button type="button" onclick="submitGameSessionAnswer('COMPLETED', true)" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg transition cursor-pointer inline-flex items-center gap-2">
                            <span>🚀 Klaim XP (+${game.rewardXp || 100} XP)</span>
                        </button>
                    </div>
                ` : `
                    <div class="flex items-center justify-center gap-3">
                        <button type="button" onclick="renderMemoryMatchEngineUI(activeGameSession.memoryMatchState.game)" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer">
                            🔄 Kocok & Ulangi
                        </button>
                    </div>
                `}
            </div>
        </div>
    `;
};

window.handleMemoryCardClick = function(cardIdx) {
    const state = activeGameSession.memoryMatchState;
    if (!state || state.isLock) return;

    const card = state.cards[cardIdx];
    if (!card || card.isMatched || card.isFlipped) return;

    card.isFlipped = true;
    state.selectedIndices.push(cardIdx);

    renderMemoryMatchLayout();

    if (state.selectedIndices.length === 2) {
        state.isLock = true;
        state.attempts++;

        const [idx1, idx2] = state.selectedIndices;
        const card1 = state.cards[idx1];
        const card2 = state.cards[idx2];

        if (card1.pairId === card2.pairId) {
            setTimeout(() => {
                card1.isMatched = true;
                card2.isMatched = true;
                state.selectedIndices = [];
                state.isLock = false;
                state.matchedPairsCount++;

                if (window.showToast) {
                    window.showToast('✨ Pasangan Cocok!', 'success');
                }

                renderMemoryMatchLayout();

                if (state.matchedPairsCount >= state.pairsCount) {
                    if (window.showToast) {
                        window.showToast('🏆 Luar biasa! Semua kartu memori berhasil dicocokkan!', 'success');
                    }
                }
            }, 300);
        } else {
            setTimeout(() => {
                card1.isFlipped = false;
                card2.isFlipped = false;
                state.selectedIndices = [];
                state.isLock = false;

                renderMemoryMatchLayout();
            }, 900);
        }
    }
};

// ============================================================================
// ENGINE PUZZLE GAMBAR (3x3 IMAGE PUZZLE SWAPPER)
// ============================================================================
window.renderImagePuzzleEngineUI = function(game) {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const imageUrl = game.imageUrl || 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=800&q=80';

    // Shuffle 9 tiles (0..8)
    let board = [0, 1, 2, 3, 4, 5, 6, 7, 8].sort(() => Math.random() - 0.5);
    while (board.every((val, idx) => val === idx)) {
        board = board.sort(() => Math.random() - 0.5);
    }

    activeGameSession.imagePuzzleState = {
        game,
        imageUrl,
        board,
        selectedIndex: null,
        moves: 0,
        isCompleted: false
    };

    renderImagePuzzleLayout();
};

window.renderImagePuzzleLayout = function() {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const state = activeGameSession.imagePuzzleState;
    if (!state) return;

    const { game, imageUrl, board, selectedIndex, moves, isCompleted } = state;

    container.innerHTML = `
        <div class="space-y-4 max-w-md mx-auto w-full animate-fade-in text-center">
            
            <!-- Header Banner with Small Reference Image in Top Corner -->
            <div class="bg-gradient-to-r from-slate-900 via-slate-800 to-zinc-900 text-white p-4 rounded-3xl shadow-xl border border-slate-700/80 text-left flex items-center justify-between gap-3">
                <div class="flex-1 space-y-1">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] uppercase font-black bg-lime-400 text-slate-950 px-2.5 py-0.5 rounded-full tracking-wider">
                            🧩 Puzzle Gambar (3x3 Grid)
                        </span>
                        <span class="text-[10px] font-bold text-amber-300 bg-black/40 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                            Langkah: ${moves}x
                        </span>
                    </div>
                    <h3 class="text-sm font-black text-white">${gameEscapeHtml(game.title || 'Susun Gambar Utuh')}</h3>
                    <p class="text-[11px] text-slate-300 font-medium leading-tight">
                        ${gameEscapeHtml(game.prompt || 'Klik 1 bagian gambar lalu klik bagian lain untuk bertukar posisi!')}
                    </p>
                </div>

                <!-- Acuan Gambar Utuh Kecil di Pojok Atas -->
                <div class="flex flex-col items-center shrink-0 bg-slate-950/80 p-2 rounded-2xl border border-lime-400/50 shadow-inner group cursor-pointer" onclick="showReferenceImageModal('${imageUrl}')" title="Klik untuk memperbesar acuan gambar">
                    <span class="text-[8px] font-extrabold text-lime-300 uppercase tracking-widest mb-1 block">
                        🔍 Acuan Gambar
                    </span>
                    <img src="${imageUrl}" class="w-14 h-14 object-cover rounded-xl border border-lime-400 shadow-sm group-hover:scale-105 transition-transform">
                </div>
            </div>

            <!-- Instruction Hint -->
            <div class="bg-lime-50 p-3 rounded-2xl border border-lime-200 text-xs font-bold text-lime-950 flex items-center justify-between">
                <span class="flex items-center gap-1.5">
                    <i class="fa-solid fa-hand-pointer text-lime-600"></i>
                    ${selectedIndex !== null 
                        ? '<span class="text-amber-700 font-black">Bagian dipilih! Klik bagian lain untuk menukarnya.</span>' 
                        : 'Klik salah satu bagian gambar untuk mulai menukar.'}
                </span>
                <button type="button" onclick="showReferenceImageModal('${imageUrl}')" class="text-[10px] bg-lime-600 hover:bg-lime-700 text-white px-2.5 py-1 rounded-lg font-black transition cursor-pointer">
                    Lihat Acuan
                </button>
            </div>

            <!-- 3x3 Tile Grid -->
            <div class="bg-slate-950 p-3.5 rounded-3xl border-4 border-slate-800 shadow-2xl max-w-xs sm:max-w-sm mx-auto">
                <div class="grid grid-cols-3 gap-1.5">
                    ${board.map((origIdx, slotIdx) => {
                        const row = Math.floor(origIdx / 3);
                        const col = origIdx % 3;
                        const bgX = col * 50;
                        const bgY = row * 50;

                        const isSelected = selectedIndex === slotIdx;
                        const isCorrectPos = origIdx === slotIdx;

                        let borderStyle = "border-slate-700/80 hover:border-lime-400";
                        if (isSelected) {
                            borderStyle = "border-amber-400 ring-4 ring-amber-300 scale-105 shadow-2xl z-20";
                        } else if (isCorrectPos) {
                            borderStyle = "border-emerald-400/90 shadow-xs";
                        }

                        return `
                            <button type="button" onclick="handleImagePuzzleTileClick(${slotIdx})" class="aspect-square w-full rounded-2xl relative overflow-hidden transition-all duration-200 border-2 ${borderStyle} cursor-pointer active:scale-95 group shadow-md" style="background-image: url('${imageUrl}'); background-size: 300% 300%; background-position: ${bgX}% ${bgY}%;">
                                ${isSelected ? `
                                    <span class="absolute inset-0 bg-amber-500/20 flex items-center justify-center">
                                        <span class="bg-amber-400 text-slate-950 text-[9px] font-black px-2 py-0.5 rounded-full shadow-md uppercase tracking-wider">
                                            Dipilih
                                        </span>
                                    </span>
                                ` : ''}
                                ${isCorrectPos && !isCompleted ? `
                                    <span class="absolute top-1 right-1 w-3.5 h-3.5 bg-emerald-500 text-white text-[8px] font-black rounded-full flex items-center justify-center shadow-xs">
                                        ✓
                                    </span>
                                ` : ''}
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>

            <!-- Controls / Completion -->
            <div class="pt-2">
                ${isCompleted ? `
                    <div class="p-4 bg-emerald-50 border-2 border-emerald-400 rounded-2xl text-emerald-900 space-y-2 animate-bounce-short">
                        <div class="text-sm font-black text-emerald-800 flex items-center justify-center gap-2">
                            <span>🎉 SELAMAT! GAMBAR BERHASIL DISUSUN SEMPURNA!</span>
                        </div>
                        <p class="text-xs font-semibold text-emerald-700">Kamu menyelesaikan puzzle 9 bagian gambar dalam ${moves}x langkah!</p>
                        <button type="button" onclick="submitGameSessionAnswer('COMPLETED', true)" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-lg transition cursor-pointer inline-flex items-center gap-2">
                            <span>🚀 Klaim XP (+${game.rewardXp || 120} XP)</span>
                        </button>
                    </div>
                ` : `
                    <div class="flex items-center justify-center gap-3">
                        <button type="button" onclick="renderImagePuzzleEngineUI(activeGameSession.imagePuzzleState.game)" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer">
                            🔄 Acak Ulang Gambar
                        </button>
                    </div>
                `}
            </div>
        </div>
    `;
};

window.handleImagePuzzleTileClick = function(slotIdx) {
    const state = activeGameSession.imagePuzzleState;
    if (!state || state.isCompleted) return;

    if (state.selectedIndex === null) {
        state.selectedIndex = slotIdx;
        renderImagePuzzleLayout();
    } else if (state.selectedIndex === slotIdx) {
        state.selectedIndex = null;
        renderImagePuzzleLayout();
    } else {
        const firstSlot = state.selectedIndex;
        const secondSlot = slotIdx;

        const temp = state.board[firstSlot];
        state.board[firstSlot] = state.board[secondSlot];
        state.board[secondSlot] = temp;

        state.selectedIndex = null;
        state.moves++;

        const isSolved = state.board.every((val, idx) => val === idx);
        if (isSolved) {
            state.isCompleted = true;
            if (window.showToast) {
                window.showToast('🎉 Luar Biasa! Gambar berhasil disusun sempurna!', 'success');
            }
        }

        renderImagePuzzleLayout();
    }
};

window.showReferenceImageModal = function(imgUrl) {
    const existing = document.getElementById('puzzle-reference-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'puzzle-reference-modal';
    overlay.className = 'fixed inset-0 bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in cursor-pointer';
    overlay.onclick = function() { overlay.remove(); };
    overlay.innerHTML = `
        <div class="bg-white p-4 rounded-3xl max-w-sm w-full shadow-2xl border-4 border-lime-400 space-y-3 text-center" onclick="event.stopPropagation()">
            <div class="flex items-center justify-between">
                <h4 class="font-extrabold text-xs uppercase text-slate-800 flex items-center gap-1.5">
                    <i class="fa-solid fa-eye text-lime-600"></i> Acuan Kunci Gambar Utuh
                </h4>
                <button type="button" onclick="document.getElementById('puzzle-reference-modal').remove()" class="text-slate-400 hover:text-slate-700 font-black text-lg cursor-pointer">&times;</button>
            </div>
            <div class="p-2 bg-slate-900 rounded-2xl border border-slate-800">
                <img src="${gameSafeImageSrc(imgUrl)}" class="w-full max-h-72 object-contain rounded-xl shadow-md">
            </div>
            <p class="text-[10px] font-bold text-slate-500">Susun 9 bagian gambar hingga persis seperti gambar acuan ini.</p>
        </div>
    `;
    document.body.appendChild(overlay);
};

// ============================================================================
// ENGINE LABIRIN BENANG KUSUT (TANGLED MAZE MATCHING WITH AVATAR ANIMATION)
// ============================================================================
window.renderLabirinEngineUI = function(game) {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    // Get prompt/soal
    const prompt = game.prompt || game.title || 'Otak komputer adalah...';

    // Get finish options at top (e.g., ['CPU', 'RAM', 'Printer'])
    let options = Array.isArray(game.options) && game.options.length > 0 
        ? game.options.filter(o => typeof o === 'string' && o.trim() !== '')
        : [];

    if (options.length === 0) {
        if (Array.isArray(game.pairs) && game.pairs.length > 0) {
            options = game.pairs.map(p => p.match || p.term).filter(Boolean);
        }
    }

    if (options.length < 2) {
        options = ['CPU', 'RAM', 'Printer'];
    }

    // Determine correct answer key
    let answerKey = game.answerKey || options[0];
    if (!options.map(o => o.trim().toUpperCase()).includes(answerKey.trim().toUpperCase())) {
        answerKey = options[0];
    }

    // Prepare top finish items
    const topFinishItems = options.map((optText, idx) => ({
        id: idx,
        text: optText,
        isCorrect: optText.trim().toUpperCase() === answerKey.trim().toUpperCase()
    }));

    // Create permuted mapping from bottom START buttons (0..N-1) to TOP finish items (0..N-1)
    const topIndicesShuffled = topFinishItems.map((_, idx) => idx).sort(() => Math.random() - 0.5);

    const startToTopMap = {};
    topIndicesShuffled.forEach((topIdx, startIdx) => {
        startToTopMap[startIdx] = topIdx;
    });

    activeGameSession.labirinState = {
        game,
        prompt,
        options,
        answerKey,
        topFinishItems,
        startToTopMap,
        activeStartIdx: null,
        animating: false,
        characterPos: null,
        activePathD: null,
        visitedStarts: {}, // { [startIdx]: { topIdx, isCorrect } }
        isCompleted: false
    };

    renderLabirinLayout();
};

window.renderLabirinLayout = function() {
    const container = document.getElementById('game-session-body');
    if (!container) return;

    const state = activeGameSession.labirinState;
    if (!state) return;

    const { game, prompt, topFinishItems, startToTopMap, animating, characterPos, activePathD, visitedStarts, isCompleted } = state;
    const totalCount = topFinishItems.length;

    container.innerHTML = `
        <div class="space-y-4 max-w-2xl mx-auto w-full animate-fade-in text-center select-none">
            
            <!-- Question Banner -->
            <div class="bg-gradient-to-r from-amber-900 via-amber-800 to-slate-900 text-white p-4.5 rounded-3xl shadow-xl border border-amber-500/40 text-left flex items-center justify-between gap-3">
                <div class="space-y-1.5 flex-1">
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] uppercase font-black bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full tracking-wider flex items-center gap-1">
                            <i class="fa-solid fa-route"></i> Labirin Benang Kusut
                        </span>
                        <span class="text-[10px] font-bold text-amber-200 bg-black/40 px-2.5 py-0.5 rounded-full border border-amber-400/30">
                            Finish: ${totalCount} Pilihan
                        </span>
                    </div>
                    <h3 class="text-xs uppercase font-extrabold text-amber-300 tracking-wider">Soal Pertanyaan:</h3>
                    <p class="text-base sm:text-lg font-black text-white leading-snug">${prompt}</p>
                </div>
                <div class="hidden sm:block text-4xl">🏃‍♂️</div>
            </div>

            <!-- Instruction Hint -->
            <div class="bg-amber-50 p-3 rounded-2xl border border-amber-200 text-xs font-bold text-amber-950 flex items-center justify-between">
                <span class="flex items-center gap-1.5 text-left">
                    <i class="fa-solid fa-compass text-amber-600 text-sm"></i>
                    <span>Telusuri benang dari <strong class="text-amber-800">START (Bawah)</strong> menuju jawaban <strong class="text-amber-800">FINISH (Atas)</strong> yang benar!</span>
                </span>
                <span class="text-[10px] bg-amber-200 text-amber-900 px-2.5 py-1 rounded-lg font-black shrink-0">
                    ${isCompleted ? '🎉 Berhasil!' : 'Pilih Jalur!'}
                </span>
            </div>

            <!-- LABIRIN BOARD CONTAINER -->
            <div class="bg-slate-900 p-4 sm:p-5 rounded-3xl border-4 border-slate-800 shadow-2xl relative overflow-hidden">
                
                <!-- BARIS ATAS (FINISH OPTIONS) -->
                <div class="mb-2 relative z-10">
                    <div class="text-[10px] font-black uppercase text-amber-400/90 tracking-widest mb-1.5 flex items-center justify-center gap-1">
                        <i class="fa-solid fa-flag-checkered text-amber-400"></i> BARIS ATAS (FINISH / PILIHAN JAWABAN)
                    </div>
                    <div class="grid gap-2.5" style="grid-template-columns: repeat(${totalCount}, minmax(0, 1fr));">
                        ${topFinishItems.map((item, topIdx) => {
                            const visitedBy = Object.entries(visitedStarts).find(([_, info]) => info.topIdx === topIdx);
                            const isCorrect = visitedBy && visitedBy[1].isCorrect;
                            const isWrong = visitedBy && !visitedBy[1].isCorrect;

                            let cardStyle = "bg-slate-800/90 text-slate-100 border-slate-700 shadow-md";
                            if (isCorrect) {
                                cardStyle = "bg-emerald-600 text-white border-emerald-300 ring-4 ring-emerald-400/50 font-black shadow-xl scale-105";
                            } else if (isWrong) {
                                cardStyle = "bg-rose-950/80 text-rose-300 border-rose-700/80 line-through opacity-80";
                            }

                            return `
                                <div class="p-3 rounded-2xl border-2 text-xs sm:text-sm font-extrabold transition-all duration-300 flex flex-col items-center justify-center gap-1 ${cardStyle}">
                                    <span class="text-[9px] uppercase tracking-wider font-black text-amber-300/80">Finish #${topIdx + 1}</span>
                                    <span class="line-clamp-2">${item.text}</span>
                                    ${isCorrect ? '<span class="text-[10px] bg-emerald-950 text-emerald-300 px-2 py-0.5 rounded-full font-black border border-emerald-400">✓ BENAR!</span>' : ''}
                                    ${isWrong ? '<span class="text-[9px] text-rose-400 font-bold">❌ Salah</span>' : ''}
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <!-- MIDDLE SVG CANVAS (TANGLED THREADS / BENANG KUSUT) -->
                <div class="relative w-full h-48 sm:h-56 bg-slate-950 rounded-2xl border border-slate-800/80 my-3 overflow-hidden shadow-inner">
                    <svg id="labirin-svg" class="w-full h-full absolute inset-0 pointer-events-none" viewBox="0 0 500 200" preserveAspectRatio="none">
                        
                        <!-- Ambient Tangled Thread Lines -->
                        ${Object.entries(startToTopMap).map(([startStr, topIdx]) => {
                            const startIdx = parseInt(startStr, 10);
                            const startX = ((startIdx + 0.5) / totalCount) * 500;
                            const topX = ((topIdx + 0.5) / totalCount) * 500;

                            const cX1 = startX + (startIdx % 2 === 0 ? 70 : -70);
                            const cX2 = topX + (topIdx % 2 === 0 ? -70 : 70);

                            const visitedInfo = visitedStarts[startIdx];
                            const isVisitedCorrect = visitedInfo && visitedInfo.isCorrect;
                            const isVisitedWrong = visitedInfo && !visitedInfo.isCorrect;

                            let strokeColor = "#334155";
                            let strokeWidth = "2";
                            let dashArray = "4,4";
                            let opacity = "0.45";

                            if (isVisitedCorrect) {
                                strokeColor = "#10b981";
                                strokeWidth = "4";
                                dashArray = "none";
                                opacity = "1";
                            } else if (isVisitedWrong) {
                                strokeColor = "#f43f5e";
                                strokeWidth = "2.5";
                                dashArray = "none";
                                opacity = "0.6";
                            }

                            return `
                                <path 
                                    d="M ${startX},190 C ${cX1},130 ${cX2},70 ${topX},10" 
                                    fill="none" 
                                    stroke="${strokeColor}" 
                                    stroke-width="${strokeWidth}" 
                                    stroke-dasharray="${dashArray}" 
                                    opacity="${opacity}" 
                                />
                            `;
                        }).join('')}

                        <!-- Active Animating Path -->
                        ${activePathD ? `
                            <path 
                                d="${activePathD}" 
                                fill="none" 
                                stroke="#f59e0b" 
                                stroke-width="5" 
                                stroke-linecap="round"
                                class="animate-pulse"
                            />
                        ` : ''}
                    </svg>

                    <!-- ANIMATED RUNNING AVATAR CHARACTER -->
                    ${characterPos ? `
                        <div class="absolute z-30 transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75 pointer-events-none"
                             style="left: ${characterPos.x}%; top: ${characterPos.y}%;">
                            <div class="bg-amber-400 text-slate-950 p-2 rounded-full shadow-2xl border-2 border-white text-base sm:text-xl animate-bounce flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12">
                                🏃‍♂️
                            </div>
                        </div>
                    ` : ''}

                    <!-- Center Label / Prompt -->
                    ${!animating && Object.keys(visitedStarts).length === 0 ? `
                        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <span class="bg-slate-900/90 text-amber-300 border border-amber-500/30 text-[11px] font-black px-4 py-1.5 rounded-full shadow-lg backdrop-blur-xs flex items-center gap-2">
                                <i class="fa-solid fa-route animate-spin"></i> Benang Kusut Siap Ditelusuri Dari Bawah!
                            </span>
                        </div>
                    ` : ''}
                </div>

                <!-- BARIS BAWAH (START BUTTONS) -->
                <div class="mt-2 relative z-10">
                    <div class="text-[10px] font-black uppercase text-amber-400/90 tracking-widest mb-1.5 flex items-center justify-center gap-1">
                        <i class="fa-solid fa-play text-amber-400"></i> BARIS BAWAH (START / PILIH JALUR MULTI-START)
                    </div>
                    <div class="grid gap-2.5" style="grid-template-columns: repeat(${totalCount}, minmax(0, 1fr));">
                        ${topFinishItems.map((_, startIdx) => {
                            const visited = visitedStarts[startIdx];
                            const isCorrect = visited && visited.isCorrect;
                            const isWrong = visited && !visited.isCorrect;

                            let btnStyle = "bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-300 font-black shadow-lg hover:scale-105";
                            if (isCorrect) {
                                btnStyle = "bg-emerald-600 text-white border-emerald-300 font-black shadow-md cursor-default";
                            } else if (isWrong) {
                                btnStyle = "bg-slate-800 text-slate-400 border-slate-700 opacity-60 cursor-default";
                            }

                            return `
                                <button type="button" 
                                    onclick="handleLabirinStartClick(${startIdx})"
                                    ${visited || animating || isCompleted ? 'disabled' : ''}
                                    class="p-3 rounded-2xl border-2 text-xs font-extrabold transition-all duration-200 flex flex-col items-center justify-center gap-1 cursor-pointer ${btnStyle}">
                                    <span class="text-[9px] uppercase tracking-wider text-slate-900/80 font-black">START #${startIdx + 1}</span>
                                    <span class="line-clamp-1">🚀 Jalur ${startIdx + 1}</span>
                                    ${isCorrect ? '<span class="text-[9px] text-emerald-200 font-bold">✓ Tepat!</span>' : ''}
                                    ${isWrong ? '<span class="text-[9px] text-rose-400 font-bold">❌ Salah</span>' : ''}
                                </button>
                            `;
                        }).join('')}
                    </div>
                </div>

            </div>

            <!-- Footer / Claim XP Banner -->
            <div class="pt-2">
                ${isCompleted ? `
                    <div class="p-5 bg-emerald-50 border-2 border-emerald-400 rounded-3xl text-emerald-900 space-y-3 animate-bounce-short shadow-xl">
                        <div class="text-base font-black text-emerald-800 flex items-center justify-center gap-2">
                            <span>🎉 SELAMAT! KAMU MENEMUKAN JALUR JAWABAN BENAR!</span>
                        </div>
                        <p class="text-xs font-semibold text-emerald-700">Karakter berhasil menelusuri benang kusut menuju <strong>"${state.answerKey}"</strong>!</p>
                        <button type="button" onclick="submitGameSessionAnswer('COMPLETED', true)" class="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-2xl shadow-lg transition cursor-pointer inline-flex items-center gap-2">
                            <span>🚀 Klaim Rewards (+${game.rewardXp || 150} XP)</span>
                        </button>
                    </div>
                ` : `
                    <div class="flex items-center justify-center gap-3">
                        <button type="button" onclick="renderLabirinEngineUI(activeGameSession.labirinState.game)" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl transition cursor-pointer flex items-center gap-1.5">
                            <i class="fa-solid fa-arrows-rotate"></i> Acak Ulang Jalur Benang
                        </button>
                    </div>
                `}
            </div>

        </div>
    `;
};

window.handleLabirinStartClick = function(startIdx) {
    const state = activeGameSession.labirinState;
    if (!state || state.animating || state.visitedStarts[startIdx] || state.isCompleted) return;

    const topIdx = state.startToTopMap[startIdx];
    const targetItem = state.topFinishItems[topIdx];
    const isCorrect = targetItem.isCorrect;

    state.animating = true;
    state.activeStartIdx = startIdx;

    // SVG coordinates (0..500 for X, 0..200 for Y)
    const totalCount = state.topFinishItems.length;
    const startX = ((startIdx + 0.5) / totalCount) * 500;
    const topX = ((topIdx + 0.5) / totalCount) * 500;

    const cX1 = startX + (startIdx % 2 === 0 ? 70 : -70);
    const cX2 = topX + (topIdx % 2 === 0 ? -70 : 70);

    state.activePathD = `M ${startX},190 C ${cX1},130 ${cX2},70 ${topX},10`;

    // Percentage coordinates for avatar position
    const pStartPct = { x: ((startIdx + 0.5) / totalCount) * 100, y: 95 };
    const pTopPct = { x: ((topIdx + 0.5) / totalCount) * 100, y: 5 };
    const pCX1Pct = { x: pStartPct.x + (startIdx % 2 === 0 ? 15 : -15), y: 65 };
    const pCX2Pct = { x: pTopPct.x + (topIdx % 2 === 0 ? -15 : 15), y: 35 };

    function getCubicBezierPoint(t, p0, p1, p2, p3) {
        const u = 1 - t;
        const tt = t * t;
        const uu = u * u;
        const uuu = uu * u;
        const ttt = tt * t;

        let x = uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x;
        let y = uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y;
        return { x, y };
    }

    let startTime = null;
    const duration = 1400; // 1.4s animation

    function step(timestamp) {
        if (!startTime) startTime = timestamp;
        const elapsed = timestamp - startTime;
        let progress = Math.min(elapsed / duration, 1);

        const point = getCubicBezierPoint(progress, pStartPct, pCX1Pct, pCX2Pct, pTopPct);
        state.characterPos = point;

        renderLabirinLayout();

        if (progress < 1) {
            requestAnimationFrame(step);
        } else {
            setTimeout(() => {
                state.visitedStarts[startIdx] = { topIdx, isCorrect };

                if (isCorrect) {
                    state.isCompleted = true;
                    if (window.showToast) window.showToast(`🎉 HORE! Jalur Start ${startIdx + 1} menuntun kamu ke "${targetItem.text}" (JAWABAN BENAR)!`, 'success');
                } else {
                    if (window.showToast) window.showToast(`❌ Jalur Start ${startIdx + 1} mengarah ke "${targetItem.text}" (KURANG TEPAT). Coba telusuri jalur Start lainnya!`, 'warning');
                }

                state.animating = false;
                state.characterPos = null;
                state.activePathD = null;

                renderLabirinLayout();
            }, 300);
        }
    }

    requestAnimationFrame(step);
};

// ============================================================================
// GAME MONITORING DASHBOARD (LIVE GAME MONITORING - MIRRORING CBT MONITORING)
// ============================================================================
let gameMonitoringPollTimer = null;

window.openGameMonitoringDashboardModal = function() {
    window.__adminGameSubTab = 'monitoring';

    if (!appState.gameMonitoringClassId) appState.gameMonitoringClassId = 'all';
    if (!appState.gameMonitoringGameId) appState.gameMonitoringGameId = 'all';
    if (!appState.gameMonitoringStatus) appState.gameMonitoringStatus = 'all';
    if (!appState.gameMonitoringSearch) appState.gameMonitoringSearch = '';
    if (!appState.gameMonitoringLivecamMode) appState.gameMonitoringLivecamMode = 'gambar';
    if (!appState.gameMonitoringStudentModes) appState.gameMonitoringStudentModes = {};

    const viewContainer = document.getElementById('view-container');
    if (viewContainer) {
        renderGameAdminModule(viewContainer);
    } else {
        renderGameMonitoringDashboard();
    }
};

window.closeGameMonitoringDashboardModal = function() {
    if (gameMonitoringPollTimer) {
        clearInterval(gameMonitoringPollTimer);
        gameMonitoringPollTimer = null;
    }
    window.__adminGameSubTab = 'kelola';
    const viewContainer = document.getElementById('view-container');
    if (viewContainer) {
        renderGameAdminModule(viewContainer);
    } else {
        const modalContainer = document.getElementById('modal-container');
        if (modalContainer) modalContainer.innerHTML = '';
    }
};

window.toggleGameMonitoringLivecamMode = function() {
    const targetMode = (appState.gameMonitoringLivecamMode || 'gambar') === 'gambar' ? 'video' : 'gambar';
    if (targetMode === 'video') {
        if (typeof window.promptVideoDurationAndDeductTokens === 'function') {
            window.promptVideoDurationAndDeductTokens((minutes) => {
                appState.gameMonitoringLivecamMode = 'video';
                if (typeof window.openGameMonitoringDashboardModal === 'function') {
                    window.openGameMonitoringDashboardModal();
                } else {
                    renderGameMonitoringDashboard();
                }
            });
        } else {
            appState.gameMonitoringLivecamMode = 'video';
            renderGameMonitoringDashboard();
        }
    } else {
        appState.gameMonitoringLivecamMode = 'gambar';
        renderGameMonitoringDashboard();
        showToast("Mode kamera diubah ke: Foto Absen", "info");
    }
};

window.toggleStudentGameLivecamMode = function(studentId) {
    if (!appState.gameMonitoringStudentModes) appState.gameMonitoringStudentModes = {};
    const cur = appState.gameMonitoringStudentModes[studentId] || appState.gameMonitoringLivecamMode || 'gambar';
    const targetMode = cur === 'video' ? 'gambar' : 'video';
    if (targetMode === 'video') {
        if (typeof window.promptVideoDurationAndDeductTokens === 'function') {
            window.promptVideoDurationAndDeductTokens((minutes) => {
                appState.gameMonitoringStudentModes[studentId] = 'video';
                if (typeof window.openGameMonitoringDashboardModal === 'function') {
                    window.openGameMonitoringDashboardModal();
                } else {
                    renderGameMonitoringDashboard();
                }
            });
        } else {
            appState.gameMonitoringStudentModes[studentId] = 'video';
            renderGameMonitoringDashboard();
        }
    } else {
        appState.gameMonitoringStudentModes[studentId] = 'gambar';
        renderGameMonitoringDashboard();
    }
};

window.refreshGameMonitoringData = async function(showToastNotice = true) {
    await renderGameMonitoringDashboard();
    if (showToastNotice) showToast("Data monitoring game diperbarui", "success");
};

window.renderGameMonitoringDashboard = async function() {
    const container = document.getElementById('game-monitoring-content');
    if (!container) return;

    const students = Array.isArray(appState.students) ? appState.students : [];
    const classes = Array.isArray(appState.classes) ? appState.classes : [];
    const games = Array.isArray(appState.eduGames) ? appState.eduGames : [];

    // Fetch active game sessions from server
    let serverSessions = {};
    try {
        const res = await fetch('/api/game/active-sessions');
        const data = await res.json();
        serverSessions = data.sessions || {};
    } catch (e) {}

    const localSessions = JSON.parse(localStorage.getItem('madrasah_active_game_sessions') || '{}');
    const mergedSessions = { ...localSessions, ...serverSessions };

    // Filter students by class
    let filteredStudents = students;
    if (appState.gameMonitoringClassId && appState.gameMonitoringClassId !== 'all') {
        filteredStudents = filteredStudents.filter(s => 
            String(s.classId) === String(appState.gameMonitoringClassId) || 
            String(s.className) === String(appState.gameMonitoringClassId)
        );
    }

    // Filter by game
    if (appState.gameMonitoringGameId && appState.gameMonitoringGameId !== 'all') {
        filteredStudents = filteredStudents.filter(s => {
            const sess = mergedSessions[s.id] || mergedSessions[String(s.id)];
            return sess && String(sess.gameId) === String(appState.gameMonitoringGameId);
        });
    }

    // Filter by status
    if (appState.gameMonitoringStatus && appState.gameMonitoringStatus !== 'all') {
        filteredStudents = filteredStudents.filter(s => {
            const sess = mergedSessions[s.id] || mergedSessions[String(s.id)];
            const isOnlineApp = s.isOnline || (s.lastActive && (Date.now() - new Date(s.lastActive).getTime() < 300000));
            if (appState.gameMonitoringStatus === 'online') return isOnlineApp;
            if (appState.gameMonitoringStatus === 'playing') return sess && sess.status === 'playing';
            if (appState.gameMonitoringStatus === 'completed') return sess && sess.status === 'completed';
            if (appState.gameMonitoringStatus === 'idle') return !sess || sess.status !== 'playing';
            return true;
        });
    }

    // Filter by search query
    if (appState.gameMonitoringSearch && appState.gameMonitoringSearch.trim() !== '') {
        const q = appState.gameMonitoringSearch.toLowerCase().trim();
        filteredStudents = filteredStudents.filter(s => 
            (s.name && s.name.toLowerCase().includes(q)) || 
            (s.nis && String(s.nis).toLowerCase().includes(q))
        );
    }

    // Compute stats
    const totalStudents = students.length;
    const onlineAppCount = students.filter(s => s.isOnline || (s.lastActive && (Date.now() - new Date(s.lastActive).getTime() < 300000))).length;
    const playingCount = Object.values(mergedSessions).filter(s => s && s.status === 'playing').length;
    const completedCount = Object.values(mergedSessions).filter(s => s && s.status === 'completed').length;
    const totalXpEarned = students.reduce((acc, s) => acc + (Number(s.gameXp) || 0), 0);

    container.innerHTML = `
        <!-- Top Stats Row -->
        <div class="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div class="bg-slate-950/80 p-4 rounded-2xl border border-slate-800 shadow-sm">
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Siswa</span>
                <span class="text-xl sm:text-2xl font-black text-white mt-1 block">${totalStudents}</span>
            </div>
            <div class="bg-slate-950/80 p-4 rounded-2xl border border-emerald-900/40 shadow-sm">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">Login Aplikasi</span>
                    <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <span class="text-xl sm:text-2xl font-black text-emerald-300 mt-1 block">${onlineAppCount}</span>
            </div>
            <div class="bg-slate-950/80 p-4 rounded-2xl border border-indigo-900/40 shadow-sm">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold text-indigo-400 uppercase tracking-wider block">Sedang Main</span>
                    <span class="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping"></span>
                </div>
                <span class="text-xl sm:text-2xl font-black text-indigo-300 mt-1 block">${playingCount}</span>
            </div>
            <div class="bg-slate-950/80 p-4 rounded-2xl border border-amber-900/40 shadow-sm">
                <span class="text-[10px] font-bold text-amber-400 uppercase tracking-wider block">Game Selesai</span>
                <span class="text-xl sm:text-2xl font-black text-amber-300 mt-1 block">${completedCount}</span>
            </div>
            <div class="bg-slate-950/80 p-4 rounded-2xl border border-purple-900/40 shadow-sm col-span-2 sm:col-span-1">
                <span class="text-[10px] font-bold text-purple-400 uppercase tracking-wider block">Total Akumulasi XP</span>
                <span class="text-xl sm:text-2xl font-black text-purple-300 mt-1 block">${totalXpEarned} XP</span>
            </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="bg-slate-950/90 p-4 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 shadow-md">
            <div class="flex items-center gap-2 flex-wrap flex-1">
                <!-- Class filter -->
                <div class="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                    <i class="fa-solid fa-graduation-cap text-indigo-400 text-xs"></i>
                    <select onchange="appState.gameMonitoringClassId = this.value; renderGameMonitoringDashboard();" class="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer">
                        <option value="all" class="bg-slate-900 text-white">🌟 Semua Kelas</option>
                        ${classes.map(c => `<option value="${gameEscapeAttr(c.id || c.name)}" ${String(appState.gameMonitoringClassId) === String(c.id || c.name) ? 'selected' : ''} class="bg-slate-900 text-white">${gameEscapeHtml(c.name || c.className || c.id)}</option>`).join('')}
                    </select>
                </div>

                <!-- Game filter -->
                <div class="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                    <i class="fa-solid fa-gamepad text-emerald-400 text-xs"></i>
                    <select onchange="appState.gameMonitoringGameId = this.value; renderGameMonitoringDashboard();" class="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer">
                        <option value="all" class="bg-slate-900 text-white">🎮 Semua Game</option>
                        ${games.map(g => `<option value="${gameEscapeAttr(g.id)}" ${String(appState.gameMonitoringGameId) === String(g.id) ? 'selected' : ''} class="bg-slate-900 text-white">${gameEscapeHtml(g.title)}</option>`).join('')}
                    </select>
                </div>

                <!-- Status filter -->
                <div class="flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-xl border border-slate-800">
                    <i class="fa-solid fa-filter text-amber-400 text-xs"></i>
                    <select onchange="appState.gameMonitoringStatus = this.value; renderGameMonitoringDashboard();" class="bg-transparent text-xs font-bold text-slate-200 focus:outline-none cursor-pointer">
                        <option value="all" ${appState.gameMonitoringStatus === 'all' ? 'selected' : ''} class="bg-slate-900 text-white">Semua Status</option>
                        <option value="playing" ${appState.gameMonitoringStatus === 'playing' ? 'selected' : ''} class="bg-slate-900 text-white">🕹️ Sedang Main Game</option>
                        <option value="online" ${appState.gameMonitoringStatus === 'online' ? 'selected' : ''} class="bg-slate-900 text-white">🟢 Online Aplikasi</option>
                        <option value="completed" ${appState.gameMonitoringStatus === 'completed' ? 'selected' : ''} class="bg-slate-900 text-white">🏆 Selesai Game</option>
                        <option value="idle" ${appState.gameMonitoringStatus === 'idle' ? 'selected' : ''} class="bg-slate-900 text-white">⏳ Belum Main Game</option>
                    </select>
                </div>
            </div>

            <!-- Search input -->
            <div class="relative min-w-[200px] md:w-64">
                <i class="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs"></i>
                <input type="text" value="${gameEscapeAttr(appState.gameMonitoringSearch || '')}" oninput="appState.gameMonitoringSearch = this.value; renderGameMonitoringDashboard();" placeholder="Cari nama atau NIS siswa..." class="w-full pl-8 pr-3 py-1.5 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none">
            </div>
        </div>

        <!-- Student Cards Grid -->
        ${filteredStudents.length === 0 ? `
            <div class="bg-slate-950/60 p-12 rounded-3xl border border-slate-800 text-center space-y-3 max-w-md mx-auto shadow-sm">
                <div class="w-16 h-16 bg-slate-800 text-slate-500 rounded-full flex items-center justify-center mx-auto text-xl">
                    <i class="fa-solid fa-user-slash"></i>
                </div>
                <h4 class="font-bold text-slate-300 text-sm">Tidak Ada Siswa Terpantau</h4>
                <p class="text-xs text-slate-500">Tidak ditemukan data siswa berdasarkan filter kelas, status, atau kata kunci yang dipilih.</p>
            </div>
        ` : `
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                ${filteredStudents.map(st => {
                    const sess = mergedSessions[st.id] || mergedSessions[String(st.id)] || null;
                    const isPlaying = sess && sess.status === 'playing';
                    const isCompleted = sess && sess.status === 'completed';
                    const isOnlineApp = st.isOnline || (st.lastActive && (Date.now() - new Date(st.lastActive).getTime() < 300000));
                    
                    const stCamMode = (appState.gameMonitoringStudentModes && appState.gameMonitoringStudentModes[st.id]) 
                        ? appState.gameMonitoringStudentModes[st.id] 
                        : (appState.gameMonitoringLivecamMode || 'gambar');
                    const isVideo = stCamMode === 'video';

                    // Find student photo from attendance records or profile
                    const attRecord = (appState.attendance || []).slice().reverse().find(a => 
                        String(a.studentId || a.student_id) === String(st.id) || 
                        (st.nis && String(a.nis) === String(st.nis))
                    );
                    const attPhoto = attRecord ? (attRecord.photo || attRecord.imageUrl || attRecord.facePhoto || attRecord.photoUrl || attRecord.image) : null;
                    const studentPhoto = attPhoto || st.photo || st.facePhoto || st.image || st.avatar;

                    const studentXp = Number(st.gameXp) || (sess ? (sess.score || 0) : 0);
                    const streakCount = Number(st.dailyStreak) || 1;

                    return `
                        <div onclick="focusGameStudentLivecam(${gameInlineArg(st.id)})" class="relative bg-slate-950 text-white rounded-3xl shadow-xl flex flex-col justify-between overflow-hidden border ${
                            isPlaying ? 'border-indigo-500/80 ring-2 ring-indigo-500/30 shadow-indigo-950/50' :
                            isCompleted ? 'border-amber-500/80 ring-2 ring-amber-500/20' :
                            isOnlineApp ? 'border-emerald-500/50' : 'border-slate-800'
                        } min-h-[310px] cursor-pointer hover:scale-[1.02] transition-transform duration-300">
                            
                            <!-- Background Frame (Photo or Live WebRTC Video) -->
                            <div class="absolute inset-0 z-0 bg-slate-950 overflow-hidden">
                                ${isVideo ? (isPlaying || isOnlineApp ? `
                                    <video id="game-webrtc-video-${gameEscapeAttr(st.id)}" autoplay playsinline muted class="w-full h-full object-cover"></video>
                                    <div id="game-webrtc-fallback-${gameEscapeAttr(st.id)}" class="absolute inset-0 flex items-center justify-center pointer-events-none bg-slate-950">
                                        ${studentPhoto ? `
                                            <img src="${gameSafeImageSrc(studentPhoto)}" alt="Foto Absen" class="w-full h-full object-cover opacity-75">
                                        ` : `
                                            <div class="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900">
                                                <i class="fa-solid fa-video text-indigo-400 animate-pulse text-3xl mb-2"></i>
                                            </div>
                                        `}
                                        <div class="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-slate-950/85 backdrop-blur-md text-indigo-300 border border-indigo-500/30 text-[9px] font-bold rounded-full flex items-center space-x-1.5 shadow-lg whitespace-nowrap">
                                            <i class="fa-solid fa-circle-notch fa-spin text-indigo-400"></i>
                                            <span>Menghubungkan Live Video...</span>
                                        </div>
                                    </div>
                                ` : `
                                    <div class="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900">
                                        <i class="fa-solid fa-video-slash text-slate-700 text-3xl mb-2"></i>
                                        <span class="text-xs font-bold text-slate-500">Siswa Sedang Offline</span>
                                    </div>
                                `) : `
                                    ${studentPhoto ? `
                                        <img src="${gameSafeImageSrc(studentPhoto)}" alt="Foto Siswa" class="w-full h-full object-cover">
                                    ` : `
                                        <div class="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-slate-900">
                                            <div class="w-14 h-14 rounded-full bg-slate-800 border-2 border-slate-700 flex items-center justify-center text-slate-300 text-xl font-black uppercase mb-2 shadow">
                                                ${gameEscapeHtml(st.name ? st.name.charAt(0) : '?')}
                                            </div>
                                            <span class="text-xs text-slate-300 font-bold">${gameEscapeHtml(st.name)}</span>
                                            <span class="text-[10px] text-slate-500 mt-1 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">Foto Absensi Siswa</span>
                                        </div>
                                    `}
                                `}
                                <!-- Dark gradient overlay -->
                                <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-slate-950/80 pointer-events-none"></div>
                            </div>

                            <!-- Floating Content Overlay (Z-10) -->
                            <div class="relative z-10 p-4 flex flex-col justify-between h-full space-y-3 min-h-[310px]">
                                <!-- Top Bar: Student Name, NIS, & Online Badges -->
                                <div class="flex justify-between items-start gap-2">
                                    <div class="bg-slate-950/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 shadow-md max-w-[65%]">
                                        <span class="text-xs text-white font-black block truncate" title="${gameEscapeHtml(st.name)}">${gameEscapeHtml(st.name)}</span>
                                        <span class="text-[10px] text-slate-400 font-mono block truncate">${gameEscapeHtml(st.className || 'Kelas')} &middot; NIS: ${gameEscapeHtml(st.nis || '-')}</span>
                                    </div>

                                    <!-- Status Badges -->
                                    <div class="flex items-center space-x-1.5">
                                        <!-- App Login Indicator -->
                                        <span title="${isOnlineApp ? 'Login di Aplikasi' : 'Offline'}" class="w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-lg backdrop-blur-md ${isOnlineApp ? 'bg-emerald-500 text-slate-950 border border-emerald-300' : 'bg-slate-800/80 text-slate-500 border border-white/10'}">
                                            <i class="fa-solid fa-mobile-screen-button"></i>
                                        </span>

                                        <!-- Game Activity Indicator -->
                                        <span title="${isPlaying ? `Sedang Main: ${gameEscapeAttr(sess.gameTitle || 'Game')}` : (isCompleted ? 'Selesai Game' : 'Belum Main Game')}" class="w-7 h-7 rounded-full flex items-center justify-center text-xs shadow-lg backdrop-blur-md ${
                                            isPlaying ? 'bg-indigo-600 text-white font-bold animate-pulse border border-indigo-400' : 
                                            isCompleted ? 'bg-amber-500 text-slate-950 border border-amber-300' : 
                                            'bg-slate-800/80 text-slate-400 border border-white/10'
                                        }">
                                            <i class="fa-solid ${isPlaying ? 'fa-gamepad' : (isCompleted ? 'fa-trophy' : 'fa-hourglass-start')}"></i>
                                        </span>
                                    </div>
                                </div>

                                <!-- Middle Center Info (Game Title / Status Banner) -->
                                <div class="my-auto text-center">
                                    ${isPlaying ? `
                                        <div class="inline-block bg-indigo-950/90 border border-indigo-500/50 px-3 py-1.5 rounded-2xl backdrop-blur-md shadow-lg text-left max-w-full">
                                            <span class="text-[9px] font-black uppercase text-indigo-400 tracking-wider block">🕹️ Sedang Mengerjakan:</span>
                                            <p class="text-xs font-black text-white truncate">${gameEscapeHtml(sess.gameTitle || 'Game Edukasi')}</p>
                                            ${sess.floorName ? `<span class="text-[9px] text-amber-300 font-bold block mt-0.5">${gameEscapeHtml(sess.floorName)}</span>` : ''}
                                        </div>
                                    ` : (isCompleted ? `
                                        <div class="inline-block bg-amber-950/90 border border-amber-500/50 px-3 py-1.5 rounded-2xl backdrop-blur-md shadow-lg text-center">
                                            <span class="text-[10px] font-extrabold text-amber-300 flex items-center justify-center gap-1">
                                                <i class="fa-solid fa-trophy text-xs"></i> Game Selesai Dituntaskan
                                            </span>
                                        </div>
                                    ` : `
                                        <div class="inline-block bg-slate-950/70 border border-slate-800 px-3 py-1 rounded-xl backdrop-blur-md">
                                            <span class="text-[10px] font-bold text-slate-400">Belum Memulai Game</span>
                                        </div>
                                    `)}
                                </div>

                                <!-- Bottom Section: XP Stats & Action Controls -->
                                <div class="space-y-2 bg-slate-950/90 backdrop-blur-md p-3 rounded-2xl border border-white/10 shadow-lg">
                                    <!-- XP Score & Streak -->
                                    <div class="flex items-center justify-between text-[11px] font-extrabold border-b border-slate-800 pb-1.5">
                                        <span class="text-amber-400 flex items-center gap-1">
                                            <i class="fa-solid fa-bolt"></i> ${studentXp} XP
                                        </span>
                                        <span class="text-rose-400 font-bold text-[10px]">
                                            🔥 ${streakCount} Hari
                                        </span>
                                    </div>

                                    <!-- Action Buttons -->
                                    <div class="flex gap-1.5 pt-0.5">
                                        <!-- Send Message Button -->
                                        <button type="button" title="Kirim Pesan Langsung ke Siswa" onclick="event.stopPropagation(); openSendGameStudentMessageModal(${gameInlineArg(st.id)}, ${gameInlineArg(st.name)})" class="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow flex items-center justify-center cursor-pointer transition">
                                            <i class="fa-solid fa-comment-dots"></i>
                                        </button>

                                        <!-- Toggle Video/Photo Button -->
                                        <button type="button" title="${isVideo ? 'Mode Foto Absen' : 'Mode Video Live'}" onclick="event.stopPropagation(); toggleStudentGameLivecamMode(${gameInlineArg(st.id)})" class="flex-1 py-1.5 ${isVideo ? 'bg-amber-600 hover:bg-amber-500 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'} rounded-xl text-xs font-bold shadow flex items-center justify-center cursor-pointer transition">
                                            <i class="fa-solid ${isVideo ? 'fa-video' : 'fa-image'}"></i>
                                        </button>

                                        <!-- Reset / Kesempatan Ulang Game -->
                                        <button type="button" title="Reset Sesi Game Siswa" onclick="event.stopPropagation(); confirmResetStudentGameSession(${gameInlineArg(st.id)}, ${gameInlineArg(st.name)})" class="flex-1 py-1.5 bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white rounded-xl text-xs font-bold border border-slate-700 shadow flex items-center justify-center cursor-pointer transition">
                                            <i class="fa-solid fa-rotate-left"></i>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `}
    `;
};

// ============================================================================
// MODAL: SEND DIRECT MESSAGE TO STUDENT IN GAME
// ============================================================================
window.openSendGameStudentMessageModal = function(studentId, studentName) {
    const existing = document.getElementById('send-game-msg-modal');
    if (existing) existing.remove();

    const html = `
        <div id="send-game-msg-modal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in">
            <div class="bg-slate-900 border border-slate-800 text-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
                <div class="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 bg-indigo-600 text-white rounded-xl flex items-center justify-center text-base font-bold shadow">
                            💬
                        </div>
                        <div>
                            <h4 class="font-black text-sm text-white">Kirim Pesan ke Siswa</h4>
                            <p class="text-[11px] text-slate-400">Penerima: <strong class="text-indigo-300">${studentName}</strong></p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('send-game-msg-modal').remove()" class="text-slate-400 hover:text-white p-1 text-base">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="space-y-2">
                    <label class="block text-xs font-bold text-slate-300">Isi Pesan / Instruksi:</label>
                    <textarea id="game-msg-text-input" rows="4" placeholder="Contoh: Tetap fokus mengerjakan ya, baca petunjuk soal dengan cermat..." class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:outline-none"></textarea>
                    
                    <!-- Quick Preset Templates -->
                    <div class="flex items-center gap-1.5 flex-wrap pt-1">
                        <button type="button" onclick="document.getElementById('game-msg-text-input').value='Semangat dan tetap fokus ya!'" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg transition cursor-pointer">
                            Semangat!
                        </button>
                        <button type="button" onclick="document.getElementById('game-msg-text-input').value='Harap tidak membuka tab atau aplikasi lain saat bermain.'" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg transition cursor-pointer">
                            Fokus Tab Game
                        </button>
                        <button type="button" onclick="document.getElementById('game-msg-text-input').value='Waktu sesi game hampir selesai, segera selesaikan quest kamu!'" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold rounded-lg transition cursor-pointer">
                            Pengingat Waktu
                        </button>
                    </div>
                </div>

                <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <button type="button" onclick="document.getElementById('send-game-msg-modal').remove()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer">
                        Batal
                    </button>
                    <button type="button" onclick="sendGameStudentMessage('${studentId}')" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5">
                        <i class="fa-solid fa-paper-plane text-xs"></i>
                        <span>Kirim Pesan</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
};

window.sendGameStudentMessage = async function(studentId) {
    const textInput = document.getElementById('game-msg-text-input');
    const msgText = (textInput ? textInput.value : '').trim();
    if (!msgText) {
        showToast("Tulis pesan terlebih dahulu", "warning");
        return;
    }

    try {
        const res = await fetch('/api/game/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                studentId,
                message: msgText,
                senderName: appState.currentUser?.name || 'Guru Pengawas'
            })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('send-game-msg-modal')?.remove();
            showToast("Pesan terkirim ke layar game siswa!", "success");
        } else {
            showToast("Gagal mengirim pesan", "error");
        }
    } catch (e) {
        showToast("Gagal mengirim pesan ke server", "error");
    }
};

// ============================================================================
// MODAL: BROADCAST MESSAGE TO ALL STUDENTS
// ============================================================================
window.openBroadcastGameMessageModal = function() {
    const existing = document.getElementById('send-broadcast-game-msg-modal');
    if (existing) existing.remove();

    const html = `
        <div id="send-broadcast-game-msg-modal" class="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 z-[60] animate-fade-in">
            <div class="bg-slate-900 border border-slate-800 text-white w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
                <div class="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-9 h-9 bg-amber-500 text-slate-950 rounded-xl flex items-center justify-center text-base font-black shadow">
                            📢
                        </div>
                        <div>
                            <h4 class="font-black text-sm text-white">Kirim Pesan Siaran (Broadcast)</h4>
                            <p class="text-[11px] text-slate-400">Pesan akan muncul di layar semua siswa yang aktif.</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('send-broadcast-game-msg-modal').remove()" class="text-slate-400 hover:text-white p-1 text-base">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="space-y-2">
                    <label class="block text-xs font-bold text-slate-300">Isi Pengumuman / Pesan Siaran:</label>
                    <textarea id="game-broadcast-text-input" rows="4" placeholder="Ketik pesan siaran untuk seluruh peserta game..." class="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-700 rounded-2xl text-xs text-white placeholder-slate-500 focus:ring-2 focus:ring-amber-500 focus:outline-none"></textarea>
                </div>

                <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                    <button type="button" onclick="document.getElementById('send-broadcast-game-msg-modal').remove()" class="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer">
                        Batal
                    </button>
                    <button type="button" onclick="sendBroadcastGameMessage()" class="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-lg transition cursor-pointer flex items-center gap-1.5">
                        <i class="fa-solid fa-bullhorn text-xs"></i>
                        <span>Kirim Siaran Sekarang</span>
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
};

window.sendBroadcastGameMessage = async function() {
    const textInput = document.getElementById('game-broadcast-text-input');
    const msgText = (textInput ? textInput.value : '').trim();
    if (!msgText) {
        showToast("Tulis pesan siaran terlebih dahulu", "warning");
        return;
    }

    try {
        const res = await fetch('/api/game/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                isBroadcast: true,
                message: msgText,
                senderName: appState.currentUser?.name || 'Guru Pengawas'
            })
        });
        const data = await res.json();
        if (data.success) {
            document.getElementById('send-broadcast-game-msg-modal')?.remove();
            showToast("Pesan siaran berhasil dikirim ke seluruh siswa!", "success");
        } else {
            showToast("Gagal mengirim siaran", "error");
        }
    } catch (e) {
        showToast("Gagal mengirim pesan ke server", "error");
    }
};

// ============================================================================
// MODAL: FOCUS / ZOOM STUDENT LIVECAM
// ============================================================================
window.focusGameStudentLivecam = function(studentId) {
    if (typeof window.promptVideoDurationAndDeductTokens === 'function') {
        window.promptVideoDurationAndDeductTokens((minutes) => {
            _executeFocusGameStudentLivecam(studentId);
        });
    } else {
        _executeFocusGameStudentLivecam(studentId);
    }
};

function _executeFocusGameStudentLivecam(studentId) {
    const students = Array.isArray(appState.students) ? appState.students : [];
    const st = students.find(s => String(s.id) === String(studentId));
    if (!st) return;

    const attRecord = (appState.attendance || []).slice().reverse().find(a => 
        String(a.studentId || a.student_id) === String(st.id) || 
        (st.nis && String(a.nis) === String(st.nis))
    );
    const attPhoto = attRecord ? (attRecord.photo || attRecord.imageUrl || attRecord.facePhoto || attRecord.photoUrl || attRecord.image) : null;
    const studentPhoto = attPhoto || st.photo || st.facePhoto || st.image || st.avatar;

    const existing = document.getElementById('focus-game-livecam-modal');
    if (existing) existing.remove();

    const html = `
        <div id="focus-game-livecam-modal" class="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-[60] animate-fade-in">
            <div class="bg-slate-900 border border-slate-800 text-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl space-y-4">
                <div class="p-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center text-lg font-bold">
                            👤
                        </div>
                        <div>
                            <h4 class="font-black text-sm text-white">${gameEscapeHtml(st.name)}</h4>
                            <p class="text-xs text-slate-400 font-mono">${gameEscapeHtml(st.className || 'Kelas')} &middot; NIS: ${gameEscapeHtml(st.nis || '-')}</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('focus-game-livecam-modal').remove()" class="text-slate-400 hover:text-white p-2 text-lg">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="p-6 flex flex-col items-center justify-center space-y-4">
                    <div class="w-full max-w-md h-72 rounded-3xl overflow-hidden bg-slate-950 border-2 border-indigo-500/40 shadow-inner flex items-center justify-center relative">
                        ${studentPhoto ? `
                            <img src="${gameSafeImageSrc(studentPhoto)}" class="w-full h-full object-cover">
                        ` : `
                            <div class="text-center p-6 space-y-2">
                                <i class="fa-solid fa-user-circle text-slate-600 text-6xl"></i>
                                <p class="text-xs text-slate-400 font-bold">Foto Absen Belum Tersedia</p>
                            </div>
                        `}
                    </div>

                    <div class="grid grid-cols-2 gap-3 w-full max-w-md text-xs">
                        <div class="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                            <span class="text-[10px] text-slate-400 block">Akumulasi XP Game:</span>
                            <span class="font-black text-amber-400 text-sm">${st.gameXp || 0} XP</span>
                        </div>
                        <div class="bg-slate-950 p-3 rounded-2xl border border-slate-800">
                            <span class="text-[10px] text-slate-400 block">Daily Streak:</span>
                            <span class="font-black text-rose-400 text-sm">🔥 ${st.dailyStreak || 1} Hari</span>
                        </div>
                    </div>
                </div>

                <div class="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-end gap-2">
                    <button type="button" onclick="openSendGameStudentMessageModal('${st.id}', '${st.name.replace(/'/g, "\\'")}')" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer flex items-center gap-1.5">
                        <i class="fa-solid fa-comment-dots text-xs"></i>
                        <span>Kirim Pesan</span>
                    </button>
                    <button type="button" onclick="document.getElementById('focus-game-livecam-modal').remove()" class="px-5 py-2 bg-slate-800 text-slate-300 font-bold text-xs rounded-xl transition cursor-pointer">
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
};

// ============================================================================
// RESET STUDENT ACTIVE GAME SESSION
// ============================================================================
window.confirmResetStudentGameSession = async function(studentId, studentName) {
    if (!confirm(`Reset sesi game untuk siswa "${studentName}"? Siswa akan dapat mengulang tantangan game dari awal.`)) return;

    try {
        const activeGameMap = JSON.parse(localStorage.getItem('madrasah_active_game_sessions') || '{}');
        delete activeGameMap[studentId];
        localStorage.setItem('madrasah_active_game_sessions', JSON.stringify(activeGameMap));

        await fetch('/api/game/active-sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, sessionData: null })
        });

        showToast(`Sesi game untuk "${studentName}" berhasil direset`, "success");
        renderGameMonitoringDashboard();
    } catch (e) {
        showToast("Gagal mereset sesi", "error");
    }
};

// ============================================================================
// DISMISS IN-GAME TEACHER ALERT
// ============================================================================
window.dismissInGameTeacherAlert = async function(msgId, studentId) {
    const alertEl = document.getElementById('in-game-teacher-alert');
    if (alertEl) alertEl.remove();

    try {
        await fetch('/api/game/messages/dismiss', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ messageId: msgId, studentId })
        });
    } catch (e) {}
};

