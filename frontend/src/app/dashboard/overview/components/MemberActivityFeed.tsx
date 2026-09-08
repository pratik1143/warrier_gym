"use client";

import React, { useMemo } from "react";
import { 
  Activity, 
  CreditCard, 
  Fingerprint, 
  UserPlus, 
  ArrowUpRight, 
  Sparkles,
  CheckCircle2,
  Clock
} from "lucide-react";
import { useRouter } from "next/navigation";

interface MemberActivityFeedProps {
  payments: any[];
  attendanceLogs: any[];
  members: any[];
}

export default function MemberActivityFeed({
  payments,
  attendanceLogs,
  members
}: MemberActivityFeedProps) {
  const router = useRouter();

  // Combine real events from payments, check-ins, and registrations
  const activityEvents = useMemo(() => {
    const events: any[] = [];

    // 1. Add Recent Payments
    payments.slice(0, 10).forEach((p) => {
      const amt = Number(p.amountPaid !== undefined ? p.amountPaid : (p.paid !== undefined ? p.paid : (p.amount || 0))) || 0;
      const ts = p.paymentDate || p.date || p.createdAt || new Date().toISOString();
      events.push({
        id: `pay_${p.id || p.paymentId || Math.random()}`,
        name: p.memberName || "Member",
        action: p.isPT ? "PT Session Billed" : "Payment Received",
        detail: `₹${amt.toLocaleString("en-IN")} · ${p.plan || p.package || "Invoice"}`,
        timestamp: new Date(ts).getTime() || Date.now(),
        badge: String(p.status || "PAID").toUpperCase(),
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200",
        icon: CreditCard,
        iconBg: "bg-orange-50 text-[#EA580C] border-orange-200"
      });
    });

    // 2. Add Recent Attendance check-ins
    attendanceLogs.slice(0, 10).forEach((a) => {
      const ts = a.checkIn || a.timestamp || a.createdAt || new Date().toISOString();
      events.push({
        id: `att_${a.id || Math.random()}`,
        name: a.memberName || `Biometric #${a.biometricId || a.deviceUserId || "Turnstile"}`,
        action: "Checked into Gym",
        detail: a.device || a.branch || "Main Entrance Gate",
        timestamp: new Date(ts).getTime() || Date.now(),
        badge: "VERIFIED",
        badgeClass: "bg-blue-100 text-blue-800 border-blue-200",
        icon: Fingerprint,
        iconBg: "bg-blue-50 text-blue-600 border-blue-200"
      });
    });

    // 3. Add Recent Registrations
    members.slice(0, 5).forEach((m) => {
      const ts = m.joinDate || m.createdAt || new Date().toISOString();
      const isHold = m.status === "hold" || (!m.plan && !m.expiryDate);
      events.push({
        id: `mem_${m.id || Math.random()}`,
        name: m.name || "New Client",
        action: isHold ? "New Member (Hold)" : "Membership Activated",
        detail: m.plan ? `${m.plan} Tier` : `Bio ID: ${m.biometricId || "Unassigned"}`,
        timestamp: new Date(ts).getTime() || Date.now(),
        badge: isHold ? "HOLD" : "ACTIVE",
        badgeClass: isHold ? "bg-amber-100 text-amber-800 border-amber-200" : "bg-emerald-100 text-emerald-800 border-emerald-200",
        icon: UserPlus,
        iconBg: "bg-purple-50 text-purple-600 border-purple-200"
      });
    });

    // Sort descending by timestamp
    events.sort((a, b) => b.timestamp - a.timestamp);
    return events.slice(0, 8);
  }, [payments, attendanceLogs, members]);

  // Relative time helper
  const getRelativeTime = (timeMs: number) => {
    const diffSec = Math.floor((Date.now() - timeMs) / 1000);
    if (diffSec < 60) return "Just now";
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-orange-50 text-[#EA580C] border border-orange-200 flex items-center justify-center font-black">
            <Activity size={16} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight font-sans">
              MEMBER ACTIVITY
            </h3>
            <p className="text-[11px] font-semibold text-slate-400">
              Live ledger transactions, punch records & status updates
            </p>
          </div>
        </div>

        <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase tracking-wider">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          Live Feed
        </span>
      </div>

      {/* Activity Timeline List */}
      <div className="divide-y divide-stone-100">
        {activityEvents.length === 0 ? (
          <div className="py-8 text-center text-xs font-bold text-slate-400">
            No live activity logs recorded yet today.
          </div>
        ) : (
          activityEvents.map((evt) => {
            const Icon = evt.icon;
            return (
              <div key={evt.id} className="py-3 flex items-center justify-between gap-3 hover:bg-stone-50/70 rounded-2xl px-2 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 border ${evt.iconBg}`}>
                    <Icon size={16} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900 truncate">
                        {evt.name}
                      </span>
                      <span className={`px-1.5 py-0.2 rounded-md text-[9px] font-black tracking-wider border ${evt.badgeClass}`}>
                        {evt.badge}
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-slate-500 truncate">
                      {evt.action} <span className="text-slate-400">·</span> <span className="text-slate-700 font-bold">{evt.detail}</span>
                    </div>
                  </div>
                </div>

                <div className="text-[10px] font-bold text-slate-400 shrink-0 flex items-center gap-1">
                  <Clock size={11} />
                  <span>{getRelativeTime(evt.timestamp)}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
