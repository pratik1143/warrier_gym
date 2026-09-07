import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

// Preloaded Mock Data sets for fallback mode
export let mockBranches = [
  { id: 'b1', name: 'The Warrior Gym - Mohali', city: 'Mohali', members: 0, revenue: 0, attendance: 0, status: 'active', manager: 'Karan Verma', capacity: 500 },
];

const pendingInvoicesMap = new Map<string, Promise<any>>();

export let mockMembers: any[] = [];
export let mockTrainers: any[] = [];

export let mockAttendance: any[] = [];
export let mockPayments: any[] = [];
export let mockWorkouts: any[] = [];
export let mockDietPlans: any[] = [];
export let mockCheatMealRequests: any[] = [];
export let mockDailyDietLogs: any[] = [];
export let mockProgressLogs: any[] = [];
export let mockChatMessages: any[] = [];
export let mockReferrals: any[] = [];
export let mockMigrations: any[] = [];
export let mockFollowups: any[] = [];
export let mockAccessControlDevices: any[] = [];
export let mockAccessControlEvents: any[] = [];
export let mockDeviceSyncLogs: any[] = [];

export let mockPlans: any[] = [
  {
    id: 'pkg_15d',
    name: '15 days',
    price: 2000,
    duration: '15 days',
    durationDays: 15,
    rewardPoints: 0,
    status: 'Active',
    type: 'Regular',
    badge: null,
    icon: 'Shield',
    accent: '#3b82f6',
    accentBg: 'rgba(59,130,246,0.08)',
    border: '2px solid rgba(59,130,246,0.2)',
    features: ['15-Day Full Gym Access', 'Biometric Roster Access', 'Locker Room Facilities'],
  },
  {
    id: 'pkg_1d',
    name: '1 day',
    price: 500,
    duration: '1 day',
    durationDays: 1,
    rewardPoints: 0,
    status: 'Active',
    type: 'Regular',
    badge: null,
    icon: 'Shield',
    accent: '#64748b',
    accentBg: 'rgba(100,116,139,0.08)',
    border: '2px solid rgba(100,116,139,0.2)',
    features: ['Day Pass Access', 'Single Day Facility Check-in', 'Locker Access'],
  },
  {
    id: 'pkg_1m_pt',
    name: '1 month PT',
    price: 12000,
    duration: '30 days',
    durationDays: 30,
    rewardPoints: 0,
    status: 'Active',
    type: 'PT',
    badge: 'Personal Training',
    icon: 'Crown',
    accent: '#f59e0b',
    accentBg: 'rgba(245,158,11,0.08)',
    border: '2px solid rgba(245,158,11,0.3)',
    features: ['1 Month Personal Trainer', '1-on-1 Customized Training', 'Nutrition & Diet Plan'],
  },
  {
    id: 'pkg_10d',
    name: '10 days',
    price: 2000,
    duration: '10 days',
    durationDays: 10,
    rewardPoints: 0,
    status: 'Active',
    type: 'Regular',
    badge: null,
    icon: 'Shield',
    accent: '#06b6d4',
    accentBg: 'rgba(6,182,212,0.08)',
    border: '2px solid rgba(6,182,212,0.2)',
    features: ['10-Day Short Term Pass', 'Biometric Access', 'Standard Gym Floor Access'],
  },
  {
    id: 'pkg_3m_std',
    name: '3 months',
    price: 7000,
    duration: '90 days',
    durationDays: 90,
    rewardPoints: 0,
    status: 'Active',
    type: 'Regular',
    badge: 'Popular',
    icon: 'Zap',
    accent: '#8b5cf6',
    accentBg: 'rgba(139,92,246,0.08)',
    border: '2px solid rgba(139,92,246,0.2)',
    features: ['90-Day Full Gym Access', 'Steam Bath Consultation', 'Regular Fitness Assessment'],
  },
  {
    id: 'pkg_6_plus_2m',
    name: '6+2 months',
    price: 10000,
    duration: '240 days',
    durationDays: 240,
    rewardPoints: 0,
    status: 'Active',
    type: 'Regular',
    badge: 'Special Offer',
    icon: 'Star',
    accent: '#ec4899',
    accentBg: 'rgba(236,72,153,0.08)',
    border: '2px solid rgba(236,72,153,0.2)',
    features: ['6 Months + 2 Bonus Months', 'Total 8 Months Access', 'Free Diet & Fitness Evaluation'],
  },
  {
    id: 'pkg_6_plus_1m',
    name: '6+1 months',
    price: 9000,
    duration: '210 days',
    durationDays: 210,
    rewardPoints: 0,
    status: 'Active',
    type: 'Regular',
    badge: null,
    icon: 'Star',
    accent: '#10b981',
    accentBg: 'rgba(16,185,129,0.08)',
    border: '2px solid rgba(16,185,129,0.2)',
    features: ['6 Months + 1 Bonus Month', 'Total 7 Months Access', 'Complete Facility Access'],
  },
  {
    id: 'pkg_3_plus_1m',
    name: '3+1 months',
    price: 7500,
    duration: '120 days',
    durationDays: 120,
    rewardPoints: 0,
    status: 'Active',
    type: 'Regular',
    badge: 'Value Pack',
    icon: 'Zap',
    accent: '#6366f1',
    accentBg: 'rgba(99,102,241,0.08)',
    border: '2px solid rgba(99,102,241,0.2)',
    features: ['3 Months + 1 Bonus Month', 'Total 4 Months Access', 'Full Gym Equipment Access'],
  },
  {
    id: 'pkg_3_plus_2m',
    name: '3+2 months',
    price: 8000,
    duration: '150 days',
    durationDays: 150,
    rewardPoints: 0,
    status: 'Active',
    type: 'Regular',
    badge: 'Popular Deal',
    icon: 'Zap',
    accent: '#14b8a6',
    accentBg: 'rgba(20,184,166,0.08)',
    border: '2px solid rgba(20,184,166,0.2)',
    features: ['3 Months + 2 Bonus Months', 'Total 5 Months Access', 'Locker & Biometric Roster'],
  },
  {
    id: 'pkg_1m_std',
    name: '1 month',
    price: 3000,
    duration: '30 days',
    durationDays: 30,
    rewardPoints: 0,
    status: 'Active',
    type: 'Regular',
    badge: null,
    icon: 'Shield',
    accent: '#3b82f6',
    accentBg: 'rgba(59,130,246,0.08)',
    border: '2px solid rgba(59,130,246,0.2)',
    features: ['Monthly Gym Membership', 'Biometric Check-in Roster', 'Cardio & Strength Area'],
  },
  {
    id: 'pkg_2m',
    name: '2 months',
    price: 4500,
    duration: '60 days',
    durationDays: 60,
    rewardPoints: 0,
    status: 'Active',
    type: 'Regular',
    badge: null,
    icon: 'Shield',
    accent: '#0284c7',
    accentBg: 'rgba(2,132,199,0.08)',
    border: '2px solid rgba(2,132,199,0.2)',
    features: ['60 Days Gym Access', 'General Trainer Guidance', 'Locker Room Access'],
  },
  {
    id: 'pkg_12m',
    name: '12 months',
    price: 15000,
    duration: '365 days',
    durationDays: 365,
    rewardPoints: 0,
    status: 'Active',
    type: 'Regular',
    badge: '🏆 Annual VIP',
    icon: 'Crown',
    accent: '#f59e0b',
    accentBg: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 50%, #fef9ec 100%)',
    border: '2px solid rgba(245,158,11,0.35)',
    features: ['Full Year Unlimited Access', 'Free Guest Passes (5/month)', 'Personal Locker & Steam Bath'],
  },
  {
    id: 'pkg_6m',
    name: '6 months',
    price: 9000,
    duration: '180 days',
    durationDays: 180,
    rewardPoints: 0,
    status: 'Active',
    type: 'Regular',
    badge: 'Best Value',
    icon: 'Star',
    accent: '#10b981',
    accentBg: 'rgba(16,185,129,0.08)',
    border: '2px solid rgba(16,185,129,0.2)',
    features: ['180 Days Gym Membership', 'Body Fat Analysis & Diet Plan', 'Steam Bath Access'],
  },
  {
    id: 'pkg_3m_inactive',
    name: '3 months',
    price: 6500,
    duration: '90 days',
    durationDays: 90,
    rewardPoints: 0,
    status: 'Inactive',
    type: 'Regular',
    badge: 'Archived',
    icon: 'Zap',
    accent: '#94a3b8',
    accentBg: 'rgba(148,163,184,0.08)',
    border: '2px solid rgba(148,163,184,0.2)',
    features: ['Legacy 3 Months Tier', 'Archived / Inactive Package'],
  }
];

export let mockDevices: any[] = [
  { id: 'dev1', deviceId: 'k90-main-gate', deviceName: 'Main Gate K90 Pro', deviceType: 'ESSL K90 Pro', ip: '192.168.1.100', port: 4370, branch: 'The Warrior Gym Main Branch', enabled: true, lastSync: new Date().toISOString(), status: 'connected', connectionHealth: 100 },
  { id: 'dev2', deviceId: 'zk-cardio-gate', deviceName: 'Cardio Section ZK', deviceType: 'ZKTeco', ip: '192.168.1.101', port: 4370, branch: 'The Warrior Gym Main Branch', enabled: true, lastSync: new Date().toISOString(), status: 'connected', connectionHealth: 95 },
  { id: 'dev3', deviceId: 'eb-vip-lounge', deviceName: 'VIP Lounge EasyBio', deviceType: 'EasyBio', ip: '192.168.1.102', port: 5000, branch: 'The Warrior Gym Main Branch', enabled: false, lastSync: null, status: 'offline', connectionHealth: 0 }
];
export let mockDeviceLogs: any[] = [];
export let mockAccessLogs: any[] = [];
export let mockDoorStatus: any[] = [
  { id: 'dev_k90_main', doorId: 'dev_k90_main', doorName: 'Main Entrance Gate', status: 'locked', lastOpen: new Date().toISOString(), lastUser: 'Arjun Mehta', lastEvent: 'Access Granted' }
];
export let mockEnquiries: any[] = [];

import initialMockDb from './mockDb.json';

const MOCK_DB_FILE = path.join(__dirname, 'mockDb.json');

export const saveMockDb = () => {
  try {
    fs.writeFileSync(MOCK_DB_FILE, JSON.stringify({
      mockMembers,
      mockAttendance,
      mockPayments,
      mockTrainers,
      mockBranches,
      mockWorkouts,
      mockDietPlans,
      mockCheatMealRequests,
      mockDailyDietLogs,
      mockProgressLogs,
      mockChatMessages,
      mockReferrals,
      mockMigrations,
      mockPlans,
      mockDevices,
      mockDeviceLogs,
      mockAccessLogs,
      mockDoorStatus,
      mockEnquiries
    }, null, 2));
  } catch (e) {
    console.error('Failed to write mock database:', e);
  }
};

