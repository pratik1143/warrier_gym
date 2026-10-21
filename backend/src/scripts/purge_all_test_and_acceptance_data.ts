import fs from 'fs';
import path from 'path';
import { getFirestoreDb } from '../firebase';

function isTestEntity(name: string, phone: string, id: string, email: string): boolean {
  const cleanName = (name || '').trim().toLowerCase();
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const cleanId = (id || '').trim().toLowerCase();
  const cleanEmail = (email || '').trim().toLowerCase();

  // Test name patterns
  if (
    cleanName.includes('acceptance member') ||
    cleanName.includes('acceptance') ||
    cleanName.includes('test member') ||
    cleanName.includes('test customer') ||
    cleanName.includes('test idempotency') ||
    cleanName.includes('test doubleclick') ||
    cleanName.includes('future start member') ||
    cleanName.includes('sample member') ||
    cleanName.includes('dummy member') ||
    cleanName.startsWith('test ') ||
    cleanName === 'test'
  ) {
    return true;
  }

  // Test ID patterns
  if (
    cleanId.startsWith('test_') ||
    cleanId.startsWith('mem_test_') ||
    cleanId.startsWith('acc_test_') ||
    cleanId === 'az-2026-0014' ||
    cleanId === 'test_acc_mem_a' ||
    cleanId === 'test_acc_mem_e'
  ) {
    return true;
  }

  // Test phone patterns (e.g. 9900000000 - 9900000099, 9800000000 - 9800000099)
  if (
    cleanPhone.startsWith('990000') ||
    cleanPhone.startsWith('9800000') ||
    cleanPhone === '9876543201' ||
    cleanPhone === '9876543202' ||
    cleanPhone === '9876543203' ||
    cleanPhone === '9876543204' ||
    cleanPhone === '9876543205'
  ) {
    return true;
  }

  // Test email patterns
  if (cleanEmail.includes('test@example.com') || cleanEmail.includes('acceptance@test.com')) {
    return true;
  }

  return false;
}

