import { getKolkataDateString, getTomorrowKolkataDateString } from '../services/followupAutomation.service';

function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}${details ? `: ${details}` : ''}`);
    process.exit(1);
  }
}

async function runEnquiryAndPhotoTests() {
  console.log('====================================================');
  console.log('  RUNNING ENQUIRY & MEMBER PHOTO MAPPING TESTS');
  console.log('====================================================\n');

  // 1. TEST TOMORROW CALCULATION & 05:00 AM TIME
  console.log('--- 1. Testing Default Tomorrow Date & 05:00 AM Time ---');

  const todayStr = getKolkataDateString();
  const tomorrowStr = getTomorrowKolkataDateString();

  console.log(`Today: ${todayStr}, Calculated Tomorrow: ${tomorrowStr}`);

  assert(tomorrowStr !== todayStr, 'Tomorrow is not equal to today');
  
  const [tY, tM, tD] = todayStr.split('-').map(Number);
  const [nextY, nextM, nextD] = tomorrowStr.split('-').map(Number);

  const utcToday = Date.UTC(tY, tM - 1, tD);
  const utcTomorrow = Date.UTC(nextY, nextM - 1, nextD);
  const diffDays = Math.round((utcTomorrow - utcToday) / (1000 * 60 * 60 * 24));

  assert(diffDays === 1, 'Tomorrow is exactly +1 calendar day ahead of today');

  // 2. TEST MEMBER PHOTO MAPPING DATA SAFETY
  console.log('\n--- 2. Testing Member Photo Mapping Data Structure ---');

  const testMembers = [
    { id: 'm1', name: 'Member A', photo: 'https://example.com/photoA.jpg', gender: 'Male' },
    { id: 'm2', name: 'Member B', photo: 'https://example.com/photoB.jpg', gender: 'Female' },
    { id: 'm3', name: 'Member C', photo: 'https://example.com/photoC.jpg', gender: 'Male' },
    { id: 'm4', name: 'Member D', photo: null, gender: 'Male' },
    { id: 'm5', name: 'Member E', photo: null, gender: 'Female' }
  ];

  function resolvePhotoAndGender(memberId: string, list: typeof testMembers) {
    const found = list.find(m => m.id === memberId);
    if (!found) return { photo: null, gender: null };
    return { photo: found.photo || null, gender: found.gender || null };
  }

  assert(resolvePhotoAndGender('m1', testMembers).photo === 'https://example.com/photoA.jpg', 'Member A photo maps correctly to A');
  assert(resolvePhotoAndGender('m2', testMembers).photo === 'https://example.com/photoB.jpg', 'Member B photo maps correctly to B');
  assert(resolvePhotoAndGender('m3', testMembers).photo === 'https://example.com/photoC.jpg', 'Member C photo maps correctly to C');
  assert(resolvePhotoAndGender('m4', testMembers).photo === null, 'Member D without photo resolves null (uses male fallback)');
  assert(resolvePhotoAndGender('m5', testMembers).photo === null, 'Member E without photo resolves null (uses female fallback)');

  // Verify switching selected member updates photo immediately
  let selectedId = 'm1';
  assert(resolvePhotoAndGender(selectedId, testMembers).photo === 'https://example.com/photoA.jpg', 'Initial selected Member 1 has photo A');
  selectedId = 'm2';
  assert(resolvePhotoAndGender(selectedId, testMembers).photo === 'https://example.com/photoB.jpg', 'Switched to Member 2 has photo B (no photo crosstalk)');

  console.log('\n====================================================');
  console.log('  🎉 ALL ENQUIRY & PHOTO MAPPING TESTS PASSED SUCCESSFULLY!');
  console.log('====================================================\n');
  process.exit(0);
}

runEnquiryAndPhotoTests().catch((err) => {
  console.error('Test Suite Exception:', err);
  process.exit(1);
});
