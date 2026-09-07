'use client';

import React, { useState } from 'react';
import { Camera, Edit2, MapPin, Phone, Mail, Droplet, Activity, User, Briefcase, HeartPulse, CreditCard, Calendar, Clock, Star, Dumbbell, Shield, BadgeCheck, CheckCircle2, AlertCircle, Snowflake, Repeat, Sparkles, Fingerprint, Cpu, XCircle, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { cleanPlanName, parsePlanSegments } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { doc, updateDoc, addDoc, collection } from 'firebase/firestore';
import { useGymStore } from '@/store';
import { membershipEngine } from '@/lib/engines/membershipEngine';
import { resolveAvatarUrl, MALE_DEFAULT_AVATAR } from '@/lib/avatar';
import toast from '@/lib/toast';
import { z } from 'zod';

import CreateNewBillModal from '../../components/CreateNewBillModal';

// ── Production-grade Zod schema for Edit Personal Info ─────────────────────
// Rules aligned with Indian gym member data requirements.
// All optional fields gracefully accept empty string / null / undefined.

/** Normalize an Indian mobile number to bare 10 digits, or return null if invalid. */
function normalizeIndianPhone(raw: string): string | null {
  const stripped = raw.trim().replace(/^\+91[-\s]?/, '').replace(/[-\s]/g, '');
  if (!/^\d{10}$/.test(stripped)) return null;
  if (!/^[6-9]/.test(stripped)) return null;
  if (/^(\d)\1{9}$/.test(stripped)) return null; // all same digit (0000000000, 9999999999, etc.)
  return stripped;
}

const personalInfoSchema = z.object({
  name: z
    .string()
    .transform(v => v.trim())
    .refine(v => v.length > 0, { message: 'Full name is required' })
    .refine(v => v.length >= 2, { message: 'Full name must be at least 2 characters' })
    .refine(v => v.length <= 80, { message: 'Full name cannot exceed 80 characters' })
    .refine(v => /[a-zA-Z]/.test(v), { message: 'Please enter a valid name' }),

  phone: z
    .string()
    .refine(v => v.trim().length > 0, { message: 'Phone number is required' })
    .refine(
      v => normalizeIndianPhone(v) !== null,
      { message: 'Enter a valid 10-digit Indian mobile number' }
    ),

  email: z
    .string()
    .optional()
    .transform(v => (v || '').trim().toLowerCase())
    .refine(
      v => v === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      { message: 'Enter a valid email address' }
    ),

  dob: z
    .string()
    .optional()
    .refine(v => {
      if (!v || v.trim() === '') return true;
      const d = new Date(v);
      if (isNaN(d.getTime())) return false;
      return d <= new Date();
    }, { message: 'Date of birth cannot be in the future' })
    .refine(v => {
      if (!v || v.trim() === '') return true;
      const d = new Date(v);
      if (isNaN(d.getTime())) return false;
      const ageMsDiff = Date.now() - d.getTime();
      const ageYears = ageMsDiff / (1000 * 60 * 60 * 24 * 365.25);
      return ageYears <= 100;
    }, { message: 'Please enter a valid date of birth' }),

  gender: z
    .enum(['Male', 'Female', 'Other', 'Not specified'])
    .optional()
    .default('Male'),

  occupation: z
    .string()
    .optional()
    .transform(v => (v || '').trim())
    .refine(v => v.length <= 100, { message: 'Occupation cannot exceed 100 characters' }),

  // Emergency contact: supports "Father: 9876543210" format.
  // We extract a 10-digit phone suffix and validate that, while preserving the prefix.
  emergencyContact: z
    .string()
    .optional()
    .refine(v => {
      if (!v || v.trim() === '') return true;
      // Extract last contiguous digit block of 10+ characters
      const digitPart = v.replace(/[^0-9+]/g, ' ').trim().split(/\s+/).filter(Boolean).pop() || '';
      return normalizeIndianPhone(digitPart) !== null;
    }, { message: 'Enter a valid emergency contact number (10-digit Indian mobile)' }),

  address: z
    .string()
    .optional()
    .transform(v => (v || '').trim())
    .refine(v => v.length <= 250, { message: 'Address cannot exceed 250 characters' }),
});


const healthSchema = z.object({
  weight: z.number().positive('Weight must be a positive number'),
  height: z.number().positive('Height must be a positive number'),
  bloodGroup: z.string().optional(),
  medicalNotes: z.string().optional(),
});

export default function ProfileTab({ member, onOpenCreateBill }: { member: any; onOpenCreateBill?: () => void }) {
  const router = useRouter();
  const { fetchMembers } = useGymStore();
  const plans = useGymStore(s => s.plans);

  const [showCreateBillModal, setShowCreateBillModal] = useState(false);
  const handleOpenBill = () => {
    if (onOpenCreateBill) {
      onOpenCreateBill();
    } else {
      setShowCreateBillModal(true);
    }
  };

  const isHold = String(member?.status || member?.membershipStatus || '').trim().toUpperCase() === 'HOLD' || member?.activationStatus === 'PENDING_ACTIVATION';

  const [showEditExpiryModal, setShowEditExpiryModal] = useState(false);
  const [customExpiryDate, setCustomExpiryDate] = useState(member.expiryDate || new Date().toISOString().split('T')[0]);
  const [savingExpiry, setSavingExpiry] = useState(false);

  // Edit Modals
  const [showEditPersonalInfoModal, setShowEditPersonalInfoModal] = useState(false);
  const [showEditHealthModal, setShowEditHealthModal] = useState(false);

  // Renew Modal States
  const [showRenewModal, setShowRenewModal] = useState(false);
  const [renewPlan, setRenewPlan] = useState(member.plan || '1 Month');
  const [renewPrice, setRenewPrice] = useState<number>(member.price || member.amount || 1000);
  const [renewPaymentMethod, setRenewPaymentMethod] = useState('UPI');
  const [renewStartDateOption, setRenewStartDateOption] = useState<'extend' | 'today'>('extend');
  const [savingRenew, setSavingRenew] = useState(false);

  // Freeze Modal States
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [freezeDays, setFreezeDays] = useState(7);
  const [freezeReason, setFreezeReason] = useState('Travel / Vacation');
  const [savingFreeze, setSavingFreeze] = useState(false);

  const hasTrainer = Boolean(
    member?.trainerId &&
    member?.trainerId !== 'null' &&
    member?.trainer !== 'Unassigned' &&
    member?.trainerName !== 'Unassigned'
  );

  const handleUpdateExpiry = async (targetDateStr: string) => {
    setSavingExpiry(true);
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const targetDate = new Date(targetDateStr);
      targetDate.setHours(0, 0, 0, 0);

      const diffTime = targetDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const newStatus = diffDays > 0 ? 'active' : 'expired';

      await updateDoc(doc(db, 'members', member.id), {
        expiryDate: targetDateStr,
        daysLeft: diffDays,
        status: newStatus,
        updatedAt: new Date().toISOString(),
      });

      member.expiryDate = targetDateStr;
      member.daysLeft = diffDays;
      member.status = newStatus;

      toast.success(`Expiry date updated to ${targetDateStr}! (${diffDays > 0 ? `${diffDays} days remaining` : 'Expired'})`);
      setShowEditExpiryModal(false);
      fetchMembers();
    } catch (err: any) {
      toast.error('Failed to update expiry date: ' + err.message);
    } finally {
      setSavingExpiry(false);
    }
  };

  const handleFreezeSubmit = async () => {
    if (!member || !member.id) return;
    setSavingFreeze(true);
    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const isCurrentlyFrozen = member.status === 'frozen';

      if (isCurrentlyFrozen) {
        const freezeStart = member.frozenStartDate || todayStr;
        const startD = new Date(freezeStart);
        const nowD = new Date();
        const frozenDurationDays = Math.max(1, Math.ceil((nowD.getTime() - startD.getTime()) / (1000 * 60 * 60 * 24)));

        const oldExpiry = new Date(member.expiryDate || todayStr);
        const newExpiryDate = new Date(oldExpiry.getTime() + frozenDurationDays * 24 * 60 * 60 * 1000);
        const newExpiryStr = newExpiryDate.toISOString().split('T')[0];
        const newDaysLeft = membershipEngine.calculateDaysLeft(newExpiryStr);

        await updateDoc(doc(db, 'members', member.id), {
          status: 'active',
          expiryDate: newExpiryStr,
          daysLeft: newDaysLeft,
          frozenStartDate: null,
          unfrozenAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });

        member.status = 'active';
        member.expiryDate = newExpiryStr;
        member.daysLeft = newDaysLeft;

        toast.success(`⚡ Membership Unfrozen! Expiry extended by ${frozenDurationDays} days to ${newExpiryStr}`);
      } else {
        const daysToFreeze = Number(freezeDays) || 7;
        const currentExpiry = new Date(member.expiryDate || todayStr);
        const newExpiryDate = new Date(currentExpiry.getTime() + daysToFreeze * 24 * 60 * 60 * 1000);
        const newExpiryStr = newExpiryDate.toISOString().split('T')[0];

        const freezeItem = {
          frozenAt: todayStr,
          days: daysToFreeze,
          reason: freezeReason,
          newExpiryDate: newExpiryStr
        };

        const existingFreezeHistory = Array.isArray(member.freezeHistory) ? member.freezeHistory : [];

        await updateDoc(doc(db, 'members', member.id), {
          status: 'frozen',
          frozenStartDate: todayStr,
          freezeReason: freezeReason,
          expiryDate: newExpiryStr,
          freezeHistory: [freezeItem, ...existingFreezeHistory],
          updatedAt: new Date().toISOString()
        });

        member.status = 'frozen';
        member.expiryDate = newExpiryStr;

        toast.success(`❄️ Membership Frozen for ${daysToFreeze} days.`);
      }
      setShowFreezeModal(false);
      fetchMembers();
    } catch (err: any) {
      toast.error('Failed to update freeze status: ' + err.message);
    } finally {
      setSavingFreeze(false);
    }
  };

  return (
    <div className="space-y-6 text-slate-800 text-left font-display">
      {isHold ? (
        <div className="space-y-6">
          {/* Top Row: Section 1 (MEMBERSHIP - HOLD) & Section 2 (PERSONAL INFORMATION) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 1. MEMBERSHIP CARD (HOLD STATE) */}
            <div className="bg-gradient-to-br from-amber-500/10 via-orange-500/10 to-amber-600/10 border-2 border-dashed border-amber-300 rounded-[32px] p-8 relative overflow-hidden flex flex-col justify-between shadow-xs">
              <div className="space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-black text-amber-800 uppercase tracking-widest block mb-1">
                      Membership Status
                    </span>
                    <h2 className="text-2xl font-black text-amber-950 tracking-tight">
                      HOLD (No Active Plan)
                    </h2>
                  </div>
                  <span className="px-3.5 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-200 text-amber-900 border border-amber-300 shadow-xs">
                    Pending Activation
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-white/80 border border-amber-200/80 space-y-2">
                  <p className="text-xs font-bold text-amber-950 flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-600 shrink-0" />
                    No active membership
                  </p>
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    This member was imported from biometric records and is waiting for membership billing. No active plan or billing records exist yet.
                  </p>
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="button"
                  onClick={handleOpenBill}
                  className="w-full py-3.5 px-5 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all border-none cursor-pointer shadow-lg shadow-orange-500/20 flex items-center justify-center gap-2 active:scale-98"
                >
                  <CreditCard size={16} /> + Create Membership &amp; Bill
                </button>
              </div>
            </div>

            {/* 2. PERSONAL INFORMATION */}
            <div className="bg-white rounded-[32px] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-slate-200 p-8 relative">
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <User size={18} className="text-[#F97316]" /> Personal Information
                </h3>
                <button
                  onClick={() => setShowEditPersonalInfoModal(true)}
                  className="p-2 text-slate-400 hover:text-[#EA580C] hover:bg-orange-50 rounded-xl transition-all border-none bg-transparent cursor-pointer"
                  title="Edit Personal Info"
                >
                  <Edit2 size={16} />
                </button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
                <Field icon={User} label="Member Name" value={member.name || '—'} />
                <Field icon={Phone} label="Phone Number" value={member.phone || '—'} />
                <Field icon={Mail} label="Email Address" value={member.email || '—'} />
                <Field icon={Calendar} label="Date of Birth" value={member.dob ? new Date(member.dob).toLocaleDateString() : '—'} />
                <Field icon={User} label="Gender" value={member.gender || '—'} />
                <Field icon={Briefcase} label="Occupation" value={member.occupation || '—'} />
                <Field icon={HeartPulse} label="Emergency Contact" value={member.emergencyContact || '—'} />
                <Field icon={MapPin} label="Address" value={member.address || '—'} />
              </div>
            </div>
          </div>

          {/* Bottom Row: Section 3 (BIOMETRIC / IMPORT INFO) & Section 4 (BILLING OVERVIEW) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 3. BIOMETRIC / IMPORT INFO */}
            <div className="bg-white rounded-[32px] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-slate-200 p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Fingerprint size={18} className="text-[#EA580C]" /> Biometric &amp; Machine Mapping
                </h3>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
                  <BadgeCheck size={12} /> Biometric Linked
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                    Biometric / Device ID
                  </span>
                  <span className="text-base font-black text-slate-900 font-mono">
                    {member.biometricId || member.bioId || member.enrollmentId || member.deviceUserId || '—'}
                  </span>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                    Machine Mapping
                  </span>
                  <span className="text-xs font-black text-emerald-700 flex items-center gap-1 mt-0.5">
                    <CheckCircle2 size={13} className="text-emerald-600" />
                    Hikvision MinMoe Terminal
                  </span>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                    Import Source
                  </span>
                  <span className="text-xs font-bold text-slate-700">
                    Biometric / Excel Import
                  </span>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">
                    Attendance Ready
                  </span>
                  <span className="text-xs font-bold text-emerald-600 flex items-center gap-1">
                    <Sparkles size={12} /> Yes (Syncs to Bio ID)
                  </span>
                </div>
              </div>
            </div>

            {/* 4. BILLING OVERVIEW */}
            <div className="bg-white rounded-[32px] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-slate-200 p-8 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    <CreditCard size={18} className="text-[#EA580C]" /> Billing &amp; Invoices
                  </h3>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                    NOT BILLED
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-6">
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Billed</span>
                    <span className="text-lg font-black text-slate-900 font-mono">₹0</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Total Paid</span>
                    <span className="text-lg font-black text-emerald-600 font-mono">₹0</span>
                  </div>
                  <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 text-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-1">Balance</span>
                    <span className="text-lg font-black text-slate-400 font-mono">₹0</span>
                  </div>
                </div>

                <p className="text-xs text-slate-500 font-medium mb-4">
                  No invoices yet. Create an official membership bill to record payment and generate an invoice.
                </p>
              </div>

              <button
                type="button"
                onClick={handleOpenBill}
                className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all border-none cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus size={15} /> + Create Bill
              </button>
            </div>

          </div>
        </div>
      ) : (
        <>
          {/* TOP ROW: Membership Card & Personal Info */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Active Membership Card (Brand Deep Blue Gradient) */}
            <div className="bg-gradient-to-br from-[#083f82] via-[#EA580C] to-[#9A3412] rounded-[32px] p-8 text-white shadow-2xl relative overflow-hidden flex flex-col justify-between border border-orange-400/30">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full blur-3xl pointer-events-none" />
          
          <div>
            <div className="flex justify-between items-start mb-6">
              <div>
                <span className="text-[10px] font-black text-orange-100 uppercase tracking-widest block mb-1">Active Membership</span>
                <h2 className="text-2xl font-black tracking-tight">{cleanPlanName(member.plan || 'Standard Membership')}</h2>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                member.status === 'active' ? 'bg-white/20 text-white border border-white/30 backdrop-blur-xs' :
                member.status === 'frozen' ? 'bg-blue-300/20 text-orange-100 border border-blue-300/30 backdrop-blur-xs' :
                'bg-rose-500/20 text-rose-200 border border-rose-500/30'
              }`}>
                {member.status || 'Active'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6 bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15">
              <div>
                <span className="text-[10px] font-bold text-blue-200/80 uppercase tracking-wider block mb-1">Start Date</span>
                <span className="text-sm font-black text-white">{member.startDate || 'N/A'}</span>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-blue-200/80 uppercase tracking-wider block mb-1">Expiry Date</span>
                  <button
                    onClick={() => setShowEditExpiryModal(true)}
                    className="p-1 hover:bg-white/10 rounded-lg text-orange-100 hover:text-white transition-all border-none bg-transparent cursor-pointer"
                    title="Edit Expiry Date"
                  >
                    <Edit2 size={12} />
                  </button>
                </div>
                <span className="text-sm font-black text-orange-100">{member.expiryDate || 'N/A'}</span>
              </div>
            </div>

            {/* Membership History Segment */}
            {(() => {
              const historyList = Array.isArray(member.membershipHistory) && member.membershipHistory.length > 0
                ? member.membershipHistory
                : (parsePlanSegments(member.plan) || []).map((seg: any) => ({
                    packageName: seg.plan,
                    startDate: seg.startDate,
                    expiryDate: seg.expiryDate,
                    amount: member.amount || member.price || 0,
                    invoiceNumber: member.invoice || 'Paid'
                  }));

              return (
                <div className="mb-6 pt-4 border-t border-white/10">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-3">Membership History ({historyList.length})</span>
                  <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1">
                    {historyList.map((h: any, idx: number) => (
                      <div key={idx} className="p-2.5 bg-white/10 backdrop-blur-md rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-white">{h.packageName}</div>
                          <div className="text-[10px] text-slate-300">{h.startDate} → {h.expiryDate || 'Active'}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-amber-400">₹{(h.amount || 0).toLocaleString('en-IN')}</div>
                          <div className="text-[9px] uppercase font-bold text-slate-300">{h.invoiceNumber || 'Paid'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-3">
              <button 
                onClick={() => router.push(`/dashboard/members/${encodeURIComponent(member.id)}/renew`)}
                className="flex-1 py-3 bg-white text-slate-900 rounded-xl text-xs font-black transition-all hover:bg-slate-100 flex items-center justify-center gap-2 border-none cursor-pointer shadow-md active:scale-95"
              >
                <CreditCard size={14} className="text-[#EA580C]" /> Renew Plan
              </button>
              <button 
                onClick={() => member.status === 'frozen' ? handleFreezeSubmit() : setShowFreezeModal(true)}
                className={`flex-1 py-3 border rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95 ${
                  member.status === 'frozen'
                    ? 'bg-amber-500 text-slate-900 border-amber-400 hover:bg-amber-400'
                    : 'bg-white/10 border-white/20 text-white hover:bg-white/20'
                }`}
              >
                <Snowflake size={14} /> {member.status === 'frozen' ? '⚡ Unfreeze' : 'Freeze'}
              </button>
            </div>
          </div>
        </div>

        {/* Personal Details Card */}
        <div className="bg-white rounded-[32px] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-slate-100 p-8 relative group">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <User size={18} className="text-[#F97316]" /> Personal Info
            </h3>
            <button
              onClick={() => setShowEditPersonalInfoModal(true)}
              className="p-2 text-slate-400 hover:text-[#EA580C] hover:bg-orange-50 rounded-xl transition-all border-none bg-transparent cursor-pointer"
              title="Edit Personal Info"
            >
              <Edit2 size={16} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
            <Field icon={Phone} label="Phone Number" value={member.phone} />
            <Field icon={Mail} label="Email Address" value={member.email || 'No email provided'} />
            <Field icon={Calendar} label="Date of Birth" value={member.dob ? new Date(member.dob).toLocaleDateString() : 'N/A'} />
            <Field icon={User} label="Gender" value={member.gender || 'Not specified'} />
            <Field icon={Briefcase} label="Occupation" value={member.occupation || 'Not specified'} />
            <Field icon={HeartPulse} label="Emergency Contact" value={member.emergencyContact || 'N/A'} />
          </div>
        </div>
      </div>

      {/* BOTTOM ROW: Health Measurements & Personal Trainer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Physical & Medical Info (Adaptive width) */}
        <div className={hasTrainer ? "lg:col-span-2 bg-white rounded-[32px] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-slate-100 p-8" : "lg:col-span-3 bg-white rounded-[32px] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-slate-100 p-8"}>
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Activity size={18} className="text-rose-500" /> Health & Measurements
            </h3>
            <button
              onClick={() => setShowEditHealthModal(true)}
              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all border-none bg-transparent cursor-pointer"
              title="Edit Health & Measurements"
            >
              <Edit2 size={16} />
            </button>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Weight</span>
              <span className="text-2xl font-black text-slate-900">{member.weight || '--'} <span className="text-sm font-bold text-slate-400">kg</span></span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Height</span>
              <span className="text-2xl font-black text-slate-900">{member.height || '--'} <span className="text-sm font-bold text-slate-400">cm</span></span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Blood Group</span>
              <span className="text-2xl font-black text-rose-500">{member.bloodGroup || '--'}</span>
            </div>
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-center">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">BMI</span>
              <span className="text-2xl font-black text-emerald-500">{member.bmi || '--'}</span>
            </div>
          </div>
          
          <div className="mt-6">
             <Field icon={AlertCircle} label="Medical Notes & Conditions" value={member.medicalNotes || 'No known medical conditions.'} />
          </div>
        </div>

        {/* Biometric & Hikvision Machine Card */}
        <div className="bg-white rounded-[32px] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-slate-100 p-8">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Fingerprint size={18} className="text-[#EA580C]" /> Biometric & Terminal Info
            </h3>
            <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 ${
              member.hikvisionMapped
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-500 border border-slate-200'
            }`}>
              {member.hikvisionMapped ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
              {member.hikvisionMapped ? 'Connected' : 'Not Mapped'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                Biometric User ID
              </span>
              <span className="text-xl font-black text-slate-900 font-mono">
                {member.biometricId || member.biometricUserId || member.deviceUserId || '—'}
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                Face Template
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                {member.hasFace ? (
                  <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Enrolled
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 flex items-center gap-1">
                    <XCircle size={12} /> None
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                Fingerprint
              </span>
              <div className="flex items-center gap-1.5 mt-1">
                {member.hasFingerprint ? (
                  <span className="text-xs font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Enrolled
                  </span>
                ) : (
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200 flex items-center gap-1">
                    <XCircle size={12} /> None
                  </span>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                Mapping Source
              </span>
              <span className="text-xs font-black text-slate-700 bg-orange-50/70 border border-orange-200 px-2.5 py-1 rounded-lg inline-block mt-1 font-mono">
                {member.mappingSource || (member.hikvisionMapped ? 'AUTO' : '—')}
              </span>
            </div>
          </div>
        </div>

        {/* Assigned Trainer Card (ONLY RENDERED IF TRAINER IS ASSIGNED) */}
        {hasTrainer && (
          <div className="bg-white rounded-[32px] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-[#FED7AA] p-8 flex flex-col items-center text-center justify-between">
            <div className="flex flex-col items-center w-full">
              <div className="w-12 h-12 bg-[#FFF7ED] rounded-2xl flex items-center justify-center text-[#EA580C] mb-3 border border-[#FED7AA]">
                <Dumbbell size={22} />
              </div>
              <div className="flex items-center gap-2 mb-3">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">PERSONAL TRAINER</h3>
                <span className="px-2 py-0.5 rounded-full bg-[#FFF7ED] text-[#EA580C] text-[9px] font-black uppercase border border-[#FED7AA]">
                  {member?.pt?.status || 'ACTIVE'}
                </span>
              </div>
              
              <div className="w-20 h-20 rounded-full bg-slate-100 border-[3px] border-white shadow-lg overflow-hidden mb-3 relative shrink-0">
                <img
                  src={member.trainerAvatar || member.pt?.trainerAvatar || resolveAvatarUrl({ name: member.trainerName || member.trainer, role: 'Trainer' })}
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.src = MALE_DEFAULT_AVATAR;
                  }}
                  alt="trainer"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 right-0 bg-[#EA580C] p-1 rounded-full border-2 border-white text-white">
                  <BadgeCheck size={10} />
                </div>
              </div>

              <h4 className="text-lg font-black text-slate-900 leading-tight">{member.trainerName || member.trainer}</h4>
              <span className="text-[10px] font-bold text-slate-500 bg-[#FFF7ED] px-2.5 py-0.5 rounded-full mt-1 border border-[#FED7AA]">
                {member.trainerRole || member.pt?.trainerRole || 'Personal Trainer & Strength'}
              </span>

              {/* PT Package & Validity Breakdown */}
              <div className="w-full mt-4 p-3.5 bg-[#fdfdfd] border border-[#FED7AA] rounded-2xl space-y-2 text-xs text-left">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase">PT Package</span>
                  <span className="font-black text-slate-900">
                    {member?.ptMembership?.packageName || 
                     member?.pt?.packageName || 
                     (member?.pt?.durationMonths ? `${member.pt.durationMonths} Month${member.pt.durationMonths > 1 ? 's' : ''}` : null) || 
                     member?.ptDuration || 
                     member?.pt?.duration || 
                     'Assigned (No PT Package)'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase">Validity</span>
                  <span className="font-bold text-slate-700 text-[11px] font-mono">
                    {(member?.ptMembership?.startDate || member?.pt?.startDate || member?.ptStartDate) && (member?.ptMembership?.expiryDate || member?.pt?.expiryDate || member?.ptExpiryDate)
                      ? `${member?.ptMembership?.startDate || member?.pt?.startDate || member?.ptStartDate} → ${member?.ptMembership?.expiryDate || member?.pt?.expiryDate || member?.ptExpiryDate}`
                      : '—'}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-slate-200">
                  <span className="text-[10px] font-black text-slate-400 uppercase">PT Amount</span>
                  <span className="font-black font-mono text-[#0066FF]">
                    {member?.ptMembership?.amount !== undefined || member?.pt?.amount !== undefined || member?.ptAmount !== undefined
                      ? `₹${Number(member?.ptMembership?.amount ?? member?.pt?.amount ?? member?.ptAmount ?? 0).toLocaleString('en-IN')}`
                      : '₹0'}
                  </span>
                </div>
                {(member?.ptMembership?.invoiceNo || member?.pt?.invoiceNo || member?.pt?.billingId) && (
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Invoice No</span>
                    <span className="font-mono text-[10px] font-bold text-[#0066FF] bg-[#FFF7ED] px-1.5 py-0.5 rounded border border-[#FED7AA]">
                      {member?.ptMembership?.invoiceNo || member?.pt?.invoiceNo || member?.pt?.billingId}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="flex gap-2 w-full mt-4">
              <a
                href={member.trainerPhone ? `tel:${member.trainerPhone}` : '#'}
                className="flex-1 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 no-underline border border-emerald-200"
              >
                <Phone size={14} /> Call
              </a>
              <button
                type="button"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 border-none cursor-pointer"
              >
                <Repeat size={14} /> Change
              </button>
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* ── EDIT PERSONAL INFO MODAL ── */}
      {showEditPersonalInfoModal && (
        <EditPersonalInfoModal
          member={member}
          onClose={() => setShowEditPersonalInfoModal(false)}
          onSave={() => fetchMembers()}
        />
      )}

      {/* ── EDIT HEALTH & MEASUREMENTS MODAL ── */}
      {showEditHealthModal && (
        <EditHealthModal
          member={member}
          onClose={() => setShowEditHealthModal(false)}
          onSave={() => fetchMembers()}
        />
      )}

      {/* ── EDIT EXPIRY DATE MODAL ── */}
      <AnimatePresence>
        {showEditExpiryModal && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowEditExpiryModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md p-6 z-10 text-slate-900 space-y-5"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="text-amber-500" size={20} />
                  <h3 className="font-extrabold text-slate-900 text-lg">Edit Membership Expiry Date</h3>
                </div>
                <button
                  onClick={() => setShowEditExpiryModal(false)}
                  className="p-1 text-slate-400 hover:text-slate-700 bg-transparent border-none cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div>
                <p className="text-xs text-slate-500 font-medium mb-3">
                  Select a quick preset or pick a custom date to update <span className="font-bold text-slate-800">{member.name}'s</span> membership validity.
                </p>

                {/* Quick Presets */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setMonth(d.getMonth() + 1);
                      const str = d.toISOString().split('T')[0];
                      setCustomExpiryDate(str);
                      handleUpdateExpiry(str);
                    }}
                    className="p-2.5 bg-slate-50 hover:bg-amber-50 hover:border-amber-200 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all text-center cursor-pointer"
                  >
                    +1 Month
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setMonth(d.getMonth() + 3);
                      const str = d.toISOString().split('T')[0];
                      setCustomExpiryDate(str);
                      handleUpdateExpiry(str);
                    }}
                    className="p-2.5 bg-slate-50 hover:bg-amber-50 hover:border-amber-200 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all text-center cursor-pointer"
                  >
                    +3 Months
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setMonth(d.getMonth() + 6);
                      const str = d.toISOString().split('T')[0];
                      setCustomExpiryDate(str);
                      handleUpdateExpiry(str);
                    }}
                    className="p-2.5 bg-slate-50 hover:bg-amber-50 hover:border-amber-200 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all text-center cursor-pointer"
                  >
                    +6 Months
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date();
                      d.setFullYear(d.getFullYear() + 1);
                      const str = d.toISOString().split('T')[0];
                      setCustomExpiryDate(str);
                      handleUpdateExpiry(str);
                    }}
                    className="p-2.5 bg-slate-50 hover:bg-amber-50 hover:border-amber-200 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all text-center cursor-pointer"
                  >
                    +1 Year
                  </button>
                </div>

                <label className="block text-[10px] font-extrabold uppercase text-slate-400 tracking-wider mb-1">
                  Custom Expiry Date
                </label>
                <input
                  type="date"
                  value={customExpiryDate}
                  onChange={(e) => setCustomExpiryDate(e.target.value)}
                  className="w-full text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-slate-800 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditExpiryModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-extrabold border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={savingExpiry}
                  onClick={() => handleUpdateExpiry(customExpiryDate)}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black border-none cursor-pointer shadow-md disabled:opacity-50"
                >
                  {savingExpiry ? 'Updating...' : 'Save Expiry Date'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CREATE NEW BILL MODAL ── */}
      <CreateNewBillModal
        isOpen={showCreateBillModal}
        member={member}
        onClose={() => setShowCreateBillModal(false)}
        onSaved={() => fetchMembers()}
      />

    </div>
  );
}

// ─── HELPER COMPONENTS ───

function Field({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 transition-colors">
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">{label}</span>
        <span className="text-xs font-black text-slate-800 truncate block">{value || 'N/A'}</span>
      </div>
    </div>
  );
}

// ─── EDIT PERSONAL INFO MODAL COMPONENT ─────────────────────────────────────

function EditPersonalInfoModal({ member, onClose, onSave }: { member: any; onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState(member.name || '');
  const [phone, setPhone] = useState(member.phone || '');
  const [email, setEmail] = useState(member.email || '');
  const [dob, setDob] = useState(member.dob || '');
  const [gender, setGender] = useState<'Male'|'Female'|'Other'|'Not specified'>(
    (['Male','Female','Other','Not specified'].includes(member.gender)) ? member.gender : 'Male'
  );
  const [occupation, setOccupation] = useState(member.occupation || '');
  const [emergencyContact, setEmergencyContact] = useState(member.emergencyContact || '');
  const [address, setAddress] = useState(member.address || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');

  // Helpers — clear a single field error as user types
  const clearErr = (field: string) =>
    setErrors(prev => { if (!prev[field]) return prev; const next = { ...prev }; delete next[field]; return next; });

  const handleSave = async () => {
    setSubmitError('');
    const parseRes = personalInfoSchema.safeParse({
      name, phone, email: email || '', dob: dob || '', gender, occupation: occupation || '', emergencyContact: emergencyContact || '', address: address || '',
    });

    if (!parseRes.success) {
      const errMap: Record<string, string> = {};
      parseRes.error.issues.forEach(issue => {
        const key = issue.path[0] as string;
        if (key && !errMap[key]) errMap[key] = issue.message;
      });
      setErrors(errMap);
      return;
    }

    // Normalize phone to bare 10 digits for storage consistency
    const normalized = parseRes.data;
    const normalizedPhone = normalizeIndianPhone(phone) ?? phone.trim();

    setSaving(true);
    try {
      const updatePayload: Record<string, any> = {
        name: normalized.name,
        phone: normalizedPhone,
        email: normalized.email ?? '',
        dob: normalized.dob ?? '',
        gender: normalized.gender ?? 'Male',
        occupation: normalized.occupation ?? '',
        emergencyContact: (emergencyContact || '').trim(),
        address: normalized.address ?? '',
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'members', member.id), updatePayload);

      Object.assign(member, updatePayload);

      toast.success('Personal info updated successfully!');
      onSave();
      onClose();
    } catch (err: any) {
      console.error('[EditPersonalInfo] Firebase update error:', err);
      setSubmitError('Unable to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = (field: string) =>
    `w-full text-xs bg-slate-50 border rounded-xl px-3 py-2.5 focus:outline-none text-slate-800 font-medium transition-colors ${
      errors[field]
        ? 'border-red-400 bg-red-50/30 focus:border-red-500'
        : 'border-slate-200 focus:border-[#F97316]'
    }`;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => { if (!saving) onClose(); }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-personal-dialog-title"
        className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 z-10 text-slate-900 space-y-5"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <User className="text-[#EA580C]" size={20} />
            <h3 id="edit-personal-dialog-title" className="font-extrabold text-slate-900 text-lg">Edit Personal Info</h3>
          </div>
          <button
            onClick={() => { if (!saving) onClose(); }}
            className="p-1 text-slate-400 hover:text-slate-700 bg-transparent border-none cursor-pointer"
            aria-label="Close dialog"
          >✕</button>
        </div>

        {/* Form Fields */}
        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1 custom-scrollbar">
          {/* Row 1: Full Name + Phone */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ep-name" className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                id="ep-name"
                type="text"
                value={name}
                autoComplete="name"
                aria-describedby={errors.name ? 'ep-name-err' : undefined}
                aria-invalid={!!errors.name}
                onChange={e => { setName(e.target.value); clearErr('name'); }}
                className={inputCls('name')}
              />
              {errors.name && (
                <p id="ep-name-err" className="text-[11px] text-red-500 font-semibold mt-1.5 flex items-center gap-1">
                  <AlertCircle size={11} className="shrink-0" /> {errors.name}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="ep-phone" className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <input
                id="ep-phone"
                type="tel"
                value={phone}
                autoComplete="tel"
                aria-describedby={errors.phone ? 'ep-phone-err' : undefined}
                aria-invalid={!!errors.phone}
                onChange={e => { setPhone(e.target.value); clearErr('phone'); }}
                className={inputCls('phone')}
              />
              {errors.phone && (
                <p id="ep-phone-err" className="text-[11px] text-red-500 font-semibold mt-1.5 flex items-center gap-1">
                  <AlertCircle size={11} className="shrink-0" /> {errors.phone}
                </p>
              )}
            </div>
          </div>

          {/* Row 2: Email + DOB */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ep-email" className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Email Address</label>
              <input
                id="ep-email"
                type="email"
                value={email}
                autoComplete="email"
                aria-describedby={errors.email ? 'ep-email-err' : undefined}
                aria-invalid={!!errors.email}
                onChange={e => { setEmail(e.target.value); clearErr('email'); }}
                className={inputCls('email')}
              />
              {errors.email && (
                <p id="ep-email-err" className="text-[11px] text-red-500 font-semibold mt-1.5 flex items-center gap-1">
                  <AlertCircle size={11} className="shrink-0" /> {errors.email}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="ep-dob" className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Date of Birth</label>
              <input
                id="ep-dob"
                type="date"
                value={dob}
                max={new Date().toISOString().split('T')[0]}
                aria-describedby={errors.dob ? 'ep-dob-err' : undefined}
                aria-invalid={!!errors.dob}
                onChange={e => { setDob(e.target.value); clearErr('dob'); }}
                className={inputCls('dob')}
              />
              {errors.dob && (
                <p id="ep-dob-err" className="text-[11px] text-red-500 font-semibold mt-1.5 flex items-center gap-1">
                  <AlertCircle size={11} className="shrink-0" /> {errors.dob}
                </p>
              )}
            </div>
          </div>

          {/* Row 3: Gender + Occupation */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ep-gender" className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Gender</label>
              <select
                id="ep-gender"
                value={gender}
                onChange={e => setGender(e.target.value as any)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-[#F97316] text-slate-800 font-medium cursor-pointer transition-colors"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
                <option value="Not specified">Not specified</option>
              </select>
            </div>
            <div>
              <label htmlFor="ep-occupation" className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Occupation</label>
              <input
                id="ep-occupation"
                type="text"
                value={occupation}
                placeholder="e.g. Software Engineer"
                aria-describedby={errors.occupation ? 'ep-occupation-err' : undefined}
                aria-invalid={!!errors.occupation}
                onChange={e => { setOccupation(e.target.value); clearErr('occupation'); }}
                className={inputCls('occupation')}
              />
              {errors.occupation && (
                <p id="ep-occupation-err" className="text-[11px] text-red-500 font-semibold mt-1.5 flex items-center gap-1">
                  <AlertCircle size={11} className="shrink-0" /> {errors.occupation}
                </p>
              )}
            </div>
          </div>

          {/* Row 4: Emergency Contact + Address */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="ep-emergency" className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Emergency Contact</label>
              <input
                id="ep-emergency"
                type="text"
                value={emergencyContact}
                placeholder="e.g. Father: 9876543210"
                aria-describedby={errors.emergencyContact ? 'ep-emergency-err' : undefined}
                aria-invalid={!!errors.emergencyContact}
                onChange={e => { setEmergencyContact(e.target.value); clearErr('emergencyContact'); }}
                className={inputCls('emergencyContact')}
              />
              {errors.emergencyContact && (
                <p id="ep-emergency-err" className="text-[11px] text-red-500 font-semibold mt-1.5 flex items-center gap-1">
                  <AlertCircle size={11} className="shrink-0" /> {errors.emergencyContact}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="ep-address" className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Residential Address</label>
              <input
                id="ep-address"
                type="text"
                value={address}
                placeholder="e.g. Mohali, Punjab"
                aria-describedby={errors.address ? 'ep-address-err' : undefined}
                aria-invalid={!!errors.address}
                onChange={e => { setAddress(e.target.value); clearErr('address'); }}
                className={inputCls('address')}
              />
              {errors.address && (
                <p id="ep-address-err" className="text-[11px] text-red-500 font-semibold mt-1.5 flex items-center gap-1">
                  <AlertCircle size={11} className="shrink-0" /> {errors.address}
                </p>
              )}
            </div>
          </div>

          {/* Firebase submit error */}
          {submitError && (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-3.5 py-2.5 text-[11px] text-red-700 font-semibold">
              <AlertCircle size={13} className="shrink-0" /> {submitError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={() => { if (!saving) onClose(); }}
            disabled={saving}
            className="px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-black uppercase border-none cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white rounded-xl text-xs font-black uppercase border-none cursor-pointer shadow-md disabled:opacity-60 active:scale-95 transition-all flex items-center gap-1.5"
          >
            {saving ? (
              <><svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Saving...</>
            ) : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}


// ─── EDIT HEALTH & MEASUREMENTS MODAL COMPONENT ───

function EditHealthModal({ member, onClose, onSave }: { member: any; onClose: () => void; onSave: () => void }) {
  const [weight, setWeight] = useState<string>(member.weight ? String(member.weight) : '70');
  const [height, setHeight] = useState<string>(member.height ? String(member.height) : '175');
  const [bloodGroup, setBloodGroup] = useState<string>(member.bloodGroup || 'O+');
  const [medicalNotes, setMedicalNotes] = useState<string>(member.medicalNotes || '');
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const wNum = parseFloat(weight) || 0;
  const hNum = parseFloat(height) || 0;
  const calculatedBmi = (wNum > 0 && hNum > 0) ? (wNum / Math.pow(hNum / 100, 2)).toFixed(1) : '--';

  const handleSave = async () => {
    const parseRes = healthSchema.safeParse({
      weight: wNum,
      height: hNum,
      bloodGroup,
      medicalNotes,
    });

    if (!parseRes.success) {
      const errMap: Record<string, string> = {};
      parseRes.error.issues.forEach((issue) => {
        if (issue.path[0]) errMap[issue.path[0] as string] = issue.message;
      });
      setErrors(errMap);
      return;
    }

    setSaving(true);
    try {
      const updatePayload = {
        weight: wNum,
        height: hNum,
        bloodGroup,
        bmi: calculatedBmi,
        medicalNotes: medicalNotes.trim(),
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'members', member.id), updatePayload);

      Object.assign(member, updatePayload);

      toast.success('Health & Measurements updated successfully!');
      onSave();
      onClose();
    } catch (err: any) {
      toast.error('Failed to update health info: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg p-6 z-10 text-slate-900 space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Activity className="text-rose-500" size={20} />
            <h3 className="font-extrabold text-slate-900 text-lg">Edit Health & Measurements</h3>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 bg-transparent border-none cursor-pointer">✕</button>
        </div>

        <div className="space-y-4 text-xs font-semibold">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Weight (kg) *</label>
              <input
                type="number"
                step="0.1"
                value={weight}
                onChange={(e) => { setWeight(e.target.value); if (errors.weight) setErrors(p => ({ ...p, weight: '' })); }}
                className={`w-full text-xs bg-slate-50 border rounded-xl px-3 py-2.5 focus:outline-none text-slate-800 font-bold ${errors.weight ? 'border-red-500 bg-red-50/20' : 'border-slate-200 focus:border-rose-500'}`}
              />
              {errors.weight && <p className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1"><AlertCircle size={11} /> {errors.weight}</p>}
            </div>

            <div>
              <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Height (cm) *</label>
              <input
                type="number"
                step="0.1"
                value={height}
                onChange={(e) => { setHeight(e.target.value); if (errors.height) setErrors(p => ({ ...p, height: '' })); }}
                className={`w-full text-xs bg-slate-50 border rounded-xl px-3 py-2.5 focus:outline-none text-slate-800 font-bold ${errors.height ? 'border-red-500 bg-red-50/20' : 'border-slate-200 focus:border-rose-500'}`}
              />
              {errors.height && <p className="text-[10px] text-red-500 font-bold mt-1 flex items-center gap-1"><AlertCircle size={11} /> {errors.height}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Blood Group</label>
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none text-slate-800 font-semibold cursor-pointer"
              >
                {['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', '--'].map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Calculated BMI (kg/m²)</label>
              <div className="w-full text-xs bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-emerald-700 font-black flex items-center justify-between">
                <span>{calculatedBmi}</span>
                <span className="text-[9px] font-bold text-emerald-600 uppercase">Auto Calculated</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[9px] font-black uppercase text-slate-500 mb-1">Medical Notes & Conditions</label>
            <textarea
              rows={3}
              value={medicalNotes}
              onChange={(e) => setMedicalNotes(e.target.value)}
              placeholder="e.g. Lower back sensitivity, Asthma..."
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none text-slate-800 font-medium"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
          <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:text-slate-800 text-xs font-black uppercase border-none cursor-pointer">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase border-none cursor-pointer shadow-md disabled:opacity-50 active:scale-95 transition-all"
          >
            {saving ? 'Saving...' : 'Save Measurements'}
          </button>
        </div>
      </div>
    </div>
  );
}
