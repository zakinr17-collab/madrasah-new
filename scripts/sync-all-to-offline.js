import fs from 'fs';
import path from 'path';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';

async function main() {
  console.log("=== Starting Offline Data & Photo Synchronization ===");
  
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // 1. Read Firebase Config & Connect
  let photoCount = 0;
  try {
    const firebaseConfigFile = path.join(process.cwd(), 'firebase-applet-config.json');
    if (fs.existsSync(firebaseConfigFile)) {
      const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigFile, 'utf8'));
      const fbApp = initializeApp(firebaseConfig);
      const db = getFirestore(fbApp, firebaseConfig.firestoreDatabaseId);

      console.log("Connected to Firestore. Fetching photos collection...");
      const snap = await getDocs(collection(db, 'photos'));
      console.log(`Found ${snap.size} photo document(s) in Firestore.`);

      for (const docSnap of snap.docs) {
        const docId = docSnap.id;
        const data = docSnap.data();
        if (data && data.data) {
          const rawData = data.data;
          const targetFile = path.join(uploadsDir, docId);
          
          const matches = rawData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
          if (matches && matches.length === 3) {
            const buffer = Buffer.from(matches[2], 'base64');
            fs.writeFileSync(targetFile, buffer);
          } else {
            fs.writeFileSync(targetFile, rawData);
          }
          photoCount++;
        }
      }
      console.log(`Successfully downloaded ${photoCount} photos to /uploads folder.`);
    }
  } catch (err) {
    console.error("Error downloading from Firestore:", err.message);
  }

  // 2. Also check local_store.json to ensure any base64 photos are safely mirrored in uploads
  const localStoreFile = path.join(process.cwd(), 'local_store.json');
  if (fs.existsSync(localStoreFile)) {
    try {
      const store = JSON.parse(fs.readFileSync(localStoreFile, 'utf8'));
      let extractedCount = 0;

      const processList = (list, photoProp = 'photo') => {
        if (!Array.isArray(list)) return;
        for (const item of list) {
          if (item && item[photoProp] && typeof item[photoProp] === 'string' && item[photoProp].startsWith('data:image/')) {
            const rawData = item[photoProp];
            const matches = rawData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              const hashId = `img_${item.id || item.nis || Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
              const buffer = Buffer.from(matches[2], 'base64');
              const targetFile = path.join(uploadsDir, hashId);
              fs.writeFileSync(targetFile, buffer);
              item[photoProp] = `/api/photos/${hashId}`;
              extractedCount++;
            }
          }
        }
      };

      processList(store.students, 'photo');
      processList(store.teachers, 'photo');
      processList(store.attendance, 'photo');
      processList(store.teacherAttendance, 'photo');
      processList(store.questions, 'imageUrl');

      if (extractedCount > 0) {
        fs.writeFileSync(localStoreFile, JSON.stringify(store, null, 2), 'utf8');
        console.log(`Extracted and optimized ${extractedCount} additional inline photos to /uploads.`);
      }
    } catch (err) {
      console.error("Error processing local_store.json photos:", err.message);
    }
  }

  const allFiles = fs.readdirSync(uploadsDir);
  console.log(`Total files in uploads/ directory: ${allFiles.length}`);
  console.log("=== Synchronization Complete ===");
}

main().catch(console.error);
