'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import WarriorNavbar from '@/components/public/WarriorNavbar';
import WarriorHero from '@/components/public/WarriorHero';
import WarriorExperience from '@/components/public/WarriorExperience';
import WarriorPrograms from '@/components/public/WarriorPrograms';
import WarriorNumbers from '@/components/public/WarriorNumbers';
import WarriorFacility from '@/components/public/WarriorFacility';
import WarriorTrainers from '@/components/public/WarriorTrainers';
import WarriorMembership from '@/components/public/WarriorMembership';
import WarriorCTA from '@/components/public/WarriorCTA';
import WarriorFooter from '@/components/public/WarriorFooter';
import WarriorBookingModal from '@/components/public/WarriorBookingModal';
import WarriorLoginModal from '@/components/public/WarriorLoginModal';

export default function HomeClient() {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [introLoading, setIntroLoading] = useState(true);

  // Fast intro entrance loader (0.6s)
  useEffect(() => {
    const timer = setTimeout(() => {
      setIntroLoading(false);
    }, 650);
    return () => clearTimeout(timer);
  }, []);

  // Track global scroll progress for top indicator
  useEffect(() => {
    const handleScroll = () => {
      const totalHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const progress = (window.scrollY / totalHeight) * 100;
        setScrollProgress(Math.min(100, Math.max(0, progress)));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="relative min-h-screen w-full bg-[#09090B] text-white selection:bg-[#F97316] selection:text-white font-sans overflow-x-hidden">
      
      {/* ── 1. Top Orange Scroll Progress Bar ── */}
      <div className="fixed top-0 left-0 right-0 z-[120] h-[3px] bg-white/5 pointer-events-none">
        <div
          className="h-full bg-gradient-to-r from-[#FB923C] via-[#F97316] to-[#C2410C] transition-all duration-75"
          style={{ width: `${scrollProgress}%` }}
        />
      </div>

      {/* ── 2. Cinematic Page Entrance Loader ── */}
      <AnimatePresence>
        {introLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: 'easeInOut' }}
            className="fixed inset-0 z-[200] bg-[#09090B] flex flex-col items-center justify-center pointer-events-none select-none"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.1, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="flex flex-col items-center gap-4 text-center"
            >
              <img
                src="/gymlogo.png"
                alt="The Warrior Gym"
                className="h-16 w-auto object-contain drop-shadow-[0_0_35px_rgba(249,115,22,0.8)]"
              />
              <div className="flex flex-col leading-none">
                <span className="font-black text-lg uppercase tracking-wider text-white font-display">
                  THE WARRIOR
                </span>
                <span className="font-black text-sm uppercase tracking-widest text-[#F97316] font-display">
                  GYM
                </span>
              </div>
              <div className="w-24 h-1 bg-white/10 rounded-full overflow-hidden mt-2">
                <motion.div
                  className="h-full bg-gradient-to-r from-[#FB923C] to-[#EA580C]"
                  initial={{ width: '0%' }}
                  animate={{ width: '100%' }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 3. Floating Glass Navigation ── */}
      <WarriorNavbar
        onOpenJoinModal={() => setIsJoinModalOpen(true)}
        onOpenLoginModal={() => setIsLoginModalOpen(true)}
      />

      {/* ── 4. Main Scroll Story Sections ── */}
      <main className="w-full">
        {/* HERO: Built For Warriors */}
        <WarriorHero onOpenJoinModal={() => setIsJoinModalOpen(true)} />

        {/* SECTION 1 & 2: The Statement & Cinematic Gym Reveal */}
        <WarriorExperience />

        {/* SECTION 3: Precision Training Programs */}
        <WarriorPrograms onOpenJoinModal={() => setIsJoinModalOpen(true)} />

        {/* SECTION 4: The Warrior Numbers */}
        <WarriorNumbers />

        {/* SECTION 5: Facility & Zones */}
        <WarriorFacility />

        {/* SECTION 6: Master Coaches & Trainers */}
        <WarriorTrainers onOpenJoinModal={() => setIsJoinModalOpen(true)} />

        {/* SECTION 7: Interactive Membership Selector */}
        <WarriorMembership onOpenJoinModal={() => setIsJoinModalOpen(true)} />

        {/* SECTION 9: Epic Call to Action */}
        <WarriorCTA onOpenJoinModal={() => setIsJoinModalOpen(true)} />
      </main>

      {/* ── 5. Minimalist Athletic Footer ── */}
      <WarriorFooter onOpenLoginModal={() => setIsLoginModalOpen(true)} />

      {/* ── 6. Complimentary Pass / Quick Trial Modal ── */}
      <WarriorBookingModal
        isOpen={isJoinModalOpen}
        onClose={() => setIsJoinModalOpen(false)}
      />

      {/* ── 7. Staff & Admin CRM Login Modal ── */}
      <WarriorLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
      />

    </div>
  );
}
