/**
 * COMPREHENSIVE TEST SUITE FOR MEMBERSHIP RENEWAL & DISCOUNT CONCESSION LOGIC
 *
 * Verifies all 5 Test Scenarios from user specification:
 * 1. Package ₹6,500, Discount ₹1,900, Paid ₹4,600 -> Net ₹4,600, Balance ₹0, Collection ₹4,600
 * 2. Package ₹6,500, Discount ₹1,000, Paid ₹3,000 -> Net ₹5,500, Balance ₹2,500, Collection ₹3,000
 * 3. Package ₹6,500, Discount ₹0, Paid ₹6,500 -> Net ₹6,500, Balance ₹0, Collection ₹6,500
 * 4. Package ₹6,500, Discount ₹6,500, Paid ₹0 -> Net ₹0, Balance ₹0, Collection ₹0
 * 5. Package ₹6,500, Discount ₹7,000 -> 400 Bad Request: "Discount cannot exceed package amount."
 */

import assert from 'assert';
import { renewMembership } from '../controllers/member.controller';
import { db } from '../firebase';

interface MockResponse {
  statusCode: number;
  data: any;
  status: (code: number) => MockResponse;
  json: (body: any) => MockResponse;
}

function createMockRes(): MockResponse {
  const res: MockResponse = {
    statusCode: 200,
    data: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: any) {
      this.data = body;
      return this;
    },
  };
  return res;
}

