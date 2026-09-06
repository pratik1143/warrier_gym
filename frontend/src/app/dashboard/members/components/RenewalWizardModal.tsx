'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ArrowRight, ArrowLeft, Check, Sparkles, CreditCard, User, Dumbbell, Receipt, Mail, MessageSquare, Bell, Calendar } from 'lucide-react';
import { useGymStore } from '@/store';
import { formatCurrency } from '@/lib/utils';
import { membershipEngine } from '@/lib/engines/membershipEngine';
import API from '@/services/api';
import toast from '@/lib/toast';

import OfficialInvoiceReceipt from '../../components/OfficialInvoiceReceipt';

interface RenewalWizardProps {
  isOpen: boolean;
  member: any;
  onClose: () => void;
}

const PLANS = [
  { id: '1m', name: '1 Month Standard', price: 2500, duration: 1, desc: 'Basic single month access' },
  { id: '3m', name: '3 Months Pro', price: 6500, duration: 3, desc: 'Quarterly membership saver' },
  { id: '6m', name: '6 Months Elite', price: 11500, duration: 6, desc: 'Semi-annual transformation pack' },
  { id: '12m', name: '12 Months VIP', price: 18000, duration: 12, desc: 'Annual ultimate access' },
  { id: '10d', name: '10 Days Pass', price: 1000, duration: 0.33, desc: '10 Days short trial pass' },
  { id: 'pt', name: 'Personal Training (PT)', price: 8000, duration: 1, desc: '1-on-1 personal trainer sessions' },
  { id: 'premium', name: 'Premium Platinum', price: 25000, duration: 12, desc: 'All-inclusive premium annual access' },
  { id: 'custom', name: 'Custom Custom Plan', price: 0, duration: 1, desc: 'Enter custom pricing and duration' },
];

const METHODS = ['Cash', 'UPI', 'Card', 'Bank', 'Cheque', 'Split Payment'];

const Confetti = () => {
  const colors = ['#f59e0b', '#10b981', '#3b82f6', '#ec4899', '#8b5cf6', '#d4ff00'];
  const particles = Array.from({ length: 60 }).map((_, i) => ({
    id: i,
    color: colors[i % colors.length],
    x: Math.random() * 400 - 200,
    y: Math.random() * -300 - 50,
    scale: Math.random() * 0.7 + 0.3,
    rotation: Math.random() * 360,
  }));
  
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden flex items-center justify-center z-50">
      {particles.map(p => (
        <motion.div
          key={p.id}
          initial={{ x: 0, y: 200, scale: 0, rotate: 0, opacity: 1 }}
          animate={{
            x: p.x,
            y: p.y,
            scale: p.scale,
            rotate: p.rotation + 360,
            opacity: [1, 1, 0]
          }}
          transition={{ duration: 2, ease: "easeOut" }}
          className="absolute w-2.5 h-2.5 rounded-sm"
          style={{ backgroundColor: p.color }}
        />
      ))}
    </div>
  );
};

