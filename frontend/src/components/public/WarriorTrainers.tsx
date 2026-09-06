'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Award, Dumbbell, Sparkles, MessageCircle, ArrowRight } from 'lucide-react';

interface WarriorTrainersProps {
  onOpenJoinModal?: () => void;
}

export default function WarriorTrainers({ onOpenJoinModal }: WarriorTrainersProps) {
  const trainers = [
    {
      name: 'Sourav Arora',
      role: 'Head Coach & Biomechanics',
      experience: '8+ Years Exp',
      specialty: 'Progressive Overload, Body Recomposition & Hypertrophy',
      certifications: 'Certified Strength & Conditioning Specialist',
      badge: 'HEAD TRAINER'
    },
    {
      name: 'Deepak',
      role: 'Master Strength Coach',
      experience: '6+ Years Exp',
      specialty: 'Olympic Barbell Mechanics & Powerlifting Protocols',
      certifications: 'Advanced Resistance Training Specialist',
      badge: 'STRENGTH'
    },
    {
      name: 'Kuldeep',
      role: 'Functional & Fat Loss Specialist',
      experience: '5+ Years Exp',
      specialty: 'High-Density Interval Conditioning & Endurance',
      certifications: 'Certified Functional Movement Expert',
      badge: 'CONDITIONING'
    },
    {
      name: 'Arshdeep Singh',
      role: 'Mobility & Hypertrophy Coach',
      experience: '5+ Years Exp',
      specialty: 'Joint Longevity, Posture Correction & Muscle Mass',
      certifications: 'Biomechanics & Kinetic Chain Specialist',
      badge: 'MOBILITY'
    }
  ];

  return (
    <section id="trainers" className="relative w-full bg-[#09090B] text-white py-24 sm:py-32 px-4 sm:px-6 select-none border-t border-white/5">
      
      {/* Background Ambience */}
      <div className="absolute top-1/3 right-10 w-96 h-96 bg-[#F97316]/10 rounded-full blur-[140px] pointer-events-none" />

      <div className="max-w-7xl mx-auto space-y-16 relative z-10">
        
        {/* Header Title */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 text-left border-b border-white/10 pb-8">
          <div className="space-y-3">
            <span className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-[#F97316]">
              <Sparkles size={12} />
              MASTER COACHES
            </span>
            <h2 className="text-3xl sm:text-5xl md:text-6xl font-black uppercase tracking-tight text-white font-display leading-tight">
              PROVEN <br />
              <span className="bg-gradient-to-r from-[#FB923C] via-[#F97316] to-[#EA580C] bg-clip-text text-transparent">
                LEADERSHIP.
              </span>
            </h2>
          </div>
          <p className="max-w-md text-xs sm:text-sm text-zinc-400 font-sans leading-relaxed">
            Our certified master coaches guide every movement with scientific rigor, form correction, and relentless motivation.
          </p>
        </div>

        {/* ── Coaches Cards Grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {trainers.map((coach, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.5, delay: 0.1 * idx }}
              className="p-6 sm:p-7 rounded-3xl bg-gradient-to-b from-zinc-900/90 to-black border border-white/10 hover:border-orange-500/50 transition-all duration-300 group flex flex-col justify-between space-y-6 text-left relative overflow-hidden shadow-xl"
            >
              {/* Corner Accent Glow */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#F97316]/10 rounded-full blur-2xl group-hover:bg-[#F97316]/25 transition-all duration-300 pointer-events-none" />

              <div className="space-y-4 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-md bg-[#F97316]/15 text-[#FB923C] border border-orange-500/30">
                    {coach.badge}
                  </span>
                  <span className="text-[10px] font-mono font-bold text-zinc-400">
                    {coach.experience}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white font-display group-hover:text-[#FB923C] transition-colors">
                    {coach.name}
                  </h3>
                  <p className="text-xs font-bold text-[#F97316] mt-0.5">
                    {coach.role}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-white/5 text-[11px]">
                  <div>
                    <span className="text-zinc-500 font-bold block uppercase text-[9px] tracking-wider">Specialization</span>
                    <span className="text-zinc-300 font-semibold">{coach.specialty}</span>
                  </div>
                  <div>
                    <span className="text-zinc-500 font-bold block uppercase text-[9px] tracking-wider">Credential</span>
                    <span className="text-zinc-400">{coach.certifications}</span>
                  </div>
                </div>
              </div>

              {/* Consultation trigger */}
              <button
                onClick={onOpenJoinModal}
                className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-gradient-to-r hover:from-[#FB923C] hover:to-[#EA580C] text-zinc-300 hover:text-white text-xs font-black uppercase tracking-wider transition-all duration-200 border border-white/10 hover:border-transparent flex items-center justify-center gap-1.5 cursor-pointer relative z-10"
              >
                <span>BOOK 1-ON-1 PT</span>
                <ArrowRight size={13} />
              </button>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
