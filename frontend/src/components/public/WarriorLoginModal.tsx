'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Shield, Lock, Mail, Eye, EyeOff, ArrowRight, Zap, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store';
import toast from '@/lib/toast';

interface WarriorLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function WarriorLoginModal({ isOpen, onClose }: WarriorLoginModalProps) {
  const router = useRouter();
  const { login } = useAuthStore();

  const [email, setEmail] = useState('owner@thewarriorgym.in');
  const [password, setPassword] = useState('1234567');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setErrorMessage('Please enter your email and password');
      return;
    }

    setIsLoading(true);
    setErrorMessage('');

    try {
      await login({ email: email.trim(), password: password.trim() });
      toast.success('Authenticated successfully. Welcome back to Warrior OS!');
      onClose();
      router.push('/dashboard/overview');
    } catch (err: any) {
      console.error('Login error:', err);
      setErrorMessage(err?.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage('');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md font-sans">
        
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0"
        />

        {/* Modal Body */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="relative w-full max-w-[480px] bg-gradient-to-b from-zinc-900 to-black text-white rounded-3xl sm:rounded-[36px] border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.8)] overflow-hidden p-6 sm:p-9 text-left z-10"
        >
          {/* Ambient Lighting */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#F97316]/15 rounded-full blur-3xl pointer-events-none" />

          {/* Close Button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 cursor-pointer transition-colors z-20"
            aria-label="Close"
          >
            <X size={16} />
          </button>

          {/* Modal Header */}
          <div className="space-y-4 relative z-10">
            <div className="flex items-center gap-3">
              <img
                src="/gymlogo.png"
                alt="The Warrior Gym"
                className="h-10 w-auto object-contain drop-shadow-[0_0_15px_rgba(249,115,22,0.4)]"
              />
              <div className="flex flex-col leading-none">
                <span className="font-black text-xs uppercase tracking-wider text-white font-display">
                  WARRIOR OS
                </span>
                <span className="text-[10px] font-bold text-[#FB923C] uppercase tracking-widest">
                  OPERATIONS HUB
                </span>
              </div>
            </div>

            <div>
              <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white font-display">
                STAFF &amp; ADMIN LOGIN
              </h2>
              <p className="text-xs text-zinc-400 font-medium mt-1">
                Enter your credentials to access the CRM Command Center.
              </p>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLoginSubmit} className="space-y-4 mt-6 relative z-10">
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Email Address
              </label>
              <div className="relative flex items-center">
                <Mail size={15} className="absolute left-3.5 text-zinc-500 pointer-events-none" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="owner@thewarriorgym.in"
                  className="w-full h-12 pl-10 pr-4 rounded-2xl bg-white/[0.04] border border-white/10 focus:border-[#F97316] text-xs font-bold text-white placeholder-zinc-500 outline-none transition-colors"
                  required
                />
              </div>
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-400">
                Password
              </label>
              <div className="relative flex items-center">
                <Lock size={15} className="absolute left-3.5 text-zinc-500 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 pl-10 pr-11 rounded-2xl bg-white/[0.04] border border-white/10 focus:border-[#F97316] text-xs font-bold text-white placeholder-zinc-500 outline-none transition-colors"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 text-zinc-400 hover:text-white bg-transparent border-none cursor-pointer p-1"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {errorMessage && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#FB923C] via-[#F97316] to-[#EA580C] text-white text-xs sm:text-sm font-black uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(249,115,22,0.35)] hover:shadow-[0_0_35px_rgba(249,115,22,0.6)] active:scale-95 border-none cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Zap size={14} className="fill-white" />
                  <span>LOG IN TO CRM</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>

            {/* Quick Demo Access Pills */}
            <div className="pt-4 border-t border-white/5 space-y-2">
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 block">
                QUICK ACCESS DEMO ACCOUNTS:
              </span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleQuickDemoFill('owner@thewarriorgym.in', '1234567')}
                  className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[10px] font-black uppercase tracking-wider text-zinc-300 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <div className="text-[#FB923C] font-mono">👑 Gym Owner</div>
                  <div className="text-[9px] text-zinc-500 lowercase font-normal truncate">owner@thewarriorgym.in</div>
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickDemoFill('admin@thewarriorgym.in', '1234567')}
                  className="p-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-[10px] font-black uppercase tracking-wider text-zinc-300 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <div className="text-[#FB923C] font-mono">⚡ Admin Desk</div>
                  <div className="text-[9px] text-zinc-500 lowercase font-normal truncate">admin@thewarriorgym.in</div>
                </button>
              </div>
            </div>

          </form>

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
