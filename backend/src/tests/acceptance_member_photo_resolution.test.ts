function assert(condition: boolean, testName: string, details?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
  } else {
    console.error(`❌ [FAIL] ${testName}${details ? `: ${details}` : ''}`);
    process.exit(1);
  }
}

// Simulated Members List in Gym Store
const storeMembers: any[] = [
  {
    id: 'mem_001',
    memberId: 'AZ-2026-001',
    name: 'Aarav Sharma',
    gender: 'Male',
    photo: 'https://images.example.com/aarav.jpg',
    phone: '9876543201'
  },
  {
    id: 'mem_002',
    memberId: 'AZ-2026-002',
    name: 'Bhavna Patel',
    gender: 'Female',
    avatarUrl: 'https://images.example.com/bhavna.jpg',
    phone: '9876543202'
  },
  {
    id: 'mem_003',
    memberId: 'AZ-2026-003',
    name: 'Chirag Verma',
    gender: 'Male',
    photoURL: 'https://images.example.com/chirag.jpg',
    phone: '9876543203'
  },
  {
    id: 'mem_004',
    memberId: 'AZ-2026-004',
    name: 'Devraj Singh',
    gender: 'Male',
    photo: null,
    phone: '9876543204'
  },
  {
    id: 'mem_005',
    memberId: 'AZ-2026-005',
    name: 'Ekta Kapoor',
    gender: 'Female',
    photo: null,
    phone: '9876543205'
  }
];

// Simulated Client Details Resolver logic
function resolveClientDetails(task: any, membersList: any[]) {
  let name = task.name || task.memberName || '';
  let phone = task.phone || task.memberPhone || '';
  let photo: string | null = task.photo || task.photoURL || task.avatarUrl || task.avatar || task.profilePhotoUrl || task.profilePhoto || null;
  let gender: string | null = task.gender || null;

  const targetMemberId = task.memberId || task.member_id;
  let matchedMember: any = null;

  if (targetMemberId) {
    const cleanId = String(targetMemberId).trim();
    matchedMember = membersList.find((x: any) => 
      String(x.id).trim() === cleanId || 
      (x.memberId && String(x.memberId).trim() === cleanId)
    );
  }

  if (matchedMember) {
    name = matchedMember.name || name;
    phone = matchedMember.phone || phone;
    photo = matchedMember.photo || matchedMember.avatarUrl || matchedMember.avatar || matchedMember.photoURL || matchedMember.profilePhotoUrl || matchedMember.profilePhoto || photo;
    gender = matchedMember.gender || gender;
  }

  return {
    name,
    phone,
    photo: (photo && typeof photo === 'string' && photo.trim() !== '') ? photo.trim() : null,
    gender
  };
}

function resolveFallbackAvatar(gender?: string | null): string {
  const g = (gender || '').toLowerCase().trim();
  if (g === 'female' || g === 'f' || g === 'woman') return '/avatar-female.jpg';
  if (g === 'male' || g === 'm' || g === 'man') return '/avatar-male.jpg';
  return '/avatar-male.jpg';
}

async function runPhotoResolutionTests() {
  console.log('====================================================');
  console.log('  RUNNING MEMBER PROFILE PHOTO RESOLUTION TESTS');
  console.log('====================================================\n');

  // Simulated Follow-up tasks
  const followUpTasks = [
    { id: 'fol_1', memberId: 'mem_001', title: 'Membership Renewal: Aarav' },
    { id: 'fol_2', memberId: 'mem_002', title: 'Membership Renewal: Bhavna' },
    { id: 'fol_3', memberId: 'mem_003', title: 'Membership Renewal: Chirag' },
    { id: 'fol_4', memberId: 'mem_004', title: 'Membership Renewal: Devraj' },
    { id: 'fol_5', memberId: 'mem_005', title: 'Membership Renewal: Ekta' }
  ];

  // 1. Member A (Aarav) with uploaded photo
  const res1 = resolveClientDetails(followUpTasks[0], storeMembers);
  assert(res1.photo === 'https://images.example.com/aarav.jpg', 'Follow-Up 1 displays Aarav uploaded photo');
  assert(res1.photo === storeMembers[0].photo, 'Follow-Up 1 photo MATCHES Member Profile photo for Aarav');

  // 2. Member B (Bhavna) with uploaded photo
  const res2 = resolveClientDetails(followUpTasks[1], storeMembers);
  assert(res2.photo === 'https://images.example.com/bhavna.jpg', 'Follow-Up 2 displays Bhavna uploaded photo');
  assert(res2.photo === storeMembers[1].avatarUrl, 'Follow-Up 2 photo MATCHES Member Profile photo for Bhavna');

  // 3. Member C (Chirag) with uploaded photo
  const res3 = resolveClientDetails(followUpTasks[2], storeMembers);
  assert(res3.photo === 'https://images.example.com/chirag.jpg', 'Follow-Up 3 displays Chirag uploaded photo');
  assert(res3.photo === storeMembers[2].photoURL, 'Follow-Up 3 photo MATCHES Member Profile photo for Chirag');

  // 4. Member D (Devraj - Male without photo)
  const res4 = resolveClientDetails(followUpTasks[3], storeMembers);
  assert(res4.photo === null, 'Devraj has no uploaded photo (resolves null)');
  assert(resolveFallbackAvatar(res4.gender) === '/avatar-male.jpg', 'Devraj (Male without photo) uses /avatar-male.jpg fallback');

  // 5. Member E (Ekta - Female without photo)
  const res5 = resolveClientDetails(followUpTasks[4], storeMembers);
  assert(res5.photo === null, 'Ekta has no uploaded photo (resolves null)');
  assert(resolveFallbackAvatar(res5.gender) === '/avatar-female.jpg', 'Ekta (Female without photo) uses /avatar-female.jpg fallback');

  // 6. Verify non-crosstalk: photo 1 != photo 2 != photo 3
  assert(res1.photo !== res2.photo && res2.photo !== res3.photo, 'All 3 members display their OWN unique profile photos without crosstalk');

  console.log('\n====================================================');
  console.log('  🎉 ALL MEMBER PROFILE PHOTO RESOLUTION TESTS PASSED!');
  console.log('====================================================\n');
  process.exit(0);
}

runPhotoResolutionTests().catch((err) => {
  console.error('Test Suite Exception:', err);
  process.exit(1);
});
