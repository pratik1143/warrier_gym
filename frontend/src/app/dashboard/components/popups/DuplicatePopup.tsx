'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export default function DuplicatePopup({ data, onClose }: { data: any, onClose: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + (100 / 40); // 4 seconds at 100ms intervals
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, x: 50, filter: 'blur(10px)' }}
      animate={{ scale: 1, opacity: 1, x: 0, filter: 'blur(0px)' }}
      exit={{ scale: 0.9, opacity: 0, x: 50, filter: 'blur(10px)' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300, duration: 0.45 }}
      className="w-[620px] bg-white/60 backdrop-blur-3xl rounded-[28px] shadow-[0_20px_60px_rgba(59,130,246,0.15)] border border-white/80 p-6 flex flex-col gap-6 relative overflow-hidden"
    >
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-blue-400/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-4 relative z-10">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center shadow-lg">
          <RefreshCw className="text-white w-8 h-8 animate-spin-slow" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">ALREADY INSIDE</h2>
          <p className="text-sm font-semibold text-[#EA580C] uppercase tracking-widest mt-0.5">Duplicate Punch</p>
        </div>
        <div className="ml-auto text-right">
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tighter">{data.timestamp}</div>
          <div className="flex items-center justify-end gap-1 text-xs font-bold text-[#F97316] uppercase tracking-widest mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F97316] animate-pulse"></span>
            LIVE
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-6 relative z-10">
        {/* Left: Photo & IDs */}
        <div className="w-1/3 flex flex-col gap-3">
          <div className="aspect-square rounded-2xl bg-slate-100 border-2 border-white shadow-inner overflow-hidden relative">
            {data.avatarUrl ? (
              <img
                src={data.avatarUrl}
                alt={data.memberName}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
              />
            ) : null}
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-400 to-indigo-600 ${data.avatarUrl ? 'hidden' : ''}`}>
              <span className="text-white font-black text-4xl tracking-tight">
                {data.memberName ? data.memberName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '?'}
              </span>
            </div>
          </div>
        </div>

        {/* Right: Message & Details */}
        <div className="w-2/3 flex flex-col gap-3 justify-center">
           <div className="bg-[#FFF7ED] p-4 rounded-2xl border border-[#FED7AA]">
              <div className="flex gap-3">
                 <ShieldAlert className="text-[#EA580C] shrink-0 mt-0.5" size={20} />
                 <div>
                    <h4 className="font-extrabold text-slate-900 text-sm">Member is Already Inside</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed font-medium">
                      Duplicate punch for <strong className="text-slate-900 font-extrabold">{data.memberName}</strong> recorded at <span className="font-mono font-bold text-[#EA580C]">{data.timestamp}</span>. Member is already marked active inside the gym.
                    </p>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-3 gap-2 mt-1">
             <div className="bg-white/80 p-2.5 rounded-xl border border-slate-100 space-y-0.5">
               <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Bio / Ref ID</span>
               <span className="text-xs font-black text-slate-900 font-mono block truncate">{data.memberCode}</span>
             </div>
             <div className="bg-white/80 p-2.5 rounded-xl border border-slate-100 space-y-0.5">
               <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Plan</span>
               <span className="text-xs font-black text-[#EA580C] block truncate">{data.plan || 'Standard'}</span>
             </div>
             <div className="bg-white/80 p-2.5 rounded-xl border border-slate-100 space-y-0.5">
               <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 block">Days Left</span>
               <span className="text-xs font-black text-emerald-600 block truncate">{data.remainingDays} Days</span>
             </div>
           </div>
        </div>
      </div>

      {/* Bottom Progress Line */}
      <div className="absolute bottom-0 left-0 h-1.5 bg-blue-500/20 w-full">
        <div 
          className="h-full bg-gradient-to-r from-blue-400 to-indigo-500 rounded-r-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
}
