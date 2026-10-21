'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, ShieldAlert, CreditCard, X, ArrowRight, User } from 'lucide-react';

export default function ExpiredPopup({ data, onClose, onRenew }: { data: any, onClose: () => void, onRenew: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + (100 / 70); // 7 seconds
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0, y: 30, filter: 'blur(10px)' }}
      animate={{ scale: 1, opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ scale: 0.9, opacity: 0, y: 30, filter: 'blur(10px)' }}
      transition={{ type: 'spring', damping: 25, stiffness: 300, duration: 0.45 }}
      className="w-full max-w-[620px] bg-slate-900/95 backdrop-blur-2xl text-slate-100 rounded-[28px] shadow-[0_25px_70px_rgba(249,115,22,0.3)] border border-orange-500/30 p-6 flex flex-col gap-5 relative overflow-hidden text-left"
    >
      <div className="absolute top-0 right-0 w-64 h-64 bg-orange-500/15 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between relative z-10 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shadow-inner text-orange-400 shrink-0">
            <Clock className="w-7 h-7 animate-pulse" />
          </div>
          <div>
            <span className="px-2 py-0.5 rounded-md bg-orange-500/20 text-orange-400 font-black text-[10px] uppercase tracking-wider border border-orange-500/30">
              ⚠ MEMBERSHIP EXPIRED
            </span>
            <h2 className="text-xl font-black text-white tracking-tight mt-0.5 uppercase">
              {data.memberName}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right font-mono">
            <div className="text-lg font-black text-white leading-none">{data.timestamp}</div>
            <div className="text-[10px] text-orange-400 font-bold uppercase mt-1">RESTRICTED</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors border-none cursor-pointer shrink-0"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Main Content Body */}
      <div className="flex flex-col sm:flex-row gap-5 relative z-10">
        <div className="w-full sm:w-1/3 flex flex-col gap-3">
          <div className="aspect-square rounded-2xl bg-slate-800 border border-slate-700 shadow-inner overflow-hidden relative">
            {data.avatarUrl ? (
              <img
                src={data.avatarUrl}
                alt={data.memberName}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
              />
            ) : null}
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-500 to-amber-700 ${data.avatarUrl ? 'hidden' : ''}`}>
              <span className="text-white font-black text-3xl tracking-tight">
                {data.memberName ? data.memberName.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2) : 'AZ'}
              </span>
            </div>
          </div>

          <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 space-y-1.5 text-xs font-mono">
            <div className="flex justify-between items-center text-slate-400">
              <span>Member ID:</span>
              <span className="text-orange-400 font-bold">{data.memberCode}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Biometric ID:</span>
              <span className="text-slate-200 font-bold">#{data.biometricId}</span>
            </div>
          </div>
        </div>

        <div className="w-full sm:w-2/3 flex flex-col gap-3 justify-center">
          <div className="bg-orange-950/40 p-4 rounded-2xl border border-orange-500/30">
            <div className="flex gap-3">
              <ShieldAlert className="text-orange-400 shrink-0 mt-0.5" size={20} />
              <div>
                <h4 className="font-extrabold text-sm text-white">{data.memberName}'s membership expired!</h4>
                <p className="text-xs text-orange-200/80 mt-1 leading-relaxed">
                  Expired on {data.expiryDate || 'recently'}. Please renew the membership in CRM to restore access.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-1 text-left">
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Package</span>
              <span className="text-xs font-black text-white block truncate">{data.plan}</span>
            </div>
            <div className="bg-slate-950/60 p-3 rounded-2xl border border-slate-800 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Status</span>
              <span className="text-xs font-black text-orange-400 block">EXPIRED</span>
            </div>
          </div>
        </div>
      </div>

      {/* Action Footer */}
      <div className="relative z-10 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-800 transition-all border-none cursor-pointer"
        >
          Dismiss
        </button>

        <button
          onClick={onRenew}
          className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg transition-all border-none cursor-pointer flex items-center gap-2"
        >
          <CreditCard size={14} /> Renew Membership
        </button>
      </div>

      {/* Progress Bar */}
      <div className="absolute bottom-0 left-0 h-1 bg-slate-800 w-full">
        <div 
          className="h-full bg-gradient-to-r from-orange-500 to-amber-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
}
