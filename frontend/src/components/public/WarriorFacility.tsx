'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dumbbell, Activity, Flame, Shield, Sparkles, Check, ArrowRight } from 'lucide-react';

export default function WarriorFacility() {
  const [activeZone, setActiveZone] = useState(0);

  const zones = [
    {
      id: 'weights',
      title: 'HEAVY FREE WEIGHTS',
      tag: 'ZONE 01 • OLYMPIC GRADE',
      desc: 'Engineered for pure strength. Featuring heavy Olympic power racks, competition barbells, calibrated steel & bumper plates, and a complete dumbbell line up to 50 kg with zero waiting time.',
      icon: Dumbbell,
      specs: [
        'Multi-station heavy power cages & squat rigs',
        'Olympic lifting platforms with shock absorption',
        'Extensive dumbbell run from 2.5 kg to 50 kg',
        'Flat, incline, and decline adjustable benches'
      ],
      highlight: 'Calibrated Iron & Bumper Plates'
    },
    {
      id: 'cardio',
      title: 'CARDIO & ENDURANCE LAB',
      tag: 'ZONE 02 • METABOLIC BURN',
      desc: 'Next-level cardiovascular conditioning. Equipped with curved non-motorized running machines, heavy assault air bikes, Concept2 rowers, and precision stair climbers.',
      icon: Activity,
      specs: [
        'Self-powered manual curve runners for natural gait',
        'Heavy air resistance assault bikes',
        'Concept2 ergometer rowing systems',
        'High-intensity interval timer displays'
      ],
      highlight: 'Zero-Motor Curved Running Decks'
    },
    {
      id: 'functional',
      title: 'FUNCTIONAL TURF ARENA',
      tag: 'ZONE 03 • ATHLETIC PERFORMANCE',
      desc: 'High-density sprint turf dedicated to athletic movement, heavy sled drives, battle rope intervals, kettlebell complexes, plyometric jumps, and core conditioning.',
      icon: Flame,
      specs: [
        'Commercial sprint track with yardage markings',
        'Weighted prowler & sled push equipment',
        'Heavy battle ropes and wall-mounted anchors',
        'Plyo soft boxes & dead-bounce slam balls'
      ],
      highlight: 'Dedicated Sled & Sprint Track'
    },
    {
      id: 'pt-pods',
      title: 'PERSONAL COACHING PODS',
      tag: 'ZONE 04 • 1-ON-1 PRECISION',
      desc: 'Dedicated private training pods where master trainers assess biomechanics, correct movement patterns, and execute targeted hypertrophy protocols with zero distractions.',
      icon: Shield,
      specs: [
        'Body composition & posture alignment analysis',
        'Private trainer coaching stations',
        'Custom cable attachments & resistance bands',
        'Targeted progressive overload charting'
      ],
      highlight: 'Private 1-on-1 Biomechanics Zone'
    }
  ];

  return (
    <section id="facility" className="relative w-full bg-[#09090B] text-white py-24 sm:py-32 px-4 sm:px-6 select-none border-t border-white/5">
      
      {/* Background ambient lighting */}
      <div className="absolute top-1/2 left-0 w-80 h-80 bg-[#EA580C]/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-16 relative z-10">
        
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 text-left border-b border-white/10 pb-8">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-[#F97316]">
              <Sparkles size={12} />
              THE FACILITY
            </span>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-white font-display leading-tight">
              INSIDE THE <br />
              <span className="bg-gradient-to-r from-[#FB923C] via-[#F97316] to-[#EA580C] bg-clip-text text-transparent">
                ARENA.
              </span>
            </h2>
          </div>
          <p className="max-w-md text-xs sm:text-sm text-zinc-400 font-sans leading-relaxed">
            Spacious, high-ceiling layout equipped with world-class resistance machinery, dedicated sprint tracks, and smart access control.
          </p>
        </div>

        {/* ── Zone Tabs ── */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
          {zones.map((zone, idx) => {
            const isCurrent = activeZone === idx;
            return (
              <button
                key={zone.id}
                onClick={() => setActiveZone(idx)}
                className={`px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 whitespace-nowrap cursor-pointer flex items-center gap-2 border ${
                  isCurrent
                    ? 'bg-gradient-to-r from-[#FB923C] to-[#EA580C] text-white border-orange-400/30 shadow-[0_0_20px_rgba(249,115,22,0.35)]'
                    : 'bg-white/[0.04] hover:bg-white/[0.08] text-zinc-400 hover:text-white border-white/5'
                }`}
              >
                <zone.icon size={15} />
                <span>{zone.title}</span>
              </button>
            );
          })}
        </div>

        {/* ── Active Zone Showcase Card ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeZone}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.35 }}
            className="rounded-3xl sm:rounded-[36px] bg-gradient-to-b from-zinc-900 to-black border border-white/10 p-8 sm:p-12 text-left relative overflow-hidden shadow-2xl"
          >
            {/* Top Right Orange Glow */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-[#F97316]/10 rounded-full blur-[90px] pointer-events-none" />

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
              
              {/* Left Zone Overview */}
              <div className="lg:col-span-6 space-y-6">
                <span className="text-[10px] font-black uppercase tracking-[0.25em] text-[#FB923C] px-3 py-1 rounded-md bg-[#F97316]/15 border border-orange-500/25">
                  {zones[activeZone].tag}
                </span>

                <h3 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white font-display leading-tight">
                  {zones[activeZone].title}
                </h3>

                <p className="text-zinc-300 text-xs sm:text-sm leading-relaxed font-sans">
                  {zones[activeZone].desc}
                </p>

                <div className="p-4 rounded-2xl bg-orange-500/[0.08] border border-orange-500/20 text-xs font-black uppercase tracking-wider text-[#FB923C]">
                  ⚡ Zone Highlight: {zones[activeZone].highlight}
                </div>
              </div>

              {/* Right Zone Specs List */}
              <div className="lg:col-span-6 space-y-3 bg-white/[0.02] p-6 sm:p-8 rounded-3xl border border-white/5">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 block mb-3">
                  EQUIPMENT & SPECIFICATIONS:
                </span>
                
                {zones[activeZone].specs.map((spec, sIdx) => (
                  <div
                    key={sIdx}
                    className="p-3.5 rounded-xl bg-white/[0.03] border border-white/5 text-xs font-bold text-zinc-200 flex items-center gap-3 hover:border-orange-500/30 transition-colors"
                  >
                    <div className="w-5 h-5 rounded-full bg-[#F97316]/20 text-[#FB923C] flex items-center justify-center shrink-0 border border-orange-500/30">
                      <Check size={12} />
                    </div>
                    <span>{spec}</span>
                  </div>
                ))}
              </div>

            </div>
          </motion.div>
        </AnimatePresence>

      </div>
    </section>
  );
}
