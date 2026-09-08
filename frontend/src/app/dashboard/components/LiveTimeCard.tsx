'use client';

import React, { useState, useEffect } from 'react';
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
    hoursNum: number;
    minutesNum: number;
    secondsNum: number;
  } | null>(null);

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();

      // Time formatter
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

      // Date formatter
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
        hoursNum: parseInt(hours, 10) || 12,
        minutesNum: parseInt(minutes, 10) || 0,
        secondsNum: parseInt(seconds, 10) || 0,
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Compute live angles for working analog chronometer hands
  const hours12 = (timeData?.hoursNum || 12) % 12;
  const minutesVal = timeData?.minutesNum || 0;
  const secondsVal = timeData?.secondsNum || 0;

  const hourAngle = (hours12 + minutesVal / 60) * 30; // 360 / 12 = 30 deg/hr
  const minuteAngle = (minutesVal + secondsVal / 60) * 6; // 360 / 60 = 6 deg/min
  const secondAngle = secondsVal * 6; // 360 / 60 = 6 deg/sec

  // Outer second progress ring (0 to 60s)
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - ((secondsVal / 60) * circumference);

  return (
    <div className="group relative flex items-center gap-3 bg-white hover:bg-[#FFFDFB] border border-stone-200/90 hover:border-orange-300 rounded-2xl px-3.5 py-2 shadow-[0_2px_10px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_20px_rgba(234,88,12,0.1)] transition-all duration-200 shrink-0 self-end sm:self-auto cursor-default select-none">
      
      {/* Subtle background ambient warm glow */}
      <div className="absolute -top-4 -right-4 w-20 h-20 bg-orange-400/10 rounded-full blur-xl pointer-events-none group-hover:bg-orange-500/15 transition-all duration-300" />

      {/* ── Precision Working Luxury Chronometer Dial ── */}
      <div className="relative w-11 h-11 flex items-center justify-center shrink-0">
        <svg
          className="w-11 h-11 overflow-visible drop-shadow-xs"
          viewBox="0 0 44 44"
        >
          <defs>
            {/* Bezel Gradient */}
            <linearGradient id="bezelGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FB923C" />
              <stop offset="50%" stopColor="#EA580C" />
              <stop offset="100%" stopColor="#C2410C" />
            </linearGradient>

            {/* Dial Face Subtle Radial Gradient */}
            <radialGradient id="dialFace" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="85%" stopColor="#FFF9F5" />
              <stop offset="100%" stopColor="#FFEDD5" />
            </radialGradient>
          </defs>

          {/* Background Outer Ring Track */}
          <circle
            cx="22"
            cy="22"
            r={radius}
            stroke="#F1F5F9"
            strokeWidth="2.5"
            fill="url(#dialFace)"
          />

          {/* Active Seconds Progress Arc on Outer Bezel */}
          <circle
            cx="22"
            cy="22"
            r={radius}
            stroke="url(#bezelGrad)"
            strokeWidth="2.5"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            transform="rotate(-90 22 22)"
            className="transition-all duration-1000 ease-linear"
          />

          {/* Hour Indices / Cardinal Markers (12, 3, 6, 9) */}
          <line x1="22" y1="5.5" x2="22" y2="8" stroke="#EA580C" strokeWidth="1.8" strokeLinecap="round" />
          <line x1="38.5" y1="22" x2="36" y2="22" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="22" y1="38.5" x2="22" y2="36" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="5.5" y1="22" x2="8" y2="22" stroke="#94A3B8" strokeWidth="1.5" strokeLinecap="round" />

          {/* Minute Ticks */}
          <circle cx="33.5" cy="10.5" r="0.75" fill="#CBD5E1" />
          <circle cx="33.5" cy="33.5" r="0.75" fill="#CBD5E1" />
          <circle cx="10.5" cy="33.5" r="0.75" fill="#CBD5E1" />
          <circle cx="10.5" cy="10.5" r="0.75" fill="#CBD5E1" />

          {/* Hour Hand (Dark Navy Slate) */}
          <g transform={`rotate(${hourAngle} 22 22)`}>
            <line
              x1="22"
              y1="22"
              x2="22"
              y2="12"
              stroke="#0F172A"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </g>

          {/* Minute Hand (Sleek Slate) */}
          <g transform={`rotate(${minuteAngle} 22 22)`}>
            <line
              x1="22"
              y1="22"
              x2="22"
              y2="7.5"
              stroke="#334155"
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </g>

          {/* Second Hand (Energetic Orange Needle with Counter-Weight) */}
          <g transform={`rotate(${secondAngle} 22 22)`} className="transition-transform duration-200">
            {/* Counterweight */}
            <line
              x1="22"
              y1="22"
              x2="22"
              y2="25.5"
              stroke="#C2410C"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
            {/* Long needle */}
            <line
              x1="22"
              y1="22"
              x2="22"
              y2="5"
              stroke="#EA580C"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            {/* Luminous indicator dot near tip */}
            <circle cx="22" cy="7" r="1.2" fill="#F97316" />
          </g>

          {/* Center Hub / Pivot Cap */}
          <circle cx="22" cy="22" r="2.2" fill="#EA580C" stroke="#FFFFFF" strokeWidth="0.8" />
        </svg>
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

            {/* AM / PM */}
            <span className="text-[10px] font-black uppercase text-slate-600 tracking-wider">
              {timeData ? timeData.period : 'PM'}
            </span>
          </div>
        </div>

        {/* Bottom Date Row: DAY, DD MON YYYY + LIVE SYNC BADGE */}
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
