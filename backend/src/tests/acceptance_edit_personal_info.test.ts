import { db } from '../firebase';

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}${details ? `: ${details}` : ''}`);
    process.exit(1);
  }
}

async function runEditPersonalInfoAcceptanceTest() {
  console.log('====================================================');
  console.log('  RUNNING EDIT PERSONAL INFO ACCEPTANCE TEST SUITE');
  console.log('====================================================\n');

  let testMember: any = null;

  try {
    // 1. Create initial test member with Male gender
    testMember = await db.addMember({
      id: 'mem_edit_test_' + Date.now(),
      name: 'Rohan Sharma',
      phone: '9876543210',
      email: 'rohan@example.com',
      gender: 'Male',
      dob: '1995-05-15',
      occupation: 'Software Engineer',
      emergencyContact: 'Father: 9876543211',
      address: 'Mohali, Punjab',
      plan: 'Monthly Standard',
      status: 'active',
      totalBilled: 5000,
      totalPaid: 5000,
      outstandingBalance: 0,
      trainer: 'Karan Verma'
    });

    assert(testMember.gender === 'Male', 'Initial member created with gender: Male');

    // 2. Test updating Gender to "Female"
    const femaleUpdatePayload = {
      name: testMember.name,
      phone: testMember.phone,
      email: testMember.email,
      dob: testMember.dob,
      gender: 'Female',
      occupation: testMember.occupation,
      emergencyContact: testMember.emergencyContact,
      address: testMember.address,
      updatedAt: new Date().toISOString()
    };

    const updatedToFemale = await db.updateMember(testMember.id, femaleUpdatePayload);
    assert(updatedToFemale.gender === 'Female', 'Member gender updated to "Female" successfully');
    assert(updatedToFemale.plan === 'Monthly Standard', 'Partial update preserved plan ("Monthly Standard")');
    assert(updatedToFemale.trainer === 'Karan Verma', 'Partial update preserved trainer ("Karan Verma")');

    // 3. Test updating Gender to "Not specified" and blank DOB
    const notSpecifiedUpdatePayload = {
      gender: 'Not specified',
      dob: null,
      updatedAt: new Date().toISOString()
    };

    const updatedToNotSpecified = await db.updateMember(testMember.id, notSpecifiedUpdatePayload);
    assert(updatedToNotSpecified.gender === 'Not specified', 'Member gender updated to "Not specified" successfully');
    assert(updatedToNotSpecified.dob === null || updatedToNotSpecified.dob === '', 'Blank DOB handled safely as null/empty');

    // 4. Test updating Gender back to "Male"
    const maleUpdatePayload = {
      gender: 'Male',
      updatedAt: new Date().toISOString()
    };

    const updatedToMale = await db.updateMember(testMember.id, maleUpdatePayload);
    assert(updatedToMale.gender === 'Male', 'Member gender updated back to "Male" successfully');

    // 5. Verify database single source of truth on fresh fetch
    const freshMembers = await db.getMembers();
    const fetchedMember = freshMembers.find((m: any) => m.id === testMember.id);
    assert(fetchedMember?.gender === 'Male', 'Database fresh fetch confirms gender = Male');

  } finally {
    // Guaranteed Cleanup
    if (testMember?.id) {
      await db.deleteMember(testMember.id);
    }
  }

  console.log('\n====================================================');
  console.log('  🎉 ALL EDIT PERSONAL INFO TESTS PASSED 100%!');
  console.log('====================================================\n');
  process.exit(0);
}

runEditPersonalInfoAcceptanceTest().catch((err) => {
  console.error('❌ Test Exception:', err);
  process.exit(1);
});
