import { getFirestoreDb, db } from '../firebase';
import fs from 'fs';
import path from 'path';

async function batchDeleteCollection(firestore: any, colName: string) {
  console.log(`🧹 Wiping collection: "${colName}"...`);
  const snapshot = await firestore.collection(colName).get();
  if (snapshot.empty) {
    console.log(`  -> "${colName}" is already empty.`);
    return 0;
  }

  const docs = snapshot.docs;
  const batchSize = 300;
  let deletedCount = 0;

  for (let i = 0; i < docs.length; i += batchSize) {
    const chunk = docs.slice(i, i + batchSize);
    const batch = firestore.batch();
    for (const doc of chunk) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deletedCount += chunk.length;
    console.log(`  -> Deleted ${deletedCount}/${docs.length} from "${colName}"`);
  }

  console.log(`✅ Finished "${colName}". Total deleted: ${deletedCount}`);
  return deletedCount;
}

async function fastWipe() {
  console.log('====================================================');
  console.log('  STARTING FAST CRM WIPE');
  console.log('====================================================\n');

  const firestore = getFirestoreDb();
  if (!firestore) {
    console.error('❌ Firestore connection unavailable');
    process.exit(1);
  }

  const collections = [
    'members',
    'enquiries',
    'followups',
    'payments',
    'invoices',
    'bills',
    'attendance',
    'attendance_logs',
    'deviceUsers',
    'device_users'
  ];

  const results: Record<string, number> = {};

  for (const col of collections) {
    try {
      results[col] = await batchDeleteCollection(firestore, col);
    } catch (err: any) {
      console.error(`❌ Error deleting collection "${col}":`, err.message);
      results[col] = 0;
    }
  }

  // Clear mockDb.json
  const mockDbPath = path.join(__dirname, '../firebase/mockDb.json');
  if (fs.existsSync(mockDbPath)) {
    try {
      const emptyMock = {
        mockMembers: [],
        mockEnquiries: [],
        mockFollowups: [],
        mockPayments: []
      };
      fs.writeFileSync(mockDbPath, JSON.stringify(emptyMock, null, 2), 'utf8');
      console.log('✅ mockDb.json reset to empty.');
    } catch (e: any) {
      console.warn('⚠️ Could not reset mockDb.json:', e.message);
    }
  }

  if (db && typeof db.invalidateMembersCache === 'function') {
    db.invalidateMembersCache();
  }

  console.log('\n====================================================');
  console.log('  🎉 CRM SYSTEM CLEANUP COMPLETED!');
  console.log('====================================================');
  for (const [col, count] of Object.entries(results)) {
    console.log(`  - ${col}: ${count} deleted`);
  }
  console.log('====================================================\n');
}

fastWipe()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal wipe error:', err);
    process.exit(1);
  });
