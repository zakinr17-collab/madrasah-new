// aiProviderSettings.ts — Manajemen kredensial AI Provider dari UI Settings (BYOK).
// Kredensial disimpan terenkripsi (AES-256-GCM) di settings['aiProviderConfig'].
// Prioritas di aiProvider.ts: DB (per instalasi) -> env (.env) -> default.
//
// Struktur aiProviderConfig:
// {
//   provider: 'custom' | 'gemini',
//   order: string,            // mis. "custom,gemini"
//   customBaseUrl: string,
//   customApiKeyEnc: string,  // format 'v1:iv:tag:ct' (base64url)
//   customModel: string,
//   updatedAt: string
// }

import crypto from 'crypto';

const AI_PROVIDER_CREDENTIAL_KEY_SALT = 'ai-provider-credential-v1';

export interface AiProviderConfig {
  provider: string;
  order: string;
  customBaseUrl: string;
  customApiKeyEnc: string;
  customModel: string;
  updatedAt: string;
  [key: string]: any;
}

export function deriveAiProviderCredentialKey(localStoreSecret: string): Buffer {
  return crypto
    .createHash('sha256')
    .update(AI_PROVIDER_CREDENTIAL_KEY_SALT + ':' + localStoreSecret)
    .digest();
}

export function encryptSecret(value: string, key: Buffer): string {
  const plain = String(value || '').trim();
  if (!plain) return '';
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join(':');
}

export function decryptSecret(value: string, key: Buffer): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const parts = raw.split(':');
  if (parts.length !== 4 || parts[0] !== 'v1') return '';
  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    const ct = Buffer.from(parts[3], 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  } catch {
    return '';
  }
}

// ===== Profil AI tersimpan (daftar untuk ganti AI cepat) =====
export interface AiProviderProfile {
  id: string;
  label: string;
  customBaseUrl: string;
  customModel: string;
  customApiKeyEnc: string;
  updatedAt: string;
}

/** Ambil daftar profil dari settings (aman). */
export function getAiProviderProfiles(settings: any): AiProviderProfile[] {
  const list = settings && Array.isArray(settings.aiProviderProfiles) ? settings.aiProviderProfiles : [];
  return list.filter((p: any) => p && typeof p === 'object' && p.id);
}

/** Bentuk aman profil untuk klien — key tidak pernah dikirim balik. */
export function publicProfileView(p: AiProviderProfile) {
  return {
    id: p.id,
    label: p.label,
    customBaseUrl: p.customBaseUrl,
    customModel: p.customModel,
    hasApiKey: Boolean(p.customApiKeyEnc),
    updatedAt: p.updatedAt,
  };
}

/** Sanitasi payload profil dari UI. */
export function sanitizeProfileInput(body: any, key: Buffer, existing?: AiProviderProfile | null): AiProviderProfile | null {
  if (!body || typeof body !== 'object') return null;
  const label = String(body.label || '').trim().slice(0, 60);
  if (!label) return null;
  const baseUrl = String(body.customBaseUrl ?? existing?.customBaseUrl ?? '').trim().replace(/\/$/, '') || 'https://token.lightvela.ai/v1';
  const model = String(body.customModel ?? existing?.customModel ?? 'auto').trim() || 'auto';
  const prof: AiProviderProfile = {
    id: String(existing?.id || body.id || '').trim() || ('AIP_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
    label,
    customBaseUrl: baseUrl,
    customModel: model,
    customApiKeyEnc: existing?.customApiKeyEnc || '',
    updatedAt: new Date().toISOString(),
  };
  const newKey = String(body.customApiKey || '').trim();
  if (newKey) prof.customApiKeyEnc = encryptSecret(newKey, key);
  else if (body.clearApiKey === true) prof.customApiKeyEnc = '';
  return prof;
}
/** Sanitasi input dari UI sebelum disimpan. */
export function sanitizeAiProviderInput(body: any, key: Buffer, existing?: AiProviderConfig | null): AiProviderConfig | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null;
  const cfg: AiProviderConfig = {
    provider: String(body.provider || existing?.provider || 'custom').trim().toLowerCase() === 'gemini' ? 'gemini' : 'custom',
    order: String(body.order || existing?.order || '').trim(),
    customBaseUrl: String(body.customBaseUrl ?? existing?.customBaseUrl ?? '').trim().replace(/\/$/, ''),
    customApiKeyEnc: existing?.customApiKeyEnc || '',
    customModel: String(body.customModel ?? existing?.customModel ?? 'auto').trim(),
    updatedAt: new Date().toISOString(),
  };
  // API key hanya ditimpa jika dikirim & tidak kosong ('' tidak menghapus key lama kecuali clearApiKey)
  const newKey = String(body.customApiKey || '').trim();
  if (newKey) {
    cfg.customApiKeyEnc = encryptSecret(newKey, key);
  } else if (body.clearApiKey === true) {
    cfg.customApiKeyEnc = '';
  }
  // Validasi order
  const allowed = new Set(['custom', 'gemini']);
  const orderItems = cfg.order.split(',').map(s => s.trim().toLowerCase()).filter(s => allowed.has(s));
  if (orderItems.length === 0) {
    orderItems.push(cfg.provider === 'gemini' ? 'gemini' : 'custom', 'gemini');
  }
  cfg.order = Array.from(new Set(orderItems)).join(',');
  if (!cfg.customBaseUrl) cfg.customBaseUrl = 'https://token.lightvela.ai/v1';
  if (!cfg.customModel) cfg.customModel = 'auto';
  return cfg;
}

/** Bentuk aman untuk dikirim ke klien — key tidak pernah dikirim balik. */
export function publicAiProviderView(cfg: AiProviderConfig | null | undefined, envHasKey: boolean) {
  if (!cfg) {
    return {
      configured: false,
      provider: 'custom',
      order: 'custom,gemini',
      customBaseUrl: '',
      customModel: 'auto',
      hasApiKey: envHasKey,
      keySource: envHasKey ? 'env' : 'none',
      updatedAt: null,
    };
  }
  const hasKey = Boolean(cfg.customApiKeyEnc) || envHasKey;
  return {
    configured: true,
    provider: cfg.provider,
    order: cfg.order,
    customBaseUrl: cfg.customBaseUrl,
    customModel: cfg.customModel,
    hasApiKey: hasKey,
    keySource: cfg.customApiKeyEnc ? 'db' : (envHasKey ? 'env' : 'none'),
    updatedAt: cfg.updatedAt,
  };
}
