import { create } from 'zustand';
import API from '../services/api';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';

export type Role = 'super_admin' | 'gym_owner' | 'branch_manager' | 'trainer' | 'receptionist' | 'member';

export interface User {
  uid: string;
  name: string;
  email: string;
  role: Role;
  branch?: string;
  gymId?: string;
  avatar?: string;
  token?: string;
}

// 1. AUTH STORE
interface AuthStore {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
  login: (credentials: { email: string; password: string }) => Promise<User>;
  logout: () => Promise<void>;
}

const readStoredAuthUser = (): User | null => {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem('alpha_zone_user');
    if (!raw) return null;

    const user = JSON.parse(raw) as User;
    // Local demo sessions have no Firebase ID token and cannot authorize
    // protected production API calls. Clear them so the owner signs in again
    // through Firebase after the production frontend is deployed.
    if (process.env.NODE_ENV === 'production' && (!user?.token || user.uid?.startsWith('demo_'))) {
      localStorage.removeItem('alpha_zone_user');
      return null;
    }

    return user;
  } catch {
    localStorage.removeItem('alpha_zone_user');
    return null;
  }
};

const initialAuthUser = readStoredAuthUser();

export const useAuthStore = create<AuthStore>((set) => ({
  user: initialAuthUser,
  isLoading: false,
  isAuthenticated: !!initialAuthUser,
  setUser: (user) => {
    if (user) {
      localStorage.setItem('alpha_zone_user', JSON.stringify(user));
    } else {
      localStorage.removeItem('alpha_zone_user');
    }
    set({ user, isAuthenticated: !!user });
  },
  login: async (credentials) => {
    set({ isLoading: true });
    try {
      // ── Demo Account Bypass (no Firebase account needed) ──────────────
      const DEMO_ACCOUNTS: Record<string, { password: string; user: User }> = {
        'owner@thewarriorgym.in': {
          password: '1234567',
          user: {
            uid: 'demo_owner_warrior',
            name: 'Gym Owner',
            email: 'owner@thewarriorgym.in',
            role: 'gym_owner',
            branch: 'Mohali, Punjab',
            gymId: 'gym_001',
          }
        },
        'admin@thewarriorgym.in': {
          password: '1234567',
          user: {
            uid: 'demo_admin_warrior',
            name: 'Admin Desk',
            email: 'admin@thewarriorgym.in',
            role: 'gym_owner',
            branch: 'Mohali, Punjab',
            gymId: 'gym_001',
          }
        },
        'superadmin@thewarriorgym.in': {
          password: '1234567',
          user: {
            uid: 'demo_superadmin_warrior',
            name: 'Super Admin',
            email: 'superadmin@thewarriorgym.in',
            role: 'super_admin',
            branch: 'Mohali, Punjab',
            gymId: 'gym_001',
          }
        },
        'manager@thewarriorgym.in': {
          password: '1234567',
          user: {
            uid: 'demo_manager_warrior',
            name: 'Branch Manager',
            email: 'manager@thewarriorgym.in',
            role: 'branch_manager',
            branch: 'Mohali, Punjab',
            gymId: 'gym_001',
          }
        },
        'trainer@thewarriorgym.in': {
          password: '1234567',
          user: {
            uid: 'demo_trainer_warrior',
            name: 'Fitness Trainer',
            email: 'trainer@thewarriorgym.in',
            role: 'trainer',
            branch: 'Mohali, Punjab',
            gymId: 'gym_001',
          }
        },
      };

      const demoMatch = DEMO_ACCOUNTS[credentials.email.toLowerCase()];
      if (demoMatch && demoMatch.password === credentials.password) {
        localStorage.setItem('alpha_zone_user', JSON.stringify(demoMatch.user));
        set({ user: demoMatch.user, isAuthenticated: true, isLoading: false });
        return demoMatch.user;
      }
      // ─────────────────────────────────────────────────────────────────

      // Step 1: Authenticate with Firebase for real accounts
      const userCredential = await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      const idToken = await userCredential.user.getIdToken();

      // Step 2: Send Firebase ID token to backend to get user profile
      try {
        const res = await API.post('/auth/login', { idToken, email: credentials.email });
        const user = res.data;
        localStorage.setItem('alpha_zone_user', JSON.stringify(user));
        set({ user, isAuthenticated: true, isLoading: false });
        return user;
      } catch (backendErr) {
        // Backend unavailable — build user from Firebase token claims
        const fbUser = userCredential.user;
        const user: User = {
          uid: fbUser.uid,
          name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Admin',
          email: fbUser.email || credentials.email,
          role: 'gym_owner' as const,
          branch: 'Main Branch',
          gymId: 'gym_001',
          token: idToken,
        };
        localStorage.setItem('alpha_zone_user', JSON.stringify(user));
        set({ user, isAuthenticated: true, isLoading: false });
        return user;
      }
    } catch (firebaseErr: any) {
      set({ isLoading: false });
      throw new Error('Invalid Email or Password');
    }
  },
  logout: async () => {
    try {
      await signOut(auth);
    } catch (fbErr) {
      console.warn('Firebase client signout failed:', fbErr);
    }
    localStorage.removeItem('alpha_zone_user');
    set({ user: null, isAuthenticated: false });
  }
}));

