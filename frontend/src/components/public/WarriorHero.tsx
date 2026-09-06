'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, ChevronDown, ShieldCheck, Flame, Dumbbell, Sparkles, Activity } from 'lucide-react';

interface WarriorHeroProps {
  onOpenJoinModal?: () => void;
}

export default function WarriorHero({ onOpenJoinModal }: WarriorHeroProps) {
  return (
    <section className="relative min-h-[92vh] sm:min-h-screen w-full bg-[#09090B] text-white flex flex-col justify-center items-center overflow-hidden pt-28 pb-16 px-4 sm:px-6 select-none">
      
      {/* ── Volumetric Ambient Lighting & Grid Glow ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Deep Orange Ambient Orb */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] sm:w-[750px] h-[350px] sm:h-[450px] bg-gradient-to-br from-[#F97316]/25 via-[#EA580C]/15 to-transparent rounded-full blur-[120px]" />
        
        {/* Corner Rim Glows */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-[#EA580C]/10 rounded-full blur-[100px]" />
        <div className="absolute bottom-10 right-0 w-80 h-80 bg-[#FB923C]/10 rounded-full blur-[90px]" />

        {/* High-Tech Tactical Grid Background Pattern */}
        <div 
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage: `radial-gradient(#ffffff 1px, transparent 1px)`,
            backgroundSize: '32px 32px'
          }}
        />

        {/* Cinematic Vignette Overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#09090B]/60 via-transparent to-[#09090B]" />
      </div>

      {/* ── Main Hero Composition Content ── */}
      <div className="relative z-10 max-w-5xl mx-auto flex flex-col items-center text-center space-y-7">
        
        {/* 1. Live Pulse Eyebrow Pill */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/10 backdrop-blur-md shadow-xs"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F97316] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#F97316]"></span>
          </span>
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.2em] text-orange-200">
            THE WARRIOR GYM • MOHALI
          </span>
          <span className="text-[9px] px-2 py-0.5 rounded-md bg-[#F97316]/20 text-[#FB923C] font-black uppercase tracking-widest border border-orange-500/30">
            PRO ARENA
          </span>
        </motion.div>

        {/* 2. Headline: BUILT FOR WARRIORS */}
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="space-y-1"
        >
          <h1 className="text-[44px] sm:text-[72px] md:text-[92px] lg:text-[108px] font-black uppercase tracking-[-0.04em] leading-[0.92] font-display text-white">
            <span className="block drop-shadow-[0_4px_24px_rgba(0,0,0,0.8)]">BUILT</span>
            <span className="block text-zinc-300">FOR</span>
            <span className="block bg-gradient-to-r from-[#FB923C] via-[#F97316] to-[#C2410C] bg-clip-text text-transparent drop-shadow-[0_0_40px_rgba(249,115,22,0.45)]">
              WARRIORS.
            </span>
          </h1>
        </motion.div>

        {/* 3. Subtitle / Value Proposition */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="max-w-2xl text-sm sm:text-base md:text-lg text-zinc-400 font-medium leading-relaxed font-sans"
        >
          Elite strength equipment, Olympic lifting platforms, intelligent biometric access, and certified master coaches engineered to forge peak human performance.
        </motion.p>

        {/* 4. Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto pt-2"
        >
          <button
            onClick={onOpenJoinModal}
            className="w-full sm:w-auto px-8 py-4 rounded-full bg-gradient-to-r from-[#FB923C] via-[#F97316] to-[#EA580C] text-white text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-300 shadow-[0_0_30px_rgba(249,115,22,0.4)] hover:shadow-[0_0_45px_rgba(249,115,22,0.7)] hover:scale-105 active:scale-95 cursor-pointer border border-orange-300/40 flex items-center justify-center gap-2 group"
          >
            <span>START YOUR TRANSFORMATION</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>

          <a
            href="#experience"
            className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 hover:text-white text-xs sm:text-sm font-black uppercase tracking-wider border border-white/10 hover:border-white/20 transition-all duration-300 flex items-center justify-center gap-2 no-underline"
          >
            <Dumbbell size={15} className="text-[#FB923C]" />
            <span>EXPLORE THE ARENA</span>
          </a>
        </motion.div>

        {/* 5. Live Facility Highlights Floating Row */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.65 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-6 w-full max-w-3xl"
        >
          {[
            { label: 'Smart Access', val: 'Biometric ESSL', icon: Activity },
            { label: 'Equipment', val: 'Olympic Grade', icon: Dumbbell },
            { label: 'Coaches', val: 'Certified Pros', icon: ShieldCheck },
            { label: 'Open', val: '7 Days a Week', icon: Flame },
          ].map((item, idx) => (
            <div
              key={idx}
              className="px-4 py-3 rounded-2xl bg-white/[0.03] border border-white/5 backdrop-blur-md flex items-center gap-3 text-left hover:border-orange-500/30 transition-colors"
            >
              <div className="w-8 h-8 rounded-xl bg-[#F97316]/10 text-[#F97316] flex items-center justify-center shrink-0 border border-orange-500/20">
                <item.icon size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider">{item.label}</div>
                <div className="text-xs font-black text-white truncate">{item.val}</div>
              </div>
            </div>
          ))}
        </motion.div>

      </div>

      {/* ── Scroll Down Indicator ── */}
      <motion.a
        href="#experience"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 0.5 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-zinc-500 hover:text-white transition-colors no-underline cursor-pointer group"
      >
        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-zinc-400 group-hover:text-[#F97316] transition-colors">
          SCROLL TO ENTER
        </span>
        <motion.div
          animate={{ y: [0, 5, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ChevronDown size={18} className="text-[#F97316]" />
        </motion.div>
      </motion.a>

    </section>
  );
}
