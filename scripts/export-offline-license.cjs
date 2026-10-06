const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const serverPath = path.join(process.cwd(), 'server.ts');
const outputPath = path.join(process.cwd(), '.env.license-offline-current');

const source = fs.readFileSync(serverPath, 'utf8');
const match = source.match(/const LICENSE_PUBLIC_KEY = `([\s\S]*?)`;/);
if (!match || !match[1] || !match[1].includes('BEGIN PUBLIC KEY')) {
  throw new Error('LICENSE_PUBLIC_KEY tidak ditemukan atau formatnya tidak valid di server.ts');
}

const publicKey = match[1].trim();
const envValue = publicKey.replace(/\r?\n/g, '\\n');
fs.writeFileSync(outputPath, `LICENSE_PUBLIC_KEY=${envValue}\n`, { mode: 0o600 });

const fingerprint = crypto.createHash('sha256').update(publicKey).digest('hex');
console.log('Lisensi public key offline berhasil dibuat: .env.license-offline-current');
console.log('Public-key fingerprint SHA-256:', fingerprint);
console.log('File ini hanya berisi PUBLIC KEY dan aman dipasang di komputer offline.');
console.log('Jangan pernah menyalin LICENSE_PRIVATE_KEY ke komputer offline.');
