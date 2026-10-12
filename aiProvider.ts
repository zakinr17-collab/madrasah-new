// aiProvider.ts — Lapisan AI multi-provider untuk madrasah-new.
// Prioritas: Hermes/Custom (OpenAI-compatible) -> Gemini (fallback bila gagal).
// Shim kompatibel dengan pemakaian response ala @google/genai: response.text
//
// Env:
//   CUSTOM_AI_BASE_URL  (default: https://token.lightvela.ai/v1)
//   CUSTOM_AI_API_KEY   (required untuk provider custom; jika kosong -> langsung Gemini)
//   CUSTOM_AI_MODEL     (default: auto)
//   AI_PROVIDER_ORDER   (default: "custom,gemini"; set "gemini" utk memaksa Gemini)
//
// Dipakai via: callAI({ model, contents, config }) — signature sama dengan
// generateGeminiContent, jadi tinggal ganti nama fungsi di titik panggilan.

export interface AIContentPart { text?: string; inlineData?: { mimeType: string; data: string } }
export type AIContents = string | AIContentPart[] | any[];

function customBase(): string {
  return (process.env.CUSTOM_AI_BASE_URL || "https://token.lightvela.ai/v1").replace(/\/$/, "");
}
function customKey(): string { return process.env.CUSTOM_AI_API_KEY || ""; }
function customModel(): string { return process.env.CUSTOM_AI_MODEL || "auto"; }
function providerOrder(): string[] {
  return (process.env.AI_PROVIDER_ORDER || "custom,gemini")
    .split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}

const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Konversi contents ala Gemini ke pesan chat-completions. */
function toChatMessages(contents: AIContents, config?: any): any[] {
  const messages: any[] = [];
  if (config?.systemInstruction) {
    const si = config.systemInstruction;
    const sysText = typeof si === "string" ? si
      : Array.isArray(si) ? si.map((p: any) => p?.text || "").join("\n")
      : si?.parts?.map((p: any) => p?.text || "").join("\n") || "";
    if (sysText) messages.push({ role: "system", content: sysText });
  }
  const parts: AIContentPart[] = typeof contents === "string"
    ? [{ text: contents }]
    : Array.isArray(contents) ? contents : [contents];
  const textChunks: string[] = [];
  const images: any[] = [];
  for (const p of parts) {
    if (typeof p === "string") { textChunks.push(p); continue; }
    if (p?.text) textChunks.push(p.text);
    if (p?.inlineData) {
      images.push({ type: "image_url", image_url: { url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}` } });
    }
  }
  const content: any = images.length
    ? [{ type: "text", text: textChunks.join("\n\n") }, ...images]
    : textChunks.join("\n\n");
  messages.push({ role: "user", content });
  return messages;
}

/** Panggil provider custom (OpenAI-compatible). Return teks atau null jika gagal. */
async function callCustom(contents: AIContents, config?: any, maxTokens?: number): Promise<string | null> {
  if (!customKey()) return null;
  const body: any = {
    model: customModel(),
    messages: toChatMessages(contents, config),
  };
  if (maxTokens) body.max_tokens = maxTokens;
  // 3 percobaan: network glitch / overload / reasoning dipotong (finish_reason=length)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 120_000);
      const res = await fetch(`${customBase()}/chat/completions`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${customKey()}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      clearTimeout(t);
      if (!res.ok) {
        console.warn(`[AIProvider:custom] HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
        if (res.status === 429 || res.status >= 500) { await sleep(2000); continue; }
        return null;
      }
      const data: any = await res.json();
      const msg = data?.choices?.[0]?.message;
      let text: string = msg?.content || "";
      // Beberapa model menaruh jawaban di reasoning_content bila content kosong
      if (!text.trim() && msg?.reasoning_content) text = String(msg.reasoning_content);
      if (!text.trim()) { console.warn("[AIProvider:custom] Respons kosong"); await sleep(1500); continue; }
      return text;
    } catch (e: any) {
      console.warn(`[AIProvider:custom] Attempt ${attempt + 1} gagal:`, e?.message || e);
      await sleep(2000);
    }
  }
  return null;
}

/**
 * Helper utama. Kompatibel dengan generateGeminiContent:
 * return { text } atau throw. Urutan provider mengikuti AI_PROVIDER_ORDER.
 * Model request diabaikan utk provider custom (server yang memilih model).
 */
export async function callAI(ai: any, params: { model?: string; contents: AIContents; config?: any }) {
  let lastError: any = null;
  for (const provider of providerOrder()) {
    if (provider === "custom") {
      const text = await callCustom(params.contents, params.config);
      if (text !== null) {
        // Validasi JSON ala helper lama
        if (params.config?.responseMimeType === "application/json") {
          const t = text.trim();
          if (t === "{" || t === "}") throw new Error("Invalid/Truncated JSON response from custom provider");
        }
        return { text };
      }
      console.warn("[AIProvider] Custom provider gagal, mencoba provider berikutnya...");
      continue;
    }
    if (provider === "gemini") {
      if (!ai) { lastError = new Error("Gemini client tidak tersedia (GEMINI_API_KEY kosong)"); continue; }
      // generateGeminiContent sudah ada di server.ts (fallback model + retry)
      // @ts-ignore — didefinisikan di server.ts
      const response = await generateGeminiContent(ai, params);
      return response;
    }
  }
  throw lastError || new Error("Semua AI provider gagal");
}
