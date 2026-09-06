import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');

if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ ERROR: serviceAccountKey.json not found at:", serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

console.log("🔥 Initializing Firebase Admin SDK for project:", serviceAccount.project_id);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: `${serviceAccount.project_id}.firebasestorage.app`
});

async function runFirebaseVerification() {
  console.log("\n=======================================================");
  console.log("   THE WARRIOR GYM — FIREBASE CONNECTION TEST SUITE   ");
  console.log("=======================================================\n");

  let passes = 0;
  let fails = 0;

  // 1. Backend Firebase Admin SDK Test
  try {
    const apps = admin.apps;
    if (apps.length > 0 && apps[0]?.name) {
      console.log("✅ [PASS] Backend Firebase Admin SDK: VALID & INITIALIZED");
      passes++;
    } else {
      throw new Error("Admin app not initialized");
    }
  } catch (err: any) {
    console.error("❌ [FAIL] Backend Firebase Admin SDK:", err.message);
    fails++;
  }

  // 2. Firestore WRITE Test
  const db = admin.firestore();
  const testDocRef = db.collection('settings').doc('connection_health_check');
  try {
    await testDocRef.set({
      gymName: "The Warrior Gym",
      status: "CONNECTED",
      verifiedAt: new Date().toISOString(),
      testKey: "WARRIOR_HEALTH_CHECK_PASS"
    });
    console.log("✅ [PASS] Firestore WRITE: SUCCESSFUL (Written to settings/connection_health_check)");
    passes++;
  } catch (err: any) {
    if (err.message.includes('Cloud Firestore API has not been used') || err.message.includes('PERMISSION_DENIED')) {
      console.warn("⚠️ [ACTION REQUIRED] Firestore Database: Needs one-click creation in Firebase Console.");
      console.warn("👉 Enable at: https://console.firebase.google.com/project/" + serviceAccount.project_id + "/firestore");
    } else {
      console.error("❌ [FAIL] Firestore WRITE:", err.message);
    }
    fails++;
  }

  // 3. Firestore READ Test
  try {
    const snap = await testDocRef.get();
    if (snap.exists && snap.data()?.testKey === "WARRIOR_HEALTH_CHECK_PASS") {
      console.log("✅ [PASS] Firestore READ: SUCCESSFUL (Retrieved verifiedAt: " + snap.data()?.verifiedAt + ")");
      passes++;
    } else {
      throw new Error("Document read back invalid or missing");
    }
  } catch (err: any) {
    if (!err.message.includes('Cloud Firestore API has not been used')) {
      console.error("❌ [FAIL] Firestore READ:", err.message);
    }
    fails++;
  }

  // 4. Firebase Authentication Check
  try {
    const listUsers = await admin.auth().listUsers(1);
    console.log(`✅ [PASS] Firebase Auth: OPERATIONAL (${listUsers.users.length} registered users found)`);
    passes++;
  } catch (err: any) {
    if (err.message.includes('no configuration corresponding')) {
      console.warn("⚠️ [ACTION REQUIRED] Firebase Auth: Click 'Get Started' in Firebase Console.");
      console.warn("👉 Enable at: https://console.firebase.google.com/project/" + serviceAccount.project_id + "/authentication");
    } else {
      console.error("❌ [FAIL] Firebase Auth:", err.message);
    }
    fails++;
  }

  // 5. Firebase Storage Bucket Test
  try {
    const bucket = admin.storage().bucket();
    const file = bucket.file('health_check.txt');
    await file.save('THE WARRIOR GYM FIREBASE STORAGE ONLINE', { contentType: 'text/plain' });
    console.log("✅ [PASS] Firebase Storage WRITE: SUCCESSFUL (health_check.txt uploaded)");
    
    const [exists] = await file.exists();
    if (exists) {
      console.log("✅ [PASS] Firebase Storage READ: SUCCESSFUL (health_check.txt verified)");
      passes++;
    }
  } catch (err: any) {
    console.warn("⚠️ [ACTION REQUIRED] Firebase Storage: Click 'Get Started' in Firebase Console.");
    console.warn("👉 Enable at: https://console.firebase.google.com/project/" + serviceAccount.project_id + "/storage");
  }

  console.log("\n-------------------------------------------------------");
  console.log(`STATUS: Service Account Authenticated for project '${serviceAccount.project_id}'`);
  console.log("-------------------------------------------------------\n");
}

runFirebaseVerification().catch(err => {
  console.error("Fatal Verification Error:", err);
});
