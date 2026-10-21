'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ArrowRight, ArrowLeft, Check, Sparkles, CheckCircle2,
  Calendar, CreditCard, User, Receipt, ChevronRight,
  AlertCircle, Tag, Percent, Banknote, Clock, TrendingUp,
  ShieldAlert, Eye, Printer, Smartphone, Landmark
} from 'lucide-react';
import { useGymStore } from '@/store';
import { formatCurrency } from '@/lib/utils';
import { membershipEngine } from '@/lib/engines/membershipEngine';
import API from '@/services/api';
import toast from '@/lib/toast';
import MemberAvatar from '../../follow-up/components/MemberAvatar';
import OfficialInvoiceReceipt from '../../components/OfficialInvoiceReceipt';

interface UpgradeModalProps {
  isOpen: boolean;
  member: any;
  preselectedPayment?: any;
  onClose: () => void;
  onSuccess?: (updatedMember: any, newInvoice: any) => void;
}

interface PlanOption {
  id: string;
  name: string;
  price: number;
  durationDays: number;
  durationMonths: number;
  desc: string;
  isCustom?: boolean;
}

type Step = 1 | 2 | 3;

function getTodayStr() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function fmtDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch {
    return dateStr;
  }
}

function addMonthsToDate(dateStr: string, months: number): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

function addDaysToDate(dateStr: string, days: number): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  } catch {
    return dateStr;
  }
}

// Confetti Particle Effect
const ConfettiAnimation = () => {
  const colors = ['#8b5cf6', '#F97316', '#ec4899', '#10b981', '#f59e0b', '#F97316'];
  const particles = useMemo(() =>
    Array.from({ length: 65 }).map((_, i) => ({
      id: i,
      color: colors[i % colors.length],
      x: (Math.random() - 0.5) * 550,
      y: -(Math.random() * 450 + 100),
      scale: Math.random() * 0.8 + 0.3,
      rotation: Math.random() * 720 - 360,
    })), []);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center z-40">
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 100, scale: 0, rotate: 0, opacity: 1 }}
          animate={{ x: p.x, y: p.y, scale: p.scale, rotate: p.rotation, opacity: [1, 1, 0.5, 0] }}
          transition={{ duration: 2.5, ease: 'easeOut' }}
          className="absolute w-2.5 h-2.5 rounded-sm"
          style={{ backgroundColor: p.color }}
        />
      ))}
    </div>
  );
};