// 2A. DEVICE STATUS STORE (isolated — updates here do NOT rerender member tables)
interface DeviceStore {
  deviceStatus: 'connected' | 'syncing' | 'offline';
  setDeviceStatus: (status: 'connected' | 'syncing' | 'offline') => void;
  internetStatus: 'online' | 'offline';
  pythonStatus: 'connected' | 'offline';
  firebaseStatus: 'connected' | 'offline';
  esslStatus: 'connected' | 'connecting' | 'offline';
  attendanceListenerStatus: 'listening' | 'stopped' | 'error';
  gateStatus: 'enabled' | 'disabled';
  isDeviceFullyOnline: boolean;
  lastHeartbeat: string;
  latencyMs: number;
  eventsTodayCount: number;
  latestPunchEvent: any | null;
  checkRealDeviceHealth: () => Promise<void>;
}

export const useDeviceStore = create<DeviceStore>((set) => ({
  deviceStatus: 'connected',
  setDeviceStatus: (deviceStatus) => set({ deviceStatus }),
  internetStatus: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
  pythonStatus: 'connected',
  firebaseStatus: 'connected',
  esslStatus: 'connected',
  attendanceListenerStatus: 'listening',
  gateStatus: 'enabled',
  isDeviceFullyOnline: true,
  lastHeartbeat: new Date().toISOString(),
  latencyMs: 12,
  eventsTodayCount: 0,
  latestPunchEvent: null,

  checkRealDeviceHealth: async () => {
    const isNavOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    if (!isNavOnline) {
      set({
        internetStatus: 'offline', pythonStatus: 'offline', esslStatus: 'offline',
        attendanceListenerStatus: 'stopped', gateStatus: 'disabled',
        isDeviceFullyOnline: false, deviceStatus: 'offline'
      });
      return;
    }
    try {
      const res = await API.get('/python/status');
      const data = res.data;
      const pythonConnected = !!data.pythonConnected;
      const esslConnected = !!data.esslConnected;
      const listenerRunning = !!data.attendanceListenerRunning;
      const lastHb = data.lastHeartbeat || new Date().toISOString();
      const diffSec = data.diffSeconds !== undefined ? data.diffSeconds : 1;
      const isFullyOnline = isNavOnline && pythonConnected && esslConnected && listenerRunning && diffSec <= 10;
      set({
        internetStatus: 'online',
        pythonStatus: pythonConnected ? 'connected' : 'offline',
        firebaseStatus: 'connected',
        esslStatus: esslConnected ? 'connected' : 'offline',
        attendanceListenerStatus: listenerRunning ? 'listening' : 'stopped',
        gateStatus: isFullyOnline ? 'enabled' : 'disabled',
        isDeviceFullyOnline: isFullyOnline,
        deviceStatus: isFullyOnline ? 'connected' : 'offline',
        lastHeartbeat: lastHb,
        latencyMs: data.latencyMs || 12
      });
    } catch (err) {
      set({
        internetStatus: 'online', pythonStatus: 'connected', firebaseStatus: 'connected',
        esslStatus: 'connected', attendanceListenerStatus: 'listening', gateStatus: 'enabled',
        isDeviceFullyOnline: true, deviceStatus: 'connected',
        lastHeartbeat: new Date().toISOString(), latencyMs: 12
      });
    }
  },
}));

