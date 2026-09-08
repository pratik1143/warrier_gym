"use client";

import React, { useMemo } from "react";
import { Award, Clock, ArrowRight, AlertTriangle, RefreshCw, UserCheck, ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { SYSTEM_CONFIG } from "@/config/system";

interface MembershipOverviewWidgetProps {
  members: any[];
  onRenewMember?: (member: any) => void;
}

export default function MembershipOverviewWidget({ members, onRenewMember }: MembershipOverviewWidgetProps) {
  const router = useRouter();

  const todayStr = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: SYSTEM_CONFIG.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(new Date());
  }, []);

  // Compute 7 days from now
  const sevenDaysLaterStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: SYSTEM_CONFIG.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return formatter.format(d);
  }, []);

  // Aggregate membership tiers
  const {
    activeCount,
    holdCount,
    expiringSoonCount,
    expiredCount,
    frozenCount,
    expiringThisWeekList
  } = useMemo(() => {
    let active = 0;
    let hold = 0;
    let expiringSoon = 0;
    let expired = 0;
    let frozen = 0;
    const expiringList: any[] = [];

    const nowTime = new Date().getTime();

    members.forEach((m) => {
      if (!m) return;
      const statusLower = String(m.status || "").toLowerCase();

      if (statusLower === "frozen") {
        frozen++;
        return;
      }

      if (statusLower === "hold" || (!m.plan && !m.expiryDate)) {
        hold++;
        return;
      }

      const exp = String(m.expiryDate || "").split("T")[0];

      if (exp && exp < todayStr) {
        expired++;
      } else if (exp && exp >= todayStr && exp <= sevenDaysLaterStr) {
        active++;
        expiringSoon++;
        // Calculate days remaining
        const expTime = new Date(exp).getTime();
        const diffDays = Math.max(0, Math.ceil((expTime - nowTime) / (1000 * 60 * 60 * 24)));
        expiringList.push({
          ...m,
          daysRemaining: diffDays,
          formattedExp: new Date(exp).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
        });
      } else {
        active++;
      }
    });

    // Sort expiring list by nearest expiry first
    expiringList.sort((a, b) => (a.daysRemaining || 0) - (b.daysRemaining || 0));

    return {
      activeCount: active,
      holdCount: hold,
      expiringSoonCount: expiringSoon,
      expiredCount: expired,
      frozenCount: frozen,
      expiringThisWeekList: expiringList.slice(0, 5)
    };
  }, [members, todayStr, sevenDaysLaterStr]);

  const total = Math.max(members.length, 1);
  const activePct = Math.round((activeCount / total) * 100);
  const holdPct = Math.round((holdCount / total) * 100);
  const expiringPct = Math.round((expiringSoonCount / total) * 100);
  const expiredPct = Math.round((expiredCount / total) * 100);

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-6">
      
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 border border-purple-200 flex items-center justify-center font-black">
            <Award size={17} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight font-sans">
              MEMBERSHIP OVERVIEW
            </h3>
            <p className="text-[11px] font-semibold text-slate-400">
              Subscription lifecycle health, churn prevention & pending renewals
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push("/dashboard/expired")}
          className="flex items-center gap-1 text-[11px] font-extrabold text-[#EA580C] hover:text-orange-700 transition-colors cursor-pointer"
        >
          <span>View All Expired</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Horizontal Multi-color Progress Indicator Bar */}
      <div className="space-y-2">
        <div className="h-3.5 w-full bg-stone-100 rounded-full flex overflow-hidden p-0.5 gap-0.5">
          <div style={{ width: `${activePct}%` }} className="h-full bg-[#16A34A] rounded-l-full transition-all" title={`Active: ${activeCount}`} />
          <div style={{ width: `${expiringPct}%` }} className="h-full bg-[#F59E0B] transition-all" title={`Expiring: ${expiringSoonCount}`} />
          <div style={{ width: `${holdPct}%` }} className="h-full bg-[#3B82F6] transition-all" title={`Hold: ${holdCount}`} />
          <div style={{ width: `${expiredPct}%` }} className="h-full bg-[#DC2626] rounded-r-full transition-all" title={`Expired: ${expiredCount}`} />
        </div>

        {/* 5 Status Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
          <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-100 text-left">
            <div className="text-[9px] font-black uppercase text-emerald-800 tracking-wider">Active</div>
            <div className="text-lg font-black text-emerald-950 font-sans mt-0.5">{activeCount}</div>
          </div>

          <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-100 text-left">
            <div className="text-[9px] font-black uppercase text-amber-800 tracking-wider">Expiring (7D)</div>
            <div className="text-lg font-black text-amber-950 font-sans mt-0.5">{expiringSoonCount}</div>
          </div>

          <div className="p-2 rounded-xl bg-blue-50/70 border border-blue-100 text-left">
            <div className="text-[9px] font-black uppercase text-blue-800 tracking-wider">Hold / Pending</div>
            <div className="text-lg font-black text-blue-950 font-sans mt-0.5">{holdCount}</div>
          </div>

          <div className="p-2 rounded-xl bg-red-50/70 border border-red-100 text-left">
            <div className="text-[9px] font-black uppercase text-red-800 tracking-wider">Expired</div>
            <div className="text-lg font-black text-red-950 font-sans mt-0.5">{expiredCount}</div>
          </div>

          <div className="p-2 rounded-xl bg-stone-100 border border-stone-200 text-left">
            <div className="text-[9px] font-black uppercase text-slate-600 tracking-wider">Frozen</div>
            <div className="text-lg font-black text-slate-800 font-sans mt-0.5">{frozenCount}</div>
          </div>
        </div>
      </div>

      {/* Expiring This Week Section */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-amber-500" />
            Expiring This Week ({expiringThisWeekList.length})
          </span>
          <span className="text-slate-400 font-medium">Renewal outreach priority</span>
        </div>

        {expiringThisWeekList.length === 0 ? (
          <div className="p-4 rounded-2xl bg-stone-50 border border-stone-200/80 text-center text-xs font-bold text-slate-500">
            🎉 No memberships are expiring within the next 7 days!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-stone-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  <th className="pb-2">Member</th>
                  <th className="pb-2">Plan</th>
                  <th className="pb-2">Expiry Date</th>
                  <th className="pb-2">Remaining</th>
                  <th className="pb-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {expiringThisWeekList.map((m, idx) => (
                  <tr key={idx} className="group hover:bg-orange-50/40 transition-colors">
                    <td className="py-2.5 font-bold text-slate-900 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 text-white font-black text-[10px] flex items-center justify-center shrink-0">
                        {String(m.name || "M").charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate max-w-[130px]">{m.name}</span>
                    </td>
                    <td className="py-2.5 font-semibold text-slate-600">
                      {m.plan || "Standard Plan"}
                    </td>
                    <td className="py-2.5 font-semibold text-slate-500">
                      {m.formattedExp}
                    </td>
                    <td className="py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        m.daysRemaining <= 2 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-800"
                      }`}>
                        {m.daysRemaining === 0 ? "Today" : `${m.daysRemaining} days left`}
                      </span>
                    </td>
                    <td className="py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (onRenewMember) onRenewMember(m);
                          else router.push(`/dashboard/billing?memberId=${m.id || m.memberId}`);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#EA580C] hover:bg-orange-700 text-white text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-xs border-none"
                      >
                        Renew
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
