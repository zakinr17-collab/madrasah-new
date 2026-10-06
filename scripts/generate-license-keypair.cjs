const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 3072,
  publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
});

const envValue = (pem) => pem.trim().replace(/\n/g, '\\n');
const bossFile = path.join(process.cwd(), '.env.license-boss');
const offlineFile = path.join(process.cwd(), '.env.license-offline');

fs.writeFileSync(bossFile,
  `LICENSE_PRIVATE_KEY=${envValue(privateKey)}\nLICENSE_PUBLIC_KEY=${envValue(publicKey)}\n`,
  { mode: 0o600 }
);
fs.writeFileSync(offlineFile,
  `LICENSE_PUBLIC_KEY=${envValue(publicKey)}\n`,
  { mode: 0o600 }
);

const fingerprint = crypto.createHash('sha256').update(publicKey).digest('hex');
console.log('Kunci aktivasi berhasil dibuat.');
console.log('BOSS online : .env.license-boss');
console.log('Admin offline: .env.license-offline');
console.log('Public-key fingerprint SHA-256:', fingerprint);
console.log('Jangan upload atau commit .env.license-boss.');
