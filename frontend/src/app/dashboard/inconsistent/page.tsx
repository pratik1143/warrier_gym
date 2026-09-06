'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Phone, MessageSquare, AlertTriangle, Send, Bell, 
  Calendar, UserX, Users, UserCheck, RefreshCw, X, ShieldAlert,
  Clock, ArrowUpRight, CheckCircle2, Filter, Sparkles, ExternalLink,
  ChevronRight, SlidersHorizontal, User, Check, Eye, UserPlus, Flame
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, addDoc, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { formatDate, getInitials, formatCurrency } from '@/lib/utils';
import toast from '@/lib/toast';
import { useRouter } from 'next/navigation';

export default function InconsistentAttendancePage() {
  const router = useRouter();
  
  // Data states
  const [members, setMembers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [empAttendance, setEmpAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);

  // Gym Date Config (Defaults to Today's date YYYY-MM-DD)
  const [asOfDate, setAsOfDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'both' | 'members' | 'employees'>('both');
  const [membershipStatusFilter, setMembershipStatusFilter] = useState<'active' | 'expired' | 'frozen' | 'all'>('active');
  const [durationFilter, setDurationFilter] = useState<string>('all'); // 'all', '2-3', '4-7', '8-14', '15-29', '30+', 'custom'
  const [chipFilter, setChipFilter] = useState<string>('all'); // Quick chips
  const [customMinDays, setCustomMinDays] = useState<number>(10);
  const [customMaxDays, setCustomMaxDays] = useState<number>(20);
  const [trainerFilter, setTrainerFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'most_absent' | 'least_absent' | 'recent_checkin' | 'name_asc' | 'name_desc'>('most_absent');

  // Follow-up modal state
  const [scheduleModalItem, setScheduleModalItem] = useState<any | null>(null);
  const [followupDate, setFollowupDate] = useState<string>(() => {
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    return tmr.toISOString().split('T')[0];
  });
  const [followupTime, setFollowupTime] = useState<string>('10:00');
  const [followupNotes, setFollowupNotes] = useState<string>('');
  const [followupPriority, setFollowupPriority] = useState<'High' | 'Medium'>('High');
  const [savingFollowup, setSavingFollowup] = useState<boolean>(false);

  // Real-time Firestore Listeners
  useEffect(() => {
    setLoading(true);
    let unsubM: (() => void) | null = null;
    let unsubE: (() => void) | null = null;
    let unsubA: (() => void) | null = null;
    let unsubEA: (() => void) | null = null;

    try {
      // Active Members
      unsubM = onSnapshot(collection(db, 'members'), (snap) => {
        setMembers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLastUpdated(new Date().toLocaleTimeString());
        setIsConnected(true);
        setLoading(false);
      }, (err) => {
        console.error("Members snapshot error:", err);
        setIsConnected(false);
      });

      // Employees
      unsubE = onSnapshot(collection(db, 'employees'), (snap) => {
        setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLastUpdated(new Date().toLocaleTimeString());
      }, (err) => console.error("Employees snapshot error:", err));

      // Member Attendance
      unsubA = onSnapshot(collection(db, 'attendance'), (snap) => {
        setAttendance(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLastUpdated(new Date().toLocaleTimeString());
      }, (err) => console.error("Attendance snapshot error:", err));

      // Employee Attendance
      unsubEA = onSnapshot(collection(db, 'employeeAttendance'), (snap) => {
        setEmpAttendance(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLastUpdated(new Date().toLocaleTimeString());
      }, (err) => console.error("Emp Attendance snapshot error:", err));

    } catch (e) {
      console.error("Firestore listener setup error:", e);
      setIsConnected(false);
      setLoading(false);
    }

    return () => {
      if (unsubM) unsubM();
      if (unsubE) unsubE();
      if (unsubA) unsubA();
      if (unsubEA) unsubEA();
    };
  }, []);

  // Recalculate / Manual Refresh action
  const handleManualRefresh = async () => {
    setRefreshing(true);
    const refreshPromise = new Promise((resolve) => setTimeout(resolve, 600));
    toast.promise(refreshPromise, {
      loading: 'Refreshing attendance calculations...',
      success: 'Attendance dataset updated',
      error: 'Failed to refresh dataset',
    });
    try {
      await refreshPromise;
      setLastUpdated(new Date().toLocaleTimeString());
    } finally {
      setRefreshing(false);
    }
  };

  // Absence calculation engine for any member or employee entity
  const getEntityAbsenceMetrics = (entity: any, isEmployee: boolean) => {
    const logs = (isEmployee ? empAttendance : attendance).filter(a => {
      const pId = a.memberId || a.employeeId;
      const bId = a.biometricId;
      return (pId && (pId === entity.id || pId === entity.memberId || pId === entity.employeeId)) || 
             (bId && String(bId) === String(entity.biometricId));
    });

    const targetDateObj = new Date(asOfDate);
    targetDateObj.setHours(23, 59, 59, 999);

    const validLogs = logs.filter(l => {
      const d = new Date(l.checkIn || l.timestamp || l.date);
      return !isNaN(d.getTime()) && d <= targetDateObj;
    });

    // Check if entity has punches
    if (validLogs.length === 0) {
      // Calculate days absent based on joining date or creation date if present
      const joinStr = entity.joiningDate || entity.membershipStart || entity.createdAt;
      let daysFromJoin = 0;
      if (joinStr) {
        const joinDate = new Date(joinStr);
        if (!isNaN(joinDate.getTime()) && joinDate <= targetDateObj) {
          const diff = Math.floor((targetDateObj.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
          daysFromJoin = Math.max(0, diff);
        }
      }
      return {
        lastCheckedInText: 'No Check-ins Yet',
        lastCheckedInExact: null,
        daysAbsent: daysFromJoin,
        streak: 0,
        punchedOnAsOfDate: false,
        hasHistory: false
      };
    }

    // Find latest check-in punch timestamp
    const timestamps = validLogs.map(l => new Date(l.checkIn || l.timestamp || l.date).getTime());
    const latestTime = Math.max(...timestamps);
    const latestDate = new Date(latestTime);

    // Calculate days absent relative to asOfDate
    const asOfStart = new Date(asOfDate);
    asOfStart.setHours(0, 0, 0, 0);

    const latestStart = new Date(latestDate);
    latestStart.setHours(0, 0, 0, 0);

    const diffTime = asOfStart.getTime() - latestStart.getTime();
    const daysAbsent = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));

    const punchedOnAsOfDate = latestStart.toDateString() === asOfStart.toDateString();

    // Streak calculation
    const uniqueDateStrs = Array.from(new Set(validLogs.map(l => new Date(l.checkIn || l.timestamp || l.date).toDateString())))
      .map(d => new Date(d))
      .sort((a, b) => b.getTime() - a.getTime());

    let streak = 1;
    for (let i = 0; i < uniqueDateStrs.length - 1; i++) {
      const diff = (uniqueDateStrs[i].getTime() - uniqueDateStrs[i+1].getTime()) / (1000 * 60 * 60 * 24);
      if (diff <= 1.5) {
        streak++;
      } else {
        break;
      }
    }

    // Relative formatted date text
    let relativeText = '';
    if (daysAbsent === 0) relativeText = `Today (${latestDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    else if (daysAbsent === 1) relativeText = `Yesterday (${latestDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`;
    else relativeText = `${daysAbsent} days ago (${latestDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })})`;

    return {
      lastCheckedInText: relativeText,
      lastCheckedInExact: latestDate,
      daysAbsent,
      streak,
      punchedOnAsOfDate,
      hasHistory: true
    };
  };

  // Compile full candidate pool
  const candidatePool = useMemo(() => {
    const memberItems = members.map(m => {
      const status = (m.status || 'active').toLowerCase();
      const metrics = getEntityAbsenceMetrics(m, false);
      return {
        ...m,
        isEmployee: false,
        displayType: 'Member',
        memberStatus: status,
        trainerName: m.trainer || m.trainerName || 'Unassigned',
        branchName: m.branch || 'Mohali, Punjab',
        ...metrics
      };
    });

    const employeeItems = employees.map(e => {
      const status = (e.status || 'active').toLowerCase();
      const metrics = getEntityAbsenceMetrics(e, true);
      return {
        ...e,
        isEmployee: true,
        displayType: e.role || 'Staff',
        memberStatus: status,
        trainerName: 'Staff Employee',
        branchName: e.branch || 'Mohali, Punjab',
        ...metrics
      };
    });

    return [...memberItems, ...employeeItems];
  }, [members, employees, attendance, empAttendance, asOfDate]);

  // Filter out candidates meeting inconsistency rules (daysAbsent >= 2, non-frozen/leave, membership status compliant)
  const inconsistentPool = useMemo(() => {
    return candidatePool.filter(item => {
      // Respect membership status filter (Default: Active Only)
      if (membershipStatusFilter !== 'all') {
        if (membershipStatusFilter === 'active' && item.memberStatus !== 'active') return false;
        if (membershipStatusFilter === 'expired' && item.memberStatus !== 'expired') return false;
        if (membershipStatusFilter === 'frozen' && item.memberStatus !== 'frozen' && !item.onLeave) return false;
      }

      // Exclude members/staff on leave or explicitly frozen unless frozen filter selected
      if ((item.onLeave || item.frozen) && membershipStatusFilter !== 'frozen' && membershipStatusFilter !== 'all') {
        return false;
      }

      // New member protection: If member joined on/after asOfDate or within 1 day, don't flag if no history
      const joinStr = item.joiningDate || item.membershipStart || item.createdAt;
      if (joinStr && !item.hasHistory) {
        const joinDate = new Date(joinStr);
        const targetDate = new Date(asOfDate);
        const daysSinceJoin = Math.floor((targetDate.getTime() - joinDate.getTime()) / (1000 * 60 * 60 * 24));
        if (daysSinceJoin < 2) return false;
      }

      // Inconsistency threshold: Must be absent 2 or more consecutive days
      return item.daysAbsent >= 2;
    });
  }, [candidatePool, membershipStatusFilter, asOfDate]);

  // Apply active filters (Quick chips, duration dropdown, search, type, trainer, branch, sorting)
  const filteredRecords = useMemo(() => {
    return inconsistentPool.filter(item => {
      // 1. Search Query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const mName = item.name?.toLowerCase() || '';
        const mId = (item.memberId || item.employeeId || '').toLowerCase();
        const mPhone = item.phone || '';
        const mBio = String(item.biometricId || '');
        if (!mName.includes(q) && !mId.includes(q) && !mPhone.includes(q) && !mBio.includes(q)) {
          return false;
        }
      }

      // 2. Type Filter
      if (typeFilter === 'members' && item.isEmployee) return false;
      if (typeFilter === 'employees' && !item.isEmployee) return false;

      // 3. Quick Chips Filter
      if (chipFilter !== 'all') {
        if (chipFilter === '2-3' && (item.daysAbsent < 2 || item.daysAbsent > 3)) return false;
        if (chipFilter === '4-7' && (item.daysAbsent < 4 || item.daysAbsent > 7)) return false;
        if (chipFilter === '7+' && item.daysAbsent < 7) return false;
        if (chipFilter === '10+' && item.daysAbsent < 10) return false;
        if (chipFilter === '15+' && item.daysAbsent < 15) return false;
        if (chipFilter === '30+' && item.daysAbsent < 30) return false;
        if (chipFilter === '60+' && item.daysAbsent < 60) return false;
        if (chipFilter === '90+' && item.daysAbsent < 90) return false;
      }

      // 4. Absence Duration Dropdown / Custom Range
      if (durationFilter !== 'all') {
        if (durationFilter === '2-3' && (item.daysAbsent < 2 || item.daysAbsent > 3)) return false;
        if (durationFilter === '4-7' && (item.daysAbsent < 4 || item.daysAbsent > 7)) return false;
        if (durationFilter === '8-14' && (item.daysAbsent < 8 || item.daysAbsent > 14)) return false;
        if (durationFilter === '15-29' && (item.daysAbsent < 15 || item.daysAbsent > 29)) return false;
        if (durationFilter === '30+' && item.daysAbsent < 30) return false;
        if (durationFilter === 'custom') {
          if (item.daysAbsent < customMinDays || item.daysAbsent > customMaxDays) return false;
        }
      }

      // 5. Trainer Filter (Only applicable for members)
      if (trainerFilter !== 'all' && !item.isEmployee) {
        if (item.trainerName !== trainerFilter && item.trainerId !== trainerFilter) return false;
      }

      // 6. Branch Filter
      if (branchFilter !== 'all') {
        if (item.branchName !== branchFilter) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === 'most_absent') return b.daysAbsent - a.daysAbsent;
      if (sortBy === 'least_absent') return a.daysAbsent - b.daysAbsent;
      if (sortBy === 'recent_checkin') {
        const timeA = a.lastCheckedInExact ? a.lastCheckedInExact.getTime() : 0;
        const timeB = b.lastCheckedInExact ? b.lastCheckedInExact.getTime() : 0;
        return timeB - timeA;
      }
      if (sortBy === 'name_asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name_desc') return b.name.localeCompare(a.name);
      return 0;
    });
  }, [inconsistentPool, search, typeFilter, chipFilter, durationFilter, customMinDays, customMaxDays, trainerFilter, branchFilter, sortBy]);

  // KPI Breakdown metrics
  const totalInconsistent = inconsistentPool.length;
  const count2to3Days = inconsistentPool.filter(i => i.daysAbsent >= 2 && i.daysAbsent <= 3).length;
  const count4to7Days = inconsistentPool.filter(i => i.daysAbsent >= 4 && i.daysAbsent <= 7).length;
  const count8to14Days = inconsistentPool.filter(i => i.daysAbsent >= 8 && i.daysAbsent <= 14).length;
  const count15to29Days = inconsistentPool.filter(i => i.daysAbsent >= 15 && i.daysAbsent <= 29).length;
  const count30PlusDays = inconsistentPool.filter(i => i.daysAbsent >= 30).length;

  // Distinct Trainers & Branches lists
  const uniqueTrainers = useMemo(() => {
    const list = Array.from(new Set(members.map(m => m.trainer || m.trainerName).filter(Boolean)));
    return list;
  }, [members]);

  const uniqueBranches = useMemo(() => {
    const list = Array.from(new Set([...members.map(m => m.branch), ...employees.map(e => e.branch)].filter(Boolean)));
    return list.length > 0 ? list : ['Mohali, Punjab', 'Chandigarh'];
  }, [members, employees]);

  // Calculate Risk Level Badge
  const getRiskLevel = (days: number) => {
    if (days >= 30) return { label: 'DORMANT', bg: 'bg-slate-900 text-red-400 border-slate-800' };
    if (days >= 15) return { label: 'CRITICAL', bg: 'bg-red-50 text-red-700 border-red-200' };
    if (days >= 8) return { label: 'HIGH RISK', bg: 'bg-rose-50 text-rose-700 border-rose-200' };
    if (days >= 4) return { label: 'ATTENTION', bg: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: 'WATCH', bg: 'bg-yellow-50 text-yellow-800 border-yellow-200' };
  };

  // Handlers for quick actions
  const handleOpenMemberProfile = (item: any) => {
    if (item.isEmployee) {
      router.push('/dashboard/employees');
    } else {
      router.push(`/dashboard/members/${item.id}`);
    }
  };

  const handleOpenFollowupModal = (item: any) => {
    setScheduleModalItem(item);
    setFollowupNotes(`Absence Follow-up: ${item.name} has been absent for ${item.daysAbsent} days since ${item.lastCheckedInText}.`);
    setFollowupPriority(item.daysAbsent >= 8 ? 'High' : 'Medium');
  };

  const handleSaveFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleModalItem) return;
    setSavingFollowup(true);

    try {
      await addDoc(collection(db, 'followups'), {
        memberId: scheduleModalItem.id,
        memberName: scheduleModalItem.name,
        phone: scheduleModalItem.phone,
        trainer: scheduleModalItem.trainerName || '',
        type: scheduleModalItem.isEmployee ? 'Staff Retention' : 'Absentee Follow-up',
        dueDate: followupDate,
        dueTime: followupTime || '10:00',
        priority: followupPriority,
        status: 'Pending',
        notes: followupNotes,
        createdAt: new Date().toISOString(),
        category: 'Attendance Risk'
      });

      toast.success(`Follow-up scheduled for ${scheduleModalItem.name}!`);
      setScheduleModalItem(null);
    } catch (e: any) {
      toast.error('Failed to create follow-up task: ' + e.message);
    } finally {
      setSavingFollowup(false);
    }
  };

  const getWhatsAppLink = (item: any) => {
    const text = `Hi ${item.name}, we missed you at The Warrior Gym! We noticed you haven't checked in for ${item.daysAbsent} days since your last session (${item.lastCheckedInText}). Hope to see you back on the gym floor soon! 💪`;
    return `https://wa.me/91${item.phone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-6 pb-12 w-full text-slate-800 text-left font-display">
      
      {/* ══ Header Bar & Real-time Live Connection ════════════════════════════ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Attendance Risk Center</h1>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 ${
              isConnected 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{isConnected ? '● LIVE ATTENDANCE' : 'CONNECTION ISSUE'}</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time biometric & check-in tracker. Automatically identifies members and staff absent for multiple consecutive days.
          </p>
        </div>

        {/* Live Date Picker & Manual Refresh */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-2 shadow-sm text-xs font-bold text-slate-700">
            <Calendar size={14} className="text-[#EA580C]" />
            <span className="text-[10px] uppercase text-slate-400 font-black">As of:</span>
            <input 
              type="date"
              value={asOfDate}
              onChange={e => setAsOfDate(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-xs font-black text-slate-900 cursor-pointer"
            />
          </div>

          <button 
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="px-4 py-2.5 rounded-2xl bg-white hover:bg-slate-50 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-sm border border-slate-200 transition-all cursor-pointer disabled:opacity-50"
            title="Recalculate live attendance dataset"
          >
            <RefreshCw size={14} className={`text-[#EA580C] ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* ══ Live Summary KPI Cards ═════════════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {[
          { label: 'TOTAL INCONSISTENT', value: totalInconsistent, sub: '2+ Days Absent', color: 'border-slate-200 bg-white text-slate-900' },
          { label: '2–3 DAYS (WATCH)', value: count2to3Days, sub: 'Early Absence', color: 'border-yellow-200 bg-yellow-50/20 text-yellow-800' },
          { label: '4–7 DAYS (ATTENTION)', value: count4to7Days, sub: 'Medium Risk', color: 'border-amber-200 bg-amber-50/20 text-amber-800' },
          { label: '8–14 DAYS (HIGH RISK)', value: count8to14Days, sub: 'Retention Risk', color: 'border-rose-200 bg-rose-50/20 text-rose-800' },
          { label: '15–29 DAYS (CRITICAL)', value: count15to29Days, sub: 'Urgent Action', color: 'border-red-200 bg-red-50/20 text-red-800' },
          { label: '30+ DAYS (DORMANT)', value: count30PlusDays, sub: 'High Drop Risk', color: 'border-slate-800 bg-slate-900 text-red-400' },
        ].map((kpi, idx) => (
          <div key={idx} className={`border rounded-[22px] p-4 flex flex-col justify-between shadow-sm transition-all hover:shadow-md ${kpi.color}`}>
            <span className="text-[8.5px] font-black uppercase tracking-wider opacity-70 leading-none">{kpi.label}</span>
            <div className="text-2xl font-black mt-2 mb-1 font-mono tracking-tight">{kpi.value}</div>
            <span className="text-[9px] font-bold opacity-80">{kpi.sub}</span>
          </div>
        ))}
      </div>

      {/* ══ Quick Filter Chips ════════════════════════════════════════════════ */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs font-bold scrollbar-none">
        <span className="text-[10px] text-slate-400 uppercase tracking-widest font-black shrink-0 mr-1">Quick Chips:</span>
        {[
          { id: 'all', label: 'All Inconsistent' },
          { id: '2-3', label: '2–3 Days' },
          { id: '4-7', label: '4–7 Days' },
          { id: '7+', label: '7+ Days' },
          { id: '10+', label: '10+ Days' },
          { id: '15+', label: '15+ Days' },
          { id: '30+', label: '30+ Days' },
          { id: '60+', label: '60+ Days' },
          { id: '90+', label: '90+ Days' },
        ].map(chip => {
          const isActive = chipFilter === chip.id;
          return (
            <button
              key={chip.id}
              onClick={() => {
                setChipFilter(chip.id);
                if (chip.id !== 'all') setDurationFilter('all');
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider transition-all border cursor-pointer shrink-0 ${
                isActive 
                  ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-sm' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {chip.label}
            </button>
          );
        })}
      </div>

      {/* ══ Filter & Search Bar ═══════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200/80 rounded-[24px] p-4 space-y-3 shadow-sm">
        
        <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">
          
          {/* Search Box */}
          <div className="relative w-full lg:w-80">
            <Search size={15} className="absolute left-3.5 top-3 text-slate-400" />
            <input 
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search Name, Member ID, Phone, Biometric ID..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-[#EA580C] focus:bg-white transition-all text-slate-800 font-semibold"
            />
          </div>

          {/* Filter Dropdowns Grid */}
          <div className="flex flex-wrap gap-2.5 w-full lg:w-auto items-center">
            
            {/* Type Filter */}
            <select 
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-bold focus:outline-none focus:border-[#EA580C] cursor-pointer"
            >
              <option value="both">Both (Members & Staff)</option>
              <option value="members">Members Only</option>
              <option value="employees">Staff Only (Includes Trainers)</option>
            </select>

            {/* Membership Status Filter */}
            <select 
              value={membershipStatusFilter}
              onChange={e => setMembershipStatusFilter(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-bold focus:outline-none focus:border-[#EA580C] cursor-pointer"
            >
              <option value="active">Active Members Only</option>
              <option value="expired">Include Expired</option>
              <option value="frozen">Frozen Members</option>
              <option value="all">All Membership Statuses</option>
            </select>

            {/* Absence Duration Filter */}
            <select 
              value={durationFilter}
              onChange={e => {
                setDurationFilter(e.target.value);
                if (e.target.value !== 'all') setChipFilter('all');
              }}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-bold focus:outline-none focus:border-[#EA580C] cursor-pointer"
            >
              <option value="all">All Durations (2+ Days)</option>
              <option value="2-3">2–3 Days (Watch)</option>
              <option value="4-7">4–7 Days (Attention)</option>
              <option value="8-14">8–14 Days (High Risk)</option>
              <option value="15-29">15–29 Days (Critical)</option>
              <option value="30+">30+ Days (Dormant)</option>
              <option value="custom">Custom Days Range...</option>
            </select>

            {/* Trainer Filter */}
            <select 
              value={trainerFilter}
              onChange={e => setTrainerFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-bold focus:outline-none focus:border-[#EA580C] cursor-pointer"
            >
              <option value="all">All Trainers</option>
              {uniqueTrainers.map(t => <option key={t} value={t}>{t}</option>)}
            </select>

            {/* Branch Filter */}
            <select 
              value={branchFilter}
              onChange={e => setBranchFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-bold focus:outline-none focus:border-[#EA580C] cursor-pointer"
            >
              <option value="all">All Branches</option>
              {uniqueBranches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>

            {/* Sort Order */}
            <select 
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="text-xs bg-white border border-[#EA580C] text-[#EA580C] rounded-xl px-3 py-2 font-black focus:outline-none cursor-pointer"
            >
              <option value="most_absent">Sort: Most Absent First</option>
              <option value="least_absent">Sort: Least Absent</option>
              <option value="recent_checkin">Sort: Recent Check-in</option>
              <option value="name_asc">Sort: Name A-Z</option>
              <option value="name_desc">Sort: Name Z-A</option>
            </select>

          </div>

        </div>

        {/* Custom Days Range Inputs (if durationFilter === 'custom') */}
        {durationFilter === 'custom' && (
          <div className="flex items-center gap-3 bg-orange-50/60 border border-orange-200/60 p-3 rounded-xl text-xs font-bold text-slate-700">
            <span>Filter Custom Range:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase text-slate-500">Min Days:</span>
              <input 
                type="number"
                value={customMinDays}
                onChange={e => setCustomMinDays(Number(e.target.value))}
                className="w-16 p-1.5 bg-white border border-slate-200 rounded-lg text-xs text-center font-bold"
                min={0}
              />
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] uppercase text-slate-500">Max Days:</span>
              <input 
                type="number"
                value={customMaxDays}
                onChange={e => setCustomMaxDays(Number(e.target.value))}
                className="w-16 p-1.5 bg-white border border-slate-200 rounded-lg text-xs text-center font-bold"
                min={0}
              />
            </div>
          </div>
        )}

      </div>

      {/* ══ Live Inconsistency Table / Card Roster ═══════════════════════════ */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-100 shadow-sm">
          <div className="w-8 h-8 border-2 border-[#EA580C] border-t-transparent rounded-full animate-spin mb-3" />
          <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Evaluating Biometric Check-ins...</span>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-[28px] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50/90 text-slate-400 font-black uppercase tracking-wider text-[9px] border-b border-slate-150">
                <tr>
                  <th className="px-5 py-4 w-12 text-center">Type</th>
                  <th className="px-5 py-4">Name / ID</th>
                  <th className="px-5 py-4">Last Checked-In</th>
                  <th className="px-5 py-4 text-center">Days Absent</th>
                  <th className="px-5 py-4 text-center">Active Streak</th>
                  <th className="px-5 py-4">Biometric ID</th>
                  <th className="px-5 py-4">Trainer / Branch</th>
                  <th className="px-5 py-4 text-center">Risk Level</th>
                  <th className="px-5 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {filteredRecords.map(item => {
                  const risk = getRiskLevel(item.daysAbsent);
                  const avatarColor = getInitials(item.name);
                  
                  return (
                    <tr key={item.id} className="hover:bg-orange-50/30 transition-colors">
                      
                      {/* TYPE */}
                      <td className="px-5 py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${
                          item.isEmployee 
                            ? 'bg-purple-50 text-purple-700 border-purple-200' 
                            : 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]'
                        }`}>
                          {item.displayType}
                        </span>
                      </td>

                      {/* NAME / ID */}
                      <td className="px-5 py-3.5">
                        <div className="flex gap-3 items-center">
                          <div className="w-9 h-9 rounded-2xl bg-[#EA580C] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                            {avatarColor}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900 hover:text-[#EA580C] cursor-pointer" onClick={() => handleOpenMemberProfile(item)}>
                              {item.name}
                            </div>
                            <div className="text-[9px] text-slate-400 font-mono flex items-center gap-2 mt-0.5">
                              <span>ID: {item.memberId || item.employeeId || '—'}</span>
                              <span>•</span>
                              <span>{item.phone}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* LAST CHECKED-IN */}
                      <td className="px-5 py-3.5 text-slate-700">
                        <div className="flex items-center gap-1.5" title={item.lastCheckedInExact ? item.lastCheckedInExact.toLocaleString() : 'No recorded punches'}>
                          <Clock size={12} className="text-slate-400 shrink-0" />
                          <span className="font-bold text-slate-800">{item.lastCheckedInText}</span>
                        </div>
                      </td>

                      {/* DAYS ABSENT */}
                      <td className="px-5 py-3.5 text-center">
                        <span className={`px-3 py-1 rounded-xl text-xs font-black font-mono border inline-block ${
                          item.daysAbsent >= 30 ? 'bg-slate-900 text-red-400 border-slate-800' :
                          item.daysAbsent >= 15 ? 'bg-red-50 text-red-700 border-red-200' :
                          item.daysAbsent >= 8 ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {item.daysAbsent} DAYS ABSENT
                        </span>
                      </td>

                      {/* STREAK */}
                      <td className="px-5 py-3.5 text-center">
                        <span className="text-xs font-black font-mono text-slate-700 flex items-center justify-center gap-1">
                          <Flame size={13} className="text-amber-500" />
                          {item.streak} d
                        </span>
                      </td>

                      {/* BIOMETRIC ID */}
                      <td className="px-5 py-3.5 font-mono text-slate-600 font-bold text-xs">
                        {item.biometricId ? `#${item.biometricId}` : '—'}
                      </td>

                      {/* TRAINER / BRANCH */}
                      <td className="px-5 py-3.5 text-xs text-slate-600 font-medium">
                        <div className="font-bold text-slate-800">{item.trainerName}</div>
                        <div className="text-[9px] text-slate-400">{item.branchName}</div>
                      </td>

                      {/* RISK LEVEL */}
                      <td className="px-5 py-3.5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider border ${risk.bg}`}>
                          {risk.label}
                        </span>
                      </td>

                      {/* ACTIONS */}
                      <td className="px-5 py-3.5 text-right">
                        <div className="flex justify-end gap-1.5 items-center">
                          
                          {/* View Profile */}
                          <button 
                            onClick={() => handleOpenMemberProfile(item)}
                            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer border-none transition-all flex items-center gap-1"
                            title="View Profile"
                          >
                            <Eye size={11} /> Profile
                          </button>

                          {/* Schedule Follow-up */}
                          <button 
                            onClick={() => handleOpenFollowupModal(item)}
                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer border-none transition-all flex items-center gap-1 ${
                              item.daysAbsent >= 8 
                                ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200' 
                                : 'bg-[#FFF7ED] text-[#EA580C] hover:bg-orange-100 border border-[#FED7AA]'
                            }`}
                            title="Schedule Follow-up Task"
                          >
                            <Bell size={11} /> Follow-up
                          </button>

                          {/* Call */}
                          <a
                            href={`tel:${item.phone}`}
                            className="w-7 h-7 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl flex items-center justify-center cursor-pointer transition-all"
                            title={`Call ${item.phone}`}
                          >
                            <Phone size={12} />
                          </a>

                          {/* WhatsApp */}
                          <a 
                            href={getWhatsAppLink(item)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-7 h-7 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 border border-emerald-200 rounded-xl flex items-center justify-center cursor-pointer transition-all"
                            title="Send WhatsApp Nudge"
                          >
                            <MessageSquare size={12} />
                          </a>

                        </div>
                      </td>

                    </tr>
                  );
                })}

                {filteredRecords.length === 0 && (
                  <tr>
                    <td colSpan={9} className="text-center py-16 bg-white">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                          <CheckCircle2 size={24} />
                        </div>
                        <h4 className="text-sm font-black text-slate-900">✓ Everyone is on track</h4>
                        <p className="text-xs text-slate-400 font-medium max-w-sm">
                          No members or staff match the current attendance-risk filters.
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ══ SCHEDULE FOLLOW-UP MODAL ══════════════════════════════════════════ */}
      <AnimatePresence>
        {scheduleModalItem && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl space-y-4 text-left"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-slate-900 uppercase">Schedule Risk Follow-up</h3>
                    {scheduleModalItem.daysAbsent >= 30 ? (
                      <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[9px] font-black uppercase rounded-md">
                        Critical — Immediate Follow-up
                      </span>
                    ) : scheduleModalItem.daysAbsent >= 8 ? (
                      <span className="px-2 py-0.5 bg-rose-100 text-rose-700 text-[9px] font-black uppercase rounded-md">
                        High Risk Follow-up
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                    Assign an action item for {scheduleModalItem.name} ({scheduleModalItem.daysAbsent} Days Absent)
                  </p>
                </div>
                <button onClick={() => setScheduleModalItem(null)} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveFollowup} className="space-y-3.5 text-xs font-semibold">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Follow-up Date *</label>
                  <input 
                    type="date"
                    value={followupDate}
                    onChange={e => setFollowupDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#EA580C]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Follow-up Time *</label>
                  <input 
                    type="time"
                    value={followupTime}
                    onChange={e => setFollowupTime(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#EA580C]"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Priority</label>
                  <select
                    value={followupPriority}
                    onChange={e => setFollowupPriority(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#EA580C] cursor-pointer"
                  >
                    <option value="High">High Priority</option>
                    <option value="Medium">Medium Priority</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Follow-up Instructions / Notes</label>
                  <textarea
                    rows={3}
                    value={followupNotes}
                    onChange={e => setFollowupNotes(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-[#EA580C] resize-none"
                  />
                </div>

                <div className="flex gap-3 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setScheduleModalItem(null)}
                    className="flex-1 py-2.5 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors uppercase tracking-wider text-[10px] font-black cursor-pointer bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingFollowup}
                    className="flex-1 py-2.5 bg-[#EA580C] hover:bg-orange-700 text-white rounded-xl transition-all uppercase tracking-wider text-[10px] font-black cursor-pointer border-none shadow-md"
                  >
                    {savingFollowup ? 'Saving Task...' : 'Schedule Task'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
