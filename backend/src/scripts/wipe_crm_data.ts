import { getFirestoreDb, db } from '../firebase';
import fs from 'fs';
import path from 'path';

async function deleteCollection(firestore: any, collectionName: string) {
  console.log(`🧹 Wiping collection: "${collectionName}"...`);
  let totalDeleted = 0;

  while (true) {
    const snapshot = await firestore.collection(collectionName).limit(400).get();
    if (snapshot.empty) {
      break;
    }

    const batch = firestore.batch();
    for (const doc of snapshot.docs) {
      // Check for subcollections like enquiries/{id}/history
      if (collectionName === 'enquiries') {
        try {
          const subSnap = await doc.ref.collection('history').get();
          for (const subDoc of subSnap.docs) {
            batch.delete(subDoc.ref);
          }
        } catch (e) {
          // ignore
        }
      }
      batch.delete(doc.ref);
    }

    await batch.commit();
    totalDeleted += snapshot.size;
    console.log(`  -> Deleted ${totalDeleted} documents from "${collectionName}"...`);
  }

  console.log(`✅ Finished "${collectionName}". Total deleted: ${totalDeleted}`);
  return totalDeleted;
}

async function wipeCRMData() {
  console.log('====================================================');
  console.log('  FULL CRM SYSTEM DATA WIPE IN PROGRESS');
  console.log('  (Members, Enquiries, Followups, Bills, Attendance, Device Users)');
  console.log('  (Staff / Employee accounts & Admin logins PRESERVED)');
  console.log('====================================================\n');

  const firestore = getFirestoreDb();
  if (!firestore) {
    console.error('❌ Firestore connection unavailable');
    process.exit(1);
  }

  const collectionsToWipe = [
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

  for (const col of collectionsToWipe) {
    results[col] = await deleteCollection(firestore, col);
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

  // Invalidate any active in-memory cache
  if (db && typeof db.invalidateMembersCache === 'function') {
    db.invalidateMembersCache();
  }

  console.log('\n====================================================');
  console.log('  🎉 CRM SYSTEM CLEANUP SUCCESSFULLY COMPLETED!');
  console.log('====================================================');
  for (const [col, count] of Object.entries(results)) {
    console.log(`  - ${col}: ${count} deleted`);
  }
  console.log('====================================================\n');
}

wipeCRMData()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('❌ Wipe failed with error:', err);
    process.exit(1);
  });
