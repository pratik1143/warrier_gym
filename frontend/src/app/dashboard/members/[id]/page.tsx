'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Edit3, Shield, Activity, Droplets, Calendar,
  Clock, DollarSign, MessageSquare, Phone, Mail, Printer, Download,
  Trash2, Snowflake, Repeat, Sparkles, AlertCircle, Bell, ChevronRight, Camera, User, Dumbbell,
  MoreVertical, CheckCircle2, MapPin, Heart, Timer, CreditCard, Plus
} from 'lucide-react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, collection, query, where, updateDoc } from 'firebase/firestore';
import toast from '@/lib/toast';
import { membershipEngine } from '@/lib/engines/membershipEngine';
import { paymentEngine } from '@/lib/engines/paymentEngine';
import { calculateRealAttendance } from '@/lib/utils';
import API from '@/services/api';
import { useGymStore } from '@/store';
import MemberAvatar from '../../components/MemberAvatar';
import SmartPhotoCapture from '../../components/SmartPhotoCapture';
import RenewalWizardModal from '../components/RenewalWizardModal';
import TrainerSelectorDropdown from '../components/TrainerSelectorDropdown';
import PtBillingModal from '../components/PtBillingModal';
import CreateNewBillModal from '../components/CreateNewBillModal';

// Tabs
import ProfileTab from './components/ProfileTab';
import BillingTab from './components/BillingTab';
import CommunicationTab from './components/CommunicationTab';
import AttendanceTab, { buildAttendanceSessions } from './components/AttendanceTab';

const TABS = [
  'Profile', 'Billing', 'Communication', 'Attendance'
];

