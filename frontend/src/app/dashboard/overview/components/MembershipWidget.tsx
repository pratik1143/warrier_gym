"use client";

import React, { useState } from "react";
import { useGymStore } from "@/store";
import { motion, AnimatePresence } from "framer-motion";
import { CreditCard, Calendar, User, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import RenewalWizardModal from "../../members/components/RenewalWizardModal";

export default function MembershipWidget() {
  const router = useRouter();
  const { members } = useGymStore();
  const [activeTab, setActiveTab] = useState<"Today" | "Tomorrow" | "3Days" | "7Days">("Today");
  const [selectedMemberForRenew, setSelectedMemberForRenew] = useState<any>(null);

  const now = new Date();
  now.setHours(0,0,0,0);

  const filterMembers = (daysOffset: number, exact: boolean) => {
    const targetDate = new Date(now);
    targetDate.setDate(targetDate.getDate() + daysOffset);

    return members.filter(m => {
      if (!m.expiryDate) return false;
      const mDate = new Date(m.expiryDate);
      mDate.setHours(0,0,0,0);

      if (exact) {
        return mDate.getTime() === targetDate.getTime();
      } else {
        return mDate > now && mDate <= targetDate;
      }
    });
  };

  const expiringList = 
    activeTab === "Today" ? filterMembers(0, true) :
    activeTab === "Tomorrow" ? filterMembers(1, true) :
    activeTab === "3Days" ? filterMembers(3, false) :
    filterMembers(7, false);

  const getGradient = (index: number) => {
    const gradients = [
      "from-indigo-500 to-purple-600",
      "from-blue-500 to-cyan-500",
      "from-emerald-400 to-teal-500",
      "from-rose-400 to-red-500",
      "from-amber-400 to-orange-500"
    ];
    return gradients[index % gradients.length];
  };

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mt-6 relative overflow-hidden text-left">
      {/* Decorative blurred blob */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl opacity-50 -z-10 pointer-events-none" />

      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            Upcoming Renewals
          </h2>
          <p className="text-xs text-slate-500 font-medium">Apple Wallet style cards</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto hide-scrollbar">
        {["Today", "Tomorrow", "3Days", "7Days"].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors cursor-pointer ${
              activeTab === tab 
                ? "bg-slate-900 text-white shadow-md" 
                : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {tab.replace("Days", " Days")}
            <span className="ml-1.5 opacity-60">
              ({tab === "Today" ? filterMembers(0,true).length :
                tab === "Tomorrow" ? filterMembers(1,true).length :
                tab === "3Days" ? filterMembers(3,false).length :
                filterMembers(7,false).length})
            </span>
          </button>
        ))}
      </div>

      <div className="relative min-h-[220px]">
        <AnimatePresence mode="popLayout">
          {expiringList.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto pb-4 hide-scrollbar snap-x snap-mandatory px-1">
              {expiringList.map((item, idx) => (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.8, x: 50 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: -50 }}
                  transition={{ type: "spring", bounce: 0.3, duration: 0.6, delay: idx * 0.05 }}
                  onClick={() => router.push(`/dashboard/members/${encodeURIComponent(item.id || item.docId || '')}/renew`)}
                  className={`snap-center shrink-0 w-72 h-44 rounded-2xl bg-gradient-to-br ${getGradient(idx)} p-5 text-white shadow-lg relative overflow-hidden group flex flex-col justify-between cursor-pointer hover:shadow-xl transition-all`}
                >
                  {/* Glass reflection */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/10 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none transform -translate-x-full group-hover:translate-x-full" style={{ transition: 'all 1.5s ease' }} />
                  
                  {/* Card Header */}
                  <div className="flex justify-between items-start z-10">
                    <div className="flex items-center gap-3">
                      <img 
                        src={item.photo || item.avatarUrl || item.avatar || `https://api.dicebear.com/7.x/adventurer/svg?seed=${item.name?.replace(/ /g,'') || item.id}`}
                        className="w-10 h-10 rounded-full bg-white/20 backdrop-blur-sm border border-white/30 shadow-sm object-cover"
                      />
                      <div>
                        <h4 className="font-black text-sm drop-shadow-sm">{item.name || 'Member'}</h4>
                        <p className="text-[10px] font-medium text-white/80">{item.phone}</p>
                      </div>
                    </div>
                    <CreditCard size={20} className="opacity-50" />
                  </div>

                  {/* Card Body */}
                  <div className="z-10">
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/70 mb-1">Package</p>
                    <h5 className="font-bold text-lg leading-tight">{item.plan || 'No Plan'}</h5>
                  </div>

                  {/* Card Footer */}
                  <div className="flex justify-between items-end z-10">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-white/70 mb-0.5">Expires</p>
                      <p className="font-bold text-xs flex items-center gap-1 font-mono">
                        <Calendar size={12} />
                        {item.expiryDate ? new Date(item.expiryDate).toLocaleDateString('en-GB') : 'Unknown'}
                      </p>
                    </div>
                    <button 
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/dashboard/members/${encodeURIComponent(item.id || item.docId || '')}/renew`);
                      }}
                      className="bg-white/20 hover:bg-white/40 backdrop-blur-md border border-white/40 px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 cursor-pointer shadow-sm active:scale-95"
                    >
                      Renew <ChevronRight size={12} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 flex flex-col items-center justify-center text-slate-400"
            >
              <CreditCard size={40} className="opacity-20 mb-3" />
              <p className="text-xs font-bold">No upcoming renewals for this period.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── RENEWAL WIZARD MODAL ── */}
      {selectedMemberForRenew && (
        <RenewalWizardModal
          isOpen={!!selectedMemberForRenew}
          member={selectedMemberForRenew}
          onClose={() => setSelectedMemberForRenew(null)}
        />
      )}
    </div>
  );
}
