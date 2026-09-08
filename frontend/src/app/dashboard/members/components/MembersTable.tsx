'use client';

import React, { useState, useMemo, useCallback, memo } from 'react';
import { 
  Search, Filter, SlidersHorizontal, ArrowUpDown, LayoutGrid, List, 
  MoreHorizontal, Phone, MessageSquare, Edit, RotateCcw, Snowflake, 
  Trash2, Eye, CreditCard, ChevronLeft, ChevronRight, Check, X, 
  AlertTriangle, CheckCircle2, UserCheck, PauseCircle, Clock, 
  ExternalLink, Sparkles, User, Dumbbell, Calendar, ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { membershipEngine } from '@/lib/engines/membershipEngine';
import { calculateRealAttendance, formatDate } from '@/lib/utils';
import MemberAvatar from '../../components/MemberAvatar';
import toast from '@/lib/toast';

export interface FilterState {
  gender: string;
  plan: string;
  trainer: string;
  paymentStatus: string;
  expiryStatus: string;
}

const initialFilterState: FilterState = {
  gender: 'all',
  plan: 'all',
  trainer: 'all',
  paymentStatus: 'all',
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
  onQuickPreview?: (m: any) => void;
}

export default function MembersTable({
  members,
  search,
  setSearch,
  statusFilter,
  setStatusFilter,
  onSelectMember,
  selectedMemberId,
  onEdit,
  onRenew,
  onFreeze,
  onDelete,
  onCreateBill,
  onQuickPreview,
}: MembersTableProps) {
  const router = useRouter();

  // View mode: 'list' (compact hybrid rows) | 'grid' (cards)
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');

  // Filters state
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>(initialFilterState);

  // Sorting
  const [sortField, setSortField] = useState<'name' | 'joinDate' | 'daysLeft' | 'amount'>('joinDate');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Active Dropdown Menu target
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Derive counts for Status Tabs
  const counts = useMemo(() => {
    let all = 0;
    let active = 0;
    let hold = 0;
    let expired = 0;
    let inactive = 0;
    let frozen = 0;
    let pt = 0;

    (members || []).forEach((m: any) => {
      all++;
      const st = String(m.status || m.membershipStatus || '').toLowerCase();
      const isHold = st === 'hold' || m.activationStatus === 'PENDING_ACTIVATION';

      if (isHold) {
        hold++;
      } else if (st === 'frozen') {
        frozen++;
      } else if (st === 'inactive') {
        inactive++;
      } else {
        const days = m.expiryDate ? membershipEngine.calculateDaysLeft(m.expiryDate) : 0;
        if (days <= 0) {
          expired++;
        } else {
          active++;
        }
      }

      const hasTrainer = m.trainer && String(m.trainer).trim() !== '' && !String(m.trainer).toLowerCase().includes('unassigned');
      const isPTPlan = m.plan && (m.plan.includes('PT') || m.plan.includes('Personal Training'));
      if (hasTrainer || isPTPlan || m.isPT) {
        pt++;
      }
    });

    return { all, active, hold, expired, inactive, frozen, pt };
  }, [members]);

  // Filtered & Sorted Members
  const filteredMembers = useMemo(() => {
    let list = members || [];

    // 1. Status Tab Filter
    if (statusFilter !== 'all') {
      list = list.filter((m: any) => {
        const st = String(m.status || m.membershipStatus || '').toLowerCase();
        const isHold = st === 'hold' || m.activationStatus === 'PENDING_ACTIVATION';

        if (statusFilter === 'hold') return isHold;
        if (statusFilter === 'frozen') return st === 'frozen';
        if (statusFilter === 'inactive') return st === 'inactive';
        if (statusFilter === 'pt') {
          const hasTrainer = m.trainer && String(m.trainer).trim() !== '' && !String(m.trainer).toLowerCase().includes('unassigned');
          return hasTrainer || (m.plan && (m.plan.includes('PT') || m.plan.includes('Personal Training'))) || m.isPT;
        }

        if (isHold) return false;
        const days = m.expiryDate ? membershipEngine.calculateDaysLeft(m.expiryDate) : 0;
        if (statusFilter === 'expired') return days <= 0;
        if (statusFilter === 'active') return days > 0;
        return true;
      });
    }

    // 2. Search Filter (Name, Phone, Biometric ID, Client ID, Email)
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      list = list.filter((m: any) => {
        const name = String(m.name || '').toLowerCase();
        const phone = String(m.phone || '').replace(/\D/g, '');
        const bioId = String(m.biometricId || m.deviceUserId || '').toLowerCase();
        const clientId = String(m.clientId || m.memberId || '').toLowerCase();
        const email = String(m.email || '').toLowerCase();
        return name.includes(q) || phone.includes(q) || bioId.includes(q) || clientId.includes(q) || email.includes(q);
      });
    }

    // 3. Extended Drawer Filters
    if (filters.gender !== 'all') {
      list = list.filter((m: any) => String(m.gender || '').toLowerCase() === filters.gender);
    }
    if (filters.plan !== 'all') {
      list = list.filter((m: any) => String(m.plan || '').toLowerCase().includes(filters.plan.toLowerCase()));
    }
    if (filters.paymentStatus !== 'all') {
      list = list.filter((m: any) => {
        const isHold = String(m.status || m.membershipStatus || '').toLowerCase() === 'hold' || m.activationStatus === 'PENDING_ACTIVATION';
        const paid = Number(m.amountPaid ?? m.paid ?? 0);
        const balance = Number(m.balanceAmount ?? m.balance ?? 0);
        if (filters.paymentStatus === 'paid') return !isHold && paid > 0 && balance <= 0;
        if (filters.paymentStatus === 'partial') return !isHold && paid > 0 && balance > 0;
        if (filters.paymentStatus === 'pending') return isHold || (paid === 0 && balance > 0);
        return true;
      });
    }

    // 4. Sorting
    return [...list].sort((a: any, b: any) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === 'name') {
        valA = String(a.name || '').toLowerCase();
        valB = String(b.name || '').toLowerCase();
        return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      if (sortField === 'daysLeft') {
        valA = a.expiryDate ? membershipEngine.calculateDaysLeft(a.expiryDate) : -999;
        valB = b.expiryDate ? membershipEngine.calculateDaysLeft(b.expiryDate) : -999;
      }
      if (sortField === 'amount') {
        valA = Number(a.amountPaid ?? a.paid ?? 0);
        valB = Number(b.amountPaid ?? b.paid ?? 0);
      }
      if (sortField === 'joinDate') {
        valA = new Date(a.startDate || a.joinDate || 0).getTime();
        valB = new Date(b.startDate || b.joinDate || 0).getTime();
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [members, statusFilter, search, filters, sortField, sortOrder]);

  // Paginated Slice
  const totalPages = Math.ceil(filteredMembers.length / pageSize) || 1;
  const paginatedMembers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredMembers.slice(start, start + pageSize);
  }, [filteredMembers, currentPage, pageSize]);

  // Checkbox handlers
  const handleSelectAll = () => {
    if (selectedIds.size === paginatedMembers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedMembers.map((m: any) => m.id)));
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== 'all').length;

  const STATUS_TABS = [
    { id: 'all', label: 'All Members', count: counts.all, dot: 'bg-stone-400' },
    { id: 'active', label: 'Active', count: counts.active, dot: 'bg-emerald-500' },
    { id: 'hold', label: 'Hold', count: counts.hold, dot: 'bg-amber-500' },
    { id: 'expired', label: 'Expired', count: counts.expired, dot: 'bg-rose-500' },
    { id: 'inactive', label: 'Inactive', count: counts.inactive, dot: 'bg-stone-400' },
    { id: 'frozen', label: 'Frozen', count: counts.frozen, dot: 'bg-sky-500' },
    { id: 'pt', label: 'PT Members', count: counts.pt, dot: 'bg-indigo-500' },
  ];

  return (
    <div className="space-y-4">
      {/* ══════════════════════════════════════════════════════════════════
          1. SMART SEARCH, FILTERS & CONTROL BAR
         ══════════════════════════════════════════════════════════════════ */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-stone-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row items-center gap-2.5 justify-between">
          {/* Large Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search by name, phone, biometric ID, member ID, email..."
              className="w-full pl-10 pr-10 py-2.5 text-sm bg-stone-50/70 hover:bg-stone-50 rounded-xl border border-stone-200 focus:border-[#F04400] focus:ring-3 focus:ring-orange-100 focus:bg-white focus:outline-hidden transition-all text-stone-900"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Right Controls: Filters, Sorting, View Toggle */}
          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0 justify-end">
            {/* Filter Toggle Button */}
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                showFilters || activeFilterCount > 0
                  ? 'bg-orange-50 border-[#F04400] text-[#EA580C]'
                  : 'bg-white border-stone-200 text-stone-700 hover:border-stone-300'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filters</span>
              {activeFilterCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#F04400] text-white text-[10px] font-black flex items-center justify-center">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={`${sortField}_${sortOrder}`}
                onChange={(e) => {
                  const [f, o] = e.target.value.split('_');
                  setSortField(f as any);
                  setSortOrder(o as any);
                }}
                className="py-2 pl-3 pr-8 bg-white border border-stone-200 text-stone-700 rounded-xl text-xs font-bold appearance-none cursor-pointer focus:outline-hidden hover:border-stone-300"
              >
                <option value="joinDate_desc">Newest Joined</option>
                <option value="joinDate_asc">Oldest Joined</option>
                <option value="name_asc">Name (A–Z)</option>
                <option value="name_desc">Name (Z–A)</option>
                <option value="daysLeft_asc">Expiry (Soonest)</option>
                <option value="amount_desc">Highest Paid</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center bg-stone-100 p-1 rounded-xl border border-stone-200">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'list'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-all ${
                  viewMode === 'grid'
                    ? 'bg-white text-stone-900 shadow-xs'
                    : 'text-stone-500 hover:text-stone-900'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Slide-Down Filter Panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden pt-2 border-t border-stone-100"
            >
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 py-2 text-xs">
                {/* Gender */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Gender
                  </label>
                  <select
                    value={filters.gender}
                    onChange={(e) => setFilters(prev => ({ ...prev, gender: e.target.value }))}
                    className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-800"
                  >
                    <option value="all">All Genders</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {/* Plan */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Package Plan
                  </label>
                  <select
                    value={filters.plan}
                    onChange={(e) => setFilters(prev => ({ ...prev, plan: e.target.value }))}
                    className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-800"
                  >
                    <option value="all">All Plans</option>
                    <option value="month">Monthly</option>
                    <option value="quarter">Quarterly (3 Months)</option>
                    <option value="semi">Semi-Annual (6 Months)</option>
                    <option value="annual">Annual</option>
                  </select>
                </div>

                {/* Payment Status */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 mb-1">
                    Payment Status
                  </label>
                  <select
                    value={filters.paymentStatus}
                    onChange={(e) => setFilters(prev => ({ ...prev, paymentStatus: e.target.value }))}
                    className="w-full p-2 bg-white border border-stone-200 rounded-xl text-xs font-semibold text-stone-800"
                  >
                    <option value="all">All Payments</option>
                    <option value="paid">Paid in Full</option>
                    <option value="partial">Partial / Balance Due</option>
                    <option value="pending">Pending / No Bill</option>
                  </select>
                </div>

                {/* Reset Filters */}
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setFilters(initialFilterState)}
                    className="w-full py-2 px-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold rounded-xl text-xs transition-colors"
                  >
                    Reset All Filters
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          2. SEGMENTED STATUS TABS WITH LIVE COUNTS
         ══════════════════════════════════════════════════════════════════ */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        {STATUS_TABS.map((tab) => {
          const isActive = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => {
                setStatusFilter(tab.id);
                setCurrentPage(1);
              }}
              className={`relative px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap flex items-center gap-2 transition-all cursor-pointer border ${
                isActive
                  ? 'bg-white border-[#F04400] text-stone-900 shadow-xs'
                  : 'bg-stone-100/70 hover:bg-stone-100 border-transparent text-stone-600'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${tab.dot}`} />
              <span>{tab.label}</span>
              <span
                className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                  isActive
                    ? 'bg-orange-100 text-[#EA580C]'
                    : 'bg-white/80 text-stone-500'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          3. MEMBER LIST: HYBRID COMPACT PROFILE CARDS
         ══════════════════════════════════════════════════════════════════ */}
      {paginatedMembers.length === 0 ? (
        /* Empty State */
        <div className="p-12 text-center bg-white rounded-2xl border border-stone-200 shadow-xs space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#EA580C] flex items-center justify-center mx-auto border border-orange-100">
            <User className="w-7 h-7 stroke-[1.5]" />
          </div>
          <div>
            <h3 className="text-base font-black text-stone-900">No Members Found</h3>
            <p className="text-xs text-stone-500 max-w-sm mx-auto mt-1">
              No members match your current search query or active filter settings. Try adjusting your filters.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setFilters(initialFilterState);
              }}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl transition-colors"
            >
              Clear All Filters
            </button>
          </div>
        </div>
      ) : viewMode === 'list' ? (
        /* Compact Hybrid Rows List */
        <div className="space-y-2.5">
          {paginatedMembers.map((m: any) => {
            const isHold = String(m.status || m.membershipStatus || '').toLowerCase() === 'hold' || m.activationStatus === 'PENDING_ACTIVATION';
            const daysLeft = isHold ? 0 : (m.expiryDate ? membershipEngine.calculateDaysLeft(m.expiryDate) : 0);
            const isExpired = !isHold && daysLeft <= 0;
            const isExpiring = !isHold && daysLeft > 0 && daysLeft <= 15;

            const rawPaid = Number(m.amountPaid !== undefined ? m.amountPaid : (m.paid ?? m.totalPaid ?? 0));
            const rawBalance = Number(m.balanceAmount !== undefined ? m.balanceAmount : (m.balance ?? m.outstandingBalance ?? 0));
            const isSelected = selectedIds.has(m.id);

            const attScore = isHold ? 0 : calculateRealAttendance(m.joinDate, m.attendanceCount || 0);

            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
                className={`group relative bg-white rounded-2xl p-3.5 sm:p-4 border transition-all duration-200 hover:border-orange-300 hover:shadow-md ${
                  isSelected
                    ? 'border-[#F04400] bg-orange-50/20'
                    : 'border-stone-200 hover:bg-white'
                }`}
              >
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 sm:gap-4">
                  {/* Left: Checkbox + Avatar + Member Identity */}
                  <div className="flex items-center gap-3 min-w-[240px]">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => handleToggleSelect(m.id, e as any)}
                      className="w-4 h-4 rounded-md text-[#EA580C] focus:ring-orange-200 border-stone-300 cursor-pointer"
                    />

                    {/* Avatar with Quick Preview click */}
                    <div
                      onClick={() => onQuickPreview ? onQuickPreview(m) : onSelectMember(m)}
                      className="relative cursor-pointer shrink-0 group/avatar"
                    >
                      <MemberAvatar
                        member={m}
                        className="w-12 h-12 rounded-xl object-cover border border-stone-200 shadow-xs group-hover/avatar:scale-105 transition-transform"
                        size={48}
                      />
                      <span
                        className={`absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white ${
                          isHold ? 'bg-amber-500' :
                          isExpired ? 'bg-rose-500' :
                          m.status === 'frozen' ? 'bg-sky-500' :
                          'bg-emerald-500'
                        }`}
                      />
                    </div>

                    {/* Name, Member ID, Biometric ID */}
                    <div className="text-left">
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => onQuickPreview ? onQuickPreview(m) : onSelectMember(m)}
                          className="text-sm font-bold text-stone-900 hover:text-[#EA580C] transition-colors leading-tight text-left"
                        >
                          {m.name}
                        </button>
                      </div>

                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[11px] font-mono text-stone-400 font-medium">
                          #{m.clientId ? `TWG-${m.clientId}` : (m.memberId || 'TWG-MEMBER')}
                        </span>
                        <span className="text-[10px] font-mono font-bold bg-orange-50 text-[#EA580C] px-1.5 py-0.2 rounded border border-orange-100">
                          BIO: {m.biometricId || m.deviceUserId || '—'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Center Column: Status, Membership, Trainer, Days Left */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs w-full lg:w-auto lg:flex-1 items-center px-1 sm:px-3">
                    {/* 1. Status Pill */}
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase tracking-wider block sm:hidden">
                        Status
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          isHold
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : isExpired
                            ? 'bg-rose-50 text-rose-800 border border-rose-200'
                            : m.status === 'frozen'
                            ? 'bg-sky-50 text-sky-800 border border-sky-200'
                            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isHold ? 'bg-amber-500' :
                            isExpired ? 'bg-rose-500' :
                            m.status === 'frozen' ? 'bg-sky-500' :
                            'bg-emerald-500'
                          }`}
                        />
                        {isHold ? 'HOLD' : isExpired ? 'EXPIRED' : m.status === 'frozen' ? 'FROZEN' : 'ACTIVE'}
                      </span>
                    </div>

                    {/* 2. Membership Plan */}
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase tracking-wider block sm:hidden">
                        Membership
                      </span>
                      <span className="font-bold text-stone-900 block truncate">
                        {isHold ? 'NO PLAN' : (m.plan || 'Standard')}
                      </span>
                      <span className="text-[11px] text-stone-500 truncate block">
                        {m.trainer || 'General Access'}
                      </span>
                    </div>

                    {/* 3. Days Left / Expiry */}
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase tracking-wider block sm:hidden">
                        Validity
                      </span>
                      {isHold ? (
                        <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                          PENDING BILL
                        </span>
                      ) : (
                        <div>
                          <span
                            className={`font-black text-xs ${
                              isExpired ? 'text-rose-600' :
                              isExpiring ? 'text-amber-600' :
                              'text-stone-800'
                            }`}
                          >
                            {daysLeft > 0 ? `${daysLeft} Days Left` : 'Expired'}
                          </span>
                          <span className="text-[10px] text-stone-400 block">
                            {formatDate(m.expiryDate)}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 4. Payment Ledger Display */}
                    <div>
                      <span className="text-[10px] text-stone-400 uppercase tracking-wider block sm:hidden">
                        Payment
                      </span>
                      {isHold ? (
                        <span className="text-[11px] font-bold text-stone-400">
                          NO BILL
                        </span>
                      ) : rawPaid > 0 && rawBalance <= 0 ? (
                        <div>
                          <span className="text-xs font-black text-emerald-700">
                            ₹{rawPaid.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] font-bold text-emerald-600 block">
                            PAID IN FULL
                          </span>
                        </div>
                      ) : rawPaid > 0 && rawBalance > 0 ? (
                        <div>
                          <span className="text-xs font-black text-amber-700">
                            ₹{rawPaid.toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] font-bold text-amber-600 block">
                            DUE: ₹{rawBalance.toLocaleString('en-IN')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] font-bold text-rose-600">
                          UNPAID
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right: Contextual Quick Actions */}
                  <div className="flex items-center gap-2 shrink-0 self-end lg:self-center">
                    {isHold ? (
                      /* Priority Action for Hold Member */
                      <button
                        type="button"
                        onClick={() => onCreateBill ? onCreateBill(m) : null}
                        className="py-1.5 px-3.5 bg-gradient-to-r from-[#FF7A00] to-[#F04400] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm hover:brightness-105 transition-all cursor-pointer"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>Create Bill</span>
                      </button>
                    ) : isExpired ? (
                      /* Priority Action for Expired Member */
                      <button
                        type="button"
                        onClick={() => onRenew ? onRenew(m) : null}
                        className="py-1.5 px-3 bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Renew</span>
                      </button>
                    ) : (
                      /* Active Member Quick View & Billing */
                      <>
                        <button
                          type="button"
                          onClick={() => onQuickPreview ? onQuickPreview(m) : onSelectMember(m)}
                          className="py-1.5 px-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                        >
                          View
                        </button>
                        <button
                          type="button"
                          onClick={() => router.push(`/dashboard/members/${encodeURIComponent(m.id)}?tab=billing`)}
                          className="py-1.5 px-2.5 bg-orange-50 hover:bg-orange-100 text-[#EA580C] text-xs font-bold rounded-xl border border-orange-200 transition-colors cursor-pointer"
                        >
                          Billing
                        </button>
                      </>
                    )}

                    {/* More Actions Dropdown */}
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setActiveMenuId(activeMenuId === m.id ? null : m.id)}
                        className="p-1.5 rounded-xl hover:bg-stone-100 text-stone-500 transition-colors"
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>

                      {activeMenuId === m.id && (
                        <div
                          className="absolute right-0 top-full mt-1 w-44 bg-white rounded-2xl shadow-xl border border-stone-200 p-1.5 z-30 space-y-0.5 text-xs text-stone-700 text-left"
                          onMouseLeave={() => setActiveMenuId(null)}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              router.push(`/dashboard/members/${encodeURIComponent(m.id)}`);
                            }}
                            className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-stone-50 font-semibold flex items-center gap-2"
                          >
                            <Eye className="w-3.5 h-3.5 text-stone-500" />
                            <span>Full Profile</span>
                          </button>

                          {onRenew && !isHold && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onRenew(m);
                              }}
                              className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-stone-50 font-semibold flex items-center gap-2"
                            >
                              <RotateCcw className="w-3.5 h-3.5 text-stone-500" />
                              <span>Renew Package</span>
                            </button>
                          )}

                          {onFreeze && !isHold && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onFreeze(m);
                              }}
                              className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-stone-50 font-semibold flex items-center gap-2"
                            >
                              <Snowflake className="w-3.5 h-3.5 text-sky-500" />
                              <span>{m.status === 'frozen' ? 'Unfreeze' : 'Freeze Member'}</span>
                            </button>
                          )}

                          {onEdit && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onEdit(m);
                              }}
                              className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-stone-50 font-semibold flex items-center gap-2"
                            >
                              <Edit className="w-3.5 h-3.5 text-stone-500" />
                              <span>Edit Details</span>
                            </button>
                          )}

                          {onDelete && (
                            <button
                              type="button"
                              onClick={() => {
                                setActiveMenuId(null);
                                onDelete(m);
                              }}
                              className="w-full px-2.5 py-1.5 text-left rounded-lg hover:bg-red-50 text-red-600 font-semibold flex items-center gap-2"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Delete Record</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        /* Grid Card View */
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
          {paginatedMembers.map((m: any) => {
            const isHold = String(m.status || m.membershipStatus || '').toLowerCase() === 'hold' || m.activationStatus === 'PENDING_ACTIVATION';
            const daysLeft = isHold ? 0 : (m.expiryDate ? membershipEngine.calculateDaysLeft(m.expiryDate) : 0);
            const isExpired = !isHold && daysLeft <= 0;

            return (
              <div
                key={m.id}
                className="bg-white rounded-2xl p-4 border border-stone-200 hover:border-orange-300 hover:shadow-md transition-all flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <MemberAvatar
                        member={m}
                        className="w-12 h-12 rounded-xl object-cover border border-stone-200"
                        size={48}
                      />
                      <div>
                        <h4 className="text-sm font-bold text-stone-900 leading-tight">
                          {m.name}
                        </h4>
                        <span className="text-[11px] font-mono text-stone-400">
                          #{m.clientId ? `TWG-${m.clientId}` : (m.memberId || 'TWG')}
                        </span>
                      </div>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full ${
                      isHold ? 'bg-amber-100 text-amber-800' :
                      isExpired ? 'bg-rose-100 text-rose-800' :
                      'bg-emerald-100 text-emerald-800'
                    }`}>
                      {isHold ? 'HOLD' : isExpired ? 'EXPIRED' : 'ACTIVE'}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-stone-100 text-xs space-y-1.5">
                    <div className="flex justify-between text-stone-600">
                      <span>Package:</span>
                      <span className="font-bold text-stone-900">{isHold ? 'NO PLAN' : (m.plan || 'Standard')}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Biometric ID:</span>
                      <span className="font-mono font-bold text-[#EA580C]">#{m.biometricId || '—'}</span>
                    </div>
                    <div className="flex justify-between text-stone-600">
                      <span>Validity:</span>
                      <span className="font-bold text-stone-900">
                        {isHold ? 'HOLD' : (daysLeft > 0 ? `${daysLeft} Days` : 'Expired')}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                  {isHold ? (
                    <button
                      type="button"
                      onClick={() => onCreateBill ? onCreateBill(m) : null}
                      className="w-full py-2 bg-[#F04400] text-white text-xs font-bold rounded-xl"
                    >
                      Create Bill
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onQuickPreview ? onQuickPreview(m) : onSelectMember(m)}
                      className="w-full py-2 bg-stone-100 hover:bg-stone-200 text-stone-800 text-xs font-bold rounded-xl"
                    >
                      View Profile
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          4. MODERN COMPACT PAGINATION FOOTER
         ══════════════════════════════════════════════════════════════════ */}
      {filteredMembers.length > 0 && (
        <div className="p-3.5 bg-white rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-600">
          <div className="flex items-center gap-3">
            <span>
              Showing <strong>{((currentPage - 1) * pageSize) + 1}</strong>–<strong>{Math.min(currentPage * pageSize, filteredMembers.length)}</strong> of <strong>{filteredMembers.length}</strong> members
            </span>

            {/* Rows per page */}
            <div className="flex items-center gap-1">
              <span className="text-stone-400">Rows:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="p-1 bg-stone-50 border border-stone-200 rounded-lg text-xs font-semibold"
              >
                <option value={20}>20</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-1.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-2.5 font-bold text-stone-800">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-xl border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          5. FLOATING BULK ACTIONS BAR
         ══════════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-stone-900 text-white px-5 py-3 rounded-2xl shadow-2xl border border-stone-800 flex items-center gap-4 text-xs font-bold"
          >
            <span>{selectedIds.size} Members Selected</span>

            <div className="h-4 w-px bg-stone-700" />

            <button
              type="button"
              onClick={() => {
                toast.success(`WhatsApp campaign queued for ${selectedIds.size} members`);
                setSelectedIds(new Set());
              }}
              className="hover:text-emerald-400 flex items-center gap-1.5 transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>Broadcast WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-stone-400 hover:text-white ml-2 p-1"
            >
              ✕
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
