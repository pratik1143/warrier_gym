import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import { exec } from 'child_process';

const serviceAccountPath = path.join(__dirname, '..', '..', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const rootDir = path.resolve(__dirname, '..', '..', '..');
const scriptPath = path.resolve(rootDir, 'warrior-biometric-agent', 'photo_sync_service.py');
const publicUploadsDir = path.resolve(__dirname, '..', '..', 'public', 'uploads', 'members', 'hikvision');

// Ensure upload directory exists
if (!fs.existsSync(publicUploadsDir)) {
  fs.mkdirSync(publicUploadsDir, { recursive: true });
}

function execPromise(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: rootDir, maxBuffer: 30 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        return reject(err);
      }
      resolve(stdout);
    });
  });
}

async function syncAllPhotos() {
  console.log('🚀 [Photo Sync] Starting 1-Time Hikvision Bulk Photo Sync to Firestore & Storage...');

  // 1. Fetch Terminal Users
  console.log('📡 [Photo Sync] Querying Hikvision terminal (192.168.1.45) for all enrolled users...');
  let terminalUsers: any[] = [];
  try {
    const listStdout = await execPromise(`py "${scriptPath}" list`);
    const parsed = JSON.parse(listStdout.trim());
    terminalUsers = parsed.users || [];
    console.log(`✅ [Photo Sync] Found ${terminalUsers.length} total users in Hikvision device.`);
  } catch (err: any) {
    console.error('❌ [Photo Sync] Failed to fetch users from Hikvision terminal:', err.message);
    return;
  }

  // Fast lookup map
  const terminalMap = new Map<string, any>();
  terminalUsers.forEach(u => {
    const empNo = String(u.employeeNo || u.userId || '').trim().toLowerCase();
    if (empNo) {
      terminalMap.set(empNo, u);
    }
  });

  // 2. Fetch CRM Members
  console.log('📥 [Photo Sync] Fetching all members from Firestore...');
  const membersSnap = await db.collection('members').get();
  console.log(`📋 [Photo Sync] Found ${membersSnap.docs.length} members in Firestore.`);

  let syncedCount = 0;
  let skippedNoFace = 0;
  let notFoundOnTerminal = 0;
  let failedDownloads = 0;
  const nowIso = new Date().toISOString();

  for (const doc of membersSnap.docs) {
    const member = doc.data();
    const memId = doc.id;
    const rawBioId = String(member.biometricId || member.employeeId || member.hikvisionUserId || member.deviceUserId || '').trim();
    const memName = member.name || 'Member';

    if (!rawBioId) {
      continue;
    }

    const machUser = terminalMap.get(rawBioId.toLowerCase());
    if (!machUser) {
      notFoundOnTerminal++;
      continue;
    }

    const hasFace = Boolean(machUser.hasFace || (machUser.numOfFace && machUser.numOfFace > 0) || machUser.faceURL);
    if (!hasFace) {
      skippedNoFace++;
      continue;
    }

    // Download photo
    try {
      const userDir = path.join(publicUploadsDir, rawBioId);
      if (!fs.existsSync(userDir)) {
        fs.mkdirSync(userDir, { recursive: true });
      }
      const localFilePath = path.join(userDir, 'profile.jpg');

      const downloadCmd = `py "${scriptPath}" download "${rawBioId}" "${localFilePath.replace(/\\/g, '\\\\')}" "${machUser.faceURL || ''}"`;
      const dlStdout = await execPromise(downloadCmd);
      const dlResult = JSON.parse(dlStdout.trim());

      if (dlResult && dlResult.success && fs.existsSync(localFilePath)) {
        const fileSizeBytes = fs.statSync(localFilePath).size;
        const photoUrl = `http://localhost:5000/uploads/members/hikvision/${rawBioId}/profile.jpg`;

        const updatePayload: any = {
          photoUrl: photoUrl,
          photo: photoUrl,
          avatarUrl: photoUrl,
          avatar: photoUrl,
          photoStoragePath: `members/hikvision/${rawBioId}/profile.jpg`,
          photoSource: 'HIKVISION',
          photoSyncedAt: nowIso,
          facePhotoAvailable: true,
          facePhotoSource: 'HIKVISION',
          faceEnrollmentStatus: 'ENROLLED',
          faceEnrolledAt: nowIso,
          updatedAt: nowIso
        };

        await db.collection('members').doc(memId).set(updatePayload, { merge: true });
        syncedCount++;
        console.log(`✅ [${syncedCount}] Synced photo for ${memName} (Bio #${rawBioId}) - ${fileSizeBytes} bytes`);
      } else {
        failedDownloads++;
        console.warn(`⚠️ Failed downloading photo for ${memName} (Bio #${rawBioId}):`, dlResult?.error);
      }
    } catch (dlErr: any) {
      failedDownloads++;
      console.error(`❌ Error downloading photo for ${memName} (Bio #${rawBioId}):`, dlErr.message);
    }
  }

  console.log('\n===================================================');
  console.log('🎉 [Photo Sync] Bulk Hikvision Photo Sync Complete!');
  console.log(`   - Total Firestore Members: ${membersSnap.docs.length}`);
  console.log(`   - Total Hikvision Users:   ${terminalUsers.length}`);
  console.log(`   - Photos Synced to DB:     ${syncedCount}`);
  console.log(`   - Skipped (No Face):       ${skippedNoFace}`);
  console.log(`   - Not Found on Machine:    ${notFoundOnTerminal}`);
  console.log(`   - Failed Downloads:        ${failedDownloads}`);
  console.log('===================================================\n');
}

syncAllPhotos().catch(console.error);
