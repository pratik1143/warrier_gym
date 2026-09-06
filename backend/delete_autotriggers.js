const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccountPath = './serviceAccountKey.json';
if (!fs.existsSync(serviceAccountPath)) {
  console.error("serviceAccountKey.json not found!");
  process.exit(1);
}
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function clean() {
  console.log('Fetching all followups...');
  const snap = await db.collection('followups').get();
  console.log(`Found ${snap.size} total followups.`);
  
  let deleteCount = 0;
  const batch = db.batch();
  
  for (const doc of snap.docs) {
    const data = doc.data();
    const isAutoTrigger = 
      (data.notes && data.notes.includes('AUTO TRIGGER')) || 
      (data.description && data.description.includes('AUTO TRIGGER')) ||
      (data.title && data.title.includes('AUTO TRIGGER'));
      
    if (isAutoTrigger) {
      console.log(`Scheduling deletion for Doc ID: ${doc.id} (Member: ${data.memberName || 'Unknown'}, Notes: ${data.notes?.substring(0, 40)}...)`);
      batch.delete(doc.ref);
      deleteCount++;
    }
  }
  
  if (deleteCount > 0) {
    console.log(`Commiting batch delete of ${deleteCount} auto-triggered followups...`);
    await batch.commit();
    console.log('Cleanup successful!');
  } else {
    console.log('No auto-triggered followups found to delete.');
  }
}

clean().then(() => process.exit(0)).catch(err => {
  console.error('Error cleaning up:', err);
  process.exit(1);
});
