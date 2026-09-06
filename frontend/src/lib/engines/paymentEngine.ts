import { db } from '@/lib/firebase';
import { updateDoc, doc } from 'firebase/firestore';

export const paymentEngine = {
  calculateOutstandingAmount: (invoiceAmount: number, paidAmount: number): number => {
    const outstanding = (invoiceAmount || 0) - (paidAmount || 0);
    return Math.max(0, outstanding); // Prevent negative outstanding
  },

  calculatePaymentStatus: (invoiceAmount: number, paidAmount: number): 'PAID' | 'PARTIAL' | 'PENDING' => {
    const outstanding = paymentEngine.calculateOutstandingAmount(invoiceAmount, paidAmount);
    if (paidAmount === 0 && invoiceAmount > 0) return 'PENDING';
    if (outstanding <= 0) return 'PAID';
    return 'PARTIAL';
  },

  selfHealPaymentData: async (invoice: any) => {
    if (!invoice || !invoice.id) return invoice;

    const invoiceTotal = Number(invoice.amount || 0) + Number(invoice.gst || 0);
    const paidTotal = Number(invoice.paid || 0);
    
    const computedOutstanding = paymentEngine.calculateOutstandingAmount(invoiceTotal, paidTotal);
    const computedStatus = paymentEngine.calculatePaymentStatus(invoiceTotal, paidTotal);
    
    let needsUpdate = false;
    const updates: any = {};

    if (invoice.pendingAmount !== computedOutstanding) {
      updates.pendingAmount = computedOutstanding;
      needsUpdate = true;
    }

    // Match uppercase for our strict enum vs lowercase stored format if needed
    const normalizedStoredStatus = (invoice.status || '').toUpperCase();
    if (normalizedStoredStatus !== computedStatus) {
      updates.status = computedStatus.toLowerCase(); // keep lowercase for DB consistency if desired, or uppercase. Let's use lowercase to match 'paid', 'pending' in previous code
      needsUpdate = true;
    }

    if (needsUpdate) {
      try {
        await updateDoc(doc(db, 'invoices', invoice.id), updates);
        console.log(`[Self-Heal] Repaired payment data for invoice ${invoice.id}`);
        return { ...invoice, ...updates };
      } catch (e) {
        console.error('[Self-Heal] Failed', e);
      }
    }
    
    return invoice;
  },

  calculateMembershipCollected: (invoices: any[], memberId?: string): number => {
    return (invoices || [])
      .filter((inv: any) => {
        if (!inv || inv.status === 'VOID' || inv.status === 'void' || inv.isDuplicate) return false;
        if (memberId && String(inv.memberId) !== String(memberId)) return false;
        const bType = String(inv.billingType || inv.invoiceType || '').toUpperCase();
        return bType !== 'PT';
      })
      .reduce((sum: number, inv: any) => {
        const p = Number(inv.amountPaid !== undefined ? inv.amountPaid : (inv.paid !== undefined ? inv.paid : Number(inv.amount || 0)));
        return sum + (isNaN(p) ? 0 : p);
      }, 0);
  },

  calculatePtCollected: (invoices: any[], memberId?: string): number => {
    return (invoices || [])
      .filter((inv: any) => {
        if (!inv || inv.status === 'VOID' || inv.status === 'void' || inv.isDuplicate) return false;
        if (memberId && String(inv.memberId) !== String(memberId)) return false;
        const bType = String(inv.billingType || inv.invoiceType || '').toUpperCase();
        return bType === 'PT';
      })
      .reduce((sum: number, inv: any) => {
        const p = Number(inv.amountPaid !== undefined ? inv.amountPaid : (inv.paid !== undefined ? inv.paid : Number(inv.amount || 0)));
        return sum + (isNaN(p) ? 0 : p);
      }, 0);
  },

  markDuplicateInvoicesAsVoid: async (invoices: any[]) => {
    if (!invoices || invoices.length === 0) return;
    const { doc, updateDoc } = await import('firebase/firestore');

    const seenMap = new Map<string, any>();
    for (const inv of invoices) {
      if (!inv || inv.status === 'VOID' || inv.status === 'void' || inv.isDuplicate) continue;

      const mId = inv.memberId || inv.memberUid || '';
      const type = String(inv.billingType || inv.invoiceType || 'MEMBERSHIP').toUpperCase();
      const amt = inv.netPayable || inv.amount || inv.originalAmount || 0;
      const dateStr = String(inv.date || inv.createdAt || '').split('T')[0];

      const key = `${mId}_${type}_${amt}_${dateStr}`;
      if (seenMap.has(key)) {
        // Found genuine duplicate created on same day with same amount
        if (inv.id) {
          try {
            await updateDoc(doc(db, 'payments', inv.id), {
              status: 'VOID',
              isDuplicate: true,
              voidReason: 'Marked as accidental duplicate onboarding invoice',
              updatedAt: new Date().toISOString()
            });
            console.log(`[Duplicate Protection] Marked invoice ${inv.id} as VOID`);
          } catch (e) {
            console.warn(`[Duplicate Protection] Failed to mark ${inv.id} as VOID:`, e);
          }
        }
      } else {
        seenMap.set(key, inv);
      }
    }
  }
};
