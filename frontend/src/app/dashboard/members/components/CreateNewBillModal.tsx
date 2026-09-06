'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Calendar, AlertCircle, AlertTriangle, Check, DollarSign, CreditCard } from 'lucide-react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { membershipEngine } from '@/lib/engines/membershipEngine';
import { db } from '@/lib/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';
import { useGymStore } from '@/store';
import toast from '@/lib/toast';

// ── ZOD VALIDATION SCHEMA ──────────────────────────────────────────────────
const createBillSchema = z.object({
  plan: z.string().min(1, 'Package selection is required'),
  amount: z.coerce.number().min(0, 'Amount cannot be negative'),
  method: z.string().min(1, 'Payment mode is required'),
  startDate: z.string().min(1, 'Start date is required.'),
  expiryDate: z.string().min(1, 'Expiry date is required.'),
}).superRefine((data, ctx) => {
  if (!data.startDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['startDate'],
      message: 'Start date is required.',
    });
  }
  if (!data.expiryDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['expiryDate'],
      message: 'Expiry date is required.',
    });
    return;
  }

  if (data.startDate && data.expiryDate) {
    const start = new Date(data.startDate);
    const expiry = new Date(data.expiryDate);

    if (isNaN(start.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['startDate'],
        message: 'Invalid start date format.',
      });
      return;
    }

    if (isNaN(expiry.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiryDate'],
        message: 'Invalid expiry date format.',
      });
      return;
    }

    const sTime = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
    const eTime = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate()).getTime();

    if (eTime < sTime) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['expiryDate'],
        message: 'Expiry date cannot be earlier than the start date.',
      });
    }
  }
});

type CreateBillFormInput = z.input<typeof createBillSchema>;
type CreateBillFormOutput = z.output<typeof createBillSchema>;

interface CreateNewBillModalProps {
  isOpen: boolean;
  member: any;
  onClose: () => void;
  onSaved?: () => void;
}

