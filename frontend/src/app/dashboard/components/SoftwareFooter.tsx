'use client';

import React from 'react';
import { ShieldCheck } from 'lucide-react';

export default function SoftwareFooter() {
  return (
    <footer className="w-full mt-auto pt-6 pb-3 border-t border-slate-200/80 text-slate-500 text-[11px] font-medium shrink-0">
      <div className="flex flex-col md:flex-row items-center justify-between gap-2.5 text-center md:text-left">
        {/* Left: Copyright */}
        <div className="flex items-center gap-1.5 text-slate-600 font-medium order-2 md:order-1">
          <ShieldCheck size={14} className="text-[#EA580C] shrink-0" />
          <span>
            © 2026 <strong className="text-slate-800 font-bold">Prototech Technologies</strong>. All rights reserved.
          </span>
        </div>

        {/* Center: System Badge */}
        <div className="order-1 md:order-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100/90 border border-slate-200 text-slate-700 text-[10px] font-bold tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EA580C]" />
            Warrior Gym OS <span className="text-slate-400 font-normal">·</span> Gym Management Platform
          </span>
        </div>

        {/* Right: Developer Attribution */}
        <div className="text-slate-600 text-[11px] font-medium order-3">
          Built &amp; Powered by <span className="text-[#EA580C] font-extrabold">Prototech Technologies</span>
        </div>
      </div>
    </footer>
  );
}
