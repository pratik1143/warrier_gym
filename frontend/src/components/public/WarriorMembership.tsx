'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Check, Sparkles, ShieldCheck, Zap, ArrowRight, Star, Flame } from 'lucide-react';

interface WarriorMembershipProps {
  onOpenJoinModal?: () => void;
}

export default function WarriorMembership({ onOpenJoinModal }: WarriorMembershipProps) {
  const [selectedDuration, setSelectedDuration] = useState<number>(3);

  const tiers = [
    {
      months: 1,
      name: '1 MONTH STANDARD',
      tag: 'FLEXIBLE ACCESS',
      price: 2500,
      monthlyRate: 2500,
      savings: null,
      badge: null,
      popular: false,
      features: [
        'Full access to all strength & cardio zones',
        'Automated biometric ESSL turnstile access',
        'Custom initial workout plan guidance',
        'Locker & changing room amenities',
        'Mobile web profile access'
      ]
    },
    {
      months: 3,
      name: '3 MONTHS PRO',
      tag: 'TRANSFORMATION TIER',
      price: 6500,
      monthlyRate: 2166,
      savings: 'Save ₹1,000',
      badge: 'MOST POPULAR',
      popular: true,
      features: [
        'Full access to all strength & cardio zones',
        'Automated biometric ESSL turnstile access',
        'Personalized nutrition & diet guidance',
        'Bi-weekly body composition audits',
        '1 complimentary 1-on-1 PT assessment session',
        'Locker & shower facilities included'
      ]
    },
    {
      months: 6,
      name: '6 MONTHS ELITE',
      tag: 'SERIOUS ATHLETE',
      price: 11500,
      monthlyRate: 1916,
      savings: 'Save ₹3,500',
      badge: 'BEST VALUE',
      popular: false,
      features: [
        'Full unrestricted 7-day arena access',
        'Biometric instant gate entry with zero queue',
        'Custom progressive overload programming',
        'Continuous nutrition & macro optimization',
        '2 complimentary 1-on-1 coaching sessions',
        '1 Free Warrior Guest Pass per month'
      ]
    },
    {
      months: 12,
      name: '12 MONTHS VIP WARRIOR',
      tag: 'MAXIMUM COMMITMENT',
      price: 18000,
      monthlyRate: 1500,
      savings: 'Save ₹12,000 (Best Rate)',
      badge: 'VIP ACCESS',
      popular: false,
      features: [
        '365 days full unlimited all-zone access',
        'VIP priority biometric turnstile pass',
        'Full personalized coaching & nutrition roadmap',
        'Monthly DEXA / body composition review',
        '4 complimentary 1-on-1 PT training sessions',
        'VIP Guest Passes & priority facility perks'
      ]
    }
  ];

  const currentTier = tiers.find(t => t.months === selectedDuration) || tiers[1];

  return (
    <section id="membership" className="relative w-full bg-[#09090B] text-white py-24 sm:py-36 px-4 sm:px-6 select-none border-t border-white/5">
      
      {/* Background Volumetric Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[500px] bg-gradient-to-br from-[#F97316]/15 via-[#EA580C]/10 to-transparent rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-16 relative z-10">
        
        {/* Header Title */}
        <div className="text-center max-w-3xl mx-auto space-y-4">
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#F97316]/10 border border-orange-500/20 text-[#FB923C] text-[10px] font-black uppercase tracking-widest">
            <Sparkles size={12} className="text-[#F97316]" />
            TRANSPARENT COMMITMENT
          </span>
          
          <h2 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-white font-display leading-tight">
            CHOOSE YOUR <br />
            <span className="bg-gradient-to-r from-[#FB923C] via-[#F97316] to-[#EA580C] bg-clip-text text-transparent">
              COMMITMENT.
            </span>
          </h2>
          
          <p className="text-zinc-400 text-xs sm:text-sm md:text-base font-sans leading-relaxed">
            No hidden maintenance fees or surprise charges. All memberships include full Olympic equipment access and automated biometric entry.
          </p>
        </div>

        {/* ── Duration Pill Switcher ── */}
        <div className="flex items-center justify-center gap-2 p-1.5 rounded-full bg-white/[0.04] border border-white/10 max-w-xl mx-auto backdrop-blur-md">
          {tiers.map((t) => (
            <button
              key={t.months}
              onClick={() => setSelectedDuration(t.months)}
              className={`flex-1 py-2.5 sm:py-3 rounded-full text-xs font-black uppercase tracking-wider transition-all duration-300 cursor-pointer ${
                selectedDuration === t.months
                  ? 'bg-gradient-to-r from-[#FB923C] to-[#EA580C] text-white shadow-lg shadow-orange-500/30'
                  : 'text-zinc-400 hover:text-white bg-transparent'
              }`}
            >
              <span>{t.months} {t.months === 1 ? 'Month' : 'Months'}</span>
            </button>
          ))}
        </div>

        {/* ── Active Plan Detailed Presentation Card ── */}
        <motion.div
          key={selectedDuration}
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-3xl sm:rounded-[40px] bg-gradient-to-b from-zinc-900 to-black border-2 border-orange-500/40 p-8 sm:p-14 text-left relative overflow-hidden shadow-2xl max-w-4xl mx-auto"
        >
          {/* Top Badge */}
          {currentTier.badge && (
            <div className="absolute top-6 right-6 sm:top-8 sm:right-8">
              <span className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-[#FB923C] to-[#EA580C] text-white text-[10px] font-black uppercase tracking-widest shadow-md shadow-orange-500/30 flex items-center gap-1.5">
                <Star size={12} className="fill-white" />
                {currentTier.badge}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            {/* Left Pricing Block (5 cols) */}
            <div className="md:col-span-5 space-y-5 border-b md:border-b-0 md:border-r border-white/10 pb-6 md:pb-0 md:pr-8">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#F97316]">
                {currentTier.tag}
              </span>

              <h3 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white font-display">
                {currentTier.name}
              </h3>

              <div className="space-y-1">
                <div className="text-4xl sm:text-5xl font-black text-white font-mono tracking-tight flex items-baseline gap-1">
                  <span className="text-2xl sm:text-3xl text-[#FB923C]">₹</span>
                  <span>{currentTier.price.toLocaleString('en-IN')}</span>
                </div>
                <div className="text-xs font-bold text-zinc-400">
                  Equivalent to <span className="text-[#FB923C] font-mono font-black">₹{currentTier.monthlyRate.toLocaleString('en-IN')}</span> / month
                </div>
              </div>

              {currentTier.savings && (
                <div className="inline-block px-3 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-wider">
                  ✓ {currentTier.savings}
                </div>
              )}

              <button
                onClick={onOpenJoinModal}
                className="w-full py-4 rounded-2xl bg-gradient-to-r from-[#FB923C] via-[#F97316] to-[#EA580C] text-white text-xs sm:text-sm font-black uppercase tracking-wider transition-all shadow-[0_0_25px_rgba(249,115,22,0.35)] hover:shadow-[0_0_35px_rgba(249,115,22,0.6)] hover:scale-[1.02] active:scale-95 border-none cursor-pointer flex items-center justify-center gap-2 group"
              >
                <span>BECOME A WARRIOR</span>
                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Right Features List (7 cols) */}
            <div className="md:col-span-7 space-y-4">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-2">
                WHAT&apos;S INCLUDED IN THIS PASS:
              </span>

              <div className="space-y-3">
                {currentTier.features.map((feat, idx) => (
                  <div
                    key={idx}
                    className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 text-xs font-bold text-zinc-200 flex items-center gap-3"
                  >
                    <div className="w-5 h-5 rounded-full bg-[#F97316]/20 text-[#FB923C] flex items-center justify-center shrink-0 border border-orange-500/30">
                      <Check size={12} />
                    </div>
                    <span>{feat}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </motion.div>

      </div>
    </section>
  );
}
