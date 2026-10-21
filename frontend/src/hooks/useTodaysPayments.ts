'use client';

import { useState, useEffect, useMemo } from 'react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { useAuthStore } from '@/store';
import { migrateMissingBillingPhones } from '@/lib/migrations/migrateBillingPhones';

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

/**
 * Safely normalizes any date representation (Date, ISO string, YYYY-MM-DD, Timestamp)
 * into a canonical YYYY-MM-DD date string in Asia/Kolkata (IST) timezone.
 */
export function getCanonicalISTDate(rawDate?: unknown): string {
  if (!rawDate) return getISTDateStr();

  try {
    // 1. Handle Firestore Timestamp
    if (typeof rawDate === 'object' && rawDate !== null && 'toDate' in rawDate && typeof (rawDate as any).toDate === 'function') {
      return getISTDateStr((rawDate as any).toDate());
    }

    // 2. Handle JS Date
    if (rawDate instanceof Date) {
      return isNaN(rawDate.getTime()) ? getISTDateStr() : getISTDateStr(rawDate);
    }

    const str = String(rawDate).trim();
    if (!str) return getISTDateStr();

    // 3. Handle ISO string (e.g. 2026-09-16T14:25:42.484Z)
    if (str.includes('T')) {
      const parsed = new Date(str);
      if (!isNaN(parsed.getTime())) {
        return getISTDateStr(parsed);
      }
    }

    // 4. Handle standard YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      return str;
    }

    // 5. Handle DD/MM/YYYY or DD-MM-YYYY
    const ddmmyyyyMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (ddmmyyyyMatch) {
      const [, day, month, year] = ddmmyyyyMatch;
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }

    // 6. Fallback Date parsing
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return getISTDateStr(parsed);
    }
  } catch (err) {
    console.warn('[getCanonicalISTDate] Date parse fallback notice:', err);
  }

  return getISTDateStr();
}

