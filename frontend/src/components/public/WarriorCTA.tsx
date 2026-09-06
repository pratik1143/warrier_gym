'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles, MessageSquare, Phone, MapPin } from 'lucide-react';

interface WarriorCTAProps {
  onOpenJoinModal?: () => void;
}

export default function WarriorCTA({ onOpenJoinModal }: WarriorCTAProps) {
  return (
    <section className="relative w-full bg-[#09090B] text-white py-28 sm:py-36 px-4 sm:px-6 select-none border-t border-white/5 overflow-hidden">
      
      {/* Intense Volumetric Orange Glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[750px] sm:w-[950px] h-[400px] sm:h-[500px] bg-gradient-to-r from-[#F97316]/20 via-[#EA580C]/25 to-[#C2410C]/20 rounded-full blur-[160px] pointer-events-none" />

      <div className="max-w-5xl mx-auto relative z-10 text-center space-y-8">
        
        {/* Eyebrow badge */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/10 text-orange-300 text-[10px] font-black uppercase tracking-[0.25em]"
        >
          <Sparkles size={12} className="text-[#FB923C]" />
          TRANSFORMATION AWAITS
        </motion.div>

        {/* Huge Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black uppercase tracking-tight text-white font-display leading-[0.92]"
        >
          READY TO ENTER <br />
          <span className="bg-gradient-to-r from-[#FB923C] via-[#F97316] to-[#EA580C] bg-clip-text text-transparent drop-shadow-[0_0_35px_rgba(249,115,22,0.5)]">
            THE ARENA?
          </span>
        </motion.h2>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="max-w-xl mx-auto text-xs sm:text-base text-zinc-300 font-sans leading-relaxed"
        >
          Take your first step towards peak strength, athleticism, and body recomposition. Book a free 1-day pass or speak directly with our head coach.
        </motion.p>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4"
        >
          <button
            onClick={onOpenJoinModal}
            className="w-full sm:w-auto px-9 py-4 rounded-full bg-gradient-to-r from-[#FB923C] via-[#F97316] to-[#EA580C] text-white text-xs sm:text-sm font-black uppercase tracking-wider transition-all duration-300 shadow-[0_0_30px_rgba(249,115,22,0.4)] hover:shadow-[0_0_45px_rgba(249,115,22,0.7)] hover:scale-105 active:scale-95 border border-orange-300/40 cursor-pointer flex items-center justify-center gap-2 group"
          >
            <span>START YOUR JOURNEY</span>
            <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>

          <a
            href="https://wa.me/919779333155"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full sm:w-auto px-8 py-4 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-zinc-200 hover:text-white text-xs sm:text-sm font-black uppercase tracking-wider border border-white/10 hover:border-white/20 transition-all duration-300 flex items-center justify-center gap-2 no-underline"
          >
            <MessageSquare size={16} className="text-emerald-400" />
            <span>CHAT ON WHATSAPP</span>
          </a>
        </motion.div>

        {/* Location & Quick Contact Strip */}
        <div className="pt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-zinc-400 font-bold">
          <div className="flex items-center gap-1.5">
            <MapPin size={14} className="text-[#F97316]" />
            <span>SCO 16-17, Landran Rd, Sohana, Mohali</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Phone size={14} className="text-[#F97316]" />
            <span>+91 97793 33155</span>
          </div>
        </div>

      </div>
    </section>
  );
}
