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
      description: "Arahkan admin langsung ke halaman/fitur tertentu di aplikasi (browser admin otomatis berpindah halaman). Gunakan saat admin bertanya 'di mana', 'buka', 'tunjukkan', atau setelah menjelaskan lokasi fitur.",
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
          if (reply) return { reply, navigation };
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
  return { reply, navigation };
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

      const { reply, navigation } = await runAgent(text, session, req, h);
      pushTurn(session, "assistant", reply);

      return res.json({ success: true, reply, navigation, turns: session.turns.length });
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

export async function runGeminiAgent(text: string, session: any, req: any, historyMode: boolean): Promise<{ reply: string; navigation: string[] }> {
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
          if (reply) return { reply, navigation };
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
