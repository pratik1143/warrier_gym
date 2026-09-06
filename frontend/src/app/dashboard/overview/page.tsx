"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore, useGymStore } from "@/store";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import {
  UserPlus, Coins, Wallet, Dumbbell, IndianRupee,
  MessageSquare, UserMinus, CalendarCheck, PhoneCall,
  UserCheck, Users, Activity,
  Fingerprint, BarChart3,
  X, CheckCircle2, Sparkles, AlertCircle, Info
} from "lucide-react";
import { useRouter } from "next/navigation";
import toast from '@/lib/toast';
import API from "@/services/api";

import FinancialAnalytics from "./components/FinancialAnalytics";
import PresentMembersModal from "./components/PresentMembersModal";
import { useFollowups } from "@/hooks/useFollowups";
import { SYSTEM_START_DATE, SYSTEM_CONFIG } from "@/config/system";
import { useTodaysPayments } from "@/hooks/useTodaysPayments";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, delay, ease: "easeOut" as const },
});

export default function OverviewCommandCenter() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { followups, todaysCount, createFollowup } = useFollowups();
  const {
    members, fetchMembers, fetchPayments,
    attendance,
  } = useGymStore();

  // Live payment data — single source of truth
  const { todaysTotal: todaysRealCollection, allPayments } = useTodaysPayments();
  // alias for range/PT analytics that use the full payment list
  const payments = allPayments;

  // Helper to format date in YYYY-MM-DD in Asia/Kolkata timezone
  const getLocalDateStr = (d: Date = new Date()) => {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: SYSTEM_CONFIG.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(d);
  };

  const todayStr = useMemo(() => getLocalDateStr(new Date()), []);

  const yesterdayStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return getLocalDateStr(d);
  }, []);

  const sevenDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return getLocalDateStr(d);
  }, []);

  const thirtyDaysAgoStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return getLocalDateStr(d);
  }, []);

  const monthStartStr = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    return getLocalDateStr(d);
  }, []);

  // Filter Dates State
  const [fromDate, setFromDate] = useState(todayStr);
  const [toDate, setToDate] = useState(todayStr);
  const [dateRange, setDateRange] = useState<string>("Today");
  const [enquiries, setEnquiries] = useState<any[]>([]);

  // Modal States
  const [showNewEnquiryModal, setShowNewEnquiryModal] = useState(false);
  const [showNewFollowupModal, setShowNewFollowupModal] = useState(false);
  const [showNewMemberModal, setShowNewMemberModal] = useState(false);
  const [showPresentModal, setShowPresentModal] = useState(false);

  // New Enquiry Form State
  const [enqName, setEnqName] = useState('');
  const [enqPhone, setEnqPhone] = useState('');
  const [enqSource, setEnqSource] = useState('Walk-in');
  const [enqPlan, setEnqPlan] = useState('Monthly Standard');
  const [enqDate, setEnqDate] = useState(todayStr);
  const [enqRemarks, setEnqRemarks] = useState('');
  const [enqSaving, setEnqSaving] = useState(false);

  // New Followup Form State
  const [folSourceType, setFolSourceType] = useState<'member' | 'enquiry'>('member');
  const [folSelectedId, setFolSelectedId] = useState('');
  const [folTitle, setFolTitle] = useState('');
  const [folDate, setFolDate] = useState(todayStr);
  const [folTime, setFolTime] = useState('10:00');
  const [folPriority, setFolPriority] = useState<'High' | 'Medium' | 'Low'>('Medium');
  const [folSaving, setFolSaving] = useState(false);

  // New Member Form State
  const [memName, setMemName] = useState('');
  const [memPhone, setMemPhone] = useState('');
  const [memPlan, setMemPlan] = useState('3 Months');
  const [memPaid, setMemPaid] = useState('6500');
  const [memMethod, setMemMethod] = useState('UPI');
  const [memSaving, setMemSaving] = useState(false);

  // Quick preset button click handler (Syncs both state and calendar inputs)
  const handleSelectPreset = (preset: "Today" | "Yesterday" | "7 Days" | "30 Days" | "Month") => {
    setDateRange(preset);
    if (preset === "Today") {
      setFromDate(todayStr);
      setToDate(todayStr);
    } else if (preset === "Yesterday") {
      setFromDate(yesterdayStr);
      setToDate(yesterdayStr);
    } else if (preset === "7 Days") {
      setFromDate(sevenDaysAgoStr);
      setToDate(todayStr);
    } else if (preset === "30 Days") {
      setFromDate(thirtyDaysAgoStr);
      setToDate(todayStr);
    } else if (preset === "Month") {
      setFromDate(monthStartStr);
      setToDate(todayStr);
    }
  };

  // Calendar date input change handler
  const handleDateInputChange = (newFrom: string, newTo: string) => {
    setFromDate(newFrom);
    setToDate(newTo);

    if (newFrom === todayStr && newTo === todayStr) {
      setDateRange("Today");
    } else if (newFrom === yesterdayStr && newTo === yesterdayStr) {
      setDateRange("Yesterday");
    } else if (newFrom === sevenDaysAgoStr && newTo === todayStr) {
      setDateRange("7 Days");
    } else if (newFrom === thirtyDaysAgoStr && newTo === todayStr) {
      setDateRange("30 Days");
    } else if (newFrom === monthStartStr && newTo === todayStr) {
      setDateRange("Month");
    } else {
      setDateRange("Custom");
    }
  };

  // Greeting helper
  const getGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  };

  // Fetch enquiries on mount
  useEffect(() => {
    API.get('/enquiries').then(res => {
      if (Array.isArray(res.data)) setEnquiries(res.data);
    }).catch(() => {});
  }, []);

  // Query Bounds clamped to SYSTEM_START_DATE (2026-08-23) and todayStr (no future data)
  const queryBounds = useMemo(() => {
    const s = fromDate || todayStr;
    const e = toDate || todayStr;
    const effectiveStart = s > SYSTEM_START_DATE ? s : SYSTEM_START_DATE;
    const effectiveEnd = e < todayStr ? e : todayStr;
    // Data exists only if the query window overlaps with [SYSTEM_START_DATE, todayStr]
    const hasData = e >= SYSTEM_START_DATE && s <= todayStr && effectiveStart <= effectiveEnd;

    return {
      requestedStart: s,
      requestedEnd: e,
      effectiveStart,
      effectiveEnd,
      hasData
    };
  }, [fromDate, toDate, todayStr]);

  // TODAY'S COLLECTION is now provided by useTodaysPayments hook above (live Firestore listener)

  // 2. PRESENT TODAY (Unique member attendance for today)
  const presentTodayCount = useMemo(() => {
    const uniqueMembers = new Set<string>();
    attendance.forEach((a: any) => {
      if (!a) return;
      const checkInDate = String(a.checkIn || a.timestamp || a.createdAt || '').split('T')[0];
      if (checkInDate === todayStr) {
        const mKey = a.memberId || a.biometricId || a.deviceUserId || a.memberName;
        if (mKey && String(mKey).trim() && !String(mKey).includes('unmapped')) {
          uniqueMembers.add(String(mKey).trim().toLowerCase());
        }
      }
    });
    return uniqueMembers.size;
  }, [attendance, todayStr]);

  // 3. ACTIVE MEMBERS (Current active members count - does NOT fluctuate with date filter)
  const activeMembersCount = useMemo(() => {
    return members.filter((m: any) => {
      if (!m) return false;
      if (m.status === 'frozen' || m.status === 'Frozen' || m.status === 'blocked' || m.status === 'Blocked') return false;
      return m.status === 'active' || m.status === 'Active' || (m.expiryDate && m.expiryDate >= todayStr);
    }).length;
  }, [members, todayStr]);

  // 4. EXPIRED MEMBERS
  const expiredMembersCount = useMemo(() => {
    return members.filter((m: any) => {
      if (!m) return false;
      if (m.status === 'frozen' || m.status === 'Frozen' || m.status === 'blocked' || m.status === 'Blocked') return false;
      return m.status === 'expired' || m.status === 'Expired' || (m.expiryDate && m.expiryDate < todayStr);
    }).length;
  }, [members, todayStr]);

  // 5. FILTERED RANGE COLLECTION (Strict real database records only)
  const filteredRangeCollection = useMemo(() => {
    if (!queryBounds.hasData) return 0;
    const seen = new Set<string>();

    return payments
      .filter((p: any) => {
        if (!p || p.isSample || p.isMock) return false;
        const isHist = p.isHistorical === true || p.imported === true || p.isLegacyImport === true || p.transactionType === 'historical_import';
        if (isHist) return false;

        const status = String(p.status || p.paymentStatus || 'paid').toLowerCase();
        if (status !== 'paid' && status !== 'partial') return false;

        const pDate = String(p.paymentDate || p.date || '').split('T')[0];
        if (!pDate) return false;
        if (pDate < queryBounds.effectiveStart || pDate > queryBounds.effectiveEnd) return false;

        const idKey = String(p.id || p.paymentId || p.invoiceNumber || p.invoice || p.idempotencyKey || '').trim();
        if (idKey && seen.has(idKey)) return false;
        if (idKey) seen.add(idKey);
        return true;
      })
      .reduce((sum: number, p: any) => {
        const val = Number(p.amountPaid !== undefined ? p.amountPaid : (p.paid !== undefined ? p.paid : (p.amount || 0)));
        return sum + (isNaN(val) ? 0 : val);
      }, 0);
  }, [payments, queryBounds]);

  // 6. FILTERED PT COLLECTION
  const filteredPTCollection = useMemo(() => {
    if (!queryBounds.hasData) return 0;
    const seen = new Set<string>();

    return payments
      .filter((p: any) => {
        if (!p || p.isSample || p.isMock) return false;
        const isHist = p.isHistorical === true || p.imported === true || p.isLegacyImport === true || p.transactionType === 'historical_import';
        if (isHist) return false;

        const isPT = p.isPT || p.billingType === 'PT' || p.packageType === 'PT' || p.invoiceType === 'PT' || p.transactionType === 'pt_payment';
        if (!isPT) return false;

        const status = String(p.status || p.paymentStatus || 'paid').toLowerCase();
        if (status !== 'paid' && status !== 'partial') return false;

        const pDate = String(p.paymentDate || p.date || '').split('T')[0];
        if (pDate < queryBounds.effectiveStart || pDate > queryBounds.effectiveEnd) return false;

        const idKey = String(p.id || p.paymentId || p.invoiceNumber || p.invoice || p.idempotencyKey || '').trim();
        if (idKey && seen.has(idKey)) return false;
        if (idKey) seen.add(idKey);
        return true;
      })
      .reduce((sum: number, p: any) => {
        const val = Number(p.amountPaid !== undefined ? p.amountPaid : (p.paid !== undefined ? p.paid : (p.amount || 0)));
        return sum + (isNaN(val) ? 0 : val);
      }, 0);
  }, [payments, queryBounds]);

  // 7. FILTERED ATTENDANCE CHECK-INS
  const filteredCheckins = useMemo(() => {
    if (!queryBounds.hasData) return 0;
    const uniqueMembers = new Set<string>();

    attendance.forEach((a: any) => {
      if (!a) return;
      const checkInDate = String(a.checkIn || a.timestamp || a.createdAt || '').split('T')[0];
      if (checkInDate >= queryBounds.effectiveStart && checkInDate <= queryBounds.effectiveEnd) {
        const mKey = a.memberId || a.biometricId || a.deviceUserId || a.memberName;
        if (mKey && String(mKey).trim() && !String(mKey).includes('unmapped')) {
          uniqueMembers.add(String(mKey).trim().toLowerCase());
        }
      }
    });
    return uniqueMembers.size;
  }, [attendance, queryBounds]);

  // 8. FILTERED FOLLOW-UPS COUNT
  const filteredFollowupsCount = useMemo(() => {
    if (!queryBounds.hasData) return 0;
    return followups.filter((f: any) => {
      if (!f) return false;
      const fDate = String(f.scheduledDate || f.followUpDate || f.dueDate || f.date || '').split('T')[0];
      return fDate >= queryBounds.effectiveStart && fDate <= queryBounds.effectiveEnd;
    }).length;
  }, [followups, queryBounds]);

  // 9. FILTERED NEW CLIENTS
  const filteredNewClients = useMemo(() => {
    if (!queryBounds.hasData) return 0;
    return members.filter((m: any) => {
      if (!m || m.isSample || m.isMock) return false;
      const joined = String(m.joinDate || m.registrationDate || m.createdAt || '').split('T')[0];
      return joined >= queryBounds.effectiveStart && joined <= queryBounds.effectiveEnd;
    }).length;
  }, [members, queryBounds]);

  // 10. PENDING ENQUIRIES COUNT
  const pendingEnquiriesCount = useMemo(() => enquiries.filter((e: any) => e.status !== "Converted" && e.status !== "Lost").length, [enquiries]);

  // Submit Handlers for Popups
  const handleCreateEnquiry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enqName || !enqPhone) {
      toast.error("Name and Phone number are required!");
      return;
    }
    setEnqSaving(true);
    try {
      const payload = {
        name: enqName,
        phone: enqPhone,
        source: enqSource,
        interestedPlan: enqPlan,
        nextFollowUp: enqDate,
        remarks: enqRemarks,
        status: 'Pending',
        priority: 'Warm',
        createdAt: new Date().toISOString()
      };

      try {
        await API.post('/enquiries', payload);
      } catch (_) {
        await addDoc(collection(db, 'enquiries'), payload);
      }

      setEnquiries(prev => [{ id: `enq_${Date.now()}`, ...payload }, ...prev]);
      toast.success("New Enquiry created successfully! 🎉");
      setShowNewEnquiryModal(false);
      setEnqName(''); setEnqPhone(''); setEnqRemarks('');
    } catch (err: any) {
      toast.error("Failed to create enquiry: " + err.message);
    } finally {
      setEnqSaving(false);
    }
  };

  const handleCreateFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folTitle || !folSelectedId) {
      toast.error("Please select a member and enter a reason!");
      return;
    }
    setFolSaving(true);
    try {
      const targetMember = members.find((m: any) => m.id === folSelectedId || m.memberId === folSelectedId);

      let followUpType = 'General';
      if (folTitle.includes('Renewal') || folTitle.includes('Membership')) {
        followUpType = 'GYM MEMBERSHIP RENEWAL';
      } else if (folTitle.includes('PT') || folTitle.includes('Personal Training')) {
        followUpType = 'PT RENEWAL';
      } else if (folTitle.includes('Balance') || folTitle.includes('Payment')) {
        followUpType = 'PENDING BALANCE';
      }

      await createFollowup({
        memberId: folSelectedId,
        memberName: targetMember?.name || 'Member',
        phone: targetMember?.phone || '',
        title: folTitle,
        reason: folTitle,
        notes: folTitle,
        dueDate: folDate,
        scheduledDate: folDate,
        scheduledTime: folTime,
        scheduledTimestamp: new Date(`${folDate}T${folTime}`).getTime() || Date.now(),
        priority: folPriority,
        type: followUpType,
        source: 'manual',
        status: 'Pending',
        createdAt: new Date().toISOString()
      });

      toast.success("Follow-up scheduled successfully! 📅");
      setShowNewFollowupModal(false);
      setFolTitle(''); setFolSelectedId('');
    } catch (err: any) {
      toast.error("Failed to schedule follow-up: " + err.message);
    } finally {
      setFolSaving(false);
    }
  };

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!memName || !memPhone) {
      toast.error("Name and Phone are required!");
      return;
    }
    setMemSaving(true);
    try {
      const invoiceNumber = `INV-${Math.floor(100000 + Math.random() * 900000)}`;
      const paidAmt = Number(memPaid) || 0;

      const memberPayload = {
        name: memName,
        phone: memPhone,
        plan: memPlan,
        status: 'active',
        joinDate: todayStr,
        price: paidAmt,
        originalAmount: paidAmt,
        discountAmount: 0,
        netPayable: paidAmt,
        amountPaid: paidAmt,
        paid: paidAmt,
        totalBilled: paidAmt,
        totalPaid: paidAmt,
        paymentStatus: 'paid',
        paymentMethod: memMethod,
        method: memMethod,
        invoiceNumber: invoiceNumber,
        transactionType: 'membership_payment',
        isHistorical: false,
        imported: false,
        paymentDate: todayStr,
        idempotencyKey: `overview_mem_${memPhone.replace(/\D/g, '')}_${todayStr}`,
        isRealTimeToday: true,
        createdAt: new Date().toISOString()
      };

      try {
        await API.post('/members', memberPayload);
      } catch (_) {
        const docRef = await addDoc(collection(db, 'members'), memberPayload);
        await addDoc(collection(db, 'payments'), {
          memberId: docRef.id,
          memberName: memName,
          originalAmount: paidAmt,
          discountAmount: 0,
          netPayable: paidAmt,
          amount: paidAmt,
          amountPaid: paidAmt,
          paid: paidAmt,
          plan: memPlan,
          method: memMethod,
          paymentMethod: memMethod,
          invoice: invoiceNumber,
          invoiceNumber: invoiceNumber,
          status: 'paid',
          transactionType: 'membership_payment',
          isHistorical: false,
          imported: false,
          date: todayStr,
          paymentDate: todayStr,
          isRealTimeToday: true,
          createdAt: new Date().toISOString()
        });
      }

      await fetchMembers();
      await fetchPayments();

      toast.success(`Member registered & Invoice ${invoiceNumber} issued! 📄✨`);
      setShowNewMemberModal(false);
      setMemName(''); setMemPhone(''); setMemPaid('6500');
      fetchMembers();
      // Payment list refreshes automatically via useTodaysPayments hook listener
    } catch (err: any) {
      toast.error("Failed to add member: " + err.message);
    } finally {
      setMemSaving(false);
    }
  };

  const headerDateStr = useMemo(() => {
    return new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: SYSTEM_CONFIG.timezone
    });
  }, []);

  return (
    <div className="w-full space-y-4 pb-6 text-left">

      {/* ── HERO HEADER CARD (Clean greeting, quick actions, date range filter with 2-way sync) ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#F97316] via-[#EA580C] to-[#9A3412] rounded-[24px] px-6 py-6 border border-orange-400/30 shadow-xl shadow-orange-950/20 text-white">
        <div className="absolute top-0 right-0 w-72 h-72 bg-amber-400/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 left-0 w-64 h-64 bg-orange-300/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* Greeting & Quick Actions */}
          <div className="space-y-4">
            <motion.div {...fadeUp(0)} className="flex items-center gap-3">
              <span className="px-3 py-1 rounded-full bg-black/20 border border-white/20 text-[9.5px] font-black uppercase tracking-[0.15em] text-white flex items-center gap-1.5 shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </span>
                Live Sync
              </span>
            </motion.div>

            <div>
              <motion.h1 {...fadeUp(0.05)} className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight leading-tight">
                {getGreeting()}, <span className="text-amber-200 font-black">{user?.name || 'Manager'}</span> 👋
              </motion.h1>

              <motion.p {...fadeUp(0.1)} className="text-orange-100/90 text-xs md:text-sm mt-1 font-semibold">
                {headerDateStr}
              </motion.p>
            </div>

            {/* POPUP ACTION BUTTONS */}
            <motion.div {...fadeUp(0.15)} className="flex flex-wrap gap-2.5 pt-1">
              <button
                onClick={() => router.push('/dashboard/members?action=add')}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-[#EA580C] bg-white hover:bg-orange-50 transition-all cursor-pointer shadow-md active:scale-95 border-none"
              >
                <UserPlus size={14} className="text-[#EA580C]" /> + New Member
              </button>

              <button
                onClick={() => setShowNewEnquiryModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-black/25 hover:bg-black/35 border border-white/25 transition-all cursor-pointer shadow-xs active:scale-95 backdrop-blur-xs"
              >
                <MessageSquare size={14} /> + New Enquiry
              </button>

              <button
                onClick={() => setShowNewFollowupModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-black/25 hover:bg-black/35 border border-white/25 transition-all cursor-pointer shadow-xs active:scale-95 backdrop-blur-xs"
              >
                <PhoneCall size={14} /> + Follow Up
              </button>

              <button
                onClick={() => router.push('/dashboard/attendance')}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-white/15 hover:bg-white/25 border border-white/20 transition-all cursor-pointer backdrop-blur-xs"
              >
                <Fingerprint size={14} className="text-amber-200" /> Attendance
              </button>
            </motion.div>
          </div>

          {/* Date Filter & Calendar Controls */}
          <motion.div {...fadeUp(0.1)} className="flex flex-col items-start lg:items-end gap-3 shrink-0">
            {/* Calendar Date Inputs */}
            <div className="flex flex-wrap items-center gap-2 bg-black/20 border border-white/20 rounded-2xl p-2 backdrop-blur-xs">
              <input
                type="date"
                value={fromDate}
                onChange={e => handleDateInputChange(e.target.value, toDate)}
                className="bg-white/15 border border-white/20 text-white text-[11px] font-bold rounded-xl px-3 py-1.5 outline-none focus:border-amber-300 transition-all w-36 cursor-pointer"
              />
              <span className="text-orange-200 text-xs font-black">→</span>
              <input
                type="date"
                value={toDate}
                onChange={e => handleDateInputChange(fromDate, e.target.value)}
                className="bg-white/15 border border-white/20 text-white text-[11px] font-bold rounded-xl px-3 py-1.5 outline-none focus:border-amber-300 transition-all w-36 cursor-pointer"
              />
              <button
                onClick={() => handleDateInputChange(fromDate, toDate)}
                className="px-4 py-1.5 bg-white hover:bg-orange-50 text-[#EA580C] text-[11px] font-black rounded-xl transition-all tracking-wider uppercase cursor-pointer border-none shadow-sm"
              >
                Filter
              </button>
            </div>

            {/* Quick Range Preset Buttons */}
            <div className="flex flex-wrap gap-1.5">
              {(["Today", "Yesterday", "7 Days", "30 Days", "Month"] as const).map(r => (
                <button
                  key={r}
                  onClick={() => handleSelectPreset(r)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                    dateRange === r
                      ? "bg-white text-[#EA580C] border-white shadow-sm"
                      : "bg-black/20 text-white border-white/20 hover:bg-white/20"
                  }`}
                >
                  {r}
                </button>
              ))}
              {dateRange === "Custom" && (
                <span className="px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-emerald-600/30 text-emerald-300 border border-emerald-500/40">
                  Custom
                </span>
              )}
            </div>

            <div className="text-[10px] font-medium text-orange-100/80 flex items-center gap-1">
              <Info size={11} className="text-amber-200" />
              Software data live from: <span className="text-white font-bold">23-Aug-2026</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── FLOATING KPI STRIP (REAL CALCULATED OPERATIONAL METRICS) ── */}
      <motion.div
        {...fadeUp(0.2)}
        className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10"
      >
        {[
          { title: "Today's Collection", value: `₹${todaysRealCollection.toLocaleString('en-IN')}`, icon: IndianRupee, onClick: () => router.push('/dashboard/billing') },
          { title: "Present Today", value: presentTodayCount, icon: UserCheck, onClick: () => setShowPresentModal(true) },
          { title: "Active Members", value: activeMembersCount, icon: Activity, onClick: () => router.push('/dashboard/members') },
          { title: "Today's Follow-ups", value: todaysCount, icon: PhoneCall, onClick: () => router.push('/dashboard/follow-up') },
        ].map((kpi, i) => (
          <div
            key={i}
            onClick={kpi.onClick}
            className="bg-white rounded-2xl p-4 border border-stone-200/90 shadow-xs flex items-center gap-3 hover:border-[#F97316] transition-all cursor-pointer hover:shadow-[0_8px_25px_rgba(249,115,22,0.12)] hover:scale-[1.02]"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 bg-[#FFF7ED] text-[#EA580C] border border-[#FED7AA]"
            >
              <kpi.icon size={18} />
            </div>
            <div>
              <div className="text-[9.5px] font-bold text-slate-500 uppercase tracking-wider leading-none flex items-center gap-1">
                {kpi.title}
                <span className="text-[8px] text-[#EA580C] font-black">· Click for list →</span>
              </div>
              <div className="text-lg font-black text-slate-900 mt-1 leading-none">{kpi.value}</div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── MAIN BODY ── */}
      <div className="space-y-5">

        {/* ─── SUMMARY STATISTICS (13 REAL-TIME OPERATIONAL CARDS) ─── */}
        <motion.div {...fadeUp(0.25)}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#F97316] to-[#EA580C] text-white flex items-center justify-center font-black shadow-xs">
                <BarChart3 size={18} />
              </div>
              <h2 className="text-lg font-black text-slate-900 font-display">Summary Statistics</h2>
            </div>
            <div className="h-px flex-1 mx-4 bg-stone-200" />
            <span className="text-[10px] font-black text-[#EA580C] bg-[#FFF7ED] px-3 py-1 rounded-full border border-[#FED7AA] uppercase tracking-wider">
              {dateRange} Real Time
            </span>
          </div>

          {/* Clean notice when filtering date before system launch */}
          {!queryBounds.hasData && (
            <div className="mb-4 p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-900 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                <AlertCircle size={18} />
              </div>
              <div>
                <h4 className="text-xs font-bold text-amber-900">No activity recorded for this period</h4>
                <p className="text-[11px] text-amber-700 font-medium mt-0.5">
                  No attendance, billing or follow-up activity was recorded during {fromDate} to {toDate}. Software data started fresh on 23-Aug-2026.
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {/* Row 1 */}
            <SummaryStatCard
              title="New clients"
              value={filteredNewClients}
              icon={Dumbbell}
              color="#EA580C"
              lineAccentColor="#F97316"
            />
            <SummaryStatCard
              title="Total collection"
              value={`₹${filteredRangeCollection.toLocaleString('en-IN')}`}
              icon={Coins}
              color="#EA580C"
              lineAccentColor="#EA580C"
            />
            <SummaryStatCard
              title="Total Expenses"
              value="₹0"
              icon={Wallet}
              color="#EA580C"
              lineAccentColor="#FB923C"
            />
            <SummaryStatCard
              title="Total PT Collection"
              value={`₹${filteredPTCollection.toLocaleString('en-IN')}`}
              icon={Sparkles}
              color="#EA580C"
              lineAccentColor="#C2410C"
            />

            {/* Row 2 */}
            <SummaryStatCard
              title="Profit/Loss"
              value={`₹${filteredRangeCollection.toLocaleString('en-IN')}`}
              icon={IndianRupee}
              color="#EA580C"
              lineAccentColor="#EA580C"
            />
            <SummaryStatCard
              title="Pending Inquiry(s)"
              value={pendingEnquiriesCount}
              icon={MessageSquare}
              color="#EA580C"
              lineAccentColor="#F97316"
            />
            <SummaryStatCard
              title="Active clients"
              value={activeMembersCount}
              icon={Activity}
              color="#EA580C"
              lineAccentColor="#16A34A"
            />
            <SummaryStatCard
              title="Expired clients"
              value={expiredMembersCount}
              icon={UserMinus}
              color="#78716C"
              lineAccentColor="#DC2626"
            />

            {/* Row 3 */}
            <SummaryStatCard
              title="Profile Created clients"
              value={filteredNewClients}
              icon={UserCheck}
              color="#EA580C"
              lineAccentColor="#EA580C"
            />
            <SummaryStatCard
              title="Booked PT Sessions"
              value="0"
              icon={CalendarCheck}
              color="#EA580C"
              lineAccentColor="#FB923C"
            />
            <SummaryStatCard
              title="Follow-ups"
              value={filteredFollowupsCount}
              icon={PhoneCall}
              color="#EA580C"
              lineAccentColor="#EA580C"
            />
            <SummaryStatCard
              title="Today Present Client"
              value={filteredCheckins}
              icon={Users}
              color="#EA580C"
              lineAccentColor="#F97316"
              onClick={() => setShowPresentModal(true)}
            />

            {/* Row 4 */}
            <SummaryStatCard
              title="Booked Group Class"
              value="0"
              icon={Users}
              color="#EA580C"
              lineAccentColor="#FB923C"
            />
          </div>
        </motion.div>

        {/* ─── FINANCIAL ANALYTICS (FULL WIDTH - REAL DATA ONLY) ─── */}
        <motion.div {...fadeUp(0.3)} className="w-full">
          <FinancialAnalytics
            fromDate={fromDate}
            toDate={toDate}
            dateRangeTitle={dateRange}
            payments={payments}
          />
        </motion.div>

      </div>

      {/* ─── POPUP MODALS ─── */}

      {/* 1. NEW ENQUIRY MODAL */}
      <AnimatePresence>
        {showNewEnquiryModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setShowNewEnquiryModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden text-left z-10">
              <div className="bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#C2410C] px-6 py-4 flex items-center justify-between text-white">
                <h3 className="font-extrabold text-sm uppercase tracking-wide flex items-center gap-2">
                  <MessageSquare size={18} /> Add New Client Enquiry
                </h3>
                <button onClick={() => setShowNewEnquiryModal(false)} className="text-white/80 hover:text-white border-none cursor-pointer bg-transparent"><X size={18}/></button>
              </div>

              <form onSubmit={handleCreateEnquiry} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Client Full Name <span className="text-[#EA580C]">*</span></label>
                  <input type="text" required placeholder="e.g. Rahul Sharma" value={enqName} onChange={e => setEnqName(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] focus:bg-white transition-all" />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Phone Number <span className="text-[#EA580C]">*</span></label>
                  <input type="tel" required placeholder="e.g. 9876543210" value={enqPhone} onChange={e => setEnqPhone(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] focus:bg-white transition-all" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Source</label>
                    <select value={enqSource} onChange={e => setEnqSource(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer">
                      <option>Walk-in</option>
                      <option>Instagram</option>
                      <option>Facebook</option>
                      <option>Phone Inquiry</option>
                      <option>Referral</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Interested Plan</label>
                    <select value={enqPlan} onChange={e => setEnqPlan(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer">
                      <option>Monthly Standard</option>
                      <option>Quarterly Prime</option>
                      <option>Semi-Annual Pro</option>
                      <option>Annual VIP</option>
                      <option>Personal Training (PT)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Next Follow-up Date</label>
                  <input type="date" value={enqDate} onChange={e => setEnqDate(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer" />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Remarks / Notes</label>
                  <textarea rows={3} placeholder="Initial conversation notes..." value={enqRemarks} onChange={e => setEnqRemarks(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-semibold text-slate-700 outline-none focus:border-[#F97316] resize-none" />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowNewEnquiryModal(false)} className="px-5 py-2.5 rounded-xl border border-stone-200 text-slate-600 font-bold text-xs cursor-pointer hover:bg-stone-50">Cancel</button>
                  <button type="submit" disabled={enqSaving} className="px-6 py-2.5 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/20 transition-all border-none cursor-pointer disabled:opacity-50">
                    {enqSaving ? 'Saving...' : 'Save Enquiry'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 2. NEW FOLLOW-UP MODAL */}
      <AnimatePresence>
        {showNewFollowupModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setShowNewFollowupModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden text-left z-10">
              <div className="bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#C2410C] px-6 py-4 flex items-center justify-between text-white">
                <h3 className="font-extrabold text-sm uppercase tracking-wide flex items-center gap-2">
                  <PhoneCall size={18} /> Schedule New Follow-Up
                </h3>
                <button onClick={() => setShowNewFollowupModal(false)} className="text-white/80 hover:text-white border-none cursor-pointer bg-transparent"><X size={18}/></button>
              </div>

              <form onSubmit={handleCreateFollowup} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Select Member <span className="text-[#EA580C]">*</span></label>
                  <select required value={folSelectedId} onChange={e => setFolSelectedId(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer">
                    <option value="">-- Select Member --</option>
                    {members.map((m: any) => <option key={m.id || m.memberId} value={m.id || m.memberId}>{m.name} ({m.phone})</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Title / Reason <span className="text-[#EA580C]">*</span></label>
                  <input type="text" required placeholder="e.g. Renewal Reminder" value={folTitle} onChange={e => setFolTitle(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316]" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Date</label>
                    <input type="date" required value={folDate} onChange={e => setFolDate(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Time</label>
                    <input type="time" required value={folTime} onChange={e => setFolTime(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Priority</label>
                  <select value={folPriority} onChange={e => setFolPriority(e.target.value as any)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer">
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowNewFollowupModal(false)} className="px-5 py-2.5 rounded-xl border border-stone-200 text-slate-600 font-bold text-xs cursor-pointer hover:bg-stone-50">Cancel</button>
                  <button type="submit" disabled={folSaving} className="px-6 py-2.5 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/20 transition-all border-none cursor-pointer disabled:opacity-50">
                    {folSaving ? 'Scheduling...' : 'Schedule Follow-up'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 3. NEW MEMBER MODAL */}
      <AnimatePresence>
        {showNewMemberModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setShowNewMemberModal(false)} />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="relative bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden text-left z-10">
              <div className="bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#C2410C] px-6 py-4 flex items-center justify-between text-white">
                <h3 className="font-extrabold text-sm uppercase tracking-wide flex items-center gap-2">
                  <UserPlus size={18} /> Register New Gym Member
                </h3>
                <button onClick={() => setShowNewMemberModal(false)} className="text-white/80 hover:text-white border-none cursor-pointer bg-transparent"><X size={18}/></button>
              </div>

              <form onSubmit={handleCreateMember} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Member Full Name <span className="text-[#EA580C]">*</span></label>
                  <input type="text" required placeholder="e.g. Vikram Singh" value={memName} onChange={e => setMemName(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316]" />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Phone Number <span className="text-[#EA580C]">*</span></label>
                  <input type="tel" required placeholder="e.g. 9812345678" value={memPhone} onChange={e => setMemPhone(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316]" />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Membership Plan</label>
                    <select value={memPlan} onChange={e => {
                      setMemPlan(e.target.value);
                      if (e.target.value === '1 Month') setMemPaid('2500');
                      if (e.target.value === '3 Months') setMemPaid('6500');
                      if (e.target.value === '6 Months') setMemPaid('11500');
                      if (e.target.value === '12 Months') setMemPaid('18000');
                    }} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer">
                      <option value="1 Month">1 Month (₹2,500)</option>
                      <option value="3 Months">3 Months (₹6,500)</option>
                      <option value="6 Months">6 Months (₹11,500)</option>
                      <option value="12 Months">12 Months (₹18,000)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Amount Paid (₹)</label>
                    <input type="number" value={memPaid} onChange={e => setMemPaid(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316]" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Payment Method</label>
                    <select value={memMethod} onChange={e => setMemMethod(e.target.value)} className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer">
                      <option value="UPI">UPI / QR Code</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Credit / Debit Card</option>
                      <option value="NetBanking">Net Banking</option>
                    </select>
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center gap-2 text-[11px] font-bold text-emerald-700">
                      <CheckCircle2 size={15} className="shrink-0 text-emerald-600" />
                      Auto Invoice & Receipt
                    </div>
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button type="button" onClick={() => setShowNewMemberModal(false)} className="px-5 py-2.5 rounded-xl border border-stone-200 text-slate-600 font-bold text-xs cursor-pointer hover:bg-stone-50">Cancel</button>
                  <button type="submit" disabled={memSaving} className="px-6 py-2.5 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/20 transition-all border-none cursor-pointer disabled:opacity-50">
                    {memSaving ? 'Registering...' : 'Register Member'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── PRESENT MEMBERS ROSTER MODAL ── */}
      <PresentMembersModal
        isOpen={showPresentModal}
        onClose={() => setShowPresentModal(false)}
        attendanceLogs={attendance}
        members={members}
      />

    </div>
  );
}

function SummaryStatCard({ title, value, icon: Icon, color, lineAccentColor, onClick }: { title: string; value: string | number; icon: any; color: string; lineAccentColor: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white hover:bg-[#FFFAF5] rounded-2xl p-4 border border-stone-200/90 shadow-xs relative overflow-hidden flex flex-col justify-between transition-all hover:border-[#F97316] hover:shadow-md ${onClick ? 'cursor-pointer hover:scale-[1.02]' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs bg-[#FFF7ED] text-[#EA580C] border border-[#FED7AA]">
          <Icon size={20} />
        </div>
        <div>
          <div className="text-xs font-bold text-stone-500 flex items-center gap-1">
            {title}
            {onClick && <span className="text-[8px] text-[#EA580C] font-black">· Click for list →</span>}
          </div>
          <div className="text-xl font-black text-stone-900 font-mono tracking-tight mt-0.5">{value}</div>
        </div>
      </div>
      <div className="h-1.5 w-16 rounded-full mt-3 bg-gradient-to-r from-[#FB923C] to-[#EA580C]" />
    </div>
  );
}