async function runRenewalTests() {
  console.log('=== RUNNING COMPREHENSIVE MEMBERSHIP RENEWAL & DISCOUNT TEST SUITE ===\n');

  const createdMemberIds: string[] = [];

  const setupMember = async (tag: string, planName = '1 Month Standard') => {
    const timestamp = Date.now();
    const docId = `mem_ren_${tag}_${timestamp}_${Math.floor(Math.random() * 1000)}`;
    const memberId = `AZ-2026-REN-${Math.floor(1000 + Math.random() * 9000)}`;

    const member = await db.addMember({
      id: docId,
      docId,
      name: `Renewal Test ${tag}`,
      memberId,
      phone: '9876543210',
      email: '',
      plan: planName,
      packageName: planName,
      startDate: '2026-07-01',
      expiryDate: '2026-08-01',
      status: 'expired',
      amount: 2500,
      price: 2500,
      totalBilled: 2500,
      totalPaid: 2500,
      outstandingBalance: 0,
      paymentStatus: 'paid',
      createdAt: new Date().toISOString(),
    });

    createdMemberIds.push(docId);
    return { memberId: docId, member };
  };

  const invokeRenew = async (memberId: string, payload: any) => {
    const req: any = {
      params: { id: memberId },
      body: payload,
    };
    const res = createMockRes();
    await renewMembership(req, res as any);
    return { status: res.statusCode, data: res.data };
  };

  try {
    // ── TEST 1: Package ₹6,500, Discount ₹1,900, Paid ₹4,600 ────────────────
    console.log('--- TEST 1: Package ₹6,500, Discount ₹1,900, Paid ₹4,600 -> Net ₹4,600, Balance ₹0, Collection ₹4,600 ---');
    const t1 = await setupMember('T1');
    const res1 = await invokeRenew(t1.memberId, {
      plan: '3 Months Pro',
      packagePrice: 6500,
      startDate: '2026-08-02',
      expiryDate: '2026-11-02',
      discountType: 'fixed',
      discountValue: 1900,
      amountPaidToday: 4600,
      paymentMethod: 'UPI',
      invoiceDate: '2026-09-03',
      notes: 'Test 1 full discount renewal',
    });

    assert.strictEqual(res1.status, 200, 'Must return 200 OK');
    assert.strictEqual(res1.data.success, true);
    const p1 = res1.data.payment;
    assert.strictEqual(p1.packagePrice, 6500, 'Package Price must be ₹6,500');
    assert.strictEqual(p1.discountAmount, 1900, 'Discount must be ₹1,900');
    assert.strictEqual(p1.netPayable, 4600, 'Net Payable must be ₹4,600');
    assert.strictEqual(p1.amountPaidToday, 4600, 'Amount Paid Today must be ₹4,600');
    assert.strictEqual(p1.amountPaid, 4600, 'Today Collection amountPaid must be ₹4,600 ONLY');
    assert.strictEqual(p1.pendingAmount, 0, 'Remaining Balance must be ₹0');
    assert.strictEqual(p1.paymentStatus, 'paid', 'Status must be paid');

    // Verify member record
    const m1 = await db.getMemberById(t1.memberId);
    assert.strictEqual(m1.plan, '3 Months Pro');
    assert.strictEqual(m1.outstandingBalance, 0, 'Member balance must be ₹0');
    console.log('✓ TEST 1 Passed: Net ₹4,600, Balance ₹0, Collection ₹4,600 verified');

    // ── TEST 2: Package ₹6,500, Discount ₹1,000, Paid ₹3,000 ────────────────
    console.log('\n--- TEST 2: Package ₹6,500, Discount ₹1,000, Paid ₹3,000 -> Net ₹5,500, Balance ₹2,500, Collection ₹3,000 ---');
    const t2 = await setupMember('T2');
    const res2 = await invokeRenew(t2.memberId, {
      plan: '3 Months Pro',
      packagePrice: 6500,
      startDate: '2026-08-02',
      expiryDate: '2026-11-02',
      discountType: 'fixed',
      discountValue: 1000,
      amountPaidToday: 3000,
      paymentMethod: 'Cash',
      invoiceDate: '2026-09-03',
    });

    assert.strictEqual(res2.status, 200);
    const p2 = res2.data.payment;
    assert.strictEqual(p2.packagePrice, 6500);
    assert.strictEqual(p2.discountAmount, 1000);
    assert.strictEqual(p2.netPayable, 5500);
    assert.strictEqual(p2.amountPaidToday, 3000);
    assert.strictEqual(p2.amountPaid, 3000, 'Collection must be ₹3,000 ONLY');
    assert.strictEqual(p2.pendingAmount, 2500, 'Remaining Balance must be ₹2,500');
    assert.strictEqual(p2.paymentStatus, 'partial');

    const m2 = await db.getMemberById(t2.memberId);
    assert.strictEqual(m2.outstandingBalance, 2500);
    console.log('✓ TEST 2 Passed: Partial payment with ₹2,500 balance and ₹3,000 collection verified');

    // ── TEST 3: Package ₹6,500, Discount ₹0, Paid ₹6,500 ────────────────────
    console.log('\n--- TEST 3: Package ₹6,500, Discount ₹0, Paid ₹6,500 -> Net ₹6,500, Balance ₹0, Collection ₹6,500 ---');
    const t3 = await setupMember('T3');
    const res3 = await invokeRenew(t3.memberId, {
      plan: '3 Months Pro',
      packagePrice: 6500,
      startDate: '2026-08-02',
      expiryDate: '2026-11-02',
      discountType: 'fixed',
      discountValue: 0,
      amountPaidToday: 6500,
      paymentMethod: 'Card',
      invoiceDate: '2026-09-03',
    });

    assert.strictEqual(res3.status, 200);
    const p3 = res3.data.payment;
    assert.strictEqual(p3.packagePrice, 6500);
    assert.strictEqual(p3.discountAmount, 0);
    assert.strictEqual(p3.netPayable, 6500);
    assert.strictEqual(p3.amountPaidToday, 6500);
    assert.strictEqual(p3.amountPaid, 6500);
    assert.strictEqual(p3.pendingAmount, 0);
    assert.strictEqual(p3.paymentStatus, 'paid');
    console.log('✓ TEST 3 Passed: Standard zero-discount renewal verified');

    // ── TEST 4: Package ₹6,500, Discount ₹6,500, Paid ₹0 ────────────────────
    console.log('\n--- TEST 4: Package ₹6,500, Discount ₹6,500, Paid ₹0 -> Net ₹0, Balance ₹0, Collection ₹0 ---');
    const t4 = await setupMember('T4');
    const res4 = await invokeRenew(t4.memberId, {
      plan: '3 Months Pro',
      packagePrice: 6500,
      startDate: '2026-08-02',
      expiryDate: '2026-11-02',
      discountType: 'fixed',
      discountValue: 6500,
      amountPaidToday: 0,
      paymentMethod: 'UPI',
      invoiceDate: '2026-09-03',
    });

    assert.strictEqual(res4.status, 200);
    const p4 = res4.data.payment;
    assert.strictEqual(p4.packagePrice, 6500);
    assert.strictEqual(p4.discountAmount, 6500);
    assert.strictEqual(p4.netPayable, 0);
    assert.strictEqual(p4.amountPaidToday, 0);
    assert.strictEqual(p4.amountPaid, 0);
    assert.strictEqual(p4.pendingAmount, 0);
    assert.strictEqual(p4.paymentStatus, 'paid');
    console.log('✓ TEST 4 Passed: 100% concession renewal results in ₹0 payable, ₹0 balance, ₹0 collection');

    // ── TEST 5: Package ₹6,500, Discount ₹7,000 -> 400 Validation Error ──────
    console.log('\n--- TEST 5: Package ₹6,500, Discount ₹7,000 -> 400 Bad Request: "Discount cannot exceed package amount." ---');
    const t5 = await setupMember('T5');
    const res5 = await invokeRenew(t5.memberId, {
      plan: '3 Months Pro',
      packagePrice: 6500,
      startDate: '2026-08-02',
      expiryDate: '2026-11-02',
      discountType: 'fixed',
      discountValue: 7000,
      amountPaidToday: 0,
      paymentMethod: 'UPI',
    });

    assert.strictEqual(res5.status, 400, 'Must return 400 Bad Request');
    assert.strictEqual(res5.data.error, 'Discount cannot exceed package amount.');
    console.log('✓ TEST 5 Passed: Strict validation prevents excessive discount');

    console.log('\n=== ALL MEMBERSHIP RENEWAL & DISCOUNT TESTS PASSED SUCCESSFULLY! ===');
  } finally {
    // Hard Cleanup test records from Firestore
    try {
      const { getFirestoreDb } = await import('../firebase');
      const firestore = getFirestoreDb();
      if (firestore) {
        for (const mId of createdMemberIds) {
          await firestore.collection('members').doc(mId).delete();
          const pSnap = await firestore.collection('payments').where('memberId', '==', mId).get();
          for (const doc of pSnap.docs) {
            await firestore.collection('payments').doc(doc.id).delete();
          }
        }
      }
    } catch (_) {}
    process.exit(0);
  }
}

runRenewalTests().catch(err => {
  console.error('Renewal test failed:', err);
  process.exit(1);
});
