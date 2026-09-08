"use client";

import React from "react";
import { 
  IndianRupee, 
  Users, 
  UserCheck, 
  PhoneCall, 
  MessageSquare, 
  TrendingUp, 
  ArrowUpRight,
  ChevronRight
} from "lucide-react";

interface KPICommandStripProps {
  todaysCollection: number;
  activeMembersCount: number;
  totalMembersCount: number;
  presentTodayCount: number;
  todaysFollowupsCount: number;
  newEnquiriesCount: number;
  onOpenBilling: () => void;
  onOpenMembers: () => void;
  onOpenPresentModal: () => void;
  onOpenFollowups: () => void;
  onOpenEnquiries: () => void;
}

// Helper Mini SVG Sparkline Component
function MiniSparkline({ points, color = "#F97316" }: { points: number[]; color?: string }) {
  const min = Math.min(...points);
  const max = Math.max(...points) || 1;
  const range = max - min || 1;
  const width = 64;
  const height = 24;

  const pathD = points
    .map((val, idx) => {
      const x = (idx / (points.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 4) - 2;
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0">
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function KPICommandStrip({
  todaysCollection,
  activeMembersCount,
  totalMembersCount,
  presentTodayCount,
  todaysFollowupsCount,
  newEnquiriesCount,
  onOpenBilling,
  onOpenMembers,
  onOpenPresentModal,
  onOpenFollowups,
  onOpenEnquiries
}: KPICommandStripProps) {
  const activeRate = totalMembersCount > 0 ? Math.round((activeMembersCount / totalMembersCount) * 100) : 100;

  const kpis = [
    {
      label: "TODAY'S COLLECTION",
      value: `₹${todaysCollection.toLocaleString("en-IN")}`,
      comparison: "Live Inflow",
      trend: "Real-time",
      trendUp: true,
      sparkline: [8, 12, 11, 15, 14, 18, 22],
      icon: IndianRupee,
      iconColor: "#EA580C",
      iconBg: "bg-orange-50 border-orange-100",
      accentBorder: "group-hover:border-orange-400",
      onClick: onOpenBilling,
    },
    {
      label: "ACTIVE MEMBERS",
      value: activeMembersCount,
      comparison: `${activeRate}% active rate`,
      trend: `${totalMembersCount} Total`,
      trendUp: true,
      sparkline: [20, 22, 24, 25, 27, 28, 30],
      icon: Users,
      iconColor: "#16A34A",
      iconBg: "bg-emerald-50 border-emerald-100",
      accentBorder: "group-hover:border-emerald-400",
      onClick: onOpenMembers,
    },
    {
      label: "PRESENT TODAY",
      value: presentTodayCount,
      comparison: "Verified Check-ins",
      trend: "Roster Active",
      trendUp: true,
      sparkline: [5, 12, 19, 14, 25, 32, 28],
      icon: UserCheck,
      iconColor: "#2563EB",
      iconBg: "bg-blue-50 border-blue-100",
      accentBorder: "group-hover:border-blue-400",
      onClick: onOpenPresentModal,
    },
    {
      label: "TODAY'S FOLLOW-UPS",
      value: todaysFollowupsCount,
      comparison: "Calls & Reminders",
      trend: "Due Today",
      trendUp: todaysFollowupsCount > 0,
      sparkline: [2, 4, 3, 6, 5, 8, 7],
      icon: PhoneCall,
      iconColor: "#D97706",
      iconBg: "bg-amber-50 border-amber-100",
      accentBorder: "group-hover:border-amber-400",
      onClick: onOpenFollowups,
    },
    {
      label: "NEW ENQUIRIES",
      value: newEnquiriesCount,
      comparison: "Pipeline Leads",
      trend: "Active Prospects",
      trendUp: true,
      sparkline: [3, 4, 6, 8, 7, 10, 12],
      icon: MessageSquare,
      iconColor: "#9333EA",
      iconBg: "bg-purple-50 border-purple-100",
      accentBorder: "group-hover:border-purple-400",
      onClick: onOpenEnquiries,
    }
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {kpis.map((kpi, idx) => (
        <div
          key={idx}
          onClick={kpi.onClick}
          className={`group bg-white rounded-2xl p-4 border border-stone-200/90 shadow-[0_2px_8px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(234,88,12,0.1)] transition-all duration-200 cursor-pointer flex flex-col justify-between ${kpi.accentBorder} hover:-translate-y-0.5`}
        >
          {/* Header Row: Label & Small Arrow */}
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 truncate">
              {kpi.label}
            </span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center border ${kpi.iconBg} shrink-0`}>
              <kpi.icon size={13} style={{ color: kpi.iconColor }} />
            </div>
          </div>

          {/* Metric Value & Sparkline Row */}
          <div className="my-2.5 flex items-baseline justify-between gap-2">
            <div className="text-2xl lg:text-[26px] font-black text-slate-900 tracking-tight leading-none font-sans">
              {kpi.value}
            </div>
            <MiniSparkline points={kpi.sparkline} color={kpi.iconColor} />
          </div>

          {/* Footer Comparison Row */}
          <div className="pt-2 border-t border-stone-100 flex items-center justify-between text-[10px]">
            <span className="font-semibold text-slate-500 truncate">
              {kpi.comparison}
            </span>
            <span className="font-bold text-[#EA580C] group-hover:translate-x-0.5 transition-transform flex items-center gap-0.5 shrink-0">
              View <ChevronRight size={10} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
