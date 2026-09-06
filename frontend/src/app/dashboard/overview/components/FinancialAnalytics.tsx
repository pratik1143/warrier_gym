"use client";

import React, { useMemo } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useGymStore } from "@/store";
import { IndianRupee } from "lucide-react";
import { SYSTEM_START_DATE, SYSTEM_CONFIG } from "@/config/system";

interface FinancialAnalyticsProps {
  fromDate?: string;
  toDate?: string;
  dateRangeTitle?: string;
  payments?: any[];
}

export default function FinancialAnalytics({ fromDate, toDate, dateRangeTitle, payments: propPayments }: FinancialAnalyticsProps) {
  const { payments: storePayments } = useGymStore();
  const payments = propPayments || storePayments;

  const todayStr = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: SYSTEM_CONFIG.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date());
  }, []);

  const chartData = useMemo(() => {
    // Generate dates within range (up to 30 days max for readability)
    const end = toDate || todayStr;
    const start = fromDate || todayStr;
    
    // Parse start and end dates
    const startDateObj = new Date(start);
    const endDateObj = new Date(end);

    const datesList: string[] = [];
    const curr = new Date(startDateObj);
    
    while (curr <= endDateObj && datesList.length <= 31) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      datesList.push(`${y}-${m}-${d}`);
      curr.setDate(curr.getDate() + 1);
    }

    if (datesList.length === 0) {
      datesList.push(todayStr);
    }

    const seenPaymentKeys = new Set<string>();

    return datesList.map(dateStr => {
      // If date is before SYSTEM_START_DATE, there is NO system revenue
      if (dateStr < SYSTEM_START_DATE || dateStr > todayStr) {
        const dObj = new Date(dateStr);
        return {
          name: dObj.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
          date: dateStr,
          Membership: 0,
          PT: 0,
          Total: 0
        };
      }

      const dayPayments = payments.filter((p: any) => {
        if (!p || p.isSample || p.isMock) return false;
        const isHist = p.isHistorical === true || p.imported === true || p.isLegacyImport === true || p.transactionType === 'historical_import';
        if (isHist) return false;

        const status = String(p.status || p.paymentStatus || 'paid').toLowerCase();
        if (status !== 'paid' && status !== 'partial') return false;

        const pDate = String(p.paymentDate || p.date || '').split('T')[0];
        if (pDate !== dateStr) return false;

        const key = String(p.id || p.paymentId || p.invoiceNumber || p.invoice || p.idempotencyKey || '').trim();
        if (key && seenPaymentKeys.has(key)) return false;
        if (key) seenPaymentKeys.add(key);

        return true;
      });

      const membership = dayPayments
        .filter(p => !p.isPT && p.billingType !== 'PT' && p.packageType !== 'PT' && p.invoiceType !== 'PT' && p.transactionType !== 'pt_payment')
        .reduce((acc, curr) => acc + (Number(curr.amountPaid !== undefined ? curr.amountPaid : (curr.paid !== undefined ? curr.paid : (curr.amount || 0))) || 0), 0);

      const pt = dayPayments
        .filter(p => p.isPT || p.billingType === 'PT' || p.packageType === 'PT' || p.invoiceType === 'PT' || p.transactionType === 'pt_payment')
        .reduce((acc, curr) => acc + (Number(curr.amountPaid !== undefined ? curr.amountPaid : (curr.paid !== undefined ? curr.paid : (curr.amount || 0))) || 0), 0);

      const dObj = new Date(dateStr);
      return {
        name: dObj.toLocaleDateString("en-IN", { month: "short", day: "numeric" }),
        date: dateStr,
        Membership: membership,
        PT: pt,
        Total: membership + pt
      };
    });
  }, [payments, fromDate, toDate, todayStr]);

  const totalPeriodRevenue = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.Total, 0);
  }, [chartData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl border border-slate-700/50">
          <p className="font-bold text-xs text-slate-400 mb-2">{label}</p>
          <p className="text-sm font-black text-indigo-400">Membership: ₹{payload[0]?.value?.toLocaleString('en-IN')}</p>
          <p className="text-sm font-black text-purple-400">PT: ₹{payload[1]?.value?.toLocaleString('en-IN')}</p>
          <div className="h-px bg-slate-700 my-2"></div>
          <p className="text-sm font-black text-emerald-400">Total: ₹{(payload[0]?.value + payload[1]?.value)?.toLocaleString('en-IN')}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 relative">
      <div className="absolute top-0 left-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl opacity-50 -z-10 pointer-events-none" />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-8">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            Financial Analytics
          </h2>
          <p className="text-xs text-slate-500 font-medium">
            Real collections for {dateRangeTitle || 'Selected Period'} (Starting 23-Aug-2026)
          </p>
        </div>
        <div className="bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-full flex items-center gap-1 text-xs font-bold border border-emerald-200">
          <IndianRupee size={12} />
          Period Revenue: ₹{totalPeriodRevenue.toLocaleString('en-IN')}
        </div>
      </div>

      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorMembership" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#4F46E5" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorPT" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }} dy={10} />
            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#94a3b8", fontWeight: 700 }} tickFormatter={(value) => `₹${value}`} dx={-10} />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '5 5' }} />
            <Area type="monotone" dataKey="Membership" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorMembership)" />
            <Area type="monotone" dataKey="PT" stroke="#8B5CF6" strokeWidth={3} fillOpacity={1} fill="url(#colorPT)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
