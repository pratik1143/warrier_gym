'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Dumbbell, User, Calendar, CreditCard, DollarSign, 
  CheckCircle2, AlertCircle, ArrowRight, ArrowLeft,
  ChevronDown
} from 'lucide-react';
import toast from '@/lib/toast';
import { db } from '@/lib/firebase';
import { doc, updateDoc, addDoc, collection, query, onSnapshot } from 'firebase/firestore';
import { useGymStore } from '@/store';
import API from '@/services/api';
import { resolveAvatarUrl, MALE_DEFAULT_AVATAR, FEMALE_DEFAULT_AVATAR } from '@/lib/avatar';

interface PTBillingModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: any;
  preselectedTrainer?: any;
  onSuccess?: (updatedMember: any) => void;
}

// Canonical date calculation for PT Package duration
function calculatePtExpiryDate(startDateStr: string, months: number): string {
  if (!startDateStr) return '';
  const [y, m, d] = startDateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setMonth(date.getMonth() + months);
  const resY = date.getFullYear();
  const resM = String(date.getMonth() + 1).padStart(2, '0');
  const resD = String(date.getDate()).padStart(2, '0');
  return `${resY}-${resM}-${resD}`;
}

// Deduplicate real trainers from employees collection
function deduplicateTrainers(rawList: any[]) {
  const map = new Map<string, any>();
  rawList.forEach((t) => {
    const r = String(t.role || t.type || '').toLowerCase();
    const isTrainerRole = r.includes('trainer') || r.includes('coach') || t.isTrainer === true;
    if (!isTrainerRole) return;
    if (t.isDeleted === true || t.status === 'Inactive') return;

    const key = (t.phone && String(t.phone).trim().length >= 8)
      ? String(t.phone).trim()
      : (t.email && String(t.email).trim().length > 3)
      ? String(t.email).trim().toLowerCase()
      : (t.employeeId && !t.employeeId.includes('EMP-AUTO') && String(t.employeeId).trim().length > 0)
      ? String(t.employeeId).trim()
      : String(t.id).trim();

    if (!map.has(key)) {
      map.set(key, t);
    } else {
      const existing = map.get(key);
      const existingEmpId = String(existing.employeeId || '');
      const newEmpId = String(t.employeeId || '');
      if (existingEmpId.includes('AUTO') && !newEmpId.includes('AUTO')) {
        map.set(key, t);
      }
    }
  });
  return Array.from(map.values());
}

