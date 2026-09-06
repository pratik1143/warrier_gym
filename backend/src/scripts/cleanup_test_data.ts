import { db, getFirestoreDb } from '../firebase';

async function cleanupTestData() {
  console.log('🧹 Starting cleanup of test/fake payment, member, and attendance documents from Firestore...');
  const firestore = getFirestoreDb();
  if (!firestore) {
    console.error('❌ Firestore connection unavailable');
    process.exit(1);
  }

  let deletedPayments = 0;
  let deletedMembers = 0;
  let deletedAttendance = 0;

  // 1. Clean Payments
  const paymentsSnap = await firestore.collection('payments').get();
  for (const doc of paymentsSnap.docs) {
    const data = doc.data();
    const name = String(data.memberName || data.name || '').toLowerCase();
    const phone = String(data.memberPhone || data.phone || '');
    const isTest = data.isTest || data.isSample || data.isMock;

    if (
      isTest ||
      name.includes('test member') ||
      name.includes('test idempotency') ||
      name.includes('test doubleclick') ||
      name.includes('future start member') ||
      name.includes('test') ||
      phone.startsWith('98000')
    ) {
      await firestore.collection('payments').doc(doc.id).delete();
      deletedPayments++;
    }
  }

  // 2. Clean Members
  const membersSnap = await firestore.collection('members').get();
  for (const doc of membersSnap.docs) {
    const data = doc.data();
    const name = String(data.name || '').toLowerCase();
    const phone = String(data.phone || '');
    const isTest = data.isTest || data.isSample || data.isMock;

    if (
      isTest ||
      name.includes('test member') ||
      name.includes('test idempotency') ||
      name.includes('test doubleclick') ||
      name.includes('future start member') ||
      name.includes('test') ||
      phone.startsWith('98000')
    ) {
      await firestore.collection('members').doc(doc.id).delete();
      deletedMembers++;
    }
  }

  // 3. Clean Attendance Logs (unmapped or test punches)
  const attendanceSnap = await firestore.collection('attendance_logs').get();
  for (const doc of attendanceSnap.docs) {
    const data = doc.data();
    const name = String(data.memberName || '').toLowerCase();
    const mId = String(data.memberId || '');
    const isTest = data.isTest || data.isSample || data.isMock;

    if (
      isTest ||
      name.includes('test') ||
      name.includes('future start') ||
      name.includes('unmapped') ||
      mId.includes('unmapped')
    ) {
      await firestore.collection('attendance_logs').doc(doc.id).delete();
      deletedAttendance++;
    }
  }

  console.log(`✅ Cleanup complete! Removed ${deletedPayments} test payments, ${deletedMembers} test members, and ${deletedAttendance} test attendance logs.`);
  process.exit(0);
}

cleanupTestData().catch(err => {
  console.error('❌ Cleanup failed:', err);
  process.exit(1);
});
