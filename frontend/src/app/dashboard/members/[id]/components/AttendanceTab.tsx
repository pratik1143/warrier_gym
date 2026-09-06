'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, LogOut, Percent, ShieldCheck, Fingerprint } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format ISO/timestamp → "21 Aug 2026" (Asia/Kolkata timezone) */
function fmtDate(raw: string | undefined | null): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { 
    day: '2-digit', 
    month: 'short', 
    year: 'numeric',
    timeZone: 'Asia/Kolkata' 
  });
}

/** Format ISO/timestamp → "10:52 PM" (Asia/Kolkata timezone) */
function fmtTime(raw: string | undefined | null): string {
  if (!raw) return '—';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-IN', { 
    hour: '2-digit', 
    minute: '2-digit', 
    hour12: true,
    timeZone: 'Asia/Kolkata' 
  }).toUpperCase();
}

export interface AttendanceSession {
  id: string;
  date: string;
  dateKey: string;
  checkIn: string;
  checkOut: string | null;
  isInside: boolean;
  pct: number;
  method?: string;
  deviceName?: string;
}

/**
 * Transforms raw biometric punches / events into canonical, unique workout sessions.
 * Deduplicates accidental double-taps, groups same-day punches into 1 session,
 * and sets "Inside Gym" strictly for active sessions today.
 */
