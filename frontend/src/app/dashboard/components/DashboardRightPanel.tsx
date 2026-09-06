'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Sun, LogOut, Wifi, ChevronLeft, ChevronRight, Clock
} from 'lucide-react';
import { useAuthStore, useGymStore } from '@/store';
import { getInitials } from '@/lib/utils';
import toast from '@/lib/toast';
import NotificationCenter from './NotificationCenter';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db as fDb, isFirebaseReady } from '@/lib/firebase';

interface DashboardRightPanelProps {
  realtimeFeed?: any[];
  soundEnabled?: boolean;
  toggleSound?: () => void;
}

export default function DashboardRightPanel({
  realtimeFeed: initialFeed = [],
  soundEnabled: initialSound = true,
  toggleSound: customToggleSound,
}: DashboardRightPanelProps) {
  const { user, logout } = useAuthStore();
  const { attendance } = useGymStore();
  const router = useRouter();

  const [activeHeatmapFilter, setActiveHeatmapFilter] = useState('Yours');
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [feed, setFeed] = useState<any[]>(initialFeed);
  
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('attendance_sound_enabled');
      return saved !== 'false';
    }
    return initialSound;
  });

  const handleToggleSound = () => {
    if (customToggleSound) {
      customToggleSound();
      return;
    }
    setSoundEnabled(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem('attendance_sound_enabled', String(next));
      }
      return next;
    });
  };

  useEffect(() => {
    setCurrentTime(new Date());
    const interval = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (initialFeed && initialFeed.length > 0) {
      setFeed(initialFeed);
      return;
    }
    if (!isFirebaseReady || !fDb) return;
    const attCollection = collection(fDb, 'attendance_logs');
    const qFeed = query(attCollection, orderBy('createdAt', 'desc'), limit(5));
    const unsubscribeFeed = onSnapshot(qFeed, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      setFeed(logs);
    }, (err) => {
      console.warn("Firestore dashboard feed listener error:", err);
    });
    return () => unsubscribeFeed();
  }, [initialFeed]);

  const formatTime = (date: Date | null) => {
    if (!date) return '00:00:00';
    const hrs = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    const secs = date.getSeconds().toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const checkinDays = attendance ? attendance.map((a: any) => new Date(a.checkIn || '').getDate()) : [];

  return (
    <aside className="w-full flex flex-col gap-4 text-left">
      {/* Top Header Row: Controls + Operator Info */}
      <div className="flex justify-between items-center bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs gap-2">
        <div className="flex items-center gap-2">
          <button className="w-9 h-9 rounded-xl bg-[#EA580C] text-white flex items-center justify-center shadow-xs cursor-pointer border-none">
            <Sun size={15} />
          </button>

          <NotificationCenter />

          <button
            onClick={handleToggleSound}
            className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 flex items-center justify-center shadow-xs cursor-pointer border border-slate-200/80"
            title={soundEnabled ? "Disable Attendance Sound" : "Enable Attendance Sound"}
          >
            {soundEnabled ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-emerald-500"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500"><path d="M11 5L6 9H2v6h4l5 4V5z"></path><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>
            )}
          </button>

          <button
            onClick={() => {
              logout();
              toast.success('Signed out successfully');
              router.push('/');
            }}
            className="w-9 h-9 rounded-xl bg-slate-50 hover:bg-rose-50 text-rose-600 flex items-center justify-center shadow-xs cursor-pointer border border-slate-200/80"
            title="Sign Out"
          >
            <LogOut size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <div className="text-right">
            <div className="text-[10px] font-black text-slate-800 leading-none">{user?.name || 'Admin'}</div>
            <div className="text-[8px] text-slate-400 font-bold mt-1">Operator Shift</div>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#EA580C] text-white font-black text-xs flex items-center justify-center shadow-xs">
            {getInitials(user?.name || 'Admin')}
          </div>
        </div>
      </div>

      {/* Widget 1: Live Attendance Feed */}
      <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xs flex flex-col justify-between min-h-[260px] relative overflow-hidden">
        <div>
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Live Activity Feed</span>
          <h3 className="text-xs font-black text-slate-800 uppercase mt-0.5 font-display flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Latest Attendance
          </h3>
        </div>

        <div className="space-y-3 my-4 flex-grow overflow-y-auto max-h-[180px] pr-1">
          {feed && feed.length > 0 ? (
            feed.map((log) => {
              const tsVal = log.timestamp || log.createdAt;
              const tsDate = tsVal ? (typeof tsVal.toDate === 'function' ? tsVal.toDate() : new Date(tsVal)) : null;
              const checkinTime = tsDate && !isNaN(tsDate.getTime()) ? tsDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Just Now';
              const safeName = log.memberName || 'Member';
              const avatar = log.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${safeName.replace(/ /g, '')}`;
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between gap-2.5 bg-slate-50 p-2 rounded-xl border border-slate-100 hover:bg-slate-100/60 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={avatar}
                      alt={log.memberName}
                      className="w-7 h-7 rounded-full bg-slate-200 border border-slate-100 shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${safeName}` }}
                    />
                    <div className="text-left leading-tight">
                      <div className="text-[10px] font-black text-slate-800">{safeName}</div>
                      <div className="text-[8px] text-slate-400 font-bold">{log.memberCode || 'TWG-2026-0000'}</div>
                    </div>
                  </div>
                  <div className="text-right leading-none shrink-0">
                    <span className="text-[9px] font-black text-slate-800">{checkinTime}</span>
                    <div className="text-[7px] text-[#EA580C] font-bold mt-1 uppercase tracking-wider">{log.deviceName || 'Gate'}</div>
                  </div>
                </motion.div>
              );
            })
          ) : (
            <div className="h-full flex items-center justify-center text-slate-400 italic text-[10px] py-10 font-medium">
              Waiting for biometric punches...
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-slate-100 pt-3 text-[9px] font-bold text-slate-400 shrink-0">
          <span className="flex items-center gap-1">
            <Wifi size={11} className="text-emerald-500" />
            Active terminal listener
          </span>
        </div>
      </div>

      {/* Widget 2: Attendance Heatmap (Brand Blue Palette) */}
      <div className="bg-white text-[#0b1f3a] border border-slate-200/80 p-5 rounded-2xl shadow-xs flex flex-col justify-between min-h-[290px]">
        <div>
          <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Attendance Logs</span>
          <h3 className="text-xs font-black text-[#0b1f3a] uppercase mt-0.5 font-display">Activity Heatmap</h3>

          <div className="flex gap-1.5 mt-3">
            {['Yours', 'Mohali'].map((f) => (
              <button
                key={f}
                onClick={() => setActiveHeatmapFilter(f)}
                className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-wider transition-all border-none cursor-pointer ${
                  activeHeatmapFilter === f ? 'bg-[#EA580C] text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-[#FFF7ED] hover:text-[#EA580C]'
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2.5 my-4 justify-items-center border-t border-slate-100 pt-4 text-[9px] font-black text-slate-400">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="w-5 text-center">{d}</div>
          ))}
          {[1, 2].map(o => (
            <div key={`offset-${o}`} className="w-5 h-5 bg-transparent" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dateNum = idx + 1;
            const hasCheckin = checkinDays.includes(dateNum);
            return (
              <div
                key={idx}
                className={`w-5 h-5 rounded-full border transition-all text-[8px] font-bold flex items-center justify-center ${
                  hasCheckin
                    ? 'bg-[#EA580C] border-[#EA580C] text-white font-black shadow-xs'
                    : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-[#FED7AA] hover:bg-[#FFF7ED] hover:text-[#EA580C] cursor-pointer'
                }`}
              >
                {dateNum}
              </div>
            );
          })}
        </div>

        <div className="flex justify-between items-center text-[9px] font-black uppercase tracking-wider text-[#0b1f3a] border-t border-slate-100 pt-3">
          <span>June 2026</span>
          <div className="flex gap-1.5">
            <button className="w-5 h-5 rounded-full bg-slate-100 hover:bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center border border-slate-200 cursor-pointer">
              <ChevronLeft size={10} />
            </button>
            <button className="w-5 h-5 rounded-full bg-slate-100 hover:bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center border border-slate-200 cursor-pointer">
              <ChevronRight size={10} />
            </button>
          </div>
        </div>
      </div>

      {/* Widget 3: Live Clock (Deep Blue Brand Gradient) */}
      <div className="bg-gradient-to-br from-[#083f82] to-[#EA580C] text-white p-5 rounded-2xl shadow-md flex flex-col justify-between min-h-[140px] relative overflow-hidden border border-orange-400/30">
        <div className="absolute right-0 bottom-0 w-28 h-28 bg-white/5 rounded-full blur-xl pointer-events-none" />

        <div className="flex justify-between items-center">
          <span className="text-[9px] font-black uppercase tracking-wider text-orange-100">Live Clock</span>
          <div className="flex items-center gap-1 text-[8px] text-orange-100 font-black uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-300 animate-ping" />
            <span>Live Sync</span>
          </div>
        </div>

        <div className="mt-4 text-left">
          <h3 className="text-3xl font-black text-white tracking-wider leading-none mt-1 font-mono">
            {formatTime(currentTime)}
          </h3>
        </div>

        <div className="flex items-center justify-between mt-5 border-t border-white/10 pt-3">
          <span className="text-[8px] text-blue-200/80 font-bold uppercase tracking-wider">Mohali, Punjab (IST)</span>
          <div className="text-[8px] text-white font-black uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full border border-white/20">
            UTC +5:30
          </div>
        </div>
      </div>
    </aside>
  );
}
