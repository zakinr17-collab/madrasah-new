// ============================================================================
// AI ASSISTANT (ADMIN) — Asisten AI khusus akun admin
// Terhubung ke API key aktif di pengaturan (rantai: key guru -> profil aktif
// -> .env, sama seperti fitur AI lain via callAI).
// System prompt berisi pengetahuan aplikasi + statistik live sehingga AI
// mengenal aplikasi ini; selain itu menjawab pertanyaan umum.
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

function assistantSnapshotContext(): string {
  try {
    const g: any = globalThis as any;
    const students = Array.isArray(g.appState?.students) ? g.appState.students : null;
    // Data aplikasi live disimpan di store masing2 modul; gunakan helper aman.
    const settings = typeof g.getAppSettingsSnapshot === "function" ? g.getAppSettingsSnapshot() : (g.appSettings || {});
    const school = settings?.schoolName || settings?.school_name || "";
    const lines: string[] = [];
    if (school) lines.push(`Nama madrasah/sekolah pada pengaturan: "${school}".`);
    return lines.join("\n");
  } catch {
    return "";
  }
}

function buildAssistantSystemPrompt(): string {
  const snapshot = assistantSnapshotContext();
  return `Kamu adalah "Asisten Madrasah" — asisten AI resmi yang terpasang di dalam aplikasi CBT & manajemen madrasah "Madrasah Digital" (madrasah-new).

PENGETAHUANMU TENTANG APLIKASI INI:
- Aplikasi ini adalah sistem ujian berbasis komputer (CBT) + manajemen madrasah untuk guru, siswa, dan admin.
- Fitur utama:
  1. Manajemen data: siswa, guru, kelas, mata pelajaran, jadwal, pengguna & akun.
  2. Bank soal & ujian CBT: buat soal pilihan ganda dan esay, jadwal ujian, mode fokus, monitoring siswa real-time.
  3. Koreksi otomatis: koreksi jawaban esay dengan AI (per siswa, dengan progress bar).
  4. Modul Ajar & perangkat pembelajaran: modul ajar lengkap (17 komponen), kisi-kisi & naskah soal (dibuat per batch dengan progress), RPP, silabus, ATP, KKTP, Prota, Prosem, LKPD, analisis KI-KD, PPT, poster, infografis.
  5. Evaluasi: hasil ujian, nilai, unduh lembar jawaban siswa (dengan opsi kunci & pembahasan).
  6. Perizinan Guru: admin mengatur guru mana yang boleh memakai AI bersama atau wajib pasang API key sendiri, begitu juga untuk Google Drive.
  7. Chat antar pengguna (guru-siswa-admin), kalender & agenda, gamifikasi/arena game belajar, LKPD & materi belajar, buku sumber (upload PDF/Word/foto OCR).
  8. Pengaturan: profil AI (provider custom OpenAI-compatible atau Gemini), tema, logo, lokasi sekolah, lisensi offline.
- AI di aplikasi ini memakai API key yang diaktifkan di Pengaturan (profil AI aktif). Kamu sendiri berjalan di atas API key yang sama.
- Mode online (Cloud SQL) dan mode offline (VPS lokal) keduanya didukung.

TUGASMU:
1. Menjadi asisten untuk admin dalam MENGGUNAKAN aplikasi ini: jelaskan cara memakai fitur, langkah-langkah praktis, tips, dan makna pengaturan (contoh: "bagaimana membuat ujian?", "apa itu Perizinan Guru?", "kenapa koreksi AI gagal?").
2. Menjawab pertanyaan UMUM layaknya asisten AI biasa (pengetahuan umum, menulis, merangkum, menerjemahkan, menghitung, dan lain-lain).
3. Jawab SELALU dalam Bahasa Indonesia yang ramah, jelas, dan terstruktur (poin-poin bila perlu). Jangan gunakan markdown bertanda bintang ganda (**) atau pagar (#); gunakan penomoran/strip biasa.
4. Jika ditanya hal yang tidak kamu pasti tentang data internal (mis. nilai siswa tertentu), sarankan menu yang tepat di aplikasi untuk mengeceknya — jangan mengarang data.

${snapshot ? "KONTEKS APLIKASI SAAT INI:\n" + snapshot : ""}`;
}

export function registerAiAssistantEndpoints(app: Express, h: AssistantHelpers) {
  app.post("/api/ai-assistant/chat", h.requireAuth, h.requireRole(["admin", "administrator", "bos", "superadmin"]), async (req: Request, res: Response) => {
    try {
      const { message, reset } = (req.body || {}) as { message?: string; reset?: boolean };
      const text = String(message || "").trim();
      if (!text) return res.status(400).json({ success: false, message: "Pesan tidak boleh kosong." });

      const authUser = h.getAuthUser(req);
      const sessionKey = String(authUser?.username || authUser?.id || req.ip || "admin");
      const now = Date.now();
      for (const [k, v] of assistantSessions) {
        if (now - v.updatedAt > ASSISTANT_SESSION_TTL) assistantSessions.delete(k);
      }
      let session = assistantSessions.get(sessionKey);
      if (!session || reset) {
        session = { turns: [], updatedAt: now };
        assistantSessions.set(sessionKey, session);
      }
      session.updatedAt = now;
      session.turns.push({ role: "user", content: text });
      while (session.turns.length > ASSISTANT_MAX_TURNS) session.turns.shift();

      const ai = null; /* custom-first: client Gemini opsional */
      // toChatMessages hanya mendukung system + 1 pesan user -> lipat riwayat
      // percakapan ke dalam satu prompt teks.
      const historyText = session.turns
        .slice(0, -1)
        .map((t) => (t.role === "user" ? "Admin: " : "Asisten: ") + t.content)
        .join("\n\n");
      const prompt = historyText
        ? `Riwayat percakapan sebelumnya (untuk konteks):\n\n${historyText}\n\n---\nPertanyaan baru dari admin:\n${text}`
        : text;
      const response = await h.callAI(ai, {
        contents: prompt,
        config: {
          systemInstruction: buildAssistantSystemPrompt(),
          generationConfig: { temperature: 0.6, maxOutputTokens: 2048 },
        },
      } as any);

      const reply = String(response?.text || "").trim();
      if (!reply) throw new Error("AI memberikan respons kosong.");
      session.turns.push({ role: "assistant", content: reply });
      while (session.turns.length > ASSISTANT_MAX_TURNS) session.turns.shift();

      return res.json({ success: true, reply, turns: session.turns.length });
    } catch (err: any) {
      console.error("[AIAssistant] chat gagal:", err?.message || err);
      return res.status(500).json({ success: false, message: err?.message || "Asisten AI gagal merespons." });
    }
  });

  app.get("/api/ai-assistant/history", h.requireAuth, h.requireRole(["admin", "administrator", "bos", "superadmin"]), async (req: Request, res: Response) => {
    try {
      const authUser = h.getAuthUser(req);
      const sessionKey = String(authUser?.username || authUser?.id || req.ip || "admin");
      const session = assistantSessions.get(sessionKey);
      return res.json({ success: true, turns: session?.turns || [] });
    } catch {
      return res.json({ success: true, turns: [] });
    }
  });

  app.post("/api/ai-assistant/reset", h.requireAuth, h.requireRole(["admin", "administrator", "bos", "superadmin"]), async (req: Request, res: Response) => {
    try {
      const authUser = h.getAuthUser(req);
      const sessionKey = String(authUser?.username || authUser?.id || req.ip || "admin");
      assistantSessions.delete(sessionKey);
      return res.json({ success: true });
    } catch {
      return res.json({ success: true });
    }
  });
}
