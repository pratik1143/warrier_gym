'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Menu, X, ArrowUpRight, Phone, MessageSquare, Sparkles, MapPin, Clock, Shield } from 'lucide-react';

interface WarriorNavbarProps {
  onOpenJoinModal?: () => void;
  onOpenLoginModal?: () => void;
}

export default function WarriorNavbar({ onOpenJoinModal, onOpenLoginModal }: WarriorNavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 40);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { name: 'HOME', href: '#' },
    { name: 'EXPERIENCE', href: '#experience' },
    { name: 'PROGRAMS', href: '#programs' },
    { name: 'FACILITY', href: '#facility' },
    { name: 'TRAINERS', href: '#trainers' },
    { name: 'MEMBERSHIP', href: '#membership' },
  ];

  return (
    <>
      {/* ── Floating Desktop / Main Navigation Bar ── */}
      <header className="fixed top-0 left-0 right-0 z-50 flex justify-center px-4 sm:px-6 pt-4 transition-all duration-300">
        <nav
          className={`w-full max-w-7xl mx-auto flex items-center justify-between px-5 sm:px-7 py-3 rounded-full transition-all duration-300 ${
            scrolled
              ? 'bg-[#09090B]/85 backdrop-blur-xl border border-white/10 shadow-[0_10px_30px_rgba(0,0,0,0.5)] py-2.5'
              : 'bg-black/30 backdrop-blur-md border border-white/5 py-3.5'
          }`}
        >
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group no-underline">
            <img
              src="/gymlogo.png"
              alt="The Warrior Gym"
              className="h-9 sm:h-11 w-auto object-contain drop-shadow-[0_0_12px_rgba(249,115,22,0.4)] transition-transform duration-300 group-hover:scale-105"
            />
            <div className="flex flex-col text-left leading-none">
              <span className="font-black text-[13px] sm:text-[15px] tracking-wider uppercase text-white font-display">
                THE WARRIOR
              </span>
              <span className="font-black text-[12px] sm:text-[14px] tracking-widest uppercase text-[#F97316] font-display">
                GYM
              </span>
            </div>
          </Link>

          {/* Desktop Center Links */}
          <div className="hidden lg:flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/[0.04] border border-white/5">
            {navLinks.map((link) => (
              <a
                key={link.name}
                href={link.href}
                className="px-3.5 py-1.5 text-[11px] font-black tracking-widest text-zinc-300 hover:text-white rounded-full hover:bg-white/10 transition-all duration-200 no-underline uppercase"
              >
                {link.name}
              </a>
            ))}
          </div>

          {/* Right Action: Join The Warrior CTA + CRM Login */}
          <div className="hidden sm:flex items-center gap-2.5">
            <button
              onClick={onOpenLoginModal}
              className="px-4 py-2.5 rounded-full bg-white/[0.07] hover:bg-white/[0.14] text-zinc-200 hover:text-white text-xs font-black uppercase tracking-wider transition-all border border-white/10 hover:border-white/20 flex items-center gap-1.5 hover:scale-105 active:scale-95 cursor-pointer"
            >
              <Shield size={13} className="text-[#FB923C]" />
              <span>CRM LOGIN</span>
            </button>

            <button
              onClick={onOpenJoinModal}
              className="relative group overflow-hidden px-5 py-2.5 rounded-full bg-gradient-to-r from-[#FB923C] via-[#F97316] to-[#C2410C] text-white text-xs font-black uppercase tracking-wider transition-all duration-300 shadow-[0_0_20px_rgba(249,115,22,0.35)] hover:shadow-[0_0_30px_rgba(249,115,22,0.6)] hover:scale-105 active:scale-95 border border-orange-400/30 cursor-pointer flex items-center gap-1.5"
            >
              <Sparkles size={13} className="text-amber-200 animate-pulse" />
              <span>JOIN THE WARRIOR</span>
              <ArrowUpRight size={14} className="group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </button>
          </div>

          {/* Mobile Hamburger Toggle */}
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="lg:hidden p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors border border-white/10 cursor-pointer flex items-center justify-center"
            aria-label="Open Mobile Menu"
          >
            <Menu size={20} />
          </button>
        </nav>
      </header>

      {/* ── Fullscreen Animated Mobile Menu ── */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-[#09090B]/98 backdrop-blur-2xl flex flex-col justify-between p-6 sm:p-8 text-white text-left font-sans"
          >
            {/* Top Bar */}
            <div className="flex items-center justify-between border-b border-white/10 pb-5">
              <div className="flex items-center gap-3">
                <img src="/gymlogo.png" alt="Warrior Gym Logo" className="h-10 w-auto object-contain" />
                <div className="flex flex-col leading-none">
                  <span className="font-black text-sm uppercase text-white font-display">THE WARRIOR</span>
                  <span className="font-black text-xs uppercase text-[#F97316] font-display">GYM</span>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center border border-white/10 cursor-pointer transition-colors"
                aria-label="Close Menu"
              >
                <X size={20} />
              </button>
            </div>

            {/* Nav Links */}
            <div className="flex flex-col gap-4 py-8">
              {navLinks.map((link, idx) => (
                <motion.a
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * idx, duration: 0.3 }}
                  className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-zinc-300 hover:text-[#F97316] transition-colors no-underline flex items-center justify-between group"
                >
                  <span>{link.name}</span>
                  <ArrowUpRight size={20} className="text-[#F97316] opacity-0 group-hover:opacity-100 transition-opacity" />
                </motion.a>
              ))}
            </div>

            {/* Bottom Quick Info & CTA */}
            <div className="space-y-4 pt-6 border-t border-white/10">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-400">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-[#F97316] shrink-0" />
                  <span>SCO 30, 31, Sector 89, Mohali</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock size={14} className="text-[#F97316] shrink-0" />
                  <span>05:00 AM – 10:00 PM</span>
                </div>
              </div>

              <div className="flex flex-col gap-2.5 pt-2">
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    if (onOpenJoinModal) onOpenJoinModal();
                  }}
                  className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#FB923C] via-[#F97316] to-[#C2410C] text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-orange-500/30 border-none cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles size={16} /> Join The Warrior
                </button>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      if (onOpenLoginModal) onOpenLoginModal();
                    }}
                    className="py-3 rounded-xl bg-white/[0.08] hover:bg-white/15 text-white font-black text-xs uppercase tracking-wider border border-white/15 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Shield size={14} className="text-[#FB923C]" /> CRM Login
                  </button>

                  <a
                    href="https://wa.me/919817023336"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="py-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 font-black text-xs uppercase tracking-wider border border-emerald-500/30 cursor-pointer flex items-center justify-center gap-1.5 no-underline"
                  >
                    <MessageSquare size={14} className="text-emerald-400" /> WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
