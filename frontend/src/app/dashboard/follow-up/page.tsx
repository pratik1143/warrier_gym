'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Phone, 
  MessageCircle, 
  Clock, 
  CheckCircle2, 
  Calendar, 
  Filter, 
  Search, 
  Plus, 
  Trash2, 
  MoreVertical,
  Check,
  AlertCircle,
  AlertTriangle,
  MessageSquare,
  Sparkles,
  Layers,
  PenLine,
  X,
  History,
  UserX,
  ArrowRight,
  FileText,
  UserCheck,
  RotateCcw
} from 'lucide-react';
import toast from '@/lib/toast';
import confetti from 'canvas-confetti';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import API from '@/services/api';
import { useGymStore } from '@/store';
import { useFollowups } from '@/hooks/useFollowups';
import { followupService, FollowUpItem, FollowUpHistoryEvent } from '@/services/followup.service';
import { getTodayInIndia, isTodayInIndia, isOverdueInIndia, isUpcomingInIndia, formatIndianDate } from '@/lib/dateUtils';

// Helper: Normalize & classify Follow-up Source from real database record
export function getFollowupSourceInfo(task: FollowUpItem | any) {
  const rawSource = String(task?.source || '').trim().toLowerCase();
  
  // 1. Explicit source values
  if (rawSource === 'manual' || rawSource === 'staff' || rawSource === 'user') {
    return {
      type: 'manual',
      label: 'MANUAL',
      title: 'Staff Created',
      iconText: '✎',
      badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs font-extrabold'
    };
  }
  
  if (rawSource === 'auto' || rawSource === 'automatic' || rawSource === 'system' || rawSource === 'rule') {
    return {
      type: 'auto',
      label: 'AUTO',
      title: 'System Generated',
      iconText: '✦',
      badgeClass: 'bg-[#FFF7ED] text-[#EA580C] border border-[#FED7AA] shadow-2xs font-extrabold'
    };
  }

  // 2. Safe Fallback for legacy records:
  if (task?.automationKey?.startsWith('AUTO_') || task?.id?.startsWith('AUTO_') || task?.type === 'GYM MEMBERSHIP RENEWAL' || task?.type === 'PT RENEWAL' || task?.type === 'PENDING BALANCE') {
    return {
      type: 'auto',
      label: 'AUTO',
      title: 'System Generated',
      iconText: '✦',
      badgeClass: 'bg-[#FFF7ED] text-[#EA580C] border border-[#FED7AA] shadow-2xs font-extrabold'
    };
  }

  return {
    type: 'manual',
    label: 'MANUAL',
    title: 'Staff Created',
    iconText: '✎',
    badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200 shadow-2xs font-extrabold'
  };
}

// Zod Schema for validation
const followUpFormSchema = z.object({
  memberId: z.string().min(1, 'Please select a member'),
  reason: z.string().min(2, 'Reason must be at least 2 characters'),
  date: z.string().min(1, 'Date is required'),
  time: z.string().min(1, 'Time is required'),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent'], { message: 'Select priority' })
});