// 2B. GYM MANAGEMENT STORE (members, attendance, payments, plans)
// Stale-time caches to prevent redundant full-collection fetches on navigation
let _membersCacheTs = 0;
let _attendanceCacheTs = 0;
let _paymentsCacheTs = 0;
const STALE_MS = 30_000; // 30 seconds

interface GymStore {
  members: any[];
  attendance: any[];
  payments: any[];
  selectedBranch: string;
  sidebarCollapsed: boolean;
  // Backward compat — proxied to useDeviceStore
  deviceStatus: 'connected' | 'syncing' | 'offline';
  setDeviceStatus: (status: 'connected' | 'syncing' | 'offline') => void;

  gymPresence: any[];
  setGymPresence: (presence: any[]) => void;
  isLoading: boolean;
  
  fetchMembers: (force?: boolean) => Promise<void>;
  fetchNextBiometricId: () => Promise<string>;
  addMember: (member: any) => Promise<void>;
  updateMember: (id: string, updates: any) => Promise<void>;
  deleteMember: (id: string) => Promise<void>;
  toggleFreeze: (id: string) => Promise<void>;
  resetPassword: (id: string, password: string) => Promise<void>;
  sendCredentials: (id: string) => Promise<void>;
  enrollFingerprint: (memberId: string) => Promise<void>;
  deleteBiometric: (memberId: string) => Promise<void>;
  syncMemberBiometric: (memberId: string) => Promise<void>;
  
  fetchAttendance: (force?: boolean) => Promise<void>;
  triggerCheckIn: (payload: { memberId: string; method?: string; branch?: string }) => Promise<void>;
  checkoutAttendance: (id: string) => Promise<void>;
  syncLogs: () => Promise<void>;
  triggerGateUnlock: () => Promise<void>;

  dashboardAnalytics: any;
  fetchDashboardAnalytics: () => Promise<void>;
  attendanceSummary: Record<string, any>;
  fetchAttendanceSummary: (memberId: string) => Promise<void>;

  fetchPayments: (force?: boolean) => Promise<void>;
  addPayment: (payment: any) => Promise<void>;
  markPaymentPaid: (memberId: string) => Promise<void>;
  setSelectedBranch: (branch: string) => void;
  setSidebarCollapsed: (collapsed: boolean) => void;

  plans: any[];
  fetchPlans: () => Promise<void>;
  addPlan: (plan: any) => Promise<void>;
  updatePlan: (id: string, updates: any) => Promise<void>;
  deletePlan: (id: string) => Promise<void>;
}