export const loadMockDb = () => {
  try {
    const seedData: any = initialMockDb || {};
    let data = seedData;
    if (fs.existsSync(MOCK_DB_FILE)) {
      try {
        data = JSON.parse(fs.readFileSync(MOCK_DB_FILE, 'utf8'));
      } catch (readErr) {
        console.warn('Could not parse filesystem mockDb.json, using bundled seed:', readErr);
        data = seedData;
      }
    }
    if (data.mockMembers && data.mockMembers.length > 0) { mockMembers.length = 0; mockMembers.push(...data.mockMembers); }
    if (data.mockAttendance) { mockAttendance.length = 0; mockAttendance.push(...data.mockAttendance); }
      if (data.mockPayments) {
        mockPayments.length = 0;
        data.mockPayments.forEach((p: any) => {
          const isHist = p.isHistorical === true || p.imported === true || p.isLegacyImport === true ||
            String(p.invoiceNumber || p.invoice || '').startsWith('INV-LEG-') ||
            String(p.id || '').startsWith('inv_member_') ||
            String(p.id || '').startsWith('p') ||
            p.method === 'Imported' || p.paymentMethod === 'Imported' ||
            p.transactionType === 'historical_import';
          if (isHist) {
            mockPayments.push({
              ...p,
              transactionType: 'historical_import',
              isHistorical: true,
              imported: true,
              isLegacyImport: true,
              paymentDate: p.paymentDate || p.date || p.billingDate || p.startDate || '2026-01-01'
            });
          } else {
            mockPayments.push(p);
          }
        });
      }
      if (data.mockTrainers) { mockTrainers.length = 0; mockTrainers.push(...data.mockTrainers); }
      if (data.mockBranches) { mockBranches.length = 0; mockBranches.push(...data.mockBranches); }
      if (data.mockWorkouts) { mockWorkouts.length = 0; mockWorkouts.push(...data.mockWorkouts); }
      if (data.mockDietPlans) { mockDietPlans.length = 0; mockDietPlans.push(...data.mockDietPlans); }
      if (data.mockCheatMealRequests) { mockCheatMealRequests.length = 0; mockCheatMealRequests.push(...data.mockCheatMealRequests); }
      if (data.mockDailyDietLogs) { mockDailyDietLogs.length = 0; mockDailyDietLogs.push(...data.mockDailyDietLogs); }
      if (data.mockProgressLogs) { mockProgressLogs.length = 0; mockProgressLogs.push(...data.mockProgressLogs); }
      if (data.mockChatMessages) { mockChatMessages.length = 0; mockChatMessages.push(...data.mockChatMessages); }
      if (data.mockReferrals) { mockReferrals.length = 0; mockReferrals.push(...data.mockReferrals); }
      if (data.mockMigrations) { mockMigrations.length = 0; mockMigrations.push(...data.mockMigrations); }
      if (data.mockPlans) { mockPlans.length = 0; mockPlans.push(...data.mockPlans); }
      if (data.mockDevices) { mockDevices.length = 0; mockDevices.push(...data.mockDevices); }
      if (data.mockDeviceLogs) { mockDeviceLogs.length = 0; mockDeviceLogs.push(...data.mockDeviceLogs); }
      if (data.mockAccessLogs) { mockAccessLogs.length = 0; mockAccessLogs.push(...data.mockAccessLogs); }
      if (data.mockDoorStatus) { mockDoorStatus.length = 0; mockDoorStatus.push(...data.mockDoorStatus); }
      if (data.mockEnquiries) { mockEnquiries.length = 0; mockEnquiries.push(...data.mockEnquiries); }
      console.log(`[Offline Mock DB] Loaded ${mockMembers.length} members and ${mockEnquiries.length} enquiries from mockDb.json`);
    } catch (e) {
    console.error('Failed to load mock database:', e);
  }
};

loadMockDb();

// Real Firebase Init
const serviceAccountJsonRaw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
let serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

// Fallback to relative path if absolute path is not specified or doesn't exist
const relativeFallbackPath = path.join(__dirname, '..', '..', 'serviceAccountKey.json');
if (!serviceAccountPath || !fs.existsSync(serviceAccountPath)) {
  if (fs.existsSync(relativeFallbackPath)) {
    serviceAccountPath = relativeFallbackPath;
  }
}

const storageBucket = process.env.FIREBASE_STORAGE_BUCKET || 'thewarriergym.firebasestorage.app';
let isFirebaseInitialized = false;

if (serviceAccountJsonRaw) {
  try {
    const serviceAccount = JSON.parse(serviceAccountJsonRaw);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: storageBucket
    });
    isFirebaseInitialized = true;
    console.log('Firebase Admin SDK initialized successfully from JSON environment variable.');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin from JSON environment variable:', error);
  }
} else if (serviceAccountPath && fs.existsSync(serviceAccountPath)) {
  try {
    const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: storageBucket
    });
    isFirebaseInitialized = true;
    console.log('Firebase Admin SDK initialized successfully from file path:', serviceAccountPath);
    
    // Proactively verify Cloud Firestore API availability
    admin.firestore().collection('settings').doc('connection_health_check').get()
      .then(() => {
        console.log('✅ Cloud Firestore API connection verified.');
        classifyHistoricalPayments().catch(e => console.error('Classification error:', e));
      })
      .catch((err: any) => {
        console.warn('⚠️ Cloud Firestore health check warning:', err.message);
      });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin SDK from file path:', error);
  }
} else {
  console.log('No Firebase config file or JSON found. Using memory-backed Mock Database.');
}

let firestoreApiDisabled = false;

export const disableFirestore = () => {
  firestoreApiDisabled = false;
};

export const getFirestoreDb = () => {
  if (!isFirebaseInitialized) return null;
  return admin.firestore();
};

export const classifyHistoricalPayments = async () => {
  try {
    // 1. Sanitize Mock DB payments
    let mockUpdated = false;
    mockPayments.forEach((p: any) => {
      const isHistorical = p.isHistorical === true || p.imported === true || p.isLegacyImport === true ||
        String(p.invoiceNumber || p.invoice || '').startsWith('INV-LEG-') ||
        String(p.id || '').startsWith('inv_member_') ||
        String(p.id || '').startsWith('p') ||
        p.method === 'Imported' || p.paymentMethod === 'Imported' ||
        p.transactionType === 'historical_import';

      if (isHistorical) {
        if (p.transactionType !== 'historical_import' || !p.isHistorical || !p.imported) {
          p.transactionType = 'historical_import';
          p.isHistorical = true;
          p.imported = true;
          p.isLegacyImport = true;
          p.paymentDate = p.paymentDate || p.date || p.billingDate || p.startDate || '2026-01-01';
          mockUpdated = true;
        }
      }
    });
    if (mockUpdated) saveMockDb();

    // 2. Sanitize Firestore payments
    const firestore = getFirestoreDb();
    if (firestore) {
      const snap = await firestore.collection('payments').get();
      let updatedCount = 0;
      const chunkSize = 100;
      for (let i = 0; i < snap.docs.length; i += chunkSize) {
        const batch = firestore.batch();
        let batchHasUpdates = false;
        const chunk = snap.docs.slice(i, i + chunkSize);

        chunk.forEach((doc: any) => {
          const p = doc.data();
          const isHistorical = p.isHistorical === true || p.imported === true || p.isLegacyImport === true ||
            String(p.invoiceNumber || p.invoice || '').startsWith('INV-LEG-') ||
            String(doc.id).startsWith('inv_member_') ||
            p.method === 'Imported' || p.paymentMethod === 'Imported' ||
            p.transactionType === 'historical_import';

          if (isHistorical) {
            if (p.transactionType !== 'historical_import' || !p.isHistorical || !p.imported) {
              batch.update(doc.ref, {
                transactionType: 'historical_import',
                isHistorical: true,
                imported: true,
                isLegacyImport: true,
                paymentDate: p.paymentDate || p.date || p.billingDate || p.startDate || '2026-01-01',
                isRealTimeToday: false
              });
              batchHasUpdates = true;
              updatedCount++;
            }
          }
        });

        if (batchHasUpdates) {
          await batch.commit();
        }
      }

      if (updatedCount > 0) {
        console.log(`[Historical Payment Classifier] Correctly tagged ${updatedCount} Firestore payments as 'historical_import'.`);
      }
    }
  } catch (err) {
    console.error('[Historical Payment Classifier Error]', err);
  }
};

let membersCache: any[] | null = null;

