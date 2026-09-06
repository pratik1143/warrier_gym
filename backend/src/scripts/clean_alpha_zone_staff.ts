import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

const serviceAccountPath = path.join(__dirname, '..', '..', 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ Service account key not found at:", serviceAccountPath);
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function cleanAlphaZoneStaff() {
  console.log("\n=======================================================");
  console.log("   WARRIOR GYM — STAFF DATABASE CLEANUP & ISOLATION    ");
  console.log("=======================================================\n");
  console.log(`Target Firebase Project: ${serviceAccount.project_id}\n`);

  // 1. Ensure Manager Account Exists
  const managerDocId = 'emp_manager_001';
  const managerPayload = {
    id: managerDocId,
    employeeId: 'TWG-EMP-0001',
    biometricId: 10001,
    name: 'Manager',
    phone: '9876543210',
    email: 'manager@thewarriorgym.in',
    role: 'MANAGER',
    department: 'Management',
    designation: 'General Manager',
    branch: 'The Warrior Gym',
    address: 'The Warrior Gym Headquarters',
    status: 'Active',
    todayStatus: 'Present',
    currentStatus: 'Inside',
    lastPunch: new Date().toISOString(),
    joiningDate: '2026-01-01',
    isDeleted: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  console.log("STEP 1: Preserving Manager Account in 'employees' collection...");
  await db.collection('employees').doc(managerDocId).set(managerPayload, { merge: true });
  console.log("✅ Manager account preserved (ID: emp_manager_001, Role: MANAGER).");

  // 2. Purge Old Employees (excluding Manager)
  console.log("\nSTEP 2: Purging old Alpha Zone employee records from 'employees' collection...");
  const employeesSnap = await db.collection('employees').get();
  let empDeletedCount = 0;

  for (const doc of employeesSnap.docs) {
    const data = doc.data();
    const nameLower = String(data.name || '').trim().toLowerCase();
    const isManager = doc.id === managerDocId || nameLower === 'manager' || data.email === 'manager@thewarriorgym.in';

    if (!isManager) {
      await doc.ref.delete();
      empDeletedCount++;
      console.log(` - Deleted employee doc: ${doc.id} (${data.name || 'Unnamed'})`);
    }
  }
  console.log(`✅ Deleted ${empDeletedCount} old employee records.`);

  // 3. Purge Trainers Collection completely
  console.log("\nSTEP 3: Purging old Alpha Zone trainer records from 'trainers' collection...");
  const trainersSnap = await db.collection('trainers').get();
  let trnDeletedCount = 0;

  for (const doc of trainersSnap.docs) {
    const data = doc.data();
    const nameLower = String(data.name || '').trim().toLowerCase();
    const isManager = nameLower === 'manager';

    if (!isManager) {
      await doc.ref.delete();
      trnDeletedCount++;
      console.log(` - Deleted trainer doc: ${doc.id} (${data.name || 'Unnamed'})`);
    }
  }
  console.log(`✅ Deleted ${trnDeletedCount} old trainer records.`);

  // 4. Purge Staff Collection
  console.log("\nSTEP 4: Purging old staff records from 'staff' collection...");
  const staffSnap = await db.collection('staff').get();
  let staffDeletedCount = 0;

  for (const doc of staffSnap.docs) {
    const data = doc.data();
    const nameLower = String(data.name || '').trim().toLowerCase();
    const isManager = doc.id === managerDocId || nameLower === 'manager';

    if (!isManager) {
      await doc.ref.delete();
      staffDeletedCount++;
      console.log(` - Deleted staff doc: ${doc.id} (${data.name || 'Unnamed'})`);
    }
  }
  console.log(`✅ Deleted ${staffDeletedCount} old staff records.`);

  // 5. Clean up Stale Trainer References in 'members'
  console.log("\nSTEP 5: Sanitizing trainer references in 'members' collection...");
  const membersSnap = await db.collection('members').get();
  let membersUpdatedCount = 0;

  for (const doc of membersSnap.docs) {
    const data = doc.data();
    const trainerName = String(data.trainer || data.trainerName || '').trim();
    const hasDeletedTrainerRef = trainerName !== '' && trainerName.toLowerCase() !== 'manager' && trainerName.toLowerCase() !== 'unassigned';

    if (hasDeletedTrainerRef) {
      await doc.ref.update({
        trainer: 'Unassigned',
        trainerName: 'Unassigned',
        trainerId: 'null',
        updatedAt: new Date().toISOString()
      });
      membersUpdatedCount++;
      console.log(` - Sanitized trainer for member: ${data.name || doc.id} (Old trainer: '${trainerName}' → 'Unassigned')`);
    }
  }
  console.log(`✅ Sanitized trainer references for ${membersUpdatedCount} member records.`);

  // 6. Clean up Enquiries & Followups staff assignments
  console.log("\nSTEP 6: Sanitizing staff assignments in 'enquiries' & 'followups'...");
  const enquiriesSnap = await db.collection('enquiries').get();
  for (const doc of enquiriesSnap.docs) {
    const data = doc.data();
    if (data.assignedTo && data.assignedTo !== 'Manager') {
      await doc.ref.update({ assignedTo: 'Manager' });
    }
  }

  const followupsSnap = await db.collection('followups').get();
  for (const doc of followupsSnap.docs) {
    const data = doc.data();
    if (data.assignedTo && data.assignedTo !== 'Manager') {
      await doc.ref.update({ assignedTo: 'Manager' });
    }
  }
  console.log("✅ Enquiries and Follow-ups assigned staff sanitized to 'Manager'.");

  // 7. Verify Final Counts
  const finalEmpSnap = await db.collection('employees').get();
  const finalTrnSnap = await db.collection('trainers').get();

  console.log("\n=======================================================");
  console.log("🎉 WARRIOR GYM STAFF DATABASE CLEANUP COMPLETE!");
  console.log(`   Total Employees in Database: ${finalEmpSnap.size}`);
  console.log(`   Total Trainers in Database:  ${finalTrnSnap.size}`);
  console.log("=======================================================\n");

  if (finalEmpSnap.size === 1 && finalTrnSnap.size === 0) {
    console.log("✅ SUCCESS: Database has exactly 1 Manager and 0 Trainers!");
  } else {
    console.warn(`⚠️ Warning: Employee count is ${finalEmpSnap.size}, Trainer count is ${finalTrnSnap.size}`);
  }
}

cleanAlphaZoneStaff().catch(err => {
  console.error("Fatal Cleanup Error:", err);
  process.exit(1);
});
