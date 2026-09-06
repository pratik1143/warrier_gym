'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Dumbbell, Zap, Flame, UserCheck, HeartPulse, ArrowUpRight, Check, Sparkles } from 'lucide-react';

interface WarriorProgramsProps {
  onOpenJoinModal?: () => void;
}

export default function WarriorPrograms({ onOpenJoinModal }: WarriorProgramsProps) {
  const [activeProgram, setActiveProgram] = useState(0);

  const programs = [
    {
      id: 'strength',
      title: 'STRENGTH & HYPERTROPHY',
      subtitle: 'Heavy Iron & Muscle Architecture',
      desc: 'Progressive overload protocols using Olympic power bars, calibrated iron, and multi-angle hypertrophy stations engineered to build dense, functional muscle mass.',
      icon: Dumbbell,
      intensity: 'VERY HIGH',
      frequency: '4-6 Days / Week',
      focus: 'Muscle Size, Max Strength, Dense Core',
      highlights: ['Olympic lifting platforms', 'Custom heavy dumbbell racks', 'Periodized strength tracking']
    },
    {
      id: 'functional',
      title: 'FUNCTIONAL & ATHLETIC',
      subtitle: 'Agility, Speed & Raw Power',
      desc: 'High-octane functional turf workouts utilizing heavy sleds, battle ropes, kettlebell complexes, and plyometrics to build athleticism that carries into real life.',
      icon: Flame,
      intensity: 'HIGH',
      frequency: '3-5 Days / Week',
      focus: 'Explosive Power, Stamina, Agility',
      highlights: ['Dedicated sprint turf zone', 'Slam balls & plyo boxes', 'Full-body cardiovascular burn']
    },
    {
      id: 'pt',
      title: '1-ON-1 PERSONAL COACHING',
      subtitle: 'Bespoke Blueprint & Form Mastery',
      desc: 'Direct private coaching tailored to your individual biomechanics, metabolic rate, and fitness goals with personalized nutrition blueprinting and weekly body composition audits.',
      icon: UserCheck,
      intensity: 'CUSTOMIZED',
      frequency: 'Flexible Schedule',
      focus: 'Rapid Body Transformation, Injury-Free Lifting',
      highlights: ['Custom nutrition & macro plan', 'Bi-weekly DEXA / inch audits', 'Dedicated master trainer']
    },
    {
      id: 'hiit',
      title: 'HIIT & METABOLIC BURN',
      subtitle: 'High-Density Calorie Torching',
      desc: 'Interval-based metabolic conditioning designed to elevate EPOC (Excess Post-Exercise Oxygen Consumption), burning fat and improving VO2 max rapidly.',
      icon: Zap,
      intensity: 'EXTREME',
      frequency: '3-4 Days / Week',
      focus: 'Rapid Fat Loss, High Endurance',
      highlights: ['Curve runners & air bikes', 'High-energy interval rounds', 'Heart-rate zone conditioning']
    },
    {
      id: 'mobility',
      title: 'RECOVERY & MOBILITY',
      subtitle: 'Longevity & Joint Restoration',
      desc: 'Assisted stretching, thoracic decompression, and mobility drills to eliminate tightness, restore posture, and bulletproof your tendons against training injuries.',
      icon: HeartPulse,
      intensity: 'MODERATE',
      frequency: '2-3 Days / Week',
      focus: 'Joint Health, Flexibility, Recovery',
      highlights: ['Assisted mobility guidance', 'Decompression stretching', 'Post-workout cooldown protocols']
    }
  ];

  return (
    <section id="programs" className="relative w-full bg-[#09090B] text-white py-24 sm:py-32 px-4 sm:px-6 select-none border-t border-white/5">
      
      {/* Ambient background glow */}
      <div className="absolute top-1/3 right-0 w-96 h-96 bg-[#EA580C]/10 rounded-full blur-[130px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-16 relative z-10">
        
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 text-left border-b border-white/10 pb-8">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-[#F97316]">
              <Sparkles size={12} />
              TRAINING ECOSYSTEM
            </span>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-white font-display leading-tight">
              PRECISION <br />
              <span className="bg-gradient-to-r from-[#FB923C] via-[#F97316] to-[#EA580C] bg-clip-text text-transparent">
                PROGRAMS.
              </span>
            </h2>
          </div>
          <p className="max-w-md text-xs sm:text-sm text-zinc-400 font-sans leading-relaxed">
            Every workout program at The Warrior Gym is designed around proven exercise science, progressive overload, and individualized pacing.
          </p>
        </div>

        {/* ── Desktop & Tablet: Interactive Program Card Grid ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          
          {/* Left Column: Program Navigation Selector (5 cols) */}
          <div className="lg:col-span-5 flex flex-col gap-2.5">
            {programs.map((prog, idx) => {
              const isCurrent = activeProgram === idx;
              return (
                <div
                  key={prog.id}
                  onClick={() => setActiveProgram(idx)}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 cursor-pointer text-left flex items-center justify-between gap-4 ${
                    isCurrent
                      ? 'bg-gradient-to-r from-white/[0.08] to-orange-500/10 border-orange-500/50 shadow-[0_0_25px_rgba(249,115,22,0.15)] translate-x-1'
                      : 'bg-white/[0.02] border-white/5 hover:border-white/15 hover:bg-white/[0.04]'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                      isCurrent 
                        ? 'bg-[#F97316] text-white shadow-md shadow-orange-500/30' 
                        : 'bg-white/5 text-zinc-400'
                    }`}>
                      <prog.icon size={18} />
                    </div>
                    <div className="min-w-0">
                      <h4 className={`text-xs sm:text-sm font-black uppercase tracking-wide truncate ${
                        isCurrent ? 'text-white' : 'text-zinc-300'
                      }`}>
                        {prog.title}
                      </h4>
                      <p className="text-[10px] text-zinc-500 font-medium truncate mt-0.5">
                        {prog.subtitle}
                      </p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md shrink-0 border ${
                    isCurrent
                      ? 'bg-[#F97316]/20 text-[#FB923C] border-orange-500/40'
                      : 'bg-white/5 text-zinc-500 border-white/5'
                  }`}>
                    {prog.intensity}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Right Column: Active Program Detail Card (7 cols) */}
          <div className="lg:col-span-7">
            <motion.div
              key={activeProgram}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="h-full rounded-3xl sm:rounded-[32px] bg-gradient-to-br from-zinc-900/90 via-zinc-950 to-black border border-orange-500/25 p-7 sm:p-10 flex flex-col justify-between space-y-8 text-left relative overflow-hidden shadow-2xl"
            >
              {/* Top Accent glow */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-[#F97316]/15 rounded-full blur-[90px] pointer-events-none" />

              <div className="space-y-6 relative z-10">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-2.5">
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#FB923C] to-[#EA580C] text-white flex items-center justify-center shadow-lg shadow-orange-500/25">
                      {React.createElement(programs[activeProgram].icon, { size: 22 })}
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-[#F97316]">
                        CURATED PROGRAM • 0{activeProgram + 1}
                      </span>
                      <h3 className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-tight text-white font-display">
                        {programs[activeProgram].title}
                      </h3>
                    </div>
                  </div>

                  <span className="text-xs font-mono font-bold text-zinc-400 bg-white/5 px-3 py-1.5 rounded-xl border border-white/10">
                    {programs[activeProgram].frequency}
                  </span>
                </div>

                <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed font-sans">
                  {programs[activeProgram].desc}
                </p>

                {/* Specs Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Key Target & Focus</span>
                    <span className="text-xs font-black text-white mt-1 block">
                      {programs[activeProgram].focus}
                    </span>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                    <span className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider block">Intensity Profile</span>
                    <span className="text-xs font-black text-[#FB923C] mt-1 block">
                      {programs[activeProgram].intensity} INTENSITY
                    </span>
                  </div>
                </div>

                {/* Key Program Highlights */}
                <div className="space-y-2.5 pt-1">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
                    INCLUDED IN THIS PROTOCOL:
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    {programs[activeProgram].highlights.map((item, idx) => (
                      <div key={idx} className="p-2.5 rounded-xl bg-orange-500/[0.06] border border-orange-500/20 text-[11px] font-bold text-zinc-200 flex items-center gap-2">
                        <Check size={13} className="text-[#F97316] shrink-0" />
                        <span className="truncate">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Bottom CTA */}
              <div className="pt-6 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 relative z-10">
                <div className="text-left">
                  <span className="text-[10px] font-bold text-zinc-400">Ready to train?</span>
                  <div className="text-xs font-black text-white">Join with full program access included.</div>
                </div>

                <button
                  onClick={onOpenJoinModal}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white text-xs font-black uppercase tracking-wider transition-all shadow-md shadow-orange-500/25 border-none cursor-pointer flex items-center justify-center gap-2 group shrink-0 active:scale-95"
                >
                  <span>CLAIM FREE TRIAL PASS</span>
                  <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </button>
              </div>

            </motion.div>
          </div>

        </div>

      </div>
    </section>
  );
}
