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
    create_exam_btn: { sel: "button[onclick*='openExamModal']", desc: "Tombol Buat Jadwal Ujian CBT" },
  },
  jadwal: {
    add_event_btn: { sel: "button[onclick*='openEventModal'], button[onclick*='openScheduleEvent']", desc: "Tombol tambah event/kegiatan di Jadwal" },
    schedule_search: { sel: "input[placeholder*='cari jadwal' i]", desc: "Kolom pencarian jadwal" },
  },
  absen: {
    camera_box: { sel: "video, #attendance-camera", desc: "Area kamera absensi" },
    class_picker: { sel: "#attendance-class-select, select[onchange*='attendance']", desc: "Pilih kelas untuk absensi" },
  },
  bank_soal: {
    question_search: { sel: "input[placeholder*='cari soal' i]", desc: "Kolom pencarian soal" },
    add_question_btn: { sel: "button[onclick*='openQuestionModal'], button[onclick*='addQuestion']", desc: "Tombol tambah soal baru" },
  },
  nilai: {
    grades_table: { sel: "table, #grades-container, #evaluasi-container", desc: "Tabel/daftar nilai & evaluasi" },
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
// TOOL GURU (read-only, terkurung) — terpisah dari tool admin.
// Guru hanya boleh: data kelas/mapel yang DIA ampu, statistik ringkas
// kelasnya, jadwal, dan navigasi/tunjuk elemen. TANPA settings, TANPA data
// lintas kelas, TANPA tool tulis. Keputusan di server, bukan kata model.
// ---------------------------------------------------------------------------
function makeTeacherTools(teacherId: string, teacher: any): ToolDef[] {
  const g: any = globalThis as any;
  const homeroomId = String(teacher?.homeroom_class_id || "");
  const mySubject = String(teacher?.mapel || teacher?.subject || "");
  // Kelas yang diampu: wali kelas + kelas pada mapel yang diajar (mapping subjects.teacherId bila ada)
  const taughtClassIds = new Set<string>();
  if (homeroomId) taughtClassIds.add(String(homeroomId));
  for (const s of (g.__assistantStore?.subjects || [])) {
    if (String(s?.teacherId || "") === String(teacherId)) {
      if (s?.classId) taughtClassIds.add(String(s.classId));
      if (Array.isArray(s?.classIds)) s.classIds.forEach((c: any) => taughtClassIds.add(String(c)));
    }
  }

  const myStudents = () => scopedAll(g.__assistantStore?.students, null).filter((s: any) =>
    taughtClassIds.has(String(s.classId || s.kelas || ""))
  );
  const myExams = () => scopedAll(g.__assistantStore?.exams, null).filter((e: any) =>
    String(e?.teacherId || e?.createdBy || "") === String(teacherId) ||
    (mySubject && [e.subject, e.subjectName].some((v: any) => String(v || "").toLowerCase() === mySubject.toLowerCase()))
  );

  return [
    {
      name: "get_my_overview",
      description: "Ringkasan data SAYA sebagai guru: kelas yang diampu (wali kelas & mapel), jumlah siswa di kelas tersebut, mata pelajaran, ujian yang saya buat.",
      parameters: { type: "object", properties: {} },
      exec: () => {
        const classes = scopedAll(g.__assistantStore?.classes, null).filter((c: any) => taughtClassIds.has(String(c.id)));
        const students = myStudents();
        return {
          namaGuru: teacher?.name || "",
          mapel: mySubject,
          waliKelas: homeroomId || null,
          kelasDiampu: classes.map((c: any) => ({ nama: c.name || c.className, id: c.id })),
          jumlahSiswaDiKelas: students.length,
          jumlahUjianSaya: myExams().length,
        };
      },
    },
    {
      name: "search_my_students",
      description: "Cari siswa DI KELAS YANG SAYA AMPU saja berdasarkan nama/NIS. Maks 15 hasil. Tidak bisa mencari siswa di luar kelas ampuan.",
      parameters: { type: "object", properties: { query: { type: "string" } }, required: ["query"] },
      exec: (args: any) => {
        const q = String(args.query || "").toLowerCase();
        return myStudents()
          .filter((s: any) => [s.name, s.nis].some((v: any) => String(v || "").toLowerCase().includes(q)))
          .slice(0, 15)
          .map((s: any) => ({ nama: s.name, nis: s.nis, kelas: s.className || s.kelas || s.classId }));
      },
    },
    {
      name: "list_my_exams",
      description: "Daftar ujian yang SAYA buat (judul, kelas, status). Maks 15.",
      parameters: { type: "object", properties: {} },
      exec: () => myExams().slice(0, 15).map((e: any) => ({
        judul: e.title || e.name, kelas: e.className || e.classId || "", status: e.status || (e.isActive ? "aktif" : "nonaktif"), id: e.id,
      })),
    },
    {
      name: "navigate_to",
      description: "Antarkan guru langsung ke halaman tertentu. Panggil WAJIB sebelum menjawab bila diminta membuka/mencari halaman.",
      parameters: {
        type: "object",
        properties: {
          route: { type: "string", description: "Salah satu: dashboard, jadwal, asesmen, bank_soal, modul_ajar, kalender, nilai" },
          label: { type: "string" },
        },
        required: ["route"],
      },
      exec: (args: any) => {
        const TEACHER_ROUTES = ["dashboard", "jadwal", "asesmen", "bank_soal", "modul_ajar", "kalender", "nilai"];
        const route = String(args.route || "").trim().toLowerCase();
        if (!TEACHER_ROUTES.includes(route)) return { ok: false, error: `Halaman tidak tersedia untuk guru: ${route}` };
        return { ok: true, route, label: args.label || route, __navigate: route };
      },
    },
    {
      name: "highlight_element",
      description: "Tunjuk/sorot elemen UI (setelah navigate_to). Kunci tersedia: guru->teacher_search, bank_soal->question_search, modul_ajar->subject_search, asesmen->exam_list, dashboard->attendance_trend/agenda_banner/quick_actions.",
      parameters: {
        type: "object",
        properties: {
          route: { type: "string" },
          element: { type: "string" },
          label: { type: "string" },
        },
        required: ["route", "element"],
      },
      exec: (args: any) => {
        const ALLOWED: Record<string, string[]> = {
          guru: ["teacher_search"],
          bank_soal: ["question_search"],
          modul_ajar: ["subject_search"],
          asesmen: ["exam_list"],
          dashboard: ["attendance_trend", "agenda_banner", "quick_actions"],
        };
        const route = String(args.route || "").trim().toLowerCase();
        const element = String(args.element || "").trim();
        if (!ALLOWED[route] || !ALLOWED[route].includes(element)) {
          return { ok: false, error: "Elemen tidak tersedia untuk guru." };
        }
        return { ok: true, route, element, label: args.label || element, __navigate: route, __highlight: element, __label: args.label || element };
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// TOOLS
// ---------------------------------------------------------------------------
type ToolDef = { name: string; description: string; parameters: any; exec: (args: any, req: any) => any | Promise<any> };

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

// ---------------------------------------------------------------------------
// TOOL TULIS ADMIN — aksi mengubah data HANYA lewat konfirmasi dua langkah:
// 1) prepare_write_action membuat "rencana" + token (TTL 15 menit, sekali pakai)
// 2) admin klik Lanjutkan → /api/ai-assistant/confirm {token} → eksekusi nyata
// Guru TIDAK mendapat tool ini sama sekali (lihat makeTeacherTools).
// ---------------------------------------------------------------------------
interface PendingWriteAction {
  id: string;
  action: string;
  summary: string;
  args: any;
  userId: string;
  createdAt: number;
}
const pendingWrites = new Map<string, PendingWriteAction>();
const PENDING_TTL = 15 * 60 * 1000;

function newPendingId(): string {
  return "wact_" + Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

function makeWriteTools(): ToolDef[] {
  return [
    {
      name: "prepare_write_action",
      description:
        "WAJIB dipanggil setiap kali admin meminta MEMBUAT/MENGUBAH data. PANGGIL TOOL INI DULU sebelum menulis jawaban — JANGAN hanya mengklaim rencana siap tanpa memanggil tool. Aksi TIDAK langsung dijalankan: server membuat rencana + tombol konfirmasi muncul otomatis di chat. Aksi ringan tersedia: create_student {nama, nis, username, password, classId}; update_student {studentId, name?, nis?, classId?, no_hp?, password?} (ubah nama/NIS/kelas/HP/password siswa); update_teacher {teacherId, name?, mapel?, homeroom_class_id?, phone?, password?}; update_admin_settings {adminName?, schoolName?, newPassword?, runningText?} (ganti nama admin/madrasah, reset password admin, teks berjalan); set_grade {studentId, classId?, subjectName, category, score 0-100} (masukkan/ubah nilai); create_calendar_event {title, date YYYY-MM-DD, description?, type?}; update_calendar_event {eventId, title, date, description?}; set_schedule_entry {day (senin-jumat), classId, time (mis 07:30), subjectId, teacherId?} (ubah roster/jadwal); assign_homeroom {classId, teacherId}; create_exam {judul, classId?, subjectName?, tanggal?}; set_running_text {text}. SELALU cari ID dulu via tool cari (search_students, list_classes, search_teachers, list_subjects) — jangan menebak ID.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", description: "Salah satu: create_student | create_exam | set_running_text" },
          args: { type: "object", description: "Argumen aksi sesuai skema di deskripsi" },
        },
        required: ["action", "args"],
      },
      exec: (args: any, req: any) => {
        const authUser: any = (globalThis as any).__assistantAuthUser || {};
        const action = String(args.action || "");
        const a = args.args || {};
        const summaries: Record<string, (x: any) => string> = {
          create_student: (x) => `Tambah siswa baru "${x.name || x.nama || "(tanpa nama)"}" (NIS ${x.nis || "-"})${x.classId ? ` ke kelas ${x.classId}` : ""} dengan username ${x.username || "(otomatis)"}.`,
          create_exam: (x) => `Buat ujian "${x.judul || x.title}"${x.classId ? ` untuk kelas ${x.classId}` : ""}${x.subjectName ? ` mapel ${x.subjectName}` : ""}.`,
          set_running_text: (x) => `Ubah teks berjalan menjadi: "${String(x.text || "").slice(0, 80)}".`,
          update_student: (x) => `Perbarui data siswa (ID ${x.studentId}): ${Object.entries(x).filter(([k]) => !["studentId"].includes(k)).map(([k, v]) => `${k}=${String(v).slice(0, 30)}`).join(", ")}.`,
          update_teacher: (x) => `Perbarui data guru (ID ${x.teacherId}): ${Object.entries(x).filter(([k]) => !["teacherId"].includes(k)).map(([k, v]) => `${k}=${k.includes("password") ? "(rahasia)" : String(v).slice(0, 30)}`).join(", ")}.`,
          update_admin_settings: (x) => `Perbarui pengaturan: ${Object.entries(x).map(([k, v]) => `${k}=${k.includes("password") ? "(rahasia)" : String(v).slice(0, 40)}`).join(", ")}.`,
          set_grade: (x) => `Masukkan nilai ${x.subjectName}/${x.category} = ${x.score} untuk siswa ID ${x.studentId}.`,
          create_calendar_event: (x) => `Tambah acara kalender "${x.title}" pada ${x.date}${x.description ? ` — ${String(x.description).slice(0, 50)}` : ""}.`,
          update_calendar_event: (x) => `Perbarui acara kalender (ID ${x.eventId}): "${x.title}" pada ${x.date}.`,
          set_schedule_entry: (x) => `Set jadwal ${x.day} ${x.time} kelas ${x.classId} → mapel ID ${x.subjectId}${x.teacherId ? ` guru ID ${x.teacherId}` : ""}.`,
          assign_homeroom: (x) => `Tetapkan wali kelas ${x.classId} = guru ID ${x.teacherId || "(kosong)"}.`,
        };
        if (!summaries[action]) return { error: "Aksi tidak dikenal. Gunakan: create_student, create_exam, set_running_text." };
        const id = newPendingId();
        pendingWrites.set(id, { id, action, summary: summaries[action](a), args: a, userId: String(authUser?.id || ""), createdAt: Date.now() });
        // bersihkan kadaluarsa
        for (const [k, v] of pendingWrites) if (Date.now() - v.createdAt > PENDING_TTL) pendingWrites.delete(k);
        return {
          __pendingWrite: id,
          status: "menunggu_konfirmasi",
          summary: summaries[action](a),
          note: "JANGAN mengaku aksi sudah dilakukan. Katakan ke admin bahwa tombol konfirmasi muncul di chat dan aksi baru berjalan setelah disetujui.",
        };
      },
    },
  ];
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
      name: "list_subjects",
      description: "Daftar semua mata pelajaran (id, nama, guru pengampu). Gunakan untuk mendapat subjectId/teacherId sebelum mengubah jadwal.",
      parameters: { type: "object", properties: {} },
      exec: (_args: any, req: any) => {
        const subjects = scopedAll(g.__assistantStore?.subjects, req);
        const teachers = scopedAll(g.__assistantStore?.teachers, req);
        return subjects.map((s: any) => ({
          nama: s.name || s.subjectName,
          id: s.id,
          guru: (() => { const t = teachers.find((x: any) => String(x.id) === String(s.teacherId)); return t ? t.name : (s.teacherId || ""); })(),
        }));
      },
    },
    {
      name: "list_schedules",
      description: "Daftar jadwal/roster pelajaran (hari, jam, kelas, mapel, guru). Untuk melihat jadwal sebelum mengubahnya.",
      parameters: { type: "object", properties: { day: { type: "string", description: "Filter hari opsional: senin..sabtu" } } },
      exec: (args: any, req: any) => {
        const schedules = scopedAll(g.__assistantStore?.schedules, req);
        const subjects = scopedAll(g.__assistantStore?.subjects, req);
        const classes = scopedAll(g.__assistantStore?.classes, req);
        const teachers = scopedAll(g.__assistantStore?.teachers, req);
        const d = String(args?.day || "").toLowerCase();
        return schedules.filter((s: any) => !d || String(s.day || "").toLowerCase() === d).slice(0, 40).map((s: any) => {
          const subj = subjects.find((x: any) => String(x.id) === String(s.subjectId));
          const cls = classes.find((x: any) => String(x.id) === String(s.classId));
          const tch = teachers.find((x: any) => String(x.id) === String(s.teacherId));
          return { hari: s.day, jam: s.time, kelas: cls?.name || s.classId, mapel: subj?.name || s.subjectName, guru: tch?.name || s.teacherId || "" };
        });
      },
    },
    {
      name: "list_calendar_events",
      description: "Daftar acara kalender/agenda (judul, tanggal, deskripsi). Untuk melihat agenda sebelum mengubah/menambah.",
      parameters: { type: "object", properties: {} },
      exec: (_args: any, req: any) => {
        const events = scopedAll(g.__assistantStore?.calendarEvents, req);
        return events.slice(0, 30).map((e: any) => ({ id: e.id, judul: e.title, tanggal: e.date, deskripsi: e.description || "" }));
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
          route: { type: "string", description: "Salah satu: dashboard, siswa, guru, kelas, jadwal, absen, asesmen, bank_soal, modul_ajar, nilai (halaman Evaluasi/Nilai), jurnal, kalender, setting" },
          label: { type: "string", description: "Nama halaman yang ramah, mis. 'Data Siswa'" },
        },
        required: ["route"],
      },
      exec: (args: any, _req: any) => {
        const VALID = ["dashboard", "siswa", "guru", "kelas", "jadwal", "absen", "asesmen", "bank_soal", "modul_ajar", "nilai", "jurnal", "kalender", "setting"];
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
        const VALID = ["dashboard", "siswa", "guru", "kelas", "jadwal", "absen", "asesmen", "bank_soal", "modul_ajar", "nilai", "jurnal", "kalender", "setting"];
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
    {
      name: "fill_form",
      description: "Buka & ISI formulir di aplikasi lalu tampilkan untuk dikonfirmasi admin (tidak otomatis disimpan). Form tersedia: buat_ujian (jadwal CBT), tambah_siswa, tambah_guru. Gunakan saat admin minta 'buatkan jadwal ujian X', 'tambahkan siswa Y', dll. Setelah diisi, tombol Simpan tetap ditekan admin sendiri.",
      parameters: {
        type: "object",
        properties: {
          form: { type: "string", description: "buat_ujian | tambah_siswa | tambah_guru", enum: ["buat_ujian", "tambah_siswa", "tambah_guru"] },
          data: {
            type: "object",
            description: "Data field formulir. buat_ujian: title, subject, classAll (bool=semua kelas), classNames (array nama kelas), bankCode, questionCount, duration, minDuration, date (YYYY-MM-DD), startTime (HH:MM), endTime, type (pilihan_ganda|esay_saja|pilihan_dan_esay), essayCount, autoBlock (0|3|5), shuffleQ, shuffleOpt, showScore, allowDownload. tambah_siswa: name, nis, className, username, password. tambah_guru: name, nip, nuptk, gender (L|P), email, phone, address, username, password, mapels (array nama mapel).",
          },
        },
        required: ["form", "data"],
      },
      exec: (args: any, _req: any) => {
        const form = String(args.form || "").trim();
        const FORMS = ["buat_ujian", "tambah_siswa", "tambah_guru"];
        if (!FORMS.includes(form)) return { ok: false, error: `Form tidak dikenal: ${form}. Gunakan: ${FORMS.join(", ")}` };
        if (!args.data || typeof args.data !== "object") return { ok: false, error: "data wajib diisi" };
        const route = form === "buat_ujian" ? "asesmen" : form === "tambah_siswa" ? "siswa" : "guru";
        return { ok: true, form, data: args.data, route, __fillForm: { form, data: args.data }, __navigate: route, message: "Formulir dibuka dan terisi otomatis di layar admin. Menunggu admin menekan tombol Simpan." };
      },
    },
  ];
}


// ---------------------------------------------------------------------------
// MEDIA GENERATION HELPERS (REST ke Google Generative Language API).
// Semua kemampuan generatif media hanya lewat GEMINI_API_KEY. Bila tidak ada,
// tool mengembalikan pesan "provider tidak mendukung".
// ---------------------------------------------------------------------------
const NO_GEMINI_MSG = "Provider tidak mendukung. Generate media (gambar/suara/vision) membutuhkan profil AI Google Gemini (GEMINI_API_KEY belum diatur di server).";

function geminiApiKey(): string {
  return String(process.env.GEMINI_API_KEY || "").trim();
}

async function geminiREST(model: string, body: any, timeoutMs = 120000): Promise<any> {
  const key = geminiApiKey();
  if (!key) throw new Error(NO_GEMINI_MSG);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const data: any = await resp.json().catch(() => null);
  if (!resp.ok) {
    const msg = String(data?.error?.message || `Gemini ${resp.status}`);
    if (resp.status === 429) throw new Error("Kuota/rate limit Gemini tercapai. Coba lagi nanti.");
    throw new Error(msg);
  }
  return data;
}

function firstInlineData(data: any): { mime: string; data: string } | null {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const p of parts) {
    if (p?.inlineData?.data) return { mime: String(p.inlineData.mimeType || "application/octet-stream"), data: String(p.inlineData.data) };
  }
  return null;
}

function firstText(data: any): string {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const p of parts) if (typeof p?.text === "string" && p.text.trim()) return p.text.trim();
  return "";
}

