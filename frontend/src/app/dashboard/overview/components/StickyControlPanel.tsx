"use client";

import React, { useState, useEffect } from "react";
import { useGymStore } from "@/store";
import { Activity, ShieldCheck, Database, Cpu, Wifi, Users, IndianRupee, PieChart, Info, TrendingDown, TrendingUp } from "lucide-react";

export default function StickyControlPanel() {
  const { deviceStatus, gymPresence, payments, attendance } = useGymStore();
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setOnline(navigator.onLine);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const membersInside = gymPresence.filter((p: any) => p.status === 'in' && p.role !== 'employee').length;
  const employeesInside = gymPresence.filter((p: any) => p.status === 'in' && p.role === 'employee').length;

  const todayStr = new Date().toISOString().split("T")[0];
  const todayRevenue = payments
    .filter((p: any) => (p.date || p.createdAt || "").startsWith(todayStr))
    .reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  
  // Fake expenses/profit for UI as per real CRM logic
  const todayExpenses = Math.floor(todayRevenue * 0.15); // 15% placeholder
  const profit = todayRevenue - todayExpenses;
  const attendancePercent = 85; // Placeholder %

  const renderStatus = (name: string, status: 'online' | 'offline' | 'syncing') => (
    <div className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
      <span className="text-[11px] font-bold text-slate-600">{name}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-[9px] font-black uppercase tracking-wider text-slate-500">
          {status}
        </span>
        <span className={`w-2 h-2 rounded-full ${
          status === 'online' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' :
          status === 'syncing' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] animate-pulse' :
          'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]'
        }`} />
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 sticky top-6">
      <div className="flex items-center gap-2 mb-6">
        <Activity size={16} className="text-indigo-500" />
        <h3 className="text-sm font-black text-slate-800 tracking-tight font-display">System Status</h3>
      </div>

      {/* Live Gym Occupancy Circular Widget */}
      <div className="flex flex-col items-center justify-center mb-6 bg-slate-50/50 p-6 rounded-3xl border border-slate-100 relative">
        <div className="absolute top-4 left-4">
          <span className="text-[10px] font-black text-slate-550 uppercase tracking-widest">Occupancy</span>
        </div>
        
        {/* Circle Ring */}
        <div className="relative w-32 h-32 flex items-center justify-center mt-2">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="40" fill="none" stroke="#e2e8f0" strokeWidth="8" />
            <circle 
              cx="50" 
              cy="50" 
              r="40" 
              fill="none" 
              stroke="#4F46E5" 
              strokeWidth="8"
              strokeDasharray={`${(membersInside / 120) * 251.2} 251.2`}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-out drop-shadow-sm"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-slate-800 tracking-tighter leading-none">{membersInside}</span>
            <span className="text-[10px] font-bold text-slate-550">/ 120</span>
          </div>
        </div>

        <div className="flex justify-between w-full mt-6 px-2 gap-4">
          <div className="text-center flex-1">
            <div className="text-[10px] font-black text-slate-550 uppercase tracking-widest mb-1">Members</div>
            <div className="text-sm font-black text-indigo-650">{membersInside}</div>
          </div>
          <div className="w-px h-8 bg-slate-200"></div>
          <div className="text-center flex-1">
            <div className="text-[10px] font-black text-slate-550 uppercase tracking-widest mb-1">Staff</div>
            <div className="text-sm font-black text-emerald-650">{employeesInside}</div>
          </div>
        </div>
      </div>

      <div className="space-y-3 px-2">
        <div className="flex justify-between items-end border-b border-slate-100 pb-2">
          <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5"><IndianRupee size={12}/> Revenue</span>
          <span className="text-sm font-black text-slate-800">₹{todayRevenue.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-end border-b border-slate-100 pb-2">
          <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1.5"><TrendingDown size={12}/> Expenses</span>
          <span className="text-sm font-black text-red-500">₹{todayExpenses.toLocaleString()}</span>
        </div>
        <div className="flex justify-between items-end pb-1">
          <span className="text-[11px] font-bold text-slate-650 flex items-center gap-1.5"><TrendingUp size={12}/> Profit</span>
          <span className="text-sm font-black text-emerald-500">₹{profit.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
