import express from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';
import router from './routes';
import { provisionAdminAccounts, db, getFirestoreDb } from './firebase';
import { initDeviceSyncService } from './services/deviceSync.service';
import { startCleanupJob } from './jobs/cleanup';
import { startPresenceJob } from './jobs/presence';
import { initQueueJob } from './jobs/whatsappQueue.job';
import { startFollowupAutomationJob } from './jobs/followupAutomation.job';
import { startEnrollFingerprint } from './controllers/device.controller';
import { getLocalIpAddress, triggerGateUnlock } from './controllers/attendance.controller';
import { getNextAvailableBiometricId, isValidDeviceBiometricId } from './services/biometricId.service';

// Trigger reload after Firestore activation by user
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable Cross-Origin Resource Sharing
app.use(cors({
  origin: '*', // Allow all origins for local testing and dev
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parsing middleware (50mb limit for batch excel migration)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Request Logger Middleware
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  res.on('finish', () => {
    console.log(`[HTTP] ${req.method} ${req.originalUrl} - Status: ${res.statusCode}`);
  });
  next();
});

// API route middleware mounting
app.use('/api', router);

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'healthy', service: 'warrior-gym-os-api', timestamp: new Date().toISOString() });
});

// Directly mount unauthenticated LAN Gate Unlock & Biometric Enrollment endpoints
app.post('/api/attendance/gate-unlock', triggerGateUnlock);
app.post('/api/gate/open', triggerGateUnlock);
app.post('/api/attendance/unlock', triggerGateUnlock);
app.post('/gate/open', triggerGateUnlock);
app.post('/gate-unlock', triggerGateUnlock);

app.post('/api/gate/enroll-fingerprint', startEnrollFingerprint);
app.post('/api/devices/biometric/enroll-fingerprint', startEnrollFingerprint);

app.get('/api/gate/roster', async (req: express.Request, res: express.Response) => {
  try {
    const firestore = getFirestoreDb();
    if (!firestore) return res.status(503).json({ success: false, error: 'CRM/Firebase connection is unavailable.' });
    const deviceId = process.env.EASYBIO_DEVICE_ID || 'dev_k90_main';
    const [memberSnap, employeeSnap, deviceUserSnap, deviceSnap] = await Promise.all([
      firestore.collection('members').get(),
      firestore.collection('employees').get(),
      firestore.collection('deviceUsers').where('deviceId', '==', deviceId).get(),
      firestore.collection('devices').doc(deviceId).get()
    ]);
    const members = memberSnap.docs
      .filter(doc => !doc.data().isDeleted && !doc.data().deletedAt)
      .map(doc => {
        const member = doc.data();
        const memberFingerprintStatus = String(member.fingerprintStatus || member.fingerprint?.status || '').toUpperCase();
        const memberFingerprintEnrolled = member.fingerprintEnrolled === true || member.fingerprint?.enrolled === true;
        const memberBioId = String(member.biometricId ?? member.deviceUserId ?? '');
        const memberDeviceUser = deviceUserSnap.docs.find(userDoc => String(userDoc.data().userId ?? '') === memberBioId)?.data();
        const memberHasFingerprint = memberFingerprintStatus === 'ENROLLED' || memberFingerprintEnrolled
          || Number(memberDeviceUser?.fingerprintsCount || 0) > 0;
        return {
          id: doc.id,
          memberId: member.memberId || '',
          name: member.name || '',
          phone: member.phone || '',
          biometricId: member.biometricId ?? null,
          deviceUserId: member.deviceUserId ?? null,
          fingerprintStatus: memberHasFingerprint ? 'ENROLLED' : (memberFingerprintStatus || 'NOT_ENROLLED'),
          fingerprintEnrolled: memberHasFingerprint,
          biometricStatus: member.biometricStatus || member.biometric?.status || '',
          biometricBlocked: member.biometricBlocked === true,
          biometricBlockPending: member.biometricBlockPending === true,
          biometricBlockAction: member.biometricBlockAction || null,
          biometricBlockCommandId: member.biometricBlockCommandId || null,
          biometricBlockReason: member.biometricBlockReason || '',
          biometricBlockedAt: member.biometricBlockedAt || null
        };
      });
    const employees = employeeSnap.docs.map(doc => {
      const employee = doc.data();
      const bioId = employee.biometricId ?? null;
      const derivedEmpId = employee.employeeId || (bioId ? `EMP-${bioId}` : (doc.id.startsWith('emp_') ? `EMP-${doc.id.replace('emp_', '')}` : ''));
      return {
        id: doc.id,
        name: employee.name || '',
        employeeId: derivedEmpId,
        status: employee.status || 'Active',
        phone: employee.phone || '',
        role: employee.role || '',
        biometricId: bioId,
        deviceUserId: employee.deviceUserId ?? (bioId ? String(bioId) : null),
        fingerprintStatus: String(employee.fingerprintStatus || employee.fingerprint?.status || '').toUpperCase(),
        fingerprintEnrolled: employee.fingerprintEnrolled === true || employee.fingerprint?.enrolled === true
          || String(employee.fingerprintStatus || employee.fingerprint?.status || '').toUpperCase() === 'ENROLLED',
        biometricStatus: employee.biometricStatus || employee.biometric?.status || '',
        biometricBlocked: employee.biometricBlocked === true,
        biometricBlockPending: employee.biometricBlockPending === true,
        biometricBlockAction: employee.biometricBlockAction || null,
        biometricBlockCommandId: employee.biometricBlockCommandId || null,
        biometricBlockReason: employee.biometricBlockReason || '',
        biometricBlockedAt: employee.biometricBlockedAt || null
      };
    });
    const deviceUsers = deviceUserSnap.docs.map(doc => {
      const user = doc.data();
      return {
        userId: user.userId,
        deviceId: user.deviceId,
        deviceName: user.deviceName,
        userName: user.userName,
        enrollmentStatus: user.enrollmentStatus,
        fingerprintsCount: user.fingerprintsCount,
        lastActivity: user.lastActivity
      };
    });
    const device = deviceSnap.exists ? deviceSnap.data() : null;
    res.json({
      success: true, members, employees, deviceUsers,
      device: {
        id: deviceId,
        ip: process.env.EASYBIO_DEVICE_IP || '192.168.18.11',
        port: Number(process.env.EASYBIO_DEVICE_PORT || 4370),
        status: device?.status || 'unknown',
        lastSync: device?.lastSync || null
      }
    });
  } catch (err: any) {
    console.error('[CRM ROSTER ERROR] ' + err.message);
    res.status(503).json({ success: false, error: 'Could not load the live CRM roster: ' + err.message });
  }
});

app.post('/api/gate/members/:memberId/assign-biometric-id', async (req: express.Request, res: express.Response) => {
  try {
    const firestore = getFirestoreDb();
    if (!firestore) return res.status(503).json({ success: false, error: 'CRM/Firebase connection is unavailable.' });
    const memberRef = firestore.collection('members').doc(String(req.params.memberId || ''));
    const memberSnap = await memberRef.get();
    if (!memberSnap.exists) return res.status(404).json({ success: false, error: 'CRM member was not found.' });
    const member = memberSnap.data() || {};
    if (isValidDeviceBiometricId(member.biometricId)) {
      return res.json({ success: true, biometricId: String(member.biometricId), alreadyAssigned: true });
    }

    const biometricId = await getNextAvailableBiometricId();
    await memberRef.update({
      biometricId: String(biometricId),
      deviceUserId: String(biometricId),
      fingerprintStatus: member.fingerprintStatus || 'NOT_ENROLLED',
      fingerprintEnrolled: member.fingerprintEnrolled === true,
      updatedAt: new Date().toISOString()
    });
    db.invalidateMembersCache();
    res.json({ success: true, biometricId: String(biometricId), alreadyAssigned: false });
  } catch (err: any) {
    console.error('[CRM BIOMETRIC ID ASSIGNMENT ERROR] ' + err.message);
    res.status(503).json({ success: false, error: 'Could not assign a valid device biometric ID: ' + err.message });
  }
});

