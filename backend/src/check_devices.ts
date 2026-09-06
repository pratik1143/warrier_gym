import { db } from './firebase';

async function diag() {
  try {
    console.log('Querying members...');
    const members = await db.getMembers();
    console.log(`Found ${members.length} members.`);

    console.log('Querying devices...');
    const devices = await db.getDevices();
    console.log('Devices:', JSON.stringify(devices, null, 2));

    console.log('Querying device logs...');
    const logs = await db.getDeviceLogs();
    console.log(`Found ${logs.length} logs.`);
  } catch (err: any) {
    console.error('Firestore Diagnostic Failed:', err);
  }
  process.exit(0);
}

diag();
