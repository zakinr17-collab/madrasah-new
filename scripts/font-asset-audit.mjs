import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const distDir = path.join(root, 'dist');
const auditDir = fs.existsSync(distDir) ? distDir : publicDir;

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const fontFiles = walk(auditDir).filter((file) => /\.woff2$/i.test(file));
const cssFiles = walk(auditDir).filter((file) => /\.css$/i.test(file));
const problems = [];
const info = [];

for (const file of fontFiles) {
  const buf = fs.readFileSync(file);
  const rel = path.relative(root, file).replaceAll(path.sep, '/');
  if (buf.length < 48) {
    problems.push({ file: rel, reason: `too short (${buf.length} bytes)` });
    continue;
  }
  const signature = buf.toString('ascii', 0, 4);
  const declaredLength = buf.readUInt32BE(8);
  const numTables = buf.readUInt16BE(12);
  const reserved = buf.readUInt16BE(14);
  const totalSfntSize = buf.readUInt32BE(16);
  const totalCompressedSize = buf.readUInt32BE(20);
  const row = { file: rel, actual: buf.length, declaredLength, numTables, reserved, totalSfntSize, totalCompressedSize };
  info.push(row);

  if (signature !== 'wOF2') problems.push({ file: rel, reason: `bad signature ${JSON.stringify(signature)}` });
  if (declaredLength !== buf.length) problems.push({ file: rel, reason: `header length ${declaredLength} != actual ${buf.length}` });
  if (numTables < 1) problems.push({ file: rel, reason: 'numTables is zero' });
  if (reserved !== 0) problems.push({ file: rel, reason: `reserved header field is ${reserved}, expected 0` });
  if (totalSfntSize < totalCompressedSize) {
    problems.push({
      file: rel,
      reason: `decompressed SFNT size ${totalSfntSize} is less than compressed WOFF2 size ${totalCompressedSize}`
    });
  }
}

const urlPattern = /url\((['"]?)([^)'"]+?\.woff2(?:\?[^)'"]*)?)\1\)/gi;
for (const cssFile of cssFiles) {
  const css = fs.readFileSync(cssFile, 'utf8');
  let match;
  while ((match = urlPattern.exec(css))) {
    const raw = match[2];
    if (/^(?:https?:|data:|\/\/)/i.test(raw)) continue;
    const clean = raw.split('?')[0].split('#')[0];
    const resolved = clean.startsWith('/')
      ? path.join(auditDir, clean.replace(/^\/+/, ''))
      : path.resolve(path.dirname(cssFile), clean);
    if (!fs.existsSync(resolved)) {
      problems.push({
        file: path.relative(root, cssFile).replaceAll(path.sep, '/'),
        reason: `missing referenced WOFF2: ${raw}`
      });
    }
  }
}

const suspicious = info.filter((x) => x.totalSfntSize < x.totalCompressedSize);
console.log(`Font audit scanned ${fontFiles.length} WOFF2 files and ${cssFiles.length} CSS files.`);
if (suspicious.length) {
  console.log('WOFF2 files matching Chromium OTS size failure:');
  for (const row of suspicious) console.log(JSON.stringify(row));
}

if (problems.length) {
  console.error(`Font audit failed with ${problems.length} problem(s):`);
  for (const p of problems) console.error(`- ${p.file}: ${p.reason}`);
  process.exit(1);
}
console.log('Font asset audit passed.');
