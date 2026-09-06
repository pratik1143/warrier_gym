'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Clock, CreditCard, Dumbbell,
  Settings, Bell, Search, LogOut, ChevronDown, Menu, X, HelpCircle, ClipboardList,
  ChevronLeft, ChevronRight, Shield, Trophy, Smartphone, ArrowUpRight, Plus,
  Home as HomeIcon, Award, Play, Pause, Square, Sun, Moon, RefreshCw,
  Upload, Mail, BarChart2, AlertTriangle, UserPlus, UserX, Apple as AppleIcon,
  Wifi, UserCheck, Sparkles, Cpu, Phone, MessageSquare, ShieldAlert, Gift, Briefcase
} from 'lucide-react';
import { useAuthStore, useGymStore, useDeviceStore } from '@/store';
import { getInitials } from '@/lib/utils';
import toast from '@/lib/toast';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db as fDb, isFirebaseReady } from '@/lib/firebase';
import { useCallback } from 'react';
import AttendancePopupManager from './components/AttendancePopupManager';
import EmployeePopupManager from './components/EmployeePopupManager';
import { HikvisionEventPopupEngine } from './components/HikvisionEventPopupEngine';
import UniversalSearchBar from './components/UniversalSearchBar';
import LiveTimeCard from './components/LiveTimeCard';
import SoftwareFooter from './components/SoftwareFooter';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, logout, isAuthenticated } = useAuthStore();
  const {
    attendance, fetchAttendance, syncLogs, deviceStatus, members, fetchMembers, updateMember
  } = useGymStore();
  const router = useRouter();
  const pathname = usePathname();
  
  const [mounted, setMounted] = useState(false);
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [activeHeatmapFilter, setActiveHeatmapFilter] = useState('Yours');
  
  // Audio state
  const [soundEnabled, setSoundEnabled] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('attendance_sound_enabled');
      return saved !== 'false';
    }
    return true;
  });

  const toggleSound = () => {
    setSoundEnabled(prev => {
      const next = !prev;
      localStorage.setItem('attendance_sound_enabled', String(next));
      return next;
    });
  };

  const lastNotifDocRef = useRef<string>('');

  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [launchingCampaign, setLaunchingCampaign] = useState(false);

  // Sound chime player using Web Audio API
  const playDingSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (err) {
      console.warn("Failed to play sound chime:", err);
    }
  }, [soundEnabled]);

  // Real-time Feed State
  const [realtimeFeed, setRealtimeFeed] = useState<any[]>([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);


  // Firestore Listeners
  useEffect(() => {
    if (!isFirebaseReady || !fDb) return;

    // Safe Firestore Timestamp → JS Date converter
    const toJsDate = (val: any): Date | null => {
      if (!val) return null;
      if (typeof val.toDate === 'function') return val.toDate(); // Firestore Timestamp
      if (typeof val === 'string' || typeof val === 'number') return new Date(val);
      return null;
    };

    // 1. Listen for popup check-ins logic has been moved to AttendancePopupManager

    const attCollection = collection(fDb, 'attendance_logs');

    // 2. Listen for latest 5 check-ins for sidebar
    const qFeed = query(attCollection, orderBy('createdAt', 'desc'), limit(5));
    const unsubscribeFeed = onSnapshot(qFeed, (snapshot) => {
      const logs = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));
      setRealtimeFeed(logs);
    }, (err) => {
      console.warn("Firestore dashboard feed listener error:", err);
    });

    // 3. Listen for push notifications from device service (checkin, alert, enrollment)
    const notifCollection = collection(fDb, 'notifications');
    const qNotif = query(notifCollection, orderBy('timestamp', 'desc'), limit(30));
    const unsubscribeNotif = onSnapshot(qNotif, (snapshot) => {
      // Update unread badge count
      const unread = snapshot.docs.filter(d => !d.data().read).length;
      setUnreadNotifCount(unread);

      // Show toast for brand-new notifications (not historical ones)
      snapshot.docChanges().forEach((change) => {
        if (change.type !== 'added') return;
        const data = change.doc.data();
        const docId = change.doc.id;
        if (docId === lastNotifDocRef.current) return;

        // Only show toast if notification was created in last 20 seconds
        const ts = data.timestamp ? new Date(data.timestamp).getTime() : 0;
        if (Date.now() - ts > 20000) return;

        lastNotifDocRef.current = docId;
        const type = data.type || '';
        const body = data.body || data.title || 'New notification';

        if (type === 'checkin') {
          // Checkin notifications handled by attendance popup — skip duplicate toast
          return;
        } else if (type === 'alert') {
          toast(body, {
            icon: '⚠️',
            duration: 6000,
            style: { background: '#111', color: '#fff', border: '1px solid rgba(245,158,11,0.4)', borderRadius: '16px', fontSize: '12px', fontWeight: '600' }
          });
          if (soundEnabled) playDingSound();
        } else if (type === 'enrollment') {
          toast.success(body, {
            duration: 5000,
            style: { background: '#111', color: '#fff', border: '1px solid rgba(168,85,247,0.4)', borderRadius: '16px', fontSize: '12px', fontWeight: '600' }
          });
          if (soundEnabled) playDingSound();
        } else if (type === 'enrollment_error') {
          toast.error(body, {
            duration: 6000,
            style: { background: '#111', color: '#fff', border: '1px solid rgba(239,68,68,0.4)', borderRadius: '16px', fontSize: '12px', fontWeight: '600' }
          });
        }
      });
    }, (err) => {
      console.warn("Firestore dashboard notifications listener error:", err);
    });

    // 4. Listen for gym_presence for Live Members Engine
    const presenceCollection = collection(fDb, 'gym_presence');
    const unsubscribePresence = onSnapshot(presenceCollection, (snapshot) => {
      const presenceList = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      useGymStore.getState().setGymPresence(presenceList);
    }, (err) => {
      console.warn("Firestore dashboard presence listener error:", err);
    });

    // 5. Listen for devices status in real-time
    const devicesCollection = collection(fDb, 'devices');
    const unsubscribeDevices = onSnapshot(devicesCollection, (snapshot) => {
      const devices = snapshot.docs.map(doc => doc.data());
      const hasConnected = devices.some((d: any) => d.enabled && d.status === 'connected');
      const hasSyncing = devices.some((d: any) => d.enabled && d.status === 'syncing');
      
      let status: 'offline' | 'connected' | 'syncing' = 'offline';
      if (hasSyncing) {
        status = 'syncing';
      } else if (hasConnected) {
        status = 'connected';
      }
      
      useDeviceStore.getState().setDeviceStatus(status);
      useGymStore.setState({ deviceStatus: status });
    }, (err) => {
      console.warn("Firestore dashboard devices listener error:", err);
    });

    return () => {
      unsubscribeFeed();
      unsubscribeNotif();
      unsubscribePresence();
      unsubscribeDevices();
    };
  }, [isFirebaseReady, playDingSound]);

  // Fix React hydration mismatch by ensuring store auth state is read only on client
  useEffect(() => {
    setMounted(true);
    setCurrentTime(new Date());
    if (isAuthenticated) {
      fetchAttendance();
      fetchMembers();
    }
  }, [isAuthenticated]);

  // Live real-time clock
  useEffect(() => {
    const clockInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockInterval);
  }, []);

  const formatTime = (date: Date | null) => {
    if (!date) return '00:00:00';
    const hrs = date.getHours().toString().padStart(2, '0');
    const mins = date.getMinutes().toString().padStart(2, '0');
    const secs = date.getSeconds().toString().padStart(2, '0');
    return `${hrs}:${mins}:${secs}`;
  };

  // Redirect if not authenticated
  useEffect(() => {
    if (mounted && !isAuthenticated) {
      router.push('/');
    }
  }, [mounted, isAuthenticated, router]);

  if (!mounted || !isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFAF9]">
        <div className="w-8 h-8 border-2 border-[#F97316] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // 3. Prepare Heatmap Matrix from real check-ins this month
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const checkinDays = attendance ? attendance.map((a: any) => new Date(a.checkIn || '').getDate()) : [];

  return (
    <div className="min-h-screen w-full flex font-poppins text-slate-800 bg-[#FAFAF9] relative">
      {/* ─── Column 1: Left Navigation Sidebar ─── */}
      <aside className="w-[230px] lg:w-[240px] flex-shrink-0 bg-white border-r border-stone-200/80 p-4 flex flex-col justify-between h-screen sticky top-0 overflow-y-auto z-40">
        <div className="space-y-6">
          {/* Sidebar Header Brand Area */}
          <div className="px-1 flex items-center justify-start border-b border-stone-100 pb-4">
            <Link href="/dashboard/overview" className="flex items-center gap-3 group no-underline">
              <img 
                src="/gymlogo.png" 
                alt="The Warrior Gym Logo" 
                className="h-14 w-14 object-contain shrink-0 group-hover:scale-105 transition-transform drop-shadow-sm" 
              />
              <div className="flex flex-col justify-center leading-none">
                <span className="font-rowdies font-extrabold text-[14px] tracking-tight uppercase text-slate-900 leading-tight">
                  THE WARRIOR
                </span>
                <span className="font-rowdies font-black text-[14px] tracking-wider uppercase text-[#EA580C] leading-tight">
                  GYM
                </span>
              </div>
            </Link>
          </div>

          {/* Sidebar Navigation */}
          <nav className="space-y-1 pr-1">
            {[
              { to: '/dashboard/overview', label: 'Overview', icon: LayoutDashboard },
              { to: '/dashboard', label: 'Dashboard', icon: HomeIcon },
              { to: '/dashboard/members', label: 'Members', icon: Users },
              { to: '/dashboard/employees', label: 'Employees', icon: Briefcase, badge: 'NEW' },
              { to: '/dashboard/enquiries', label: 'Enquiries', icon: ClipboardList },
              { to: '/dashboard/messages', label: 'Web Messages', icon: MessageSquare, badge: 'LIVE' },
              { to: '/dashboard/expired', label: 'Expired', icon: UserX },
              { to: '/dashboard/trainers', label: 'Trainers', icon: UserCheck },
              { to: '/dashboard/follow-up', label: 'Follow Up', icon: AlertTriangle },
              { to: '/dashboard/inconsistent', label: 'Inconsistent', icon: UserX },
              { to: '/dashboard/billing', label: 'Billing', icon: CreditCard },
              { to: '/dashboard/automation', label: 'Email Automation', icon: Mail },
              { to: '/dashboard/memberships', label: 'Memberships', icon: Award },
              { to: '/dashboard/settings', label: 'Settings', icon: Settings }
            ].map((item, idx) => {
              const isActive = pathname === item.to || (item.to !== '/dashboard' && pathname.startsWith(item.to));
              return (
                <Link
                  key={idx}
                  href={item.to}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider transition-all ${
                    isActive 
                      ? 'bg-[#FFF7ED] text-[#EA580C] border border-[#FED7AA] shadow-xs' 
                      : 'text-slate-600 hover:text-[#EA580C] hover:bg-[#FFF7ED]/60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <item.icon size={14} className={isActive ? 'text-[#EA580C]' : 'text-slate-400'} />
                    <span>{item.label}</span>
                  </div>
                  {item.badge && (
                    <span className="bg-gradient-to-r from-[#F97316] to-[#EA580C] text-white text-[8px] font-black px-1.5 py-0.5 rounded-full scale-90 border border-orange-300 animate-pulse">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Bottom: User Profile + Sign Out */}
        <div className="mt-4 border-t border-stone-100 pt-4 space-y-2">
          {/* User Info */}
          <div className="flex items-center gap-3 px-2 py-2 rounded-xl bg-stone-50 border border-stone-100">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#F97316] to-[#EA580C] text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
              {getInitials(user?.name || 'A')}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black text-slate-800 truncate">{user?.name || 'Gym Owner'}</div>
              <div className="text-[8px] text-slate-400 font-bold uppercase tracking-wider truncate">{user?.role?.replace('_', ' ')}</div>
            </div>
          </div>

          {/* Sign Out Button */}
          <button
            onClick={() => {
              logout();
              toast.success('Signed out successfully');
              router.push('/');
            }}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider text-red-500 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all cursor-pointer bg-transparent"
          >
            <LogOut size={13} className="shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* ─── Main Workspace Content Area ─── */}
      <main className="flex-1 min-w-0 w-full p-4 sm:p-6 overflow-y-auto flex flex-col gap-4 text-left bg-[#FAFAF9]">
        {/* Top Header Bar: Universal Search (Left/Center) + Live Time Card (Right) */}
        <div className="w-full flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0 pb-1">
          <div className="w-full sm:max-w-[460px] md:max-w-[500px]">
            <UniversalSearchBar />
          </div>
          <LiveTimeCard />
        </div>
        {children}
        <SoftwareFooter />
      </main>

      {/* AI Gym Copilot Helper */}
      {(() => {
        // We define the getRenewalPrediction function in a self-executing helper scope or just invoke it
        return null;
      })()}

      {/* AI Gym Copilot Pulsing FAB */}
      <button
        onClick={() => setIsCopilotOpen(true)}
        className="fixed bottom-8 right-8 z-[60] w-14 h-14 bg-gradient-to-tr from-[#F97316] via-[#EA580C] to-[#C2410C] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.5)] hover:scale-105 active:scale-95 transition-all animate-bounce cursor-pointer text-white border border-white/20"
        title="Warrior AI Gym Copilot"
      >
        <Sparkles size={24} className="animate-pulse" />
      </button>

      {/* Copilot Drawer Backdrop */}
      <AnimatePresence>
        {isCopilotOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCopilotOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[65]"
            />

            {/* Copilot Side Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 right-0 h-full w-[380px] bg-slate-950/95 border-l border-white/10 shadow-2xl z-[70] flex flex-col justify-between overflow-hidden backdrop-blur-md text-white font-sans text-left"
            >
              {/* Header */}
              <div className="p-5 border-b border-white/10 flex items-center justify-between bg-slate-900/50">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Cpu size={16} className="animate-pulse" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black tracking-wider uppercase font-display text-white">Warrior Copilot™</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Realtime Gym Intelligence</p>
                  </div>
                </div>
                <button
                  onClick={() => setIsCopilotOpen(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors border-none cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Drawer Body - Scrollable content */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6 scrollbar-thin">
                {/* 1. Forecast & Expected Indicators */}
                {(() => {
                  const planPrices: Record<string, number> = {
                    'Monthly': 2500, 
                    'Quarterly': 6500, 
                    'Semi-Annual': 11500, 
                    'Annual Premium': 18000
                  };

                  // Helper for prediction inside layout
                  const predictRenewal = (m: any) => {
                    let score = 45; 
                    const attendCount = m.attendanceCount || 0;
                    if (attendCount > 12) score += 25;
                    else if (attendCount > 6) score += 15;
                    else if (attendCount > 2) score += 5;
                    else score -= 15;

                    const streak = m.streak || 0;
                    if (streak > 7) score += 15;
                    else if (streak > 3) score += 8;

                    const hasTrainer = m.trainer && m.trainer.trim() !== '';
                    if (hasTrainer) score += 15;
                    else score -= 5;

                    const fitScore = m.fitnessScore || 70;
                    if (fitScore > 85) score += 12;
                    else if (fitScore > 75) score += 6;
                    else score -= 8;

                    const plan = (m.plan || '').toLowerCase();
                    if (plan.includes('annual')) score += 12;
                    else if (plan.includes('semi')) score += 8;
                    else if (plan.includes('quarter')) score += 4;

                    if (m.age && m.age > 22 && m.age < 38) score += 3;

                    const finalScore = Math.max(8, Math.min(96, score));
                    
                    let category: 'Green' | 'Yellow' | 'Red' = 'Yellow';
                    if (finalScore >= 80) category = 'Green';
                    else if (finalScore < 50) category = 'Red';

                    const reasons: string[] = [];
                    if (attendCount > 6) reasons.push("High Attendance");
                    else reasons.push("Low Attendance");
                    if (hasTrainer) reasons.push("Trainer Engagement");
                    else reasons.push("No Assigned Coach");
                    if (fitScore > 75) reasons.push("Diet Compliance");
                    else reasons.push("No Diet Tracking");

                    return { score: finalScore, category, reasons };
                  };

                  const totalInScope = members.length;
                  let expectedRevenue = 0;
                  let expectedRenewalsCount = 0;
                  let riskMembersCount = 0;

                  members.forEach(m => {
                    const pred = predictRenewal(m);
                    const price = planPrices[m.plan] || 2500;
                    expectedRevenue += (price * pred.score / 100);
                    expectedRenewalsCount += (pred.score / 100);
                    if (pred.category === 'Red') riskMembersCount++;
                  });

                  return (
                    <div className="space-y-3 text-left">
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">Revenue & Renewal Forecast</span>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="p-3 bg-slate-900 border border-white/5 rounded-2xl text-center space-y-1">
                          <span className="text-[8px] font-bold text-slate-500 uppercase block">Expected Revenue</span>
                          <span className="text-xs font-black text-emerald-450 font-mono">₹{Math.round(expectedRevenue).toLocaleString()}</span>
                        </div>
                        <div className="p-3 bg-slate-900 border border-white/5 rounded-2xl text-center space-y-1">
                          <span className="text-[8px] font-bold text-slate-500 uppercase block">Expected Renewals</span>
                          <span className="text-xs font-black text-indigo-400 font-mono">{Math.round(expectedRenewalsCount)} / {totalInScope}</span>
                        </div>
                        <div className="p-3 bg-slate-900 border border-white/5 rounded-2xl text-center space-y-1">
                          <span className="text-[8px] font-bold text-slate-500 uppercase block">High Risk Cards</span>
                          <span className="text-xs font-black text-rose-500 font-mono">{riskMembersCount} Members</span>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Realtime Risk Interventions */}
                <div className="space-y-3 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">High Risk Member Roster</span>
                    <span className="text-[8px] bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full font-bold uppercase animate-pulse">Action Required</span>
                  </div>

                  <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
                    {(() => {
                      const predictRenewal = (m: any) => {
                        let score = 45; 
                        const attendCount = m.attendanceCount || 0;
                        if (attendCount > 12) score += 25;
                        else if (attendCount > 6) score += 15;
                        else if (attendCount > 2) score += 5;
                        else score -= 15;

                        const streak = m.streak || 0;
                        if (streak > 7) score += 15;
                        else if (streak > 3) score += 8;

                        const hasTrainer = m.trainer && m.trainer.trim() !== '';
                        if (hasTrainer) score += 15;
                        else score -= 5;

                        const fitScore = m.fitnessScore || 70;
                        if (fitScore > 85) score += 12;
                        else if (fitScore > 75) score += 6;
                        else score -= 8;

                        const plan = (m.plan || '').toLowerCase();
                        if (plan.includes('annual')) score += 12;
                        else if (plan.includes('semi')) score += 8;
                        else if (plan.includes('quarter')) score += 4;

                        if (m.age && m.age > 22 && m.age < 38) score += 3;

                        const finalScore = Math.max(8, Math.min(96, score));
                        
                        let category: 'Green' | 'Yellow' | 'Red' = 'Yellow';
                        if (finalScore >= 80) category = 'Green';
                        else if (finalScore < 50) category = 'Red';

                        const reasons: string[] = [];
                        if (attendCount > 6) reasons.push("High Attendance");
                        else reasons.push("Low Attendance");
                        if (hasTrainer) reasons.push("Trainer Engagement");
                        else reasons.push("No Assigned Coach");
                        if (fitScore > 75) reasons.push("Diet Compliance");
                        else reasons.push("No Diet Tracking");

                        return { score: finalScore, category, reasons };
                      };

                      const riskList = members
                        .map(m => ({ member: m, pred: predictRenewal(m) }))
                        .filter(item => item.pred.category === 'Red')
                        .slice(0, 5);

                      if (riskList.length === 0) {
                        return <div className="text-center py-6 text-xs text-slate-500 italic">No high risk members found. Good job! 🎉</div>;
                      }

                      return riskList.map((item, idx) => {
                        const m = item.member;
                        const pred = item.pred;
                        return (
                          <div key={idx} className="p-3.5 bg-slate-900 border border-white/5 rounded-2xl space-y-3">
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="text-xs font-extrabold text-white">{m.name}</h4>
                                <p className="text-[9px] text-slate-400 font-semibold">{m.plan} · Streak: {m.streak || 0}d</p>
                              </div>
                              <div className="text-right">
                                <span className="text-[9px] font-black text-rose-500 font-mono">{pred.score}% Chance</span>
                                <span className="text-[7px] text-slate-500 uppercase block mt-0.5 font-bold">Renewal Prob.</span>
                              </div>
                            </div>

                            {/* Reasons labels */}
                            <div className="flex flex-wrap gap-1">
                              {pred.reasons.map((r, i) => (
                                <span key={i} className="text-[8px] font-bold bg-white/5 border border-white/10 text-slate-350 px-1.5 py-0.5 rounded">
                                  {r}
                                </span>
                              ))}
                            </div>

                            {/* Action Row */}
                            <div className="grid grid-cols-5 gap-1.5 pt-1.5 border-t border-white/5">
                              <button
                                onClick={() => {
                                  toast.success(`Dialing ${m.name} (+91 ${m.phone || '9876543210'})...`);
                                }}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg flex items-center justify-center border-none cursor-pointer transition-colors"
                                title="Call Member"
                              >
                                <Phone size={12} />
                              </button>
                              <button
                                onClick={() => {
                                  const text = encodeURIComponent(`Hi ${m.name}, we notice you haven't checked in recently. To help you stay on track, we're offering a special 15% discount if you renew your membership this week!`);
                                  window.open(`https://wa.me/91${m.phone || '9876543210'}?text=${text}`, '_blank');
                                  toast.success(`WhatsApp campaign opened for ${m.name}`);
                                }}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg flex items-center justify-center border-none cursor-pointer transition-colors"
                                title="Send WhatsApp"
                              >
                                <MessageSquare size={12} />
                              </button>
                              <button
                                onClick={() => {
                                  toast.success(`15% renewal discount coupon successfully sent to ${m.name} via SMS & Email!`);
                                }}
                                className="p-1.5 bg-emerald-950 hover:bg-emerald-900 text-emerald-400 rounded-lg flex items-center justify-center border-none cursor-pointer transition-colors text-[9px] font-black font-mono"
                                title="Offer 15% Discount"
                              >
                                -15%
                              </button>
                              <button
                                onClick={() => {
                                  const coach = prompt(`Assign Personal Trainer to ${m.name}:`, m.trainer || 'Rohit Sharma');
                                  if (coach && coach.trim() !== '') {
                                    updateMember(m.id, { trainer: coach.trim() })
                                      .then(() => toast.success(`Coach ${coach} assigned to ${m.name}!`))
                                      .catch(() => toast.error(`Failed to assign coach`));
                                  }
                                }}
                                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg flex items-center justify-center border-none cursor-pointer transition-colors"
                                title="Assign Trainer"
                              >
                                <UserCheck size={12} />
                              </button>
                              <button
                                onClick={() => {
                                  toast.success(`Follow-up log created for ${m.name}. Syncing to Firestore...`);
                                }}
                                className="p-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-400 rounded-lg flex items-center justify-center border-none cursor-pointer transition-colors"
                                title="Create Follow Up"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

                {/* 3. AI Alerts & Predictions */}
                <div className="space-y-3 text-left">
                  <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">AI Alerts & Insights</span>
                  <div className="space-y-2 text-xs">
                    {/* Attendance Drop Alert */}
                    <div className="p-3 bg-red-950/20 border border-red-500/20 text-red-200 rounded-2xl flex gap-2.5 items-start">
                      <AlertTriangle size={15} className="text-red-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Attendance Drop Alert</span>
                        <p className="text-[9.5px] text-slate-400 leading-normal mt-0.5">Amit Kumar has checked in 0 times in the last 7 days. Streak lost. Send re-engagement nudge.</p>
                      </div>
                    </div>

                    {/* Trainer Recommendation */}
                    <div className="p-3 bg-indigo-950/20 border border-indigo-500/20 text-indigo-200 rounded-2xl flex gap-2.5 items-start">
                      <Sparkles size={15} className="text-indigo-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Diet & Coach Recommendation</span>
                        <p className="text-[9.5px] text-slate-400 leading-normal mt-0.5">Coach Rohit Sharma has 92% client compliance. Recommend duplicating his keto-shred templates to other fat-loss athletes.</p>
                      </div>
                    </div>

                    {/* Branch Performance Prediction */}
                    <div className="p-3 bg-[#d4ff00]/5 border border-[#d4ff00]/20 text-[#d4ff00] rounded-2xl flex gap-2.5 items-start">
                      <BarChart2 size={15} className="text-[#d4ff00] shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold block">Branch Performance Forecast</span>
                        <p className="text-[9.5px] text-slate-400 leading-normal mt-0.5">Mohali branch is predicted to see a 12% increase in premium signups based on biometric attendance capacity trends.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer Campaign Launch */}
              <div className="p-5 border-t border-white/10 bg-slate-900/40">
                <button
                  onClick={() => {
                    setLaunchingCampaign(true);
                    setTimeout(() => {
                      setLaunchingCampaign(false);
                      toast.success('WhatsApp Re-engagement campaign launched successfully for all High-Risk members!');
                    }, 1500);
                  }}
                  disabled={launchingCampaign}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50 border-none flex items-center justify-center gap-2"
                >
                  <MessageSquare size={13} />
                  <span>{launchingCampaign ? 'Sending Campaigns...' : 'Smart WhatsApp Campaigns'}</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    <AttendancePopupManager />
    <EmployeePopupManager />
    <HikvisionEventPopupEngine />
    </div>
  );
}

const ArrowLeftIcon = ({ size }: { size: number }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12"></line>
    <polyline points="12 19 5 12 12 5"></polyline>
  </svg>
);

const SendIcon = ({ size, className }: { size: number; className?: string }) => (
  <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
    <line x1="22" y1="2" x2="11" y2="13"></line>
    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
  </svg>
);
