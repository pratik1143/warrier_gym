"use client";

import React, { useState, useEffect } from "react";
import { collection, query, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db as fDb, isFirebaseReady } from "@/lib/firebase";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Fingerprint, 
  CreditCard, 
  RefreshCw, 
  UserPlus, 
  MessageSquare,
  Search,
  Activity
} from "lucide-react";

const getIconForType = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'attendance': return <Fingerprint size={16} className="text-emerald-500" />;
    case 'payment': return <CreditCard size={16} className="text-[#F97316]" />;
    case 'renewal': return <RefreshCw size={16} className="text-purple-500" />;
    case 'new_member': return <UserPlus size={16} className="text-amber-500" />;
    case 'followup': return <MessageSquare size={16} className="text-pink-500" />;
    case 'enquiry': return <Search size={16} className="text-indigo-500" />;
    default: return <Activity size={16} className="text-slate-400" />;
  }
};

const getBgForType = (type: string) => {
  switch (type?.toLowerCase()) {
    case 'attendance': return "bg-emerald-50 border-emerald-100";
    case 'payment': return "bg-[#FFF7ED] border-[#FED7AA]";
    case 'renewal': return "bg-purple-50 border-purple-100";
    case 'new_member': return "bg-amber-50 border-amber-100";
    case 'followup': return "bg-pink-50 border-pink-100";
    case 'enquiry': return "bg-indigo-50 border-indigo-100";
    default: return "bg-slate-50 border-slate-100";
  }
};

export default function LiveActivityFeed() {
  const [feed, setFeed] = useState<any[]>([]);

  useEffect(() => {
    if (!isFirebaseReady || !fDb) return;
    
    // Listen to real-time firestore 'live_feed' collection
    const feedQuery = query(collection(fDb, 'live_feed'), orderBy('timestamp', 'desc'), limit(50));
    const unsubscribeFeed = onSnapshot(feedQuery, (snapshot) => {
      const liveFeed = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setFeed(liveFeed);
    }, (err) => {
      console.warn("Firestore LiveActivityFeed query error:", err);
    });

    return () => unsubscribeFeed();
  }, []);

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 h-[500px] flex flex-col relative overflow-hidden">
      <div className="flex justify-between items-center mb-6 z-10 bg-white">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            Live Command Center
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
          </h2>
          <p className="text-xs text-slate-500 font-medium">Real-time gym activity feed</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
        <div className="space-y-4">
          <AnimatePresence initial={false}>
            {feed.map((item, index) => {
              const tsVal = item.timestamp || item.createdAt;
              const tsDate = tsVal ? (typeof tsVal.toDate === 'function' ? tsVal.toDate() : new Date(tsVal)) : new Date();
              const timeString = tsDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
              const avatar = item.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${item.memberName?.replace(/ /g, '') || 'User'}`;

              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: -20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  layout
                  transition={{ 
                    type: "spring", 
                    stiffness: 400, 
                    damping: 25,
                    mass: 0.8
                  }}
                  className={`flex items-center gap-4 p-3 rounded-2xl border transition-all hover:shadow-md hover:-translate-y-0.5 ${getBgForType(item.type)}`}
                >
                  <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm flex-shrink-0">
                    {getIconForType(item.type)}
                  </div>
                  
                  <img 
                    src={avatar} 
                    alt={item.memberName || "User"} 
                    className="w-10 h-10 rounded-full bg-white border border-black/5 shadow-sm object-cover flex-shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${item.id}` }}
                  />

                  <div className="flex-1 min-w-0">
                    <h4 className="text-[13px] font-black text-slate-800 truncate">
                      {item.memberName || "Unknown User"}
                    </h4>
                    <p className="text-[11px] font-bold text-slate-500 truncate">
                      {item.action || item.message || "Performed an action"}
                    </p>
                  </div>

                  <div className="text-right flex-shrink-0">
                    <span className="text-[10px] font-black text-slate-400 font-mono tracking-tighter">
                      {timeString}
                    </span>
                  </div>
                </motion.div>
              );
            })}
            
            {feed.length === 0 && (
              <div className="text-center py-10">
                <Activity size={40} className="mx-auto text-slate-200 mb-3 animate-pulse" />
                <p className="text-xs font-bold text-slate-400">Waiting for live activity...</p>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>
      
      {/* Fade out bottom overlay */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white to-transparent pointer-events-none" />
    </div>
  );
}
