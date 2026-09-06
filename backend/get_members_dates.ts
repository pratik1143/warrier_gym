import * as admin from 'firebase-admin';
import * as fs from 'fs';
import 'dotenv/config';

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath!, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

async function run() {
  const snap = await db.collection('members').limit(3).get();
  snap.forEach((doc: any) => {
    console.log(doc.id, "=>", JSON.stringify(doc.data(), null, 2));
  });
  process.exit(0);
}

run();

export {};
