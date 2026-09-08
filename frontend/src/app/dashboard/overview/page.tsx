"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuthStore, useGymStore, useDeviceStore } from "@/store";
import { db } from "@/lib/firebase";
import { collection, addDoc } from "firebase/firestore";
import {
  UserPlus,
  MessageSquare,
  PhoneCall,
  X,
  CheckCircle2
} from "lucide-react";
import { useRouter } from "next/navigation";
import toast from "@/lib/toast";
import API from "@/services/api";

import { useFollowups } from "@/hooks/useFollowups";
import { SYSTEM_START_DATE, SYSTEM_CONFIG } from "@/config/system";
import { useTodaysPayments } from "@/hooks/useTodaysPayments";

// New Next-Level Redesigned Overview Components
import DashboardHero from "./components/DashboardHero";
import KPICommandStrip from "./components/KPICommandStrip";
import PerformanceAnalytics from "./components/PerformanceAnalytics";
import AttendanceCommandCenter from "./components/AttendanceCommandCenter";
import MembershipOverviewWidget from "./components/MembershipOverviewWidget";
import MemberActivityFeed from "./components/MemberActivityFeed";
import QuickActionsGrid from "./components/QuickActionsGrid";
import RecentPaymentsTable from "./components/RecentPaymentsTable";
import GymPulseWidget from "./components/GymPulseWidget";
import GateAccessCard from "./components/GateAccessCard";
import PresentMembersModal from "./components/PresentMembersModal";

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.35, delay, ease: "easeOut" as const }
});

