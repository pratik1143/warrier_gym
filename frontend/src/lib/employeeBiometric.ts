import API from '@/services/api';

/**
 * Helpers for staff (employee) biometric work on the Hikvision terminal.
 * Everything goes through the CRM backend -> Firestore `biometric_enrollment` queue ->
 * on-site Warrior biometric agent -> Hikvision DS-K1T320EFWX. Nothing is simulated here.
 */

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export type EnrollmentType = 'FACE' | 'FINGERPRINT';

export interface EnrollmentOutcome {
  ok: boolean;
  /** true when the terminal still needs somebody to finish the capture on its screen */
  needsTerminalAction?: boolean;
  status: string;
  hasFace: boolean;
  hasFingerprint: boolean;
  message: string;
}

export async function queueHikvisionEnrollment(params: {
  memberId: string;
  memberName: string;
  biometricId: string | number;
  enrollmentType: EnrollmentType;
}): Promise<{ enrollmentDocId: string }> {
  const res = await API.post('/devices/hikvision/enroll', {
    memberId: params.memberId,
    memberName: params.memberName,
    biometricId: String(params.biometricId),
    enrollmentType: params.enrollmentType,
  });
  if (!res.data?.success) throw new Error(res.data?.error || 'Enrollment command was not accepted.');
  return { enrollmentDocId: res.data.enrollmentDocId };
}

/** Polls the backend until the agent reports the capture finished, failed, or the timeout expires. */
export async function waitForHikvisionEnrollment(
  biometricId: string | number,
  type: EnrollmentType,
  opts: { timeoutMs?: number; intervalMs?: number; onUpdate?: (status: string) => void } = {},
): Promise<EnrollmentOutcome> {
  const timeoutMs = opts.timeoutMs ?? 90_000;
  const intervalMs = opts.intervalMs ?? 2_000;
  const started = Date.now();
  let last: any = null;

  while (Date.now() - started < timeoutMs) {
    await pause(intervalMs);
    try {
      const res = await API.get(`/devices/hikvision/enrollment-status/${encodeURIComponent(String(biometricId))}`);
      last = res.data;
    } catch {
      continue; // transient network/API error - keep polling until timeout
    }
    const status = String(last?.enrollmentStatus || '').toLowerCase();
    if (status) opts.onUpdate?.(status);

    const done = type === 'FACE' ? Boolean(last?.hasFace) : Boolean(last?.hasFingerprint);
    if (status === 'enrolled' || done) {
      return {
        ok: true,
        status: 'enrolled',
        hasFace: Boolean(last?.hasFace),
        hasFingerprint: Boolean(last?.hasFingerprint),
        message: type === 'FACE' ? 'Face enrolled on the terminal.' : 'Fingerprint enrolled on the terminal.',
      };
    }
    if (status === 'failed') {
      return {
        ok: false,
        status,
        hasFace: Boolean(last?.hasFace),
        hasFingerprint: Boolean(last?.hasFingerprint),
        message: last?.error || 'The terminal rejected the enrollment.',
      };
    }
  }

  return {
    ok: false,
    needsTerminalAction: true,
    status: String(last?.enrollmentStatus || 'timeout'),
    hasFace: Boolean(last?.hasFace),
    hasFingerprint: Boolean(last?.hasFingerprint),
    message:
      'Not confirmed yet. Finish the capture on the terminal screen - or skip: the server will create the user on the terminal and you can enroll later.',
  };
}

export interface AccessChangeOutcome {
  ok: boolean;
  pending: boolean;
  message: string;
}

/** Block (enabled=false) / unblock (enabled=true) a member or employee on the terminal. */
export async function setBiometricAccess(params: {
  memberId: string;
  biometricId: string | number;
  enabled: boolean;
  isEmployee?: boolean;
}): Promise<AccessChangeOutcome> {
  const res = await API.post('/devices/biometric/access', {
    memberId: params.memberId,
    biometricId: String(params.biometricId),
    enabled: params.enabled,
    isEmployee: params.isEmployee === true,
  });
  const commandId = res.data?.enrollmentDocId;
  if (!res.data?.success || !commandId) throw new Error(res.data?.error || 'Access change was not queued.');

  for (let attempt = 0; attempt < 20; attempt += 1) {
    await pause(1500);
    try {
      const st = await API.get(`/devices/biometric/command/${encodeURIComponent(commandId)}`);
      const status = String(st.data?.status || '').toLowerCase();
      if (['completed', 'complete', 'done', 'success', 'synced', 'applied'].includes(status)) {
        return { ok: true, pending: false, message: st.data?.message || (params.enabled ? 'Access enabled on the terminal.' : 'Access blocked on the terminal.') };
      }
      if (['failed', 'error', 'rejected'].includes(status)) {
        return { ok: false, pending: false, message: st.data?.message || 'The terminal could not apply the change.' };
      }
    } catch {
      /* keep polling */
    }
  }
  return { ok: false, pending: true, message: 'Queued, but the on-site agent has not confirmed yet. Check the agent and try again.' };
}

/** Queue a (re)sync of one person to the terminal. */
export async function queueTerminalSync(params: { memberId: string; memberName: string; biometricId: string | number; isEmployee?: boolean }) {
  const res = await API.post('/devices/sync-member', {
    memberId: params.memberId,
    memberName: params.memberName,
    biometricId: Number(params.biometricId),
    isEmployee: params.isEmployee === true,
  });
  if (!res.data?.success) throw new Error(res.data?.error || 'Sync could not be queued.');
  return res.data;
}
