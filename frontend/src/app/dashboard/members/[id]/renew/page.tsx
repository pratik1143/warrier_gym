'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, ArrowRight, Check, Sparkles, CreditCard, User, 
  Dumbbell, Receipt, Mail, MessageSquare, Bell, Calendar, DollarSign,
  Shield, CheckCircle2, Clock, Activity, FileText
} from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, updateDoc, addDoc, collection } from 'firebase/firestore';
import toast from '@/lib/toast';
import { membershipEngine } from '@/lib/engines/membershipEngine';
import { formatCurrency } from '@/lib/utils';
import API from '@/services/api';
import { useGymStore } from '@/store';
import MemberAvatar from '../../../components/MemberAvatar';
import OfficialInvoiceReceipt from '../../../components/OfficialInvoiceReceipt';

const PLANS = [
  { id: '1m', name: '1 Month Standard', price: 2500, duration: 1, desc: 'Basic single month access' },
  { id: '3m', name: '3 Months Pro', price: 6500, duration: 3, desc: 'Quarterly membership saver' },
  { id: '6m', name: '6 Months Elite', price: 11500, duration: 6, desc: 'Semi-annual transformation pack' },
  { id: '12m', name: '12 Months VIP', price: 18000, duration: 12, desc: 'Annual ultimate access' },
  { id: '10d', name: '10 Days Pass', price: 1000, duration: 0.33, desc: '10 Days short trial pass' },
  { id: 'pt', name: 'Personal Training (PT)', price: 8000, duration: 1, desc: '1-on-1 personal trainer sessions' },
  { id: 'premium', name: 'Premium Platinum', price: 25000, duration: 12, desc: 'All-inclusive premium annual access' },
  { id: 'custom', name: 'Custom Plan', price: 0, duration: 1, desc: 'Enter custom pricing and duration' },
];

const METHODS = ['Cash', 'UPI', 'Card', 'Bank', 'Cheque', 'Split Payment'];