export function buildAttendanceSessions(rawLogs: any[]): AttendanceSession[] {
  if (!Array.isArray(rawLogs) || rawLogs.length === 0) return [];

  // 1. Filter out duplicates, denied, or unmapped events
  const validPunches = rawLogs.filter((log) => {
    if (!log) return false;
    const st = String(log.status || '').toLowerCase();
    if (st === 'duplicate' || st === 'rejected' || st === 'denied' || st === 'unmapped') return false;
    const timeStr = log.checkIn || log.timestamp || log.checkInTime || log.date || log.createdAt;
    return Boolean(timeStr);
  });

  if (validPunches.length === 0) return [];

  // 2. Group punches by Indian calendar date (YYYY-MM-DD)
  const todayIST = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const dateMap = new Map<string, any[]>();

  validPunches.forEach((log) => {
    const rawTime = log.checkIn || log.timestamp || log.checkInTime || log.date || log.createdAt;
    const d = new Date(rawTime);
    if (isNaN(d.getTime())) return;

    const dateKey = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (!dateMap.has(dateKey)) {
      dateMap.set(dateKey, []);
    }
    dateMap.get(dateKey)!.push({ ...log, _timeMs: d.getTime(), _rawTime: rawTime });
  });

  const sessions: AttendanceSession[] = [];

  // 3. Build exactly ONE session per date
  dateMap.forEach((punches, dateKey) => {
    punches.sort((a, b) => a._timeMs - b._timeMs);

    const firstPunch = punches[0];
    const checkIn = firstPunch.checkIn || firstPunch.timestamp || firstPunch.checkInTime || firstPunch._rawTime;
    const firstTimeMs = firstPunch._timeMs;

    // Check if any record has explicit checkOut
    let explicitCheckOut: string | null = null;
    for (const p of punches) {
      if (p.checkOut && String(p.checkOut).trim() !== '' && p.checkOut !== '—') {
        const outMs = new Date(p.checkOut).getTime();
        if (!isNaN(outMs) && outMs > firstTimeMs) {
          explicitCheckOut = p.checkOut;
        }
      }
    }

    let checkOut: string | null = explicitCheckOut;

    // If no explicit checkout, but multiple punches exist on this date separated by >= 10 minutes
    if (!checkOut && punches.length > 1) {
      const lastPunch = punches[punches.length - 1];
      const lastTimeMs = lastPunch._timeMs;
      if (lastTimeMs - firstTimeMs >= 10 * 60 * 1000) {
        checkOut = lastPunch.checkIn || lastPunch.timestamp || lastPunch._rawTime;
      }
    }

    // Is currently inside gym? ONLY true if no checkOut AND session date is TODAY in IST!
    const isToday = dateKey === todayIST;
    const isInside = isToday && !checkOut;

    // Calculate percentage / attendance duration
    let pct = 100;
    if (checkIn && checkOut) {
      const inMs = new Date(checkIn).getTime();
      const outMs = new Date(checkOut).getTime();
      if (!isNaN(inMs) && !isNaN(outMs) && outMs > inMs) {
        const durationMin = (outMs - inMs) / 60000;
        pct = Math.min(100, Math.max(10, Math.round((durationMin / 60) * 100)));
      }
    }

    sessions.push({
      id: `session_${dateKey}_${firstPunch.id || firstTimeMs}`,
      date: checkIn,
      dateKey,
      checkIn,
      checkOut,
      isInside,
      pct,
      method: firstPunch.method || 'biometric',
      deviceName: firstPunch.deviceName || 'Biometric Device',
    });
  });

  // Sort sessions newest first
  sessions.sort((a, b) => new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime());

  return sessions;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function AttendanceTab({ member }: { member: any }) {
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);

  const docId      = String(member?.id || member?.uid || member?.memberId || '').trim();
  const memberCode = String(member?.memberId || member?.clientId || '').trim();
  const bioId      = String(member?.biometricId || member?.deviceUserId || member?.bioId || '').trim();
  const phone      = member?.phone ? String(member.phone).replace(/\D/g, '').slice(-10) : '';

  // ── Real-time Firestore listener (Read-Only) ────────────────────────────────
  useEffect(() => {
    if (!docId && !memberCode && !bioId) {
      setLoading(false);
      return;
    }

    setLoading(true);

    // Listen to collection 'attendance' (and fallback 'attendance_logs')
    const unsub = onSnapshot(
      collection(db, 'attendance'),
      (snap) => {
        const rawLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Strict member matching
        const memberLogs = rawLogs.filter((log: any) => {
          if (!log) return false;
          const lMemberId = String(log.memberId || log.memberCode || log.uid || '').trim();
          const lBioId    = String(log.biometricId || log.deviceUserId || log.bioId || '').trim();
          const lPhone    = log.phone ? String(log.phone).replace(/\D/g, '').slice(-10) : '';

          if (docId && lMemberId && docId === lMemberId) return true;
          if (memberCode && lMemberId && memberCode === lMemberId) return true;
          if (bioId && lBioId && bioId === lBioId) return true;
          if (phone && lPhone && phone === lPhone) return true;
          return false;
        });

        // Canonical sessionize
        const builtSessions = buildAttendanceSessions(memberLogs);
        setSessions(builtSessions);
        setLoading(false);
      },
      (err) => {
        console.warn('[AttendanceTab] Firestore attendance listener notice:', err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, [docId, memberCode, bioId, phone]);

  // ── Badge helpers ───────────────────────────────────────────────────────────
  const pctBadge = (pct: number) => {
    if (pct >= 100) return { label: '100%', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (pct >= 50)  return { label: `${pct}%`, cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    return { label: `${pct}%`, cls: 'bg-rose-50 text-rose-700 border-rose-200' };
  };

  return (
    <div className="space-y-0">
      {/* ── ATTENDANCE HISTORY CARD ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">

        {/* Card Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] text-[#0066FF] flex items-center justify-center shrink-0">
              <Calendar size={16} />
            </div>
            <div>
              <h3 className="font-black text-slate-900 text-sm leading-tight">Attendance History</h3>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">Real biometric attendance records</p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-extrabold border border-slate-200">
            {loading ? '…' : `${sessions.length} Session${sessions.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="py-16 flex items-center justify-center gap-2 text-slate-400 text-xs font-medium">
            <div className="w-4 h-4 rounded-full border-2 border-[#0066FF] border-t-transparent animate-spin" />
            Loading attendance records…
          </div>
        )}

        {/* Empty State — Strictly NO fake rows */}
        {!loading && sessions.length === 0 && (
          <div className="py-16 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200 text-slate-300 flex items-center justify-center">
              <Calendar size={24} />
            </div>
            <div>
              <p className="font-extrabold text-slate-700 text-sm">No attendance records yet</p>
              <p className="text-xs text-slate-400 font-medium mt-1 max-w-xs leading-relaxed">
                Attendance records will appear here automatically when this member checks in through the biometric system.
              </p>
            </div>
            <span className="mt-1 px-3 py-1 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold border border-slate-200">
              Attendance: 0%
            </span>
          </div>
        )}

        {/* ── DESKTOP TABLE ── */}
        {!loading && sessions.length > 0 && (
          <>
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-5">
                      <span className="flex items-center gap-1.5"><Calendar size={11} /> Date</span>
                    </th>
                    <th className="py-3 px-4">
                      <span className="flex items-center gap-1.5"><Clock size={11} /> Check-In</span>
                    </th>
                    <th className="py-3 px-4">
                      <span className="flex items-center gap-1.5"><LogOut size={11} /> Check-Out</span>
                    </th>
                    <th className="py-3 px-4">
                      <span className="flex items-center gap-1.5"><Percent size={11} /> Attendance</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessions.map((row) => {
                    const badge = pctBadge(row.pct);
                    return (
                      <tr key={row.id} className="hover:bg-slate-50/60 transition-colors text-xs font-semibold text-slate-700">
                        <td className="py-3.5 px-5 font-bold text-slate-900">
                          {fmtDate(row.date)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-800">
                          {fmtTime(row.checkIn)}
                        </td>
                        <td className="py-3.5 px-4 font-mono text-slate-800">
                          {row.isInside ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Inside Gym
                            </span>
                          ) : row.checkOut ? (
                            fmtTime(row.checkOut)
                          ) : (
                            <span className="text-slate-400 font-sans font-normal">—</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black border ${badge.cls}`}>
                            {badge.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* ── MOBILE STACKED CARDS ── */}
            <div className="block md:hidden divide-y divide-slate-100">
              {sessions.map((row) => {
                const badge = pctBadge(row.pct);
                return (
                  <div key={row.id} className="px-4 py-3.5 space-y-2">
                    {/* Date + Badge */}
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-slate-900 text-sm">{fmtDate(row.date)}</span>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black border ${badge.cls}`}>
                        {badge.label}
                      </span>
                    </div>
                    {/* Check-in / Check-out */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Check-In</div>
                        <div className="font-mono font-bold text-slate-900">{fmtTime(row.checkIn)}</div>
                      </div>
                      <div className="bg-slate-50 rounded-lg px-3 py-2 border border-slate-100">
                        <div className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-0.5">Check-Out</div>
                        <div className="font-mono font-bold text-slate-900">
                          {row.isInside ? (
                            <span className="inline-flex items-center gap-1.5 text-emerald-700 text-[10px] font-black">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                              Inside
                            </span>
                          ) : row.checkOut ? (
                            fmtTime(row.checkOut)
                          ) : (
                            <span className="text-slate-400 font-sans font-normal">—</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
