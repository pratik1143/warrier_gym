"use client";

import React, { useState } from "react";
import { Shield, Unlock, Lock, Radio, CheckCircle2, Clock } from "lucide-react";
import toast from "@/lib/toast";

interface GateAccessCardProps {
  deviceStatus: "connected" | "syncing" | "offline";
  lastPunchEvent?: {
    memberName: string;
    time: string;
    biometricId?: string;
  };
  onUnlockGate: () => Promise<void>;
}

export default function GateAccessCard({
  deviceStatus,
  lastPunchEvent,
  onUnlockGate
}: GateAccessCardProps) {
  const [unlocking, setUnlocking] = useState(false);
  const [unlockSuccess, setUnlockSuccess] = useState(false);

  const isConnected = deviceStatus === "connected" || deviceStatus === "syncing";

  const handleOpenGate = async () => {
    setUnlocking(true);
    try {
      await onUnlockGate();
      setUnlockSuccess(true);
      toast.success("Gate trigger command dispatched! 🔓");
      setTimeout(() => {
        setUnlockSuccess(false);
      }, 3500);
    } catch (err: any) {
      toast.error("Failed to trigger gate: " + (err.message || "Device communication error"));
    } finally {
      setUnlocking(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] flex flex-col justify-between space-y-4">
      {/* Top Title */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#EA580C] border border-orange-200 flex items-center justify-center font-black">
            <Radio size={16} />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase font-sans">
              ACCESS CONTROL
            </h3>
            <p className="text-[10px] font-semibold text-slate-400">
              Hikvision DS-K1T320EFWX
            </p>
          </div>
        </div>

        {/* Real Live Hardware Status */}
        <span
          className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 ${
            isConnected
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : "bg-red-50 text-red-700 border-red-200"
          }`}
        >
          <span
            className={`w-2 h-2 rounded-full ${
              isConnected ? "bg-emerald-500 animate-pulse" : "bg-red-500"
            }`}
          />
          {isConnected ? "CONNECTED" : "DISCONNECTED"}
        </span>
      </div>

      {/* Device Telemetry Specs */}
      <div className="grid grid-cols-2 gap-2.5 text-left text-xs">
        <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Terminal</div>
          <div className="text-xs font-black text-slate-800 mt-0.5 font-sans">Hikvision Face/Bio</div>
        </div>

        <div className="p-2.5 rounded-xl bg-stone-50 border border-stone-100">
          <div className="text-[9px] font-black uppercase tracking-wider text-slate-400">Turnstile</div>
          <div className="text-xs font-black text-emerald-600 mt-0.5 font-sans flex items-center gap-1">
            <CheckCircle2 size={12} /> READY
          </div>
        </div>
      </div>

      {/* Last Event Log */}
      <div className="p-3 rounded-2xl bg-amber-50/50 border border-amber-200/60 flex items-center gap-3">
        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
          <Clock size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-black uppercase text-amber-800 tracking-wider">
            Last Punch Event
          </div>
          <div className="text-xs font-black text-slate-900 truncate">
            {lastPunchEvent?.memberName || "Raman checked in"}
          </div>
          <div className="text-[10px] font-semibold text-slate-500">
            {lastPunchEvent?.time || "Today at 09:31 PM"}
          </div>
        </div>
      </div>

      {/* Action Button: OPEN GATE */}
      <button
        type="button"
        disabled={unlocking || unlockSuccess}
        onClick={handleOpenGate}
        className={`w-full py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer shadow-md border-none ${
          unlockSuccess
            ? "bg-emerald-600 text-white animate-bounce"
            : "bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#C2410C] hover:from-[#EA580C] hover:to-[#9A3412] text-white active:scale-95 shadow-orange-500/20"
        } disabled:opacity-80`}
      >
        {unlockSuccess ? (
          <>
            <Unlock size={16} />
            <span>BARRIER UNLOCKED (SUCCESS)</span>
          </>
        ) : unlocking ? (
          <>
            <Unlock size={16} className="animate-spin" />
            <span>TRIGGERING GATE...</span>
          </>
        ) : (
          <>
            <Unlock size={16} />
            <span>OPEN GATE (MANUAL OVERRIDE)</span>
          </>
        )}
      </button>
    </div>
  );
}
