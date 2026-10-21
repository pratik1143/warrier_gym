import { formatRenewalCountdown, getCalendarDaysDiff, generateAutomatedFollowups, resolveStaleRenewalFollowups } from '../services/followupAutomation.service';
import { db } from '../firebase';

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}${details ? `: ${details}` : ''}`);
    process.exit(1);
  }
}

async function runAcceptanceTest() {
  console.log('====================================================');
  console.log('  RUNNING ACCEPTANCE TEST: DYNAMIC EXPIRY MAPPING');
  console.log('====================================================\n');

  const baseDate = '2026-08-27';

  // 1. TEST UNIT DYNAMIC COUNTDOWN CALCULATIONS
  console.log('--- 1. Testing formatRenewalCountdown Unit Logic ---');

  // Member A: Expiry = 29 Aug 2026
  const memberA = formatRenewalCountdown('2026-08-29', baseDate);
  assert(memberA.daysRemaining === 2, 'Member A daysRemaining is 2');
  assert(memberA.displayText === 'Membership renewal due in 2 days', 'Member A text is "Membership renewal due in 2 days"');
  assert(!memberA.isExpired, 'Member A is not expired');

  // Member B: Expiry = 30 Aug 2026
  const memberB = formatRenewalCountdown('2026-08-30', baseDate);
  assert(memberB.daysRemaining === 3, 'Member B daysRemaining is 3');
  assert(memberB.displayText === 'Membership renewal due in 3 days', 'Member B text is "Membership renewal due in 3 days"');
  assert(!memberB.isExpired, 'Member B is not expired');

  // Member C: Expiry = 03 Sep 2026
  const memberC = formatRenewalCountdown('2026-09-03', baseDate);
  assert(memberC.daysRemaining === 7, 'Member C daysRemaining is 7');
  assert(memberC.displayText === 'Membership renewal due in 7 days', 'Member C text is "Membership renewal due in 7 days"');
  assert(!memberC.isExpired, 'Member C is not expired');

  // Member D: Expiry = 28 Aug 2026
  const memberD = formatRenewalCountdown('2026-08-28', baseDate);
  assert(memberD.daysRemaining === 1, 'Member D daysRemaining is 1');
  assert(memberD.displayText === 'Membership renewal due tomorrow', 'Member D text is "Membership renewal due tomorrow"');
  assert(!memberD.isExpired, 'Member D is not expired');

  // Member E: Expiry = 27 Aug 2026
  const memberE = formatRenewalCountdown('2026-08-27', baseDate);
  assert(memberE.daysRemaining === 0, 'Member E daysRemaining is 0');
  assert(memberE.displayText === 'Membership expires today', 'Member E text is "Membership expires today"');
  assert(!memberE.isExpired, 'Member E is not expired');

  // Member F: Expiry = 26 Aug 2026
  const memberF = formatRenewalCountdown('2026-08-26', baseDate);
  assert(memberF.daysRemaining === -1, 'Member F daysRemaining is -1');
  assert(memberF.displayText === 'Membership expired 1 day ago', 'Member F text is "Membership expired 1 day ago"');
  assert(memberF.isExpired, 'Member F is expired');

  // 2. TEST TYPE STYLING FOR EXPIRED MEMBERSHIPS
  console.log('\n--- 2. Testing Expiry Flag for Active vs Expired ---');

  const activeRes = formatRenewalCountdown('2026-08-29', baseDate);
  const expiredRes = formatRenewalCountdown('2026-08-26', baseDate);

  assert(!activeRes.isExpired, 'Active renewal task has isExpired=false');
  assert(expiredRes.isExpired, 'Expired renewal task has isExpired=true');

  // 3. TEST BACKEND GENERATION ENGINE INTEGRATION
  console.log('\n--- 3. Testing Backend Automation Engine Generation ---');

  let mA: any = null;
  let mE: any = null;

  try {
    mA = await db.addMember({
      id: 'test_acc_mem_A',
      name: 'Acceptance Member A',
      phone: '9900000001',
      status: 'active',
      expiryDate: '2026-08-29'
    });

    mE = await db.addMember({
      id: 'test_acc_mem_E',
      name: 'Acceptance Member E',
      phone: '9900000005',
      status: 'active',
      expiryDate: '2026-08-27'
    });

    await db.deleteFollowup(`AUTO_RENEWAL_${mA.id}_2026-08-29`);
    await db.deleteFollowup(`AUTO_RENEWAL_${mE.id}_2026-08-27`);

    const genResult = await generateAutomatedFollowups('2026-08-27');
    assert(genResult.generatedKeys.includes(`AUTO_RENEWAL_${mA.id}_2026-08-29`), 'Member A auto renewal created');
    assert(genResult.generatedKeys.includes(`AUTO_RENEWAL_${mE.id}_2026-08-27`), 'Member E (expires today) auto renewal created');

    const allFollowups = await db.getFollowups();
    const folA = allFollowups.find((f: any) => f.id === `AUTO_RENEWAL_${mA.id}_2026-08-29`);
    assert(folA?.reason === 'GYM MEMBERSHIP RENEWAL', 'Follow-up reason is clean generic GYM MEMBERSHIP RENEWAL without hardcoded 7 days text');
    assert(folA?.expiryDate === '2026-08-29', 'Follow-up stores single source of truth expiryDate');
  } finally {
    // Guaranteed Cleanup
    if (mA?.id) {
      await db.deleteMember(mA.id);
      await db.deleteFollowup(`AUTO_RENEWAL_${mA.id}_2026-08-29`);
    }
    if (mE?.id) {
      await db.deleteMember(mE.id);
      await db.deleteFollowup(`AUTO_RENEWAL_${mE.id}_2026-08-27`);
    }
  }

  console.log('\n====================================================');
  console.log('  🎉 ALL ACCEPTANCE TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================\n');
  process.exit(0);
}

runAcceptanceTest().catch((err) => {
  console.error('Acceptance Test Exception:', err);
  process.exit(1);
});
