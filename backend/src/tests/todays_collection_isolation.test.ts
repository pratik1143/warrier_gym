process.env.NODE_ENV = 'test';
process.env.SKIP_REAL_EMAIL = 'true';

import { db, mockPayments, mockMembers, saveMockDb } from '../firebase';
import { createInvoice } from '../controllers/billing.controller';

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

async function runTests() {
  console.log('==============================================================');
  console.log("RUNNING TODAY'S COLLECTION HISTORICAL ISOLATION TEST SUITE");
  console.log('==============================================================\n');

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

  // Clear mock state for clean isolated test run
  mockPayments.length = 0;
  mockMembers.length = 0;

  const todayStr = new Date().toISOString().split('T')[0];

  // ----------------------------------------------------
  // TEST 1: Database contains Historical: ₹5,000 — 14 Jun 2026. Today: No payment.
  // Expected: Today's Collection = ₹0, Total Revenue = ₹5,000
  // ----------------------------------------------------
  console.log("--- TEST 1: Historical ₹5,000 (14 Jun 2026) -> Today's Collection = ₹0 ---");
  mockPayments.push({
    id: 'inv_hist_1',
    invoiceNumber: 'INV-LEG-001',
    memberId: 'member_001',
    memberName: 'Preet Rajput',
    amount: 5000,
    amountPaid: 5000,
    paid: 5000,
    date: '2026-06-14',
    paymentDate: '2026-06-14',
    status: 'paid',
    transactionType: 'historical_import',
    isHistorical: true,
    imported: true,
    isLegacyImport: true,
    createdAt: new Date().toISOString() // Created today in db during import
  });

  const analytics1 = await db.getDashboardAnalytics();
  const allPayments1 = await db.getPayments();
  const totalRev1 = allPayments1.reduce((sum: number, p: any) => sum + (Number(p.paid) || Number(p.amount) || 0), 0);

  assert(analytics1.todayCollection === 0, 'TEST 1 - Today Collection', `Expected ₹0, got ₹${analytics1.todayCollection}`);
  assert(totalRev1 === 5000, 'TEST 1 - Total Revenue', `Expected ₹5,000, got ₹${totalRev1}`);

  // ----------------------------------------------------
  // TEST 2: Historical: ₹5,000 — 14 Jun 2026. New payment today: ₹3,000.
  // Expected: Today's Collection = ₹3,000, Total Revenue = ₹8,000
  // ----------------------------------------------------
  console.log("\n--- TEST 2: New Payment ₹3,000 Today -> Today's Collection = ₹3,000, Total = ₹8,000 ---");
  await db.addPayment({
    id: 'inv_new_1',
    invoiceNumber: 'INV-NEW-001',
    memberId: 'member_002',
    memberName: 'Kiran',
    amount: 3000,
    amountPaid: 3000,
    paid: 3000,
    date: todayStr,
    paymentDate: todayStr,
    transactionType: 'membership_payment',
    isHistorical: false,
    imported: false,
    status: 'paid',
    isRealTimeToday: true
  });

  const analytics2 = await db.getDashboardAnalytics();
  const allPayments2 = await db.getPayments();
  const totalRev2 = allPayments2.reduce((sum: number, p: any) => sum + (Number(p.paid) || Number(p.amount) || 0), 0);

  assert(analytics2.todayCollection === 3000, 'TEST 2 - Today Collection', `Expected ₹3,000, got ₹${analytics2.todayCollection}`);
  assert(totalRev2 === 8000, 'TEST 2 - Total Revenue', `Expected ₹8,000, got ₹${totalRev2}`);

  // ----------------------------------------------------
  // TEST 3: Historical: ₹5,000 + New Membership: ₹3,000 + New PT: ₹2,000
  // Expected: Today's Collection = ₹5,000, Total Revenue = ₹10,000
  // ----------------------------------------------------
  console.log("\n--- TEST 3: PT Payment ₹2,000 Today -> Today's Collection = ₹5,000, Total = ₹10,000 ---");
  await db.addPayment({
    id: 'inv_pt_1',
    invoiceNumber: 'INV-PT-001',
    memberId: 'member_003',
    memberName: 'Aman',
    amount: 2000,
    amountPaid: 2000,
    paid: 2000,
    date: todayStr,
    paymentDate: todayStr,
    transactionType: 'pt_payment',
    isHistorical: false,
    imported: false,
    status: 'paid',
    isRealTimeToday: true
  });

  const analytics3 = await db.getDashboardAnalytics();
  const allPayments3 = await db.getPayments();
  const totalRev3 = allPayments3.reduce((sum: number, p: any) => sum + (Number(p.paid) || Number(p.amount) || 0), 0);

  assert(analytics3.todayCollection === 5000, 'TEST 3 - Today Collection', `Expected ₹5,000, got ₹${analytics3.todayCollection}`);
  assert(totalRev3 === 10000, 'TEST 3 - Total Revenue', `Expected ₹10,000, got ₹${totalRev3}`);

  // ----------------------------------------------------
  // TEST 4: Member has Paid: ₹4,000, Balance: ₹2,000. No payment today.
  // Expected: Today's Collection = ₹5,000 (from Test 2+3), no additional inflation.
  // ----------------------------------------------------
  console.log("\n--- TEST 4: Member with Paid ₹4,000 & Balance ₹2,000 (No payment today) ---");
  const member4 = await db.addMember({
    id: 'm_bal_1',
    name: 'Rohit',
    phone: '9888877777',
    plan: 'Monthly Standard',
    price: 6000,
    totalBilled: 6000,
    amountPaid: 4000,
    totalPaid: 4000,
    outstandingBalance: 2000,
    balance: 2000,
    paymentStatus: 'partial',
    joinDate: '2026-06-01'
  });

  // Historical invoice for Rohit
  mockPayments.push({
    id: 'inv_hist_rohit',
    invoiceNumber: 'INV-LEG-ROHIT',
    memberId: 'm_bal_1',
    memberName: 'Rohit',
    amount: 6000,
    amountPaid: 4000,
    paid: 4000,
    outstandingAmount: 2000,
    date: '2026-06-01',
    paymentDate: '2026-06-01',
    status: 'partial',
    transactionType: 'historical_import',
    isHistorical: true,
    imported: true
  });

  const analytics4 = await db.getDashboardAnalytics();
  assert(analytics4.todayCollection === 5000, 'TEST 4 - Today Collection', `Expected ₹5,000 (from Test 2+3), got ₹${analytics4.todayCollection}`);

  // ----------------------------------------------------
  // TEST 5: Member pays balance ₹2,000 today via createInvoice
  // Expected: Today's Collection = ₹7,000 (5000 + 2000), Member Balance = ₹0
  // ----------------------------------------------------
  console.log("\n--- TEST 5: Member pays balance ₹2,000 today ---");
  const { req: req5, res: res5, getData: get5 } = mockReqRes({
    memberId: member4.id,
    amount: 2000,
    amountPaid: 2000,
    paid: 2000,
    date: todayStr,
    transactionType: 'membership_payment'
  });

  await createInvoice(req5, res5);

  const updatedMembers = await db.getMembers();
  const rohitUpdated = updatedMembers.find((m: any) => m.id === member4.id);
  const analytics5 = await db.getDashboardAnalytics();

  assert(analytics5.todayCollection === 7000, 'TEST 5 - Today Collection', `Expected ₹7,000, got ₹${analytics5.todayCollection}`);
  assert(rohitUpdated?.outstandingBalance === 0, 'TEST 5 - Member Balance', `Expected ₹0, got ₹${rohitUpdated?.outstandingBalance}`);
  assert(rohitUpdated?.paymentStatus === 'paid', 'TEST 5 - Member Payment Status', `Expected 'paid', got '${rohitUpdated?.paymentStatus}'`);

  console.log('\n==============================================================');
  console.log(`TEST SUITE RESULTS: ${passedCount} PASSED / ${failedCount} FAILED`);
  console.log('==============================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test Suite Exception:', err);
  process.exit(1);
});
