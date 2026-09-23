"use client";

import React from "react";
import { Receipt, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { getPaymentDateStr } from "@/hooks/useTodaysPayments";

interface RecentPaymentsTableProps {
  payments: any[];
  todayStr: string;
}

export default function RecentPaymentsTable({ payments, todayStr }: RecentPaymentsTableProps) {
  const router = useRouter();

  // Show today's bills only; the full historical ledger stays available from Billing.
  const validPayments = payments
    .filter((p: any) => {
      if (!p || p.isSample || p.isMock) return false;
      const isHist = p.isHistorical === true || p.imported === true || p.isLegacyImport === true || p.transactionType === "historical_import";
      if (isHist) return false;
      return true;
    })
    .sort((a: any, b: any) => String(b.createdAt || b.paymentDate || b.date || '').localeCompare(String(a.createdAt || a.paymentDate || a.date || '')))
    .slice(0, 8);

  const getStatusBadge = (p: any, amt: number, billed: number) => {
    const rawStatus = String(p.status || p.paymentStatus || "paid").toUpperCase();
    
    // Strict guard: Never show PAID ₹0 for someone who hasn't actually paid
    if (rawStatus === "NOT BILLED" || (amt === 0 && billed === 0)) {
      return {
        label: "NOT BILLED",
        badgeClass: "bg-stone-100 text-slate-600 border-stone-200"
      };
    }

    if (rawStatus === "PAID") {
      return {
        label: "PAID",
        badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-200"
      };
    }

    if (rawStatus === "PARTIAL") {
      return {
        label: "PARTIAL",
        badgeClass: "bg-amber-100 text-amber-800 border-amber-200"
      };
    }

    return {
      label: "UNPAID",
      badgeClass: "bg-red-100 text-red-800 border-red-200"
    };
  };

  return (
    <div className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/90 shadow-[0_2px_12px_rgba(0,0,0,0.03)] space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-stone-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center justify-center font-black">
              <Receipt size={17} />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight font-sans">
              TODAY&apos;S BILLS & COLLECTION
            </h3>
            <p className="text-[11px] font-semibold text-slate-400">
              {todayStr} · Bills recorded today only
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => router.push("/dashboard/billing")}
          className="flex items-center gap-1 text-[11px] font-extrabold text-[#EA580C] hover:text-orange-700 transition-colors cursor-pointer"
        >
          <span>Open Full Ledger</span>
          <ArrowRight size={13} />
        </button>
      </div>

      {/* Table */}
      {validPayments.length === 0 ? (
        <div className="p-8 text-center text-xs font-bold text-slate-400">
          No bills recorded today yet. Today’s collection starts at ₹0.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-stone-100 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                <th className="pb-2.5">Member</th>
                <th className="pb-2.5">Invoice</th>
                <th className="pb-2.5">Package</th>
                <th className="pb-2.5">Billed</th>
                <th className="pb-2.5">Collected</th>
                <th className="pb-2.5">Payment</th>
                <th className="pb-2.5">Status</th>
                <th className="pb-2.5 text-right">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {validPayments.map((p, idx) => {
                const rawStatus = String(p.status || p.paymentStatus || '').toLowerCase();
                const amt = Number(p.amountPaid ?? p.paid ?? ((rawStatus === 'paid' || rawStatus === 'partial') ? (p.amount ?? p.netPayable ?? 0) : 0)) || 0;
                const billed = Number(p.netPayable ?? p.grandTotal ?? p.total ?? p.amount ?? 0) || 0;
                const statusInfo = getStatusBadge(p, amt, billed);
                const invNum = p.invoiceNumber || p.invoice || `INV-${String(p.id || "").slice(-5).toUpperCase()}`;
                const dateStr = getPaymentDateStr(p.billingDate || p.createdAt || p.paymentDate || p.date);
                const formattedDate = dateStr ? new Date(`${dateStr}T12:00:00`).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "Today";

                return (
                  <tr key={idx} className="group hover:bg-orange-50/40 transition-colors">
                    <td className="py-3 font-bold text-slate-900 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-black text-[10px] flex items-center justify-center shrink-0">
                        {String(p.memberName || "M").charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate max-w-[140px]">{p.memberName || "Member"}</span>
                    </td>
                    <td className="py-3 font-mono text-[11px] font-bold text-slate-500">
                      {invNum}
                    </td>
                    <td className="py-3 font-semibold text-slate-600">
                      {p.plan || p.package || (p.isPT ? "PT Session" : "Regular Gym")}
                    </td>
                    <td className="py-3 font-black text-slate-900 font-sans">
                      ₹{billed.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 font-black text-[#C2410C] font-sans">
                      ₹{amt.toLocaleString("en-IN")}
                    </td>
                    <td className="py-3 font-bold text-slate-600">
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 text-[10px] uppercase font-bold">
                        {p.paymentMethod || p.method || "UPI"}
                      </span>
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[9.5px] font-black border tracking-wider ${statusInfo.badgeClass}`}>
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="py-3 text-right font-semibold text-slate-400 text-[11px]">
                      {formattedDate}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
