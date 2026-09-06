import * as admin from 'firebase-admin';
import * as fs from 'fs';
import 'dotenv/config';

const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath!, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();

async function run() {
  const snap = await db.collection('migrations').orderBy('timestamp', 'desc').limit(1).get();
  if (snap.empty) {
    console.log("No migrations found.");
  } else {
    snap.forEach((doc: any) => {
      console.log("Migration Doc:", doc.id);
      console.log(JSON.stringify(doc.data(), null, 2));
    });
  }
  process.exit(0);
}

run();

