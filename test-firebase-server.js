import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, getDoc, doc } from 'firebase/firestore';
import fs from 'fs';

const config = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(config);
const db = getFirestore(app, config.firestoreDatabaseId);

async function run() {
  const docRef = await addDoc(collection(db, 'photos'), {
    data: 'data:image/jpeg;base64,testdata',
    createdAt: Date.now()
  });
  console.log('Added doc:', docRef.id);
  
  const snap = await getDoc(doc(db, 'photos', docRef.id));
  console.log('Read doc:', snap.data().data);
  process.exit(0);
}
run().catch(console.error);
