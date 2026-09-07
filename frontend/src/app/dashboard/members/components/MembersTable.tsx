'use client';

import React, { useState, useMemo, useEffect, useCallback, memo, useRef } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, Filter, MoreHorizontal, Phone, MessageSquare, MapPin, Edit,
  RefreshCw, Snowflake, Trash2, Eye, Fingerprint, ChevronLeft, ChevronRight,
  X, AlertCircle, CheckCircle2, User, Sliders, Calendar, RotateCcw, Receipt
} from 'lucide-react';
import { membershipEngine } from '@/lib/engines/membershipEngine';
import { paymentEngine } from '@/lib/engines/paymentEngine';
import { calculateRealAttendance, formatDaysLeft, calculateAge, formatDate } from '@/lib/utils';
import { useGymStore } from '@/store';
import toast from '@/lib/toast';
import { useRouter } from 'next/navigation';
import MemberAvatar from '../../components/MemberAvatar';

export interface FilterState {
  gender: string;
  memberType: string;
  packagePlan: string;
  trainer: string;
  branch: string;
  membershipStatus: string;
  paymentStatus: string;
  joinedFrom: string;
  joinedTo: string;
  expiryStatus: string;
}

const getDynamicStatus = (m: any) => {
  const st = String(m.status || m.membershipStatus || '').trim().toLowerCase();
  if (st === 'hold' || m.activationStatus === 'PENDING_ACTIVATION') return 'hold';
  if (st === 'inactive') return 'inactive';
  if (st === 'blocked' || st === 'blacklisted') return 'blocked';
  if (st === 'frozen') return 'frozen';
  if (!m.expiryDate) return 'hold';
  const days = membershipEngine.calculateDaysLeft(m.expiryDate);
  if (days <= 0) return 'expired';
  if (days <= 7) return 'urgent';
  if (days <= 30) return 'expiring_soon';
  return 'active';
};

const initialFilterState: FilterState = {
  gender: 'all',
  memberType: 'all',
  packagePlan: 'all',
  trainer: 'all',
  branch: 'all',
  membershipStatus: 'all',
  paymentStatus: 'all',
  joinedFrom: '',
  joinedTo: '',
  expiryStatus: 'all',
};

interface MembersTableProps {
  members: any[];
  search: string;
  setSearch: (val: string) => void;
  statusFilter: string;
  setStatusFilter: (val: string) => void;
  onSelectMember: (m: any) => void;
  selectedMemberId: string | null;
  onEdit?: (m: any) => void;
  onRenew?: (m: any) => void;
  onFreeze?: (m: any) => void;
  onDelete?: (m: any) => void;
  onMapBiometric?: (m: any) => void;
  onCreateBill?: (m: any) => void;
}

