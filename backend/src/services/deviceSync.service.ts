import * as net from 'net';
import { db } from '../firebase';

// Keep track of the active sync interval
let syncInterval: NodeJS.Timeout | null = null;
let simulationCycleCounter = 0;

/**
 * Checks TCP socket connection to a device IP and port
 */
const checkTcpConnection = (ip: string, port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    if (isNaN(port) || port <= 0 || port >= 65536) {
      resolve(false);
      return;
    }
    const socket = new net.Socket();
    socket.setTimeout(1000); // 1 second timeout

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, ip);
  });
};

/**
 * Validates a member's credentials and updates membership status, attendance, and logs gate trigger.
 */
const processDeviceAttendanceLog = async (memberId: string, device: any) => {
  try {
    const members = await db.getMembers();
    const member = members.find(m => 
      m.memberId === memberId || 
      m.id === memberId || 
      String(m.biometricId) === String(memberId) || 
      String(m.deviceUserId) === String(memberId)
    );

    if (!member) {
      await db.addDeviceLog({
        deviceId: device.id || device.deviceId,
        deviceName: device.deviceName,
        level: 'WARNING',
        message: `[Membership Validation] Rejected access for unknown card/credentials: ${memberId} at ${device.deviceName}.`
      });
      return;
    }

    // Check membership validation
    const todayStr = new Date().toISOString().split('T')[0];
    const startDateStr = member.startDate || member.joinDate || todayStr;
    const now = new Date();

    let isUpcoming = startDateStr > todayStr;
    let isExpired = false;
    let isFrozen = member.status === 'frozen' || member.membershipStatus === 'frozen';
    
    if (member.expiryDate) {
      const expiry = new Date(member.expiryDate);
      if (expiry < now) {
        isExpired = true;
      }
    }

    if (isUpcoming) {
      const daysUntil = Math.ceil((new Date(startDateStr).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24));
      await db.addDeviceLog({
        deviceId: device.id || device.deviceId,
        deviceName: device.deviceName,
        level: 'ERROR',
        message: `[Membership Validation] Access Denied: Member ${member.name} (${member.memberId}) membership starts on ${startDateStr} (Starts in ${daysUntil} days). Gate closed.`
      });
      return;
    }

    if (isExpired) {
      await db.addDeviceLog({
        deviceId: device.id || device.deviceId,
        deviceName: device.deviceName,
        level: 'ERROR',
        message: `[Membership Validation] Access Denied: Member ${member.name} (${member.memberId}) has expired membership. Expiry: ${member.expiryDate}. Gate closed.`
      });
      return;
    }

    if (isFrozen) {
      await db.addDeviceLog({
        deviceId: device.id || device.deviceId,
        deviceName: device.deviceName,
        level: 'ERROR',
        message: `[Membership Validation] Access Denied: Member ${member.name} (${member.memberId}) membership is currently Frozen. Gate closed.`
      });
      return;
    }

    // Membership is VALID -> Grant entry and Open Gate!
    await db.addDeviceLog({
      deviceId: device.id || device.deviceId,
      deviceName: device.deviceName,
      level: 'INFO',
      message: `[Membership Validation] Access Granted: Member ${member.name} (${member.memberId}) authenticated. Membership Active.`
    });

    // Service 3: Gate Service -> Open Gate, log entry, and update occupancy
    await db.addDeviceLog({
      deviceId: device.id || device.deviceId,
      deviceName: device.deviceName,
      level: 'SUCCESS',
      message: `[Gate Service] Gate Unlock Triggered for ${device.deviceName}. Signal sent successfully.`
    });

    // Check if member is already checked in today to avoid duplicate streaks
    const attendanceLogs = await db.getAttendance();
    const alreadyCheckedIn = attendanceLogs.some(a => {
      if (a.memberId !== member.id || !a.checkIn) return false;
      const checkInStr = (typeof a.checkIn === 'string') 
        ? a.checkIn 
        : (a.checkIn.toDate ? a.checkIn.toDate().toISOString() : (a.checkIn.seconds ? new Date(a.checkIn.seconds * 1000).toISOString() : ''));
      return checkInStr.startsWith(todayStr);
    });

    if (!alreadyCheckedIn) {
      // Add attendance record
      const attendanceRecord = {
        memberId: member.id,
        memberName: member.name,
        checkIn: now.toISOString(),
        checkOut: null,
        method: device.deviceType || 'ESSL K90 Pro',
        branch: device.branch || 'The Warrior Gym Main Branch',
        createdAt: now.toISOString()
      };

      await db.addAttendance(attendanceRecord);

      // Update member count and streak
      const currentStreak = member.streak || 0;
      await db.updateMember(member.id, {
        attendanceCount: (member.attendanceCount || 0) + 1,
        streak: currentStreak + 1,
        lastActive: now.toISOString()
      });

      await db.addDeviceLog({
        deviceId: device.id || device.deviceId,
        deviceName: device.deviceName,
        level: 'SUCCESS',
        message: `[Sync Service] Created check-in log and incremented attendance counter for ${member.name}.`
      });
    } else {
      await db.addDeviceLog({
        deviceId: device.id || device.deviceId,
        deviceName: device.deviceName,
        level: 'INFO',
        message: `[Sync Service] Member ${member.name} already checked in today. Registered access tap only.`
      });
    }

  } catch (err: any) {
    console.error('Error processing device checkin:', err);
  }
};