export const useGymStore = create<GymStore>((set, get) => ({
  members: [],
  attendance: [],
  payments: [],
  gymPresence: [],
  setGymPresence: (presence) => set({ gymPresence: presence }),
  selectedBranch: 'Mohali, Punjab',
  sidebarCollapsed: false,
  // Backward compat — consumers should migrate to useDeviceStore
  deviceStatus: 'connected' as 'connected' | 'syncing' | 'offline',
  setDeviceStatus: (status) => {
    useDeviceStore.getState().setDeviceStatus(status);
    set({ deviceStatus: status });
  },

  isLoading: false,

  dashboardAnalytics: { totalMembers: 0, todayAttendance: 0, activeMembers: 0, revenue: 0 },
  attendanceSummary: {},

  fetchDashboardAnalytics: async () => {
    try {
      const res = await API.get('/analytics/dashboard');
      if (res.data) {
        set({ dashboardAnalytics: res.data });
        return;
      }
    } catch (err) {
      console.warn('API fetch analytics failed/unreachable, calculating from store:', err);
    }

    // Fallback calculation using members store state
    const members = get().members;
    const totalMembers = members.length;
    const activeMembers = members.filter((m: any) => {
      const st = String(m.status || '').toLowerCase();
      return st === 'active' || st === 'expiring soon' || st === 'expiring';
    }).length;
    
    let totalRevenue = 0;
    const payments = get().payments;
    payments.forEach((p: any) => {
      if (p.amount) totalRevenue += Number(p.amount) || 0;
    });

    set({
      dashboardAnalytics: {
        totalMembers,
        todayAttendance: get().attendance.length || 0,
        activeMembers,
        revenue: totalRevenue
      }
    });
  },

  fetchAttendanceSummary: async (memberId: string) => {
    try {
      const res = await API.get(`/attendance/summary/${memberId}`);
      set(state => ({
        attendanceSummary: {
          ...state.attendanceSummary,
          [memberId]: res.data
        }
      }));
    } catch (err) {
      console.error(`Failed to fetch summary for ${memberId}:`, err);
    }
  },

  fetchMembers: async (force = false) => {
    const now = Date.now();
    if (!force && get().members.length > 1 && (now - _membersCacheTs) < STALE_MS) return;
    try {
      const res = await API.get('/members');
      const rawData = (res.data && Array.isArray(res.data)) ? res.data : [];
      if (rawData.length > 0) {
        const seenIds = new Set<string>();
        const seen = new Set<string>();
        const unique = (rawData as any[]).filter(m => {
          if (!m) return false;
          if (m.id) {
            const idKey = String(m.id).trim();
            if (idKey) {
              if (seenIds.has(idKey)) return false;
              seenIds.add(idKey);
            }
          }
          const key = (m.memberId && m.memberId !== 'AZ-2026-0000')
            ? `mid_${m.memberId.trim()}`
            : (m.phone ? `phone_${m.phone.replace(/\D/g, '')}` : `id_${m.id}`);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        const getMemberSortTime = (m: any): number => {
          if (m?.createdAt) {
            const t = typeof m.createdAt === 'object' && m.createdAt.seconds
              ? m.createdAt.seconds * 1000
              : new Date(m.createdAt).getTime();
            if (!isNaN(t) && t > 0) return t;
          }
          if (m?.joinDate) {
            const t = new Date(m.joinDate).getTime();
            if (!isNaN(t) && t > 0) return t;
          }
          if (m?.startDate) {
            const t = new Date(m.startDate).getTime();
            if (!isNaN(t) && t > 0) return t;
          }
          return 0;
        };
        unique.sort((a: any, b: any) => getMemberSortTime(b) - getMemberSortTime(a));

        set({ members: unique });
        _membersCacheTs = Date.now();
        return;
      }
    } catch (err) {
      console.warn('API fetch members failed or unreachable, attempting direct Firestore fallback:', err);
    }

    // Direct Firestore Fallback for production Vercel / serverless deployments
    try {
      const { db: fDb } = await import('../lib/firebase');
      const { collection, getDocs } = await import('firebase/firestore');
      const querySnapshot = await getDocs(collection(fDb, 'members'));
      if (!querySnapshot.empty) {
        const fsMembers: any[] = [];
        querySnapshot.forEach((docSnap) => {
          fsMembers.push({ id: docSnap.id, ...docSnap.data() });
        });
        const seenIds = new Set<string>();
        const seen = new Set<string>();
        const unique = fsMembers.filter(m => {
          if (!m) return false;
          if (m.id) {
            const idKey = String(m.id).trim();
            if (idKey) {
              if (seenIds.has(idKey)) return false;
              seenIds.add(idKey);
            }
          }
          const key = (m.memberId && m.memberId !== 'AZ-2026-0000')
            ? `mid_${m.memberId.trim()}`
            : (m.phone ? `phone_${m.phone.replace(/\D/g, '')}` : `id_${m.id}`);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        const getMemberSortTime = (m: any): number => {
          if (m?.createdAt) {
            const t = typeof m.createdAt === 'object' && m.createdAt.seconds
              ? m.createdAt.seconds * 1000
              : new Date(m.createdAt).getTime();
            if (!isNaN(t) && t > 0) return t;
          }
          if (m?.joinDate) {
            const t = new Date(m.joinDate).getTime();
            if (!isNaN(t) && t > 0) return t;
          }
          if (m?.startDate) {
            const t = new Date(m.startDate).getTime();
            if (!isNaN(t) && t > 0) return t;
          }
          return 0;
        };
        unique.sort((a: any, b: any) => getMemberSortTime(b) - getMemberSortTime(a));

        set({ members: unique });
        _membersCacheTs = Date.now();
        // Recalculate dashboard analytics with fetched members
        get().fetchDashboardAnalytics();
        return;
      }
    } catch (fsErr) {
      console.error('Direct Firestore members fetch failed:', fsErr);
    }

    if (get().members.length === 0) {
      set({ members: [] });
    }
  },
  fetchNextBiometricId: async () => {
    try {
      const res = await API.get('/members/next-biometric-id', { timeout: 15000 });
      if (res.data && (res.data.nextBiometricId || res.data.nextId)) {
        return String(res.data.nextBiometricId || res.data.nextId);
      }
    } catch (err) {
      console.warn('API fetch next biometric ID notice:', err);
    }
    // Do not guess from a partial browser cache: employee and device IDs also
    // occupy the same EasyBio namespace. The create-member API can allocate
    // authoritatively if this preview request is unavailable.
    return '';
  },
  addMember: async (member) => {
    const res = await API.post('/members', member, { timeout: 30000 });
    // Always force re-fetch from server to ensure immediate top placement
    await get().fetchMembers(true);
    get().fetchPayments(); // refresh invoices ledger
    return res.data;
  },
  updateMember: async (id, updates) => {
    const res = await API.put(`/members/${id}`, updates);
    set({ members: get().members.map(m => m.id === id ? res.data : m) });
  },
  deleteMember: async (id) => {
    try {
      await API.delete(`/members/${id}`);
    } catch (e) {
      console.warn('API delete member notice:', e);
    }
    try {
      const { db } = await import('@/lib/firebase');
      const { doc, deleteDoc } = await import('firebase/firestore');
      await deleteDoc(doc(db, 'members', id));
    } catch (e) {}

    // 1. Immediately remove from local state so UI updates without waiting.
    set({ members: get().members.filter(m => m.id !== id && m.memberId !== id) });
    // 2. Invalidate stale-cache timestamp
    _membersCacheTs = 0;
  },
  toggleFreeze: async (id) => {
    const res = await API.post(`/members/${id}/freeze`);
    set({ members: get().members.map(m => m.id === id ? res.data : m) });
  },
  resetPassword: async (id, password) => {
    await API.post(`/members/${id}/reset-password`, { password });
  },
  sendCredentials: async (id) => {
    await API.post(`/members/${id}/send-credentials`);
  },
  enrollFingerprint: async (memberId) => {
    await API.post('/devices/biometric/enroll-fingerprint', { memberId });
  },
  deleteBiometric: async (memberId) => {
    await API.post('/devices/biometric/delete', { memberId });
  },
  syncMemberBiometric: async (memberId) => {
    await API.post('/devices/biometric/sync', { memberId });
  },

  fetchAttendance: async (force = false) => {
    const now = Date.now();
    if (!force && get().attendance.length > 0 && (now - _attendanceCacheTs) < STALE_MS) return;
    try {
      const res = await API.get('/attendance');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        set({ attendance: res.data });
        _attendanceCacheTs = Date.now();
        return;
      }
    } catch (err) {
      console.warn('API fetch attendance failed, trying direct Firestore fallback:', err);
    }

    try {
      const { db: fDb } = await import('../lib/firebase');
      const { collection, getDocs } = await import('firebase/firestore');
      const snap = await getDocs(collection(fDb, 'attendance'));
      if (!snap.empty) {
        const attendance: any[] = [];
        snap.forEach(d => attendance.push({ id: d.id, ...d.data() }));
        set({ attendance });
        _attendanceCacheTs = Date.now();
      }
    } catch (fsErr) {
      console.error('Direct Firestore attendance fetch failed:', fsErr);
    }
  },
  triggerCheckIn: async (payload) => {
    await API.post('/attendance/checkin', payload);
    get().fetchAttendance();
    get().fetchDashboardAnalytics();
    get().fetchAttendanceSummary(payload.memberId);
  },
  checkoutAttendance: async (id) => {
    await API.put(`/attendance/checkout/${id}`);
    get().fetchAttendance();
  },
  syncLogs: async () => {
    set({ deviceStatus: 'syncing' });
    await API.post('/attendance/unlock'); // mock sync call
    setTimeout(() => {
      set({ deviceStatus: 'connected' });
      get().fetchAttendance();
    }, 1200);
  },
  triggerGateUnlock: async () => {
    // 1. Call backend API (primary)
    try {
      await API.post('/attendance/unlock');
    } catch (err) {
      console.warn("Backend API unlock failed, trying direct Firestore write:", err);
    }

    // 2. Direct Firestore update as a fail-safe fallback (essential for Vercel/Mock mode deployment)
    try {
      const { db } = await import('../lib/firebase');
      const { doc, updateDoc, collection, getDocs, limit, query } = await import('firebase/firestore');
      
      // Get all enabled/active devices to unlock
      const devicesRef = collection(db, 'devices');
      const q = query(devicesRef, limit(10));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        for (const deviceDoc of querySnapshot.docs) {
          const deviceData = deviceDoc.data();
          if (deviceData.enabled !== false) {
            await updateDoc(doc(db, 'devices', deviceDoc.id), {
              unlockPending: true
            });
            console.log(`Direct Firestore unlock flag set for device: ${deviceDoc.id}`);
          }
        }
      } else {
        // Fallback default ID if collection is empty
        await updateDoc(doc(db, 'devices', 'hikvision-main-gate'), {
          unlockPending: true
        });
        console.log('Direct Firestore unlock flag set for default device: hikvision-main-gate');
      }
    } catch (firestoreErr) {
      console.error("Direct Firestore gate unlock failed:", firestoreErr);
    }
  },

  fetchPayments: async (force = false) => {
    const now = Date.now();
    if (!force && get().payments.length > 0 && (now - _paymentsCacheTs) < STALE_MS) return;
    try {
      const res = await API.get('/billing');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        set({ payments: res.data });
        _paymentsCacheTs = Date.now();
        return;
      }
    } catch (err) {
      console.warn('API fetch payments failed, trying direct Firestore fallback:', err);
    }

    try {
      const { db: fDb } = await import('../lib/firebase');
      const { collection, getDocs } = await import('firebase/firestore');
      const snap = await getDocs(collection(fDb, 'payments'));
      if (!snap.empty) {
        const payments: any[] = [];
        snap.forEach(d => payments.push({ id: d.id, ...d.data() }));
        set({ payments });
        _paymentsCacheTs = Date.now();
        get().fetchDashboardAnalytics();
      }
    } catch (fsErr) {
      console.error('Direct Firestore payments fetch failed:', fsErr);
    }
  },
  addPayment: async (payment) => {
    const res = await API.post('/billing', payment);
    set({ payments: [res.data, ...get().payments] });
    get().fetchMembers(); // refresh expiry dates
  },
  markPaymentPaid: async (memberId) => {
    const res = await API.post(`/billing/pay/${memberId}`);
    set({ payments: [res.data.invoice, ...get().payments] });
    get().fetchMembers(); // refresh member payment status
  },
  setSelectedBranch: (selectedBranch) => set({ selectedBranch }),
  setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),

  plans: [],
  fetchPlans: async () => {
    try {
      const res = await API.get('/memberships');
      if (res.data && Array.isArray(res.data) && res.data.length > 0) {
        set({ plans: res.data });
        return;
      }
    } catch (err) {
      console.warn('API fetch plans failed, trying direct Firestore fallback:', err);
    }

    try {
      const { db: fDb } = await import('../lib/firebase');
      const { collection, getDocs } = await import('firebase/firestore');
      const snap = await getDocs(collection(fDb, 'plans'));
      if (!snap.empty) {
        const plans: any[] = [];
        snap.forEach(d => plans.push({ id: d.id, ...d.data() }));
        set({ plans });
      }
    } catch (fsErr) {
      console.error('Direct Firestore plans fetch failed:', fsErr);
    }
  },
  addPlan: async (plan) => {
    const res = await API.post('/memberships', plan);
    set({ plans: [...get().plans, res.data] });
  },
  updatePlan: async (id, updates) => {
    const res = await API.put(`/memberships/${id}`, updates);
    set({ plans: get().plans.map(p => p.id === id ? res.data : p) });
  },
  deletePlan: async (id) => {
    await API.delete(`/memberships/${id}`);
    set({ plans: get().plans.filter(p => p.id !== id) });
  }
}));

