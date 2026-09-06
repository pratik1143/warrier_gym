'use client';

import React, { useMemo } from 'react';
import { Users, CheckCircle2, Clock, Activity, IndianRupee } from 'lucide-react';
import { useGymStore } from '@/store';
import { SYSTEM_CONFIG } from '@/config/system';
import { useTodaysPayments } from '@/hooks/useTodaysPayments';

export default function MembersKPI() {
  const { members, attendance } = useGymStore();

  // Live payment data — single source of truth (same Firestore listener as Billing/Overview/Dashboard)
  const { allPayments } = useTodaysPayments();

  const stats = useMemo(() => {
    // Current date in Asia/Kolkata timezone
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: SYSTEM_CONFIG.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayStr = formatter.format(now); // e.g. "2026-08-23"
    const currentYearMonth = todayStr.substring(0, 7); // e.g. "2026-08"

    let expiringThisMonth = 0;
    let ptMembers = 0;

    (members || []).forEach((m: any) => {
      // Calculate expiring this month
      if (m.expiryDate) {
        const expStr = String(m.expiryDate).includes('T') ? m.expiryDate.split('T')[0] : m.expiryDate;
        if (expStr.startsWith(currentYearMonth)) {
          expiringThisMonth++;
        }
      }

      // Calculate PT members
      const hasTrainer = m.trainer && String(m.trainer).trim() !== '' && !String(m.trainer).toLowerCase().includes('unassigned');
      const isPTPlan = m.plan && (m.plan.includes('PT') || m.plan.includes('Personal Training'));
      if (hasTrainer || isPTPlan || m.isPT) {
        ptMembers++;
      }
    });

    // Calculate unique members who punched today
    const todayPunches = new Set<string>();
    const attendanceLogs = attendance || [];
    attendanceLogs.forEach((log: any) => {
      if (!log) return;
      const checkInStr = String(log.checkIn || log.timestamp || log.createdAt || '');
      const checkInYMD = checkInStr.includes('T') ? checkInStr.split('T')[0] : checkInStr;
      if (checkInYMD === todayStr) {
        const mKey = log.memberId || log.biometricId || log.memberName;
        if (mKey && String(mKey).trim()) {
          todayPunches.add(String(mKey).trim());
        }
      }
    });

    // Calculate REAL REVENUE THIS MONTH from live Firestore payment transactions.
    // Uses allPayments from useTodaysPayments hook — same Firestore listener as Billing/Overview.
    // Excludes: deleted, historical/imported, void, non-paid, outside current IST month.
    const seenPaymentKeys = new Set<string>();
    let revenueThisMonth = 0;

    (allPayments || []).forEach((p: any) => {
      if (!p || p.isSample || p.isMock) return;
      // deleted filter is already applied in allPayments (hook filters deleted !== true)

      // Exclude historical imported records from current month revenue
      const isHist = p.isHistorical === true || p.imported === true || p.isLegacyImport === true || p.transactionType === 'historical_import';
      if (isHist) return;

      const status = String(p.status || p.paymentStatus || 'paid').toLowerCase();
      if (status !== 'paid' && status !== 'partial') return;

      // Payment date must fall within current IST calendar month
      const pDate = String(p.paymentDate || p.date || '').split('T')[0];
      if (!pDate || !pDate.startsWith(currentYearMonth) || pDate > todayStr) return;

      const key = String(p.id || p.paymentId || p.invoiceNumber || p.invoice || p.idempotencyKey || '').trim();
      if (key && seenPaymentKeys.has(key)) return;
      if (key) seenPaymentKeys.add(key);

      const val = Number(p.amountPaid !== undefined ? p.amountPaid : (p.paid !== undefined ? p.paid : (p.amount || 0)));
      revenueThisMonth += (isNaN(val) ? 0 : val);
    });

    return {
      total: (members || []).length,
      activeToday: todayPunches.size,
      expiring: expiringThisMonth,
      pt: ptMembers,
      revenue: revenueThisMonth
    };
  }, [members, attendance, allPayments]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {/* 1. Total Members */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-[#FED7AA] flex flex-col justify-between hover:border-[#EA580C] transition-all">
        <div className="flex justify-between items-start">
          <span className="text-xs font-semibold text-slate-500">Total Members</span>
          <div className="w-8 h-8 rounded-full bg-[#FFF7ED] flex items-center justify-center text-[#EA580C]">
            <Users size={14} strokeWidth={2.5} />
          </div>
        </div>
        <div className="mt-2">
          <h3 className="text-2xl font-black text-[#10233f]">{stats.total}</h3>
          <p className="text-[10px] font-bold text-[#EA580C] mt-1 flex items-center gap-1">
            <span>Roster registered</span>
          </p>
        </div>
        <div className="mt-4 h-6 w-full opacity-60">
          <svg viewBox="0 0 100 20" className="w-full h-full preserve-aspect-ratio-none">
            <path d="M0,15 Q20,5 40,15 T80,10 T100,5" fill="none" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* 2. Active Today */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-[#FED7AA] flex flex-col justify-between hover:border-[#EA580C] transition-all">
        <div className="flex justify-between items-start">
          <span className="text-xs font-semibold text-slate-500">Active Today</span>
          <div className="w-8 h-8 rounded-full bg-[#FFF7ED] flex items-center justify-center text-[#EA580C]">
            <CheckCircle2 size={14} strokeWidth={2.5} />
          </div>
        </div>
        <div className="mt-2">
          <h3 className="text-2xl font-black text-[#10233f]">{stats.activeToday}</h3>
          <p className="text-[10px] font-bold text-emerald-600 mt-1 flex items-center gap-1">
            <span>Punched in today</span>
          </p>
        </div>
        <div className="mt-4 h-6 w-full opacity-60">
          <svg viewBox="0 0 100 20" className="w-full h-full preserve-aspect-ratio-none">
            <path d="M0,15 Q20,10 40,15 T80,5 T100,10" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* 3. Expiring This Month */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-[#FED7AA] flex flex-col justify-between hover:border-[#EA580C] transition-all">
        <div className="flex justify-between items-start">
          <span className="text-xs font-semibold text-slate-500">Expiring This Month</span>
          <div className="w-8 h-8 rounded-full bg-[#FFF7ED] flex items-center justify-center text-[#EA580C]">
            <Clock size={14} strokeWidth={2.5} />
          </div>
        </div>
        <div className="mt-2">
          <h3 className="text-2xl font-black text-[#10233f]">{stats.expiring}</h3>
          <p className="text-[10px] font-bold text-amber-600 mt-1 flex items-center gap-1">
            <span>Requires renewal</span>
          </p>
        </div>
        <div className="mt-4 h-6 w-full opacity-60">
          <svg viewBox="0 0 100 20" className="w-full h-full preserve-aspect-ratio-none">
            <path d="M0,10 Q20,15 40,5 T80,15 T100,10" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* 4. PT Members */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-[#FED7AA] flex flex-col justify-between hover:border-[#EA580C] transition-all">
        <div className="flex justify-between items-start">
          <span className="text-xs font-semibold text-slate-500">PT Members</span>
          <div className="w-8 h-8 rounded-full bg-[#FFF7ED] flex items-center justify-center text-[#EA580C]">
            <Activity size={14} strokeWidth={2.5} />
          </div>
        </div>
        <div className="mt-2">
          <h3 className="text-2xl font-black text-[#10233f]">{stats.pt}</h3>
          <p className="text-[10px] font-bold text-[#EA580C] mt-1 flex items-center gap-1">
            <span>Personal training</span>
          </p>
        </div>
        <div className="mt-4 h-6 w-full opacity-60">
          <svg viewBox="0 0 100 20" className="w-full h-full preserve-aspect-ratio-none">
            <path d="M0,15 Q20,5 40,15 T80,10 T100,5" fill="none" stroke="#EA580C" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* 5. Revenue This Month */}
      <div className="bg-white rounded-2xl p-5 shadow-xs border border-[#FED7AA] flex flex-col justify-between hover:border-[#EA580C] transition-all">
        <div className="flex justify-between items-start">
          <span className="text-xs font-semibold text-slate-500">Revenue This Month</span>
          <div className="w-8 h-8 rounded-full bg-[#FFF7ED] flex items-center justify-center text-[#EA580C]">
            <IndianRupee size={14} strokeWidth={2.5} />
          </div>
        </div>
        <div className="mt-2">
          <h3 className="text-2xl font-black text-[#10233f]">₹{stats.revenue.toLocaleString('en-IN')}</h3>
          <p className="text-[10px] font-bold text-emerald-600 mt-1 flex items-center gap-1">
            <span>Actual payments collected this month</span>
          </p>
        </div>
        <div className="mt-4 h-6 w-full opacity-60">
          <svg viewBox="0 0 100 20" className="w-full h-full preserve-aspect-ratio-none">
            <path d="M0,15 Q20,10 40,15 T80,5 T100,10" fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  );
}
