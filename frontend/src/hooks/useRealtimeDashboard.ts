// ============================================================
// frontend/src/hooks/useRealtimeDashboard.ts
//
// Real-Time Dashboard Engine — Firestore onSnapshot listeners
// All data updates instantly without page refresh.
//
// ⚡ Uses Firestore when Firebase is configured.
// 📡 Falls back to REST API when Firebase is not yet set up.
// ============================================================

'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import {
  collection, onSnapshot, query, where,
  orderBy, limit, Timestamp, getDocs
} from 'firebase/firestore';
import { db, isFirebaseReady } from '@/lib/firebase';
import API from '@/services/api';
import toast from '@/lib/toast';
import { useGymStore } from '@/store';

export interface LiveActivity {
  id: string;
  type: 'entry' | 'exit' | 'payment' | 'register' | 'trainer';
  msg: string;
  time: string;
  memberName?: string;
  branch?: string;
}

export interface DashboardMetrics {
  // Occupancy
  membersInside: number;
  todayAttendance: number;

  // Revenue
  todayRevenue: number;
  monthRevenue: number;
  yearRevenue: number;
  pendingRevenue: number;

  // Members
  totalMembers: number;
  activeMembers: number;
  expiringMembers: number;  // expiring within 30 days
  expiredMembers: number;

  // Activity
  recentActivity: LiveActivity[];

  // Device
  esslOnline: boolean;
  lastSync: string | null;

  // Notifications
  unreadNotifications: number;
}

const EMPTY_METRICS: DashboardMetrics = {
  membersInside: 0,
  todayAttendance: 0,
  todayRevenue: 0,
  monthRevenue: 0,
  yearRevenue: 0,
  pendingRevenue: 0,
  totalMembers: 0,
  activeMembers: 0,
  expiringMembers: 0,
  expiredMembers: 0,
  recentActivity: [],
  esslOnline: false,
  lastSync: null,
  unreadNotifications: 0,
};

