import { getInvoices } from './controllers/billing.controller';
import { getWorkoutPlan, getDietPlan } from './controllers/trainer.controller';
import { getReferralsByMember } from './controllers/progress.controller';
import { db } from './firebase';

const mockReq = (params = {}, body = {}) => ({
  params,
  body,
  headers: {}
}) as any;

const mockRes = {
  json: (data: any) => {
    console.log('SUCCESS:', JSON.stringify(data, null, 2).substring(0, 250));
  },
  status: (code: number) => {
    console.log(`STATUS Code: ${code}`);
    return {
      json: (data: any) => {
        console.error(`ERROR (${code}):`, data);
      }
    };
  }
} as any;

async function runTests() {
  // Find a real member ID if available, otherwise fallback to 'm1'
  let memberId = 'm1';
  try {
    const members = await db.getMembers();
    if (members.length > 0) {
      memberId = members[0].id;
      console.log(`Using real member ID: ${memberId}`);
    }
  } catch (err) {
    console.warn('Failed to fetch members for ID lookup, using m1 fallback:', err);
  }

  console.log('\n--- Testing getInvoices ---');
  try {
    await getInvoices(mockReq(), mockRes);
  } catch (e) {
    console.error('getInvoices crashed:', e);
  }

  console.log('\n--- Testing getWorkoutPlan ---');
  try {
    await getWorkoutPlan(mockReq({ memberId }), mockRes);
  } catch (e) {
    console.error('getWorkoutPlan crashed:', e);
  }

  console.log('\n--- Testing getDietPlan ---');
  try {
    await getDietPlan(mockReq({ memberId }), mockRes);
  } catch (e) {
    console.error('getDietPlan crashed:', e);
  }

  console.log('\n--- Testing getReferralsByMember ---');
  try {
    await getReferralsByMember(mockReq({ memberId }), mockRes);
  } catch (e) {
    console.error('getReferralsByMember crashed:', e);
  }

  process.exit(0);
}

runTests();
