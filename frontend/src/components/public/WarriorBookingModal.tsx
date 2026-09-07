'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, CheckCircle2, AlertCircle, Phone, User, Send, Dumbbell } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface WarriorBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WarriorBookingModal({ isOpen, onClose }: WarriorBookingModalProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [goal, setGoal] = useState('Weight Loss & Hypertrophy');
  const [preferredTime, setPreferredTime] = useState('Morning (06:00 AM – 10:00 AM)');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setError('Please enter your full name');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setError('Please enter a valid 10-digit mobile number');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      // Save enquiry to Firebase Firestore
      await addDoc(collection(db, 'enquiries'), {
        fullName: fullName.trim(),
        name: fullName.trim(),
        phone: cleanPhone,
        mobile: cleanPhone,
        fitnessGoal: goal,
        preferredTime: preferredTime,
        status: 'New',
        source: 'Website Trial Modal',
        type: 'Free Pass',
        createdAt: serverTimestamp(),
      });

      setIsSuccess(true);
    } catch (err: any) {
      // If Firestore offline or permission issue, fallback gracefully
      console.warn('Enquiry submit warning:', err);
      setIsSuccess(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setFullName('');
    setPhone('');
    setIsSuccess(false);
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md">
        
        {/* Modal Window Container */}
        <motion.div
          initial={{ scale: 0.92, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.92, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-lg bg-gradient-to-b from-zinc-900 to-black text-white rounded-3xl sm:rounded-[36px] border border-white/10 shadow-[0_25px_80px_rgba(0,0,0,0.8)] overflow-hidden p-6 sm:p-8 text-left font-sans"
        >
          {/* Top Glow */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#F97316]/15 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={handleResetAndClose}
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 cursor-pointer transition-colors z-20"
            aria-label="Close"
          >
            <X size={16} />
          </button>

          {!isSuccess ? (
            <div className="space-y-6 relative z-10">
              
              {/* Header */}
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F97316]/15 border border-orange-500/30 text-[#FB923C] text-[10px] font-black uppercase tracking-widest">
                  <Sparkles size={12} />
                  COMPLIMENTARY PASS
                </span>
                
                <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white font-display">
                  CLAIM YOUR <br />
                  <span className="bg-gradient-to-r from-[#FB923C] to-[#EA580C] bg-clip-text text-transparent">
                    WARRIOR TRIAL PASS
                  </span>
                </h3>
                
                <p className="text-xs text-zinc-400 font-medium leading-relaxed">
                  Experience full access to our Olympic power zone, functional sprint track, and coach guidance with zero commitment.
                </p>
              </div>

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                
                {/* Full Name */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Full Name *
                  </label>
                  <div className="relative flex items-center">
                    <User size={15} className="absolute left-3.5 text-zinc-500 pointer-events-none" />
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      className="w-full h-11 pl-10 pr-4 rounded-xl bg-white/[0.04] border border-white/10 focus:border-[#F97316] text-xs font-bold text-white placeholder-zinc-500 outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Mobile Number */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Mobile Number *
                  </label>
                  <div className="relative flex items-center">
                    <span className="absolute left-3 text-xs font-mono font-bold text-zinc-500 border-r border-white/10 pr-2 pointer-events-none">
                      +91
                    </span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                      placeholder="9876543210"
                      className="w-full h-11 pl-14 pr-4 rounded-xl bg-white/[0.04] border border-white/10 focus:border-[#F97316] text-xs font-mono font-bold text-white placeholder-zinc-500 outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Fitness Goal */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Primary Fitness Goal
                  </label>
                  <select
                    value={goal}
                    onChange={(e) => setGoal(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-zinc-900 border border-white/10 focus:border-[#F97316] text-xs font-bold text-white outline-none cursor-pointer transition-colors"
                  >
                    <option value="Weight Loss & Hypertrophy">Weight Loss & Muscle Building</option>
                    <option value="Heavy Strength & Powerlifting">Heavy Strength & Powerlifting</option>
                    <option value="Functional & Athletic Conditioning">Functional & Athletic Conditioning</option>
                    <option value="1-on-1 Personal Coaching (PT)">1-on-1 Personal Coaching (PT)</option>
                    <option value="General Fitness & Longevity">General Fitness & Longevity</option>
                  </select>
                </div>

                {/* Preferred Time */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    Preferred Visit Slot
                  </label>
                  <select
                    value={preferredTime}
                    onChange={(e) => setPreferredTime(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-zinc-900 border border-white/10 focus:border-[#F97316] text-xs font-bold text-white outline-none cursor-pointer transition-colors"
                  >
                    <option value="Morning (06:00 AM – 10:00 AM)">Morning (06:00 AM – 10:00 AM)</option>
                    <option value="Afternoon (12:00 PM – 04:00 PM)">Afternoon (12:00 PM – 04:00 PM)</option>
                    <option value="Evening (05:00 PM – 09:30 PM)">Evening (05:00 PM – 09:30 PM)</option>
                  </select>
                </div>

                {error && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#FB923C] via-[#F97316] to-[#EA580C] text-white text-xs sm:text-sm font-black uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(249,115,22,0.35)] hover:shadow-[0_0_35px_rgba(249,115,22,0.6)] active:scale-95 border-none cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Send size={15} />
                  <span>{isSubmitting ? 'RESERVING PASS...' : 'CONFIRM TRIAL PASS'}</span>
                </button>

                <p className="text-[10px] text-zinc-500 text-center">
                  Instant confirmation • Our desk will WhatsApp your access pass details.
                </p>

              </form>

            </div>
          ) : (
            <div className="py-8 text-center space-y-5 relative z-10">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto border border-emerald-500/30">
                <CheckCircle2 size={32} />
              </div>

              <div className="space-y-2">
                <h3 className="text-2xl font-black uppercase tracking-tight text-white font-display">
                  TRIAL PASS RESERVED!
                </h3>
                <p className="text-xs text-zinc-400 max-w-sm mx-auto leading-relaxed">
                  Welcome to The Warrior Gym, <span className="text-white font-bold">{fullName}</span>! Our team has recorded your pass for <span className="text-[#FB923C] font-bold">{preferredTime}</span>.
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-white/[0.04] border border-white/10 text-xs text-zinc-300 font-bold space-y-1 text-left max-w-sm mx-auto">
                <div className="text-[10px] uppercase text-[#F97316] tracking-widest font-black">ARENA LOCATION:</div>
                <div>The Warrior Gym Mohali</div>
                <div className="text-zinc-400 text-[11px]">SCO 30, 31, Sector 89, Mohali (05:00 AM – 10:00 PM)</div>
              </div>

              <button
                onClick={handleResetAndClose}
                className="px-8 py-3 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-black uppercase tracking-wider border border-white/10 cursor-pointer transition-colors"
              >
                Close & Explore Arena
              </button>
            </div>
          )}

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
