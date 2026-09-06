import { admin, isFirebaseInitialized } from '../firebase';
import { whatsappService } from '../services/whatsapp.service';

export const initQueueJob = () => {
  console.log('[WhatsApp Queue Worker] Starting background worker (30s interval)...');
  
  setInterval(async () => {
    if (!isFirebaseInitialized || !admin) return;

    try {
      const firestore = admin.firestore();
      const now = Date.now();

      // Read whatsappQueue for Status == 'Pending' (avoid composite index requirement by filtering timestamp locally)
      const snap = await firestore.collection('whatsappQueue')
        .where('status', '==', 'Pending')
        .get();

      if (snap.empty) return;

      const pendingDocs = snap.docs.filter(doc => {
        const data = doc.data();
        return (data.scheduledTimestamp || 0) <= now;
      });

      if (pendingDocs.length === 0) return;

      console.log(`[WhatsApp Queue Worker] Processing ${pendingDocs.length} pending message(s)...`);

      for (const doc of pendingDocs) {
        const data = doc.data();
        const docRef = firestore.collection('whatsappQueue').doc(doc.id);
        const retryCount = data.retryCount || 0;

        // Try sending message
        const success = await whatsappService.sendMessage(data.phone, data.message);

        const timestampStr = new Date().toISOString();

        if (success) {
          // Update queue document
          await docRef.update({
            status: 'Sent',
            sentAt: timestampStr,
            updatedAt: timestampStr
          });

          // Write delivered log
          await firestore.collection('whatsapp_logs').add({
            phone: data.phone,
            message: data.message,
            status: 'Delivered',
            timestamp: timestampStr,
            retryCount
          });
        } else {
          const nextRetry = retryCount + 1;
          const nextStatus = nextRetry >= 3 ? 'Failed' : 'Pending';

          await docRef.update({
            status: nextStatus,
            retryCount: nextRetry,
            updatedAt: timestampStr
          });

          // Write failure/retry log
          await firestore.collection('whatsapp_logs').add({
            phone: data.phone,
            message: data.message,
            status: nextStatus === 'Failed' ? 'Failed' : 'Retry',
            timestamp: timestampStr,
            retryCount: nextRetry
          });
        }
      }
    } catch (err) {
      console.error('[WhatsApp Queue Worker] Error in background cycle:', err);
    }
  }, 30000); // 30 seconds interval
};
