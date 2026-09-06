import { db } from './firebase';

async function fix() {
  try {
    const devices = await db.getDevices();
    for (const d of devices) {
      if (d.port === 43704370 || d.port > 65535) {
        console.log(`Fixing device: ${d.deviceName} port ${d.port} -> 4370`);
        await db.updateDevice(d.id, { port: 4370 });
      }
    }
    console.log('Port cleanup completed.');
  } catch (err) {
    console.error('Failed to cleanup ports:', err);
  }
  process.exit(0);
}

fix();
