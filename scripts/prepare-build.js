import fs from 'fs';
import path from 'path';

const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const srcDir = path.join(process.cwd(), 'src');
if (fs.existsSync(srcDir)) {
  const files = fs.readdirSync(srcDir);
  for (const file of files) {
    if (file.endsWith('.js')) {
      try {
        fs.copyFileSync(path.join(srcDir, file), path.join(publicDir, file));
      } catch (err) {
        console.warn(`Could not copy ${file}:`, err.message);
      }
    }
  }
}
console.log('Static assets prepared for build.');
