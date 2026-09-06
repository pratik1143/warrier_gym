'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Phone, MessageSquare, Trash2, RefreshCw, 
  HelpCircle, MapPin, Download, AlertTriangle, Clock, 
  CheckCircle, UserX, MoreHorizontal, Eye, RotateCcw, 
  Calendar, UserCheck, AlertCircle, X, ChevronRight,
  Filter, Check, Sparkles
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useGymStore } from '@/store';
import { formatDate, formatCurrency } from '@/lib/utils';
import { resolveAvatarUrl, MALE_DEFAULT_AVATAR, FEMALE_DEFAULT_AVATAR } from '@/lib/avatar';
import { formatIndianDate, getTodayInIndia } from '@/lib/dateUtils';
import toast from '@/lib/toast';
import { db } from '@/lib/firebase';
import { addDoc, collection } from 'firebase/firestore';
import RenewalWizardModal from '../members/components/RenewalWizardModal';

export default function ExpiredPage() {
  const router = useRouter();
  const { members, fetchMembers, deleteMember, isLoading: storeLoading } = useGymStore() as any;
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [planFilter, setPlanFilter] = useState('All');
  const [overduePeriodFilter, setOverduePeriodFilter] = useState('All');

  // Renewal Wizard Modal State
  const [renewTargetMember, setRenewTargetMember] = useState<any>(null);

  // Follow-up modal state
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [followupMember, setFollowupMember] = useState<any>(null);
  const [followupDate, setFollowupDate] = useState('');
  const [followupTime, setFollowupTime] = useState('11:00');
  const [followupRemarks, setFollowupRemarks] = useState('');
  const [followupAssignedTo, setFollowupAssignedTo] = useState('Manager');
  const [isSubmittingFollowup, setIsSubmittingFollowup] = useState(false);

  // Custom Delete Confirmation Modal State (NO window.confirm)
  const [deleteTargetMember, setDeleteTargetMember] = useState<any>(null);
  const [deletingMember, setDeletingMember] = useState(false);

  // Actions Dropdown Portal State
  const [actionsMenu, setActionsMenu] = useState<{ member: any; rect: DOMRect } | null>(null);

  const todayStr = useMemo(() => getTodayInIndia(), []);

  // Fetch members on mount
  useEffect(() => {
    fetchMembers().finally(() => setLoading(false));
  }, [fetchMembers]);

  // Close floating actions menu on outside click or scroll
  useEffect(() => {
    if (!actionsMenu) return;
    const handleClose = (e: MouseEvent | Event) => {
      const target = e.target as HTMLElement;
      if (target?.closest('.expired-actions-portal-menu')) return;
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

  // Days since expiry calculation
  const getDaysSinceExpiry = (expiryDateStr?: string) => {
    if (!expiryDateStr) return 0;
    try {
      const exp = new Date(expiryDateStr);
      const today = new Date();
      // zero out time parts
      exp.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - exp.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      return diffDays > 0 ? diffDays : 0;
    } catch {
      return 0;
    }
  };

  // 1. DERIVED EXPIRED MEMBERS (Single Source of Truth)
  const expiredMembers = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return members.filter((m: any) => {
      if (!m) return false;
      // Exclude deleted members
      if (m.isDeleted || m.deletedAt || m.status === 'deleted') return false;
      // Exclude special statuses
      if (m.status === 'frozen' || m.status === 'lifetime' || m.status === 'enquiry') return false;

      const status = String(m.status || '').toLowerCase();
      if (status === 'expired' || status === 'lost') return true;

      // Date comparison fallback
      if (!m.expiryDate) return false;
      try {
        const exp = new Date(m.expiryDate);
        exp.setHours(0, 0, 0, 0);
        return exp.getTime() < today.getTime();
      } catch {
        return false;
      }
    });
  }, [members]);

  // Extract unique membership plans dynamically
  const uniquePlans = useMemo(() => {
    const plansFromData = expiredMembers.map((m: any) => m.plan?.trim()).filter(Boolean);
    return Array.from(new Set(['1 Month', '3 Months', '6 Months', '12 Months', ...plansFromData])).filter(Boolean);
  }, [expiredMembers]);

  // 2. FILTERED EXPIRED MEMBERS
  const filteredExpired = useMemo(() => {
    return expiredMembers.filter((m: any) => {
      const daysSince = getDaysSinceExpiry(m.expiryDate);
      const isLost = daysSince > 90 || m.status === 'lost';

      // Status filter
      if (statusFilter !== 'All') {
        if (statusFilter === 'Expired' && isLost) return false;
        if (statusFilter === 'Lost' && !isLost) return false;
      }

      // Plan filter
      if (planFilter !== 'All') {
        const p = String(m.plan || '').toLowerCase();
        if (!p.includes(planFilter.toLowerCase())) return false;
      }

      // Overdue Period filter
      if (overduePeriodFilter !== 'All') {
        if (overduePeriodFilter === '0-7' && (daysSince < 0 || daysSince > 7)) return false;
        if (overduePeriodFilter === '8-30' && (daysSince < 8 || daysSince > 30)) return false;
        if (overduePeriodFilter === '31-90' && (daysSince < 31 || daysSince > 90)) return false;
        if (overduePeriodFilter === '90+' && daysSince <= 90) return false;
      }

      // Search Query
      const q = search.toLowerCase();
      const matchName = (m.name || '').toLowerCase().includes(q);
      const matchPhone = (m.phone || '').includes(q);
      const matchId = (m.memberId || m.id || '').toLowerCase().includes(q);

      return matchName || matchPhone || matchId;
    });
  }, [expiredMembers, search, statusFilter, planFilter, overduePeriodFilter]);

  // KPIs
  const totalExpiredCount = expiredMembers.length;
  const expiredTodayCount = expiredMembers.filter((m: any) => getDaysSinceExpiry(m.expiryDate) === 0).length;
  const lostCount = expiredMembers.filter((m: any) => getDaysSinceExpiry(m.expiryDate) > 90 || m.status === 'lost').length;
  const recoveryRate = '12%';

  // Send WhatsApp Recovery Message
  const handleSendWhatsApp = (member: any) => {
    const formattedExpiry = member.expiryDate ? formatDate(member.expiryDate) : 'recently';
    const msg = `Hi ${member.name}, your The Warrior Gym membership expired on ${formattedExpiry}. We'd love to have you back! Contact us to renew your membership with special renewal perks.`;
    const encoded = encodeURIComponent(msg);
    const link = `https://wa.me/91${member.phone.replace(/[^0-9]/g, '')}?text=${encoded}`;
    window.open(link, '_blank');
  };

  // Open Follow-up Modal
  const handleOpenFollowup = (member: any) => {
    setFollowupMember(member);
    setFollowupDate(todayStr);
    setFollowupTime('11:00');
    setFollowupRemarks(`Follow-up regarding membership renewal for ${member.name} (${member.plan || 'Standard'})`);
    setShowFollowupModal(true);
  };

  // Submit Follow-up to Firestore collection
  const handleScheduleFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!followupDate || !followupMember) {
      toast.error('Please select a valid follow-up date');
      return;
    }
    
    setIsSubmittingFollowup(true);
    try {
      const scheduledDateTime = new Date(`${followupDate}T${followupTime || '11:00'}`);
      
      await addDoc(collection(db, 'followups'), {
        enquiryId: null,
        memberId: followupMember.id,
        employeeId: null,
        type: 'Renewal',
        priority: 'High',
        title: `Renewal Follow-up: ${followupMember.name}`,
        description: followupRemarks || `Follow-up scheduled for expired member ${followupMember.name}`,
        assignedTo: followupAssignedTo,
        scheduledDate: followupDate,
        scheduledTime: followupTime || '11:00',
        scheduledTimestamp: scheduledDateTime.getTime(),
        status: 'Pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      toast.success(`Follow-up scheduled for ${formatIndianDate(followupDate)}!`);
      setShowFollowupModal(false);
    } catch (err: any) {
      toast.error('Failed to schedule follow-up: ' + err.message);
    } finally {
      setIsSubmittingFollowup(false);
    }
  };

  // Permanent Delete Member Handler (NO window.confirm)
  const handleConfirmDelete = async () => {
    if (!deleteTargetMember) return;
    setDeletingMember(true);
    try {
      await deleteMember(deleteTargetMember.id);
      toast.success(`${deleteTargetMember.name} deleted permanently.`);
      setDeleteTargetMember(null);
      await fetchMembers(true);
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete member');
    } finally {
      setDeletingMember(false);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    if (filteredExpired.length === 0) {
      toast.error('No expired members to export');
      return;
    }
    const headers = ['Member ID', 'Name', 'Phone', 'Email', 'Plan', 'Expiry Date', 'Days Overdue', 'Status'];
    const rows = filteredExpired.map((m: any) => {
      const daysSince = getDaysSinceExpiry(m.expiryDate);
      const isLost = daysSince > 90 || m.status === 'lost';
      return [
        m.memberId || m.id,
        m.name,
        m.phone,
        m.email || '',
        m.plan || 'Standard',
        m.expiryDate || '',
        daysSince,
        isLost ? 'Lost Member' : 'Expired'
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `expired_members_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Expired members exported to CSV');
  };

  return (
    <div className="space-y-6 pb-12 w-full text-slate-800 text-left font-sans">
      
      {/* ── 1. PAGE HEADER (Unified with Members, Employees, Enquiries) ── */}
      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
        
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="px-3 py-1 bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#C2410C] text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">
              Membership Recovery
            </span>
            <span className="text-xs text-slate-400 font-mono font-bold">TWG-EXP-v4.0</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900 font-display">Expired Memberships</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Manage expired memberships, renewal opportunities and recovery follow-ups.</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button 
            onClick={() => fetchMembers(true)}
            className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl border border-slate-200 cursor-pointer shadow-2xs transition-all"
            title="Refresh List"
          >
            <RefreshCw size={15} />
          </button>

          <button
            onClick={handleExportCSV}
            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-2xl transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer shadow-2xs"
          >
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      {/* ── 2. SUMMARY STATS CARDS (Exact Members KPI Language) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Expired', value: totalExpiredCount, sub: 'All expired memberships', icon: AlertTriangle, badgeBg: 'bg-[#FFF7ED] border-[#FED7AA] text-[#EA580C]' },
          { label: 'Expired Today', value: expiredTodayCount, sub: 'Expired in last 24h', icon: Clock, badgeBg: 'bg-orange-50 border-orange-200/60 text-orange-600' },
          { label: 'Lost (90D+)', value: lostCount, sub: 'Over 90 days overdue', icon: UserX, badgeBg: 'bg-slate-100 border-slate-200 text-slate-700' },
          { label: 'Recovery Rate', value: recoveryRate, sub: 'Successfully recovered', icon: CheckCircle, badgeBg: 'bg-emerald-50 border-emerald-200/60 text-emerald-600' }
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-[#FED7AA] rounded-3xl p-5 flex flex-col justify-between shadow-[0_4px_20px_rgba(234,88,12,0.03)] relative overflow-hidden group transition-all hover:border-[#EA580C] hover:shadow-md">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</span>
              <div className={`p-2.5 rounded-2xl border ${stat.badgeBg}`}>
                <stat.icon size={16} />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-black text-[#10233f] leading-none font-mono tracking-tight">{stat.value}</div>
              <span className="text-[10px] font-bold text-slate-400 mt-1 block">{stat.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* ── 3. SEARCH & FILTERS BAR (Unified with Members & Employees) ── */}
      <div className="bg-white border border-[#FED7AA] rounded-3xl p-4 flex flex-wrap gap-4 items-center shadow-[0_4px_20px_rgba(234,88,12,0.02)]">
        {/* Search input */}
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search expired members by name, phone or member ID..."
            className="w-full text-xs bg-[#fdfdfd] border border-[#FED7AA] rounded-2xl pl-11 pr-4 py-3 focus:outline-none focus:border-[#EA580C] focus:bg-white transition-all text-[#10233f] font-semibold placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          {/* Status Filter */}
          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs bg-[#fdfdfd] border border-[#FED7AA] rounded-2xl px-4 py-3 text-[#10233f] focus:outline-none font-bold cursor-pointer hover:bg-white transition-all"
          >
            <option value="All">All Statuses</option>
            <option value="Expired">Expired</option>
            <option value="Lost">Lost Member (90D+)</option>
          </select>

          {/* Memberships Filter */}
          <select 
            value={planFilter}
            onChange={e => setPlanFilter(e.target.value)}
            className="text-xs bg-[#fdfdfd] border border-[#FED7AA] rounded-2xl px-4 py-3 text-[#10233f] focus:outline-none font-bold cursor-pointer hover:bg-white transition-all"
          >
            <option value="All">All Memberships</option>
            {uniquePlans.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Overdue Period Filter */}
          <select 
            value={overduePeriodFilter}
            onChange={e => setOverduePeriodFilter(e.target.value)}
            className="text-xs bg-[#fdfdfd] border border-[#FED7AA] rounded-2xl px-4 py-3 text-[#10233f] focus:outline-none font-bold cursor-pointer hover:bg-white transition-all"
          >
            <option value="All">Overdue Period</option>
            <option value="0-7">0 – 7 Days</option>
            <option value="8-30">8 – 30 Days</option>
            <option value="31-90">31 – 90 Days</option>
            <option value="90+">90+ Days (Lost)</option>
          </select>

          {(search || statusFilter !== 'All' || planFilter !== 'All' || overduePeriodFilter !== 'All') && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('All');
                setPlanFilter('All');
                setOverduePeriodFilter('All');
              }}
              className="px-3.5 py-3 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-2xl border border-rose-200 cursor-pointer transition-colors"
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── 4. MAIN EXPIRED MEMBERS TABLE (Matching Members & Employees Table) ── */}
      <div className="bg-white border border-[#FED7AA] rounded-3xl overflow-hidden shadow-[0_4px_25px_rgba(234,88,12,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#EA580C] text-[#fdfdfd] font-extrabold uppercase tracking-wider text-[9.5px] border-b border-[#C2410C]">
              <tr>
                <th className="px-5 py-4 w-[24%] text-[#fdfdfd]">MEMBER</th>
                <th className="px-5 py-4 w-[16%] text-[#fdfdfd]">PHONE</th>
                <th className="px-5 py-4 w-[16%] text-[#fdfdfd]">MEMBERSHIP</th>
                <th className="px-5 py-4 w-[14%] text-[#fdfdfd]">EXPIRY DATE</th>
                <th className="px-5 py-4 w-[14%] text-center text-[#fdfdfd]">OVERDUE</th>
                <th className="px-5 py-4 w-[11%] text-center text-[#fdfdfd]">STATUS</th>
                <th className="px-5 py-4 w-[5%] text-right text-[#fdfdfd]">ACTIONS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-slate-200" />
                        <div className="space-y-1.5">
                          <div className="w-24 h-3 bg-slate-200 rounded" />
                          <div className="w-16 h-2.5 bg-slate-200 rounded" />
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4"><div className="w-20 h-3 bg-slate-200 rounded" /></td>
                    <td className="px-5 py-4"><div className="w-16 h-4 bg-slate-200 rounded" /></td>
                    <td className="px-5 py-4"><div className="w-20 h-3 bg-slate-200 rounded" /></td>
                    <td className="px-5 py-4"><div className="w-24 h-4 bg-slate-200 rounded mx-auto" /></td>
                    <td className="px-5 py-4"><div className="w-16 h-4 bg-slate-200 rounded mx-auto" /></td>
                    <td className="px-5 py-4"><div className="w-8 h-8 bg-slate-200 rounded-xl ml-auto" /></td>
                  </tr>
                ))
              ) : filteredExpired.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16 text-slate-400">
                    <div className="max-w-xs mx-auto text-center space-y-2">
                      <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center mx-auto mb-2">
                        <Check size={24} />
                      </div>
                      <h3 className="font-extrabold text-slate-800 text-sm">No Expired Memberships</h3>
                      <p className="text-xs text-slate-400">All member subscriptions are currently active and up to date.</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredExpired.map((member: any) => {
                  const avatar = resolveAvatarUrl(member);
                  const daysSince = getDaysSinceExpiry(member.expiryDate);
                  const isLost = daysSince > 90 || member.status === 'lost';
                  const memberCode = String(member.memberId || member.id || '').toUpperCase();

                  // Overdue badge style
                  let overdueBadgeClass = 'bg-orange-50 text-orange-700 border-orange-200';
                  if (daysSince >= 8 && daysSince <= 30) {
                    overdueBadgeClass = 'bg-amber-50 text-amber-700 border-amber-200';
                  } else if (daysSince > 30 && daysSince <= 90) {
                    overdueBadgeClass = 'bg-rose-50 text-rose-700 border-rose-200';
                  } else if (daysSince > 90) {
                    overdueBadgeClass = 'bg-red-100 text-red-800 border-red-200 font-extrabold';
                  }

                  return (
                    <tr
                      key={member.id}
                      onClick={() => router.push(`/dashboard/members/${member.id}`)}
                      className="hover:bg-slate-50/70 transition-colors cursor-pointer"
                    >
                      {/* 1. MEMBER: Merged Avatar + Name + Member ID */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <img 
                              src={avatar} 
                              onError={(e) => {
                                const target = e.currentTarget;
                                const g = String(member.gender || '').trim().toLowerCase();
                                target.src = (g === 'female' || g === 'f') ? FEMALE_DEFAULT_AVATAR : MALE_DEFAULT_AVATAR;
                              }}
                              className="w-11 h-11 rounded-full bg-slate-100 border-2 border-white shadow-xs object-cover" 
                              alt={member.name} 
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-900 text-sm leading-tight truncate">
                              {member.name}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono font-bold mt-0.5">
                              #{memberCode}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 2. PHONE */}
                      <td className="px-5 py-3.5">
                        <div className="font-bold text-slate-800 text-xs flex items-center gap-1">
                          <span>☎</span> {member.phone || '—'}
                        </div>
                        {member.email && (
                          <div className="text-[11px] text-slate-400 font-medium truncate max-w-[170px] mt-0.5">
                            {member.email}
                          </div>
                        )}
                      </td>

                      {/* 3. MEMBERSHIP */}
                      <td className="px-5 py-3.5">
                        <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-[#FFF7ED] text-[#EA580C] border border-orange-200/60 inline-block font-sans">
                          {member.plan || '1 MONTH'}
                        </span>
                      </td>

                      {/* 4. EXPIRY DATE */}
                      <td className="px-5 py-3.5">
                        <span className="text-xs font-bold text-slate-700">
                          {member.expiryDate ? formatDate(member.expiryDate) : '—'}
                        </span>
                      </td>

                      {/* 5. OVERDUE */}
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10.5px] font-bold border ${overdueBadgeClass}`}>
                          <span>⚠️</span>
                          <span>{daysSince} {daysSince === 1 ? 'day' : 'days'} overdue</span>
                        </span>
                      </td>

                      {/* 6. STATUS */}
                      <td className="px-5 py-3.5 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-black text-[9.5px] uppercase tracking-wider border ${
                          isLost 
                            ? 'bg-amber-50 text-amber-700 border-amber-200' 
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isLost ? 'bg-amber-500' : 'bg-rose-500'
                          }`} />
                          {isLost ? 'LOST MEMBER' : 'EXPIRED'}
                        </span>
                      </td>

                      {/* 7. ACTIONS (Compact [ ⋯ ] button) */}
                      <td className="px-5 py-3.5 text-right">
                        <button 
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const rect = e.currentTarget.getBoundingClientRect();
                            setActionsMenu({ member, rect });
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-xl bg-slate-100 hover:bg-[#FFF7ED] hover:text-[#EA580C] hover:border-[#FED7AA] text-slate-700 transition-all border border-slate-200 cursor-pointer shadow-2xs active:scale-95 ml-auto"
                          title="Actions"
                        >
                          <MoreHorizontal size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 5. FLOATING PORTAL ACTIONS DROPDOWN ── */}
      {actionsMenu && typeof document !== 'undefined' && createPortal(
        <div
          className="expired-actions-portal-menu fixed z-[99999] bg-white border border-slate-200 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.18)] py-1.5 w-52 text-left text-xs font-semibold text-slate-800 animate-in fade-in select-none"
          style={{
            top: (window.innerHeight - actionsMenu.rect.bottom < 290)
              ? Math.max(10, actionsMenu.rect.top - 280)
              : actionsMenu.rect.bottom + 4,
            left: Math.max(10, Math.min(window.innerWidth - 220, actionsMenu.rect.right - 195)),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. View Profile */}
          <button
            type="button"
            onClick={() => {
              const m = actionsMenu.member;
              setActionsMenu(null);
              router.push(`/dashboard/members/${m.id}`);
            }}
            className="w-full px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-700 transition-colors font-bold"
          >
            <Eye size={14} className="text-slate-500" />
            <span>View Profile</span>
          </button>

          {/* 2. Renew Membership */}
          <button
            type="button"
            onClick={() => {
              const m = actionsMenu.member;
              setActionsMenu(null);
              setRenewTargetMember(m);
            }}
            className="w-full px-3.5 py-2 hover:bg-orange-50 hover:text-[#C2410C] flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-[#C2410C] transition-colors font-extrabold"
          >
            <RotateCcw size={14} className="text-[#EA580C]" />
            <span>Renew Membership</span>
          </button>

          {/* 3. WhatsApp */}
          <button
            type="button"
            onClick={() => {
              const m = actionsMenu.member;
              setActionsMenu(null);
              handleSendWhatsApp(m);
            }}
            className="w-full px-3.5 py-2 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-700 transition-colors font-bold"
          >
            <MessageSquare size={14} className="text-emerald-600" />
            <span>WhatsApp</span>
          </button>

          {/* 4. Call */}
          <button
            type="button"
            onClick={() => {
              const m = actionsMenu.member;
              setActionsMenu(null);
              if (m.phone) window.open(`tel:${m.phone}`);
              else toast.error('No phone number recorded');
            }}
            className="w-full px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-700 transition-colors font-bold"
          >
            <Phone size={14} className="text-slate-500" />
            <span>Call</span>
          </button>

          {/* 5. Create Follow-up */}
          <button
            type="button"
            onClick={() => {
              const m = actionsMenu.member;
              setActionsMenu(null);
              handleOpenFollowup(m);
            }}
            className="w-full px-3.5 py-2 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-700 transition-colors font-bold"
          >
            <Calendar size={14} className="text-indigo-600" />
            <span>Create Follow-up</span>
          </button>

          <div className="h-px bg-slate-100 my-1" />

          {/* 6. Delete Member (Destructive) */}
          <button
            type="button"
            onClick={() => {
              const m = actionsMenu.member;
              setActionsMenu(null);
              setDeleteTargetMember(m);
            }}
            className="w-full px-3.5 py-2 hover:bg-rose-50 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-rose-600 transition-colors font-bold"
          >
            <Trash2 size={14} className="text-rose-600" />
            <span>Delete Member</span>
          </button>
        </div>,
        document.body
      )}

      {/* ── 6. RENEWAL WIZARD MODAL ── */}
      {renewTargetMember && (
        <RenewalWizardModal
          isOpen={!!renewTargetMember}
          member={renewTargetMember}
          onClose={() => {
            setRenewTargetMember(null);
            fetchMembers(true);
          }}
        />
      )}

      {/* ── 7. SCHEDULE FOLLOW-UP MODAL ── */}
      <AnimatePresence>
        {showFollowupModal && followupMember && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 lg:p-7 max-w-md w-full shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="text-[#EA580C]" size={18} /> Schedule Renewal Follow-up
                </h3>
                <button onClick={() => setShowFollowupModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 border-none cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleScheduleFollowup} className="space-y-4 text-xs text-left">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                  <span className="font-extrabold text-slate-900 block">{followupMember.name}</span>
                  <span className="text-[11px] text-slate-500 font-bold">📞 {followupMember.phone} • Plan: {followupMember.plan || 'Standard'}</span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Follow-up Date *</label>
                    <input
                      type="date"
                      required
                      value={followupDate}
                      onChange={e => setFollowupDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#EA580C] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-slate-700 block mb-1">Time</label>
                    <input
                      type="time"
                      value={followupTime}
                      onChange={e => setFollowupTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#EA580C] cursor-pointer"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Assigned Representative</label>
                  <select
                    value={followupAssignedTo}
                    onChange={e => setFollowupAssignedTo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs font-semibold text-slate-800 outline-none focus:border-[#EA580C] cursor-pointer"
                  >
                    <option value="Manager">Manager</option>
                    <option value="Tanya Mehra">Tanya Mehra</option>
                    <option value="Ujjval Peet Kaur">Ujjval Peet Kaur</option>
                    <option value="Karan Verma">Karan Verma</option>
                    <option value="Dev Rana">Dev Rana</option>
                    <option value="Reception Desk">Reception Desk</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Remarks</label>
                  <textarea
                    rows={3}
                    placeholder="Enter notes about renewal discussion..."
                    value={followupRemarks}
                    onChange={e => setFollowupRemarks(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 outline-none focus:border-[#EA580C] resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowFollowupModal(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl border-none cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingFollowup}
                    className="px-5 py-2.5 text-xs font-bold text-white bg-[#EA580C] hover:bg-orange-700 rounded-xl shadow-md border-none cursor-pointer"
                  >
                    {isSubmittingFollowup ? 'Scheduling...' : 'Set Follow-up'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 8. CUSTOM DELETE CONFIRMATION MODAL (NO window.confirm) ── */}
      <AnimatePresence>
        {deleteTargetMember && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-slate-900 relative space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">Delete Member?</h3>
                  <p className="text-xs text-slate-400 font-medium">This action cannot be undone.</p>
                </div>
              </div>

              <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 text-xs font-semibold text-rose-800 space-y-1.5">
                <p>
                  You are about to permanently remove:
                </p>
                <div className="p-2.5 bg-white rounded-xl border border-rose-200 font-black text-rose-950">
                  {deleteTargetMember.name} <span className="font-mono text-slate-500 font-bold">#{deleteTargetMember.memberId || deleteTargetMember.id}</span>
                </div>
                <p className="text-[11px] text-rose-700 font-normal">
                  All membership history, biometric logs, and invoices for this member will be permanently deleted across Warrior Gym OS.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTargetMember(null)}
                  disabled={deletingMember}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingMember}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs cursor-pointer disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5 border-none shadow-sm"
                >
                  {deletingMember ? 'Deleting...' : 'Delete Member'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
