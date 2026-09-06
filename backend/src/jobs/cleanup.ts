import cron from 'node-cron';
import { admin, isFirebaseInitialized } from '../firebase';

export const startCleanupJob = () => {
  // Run daily at 12:05 AM
  cron.schedule('5 0 * * *', async () => {
    console.log('[Cleanup Job] Running daily Firebase Spark optimization cleanup...');
    
    if (!isFirebaseInitialized || !admin) {
      console.log('[Cleanup Job] Firebase not initialized, skipping cleanup.');
      return;
    }

    const firestore = admin.firestore();
    const batch = firestore.batch();
    
    try {
      // 1. Delete attendance_logs older than 24 hours
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const logsRef = firestore.collection('attendance_logs');
      const oldLogs = await logsRef.where('checkIn', '<', yesterday).get();
      
      let deletedCount = 0;
      oldLogs.docs.forEach(doc => {
        batch.delete(doc.ref);
        deletedCount++;
      });
      
      // 2. Reset dashboard analytics 'todayAttendance' to 0
      const analyticsRef = firestore.collection('analytics').doc('dashboard');
      batch.set(analyticsRef, { todayAttendance: 0 }, { merge: true });
      
      // Commit all deletions and resets
      await batch.commit();
      
      console.log(`[Cleanup Job] Successfully deleted ${deletedCount} old attendance logs and reset dashboard counters.`);
    } catch (error) {
      console.error('[Cleanup Job] Error during cleanup:', error);
    }
  });
  
  console.log('[Cleanup Job] Scheduled to run daily at 12:05 AM.');
};
