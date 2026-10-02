import API from '@/services/api';

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function unlockHikvisionDoor(doorId = 1, requestedBy = 'Admin') {
  const dispatched = await API.post('/devices/hikvision/door/open', { doorId, requestedBy });
  const requestId = dispatched.data?.requestId;
  if (!dispatched.data?.success || !requestId) {
    throw new Error(dispatched.data?.error || 'The gate command was not accepted.');
  }

  for (let attempt = 0; attempt < 15; attempt += 1) {
    await pause(1000);
    const status = await API.get(`/devices/hikvision/door/status/${encodeURIComponent(requestId)}`);
    if (status.data?.status === 'COMPLETED') {
      if (status.data?.result?.success) return status.data.result;
      throw new Error(status.data?.result?.error || 'The agent could not unlock the gate.');
    }
  }

  throw new Error('The agent received the gate command but did not confirm the unlock. Check the device status before retrying.');
}
