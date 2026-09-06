'use client';

import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { SYSTEM_CONFIG } from '@/config/system';

export default function LiveTimeCard() {
  const [timeState, setTimeState] = useState<{
    timeStr: string;
    dateStr: string;
  } | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: SYSTEM_CONFIG.timezone,
      });

      const dateStr = now.toLocaleDateString('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: SYSTEM_CONFIG.timezone,
      });

      setTimeState({ timeStr, dateStr });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-3 bg-white border border-stone-200/90 rounded-2xl px-4 py-2 shadow-xs shrink-0 self-end sm:self-auto hover:border-[#FED7AA] transition-all">
      <div className="w-10 h-10 rounded-xl bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center shrink-0 border border-[#FED7AA]">
        <Clock size={18} />
      </div>
      <div>
        <div className="text-sm md:text-base font-black text-slate-900 font-mono tracking-tight leading-none">
          {timeState ? timeState.timeStr : '--:--:-- --'}
        </div>
        <div className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider leading-none">
          {timeState ? timeState.dateStr : 'Loading...'}
        </div>
      </div>
    </div>
  );
}
