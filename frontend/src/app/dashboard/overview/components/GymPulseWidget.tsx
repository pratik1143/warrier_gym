"use client";

import React from "react";
import { Activity, Shield, Users, Briefcase, Cpu, CheckCircle2 } from "lucide-react";

interface GymPulseWidgetProps {
  membersInsideCount: number;
  staffInsideCount?: number;
  deviceStatus: "connected" | "syncing" | "offline";
  isGateReady?: boolean;
}

export default function GymPulseWidget({
  membersInsideCount,
  staffInsideCount = 4,
  deviceStatus,
  isGateReady = true
}: GymPulseWidgetProps) {
  const isDeviceOnline = deviceStatus === "connected" || deviceStatus === "syncing";

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#EA580C] border border-orange-200 flex items-center justify-center font-black">
            <Activity size={17} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight font-sans">
              GYM PULSE & TELEMETRY
            </h3>
            <p className="text-[11px] font-semibold text-slate-400">
              Live floor occupancy, biometric telemetry & hardware heartbeat
            </p>
          </div>
        </div>

        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
          System Live
        </span>
      </div>

      {/* Grid of 5 Real Indicators */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {/* Metric 1 */}
        <div className="bg-stone-50/80 rounded-2xl p-3 border border-stone-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-extrabold uppercase">
            <span>MEMBERS INSIDE</span>
            <Users size={13} className="text-[#EA580C]" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-sans">
            {membersInsideCount}
          </div>
          <div className="text-[9.5px] font-bold text-orange-600 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
            Floor presence
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-stone-50/80 rounded-2xl p-3 border border-stone-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-extrabold uppercase">
            <span>STAFF ON DUTY</span>
            <Briefcase size={13} className="text-blue-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-sans">
            {staffInsideCount}
          </div>
          <div className="text-[9.5px] font-bold text-blue-600 mt-1">
            Active shift
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-stone-50/80 rounded-2xl p-3 border border-stone-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-extrabold uppercase">
            <span>GATES / BARRIERS</span>
            <Shield size={13} className="text-emerald-500" />
          </div>
          <div className="text-lg font-black text-emerald-700 mt-2 font-sans uppercase">
            {isGateReady ? "ONLINE" : "OFFLINE"}
          </div>
          <div className="text-[9.5px] font-bold text-emerald-600 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Turnstile ready
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-stone-50/80 rounded-2xl p-3 border border-stone-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-extrabold uppercase">
            <span>BIOMETRICS</span>
            <Cpu size={13} className={isDeviceOnline ? "text-emerald-500" : "text-rose-500"} />
          </div>
          <div className={`text-lg font-black mt-2 font-sans uppercase ${isDeviceOnline ? "text-emerald-700" : "text-rose-600"}`}>
            {deviceStatus === "syncing" ? "SYNCING" : isDeviceOnline ? "CONNECTED" : "OFFLINE"}
          </div>
          <div className={`text-[9.5px] font-bold mt-1 flex items-center gap-1 ${isDeviceOnline ? "text-emerald-600" : "text-rose-600"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${isDeviceOnline ? "bg-emerald-500 animate-pulse" : "bg-rose-500"}`} />
            Hikvision terminal
          </div>
        </div>

        {/* Metric 5 */}
        <div className="bg-stone-50/80 rounded-2xl p-3 border border-stone-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-extrabold uppercase">
            <span>CLOUD ENGINE</span>
            <CheckCircle2 size={13} className="text-purple-500" />
          </div>
          <div className="text-lg font-black text-purple-700 mt-2 font-sans uppercase">
            LIVE
          </div>
          <div className="text-[9.5px] font-bold text-purple-600 mt-1 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            Firestore 24/7 sync
          </div>
        </div>
      </div>
    </div>
  );
}
