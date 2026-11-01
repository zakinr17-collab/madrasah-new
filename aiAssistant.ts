// ============================================================================
// AI ASSISTANT AGENT (ADMIN) — asisten AI dengan kemampuan "agent":
// - Melihat data aplikasi live (statistik, cari siswa/guru/kelas/ujian)
// - Mengarahkan admin langsung ke halaman tertentu (navigasi otomatis)
// Implementasi: tool-calling loop terhadap provider OpenAI-compatible
// (custom) — model memanggil tool, server eksekusi, hasil dikembalikan ke
// model hingga jawaban final. Fallback callAI (custom lama/Gemini) tanpa tool.
// ============================================================================
import type { Express, Request, Response } from "express";

interface AssistantHelpers {
  requireAuth: (...args: any[]) => any;
  requireRole: (roles: string[]) => any;
  getAuthUser: (req: any) => any;
  callAI: (ai: any, params: any) => Promise<any>;
}

type ChatTurn = { role: "user" | "assistant"; content: string };
const assistantSessions = new Map<string, { turns: ChatTurn[]; updatedAt: number }>();
const ASSISTANT_MAX_TURNS = 40;
const ASSISTANT_SESSION_TTL = 1000 * 60 * 60 * 12; // 12 jam

// ---------------------------------------------------------------------------
// PETA ELEMEN UI per halaman — kunci -> CSS selector + deskripsi.
// Dipakai tool highlight_element (server menandai __highlight, frontend
// mencari elemennya lalu memberi sorot berdenyut + tooltip).
// ---------------------------------------------------------------------------
type UIElementDef = { sel: string; desc: string };
const UI_ELEMENT_MAP: Record<string, Record<string, UIElementDef>> = {
  setting: {
    account_search: { sel: "#account-search-input", desc: "Kolom pencarian akun pengguna (nama/NIS/NIP/username) di kartu Pengaturan Akun & Peran" },
    set_school_name: { sel: "#set-school", desc: "Kolom nama madrasah/sekolah" },
    set_admin_name: { sel: "#set-admin-name", desc: "Kolom nama administrator" },
    chat_toggle: { sel: "#set-chat-enabled", desc: "Saklar aktif/nonaktif chat" },
    running_text: { sel: "#set-running-text", desc: "Kolom teks berjalan" },
    turn_username: { sel: "#set-turn-username", desc: "Kolom TURN username (pengaturan server video)" },
  },
  siswa: {
    student_search: { sel: "#student-search-input, #search-student-input, input[placeholder*='cari siswa' i], input[placeholder*='Cari siswa' i]", desc: "Kolom pencarian siswa" },
    add_student_btn: { sel: "button[onclick*='openAddStudent'], button[onclick*='addStudent']", desc: "Tombol tambah siswa" },
  },
  guru: {
    teacher_search: { sel: "#teacher-search-input, #search-teacher-input, input[placeholder*='cari guru' i], input[placeholder*='Cari guru' i]", desc: "Kolom pencarian guru" },
  },
  kelas: {
    class_search: { sel: "input[placeholder*='cari kelas' i], input[placeholder*='Cari kelas' i], #class-search-input", desc: "Kolom pencarian kelas" },
  },
  bank_soal: {
    question_search: { sel: "input[placeholder*='cari soal' i], input[placeholder*='Cari soal' i], #question-search-input", desc: "Kolom pencarian soal" },
  },
  asesmen: {
    exam_list: { sel: "#exam-list-container, #assessment-list", desc: "Daftar ujian/sesi asesmen" },
  },
  modul_ajar: {
    subject_search: { sel: "input[placeholder*='cari mapel' i], input[placeholder*='Cari mapel' i], #mapel-search-input", desc: "Kolom pencarian mata pelajaran" },
  },
  dashboard: {
    attendance_trend: { sel: "", desc: "Kartu grafik Tren Kehadiran Mingguan (disorot via pencarian teks)" },
    quick_actions: { sel: "", desc: "Baris kartu Aksi Cepat & Navigasi Pintas (Absen Siswa, Ujian CBT, Bank Soal)" },
    agenda_banner: { sel: "", desc: "Banner Agenda & Hari Libur Terdekat" },
    recent_students: { sel: "", desc: "Bagian Siswa Terdaftar Terakhir" },
    activity_log: { sel: "", desc: "Bagian Log Aktivitas Sistem" },
  },
};

