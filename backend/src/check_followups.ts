import { getFirestoreDb } from './firebase';

async function run() {
  const db = getFirestoreDb();
  if (!db) {
    console.log("Firebase is not initialized (using mockDb).");
    return;
  }
  const snap = await db.collection('followups').get();
  console.log(`Found ${snap.docs.length} followups in Firestore:`);
  snap.docs.forEach(doc => {
    console.log(doc.id, JSON.stringify(doc.data(), null, 2));
  });
  process.exit(0);
}

run();