export default function RenewalWizardModal({ isOpen, member, onClose }: RenewalWizardProps) {
  const { addPayment, updateMember, fetchMembers, plans, fetchPlans } = useGymStore();
  const [step, setStep] = useState(1);
  const [trainers, setTrainers] = useState<any[]>([]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const activePlans = plans && plans.length > 0 ? plans : [
    { id: '1m', name: '1 Month Standard', price: 2500, durationDays: 30, features: ['Basic single month access'] },
    { id: '3m', name: '3 Months Pro', price: 6500, durationDays: 90, features: ['Quarterly membership saver'] },
    { id: '6m', name: '6 Months Elite', price: 11500, durationDays: 180, features: ['Semi-annual transformation pack'] },
    { id: '12m', name: '12 Months VIP', price: 18000, durationDays: 365, features: ['Annual ultimate access'] },
  ];

  const availablePlans = [
    ...activePlans.map((p: any) => ({
      id: p.id || p.name,
      name: p.name,
      price: p.price,
      duration: Math.max(1, Math.round((p.durationDays || 30) / 30)),
      desc: Array.isArray(p.features) && p.features.length > 0 ? p.features.join(', ') : `${p.duration || (p.durationDays ? `${p.durationDays} Days` : 'Access')}`
    })),
    { id: 'pt', name: 'Personal Training (PT)', price: 8000, duration: 1, desc: '1-on-1 personal trainer sessions' },
    { id: 'custom', name: 'Custom Custom Plan', price: 0, duration: 1, desc: 'Enter custom pricing and duration' },
  ];

  // Step 1 states
  const [selectedPlanId, setSelectedPlanId] = useState(availablePlans[0]?.id || '1m');
  const [customPrice, setCustomPrice] = useState(3000);
  const [customDuration, setCustomDuration] = useState(1);

  // Step 2 states
  const [method, setMethod] = useState('UPI');
  const [discount, setDiscount] = useState(0);
  const [coupon, setCoupon] = useState('');
  const [gst, setGst] = useState(0);
  const [admissionFee, setAdmissionFee] = useState(0);
  const [outstanding, setOutstanding] = useState(member?.outstandingBalance || 0);
  const [startDateOption, setStartDateOption] = useState<'extend' | 'today' | 'custom'>('extend');
  const [customStartDate, setCustomStartDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Step 3 states
  const [assignedTrainer, setAssignedTrainer] = useState(member?.trainer || '');

  // Step 4 Completion states
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeDone, setCompleteDone] = useState(false);
  const [notifications, setNotifications] = useState({
    email: 'pending',
    whatsapp: 'pending',
    push: 'pending',
  });
  const [generatedInvoiceData, setGeneratedInvoiceData] = useState<any>(null);

  useEffect(() => {
    API.get('/trainers')
      .then(res => setTrainers(res.data))
      .catch(err => console.error('Failed to load trainers:', err));
  }, []);

  useEffect(() => {
    if (member) {
      setOutstanding(member.outstandingBalance || 0);
      setAssignedTrainer(member.trainer || '');
    }
  }, [member]);

  if (!isOpen || !member) return null;

  const currentPlan = availablePlans.find(p => p.id === selectedPlanId) || availablePlans[0];
  const planPrice = selectedPlanId === 'custom' ? customPrice : currentPlan.price;
  const planDuration = selectedPlanId === 'custom' ? customDuration : currentPlan.duration;

  // Coupon Code application
  const getCouponDiscount = () => {
    if (coupon.toUpperCase() === 'WARRIOR10' || coupon.toUpperCase() === 'ALPHA10') {
      return Math.round(planPrice * 0.1);
    }
    if (coupon.toUpperCase() === 'FIT20') {
      return Math.round(planPrice * 0.2);
    }
    return 0;
  };

  const couponDiscount = getCouponDiscount();
  const totalDiscount = Number(discount) + couponDiscount;
  const gstAmount = Number(gst);
  const totalAmount = Math.max(0, Number(planPrice) + Number(admissionFee) + Number(outstanding) - totalDiscount + gstAmount);

  const getRenewalStartDate = () => {
    const today = new Date().toISOString().split('T')[0];
    const curExpiry = member?.expiryDate;
    if (startDateOption === 'custom' && customStartDate) {
      return customStartDate;
    }
    if (startDateOption === 'today') {
      return today;
    }
    if (curExpiry && curExpiry >= today) {
      const eDate = new Date(curExpiry);
      eDate.setDate(eDate.getDate() + 1);
      return eDate.toISOString().split('T')[0];
    }
    return today;
  };

  const calculateNewExpiry = () => {
    const startBase = getRenewalStartDate();
    const planName = selectedPlanId === 'custom' ? `${customDuration} Months` : currentPlan.name;
    return membershipEngine.calculatePlanExpiryDate(planName, startBase, plans);
  };

  const newExpiryString = calculateNewExpiry();
  const renewalStart = getRenewalStartDate();
  const todayStr = new Date().toISOString().split('T')[0];
  const calculatedDuration = membershipEngine.calculateDurationDays(newExpiryString, renewalStart);
  const calculatedDaysLeft = membershipEngine.calculateDaysLeft(newExpiryString);
  const daysUntilStart = membershipEngine.calculateDaysUntilStart(renewalStart);

  const handleNextStep = () => {
    setStep(prev => prev + 1);
  };

  const handlePrevStep = () => {
    setStep(prev => prev - 1);
  };

  const handleFinish = async () => {
    setIsCompleting(true);
    try {
      const generatedInvoiceNum = 'INV-' + Math.floor(100000 + Math.random() * 900000);
      const planName = selectedPlanId === 'custom' ? `Custom (${customDuration}m)` : currentPlan.name;
      const daysLeftCount = renewalStart > todayStr ? calculatedDuration : membershipEngine.calculateDaysLeft(newExpiryString);
      const computedMemberStatus = renewalStart > todayStr ? 'upcoming' : 'active';

      const invoiceData = {
        memberId: member.id,
        memberName: member.name,
        memberPhone: member.phone || '',
        amount: totalAmount,
        originalAmount: planPrice,
        discountAmount: totalDiscount,
        discount: totalDiscount,
        netPayable: totalAmount,
        amountPaid: totalAmount,
        paid: totalAmount,
        plan: planName,
        method: method,
        status: 'paid',
        invoice: generatedInvoiceNum,
        invoiceNumber: generatedInvoiceNum,
        date: todayStr,
        paymentDate: todayStr,
        transactionType: 'membership_payment',
        isHistorical: false,
        imported: false,
        startDate: renewalStart,
        expiryDate: newExpiryString,
        createdAt: new Date().toISOString(),
        isRealTimeToday: true
      };

      await addPayment(invoiceData);
      setGeneratedInvoiceData(invoiceData);

      const newHistoryItem = {
        packageName: planName,
        startDate: renewalStart,
        expiryDate: newExpiryString,
        amount: totalAmount,
        invoiceNumber: generatedInvoiceNum,
        renewedAt: new Date().toISOString()
      };

      const existingHistory = Array.isArray(member.membershipHistory) ? member.membershipHistory : [];
      const updatedHistory = [newHistoryItem, ...existingHistory];

      // Keep current active status if current membership is active until renewalStart
      const activeExpiry = renewalStart > todayStr ? (member.expiryDate || newExpiryString) : newExpiryString;
      const finalStatus = renewalStart > todayStr ? 'upcoming' : membershipEngine.calculateMembershipStatus(activeExpiry, member.startDate || member.joinDate || todayStr);

      await updateMember(member.id, {
        plan: planName,
        price: planPrice,
        amount: totalAmount,
        totalBilled: (Number(member.totalBilled) || 0) + totalAmount,
        totalPaid: (Number(member.totalPaid) || 0) + totalAmount,
        expiryDate: newExpiryString,
        daysLeft: daysLeftCount,
        status: finalStatus,
        paymentStatus: 'paid',
        membershipHistory: updatedHistory
      });

      member.plan = planName;
      member.expiryDate = newExpiryString;
      member.daysLeft = daysLeftCount;
      member.status = 'active';

      setCompleteDone(true);
      fetchMembers();
      toast.success(`🎉 Membership Renewed! New expiry: ${newExpiryString} (${daysLeftCount} Days Left)`);

      setTimeout(() => setNotifications(n => ({ ...n, email: 'sent' })), 600);
      setTimeout(() => setNotifications(n => ({ ...n, whatsapp: 'sent' })), 1200);
      setTimeout(() => setNotifications(n => ({ ...n, push: 'sent' })), 1800);
    } catch (err: any) {
      toast.error('Failed to complete membership renewal: ' + err.message);
    } finally {
      setIsCompleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 md:p-6 overflow-y-auto bg-slate-950/85 backdrop-blur-xl">
      {/* Backdrop */}
      <div className="absolute inset-0" onClick={completeDone ? undefined : onClose} />

      {/* Glassmorphic Workspace Card */}
      <motion.div 
        initial={{ scale: 0.96, y: 15, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-[32px] shadow-2xl z-10 overflow-hidden text-slate-800 p-6 md:p-8 max-h-[92vh] flex flex-col justify-between overflow-y-auto text-left"
      >
        {/* Step Indicator Header */}
        {!completeDone && (
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Step {step} of 3</span>
              <h3 className="text-base font-black text-slate-900 leading-tight">Membership Renewal</h3>
            </div>
            <button onClick={onClose} className="p-1 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600">
              <X size={16} />
            </button>
          </div>
        )}

        {/* Wizard Step Content */}
        <div className="flex-1 py-4">
          <AnimatePresence mode="wait">
            {step === 1 && !completeDone && (
              <motion.div 
                key="step1"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-4"
              >
                <h4 className="text-sm font-black text-slate-800">Choose Membership Plan</h4>
                <div className="grid grid-cols-2 gap-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {availablePlans.map(p => (
                    <div 
                      key={p.id}
                      onClick={() => setSelectedPlanId(p.id)}
                      className={`p-3 rounded-2xl border text-left cursor-pointer transition-all duration-300 relative overflow-hidden ${
                        selectedPlanId === p.id 
                          ? 'border-indigo-600 bg-indigo-50/40 shadow-sm ring-1 ring-indigo-500' 
                          : 'border-slate-200 bg-white/40 hover:bg-slate-50'
                      }`}
                    >
                      <div className="font-bold text-xs text-slate-900 flex justify-between">
                        <span>{p.name.replace(/\(.*\)/g, '')}</span>
                        {selectedPlanId === p.id && <span className="text-indigo-600"><Check size={12} /></span>}
                      </div>
                      <div className="text-[11px] font-extrabold text-indigo-600 mt-1">
                        {p.id === 'custom' ? 'Custom Quote' : formatCurrency(p.price)}
                      </div>
                      <p className="text-[9px] text-slate-400 mt-1 leading-normal">{p.desc}</p>
                    </div>
                  ))}
                </div>

                {selectedPlanId === 'custom' && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200"
                  >
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase block">Price (INR)</label>
                      <input 
                        type="number" 
                        value={customPrice}
                        onChange={e => setCustomPrice(Math.max(0, Number(e.target.value)))}
                        className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-bold text-slate-500 uppercase block">Duration (Months)</label>
                      <input 
                        type="number" 
                        value={customDuration}
                        onChange={e => setCustomDuration(Math.max(1, Number(e.target.value)))}
                        className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-bold"
                      />
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}

            {step === 2 && !completeDone && (
              <motion.div 
                key="step2"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-4"
              >
                <h4 className="text-sm font-black text-slate-800">Payment Configuration</h4>
                
                {/* Renewal Start Date Option */}
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Renewal Start Date Option</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setStartDateOption('extend')}
                      className={`py-2 px-2 text-[10px] font-bold rounded-xl border text-left transition-all ${
                        startDateOption === 'extend'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-extrabold shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="truncate">📅 Extend Expiry</div>
                      <div className="text-[9px] opacity-70 font-normal mt-0.5 truncate">{member?.expiryDate || 'Expiry'}</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStartDateOption('today')}
                      className={`py-2 px-2 text-[10px] font-bold rounded-xl border text-left transition-all ${
                        startDateOption === 'today'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-extrabold shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="truncate">⚡ Start Today</div>
                      <div className="text-[9px] opacity-70 font-normal mt-0.5 truncate">{new Date().toISOString().split('T')[0]}</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStartDateOption('custom')}
                      className={`py-2 px-2 text-[10px] font-bold rounded-xl border text-left transition-all ${
                        startDateOption === 'custom'
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-extrabold shadow-sm'
                          : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="truncate">✏️ Custom Date</div>
                      <div className="text-[9px] opacity-70 font-normal mt-0.5 truncate">{customStartDate || 'Pick Date'}</div>
                    </button>
                  </div>

                  {startDateOption === 'custom' && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      className="mt-2 p-2.5 bg-indigo-50/60 border border-indigo-100 rounded-xl space-y-1"
                    >
                      <label className="text-[9px] font-bold text-indigo-900 uppercase block">Select Custom Start Date</label>
                      <input 
                        type="date"
                        value={customStartDate}
                        onChange={e => setCustomStartDate(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-indigo-500"
                      />
                    </motion.div>
                  )}
                </div>

                {/* Method selector */}
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1.5">Payment Method</label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {METHODS.map(m => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        className={`py-2 text-[10px] font-bold rounded-xl border transition-all ${
                          method === m 
                            ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm' 
                            : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-600'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Form fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">Membership Price</label>
                    <div className="mt-1 text-xs font-black text-slate-800 py-2 border-b border-slate-100">
                      {formatCurrency(planPrice)}
                    </div>
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">Outstanding Balance</label>
                    <input 
                      type="number" 
                      value={outstanding}
                      onChange={e => setOutstanding(Number(e.target.value))}
                      className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">Membership Discount</label>
                    <input 
                      type="number" 
                      value={discount}
                      onChange={e => setDiscount(Math.max(0, Number(e.target.value)))}
                      className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">Coupon Code</label>
                    <input 
                      type="text" 
                      placeholder="WARRIOR10 (10%), FIT20 (20%)" 
                      value={coupon}
                      onChange={e => setCoupon(e.target.value)}
                      className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-mono uppercase tracking-wider font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">GST Fee</label>
                    <input 
                      type="number" 
                      value={gst}
                      onChange={e => setGst(Math.max(0, Number(e.target.value)))}
                      className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase block">Admission Fee</label>
                    <input 
                      type="number" 
                      value={admissionFee}
                      onChange={e => setAdmissionFee(Math.max(0, Number(e.target.value)))}
                      className="w-full mt-1 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center justify-between">
                  <div className="text-xs font-bold text-slate-600">Total Charged Amount</div>
                  <div className="text-lg font-black text-indigo-600">{formatCurrency(totalAmount)}</div>
                </div>
              </motion.div>
            )}

            {step === 3 && !completeDone && (
              <motion.div 
                key="step3"
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: -20, opacity: 0 }}
                className="space-y-4"
              >
                <h4 className="text-sm font-black text-slate-800">Review & Confirm</h4>
                
                <div className="bg-slate-50 border border-slate-150 rounded-2xl p-4 space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-bold">Client Name</span>
                    <span className="font-extrabold text-slate-900">{member.name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-bold">Old Plan &rArr; New Plan</span>
                    <span className="font-bold text-slate-900">{member.plan || 'Standard'} &rarr; <span className="text-indigo-600 font-black">{selectedPlanId === 'custom' ? `Custom` : currentPlan.name}</span></span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-bold">New Expiry Date</span>
                    <span className="font-extrabold text-slate-900 flex items-center gap-1">
                      <Calendar size={12} className="text-indigo-500" />
                      {new Date(newExpiryString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-bold">Payment Method</span>
                    <span className="font-extrabold text-slate-800">{method}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100">
                    <span className="text-slate-500 font-bold">Outstanding Balance Paid</span>
                    <span className="font-extrabold text-slate-800">{formatCurrency(outstanding)}</span>
                  </div>
                  <div className="flex justify-between py-1 pt-2">
                    <span className="text-slate-900 font-extrabold text-sm">Amount Paid</span>
                    <span className="font-black text-indigo-600 text-base">{formatCurrency(totalAmount)}</span>
                  </div>
                </div>

                {/* Trainer assignment */}
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase block mb-1">Assign Strength Trainer</label>
                  <select 
                    value={assignedTrainer}
                    onChange={e => setAssignedTrainer(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Leave Unassigned / No Trainer</option>
                    {trainers.map(t => (
                      <option key={t.id} value={t.name}>{t.name} ({t.specialization})</option>
                    ))}
                  </select>
                </div>
              </motion.div>
            )}

            {/* Step 4: Completion Screen */}
            {completeDone && (
              <motion.div 
                key="step4"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="space-y-6 py-2 relative text-center"
              >
                <Confetti />

                <div className="space-y-1">
                  <h3 className="text-xl font-black text-slate-900 flex items-center justify-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-emerald-500 text-white text-xs flex items-center justify-center shadow-md">✓</span>
                    Membership Renewed Successfully!
                  </h3>
                  <p className="text-xs text-slate-500">Database updated, new expiry calculated & Official Tax Invoice generated.</p>
                </div>

                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 shadow-inner max-w-2xl mx-auto overflow-hidden text-left">
                  <OfficialInvoiceReceipt
                    invoice={generatedInvoiceData || {
                      amount: totalAmount,
                      paid: totalAmount,
                      discount: totalDiscount,
                      plan: selectedPlanId === 'custom' ? `Custom (${customDuration}m)` : currentPlan.name,
                      expiryDate: newExpiryString,
                      startDate: member.expiryDate && member.expiryDate > new Date().toISOString().split('T')[0] ? member.expiryDate : new Date().toISOString().split('T')[0]
                    }}
                    member={member}
                    onPrint={() => window.print()}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer controls */}
        {!completeDone && (
          <div className="flex gap-2 pt-4 border-t border-slate-100 mt-4">
            {step > 1 && (
              <button 
                onClick={handlePrevStep}
                className="flex items-center justify-center gap-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border border-slate-200"
              >
                <ArrowLeft size={14} /> Back
              </button>
            )}
            
            {step < 3 ? (
              <button 
                onClick={handleNextStep}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all border-none shadow-sm cursor-pointer"
              >
                Continue <ArrowRight size={14} />
              </button>
            ) : (
              <button 
                onClick={handleFinish}
                disabled={isCompleting}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all border-none shadow-sm cursor-pointer disabled:opacity-50"
              >
                {isCompleting ? 'Renewing...' : 'Finalize & Charge Renewal'} <Sparkles size={14} className="text-white" />
              </button>
            )}
          </div>
        )}

        {completeDone && (
          <button 
            onClick={onClose}
            className="w-full py-3 bg-black hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider text-center mt-4 transition-colors cursor-pointer border-none shadow-md"
          >
            All Done - Exit Wizard
          </button>
        )}
      </motion.div>
    </div>
  );
}