// ---------------------------------------------------------------------------
// TOOLS
// ---------------------------------------------------------------------------
type ToolDef = { name: string; description: string; parameters: any; exec: (args: any, req: any) => any };

function tenantOf(item: any): string {
  return String(item?.madrasahId || item?.madrasahSlug || item?.tenant || "default");
}

function scopedAll(list: any[], req: any): any[] {
  const authUser = (globalThis as any).__assistantAuthUser;
  const explicitTenantRaw = req?.headers?.["x-madrasah-id"] || req?.query?.madrasahId;
  const explicitTenant = explicitTenantRaw ? String(explicitTenantRaw) : "";
  const arr = Array.isArray(list) ? list : [];
  if (explicitTenant) return arr.filter((item: any) => tenantOf(item) === explicitTenant);
  const role = String(authUser?.role || "").toLowerCase();
  if (role === "bos" || role === "superadmin") return arr; // bos: lintas tenant
  const tenant = tenantOf(authUser || {});
  if (tenant === "default") return arr;
  return arr.filter((item: any) => tenantOf(item) === tenant);
}

function makeTools(): ToolDef[] {
  const g: any = globalThis as any;
  return [
    {
      name: "get_statistics",
      description: "Dapatkan statistik ringkas aplikasi: jumlah siswa, guru, kelas, mata pelajaran, ujian, bank soal, modul ajar, kehadiran hari ini.",
      parameters: { type: "object", properties: {} },
      exec: (_args: any, req: any) => {
        const students = scopedAll(g.__assistantStore?.students, req);
        const teachers = scopedAll(g.__assistantStore?.teachers, req);
        const classes = scopedAll(g.__assistantStore?.classes, req);
        const subjects = scopedAll(g.__assistantStore?.subjects, req);
        const exams = scopedAll(g.__assistantStore?.exams, req);
        const questions = scopedAll(g.__assistantStore?.questions, req);
        const lessonPlans = scopedAll(g.__assistantStore?.lessonPlans, req);
        const attendance = scopedAll(g.__assistantStore?.attendance, req);
        const todayStr = new Date().toISOString().split("T")[0];
        const attToday = attendance.filter((a: any) => String(a?.date || "").split(" ")[0] === todayStr).length;
        return {
          totalSiswa: students.length,
          totalGuru: teachers.length,
          totalKelas: classes.length,
          totalMapel: subjects.length,
          totalUjian: exams.length,
          totalBankSoal: questions.length,
          totalModulAjar: lessonPlans.length,
          kehadiranHariIni: attToday,
          tanggalHariIni: todayStr,
        };
      },
    },
    {
      name: "search_students",
      description: "Cari siswa berdasarkan nama, NIS, atau kelas. Maks 15 hasil.",
      parameters: { type: "object", properties: { query: { type: "string", description: "Nama/NIS/kelas yang dicari" } }, required: ["query"] },
      exec: (args: any, req: any) => {
        const q = String(args.query || "").toLowerCase();
        const students = scopedAll(g.__assistantStore?.students, req);
        return students
          .filter((s: any) => [s.name, s.nis, s.className, s.classId, s.kelas].some((v: any) => String(v || "").toLowerCase().includes(q)))
          .slice(0, 15)
          .map((s: any) => ({ nama: s.name, nis: s.nis, kelas: s.className || s.kelas || s.classId, id: s.id, aktif: s.isActive !== false }));
      },
    },
    {
      name: "search_teachers",
      description: "Cari guru berdasarkan nama, username, atau mata pelajaran. Maks 15 hasil.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      exec: (args: any, req: any) => {
        const q = String(args.query || "").toLowerCase();
        const teachers = scopedAll(g.__assistantStore?.teachers, req);
        return teachers
          .filter((t: any) => [t.name, t.username, t.subject, t.mapel].some((v: any) => String(v || "").toLowerCase().includes(q)))
          .slice(0, 15)
          .map((t: any) => ({ nama: t.name, username: t.username, mapel: t.subject || t.mapel || "", id: t.id }));
      },
    },
    {
      name: "list_classes",
      description: "Daftar semua kelas beserta jumlah siswanya.",
      parameters: { type: "object", properties: {} },
      exec: (_args: any, req: any) => {
        const classes = scopedAll(g.__assistantStore?.classes, req);
        const students = scopedAll(g.__assistantStore?.students, req);
        return classes.map((c: any) => ({
          nama: c.name || c.className,
          id: c.id,
          jumlahSiswa: students.filter((s: any) => String(s.classId || s.kelas || "") === String(c.id) || String(s.className || "") === String(c.name || c.className)).length,
        }));
      },
    },
    {
      name: "search_exams",
      description: "Cari ujian berdasarkan judul/mapel/kelas. Menunjukkan status aktif. Maks 15 hasil.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      exec: (args: any, req: any) => {
        const q = String(args.query || "").toLowerCase();
        const exams = scopedAll(g.__assistantStore?.exams, req);
        return exams
          .filter((e: any) => [e.title, e.name, e.subject, e.subjectName, e.className, e.classId].some((v: any) => String(v || "").toLowerCase().includes(q)))
          .slice(0, 15)
          .map((e: any) => ({ judul: e.title || e.name, mapel: e.subject || e.subjectName || "", kelas: e.className || e.classId || "", aktif: e.isActive === true || e.status === "active", id: e.id }));
      },
    },
    {
      name: "navigate_to",
      description: "WAJIB dipanggil setiap kali admin meminta dibukakan/diantarkan ke halaman, atau bertanya 'di mana' suatu fitur. PANGGIL TOOL INI DULU sebelum menulis jawaban akhir — jangan hanya mengklaim sudah mengantarkan tanpa memanggil tool.",
      parameters: {
        type: "object",
        properties: {
          route: { type: "string", description: "Salah satu: dashboard, siswa, guru, kelas, mapel, jadwal, asesmen, bank_soal, modul_ajar, evaluasi, kalender, setting, perizinan, ai_assistant" },
          label: { type: "string", description: "Nama halaman yang ramah, mis. 'Data Siswa'" },
        },
        required: ["route"],
      },
      exec: (args: any, _req: any) => {
        const VALID = ["dashboard", "siswa", "guru", "kelas", "mapel", "jadwal", "asesmen", "bank_soal", "modul_ajar", "evaluasi", "kalender", "setting", "perizinan", "ai_assistant"];
        const route = String(args.route || "").trim().toLowerCase();
        if (!VALID.includes(route)) return { ok: false, error: `Route tidak dikenal: ${route}. Gunakan salah satu: ${VALID.join(", ")}` };
        return { ok: true, route, label: args.label || route, __navigate: route };
      },
    },
    {
      name: "highlight_element",
      description: "TUNJUK/sorot elemen UI tertentu di halaman (setelah navigate_to). Admin melihat kotak sorot berdenyut + panah pada elemen yang dimaksud. Gunakan saat admin minta 'tunjukkan kolom X', 'yang mana tombol Y', atau menjelaskan lokasi elemen.",
      parameters: {
        type: "object",
        properties: {
          route: { type: "string", description: "Halaman tempat elemen berada (sama seperti navigate_to)." },
          element: { type: "string", description: "Kunci elemen dari daftar ELEMENT_MAP, mis. 'account_search', 'set_school_name', 'set_teacher_name', 'reset_password_input', 'profile_tab'." },
          label: { type: "string", description: "Nama ramah elemen untuk tooltip, mis. 'Kolom pencarian akun'." },
        },
        required: ["route", "element"],
      },
      exec: (args: any, _req: any) => {
        const VALID = ["dashboard", "siswa", "guru", "kelas", "mapel", "jadwal", "asesmen", "bank_soal", "modul_ajar", "evaluasi", "kalender", "setting", "perizinan", "ai_assistant"];
        const route = String(args.route || "").trim().toLowerCase();
        const element = String(args.element || "").trim();
        if (!VALID.includes(route)) return { ok: false, error: `Route tidak dikenal: ${route}` };
        if (!element) return { ok: false, error: "element wajib diisi" };
        return { ok: true, route, element, label: args.label || element, __navigate: route, __highlight: element, __label: args.label || element };
      },
    },
    {
      name: "list_ui_elements",
      description: "Lihat daftar kunci elemen UI yang bisa disorot per halaman (untuk memilih argumen 'element' yang benar pada highlight_element).",
      parameters: {
        type: "object",
        properties: { route: { type: "string", description: "Halaman yang ingin dilihat elemennya." } },
        required: ["route"],
      },
      exec: (args: any, _req: any) => {
        const route = String(args.route || "").trim().toLowerCase();
        const map = UI_ELEMENT_MAP[route];
        if (!map) return { ok: false, error: `Tidak ada peta elemen untuk route: ${route}. Halaman dengan peta: ${Object.keys(UI_ELEMENT_MAP).join(", ")}` };
        return { ok: true, route, elements: Object.entries(map).map(([k, v]) => ({ key: k, deskripsi: v.desc })) };
      },
    },
  ];
}