export default function ClientProfileSystem() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const rawId = params?.id as string;
  const id = rawId ? decodeURIComponent(rawId) : '';

  const [activeTab, setActiveTab] = useState('Profile');
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [memberInvoices, setMemberInvoices] = useState<any[]>([]);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [showRenewalModal, setShowRenewalModal] = useState(false);
  const [showPtModal, setShowPtModal] = useState(false);
  const [showCreateBillModal, setShowCreateBillModal] = useState(false);
  const [showQuickMenu, setShowQuickMenu] = useState(false);
  const quickMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (quickMenuRef.current && !quickMenuRef.current.contains(e.target as Node)) {
        setShowQuickMenu(false);
      }
    };
    if (showQuickMenu) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showQuickMenu]);

  useEffect(() => {
    if (searchParams && searchParams.get('renew') === 'true') {
      setShowRenewalModal(true);
    }
  }, [searchParams]);

  const handleSavePhoto = async (photoUrl: string) => {
    if (!member) return;
    const targetMemberId = member.id || member.uid || member.docId || id;
    try {
      // Direct API update via Firebase Admin SDK to bypass client permission rules 100%
      await API.put(`/members/${targetMemberId}`, {
        photo: photoUrl,
        avatarUrl: photoUrl,
        avatar: photoUrl,
        updatedAt: new Date().toISOString()
      });

      setMember((prev: any) => ({ ...prev, photo: photoUrl, avatarUrl: photoUrl, avatar: photoUrl }));
      toast.success(`${member.name || 'Member'} profile photo updated successfully!`);
      setShowPhotoModal(false);
      useGymStore.getState().fetchMembers();
    } catch (err: any) {
      console.error('Error saving photo via API, trying client fallback:', err);
      try {
        await updateDoc(doc(db, 'members', targetMemberId), {
          photo: photoUrl,
          avatarUrl: photoUrl,
          avatar: photoUrl,
          updatedAt: new Date().toISOString()
        });
        setMember((prev: any) => ({ ...prev, photo: photoUrl, avatarUrl: photoUrl, avatar: photoUrl }));
        toast.success(`${member.name || 'Member'} profile photo updated successfully!`);
        setShowPhotoModal(false);
        useGymStore.getState().fetchMembers();
      } catch (fErr: any) {
        toast.error('Failed to update photo: ' + (fErr.message || err.message));
      }
    }
  };

  const [realAttendanceCount, setRealAttendanceCount] = useState<number>(0);

  // ── Real-time listener for member attendance sessions ───────────
  useEffect(() => {
    if (!id && !member) return;
    let isMounted = true;

    const docId = String(member?.id || member?.uid || member?.memberId || id || '').trim();
    const memberCode = String(member?.memberId || member?.clientId || '').trim();
    const bioId = String(member?.biometricId || member?.deviceUserId || member?.bioId || '').trim();
    const phone = member?.phone ? String(member.phone).replace(/\D/g, '').slice(-10) : '';

    const unsub = onSnapshot(collection(db, 'attendance'), (snap) => {
      if (!isMounted) return;
      const rawLogs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      const memberLogs = rawLogs.filter((log: any) => {
        if (!log) return false;
        const lMemberId = String(log.memberId || log.memberCode || log.uid || '').trim();
        const lBioId = String(log.biometricId || log.deviceUserId || log.bioId || '').trim();
        const lPhone = log.phone ? String(log.phone).replace(/\D/g, '').slice(-10) : '';

        if (docId && lMemberId && docId === lMemberId) return true;
        if (memberCode && lMemberId && memberCode === lMemberId) return true;
        if (bioId && lBioId && bioId === lBioId) return true;
        if (phone && lPhone && phone === lPhone) return true;
        return false;
      });

      const sessions = buildAttendanceSessions(memberLogs);
      setRealAttendanceCount(sessions.length);
    }, (error) => {
      console.warn("Member attendance count snapshot notice:", error.message);
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [id, member]);

  // ── ENGINE DERIVED VALUES (Single Source of Truth) ──────────────
  const isHold = String(member?.status || '').trim().toUpperCase() === 'HOLD';
  const effectiveAttendanceCount = isHold ? 0 : (realAttendanceCount || Number(member?.attendanceCount) || 0);
  const daysLeft       = isHold || !member?.expiryDate ? 0 : membershipEngine.calculateDaysLeft(member.expiryDate);
  const riskLevel      = isHold ? 'none' : membershipEngine.calculateRenewalRisk(daysLeft);
  const attendancePct  = isHold || !member ? 0 : calculateRealAttendance(member.joinDate, effectiveAttendanceCount);
  const healthScore    = isHold ? 0 : membershipEngine.calculateHealthScore(daysLeft, attendancePct);

  // Payment totals from invoices (Single Source of Truth)
  const isMemberPaid = !isHold && (member?.paymentStatus === 'paid' || (Number(member?.totalPaid) > 0 && member?.totalPaid >= member?.totalBilled));
  const totalInvoiced = isHold ? 0 : memberInvoices.reduce((s, inv) => s + (Number(inv.amount) || 0) + (Number(inv.gst) || 0), 0);
  const totalPaid = isHold ? 0 : (isMemberPaid 
    ? (totalInvoiced || Number(member?.totalPaid) || Number(member?.price) || Number(member?.amount) || 0)
    : memberInvoices.reduce((s, inv) => {
        if (inv.status === 'paid' || inv.paymentStatus === 'paid') {
          return s + (Number(inv.amount) || 0) + (Number(inv.gst) || 0);
        }
        return s + (Number(inv.paid) || Number(inv.amount) || 0);
      }, 0));

  const rawOutstanding = isHold ? 0 : (isMemberPaid ? 0 : paymentEngine.calculateOutstandingAmount(totalInvoiced, totalPaid));
  const outstanding = Math.max(0, rawOutstanding);
  const payStatus = isHold ? 'NO INVOICES' : (isMemberPaid ? 'PAID' : (outstanding <= 0 && totalInvoiced > 0 ? 'PAID' : (totalInvoiced === 0 ? 'NO INVOICES' : paymentEngine.calculatePaymentStatus(totalInvoiced, totalPaid))));

  // ── SELF HEAL & FALLBACK member fetch ───────────────────────────
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    let isMounted = true;

    const fetchFallbackMember = async () => {
      try {
        const res = await API.get(`/members/${id}`);
        if (res.data && isMounted) {
          setMember(res.data);
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn('API single member fetch failed, checking local store:', e);
      }

      const storeMembers = useGymStore.getState().members;
      const foundInStore = storeMembers.find((m: any) => m.id === id || m.uid === id || m.memberId === id);
      if (isMounted) {
        setMember(foundInStore || null);
        setLoading(false);
      }
    };

    const unsub = onSnapshot(doc(db, 'members', id), (d) => {
      if (!isMounted) return;
      if (d.exists()) {
        let m: any = { id: d.id, ...d.data() };
        const isHoldMemberDoc = String(m?.status || '').trim().toUpperCase() === 'HOLD';
        if (!isHoldMemberDoc && m.plan && (!m.expiryDate || m.expiryDate === m.joinDate || m.expiryDate === new Date().toISOString().split('T')[0])) {
          const rawJoin = m.joinDate || m.createdAt;
          const corrected = membershipEngine.calculatePlanExpiryDate(m.plan, rawJoin);
          if (corrected > (m.expiryDate || '')) {
            m.expiryDate = corrected;
            membershipEngine.selfHealMemberData(m);
          }
        }
        setMember(m);
        setLoading(false);
      } else {
        fetchFallbackMember();
      }
    }, (error) => {
      if (error?.code !== 'permission-denied' && !error?.message?.includes('permissions')) {
        console.warn("Member profile snapshot notice:", error.message);
      }
      if (isMounted) fetchFallbackMember();
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [id]);

  // ── Real-time listener for invoices with API Fallback ───────────
  useEffect(() => {
    if (!id) return;
    let isMounted = true;

    const fetchFallbackInvoices = async () => {
      try {
        const res = await API.get(`/billing?memberId=${id}`);
        const list = res.data || [];
        if (isMounted) setMemberInvoices(list);
      } catch (e) {
        console.warn('API fallback invoices fetch failed:', e);
      }
    };

    const unsub = onSnapshot(collection(db, 'payments'), (snap) => {
      if (!isMounted) return;
      const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      const candidateIds = new Set([id, member?.id, member?.memberId, member?.uid].filter(Boolean));
      const cleanPhone = (member?.phone || '').replace(/\D/g, '');
      const filtered = allDocs.filter((p: any) => {
        if (!p) return false;
        if (p.memberId && candidateIds.has(p.memberId)) return true;
        if (p.memberPhone && cleanPhone && p.memberPhone.replace(/\D/g, '') === cleanPhone) return true;
        return false;
      });
      setMemberInvoices(filtered);
    }, (error) => {
      console.warn("Member invoices snapshot error:", error.message);
      if (isMounted) fetchFallbackInvoices();
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-6 flex flex-col gap-6">
        <div className="h-40 bg-white rounded-[24px] shadow-sm animate-pulse" />
        <div className="h-14 bg-white rounded-[16px] shadow-sm animate-pulse" />
        <div className="flex gap-6">
          <div className="flex-1 h-[600px] bg-white rounded-[24px] shadow-sm animate-pulse" />
          <div className="w-[300px] h-[600px] bg-white rounded-[24px] shadow-sm animate-pulse" />
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-[500px] bg-white rounded-[24px] shadow-sm border border-slate-100 p-12 flex flex-col items-center justify-center text-center my-6">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
          <User size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Member Profile Not Found</h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          The requested member record (<code className="bg-slate-100 px-2 py-1 rounded text-slate-700 font-mono text-xs">{id}</code>) could not be located.
        </p>
        <button
          onClick={() => router.push('/dashboard/members')}
          className="px-6 py-3 bg-[#0066FF] text-white rounded-xl text-xs font-bold hover:bg-orange-700 transition-all flex items-center gap-2 cursor-pointer shadow-md"
        >
          <ArrowLeft size={16} /> Return to Members
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 sm:p-6 font-sans pb-32">
      {/* ══ PREMIUM MEMBER COMMAND CENTER HERO CARD ════════════════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="bg-white rounded-[22px] border border-slate-200/90 shadow-[0_4px_24px_rgba(234,88,12,0.05)] mb-5 overflow-hidden relative"
      >
        {/* Subtle top brand accent stripe */}
        <div className="h-1 w-full bg-gradient-to-r from-[#0066FF] via-[#38bdf8] to-[#10b981]" />

        <div className="p-4 sm:p-5 lg:p-6 space-y-4">
          
          {/* ── TOP BAR: BACK NAVIGATION & MEMBER ID ── */}
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => router.push('/dashboard/members')}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#0066FF] bg-transparent border-none cursor-pointer transition-colors group"
            >
              <ArrowLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
              Back to Members
            </button>

            <span className="text-[11px] font-mono font-black text-indigo-600 bg-indigo-50 border border-indigo-200/70 px-2 py-0.5 rounded-lg">
              #{member.clientId || member.memberId || member.id}
            </span>
          </div>

          {/* ── MAIN HERO BODY (IDENTITY + MEMBERSHIP CARD) ── */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
            
            {/* ── ZONE 1: IDENTITY (Span 7) ── */}
            <div className="lg:col-span-7 flex flex-col sm:flex-row items-start sm:items-center gap-4.5 min-w-0">
              {/* Photo Avatar */}
              <div
                onClick={() => setShowPhotoModal(true)}
                className="relative shrink-0 cursor-pointer group"
                title="Click to update profile photo"
              >
                <div className="w-[88px] h-[88px] sm:w-[100px] sm:h-[100px] rounded-[20px] overflow-hidden border-2 border-white shadow-[0_4px_16px_rgba(15,23,42,0.12)] bg-slate-100 ring-2 ring-slate-100 group-hover:ring-[#0066FF] transition-all">
                  <MemberAvatar member={member} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" size={100} />
                </div>
                <div className="absolute inset-0 rounded-[20px] bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                  <Camera size={20} className="text-white drop-shadow" />
                </div>
                {/* Active status indicator dot with soft glow */}
                <span className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white flex items-center justify-center shadow-xs ${
                  isHold ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]' : daysLeft > 7 ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : daysLeft > 0 ? 'bg-amber-500' : 'bg-rose-500'
                }`} />
              </div>

              {/* Member Details */}
              <div className="flex-1 min-w-0 space-y-1.5">
                {/* Name + Status Badge */}
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-tight truncate">
                    {member.name || 'Member'}
                  </h1>
                  {isHold ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11px] font-black border bg-amber-50 text-amber-800 border-amber-300">
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                      HOLD
                    </span>
                  ) : (
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                      member.isFrozen || member.status === 'frozen'
                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                        : daysLeft > 7
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : daysLeft > 0
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        member.isFrozen || member.status === 'frozen'
                          ? 'bg-sky-500'
                          : daysLeft > 7
                            ? 'bg-emerald-500 animate-pulse'
                            : daysLeft > 0
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                      }`} />
                      {member.isFrozen || member.status === 'frozen'
                        ? 'Frozen'
                        : daysLeft > 7
                          ? 'Active'
                          : daysLeft > 0
                            ? 'Expiring Soon'
                            : 'Expired'}
                    </span>
                  )}
                </div>

                {/* Secondary Metadata */}
                {isHold ? (
                  <div className="flex items-center gap-3 text-xs font-bold text-slate-600 flex-wrap">
                    <span className="inline-flex items-center gap-1 text-slate-800 font-mono">
                      Biometric ID: {member.biometricId || member.biometricUserId || member.deviceUserId || '—'}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="inline-flex items-center gap-1">
                      Hikvision Mapping:{' '}
                      {member.hikvisionMapped ? (
                        <span className="text-emerald-700 font-bold flex items-center gap-0.5">✓ Mapped</span>
                      ) : (
                        <span className="text-slate-500 font-medium">Not Mapped</span>
                      )}
                    </span>
                    {member.phone && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="inline-flex items-center gap-1 text-slate-700">
                          <Phone size={12} className="text-slate-400" />
                          {member.phone}
                        </span>
                      </>
                    )}
                    {member.email && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500 truncate max-w-[180px]">{member.email}</span>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 flex-wrap">
                    {member.phone && (
                      <span className="inline-flex items-center gap-1 text-slate-700">
                        <Phone size={12} className="text-slate-400" />
                        {member.phone}
                      </span>
                    )}
                    {member.phone && <span className="text-slate-300">·</span>}
                    <span className="inline-flex items-center gap-1 text-slate-600">
                      <MapPin size={12} className="text-slate-400" />
                      {member.branch || 'Mohali, Punjab'}
                    </span>
                    {member.email && (
                      <>
                        <span className="text-slate-300">·</span>
                        <span className="text-slate-500 truncate max-w-[180px]">{member.email}</span>
                      </>
                    )}
                  </div>
                )}

                {/* Assigned Trainer Dropdown (Only for non-hold members) */}
                {!isHold && (
                  <div className="pt-0.5">
                    <TrainerSelectorDropdown
                      member={member}
                      onTrainerUpdated={({ trainerId, trainerName, trainerRole, trainerAvatar }) => {
                        setMember((prev: any) => ({ ...prev, trainerId, trainerName, trainer: trainerName, trainerRole, trainerAvatar }));
                      }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* ── ZONE 2: MEMBERSHIP CARD BLOCK (Span 5) ── */}
            {isHold ? (
              <div className="lg:col-span-5 bg-gradient-to-br from-amber-50/90 to-orange-50/50 border border-amber-200/90 rounded-2xl p-5 flex flex-col justify-between gap-3 shadow-xs">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-900/70">Membership</span>
                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-amber-100/80 text-amber-800 border border-amber-300/80">
                      Awaiting Billing
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900 mt-2">No active membership</h3>
                  <p className="text-xs text-slate-600 mt-1">This member is waiting for membership billing.</p>
                </div>
                <button
                  onClick={() => setShowCreateBillModal(true)}
                  className="w-full py-2.5 px-4 bg-[#EA580C] hover:bg-orange-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm border-none cursor-pointer active:scale-[0.98]"
                >
                  <Plus size={14} /> + CREATE BILL
                </button>
              </div>
            ) : (
              <div className="lg:col-span-5 bg-slate-50/90 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between gap-2.5">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Membership</span>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Expires</span>
                  </div>

                  <div className="flex items-baseline justify-between gap-2 mt-0.5">
                    <div className="flex items-baseline gap-2">
                      <span className="text-base sm:text-lg font-black text-slate-900 tracking-tight">{member.plan || 'Membership'}</span>
                      {(member.amount || member.price || member.totalBilled) && (
                        <span className="text-sm font-extrabold text-[#0066FF]">
                          ₹{Number(member.amount || member.price || member.totalBilled || 0).toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-slate-800 shrink-0">
                      {member.expiryDate
                        ? new Date(member.expiryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </span>
                  </div>
                </div>

                {/* Dynamic Progress Bar */}
                {(() => {
                  const totalDays = (() => {
                    const plan = String(member.plan || '').toLowerCase();
                    if (plan.includes('annual') || plan.includes('yearly') || plan.includes('12')) return 365;
                    if (plan.includes('6') || plan.includes('semi')) return 180;
                    if (plan.includes('3') || plan.includes('quarter')) return 90;
                    if (plan.includes('2')) return 60;
                    return 30;
                  })();
                  const pct = totalDays > 0 ? Math.max(0, Math.min(100, (daysLeft / totalDays) * 100)) : 0;
                  const barColor = daysLeft > 14 ? '#10b981' : daysLeft > 7 ? '#f59e0b' : '#ef4444';
                  return (
                    <div className="space-y-1.5">
                      <div className="h-2 bg-slate-200/80 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, backgroundColor: barColor }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-bold">
                        <span className={daysLeft > 0 ? 'text-slate-600' : 'text-rose-600'}>
                          {daysLeft > 0 ? `${daysLeft} days remaining` : 'Membership Expired'}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          payStatus === 'PAID'
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {payStatus === 'PAID' ? '✓ Fully Paid' : `₹${outstanding.toLocaleString('en-IN')} Due`}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          {/* ── ROW 2: METRICS STRIP + ACTION BUTTONS ── */}
          <div className="flex flex-col xl:flex-row items-stretch xl:items-center justify-between gap-3.5 pt-2 border-t border-slate-100">
            
            {/* 4-Metric Compact Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 bg-slate-50/80 border border-slate-200/80 rounded-2xl p-1 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/70 flex-1">
              {(isHold ? [
                {
                  label: 'STATUS',
                  value: 'HOLD',
                  color: '#d97706',
                  icon: '🟠',
                },
                {
                  label: 'BIOMETRIC ID',
                  value: member.biometricId || member.biometricUserId || member.deviceUserId || '—',
                  color: '#0f172a',
                  icon: '🆔',
                },
                {
                  label: 'HIKVISION',
                  value: member.hikvisionMapped ? 'Connected' : 'Not Mapped',
                  color: member.hikvisionMapped ? '#10b981' : '#64748b',
                  icon: '📡',
                },
                {
                  label: 'BILLING',
                  value: 'No Invoices',
                  color: '#d97706',
                  icon: '💳',
                },
              ] : [
                {
                  label: 'HEALTH SCORE',
                  value: `${Math.max(0, 100 - healthScore)}%`,
                  color: healthScore < 40 ? '#10b981' : healthScore < 70 ? '#f59e0b' : '#ef4444',
                  icon: '❤️',
                },
                {
                  label: 'ATTENDANCE',
                  value: `${attendancePct}%`,
                  color: attendancePct > 60 ? '#10b981' : attendancePct > 30 ? '#f59e0b' : '#64748b',
                  icon: '📅',
                },
                {
                  label: 'DAYS LEFT',
                  value: daysLeft > 0 ? String(daysLeft) : '0',
                  color: daysLeft > 14 ? '#0066FF' : daysLeft > 0 ? '#f59e0b' : '#ef4444',
                  icon: '⏱',
                },
                {
                  label: 'PAYMENT',
                  value: payStatus === 'PAID' ? 'PAID' : (payStatus === 'NO INVOICES' ? 'NO INVOICE' : 'DUE'),
                  color: payStatus === 'PAID' ? '#10b981' : '#f59e0b',
                  icon: '💳',
                },
              ]).map(m => (
                <div key={m.label} className="px-3.5 py-2 flex items-center gap-2.5">
                  <span className="text-base leading-none select-none">{m.icon}</span>
                  <div className="min-w-0">
                    <div className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 leading-tight truncate">{m.label}</div>
                    <div className="text-sm sm:text-base font-black leading-tight mt-0.5 truncate" style={{ color: m.color }}>{m.value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Buttons Group */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
              {isHold ? (
                <button
                  onClick={() => setShowCreateBillModal(true)}
                  className="flex-1 sm:flex-none h-11 px-5 bg-[#EA580C] hover:bg-orange-700 text-white rounded-xl flex items-center justify-center gap-1.5 text-xs font-black transition-all cursor-pointer shadow-sm hover:shadow-[0_4px_12px_rgba(234,88,12,0.3)] active:scale-[0.98] border-none"
                  title="Create Membership & Bill"
                >
                  <Plus size={15} /> + Create Membership & Bill
                </button>
              ) : (
                <button
                  onClick={() => setShowPtModal(true)}
                  className="flex-1 sm:flex-none h-11 px-4 bg-[#0066FF] hover:bg-orange-700 text-white rounded-xl flex items-center justify-center gap-1.5 text-xs font-black transition-all cursor-pointer shadow-xs hover:shadow-[0_4px_12px_rgba(0,102,255,0.3)] active:scale-[0.98] border-none"
                  title="Add Personal Training Bill"
                >
                  <Dumbbell size={14} /> + Add PT Bill
                </button>
              )}

              <button
                onClick={() => {
                  const rawPhone = (member.phone || '').replace(/\D/g, '');
                  const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
                  if (cleanPhone) window.open(`https://wa.me/${cleanPhone}`, '_blank');
                  else toast.error('No valid phone number for WhatsApp');
                }}
                className="flex-1 sm:flex-none h-11 px-4 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
                title="Send WhatsApp Message"
              >
                <MessageSquare size={14} /> WhatsApp
              </button>

              <button
                onClick={() => {
                  if (member.phone) window.location.href = `tel:${member.phone}`;
                  else toast.error('No phone number recorded');
                }}
                className="flex-1 sm:flex-none h-11 px-4 bg-[#FFF7ED] hover:bg-orange-100 text-[#0066FF] border border-[#FED7AA] rounded-xl flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
                title="Call Member"
              >
                <Phone size={14} /> Call
              </button>

              {/* Quick Action Dropdown Menu (⋮) */}
              <div className="relative" ref={quickMenuRef}>
                <button
                  onClick={() => setShowQuickMenu(!showQuickMenu)}
                  className="h-11 w-11 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl flex items-center justify-center transition-all cursor-pointer shadow-2xs active:scale-[0.98]"
                  title="More Options"
                >
                  <MoreVertical size={16} />
                </button>

                {showQuickMenu && (
                  <div className="absolute right-0 bottom-full mb-2 sm:bottom-auto sm:top-full sm:mt-2 w-52 bg-white border border-slate-200 rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95">
                    <button
                      onClick={() => { setShowQuickMenu(false); setShowPhotoModal(true); }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-700 transition-colors border-none bg-transparent cursor-pointer"
                    >
                      <Camera size={13} className="text-slate-400" /> Change Photo
                    </button>
                    {isHold ? (
                      <button
                        onClick={() => { setShowQuickMenu(false); setShowCreateBillModal(true); }}
                        className="w-full px-3 py-2 text-left hover:bg-orange-50 rounded-xl flex items-center gap-2 text-xs font-bold text-[#EA580C] transition-colors border-none bg-transparent cursor-pointer"
                      >
                        <Plus size={13} /> Create Membership & Bill
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => { setShowQuickMenu(false); setShowRenewalModal(true); }}
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-700 transition-colors border-none bg-transparent cursor-pointer"
                        >
                          <Repeat size={13} className="text-[#EA580C]" /> Renew Membership
                        </button>
                        <button
                          onClick={() => { setShowQuickMenu(false); setShowPtModal(true); }}
                          className="w-full px-3 py-2 text-left hover:bg-slate-50 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-700 transition-colors border-none bg-transparent cursor-pointer"
                        >
                          <Dumbbell size={13} className="text-indigo-600" /> Add PT Bill
                        </button>
                      </>
                    )}
                    <div className="border-t border-slate-100 my-1" />
                    <button
                      onClick={() => { setShowQuickMenu(false); setActiveTab('Billing'); }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-700 transition-colors border-none bg-transparent cursor-pointer"
                    >
                      <DollarSign size={13} className="text-emerald-600" /> View Billing
                    </button>
                    <button
                      onClick={() => { setShowQuickMenu(false); setActiveTab('Communication'); }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-700 transition-colors border-none bg-transparent cursor-pointer"
                    >
                      <MessageSquare size={13} className="text-amber-600" /> Follow-Up Logs
                    </button>
                    <button
                      onClick={() => { setShowQuickMenu(false); setActiveTab('Attendance'); }}
                      className="w-full px-3 py-2 text-left hover:bg-slate-50 rounded-xl flex items-center gap-2 text-xs font-bold text-slate-700 transition-colors border-none bg-transparent cursor-pointer"
                    >
                      <Calendar size={13} className="text-purple-600" /> Attendance Tab
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
      {/* ══ END HERO CARD ══════════════════════════════════════════════════ */}

      {/* 2. PROFILE NAVIGATION (Segmented Tabs) */}
      <div className="flex items-center gap-2 overflow-x-auto pb-5 scrollbar-hide">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all whitespace-nowrap cursor-pointer border ${
              activeTab === tab
                ? 'bg-[#FFF7ED] text-[#0066FF] border-[#FED7AA] shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200/80 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 3. MAIN CONTENT (FULL-WIDTH FOR ALL TABS) */}
      <div className="w-full">
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
            {activeTab === 'Profile' && <ProfileTab member={member} onOpenCreateBill={() => setShowCreateBillModal(true)} />}
            {activeTab === 'Billing' && <BillingTab member={member} onOpenCreateBill={() => setShowCreateBillModal(true)} />}
            {activeTab === 'Communication' && <CommunicationTab member={member} />}
            {activeTab === 'Attendance' && <AttendanceTab member={member} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── PHOTO UPLOAD & CAPTURE MODAL ── */}
      <AnimatePresence>
        {showPhotoModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 max-w-md w-full relative space-y-4 text-slate-900 z-10"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Camera size={20} className="text-[#EA580C]" />
                  <h3 className="font-extrabold text-slate-900 text-lg">Upload Member Profile Photo</h3>
                </div>
                <button
                  onClick={() => setShowPhotoModal(false)}
                  className="text-slate-400 hover:text-slate-700 bg-transparent border-none cursor-pointer p-1"
                >
                  ✕
                </button>
              </div>

              <SmartPhotoCapture
                value={member?.photo || member?.avatarUrl || member?.avatar || undefined}
                onCaptureComplete={(urls) => handleSavePhoto(urls.photoURL)}
                label={member?.name || 'Member'}
              />

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowPhotoModal(false)}
                  className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs border-none cursor-pointer"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── RENEWAL WIZARD MODAL ── */}
      <RenewalWizardModal
        isOpen={showRenewalModal}
        member={member}
        onClose={() => setShowRenewalModal(false)}
      />

      {/* ── PT BILLING MODAL ── */}
      <PtBillingModal
        isOpen={showPtModal}
        member={member}
        onClose={() => setShowPtModal(false)}
        onSuccess={(updatedMem: any) => {
          if (updatedMem) setMember({ ...updatedMem });
          useGymStore.getState().fetchMembers();
          useGymStore.getState().fetchPayments();
        }}
      />
    </div>
  );
}
