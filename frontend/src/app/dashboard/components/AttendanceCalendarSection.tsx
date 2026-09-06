'use client';

import React, { useState, useMemo } from 'react';
import { 
  ChevronLeft, ChevronRight, Users, Clock, CheckCircle2, 
  Search, Calendar, UserCheck, Shield, Briefcase
} from 'lucide-react';
import { getInitials } from '@/lib/utils';
import { resolveAvatarUrl, MALE_DEFAULT_AVATAR, FEMALE_DEFAULT_AVATAR } from '@/lib/avatar';
import { SYSTEM_START_DATE, SYSTEM_CONFIG } from '@/config/system';

interface AttendanceCalendarSectionProps {
  memberAttendanceLogs: any[];
  employeeAttendanceLogs: any[];
  employeesList: any[];
  membersList: any[];
}

export default function AttendanceCalendarSection({
  memberAttendanceLogs = [],
  employeeAttendanceLogs = [],
  employeesList = [],
  membersList = [],
}: AttendanceCalendarSectionProps) {
  // Current calendar navigation state (Asia/Kolkata)
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-11
  const [selectedDateYmd, setSelectedDateYmd] = useState<string | null>(null);

  // Staff card state
  const [staffSearch, setStaffSearch] = useState('');
  const [staffFilter, setStaffFilter] = useState<'all' | 'present' | 'absent' | 'absent_2' | 'absent_7'>('all');

  const todayStr = useMemo(() => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: SYSTEM_CONFIG.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(new Date());
  }, []);

  // Default active selected date to today
  const activeYmd = selectedDateYmd || todayStr;

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(prev => prev - 1);
    } else {
      setSelectedMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(prev => prev + 1);
    } else {
      setSelectedMonth(prev => prev + 1);
    }
  };

  const handleJumpToday = () => {
    const d = new Date();
    setSelectedYear(d.getFullYear());
    setSelectedMonth(d.getMonth());
    setSelectedDateYmd(todayStr);
  };

  // Helper to extract YYYY-MM-DD in Asia/Kolkata timezone
  const extractKolkataYMD = (rawDate: string | null | undefined): string | null => {
    if (!rawDate) return null;
    try {
      if (rawDate.length === 10 && rawDate.includes('-')) return rawDate;
      const d = new Date(rawDate);
      if (isNaN(d.getTime())) return null;
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: SYSTEM_CONFIG.timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).format(d);
    } catch {
      return null;
    }
  };

  // Pre-index ONLY valid attendance logs strictly on or after SYSTEM_START_DATE
  const attendanceByDate = useMemo(() => {
    const map = new Map<string, {
      memberPunches: any[];
      employeePunches: any[];
      uniqueMembers: Set<string>;
      uniqueEmployees: Set<string>;
      firstCheckIn: string | null;
      lastCheckIn: string | null;
    }>();

    // Process Member logs (Strictly exclude any pre-launch logs)
    (memberAttendanceLogs || []).forEach(log => {
      if (!log || log.isSample || log.isMock) return;
      const rawDate = String(log.checkIn || log.timestamp || log.createdAt || '');
      const ymd = extractKolkataYMD(rawDate);
      if (!ymd || ymd < SYSTEM_START_DATE) return; // STRICT ZERO BEFORE SYSTEM_START_DATE

      if (!map.has(ymd)) {
        map.set(ymd, {
          memberPunches: [],
          employeePunches: [],
          uniqueMembers: new Set(),
          uniqueEmployees: new Set(),
          firstCheckIn: null,
          lastCheckIn: null,
        });
      }

      const entry = map.get(ymd)!;
      entry.memberPunches.push(log);
      const mKey = log.memberId || log.biometricId || log.deviceUserId || log.memberName;
      if (mKey && String(mKey).trim()) entry.uniqueMembers.add(String(mKey).trim());

      const timeStr = log.checkIn || log.timestamp;
      if (timeStr) {
        if (!entry.firstCheckIn || timeStr < entry.firstCheckIn) entry.firstCheckIn = timeStr;
        if (!entry.lastCheckIn || timeStr > entry.lastCheckIn) entry.lastCheckIn = timeStr;
      }
    });

    // Process Employee logs (Strictly exclude any pre-launch logs)
    (employeeAttendanceLogs || []).forEach(log => {
      if (!log || log.isSample || log.isMock) return;
      const rawDate = String(log.timestamp || log.checkIn || log.createdAt || '');
      const ymd = extractKolkataYMD(rawDate);
      if (!ymd || ymd < SYSTEM_START_DATE) return; // STRICT ZERO BEFORE SYSTEM_START_DATE

      if (!map.has(ymd)) {
        map.set(ymd, {
          memberPunches: [],
          employeePunches: [],
          uniqueMembers: new Set(),
          uniqueEmployees: new Set(),
          firstCheckIn: null,
          lastCheckIn: null,
        });
      }

      const entry = map.get(ymd)!;
      entry.employeePunches.push(log);
      const eKey = log.employeeId || log.biometricId || log.employeeName;
      if (eKey && String(eKey).trim()) entry.uniqueEmployees.add(String(eKey).trim());

      const timeStr = log.timestamp || log.checkIn;
      if (timeStr) {
        if (!entry.firstCheckIn || timeStr < entry.firstCheckIn) entry.firstCheckIn = timeStr;
        if (!entry.lastCheckIn || timeStr > entry.lastCheckIn) entry.lastCheckIn = timeStr;
      }
    });

    return map;
  }, [memberAttendanceLogs, employeeAttendanceLogs]);

  // Calendar Grid metrics for currently selected month
  const calendarDays = useMemo(() => {
    const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
    const firstDayIndex = new Date(selectedYear, selectedMonth, 1).getDay(); // 0 = Sunday

    const days = [];

    // Empty offset slots
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ isOffset: true, key: `offset-${i}` });
    }

    // Actual calendar days
    for (let d = 1; d <= daysInMonth; d++) {
      const dayStr = String(d).padStart(2, '0');
      const monthStr = String(selectedMonth + 1).padStart(2, '0');
      const ymd = `${selectedYear}-${monthStr}-${dayStr}`;
      const dayOfWeek = new Date(selectedYear, selectedMonth, d).getDay(); // 0 = Sunday

      const isSunday = dayOfWeek === 0;
      const isToday = ymd === todayStr;
      const isBeforeLaunch = ymd < SYSTEM_START_DATE;

      // When before launch date, punches are strictly 0 and cannot have heatmap
      const record = isBeforeLaunch ? null : attendanceByDate.get(ymd);
      const memberPunches = record ? record.memberPunches.length : 0;
      const staffPunches = record ? record.employeePunches.length : 0;
      const totalPunches = isBeforeLaunch ? 0 : (memberPunches + staffPunches);
      const memberCount = record ? record.uniqueMembers.size : 0;
      const staffCount = record ? record.uniqueEmployees.size : 0;

      // Intensity level
      let intensity: 'none' | 'low' | 'medium' | 'high' | 'peak' = 'none';
      if (totalPunches > 0) {
        if (totalPunches <= 5) intensity = 'low';
        else if (totalPunches <= 15) intensity = 'medium';
        else if (totalPunches <= 30) intensity = 'high';
        else intensity = 'peak';
      }

      days.push({
        isOffset: false,
        key: ymd,
        dayNum: d,
        ymd,
        isSunday,
        isToday,
        isBeforeLaunch,
        totalPunches,
        memberPunches,
        staffPunches,
        memberCount,
        staffCount,
        intensity,
        firstCheckIn: record?.firstCheckIn || null,
        lastCheckIn: record?.lastCheckIn || null,
      });
    }

    return days;
  }, [selectedYear, selectedMonth, attendanceByDate, todayStr]);

  // Active inspected day object
  const activeDayObj = useMemo(() => {
    const found = calendarDays.find(d => !d.isOffset && d.ymd === activeYmd);
    if (found) return found;

    const isBeforeLaunch = activeYmd < SYSTEM_START_DATE;
    const isToday = activeYmd === todayStr;
    const record = isBeforeLaunch ? null : attendanceByDate.get(activeYmd);
    const memberPunches = record ? record.memberPunches.length : 0;
    const staffPunches = record ? record.employeePunches.length : 0;
    const totalPunches = isBeforeLaunch ? 0 : (memberPunches + staffPunches);

    return {
      isOffset: false,
      key: activeYmd,
      dayNum: Number(activeYmd.split('-')[2] || '1'),
      ymd: activeYmd,
      isSunday: new Date(activeYmd).getDay() === 0,
      isToday,
      isBeforeLaunch,
      totalPunches,
      memberPunches,
      staffPunches,
      memberCount: record ? record.uniqueMembers.size : 0,
      staffCount: record ? record.uniqueEmployees.size : 0,
      intensity: 'none',
      firstCheckIn: record?.firstCheckIn || null,
      lastCheckIn: record?.lastCheckIn || null,
    };
  }, [calendarDays, activeYmd, todayStr, attendanceByDate]);

  // Helper to format ISO time to friendly string (e.g. 08:42 AM)
  const formatTimeStr = (iso: string | null) => {
    if (!iso) return '--';
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '--';
      return d.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
        timeZone: SYSTEM_CONFIG.timezone,
      });
    } catch {
      return '--';
    }
  };

  // Staff Attendance & Absence Tracking (Real Employees Only)
  const staffListWithStatus = useMemo(() => {
    const sourceList = Array.isArray(employeesList) ? employeesList : [];

    return sourceList.map((emp: any) => {
      const empLogs = (employeeAttendanceLogs || []).filter(l => {
        if (!l || l.isSample || l.isMock) return false;
        const eId = l.employeeId || l.biometricId;
        const targetId = emp.id || emp.biometricId || emp.employeeId;
        const rawDate = String(l.timestamp || l.checkIn || '');
        const ymd = extractKolkataYMD(rawDate);
        if (!ymd || ymd < SYSTEM_START_DATE) return false;
        return (eId && targetId && (String(eId) === String(targetId) || String(l.biometricId) === String(emp.biometricId)));
      });

      // Filter logs for today
      const todayLogs = empLogs.filter(l => {
        const rawDate = String(l.timestamp || l.checkIn || '');
        return extractKolkataYMD(rawDate) === todayStr;
      });

      const punchedToday = todayLogs.length > 0;
      let lastPunchTime: string | null = null;
      let lastSeenDateStr: string | null = null;

      if (todayLogs.length > 0) {
        lastPunchTime = todayLogs[0].timestamp || todayLogs[0].checkIn;
      } else if (empLogs.length > 0) {
        const sorted = [...empLogs].sort((a, b) => new Date(b.timestamp || b.checkIn || 0).getTime() - new Date(a.timestamp || a.checkIn || 0).getTime());
        lastSeenDateStr = sorted[0].timestamp || sorted[0].checkIn;
      }

      // Calculate consecutive absent days starting from SYSTEM_START_DATE (2026-08-23)
      let absentDays = 0;
      if (!punchedToday) {
        const todayD = new Date(todayStr);
        const startD = new Date(SYSTEM_START_DATE);
        
        if (todayD.getTime() > startD.getTime()) {
          const refDate = lastSeenDateStr ? new Date(lastSeenDateStr.split('T')[0]) : startD;
          let curr = new Date(refDate);
          curr.setDate(curr.getDate() + 1);

          while (curr < todayD) {
            if (curr.getDay() !== 0) { // Do not count Sundays as absent
              absentDays++;
            }
            curr.setDate(curr.getDate() + 1);
          }
          if (todayD.getDay() !== 0) absentDays++;
        }
      }

      return {
        ...emp,
        punchedToday,
        lastPunchTime,
        lastSeenDateStr,
        absentDays
      };
    });
  }, [employeesList, employeeAttendanceLogs, todayStr]);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return staffListWithStatus.filter(emp => {
      const q = staffSearch.trim().toLowerCase();
      const matchesQuery = !q || (emp.name && emp.name.toLowerCase().includes(q)) || (emp.role && emp.role.toLowerCase().includes(q)) || (emp.phone && emp.phone.includes(q));
      if (!matchesQuery) return false;

      if (staffFilter === 'present') return emp.punchedToday;
      if (staffFilter === 'absent') return !emp.punchedToday;
      if (staffFilter === 'absent_2') return !emp.punchedToday && emp.absentDays >= 2;
      if (staffFilter === 'absent_7') return !emp.punchedToday && emp.absentDays >= 7;

      return true;
    });
  }, [staffListWithStatus, staffSearch, staffFilter]);

  const presentStaffCount = staffListWithStatus.filter(e => e.punchedToday).length;
  const absentStaffCount = staffListWithStatus.filter(e => !e.punchedToday).length;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 w-full items-stretch text-left">
      
      {/* ─── 1. STAFF MANAGEMENT (PRIMARY PANEL - LEFT ~65% / 7-8 COLS) ─── */}
      <div className="lg:col-span-7 xl:col-span-8 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs flex flex-col justify-between h-full min-w-0">
        
        {/* Panel Header & Controls */}
        <div className="w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3.5">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center shrink-0 border border-[#FED7AA]">
                <Briefcase size={14} strokeWidth={2.5} />
              </div>
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 font-display">
                STAFF MANAGEMENT
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-lg border border-emerald-200 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                {presentStaffCount} Present
              </span>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg border border-slate-200">
                {absentStaffCount} Not Checked In
              </span>
              <span className="text-[10px] font-bold bg-[#FFF7ED] text-[#EA580C] px-2.5 py-1 rounded-lg border border-[#FED7AA]">
                {staffListWithStatus.length} Total
              </span>
            </div>
          </div>

          {/* Search and Filter Inputs */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 my-3">
            <div className="sm:col-span-8 relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search staff by name, role, phone..."
                value={staffSearch}
                onChange={e => setStaffSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#EA580C] placeholder:text-slate-400"
              />
            </div>

            <div className="sm:col-span-4">
              <select
                value={staffFilter}
                onChange={e => setStaffFilter(e.target.value as any)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#EA580C] cursor-pointer"
              >
                <option value="all">All Staff ({staffListWithStatus.length})</option>
                <option value="present">Present Today ({presentStaffCount})</option>
                <option value="absent">Not Checked In ({absentStaffCount})</option>
                <option value="absent_2">Absent 2+ Days</option>
                <option value="absent_7">Absent 7+ Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Staff Table / Rich Card Roster */}
        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 min-h-[160px]">
          {filteredStaff.length > 0 ? (
            filteredStaff.map((emp: any) => {
              const isPresent = emp.punchedToday;

              return (
                <div 
                  key={emp.id || emp.biometricId || emp.name} 
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/60 hover:bg-[#FFF7ED] hover:border-[#FED7AA] transition-all"
                >
                  {/* Left: Staff Identity */}
                  <div className="flex items-center gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-xl overflow-hidden shrink-0 border border-[#FED7AA] shadow-xs bg-[#FFF7ED] flex items-center justify-center">
                      <img 
                        src={resolveAvatarUrl(emp)} 
                        onError={(e) => {
                          const target = e.currentTarget;
                          const g = String(emp?.gender || '').trim().toLowerCase();
                          target.src = (g === 'female' || g === 'f') ? FEMALE_DEFAULT_AVATAR : MALE_DEFAULT_AVATAR;
                        }}
                        className="w-full h-full object-cover" 
                        alt={emp.name || 'Staff'} 
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-black text-slate-900 truncate flex items-center gap-1.5">
                        <span>{emp.name || 'Staff Member'}</span>
                        {emp.biometricId && (
                          <span className="text-[9px] font-mono text-[#EA580C] font-bold bg-[#FFF7ED] px-1.5 py-0.5 rounded border border-[#FED7AA]">
                            #{emp.biometricId}
                          </span>
                        )}
                      </div>
                      <div className="text-[10.5px] text-slate-400 font-medium truncate flex items-center gap-2 mt-0.5">
                        <span className="font-semibold text-slate-600">{emp.phone || 'No Contact'}</span>
                        <span>·</span>
                        <span className="text-slate-500">{emp.branch || 'Mohali, Punjab'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Center: Role Tag */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] font-black px-3 py-1 rounded-lg uppercase tracking-wider bg-white text-slate-800 border border-slate-200 shadow-2xs">
                      {emp.role || 'Staff'}
                    </span>
                  </div>

                  {/* Right: Live Status & Punch Time */}
                  <div className="text-right shrink-0 flex sm:flex-col items-center sm:items-end justify-between sm:justify-center gap-1">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9.5px] font-black uppercase tracking-wider ${
                      isPresent
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}>
                      {isPresent ? <CheckCircle2 size={11} className="text-emerald-600" /> : <Clock size={11} className="text-slate-400" />}
                      {isPresent ? 'Present Today' : 'Not Checked In'}
                    </span>
                    <div className="text-[10px] font-semibold text-slate-500">
                      {isPresent ? (
                        <span>Punch: <strong className="font-mono text-slate-800">{formatTimeStr(emp.lastPunchTime)}</strong></span>
                      ) : (
                        <span>Absent: <strong className="font-mono text-slate-800">{emp.absentDays} days</strong></span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center py-8 text-slate-400">
              <Users size={28} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs font-bold text-slate-600">No staff members found matching filter</p>
              <p className="text-[10px] text-slate-400 mt-0.5">Adjust your search query or reset filter dropdown</p>
            </div>
          )}
        </div>

      </div>

      {/* ─── 2. ATTENDANCE CALENDAR (COMPACT PANEL - RIGHT ~35% / 4-5 COLS) ─── */}
      <div className="lg:col-span-5 xl:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between h-full min-w-0 overflow-hidden">
        
        {/* Header with 2 Responsive Rows */}
        <div className="w-full min-w-0">
          {/* ROW 1: Controls & Navigation Bar */}
          <div className="flex items-center justify-between gap-1.5 flex-wrap w-full min-w-0 pb-2.5 border-b border-slate-100">
            {/* Left: Calendar Icon badge */}
            <div className="w-7 h-7 rounded-lg bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center shrink-0 border border-[#FED7AA]">
              <Calendar size={14} strokeWidth={2.5} />
            </div>

            {/* Right: Controls (Month, Year, Today, Prev, Next) */}
            <div className="flex items-center gap-1 flex-wrap shrink-0">
              <select
                value={selectedMonth}
                onChange={e => setSelectedMonth(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-[11px] font-bold rounded-lg px-2 py-1 outline-none focus:border-[#EA580C] cursor-pointer"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx}>{m.slice(0, 3)}</option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="bg-slate-50 border border-slate-200 text-slate-800 text-[11px] font-bold rounded-lg px-1.5 py-1 outline-none focus:border-[#EA580C] cursor-pointer"
              >
                {[2025, 2026, 2027, 2028].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>

              <button
                onClick={handleJumpToday}
                className="px-2 py-1 bg-[#FFF7ED] hover:bg-[#d4e7fc] text-[#EA580C] font-black text-[9px] uppercase rounded-lg border border-[#FED7AA] transition-all cursor-pointer"
              >
                Today
              </button>

              <div className="flex items-center gap-0.5">
                <button
                  onClick={handlePrevMonth}
                  className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center border border-slate-200 transition-all cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft size={13} />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center border border-slate-200 transition-all cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* ROW 2: Title & Subtitle */}
          <div className="pt-2 pb-1">
            <h4 className="text-[12px] font-black uppercase tracking-wider text-slate-900 leading-tight font-display">
              ATTENDANCE CALENDAR
            </h4>
            <p className="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">
              Track member &amp; staff attendance across every day
            </p>
          </div>

          {/* 7-Column Compact Grid */}
          <div className="my-2 w-full min-w-0">
            {/* Weekday Labels Header */}
            <div className="grid grid-cols-7 gap-1 mb-1 text-center text-[9px] font-black text-slate-400 uppercase tracking-wider w-full min-w-0">
              <span className="text-rose-600 font-extrabold">Su</span>
              <span>Mo</span>
              <span>Tu</span>
              <span>We</span>
              <span>Th</span>
              <span>Fr</span>
              <span>Sa</span>
            </div>

            {/* Calendar Day Cells */}
            <div className="grid grid-cols-7 gap-1 justify-items-center w-full min-w-0">
              {calendarDays.map((day) => {
                if (day.isOffset) {
                  return <div key={day.key} className="w-full aspect-square bg-transparent min-w-0" />;
                }

                let cellBg = 'bg-slate-50 border-slate-200/80 text-slate-700 hover:border-[#EA580C] hover:bg-slate-100';
                if (day.isSunday && day.intensity === 'none') {
                  cellBg = 'bg-rose-50/70 border-rose-200/80 text-rose-700 font-extrabold';
                } else if (day.intensity === 'low') {
                  cellBg = 'bg-[#FFF7ED] border-[#FED7AA] text-[#EA580C] font-bold shadow-xs';
                } else if (day.intensity === 'medium') {
                  cellBg = 'bg-[#c6e0ff] border-[#8cbcf5] text-[#C2410C] font-black shadow-xs';
                } else if (day.intensity === 'high') {
                  cellBg = 'bg-[#EA580C] border-[#EA580C] text-white font-black shadow-xs';
                } else if (day.intensity === 'peak') {
                  cellBg = 'bg-[#073673] border-[#073673] text-white font-black shadow-xs';
                }

                const isSelected = activeYmd === day.ymd;

                return (
                  <div
                    key={day.key}
                    onClick={() => { if (day.ymd) setSelectedDateYmd(day.ymd); }}
                    className={`w-full aspect-square min-w-0 rounded-lg border flex flex-col items-center justify-center relative cursor-pointer transition-all ${cellBg} ${
                      day.isToday ? 'ring-2 ring-[#EA580C] ring-offset-1 z-10' : ''
                    } ${isSelected ? 'scale-105 shadow-md border-[#EA580C]' : 'hover:scale-105'}`}
                    title={`${day.ymd || ''} — ${day.totalPunches || 0} Punches`}
                  >
                    <span className={`text-[10px] leading-none ${day.isSunday ? 'text-rose-600' : ''}`}>
                      {day.dayNum}
                    </span>

                    {(day.totalPunches || 0) > 0 && (
                      <span className="text-[7.5px] font-mono font-black mt-0.5 leading-none opacity-90">
                        {day.totalPunches}p
                      </span>
                    )}

                    {day.isToday && (
                      <span className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#EA580C]" />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Day Inspector Popover / Banner */}
        {activeDayObj && (
          <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-xl p-2.5 mt-1.5 text-xs w-full min-w-0 overflow-hidden">
            <div className="flex items-center justify-between border-b border-[#FED7AA]/60 pb-1.5 min-w-0">
              <div className="font-extrabold text-slate-900 flex items-center gap-1.5 text-[11px] truncate min-w-0">
                <span className="truncate">{new Date(activeDayObj.ymd || todayStr).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                {activeDayObj.isToday && <span className="bg-[#EA580C] text-white text-[7.5px] font-black px-1.5 py-0.2 rounded-full uppercase shrink-0">Today</span>}
                {activeDayObj.isSunday && <span className="bg-rose-100 text-rose-700 text-[7.5px] font-black px-1.5 py-0.2 rounded-full uppercase shrink-0">Sun</span>}
              </div>

              <span className="text-[9.5px] font-mono font-black text-slate-700 shrink-0 ml-1">
                {activeDayObj.isBeforeLaunch ? 'Pre-launch' : `${activeDayObj.totalPunches || 0} punches`}
              </span>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-1.5 text-[9px] w-full min-w-0">
              <div className="bg-white p-1.5 rounded border border-[#FED7AA] min-w-0 overflow-hidden">
                <span className="text-slate-400 font-bold block uppercase text-[7.5px] truncate">Members</span>
                <span className="text-slate-900 font-black text-xs font-mono">{activeDayObj.memberCount || 0}</span>
              </div>
              <div className="bg-white p-1.5 rounded border border-[#FED7AA] min-w-0 overflow-hidden">
                <span className="text-slate-400 font-bold block uppercase text-[7.5px] truncate">Staff</span>
                <span className="text-slate-900 font-black text-xs font-mono">{activeDayObj.staffCount || 0}</span>
              </div>
              <div className="bg-white p-1.5 rounded border border-[#FED7AA] min-w-0 overflow-hidden">
                <span className="text-slate-400 font-bold block uppercase text-[7.5px] truncate">First Punch</span>
                <span className="text-slate-700 font-bold text-[8.5px] font-mono block truncate">
                  {formatTimeStr(activeDayObj.firstCheckIn || null)}
                </span>
              </div>
            </div>
          </div>
        )}

      </div>

    </div>
  );
}
