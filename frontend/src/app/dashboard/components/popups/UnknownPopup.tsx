'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, UserX, Fingerprint, MapPin, Monitor } from 'lucide-react';

export default function UnknownPopup({ data, onClose, onRegister, onMap }: { data: any, onClose: () => void, onRegister: () => void, onMap: () => void }) {
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
      className="w-[620px] bg-white/60 backdrop-blur-3xl rounded-[28px] shadow-[0_20px_60px_rgba(239,68,68,0.15)] border border-white/80 p-6 flex flex-col gap-6 relative overflow-hidden"
    >
      {/* Background Glow */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-red-400/20 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-4 relative z-10">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-red-400 to-rose-600 flex items-center justify-center shadow-lg">
          <AlertTriangle className="text-white w-8 h-8 animate-pulse" />
        </div>
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">UNKNOWN BIOMETRIC</h2>
          <p className="text-sm font-semibold text-red-600 uppercase tracking-widest mt-0.5">No Member Found</p>
        </div>
        <div className="ml-auto text-right">
          <div className="text-2xl font-black text-slate-900 font-mono tracking-tighter">{data.timestamp}</div>
          <div className="flex items-center justify-end gap-1 text-xs font-bold text-red-500 uppercase tracking-widest mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
            LIVE
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex gap-6 relative z-10">
        {/* Left: Illustration */}
        <div className="w-1/3 flex flex-col gap-3">
          <div className="aspect-square rounded-2xl bg-red-50 border-2 border-red-100 shadow-inner overflow-hidden relative flex flex-col items-center justify-center text-red-400 p-4 text-center">
            <UserX size={48} className="mb-2" />
            <span className="text-[10px] font-bold uppercase tracking-wider">Unregistered Fingerprint</span>
          </div>
        </div>

        {/* Right: Details & Action */}
        <div className="w-2/3 flex flex-col gap-3 justify-center">
           <div className="bg-red-50/50 p-4 rounded-xl border border-red-100/50">
              <div className="flex gap-3">
                 <div>
                    <h4 className="font-bold text-slate-900">Access Denied</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      No member found for the scanned biometric ID. Reason: <strong>No biometric mapping found.</strong>
                    </p>
                 </div>
              </div>
           </div>

           <div className="grid grid-cols-2 gap-3 mt-1">
             <div className="bg-white/80 p-3 rounded-xl border border-white space-y-1">
               <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                 <Fingerprint size={12} />
                 <span className="text-[10px] font-bold uppercase tracking-wider">Biometric ID</span>
               </div>
               <span className="text-sm font-black text-slate-900 font-mono block">{data.memberCode}</span>
             </div>
             <div className="bg-white/80 p-3 rounded-xl border border-white space-y-1">
               <div className="flex items-center gap-1.5 text-slate-500 mb-0.5">
                 <Monitor size={12} />
                 <span className="text-[10px] font-bold uppercase tracking-wider">Device</span>
               </div>
               <span className="text-sm font-black text-slate-900 font-mono block truncate">{data.deviceName}</span>
             </div>
           </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="relative z-10 pt-4 border-t border-slate-200/50 flex justify-end gap-3">
         <button onClick={onClose} className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-500 hover:bg-slate-100 transition-colors">
           Ignore
         </button>
         <button onClick={onMap} className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-sm transition-all">
           Map Existing Member
         </button>
         <button onClick={onRegister} className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-md transition-all">
           Register Member
         </button>
      </div>

      {/* Bottom Progress Line */}
      <div className="absolute bottom-0 left-0 h-1.5 bg-red-500/20 w-full">
        <div 
          className="h-full bg-gradient-to-r from-red-400 to-rose-500 rounded-r-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
}
