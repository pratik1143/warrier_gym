import { importEnquiriesFromExcel, normalizePhoneNumber, parseExcelDate } from '../services/enquiryImport.service';
import { generateAutomatedFollowups, resolveStaleRenewalFollowups } from '../services/followupAutomation.service';
import { db } from '../firebase';

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}${details ? `: ${details}` : ''}`);
    process.exit(1);
  }
}

async function runEnquiryImportTestSuite() {
  console.log('===============================================================');
  console.log('  TESTING REAL ENQUIRY IMPORT + FOLLOW-UP AUTOMATION + HISTORY');
  console.log('===============================================================\n');

  const EXCEL_PATH = 'C:\\Users\\HP CONNECT\\Downloads\\inquiries 230826.xlsx';
  const TODAY = '2026-08-24';

  // 1. Test Phone Normalization
  assert(normalizePhoneNumber('+91 9988013503') === '9988013503', 'Normalizes "+91 9988013503"');
  assert(normalizePhoneNumber('9988013503') === '9988013503', 'Normalizes "9988013503"');
  assert(normalizePhoneNumber('+919988013503') === '9988013503', 'Normalizes "+919988013503"');
  assert(normalizePhoneNumber('91-99880-13503') === '9988013503', 'Normalizes "91-99880-13503"');

  // 2. Test Excel Date Parsing
  assert(parseExcelDate(46258) === '2026-08-24', 'Parses Excel serial 46258 to 2026-08-24');
  assert(parseExcelDate(46256) === '2026-08-22', 'Parses Excel serial 46256 to 2026-08-22');
  assert(parseExcelDate(46279) === '2026-09-14', 'Parses Excel serial 46279 to 2026-09-14');
  assert(parseExcelDate('24-08-2026') === '2026-08-24', 'Parses DD-MM-YYYY string to 2026-08-24');

  // 3. Run Production Import from Real Excel
  console.log('\n--- Running Real Excel Import ---');
  const report = await importEnquiriesFromExcel(EXCEL_PATH);
  console.log('Import Report:', report);

  assert(report.totalRows === 386, `Total rows in Sheet 1 is 386 (Got: ${report.totalRows})`);
  assert(report.imported === 386, `Master enquiries imported is 386 (Got: ${report.imported})`);
  assert(report.pending === 117, `Pending enquiries count is 117 (Got: ${report.pending})`);
  assert(report.closed === 269, `Closed enquiries count is 269 (Got: ${report.closed})`);
  assert(report.duplicatesPrevented === 0, `Duplicates prevented is 0 (Got: ${report.duplicatesPrevented})`);
  assert(report.invalid === 0, `Invalid rows is 0 (Got: ${report.invalid})`);
  assert(report.historicalRecordsLinked === 269, `Sheet 2 closed records linked is 269 (Got: ${report.historicalRecordsLinked})`);

  // Verify total count in DB
  const allEnquiries = await db.getEnquiries();
  assert(allEnquiries.length === 386, `Total enquiries in database is exactly 386, NOT 655 (Got: ${allEnquiries.length})`);

  // 4. Verify Individual Real Records
  const gurdeep = allEnquiries.find(e => normalizePhoneNumber(e.phone) === '9988013503');
  assert(!!gurdeep, 'Gurdeep Singh exists in dataset');
  assert(gurdeep?.status === 'Pending', 'Gurdeep Singh is Pending');
  assert(gurdeep?.nextFollowUpDate === '2026-08-24', 'Gurdeep Singh follow-up date is 2026-08-24');

  const jassi = allEnquiries.find(e => normalizePhoneNumber(e.phone) === '6280273583');
  assert(!!jassi, 'Jassi Batth exists in dataset');
  assert(jassi?.status === 'Pending', 'Jassi Batth is Pending');
  assert(jassi?.nextFollowUpDate === '2026-08-22', 'Jassi Batth follow-up date is 2026-08-22');

  const sourav = allEnquiries.find(e => normalizePhoneNumber(e.phone) === '7888778561');
  assert(!!sourav, 'Sourav 3p exists in dataset');
  assert(sourav?.status === 'Pending', 'Sourav 3p is Pending');
  assert(sourav?.nextFollowUpDate === '2026-09-14', 'Sourav 3p follow-up date is 2026-09-14');

  const yash = allEnquiries.find(e => normalizePhoneNumber(e.phone) === '7740015519');
  assert(!!yash, 'Yash exists in dataset');
  assert(yash?.status === 'Closed', 'Yash is Closed');
  assert(Array.isArray(yash?.history), 'Yash has history array');
  const closedHist = yash?.history?.find((h: any) => h.type === 'closed_import');
  assert(!!closedHist, 'Yash has linked Sheet 2 closed history');

  // 5. Follow-Up Engine Today & Queue Verification
  console.log('\n--- Checking Follow-Up Queues for Base Date: 2026-08-24 ---');
  const allFollowups = await db.getFollowups();
  const pendingFollowups = allFollowups.filter(f => f.status === 'Pending' || f.status === 'pending');

  const todayFollowups = pendingFollowups.filter(f => f.dueDate === TODAY || f.scheduledDate === TODAY);
  const overdueFollowups = pendingFollowups.filter(f => (f.dueDate || f.scheduledDate) < TODAY);
  const upcomingFollowups = pendingFollowups.filter(f => (f.dueDate || f.scheduledDate) > TODAY);

  console.log(`Follow-up counts: Today=${todayFollowups.length}, Overdue=${overdueFollowups.length}, Upcoming=${upcomingFollowups.length}`);

  // Check that 2026-08-24 has the 26 enquiries due today
  const gurdeepFollowup = todayFollowups.find(f => normalizePhoneNumber(f.phone) === '9988013503');
  assert(!!gurdeepFollowup, 'Gurdeep Singh follow-up is in Today\'s Follow-Ups queue');
  assert(gurdeepFollowup?.type === 'Enquiry', 'Follow-up type is Enquiry');
  assert(gurdeepFollowup?.source === 'automatic', 'Follow-up source is automatic');
  assert(gurdeepFollowup?.dueDate === '2026-08-24', 'Follow-up due date is 2026-08-24');

  // Check Overdue
  const jassiFollowup = overdueFollowups.find(f => normalizePhoneNumber(f.phone) === '6280273583');
  assert(!!jassiFollowup, 'Jassi Batth follow-up (22-Aug-2026) is in Overdue Tasks queue');

  // Check Upcoming
  const souravFollowup = upcomingFollowups.find(f => normalizePhoneNumber(f.phone) === '7888778561');
  assert(!!souravFollowup, 'Sourav 3p follow-up (14-Sep-2026) is in Upcoming Tasks queue');

  // 6. Test Idempotency (Re-running import must produce 0 duplicates)
  console.log('\n--- Testing Re-Import Idempotency ---');
  const report2 = await importEnquiriesFromExcel(EXCEL_PATH);
  const allEnquiriesAfterReimport = await db.getEnquiries();
  assert(allEnquiriesAfterReimport.length === 386, 'Re-importing still keeps total count at 386 (0 duplicates)');

  // 7. Test Updating Pending Enquiry to Closed
  console.log('\n--- Testing Status Change to Closed (Auto-Resolution) ---');
  const testEnq = allEnquiries.find(e => e.status === 'Pending' && e.id);
  assert(!!testEnq, 'Found pending enquiry for test');

  await resolveStaleRenewalFollowups(testEnq.id, 'ENQUIRY_CLOSED');
  const followupsAfterClose = await db.getFollowups();
  const testFol = followupsAfterClose.find(f => f.enquiryId === testEnq.id || f.id?.includes(testEnq.id));
  assert(testFol?.status === 'completed', 'Follow-up automatically marked as completed upon enquiry close');

  console.log('\n===============================================================');
  console.log('  🎉 ALL REAL ENQUIRY IMPORT & AUTOMATION TESTS PASSED 100%');
  console.log('===============================================================\n');
  process.exit(0);
}

runEnquiryImportTestSuite().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
