import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

const serviceAccountPath = path.join(__dirname, '..', '..', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

export interface CanonicalTransactionRecord {
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
  paymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' | 'NOT_BILLED';

  billingType: string;
  isHistorical: boolean;

  createdAt: string;
  updatedAt: string;
}

export async function reconcileBillingData() {
  console.log('====================================================');
  console.log('  WARRIOR GYM: SAFE CANONICAL BILLING RECONCILIATION ');
  console.log('====================================================\n');

  // 1. Fetch all members and payments
  const membersSnap = await db.collection('members').get();
  const paymentsSnap = await db.collection('payments').get();

  console.log(`Loaded ${membersSnap.docs.length} members and ${paymentsSnap.docs.length} payments.`);

  const paymentsByMember = new Map<string, any[]>();
  const paymentsByInvoiceNum = new Map<string, any>();

  paymentsSnap.docs.forEach(doc => {
    const p = { id: doc.id, ...doc.data() as any };
    paymentsByInvoiceNum.set(p.invoiceNumber || p.invoice, p);

    const mId = p.memberId || p.memberUid;
    if (mId) {
      const list = paymentsByMember.get(mId) || [];
      list.push(p);
      paymentsByMember.set(mId, list);
    }
  });

  let repairedCount = 0;

  for (const doc of membersSnap.docs) {
    const member = { id: doc.id, ...doc.data() as any };
    const memberName = member.name || '';
    const isNaresh = member.id === '0fElE51h7FtUaDshiy1y' || memberName.toLowerCase().includes('naresh');
    const isShahbaz = member.id === '0mD8IuDxKbzUdO8bNEGu' || memberName.toLowerCase().includes('shahbaz');

    // Find all matching payments for this member
    let memberPayments = paymentsByMember.get(member.id) || [];
    if (member.memberId) {
      const codePayments = paymentsByMember.get(member.memberId) || [];
      memberPayments = [...memberPayments, ...codePayments.filter(cp => !memberPayments.some(mp => mp.id === cp.id))];
    }
    if (member.phone) {
      const cleanP = member.phone.replace(/\D/g, '').slice(-10);
      if (cleanP) {
        paymentsSnap.docs.forEach(pDoc => {
          const pd = pDoc.data() as any;
          if (pd.memberPhone && pd.memberPhone.replace(/\D/g, '').slice(-10) === cleanP) {
            if (!memberPayments.some(mp => mp.id === pDoc.id)) {
              memberPayments.push({ id: pDoc.id, ...pd });
            }
          }
        });
      }
    }

    if (isShahbaz) {
      // Fix Shahbaz payment doc where discount was accidentally 5400 making netPayable 0
      for (const p of memberPayments) {
        if (p.id === '6jpGmCPeCfSKyPCXIT5T' || p.invoiceNumber === 'INV-315867') {
          if (p.netPayable === 0 && p.amountPaid === 1100) {
            p.netPayable = 1100;
            p.amount = 1100;
            p.originalAmount = 2500;
            p.discount = 1400;
            p.discountAmount = 1400;
            p.status = 'paid';
            await db.collection('payments').doc(p.id).update({
              netPayable: 1100,
              amount: 1100,
              originalAmount: 2500,
              discount: 1400,
              discountAmount: 1400,
              status: 'paid'
            });
            console.log(`[Shahbaz Fix] Corrected payment ${p.id} netPayable to ₹1100 (PAID)`);
          }
        }
      }
    }

    let needsUpdate = false;
    const memberUpdates: any = {};

    // ─────────────────────────────────────────────────────────────
    // A. RECONCILE MEMBERSHIP HISTORY & PREVENT DUPLICATES
    // ─────────────────────────────────────────────────────────────
    let membershipHistory = Array.isArray(member.membershipHistory) ? [...member.membershipHistory] : [];
    const dedupedHistory: any[] = [];
    const seenHistoryKeys = new Set<string>();

    for (const h of membershipHistory) {
      const invRef = h.invoiceId || h.invoiceNumber || h.transactionId || '';
      const planRef = h.plan || h.packageName || '';
      const dateRef = (h.startDate || '') + '_' + (h.expiryDate || '');
      // Deduplicate key
      const key = invRef ? `inv_${invRef}` : `plan_${planRef}_${dateRef}`;

      if (!seenHistoryKeys.has(key)) {
        seenHistoryKeys.add(key);
        // Link transactionId if matching payment found
        const matchingPay = memberPayments.find(p => (p.invoiceNumber && p.invoiceNumber === invRef) || (p.invoice && p.invoice === invRef) || p.id === invRef);
        if (matchingPay) {
          h.transactionId = matchingPay.id;
          h.amount = matchingPay.netPayable !== undefined ? matchingPay.netPayable : matchingPay.amount;
          h.paid = matchingPay.amountPaid !== undefined ? matchingPay.amountPaid : matchingPay.paid;
        }
        dedupedHistory.push(h);
      } else {
        console.log(`[Deduplication] Removed duplicate membershipHistory entry for ${memberName}: key=${key}`);
        needsUpdate = true;
      }
    }

    // ─────────────────────────────────────────────────────────────
    // B. BUILD CANONICAL BILLING HISTORY
    // ─────────────────────────────────────────────────────────────
    let existingBillingHistory = Array.isArray(member.billingHistory) ? member.billingHistory : [];
    const canonicalBillingMap = new Map<string, CanonicalTransactionRecord>();

    // 1. First add from verified payments collection
    memberPayments.forEach(p => {
      const origAmt = Number(p.originalAmount !== undefined ? p.originalAmount : (p.packagePrice || p.amount || 0));
      const discAmt = Number(p.discountAmount !== undefined ? p.discountAmount : (p.discount || 0));
      const taxAmt = Number(p.taxAmount !== undefined ? p.taxAmount : (p.tax || p.gst || 0));
      const netPay = Number(p.netPayable !== undefined ? p.netPayable : (p.amount !== undefined ? p.amount : Math.max(0, origAmt - discAmt + taxAmt)));
      const paidAmt = Number(p.amountPaid !== undefined ? p.amountPaid : (p.paid !== undefined ? p.paid : netPay));
      const pending = Math.max(0, netPay - paidAmt);
      const computedStatus: 'PAID' | 'PARTIAL' | 'UNPAID' | 'NOT_BILLED' = pending <= 0 ? 'PAID' : (paidAmt > 0 ? 'PARTIAL' : 'UNPAID');

      const canonicalTx: CanonicalTransactionRecord = {
        transactionId: p.id,
        memberId: member.id,
        memberCode: member.memberId || '',
        biometricId: member.biometricId || member.deviceUserId || '',
        invoiceId: p.id,
        invoiceNumber: p.invoiceNumber || p.invoice || `INV-${p.id.slice(-6)}`,
        packageId: p.packageId || 'pkg_standard',
        packageName: p.packageName || p.plan || member.plan || 'General Membership',
        billingDate: p.billingDate || p.date || (p.createdAt ? p.createdAt.split('T')[0] : '2026-09-14'),
        paymentDate: p.paymentDate || p.date || (p.createdAt ? p.createdAt.split('T')[0] : '2026-09-14'),
        startDate: p.startDate || member.startDate || '2026-09-07',
        expiryDate: p.expiryDate || member.expiryDate || '2026-11-13',
        originalAmount: origAmt,
        discount: discAmt,
        tax: taxAmt,
        otherCharges: Number(p.otherCharges || 0),
        netPayable: netPay,
        amountPaid: paidAmt,
        pendingAmount: pending,
        paymentMethod: p.paymentMethod || p.method || 'UPI',
        paymentStatus: computedStatus,
        billingType: p.billingType || (p.invoiceType === 'PT' ? 'PT' : 'MEMBERSHIP'),
        isHistorical: Boolean(p.isHistorical || p.imported),
        createdAt: p.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      canonicalBillingMap.set(p.id, canonicalTx);
    });

    // 2. Also check if member had billingHistory that wasn't in payments, preserving legitimate entries
    existingBillingHistory.forEach((bh: any) => {
      const txId = bh.transactionId || bh.id || bh.invoiceNumber;
      if (txId && !canonicalBillingMap.has(txId)) {
        canonicalBillingMap.set(txId, bh);
      }
    });

    const reconciledBillingHistory = Array.from(canonicalBillingMap.values());

    // ─────────────────────────────────────────────────────────────
    // C. COMPUTE AUTHORITATIVE FINANCIAL TOTALS FROM CANONICAL BILLS
    // ─────────────────────────────────────────────────────────────
    let totalBilled = 0;
    let totalPaid = 0;

    reconciledBillingHistory.forEach(b => {
      totalBilled += Number(b.netPayable || 0);
      totalPaid += Number(b.amountPaid || 0);
    });

    const outstandingBalance = Math.max(0, totalBilled - totalPaid);
    const finalPaymentStatus = totalBilled > 0 && outstandingBalance <= 0 ? 'paid' : (totalPaid > 0 ? 'partial' : 'unpaid');

    // Check if Naresh or Shahbaz or any member needs doc updates
    if (isNaresh || isShahbaz || existingBillingHistory.length !== reconciledBillingHistory.length || member.totalPaid !== totalPaid || member.totalBilled !== totalBilled || member.outstandingBalance !== outstandingBalance) {
      memberUpdates.membershipHistory = dedupedHistory;
      memberUpdates.billingHistory = reconciledBillingHistory;
      memberUpdates.totalBilled = totalBilled;
      memberUpdates.totalPaid = totalPaid;
      memberUpdates.amountPaid = totalPaid;
      memberUpdates.paid = totalPaid;
      memberUpdates.outstandingBalance = outstandingBalance;
      memberUpdates.pendingBalance = outstandingBalance;
      memberUpdates.balanceAmount = outstandingBalance;
      memberUpdates.paymentStatus = finalPaymentStatus;
      memberUpdates.updatedAt = new Date().toISOString();

      // Ensure payments array on member document also contains the canonical summaries
      memberUpdates.payments = reconciledBillingHistory;

      needsUpdate = true;
    }

    if (needsUpdate) {
      await db.collection('members').doc(member.id).update(memberUpdates);
      repairedCount++;
      console.log(`✅ [Reconciled] ${memberName} (${member.id}): Billed=₹${totalBilled}, Paid=₹${totalPaid}, Balance=₹${outstandingBalance}, Status=${finalPaymentStatus}, Bills=${reconciledBillingHistory.length}, HistoryEntries=${dedupedHistory.length}`);
    }
  }

  console.log(`\nReconciliation completed! Successfully updated ${repairedCount} member documents.`);
  console.log('Zero duplicate payments were created in payments collection.');
}

if (require.main === module) {
  reconcileBillingData().then(() => process.exit(0)).catch(err => {
    console.error('Reconciliation failed:', err);
    process.exit(1);
  });
}