// Database helper functions (asynchronous to support Firestore)
export const db = {
  classifyHistoricalPayments: async () => {
    await classifyHistoricalPayments();
  },
  saveMockDb: () => {
    saveMockDb();
  },
  invalidateMembersCache: () => {
    membersCache = null;
  },

  getMembers: async (): Promise<any[]> => {
    // Single-source-of-truth from Firestore
    const firestore = getFirestoreDb();
    if (firestore) {
      try {
        const membersSnap = await firestore.collection('members').get();
        const rawMembers = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        // Strict: Filter out soft-deleted members
        const activeMembers = rawMembers.filter((m: any) => {
          if (m.isDeleted === true || m.deletedAt) return false;
          return true;
        });

        const seenKeys = new Set<string>();
        const deduplicatedList = activeMembers.filter((m: any) => {
          const key = m.clientId
            ? `cid_${String(m.clientId).trim()}`
            : (m.memberId && m.memberId !== 'TWG-2026-0000')
              ? `mid_${String(m.memberId).trim()}`
              : (m.id ? `id_${String(m.id).trim()}` : (m.phone ? `phone_${m.phone.replace(/\D/g, '')}` : `rnd_${Math.random()}`));
          if (seenKeys.has(key)) return false;
          seenKeys.add(key);
          return true;
        });

        membersCache = deduplicatedList;
        return membersCache;
      } catch (error: any) {
        console.warn('[Firestore] Error fetching members, falling back to local database:', error?.message);
        if (error?.message?.includes('PERMISSION_DENIED') || error?.message?.includes('disabled')) {
          disableFirestore();
        }
        const seenMockKeys = new Set<string>();
        return mockMembers.filter((m: any) => {
          const key = m.clientId
            ? `cid_${String(m.clientId).trim()}`
            : (m.memberId && m.memberId !== 'TWG-2026-0000')
              ? `mid_${String(m.memberId).trim()}`
              : (m.id ? `id_${String(m.id).trim()}` : (m.phone ? `phone_${m.phone.replace(/\D/g, '')}` : `rnd_${Math.random()}`));
          if (seenMockKeys.has(key)) return false;
          seenMockKeys.add(key);
          return true;
        });
      }
    }
    const seenMockKeys = new Set<string>();
    return mockMembers.filter((m: any) => {
      const key = m.clientId
        ? `cid_${String(m.clientId).trim()}`
        : (m.memberId && m.memberId !== 'TWG-2026-0000')
          ? `mid_${String(m.memberId).trim()}`
          : (m.id ? `id_${String(m.id).trim()}` : (m.phone ? `phone_${m.phone.replace(/\D/g, '')}` : `rnd_${Math.random()}`));
      if (seenMockKeys.has(key)) return false;
      seenMockKeys.add(key);
      return true;
    });
  },

  getMemberById: async (id: string): Promise<any | null> => {
    if (!id) return null;
    const firestore = getFirestoreDb();
    if (firestore) {
      try {
        // Direct doc lookup by document ID (O(1) read)
        const docRef = firestore.collection('members').doc(id);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          return { id: docSnap.id, ...docSnap.data() };
        }

        // Secondary lookup by memberId
        const midSnap = await firestore.collection('members').where('memberId', '==', id).limit(1).get();
        if (!midSnap.empty) {
          const doc = midSnap.docs[0];
          return { id: doc.id, ...doc.data() };
        }

        // Secondary lookup by uid
        const uidSnap = await firestore.collection('members').where('uid', '==', id).limit(1).get();
        if (!uidSnap.empty) {
          const doc = uidSnap.docs[0];
          return { id: doc.id, ...doc.data() };
        }
      } catch (err: any) {
        console.warn(`[Firestore] getMemberById error for ${id}:`, err?.message);
      }
    }
    const found = mockMembers.find(m => m.id === id || m.uid === id || m.memberId === id);
    return found || null;
  },

  getMembersPaginated: async (params: { page?: number; limit?: number; search?: string; status?: string }): Promise<{ members: any[]; total: number; page: number; limit: number; totalPages: number }> => {
    const page = Math.max(1, Number(params.page) || 1);
    const limit = Math.max(1, Math.min(200, Number(params.limit) || 50));
    const search = (params.search || '').trim().toLowerCase();
    const status = (params.status || 'all').trim().toLowerCase();

    // Use full getMembers list (with its self-healing and deduplication) for correctness
    const allMembers = await db.getMembers();

    let filtered = allMembers;

    if (status && status !== 'all') {
      filtered = filtered.filter(m => {
        const mStatus = (m.status || '').toLowerCase();
        if (status === 'hold') return mStatus === 'hold';
        if (status === 'inactive') return mStatus === 'inactive' || mStatus === 'blocked' || mStatus === 'blacklisted';
        if (status === 'active') return (mStatus === 'active' || mStatus === 'expiring soon' || mStatus === 'expiring') && mStatus !== 'hold';
        if (status === 'expired') return mStatus === 'expired' && mStatus !== 'hold';
        if (status === 'frozen') return mStatus === 'frozen';
        if (status === 'pt') return !!m.trainer && mStatus !== 'hold';
        return mStatus === status;
      });
    }

    if (search) {
      const digitsOnly = search.replace(/\D/g, '');
      filtered = filtered.filter(m => {
        const nameMatch = (m.name || '').toLowerCase().includes(search);
        const bioStr = String(m.biometricId || m.biometricUserId || m.deviceUserId || '').toLowerCase();
        const idMatch = (m.memberId || '').toLowerCase().includes(search) || 
          (m.id || '').toLowerCase().includes(search) || 
          bioStr.includes(search) ||
          bioStr === search;
        const phoneMatch = digitsOnly.length >= 3 && (m.phone || '').replace(/\D/g, '').includes(digitsOnly);
        const emailMatch = (m.email || '').toLowerCase().includes(search);
        return nameMatch || idMatch || phoneMatch || emailMatch;
      });
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const offset = (page - 1) * limit;
    const paginatedMembers = filtered.slice(offset, offset + limit);

    return {
      members: paginatedMembers,
      total,
      page,
      limit,
      totalPages
    };
  },

  addMember: async (member: any): Promise<any> => {
    const firestore = getFirestoreDb();
    
    // Auto-generate sequential Member ID (TWG-2026-XXXX)
    const currentYear = new Date().getFullYear();
    const prefix = `TWG-${currentYear}-`;
    let nextNum = 1;
    
    // Since we want accurate IDs, query Firestore or mockMembers
    const azIds: string[] = [];
    if (firestore) {
      const snap = await firestore.collection('members').get();
      snap.docs.forEach(d => {
        const id = d.data().memberId;
        if (id && id.startsWith(prefix)) azIds.push(id);
      });
    } else {
      mockMembers.forEach(m => {
        const id = m.memberId;
        if (id && id.startsWith(prefix)) azIds.push(id);
      });
    }

    if (azIds.length > 0) {
      const nums = azIds.map(id => {
        const parts = id.split('-');
        return parseInt(parts[2], 10) || 0;
      });
      nextNum = Math.max(...nums) + 1;
    }
    
    const memberId = `${prefix}${String(nextNum).padStart(4, '0')}`;

    const newMember = {
      ...member,
      memberId,
      startDate: member.startDate || member.joinDate || new Date().toISOString().split('T')[0],
      daysLeft: Number(member.daysLeft) || 30,
      attendanceCount: Number(member.attendanceCount) || 0,
      avatar: member.avatar || '',
      streak: Number(member.streak) || 1,
      goalWeight: member.weight ? member.weight - 5 : 70,
      attendancePercent: Number(member.attendancePercent) || 100,
      referralCode: member.name.substring(0, 4).toUpperCase() + Math.floor(100 + Math.random() * 900)
    };

    if (firestore) {
      const docId = member.uid || firestore.collection('members').doc().id;
      await firestore.collection('members').doc(docId).set(newMember);
      const added = { id: docId, ...newMember };
      if (membersCache) {
        membersCache.push(added);
      } else {
        membersCache = null; // force fetch next time
      }
      return added;
    }

    const docId = member.uid || ('m' + (mockMembers.length + 1));
    const finalMember = { id: docId, ...newMember };
    mockMembers.push(finalMember);
    return finalMember;
  },

  updateMember: async (id: string, updates: any): Promise<any> => {
    const firestore = getFirestoreDb();
    
    // Automatically recalculate expiryDate if plan is updated
    if (updates.plan && !updates.expiryDate) {
      let days = 30; // default 1 MONTH
      const p = updates.plan.toUpperCase();
      if (p.includes('SEMI-ANNUAL') || p.includes('SEMI ANNUAL') || p.includes('6 MONTH')) {
        days = 180;
      } else if (p.includes('ANNUAL') || p.includes('YEAR')) {
        days = 365;
      } else if (p.includes('3 MONTH') || p.includes('2+1') || p.includes('QUARTERLY')) {
        days = 90;
      }
      
      updates.expiryDate = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    if (firestore) {
      await firestore.collection('members').doc(id).update(updates);
      const doc = await firestore.collection('members').doc(id).get();
      const updated = { id: doc.id, ...doc.data() };
      if (membersCache) {
        membersCache = membersCache.map(m => m.id === id ? updated : m);
      }
      return updated;
    }

    const idx = mockMembers.findIndex(m => m.id === id);
    if (idx !== -1) {
      mockMembers[idx] = { ...mockMembers[idx], ...updates };
      return mockMembers[idx];
    }
    return null;
  },

  deleteMember: async (id: string): Promise<boolean> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const now = new Date().toISOString();

      // 1. Delete from members collection
      try {
        await firestore.collection('members').doc(id).delete().catch(() => {});
        const mDoc = await firestore.collection('members').where('memberId', '==', id).get();
        mDoc.forEach(d => d.ref.delete().catch(() => {}));
      } catch (err) {
        console.warn(`[Firestore] deleteMember doc error for ${id}:`, err);
      }

      // 2. Remove matching user records in 'users' collection to prevent auto-provision resurrection
      try {
        await firestore.collection('users').doc(id).delete().catch(() => {});
        const userDocs = await firestore.collection('users').where('uid', '==', id).get();
        userDocs.forEach(d => d.ref.delete().catch(() => {}));
        const userByMid = await firestore.collection('users').where('memberId', '==', id).get();
        userByMid.forEach(d => d.ref.delete().catch(() => {}));
      } catch (err) {
        console.warn(`[Firestore] deleteMember users purge error for ${id}:`, err);
      }

      if (membersCache) {
        membersCache = membersCache.filter(m => m.id !== id && m.memberId !== id);
      }
      return true;
    }

    mockMembers = mockMembers.filter(m => m.id !== id && m.memberId !== id);
    return true;
  },

  getAttendance: async (): Promise<any[]> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      // Use attendance_logs and limit to 150 to avoid massive reads
      const snapshot = await firestore.collection('attendance_logs').orderBy('checkIn', 'desc').limit(150).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return mockAttendance;
  },

  getAttendanceSummary: async (memberId: string): Promise<any> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const doc = await firestore.collection('attendance_summary').doc(memberId).get();
      if (doc.exists) return { id: doc.id, ...doc.data() };
      return null;
    }
    return null;
  },

  getDashboardAnalytics: async (): Promise<any> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const todayStr = new Date().toISOString().split('T')[0];

      // 1. Members
      const membersSnap = await firestore.collection('members').get();
      const membersList = membersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const totalMembers = membersList.length;
      const activeMembers = membersList.filter((m: any) => {
        const startDate = m.startDate || m.joinDate;
        if (startDate && startDate > todayStr) return false;
        if (m.status === 'frozen' || m.status === 'Frozen' || m.status === 'blocked' || m.status === 'Blocked') return false;
        return m.status === 'active' || m.status === 'Active' || (m.expiryDate && m.expiryDate >= todayStr);
      }).length;

      // 2. Today's Deduplicated Revenue (Strict Isolation: Only non-historical payments belonging strictly to TODAY)
      const paymentsSnap = await firestore.collection('payments').get();
      const seen = new Set<string>();
      let todayRevenue = 0;

      paymentsSnap.docs.forEach((doc: any) => {
        const p = doc.data() as any;
        if (!p || p.isSample || p.isMock) return;

        // Strictly exclude historical imports from today's collection
        const isHistorical = p.isHistorical === true || p.imported === true || p.isLegacyImport === true || p.transactionType === 'historical_import';
        if (isHistorical) return;

        const status = String(p.status || p.paymentStatus || 'paid').toLowerCase();
        if (status !== 'paid' && status !== 'partial') return;

        // Payment date must match today (NEVER fall back to createdAt!)
        const pDate = String(p.paymentDate || p.date || '').split('T')[0];
        if (pDate !== todayStr && !p.isRealTimeToday) return;

        const idKey = String(doc.id || p.paymentId || p.invoiceNumber || p.invoice || p.idempotencyKey || '').trim();
        if (idKey && seen.has(idKey)) return;
        if (idKey) seen.add(idKey);

        const val = Number(p.amountPaid !== undefined ? p.amountPaid : (p.paid !== undefined ? p.paid : (p.amount || 0)));
        todayRevenue += (isNaN(val) ? 0 : val);
      });

      // 3. Today's Unique Attendance
      const attendanceSnap = await firestore.collection('attendance_logs').get();
      const uniqueAttendance = new Set<string>();
      attendanceSnap.docs.forEach((doc: any) => {
        const a = doc.data() as any;
        if (!a) return;
        const checkInDate = String(a.checkIn || a.timestamp || a.createdAt || '').split('T')[0];
        if (checkInDate === todayStr) {
          const mKey = a.memberId || a.biometricId || a.deviceUserId || a.memberName;
          if (mKey && String(mKey).trim() && !String(mKey).includes('unmapped')) {
            uniqueAttendance.add(String(mKey).trim().toLowerCase());
          }
        }
      });

      return {
        totalMembers,
        activeMembers,
        todayAttendance: uniqueAttendance.size,
        revenue: todayRevenue,
        todayCollection: todayRevenue,
        lastUpdated: new Date().toISOString()
      };
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const seen = new Set<string>();
    let mockTodayRevenue = 0;
    mockPayments.forEach((p: any) => {
      if (!p || p.isSample || p.isMock) return;
      const isHistorical = p.isHistorical === true || p.imported === true || p.isLegacyImport === true || p.transactionType === 'historical_import';
      if (isHistorical) return;

      const status = String(p.status || p.paymentStatus || 'paid').toLowerCase();
      if (status !== 'paid' && status !== 'partial') return;

      const pDate = String(p.paymentDate || p.date || '').split('T')[0];
      if (pDate !== todayStr && !p.isRealTimeToday) return;

      const idKey = String(p.id || p.paymentId || p.invoiceNumber || p.invoice || p.idempotencyKey || '').trim();
      if (idKey && seen.has(idKey)) return;
      if (idKey) seen.add(idKey);

      const val = Number(p.amountPaid !== undefined ? p.amountPaid : (p.paid !== undefined ? p.paid : (p.amount || 0)));
      mockTodayRevenue += (isNaN(val) ? 0 : val);
    });

    return { totalMembers: mockMembers.length, todayAttendance: 0, activeMembers: mockMembers.filter(m => m.status === 'active').length, revenue: mockTodayRevenue, todayCollection: mockTodayRevenue };
  },

  addAttendance: async (log: any): Promise<any> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const presenceRef = firestore.collection('gym_presence').doc(log.memberId);
      const presenceDoc = await presenceRef.get();
      
      let isDuplicate = false;
      if (presenceDoc.exists) {
        const pData = presenceDoc.data();
        if (pData?.inside === true) {
           isDuplicate = true;
           // ONLY update lastPunch
           await presenceRef.update({
             lastPunch: log.checkIn || new Date().toISOString()
           });
        }
      }

      if (isDuplicate) {
         // Log the duplicate attempt so the frontend popup can notify the user
         const docRef = await firestore.collection('attendance_logs').add({
           ...log,
           status: 'duplicate',
           createdAt: new Date().toISOString()
         });

         await firestore.collection('punch_history').add({
           memberId: log.memberId,
           memberName: log.memberName || 'Unknown',
           deviceId: log.deviceId || 'unknown',
           branchId: log.branch || 'unknown',
           punchTime: log.checkIn || new Date().toISOString(),
           punchType: log.method || 'biometric',
           isDuplicatePunch: true,
           isInside: true,
           sessionId: presenceDoc.id
         });

         const analyticsRef = firestore.collection('analytics').doc('dashboard');
         await analyticsRef.set({
           todayTotalPunches: admin.firestore.FieldValue.increment(1),
           duplicatePunchesToday: admin.firestore.FieldValue.increment(1)
         }, { merge: true });

         return { id: docRef.id, status: 'duplicate', ...log };
      }

      // Not a duplicate: Add to presence
      const checkInTime = log.checkIn || new Date().toISOString();
      const expectedExit = new Date(new Date(checkInTime).getTime() + 60 * 60 * 1000).toISOString();
      await presenceRef.set({
        memberId: log.memberId,
        memberName: log.memberName || 'Unknown',
        inside: true,
        entryTime: checkInTime,
        expectedExit: expectedExit,
        lastPunch: checkInTime,
        branch: log.branch || 'Mohali, Punjab',
        trainer: log.trainer || null
      });

      // 1. Save temporary log in attendance_logs
      // Adding status: 'granted' to trigger frontend UI popups
      const docRef = await firestore.collection('attendance_logs').add({
        ...log,
        status: log.status || 'granted',
        createdAt: new Date().toISOString()
      });

      // Log to punch_history
      await firestore.collection('punch_history').add({
        memberId: log.memberId,
        memberName: log.memberName || 'Unknown',
        deviceId: log.deviceId || 'unknown',
        branchId: log.branch || 'unknown',
        punchTime: checkInTime,
        punchType: log.method || 'biometric',
        isDuplicatePunch: false,
        isInside: true,
        sessionId: presenceRef.id
      });
      
      // 2. Update attendance_summary
      const summaryRef = firestore.collection('attendance_summary').doc(log.memberId);
      const summaryDoc = await summaryRef.get();
      if (summaryDoc.exists) {
        await summaryRef.update({
          totalAttendance: admin.firestore.FieldValue.increment(1),
          monthlyAttendance: admin.firestore.FieldValue.increment(1),
          weeklyAttendance: admin.firestore.FieldValue.increment(1),
          todayAttendance: 'Present',
          lastAttendance: checkInTime.split('T')[0],
          lastPunchTime: checkInTime
        });
      } else {
        await summaryRef.set({
          totalAttendance: 1,
          monthlyAttendance: 1,
          weeklyAttendance: 1,
          todayAttendance: 'Present',
          attendanceStreak: 1,
          lastAttendance: checkInTime.split('T')[0],
          lastPunchTime: checkInTime
        });
      }

      // 3. Update dashboard analytics
      const analyticsRef = firestore.collection('analytics').doc('dashboard');
      await analyticsRef.set({
        todayAttendance: admin.firestore.FieldValue.increment(1),
        todayTotalPunches: admin.firestore.FieldValue.increment(1),
        todayUniqueMembers: admin.firestore.FieldValue.increment(1)
      }, { merge: true });

      // 4. Update member attendanceCount
      const memberRef = firestore.collection('members').doc(log.memberId);
      await memberRef.update({
        attendanceCount: admin.firestore.FieldValue.increment(1)
      }).catch(e => console.error('Failed to update member attendance count', e));

      return { id: docRef.id, ...log, status: 'granted' };
    }

    const newLog = {
      ...log,
      id: 'a' + (mockAttendance.length + 1)
    };
    mockAttendance.unshift(newLog);
    return newLog;
  },

  checkoutAttendance: async (id: string): Promise<any> => {
    const checkOutTime = new Date().toISOString();
    const firestore = getFirestoreDb();
    if (firestore) {
      await firestore.collection('attendance_logs').doc(id).update({ checkOut: checkOutTime });
      const doc = await firestore.collection('attendance_logs').doc(id).get();
      return { id: doc.id, ...doc.data() };
    }

    const log = mockAttendance.find(a => a.id === id);
    if (log) {
      log.checkOut = checkOutTime;
      return log;
    }
    return null;
  },

  autoCheckoutExpired: async (): Promise<void> => {
    const firestore = getFirestoreDb();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    if (firestore) {
      try {
        const snapshot = await firestore.collection('attendance_logs')
          .where('checkOut', '==', null)
          .get();

        for (const doc of snapshot.docs) {
          const data = doc.data();
          if (data.checkIn) {
            let checkInDate: Date;
            if (typeof data.checkIn === 'string') {
              checkInDate = new Date(data.checkIn);
            } else if (data.checkIn && typeof data.checkIn.toDate === 'function') {
              checkInDate = data.checkIn.toDate();
            } else if (data.checkIn && data.checkIn.seconds !== undefined) {
              checkInDate = new Date(data.checkIn.seconds * 1000);
            } else {
              checkInDate = new Date(data.checkIn);
            }

            // Fallback for invalid checkIn dates (e.g. malformed or [object Object] strings)
            if (isNaN(checkInDate.getTime())) {
              if (data.createdAt) {
                checkInDate = new Date(data.createdAt);
              } else {
                checkInDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // assume 2 hours ago
              }
            }

            if (!isNaN(checkInDate.getTime()) && checkInDate < oneHourAgo) {
              const checkOutTime = new Date(checkInDate.getTime() + 60 * 60 * 1000).toISOString();
              await firestore.collection('attendance_logs').doc(doc.id).update({
                checkOut: checkOutTime,
                autoCheckedOut: true
              });
              console.log(`[Auto-Checkout] Member ${data.memberName || 'Unknown'} (ID: ${data.memberId || 'N/A'}) checked out automatically.`);
            }
          }
        }
      } catch (err) {
        console.error('[Auto-Checkout] Firestore auto-checkout query failed:', err);
      }
    } else {
      const now = Date.now();
      mockAttendance.forEach(a => {
        if (a.checkIn && !a.checkOut) {
          const checkInTime = new Date(a.checkIn).getTime();
          if (!isNaN(checkInTime) && (now - checkInTime) > 60 * 60 * 1000) {
            a.checkOut = new Date(checkInTime + 60 * 60 * 1000).toISOString();
            a.autoCheckedOut = true;
            console.log(`[Auto-Checkout Mock] Member ${a.memberName || 'Unknown'} checked out automatically.`);
          }
        }
      });
    }
  },

  getPayments: async (options?: { memberId?: string; limit?: number }): Promise<any[]> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      let q: admin.firestore.Query = firestore.collection('payments');
      if (options?.memberId) {
        q = q.where('memberId', '==', options.memberId);
      }
      // If no memberId filter, order by date
      if (!options?.memberId) {
        q = q.orderBy('date', 'desc');
      }
      if (options?.limit && options.limit > 0) {
        q = q.limit(options.limit);
      }
      const snapshot = await q.get();
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return list.sort((a: any, b: any) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());
    }
    let list = mockPayments;
    if (options?.memberId) {
      list = list.filter(p => p.memberId === options.memberId || p.memberUid === options.memberId);
    }
    list = list.sort((a, b) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime());
    if (options?.limit && options.limit > 0) {
      list = list.slice(0, options.limit);
    }
    return list;
  },

  addPayment: async (payment: any): Promise<any> => {
    const todayStr = new Date().toISOString().split('T')[0];
    const origAmt = Number(payment.originalAmount !== undefined ? payment.originalAmount : (payment.price || payment.amount || 0));
    const discAmt = Number(payment.discountAmount !== undefined ? payment.discountAmount : (payment.discount || 0));
    const taxAmt = Number(payment.taxAmount !== undefined ? payment.taxAmount : (payment.gst || payment.tax || 0));
    const othAmt = Number(payment.otherCharges || 0);

    const calculatedNet = Math.max(0, origAmt - discAmt + taxAmt + othAmt);
    const netPayable = Number(payment.netPayable !== undefined ? payment.netPayable : (calculatedNet > 0 ? calculatedNet : (payment.amount || 0)));
    const amountPaid = Number(payment.amountPaid !== undefined ? payment.amountPaid : (payment.paid !== undefined ? payment.paid : netPayable));
    const outstanding = Math.max(0, netPayable - amountPaid);
    const status = payment.status || (outstanding <= 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'pending'));

    const idempotencyKey = payment.idempotencyKey || `pay_${payment.memberId}_${payment.plan}_${payment.date || todayStr}`;

    if (pendingInvoicesMap.has(idempotencyKey)) {
      console.log(`[Concurrent Lock Protection] Duplicate concurrent call locked for member ${payment.memberId}, awaiting original result...`);
      return await pendingInvoicesMap.get(idempotencyKey);
    }

    const isHistorical = payment.isHistorical ?? (payment.transactionType === 'historical_import' || payment.imported || payment.isLegacyImport || false);
    const txType = payment.transactionType || (isHistorical ? 'historical_import' : (payment.billingType === 'PT' || payment.invoiceType === 'PT' ? 'pt_payment' : 'membership_payment'));
    const paymentDate = payment.paymentDate || payment.date || todayStr;

    const processPayment = async () => {
      const newPayment = {
        ...payment,
        idempotencyKey,
        invoice: payment.invoiceNumber || payment.invoice || ('INV-' + Math.floor(100000 + Math.random() * 900000)),
        invoiceNumber: payment.invoiceNumber || payment.invoice || ('INV-' + Math.floor(100000 + Math.random() * 900000)),
        date: payment.date || todayStr,
        paymentDate: paymentDate,
        transactionType: txType,
        isHistorical: isHistorical,
        imported: Boolean(payment.imported || isHistorical),
        originalAmount: origAmt,
        discountAmount: discAmt,
        discount: discAmt,
        taxAmount: taxAmt,
        gst: taxAmt,
        otherCharges: othAmt,
        netPayable: netPayable,
        amount: netPayable,
        amountPaid: amountPaid,
        paid: amountPaid,
        outstandingAmount: outstanding,
        pendingAmount: outstanding,
        status: status,
        createdAt: payment.createdAt || new Date().toISOString()
      };

      const firestore = getFirestoreDb();
      if (firestore) {
        // Idempotency check: verify if an invoice with same idempotencyKey or matching memberId + plan + date exists
        const existingSnap = await firestore.collection('payments')
          .where('memberId', '==', payment.memberId)
          .where('date', '==', newPayment.date)
          .get();

        const duplicate = existingSnap.docs.find(doc => {
          const d = doc.data();
          if (d.idempotencyKey && d.idempotencyKey === idempotencyKey) return true;
          const planMatch = String(d.plan || '').toLowerCase() === String(payment.plan || '').toLowerCase();
          const timeDiff = Math.abs(new Date(d.createdAt || 0).getTime() - new Date(newPayment.createdAt).getTime());
          return planMatch && timeDiff < 300000; // created within 5 minutes
        });

        if (duplicate) {
          console.log(`[Idempotency Protection] Duplicate invoice blocked for member ${payment.memberId}, returning existing invoice ${duplicate.id}`);
          return { id: duplicate.id, ...duplicate.data() };
        }

        const docRef = await firestore.collection('payments').add(newPayment);
        return { id: docRef.id, ...newPayment };
      }

      // Mock Mode fallback
      const mockDuplicate = mockPayments.find(p => {
        if (p.idempotencyKey && p.idempotencyKey === idempotencyKey) return true;
        const sameMember = p.memberId === payment.memberId;
        const samePlan = String(p.plan || '').toLowerCase() === String(payment.plan || '').toLowerCase();
        const sameDate = p.date === newPayment.date;
        return sameMember && samePlan && sameDate;
      });

      if (mockDuplicate) {
        console.log(`[Mock Idempotency Protection] Duplicate invoice blocked, returning existing mock invoice ${mockDuplicate.invoice}`);
        return mockDuplicate;
      }

      const mockItem = { id: 'p_' + Date.now(), ...newPayment };
      mockPayments.unshift(mockItem);
      saveMockDb();
      return mockItem;
    };

    const promise = processPayment();
    pendingInvoicesMap.set(idempotencyKey, promise);
    try {
      return await promise;
    } finally {
      pendingInvoicesMap.delete(idempotencyKey);
    }
  },

  updatePayment: async (paymentId: string, updates: any): Promise<any> => {
    const firestore = getFirestoreDb();
    const origAmt = Number(updates.originalAmount !== undefined ? updates.originalAmount : (updates.amount || 0));
    const discAmt = Number(updates.discountAmount !== undefined ? updates.discountAmount : (updates.discount || 0));
    const taxAmt = Number(updates.taxAmount !== undefined ? updates.taxAmount : (updates.tax || updates.gst || 0));
    const othAmt = Number(updates.otherCharges || 0);

    const calculatedNet = Math.max(0, origAmt - discAmt + taxAmt + othAmt);
    const netPayable = Number(updates.netPayable !== undefined ? updates.netPayable : (calculatedNet > 0 ? calculatedNet : origAmt));
    const amountPaid = Number(updates.amountPaid !== undefined ? updates.amountPaid : (updates.paid !== undefined ? updates.paid : netPayable));
    const outstanding = Math.max(0, netPayable - amountPaid);
    const status = updates.status || (outstanding <= 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'pending'));

    const sanitizedUpdates: any = {
      ...updates,
      originalAmount: origAmt,
      discountAmount: discAmt,
      discount: discAmt,
      taxAmount: taxAmt,
      gst: taxAmt,
      otherCharges: othAmt,
      netPayable,
      amount: netPayable,
      amountPaid,
      paid: amountPaid,
      outstandingAmount: outstanding,
      pendingAmount: outstanding,
      status,
      updatedAt: new Date().toISOString()
    };

    if (firestore) {
      let docRef = firestore.collection('payments').doc(paymentId);
      let docSnap = await docRef.get();
      
      if (!docSnap.exists) {
        const qSnap = await firestore.collection('payments').where('invoiceNumber', '==', paymentId).limit(1).get();
        if (!qSnap.empty) {
          docRef = qSnap.docs[0].ref;
          docSnap = qSnap.docs[0];
        }
      }

      if (docSnap.exists) {
        const prevData = docSnap.data() || {};
        await docRef.update(sanitizedUpdates);
        const updatedDoc = { id: docRef.id, ...prevData, ...sanitizedUpdates };

        const memberId = sanitizedUpdates.memberId || prevData.memberId;
        if (memberId) {
          const memDocRef = firestore.collection('members').doc(memberId);
          const memSnap = await memDocRef.get();
          if (memSnap.exists) {
            const memData = memSnap.data() || {};
            const memberUpdates: any = {};
            if (sanitizedUpdates.memberName) memberUpdates.name = sanitizedUpdates.memberName;
            if (sanitizedUpdates.memberPhone) memberUpdates.phone = sanitizedUpdates.memberPhone;
            if (sanitizedUpdates.plan) memberUpdates.plan = sanitizedUpdates.plan;
            if (sanitizedUpdates.startDate) memberUpdates.startDate = sanitizedUpdates.startDate;
            if (sanitizedUpdates.expiryDate) memberUpdates.expiryDate = sanitizedUpdates.expiryDate;
            if (sanitizedUpdates.email !== undefined) memberUpdates.email = sanitizedUpdates.email;
            if (sanitizedUpdates.gender !== undefined) memberUpdates.gender = sanitizedUpdates.gender;
            if (sanitizedUpdates.trainer !== undefined) memberUpdates.trainer = sanitizedUpdates.trainer;
            if (sanitizedUpdates.branch !== undefined) memberUpdates.branch = sanitizedUpdates.branch;
            if (sanitizedUpdates.memberStatus !== undefined) memberUpdates.status = sanitizedUpdates.memberStatus;

            if (Array.isArray(memData.billingHistory)) {
              memberUpdates.billingHistory = memData.billingHistory.map((item: any) => {
                if (item.id === paymentId || item.invoiceNumber === paymentId || item.invoice === paymentId || item.id === docRef.id) {
                  return { ...item, ...sanitizedUpdates, id: docRef.id };
                }
                return item;
              });
            }

            if (Object.keys(memberUpdates).length > 0) {
              await memDocRef.update(memberUpdates);
            }
          }
        }

        // Record Audit Log
        try {
          await firestore.collection('audit_logs').add({
            action: 'Billing Updated',
            paymentId: docRef.id,
            memberId: memberId || 'unknown',
            memberName: sanitizedUpdates.memberName || prevData.memberName || 'Member',
            invoiceNumber: sanitizedUpdates.invoiceNumber || prevData.invoiceNumber || 'INV',
            changedBy: updates.changedBy || 'Gym Owner',
            timestamp: new Date().toISOString(),
            details: {
              previousAmount: prevData.amount || prevData.netPayable,
              newAmount: netPayable,
              previousDiscount: prevData.discount || prevData.discountAmount,
              newDiscount: discAmt,
              previousStartDate: prevData.startDate,
              newStartDate: sanitizedUpdates.startDate,
              previousExpiryDate: prevData.expiryDate,
              newExpiryDate: sanitizedUpdates.expiryDate
            }
          });
        } catch (err: any) {
          console.warn('[Audit Log] Failed to write audit log:', err.message);
        }

        return updatedDoc;
      }
    }

    const mockIdx = mockPayments.findIndex(p => p.id === paymentId || p.invoiceNumber === paymentId || p.invoice === paymentId);
    if (mockIdx !== -1) {
      mockPayments[mockIdx] = { ...mockPayments[mockIdx], ...sanitizedUpdates };
      saveMockDb();
      return mockPayments[mockIdx];
    }
    return { id: paymentId, ...sanitizedUpdates };
  },

  deletePayment: async (paymentId: string): Promise<boolean> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      try {
        const docRef = firestore.collection('payments').doc(paymentId);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          await docRef.update({
            deleted: true,
            deletedAt: new Date().toISOString()
          });
        } else {
          const qSnap = await firestore.collection('payments').where('invoiceNumber', '==', paymentId).get();
          qSnap.docs.forEach(doc => {
            doc.ref.update({
              deleted: true,
              deletedAt: new Date().toISOString()
            }).catch(() => {});
          });
        }
      } catch (err) {
        console.warn('[Firebase] Firestore payment delete warning:', err);
      }
    }

    const mockIdx = mockPayments.findIndex(p => p.id === paymentId || p.invoiceNumber === paymentId || p.invoice === paymentId);
    if (mockIdx !== -1) {
      mockPayments[mockIdx].deleted = true;
      mockPayments[mockIdx].deletedAt = new Date().toISOString();
      saveMockDb();
    }
    return true;
  },

  cleanupDuplicateInvoices: async (): Promise<any> => {
    const firestore = getFirestoreDb();
    const cleanedReport: any[] = [];

    if (firestore) {
      const snap = await firestore.collection('payments').get();
      const docs = snap.docs.map((d: any) => ({ docId: d.id, ...d.data() })) as any[];

      // Group payments by memberId
      const groups: Record<string, any[]> = {};
      docs.forEach((p: any) => {
        const key = p.memberId || p.memberName || 'unknown';
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
      });

      for (const [memberId, items] of Object.entries(groups)) {
        if (items.length <= 1) continue;

        // Find duplicates matching same plan & date
        const processed = new Set<string>();
        for (let i = 0; i < items.length; i++) {
          if (processed.has(items[i].docId)) continue;
          
          for (let j = i + 1; j < items.length; j++) {
            if (processed.has(items[j].docId)) continue;

            const a = items[i];
            const b = items[j];

            const dateA = String(a.date || a.createdAt || '').split('T')[0];
            const dateB = String(b.date || b.createdAt || '').split('T')[0];
            const planA = String(a.plan || '').toLowerCase().trim();
            const planB = String(b.plan || '').toLowerCase().trim();

            if (dateA === dateB && (planA === planB || planA.includes(planB) || planB.includes(planA))) {
              // Found duplicate pair! Determine master and duplicate
              let master = a;
              let duplicate = b;

              // If one doc has full original price (e.g. 9500) and the other has discounted amount (8200)
              const amtA = Number(a.amount || 0);
              const amtB = Number(b.amount || 0);

              const origAmt = Math.max(amtA, amtB);
              const netAmt = Math.min(amtA, amtB);
              const discAmt = origAmt - netAmt;

              // Keep master doc and update fields cleanly
              const mergedMaster = {
                originalAmount: origAmt,
                discountAmount: discAmt > 0 ? discAmt : Number(master.discountAmount || master.discount || 0),
                discount: discAmt > 0 ? discAmt : Number(master.discountAmount || master.discount || 0),
                taxAmount: Number(master.taxAmount || master.gst || 0),
                otherCharges: Number(master.otherCharges || 0),
                netPayable: netAmt > 0 ? netAmt : origAmt,
                amount: netAmt > 0 ? netAmt : origAmt,
                amountPaid: netAmt > 0 ? netAmt : origAmt,
                paid: netAmt > 0 ? netAmt : origAmt,
                outstandingAmount: 0,
                pendingAmount: 0,
                status: 'paid'
              };

              await firestore.collection('payments').doc(master.docId).update(mergedMaster);
              await firestore.collection('payments').doc(duplicate.docId).delete();

              processed.add(duplicate.docId);

              // Update member document totals
              try {
                await firestore.collection('members').doc(memberId).update({
                  totalBilled: mergedMaster.netPayable,
                  totalPaid: mergedMaster.amountPaid,
                  outstandingBalance: 0,
                  paymentStatus: 'paid'
                });
              } catch (_) {}

              cleanedReport.push({
                memberId,
                memberName: master.memberName,
                retainedInvoice: master.invoiceNumber || master.invoice,
                deletedInvoice: duplicate.invoiceNumber || duplicate.invoice,
                originalAmount: origAmt,
                discountAmount: discAmt,
                finalPayable: netAmt
              });
            }
          }
        }
      }
    } else {
      // Mock DB Cleanup
      const groups: Record<string, any[]> = {};
      mockPayments.forEach(p => {
        const key = p.memberId || p.memberName || 'unknown';
        if (!groups[key]) groups[key] = [];
        groups[key].push(p);
      });

      for (const [memberId, items] of Object.entries(groups)) {
        if (items.length <= 1) continue;
        
        for (let i = 0; i < items.length; i++) {
          for (let j = i + 1; j < items.length; j++) {
            const a = items[i];
            const b = items[j];

            if (!a || !b) continue;

            const dateA = String(a.date || a.createdAt || '').split('T')[0];
            const dateB = String(b.date || b.createdAt || '').split('T')[0];

            if (dateA === dateB && a.plan === b.plan) {
              const amtA = Number(a.amount || 0);
              const amtB = Number(b.amount || 0);
              const origAmt = Math.max(amtA, amtB);
              const netAmt = Math.min(amtA, amtB);
              const discAmt = origAmt - netAmt;

              a.originalAmount = origAmt;
              a.discountAmount = discAmt;
              a.discount = discAmt;
              a.netPayable = netAmt;
              a.amount = netAmt;
              a.amountPaid = netAmt;
              a.paid = netAmt;
              a.outstandingAmount = 0;
              a.pendingAmount = 0;
              a.status = 'paid';

              mockPayments = mockPayments.filter(m => m.id !== b.id);

              cleanedReport.push({
                memberId,
                memberName: a.memberName,
                retainedInvoice: a.invoice,
                deletedInvoice: b.invoice,
                originalAmount: origAmt,
                discountAmount: discAmt,
                finalPayable: netAmt
              });
            }
          }
        }
      }
      saveMockDb();
    }

    return cleanedReport;
  },

  getWorkoutsByMember: async (memberId: string): Promise<any[]> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snapshot = await firestore.collection('workouts').where('memberId', '==', memberId).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return mockWorkouts.filter(w => w.memberId === memberId);
  },

  saveWorkout: async (workout: any): Promise<any> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snapshot = await firestore.collection('workouts').where('memberId', '==', workout.memberId).get();
      if (!snapshot.empty) {
        const docId = snapshot.docs[0].id;
        await firestore.collection('workouts').doc(docId).update(workout);
        return { id: docId, ...workout };
      } else {
        const docRef = await firestore.collection('workouts').add(workout);
        return { id: docRef.id, ...workout };
      }
    }

    const idx = mockWorkouts.findIndex(w => w.memberId === workout.memberId);
    if (idx !== -1) {
      mockWorkouts[idx] = { ...mockWorkouts[idx], ...workout };
      return mockWorkouts[idx];
    } else {
      const newW = { ...workout, id: 'w_' + Date.now() };
      mockWorkouts.push(newW);
      return newW;
    }
  },

  getDietByMember: async (memberId: string): Promise<any | null> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snapshot = await firestore.collection('diets').where('memberId', '==', memberId).get();
      if (snapshot.empty) return null;
      return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }
    return mockDietPlans.find(d => d.memberId === memberId) || null;
  },

  saveDiet: async (diet: any): Promise<any> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snapshot = await firestore.collection('diets').where('memberId', '==', diet.memberId).get();
      if (!snapshot.empty) {
        const docId = snapshot.docs[0].id;
        await firestore.collection('diets').doc(docId).update(diet);
        return { id: docId, ...diet };
      } else {
        const docRef = await firestore.collection('diets').add(diet);
        return { id: docRef.id, ...diet };
      }
    }

    const idx = mockDietPlans.findIndex(d => d.memberId === diet.memberId);
    if (idx !== -1) {
      mockDietPlans[idx] = { ...mockDietPlans[idx], ...diet };
      return mockDietPlans[idx];
    } else {
      const newD = { ...diet, id: 'd_' + Date.now() };
      mockDietPlans.push(newD);
      return newD;
    }
  },

  approveDiet: async (id: string): Promise<any> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      await firestore.collection('diets').doc(id).update({ status: 'approved' });
      const doc = await firestore.collection('diets').doc(id).get();
      return { id: doc.id, ...doc.data() };
    }
    const idx = mockDietPlans.findIndex(d => d.id === id);
    if (idx !== -1) {
      mockDietPlans[idx].status = 'approved';
      return mockDietPlans[idx];
    }
    return null;
  },

  deleteDiet: async (id: string): Promise<boolean> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      await firestore.collection('diets').doc(id).delete();
      return true;
    }
    const idx = mockDietPlans.findIndex(d => d.id === id);
    if (idx !== -1) {
      mockDietPlans.splice(idx, 1);
      return true;
    }
    return false;
  },

  getCheatMealRequests: async (): Promise<any[]> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snapshot = await firestore.collection('cheatMealRequests').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return mockCheatMealRequests;
  },

  addCheatMealRequest: async (request: any): Promise<any> => {
    const firestore = getFirestoreDb();
    const newReq = {
      ...request,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };
    if (firestore) {
      const docRef = await firestore.collection('cheatMealRequests').add(newReq);
      return { id: docRef.id, ...newReq };
    }
    const id = 'cm_' + Date.now();
    const finalReq = { id, ...newReq };
    mockCheatMealRequests.unshift(finalReq);
    return finalReq;
  },

  updateCheatMealRequest: async (id: string, updates: any): Promise<any> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      await firestore.collection('cheatMealRequests').doc(id).update(updates);
      const doc = await firestore.collection('cheatMealRequests').doc(id).get();
      return { id: doc.id, ...doc.data() };
    }
    const idx = mockCheatMealRequests.findIndex(r => r.id === id);
    if (idx !== -1) {
      mockCheatMealRequests[idx] = { ...mockCheatMealRequests[idx], ...updates };
      return mockCheatMealRequests[idx];
    }
    return null;
  },

  getDailyDietLog: async (memberId: string, date: string): Promise<any | null> => {
    const firestore = getFirestoreDb();
    const docId = `${memberId}_${date}`;
    if (firestore) {
      const doc = await firestore.collection('dailyDietLogs').doc(docId).get();
      if (!doc.exists) return null;
      return { id: doc.id, ...doc.data() };
    }
    return mockDailyDietLogs.find(l => l.memberId === memberId && l.date === date) || null;
  },

  saveDailyDietLog: async (log: any): Promise<any> => {
    const firestore = getFirestoreDb();
    const docId = `${log.memberId}_${log.date}`;
    if (firestore) {
      await firestore.collection('dailyDietLogs').doc(docId).set(log, { merge: true });
      const doc = await firestore.collection('dailyDietLogs').doc(docId).get();
      return { id: doc.id, ...doc.data() };
    }
    const idx = mockDailyDietLogs.findIndex(l => l.memberId === log.memberId && l.date === log.date);
    if (idx !== -1) {
      mockDailyDietLogs[idx] = { ...mockDailyDietLogs[idx], ...log };
      return mockDailyDietLogs[idx];
    } else {
      const newLog = { id: docId, ...log };
      mockDailyDietLogs.push(newLog);
      return newLog;
    }
  },

  getProgressLogsByMember: async (memberId: string): Promise<any[]> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snapshot = await firestore.collection('progressLogs').where('memberId', '==', memberId).get();
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
      return logs.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateA - dateB;
      });
    }
    return mockProgressLogs.filter(p => p.memberId === memberId);
  },

  addProgressLog: async (log: any): Promise<any> => {
    const newLog = {
      ...log,
      date: new Date().toISOString().split('T')[0]
    };

    const firestore = getFirestoreDb();
    if (firestore) {
      const docRef = await firestore.collection('progressLogs').add(newLog);
      // Also update member current weight and BMI in member store
      await firestore.collection('members').doc(log.memberId).update({
        weight: log.weight,
        bmi: log.bmi
      });
      return { id: docRef.id, ...newLog };
    }

    newLog.id = 'pr_' + Date.now();
    mockProgressLogs.push(newLog);
    
    // update mock member
    const idx = mockMembers.findIndex(m => m.id === log.memberId);
    if (idx !== -1) {
      mockMembers[idx].weight = log.weight;
      mockMembers[idx].bmi = log.bmi;
    }

    return newLog;
  },

  getChats: async (userA: string, userB: string): Promise<any[]> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snapshot = await firestore.collection('chatMessages').orderBy('timestamp', 'asc').limit(200).get();
      const all = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return all.filter((c: any) => 
        (c.from === userA && c.to === userB) || (c.from === userB && c.to === userA)
      );
    }
    return mockChatMessages.filter(
      c => (c.from === userA && c.to === userB) || (c.from === userB && c.to === userA)
    );
  },

  addChatMessage: async (msg: any): Promise<any> => {
    const newMsg = {
      ...msg,
      timestamp: new Date().toISOString()
    };

    const firestore = getFirestoreDb();
    if (firestore) {
      const docRef = await firestore.collection('chatMessages').add(newMsg);
      return { id: docRef.id, ...newMsg };
    }

    newMsg.id = 'c_' + Date.now();
    mockChatMessages.push(newMsg);
    return newMsg;
  },

  getReferrals: async (memberId: string): Promise<any[]> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snapshot = await firestore.collection('referrals').where('memberId', '==', memberId).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return mockReferrals.filter(r => r.memberId === memberId);
  },

  addReferral: async (ref: any): Promise<any> => {
    const newRef = {
      ...ref,
      date: new Date().toISOString().split('T')[0],
      status: 'invited',
      reward: 'Pending signup'
    };

    const firestore = getFirestoreDb();
    if (firestore) {
      const docRef = await firestore.collection('referrals').add(newRef);
      return { id: docRef.id, ...newRef };
    }

    newRef.id = 'ref_' + Date.now();
    mockReferrals.push(newRef);
    return newRef;
  },

  getDevices: async (): Promise<any[]> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snapshot = await firestore.collection('devices').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return mockDevices;
  },

  addDevice: async (device: any): Promise<any> => {
    const firestore = getFirestoreDb();
    const newDevice = {
      ...device,
      enabled: device.enabled !== undefined ? device.enabled : true,
      lastSync: device.lastSync || null,
      status: device.status || 'offline',
      connectionHealth: device.connectionHealth !== undefined ? device.connectionHealth : 100
    };
    if (firestore) {
      const docRef = await firestore.collection('devices').add(newDevice);
      return { id: docRef.id, ...newDevice };
    }
    const id = 'dev_' + Date.now();
    const finalDevice = { id, ...newDevice };
    mockDevices.push(finalDevice);
    return finalDevice;
  },

  updateDevice: async (id: string, updates: any): Promise<any> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      await firestore.collection('devices').doc(id).update(updates);
      const doc = await firestore.collection('devices').doc(id).get();
      return { id: doc.id, ...doc.data() };
    }
    const idx = mockDevices.findIndex(d => d.id === id);
    if (idx !== -1) {
      mockDevices[idx] = { ...mockDevices[idx], ...updates };
      return mockDevices[idx];
    }
    return null;
  },

  deleteDevice: async (id: string): Promise<boolean> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      await firestore.collection('devices').doc(id).delete();
      return true;
    }
    mockDevices = mockDevices.filter(d => d.id !== id);
    return true;
  },

  addDeviceLog: async (log: any): Promise<any> => {
    const firestore = getFirestoreDb();
    const newLog = {
      ...log,
      timestamp: new Date().toISOString()
    };
    if (firestore) {
      const docRef = await firestore.collection('deviceLogs').add(newLog);
      return { id: docRef.id, ...newLog };
    }
    newLog.id = 'log_' + Date.now();
    mockDeviceLogs.unshift(newLog);
    return newLog;
  },

  getDeviceLogs: async (): Promise<any[]> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snapshot = await firestore.collection('deviceLogs').orderBy('timestamp', 'desc').limit(50).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return mockDeviceLogs;
  },

  getAccessControlDevices: async (): Promise<any[]> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snapshot = await firestore.collection('access_control_devices').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return mockAccessControlDevices;
  },

  addAccessControlEvent: async (event: any): Promise<any> => {
    const firestore = getFirestoreDb();
    const newEvt = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString()
    };
    if (firestore) {
      const docRef = await firestore.collection('access_control_events').add(newEvt);
      return { id: docRef.id, ...newEvt };
    }
    newEvt.id = 'evt_' + Date.now();
    mockAccessControlEvents.unshift(newEvt);
    return newEvt;
  },

  getAccessControlEvents: async (limitCount: number = 50): Promise<any[]> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snapshot = await firestore.collection('access_control_events').orderBy('timestamp', 'desc').limit(limitCount).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return mockAccessControlEvents.slice(0, limitCount);
  },

  getAccessLogs: async (): Promise<any[]> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snapshot = await firestore.collection('accessLogs').orderBy('timestamp', 'desc').limit(50).get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return mockAccessLogs;
  },

  getDoorStatus: async (): Promise<any[]> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snapshot = await firestore.collection('doorStatus').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return mockDoorStatus;
  },

  getTrainers: async (): Promise<any[]> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snapshot = await firestore.collection('trainers').get();
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return mockTrainers;
  },

  addTrainer: async (trainer: any): Promise<any> => {
    const firestore = getFirestoreDb();
    const cleanPhone = trainer.phone ? String(trainer.phone).trim() : '';
    const cleanEmail = trainer.email ? String(trainer.email).trim().toLowerCase() : '';

    const newTrainer = {
      ...trainer,
      phone: cleanPhone,
      email: cleanEmail,
      rating: Number(trainer.rating) || 4.8,
      members: Number(trainer.members) || 0,
      sessions: Number(trainer.sessions) || 0,
      experience: Number(trainer.experience) || 1,
      salary: Number(trainer.salary) || 30000,
      status: trainer.status || 'active',
      certifications: Array.isArray(trainer.certifications) ? trainer.certifications : 
                      typeof trainer.certifications === 'string' ? trainer.certifications.split(',').map((c: string) => c.trim()) : []
    };

    if (firestore) {
      // 1. Check for duplicate trainer by phone
      if (cleanPhone) {
        const dupSnap = await firestore.collection('trainers').where('phone', '==', cleanPhone).get();
        if (!dupSnap.empty) {
          throw new Error(`Trainer with phone number ${cleanPhone} already exists.`);
        }
      }

      // 2. Create Trainer Document
      const docRef = await firestore.collection('trainers').add(newTrainer);
      const trainerId = docRef.id;

      // 3. Automatically sync/create employee record in 'employees' collection
      let employeeId = '';
      try {
        let existingEmpDocId: string | null = null;
        if (cleanPhone) {
          const empSnap = await firestore.collection('employees').where('phone', '==', cleanPhone).get();
          if (!empSnap.empty) existingEmpDocId = empSnap.docs[0].id;
        }
        if (!existingEmpDocId && cleanEmail) {
          const empSnapEmail = await firestore.collection('employees').where('email', '==', cleanEmail).get();
          if (!empSnapEmail.empty) existingEmpDocId = empSnapEmail.docs[0].id;
        }

        const employeePayload: any = {
          name: newTrainer.name,
          phone: cleanPhone,
          email: cleanEmail || `${cleanPhone || Date.now()}@thewarriorgym.in`,
          role: 'Trainer',
          designation: 'Trainer',
          department: 'Fitness / Training',
          branch: newTrainer.branch || 'Mohali, Punjab',
          specialization: newTrainer.specialization || '',
          experience: newTrainer.experience || 1,
          salary: newTrainer.salary || 30000,
          joiningDate: newTrainer.joiningDate || new Date().toISOString().split('T')[0],
          status: newTrainer.status === 'inactive' ? 'Inactive' : 'Active',
          trainerId: trainerId,
          photo: newTrainer.photo || '',
          avatarUrl: newTrainer.photo || '',
          biometricId: newTrainer.biometricId || null,
          updatedAt: new Date().toISOString()
        };

        if (existingEmpDocId) {
          employeeId = existingEmpDocId;
          await firestore.collection('employees').doc(existingEmpDocId).update(employeePayload);
        } else {
          // Find max biometric ID or set 500+ for employees
          const allEmps = await firestore.collection('employees').get();
          let maxBid = 500;
          allEmps.forEach(d => {
            const bid = Number(d.data().biometricId);
            if (!isNaN(bid) && bid > maxBid) maxBid = bid;
          });
          const biometricId = newTrainer.biometricId || (maxBid + 1);

          const newEmpRef = await firestore.collection('employees').add({
            ...employeePayload,
            biometricId,
            todayStatus: 'Absent',
            currentStatus: 'Outside',
            lastPunch: null,
            createdAt: new Date().toISOString()
          });
          employeeId = newEmpRef.id;
        }

        // Link employeeId back to trainer document
        await firestore.collection('trainers').doc(trainerId).update({ employeeId });
      } catch (empSyncErr) {
        console.error('Failed to sync trainer to employees collection:', empSyncErr);
      }

      return { id: trainerId, employeeId, ...newTrainer };
    }

    const id = 't' + (mockTrainers.length + 1);
    const finalTrainer = { id, ...newTrainer };
    mockTrainers.push(finalTrainer);
    return finalTrainer;
  },

  updateTrainer: async (id: string, updates: any): Promise<any> => {
    const firestore = getFirestoreDb();
    if (updates.certifications && typeof updates.certifications === 'string') {
      updates.certifications = updates.certifications.split(',').map((c: string) => c.trim());
    }
    if (firestore) {
      await firestore.collection('trainers').doc(id).update(updates);
      const doc = await firestore.collection('trainers').doc(id).get();
      const updatedTrainerData: any = { id: doc.id, ...doc.data() };

      // Sync updates to linked employee document if present
      try {
        const empId = (updatedTrainerData as any).employeeId;
        const phone = (updatedTrainerData as any).phone;
        let empDocRef: any = null;

        if (empId) {
          empDocRef = firestore.collection('employees').doc(empId);
        } else if (phone) {
          const empSnap = await firestore.collection('employees').where('phone', '==', phone).get();
          if (!empSnap.empty) empDocRef = empSnap.docs[0].ref;
        }

        if (empDocRef) {
          const empUpdates: any = {};
          if (updates.name) empUpdates.name = updates.name;
          if (updates.phone) empUpdates.phone = updates.phone;
          if (updates.email) empUpdates.email = updates.email;
          if (updates.salary !== undefined) empUpdates.salary = Number(updates.salary);
          if (updates.joiningDate) empUpdates.joiningDate = updates.joiningDate;
          if (updates.status) empUpdates.status = updates.status === 'inactive' ? 'Inactive' : 'Active';
          if (updates.photo) { empUpdates.photo = updates.photo; empUpdates.avatarUrl = updates.photo; }
          if (updates.specialization) empUpdates.specialization = updates.specialization;
          empUpdates.updatedAt = new Date().toISOString();

          await empDocRef.update(empUpdates);
        }
      } catch (empUpdateErr) {
        console.error('Failed to sync updated trainer data to employee record:', empUpdateErr);
      }

      return updatedTrainerData;
    }
    const idx = mockTrainers.findIndex(t => t.id === id);
    if (idx !== -1) {
      mockTrainers[idx] = { ...mockTrainers[idx], ...updates };
      return mockTrainers[idx];
    }
    return null;
  },

  deleteTrainer: async (id: string): Promise<boolean> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const doc = await firestore.collection('trainers').doc(id).get();
      const tData = doc.data();
      await firestore.collection('trainers').doc(id).delete();

      // If linked employee doc exists, deactivate or remove it
      if (tData) {
        try {
          if (tData.employeeId) {
            await firestore.collection('employees').doc(tData.employeeId).delete().catch(() => {});
          } else if (tData.phone) {
            const empSnap = await firestore.collection('employees').where('phone', '==', tData.phone).get();
            empSnap.forEach(d => d.ref.delete().catch(() => {}));
          }
        } catch (e) {
          console.error('Failed to cleanup linked employee on trainer delete:', e);
        }
      }
      return true;
    }
    const idx = mockTrainers.findIndex(t => t.id === id);
    if (idx !== -1) {
      mockTrainers.splice(idx, 1);
      return true;
    }
    return false;
  },

  getSmtpConfig: async (): Promise<any> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const doc = await firestore.collection('system_config').doc('smtp').get();
      if (doc.exists) return doc.data();
    }
    const configPath = './smtp_config.json';
    if (fs.existsSync(configPath)) {
      try {
        return JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e) {}
    }
    return {
      host: 'smtp.gmail.com',
      port: '587',
      secure: false,
      user: '',
      pass: '',
      fromName: 'The Warrior Gym',
      fromEmail: 'noreply@thewarriorgym.in',
      triggers: {
        welcome: true,
        expiry7: true,
        expiry3: true,
        payment: true,
        expired: false
      }
    };
  },

  saveSmtpConfig: async (config: any): Promise<any> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      await firestore.collection('system_config').doc('smtp').set(config, { merge: true });
    }
    const configPath = './smtp_config.json';
    try {
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    } catch (e) {}
    return config;
  },

  getPlans: async (): Promise<any[]> => {
    const firestore = getFirestoreDb();
    let rawPlans: any[] = [];
    if (firestore) {
      const snapshot = await firestore.collection('plans').get();
      if (snapshot.empty) {
        // Seed default plans
        for (const plan of mockPlans) {
          await firestore.collection('plans').doc(plan.id).set(plan);
        }
        rawPlans = mockPlans;
      } else {
        rawPlans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      }
    } else {
      rawPlans = mockPlans;
    }

    // Deduplicate plans strictly by normalized name, price, and durationDays
    const uniqueMap = new Map();
    rawPlans.forEach(p => {
      const key = `${(p.name || '').trim().toLowerCase()}_${p.price}_${p.durationDays}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, p);
      }
    });
    return Array.from(uniqueMap.values());
  },

  addPlan: async (plan: any): Promise<any> => {
    const newPlan = {
      ...plan,
      id: plan.id || 'p_' + Date.now()
    };
    const firestore = getFirestoreDb();
    if (firestore) {
      await firestore.collection('plans').doc(newPlan.id).set(newPlan);
      return newPlan;
    }
    mockPlans.push(newPlan);
    return newPlan;
  },

  updatePlan: async (id: string, updates: any): Promise<any> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      // Use set with merge to avoid NOT_FOUND errors when document fields differ
      await firestore.collection('plans').doc(id).set(updates, { merge: true });
      const doc = await firestore.collection('plans').doc(id).get();
      return { id: doc.id, ...doc.data() };
    }
    const idx = mockPlans.findIndex(p => p.id === id);
    if (idx !== -1) {
      mockPlans[idx] = { ...mockPlans[idx], ...updates };
      return mockPlans[idx];
    }
    return null;
  },

  deletePlan: async (id: string): Promise<boolean> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      await firestore.collection('plans').doc(id).delete();
      return true;
    }
    const idx = mockPlans.findIndex(p => p.id === id);
    if (idx !== -1) {
      mockPlans.splice(idx, 1);
      return true;
    }
    return false;
  },

  getMigrations: async (): Promise<any[]> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snap = await firestore.collection('migrations').orderBy('timestamp', 'desc').get();
      return snap.docs.map(doc => doc.data());
    }
    return mockMigrations;
  },

  addMigration: async (migration: any): Promise<any> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      await firestore.collection('migrations').doc(migration.sessionId).set(migration);
      return migration;
    }
    mockMigrations.push(migration);
    return migration;
  },

  rollbackMockMigration: async (uids: string[], sessionId: string): Promise<void> => {
    // Remove from mockMembers
    mockMembers = mockMembers.filter(m => !uids.includes(m.id || m.uid));
    
    // Remove from mockPayments
    mockPayments = mockPayments.filter(p => !uids.includes(p.memberId));
    
    // Remove from mockAttendance
    mockAttendance = mockAttendance.filter(a => !uids.includes(a.memberId));

    const mig = mockMigrations.find(m => m.sessionId === sessionId);
    if (mig) {
      mig.status = 'rolled_back';
      mig.rolledBackAt = new Date().toISOString();
    }
  },

  purgeMocks: async (): Promise<any> => {
    mockMembers = [];
    mockAttendance = [];
    mockPayments = [];
    mockWorkouts = [];
    mockDietPlans = [];
    mockCheatMealRequests = [];
    mockDailyDietLogs = [];
    mockProgressLogs = [];
    mockChatMessages = [];
    mockReferrals = [];
    mockMigrations = [];
    mockFollowups = [];
    membersCache = null;
    return {
      members: 0,
      attendance: 0,
      payments: 0,
      workouts: 0,
      diets: 0,
      cheatMeals: 0,
      logs: 0,
      referrals: 0,
      migrations: 0,
      followups: 0
    };
  },

  getFollowups: async (): Promise<any[]> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snap = await firestore.collection('followups').orderBy('scheduledTimestamp', 'asc').get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return mockFollowups;
  },

  addFollowup: async (followup: any): Promise<any> => {
    const firestore = getFirestoreDb();
    const id = followup.id || (followup.automationKey ? followup.automationKey : `fol_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
    const docData = { ...followup, id };
    if (firestore) {
      await firestore.collection('followups').doc(id).set(docData, { merge: true });
      return docData;
    }
    const idx = mockFollowups.findIndex(f => f.id === id || (followup.automationKey && f.automationKey === followup.automationKey));
    if (idx !== -1) {
      mockFollowups[idx] = { ...mockFollowups[idx], ...docData };
    } else {
      mockFollowups.push(docData);
    }
    return docData;
  },

  updateFollowup: async (id: string, updates: any): Promise<any> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      await firestore.collection('followups').doc(id).update(updates);
      return { id, ...updates };
    }
    const idx = mockFollowups.findIndex(f => f.id === id || f.automationKey === id);
    if (idx !== -1) {
      mockFollowups[idx] = { ...mockFollowups[idx], ...updates };
      return mockFollowups[idx];
    }
    return null;
  },

  deleteFollowup: async (id: string): Promise<boolean> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      await firestore.collection('followups').doc(id).delete();
      return true;
    }
    const idx = mockFollowups.findIndex(f => f.id === id || f.automationKey === id);
    if (idx !== -1) {
      mockFollowups.splice(idx, 1);
      return true;
    }
    return false;
  },

  getEnquiries: async (): Promise<any[]> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snap = await firestore.collection('enquiries').get();
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    return mockEnquiries;
  },

  addEnquiry: async (enquiry: any): Promise<any> => {
    const firestore = getFirestoreDb();
    const id = enquiry.id || `enq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const docData = { ...enquiry, id };
    if (firestore) {
      await firestore.collection('enquiries').doc(id).set(docData, { merge: true });
      return docData;
    }
    const idx = mockEnquiries.findIndex(e => e.id === id);
    if (idx !== -1) {
      mockEnquiries[idx] = { ...mockEnquiries[idx], ...docData };
    } else {
      mockEnquiries.push(docData);
    }
    saveMockDb();
    return docData;
  },

  updateEnquiry: async (id: string, updates: any): Promise<any> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      await firestore.collection('enquiries').doc(id).set(updates, { merge: true });
      return { id, ...updates };
    }
    const idx = mockEnquiries.findIndex(e => e.id === id);
    if (idx !== -1) {
      mockEnquiries[idx] = { ...mockEnquiries[idx], ...updates };
      saveMockDb();
      return mockEnquiries[idx];
    }
    return null;
  },

  deleteEnquiry: async (id: string): Promise<boolean> => {
    const firestore = getFirestoreDb();
    if (firestore) {
      await firestore.collection('enquiries').doc(id).delete();
      return true;
    }
    const idx = mockEnquiries.findIndex(e => e.id === id);
    if (idx !== -1) {
      mockEnquiries.splice(idx, 1);
      saveMockDb();
      return true;
    }
    return false;
  }
};

// Seed/provision default demo accounts on backend boot
export const provisionAdminAccounts = async () => {
  if (!isFirebaseInitialized) return;
  const auth = admin.auth();
  const firestore = admin.firestore();

  const demoAccounts = [
    { role: 'gym_owner', label: 'Gym Owner', email: 'owner@thewarriorgym.in', password: '1234567', name: 'Warrior Gym Owner' },
    { role: 'super_admin', label: 'Super Admin', email: 'superadmin@thewarriorgym.in', password: 'admin123', name: 'Super Admin' },
    { role: 'branch_manager', label: 'Manager', email: 'manager@thewarriorgym.in', password: 'manager123', name: 'Priya Patel' },
    { role: 'trainer', label: 'Trainer', email: 'trainer@thewarriorgym.in', password: 'trainer123', name: 'Karan Verma' },
    { role: 'receptionist', label: 'Receptionist', email: 'reception@thewarriorgym.in', password: 'recep123', name: 'Ravi Kumar' },
  ];

  console.log('Provisioning Firebase Auth and Firestore users...');

  for (const acc of demoAccounts) {
    try {
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(acc.email);
        console.log(`User already exists in Auth: ${acc.email} (${userRecord.uid})`);
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          userRecord = await auth.createUser({
            email: acc.email,
            password: acc.password,
            displayName: acc.name,
            emailVerified: true
          });
          console.log(`Successfully created Auth user: ${acc.email}`);
        } else {
          throw err;
        }
      }

      // Ensure profile exists in Firestore /users collection
      const userRef = firestore.collection('users').doc(userRecord.uid);
      const doc = await userRef.get();
      if (!doc.exists) {
        await userRef.set({
          uid: userRecord.uid,
          name: acc.name,
          email: acc.email,
          role: acc.role,
          branch: 'Mohali, Punjab',
          gymId: 'gym_001',
          createdAt: new Date().toISOString()
        });
        console.log(`Successfully created Firestore profile for: ${acc.email}`);
      } else {
        // update role if necessary
        await userRef.update({ role: acc.role });
      }
    } catch (error) {
      console.error(`Error provisioning user ${acc.email}:`, error);
    }
  }
};

export { admin, isFirebaseInitialized };