function toolDefsForProvider(tools: ToolDef[]) {
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

// ---------------------------------------------------------------------------
// SYSTEM PROMPT
// ---------------------------------------------------------------------------
function buildAssistantSystemPrompt(): string {
  return `Kamu adalah "Asisten Madrasah" — asisten AI AGENT resmi di dalam aplikasi CBT & manajemen madrasah "Madrasah Digital".

KAMU PUNYA KEMAMPUAN AGENT:
- Kamu bisa MEMANGGIL TOOLS untuk melihat data live aplikasi (statistik, cari siswa/guru/kelas/ujian) — lakukan SEBELUM menjawab pertanyaan tentang data; jangan pernah mengarang angka.
- Kamu bisa MEMANGGIL navigate_to untuk MENGANTAR admin langsung ke halaman tertentu — gunakan saat admin bertanya "di mana", "buka", "tunjukkan", atau setelah menjelaskan cara pakai sebuah fitur agar admin langsung diantar ke sana. Dalam jawaban, sebutkan secara natural bahwa kamu sudah mengantarkan/membuka halamannya.

PENGETAHUANMU TENTANG APLIKASI:
- Aplikasi CBT + manajemen madrasah: data siswa/guru/kelas/mapel, ujian CBT (pilihan ganda & esay) dengan monitoring real-time & mode fokus, koreksi otomatis AI, modul ajar (17 komponen) + kisi-kisi/naskah soal, RPP/silabus/ATP/KKTP/Prota/Prosem/LKPD, evaluasi & unduh lembar jawaban, Perizinan Guru (AI & Drive), chat antar pengguna, kalender, gamifikasi, buku sumber (OCR), pengaturan profil AI & lisensi offline.
- AI di aplikasi memakai API key yang diaktifkan di Pengaturan (profil AI aktif) — kamu sendiri berjalan di atasnya.
- Mode online (Cloud SQL) dan mode offline (VPS lokal) keduanya didukung.

ATURAN JAWABAN:
- Selalu Bahasa Indonesia, ramah, terstruktur (poin/strip, TANPA markdown ** atau #).
- Pertanyaan data ("berapa siswa", "siapa guru X", "kelas mana paling ramai") → panggil tool dulu.
- Pertanyaan umum non-aplikasi → jawab seperti asisten AI biasa tanpa tool.
- Jangan menyebut nama tool secara teknis; sebutkan natural ("saya cek dulu datanya…", "sudah saya antarkan ke halamannya…").`;
}

// ---------------------------------------------------------------------------
// SESSION HELPERS
// ---------------------------------------------------------------------------
function getSession(req: any): { key: string; session: { turns: ChatTurn[]; updatedAt: number } } {
  const authUser = (globalThis as any).__assistantAuthUser;
  const key = String(authUser?.username || authUser?.id || req.ip || "admin");
  const now = Date.now();
  for (const [k, v] of assistantSessions) {
    if (now - v.updatedAt > ASSISTANT_SESSION_TTL) assistantSessions.delete(k);
  }
  let session = assistantSessions.get(key);
  if (!session) {
    session = { turns: [], updatedAt: now };
    assistantSessions.set(key, session);
  }
  session.updatedAt = now;
  return { key, session };
}

function pushTurn(session: { turns: ChatTurn[] }, role: "user" | "assistant", content: string) {
  session.turns.push({ role, content });
  while (session.turns.length > ASSISTANT_MAX_TURNS) session.turns.shift();
}

function foldHistory(session: { turns: ChatTurn[] }, current: string): string {
  const hist = session.turns.slice(0, -1)
    .map((t) => (t.role === "user" ? "Admin: " : "Asisten: ") + t.content)
    .join("\n\n");
  return hist ? `Riwayat percakapan sebelumnya (konteks):\n\n${hist}\n\n---\nPesan baru dari admin:\n${current}` : current;
}

// ---------------------------------------------------------------------------
// INTENT FALLBACK: deteksi permintaan navigasi dari teks admin secara
// deterministik — menjamin navigasi NYATA meski model lupa memanggil tool.
// ---------------------------------------------------------------------------
const NAV_INTENT_PATTERNS: Array<{ re: RegExp; route: string }> = [
  { re: /(evaluasi|hasil ujian|penilaian hasil)/i, route: "evaluasi" },
  { re: /(data siswa|halaman siswa|buka siswa|ke siswa|daftar siswa)/i, route: "siswa" },
  { re: /(data guru|halaman guru|buka guru|ke guru|daftar guru)/i, route: "guru" },
  { re: /(data kelas|halaman kelas|buka kelas|ke kelas|daftar kelas)/i, route: "kelas" },
  { re: /(mata pelajaran|\bmapel\b)/i, route: "mapel" },
  { re: /(jadwal)/i, route: "jadwal" },
  { re: /(asesmen|monitoring ujian|monitor ujian|sesi ujian)/i, route: "asesmen" },
  { re: /(bank soal|soal)/i, route: "bank_soal" },
  { re: /(modul ajar)/i, route: "modul_ajar" },
  { re: /(kalender|agenda)/i, route: "kalender" },
  { re: /(pengaturan|setting)/i, route: "setting" },
  { re: /(perizinan)/i, route: "perizinan" },
  { re: /(dashboard|beranda)/i, route: "dashboard" },
];

const NAV_REQUEST_RE = /(antar|buka(?:kan)?|tunjuk(?:an)?|arah(?:kan)?|pindah(?:kan)?|masuk ke|ke halaman|bawakan|navigasi|go to|open)/i;

function detectNavigationIntent(userText: string): string[] {
  const nav: string[] = [];
  if (!NAV_REQUEST_RE.test(userText)) return nav;
  for (const p of NAV_INTENT_PATTERNS) {
    if (p.re.test(userText)) { nav.push(p.route); break; }
  }
  return nav;
}

// Klaim navigasi tanpa aksi: reply menyebut mengantar tetapi tidak ada tool call
const NAV_CLAIM_RE = /(sudah (saya )?(antarkan|buka(?:n)?|mengantarkan|arahkan)|telah (saya )?(antarkan|buka)|mengantar(kan)? (kamu|anda|bos|admin))/i;

function reconcileNavigation(reply: string, userText: string, navigation: string[]): string[] {
  if (navigation.length > 0) return navigation;
  if (NAV_CLAIM_RE.test(reply)) {
    return detectNavigationIntent(userText);
  }
  return [];
}

// ---------------------------------------------------------------------------
// RECONCILE HIGHLIGHT: bila admin eksplisit minta "tunjukkan/sorot kolom X"
// dan model tidak memanggil highlight_element, eksekusi sendiri secara
// deterministik (kata kunci -> route + element).
// ---------------------------------------------------------------------------
const HIGHLIGHT_INTENT_RE = /(tunjuk(?:an|kan)?|sorot|tandai|tunjukkan|mana (?:kolom|tombol|yang|letak)|dimana|di mana|kolom (?:username|pencarian)|highlight|\bcari (?:menu|tren|grafik|kartu|kolom|tombol)|letak)/i;

const HIGHLIGHT_ELEMENT_PATTERNS: Array<{ re: RegExp; route: string; element: string; label: string }> = [
  { re: /kolom (?:pencarian )?(?:akun|username|user name|nis|nama)/i, route: "setting", element: "account_search", label: "Kolom pencarian akun (username/NIS/NIP)" },
  { re: /nama (?:madrasah|sekolah)/i, route: "setting", element: "set_school_name", label: "Kolom nama madrasah" },
  { re: /nama admin(?:istrator)?/i, route: "setting", element: "set_admin_name", label: "Kolom nama administrator" },
  { re: /(?:cari|pencarian) siswa/i, route: "siswa", element: "student_search", label: "Kolom pencarian siswa" },
  { re: /(?:cari|pencarian) guru/i, route: "guru", element: "teacher_search", label: "Kolom pencarian guru" },
  { re: /(?:cari|pencarian) kelas/i, route: "kelas", element: "class_search", label: "Kolom pencarian kelas" },
  { re: /(?:cari|pencarian) soal/i, route: "bank_soal", element: "question_search", label: "Kolom pencarian soal" },
  { re: /(tren kehadiran|kehadiran mingguan|grafik kehadiran)/i, route: "dashboard", element: "attendance_trend", label: "Kartu Tren Kehadiran Mingguan" },
  { re: /(aksi cepat|navigasi pintas)/i, route: "dashboard", element: "quick_actions", label: "Baris Aksi Cepat" },
  { re: /(agenda|hari libur)/i, route: "dashboard", element: "agenda_banner", label: "Banner Agenda & Hari Libur" },
  { re: /siswa terdaftar terakhir/i, route: "dashboard", element: "recent_students", label: "Bagian Siswa Terdaftar Terakhir" },
  { re: /(log aktivitas)/i, route: "dashboard", element: "activity_log", label: "Bagian Log Aktivitas Sistem" },
];

function detectHighlightIntent(userText: string): Array<{ route: string; element: string; label: string }> {
  if (!HIGHLIGHT_INTENT_RE.test(userText)) return [];
  for (const p of HIGHLIGHT_ELEMENT_PATTERNS) {
    if (p.re.test(userText)) return [{ route: p.route, element: p.element, label: p.label }];
  }
  return [];
}

// ---------------------------------------------------------------------------
// AGENT LOOP (custom OpenAI-compatible provider dengan function calling)
// ---------------------------------------------------------------------------
const MAX_TOOL_ROUNDS = 5;

async function runAgent(text: string, session: any, req: any, h: AssistantHelpers) {
  const tools = makeTools();
  const g: any = globalThis as any;
  const runtime = g.__aiProviderRuntime || {};
  const baseUrl = String(runtime.customBaseUrl || process.env.CUSTOM_AI_BASE_URL || "https://token.lightvela.ai/v1").replace(/\/$/, "");
  const apiKey = runtime.customApiKey || process.env.CUSTOM_AI_API_KEY || "";
  const model = runtime.customModel || process.env.CUSTOM_AI_MODEL || "auto";

  const messages: any[] = [{ role: "system", content: buildAssistantSystemPrompt() }];
  for (const t of session.turns.slice(0, -1)) {
    messages.push({ role: t.role === "user" ? "user" : "assistant", content: t.content });
  }
  messages.push({ role: "user", content: text });

  const navigation: string[] = [];
  const highlights: Array<{ route: string; element: string; label: string }> = [];

  const processToolResult = (result: any) => {
    if (result && result.__navigate) {
      navigation.push(result.route);
    }
    if (result && result.__highlight) {
      highlights.push({ route: result.route, element: result.__highlight, label: result.__label || result.__highlight });
    }
    if (result && (result.__navigate || result.__highlight)) {
      const { __navigate, __highlight, __label, ...rest } = result;
      return rest;
    }
    return result;
  };

  if (apiKey && baseUrl) {
    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const resp = await fetch(`${baseUrl}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model,
            messages,
            tools: toolDefsForProvider(tools),
            tool_choice: "auto",
            temperature: 0.6,
            max_tokens: 2048,
          }),
          signal: AbortSignal.timeout(60000),
        });
        if (!resp.ok) throw new Error(`Provider ${resp.status}`);
        const data: any = await resp.json();
        const msg = data?.choices?.[0]?.message;
        if (!msg) throw new Error("Respons provider tidak dikenal");

        const toolCalls = msg.tool_calls || [];
        if (!toolCalls.length) {
          const reply = String(msg.content || "").trim();
          if (reply) return { reply, navigation, highlights };
          break;
        }
        messages.push(msg);
        for (const tc of toolCalls) {
          const def = tools.find((t) => t.name === tc?.function?.name);
          let result: any;
          try {
            const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments || "{}") : (tc.function.arguments || {});
            result = def ? def.exec(args, req) : { ok: false, error: "Tool tidak dikenal" };
          } catch (e: any) {
            result = { ok: false, error: e?.message || "Tool gagal" };
          }
          if (result && result.__navigate) {
            navigation.push(result.route);
            result = { ok: true, route: result.route, label: result.label, message: "Navigasi dikirim ke browser admin." };
          }
          if (result && result.__highlight) {
            result = { ok: true, route: result.route, element: result.__highlight, label: result.__label || result.__highlight, message: "Sorotan elemen dikirim ke browser admin." };
          }
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) });
        }
      }
    } catch (e: any) {
      console.warn("[AIAssistant] agent loop gagal, fallback callAI:", e?.message);
    }
  }

  // Fallback level 1: Gemini agent (function calling native) — setiap jalur
  // API key tetap mampu menjadi agent penuh.
  if (process.env.GEMINI_API_KEY) {
    try {
      const gem = await runGeminiAgent(text, session, req, true);
      if (gem.reply) return gem;
    } catch (e: any) {
      console.warn("[AIAssistant] Gemini agent fallback gagal:", e?.message);
    }
  }

  // Fallback level 2 (terakhir): callAI teks biasa tanpa tool
  const response = await h.callAI(null, {
    contents: foldHistory(session, text),
    config: { systemInstruction: buildAssistantSystemPrompt(), generationConfig: { temperature: 0.6, maxOutputTokens: 2048 } },
  });
  const reply = String(response?.text || "").trim();
  if (!reply) throw new Error("AI memberikan respons kosong.");
  return { reply, navigation, highlights: highlights || [] };
}

// ---------------------------------------------------------------------------
// ENDPOINTS
// ---------------------------------------------------------------------------
export function registerAiAssistantEndpoints(app: Express, h: AssistantHelpers) {
  app.post("/api/ai-assistant/chat", h.requireAuth, h.requireRole(["admin", "administrator", "bos", "superadmin"]), async (req: Request, res: Response) => {
    try {
      const { message } = (req.body || {}) as { message?: string };
      const text = String(message || "").trim();
      if (!text) return res.status(400).json({ success: false, message: "Pesan tidak boleh kosong." });

      (globalThis as any).__assistantAuthUser = h.getAuthUser(req);
      const { session } = getSession(req);
      pushTurn(session, "user", text);

      const { reply, navigation: agentNav, highlights: agentHl } = await runAgent(text, session, req, h);
      // Jaminan navigasi nyata: bila model mengklaim mengantar tanpa tool call,
      // ekstrak tujuan dari teks admin secara deterministik.
      const navigation = reconcileNavigation(reply, text, agentNav);
      // Jaminan sorotan nyata: intent eksplisit "tunjukkan kolom X" dijamin tereksekusi.
      const highlights = agentHl && agentHl.length ? agentHl : detectHighlightIntent(text);
      // Bila highlight diberikan tapi halamannya belum dinavigasi, pastikan pindah dulu.
      const navSet = new Set(navigation);
      for (const hl of highlights) { if (!navSet.has(hl.route)) navigation.unshift(hl.route); }
      pushTurn(session, "assistant", reply);

      return res.json({ success: true, reply, navigation, highlights, turns: session.turns.length });
    } catch (err: any) {
      console.error("[AIAssistant] chat gagal:", err?.message || err);
      return res.status(500).json({ success: false, message: err?.message || "Asisten AI gagal merespons." });
    }
  });

  app.get("/api/ai-assistant/history", h.requireAuth, h.requireRole(["admin", "administrator", "bos", "superadmin"]), async (req: Request, res: Response) => {
    try {
      (globalThis as any).__assistantAuthUser = h.getAuthUser(req);
      const { session } = getSession(req);
      return res.json({ success: true, turns: session.turns });
    } catch {
      return res.json({ success: true, turns: [] });
    }
  });

  app.post("/api/ai-assistant/reset", h.requireAuth, h.requireRole(["admin", "administrator", "bos", "superadmin"]), async (req: Request, res: Response) => {
    try {
      (globalThis as any).__assistantAuthUser = h.getAuthUser(req);
      const { key } = getSession(req);
      assistantSessions.delete(key);
      return res.json({ success: true });
    } catch {
      return res.json({ success: true });
    }
  });
}

// Dipanggil server utama saat boot untuk menyuntikkan referensi data live
export function setAssistantDataStore(store: Record<string, any[]>) {
  (globalThis as any).__assistantStore = store;
}

// ---------------------------------------------------------------------------
// GEMINI AGENT FALLBACK — function calling native Gemini (@google/genai)
// Dipakai bila jalur custom agent loop gagal; membuat SETIAP jalur API key
// (custom maupun Gemini) mampu menjadi agent penuh.
// ---------------------------------------------------------------------------
const GEMINI_AGENT_MODELS = ["gemini-3.7-flash", "gemini-flash-latest", "gemini-3.1-flash-lite"];

function geminiToolDefs(tools: ToolDef[]) {
  return [{
    functionDeclarations: tools.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    })),
  }];
}

export async function runGeminiAgent(text: string, session: any, req: any, historyMode: boolean): Promise<{ reply: string; navigation: string[]; highlights: Array<{ route: string; element: string; label: string }> }> {
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) throw new Error("GEMINI_API_KEY kosong");
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });

  const tools = makeTools();
  const contents: any[] = [];
  for (const t of session.turns.slice(0, -1)) {
    contents.push({ role: t.role === "user" ? "user" : "model", parts: [{ text: t.content }] });
  }
  contents.push({ role: "user", parts: [{ text: historyMode ? foldHistory(session, text) : text }] });

  const navigation: string[] = [];
  const highlights: Array<{ route: string; element: string; label: string }> = [];

  for (const model of GEMINI_AGENT_MODELS) {
    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response: any = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: buildAssistantSystemPrompt(),
            tools: geminiToolDefs(tools),
            temperature: 0.6,
            maxOutputTokens: 2048,
          },
        });
        const cand = response?.candidates?.[0];
        const parts = cand?.content?.parts || [];
        const fnCalls = parts.filter((p: any) => p?.functionCall).map((p: any) => p.functionCall);

        if (!fnCalls.length) {
          const reply = String(response?.text || parts.map((p: any) => p?.text || "").join("") || "").trim();
          if (reply) return { reply, navigation, highlights };
          break;
        }
        contents.push({ role: "model", parts });
        const resultParts: any[] = [];
        for (const fc of fnCalls) {
          const def = tools.find((t) => t.name === fc?.name);
          let result: any;
          try {
            result = def ? def.exec(fc.args || {}, req) : { ok: false, error: "Tool tidak dikenal" };
          } catch (e: any) {
            result = { ok: false, error: e?.message || "Tool gagal" };
          }
          if (result && result.__navigate) {
            navigation.push(result.route);
            result = { ok: true, route: result.route, label: result.label, message: "Navigasi dikirim ke browser admin." };
          }
          if (result && result.__highlight) {
            highlights.push({ route: result.route, element: result.__highlight, label: result.__label || result.__highlight });
            result = { ok: true, route: result.route, element: result.__highlight, label: result.__label || result.__highlight, message: "Sorotan elemen dikirim ke browser admin." };
          }
          resultParts.push({ functionResponse: { name: fc.name, response: result } });
        }
        contents.push({ role: "user", parts: resultParts });
      }
    } catch (e: any) {
      console.warn(`[AIAssistant] Gemini agent ${model} gagal:`, e?.message);
      continue;
    }
  }
  throw new Error("Semua model Gemini agent gagal");
}
