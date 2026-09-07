'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Plus, X, Calendar, AlertCircle, AlertTriangle, Check, DollarSign, CreditCard, Receipt, User, ShieldCheck } from 'lucide-react';
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
  originalAmount: z.coerce.number().min(0, 'Package amount cannot be negative'),
  discount: z.coerce.number().min(0, 'Discount cannot be negative').default(0),
  tax: z.coerce.number().min(0, 'Tax cannot be negative').default(0),
  amountPaid: z.coerce.number().min(0, 'Amount paid cannot be negative'),
  method: z.string().min(1, 'Payment mode is required'),
  paymentStatus: z.string().default('paid'),
  startDate: z.string().min(1, 'Start date is required.'),
  expiryDate: z.string().min(1, 'Expiry date is required.'),
  notes: z.string().optional(),
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
        message: 'Expiry date cannot be earlier than start date.',
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
  const { fetchMembers, addPayment } = useGymStore();
  const [showShorterConfirmation, setShowShorterConfirmation] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pendingFormData, setPendingFormData] = useState<CreateBillFormOutput | null>(null);

  // Default Package Options & Pricing
  const packages = useMemo(() => [
    { label: '1 Month Standard', value: '1 Month Standard', price: 2500 },
    { label: '3 Months (Quarterly)', value: '3 Months (Quarterly)', price: 6500 },
    { label: '6 Months (Semi-Annual)', value: '6 Months (Semi-Annual)', price: 11500 },
    { label: '12 Months (Annual)', value: '12 Months (Annual)', price: 18000 },
    { label: 'Custom Plan', value: 'Custom Plan', price: 3000 },
  ], []);

  const isHoldMember = useMemo(() => {
    return (member?.status || '').toLowerCase() === 'hold';
  }, [member]);

  const initialStartDate = useMemo(() => {
    if (isHoldMember || !member?.expiryDate) {
      return new Date().toISOString().split('T')[0];
    }
    return membershipEngine.calculateAutoStartDate(member);
  }, [member, isHoldMember]);

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
    mode: 'onChange',
    defaultValues: {
      plan: '3 Months (Quarterly)',
      originalAmount: 6500,
      discount: 0,
      tax: 0,
      amountPaid: 6500,
      method: 'UPI',
      paymentStatus: 'paid',
      startDate: initialStartDate,
      expiryDate: initialExpiryDate,
      notes: '',
    },
  });

  const selectedPlan = watch('plan');
  const startDate = watch('startDate');
  const expiryDate = watch('expiryDate');
  const originalAmount = Number(watch('originalAmount') || 0);
  const discount = Number(watch('discount') || 0);
  const tax = Number(watch('tax') || 0);
  const amountPaid = Number(watch('amountPaid') || 0);

  // Live calculations
  const netPayable = useMemo(() => {
    return Math.max(0, originalAmount - discount + tax);
  }, [originalAmount, discount, tax]);

  const pendingBalance = useMemo(() => {
    return Math.max(0, netPayable - amountPaid);
  }, [netPayable, amountPaid]);

  // Reset values when modal opens or member changes
  useEffect(() => {
    if (isOpen && member) {
      const autoStart = (member.status || '').toLowerCase() === 'hold' || !member.expiryDate
        ? new Date().toISOString().split('T')[0]
        : membershipEngine.calculateAutoStartDate(member);
      const autoExpiry = membershipEngine.calculateMembershipExpiry(autoStart, '3 Months (Quarterly)');

      setValue('plan', '3 Months (Quarterly)', { shouldValidate: true });
      setValue('originalAmount', 6500, { shouldValidate: true });
      setValue('discount', 0, { shouldValidate: true });
      setValue('tax', 0, { shouldValidate: true });
      setValue('amountPaid', 6500, { shouldValidate: true });
      setValue('method', 'UPI', { shouldValidate: true });
      setValue('paymentStatus', 'paid', { shouldValidate: true });
      setValue('startDate', autoStart, { shouldValidate: true });
      setValue('expiryDate', autoExpiry, { shouldValidate: true });
      setValue('notes', (member.status || '').toLowerCase() === 'hold' ? 'Activation bill for Hold member' : '');
      setShowShorterConfirmation(false);
    }
  }, [isOpen, member, setValue]);

  // When package changes: Auto update price & Expiry Date
  const handlePlanChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPlan = e.target.value;
    let price = 2500;
    if (newPlan.includes('3 Month') || newPlan.includes('Quarterly')) price = 6500;
    else if (newPlan.includes('6 Month') || newPlan.includes('Semi')) price = 11500;
    else if (newPlan.includes('12 Month') || newPlan.includes('Annual')) price = 18000;
    else if (newPlan.includes('Custom')) price = 3000;

    setValue('plan', newPlan, { shouldValidate: true });
    setValue('originalAmount', price, { shouldValidate: true });
    const currentDiscount = Number(watch('discount') || 0);
    const currentTax = Number(watch('tax') || 0);
    const newNet = Math.max(0, price - currentDiscount + currentTax);
    setValue('amountPaid', newNet, { shouldValidate: true });

    if (startDate) {
      const newExpiry = membershipEngine.calculateMembershipExpiry(startDate, newPlan);
      setValue('expiryDate', newExpiry, { shouldValidate: true });
    }
  };

  // When discount or originalAmount changes: update amountPaid default if it equaled old net
  const handleAmountChange = (newOrig: number) => {
    setValue('originalAmount', newOrig, { shouldValidate: true });
    const curDisc = Number(watch('discount') || 0);
    const curTax = Number(watch('tax') || 0);
    const newNet = Math.max(0, newOrig - curDisc + curTax);
    setValue('amountPaid', newNet, { shouldValidate: true });
  };

  const handleDiscountChange = (newDisc: number) => {
    setValue('discount', newDisc, { shouldValidate: true });
    const curOrig = Number(watch('originalAmount') || 0);
    const curTax = Number(watch('tax') || 0);
    const newNet = Math.max(0, curOrig - newDisc + curTax);
    setValue('amountPaid', newNet, { shouldValidate: true });
  };

  // When Start Date changes: Auto recalculate Expiry Date
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value;
    setValue('startDate', newStart, { shouldValidate: true });

    if (newStart && selectedPlan) {
      const newExpiry = membershipEngine.calculateMembershipExpiry(newStart, selectedPlan);
      setValue('expiryDate', newExpiry, { shouldValidate: true });
    }
  };

  // Expected Expiry Calculation for Warning
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
    if (!member || !member.expiryDate || isHoldMember) return false;
    const exp = new Date(member.expiryDate);
    if (isNaN(exp.getTime())) return false;
    const today = new Date();
    const eDay = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
    const tDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return eDay.getTime() >= tDay.getTime();
  }, [member, isHoldMember]);

  // Save Bill & Activate Membership
  const executeSaveBill = async (data: CreateBillFormOutput) => {
    if (!member) return;
    setIsSubmitting(true);
    try {
      const invNum = `INV-${Math.floor(100000 + Math.random() * 900000)}`;
      const origAmt = Number(data.originalAmount);
      const discAmt = Number(data.discount || 0);
      const taxAmt = Number(data.tax || 0);
      const netPay = Math.max(0, origAmt - discAmt + taxAmt);
      const paidAmt = Number(data.amountPaid);
      const outstanding = Math.max(0, netPay - paidAmt);
      const computedPayStatus = outstanding <= 0 ? 'paid' : (paidAmt > 0 ? 'partial' : 'unpaid');
      const computedDaysLeft = membershipEngine.calculateDaysLeft(data.expiryDate);

      const billPayload = {
        memberId: member.id,
        memberName: member.name,
        memberPhone: member.phone || '',
        invoiceNumber: invNum,
        invoice: invNum,
        plan: data.plan,
        originalAmount: origAmt,
        discountAmount: discAmt,
        discount: discAmt,
        taxAmount: taxAmt,
        tax: taxAmt,
        otherCharges: 0,
        netPayable: netPay,
        amount: netPay,
        amountPaid: paidAmt,
        paid: paidAmt,
        outstandingAmount: outstanding,
        pendingAmount: outstanding,
        balanceAmount: outstanding,
        method: data.method,
        status: computedPayStatus,
        paymentStatus: computedPayStatus,
        date: new Date().toISOString().split('T')[0],
        paymentDate: new Date().toISOString().split('T')[0],
        startDate: data.startDate,
        expiryDate: data.expiryDate,
        transactionType: 'membership_payment',
        isHistorical: false,
        imported: false,
        notes: data.notes || (isHoldMember ? 'Hold Member Activated' : 'Membership Bill'),
        createdAt: new Date().toISOString(),
        isRealTimeToday: true,
      };

      // 1. Post to store / backend API
      try {
        await addPayment(billPayload);
      } catch (apiErr) {
        console.warn('Backend billing API call error, falling back to direct Firestore write:', apiErr);
      }

      // 2. Direct Firestore fallback guarantee
      await setDoc(doc(db, 'payments', `inv_${Date.now()}`), billPayload);

      // 3. Update Member Document: set status to 'active' (HOLD -> ACTIVE)
      const existingHistory = Array.isArray(member.membershipHistory) ? member.membershipHistory : [];
      const newHistoryEntry = {
        plan: data.plan,
        startDate: data.startDate,
        expiryDate: data.expiryDate,
        amount: netPay,
        paid: paidAmt,
        invoiceId: invNum,
        createdAt: new Date().toISOString(),
      };
      const updatedHistory = [...existingHistory, newHistoryEntry];

      const newTotalPaid = (Number(member.totalPaid) || 0) + paidAmt;
      const newTotalBilled = (Number(member.totalBilled) || 0) + netPay;
      const newOutstandingBalance = Math.max(0, newTotalBilled - newTotalPaid);

      await updateDoc(doc(db, 'members', member.id), {
        plan: data.plan,
        packageName: data.plan,
        membershipPlan: data.plan,
        startDate: member.startDate || data.startDate,
        membershipStartDate: member.startDate || data.startDate,
        expiryDate: data.expiryDate,
        membershipExpiryDate: data.expiryDate,
        status: 'active', // Explicit HOLD -> ACTIVE transition
        membershipStatus: 'ACTIVE',
        activationStatus: 'ACTIVE',
        daysLeft: computedDaysLeft,
        paymentStatus: computedPayStatus,
        totalBilled: newTotalBilled,
        amount: newTotalBilled,
        price: newTotalBilled,
        totalPaid: newTotalPaid,
        amountPaid: newTotalPaid,
        paid: newTotalPaid,
        outstandingBalance: newOutstandingBalance,
        pendingBalance: newOutstandingBalance,
        balance: newOutstandingBalance,
        balanceAmount: newOutstandingBalance,
        membershipHistory: updatedHistory,
        updatedAt: new Date().toISOString(),
      });

      toast.success(`Bill ${invNum} generated! ${member.name} is now ACTIVE!`);
      await fetchMembers();
      if (onSaved) onSaved();
      onClose();
    } catch (err: any) {
      toast.error('Failed to generate bill: ' + (err?.message || err));
    } finally {
      setIsSubmitting(false);
      setShowShorterConfirmation(false);
    }
  };

  const onSubmit = (data: CreateBillFormOutput) => {
    if (isShorterThanExpected) {
      setPendingFormData(data);
      setShowShorterConfirmation(true);
      return;
    }
    executeSaveBill(data);
  };

  if (!isOpen || !member) return null;

  const bioIdDisplay = member.biometricId || member.biometricUserId || member.deviceUserId || null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-6 space-y-4 relative border border-slate-100 max-h-[95vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
              <Receipt size={18} className="text-[#EA580C]" />
              {isHoldMember ? 'Activate Membership & Bill' : 'Create New Bill'}
            </h3>
            <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
              Generate invoice, record payment & set membership duration
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full border-none bg-transparent cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Member Identity & Status Card */}
        <div className="bg-gradient-to-r from-orange-50/70 to-amber-50/70 border border-orange-200/80 rounded-2xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[#EA580C] text-white font-black flex items-center justify-center text-xs shadow-sm">
                {member.name?.charAt(0) || 'M'}
              </div>
              <div>
                <span className="text-xs font-black text-slate-900 block">{member.name}</span>
                <span className="text-[10px] text-slate-500 font-mono">
                  {member.phone ? member.phone : 'No phone number'}
                </span>
              </div>
            </div>
            
            <div className="text-right">
              <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                isHoldMember 
                  ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse' 
                  : isMemberActive 
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                    : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                {member.status?.toUpperCase() || (isHoldMember ? 'HOLD' : 'UNKNOWN')}
              </span>
              {bioIdDisplay && (
                <span className="block text-[10px] font-mono font-bold text-[#C2410C] mt-0.5">
                  BIO ID: #{bioIdDisplay}
                </span>
              )}
            </div>
          </div>

          {isHoldMember ? (
            <div className="p-2 rounded-xl bg-amber-50/90 text-amber-800 border border-amber-200 text-[11px] font-bold flex items-center gap-2">
              <ShieldCheck size={14} className="text-amber-600 shrink-0" />
              <span>Imported member on HOLD. Saving this bill will activate the member immediately.</span>
            </div>
          ) : isMemberActive ? (
            <div className="p-2 rounded-xl bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA] text-[11px] font-bold flex items-center gap-2">
              <Check size={14} className="text-[#EA580C] shrink-0" />
              <span>Active member: Extension will continue from current expiry ({member.expiryDate}).</span>
            </div>
          ) : null}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3.5 text-xs">
          
          {/* Select Package & Package Amount */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="font-black text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">
                Membership Package *
              </label>
              <select
                value={selectedPlan}
                onChange={handlePlanChange}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-[#EA580C] focus:ring-2 focus:ring-orange-200 transition-all cursor-pointer"
              >
                {packages.map((pkg) => (
                  <option key={pkg.value} value={pkg.value}>
                    {pkg.label} (₹{pkg.price.toLocaleString('en-IN')})
                  </option>
                ))}
              </select>
              {errors.plan && (
                <p className="mt-1 text-[11px] font-bold text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.plan.message}
                </p>
              )}
            </div>

            <div>
              <label className="font-black text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">
                Package Price (₹) *
              </label>
              <input
                type="number"
                value={originalAmount}
                readOnly={!selectedPlan?.toLowerCase().includes('custom')}
                disabled={!selectedPlan?.toLowerCase().includes('custom')}
                onChange={(e) => handleAmountChange(Number(e.target.value))}
                className={`w-full p-2.5 rounded-xl font-bold text-slate-800 outline-none transition-all ${
                  !selectedPlan?.toLowerCase().includes('custom')
                    ? 'bg-slate-100/90 border border-slate-200 cursor-not-allowed text-slate-600'
                    : 'bg-slate-50 border border-slate-200 focus:border-[#EA580C] focus:ring-2 focus:ring-orange-200'
                }`}
                title={!selectedPlan?.toLowerCase().includes('custom') ? 'Fixed package price (use Discount field below to adjust)' : 'Custom package price'}
              />
              {!selectedPlan?.toLowerCase().includes('custom') && (
                <p className="mt-1 text-[10px] font-semibold text-slate-400">
                  Fixed package rate. Apply discounts below.
                </p>
              )}
              {errors.originalAmount && (
                <p className="mt-1 text-[11px] font-bold text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.originalAmount.message}
                </p>
              )}
            </div>
          </div>

          {/* Discount & Tax / GST */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-black text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">
                Discount (₹)
              </label>
              <input
                type="number"
                value={discount}
                onChange={(e) => handleDiscountChange(Number(e.target.value))}
                placeholder="0"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-[#EA580C] focus:ring-2 focus:ring-orange-200 transition-all"
              />
            </div>

            <div>
              <label className="font-black text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">
                Tax / GST (₹)
              </label>
              <input
                type="number"
                {...register('tax')}
                placeholder="0"
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-[#EA580C] focus:ring-2 focus:ring-orange-200 transition-all"
              />
            </div>
          </div>

          {/* Amount Paid & Payment Mode */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-black text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">
                Amount Paid (₹) *
              </label>
              <input
                type="number"
                {...register('amountPaid')}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-[#EA580C] focus:ring-2 focus:ring-orange-200 transition-all"
              />
              {errors.amountPaid && (
                <p className="mt-1 text-[11px] font-bold text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.amountPaid.message}
                </p>
              )}
            </div>

            <div>
              <label className="font-black text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">
                Payment Method *
              </label>
              <select
                {...register('method')}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-[#EA580C] focus:ring-2 focus:ring-orange-200 transition-all cursor-pointer"
              >
                <option value="UPI">UPI</option>
                <option value="Cash">Cash</option>
                <option value="Card">Card</option>
                <option value="Bank">Bank Transfer</option>
                <option value="Cheque">Cheque</option>
              </select>
            </div>
          </div>

          {/* Live Calculation Summary */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-[9px] uppercase font-black text-slate-400 block">Net Payable</span>
              <span className="text-xs font-black text-slate-900 font-mono">₹{netPayable.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-black text-slate-400 block">Paid</span>
              <span className="text-xs font-black text-emerald-600 font-mono">₹{amountPaid.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="text-[9px] uppercase font-black text-slate-400 block">Pending Balance</span>
              <span className={`text-xs font-black font-mono ${pendingBalance > 0 ? 'text-rose-600' : 'text-slate-400'}`}>
                ₹{pendingBalance.toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          {/* Start Date & Expiry Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-black text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">
                Start Date *
              </label>
              <input
                type="date"
                value={startDate || ''}
                onChange={handleStartDateChange}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-[#EA580C] focus:ring-2 focus:ring-orange-200 transition-all"
              />
              {errors.startDate && (
                <p className="mt-1 text-[11px] font-bold text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.startDate.message}
                </p>
              )}
            </div>

            <div>
              <label className="font-black text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">
                Expiry Date *
              </label>
              <input
                type="date"
                value={expiryDate || ''}
                onChange={(e) => setValue('expiryDate', e.target.value, { shouldValidate: true })}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-800 outline-none focus:border-[#EA580C] focus:ring-2 focus:ring-orange-200 transition-all"
              />
              {errors.expiryDate && (
                <p className="mt-1 text-[11px] font-bold text-red-500 flex items-center gap-1">
                  <AlertCircle size={12} /> {errors.expiryDate.message}
                </p>
              )}
              {!errors.expiryDate && isShorterThanExpected && (
                <p className="mt-1 text-[10px] font-bold text-amber-600 flex items-center gap-1">
                  <AlertTriangle size={11} className="shrink-0" /> Earlier than package duration
                </p>
              )}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="font-black text-slate-700 block mb-1 uppercase tracking-wider text-[10px]">
              Notes / Remarks
            </label>
            <input
              type="text"
              {...register('notes')}
              placeholder="e.g. Initial payment for biometric imported member"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-800 outline-none focus:border-[#EA580C] focus:ring-2 focus:ring-orange-200 transition-all"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={!isValid || isSubmitting}
              className="flex-1 py-3 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-black transition-all border-none cursor-pointer shadow-md flex items-center justify-center gap-1.5"
            >
              {isSubmitting 
                ? 'Saving Bill & Activating...' 
                : isHoldMember 
                  ? 'Generate Bill & Activate Member' 
                  : 'Save Bill & Update Coverage'}
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

        {/* Confirmation Dialog for manually shortened expiry */}
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
