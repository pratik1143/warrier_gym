'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Receipt, CreditCard, User, Smartphone, Banknote, Landmark, Clock, 
  ChevronDown, Check, AlertCircle, Sparkles, Percent, Tag, Calculator
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, doc, setDoc, updateDoc } from 'firebase/firestore';
import { paymentEngine } from '@/lib/engines/paymentEngine';
import { membershipEngine } from '@/lib/engines/membershipEngine';
import toast from '@/lib/toast';
import { z } from 'zod';

import { useGymStore } from '@/store';

// ── Zod Validation Schema for Payment Collection ──────────────────────────
const paymentFormSchema = z.object({
  memberId: z.string().min(1, 'Please select a member'),
  plan: z.string().min(1, 'Please select a membership plan or enter description'),
  baseAmount: z.number().min(1, 'Payment amount must be greater than ₹0'),
  gstPercent: z.number().min(0, 'GST cannot be negative').default(0),
  discountAmount: z.number().min(0, 'Discount cannot be negative').default(0),
  paymentMethod: z.enum(['Cash', 'UPI', 'Card', 'Net Banking'], {
    message: 'Please select a valid payment method'
  }),
  paymentStatus: z.enum(['paid', 'pending'], {
    message: 'Please select a valid payment status'
  })
});

type PaymentFormValues = z.infer<typeof paymentFormSchema>;

// ── Payment Methods with Lucide Icons ──────────────────────────────────────
const PAYMENT_METHODS = [
  { value: 'Cash',        label: 'Cash',        icon: Banknote },
  { value: 'UPI',         label: 'UPI',         icon: Smartphone },
  { value: 'Card',        label: 'Card',        icon: CreditCard },
  { value: 'Net Banking', label: 'Net Banking', icon: Landmark },
] as const;

// ── Member status helper ──────────────────────────────────────────────────────
function getMemberStatus(m: any): 'active' | 'expiring' | 'expired' | 'frozen' {
  if (m.status === 'frozen') return 'frozen';
  const days = membershipEngine.calculateDaysLeft(m.expiryDate);
  if (days < 0) return 'expired';
  if (days <= 15) return 'expiring';
  return 'active';
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  active:   { label: 'Active',   color: '#16a34a', bg: '#f0fdf4' },
  expiring: { label: 'Expiring', color: '#d97706', bg: '#fffbeb' },
  expired:  { label: 'Expired',  color: '#dc2626', bg: '#fef2f2' },
  frozen:   { label: 'Frozen',   color: '#6366f1', bg: '#eef2ff' },
};

interface InvoiceBuilderModalProps {
  isOpen: boolean;
  type: string | null;
  onClose: () => void;
  members: any[];
}

