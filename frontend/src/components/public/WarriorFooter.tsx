'use client';

import React from 'react';
import Link from 'next/link';
import { Phone, Mail, Clock, MapPin, ArrowUpRight, MessageCircle } from 'lucide-react';

interface WarriorFooterProps {
  onOpenLoginModal?: () => void;
}

export default function WarriorFooter({ onOpenLoginModal }: WarriorFooterProps) {
  return (
    <footer className="w-full bg-[#050507] text-zinc-400 border-t border-white/5 py-16 px-4 sm:px-6 select-none font-sans text-left">
      <div className="max-w-7xl mx-auto space-y-12">
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 items-start">
          
          {/* Col 1: Brand & Bio (4 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <Link href="/" className="flex items-center gap-3 no-underline group">
              <img
                src="/gymlogo.png"
                alt="The Warrior Gym"
                className="h-11 w-auto object-contain drop-shadow-[0_0_15px_rgba(249,115,22,0.4)]"
              />
              <div className="flex flex-col leading-none">
                <span className="font-black text-base tracking-wider uppercase text-white font-display">
                  THE WARRIOR
                </span>
                <span className="font-black text-sm tracking-widest uppercase text-[#F97316] font-display">
                  GYM
                </span>
              </div>
            </Link>

            <p className="text-xs text-zinc-400 leading-relaxed font-medium">
              Beyond Strength. Beyond Limits. Mohali&apos;s premier high-performance strength and athletic conditioning destination.
            </p>

            <div className="flex items-center gap-3 pt-2">
              <a
                href="https://wa.me/919817023336"
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 rounded-xl bg-white/5 hover:bg-emerald-500/20 text-zinc-300 hover:text-emerald-400 text-xs font-bold transition-colors border border-white/10 flex items-center gap-2 no-underline"
              >
                <MessageCircle size={14} className="text-emerald-400" />
                <span>WhatsApp Desk</span>
              </a>
            </div>
          </div>

          {/* Col 2: Navigation Links (2 cols) */}
          <div className="lg:col-span-2 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-white font-display">
              NAVIGATION
            </h4>
            <div className="flex flex-col gap-2 text-xs font-semibold">
              <a href="#" className="text-zinc-400 hover:text-[#F97316] transition-colors no-underline">Home</a>
              <a href="#experience" className="text-zinc-400 hover:text-[#F97316] transition-colors no-underline">Experience</a>
              <a href="#programs" className="text-zinc-400 hover:text-[#F97316] transition-colors no-underline">Programs</a>
              <a href="#facility" className="text-zinc-400 hover:text-[#F97316] transition-colors no-underline">Facility</a>
              <a href="#trainers" className="text-zinc-400 hover:text-[#F97316] transition-colors no-underline">Trainers</a>
              <a href="#membership" className="text-zinc-400 hover:text-[#F97316] transition-colors no-underline">Memberships</a>
              <button
                onClick={onOpenLoginModal}
                className="text-[#FB923C] hover:text-[#EA580C] font-black transition-colors text-left bg-transparent border-none cursor-pointer p-0 text-xs"
              >
                ⚡ CRM Portal Login
              </button>
            </div>
          </div>

          {/* Col 3: Hours & Support (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-white font-display">
              HOURS & CONTACT
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-start gap-2.5">
                <Clock size={14} className="text-[#F97316] shrink-0 mt-0.5" />
                <div>
                  <div className="text-white font-bold">05:00 AM – 10:00 PM</div>
                  <div className="text-[11px] text-zinc-500">Open 7 Days a Week</div>
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-1">
                <Phone size={14} className="text-[#F97316] shrink-0" />
                <a href="tel:+919817023336" className="text-zinc-300 hover:text-white font-mono font-bold no-underline">
                  +91 98170 23336
                </a>
              </div>

              <div className="flex items-center gap-2.5">
                <Mail size={14} className="text-[#F97316] shrink-0" />
                <span className="text-zinc-400">Ramansingh6158@gmail.com</span>
              </div>
            </div>
          </div>

          {/* Col 4: Branch Location (3 cols) */}
          <div className="lg:col-span-3 space-y-3">
            <h4 className="text-xs font-black uppercase tracking-widest text-white font-display">
              BRANCH LOCATION
            </h4>
            <div className="flex items-start gap-2 text-xs">
              <MapPin size={14} className="text-[#F97316] shrink-0 mt-0.5" />
              <div className="text-zinc-300 leading-relaxed">
                The Warrior Gym Mohali<br />
                SCO 30, 31, Sector 89<br />
                Mohali, Punjab 140308, India
              </div>
            </div>

            <div className="pt-1">
              <a
                href="https://maps.google.com/?q=The+Warrior+Gym+Sector+89+Mohali"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#FB923C] hover:text-orange-400 transition-colors no-underline"
              >
                <span>Open in Google Maps</span>
                <ArrowUpRight size={13} />
              </a>
            </div>
          </div>

        </div>

        {/* Bottom Copyright & Legal Strip */}
        <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-zinc-500 font-medium">
          <div>
            © 2026 The Warrior Gym. All rights reserved.
          </div>
          <div className="flex items-center gap-4">
            <Link href="/privacy-policy" className="hover:text-zinc-300 transition-colors no-underline">
              Privacy Policy
            </Link>
            <span>•</span>
            <Link href="/terms" className="hover:text-zinc-300 transition-colors no-underline">
              Terms & Conditions
            </Link>
          </div>
        </div>

      </div>
    </footer>
  );
}