// ─── Helper: format timestamp ────────────────────────────────
function formatTime(ts: any): string {
  if (!ts) return '';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

function isToday(ts: any): boolean {
  if (!ts) return false;
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const today = new Date();
  return (
    date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear()
  );
}

function isThisMonth(ts: any): boolean {
  if (!ts) return false;
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  const today = new Date();
  return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
}

function isThisYear(ts: any): boolean {
  if (!ts) return false;
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  return date.getFullYear() === new Date().getFullYear();
}

function daysUntil(dateStr: string): number {
  const exp = new Date(dateStr);
  const now = new Date();
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Main Hook ────────────────────────────────────────────────
export function useRealtimeDashboard() {
  const [metrics, setMetrics] = useState<DashboardMetrics>(EMPTY_METRICS);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<'firebase' | 'api' | 'none'>('none');
  const lastNotifIdRef = useRef<string>('');

  // ── FIREBASE PATH ──────────────────────────────────────────
  useEffect(() => {
    if (!isFirebaseReady || !db) return;

    setSource('firebase');
    const unsubs: (() => void)[] = [];
    let attendance: any[] = [];
    let payments: any[] = [];
    let members: any[] = [];

    const recalculate = () => {
      const today = new Date();
      const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Occupancy (Unique members inside)
      const uniqueInside = new Set<string>();
      attendance.forEach(a => {
        if (a.checkOut || !a.checkIn || !a.memberId) return;
        const checkInDate = a.checkIn?.toDate ? a.checkIn.toDate() : new Date(a.checkIn);
        if ((Date.now() - checkInDate.getTime()) < 3600000) {
          uniqueInside.add(a.memberId);
        }
      });
      const membersInside = uniqueInside.size;
      const todayAttendance = attendance.filter(a => isToday(a.checkIn)).length;

      // Revenue
      const isHist = (p: any) => p.isHistorical === true || p.imported === true || p.isLegacyImport === true || p.transactionType === 'historical_import';
      const todayRevenue = payments
        .filter(p => p.status === 'paid' && !isHist(p) && isToday(p.paymentDate || p.date))
        .reduce((s, p) => s + (p.amount || 0), 0);
      const monthRevenue = payments
        .filter(p => p.status === 'paid' && isThisMonth(p.paymentDate || p.date || p.createdAt))
        .reduce((s, p) => s + (p.amount || 0), 0);
      const yearRevenue = payments
        .filter(p => p.status === 'paid' && isThisYear(p.paymentDate || p.date || p.createdAt))
        .reduce((s, p) => s + (p.amount || 0), 0);
      const pendingRevenue = payments
        .filter(p => p.status === 'overdue' || p.status === 'pending')
        .reduce((s, p) => s + (p.amount || 0), 0);

      // Members
      const totalMembers = members.length;
      const activeMembers = members.filter(m => m.status === 'active').length;
      const expiringMembers = members.filter(m => {
        const d = daysUntil(m.expiryDate || '');
        return d >= 0 && d <= 30;
      }).length;
      const expiredMembers = members.filter(m => m.status === 'expired' || daysUntil(m.expiryDate || '') < 0).length;

      // Activity feed from recent attendance
      const recentActivity: LiveActivity[] = attendance
        .sort((a, b) => {
          const ta = a.checkIn?.toDate ? a.checkIn.toDate() : new Date(a.checkIn || 0);
          const tb = b.checkIn?.toDate ? b.checkIn.toDate() : new Date(b.checkIn || 0);
          return tb.getTime() - ta.getTime();
        })
        .slice(0, 10)
        .map(a => ({
          id: a.id,
          type: a.checkOut ? 'exit' : 'entry',
          msg: a.checkOut
            ? `${a.memberName || 'Member'} checked out`
            : `${a.memberName || 'Member'} checked in — ${a.branch || ''} ${a.method ? `(${a.method})` : ''}`.trim(),
          time: formatTime(a.checkIn),
          memberName: a.memberName,
          branch: a.branch,
        }));

      setMetrics(prev => ({
        ...prev,
        membersInside, todayAttendance,
        todayRevenue, monthRevenue, yearRevenue, pendingRevenue,
        totalMembers, activeMembers, expiringMembers, expiredMembers,
        recentActivity,
        esslOnline: false, lastSync: null,
      }));
      setIsLoading(false);
    };

    // onSnapshot: attendance (today's records)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const attQ = query(
      collection(db, 'attendance'),
      where('checkIn', '>=', Timestamp.fromDate(todayStart)),
      orderBy('checkIn', 'desc'),
      limit(100)
    );
    unsubs.push(onSnapshot(attQ, snap => {
      attendance = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      recalculate();
    }, err => {
      console.warn("Firestore realtime dashboard attendance query error:", err);
    }));

    // onSnapshot: payments — limit to recent / this month for dashboard revenue stats
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const payQ = query(
      collection(db, 'payments'),
      where('createdAt', '>=', startOfMonth.toISOString().split('T')[0]),
      limit(100)
    );
    unsubs.push(onSnapshot(payQ, snap => {
      payments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      recalculate();
    }, err => {
      console.warn("Firestore realtime dashboard payments query error:", err);
      // Fallback: use store payments if listener has indexing/permission issue
      payments = useGymStore.getState().payments || [];
      recalculate();
    }));

    // For members, derive stats from useGymStore instead of full-collection onSnapshot
    const syncMembersFromStore = () => {
      const storeMembers = useGymStore.getState().members;
      if (storeMembers && storeMembers.length > 0) {
        members = storeMembers;
        recalculate();
      }
    };
    syncMembersFromStore();
    const unsubStore = useGymStore.subscribe((state: any) => {
      if (state.members !== members && state.members.length > 0) {
        members = state.members;
        recalculate();
      }
    });
    unsubs.push(unsubStore);

    // onSnapshot: notifications — show toast for new checkin/alert events
    const notifQ = query(
      collection(db, 'notifications'),
      orderBy('timestamp', 'desc'),
      limit(20)
    );
    unsubs.push(onSnapshot(notifQ, snap => {
      const unread = snap.docs.filter(d => !d.data().read).length;
      setMetrics(prev => ({ ...prev, unreadNotifications: unread }));

      // Show toast for brand-new notifications (added after mount)
      snap.docChanges().forEach(change => {
        if (change.type !== 'added') return;
        const data = change.doc.data();
        const docId = change.doc.id;
        if (docId === lastNotifIdRef.current) return;

        // Only fire for very recent notifications (within 30s)
        const ts = data.timestamp ? new Date(data.timestamp).getTime() : 0;
        if (Date.now() - ts > 30000) return;

        lastNotifIdRef.current = docId;
        const type = data.type || '';
        const title = data.title || 'Notification';
        const body = data.body || '';

        if (type === 'checkin') {
          toast.success(`${title}\n${body}`, {
            duration: 5000,
            style: { background: '#0a0a0f', color: '#fff', border: '1px solid #22c55e40', borderRadius: '16px', fontSize: '12px' }
          });
        } else if (type === 'alert') {
          toast(body || title, {
            icon: '⚠️',
            duration: 6000,
            style: { background: '#0a0a0f', color: '#fff', border: '1px solid #f59e0b40', borderRadius: '16px', fontSize: '12px' }
          });
        } else if (type === 'enrollment') {
          toast.success(body || title, {
            duration: 5000,
            style: { background: '#0a0a0f', color: '#fff', border: '1px solid #a855f740', borderRadius: '16px', fontSize: '12px' }
          });
        } else if (type === 'enrollment_error') {
          toast.error(body || title, {
            duration: 6000,
            style: { background: '#0a0a0f', color: '#fff', border: '1px solid #ef444440', borderRadius: '16px', fontSize: '12px' }
          });
        }
      });
    }, err => {
      console.warn("Firestore realtime dashboard notifications query error:", err);
    }));

    return () => unsubs.forEach(u => u());
  }, []);

  // ── REST API FALLBACK (when Firebase not configured) ───────
  useEffect(() => {
    if (isFirebaseReady) return;

    setSource('api');
    let cancelled = false;

    const load = async () => {
      try {
        const [att, pay, mem] = await Promise.all([
          API.get('/attendance').then(r => r.data),
          API.get('/payments').then(r => r.data),
          API.get('/members').then(r => r.data),
        ]);

        if (cancelled) return;

        const today = new Date().toISOString().split('T')[0];
        const thisMonth = new Date().getMonth();
        const thisYear = new Date().getFullYear();

        const parseCheckIn = (checkIn: any): Date | null => {
          if (!checkIn) return null;
          if (typeof checkIn === 'string') {
            const d = new Date(checkIn);
            return isNaN(d.getTime()) ? null : d;
          }
          if (typeof checkIn.toDate === 'function') {
            return checkIn.toDate();
          }
          if (checkIn.seconds !== undefined) return new Date(checkIn.seconds * 1000);
          if (checkIn._seconds !== undefined) return new Date(checkIn._seconds * 1000);
          const d = new Date(checkIn);
          return isNaN(d.getTime()) ? null : d;
        };

        const getCheckInStr = (checkIn: any): string => {
          const d = parseCheckIn(checkIn);
          return d ? d.toISOString() : '';
        };

        const oneHourAgo = Date.now() - 3600000;
        const uniqueInside = new Set<string>();
        att.forEach((a: any) => {
          if (a.checkOut || !a.checkIn || !a.memberId) return;
          const d = parseCheckIn(a.checkIn);
          const checkInTime = d ? d.getTime() : NaN;
          if (!isNaN(checkInTime) && checkInTime > oneHourAgo) {
            uniqueInside.add(a.memberId);
          }
        });
        const membersInside = uniqueInside.size;
        
        const todayAttendance = att.filter((a: any) => {
          const str = getCheckInStr(a.checkIn);
          return str && str.startsWith(today);
        }).length;
        
        const todayRevenue = pay.filter((p: any) => p.date?.startsWith(today) && p.status === 'paid').reduce((s: number, p: any) => s + p.amount, 0);
        const monthRevenue = pay.filter((p: any) => new Date(p.date || '').getMonth() === thisMonth && p.status === 'paid').reduce((s: number, p: any) => s + p.amount, 0);
        const yearRevenue = pay.filter((p: any) => new Date(p.date || '').getFullYear() === thisYear && p.status === 'paid').reduce((s: number, p: any) => s + p.amount, 0);
        const pendingRevenue = pay.filter((p: any) => p.status === 'overdue' || p.status === 'pending').reduce((s: number, p: any) => s + p.amount, 0);

        const recentActivity: LiveActivity[] = att.slice(0, 10).map((a: any) => {
          const d = parseCheckIn(a.checkIn);
          return {
            id: a.id,
            type: a.checkOut ? 'exit' : 'entry',
            msg: a.checkOut
              ? `${a.memberName || 'Member'} checked out`
              : `${a.memberName || 'Member'} checked in via ${a.method || 'Biometric'}`,
            time: d ? d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '',
            memberName: a.memberName,
            branch: a.branch,
          };
        });

        setMetrics(prev => ({
          ...prev,
          membersInside, todayAttendance,
          todayRevenue, monthRevenue, yearRevenue, pendingRevenue,
          totalMembers: mem.length,
          activeMembers: mem.filter((m: any) => m.status === 'active').length,
          expiringMembers: mem.filter((m: any) => daysUntil(m.expiryDate || '') >= 0 && daysUntil(m.expiryDate || '') <= 30).length,
          expiredMembers: mem.filter((m: any) => m.status === 'expired').length,
          recentActivity,
          esslOnline: false, lastSync: null,
        }));
        setIsLoading(false);
      } catch {
        setIsLoading(false);
      }
    };

    load();
    // Poll every 30s as fallback when no real-time listener
    const interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

  return { metrics, isLoading, source };
}
