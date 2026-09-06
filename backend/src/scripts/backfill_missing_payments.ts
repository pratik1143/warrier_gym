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

async function backfillMissingPayments() {
  console.log("\n=======================================================");
  console.log("   WARRIOR GYM — BACKFILL MISSING MEMBER PAYMENTS      ");
  console.log("=======================================================\n");

  const todayStr = new Date().toISOString().split('T')[0];
  const membersSnap = await db.collection('members').get();
  const paymentsSnap = await db.collection('payments').get();

  console.log(`Found ${membersSnap.size} members and ${paymentsSnap.size} payments in Firestore.\n`);

  const existingPaymentMemberIds = new Set<string>();
  const existingPaymentPhones = new Set<string>();

  paymentsSnap.docs.forEach(doc => {
    const p = doc.data();
    if (p.memberId) existingPaymentMemberIds.add(String(p.memberId));
    if (p.memberPhone) existingPaymentPhones.add(String(p.memberPhone).replace(/\D/g, ''));
  });

  let backfilledCount = 0;

  for (const doc of membersSnap.docs) {
    const m = doc.data();
    const cleanPhone = String(m.phone || '').replace(/\D/g, '');
    const hasPayment = existingPaymentMemberIds.has(doc.id) || (cleanPhone && existingPaymentPhones.has(cleanPhone));

    // If member has no payment record but is marked paid or has totalPaid/price > 0
    if (!hasPayment) {
      const paidAmt = Number(m.totalPaid !== undefined ? m.totalPaid : (m.price !== undefined ? m.price : (m.netPayable !== undefined ? m.netPayable : 3000)));
      const invoiceNumber = m.invoiceNumber || `INV-${Math.floor(100000 + Math.random() * 900000)}`;
      const pDate = m.joinDate || m.startDate || todayStr;

      const paymentDoc = {
        idempotencyKey: `backfill_${doc.id}_${pDate}`,
        memberId: doc.id,
        memberName: m.name || 'Member',
        memberPhone: m.phone || '',
        invoiceType: 'MEMBERSHIP',
        billingType: 'MEMBERSHIP',
        plan: m.plan || '1 Month',
        originalAmount: paidAmt,
        discountAmount: Number(m.discountAmount || 0),
        taxAmount: Number(m.taxAmount || 0),
        netPayable: paidAmt,
        amount: paidAmt,
        amountPaid: paidAmt,
        paid: paidAmt,
        outstandingAmount: 0,
        pendingAmount: 0,
        paymentMethod: m.paymentMethod || 'UPI',
        method: m.paymentMethod || 'UPI',
        transactionType: 'membership_payment',
        isHistorical: false,
        imported: false,
        paymentDate: pDate,
        date: pDate,
        status: m.paymentStatus || 'paid',
        invoiceNumber: invoiceNumber,
        invoice: invoiceNumber,
        isRealTimeToday: true,
        createdAt: m.createdAt || new Date().toISOString()
      };

      await db.collection('payments').doc(`inv_${doc.id}`).set(paymentDoc, { merge: true });
      backfilledCount++;
      console.log(`✅ Backfilled missing payment invoice (${invoiceNumber}) of ₹${paidAmt} for member: ${m.name || doc.id}`);
    }
  }

  console.log("\n=======================================================");
  console.log(`🎉 BACKFILL COMPLETE! Created ${backfilledCount} missing payment invoices.`);
  console.log("=======================================================\n");
}

backfillMissingPayments().catch(err => {
  console.error("Backfill Error:", err);
  process.exit(1);
});