async function purgeAllTestData() {
  console.log('====================================================');
  console.log('  PURGING ALL FAKE / TEST / ACCEPTANCE DATA FROM DB');
  console.log('====================================================\n');

  const firestore = getFirestoreDb();
  if (!firestore) {
    console.error('❌ Firestore connection unavailable');
    process.exit(1);
  }

  const deletedMemberIds = new Set<string>();
  const deletedMemberPhones = new Set<string>();

  let deletedMembers = 0;
  let deletedFollowups = 0;
  let deletedEnquiries = 0;
  let deletedPayments = 0;
  let deletedAttendance = 0;

  // 1. Purge Members Collection
  console.log('🔍 Scanning members collection...');
  const membersSnap = await firestore.collection('members').get();
  for (const doc of membersSnap.docs) {
    const data = doc.data();
    const name = data.name || data.fullName || '';
    const phone = data.phone || data.mobile || '';
    const id = doc.id;
    const email = data.email || '';

    if (isTestEntity(name, phone, id, email)) {
      deletedMemberIds.add(id);
      if (data.memberId) deletedMemberIds.add(String(data.memberId));
      if (phone) deletedMemberPhones.add(String(phone).replace(/\D/g, ''));

      await firestore.collection('members').doc(id).delete();
      deletedMembers++;
      console.log(`  🗑 Deleted test member: "${name}" (ID: ${id}, Phone: ${phone})`);
    }
  }

  // 2. Purge Followups Collection (including orphans)
  console.log('\n🔍 Scanning followups collection...');
  const followupsSnap = await firestore.collection('followups').get();
  for (const doc of followupsSnap.docs) {
    const data = doc.data();
    const name = data.memberName || data.name || data.clientName || '';
    const phone = data.phone || data.memberPhone || '';
    const id = doc.id;
    const mId = String(data.memberId || '').trim();
    const cleanPhone = String(phone).replace(/\D/g, '');

    const isMatch = 
      isTestEntity(name, phone, id, '') ||
      (mId && deletedMemberIds.has(mId)) ||
      (cleanPhone && deletedMemberPhones.has(cleanPhone)) ||
      id.startsWith('AUTO_RENEWAL_test_') ||
      id.startsWith('ENQUIRY_FOLLOWUP_test_');

    if (isMatch) {
      await firestore.collection('followups').doc(id).delete();
      deletedFollowups++;
      console.log(`  🗑 Deleted test follow-up: "${data.title || name}" (ID: ${id})`);
    }
  }

  // 3. Purge Enquiries Collection
  console.log('\n🔍 Scanning enquiries collection...');
  const enquiriesSnap = await firestore.collection('enquiries').get();
  for (const doc of enquiriesSnap.docs) {
    const data = doc.data();
    const name = data.name || `${data.firstName || ''} ${data.lastName || ''}`;
    const phone = data.phone || data.contact || '';
    const id = doc.id;

    if (isTestEntity(name, phone, id, data.email || '')) {
      await firestore.collection('enquiries').doc(id).delete();
      deletedEnquiries++;
      console.log(`  🗑 Deleted test enquiry: "${name}" (ID: ${id})`);
    }
  }

  // 4. Purge Payments / Invoices Collection
  console.log('\n🔍 Scanning payments collection...');
  const paymentsSnap = await firestore.collection('payments').get();
  for (const doc of paymentsSnap.docs) {
    const data = doc.data();
    const name = data.memberName || data.name || '';
    const phone = data.memberPhone || data.phone || '';
    const id = doc.id;
    const mId = String(data.memberId || '').trim();
    const cleanPhone = String(phone).replace(/\D/g, '');

    const isMatch = 
      isTestEntity(name, phone, id, '') ||
      (mId && deletedMemberIds.has(mId)) ||
      (cleanPhone && deletedMemberPhones.has(cleanPhone));

    if (isMatch) {
      await firestore.collection('payments').doc(id).delete();
      deletedPayments++;
      console.log(`  🗑 Deleted test payment/invoice: "${name}" (ID: ${id})`);
    }
  }

  // 5. Purge Attendance Logs
  console.log('\n🔍 Scanning attendance collection...');
  const attendanceSnap = await firestore.collection('attendance').get();
  for (const doc of attendanceSnap.docs) {
    const data = doc.data();
    const name = data.memberName || '';
    const phone = data.phone || '';
    const id = doc.id;
    const mId = String(data.memberId || '').trim();

    if (isTestEntity(name, phone, id, '') || (mId && deletedMemberIds.has(mId))) {
      await firestore.collection('attendance').doc(id).delete();
      deletedAttendance++;
      console.log(`  🗑 Deleted test attendance: "${name}" (ID: ${id})`);
    }
  }

  // 6. Purge mockDb.json (Offline fallback file if present)
  const mockDbPath = path.join(__dirname, '../firebase/mockDb.json');
  if (fs.existsSync(mockDbPath)) {
    try {
      const rawMock = fs.readFileSync(mockDbPath, 'utf8');
      const mockObj = JSON.parse(rawMock);
      if (Array.isArray(mockObj.mockMembers)) {
        const origCount = mockObj.mockMembers.length;
        mockObj.mockMembers = mockObj.mockMembers.filter((m: any) => 
          !isTestEntity(m.name || '', m.phone || '', m.id || m.memberId || '', m.email || '')
        );
        console.log(`\n🧹 Cleaned mockDb.json: Removed ${origCount - mockObj.mockMembers.length} fake members.`);
        fs.writeFileSync(mockDbPath, JSON.stringify(mockObj, null, 2), 'utf8');
      }
    } catch (e: any) {
      console.warn('Notice: mockDb.json update note:', e.message);
    }
  }

  console.log('\n====================================================');
  console.log(`  🎉 PURGE COMPLETE!`);
  console.log(`  - Members Deleted: ${deletedMembers}`);
  console.log(`  - Follow-ups Deleted: ${deletedFollowups}`);
  console.log(`  - Enquiries Deleted: ${deletedEnquiries}`);
  console.log(`  - Payments Deleted: ${deletedPayments}`);
  console.log(`  - Attendance Logs Deleted: ${deletedAttendance}`);
  console.log('====================================================\n');

  process.exit(0);
}

purgeAllTestData().catch((err) => {
  console.error('❌ Purge failed with error:', err);
  process.exit(1);
});
