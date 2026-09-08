"use client";

import React from "react";
import { motion } from "framer-motion";
import { 
  UserPlus, 
  MessageSquare, 
  PhoneCall, 
  Fingerprint, 
  Calendar, 
  ArrowRight, 
  TrendingUp, 
  Activity, 
  Users, 
  IndianRupee,
  Sparkles
} from "lucide-react";

interface DashboardHeroProps {
  userName: string;
  dateStr: string;
  greeting: string;
  fromDate: string;
  toDate: string;
  dateRange: string;
  onSelectPreset: (preset: "Today" | "Yesterday" | "7 Days" | "30 Days" | "Month") => void;
  onDateChange: (from: string, to: string) => void;
  presentTodayCount: number;
  activeMembersCount: number;
  pendingEnquiriesCount: number;
  todaysRealCollection: number;
  onNewMember: () => void;
  onNewEnquiry: () => void;
  onFollowUp: () => void;
  onAttendance: () => void;
}

export default function DashboardHero({
  userName,
  dateStr,
  greeting,
  fromDate,
  toDate,
  dateRange,
  onSelectPreset,
  onDateChange,
  presentTodayCount,
  activeMembersCount,
  pendingEnquiriesCount,
  todaysRealCollection,
  onNewMember,
  onNewEnquiry,
  onFollowUp,
  onAttendance
}: DashboardHeroProps) {
  const presets: Array<"Today" | "Yesterday" | "7 Days" | "30 Days" | "Month"> = [
    "Today",
    "Yesterday",
    "7 Days",
    "30 Days",
    "Month"
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#F97316] via-[#EA580C] to-[#9A3412] text-white p-6 sm:p-7 shadow-[0_12px_36px_rgba(234,88,12,0.22)] border border-orange-400/30">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 right-1/4 w-96 h-96 bg-amber-400/20 rounded-full blur-3xl pointer-events-none -translate-y-1/2" />
      <div className="absolute -bottom-16 left-10 w-72 h-72 bg-orange-300/15 rounded-full blur-2xl pointer-events-none" />
      <div className="absolute top-4 right-4 w-60 h-60 bg-red-500/10 rounded-full blur-2xl pointer-events-none" />

      {/* Grid Layout: Left Greeting & Actions, Right Pulse & Integrated Range Selector */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
        
        {/* Left Side: Greeting, Subtitle, Quick Action CTAs */}
        <div className="lg:col-span-7 flex flex-col justify-between space-y-4">
          <div className="space-y-1.5">
            {/* Live Indicator Pill */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/25 backdrop-blur-md border border-white/20 text-[10px] font-black uppercase tracking-[0.14em] text-white">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
              </span>
              <span>Warrior Gym OS · Real-Time Sync</span>
            </div>

            {/* Bold Headline */}
            <h1 className="text-2xl sm:text-3xl lg:text-[34px] font-black tracking-tight leading-tight text-white drop-shadow-xs">
              {greeting}, <span className="text-amber-200">{userName || "Gym Owner"}</span> 👋
            </h1>

            {/* Formatted Date */}
            <p className="text-orange-100/90 text-xs sm:text-sm font-semibold tracking-wide">
              {dateStr}
            </p>
          </div>

          {/* Quick Action Button Strip */}
          <div className="flex flex-wrap items-center gap-2.5 pt-2">
            <button
              type="button"
              onClick={onNewMember}
              className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#EA580C] hover:bg-orange-50 font-black text-xs tracking-wide shadow-md transition-all duration-150 active:scale-95 cursor-pointer border-none"
            >
              <UserPlus size={15} className="text-[#EA580C] transition-transform group-hover:scale-110" />
              <span>+ New Member</span>
            </button>

            <button
              type="button"
              onClick={onNewEnquiry}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-black/25 hover:bg-black/35 text-white font-bold text-xs tracking-wide border border-white/25 shadow-xs transition-all duration-150 active:scale-95 cursor-pointer backdrop-blur-md"
            >
              <MessageSquare size={14} />
              <span>+ New Enquiry</span>
            </button>

            <button
              type="button"
              onClick={onFollowUp}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-black/25 hover:bg-black/35 text-white font-bold text-xs tracking-wide border border-white/25 shadow-xs transition-all duration-150 active:scale-95 cursor-pointer backdrop-blur-md"
            >
              <PhoneCall size={14} />
              <span>+ Follow Up</span>
            </button>

            <button
              type="button"
              onClick={onAttendance}
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs tracking-wide border border-white/20 transition-all duration-150 active:scale-95 cursor-pointer backdrop-blur-md"
            >
              <Fingerprint size={14} className="text-amber-200" />
              <span>Attendance</span>
            </button>
          </div>
        </div>

        {/* Right Side: Compact "Gym Pulse" Area + Integrated Premium Range Selector */}
        <div className="lg:col-span-5 flex flex-col gap-3.5">
          {/* Glass Gym Pulse Card */}
          <div className="bg-black/20 backdrop-blur-md border border-white/20 rounded-2xl p-3.5">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/15">
              <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-200">
                <Sparkles size={12} />
                <span>Today's Gym Pulse</span>
              </div>
              <span className="text-[9.5px] font-bold text-orange-200/90">Real-Time</span>
            </div>

            {/* 4 Mini Stat Blocks */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="bg-white/10 rounded-xl p-2 text-center border border-white/10">
                <div className="text-[9px] font-extrabold uppercase tracking-wider text-orange-100/80">Present</div>
                <div className="text-base font-black text-white mt-0.5">{presentTodayCount}</div>
              </div>

              <div className="bg-white/10 rounded-xl p-2 text-center border border-white/10">
                <div className="text-[9px] font-extrabold uppercase tracking-wider text-orange-100/80">Active</div>
                <div className="text-base font-black text-white mt-0.5">{activeMembersCount}</div>
              </div>

              <div className="bg-white/10 rounded-xl p-2 text-center border border-white/10">
                <div className="text-[9px] font-extrabold uppercase tracking-wider text-orange-100/80">Enquiries</div>
                <div className="text-base font-black text-white mt-0.5">{pendingEnquiriesCount}</div>
              </div>

              <div className="bg-white/10 rounded-xl p-2 text-center border border-white/10">
                <div className="text-[9px] font-extrabold uppercase tracking-wider text-orange-100/80">Collection</div>
                <div className="text-base font-black text-amber-200 mt-0.5 truncate">
                  ₹{todaysRealCollection >= 1000 ? `${(todaysRealCollection / 1000).toFixed(1)}k` : todaysRealCollection}
                </div>
              </div>
            </div>
          </div>

          {/* Integrated Date Range Filter & Calendar */}
          <div className="space-y-2">
            {/* Quick Preset Pills */}
            <div className="flex flex-wrap items-center justify-start lg:justify-end gap-1.5">
              {presets.map((preset) => {
                const isActive = dateRange === preset;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => onSelectPreset(preset)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer border ${
                      isActive
                        ? "bg-white text-[#EA580C] border-white shadow-sm scale-105"
                        : "bg-black/20 text-white/90 border-white/15 hover:bg-white/20 hover:text-white"
                    }`}
                  >
                    {preset}
                  </button>
                );
              })}
              {dateRange === "Custom" && (
                <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-900 border border-amber-300">
                  Custom
                </span>
              )}
            </div>

            {/* Direct Date Inputs */}
            <div className="flex items-center gap-1.5 justify-start lg:justify-end">
              <div className="flex items-center gap-1.5 bg-black/25 border border-white/20 rounded-xl px-2.5 py-1 backdrop-blur-md">
                <Calendar size={12} className="text-amber-200 shrink-0" />
                <input
                  type="date"
                  value={fromDate}
                  onChange={(e) => onDateChange(e.target.value, toDate)}
                  className="bg-transparent border-none text-white text-[11px] font-bold outline-none cursor-pointer w-28"
                />
                <span className="text-orange-200 text-xs font-bold">→</span>
                <input
                  type="date"
                  value={toDate}
                  onChange={(e) => onDateChange(fromDate, e.target.value)}
                  className="bg-transparent border-none text-white text-[11px] font-bold outline-none cursor-pointer w-28"
                />
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
