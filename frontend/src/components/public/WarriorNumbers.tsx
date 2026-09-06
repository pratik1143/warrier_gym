'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Users, Layers, Zap, Clock, ShieldCheck, Flame } from 'lucide-react';

export default function WarriorNumbers() {
  const stats = [
    {
      value: '500+',
      label: 'ACTIVE WARRIORS',
      detail: 'Athletes & members transforming their physique weekly',
      icon: Users,
    },
    {
      value: '10+',
      label: 'TRAINING ZONES',
      detail: 'Power racks, Olympic platforms, functional turf & cardio lab',
      icon: Layers,
    },
    {
      value: '100%',
      label: 'SMART BIOMETRICS',
      detail: 'Automated ESSL turnstile gate access with instant sync',
      icon: Zap,
    },
    {
      value: '7 DAYS',
      label: 'WEEKLY ACCESS',
      detail: 'Open 05:00 AM to 10:00 PM every single day of the week',
      icon: Clock,
    }
  ];

  return (
    <section className="relative w-full bg-[#09090B] text-white py-20 sm:py-28 px-4 sm:px-6 select-none border-t border-white/5 overflow-hidden">
      
      {/* Background Accent Grid */}
      <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:24px_24px] pointer-events-none opacity-40" />

      <div className="max-w-7xl mx-auto relative z-10 space-y-12">
        
        {/* Section Pill */}
        <div className="text-center space-y-2">
          <span className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/[0.04] border border-white/10 text-zinc-400 text-[10px] font-black uppercase tracking-widest">
            <Flame size={12} className="text-[#F97316]" />
            PROVEN TRACK RECORD
          </span>
          <h2 className="text-2xl sm:text-4xl font-black uppercase tracking-tight text-white font-display">
            ENGINEERED IN NUMBERS.
          </h2>
        </div>

        {/* 4-Stat Metric Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {stats.map((stat, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: 0.1 * idx }}
              className="p-6 sm:p-8 rounded-3xl bg-gradient-to-b from-white/[0.04] to-white/[0.01] border border-white/10 hover:border-orange-500/40 transition-all duration-300 group text-left relative overflow-hidden shadow-xl"
            >
              {/* Corner Glow on hover */}
              <div className="absolute -top-12 -right-12 w-28 h-28 bg-[#F97316]/10 rounded-full blur-2xl group-hover:bg-[#F97316]/25 transition-all duration-300 pointer-events-none" />

              <div className="w-10 h-10 rounded-2xl bg-white/5 group-hover:bg-[#F97316] group-hover:text-white text-[#F97316] flex items-center justify-center transition-colors mb-6 border border-white/5">
                <stat.icon size={18} />
              </div>

              <div className="text-3xl sm:text-4xl lg:text-5xl font-black uppercase font-mono tracking-tight text-white group-hover:text-[#FB923C] transition-colors leading-none">
                {stat.value}
              </div>

              <div className="text-xs font-black uppercase tracking-wider text-zinc-300 mt-2 font-display">
                {stat.label}
              </div>

              <p className="text-[11px] text-zinc-500 font-medium leading-relaxed mt-2">
                {stat.detail}
              </p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
