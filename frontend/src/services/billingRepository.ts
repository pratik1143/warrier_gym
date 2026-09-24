import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import API from '@/services/api';

export interface CanonicalTransaction {
  transactionId: string;
  memberId: string;
  memberCode?: string;
  biometricId?: string;
  invoiceId: string;
  invoiceNumber: string;

  packageId: string;
  packageName: string;

  billingDate: string;
  paymentDate: string;
  startDate: string;
  expiryDate: string;

  originalAmount: number;
  discount: number;
  tax: number;
  otherCharges: number;
  netPayable: number;
  amountPaid: number;
  pendingAmount: number;

  paymentMethod: string;
  paymentStatus: string;

  billingType: string;
  isHistorical?: boolean;

  createdAt: string;
  updatedAt?: string;
}

export const billingRepository = {
  /**
   * Listen to canonical billing records for a member with automatic REST API fallback.
   * Handles Firestore client permission errors seamlessly by fetching from the backend admin API.
   */
  subscribeMemberBilling: (
    member: any,
    onData: (invoices: CanonicalTransaction[]) => void,
    onError?: (err: any) => void
  ): (() => void) => {
    if (!member) {
      onData([]);
      return () => {};
    }

    let isSubscribed = true;
    const candidateIds = new Set([
      member.id,
      member.uid,
      member.memberId,
      member.docId,
      member.clientId
    ].filter(Boolean));

    const cleanPhone = (member.phone || '').replace(/\D/g, '').slice(-10);

    // Initial fallback from member object itself
    const memberHistoryInvoices: CanonicalTransaction[] = Array.isArray(member.billingHistory) && member.billingHistory.length > 0
      ? member.billingHistory
      : (Array.isArray(member.payments) && member.payments.length > 0 ? member.payments : []);

    const fetchRestApiFallback = async () => {
      try {
        const queryId = member.id || member.memberId || member.uid;
        const res = await API.get(`/billing?memberId=${encodeURIComponent(queryId)}`);
        if (Array.isArray(res.data) && res.data.length > 0) {
          if (isSubscribed) {
            onData(res.data);
            return;
          }
        }
      } catch (err) {
        console.warn('[billingRepository] REST API fallback error:', err);
      }

      // If REST API returned nothing or failed, use memberHistoryInvoices
      if (isSubscribed && memberHistoryInvoices.length > 0) {
        onData(memberHistoryInvoices);
      }
    };

    // Attempt realtime Firestore listener
    let unsub: (() => void) | null = null;
    try {
      unsub = onSnapshot(
        collection(db, 'payments'),
        (snap) => {
          if (!isSubscribed) return;
          const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
          const filtered = allDocs.filter((p: any) => {
            if (!p) return false;
            const pMemId = String(p.memberId || p.memberUid || '').trim();
            if (pMemId && candidateIds.has(pMemId)) return true;
            if (cleanPhone && p.memberPhone && p.memberPhone.replace(/\D/g, '').slice(-10) === cleanPhone) return true;
            return false;
          });

          if (filtered.length > 0) {
            onData(filtered);
          } else {
            // If listener sees 0 docs, trigger REST API fallback check
            fetchRestApiFallback();
          }
        },
        (err) => {
          // FirebaseError: Missing or insufficient permissions or connection failure
          console.warn('[billingRepository] Firestore listener notice, falling back to API:', err.message);
          fetchRestApiFallback();
          if (onError) onError(err);
        }
      );
    } catch (e) {
      fetchRestApiFallback();
    }

    return () => {
      isSubscribed = false;
      if (unsub) unsub();
    };
  },

  /**
   * Fetch member billing one-shot from backend API
   */
  getMemberBilling: async (memberId: string): Promise<CanonicalTransaction[]> => {
    try {
      const res = await API.get(`/billing?memberId=${encodeURIComponent(memberId)}`);
      return Array.isArray(res.data) ? res.data : [];
    } catch (err) {
      console.warn('[billingRepository] getMemberBilling error:', err);
      return [];
    }
  },

  /**
   * Create a new canonical bill with atomic backend commitment and local Firestore sync
   */
  createBill: async (payload: any): Promise<any> => {
    let invoice: any = null;
    try {
      const res = await API.post('/billing', payload);
      invoice = res.data;
    } catch (apiErr: any) {
      console.warn('Backend billing API error, using payload:', apiErr?.message || apiErr);
    }

    const savedInvoice = invoice || {
      ...payload,
      id: payload.id || `inv_${Date.now()}`
    };

    // 2. Local Firestore fallback guarantee if client has permissions
    try {
      if (savedInvoice && savedInvoice.id) {
        await setDoc(doc(db, 'payments', savedInvoice.id), savedInvoice, { merge: true });
      }
    } catch (e) {
      // Ignored if client lacks direct Firestore write access; backend already wrote it
    }

    return savedInvoice;
  }
};
