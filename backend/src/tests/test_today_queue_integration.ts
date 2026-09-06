import { getKolkataDateString, getCalendarDaysDiff, generateAutomatedFollowups } from '../services/followupAutomation.service';
import { db } from '../firebase';

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}${details ? `: ${details}` : ''}`);
    process.exit(1);
  }
}

async function runTodayQueueIntegrationTest() {
  console.log('====================================================');
  console.log('  TESTING AUTO FOLLOW-UP IN TODAY QUEUE (24-AUG-2026)');
  console.log('====================================================\n');

  const TODAY = '2026-08-24';
  const EXPIRY = '2026-08-31';

  // 1. Check Date Math
  const daysDiff = getCalendarDaysDiff(EXPIRY, TODAY);
  console.log(`Days between ${TODAY} and ${EXPIRY}: ${daysDiff} days`);
  assert(daysDiff === 7, 'Expiry is exactly 7 days from today (24-Aug-2026 to 31-Aug-2026)');

  // 2. Create Real Member with Expiry on 31 August 2026
  const testMember = await db.addMember({
    id: 'mem_e2e_rahul_20260831',
    name: 'Rahul Sharma',
    phone: '9876543210',
    plan: 'Monthly Standard',
    status: 'active',
    expiryDate: EXPIRY,
    trainer: 'Receptionist',
    totalBilled: 2500,
    totalPaid: 2500,
    outstandingBalance: 0
  });

  // Clean any old follow-ups for this key
  const autoKey = `AUTO_RENEWAL_${testMember.id}_${EXPIRY}`;
  await db.deleteFollowup(autoKey);

  // 3. Execute Automation Engine for Today (2026-08-24)
  console.log('\n--- Running Automation Engine for 24-Aug-2026 ---');
  const genResult = await generateAutomatedFollowups(TODAY);
  console.log('Engine Result:', genResult);

  assert(genResult.generatedKeys.includes(autoKey), 'Follow-up created with key: ' + autoKey);

  // 4. Verify Follow-Up Properties
  const allFollowups = await db.getFollowups();
  const createdTask = allFollowups.find(f => f.id === autoKey || f.automationKey === autoKey);

  assert(!!createdTask, 'Created task exists in database');
  assert(createdTask?.dueDate === TODAY, `dueDate is exactly TODAY (${TODAY})`);
  assert(createdTask?.status === 'pending' || createdTask?.status === 'Pending', 'status is Pending');
  assert(createdTask?.source === 'automatic', 'source is Automatic');
  assert(createdTask?.type === 'GYM MEMBERSHIP RENEWAL', 'type is GYM MEMBERSHIP RENEWAL');
  assert(createdTask?.reason === 'Membership renewal due in 7 days', 'reason is "Membership renewal due in 7 days"');
  assert(createdTask?.priority === 'Medium', 'priority is Medium');

  // 5. Verify Today's Queue filtering logic
  const todayPendingTasks = allFollowups.filter(f => 
    (f.status === 'pending' || f.status === 'Pending') && 
    (f.dueDate === TODAY || f.scheduledDate === TODAY)
  );
  assert(todayPendingTasks.some(f => f.id === autoKey), 'Task is in Today\'s Queue');

  // 6. Complete the Follow-up Task
  console.log('\n--- Completing Follow-Up Task ---');
  await db.updateFollowup(autoKey, {
    status: 'completed',
    completedAt: new Date().toISOString(),
    remarks: 'Spoke with Rahul, renewal confirmed',
    outcome: 'Connected'
  });

  const allAfterComplete = await db.getFollowups();
  const completedTask = allAfterComplete.find(f => f.id === autoKey);
  assert(completedTask?.status === 'completed', 'Task status changed to completed');

  const todayPendingAfterComplete = allAfterComplete.filter(f => 
    (f.status === 'pending' || f.status === 'Pending') && 
    (f.dueDate === TODAY || f.scheduledDate === TODAY)
  );
  assert(!todayPendingAfterComplete.some(f => f.id === autoKey), 'Task immediately removed from Today\'s Pending Queue');

  // 7. Refresh / Rerun Engine on Same Day and Next Day
  console.log('\n--- Rerunning Engine (Refresh / Idempotency Check) ---');
  const genResult2 = await generateAutomatedFollowups(TODAY);
  assert(!genResult2.generatedKeys.includes(autoKey), 'Completed task is NOT recreated on same-day rerun');

  const genResultNextDay = await generateAutomatedFollowups('2026-08-25');
  assert(!genResultNextDay.generatedKeys.includes(autoKey), 'Completed task is NOT recreated on next day');

  // Cleanup
  await db.deleteMember(testMember.id);
  await db.deleteFollowup(autoKey);

  console.log('\n====================================================');
  console.log('  🎉 FINAL TEST CASE 15 PASSED WITH 100% SUCCESS');
  console.log('====================================================\n');
  process.exit(0);
}

runTodayQueueIntegrationTest().catch(err => {
  console.error('Test Exception:', err);
  process.exit(1);
});
