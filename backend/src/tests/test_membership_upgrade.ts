import assert from 'assert';
import { db } from '../firebase';
import { upgradeMembership } from '../controllers/member.controller';

async function runUpgradeTests() {
  console.log('=== RUNNING COMPREHENSIVE MEMBERSHIP UPGRADE & DISCOUNT TEST SUITE ===');

  const createdMemberIds: string[] = [];

  const setupMemberWithBill = async (suffix: string, initialPrice: number, planName: string) => {
    const memberId = `mem_upg_${suffix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    createdMemberIds.push(memberId);
    const invoiceNumber = `INV-MEM-ORIG-${suffix}-${Date.now()}`;
    const paymentDate = '2026-08-15';

    await db.addMember({
      id: memberId,
      name: `Upgrade Client ${suffix}`,
      phone: '9876543210',
      plan: planName,
      price: initialPrice,
      amount: initialPrice,
      totalBilled: initialPrice,
      totalPaid: initialPrice,
      outstandingBalance: 0,
      startDate: paymentDate,
      expiryDate: '2026-09-15',
      status: 'active',
      paymentStatus: 'paid',
    });

    const oldBill = await db.addPayment({
      memberId,
      memberName: `Upgrade Client ${suffix}`,
      plan: planName,
      invoiceNumber,
      invoice: invoiceNumber,
      amount: initialPrice,
      paid: initialPrice,
      originalAmount: initialPrice,
      netPayable: initialPrice,
      amountPaid: initialPrice,
      pendingAmount: 0,
      status: 'paid',
      paymentStatus: 'paid',
      date: paymentDate,
      paymentDate,
      invoiceDate: paymentDate,
      transactionDate: paymentDate,
    });

    return { memberId, oldBill, invoiceNumber, paymentDate };
  };

  const invokeUpgrade = async (memberId: string, body: any) => {
    let resStatus = 200;
    let resJson: any = null;
    const mockReq: any = {
      params: { id: memberId },
      body: {
        ...body,
        invoiceNumber: body.invoiceNumber || `INV-UPG-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      },
    };
    const mockRes: any = {
      status: (code: number) => {
        resStatus = code;
        return mockRes;
      },
      json: (data: any) => {
        resJson = data;
        return mockRes;
      },
    };
    await upgradeMembership(mockReq, mockRes);
    return { status: resStatus, data: resJson };
  };

  try {
    // ── TEST 2: CLIENT PRIMARY FINANCIAL SCENARIO ───────────────────────────
    // Previous adjustment = ₹2,200, New package = ₹6,500
    // Upgrade amount before discount = ₹4,300
    // Discount = ₹1,900 -> Net Upgrade Amount = ₹2,400
    // Amount paid today = ₹2,400 -> Remaining balance = ₹0, Status = PAID
    console.log('\n--- TEST 2: Client Exact Scenario (₹6,500 new - ₹2,200 adj - ₹1,900 disc = ₹2,400 paid, Balance: ₹0) ---');
    const t2 = await setupMemberWithBill('T2', 2200, '1 Month Standard');
    const res2 = await invokeUpgrade(t2.memberId, {
      plan: '3 Months Pro',
      packagePrice: 6500,
      startDate: '2026-08-15',
      expiryDate: '2026-11-15',
      previousInvoiceId: t2.oldBill.id,
      previousInvoiceNumber: t2.invoiceNumber,
      previousInvoiceDate: t2.paymentDate,
      previousPlan: '1 Month Standard',
      previousPaidAmount: 2200,
      adjustedAmount: 2200,
      discountType: 'fixed',
      discountValue: 1900,
      additionalAmountPaid: 2400,
      paymentMethod: 'UPI',
      invoiceDate: '2026-09-03',
      notes: 'Client test case upgrade',
    });

    assert.strictEqual(res2.status, 200, 'Endpoint must return 200');
    assert.strictEqual(res2.data.success, true, 'Upgrade must be successful');

    const inv2 = res2.data.payment;
    assert.strictEqual(inv2.packagePrice, 6500, 'New Package Price must be ₹6,500');
    assert.strictEqual(inv2.adjustedAmount, 2200, 'Adjusted Amount must be ₹2,200');
    assert.strictEqual(inv2.upgradeBaseAmount, 4300, 'Upgrade Amount Before Discount must be ₹4,300');
    assert.strictEqual(inv2.discountAmount, 1900, 'Discount must be ₹1,900');
    assert.strictEqual(inv2.netPayable, 2400, 'Net Upgrade Amount must be ₹2,400');
    assert.strictEqual(inv2.additionalAmountPaid, 2400, 'Amount Paid Today must be ₹2,400');
    assert.strictEqual(inv2.amountPaid, 2400, 'amountPaid must be strictly ₹2,400 for Today Collection isolation');
    assert.strictEqual(inv2.pendingAmount, 0, 'Remaining Balance must be ₹0');
    assert.strictEqual(inv2.paymentStatus, 'paid', 'Status must be paid');
    console.log('✓ TEST 2 Passed: Upgrade financial breakdown matches client requirements exactly');

    // Verify Old Bill remains intact
    const payments = await db.getPayments({ memberId: t2.memberId });
    const fetchedOld = payments.find((p: any) => p.invoiceNumber === t2.invoiceNumber || p.id === t2.oldBill.id);
    assert(fetchedOld, 'Old invoice must still exist');
    assert.strictEqual(fetchedOld.date, t2.paymentDate, 'Old invoice date must remain unchanged');
    assert.strictEqual(fetchedOld.paid, 2200, 'Old invoice amount must remain ₹2,200');
    assert.strictEqual(fetchedOld.isUpgraded, true, 'Old invoice must be marked isUpgraded');
    assert.strictEqual(fetchedOld.upgradedToInvoice, inv2.invoiceNumber, 'Old invoice links to new invoice');
    console.log('✓ Old bill integrity verified: date, paid amount, and history preserved');

    // ── TEST 1: ₹4,300 upgrade, ₹0 discount, ₹2,400 paid -> ₹1,900 balance ──
    console.log('\n--- TEST 1: ₹4,300 upgrade, ₹0 discount, ₹2,400 paid -> Balance: ₹1,900, Status: partial ---');
    const t1 = await setupMemberWithBill('T1', 2200, '1 Month Standard');
    const res1 = await invokeUpgrade(t1.memberId, {
      plan: '3 Months Pro',
      packagePrice: 6500,
      startDate: '2026-08-15',
      expiryDate: '2026-11-15',
      previousPaidAmount: 2200,
      adjustedAmount: 2200,
      discountType: 'fixed',
      discountValue: 0,
      additionalAmountPaid: 2400,
      paymentMethod: 'UPI',
    });
    assert.strictEqual(res1.data.payment.upgradeBaseAmount, 4300);
    assert.strictEqual(res1.data.payment.discountAmount, 0);
    assert.strictEqual(res1.data.payment.netPayable, 4300);
    assert.strictEqual(res1.data.payment.additionalAmountPaid, 2400);
    assert.strictEqual(res1.data.payment.pendingAmount, 1900);
    assert.strictEqual(res1.data.payment.paymentStatus, 'partial');
    console.log('✓ TEST 1 Passed: Expected balance ₹1,900, Status partial');

    // ── TEST 3: ₹4,300 upgrade, ₹1,000 discount, ₹2,400 paid -> ₹900 balance ──
    console.log('\n--- TEST 3: ₹4,300 upgrade, ₹1,000 discount, ₹2,400 paid -> Balance: ₹900, Status: partial ---');
    const t3 = await setupMemberWithBill('T3', 2200, '1 Month Standard');
    const res3 = await invokeUpgrade(t3.memberId, {
      plan: '3 Months Pro',
      packagePrice: 6500,
      startDate: '2026-08-15',
      expiryDate: '2026-11-15',
      previousPaidAmount: 2200,
      adjustedAmount: 2200,
      discountType: 'fixed',
      discountValue: 1000,
      additionalAmountPaid: 2400,
      paymentMethod: 'UPI',
    });
    assert.strictEqual(res3.data.payment.upgradeBaseAmount, 4300);
    assert.strictEqual(res3.data.payment.discountAmount, 1000);
    assert.strictEqual(res3.data.payment.netPayable, 3300);
    assert.strictEqual(res3.data.payment.additionalAmountPaid, 2400);
    assert.strictEqual(res3.data.payment.pendingAmount, 900);
    assert.strictEqual(res3.data.payment.paymentStatus, 'partial');
    console.log('✓ TEST 3 Passed: Expected balance ₹900, Status partial');

    // ── TEST 4: Full discount: ₹4,300 upgrade, ₹4,300 discount, ₹0 paid -> Balance: ₹0, Status: paid ──
    console.log('\n--- TEST 4: Full discount: ₹4,300 upgrade, ₹4,300 discount, ₹0 paid -> Balance: ₹0, Status: paid ---');
    const t4 = await setupMemberWithBill('T4', 2200, '1 Month Standard');
    const res4 = await invokeUpgrade(t4.memberId, {
      plan: '3 Months Pro',
      packagePrice: 6500,
      startDate: '2026-08-15',
      expiryDate: '2026-11-15',
      previousPaidAmount: 2200,
      adjustedAmount: 2200,
      discountType: 'fixed',
      discountValue: 4300,
      additionalAmountPaid: 0,
      paymentMethod: 'UPI',
    });
    assert.strictEqual(res4.data.payment.upgradeBaseAmount, 4300);
    assert.strictEqual(res4.data.payment.discountAmount, 4300);
    assert.strictEqual(res4.data.payment.netPayable, 0);
    assert.strictEqual(res4.data.payment.additionalAmountPaid, 0);
    assert.strictEqual(res4.data.payment.pendingAmount, 0);
    assert.strictEqual(res4.data.payment.paymentStatus, 'paid');
    console.log('✓ TEST 4 Passed: Full discount results in net ₹0, paid ₹0, balance ₹0, Status paid');

    // ── TEST 5: Excessive Discount Validation (Discount > Upgrade Amount) ────
    console.log('\n--- TEST 5: Discount ₹5,000 on ₹4,300 upgrade -> Validation error: Discount cannot exceed upgrade amount. ---');
    const t5 = await setupMemberWithBill('T5', 2200, '1 Month Standard');
    const res5 = await invokeUpgrade(t5.memberId, {
      plan: '3 Months Pro',
      packagePrice: 6500,
      startDate: '2026-08-15',
      expiryDate: '2026-11-15',
      previousPaidAmount: 2200,
      adjustedAmount: 2200,
      discountType: 'fixed',
      discountValue: 5000, // Exceeds ₹4,300
      additionalAmountPaid: 0,
      paymentMethod: 'UPI',
    });
    assert.strictEqual(res5.status, 400, 'Must return 400 Bad Request');
    assert.strictEqual(res5.data.error, 'Discount cannot exceed upgrade amount.', 'Must return exact validation error');
    console.log('✓ TEST 5 Passed: Validation error correctly returned: "Discount cannot exceed upgrade amount."');

    console.log('\n=== ALL MEMBERSHIP UPGRADE & DISCOUNT TESTS PASSED SUCCESSFULLY! ===');
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

runUpgradeTests().catch(err => {
  console.error('Upgrade test failed:', err);
  process.exit(1);
});

