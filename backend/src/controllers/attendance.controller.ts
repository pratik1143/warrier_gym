import { Request, Response } from 'express';
import { db, getFirestoreDb } from '../firebase';
import { exec } from 'child_process';
import os from 'os';
import net from 'net';
import { randomUUID } from 'crypto';
import { getKolkataDateString } from '../services/followupAutomation.service';
import { HIKVISION_DEVICE_ID, isHikvisionProvider, isHikvisionAgentOnline } from '../services/biometricQueue.service';

let latestPunchEvent: any = null;

export const getLatestPunchEvent = () => latestPunchEvent;

export const getAttendanceFeed = async (req: Request, res: Response) => {
  try {
    const list = await db.getAttendance(); // This now returns attendance_logs
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDashboardAnalyticsFeed = async (req: Request, res: Response) => {
  try {
    const analytics = await db.getDashboardAnalytics();
    res.json(analytics);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAttendanceSummaryFeed = async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const summary = await db.getAttendanceSummary(memberId);
    res.json(summary || {});
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createCheckIn = async (req: Request, res: Response) => {
  try {
    const { memberId, method, branch } = req.body;
    const members = await db.getMembers();
    
    // Find member by biometricId, deviceUserId, clientId, customId, memberId, phone, or name
    const mStr = String(memberId).toLowerCase().trim();
    let member = members.find(m => {
      const bioId = String(m.biometricId || '').toLowerCase().trim();
      const devId = String(m.deviceUserId || '').toLowerCase().trim();
      const cId = String(m.clientId || '').toLowerCase().trim();
      const custId = String(m.customId || '').toLowerCase().trim();
      const mId = String(m.memberId || '').toLowerCase().trim();
      const id = String(m.id || '').toLowerCase().trim();

      if (bioId && bioId === mStr) return true;
      if (devId && devId === mStr) return true;
      if (cId && cId === mStr) return true;
      if (custId && custId === mStr) return true;
      if (mId && (mId === mStr || mId.endsWith(`-${mStr}`) || mId.endsWith(`0${mStr}`))) return true;
      if (id && id === mStr) return true;
      if (m.phone && m.phone === mStr) return true;
      if (m.name && m.name.toLowerCase().trim() === mStr) return true;
      return false;
    });
    
    if (!member) {
      // DO NOT write attendance log for unmapped users (Requirement 3 & 15)
      latestPunchEvent = {
        id: 'punch_' + Date.now(),
        memberId: `unmapped_bio_${memberId}`,
        memberName: `Unmapped Biometric User #${memberId}`,
        memberCode: `ID #${memberId}`,
        status: 'unknown',
        unmapped: true,
        reason: `Biometric ID #${memberId} needs CRM mapping`,
        checkIn: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      return res.status(200).json({
        success: false,
        unmapped: true,
        biometricId: memberId,
        memberName: `Unmapped Biometric User #${memberId}`,
        message: 'Member not mapped'
      });
    }

    const todayStr = getKolkataDateString();
    const startDateStr = member.startDate || member.joinDate || todayStr;
    const expiryDateStr = member.expiryDate || member.membershipExpiryDate || '';
    const membershipStatuses = [member.status, member.membershipStatus].map(value => String(value || '').trim().toLowerCase());

    let status = 'granted';
    let reason = '';

    if (startDateStr && startDateStr > todayStr) {
      status = 'denied';
      const startObj = new Date(startDateStr);
      const todayObj = new Date(todayStr);
      const daysUntil = Math.ceil((startObj.getTime() - todayObj.getTime()) / (1000 * 60 * 60 * 24));
      reason = `Membership starts on ${startDateStr} (Starts in ${daysUntil} ${daysUntil === 1 ? 'day' : 'days'})`;
    } else if (membershipStatuses.includes('expired') || (expiryDateStr && String(expiryDateStr).slice(0, 10) < todayStr)) {
      status = 'denied';
      reason = 'Membership has expired';
    } else if (member.biometricBlocked === true || member.biometricBlockPending === true || membershipStatuses.some(value => ['blocked', 'blacklisted', 'inactive', 'suspended', 'cancelled', 'canceled'].includes(value))) {
      status = 'denied';
      reason = member.biometricBlockReason || 'Biometric access is blocked for this member';
    } else if (membershipStatuses.includes('frozen')) {
      status = 'denied';
      reason = 'Membership is frozen';
    }

    // Check Duplicate / Today Check-in for resolved member
    const logs = await db.getAttendance();
    const existingLog = logs.find((a: any) => a.memberId === member.id && (a.status === 'granted' || a.status === 'already_inside') && a.checkIn && String(a.checkIn).startsWith(todayStr));

    if (existingLog && status === 'granted') {
      latestPunchEvent = {
        id: 'punch_' + Date.now(),
        memberId: member.id,
        memberName: member.name,
        memberCode: member.memberId || 'AZ-2026-0001',
        avatarUrl: member.avatar || member.avatarUrl || '',
        plan: member.plan || 'Monthly Standard',
        trainer: member.trainer || 'No PT Assigned',
        expiryDate: member.expiryDate || '',
        status: 'already_inside',
        alreadyInside: true,
        reason: 'Already checked in today',
        firstCheckInTime: existingLog.checkIn,
        checkIn: new Date().toISOString(),
        createdAt: new Date().toISOString()
      };

      return res.status(200).json({
        success: true,
        alreadyInside: true,
        member,
        firstCheckInTime: existingLog.checkIn,
        currentPunchTime: new Date().toISOString()
      });
    }

    const log = await db.addAttendance({
      memberId: member.id,
      memberName: member.name,
      checkIn: new Date().toISOString(),
      checkOut: null,
      method: method || 'biometric',
      branch: branch || member.branch || 'Mohali, Punjab',
      status,
      createdAt: new Date().toISOString()
    });

    latestPunchEvent = {
      id: log.id || 'punch_' + Date.now(),
      memberId: member.id,
      memberName: member.name,
      memberCode: member.memberId || 'AZ-2026-0001',
      avatarUrl: member.avatar || member.avatarUrl || '',
      plan: member.plan || 'Monthly Standard',
      trainer: member.trainer || 'No PT Assigned',
      expiryDate: member.expiryDate || '',
      status: log.status || status,
      reason,
      checkIn: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };

    if (status === 'denied') {
      return res.status(403).json({ success: false, access: 'denied', status: 'denied', reason, error: `Access Denied: ${reason}` });
    }

    // Biometric punches are unlocked by the persistent EasyBio service after
    // its authoritative membership check. Avoid opening a second session and
    // sending a duplicate pulse for those events.
    if (req.body?.method !== 'ESSL K90 Pro Biometric') {
      const deviceIp = process.env.EASYBIO_DEVICE_IP || '192.168.18.11';
      const devicePort = Number(process.env.EASYBIO_DEVICE_PORT || 4370);
      exec(`python -c "from zk import ZK; zk=ZK('${deviceIp}', port=${devicePort}, timeout=3); conn=zk.connect(); conn.unlock(3); conn.disconnect()"`, (err) => {
        if (err) console.warn('[CheckIn Gate Unlock Hardware Exec Warning]:', err.message);
        else console.log('[CheckIn Gate Unlock Success] Gate relay unlocked for member checkin.');
      });
    }

    res.status(201).json({ success: true, log, memberName: member.name });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const checkoutLog = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const log = await db.checkoutAttendance(id);
    if (!log) {
      return res.status(404).json({ error: 'Attendance log not found' });
    }
    res.json(log);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

let lastGateUnlockTime = 0;

export function getLocalIpAddress(): string {
  try {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
      const iface = interfaces[devName];
      if (!iface) continue;
      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal && alias.address !== '127.0.0.1') {
          return alias.address;
        }
      }
    }
  } catch (e) {}
  return '127.0.0.1';
}

export const getGateStatus = async (req: Request, res: Response) => {
  try {
    if (isHikvisionProvider()) {
      const hikIp = process.env.HIKVISION_HOST || '192.168.1.45';
      const hikPort = Number(process.env.HIKVISION_PORT || 443);
      const hikServerIp = getLocalIpAddress();
      const hikServerPort = process.env.PORT || '5000';
      const reachable = await new Promise<boolean>((resolve) => {
        const socket = new net.Socket();
        let result = false;
        socket.setTimeout(1500);
        socket.once('connect', () => { result = true; socket.destroy(); });
        socket.once('error', () => socket.destroy());
        socket.once('timeout', () => socket.destroy());
        socket.once('close', () => resolve(result));
        socket.connect(hikPort, hikIp);
      });
      // A cloud-hosted API cannot reach the gym LAN, so also trust the on-site agent heartbeat.
      const agentOnline = await isHikvisionAgentOnline().catch(() => false);
      return res.json({
        device: 'Hikvision DS-K1T320EFWX',
        deviceId: HIKVISION_DEVICE_ID,
        ip: hikIp,
        port: hikPort,
        connected: reachable || agentOnline,
        agentOnline,
        serverIp: hikServerIp,
        serverPort: hikServerPort,
        accessUrl: `http://${hikServerIp}:${hikServerPort}/gate-control`,
        timestamp: new Date().toISOString()
      });
    }
    const deviceIp = process.env.EASYBIO_DEVICE_IP || '192.168.18.11';
    const devicePort = Number(process.env.EASYBIO_DEVICE_PORT || 4370);
    const serverIp = getLocalIpAddress();
    const serverPort = process.env.PORT || '8000';
    const connected = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      let result = false;
      socket.setTimeout(1500);
      socket.once('connect', () => { result = true; socket.destroy(); });
      socket.once('error', () => socket.destroy());
      socket.once('timeout', () => socket.destroy());
      socket.once('close', () => resolve(result));
      socket.connect(devicePort, deviceIp);
    });

    res.json({
      device: 'EasyBio Access Control',
      ip: deviceIp,
      port: devicePort,
      connected,
      serverIp,
      serverPort,
      accessUrl: `http://${serverIp}:${serverPort}/gate-control`,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};


/**
 * Hikvision door unlock: queue the command for the on-site agent (device_testing/control) and wait
 * for its acknowledgement (lastDoorTestRequestId) so the UI only reports success when the relay fired.
 */
async function triggerHikvisionGateUnlock(req: Request, res: Response) {
  const requestedBy = String((req as any).user?.email || (req as any).user?.name || req.body?.requestedBy || 'Staff / Authorized LAN User');
  const doorId = Number(req.body?.doorId) || 1;
  const hikIp = process.env.HIKVISION_HOST || '192.168.1.45';
  try {
    const firestore = getFirestoreDb();
    if (!firestore) return res.status(503).json({ success: false, status: 'DEVICE_SERVICE_UNAVAILABLE', message: 'Database service unavailable.' });
    if (!(await isHikvisionAgentOnline())) {
      return res.status(503).json({ success: false, status: 'DEVICE_SERVICE_UNAVAILABLE', message: 'The on-site biometric agent or Hikvision terminal is offline. No gate command was sent.' });
    }
    const controlRef = firestore.collection('device_testing').doc('control');
    const control = (await controlRef.get()).data() || {};
    if (control.testDoorPending) {
      return res.status(409).json({ success: false, status: 'COMMAND_PENDING', message: 'A gate command is already waiting for the on-site agent.' });
    }
    const requestId = `door_${Date.now()}_${randomUUID().slice(0, 6)}`;
    await db.addDeviceLog({
      deviceId: HIKVISION_DEVICE_ID, deviceName: 'Hikvision DS-K1T320EFWX', level: 'INFO',
      message: `[Turnstile Unlock] Remote gate unlock requested by ${requestedBy} for Door ${doorId}.`
    }).catch(() => {});
    await controlRef.set({
      testDoorPending: true, testDoorId: doorId, testDoorUser: requestedBy,
      testDoorRequestedAt: new Date().toISOString(), testDoorRequestId: requestId
    }, { merge: true });

    const result = await new Promise<{ status: 'success' | 'failed' | 'timeout'; message?: string }>((resolve) => {
      let settled = false;
      let unsubscribe: (() => void) | undefined;
      const finish = (value: { status: 'success' | 'failed' | 'timeout'; message?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (unsubscribe) unsubscribe();
        resolve(value);
      };
      const timer = setTimeout(() => finish({ status: 'timeout', message: 'The agent did not acknowledge the unlock command in time.' }), 30000);
      unsubscribe = controlRef.onSnapshot((snapshot) => {
        const data = snapshot.data();
        if (!data || data.lastDoorTestRequestId !== requestId) return;
        const r = data.lastDoorTestResult || {};
        if (r.success) finish({ status: 'success', message: r.message || 'Hikvision acknowledged the door command.' });
        else finish({ status: 'failed', message: r.error || r.message || 'Hikvision rejected the door command.' });
      }, (error) => finish({ status: 'failed', message: 'Acknowledgement read failed: ' + error.message }));
    });

    if (result.status !== 'success') {
      await controlRef.set({ testDoorPending: false }, { merge: true }).catch(() => {});
      return res.status(result.status === 'timeout' ? 504 : 502).json({
        success: false, status: result.status === 'timeout' ? 'DEVICE_ACK_TIMEOUT' : 'RELAY_COMMAND_FAILED',
        message: result.message, deviceIp: hikIp, requestId
      });
    }
    return res.json({
      success: true, status: 'UNLOCK_COMMAND_ACKNOWLEDGED', requestId, doorId, deviceId: HIKVISION_DEVICE_ID,
      message: `Hikvision DS-K1T320EFWX acknowledged the unlock command for Door ${doorId}.`,
      deviceIp: hikIp, timestamp: new Date().toLocaleTimeString('en-IN')
    });
  } catch (error: any) {
    if (!res.headersSent) return res.status(502).json({ success: false, status: 'CONNECTION_FAILED', message: error.message, deviceIp: hikIp });
  }
}

export const triggerGateUnlock = async (req: Request, res: Response) => {
  const now = Date.now();
  if (now - lastGateUnlockTime < 1000) {
    console.log('[GATE] Cooldown active. Rejecting rapid repeat unlock request.');
    return res.status(429).json({ success: false, status: 'COOLDOWN', message: 'Gate unlock in progress. Please wait 1 second before opening again.' });
  }

  if (isHikvisionProvider()) {
    lastGateUnlockTime = now;
    return triggerHikvisionGateUnlock(req, res);
  }

  const deviceIp = process.env.EASYBIO_DEVICE_IP || '192.168.18.11';
  const devicePort = Number(process.env.EASYBIO_DEVICE_PORT || 4370);
  const deviceId = process.env.EASYBIO_DEVICE_ID || 'dev_k90_main';
  const durationSeconds = 15;
  const requestId = randomUUID();
  const authenticatedUser = (req as any).user?.email || (req as any).user?.name || (req as any).user?.uid || 'Staff / Authorized LAN User';
  const firestore = getFirestoreDb();
  console.log('[GATE] Request received from ' + authenticatedUser);
  console.log('[GATE] Device IP: ' + deviceIp);
  console.log('[GATE] Device Port: ' + devicePort);
  console.log('[GATE] Connecting through the existing local device service...');
  if (!firestore) {
    console.error('[GATE ERROR] Firebase/device service bridge is unavailable.');
    return res.status(503).json({ success: false, status: 'DEVICE_SERVICE_UNAVAILABLE', message: 'Local EasyBio device service is unavailable.' });
  }

  const deviceRef = firestore.collection('devices').doc(deviceId);
  try {
    const deviceSnap = await deviceRef.get();
    if (!deviceSnap.exists) {
      console.error('[GATE ERROR] Existing device record ' + deviceId + ' is missing.');
      return res.status(503).json({ success: false, status: 'DEVICE_SERVICE_UNAVAILABLE', message: 'The EasyBio device is not registered with the local device service.' });
    }

    console.log('[GATE] Connected to local device service.');
    console.log('[GATE] Sending relay/door unlock command...');
    lastGateUnlockTime = now;
    await deviceRef.set({
      unlockPending: true,
      unlockRequestId: requestId,
      unlockDurationSeconds: durationSeconds,
      unlockStatus: 'pending',
      unlockRequestedAt: new Date().toISOString(),
      unlockRequestedBy: authenticatedUser,
      unlockExpiresAt: new Date(Date.now() + 30000).toISOString()
    }, { merge: true });

    const result = await new Promise<{ status: 'success' | 'failed' | 'timeout'; message?: string }>((resolve) => {
      let settled = false;
      let unsubscribe: (() => void) | undefined;
      const finish = (value: { status: 'success' | 'failed' | 'timeout'; message?: string }) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (unsubscribe) unsubscribe();
        resolve(value);
      };
      const timer = setTimeout(() => finish({ status: 'timeout', message: 'No relay command acknowledgement was received from the local device service.' }), 20000);
      unsubscribe = deviceRef.onSnapshot((snapshot) => {
        const data = snapshot.data();
        if (!data || data.unlockRequestId !== requestId) return;
        if (data.unlockStatus === 'success') finish({ status: 'success', message: data.unlockResult || 'Device acknowledged the relay command.' });
        if (data.unlockStatus === 'failed') finish({ status: 'failed', message: data.unlockError || 'Device rejected the relay command.' });
      }, (error) => finish({ status: 'failed', message: 'Device acknowledgement read failed: ' + error.message }));
    });

    if (result.status !== 'success') {
      console.error('[GATE ERROR] ' + result.status.toUpperCase() + ': ' + result.message);
      await deviceRef.set({
        unlockPending: false,
        unlockStatus: result.status,
        unlockError: result.message,
        unlockExpiresAt: new Date().toISOString()
      }, { merge: true }).catch(() => {});
      await db.addDeviceLog({
        deviceId, deviceName: 'Access Control', level: 'ERROR',
        message: '[GATE ERROR] Relay command ' + result.status + ': ' + result.message
      }).catch(() => {});
      return res.status(result.status === 'timeout' ? 504 : 502).json({
        success: false, status: result.status === 'timeout' ? 'DEVICE_ACK_TIMEOUT' : 'RELAY_COMMAND_FAILED',
        message: result.message, deviceIp, devicePort
      });
    }

    console.log('[GATE] Device response: ' + result.message);
    console.log('[GATE] Relay command result: SUCCESS');
    await db.addDeviceLog({
      deviceId, deviceName: 'Access Control', level: 'SUCCESS',
      message: '[GATE] EasyBio acknowledged ' + durationSeconds + '-second relay command (' + deviceIp + ':' + devicePort + ').'
    });
    return res.json({
      success: true, status: 'UNLOCK_COMMAND_ACKNOWLEDGED',
      message: 'EasyBio acknowledged the ' + durationSeconds + '-second gate relay command.',
      deviceIp, devicePort, durationSeconds, timestamp: new Date().toLocaleTimeString('en-IN')
    });
  } catch (error: any) {
    console.error('[GATE ERROR] ' + error.message);
    await db.addDeviceLog({
      deviceId, deviceName: 'Access Control', level: 'ERROR',
      message: '[GATE ERROR] ' + error.message
    }).catch(() => {});
    if (!res.headersSent) return res.status(502).json({ success: false, status: 'CONNECTION_FAILED', message: error.message, deviceIp, devicePort });
  }
};
export const getAccessLogs = async (req: Request, res: Response) => {
  try {
    const list = await db.getAccessLogs();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDoorStatus = async (req: Request, res: Response) => {
  try {
    const list = await db.getDoorStatus();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
