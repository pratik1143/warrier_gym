"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, UserPlus, Users, Briefcase, IndianRupee, FileText, Phone, Settings, X, Plus } from "lucide-react";
import { useGymStore } from "@/store";
import { useRouter } from "next/navigation";

export default function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { members, payments } = useGymStore();
  const router = useRouter();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setIsOpen((open) => !open);
      }
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const results = query === "" ? [] : members.filter((m: any) => 
    m.name?.toLowerCase().includes(query.toLowerCase()) ||
    m.phone?.includes(query)
  ).slice(0, 5);

  const quickActions = [
    { name: "New Member", icon: UserPlus, color: "text-emerald-500", bg: "bg-emerald-50", url: "/dashboard/members?action=new" },
    { name: "New Employee", icon: Briefcase, color: "text-indigo-500", bg: "bg-indigo-50", url: "/dashboard/employees" },
    { name: "Renew Membership", icon: RefreshCcw, color: "text-purple-500", bg: "bg-purple-50", url: "/dashboard/members?action=renew" },
    { name: "Add Expense", icon: IndianRupee, color: "text-rose-500", bg: "bg-rose-50", url: "/dashboard/analytics" },
    { name: "Schedule Followup", icon: Phone, color: "text-amber-500", bg: "bg-amber-50", url: "/dashboard/follow-up" },
    { name: "Import CSV", icon: FileText, color: "text-[#F97316]", bg: "bg-[#FFF7ED]", url: "/dashboard/settings/member-migration" }
  ];

  return (
    <>
      {/* Floating Action Button for Mobile / Mouse users */}
      <motion.button 
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-40 bg-slate-900 text-white p-4 rounded-full shadow-2xl flex items-center gap-2 group"
      >
        <Search size={20} />
        <span className="hidden md:inline-block font-bold text-xs tracking-wider uppercase pr-2">Command Center</span>
        <div className="hidden md:flex items-center gap-1 bg-white/20 px-1.5 py-0.5 rounded text-[10px]">
          <kbd>Ctrl</kbd> + <kbd>K</kbd>
        </div>
      </motion.button>

      {/* Command Palette Overlay */}
      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50"
              onClick={() => setIsOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="fixed top-[15%] left-1/2 -translate-x-1/2 w-[90%] max-w-2xl bg-white rounded-3xl shadow-2xl z-50 overflow-hidden border border-slate-200"
            >
              <div className="flex items-center px-4 py-3 border-b border-slate-100 relative">
                <Search size={20} className="text-slate-400 absolute left-6" />
                <input 
                  autoFocus
                  type="text" 
                  placeholder="Search members, payments, or type a command..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full bg-transparent pl-10 pr-10 py-3 text-lg font-medium text-slate-800 placeholder:text-slate-400 focus:outline-none"
                />
                <button 
                  onClick={() => setIsOpen(false)}
                  className="absolute right-6 text-slate-400 hover:bg-slate-100 p-1 rounded-md transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
                {query === "" && (
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-3">Quick Actions</h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {quickActions.map(action => (
                          <button 
                            key={action.name}
                            onClick={() => {
                              router.push(action.url);
                              setIsOpen(false);
                            }}
                            className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors text-left group"
                          >
                            <div className={`w-8 h-8 rounded-xl ${action.bg} ${action.color} flex items-center justify-center shrink-0`}>
                              <action.icon size={14} />
                            </div>
                            <span className="text-xs font-bold text-slate-700 group-hover:text-black">{action.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {query !== "" && results.length > 0 && (
                  <div>
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2 mb-3">Members</h4>
                    <div className="space-y-1">
                      {results.map((m: any) => (
                        <div 
                          key={m.id}
                          onClick={() => {
                            router.push(`/dashboard/members/${m.id}`);
                            setIsOpen(false);
                          }}
                          className="flex items-center justify-between p-3 rounded-2xl hover:bg-slate-50 cursor-pointer transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <img src={m.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${m.name}`} className="w-8 h-8 rounded-full" />
                            <div>
                              <div className="text-sm font-bold text-slate-800">{m.name}</div>
                              <div className="text-[10px] font-medium text-slate-500">{m.phone}</div>
                            </div>
                          </div>
                          <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${m.status === 'Active' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                            {m.status || 'Active'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {query !== "" && results.length === 0 && (
                  <div className="py-14 text-center">
                    <Search size={32} className="mx-auto text-slate-200 mb-3" />
                    <p className="text-sm font-medium text-slate-500">No results found for "{query}"</p>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

// Icon hack to avoid separate import
const RefreshCcw = ({size, className}:any) => <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>;