export default function OverviewCommandCenter() {
  const { user } = useAuthStore();
  const router = useRouter();
  const { followups, todaysCount, createFollowup } = useFollowups();
  const {
    members,
    fetchMembers,
    fetchPayments,
    attendance,
    gymPresence,
    triggerGateUnlock
  } = useGymStore();

  const { deviceStatus } = useDeviceStore();

  // Live payment data — single source of truth
  const { todaysTotal: todaysRealCollection, allPayments } = useTodaysPayments();
  const payments = allPayments;

  // Helper to format date in YYYY-MM-DD in Asia/Kolkata timezone
  const getLocalDateStr = (d: Date = new Date()) => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: SYSTEM_CONFIG.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
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
  const [enqName, setEnqName] = useState("");
  const [enqPhone, setEnqPhone] = useState("");
  const [enqSource, setEnqSource] = useState("Walk-in");
  const [enqPlan, setEnqPlan] = useState("Monthly Standard");
  const [enqDate, setEnqDate] = useState(todayStr);
  const [enqRemarks, setEnqRemarks] = useState("");
  const [enqSaving, setEnqSaving] = useState(false);

  // New Followup Form State
  const [folSelectedId, setFolSelectedId] = useState("");
  const [folTitle, setFolTitle] = useState("");
  const [folDate, setFolDate] = useState(todayStr);
  const [folTime, setFolTime] = useState("10:00");
  const [folPriority, setFolPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [folSaving, setFolSaving] = useState(false);

  // New Member Form State
  const [memName, setMemName] = useState("");
  const [memPhone, setMemPhone] = useState("");
  const [memPlan, setMemPlan] = useState("3 Months");
  const [memPaid, setMemPaid] = useState("6500");
  const [memMethod, setMemMethod] = useState("UPI");
  const [memSaving, setMemSaving] = useState(false);

  // Fetch enquiries on mount
  useEffect(() => {
    API.get("/enquiries")
      .then((res) => {
        if (Array.isArray(res.data)) setEnquiries(res.data);
      })
      .catch(() => {});
  }, []);

  // Preset Handler
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

  // Date input handler
  const handleDateInputChange = (newFrom: string, newTo: string) => {
    setFromDate(newFrom);
    setToDate(newTo);
    if (newFrom === todayStr && newTo === todayStr) setDateRange("Today");
    else if (newFrom === yesterdayStr && newTo === yesterdayStr) setDateRange("Yesterday");
    else if (newFrom === sevenDaysAgoStr && newTo === todayStr) setDateRange("7 Days");
    else if (newFrom === thirtyDaysAgoStr && newTo === todayStr) setDateRange("30 Days");
    else if (newFrom === monthStartStr && newTo === todayStr) setDateRange("Month");
    else setDateRange("Custom");
  };

  // Greeting helper
  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Good Morning";
    if (h < 17) return "Good Afternoon";
    return "Good Evening";
  }, []);

  const headerDateStr = useMemo(() => {
    return new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: SYSTEM_CONFIG.timezone
    });
  }, []);

  // 1. Unique Member Attendance for Today
  const presentTodayCount = useMemo(() => {
    const set = new Set<string>();
    attendance.forEach((a: any) => {
      if (!a) return;
      const checkInDate = String(a.checkIn || a.timestamp || a.createdAt || "").split("T")[0];
      if (checkInDate === todayStr) {
        const mKey = a.memberId || a.biometricId || a.deviceUserId || a.memberName;
        if (mKey && String(mKey).trim() && !String(mKey).includes("unmapped")) {
          set.add(String(mKey).trim().toLowerCase());
        }
      }
    });
    return set.size;
  }, [attendance, todayStr]);

  // 2. Active Members Count
  const activeMembersCount = useMemo(() => {
    return members.filter((m: any) => {
      if (!m) return false;
      if (m.status === "frozen" || m.status === "Frozen" || m.status === "blocked" || m.status === "Blocked") return false;
      return m.status === "active" || m.status === "Active" || (m.expiryDate && m.expiryDate >= todayStr);
    }).length;
  }, [members, todayStr]);

  // 3. Pending Enquiries Count
  const pendingEnquiriesCount = useMemo(
    () => enquiries.filter((e: any) => e.status !== "Converted" && e.status !== "Lost").length,
    [enquiries]
  );

  // 4. Last Punch Event for Gate Access Card
  const lastPunchEvent = useMemo(() => {
    if (!attendance || attendance.length === 0) return undefined;
    const latest = attendance[0];
    const rawTs = latest.checkIn || latest.timestamp || latest.createdAt;
    const timeFormatted = rawTs
      ? new Date(rawTs).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
      : "Just now";
    return {
      memberName: latest.memberName || `Member #${latest.biometricId || "Bio"}`,
      time: `Today at ${timeFormatted}`,
      biometricId: latest.biometricId
    };
  }, [attendance]);

  // Submit Handlers
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
        status: "Pending",
        priority: "Warm",
        createdAt: new Date().toISOString()
      };

      try {
        await API.post("/enquiries", payload);
      } catch (_) {
        await addDoc(collection(db, "enquiries"), payload);
      }

      setEnquiries((prev) => [{ id: `enq_${Date.now()}`, ...payload }, ...prev]);
      toast.success("New Enquiry created successfully! 🎉");
      setShowNewEnquiryModal(false);
      setEnqName("");
      setEnqPhone("");
      setEnqRemarks("");
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

      let followUpType = "General";
      if (folTitle.includes("Renewal") || folTitle.includes("Membership")) {
        followUpType = "GYM MEMBERSHIP RENEWAL";
      } else if (folTitle.includes("PT") || folTitle.includes("Personal Training")) {
        followUpType = "PT RENEWAL";
      } else if (folTitle.includes("Balance") || folTitle.includes("Payment")) {
        followUpType = "PENDING BALANCE";
      }

      await createFollowup({
        memberId: folSelectedId,
        memberName: targetMember?.name || "Member",
        phone: targetMember?.phone || "",
        title: folTitle,
        reason: folTitle,
        notes: folTitle,
        dueDate: folDate,
        scheduledDate: folDate,
        scheduledTime: folTime,
        scheduledTimestamp: new Date(`${folDate}T${folTime}`).getTime() || Date.now(),
        priority: folPriority,
        type: followUpType,
        source: "manual",
        status: "Pending",
        createdAt: new Date().toISOString()
      });

      toast.success("Follow-up scheduled successfully! 📅");
      setShowNewFollowupModal(false);
      setFolTitle("");
      setFolSelectedId("");
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
        status: "active",
        joinDate: todayStr,
        price: paidAmt,
        originalAmount: paidAmt,
        discountAmount: 0,
        netPayable: paidAmt,
        amountPaid: paidAmt,
        paid: paidAmt,
        totalBilled: paidAmt,
        totalPaid: paidAmt,
        paymentStatus: "paid",
        paymentMethod: memMethod,
        method: memMethod,
        invoiceNumber: invoiceNumber,
        transactionType: "membership_payment",
        isHistorical: false,
        imported: false,
        paymentDate: todayStr,
        idempotencyKey: `overview_mem_${memPhone.replace(/\D/g, "")}_${todayStr}`,
        isRealTimeToday: true,
        createdAt: new Date().toISOString()
      };

      try {
        await API.post("/members", memberPayload);
      } catch (_) {
        const docRef = await addDoc(collection(db, "members"), memberPayload);
        await addDoc(collection(db, "payments"), {
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
          status: "paid",
          transactionType: "membership_payment",
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
      setMemName("");
      setMemPhone("");
      setMemPaid("6500");
    } catch (err: any) {
      toast.error("Failed to add member: " + err.message);
    } finally {
      setMemSaving(false);
    }
  };

  return (
    <div className="w-full space-y-5 pb-8 text-left font-sans">
      
      {/* ── 1. HERO COMMAND CENTER ── */}
      <motion.div {...fadeUp(0)}>
        <DashboardHero
          userName={user?.name || "Gym Owner"}
          dateStr={headerDateStr}
          greeting={greeting}
          fromDate={fromDate}
          toDate={toDate}
          dateRange={dateRange}
          onSelectPreset={handleSelectPreset}
          onDateChange={handleDateInputChange}
          presentTodayCount={presentTodayCount}
          activeMembersCount={activeMembersCount}
          pendingEnquiriesCount={pendingEnquiriesCount}
          todaysRealCollection={todaysRealCollection}
          onNewMember={() => setShowNewMemberModal(true)}
          onNewEnquiry={() => setShowNewEnquiryModal(true)}
          onFollowUp={() => setShowNewFollowupModal(true)}
          onAttendance={() => router.push("/dashboard/attendance")}
        />
      </motion.div>

      {/* ── 2. TOP KPI COMMAND STRIP ── */}
      <motion.div {...fadeUp(0.08)}>
        <KPICommandStrip
          todaysCollection={todaysRealCollection}
          activeMembersCount={activeMembersCount}
          totalMembersCount={members.length}
          presentTodayCount={presentTodayCount}
          todaysFollowupsCount={todaysCount}
          newEnquiriesCount={pendingEnquiriesCount}
          onOpenBilling={() => router.push("/dashboard/billing")}
          onOpenMembers={() => router.push("/dashboard/members")}
          onOpenPresentModal={() => setShowPresentModal(true)}
          onOpenFollowups={() => router.push("/dashboard/follow-up")}
          onOpenEnquiries={() => router.push("/dashboard/enquiries")}
        />
      </motion.div>

      {/* ── 3. GYM PERFORMANCE ANALYTICS (Revenue & Member Growth) ── */}
      <motion.div {...fadeUp(0.14)}>
        <PerformanceAnalytics
          payments={payments}
          members={members}
        />
      </motion.div>

      {/* ── 4. TWO-COLUMN OPERATIONAL HUB (Attendance Timeline + Member Activity) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Attendance Command Center (7 cols) */}
        <motion.div {...fadeUp(0.18)} className="lg:col-span-7">
          <AttendanceCommandCenter
            attendanceLogs={attendance}
            activeMembersCount={activeMembersCount}
            onOpenRoster={() => setShowPresentModal(true)}
          />
        </motion.div>

        {/* Member Activity Feed (5 cols) */}
        <motion.div {...fadeUp(0.22)} className="lg:col-span-5">
          <MemberActivityFeed
            payments={payments}
            attendanceLogs={attendance}
            members={members}
          />
        </motion.div>
      </div>

      {/* ── 5. QUICK ACTIONS HUB ── */}
      <motion.div {...fadeUp(0.26)}>
        <QuickActionsGrid
          onNewMember={() => setShowNewMemberModal(true)}
          onNewEnquiry={() => setShowNewEnquiryModal(true)}
          onFollowUp={() => setShowNewFollowupModal(true)}
        />
      </motion.div>

      {/* ── 6. TWO-COLUMN MIDDLE HUB (Membership Overview + Hardware / Gate Access) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Membership Lifecycle & Expiring Table (8 cols) */}
        <motion.div {...fadeUp(0.3)} className="lg:col-span-8">
          <MembershipOverviewWidget
            members={members}
            onRenewMember={(m) => router.push(`/dashboard/billing?memberId=${m.id || m.memberId}`)}
          />
        </motion.div>

        {/* Gate Access Control & Hardware Card (4 cols) */}
        <motion.div {...fadeUp(0.34)} className="lg:col-span-4 flex flex-col gap-4">
          <GateAccessCard
            deviceStatus={deviceStatus}
            lastPunchEvent={lastPunchEvent}
            onUnlockGate={triggerGateUnlock}
          />
        </motion.div>
      </div>

      {/* ── 7. GYM PULSE & TELEMETRY ── */}
      <motion.div {...fadeUp(0.38)}>
        <GymPulseWidget
          membersInsideCount={gymPresence.length > 0 ? gymPresence.length : presentTodayCount}
          staffInsideCount={4}
          deviceStatus={deviceStatus}
          isGateReady={true}
        />
      </motion.div>

      {/* ── 8. RECENT PAYMENTS & INVOICES TABLE ── */}
      <motion.div {...fadeUp(0.42)}>
        <RecentPaymentsTable
          payments={payments}
        />
      </motion.div>

      {/* ─── POPUP MODALS ─── */}

      {/* 1. NEW ENQUIRY MODAL */}
      <AnimatePresence>
        {showNewEnquiryModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowNewEnquiryModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden text-left z-10 font-sans"
            >
              <div className="bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#C2410C] px-6 py-4 flex items-center justify-between text-white">
                <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                  <MessageSquare size={17} /> Add New Client Enquiry
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewEnquiryModal(false)}
                  className="text-white/80 hover:text-white border-none cursor-pointer bg-transparent"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateEnquiry} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Client Full Name <span className="text-[#EA580C]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Rahul Sharma"
                    value={enqName}
                    onChange={(e) => setEnqName(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] focus:bg-white transition-all"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Phone Number <span className="text-[#EA580C]">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9876543210"
                    value={enqPhone}
                    onChange={(e) => setEnqPhone(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] focus:bg-white transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Source</label>
                    <select
                      value={enqSource}
                      onChange={(e) => setEnqSource(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer"
                    >
                      <option>Walk-in</option>
                      <option>Instagram</option>
                      <option>Facebook</option>
                      <option>Phone Inquiry</option>
                      <option>Referral</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Interested Plan</label>
                    <select
                      value={enqPlan}
                      onChange={(e) => setEnqPlan(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer"
                    >
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
                  <input
                    type="date"
                    value={enqDate}
                    onChange={(e) => setEnqDate(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Remarks / Notes</label>
                  <textarea
                    rows={3}
                    placeholder="Initial conversation notes..."
                    value={enqRemarks}
                    onChange={(e) => setEnqRemarks(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl p-3 text-xs font-semibold text-slate-700 outline-none focus:border-[#F97316] resize-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNewEnquiryModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-stone-200 text-slate-600 font-bold text-xs cursor-pointer hover:bg-stone-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={enqSaving}
                    className="px-6 py-2.5 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/20 transition-all border-none cursor-pointer disabled:opacity-50"
                  >
                    {enqSaving ? "Saving..." : "Save Enquiry"}
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowNewFollowupModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden text-left z-10 font-sans"
            >
              <div className="bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#C2410C] px-6 py-4 flex items-center justify-between text-white">
                <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                  <PhoneCall size={17} /> Schedule New Follow-Up
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewFollowupModal(false)}
                  className="text-white/80 hover:text-white border-none cursor-pointer bg-transparent"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateFollowup} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Select Member <span className="text-[#EA580C]">*</span>
                  </label>
                  <select
                    required
                    value={folSelectedId}
                    onChange={(e) => setFolSelectedId(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer"
                  >
                    <option value="">-- Select Member --</option>
                    {members.map((m: any) => (
                      <option key={m.id || m.memberId} value={m.id || m.memberId}>
                        {m.name} ({m.phone})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Title / Reason <span className="text-[#EA580C]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Renewal Reminder"
                    value={folTitle}
                    onChange={(e) => setFolTitle(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={folDate}
                      onChange={(e) => setFolDate(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Time</label>
                    <input
                      type="time"
                      required
                      value={folTime}
                      onChange={(e) => setFolTime(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">Priority</label>
                  <select
                    value={folPriority}
                    onChange={(e) => setFolPriority(e.target.value as any)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer"
                  >
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowNewFollowupModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-stone-200 text-slate-600 font-bold text-xs cursor-pointer hover:bg-stone-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={folSaving}
                    className="px-6 py-2.5 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/20 transition-all border-none cursor-pointer disabled:opacity-50"
                  >
                    {folSaving ? "Scheduling..." : "Schedule Follow-up"}
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowNewMemberModal(false)}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white rounded-3xl shadow-2xl border border-stone-200 w-full max-w-lg overflow-hidden text-left z-10 font-sans"
            >
              <div className="bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#C2410C] px-6 py-4 flex items-center justify-between text-white">
                <h3 className="font-black text-sm uppercase tracking-wide flex items-center gap-2">
                  <UserPlus size={17} /> Register New Gym Member
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewMemberModal(false)}
                  className="text-white/80 hover:text-white border-none cursor-pointer bg-transparent"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateMember} className="p-6 space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Member Full Name <span className="text-[#EA580C]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Vikram Singh"
                    value={memName}
                    onChange={(e) => setMemName(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316]"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-600 block mb-1">
                    Phone Number <span className="text-[#EA580C]">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="e.g. 9812345678"
                    value={memPhone}
                    onChange={(e) => setMemPhone(e.target.value)}
                    className="w-full bg-stone-50 border border-stone-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Membership Plan</label>
                    <select
                      value={memPlan}
                      onChange={(e) => {
                        setMemPlan(e.target.value);
                        if (e.target.value === "1 Month") setMemPaid("2500");
                        if (e.target.value === "3 Months") setMemPaid("6500");
                        if (e.target.value === "6 Months") setMemPaid("11500");
                        if (e.target.value === "12 Months") setMemPaid("18000");
                      }}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer"
                    >
                      <option value="1 Month">1 Month (₹2,500)</option>
                      <option value="3 Months">3 Months (₹6,500)</option>
                      <option value="6 Months">6 Months (₹11,500)</option>
                      <option value="12 Months">12 Months (₹18,000)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Amount Paid (₹)</label>
                    <input
                      type="number"
                      value={memPaid}
                      onChange={(e) => setMemPaid(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-600 block mb-1">Payment Method</label>
                    <select
                      value={memMethod}
                      onChange={(e) => setMemMethod(e.target.value)}
                      className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer"
                    >
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
                  <button
                    type="button"
                    onClick={() => setShowNewMemberModal(false)}
                    className="px-5 py-2.5 rounded-xl border border-stone-200 text-slate-600 font-bold text-xs cursor-pointer hover:bg-stone-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={memSaving}
                    className="px-6 py-2.5 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/20 transition-all border-none cursor-pointer disabled:opacity-50"
                  >
                    {memSaving ? "Registering..." : "Register Member"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 4. PRESENT MEMBERS ROSTER MODAL */}
      <PresentMembersModal
        isOpen={showPresentModal}
        onClose={() => setShowPresentModal(false)}
        attendanceLogs={attendance}
        members={members}
      />

    </div>
  );
}
