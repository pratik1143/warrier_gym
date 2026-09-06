'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  X, Edit3, User, Calendar, Receipt, DollarSign, Shield, Check,
  AlertCircle, RefreshCw, Printer, FileText, CheckCircle2, ChevronRight,
  Info, Sparkles, Building, Lock
} from 'lucide-react';
import { membershipEngine } from '@/lib/engines/membershipEngine';
import { paymentEngine } from '@/lib/engines/paymentEngine';
import { calculateAge, formatDate } from '@/lib/utils';
import API from '@/services/api';
import toast from '@/lib/toast';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';

interface EditBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: any;
  member: any;
  onSaved: (updatedInvoice: any, updatedMemberData: any, shouldGenerateReceipt?: boolean) => void;
}

export default function EditBillingModal({
  isOpen,
  onClose,
  invoice,
  member,
  onSaved
}: EditBillingModalProps) {
  if (!isOpen || !invoice) return null;

  // ── SECTION A: MEMBER INFO STATE ──────────────────────────────────────────
  const [memberName, setMemberName] = useState(member?.name || invoice?.memberName || '');
  const [memberPhone, setMemberPhone] = useState(member?.phone || invoice?.memberPhone || '');
  const [memberEmail, setMemberEmail] = useState(member?.email || invoice?.memberEmail || '');
  const [memberGender, setMemberGender] = useState(member?.gender || invoice?.gender || 'Male');
  const [memberDob, setMemberDob] = useState(member?.dob || member?.dateOfBirth || '');
  const [memberAge, setMemberAge] = useState<number | string>(member?.age ?? (memberDob ? calculateAge(memberDob) : ''));
  const [memberAddress, setMemberAddress] = useState(member?.address || '');
  const [emergencyContact, setEmergencyContact] = useState(member?.emergencyContact || '');
  const [memberRefId, setMemberRefId] = useState(member?.memberId || member?.clientId || member?.customId || '');

  // ── SECTION B: MEMBERSHIP INFO STATE ──────────────────────────────────────
  const [plan, setPlan] = useState(invoice?.plan || member?.plan || '3 Months (Quarterly)');
  const [customPlanName, setCustomPlanName] = useState('');
  const [isCustomPlan, setIsCustomPlan] = useState(false);
  const [startDate, setStartDate] = useState(
    invoice?.startDate || invoice?.date || member?.joinDate || new Date().toISOString().split('T')[0]
  );
  const [expiryDate, setExpiryDate] = useState(
    invoice?.expiryDate || member?.expiryDate || new Date().toISOString().split('T')[0]
  );
  const [isManualExpiry, setIsManualExpiry] = useState(false);
  const [branch, setBranch] = useState(member?.branch || 'Mohali, Punjab');
  const [trainer, setTrainer] = useState(member?.trainer || '');
  const [memberStatus, setMemberStatus] = useState(member?.status || 'active');

  // ── SECTION C: BILLING INFO STATE ─────────────────────────────────────────
  const initialOrigAmt = Number(
    invoice?.originalAmount !== undefined
      ? invoice.originalAmount
      : (invoice?.amount || invoice?.price || member?.amount || 6500)
  );
  const initialDiscAmt = Number(invoice?.discountAmount !== undefined ? invoice.discountAmount : (invoice?.discount || 0));
  const initialTaxAmt = Number(invoice?.taxAmount !== undefined ? invoice.taxAmount : (invoice?.tax || invoice?.gst || 0));
  const initialPaidAmt = Number(
    invoice?.amountPaid !== undefined
      ? invoice.amountPaid
      : (invoice?.paid !== undefined ? invoice.paid : initialOrigAmt)
  );

  const [originalAmount, setOriginalAmount] = useState<number>(initialOrigAmt);
  const [discount, setDiscount] = useState<number>(initialDiscAmt);
  const [tax, setTax] = useState<number>(initialTaxAmt);
  const [amountPaid, setAmountPaid] = useState<number>(initialPaidAmt);
  const [paymentMethod, setPaymentMethod] = useState(invoice?.method || invoice?.paymentMethod || 'UPI');
  const [paymentDate, setPaymentDate] = useState(invoice?.date || invoice?.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0]);
  const [invoiceNumber, setInvoiceNumber] = useState(invoice?.invoiceNumber || invoice?.invoice || 'INV-0001');
  const [notes, setNotes] = useState(invoice?.notes || '');

  const [showConfirm, setShowConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Auto-calculate Age if DOB changes
  useEffect(() => {
    if (memberDob) {
      const calc = calculateAge(memberDob);
      if (calc !== null && calc !== undefined) setMemberAge(calc);
    }
  }, [memberDob]);

  // Handle plan and start date change -> auto-calculate expiry date if not manual override
  useEffect(() => {
    if (!isManualExpiry) {
      const effectivePlan = isCustomPlan && customPlanName ? customPlanName : plan;
      const calcExpiry = membershipEngine.calculatePlanExpiryDate(effectivePlan, startDate);
      if (calcExpiry) {
        setExpiryDate(calcExpiry);
      }
    }
  }, [plan, customPlanName, isCustomPlan, startDate, isManualExpiry]);

  // ── DETERMINISTIC FINANCIAL CALCULATIONS ────────────────────────────────────
  const netPayable = useMemo(() => {
    const orig = Math.max(0, Number(originalAmount) || 0);
    const disc = Math.max(0, Number(discount) || 0);
    const tx = Math.max(0, Number(tax) || 0);
    return Math.max(0, orig - disc + tx);
  }, [originalAmount, discount, tax]);

  const pendingAmount = useMemo(() => {
    const paid = Math.max(0, Number(amountPaid) || 0);
    return Math.max(0, netPayable - paid);
  }, [netPayable, amountPaid]);

  const calculatedStatus = useMemo(() => {
    if (pendingAmount <= 0) return 'paid';
    if (Number(amountPaid) > 0) return 'partial';
    return 'pending';
  }, [pendingAmount, amountPaid]);

  const validationErrors = useMemo(() => {
    const errs: Record<string, string> = {};
    const orig = Number(originalAmount);
    const disc = Number(discount);
    const tx = Number(tax);
    const paid = Number(amountPaid);

    if (isNaN(orig) || orig < 0) errs.originalAmount = 'Original amount cannot be negative.';
    if (isNaN(disc) || disc < 0) errs.discount = 'Discount cannot be negative.';
    if (isNaN(tx) || tx < 0) errs.tax = 'Tax cannot be negative.';
    if (isNaN(paid) || paid < 0) errs.amountPaid = 'Amount paid cannot be negative.';

    const net = Math.max(0, (isNaN(orig) ? 0 : orig) - (isNaN(disc) ? 0 : disc) + (isNaN(tx) ? 0 : tx));
    if (paid > net) {
      errs.amountPaid = `Amount paid (₹${paid}) cannot exceed net payable (₹${net.toLocaleString('en-IN')}).`;
    }

    if (startDate && expiryDate) {
      const s = new Date(startDate);
      const e = new Date(expiryDate);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
        const sTime = new Date(s.getFullYear(), s.getMonth(), s.getDate()).getTime();
        const eTime = new Date(e.getFullYear(), e.getMonth(), e.getDate()).getTime();
        if (eTime < sTime) {
          errs.expiryDate = 'Expiry date cannot be earlier than the start date.';
        }
      }
    }

    return errs;
  }, [originalAmount, discount, tax, amountPaid, startDate, expiryDate]);

  const isValid = Object.keys(validationErrors).length === 0;

  // Handle Regenerate Invoice Number
  const handleRegenerateInvoiceNumber = () => {
    const newInv = `INV-${Math.floor(100000 + Math.random() * 900000)}`;
    setInvoiceNumber(newInv);
    toast.success(`New Invoice Number: ${newInv}`);
  };

  // Perform Save Changes
  const executeSave = async (generateBillAfter: boolean = false) => {
    setIsSaving(true);
    try {
      const effectivePlan = isCustomPlan && customPlanName ? customPlanName : plan;
      const targetInvoiceId = invoice.id || invoice.docId || invoice.invoiceNumber || invoice.invoice;

      const payload = {
        invoiceNumber,
        invoice: invoiceNumber,
        memberId: member.id || member.uid || invoice.memberId,
        memberName,
        memberPhone,
        memberEmail,
        gender: memberGender,
        dob: memberDob,
        age: Number(memberAge) || null,
        address: memberAddress,
        emergencyContact,
        memberRefId,
        plan: effectivePlan,
        startDate,
        expiryDate,
        branch,
        trainer,
        memberStatus,
        originalAmount: Number(originalAmount) || 0,
        discountAmount: Number(discount) || 0,
        discount: Number(discount) || 0,
        taxAmount: Number(tax) || 0,
        gst: Number(tax) || 0,
        otherCharges: 0,
        netPayable,
        amount: netPayable,
        amountPaid: Number(amountPaid) || 0,
        paid: Number(amountPaid) || 0,
        outstandingAmount: pendingAmount,
        pendingAmount: pendingAmount,
        method: paymentMethod,
        status: calculatedStatus,
        date: paymentDate,
        notes: notes || 'Updated via Edit Billing Modal',
        changedBy: 'Gym Owner'
      };

      // 1. Send update to Backend API
      try {
        await API.put(`/billing/${targetInvoiceId}`, payload);
      } catch (apiErr) {
        console.warn('API update failed, updating Firestore directly:', apiErr);
        // Direct Firestore fallback
        if (invoice.id) {
          const payDocRef = doc(db, 'payments', invoice.id);
          await updateDoc(payDocRef, payload);
        }
      }

      // 2. Update Member Document in Firestore directly for instant real-time synchronization
      if (member.id) {
        try {
          const memRef = doc(db, 'members', member.id);
          await updateDoc(memRef, {
            name: memberName,
            phone: memberPhone,
            email: memberEmail,
            gender: memberGender,
            dob: memberDob,
            age: Number(memberAge) || null,
            address: memberAddress,
            emergencyContact,
            memberId: memberRefId || member.memberId,
            plan: effectivePlan,
            startDate,
            expiryDate,
            branch,
            trainer,
            status: memberStatus,
            paidAmount: Number(amountPaid) || 0,
            amount: netPayable,
            paymentStatus: calculatedStatus
          });
        } catch (memErr) {
          console.warn('Direct member update notice:', memErr);
        }
      }

      toast.success('Changes saved successfully! 🎉');
      setShowConfirm(false);
      onClose();

      const updatedInvoiceObj = { ...invoice, ...payload, id: invoice.id || targetInvoiceId };
      const updatedMemberObj = {
        ...member,
        name: memberName,
        phone: memberPhone,
        email: memberEmail,
        gender: memberGender,
        dob: memberDob,
        age: Number(memberAge) || null,
        address: memberAddress,
        emergencyContact,
        memberId: memberRefId || member.memberId,
        plan: effectivePlan,
        startDate,
        expiryDate,
        branch,
        trainer,
        status: memberStatus,
        paymentStatus: calculatedStatus
      };

      onSaved(updatedInvoiceObj, updatedMemberObj, generateBillAfter);
    } catch (err: any) {
      toast.error('Failed to update billing: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-6 bg-slate-900/70 backdrop-blur-md overflow-y-auto">
      <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden text-left font-sans">
        
        {/* ── STICKY MODAL HEADER ────────────────────────────────────────── */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md px-6 py-4 border-b border-slate-100 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
              <Edit3 size={20} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-slate-900 tracking-tight">Edit Billing &amp; Transaction</h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {invoiceNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Authoritative financial edit for {member?.name || 'Member'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-all border-none bg-transparent cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* ── MODAL BODY (SCROLLABLE SECTIONS) ───────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* ── SECTION A: MEMBER INFORMATION ────────────────────────────── */}
          <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <div className="flex items-center gap-2">
                <User size={16} className="text-[#EA580C]" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800">
                  Section A — Member Profile Information
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400">Updates profile &amp; billing sync</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Member Full Name *</label>
                <input
                  type="text"
                  value={memberName}
                  onChange={e => setMemberName(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Phone Number *</label>
                <input
                  type="tel"
                  value={memberPhone}
                  onChange={e => setMemberPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Email Address</label>
                <input
                  type="email"
                  value={memberEmail}
                  onChange={e => setMemberEmail(e.target.value)}
                  placeholder="member@thewarriorgym.in"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Gender</label>
                <select
                  value={memberGender}
                  onChange={e => setMemberGender(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={memberDob}
                  onChange={e => setMemberDob(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Age</label>
                <input
                  type="number"
                  value={memberAge}
                  onChange={e => setMemberAge(e.target.value)}
                  placeholder="Years"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Address / Location</label>
                <input
                  type="text"
                  value={memberAddress}
                  onChange={e => setMemberAddress(e.target.value)}
                  placeholder="City, State"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Emergency Contact</label>
                <input
                  type="tel"
                  value={emergencyContact}
                  onChange={e => setEmergencyContact(e.target.value)}
                  placeholder="Phone number"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Member ID / Ref ID</label>
                <input
                  type="text"
                  value={memberRefId}
                  onChange={e => setMemberRefId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-[#C2410C] focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* ── SECTION B: MEMBERSHIP INFORMATION ─────────────────────────── */}
          <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <div className="flex items-center gap-2">
                <Calendar size={16} className="text-emerald-600" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800">
                  Section B — Membership &amp; Validity Information
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400">Start Date &amp; Expiry Calculation</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Membership Plan</label>
                <select
                  value={isCustomPlan ? 'custom' : plan}
                  onChange={e => {
                    if (e.target.value === 'custom') {
                      setIsCustomPlan(true);
                    } else {
                      setIsCustomPlan(false);
                      setPlan(e.target.value);
                    }
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="1 Month Standard">1 Month Standard (30 Days)</option>
                  <option value="2 Months Special">2 Months Special (60 Days)</option>
                  <option value="3 Months (Quarterly)">3 Months / Quarterly (90 Days)</option>
                  <option value="6 Months (Semi-Annual)">6 Months / Semi-Annual (180 Days)</option>
                  <option value="12 Months (Annual)">12 Months / Annual (365 Days)</option>
                  <option value="Personal Training (PT)">Personal Training (PT)</option>
                  <option value="custom">-- Custom Plan Name --</option>
                </select>
              </div>

              {isCustomPlan && (
                <div>
                  <label className="font-extrabold text-indigo-700 block mb-1">Custom Plan Name</label>
                  <input
                    type="text"
                    value={customPlanName}
                    onChange={e => setCustomPlanName(e.target.value)}
                    placeholder="e.g. Couples Special 3 Months"
                    className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              )}

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Start Date <span className="text-indigo-600 font-bold">(Editable)</span> *
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-indigo-300 rounded-xl font-bold text-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-extrabold text-slate-700 block">Expiry Date *</label>
                  <button
                    type="button"
                    onClick={() => setIsManualExpiry(!isManualExpiry)}
                    className={`text-[9px] font-black px-2 py-0.5 rounded-full border border-none cursor-pointer ${
                      isManualExpiry ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                    }`}
                  >
                    {isManualExpiry ? 'Manual Override ✏️' : 'Auto-Calculated ⚡'}
                  </button>
                </div>
                <input
                  type="date"
                  value={expiryDate}
                  onChange={e => {
                    setExpiryDate(e.target.value);
                    setIsManualExpiry(true);
                  }}
                  className={`w-full px-3 py-2 bg-white border rounded-xl font-bold text-slate-900 focus:outline-none ${
                    validationErrors.expiryDate 
                      ? 'border-red-500 bg-red-50/40' 
                      : isManualExpiry 
                      ? 'border-amber-400 bg-amber-50/30' 
                      : 'border-slate-200'
                  }`}
                />
                {validationErrors.expiryDate && (
                  <p className="mt-1 text-[11px] font-bold text-red-500 flex items-center gap-1">
                    <AlertCircle size={12} className="shrink-0" /> {validationErrors.expiryDate}
                  </p>
                )}
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Assigned Trainer</label>
                <input
                  type="text"
                  value={trainer}
                  onChange={e => setTrainer(e.target.value)}
                  placeholder="Optional trainer name"
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Branch</label>
                <input
                  type="text"
                  value={branch}
                  onChange={e => setBranch(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Membership Status</label>
                <select
                  value={memberStatus}
                  onChange={e => setMemberStatus(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="active">Active (Normal Access)</option>
                  <option value="expired">Expired</option>
                  <option value="frozen">Frozen (Temporarily Paused)</option>
                  <option value="upcoming">Upcoming (Starts in Future)</option>
                  <option value="blocked">Blocked / Blacklisted</option>
                </select>
              </div>
            </div>
          </div>

          {/* ── SECTION C: BILLING & FINANCIAL INFORMATION ────────────────── */}
          <div className="bg-slate-50/70 rounded-2xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2.5">
              <div className="flex items-center gap-2">
                <Receipt size={16} className="text-pink-600" />
                <h3 className="font-extrabold text-sm uppercase tracking-wider text-slate-800">
                  Section C — Authoritative Billing &amp; Transaction Breakdown
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRegenerateInvoiceNumber}
                  className="text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-white px-2.5 py-1 rounded-lg border border-slate-200 cursor-pointer"
                >
                  Regenerate Inv #
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 text-xs">
              <div>
                <label className="font-extrabold text-slate-700 block mb-1">
                  Original Transaction Amount (₹) *
                </label>
                <input
                  type="number"
                  value={originalAmount}
                  onChange={e => setOriginalAmount(Number(e.target.value))}
                  className={`w-full px-3 py-2 bg-white border rounded-xl font-mono font-black text-slate-900 focus:outline-none text-sm ${
                    validationErrors.originalAmount ? 'border-red-500 bg-red-50/40' : 'border-slate-200 focus:border-pink-500'
                  }`}
                />
                {validationErrors.originalAmount ? (
                  <p className="mt-1 text-[11px] font-bold text-red-500 flex items-center gap-1">
                    <AlertCircle size={12} className="shrink-0" /> {validationErrors.originalAmount}
                  </p>
                ) : (
                  <span className="text-[10px] text-slate-400 mt-0.5 block">Actual stored transaction amount</span>
                )}
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Discount Given (₹)</label>
                <input
                  type="number"
                  value={discount}
                  onChange={e => setDiscount(Number(e.target.value))}
                  className={`w-full px-3 py-2 bg-white border rounded-xl font-mono font-bold text-emerald-600 focus:outline-none ${
                    validationErrors.discount ? 'border-red-500 bg-red-50/40' : 'border-slate-200 focus:border-emerald-500'
                  }`}
                />
                {validationErrors.discount && (
                  <p className="mt-1 text-[11px] font-bold text-red-500 flex items-center gap-1">
                    <AlertCircle size={12} className="shrink-0" /> {validationErrors.discount}
                  </p>
                )}
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Tax / GST (₹)</label>
                <input
                  type="number"
                  value={tax}
                  onChange={e => setTax(Number(e.target.value))}
                  className={`w-full px-3 py-2 bg-white border rounded-xl font-mono font-bold text-slate-600 focus:outline-none ${
                    validationErrors.tax ? 'border-red-500 bg-red-50/40' : 'border-slate-200 focus:border-slate-400'
                  }`}
                />
                {validationErrors.tax && (
                  <p className="mt-1 text-[11px] font-bold text-red-500 flex items-center gap-1">
                    <AlertCircle size={12} className="shrink-0" /> {validationErrors.tax}
                  </p>
                )}
              </div>

              {/* Readonly Net Payable Display */}
              <div className="bg-white p-3 rounded-xl border border-indigo-200 shadow-xs flex flex-col justify-center">
                <span className="text-[10px] font-black uppercase text-indigo-600 tracking-wider">Net Payable</span>
                <span className="text-lg font-black text-indigo-950 font-mono">₹{netPayable.toLocaleString('en-IN')}</span>
                <span className="text-[9px] text-slate-400 font-bold">Orig (₹{originalAmount}) - Disc (₹{discount}) + Tax (₹{tax})</span>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Amount Paid by Member (₹) *</label>
                <input
                  type="number"
                  value={amountPaid}
                  onChange={e => setAmountPaid(Number(e.target.value))}
                  className={`w-full px-3 py-2 bg-white border rounded-xl font-mono font-black text-emerald-700 focus:outline-none text-sm ${
                    validationErrors.amountPaid ? 'border-red-500 bg-red-50/40' : 'border-emerald-300 focus:border-emerald-500'
                  }`}
                />
                {validationErrors.amountPaid && (
                  <p className="mt-1 text-[11px] font-bold text-red-500 flex items-center gap-1">
                    <AlertCircle size={12} className="shrink-0" /> {validationErrors.amountPaid}
                  </p>
                )}
              </div>

              {/* Readonly Pending Amount Display */}
              <div className={`p-3 rounded-xl border shadow-xs flex flex-col justify-center ${
                pendingAmount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'
              }`}>
                <span className={`text-[10px] font-black uppercase tracking-wider ${
                  pendingAmount > 0 ? 'text-amber-700' : 'text-emerald-700'
                }`}>
                  Pending Balance
                </span>
                <span className={`text-lg font-black font-mono ${
                  pendingAmount > 0 ? 'text-amber-900' : 'text-emerald-900'
                }`}>
                  ₹{pendingAmount.toLocaleString('en-IN')}
                </span>
                <span className="text-[9px] font-bold opacity-80">
                  Status: <span className="uppercase font-black">{calculatedStatus}</span>
                </span>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="UPI">UPI / QR Code</option>
                  <option value="Cash">Cash</option>
                  <option value="Card">Credit / Debit Card</option>
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                  <option value="Cheque">Cheque</option>
                </select>
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="font-extrabold text-slate-700 block mb-1">Invoice / Receipt #</label>
                <input
                  type="text"
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-mono font-bold text-[#C2410C] focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="font-extrabold text-slate-700 block mb-1 text-xs">Notes / Transaction Remarks</label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Reason for adjustment, discount remark, payment reference..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-medium text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

        </div>

        {/* ── CONFIRMATION MODAL OVERLAY ─────────────────────────────────── */}
        {showConfirm && (
          <div className="absolute inset-0 z-50 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-center">
              <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 mx-auto flex items-center justify-center">
                <AlertCircle size={24} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Confirm Financial Changes</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Are you sure you want to update this billing transaction for <strong>{memberName}</strong>?
                </p>
                <div className="mt-3 p-3 bg-slate-50 rounded-xl text-left text-xs font-mono space-y-1">
                  <div>Net Payable: <span className="font-black text-slate-900">₹{netPayable.toLocaleString('en-IN')}</span></div>
                  <div>Amount Paid: <span className="font-black text-emerald-600">₹{Number(amountPaid).toLocaleString('en-IN')}</span></div>
                  <div>Pending: <span className="font-black text-red-600">₹{pendingAmount.toLocaleString('en-IN')}</span></div>
                  <div>Start Date: <span className="font-bold text-indigo-600">{startDate}</span></div>
                  <div>Expiry Date: <span className="font-bold text-indigo-600">{expiryDate}</span></div>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={() => executeSave(false)}
                  className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all border-none cursor-pointer disabled:opacity-50"
                >
                  {isSaving ? 'Updating...' : 'Yes, Confirm & Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border-none cursor-pointer"
                >
                  Back
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── STICKY FOOTER ──────────────────────────────────────────────── */}
        <div className="sticky bottom-0 z-20 bg-slate-50 border-t border-slate-200 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-medium">
            Status: <span className="font-black uppercase text-slate-800">{calculatedStatus}</span> • Net: <span className="font-mono font-black text-slate-900">₹{netPayable.toLocaleString('en-IN')}</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-white hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs border border-slate-200 transition-all cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={() => setShowConfirm(true)}
              className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white font-extrabold rounded-xl text-xs transition-all border-none cursor-pointer shadow-md active:scale-95"
            >
              Save Changes
            </button>

            <button
              type="button"
              onClick={() => executeSave(true)}
              className="px-5 py-2.5 bg-gradient-to-r from-[#F97316] to-[#EA580C] hover:from-blue-700 hover:to-indigo-800 text-white font-extrabold rounded-xl text-xs transition-all border-none cursor-pointer shadow-md flex items-center gap-1.5 active:scale-95"
            >
              <Printer size={14} /> Save &amp; Generate Bill
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
