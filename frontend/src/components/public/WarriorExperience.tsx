'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Zap, Flame, Trophy, CheckCircle2, ArrowRight } from 'lucide-react';

export default function WarriorExperience() {
  const statementWords = [
    { text: "THIS", highlight: false },
    { text: "ISN'T", highlight: false },
    { text: "JUST", highlight: false },
    { text: "A", highlight: false },
    { text: "GYM.", highlight: false },
    { text: "\n", break: true },
    { text: "THIS", highlight: false },
    { text: "IS", highlight: false },
    { text: "YOUR", highlight: false },
    { text: "ARENA.", highlight: true },
  ];

  return (
    <section id="experience" className="relative w-full bg-[#09090B] text-white py-24 sm:py-36 px-4 sm:px-6 overflow-hidden select-none border-t border-white/5">
      
      {/* Background Ambience */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-gradient-to-tr from-[#EA580C]/10 via-[#F97316]/5 to-transparent rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-6xl mx-auto space-y-24 relative z-10">
        
        {/* ── 1. The Statement Section ── */}
        <div className="text-center max-w-4xl mx-auto space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-50px' }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#F97316]/10 border border-orange-500/20 text-[#FB923C] text-[10px] font-black uppercase tracking-widest"
          >
            <Flame size={13} className="text-[#F97316]" />
            THE WARRIOR PHILOSOPHY
          </motion.div>

          <h2 className="text-[34px] sm:text-[56px] md:text-[72px] lg:text-[84px] font-black uppercase tracking-tight leading-[0.96] font-display text-white">
            {statementWords.map((item, idx) => {
              if (item.break) return <br key={idx} className="hidden sm:inline" />;
              return (
                <motion.span
                  key={idx}
                  initial={{ opacity: 0.15, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: '-40px' }}
                  transition={{ duration: 0.4, delay: 0.04 * idx }}
                  className={`inline-block mr-3 sm:mr-4 ${
                    item.highlight
                      ? 'bg-gradient-to-r from-[#FB923C] via-[#F97316] to-[#EA580C] bg-clip-text text-transparent drop-shadow-[0_0_30px_rgba(249,115,22,0.4)]'
                      : 'text-zinc-100'
                  }`}
                >
                  {item.text}
                </motion.span>
              );
            })}
          </h2>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-zinc-400 text-sm sm:text-base md:text-lg max-w-2xl mx-auto font-sans leading-relaxed"
          >
            We don&apos;t build average workouts. We craft high-intensity, biomechanically sound environments where discipline meets cutting-edge strength technology.
          </motion.p>
        </div>

        {/* ── 2. Cinematic Gym Reveal Showcase Card ── */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.7 }}
          className="relative rounded-[32px] sm:rounded-[40px] overflow-hidden border border-white/10 bg-gradient-to-b from-zinc-900 to-black p-8 sm:p-14 shadow-2xl"
        >
          {/* Accent Orange Lighting Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-[#F97316]/15 rounded-full blur-[100px] pointer-events-none" />
          
          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            
            {/* Left Content */}
            <div className="lg:col-span-6 space-y-6 text-left">
              <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#F97316]">
                NEXT-GENERATION FACILITY
              </span>
              
              <h3 className="text-2xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-white leading-tight font-display">
                TRAIN HARD. <br />
                MOVE SMART. <br />
                <span className="bg-gradient-to-r from-[#FB923C] to-[#EA580C] bg-clip-text text-transparent">
                  BECOME MORE.
                </span>
              </h3>

              <p className="text-zinc-400 text-xs sm:text-sm leading-relaxed font-sans">
                Every square foot of The Warrior Gym is engineered for serious progression. From heavy iron platforms to biometric turnstile check-ins, your workout is seamless from arrival to final set.
              </p>

              <div className="space-y-3 pt-2">
                {[
                  'Multi-station heavy Olympic power cages & calibrated plates',
                  'Dedicated functional turf for sled pushes, ropes & agility',
                  'Instant biometric access logging with live attendance sync',
                  'Personalized nutritional guidance and coach programming'
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 text-xs font-bold text-zinc-300">
                    <div className="w-5 h-5 rounded-full bg-[#F97316]/20 text-[#FB923C] flex items-center justify-center shrink-0 border border-orange-500/30">
                      <CheckCircle2 size={12} />
                    </div>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Right Visual Element */}
            <div className="lg:col-span-6 flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 backdrop-blur-md space-y-3 text-left">
                  <div className="w-10 h-10 rounded-2xl bg-[#F97316]/10 text-[#F97316] flex items-center justify-center border border-orange-500/20">
                    <Trophy size={20} />
                  </div>
                  <div className="text-2xl font-black text-white font-mono">100%</div>
                  <div className="text-xs font-bold text-zinc-400 leading-snug">
                    Results-driven training protocols designed for real body transformations.
                  </div>
                </div>

                <div className="p-6 rounded-3xl bg-white/[0.03] border border-white/5 backdrop-blur-md space-y-3 text-left">
                  <div className="w-10 h-10 rounded-2xl bg-[#F97316]/10 text-[#F97316] flex items-center justify-center border border-orange-500/20">
                    <Zap size={20} />
                  </div>
                  <div className="text-2xl font-black text-white font-mono">⚡ LIVE</div>
                  <div className="text-xs font-bold text-zinc-400 leading-snug">
                    Smart turnstiles with zero delays, instant attendance & biometric speed.
                  </div>
                </div>
              </div>

              <div className="p-6 rounded-3xl bg-gradient-to-r from-orange-500/10 via-amber-500/5 to-transparent border border-orange-500/20 text-left flex items-center justify-between gap-4">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-[#F97316]">
                    PRIME LOCATION
                  </div>
                  <div className="text-sm font-black text-white mt-0.5">
                    SCO 30, 31, Sector 89, Mohali
                  </div>
                </div>
                <a
                  href="#facility"
                  className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold uppercase tracking-wider transition-colors no-underline flex items-center gap-1.5 shrink-0"
                >
                  <span>View Arena</span>
                  <ArrowRight size={13} />
                </a>
              </div>
            </div>

          </div>
        </motion.div>

      </div>
    </section>
  );
}
