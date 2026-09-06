'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, User, Fingerprint, ShieldCheck, Dumbbell, MapPin, Map } from 'lucide-react';

export default function SuccessPopup({ data, onClose }: { data: any, onClose: () => void }) {
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
      className="w-[620px] bg-white/60 backdrop-blur-3xl rounded-[28px] shadow-[0_20px_60px_rgba(34,197,94,0.15)] border border-white/80 p-6 flex flex-col gap-6 relative overflow-hidden"
    >
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-green-400/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-4 relative z-10">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg">
          <CheckCircle className="text-white w-8 h-8" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">ACCESS GRANTED</h2>
          <p className="text-sm font-semibold text-emerald-600 uppercase tracking-widest mt-0.5">Welcome {data.memberName}</p>
        </div>
        <div className="ml-auto text-right">
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tighter">{data.timestamp}</div>
          <div className="flex items-center justify-end gap-1 text-xs font-bold text-emerald-500 uppercase tracking-widest mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
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
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-green-400 to-emerald-600 ${data.avatarUrl ? 'hidden' : ''}`}>
              <span className="text-white font-black text-4xl tracking-tight">
                {data.memberName ? data.memberName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : '?'}
              </span>
            </div>
          </div>
          <div className="bg-white/80 p-3 rounded-xl border border-white space-y-2">
             <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
               <span>Member ID</span>
               <span className="text-slate-900 font-mono">{data.memberCode}</span>
             </div>
             <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-slate-500">
               <span>Device ID</span>
               <span className="text-slate-900 font-mono">{data.deviceName}</span>
             </div>
          </div>
        </div>

        {/* Right: Details Grid */}
        <div className="w-2/3 grid grid-cols-2 gap-3">
           <div className="bg-white/60 p-3 rounded-xl border border-white">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <ShieldCheck size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Membership</span>
              </div>
              <div className="text-sm font-black text-slate-900">{data.plan}</div>
              <div className="text-[10px] font-bold text-emerald-600 mt-1">{data.remainingDays || 30} Days Remaining</div>
           </div>
           
           <div className="bg-white/60 p-3 rounded-xl border border-white">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <User size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Trainer</span>
              </div>
              <div className="text-sm font-black text-slate-900">{data.trainer}</div>
           </div>

           <div className="bg-white/60 p-3 rounded-xl border border-white">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Dumbbell size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Today's Workout</span>
              </div>
              <div className="text-sm font-black text-slate-900">{data.workout || 'Push Day'}</div>
           </div>

           <div className="bg-white/60 p-3 rounded-xl border border-white">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <MapPin size={14} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Branch</span>
              </div>
              <div className="text-sm font-black text-slate-900">{data.branch}</div>
           </div>
        </div>
      </div>

      {/* Progress Timeline */}
      <div className="relative z-10 pt-2 border-t border-slate-200/50 flex justify-between items-center px-2">
         <div className="flex flex-col items-center gap-1">
           <Fingerprint size={16} className="text-emerald-500" />
           <span className="text-[8px] font-bold uppercase text-slate-500">Verified</span>
         </div>
         <div className="flex-1 h-px bg-slate-200 mx-4 relative overflow-hidden">
           <motion.div 
             className="absolute top-0 left-0 h-full bg-emerald-500" 
             initial={{ width: '0%' }}
             animate={{ width: '100%' }}
             transition={{ duration: 1, delay: 0.5 }}
           />
         </div>
         <div className="flex flex-col items-center gap-1">
           <ShieldCheck size={16} className="text-emerald-500" />
           <span className="text-[8px] font-bold uppercase text-slate-500">Active</span>
         </div>
         <div className="flex-1 h-px bg-slate-200 mx-4 relative overflow-hidden">
           <motion.div 
             className="absolute top-0 left-0 h-full bg-emerald-500" 
             initial={{ width: '0%' }}
             animate={{ width: '100%' }}
             transition={{ duration: 1, delay: 1 }}
           />
         </div>
         <div className="flex flex-col items-center gap-1">
           <Map size={16} className="text-emerald-500" />
           <span className="text-[8px] font-bold uppercase text-slate-500">Gate Open</span>
         </div>
      </div>

      {/* Bottom Progress Line */}
      <div className="absolute bottom-0 left-0 h-1.5 bg-green-500/20 w-full">
        <div 
          className="h-full bg-gradient-to-r from-green-400 to-emerald-500 rounded-r-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
}
