'use client';

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Clock, User, Fingerprint, ShieldCheck, Dumbbell, MapPin, Calendar, Cake, Trophy, Phone, CreditCard, X, ArrowRight } from 'lucide-react';

export default function SuccessPopup({ data, onClose, onViewMember }: { data: any, onClose: () => void, onViewMember: () => void }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          return 100;
        }
        return prev + (100 / 70); // 7 seconds total
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
      className="w-full max-w-[620px] bg-slate-900/95 backdrop-blur-2xl text-slate-100 rounded-[28px] shadow-[0_25px_70px_rgba(0,0,0,0.6)] border border-slate-800 p-6 flex flex-col gap-5 relative overflow-hidden text-left"
    >
      {/* Background Ambient Glows */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/15 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl -ml-20 -mb-20 pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between relative z-10 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shadow-inner text-emerald-400 shrink-0">
            <CheckCircle className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-black text-[10px] uppercase tracking-wider border border-emerald-500/30">
                ✓ CHECK-IN SUCCESSFUL
              </span>
            </div>
            <h2 className="text-xl font-black text-white tracking-tight mt-0.5 uppercase">
              {data.memberName}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right font-mono">
            <div className="text-lg font-black text-white leading-none">{data.timestamp}</div>
            <div className="text-[10px] text-slate-400 font-bold uppercase mt-1">{data.dateStr}</div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center justify-center transition-colors border-none cursor-pointer shrink-0"
            title="Close Popup"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Birthday Celebration Banner */}
      {data.isBirthday && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10 bg-gradient-to-r from-pink-500/20 via-purple-500/20 to-amber-500/20 border border-pink-500/40 rounded-2xl p-3 flex items-center gap-3 text-pink-200"
        >
          <div className="w-10 h-10 rounded-xl bg-pink-500/30 border border-pink-400/40 flex items-center justify-center text-pink-300 shrink-0">
            <Cake size={22} className="animate-bounce" />
          </div>
          <div>
            <div className="font-black text-xs uppercase tracking-wider text-pink-300">
              🎂 HAPPY BIRTHDAY!
            </div>
            <div className="text-xs font-semibold text-slate-200">
              Happy Birthday, {data.memberName}! The Warrior Gym wishes you a power-packed year ahead! 🎉
            </div>
          </div>
        </motion.div>
      )}

      {/* Membership Anniversary Banner */}
      {data.isAnniversary && (
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="relative z-10 bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-orange-500/20 border border-amber-500/40 rounded-2xl p-3 flex items-center gap-3 text-amber-200"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/30 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
            <Trophy size={22} />
          </div>
          <div>
            <div className="font-black text-xs uppercase tracking-wider text-amber-300">
              🏆 MEMBERSHIP ANNIVERSARY
            </div>
            <div className="text-xs font-semibold text-slate-200">
              {data.anniversaryYears} Year{data.anniversaryYears > 1 ? 's' : ''} with The Warrior Gym! Thank you for your dedication! 💪
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Content Body */}
      <div className="flex flex-col sm:flex-row gap-5 relative z-10">
        
        {/* Left Column: Photo & IDs */}
        <div className="w-full sm:w-1/3 flex flex-col gap-3">
          <div className="aspect-square rounded-2xl bg-slate-800 border border-slate-700 shadow-inner overflow-hidden relative group">
            {data.avatarUrl ? (
              <img
                src={data.avatarUrl}
                alt={data.memberName}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden'); }}
              />
            ) : null}
            <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-orange-600 to-amber-700 ${data.avatarUrl ? 'hidden' : ''}`}>
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
            {data.phone && (
              <div className="flex justify-between items-center text-slate-400">
                <span>Phone:</span>
                <span className="text-slate-300 font-bold">{data.phone}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Membership & Status Grid */}
        <div className="w-full sm:w-2/3 grid grid-cols-2 gap-3 text-left">
          
          {/* Package */}
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-extrabold uppercase tracking-wider mb-1">
              <ShieldCheck size={13} className="text-orange-400" /> Package
            </div>
            <div className="text-sm font-black text-white truncate">{data.plan}</div>
            <div className="text-[10px] font-bold text-emerald-400 mt-1">
              {data.remainingDays} Days Remaining
            </div>
          </div>

          {/* Membership Status */}
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-extrabold uppercase tracking-wider mb-1">
              <User size={13} className="text-purple-400" /> Status
            </div>
            <div className="inline-block px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-black uppercase">
              {data.status}
            </div>
            <div className="text-[10px] text-slate-400 font-bold mt-1">
              Expiry: {data.expiryDate}
            </div>
          </div>

          {/* Payment Status */}
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-extrabold uppercase tracking-wider mb-1">
              <CreditCard size={13} className="text-emerald-400" /> Payment
            </div>
            <div className={`text-xs font-black uppercase ${data.payStatus === 'FULLY PAID' ? 'text-emerald-400' : 'text-amber-400'}`}>
              {data.payStatus}
            </div>
            <div className="text-[10px] text-slate-400 font-bold mt-1">
              Start: {data.startDate}
            </div>
          </div>

          {/* Attendance Method */}
          <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-slate-800/80">
            <div className="flex items-center gap-1.5 text-slate-400 text-[10px] font-extrabold uppercase tracking-wider mb-1">
              <Fingerprint size={13} className="text-orange-400" /> Method
            </div>
            <div className="text-xs font-black text-white truncate">{data.method}</div>
            <div className="text-[10px] text-slate-400 font-mono mt-1">{data.deviceName}</div>
          </div>

          {/* PT Information (If Assigned) */}
          {data.trainer && data.trainer !== 'No PT Assigned' && (
            <div className="col-span-2 bg-gradient-to-r from-orange-900/30 to-amber-900/30 p-3 rounded-2xl border border-orange-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Dumbbell size={16} className="text-orange-400 shrink-0" />
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-orange-300">Personal Training</div>
                  <div className="text-xs font-black text-white">{data.trainer}</div>
                </div>
              </div>
              <span className="px-2 py-0.5 bg-orange-500/20 text-orange-300 border border-orange-400/30 rounded-full text-[10px] font-extrabold uppercase">
                ACTIVE PT
              </span>
            </div>
          )}

        </div>
      </div>

      {/* Action Buttons */}
      <div className="relative z-10 pt-3 border-t border-slate-800/80 flex items-center justify-between gap-3">
        <button
          onClick={onClose}
          className="px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-slate-400 hover:text-white hover:bg-slate-800 transition-all border-none cursor-pointer"
        >
          Close
        </button>

        <button
          onClick={onViewMember}
          className="px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider bg-[#EA580C] hover:bg-orange-600 text-white shadow-lg transition-all border-none cursor-pointer flex items-center gap-2"
        >
          View Member <ArrowRight size={14} />
        </button>
      </div>

      {/* Auto-Dismiss Progress Bar */}
      <div className="absolute bottom-0 left-0 h-1 bg-slate-800 w-full">
        <div 
          className="h-full bg-gradient-to-r from-emerald-500 to-orange-500 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </motion.div>
  );
}
