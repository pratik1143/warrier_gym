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

const firestore = admin.firestore();
const rootDir = path.resolve(__dirname, '..', '..', '..');
const pythonScript = path.resolve(rootDir, 'warrior-biometric-agent', 'photo_sync_service.py');

interface TerminalUser {
  employeeNo: string;
  name: string;
  hasFace: boolean;
  numOfFace: number;
  faceURL: string | null;
}

function runPython(cmd: string): Promise<any> {
  return new Promise((resolve) => {
    exec(cmd, { cwd: rootDir, maxBuffer: 30 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (stdout) {
        try {
          resolve(JSON.parse(stdout.trim()));
          return;
        } catch (parseErr) {
          console.error('JSON Parse error from python output:', parseErr);
        }
      }
      resolve({ success: false, error: err?.message || stderr || 'Unknown error' });
    });
  });
}

const sleep = (ms: number) => new Promise(res => setTimeout(res, ms));

async function downloadWithRetry(bioId: string, faceURL: string, maxRetries = 3): Promise<any> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const res = await runPython(`py "${pythonScript}" download "${bioId}" "" "${faceURL || ''}"`);
    if (res && res.success && res.base64) {
      return res;
    }
    if (attempt < maxRetries) {
      await sleep(1000);
    }
  }
  return { success: false, error: 'Download failed after retries' };
}

async function main() {
  console.log('====================================================');
  console.log('🚀 PULLING ALL HIKVISION PHOTOS DIRECTLY TO FIRESTORE');
  console.log('====================================================');

  console.log('1. Connecting to Hikvision Terminal (192.168.1.45)...');
  const terminalData = await runPython(`py "${pythonScript}" list`);

  if (!terminalData || !terminalData.success || !Array.isArray(terminalData.users)) {
    console.error('❌ Failed to fetch user list from Hikvision device:', terminalData?.error);
    process.exit(1);
  }

  const terminalUsers: TerminalUser[] = terminalData.users;
  console.log(`✅ Fetched ${terminalUsers.length} users from Hikvision terminal.`);

  const terminalMap = new Map<string, TerminalUser>();
  terminalUsers.forEach(u => {
    const emp = String(u.employeeNo || '').trim().toLowerCase();
    if (emp) {
      terminalMap.set(emp, u);
    }
  });

  console.log('2. Fetching all members from Firestore database...');
  const membersSnap = await firestore.collection('members').get();
  const members = membersSnap.docs.map(d => ({ docId: d.id, ...d.data() }));
  console.log(`✅ Loaded ${members.length} members from Firestore.`);

  let matchedCount = 0;
  let downloadedCount = 0;
  let skippedNoFace = 0;
  let notFoundCount = 0;
  let failedCount = 0;
  const nowIso = new Date().toISOString();

  // Create local backup folder
  const localUploadDir = path.resolve(__dirname, '..', '..', 'public', 'uploads', 'members', 'hikvision');
  if (!fs.existsSync(localUploadDir)) {
    fs.mkdirSync(localUploadDir, { recursive: true });
  }

  console.log('3. Matching members and syncing face photos to Firestore in real-time...\n');

  for (let i = 0; i < members.length; i++) {
    const member = members[i] as any;
    const bioId = String(member.biometricId || member.employeeId || member.hikvisionUserId || member.deviceUserId || '').trim();
    const memName = member.name || 'Member';

    if (!bioId) {
      notFoundCount++;
      continue;
    }

    const machUser = terminalMap.get(bioId.toLowerCase());
    if (!machUser) {
      notFoundCount++;
      continue;
    }

    matchedCount++;
    const hasFace = Boolean(machUser.hasFace || machUser.numOfFace > 0 || machUser.faceURL);
    if (!hasFace) {
      skippedNoFace++;
      console.log(`[${i + 1}/${members.length}] ℹ️ [Bio #${bioId}] ${memName}: Enrolled on machine but has no face photo.`);
      continue;
    }

    const downloadRes = await downloadWithRetry(bioId, machUser.faceURL || '');

    if (!downloadRes || !downloadRes.success || !downloadRes.base64) {
      console.warn(`[${i + 1}/${members.length}] ⚠️ [Bio #${bioId}] Failed to download face photo:`, downloadRes?.error);
      failedCount++;
      continue;
    }

    const base64Data = downloadRes.base64;
    const dataUrl = `data:image/jpeg;base64,${base64Data}`;

    // Save local copy
    try {
      const userDir = path.join(localUploadDir, bioId);
      if (!fs.existsSync(userDir)) fs.mkdirSync(userDir, { recursive: true });
      fs.writeFileSync(path.join(userDir, 'profile.jpg'), Buffer.from(base64Data, 'base64'));
    } catch (e) {}

    // Update Firestore Document directly
    const updatePayload: any = {
      biometricId: bioId,
      employeeId: bioId,
      hikvisionUserId: bioId,
      photoUrl: dataUrl,
      avatarUrl: dataUrl,
      photo: dataUrl,
      avatar: dataUrl,
      photoSource: 'HIKVISION',
      photoSyncedAt: nowIso,
      facePhotoAvailable: true,
      facePhotoSource: 'HIKVISION',
      faceEnrollmentStatus: 'ENROLLED',
      faceEnrolledAt: nowIso,
      updatedAt: nowIso
    };

    try {
      await firestore.collection('members').doc(member.docId).set(updatePayload, { merge: true });
      downloadedCount++;
      console.log(`[${i + 1}/${members.length}] ✅ [Bio #${bioId}] "${memName}" -> Saved to Firestore! (${Math.round((downloadRes.sizeBytes || base64Data.length) / 1024)} KB)`);
    } catch (fsErr: any) {
      console.error(`[${i + 1}/${members.length}] ❌ [Bio #${bioId}] Failed updating Firestore for ${memName}:`, fsErr.message);
      failedCount++;
    }

    // Small throttle between requests to prevent machine overload
    await sleep(250);
  }

  console.log('\n====================================================');
  console.log('🎉 PHOTO SYNC COMPLETED SUMMARY');
  console.log('====================================================');
  console.log(`Total CRM Members:       ${members.length}`);
  console.log(`Terminal Users Found:    ${terminalUsers.length}`);
  console.log(`Matched by Biometric ID: ${matchedCount}`);
  console.log(`Successfully Synced:     ${downloadedCount}`);
  console.log(`Skipped (No Face):       ${skippedNoFace}`);
  console.log(`Not Found on Machine:    ${notFoundCount}`);
  console.log(`Failed Downloads:        ${failedCount}`);
  console.log('====================================================\n');

  process.exit(0);
}

main().catch((e) => {
  console.error('Fatal error running photo sync:', e);
  process.exit(1);
});
