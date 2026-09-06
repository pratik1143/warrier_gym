'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Users, Clock, Plus, ArrowUpRight, Unlock, Phone, MessageSquare, 
  DollarSign, ShieldAlert, Sparkles, ClipboardList, AlertTriangle, ChevronLeft, ChevronRight
} from 'lucide-react';
import { useGymStore } from '@/store';
import { getInitials, daysUntilExpiry } from '@/lib/utils';
import toast from '@/lib/toast';
import { collection, addDoc, onSnapshot } from 'firebase/firestore';
import { db as fDb, isFirebaseReady } from '@/lib/firebase';
import API from '@/services/api';
import { useFollowups } from '@/hooks/useFollowups';
import AttendanceCalendarSection from './components/AttendanceCalendarSection';
import { getISTDateStr } from '@/hooks/useTodaysPayments';

export default function DashboardPage() {
  const router = useRouter();
  const { pendingCount: followupsCount, todaysCount } = useFollowups();
  const {
    members, attendance, gymPresence, payments, fetchMembers, fetchAttendance, fetchPayments,
    triggerGateUnlock, dashboardAnalytics, fetchDashboardAnalytics, deviceStatus
  } = useGymStore();

  const [isMounted, setIsMounted] = useState(false);
  const [liveCount, setLiveCount] = useState(0);
  const [gateUnlocked, setGateUnlocked] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [empAttendance, setEmpAttendance] = useState<any[]>([]);
  const [memberAttendance, setMemberAttendance] = useState<any[]>([]);
  const [realtimeMembers, setRealtimeMembers] = useState<any[]>([]);
  const [realtimePayments, setRealtimePayments] = useState<any[]>([]);
  const [enquiriesCount, setEnquiriesCount] = useState<number>(0);
  const [activeHeatmapFilter, setActiveHeatmapFilter] = useState('Yours');

  // Sync store members to local state
  useEffect(() => {
    if (members && members.length > 0) {
      setRealtimeMembers(members);
    }
  }, [members]);

  // Setup real-time listeners for required operational data
  useEffect(() => {
    if (!isFirebaseReady || !fDb) return;
    
    const unsubEmployees = onSnapshot(collection(fDb, 'employees'), (snap) => {
      setEmployees(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("Firestore employees listener error:", err);
    });

    const unsubEmpAtt = onSnapshot(collection(fDb, 'employeeAttendance'), (snap) => {
      setEmpAttendance(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("Firestore employeeAttendance listener error:", err);
    });

    const unsubMemberAtt = onSnapshot(collection(fDb, 'attendance'), (snap) => {
      setMemberAttendance(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.warn("Firestore attendance listener notice:", err);
    });

    const unsubEnq = onSnapshot(collection(fDb, 'enquiries'), (snap) => {
      setEnquiriesCount(snap.size);
    }, (err) => {
      console.warn("Enquiries listener notice:", err);
      API.get('/enquiries').then(res => {
        if (Array.isArray(res.data)) setEnquiriesCount(res.data.length);
      }).catch(() => {});
    });

    const unsubPayments = onSnapshot(collection(fDb, 'payments'), (snap) => {
      setRealtimePayments(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.warn("Firestore payments listener notice:", err);
    });

    return () => {
      unsubEmployees();
      unsubEmpAtt();
      unsubMemberAtt();
      unsubEnq();
      unsubPayments();
    };
  }, []);

  // Load real data from backend API
  useEffect(() => {
    setIsMounted(true);
    fetchMembers();
    fetchAttendance();
    fetchPayments();
    fetchDashboardAnalytics();
    API.get('/employees').then(res => {
      if (Array.isArray(res.data) && res.data.length > 0) {
        setEmployees(res.data);
      }
    }).catch(() => {});
  }, [fetchMembers, fetchAttendance, fetchPayments, fetchDashboardAnalytics]);

  // Derive live occupancy count from real memberAttendance logs + gymPresence
  useEffect(() => {
    const logs = (memberAttendance && memberAttendance.length > 0) ? memberAttendance : (attendance || []);
    const now = new Date().getTime();

    const presenceInside = (gymPresence || []).filter((p: any) => {
      if (!p.inside) return false;
      const checkInTime = new Date(p.checkIn || p.timestamp || new Date()).getTime();
      return (now - checkInTime) <= 4 * 3600 * 1000;
    }).length;

    const todayStr = new Date().toISOString().split('T')[0];
    const insideMap = new Map();

    logs.forEach((a: any) => {
      const rawDate = a.checkIn || a.timestamp || a.createdAt || '';
      if (!rawDate) return;
      const checkInDate = new Date(rawDate);
      if (checkInDate.toISOString().split('T')[0] !== todayStr && checkInDate.toDateString() !== new Date().toDateString()) return;

      const memberKey = a.memberId || a.memberName;
      if (!memberKey || a.status === 'denied' || a.status === 'unknown') return;

      const isCheckedOut = !!a.checkOut || a.autoCheckedOut === true || a.status === 'auto_checkout';
      const checkInTime = checkInDate.getTime();

      if (!isCheckedOut && (now - checkInTime) <= 4 * 3600 * 1000) {
        insideMap.set(memberKey, true);
      }
    });

    const activeCount = Math.max(presenceInside, insideMap.size);
    setLiveCount(activeCount);
  }, [gymPresence, memberAttendance, attendance]);

  const handleManualUnlock = async () => {
    setGateUnlocked(true);
    toast.loading('Transmitting remote unlock pulse to Hikvision terminal...', { id: 'unlock-dash' });
    try {
      const res = await API.post('/devices/hikvision/door/open', { doorId: 1, requestedBy: 'Admin' });
      if (res.data?.success) {
        toast.success('✓ TURNSTILE UNLOCKED - Hikvision DS-K1T320EFWX (Door 1)', { id: 'unlock-dash' });
      } else {
        toast.error('✕ UNLOCK FAILED: ' + (res.data?.error || 'Terminal response error'), { id: 'unlock-dash' });
      }
    } catch (err: any) {
      toast.error('✕ UNLOCK FAILED: ' + (err.message || 'Error communicating with terminal'), { id: 'unlock-dash' });
    } finally {
      setTimeout(() => {
        setGateUnlocked(false);
      }, 3000);
    }
  };

  const handleReceptionAction = async (member: any, actionType: string) => {
    let detailMsg = '';
    let successToast = '';

    if (actionType === 'Call Member') {
      detailMsg = `Called member at ${member.phone}. Checked in on renewal and gym attendance status.`;
      successToast = `Call logged for ${member.name}!`;
    } else if (actionType === 'Send WhatsApp') {
      detailMsg = `Dispatched membership renewal alert template to WhatsApp at ${member.phone}.`;
      successToast = `WhatsApp alert sent to ${member.name}!`;
    } else if (actionType === 'Offer Discount') {
      detailMsg = `SMS sent with 20% renewal discount coupon: RENEW20`;
      successToast = `Discount coupon sent to ${member.name}!`;
    } else if (actionType === 'Assign Trainer') {
      detailMsg = `Assigned trainer ${member.trainer || 'Karan Verma'} to monitor athlete and support compliance.`;
      successToast = `Trainer assignment alert sent to ${member.name}!`;
    }

    try {
      if (isFirebaseReady && fDb) {
        await addDoc(collection(fDb, 'retention_actions'), {
          memberId: member.id,
          memberName: member.name,
          action: actionType,
          details: detailMsg,
          operator: 'Receptionist Desk',
          timestamp: new Date().toISOString()
        });

        await addDoc(collection(fDb, 'followups'), {
          memberId: member.id,
          memberName: member.name,
          memberPhone: member.phone,
          riskScore: member.ai.score,
          assignedTo: member.trainer || 'Receptionist Desk',
          status: 'completed',
          dueDate: new Date().toISOString().split('T')[0],
          notes: `Reception Action: ${actionType} completed. Details: ${detailMsg}`,
          createdAt: new Date().toISOString()
        });
      }
      toast.success(successToast, { icon: '🤖' });
    } catch (e) {
      toast.error('Failed to log action');
    }
  };

  const getMemberRisk = (m: any) => {
    const daysLeft = daysUntilExpiry(m.expiryDate);
    const count = m.attendanceCount || 0;
    let score = 20;
    if (daysLeft < 0) score += 35;
    else if (daysLeft <= 7) score += 40;
    else if (daysLeft <= 15) score += 20;
    if (count <= 2) score += 35;
    else if (count <= 5) score += 15;
    const finalScore = Math.max(5, Math.min(95, score));
    const cancellationChance = Math.round(finalScore * 0.9 + 5);
    const renewalChance = 100 - cancellationChance;
    
    let category: 'Green' | 'Yellow' | 'Orange' | 'Red' = 'Green';
    if (finalScore >= 80) category = 'Red';
    else if (finalScore >= 60) category = 'Orange';
    else if (finalScore >= 30) category = 'Yellow';

    return { score: finalScore, category, cancellationChance, renewalChance, daysLeft };
  };

  // Evaluate members risk
  const evaluatedMembers = realtimeMembers.map(m => ({ ...m, ai: getMemberRisk(m) }));

  // Receptionist view lists
  const membersToCall = evaluatedMembers.filter(m => m.ai.category === 'Red' || m.ai.daysLeft <= 0).slice(0, 5);
  const membersAtRisk = evaluatedMembers.filter(m => m.ai.category === 'Orange' || m.ai.category === 'Red').slice(0, 5);
  const membersExpiringSoon = evaluatedMembers.filter(m => m.ai.daysLeft > 0 && m.ai.daysLeft <= 15).slice(0, 5);
  const renewalOpportunities = evaluatedMembers.filter(m => m.ai.renewalChance > 70).slice(0, 5);

  const todaysCollection = useMemo(() => {
    // IST-correct today string (fixes UTC midnight boundary bug)
    const todayStr = getISTDateStr();
    const seen = new Set<string>();

    const activeList = (realtimePayments && realtimePayments.length > 0) ? realtimePayments : (payments || []);
    let total = 0;

    if (Array.isArray(activeList) && activeList.length > 0) {
      activeList.forEach((p: any) => {
        if (!p || p.isSample || p.isMock) return;
        // Exclude soft-deleted payments
        if (p.deleted === true) return;

        // Strictly exclude historical imports from today's collection
        const isHistorical = p.isHistorical === true || p.imported === true || p.isLegacyImport === true || p.transactionType === 'historical_import';
        if (isHistorical) return;

        const status = String(p.status || p.paymentStatus || 'paid').toLowerCase();
        if (status !== 'paid' && status !== 'partial') return;

        // Payment date must match today IST (NEVER fall back to createdAt)
        const pDate = String(p.paymentDate || p.date || '').split('T')[0];
        if (pDate !== todayStr && !p.isRealTimeToday) return;

        const key = String(p.id || p.invoiceNumber || p.invoice || p.idempotencyKey || '').trim();
        if (key && seen.has(key)) return;
        if (key) seen.add(key);

        const val = Number(p.amountPaid !== undefined ? p.amountPaid : (p.paid !== undefined ? p.paid : (p.amount || 0)));
        total += (isNaN(val) ? 0 : val);
      });
    }

    return total;
  }, [realtimePayments, payments]);

  const expiringSoonCount = realtimeMembers.filter((m: any) => {
    const left = daysUntilExpiry(m.expiryDate);
    return left >= 0 && left <= 30;
  }).length;

  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const checkinDays = attendance ? attendance.map((a: any) => new Date(a.checkIn || '').getDate()) : [];

  return (
    <div className="flex flex-col gap-5 w-full text-slate-800 text-left bg-[#FDFDFD]">
      
      {/* ─── 1. PAGE HEADER ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-stone-200/80 shadow-xs">
        <div>
          <h1 className="font-rowdies text-2xl font-bold text-slate-900 uppercase tracking-tight leading-none">
            Dashboard
          </h1>
          <p className="text-slate-500 text-xs mt-1.5 font-medium">
            Manage gym operations, memberships, attendance and business performance.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Device status badge */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#FFF7ED] border border-[#FED7AA] rounded-xl text-[10px] font-black uppercase tracking-wider text-[#EA580C]">
            <span className={`w-2 h-2 rounded-full ${deviceStatus === 'connected' ? 'bg-emerald-500' : deviceStatus === 'syncing' ? 'bg-orange-400 animate-pulse' : 'bg-rose-500'}`} />
            {deviceStatus === 'connected' ? 'Device Online' : deviceStatus === 'syncing' ? 'Syncing...' : 'Device Offline'}
          </div>
        </div>
      </div>

      {/* ─── 2. TOP KPI CARDS (ROW 1) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {/* Card 1: Today's Follow-ups */}
        <div 
          onClick={() => router.push('/dashboard/follow-up')}
          className="bg-white border border-stone-200/80 p-4.5 rounded-2xl shadow-xs flex items-center gap-4 hover:border-[#F97316] hover:shadow-[0_8px_25px_rgba(249,115,22,0.12)] transition-all cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-xl bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-[#FED7AA]">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Today's Follow-ups</span>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">{todaysCount} Follow-ups</h3>
            <p className="text-[9px] text-[#EA580C] font-bold mt-0.5">Click to view follow-up list →</p>
          </div>
        </div>

        {/* Card 2: Total Enquiry */}
        <div 
          onClick={() => router.push('/dashboard/enquiries')}
          className="bg-white border border-stone-200/80 p-4.5 rounded-2xl shadow-xs flex items-center gap-4 hover:border-[#F97316] hover:shadow-[0_8px_25px_rgba(249,115,22,0.12)] transition-all cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-xl bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-[#FED7AA]">
            <ClipboardList size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Total Enquiry</span>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">{enquiriesCount} Enquiries</h3>
            <p className="text-[9px] text-[#EA580C] font-bold mt-0.5">Click to view enquiry leads →</p>
          </div>
        </div>

        {/* Card 3: Expiring Soon Clients */}
        <div 
          onClick={() => router.push('/dashboard/expired')}
          className="bg-white border border-stone-200/80 p-4.5 rounded-2xl shadow-xs flex items-center gap-4 hover:border-[#F97316] hover:shadow-[0_8px_25px_rgba(249,115,22,0.12)] transition-all cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-xl bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-[#FED7AA]">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Expiring Soon Clients</span>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">{expiringSoonCount} Clients</h3>
            <p className="text-[9px] text-[#EA580C] font-bold mt-0.5">Click to view expiring list →</p>
          </div>
        </div>

        {/* Card 4: Today's Collection */}
        <div 
          onClick={() => router.push('/dashboard/billing')}
          className="bg-white border border-stone-200/80 p-4.5 rounded-2xl shadow-xs flex items-center gap-4 hover:border-[#F97316] hover:shadow-[0_8px_25px_rgba(249,115,22,0.12)] transition-all cursor-pointer group"
        >
          <div className="w-11 h-11 rounded-xl bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform border border-[#FED7AA]">
            <DollarSign size={20} />
          </div>
          <div>
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Today's Collection</span>
            <h3 className="text-xl font-black text-slate-900 mt-0.5">
              ₹{todaysCollection.toLocaleString('en-IN')}
            </h3>
            <p className="text-[9px] text-emerald-600 font-bold mt-0.5">Collected today →</p>
          </div>
        </div>
      </div>

      {/* ─── 3. SECONDARY OPERATIONS CARDS (ROW 2) ─── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full">
        {/* Card 1: Members Inside */}
        <div className="bg-white border border-stone-200/80 p-4 rounded-2xl shadow-xs flex flex-col justify-between min-h-[120px]">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Members Inside</span>
            <div className="w-6 h-6 rounded-full bg-[#FFF7ED] border border-[#FED7AA] flex items-center justify-center text-[#EA580C]">
              <ArrowUpRight size={12} />
            </div>
          </div>
          <div className="mt-2">
            <h3 className="text-2xl font-black text-slate-900 leading-none">
              {liveCount}
            </h3>
            <div className="h-1.5 bg-stone-100 rounded-full mt-2.5 overflow-hidden flex">
              <div className="h-full bg-gradient-to-r from-[#FB923C] to-[#EA580C]" style={{ width: `${Math.min(100, (liveCount / 50) * 100)}%` }} />
            </div>
            <div className="flex justify-between text-[9px] text-slate-400 font-bold mt-1.5">
              <span>Inside Now</span>
              <span>Cap 50</span>
            </div>
          </div>
        </div>

        {/* Card 2: Active Pass */}
        <div className="bg-white border border-stone-200/80 p-4 rounded-2xl shadow-xs flex flex-col justify-between min-h-[120px]">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Active Pass</span>
            <span className="text-[9px] bg-[#FFF7ED] text-[#EA580C] px-2 py-0.5 rounded-full font-black uppercase border border-[#FED7AA]">Gold</span>
          </div>
          <div className="mt-2 text-left">
            <h3 className="text-xl font-black text-slate-900 leading-none">
              {realtimeMembers ? realtimeMembers.filter(m => m.status === 'active').length : 0} Members
            </h3>
            
            <div className="flex items-center gap-1.5 mt-2.5">
              <div className="flex -space-x-2 overflow-hidden">
                {realtimeMembers ? realtimeMembers.slice(0, 4).map((m, idx) => (
                  <div 
                    key={idx} 
                    className="w-6 h-6 rounded-full border-2 border-white bg-gradient-to-br from-[#F97316] to-[#EA580C] text-white text-[8px] font-black flex items-center justify-center shadow-xs"
                  >
                    {getInitials(m.name)}
                  </div>
                )) : null}
              </div>
              {realtimeMembers && realtimeMembers.length > 4 && (
                <span className="text-[9px] bg-[#FFF7ED] text-[#EA580C] px-2 py-0.5 rounded-full font-black border border-[#FED7AA]">
                  +{realtimeMembers.length - 4}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Staff Live */}
        <div className="bg-white border border-stone-200/80 p-4 rounded-2xl shadow-xs flex flex-col justify-between min-h-[120px] text-xs font-semibold">
          <div className="flex justify-between items-center text-slate-400">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-1">
              Staff Live
            </span>
            <span className="text-[8px] bg-emerald-50 text-emerald-600 px-2 py-0.5 rounded-full font-black uppercase tracking-widest border border-emerald-100">
              Live
            </span>
          </div>
          
          <div className="mt-1.5 space-y-1 text-[9.5px]">
            {[
              { label: 'Trainers', inside: employees.filter(e => e.role === 'Trainer' && e.currentStatus === 'Inside').length, total: employees.filter(e => e.role === 'Trainer').length },
              { label: 'Reception', inside: employees.filter(e => e.role === 'Reception' && e.currentStatus === 'Inside').length, total: employees.filter(e => e.role === 'Reception').length },
              { label: 'Manager', inside: employees.filter(e => e.role === 'Manager' && e.currentStatus === 'Inside').length, total: employees.filter(e => e.role === 'Manager').length },
              { label: 'Cleaner', inside: employees.filter(e => e.role === 'Cleaner' && e.currentStatus === 'Inside').length, total: employees.filter(e => e.role === 'Cleaner').length }
            ].map((item, idx) => (
              <div key={idx} className="flex justify-between items-center">
                <span className="flex items-center gap-1.5 text-slate-500 font-bold">
                  <span className={`w-1.5 h-1.5 rounded-full ${item.inside > 0 ? 'bg-[#EA580C]' : 'bg-slate-300'}`} />
                  {item.label}
                </span>
                <span className="text-slate-800 font-black font-mono">
                  {item.inside}/{item.total}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-1.5 pt-1.5 border-t border-stone-100 flex justify-between items-center text-[9px]">
            <span className="text-slate-400 font-bold">Total Staff Inside</span>
            <span className="font-black text-slate-900 font-mono">
              {employees.filter(e => e.currentStatus === 'Inside').length}
            </span>
          </div>
        </div>

        {/* Card 4: Unlock Turnstile */}
        <button 
          onClick={handleManualUnlock}
          disabled={gateUnlocked}
          className="bg-white border-2 border-dashed border-[#FED7AA] hover:border-[#EA580C] hover:bg-[#FFF7ED] rounded-2xl p-4 flex flex-col items-center justify-center min-h-[120px] transition-all cursor-pointer group text-center"
        >
          <div className={`w-9 h-9 rounded-full border-2 border-dashed ${gateUnlocked ? 'bg-[#EA580C] border-[#EA580C] text-white' : 'border-[#EA580C]/40 text-[#EA580C] group-hover:bg-[#EA580C] group-hover:text-white'} flex items-center justify-center transition-all`}>
            {gateUnlocked ? <Unlock size={16} /> : <Plus size={16} />}
          </div>
          <span className="text-xs font-black uppercase tracking-wider text-slate-900 mt-2 block">
            {gateUnlocked ? 'Gate Unlocked' : 'Unlock Turnstile'}
          </span>
          <span className="text-[8px] text-slate-400 font-bold mt-0.5">Hikvision DS-K1T320EFWX</span>
        </button>
      </div>

      {/* ─── 4. ATTENDANCE CALENDAR & STAFF ATTENDANCE ─── */}
      <AttendanceCalendarSection
        memberAttendanceLogs={(memberAttendance && memberAttendance.length > 0) ? memberAttendance : (attendance || [])}
        employeeAttendanceLogs={empAttendance || []}
        employeesList={employees || []}
        membersList={realtimeMembers || members || []}
      />

    </div>
  );
}
