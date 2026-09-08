'use client';

import React, { useState, useEffect } from 'react';
import { Clock, Radio, Sparkles } from 'lucide-react';
import { SYSTEM_CONFIG } from '@/config/system';

export default function LiveTimeCard() {
  const [timeData, setTimeData] = useState<{
    hours: string;
    minutes: string;
    seconds: string;
    period: string;
    weekday: string;
    day: string;
    month: string;
    year: string;
    secondsNum: number;
  } | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();

      // Format time parts with Intl
      const timeFormatter = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
        timeZone: SYSTEM_CONFIG.timezone,
      });

      const parts = timeFormatter.formatToParts(now);
      const hours = parts.find(p => p.type === 'hour')?.value || '12';
      const minutes = parts.find(p => p.type === 'minute')?.value || '00';
      const seconds = parts.find(p => p.type === 'second')?.value || '00';
      const period = (parts.find(p => p.type === 'dayPeriod')?.value || 'PM').toUpperCase();

      // Date parts
      const dateFormatter = new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: SYSTEM_CONFIG.timezone,
      });

      const dateParts = dateFormatter.formatToParts(now);
      const weekday = (dateParts.find(p => p.type === 'weekday')?.value || 'TUE').toUpperCase();
      const day = dateParts.find(p => p.type === 'day')?.value || '08';
      const month = (dateParts.find(p => p.type === 'month')?.value || 'SEP').toUpperCase();
      const year = dateParts.find(p => p.type === 'year')?.value || '2026';

      setTimeData({
        hours,
        minutes,
        seconds,
        period,
        weekday,
        day,
        month,
        year,
        secondsNum: parseInt(seconds, 10) || 0,
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute second progress ring (0 to 100%)
  const secondsProgress = timeData ? (timeData.secondsNum / 60) * 100 : 0;
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (secondsProgress / 100) * circumference;

  return (
    <div className="group relative flex items-center gap-3.5 bg-gradient-to-br from-white via-[#FFFDFB] to-[#FFF7ED] border border-stone-200/90 hover:border-orange-300/80 rounded-2xl px-4 py-2.5 shadow-[0_4px_16px_rgba(234,88,12,0.06)] hover:shadow-[0_8px_25px_rgba(234,88,12,0.12)] transition-all duration-300 shrink-0 self-end sm:self-auto cursor-default select-none">
      
      {/* Ambient background glow on hover */}
      <div className="absolute -top-6 -right-6 w-24 h-24 bg-orange-400/10 rounded-full blur-xl pointer-events-none group-hover:bg-orange-500/15 transition-all duration-500" />

      {/* ── Chronometer Dial with Animated Circular Seconds Track ── */}
      <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
        <svg className="w-11 h-11 -rotate-90 transform overflow-visible" viewBox="0 0 44 44">
          {/* Background subtle circle */}
          <circle
            cx="22"
            cy="22"
            r={radius}
            className="text-stone-100"
            strokeWidth="2.5"
            stroke="currentColor"
            fill="transparent"
          />
          {/* Dynamic SVG Gradient */}
          <defs>
            <linearGradient id="clockRingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F97316" />
              <stop offset="50%" stopColor="#EA580C" />
              <stop offset="100%" stopColor="#F59E0B" />
            </linearGradient>
          </defs>
          {/* Progress Ring with smooth transition */}
          <circle
            cx="22"
            cy="22"
            r={radius}
            stroke="url(#clockRingGradient)"
            strokeWidth="2.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            className="transition-all duration-1000 ease-linear"
          />
        </svg>

        {/* Center Clock Icon with micro pulsing glow */}
        <div className="absolute inset-0 m-auto w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFF7ED] to-[#FFEDD5] border border-orange-200/80 flex items-center justify-center shadow-xs group-hover:scale-105 transition-transform duration-200">
          <Clock size={15} className="text-[#EA580C]" />
        </div>
      </div>

      {/* ── Digital Precision Time & Date Hierarchy ── */}
      <div className="flex flex-col justify-center min-w-0">
        
        {/* Top Time Row: HH:MM with blinking colon + SS in orange badge + AM/PM */}
        <div className="flex items-baseline gap-1.5 leading-none">
          
          {/* HH : MM */}
          <span className="text-base sm:text-[18px] font-black tracking-tight text-slate-900 font-mono">
            {timeData ? timeData.hours : '12'}
            <span className="inline-block px-0.5 text-[#EA580C] animate-pulse font-extrabold">:</span>
            {timeData ? timeData.minutes : '00'}
          </span>

          {/* Seconds Pill Badge */}
          <div className="flex items-center gap-1">
            <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-r from-[#EA580C] to-[#F97316] text-white text-[10px] font-black font-mono tracking-wider shadow-xs shadow-orange-500/20">
              :{timeData ? timeData.seconds : '00'}
            </span>

            {/* AM / PM Pill */}
            <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
              {timeData ? timeData.period : 'PM'}
            </span>
          </div>

        </div>

        {/* Bottom Date Row: DAY, DD MON YYYY + LIVE SYNC DOT */}
        <div className="flex items-center gap-2 mt-1 leading-none">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
            {timeData
              ? `${timeData.weekday}, ${timeData.day} ${timeData.month} ${timeData.year}`
              : 'TUE, 08 SEP 2026'}
          </span>

          {/* Live Sync Badge */}
          <span className="hidden sm:inline-flex items-center gap-1 text-[8.5px] font-black uppercase tracking-wider text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            IST
          </span>
        </div>

      </div>

    </div>
  );
}