export default function RenewMembershipPage() {
  const router = useRouter();
  const params = useParams();
  const rawId = params?.id as string;
  const id = rawId ? decodeURIComponent(rawId) : '';

  const { fetchMembers } = useGymStore();
  const [member, setMember] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Wizard state
  const [step, setStep] = useState(1);
  const [selectedPlanId, setSelectedPlanId] = useState('1m');
  const [customPrice, setCustomPrice] = useState(2500);
  const [customDuration, setCustomDuration] = useState(1);
  
  // Step 2 pricing adjustments
  const [discount, setDiscount] = useState(0);
  const [coupon, setCoupon] = useState('');
  const [method, setMethod] = useState('UPI');
  const [gst, setGst] = useState(0);
  const [admissionFee, setAdmissionFee] = useState(0);
  const [outstanding, setOutstanding] = useState(0);
  const [startDateOption, setStartDateOption] = useState<'extend' | 'today' | 'custom'>('extend');
  const [customStartDate, setCustomStartDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Step 3 states
  const [assignedTrainer, setAssignedTrainer] = useState('');
  const [trainers, setTrainers] = useState<any[]>([]);

  // Completion states
  const [isCompleting, setIsCompleting] = useState(false);
  const [completeDone, setCompleteDone] = useState(false);
  const [generatedInvoiceData, setGeneratedInvoiceData] = useState<any>(null);

  // Robust Self-Healing Member Fetching (Firestore + API + Store Fallback)
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    let isMounted = true;

    const fetchFallbackMember = async () => {
      // 1. Check Gym Store
      const storeMembers = useGymStore.getState().members || [];
      const foundInStore = storeMembers.find((m: any) => m.id === id || m.uid === id || m.memberId === id);
      if (foundInStore && isMounted) {
        setMember(foundInStore);
        setOutstanding(foundInStore.outstandingBalance || 0);
        setAssignedTrainer(foundInStore.trainer || '');
        setLoading(false);
        return;
      }

      // 2. Check Backend REST API
      try {
        const res = await API.get('/members');
        const list = res.data || [];
        const found = list.find((m: any) => m.id === id || m.uid === id || m.memberId === id);
        if (found && isMounted) {
          setMember(found);
          setOutstanding(found.outstandingBalance || 0);
          setAssignedTrainer(found.trainer || '');
          setLoading(false);
          return;
        }
      } catch (e) {
        console.warn('API fallback fetch failed:', e);
      }

      if (isMounted) {
        setLoading(false);
      }
    };

    const unsub = onSnapshot(doc(db, 'members', id), (docSnap) => {
      if (!isMounted) return;
      if (docSnap.exists()) {
        const data: any = { id: docSnap.id, ...(docSnap.data() as any) };
        setMember(data);
        setOutstanding(data.outstandingBalance || 0);
        setAssignedTrainer(data.trainer || '');
        setLoading(false);
      } else {
        fetchFallbackMember();
      }
    }, (err) => {
      console.warn('Firestore onSnapshot notice:', err);
      if (isMounted) fetchFallbackMember();
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [id]);

  // Fetch Trainers
  useEffect(() => {
    API.get('/trainers')
      .then(res => setTrainers(res.data))
      .catch(err => console.error('Failed to load trainers:', err));
  }, []);

  const currentPlan = PLANS.find(p => p.id === selectedPlanId) || PLANS[0];
  const planPrice = selectedPlanId === 'custom' ? customPrice : currentPlan.price;

  // Coupon calculations
  const getCouponDiscount = () => {
    if (coupon.toUpperCase() === 'WARRIOR10' || coupon.toUpperCase() === 'ALPHA10') return Math.round(planPrice * 0.1);
    if (coupon.toUpperCase() === 'FIT20') return Math.round(planPrice * 0.2);
    return 0;
  };

  const couponDiscount = getCouponDiscount();
  const totalDiscount = Number(discount) + couponDiscount;
  const gstAmount = Number(gst);
  const totalAmount = Math.max(0, Number(planPrice) + Number(admissionFee) + Number(outstanding) - totalDiscount + gstAmount);

  const getEffectiveStartDate = () => {
    const today = new Date().toISOString().split('T')[0];
    const curExpiry = member?.expiryDate;
    if (startDateOption === 'custom' && customStartDate) {
      return customStartDate;
    }
    if (startDateOption === 'extend' && curExpiry && curExpiry > today) {
      return curExpiry;
    }
    return today;
  };

  // Live Expiry Date calculation
  const calculateNewExpiry = () => {
    const startBase = getEffectiveStartDate();
    const planName = selectedPlanId === 'custom' ? `${customDuration} Months` : currentPlan.name;
    return membershipEngine.calculatePlanExpiryDate(planName, startBase, PLANS);
  };

  const newExpiryString = calculateNewExpiry();
  const effectiveStartDate = getEffectiveStartDate();
  const todayStr = new Date().toISOString().split('T')[0];

  const calculatedDuration = membershipEngine.calculateDurationDays(newExpiryString, effectiveStartDate);
  const calculatedDaysLeft = membershipEngine.calculateDaysLeft(newExpiryString);
  const daysUntilStart = membershipEngine.calculateDaysUntilStart(effectiveStartDate);

  const handleFinishRenewal = async () => {
    setIsCompleting(true);
    try {
      const generatedInvoiceNum = 'INV-' + Math.floor(100000 + Math.random() * 900000);
      const todayStr = new Date().toISOString().split('T')[0];
      const planName = selectedPlanId === 'custom' ? `Custom (${customDuration}m)` : currentPlan.name;
      const startDateVal = getEffectiveStartDate();
      const daysLeftCount = startDateVal > todayStr ? calculatedDuration : membershipEngine.calculateDaysLeft(newExpiryString);
      const computedMemberStatus = startDateVal > todayStr ? 'upcoming' : 'active';

      const invoiceData = {
        memberId: member.id,
        memberName: member.name,
        memberPhone: member.phone || '',
        amount: totalAmount,
        paid: totalAmount,
        plan: planName,
        method: method,
        discount: totalDiscount,
        status: 'paid',
        invoice: generatedInvoiceNum,
        invoiceNumber: generatedInvoiceNum,
        date: todayStr,
        startDate: startDateVal,
        expiryDate: newExpiryString,
        createdAt: new Date().toISOString()
      };

      // Add to payments collection in Firestore
      await addDoc(collection(db, 'payments'), invoiceData);
      setGeneratedInvoiceData(invoiceData);

      // Membership history item
      const newHistoryItem = {
        packageName: planName,
        startDate: startDateVal,
        expiryDate: newExpiryString,
        amount: totalAmount,
        invoiceNumber: generatedInvoiceNum,
        renewedAt: new Date().toISOString()
      };

      const existingHistory = Array.isArray(member.membershipHistory) ? member.membershipHistory : [];
      const updatedHistory = [newHistoryItem, ...existingHistory];

      // Update Member Document in Firestore
      await updateDoc(doc(db, 'members', member.id), {
        plan: planName,
        price: planPrice,
        amount: totalAmount,
        totalBilled: totalAmount,
        totalPaid: totalAmount,
        expiryDate: newExpiryString,
        daysLeft: daysLeftCount,
        status: computedMemberStatus,
        paymentStatus: 'paid',
        trainer: assignedTrainer || member.trainer || '',
        membershipHistory: updatedHistory,
        updatedAt: new Date().toISOString()
      });

      setCompleteDone(true);
      fetchMembers();
      toast.success(`🎉 Membership Renewed Successfully! New Expiry: ${newExpiryString} (${daysLeftCount} Days Left)`);
    } catch (err: any) {
      toast.error('Failed to complete membership renewal: ' + err.message);
    } finally {
      setIsCompleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Activity size={24} className="text-[#EA580C] animate-spin" />
          <span className="font-bold text-sm text-slate-600">Loading Member Renewal Workspace...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/60 text-slate-900 p-4 md:p-8 font-sans">
      {/* Header Bar */}
      <div className="max-w-6xl mx-auto flex items-center justify-between pb-6 border-b border-slate-200">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => router.push(`/dashboard/members/${encodeURIComponent(id)}`)}
            className="p-2.5 bg-white hover:bg-slate-100 text-slate-700 rounded-2xl border border-slate-200 shadow-sm transition-all flex items-center gap-2 cursor-pointer text-xs font-bold active:scale-95"
          >
            <ArrowLeft size={16} /> Back to Member Profile
          </button>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <CreditCard className="text-[#EA580C]" size={22} />
              Membership Renewal Workspace
            </h1>
            <p className="text-xs text-slate-500 font-medium mt-0.5">Select package, calculate discount, and generate tax receipt invoice.</p>
          </div>
        </div>

        {member && (
          <div className="flex items-center gap-3 bg-white border border-slate-200 p-2.5 px-4 rounded-2xl shadow-sm">
            <MemberAvatar member={member} size={36} />
            <div className="text-left">
              <div className="text-xs font-black text-slate-900">{member.name}</div>
              <div className="text-[10px] text-slate-500 font-mono font-bold">Current Expiry: {member.expiryDate || 'N/A'} ({member.daysLeft || 0} Days)</div>
            </div>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto mt-6">
        {!completeDone ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 Cols: Step-by-Step Forms */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Step Navigation Tabs */}
              <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                {[
                  { stepNum: 1, title: '1. Select Plan' },
                  { stepNum: 2, title: '2. Pricing & Discount' },
                  { stepNum: 3, title: '3. Trainer & Review' },
                ].map((s) => (
                  <button
                    key={s.stepNum}
                    onClick={() => setStep(s.stepNum)}
                    className={`flex-1 py-3 px-4 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      step === s.stepNum
                        ? 'bg-slate-900 text-white shadow-md'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                    }`}
                  >
                    {s.title}
                  </button>
                ))}
              </div>

              {/* STEP 1: Select Plan */}
              {step === 1 && (
                <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 space-y-6 text-left">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Choose Membership Package</h3>
                    <p className="text-xs text-slate-500 mt-1">Select from available membership duration packages or create a custom plan.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {PLANS.map((plan) => {
                      const isSelected = selectedPlanId === plan.id;
                      return (
                        <div
                          key={plan.id}
                          onClick={() => setSelectedPlanId(plan.id)}
                          className={`p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden ${
                            isSelected
                              ? 'bg-orange-50/60 border-2 border-[#EA580C] shadow-sm'
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100/50'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-black text-sm text-slate-900">{plan.name}</h4>
                              <p className="text-[11px] text-slate-500 mt-1">{plan.desc}</p>
                            </div>
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center text-xs ${
                              isSelected ? 'bg-[#EA580C] border-[#EA580C] text-white font-bold' : 'border-slate-300 bg-white'
                            }`}>
                              {isSelected ? '✓' : ''}
                            </div>
                          </div>

                          <div className="mt-4 flex justify-between items-end border-t border-slate-100 pt-3">
                            <div className="text-lg font-black text-[#EA580C] font-mono">
                              {plan.id === 'custom' ? 'Custom Pricing' : formatCurrency(plan.price)}
                            </div>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-lg">
                              {plan.duration >= 1 ? `${plan.duration} Month${plan.duration > 1 ? 's' : ''}` : '10 Days'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {selectedPlanId === 'custom' && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                      <h4 className="text-xs font-black text-slate-900">Custom Duration & Pricing</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Custom Price (₹)</label>
                          <input 
                            type="number" 
                            value={customPrice}
                            onChange={e => setCustomPrice(Number(e.target.value))}
                            className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#F97316]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Duration (Months)</label>
                          <input 
                            type="number" 
                            value={customDuration}
                            onChange={e => setCustomDuration(Number(e.target.value))}
                            className="w-full p-3 bg-white border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#F97316]"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end pt-2">
                    <button
                      onClick={() => setStep(2)}
                      className="px-6 py-3 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      Next: Pricing & Discount <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: Pricing & Discount */}
              {step === 2 && (
                <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 space-y-6 text-left">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Pricing, Discount & Start Date</h3>
                    <p className="text-xs text-slate-500 mt-1">Apply discount, select start date option, and review total collected amount.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Discount Amount (₹)</label>
                      <input 
                        type="number"
                        placeholder="0"
                        value={discount || ''}
                        onChange={e => setDiscount(Number(e.target.value))}
                        className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#F97316]"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">Promo Coupon Code</label>
                      <input 
                        type="text"
                        placeholder="e.g. WARRIOR10 or FIT20"
                        value={coupon}
                        onChange={e => setCoupon(e.target.value)}
                        className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 uppercase tracking-wider focus:outline-none focus:border-[#F97316]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Renewal Start Date Option</label>
                    <div className="grid grid-cols-3 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setStartDateOption('extend')}
                        className={`p-3 rounded-2xl border text-xs font-bold text-left cursor-pointer transition-all ${
                          startDateOption === 'extend'
                            ? 'bg-[#FFF7ED] border-2 border-[#EA580C] text-blue-900 shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="font-extrabold truncate">📅 Extend Expiry</div>
                        <div className="text-[10px] opacity-70 font-normal mt-0.5 truncate">{member?.expiryDate || 'Current Expiry'}</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStartDateOption('today')}
                        className={`p-3 rounded-2xl border text-xs font-bold text-left cursor-pointer transition-all ${
                          startDateOption === 'today'
                            ? 'bg-[#FFF7ED] border-2 border-[#EA580C] text-blue-900 shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="font-extrabold truncate">⚡ Start Today</div>
                        <div className="text-[10px] opacity-70 font-normal mt-0.5 truncate">{new Date().toISOString().split('T')[0]}</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setStartDateOption('custom')}
                        className={`p-3 rounded-2xl border text-xs font-bold text-left cursor-pointer transition-all ${
                          startDateOption === 'custom'
                            ? 'bg-[#FFF7ED] border-2 border-[#EA580C] text-blue-900 shadow-sm'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        <div className="font-extrabold truncate">✏️ Custom Date</div>
                        <div className="text-[10px] opacity-70 font-normal mt-0.5 truncate">{customStartDate || 'Pick Date'}</div>
                      </button>
                    </div>

                    {startDateOption === 'custom' && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        className="mt-3 p-3.5 bg-orange-50/60 border border-[#FED7AA] rounded-2xl space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-black text-blue-900 uppercase tracking-wider block">Custom Membership Start Date</label>
                          <span className="text-[10px] font-bold text-[#EA580C]">Auto Calculates Below</span>
                        </div>
                        <input 
                          type="date"
                          value={customStartDate}
                          onChange={(e) => setCustomStartDate(e.target.value)}
                          className="w-full p-2.5 bg-white border border-[#FDBA74] rounded-xl text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-200 cursor-pointer"
                        />
                        <p className="text-[10px] text-[#C2410C] font-medium">
                          Starts on <span className="font-bold font-mono">{customStartDate}</span>. Expiry and days left update instantly.
                        </p>
                      </motion.div>
                    )}
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Payment Method</label>
                    <div className="grid grid-cols-3 gap-2">
                      {METHODS.map(m => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setMethod(m)}
                          className={`py-2.5 px-3 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                            method === m
                              ? 'bg-emerald-50 border-2 border-emerald-600 text-emerald-800 shadow-sm'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setStep(1)}
                      className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={() => setStep(3)}
                      className="px-6 py-3 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      Next: Trainer & Review <ArrowRight size={16} />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: Trainer & Review */}
              {step === 3 && (
                <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 space-y-6 text-left">
                  <div>
                    <h3 className="text-base font-black text-slate-900">Trainer Assignment & Final Review</h3>
                    <p className="text-xs text-slate-500 mt-1">Assign personal trainer and review complete renewal details before finalizing.</p>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase block mb-1.5">Assign Personal Trainer</label>
                    <select
                      value={assignedTrainer}
                      onChange={e => setAssignedTrainer(e.target.value)}
                      className="w-full p-3 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:border-[#F97316] cursor-pointer"
                    >
                      <option value="">Leave Unassigned / General Gym Access</option>
                      {trainers.map(t => (
                        <option key={t.id} value={t.name}>{t.name} ({t.specialization})</option>
                      ))}
                    </select>
                  </div>

                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Package:</span>
                      <span className="font-bold text-slate-900">{currentPlan.name}</span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Package Base Price:</span>
                      <span className="font-bold text-slate-900">{formatCurrency(planPrice)}</span>
                    </div>
                    {totalDiscount > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Total Discount Applied:</span>
                        <span className="font-bold">- {formatCurrency(totalDiscount)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-slate-900 pt-2 border-t border-slate-200">
                      <span className="text-sm font-black">Net Total Amount:</span>
                      <span className="text-base font-black text-emerald-600 font-mono">{formatCurrency(totalAmount)}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setStep(2)}
                      className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      ← Back
                    </button>
                    <button
                      onClick={handleFinishRenewal}
                      disabled={isCompleting}
                      className="px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 active:scale-95"
                    >
                      {isCompleting ? 'Finalizing Renewal...' : '⚡ Generate Bill & Complete Renewal'} <Sparkles size={16} />
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Right 1 Col: Live Real-Time Expiry & Amount Preview Sidebar */}
            <div className="space-y-6 text-left">
              <div className="bg-gradient-to-br from-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Live Calculation Preview</span>
                  <Sparkles size={16} className="text-indigo-400" />
                </div>

                <div className="space-y-1">
                  <div className="text-[10px] text-slate-400 font-bold uppercase">Calculated New Expiry Date</div>
                  <div className="text-2xl font-black text-white font-mono">{newExpiryString}</div>
                  <div className="text-xs font-bold text-emerald-400">
                    ({calculatedDuration} Days Duration{effectiveStartDate > todayStr ? ` • Starts in ${daysUntilStart} Days` : ''})
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Member:</span>
                    <span className="font-bold text-white">{member?.name}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Start Date:</span>
                    <span className="font-bold text-indigo-300 font-mono">{effectiveStartDate}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Selected Plan:</span>
                    <span className="font-bold text-[#FB923C]">{currentPlan.name}</span>
                  </div>
                  <div className="flex justify-between text-slate-300">
                    <span>Payment Method:</span>
                    <span className="font-bold text-emerald-400">{method}</span>
                  </div>
                  <div className="flex justify-between text-slate-300 pt-2 border-t border-slate-800">
                    <span className="font-black text-white text-sm">Total Billed:</span>
                    <span className="font-black text-emerald-400 text-base font-mono">{formatCurrency(totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* STEP 4: Full Page Official Invoice Receipt Screen */
          <div className="bg-white border border-slate-200 shadow-sm rounded-3xl p-6 md:p-8 space-y-6 text-center">
            <div className="space-y-2">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 border border-emerald-200 rounded-2xl mx-auto flex items-center justify-center text-xl shadow-sm">
                ✓
              </div>
              <h2 className="text-2xl font-black text-slate-900">Membership Successfully Renewed!</h2>
              <p className="text-xs text-slate-500 max-w-md mx-auto">Database records updated, payment entry logged, and official tax invoice generated.</p>
            </div>

            {/* Render Official Tax Invoice Receipt */}
            <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200 shadow-inner max-w-3xl mx-auto overflow-hidden text-left">
              <OfficialInvoiceReceipt
                invoice={generatedInvoiceData || {
                  amount: totalAmount,
                  paid: totalAmount,
                  discount: totalDiscount,
                  plan: selectedPlanId === 'custom' ? `Custom (${customDuration}m)` : currentPlan.name,
                  expiryDate: newExpiryString,
                  startDate: member?.expiryDate && member.expiryDate > new Date().toISOString().split('T')[0] ? member.expiryDate : new Date().toISOString().split('T')[0]
                }}
                member={member}
                onPrint={() => window.print()}
              />
            </div>

            <div className="flex justify-center gap-4 pt-4">
              <button
                onClick={() => router.push(`/dashboard/members/${encodeURIComponent(id)}`)}
                className="px-8 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black tracking-wider transition-all shadow-md cursor-pointer active:scale-95"
              >
                Return to Member Profile
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