function pcmToWavBase64(pcmB64: string, sampleRate = 24000, channels = 1, bits = 16): string {
  const pcm = Buffer.from(pcmB64, "base64");
  const byteRate = sampleRate * channels * bits / 8;
  const blockAlign = channels * bits / 8;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVE", 8);
  header.write("fmt ", 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22); header.writeUInt32LE(sampleRate, 24); header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32); header.writeUInt16LE(bits, 34); header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]).toString("base64");
}

async function uploadCloudinary(b64: string, mime: string, resourceType: "image" | "video" | "raw"): Promise<string | null> {
  try {
    const cld = (require("cloudinary") as any)?.v2;
    if (!cld || !process.env.CLOUDINARY_URL) return null;
    const dataUri = `data:${mime};base64,${b64}`;
    const result = await new Promise<any>((resolve, reject) => {
      cld.uploader.upload(dataUri, { resource_type: resourceType }, (err: any, res: any) => err ? reject(err) : resolve(res));
    });
    return result?.secure_url || null;
  } catch (e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// TOOLS GENERATE KONTEN (admin) - gambar, suara, dokumen, analisis gambar.
// ---------------------------------------------------------------------------
function makeMediaTools(): ToolDef[] {
  return [
    {
      name: "generate_document",
      description: "Buat dokumen teks (modul ajar, RPP, silabus, kisi-kisi, naskah soal, ringkasan materi, surat/pengumuman, atau dokumen bebas) lalu siapkan file .doc yang bisa diunduh admin dari chat. Pakai saat admin minta 'buatkan/bikin dokumen X'.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Judul dokumen" },
          content_brief: { type: "string", description: "Jenis+isi dokumen: modul_ajar|rpp|silabus|kisi_kisi|naskah_soal|ringkasan|surat|bebas + topik + detail (kelas, mapel, jumlah soal, dsb)" },
        },
        required: ["title", "content_brief"],
      },
      exec: async (args: any) => {
        const title = String(args.title || "Dokumen").trim();
        const brief = String(args.content_brief || "").trim();
        if (!brief) return { ok: false, error: "Brief dokumen kosong." };
        const prompt = `Buat dokumen berikut dalam Bahasa Indonesia dengan format HTML sederhana (tag h1-h3, p, ul/ol, table bila perlu - TANPA style/css/javascript). Jangan menambahkan penjelasan di luar HTML.\nJudul: ${title}\nKebutuhan: ${brief}`;
        try {
          const g: any = globalThis as any;
          const runtime = g.__aiProviderRuntime || {};
          const baseUrl = String(runtime.customBaseUrl || process.env.CUSTOM_AI_BASE_URL || "https://token.lightvela.ai/v1").replace(/\/$/, "");
          const apiKey = runtime.customApiKey || process.env.CUSTOM_AI_API_KEY || "";
          const model = runtime.customModel || process.env.CUSTOM_AI_MODEL || "auto";
          let html = "";
          if (apiKey && baseUrl) {
            const resp = await fetch(`${baseUrl}/chat/completions`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0.6, max_tokens: 8000 }),
              signal: AbortSignal.timeout(180000),
            });
            if (!resp.ok) throw new Error(`Provider ${resp.status}`);
            const data: any = await resp.json();
            html = String(data?.choices?.[0]?.message?.content || "").trim();
            html = html.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/, "").trim();
          } else if (geminiApiKey()) {
            const data = await geminiREST("gemini-2.5-flash", { contents: [{ role: "user", parts: [{ text: prompt }] }] }, 180000);
            html = firstText(data);
          } else {
            return { ok: false, error: "Provider tidak mendukung: tidak ada profil AI aktif maupun GEMINI_API_KEY." };
          }
          if (!html) return { ok: false, error: "AI memberikan hasil kosong." };
          const docHtml = `<html xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${title.replace(/[<>&"]/g, "")}</title></head><body style="font-family:'Times New Roman',serif;font-size:12pt;line-height:1.5">${html}</body></html>`;
          const token = require("crypto").randomBytes(16).toString("hex");
          const g2: any = globalThis as any;
          if (!g2.__assistantDocs) g2.__assistantDocs = new Map();
          g2.__assistantDocs.set(token, { title, html: docHtml, createdAt: Date.now() });
          const t = setTimeout(() => g2.__assistantDocs?.delete(token), 1000 * 60 * 60); t.unref?.();
          const safeName = title.replace(/[^a-zA-Z0-9\s-]/g, "").trim().replace(/\s+/g, "_") || "dokumen";
          return { ok: true, __asset: [{ type: "download", url: `/api/ai-assistant/document/${token}`, name: `${safeName}.doc`, mime: "application/msword" }], message: `Dokumen "${title}" selesai dibuat. Tombol unduh muncul di chat.` };
        } catch (e: any) {
          return { ok: false, error: e?.message || "Gagal membuat dokumen." };
        }
      },
    },
    {
      name: "generate_image",
      description: "Generate gambar/ilustrasi (mis. ilustrasi materi, poster, gambar untuk soal). Pakai saat admin minta 'buatkan gambar X'.",
      parameters: {
        type: "object",
        properties: { prompt: { type: "string", description: "Deskripsi gambar yang diinginkan (detail, gaya)" } },
        required: ["prompt"],
      },
      exec: async (args: any) => {
        const prompt = String(args.prompt || "").trim();
        if (!prompt) return { ok: false, error: "Deskripsi gambar kosong." };
        if (!geminiApiKey()) return { ok: false, error: NO_GEMINI_MSG };
        try {
          const data = await geminiREST("gemini-2.5-flash-image", {
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["IMAGE"] },
          }, 180000);
          const img = firstInlineData(data);
          if (!img) return { ok: false, error: "Gemini tidak menghasilkan gambar (mungkin permintaan ditolak). Coba deskripsi lain." };
          let url = await uploadCloudinary(img.data, img.mime, "image");
          if (!url) url = `data:${img.mime};base64,${img.data}`;
          return { ok: true, __asset: [{ type: "image", url, mime: img.mime }], message: "Gambar selesai dibuat, ditampilkan di chat." };
        } catch (e: any) {
          return { ok: false, error: e?.message || "Gagal membuat gambar." };
        }
      },
    },
    {
      name: "generate_speech",
      description: "Ubah teks menjadi suara (text-to-speech, audio). Pakai saat admin minta 'bacakan/buatkan suara/audio X'.",
      parameters: {
        type: "object",
        properties: {
          text: { type: "string", description: "Teks yang dibacakan" },
          style: { type: "string", description: "Gaya suara opsional, mis: ceria, tenang, tegas, narasi pelan" },
        },
        required: ["text"],
      },
      exec: async (args: any) => {
        const text = String(args.text || "").trim();
        if (!text) return { ok: false, error: "Teks kosong." };
        if (text.length > 3000) return { ok: false, error: "Teks terlalu panjang (maks 3000 karakter)." };
        if (!geminiApiKey()) return { ok: false, error: NO_GEMINI_MSG };
        try {
          const style = String(args.style || "").trim();
          const spoken = style ? `Bacakan dengan gaya ${style}: ${text}` : text;
          const data = await geminiREST("gemini-2.5-flash-preview-tts", {
            contents: [{ role: "user", parts: [{ text: spoken }] }],
            generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } } } },
          }, 180000);
          const audio = firstInlineData(data);
          const mime = String(audio?.mime || "");
          if (!audio || (!(mime.includes("audio") && !mime.includes("wav")) && !mime.includes("pcm") && !mime.includes("wav"))) return { ok: false, error: "Gemini tidak menghasilkan audio." };
          const wavB64 = mime.includes("wav") ? audio.data : pcmToWavBase64(audio.data);
          let url = await uploadCloudinary(wavB64, "audio/wav", "video");
          if (!url) url = `data:audio/wav;base64,${wavB64}`;
          return { ok: true, __asset: [{ type: "audio", url, mime: "audio/wav" }], message: "Audio siap, diputar di chat." };
        } catch (e: any) {
          return { ok: false, error: e?.message || "Gagal membuat audio." };
        }
      },
    },
    {
      name: "analyze_image",
      description: "Menganalisis gambar yang dilampirkan admin di chat (OCR naskah/soal, baca tabel nilai, jelaskan isi gambar).",
      parameters: {
        type: "object",
        properties: { question: { type: "string", description: "Pertanyaan/tugas terhadap gambar" } },
        required: ["question"],
      },
      exec: async (args: any, req: any) => {
        const g: any = globalThis as any;
        const pendingImg = g.__assistantPendingImage;
        if (!pendingImg?.data) return { ok: false, error: "Tidak ada gambar terlampir di pesan ini." };
        if (!geminiApiKey()) return { ok: false, error: NO_GEMINI_MSG };
        const question = String(args.question || "Jelaskan isi gambar ini.").trim();
        try {
          const data = await geminiREST("gemini-2.5-flash", {
            contents: [{ role: "user", parts: [{ text: question }, { inlineData: { mimeType: pendingImg.mime, data: pendingImg.data } }] }],
          }, 120000);
          const out = firstText(data);
          if (!out) return { ok: false, error: "Gemini tidak memberikan hasil." };
          g.__assistantPendingImage = null;
          return { ok: true, text: out };
        } catch (e: any) {
          return { ok: false, error: e?.message || "Gagal menganalisis gambar." };
        }
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
- Kamu punya kemampuan GENERATE KONTEN lewat tools:
  * generate_document: buat dokumen (modul ajar, RPP, silabus, kisi-kisi, naskah soal, ringkasan, surat, dokumen bebas) - file unduhan muncul otomatis di chat.
  * generate_image: buat gambar/ilustrasi.
  * generate_speech: ubah teks jadi audio (bacakan teks).
  * analyze_image: analisis gambar yang dilampirkan admin (OCR, baca tabel, jelaskan isi).
- Bila tool media mengembalikan error "Provider tidak mendukung", sampaikan apa adanya dengan sopan: kemampuan itu butuh Gemini (GEMINI_API_KEY) dan sarankan admin mengaturnya di server, TANPA menyebut nama tool secara teknis.
- Kamu bisa MEMANGGIL navigate_to untuk MENGANTAR admin langsung ke halaman tertentu — gunakan saat admin bertanya "di mana", "buka", "tunjukkan", atau setelah menjelaskan cara pakai sebuah fitur agar admin langsung diantar ke sana. Dalam jawaban, sebutkan secara natural bahwa kamu sudah mengantarkan/membuka halamannya.
- Peta halaman yang BENAR (pakai ini, jangan mengarang): dashboard, siswa (Data Murid), guru (Data Guru), kelas, jadwal (Jadwal & Mapel), absen (Absensi), asesmen (Asesmen/ujian CBT), bank_soal, modul_ajar, nilai (halaman Evaluasi/Nilai - sebut saja "Evaluasi" ke admin), jurnal, kalender, setting (Pengaturan). Alias: "mapel" -> jadwal; "evaluasi"/"hasil ujian" -> nilai; "perizinan" -> setting.
- JANGAN PERNAH mengatakan halaman sudah terbuka kalau kamu tidak memanggil navigate_to (atau tool gagal). Kalau tool gagal/route ditolak, akui dan sarankan membuka manual dari menu samping.

PENGETAHUANMU TENTANG APLIKASI:
- Aplikasi CBT + manajemen madrasah: data siswa/guru/kelas/mapel, ujian CBT (pilihan ganda & esay) dengan monitoring real-time & mode fokus, koreksi otomatis AI, modul ajar (17 komponen) + kisi-kisi/naskah soal, RPP/silabus/ATP/KKTP/Prota/Prosem/LKPD, evaluasi & unduh lembar jawaban, Perizinan Guru (AI & Drive), chat antar pengguna, kalender, gamifikasi, buku sumber (OCR), pengaturan profil AI & lisensi offline.
- AI di aplikasi memakai API key yang diaktifkan di Pengaturan (profil AI aktif) — kamu sendiri berjalan di atasnya.
- Identitas mesin: JANGAN PERNAH mengklaim brand/model tertentu (Gemini, GPT, Claude, DeepSeek, dll). Kalau ditanya pakai model apa, jawab netral: kamu adalah 'Asisten Madrasah' yang berjalan di atas profil AI yang diaktifkan admin di Pengaturan; model persisnya ada di daftar AI tersimpan (baris berstatus AKTIF). Jangan menebak.
- Mode online (Cloud SQL) dan mode offline (VPS lokal) keduanya didukung.

ATURAN JAWABAN:
- Selalu Bahasa Indonesia, ramah, terstruktur (poin/strip, TANPA markdown ** atau #).
- Pertanyaan data ("berapa siswa", "siapa guru X", "kelas mana paling ramai") → panggil tool dulu.
- Pertanyaan umum non-aplikasi → jawab seperti asisten AI biasa tanpa tool.
- Jangan menyebut nama tool secara teknis; sebutkan natural ("saya cek dulu datanya…", "sudah saya antarkan ke halamannya…").
- Kamu bisa MENGISI FORMULIR lewat tool fill_form (form tersedia: buat_ujian, tambah_siswa, tambah_guru). Formulir akan terbuka dan terisi otomatis di layar admin, LALU admin menekan tombol Simpan sendiri. Untuk "buatkan jadwal ujian X" gunakan fill_form buat_ujian (bukan persiapan aksi tulis).
- PERMINTAAN TULIS lain (tambah siswa via konfirmasi, ubah teks berjalan, dll): WAJIB memanggil tool persiapan aksi DULU — dilarang keras menulis "rencana sudah siap, tekan tombol konfirmasi" tanpa memanggil tool itu. Setelah tool dipanggil, katakan bahwa tombol konfirmasi sudah muncul di chat.`;
}

// ---------------------------------------------------------------------------
// SYSTEM PROMPT GURU — sama semangatnya dengan admin tapi batasan jelas.
// ---------------------------------------------------------------------------
function buildTeacherSystemPrompt(teacher: any): string {
  return `Kamu adalah "Asisten Guru" — asisten AI AGENT resmi di aplikasi CBT "Madrasah Digital", melayani guru bernama ${(teacher?.name || "Bapak/Ibu Guru")} (mapel: ${teacher?.mapel || "-"}${teacher?.homeroom_class_id ? ", wali kelas: " + teacher.homeroom_class_id : ""}).

KEMAMPUANMU (terbatas & aman):
- Melihat ringkasan data milik guru sendiri (kelas ampuan, siswa di kelas itu, ujian yang guru buat) via tool.
- Mengantar guru ke halaman: dashboard, jadwal, asesmen, bank_soal, modul_ajar, kalender, nilai (Evaluasi/Nilai).
- Menunjuk/sorot elemen UI di halaman-halaman tersebut.
- Menjelaskan cara memakai fitur aplikasi + menjawab pertanyaan umum seperti asisten AI biasa.

BATASAN MUTLAK (jangan pernah dilanggar):
- Kamu TIDAK bisa melihat/mengubah data di luar kelas ampuan guru (siswa kelas lain, data guru lain, pengaturan/aplikasi, akun, lisensi, API key).
- Kamu TIDAK bisa menulis/mengubah/menghapus apa pun — hanya membaca & menunjuk. Jika diminta mengubah data, jelaskan langkah manualnya di aplikasi.
- Jika guru meminta hal di luar kemampuanmu, tolak dengan sopan dan arahkan ke admin madrasah.

ATURAN JAWABAN:
- Selalu Bahasa Indonesia, ramah, terstruktur (poin/strip, TANPA ** atau #).
- Pertanyaan tentang data → panggil tool dulu, jangan mengarang angka.
- Permintaan "buka/cari halaman X" → panggil navigate_to dulu; "tunjukkan kolom X" → panggil highlight_element.
- Jangan sebut nama tool secara teknis; sebutkan natural ("saya cek dulu ya…", "sudah saya antarkan…").`;
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
  { re: /(evaluasi|hasil ujian|penilaian hasil|nilai)/i, route: "nilai" },
  { re: /(data siswa|halaman siswa|buka siswa|ke siswa|daftar siswa)/i, route: "siswa" },
  { re: /(data guru|halaman guru|buka guru|ke guru|daftar guru)/i, route: "guru" },
  { re: /(data kelas|halaman kelas|buka kelas|ke kelas|daftar kelas)/i, route: "kelas" },
  { re: /(mata pelajaran|\bmapel\b)/i, route: "jadwal" },
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


// ---------------------------------------------------------------------------
// RECONCILE PENDING WRITE: model kadang MENYATAKAN "tombol konfirmasi muncul"
// tanpa memanggil prepare_write_action (pitfall model 'auto'). Bila reply
// mengklaim konfirmasi tapi tidak ada rencana, buat rencana deterministik
// dari teks user (urutan: set_running_text > create_student > create_exam).
// ---------------------------------------------------------------------------
const WRITE_CLAIM_RE = /(tombol konfirmasi|menunggu konfirmasi|tekan (tombol )?(untuk )?konfirmasi)/i;

function buildDeterministicPendingWrite(userText: string, req: any): { id: string; summary: string } | null {
  const g: any = globalThis as any;
  const authUser: any = g.__assistantAuthUser || {};
  const uid = String(authUser?.id || "");
  let action = ""; let args: any = null; let summary = "";
  const rt = userText.match(/(?:ubah(?:kan)?|ganti)\s+(?:teks\s+berjalan\s+(?:menjadi|jadi|ke)\s+|running\s*text\s*(?:menjadi|jadi)?\s*)(["“']?)(.+?)\1?\s*(?:[.,]|$)/i);
  if (rt && rt[2]) {
    action = "set_running_text"; args = { text: rt[2].trim() };
    summary = `Ubah teks berjalan menjadi: "${rt[2].trim().slice(0, 80)}".`;
  } else {
    const cs = userText.match(/(?:tambah(?:kan)?|buat)\s+(?:siswa|data siswa)\s*(?:baru)?\s*(?:nama)?\s*([^,.;\n]+?)(?:\s+(?:dengan\s+)?(?:NIS|nis)\s*([A-Za-z0-9_-]+))?(?:[,\s]+username\s*([A-Za-z0-9_.-]+))?(?:[,\s]+password\s*([^,;\s]+))?(?:[,\s]+(?:kelas|di kelas|ke kelas)\s*([A-Za-z0-9_-]+))?/i);
    if (cs && cs[1]) {
      const nama = cs[1].trim(); const nis = cs[2] || String(Date.now()).slice(-6);
      const username = cs[3] || ("siswa" + Date.now().toString().slice(-6));
      const password = cs[4] || "siswa12345"; const classId = cs[5] || "";
      action = "create_student"; args = { nama, nis, username, password, classId };
      summary = `Tambah siswa baru "${nama}" (NIS ${nis})${classId ? ` ke kelas ${classId}` : ""} dengan username ${username}.`;
    } else {
      const ce = userText.match(/(?:buat|tambah(?:kan)?)\s+(?:ujian|exam)\s*(?:baru)?\s*(?:judul|berjudul|nama)?\s*["“']?([^,"“'\n]+?)["”']?\s*(?:,|untuk|kelas|mapel|$)/i);
      if (ce && ce[1]) {
        action = "create_exam"; args = { judul: ce[1].trim() };
        summary = `Buat ujian "${ce[1].trim().slice(0, 60)}".`;
      }
    }
  }
  if (!action) return null;
  const id = newPendingId();
  pendingWrites.set(id, { id, action, summary, args, userId: uid, createdAt: Date.now() });
  return { id, summary };
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

async function runAgent(text: string, session: any, req: any, h: AssistantHelpers, opts?: { mode?: "admin" | "teacher"; teacher?: any }) {
  const mode = opts?.mode || "admin";
  const tools = mode === "teacher" ? makeTeacherTools(String(opts?.teacher?.id || ""), opts?.teacher) : [...makeTools(), ...makeWriteTools(), ...makeMediaTools()];
  const sysPrompt = mode === "teacher" ? buildTeacherSystemPrompt(opts?.teacher) : buildAssistantSystemPrompt();
  const g: any = globalThis as any;
  const runtime = g.__aiProviderRuntime || {};
  const baseUrl = String(runtime.customBaseUrl || process.env.CUSTOM_AI_BASE_URL || "https://token.lightvela.ai/v1").replace(/\/$/, "");
  const apiKey = runtime.customApiKey || process.env.CUSTOM_AI_API_KEY || "";
  const model = runtime.customModel || process.env.CUSTOM_AI_MODEL || "auto";

  const messages: any[] = [{ role: "system", content: sysPrompt }];
  for (const t of session.turns.slice(0, -1)) {
    messages.push({ role: t.role === "user" ? "user" : "assistant", content: t.content });
  }
  messages.push({ role: "user", content: text });

  const navigation: string[] = [];
  const highlights: Array<{ route: string; element: string; label: string }> = [];
  const pendingWritesOut: Array<{ id: string; summary: string }> = [];
  const assets: Array<{ type: string; url: string; name?: string; mime?: string }> = [];
  const fillForms: Array<{ form: string; data: any }> = [];

  const processToolResult = (result: any) => {
    if (result && result.__navigate) {
      navigation.push(result.route);
    }
    if (result && result.__pendingWrite) {
      pendingWritesOut.push({ id: result.__pendingWrite, summary: result.__summary || result.summary || "Aksi tulis" });
    }
    if (result && result.__highlight) {
      highlights.push({ route: result.route, element: result.__highlight, label: result.__label || result.__highlight });
    }
    if (result && Array.isArray(result.__asset)) {
      for (const a of result.__asset) assets.push(a);
    }
    if (result && result.__fillForm) {
      fillForms.push({ form: result.__fillForm.form, data: result.__fillForm.data });
    }
    if (result && (result.__navigate || result.__highlight)) {
      const { __navigate, __highlight, __label, __pendingWrite, __summary, __asset, ...rest } = result;
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
          signal: AbortSignal.timeout(120000),
        });
        if (!resp.ok) throw new Error(`Provider ${resp.status}`);
        const data: any = await resp.json();
        const msg = data?.choices?.[0]?.message;
        if (!msg) throw new Error("Respons provider tidak dikenal");

        const toolCalls = msg.tool_calls || [];
        if (toolCalls.length) console.log("[AIAssistant] tool calls ronde", round + 1, ":", toolCalls.map((t: any) => t?.function?.name).join(","));
        if (!toolCalls.length) {
          const reply = String(msg.content || "").trim();
          if (reply) return { reply, navigation, highlights, assets: assets.length ? assets : undefined, fillForms: fillForms.length ? fillForms : undefined, pendingWrites: pendingWritesOut.length ? pendingWritesOut : (WRITE_CLAIM_RE.test(reply) ? [buildDeterministicPendingWrite(text, req)].filter(Boolean) as any : pendingWritesOut) };
          break;
        }
        messages.push(msg);
        for (const tc of toolCalls) {
          const def = tools.find((t) => t.name === tc?.function?.name);
          let result: any;
          try {
            const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments || "{}") : (tc.function.arguments || {});
            result = def ? await def.exec(args, req) : { ok: false, error: "Tool tidak dikenal" };
          } catch (e: any) {
            result = { ok: false, error: e?.message || "Tool gagal" };
          }
          if (result && result.__navigate) {
            navigation.push(result.route);
            result = { ok: true, route: result.route, label: result.label, message: "Navigasi dikirim ke browser admin." };
          }
          if (result && result.__pendingWrite) {
            console.log("[AIAssistant] pendingWrite dibuat:", result.__pendingWrite, "->", pendingWritesOut.length + 1);
            pendingWritesOut.push({ id: result.__pendingWrite, summary: result.__summary || result.summary || "Aksi tulis" });
            result = { ok: true, status: "menunggu_konfirmasi", summary: result.__summary || result.summary, message: "Rencana dibuat. Menunggu admin menekan tombol konfirmasi di chat." };
          }
          if (result && result.__highlight) {
            result = { ok: true, route: result.route, element: result.__highlight, label: result.__label || result.__highlight, message: "Sorotan elemen dikirim ke browser admin." };
          }
          if (result && result.__fillForm) {
            result = { ok: true, form: result.__fillForm.form, status: "form_terisi_menunggu_simpan", message: "Formulir dibuka & terisi di layar. Admin perlu menekan tombol Simpan." };
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
      const gem = await runGeminiAgent(text, session, req, true, { sysPrompt, tools });
      if (gem.reply) return gem;
    } catch (e: any) {
      console.warn("[AIAssistant] Gemini agent fallback gagal:", e?.message);
    }
  }

  // Fallback level 2 (terakhir): callAI teks biasa tanpa tool
  const response = await h.callAI(null, {
    contents: foldHistory(session, text),
    config: { systemInstruction: sysPrompt, generationConfig: { temperature: 0.6, maxOutputTokens: 2048 } },
  });
  const reply = String(response?.text || "").trim();
  if (!reply) throw new Error("AI memberikan respons kosong.");
  return { reply, navigation, highlights: highlights || [] };
}

// ---------------------------------------------------------------------------
// ENDPOINTS
// ---------------------------------------------------------------------------
export function registerAiAssistantEndpoints(app: Express, h: AssistantHelpers) {
  // Rate limit per pengguna (agent boros token): maks 30 chat / 10 menit
  const assistantRate = new Map<string, number[]>();
  function rateLimited(key: string): boolean {
    const now = Date.now();
    const arr = (assistantRate.get(key) || []).filter((t) => now - t < 10 * 60 * 1000);
    if (arr.length >= 30) { assistantRate.set(key, arr); return true; }
    arr.push(now);
    assistantRate.set(key, arr);
    return false;
  }

  // Data guru untuk mode teacher (dari store yang di-inject server)
  function findTeacher(userId: string): any {
    const g: any = globalThis as any;
    const teachers = g.__assistantStore?.teachers || [];
    return teachers.find((t: any) => String(t.id || "") === String(userId) || String(t.username || "") === String((g.__assistantAuthUser || {}).username || ""));
  }

  // Endpoint khusus guru — tool terkurung read-only, hanya guru BERIZIN via
  // Perizinan (mode 'allowed' pakai AI bersama ATAU 'own' dengan key terpasang).
  app.post("/api/ai-assistant/teacher/chat", h.requireAuth, h.requireRole(["teacher", "guru"]), async (req: Request, res: Response) => {
    try {
      const { message, image } = (req.body || {}) as { message?: string; image?: { mime?: string; data?: string } };
      const text = String(message || "").trim();
      if (!text && !(image && image.data)) return res.status(400).json({ success: false, message: "Pesan tidak boleh kosong." });

      const authUser: any = h.getAuthUser(req);
      const userId = String(authUser?.id || "");
      // Izin diputuskan SERVER via aiAccessForUser (server.ts context) — tidak percaya klien.
      const g: any = globalThis as any;
      const mode: string = typeof (g as any).__assistantAiAccessFor === "function" ? (g as any).__assistantAiAccessFor(userId, "ai") : "admin";
      if (mode === "admin") {
        return res.status(403).json({ success: false, code: "AI_NOT_ALLOWED", message: "Asisten AI belum diizinkan untuk Anda. Hubungi admin madrasah (Perizinan Guru)." });
      }
      const teacher = findTeacher(userId);
      if (!teacher) return res.status(404).json({ success: false, message: "Data guru tidak ditemukan." });

      if (rateLimited("t:" + userId)) {
        return res.status(429).json({ success: false, message: "Terlalu banyak pertanyaan. Coba lagi beberapa menit lagi." });
      }

      (globalThis as any).__assistantAuthUser = authUser;
      const { session } = getSession(req);
      const imgDataT = String(image?.data || "").replace(/^data:[^,]+,/, "");
      (globalThis as any).__assistantPendingImage = imgDataT ? { mime: String(image?.mime || "image/jpeg"), data: imgDataT } : null;
      const effectiveText = text || "Analisis gambar yang saya lampirkan.";
      pushTurn(session, "user", effectiveText);

      const { reply, navigation: agentNav, highlights: agentHl, assets: agentAssets } = await runAgent(effectiveText, session, req, h, { mode: "teacher", teacher });
      const navigation = agentNav;
      const highlights = agentHl && agentHl.length ? agentHl : [];
      pushTurn(session, "assistant", reply);

      return res.json({ success: true, reply, navigation, highlights, assets: (agentAssets && agentAssets.length) ? agentAssets : undefined, mode, turns: session.turns.length });
    } catch (err: any) {
      console.error("[AIAssistant] teacher chat gagal:", err?.message || err);
      return res.status(500).json({ success: false, message: err?.message || "Asisten AI gagal merespons." });
    }
  });

  app.get("/api/ai-assistant/teacher/history", h.requireAuth, h.requireRole(["teacher", "guru"]), async (req: Request, res: Response) => {
    try {
      const authUser: any = h.getAuthUser(req);
      const g: any = globalThis as any;
      const mode: string = typeof (g as any).__assistantAiAccessFor === "function" ? (g as any).__assistantAiAccessFor(String(authUser?.id || ""), "ai") : "admin";
      (globalThis as any).__assistantAuthUser = authUser;
      const { session } = getSession(req);
      return res.json({ success: true, allowed: mode !== "admin", mode, turns: session.turns });
    } catch {
      return res.json({ success: true, allowed: false, mode: "admin", turns: [] });
    }
  });

  app.post("/api/ai-assistant/chat", h.requireAuth, h.requireRole(["admin", "administrator", "bos", "superadmin"]), async (req: Request, res: Response) => {
    try {
      const { message, image } = (req.body || {}) as { message?: string; image?: { mime?: string; data?: string } };
      const text = String(message || "").trim();
      if (!text && !(image && image.data)) return res.status(400).json({ success: false, message: "Pesan tidak boleh kosong." });

      (globalThis as any).__assistantAuthUser = h.getAuthUser(req);
      const { session } = getSession(req);
      const imgMime = String(image?.mime || "image/jpeg");
      const imgData = String(image?.data || "").replace(/^data:[^,]+,/, "");
      (globalThis as any).__assistantPendingImage = imgData ? { mime: imgMime, data: imgData } : null;
      const effectiveText = text || "Analisis gambar yang saya lampirkan.";
      pushTurn(session, "user", effectiveText);

      const { reply, navigation: agentNav, highlights: agentHl, assets: agentAssets, fillForms: agentFillForms, pendingWrites: pendingW } = await runAgent(effectiveText, session, req, h);
      // Jaminan navigasi nyata: bila model mengklaim mengantar tanpa tool call,
      // ekstrak tujuan dari teks admin secara deterministik.
      const navigation = reconcileNavigation(reply, text, agentNav);
      // Jaminan sorotan nyata: intent eksplisit "tunjukkan kolom X" dijamin tereksekusi.
      const highlights = agentHl && agentHl.length ? agentHl : detectHighlightIntent(text);
      // Bila highlight diberikan tapi halamannya belum dinavigasi, pastikan pindah dulu.
      const navSet = new Set(navigation);
      for (const hl of highlights) { if (!navSet.has(hl.route)) navigation.unshift(hl.route); }
      pushTurn(session, "assistant", reply);

      const assets = (agentAssets && agentAssets.length) ? agentAssets : undefined;
      const fillFormsOut = (agentFillForms && agentFillForms.length) ? agentFillForms : undefined;
      return res.json({ success: true, reply, navigation, highlights, assets, fillForms: fillFormsOut, pendingWrites: pendingW || [], turns: session.turns.length });
    } catch (err: any) {
      console.error("[AIAssistant] chat gagal:", err?.message || err);
      return res.status(500).json({ success: false, message: err?.message || "Asisten AI gagal merespons." });
    }
  });

  // Unduhan dokumen hasil generate_document (token sekali pakai-ish, TTL 1 jam).
  app.get("/api/ai-assistant/document/:token", h.requireAuth, h.requireRole(["admin", "administrator", "bos", "superadmin"]), async (req: Request, res: Response) => {
    try {
      const token = String(req.params.token || "");
      const g: any = globalThis as any;
      const doc = g.__assistantDocs?.get(token);
      if (!doc) return res.status(404).json({ success: false, message: "Dokumen tidak ditemukan / sudah kadaluarsa." });
      res.setHeader("Content-Type", "application/msword");
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(doc.title)}.doc"`);
      return res.send(doc.html);
    } catch {
      return res.status(500).json({ success: false, message: "Gagal mengunduh dokumen." });
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

  // KONFIRMASI AKSI TULIS (admin) — eksekusi rencana yang dibuat agent.
  // Token sekali pakai, TTL 15 menit, terikat userId pembuatnya.
  app.post("/api/ai-assistant/confirm", h.requireAuth, h.requireRole(["admin", "administrator", "bos", "superadmin"]), async (req: Request, res: Response) => {
    try {
      const { token, cancel } = (req.body || {}) as { token?: string; cancel?: boolean };
      const authUser: any = h.getAuthUser(req);
      const uid = String(authUser?.id || "");
      const pending = token ? pendingWrites.get(String(token)) : undefined;
      if (!pending) return res.status(404).json({ success: false, message: "Rencana tidak ditemukan / sudah kadaluarsa. Minta agent membuat ulang." });
      if (pending.userId !== uid) return res.status(403).json({ success: false, message: "Rencana ini bukan dibuat dari sesi Anda." });
      pendingWrites.delete(String(token)); // sekali pakai
      if (cancel) {
        return res.json({ success: true, cancelled: true, message: "Aksi dibatalkan." });
      }
      const g: any = globalThis as any;
      if (typeof g.__assistantWriteAction !== "function") return res.status(500).json({ success: false, message: "Executor aksi tulis tidak tersedia." });
      const result = await g.__assistantWriteAction(pending.action, pending.args, req);
      try {
        (g as any).__assistantAudit?.(uid, "assistant_write", { action: pending.action, summary: pending.summary, result: { ok: result?.ok, message: result?.message } });
      } catch {}
      return res.json({ success: true, executed: result?.ok !== false, action: pending.action, ...result });
    } catch (err: any) {
      console.error("[AIAssistant] confirm gagal:", err?.message || err);
      return res.status(400).json({ success: false, message: err?.message || "Eksekusi aksi gagal." });
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

export async function runGeminiAgent(text: string, session: any, req: any, historyMode: boolean, opts?: { sysPrompt?: string; tools?: ToolDef[] }): Promise<{ reply: string; navigation: string[]; highlights: Array<{ route: string; element: string; label: string }>; pendingWrites?: Array<{ id: string; summary: string }> }> {
  const tools = opts?.tools || makeTools();
  const sysPrompt = opts?.sysPrompt || buildAssistantSystemPrompt();
  const apiKey = process.env.GEMINI_API_KEY || "";
  if (!apiKey) throw new Error("GEMINI_API_KEY kosong");
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey, httpOptions: { headers: { "User-Agent": "aistudio-build" } } });

  const contents: any[] = [];
  for (const t of session.turns.slice(0, -1)) {
    contents.push({ role: t.role === "user" ? "user" : "model", parts: [{ text: t.content }] });
  }
  contents.push({ role: "user", parts: [{ text: historyMode ? foldHistory(session, text) : text }] });

  const navigation: string[] = [];
  const highlights: Array<{ route: string; element: string; label: string }> = [];
  const pendingWritesOut: Array<{ id: string; summary: string }> = [];
  const assets: Array<{ type: string; url: string; name?: string; mime?: string }> = [];
  const fillForms: Array<{ form: string; data: any }> = [];

  for (const model of GEMINI_AGENT_MODELS) {
    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response: any = await ai.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction: sysPrompt,
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
          if (reply) return { reply, navigation, highlights, assets: assets.length ? assets : undefined, fillForms: fillForms.length ? fillForms : undefined, pendingWrites: pendingWritesOut.length ? pendingWritesOut : (WRITE_CLAIM_RE.test(reply) ? [buildDeterministicPendingWrite(text, req)].filter(Boolean) as any : pendingWritesOut) };
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
          if (result && result.__pendingWrite) {
            pendingWritesOut.push({ id: result.__pendingWrite, summary: result.__summary || result.summary || "Aksi tulis" });
            result = { ok: true, status: "menunggu_konfirmasi", summary: result.__summary || result.summary, message: "Rencana dibuat. Menunggu admin menekan tombol konfirmasi di chat." };
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
