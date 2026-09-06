'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Fingerprint, QrCode, Scan, Activity, Wifi, WifiOff, RefreshCw, Download, Search, Check, AlertCircle,
  Users, Calendar, Clock, Server, CheckCircle, Flame, ShieldAlert, Sparkles, Filter, ChevronRight,
  ArrowUpRight, UserCheck, UserX, X, Plus, User, Building, MapPin, Eye, LogOut, CheckCircle2
} from 'lucide-react';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid
} from 'recharts';
import { db } from '@/lib/firebase';
import { 
  collection, onSnapshot, addDoc, doc, updateDoc, query, orderBy, limit, Timestamp, where 
} from 'firebase/firestore';
import { useGymStore, useDeviceStore } from '@/store';
import { getInitials } from '@/lib/utils';
import toast from '@/lib/toast';
import API from '@/services/api';

// Access Method Icons & Config
const methodConfig: Record<string, { icon: any; color: string; label: string }> = {
  fingerprint: { icon: Fingerprint, color: '#EA580C', label: 'Fingerprint' },
  biometric: { icon: Fingerprint, color: '#EA580C', label: 'Fingerprint' },
  face: { icon: Scan, color: '#7C3AED', label: 'Face ID' },
  card: { icon: Activity, color: '#F59E0B', label: 'RFID Card' },
  rfid: { icon: Activity, color: '#F59E0B', label: 'RFID Card' },
  manual: { icon: UserCheck, color: '#10B981', label: 'Manual' },
  receptionDesk: { icon: UserCheck, color: '#10B981', label: 'Manual' }
};