export default function PtBillingModal({
  isOpen,
  onClose,
  member,
  preselectedTrainer,
  onSuccess,
}: PTBillingModalProps) {
  const { fetchMembers, fetchPayments } = useGymStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Active trainers list from master directory
  const [trainers, setTrainers] = useState<any[]>([]);
  const [loadingTrainers, setLoadingTrainers] = useState(true);

  // Form States — NO automatic default trainer!
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('');
  const [selectedTrainer, setSelectedTrainer] = useState<any | null>(null);

  // Duration — Explicit single source of truth
  const [durationMonths, setDurationMonths] = useState<number>(1);
  const [amount, setAmount] = useState<string>('2000');
  const [paymentMode, setPaymentMode] = useState<string>('UPI');
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState<string>(() => calculatePtExpiryDate(new Date().toISOString().split('T')[0], 1));

  // Load canonical active trainers
  useEffect(() => {
    let isMounted = true;
    setLoadingTrainers(true);
    const q = query(collection(db, 'employees'));
    const unsub = onSnapshot(q, (snap) => {
      if (!isMounted) return;
      let rawList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      let deduped = deduplicateTrainers(rawList);

      if (deduped.length > 0) {
        setTrainers(deduped);
        setLoadingTrainers(false);
      } else {
        API.get('/employees').then(res => {
          if (isMounted) {
            const apiDeduped = deduplicateTrainers(res.data || []);
            setTrainers(apiDeduped);
          }
        }).catch(() => {
          if (isMounted) setTrainers([]);
        }).finally(() => {
          if (isMounted) setLoadingTrainers(false);
        });
      }
    }, (err) => {
      console.warn("PT modal trainers listener warning:", err);
      API.get('/employees').then(res => {
        if (isMounted) {
          const apiDeduped = deduplicateTrainers(res.data || []);
          setTrainers(apiDeduped);
        }
      }).catch(() => {
        if (isMounted) setTrainers([]);
      }).finally(() => {
        if (isMounted) setLoadingTrainers(false);
      });
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, []);

  // Sync selected trainer when modal opens or preselectedTrainer changes
  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setErrors({});
      return;
    }

    // Reset date to today and 1 month
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setDurationMonths(1);
    setAmount('2000');
    setExpiryDate(calculatePtExpiryDate(today, 1));
    setErrors({});

    if (preselectedTrainer) {
      const tId = preselectedTrainer.id || preselectedTrainer.employeeId;
      setSelectedTrainerId(tId);
      setSelectedTrainer(preselectedTrainer);
    } else if (member?.trainerId && member?.trainerId !== 'null' && member?.trainer !== 'Unassigned') {
      setSelectedTrainerId(member.trainerId);
      setSelectedTrainer({
        id: member.trainerId,
        employeeId: member.trainerId,
        name: member.trainerName || member.trainer,
        specialization: member.trainerRole || 'Personal Trainer & Strength',
        avatarUrl: member.trainerAvatar || '',
        phone: member.trainerPhone || '',
      });
    } else {
      // INITIAL STATE MUST BE EMPTY / UNSELECTED
      setSelectedTrainerId('');
      setSelectedTrainer(null);
    }
  }, [isOpen, preselectedTrainer, member]);

  // When selectedTrainerId changes, find matching trainer from trainers list
  const handleTrainerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tId = e.target.value;
    setSelectedTrainerId(tId);
    if (!tId) {
      setSelectedTrainer(null);
      return;
    }
    const found = trainers.find(t => t.id === tId || t.employeeId === tId);
    if (found) {
      setSelectedTrainer(found);
    } else {
      setSelectedTrainer({ id: tId, name: 'Assigned Trainer' });
    }
    if (errors.trainer) {
      setErrors(prev => ({ ...prev, trainer: '' }));
    }
  };

  // When duration preset is clicked
  const handleDurationClick = (months: number) => {
    setDurationMonths(months);
    const newExpiry = calculatePtExpiryDate(startDate, months);
    setExpiryDate(newExpiry);

    // Dynamic suggested default pricing
    if (months === 1) setAmount('2000');
    else if (months === 3) setAmount('5000');
    else if (months === 6) setAmount('9500');
    else if (months === 12) setAmount('18000');

    if (errors.duration) {
      setErrors(prev => ({ ...prev, duration: '' }));
    }
  };

  // When start date changes, recalculate expiry date immediately
  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value;
    setStartDate(newStart);
    if (newStart) {
      const newExpiry = calculatePtExpiryDate(newStart, durationMonths);
      setExpiryDate(newExpiry);
    }
  };

  // Form Validation for Step 1
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!selectedTrainerId || !selectedTrainer) {
      newErrors.trainer = 'Please select a trainer for this PT package';
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      newErrors.amount = 'Amount must be greater than ₹0';
    }

    if (!startDate) {
      newErrors.startDate = 'Start date is required';
    }

    if (!expiryDate) {
      newErrors.expiryDate = 'Expiry date is required';
    } else if (startDate && new Date(expiryDate) <= new Date(startDate)) {
      newErrors.expiryDate = 'Expiry date must be after start date';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNextStep = () => {
    if (validateForm()) {
      setStep(2);
    } else {
      toast.error('Please complete all required fields');
    }
  };

  // Persist PT Bill & Synchronize Member + Payments
  const handleConfirmPTBilling = async () => {
    if (!member || !member.id || submitting) return;
    if (!validateForm()) {
      setStep(1);
      return;
    }

    setSubmitting(true);
    try {
      const numAmount = parseFloat(amount) || 0;
      const durationLabel = `${durationMonths} Month${durationMonths > 1 ? 's' : ''}`;
      const todayStr = new Date().toISOString().split('T')[0];
      const invoiceNo = `INV-PT-${Date.now().toString().slice(-6)}`;

      const trainerId = selectedTrainer?.id || selectedTrainer?.employeeId || selectedTrainerId;
      const trainerName = selectedTrainer?.name || 'Personal Trainer';
      let empBadge = selectedTrainer?.employeeId;
      if (!empBadge || empBadge.includes('AUTO')) {
        empBadge = `EMP-${trainerId ? String(trainerId).slice(0, 5).toUpperCase() : '101'}`;
      }
      const trainerRole = selectedTrainer?.specialization || selectedTrainer?.role || 'Personal Trainer & Strength';
      const trainerAvatar = resolveAvatarUrl(selectedTrainer || { name: trainerName });
      const trainerPhone = selectedTrainer?.phone || '';

      // 1. Create PT Payment / Billing Record in `payments` collection
      const ptPaymentPayload = {
        memberId: member.id,
        memberName: member.name,
        trainerId,
        trainerName,
        trainerRole,
        billingType: 'PT',
        invoiceType: 'PT',
        packageType: 'PT',
        durationMonths,
        duration: durationLabel,
        packageName: durationLabel,
        plan: `Personal Training - ${durationLabel}`,
        amount: numAmount,
        paid: numAmount,
        discount: 0,
        netPayable: numAmount,
        paymentMode,
        method: paymentMode,
        startDate,
        expiryDate,
        invoiceNo,
        invoiceNumber: invoiceNo,
        transactionType: 'pt_payment',
        isHistorical: false,
        imported: false,
        paymentDate: todayStr,
        date: todayStr,
        status: 'PAID',
        createdAt: new Date().toISOString(),
        isRealTimeToday: true,
      };

      try {
        await addDoc(collection(db, 'payments'), ptPaymentPayload);
      } catch (payErr) {
        console.warn('Direct Firestore payment creation warning, attempting API:', payErr);
        await API.post('/payments', ptPaymentPayload).catch(() => {});
      }

      // 2. Canonical PT Object Definition
      const ptMembershipData = {
        id: invoiceNo,
        trainerId,
        trainerName,
        trainerRole,
        trainerAvatar,
        trainerPhone,
        durationMonths,
        packageName: durationLabel,
        amount: numAmount,
        startDate,
        expiryDate,
        paymentMode,
        status: 'ACTIVE',
        invoiceNo,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const ptState = {
        enabled: true,
        trainerId,
        trainerName,
        trainerRole,
        trainerAvatar,
        trainerPhone,
        startDate,
        expiryDate,
        durationMonths,
        packageName: durationLabel,
        duration: durationLabel,
        amount: numAmount,
        billingId: invoiceNo,
        invoiceNo,
        paymentMode,
        status: 'ACTIVE',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 3. Update Member Document in Firestore
      const memberUpdateData = {
        ptMembership: ptMembershipData,
        pt: ptState,
        trainerId,
        trainerName,
        trainer: trainerName,
        trainerRole,
        trainerAvatar,
        trainerPhone,
        ptStartDate: startDate,
        ptExpiryDate: expiryDate,
        ptDurationMonths: durationMonths,
        ptDuration: durationLabel,
        ptAmount: numAmount,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'members', member.id), memberUpdateData);

      // 4. Update local in-memory reference
      Object.assign(member, memberUpdateData);

      // 5. Invalidate and refresh global store caches
      await fetchMembers(true);
      await fetchPayments(true);

      if (onSuccess) {
        onSuccess(member);
      }

      toast.success(`PT membership created successfully! (${durationLabel} with ${trainerName})`);
      onClose();
    } catch (err: any) {
      console.error('Failed to create PT bill:', err);
      toast.error('Failed to create PT membership: ' + (err.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-4 font-sans text-left">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          className="relative bg-white rounded-[24px] shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden z-10 text-slate-900 flex flex-col max-h-[92vh]"
        >
          {/* Header Bar — Warrior Gym OS Clean Style */}
          <div className="px-6 py-5 bg-white border-b border-slate-100 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#FFF7ED] text-[#0066FF] border border-[#FED7AA] flex items-center justify-center shrink-0">
                <Dumbbell size={20} />
              </div>
              <div>
                <h3 className="font-black text-slate-900 text-lg leading-tight">
                  {step === 1 ? 'Create PT Membership & Bill' : 'Review PT Membership'}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  {step === 1 ? 'Add personal training package for this member.' : 'Confirm details before generating invoice.'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-all flex items-center justify-center border-none cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          {/* Form Content Body */}
          <div className="p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
            {step === 1 ? (
              <div className="space-y-4 text-xs font-semibold">
                
                {/* Member Preview Card */}
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 flex items-center justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center font-black text-slate-700">
                      {member?.photo ? (
                        <img src={member.photo} alt={member.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{(member?.name || 'M')[0]}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Member</span>
                      <div className="font-extrabold text-sm text-slate-900 truncate">{member?.name || 'Member'}</div>
                    </div>
                  </div>
                  <span className="text-[11px] font-mono font-black text-indigo-600 bg-indigo-50 border border-indigo-200/80 px-2.5 py-1 rounded-lg shrink-0">
                    #{member?.clientId || member?.memberId || member?.id}
                  </span>
                </div>

                {/* Trainer Selection Dropdown (No auto fallback) */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                    Select Trainer *
                  </label>
                  <div className="relative">
                    <select
                      value={selectedTrainerId}
                      onChange={handleTrainerChange}
                      className={`w-full text-xs bg-slate-50 border rounded-xl px-3.5 py-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white transition-all cursor-pointer appearance-none pr-10 ${
                        errors.trainer ? 'border-red-500 bg-red-50/20' : 'border-slate-200 focus:border-[#0066FF]'
                      }`}
                    >
                      <option value="">-- Choose Personal Trainer --</option>
                      {trainers.map((t) => {
                        let empBadge = t.employeeId;
                        if (!empBadge || empBadge.includes('AUTO')) {
                          empBadge = `EMP-${t.id ? String(t.id).slice(0, 5).toUpperCase() : '101'}`;
                        }
                        const spec = t.specialization || 'Fitness Trainer';
                        return (
                          <option key={t.id || t.employeeId} value={t.id || t.employeeId}>
                            {t.name} — {spec} ({empBadge})
                          </option>
                        );
                      })}
                    </select>
                    <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                  {errors.trainer && (
                    <p className="text-[10px] text-red-500 font-bold mt-1.5 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.trainer}
                    </p>
                  )}
                  {selectedTrainer && (
                    <div className="mt-2 p-2.5 bg-orange-50/60 border border-[#FED7AA] rounded-xl flex items-center justify-between text-[11px]">
                      <span className="text-slate-600 font-medium">Assigned: <strong className="text-slate-900">{selectedTrainer.name}</strong></span>
                      <span className="text-[10px] font-bold text-[#0066FF] bg-white px-2 py-0.5 rounded border border-[#FED7AA]">
                        {selectedTrainer.specialization || 'Personal Trainer'}
                      </span>
                    </div>
                  )}
                </div>

                {/* PT Package Duration Presets */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1.5">
                    PT Package Duration *
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: '1 Month', months: 1 },
                      { label: '3 Months', months: 3 },
                      { label: '6 Months', months: 6 },
                      { label: '12 Months', months: 12 },
                    ].map((item) => (
                      <button
                        key={item.months}
                        type="button"
                        onClick={() => handleDurationClick(item.months)}
                        className={`py-2.5 px-2 rounded-xl border text-xs font-black transition-all cursor-pointer text-center ${
                          durationMonths === item.months
                            ? 'bg-[#0066FF] text-white border-[#0066FF] shadow-xs'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  {errors.duration && (
                    <p className="text-[10px] text-red-500 font-bold mt-1.5 flex items-center gap-1">
                      <AlertCircle size={12} /> {errors.duration}
                    </p>
                  )}
                </div>

                {/* Amount & Payment Mode */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                      PT Amount (₹) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-xs">₹</span>
                      <input
                        type="number"
                        value={amount}
                        onChange={(e) => {
                          setAmount(e.target.value);
                          if (errors.amount) setErrors(p => ({ ...p, amount: '' }));
                        }}
                        placeholder="2000"
                        className={`w-full text-xs bg-slate-50 border rounded-xl pl-7 pr-3.5 py-2.5 font-mono font-black text-slate-900 focus:outline-none focus:bg-white transition-all ${
                          errors.amount ? 'border-red-500 bg-red-50/20' : 'border-slate-200 focus:border-[#0066FF]'
                        }`}
                      />
                    </div>
                    {errors.amount && (
                      <p className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1">
                        <AlertCircle size={11} /> {errors.amount}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                      Payment Mode *
                    </label>
                    <div className="relative">
                      <select
                        value={paymentMode}
                        onChange={(e) => setPaymentMode(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 font-bold text-slate-900 focus:outline-none focus:bg-white focus:border-[#0066FF] transition-all cursor-pointer appearance-none pr-10"
                      >
                        <option value="UPI">UPI / QR Code</option>
                        <option value="Cash">Cash Payment</option>
                        <option value="Card">Credit / Debit Card</option>
                        <option value="NetBanking">Net Banking</option>
                      </select>
                      <ChevronDown size={16} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Start Date & Auto Calculated Expiry Date */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                      PT Start Date *
                    </label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={handleStartDateChange}
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold focus:outline-none focus:bg-white focus:border-[#0066FF] transition-all cursor-pointer"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-600 mb-1">
                      PT Expiry Date (Auto-calculated)
                    </label>
                    <input
                      type="date"
                      value={expiryDate}
                      readOnly
                      className="w-full text-xs bg-slate-100/80 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-700 font-bold focus:outline-none cursor-not-allowed"
                    />
                    {errors.expiryDate && (
                      <p className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1">
                        <AlertCircle size={11} /> {errors.expiryDate}
                      </p>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              /* Step 2: Summary Confirmation */
              <div className="space-y-4 text-xs font-semibold animate-fade-in">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                      PT Package Summary
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black">
                      Ready to Bill
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-black block mb-0.5">Member</span>
                      <span className="text-sm font-black text-slate-900">{member?.name}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-black block mb-0.5">Trainer</span>
                      <span className="text-sm font-black text-[#0066FF]">
                        {selectedTrainer?.name || 'Personal Trainer'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-200/80 pt-3">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-black block mb-0.5">PT Package</span>
                      <span className="text-sm font-black text-slate-900">
                        {durationMonths} Month{durationMonths > 1 ? 's' : ''}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-black block mb-0.5">Validity Range</span>
                      <span className="text-xs font-bold text-slate-800 font-mono">
                        {startDate} → {expiryDate}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-slate-200/80 pt-3">
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-black block mb-0.5">Amount</span>
                      <span className="text-lg font-black font-mono text-emerald-600">
                        ₹{parseFloat(amount).toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 uppercase font-black block mb-0.5">Payment Mode</span>
                      <span className="text-xs font-black uppercase text-slate-900 bg-white px-2.5 py-1 rounded-lg border border-slate-200 inline-block mt-0.5">
                        {paymentMode}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Bar */}
          <div className="p-4 sm:p-5 bg-white border-t border-slate-100 flex justify-between items-center shrink-0">
            {step === 1 ? (
              <>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-bold border-none bg-transparent cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleNextStep}
                  className="px-6 py-2.5 bg-[#0066FF] hover:bg-orange-700 text-white rounded-xl text-xs font-black transition-all border-none cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <span>Review Bill</span> <ArrowRight size={14} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 text-xs font-bold border-none bg-transparent cursor-pointer flex items-center gap-1"
                >
                  <ArrowLeft size={13} /> Back
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmPTBilling}
                  className="px-6 py-2.5 bg-[#0066FF] hover:bg-orange-700 text-white rounded-xl text-xs font-black transition-all border-none cursor-pointer flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  <CheckCircle2 size={16} />
                  <span>{submitting ? 'Creating PT Bill...' : 'Create PT Bill'}</span>
                </button>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
