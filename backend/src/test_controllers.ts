import { getDevices, getDeviceLogs } from './controllers/device.controller';
import { getMembers } from './controllers/member.controller';

// Mock Express req/res
const mockReq = {} as any;
const mockRes = {
  json: (data: any) => {
    console.log('SUCCESS Response:', JSON.stringify(data, null, 2).substring(0, 300));
  },
  status: (code: number) => {
    console.log(`STATUS Code: ${code}`);
    return {
      json: (data: any) => {
        console.error(`ERROR Response (${code}):`, data);
      }
    };
  }
} as any;

async function runTest() {
  console.log('--- Testing getMembers ---');
  try {
    await getMembers(mockReq, mockRes);
  } catch (e) {
    console.error('getMembers crashed:', e);
  }

  console.log('\n--- Testing getDevices ---');
  try {
    await getDevices(mockReq, mockRes);
  } catch (e) {
    console.error('getDevices crashed:', e);
  }

  console.log('\n--- Testing getDeviceLogs ---');
  try {
    await getDeviceLogs(mockReq, mockRes);
  } catch (e) {
    console.error('getDeviceLogs crashed:', e);
  }
  process.exit(0);
}

runTest();
