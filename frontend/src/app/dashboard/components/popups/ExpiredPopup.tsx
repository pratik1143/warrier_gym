'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, ShieldAlert, CreditCard } from 'lucide-react';

export default function ExpiredPopup({ data, onClose, onRenew }: { data: any, onClose: () => void, onRenew: () => void }) {
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
      className="w-[620px] bg-white/60 backdrop-blur-3xl rounded-[28px] shadow-[0_20px_60px_rgba(249,115,22,0.15)] border border-white/80 p-6 flex flex-col gap-6 relative overflow-hidden"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-400/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

      <div className="flex items-center gap-4 relative z-10">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-400 to-amber-600 flex items-center justify-center shadow-lg">
          <Clock className="text-white w-8 h-8 animate-pulse" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">MEMBERSHIP EXPIRED</h2>
          <p className="text-sm font-semibold text-orange-600 uppercase tracking-widest mt-0.5">Access Restricted</p>
        </div>
        <div className="ml-auto text-right">
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tighter">{data.timestamp}</div>
          <div className="flex items-center justify-end gap-1 text-xs font-bold text-orange-500 uppercase tracking-widest mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse"></span>
            LIVE
          </div>
        </div>
      </div>

      <div className="flex gap-6 relative z-10">
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
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-400 to-amber-600 ${data.avatarUrl ? 'hidden' : ''}`}>
              <span className="text-white font-black text-4xl tracking-tight">
                {data.memberName ? data.memberName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '?'}
              </span>
            </div>
          </div>
        </div>

        <div className="w-2/3 flex flex-col gap-3 justify-center">
           <div className="bg-orange-50/50 p-4 rounded-xl border border-orange-100/50">
              <div className="flex gap-3">
                 <ShieldAlert className="text-orange-500 shrink-0 mt-0.5" />
                 <div>
                    <h4 className="font-bold text-slate-900">{data.memberName}'s membership has expired.</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Expired {data.expiredDays || 'several'} days ago. Please renew the membership to grant access.
                    </p>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-3 mt-1">
             <div className="bg-white/80 p-3 rounded-xl border border-white space-y-1">
               <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Member ID</span>
               <span className="text-sm font-black text-slate-900 font-mono block">{data.memberCode}</span>
             </div>
             <div className="bg-white/80 p-3 rounded-xl border border-white space-y-1">
               <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Last Plan</span>
               <span className="text-sm font-black text-slate-900 block truncate">{data.plan}</span>
             </div>
           </div>
        </div>
      </div>

      <div className="relative z-10 pt-4 border-t border-slate-200/50 flex justify-end gap-3">
         <button onClick={onClose} className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-500 hover:bg-slate-100 transition-colors">
           Cancel
         </button>
         <button onClick={onClose} className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-all">
           Temporary Access
         </button>
         <button onClick={onRenew} className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-md transition-all flex items-center gap-2">
           <CreditCard size={14} /> Renew Membership
         </button>
      </div>

      <div className="absolute bottom-0 left-0 h-1.5 bg-orange-500/20 w-full">
        <div 
          className="h-full bg-gradient-to-r from-orange-400 to-amber-500 rounded-r-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
}
