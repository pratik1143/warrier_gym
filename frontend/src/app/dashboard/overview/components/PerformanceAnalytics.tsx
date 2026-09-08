"use client";

import React, { useState, useMemo } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";
import { TrendingUp, Users, Calendar, IndianRupee, BarChart2 } from "lucide-react";
import { SYSTEM_START_DATE, SYSTEM_CONFIG } from "@/config/system";

interface PerformanceAnalyticsProps {
  payments: any[];
  members: any[];
}

type TimeRange = "7D" | "30D" | "3M" | "6M" | "1Y";

export default function PerformanceAnalytics({ payments, members }: PerformanceAnalyticsProps) {
  const [revenueRange, setRevenueRange] = useState<TimeRange>("30D");

  const todayStr = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: SYSTEM_CONFIG.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(new Date());
  }, []);

  // 1. Calculate Revenue Chart Data
  const revenueChartData = useMemo(() => {
    const now = new Date();
    let daysCount = 30;
    if (revenueRange === "7D") daysCount = 7;
    if (revenueRange === "30D") daysCount = 30;
    if (revenueRange === "3M") daysCount = 90;
    if (revenueRange === "6M") daysCount = 180;
    if (revenueRange === "1Y") daysCount = 365;

    // Build timeline points (if range > 60 days, group by weeks/months for clean charts)
    const isGrouped = daysCount > 60;
    const pointsMap = new Map<string, { label: string; membership: number; pt: number; total: number }>();

    for (let i = daysCount - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateKey = `${yyyy}-${mm}-${dd}`;

      let groupKey = dateKey;
      let label = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });

      if (revenueRange === "3M" || revenueRange === "6M") {
        // Group by week
        const weekNum = Math.floor(d.getDate() / 7) + 1;
        groupKey = `${yyyy}-${mm}-W${weekNum}`;
        label = `${d.toLocaleDateString("en-IN", { month: "short" })} W${weekNum}`;
      } else if (revenueRange === "1Y") {
        // Group by month
        groupKey = `${yyyy}-${mm}`;
        label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
      }

      if (!pointsMap.has(groupKey)) {
        pointsMap.set(groupKey, { label, membership: 0, pt: 0, total: 0 });
      }
    }

    // Populate from real payments
    const seenPaymentKeys = new Set<string>();

    payments.forEach((p: any) => {
      if (!p || p.isSample || p.isMock) return;
      const isHist = p.isHistorical === true || p.imported === true || p.isLegacyImport === true || p.transactionType === "historical_import";
      if (isHist) return;

      const status = String(p.status || p.paymentStatus || "paid").toLowerCase();
      if (status !== "paid" && status !== "partial") return;

      const pDate = String(p.paymentDate || p.date || "").split("T")[0];
      if (!pDate || pDate < SYSTEM_START_DATE || pDate > todayStr) return;

      const idKey = String(p.id || p.paymentId || p.invoiceNumber || p.invoice || p.idempotencyKey || "").trim();
      if (idKey && seenPaymentKeys.has(idKey)) return;
      if (idKey) seenPaymentKeys.add(idKey);

      const d = new Date(pDate);
      if (isNaN(d.getTime())) return;

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const dateKey = `${yyyy}-${mm}-${dd}`;

      let groupKey = dateKey;
      if (revenueRange === "3M" || revenueRange === "6M") {
        const weekNum = Math.floor(d.getDate() / 7) + 1;
        groupKey = `${yyyy}-${mm}-W${weekNum}`;
      } else if (revenueRange === "1Y") {
        groupKey = `${yyyy}-${mm}`;
      }

      if (pointsMap.has(groupKey)) {
        const target = pointsMap.get(groupKey)!;
        const amt = Number(p.amountPaid !== undefined ? p.amountPaid : (p.paid !== undefined ? p.paid : (p.amount || 0))) || 0;
        const isPT = p.isPT || p.billingType === "PT" || p.packageType === "PT" || p.invoiceType === "PT" || p.transactionType === "pt_payment";

        if (isPT) {
          target.pt += amt;
        } else {
          target.membership += amt;
        }
        target.total += amt;
      }
    });

    return Array.from(pointsMap.values());
  }, [payments, revenueRange, todayStr]);

  // Total in selected revenue range
  const totalRevenueInRange = useMemo(() => {
    return revenueChartData.reduce((acc, curr) => acc + curr.total, 0);
  }, [revenueChartData]);

  // 2. Calculate Member Growth Breakdown Data
  const memberGrowthData = useMemo(() => {
    // Breakdown total members into categories
    let active = 0;
    let hold = 0;
    let expired = 0;
    let newRecent = 0;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split("T")[0];

    members.forEach((m: any) => {
      if (!m) return;
      const isHold = m.status === "hold" || m.status === "Hold" || (!m.plan && !m.expiryDate);
      const isExpired = m.status === "expired" || m.status === "Expired" || (m.expiryDate && m.expiryDate < todayStr);
      const isActive = !isHold && !isExpired && (m.status === "active" || m.status === "Active" || (m.expiryDate && m.expiryDate >= todayStr));
      const isNew = String(m.joinDate || m.registrationDate || m.createdAt || "").split("T")[0] >= sevenDaysAgoStr;

      if (isActive) active++;
      if (isHold) hold++;
      if (isExpired) expired++;
      if (isNew) newRecent++;
    });

    return [
      { category: "New (7D)", count: newRecent, fill: "#F97316" },
      { category: "Active", count: active, fill: "#16A34A" },
      { category: "Pending / Hold", count: hold, fill: "#EAB308" },
      { category: "Expired", count: expired, fill: "#DC2626" }
    ];
  }, [members, todayStr]);

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#F97316] to-[#EA580C] text-white flex items-center justify-center font-black shadow-xs">
            <TrendingUp size={16} />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight font-sans">
              GYM PERFORMANCE
            </h2>
            <p className="text-[11px] font-semibold text-slate-400">
              Interactive revenue analytics & member growth trajectories
            </p>
          </div>
        </div>
      </div>

      {/* 2-Column Analytics Grid: Large Revenue Chart (8 cols) + Member Growth Chart (4 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Chart 1: Revenue & Collections Over Time */}
        <div className="lg:col-span-8 bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Revenue Inflow · Collections
              </div>
              <div className="flex items-baseline gap-2 mt-0.5">
                <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-sans">
                  ₹{totalRevenueInRange.toLocaleString("en-IN")}
                </span>
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Verified Collections
                </span>
              </div>
            </div>

            {/* Time Filter Pills */}
            <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl">
              {(["7D", "30D", "3M", "6M", "1Y"] as TimeRange[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRevenueRange(r)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                    revenueRange === r
                      ? "bg-white text-[#EA580C] shadow-xs"
                      : "text-slate-500 hover:text-slate-900"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Recharts Area Container */}
          <div className="h-[240px] sm:h-[260px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="orangeRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EA580C" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#EA580C" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="amberPTGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#F59E0B" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="label"
                  stroke="#94A3B8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `₹${val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}`}
                />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 text-white rounded-2xl p-3 shadow-xl border border-slate-800 text-xs space-y-1">
                          <div className="font-extrabold text-slate-400 border-b border-slate-800 pb-1 text-[10px] uppercase">
                            {label}
                          </div>
                          <div className="text-amber-300 font-black text-sm">
                            Total: ₹{Number(payload[0]?.payload?.total || 0).toLocaleString("en-IN")}
                          </div>
                          <div className="text-orange-200 text-[11px] font-semibold flex justify-between gap-4">
                            <span>Membership:</span>
                            <span>₹{Number(payload[0]?.payload?.membership || 0).toLocaleString("en-IN")}</span>
                          </div>
                          <div className="text-amber-100 text-[11px] font-semibold flex justify-between gap-4">
                            <span>PT Training:</span>
                            <span>₹{Number(payload[0]?.payload?.pt || 0).toLocaleString("en-IN")}</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="#EA580C"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#orangeRevenueGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="pt-3 border-t border-stone-100 flex items-center justify-between text-[11px] text-slate-500 font-semibold">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#EA580C]" /> Total Collections
            </span>
            <span>Real-time Ledger Sync</span>
          </div>
        </div>

        {/* Chart 2: Member Growth Breakdown */}
        <div className="lg:col-span-4 bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                Member Distribution
              </span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                {members.length} Total
              </span>
            </div>
            <h3 className="text-lg font-black text-slate-900 tracking-tight mt-1 font-sans">
              MEMBER GROWTH
            </h3>
          </div>

          {/* Bar Chart Visualization */}
          <div className="h-[210px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={memberGrowthData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis
                  dataKey="category"
                  stroke="#94A3B8"
                  fontSize={9.5}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  stroke="#94A3B8"
                  fontSize={10}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  cursor={{ fill: "rgba(249, 115, 22, 0.05)" }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white rounded-xl px-3 py-2 shadow-lg text-xs font-bold">
                          <div>{data.category}</div>
                          <div className="text-amber-300 font-black text-sm mt-0.5">{data.count} Members</div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar
                  dataKey="count"
                  radius={[8, 8, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Legend Summary */}
          <div className="pt-3 border-t border-stone-100 grid grid-cols-2 gap-2 text-[10px]">
            {memberGrowthData.map((item, i) => (
              <div key={i} className="flex items-center gap-1.5 font-bold text-slate-600">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.fill }} />
                <span className="truncate">{item.category}: {item.count}</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
