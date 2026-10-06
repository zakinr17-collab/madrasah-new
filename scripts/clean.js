import fs from 'fs';
import path from 'path';

const distDir = path.join(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}

const serverJs = path.join(process.cwd(), 'server.js');
if (fs.existsSync(serverJs)) {
  fs.rmSync(serverJs, { force: true });
}

console.log('Cleaned build output.');