export default function UpgradeModal({
  isOpen,
  member,
  preselectedPayment,
  onClose,
  onSuccess,
}: UpgradeModalProps) {
  const { plans, fetchPlans, payments, fetchPayments, fetchMembers } = useGymStore();

  const [step, setStep] = useState<Step>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected new plan state
  const [selectedPlanId, setSelectedPlanId] = useState<string>('');
  const [customPrice, setCustomPrice] = useState<number>(5000);
  const [customDurationMonths, setCustomDurationMonths] = useState<number>(3);

  // Discount state
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<string>('UPI');
  const [amountPaidNow, setAmountPaidNow] = useState<number>(0);
  const [isCustomPaidInput, setIsCustomPaidInput] = useState<boolean>(false);
  const [upgradeDate, setUpgradeDate] = useState<string>(getTodayStr());
  const [notes, setNotes] = useState<string>('');

  // Result state
  const [createdInvoice, setCreatedInvoice] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Find candidate active payment record for current membership
  const activePayment = useMemo(() => {
    if (preselectedPayment) return preselectedPayment;
    if (!member) return null;
    const memberPayments = (payments || []).filter(
      (p: any) => p.memberId === member.id && !p.deleted
    );
    // Find the latest non-deleted membership bill
    const sorted = [...memberPayments].sort((a: any, b: any) => {
      const tA = new Date(a.transactionDate || a.paymentDate || a.date || a.createdAt || 0).getTime();
      const tB = new Date(b.transactionDate || b.paymentDate || b.date || b.createdAt || 0).getTime();
      return tB - tA;
    });
    return sorted.find((p: any) => !p.isHistorical) || sorted[0] || null;
  }, [preselectedPayment, member, payments]);

  // Current membership figures
  const currentPlanName = member?.plan || activePayment?.plan || 'Current Membership';
  const currentStartDate = member?.startDate || activePayment?.startDate || getTodayStr();
  const currentExpiryDate = member?.expiryDate || activePayment?.expiryDate || '';
  
  // Previous payment values (guaranteed safe numbers)
  const currentBillAmount = Number(
    activePayment?.originalAmount !== undefined ? activePayment.originalAmount :
    activePayment?.packagePrice !== undefined ? activePayment.packagePrice :
    activePayment?.netPayable !== undefined ? activePayment.netPayable :
    member?.amount || member?.price || 3000
  );

  const currentAmountPaid = Number(
    activePayment?.amountPaid !== undefined ? activePayment.amountPaid :
    activePayment?.paid !== undefined ? activePayment.paid :
    member?.totalPaid || currentBillAmount
  );

  const currentPendingAmount = Math.max(0, currentBillAmount - currentAmountPaid);

  const currentPaymentDate = activePayment?.paymentDate || activePayment?.date || activePayment?.invoiceDate || currentStartDate;
  const currentInvoiceNumber = activePayment?.invoiceNumber || activePayment?.invoice || 'INV-ORIGINAL';

  // Available plans list
  const availablePlans = useMemo<PlanOption[]>(() => {
    const dbPlans: PlanOption[] = (plans && plans.length > 0 ? plans : [
      { id: '1m', name: '1 Month Standard', price: 2500, durationDays: 30, durationMonths: 1, desc: '30 days standard access' },
      { id: '3m', name: '3 Months Pro', price: 6500, durationDays: 90, durationMonths: 3, desc: '90 days pro access' },
      { id: '6m', name: '6 Months Elite', price: 11500, durationDays: 180, durationMonths: 6, desc: '180 days elite access' },
      { id: '12m', name: '12 Months VIP', price: 18000, durationDays: 365, durationMonths: 12, desc: '365 days full VIP access' },
    ]).map((p: any) => ({
      id: p.id || p.name,
      name: p.name,
      price: Number(p.price) || 0,
      durationDays: Number(p.durationDays) || 30,
      durationMonths: Math.max(1, Math.round((Number(p.durationDays) || 30) / 30)),
      desc: Array.isArray(p.features) && p.features.length > 0
        ? p.features[0]
        : `${p.durationDays || 30} days access`,
    }));

    return [
      ...dbPlans,
      {
        id: 'custom',
        name: 'Custom Package',
        price: customPrice,
        durationDays: customDurationMonths * 30,
        durationMonths: customDurationMonths,
        desc: 'Custom pricing and duration',
        isCustom: true,
      },
    ];
  }, [plans, customPrice, customDurationMonths]);

  // Set default selected plan (pick a plan higher than current if possible)
  useEffect(() => {
    if (!isOpen || !member) return;
    setStep(1);
    setCreatedInvoice(null);
    setShowReceiptModal(false);
    setIsCustomPaidInput(false);
    setDiscountType('fixed');
    setDiscountValue(0);
    setUpgradeDate(getTodayStr());

    const higherPlan = availablePlans.find(
      p => !p.isCustom && p.price > currentAmountPaid && p.name.toLowerCase() !== currentPlanName.toLowerCase()
    );
    setSelectedPlanId(higherPlan ? higherPlan.id : (availablePlans[0]?.id || ''));
  }, [isOpen, member, currentAmountPaid, currentPlanName, availablePlans]);

  // Selected plan details
  const selectedPlan = useMemo<PlanOption>(() => {
    const found = availablePlans.find(p => p.id === selectedPlanId);
    if (!found) {
      return availablePlans[0] || {
        id: 'custom',
        name: 'Custom Package',
        price: 5000,
        durationDays: 90,
        durationMonths: 3,
        desc: 'Custom plan'
      };
    }
    if (found.isCustom) {
      return {
        ...found,
        price: customPrice,
        durationMonths: customDurationMonths,
        durationDays: customDurationMonths * 30
      };
    }
    return found;
  }, [availablePlans, selectedPlanId, customPrice, customDurationMonths]);

  // ── Authoritative Calculation Logic ─────────────────────────────────────────
  // New package price
  const newPackagePrice = Math.max(0, Number(selectedPlan.price) || 0);

  // Adjustment logic: Old paid amount is carried forward
  const adjustedAmount = Math.max(0, currentAmountPaid);

  // Upgrade Base Amount before discount:
  const upgradeBaseAmount = Math.max(0, newPackagePrice - adjustedAmount);

  // Discount calculation
  const discountAmount = useMemo(() => {
    const numVal = Math.max(0, Number(discountValue) || 0);
    if (discountType === 'percentage') {
      const clampedPct = Math.min(100, numVal);
      return Math.round((upgradeBaseAmount * clampedPct) / 100);
    }
    return Math.min(upgradeBaseAmount, numVal);
  }, [upgradeBaseAmount, discountType, discountValue]);

  // Net Upgrade Amount Due after discount:
  const netUpgradeAmount = Math.max(0, upgradeBaseAmount - discountAmount);

  // Is cheaper warning: if new package is less than or equal to what was already paid
  const isCheaperOrEqual = newPackagePrice <= adjustedAmount;

  // Sync amountPaidNow with netUpgradeAmount unless user explicitly customized it
  useEffect(() => {
    if (!isCustomPaidInput) {
      setAmountPaidNow(netUpgradeAmount);
    }
  }, [netUpgradeAmount, isCustomPaidInput]);

  const finalAdditionalPaid = Math.max(0, Number(amountPaidNow) || 0);
  const remainingPending = Math.max(0, netUpgradeAmount - finalAdditionalPaid);
  const calculatedPaymentStatus = remainingPending <= 0 ? 'paid' : (finalAdditionalPaid > 0 ? 'partial' : 'pending');

  // Calculated new validity:
  // Upgrade extends/replaces from current start date or today
  const newStartDate = currentStartDate || getTodayStr();
  const newExpiryDate = useMemo(() => {
    if (selectedPlan.durationMonths) {
      return addMonthsToDate(newStartDate, selectedPlan.durationMonths);
    }
    return addDaysToDate(newStartDate, selectedPlan.durationDays || 30);
  }, [newStartDate, selectedPlan]);

  const daysRemaining = membershipEngine.calculateDaysLeft(newExpiryDate);

  // ── Handle Confirm Upgrade ──────────────────────────────────────────────────
  const handleConfirmUpgrade = async () => {
    if (!member?.id) {
      toast.error('Invalid member selected');
      return;
    }

    setIsSubmitting(true);
    const invoiceNum = `INV-UPG-${Math.floor(100000 + Math.random() * 900000)}`;

    const payload = {
      plan: selectedPlan.name,
      packagePrice: newPackagePrice,
      startDate: newStartDate,
      expiryDate: newExpiryDate,
      previousInvoiceId: activePayment?.id || null,
      previousInvoiceNumber: currentInvoiceNumber,
      previousInvoiceDate: currentPaymentDate,
      previousPlan: currentPlanName,
      previousPaidAmount: currentAmountPaid,
      adjustedAmount,
      upgradeBaseAmount,
      discountType,
      discountValue: Math.max(0, Number(discountValue) || 0),
      discountAmount,
      additionalAmountDue: netUpgradeAmount,
      additionalAmountPaid: finalAdditionalPaid,
      paymentMethod,
      paymentStatus: calculatedPaymentStatus,
      invoiceDate: upgradeDate,
      invoiceNumber: invoiceNum,
      notes: notes || `Upgraded from ${currentPlanName} (${currentInvoiceNumber}). Adjusted: ₹${adjustedAmount}, Discount: ₹${discountAmount}, Additional Paid: ₹${finalAdditionalPaid}`,
    };

    try {
      let resData: any;
      try {
        const res = await API.post(`/members/${member.id}/upgrade`, payload);
        resData = res.data;
      } catch (apiErr: any) {
        console.warn('[Upgrade] Direct API unavailable, executing local store sync:', apiErr.message);
        // Fallback: Store methods
        const invoiceData = {
          memberId: member.id,
          memberName: member.name,
          memberPhone: member.phone || '',
          invoiceType: 'MEMBERSHIP',
          billingType: 'MEMBERSHIP',
          transactionType: 'membership_upgrade',
          isUpgrade: true,
          plan: payload.plan,
          packageName: payload.plan,
          previousPlan: payload.previousPlan,
          previousInvoiceNumber: payload.previousInvoiceNumber,
          previousInvoiceDate: payload.previousInvoiceDate,
          previousPaidAmount: payload.previousPaidAmount,
          adjustedAmount: payload.adjustedAmount,
          originalAmount: payload.packagePrice,
          packagePrice: payload.packagePrice,
          baseAmount: payload.packagePrice,
          amountBeforeDiscount: upgradeBaseAmount,
          upgradeBaseAmount: upgradeBaseAmount,
          discountType: payload.discountType,
          discountValue: payload.discountValue,
          discountAmount: payload.discountAmount,
          discount: payload.discountAmount,
          netPayable: netUpgradeAmount,
          additionalAmountDue: netUpgradeAmount,
          amount: payload.packagePrice,
          additionalAmountPaid: payload.additionalAmountPaid,
          amountPaid: payload.additionalAmountPaid,
          paid: payload.additionalAmountPaid,
          totalAmountPaid: payload.adjustedAmount + payload.additionalAmountPaid,
          pendingAmount: remainingPending,
          outstandingAmount: remainingPending,
          remainingBalance: remainingPending,
          paymentMethod: payload.paymentMethod,
          method: payload.paymentMethod,
          paymentStatus: calculatedPaymentStatus,
          status: calculatedPaymentStatus,
          invoiceDate: payload.invoiceDate,
          billingDate: payload.invoiceDate,
          date: payload.invoiceDate,
          paymentDate: payload.invoiceDate,
          transactionDate: payload.invoiceDate,
          membershipStartDate: payload.startDate,
          startDate: payload.startDate,
          membershipExpiryDate: payload.expiryDate,
          expiryDate: payload.expiryDate,
          invoiceNumber: invoiceNum,
          invoice: invoiceNum,
          notes: payload.notes,
          createdAt: new Date().toISOString(),
        };

        const { addPayment, updateMember } = useGymStore.getState();
        await addPayment(invoiceData);

        const currentTotalBilled = Number(member.totalBilled) || Number(member.amount) || currentAmountPaid;
        const currentTotalPaid = Number(member.totalPaid) || Number(member.paid) || currentAmountPaid;

        await updateMember(member.id, {
          plan: payload.plan,
          packageName: payload.plan,
          price: payload.packagePrice,
          amount: payload.packagePrice,
          totalBilled: currentTotalBilled + netUpgradeAmount,
          totalPaid: currentTotalPaid + payload.additionalAmountPaid,
          outstandingBalance: remainingPending,
          startDate: payload.startDate,
          expiryDate: payload.expiryDate,
          status: 'active',
          paymentStatus: calculatedPaymentStatus,
          updatedAt: new Date().toISOString(),
        });

        resData = {
          success: true,
          invoiceNumber: invoiceNum,
          payment: invoiceData,
          member: {
            ...member,
            plan: payload.plan,
            price: payload.packagePrice,
            expiryDate: payload.expiryDate,
          }
        };
      }

      // Refresh cache across store
      await fetchMembers();
      await fetchPayments();

      setCreatedInvoice(resData.payment || {
        ...payload,
        invoiceNumber: invoiceNum,
        amount: newPackagePrice,
        packagePrice: newPackagePrice,
        amountPaid: finalAdditionalPaid,
        pendingAmount: remainingPending,
      });

      setStep(3); // Success step
      toast.success(`Membership successfully upgraded to ${selectedPlan.name}!`);

      if (onSuccess) {
        onSuccess(resData.member || member, resData.payment || createdInvoice);
      }
    } catch (err: any) {
      console.error('[Upgrade] Failed:', err);
      toast.error('Failed to complete upgrade: ' + (err.response?.data?.error || err.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 15 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-2xl border border-slate-200/80 w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh] relative"
      >
        {/* Confetti Effect on Step 3 */}
        {step === 3 && <ConfettiAnimation />}

        {/* ── HEADER ── */}
        <div className="bg-gradient-to-r from-purple-700 via-amber-700 to-orange-700 p-5 text-white flex items-center justify-between shrink-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-32 h-32 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="flex items-center gap-3 relative z-10">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 text-white shadow-inner">
              <TrendingUp size={22} className="text-purple-200" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black tracking-tight">Upgrade Membership</h2>
                <span className="bg-purple-500/40 text-purple-100 text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border border-purple-300/30">
                  Step {step} of 3
                </span>
              </div>
              <p className="text-xs text-purple-100/90 font-medium">
                {member.name} • {member.memberId || 'Member'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors border border-white/10"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── STEP PROGRESS BAR ── */}
        <div className="bg-slate-50 border-b border-slate-200 px-6 py-2.5 flex items-center justify-between text-xs font-bold text-slate-500 shrink-0">
          <div className={`flex items-center gap-2 ${step >= 1 ? 'text-purple-700' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
              step > 1 ? 'bg-purple-600 text-white' : step === 1 ? 'bg-purple-100 text-purple-700 border border-purple-300' : 'bg-slate-200 text-slate-500'
            }`}>
              {step > 1 ? <Check size={11} /> : '1'}
            </span>
            <span>Select & Adjust</span>
          </div>

          <div className="w-10 h-0.5 bg-slate-200" />

          <div className={`flex items-center gap-2 ${step >= 2 ? 'text-purple-700' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
              step > 2 ? 'bg-purple-600 text-white' : step === 2 ? 'bg-purple-100 text-purple-700 border border-purple-300' : 'bg-slate-200 text-slate-500'
            }`}>
              {step > 2 ? <Check size={11} /> : '2'}
            </span>
            <span>Review Details</span>
          </div>

          <div className="w-10 h-0.5 bg-slate-200" />

          <div className={`flex items-center gap-2 ${step === 3 ? 'text-emerald-700' : 'text-slate-400'}`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
              step === 3 ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              3
            </span>
            <span>Confirmed</span>
          </div>
        </div>

        {/* ── MODAL BODY ── */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">

          {/* ═══════════════════════════════════════════════════════════════════════
              STEP 1: SELECT NEW PACKAGE & CALCULATE ADJUSTMENT
          ════════════════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <div className="space-y-6">
              {/* CURRENT MEMBERSHIP CARD */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/90 shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    <h3 className="text-xs font-black uppercase tracking-wider text-slate-600">Current Active Membership</h3>
                  </div>
                  <span className="text-[11px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-700">
                    Bill: {currentInvoiceNumber}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                    <div className="text-slate-400 text-[10px] font-bold uppercase">Package</div>
                    <div className="font-extrabold text-slate-800 truncate mt-0.5">{currentPlanName}</div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                    <div className="text-slate-400 text-[10px] font-bold uppercase">Start - Expiry</div>
                    <div className="font-bold text-slate-800 text-[11px] mt-0.5 truncate">
                      {fmtDate(currentStartDate)} → {fmtDate(currentExpiryDate)}
                    </div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                    <div className="text-slate-400 text-[10px] font-bold uppercase">Original Bill</div>
                    <div className="font-black text-slate-900 mt-0.5">₹{currentBillAmount.toLocaleString('en-IN')}</div>
                  </div>

                  <div className="bg-white p-2.5 rounded-lg border border-slate-100">
                    <div className="text-slate-400 text-[10px] font-bold uppercase">Already Paid</div>
                    <div className="font-black text-emerald-600 mt-0.5">₹{currentAmountPaid.toLocaleString('en-IN')}</div>
                  </div>
                </div>

                {currentPendingAmount > 0 && (
                  <div className="mt-2 text-[11px] text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200 flex items-center gap-1.5 font-medium">
                    <AlertCircle size={13} className="shrink-0 text-amber-600" />
                    <span>Old bill had a pending balance of <strong>₹{currentPendingAmount.toLocaleString('en-IN')}</strong>. This will be carried into the final due calculation.</span>
                  </div>
                )}
              </div>

              {/* NEW PACKAGE SELECTION */}
              <div>
                <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-2">
                  Select New Package to Upgrade
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {availablePlans.map((plan) => {
                    const isSelected = selectedPlanId === plan.id;
                    return (
                      <div
                        key={plan.id}
                        onClick={() => setSelectedPlanId(plan.id)}
                        className={`p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start justify-between ${
                          isSelected
                            ? 'border-purple-600 bg-purple-50/50 shadow-sm ring-2 ring-purple-500/20'
                            : 'border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50/60'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="font-extrabold text-sm text-slate-900 flex items-center gap-1.5">
                            {plan.name}
                            {isSelected && <Check size={14} className="text-purple-600 shrink-0" />}
                          </div>
                          <p className="text-[11px] text-slate-500">{plan.desc}</p>
                          <div className="text-[10px] font-bold text-purple-700 font-mono pt-1">
                            Validity: {plan.durationMonths ? `${plan.durationMonths} Months` : `${plan.durationDays} Days`}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-black text-slate-900">
                            {plan.isCustom ? (
                              <span className="text-xs text-purple-600 font-bold">Custom</span>
                            ) : (
                              `₹${plan.price.toLocaleString('en-IN')}`
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Custom Package Form Fields */}
                {selectedPlan.isCustom && (
                  <div className="mt-3 p-3 bg-purple-50/60 rounded-xl border border-purple-200 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Custom Price (₹)</label>
                      <input
                        type="number"
                        min="0"
                        value={customPrice}
                        onChange={(e) => setCustomPrice(Math.max(0, Number(e.target.value)))}
                        className="w-full text-xs font-bold px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-purple-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Duration (Months)</label>
                      <input
                        type="number"
                        min="1"
                        max="36"
                        value={customDurationMonths}
                        onChange={(e) => setCustomDurationMonths(Math.max(1, Number(e.target.value)))}
                        className="w-full text-xs font-bold px-3 py-1.5 border border-slate-300 rounded-lg bg-white focus:outline-hidden focus:border-purple-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* AUTOMATIC UPGRADE ADJUSTMENT & DISCOUNT BREAKDOWN */}
              <div className="bg-gradient-to-br from-purple-50 via-amber-50/40 to-slate-50 rounded-xl p-4 border border-purple-200/80 space-y-3.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-purple-600" />
                    Automatic Financial Adjustment & Discount
                  </span>
                  <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded">
                    Old Payment Protected
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center text-slate-700">
                    <span>New Package Total Price:</span>
                    <span className="font-black text-slate-900 text-sm">₹{newPackagePrice.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="flex justify-between items-center text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={13} />
                      Carried Forward / Adjusted from Previous Bill:
                    </span>
                    <span className="font-black font-mono">- ₹{adjustedAmount.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="border-t border-purple-200/60 pt-2 flex justify-between items-center text-slate-800">
                    <span className="font-extrabold">Upgrade Amount Before Discount:</span>
                    <span className="font-black font-mono text-sm">₹{upgradeBaseAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>

                {/* ── DISCOUNT INPUT SECTION ── */}
                <div className="bg-white p-3 rounded-xl border border-purple-100 shadow-2xs space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Tag size={13} className="text-purple-600" />
                      Apply Upgrade Discount (Optional)
                    </label>

                    {/* Discount Type Toggle: Fixed ₹ vs % Percent */}
                    <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                      <button
                        type="button"
                        onClick={() => setDiscountType('fixed')}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                          discountType === 'fixed'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Banknote size={11} /> ₹ Fixed Amount
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType('percentage')}
                        className={`px-2.5 py-1 rounded-md text-[10px] font-black transition-all cursor-pointer flex items-center gap-1 ${
                          discountType === 'percentage'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Percent size={11} /> % Percentage
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center pt-1">
                    <div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                          {discountType === 'fixed' ? '₹' : '%'}
                        </span>
                        <input
                          type="number"
                          min="0"
                          max={discountType === 'percentage' ? 100 : upgradeBaseAmount}
                          value={discountValue || ''}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            setDiscountValue(isNaN(val) ? 0 : Math.max(0, val));
                          }}
                          placeholder={discountType === 'fixed' ? 'e.g. 1900' : 'e.g. 10'}
                          className="w-full text-xs font-bold pl-7 pr-3 py-2 border border-slate-300 rounded-lg bg-slate-50 focus:bg-white focus:outline-hidden focus:border-purple-500 font-mono"
                        />
                      </div>
                    </div>

                    <div className="text-right">
                      {discountAmount > 0 ? (
                        <div className="text-xs font-extrabold text-emerald-600 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-100 flex items-center justify-between">
                          <span>Discount Applied:</span>
                          <span className="font-black font-mono">- ₹{discountAmount.toLocaleString('en-IN')}</span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-slate-400 font-medium">No discount applied</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* NET UPGRADE AMOUNT DUE ROW */}
                <div className="border-t border-purple-200 pt-2 flex justify-between items-center bg-purple-100/50 p-2.5 rounded-lg">
                  <div>
                    <span className="font-extrabold text-purple-950 text-sm block">Net Upgrade Amount Due:</span>
                    <span className="text-[10px] text-purple-700 font-medium">Payable amount after adjustment & discount</span>
                  </div>
                  <span className="font-black text-purple-950 text-lg font-mono">₹{netUpgradeAmount.toLocaleString('en-IN')}</span>
                </div>

                {isCheaperOrEqual && (
                  <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-start gap-2">
                    <ShieldAlert size={16} className="text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Lower/Equal Price Package Notice</div>
                      <div>The selected package price (₹{newPackagePrice.toLocaleString('en-IN')}) is less than or equal to what was already paid (₹{adjustedAmount.toLocaleString('en-IN')}). No additional cash payment is due. Remaining credit will not be automatically refunded.</div>
                    </div>
                  </div>
                )}
              </div>

              {/* PAYMENT COLLECTION INPUTS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Amount Paid Today (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={netUpgradeAmount}
                    value={amountPaidNow}
                    onChange={(e) => {
                      setIsCustomPaidInput(true);
                      setAmountPaidNow(Math.max(0, Number(e.target.value)));
                    }}
                    className="w-full text-sm font-black px-3.5 py-2 border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:border-purple-500 font-mono"
                    placeholder="Enter amount paid"
                  />
                  <div className="text-[10px] text-slate-400 mt-1 font-medium">
                    {remainingPending > 0 ? (
                      <span className="text-amber-600 font-bold">Remaining balance: ₹{remainingPending.toLocaleString('en-IN')}</span>
                    ) : (
                      <span className="text-emerald-600 font-bold">✓ Full upgrade amount covered (Balance: ₹0)</span>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full text-xs font-bold px-3.5 py-2.5 border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:border-purple-500"
                  >
                    <option value="UPI">UPI (Google Pay / PhonePe / Paytm)</option>
                    <option value="Cash">Cash</option>
                    <option value="Card">Credit / Debit Card</option>
                    <option value="Net Banking">Net Banking</option>
                  </select>
                </div>
              </div>

              {/* CALCULATION SUMMARY CARD */}
              <div className="bg-slate-900 text-white rounded-2xl p-4.5 shadow-md space-y-3 border border-slate-800">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Receipt size={13} className="text-purple-400" />
                    Upgrade Billing Calculation Summary
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-purple-950/80 text-purple-300 px-2 py-0.5 rounded border border-purple-800/60">
                    Authoritative Formula
                  </span>
                </div>

                <div className="space-y-2 text-xs font-semibold">
                  <div className="flex justify-between items-center text-slate-300">
                    <span>Upgrade Amount (Difference):</span>
                    <span className="font-mono font-bold text-white text-sm">₹{upgradeBaseAmount.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="flex justify-between items-center text-emerald-400">
                    <span>Discount (Adjustment/Concession):</span>
                    <span className="font-mono font-bold text-sm">{discountAmount > 0 ? `- ₹${discountAmount.toLocaleString('en-IN')}` : '₹0'}</span>
                  </div>

                  <div className="border-t border-dashed border-slate-700 pt-2 flex justify-between items-center text-purple-300 font-extrabold">
                    <span>Net Payable:</span>
                    <span className="font-mono font-black text-sm text-purple-200">₹{netUpgradeAmount.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="flex justify-between items-center text-emerald-300 font-extrabold">
                    <span>Amount Paid Today (Collection):</span>
                    <span className="font-mono font-black text-sm text-emerald-400">₹{finalAdditionalPaid.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="border-t border-slate-700 pt-2 flex justify-between items-center font-black">
                    <span className="text-slate-300">Remaining Balance:</span>
                    <span className={`font-mono text-base ${remainingPending > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                      ₹{remainingPending.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              {/* UPGRADE DATE & NOTES */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Upgrade Transaction Date
                  </label>
                  <input
                    type="date"
                    value={upgradeDate}
                    onChange={(e) => setUpgradeDate(e.target.value)}
                    className="w-full text-xs font-semibold px-3.5 py-2 border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:border-purple-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">Old bill date ({fmtDate(currentPaymentDate)}) will remain unchanged.</p>
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-700 mb-1.5">
                    Notes / Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Upgraded after trial period"
                    className="w-full text-xs font-medium px-3.5 py-2 border border-slate-300 rounded-xl bg-white focus:outline-hidden focus:border-purple-500"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════
              STEP 2: REVIEW BEFORE CONFIRMING
          ════════════════════════════════════════════════════════════════════════ */}
          {step === 2 && (
            <div className="space-y-5">
              <div className="text-center pb-2">
                <h3 className="text-base font-black text-slate-900">Review Upgrade Summary</h3>
                <p className="text-xs text-slate-500">
                  Please verify all financial calculations and details below before confirming.
                </p>
              </div>

              {/* COMPREHENSIVE REVIEW TABLE */}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <div className="bg-slate-100 px-4 py-2.5 text-xs font-extrabold text-slate-700 uppercase tracking-wider flex justify-between items-center">
                  <span>Upgrade Verification Breakdown</span>
                  <span className="font-mono text-purple-700 font-bold">The Warrior Gym</span>
                </div>

                <div className="divide-y divide-slate-100 text-xs">
                  {/* Member Details */}
                  <div className="grid grid-cols-2 p-3 bg-white">
                    <div>
                      <div className="text-slate-400 text-[10px] font-bold uppercase">Member</div>
                      <div className="font-extrabold text-slate-900 text-sm mt-0.5">{member.name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">ID: {member.memberId || member.id}</div>
                    </div>
                    <div className="border-l border-slate-100 pl-4">
                      <div className="text-slate-400 text-[10px] font-bold uppercase">Upgrade Transaction Date</div>
                      <div className="font-mono font-bold text-slate-800 text-sm mt-0.5">{fmtDate(upgradeDate)}</div>
                      <div className="text-[10px] text-slate-400">Payment Mode: {paymentMethod}</div>
                    </div>
                  </div>

                  {/* Current vs Upgraded Package */}
                  <div className="grid grid-cols-2 p-3 bg-slate-50/50">
                    <div>
                      <div className="text-slate-400 text-[10px] font-bold uppercase">Current Package</div>
                      <div className="font-extrabold text-slate-800 text-sm mt-0.5">{currentPlanName}</div>
                      <div className="text-[11px] text-slate-500 font-mono">Old Invoice: {currentInvoiceNumber}</div>
                      <div className="text-[10px] text-slate-400">Old Date: {fmtDate(currentPaymentDate)}</div>
                    </div>
                    <div className="border-l border-slate-100 pl-4">
                      <div className="text-purple-600 text-[10px] font-bold uppercase">New Package</div>
                      <div className="font-extrabold text-purple-900 text-sm mt-0.5">{selectedPlan.name}</div>
                      <div className="text-[11px] text-purple-700 font-mono">New Validity: {fmtDate(newStartDate)} → {fmtDate(newExpiryDate)}</div>
                      <div className="text-[10px] text-purple-600 font-semibold">{daysRemaining} Days Remaining</div>
                    </div>
                  </div>

                  {/* Financial Breakdown Table Rows */}
                  <div className="p-3 bg-white flex justify-between items-center">
                    <span className="text-slate-600">Previous Paid Amount:</span>
                    <span className="font-bold font-mono text-slate-800">₹{currentAmountPaid.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="p-3 bg-white flex justify-between items-center">
                    <span className="font-bold text-slate-700">New Package Price:</span>
                    <span className="font-black font-mono text-slate-900 text-sm">₹{newPackagePrice.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="p-3 bg-emerald-50/60 flex justify-between items-center text-emerald-900 font-semibold">
                    <span className="flex items-center gap-1">
                      <CheckCircle2 size={13} className="text-emerald-600" />
                      Carried Forward Adjustment:
                    </span>
                    <span className="font-black font-mono text-sm">- ₹{adjustedAmount.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="p-3 bg-white flex justify-between items-center">
                    <span className="font-bold text-slate-700">Upgrade Amount Before Discount:</span>
                    <span className="font-black font-mono text-slate-900 text-sm">₹{upgradeBaseAmount.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="p-3 bg-emerald-50/40 flex justify-between items-center text-emerald-800">
                    <div>
                      <span className="font-bold">Discount ({discountType === 'percentage' ? `${discountValue}%` : 'Fixed Amount'}):</span>
                      <span className="text-[10px] text-emerald-600 block">Applied to upgrade balance</span>
                    </div>
                    <span className="font-black font-mono text-sm text-emerald-700">
                      {discountAmount > 0 ? `- ₹${discountAmount.toLocaleString('en-IN')}` : '₹0'}
                    </span>
                  </div>

                  <div className="p-3 bg-purple-50 flex justify-between items-center text-purple-950 font-black">
                    <span className="text-sm">Net Upgrade Amount Payable:</span>
                    <span className="font-mono text-base text-purple-900">₹{netUpgradeAmount.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="p-3 bg-white flex justify-between items-center font-bold">
                    <span className="text-slate-700">Amount Paid Today ({paymentMethod}):</span>
                    <span className="font-black font-mono text-emerald-600 text-base">₹{finalAdditionalPaid.toLocaleString('en-IN')}</span>
                  </div>

                  <div className={`p-3 flex justify-between items-center font-bold ${
                    remainingPending > 0 ? 'bg-rose-50 text-rose-800' : 'bg-emerald-50 text-emerald-800'
                  }`}>
                    <span>Remaining Balance:</span>
                    <div className="text-right">
                      <span className="font-black font-mono text-base">₹{remainingPending.toLocaleString('en-IN')}</span>
                      <span className={`text-[10px] font-black uppercase block ${
                        remainingPending <= 0 ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        Status: {calculatedPaymentStatus.toUpperCase()}
                      </span>
                    </div>
                  </div>

                  {notes && (
                    <div className="p-3 bg-slate-50 text-slate-600">
                      <div className="text-[10px] font-bold text-slate-400 uppercase">Notes / Remarks</div>
                      <div className="font-medium text-xs mt-0.5">{notes}</div>
                    </div>
                  )}
                </div>
              </div>

              {/* AUDIT NOTICE */}
              <div className="text-[11px] text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center gap-2">
                <ShieldAlert size={15} className="text-slate-400 shrink-0" />
                <span>
                  This action is permanent and creates an official linked upgrade bill while preserving the original bill history.
                </span>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════
              STEP 3: SUCCESS CONFIRMATION
          ════════════════════════════════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 size={36} />
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900">Membership Upgrade Complete!</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                  {member.name} has been upgraded to <strong>{selectedPlan.name}</strong>. The old payment was adjusted, discount was recorded, and a new invoice was generated.
                </p>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 max-w-sm mx-auto text-xs space-y-2 text-left font-medium">
                <div className="flex justify-between">
                  <span className="text-slate-400">Upgrade Invoice:</span>
                  <span className="font-mono font-black text-purple-700">{createdInvoice?.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">New Package:</span>
                  <span className="font-bold text-slate-800">{selectedPlan.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Package Price:</span>
                  <span className="font-black text-slate-900">₹{newPackagePrice.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Previous Adjusted:</span>
                  <span className="font-bold text-emerald-600">₹{adjustedAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Upgrade Base Amount:</span>
                  <span className="font-bold text-slate-800">₹{upgradeBaseAmount.toLocaleString('en-IN')}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Discount Applied:</span>
                    <span className="font-mono">- ₹{discountAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-slate-400">Net Upgrade Amount:</span>
                  <span className="font-black text-purple-900">₹{netUpgradeAmount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Additional Collected:</span>
                  <span className="font-black text-slate-900">₹{finalAdditionalPaid.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Remaining Balance:</span>
                  <span className={`font-black ${remainingPending > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    ₹{remainingPending.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">New Expiry Date:</span>
                  <span className="font-bold text-purple-900 font-mono">{fmtDate(newExpiryDate)}</span>
                </div>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowReceiptModal(true)}
                  className="px-4 py-2 bg-[#EA580C] hover:bg-orange-700 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <Eye size={14} /> View Upgraded Invoice
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ACTIONS ── */}
        <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
          {step === 1 && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={() => setStep(2)}
                className="px-5 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-purple-500/20 transition-all cursor-pointer"
              >
                Review Upgrade <ArrowRight size={14} />
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200/70 transition-colors flex items-center gap-1.5"
              >
                <ArrowLeft size={14} /> Back
              </button>

              <button
                type="button"
                onClick={handleConfirmUpgrade}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-amber-600 hover:from-purple-700 hover:to-amber-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-lg shadow-purple-500/30 transition-all cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Processing Upgrade...
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    Confirm Upgrade
                  </>
                )}
              </button>
            </>
          )}

          {step === 3 && (
            <div className="w-full flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          )}
        </div>

        {/* ── EMBEDDED OFFICIAL INVOICE RECEIPT MODAL ── */}
        {showReceiptModal && createdInvoice && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 relative">
              <div className="flex justify-between items-center mb-4 pb-3 border-b border-slate-200">
                <h3 className="text-sm font-black uppercase text-slate-800">Official Upgrade Invoice Receipt</h3>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <OfficialInvoiceReceipt
                invoice={createdInvoice}
                member={member}
              />

              <div className="mt-4 pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer hover:bg-black"
                >
                  <Printer size={14} /> Print Invoice
                </button>
                <button
                  onClick={() => setShowReceiptModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 text-xs font-bold rounded-lg hover:bg-slate-200 cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}
