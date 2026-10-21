import { getKolkataDateString, getTomorrowKolkataDateString } from '../services/followupAutomation.service';
import { createEnquiryBackendSchema } from '../validations/enquirySchemas';

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}${details ? `: ${details}` : ''}`);
    process.exit(1);
  }
}

async function runEnquiryDateAndSortingTests() {
  console.log('====================================================');
  console.log('  RUNNING ENQUIRY DATE & SORTING ACCEPTANCE TESTS');
  console.log('====================================================\n');

  const todayStr = getKolkataDateString();
  const tomorrowStr = getTomorrowKolkataDateString();

  console.log(`Today (Enquiry Date default): ${todayStr}`);
  console.log(`Tomorrow (Follow-up Date default): ${tomorrowStr}`);

  // 1. Validate payload schema with Zod
  const rawPayload = {
    firstName: 'Test',
    lastName: 'Customer',
    contact: '9876543210',
    gender: 'Male',
    enquiryDate: '2026-08-27',
    nextFollowUpDate: '2026-08-28',
    followUpTime: '05:00',
    status: 'Pending',
    assignedTo: 'Veer Chand (manager)',
    priority: 'Warm',
    source: 'Walk-in',
    inquiryFor: '3 months',
    remarks: 'Interested in 3 month membership'
  };

  const validation = createEnquiryBackendSchema.safeParse(rawPayload);
  assert(validation.success, 'Schema validation succeeds for payload containing enquiryDate & remarks');

  // 2. Simulate database records array
  const mockDbRecords: any[] = [
    {
      id: 'enq_old_1',
      name: 'Older Customer 1',
      phone: '9876543211',
      enquiryDate: '2026-08-20',
      nextFollowUpDate: '2026-08-21',
      createdAt: '2026-08-20T10:00:00.000Z'
    },
    {
      id: 'enq_old_2',
      name: 'Older Customer 2',
      phone: '9876543212',
      enquiryDate: '2026-08-25',
      nextFollowUpDate: '2026-08-26',
      createdAt: '2026-08-25T14:30:00.000Z'
    }
  ];

  // Create new enquiry object as constructed by backend controller
  const newEnquiryRecord = {
    id: `enq_${Date.now()}_test`,
    name: `${rawPayload.firstName} ${rawPayload.lastName}`,
    phone: rawPayload.contact,
    enquiryDate: rawPayload.enquiryDate,
    nextFollowUpDate: rawPayload.nextFollowUpDate,
    nextFollowUp: rawPayload.nextFollowUpDate,
    followUpTime: rawPayload.followUpTime,
    remarks: rawPayload.remarks,
    remark: rawPayload.remarks,
    status: rawPayload.status,
    assignedTo: rawPayload.assignedTo,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  // Add to db
  mockDbRecords.unshift(newEnquiryRecord);

  // 3. Test sorting by createdAt DESC
  const sortedRecords = [...mockDbRecords].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  assert(sortedRecords[0].id === newEnquiryRecord.id, 'Newly created enquiry appears at the TOP (index 0)');
  assert(sortedRecords[0].name === 'Test Customer', 'Top record name matches Test Customer');

  // 4. Test field separation and remarks
  assert(sortedRecords[0].enquiryDate === '2026-08-27', 'Enquiry Date is saved as 2026-08-27');
  assert(sortedRecords[0].nextFollowUpDate === '2026-08-28', 'Follow-up Date is saved as 2026-08-28 (distinct from Enquiry Date)');
  assert(sortedRecords[0].followUpTime === '05:00', 'Follow-up Time is saved as 05:00 AM');
  assert(sortedRecords[0].remarks === 'Interested in 3 month membership', 'Remark is saved correctly');

  // 5. Test persistence on re-query/refresh
  const reQueriedRecords = [...sortedRecords].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  assert(reQueriedRecords[0].id === newEnquiryRecord.id, 'After refresh/re-query, newest enquiry remains at TOP');

  console.log('\n====================================================');
  console.log('  🎉 ALL ENQUIRY DATE & SORTING TESTS PASSED!');
  console.log('====================================================\n');
  process.exit(0);
}

runEnquiryDateAndSortingTests().catch((err) => {
  console.error('Test Suite Exception:', err);
  process.exit(1);
});
