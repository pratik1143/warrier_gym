let firebaseAdmin;
try {
  firebaseAdmin = require('../backend/node_modules/firebase-admin');
} catch (e) {
  firebaseAdmin = require('../frontend/node_modules/firebase-admin');
}

const admin = firebaseAdmin.default || firebaseAdmin;
const path = require('path');
const fs = require('fs');

const serviceAccountPath = path.join(__dirname, '..', 'backend', 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ ERROR: serviceAccountKey.json not found at:", serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const auth = admin.auth();
const db = admin.firestore();

async function createOwnerAccount() {
  const email = 'owner@warrier.com';
  const password = '1234567';
  const displayName = 'The Warrior Gym Owner';

  console.log(`🔥 Processing Firebase Auth account for: ${email}`);

  let uid;
  try {
    const existingUser = await auth.getUserByEmail(email);
    console.log(`ℹ️ User ${email} already exists with UID: ${existingUser.uid}. Updating password...`);
    await auth.updateUser(existingUser.uid, {
      password: password,
      displayName: displayName,
      emailVerified: true
    });
    uid = existingUser.uid;
    console.log(`✅ Updated password for ${email}`);
  } catch (err) {
    if (err.code === 'auth/user-not-found') {
      const newUser = await auth.createUser({
        email: email,
        password: password,
        displayName: displayName,
        emailVerified: true
      });
      uid = newUser.uid;
      console.log(`✅ Created new Firebase Auth account! UID: ${uid}`);
    } else {
      console.error(`❌ Firebase Auth error:`, err);
      throw err;
    }
  }

  // Set up user document in Firestore 'users' collection with role 'gym_owner'
  try {
    await db.collection('users').doc(uid).set({
      uid: uid,
      email: email,
      name: displayName,
      role: 'gym_owner',
      branch: 'Mohali, Punjab',
      gymId: 'gym_001',
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`✅ User profile created/updated in Firestore under collection 'users/${uid}'`);
  } catch (dbErr) {
    console.warn(`⚠️ Firestore doc update notice:`, dbErr.message);
  }

  console.log(`\n=======================================================`);
  console.log(`🎉 SUCCESS! Owner Account Ready:`);
  console.log(`   Email    : ${email}`);
  console.log(`   Password : ${password}`);
  console.log(`   UID      : ${uid}`);
  console.log(`=======================================================\n`);
}

createOwnerAccount().then(() => process.exit(0)).catch(err => {
  console.error("Fatal:", err);
  process.exit(1);
});
