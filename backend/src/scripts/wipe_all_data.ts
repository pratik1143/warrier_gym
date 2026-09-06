import { getFirestoreDb } from '../firebase';

const collectionsToWipe = [
  'members',
  'payments',
  'attendance',
  'attendance_logs',
  'enquiries',
  'employees',
  'trainers',
  'packages',
  'branches',
  'devices',
  'notifications',
  'activity_logs',
  'automation_logs'
];

async function wipeAllData() {
  console.log('🚨 STARTING COMPLETE DATA WIPE FROM FIRESTORE...');
  const firestore = getFirestoreDb();
  if (!firestore) {
    console.error('❌ Firestore connection unavailable');
    process.exit(1);
  }

  let totalDeleted = 0;

  for (const collName of collectionsToWipe) {
    try {
      const snap = await firestore.collection(collName).get();
      if (snap.empty) {
        console.log(`ℹ️ Collection '${collName}' is already empty.`);
        continue;
      }

      const batchSize = snap.docs.length;
      let count = 0;

      // Delete in batches of 500
      const chunks: Array<Array<FirebaseFirestore.QueryDocumentSnapshot>> = [];
      for (let i = 0; i < snap.docs.length; i += 400) {
        chunks.push(snap.docs.slice(i, i + 400));
      }

      for (const chunk of chunks) {
        const batch = firestore.batch();
        for (const doc of chunk) {
          batch.delete(doc.ref);
          count++;
        }
        await batch.commit();
      }

      totalDeleted += count;
      console.log(`✅ Cleared collection '${collName}' (${count} documents deleted)`);
    } catch (err: any) {
      console.warn(`⚠️ Warning clearing collection '${collName}':`, err.message);
    }
  }

  console.log(`\n🎉 DATA WIPE COMPLETE! Total documents removed: ${totalDeleted}`);
  process.exit(0);
}

wipeAllData().catch(err => {
  console.error('❌ Fatal error wiping data:', err);
  process.exit(1);
});