/** Canonical IST date (YYYY-MM-DD) for a payment's date field. */
export function getPaymentDateStr(rawDate?: unknown): string {
  return getCanonicalISTDate(rawDate);
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
  transactionDate?: string;
  transactionTime?: string;
  date?: string;
  paymentDate?: string;
  time?: string;
  paymentTime?: string;
  createdAt?: string;
  updatedAt?: string;
  editedBy?: string;
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
  /** Update transaction date and time for a payment record. */
  updatePaymentDateTime: (paymentId: string, transactionDate: string, transactionTime: string) => Promise<boolean>;
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

  // ── Live Firestore listener & API fallback ──────────────
  useEffect(() => {
    let isMounted = true;

    // Background migration for phone numbers
    migrateMissingBillingPhones().catch((err) => {
      console.warn('[useTodaysPayments] background phone migration notice:', err);
    });

    const fetchApiFallback = async () => {
      try {
        const res = await API.get('/billing');
        if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
          const apiDocs = res.data as PaymentRecord[];
          setRawPayments((prev) => {
            if (prev.length === 0) return apiDocs;
            const map = new Map<string, PaymentRecord>();
            prev.forEach(d => { if (d.id) map.set(d.id, d); });
            apiDocs.forEach(d => { if (d.id && !map.has(d.id)) map.set(d.id, d); });
            return Array.from(map.values());
          });
          setLoading(false);
        }
      } catch (e) {
        try {
          const res2 = await API.get('/payments');
          if (isMounted && Array.isArray(res2.data) && res2.data.length > 0) {
            setRawPayments(res2.data as PaymentRecord[]);
          }
        } catch (_) {}
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    // Always fetch via API on mount to guarantee server Admin SDK access
    fetchApiFallback();

    let unsub: (() => void) | undefined;
    try {
      unsub = onSnapshot(
        collection(db, 'payments'),
        (snap) => {
          if (!isMounted) return;
          const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PaymentRecord));
          if (docs.length > 0) {
            setRawPayments(docs);
          } else {
            fetchApiFallback();
          }
          setLoading(false);
        },
        (err) => {
          console.warn('[useTodaysPayments] listener notice, using API fallback:', err);
          fetchApiFallback();
        }
      );
    } catch (err) {
      console.warn('[useTodaysPayments] failed to attach listener, using API fallback:', err);
      fetchApiFallback();
    }
    return () => {
      isMounted = false;
      if (unsub) unsub();
    };
  }, []);

  // ── Helpers ───────────────────────────────────────────────────────────────
  const resolveAmount = (p: PaymentRecord): number => {
    if (p.isUpgrade || p.transactionType === 'membership_upgrade') {
      const val = p.additionalAmountPaid !== undefined
        ? p.additionalAmountPaid
        : (p.amountPaid !== undefined ? p.amountPaid : 0);
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    }
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

  // All active, explicitly recorded payments. Never infer an invoice from member dates or balance fields.
  const allPayments = useMemo<PaymentRecord[]>(() => {
    const validRaw = rawPayments.filter((p) =>
      p &&
      p.deleted !== true &&
      p.isDuplicate !== true &&
      (p.status || '').toLowerCase() !== 'void'
    );

    const map = new Map<string, PaymentRecord>();
    validRaw.forEach((p) => {
      const key = String(p.id || p.invoice || p.invoiceNumber || '').trim();
      if (key) map.set(key, p);
    });

    return Array.from(map.values());
  }, [rawPayments]);

  // Today's valid paid payments (IST transactionDate, non-historical, non-sample)
  const todaysPayments = useMemo<PaymentRecord[]>(() => {
    const seen = new Set<string>();
    return allPayments.filter((p) => {
      if (p.isSample || p.isMock) return false;
      if (isHistoricalPayment(p)) return false;

      const status = String(p.status || p.paymentStatus || '').toLowerCase();
      if (status !== 'paid' && status !== 'partial') return false;

      // Strict IST date match on canonical payment date using IST parser
      const pDate = getCanonicalISTDate(p.paymentDate || p.invoiceDate || p.billingDate || p.date || p.transactionDate || p.createdAt);
      if (pDate !== todayStr) return false;

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
    const targetId = payment.id;
    let success = false;

    // 1. Try REST API endpoint (Server Admin SDK bypasses client permissions)
    try {
      await API.delete(`/billing/${encodeURIComponent(targetId)}`);
      success = true;
    } catch (apiErr) {
      try {
        await API.delete(`/payments/${encodeURIComponent(targetId)}`);
        success = true;
      } catch (_) {}
    }

    // 2. Client-side Firestore fallback if API is not reachable
    if (!success) {
      try {
        await updateDoc(doc(db, 'payments', targetId), {
          deleted: true,
          deletedAt: new Date().toISOString(),
          deletedBy: user?.uid || user?.email || 'unknown',
        });
        success = true;
      } catch (err) {
        console.error('[useTodaysPayments] deletePayment client fallback failed:', err);
      }
    }

    // 3. Optimistically remove from state so the payment disappears immediately in UI
    if (success) {
      setRawPayments((prev) => prev.filter((p) => p.id !== targetId));
    }

    return success;
  };

  // ── Update Payment Date & Time ─────────────────────────────────────────────
  const updatePaymentDateTime = async (paymentId: string, transactionDate: string, transactionTime: string): Promise<boolean> => {
    if (!paymentId || !transactionDate) return false;
    try {
      await updateDoc(doc(db, 'payments', paymentId), {
        invoiceDate: transactionDate,
        billingDate: transactionDate,
        date: transactionDate,
        paymentDate: transactionDate,
        transactionDate: transactionDate,
        transactionTime: transactionTime || '12:00 PM',
        paymentTime: transactionTime || '12:00 PM',
        time: transactionTime || '12:00 PM',
        updatedAt: new Date().toISOString(),
        editedBy: user?.uid || user?.email || 'admin',
      });
      return true;
    } catch (err) {
      console.error('[useTodaysPayments] updatePaymentDateTime failed:', err);
      return false;
    }
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
    updatePaymentDateTime,
  };
}

/**
 * Centralized, canonical calculation of Today's Collection KPI.
 * Takes array of payment records and returns total collected money today.
 */
export function calculateTodaysCollection(payments: PaymentRecord[], gymTimezone = 'Asia/Kolkata'): number {
  const todayStr = getISTDateStr();
  const seen = new Set<string>();

  return (payments || []).reduce((sum, p) => {
    if (!p || p.isSample || p.isMock || p.deleted || p.isDuplicate) return sum;
    if (p.isHistorical === true || p.imported === true || p.isLegacyImport === true || p.transactionType === 'historical_import') return sum;

    const status = String(p.status || p.paymentStatus || '').toLowerCase();
    if (status !== 'paid' && status !== 'partial') return sum;

    const pDate = getCanonicalISTDate(p.paymentDate || p.invoiceDate || p.billingDate || p.date || p.transactionDate || p.createdAt);
    if (pDate !== todayStr) return sum;

    const key = String(p.id || p.invoice || p.invoiceNumber || '').trim();
    if (key && seen.has(key)) return sum;
    if (key) seen.add(key);

    const val = p.amountPaid !== undefined ? p.amountPaid : (p.paid !== undefined ? p.paid : (p.amount ?? 0));
    const num = Number(val);
    return sum + (isNaN(num) ? 0 : num);
  }, 0);
}