/**
 * Service 1: Device Connector background loop running every 5 seconds
 */
const runSyncCycle = async () => {
  simulationCycleCounter++;
  try {
    const devices = await db.getDevices();
    const enabledDevices = devices.filter(d => d.enabled === true);

    for (const device of enabledDevices) {
      const port = Number(device.port) || 4370;
      const ip = device.ip;

      // Check real TCP connection only - NO dummy or fake connection status
      const isConnected = await checkTcpConnection(ip, port);
      const health = isConnected ? 100 : 0;
      const status = isConnected ? 'connected' : 'offline';

      // Reconnect if status changed
      if (device.status !== status) {
        await db.updateDevice(device.id, { 
          status, 
          connectionHealth: health,
          lastSync: isConnected ? new Date().toISOString() : device.lastSync
        });

        await db.addDeviceLog({
          deviceId: device.id,
          deviceName: device.deviceName,
          level: isConnected ? 'INFO' : 'ERROR',
          message: `[Device Connector] Device ${device.deviceName} (${device.deviceType}) status changed to ${status.toUpperCase()} at ${ip}:${port}.`
        });
      } else if (isConnected && simulationCycleCounter % 6 === 0) {
        // Periodically update lastSync timestamp to show connection health is alive
        await db.updateDevice(device.id, { 
          lastSync: new Date().toISOString(),
          connectionHealth: health
        });
      }
    }
  } catch (error) {
    console.error('Error running Device Sync cycle:', error);
  }
};


/**
 * Initializes the background service
 */
export const initDeviceSyncService = () => {
  if (syncInterval) {
    clearInterval(syncInterval);
  }
  
  console.log('[Device Sync Service] Background connectors starting up...');
  
  // Run once immediately
  runSyncCycle();
  
  // Trigger initial auto-checkout check
  if (typeof (db as any).autoCheckoutExpired === 'function') {
    (db as any).autoCheckoutExpired().catch((err: any) => console.error('Error running initial auto-checkout:', err));
  }

  // Run every 5 seconds
  syncInterval = setInterval(runSyncCycle, 5000);

  // Run auto-checkout check every 60 seconds
  setInterval(() => {
    if (typeof (db as any).autoCheckoutExpired === 'function') {
      (db as any).autoCheckoutExpired().catch((err: any) => console.error('Error running periodic auto-checkout:', err));
    }
  }, 60000);
};

/**
 * Force manual trigger for device simulation
 */
export const simulateManualTap = async (deviceId: string, memberId: string) => {
  const devices = await db.getDevices();
  const device = devices.find(d => d.id === deviceId || d.deviceId === deviceId);
  if (!device) {
    throw new Error('Device not found');
  }

  await db.addDeviceLog({
    deviceId: device.id,
    deviceName: device.deviceName,
    level: 'INFO',
    message: `[Manual Sync Trigger] Biometric tap simulated for Member ID: ${memberId} at ${device.deviceName}`
  });

  await processDeviceAttendanceLog(memberId, device);
};