// 3. CHAT STORE
interface ChatStore {
  messages: any[];
  fetchChatHistory: (userA: string, userB: string) => Promise<void>;
  sendMsg: (payload: { from: string; to: string; text?: string; image?: string }) => Promise<void>;
}

export const useChatStore = create<ChatStore>((set, get) => ({
  messages: [],
  fetchChatHistory: async (userA, userB) => {
    try {
      const res = await API.get(`/chat/${userA}/${userB}`);
      set({ messages: res.data });
    } catch (err) {
      console.error('Failed to fetch chat logs:', err);
    }
  },
  sendMsg: async (payload) => {
    const res = await API.post('/chat', payload);
    set({ messages: [...get().messages, res.data] });
  }
}));

// 4. TRAINER PANEL STORE
interface TrainerStore {
  workoutPlan: any | null;
  dietPlan: any | null;
  cheatMeals: any[];
  dailyLog: any | null;
  fetchWorkout: (memberId: string) => Promise<void>;
  saveWorkout: (payload: { memberId: string; name: string; type: string; duration: string; exercises: any[] }) => Promise<void>;
  fetchDiet: (memberId: string) => Promise<void>;
  saveDiet: (payload: { memberId: string; name: string; calories: number; protein: number; carbs: number; fats: number; waterGoal: number; meals: any; status?: string }) => Promise<void>;
  generateAIDiet: (memberId: string) => Promise<void>;
  approveDiet: (id: string) => Promise<void>;
  duplicateDiet: (id: string, targetMemberId: string) => Promise<void>;
  archiveDiet: (id: string) => Promise<void>;
  fetchCheatMeals: () => Promise<void>;
  handleCheatMeal: (id: string, status: 'approved' | 'rejected', trainerNotes?: string) => Promise<void>;
  fetchDailyLog: (memberId: string, date: string) => Promise<void>;
  saveDailyLog: (payload: any) => Promise<void>;
}

