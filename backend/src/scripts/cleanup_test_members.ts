import { getFirestoreDb, db } from '../firebase';

async function cleanupTestMembers() {
  const firestore = getFirestoreDb();
  if (!firestore) {
    console.error('Firestore is not initialized.');
    process.exit(1);
  }

  console.log('Fetching members from Firestore...');
  const membersSnap = await firestore.collection('members').get();
  console.log(`Total members found in Firestore: ${membersSnap.docs.length}`);

  const toDeleteDocIds: string[] = [];
  const testMemberIds: string[] = [];

  for (const doc of membersSnap.docs) {
    const data = doc.data();
    const name = (data.name || '').toLowerCase();
    const id = doc.id;
    const memberId = data.memberId || data.id || '';
    const phone = data.phone || '';

    if (
      name.includes('upgrade client') ||
      name.includes('tover') ||
      name.startsWith('upgrade client') ||
      id.startsWith('mem_upg_') ||
      memberId.startsWith('mem_upg_') ||
      id.startsWith('mem_test_') ||
      memberId.startsWith('mem_test_')
    ) {
      console.log(`Found test member to delete: docId="${id}", name="${data.name}", memberId="${memberId}", phone="${phone}"`);
      toDeleteDocIds.push(id);
      if (memberId) testMemberIds.push(memberId);
      testMemberIds.push(id);
    }
  }

  if (toDeleteDocIds.length === 0) {
    console.log('No test members found.');
  } else {
    for (const docId of toDeleteDocIds) {
      await firestore.collection('members').doc(docId).delete();
      console.log(`Successfully deleted member doc: ${docId}`);
    }
  }

  // Also clean up any test payments
  console.log('Checking payments collection for test invoices...');
  const paymentsSnap = await firestore.collection('payments').get();
  for (const doc of paymentsSnap.docs) {
    const data = doc.data();
    const mName = (data.memberName || '').toLowerCase();
    const mId = data.memberId || '';
    const inv = data.invoiceNumber || data.invoice || '';

    if (
      mName.includes('upgrade client') ||
      mName.includes('tover') ||
      inv.includes('INV-MEM-ORIG-') ||
      inv.includes('INV-UPG-') ||
      testMemberIds.includes(mId)
    ) {
      await firestore.collection('payments').doc(doc.id).delete();
      console.log(`Successfully deleted test payment doc: ${doc.id} (Invoice: ${inv})`);
    }
  }

  console.log('All test data cleaned up successfully!');
  db.invalidateMembersCache();
  process.exit(0);
}

cleanupTestMembers().catch(err => {
  console.error('Error during cleanup:', err);
  process.exit(1);
});
