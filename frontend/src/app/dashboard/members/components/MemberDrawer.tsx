'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Phone, MessageSquare, MapPin, MoreHorizontal, Crown, CheckSquare, 
  Flame, Clock, Dumbbell, Shield, Fingerprint, RotateCcw, Trash2, 
  Wifi, Download, RefreshCw, Snowflake, Play, Pause, Edit, Activity, 
  ExternalLink, CreditCard, Calendar, User, CheckCircle2, AlertTriangle, 
  Sparkles, Mail, IndianRupee, ArrowRight
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { formatDate, getInitials } from '@/lib/utils';
import { membershipEngine } from '@/lib/engines/membershipEngine';
import { useGymStore } from '@/store';
import toast from '@/lib/toast';
import MemberAvatar from '../../components/MemberAvatar';

interface MemberDrawerProps {
  member: any;
  onClose: () => void;
  onCall?: (m: any) => void;
  onMessage?: (m: any) => void;
  onCheckIn?: (m: any) => void;
  onViewProfile?: (m: any) => void;
  onEdit?: (m: any) => void;
  onRenew?: (m: any) => void;
  onDelete?: (m: any) => void;
  onCreateBill?: (m: any) => void;
}

export default function MemberDrawer({
  member,
  onClose,
  onCall,
  onMessage,
  onCheckIn,
  onViewProfile,
  onEdit,
  onRenew,
  onDelete,
  onCreateBill
}: MemberDrawerProps) {
  const router = useRouter();
  const { toggleFreeze, deleteMember, fetchMembers } = useGymStore();
  const [mounted, setMounted] = useState(false);
  const [isFreezing, setIsFreezing] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !member) return null;

  const isHold = String(member.status || member.membershipStatus || '').toLowerCase() === 'hold' || member.activationStatus === 'PENDING_ACTIVATION';
  const daysLeft = isHold ? 0 : (member.expiryDate ? membershipEngine.calculateDaysLeft(member.expiryDate) : 0);
  const isExpired = !isHold && daysLeft <= 0;
  const isExpiring = !isHold && daysLeft > 0 && daysLeft <= 15;

  const rawPaid = Number(member.amountPaid !== undefined ? member.amountPaid : (member.paid ?? member.totalPaid ?? 0));
  const rawBalance = Number(member.balanceAmount !== undefined ? member.balanceAmount : (member.balance ?? member.outstandingBalance ?? 0));
  const rawBilled = Number(member.totalBilled !== undefined ? member.totalBilled : (member.amount ?? member.price ?? (rawPaid + rawBalance)));

  const handleFreezeToggle = async () => {
    setIsFreezing(true);
    try {
      await toggleFreeze(member.id);
      toast.success(`Member status updated for ${member.name}`);
      fetchMembers();
      onClose();
    } catch {
      toast.error('Failed to update freeze status');
    } finally {
      setIsFreezing(false);
    }
  };

  const handleWhatsApp = () => {
    const phone = String(member.phone || '').replace(/\D/g, '').slice(-10);
    if (!phone) {
      toast.error('No valid phone number for WhatsApp');
      return;
    }
    const msg = `Hi ${member.name}, message from The Warrior Gym.`;
    window.open(`https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  const handleCall = () => {
    const phone = String(member.phone || '').replace(/\D/g, '').slice(-10);
    if (!phone) {
      toast.error('No phone number available');
      return;
    }
    window.location.href = `tel:+91${phone}`;
  };

  return createPortal(
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/40 backdrop-blur-xs transition-opacity"
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 28, stiffness: 260 }}
          className="w-screen max-w-md bg-white shadow-2xl border-l border-stone-200 flex flex-col justify-between overflow-hidden"
        >
          {/* Header Profile Section */}
          <div className="p-6 bg-gradient-to-b from-orange-50/50 via-white to-white border-b border-stone-100 relative">
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-full bg-stone-100 hover:bg-stone-200 text-stone-500 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-4">
              <div className="relative">
                <MemberAvatar
                  member={member}
                  className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md"
                  size={64}
                />
                <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-white ${
                  isHold ? 'bg-amber-500' :
                  isExpired ? 'bg-rose-500' :
                  member.status === 'frozen' ? 'bg-sky-500' :
                  'bg-emerald-500'
                }`} />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black text-stone-900 tracking-tight leading-tight">
                    {member.name}
                  </h2>
                </div>

                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-mono font-bold text-stone-500">
                    #{member.clientId ? `TWG-${member.clientId}` : (member.memberId || 'TWG-MEMBER')}
                  </span>
                  <span className="text-[10px] font-mono font-bold bg-orange-100 text-[#EA580C] px-2 py-0.5 rounded-md">
                    BIO ID: {member.biometricId || member.deviceUserId || '—'}
                  </span>
                </div>

                {/* Status Pill */}
                <div className="mt-2">
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wide ${
                    isHold ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    isExpired ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    member.status === 'frozen' ? 'bg-sky-50 text-sky-700 border border-sky-200' :
                    'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      isHold ? 'bg-amber-500' :
                      isExpired ? 'bg-rose-500' :
                      member.status === 'frozen' ? 'bg-sky-500' :
                      'bg-emerald-500'
                    }`} />
                    {isHold ? 'HOLD — Pending Activation' :
                     isExpired ? 'EXPIRED' :
                     member.status === 'frozen' ? 'FROZEN' :
                     'ACTIVE MEMBER'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Contact Bar */}
            <div className="flex items-center gap-2 mt-5">
              <button
                type="button"
                onClick={handleCall}
                className="flex-1 py-2 px-3 bg-white border border-stone-200 hover:border-orange-300 text-stone-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
              >
                <Phone className="w-3.5 h-3.5 text-[#EA580C]" />
                <span>Call</span>
              </button>

              <button
                type="button"
                onClick={handleWhatsApp}
                className="flex-1 py-2 px-3 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors"
              >
                <MessageSquare className="w-3.5 h-3.5 text-emerald-600" />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/dashboard/members/${encodeURIComponent(member.id)}`);
                }}
                className="py-2 px-3 bg-gradient-to-r from-[#FF7A00] to-[#F04400] text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 hover:brightness-105 transition-all shadow-xs"
              >
                <span>Full Profile</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Scrollable Details Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 text-stone-800">
            {/* HOLD Member Alert & Primary Action */}
            {isHold && (
              <div className="p-4 bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 text-xs space-y-3">
                <div className="flex items-center gap-2 text-amber-900 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Account Pending Activation</span>
                </div>
                <p className="text-amber-800 font-medium">
                  This member was imported without an active bill. Create a bill to activate their membership and record real payment.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onCreateBill) onCreateBill(member);
                  }}
                  className="w-full py-2.5 bg-gradient-to-r from-[#FF7A00] to-[#F04400] text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20 hover:brightness-105 transition-all"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Create Bill & Activate Member</span>
                </button>
              </div>
            )}

            {/* Membership Details Card */}
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block">
                Membership Plan
              </span>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-bold text-stone-900">
                    {isHold ? 'NO PLAN (ON HOLD)' : (member.plan || 'Standard Membership')}
                  </h4>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {isHold ? 'Awaiting initial package enrollment' : `Assigned Trainer: ${member.trainer || 'General Access'}`}
                  </p>
                </div>
                {!isHold && (
                  <div className="text-right">
                    <span className={`text-xs font-black px-2 py-0.5 rounded-full ${
                      isExpired ? 'bg-rose-100 text-rose-800' :
                      isExpiring ? 'bg-amber-100 text-amber-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {daysLeft > 0 ? `${daysLeft}d left` : 'Expired'}
                    </span>
                  </div>
                )}
              </div>

              {!isHold && (
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-200 text-xs">
                  <div>
                    <span className="text-stone-400 block text-[10px]">Start Date</span>
                    <span className="font-semibold text-stone-700">{formatDate(member.startDate || member.joinDate)}</span>
                  </div>
                  <div>
                    <span className="text-stone-400 block text-[10px]">Expiry Date</span>
                    <span className="font-semibold text-stone-700">{formatDate(member.expiryDate)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Financial Status Card */}
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500">
                  Billing & Balance
                </span>
                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                  isHold ? 'bg-stone-200 text-stone-700' :
                  rawBalance <= 0 && rawPaid > 0 ? 'bg-emerald-100 text-emerald-800' :
                  rawBalance > 0 && rawPaid > 0 ? 'bg-amber-100 text-amber-800' :
                  'bg-rose-100 text-rose-800'
                }`}>
                  {isHold ? 'NO BILL' : (rawBalance <= 0 && rawPaid > 0 ? 'PAID IN FULL' : 'BALANCE DUE')}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="p-2 bg-white rounded-xl border border-stone-200">
                  <span className="text-[10px] text-stone-400 block">Total Billed</span>
                  <span className="text-xs font-black text-stone-900">
                    {isHold ? '—' : `₹${rawBilled.toLocaleString('en-IN')}`}
                  </span>
                </div>

                <div className="p-2 bg-white rounded-xl border border-stone-200">
                  <span className="text-[10px] text-stone-400 block">Amount Paid</span>
                  <span className="text-xs font-black text-emerald-700">
                    {isHold ? '—' : `₹${rawPaid.toLocaleString('en-IN')}`}
                  </span>
                </div>

                <div className="p-2 bg-white rounded-xl border border-stone-200">
                  <span className="text-[10px] text-stone-400 block">Remaining Due</span>
                  <span className={`text-xs font-black ${rawBalance > 0 ? 'text-amber-700' : 'text-stone-900'}`}>
                    {isHold ? '—' : `₹${rawBalance.toLocaleString('en-IN')}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Contact & Personal Metadata */}
            <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 space-y-2.5 text-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-stone-500 block mb-1">
                Contact & Details
              </span>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Phone:</span>
                <span className="font-mono font-bold text-stone-800">{member.phone || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Email:</span>
                <span className="font-medium text-stone-800 truncate max-w-[200px]">{member.email || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-stone-500">Gender:</span>
                <span className="font-semibold text-stone-800">{member.gender || '—'}</span>
              </div>
              {member.emergencyContact && (
                <div className="flex items-center justify-between">
                  <span className="text-stone-500">Emergency:</span>
                  <span className="font-mono font-bold text-stone-800">{member.emergencyContact}</span>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Actions Bar */}
          <div className="p-4 bg-stone-50 border-t border-stone-200 grid grid-cols-2 gap-2">
            {!isHold ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    if (onRenew) onRenew(member);
                  }}
                  className="py-2.5 px-3 bg-white border border-stone-200 hover:border-orange-300 text-stone-800 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#EA580C]" />
                  <span>Renew</span>
                </button>

                <button
                  type="button"
                  disabled={isFreezing}
                  onClick={handleFreezeToggle}
                  className="py-2.5 px-3 bg-white border border-stone-200 hover:border-stone-300 text-stone-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 shadow-xs"
                >
                  <Snowflake className="w-3.5 h-3.5 text-sky-500" />
                  <span>{member.status === 'frozen' ? 'Unfreeze' : 'Freeze'}</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  if (onCreateBill) onCreateBill(member);
                }}
                className="col-span-2 py-2.5 bg-gradient-to-r from-[#FF7A00] to-[#F04400] text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 shadow-md shadow-orange-500/20"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Create Bill & Issue Invoice</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </div>,
    document.body
  );
}
