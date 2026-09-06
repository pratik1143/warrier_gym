import { getKolkataDateString, getCalendarDaysDiff, generateAutomatedFollowups, resolveStaleRenewalFollowups } from '../services/followupAutomation.service';
import { db } from '../firebase';

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}${details ? `: ${details}` : ''}`);
    process.exit(1);
  }
}

async function runAutomatedFollowupsTestSuite() {
  console.log('====================================================');
  console.log('  RUNNING AUTOMATIC FOLLOW-UP ENGINE TEST SUITE');
  console.log('====================================================\n');

  // TEST 1: Date & Timezone math
  console.log('--- 1. Testing Date & Timezone Math ---');
  const testBaseDate = '2026-08-23';
  
  // 7 days ahead
  assert(getCalendarDaysDiff('2026-08-30', testBaseDate) === 7, '7 days ahead calculation');
  // 4 days ahead
  assert(getCalendarDaysDiff('2026-08-27', testBaseDate) === 4, '4 days ahead calculation');
  // 2 days ahead
  assert(getCalendarDaysDiff('2026-08-25', testBaseDate) === 2, '2 days ahead calculation');
  // Month boundary (Aug 31 to Sep 07 = 7 days)
  assert(getCalendarDaysDiff('2026-09-07', '2026-08-31') === 7, 'Month boundary calculation (Aug -> Sep)');
  // Year boundary (Dec 25 to Jan 01 = 7 days)
  assert(getCalendarDaysDiff('2027-01-01', '2026-12-25') === 7, 'Year boundary calculation (2026 -> 2027)');
  // Leap year 2028 (Feb 23 to Mar 01 = 7 days since Feb has 29 days)
  assert(getCalendarDaysDiff('2028-03-01', '2028-02-23') === 7, 'Leap year calculation (Feb 2028)');
  // Past date should be negative
  assert(getCalendarDaysDiff('2026-08-20', testBaseDate) === -3, 'Past date returns negative diff');

  // TEST 2: Engine Execution on Base Date 2026-08-23
  console.log('\n--- 2. Testing Engine Rules on Base Date (2026-08-23) ---');

  // Seed test members via db.addMember
  // Member A: Membership expires 2026-08-30 (7 days from 2026-08-23)
  const memberA = await db.addMember({
    id: 'test_mem_renewal_7d',
    name: 'Rahul Sharma',
    phone: '9876543210',
    plan: 'Monthly Standard',
    status: 'active',
    expiryDate: '2026-08-30',
    trainer: 'Karan Verma',
    totalBilled: 2500,
    totalPaid: 2500,
    outstandingBalance: 0
  });

  // Member B: PT package expires 2026-08-27 (4 days from 2026-08-23)
  const memberB = await db.addMember({
    id: 'test_mem_pt_4d',
    name: 'Aman Singh',
    phone: '9876543211',
    plan: 'Monthly Standard',
    status: 'active',
    expiryDate: '2026-09-15',
    isPt: true,
    ptExpiryDate: '2026-08-27',
    trainer: 'Dev Rana',
    totalBilled: 8000,
    totalPaid: 8000,
    outstandingBalance: 0
  });

  // Member C: Pending balance ₹2000 due 2026-08-25 (2 days from 2026-08-23)
  const memberC = await db.addMember({
    id: 'test_mem_bal_2d',
    name: 'Rohit Kumar',
    phone: '9876543212',
    plan: 'Quarterly Prime',
    status: 'active',
    expiryDate: '2026-11-23',
    totalBilled: 6000,
    totalPaid: 4000,
    outstandingBalance: 2000,
    balance: 2000,
    paymentStatus: 'partial',
    paymentDueDate: '2026-08-25',
    trainer: 'Receptionist'
  });

  // Member D: Zero balance (balance = 0) with payment due date in 2 days -> should NOT create follow-up
  const memberD = await db.addMember({
    id: 'test_mem_zero_bal',
    name: 'Pooja Verma',
    phone: '9876543213',
    plan: 'Monthly Standard',
    status: 'active',
    expiryDate: '2026-09-20',
    totalBilled: 2500,
    totalPaid: 2500,
    outstandingBalance: 0,
    balance: 0,
    paymentDueDate: '2026-08-25'
  });

  // Member E: Already expired membership (expiryDate = 2026-08-20, status = expired) -> should NOT create renewal follow-up
  const memberE = await db.addMember({
    id: 'test_mem_expired',
    name: 'Vikas Gupta',
    phone: '9876543214',
    plan: 'Monthly Standard',
    status: 'expired',
    expiryDate: '2026-08-20',
    outstandingBalance: 0
  });

  // Member F: Membership expiry in 5 days (not 7) -> should NOT create renewal follow-up on 2026-08-23
  const memberF = await db.addMember({
    id: 'test_mem_5d_expiry',
    name: 'Neha Singh',
    phone: '9876543215',
    plan: 'Monthly Standard',
    status: 'active',
    expiryDate: '2026-08-28',
    outstandingBalance: 0
  });

  // Clean any pre-existing test followups from previous runs
  await db.deleteFollowup(`AUTO_RENEWAL_${memberA.id}_2026-08-30`);
  await db.deleteFollowup(`AUTO_PT_RENEWAL_${memberB.id}_2026-08-27`);
  await db.deleteFollowup(`AUTO_BALANCE_${memberC.id}_2026-08-25`);

  // Run engine with base date 2026-08-23
  const runResult1 = await generateAutomatedFollowups('2026-08-23');
  console.log('Run 1 Result:', runResult1);

  assert(runResult1.generatedKeys.includes(`AUTO_RENEWAL_${memberA.id}_2026-08-30`), 'Member A Gym Renewal Follow-up created');
  assert(runResult1.generatedKeys.includes(`AUTO_PT_RENEWAL_${memberB.id}_2026-08-27`), 'Member B PT Renewal Follow-up created');
  assert(runResult1.generatedKeys.includes(`AUTO_BALANCE_${memberC.id}_2026-08-25`), 'Member C Pending Balance Follow-up created');
  assert(!runResult1.generatedKeys.some(k => k.includes(memberD.id)), 'Member D (Zero balance) NOT created');
  assert(!runResult1.generatedKeys.some(k => k.includes(memberE.id)), 'Member E (Expired) NOT created');
  assert(!runResult1.generatedKeys.some(k => k.includes(memberF.id)), 'Member F (5 days expiry) NOT created');

  // Verify created follow-up fields
  const allFls = await db.getFollowups();
  const dataA = allFls.find(f => f.id === `AUTO_RENEWAL_${memberA.id}_2026-08-30` || f.automationKey === `AUTO_RENEWAL_${memberA.id}_2026-08-30`);
  assert(dataA?.type === 'GYM MEMBERSHIP RENEWAL', 'Member A type is GYM MEMBERSHIP RENEWAL');
  assert(dataA?.priority === 'Medium', 'Member A priority is Medium');
  assert(dataA?.source === 'automatic', 'Member A source is automatic');
  assert(dataA?.dueDate === '2026-08-23', 'Member A due date is Today (2026-08-23)');

  const dataB = allFls.find(f => f.id === `AUTO_PT_RENEWAL_${memberB.id}_2026-08-27` || f.automationKey === `AUTO_PT_RENEWAL_${memberB.id}_2026-08-27`);
  assert(dataB?.type === 'PT RENEWAL', 'Member B type is PT RENEWAL');
  assert(dataB?.priority === 'High', 'Member B priority is High');
  assert(dataB?.source === 'automatic', 'Member B source is automatic');

  const dataC = allFls.find(f => f.id === `AUTO_BALANCE_${memberC.id}_2026-08-25` || f.automationKey === `AUTO_BALANCE_${memberC.id}_2026-08-25`);
  assert(dataC?.type === 'PENDING BALANCE', 'Member C type is PENDING BALANCE');
  assert(dataC?.priority === 'High', 'Member C priority is High');
  assert(dataC?.pendingAmount === 2000, 'Member C pending amount is 2000');
  assert(dataC?.source === 'automatic', 'Member C source is automatic');

  // TEST 3: Idempotency & Duplicate Prevention (Run 2 on same day)
  console.log('\n--- 3. Testing Idempotency & Duplicate Prevention ---');
  const runResult2 = await generateAutomatedFollowups('2026-08-23');
  console.log('Run 2 Result:', runResult2);
  assert(runResult2.generatedCount === 0, 'Run 2 generatedCount is 0 (No duplicates created)');
  assert(runResult2.skippedCount >= 3, 'Run 2 skippedCount >= 3 (All existing records safely skipped)');

  // TEST 4: Completed Follow-up Behaviour
  console.log('\n--- 4. Testing Completed Follow-up Behaviour ---');
  // Mark Member A's renewal follow-up as completed
  await db.updateFollowup(`AUTO_RENEWAL_${memberA.id}_2026-08-30`, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    remarks: 'Member agreed to renew next week'
  });

  // Run engine on the next day (2026-08-24) for the same membership period
  const runResultNextDay = await generateAutomatedFollowups('2026-08-24');
  assert(!runResultNextDay.generatedKeys.includes(`AUTO_RENEWAL_${memberA.id}_2026-08-30`), 'Completed follow-up is NOT recreated on next day');

  // TEST 5: Auto-resolution on Membership Renewal
  console.log('\n--- 5. Testing Auto-resolution on Renewal ---');
  // Re-create a pending follow-up for Member A
  await db.addFollowup({
    id: `AUTO_RENEWAL_${memberA.id}_2026-08-30`,
    automationKey: `AUTO_RENEWAL_${memberA.id}_2026-08-30`,
    memberId: memberA.id,
    type: 'GYM MEMBERSHIP RENEWAL',
    source: 'automatic',
    status: 'pending'
  });

  // Member renews membership to new expiry: 2026-09-30
  const resolvedCount = await resolveStaleRenewalFollowups(memberA.id, 'MEMBERSHIP', '2026-09-30');
  assert(resolvedCount >= 1, 'Stale renewal follow-up auto-resolved upon renewal');

  const flsAfterResolve = await db.getFollowups();
  const updatedFol = flsAfterResolve.find(f => f.id === `AUTO_RENEWAL_${memberA.id}_2026-08-30`);
  assert(updatedFol?.status === 'completed', 'Stale follow-up status updated to completed');
  assert(updatedFol?.outcome === 'Auto-Resolved', 'Stale follow-up outcome marked as Auto-Resolved');

  // Cleanup test docs
  await db.deleteMember(memberA.id);
  await db.deleteMember(memberB.id);
  await db.deleteMember(memberC.id);
  await db.deleteMember(memberD.id);
  await db.deleteMember(memberE.id);
  await db.deleteMember(memberF.id);
  await db.deleteFollowup(`AUTO_RENEWAL_${memberA.id}_2026-08-30`);
  await db.deleteFollowup(`AUTO_PT_RENEWAL_${memberB.id}_2026-08-27`);
  await db.deleteFollowup(`AUTO_BALANCE_${memberC.id}_2026-08-25`);

  console.log('\n====================================================');
  console.log('  🎉 ALL AUTOMATED FOLLOW-UP TESTS PASSED SUCCESSFULLY');
  console.log('====================================================\n');
  process.exit(0);
}

runAutomatedFollowupsTestSuite().catch((err) => {
  console.error('Test Suite Exception:', err);
  process.exit(1);
});