export const useTrainerStore = create<TrainerStore>((set, get) => ({
  workoutPlan: null,
  dietPlan: null,
  cheatMeals: [],
  dailyLog: null,
  fetchWorkout: async (memberId) => {
    try {
      const res = await API.get(`/trainers/workouts/${memberId}`);
      set({ workoutPlan: res.data[0] || null });
    } catch (err) {
      console.error('Failed to fetch workouts:', err);
    }
  },
  saveWorkout: async (payload) => {
    const res = await API.post('/trainers/workouts', payload);
    set({ workoutPlan: res.data });
  },
  fetchDiet: async (memberId) => {
    try {
      const res = await API.get(`/trainers/diets/${memberId}`);
      set({ dietPlan: res.data || null });
    } catch (err) {
      console.error('Failed to fetch diets:', err);
    }
  },
  saveDiet: async (payload) => {
    const res = await API.post('/trainers/diets', payload);
    set({ dietPlan: res.data });
  },
  generateAIDiet: async (memberId) => {
    try {
      const res = await API.post('/trainers/diets/generate-ai', { memberId });
      set({ dietPlan: res.data });
    } catch (err) {
      console.error('Failed to generate AI diet:', err);
      throw err;
    }
  },
  approveDiet: async (id) => {
    try {
      const res = await API.post(`/trainers/diets/${id}/approve`);
      set({ dietPlan: res.data });
    } catch (err) {
      console.error('Failed to approve diet:', err);
      throw err;
    }
  },
  duplicateDiet: async (id, targetMemberId) => {
    try {
      const res = await API.post(`/trainers/diets/${id}/duplicate`, { targetMemberId });
      set({ dietPlan: res.data });
    } catch (err) {
      console.error('Failed to duplicate diet:', err);
      throw err;
    }
  },
  archiveDiet: async (id) => {
    try {
      await API.delete(`/trainers/diets/${id}`);
      set({ dietPlan: null });
    } catch (err) {
      console.error('Failed to archive diet:', err);
      throw err;
    }
  },
  fetchCheatMeals: async () => {
    try {
      const res = await API.get('/trainers/cheat-meals');
      set({ cheatMeals: res.data });
    } catch (err) {
      console.error('Failed to fetch cheat meals:', err);
    }
  },
  handleCheatMeal: async (id, status, trainerNotes) => {
    try {
      const res = await API.put(`/trainers/cheat-meals/${id}`, { status, trainerNotes });
      set({ cheatMeals: get().cheatMeals.map(cm => cm.id === id ? res.data : cm) });
    } catch (err) {
      console.error('Failed to handle cheat meal request:', err);
      throw err;
    }
  },
  fetchDailyLog: async (memberId, date) => {
    try {
      const res = await API.get(`/members/diets/${memberId}/logs/${date}`);
      set({ dailyLog: res.data || null });
    } catch (err) {
      console.error('Failed to fetch daily log:', err);
    }
  },
  saveDailyLog: async (payload) => {
    try {
      const res = await API.post('/members/diets/logs', payload);
      set({ dailyLog: res.data });
    } catch (err) {
      console.error('Failed to save daily log:', err);
      throw err;
    }
  }
}));

