import { db } from '@/lib/firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';

/**
 * Safe Migration for Existing Billing Records (Requirement 11)
 *
 * For every payment transaction:
 * IF memberId exists AND memberPhone is missing / null / empty / "No Phone":
 *   lookup member in Firestore by memberId
 *   IF member.phone exists:
 *     update transaction.memberPhone = member.phone
 *
 * Does NOT modify: amount, invoice number, payment method, billing date, or status.
 * Does NOT create duplicate records.
 */
export async function migrateMissingBillingPhones(): Promise<{ migratedCount: number; checkedCount: number }> {
  let migratedCount = 0;
  let checkedCount = 0;

  try {
    const paymentsSnap = await getDocs(collection(db, 'payments'));
    const membersSnap = await getDocs(collection(db, 'members'));

    // Build fast lookup map for members by id, memberId, and uid
    const memberMap = new Map<string, any>();
    membersSnap.docs.forEach((mDoc) => {
      const data: Record<string, any> = { id: mDoc.id, ...mDoc.data() };
      memberMap.set(mDoc.id, data);
      if (data.memberId) {
        memberMap.set(String(data.memberId).trim(), data);
      }
      if (data.uid) {
        memberMap.set(String(data.uid).trim(), data);
      }
    });

    for (const pDoc of paymentsSnap.docs) {
      checkedCount++;
      const pData: Record<string, any> = pDoc.data() || {};
      const memberId = pData.memberId ? String(pData.memberId).trim() : '';

      const currentPhone = String(pData.memberPhone || '').trim();
      const isMissingPhone = !currentPhone || currentPhone.toLowerCase() === 'no phone';

      if (memberId && isMissingPhone) {
        const member = memberMap.get(memberId);
        const resolvedPhone = member?.phone || member?.mobile || '';

        if (resolvedPhone && String(resolvedPhone).trim()) {
          const cleanPhone = String(resolvedPhone).trim();
          await updateDoc(doc(db, 'payments', pDoc.id), {
            memberPhone: cleanPhone,
            updatedAt: new Date().toISOString(),
          });
          migratedCount++;
        }
      }

    }

    if (migratedCount > 0) {
      console.log(`[Billing Migration] Successfully repaired missing member phone on ${migratedCount} payments.`);
    }
  } catch (err) {
    console.warn('[Billing Migration] Notice during billing phone migration:', err);
  }

  return { migratedCount, checkedCount };
}
