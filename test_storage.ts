import { initializeApp } from 'firebase/app';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import config from './firebase-applet-config.json' assert { type: 'json' };

const app = initializeApp(config);
const storage = getStorage(app);
const imageRef = ref(storage, 'test.txt');

async function test() {
  try {
    await uploadString(imageRef, 'data:text/plain;base64,SGVsbG8gV29ybGQ=', 'data_url');
    console.log("Uploaded! URL:", await getDownloadURL(imageRef));
  } catch(e) {
    console.error("Error:", e);
  }
}
test();
