"use client";

import React from "react";
import { motion } from "framer-motion";

export interface PremiumKPICardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  colorHex: string;
  delay?: number;
  suffix?: string;
  href?: string;
}

export default function PremiumKPICard({
  title,
  value,
  icon: Icon,
  colorHex,
  delay = 0,
  suffix,
}: PremiumKPICardProps) {
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
      : "99, 102, 241";
  };

  const rgb = hexToRgb(colorHex);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, delay, ease: "easeOut" as const }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="relative bg-white rounded-2xl p-5 border border-slate-100 shadow-[0_2px_12px_-2px_rgba(0,0,0,0.06)] overflow-hidden group cursor-default"
    >
      {/* Glow blob */}
      <div
        className="absolute -top-4 -right-4 w-20 h-20 rounded-full blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-500"
        style={{ backgroundColor: colorHex }}
      />

      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[10.5px] font-bold text-slate-600 uppercase tracking-widest leading-none">
          {title}
        </p>
        <div
          className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `rgba(${rgb}, 0.1)`, color: colorHex }}
        >
          <Icon size={15} strokeWidth={2.5} />
        </div>
      </div>

      {/* Value */}
      <div className="flex items-end gap-1">
        <span className="text-2xl font-black text-slate-900 tracking-tight leading-none">
          {value}
        </span>
        {suffix && (
          <span className="text-xs font-bold text-slate-500 mb-0.5">{suffix}</span>
        )}
      </div>

      {/* Bottom accent bar */}
      <div
        className="absolute bottom-0 left-0 h-[3px] w-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{ background: `linear-gradient(90deg, ${colorHex}, transparent)` }}
      />
    </motion.div>
  );
}
