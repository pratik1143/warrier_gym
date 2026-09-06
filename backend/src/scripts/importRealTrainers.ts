/**
 * importRealTrainers.ts
 * ─────────────────────────────────────────────────────────────────
 * One-time idempotent import of the 6 real The Warrior Gym trainers
 * into the Firestore `trainers` collection.
 *
 * Safety:
 *  - Uses biometricId as the uniqueness key (not phone / name).
 *  - If a trainer with the same biometricId already exists →
 *    MERGES/updates only fields that are currently blank.
 *  - Running this multiple times produces exactly 6 records.
 *
 * Run:
 *  npx ts-node -e "require('./src/scripts/importRealTrainers')"
 * OR inside the backend package:
 *  npx ts-node src/scripts/importRealTrainers.ts
 * ─────────────────────────────────────────────────────────────────
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

// ── Firebase Admin init (reuses the same env var as the backend) ──────
function initAdmin(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const serviceAccountJsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  // Candidate paths to look for service account file
  const fileCandidates = [
    serviceAccountPath,
    path.resolve(__dirname, '../../../serviceAccountKey.json'),
    path.resolve(__dirname, '../../serviceAccountKey.json'),
    path.resolve(process.cwd(), 'serviceAccountKey.json'),
  ].filter(Boolean) as string[];

  if (serviceAccountJsonRaw) {
    const sa = JSON.parse(serviceAccountJsonRaw);
    return admin.initializeApp({ credential: admin.credential.cert(sa) });
  }

  const saFile = fileCandidates.find(p => fs.existsSync(p));
  if (saFile) {
    const sa = JSON.parse(fs.readFileSync(saFile, 'utf8'));
    return admin.initializeApp({ credential: admin.credential.cert(sa) });
  }

  return admin.initializeApp({ credential: admin.credential.applicationDefault() });
}


// ── Real trainer data (source of truth from gym records) ──────────────
const REAL_TRAINERS = [
  {
    biometricId: '10021',
    name: 'Sourav Arora',
    branch: 'The Warrior Gym',
    phone: '7973649709',
    email: '',
    address: '',
    photo: '',
    document: '',
    status: 'active',
  },
  {
    biometricId: '10012',
    name: 'Deepak',
    branch: 'The Warrior Gym',
    phone: '8196852386',
    email: '',
    address: '',
    photo: '',
    document: '',
    status: 'active',
  },
  {
    biometricId: '10009',
    name: 'Kuldeep',
    branch: 'The Warrior Gym',
    phone: '8629841471',
    email: 'kuldeep86298@gmail.com',
    address: '',
    photo: '',
    document: '',
    status: 'active',
  },
  {
    biometricId: '10008',
    name: 'Arshdeep Singh',
    branch: 'The Warrior Gym',
    phone: '9915866576',
    email: '',
    address: '',
    photo: '',
    document: '',
    status: 'active',
  },
  {
    biometricId: '10005',
    name: 'Achhar Pal',
    branch: 'The Warrior Gym',
    phone: '9592691190',
    email: '',
    address: 'kaimbwala chd',
    photo: '',
    document: '',
    status: 'active',
  },
  {
    biometricId: '10003',
    name: 'Abc',
    branch: 'The Warrior Gym',
    phone: '7884977777',
    email: '',
    address: '',
    photo: '',
    document: '',
    status: 'active',
  },
];

// ── Main import logic ──────────────────────────────────────────────────
async function importTrainers() {
  initAdmin();
  const firestore = admin.firestore();
  const col = firestore.collection('trainers');

  console.log('\n🚀  Starting The Warrior Gym Trainer Import');
  console.log('═'.repeat(55));

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const trainer of REAL_TRAINERS) {
    // ── Check if a trainer with this biometricId already exists ──
    const existingSnap = await col
      .where('biometricId', '==', trainer.biometricId)
      .limit(1)
      .get();

    if (!existingSnap.empty) {
      // Trainer already exists — merge only blank fields to avoid overwriting real data
      const existingDoc = existingSnap.docs[0];
      const existingData = existingDoc.data();

      const mergePayload: Record<string, any> = {};
      if (!existingData.name && trainer.name) mergePayload.name = trainer.name;
      if (!existingData.branch && trainer.branch) mergePayload.branch = trainer.branch;
      if (!existingData.phone && trainer.phone) mergePayload.phone = trainer.phone;
      if (!existingData.email && trainer.email) mergePayload.email = trainer.email;
      if (!existingData.address && trainer.address) mergePayload.address = trainer.address;
      if (!existingData.status) mergePayload.status = trainer.status;

      if (Object.keys(mergePayload).length > 0) {
        await existingDoc.ref.update({ ...mergePayload, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        console.log(`  ↻ MERGED   biometricId=${trainer.biometricId} (${trainer.name}) — updated: ${Object.keys(mergePayload).join(', ')}`);
        updated++;
      } else {
        console.log(`  ✓ EXISTS   biometricId=${trainer.biometricId} (${trainer.name}) — no changes needed`);
        skipped++;
      }
      continue;
    }

    // ── Create new trainer document ───────────────────────────────
    const newTrainer = {
      biometricId: trainer.biometricId,
      name: trainer.name,
      branch: trainer.branch,
      phone: trainer.phone,
      email: trainer.email,
      address: trainer.address,
      photo: trainer.photo,
      document: trainer.document,
      status: trainer.status,

      // Default fields expected by the existing trainer schema
      specialization: '',
      experience: 0,
      rating: 0,
      members: 0,
      sessions: 0,
      salary: 0,
      certifications: [],
      bio: '',
      joiningDate: new Date().toISOString().split('T')[0],
      instagram: '',
      achievements: '',

      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      importedFrom: 'importRealTrainers.ts',
    };

    const docRef = await col.add(newTrainer);
    console.log(`  ✚ CREATED  biometricId=${trainer.biometricId} (${trainer.name}) → docId=${docRef.id}`);
    created++;
  }

  console.log('═'.repeat(55));
  console.log(`\n✅  Import complete`);
  console.log(`   Created : ${created}`);
  console.log(`   Updated : ${updated}`);
  console.log(`   Skipped : ${skipped}`);
  console.log(`   Total   : ${REAL_TRAINERS.length}\n`);
}

importTrainers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('\n❌  Import failed:', err);
    process.exit(1);
  });