export default function CreateNewBillModal({
  isOpen,
  member,
  onClose,
  onSaved,
}: CreateNewBillModalProps) {
  const { fetchMembers } = useGymStore();
  const [showShorterConfirmation, setShowShorterConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<CreateBillFormOutput | null>(null);

  // Default Package Options & Pricing
  const packages = useMemo(() => [
    { label: '1 Month Standard', value: '1 Month Standard', price: 2500 },
    { label: '3 Months (Quarterly)', value: '3 Months (Quarterly)', price: 6500 },
    { label: '6 Months (Semi-Annual)', value: '6 Months (Semi-Annual)', price: 11500 },
    { label: '12 Months (Annual)', value: '12 Months (Annual)', price: 18000 },
  ], []);

  // Compute Initial Dates based on Renewal Logic (Requirement 1 & 12)
  const initialStartDate = useMemo(() => {
    return membershipEngine.calculateAutoStartDate(member);
  }, [member]);

  const initialExpiryDate = useMemo(() => {
    return membershipEngine.calculateMembershipExpiry(initialStartDate, '3 Months (Quarterly)');
  }, [initialStartDate]);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isValid },
  } = useForm<CreateBillFormInput, any, CreateBillFormOutput>({
    resolver: zodResolver(createBillSchema),
    mode: 'onChange', // Real-time validation (Requirement 7)
    defaultValues: {
      plan: '3 Months (Quarterly)',
      amount: 6500,
      method: 'UPI',
      startDate: initialStartDate,
      expiryDate: initialExpiryDate,
    },
  });

  const selectedPlan = watch('plan');
  const startDate = watch('startDate');
  const expiryDate = watch('expiryDate');

  // Reset values when modal opens or member changes
  useEffect(() => {
    if (isOpen && member) {
      const autoStart = membershipEngine.calculateAutoStartDate(member);
      const autoExpiry = membershipEngine.calculateMembershipExpiry(autoStart, '3 Months (Quarterly)');
      setValue('plan', '3 Months (Quarterly)', { shouldValidate: true });
      setValue('amount', 6500, { shouldValidate: true });
      setValue('method', 'UPI', { shouldValidate: true });
      setValue('startDate', autoStart, { shouldValidate: true });
      setValue('expiryDate', autoExpiry, { shouldValidate: true });
      setShowShorterConfirmation(false);
    }
  }, [isOpen, member, setValue]);

  // When package changes: Auto update price, and recalculate Expiry Date (Requirement 1)
  const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPlan = e.target.value;
    let price = 2500;
    if (newPlan.includes('3 Month') || newPlan.includes('Quarterly')) price = 6500;
    if (newPlan.includes('6 Month') || newPlan.includes('Semi')) price = 11500;
    if (newPlan.includes('12 Month') || newPlan.includes('Annual')) price = 18000;

    setValue('plan', newPlan, { shouldValidate: true });
    setValue('amount', price, { shouldValidate: true });

    // Recalculate Expiry Date based on current Start Date + selected Package Duration
    if (startDate) {
      const newExpiry = membershipEngine.calculateMembershipExpiry(startDate, newPlan);
      setValue('expiryDate', newExpiry, { shouldValidate: true });
    }
  };

  // When Start Date changes: Auto recalculate Expiry Date (Requirement 2)
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value;
    setValue('startDate', newStart, { shouldValidate: true });

    if (newStart && selectedPlan) {
      const newExpiry = membershipEngine.calculateMembershipExpiry(newStart, selectedPlan);
      setValue('expiryDate', newExpiry, { shouldValidate: true });
    }
  };

  // Expected Expiry Calculation for Non-Blocking Warning (Requirement 9)
  const expectedExpiry = useMemo(() => {
    if (!startDate || !selectedPlan) return '';
    return membershipEngine.calculateMembershipExpiry(startDate, selectedPlan);
  }, [startDate, selectedPlan]);

  const isShorterThanExpected = useMemo(() => {
    if (!startDate || !expiryDate || !expectedExpiry) return false;
    const expTime = new Date(expiryDate).getTime();
    const expExpectedTime = new Date(expectedExpiry).getTime();
    const sTime = new Date(startDate).getTime();
    return expTime >= sTime && expTime < expExpectedTime;
  }, [startDate, expiryDate, expectedExpiry]);

  // Compute status & auto-start info
  const isMemberActive = useMemo(() => {
    if (!member || !member.expiryDate) return false;
    const exp = new Date(member.expiryDate);
    if (isNaN(exp.getTime())) return false;
    const today = new Date();
    const eDay = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
    const tDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return eDay.getTime() >= tDay.getTime();
  }, [member]);

  const autoExtensionStart = useMemo(() => {
    return membershipEngine.calculateAutoStartDate(member);
  }, [member]);

  const isManualStartOverride = useMemo(() => {
    if (!isMemberActive || !startDate) return false;
    return startDate !== autoExtensionStart;
  }, [isMemberActive, startDate, autoExtensionStart]);

  // Final submission execution
  const executeSaveBill = async (data: CreateBillFormOutput) => {
    if (!member) return;
    setIsSubmitting(true);
    try {
      const invNum = `INV-${Math.floor(10000 + Math.random() * 90000)}`;
      const origAmt = Number(data.amount);
      const discAmt = 0;
      const netPayable = origAmt - discAmt;

      const newBill = {
        memberId: member.id,
        memberName: member.name,
        memberPhone: member.phone || '',
        invoiceNumber: invNum,
        invoice: invNum,
        plan: data.plan,
        originalAmount: origAmt,
        discountAmount: discAmt,
        discount: discAmt,
        taxAmount: 0,
        otherCharges: 0,
        netPayable: netPayable,
        amount: netPayable,
        amountPaid: netPayable,
        paid: netPayable,
        outstandingAmount: 0,
        pendingAmount: 0,
        method: data.method,
        status: 'paid',
        date: new Date().toISOString().split('T')[0],
        paymentDate: new Date().toISOString().split('T')[0],
        transactionType: 'membership_payment',
        isHistorical: false,
        imported: false,
        startDate: data.startDate,
        expiryDate: data.expiryDate,
        createdAt: new Date().toISOString(),
        isRealTimeToday: true,
      };

      // 1. Create separate payment invoice document
      await setDoc(doc(db, 'payments', `inv_${Date.now()}`), newBill);

      // 2. Append to membershipHistory array
      const existingHistory = Array.isArray(member.membershipHistory) ? member.membershipHistory : [];
      const newHistoryEntry = {
        plan: data.plan,
        startDate: data.startDate,
        expiryDate: data.expiryDate,
        amount: netPayable,
        invoiceId: invNum,
        createdAt: new Date().toISOString(),
      };
      const updatedHistory = [...existingHistory, newHistoryEntry];

      // 3. Update Member Document with latest coverage
      await updateDoc(doc(db, 'members', member.id), {
        plan: data.plan,
        startDate: member.startDate || data.startDate,
        expiryDate: data.expiryDate,
        status: 'active',
        paymentStatus: 'paid',
        membershipHistory: updatedHistory,
      });

      toast.success(`Bill ${invNum} generated successfully!`);
      fetchMembers();
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      toast.error('Failed to generate bill: ' + (err?.message || err));
    } finally {
      setIsSubmitting(false);
      setShowShorterConfirmation(false);
    }
  };

  // Form submit handler
  const onSubmit = (data: CreateBillFormOutput) => {
    if (isShorterThanExpected) {
      // Require confirmation before saving a manually shortened membership (Requirement 9)
      setPendingFormData(data);
      setShowShorterConfirmation(true);
      return;
    }
    executeSaveBill(data);
  };

  if (!isOpen || !member) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 relative border border-slate-100 max-h-[95vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <Plus size={18} className="text-[#EA580C]" /> Create New Bill for {member.name}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full border-none bg-transparent cursor-pointer transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Current Membership Summary Card */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Current Membership</span>
            <span className={`text-[8.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              isMemberActive 
                ? 'bg-emerald-50 text-emerald-600 border-emerald-200' 
                : 'bg-red-50 text-red-600 border-red-200'
            }`}>
              {isMemberActive ? 'ACTIVE' : 'EXPIRED'}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 text-left pt-1">
            <div>
              <span className="text-[9px] text-slate-400 font-bold block uppercase">Plan</span>
              <span className="text-[11px] font-extrabold text-slate-800 truncate block">
                {member.plan || 'Standard'}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-bold block uppercase">Current Start</span>
              <span className="text-[11px] font-extrabold text-slate-800 block">
                {member.startDate || member.joinDate || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-[9px] text-slate-400 font-bold block uppercase">Current Expiry</span>
              <span className="text-[11px] font-extrabold text-slate-800 block">
                {member.expiryDate || 'N/A'}
              </span>
            </div>
          </div>
        </div>

        {/* Extension Indicator Message */}
        {isMemberActive && (
          <div className={`p-2.5 rounded-xl text-[11px] font-bold flex items-center gap-1.5 border ${
            isManualStartOverride 
              ? 'bg-amber-50 text-amber-700 border-amber-200' 
              : 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]'
          }`}>
            {isManualStartOverride ? (
              <>
                <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                <span>Manual start date override</span>
              </>
            ) : (
              <>
                <Check size={14} className="text-[#F97316] shrink-0" />
                <span>Membership will be extended from current expiry ({member.expiryDate}).</span>
              </>
            )}
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 text-xs">
          
          {/* Select Package */}
          <div>
            <label className="font-extrabold text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">
              Select Package
            </label>
            <select
              value={selectedPlan}
              onChange={handlePlanChange}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-orange-200 transition-all cursor-pointer"
            >
              {packages.map((pkg) => (
                <option key={pkg.value} value={pkg.value}>
                  {pkg.label} (₹{pkg.price.toLocaleString('en-IN')})
                </option>
              ))}
            </select>
            {errors.plan && (
              <p className="mt-1 text-[11px] font-bold text-red-500 flex items-center gap-1">
                <AlertCircle size={12} className="text-red-500 shrink-0" /> {errors.plan.message}
              </p>
            )}
          </div>

          {/* Amount & Payment Mode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-extrabold text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">
                Amount (₹)
              </label>
              <div className="relative flex items-center">
                <input
                  type="number"
                  {...register('amount')}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-orange-200 transition-all"
                />
              </div>
              {errors.amount && (
                <p className="mt-1 text-[11px] font-bold text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} className="text-red-500 shrink-0" /> {errors.amount.message}
                </p>
              )}
            </div>

            <div>
              <label className="font-extrabold text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">
                Payment Mode
              </label>
              <select
                {...register('method')}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-[#F97316] focus:ring-2 focus:ring-orange-200 transition-all cursor-pointer"
              >
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Bank">Bank Transfer</option>
              </select>
              {errors.method && (
                <p className="mt-1 text-[11px] font-bold text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} className="text-red-500 shrink-0" /> {errors.method.message}
                </p>
              )}
            </div>
          </div>

          {/* Start Date & Expiry Date Fields */}
          <div className="grid grid-cols-2 gap-3">
            
            {/* Start Date Field */}
            <div>
              <label className="font-extrabold text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">
                Start Date
              </label>
              <div className="relative flex items-center">
                <input
                  type="date"
                  value={startDate || ''}
                  onChange={handleStartDateChange}
                  className={`w-full p-2.5 rounded-xl font-bold text-slate-800 outline-none transition-all ${
                    errors.startDate
                      ? 'bg-red-50/40 border-2 border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                      : 'bg-slate-50 border border-slate-200 focus:border-[#F97316] focus:ring-2 focus:ring-orange-200'
                  }`}
                />
              </div>

              {/* Requirement 6: Start Date Error directly under field */}
              {errors.startDate && (
                <p className="mt-1 text-[11px] font-bold text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} className="text-red-500 shrink-0" /> {errors.startDate.message}
                </p>
              )}
            </div>

            {/* Expiry Date Field */}
            <div>
              <label className="font-extrabold text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">
                Expiry Date
              </label>
              <div className="relative flex items-center">
                <input
                  type="date"
                  value={expiryDate || ''}
                  onChange={(e) => setValue('expiryDate', e.target.value, { shouldValidate: true })}
                  className={`w-full p-2.5 rounded-xl font-bold text-slate-800 outline-none transition-all ${
                    errors.expiryDate
                      ? 'bg-red-50/40 border-2 border-red-500 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                      : isShorterThanExpected
                      ? 'bg-amber-50/40 border-2 border-amber-400 focus:border-amber-500 focus:ring-2 focus:ring-amber-100'
                      : 'bg-slate-50 border border-slate-200 focus:border-[#F97316] focus:ring-2 focus:ring-orange-200'
                  }`}
                />
              </div>

              {/* Requirement 3 & 5: Expiry Date Error directly under field (NO POPUP) */}
              {errors.expiryDate && (
                <p className="mt-1 text-[11px] font-bold text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} className="text-red-500 shrink-0" /> {errors.expiryDate.message}
                </p>
              )}

              {/* Requirement 9: Non-blocking warning under field if shorter than expected */}
              {!errors.expiryDate && isShorterThanExpected && (
                <p className="mt-1 text-[10.5px] font-bold text-amber-600 flex items-start gap-1 leading-snug">
                  <AlertTriangle size={12} className="text-amber-500 shrink-0 mt-0.5" />
                  Expiry date is earlier than the expected membership period.
                </p>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="flex-1 py-3 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black transition-all border-none cursor-pointer shadow-md flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? 'Processing...' : 'Generate Bill & Activate'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border-none cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>

        {/* Requirement 9: Confirmation Dialog for manually shortened expiry */}
        {showShorterConfirmation && pendingFormData && (
          <div className="absolute inset-0 z-50 bg-slate-900/85 backdrop-blur-sm rounded-3xl p-6 flex flex-col justify-center items-center text-center animate-fade-in">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center mb-3">
              <AlertTriangle size={24} />
            </div>
            <h4 className="text-sm font-black text-white mb-1">
              Shortened Expiry Date Warning
            </h4>
            <p className="text-xs text-slate-300 mb-5 font-semibold px-2">
              Selected expiry date ({expiryDate}) is shorter than the selected package duration ({selectedPlan}). Continue anyway?
            </p>
            <div className="flex gap-3 w-full max-w-xs">
              <button
                type="button"
                onClick={() => executeSaveBill(pendingFormData)}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-xl text-xs shadow-md transition-all border-none cursor-pointer"
              >
                Yes, Continue
              </button>
              <button
                type="button"
                onClick={() => setShowShorterConfirmation(false)}
                className="flex-1 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-xl text-xs transition-all border-none cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
