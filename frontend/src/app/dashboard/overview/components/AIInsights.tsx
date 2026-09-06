"use client";

import React, { useMemo } from "react";
import { useGymStore } from "@/store";
import { Sparkles, TrendingUp, AlertTriangle, CheckCircle, Info } from "lucide-react";

export default function AIInsights() {
  const { payments, attendance, members } = useGymStore();

  const insights = useMemo(() => {
    const list = [];
    const today = new Date();
    today.setHours(0,0,0,0);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const isToday = (dStr: string) => {
      const d = new Date(dStr);
      d.setHours(0,0,0,0);
      return d.getTime() === today.getTime();
    };

    const isYesterday = (dStr: string) => {
      const d = new Date(dStr);
      d.setHours(0,0,0,0);
      return d.getTime() === yesterday.getTime();
    };

    // Revenue insight
    const todayRev = payments.filter((p: any) => isToday(p.date || p.createdAt)).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const yesterdayRev = payments.filter((p: any) => isYesterday(p.date || p.createdAt)).reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    
    if (todayRev > yesterdayRev && yesterdayRev > 0) {
      const diff = Math.round(((todayRev - yesterdayRev) / yesterdayRev) * 100);
      list.push({ type: 'positive', text: `Today's revenue is up by ${diff}% compared to yesterday. Great job!` });
    } else if (todayRev < yesterdayRev) {
      list.push({ type: 'warning', text: `Revenue is slightly lagging behind yesterday.` });
    }

    // Expiry Insight
    const tmrw = new Date(today);
    tmrw.setDate(tmrw.getDate() + 1);
    const expiringTmrw = members.filter(m => {
      if (!m.expiryDate) return false;
      const d = new Date(m.expiryDate);
      d.setHours(0,0,0,0);
      return d.getTime() === tmrw.getTime();
    }).length;
    if (expiringTmrw > 0) {
      list.push({ type: 'warning', text: `${expiringTmrw} members have their memberships expiring tomorrow.` });
    }

    // Attendance Insight
    const todayCheckins = attendance.filter(a => isToday(a.checkIn || a.timestamp)).length;
    const yesterdayCheckins = attendance.filter(a => isYesterday(a.checkIn || a.timestamp)).length;
    
    if (todayCheckins > yesterdayCheckins && yesterdayCheckins > 0) {
      list.push({ type: 'positive', text: `Footfall is higher today! ${todayCheckins} total check-ins.` });
    }

    if (list.length === 0) {
      list.push({ type: 'info', text: 'All metrics are stable. The gym is operating normally.' });
    }

    return list;
  }, [payments, attendance, members]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'positive': return <TrendingUp size={14} className="text-emerald-500" />;
      case 'warning': return <AlertTriangle size={14} className="text-amber-500" />;
      default: return <Info size={14} className="text-[#F97316]" />;
    }
  };

  return (
    <div className="bg-slate-900 rounded-3xl p-6 shadow-xl mt-6 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/2 left-1/4 w-32 h-32 bg-indigo-500 rounded-full blur-[80px] opacity-40 -z-0 pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-40 h-40 bg-purple-500 rounded-full blur-[80px] opacity-30 -z-0 pointer-events-none" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles size={16} className="text-indigo-400" />
          <h3 className="text-sm font-black text-white tracking-tight font-display">AI Insights</h3>
          <span className="bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full text-[9px] font-bold border border-indigo-500/30">Auto Generated</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((insight, idx) => (
            <div key={idx} className="bg-white/5 border border-white/10 p-3 rounded-2xl flex items-start gap-3 backdrop-blur-md">
              <div className="mt-0.5">{getIcon(insight.type)}</div>
              <p className="text-xs font-medium text-slate-300 leading-relaxed">{insight.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
