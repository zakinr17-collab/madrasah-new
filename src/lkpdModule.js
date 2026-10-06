/**
 * lkpdModule.js
 * Lembar Kerja Peserta Didik (LKPD) Interaktif Berbasis Titik Penanda (Map Adventure Style)
 * Terintegrasi penuh dengan Jadwal Asesmen CBT, Live Monitoring, dan Evaluasi / Penilaian Siswa.
 */

// ============================================================================
// DEFAULT SEED LKPDS
// ============================================================================
const DEFAULT_SEED_LKPDS = [];

function lkpdEscapeHtml(value) {
    const raw = String(value === undefined || value === null ? '' : value);
    if (typeof window.escapeHtml === 'function') return window.escapeHtml(raw);
    return raw.replace(/[&<>"']/g, ch => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
    }[ch]));
}
function lkpdEscapeAttr(value) {
    const raw = String(value === undefined || value === null ? '' : value);
    if (typeof window.escapeHtmlAttr === 'function') return window.escapeHtmlAttr(raw);
    return lkpdEscapeHtml(raw);
}
function lkpdSafeImageSrc(value) {
    const raw = String(value || '');
    const normalized = typeof window.getPhotoHtmlSrc === 'function' ? window.getPhotoHtmlSrc(raw) : raw;
    return lkpdEscapeAttr(normalized);
}
function lkpdInlineArg(value) {
    const literal = JSON.stringify(String(value === undefined || value === null ? '' : value))
        .replace(/</g, '\\u003c')
        .replace(/>/g, '\\u003e')
        .replace(/&/g, '\\u0026');
    return lkpdEscapeAttr(literal);
}

window.getLkpdStorageKey = function() {
    const appState = window.appState || {};
    const activeMId = (appState.currentUser && (appState.currentUser.madrasahId || appState.currentUser.madrasahSlug)) || window.__activeTenant?.id || window.__activeTenant?.slug || 'default';
    return 'madrasah_' + activeMId + '_lkpdList';
};

function getLkpdCreatedTimestamp(lkpd) {
    if (!lkpd || typeof lkpd !== 'object') return 0;
    const createdAt = Date.parse(lkpd.createdAt || '');
    if (Number.isFinite(createdAt)) return createdAt;
    const idMatch = String(lkpd.id || '').match(/^LKPD_(\d{10,})/i);
    if (idMatch) {
        const fromId = Number(idMatch[1]);
        if (Number.isFinite(fromId)) return fromId;
    }
    return 0;
}

function sortLkpdNewestFirst(list) {
    if (!Array.isArray(list) || list.length < 2) return list;
    const ordered = list.map((item, index) => ({ item, index, createdAt: getLkpdCreatedTimestamp(item) }))
        .sort((a, b) => (b.createdAt - a.createdAt) || (a.index - b.index))
        .map(entry => entry.item);
    list.splice(0, list.length, ...ordered);
    return list;
}
window.sortLkpdNewestFirst = sortLkpdNewestFirst;

// Ensure appState has lkpdList initialized.
// The backend/RAM is authoritative; full LKPD payloads are intentionally not
// restored from localStorage because custom images can exceed browser quota.
function initLkpdState() {
    if (!window.appState) return [];
    try {
        const legacyKey = window.getLkpdStorageKey();
        localStorage.removeItem(legacyKey);
        localStorage.removeItem('madrasah_lkpdList');
    } catch (_) {}
    if (!Array.isArray(window.appState.lkpdList)) {
        window.appState.lkpdList = [];
    }
    sortLkpdNewestFirst(window.appState.lkpdList);
    return window.appState.lkpdList;
}

window.syncLkpdStudentState = async function(payload = {}) {
    try {
        const response = await fetch('/api/lkpd/student-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json().catch(() => ({ success: false }));
        if (!response.ok || !data.success) {
            if (response.status !== 401 && response.status !== 403) {
                console.warn('LKPD student-state rejected:', data.message || response.status);
            }
            return { success: false, status: response.status, message: data.message || 'Gagal sinkron state LKPD.' };
        }
        return data;
    } catch (err) {
        console.warn('LKPD student-state sync error:', err);
        return { success: false, message: 'Koneksi state LKPD terputus.' };
    }
};

window.ackLkpdStudentMessage = async function(lkpdId) {
    try {
        await fetch('/api/lkpd/message/ack', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lkpdId })
        });
    } catch (_) {}
};

// Persist LKPD state
window.saveLkpdState = async function() {
    if (!window.appState || !Array.isArray(window.appState.lkpdList)) return;

    // Safety lock: if the list is empty and user is student, DO NOT save or sync to prevent wiping server state.
    const isTeacherOrAdmin = window.appState.currentUser && ['teacher', 'guru', 'admin', 'administrator', 'BOSS'].includes(window.appState.currentUser.role || window.appState.role);
    if (window.appState.lkpdList.length === 0 && !isTeacherOrAdmin) {
        console.warn("Safety Lock: Blocked student empty lkpdList from overwriting server state.");
        return;
    }

    // Purge legacy browser copies. Cloud SQL/local backend remains authoritative.
    try {
        localStorage.removeItem(window.getLkpdStorageKey());
        localStorage.removeItem('madrasah_lkpdList');
    } catch (_) {}

    try {
        // Commit directly and await the server before any managed asset is released.
        // This prevents a delete/reset race where Cloudinary still sees the old
        // LKPD reference and incorrectly protects an asset that should be removed.
        const response = await fetch('/api/sync-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'lkpdList', data: window.appState.lkpdList })
        });
        const data = await response.json();
        if (!response.ok || (data && data.success === false)) {
            throw new Error((data && data.message) || 'Server gagal menyimpan LKPD.');
        }
    } catch (err) {
        console.error("Error saving LKPD state:", err);
        throw err;
    }
};

async function uploadManagedLkpdImage(dataUrl) {
    const res = await fetch('/api/lkpd-assets/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataUrl })
    });
    const data = await res.json();
    if (!res.ok || !data.success || !data.ref) throw new Error(data.message || 'Gagal mengunggah gambar LKPD.');
    return data.ref;
}

async function releaseManagedLkpdImage(ref) {
    if (!ref || typeof ref !== 'string' || ref.startsWith('data:image/')) return;
    try {
        await fetch('/api/lkpd-assets/release', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ref })
        });
    } catch (err) {
        console.warn('Gagal melepas aset LKPD lama:', err);
    }
}

// ============================================================================
// SVG THEMES FOR LKPD WORKSHEETS
// ============================================================================
const LKPD_THEME_SVGS = {
    biology: `
        <rect width="1000" height="650" fill="#f0fdf4" />
        <defs>
            <radialGradient id="cellBg" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#dcfce7" />
                <stop offset="70%" stop-color="#bbf7d0" />
                <stop offset="100%" stop-color="#86efac" />
            </radialGradient>
            <radialGradient id="nucBg" cx="45%" cy="45%" r="50%">
                <stop offset="0%" stop-color="#e0e7ff" />
                <stop offset="60%" stop-color="#818cf8" />
                <stop offset="100%" stop-color="#4338ca" />
            </radialGradient>
        </defs>
        <!-- Cell Wall / Membrane -->
        <rect x="40" y="40" width="920" height="570" rx="90" fill="url(#cellBg)" stroke="#15803d" stroke-width="12" />
        <rect x="58" y="58" width="884" height="534" rx="76" fill="none" stroke="#22c55e" stroke-width="5" stroke-dasharray="14 8" opacity="0.6" />
        
        <!-- Large Nucleus with DNA -->
        <circle cx="620" cy="220" r="115" fill="url(#nucBg)" stroke="#312e81" stroke-width="7" />
        <circle cx="600" cy="200" r="45" fill="#1e1b4b" opacity="0.8" />
        <path d="M 570 230 Q 610 260 650 220 T 670 250" fill="none" stroke="#c7d2fe" stroke-width="4" />
        <path d="M 580 190 Q 610 170 640 190" fill="none" stroke="#e0e7ff" stroke-width="3" />
        <text x="620" y="360" text-anchor="middle" font-weight="bold" font-size="14" fill="#312e81">Inti Sel / Nukleus</text>

        <!-- Mitochondria 1 -->
        <g transform="translate(280, 230) rotate(-20) scale(1.1)">
            <ellipse cx="0" cy="0" rx="95" ry="48" fill="#ea580c" stroke="#7c2d12" stroke-width="5" />
            <path d="M -75 0 Q -50 -30 -30 0 T 0 -30 T 30 0 T 60 -30 T 75 0" fill="none" stroke="#fef08a" stroke-width="5" stroke-linecap="round" />
            <path d="M -65 15 Q -40 35 -15 15 T 20 35 T 55 15" fill="none" stroke="#fde047" stroke-width="4" stroke-linecap="round" />
        </g>
        <text x="280" y="315" text-anchor="middle" font-weight="bold" font-size="14" fill="#9a3412">Mitokondria Sel</text>

        <!-- Golgi Apparatus -->
        <g transform="translate(450, 440) scale(1.2)">
            <path d="M -80 -25 Q 0 -45 80 -25" fill="none" stroke="#0284c7" stroke-width="12" stroke-linecap="round" />
            <path d="M -70 -5 Q 0 -22 70 -5" fill="none" stroke="#0ea5e9" stroke-width="11" stroke-linecap="round" />
            <path d="M -60 15 Q 0 -2 60 15" fill="none" stroke="#38bdf8" stroke-width="10" stroke-linecap="round" />
            <circle cx="-85" cy="5" r="8" fill="#7dd3fc" />
            <circle cx="85" cy="-10" r="9" fill="#7dd3fc" />
            <circle cx="70" cy="30" r="6" fill="#38bdf8" />
        </g>
        <text x="450" y="500" text-anchor="middle" font-weight="bold" font-size="14" fill="#0369a1">Aparatus Golgi</text>

        <!-- Vacuole -->
        <path d="M 750 420 C 860 400 890 510 830 550 C 770 590 700 560 710 490 C 715 440 730 425 750 420 Z" fill="#93c5fd" stroke="#1d4ed8" stroke-width="5" opacity="0.7" />
        <text x="780" y="500" text-anchor="middle" font-weight="bold" font-size="13" fill="#1e40af">Vakuola Besar</text>

        <!-- Chloroplast -->
        <g transform="translate(180, 460) rotate(15) scale(0.9)">
            <ellipse cx="0" cy="0" rx="80" ry="45" fill="#15803d" stroke="#14532d" stroke-width="5" />
            <circle cx="-35" cy="-10" r="8" fill="#86efac" /><circle cx="-35" cy="10" r="8" fill="#86efac" />
            <circle cx="0" cy="-15" r="8" fill="#86efac" /><circle cx="0" cy="5" r="8" fill="#86efac" />
            <circle cx="35" cy="-10" r="8" fill="#86efac" /><circle cx="35" cy="10" r="8" fill="#86efac" />
        </g>
        <text x="180" y="530" text-anchor="middle" font-weight="bold" font-size="13" fill="#166534">Kloroplas</text>

        <!-- Watermark / Title Grid -->
        <text x="70" y="85" font-weight="900" font-size="20" fill="#166534" letter-spacing="1">🔬 LEMBAR KERJA PRAKTIKUM ANATOMI SEL</text>
        <text x="70" y="110" font-size="12" font-weight="bold" fill="#15803d">Identifikasi nomor bagian organel pada tempat penanda</text>
    `,
    network: `
        <rect width="1000" height="650" fill="#0f172a" />
        <defs>
            <linearGradient id="netCloud" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stop-color="#38bdf8" />
                <stop offset="100%" stop-color="#0284c7" />
            </linearGradient>
            <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" stroke-width="1.5" />
            </pattern>
        </defs>
        <rect width="1000" height="650" fill="url(#gridPattern)" />

        <!-- Connection Bus Lines -->
        <path d="M 200 230 L 500 230 L 500 420 L 800 420" fill="none" stroke="#0ea5e9" stroke-width="5" stroke-dasharray="10 8" />
        <path d="M 500 230 L 800 230" fill="none" stroke="#38bdf8" stroke-width="4" />
        <path d="M 200 230 L 200 420 L 500 420" fill="none" stroke="#64748b" stroke-width="3" />

        <!-- Router / Gateway (Node 1) -->
        <g transform="translate(200, 230)">
            <rect x="-65" y="-45" width="130" height="90" rx="16" fill="#1e293b" stroke="#38bdf8" stroke-width="4" />
            <circle cx="0" cy="0" r="28" fill="#0f172a" stroke="#0ea5e9" stroke-width="3" />
            <path d="M -15 0 L 15 0 M 0 -15 L 0 15" stroke="#38bdf8" stroke-width="4" stroke-linecap="round" />
            <text x="0" y="65" text-anchor="middle" font-size="13" font-weight="bold" fill="#7dd3fc">1. Router Gateway</text>
        </g>

        <!-- Firewall / Security (Node 2) -->
        <g transform="translate(500, 230)">
            <rect x="-70" y="-50" width="140" height="100" rx="18" fill="#881337" stroke="#f43f5e" stroke-width="4" />
            <path d="M 0 -30 L 25 -15 L 25 15 L 0 30 L -25 15 L -25 -15 Z" fill="#e11d48" stroke="#fff" stroke-width="2" />
            <text x="0" y="70" text-anchor="middle" font-size="13" font-weight="bold" fill="#fda4af">2. Firewall UTM</text>
        </g>

        <!-- Cloud Server Network -->
        <g transform="translate(800, 230)">
            <path d="M -50 0 C -50 -30 -10 -40 0 -25 C 10 -40 50 -30 50 0 C 65 0 70 20 60 30 C 50 40 -50 40 -60 30 C -70 20 -65 0 -50 0 Z" fill="url(#netCloud)" stroke="#bae6fd" stroke-width="3" />
            <text x="0" y="60" text-anchor="middle" font-size="13" font-weight="bold" fill="#38bdf8">Cloud Datacenter</text>
        </g>

        <!-- Manageable Switch (Node 3) -->
        <g transform="translate(500, 420)">
            <rect x="-80" y="-35" width="160" height="70" rx="12" fill="#047857" stroke="#34d399" stroke-width="4" />
            <circle cx="-50" cy="0" r="8" fill="#a7f3d0" /><circle cx="-25" cy="0" r="8" fill="#a7f3d0" />
            <circle cx="0" cy="0" r="8" fill="#a7f3d0" /><circle cx="25" cy="0" r="8" fill="#a7f3d0" /><circle cx="50" cy="0" r="8" fill="#a7f3d0" />
            <text x="0" y="55" text-anchor="middle" font-size="13" font-weight="bold" fill="#6ee7b7">3. Core Switch Distribution</text>
        </g>

        <!-- Client Terminals -->
        <g transform="translate(800, 420)">
            <rect x="-60" y="-40" width="120" height="80" rx="14" fill="#334155" stroke="#94a3b8" stroke-width="3" />
            <rect x="-45" y="-28" width="90" height="50" rx="6" fill="#0284c7" />
            <text x="0" y="60" text-anchor="middle" font-size="13" font-weight="bold" fill="#cbd5e1">Workstation Client</text>
        </g>

        <text x="60" y="80" font-weight="900" font-size="22" fill="#38bdf8">💻 TOPOLOGI JARINGAN DAN KEAMANAN SISTEM</text>
        <text x="60" y="105" font-size="12" font-weight="bold" fill="#94a3b8">Bagan arsitektur komunikasi data antarnode dan gateway</text>
    `,
    geography: `
        <rect width="1000" height="650" fill="#f8fafc" />
        <defs>
            <radialGradient id="compassGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#fef08a" />
                <stop offset="100%" stop-color="#ca8a04" />
            </radialGradient>
        </defs>
        <rect width="1000" height="650" fill="#e0f2fe" opacity="0.6" />

        <!-- Archipelago Islands (Java, Sumatra, Kalimantan, Sulawesi, Papua) -->
        <!-- Sumatra -->
        <path d="M 120 180 Q 200 320 280 440 Q 240 460 170 360 Q 100 240 120 180 Z" fill="#bbf7d0" stroke="#15803d" stroke-width="4" />
        <!-- Java -->
        <path d="M 280 470 Q 420 480 540 480 Q 550 510 400 510 Q 270 500 280 470 Z" fill="#86efac" stroke="#166534" stroke-width="4" />
        <!-- Kalimantan -->
        <path d="M 360 210 Q 480 180 510 290 Q 490 390 400 380 Q 320 330 360 210 Z" fill="#a7f3d0" stroke="#047857" stroke-width="4" />
        <!-- Sulawesi -->
        <path d="M 570 240 Q 610 200 620 260 Q 640 250 670 300 Q 620 320 600 360 Q 560 380 580 320 Z" fill="#6ee7b7" stroke="#065f46" stroke-width="4" />
        <!-- Papua -->
        <path d="M 740 270 Q 860 240 920 330 Q 880 410 820 420 Q 750 380 740 270 Z" fill="#bbf7d0" stroke="#15803d" stroke-width="4" />

        <!-- Decorative Nautical Elements -->
        <circle cx="850" cy="120" r="45" fill="url(#compassGlow)" stroke="#713f12" stroke-width="4" />
        <polygon points="850,85 858,115 850,110 842,115" fill="#b91c1c" />
        <polygon points="850,155 858,125 850,130 842,125" fill="#1e293b" />
        <text x="850" y="80" text-anchor="middle" font-weight="900" font-size="12" fill="#7f1d1d">U</text>

        <text x="70" y="80" font-weight="900" font-size="22" fill="#0369a1">🗺️ PETA GEOGRAFI & WILAYAH NUSANTARA</text>
        <text x="70" y="105" font-size="12" font-weight="bold" fill="#0284c7">Tentukan letak selat strategis, kepulauan, dan pembagian zona waktu</text>
    `,
    math: `
        <rect width="1000" height="650" fill="#f8fafc" />
        <defs>
            <pattern id="mathGrid" width="50" height="50" patternUnits="userSpaceOnUse">
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#e2e8f0" stroke-width="2" />
            </pattern>
        </defs>
        <rect width="1000" height="650" fill="url(#mathGrid)" />

        <!-- Cartesian Coordinate Axes -->
        <line x1="500" y1="50" x2="500" y2="600" stroke="#334155" stroke-width="4" />
        <line x1="100" y1="325" x2="900" y2="325" stroke="#334155" stroke-width="4" />
        <polygon points="905,325 890,317 890,333" fill="#334155" />
        <polygon points="500,45 492,60 508,60" fill="#334155" />
        <text x="915" y="330" font-weight="bold" font-size="14" fill="#334155">X</text>
        <text x="500" y="35" font-weight="bold" font-size="14" fill="#334155" text-anchor="middle">Y</text>

        <!-- Geometric Shape 1: Right Triangle -->
        <polygon points="200,450 400,450 400,200" fill="#fed7aa" stroke="#c2410c" stroke-width="4" opacity="0.8" />
        <text x="330" y="475" font-weight="bold" font-size="13" fill="#9a3412">Alas a = 8 cm</text>
        <text x="415" y="325" font-weight="bold" font-size="13" fill="#9a3412">Tinggi b = 6 cm</text>

        <!-- Geometric Shape 2: Circle & Tangent -->
        <circle cx="700" cy="200" r="85" fill="#e0e7ff" stroke="#4338ca" stroke-width="4" opacity="0.85" />
        <line x1="550" y1="285" x2="850" y2="285" stroke="#dc2626" stroke-width="4" stroke-dasharray="8 6" />
        <text x="700" y="205" font-weight="bold" font-size="13" fill="#312e81" text-anchor="middle">Jari-jari r = 7 cm</text>

        <text x="70" y="80" font-weight="900" font-size="22" fill="#4338ca">📐 LEMBAR KERJA GEOMETRI & TRIGONOMETRI</text>
        <text x="70" y="105" font-size="12" font-weight="bold" fill="#64748b">Hitung luas bangun datar, keliling, dan kemiringan garis kurva</text>
    `
};

// Helper to determine the style of the student's answers displayed directly on-photo
function getStudentAnswerStyle(lkpd) {
    if (!lkpd) lkpd = {};
    const styleMode = lkpd.studentAnsStyle || 'green';
    const customBg = lkpd.studentAnsBg || '#059669';
    const customTextColor = lkpd.studentAnsTextColor || '#ffffff';

    if (styleMode === 'transparent') {
        return {
            classes: "text-slate-900 font-extrabold text-[12px] text-center max-w-[150px] break-words px-1.5 py-0.5",
            style: "background: transparent; border: none; text-shadow: 1px 1px 0px #fff, -1px -1px 0px #fff, 1px -1px 0px #fff, -1px 1px 0px #fff; color: #1e293b;",
            pdfStyle: "background: transparent; border: none; text-shadow: 1px 1px 0px #fff, -1px -1px 0px #fff, 1px -1px 0px #fff, -1px 1px 0px #fff; color: #1e293b; font-weight: 800; font-size: 11px; text-align: center; max-width: 120px; word-wrap: break-word;"
        };
    } else if (styleMode === 'dark') {
        return {
            classes: "px-3 py-1.5 min-w-[2.5rem] max-w-[150px] bg-slate-900 border-2 border-slate-700 text-white font-bold shadow-xl rounded-xl flex items-center justify-center text-[10px] break-words line-clamp-3",
            style: "",
            pdfStyle: "padding: 4px 8px; min-width: 30px; background: #0f172a; border: 1px solid #475569; color: #ffffff; font-size: 10px; font-weight: 700; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; max-width: 120px; word-wrap: break-word;"
        };
    } else if (styleMode === 'light') {
        return {
            classes: "px-3 py-1.5 min-w-[2.5rem] max-w-[150px] bg-white border-2 border-slate-300 text-slate-800 font-bold shadow-xl rounded-xl flex items-center justify-center text-[10px] break-words line-clamp-3",
            style: "",
            pdfStyle: "padding: 4px 8px; min-width: 30px; background: #ffffff; border: 1px solid #cbd5e1; color: #1e293b; font-size: 10px; font-weight: 700; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; max-width: 120px; word-wrap: break-word;"
        };
    } else if (styleMode === 'custom') {
        return {
            classes: "px-3 py-1.5 min-w-[2.5rem] max-w-[150px] border-2 text-white font-bold shadow-xl rounded-xl flex items-center justify-center text-[10px] break-words line-clamp-3",
            style: `background: ${customBg}; border-color: ${customBg}; color: ${customTextColor};`,
            pdfStyle: `padding: 4px 8px; min-width: 30px; background: ${customBg}; border: 1px solid ${customBg}; color: ${customTextColor}; font-size: 10px; font-weight: 700; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; max-width: 120px; word-wrap: break-word;`
        };
    } else {
        // default 'green'
        return {
            classes: "px-3 py-1.5 min-w-[2.5rem] max-w-[150px] bg-emerald-600 border-2 border-emerald-300 text-white font-bold shadow-xl rounded-xl flex items-center justify-center text-[10px] break-words line-clamp-3",
            style: "",
            pdfStyle: "padding: 4px 8px; min-width: 30px; background: #059669; border: 1px solid #6ee7b7; color: white; font-size: 10px; font-weight: 700; border-radius: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; max-width: 120px; word-wrap: break-word;"
        };
    }
}

