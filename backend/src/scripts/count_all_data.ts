import { getFirestoreDb } from '../firebase';
import fs from 'fs';
import path from 'path';

async function countData() {
  const firestore = getFirestoreDb();
  if (!firestore) {
    console.error('Firestore not available');
    return;
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
    'device_users',
    'employees',
    'trainers',
    'users',
    'system_config'
  ];

  console.log('--- Current Firestore Collection Counts ---');
  for (const col of collections) {
    try {
      const snap = await firestore.collection(col).get();
      console.log(`${col}: ${snap.size} documents`);
    } catch (e: any) {
      console.log(`${col}: error ${e.message}`);
    }
  }

  const mockDbPath = path.join(__dirname, '../firebase/mockDb.json');
  if (fs.existsSync(mockDbPath)) {
    const raw = fs.readFileSync(mockDbPath, 'utf8');
    const mock = JSON.parse(raw);
    console.log('\n--- mockDb.json contents ---');
    console.log(`mockMembers: ${Array.isArray(mock.mockMembers) ? mock.mockMembers.length : 0}`);
    console.log(`mockEnquiries: ${Array.isArray(mock.mockEnquiries) ? mock.mockEnquiries.length : 0}`);
  }
}

countData().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