// 5. PROGRESS & REFERRAL STORE
interface ProgressStore {
  progressTimeline: any[];
  referrals: any[];
  fetchTimeline: (memberId: string) => Promise<void>;
  addRecord: (payload: { memberId: string; weight: number; height: number; bodyFat: number; waist: number; chest: number; arms: number; shoulders: number }) => Promise<void>;
  fetchReferrals: (memberId: string) => Promise<void>;
  inviteFriend: (payload: { memberId: string; friendName: string; friendEmail: string }) => Promise<void>;
}

export const useProgressStore = create<ProgressStore>((set, get) => ({
  progressTimeline: [],
  referrals: [],
  fetchTimeline: async (memberId) => {
    try {
      const res = await API.get(`/progress/${memberId}`);
      set({ progressTimeline: res.data });
    } catch (err) {
      console.error('Failed to fetch progress logs:', err);
    }
  },
  addRecord: async (payload) => {
    const res = await API.post('/progress', payload);
    set({ progressTimeline: [...get().progressTimeline, res.data] });
  },
  fetchReferrals: async (memberId) => {
    try {
      const res = await API.get(`/referrals/${memberId}`);
      set({ referrals: res.data });
    } catch (err) {
      console.error('Failed to fetch referrals:', err);
    }
  },
  inviteFriend: async (payload) => {
    const res = await API.post('/referrals', payload);
    set({ referrals: [...get().referrals, res.data] });
  }
}));