// Render Worksheet Visual Container (Theme SVG or Custom Uploaded Image)
function renderLkpdCanvasComponent(lkpd, options = {}) {
    const { isEditable = false, isPreview = false, studentAnswers = {}, onMarkerClickFn = null } = options;
    const markers = Array.isArray(lkpd.markers) ? lkpd.markers : [];
    
    // Customization values
    const imgScale = lkpd.imageScale || 100;
    const mSize = lkpd.markerSize || 44;
    const mColor = lkpd.markerColor || '#4f46e5';
    const mStyle = lkpd.markerStyle || 'standard';

    let canvasBackground = '';
    const isCustom = !!lkpd.customImage;
    if (isCustom) {
        canvasBackground = `<img src="${lkpdSafeImageSrc(lkpd.customImage)}" alt="${lkpdEscapeAttr(lkpd.title)}" class="max-w-full h-auto block max-h-[70vh] select-none pointer-events-none rounded-2xl mx-auto" style="object-fit: contain; width: ${imgScale}%;" />`;
    } else {
        const svgContent = LKPD_THEME_SVGS[lkpd.theme] || LKPD_THEME_SVGS.biology;
        canvasBackground = `
            <svg viewBox="0 0 1000 650" class="h-auto block select-none pointer-events-none rounded-2xl mx-auto" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.06)); width: ${imgScale}%;">
                ${svgContent}
            </svg>
        `;
    }

    // Helper to get marker style classes
    const getMarkerBaseStyle = (answered = false) => {
        let base = `flex items-center justify-center font-black shadow-xl border-2 transition-all `;
        const sizeStyle = `width: ${mSize}px; height: ${mSize}px; font-size: ${Math.max(10, mSize / 2.5)}px; `;
        const isTransparent = mStyle === 'transparent' || mColor === 'transparent';
        
        if (mStyle === 'circle' || mStyle === 'minimal') base += 'rounded-full ';
        else base += 'rounded-2xl ';

        if (mStyle === 'minimal') base += 'scale-75 ';

        if (answered) {
            base += 'bg-emerald-600 border-emerald-300 text-white ';
            return { className: base, style: sizeStyle };
        } else {
            if (isTransparent) {
                return { 
                    className: base + 'text-slate-900 border-slate-900/40 backdrop-blur-md', 
                    style: sizeStyle + `background: rgba(255, 255, 255, 0.4); border: 2px solid rgba(15, 23, 42, 0.4); color: #0f172a; text-shadow: 0 0 2px rgba(255,255,255,0.9);` 
                };
            } else if (mStyle === 'minimal') {
                return { 
                    className: base + 'text-white border-white', 
                    style: sizeStyle + `background: ${mColor};` 
                };
            } else {
                // Dynamic background color for standard/circle
                return { 
                    className: base + 'text-white border-white/80', 
                    style: sizeStyle + `background: ${mColor};` 
                };
            }
        }
    };

    return `
        <div id="lkpd-canvas-wrapper" class="relative w-fit max-w-full mx-auto rounded-3xl overflow-hidden border-2 border-slate-200 bg-slate-100 shadow-inner select-none ${isEditable ? 'cursor-crosshair' : ''}" style="width: fit-content; max-width: ${imgScale}%;" ${isEditable ? `onclick="handleCanvasClickToAddMarker(event, '${lkpd.id}')"` : ''}>
            ${canvasBackground}

            <!-- Numbered Markers Overlay -->
            <div class="absolute inset-0 z-20 pointer-events-auto">
                ${markers.map((mk, idx) => {
                    const number = mk.number || (idx + 1);
                    const answerText = (studentAnswers && studentAnswers[mk.id]) ? String(studentAnswers[mk.id]).trim() : '';
                    const isAnswered = answerText.length > 0;
                    const markerStyleConfig = getMarkerBaseStyle(isAnswered);
                    
                    if (isEditable) {
                        const editMarkerStyle = getMarkerBaseStyle(false);
                        return `
                            <div style="left: ${mk.x}%; top: ${mk.y}%; transform: translate(-50%, -50%);" class="absolute group z-30 select-none cursor-move" onclick="event.stopPropagation();" onmousedown="window.startMarkerDrag(event, '${lkpd.id}', '${mk.id}')" ontouchstart="window.startMarkerDrag(event, '${lkpd.id}', '${mk.id}')">
                                <button type="button" class="relative flex flex-col items-center justify-center pointer-events-none transition transform group-hover:scale-125" title="Klik untuk mengedit, Seret / Geser untuk mengubah posisi nomor ${number}">
                                    <div class="${editMarkerStyle.className}" style="${editMarkerStyle.style}">
                                        ${number}
                                    </div>
                                    <span class="absolute -bottom-5 whitespace-nowrap bg-slate-900/90 text-amber-300 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md shadow-lg border border-amber-400/40">
                                        ${mk.points || 25} Poin
                                    </span>
                                </button>
                            </div>
                        `;
                    }

                    // Student & Preview Mode Marker
                    const clickAction = onMarkerClickFn ? `${onMarkerClickFn}('${mk.id}', ${number})` : `selectStudentMarker('${mk.id}', ${number})`;
                    
                    if (lkpd.answeringMode === 'on-photo' && isAnswered) {
                        const ansStyle = getStudentAnswerStyle(lkpd);
                        return `
                            <div style="left: ${mk.x}%; top: ${mk.y}%; transform: translate(-50%, -50%);" class="absolute group z-30" onclick="event.stopPropagation();">
                                <button type="button" onclick="${clickAction}" id="pin-btn-${mk.id}" data-number="${number}" class="relative flex flex-col items-center justify-center cursor-pointer transition transform hover:scale-110 active:scale-95">
                                    <div class="${ansStyle.classes}" style="${ansStyle.style}">
                                        ${lkpdEscapeHtml(answerText)}
                                    </div>
                                    <span class="absolute -top-4 px-1.5 py-0.5 bg-slate-900 text-white font-black text-[7px] rounded border border-white/20 shadow-sm">${number}</span>
                                </button>
                            </div>
                        `;
                    }

                    return `
                        <div style="left: ${mk.x}%; top: ${mk.y}%; transform: translate(-50%, -50%);" class="absolute group z-30" onclick="event.stopPropagation();">
                            <button type="button" onclick="${clickAction}" id="pin-btn-${mk.id}" data-number="${number}" class="relative flex flex-col items-center justify-center cursor-pointer transition transform hover:scale-120 active:scale-95">
                                <div class="${markerStyleConfig.className}" style="${markerStyleConfig.style}">
                                    ${isAnswered ? '<i class="fa-solid fa-check"></i>' : (mStyle === 'minimal' ? '' : `${number}`)}
                                </div>
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

window.startMarkerDrag = function(event, lkpdId, markerId) {
    event.preventDefault();
    event.stopPropagation();

    const isTouch = event.type === 'touchstart';
    const moveEvent = isTouch ? 'touchmove' : 'mousemove';
    const endEvent = isTouch ? 'touchend' : 'mouseup';

    const canvasWrapper = document.getElementById('lkpd-canvas-wrapper');
    if (!canvasWrapper) return;

    const markerEl = event.currentTarget;
    let hasMoved = false;

    const startX = isTouch ? event.touches[0].clientX : event.clientX;
    const startY = isTouch ? event.touches[0].clientY : event.clientY;

    const onMove = function(e) {
        e.preventDefault();
        e.stopPropagation();

        const clientX = isTouch ? e.touches[0].clientX : e.clientX;
        const clientY = isTouch ? e.touches[0].clientY : e.clientY;

        if (Math.abs(clientX - startX) > 4 || Math.abs(clientY - startY) > 4) {
            hasMoved = true;
        }

        const rect = canvasWrapper.getBoundingClientRect();
        
        // Calculate percentages
        let xPercent = ((clientX - rect.left) / rect.width) * 100;
        let yPercent = ((clientY - rect.top) / rect.height) * 100;

        // Constrain percentages
        xPercent = Math.max(1, Math.min(99, xPercent));
        yPercent = Math.max(1, Math.min(99, yPercent));

        // Realtime visual feedback
        markerEl.style.left = `${xPercent}%`;
        markerEl.style.top = `${yPercent}%`;
        
        markerEl.dataset.draggedX = xPercent;
        markerEl.dataset.draggedY = yPercent;
    };

    const onEnd = async function(e) {
        document.removeEventListener(moveEvent, onMove);
        document.removeEventListener(endEvent, onEnd);

        if (!hasMoved) {
            // Treat as a normal click! Open the edit modal
            if (typeof window.openEditMarkerModal === 'function') {
                window.openEditMarkerModal(lkpdId, markerId);
            }
            return;
        }

        const xPercent = markerEl.dataset.draggedX;
        const yPercent = markerEl.dataset.draggedY;

        if (xPercent !== undefined && yPercent !== undefined) {
            const lkpds = initLkpdState();
            const lk = lkpds.find(l => l.id === lkpdId);
            if (lk && Array.isArray(lk.markers)) {
                const mk = lk.markers.find(m => m.id === markerId);
                if (mk) {
                    mk.x = parseFloat(xPercent).toFixed(2);
                    mk.y = parseFloat(yPercent).toFixed(2);
                    await saveLkpdState();
                    showToast(`Posisi nomor #${mk.number || ''} berhasil diperbarui!`, 'success');
                }
            }
        }
    };

    document.addEventListener(moveEvent, onMove, { passive: false });
    document.addEventListener(endEvent, onEnd);
};

// ============================================================================
// 1. LKPD CARDS VIEW IN ASSESSMENT MODULE
// ============================================================================
window.renderLkpdCardsView = function(container) {
    if (!container) return;
    const lkpds = initLkpdState();
    const subjects = window.appState.subjects || [];
    const classes = window.appState.classes || [];

    container.innerHTML = `
        <div class="space-y-6 animate-fade-in">
            <!-- Header Bar -->
            <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-6 rounded-3xl shadow-sm border border-slate-100 gap-4">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-extrabold text-[10px] rounded-full uppercase tracking-wider">
                            <i class="fa-solid fa-file-pen mr-1"></i> Asesmen Berbasis Kerja Siswa
                        </span>
                        <span class="text-xs text-slate-400 font-semibold">&bull; ${lkpds.length} Lembar LKPD</span>
                    </div>
                    <h3 class="font-extrabold text-slate-800 text-lg sm:text-xl">Lembar Kerja Peserta Didik (LKPD) Interaktif</h3>
                    <p class="text-xs text-slate-500">Buat penanda titik lokasi pada gambar lembar kerja mirip Map Adventure tempat murid menulis jawabannya.</p>
                </div>
                <div class="flex items-center gap-2.5 flex-wrap">
                    <button type="button" onclick="openCreateLkpdModal()" class="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold rounded-2xl text-xs shadow-md shadow-emerald-600/20 transition flex items-center space-x-2 cursor-pointer">
                        <i class="fa-solid fa-plus"></i><span>Buat LKPD Baru</span>
                    </button>
                </div>
            </div>

            <!-- LKPD Cards Grid -->
            ${lkpds.length === 0 ? `
                <div class="bg-white p-12 rounded-3xl border border-slate-100 text-center space-y-4 shadow-sm max-w-xl mx-auto">
                    <div class="w-16 h-16 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto text-2xl font-black">
                        <i class="fa-solid fa-map-pin"></i>
                    </div>
                    <h4 class="font-extrabold text-slate-800 text-base">Belum Ada Kartu LKPD</h4>
                    <p class="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                        Klik tombol "Buat LKPD Baru" untuk mengisi mata pelajaran, kelas, dan nama LKPD. Anda dapat langsung memilih tema atau mengunggah gambar lembar kerja dan menandai titik soalnya!
                    </p>
                    <button type="button" onclick="openCreateLkpdModal()" class="px-6 py-3 bg-emerald-600 text-white font-bold text-xs rounded-2xl shadow transition cursor-pointer">
                        Mulai Buat LKPD Sekarang
                    </button>
                </div>
            ` : `
                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${lkpds.map(lk => {
                        const markersCount = Array.isArray(lk.markers) ? lk.markers.length : 0;
                        const submissionsCount = Array.isArray(lk.submissions) ? lk.submissions.length : 0;
                        const gradedCount = Array.isArray(lk.submissions) ? lk.submissions.filter(s => s.isGraded).length : 0;

                        return `
                            <div class="bg-white rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition overflow-hidden flex flex-col justify-between group">
                                <div class="p-6 space-y-4">
                                    <!-- Badges -->
                                    <div class="flex items-center justify-between gap-2">
                                        <div class="flex items-center gap-1.5 flex-wrap">
                                            <span class="px-2.5 py-1 bg-indigo-50 text-indigo-700 font-extrabold text-[10px] rounded-xl border border-indigo-200/60">
                                                <i class="fa-solid fa-book-open mr-1"></i>${lkpdEscapeHtml(lk.subjectName || lk.subjectId || 'Umum')}
                                            </span>
                                            <span class="px-2.5 py-1 bg-amber-50 text-amber-800 font-extrabold text-[10px] rounded-xl border border-amber-200/60">
                                                <i class="fa-solid fa-users mr-1"></i>${lkpdEscapeHtml(lk.className || lk.classId || 'Semua Kelas')}
                                            </span>
                                        </div>
                                        <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black text-[10px] rounded-full">
                                            Aktif
                                        </span>
                                    </div>

                                    <!-- Title & Description -->
                                    <div>
                                        <h4 class="font-black text-slate-800 text-base group-hover:text-emerald-700 transition line-clamp-1">${lkpdEscapeHtml(lk.title)}</h4>
                                        <p class="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">${lkpdEscapeHtml(lk.description || 'Lembar kerja interaktif berbasis penanda gambar.')}</p>
                                    </div>

                                    <!-- Visual Preview Thumbnail -->
                                    <div class="h-32 rounded-2xl bg-slate-900 overflow-hidden relative border border-slate-200 shadow-inner flex items-center justify-center cursor-pointer" onclick="openManageLkpdModal(${lkpdInlineArg(lk.id)})" title="Klik untuk mengelola lembar kerja">
                                        ${lk.customImage ? `
                                            <img src="${lkpdSafeImageSrc(lk.customImage)}" alt="Custom LKPD" class="w-full h-full object-cover" />
                                        ` : `
                                            <div class="w-full h-full opacity-75 scale-75 transform origin-center">
                                                <svg viewBox="0 0 1000 650" class="w-full h-full">
                                                    ${LKPD_THEME_SVGS[lk.theme] || LKPD_THEME_SVGS.biology}
                                                </svg>
                                            </div>
                                        `}
                                        <div class="absolute inset-0 bg-slate-950/40 hover:bg-slate-950/20 transition flex items-center justify-center">
                                            <span class="px-3 py-1 bg-white/95 text-slate-900 font-black text-xs rounded-xl shadow-lg border border-white flex items-center gap-1.5 backdrop-blur-xs">
                                                <i class="fa-solid fa-sliders text-emerald-600"></i> Kelola Lembar Kerja
                                            </span>
                                        </div>
                                    </div>

                                    <!-- Stats Counters -->
                                    <div class="grid grid-cols-2 gap-2 pt-1 text-center">
                                        <div class="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                                            <span class="block text-[10px] font-bold text-slate-400 uppercase">Titik Soal</span>
                                            <strong class="text-sm font-black text-slate-800 flex items-center justify-center gap-1">
                                                <i class="fa-solid fa-location-dot text-amber-500 text-xs"></i> ${markersCount} Titik
                                            </strong>
                                        </div>
                                        <div class="bg-slate-50 p-2.5 rounded-2xl border border-slate-100">
                                            <span class="block text-[10px] font-bold text-slate-400 uppercase">Jawaban Siswa</span>
                                            <strong class="text-sm font-black text-emerald-700 flex items-center justify-center gap-1">
                                                <i class="fa-solid fa-user-check text-emerald-600 text-xs"></i> ${submissionsCount} Masuk
                                            </strong>
                                        </div>
                                    </div>
                                </div>

                                <!-- Action Buttons Footer -->
                                <div class="p-4 bg-slate-50/80 border-t border-slate-100 space-y-2">
                                    <div class="grid grid-cols-2 gap-2">
                                        <button type="button" onclick="openManageLkpdModal(${lkpdInlineArg(lk.id)})" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer">
                                            <i class="fa-solid fa-map-pin text-[11px]"></i> <span>Kelola Titik</span>
                                        </button>
                                        <button type="button" onclick="openStudentLkpdWorksheetModal(${lkpdInlineArg(lk.id)}, 'TEACHER_PREVIEW')" class="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-1.5 cursor-pointer">
                                            <i class="fa-solid fa-eye text-[11px]"></i> <span>Pratinjau Siswa</span>
                                        </button>
                                    </div>
                                    <div class="grid grid-cols-2 gap-2">
                                        <button type="button" onclick="switchToLkpdMonitoring(${lkpdInlineArg(lk.id)})" class="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer">
                                            <i class="fa-solid fa-desktop text-emerald-600 text-[11px]"></i> <span>Monitoring</span>
                                        </button>
                                        <button type="button" onclick="switchToLkpdEvaluation(${lkpdInlineArg(lk.id)})" class="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition flex items-center justify-center gap-1.5 cursor-pointer">
                                            <i class="fa-solid fa-star-half-stroke text-amber-500 text-[11px]"></i> <span>Beri Nilai (${gradedCount}/${submissionsCount})</span>
                                        </button>
                                    </div>
                                    <div class="flex items-center justify-between pt-1">
                                        <button type="button" onclick="openCreateLkpdModal(${lkpdInlineArg(lk.id)})" class="text-slate-400 hover:text-indigo-600 text-xs font-bold transition flex items-center gap-1 cursor-pointer">
                                            <i class="fa-solid fa-pen text-[10px]"></i> Edit Info
                                        </button>
                                        <button type="button" onclick="deleteLkpd(${lkpdInlineArg(lk.id)})" class="text-rose-400 hover:text-rose-600 text-xs font-bold transition flex items-center gap-1 cursor-pointer">
                                            <i class="fa-solid fa-trash-can text-[10px]"></i> Hapus
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>
    `;
};

// ============================================================================
// 2. CREATE / EDIT LKPD METADATA MODAL (Form Pengisian Mapel, Kelas, Nama LKPD)
// ============================================================================
window.openCreateLkpdModal = function(lkpdId = null) {
    const lkpds = initLkpdState();
    const lkpd = lkpdId ? lkpds.find(l => l.id === lkpdId) : null;
    const isEdit = !!lkpd;

    const subjects = window.appState.subjects || [];
    const classes = window.appState.classes || [];

    const modalHtml = `
        <div id="create-lkpd-modal-bg" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-start justify-center p-4 overflow-y-auto animate-fade-in">
            <div class="bg-white rounded-3xl border border-slate-100 shadow-2xl max-w-lg w-full overflow-hidden my-4 sm:my-8 flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]">
                <div class="bg-gradient-to-r from-emerald-700 to-teal-800 p-6 text-white flex items-center justify-between shrink-0">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl font-bold">
                            <i class="fa-solid fa-file-signature"></i>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-base">${isEdit ? 'Edit Lembar Kerja (LKPD)' : 'Form Pengisian LKPD Baru'}</h3>
                            <p class="text-xs text-emerald-100">Isi mata pelajaran, kelas sasaran, dan nama LKPD</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('create-lkpd-modal-bg').remove()" class="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <form onsubmit="handleSaveLkpdForm(event, '${lkpdId || ''}')" class="p-6 space-y-4 text-xs overflow-y-auto flex-1 custom-scrollbar">
                    <div>
                        <label class="block font-extrabold text-slate-700 mb-1.5">1. Mata Pelajaran <span class="text-rose-500">*</span></label>
                        <div class="relative">
                            <select id="lkpd-form-subject" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                                <option value="">-- Pilih Mata Pelajaran --</option>
                                ${subjects.map(s => {
                                    const sName = s.name || s.title || s;
                                    const isSel = lkpd && (lkpd.subjectName === sName || lkpd.subjectId === s.id);
                                    return `<option value="${sName}" ${isSel ? 'selected' : ''}>${sName}</option>`;
                                }).join('')}
                                <option value="IPA / Biologi" ${lkpd && lkpd.subjectName === 'IPA / Biologi' ? 'selected' : ''}>IPA / Biologi</option>
                                <option value="Informatika / TIK" ${lkpd && lkpd.subjectName === 'Informatika / TIK' ? 'selected' : ''}>Informatika / TIK</option>
                                <option value="Matematika" ${lkpd && lkpd.subjectName === 'Matematika' ? 'selected' : ''}>Matematika</option>
                                <option value="IPS / Geografi" ${lkpd && lkpd.subjectName === 'IPS / Geografi' ? 'selected' : ''}>IPS / Geografi</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label class="block font-extrabold text-slate-700 mb-1.5">2. Kelas Sasaran <span class="text-rose-500">*</span></label>
                        <select id="lkpd-form-class" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                            <option value="">-- Pilih Kelas --</option>
                            <option value="ALL" ${lkpd && (lkpd.classId === 'ALL' || lkpd.className === 'Semua Kelas') ? 'selected' : ''}>Semua Kelas (Umum)</option>
                            ${classes.map(c => {
                                const cId = c.id || c.name;
                                const cName = c.name || c.className;
                                const isSel = lkpd && (lkpd.classId === cId || lkpd.className === cName);
                                return `<option value="${cId}::${cName}" ${isSel ? 'selected' : ''}>${cName}</option>`;
                            }).join('')}
                        </select>
                    </div>

                    <div>
                        <label class="block font-extrabold text-slate-700 mb-1.5">3. Nama LKPD <span class="text-rose-500">*</span></label>
                        <input type="text" id="lkpd-form-title" required value="${lkpdEscapeAttr(lkpd ? lkpd.title : '')}" placeholder="Contoh: LKPD 1 - Struktur Sel & Organel Tumbuhan" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>

                    <div>
                        <label class="block font-extrabold text-slate-700 mb-1.5">4. Mode Menjawab <span class="text-rose-500">*</span></label>
                        <select id="lkpd-form-mode" required class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                            <option value="below" ${lkpd && lkpd.answeringMode === 'below' ? 'selected' : ''}>Di bawah Gambar (Mode Klasik)</option>
                            <option value="on-photo" ${lkpd && lkpd.answeringMode === 'on-photo' ? 'selected' : ''}>Langsung di Foto (Mode Transparan)</option>
                        </select>
                        <p class="text-[10px] text-slate-400 mt-1 italic leading-relaxed">
                            <i class="fa-solid fa-circle-info mr-1"></i> Mode Transparan akan memunculkan form jawaban di atas foto saat titik nomor diklik.
                        </p>
                    </div>

                    <div>
                        <label class="block font-extrabold text-slate-700 mb-1.5">5. Tanggal Pelaksanaan <span class="text-rose-500">*</span></label>
                        <input type="date" id="lkpd-form-date" required value="${lkpd && lkpd.date ? lkpd.date : ''}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>

                    <div class="bg-indigo-50/50 p-4 rounded-3xl border border-indigo-100 space-y-4">
                        <h4 class="font-black text-indigo-900 text-[11px] uppercase tracking-wider flex items-center gap-2">
                            <i class="fa-solid fa-palette"></i> Kustomisasi Tampilan (Opsional)
                        </h4>
                        
                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block font-bold text-slate-600 mb-1 text-[10px]">Ukuran Gambar (%)</label>
                                <input type="number" id="lkpd-form-image-scale" min="20" max="100" value="${lkpd ? (lkpd.imageScale || 100) : 100}" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                            </div>
                            <div>
                                <label class="block font-bold text-slate-600 mb-1 text-[10px]">Ukuran Nomor (px)</label>
                                <input type="number" id="lkpd-form-marker-size" min="20" max="80" value="${lkpd ? (lkpd.markerSize || 44) : 44}" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none">
                            </div>
                        </div>

                        <div class="grid grid-cols-2 gap-4">
                            <div>
                                <label class="block font-bold text-slate-600 mb-1 text-[10px]">Warna Utama Nomor</label>
                                <div class="flex items-center gap-2">
                                    <input type="color" id="lkpd-form-marker-color" value="${(lkpd && lkpd.markerColor && lkpd.markerColor !== 'transparent') ? lkpd.markerColor : '#4f46e5'}" class="w-10 h-10 p-1 bg-white border border-slate-200 rounded-xl cursor-pointer ${lkpd && lkpd.markerColor === 'transparent' ? 'opacity-40' : ''}" ${lkpd && lkpd.markerColor === 'transparent' ? 'disabled' : ''}>
                                    <label class="flex items-center gap-1.5 cursor-pointer bg-slate-100 hover:bg-slate-200 px-2.5 py-2 rounded-xl text-[10px] font-bold text-slate-700 transition">
                                        <input type="checkbox" id="lkpd-form-marker-transparent" ${lkpd && lkpd.markerColor === 'transparent' ? 'checked' : ''} onchange="window.toggleFormMarkerTransparent(this.checked)" class="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer">
                                        <span class="flex items-center gap-1"><i class="fa-solid fa-ghost text-indigo-600"></i> Transparan</span>
                                    </label>
                                </div>
                            </div>
                            <div>
                                <label class="block font-bold text-slate-600 mb-1 text-[10px]">Gaya Ikon Nomor</label>
                                <select id="lkpd-form-marker-style" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-[11px]">
                                    <option value="standard" ${lkpd && lkpd.markerStyle === 'standard' ? 'selected' : ''}>Standar (Box)</option>
                                    <option value="circle" ${lkpd && lkpd.markerStyle === 'circle' ? 'selected' : ''}>Lingkaran</option>
                                    <option value="minimal" ${lkpd && lkpd.markerStyle === 'minimal' ? 'selected' : ''}>Minimalis (Dot)</option>
                                    <option value="transparent" ${lkpd && lkpd.markerStyle === 'transparent' ? 'selected' : ''}>Transparan (Kaca)</option>
                                </select>
                            </div>
                        </div>

                        <div class="border-t border-indigo-100/60 pt-3 mt-1 space-y-3">
                            <span class="text-[10px] font-black text-indigo-950 uppercase tracking-wider block">Gaya Label Jawaban Siswa (Mode Langsung di Foto)</span>
                            <div class="grid grid-cols-2 gap-4">
                                <div>
                                    <label class="block font-bold text-slate-600 mb-1 text-[10px]">Model Tampilan</label>
                                    <select id="lkpd-form-student-ans-style" class="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 focus:outline-none text-[11px]" onchange="window.toggleCustomAnsStyleForm(this.value)">
                                        <option value="green" ${lkpd && lkpd.studentAnsStyle === 'green' ? 'selected' : ''}>Hijau Standar</option>
                                        <option value="dark" ${lkpd && lkpd.studentAnsStyle === 'dark' ? 'selected' : ''}>Gelap / Hitam</option>
                                        <option value="light" ${lkpd && lkpd.studentAnsStyle === 'light' ? 'selected' : ''}>Terang / Putih</option>
                                        <option value="transparent" ${lkpd && lkpd.studentAnsStyle === 'transparent' ? 'selected' : ''}>Transparan (Teks Saja)</option>
                                        <option value="custom" ${lkpd && lkpd.studentAnsStyle === 'custom' ? 'selected' : ''}>Warna Kustom</option>
                                    </select>
                                </div>
                                <div id="custom-ans-colors-form" class="${lkpd && lkpd.studentAnsStyle === 'custom' ? '' : 'hidden'} grid grid-cols-2 gap-2">
                                    <div>
                                        <label class="block font-bold text-slate-600 mb-1 text-[10px]">Warna Latar</label>
                                        <input type="color" id="lkpd-form-student-ans-bg" value="${lkpd ? (lkpd.studentAnsBg || '#059669') : '#059669'}" class="w-full h-8 p-1 bg-white border border-slate-200 rounded-xl cursor-pointer">
                                    </div>
                                    <div>
                                        <label class="block font-bold text-slate-600 mb-1 text-[10px]">Warna Teks</label>
                                        <input type="color" id="lkpd-form-student-ans-textcolor" value="${lkpd ? (lkpd.studentAnsTextColor || '#ffffff') : '#ffffff'}" class="w-full h-8 p-1 bg-white border border-slate-200 rounded-xl cursor-pointer">
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label class="block font-extrabold text-slate-700 mb-1.5">6. Durasi Pengerjaan (Menit) <span class="text-rose-500">*</span></label>
                        <input type="number" id="lkpd-form-duration" min="5" max="300" required value="${lkpd ? (lkpd.durationMinutes || 45) : 45}" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none">
                    </div>

                    <div>
                        <label class="block font-extrabold text-slate-700 mb-1.5">6. Petunjuk Pengerjaan untuk Siswa</label>
                        <textarea id="lkpd-form-desc" rows="2" placeholder="Tuliskan petunjuk pengerjaan lembar kerja..." class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-slate-700 focus:ring-2 focus:ring-emerald-500 focus:outline-none">${lkpd ? (lkpd.description || '') : ''}</textarea>
                    </div>

                    <div class="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/60 space-y-2.5">
                        <label class="flex items-start gap-2.5 cursor-pointer">
                            <input type="checkbox" id="lkpd-form-active" ${!lkpd || lkpd.status !== 'inactive' ? 'checked' : ''} class="mt-0.5 w-4.5 h-4.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer accent-emerald-600">
                            <div>
                                <span class="font-extrabold text-slate-700 block text-xs">Aktifkan di Akun Siswa (CBT / Ujian Online)</span>
                                <span class="text-[10px] text-slate-500 block leading-normal mt-0.5">Jika dicentang, LKPD ini akan langsung aktif dan muncul sebagai satu paket di portal ujian CBT / online siswa.</span>
                            </div>
                        </label>
                        <label class="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-slate-200/60">
                            <input type="checkbox" id="lkpd-form-allow-pdf" ${!lkpd || lkpd.allowDownloadPdf !== false ? 'checked' : ''} class="mt-0.5 w-4.5 h-4.5 text-emerald-600 border-slate-300 rounded focus:ring-emerald-500 cursor-pointer accent-emerald-600">
                            <div>
                                <span class="font-extrabold text-slate-700 block text-xs">Izinkan Siswa Unduh Hasil PDF</span>
                                <span class="text-[10px] text-slate-500 block leading-normal mt-0.5">Jika dicentang, siswa dapat mengunduh soal, lembar jawaban, nilai, dan hasil koreksi guru dalam format PDF.</span>
                            </div>
                        </label>
                    </div>

                    <div class="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                        <button type="button" onclick="document.getElementById('create-lkpd-modal-bg').remove()" class="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold transition cursor-pointer">
                            Batal
                        </button>
                        <button type="submit" class="px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-2">
                            <i class="fa-solid fa-check"></i> <span>Simpan & Buat Kartu LKPD</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    const old = document.getElementById('create-lkpd-modal-bg');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.toggleCustomAnsStyleForm = function(val) {
    const el = document.getElementById('custom-ans-colors-form');
    if (el) {
        if (val === 'custom') {
            el.classList.remove('hidden');
        } else {
            el.classList.add('hidden');
        }
    }
};

window.toggleFormMarkerTransparent = function(isCheck) {
    const colInput = document.getElementById('lkpd-form-marker-color');
    if (colInput) {
        colInput.disabled = isCheck;
        if (isCheck) colInput.classList.add('opacity-40');
        else colInput.classList.remove('opacity-40');
    }
};

window.handleSaveLkpdForm = async function(event, lkpdId) {
    event.preventDefault();
    const subject = document.getElementById('lkpd-form-subject').value;
    const classVal = document.getElementById('lkpd-form-class').value;
    const title = document.getElementById('lkpd-form-title').value;
    const answeringMode = document.getElementById('lkpd-form-mode').value;
    const desc = document.getElementById('lkpd-form-desc').value;
    const date = document.getElementById('lkpd-form-date').value;
    const durationMinutes = parseInt(document.getElementById('lkpd-form-duration').value) || 45;
    const isActive = document.getElementById('lkpd-form-active') ? document.getElementById('lkpd-form-active').checked : true;
    const status = isActive ? 'active' : 'inactive';
    const allowDownloadPdf = document.getElementById('lkpd-form-allow-pdf') ? document.getElementById('lkpd-form-allow-pdf').checked : true;
    
    // New Customization Fields
    const imageScale = parseInt(document.getElementById('lkpd-form-image-scale').value) || 100;
    const markerSize = parseInt(document.getElementById('lkpd-form-marker-size').value) || 44;
    const isTransparentMarker = document.getElementById('lkpd-form-marker-transparent')?.checked;
    const markerColor = isTransparentMarker ? 'transparent' : (document.getElementById('lkpd-form-marker-color')?.value || '#4f46e5');
    const markerStyle = document.getElementById('lkpd-form-marker-style').value;

    const studentAnsStyle = document.getElementById('lkpd-form-student-ans-style') ? document.getElementById('lkpd-form-student-ans-style').value : 'green';
    const studentAnsBg = document.getElementById('lkpd-form-student-ans-bg') ? document.getElementById('lkpd-form-student-ans-bg').value : '#059669';
    const studentAnsTextColor = document.getElementById('lkpd-form-student-ans-textcolor') ? document.getElementById('lkpd-form-student-ans-textcolor').value : '#ffffff';

    let classId = 'C1';
    let className = 'X-IPA-1';
    if (classVal === 'ALL') {
        classId = 'ALL';
        className = 'Semua Kelas';
    } else if (classVal.includes('::')) {
        const parts = classVal.split('::');
        classId = parts[0];
        className = parts[1];
    } else {
        classId = classVal;
        className = classVal;
    }

    const lkpds = initLkpdState();
    let lkpd = lkpdId ? lkpds.find(l => l.id === lkpdId) : null;

    if (lkpd) {
        lkpd.subjectId = subject;
        lkpd.subjectName = subject;
        lkpd.classId = classId;
        lkpd.className = className;
        lkpd.title = title;
        lkpd.answeringMode = answeringMode;
        lkpd.description = desc;
        lkpd.date = date;
        lkpd.durationMinutes = durationMinutes;
        lkpd.status = status;
        lkpd.allowDownloadPdf = allowDownloadPdf;
        // New Customization
        lkpd.imageScale = imageScale;
        lkpd.markerSize = markerSize;
        lkpd.markerColor = markerColor;
        lkpd.markerStyle = markerStyle;
        lkpd.studentAnsStyle = studentAnsStyle;
        lkpd.studentAnsBg = studentAnsBg;
        lkpd.studentAnsTextColor = studentAnsTextColor;

        showToast("Kartu LKPD berhasil diperbarui!", "success");
    } else {
        lkpd = {
            id: 'LKPD_' + Date.now(),
            subjectId: subject,
            subjectName: subject,
            classId: classId,
            className: className,
            title: title,
            answeringMode: answeringMode,
            description: desc,
            date: date,
            durationMinutes: durationMinutes,
            status: status,
            allowDownloadPdf: allowDownloadPdf,
            imageScale: imageScale,
            markerSize: markerSize,
            markerColor: markerColor,
            markerStyle: markerStyle,
            studentAnsStyle: studentAnsStyle,
            studentAnsBg: studentAnsBg,
            studentAnsTextColor: studentAnsTextColor,
            createdAt: new Date().toISOString(),
            theme: 'biology',
            customImage: null,
            markers: [
                {
                    id: 'mk_' + Date.now() + '_1',
                    number: 1,
                    x: 35,
                    y: 45,
                    question: 'Tuliskan nama bagian organ/komponen yang ditunjuk nomor ini!',
                    answerKey: 'Jawaban kunci soal nomor 1',
                    points: 50,
                    responseType: 'short'
                },
                {
                    id: 'mk_' + Date.now() + '_2',
                    number: 2,
                    x: 65,
                    y: 55,
                    question: 'Jelaskan fungsi dari bagian yang ditunjuk nomor ini!',
                    answerKey: 'Jawaban kunci soal nomor 2',
                    points: 50,
                    responseType: 'essay'
                }
            ],
            submissions: []
        };
        lkpds.unshift(lkpd);
        showToast("Kartu LKPD berhasil dibuat! Silakan kelola titik untuk mengatur soal.", "success");
    }

    await saveLkpdState();
    document.getElementById('create-lkpd-modal-bg')?.remove();
    
    // Re-render LKPD view
    const container = document.getElementById('view-container');
    if (container && typeof window.renderAssessmentModule === 'function') {
        window.renderAssessmentModule(container, 'lkpd');
    }
};

window.deleteLkpd = async function(lkpdId) {
    const performDelete = async () => {
        const lkpds = initLkpdState();
        const idx = lkpds.findIndex(l => l.id === lkpdId);
        if (idx === -1) return;
        const oldImage = lkpds[idx]?.customImage;

        try {
            const response = await fetch('/api/lkpds/' + encodeURIComponent(lkpdId), { method: 'DELETE' });
            const result = await response.json().catch(() => ({ success: false }));
            if (!response.ok || !result.success) {
                showToast(result.message || 'Gagal menghapus LKPD dari server.', 'error');
                return;
            }

            if (Array.isArray(result.lkpdList)) {
                window.appState.lkpdList = result.lkpdList;
            } else {
                lkpds.splice(idx, 1);
            }

            await releaseManagedLkpdImage(oldImage);
            showToast("Kartu LKPD dan aset gambar yang tidak lagi dipakai telah dihapus.", "success");
            const container = document.getElementById('view-container');
            if (container && typeof window.renderAssessmentModule === 'function') {
                window.renderAssessmentModule(container, 'lkpd');
            }
        } catch (err) {
            console.error('[deleteLkpd Error]:', err);
            showToast('Gagal menghapus LKPD karena koneksi ke server bermasalah.', 'error');
        }
    };

    if (typeof showConfirmModal === 'function') {
        showConfirmModal("Apakah Anda yakin ingin menghapus kartu LKPD ini beserta seluruh jawaban siswa dan gambar khususnya?", performDelete);
    } else {
        if (!confirm("Apakah Anda yakin ingin menghapus kartu LKPD ini beserta seluruh jawaban siswa dan gambar khususnya?")) return;
        await performDelete();
    }
};

// ============================================================================
// 3. MANAGE LKPD (Tema LKPD, Import Gambar Bebas, Pasang Nomor Titik Mirip Map Adventure)
// ============================================================================
window.openManageLkpdModal = function(lkpdId) {
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    if (!lkpd) return;

    if (!Array.isArray(lkpd.markers)) lkpd.markers = [];

    const modalHtml = `
        <div id="manage-lkpd-modal-bg" class="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-50 flex items-start justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
            <div class="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-5xl w-full overflow-hidden my-4 sm:my-8 flex flex-col max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-4rem)]">
                <!-- Header -->
                <div class="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
                    <div class="flex items-center space-x-3">
                        <div class="w-11 h-11 bg-emerald-600 text-white rounded-2xl flex items-center justify-center text-xl font-black shadow-md">
                            <i class="fa-solid fa-map-location-dot"></i>
                        </div>
                        <div>
                            <span class="text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest bg-emerald-950 px-2.5 py-0.5 rounded-full border border-emerald-800 inline-block">
                                Kelola Titik Penanda LKPD
                            </span>
                            <h3 class="font-black text-lg text-white">${lkpdEscapeHtml(lkpd.title)}</h3>
                            <p class="text-xs text-slate-300">Pilih tema lembar kerja atau import gambar sendiri, lalu klik pada gambar untuk memberi nomor lokasi jawaban.</p>
                        </div>
                    </div>
                    <button type="button" onclick="closeManageLkpdModal()" class="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Main Scrollable Body -->
                <div class="p-5 sm:p-6 overflow-y-auto space-y-6 text-xs">
                    <!-- Tema & Import Gambar Bar -->
                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div class="lg:col-span-2 bg-slate-50 p-4 rounded-3xl border border-slate-200 space-y-3">
                            <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                <div>
                                    <h4 class="font-extrabold text-sm text-slate-800 flex items-center gap-2">
                                        <i class="fa-solid fa-palette text-indigo-600"></i> Tema & Gambar
                                    </h4>
                                </div>
                                <div class="flex items-center gap-2 flex-wrap">
                                    <label class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition cursor-pointer shadow-xs flex items-center gap-1.5 text-[10px]">
                                        <i class="fa-solid fa-file-import"></i> <span>Import</span>
                                        <input type="file" accept="image/*" class="hidden" onchange="handleImportLkpdImage(event, '${lkpd.id}')">
                                    </label>
                                    ${lkpd.customImage ? `
                                        <button type="button" onclick="resetLkpdToTheme('${lkpd.id}')" class="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition cursor-pointer text-[10px]">
                                            Reset
                                        </button>
                                    ` : ''}
                                </div>
                            </div>

                            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                                ${['biology', 'network', 'geography', 'math'].map(t => {
                                    const icons = { biology: '🔬', network: '💻', geography: '🗺️', math: '📐' };
                                    const labels = { biology: 'Biologi', network: 'TIK', geography: 'Geografi', math: 'Matematika' };
                                    const active = lkpd.theme === t && !lkpd.customImage;
                                    return `
                                        <button type="button" onclick="selectLkpdTheme('${lkpd.id}', '${t}')" class="p-2 rounded-xl border ${active ? 'border-emerald-600 bg-emerald-50 text-emerald-950 font-black' : 'border-slate-200 bg-white text-slate-700 font-bold'} text-left transition cursor-pointer flex items-center gap-1.5">
                                            <span class="text-base">${icons[t]}</span>
                                            <span class="text-[10px] truncate">${labels[t]}</span>
                                        </button>
                                    `;
                                }).join('')}
                            </div>
                        </div>

                        <!-- Visual Customization Controls -->
                        <div class="bg-white p-4 rounded-3xl border border-slate-200 space-y-4 shadow-sm">
                            <h4 class="font-extrabold text-sm text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-2">
                                <i class="fa-solid fa-sliders text-emerald-600"></i> Kustomisasi Visual
                            </h4>
                            
                            <div class="space-y-3">
                                <!-- Image Scale -->
                                <div class="space-y-1">
                                    <div class="flex justify-between items-center">
                                        <label class="text-[10px] font-bold text-slate-600">Ukuran Gambar: <span id="val-img-scale">${lkpd.imageScale || 100}%</span></label>
                                    </div>
                                    <input type="range" min="30" max="150" value="${lkpd.imageScale || 100}" oninput="document.getElementById('val-img-scale').innerText = this.value + '%'; window.updateLkpdVisual('${lkpd.id}', 'imageScale', this.value)" class="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600">
                                </div>

                                <!-- Marker Size -->
                                <div class="space-y-1">
                                    <div class="flex justify-between items-center">
                                        <label class="text-[10px] font-bold text-slate-600">Ukuran Nomor: <span id="val-m-size">${lkpd.markerSize || 44}px</span></label>
                                    </div>
                                    <input type="range" min="20" max="80" value="${lkpd.markerSize || 44}" oninput="document.getElementById('val-m-size').innerText = this.value + 'px'; window.updateLkpdVisual('${lkpd.id}', 'markerSize', this.value)" class="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600">
                                </div>

                                <!-- Marker Color & Style -->
                                <div class="grid grid-cols-2 gap-3">
                                    <div class="space-y-1">
                                        <label class="text-[10px] font-bold text-slate-600">Warna Utama</label>
                                        <div class="flex items-center gap-1.5">
                                            <input type="color" value="${(lkpd.markerColor && lkpd.markerColor !== 'transparent') ? lkpd.markerColor : '#4f46e5'}" onchange="window.updateLkpdVisual('${lkpd.id}', 'markerColor', this.value)" class="w-8 h-8 p-0.5 border border-slate-200 rounded-lg cursor-pointer bg-white ${lkpd.markerColor === 'transparent' ? 'opacity-40' : ''}" title="Pilih Warna Solid">
                                            <button type="button" onclick="window.updateLkpdVisual('${lkpd.id}', 'markerColor', '${lkpd.markerColor === 'transparent' ? '#4f46e5' : 'transparent'}')" class="h-8 px-2 border border-slate-200 rounded-lg text-[10px] font-bold transition flex items-center gap-1 cursor-pointer ${lkpd.markerColor === 'transparent' ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs' : 'bg-slate-50 text-slate-700 hover:bg-slate-100'}" title="Set Warna Transparan (Kaca)">
                                                <i class="fa-solid fa-ghost"></i> Transparan
                                            </button>
                                        </div>
                                    </div>
                                    <div class="space-y-1">
                                        <label class="text-[10px] font-bold text-slate-600">Model</label>
                                        <select onchange="window.updateLkpdVisual('${lkpd.id}', 'markerStyle', this.value)" class="w-full h-8 text-[10px] font-bold border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 px-1">
                                            <option value="standard" ${lkpd.markerStyle === 'standard' ? 'selected' : ''}>Kotak Bulat</option>
                                            <option value="circle" ${lkpd.markerStyle === 'circle' ? 'selected' : ''}>Lingkaran</option>
                                            <option value="transparent" ${lkpd.markerStyle === 'transparent' ? 'selected' : ''}>Transparan</option>
                                            <option value="minimal" ${lkpd.markerStyle === 'minimal' ? 'selected' : ''}>Minimalis</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="border-t border-slate-100 pt-3 space-y-2">
                                    <label class="text-[10px] font-black text-slate-700 uppercase tracking-wider block">Gaya Label Jawaban Siswa (Mode Foto)</label>
                                    <div class="grid grid-cols-2 gap-3">
                                        <div class="space-y-1">
                                            <label class="text-[9px] font-bold text-slate-500">Model</label>
                                            <select onchange="window.updateLkpdVisual('${lkpd.id}', 'studentAnsStyle', this.value); if(this.value === 'custom') { document.getElementById('sidebar-custom-ans-colors')?.classList.remove('hidden'); } else { document.getElementById('sidebar-custom-ans-colors')?.classList.add('hidden'); }" class="w-full h-8 text-[10px] font-bold border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-emerald-500 px-1 font-sans">
                                                <option value="green" ${lkpd.studentAnsStyle === 'green' || !lkpd.studentAnsStyle ? 'selected' : ''}>Hijau Standar</option>
                                                <option value="dark" ${lkpd.studentAnsStyle === 'dark' ? 'selected' : ''}>Gelap / Hitam</option>
                                                <option value="light" ${lkpd.studentAnsStyle === 'light' ? 'selected' : ''}>Terang / Putih</option>
                                                <option value="transparent" ${lkpd.studentAnsStyle === 'transparent' ? 'selected' : ''}>Transparan (Teks Saja)</option>
                                                <option value="custom" ${lkpd.studentAnsStyle === 'custom' ? 'selected' : ''}>Kustom</option>
                                            </select>
                                        </div>
                                        <div id="sidebar-custom-ans-colors" class="${lkpd.studentAnsStyle === 'custom' ? '' : 'hidden'} grid grid-cols-2 gap-1.5">
                                            <div class="space-y-1">
                                                <label class="text-[9px] font-bold text-slate-500">Latar</label>
                                                <input type="color" value="${lkpd.studentAnsBg || '#059669'}" onchange="window.updateLkpdVisual('${lkpd.id}', 'studentAnsBg', this.value)" class="w-full h-8 p-0.5 border border-slate-200 rounded-lg cursor-pointer bg-white">
                                            </div>
                                            <div class="space-y-1">
                                                <label class="text-[9px] font-bold text-slate-500">Teks</label>
                                                <input type="color" value="${lkpd.studentAnsTextColor || '#ffffff'}" onchange="window.updateLkpdVisual('${lkpd.id}', 'studentAnsTextColor', this.value)" class="w-full h-8 p-0.5 border border-slate-200 rounded-lg cursor-pointer bg-white">
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Canvas Area: Click to place marker -->
                    <div class="space-y-2">
                        <div class="flex items-center justify-between px-1">
                            <span class="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                                <i class="fa-solid fa-hand-pointer text-emerald-600 animate-bounce"></i> Klik di sembarang area gambar untuk menaruh nomor baru!
                            </span>
                            <span class="text-slate-500 font-bold text-[11px]">
                                ${lkpd.markers.length} Titik Nomor Terpasang
                            </span>
                        </div>

                        <!-- Render Canvas -->
                        ${renderLkpdCanvasComponent(lkpd, { isEditable: true })}
                    </div>

                    <!-- Table of Markers -->
                    <div class="space-y-3 pt-2">
                        <div class="flex items-center justify-between">
                            <h4 class="font-black text-slate-800 text-sm flex items-center gap-2">
                                <i class="fa-solid fa-list-ol text-emerald-600"></i> Rincian Pertanyaan Berdasarkan Nomor
                            </h4>
                            <span class="text-[11px] text-slate-500 font-semibold">Total Poin: ${lkpd.markers.reduce((sum, m) => sum + (Number(m.points) || 0), 0)}</span>
                        </div>

                        <div class="space-y-2.5">
                            ${lkpd.markers.length === 0 ? `
                                <div class="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                                    Belum ada nomor titik soal pada gambar ini. Silakan klik langsung pada gambar di atas untuk mulai menaruh nomor!
                                </div>
                            ` : lkpd.markers.map((mk, idx) => {
                                const num = mk.number || (idx + 1);
                                return `
                                    <div class="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-emerald-400 transition">
                                        <div class="flex items-start space-x-3.5">
                                            <div class="w-10 h-10 rounded-2xl bg-emerald-600 text-white font-black text-base flex items-center justify-center shrink-0 shadow-xs">
                                                #${num}
                                            </div>
                                            <div class="space-y-1">
                                                <div class="flex items-center gap-2">
                                                    <span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black text-[10px] rounded-full">
                                                        Poin: ${mk.points || 25}
                                                    </span>
                                                    <span class="px-2 py-0.5 bg-slate-100 text-slate-600 font-bold text-[10px] rounded-full">
                                                        Posisi: X ${mk.x}% | Y ${mk.y}%
                                                    </span>
                                                    <span class="px-2 py-0.5 bg-indigo-50 text-indigo-700 font-bold text-[10px] rounded-full">
                                                        ${mk.responseType === 'essay' ? 'Uraian' : 'Isian Singkat'}
                                                    </span>
                                                </div>
                                                <h5 class="font-extrabold text-slate-800 text-xs">${lkpdEscapeHtml(mk.question || `Pertanyaan untuk nomor #${num}`)}</h5>
                                                <p class="text-[11px] text-slate-500"><strong class="text-emerald-700">Kunci Guru:</strong> ${lkpdEscapeHtml(mk.answerKey || '-')}</p>
                                            </div>
                                        </div>

                                        <div class="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                                            <button type="button" onclick="openEditMarkerModal('${lkpd.id}', '${mk.id}')" class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition cursor-pointer flex items-center gap-1">
                                                <i class="fa-solid fa-pen text-[10px]"></i> <span>Edit</span>
                                            </button>
                                            <button type="button" onclick="deleteLkpdMarker('${lkpd.id}', '${mk.id}')" class="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition cursor-pointer" title="Hapus Titik">
                                                <i class="fa-solid fa-trash-can text-xs"></i>
                                            </button>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                </div>

                <!-- Footer Bar -->
                <div class="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                    <span class="text-xs font-bold text-slate-500">${lkpd.markers.length} Titik Nomor Siap Diisi Siswa</span>
                    <div class="flex items-center gap-2">
                        <button type="button" onclick="openStudentLkpdWorksheetModal('${lkpd.id}', 'TEACHER_PREVIEW')" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition cursor-pointer flex items-center gap-1.5">
                            <i class="fa-solid fa-eye text-xs"></i> <span>Uji Tampilan Siswa</span>
                        </button>
                        <button type="button" onclick="closeManageLkpdModal(); renderLkpdCardsView(document.getElementById('view-container'));" class="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow transition cursor-pointer">
                            ✓ Selesai & Simpan LKPD
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    const old = document.getElementById('manage-lkpd-modal-bg');
    if (old) old.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.closeManageLkpdModal = function() {
    document.getElementById('manage-lkpd-modal-bg')?.remove();
};

window.selectLkpdTheme = async function(lkpdId, themeKey) {
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    if (!lkpd) return;
    const oldImage = lkpd.customImage;
    lkpd.theme = themeKey;
    lkpd.customImage = null;
    await saveLkpdState();
    await releaseManagedLkpdImage(oldImage);
    openManageLkpdModal(lkpdId);
};

window.updateLkpdVisual = async function(lkpdId, key, value) {
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    if (!lkpd) return;

    lkpd[key] = value;
    
    if (key === 'markerColor') {
        await saveLkpdState();
        openManageLkpdModal(lkpdId);
        return;
    }
    
    // Refresh canvas only
    const canvasContainer = document.getElementById('lkpd-canvas-wrapper')?.parentElement;
    if (canvasContainer) {
        canvasContainer.innerHTML = `
            <div class="flex items-center justify-between px-1">
                <span class="font-extrabold text-slate-800 text-xs flex items-center gap-1.5">
                    <i class="fa-solid fa-hand-pointer text-emerald-600 animate-bounce"></i> Klik di sembarang area gambar untuk menaruh nomor baru!
                </span>
                <span class="text-slate-500 font-bold text-[11px]">
                    ${lkpd.markers.length} Titik Nomor Terpasang
                </span>
            </div>
            ${renderLkpdCanvasComponent(lkpd, { isEditable: true })}
        `;
    }

    // Debounced save
    if (window._lkpdSaveTimeout) clearTimeout(window._lkpdSaveTimeout);
    window._lkpdSaveTimeout = setTimeout(() => {
        saveLkpdState();
    }, 1000);
};

window.resetLkpdToTheme = async function(lkpdId) {
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    if (!lkpd) return;
    const oldImage = lkpd.customImage;
    lkpd.customImage = null;
    await saveLkpdState();
    await releaseManagedLkpdImage(oldImage);
    openManageLkpdModal(lkpdId);
};

window.handleImportLkpdImage = function(event, lkpdId) {
    const file = event.target.files[0];
    if (!file) return;
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!allowed.includes(file.type)) {
        showToast("Gunakan gambar PNG, JPG, atau WebP. SVG tidak diizinkan untuk aset terkelola.", "error");
        return;
    }
    if (file.size > 2 * 1024 * 1024) {
        showToast("Ukuran gambar maksimal 2 MB.", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = async function(e) {
        try {
            const base64 = e.target.result;
            const lkpds = initLkpdState();
            const lkpd = lkpds.find(l => l.id === lkpdId);
            if (!lkpd) return;
            const oldImage = lkpd.customImage;
            const managedRef = await uploadManagedLkpdImage(base64);
            lkpd.customImage = managedRef;
            await saveLkpdState();
            await releaseManagedLkpdImage(oldImage);
            showToast("Gambar LKPD berhasil disimpan ke penyimpanan terkelola.", "success");
            openManageLkpdModal(lkpdId);
        } catch (err) {
            console.error('Gagal mengunggah gambar LKPD:', err);
            showToast(err.message || 'Gagal mengunggah gambar LKPD.', 'error');
        }
    };
    reader.readAsDataURL(file);
};

// Handle click on canvas to add marker
window.handleCanvasClickToAddMarker = async function(event, lkpdId) {
    const wrapper = document.getElementById('lkpd-canvas-wrapper');
    if (!wrapper) return;

    const rect = wrapper.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const xPercent = Math.max(2, Math.min(98, Math.round((clickX / rect.width) * 100)));
    const yPercent = Math.max(2, Math.min(98, Math.round((clickY / rect.height) * 100)));

    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    if (!lkpd) return;

    if (!Array.isArray(lkpd.markers)) lkpd.markers = [];
    const newNumber = lkpd.markers.length + 1;
    const newMarker = {
        id: 'mk_' + Date.now(),
        number: newNumber,
        x: xPercent,
        y: yPercent,
        question: `Tuliskan nama organ / komponen pada nomor #${newNumber} dan jelaskan fungsinya!`,
        answerKey: `Kunci jawaban guru untuk nomor #${newNumber}`,
        points: 25,
        responseType: 'short'
    };

    lkpd.markers.push(newMarker);
    await saveLkpdState();
    showToast(`Titik nomor #${newNumber} berhasil ditempatkan!`, "success");
    openManageLkpdModal(lkpdId);
};

window.openEditMarkerModal = function(lkpdId, markerId) {
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    if (!lkpd) return;
    const marker = lkpd.markers.find(m => m.id === markerId);
    if (!marker) return;

    const modalHtml = `
        <div id="edit-marker-modal-bg" class="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-60 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
            <div class="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden my-6">
                <div class="bg-indigo-700 p-5 text-white flex items-center justify-between">
                    <h4 class="font-extrabold text-sm flex items-center gap-2">
                        <i class="fa-solid fa-pen-to-square"></i> Konfigurasi Soal Titik Nomor ${marker.number}
                    </h4>
                    <button type="button" onclick="document.getElementById('edit-marker-modal-bg').remove()" class="text-white/80 hover:text-white transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <form onsubmit="handleSaveMarkerForm(event, '${lkpd.id}', '${marker.id}')" class="p-5 space-y-4 text-xs font-semibold text-slate-700">
                    <div>
                        <label class="block mb-1">Nomor Urut Titik</label>
                        <input type="number" id="mk-num" value="${marker.number}" required min="1" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold">
                    </div>

                    <div>
                        <label class="block mb-1">Pertanyaan / Instruksi untuk Nomor Ini <span class="text-rose-500">*</span></label>
                        <textarea id="mk-q" rows="3" required class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl">${marker.question || ''}</textarea>
                    </div>

                    <div>
                        <label class="block mb-1">Kunci Jawaban Guru / Rubrik Penskoran</label>
                        <textarea id="mk-ans" rows="2" placeholder="Contoh: Mitokondria (penghasil energi ATP)" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl">${marker.answerKey || ''}</textarea>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="block mb-1">Bobot Nilai (Poin)</label>
                            <input type="number" id="mk-points" value="${marker.points || 25}" required min="1" max="100" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold">
                        </div>
                        <div>
                            <label class="block mb-1">Tipe Isian</label>
                            <select id="mk-type" class="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold">
                                <option value="short" ${marker.responseType === 'short' ? 'selected' : ''}>Isian Singkat</option>
                                <option value="essay" ${marker.responseType === 'essay' ? 'selected' : ''}>Uraian Panjang</option>
                            </select>
                        </div>
                    </div>

                    <div class="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <div>
                            <label class="block text-[10px] text-slate-400 mb-1">Posisi X (%)</label>
                            <input type="number" id="mk-x" value="${marker.x}" min="1" max="99" class="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold">
                        </div>
                        <div>
                            <label class="block text-[10px] text-slate-400 mb-1">Posisi Y (%)</label>
                            <input type="number" id="mk-y" value="${marker.y}" min="1" max="99" class="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg font-bold">
                        </div>
                    </div>

                    <div class="pt-2 flex items-center justify-between">
                        <button type="button" onclick="deleteLkpdMarker('${lkpd.id}', '${marker.id}')" class="text-rose-500 hover:text-rose-700 font-bold text-xs flex items-center gap-1 cursor-pointer">
                            <i class="fa-solid fa-trash-can"></i> Hapus Titik Ini
                        </button>
                        <button type="submit" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl shadow transition cursor-pointer">
                            Simpan Perubahan
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('edit-marker-modal-bg')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.handleSaveMarkerForm = async function(event, lkpdId, markerId) {
    event.preventDefault();
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    if (!lkpd) return;
    const marker = lkpd.markers.find(m => m.id === markerId);
    if (!marker) return;

    marker.number = Number(document.getElementById('mk-num').value) || marker.number;
    marker.question = document.getElementById('mk-q').value;
    marker.answerKey = document.getElementById('mk-ans').value;
    marker.points = Number(document.getElementById('mk-points').value) || 25;
    marker.responseType = document.getElementById('mk-type').value;
    marker.x = Number(document.getElementById('mk-x').value) || marker.x;
    marker.y = Number(document.getElementById('mk-y').value) || marker.y;

    await saveLkpdState();
    document.getElementById('edit-marker-modal-bg')?.remove();
    showToast("Data titik soal diperbarui!", "success");
    openManageLkpdModal(lkpdId);
};

window.deleteLkpdMarker = async function(lkpdId, markerId) {
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    if (!lkpd) return;
    const idx = lkpd.markers.findIndex(m => m.id === markerId);
    if (idx !== -1) {
        lkpd.markers.splice(idx, 1);
        // Re-number
        lkpd.markers.forEach((m, i) => { m.number = i + 1; });
        await saveLkpdState();
        document.getElementById('edit-marker-modal-bg')?.remove();
        showToast("Titik soal dihapus.", "success");
        openManageLkpdModal(lkpdId);
    }
};

/// ============================================================================
// 4. STUDENT WORKSHEET / SIMULATION VIEW (Tempat Murid Menulis Jawabannya)
// ============================================================================
window.updateLkpdNavGrid = function() {
    const lkId = window.activeLkpdIdForStudent;
    if (!lkId || !window.lkpdDraftAnswers) return;
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkId);
    if (!lkpd) return;
    
    let answered = 0;
    lkpd.markers.forEach((mk, idx) => {
        const num = mk.number || (idx + 1);
        const val = window.lkpdDraftAnswers[mk.id] || '';
        const isAnswered = String(val).trim().length > 0;
        if (isAnswered) answered++;
        
        const btn = document.getElementById(`nav-btn-${mk.id}`);
        if (btn) {
            if (isAnswered) {
                btn.className = "w-10 h-10 rounded-2xl text-xs font-black transition flex items-center justify-center cursor-pointer bg-emerald-100 text-emerald-800 border-2 border-emerald-300 shadow-xs";
            } else {
                btn.className = "w-10 h-10 rounded-2xl text-xs font-black transition flex items-center justify-center cursor-pointer bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200";
            }
        }
    });
    
    const badge = document.getElementById('answered-badge');
    if (badge) badge.innerText = answered;
};

window.openStudentLkpdWorksheetModal = function(lkpdId, studentId = null) {
    const appState = window.appState || {};
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    if (!lkpd) return;

    const currentUser = window.appState.currentUser || { id: 'ST1', name: 'Muhammad Al Fatih', nis: '1001' };
    const currentRole = String(currentUser.role || window.appState?.role || '').toLowerCase().trim();
    const isTeacherPreview = studentId === 'TEACHER_PREVIEW' ||
        String(window.appState?.activeAccount || '').toUpperCase() === 'ADMIN' ||
        ['teacher', 'guru', 'admin', 'administrator'].includes(currentRole);

    window.isTeacherPreviewMode = isTeacherPreview;

    const stId = isTeacherPreview ? 'TEACHER_PREVIEW' : (studentId || currentUser.id || 'ST1');
    const stName = isTeacherPreview ? `Simulasi Guru (${currentUser.name || 'Pengajar'})` : (currentUser.name || 'Siswa Madrasah');
    const stNis = isTeacherPreview ? 'GURU-001' : (currentUser.nis || '1001');

    const existingSub = Array.isArray(lkpd.submissions) ? lkpd.submissions.find(s => s.studentId === stId) : null;
    let savedLocalDraft = {};
    if (!isTeacherPreview) {
        try {
            const rawLocal = localStorage.getItem(`madrasah_lkpd_draft_${stId}_${lkpdId}`);
            if (rawLocal) savedLocalDraft = JSON.parse(rawLocal) || {};
        } catch(e) {}
    }

    const draftAnswers = { ...(existingSub ? existingSub.answers : {}), ...savedLocalDraft };
    
    // Save active LKPD session & route ONLY FOR REAL STUDENTS
    if (!isTeacherPreview) {
        try {
            localStorage.setItem('madrasah_active_lkpd_session', JSON.stringify({ lkpdId, studentId: stId, studentName: stName, nis: stNis }));
            localStorage.setItem('madrasah_last_route', 'lkpd_worksheet');
        } catch(e) {}
    }

    // Set globals for mode-on-photo support
    window.activeLkpdIdForStudent = lkpdId;
    window.activeStudentIdForLkpd = stId;
    window.lkpdDraftAnswers = { ...draftAnswers };

    const durationMin = lkpd.durationMinutes || 45;

    const modalHtml = `
        <div class="space-y-4 max-w-7xl mx-auto pb-16 relative w-full flex flex-col min-h-[calc(100vh-2rem)]">
            ${isTeacherPreview ? `
                <!-- Teacher Preview Banner -->
                <div class="bg-amber-500 text-slate-950 p-3.5 rounded-2xl flex flex-wrap items-center justify-between text-xs font-black shadow-md border border-amber-400 gap-2">
                    <div class="flex items-center gap-2">
                        <i class="fa-solid fa-eye text-base"></i>
                        <span>PRATINJAU TAMPILAN SISWA (SIMULASI GURU)</span>
                        <span class="text-[11px] font-semibold text-slate-900 hidden sm:inline">&bull; Akun Anda tidak berubah (tetap Guru/Admin). Ini adalah gambaran persis apa yang dilihat oleh siswa.</span>
                    </div>
                    <button type="button" onclick="closeStudentLkpdWorksheetModal()" class="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl shadow cursor-pointer flex items-center gap-1.5 transition">
                        <i class="fa-solid fa-arrow-left"></i> Kembali ke Kelola LKPD
                    </button>
                </div>
            ` : `
                <!-- DND & Protection Status Banner -->
                <div class="bg-slate-900 text-white p-3 rounded-2xl flex flex-wrap items-center justify-between text-xs font-medium border border-slate-700 shadow-sm gap-2">
                    <div class="flex items-center gap-2">
                        <span class="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        <span class="font-bold text-emerald-300"><i class="fa-solid fa-shield-halved mr-1"></i> Mode Ujian LKPD Aktif</span>
                        <span class="text-slate-400 text-[11px] hidden sm:inline">| Terkoneksi ke Monitoring Live Guru & Proteksi DND</span>
                    </div>
                    <div class="flex items-center gap-2 text-[11px]">
                        <button type="button" onclick="if(document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(()=>{});" class="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-xl border border-slate-600 cursor-pointer">
                            <i class="fa-solid fa-expand mr-1"></i> Fullscreen
                        </button>
                    </div>
                </div>
            `}

            <!-- Sticky Header Timer & Info -->
            <div class="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs flex justify-between items-center sticky top-2 z-20">
                <div>
                    <span class="text-[10px] font-extrabold text-emerald-600 uppercase tracking-widest bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-100 inline-block mb-1">
                        Portal Ujian Lembar Kerja (LKPD)
                    </span>
                    <h3 class="font-black text-slate-800 text-base sm:text-lg leading-tight">${lkpdEscapeHtml(lkpd.title)}</h3>
                    <p class="text-xs text-slate-500 font-medium">Siswa: <strong>${stName}</strong> (${stNis}) &bull; Kelas: <strong>${lkpd.className || 'Semua Kelas'}</strong></p>
                </div>
                <div class="px-3.5 py-2 bg-rose-50 text-rose-700 rounded-2xl text-xs font-mono font-bold flex items-center space-x-2 border border-rose-200 shadow-xs">
                    <i class="fa-solid fa-stopwatch animate-pulse"></i>
                    <span id="lkpd-timer-display">${durationMin}:00</span>
                </div>
            </div>

            <div class="bg-white rounded-3xl border border-slate-200 shadow-xl w-full flex flex-col flex-1 overflow-hidden">
                <!-- Two Column Layout: Left Canvas, Right Answers Form -->
                <div class="grid grid-cols-1 ${lkpd.answeringMode === 'on-photo' ? '' : 'lg:grid-cols-12'} gap-6 p-4 sm:p-6 flex-1">
                    <!-- Left: Interactive Canvas with numbered pins -->
                    <div class="${lkpd.answeringMode === 'on-photo' ? 'max-w-4xl mx-auto w-full' : 'lg:col-span-7'} space-y-3">
                        <div class="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 text-emerald-900 text-xs font-semibold flex items-center gap-2">
                            <i class="fa-solid fa-lightbulb text-amber-500 text-sm shrink-0"></i>
                            <span>${lkpd.answeringMode === 'on-photo' ? 'Klik pin nomor pada gambar untuk menjawab secara langsung di atas foto!' : 'Klik pin nomor pada gambar di bawah untuk langsung menuju kolom isian jawaban nomor tersebut!'}</span>
                        </div>
 
                        ${renderLkpdCanvasComponent(lkpd, {
                            isEditable: false,
                            isPreview: true,
                            studentAnswers: draftAnswers,
                            onMarkerClickFn: lkpd.answeringMode === 'on-photo' ? 'openTransparentAnswerModal' : 'focusStudentAnswerField'
                        })}
                    </div>
 
                    <!-- Right: Question and Answer Form (Hidden in on-photo mode) -->
                    ${lkpd.answeringMode === 'on-photo' ? '' : `
                    <div class="lg:col-span-5 flex flex-col bg-slate-50 border border-slate-200 rounded-3xl shadow-inner lg:sticky lg:top-4 lg:h-[calc(100vh-3rem)]">
                        <div class="p-4 border-b border-slate-200 bg-white shadow-sm shrink-0 rounded-t-3xl">
                            <h4 class="font-extrabold text-sm text-slate-800 flex items-center justify-between">
                                <span><i class="fa-solid fa-clipboard-question text-emerald-600 mr-1.5"></i> Kolom Jawaban Siswa</span>
                                <span class="text-[11px] px-2 py-0.5 bg-slate-100 rounded-lg text-slate-600 font-bold">${lkpd.markers.length} Soal</span>
                            </h4>
                        </div>
                        <div class="p-4 space-y-3.5 overflow-y-auto flex-1 bg-slate-50">
                            ${lkpd.markers.length === 0 ? `
                                <div class="p-8 text-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300">
                                    Belum ada soal pada LKPD ini.
                                </div>
                            ` : lkpd.markers.map((mk, idx) => {
                                const num = mk.number || (idx + 1);
                                const curVal = draftAnswers[mk.id] || '';
                                return `
                                    <div id="answer-card-${mk.id}" class="bg-white p-4 rounded-2xl border border-slate-200 transition focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 shadow-sm space-y-2">
                                        <div class="flex items-center justify-between">
                                            <span class="px-2.5 py-0.5 bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs">
                                                Nomor #${num}
                                            </span>
                                            <span class="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 rounded border border-slate-200">Bobot: ${mk.points || 25} Poin</span>
                                        </div>
                                        <p class="text-xs font-bold text-slate-800 leading-snug">${lkpdEscapeHtml(mk.question)}</p>
                                        
                                        <div class="pt-1">
                                            <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Jawaban Anda:</label>
                                            ${mk.responseType === 'essay' ? `
                                                <textarea id="ans-input-${mk.id}" rows="3" placeholder="Tuliskan uraian jawaban Anda..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 transition disabled:opacity-75 disabled:bg-slate-100 disabled:cursor-not-allowed" ${existingSub ? 'disabled' : ''}>${curVal}</textarea>
                                            ` : `
                                                <input type="text" id="ans-input-${mk.id}" value="${curVal}" placeholder="Tuliskan nama / isian singkat..." class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 text-slate-800 transition disabled:opacity-75 disabled:bg-slate-100 disabled:cursor-not-allowed" ${existingSub ? 'disabled' : ''}>
                                            `}
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>
 
                        <!-- Submit Button -->
                        <div class="p-4 border-t border-slate-200 bg-white shrink-0 space-y-2 shadow-sm rounded-b-3xl">
                            ${existingSub ? `
                                <button type="button" onclick="closeStudentLkpdWorksheetModal()" class="w-full py-3 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-slate-800/20 transition flex items-center justify-center gap-2 cursor-pointer">
                                    <i class="fa-solid fa-arrow-left"></i> <span>Tutup & Kembali</span>
                                </button>
                            ` : `
                                <button type="button" onclick="submitStudentLkpdAnswers('${lkpd.id}', '${stId}', '${stName}', '${stNis}')" class="w-full py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-xs rounded-2xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer">
                                    <i class="fa-solid fa-paper-plane"></i> <span>Kumpulkan Jawaban LKPD</span>
                                </button>
                            `}
                            ${existingSub && existingSub.isGraded ? `
                                <div class="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-center">
                                    <span class="text-xs font-black text-amber-900"><i class="fa-solid fa-check-circle mr-1 text-emerald-600"></i> Sudah Dinilai Guru: Skor ${existingSub.totalScore}/100</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                    `}
                </div>
 
                ${lkpd.answeringMode === 'on-photo' ? `
                <!-- Full Width Submit Footer for on-photo mode -->
                <div class="p-6 bg-slate-50 border-t border-slate-200 rounded-b-3xl flex justify-center">
                     <div class="max-w-md w-full">
                          ${existingSub ? `
                                <button type="button" onclick="closeStudentLkpdWorksheetModal()" class="w-full py-4 bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-slate-800/20 transition flex items-center justify-center gap-2 cursor-pointer">
                                    <i class="fa-solid fa-arrow-left"></i> <span>Tutup & Kembali</span>
                                </button>
                            ` : `
                                <button type="button" onclick="submitStudentLkpdAnswers('${lkpd.id}', '${stId}', '${stName}', '${stNis}')" class="w-full py-4 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold text-sm rounded-2xl shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2 cursor-pointer">
                                    <i class="fa-solid fa-paper-plane"></i> <span>Kumpulkan Jawaban LKPD</span>
                                </button>
                            `}
                     </div>
                </div>
                ` : ''}
            </div>

            <!-- CBT-style Question Navigation Grid -->
            <div class="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-2.5">
                <div class="flex items-center justify-between text-xs font-extrabold text-slate-800">
                    <span><i class="fa-solid fa-list-ol text-emerald-600 mr-2"></i> Navigasi Titik LKPD (<span id="answered-badge">0</span>/${lkpd.markers.length} Terjawab)</span>
                    <span class="text-[10px] text-slate-400">Klik nomor untuk langsung melompat ke kolom isian nomor tersebut</span>
                </div>
                <div class="flex flex-wrap gap-2 pt-1">
                    ${lkpd.markers.map((mk, idx) => {
                        const num = mk.number || (idx + 1);
                        const isAnswered = Boolean(draftAnswers[mk.id] && String(draftAnswers[mk.id]).trim() !== '');
                        return `
                            <button type="button" id="nav-btn-${mk.id}" onclick="window.focusStudentAnswerField('${mk.id}', ${num})" class="w-10 h-10 rounded-2xl text-xs font-black transition flex items-center justify-center cursor-pointer ${isAnswered ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-300 shadow-xs' : 'bg-slate-100 text-slate-600 border border-slate-200 hover:bg-slate-200'}">
                                ${num}
                            </button>
                        `;
                    }).join('')}
                </div>
            </div>
        </div>
    `;

    document.getElementById('student-lkpd-modal-bg')?.remove();

    if (isTeacherPreview) {
        // LKPD_PREVIEW_SESSION_ISOLATION_V1: keep the authenticated route and
        // navigation mounted underneath an isolated preview overlay. Closing
        // the preview therefore cannot rebuild the app as another account.
        const previewOverlay = document.createElement('div');
        previewOverlay.id = 'student-lkpd-modal-bg';
        previewOverlay.className = 'fixed inset-0 z-[200] overflow-y-auto bg-slate-100 p-3 sm:p-6';
        previewOverlay.setAttribute('role', 'dialog');
        previewOverlay.setAttribute('aria-modal', 'true');
        previewOverlay.setAttribute('aria-label', 'Pratinjau LKPD siswa');
        previewOverlay.innerHTML = modalHtml;
        document.body.appendChild(previewOverlay);
        document.body.classList.add('overflow-hidden');
    } else {
        // A real student worksheet remains a focused full-page route.
        const sidebar = document.getElementById('sidebar');
        const header = document.querySelector('header');
        if (sidebar) sidebar.style.display = 'none';
        if (header) header.style.display = 'none';

        const container = document.getElementById('view-container');
        if (container) container.innerHTML = modalHtml;
    }

    // Record active session
    if (!isTeacherPreview) {
        window.activeLkpdSession = { lkpdId: lkpd.id, studentId: stId, studentName: stName, nis: stNis };
        window._lastLkpdStudentMessage = '';
        window.__latestLkpdFrame = null;
        
        // Set active status on server
        const sessionKey = stId + '_' + lkpd.id;
        if (!appState.activeExamSessions) appState.activeExamSessions = {};
        appState.activeExamSessions[sessionKey] = {
            studentId: stId,
            studentName: stName,
            lkpdId: lkpd.id,
            answeredCount: Object.values(draftAnswers).filter(v => String(v).trim().length > 0).length,
            totalQuestions: lkpd.markers.length,
            startedAt: new Date().toISOString()
        };
        if (window.syncLkpdStudentState) {
            window.syncLkpdStudentState({
                lkpdId: lkpd.id,
                active: true,
                answeredCount: appState.activeExamSessions[sessionKey].answeredCount
            });
        }

        // Initialize Camera PIP
        window.initStudentLkpdCamera(lkpd.id, stId);
    } else {
        window.activeLkpdSession = { lkpdId: lkpd.id, studentId: 'TEACHER_PREVIEW', isPreview: true };
    }
    
    // Start countdown timer
    let secondsLeft = durationMin * 60;
    if (window._lkpdCountdownInterval) clearInterval(window._lkpdCountdownInterval);
    window._lkpdCountdownInterval = setInterval(() => {
        if (!window.activeLkpdSession) {
            clearInterval(window._lkpdCountdownInterval);
            return;
        }
        secondsLeft--;
        if (secondsLeft <= 0) {
            clearInterval(window._lkpdCountdownInterval);
            secondsLeft = 0;
            showToast("Waktu pengerjaan LKPD telah habis! Jawaban Anda akan dikumpulkan otomatis.", "warning");
            submitStudentLkpdAnswers(lkpdId, stId, stName, stNis);
        }
        const timerDisplay = document.getElementById('lkpd-timer-display');
        if (timerDisplay) {
            const mins = Math.floor(secondsLeft / 60);
            const secs = secondsLeft % 60;
            timerDisplay.innerText = `${mins}:${String(secs).padStart(2, '0')}`;
        }
    }, 1000);

    // Add input listener to worksheet content to update draft answers real-time & auto-save to localStorage
    setTimeout(() => {
        const worksheetBody = document.getElementById('view-container');
        if (worksheetBody) {
            worksheetBody.addEventListener('input', (e) => {
                if (e.target && e.target.id && e.target.id.startsWith('ans-input-')) {
                    const markerId = e.target.id.replace('ans-input-', '');
                    if (!window.lkpdDraftAnswers) window.lkpdDraftAnswers = {};
                    window.lkpdDraftAnswers[markerId] = e.target.value;
                    try {
                        localStorage.setItem(`madrasah_lkpd_draft_${stId}_${lkpdId}`, JSON.stringify(window.lkpdDraftAnswers));
                    } catch(err) {}
                    window.updateLkpdNavGrid();
                }
            });
            window.updateLkpdNavGrid();
        }
    }, 500);

    // Register active listeners for cheat detection
    if (!window._lkpdListenersAdded) {
        window._lkpdListenersAdded = true;
        document.addEventListener('visibilitychange', () => {
            if (!window.activeLkpdSession) return;
            if (document.hidden) {
                window.triggerLkpdViolation('Keluar Tab / Aplikasi LKPD');
            } else {
                const key = window.activeLkpdSession.studentId + '_' + window.activeLkpdSession.lkpdId;
                if (!appState.studentOutOfTab) appState.studentOutOfTab = {};
                appState.studentOutOfTab[key] = false;
                if (window.syncLkpdStudentState) {
                    window.syncLkpdStudentState({
                        lkpdId: window.activeLkpdSession.lkpdId,
                        active: true,
                        outOfTab: false,
                        answeredCount: Object.values(window.lkpdDraftAnswers || {}).filter(v => String(v).trim().length > 0).length
                    });
                }
            }
        });

        window.addEventListener('blur', () => {
            if (!window.activeLkpdSession) return;
            if (document.hidden) return;

            const isInputActive = document.activeElement && 
                (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName) || document.activeElement.isContentEditable);

            if (!isInputActive) {
                window.triggerLkpdViolation('Keluar Fokus / Aplikasi Melayang (Pop-up)');
            }
        });
    }

    // Dedicated identity-scoped LKPD heartbeat + monitoring poll.
    if (window._lkpdStudentPollInterval) clearInterval(window._lkpdStudentPollInterval);
    window._lkpdFrameUploadTick = 0;
    window._lkpdStudentPollInterval = setInterval(async () => {
        if (!window.activeLkpdSession) {
            clearInterval(window._lkpdStudentPollInterval);
            return;
        }

        const { lkpdId, studentId } = window.activeLkpdSession;
        const answeredCount = Object.values(window.lkpdDraftAnswers || {}).filter(v => String(v).trim().length > 0).length;
        const payload = { lkpdId, active: true, answeredCount };

        window._lkpdFrameUploadTick = (Number(window._lkpdFrameUploadTick || 0) + 1) % 3;
        if (window._lkpdFrameUploadTick === 0 && window.__latestLkpdFrame) {
            payload.livecamFrame = window.__latestLkpdFrame;
        }

        const data = window.syncLkpdStudentState ? await window.syncLkpdStudentState(payload) : null;
        if (!data || !data.success) return;

        const sessionKey = studentId + '_' + lkpdId;
        if (!appState.activeExamSessions) appState.activeExamSessions = {};
        if (data.session) {
            appState.activeExamSessions[sessionKey] = {
                ...(appState.activeExamSessions[sessionKey] || {}),
                ...data.session,
                studentId,
                lkpdId
            };
        }
        if (!appState.studentTabSwitches) appState.studentTabSwitches = {};
        if (!appState.studentOutOfTab) appState.studentOutOfTab = {};
        if (!appState.blockedStudents) appState.blockedStudents = {};
        appState.studentTabSwitches[sessionKey] = Number(data.tabSwitches || 0);
        appState.studentOutOfTab[sessionKey] = data.outOfTab === true;
        appState.blockedStudents[sessionKey] = data.blocked === true;

        const activeMsg = data.messagePersonal || data.messageBroadcast;
        const messageToken = activeMsg ? String(activeMsg) : '';
        if (activeMsg && window._lastLkpdStudentMessage !== messageToken) {
            window._lastLkpdStudentMessage = messageToken;
            showToast(`PESAN GURU: "${activeMsg}"`, 'info', 8000);
            if (data.messagePersonal && window.ackLkpdStudentMessage) {
                window.ackLkpdStudentMessage(lkpdId);
            }
        }

        if (data.blocked) {
            let blockOverlay = document.getElementById('lkpd-blocked-overlay');
            if (!blockOverlay) {
                blockOverlay = document.createElement('div');
                blockOverlay.id = 'lkpd-blocked-overlay';
                blockOverlay.className = 'fixed inset-0 z-[110] flex flex-col items-center justify-center bg-rose-950/95 text-white p-6 text-center space-y-4';
                blockOverlay.innerHTML = `
                    <div class="w-20 h-20 bg-rose-900 rounded-full flex items-center justify-center text-4xl animate-bounce">
                        <i class="fa-solid fa-ban"></i>
                    </div>
                    <h2 class="font-black text-2xl">AKSES LKPD DIBLOKIR</h2>
                    <p class="text-xs text-rose-200 max-w-md">Layar pengerjaan Anda telah diblokir oleh guru pengawas karena terindikasi melakukan pelanggaran tata tertib.</p>
                    <p class="text-[11px] text-rose-300">Hubungi pengawas untuk membuka kembali akses Anda.</p>
                `;
                document.body.appendChild(blockOverlay);
            }
        } else {
            document.getElementById('lkpd-blocked-overlay')?.remove();
        }
    }, 5000);
};

window.closeStudentLkpdWorksheetModal = function() {
    const appState = window.appState || {};
    const isPreview = window.isTeacherPreviewMode === true || window.activeLkpdSession?.isPreview === true;

    // Stop camera stream
    if (window.__studentLkpdWebcamStream) {
        try {
            window.__studentLkpdWebcamStream.getTracks().forEach(t => t.stop());
        } catch(e) {}
        window.__studentLkpdWebcamStream = null;
    }
    if (window._studentLkpdSnapshotInterval) {
        clearInterval(window._studentLkpdSnapshotInterval);
        window._studentLkpdSnapshotInterval = null;
    }
    if (window._lkpdStudentPollInterval) {
        clearInterval(window._lkpdStudentPollInterval);
        window._lkpdStudentPollInterval = null;
    }
    if (window._lkpdCountdownInterval) {
        clearInterval(window._lkpdCountdownInterval);
        window._lkpdCountdownInterval = null;
    }
    
    // Clear active session if not preview
    if (!isPreview && window.activeLkpdSession) {
        const { lkpdId, studentId } = window.activeLkpdSession;
        if (studentId !== 'TEACHER_PREVIEW') {
            const sessionKey = studentId + '_' + lkpdId;
            if (appState.activeExamSessions) delete appState.activeExamSessions[sessionKey];
            if (window.syncLkpdStudentState) {
                window.syncLkpdStudentState({ lkpdId, active: false });
            }
        }
    }
    window.activeLkpdSession = null;
    window._lastLkpdStudentMessage = '';
    window.__latestLkpdFrame = null;
    window.isTeacherPreviewMode = false;

    if (!isPreview) {
        try {
            localStorage.removeItem('madrasah_active_lkpd_session');
            if (localStorage.getItem('madrasah_last_route') === 'lkpd_worksheet') {
                localStorage.removeItem('madrasah_last_route');
            }
        } catch(e) {}
    }

    document.getElementById('student-lkpd-modal-bg')?.remove();
    document.body.classList.remove('overflow-hidden');

    // Preview never replaced the underlying route or hid its navigation.
    if (isPreview) return;

    // Restore navigation
    const sidebar = document.getElementById('sidebar');
    const header = document.querySelector('header');
    if (sidebar) sidebar.style.display = '';
    if (header) header.style.display = '';
    
    // Route back based on account role
    if (window.appState?.activeAccount === 'ADMIN') {
        if (typeof window.renderAssessmentModule === 'function') {
            window.renderAssessmentModule(document.getElementById('view-container'), 'lkpd');
        } else if (typeof window.renderLkpdCardsView === 'function') {
            window.renderLkpdCardsView(document.getElementById('view-container'));
        }
    } else if (window.renderStudentCBTList) {
        window.renderStudentCBTList(document.getElementById('view-container'));
    }
};

window.initStudentLkpdCamera = function(lkpdId, studentId) {
    let pip = document.getElementById('student-lkpd-pip-container');
    if (!pip) {
        pip = document.createElement('div');
        pip.id = 'student-lkpd-pip-container';
        pip.className = 'hidden';
        document.body.appendChild(pip);
    }
    if (!pip) return;

    pip.innerHTML = `
        <video id="student-lkpd-webcam-preview" autoplay muted playsinline class="w-full h-full object-cover" style="transform: scaleX(-1);"></video>
        <div class="absolute bottom-1.5 right-1.5 px-2 py-0.5 bg-emerald-600/90 backdrop-blur text-white font-extrabold text-[8px] rounded-md uppercase tracking-wider shadow border border-emerald-400/20">
            Kamera Pengawas
        </div>
    `;

    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        .then(stream => {
            const video = document.getElementById('student-lkpd-webcam-preview');
            if (video) {
                video.srcObject = stream;
                video.muted = true;
                video.play().catch(() => {});
            }
            window.__studentLkpdWebcamStream = stream;

            // Start snapshot captures
            if (window._studentLkpdSnapshotInterval) clearInterval(window._studentLkpdSnapshotInterval);
            window._studentLkpdSnapshotInterval = setInterval(() => {
                if (window.__studentLkpdWebcamStream && video && video.videoWidth > 0) {
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = 240;
                        canvas.height = 180;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                        const frameData = canvas.toDataURL('image/jpeg', 0.4);
                        const key = studentId + '_' + lkpdId;
                        
                        if (!appState.runtimeLivecamFrames) appState.runtimeLivecamFrames = {};
                        appState.runtimeLivecamFrames[key] = frameData;
                        
                        window.__latestLkpdFrame = frameData;
                    } catch(e) {}
                }
            }, 4000);
        })
        .catch(err => {
            pip.innerHTML = `
                <div class="text-[9px] text-amber-300 text-center p-2 leading-tight flex flex-col items-center justify-center h-full bg-slate-950">
                    <i class="fa-solid fa-triangle-exclamation text-amber-500 text-lg mb-1"></i>
                    <span class="font-extrabold">Kamera Blokir</span>
                    <span class="text-[8px] text-slate-500 mt-0.5">Berikan Izin Kamera</span>
                </div>
            `;
        });
};

window.triggerLkpdViolation = function(reason) {
    if (!window.activeLkpdSession) return;
    const { lkpdId, studentId } = window.activeLkpdSession;
    const key = studentId + '_' + lkpdId;

    if (!appState.studentTabSwitches) appState.studentTabSwitches = {};
    appState.studentTabSwitches[key] = (appState.studentTabSwitches[key] || 0) + 1;
    const count = appState.studentTabSwitches[key];

    showToast(`PERINGATAN: ${reason} (${count}x)!`, 'error');

    if (window.syncLkpdStudentState) {
        window.syncLkpdStudentState({
            lkpdId,
            active: true,
            outOfTab: true,
            violationReason: reason,
            answeredCount: Object.values(window.lkpdDraftAnswers || {}).filter(v => String(v).trim().length > 0).length
        }).then(data => {
            if (data && data.success && Number.isFinite(Number(data.tabSwitches))) {
                appState.studentTabSwitches[key] = Number(data.tabSwitches);
            }
        });
    }

    let alertOverlay = document.getElementById('lkpd-violation-alert');
    if (!alertOverlay) {
        alertOverlay = document.createElement('div');
        alertOverlay.id = 'lkpd-violation-alert';
        alertOverlay.className = 'fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/90 backdrop-blur-md p-4 animate-fade-in';
        document.body.appendChild(alertOverlay);
    }

        alertOverlay.innerHTML = `
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl p-6 text-center space-y-4 border-2 border-rose-500 select-none">
                <div class="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-3xl">
                    <i class="fa-solid fa-triangle-exclamation"></i>
                </div>
                <h3 class="font-bold text-slate-900 text-lg">Peringatan Pelanggaran Layar LKPD!</h3>
                <div class="p-3 bg-rose-50 rounded-2xl text-xs text-rose-800 font-semibold space-y-1 text-left border border-rose-200">
                    <p><i class="fa-solid fa-circle-info mr-1"></i> <strong>Jenis Pelanggaran:</strong> ${lkpdEscapeHtml(reason)}</p>
                    <p><i class="fa-solid fa-clock-rotate-left mr-1"></i> <strong>Jumlah Pelanggaran:</strong> Pelanggaran ke-${count}</p>
                </div>
                <p class="text-xs text-slate-600 leading-relaxed">
                    Sistem mendeteksi bahwa Anda meninggalkan pengerjaan LKPD. Harap tetap fokus pada lembar kerja Anda dan tidak membuka aplikasi atau tab lain!
                </p>
                <button type="button" onclick="document.getElementById('lkpd-violation-alert')?.remove();" class="w-full py-3.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-2xl text-xs shadow-md transition cursor-pointer">
                    Saya Mengerti & Lanjutkan Pengerjaan
                </button>
    </div>
    `;
};

window.focusStudentAnswerField = function(markerId, number) {
    const card = document.getElementById(`answer-card-${markerId}`);
    const input = document.getElementById(`ans-input-${markerId}`);
    if (card) {
        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
        card.classList.add('ring-4', 'ring-emerald-400');
        setTimeout(() => {
            card.classList.remove('ring-4', 'ring-emerald-400');
        }, 1500);
    }
    if (input) input.focus();
};

window.openTransparentAnswerModal = function(markerId, number) {
    const lkId = window.activeLkpdIdForStudent; // We need to set this when opening modal
    const stId = window.activeStudentIdForLkpd;
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkId);
    if (!lkpd) return;

    const mk = lkpd.markers.find(m => m.id === markerId);
    if (!mk) return;

    const existingSub = lkpd.submissions.find(s => s.studentId === stId);
    const draftAnswers = existingSub ? existingSub.answers : (window.lkpdDraftAnswers || {});
    const curVal = draftAnswers[markerId] || '';

    const modalHtml = `
        <div id="transparent-answer-modal" class="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-fade-in" onclick="document.getElementById('transparent-answer-modal').remove()">
            <div class="bg-white/90 backdrop-blur-md rounded-3xl border border-white/50 shadow-2xl max-w-sm w-full p-6 space-y-4 animate-scale-up" onclick="event.stopPropagation()">
                <div class="flex items-center justify-between">
                    <span class="px-3 py-1 bg-indigo-600 text-white font-black text-xs rounded-xl shadow-lg">
                        Soal Nomor ${number}
                    </span>
                    <button type="button" onclick="document.getElementById('transparent-answer-modal').remove()" class="text-slate-400 hover:text-slate-600 transition">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>
                
                <div class="space-y-2">
                    <p class="text-xs font-extrabold text-slate-800 leading-relaxed">${lkpdEscapeHtml(mk.question)}</p>
                    <div class="pt-2">
                        <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">Tulis Jawaban Anda:</label>
                        ${mk.responseType === 'essay' ? `
                            <textarea id="temp-ans-input" rows="4" placeholder="Ketik jawaban lengkap di sini..." class="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-indigo-500 transition shadow-inner disabled:opacity-60" ${existingSub ? 'disabled' : ''}>${curVal}</textarea>
                        ` : `
                            <input type="text" id="temp-ans-input" value="${curVal}" placeholder="Jawaban singkat..." class="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-2xl text-xs font-bold focus:outline-none focus:border-indigo-500 transition shadow-inner disabled:opacity-60" ${existingSub ? 'disabled' : ''}>
                        `}
                    </div>
                </div>

                ${!existingSub ? `
                <button type="button" onclick="saveTransparentAnswer('${markerId}', '${lkId}')" class="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-black rounded-2xl text-xs shadow-lg shadow-emerald-600/20 transition flex items-center justify-center gap-2">
                    <i class="fa-solid fa-check"></i> <span>Simpan Jawaban</span>
                </button>
                ` : `
                <div class="p-3 bg-indigo-50 rounded-2xl border border-indigo-100 text-center">
                    <span class="text-[10px] font-bold text-indigo-700 italic">Jawaban sudah dikirim dan tidak dapat diubah.</span>
                </div>
                `}
            </div>
        </div>
    `;

    document.getElementById('transparent-answer-modal')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => document.getElementById('temp-ans-input')?.focus(), 100);
};

window.saveTransparentAnswer = function(markerId, lkpdId) {
    const val = document.getElementById('temp-ans-input').value;
    if (!window.lkpdDraftAnswers) window.lkpdDraftAnswers = {};
    window.lkpdDraftAnswers[markerId] = val;

    const stId = window.activeStudentIdForLkpd || (window.appState.currentUser && window.appState.currentUser.id);
    if (stId && lkpdId) {
        try {
            localStorage.setItem(`madrasah_lkpd_draft_${stId}_${lkpdId}`, JSON.stringify(window.lkpdDraftAnswers));
        } catch(e) {}
    }

    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);

    // Update marker visual if needed
    const pinBtn = document.getElementById(`pin-btn-${markerId}`);
    if (pinBtn && val.trim().length > 0 && lkpd) {
        const number = pinBtn.getAttribute('data-number') || '';
        if (lkpd.answeringMode === 'on-photo') {
            const ansStyle = getStudentAnswerStyle(lkpd);
            pinBtn.innerHTML = `
                <div class="${ansStyle.classes}" style="${ansStyle.style} animation: scale-up 0.2s ease-out;">
                    ${lkpdEscapeHtml(val.trim())}
                </div>
                <span class="absolute -top-4 px-1.5 py-0.5 bg-slate-900 text-white font-black text-[8px] rounded border border-white/20 shadow-sm">${number}</span>
            `;
        } else {
            const pinCircle = pinBtn.querySelector('.rounded-2xl');
            if (pinCircle) {
                pinCircle.className = "w-11 h-11 rounded-2xl bg-emerald-600 border-emerald-300 ring-2 ring-emerald-400/50 text-white font-black shadow-2xl border-2 flex items-center justify-center text-lg";
                pinCircle.innerHTML = '<i class="fa-solid fa-check"></i>';
            }
        }
    }

    document.getElementById('transparent-answer-modal').remove();
    showToast("Jawaban nomor " + (pinBtn?.getAttribute('data-number') || '') + " tersimpan di draf.", "success");
};

window.submitStudentLkpdAnswers = async function(lkpdId, studentId, studentName, nis) {
    const isPreview = window.isTeacherPreviewMode || studentId === 'TEACHER_PREVIEW' || (window.appState && window.appState.activeAccount === 'ADMIN');

    if (isPreview) {
        showToast("Mode Pratinjau Guru: Hasil simulasi pengerjaan tidak disimpan ke database.", "info");
        if (typeof window.closeStudentLkpdWorksheetModal === 'function') {
            window.closeStudentLkpdWorksheetModal();
        }
        return;
    }

    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    if (!lkpd) return;

    if (!Array.isArray(lkpd.submissions)) lkpd.submissions = [];

    // Ensure we don't allow re-submission if already exists
    const existingSubForSubmit = lkpd.submissions.find(s => s.studentId === studentId);
    if (existingSubForSubmit) {
        showToast("Anda sudah mengumpulkan LKPD ini sebelumnya.", "info");
        return;
    }

    const answers = { ...(window.lkpdDraftAnswers || {}) };
    (lkpd.markers || []).forEach(mk => {
        const inp = document.getElementById(`ans-input-${mk.id}`);
        if (inp) answers[mk.id] = inp.value.trim();
    });

    let sub = lkpd.submissions.find(s => s.studentId === studentId);
    if (!sub) {
        sub = {
            studentId: studentId,
            studentName: studentName,
            nis: nis,
            classId: lkpd.classId,
            className: lkpd.className,
            submittedAt: new Date().toISOString(),
            answers: answers,
            scores: {},
            feedback: {},
            totalScore: 0,
            isGraded: false,
            gradedBy: '',
            gradedAt: ''
        };
        lkpd.submissions.push(sub);
    } else {
        sub.answers = answers;
        sub.submittedAt = new Date().toISOString();
    }

    await saveLkpdState();
    try {
        localStorage.removeItem('madrasah_active_lkpd_session');
        localStorage.removeItem(`madrasah_lkpd_draft_${studentId}_${lkpdId}`);
        if (localStorage.getItem('madrasah_last_route') === 'lkpd_worksheet') {
            localStorage.removeItem('madrasah_last_route');
        }
    } catch(e) {}
    showToast("Jawaban LKPD berhasil dikumpulkan!", "success");
    
    if (typeof window.closeStudentLkpdWorksheetModal === 'function') {
        window.closeStudentLkpdWorksheetModal();
    }
};

// ============================================================================
// 5. MONITORING LKPD SECTION
// ============================================================================
// LKPD_REALTIME_CLIENT_V2: consume small per-student events instead of refetching global monitoring state.
window.__onLkpdMonitoringEvent = function(payload) {
    if (!payload || !payload.studentId || !payload.lkpdId) return;
    const appState = window.appState || {};
    const sessionKey = String(payload.studentId) + '_' + String(payload.lkpdId);
    if (!appState.activeExamSessions) appState.activeExamSessions = {};
    if (!appState.studentTabSwitches) appState.studentTabSwitches = {};
    if (!appState.studentOutOfTab) appState.studentOutOfTab = {};
    if (!appState.blockedStudents) appState.blockedStudents = {};
    if (!appState.runtimeLivecamFrames) appState.runtimeLivecamFrames = {};
    if (payload.active === false) {
        delete appState.activeExamSessions[sessionKey];
        delete appState.runtimeLivecamFrames[sessionKey];
    } else {
        appState.activeExamSessions[sessionKey] = {
            ...(appState.activeExamSessions[sessionKey] || {}),
            studentId: String(payload.studentId),
            lkpdId: String(payload.lkpdId),
            answeredCount: Number(payload.answeredCount || 0),
            totalQuestions: Number(payload.totalQuestions || 0),
            lastSeenAt: Number(payload.lastSeenAt || Date.now())
        };
    }
    appState.studentTabSwitches[sessionKey] = Number(payload.tabSwitches || 0);
    appState.studentOutOfTab[sessionKey] = payload.outOfTab === true;
    appState.blockedStudents[sessionKey] = payload.blocked === true;
    if (payload.type === 'lkpd_frame' && typeof payload.frame === 'string' && payload.frame.startsWith('data:image/')) {
        appState.runtimeLivecamFrames[sessionKey] = payload.frame;
    }
    if (String(appState.activeMonitoringLkpdId || '') === String(payload.lkpdId)) {
        clearTimeout(window.__lkpdRealtimeRenderTimer);
        window.__lkpdRealtimeRenderTimer = setTimeout(() => {
            const container = document.getElementById('lkpd-monitoring-container');
            if (container && typeof window.renderLkpdMonitoringSection === 'function') {
                window.renderLkpdMonitoringSection(container, payload.lkpdId);
            }
        }, 250);
    }
};
window.switchToLkpdMonitoring = function(lkpdId) {
    window.appState.activeMonitoringLkpdId = lkpdId;
    if (typeof window.renderAssessmentModule === 'function') {
        window.renderAssessmentModule(document.getElementById('view-container'), 'monitoring');
    }
};

window.renderLkpdMonitoringSection = function(container, lkpdId) {
    if (!container) return;
    const appState = window.appState || {};
    const lkpds = initLkpdState();
    const activeLkpd = lkpdId ? lkpds.find(l => l.id === lkpdId) : (lkpds[0] || null);

    const students = appState.students || [];
    const classes = appState.classes || [];

    // Filter students by class of the LKPD
    const lkpdStudents = activeLkpd && activeLkpd.classId && activeLkpd.classId !== 'ALL'
        ? students.filter(s => s.classId === activeLkpd.classId || s.className === activeLkpd.className)
        : students;

    const submissions = activeLkpd ? (activeLkpd.submissions || []) : [];
    
    // Calculate actually active students
    const activeSessions = appState.activeExamSessions || {};
    const actuallyActiveCount = lkpdStudents.filter(st => {
        const sessionKey = st.id + '_' + (activeLkpd ? activeLkpd.id : '');
        const session = activeSessions[sessionKey];
        const lastSeenAt = Number(session?.lastSeenAt || 0) || Date.parse(session?.lastActiveAt || session?.startedAt || '') || 0;
        return !!session && lastSeenAt > 0 && (Date.now() - lastSeenAt < 30000) && !submissions.find(s => s.studentId === st.id);
    }).length;

    // Initialize or read current livecam mode
    if (!appState.lkpdLivecamMode) appState.lkpdLivecamMode = 'gambar';
    if (!appState.lkpdLivecamModes) appState.lkpdLivecamModes = {};

    container.innerHTML = `
        <div class="space-y-6 animate-fade-in">
            <!-- Filter & Control Bar -->
            <div class="bg-slate-900 text-white p-6 rounded-3xl border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center text-xl font-black shadow">
                        <i class="fa-solid fa-desktop"></i>
                    </div>
                    <div>
                        <h4 class="font-black text-white text-base">Live Monitoring LKPD Interaktif</h4>
                        <p class="text-[11px] text-slate-400">Pemantauan progres penanda, video livecam, pelanggaran keluar tab, & status blokir siswa secara real-time.</p>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-3 w-full md:w-auto">
                    <!-- Toggle Mode Livecam -->
                    <button type="button" onclick="toggleLkpdLivecamMode('${activeLkpd ? activeLkpd.id : ''}')" class="px-4 py-2.5 bg-slate-850 hover:bg-slate-800 border border-slate-700/50 text-white font-extrabold rounded-2xl text-xs shadow flex items-center space-x-1.5 transition cursor-pointer">
                        <i class="fa-solid ${appState.lkpdLivecamMode === 'video' ? 'fa-video text-rose-500' : 'fa-image text-emerald-400'} text-[11px]"></i>
                        <span>Mode Semua: ${appState.lkpdLivecamMode === 'video' ? 'Video Live' : 'Foto Absen'}</span>
                    </button>

                    <div class="flex items-center gap-2">
                        <label class="text-xs font-bold text-slate-400 whitespace-nowrap">Pilih LKPD:</label>
                        <select onchange="window.appState.activeMonitoringLkpdId = this.value; renderLkpdMonitoringSection(document.getElementById('lkpd-monitoring-container'), this.value)" class="w-full sm:w-auto px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-2xl text-xs font-bold text-white focus:outline-none focus:ring-2 focus:ring-emerald-500">
                            ${lkpds.map(l => `<option value="${lkpdEscapeAttr(l.id)}" ${activeLkpd && activeLkpd.id === l.id ? 'selected' : ''}>${lkpdEscapeHtml(l.title)} (${lkpdEscapeHtml(l.className)})</option>`).join('')}
                        </select>
                    </div>
                </div>
            </div>

            ${!activeLkpd ? `
                <div class="p-12 text-center bg-white rounded-3xl border text-slate-400">
                    Pilih LKPD dari dropdown di atas untuk memulai pemantauan.
                </div>
            ` : `
                <!-- Summary KPI Cards -->
                <div class="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div class="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                        <div>
                            <span class="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Total Siswa</span>
                            <strong class="text-2xl font-black text-slate-800">${lkpdStudents.length}</strong>
                        </div>
                        <div class="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-500 text-lg"><i class="fa-solid fa-users"></i></div>
                    </div>
                    <div class="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                        <div>
                            <span class="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Sudah Kumpul</span>
                            <strong class="text-2xl font-black text-emerald-600">${submissions.length}</strong>
                        </div>
                        <div class="w-10 h-10 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 text-lg"><i class="fa-solid fa-circle-check"></i></div>
                    </div>
                    <div class="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                        <div>
                            <span class="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Sedang Mengerjakan</span>
                            <strong class="text-2xl font-black text-amber-600">${actuallyActiveCount}</strong>
                        </div>
                        <div class="w-10 h-10 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 text-lg"><i class="fa-solid fa-spinner fa-spin"></i></div>
                    </div>
                    <div class="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-xs flex items-center justify-between">
                        <div>
                            <span class="block text-[10px] font-black text-slate-400 uppercase tracking-wider">Titik Soal</span>
                            <strong class="text-2xl font-black text-indigo-600">${activeLkpd.markers ? activeLkpd.markers.length : 0} Titik</strong>
                        </div>
                        <div class="w-10 h-10 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 text-lg"><i class="fa-solid fa-location-crosshairs"></i></div>
                    </div>
                </div>

                <!-- Student Live Cards Grid -->
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    ${lkpdStudents.map(st => {
                        const sub = submissions.find(s => s.studentId === st.id);
                        const isSubmitted = !!sub;
                        
                        // Active session details
                        const sessionKey = st.id + '_' + activeLkpd.id;
                        const sess = appState.activeExamSessions && appState.activeExamSessions[sessionKey];
                        const lastSeenAt = Number(sess?.lastSeenAt || 0) || Date.parse(sess?.lastActiveAt || sess?.startedAt || '') || 0;
                        const isOnline = !!sess && lastSeenAt > 0 && (Date.now() - lastSeenAt < 30000);

                        const answeredCount = sub 
                            ? Object.values(sub.answers || {}).filter(v => String(v).trim().length > 0).length 
                            : (sess ? sess.answeredCount : 0);
                        const totalMarkers = activeLkpd.markers ? activeLkpd.markers.length : 1;
                        const percent = Math.round((answeredCount / totalMarkers) * 100);

                        // Cheating violations and focus states
                        const tabViolationCount = (appState.studentTabSwitches && appState.studentTabSwitches[sessionKey]) || 0;
                        const isOutOfTab = (appState.studentOutOfTab && appState.studentOutOfTab[sessionKey]) === true;
                        const isBlocked = appState.blockedStudents && (appState.blockedStudents[sessionKey] === true || appState.blockedStudents[activeLkpd.id + '_' + st.id] === true);

                        // Webcam & Snapshots Mode handling
                        const stCamMode = appState.lkpdLivecamModes[st.id] || appState.lkpdLivecamMode || 'gambar';
                        const isStudentVideo = stCamMode === 'video';

                        const livecamFrames = appState.runtimeLivecamFrames || {};
                        const latestFrame = livecamFrames[sessionKey];
                        const studentPhoto = st.photo || st.facePhoto || st.image || (window.getStudentPhotoPlaceholder ? window.getStudentPhotoPlaceholder(st) : '');
                        const displayImage = latestFrame || studentPhoto;

                        return `
                            <div class="group relative bg-slate-900 border ${isBlocked ? 'border-rose-500 ring-2 ring-rose-500/20' : isOutOfTab ? 'border-amber-500 animate-pulse' : 'border-slate-800'} rounded-3xl shadow-xl overflow-hidden flex flex-col justify-between hover:scale-[1.01] transition-all duration-300">
                                <!-- Card Media Body: Video Stream or Image Snapshot (Click to Spotlight HD Livecam) -->
                                <div onclick="focusStudentLivecam(${lkpdInlineArg(st.id)})" title="Klik untuk membuka Spotlight Livecam HD ${lkpdEscapeAttr(st.name)}" class="relative w-full aspect-video bg-slate-950 overflow-hidden cursor-pointer group/media">
                                    ${isStudentVideo && isOnline ? `
                                        <video id="webrtc-video-${lkpdEscapeAttr(st.id)}_${lkpdEscapeAttr(activeLkpd.id)}" autoplay playsinline muted class="w-full h-full object-cover"></video>
                                        <div id="webrtc-fallback-${lkpdEscapeAttr(st.id)}_${lkpdEscapeAttr(activeLkpd.id)}" class="absolute inset-0 flex items-center justify-center bg-slate-950 text-xs text-slate-400">
                                            <i class="fa-solid fa-spinner fa-spin mr-1.5 text-emerald-400"></i> Menyambungkan Video...
                                        </div>
                                    ` : `
                                        ${displayImage ? `
                                            <img src="${lkpdSafeImageSrc(displayImage)}" alt="Live Snapshot" class="w-full h-full object-cover opacity-80" />
                                        ` : `
                                            <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-600 space-y-1">
                                                <i class="fa-solid fa-user-circle text-4xl"></i>
                                                <span class="text-[10px]">Kamera Offline</span>
                                            </div>
                                        `}
                                    `}

                                    <!-- Dark overlay gradients for text readability -->
                                    <div class="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-slate-950/80 to-transparent"></div>
                                    <div class="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-slate-950/80 to-transparent"></div>

                                    <!-- Top Overlay Badges -->
                                    <div class="absolute top-3 left-3 flex flex-wrap gap-1.5 items-center z-10">
                                        <span class="px-2 py-0.5 bg-slate-950/80 backdrop-blur-md text-[9px] font-extrabold rounded-md text-white border border-white/10">
                                            ${lkpdEscapeHtml(st.name)}
                                        </span>
                                        ${isSubmitted ? `
                                            <span class="px-2 py-0.5 bg-emerald-500/90 text-[9px] font-extrabold rounded-md text-white shadow">
                                                ✓ Selesai
                                            </span>
                                        ` : isOnline ? `
                                            <span class="px-2 py-0.5 bg-sky-500/90 text-[9px] font-extrabold rounded-md text-white shadow flex items-center gap-1">
                                                <span class="w-1.5 h-1.5 bg-white rounded-full animate-ping"></span> Mengerjakan
                                            </span>
                                        ` : `
                                            <span class="px-2 py-0.5 bg-slate-700 text-[9px] font-extrabold rounded-md text-slate-300">
                                                Offline
                                            </span>
                                        `}
                                    </div>

                                    <!-- Top-right Violation Alerts -->
                                    <div class="absolute top-3 right-3 flex items-center space-x-1 z-10">
                                        ${tabViolationCount > 0 ? `
                                            <span class="px-2 py-0.5 bg-rose-600 text-white font-extrabold text-[9px] rounded-md shadow border border-rose-400 flex items-center gap-1" title="Siswa keluar dari lembar kerja">
                                                <i class="fa-solid fa-triangle-exclamation"></i> ${tabViolationCount}x Tab
                                            </span>
                                        ` : ''}
                                        ${isOutOfTab ? `
                                            <span class="px-2 py-0.5 bg-amber-500 text-slate-950 font-extrabold text-[9px] rounded-md shadow animate-bounce">
                                                ALIRAN KELUAR!
                                            </span>
                                        ` : ''}
                                        ${isBlocked ? `
                                            <span class="px-2 py-0.5 bg-rose-700 text-white font-extrabold text-[9px] rounded-md shadow border border-rose-500">
                                                BLOKIR
                                            </span>
                                        ` : ''}
                                    </div>

                                    <!-- Bottom Info: Marker progress overlay -->
                                    <div class="absolute bottom-3 left-3 text-xs font-black text-white flex items-center gap-1.5 drop-shadow-md z-10">
                                        <i class="fa-solid fa-location-crosshairs text-emerald-400"></i>
                                        <span>Progres: ${answeredCount}/${totalMarkers} Soal (${percent}%)</span>
                                    </div>
                                </div>

                                <!-- Card Footer: Interactive controls -->
                                <div class="p-4 space-y-3.5 bg-slate-900 border-t border-slate-800">
                                    <!-- Progress bar wrapper -->
                                    <div class="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                        <div class="bg-gradient-to-r from-emerald-500 to-teal-400 h-full rounded-full transition-all duration-500" style="width: ${percent}%;"></div>
                                    </div>

                                    <div class="flex items-center gap-2">
                                        <!-- Send direct guidance message -->
                                        <button type="button" onclick="event.stopPropagation(); openSendLkpdMessageModal('${st.id}', decodeURIComponent('${encodeURIComponent(st.name)}'), '${activeLkpd.id}')" class="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] rounded-xl transition flex items-center justify-center gap-1 cursor-pointer">
                                            <i class="fa-solid fa-comment-dots text-[10px]"></i> <span>Pesan</span>
                                        </button>

                                        <!-- Toggle Student Individual Cam Mode -->
                                        <button type="button" title="${isStudentVideo ? 'Ganti ke Mode Foto Absen' : 'Ganti ke Mode Video Live'}" onclick="event.stopPropagation(); toggleStudentLkpdLivecamMode('${activeLkpd.id}', '${st.id}')" class="px-2.5 py-2 ${isStudentVideo ? 'bg-amber-600 hover:bg-amber-500' : 'bg-slate-800 hover:bg-slate-700 border border-slate-700'} text-white font-black text-[10px] rounded-xl transition flex items-center justify-center gap-1 cursor-pointer">
                                            <i class="fa-solid ${isStudentVideo ? 'fa-video' : 'fa-image'} text-[10px]"></i>
                                        </button>

                                        <!-- Direct Worksheet view -->
                                        <button type="button" onclick="event.stopPropagation(); openStudentLkpdWorksheetModal('${activeLkpd.id}', '${st.id}')" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-750 text-emerald-400 font-bold text-[10px] rounded-xl transition flex items-center justify-center gap-1 cursor-pointer">
                                            <i class="fa-solid fa-eye"></i> <span>Ulasan</span>
                                        </button>

                                        <!-- Block Control -->
                                        <button type="button" onclick="event.stopPropagation(); toggleLkpdStudentBlock('${activeLkpd.id}', '${st.id}')" class="px-3 py-2 ${isBlocked ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300'} font-black text-[10px] rounded-xl transition flex items-center justify-center gap-1 cursor-pointer">
                                            <i class="fa-solid ${isBlocked ? 'fa-lock-open' : 'fa-ban'}"></i> <span>${isBlocked ? 'Buka' : 'Blokir'}</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `}
        </div>
    `;

    // Ensure standard active polling is initialized
    if (!window.__lkpdMonitoringPollInterval) {
        window.__lkpdMonitoringPollInterval = setInterval(() => {
            if (document.visibilityState !== 'visible') return;
            const containerEl = document.getElementById('lkpd-monitoring-container');
            if (containerEl && window.appState.activeMonitoringLkpdId) {
                window.renderLkpdMonitoringSection(containerEl, window.appState.activeMonitoringLkpdId);
            }
        }, 4000);
    }
};

window.toggleLkpdLivecamMode = function(lkpdId) {
    const appState = window.appState || {};
    const targetMode = (appState.lkpdLivecamMode || 'gambar') === 'gambar' ? 'video' : 'gambar';
    if (targetMode === 'video') {
        if (typeof window.promptVideoDurationAndDeductTokens === 'function') {
            window.promptVideoDurationAndDeductTokens((minutes) => {
                appState.lkpdLivecamMode = 'video';
                window.renderLkpdMonitoringSection(document.getElementById('lkpd-monitoring-container'), lkpdId);
            });
        } else {
            appState.lkpdLivecamMode = 'video';
            window.renderLkpdMonitoringSection(document.getElementById('lkpd-monitoring-container'), lkpdId);
        }
    } else {
        appState.lkpdLivecamMode = 'gambar';
        window.renderLkpdMonitoringSection(document.getElementById('lkpd-monitoring-container'), lkpdId);
    }
};

window.toggleStudentLkpdLivecamMode = function(lkpdId, studentId) {
    if (!appState.lkpdLivecamModes) appState.lkpdLivecamModes = {};
    const current = appState.lkpdLivecamModes[studentId] || appState.lkpdLivecamMode || 'gambar';
    const targetMode = current === 'gambar' ? 'video' : 'gambar';
    if (targetMode === 'video') {
        if (typeof window.promptVideoDurationAndDeductTokens === 'function') {
            window.promptVideoDurationAndDeductTokens((minutes) => {
                appState.lkpdLivecamModes[studentId] = 'video';
                window.renderLkpdMonitoringSection(document.getElementById('lkpd-monitoring-container'), lkpdId);
            });
        } else {
            appState.lkpdLivecamModes[studentId] = 'video';
            window.renderLkpdMonitoringSection(document.getElementById('lkpd-monitoring-container'), lkpdId);
        }
    } else {
        appState.lkpdLivecamModes[studentId] = 'gambar';
        window.renderLkpdMonitoringSection(document.getElementById('lkpd-monitoring-container'), lkpdId);
    }
};

window.toggleLkpdStudentBlock = async function(lkpdId, studentId) {
    const key = studentId + '_' + lkpdId;
    if (!appState.blockedStudents) appState.blockedStudents = {};
    appState.blockedStudents[key] = !appState.blockedStudents[key];
    const isBlocked = appState.blockedStudents[key];
    
    // Sync block state to server
    await window.syncExamStateToServer({
        blocked: { [key]: isBlocked, [lkpdId + '_' + studentId]: isBlocked }
    });
    
    showToast(isBlocked ? 'Siswa berhasil diblokir!' : 'Blokir siswa berhasil dibuka!', 'success');
    window.renderLkpdMonitoringSection(document.getElementById('lkpd-monitoring-container'), lkpdId);
};

window.openSendLkpdMessageModal = async function(studentId, studentName, lkpdId) {
    const text = prompt(`Kirim pesan bimbingan langsung ke ${studentName}:`);
    if (text && text.trim().length > 0) {
        const key = studentId + '_' + lkpdId;
        
        // Read existing messages or init
        if (!appState.examMessages) appState.examMessages = {};
        appState.examMessages[key] = text;
        
        await window.syncExamStateToServer({
            messages: appState.examMessages
        });
        showToast(`Pesan terkirim ke ${studentName}: "${text}"`, "success");
    }
};

// ============================================================================
// 6. EVALUATION & GRADING LKPD SECTION
// ============================================================================
window.switchToLkpdEvaluation = function(lkpdId) {
    window.appState.activeEvaluationLkpdId = lkpdId;
    if (typeof window.renderAssessmentModule === 'function') {
        window.renderAssessmentModule(document.getElementById('view-container'), 'evaluasi');
    }
};

window.renderLkpdEvaluationSection = function(container, lkpdId = null) {
    if (!container) return;
    const lkpds = initLkpdState();
    
    // Core Filter States
    if (lkpdId) {
        window.appState.evaluasiLkpdSelectedLkpdId = lkpdId;
        const matching = lkpds.find(l => l.id === lkpdId);
        if (matching) {
            window.appState.evaluasiLkpdSelectedClassId = matching.classId || '';
        }
    }

    const classes = window.appState.classes || [];
    const selectedClassId = window.appState.evaluasiLkpdSelectedClassId || (classes[0] ? String(classes[0].id) : '');
    window.appState.evaluasiLkpdSelectedClassId = selectedClassId;

    // Filter LKPDs that belong to the selected class
    const filteredLkpds = lkpds.filter(l => !selectedClassId || String(l.classId) === selectedClassId || String(l.className).toLowerCase().includes(String(selectedClassId).toLowerCase()));
    
    const selectedLkpdId = window.appState.evaluasiLkpdSelectedLkpdId || (filteredLkpds[0] ? filteredLkpds[0].id : '');
    window.appState.evaluasiLkpdSelectedLkpdId = selectedLkpdId;

    const activeLkpd = lkpds.find(l => l.id === selectedLkpdId);
    const submissions = activeLkpd ? (activeLkpd.submissions || []) : [];
    const searchQuery = (window.appState.evaluasiLkpdSearchQuery || '').toLowerCase().trim();

    // Filter submissions by search query
    const filteredSubmissions = submissions.filter(sub => {
        if (!searchQuery) return true;
        return String(sub.studentName).toLowerCase().includes(searchQuery) || String(sub.nis).includes(searchQuery);
    });

    // Count statistics
    const gradedCount = submissions.filter(s => s.isGraded).length;
    const ungradedCount = submissions.length - gradedCount;

    container.innerHTML = `
        <div class="space-y-6 animate-fade-in">
            <!-- Filter Toolbar (Same design as CBT) -->
            <div class="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-lg font-black shadow-xs">
                        <i class="fa-solid fa-square-poll-vertical"></i>
                    </div>
                    <div>
                        <h4 class="font-extrabold text-slate-800 text-base">Evaluasi & Penilaian LKPD</h4>
                        <p class="text-xs text-slate-400">Kelola koreksi, nilai, import nilai harian, cetak laporan PDF & Excel lembar kerja.</p>
                    </div>
                </div>

                <!-- Filters -->
                <div class="flex flex-wrap items-center gap-2.5">
                    <!-- Filter Kelas -->
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-black text-slate-500 whitespace-nowrap">Kelas:</span>
                        <select id="eval-lkpd-class-select" onchange="window.handleEvalLkpdClassChanged(this.value)" class="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
                            <option value="">-- Semua Kelas --</option>
                            ${classes.map(c => `<option value="${lkpdEscapeAttr(c.id)}" ${selectedClassId === String(c.id) ? 'selected' : ''}>Kelas ${lkpdEscapeHtml(c.name)}</option>`).join('')}
                        </select>
                    </div>

                    <!-- Filter LKPD -->
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-black text-slate-500 whitespace-nowrap">LKPD:</span>
                        <select id="eval-lkpd-item-select" onchange="window.handleEvalLkpdItemChanged(this.value)" class="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer max-w-xs truncate">
                            <option value="">-- Pilih Lembar Kerja --</option>
                            ${filteredLkpds.map(l => `<option value="${lkpdEscapeAttr(l.id)}" ${selectedLkpdId === l.id ? 'selected' : ''}>${lkpdEscapeHtml(l.title)}</option>`).join('')}
                        </select>
                    </div>

                    <!-- Search Box -->
                    <div class="relative">
                        <input type="text" id="eval-lkpd-search-input" oninput="window.handleEvalLkpdSearch(this.value)" placeholder="Cari Nama / NIS..." value="${lkpdEscapeAttr(window.appState.evaluasiLkpdSearchQuery || '')}" class="pl-8 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-44">
                        <i class="fa-solid fa-magnifying-glass absolute left-3 top-2.5 text-slate-400 text-[10px]"></i>
                    </div>
                </div>
            </div>

            ${!activeLkpd ? `
                <div class="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200 text-slate-400 text-xs font-medium">
                    <i class="fa-solid fa-file-circle-question text-3xl text-slate-300 block mb-3"></i>
                    Silakan buat atau pilih LKPD dan kelas terlebih dahulu untuk memulai evaluasi.
                </div>
            ` : `
                <!-- Action Button Toolbar (Same as CBT) -->
                <div class="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-5 space-y-5">
                    <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50 border border-slate-200/60 p-4 rounded-2xl">
                        <div class="space-y-1">
                            <h4 class="font-bold text-slate-800 text-sm flex items-center gap-2">
                                <span>Tindakan Evaluasi LKPD</span>
                                <span class="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">Live Sync</span>
                            </h4>
                            <p class="text-[10px] text-slate-400 font-medium">Koreksi otomatis dengan AI / Non-AI, rekap nilai harian, cetak laporan PDF atau ekspor Excel instan.</p>
                        </div>
                        <div class="flex flex-wrap gap-2">
                            <!-- Refresh Nilai -->
                            <button type="button" onclick="window.refreshLkpdEvaluasi()" class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-blue-600/10 transition cursor-pointer" title="Perbarui Data Nilai">
                                <i class="fa-solid fa-rotate"></i><span>Refresh Nilai</span>
                            </button>
                            <!-- Auto Koreksi Non-AI -->
                            <button id="btn-lkpd-koreksi-non-ai" type="button" onclick="window.runLkpdAutoKoreksiNonAI(${lkpdInlineArg(selectedClassId)}, ${lkpdInlineArg(selectedLkpdId)})" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/10 transition cursor-pointer" title="Koreksi Otomatis Menggunakan Kemiripan Kunci Jawaban">
                                <i class="fa-solid fa-calculator text-emerald-200"></i><span>Auto Koreksi Non-AI</span>
                            </button>
                            <!-- Auto Koreksi AI -->
                            <button id="btn-lkpd-koreksi-ai" type="button" onclick="window.runLkpdAutoKoreksiAI(${lkpdInlineArg(selectedClassId)}, ${lkpdInlineArg(selectedLkpdId)})" class="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-purple-600/10 transition cursor-pointer" title="Koreksi Otomatis Jawaban Esai Menggunakan AI Gemini">
                                <i class="fa-solid fa-wand-magic-sparkles text-purple-200"></i><span>Auto Koreksi AI</span>
                            </button>
                            <!-- Import ke Nilai Harian -->
                            <button type="button" onclick="window.openImportLkpdToHarianModal(${lkpdInlineArg(selectedClassId)}, ${lkpdInlineArg(selectedLkpdId)})" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-indigo-600/10 transition cursor-pointer" title="Impor nilai evaluasi LKPD ini ke Rekap Nilai Harian">
                                <i class="fa-solid fa-file-import"></i><span>Import ke Harian</span>
                            </button>
                            <!-- Cetak PDF -->
                            <button type="button" onclick="window.cetakNilaiLkpdEvaluasi(${lkpdInlineArg(selectedClassId)}, ${lkpdInlineArg(selectedLkpdId)})" class="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-600/10 transition cursor-pointer">
                                <i class="fa-solid fa-file-pdf"></i><span>Cetak PDF</span>
                            </button>
                            <!-- Ekspor Excel -->
                            <button type="button" onclick="window.exportNilaiExcelLkpdEvaluasi(${lkpdInlineArg(selectedClassId)}, ${lkpdInlineArg(selectedLkpdId)})" class="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-teal-600/10 transition cursor-pointer">
                                <i class="fa-solid fa-file-excel"></i><span>Ekspor Excel (.xlsx)</span>
                            </button>
                            <!-- Download Jawaban -->
                            <button type="button" onclick="window.openCetakLkpdJawabanModal(${lkpdInlineArg(selectedClassId)}, ${lkpdInlineArg(selectedLkpdId)})" class="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-slate-700/10 transition cursor-pointer">
                                <i class="fa-solid fa-download"></i><span>Download Jawaban</span>
                            </button>
                            <!-- Reset Semua Jawaban -->
                            <button type="button" onclick="window.resetAllLkpdSubmissions(${lkpdInlineArg(selectedClassId)}, ${lkpdInlineArg(selectedLkpdId)})" class="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/10 transition cursor-pointer" title="Reset Semua Jawaban Siswa LKPD Ini">
                                <i class="fa-solid fa-trash-can"></i><span>Reset Semua Jawaban</span>
                            </button>
                        </div>
                    </div>

                    <!-- Summary Stats Card Row -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div class="bg-indigo-50/60 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between">
                            <div>
                                <p class="text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Total Soal Penanda</p>
                                <p class="text-xl font-black text-indigo-900 mt-1">${activeLkpd.markers?.length || 0} Titik</p>
                            </div>
                            <div class="w-10 h-10 rounded-xl bg-indigo-100/80 text-indigo-700 flex items-center justify-center text-base">
                                <i class="fa-solid fa-circle-nodes"></i>
                            </div>
                        </div>

                        <div class="bg-emerald-50/60 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between">
                            <div>
                                <p class="text-[10px] font-bold text-emerald-500 uppercase tracking-wider">Jawaban Masuk</p>
                                <p class="text-xl font-black text-emerald-900 mt-1">${submissions.length} Siswa</p>
                            </div>
                            <div class="w-10 h-10 rounded-xl bg-emerald-100/80 text-emerald-700 flex items-center justify-center text-base">
                                <i class="fa-solid fa-file-import"></i>
                            </div>
                        </div>

                        <div class="bg-amber-50/60 border border-amber-100 rounded-2xl p-4 flex items-center justify-between">
                            <div>
                                <p class="text-[10px] font-bold text-amber-600 uppercase tracking-wider">Sudah Dinilai</p>
                                <p class="text-xl font-black text-amber-900 mt-1">${gradedCount} Siswa</p>
                            </div>
                            <div class="w-10 h-10 rounded-xl bg-amber-100/80 text-amber-700 flex items-center justify-center text-base">
                                <i class="fa-solid fa-square-check"></i>
                            </div>
                        </div>

                        <div class="bg-rose-50/60 border border-rose-100 rounded-2xl p-4 flex items-center justify-between">
                            <div>
                                <p class="text-[10px] font-bold text-rose-500 uppercase tracking-wider">Belum Dinilai</p>
                                <p class="text-xl font-black text-rose-900 mt-1">${ungradedCount} Siswa</p>
                            </div>
                            <div class="w-10 h-10 rounded-xl bg-rose-100/80 text-rose-700 flex items-center justify-center text-base">
                                <i class="fa-solid fa-clock"></i>
                            </div>
                        </div>
                    </div>

                    <!-- Submissions Table -->
                    <div class="border border-slate-200 rounded-2xl overflow-hidden">
                        ${filteredSubmissions.length === 0 ? `
                            <div class="p-12 text-center text-slate-400 text-xs font-semibold">
                                Tidak ada jawaban siswa yang sesuai dengan filter pencarian.
                            </div>
                        ` : `
                            <div class="overflow-x-auto">
                                <table class="w-full text-left text-xs">
                                    <thead class="bg-slate-50 text-slate-500 font-extrabold uppercase text-[10px] tracking-wider border-b border-slate-100">
                                        <tr>
                                            <th class="py-3.5 px-5">Nama Siswa</th>
                                            <th class="py-3.5 px-4">NIS</th>
                                            <th class="py-3.5 px-4">Waktu Kumpul</th>
                                            <th class="py-3.5 px-4 text-center">Status Koreksi</th>
                                            <th class="py-3.5 px-4 text-center">Nilai Rata-rata</th>
                                            <th class="py-3.5 px-5 text-right">Aksi</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-slate-100 font-medium text-slate-700">
                                        ${filteredSubmissions.map(sub => {
                                            return `
                                                <tr class="hover:bg-slate-50/80 transition">
                                                    <td class="py-4 px-5 font-bold text-slate-900">
                                                        <div class="flex items-center gap-2">
                                                            <div class="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[10px] font-black">
                                                                ${sub.studentName.split(' ').map(n=>n[0]).slice(0,2).join('')}
                                                            </div>
                                                            <span>${lkpdEscapeHtml(sub.studentName)}</span>
                                                        </div>
                                                    </td>
                                                    <td class="py-4 px-4 text-slate-500">${sub.nis || '-'}</td>
                                                    <td class="py-4 px-4 text-slate-500">
                                                        ${sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString('id-ID', {day:'numeric', month:'short'}) + ' ' + new Date(sub.submittedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                    </td>
                                                    <td class="py-4 px-4 text-center">
                                                        <span class="px-2.5 py-1 rounded-full text-[9px] font-extrabold ${sub.isGraded ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-amber-100 text-amber-800 border border-amber-200'}">
                                                            ${sub.isGraded ? '✓ Sudah Dinilai' : '⏳ Belum Dinilai'}
                                                        </span>
                                                    </td>
                                                    <td class="py-4 px-4 text-center font-black text-sm ${sub.isGraded ? 'text-emerald-700' : 'text-slate-400'}">
                                                        ${sub.isGraded ? `${sub.totalScore}/100` : '-'}
                                                    </td>
                                                    <td class="py-4 px-5 text-right">
                                                        <div class="flex items-center justify-end gap-2">
                                                            <button type="button" onclick="openGradeLkpdSubmissionModal('${activeLkpd.id}', '${sub.studentId}')" class="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-[11px] rounded-xl shadow-xs transition cursor-pointer">
                                                                ${sub.isGraded ? 'Ubah Nilai' : 'Beri Nilai'}
                                                            </button>
                                                            <button type="button" onclick="window.resetSingleLkpdSubmission('${activeLkpd.id}', '${sub.studentId}')" class="p-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-extrabold text-xs rounded-xl border border-rose-200 transition cursor-pointer" title="Reset Jawaban Siswa Ini (Mulai dari Awal)">
                                                                <i class="fa-solid fa-rotate-left"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            `;
                                        }).join('')}
                                    </tbody>
                                </table>
                            </div>
                        `}
                    </div>
                </div>
            `}
        </div>
    `;
};

window.handleEvalLkpdClassChanged = function(classId) {
    window.appState.evaluasiLkpdSelectedClassId = classId;
    window.appState.evaluasiLkpdSelectedLkpdId = ''; // Reset LKPD selection so it updates
    window.renderLkpdEvaluationSection(document.getElementById('lkpd-evaluation-container'));
};

window.handleEvalLkpdItemChanged = function(lkpdId) {
    window.appState.evaluasiLkpdSelectedLkpdId = lkpdId;
    window.renderLkpdEvaluationSection(document.getElementById('lkpd-evaluation-container'));
};

window.handleEvalLkpdSearch = function(query) {
    window.appState.evaluasiLkpdSearchQuery = query;
    window.renderLkpdEvaluationSection(document.getElementById('lkpd-evaluation-container'));
};

window.refreshLkpdEvaluasi = async function() {
    try {
        const res = await fetch('/api/sync-state?key=lkpdList');
        const data = await res.json();
        if (data.success && Array.isArray(data.data)) {
            window.appState.lkpdList = data.data;
            try { localStorage.setItem('madrasah_lkpdList', JSON.stringify(data.data)); } catch(e) {}
        }
    } catch(e) {}
    window.renderLkpdEvaluationSection(document.getElementById('lkpd-evaluation-container'));
    showToast('Data evaluasi LKPD berhasil disinkronkan dari server!', 'success');
};

window.resetAllLkpdSubmissions = async function(classId, lkpdId) {
    if (!confirm('Apakah Anda yakin ingin MERESET SEMUA jawaban siswa untuk LKPD ini di kelas ini? Semua jawaban dan penilaian siswa akan dihapus secara permanen sehingga mereka dapat mengerjakan ulang.')) {
        return;
    }
    
    try {
        const lkpds = initLkpdState();
        const lkpd = lkpds.find(l => l.id === lkpdId);
        if (!lkpd) return;
        
        const studentsInClass = (window.appState.students || []).filter(s => s.classId === classId);
        const studentIds = studentsInClass.map(s => String(s.id));
        
        if (Array.isArray(lkpd.submissions)) {
            lkpd.submissions = lkpd.submissions.filter(sub => !studentIds.includes(String(sub.studentId)));
        }
        
        saveState('lkpdList', lkpds);
        
        if (window.syncExamStateToServer) {
            studentIds.forEach(sId => {
                const sessionKey = sId + '_' + lkpdId;
                if (window.appState.activeExamSessions) {
                    delete window.appState.activeExamSessions[sessionKey];
                }
                window.syncExamStateToServer({ sessionKey, sessionData: null });
            });
        }
        
        window.renderLkpdEvaluationSection(document.getElementById('lkpd-evaluation-container'));
        showToast('Semua jawaban siswa pada LKPD di kelas ini berhasil di-reset!', 'success');
    } catch(e) {
        showToast('Gagal mereset jawaban: ' + e.message, 'error');
    }
};

window.resetSingleLkpdSubmission = async function(lkpdId, studentId) {
    if (!confirm('Apakah Anda yakin ingin mereset jawaban siswa ini? Semua jawaban dan penilaian untuk siswa ini akan dihapus sehingga ia dapat mengerjakan kembali.')) {
        return;
    }
    
    try {
        const lkpds = initLkpdState();
        const lkpd = lkpds.find(l => l.id === lkpdId);
        if (!lkpd) return;
        
        if (Array.isArray(lkpd.submissions)) {
            lkpd.submissions = lkpd.submissions.filter(sub => String(sub.studentId) !== String(studentId));
        }
        
        saveState('lkpdList', lkpds);
        
        if (window.syncExamStateToServer) {
            const sessionKey = studentId + '_' + lkpdId;
            if (window.appState.activeExamSessions) {
                delete window.appState.activeExamSessions[sessionKey];
            }
            window.syncExamStateToServer({ sessionKey, sessionData: null });
        }
        
        window.renderLkpdEvaluationSection(document.getElementById('lkpd-evaluation-container'));
        showToast('Jawaban siswa berhasil di-reset! Siswa dapat mengerjakan kembali.', 'success');
    } catch(e) {
        showToast('Gagal mereset jawaban: ' + e.message, 'error');
    }
};

window.runLkpdAutoKoreksiNonAI = async function(classId, lkpdId) {
    const btn = document.getElementById('btn-lkpd-koreksi-non-ai');
    let originalHtml = '';
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Proses Auto Koreksi...`;
    }
    showToast('Memulai koreksi otomatis non-AI (pencocokan kata kunci)...', 'info');

    try {
        const res = await fetch('/api/gemini/auto-koreksi-lkpd', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classId, lkpdId, method: 'keyword' })
        }).then(r => r.json());

        if (res && res.success) {
            showToast(res.message, 'success');
            try {
                const updatedStore = await fetch('/api/lkpds').then(r => r.json());
                if (updatedStore && updatedStore.lkpdList) {
                    window.appState.lkpdList = updatedStore.lkpdList;
                    const storageKey = typeof window.getLkpdStorageKey === 'function' ? window.getLkpdStorageKey() : 'madrasah_lkpdList';
                    if (typeof window.safeSetLocalStorage === 'function') {
                        window.safeSetLocalStorage(storageKey, window.appState.lkpdList);
                    } else {
                        localStorage.setItem(storageKey, JSON.stringify(window.appState.lkpdList));
                    }
                }
            } catch(e) {}
            window.renderLkpdEvaluationSection(document.getElementById('lkpd-evaluation-container'), lkpdId);
        } else {
            showToast(res ? res.message : 'Gagal melakukan auto koreksi.', 'error');
        }
    } catch (err) {
        console.error('[runLkpdAutoKoreksiNonAI Error]:', err);
        showToast('Terjadi kesalahan jaringan.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
};

window.runLkpdAutoKoreksiAI = async function(classId, lkpdId) {
    const btn = document.getElementById('btn-lkpd-koreksi-ai');
    let originalHtml = '';
    if (btn) {
        originalHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner animate-spin"></i> Proses Auto Koreksi AI...`;
    }
    showToast('Proses koreksi otomatis dengan AI Gemini dimulai, harap tunggu...', 'info');

    try {
        const res = await fetch('/api/gemini/auto-koreksi-lkpd', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ classId, lkpdId, method: 'ai' })
        }).then(r => r.json());

        if (res && res.success) {
            showToast(res.message, 'success');
            try {
                const updatedStore = await fetch('/api/lkpds').then(r => r.json());
                if (updatedStore && updatedStore.lkpdList) {
                    window.appState.lkpdList = updatedStore.lkpdList;
                    const storageKey = typeof window.getLkpdStorageKey === 'function' ? window.getLkpdStorageKey() : 'madrasah_lkpdList';
                    if (typeof window.safeSetLocalStorage === 'function') {
                        window.safeSetLocalStorage(storageKey, window.appState.lkpdList);
                    } else {
                        localStorage.setItem(storageKey, JSON.stringify(window.appState.lkpdList));
                    }
                }
            } catch(e) {}
            window.renderLkpdEvaluationSection(document.getElementById('lkpd-evaluation-container'), lkpdId);
        } else {
            showToast(res ? res.message : 'Gagal melakukan auto koreksi.', 'error');
        }
    } catch (err) {
        console.error('[runLkpdAutoKoreksiAI Error]:', err);
        showToast('Terjadi kesalahan jaringan atau server.', 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = originalHtml;
        }
    }
};

window.openImportLkpdToHarianModal = function(classId, lkpdId) {
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    const cls = window.appState.classes.find(c => String(c.id) === String(classId));
    if (!cls || !lkpd) {
        showToast('Data kelas atau LKPD tidak ditemukan!', 'error');
        return;
    }

    const submissions = lkpd.submissions || [];
    const clsStudents = window.appState.students.filter(st => String(st.classId) === String(classId));
    const gradedCount = submissions.filter(s => s.isGraded).length;

    const defaultTitle = `Nilai LKPD ${lkpd.title}`;
    const defaultSubject = lkpd.subject || (window.appState.subjects && window.appState.subjects[0] ? window.appState.subjects[0].name : 'Mata Pelajaran');

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
                <div class="p-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center text-xl">
                            <i class="fa-solid fa-file-import"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-base">Import Nilai LKPD ke Nilai Harian</h3>
                            <p class="text-xs text-emerald-100">Kirim nilai LKPD ke Rekap Nilai Harian otomatis</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="text-white/80 hover:text-white text-lg cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="p-6 space-y-4 text-xs text-slate-700">
                    <div class="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl space-y-2">
                        <div class="flex justify-between items-center text-emerald-900 font-semibold">
                            <span><i class="fa-solid fa-users mr-1.5 text-emerald-600"></i> Kelas: <b>${lkpdEscapeHtml(cls.name)}</b></span>
                            <span class="bg-emerald-200/80 text-emerald-800 px-2.5 py-1 rounded-xl text-[11px] font-bold">${clsStudents.length} Siswa (${gradedCount} Memiliki Nilai)</span>
                        </div>
                        <p class="text-[11px] text-emerald-700 leading-normal">
                            Nilai akhir dari evaluasi LKPD <b>"${lkpdEscapeHtml(lkpd.title)}"</b> akan otomatis dimasukkan ke dalam daftar Penilaian Harian seluruh siswa kelas ${cls.name}.
                        </p>
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Judul Penilaian Harian <span class="text-rose-500">*</span></label>
                        <input type="text" id="import-lkpd-title" value="${lkpdEscapeAttr(defaultTitle)}" placeholder="Contoh: LKPD Bab 1 Sel, PH LKPD 2" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
                        <p class="text-[10px] text-slate-400 mt-1">Judul ini akan menjadi nama kolom pada tabel Rekap Nilai Harian / e-Rapor.</p>
                    </div>

                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1">Mata Pelajaran <span class="text-rose-500">*</span></label>
                        <input type="text" id="import-lkpd-subject" value="${lkpdEscapeAttr(defaultSubject)}" placeholder="Contoh: Biologi, TIK" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"/>
                    </div>
                </div>

                <div class="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="px-5 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-2xl hover:bg-slate-100 transition cursor-pointer">
                        Batal
                    </button>
                    <button type="button" onclick="window.confirmImportLkpdToHarian('${classId}', '${lkpdId}')" class="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 rounded-2xl transition cursor-pointer flex items-center gap-1.5">
                        <i class="fa-solid fa-check"></i><span>OK / Impor Nilai</span>
                    </button>
                </div>
            </div>
        </div>
    `;
};

window.confirmImportLkpdToHarian = async function(classId, lkpdId) {
    const titleInput = document.getElementById('import-lkpd-title');
    const subjectInput = document.getElementById('import-lkpd-subject');

    const categoryTitle = titleInput ? titleInput.value.trim() : '';
    const subjectName = subjectInput ? subjectInput.value.trim() : '';

    if (!categoryTitle) {
        showToast('Judul nilai harian tidak boleh kosong!', 'error');
        return;
    }

    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    const cls = window.appState.classes.find(c => String(c.id) === String(classId));
    if (!cls || !lkpd) {
        showToast('Data kelas atau LKPD tidak ditemukan!', 'error');
        return;
    }

    const clsStudents = window.appState.students.filter(st => String(st.classId) === String(classId));
    const submissions = lkpd.submissions || [];

    if (!window.appState.gradeCategories) {
        window.appState.gradeCategories = JSON.parse(localStorage.getItem('madrasah_gradeCategories') || '["Harian 1"]');
    }
    if (!window.appState.gradeCategories.some(c => String(c).toLowerCase() === String(categoryTitle).toLowerCase())) {
        window.appState.gradeCategories.push(categoryTitle);
        localStorage.setItem('madrasah_gradeCategories', JSON.stringify(window.appState.gradeCategories));
    }

    if (!window.appState.grades) {
        window.appState.grades = JSON.parse(localStorage.getItem('madrasah_grades')) || [];
    }

    let count = 0;
    const payloadItems = [];

    clsStudents.forEach(st => {
        const sub = submissions.find(s => s.studentId === st.id);
        if (sub && sub.isGraded && typeof sub.totalScore === 'number') {
            const finalSubject = subjectName || 'Mata Pelajaran';
            const activeKey = String(classId) + '_' + String(finalSubject);

            if (!window.appState.customGradeColumns) window.appState.customGradeColumns = {};
            if (!window.appState.customGradeColumns[activeKey]) window.appState.customGradeColumns[activeKey] = [];
            if (!window.appState.customGradeColumns[activeKey].some(c => String(c).toLowerCase() === String(categoryTitle).toLowerCase())) {
                window.appState.customGradeColumns[activeKey].push(categoryTitle);
                localStorage.setItem('madrasah_customGradeColumns', JSON.stringify(window.appState.customGradeColumns));
            }

            const existingIdx = window.appState.grades.findIndex(g => 
                String(g.classId) === String(classId) &&
                String(g.studentId) === String(st.id) &&
                String(g.subjectName || '').trim().toLowerCase() === String(finalSubject).trim().toLowerCase() &&
                String(g.category || '').trim().toLowerCase() === String(categoryTitle).trim().toLowerCase()
            );

            const gradeObj = {
                id: existingIdx >= 0 ? window.appState.grades[existingIdx].id : ('GRD_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6)),
                classId: String(classId),
                studentId: String(st.id),
                studentName: st.name,
                className: cls.name,
                subjectName: finalSubject,
                category: categoryTitle,
                score: sub.totalScore
            };

            if (existingIdx >= 0) {
                window.appState.grades[existingIdx] = gradeObj;
            } else {
                window.appState.grades.push(gradeObj);
            }

            payloadItems.push(gradeObj);
            count++;
        }
    });

    if (count === 0) {
        showToast('Tidak ada siswa dengan nilai LKPD yang siap diimpor!', 'warning');
        return;
    }

    localStorage.setItem('madrasah_grades', JSON.stringify(window.appState.grades));
    if (typeof window.syncStateToServer === 'function') {
        await window.syncStateToServer('grades');
    } else {
        await fetch('/api/sync-state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'grades', data: window.appState.grades })
        }).catch(() => {});
    }

    document.getElementById('modal-container').innerHTML = '';
    showToast(`Berhasil mengimpor ${count} nilai siswa ke rekap Nilai Harian!`, 'success');
};

window.cetakNilaiLkpdEvaluasi = function(classId, lkpdId) {
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    const cls = window.appState.classes.find(c => String(c.id) === String(classId));
    if (!cls || !lkpd) {
        showToast('Pilih kelas dan LKPD yang ingin dicetak terlebih dahulu.', 'warning');
        return;
    }

    const clsStudents = window.appState.students.filter(st => String(st.classId) === String(classId));
    const submissions = lkpd.submissions || [];

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Mohon izinkan pop-up browser untuk mencetak nilai!");
        return;
    }

    const defaultTeacherName = window.appState.currentUser ? window.appState.currentUser.name : 'Dewan Guru';
    const defaultTeacherNip = window.appState.currentUser && window.appState.currentUser.nip ? window.appState.currentUser.nip : '198501012010011001';

    let tableRows = clsStudents.map((st, idx) => {
        const sub = submissions.find(s => s.studentId === st.id);
        const hasSub = !!sub;
        const scoreVal = (sub && sub.isGraded) ? `${sub.totalScore}/100` : (hasSub ? 'Belum Dinilai' : 'Belum Kumpul');
        return `
            <tr style="border-bottom: 1px solid #e5e7eb;">
                <td style="border: 1px solid #d1d5db; padding: 10px; text-align: center; font-family: monospace;">${idx + 1}</td>
                <td style="border: 1px solid #d1d5db; padding: 10px; font-weight: 600;">${lkpdEscapeHtml(st.name)}</td>
                <td style="border: 1px solid #d1d5db; padding: 10px; text-align: center; font-family: monospace;">${lkpdEscapeHtml(st.nis || '-')}</td>
                <td style="border: 1px solid #d1d5db; padding: 10px; text-align: center;">${hasSub ? '✓ Mengumpulkan' : '⏳ Belum Kumpul'}</td>
                <td style="border: 1px solid #d1d5db; padding: 10px; text-align: center; font-weight: bold; background-color: #ecfdf5; color: #047857;">${scoreVal}</td>
            </tr>
        `;
    }).join('');

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Laporan_Nilai_LKPD_${lkpdEscapeHtml(lkpd.title.replace(/\s+/g, '_'))}</title>
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
                body {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    color: #1f2937;
                    background: #ffffff;
                    margin: 0;
                    padding: 30px;
                    font-size: 13px;
                }
                .kop-surat {
                    border-bottom: 4px double #1f2937;
                    padding-bottom: 16px;
                    margin-bottom: 24px;
                    text-align: center;
                }
                .kop-surat h1 {
                    font-size: 16px;
                    font-weight: 800;
                    margin: 0;
                    text-transform: uppercase;
                }
                .kop-surat h2 {
                    font-size: 20px;
                    font-weight: 900;
                    margin: 4px 0 0 0;
                    text-transform: uppercase;
                    color: #047857;
                }
                .kop-surat p {
                    font-size: 11px;
                    margin: 4px 0 0 0;
                    color: #6b7280;
                }
                .meta-box {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    background-color: #f9fafb;
                    padding: 16px;
                    border-radius: 12px;
                    border: 1px solid #f3f4f6;
                    margin-bottom: 24px;
                }
                .signature-section {
                    display: flex;
                    justify-content: flex-end;
                    padding-top: 48px;
                    font-size: 14px;
                }
                @media print {
                    body { padding: 0; }
                    button { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="kop-surat">
                <h1>YAYASAN PENDIDIKAN ISLAM MADRASAH</h1>
                <h2>${window.appState.settings?.schoolName || "MA AL-UKHUWAH"}</h2>
                <p>Status Terakreditasi A &bull; Portal Madrasah Terintegrasi</p>
            </div>

            <div style="text-align: center; margin-bottom: 24px;">
                <h3 style="font-size: 15px; font-weight: 800; text-transform: uppercase; margin: 0 0 10px 0; letter-spacing: 0.5px;">REKAPITULASI NILAI LEMBAR KERJA SISWA (LKPD)</h3>
            </div>

            <div class="meta-box">
                <div>
                    <p style="margin: 0 0 4px 0;"><strong>Lembar Kerja:</strong> ${lkpdEscapeHtml(lkpd.title)}</p>
                    <p style="margin: 0;"><strong>Mata Pelajaran:</strong> ${lkpd.subject || 'Mata Pelajaran'}</p>
                </div>
                <div style="text-align: right;">
                    <p style="margin: 0 0 4px 0;"><strong>Kelas:</strong> ${cls.name}</p>
                    <p style="margin: 0;"><strong>Tanggal Cetak:</strong> ${new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
            </div>

            <table style="width: 100%; border-collapse: collapse; border: 1px solid #d1d5db; font-size: 13px; margin-bottom: 24px;">
                <thead>
                    <tr style="background-color: #f3f4f6;">
                        <th style="border: 1px solid #d1d5db; padding: 10px; text-align: center; width: 50px;">No</th>
                        <th style="border: 1px solid #d1d5db; padding: 10px; text-align: left;">Nama Lengkap Siswa</th>
                        <th style="border: 1px solid #d1d5db; padding: 10px; text-align: center; width: 120px;">NIS</th>
                        <th style="border: 1px solid #d1d5db; padding: 10px; text-align: center; width: 150px;">Status</th>
                        <th style="border: 1px solid #d1d5db; padding: 10px; text-align: center; width: 120px; background-color: #ecfdf5; color: #047857;">Nilai Rata-rata</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>

            <div class="signature-section">
                <div style="text-align: right; width: 250px;">
                    <p style="margin: 0;">${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                    <p style="font-weight: bold; margin: 4px 0 0 0;">Guru Mata Pelajaran</p>
                    <div style="height: 60px;"></div>
                    <p style="font-weight: bold; text-decoration: underline; margin: 0;">${defaultTeacherName}</p>
                    <p style="font-size: 12px; margin: 2px 0 0 0; color: #6b7280;">NIP. ${defaultTeacherNip}</p>
                </div>
            </div>

            <script>
                window.onload = function() {
                    window.print();
                }
            </script>
        </body>
        </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
};

window.exportNilaiExcelLkpdEvaluasi = function(classId, lkpdId) {
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    const cls = window.appState.classes.find(c => String(c.id) === String(classId));
    if (!cls || !lkpd) {
        showToast('Pilih kelas dan LKPD terlebih dahulu.', 'warning');
        return;
    }

    const clsStudents = window.appState.students.filter(st => String(st.classId) === String(classId));
    const submissions = lkpd.submissions || [];

    const data = clsStudents.map((st, idx) => {
        const sub = submissions.find(s => s.studentId === st.id);
        const hasSub = !!sub;
        const scoreVal = (sub && sub.isGraded) ? sub.totalScore : (hasSub ? 'Belum Dinilai' : 'Belum Kumpul');
        return {
            'No': idx + 1,
            'NIS': st.nis || '-',
            'Nama Siswa': st.name,
            'Kelas': cls.name,
            'Judul LKPD': lkpd.title,
            'Status': hasSub ? 'Sudah Mengumpulkan' : 'Belum Mengumpulkan',
            'Nilai Akhir (0-100)': scoreVal
        };
    });

    if (window.XLSX) {
        const worksheet = XLSX.utils.json_to_sheet(data);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Hasil Evaluasi LKPD");
        
        const max_width = data.reduce((w, r) => Math.max(w, String(r['Nama Siswa'] || '').length), 10);
        worksheet['!cols'] = [
            { wch: 5 }, { wch: 12 }, { wch: Math.max(max_width, 22) }, { wch: 12 }, { wch: 22 }, { wch: 18 }, { wch: 16 }
        ];

        XLSX.writeFile(workbook, `Nilai_Evaluasi_LKPD_${cls.name}_${lkpd.title.replace(/\s+/g, '_')}.xlsx`);
        showToast('File Excel Nilai LKPD berhasil diunduh!', 'success');
    } else {
        let csvContent = "data:text/csv;charset=utf-8,No,NIS,Nama Siswa,Kelas,Judul LKPD,Status,Nilai Akhir\n";
        data.forEach(r => {
            csvContent += `${r['No']},"${r['NIS']}","${r['Nama Siswa']}","${r['Kelas']}","${r['Judul LKPD']}","${r['Status']}","${r['Nilai Akhir (0-100)']}"\n`;
        });
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `Nilai_Evaluasi_LKPD_${cls.name}_${lkpd.title.replace(/\s+/g, '_')}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('File CSV Nilai LKPD berhasil diunduh!', 'success');
    }
};

window.openCetakLkpdJawabanModal = function(classId, lkpdId) {
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    const cls = window.appState.classes.find(c => String(c.id) === String(classId));
    if (!cls || !lkpd) {
        showToast('Pilih kelas dan LKPD terlebih dahulu.', 'warning');
        return;
    }

    const clsStudents = window.appState.students.filter(st => String(st.classId) === String(classId));
    const submissions = lkpd.submissions || [];

    const modal = document.getElementById('modal-container');
    if (!modal) return;

    modal.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4 animate-fade-in">
            <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
                <div class="p-6 bg-gradient-to-r from-emerald-600 to-teal-600 text-white flex items-center justify-between">
                    <div class="flex items-center space-x-3">
                        <div class="w-10 h-10 bg-white/20 rounded-2xl flex items-center justify-center text-xl">
                            <i class="fa-solid fa-download"></i>
                        </div>
                        <div>
                            <h3 class="font-bold text-base">Unduh Jawaban LKPD Siswa</h3>
                            <p class="text-xs text-emerald-100">Pilih siswa yang ingin diunduh jawaban LKPD-nya</p>
                        </div>
                    </div>
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="text-white/80 hover:text-white text-lg cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div class="p-6 space-y-4 text-xs text-slate-700">
                    <div>
                        <label class="block text-xs font-bold uppercase text-slate-500 mb-1.5">Pilih Siswa <span class="text-rose-500">*</span></label>
                        <select id="download-lkpd-student-select" class="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
                            ${clsStudents.map(st => {
                                const sub = submissions.find(s => s.studentId === st.id);
                                const hasSub = !!sub;
                                return `<option value="${lkpdEscapeAttr(st.id)}" ${hasSub ? '' : 'disabled'}>${lkpdEscapeHtml(st.name)} (${lkpdEscapeHtml(st.nis || '-')}) ${hasSub ? ' (Sudah Kumpul)' : ' (Belum Kumpul)'}</option>`;
                            }).join('')}
                        </select>
                        <p class="text-[10px] text-slate-400 mt-1">Siswa yang belum mengumpulkan tidak dapat dipilih / diunduh jawabannya.</p>
                    </div>
                </div>

                <div class="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                    <button type="button" onclick="document.getElementById('modal-container').innerHTML=''" class="px-5 py-2.5 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-2xl hover:bg-slate-100 transition cursor-pointer">
                        Batal
                    </button>
                    <button type="button" onclick="window.confirmDownloadLkpdStudentAnswer('${lkpdId}')" class="px-5 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-md shadow-emerald-600/20 rounded-2xl transition cursor-pointer flex items-center gap-1.5">
                        <i class="fa-solid fa-file-pdf"></i><span>Download PDF</span>
                    </button>
                </div>
            </div>
        </div>
    `;
};

window.confirmDownloadLkpdStudentAnswer = function(lkpdId) {
    const studentSelect = document.getElementById('download-lkpd-student-select');
    if (!studentSelect) return;
    const studentId = studentSelect.value;
    if (!studentId) {
        showToast('Pilih siswa yang sudah mengumpulkan terlebih dahulu.', 'warning');
        return;
    }

    document.getElementById('modal-container').innerHTML = '';
    window.downloadLkpdStudentPdf(lkpdId, studentId);
};

// Modal for Teacher to Grade Student Submission Side-by-Side
window.openGradeLkpdSubmissionModal = function(lkpdId, studentId) {
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    if (!lkpd) return;
    const sub = (lkpd.submissions || []).find(s => s.studentId === studentId);
    if (!sub) return;

    const markers = lkpd.markers || [];

    const modalHtml = `
        <div id="grade-sub-modal-bg" class="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-60 flex items-center justify-center p-3 sm:p-5 overflow-y-auto animate-fade-in">
            <div class="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-6xl w-full overflow-hidden my-4 flex flex-col max-h-[95vh]">
                <!-- Header -->
                <div class="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
                    <div>
                        <span class="text-[10px] font-extrabold text-amber-400 uppercase tracking-widest bg-amber-950 px-2.5 py-0.5 rounded-full border border-amber-800 inline-block mb-1">
                            Lembar Penilaian & Koreksi Guru
                        </span>
                        <h3 class="font-black text-lg text-white">${lkpdEscapeHtml(sub.studentName)} &bull; ${lkpdEscapeHtml(lkpd.title)}</h3>
                        <p class="text-xs text-slate-300">Bandingkan jawaban siswa dengan kunci guru, masukkan poin per nomor, dan simpan nilai.</p>
                    </div>
                    <button type="button" onclick="document.getElementById('grade-sub-modal-bg').remove()" class="w-9 h-9 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center text-white transition cursor-pointer">
                        <i class="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <!-- Two Column Form -->
                <form onsubmit="handleSaveSubmissionGrade(event, '${lkpd.id}', '${sub.studentId}')" class="grid grid-cols-1 lg:grid-cols-12 gap-6 p-5 sm:p-6 overflow-y-auto flex-1 text-xs">
                    <!-- Left Column: Canvas Preview for Context -->
                    <div class="lg:col-span-6 space-y-3">
                        <div class="bg-slate-100 p-3 rounded-2xl border border-slate-200 text-slate-700 font-bold text-xs flex items-center justify-between">
                            <span>Bagan Lembar Kerja Titik Penanda</span>
                            <span class="text-emerald-700">${markers.length} Titik Penanda</span>
                        </div>
                        ${renderLkpdCanvasComponent(lkpd, {
                            isEditable: false,
                            isPreview: true,
                            studentAnswers: sub.answers
                        })}
                    </div>

                    <!-- Right Column: Grading Inputs per Marker -->
                    <div class="lg:col-span-6 space-y-4">
                        <h4 class="font-black text-slate-800 text-sm flex items-center gap-2">
                            <i class="fa-solid fa-pen-ruler text-emerald-600"></i> Periksa Jawaban Tiap Nomor
                        </h4>

                        <div class="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
                            ${markers.map((mk, idx) => {
                                const num = mk.number || (idx + 1);
                                const studentAns = sub.answers ? (sub.answers[mk.id] || '') : '';
                                const curScore = sub.scores && typeof sub.scores[mk.id] === 'number' ? sub.scores[mk.id] : (mk.points || 25);
                                const curFeed = sub.feedback ? (sub.feedback[mk.id] || '') : '';

                                return `
                                    <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2.5">
                                        <div class="flex items-center justify-between">
                                            <span class="px-2.5 py-0.5 bg-indigo-700 text-white font-black text-xs rounded-xl">
                                                Nomor #${num}
                                            </span>
                                            <span class="text-[11px] font-bold text-slate-400">Bobot Maks: ${mk.points || 25} Poin</span>
                                        </div>

                                        <div>
                                            <span class="block text-[10px] font-bold text-slate-400 uppercase">Pertanyaan:</span>
                                            <p class="font-bold text-slate-800 text-xs">${lkpdEscapeHtml(mk.question)}</p>
                                        </div>

                                        <div class="p-2.5 bg-emerald-50/80 rounded-xl border border-emerald-200/80">
                                            <span class="block text-[10px] font-extrabold text-emerald-800 uppercase">Kunci Jawaban Guru:</span>
                                            <p class="text-xs text-emerald-950 font-medium">${lkpdEscapeHtml(mk.answerKey || '-')}</p>
                                        </div>

                                        <div class="p-2.5 bg-white rounded-xl border border-slate-200">
                                            <span class="block text-[10px] font-extrabold text-slate-500 uppercase">Jawaban Siswa:</span>
                                            <p class="text-xs font-bold text-slate-900 mt-0.5">${studentAns ? lkpdEscapeHtml(studentAns) : '<span class="text-rose-400 italic">Tidak menjawab</span>'}</p>
                                        </div>

                                        <div class="grid grid-cols-2 gap-3 pt-1">
                                            <div>
                                                <label class="block text-[10px] font-extrabold text-slate-600 mb-1">Skor Diperoleh:</label>
                                                <input type="number" id="grade-score-${mk.id}" value="${curScore}" min="0" max="${mk.points || 100}" required class="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-black text-emerald-700 focus:ring-2 focus:ring-emerald-500">
                                            </div>
                                            <div>
                                                <label class="block text-[10px] font-extrabold text-slate-600 mb-1">Catatan / Feedback:</label>
                                                <input type="text" id="grade-feed-${lkpdEscapeAttr(mk.id)}" value="${lkpdEscapeAttr(curFeed)}" placeholder="Komentar guru..." class="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-slate-700">
                                            </div>
                                        </div>
                                    </div>
                                `;
                            }).join('')}
                        </div>

                        <!-- Footer Actions -->
                        <div class="pt-3 border-t border-slate-200 flex items-center justify-between">
                            <button type="button" onclick="document.getElementById('grade-sub-modal-bg').remove()" class="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold rounded-xl transition cursor-pointer">
                                Batal
                            </button>
                            <button type="submit" class="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl shadow-md shadow-emerald-600/20 transition cursor-pointer flex items-center gap-2">
                                <i class="fa-solid fa-floppy-disk"></i> <span>Simpan & Terbitkan Nilai</span>
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    `;

    document.getElementById('grade-sub-modal-bg')?.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
};

window.handleSaveSubmissionGrade = async function(event, lkpdId, studentId) {
    event.preventDefault();
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    if (!lkpd) return;
    const sub = (lkpd.submissions || []).find(s => s.studentId === studentId);
    if (!sub) return;

    const markers = lkpd.markers || [];
    let totalScore = 0;
    const scores = {};
    const feedback = {};

    markers.forEach(mk => {
        const scoreInp = document.getElementById(`grade-score-${mk.id}`);
        const feedInp = document.getElementById(`grade-feed-${mk.id}`);
        const scoreVal = scoreInp ? Number(scoreInp.value) : 0;
        scores[mk.id] = scoreVal;
        feedback[mk.id] = feedInp ? feedInp.value : '';
        totalScore += scoreVal;
    });

    sub.scores = scores;
    sub.feedback = feedback;
    sub.totalScore = totalScore;
    sub.isGraded = true;
    sub.gradedBy = window.appState.currentUser ? window.appState.currentUser.name : 'Guru';
    sub.gradedAt = new Date().toISOString();

    await saveLkpdState();
    showToast(`Nilai berhasil disimpan! Total skor: ${totalScore}`, "success");
    document.getElementById('grade-sub-modal-bg')?.remove();

    // Re-render evaluation view
    const evalContainer = document.getElementById('lkpd-evaluation-container');
    if (evalContainer) {
        renderLkpdEvaluationSection(evalContainer, lkpd.id);
    }
};

// ============================================================================
// PDF EXPORT SYSTEM
// ============================================================================
window.downloadLkpdStudentPdf = function(lkpdId, studentId) {
    const lkpds = initLkpdState();
    const lkpd = lkpds.find(l => l.id === lkpdId);
    if (!lkpd) return;

    const sub = (lkpd.submissions || []).find(s => s.studentId === studentId);
    if (!sub) return;

    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Mohon izinkan pop-up browser untuk mengunduh PDF lembar kerja!");
        return;
    }

    const imgScale = lkpd.imageScale || 100;
    const mSize = lkpd.markerSize || 44;
    const mColor = lkpd.markerColor || '#4f46e5';
    const mStyle = lkpd.markerStyle || 'standard';

    // Prepare canvas visual HTML - absolutely matching renderLkpdCanvasComponent layout
    const canvasHtml = renderLkpdCanvasComponent(lkpd, { isEditable: false, isPreview: true, studentAnswers: sub.answers || {} });

    // Prepare markers and answers HTML
    const markersHtml = lkpd.markers.map((mk, idx) => {
        const num = mk.number || (idx + 1);
        const rawAns = sub.answers ? String(sub.answers[mk.id] || '') : '';
        const ans = rawAns ? lkpdEscapeHtml(rawAns) : '<span style="color:#ef4444; font-style:italic;">Tidak dijawab</span>';
        const pts = sub.scores && sub.scores[mk.id] !== undefined ? sub.scores[mk.id] : 0;
        const maxPts = mk.points || 25;
        const fb = sub.feedback ? String(sub.feedback[mk.id] || '-') : '-';

        return `
            <div class="question-item">
                <div class="question-header">
                    <span class="num-badge">Pertanyaan #${num}</span>
                    <span class="score-badge">Skor: <strong>${pts}</strong> / ${maxPts} Poin</span>
                </div>
                <div class="question-body">
                    <strong style="color: #475569;">Pertanyaan:</strong>
                    <p style="margin: 4px 0 12px 0; color: #1e293b; font-weight: 700; font-size: 13px;">${lkpdEscapeHtml(mk.question)}</p>
                    
                    <strong style="color: #047857;">Jawaban Siswa:</strong>
                    <div class="student-answer">${ans}</div>
                    
                    ${fb && fb !== '-' ? `
                        <div class="teacher-feedback">
                            <strong>Ulasan Guru:</strong>
                            <p style="margin: 4px 0 0 0; color: #92400e; font-style: italic; font-weight: 600;">${lkpdEscapeHtml(fb)}</p>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');

    const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Hasil_LKPD_${lkpdEscapeHtml(lkpd.title.replace(/\s+/g, '_'))}_${lkpdEscapeHtml(sub.studentName.replace(/\s+/g, '_'))}</title>
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
            <style>
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap');
                body {
                    font-family: 'Plus Jakarta Sans', sans-serif;
                    color: #0f172a;
                    background: #ffffff;
                    margin: 0;
                    padding: 30px;
                    font-size: 12px;
                    line-height: 1.5;
                }
                .kop-surat {
                    border-bottom: 3px double #0f172a;
                    padding-bottom: 12px;
                    margin-bottom: 20px;
                    text-align: center;
                }
                .kop-surat h1 {
                    font-size: 20px;
                    font-weight: 800;
                    margin: 0 0 4px 0;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .kop-surat h2 {
                    font-size: 11px;
                    font-weight: 700;
                    margin: 0;
                    color: #475569;
                    text-transform: uppercase;
                }
                .meta-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-bottom: 20px;
                }
                .meta-table td {
                    padding: 5px 8px;
                    vertical-align: top;
                }
                .meta-table td.label {
                    font-weight: 700;
                    color: #475569;
                    width: 18%;
                }
                .meta-table td.value {
                    color: #0f172a;
                    font-weight: 700;
                }
                .meta-card {
                    background: #f1f5f9;
                    padding: 15px;
                    border-radius: 16px;
                    margin-bottom: 25px;
                    border: 1px solid #e2e8f0;
                }
                .score-panel {
                    background: #f0fdf4;
                    border: 1px solid #bbf7d0;
                    border-radius: 16px;
                    padding: 15px;
                    text-align: center;
                    margin-bottom: 20px;
                }
                .score-panel h3 {
                    margin: 0;
                    font-size: 11px;
                    color: #166534;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }
                .score-panel .score-val {
                    font-size: 32px;
                    font-weight: 800;
                    color: #15803d;
                    margin: 4px 0;
                }
                .score-panel .score-meta {
                    font-size: 11px;
                    color: #166534;
                    font-weight: 700;
                }
                .section-title {
                    font-size: 13px;
                    font-weight: 800;
                    border-bottom: 2px solid #e2e8f0;
                    padding-bottom: 4px;
                    margin: 25px 0 12px 0;
                    color: #0f172a;
                    text-transform: uppercase;
                    letter-spacing: 0.5px;
                }
                .question-item {
                    border: 1px solid #e2e8f0;
                    border-radius: 12px;
                    margin-bottom: 16px;
                    overflow: hidden;
                    page-break-inside: avoid;
                }
                .question-header {
                    background: #f8fafc;
                    padding: 8px 12px;
                    border-bottom: 1px solid #e2e8f0;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .num-badge {
                    font-weight: 800;
                    color: #0f172a;
                }
                .score-badge {
                    font-size: 11px;
                    color: #475569;
                    font-weight: 700;
                }
                .question-body {
                    padding: 12px;
                }
                .student-answer {
                    background: #f1f5f9;
                    border-radius: 8px;
                    padding: 8px 10px;
                    margin: 5px 0 10px 0;
                    font-weight: 600;
                    color: #0f172a;
                    white-space: pre-wrap;
                }
                .teacher-feedback {
                    background: #fffbeb;
                    border-left: 4px solid #f59e0b;
                    border-radius: 4px;
                    padding: 8px 10px;
                    margin-top: 8px;
                }
                .footer {
                    margin-top: 40px;
                    text-align: center;
                    font-size: 10px;
                    color: #94a3b8;
                    border-top: 1px solid #f1f5f9;
                    padding-top: 12px;
                }
                @media print {
                    body {
                        padding: 0;
                    }
                    .score-panel {
                        background: #f0fdf4 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .question-header {
                        background: #f8fafc !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .student-answer {
                        background: #f1f5f9 !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .teacher-feedback {
                        background: #fffbeb !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            </style>
        </head>
        <body>
            <div class="kop-surat">
                <h1>MADRASAH DIGITAL TERPADU</h1>
                <h2>LAPORAN EVALUASI & KOREKSI DIGITAL LEMBAR KERJA SISWA</h2>
            </div>

            <div class="score-panel">
                <h3>Nilai Akhir Evaluasi LKPD</h3>
                <div class="score-val">${sub.totalScore} / 100</div>
                <div class="score-meta">Status kelulusan tuntas &bull; Dikoreksi oleh: ${sub.gradedBy || 'Guru Pendamping'}</div>
            </div>

            <div class="section-title">Profil Peserta Didik & Lembar Kerja</div>
            <table class="meta-table">
                <tr>
                    <td class="label">Nama Lengkap</td>
                    <td class="value">: ${lkpdEscapeHtml(sub.studentName)}</td>
                    <td class="label">Mata Pelajaran</td>
                    <td class="value">: ${lkpd.subjectName || 'Umum'}</td>
                </tr>
                <tr>
                    <td class="label">Nomor Induk (NIS)</td>
                    <td class="value">: ${sub.nis || '-'}</td>
                    <td class="label">Lembar Kerja</td>
                    <td class="value">: ${lkpdEscapeHtml(lkpd.title)}</td>
                </tr>
                <tr>
                    <td class="label">Kelas / Rombel</td>
                    <td class="value">: ${sub.className || '-'}</td>
                    <td class="label">Tanggal Dinilai</td>
                    <td class="value">: ${sub.gradedAt ? new Date(sub.gradedAt).toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric'}) : '-'}</td>
                </tr>
            </table>

            <div class="section-title">Visual Lembar Kerja & Penanda Soal</div>
            ${canvasHtml}

            <div class="section-title">Rincian Jawaban, Koreksi, & Nilai Soal</div>
            ${markersHtml}

            <div class="footer">
                Dokumen hasil evaluasi digital ini sah dan diterbitkan secara resmi oleh sistem Madrasah Digital Terpadu.<br>
                Tanggal Cetak: ${new Date().toLocaleDateString('id-ID', {day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'})} WIB
            </div>

            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 1500);
                }
            </script>
        </body>
        </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
};

window.checkAndResumeActiveLkpdSession = function() {
    try {
        const rawSess = localStorage.getItem('madrasah_active_lkpd_session');
        if (!rawSess) return false;
        const sess = JSON.parse(rawSess);
        if (sess && sess.lkpdId && sess.studentId) {
            const lkpds = typeof initLkpdState === 'function' ? initLkpdState() : [];
            const lkpd = lkpds.find(l => l.id === sess.lkpdId);
            if (lkpd) {
                const existingSub = Array.isArray(lkpd.submissions) ? lkpd.submissions.find(s => s.studentId === sess.studentId) : null;
                if (!existingSub) {
                    if (typeof window.openStudentLkpdWorksheetModal === 'function') {
                        window.openStudentLkpdWorksheetModal(sess.lkpdId, sess.studentId);
                        return true;
                    }
                } else {
                    localStorage.removeItem('madrasah_active_lkpd_session');
                }
            }
        }
    } catch(e) {}
    return false;
};
