"use client";

import React from "react";
import { 
  UserPlus, 
  MessageSquare, 
  Receipt, 
  UploadCloud, 
  Fingerprint, 
  PhoneCall, 
  Sparkles, 
  RefreshCw,
  Zap
} from "lucide-react";
import { useRouter } from "next/navigation";

interface QuickActionsGridProps {
  onNewMember: () => void;
  onNewEnquiry: () => void;
  onFollowUp: () => void;
}

export default function QuickActionsGrid({
  onNewMember,
  onNewEnquiry,
  onFollowUp
}: QuickActionsGridProps) {
  const router = useRouter();

  const actions = [
    {
      label: "NEW MEMBER",
      desc: "Enroll & issue bio ID",
      icon: UserPlus,
      color: "#EA580C",
      bg: "bg-orange-50 border-orange-200 group-hover:bg-[#EA580C] group-hover:text-white",
      onClick: onNewMember
    },
    {
      label: "NEW ENQUIRY",
      desc: "Log prospect lead",
      icon: MessageSquare,
      color: "#9333EA",
      bg: "bg-purple-50 border-purple-200 group-hover:bg-purple-600 group-hover:text-white",
      onClick: onNewEnquiry
    },
    {
      label: "CREATE BILL",
      desc: "Invoice & payment",
      icon: Receipt,
      color: "#16A34A",
      bg: "bg-emerald-50 border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white",
      onClick: () => router.push("/dashboard/billing?action=create")
    },
    {
      label: "IMPORT MEMBERS",
      desc: "Excel batch sync",
      icon: UploadCloud,
      color: "#0284C7",
      bg: "bg-sky-50 border-sky-200 group-hover:bg-sky-600 group-hover:text-white",
      onClick: () => router.push("/dashboard/members?action=import")
    },
    {
      label: "ATTENDANCE",
      desc: "Roster & punch logs",
      icon: Fingerprint,
      color: "#D97706",
      bg: "bg-amber-50 border-amber-200 group-hover:bg-amber-600 group-hover:text-white",
      onClick: () => router.push("/dashboard/attendance")
    },
    {
      label: "FOLLOW-UP",
      desc: "Schedule reminders",
      icon: PhoneCall,
      color: "#EC4899",
      bg: "bg-pink-50 border-pink-200 group-hover:bg-pink-600 group-hover:text-white",
      onClick: onFollowUp
    },
    {
      label: "UPGRADE PLAN",
      desc: "VIP & PT tiers",
      icon: Sparkles,
      color: "#8B5CF6",
      bg: "bg-violet-50 border-violet-200 group-hover:bg-violet-600 group-hover:text-white",
      onClick: () => router.push("/dashboard/memberships")
    },
    {
      label: "RENEW PLAN",
      desc: "Expiring accounts",
      icon: RefreshCw,
      color: "#EA580C",
      bg: "bg-orange-50 border-orange-200 group-hover:bg-[#EA580C] group-hover:text-white",
      onClick: () => router.push("/dashboard/billing")
    }
  ];

  return (
    <div className="space-y-3.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-gradient-to-br from-[#F97316] to-[#EA580C] text-white flex items-center justify-center font-black shadow-xs">
            <Zap size={14} />
          </div>
          <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase font-sans">
            QUICK ACTIONS HUB
          </h3>
        </div>
        <span className="text-[10px] font-bold text-slate-400">Direct Command Shortcuts</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {actions.map((act, i) => {
          const Icon = act.icon;
          return (
            <button
              key={i}
              type="button"
              onClick={act.onClick}
              className="group bg-white rounded-2xl p-3.5 border border-stone-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_20px_rgba(234,88,12,0.12)] hover:border-[#EA580C] transition-all duration-200 cursor-pointer flex flex-col items-center text-center justify-between hover:-translate-y-1 active:scale-95"
            >
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border transition-all duration-200 mb-2 ${act.bg}`}>
                <Icon size={18} className="transition-transform group-hover:scale-110" />
              </div>
              <div>
                <div className="text-[10px] font-black tracking-wider text-slate-900 group-hover:text-[#EA580C] transition-colors leading-tight">
                  {act.label}
                </div>
                <div className="text-[9px] font-semibold text-slate-400 mt-0.5 leading-tight">
                  {act.desc}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
