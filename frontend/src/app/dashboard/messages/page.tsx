'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, Mail, Phone, Calendar, Search, Trash2, 
  CheckCircle2, Clock, User, Target, Send, CheckCheck,
  Sparkles, RefreshCw, ChevronRight, AlertCircle, Eye, EyeOff,
  MoreHorizontal, ArrowLeft, ExternalLink, ShieldCheck, Check,
  SlidersHorizontal, X
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import toast from '@/lib/toast';
import { resolveAvatarUrl, MALE_DEFAULT_AVATAR, FEMALE_DEFAULT_AVATAR } from '@/lib/avatar';
import { formatIndianDate } from '@/lib/dateUtils';

interface WebMessage {
  id: string;
  name: string;
  phone: string;
  email?: string;
  message?: string;
  goal?: string;
  status?: 'Unread' | 'Read' | 'Responded' | string;
  source?: string;
  createdAt?: string;
  updatedAt?: string;
  gender?: string;
}

export default function WebMessagesPage() {
  const [messages, setMessages] = useState<WebMessage[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [goalFilter, setGoalFilter] = useState('All');
  const [selectedMessage, setSelectedMessage] = useState<WebMessage | null>(null);

  // Quick Tab Filter State
  const [activeTab, setActiveTab] = useState<'All' | 'Unread' | 'Read' | 'Responded'>('All');

  // Custom Delete Modal State (NO window.confirm)
  const [deleteTarget, setDeleteTarget] = useState<WebMessage | null>(null);
  const [deletingMessage, setDeletingMessage] = useState(false);

  // Actions Portal Menu State
  const [actionsMenu, setActionsMenu] = useState<{ message: WebMessage; rect: DOMRect } | null>(null);

  // Direct Reply Drawer/Modal State
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);

  // Close floating actions menu on outside click or scroll
  useEffect(() => {
    if (!actionsMenu) return;
    const handleClose = (e: MouseEvent | Event) => {
      const target = e.target as HTMLElement;
      if (target?.closest('.message-actions-portal-menu')) return;
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

  // Realtime Firestore Listener & LocalStorage Sync
  useEffect(() => {
    let unsub = () => {};
    // Load local cache first
    try {
      const cached = localStorage.getItem('warriorgym_messages') || localStorage.getItem('alphazone_messages');
      if (cached) setMessages(JSON.parse(cached));
    } catch (e) {}

    try {
      const q = query(collection(db, 'messages'), orderBy('createdAt', 'desc'));
      unsub = onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as WebMessage));
        setMessages(data);
        try { localStorage.setItem('warriorgym_messages', JSON.stringify(data)); } catch (e) {}
        setLoading(false);
      }, (err) => {
        console.warn("Firestore permissions note:", err.message);
        setLoading(false);
      });
    } catch (e: any) {
      console.warn("Firestore listener note:", e.message);
      setLoading(false);
    }
    return () => unsub();
  }, []);

  // Filtered Messages logic
  const filteredMessages = useMemo(() => {
    return messages.filter(msg => {
      // Tab filter
      if (activeTab === 'Unread' && (msg.status !== 'Unread' && msg.status)) return false;
      if (activeTab === 'Read' && msg.status !== 'Read') return false;
      if (activeTab === 'Responded' && msg.status !== 'Responded') return false;

      // Status dropdown filter
      if (statusFilter !== 'All') {
        if (statusFilter === 'Unread' && (msg.status !== 'Unread' && msg.status)) return false;
        if (statusFilter === 'Read' && msg.status !== 'Read') return false;
        if (statusFilter === 'Responded' && msg.status !== 'Responded') return false;
      }

      // Goal filter
      if (goalFilter !== 'All' && msg.goal?.toLowerCase() !== goalFilter.toLowerCase()) return false;

      // Search filter
      const q = searchQuery.toLowerCase();
      const matchesSearch = !searchQuery || 
        (msg.name || '').toLowerCase().includes(q) ||
        (msg.phone || '').includes(q) ||
        (msg.email || '').toLowerCase().includes(q) ||
        (msg.goal || '').toLowerCase().includes(q) ||
        (msg.message || '').toLowerCase().includes(q);

      return matchesSearch;
    });
  }, [messages, activeTab, statusFilter, goalFilter, searchQuery]);

  // Extract unique goals dynamically from messages
  const dynamicGoals = useMemo(() => {
    const goalsFromData = messages.map(m => m.goal?.trim()).filter(Boolean) as string[];
    const defaults = ['Weight Loss', 'Muscle Gain', 'General Fitness', 'Personal Training'];
    return Array.from(new Set([...defaults, ...goalsFromData])).filter(Boolean);
  }, [messages]);

  // Status updates
  const handleUpdateStatus = async (id: string, newStatus: string) => {
    // 1. Optimistically update local state & LocalStorage
    setMessages(prev => {
      const updated = prev.map(m => m.id === id ? { ...m, status: newStatus } : m);
      try { localStorage.setItem('warriorgym_messages', JSON.stringify(updated)); } catch (e) {}
      return updated;
    });
    if (selectedMessage && selectedMessage.id === id) {
      setSelectedMessage((prev) => (prev ? { ...prev, status: newStatus } : null));
    }
    toast.success(`Message marked as ${newStatus}`);

    // 2. Try updating Firestore
    try {
      await updateDoc(doc(db, 'messages', id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
    } catch (err: any) {
      console.warn('Firestore update permission note: ' + err.message);
    }
  };

  // Custom Delete Handler (NO window.confirm)
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingMessage(true);
    const id = deleteTarget.id;
    
    // Optimistic delete
    setMessages(prev => {
      const filtered = prev.filter(m => m.id !== id);
      try { localStorage.setItem('warriorgym_messages', JSON.stringify(filtered)); } catch (e) {}
      return filtered;
    });
    if (selectedMessage?.id === id) setSelectedMessage(null);
    setDeleteTarget(null);
    toast.success('Message deleted successfully');

    try {
      await deleteDoc(doc(db, 'messages', id));
    } catch (err: any) {
      console.warn('Firestore delete permission note: ' + err.message);
    } finally {
      setDeletingMessage(false);
    }
  };

  // Open WhatsApp
  const handleOpenWhatsApp = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const text = encodeURIComponent(`Hi ${name}, thank you for reaching out to The Warrior Gym! How can we assist you with your fitness goals?`);
    window.open(`https://wa.me/${formattedPhone}?text=${text}`, '_blank');
  };

  // Handle Send Reply Modal Submit
  const handleSendReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMessage || !replyText.trim()) return;
    setSendingReply(true);

    try {
      // Mark as responded
      await handleUpdateStatus(selectedMessage.id, 'Responded');
      
      // WhatsApp launch with custom text
      const cleanPhone = selectedMessage.phone.replace(/\D/g, '');
      const formattedPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
      const text = encodeURIComponent(`Hi ${selectedMessage.name},\n\n${replyText.trim()}\n\n— The Warrior Gym Team`);
      window.open(`https://wa.me/${formattedPhone}?text=${text}`, '_blank');
      
      toast.success('Reply dispatched via WhatsApp!');
      setReplyModalOpen(false);
      setReplyText('');
    } catch (err: any) {
      toast.error('Failed to send reply: ' + err.message);
    } finally {
      setSendingReply(false);
    }
  };

  // Stats calculation
  const totalCount = messages.length;
  const unreadCount = messages.filter(m => m.status === 'Unread' || !m.status).length;
  const respondedCount = messages.filter(m => m.status === 'Responded').length;
  const todayCount = messages.filter(m => {
    if (!m.createdAt) return false;
    const msgDate = new Date(m.createdAt).toDateString();
    return msgDate === new Date().toDateString();
  }).length;

  // Format relative/short time
  const formatMsgTime = (dateStr?: string) => {
    if (!dateStr) return 'Just now';
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins} min ago`;
      if (diffHours < 24) return `${diffHours} hr ago`;
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    } catch (e) {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 pb-12 w-full text-slate-800 text-left font-sans">
      
      {/* ── 1. PAGE HEADER (Aligned with Members & Employees) ── */}
      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
        
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="px-3 py-1 bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#C2410C] text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">
              Inbound CRM Engine
            </span>
            <span className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/60 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full shadow-2xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE
            </span>
            <span className="text-xs text-slate-400 font-mono font-bold">TWG-MSG-v4.0</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900 font-display">Website Messages</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Manage inbound website enquiries, contact messages and responses.</p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap shrink-0">
          <button 
            onClick={() => {
              setSearchQuery('');
              setStatusFilter('All');
              setGoalFilter('All');
              setActiveTab('All');
            }}
            className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-2xl transition-all flex items-center gap-1.5 border border-slate-200 cursor-pointer shadow-2xs"
          >
            <RefreshCw size={14} /> Reset Filters
          </button>
        </div>
      </div>

      {/* ── 2. SUMMARY METRICS CARDS (Exact Members/Employees KPI Language) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Inquiries', value: totalCount, sub: 'All website submissions', icon: MessageSquare, badgeBg: 'bg-[#FFF7ED] border-[#FED7AA] text-[#EA580C]' },
          { label: 'Unread Pending', value: unreadCount, sub: 'Awaiting first response', icon: AlertCircle, badgeBg: 'bg-amber-50 border-amber-200/60 text-amber-600' },
          { label: 'Responded', value: respondedCount, sub: 'Successfully answered', icon: CheckCheck, badgeBg: 'bg-emerald-50 border-emerald-200/60 text-emerald-600' },
          { label: 'New Today', value: todayCount, sub: 'Received today', icon: Clock, badgeBg: 'bg-[#FFF7ED] border-orange-200/60 text-[#EA580C]' }
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

      {/* ── 3. SEARCH & FILTERS BAR (Unified with Enquiries & Employees) ── */}
      <div className="bg-white border border-[#FED7AA] rounded-3xl p-4 flex flex-wrap gap-4 items-center shadow-[0_4px_20px_rgba(234,88,12,0.02)]">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, email or message..."
            className="w-full text-xs bg-[#fdfdfd] border border-[#FED7AA] rounded-2xl pl-11 pr-4 py-3 focus:outline-none focus:border-[#EA580C] focus:bg-white transition-all text-[#10233f] font-semibold placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap gap-2.5 items-center">
          {/* Status Filter Dropdown */}
          <select 
            value={statusFilter}
            onChange={e => {
              setStatusFilter(e.target.value);
              setActiveTab(e.target.value as any);
            }}
            className="text-xs bg-[#fdfdfd] border border-[#FED7AA] rounded-2xl px-4 py-3 text-[#10233f] focus:outline-none font-bold cursor-pointer hover:bg-white transition-all"
          >
            <option value="All">All Statuses</option>
            <option value="Unread">Unread</option>
            <option value="Read">Read</option>
            <option value="Responded">Responded</option>
          </select>

          {/* Goal Filter Dropdown */}
          <select 
            value={goalFilter}
            onChange={e => setGoalFilter(e.target.value)}
            className="text-xs bg-[#fdfdfd] border border-[#FED7AA] rounded-2xl px-4 py-3 text-[#10233f] focus:outline-none font-bold cursor-pointer hover:bg-white transition-all"
          >
            <option value="All">All Goals</option>
            {dynamicGoals.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>

          {/* Quick Filter Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 text-xs font-bold">
            {(['All', 'Unread', 'Read', 'Responded'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => {
                  setActiveTab(tab);
                  setStatusFilter(tab);
                }}
                className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer border-none ${
                  activeTab === tab 
                    ? 'bg-[#EA580C] text-white shadow-xs font-extrabold' 
                    : 'text-slate-600 hover:text-slate-900 bg-transparent'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── 4. MAIN WORKSPACE (2-COLUMN CRM: 40% LIST + 60% DETAILS) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: Inbound Messages List (5 of 12 cols on desktop) */}
        <div className={`lg:col-span-5 ${selectedMessage ? 'hidden lg:block' : 'block'}`}>
          <div className="bg-white border border-[#FED7AA] rounded-3xl overflow-hidden shadow-[0_4px_25px_rgba(234,88,12,0.03)] flex flex-col">
            
            {/* List Header */}
            <div className="p-4 bg-slate-50/60 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-xs uppercase tracking-wider text-slate-800">Inbound Messages</span>
                <span className="px-2 py-0.5 rounded-full bg-[#FFF7ED] text-[#EA580C] border border-orange-200/60 text-[10px] font-black">
                  {filteredMessages.length}
                </span>
              </div>
              <span className="text-[10px] text-slate-400 font-semibold">Click to inspect</span>
            </div>

            {/* Message Feed */}
            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[700px] custom-scrollbar">
              {loading ? (
                <div className="p-16 text-center">
                  <div className="inline-block w-8 h-8 border-3 border-[#EA580C] border-t-transparent rounded-full animate-spin mb-3"></div>
                  <p className="font-bold text-slate-500 text-xs">Loading web messages...</p>
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="p-16 text-center">
                  <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-3 text-slate-400">
                    <MessageSquare size={24} />
                  </div>
                  <h3 className="text-sm font-extrabold text-slate-700">No Messages Found</h3>
                  <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
                    When visitors submit the website contact form, their entries will show up here automatically.
                  </p>
                </div>
              ) : (
                filteredMessages.map((msg) => {
                  const isSelected = selectedMessage?.id === msg.id;
                  const isUnread = msg.status === 'Unread' || !msg.status;
                  const avatar = resolveAvatarUrl(msg);

                  return (
                    <div
                      key={msg.id}
                      onClick={() => setSelectedMessage(msg)}
                      className={`p-4 transition-all cursor-pointer flex items-start gap-3.5 hover:bg-slate-50/80 ${
                        isSelected 
                          ? 'bg-orange-50/60 border-l-4 border-[#EA580C]' 
                          : isUnread 
                          ? 'bg-orange-50/60 border-l-4 border-amber-400' 
                          : 'bg-white'
                      }`}
                    >
                      {/* Avatar */}
                      <div className="relative shrink-0 pt-0.5">
                        <img 
                          src={avatar} 
                          onError={(e) => {
                            const target = e.currentTarget;
                            const g = String(msg.gender || '').trim().toLowerCase();
                            target.src = (g === 'female' || g === 'f') ? FEMALE_DEFAULT_AVATAR : MALE_DEFAULT_AVATAR;
                          }}
                          className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 shadow-2xs object-cover" 
                          alt={msg.name} 
                        />
                        {isUnread && (
                          <span 
                            className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#EA580C] border-2 border-white shadow-2xs"
                            title="Unread Message"
                          />
                        )}
                      </div>

                      {/* Info & Snippet */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <h4 className={`text-xs truncate ${isUnread ? 'font-black text-slate-900' : 'font-bold text-slate-800'}`}>
                            {msg.name || 'Website Visitor'}
                          </h4>
                          <span className="text-[10px] font-bold text-slate-400 shrink-0">
                            {formatMsgTime(msg.createdAt)}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 font-semibold mt-0.5 truncate">
                          📞 {msg.phone || '—'}
                          {msg.goal && (
                            <span className="ml-2 font-bold text-[#EA580C] bg-[#FFF7ED] px-1.5 py-0.2 rounded border border-orange-200/60 text-[9.5px] uppercase">
                              {msg.goal}
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                          {msg.message || 'No additional notes provided.'}
                        </p>

                        <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-slate-100">
                          {/* Status Pill */}
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider border ${
                            isUnread 
                              ? 'bg-amber-50 text-amber-700 border-amber-200' 
                              : msg.status === 'Responded'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}>
                            <span className={`w-1 h-1 rounded-full ${
                              isUnread ? 'bg-amber-500' : msg.status === 'Responded' ? 'bg-emerald-500' : 'bg-slate-400'
                            }`} />
                            {msg.status || 'UNREAD'}
                          </span>

                          {/* Quick WhatsApp Action */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenWhatsApp(msg.phone, msg.name);
                            }}
                            className="p-1 rounded-lg text-emerald-600 hover:bg-emerald-50 transition-colors border-none bg-transparent cursor-pointer"
                            title="Chat on WhatsApp"
                          >
                            <MessageSquare size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: Message Details Panel (7 of 12 cols on desktop) */}
        <div className={`lg:col-span-7 sticky top-6 ${selectedMessage ? 'block' : 'hidden lg:block'}`}>
          {selectedMessage ? (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border border-[#FED7AA] rounded-3xl shadow-[0_4px_25px_rgba(234,88,12,0.03)] p-6 lg:p-7 space-y-6 text-left"
            >
              {/* Back to list button on mobile */}
              <div className="lg:hidden pb-2 border-b border-slate-100">
                <button
                  onClick={() => setSelectedMessage(null)}
                  className="flex items-center gap-1.5 text-xs font-black text-[#EA580C] hover:underline border-none bg-transparent cursor-pointer"
                >
                  <ArrowLeft size={14} /> Back to Messages List
                </button>
              </div>

              {/* Header Profile Bar */}
              <div className="flex items-start justify-between gap-4 pb-5 border-b border-slate-100">
                <div className="flex items-center gap-3.5">
                  <img 
                    src={resolveAvatarUrl(selectedMessage)} 
                    onError={(e) => {
                      const target = e.currentTarget;
                      const g = String(selectedMessage.gender || '').trim().toLowerCase();
                      target.src = (g === 'female' || g === 'f') ? FEMALE_DEFAULT_AVATAR : MALE_DEFAULT_AVATAR;
                    }}
                    className="w-13 h-13 rounded-full bg-slate-100 border-2 border-white shadow-xs object-cover shrink-0" 
                    alt={selectedMessage.name} 
                  />
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900 leading-tight">
                      {selectedMessage.name}
                    </h3>
                    <div className="text-xs text-slate-500 font-semibold mt-0.5 flex flex-wrap items-center gap-2">
                      <span>📞 {selectedMessage.phone}</span>
                      {selectedMessage.email && (
                        <>
                          <span>•</span>
                          <span>{selectedMessage.email}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-black text-[10px] uppercase tracking-wider border ${
                    selectedMessage.status === 'Responded'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : selectedMessage.status === 'Read'
                      ? 'bg-slate-100 text-slate-600 border-slate-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {selectedMessage.status || 'UNREAD'}
                  </span>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const rect = e.currentTarget.getBoundingClientRect();
                      setActionsMenu({ message: selectedMessage, rect });
                    }}
                    className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 cursor-pointer shadow-2xs transition-colors"
                    title="More Options"
                  >
                    <MoreHorizontal size={15} />
                  </button>
                </div>
              </div>

              {/* Message Content Bubble */}
              <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 block">
                  Inquiry Message
                </span>
                <div className="bg-slate-50/80 border border-slate-200/80 rounded-2xl p-5 text-slate-800 text-xs font-semibold leading-relaxed whitespace-pre-wrap">
                  &ldquo;{selectedMessage.message || 'No written message provided.'}&rdquo;
                </div>
              </div>

              {/* Message Metadata Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 text-xs">
                <div className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <span className="text-slate-400 block text-[9.5px] font-bold uppercase">Received</span>
                  <span className="text-slate-900 font-bold mt-0.5 block">
                    {selectedMessage.createdAt ? new Date(selectedMessage.createdAt).toLocaleString('en-IN', {
                      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    }) : 'N/A'}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <span className="text-slate-400 block text-[9.5px] font-bold uppercase">Source</span>
                  <span className="text-slate-900 font-bold mt-0.5 block">
                    {selectedMessage.source || 'Website Contact Form'}
                  </span>
                </div>

                <div className="p-3.5 bg-slate-50/50 rounded-2xl border border-slate-100">
                  <span className="text-slate-400 block text-[9.5px] font-bold uppercase">Fitness Goal</span>
                  <span className="text-[#EA580C] font-extrabold mt-0.5 block uppercase">
                    {selectedMessage.goal || 'General Inquiry'}
                  </span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="pt-2 flex flex-wrap gap-2.5 items-center">
                <button
                  onClick={() => handleOpenWhatsApp(selectedMessage.phone, selectedMessage.name)}
                  className="flex-1 min-w-[140px] px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm border-none"
                >
                  <MessageSquare size={15} /> WhatsApp
                </button>

                <a
                  href={`tel:${selectedMessage.phone}`}
                  className="px-5 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border border-slate-200 no-underline shadow-2xs"
                >
                  <Phone size={15} className="text-slate-500" /> Call
                </a>

                <button
                  onClick={() => {
                    const nextStatus = selectedMessage.status === 'Responded' ? 'Read' : 'Responded';
                    handleUpdateStatus(selectedMessage.id, nextStatus);
                  }}
                  className={`px-4 py-3 rounded-2xl font-extrabold text-xs uppercase tracking-wider transition-all border cursor-pointer ${
                    selectedMessage.status === 'Responded'
                      ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      : 'bg-[#FFF7ED] text-[#EA580C] border-[#FED7AA] hover:bg-orange-100'
                  }`}
                >
                  {selectedMessage.status === 'Responded' ? 'Mark Read' : 'Mark Responded'}
                </button>

                <button
                  onClick={() => {
                    setReplyText(`Hi ${selectedMessage.name}, thank you for your interest in The Warrior Gym! We'd love to help you achieve your goals.`);
                    setReplyModalOpen(true);
                  }}
                  className="px-5 py-3 rounded-2xl bg-[#EA580C] hover:bg-orange-700 text-white font-extrabold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 border-none cursor-pointer shadow-sm"
                >
                  <Send size={14} /> Reply
                </button>
              </div>

            </motion.div>
          ) : (
            /* Centered Empty State */
            <div className="bg-white border border-[#FED7AA] rounded-3xl p-16 text-center text-slate-400 shadow-[0_4px_25px_rgba(234,88,12,0.03)]">
              <div className="w-16 h-16 rounded-full bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center mx-auto mb-4 border border-[#FED7AA]">
                <MessageSquare size={26} />
              </div>
              <h4 className="font-extrabold text-slate-800 text-base">No Message Selected</h4>
              <p className="text-xs text-slate-400 mt-1.5 max-w-xs mx-auto">
                Select a message from the list to view the complete enquiry details and respond.
              </p>
            </div>
          )}
        </div>

      </div>

      {/* ── 5. FLOATING PORTAL ACTIONS DROPDOWN (Strict Priority Sequence) ── */}
      {actionsMenu && typeof document !== 'undefined' && createPortal(
        <div
          className="message-actions-portal-menu fixed z-[99999] bg-white border border-slate-200 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.18)] py-1.5 w-52 text-left text-xs font-semibold text-slate-800 animate-in fade-in select-none"
          style={{
            top: (window.innerHeight - actionsMenu.rect.bottom < 260)
              ? Math.max(10, actionsMenu.rect.top - 250)
              : actionsMenu.rect.bottom + 4,
            left: Math.max(10, Math.min(window.innerWidth - 220, actionsMenu.rect.right - 195)),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* 1. View */}
          <button
            type="button"
            onClick={() => {
              const msg = actionsMenu.message;
              setActionsMenu(null);
              setSelectedMessage(msg);
            }}
            className="w-full px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-700 transition-colors font-bold"
          >
            <Eye size={14} className="text-slate-500" />
            <span>View Details</span>
          </button>

          {/* 2. Mark as Read / Unread */}
          <button
            type="button"
            onClick={() => {
              const msg = actionsMenu.message;
              setActionsMenu(null);
              const nextStatus = msg.status === 'Read' ? 'Unread' : 'Read';
              handleUpdateStatus(msg.id, nextStatus);
            }}
            className="w-full px-3.5 py-2 hover:bg-orange-50 hover:text-[#C2410C] flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-700 transition-colors font-bold"
          >
            <CheckCheck size={14} className="text-[#EA580C]" />
            <span>{actionsMenu.message.status === 'Read' ? 'Mark as Unread' : 'Mark as Read'}</span>
          </button>

          {/* 3. WhatsApp */}
          <button
            type="button"
            onClick={() => {
              const msg = actionsMenu.message;
              setActionsMenu(null);
              handleOpenWhatsApp(msg.phone, msg.name);
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
              const msg = actionsMenu.message;
              setActionsMenu(null);
              if (msg.phone) window.open(`tel:${msg.phone}`);
              else toast.error('No phone number recorded');
            }}
            className="w-full px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-700 transition-colors font-bold"
          >
            <Phone size={14} className="text-slate-500" />
            <span>Call</span>
          </button>

          <div className="h-px bg-slate-100 my-1" />

          {/* 5. Delete (Destructive) */}
          <button
            type="button"
            onClick={() => {
              const msg = actionsMenu.message;
              setActionsMenu(null);
              setDeleteTarget(msg);
            }}
            className="w-full px-3.5 py-2 hover:bg-rose-50 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-rose-600 transition-colors font-bold"
          >
            <Trash2 size={14} className="text-rose-600" />
            <span>Delete Message</span>
          </button>
        </div>,
        document.body
      )}

      {/* ── 6. CUSTOM DELETE CONFIRMATION MODAL (NO window.confirm) ── */}
      <AnimatePresence>
        {deleteTarget && (
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
                  <h3 className="font-extrabold text-slate-900 text-lg">Delete Message?</h3>
                  <p className="text-xs text-slate-400 font-medium">This action cannot be undone.</p>
                </div>
              </div>

              <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 text-xs font-semibold text-rose-800 space-y-1.5">
                <p>
                  Are you sure you want to delete the message from <span className="font-black text-rose-950">"{deleteTarget.name}"</span>?
                </p>
                <p className="text-[11px] text-rose-700 font-normal">
                  This enquiry submission will be permanently removed from your CRM records.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deletingMessage}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingMessage}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs cursor-pointer disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5 border-none shadow-sm"
                >
                  {deletingMessage ? 'Deleting...' : 'Delete Message'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── 7. QUICK REPLY MODAL ── */}
      <AnimatePresence>
        {replyModalOpen && selectedMessage && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-3xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Send className="text-[#EA580C]" size={18} /> Reply to {selectedMessage.name}
                </h3>
                <button onClick={() => setReplyModalOpen(false)} className="p-1 rounded-lg text-slate-400 hover:bg-slate-100 border-none cursor-pointer">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSendReplySubmit} className="space-y-4 text-xs text-left">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 space-y-1">
                  <span className="font-extrabold text-slate-900 block">{selectedMessage.name}</span>
                  <span className="text-[11px] text-slate-500 font-bold">📞 {selectedMessage.phone}</span>
                  <p className="text-[11px] text-slate-600 italic mt-1">&ldquo;{selectedMessage.message}&rdquo;</p>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">Reply Message</label>
                  <textarea
                    rows={4}
                    required
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    placeholder="Type your response to the customer..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium text-slate-800 outline-none focus:border-[#EA580C] resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setReplyModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl border-none cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={sendingReply}
                    className="px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md border-none cursor-pointer flex items-center gap-1.5"
                  >
                    <Send size={13} /> {sendingReply ? 'Sending...' : 'Send via WhatsApp'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
