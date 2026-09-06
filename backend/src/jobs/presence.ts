import { getFirestoreDb } from '../firebase';
import * as admin from 'firebase-admin';

let isRunning = false;

export const runPresenceCheckoutCheck = async () => {
  if (isRunning) return;
  isRunning = true;

  try {
    const firestore = getFirestoreDb();
    if (!firestore) {
      isRunning = false;
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();

    // Query all active inside members and filter expired expectedExits in memory to avoid Firestore composite index requirement
    const snapshot = await firestore.collection('gym_presence')
      .where('inside', '==', true)
      .get();

    const matchingDocs = snapshot.docs.filter(doc => {
      const data = doc.data();
      return data.expectedExit && data.expectedExit <= nowIso;
    });

    if (matchingDocs.length === 0) {
      isRunning = false;
      return;
    }

    // Process all checkouts in a batch
    const batch = firestore.batch();
    const checkedOutLogs: any[] = [];

    matchingDocs.forEach(doc => {
      const data = doc.data();
      const exitTime = nowIso;
      const entryTimeDate = new Date(data.entryTime);
      const exitTimeDate = now;
      const insideDurationMins = Math.floor((exitTimeDate.getTime() - entryTimeDate.getTime()) / 60000);

      // 1. Update gym_presence
      batch.update(doc.ref, {
        inside: false,
        exitTime: exitTime,
        insideDurationMins: insideDurationMins
      });

      // 2. Add an auto-checkout event to attendance_logs (this will trigger the frontend popup)
      const logRef = firestore.collection('attendance_logs').doc();
      const logData = {
        memberId: data.memberId,
        memberName: data.memberName,
        branch: data.branch,
        checkIn: data.entryTime,
        checkOut: exitTime,
        method: 'auto_checkout',
        status: 'auto_checkout', // We use this specific status for the frontend toast
        createdAt: exitTime
      };
      batch.set(logRef, logData);
      checkedOutLogs.push(logData);
    });

    await batch.commit();

    console.log(`[Auto Checkout] Automatically checked out ${matchingDocs.length} members.`);
  } catch (error) {
    console.error('[Auto Checkout Error]', error);
  } finally {
    isRunning = false;
  }
};

export const startPresenceJob = () => {
  // Run every 1 minute
  setInterval(runPresenceCheckoutCheck, 60000);
  console.log('[Cron Job] gym_presence auto-checkout checker started.');
};
