import { admin, getFirestoreDb } from '../firebase';

/**
 * Provider-aware helpers shared by the device, member, employee and attendance controllers.
 * The Warrior Gym runs a Hikvision DS-K1T320EFWX; the on-site Python agent consumes the
 * Firestore `biometric_enrollment` queue (a cloud server cannot reach the gym LAN directly).
 */
export const HIKVISION_DEVICE_ID = 'hikvision-main-gate';

export const getActiveBiometricProvider = (): string =>
  String(process.env.ACTIVE_BIOMETRIC_PROVIDER || 'hikvision').toLowerCase();

export const isHikvisionProvider = (): boolean => ['hikvision', 'both'].includes(getActiveBiometricProvider());

// Clock skew between the gym PC and the cloud host is tolerated; prefer Firestore server time.
const BIOMETRIC_AGENT_MAX_HEARTBEAT_AGE_MS = 60_000;
const BIOMETRIC_AGENT_MAX_CLOCK_SKEW_MS = 5 * 60_000;

export const getHeartbeatDate = (heartbeat: any): Date => {
  if (heartbeat?.toDate) return heartbeat.toDate();
  if (heartbeat?.seconds) return new Date(heartbeat.seconds * 1000);
  return new Date(heartbeat || 0);
};

export const isBiometricAgentOnline = (device: any): boolean => {
  if (device?.status !== 'connected') return false;
  const heartbeatDate = getHeartbeatDate(device?.lastHeartbeatServer || device?.lastHeartbeat);
  const ageMs = Date.now() - heartbeatDate.getTime();
  return Number.isFinite(ageMs)
    && ageMs < BIOMETRIC_AGENT_MAX_HEARTBEAT_AGE_MS
    && ageMs > -BIOMETRIC_AGENT_MAX_CLOCK_SKEW_MS;
};

export const isHikvisionAgentOnline = async (): Promise<boolean> => {
  const firestore = getFirestoreDb();
  if (!firestore) return false;
  const snap = await firestore.collection('devices').doc(HIKVISION_DEVICE_ID).get();
  return snap.exists ? isBiometricAgentOnline(snap.data()) : false;
};

export type BiometricTargetCollection = 'members' | 'employees';

export interface QueueHikvisionSyncOptions {
  collection: BiometricTargetCollection;
  recordId: string;
  biometricId: string | number;
  name: string;
  source?: string;
}

/**
 * Queue a server-side `hikvision_sync_member` command (idempotent: deterministic doc id, an
 * in-flight command is never duplicated). The agent creates/updates the terminal user with the
 * membership validity window and pushes the CRM photo as the face template, then marks the CRM
 * record biometricSyncStatus = 'synced' | 'failed'.
 */
export async function queueHikvisionMemberSync(opts: QueueHikvisionSyncOptions): Promise<{ queued: boolean; commandId: string; reason?: string }> {
  const commandId = `hiksync_${opts.collection}_${opts.recordId}`;
  if (!isHikvisionProvider()) return { queued: false, commandId, reason: 'Hikvision is not the active biometric provider.' };
  const firestore = getFirestoreDb();
  if (!firestore) return { queued: false, commandId, reason: 'Firebase is unavailable.' };
  const bioId = String(opts.biometricId ?? '').trim();
  if (!/^\d{1,5}$/.test(bioId)) return { queued: false, commandId, reason: 'No valid numeric biometric ID.' };

  const ref = firestore.collection('biometric_enrollment').doc(commandId);
  const existing = await ref.get();
  if (existing.exists) {
    const data = existing.data() || {};
    const updatedAt = Date.parse(String(data.updatedAt || data.createdAt || ''));
    if (['pending', 'processing'].includes(String(data.status)) && Number.isFinite(updatedAt) && Date.now() - updatedAt < 10 * 60_000) {
      return { queued: false, commandId, reason: 'A sync for this record is already in progress.' };
    }
  }
  const now = new Date().toISOString();
  await ref.set({
    docId: commandId,
    command: 'hikvision_sync_member',
    status: 'pending',
    memberId: opts.recordId,
    memberName: opts.name,
    biometricId: bioId,
    targetCollection: opts.collection,
    isEmployee: opts.collection === 'employees',
    deviceId: HIKVISION_DEVICE_ID,
    source: opts.source || 'crm_server_fallback',
    message: 'Server-side Hikvision sync queued...',
    createdAt: now,
    updatedAt: now,
  });
  await firestore.collection(opts.collection).doc(opts.recordId).set({
    biometricSyncStatus: 'pending',
    biometricSyncError: null,
    biometricSyncCommandId: commandId,
    biometricSyncQueuedAt: now,
  }, { merge: true });
  return { queued: true, commandId };
}