// Memoized individual row component for smooth 60fps rendering
const MemberTableRow = memo(function MemberTableRow({
  member,
  isSelected,
  onRowClick,
  onOpenActions,
  onCreateBill,
}: {
  member: any;
  isSelected: boolean;
  onRowClick: () => void;
  onOpenActions: (m: any, rect: DOMRect) => void;
  onCreateBill?: (m: any) => void;
}) {
  const isHold = String(member.status || member.membershipStatus || '').toLowerCase() === 'hold' || member.activationStatus === 'PENDING_ACTIVATION';

  const attScore = isHold ? 0 : calculateRealAttendance(member.joinDate, member.attendanceCount || 0);
  const hasPunched = !isHold && (member.attendanceCount && member.attendanceCount > 0);
  
  const attColor = isHold || !hasPunched 
    ? '#cbd5e1'
    : attScore > 75 
      ? '#10b981'
      : attScore > 40 
        ? '#f59e0b'
        : '#ef4444';

  const rawAmountPaid = Number(member.amountPaid !== undefined ? member.amountPaid : (member.paid ?? member.totalPaid ?? 0));
  const rawBalance = Number(member.balanceAmount !== undefined ? member.balanceAmount : (member.balance ?? member.outstandingBalance ?? member.pendingBalance ?? 0));
  const rawTotalBilled = Number(member.totalBilled !== undefined ? member.totalBilled : (member.amount ?? member.price ?? (rawAmountPaid + rawBalance)));

  let amountPaidVal = rawAmountPaid;
  let balanceVal = rawBalance;
  let payStatus: 'NOT BILLED' | 'UNPAID' | 'PARTIAL' | 'PAID';

  if (isHold || (!rawTotalBilled && rawAmountPaid === 0 && rawBalance === 0)) {
    payStatus = 'NOT BILLED';
    amountPaidVal = 0;
    balanceVal = 0;
  } else if (rawAmountPaid === 0 && (rawTotalBilled > 0 || rawBalance > 0)) {
    payStatus = 'UNPAID';
  } else if (rawBalance > 0 && rawAmountPaid > 0) {
    payStatus = 'PARTIAL';
  } else if (rawAmountPaid > 0 && rawBalance <= 0) {
    payStatus = 'PAID';
  } else {
    payStatus = 'NOT BILLED';
    amountPaidVal = 0;
    balanceVal = 0;
  }

  const payBadgeStyle = payStatus === 'PAID'
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : payStatus === 'PARTIAL'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : payStatus === 'UNPAID'
        ? 'bg-rose-50 text-rose-700 border-rose-200'
        : 'bg-slate-100 text-slate-600 border-slate-200';

  const displayClientId = member.clientId ? `TWG-${member.clientId}` : (member.memberId || member.id);

  // Gender resolution (Strict - No guessing or random assigning)
  const rawGender = String(member.gender || member.sex || '').trim().toLowerCase();
  const isMale = rawGender === 'male' || rawGender === 'm';
  const isFemale = rawGender === 'female' || rawGender === 'f';
  const isOther = rawGender === 'other';

  const phoneDisplay = member.phone || member.mobile || member.phoneNumber || null;

  return (
    <tr 
      onClick={onRowClick}
      className={`hover:bg-slate-50/80 transition-colors cursor-pointer border-b border-slate-100 ${
        isSelected ? 'bg-indigo-50/40' : ''
      }`}
    >
      {/* 1. Member Profile */}
      <td className="px-4 py-3.5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <MemberAvatar member={member} className="w-10 h-10 rounded-full border border-slate-200 shadow-2xs object-cover" size={40} />
            {member.biometricId && (
              <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[8px] font-black shadow-xs" title={`Biometric ID Linked: #${member.biometricId}`}>
                ✓
              </span>
            )}
          </div>
          <div>
            <div className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
              <span>{member.name}</span>
              {member.isPt && (
                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 text-[9px] font-black rounded uppercase border border-amber-300">
                  PT
                </span>
              )}
            </div>
            <div className="text-xs text-slate-400 font-mono mt-0.5 flex items-center gap-1.5">
              <span className="font-bold text-slate-700">#{displayClientId}</span>
              {member.biometricId && (
                <span className="px-1 py-0.2 bg-orange-50 text-[#C2410C] font-mono text-[9px] font-black rounded border border-orange-200">
                  BIO: {member.biometricId}
                </span>
              )}
            </div>
          </div>
        </div>
      </td>

      {/* 2. Dedicated Phone Number */}
      <td className="px-4 py-3.5 font-mono text-xs border-b border-slate-100">
        {phoneDisplay ? (
          <div className="flex items-center gap-1.5 font-bold text-slate-800">
            <Phone size={12} className="text-slate-400 shrink-0" />
            <span>{phoneDisplay}</span>
          </div>
        ) : (
          <span className="text-slate-400 font-mono font-bold text-xs">—</span>
        )}
      </td>

      {/* 3. Dedicated Gender */}
      <td className="px-4 py-3.5 text-center border-b border-slate-100">
        {isMale ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#FFF7ED] text-[#C2410C] border border-orange-200/60">
            <span>♂</span> Male
          </span>
        ) : isFemale ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-pink-50 text-pink-700 border border-pink-200/70">
            <span>♀</span> Female
          </span>
        ) : isOther ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200/70">
            Other
          </span>
        ) : (
          <span className="text-slate-400 font-mono font-bold text-xs">—</span>
        )}
      </td>

      {/* 4. Membership Plan & Dates */}
      <td className="px-4 py-3.5 border-b border-slate-100">
        {isHold ? (
          <div>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
              HOLD (NO PLAN)
            </span>
            <div className="text-[10px] text-slate-400 font-semibold mt-0.5">Pending Activation</div>
          </div>
        ) : (
          <>
            <div className="font-bold text-slate-800 text-xs">{member.packageName || member.plan || 'Standard'}</div>
            <div className="text-[11px] text-slate-500 font-mono mt-0.5 flex flex-col gap-0.5">
              {member.startDate && <span>Start: {formatDate(member.startDate)}</span>}
              <span>Exp: {formatDate(member.expiryDate)}</span>
            </div>
          </>
        )}
      </td>

      {/* 5. Assigned Trainer */}
      <td className="px-4 py-3.5 text-xs font-bold text-slate-700 border-b border-slate-100">
        {member.trainer && member.trainer !== 'Unassigned' ? (
          <span className="inline-flex items-center gap-1 text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
            <User size={12} className="text-indigo-600" />
            <span>{member.trainer}</span>
          </span>
        ) : (
          <span className="text-slate-400 italic">Unassigned</span>
        )}
      </td>

      {/* 6. Attendance Circular Progress */}
      <td className="px-4 py-3.5 text-center border-b border-slate-100">
        <div className="inline-flex items-center justify-center relative">
          <svg className="w-9 h-9">
            <circle cx="18" cy="18" r="14" stroke="#f1f5f9" strokeWidth="3" fill="none" />
            <circle 
              cx="18" cy="18" r="14" 
              stroke={attColor} 
              strokeWidth="3" 
              fill="none" 
              strokeDasharray="88" 
              strokeDashoffset={88 - (88 * Math.min(100, attScore)) / 100}
              strokeLinecap="round"
              className="transition-all duration-500 -rotate-90 origin-center"
            />
          </svg>
          <span className="absolute text-[10px] font-black font-mono text-slate-700">
            {attScore}%
          </span>
        </div>
      </td>

      {/* 7. Days Left */}
      <td className="px-4 py-3.5 text-center font-mono text-xs font-bold border-b border-slate-100">
        {isHold ? (
          <span className="text-amber-600 font-black">HOLD</span>
        ) : member.daysLeft < 0 ? (
          <span className="text-rose-500 font-black">Expired {Math.abs(member.daysLeft)}d ago</span>
        ) : member.daysLeft === 0 ? (
          <span className="text-orange-500 font-black">Expires Today</span>
        ) : (
          <span className="text-slate-700">{member.daysLeft} Days</span>
        )}
      </td>

      {/* 8. Payment / Balance */}
      <td className="px-4 py-3.5 border-b border-slate-100">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-black uppercase tracking-wider border ${payBadgeStyle}`}>
              {payStatus}
            </span>
            <span className="text-xs font-bold text-slate-900 font-mono">
              ₹{amountPaidVal.toLocaleString('en-IN')}
            </span>
          </div>
          {balanceVal > 0 && (
            <div className="text-[10px] font-bold text-rose-600 font-mono">
              Due: ₹{balanceVal.toLocaleString('en-IN')}
            </div>
          )}
        </div>
      </td>

      {/* 9. Actions */}
      <td className="px-4 py-3.5 text-right border-b border-slate-100" onClick={e => e.stopPropagation()}>
        <div className="inline-flex items-center gap-1.5 justify-end">
          {isHold && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onCreateBill) onCreateBill(member);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white text-xs font-black transition-all border-none cursor-pointer shadow-xs active:scale-95"
              title="Create Bill & Activate Member"
            >
              <span>Create Bill</span>
            </button>
          )}
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const rect = e.currentTarget.getBoundingClientRect();
              onOpenActions(member, rect);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-[#FFF7ED] hover:text-[#EA580C] hover:border-[#FED7AA] text-slate-700 text-xs font-black uppercase tracking-wider transition-all border border-slate-200 cursor-pointer shadow-2xs active:scale-95"
            title="Member Actions"
          >
            <MoreHorizontal size={14} />
            <span>Actions</span>
          </button>
        </div>
      </td>
    </tr>
  );
});

export default function MembersTable({ 
  members, search, setSearch, statusFilter, setStatusFilter, onSelectMember, selectedMemberId,
  onEdit, onRenew, onFreeze, onDelete, onMapBiometric, onCreateBill
}: MembersTableProps) {
  const router = useRouter();

  // Local search state with 250ms debounce
  const [localSearch, setLocalSearch] = useState(search);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Floating Actions Dropdown Menu state
  const [actionsMenu, setActionsMenu] = useState<{
    member: any;
    rect: DOMRect;
  } | null>(null);

  // Close floating actions menu on outside click or scroll
  useEffect(() => {
    if (!actionsMenu) return;
    const handleClose = (e: MouseEvent | Event) => {
      const target = e.target as HTMLElement;
      if (target?.closest('.actions-portal-menu')) return;
      setActionsMenu(null);
    };
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    window.addEventListener('mousedown', handleClose);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('mousedown', handleClose);
    };
  }, [actionsMenu]);

  // Advanced 9-Field Filter State
  const [filters, setFilters] = useState<FilterState>(initialFilterState);
  const [showMoreFilters, setShowMoreFilters] = useState(false);
  const filterPopoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (localSearch !== search) {
        setSearch(localSearch);
        setPage(1);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [localSearch, search, setSearch]);

  // Reset page when filter or tab changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter, filters]);

  // Close popover when clicking outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (filterPopoverRef.current && !filterPopoverRef.current.contains(e.target as Node)) {
        setShowMoreFilters(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Dynamic Options Extracted from Real Members Data
  const availableBranches = useMemo(() => {
    const set = new Set<string>();
    members.forEach(m => { if (m.branch) set.add(m.branch); });
    const list = Array.from(set);
    return list.length > 0 ? list : ['Mohali, Punjab', 'Chandigarh', 'Panchkula'];
  }, [members]);

  const availableTrainers = useMemo(() => {
    const set = new Set<string>();
    members.forEach(m => {
      const tr = m.trainer || m.trainerName;
      if (tr && tr !== 'Unassigned') set.add(tr);
    });
    return Array.from(set);
  }, [members]);

  const availablePackages = useMemo(() => {
    const set = new Set<string>();
    members.forEach(m => { if (m.plan) set.add(m.plan); });
    return Array.from(set);
  }, [members]);

  // Real tab counts calculated from actual member data
  const counts = useMemo(() => {
    let all = members.length;
    let active = 0;
    let hold = 0;
    let expired = 0;
    let inactive = 0;
    let frozen = 0;
    let pt = 0;

    members.forEach(m => {
      const ds = getDynamicStatus(m);
      if (ds === 'hold') hold++;
      else if (ds === 'inactive') inactive++;
      else if (ds === 'active' || ds === 'expiring_soon' || ds === 'urgent') active++;
      else if (ds === 'expired') expired++;
      else if (ds === 'frozen') frozen++;

      const isPtMember = m.isPt === true || (m.ptHistory && m.ptHistory.length > 0) || (m.plan && String(m.plan).toLowerCase().includes('pt')) || (m.trainer && m.trainer !== 'Unassigned');
      if (isPtMember) pt++;
    });

    return { all, active, hold, expired, inactive, frozen, pt };
  }, [members]);

  // Combined Search & 9-Field Filtering Logic
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const digitsOnly = q.replace(/\D/g, '');

    return members.filter(m => {
      // 1. Text Search Filter
      if (q) {
        const nameMatch = (m.name || m.fullName || '').toLowerCase().includes(q);
        const idMatch = (
          (m.memberId || '').toLowerCase().includes(q) ||
          (m.id || '').toLowerCase().includes(q) ||
          (m.customId || '').toLowerCase().includes(q) ||
          (m.clientId || '').toLowerCase().includes(q) ||
          (m.biometricId || '').toLowerCase().includes(q) ||
          (m.biometricUserId || '').toLowerCase().includes(q) ||
          (m.deviceUserId || '').toLowerCase().includes(q)
        );
        const addressStr = `${m.address || ''} ${m.city || ''} ${m.locality || ''} ${m.location || ''} ${m.branch || ''}`.toLowerCase();
        const addressMatch = addressStr.includes(q);

        const computedAge = m.age ?? calculateAge(m.dob || m.dateOfBirth);
        let ageMatch = false;
        if (computedAge !== null && computedAge !== undefined) {
          const ageStr = String(computedAge);
          if (q === ageStr || q.startsWith(`age ${ageStr}`) || q.includes(`${ageStr} yr`) || q.includes(`${ageStr} year`)) {
            ageMatch = true;
          } else if (digitsOnly.length > 0 && digitsOnly.length <= 3 && digitsOnly === ageStr) {
            ageMatch = true;
          }
        }

        let phoneMatch = false;
        if (digitsOnly.length >= 2) {
          const rawPhone = (m.phone || m.mobile || m.whatsapp || '').replace(/\D/g, '');
          phoneMatch = rawPhone.includes(digitsOnly);
        }
        const emailMatch = (m.email || '').toLowerCase().includes(q);

        const ms = nameMatch || idMatch || addressMatch || ageMatch || phoneMatch || emailMatch;
        if (!ms) return false;
      }

      // 2. Status Tab Filter (from top tabs)
      const dynStatus = getDynamicStatus(m);
      if (statusFilter === 'hold' && dynStatus !== 'hold') return false;
      if (statusFilter === 'inactive' && dynStatus !== 'inactive') return false;
      if (statusFilter === 'active' && !(dynStatus === 'active' || dynStatus === 'expiring_soon' || dynStatus === 'urgent')) return false;
      if (statusFilter === 'expired' && dynStatus !== 'expired') return false;
      if (statusFilter === 'frozen' && m.status !== 'frozen') return false;
      if (statusFilter === 'pt') {
        const isPtMember = m.isPt === true || (m.ptHistory && m.ptHistory.length > 0) || (m.plan && String(m.plan).toLowerCase().includes('pt')) || (m.trainer && m.trainer !== 'Unassigned');
        if (!isPtMember) return false;
      }

      // 3. Detailed Filters System

      // A. Gender Filter
      if (filters.gender !== 'all') {
        if (filters.gender === 'Not Specified') {
          if (m.gender && m.gender !== 'Not Specified') return false;
        } else {
          if (!m.gender || m.gender.toLowerCase() !== filters.gender.toLowerCase()) return false;
        }
      }

      // B. Member Type Filter
      const hasPt = m.isPt === true || (m.ptHistory && m.ptHistory.length > 0) || (m.plan && String(m.plan).toLowerCase().includes('pt'));
      const hasGym = !hasPt || (m.plan && !String(m.plan).toLowerCase().includes('pt'));
      if (filters.memberType === 'gym' && (hasPt && !hasGym)) return false;
      if (filters.memberType === 'pt' && !hasPt) return false;
      if (filters.memberType === 'gym_pt' && (!hasPt || !hasGym)) return false;

      // C. Package Plan Filter
      if (filters.packagePlan !== 'all') {
        if ((m.plan || '').toLowerCase() !== filters.packagePlan.toLowerCase()) return false;
      }

      // D. Trainer Filter
      if (filters.trainer !== 'all') {
        if (filters.trainer === 'unassigned') {
          if (m.trainer && m.trainer !== 'Unassigned' && m.trainerId) return false;
        } else {
          const trName = (m.trainer || m.trainerName || '').toLowerCase();
          const trId = (m.trainerId || '').toLowerCase();
          const target = filters.trainer.toLowerCase();
          if (trName !== target && trId !== target) return false;
        }
      }

      // E. Branch Filter
      if (filters.branch !== 'all') {
        if ((m.branch || 'Mohali, Punjab').toLowerCase() !== filters.branch.toLowerCase()) return false;
      }

      // F. Membership Status Filter
      if (filters.membershipStatus !== 'all') {
        const days = m.daysLeft !== undefined ? m.daysLeft : membershipEngine.calculateDaysLeft(m.expiryDate);
        if (filters.membershipStatus === 'active' && (days < 0 || m.status === 'frozen')) return false;
        if (filters.membershipStatus === 'expired' && days >= 0) return false;
        if (filters.membershipStatus === 'frozen' && m.status !== 'frozen') return false;
        if (filters.membershipStatus === 'expiring_soon' && (days < 0 || days > 7)) return false;
      }

      // G. Payment Status Filter
      if (filters.paymentStatus !== 'all') {
        const balance = Number(m.balanceAmount !== undefined ? m.balanceAmount : (m.balance ?? m.outstandingBalance ?? 0));
        const paid = Number(m.amountPaid !== undefined ? m.amountPaid : (m.paid ?? m.totalPaid ?? 0));
        const isPaid = (balance === 0 && (paid > 0 || m.paymentStatus === 'paid')) || m.paymentStatus === 'paid';
        const isDue = balance > 0 || m.paymentStatus === 'partial' || m.paymentStatus === 'pending';

        if (filters.paymentStatus === 'paid' && !isPaid) return false;
        if ((filters.paymentStatus === 'due' || filters.paymentStatus === 'partial') && !isDue) return false;
        if (filters.paymentStatus === 'pending' && paid > 0) return false;
      }

      // H. Date Joined Range Filter
      const mJoin = m.joinDate || m.createdAt;
      if (mJoin) {
        const joinStr = typeof mJoin === 'string' ? (mJoin.includes('T') ? mJoin.split('T')[0] : mJoin) : '';
        if (filters.joinedFrom && joinStr && joinStr < filters.joinedFrom) return false;
        if (filters.joinedTo && joinStr && joinStr > filters.joinedTo) return false;
      }

      // I. Expiry Status Filter
      if (filters.expiryStatus !== 'all') {
        const days = m.daysLeft !== undefined ? m.daysLeft : membershipEngine.calculateDaysLeft(m.expiryDate);
        if (filters.expiryStatus === 'expired' && days >= 0) return false;
        if (filters.expiryStatus === 'today' && days !== 0) return false;
        if (filters.expiryStatus === 'in_7_days' && (days < 0 || days > 7)) return false;
        if (filters.expiryStatus === 'in_30_days' && (days < 0 || days > 30)) return false;
        if (filters.expiryStatus === 'in_60_days' && (days < 0 || days > 60)) return false;
        if (filters.expiryStatus === 'active_over_60' && days <= 60) return false;
      }

      return true;
    });
  }, [members, search, statusFilter, filters]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.gender !== 'all') count++;
    if (filters.membershipStatus !== 'all') count++;
    if (filters.paymentStatus !== 'all') count++;
    if (filters.joinedFrom || filters.joinedTo) count++;
    if (filters.expiryStatus !== 'all') count++;
    return count;
  }, [filters]);

  const dateRangeError = useMemo(() => {
    if (filters.joinedFrom && filters.joinedTo && filters.joinedTo < filters.joinedFrom) {
      return 'Joined To date cannot be before Joined From date';
    }
    return '';
  }, [filters.joinedFrom, filters.joinedTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  return (
    <div className="bg-white rounded-2xl shadow-[0_2px_10px_rgba(0,0,0,0.04)] border border-slate-100 overflow-hidden relative">
      
      {/* Top Filter Bar */}
      <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-4">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            value={localSearch} 
            onChange={e => setLocalSearch(e.target.value)}
            placeholder="Search by name, phone or member ID..." 
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:border-indigo-500 transition-colors" 
          />
        </div>

        <div className="flex items-center gap-2 relative" ref={filterPopoverRef}>
          {/* More Filters Toggle Button */}
          <button
            type="button"
            onClick={() => setShowMoreFilters(!showMoreFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeFilterCount > 0 || showMoreFilters
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-sm'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Filter size={14} className={activeFilterCount > 0 ? 'text-indigo-600' : 'text-slate-500'} />
            <span>More Filters</span>
            {activeFilterCount > 0 && (
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] font-black flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>

          {/* ── MORE FILTERS POPOVER / MODAL ────────────────────────────────────── */}
          {showMoreFilters && (
            <div className="absolute right-0 top-12 w-full sm:w-[460px] bg-white rounded-3xl shadow-2xl border border-slate-200 p-5 z-[999] space-y-4 text-left select-none animate-in fade-in">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sliders size={16} className="text-indigo-600" />
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">FILTER MEMBERS</h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMoreFilters(false)}
                  className="p-1 rounded-full text-slate-400 hover:bg-slate-100 border-none bg-transparent cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Filter Fields Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-bold text-slate-700">
                {/* 1. Gender */}
                <div>
                  <label className="block mb-1 text-[10px] uppercase font-black text-slate-400 tracking-wider">Gender</label>
                  <select
                    value={filters.gender}
                    onChange={e => setFilters(f => ({ ...f, gender: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="all">All Genders</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                    <option value="Not Specified">Not Specified</option>
                  </select>
                </div>

                {/* 2. Membership Status */}
                <div>
                  <label className="block mb-1 text-[10px] uppercase font-black text-slate-400 tracking-wider">Membership Status</label>
                  <select
                    value={filters.membershipStatus}
                    onChange={e => setFilters(f => ({ ...f, membershipStatus: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="all">All Statuses</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                    <option value="frozen">Frozen</option>
                    <option value="expiring_soon">Expiring Soon (≤ 7 days)</option>
                  </select>
                </div>

                {/* 3. Payment Status */}
                <div>
                  <label className="block mb-1 text-[10px] uppercase font-black text-slate-400 tracking-wider">Payment Status</label>
                  <select
                    value={filters.paymentStatus}
                    onChange={e => setFilters(f => ({ ...f, paymentStatus: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="all">All Payment Statuses</option>
                    <option value="paid">Fully Paid (₹0 Balance)</option>
                    <option value="due">Balance Due (&gt; ₹0 Balance)</option>
                    <option value="pending">Pending Payment</option>
                  </select>
                </div>

                {/* 4. Expiry Filter */}
                <div>
                  <label className="block mb-1 text-[10px] uppercase font-black text-slate-400 tracking-wider">Expiry Horizon</label>
                  <select
                    value={filters.expiryStatus}
                    onChange={e => setFilters(f => ({ ...f, expiryStatus: e.target.value }))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="all">All Expiries</option>
                    <option value="expired">Expired</option>
                    <option value="today">Expires Today</option>
                    <option value="in_7_days">Expires in 7 Days</option>
                    <option value="in_30_days">Expires in 30 Days</option>
                    <option value="in_60_days">Expires in 60 Days</option>
                    <option value="active_over_60">Active &gt; 60 Days</option>
                  </select>
                </div>

                {/* 5. Date Joined Range */}
                <div className="col-span-1 sm:col-span-2 bg-slate-50 p-3 rounded-2xl border border-slate-200/80 space-y-2">
                  <label className="block text-[10px] uppercase font-black text-slate-500 tracking-wider">
                    Date Joined Range
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block mb-0.5">Joined From</span>
                      <input
                        type="date"
                        value={filters.joinedFrom}
                        onChange={e => setFilters(f => ({ ...f, joinedFrom: e.target.value }))}
                        className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-xl text-xs font-bold text-slate-800"
                      />
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-400 font-bold block mb-0.5">Joined To</span>
                      <input
                        type="date"
                        value={filters.joinedTo}
                        onChange={e => setFilters(f => ({ ...f, joinedTo: e.target.value }))}
                        className={`w-full px-2.5 py-1.5 bg-white border rounded-xl text-xs font-bold text-slate-800 ${
                          dateRangeError ? 'border-red-500 bg-red-50/30' : 'border-slate-300'
                        }`}
                      />
                    </div>
                  </div>
                  {dateRangeError && (
                    <p className="text-[11px] font-bold text-red-500 flex items-center gap-1 mt-1">
                      <AlertCircle size={12} /> {dateRangeError}
                    </p>
                  )}
                </div>
              </div>

              {/* Popover Action Buttons */}
              <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setFilters(initialFilterState)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-black rounded-xl transition-all border-none cursor-pointer flex items-center gap-1.5"
                >
                  <RotateCcw size={13} /> Clear All
                </button>
                <button
                  type="button"
                  onClick={() => setShowMoreFilters(false)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl transition-all border-none cursor-pointer shadow-md"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ACTIVE FILTER CHIPS BAR */}
      {activeFilterCount > 0 && (
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">Active Filters:</span>

          {filters.gender !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-800 shadow-2xs">
              Gender: {filters.gender}
              <button type="button" onClick={() => setFilters(f => ({ ...f, gender: 'all' }))} className="hover:text-red-500 border-none bg-transparent cursor-pointer">
                <X size={12} />
              </button>
            </span>
          )}

          {filters.memberType !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-800 shadow-2xs">
              Type: {filters.memberType === 'gym' ? 'Gym Members' : filters.memberType === 'pt' ? 'PT Members' : 'Gym + PT'}
              <button type="button" onClick={() => setFilters(f => ({ ...f, memberType: 'all' }))} className="hover:text-red-500 border-none bg-transparent cursor-pointer">
                <X size={12} />
              </button>
            </span>
          )}

          {filters.packagePlan !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-800 shadow-2xs">
              Package: {filters.packagePlan}
              <button type="button" onClick={() => setFilters(f => ({ ...f, packagePlan: 'all' }))} className="hover:text-red-500 border-none bg-transparent cursor-pointer">
                <X size={12} />
              </button>
            </span>
          )}

          {filters.trainer !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-800 shadow-2xs">
              Trainer: {filters.trainer}
              <button type="button" onClick={() => setFilters(f => ({ ...f, trainer: 'all' }))} className="hover:text-red-500 border-none bg-transparent cursor-pointer">
                <X size={12} />
              </button>
            </span>
          )}

          {filters.branch !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-800 shadow-2xs">
              Branch: {filters.branch}
              <button type="button" onClick={() => setFilters(f => ({ ...f, branch: 'all' }))} className="hover:text-red-500 border-none bg-transparent cursor-pointer">
                <X size={12} />
              </button>
            </span>
          )}

          {filters.membershipStatus !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-800 shadow-2xs">
              Status: {filters.membershipStatus}
              <button type="button" onClick={() => setFilters(f => ({ ...f, membershipStatus: 'all' }))} className="hover:text-red-500 border-none bg-transparent cursor-pointer">
                <X size={12} />
              </button>
            </span>
          )}

          {filters.paymentStatus !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-800 shadow-2xs">
              Payment: {filters.paymentStatus}
              <button type="button" onClick={() => setFilters(f => ({ ...f, paymentStatus: 'all' }))} className="hover:text-red-500 border-none bg-transparent cursor-pointer">
                <X size={12} />
              </button>
            </span>
          )}

          {(filters.joinedFrom || filters.joinedTo) && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-800 shadow-2xs">
              Joined: {filters.joinedFrom || 'Start'} → {filters.joinedTo || 'End'}
              <button type="button" onClick={() => setFilters(f => ({ ...f, joinedFrom: '', joinedTo: '' }))} className="hover:text-red-500 border-none bg-transparent cursor-pointer">
                <X size={12} />
              </button>
            </span>
          )}

          {filters.expiryStatus !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-200 rounded-full text-xs font-bold text-slate-800 shadow-2xs">
              Expiry: {filters.expiryStatus}
              <button type="button" onClick={() => setFilters(f => ({ ...f, expiryStatus: 'all' }))} className="hover:text-red-500 border-none bg-transparent cursor-pointer">
                <X size={12} />
              </button>
            </span>
          )}

          <button
            type="button"
            onClick={() => setFilters(initialFilterState)}
            className="text-xs font-black text-rose-600 hover:text-rose-700 underline cursor-pointer border-none bg-transparent ml-2"
          >
            Clear All Filters
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="px-4 border-b border-slate-100 flex items-center justify-between overflow-x-auto">
        <div className="flex space-x-1">
          {[
            { id: 'all', label: 'All Members', count: counts.all },
            { id: 'active', label: 'Active', count: counts.active },
            { id: 'hold', label: 'Hold', count: counts.hold, isHold: true },
            { id: 'expired', label: 'Expired', count: counts.expired },
            { id: 'inactive', label: 'Inactive', count: counts.inactive },
            { id: 'frozen', label: 'Frozen', count: counts.frozen },
            { id: 'pt', label: 'PT Members', count: counts.pt },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-4 py-3 text-sm font-black whitespace-nowrap border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                statusFilter === tab.id 
                  ? 'border-[#EA580C] text-[#EA580C]' 
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-xs ${
                tab.isHold && tab.count > 0
                  ? 'bg-amber-100 text-amber-800 border border-amber-300 font-black'
                  : 'text-slate-400 font-bold'
              }`}>
                ({tab.count})
              </span>
            </button>
          ))}
        </div>
        <div className="text-xs font-bold text-slate-500">
          Showing <b className="text-[#10233f] font-mono">{filtered.length}</b> members
        </div>
      </div>

      {/* HOLD MEMBERS DEDICATED CARDS VIEW (When Hold tab is selected) */}
      {statusFilter === 'hold' ? (
        <div className="p-5 bg-slate-50/50 min-h-[350px]">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#EA580C] text-white flex items-center justify-center font-black shadow-sm">
                <Fingerprint size={20} />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900 flex items-center gap-2">
                  <span>HOLD MEMBERS ({filtered.length})</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                    Awaiting Billing
                  </span>
                </h4>
                <p className="text-xs text-slate-600 font-medium mt-0.5">
                  Members imported with Hikvision terminal Biometric IDs. Click &quot;Create Bill →&quot; to assign a package, record payment, and activate their profile.
                </p>
              </div>
            </div>
            <div className="text-xs font-bold text-slate-700 bg-white px-3 py-1.5 rounded-xl border border-amber-200 shadow-2xs">
              Search by <b className="text-[#EA580C]">Name</b> or <b className="text-[#EA580C]">Biometric ID</b> above
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="py-16 text-center text-slate-400 bg-white rounded-2xl border border-slate-200 p-8">
              <User className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <h4 className="text-base font-black text-slate-800">No Hold members found</h4>
              <p className="text-xs text-slate-500 mt-1">
                All imported members have been activated, or no members match your search keyword.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {paginatedMembers.map(member => {
                const bioId = member.biometricId || member.biometricUserId || member.deviceUserId || 'N/A';
                return (
                  <div 
                    key={member.id}
                    className="bg-white rounded-2xl border border-slate-200/90 hover:border-orange-400 p-5 shadow-2xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#EA580C] to-[#FB923C] text-white flex items-center justify-center font-black text-lg shadow-sm">
                          {member.name?.charAt(0) || 'M'}
                        </div>
                        <div>
                          <h4 className="text-sm font-black text-slate-900">
                            {member.name}
                          </h4>
                          <div className="inline-flex items-center gap-1.5 mt-0.5 px-2 py-0.5 rounded-lg bg-orange-50 border border-orange-200 text-[#C2410C] font-mono text-xs font-black">
                            <Fingerprint size={12} />
                            <span>Biometric ID: {bioId}</span>
                          </div>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-300">
                        HOLD
                      </span>
                    </div>

                    <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1.5 font-medium text-slate-600 border border-slate-100">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Source</span>
                        <span className="font-bold text-slate-700">Imported from Excel</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Phone</span>
                        <span className="font-mono font-bold text-slate-700">{member.phone || '—'}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[10px] uppercase font-bold">Status</span>
                        <span className="text-amber-700 font-black">HOLD (Needs Bill)</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => router.push(`/dashboard/members/${encodeURIComponent(member.id)}`)}
                        className="flex-1 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all border-none cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Eye size={13} /> View Profile
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (onCreateBill) onCreateBill(member);
                        }}
                        className="flex-1 py-2.5 px-3 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white rounded-xl text-xs font-black transition-all border-none cursor-pointer shadow-sm hover:shadow flex items-center justify-center gap-1.5 active:scale-95"
                      >
                        <span>Create Bill →</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Normal Table View */
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap border-separate border-spacing-0">
            <thead className="bg-[#EA580C] text-[#fdfdfd] font-bold">
              <tr className="bg-[#EA580C]">
                <th className="px-4 py-3.5 text-[#fdfdfd] bg-[#EA580C] rounded-tl-[14px] border-b border-[#C2410C]">Member</th>
                <th className="px-4 py-3.5 text-[#fdfdfd] bg-[#EA580C] border-b border-[#C2410C]">Phone</th>
                <th className="px-4 py-3.5 text-center text-[#fdfdfd] bg-[#EA580C] border-b border-[#C2410C]">Gender</th>
                <th className="px-4 py-3.5 text-[#fdfdfd] bg-[#EA580C] border-b border-[#C2410C]">Membership</th>
                <th className="px-4 py-3.5 text-[#fdfdfd] bg-[#EA580C] border-b border-[#C2410C]">Trainer</th>
                <th className="px-4 py-3.5 text-center text-[#fdfdfd] bg-[#EA580C] border-b border-[#C2410C]">Attendance</th>
                <th className="px-4 py-3.5 text-center text-[#fdfdfd] bg-[#EA580C] border-b border-[#C2410C]">Days Left</th>
                <th className="px-4 py-3.5 text-[#fdfdfd] bg-[#EA580C] border-b border-[#C2410C]">Payment</th>
                <th className="px-4 py-3.5 text-right text-[#fdfdfd] bg-[#EA580C] rounded-tr-[14px] border-b border-[#C2410C]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedMembers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-slate-400">
                    <div className="max-w-sm mx-auto space-y-3">
                      <User className="w-12 h-12 text-slate-300 mx-auto" />
                      <h3 className="text-base font-black text-slate-800">No members found</h3>
                      <p className="text-xs text-slate-500 font-medium">
                        Try changing your search keywords or adjusting your selected filters.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setLocalSearch('');
                          setSearch('');
                          setFilters(initialFilterState);
                        }}
                        className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black rounded-xl transition-all cursor-pointer shadow-sm border-none"
                      >
                        Clear All Filters
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedMembers.map(member => (
                  <MemberTableRow
                    key={member.id}
                    member={member}
                    isSelected={selectedMemberId === member.id}
                    onRowClick={() => router.push(`/dashboard/members/${member.id}`)}
                    onOpenActions={(m, rect) => setActionsMenu({ member: m, rect })}
                    onCreateBill={onCreateBill}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Floating Actions Portal Dropdown (Never Clipped by Table Container) */}
      {actionsMenu && typeof document !== 'undefined' && createPortal(
        <div
          className="actions-portal-menu fixed z-[99999] bg-white border border-slate-200 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.18)] py-1.5 w-52 text-left text-xs font-semibold text-slate-800 animate-in fade-in select-none"
          style={{
            top: (window.innerHeight - actionsMenu.rect.bottom < 240)
              ? Math.max(10, actionsMenu.rect.top - 230)
              : actionsMenu.rect.bottom + 4,
            left: Math.max(10, Math.min(window.innerWidth - 220, actionsMenu.rect.right - 180)),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {((actionsMenu.member.status || '').toLowerCase() === 'hold') && (
            <button
              type="button"
              onClick={() => {
                const m = actionsMenu.member;
                setActionsMenu(null);
                if (onCreateBill) onCreateBill(m);
              }}
              className="w-full px-3.5 py-2 hover:bg-orange-50 hover:text-[#C2410C] flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-[#EA580C] transition-colors font-black border-b border-orange-100"
            >
              <Receipt size={14} className="text-[#EA580C]" />
              <span>Create Bill / Activate</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              const m = actionsMenu.member;
              setActionsMenu(null);
              router.push(`/dashboard/members/${encodeURIComponent(m.id)}`);
            }}
            className="w-full px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-700 transition-colors font-bold"
          >
            <Eye size={14} className="text-slate-500" />
            <span>View Profile</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const m = actionsMenu.member;
              setActionsMenu(null);
              if (onEdit) onEdit(m);
              else onSelectMember(m);
            }}
            className="w-full px-3.5 py-2 hover:bg-orange-50 hover:text-[#C2410C] flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-700 transition-colors font-bold"
          >
            <Edit size={14} className="text-[#EA580C]" />
            <span>Edit Member</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const m = actionsMenu.member;
              setActionsMenu(null);
              if (onRenew) onRenew(m);
            }}
            className="w-full px-3.5 py-2 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-700 transition-colors font-bold"
          >
            <RefreshCw size={14} className="text-emerald-600" />
            <span>Renew Membership</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const m = actionsMenu.member;
              setActionsMenu(null);
              if (onFreeze) onFreeze(m);
            }}
            className="w-full px-3.5 py-2 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-700 transition-colors font-bold"
          >
            <Snowflake size={14} className="text-indigo-600" />
            <span>{actionsMenu.member.status === 'frozen' ? 'Unfreeze Status' : 'Freeze / Unfreeze'}</span>
          </button>

          <div className="h-px bg-slate-100 my-1" />

          <button
            type="button"
            onClick={() => {
              const m = actionsMenu.member;
              setActionsMenu(null);
              if (onDelete) onDelete(m);
            }}
            className="w-full px-3.5 py-2 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-rose-600 transition-colors font-bold"
          >
            <Trash2 size={14} className="text-rose-600" />
            <span>Delete Member</span>
          </button>
        </div>,
        document.body
      )}

      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-4 text-sm text-slate-500">
        <div>
          Showing {filtered.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filtered.length)} of {filtered.length} members
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button 
              disabled={currentPage <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="p-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum = i + 1;
              if (totalPages > 5 && currentPage > 3) {
                pageNum = currentPage - 3 + i;
                if (pageNum > totalPages) pageNum = totalPages - (4 - i);
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`px-3 py-1 text-xs font-bold rounded transition-colors ${
                    currentPage === pageNum
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            <button 
              disabled={currentPage >= totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 border border-slate-200 rounded text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span>Per page:</span>
            <select 
              value={pageSize}
              onChange={e => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 border border-slate-200 rounded bg-white font-medium text-slate-700 focus:outline-none cursor-pointer"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

    </div>
  );
}