// Dedicated Standalone LAN Gate Control & Biometric Enrollment Web Application Served directly on Port 8000 / 5000
const renderGateHtml = (req: express.Request, res: express.Response) => {
  const lanIp = getLocalIpAddress();
  const deviceIp = process.env.EASYBIO_DEVICE_IP || '192.168.18.11';
  const devicePort = Number(process.env.EASYBIO_DEVICE_PORT || 4370);
  const crmUrl = "https://thewarriorgym.in/dashboard";
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>THE WARRIOR GYM — EasyBio Gate Control & Enrollment</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { font-family: 'Plus Jakarta Sans', sans-serif; }
    @keyframes pulse-ring {
      0% { transform: scale(0.96); opacity: 0.7; }
      50% { transform: scale(1.06); opacity: 0.35; }
      100% { transform: scale(0.96); opacity: 0.7; }
    }
    .pulse-glow { animation: pulse-ring 2.8s infinite ease-in-out; }
  </style>
</head>
<body class="bg-slate-950 text-slate-100 min-h-screen font-sans flex flex-col justify-between antialiased selection:bg-blue-600 selection:text-white">
  
  <!-- Header -->
  <header class="bg-slate-900/90 border-b border-slate-800 p-4 px-6 backdrop-blur-xl sticky top-0 z-30 shadow-xl">
    <div class="max-w-5xl mx-auto flex items-center justify-between">
      <div class="flex items-center gap-3.5">
        <div class="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-md shadow-blue-500/20 shrink-0 flex items-center justify-center">
          <img 
            src="https://thewarriorgym.in/gymlogo.png" 
            alt="The Warrior Gym" 
            class="w-full h-full object-contain p-1 rounded-xl bg-white" 
            onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';"
          />
          <div class="hidden w-full h-full items-center justify-center text-white font-black text-xl">AZ</div>
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h1 class="text-lg font-black text-white tracking-tight uppercase">THE WARRIOR GYM</h1>
            <span class="px-2 py-0.5 rounded-full bg-blue-900/80 text-blue-300 text-[10px] font-black uppercase tracking-wider border border-blue-700">
              LAN TERMINAL
            </span>
          </div>
          <p class="text-xs text-slate-400 font-semibold mt-0.5">EasyBio Hardware Access & Fingerprint Engine</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <a href="${crmUrl}" target="_blank" class="hidden sm:inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs px-4 py-2 rounded-xl border border-blue-400 transition-all shadow-md">
          <span>🚀 Open Deployed CRM</span>
        </a>

        <div class="flex items-center gap-2 bg-slate-800/90 border border-slate-700 px-3.5 py-1.5 rounded-full shadow-inner">
          <span class="relative flex h-2.5 w-2.5">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span id="deviceStatusDot" class="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-500"></span>
          </span>
          <span id="deviceStatusText" class="text-xs font-mono font-black text-slate-300">
            ${lanIp}
          </span>
        </div>
      </div>
    </div>
  </header>

  <!-- Navigation Tabs -->
  <div class="max-w-5xl mx-auto px-4 pt-6 w-full flex items-center justify-center gap-2">
    <button 
      id="tabBtnGate" 
      onclick="switchTab('gate')"
      class="px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-2 bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/40"
    >
      🔓 Gate Control
    </button>
    <button 
      id="tabBtnClient" 
      onclick="switchTab('client')"
      class="px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-2 bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white"
    >
      👤 Enroll Client
    </button>
    <button 
      id="tabBtnEmployee" 
      onclick="switchTab('employee')"
      class="px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-2 bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white"
    >
      👔 Enroll Employee
    </button>
    <button
      id="tabBtnBlocked"
      onclick="switchTab('blocked')"
      class="px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-2 bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white"
    >
      🚫 Blocked Access
    </button>
  </div>

  <!-- Main Work Area -->
  <main class="max-w-5xl mx-auto px-4 py-6 w-full flex-1 flex flex-col items-center justify-start space-y-6">
    
    <!-- Status Dashboard Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full">
      <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">HARDWARE TERMINAL</span>
          <span class="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
        <div>
          <div class="text-base font-black text-white">EasyBio Biometric</div>
          <div id="deviceEndpointText" class="text-xs font-mono text-blue-400 font-bold mt-1 bg-blue-950/60 px-2 py-0.5 rounded-md inline-block border border-blue-800">Checking device...</div>
        </div>
      </div>

      <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">RELAY DURATION</span>
          <span class="text-[10px] font-extrabold text-blue-400 bg-blue-950/80 px-2 py-0.5 rounded border border-blue-800">15 SECONDS</span>
        </div>
        <div>
          <div class="text-base font-black text-white">Direct Gate Unlock</div>
          <div class="text-xs text-emerald-400 font-bold mt-1 flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Auto-Relay Lock Active
          </div>
        </div>
      </div>

      <div class="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
        <div class="flex items-center justify-between text-slate-400 mb-2">
          <span class="text-[10px] font-black uppercase tracking-wider text-slate-400">PRODUCTION CRM SITE</span>
          <span class="text-[10px] font-extrabold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded border border-emerald-800">thewarriorgym.in</span>
        </div>
        <div>
          <div class="text-base font-black text-white">The Warrior Gym OS</div>
          <a href="${crmUrl}" target="_blank" class="text-xs font-bold text-blue-400 hover:text-blue-300 mt-1 inline-flex items-center gap-1 group">
            Launch Main CRM <span class="group-hover:translate-x-0.5 transition-transform">&rarr;</span>
          </a>
        </div>
      </div>
    </div>

    <!-- ── TAB 1: GATE UNLOCK ── -->
    <div id="tabContentGate" class="w-full max-w-md flex flex-col items-center justify-center space-y-6 py-4">
      <div class="relative flex items-center justify-center">
        <div id="pulseBg" class="absolute w-64 h-64 rounded-full bg-blue-600/20 pulse-glow"></div>
        <button 
          id="unlockBtn"
          onclick="triggerGateUnlock()"
          class="relative w-56 h-56 rounded-full bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 hover:from-blue-600 hover:to-indigo-500 active:scale-95 text-white shadow-[0_20px_60px_rgba(37,99,235,0.4)] transition-all cursor-pointer flex flex-col items-center justify-center border-4 border-white/20 group text-center"
        >
          <div class="w-16 h-16 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center mb-2 shadow-inner group-hover:scale-110 transition-transform">
            <span id="lockIcon" class="text-3xl">🔓</span>
          </div>
          <span class="text-xl font-black tracking-wider uppercase">OPEN GATE</span>
          <span class="text-[10px] font-bold tracking-widest uppercase opacity-80 mt-1 bg-white/10 px-2.5 py-0.5 rounded-full">
            UNLOCK 15 SECONDS
          </span>
        </button>
      </div>

      <div id="statusBanner" class="hidden w-full bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-3 transition-all text-center">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div id="statusDot" class="w-3 h-3 rounded-full bg-emerald-500 animate-ping"></div>
            <span id="bannerTitle" class="text-sm font-black text-white uppercase tracking-tight">GATE UNLOCKED!</span>
          </div>
          <span id="timerText" class="text-xs font-mono font-black text-blue-400 bg-blue-950 px-2.5 py-1 rounded-full border border-blue-800">15s Left</span>
        </div>
        <p id="bannerDesc" class="text-xs text-slate-400 font-semibold text-left">Hardware relay signal triggered. Gate is open for 15 seconds.</p>
        <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div id="progressBar" class="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-1000 w-full"></div>
        </div>
      </div>
    </div>

    <!-- ── TAB 2: ENROLL CLIENT (MEMBERS) ── -->
    <div id="tabContentClient" class="hidden w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
      <div>
        <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
          <span>👤 Enroll Client Fingerprint</span>
        </h2>
        <p class="text-xs text-slate-400 mt-1">
          Select member to capture finger scan on ESSL scanner & map to permanent Biometric ID
        </p>
      </div>

      <div class="space-y-3">
        <input 
          type="text" 
          id="searchClient" 
          oninput="renderRoster()"
          placeholder="Search client by Biometric ID (e.g. 222), Name, or Phone..."
          class="w-full h-11 bg-slate-800 border border-slate-700 rounded-2xl px-4 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />

        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <button onclick="setFilter('client', 'pending')" id="btnFilterClientPending" class="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all bg-amber-500 text-slate-950">Pending</button>
            <button onclick="setFilter('client', 'enrolled')" id="btnFilterClientEnrolled" class="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all text-slate-400 hover:text-white">Enrolled</button>
            <button onclick="setFilter('client', 'all')" id="btnFilterClientAll" class="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all text-slate-400 hover:text-white">All</button>
          </div>
        <div class="flex items-center gap-2">
          <span id="clientCountText" class="text-[11px] text-slate-400 font-mono">Loading members...</span>
          <button onclick="refreshAll()" class="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-[10px] font-black uppercase border border-slate-700">Refresh</button>
        </div>
        </div>
      </div>

      <!-- Enrollment Progress Banner -->
      <div id="enrollProgressBannerClient" class="hidden p-4 bg-slate-800 border border-blue-500/40 rounded-2xl space-y-3">
        <div class="flex items-center justify-between border-b border-slate-700 pb-2">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
            <span id="enrollProgressTargetClient" class="text-xs font-black uppercase text-white tracking-wider">Target Client</span>
          </div>
          <span id="enrollProgressStateClient" class="text-[10px] font-mono font-bold text-blue-400 bg-blue-950 border border-blue-800 px-2 py-0.5 rounded-md">INITIALIZING</span>
        </div>
        <div id="enrollProgressMsgClient" class="text-xs font-semibold text-slate-300">Place finger on scanner 3 times...</div>
        <div class="grid grid-cols-4 gap-2 pt-1 text-center text-[10px] font-mono font-bold">
          <div id="scanStep1_client" class="p-2 rounded-xl border bg-slate-900 border-slate-800 text-slate-600">SCAN 1</div>
          <div id="scanStep2_client" class="p-2 rounded-xl border bg-slate-900 border-slate-800 text-slate-600">SCAN 2</div>
          <div id="scanStep3_client" class="p-2 rounded-xl border bg-slate-900 border-slate-800 text-slate-600">SCAN 3</div>
          <div id="scanStep4_client" class="p-2 rounded-xl border bg-slate-900 border-slate-800 text-slate-600">MAPPED ✓</div>
        </div>
      </div>

      <div id="clientRosterList" class="space-y-2 max-h-96 overflow-y-auto pr-1"></div>
    </div>

    <!-- ── TAB 3: ENROLL EMPLOYEE (STAFF) ── -->
    <div id="tabContentEmployee" class="hidden w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
      <div>
        <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
          <span>👔 Enroll Employee Fingerprint</span>
        </h2>
        <p class="text-xs text-slate-400 mt-1">
          Select staff/trainer to map their fingerprint for attendance & gate access
        </p>
      </div>

      <div class="space-y-3">
        <input 
          type="text" 
          id="searchEmployee" 
          oninput="renderRoster()"
          placeholder="Search employee by Biometric ID, Name, Role, or Phone..."
          class="w-full h-11 bg-slate-800 border border-slate-700 rounded-2xl px-4 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
        />

        <div class="flex items-center justify-between text-xs">
          <div class="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
            <button onclick="setFilter('employee', 'pending')" id="btnFilterEmpPending" class="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all bg-amber-500 text-slate-950">Pending</button>
            <button onclick="setFilter('employee', 'enrolled')" id="btnFilterEmpEnrolled" class="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all text-slate-400 hover:text-white">Enrolled</button>
            <button onclick="setFilter('employee', 'all')" id="btnFilterEmpAll" class="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all text-slate-400 hover:text-white">All</button>
          </div>
          <div class="flex items-center gap-2">
            <span id="employeeCountText" class="text-[11px] text-slate-400 font-mono">Loading staff...</span>
            <button onclick="refreshAll()" class="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-[10px] font-black uppercase border border-slate-700">Refresh</button>
          </div>
        </div>
      </div>

      <!-- Enrollment Progress Banner -->
      <div id="enrollProgressBannerEmployee" class="hidden p-4 bg-slate-800 border border-blue-500/40 rounded-2xl space-y-3">
        <div class="flex items-center justify-between border-b border-slate-700 pb-2">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping"></span>
            <span id="enrollProgressTargetEmployee" class="text-xs font-black uppercase text-white tracking-wider">Target Staff</span>
          </div>
          <span id="enrollProgressStateEmployee" class="text-[10px] font-mono font-bold text-blue-400 bg-blue-950 border border-blue-800 px-2 py-0.5 rounded-md">INITIALIZING</span>
        </div>
        <div id="enrollProgressMsgEmployee" class="text-xs font-semibold text-slate-300">Place finger on scanner 3 times...</div>
        <div class="grid grid-cols-4 gap-2 pt-1 text-center text-[10px] font-mono font-bold">
          <div id="scanStep1_emp" class="p-2 rounded-xl border bg-slate-900 border-slate-800 text-slate-600">SCAN 1</div>
          <div id="scanStep2_emp" class="p-2 rounded-xl border bg-slate-900 border-slate-800 text-slate-600">SCAN 2</div>
          <div id="scanStep3_emp" class="p-2 rounded-xl border bg-slate-900 border-slate-800 text-slate-600">SCAN 3</div>
          <div id="scanStep4_emp" class="p-2 rounded-xl border bg-slate-900 border-slate-800 text-slate-600">MAPPED ✓</div>
        </div>
      </div>

      <div id="employeeRosterList" class="space-y-2 max-h-96 overflow-y-auto pr-1"></div>
    </div>

    <div id="tabContentBlocked" class="hidden w-full max-w-2xl bg-slate-900/90 border border-rose-900/50 rounded-3xl p-6 shadow-2xl space-y-5">
      <div>
        <h2 class="text-lg font-black text-white uppercase tracking-tight">🚫 Blocked Client &amp; Employee Access</h2>
        <p class="text-xs text-slate-400 mt-1">Block or restore the user on the terminal without deleting saved fingerprints. Expired memberships are denied automatically until renewed.</p>
      </div>
      <input id="searchBlocked" type="search" oninput="renderBlockedRoster()" placeholder="Search by biometric ID, name, phone, or staff/member ID..." class="w-full h-11 bg-slate-800 border border-slate-700 rounded-2xl px-4 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500" />
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-1.5 bg-slate-800/80 p-1 rounded-xl border border-slate-700">
          <button onclick="setBlockedFilter('all')" id="btnBlockedAll" class="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase bg-blue-600 text-white">All</button>
          <button onclick="setBlockedFilter('client')" id="btnBlockedClient" class="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase text-slate-400">Clients</button>
          <button onclick="setBlockedFilter('employee')" id="btnBlockedEmployee" class="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase text-slate-400">Employees</button>
        </div>
        <div class="flex items-center gap-2"><span id="blockedCountText" class="text-[11px] text-slate-400 font-mono">Loading blocked access...</span><button onclick="refreshAll()" class="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-200 text-[10px] font-black uppercase border border-slate-700">Refresh</button></div>
      </div>
      <div id="blockedRosterList" class="space-y-2 max-h-[32rem] overflow-y-auto pr-1"></div>
    </div>

    <!-- Quick Access Links Card -->
    <div class="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 px-6 text-center text-xs text-slate-400 max-w-lg shadow-sm">
      💡 <strong class="text-white font-bold">Gym WiFi Quick Access:</strong> Connect to Gym WiFi and open <code class="bg-blue-950 text-blue-300 px-2 py-0.5 rounded font-mono font-bold border border-blue-800">http://${lanIp}:8000/gate-control</code> for 1-tap gate unlock & fingerprint enrollment.
    </div>

  </main>

  <!-- Footer -->
  <footer class="border-t border-slate-800 bg-slate-900/60 py-4 text-center text-xs font-semibold text-slate-500">
    The Warrior Gym OS &copy; 2026 • Deployed Site: <a href="${crmUrl}" target="_blank" class="text-blue-400 underline">thewarriorgym.in</a>
  </footer>

  <script>
    let currentTab = 'gate';
    let filterClient = 'all';
    let filterEmployee = 'pending';
    let filterBlocked = 'all';
    const gateSearchParams = new URLSearchParams(window.location.search);
    const requestedBioId = gateSearchParams.get('reenroll');
    let membersData = [];
    let employeesData = [];
    let deviceUsersData = [];
    let countdownInterval = null;

    function switchTab(tab) {
      currentTab = tab;
      document.getElementById('tabContentGate').className = tab === 'gate' ? 'w-full max-w-md flex flex-col items-center justify-center space-y-6 py-4' : 'hidden';
      document.getElementById('tabContentClient').className = tab === 'client' ? 'w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5' : 'hidden';
      document.getElementById('tabContentEmployee').className = tab === 'employee' ? 'w-full max-w-2xl bg-slate-900/90 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5' : 'hidden';
      document.getElementById('tabContentBlocked').className = tab === 'blocked' ? 'w-full max-w-2xl bg-slate-900/90 border border-rose-900/50 rounded-3xl p-6 shadow-2xl space-y-5' : 'hidden';

      document.getElementById('tabBtnGate').className = tab === 'gate' ? 'px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-2 bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/40' : 'px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-2 bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white';
      document.getElementById('tabBtnClient').className = tab === 'client' ? 'px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-2 bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/40' : 'px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-2 bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white';
      document.getElementById('tabBtnEmployee').className = tab === 'employee' ? 'px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-2 bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-900/40' : 'px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-2 bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white';
      document.getElementById('tabBtnBlocked').className = tab === 'blocked' ? 'px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-2 bg-rose-700 text-white border-rose-500 shadow-lg shadow-rose-900/40' : 'px-5 py-2.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-2 bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-white';

      if (tab === 'client' || tab === 'employee' || tab === 'blocked') {
        fetchRoster();
      }
    }

    async function fetchRoster() {
      try {
        const res = await fetch('/api/gate/roster');
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || 'CRM roster request failed.');
        membersData = data.members || [];
        employeesData = data.employees || [];
        deviceUsersData = data.deviceUsers || [];
        renderRoster();
        renderBlockedRoster();
        return true;
      } catch (err) {
        document.getElementById('clientCountText').innerText = 'CRM CONNECTION FAILED';
        document.getElementById('employeeCountText').innerText = String(err && err.message || '').includes('Could not load the live CRM roster') ? 'EMPLOYEE DATA FETCH FAILED' : 'CRM CONNECTION ERROR';
        const message = err && err.message ? err.message : 'CRM connection failed.';
        for (const listId of ['clientRosterList', 'employeeRosterList', 'blockedRosterList']) {
          const errorBox = document.createElement('div');
          errorBox.className = 'p-8 text-center text-xs text-rose-300 bg-rose-950/40 rounded-2xl border border-rose-800';
          errorBox.textContent = message;
          document.getElementById(listId).replaceChildren(errorBox);
        }
        console.error('Failed to fetch live CRM roster:', err);
        return false;
      }
    }

    async function refreshDeviceStatus() {
      try {
        const response = await fetch('/api/gate/status');
        const status = await response.json();
        const online = response.ok && status.connected === true;
        document.getElementById('deviceStatusDot').className = 'relative inline-flex rounded-full h-2.5 w-2.5 ' + (online ? 'bg-emerald-500' : 'bg-rose-500');
        document.getElementById('deviceStatusText').innerText = status.serverIp + ' · ' + (online ? 'DEVICE ONLINE' : 'DEVICE OFFLINE');
        document.getElementById('deviceEndpointText').innerText = status.ip + ':' + status.port;
      } catch (error) {
        document.getElementById('deviceStatusDot').className = 'relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500';
        document.getElementById('deviceStatusText').innerText = 'DEVICE STATUS FAILED';
        document.getElementById('deviceEndpointText').innerText = 'Unable to read device configuration';
      }
    }

    async function refreshAll() {
      const employeeCount = document.getElementById('employeeCountText');
      const employeeList = document.getElementById('employeeRosterList');
      employeeCount.innerText = 'Refreshing...';
      employeeList.innerHTML = '<div class="p-8 text-center text-xs text-blue-200 bg-slate-800/40 rounded-2xl border border-slate-800">Fetching CRM employees...</div>';
      await refreshDeviceStatus();
      employeeCount.innerText = 'Reconciling device users and CRM enrollment...';
      employeeList.innerHTML = '<div class="p-8 text-center text-xs text-blue-200 bg-slate-800/40 rounded-2xl border border-slate-800">Updating enrollment status...</div>';
      await fetchRoster();
    }

    function hasFingerprintTemplate(item) {
      const bioId = getCleanNumericId(item);
      const deviceUser = deviceUsersData.find(user => String(user.userId).trim() === bioId);
      const status = String(item.fingerprintStatus || '').toUpperCase();
      return Number(deviceUser && deviceUser.fingerprintsCount || 0) > 0
        || item.fingerprintEnrolled === true
        || item.fingerprint && item.fingerprint.enrolled === true
        || status === 'ENROLLED';
    }

    function isEmployeeEnrollmentComplete(employee) {
      const crmStatus = String(employee.fingerprintStatus || employee.fingerprint?.status || employee.biometricStatus || '').toUpperCase();
      return employee.fingerprintEnrolled === true || crmStatus === 'ENROLLED';
    }

    function hasMappedDeviceUser(item) {
      const bioId = getCleanNumericId(item);
      return deviceUsersData.some(user => String(user.userId).trim() === bioId);
    }

    function setFilter(type, filter) {
      if (type === 'client') {
        filterClient = filter;
        document.getElementById('btnFilterClientPending').className = filter === 'pending' ? 'px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all bg-amber-500 text-slate-950' : 'px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all text-slate-400 hover:text-white';
        document.getElementById('btnFilterClientEnrolled').className = filter === 'enrolled' ? 'px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all bg-emerald-500 text-slate-950' : 'px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all text-slate-400 hover:text-white';
        document.getElementById('btnFilterClientAll').className = filter === 'all' ? 'px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all bg-blue-600 text-white' : 'px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all text-slate-400 hover:text-white';
      } else {
        filterEmployee = filter;
        document.getElementById('btnFilterEmpPending').className = filter === 'pending' ? 'px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all bg-amber-500 text-slate-950' : 'px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all text-slate-400 hover:text-white';
        document.getElementById('btnFilterEmpEnrolled').className = filter === 'enrolled' ? 'px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all bg-emerald-500 text-slate-950' : 'px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all text-slate-400 hover:text-white';
        document.getElementById('btnFilterEmpAll').className = filter === 'all' ? 'px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all bg-blue-600 text-white' : 'px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all text-slate-400 hover:text-white';
      }
    }

    function setBlockedFilter(filter) {
      filterBlocked = filter;
      for (const key of ['all', 'client', 'employee']) {
        const button = document.getElementById('btnBlocked' + key.charAt(0).toUpperCase() + key.slice(1));
        button.className = filter === key
          ? 'px-3 py-1.5 rounded-lg text-[11px] font-black uppercase bg-blue-600 text-white'
          : 'px-3 py-1.5 rounded-lg text-[11px] font-black uppercase text-slate-400 hover:text-white';
      }
      renderBlockedRoster();
    }

    function renderBlockedRoster() {
      const query = (document.getElementById('searchBlocked')?.value || '').trim().toLowerCase();
      const records = [
        ...membersData.filter(person => person.biometricBlocked === true || person.biometricBlockPending === true).map(person => ({ ...person, accessKind: 'client' })),
        ...employeesData.filter(person => person.biometricBlocked === true || person.biometricBlockPending === true).map(person => ({ ...person, accessKind: 'employee' })),
      ].filter(person => {
        if (filterBlocked !== 'all' && person.accessKind !== filterBlocked) return false;
        const searchable = [person.name, person.phone, person.memberId, person.employeeId, person.id, person.biometricId, person.deviceUserId].join(' ').toLowerCase();
        return !query || searchable.includes(query);
      });
      document.getElementById('blockedCountText').textContent = records.length + ' BLOCKED / PENDING';
      const list = document.getElementById('blockedRosterList');
      if (!records.length) {
        list.innerHTML = '<div class="p-8 text-center text-xs text-slate-400 bg-slate-800/40 rounded-2xl border border-slate-800">No blocked clients or employees match this search.</div>';
        return;
      }
      list.innerHTML = records.map(person => {
        const pending = person.biometricBlockPending === true;
        const retryAction = person.biometricBlockAction === 'unblock';
        const name = escapeHtml(person.name || (person.accessKind === 'client' ? 'Client' : 'Employee'));
        const contact = escapeHtml(person.phone || person.employeeId || person.memberId || 'No contact');
        const reason = person.biometricBlockReason ? '<div class="text-[10px] text-slate-500 mt-0.5">' + escapeHtml(person.biometricBlockReason) + '</div>' : '';
        const action = pending && retryAction ? 'Retry Unblock' : 'Unblock';
        return '<div class="p-4 rounded-2xl border bg-slate-800/70 border-rose-900/50 flex flex-wrap items-center justify-between gap-3">'
          + '<div class="flex items-center gap-3 min-w-0"><div class="w-10 h-10 rounded-xl bg-slate-900 border border-rose-800 flex items-center justify-center font-mono text-xs font-black text-rose-300 shrink-0">#' + (getCleanNumericId(person) || '—') + '</div>'
          + '<div class="min-w-0"><div class="text-xs font-black text-white truncate">' + name + ' <span class="text-[10px] uppercase text-slate-400">· ' + person.accessKind + '</span></div>'
          + '<div class="text-[11px] text-slate-400 mt-1">' + contact + ' · ' + (pending ? (retryAction ? 'UNBLOCK SYNC PENDING' : 'BLOCK SYNC PENDING') : 'ACCESS BLOCKED') + '</div>' + reason + '</div></div>'
          + '<button type="button" data-blocked-action="unblock" data-person-kind="' + person.accessKind + '" data-person-id="' + encodeURIComponent(String(person.id || '')) + '" class="px-4 py-2 rounded-xl text-xs font-black uppercase border border-emerald-500 bg-emerald-600 hover:bg-emerald-500 text-white disabled:opacity-60">' + action + '</button></div>';
      }).join('');
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
    }

    async function unblockBiometric(kind, id, button) {
      const people = kind === 'employee' ? employeesData : membersData;
      const person = people.find(item => String(item.id) === String(id));
      if (!person || button.disabled) return;
      const original = button.textContent;
      button.disabled = true;
      button.textContent = 'SYNCING...';
      try {
        const response = await fetch('/api/devices/biometric/access', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberId: id, biometricId: Number(getCleanNumericId(person)), enabled: true, isEmployee: kind === 'employee' }) });
        const queued = await response.json().catch(() => ({}));
        if (!response.ok || !queued.success || !queued.enrollmentDocId) throw new Error(queued.error || 'Could not queue terminal enable.');
        // A manual biometric change has priority on the local service, but may
        // need to wait for the terminal's current SDK operation to finish.
        const deadline = Date.now() + 120000;
        let complete = false;
        while (Date.now() < deadline) {
          const statusResponse = await fetch('/api/devices/biometric/command/' + encodeURIComponent(queued.enrollmentDocId));
          const status = await statusResponse.json().catch(() => ({}));
          if (!statusResponse.ok) throw new Error(status.error || 'Could not read device access status.');
          if (status.status === 'success') { complete = true; break; }
          if (status.status === 'failed') throw new Error(status.message || 'The device rejected the enable command.');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        if (!complete) throw new Error('Terminal has not confirmed enable yet. Retry when the device is online.');
        person.biometricBlocked = false;
        person.biometricBlockPending = false;
        person.biometricBlockAction = null;
        person.biometricBlockCommandId = null;
        const label = kind === 'employee' ? 'Employee' : 'Client';
        document.getElementById('blockedCountText').textContent = label + ' enabled on terminal · saved fingerprint kept';
        await fetchRoster();
      } catch (error) {
        button.disabled = false;
        button.textContent = original;
        document.getElementById('blockedCountText').textContent = 'UNBLOCK FAILED: ' + String(error && error.message || 'Retry when terminal is online.');
      }
    }

    document.getElementById('blockedRosterList').addEventListener('click', event => {
      const button = event.target.closest('[data-blocked-action="unblock"]');
      if (!button) return;
      unblockBiometric(button.dataset.personKind, decodeURIComponent(button.dataset.personId || ''), button);
    });

    function getCleanNumericId(item) {
      if (!item) return '';
      if (item.biometricId !== undefined && item.biometricId !== null) {
        const bioId = String(item.biometricId).trim();
        if (/^\\d{1,5}$/.test(bioId) && Number(bioId) > 0 && Number(bioId) <= 65535) return bioId;
      }
      if (item.deviceUserId) {
        const devId = String(item.deviceUserId).trim();
        if (/^\\d{1,5}$/.test(devId) && Number(devId) > 0 && Number(devId) <= 65535) return devId;
      }
      if (item.employeeId) {
        const match = String(item.employeeId).match(/\\d+/);
        if (match && Number(match[0]) > 0) return match[0];
      }
      if (item.id && typeof item.id === 'string' && item.id.startsWith('emp_')) {
        const match = item.id.match(/\\d+/);
        if (match && Number(match[0]) > 0) return match[0];
      }
      return '';
    }

    async function assignMemberBiometricId(memberId, button) {
      const originalText = button.textContent;
      const countText = document.getElementById('clientCountText');
      button.disabled = true;
      button.textContent = 'ASSIGNING...';
      try {
        const response = await fetch('/api/gate/members/' + encodeURIComponent(memberId) + '/assign-biometric-id', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}'
        });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || !result.success || !result.biometricId) throw new Error(result.error || 'Biometric ID assignment failed');
        countText.innerText = 'BIO ID #' + result.biometricId + ' ASSIGNED — READY TO ENROLL';
        const refreshed = await fetchRoster();
        if (!refreshed) throw new Error('ID assigned, but member list did not refresh. Press Refresh to verify before enrollment.');
      } catch (error) {
        button.disabled = false;
        button.textContent = originalText;
        countText.innerText = 'ID ASSIGNMENT FAILED: ' + String(error && error.message || 'Check CRM connection and retry.');
        console.error('[CLIENT] Biometric ID assignment failed:', error);
      }
    }

    function renderRoster() {
      // 1. Render Client Members
      const qClient = (document.getElementById('searchClient').value || '').trim().toLowerCase();
      const filteredMembers = membersData.filter(m => {
        const bioId = getCleanNumericId(m);
        const name = String(m.name || '').toLowerCase();
        const phone = String(m.phone || '');
        const memberId = String(m.memberId || m.id || '').toLowerCase();
        const matches = !qClient || bioId.includes(qClient) || memberId.includes(qClient) || name.includes(qClient) || phone.includes(qClient);
        const isEnrolled = hasFingerprintTemplate(m);
        if (!matches) return false;
        if (filterClient === 'pending') return !isEnrolled;
        if (filterClient === 'enrolled') return isEnrolled;
        return true;
      });

      const totalPendingClients = membersData.filter(m => !hasFingerprintTemplate(m)).length;
      document.getElementById('clientCountText').innerText = 'TOTAL PENDING: ' + totalPendingClients + ' · SHOWING ' + filteredMembers.length;
      const clientList = document.getElementById('clientRosterList');
      if (filteredMembers.length === 0) {
        clientList.innerHTML = '<div class="p-8 text-center text-xs text-slate-500 bg-slate-800/40 rounded-2xl border border-slate-800">No members found matching selected filter & search keyword.</div>';
      } else {
        clientList.innerHTML = filteredMembers.map(m => {
          const bioId = getCleanNumericId(m);
          const isEnrolled = hasFingerprintTemplate(m);
          const isMapped = hasMappedDeviceUser(m);
          const memberId = String(m.id || '');
          const accessText = m.biometricBlocked ? 'Unblock Access' : 'Block Access';
          const accessClass = m.biometricBlocked ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500' : 'bg-rose-700 hover:bg-rose-600 border-rose-600';
          return \`
            <div class="p-3.5 rounded-2xl border bg-slate-800/60 border-slate-700/60 flex items-center justify-between hover:border-slate-700 transition-all">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center font-mono text-xs font-black text-blue-400 shrink-0">
                  #\${bioId || '—'}
                </div>
                <div>
                  <div class="text-xs font-black text-white">\${m.name || 'Member'} <span class="text-[10px] font-mono text-slate-400">(\${m.phone || 'No phone'})</span></div>
                  <div class="text-[11px] text-slate-400 mt-0.5">Fingerprint: <span class="\${isEnrolled ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}">\${isEnrolled ? 'ENROLLED' : 'NOT ENROLLED'}</span> • Device: <span class="\${isMapped ? 'text-emerald-400 font-bold' : 'text-slate-400'}">\${isMapped ? 'MAPPED' : 'NOT MAPPED'}</span></div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button type="button" data-client-action="\${bioId ? 'enroll' : 'assign'}" data-member-id="\${encodeURIComponent(memberId)}" data-biometric-id="\${bioId}" data-encoded-name="\${encodeURIComponent(m.name || '')}" class="px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border cursor-pointer \${bioId ? (isEnrolled ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-500 shadow-md') : 'bg-amber-600 hover:bg-amber-500 text-white border-amber-500'}">
                  \${bioId ? (isEnrolled ? 'Re-Enroll' : 'Start Enroll') : 'Assign Biometric ID'}
                </button>
                <button type="button" data-roster-access="1" data-person-kind="client" data-person-id="\${encodeURIComponent(memberId)}" data-biometric-id="\${bioId}" data-enabled="\${m.biometricBlocked ? 'false' : 'true'}" \${bioId ? '' : 'disabled'} class="px-3 py-2 rounded-xl text-[10px] font-black uppercase text-white border disabled:opacity-40 \${accessClass}">\${bioId ? accessText : 'No Bio ID'}</button>
              </div>
            </div>
          \`;
        }).join('');
      }

      // 2. Render Employees (Staff)
      const qEmp = (document.getElementById('searchEmployee').value || '').trim().toLowerCase();
      const filteredEmployees = employeesData.filter(e => {
        const bioId = getCleanNumericId(e);
        const name = String(e.name || '').toLowerCase();
        const employeeId = String(e.employeeId || '').toLowerCase();
        const role = String(e.role || '').toLowerCase();
        const phone = String(e.phone || '');
        const crmId = String(e.id || '').toLowerCase();
        const matches = !qEmp || bioId.includes(qEmp) || employeeId.includes(qEmp) || crmId.includes(qEmp) || name.includes(qEmp) || role.includes(qEmp) || phone.includes(qEmp);
        const isEnrolled = isEmployeeEnrollmentComplete(e);
        if (!matches) return false;
        if (filterEmployee === 'pending') return !isEnrolled;
        if (filterEmployee === 'enrolled') return isEnrolled;
        return true;
      });

      document.getElementById('employeeCountText').innerText = 'Showing ' + filteredEmployees.length + ' staff members';
      const empList = document.getElementById('employeeRosterList');
      if (filteredEmployees.length === 0) {
        empList.innerHTML = '<div class="p-8 text-center text-xs text-slate-500 bg-slate-800/40 rounded-2xl border border-slate-800">No staff members found matching selected filter & search keyword.</div>';
      } else {
        empList.innerHTML = filteredEmployees.map(e => {
          const bioId = getCleanNumericId(e);
          const isEnrolled = isEmployeeEnrollmentComplete(e);
          const hasDeviceTemplate = hasFingerprintTemplate(e);
          const employeeCode = e.employeeId || (bioId ? 'EMP-' + bioId : e.id);
          const accessText = e.biometricBlocked ? 'Unblock Access' : 'Block Access';
          const accessClass = e.biometricBlocked ? 'bg-emerald-600 hover:bg-emerald-500 border-emerald-500' : 'bg-rose-700 hover:bg-rose-600 border-rose-600';
          return \`
            <div class="p-3.5 rounded-2xl border bg-slate-800/60 border-slate-700/60 flex items-center justify-between hover:border-slate-700 transition-all">
              <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center font-mono text-xs font-black text-purple-400 shrink-0">
                  #\${bioId || '—'}
                </div>
                <div>
                  <div class="text-xs font-black text-white">\${e.name || 'Staff'} <span class="text-[10px] font-mono text-purple-300">(\${e.role || 'Staff'})</span></div>
                  <div class="text-[10px] font-mono text-slate-400 mt-0.5">\${employeeCode} · \${e.status || 'Status unavailable'}</div>
                  <div class="text-[11px] text-slate-400 mt-0.5">\${e.phone || 'No Phone'} • <span class="\${isEnrolled ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}">\${isEnrolled ? '✓ Enrolled' : (hasDeviceTemplate ? 'Pending · device template needs CRM verification' : 'Pending')}</span></div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <button \${bioId ? '' : 'disabled'} onclick="triggerEnroll('\${e.id}', '\${bioId}', '\${encodeURIComponent(e.name || '')}', true)" class="px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider border cursor-pointer \${bioId ? (isEnrolled ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700' : 'bg-purple-600 hover:bg-purple-500 text-white border-purple-500 shadow-md') : 'bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed'}">
                  \${bioId ? (isEnrolled ? 'Re-Enroll' : 'Start Enroll') : 'Assign Biometric ID'}
                </button>
                <button type="button" data-roster-access="1" data-person-kind="employee" data-person-id="\${encodeURIComponent(String(e.id || ''))}" data-biometric-id="\${bioId}" data-enabled="\${e.biometricBlocked ? 'false' : 'true'}" \${bioId ? '' : 'disabled'} class="px-3 py-2 rounded-xl text-[10px] font-black uppercase text-white border disabled:opacity-40 \${accessClass}">\${bioId ? accessText : 'No Bio ID'}</button>
              </div>
            </div>
          \`;
        }).join('');
      }
    }

    // Client rows are replaced on every search/filter/refresh. Use one delegated
    // listener on their stable container so member enrollment remains clickable
    // after any re-render and does not depend on generated inline JavaScript.
    async function changeRosterAccess(kind, id, biometricId, enabled, button) {
      if (button.disabled) return;
      const original = button.textContent;
      button.disabled = true;
      button.textContent = 'SAVING...';
      const countId = kind === 'employee' ? 'employeeCountText' : 'clientCountText';
      try {
        const response = await fetch('/api/devices/biometric/access', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ memberId: id, biometricId: Number(biometricId), enabled, isEmployee: kind === 'employee' }),
          signal: AbortSignal.timeout(20000)
        });
        const queued = await response.json().catch(() => ({}));
        if (!response.ok || !queued.success || !queued.enrollmentDocId) throw new Error(queued.error || 'Could not queue terminal access change.');
        const deadline = Date.now() + 120000;
        while (Date.now() < deadline) {
          const statusResponse = await fetch('/api/devices/biometric/command/' + encodeURIComponent(queued.enrollmentDocId));
          const status = await statusResponse.json().catch(() => ({}));
          if (!statusResponse.ok) throw new Error(status.error || 'Could not read terminal status.');
          if (status.status === 'success') {
            await fetchRoster();
            return;
          }
          if (status.status === 'failed') throw new Error(status.message || 'Terminal rejected the access change.');
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        throw new Error('Terminal did not confirm yet. Check device connection and retry.');
      } catch (error) {
        button.disabled = false;
        button.textContent = original;
        document.getElementById(countId).textContent = 'ACCESS UPDATE FAILED: ' + String(error && error.message || 'Retry when terminal is online.');
      }
    }

    for (const listId of ['clientRosterList', 'employeeRosterList']) {
      document.getElementById(listId).addEventListener('click', event => {
        const button = event.target && event.target.closest ? event.target.closest('button[data-roster-access]') : null;
        if (!button || !event.currentTarget.contains(button) || button.disabled) return;
        changeRosterAccess(button.dataset.personKind, decodeURIComponent(button.dataset.personId || ''), button.dataset.biometricId || '', button.dataset.enabled === 'true', button);
      });
    }

    document.getElementById('clientRosterList').addEventListener('click', event => {
      const button = event.target && event.target.closest ? event.target.closest('button[data-client-action]') : null;
      if (!button || !event.currentTarget.contains(button) || button.disabled) return;
      const action = button.dataset.clientAction;
      const memberId = button.dataset.memberId || '';
      if (action === 'enroll') {
        triggerEnroll(memberId, button.dataset.biometricId || '', button.dataset.encodedName || '', false, false, button);
      } else if (action === 'assign') {
        assignMemberBiometricId(memberId, button);
      }
    });

    async function triggerEnroll(targetId, bioId, encodedName, isEmployee, retryCrmSync = false, triggerButton = null) {
      const name = decodeURIComponent(encodedName);
      const prefix = isEmployee ? 'Employee' : 'Client';
      const banner = document.getElementById(isEmployee ? 'enrollProgressBannerEmployee' : 'enrollProgressBannerClient');
      const targetText = document.getElementById(isEmployee ? 'enrollProgressTargetEmployee' : 'enrollProgressTargetClient');
      const stateText = document.getElementById(isEmployee ? 'enrollProgressStateEmployee' : 'enrollProgressStateClient');
      const msgText = document.getElementById(isEmployee ? 'enrollProgressMsgEmployee' : 'enrollProgressMsgClient');

      const step1 = document.getElementById(isEmployee ? 'scanStep1_emp' : 'scanStep1_client');
      const step2 = document.getElementById(isEmployee ? 'scanStep2_emp' : 'scanStep2_client');
      const step3 = document.getElementById(isEmployee ? 'scanStep3_emp' : 'scanStep3_client');
      const step4 = document.getElementById(isEmployee ? 'scanStep4_emp' : 'scanStep4_client');

      banner.className = 'block p-4 bg-slate-800 border border-blue-500/40 rounded-2xl space-y-3';
      targetText.innerText = 'TARGET ' + prefix.toUpperCase() + ': #' + bioId + ' — ' + name;
      stateText.innerText = retryCrmSync ? 'VERIFYING DEVICE TEMPLATE...' : 'CONNECTING TO DEVICE...';
      msgText.innerText = retryCrmSync ? 'Verifying the saved template before retrying CRM sync...' : 'Waiting for the device. Follow its prompts and complete the fingerprint scans.';
      const oldRetryButton = document.getElementById(isEmployee ? 'crmRetryButtonEmployee' : 'crmRetryButtonClient');
      if (oldRetryButton) oldRetryButton.remove();
      const originalButtonText = triggerButton ? triggerButton.textContent : '';
      if (triggerButton) { triggerButton.disabled = true; triggerButton.textContent = retryCrmSync ? 'RETRYING...' : 'WAIT FOR SCANNER...'; }

      step1.className = 'p-2 rounded-xl border bg-slate-900 border-slate-800 text-slate-600';
      step2.className = 'p-2 rounded-xl border bg-slate-900 border-slate-800 text-slate-600';
      step3.className = 'p-2 rounded-xl border bg-slate-900 border-slate-800 text-slate-600';
      step4.className = 'p-2 rounded-xl border bg-slate-900 border-slate-800 text-slate-600';

      try {
        const payload = {
          biometricId: bioId,
          memberName: name,
          name: name,
          enrollmentSessionId: 'sess_' + bioId + '_' + Date.now(),
          isEmployee: isEmployee,
          retryCrmSync: retryCrmSync
        };
        if (isEmployee) payload.employeeId = targetId;
        else payload.memberId = targetId;

        const res = await fetch('/api/gate/enroll-fingerprint', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(330000)
        });
        const data = await res.json().catch(() => ({}));

        if (data.success) {
          step1.className = 'p-2 rounded-xl border bg-blue-900/60 border-blue-500 text-blue-300';
          step2.className = 'p-2 rounded-xl border bg-blue-900/60 border-blue-500 text-blue-300';
          step3.className = 'p-2 rounded-xl border bg-blue-900/60 border-blue-500 text-blue-300';
          step4.className = 'p-2 rounded-xl border bg-emerald-900/60 border-emerald-500 text-emerald-300';
          stateText.innerText = 'TEMPLATE VERIFIED · MAPPED ✓';
          stateText.className = 'text-[10px] font-mono font-bold text-emerald-400 bg-emerald-950 border border-emerald-800 px-2 py-0.5 rounded-md';
          msgText.innerText = data.message || 'Fingerprint template verified on the device and mapped to CRM ID #' + bioId + ' (' + name + ')';
          await fetchRoster();
        } else {
          step1.className = 'p-2 rounded-xl border bg-rose-950 border-rose-800 text-rose-400';
          step2.className = 'p-2 rounded-xl border bg-rose-950 border-rose-800 text-rose-400';
          step3.className = 'p-2 rounded-xl border bg-rose-950 border-rose-800 text-rose-400';
          step4.className = 'p-2 rounded-xl border bg-rose-950 border-rose-800 text-rose-400';
          stateText.innerText = data.status || 'ENROLLMENT FAILED';
          stateText.className = 'text-[10px] font-mono font-bold text-rose-400 bg-rose-950 border border-rose-800 px-2 py-0.5 rounded-md';
          msgText.innerText = '❌ ' + (data.error || data.message || 'Device did not confirm a saved fingerprint template.');
          if (data.deviceEnrolled && data.retryable) {
            stateText.innerText = 'CRM SYNC PENDING';
            const retryButton = document.createElement('button');
            retryButton.id = isEmployee ? 'crmRetryButtonEmployee' : 'crmRetryButtonClient';
            retryButton.className = 'px-3 py-2 rounded-lg bg-amber-500 text-slate-950 text-xs font-black uppercase';
            retryButton.textContent = 'Retry CRM Sync (No New Scan)';
            retryButton.onclick = () => triggerEnroll(targetId, bioId, encodeURIComponent(name), isEmployee, true);
            banner.appendChild(retryButton);
          }
        }
      } catch (err) {
        step1.className = 'p-2 rounded-xl border bg-rose-950 border-rose-800 text-rose-400';
        stateText.innerText = 'ERROR ❌';
        stateText.className = 'text-[10px] font-mono font-bold text-rose-400 bg-rose-950 border border-rose-800 px-2 py-0.5 rounded-md';
        msgText.innerText = '❌ ' + (err && err.message ? err.message : 'Unable to reach the local enrollment service.');
      } finally {
        if (triggerButton) { triggerButton.disabled = false; triggerButton.textContent = originalButtonText; }
      }
    }

    async function triggerGateUnlock() {
      const btn = document.getElementById('unlockBtn');
      const banner = document.getElementById('statusBanner');
      const bannerTitle = document.getElementById('bannerTitle');
      const bannerDesc = document.getElementById('bannerDesc');
      const timerText = document.getElementById('timerText');
      const progressBar = document.getElementById('progressBar');
      const lockIcon = document.getElementById('lockIcon');

      btn.disabled = true;
      btn.style.opacity = '0.7';
      lockIcon.innerText = '🔓';

      banner.className = 'block w-full bg-slate-900 border border-slate-800 p-5 rounded-3xl shadow-xl space-y-3 transition-all text-center';
      bannerTitle.innerText = '⏳ TRANSMITTING UNLOCK SIGNAL...';
      bannerDesc.innerText = 'Sending signal to EasyBio hardware at ${deviceIp}...';
      timerText.innerText = '15s';
      progressBar.style.width = '100%';

      try {
        const res = await fetch('/api/attendance/gate-unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: 'lan_web_app' })
        });
        const data = await res.json().catch(() => ({}));

        if (res.ok && data.success) {
          bannerTitle.innerText = '✅ DOOR UNLOCKED — DEVICE ACKNOWLEDGED';
          bannerDesc.innerText = data.message || 'EasyBio acknowledged the relay command.';
          const durationSeconds = Number(data.durationSeconds) || 15;
          
          let secondsLeft = durationSeconds;
          if (countdownInterval) clearInterval(countdownInterval);

          countdownInterval = setInterval(() => {
            secondsLeft -= 1;
            timerText.innerText = secondsLeft + 's Left';
            const pct = (secondsLeft / durationSeconds) * 100;
            progressBar.style.width = pct + '%';

            if (secondsLeft <= 0) {
              clearInterval(countdownInterval);
              bannerTitle.innerText = '🔒 GATE RELAY LOCKED';
              bannerDesc.innerText = durationSeconds + ' seconds elapsed. Device relay pulse finished.';
              timerText.innerText = 'Locked';
              lockIcon.innerText = '🔒';
              progressBar.style.width = '0%';
            }
          }, 1000);

        } else {
          bannerTitle.innerText = '⚠️ GATE FAILED — ' + (data.status || 'RELAY COMMAND FAILED');
          bannerDesc.innerText = data.message || 'The device service did not confirm the relay command.';
        }
      } catch (err) {
        bannerTitle.innerText = '❌ CONNECTION ERROR';
        bannerDesc.innerText = err && err.message ? err.message : 'Unable to reach the local device service.';
      } finally {
        setTimeout(() => {
          btn.disabled = false;
          btn.style.opacity = '1';
        }, 1000);
      }
    }

    // Initial load
    refreshDeviceStatus();
    fetchRoster();
    if (requestedBioId) {
      switchTab('client');
      document.getElementById('searchClient').value = requestedBioId;
      setFilter('client', 'all');
      renderRoster();
    }
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
};

app.get('/gate-control', renderGateHtml);
app.get('/gate', renderGateHtml);
app.get('/', renderGateHtml);

if (process.env.VERCEL) {
  // In Vercel serverless environment, just export the app
  module.exports = app;
} else {
  // Boot the server locally bound to 0.0.0.0 for GYM LAN availability
  const numPort = Number(PORT) || 5000;
  app.listen(numPort, '0.0.0.0', async () => {
    const lanIp = getLocalIpAddress();
    const deviceIp = process.env.EASYBIO_DEVICE_IP || '192.168.18.11';
    console.log(`===================================================`);
    console.log(`  THE WARRIOR GYM — GATE CONTROL & BACKEND SERVER`);
    console.log(`===================================================`);
    console.log(`  Status       : ONLINE`);
    console.log(`  Local URL    : http://127.0.0.1:${numPort}/api`);
    console.log(`  LAN URL      : http://${lanIp}:${numPort}/api`);
    console.log(`  Gate Control : http://${lanIp}:${numPort}/gate-control`);
    console.log(`  EasyBio Device: ${deviceIp}`);
    console.log(`===================================================`);

    try {
      await provisionAdminAccounts();
    } catch (err) {
      console.error('Failed to provision admin accounts on boot:', err);
    }

    try {
      initDeviceSyncService();
    } catch (err) {
      console.error('Failed to initialize Device Sync service on boot:', err);
    }

    // Start the automated Firebase Spark Plan cleanup cron job
    startCleanupJob();

    // Start the LIVE MEMBERS INSIDE ENGINE cron job
    startPresenceJob();

    // Start the WhatsApp Queue worker
    initQueueJob();

    // Start the Automated Follow-Up Generation Engine
    startFollowupAutomationJob();

    // ⛔ Auto email scheduler DISABLED — emails send only via manual dashboard trigger
    // To re-enable: uncomment the block below
    // try {
    //   const { runDailyAutomationChecks } = require('./services/automation.service');
    //   setTimeout(() => {
    //     runDailyAutomationChecks().catch((err: any) => console.error('Error running daily automation checks:', err));
    //   }, 10000);
    //   setInterval(() => {
    //     runDailyAutomationChecks().catch((err: any) => console.error('Error running daily automation checks:', err));
    //   }, 12 * 60 * 60 * 1000);
    // } catch (err) {
    //   console.error('Failed to initialize daily automation scheduler:', err);
    // }
  });
}
