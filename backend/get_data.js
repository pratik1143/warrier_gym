const admin = require('firebase-admin');
const fs = require('fs');

const serviceAccountPath = './serviceAccountKey.json';
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function check() {
  console.log('--- TRAINERS ---');
  const trainersSnap = await db.collection('trainers').get();
  trainersSnap.forEach(doc => {
    console.log(`ID: ${doc.id} | Name: ${doc.data().name} | Specialization: ${doc.data().specialization}`);
  });

  console.log('\n--- MEMBERS ---');
  const membersSnap = await db.collection('members').get();
  membersSnap.forEach(doc => {
    console.log(`ID: ${doc.id} | Name: ${doc.data().name} | TrainerID: ${doc.data().trainerId} | TrainerName: ${doc.data().trainer}`);
  });
}

check().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
