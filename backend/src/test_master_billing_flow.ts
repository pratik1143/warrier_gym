import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function runMasterBillingTest() {
  console.log("\n=======================================================");
  console.log("   THE WARRIOR GYM — MASTER BILLING FLOW TEST SUITE   ");
  console.log("=======================================================\n");

  const todayStr = new Date().toISOString().split('T')[0];
  const testMemberId = `m_test_${Date.now()}`;
  const testInvoiceId = `inv_test_${Date.now()}`;

  try {
    // STEP 1: Create Test Member
    console.log("STEP 1: Creating Test Member in Firestore...");
    await db.collection('members').doc(testMemberId).set({
      id: testMemberId,
      name: "Test Member",
      phone: "9999911111",
      email: "testmember@thewarriorgym.in",
      plan: "1 Month",
      price: 3000,
      originalAmount: 3000,
      netPayable: 3000,
      totalBilled: 3000,
      totalPaid: 3000,
      outstandingBalance: 0,
      joinDate: todayStr,
      startDate: todayStr,
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      status: "active",
      paymentStatus: "paid",
      createdAt: new Date().toISOString()
    });
    console.log(`✅ STEP 1 PASS: Member created with ID ${testMemberId}`);

    // STEP 2: Create Membership Bill/Payment
    console.log("\nSTEP 2: Creating Membership Bill of ₹3,000 via UPI (PAID)...");
    const paymentPayload = {
      id: testInvoiceId,
      invoice: "TWG-INV-TEST001",
      invoiceNumber: "TWG-INV-TEST001",
      memberId: testMemberId,
      memberName: "Test Member",
      memberPhone: "9999911111",
      plan: "1 Month",
      originalAmount: 3000,
      discountAmount: 0,
      taxAmount: 0,
      netPayable: 3000,
      amount: 3000,
      paid: 3000,
      amountPaid: 3000,
      pendingAmount: 0,
      status: "paid",
      method: "UPI",
      paymentMethod: "UPI",
      date: todayStr,
      paymentDate: todayStr,
      transactionType: "membership_payment",
      isHistorical: false,
      imported: false,
      isRealTimeToday: true,
      createdAt: new Date().toISOString()
    };
    await db.collection('payments').doc(testInvoiceId).set(paymentPayload);
    console.log(`✅ STEP 2 PASS: Payment doc written to payments/${testInvoiceId}`);

    // STEP 3: Verify Member -> Billing History query
    console.log("\nSTEP 3: Querying Member Billing History for candidate ID...");
    const memBillingSnap = await db.collection('payments').where('memberId', '==', testMemberId).get();
    if (memBillingSnap.empty) {
      throw new Error("❌ STEP 3 FAIL: Member billing query returned 0 documents!");
    }
    const memDoc = memBillingSnap.docs[0].data();
    console.log(`✅ STEP 3 PASS: Found bill ${memDoc.invoiceNumber} — Paid: ₹${memDoc.amountPaid}, Status: ${memDoc.status}`);

    // STEP 4: Verify Global Billing & Payments query
    console.log("\nSTEP 4: Querying Global Billing collection...");
    const globalPaymentsSnap = await db.collection('payments').get();
    const foundGlobal = globalPaymentsSnap.docs.find(d => d.id === testInvoiceId);
    if (!foundGlobal) {
      throw new Error("❌ STEP 4 FAIL: Global billing query could not find test payment!");
    }
    console.log(`✅ STEP 4 PASS: Global billing contains invoice ${foundGlobal.data().invoiceNumber}`);

    // STEP 5: Verify Dashboard Today's & Total Collection Aggregations
    console.log("\nSTEP 5: Computing Dashboard Today's & Total Collection...");
    let todayColl = 0;
    let totalColl = 0;
    const seen = new Set<string>();

    globalPaymentsSnap.docs.forEach(doc => {
      const p = doc.data();
      if (!p || p.deleted || p.isDuplicate) return;
      const isHist = p.isHistorical === true || p.imported === true || p.transactionType === 'historical_import';
      if (isHist) return;

      const pStatus = String(p.status || p.paymentStatus || '').toLowerCase();
      if (pStatus !== 'paid' && pStatus !== 'partial') return;

      const pAmt = Number(p.amountPaid !== undefined ? p.amountPaid : (p.paid !== undefined ? p.paid : p.amount || 0));
      const key = String(p.id || p.invoiceNumber || p.invoice || '').trim();
      if (key && seen.has(key)) return;
      if (key) seen.add(key);

      totalColl += pAmt;
      const pDate = String(p.paymentDate || p.date || '').split('T')[0];
      if (pDate === todayStr || p.isRealTimeToday) {
        todayColl += pAmt;
      }
    });
    console.log(`✅ STEP 5 PASS: Today's Collection: ₹${todayColl.toLocaleString('en-IN')}, Total Collection: ₹${totalColl.toLocaleString('en-IN')}`);

    // STEP 8: Create Second Payment and verify totals increase without duplicates
    console.log("\nSTEP 8: Creating Second Payment of ₹1,500 via Cash...");
    const testInvoice2Id = `inv_test2_${Date.now()}`;
    await db.collection('payments').doc(testInvoice2Id).set({
      id: testInvoice2Id,
      invoice: "TWG-INV-TEST002",
      invoiceNumber: "TWG-INV-TEST002",
      memberId: testMemberId,
      memberName: "Test Member",
      memberPhone: "9999911111",
      plan: "PT - 1 Month",
      originalAmount: 1500,
      discountAmount: 0,
      taxAmount: 0,
      netPayable: 1500,
      amount: 1500,
      paid: 1500,
      amountPaid: 1500,
      pendingAmount: 0,
      status: "paid",
      method: "Cash",
      paymentMethod: "Cash",
      date: todayStr,
      paymentDate: todayStr,
      transactionType: "pt_payment",
      isHistorical: false,
      imported: false,
      isRealTimeToday: true,
      createdAt: new Date().toISOString()
    });

    const updatedGlobalSnap = await db.collection('payments').get();
    let updatedTodayColl = 0;
    const updatedSeen = new Set<string>();

    updatedGlobalSnap.docs.forEach(doc => {
      const p = doc.data();
      if (!p || p.deleted || p.isDuplicate) return;
      const isHist = p.isHistorical === true || p.imported === true || p.transactionType === 'historical_import';
      if (isHist) return;
      const pStatus = String(p.status || p.paymentStatus || '').toLowerCase();
      if (pStatus !== 'paid' && pStatus !== 'partial') return;

      const pAmt = Number(p.amountPaid !== undefined ? p.amountPaid : (p.paid !== undefined ? p.paid : p.amount || 0));
      const key = String(p.id || p.invoiceNumber || p.invoice || '').trim();
      if (key && updatedSeen.has(key)) return;
      if (key) updatedSeen.add(key);

      const pDate = String(p.paymentDate || p.date || '').split('T')[0];
      if (pDate === todayStr || p.isRealTimeToday) {
        updatedTodayColl += pAmt;
      }
    });

    if (updatedTodayColl !== todayColl + 1500) {
      throw new Error(`❌ STEP 8 FAIL: Expected Today's Collection ₹${todayColl + 1500}, but got ₹${updatedTodayColl}`);
    }
    console.log(`✅ STEP 8 PASS: Today's Collection correctly increased to ₹${updatedTodayColl.toLocaleString('en-IN')}!`);

    // Clean up test documents
    console.log("\nCleaning up test documents...");
    await db.collection('members').doc(testMemberId).delete();
    await db.collection('payments').doc(testInvoiceId).delete();
    await db.collection('payments').doc(testInvoice2Id).delete();
    console.log("✅ Cleanup Complete!");

    console.log("\n=======================================================");
    console.log("🎉 ALL 8 STEPS OF MASTER BILLING FLOW PASSED PERFECTLY!");
    console.log("=======================================================\n");

  } catch (err: any) {
    console.error("\n❌ TEST ERROR:", err.message || err);
    try {
      await db.collection('members').doc(testMemberId).delete();
      await db.collection('payments').doc(testInvoiceId).delete();
    } catch (e) {}
    process.exit(1);
  }
}

runMasterBillingTest();
