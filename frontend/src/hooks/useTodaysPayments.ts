'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useAuthStore } from '@/store';

import API from '@/services/api';

// ─── IST-aware today string (YYYY-MM-DD in Asia/Kolkata timezone) ───────────
export function getISTDateStr(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export interface PaymentRecord {
  id: string;
  invoice?: string;
  invoiceNumber?: string;
  memberId?: string;
  memberName?: string;
  memberPhone?: string;
  plan?: string;
  amount?: number;
  paid?: number;
  amountPaid?: number;
  pendingAmount?: number;
  status?: string;
  paymentStatus?: string;
  method?: string;
  paymentMethod?: string;
  date?: string;
  paymentDate?: string;
  createdAt?: string;
  isHistorical?: boolean;
  imported?: boolean;
  isLegacyImport?: boolean;
  transactionType?: string;
  isSample?: boolean;
  isMock?: boolean;
  isRealTimeToday?: boolean;
  deleted?: boolean;
  deletedAt?: string;
  deletedBy?: string;
  isDuplicate?: boolean;
  [key: string]: unknown;
}

export interface MethodTotals {
  UPI: { total: number; count: number };
  Cash: { total: number; count: number };
  Card: { total: number; count: number };
  'Net Banking': { total: number; count: number };
}

export interface UseTodaysPaymentsResult {
  /** All non-deleted, non-void payment records from Firestore (live) */
  allPayments: PaymentRecord[];
  /** Only today's (IST) paid, non-deleted, non-historical payments */
  todaysPayments: PaymentRecord[];
  /** Sum of today's paid amounts */
  todaysTotal: number;
  /** Per-method totals for today's payments only */
  todayMethodTotals: MethodTotals;
  /** All-time total revenue (non-deleted paid payments) */
  allTimeTotal: number;
  /** Count of pending/overdue non-deleted payments */
  pendingCount: number;
  /** IST today string (YYYY-MM-DD) */
  todayStr: string;
  /** Whether the Firestore listener is still loading */
  loading: boolean;
  /** Soft-delete a payment. Returns true on success. */
  deletePayment: (payment: PaymentRecord) => Promise<boolean>;
}

/**
 * useTodaysPayments — single source of truth for all financial KPIs.
 *
 * One Firestore onSnapshot listener; IST-correct date; shared by
 * Overview, Dashboard, and Billing pages.
 */
export function useTodaysPayments(): UseTodaysPaymentsResult {
  const { user } = useAuthStore();
  const [rawPayments, setRawPayments] = useState<PaymentRecord[]>([]);
  const [loading, setLoading] = useState(true);

  // Stable IST today string — computed once per mount (refreshes on page load)
  const todayStr = useMemo(() => getISTDateStr(), []);

  // ── Live Firestore listener ───────────────────────────────────────────────
  useEffect(() => {
    let unsub: (() => void) | undefined;

    const fetchFallback = async () => {
      try {
        const res = await API.get('/billing');
        if (Array.isArray(res.data) && res.data.length > 0) {
          setRawPayments(res.data as PaymentRecord[]);
        }
      } catch (e) {
        console.warn('[useTodaysPayments] API fallback failed:', e);
      } finally {
        setLoading(false);
      }
    };

    try {
      unsub = onSnapshot(
        collection(db, 'payments'),
        (snap) => {
          const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentRecord));
          if (docs.length > 0) {
            setRawPayments(docs);
            setLoading(false);
          } else {
            fetchFallback();
          }
        },
        (err) => {
          console.warn('[useTodaysPayments] listener error:', err);
          fetchFallback();
        }
      );
    } catch (err) {
      console.warn('[useTodaysPayments] failed to attach:', err);
      fetchFallback();
    }
    return () => { if (unsub) unsub(); };
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resolveAmount = (p: PaymentRecord): number => {
    const val =
      p.amountPaid !== undefined ? p.amountPaid :
      p.paid      !== undefined ? p.paid :
      (p.amount ?? 0);
    const n = Number(val);
    return isNaN(n) ? 0 : n;
  };

  const resolveMethod = (p: PaymentRecord): keyof MethodTotals => {
    const m = String(p.method || p.paymentMethod || '').toLowerCase();
    if (m.includes('cash')) return 'Cash';
    if (m.includes('card')) return 'Card';
    if (m.includes('net') || m.includes('bank')) return 'Net Banking';
    return 'UPI';
  };

  const isHistoricalPayment = (p: PaymentRecord): boolean =>
    p.isHistorical === true ||
    p.imported === true ||
    p.isLegacyImport === true ||
    p.transactionType === 'historical_import';

  // ── Derived memos ─────────────────────────────────────────────────────────

  // All active (non-deleted, non-void, non-duplicate) payments
  const allPayments = useMemo<PaymentRecord[]>(() =>
    rawPayments.filter((p) =>
      p &&
      p.deleted !== true &&
      p.isDuplicate !== true &&
      (p.status || '').toLowerCase() !== 'void'
    ),
    [rawPayments]
  );

  // Today's valid paid payments (IST date, non-historical, non-sample)
  const todaysPayments = useMemo<PaymentRecord[]>(() => {
    const seen = new Set<string>();
    return allPayments.filter((p) => {
      if (p.isSample || p.isMock) return false;
      if (isHistoricalPayment(p)) return false;

      const status = String(p.status || p.paymentStatus || '').toLowerCase();
      if (status !== 'paid' && status !== 'partial') return false;

      // Strict IST date match — never fall back to createdAt
      const pDate = String(p.paymentDate || p.date || '').split('T')[0];
      if (pDate !== todayStr && !p.isRealTimeToday) return false;

      // Deduplicate by ID
      const key = String(p.id || p.invoice || p.invoiceNumber || '').trim();
      if (key && seen.has(key)) return false;
      if (key) seen.add(key);

      return true;
    });
  }, [allPayments, todayStr]);

  const todaysTotal = useMemo<number>(
    () => todaysPayments.reduce((sum, p) => sum + resolveAmount(p), 0),
    [todaysPayments]
  );

  const todayMethodTotals = useMemo<MethodTotals>(() => {
    const counts: MethodTotals = {
      UPI:           { total: 0, count: 0 },
      Cash:          { total: 0, count: 0 },
      Card:          { total: 0, count: 0 },
      'Net Banking': { total: 0, count: 0 },
    };
    todaysPayments.forEach((p) => {
      const key = resolveMethod(p);
      counts[key].total += resolveAmount(p);
      counts[key].count += 1;
    });
    return counts;
  }, [todaysPayments]);

  const allTimeTotal = useMemo<number>(
    () => allPayments
      .filter((p) => (p.status || '').toLowerCase() === 'paid')
      .reduce((sum, p) => sum + resolveAmount(p), 0),
    [allPayments]
  );

  const pendingCount = useMemo<number>(
    () => allPayments.filter((p) => {
      const s = (p.status || '').toLowerCase();
      return s === 'pending' || s === 'overdue';
    }).length,
    [allPayments]
  );

  // ── Soft Delete ───────────────────────────────────────────────────────────
  const deletePayment = async (payment: PaymentRecord): Promise<boolean> => {
    if (!payment?.id) return false;
    let success = false;

    // 1. Primary: Call Backend API endpoint
    try {
      await API.delete(`/billing/${payment.id}`);
      success = true;
    } catch (err) {
      console.warn('[useTodaysPayments] API delete fallback to Firestore:', err);
    }

    // 2. Fallback: Direct Firestore client update
    try {
      await updateDoc(doc(db, 'payments', payment.id), {
        deleted: true,
        deletedAt: new Date().toISOString(),
        deletedBy: user?.uid || user?.email || 'unknown',
      });
      success = true;
    } catch (err) {
      console.warn('[useTodaysPayments] Firestore client delete warning:', err);
    }

    // Optimistically update local rawPayments state
    if (success) {
      setRawPayments(prev => prev.filter(p => p.id !== payment.id && p.invoiceNumber !== payment.invoiceNumber && p.invoice !== payment.invoice));
    }

    return success;
  };

  return {
    allPayments,
    todaysPayments,
    todaysTotal,
    todayMethodTotals,
    allTimeTotal,
    pendingCount,
    todayStr,
    loading,
    deletePayment,
  };
}
