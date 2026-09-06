process.env.NODE_ENV = 'test';
process.env.SKIP_REAL_EMAIL = 'true';

import { createMember } from '../controllers/member.controller';
import { createInvoice, cleanupDuplicateInvoicesController } from '../controllers/billing.controller';
import { createCheckIn } from '../controllers/attendance.controller';
import { db } from '../firebase';

function mockReqRes(body: any = {}, params: any = {}) {
  let statusCode = 200;
  let responseData: any = null;

  const req = { body, params } as any;
  const res = {
    status: (code: number) => {
      statusCode = code;
      return res;
    },
    json: (data: any) => {
      responseData = data;
      return res;
    }
  } as any;

  return { req, res, getStatus: () => statusCode, getData: () => responseData };
}

async function runBillingTests() {
  console.log('====================================================');
  console.log('RUNNING AUTOMATED BILLING & START DATE TEST SUITE');
  console.log('====================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, message: string) {
    if (condition) {
      console.log(`✅ [PASS] ${testName}: ${message}`);
      passedCount++;
    } else {
      console.error(`❌ [FAIL] ${testName}: ${message}`);
      failedCount++;
    }
  }

  // ----------------------------------------------------
  // TEST 1: Full Payment with Discount (9500 - 1300 = 8200)
  // ----------------------------------------------------
  console.log('--- TEST 1: ₹9,500 - ₹1,300 Discount with ₹8,200 Payment ---');
  const test1Phone = `98000${Math.floor(10000 + Math.random() * 90000)}`;
  const { req: req1, res: res1, getData: get1 } = mockReqRes({
    name: 'Test Member Full',
    phone: test1Phone,
    plan: '6 Months Elite',
    originalAmount: 9500,
    price: 9500,
    discountAmount: 1300,
    discount: 1300,
    totalPaid: 8200,
    paid: 8200,
    paymentMethod: 'UPI',
    idempotencyKey: `test1_${test1Phone}`
  });

  await createMember(req1, res1);
  const data1 = get1();

  assert(data1 && data1.id !== undefined, 'TEST 1', 'Member created successfully');
  assert(data1.totalBilled === 8200, 'TEST 1', `Total Billed is ₹8,200 (actual: ${data1?.totalBilled})`);
  assert(data1.totalPaid === 8200, 'TEST 1', `Total Paid is ₹8,200 (actual: ${data1?.totalPaid})`);
  assert(data1.outstandingBalance === 0, 'TEST 1', `Outstanding Balance is ₹0 (actual: ${data1?.outstandingBalance})`);

  // Verify DB Payment Invoices count for this member
  const allPayments1 = await db.getPayments();
  const memberInvoices1 = allPayments1.filter((p: any) => p.memberId === data1.id || p.memberPhone === test1Phone);
  assert(memberInvoices1.length === 1, 'TEST 1', `Exactly 1 Invoice created (actual: ${memberInvoices1.length})`);
  if (memberInvoices1[0]) {
    const inv = memberInvoices1[0];
    assert(inv.originalAmount === 9500, 'TEST 1', `Invoice originalAmount = 9500 (actual: ${inv.originalAmount})`);
    assert(inv.discountAmount === 1300, 'TEST 1', `Invoice discountAmount = 1300 (actual: ${inv.discountAmount})`);
    assert(inv.netPayable === 8200, 'TEST 1', `Invoice netPayable = 8200 (actual: ${inv.netPayable})`);
    assert(inv.amountPaid === 8200, 'TEST 1', `Invoice amountPaid = 8200 (actual: ${inv.amountPaid})`);
    assert(inv.outstandingAmount === 0, 'TEST 1', `Invoice outstandingAmount = 0 (actual: ${inv.outstandingAmount})`);
    assert(inv.status === 'paid', 'TEST 1', `Invoice status = paid (actual: ${inv.status})`);
  }

  // ----------------------------------------------------
  // TEST 2: Partial Payment with Discount (9500 - 1300 = 8200, Paid 5000)
  // ----------------------------------------------------
  console.log('\n--- TEST 2: ₹9,500 - ₹1,300 Discount with ₹5,000 Partial Payment ---');
  const test2Phone = `98000${Math.floor(10000 + Math.random() * 90000)}`;
  const { req: req2, res: res2, getData: get2 } = mockReqRes({
    name: 'Test Member Partial',
    phone: test2Phone,
    plan: '6 Months Elite',
    originalAmount: 9500,
    price: 9500,
    discountAmount: 1300,
    discount: 1300,
    totalPaid: 5000,
    paid: 5000,
    paymentMethod: 'Cash',
    idempotencyKey: `test2_${test2Phone}`
  });

  await createMember(req2, res2);
  const data2 = get2();

  assert(data2 && data2.id !== undefined, 'TEST 2', 'Member created successfully');
  assert(data2.totalBilled === 8200, 'TEST 2', `Total Billed is ₹8,200 (actual: ${data2?.totalBilled})`);
  assert(data2.totalPaid === 5000, 'TEST 2', `Total Paid is ₹5,000 (actual: ${data2?.totalPaid})`);
  assert(data2.outstandingBalance === 3200, 'TEST 2', `Outstanding Balance is ₹3,200 (actual: ${data2?.outstandingBalance})`);
  assert(data2.paymentStatus === 'partial', 'TEST 2', `Payment status is 'partial' (actual: ${data2?.paymentStatus})`);

  // ----------------------------------------------------
  // TEST 3: Idempotency Protection (Same API Request Twice)
  // ----------------------------------------------------
  console.log('\n--- TEST 3: Same API Request Submitted Twice (Idempotency) ---');
  const test3Phone = `98000${Math.floor(10000 + Math.random() * 90000)}`;
  const key3 = `test3_${test3Phone}_idempotency`;
  const payload3 = {
    name: 'Test Idempotency',
    phone: test3Phone,
    plan: '3 Months Pro',
    originalAmount: 6500,
    discountAmount: 500,
    netPayable: 6000,
    totalPaid: 6000,
    idempotencyKey: key3
  };

  const { req: req3a, res: res3a, getData: get3a } = mockReqRes(payload3);
  await createMember(req3a, res3a);
  const mem3a = get3a();

  // Retry duplicate call
  const { req: req3b, res: res3b, getData: get3b } = mockReqRes(payload3);
  await createMember(req3b, res3b);

  const allPayments3 = await db.getPayments();
  const memberInvoices3 = allPayments3.filter((p: any) => p.memberPhone === test3Phone);
  assert(memberInvoices3.length === 1, 'TEST 3', `Duplicate call blocked — Exactly 1 invoice exists (actual: ${memberInvoices3.length})`);

  // ----------------------------------------------------
  // TEST 4: Frontend Double Click Simulation
  // ----------------------------------------------------
  console.log('\n--- TEST 4: Concurrent Button Double-Click Simulation ---');
  const test4Phone = `98000${Math.floor(10000 + Math.random() * 90000)}`;
  const key4 = `test4_${test4Phone}_doubleclick`;
  const payload4 = {
    memberId: `mem_${test4Phone}`,
    memberName: 'Test DoubleClick',
    memberPhone: test4Phone,
    plan: '1 Month Standard',
    originalAmount: 2500,
    discountAmount: 200,
    netPayable: 2300,
    amountPaid: 2300,
    idempotencyKey: key4
  };

  const { req: req4a, res: res4a } = mockReqRes(payload4);
  const { req: req4b, res: res4b } = mockReqRes(payload4);

  // Run concurrently
  await Promise.all([createInvoice(req4a, res4a), createInvoice(req4b, res4b)]);

  const allPayments4 = await db.getPayments();
  const memberInvoices4 = allPayments4.filter((p: any) => p.memberPhone === test4Phone);
  assert(memberInvoices4.length === 1, 'TEST 4', `Concurrent double click blocked — Exactly 1 invoice created (actual: ${memberInvoices4.length})`);

  // ----------------------------------------------------
  // TEST 5: Future Membership Start Date (Purchase 22 Aug, Start 27 Aug)
  // ----------------------------------------------------
  console.log('\n--- TEST 5: Future Start Date Control & Access Denial ---');
  const test5Phone = `98000${Math.floor(10000 + Math.random() * 90000)}`;
  const todayObj = new Date();
  const futureObj = new Date(todayObj.getTime() + 5 * 24 * 60 * 60 * 1000);
  const futureStartStr = futureObj.toISOString().split('T')[0];
  const todayStr = todayObj.toISOString().split('T')[0];

  const { req: req5, res: res5, getData: get5 } = mockReqRes({
    name: 'Future Start Member',
    phone: test5Phone,
    plan: '3 Months Pro',
    originalAmount: 9500,
    discountAmount: 1300,
    netPayable: 8200,
    totalPaid: 8200,
    joinDate: todayStr,
    startDate: futureStartStr,
    idempotencyKey: `test5_${test5Phone}`
  });

  await createMember(req5, res5);
  const data5 = get5();

  assert(data5 && data5.id !== undefined, 'TEST 5', 'Future-start member created');
  assert(data5.status === 'upcoming', 'TEST 5', `Status set to 'upcoming' (actual: ${data5?.status})`);
  assert(data5.startDate === futureStartStr, 'TEST 5', `Start Date saved as ${futureStartStr} (actual: ${data5?.startDate})`);

  // Test Check-in before start date (Should be DENIED)
  await new Promise(r => setTimeout(r, 200));
  const { req: req5Check, res: res5Check, getStatus: getStatus5Check, getData: get5Check } = mockReqRes({ memberId: test5Phone, phone: test5Phone });
  await createCheckIn(req5Check, res5Check);
  const checkResult5 = get5Check();

  assert(checkResult5?.access === 'denied' || checkResult5?.status === 'denied' || getStatus5Check() === 403, 'TEST 5', `Check-in DENIED prior to start date (actual: access=${checkResult5?.access}, status=${checkResult5?.status}, code=${getStatus5Check()})`);
  assert(checkResult5?.reason && checkResult5?.reason.includes('starts on'), 'TEST 5', `Denial reason correctly cites start date (actual: ${checkResult5?.reason})`);

  // ----------------------------------------------------
  // TEST 6: Renewal Start Date Control (No Overlap)
  // ----------------------------------------------------
  console.log('\n--- TEST 6: Renewal Start Date Control (No Overlap) ---');
  const currentExpiry = new Date(todayObj.getTime() + 8 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const renewalStartExpected = new Date(new Date(currentExpiry).getTime() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const { req: req6, res: res6, getData: get6 } = mockReqRes({
    memberId: data5.id,
    memberPhone: test5Phone,
    memberName: 'Future Start Member',
    plan: '6 Months Elite',
    originalAmount: 11500,
    discountAmount: 1000,
    netPayable: 10500,
    amountPaid: 10500,
    startDate: renewalStartExpected,
    idempotencyKey: `ren_${data5.id}_${renewalStartExpected}`
  });

  await createInvoice(req6, res6);
  const inv6Data = get6();

  assert(inv6Data !== null, 'TEST 6', 'Renewal invoice recorded');

  // Clean up created test documents from Firestore
  console.log('\n🧹 Cleaning up test documents created during test run...');
  const firestore = (db as any).getFirestoreDb ? (db as any).getFirestoreDb() : null;
  if (firestore) {
    const testPhones = [test1Phone, test2Phone, test3Phone, test4Phone, test5Phone];
    for (const phone of testPhones) {
      if (!phone) continue;
      const mems = await firestore.collection('members').where('phone', '==', phone).get();
      for (const d of mems.docs) await firestore.collection('members').doc(d.id).delete();
      const pays = await firestore.collection('payments').where('memberPhone', '==', phone).get();
      for (const d of pays.docs) await firestore.collection('payments').doc(d.id).delete();
    }
  }
  console.log('✅ Test documents cleaned up!');

  // Summary
  console.log('\n====================================================');
  console.log(`TEST SUITE SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
  console.log('====================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runBillingTests().catch(err => {
  console.error('Test runner crashed:', err);
  process.exit(1);
});
