import crypto from 'crypto';

const OAUTH_STORE_SECRET_ENV = 'LOCAL_STORE_SECRET';

function getEncryptionKey(): Buffer {
  const secret = String(process.env[OAUTH_STORE_SECRET_ENV] || '').trim();
  if (!secret) {
    throw new Error('LOCAL_STORE_SECRET wajib dikonfigurasi untuk menyimpan kredensial Google Drive secara aman.');
  }
  return crypto.createHash('sha256').update(secret).digest();
}

export function encryptGoogleDriveOAuthToken(value: string): string {
  const plaintext = String(value || '').trim();
  if (!plaintext) throw new Error('Refresh token Google Drive kosong.');

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    'v1',
    iv.toString('base64url'),
    tag.toString('base64url'),
    ciphertext.toString('base64url')
  ].join('.');
}

export function decryptGoogleDriveOAuthToken(value: string): string {
  const parts = String(value || '').trim().split('.');
  if (parts.length !== 4 || parts[0] !== 'v1') {
    throw new Error('Format kredensial Google Drive tersimpan tidak valid.');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(parts[1], 'base64url');
  const tag = Buffer.from(parts[2], 'base64url');
  const ciphertext = Buffer.from(parts[3], 'base64url');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8').trim();
}