export default function InvoiceBuilderModal({ isOpen, type, onClose, members }: InvoiceBuilderModalProps) {
  const { plans, fetchPlans, fetchMembers, fetchPayments } = useGymStore();

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // Standard preset plans list matching user request
  const defaultPlans = [
    { label: '3+1 Month', months: 4, price: 7500 },
    { label: '10 Days', months: 0.33, price: 1000 },
    { label: 'Annual Premium', months: 12, price: 14000 },
    { label: '1 Month', months: 1, price: 3000 },
    { label: '3 Months', months: 3, price: 6500 },
    { label: '6 Months', months: 6, price: 9500 },
  ];

  const activePlans = useMemo(() => {
    const raw = (plans && plans.length > 0)
      ? plans.map((p: any) => ({
          id: p.id,
          label: p.name,
          months: Math.max(0.1, Math.round(((p.durationDays || 30) / 30) * 100) / 100),
          price: p.price
        }))
      : defaultPlans;

    const seenLabels = new Set<string>();
    return raw.filter((p: any) => {
      const key = String(p.label || '').trim().toLowerCase();
      if (!key || seenLabels.has(key)) return false;
      seenLabels.add(key);
      return true;
    });
  }, [plans]);

  // Form States
  const [memberId, setMemberId]               = useState('');
  const [selectedPlanLabel, setSelectedPlanLabel] = useState('');
  const [selectedPlanObj, setSelectedPlanObj] = useState<any | null>(null);
  const [description, setDescription]         = useState('');
  const [baseAmount, setBaseAmount]           = useState<number | ''>('');
  const [gstPercent, setGstPercent]           = useState<number | ''>(0);
  const [discountAmount, setDiscountAmount]   = useState<number | ''>(0);
  const [paymentMethod, setPaymentMethod]     = useState<'Cash' | 'UPI' | 'Card' | 'Net Banking'>('UPI');
  const [paymentStatus, setPaymentStatus]     = useState<'paid' | 'pending'>('paid');
  
  const [errors, setErrors]                   = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting]       = useState(false);

  // Reset modal state on open
  useEffect(() => {
    if (isOpen) {
      setMemberId('');
      setSelectedPlanLabel('');
      setSelectedPlanObj(null);
      setDescription('');
      setBaseAmount('');
      setGstPercent(0);
      setDiscountAmount(0);
      setPaymentMethod('UPI');
      setPaymentStatus('paid');
      setErrors({});
      setIsSubmitting(false);
    }
  }, [isOpen]);

  // Selected Member Object
  const selectedMember = useMemo(() => {
    if (!memberId) return null;
    return members.find((m: any) => m.id === memberId || m.memberId === memberId) || null;
  }, [memberId, members]);

  // Select Plan Handler
  const handlePlanSelect = (plan: any) => {
    setSelectedPlanLabel(plan.label);
    setSelectedPlanObj(plan);
    setBaseAmount(plan.price);
    setDescription(`${plan.label} Membership`);
    setErrors(prev => ({ ...prev, plan: '', baseAmount: '' }));
  };

  // Mathematical Calculations
  const baseNum = Number(baseAmount) || 0;
  const gstPct = Number(gstPercent) || 0;
  const discNum = Number(discountAmount) || 0;

  const gstVal = Math.round((baseNum * gstPct) / 100);
  const grandTotal = Math.max(0, (baseNum + gstVal) - discNum);
  const paidVal = paymentStatus === 'paid' ? grandTotal : 0;
  const pendingVal = grandTotal - paidVal;

  // Group members for searchable selection
  const groupedMembers = useMemo(() => {
    return {
      active:   members.filter((m: any) => getMemberStatus(m) === 'active'),
      expiring: members.filter((m: any) => getMemberStatus(m) === 'expiring'),
      expired:  members.filter((m: any) => getMemberStatus(m) === 'expired'),
      frozen:   members.filter((m: any) => getMemberStatus(m) === 'frozen'),
    };
  }, [members]);

  const handleGenerateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    // Validate with Zod
    const rawData = {
      memberId,
      plan: description || selectedPlanLabel || (type === 'POS' ? 'Product Purchase' : ''),
      baseAmount: baseNum,
      gstPercent: gstPct,
      discountAmount: discNum,
      paymentMethod,
      paymentStatus
    };

    const result = paymentFormSchema.safeParse(rawData);
    if (!result.success) {
      const formattedErrors: Record<string, string> = {};
      result.error.issues.forEach(issue => {
        const fieldName = issue.path[0] as string;
        formattedErrors[fieldName] = issue.message;
      });
      setErrors(formattedErrors);
      toast.error('Please fix validation errors before submitting.');
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      // 1. Generate Idempotent Unique Invoice Number (TWG-INV-XXXXXX)
      const dateCode = new Date().toISOString().replace(/\D/g, '').slice(2, 8); // e.g. 260823
      const randomCode = Math.floor(1000 + Math.random() * 9000);
      const invoiceNumber = `TWG-INV-${dateCode}${randomCode}`;
      const docId = `inv_${invoiceNumber.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

      const todayIso = new Date().toISOString();
      const todayStr = todayIso.split('T')[0];

      const invoicePayload = {
        id: docId,
        invoice: invoiceNumber,
        invoiceNumber: invoiceNumber,
        memberId: memberId,
        memberName: selectedMember?.name || 'Member',
        memberPhone: selectedMember?.phone || '',
        plan: rawData.plan,
        baseAmount: baseNum,
        gstPercent: gstPct,
        gstAmount: gstVal,
        gst: gstVal,
        discountAmount: discNum,
        discount: discNum,
        amount: baseNum,
        total: grandTotal,
        grandTotal: grandTotal,
        paid: paidVal,
        amountPaid: paidVal,
        pendingAmount: pendingVal,
        status: paymentStatus,
        method: paymentMethod,
        paymentMethod: paymentMethod,
        date: todayStr,
        paymentDate: todayStr,
        transactionType: type === 'PT' ? 'pt_payment' : (type === 'POS' ? 'other_payment' : 'membership_payment'),
        isHistorical: false,
        imported: false,
        createdAt: todayIso,
        isRealTimeToday: true,
      };

      // 2. Write to Firestore Payments & Invoices collections idempotently
      await setDoc(doc(db, 'payments', docId), invoicePayload, { merge: true });
      await setDoc(doc(db, 'invoices', docId), invoicePayload, { merge: true });

      // 3. Update Member Record & Sync Membership Expiry
      const memberUpdates: any = {
        invoiceAmount: baseNum,
        invoiceGst: gstVal,
        invoiceTotal: grandTotal,
        paidAmount: paidVal,
        pendingAmount: pendingVal,
        paymentStatus: paymentStatus,
        lastInvoice: invoiceNumber,
        lastBillDate: todayIso,
      };

      if (type !== 'POS' && selectedPlanObj) {
        const currentExpiry = selectedMember?.expiryDate ? new Date(selectedMember.expiryDate) : new Date();
        const now = new Date();
        const startDate = currentExpiry < now ? now : currentExpiry;
        const addDays = Math.round((selectedPlanObj.months || 1) * 30);
        const newExpiry = new Date(startDate.getTime() + addDays * 24 * 60 * 60 * 1000);
        
        memberUpdates.plan = selectedPlanLabel || selectedPlanObj.label;
        memberUpdates.expiryDate = newExpiry.toISOString().split('T')[0];
        memberUpdates.status = 'active';
      }

      await updateDoc(doc(db, 'members', memberId), memberUpdates);

      // 4. Refresh global state
      fetchMembers();
      fetchPayments();

      toast.success(`Invoice ${invoiceNumber} created! ₹${grandTotal.toLocaleString('en-IN')} recorded via ${paymentMethod}. 🎉`);
      onClose();
    } catch (err: any) {
      console.error('Invoice creation error:', err);
      toast.error('Failed to generate invoice: ' + (err.message || 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose} 
      />

      {/* Modal Container */}
      <div className="relative bg-white rounded-2xl w-full max-w-[660px] max-h-[88vh] shadow-2xl border border-slate-200 flex flex-col overflow-hidden text-left z-10 my-auto">
        
        {/* ── HEADER (The Warrior Gym Blue - NO PINK) ── */}
        <div className="px-5 py-4 bg-[#EA580C] text-white flex items-center justify-between shrink-0 shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20 text-white shrink-0">
              <Receipt size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-base tracking-tight flex items-center gap-2">
                💳 Collect Membership Payment
              </h2>
              <p className="text-xs text-orange-100 font-medium">
                Create invoice and record payment
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer border-none"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── SCROLLABLE BODY ── */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          <form id="billing-form" onSubmit={handleGenerateInvoice} className="space-y-5">
            
            {/* 1. MEMBER SELECTION */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between mb-1.5">
                <span className="flex items-center gap-1.5">
                  <User size={14} className="text-[#EA580C]" /> Select Member <span className="text-rose-500">*</span>
                </span>
                {errors.memberId && (
                  <span className="text-rose-600 text-[11px] font-semibold flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.memberId}
                  </span>
                )}
              </label>

              <select
                value={memberId}
                onChange={e => {
                  setMemberId(e.target.value);
                  setErrors(prev => ({ ...prev, memberId: '' }));
                }}
                className={`w-full px-3.5 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold text-slate-800 outline-none transition-all ${
                  errors.memberId ? 'border-rose-400 focus:ring-2 focus:ring-rose-200' : 'border-slate-200 focus:border-[#EA580C] focus:bg-white'
                }`}
              >
                <option value="">-- Choose Member --</option>
                {groupedMembers.active.length > 0 && (
                  <optgroup label={`Active Members (${groupedMembers.active.length})`}>
                    {groupedMembers.active.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.name} • {m.phone || 'No phone'}</option>
                    ))}
                  </optgroup>
                )}
                {groupedMembers.expiring.length > 0 && (
                  <optgroup label={`Expiring Soon (${groupedMembers.expiring.length})`}>
                    {groupedMembers.expiring.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.name} • {m.phone || 'No phone'}</option>
                    ))}
                  </optgroup>
                )}
                {groupedMembers.expired.length > 0 && (
                  <optgroup label={`Expired (${groupedMembers.expired.length})`}>
                    {groupedMembers.expired.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.name} • {m.phone || 'No phone'}</option>
                    ))}
                  </optgroup>
                )}
                {groupedMembers.frozen.length > 0 && (
                  <optgroup label={`Frozen (${groupedMembers.frozen.length})`}>
                    {groupedMembers.frozen.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.name} • {m.phone || 'No phone'}</option>
                    ))}
                  </optgroup>
                )}
              </select>

              {/* Selected Member Preview Card */}
              {selectedMember && (() => {
                const status = getMemberStatus(selectedMember);
                const cfg = STATUS_CONFIG[status];
                const days = membershipEngine.calculateDaysLeft(selectedMember.expiryDate);
                return (
                  <div className="mt-2.5 p-3 rounded-xl bg-orange-50/60 border border-[#FED7AA] flex items-center justify-between">
                    <div>
                      <div className="text-xs font-black text-slate-900">{selectedMember.name}</div>
                      <div className="text-[11px] font-medium text-slate-500 flex items-center gap-2 mt-0.5">
                        <span className="font-mono">ID: {selectedMember.memberId || selectedMember.id?.slice(0,8)}</span>
                        <span>•</span>
                        <span>{selectedMember.phone || 'No phone'}</span>
                      </div>
                    </div>
                    <span 
                      className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider"
                      style={{ color: cfg.color, backgroundColor: cfg.bg }}
                    >
                      {cfg.label} ({days > 0 ? `${days}d left` : 'Expired'})
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* 2. MEMBERSHIP PLAN SELECTION */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center justify-between mb-2">
                <span>Membership Plan</span>
                {errors.plan && (
                  <span className="text-rose-600 text-[11px] font-semibold flex items-center gap-1">
                    <AlertCircle size={12} /> {errors.plan}
                  </span>
                )}
              </label>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {activePlans.map((plan: any, idx: number) => {
                  const isSelected = selectedPlanLabel === plan.label;
                  return (
                    <button
                      key={plan.id || `${plan.label}_${idx}`}
                      type="button"
                      onClick={() => handlePlanSelect(plan)}
                      className={`p-3 rounded-xl border transition-all text-left relative cursor-pointer ${
                        isSelected 
                          ? 'border-[#EA580C] bg-orange-50/60 text-[#EA580C] shadow-sm' 
                          : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-[#EA580C] text-white flex items-center justify-center">
                          <Check size={10} strokeWidth={3} />
                        </div>
                      )}
                      <div className={`text-xs font-extrabold ${isSelected ? 'text-[#EA580C]' : 'text-slate-900'}`}>
                        {plan.label}
                      </div>
                      <div className={`text-sm font-black mt-1 ${isSelected ? 'text-[#EA580C]' : 'text-slate-700'}`}>
                        ₹{plan.price.toLocaleString('en-IN')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. BILL DETAILS */}
            <div className="space-y-3 bg-slate-50/80 p-4 rounded-xl border border-slate-200/80">
              <div className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5 pb-1 border-b border-slate-200">
                <Calculator size={14} className="text-[#EA580C]" /> Bill Details
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Base Amount */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Base Amount (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 6500"
                    value={baseAmount}
                    onChange={e => {
                      const val = e.target.value === '' ? '' : Number(e.target.value);
                      setBaseAmount(val);
                      setErrors(prev => ({ ...prev, baseAmount: '' }));
                    }}
                    className={`w-full px-3 py-2 bg-white border rounded-lg text-xs font-bold text-slate-800 outline-none ${
                      errors.baseAmount ? 'border-rose-400' : 'border-slate-200 focus:border-[#EA580C]'
                    }`}
                  />
                  {errors.baseAmount && (
                    <span className="text-rose-600 text-[10px] font-semibold mt-1 block">{errors.baseAmount}</span>
                  )}
                </div>

                {/* GST (%) */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    GST (%)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    placeholder="0"
                    value={gstPercent}
                    onChange={e => setGstPercent(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-[#EA580C]"
                  />
                </div>

                {/* Discount (₹) */}
                <div>
                  <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                    Discount (₹)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={discountAmount}
                    onChange={e => setDiscountAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-[#EA580C]"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-1">
                  Description
                </label>
                <input
                  type="text"
                  placeholder="e.g. 3 Months VIP Membership"
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:border-[#EA580C]"
                />
              </div>

              {/* Breakdown Totals */}
              <div className="pt-2 border-t border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Base Amount:</span>
                  <span className="font-bold text-slate-800">₹{baseNum.toLocaleString('en-IN')}</span>
                </div>
                {gstPct > 0 && (
                  <div className="flex justify-between text-slate-600 font-medium">
                    <span>GST ({gstPct}%):</span>
                    <span className="font-bold text-slate-800">+ ₹{gstVal.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {discNum > 0 && (
                  <div className="flex justify-between text-emerald-700 font-medium">
                    <span>Discount:</span>
                    <span className="font-bold">- ₹{discNum.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-black text-slate-900 pt-1.5 border-t border-slate-200">
                  <span>Grand Total:</span>
                  <span className="text-[#EA580C]">₹{grandTotal.toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* 4. PAYMENT METHOD (Segmented Buttons - Lucide icons) */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                Payment Method
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {PAYMENT_METHODS.map(m => {
                  const IconComp = m.icon;
                  const isSelected = paymentMethod === m.value;
                  return (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setPaymentMethod(m.value)}
                      className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        isSelected 
                          ? 'border-[#EA580C] bg-[#EA580C] text-white shadow-sm' 
                          : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                      }`}
                    >
                      <IconComp size={18} />
                      <span className="text-xs font-bold">{m.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. PAYMENT STATUS */}
            <div>
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2">
                Payment Status
              </label>
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => setPaymentStatus('paid')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 ${
                    paymentStatus === 'paid' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Check size={14} /> Paid (₹{grandTotal.toLocaleString('en-IN')})
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentStatus('pending')}
                  className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer border-none flex items-center justify-center gap-1.5 ${
                    paymentStatus === 'pending' ? 'bg-amber-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Clock size={14} /> Pending (₹{grandTotal.toLocaleString('en-IN')})
                </button>
              </div>
            </div>

          </form>
        </div>

        {/* ── MODAL ACTIONS (Footer) ── */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer bg-white"
          >
            Cancel
          </button>
          
          <button
            form="billing-form"
            type="submit"
            disabled={isSubmitting}
            className="px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-orange-700 text-white text-xs font-bold transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-none"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Receipt size={14} />
                Generate Invoice &amp; Save
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}