export default function BiometricAttendancePage() {
  const { isDeviceFullyOnline, lastHeartbeat } = useDeviceStore();

  // Core Data States
  const [members, setMembers] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [lastSyncTime, setLastSyncTime] = useState<string>('');

  // Live Session Start Filter Config
  // Default: Start of today (YYYY-MM-DD 00:00:00)
  const [liveSessionStartDate, setLiveSessionStartDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [showHistorical, setShowHistorical] = useState(false);

  // Search & Filter States
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'members' | 'staff'>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'inside' | 'completed'>('all');
  const [dateFilter, setDateFilter] = useState<'today' | 'yesterday' | '7days' | '30days' | 'all'>('today');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [analyticsDays, setAnalyticsDays] = useState<7 | 14 | 30>(7);

  // Manual Check-in Form
  const [manualSearch, setManualSearch] = useState('');
  const [selectedPersonForCheckin, setSelectedPersonForCheckin] = useState<any | null>(null);
  const [submittingCheckin, setSubmittingCheckin] = useState(false);

  // Real-time Firestore Listeners
  useEffect(() => {
    setLoading(true);
    let unsubM: (() => void) | null = null;
    let unsubE: (() => void) | null = null;
    let unsubA: (() => void) | null = null;

    try {
      // 1. Members
      unsubM = onSnapshot(collection(db, 'members'), (snap) => {
        setMembers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => console.error('Members listener error:', err));

      // 2. Employees (Staff / Trainers)
      unsubE = onSnapshot(collection(db, 'employees'), (snap) => {
        setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (err) => console.error('Employees listener error:', err));

      // 3. Live Attendance Collection
      const attendanceRef = collection(db, 'attendance');
      unsubA = onSnapshot(attendanceRef, (snap) => {
        const rawDocs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setAttendanceLogs(rawDocs);
        setIsConnected(true);
        setLastSyncTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata' }));
        setLoading(false);
      }, (err) => {
        console.error('Attendance snapshot error:', err);
        setIsConnected(false);
        setLoading(false);
      });

    } catch (err) {
      console.error('Firestore initialization error:', err);
      setIsConnected(false);
      setLoading(false);
    }

    return () => {
      if (unsubM) unsubM();
      if (unsubE) unsubE();
      if (unsubA) unsubA();
    };
  }, []);

  // Formatters with exact IST seconds
  const formatExactTime = (val: any) => {
    if (!val) return '—';
    let d: Date;
    if (typeof val === 'string') d = new Date(val);
    else if (val.seconds) d = new Date(val.seconds * 1000);
    else if (typeof val.toDate === 'function') d = val.toDate();
    else d = new Date(val);

    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
  };

  const formatExactDate = (val: any) => {
    if (!val) return '—';
    let d: Date;
    if (typeof val === 'string') d = new Date(val);
    else if (val.seconds) d = new Date(val.seconds * 1000);
    else if (typeof val.toDate === 'function') d = val.toDate();
    else d = new Date(val);

    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'Asia/Kolkata'
    });
  };

  // Helper to parse date string for filtering
  const getLogDateObj = (log: any): Date | null => {
    const checkIn = log.checkIn || log.timestamp || log.createdAt || log.date;
    if (!checkIn) return null;
    let d: Date;
    if (typeof checkIn === 'string') d = new Date(checkIn);
    else if (checkIn.seconds) d = new Date(checkIn.seconds * 1000);
    else if (typeof checkIn.toDate === 'function') d = checkIn.toDate();
    else d = new Date(checkIn);

    return isNaN(d.getTime()) ? null : d;
  };

  // ══ Deduplication & Processing Engine ══════════════════════════════════════
  // Groups punches within 60-second window to prevent duplicate biometric writes
  const processedLogs = useMemo(() => {
    if (!attendanceLogs.length) return [];

    // Filter by live session start timestamp if not showing full historical
    const liveStartObj = new Date(liveSessionStartDate + 'T00:00:00.000Z');

    const validRaw = attendanceLogs.filter(log => {
      const d = getLogDateObj(log);
      if (!d) return false;
      if (!showHistorical && d < liveStartObj) return false;
      return true;
    });

    // Sort by check-in time descending (newest first)
    validRaw.sort((a, b) => {
      const dA = getLogDateObj(a)?.getTime() || 0;
      const dB = getLogDateObj(b)?.getTime() || 0;
      return dB - dA;
    });

    // Deduplicate punches within a 60-second window for the same person
    const deduplicated: any[] = [];
    const seenWindowMap = new Map<string, number>(); // key -> timestamp

    for (const log of validRaw) {
      const pId = log.memberId || log.employeeId || log.biometricId || log.memberName;
      const logDate = getLogDateObj(log);
      if (!logDate || !pId) continue;

      const logTime = logDate.getTime();
      const lastSeenTime = seenWindowMap.get(String(pId));

      if (lastSeenTime && Math.abs(lastSeenTime - logTime) < 60_000) {
        // Skip duplicate punch within 60 seconds window
        continue;
      }

      seenWindowMap.set(String(pId), logTime);

      // Resolve person identity (Member vs Staff)
      let matchedMember = members.find(m => m.id === log.memberId || m.memberId === log.memberId || String(m.biometricId) === String(log.biometricId));
      let matchedEmp = employees.find(e => e.id === log.employeeId || e.employeeId === log.employeeId || String(e.biometricId) === String(log.biometricId));

      const isStaff = !!matchedEmp || log.isEmployee || log.type === 'Staff' || (log.role && log.role !== 'member');
      const resolvedName = log.memberName || log.name || matchedMember?.name || matchedEmp?.name || `Biometric #${log.biometricId || 'User'}`;
      const resolvedId = log.memberId || log.employeeId || matchedMember?.memberId || matchedEmp?.employeeId || (log.biometricId ? `#${log.biometricId}` : '—');
      const resolvedPhone = log.phone || matchedMember?.phone || matchedEmp?.phone || '—';
      const resolvedBranch = log.branch || matchedMember?.branch || matchedEmp?.branch || 'Main Branch';
      const resolvedMethod = (log.method || log.accessMethod || 'biometric').toLowerCase();
      const resolvedType = isStaff ? (matchedEmp?.role || 'Staff') : 'Member';

      deduplicated.push({
        ...log,
        dateObj: logDate,
        formattedTime: formatExactTime(logDate),
        formattedDate: formatExactDate(logDate),
        personName: resolvedName,
        personId: resolvedId,
        personPhone: resolvedPhone,
        branchName: resolvedBranch,
        methodClean: resolvedMethod,
        personType: resolvedType,
        isStaff,
        statusClean: log.checkOut ? 'Completed' : 'Inside Facility'
      });
    }

    return deduplicated;
  }, [attendanceLogs, members, employees, liveSessionStartDate, showHistorical]);

  // ══ Active Filter Application ═════════════════════════════════════════════
  const filteredLogs = useMemo(() => {
    return processedLogs.filter(item => {
      // 1. Search Query
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const n = item.personName.toLowerCase();
        const id = String(item.personId).toLowerCase();
        const p = item.personPhone.toLowerCase();
        const bio = String(item.biometricId || '').toLowerCase();
        if (!n.includes(q) && !id.includes(q) && !p.includes(q) && !bio.includes(q)) return false;
      }

      // 2. Type Filter
      if (typeFilter === 'members' && item.isStaff) return false;
      if (typeFilter === 'staff' && !item.isStaff) return false;

      // 3. Access Method Filter
      if (methodFilter !== 'all') {
        if (item.methodClean !== methodFilter && !item.methodClean.includes(methodFilter)) return false;
      }

      // 4. Status Filter
      if (statusFilter === 'inside' && item.checkOut) return false;
      if (statusFilter === 'completed' && !item.checkOut) return false;

      // 5. Date Range Filter
      if (dateFilter !== 'all') {
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const itemTime = item.dateObj.getTime();

        if (dateFilter === 'today') {
          if (itemTime < todayStart) return false;
        } else if (dateFilter === 'yesterday') {
          const yestStart = todayStart - 86400000;
          if (itemTime < yestStart || itemTime >= todayStart) return false;
        } else if (dateFilter === '7days') {
          if (itemTime < todayStart - 7 * 86400000) return false;
        } else if (dateFilter === '30days') {
          if (itemTime < todayStart - 30 * 86400000) return false;
        }
      }

      // 6. Location Filter
      if (locationFilter !== 'all' && item.branchName !== locationFilter) return false;

      return true;
    });
  }, [processedLogs, search, typeFilter, methodFilter, statusFilter, dateFilter, locationFilter]);

  // ══ Real-Time Metrics Calculations ════════════════════════════════════════
  const todayStr = useMemo(() => new Date().toISOString().split('T')[0], []);

  // Today's deduplicated logs
  const todayLogs = useMemo(() => {
    return processedLogs.filter(log => {
      const dStr = log.dateObj.toISOString().split('T')[0];
      return dStr === todayStr;
    });
  }, [processedLogs, todayStr]);

  // Today's Unique Present Persons Count
  const uniquePresentTodayCount = useMemo(() => {
    const set = new Set<string>();
    todayLogs.forEach(l => {
      const key = l.memberId || l.employeeId || l.biometricId || l.personName;
      if (key) set.add(String(key));
    });
    return set.size;
  }, [todayLogs]);

  // Members vs Staff Count Today
  const membersTodayCount = useMemo(() => {
    const set = new Set<string>();
    todayLogs.filter(l => !l.isStaff).forEach(l => set.add(String(l.memberId || l.biometricId || l.personName)));
    return set.size;
  }, [todayLogs]);

  const staffTodayCount = useMemo(() => {
    const set = new Set<string>();
    todayLogs.filter(l => l.isStaff).forEach(l => set.add(String(l.employeeId || l.biometricId || l.personName)));
    return set.size;
  }, [todayLogs]);

  // Total Valid Check-in Events Today
  const totalCheckinsTodayCount = todayLogs.length;

  // Currently Inside Facility Count (Checked in today and checkOut is null)
  const currentlyInsideLogs = useMemo(() => {
    // Map latest status per person for today
    const personLatestMap = new Map<string, any>();
    for (const log of todayLogs) {
      const key = log.memberId || log.employeeId || log.biometricId || log.personName;
      if (!personLatestMap.has(key)) {
        personLatestMap.set(key, log);
      }
    }

    const inside: any[] = [];
    personLatestMap.forEach(log => {
      if (!log.checkOut) inside.push(log);
    });
    return inside;
  }, [todayLogs]);

  const currentlyInsideCount = currentlyInsideLogs.length;

  // Last Check-In Record
  const lastCheckinItem = processedLogs.length > 0 ? processedLogs[0] : null;

  // Average Daily Attendance Over Past 7 Days
  const avgDailyAttendance = useMemo(() => {
    if (!processedLogs.length) return 0;
    const dayMap = new Map<string, Set<string>>();

    processedLogs.forEach(log => {
      const dayKey = log.dateObj.toISOString().split('T')[0];
      const personKey = log.memberId || log.employeeId || log.biometricId || log.personName;
      if (!dayMap.has(dayKey)) dayMap.set(dayKey, new Set());
      dayMap.get(dayKey)!.add(personKey);
    });

    if (dayMap.size === 0) return 0;
    let totalUniqueSum = 0;
    dayMap.forEach(set => totalUniqueSum += set.size);
    return Math.round((totalUniqueSum / dayMap.size) * 10) / 10;
  }, [processedLogs]);

  // Peak Hour Calculation
  const peakHourInfo = useMemo(() => {
    if (!todayLogs.length) return { label: 'None', count: 0 };
    const hourlyCounts: Record<number, number> = {};

    todayLogs.forEach(log => {
      const hr = log.dateObj.getHours();
      hourlyCounts[hr] = (hourlyCounts[hr] || 0) + 1;
    });

    let maxHr = -1;
    let maxCount = 0;
    Object.entries(hourlyCounts).forEach(([hrStr, count]) => {
      const hr = Number(hrStr);
      if (count > maxCount) {
        maxCount = count;
        maxHr = hr;
      }
    });

    if (maxHr === -1) return { label: 'None', count: 0 };
    const formatHr = (h: number) => {
      const period = h >= 12 ? 'PM' : 'AM';
      const displayH = h % 12 === 0 ? 12 : h % 12;
      return `${String(displayH).padStart(2, '0')}:00 ${period}`;
    };

    const startLabel = formatHr(maxHr);
    const endLabel = formatHr((maxHr + 1) % 24);
    return { label: `${startLabel} – ${endLabel}`, count: maxCount };
  }, [todayLogs]);

  // Hourly Flow Chart Data (Today's 06 AM - 10 PM)
  const hourlyFlowData = useMemo(() => {
    const hours = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22];
    return hours.map(hr => {
      const formatLabel = hr >= 12 ? `${hr % 12 === 0 ? 12 : hr % 12} PM` : `${hr} AM`;
      const count = todayLogs.filter(log => log.dateObj.getHours() === hr).length;
      return { hour: formatLabel, checkIns: count };
    });
  }, [todayLogs]);

  // Analytics Days Breakdown Data (7, 14, 30 days)
  const analyticsTrendData = useMemo(() => {
    const result: any[] = [];
    const now = new Date();

    for (let i = analyticsDays - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().split('T')[0];
      const displayDate = d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });

      const dayLogs = processedLogs.filter(log => log.dateObj.toISOString().split('T')[0] === dayStr);
      
      const memberSet = new Set<string>();
      const staffSet = new Set<string>();

      dayLogs.forEach(l => {
        const key = l.memberId || l.employeeId || l.biometricId || l.personName;
        if (l.isStaff) staffSet.add(key);
        else memberSet.add(key);
      });

      result.push({
        date: displayDate,
        fullDate: dayStr,
        members: memberSet.size,
        staff: staffSet.size,
        total: dayLogs.length
      });
    }

    return result;
  }, [processedLogs, analyticsDays]);

  // Distinct Locations / Branches
  const uniqueLocations = useMemo(() => {
    const set = new Set<string>(['Mohali, Punjab', 'Chandigarh']);
    attendanceLogs.forEach(l => { if (l.branch) set.add(l.branch); });
    return Array.from(set);
  }, [attendanceLogs]);

  // ══ Manual Check-in Handler ═══════════════════════════════════════════════
  const candidatePool = useMemo(() => {
    const mPool = members.map(m => ({ ...m, isStaff: false, typeLabel: 'Member', idVal: m.memberId || m.id }));
    const ePool = employees.map(e => ({ ...e, isStaff: true, typeLabel: e.role || 'Staff', idVal: e.employeeId || e.id }));
    return [...mPool, ...ePool];
  }, [members, employees]);

  const searchCandidates = useMemo(() => {
    if (!manualSearch.trim()) return [];
    const q = manualSearch.toLowerCase().trim();
    return candidatePool.filter(c => 
      c.name?.toLowerCase().includes(q) || 
      String(c.idVal).toLowerCase().includes(q) || 
      c.phone?.includes(q) || 
      String(c.biometricId || '').includes(q)
    ).slice(0, 5);
  }, [candidatePool, manualSearch]);

  const handleExecuteManualCheckin = async () => {
    if (!selectedPersonForCheckin) return;
    setSubmittingCheckin(true);

    try {
      const nowIso = new Date().toISOString();
      const isEmp = selectedPersonForCheckin.isStaff;

      const payload = {
        memberId: isEmp ? undefined : selectedPersonForCheckin.id,
        employeeId: isEmp ? selectedPersonForCheckin.id : undefined,
        memberName: selectedPersonForCheckin.name,
        phone: selectedPersonForCheckin.phone || '',
        biometricId: selectedPersonForCheckin.biometricId || '',
        checkIn: nowIso,
        checkOut: null,
        method: 'manual',
        branch: selectedPersonForCheckin.branch || 'Mohali, Punjab',
        status: 'granted',
        type: isEmp ? 'Staff' : 'Member',
        createdAt: nowIso
      };

      await addDoc(collection(db, 'attendance'), payload);
      
      toast.success(`✓ Manual Check-in recorded for ${selectedPersonForCheckin.name}`);
      setSelectedPersonForCheckin(null);
      setManualSearch('');
    } catch (err: any) {
      toast.error('Manual check-in failed: ' + err.message);
    } finally {
      setSubmittingCheckin(false);
    }
  };

  const handleCheckoutLog = async (logId: string, personName: string) => {
    try {
      const nowIso = new Date().toISOString();
      await updateDoc(doc(db, 'attendance', logId), {
        checkOut: nowIso,
        status: 'completed'
      });
      toast.success(`✓ ${personName} checked out of facility`);
    } catch (err: any) {
      toast.error('Failed to log checkout: ' + err.message);
    }
  };

  // ══ Export CSV Handler ═════════════════════════════════════════════════════
  const handleExportCSV = () => {
    if (!filteredLogs.length) {
      toast.error('No attendance records to export under current filters.');
      return;
    }

    const headers = ['Date', 'Exact Time', 'Name', 'ID', 'Phone', 'Type', 'Biometric ID', 'Access Method', 'Location', 'Check-In', 'Check-Out', 'Status'];
    const rows = filteredLogs.map(l => [
      l.formattedDate,
      l.formattedTime,
      `"${l.personName}"`,
      `"${l.personId}"`,
      `"${l.personPhone}"`,
      `"${l.personType}"`,
      `"${l.biometricId || '—'}"`,
      `"${l.methodClean}"`,
      `"${l.branchName}"`,
      `"${l.formattedTime}"`,
      `"${l.checkOut ? formatExactTime(l.checkOut) : '—'}"`,
      `"${l.statusClean}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `real_attendance_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success(`Exported ${filteredLogs.length} real attendance logs!`);
  };

  return (
    <div className="space-y-6 pb-12 w-full text-slate-800 font-display text-left">
      
      {/* ══ Header Bar & Real-time Live Connection ════════════════════════════ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">Biometric Attendance</h1>
            <div className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 ${
              isConnected 
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                : 'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
              <span>{isConnected ? '● LIVE ATTENDANCE STREAM' : 'RECONNECTING...'}</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Real-time biometric turnstile feed, gate access control & daily analytics. Pure live stream.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          
          {/* Session Start Date Picker */}
          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-2xl px-3 py-1.5 shadow-sm text-xs font-bold text-slate-700">
            <Calendar size={13} className="text-[#EA580C]" />
            <span className="text-[9.5px] uppercase text-slate-400 font-black">Live Start:</span>
            <input 
              type="date"
              value={liveSessionStartDate}
              onChange={e => setLiveSessionStartDate(e.target.value)}
              className="bg-transparent border-none focus:outline-none text-xs font-black text-slate-900 cursor-pointer"
            />
          </div>

          {/* Historical Records Toggle */}
          <button
            onClick={() => setShowHistorical(!showHistorical)}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
              showHistorical 
                ? 'bg-[#FFF7ED] border-[#FDBA74] text-[#EA580C]' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {showHistorical ? 'Showing All Records' : 'Live Session Only'}
          </button>

          {/* Export CSV */}
          <button 
            onClick={handleExportCSV}
            className="px-4 py-2 rounded-2xl bg-[#EA580C] hover:bg-orange-700 text-white font-black text-xs flex items-center gap-2 shadow-sm transition-all cursor-pointer border-none"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* ══ Live Hardware Device Status Card ══════════════════════════════════ */}
      <div className="bg-white border border-slate-200/80 rounded-[22px] p-3.5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3" style={{ borderLeft: '4px solid #EA580C' }}>
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center text-[#EA580C] shrink-0">
            <Fingerprint size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm text-slate-900">Main Gate · Hikvision DS-K1T320EFWX</span>
              <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider border ${
                isDeviceFullyOnline ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
              }`}>
                {isDeviceFullyOnline ? '● DEVICE ONLINE' : '● DEVICE OFFLINE'}
              </span>
            </div>
            <p className="text-[10.5px] text-slate-500 font-medium mt-0.5">
              IP: <span className="font-mono font-bold text-slate-700">192.168.1.45:443</span> · Branch: <span className="font-bold text-slate-700">Mohali, Punjab</span> · Gate Relay Active
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-bold text-slate-600 border-t md:border-t-0 border-slate-100 pt-2 md:pt-0">
          <div className="text-right">
            <div className="text-[9px] uppercase tracking-wider text-slate-400 font-black">Last Sync Time</div>
            <div className="font-mono text-slate-900 font-extrabold text-xs">{lastSyncTime || 'Just now'}</div>
          </div>
        </div>
      </div>

      {/* ══ Summary KPI Metrics Cards Row ═════════════════════════════════════ */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* TODAY'S ATTENDANCE */}
        <div className="bg-white border border-slate-200/80 rounded-[22px] p-4 flex flex-col justify-between shadow-sm">
          <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">TODAY'S ATTENDANCE</span>
          <div className="text-2xl font-black mt-1.5 mb-0.5 font-mono text-slate-900 tracking-tight">{uniquePresentTodayCount}</div>
          <span className="text-[9px] font-bold text-slate-500">Unique People Today</span>
        </div>

        {/* UNIQUE PRESENT TODAY */}
        <div className="bg-white border border-slate-200/80 rounded-[22px] p-4 flex flex-col justify-between shadow-sm">
          <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">UNIQUE PRESENT</span>
          <div className="text-2xl font-black mt-1.5 mb-0.5 font-mono text-[#EA580C] tracking-tight">{uniquePresentTodayCount}</div>
          <span className="text-[9px] font-bold text-slate-500">
            {membersTodayCount} Members · {staffTodayCount} Staff
          </span>
        </div>

        {/* CHECK-INS TODAY */}
        <div className="bg-white border border-slate-200/80 rounded-[22px] p-4 flex flex-col justify-between shadow-sm">
          <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">CHECK-INS TODAY</span>
          <div className="text-2xl font-black mt-1.5 mb-0.5 font-mono text-emerald-600 tracking-tight">{totalCheckinsTodayCount}</div>
          <span className="text-[9px] font-bold text-slate-500">Valid Punches</span>
        </div>

        {/* CURRENTLY INSIDE */}
        <div className="bg-white border border-slate-200/80 rounded-[22px] p-4 flex flex-col justify-between shadow-sm">
          <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">CURRENTLY INSIDE</span>
          <div className="text-2xl font-black mt-1.5 mb-0.5 font-mono text-purple-600 tracking-tight">{currentlyInsideCount}</div>
          <span className="text-[9px] font-bold text-slate-500">Inside Facility Now</span>
        </div>

        {/* LAST CHECK-IN */}
        <div className="bg-white border border-slate-200/80 rounded-[22px] p-4 flex flex-col justify-between shadow-sm">
          <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">LAST CHECK-IN</span>
          <div className="truncate font-extrabold text-xs text-slate-900 mt-1.5">
            {lastCheckinItem ? lastCheckinItem.personName : 'No attendance yet'}
          </div>
          <span className="text-[9px] font-bold font-mono text-[#EA580C]">
            {lastCheckinItem ? `${lastCheckinItem.formattedTime}` : '—'}
          </span>
        </div>

        {/* AVERAGE DAILY ATTENDANCE */}
        <div className="bg-white border border-slate-200/80 rounded-[22px] p-4 flex flex-col justify-between shadow-sm">
          <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400">DAILY AVERAGE</span>
          <div className="text-2xl font-black mt-1.5 mb-0.5 font-mono text-amber-600 tracking-tight">{avgDailyAttendance}</div>
          <span className="text-[9px] font-bold text-slate-500">People / Day</span>
        </div>

      </div>

      {/* ══ Filter & Search Controls Row ══════════════════════════════════════ */}
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
            
            {/* Date Range Filter */}
            <select
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-bold focus:outline-none focus:border-[#EA580C] cursor-pointer"
            >
              <option value="today">Today Only</option>
              <option value="yesterday">Yesterday</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="all">All Dates</option>
            </select>

            {/* Type Filter */}
            <select 
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-bold focus:outline-none focus:border-[#EA580C] cursor-pointer"
            >
              <option value="all">All (Members & Staff)</option>
              <option value="members">Members Only</option>
              <option value="staff">Staff Only (Trainers, Reception)</option>
            </select>

            {/* Access Method Filter */}
            <select
              value={methodFilter}
              onChange={e => setMethodFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-bold focus:outline-none focus:border-[#EA580C] cursor-pointer"
            >
              <option value="all">All Access Methods</option>
              <option value="fingerprint">Fingerprint</option>
              <option value="face">Face ID</option>
              <option value="card">RFID Card</option>
              <option value="manual">Manual Check-in</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-bold focus:outline-none focus:border-[#EA580C] cursor-pointer"
            >
              <option value="all">All Statuses</option>
              <option value="inside">Currently Inside Facility</option>
              <option value="completed">Completed / Checked Out</option>
            </select>

            {/* Location Filter */}
            <select
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-bold focus:outline-none focus:border-[#EA580C] cursor-pointer"
            >
              <option value="all">All Locations</option>
              {uniqueLocations.map(loc => <option key={loc} value={loc}>{loc}</option>)}
            </select>

          </div>
        </div>
      </div>

      {/* ══ Live Attendance Table ═════════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200/80 rounded-[28px] overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-extrabold text-sm text-slate-900 uppercase">Live Attendance Feed</h3>
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[9px] font-black uppercase rounded-full animate-pulse">
              LIVE STREAM
            </span>
          </div>
          <span className="text-xs text-slate-400 font-bold">
            Showing {filteredLogs.length} real logs
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="w-8 h-8 border-2 border-[#EA580C] border-t-transparent rounded-full animate-spin mb-3" />
            <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Listening for Biometric Punches...</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50/90 text-slate-400 font-black uppercase tracking-wider text-[9px] border-b border-slate-150">
                <tr>
                  <th className="px-5 py-4">Exact Time</th>
                  <th className="px-5 py-4">Member / Staff</th>
                  <th className="px-5 py-4 text-center">Type</th>
                  <th className="px-5 py-4">Biometric ID</th>
                  <th className="px-5 py-4">Access Method</th>
                  <th className="px-5 py-4">Location</th>
                  <th className="px-5 py-4 text-center">Status</th>
                  <th className="px-5 py-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {filteredLogs.map(item => {
                  const methodCfg = methodConfig[item.methodClean] || methodConfig.biometric;
                  const Icon = methodCfg.icon;
                  const avatarInitials = getInitials(item.personName);

                  return (
                    <tr key={item.id} className="hover:bg-orange-50/30 transition-colors">
                      
                      {/* EXACT TIME WITH SECONDS */}
                      <td className="px-5 py-3.5 font-mono text-slate-900">
                        <div className="font-extrabold text-xs">{item.formattedTime}</div>
                        <div className="text-[9px] text-slate-400 font-bold">{item.formattedDate}</div>
                      </td>

                      {/* MEMBER / STAFF */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-2xl bg-[#EA580C] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-sm">
                            {avatarInitials}
                          </div>
                          <div>
                            <div className="font-extrabold text-slate-900">{item.personName}</div>
                            <div className="text-[9px] text-slate-400 font-mono flex items-center gap-1.5 mt-0.5">
                              <span>ID: {item.personId}</span>
                              <span>•</span>
                              <span>{item.personPhone}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* TYPE */}
                      <td className="px-5 py-3.5 text-center">
                        <span className={`px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-wider border ${
                          item.isStaff ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]'
                        }`}>
                          {item.personType}
                        </span>
                      </td>

                      {/* BIOMETRIC ID */}
                      <td className="px-5 py-3.5 font-mono text-xs font-bold text-slate-700">
                        {item.biometricId ? `#${item.biometricId}` : '—'}
                      </td>

                      {/* ACCESS METHOD */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-1.5" style={{ color: methodCfg.color }}>
                          <Icon size={13} />
                          <span className="font-bold text-xs">{methodCfg.label}</span>
                        </div>
                      </td>

                      {/* LOCATION */}
                      <td className="px-5 py-3.5 text-xs text-slate-600 font-medium">
                        {item.branchName}
                      </td>

                      {/* STATUS */}
                      <td className="px-5 py-3.5 text-center">
                        <span className={`px-2.5 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider border ${
                          item.checkOut 
                            ? 'bg-yellow-50 text-yellow-800 border-yellow-200' 
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {item.checkOut ? 'CHECKED OUT' : 'INSIDE FACILITY'}
                        </span>
                      </td>

                      {/* ACTION */}
                      <td className="px-5 py-3.5 text-right">
                        {!item.checkOut ? (
                          <button
                            onClick={() => handleCheckoutLog(item.id, item.personName)}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[9.5px] font-black uppercase tracking-wider cursor-pointer border-none transition-all"
                          >
                            Checkout
                          </button>
                        ) : (
                          <span className="text-[10px] text-slate-400 font-mono">
                            {formatExactTime(item.checkOut)}
                          </span>
                        )}
                      </td>

                    </tr>
                  );
                })}

                {filteredLogs.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-16 bg-white">
                      <div className="flex flex-col items-center justify-center space-y-2">
                        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center font-black">
                          <CheckCircle2 size={24} />
                        </div>
                        <h4 className="text-sm font-black text-slate-900">No attendance yet</h4>
                        <p className="text-xs text-slate-400 font-medium max-w-sm">
                          {showHistorical ? 'No attendance records found matching filters.' : 'No biometric punches logged for the active live session.'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ Charts Grid: Hourly Flow & Daily Analytics ═════════════════════════ */}
      <div className="grid lg:grid-cols-2 gap-6">
        
        {/* TODAY'S CHECK-IN FLOW (Live Hourly Chart) */}
        <div className="bg-white border border-slate-200/80 rounded-[28px] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-sm text-slate-900 uppercase">Today's Check-in Flow</h3>
              <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">Live hourly distribution of valid punches</p>
            </div>
            {peakHourInfo.count > 0 && (
              <div className="bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl text-[10px] font-black text-amber-800 flex items-center gap-1.5">
                <Flame size={12} className="text-amber-500" />
                <span>PEAK: {peakHourInfo.label} ({peakHourInfo.count} punches)</span>
              </div>
            )}
          </div>

          <div className="h-[200px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyFlowData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="hour" tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, fontSize: 11, color: '#0F172A' }} />
                <Bar dataKey="checkIns" fill="#EA580C" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* DAILY ATTENDANCE ANALYTICS */}
        <div className="bg-white border border-slate-200/80 rounded-[28px] p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-black text-sm text-slate-900 uppercase">Daily Attendance Analytics</h3>
              <p className="text-[10.5px] text-slate-400 font-medium mt-0.5">Members vs Staff breakdown</p>
            </div>
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
              {[7, 14, 30].map(days => (
                <button
                  key={days}
                  onClick={() => setAnalyticsDays(days as any)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-black transition-all cursor-pointer border-none ${
                    analyticsDays === days ? 'bg-white text-[#EA580C] shadow-sm' : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {days} DAYS
                </button>
              ))}
            </div>
          </div>

          <div className="h-[200px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={analyticsTrendData}>
                <defs>
                  <linearGradient id="memGlow" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EA580C" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#EA580C" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
                <XAxis dataKey="date" tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#64748B', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 12, fontSize: 11, color: '#0F172A' }} />
                <Area type="monotone" dataKey="total" stroke="#EA580C" strokeWidth={2.5} fill="url(#memGlow)" name="Total Check-ins" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* ══ Manual Console Check-in ═══════════════════════════════════════════ */}
      <div className="bg-white border border-slate-200/80 rounded-[28px] p-6 shadow-sm space-y-4">
        <div>
          <h3 className="font-extrabold text-sm text-slate-900 uppercase">Manual Console Check-in</h3>
          <p className="text-xs text-slate-400 font-medium mt-0.5">Register attendance entries for members or staff without hardware scan.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-4 items-start">
          <div className="relative flex-1 w-full">
            <Search size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
            <input 
              type="text"
              value={manualSearch}
              onChange={e => {
                setManualSearch(e.target.value);
                setSelectedPersonForCheckin(null);
              }}
              placeholder="Search member or employee name, ID, or phone..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-3 focus:outline-none focus:border-[#EA580C] focus:bg-white font-semibold"
            />

            {/* Candidate Search Dropdown */}
            {searchCandidates.length > 0 && !selectedPersonForCheckin && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-2xl shadow-xl z-20 overflow-hidden divide-y divide-slate-100">
                {searchCandidates.map(c => (
                  <div 
                    key={c.id}
                    onClick={() => {
                      setSelectedPersonForCheckin(c);
                      setManualSearch(c.name);
                    }}
                    className="p-3 hover:bg-orange-50/50 cursor-pointer flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <div className="font-extrabold text-slate-900">{c.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">ID: {c.idVal} • {c.phone}</div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${c.isStaff ? 'bg-purple-50 text-purple-700' : 'bg-[#FFF7ED] text-[#C2410C]'}`}>
                      {c.typeLabel}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleExecuteManualCheckin}
            disabled={!selectedPersonForCheckin || submittingCheckin}
            className="w-full md:w-auto px-6 py-3 bg-[#EA580C] hover:bg-orange-700 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md transition-all cursor-pointer disabled:opacity-50 border-none flex items-center justify-center gap-2"
          >
            <UserCheck size={16} />
            <span>{submittingCheckin ? 'Registering...' : 'Register Manual Check-in'}</span>
          </button>
        </div>

        {selectedPersonForCheckin && (
          <div className="p-3 bg-orange-50/60 border border-[#FED7AA] rounded-xl text-xs flex items-center justify-between font-bold text-slate-800">
            <span>Selected for Manual Check-in: <strong>{selectedPersonForCheckin.name}</strong> ({selectedPersonForCheckin.typeLabel})</span>
            <button onClick={() => { setSelectedPersonForCheckin(null); setManualSearch(''); }} className="text-slate-400 hover:text-slate-600 cursor-pointer">
              <X size={16} />
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
