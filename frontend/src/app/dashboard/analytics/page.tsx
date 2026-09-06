'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts';
import {
  TrendingUp, TrendingDown, Users, IndianRupee, Activity,
  Dumbbell, BarChart2, Calendar, Filter, Download, RefreshCw
} from 'lucide-react';
import { useGymStore } from '@/store';
import toast from '@/lib/toast';

const ACCENT = '#d4ff00';
const COLORS = ['#0052FF', '#d4ff00', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function StatCard({ label, value, sub, icon: Icon, color, trend }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col gap-3"
    >
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center`} style={{ background: color + '18' }}>
          <Icon size={18} style={{ color }} />
        </div>
        {trend !== undefined && (
          <span className={`text-[10px] font-black flex items-center gap-0.5 px-2 py-1 rounded-full ${trend >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-red-500 bg-red-50'}`}>
            {trend >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-2xl font-black text-black">{value}</p>
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
        {sub && <p className="text-[9px] text-slate-300 mt-0.5">{sub}</p>}
      </div>
    </motion.div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg">
        <p className="text-[10px] font-black text-slate-500 mb-1">{label}</p>
        {payload.map((p: any, i: number) => (
          <p key={i} className="text-[11px] font-black" style={{ color: p.color }}>
            {p.name}: {typeof p.value === 'number' && p.name?.toLowerCase().includes('revenue') ? `₹${p.value.toLocaleString()}` : p.value}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function AnalyticsPage() {
  const { members, payments, attendance, fetchMembers, fetchPayments, fetchAttendance } = useGymStore();
  const [range, setRange] = useState<'7d' | '30d' | '12m'>('30d');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        await Promise.all([fetchMembers(), fetchPayments(), fetchAttendance()]);
      } catch (e) {
        toast.error('Failed to load analytics data');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── Attendance Trend ──────────────────────────────────────────
  const attendanceTrend = (() => {
    if (range === '12m') {
      const buckets: Record<string, number> = {};
      MONTHS.forEach(m => { buckets[m] = 0; });
      attendance.forEach((a: any) => {
        const d = new Date(a.checkIn);
        const m = MONTHS[d.getMonth()];
        buckets[m] = (buckets[m] || 0) + 1;
      });
      return MONTHS.map(m => ({ label: m, checkins: buckets[m] }));
    }
    const days = range === '7d' ? 7 : 30;
    return Array.from({ length: days }).map((_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (days - 1 - i));
      const dayStr = `${date.getDate()}/${date.getMonth() + 1}`;
      const checkins = attendance.filter((a: any) => {
        const d = new Date(a.checkIn);
        return d.getDate() === date.getDate() && d.getMonth() === date.getMonth();
      }).length;
      return { label: dayStr, checkins };
    });
  })();

  // ── Revenue Trend ──────────────────────────────────────────────
  const revenueTrend = (() => {
    const buckets: Record<string, number> = {};
    MONTHS.forEach(m => { buckets[m] = 0; });
    payments.forEach((p: any) => {
      const d = new Date(p.date);
      const m = MONTHS[d.getMonth()];
      buckets[m] = (buckets[m] || 0) + (Number(p.amount) || 0);
    });
    return MONTHS.map(m => ({ label: m, revenue: buckets[m] }));
  })();

  // ── Membership Growth ─────────────────────────────────────────
  const memberGrowth = (() => {
    const buckets: Record<string, number> = {};
    MONTHS.forEach(m => { buckets[m] = 0; });
    members.forEach((m: any) => {
      const d = new Date(m.joinDate);
      const mo = MONTHS[d.getMonth()];
      buckets[mo] = (buckets[mo] || 0) + 1;
    });
    let cumulative = 0;
    return MONTHS.map(m => {
      cumulative += buckets[m];
      return { label: m, members: cumulative, new: buckets[m] };
    });
  })();

  // ── Membership Plan Distribution ──────────────────────────────
  const planDistribution = (() => {
    const map: Record<string, number> = {};
    members.forEach((m: any) => {
      const plan = m.plan || 'Unknown';
      map[plan] = (map[plan] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  })();

  // ── Status Distribution ────────────────────────────────────────
  const statusDist = (() => {
    const map: Record<string, number> = { active: 0, expired: 0, frozen: 0 };
    members.forEach((m: any) => { map[m.status] = (map[m.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name: name.charAt(0).toUpperCase() + name.slice(1), value }));
  })();

  // ── Summary Stats ─────────────────────────────────────────────
  const totalRevenue = payments.reduce((s: number, p: any) => s + (Number(p.amount) || 0), 0);
  const totalCheckins = attendance.length;
  const activeMembers = members.filter((m: any) => m.status === 'active').length;
  const expiringCount = members.filter((m: any) => {
    const exp = new Date(m.expiryDate);
    const diff = (exp.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  }).length;

  const avgRevenuePerMember = members.length > 0 ? Math.round(totalRevenue / members.length) : 0;

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-black text-black flex items-center gap-2">
              <BarChart2 size={20} />
              Analytics Hub
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              Real-time business intelligence — {members.length} members · {payments.length} transactions
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Range Selector */}
            <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
              {(['7d', '30d', '12m'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRange(r)}
                  className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${range === r ? 'bg-black text-white shadow' : 'text-slate-400 hover:text-black'}`}
                >
                  {r}
                </button>
              ))}
            </div>
            <button
              onClick={async () => {
                setLoading(true);
                await Promise.all([fetchMembers(), fetchPayments(), fetchAttendance()]);
                setLoading(false);
                toast.success('Analytics refreshed');
              }}
              className="w-9 h-9 bg-slate-100 rounded-xl flex items-center justify-center hover:bg-black hover:text-white transition-all"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>
      </motion.div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Revenue" value={`₹${totalRevenue.toLocaleString()}`} icon={IndianRupee} color="#0052FF" trend={12} sub="All time" />
        <StatCard label="Active Members" value={activeMembers} icon={Users} color="#10b981" trend={5} sub={`${members.length} total`} />
        <StatCard label="Total Check-ins" value={totalCheckins} icon={Activity} color="#f59e0b" trend={8} sub="All time" />
        <StatCard label="Expiring (7d)" value={expiringCount} icon={Calendar} color="#ef4444" trend={-2} sub="Renewal alert" />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Attendance Trend */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-black">Attendance Trend</h3>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">{range}</span>
          </div>
          {attendanceTrend.every(d => d.checkins === 0) ? (
            <div className="h-48 flex items-center justify-center text-slate-300">
              <div className="text-center">
                <Activity size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-[11px] font-bold">No attendance data yet</p>
                <p className="text-[9px]">Check-in members to see trends</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={attendanceTrend}>
                <defs>
                  <linearGradient id="attGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0052FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0052FF" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="checkins" name="Check-ins" stroke="#0052FF" strokeWidth={2.5} fill="url(#attGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Revenue Trend */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-black">Monthly Revenue</h3>
            <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-1 rounded-lg">12m</span>
          </div>
          {revenueTrend.every(d => d.revenue === 0) ? (
            <div className="h-48 flex items-center justify-center text-slate-300">
              <div className="text-center">
                <IndianRupee size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-[11px] font-bold">No payment data yet</p>
                <p className="text-[9px]">Collect payments to see revenue</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={revenueTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="revenue" name="Revenue" fill="#0052FF" radius={[6, 6, 0, 0]}>
                  {revenueTrend.map((_, i) => (
                    <Cell key={i} fill={revenueTrend[i].revenue === Math.max(...revenueTrend.map(d => d.revenue)) ? ACCENT : '#0052FF'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Member Growth */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm lg:col-span-2"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black text-black">Membership Growth</h3>
            <div className="flex items-center gap-3 text-[9px] font-bold text-slate-400">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-[#0052FF] inline-block" /> Cumulative</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> New</span>
            </div>
          </div>
          {memberGrowth.every(d => d.members === 0) ? (
            <div className="h-48 flex items-center justify-center text-slate-300">
              <div className="text-center">
                <Users size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-[11px] font-bold">No member data yet</p>
                <p className="text-[9px]">Add members to track growth</p>
              </div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={memberGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="label" tick={{ fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fontWeight: 700 }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="members" name="Cumulative" stroke="#0052FF" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="new" name="New" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} strokeDasharray="4 2" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Plan Distribution Pie */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"
        >
          <h3 className="text-sm font-black text-black mb-4">Plan Split</h3>
          {planDistribution.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-slate-300">
              <div className="text-center">
                <Dumbbell size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-[11px] font-bold">No plans yet</p>
              </div>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={planDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3} dataKey="value">
                    {planDistribution.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any, name: any) => [v, name]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {planDistribution.map((p, i) => (
                  <div key={i} className="flex items-center justify-between text-[9px] font-bold">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                      <span className="text-slate-600">{p.name}</span>
                    </span>
                    <span className="text-black">{p.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* Status Distribution + Avg Revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Member Status */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"
        >
          <h3 className="text-sm font-black text-black mb-4">Member Status</h3>
          <div className="space-y-3">
            {statusDist.map((s, i) => {
              const colors = { Active: '#10b981', Expired: '#ef4444', Frozen: '#f59e0b' };
              const total = members.length || 1;
              const pct = Math.round((s.value / total) * 100);
              return (
                <div key={i}>
                  <div className="flex justify-between text-[10px] font-black mb-1">
                    <span style={{ color: (colors as any)[s.name] }}>{s.name}</span>
                    <span className="text-slate-500">{s.value} ({pct}%)</span>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.4 + i * 0.1 }}
                      className="h-full rounded-full"
                      style={{ background: (colors as any)[s.name] }}
                    />
                  </div>
                </div>
              );
            })}
            {statusDist.length === 0 && (
              <p className="text-[11px] text-slate-300 font-bold text-center py-6">No member data</p>
            )}
          </div>
        </motion.div>

        {/* Avg Revenue Per Member */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="bg-black rounded-2xl p-5 shadow-sm text-white"
        >
          <h3 className="text-sm font-black mb-4">Revenue / Member</h3>
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <p className="text-4xl font-black text-[#d4ff00]">
              ₹{avgRevenuePerMember.toLocaleString()}
            </p>
            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Average per member</p>
            <div className="w-full h-px bg-white/10 my-2" />
            <div className="grid grid-cols-2 gap-4 w-full text-center">
              <div>
                <p className="text-sm font-black text-[#d4ff00]">₹{totalRevenue.toLocaleString()}</p>
                <p className="text-[8px] text-white/40 uppercase tracking-wider">Total</p>
              </div>
              <div>
                <p className="text-sm font-black text-[#d4ff00]">{members.length}</p>
                <p className="text-[8px] text-white/40 uppercase tracking-wider">Members</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Top Paying Members */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"
        >
          <h3 className="text-sm font-black text-black mb-4">Top Payers</h3>
          {payments.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-slate-300">
              <p className="text-[11px] font-bold text-center">No payments yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {Object.entries(
                payments.reduce((acc: Record<string, number>, p: any) => {
                  acc[p.memberName] = (acc[p.memberName] || 0) + Number(p.amount);
                  return acc;
                }, {})
              )
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, amount], i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500">{i + 1}</span>
                      <span className="text-[10px] font-bold text-slate-700 truncate max-w-[100px]">{name}</span>
                    </div>
                    <span className="text-[10px] font-black text-black">₹{(amount as number).toLocaleString()}</span>
                  </div>
                ))}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
