"use client";

import React, { useMemo, useState } from "react";
import { 
  Fingerprint, 
  Clock, 
  UserCheck, 
  UserX, 
  Percent, 
  Flame, 
  ChevronRight,
  Sparkles
} from "lucide-react";
import { SYSTEM_CONFIG } from "@/config/system";

interface AttendanceCommandCenterProps {
  attendanceLogs: any[];
  activeMembersCount: number;
  onOpenRoster: () => void;
}

export default function AttendanceCommandCenter({
  attendanceLogs,
  activeMembersCount,
  onOpenRoster
}: AttendanceCommandCenterProps) {
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);

  const todayStr = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: SYSTEM_CONFIG.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(new Date());
  }, []);

  // Filter logs for today
  const todaysAttendance = useMemo(() => {
    return attendanceLogs.filter((a: any) => {
      if (!a) return false;
      const dStr = String(a.checkIn || a.timestamp || a.createdAt || "").split("T")[0];
      return dStr === todayStr;
    });
  }, [attendanceLogs, todayStr]);

  // Unique Members Present Today
  const presentTodayCount = useMemo(() => {
    const set = new Set<string>();
    todaysAttendance.forEach((a) => {
      const mKey = a.memberId || a.biometricId || a.deviceUserId || a.memberName;
      if (mKey && String(mKey).trim() && !String(mKey).includes("unmapped")) {
        set.add(String(mKey).trim().toLowerCase());
      }
    });
    return set.size;
  }, [todaysAttendance]);

  // Absent Members
  const absentCount = Math.max(0, activeMembersCount - presentTodayCount);

  // Check-in rate
  const checkinRate = activeMembersCount > 0 ? Math.round((presentTodayCount / activeMembersCount) * 100) : 0;

  // Hourly Traffic distribution slots (6 AM to 10 PM)
  const hourlySlots = useMemo(() => {
    const slots = [
      { id: "6am", label: "6 AM", rangeLabel: "6:00 AM – 8:00 AM", startH: 6, endH: 8, count: 0 },
      { id: "8am", label: "8 AM", rangeLabel: "8:00 AM – 10:00 AM", startH: 8, endH: 10, count: 0 },
      { id: "10am", label: "10 AM", rangeLabel: "10:00 AM – 12:00 PM", startH: 10, endH: 12, count: 0 },
      { id: "12pm", label: "12 PM", rangeLabel: "12:00 PM – 2:00 PM", startH: 12, endH: 14, count: 0 },
      { id: "2pm", label: "2 PM", rangeLabel: "2:00 PM – 4:00 PM", startH: 14, endH: 16, count: 0 },
      { id: "4pm", label: "4 PM", rangeLabel: "4:00 PM – 6:00 PM", startH: 16, endH: 18, count: 0 },
      { id: "6pm", label: "6 PM", rangeLabel: "6:00 PM – 8:00 PM", startH: 18, endH: 20, count: 0 },
      { id: "8pm", label: "8 PM", rangeLabel: "8:00 PM – 10:00 PM", startH: 20, endH: 22, count: 0 },
    ];

    todaysAttendance.forEach((a) => {
      const rawTs = a.checkIn || a.timestamp || a.createdAt;
      if (!rawTs) return;
      const d = new Date(rawTs);
      if (isNaN(d.getTime())) return;
      const hour = d.getHours();

      slots.forEach((s) => {
        if (hour >= s.startH && hour < s.endH) {
          s.count++;
        }
      });
    });

    return slots;
  }, [todaysAttendance]);

  // Peak Hour detection
  const peakSlot = useMemo(() => {
    if (hourlySlots.length === 0) return "6 PM – 8 PM";
    const sorted = [...hourlySlots].sort((a, b) => b.count - a.count);
    return sorted[0].count > 0 ? sorted[0].rangeLabel : "6 PM – 8 PM";
  }, [hourlySlots]);

  const maxSlotCount = Math.max(...hourlySlots.map((s) => s.count), 1);

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-6">
      
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#FFF7ED] text-[#EA580C] border border-[#FED7AA] flex items-center justify-center font-black">
            <Fingerprint size={17} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight font-sans">
              ATTENDANCE COMMAND CENTER
            </h3>
            <p className="text-[11px] font-semibold text-slate-400">
              Live biometrics, turnout velocity & hourly floor density
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenRoster}
          className="self-start sm:self-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-orange-50 hover:bg-orange-100 text-[#EA580C] text-[11px] font-extrabold border border-orange-200 transition-all cursor-pointer"
        >
          <span>View Present Roster</span>
          <ChevronRight size={13} />
        </button>
      </div>

      {/* 4 Stat Indicators */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-stone-50/80 rounded-2xl p-3.5 border border-stone-100">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">
            <span>PRESENT TODAY</span>
            <UserCheck size={14} className="text-emerald-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-sans">
            {presentTodayCount}
          </div>
          <div className="text-[10px] font-semibold text-emerald-600 mt-0.5">
            Verified check-ins today
          </div>
        </div>

        <div className="bg-stone-50/80 rounded-2xl p-3.5 border border-stone-100">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">
            <span>ABSENT MEMBERS</span>
            <UserX size={14} className="text-rose-500" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-sans">
            {absentCount}
          </div>
          <div className="text-[10px] font-semibold text-slate-500 mt-0.5">
            Pending visits today
          </div>
        </div>

        <div className="bg-stone-50/80 rounded-2xl p-3.5 border border-stone-100">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">
            <span>CHECK-IN RATE</span>
            <Percent size={14} className="text-[#EA580C]" />
          </div>
          <div className="text-2xl font-black text-slate-900 mt-1 font-sans">
            {checkinRate}%
          </div>
          <div className="text-[10px] font-semibold text-orange-600 mt-0.5">
            Of active roster attendance
          </div>
        </div>

        <div className="bg-stone-50/80 rounded-2xl p-3.5 border border-stone-100">
          <div className="flex items-center justify-between text-slate-400 text-[10px] font-extrabold uppercase tracking-wider">
            <span>PEAK FLOOR TIME</span>
            <Flame size={14} className="text-amber-500" />
          </div>
          <div className="text-lg sm:text-xl font-black text-slate-900 mt-1 font-sans truncate">
            {peakSlot}
          </div>
          <div className="text-[10px] font-semibold text-amber-600 mt-0.5 truncate">
            Highest gym footfall slot
          </div>
        </div>
      </div>

      {/* Hourly Gym Traffic Timeline / Heatmap */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Clock size={13} className="text-[#EA580C]" />
            Hourly Traffic Heatmap (6 AM – 10 PM)
          </span>
          <span className="text-slate-400 font-medium">
            Hover slot for visitor count
          </span>
        </div>

        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2.5">
          {hourlySlots.map((slot) => {
            const pct = Math.max(12, Math.round((slot.count / maxSlotCount) * 100));
            const isSelected = selectedSlot === slot.id;
            const isPeak = slot.count === maxSlotCount && maxSlotCount > 0;

            return (
              <div
                key={slot.id}
                onMouseEnter={() => setSelectedSlot(slot.id)}
                onMouseLeave={() => setSelectedSlot(null)}
                className={`group rounded-2xl p-2.5 border transition-all cursor-pointer flex flex-col justify-between h-28 ${
                  isSelected
                    ? "border-[#EA580C] bg-orange-50/70 shadow-sm"
                    : isPeak
                    ? "border-amber-300 bg-amber-50/40"
                    : "border-stone-100 bg-stone-50/70 hover:border-orange-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black text-slate-500 uppercase">{slot.label}</span>
                  {isPeak && <Flame size={10} className="text-[#EA580C]" />}
                </div>

                {/* Vertical Bar Meter */}
                <div className="h-14 w-full bg-stone-200/60 rounded-xl flex items-end p-1 overflow-hidden">
                  <div
                    style={{ height: `${pct}%` }}
                    className={`w-full rounded-lg transition-all duration-300 ${
                      isPeak
                        ? "bg-gradient-to-t from-[#EA580C] to-[#F97316]"
                        : slot.count > 0
                        ? "bg-gradient-to-t from-orange-400 to-amber-300"
                        : "bg-stone-300"
                    }`}
                  />
                </div>

                <div className="text-center">
                  <span className="text-xs font-black text-slate-800">
                    {slot.count} <span className="text-[9px] font-normal text-slate-400">in</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