export default function FollowUpManager() {
  const { 
    followups, 
    todaysFollowups, 
    overdueFollowups, 
    activeFollowups, 
    completedTodayFollowups, 
    todaysCount, 
    overdueCount, 
    completedTodayCount, 
    totalActiveCount, 
    loading, 
    createFollowup, 
    completeFollowup, 
    rescheduleFollowup,
    addFollowupNote,
    markFollowupLost,
    snoozeFollowup, 
    cancelFollowup, 
    removeFollowup 
  } = useFollowups();

  const { members, fetchMembers } = useGymStore();
  const [enquiries, setEnquiries] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);

  // Default to today in Asia/Kolkata timezone
  const todayDateStr = useMemo(() => getTodayInIndia(), []);

  // Tabs: 'today' (Default) | 'active' | 'overdue' | 'history'
  const [activeTab, setActiveTab] = useState<'today' | 'active' | 'overdue' | 'history'>('today');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState('All');
  const [filterSource, setFilterSource] = useState('All');
  const [filterStaff, setFilterStaff] = useState('All');
  const [filterPriority, setFilterPriority] = useState('All');
  const [filterStartDate, setFilterStartDate] = useState(todayDateStr);
  const [filterEndDate, setFilterEndDate] = useState(todayDateStr);
  const [isCustomDateFilterActive, setIsCustomDateFilterActive] = useState(false);

  // Selection
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  // Modals & Drawers State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState<FollowUpItem | null>(null);
  const [showRescheduleModal, setShowRescheduleModal] = useState<FollowUpItem | null>(null);
  const [showAddNoteModal, setShowAddNoteModal] = useState<FollowUpItem | null>(null);
  const [showLostModal, setShowLostModal] = useState<FollowUpItem | null>(null);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<FollowUpItem | null>(null);
  const [deleteConfirmTask, setDeleteConfirmTask] = useState<FollowUpItem | null>(null);
  const [openActionDropdown, setOpenActionDropdown] = useState<string | null>(null);

  // Complete Form State
  const [completeRemarks, setCompleteRemarks] = useState('');
  const [completeOutcome, setCompleteOutcome] = useState('Connected');

  // Reschedule Form State
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('10:00');
  const [rescheduleReason, setRescheduleReason] = useState('Customer requested later callback');
  const [rescheduleNote, setRescheduleNote] = useState('');
  const [isRescheduling, setIsRescheduling] = useState(false);

  // Add Note Form State
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteNextDate, setNewNoteNextDate] = useState('');
  const [newNoteNextTime, setNewNoteNextTime] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);

  // Mark Lost Form State
  const [lostReason, setLostReason] = useState('Not interested');
  const [lostNote, setLostNote] = useState('');
  const [isSavingLost, setIsSavingLost] = useState(false);

  // Close floating actions menu on outside click
  useEffect(() => {
    if (!openActionDropdown) return;
    const handleClose = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target?.closest('.followup-action-menu-container')) return;
      setOpenActionDropdown(null);
    };
    document.addEventListener('mousedown', handleClose);
    return () => document.removeEventListener('mousedown', handleClose);
  }, [openActionDropdown]);

  // Deep-linking support from Universal Search (?search=...)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const searchParam = params.get('search');
    if (searchParam) {
      setSearchQuery(searchParam);
      setActiveTab('active');
    }
  }, []);

  // Fetch Dependencies
  useEffect(() => {
    fetchMembers();

    const fetchEnquiries = async () => {
      try {
        const snap = await getDocs(collection(db, 'enquiries'));
        setEnquiries(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (_) {
        try {
          const res = await API.get('/enquiries');
          setEnquiries(res.data || []);
        } catch (_) {}
      }
    };

    const fetchEmployees = async () => {
      try {
        const snap = await getDocs(collection(db, 'employees'));
        setEmployees(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (_) {
        try {
          const res = await API.get('/employees');
          setEmployees(res.data || []);
        } catch (_) {}
      }
    };

    fetchEnquiries();
    fetchEmployees();
  }, [fetchMembers]);

  // Client Details Resolver
  const getClientDetails = (task: any) => {
    let name = task.name || task.memberName || task.clientName || '';
    let phone = task.phone || task.memberPhone || task.clientPhone || '';
    let plan = task.plan || 'Standard';

    if (task.memberId) {
      const m = members.find((x: any) => x.id === task.memberId || x.memberId === task.memberId);
      if (m) {
        name = m.name || name;
        phone = m.phone || phone;
        plan = m.plan || plan;
      }
    } else if (task.enquiryId) {
      const e = enquiries.find((x: any) => x.id === task.enquiryId);
      if (e) {
        name = e.name || name;
        phone = e.phone || phone;
        plan = e.plan || plan;
      }
    }

    if (!name || name === 'Member' || name === 'Unknown') {
      name = task.title ? task.title.replace('Membership Renewal:', '').replace('Followup:', '').replace('Follow-up', '').trim() : '';
    }

    return { 
      name: name || 'Gym Member', 
      phone: phone && phone !== 'N/A' ? phone : '9876543210', 
      plan: plan || 'Standard' 
    };
  };

  // Filter Logic based on Active Tab & Search/Dropdowns
  const filteredTasks = useMemo(() => {
    let result: FollowUpItem[] = [];

    if (isCustomDateFilterActive && filterStartDate && filterEndDate) {
      // When date range is explicitly selected, filter from all relevant tasks matching that date range
      const baseList = activeTab === 'history' 
        ? followups.filter(f => f.status === 'Completed' || f.status === 'Cancelled' || f.status === 'Lost')
        : followups.filter(f => f.status !== 'Completed' && f.status !== 'Cancelled' && f.status !== 'Lost');

      result = baseList.filter(f => {
        const itemDate = (f.dueDate || f.scheduledDate || f.date || '').split('T')[0];
        return itemDate >= filterStartDate && itemDate <= filterEndDate;
      });
    } else {
      if (activeTab === 'today') {
        result = todaysFollowups;
      } else if (activeTab === 'active') {
        result = activeFollowups;
      } else if (activeTab === 'overdue') {
        result = overdueFollowups;
      } else if (activeTab === 'history') {
        result = followups.filter(f => f.status === 'Completed' || f.status === 'Cancelled' || f.status === 'Lost');
      }
    }

    if (filterType !== 'All') {
      result = result.filter(f => f.type === filterType);
    }

    if (filterSource !== 'All') {
      result = result.filter(f => getFollowupSourceInfo(f).type === filterSource);
    }

    if (filterStaff !== 'All') {
      result = result.filter(f => f.assignedTo === filterStaff);
    }

    if (filterPriority !== 'All') {
      result = result.filter(f => (f.priority || '').toLowerCase() === filterPriority.toLowerCase());
    }

    if (searchQuery) {
      const sq = searchQuery.toLowerCase();
      result = result.filter(f => {
        const client = getClientDetails(f);
        return (
          client.name.toLowerCase().includes(sq) || 
          client.phone.includes(sq) || 
          (f.title || '').toLowerCase().includes(sq) ||
          (f.reason || '').toLowerCase().includes(sq) ||
          (f.notes || '').toLowerCase().includes(sq) ||
          (f.lastNote || '').toLowerCase().includes(sq)
        );
      });
    }

    return result;
  }, [
    activeTab, 
    todaysFollowups, 
    activeFollowups, 
    overdueFollowups, 
    followups, 
    isCustomDateFilterActive, 
    filterStartDate, 
    filterEndDate, 
    filterType, 
    filterSource,
    filterStaff, 
    filterPriority, 
    searchQuery, 
    members, 
    enquiries
  ]);

  // Select all handling
  useEffect(() => {
    if (selectAll) {
      setSelectedTasks(filteredTasks.map(t => t.id));
    } else {
      setSelectedTasks([]);
    }
  }, [selectAll, filteredTasks]);

  const toggleSelect = (id: string) => {
    setSelectedTasks(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const triggerConfetti = () => {
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
  };

  // ─── ACTION HANDLERS ───

  // 1. Complete Task
  const submitCompleteTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCompleteModal) return;
    
    const task = showCompleteModal;
    const targetId = task.id;
    const remarksLog = completeRemarks;
    const outcomeLog = completeOutcome;
    const memberIdLog = task.memberId;
    const enquiryIdLog = task.enquiryId;

    setShowCompleteModal(null);
    setCompleteRemarks('');
    setCompleteOutcome('Connected');
    setOpenActionDropdown(null);

    await completeFollowup(targetId, remarksLog, outcomeLog, memberIdLog, enquiryIdLog, task);
    toast.success('✓ Follow-Up completed');
    triggerConfetti();
  };

  // 2. Reschedule Task (Updates SAME record, no duplicate created)
  const openRescheduleDialog = (task: FollowUpItem) => {
    setOpenActionDropdown(null);
    const tomorrow = new Date(Date.now() + 86400000);
    const tomorrowStr = getTodayInIndia(tomorrow);
    setRescheduleDate(task.dueDate ? (task.dueDate > todayDateStr ? task.dueDate : tomorrowStr) : tomorrowStr);
    setRescheduleTime(task.scheduledTime || '10:00');
    setRescheduleReason('Customer requested later callback');
    setRescheduleNote('');
    setShowRescheduleModal(task);
  };

  const submitRescheduleTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showRescheduleModal || !rescheduleDate) {
      toast.error('Please select a new follow-up date');
      return;
    }

    setIsRescheduling(true);
    try {
      await rescheduleFollowup(
        showRescheduleModal,
        rescheduleDate,
        rescheduleTime || '10:00',
        rescheduleReason,
        rescheduleNote
      );
      toast.success('✓ Follow-Up rescheduled successfully');
      setShowRescheduleModal(null);
    } catch (err: any) {
      toast.error('✕ Unable to reschedule Follow-Up');
    } finally {
      setIsRescheduling(false);
    }
  };

  // 3. Add Note Action
  const openAddNoteDialog = (task: FollowUpItem) => {
    setOpenActionDropdown(null);
    setNewNoteText('');
    setNewNoteNextDate('');
    setNewNoteNextTime('');
    setShowAddNoteModal(task);
  };

  const submitAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showAddNoteModal || !newNoteText.trim()) {
      toast.error('Please enter a note');
      return;
    }

    setIsSavingNote(true);
    try {
      await addFollowupNote(
        showAddNoteModal,
        newNoteText.trim(),
        newNoteNextDate || undefined,
        newNoteNextTime || undefined
      );
      toast.success('✓ Note added successfully');
      setShowAddNoteModal(null);
    } catch (err: any) {
      toast.error('✕ Unable to save note');
    } finally {
      setIsSavingNote(false);
    }
  };

  // 4. Mark as Lost
  const openLostDialog = (task: FollowUpItem) => {
    setOpenActionDropdown(null);
    setLostReason('Not interested');
    setLostNote('');
    setShowLostModal(task);
  };

  const submitMarkLost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showLostModal) return;

    setIsSavingLost(true);
    try {
      const fullReason = lostNote.trim() ? `${lostReason}: ${lostNote.trim()}` : lostReason;
      await markFollowupLost(showLostModal, fullReason);
      toast.success('✓ Follow-Up marked as lost');
      setShowLostModal(null);
    } catch (err: any) {
      toast.error('✕ Unable to update Follow-Up');
    } finally {
      setIsSavingLost(false);
    }
  };

  // 5. Delete Task
  const confirmDeleteTask = async () => {
    if (!deleteConfirmTask) return;
    const targetId = deleteConfirmTask.id;
    setDeleteConfirmTask(null);
    try {
      await removeFollowup(targetId);
      setSelectedTasks(prev => prev.filter(x => x !== targetId));
      toast.success('✓ Follow-Up deleted');
    } catch (err) {
      toast.error('✕ Unable to delete task');
    }
  };

  // 6. Snooze Task
  const handleSnooze = async (task: FollowUpItem) => {
    setOpenActionDropdown(null);
    const { nextHourStr } = await snoozeFollowup(task);
    toast.success(`Task snoozed by 1 hour (Scheduled: ${nextHourStr})`, { icon: '⏰' });
  };

  // Bulk Actions
  const handleBulkComplete = async () => {
    try {
      toast.loading('Completing selected...', { id: 'bulk' });
      await Promise.allSettled(
        selectedTasks.map(id => completeFollowup(id, 'Bulk Completed', 'Connected'))
      );
      setSelectedTasks([]);
      toast.success('Selected tasks completed!', { id: 'bulk' });
      triggerConfetti();
    } catch (e) {
      toast.error('Failed to complete selected tasks.');
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete ${selectedTasks.length} selected tasks?`)) return;
    try {
      toast.loading('Deleting selected...', { id: 'bulk' });
      await Promise.allSettled(selectedTasks.map(id => removeFollowup(id)));
      setSelectedTasks([]);
      toast.success('Selected tasks deleted!', { id: 'bulk' });
    } catch (e) {
      toast.error('Failed to delete selected tasks.');
    }
  };

  return (
    <div className="space-y-6 pb-12 w-full text-slate-800 text-left font-sans">
      
      {/* 1. TOP HEADER & METRIC SUMMARY */}
      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
        
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-gradient-to-r from-[#EA580C] to-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-2xs">
              Task Engine v5.0
            </span>
            <span className="text-xs text-slate-400 font-mono font-bold">TWG-CRM</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900 font-display">
            Follow-Up Manager
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Manage automated renewals, lead callbacks, and staff-scheduled touchpoints
          </p>
        </div>

        {/* Schedule New Follow-up Button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="px-5 py-2.5 bg-[#EA580C] hover:bg-orange-700 text-white text-xs font-bold rounded-2xl transition-all shadow-md shadow-orange-500/20 flex items-center gap-2 border-none cursor-pointer shrink-0 self-start md:self-auto"
        >
          <Plus size={16} /> Schedule Follow-Up
        </button>
      </div>

      {/* 2. STATS CARDS BAR */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* Card 1: Today's Queue */}
        <div 
          onClick={() => { setActiveTab('today'); setIsCustomDateFilterActive(false); }}
          className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md ${
            activeTab === 'today' && !isCustomDateFilterActive ? 'border-[#EA580C] ring-2 ring-orange-500/10' : 'border-slate-200/80 hover:border-[#EA580C]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400 block tracking-wider">Today's Queue</span>
              <span className="text-2xl font-black text-slate-900 mt-1 block">{todaysCount}</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center font-bold">
              <Clock size={22} />
            </div>
          </div>
          <span className="text-[10px] text-[#EA580C] font-bold mt-2 block">
            {activeTab === 'today' && !isCustomDateFilterActive ? '● Showing Today\'s Queue' : 'Click to view today →'}
          </span>
        </div>

        {/* Card 2: Overdue Tasks */}
        <div 
          onClick={() => { setActiveTab('overdue'); setIsCustomDateFilterActive(false); }}
          className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md ${
            activeTab === 'overdue' && !isCustomDateFilterActive ? 'border-red-600 ring-2 ring-red-500/20' : 'border-slate-200/80 hover:border-red-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400 block tracking-wider">Overdue Tasks</span>
              <span className="text-2xl font-black text-red-600 mt-1 block">{overdueCount}</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
              <AlertTriangle size={22} />
            </div>
          </div>
          <span className="text-[10px] text-red-600 font-bold mt-2 block">
            {activeTab === 'overdue' && !isCustomDateFilterActive ? '● Showing Overdue Tasks' : 'Click to view overdue →'}
          </span>
        </div>

        {/* Card 3: Completed History */}
        <div 
          onClick={() => { setActiveTab('history'); setIsCustomDateFilterActive(false); }}
          className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md ${
            activeTab === 'history' && !isCustomDateFilterActive ? 'border-emerald-600 ring-2 ring-emerald-500/20' : 'border-slate-200/80 hover:border-emerald-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400 block tracking-wider">Completed History</span>
              <span className="text-2xl font-black text-emerald-600 mt-1 block">{completedTodayCount}</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 size={22} />
            </div>
          </div>
          <span className="text-[10px] text-emerald-600 font-bold mt-2 block">
            {activeTab === 'history' && !isCustomDateFilterActive ? '● Showing Completed History' : 'Click to view history →'}
          </span>
        </div>

        {/* Card 4: Total Active */}
        <div 
          onClick={() => { setActiveTab('active'); setIsCustomDateFilterActive(false); }}
          className={`bg-white p-5 rounded-2xl border transition-all cursor-pointer shadow-xs hover:shadow-md ${
            activeTab === 'active' && !isCustomDateFilterActive ? 'border-[#EA580C] ring-2 ring-orange-500/10' : 'border-slate-200/80 hover:border-[#EA580C]'
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400 block tracking-wider">Total Active</span>
              <span className="text-2xl font-black text-[#EA580C] mt-1 block">{totalActiveCount}</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center font-bold">
              <MessageSquare size={22} />
            </div>
          </div>
          <span className="text-[10px] text-[#EA580C] font-bold mt-2 block">
            {activeTab === 'active' && !isCustomDateFilterActive ? '● Showing All Active' : 'Click to view all active →'}
          </span>
        </div>
      </div>

      {/* 3. CLEAN FILTER BAR & SOURCE LEGEND */}
      <div className="space-y-3">
        {/* Source Legend */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-1">
          <div className="flex items-center gap-2.5 text-xs font-semibold text-slate-500 bg-white px-3.5 py-1.5 rounded-xl border border-slate-200/70 shadow-2xs w-fit">
            <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Source:</span>
            <span className="flex items-center gap-1.5">
              <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-[#FFF7ED] text-[#EA580C] border border-orange-200/60 flex items-center gap-1">
                <Sparkles size={9.5} className="shrink-0" /> AUTO
              </span>
              <span className="text-[11px] text-slate-600 font-medium hidden sm:inline">White Card · System generated</span>
            </span>
            <span className="text-slate-300">•</span>
            <span className="flex items-center gap-1.5">
              <span className="text-[9.5px] font-black px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/80 flex items-center gap-1">
                <PenLine size={9.5} className="shrink-0" /> MANUAL
              </span>
              <span className="text-[11px] text-slate-600 font-medium hidden sm:inline">Light Blue Card · Staff created</span>
            </span>
          </div>

          <span className="text-xs text-slate-400 font-medium hidden md:inline">
            Real-time synchronization with The Warrior Gym Cloud Engine
          </span>
        </div>

        {/* Filter Bar Controls */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 flex-1">
            {/* Search Box */}
            <div className="relative min-w-[200px] flex-1">
              <Search size={14} className="absolute left-3.5 top-3 text-slate-400" />
              <input 
                type="text" 
                placeholder="Search member name, phone, notes or reason..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs font-semibold text-slate-800 rounded-xl border border-slate-200 outline-none focus:border-[#F97316] transition-all placeholder-slate-400"
              />
            </div>

            {/* Date Range Picker */}
            <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <input 
                type="date" 
                value={filterStartDate}
                onChange={(e) => { setFilterStartDate(e.target.value); setIsCustomDateFilterActive(true); }}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
              />
              <span className="text-xs text-slate-400 font-bold">to</span>
              <input 
                type="date" 
                value={filterEndDate}
                onChange={(e) => { setFilterEndDate(e.target.value); setIsCustomDateFilterActive(true); }}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-transparent outline-none cursor-pointer"
              />
              {isCustomDateFilterActive && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomDateFilterActive(false);
                    setFilterStartDate(todayDateStr);
                    setFilterEndDate(todayDateStr);
                  }}
                  className="px-1.5 py-0.5 text-[10px] font-extrabold text-[#EA580C] hover:bg-orange-100 rounded-lg border-none cursor-pointer"
                  title="Reset to default"
                >
                  Reset
                </button>
              )}
            </div>

            {/* Source Filter Dropdown */}
            <select 
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 rounded-xl border border-slate-200 outline-none cursor-pointer focus:border-[#F97316]"
              value={filterSource} onChange={e => setFilterSource(e.target.value)}
            >
              <option value="All">All Sources</option>
              <option value="auto">✦ Auto Generated (White)</option>
              <option value="manual">✎ Staff Created (Light Blue)</option>
            </select>

            {/* Type Filter */}
            <select 
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 rounded-xl border border-slate-200 outline-none cursor-pointer focus:border-[#F97316]"
              value={filterType} onChange={e => setFilterType(e.target.value)}
            >
              <option value="All">All Types</option>
              <option value="GYM MEMBERSHIP RENEWAL">GYM MEMBERSHIP RENEWAL</option>
              <option value="PT RENEWAL">PT RENEWAL</option>
              <option value="PENDING BALANCE">PENDING BALANCE</option>
              <option value="Enquiry">Enquiry</option>
              <option value="General">General</option>
              <option value="Custom">Custom</option>
            </select>

            {/* Priority Filter */}
            <select 
              className="px-3 py-2 text-xs font-bold text-slate-700 bg-slate-50 rounded-xl border border-slate-200 outline-none cursor-pointer focus:border-[#F97316]"
              value={filterPriority} onChange={e => setFilterPriority(e.target.value)}
            >
              <option value="All">All Priority</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* 4. MAIN TASK LIST */}
      <div className="space-y-3">
        {filteredTasks.length > 0 && (
          <div className="flex items-center justify-between px-2 py-1">
            <div className="flex items-center gap-2">
              <input 
                type="checkbox" 
                checked={selectAll} 
                onChange={(e) => setSelectAll(e.target.checked)}
                className="w-4 h-4 rounded border-slate-300 text-[#EA580C] focus:ring-orange-200 cursor-pointer"
              />
              <span className="text-xs font-bold text-slate-600">
                Select All ({filteredTasks.length} tasks)
              </span>
            </div>
            {selectedTasks.length > 0 && (
              <span className="text-xs font-bold text-[#EA580C]">
                {selectedTasks.length} selected
              </span>
            )}
          </div>
        )}

        {filteredTasks.length === 0 ? (
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto font-bold">
              <Check size={24} />
            </div>
            <h3 className="text-base font-bold text-slate-800">
              {activeTab === 'today' ? "No Follow-ups Due Today" : "No Follow-up Tasks Found"}
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto font-medium">
              {activeTab === 'today' 
                ? "All caught up! There are currently no renewal or lead follow-ups due today." 
                : activeTab === 'history' 
                ? "No completed or lost follow-up records found." 
                : "No matching follow-up tasks for the selected view."}
            </p>
          </div>
        ) : (
          filteredTasks.map((task) => {
            const client = getClientDetails(task);
            const isSelected = selectedTasks.includes(task.id);
            const sourceInfo = getFollowupSourceInfo(task);
            const isManualCard = sourceInfo.type === 'manual';

            let typeBadgeClass = 'bg-slate-100 text-slate-700 border border-slate-200/80 font-bold';
            let displayReason = task.reason || task.description || task.notes || task.title || '';

            if (task.type === 'GYM MEMBERSHIP RENEWAL' || task.type === 'Renewal') {
              typeBadgeClass = 'bg-[#FFF7ED] text-[#9A3412] border border-orange-200/60 font-black';
              displayReason = displayReason || 'Membership renewal due in 7 days';
            } else if (task.type === 'PT RENEWAL' || task.type === 'PT') {
              typeBadgeClass = 'bg-purple-50 text-purple-800 border border-purple-200/80 font-black';
              displayReason = displayReason || 'Personal Training renewal due in 4 days';
            } else if (task.type === 'PENDING BALANCE' || task.type === 'Payment') {
              typeBadgeClass = 'bg-amber-50 text-amber-900 border border-amber-200/80 font-black';
              const pendingAmtStr = task.pendingAmount ? `₹${Number(task.pendingAmount).toLocaleString('en-IN')}` : '';
              displayReason = pendingAmtStr ? `${pendingAmtStr} pending` : (displayReason || 'Pending membership balance');
            } else if (task.type === 'Enquiry') {
              typeBadgeClass = 'bg-slate-100 text-slate-700 border border-slate-200/80 font-bold';
            }

            const normPriority = (task.priority || 'Medium').toLowerCase();
            const isHighPriority = normPriority === 'high' || normPriority === 'critical' || normPriority === 'urgent';
            const priorityBadgeClass = isHighPriority 
              ? 'bg-rose-50 text-rose-700 font-bold border border-rose-200' 
              : normPriority === 'medium'
              ? 'bg-[#FFF7ED] text-[#EA580C] font-bold border border-[#FED7AA]'
              : 'bg-slate-100 text-slate-600 font-medium border border-slate-200';

            const cleanDueDate = (task.dueDate || task.scheduledDate || '').split('T')[0];
            const isDueToday = cleanDueDate === todayDateStr;
            const isTaskOverdue = isOverdueInIndia(cleanDueDate);

            return (
              <motion.div
                key={task.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className={`rounded-2xl p-5 border transition-all shadow-xs hover:shadow-md relative ${
                  isManualCard
                    ? 'bg-[#F4F8FF] border-[#BFDBFE] border-l-4 border-l-[#EA580C]'
                    : 'bg-white border-slate-200/80 hover:border-slate-300'
                } ${isSelected ? 'ring-2 ring-blue-500' : ''}`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  
                  {/* Left: Checkbox + Client Avatar + Details */}
                  <div className="flex items-start md:items-center gap-3 flex-1 min-w-0">
                    <input 
                      type="checkbox" 
                      checked={isSelected}
                      onChange={() => toggleSelect(task.id)}
                      className="w-4 h-4 mt-1 md:mt-0 rounded border-slate-300 text-[#EA580C] focus:ring-orange-200 cursor-pointer shrink-0"
                    />

                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs shrink-0 ${
                      isManualCard 
                        ? 'bg-[#FFEDD5] text-[#EA580C] border border-[#FED7AA]' 
                        : 'bg-slate-100 text-slate-700 border border-slate-200'
                    }`}>
                      {client.name.substring(0, 2).toUpperCase()}
                    </div>

                    <div className="min-w-0 flex-1">
                      {/* Badge Hierarchy: [ TYPE ] [ ✦ AUTO / ✎ MANUAL ] [ PRIORITY ] */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-black text-slate-900 truncate">{client.name}</h3>
                        
                        {/* 1. Follow-Up Type Badge */}
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${typeBadgeClass}`}>
                          {task.type || 'General'}
                        </span>

                        {/* 2. Source Badge (✦ AUTO / ✎ MANUAL) */}
                        <span 
                          className={`text-[9.5px] font-black px-2 py-0.5 rounded-md flex items-center gap-1 uppercase tracking-wider ${sourceInfo.badgeClass}`}
                          title={sourceInfo.title}
                        >
                          {sourceInfo.type === 'auto' ? (
                            <Sparkles size={10} className="shrink-0 text-[#EA580C]" />
                          ) : (
                            <PenLine size={10} className="shrink-0 text-indigo-600" />
                          )}
                          <span>{sourceInfo.label}</span>
                        </span>

                        {/* 3. Priority Badge */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-md flex items-center gap-1 uppercase tracking-wider ${priorityBadgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${isHighPriority ? 'bg-rose-500' : 'bg-[#F97316]'}`} />
                          {task.priority || 'Medium'}
                        </span>

                        {task.status === 'Completed' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Completed
                          </span>
                        )}

                        {task.status === 'Lost' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
                            Lost
                          </span>
                        )}
                      </div>

                      {/* Display Reason */}
                      <p className="text-xs font-semibold text-slate-700 mt-1">
                        {displayReason}
                      </p>

                      <div className="flex items-center gap-3 text-xs text-slate-500 font-semibold mt-1 flex-wrap">
                        <a href={`tel:${client.phone}`} className="hover:text-[#EA580C] transition-colors flex items-center gap-1">
                          📞 {client.phone}
                        </a>
                        <span>•</span>
                        <span className={`flex items-center gap-1 font-bold ${isTaskOverdue ? 'text-rose-600' : isDueToday ? 'text-[#C2410C] font-black' : 'text-slate-700'}`}>
                          📅 {isDueToday ? 'Due Today' : `Due: ${formatIndianDate(cleanDueDate)}`} {task.scheduledTime ? `· ${task.scheduledTime}` : ''}
                        </span>
                        <span>•</span>
                        <span>Assigned: {task.assignedTo || 'Receptionist'}</span>
                      </div>

                      {/* Last Note Display on Card */}
                      {task.lastNote && (
                        <div className="mt-2.5 bg-white/90 p-2.5 rounded-xl border border-slate-200/80 text-xs text-slate-700 font-medium flex items-start gap-2 shadow-2xs">
                          <FileText size={13} className="text-[#EA580C] shrink-0 mt-0.5" />
                          <div>
                            <span className="font-bold text-slate-800">Last Note:</span> "{task.lastNote}"
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: Quick Action Buttons */}
                  <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
                    <a
                      href={`tel:${client.phone}`}
                      className="px-3 py-1.5 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 no-underline shadow-xs"
                    >
                      <Phone size={13} /> Call
                    </a>

                    <a
                      href={`https://wa.me/91${client.phone.replace(/[^0-9]/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 no-underline border border-emerald-200"
                    >
                      <MessageCircle size={13} /> WhatsApp
                    </a>

                    {task.status !== 'Completed' && task.status !== 'Lost' && (
                      <button
                        onClick={() => openRescheduleDialog(task)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-orange-50 text-slate-700 hover:text-[#C2410C] text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                      >
                        <Calendar size={13} /> Reschedule
                      </button>
                    )}

                    {task.status !== 'Completed' && task.status !== 'Lost' && (
                      <button
                        onClick={() => setShowCompleteModal(task)}
                        className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 border-none cursor-pointer shadow-xs"
                      >
                        <CheckCircle2 size={13} /> Complete
                      </button>
                    )}

                    {/* More Menu Dropdown */}
                    <div className="relative followup-action-menu-container">
                      <button 
                        onClick={() => setOpenActionDropdown(openActionDropdown === task.id ? null : task.id)}
                        className="p-2 rounded-xl hover:bg-slate-100 border border-slate-200 text-slate-500 cursor-pointer transition-colors bg-white"
                      >
                        <MoreVertical size={14} />
                      </button>

                      {openActionDropdown === task.id && (
                        <div className="absolute right-0 bottom-full mb-2 w-48 bg-white border border-slate-200 shadow-2xl rounded-2xl z-50 py-1.5 flex flex-col text-xs font-semibold text-left">
                          {task.status !== 'Completed' && task.status !== 'Lost' && (
                            <button 
                              onClick={() => openRescheduleDialog(task)} 
                              className="px-3.5 py-2 hover:bg-orange-50 text-slate-700 hover:text-[#C2410C] w-full transition-colors flex items-center gap-2.5 border-none cursor-pointer text-left"
                            >
                              <Calendar size={14} className="text-[#EA580C]"/> Reschedule
                            </button>
                          )}

                          <button 
                            onClick={() => openAddNoteDialog(task)} 
                            className="px-3.5 py-2 hover:bg-orange-50 text-slate-700 hover:text-[#C2410C] w-full transition-colors flex items-center gap-2.5 border-none cursor-pointer text-left"
                          >
                            <PenLine size={14} className="text-indigo-600"/> Add Note
                          </button>

                          <button 
                            onClick={() => { setOpenActionDropdown(null); setShowHistoryDrawer(task); }} 
                            className="px-3.5 py-2 hover:bg-orange-50 text-slate-700 hover:text-[#C2410C] w-full transition-colors flex items-center gap-2.5 border-none cursor-pointer text-left"
                          >
                            <History size={14} className="text-purple-600"/> View History
                          </button>

                          {task.status !== 'Completed' && task.status !== 'Lost' && (
                            <button 
                              onClick={() => handleSnooze(task)} 
                              className="px-3.5 py-2 hover:bg-slate-50 text-slate-700 w-full transition-colors flex items-center gap-2.5 border-none cursor-pointer text-left"
                            >
                              <Clock size={14} className="text-amber-600"/> Snooze 1 Hour
                            </button>
                          )}

                          {task.status !== 'Completed' && task.status !== 'Lost' && (
                            <button 
                              onClick={() => openLostDialog(task)} 
                              className="px-3.5 py-2 hover:bg-rose-50 text-rose-700 w-full transition-colors flex items-center gap-2.5 border-none cursor-pointer text-left"
                            >
                              <UserX size={14} className="text-rose-600"/> Mark as Lost
                            </button>
                          )}

                          <div className="h-px bg-slate-100 my-1" />

                          <button 
                            onClick={() => { setOpenActionDropdown(null); setDeleteConfirmTask(task); }} 
                            className="px-3.5 py-2 hover:bg-red-50 text-red-600 w-full transition-colors flex items-center gap-2.5 border-none cursor-pointer text-left font-bold"
                          >
                            <Trash2 size={14} className="text-red-500"/> Delete Task
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* 5. FLOATING BULK ACTIONS BAR */}
      <AnimatePresence>
        {selectedTasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[90] bg-slate-900 text-white rounded-2xl px-6 py-3.5 flex items-center gap-4 shadow-2xl"
          >
            <span className="text-xs font-bold text-[#FB923C]">
              ⚡ {selectedTasks.length} Tasks Selected
            </span>
            <div className="h-4 w-px bg-slate-700" />
            <button
              onClick={handleBulkComplete}
              className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl transition-all border-none cursor-pointer"
            >
              Mark Complete
            </button>
            <button
              onClick={handleBulkDelete}
              className="px-3.5 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-xl transition-all border-none cursor-pointer"
            >
              Delete
            </button>
            <button
              onClick={() => setSelectedTasks([])}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-all border-none cursor-pointer"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 6. RESCHEDULE MODAL ── */}
      <AnimatePresence>
        {showRescheduleModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-left"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Calendar className="text-[#EA580C]" size={18} /> Reschedule Follow-Up
                </h3>
                <button 
                  onClick={() => setShowRescheduleModal(null)} 
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 border-none cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Task Details Header */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Member:</span>
                  <span className="font-black text-slate-900">{getClientDetails(showRescheduleModal).name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Current Date:</span>
                  <span className="font-bold text-slate-700">{formatIndianDate(showRescheduleModal.dueDate || showRescheduleModal.scheduledDate)} · {showRescheduleModal.scheduledTime || '10:00'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Type:</span>
                  <span className="font-bold text-slate-700">{showRescheduleModal.type || 'General'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">Assigned:</span>
                  <span className="font-bold text-slate-700">{showRescheduleModal.assignedTo || 'Receptionist'}</span>
                </div>
              </div>

              <form onSubmit={submitRescheduleTask} className="space-y-3.5">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                      New Date <span className="text-[#EA580C]">*</span>
                    </label>
                    <input 
                      type="date" 
                      value={rescheduleDate}
                      onChange={(e) => setRescheduleDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                      New Time <span className="text-[#EA580C]">*</span>
                    </label>
                    <input 
                      type="time" 
                      value={rescheduleTime}
                      onChange={(e) => setRescheduleTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                    Reason for Rescheduling
                  </label>
                  <select
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer"
                  >
                    <option value="Customer requested later callback">Customer requested later callback</option>
                    <option value="Call not answered / Switched off">Call not answered / Switched off</option>
                    <option value="Requested callback after salary date">Requested callback after salary date</option>
                    <option value="Busy with work / Traveling">Busy with work / Traveling</option>
                    <option value="Asked for detailed plan over WhatsApp first">Asked for detailed plan over WhatsApp first</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                    Note / Remarks (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={rescheduleNote}
                    onChange={(e) => setRescheduleNote(e.target.value)}
                    placeholder="Enter conversation note..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 outline-none focus:border-[#F97316] resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setShowRescheduleModal(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border-none cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isRescheduling}
                    className="px-5 py-2 text-xs font-bold text-white bg-[#EA580C] hover:bg-orange-700 rounded-xl transition-all shadow-md shadow-orange-500/20 border-none cursor-pointer disabled:opacity-50"
                  >
                    {isRescheduling ? 'Rescheduling...' : 'Reschedule Follow-Up'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 7. ADD NOTE MODAL ── */}
      <AnimatePresence>
        {showAddNoteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-left"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <PenLine className="text-indigo-600" size={18} /> Add Follow-Up Note
                </h3>
                <button 
                  onClick={() => setShowAddNoteModal(null)} 
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 border-none cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs">
                <span className="font-bold text-slate-500">Member: </span>
                <span className="font-black text-slate-900">{getClientDetails(showAddNoteModal).name}</span>
              </div>

              <form onSubmit={submitAddNote} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                    Note <span className="text-[#EA580C]">*</span>
                  </label>
                  <textarea
                    rows={3}
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    placeholder="e.g. Customer asked to call after 6 PM. Interested in 3 month plan."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 outline-none focus:border-[#F97316] resize-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                      Next Follow-Up Date (Optional)
                    </label>
                    <input 
                      type="date" 
                      value={newNoteNextDate}
                      onChange={(e) => setNewNoteNextDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                      Next Time (Optional)
                    </label>
                    <input 
                      type="time" 
                      value={newNoteNextTime}
                      onChange={(e) => setNewNoteNextTime(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setShowAddNoteModal(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border-none cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSavingNote}
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-500/20 border-none cursor-pointer disabled:opacity-50"
                  >
                    {isSavingNote ? 'Saving...' : 'Save Note'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 8. MARK AS LOST MODAL ── */}
      <AnimatePresence>
        {showLostModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-left"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-black text-rose-600 flex items-center gap-2">
                  <UserX size={18} /> Mark Follow-Up as Lost
                </h3>
                <button 
                  onClick={() => setShowLostModal(null)} 
                  className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 border-none cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="text-xs text-slate-500">
                This task will be moved to History as <strong>Lost</strong>. The record and timeline will remain intact.
              </p>

              <form onSubmit={submitMarkLost} className="space-y-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                    Reason <span className="text-rose-600">*</span>
                  </label>
                  <select
                    value={lostReason}
                    onChange={(e) => setLostReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-rose-600 cursor-pointer"
                  >
                    <option value="Customer not interested">Customer not interested</option>
                    <option value="Price / Budget too high">Price / Budget too high</option>
                    <option value="Joined another gym">Joined another gym</option>
                    <option value="Relocated / Moved out of city">Relocated / Moved out of city</option>
                    <option value="Medical / Health reason">Medical / Health reason</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                    Additional Details
                  </label>
                  <textarea
                    rows={2}
                    value={lostNote}
                    onChange={(e) => setLostNote(e.target.value)}
                    placeholder="Enter reason details..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 outline-none focus:border-rose-600 resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button 
                    type="button" 
                    onClick={() => setShowLostModal(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border-none cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSavingLost}
                    className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition-all shadow-md shadow-rose-500/20 border-none cursor-pointer disabled:opacity-50"
                  >
                    {isSavingLost ? 'Saving...' : 'Mark Lost'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 9. COMPLETE TASK MODAL ── */}
      <AnimatePresence>
        {showCompleteModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4 text-left"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <CheckCircle2 className="text-emerald-500" size={18} /> Complete Follow-Up
                </h3>
                <button onClick={() => setShowCompleteModal(null)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 border-none cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs">
                <span className="font-bold text-slate-500">Member: </span>
                <span className="font-black text-slate-900">{getClientDetails(showCompleteModal).name}</span>
              </div>

              <form onSubmit={submitCompleteTask} className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                    Call / Conversation Outcome <span className="text-[#EA580C]">*</span>
                  </label>
                  <select
                    value={completeOutcome}
                    onChange={e => setCompleteOutcome(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer"
                  >
                    <option value="Connected">Connected · Positive</option>
                    <option value="Membership Renewed">Membership Renewed / Purchased</option>
                    <option value="Interested - Follow Up Later">Interested - Follow Up Later</option>
                    <option value="Busy / Call Later">Busy / Call Later</option>
                    <option value="No Answer / Switched Off">No Answer / Switched Off</option>
                    <option value="Not Interested">Not Interested</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block">
                    Completion Remarks / Note
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Enter details of conversation..."
                    value={completeRemarks}
                    onChange={e => setCompleteRemarks(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-semibold text-slate-800 outline-none focus:border-[#F97316] resize-none"
                  />
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCompleteModal(null)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border-none cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-500 hover:bg-emerald-600 rounded-xl transition-all shadow-md shadow-emerald-500/20 border-none cursor-pointer"
                  >
                    Mark as Completed
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 10. DELETE CONFIRMATION DIALOG ── */}
      <AnimatePresence>
        {deleteConfirmTask && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-slate-200 space-y-4 text-left"
            >
              <div className="flex items-center gap-3 text-red-600">
                <div className="w-10 h-10 rounded-2xl bg-red-50 flex items-center justify-center font-bold shrink-0">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">Delete Follow-Up?</h3>
                  <p className="text-xs text-slate-500 font-medium">This will remove the active task.</p>
                </div>
              </div>

              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-2xl border border-slate-200/80">
                Are you sure you want to delete follow-up for <strong>{getClientDetails(deleteConfirmTask).name}</strong>?
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteConfirmTask(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border-none cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteTask}
                  className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all shadow-md shadow-red-500/20 border-none cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 11. RIGHT-SIDE HISTORY TIMELINE DRAWER ── */}
      <AnimatePresence>
        {showHistoryDrawer && (
          <div className="fixed inset-0 z-[100] flex justify-end bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, x: '100%' }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="bg-white w-full sm:w-[480px] h-full shadow-2xl border-l border-slate-200 flex flex-col text-left relative overflow-hidden"
            >
              {/* Drawer Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center font-bold border border-[#FED7AA]">
                    <History size={20} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-slate-900">Follow-Up History</h2>
                    <p className="text-xs text-slate-500 font-medium">Complete chronological activity timeline</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowHistoryDrawer(null)}
                  className="p-2 rounded-xl text-slate-400 hover:bg-slate-100 border-none cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Task Summary Card */}
              <div className="p-6 pb-2">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-black text-slate-900">{getClientDetails(showHistoryDrawer).name}</h3>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-md border ${
                      showHistoryDrawer.status === 'Completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      showHistoryDrawer.status === 'Lost' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                      'bg-[#FFF7ED] text-[#EA580C] border-[#FED7AA]'
                    }`}>
                      {showHistoryDrawer.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-1 border-t border-slate-200/60">
                    <div>
                      <span className="font-medium text-slate-400 block text-[10px]">Phone</span>
                      <span className="font-bold">{getClientDetails(showHistoryDrawer).phone}</span>
                    </div>
                    <div>
                      <span className="font-medium text-slate-400 block text-[10px]">Type</span>
                      <span className="font-bold">{showHistoryDrawer.type || 'General'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-slate-400 block text-[10px]">Assigned Staff</span>
                      <span className="font-bold">{showHistoryDrawer.assignedTo || 'Receptionist'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-slate-400 block text-[10px]">Current Due Date</span>
                      <span className="font-bold">{formatIndianDate(showHistoryDrawer.dueDate || showHistoryDrawer.scheduledDate)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chronological Timeline */}
              <div className="flex-1 overflow-y-auto p-6 pt-2 space-y-4 custom-scrollbar">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                  Activity Timeline
                </div>

                <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                  {(() => {
                    const rawEvents: FollowUpHistoryEvent[] = Array.isArray(showHistoryDrawer.history) && showHistoryDrawer.history.length > 0
                      ? [...showHistoryDrawer.history]
                      : [
                          {
                            id: 'init_event',
                            eventType: 'CREATED',
                            timestamp: showHistoryDrawer.createdAt || new Date().toISOString(),
                            performedBy: showHistoryDrawer.createdBy || (showHistoryDrawer.source === 'auto' || showHistoryDrawer.source === 'automatic' ? 'System Engine' : 'Staff'),
                            note: showHistoryDrawer.notes || showHistoryDrawer.description || showHistoryDrawer.reason || 'Follow-up created'
                          }
                        ];

                    return rawEvents.map((evt, idx) => {
                      const eventType = (evt.eventType || 'NOTE_ADDED').toUpperCase();
                      const dateStr = evt.timestamp ? new Date(evt.timestamp).toLocaleString('en-IN', {
                        day: '2-digit', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit', hour12: true
                      }) : '';

                      let nodeIcon = <Sparkles size={11} className="text-[#EA580C]" />;
                      let nodeBg = 'bg-[#FFEDD5] border-[#FDBA74]';
                      let nodeTitle = 'Activity';

                      if (eventType === 'CREATED') {
                        nodeIcon = <Sparkles size={11} className="text-[#EA580C]" />;
                        nodeBg = 'bg-[#FFEDD5] border-[#FDBA74]';
                        nodeTitle = 'Follow-Up Created';
                      } else if (eventType === 'RESCHEDULED') {
                        nodeIcon = <Calendar size={11} className="text-indigo-600" />;
                        nodeBg = 'bg-indigo-100 border-indigo-300';
                        nodeTitle = 'Rescheduled';
                      } else if (eventType === 'NOTE_ADDED') {
                        nodeIcon = <PenLine size={11} className="text-amber-600" />;
                        nodeBg = 'bg-amber-100 border-amber-300';
                        nodeTitle = 'Note Added';
                      } else if (eventType === 'COMPLETED') {
                        nodeIcon = <CheckCircle2 size={11} className="text-emerald-600" />;
                        nodeBg = 'bg-emerald-100 border-emerald-300';
                        nodeTitle = 'Completed';
                      } else if (eventType === 'LOST') {
                        nodeIcon = <UserX size={11} className="text-rose-600" />;
                        nodeBg = 'bg-rose-100 border-rose-300';
                        nodeTitle = 'Marked as Lost';
                      }

                      return (
                        <div key={evt.id || idx} className="relative group">
                          {/* Circle on line */}
                          <div className={`absolute -left-[27px] top-1 w-5 h-5 rounded-full border flex items-center justify-center bg-white ${nodeBg} shadow-2xs`}>
                            {nodeIcon}
                          </div>

                          <div className="bg-slate-50/80 p-3.5 rounded-2xl border border-slate-200/80 space-y-1.5 hover:bg-slate-100/80 transition-colors">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-slate-900">{nodeTitle}</span>
                              <span className="text-[10.5px] font-medium text-slate-400 font-mono">{dateStr}</span>
                            </div>

                            {/* Reschedule Diff */}
                            {evt.oldValue && evt.newValue && (
                              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 bg-white p-2 rounded-xl border border-slate-200/70">
                                <span>{evt.oldValue}</span>
                                <ArrowRight size={12} className="text-indigo-600" />
                                <span className="text-indigo-700">{evt.newValue}</span>
                              </div>
                            )}

                            {/* Reason */}
                            {evt.reason && (
                              <p className="text-xs text-slate-600 font-medium">
                                <span className="font-bold text-slate-700">Reason:</span> {evt.reason}
                              </p>
                            )}

                            {/* Note */}
                            {evt.note && (
                              <p className="text-xs text-slate-700 bg-white/80 p-2 rounded-xl border border-slate-200/60 font-medium">
                                "{evt.note}"
                              </p>
                            )}

                            {/* Performed by */}
                            {evt.performedBy && (
                              <p className="text-[10px] font-bold text-slate-400">
                                By: <span className="text-slate-600">{evt.performedBy}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-end">
                <button
                  onClick={() => setShowHistoryDrawer(null)}
                  className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl border-none cursor-pointer"
                >
                  Close History
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 12. SCHEDULE NEW FOLLOW-UP MODAL ── */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Calendar className="text-[#EA580C]" size={18} /> Schedule New Follow-Up
                </h3>
                <button onClick={() => setShowAddModal(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 border-none cursor-pointer">
                  <X size={16} />
                </button>
              </div>

              <AddFollowUpWizardForm 
                members={members} 
                employees={employees}
                createFollowup={createFollowup}
                onClose={() => setShowAddModal(false)} 
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

// ── Searchable Member Select Subcomponent ──
function SearchableMemberSelect({ members, selectedMemberId, onSelect }: { members: any[]; selectedMemberId: string; onSelect: (m: any) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  const selected = members.find((m: any) => (m.id === selectedMemberId || m.memberId === selectedMemberId));

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return members.slice(0, 30);
    const q = search.toLowerCase();
    return members.filter((m: any) => {
      const name = (m.name || m.fullName || '').toLowerCase();
      const phone = (m.phone || '').replace(/\D/g, '');
      const id = (m.memberId || m.id || '').toLowerCase();
      return name.includes(q) || phone.includes(q) || id.includes(q);
    }).slice(0, 30);
  }, [members, search]);

  return (
    <div ref={wrapperRef} className="relative w-full">
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-800 flex items-center justify-between cursor-pointer focus:border-[#F97316]"
      >
        <span className={selected ? 'text-slate-900 font-bold' : 'text-slate-400'}>
          {selected ? `${selected.name || 'Member'} (${selected.phone || 'No Phone'})` : 'Select a member...'}
        </span>
        <MoreVertical size={14} className="text-slate-400" />
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 shadow-2xl rounded-2xl z-50 p-2 space-y-2 max-h-60 overflow-y-auto">
          <input 
            type="text" 
            placeholder="Type name, phone or member ID..." 
            value={search} 
            onChange={e => setSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold outline-none focus:border-[#F97316]"
            autoFocus
          />
          <div className="divide-y divide-slate-100 max-h-44 overflow-y-auto custom-scrollbar">
            {filtered.map((m: any) => (
              <div 
                key={m.id || m.memberId}
                onClick={() => { onSelect(m); setIsOpen(false); }}
                className="p-2 hover:bg-orange-50 text-xs font-bold text-slate-800 cursor-pointer rounded-xl flex items-center justify-between"
              >
                <span>{m.name || 'Unnamed'}</span>
                <span className="text-slate-400 text-[11px] font-mono">{m.phone || m.memberId}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add Follow-up Form Subcomponent ──
const REASON_OPTIONS = [
  'Membership Renewal',
  'Pending Balance Collection',
  'Personal Training Inquiry / Renewal',
  'Diet & Nutrition Check-in',
  'Workout Plan & Progress Review',
  'Member Attendance Follow-up',
  'General Inquiry / Callback',
  'Custom'
];

function AddFollowUpWizardForm({ 
  members, 
  employees,
  createFollowup, 
  onClose 
}: { 
  members: any[]; 
  employees: any[];
  createFollowup: (d: any) => Promise<any>; 
  onClose: () => void;
}) {
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [reason, setReason] = useState(REASON_OPTIONS[0]);
  const [customReason, setCustomReason] = useState('');
  const [date, setDate] = useState(() => {
    const tomorrow = new Date(Date.now() + 86400000);
    return getTodayInIndia(tomorrow);
  });
  const [time, setTime] = useState('10:00');
  const [priority, setPriority] = useState('Medium');
  const [assignedTo, setAssignedTo] = useState('Receptionist');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const staffOptions = useMemo(() => {
    const list = employees.map((e: any) => e.name || e.fullName).filter(Boolean);
    const combined = ['Receptionist', 'Manager', 'Tanya Mehra', ...list];
    return Array.from(new Set(combined));
  }, [employees]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors({});

    const finalReason = reason === 'Custom' ? customReason.trim() : reason;
    const memberId = selectedMember?.id || selectedMember?.memberId || '';
    const memberName = selectedMember?.name || selectedMember?.fullName || 'Client';
    const phone = selectedMember?.phone || '9876543210';

    const result = followUpFormSchema.safeParse({
      memberId,
      reason: finalReason,
      date,
      time,
      priority
    });

    if (!result.success) {
      const errMap: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const fieldName = issue.path[0] as string;
        errMap[fieldName] = issue.message;
      });
      setFormErrors(errMap);
      return;
    }

    setIsSubmitting(true);
    try {
      const ts = new Date(`${date}T${time}:00+05:30`).getTime() || Date.now();
      const operationId = `fol_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

      let followUpType = 'General';
      if (finalReason === 'Membership Renewal' || finalReason.includes('Renewal') || finalReason.includes('Membership')) {
        followUpType = 'GYM MEMBERSHIP RENEWAL';
      } else if (finalReason.includes('Personal Training') || finalReason.includes('PT')) {
        followUpType = 'PT RENEWAL';
      } else if (finalReason.includes('Balance') || finalReason.includes('Payment')) {
        followUpType = 'PENDING BALANCE';
      }

      const payload = {
        id: operationId,
        memberId,
        memberName,
        phone,
        priority: priority as any,
        title: finalReason,
        reason: finalReason,
        notes: `Follow-up for ${memberName}: ${finalReason}`,
        description: `Follow-up for ${memberName}: ${finalReason}`,
        lastNote: `Follow-up scheduled: ${finalReason}`,
        assignedTo,
        dueDate: date,
        scheduledDate: date,
        scheduledTime: time,
        scheduledTimestamp: ts,
        status: 'Pending' as const,
        type: followUpType,
        source: 'manual' as const,
        createdAt: new Date().toISOString(),
        history: [
          {
            id: `evt_init_${operationId}`,
            eventType: 'CREATED',
            timestamp: new Date().toISOString(),
            performedBy: 'Staff',
            note: `Follow-up scheduled: ${finalReason}`
          }
        ]
      };

      const createFn = createFollowup || followupService.create;
      await createFn(payload);

      toast.success('✓ Manual follow-up scheduled successfully');
      onClose();
    } catch (err: any) {
      toast.error('Failed to schedule follow-up: ' + (err.response?.data?.error || err.message || 'Error occurred'));
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-6 space-y-4 text-left">
      {/* 1. Member Selector */}
      <div>
        <label className="text-xs font-bold text-slate-700 mb-1.5 block">
          Member <span className="text-[#EA580C]">*</span>
        </label>
        <SearchableMemberSelect 
          members={members} 
          selectedMemberId={selectedMember?.id || selectedMember?.memberId || ''} 
          onSelect={(m) => { setSelectedMember(m); if (formErrors.memberId) setFormErrors(prev => ({ ...prev, memberId: '' })); }} 
        />
        {formErrors.memberId && (
          <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1">
            <AlertCircle size={12} /> {formErrors.memberId}
          </p>
        )}
      </div>

      {/* 2. Reason */}
      <div>
        <label className="text-xs font-bold text-slate-700 mb-1.5 block">
          Reason <span className="text-[#EA580C]">*</span>
        </label>
        <select 
          value={reason} 
          onChange={e => { setReason(e.target.value); if (formErrors.reason) setFormErrors(prev => ({ ...prev, reason: '' })); }} 
          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer"
        >
          {REASON_OPTIONS.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>

        {reason === 'Custom' && (
          <input 
            type="text" 
            placeholder="Enter custom follow-up reason..." 
            value={customReason} 
            onChange={e => { setCustomReason(e.target.value); if (formErrors.reason) setFormErrors(prev => ({ ...prev, reason: '' })); }} 
            className={`w-full mt-2 bg-slate-50 border ${formErrors.reason ? 'border-red-500' : 'border-slate-200'} rounded-xl px-4 py-2 text-xs font-semibold text-slate-800 outline-none focus:border-[#F97316]`}
          />
        )}

        {formErrors.reason && (
          <p className="text-[11px] font-semibold text-red-500 mt-1 flex items-center gap-1">
            <AlertCircle size={12} /> {formErrors.reason}
          </p>
        )}
      </div>

      {/* 3. Schedule Date & Time */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-slate-700 mb-1.5 block">
            Date <span className="text-[#EA580C]">*</span>
          </label>
          <input 
            type="date" 
            value={date} 
            onChange={e => { setDate(e.target.value); if (formErrors.date) setFormErrors(prev => ({ ...prev, date: '' })); }} 
            className={`w-full bg-slate-50 border ${formErrors.date ? 'border-red-500' : 'border-slate-200'} rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer`}
          />
        </div>
        <div>
          <label className="text-xs font-bold text-slate-700 mb-1.5 block">
            Time <span className="text-[#EA580C]">*</span>
          </label>
          <input 
            type="time" 
            value={time} 
            onChange={e => { setTime(e.target.value); if (formErrors.time) setFormErrors(prev => ({ ...prev, time: '' })); }} 
            className={`w-full bg-slate-50 border ${formErrors.time ? 'border-red-500' : 'border-slate-200'} rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer`}
          />
        </div>
      </div>

      {/* 4. Priority & Assigned Staff */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-bold text-slate-700 mb-1.5 block">
            Priority <span className="text-[#EA580C]">*</span>
          </label>
          <select 
            value={priority} 
            onChange={e => setPriority(e.target.value as any)} 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer"
          >
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
            <option value="Urgent">Urgent</option>
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-slate-700 mb-1.5 block">Assigned Staff</label>
          <select 
            value={assignedTo} 
            onChange={e => setAssignedTo(e.target.value)} 
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#F97316] cursor-pointer"
          >
            {staffOptions.map(staff => (
              <option key={staff} value={staff}>{staff}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 5. Action Buttons */}
      <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
        <button 
          type="button" 
          onClick={onClose} 
          className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors border-none cursor-pointer"
        >
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={isSubmitting}
          className="px-6 py-2 text-xs font-bold text-white bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] rounded-xl transition-all shadow-md shadow-orange-500/20 border-none cursor-pointer disabled:opacity-50"
        >
          {isSubmitting ? 'Scheduling...' : 'Schedule Follow-Up'}
        </button>
      </div>
    </form>
  );
}
