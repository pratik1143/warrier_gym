'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CreditCard, IndianRupee, Receipt, AlertCircle, Plus, Download, Search, 
  TrendingUp, X, RefreshCw, Printer, Share2, 
  CheckCircle2, Smartphone, Banknote, Landmark, Clock, Eye, Trash2
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { updateDoc, doc } from 'firebase/firestore';
import { formatDate, getInitials } from '@/lib/utils';
import { useGymStore } from '@/store';
import toast from '@/lib/toast';
import InvoiceBuilderModal from './components/InvoiceBuilderModal';
import OfficialInvoiceReceipt from '../components/OfficialInvoiceReceipt';
import { useTodaysPayments, PaymentRecord } from '@/hooks/useTodaysPayments';

// ── Payment Methods Map ──────────────────────────────────────
const payMethodsConfig: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  UPI:           { icon: Smartphone, label: 'UPI',         color: '#EA580C', bg: 'rgba(234,88,12,0.08)' },
  Cash:          { icon: Banknote,   label: 'Cash',        color: '#16a34a', bg: 'rgba(22,163,74,0.08)'  },
  Card:          { icon: CreditCard, label: 'Card',        color: '#2563eb', bg: 'rgba(37,99,235,0.08)'  },
  'Net Banking': { icon: Landmark,   label: 'Net Banking', color: '#0284c7', bg: 'rgba(2,132,199,0.08)'  },
};

const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3, delay, ease: "easeOut" as const },
});

export default function BillingPage() {
  const { members, fetchPayments: refreshStorePayments } = useGymStore();

  // ── Central payment hook (single source of truth) ─────────────────────────
  const {
    allPayments,
    todaysTotal: todaysRealCollection,
    todayMethodTotals: methodTotals,
    allTimeTotal: totalCollected,
    pendingCount,
    todayStr,
    loading,
    deletePayment,
  } = useTodaysPayments();

  // payments list used for table = all non-deleted payments (sorted newest first)
  const payments = useMemo(
    () => [...allPayments].sort((a, b) => {
      const ta = new Date(a.createdAt || a.date || 0).getTime();
      const tb = new Date(b.createdAt || b.date || 0).getTime();
      return tb - ta;
    }),
    [allPayments]
  );

  const [search, setSearch] = useState('');
  const [localSearch, setLocalSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'paid' | 'pending' | 'failed'>('all');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('all'); // all, today, 7days, 30days

  const [selectedReceipt, setSelectedReceipt] = useState<PaymentRecord | null>(null);
  const [showInvoiceModal, setShowInvoiceModal] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<PaymentRecord | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(localSearch);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [localSearch]);

  // Average payment (all-time)
  const avgPayment = useMemo(() => {
    const paid = allPayments.filter(p => (p.status || '').toLowerCase() === 'paid');
    return paid.length ? totalCollected / paid.length : 0;
  }, [allPayments, totalCollected]);

  const handleMarkPaid = async (p: PaymentRecord) => {
    if (!window.confirm(`Mark ₹${(Number(p.amount)||0).toLocaleString('en-IN')} invoice as PAID for ${p.memberName}?`)) return;
    setMarkingPaid(p.id);
    try {
      const total = Number(p.amount) || 0;
      await updateDoc(doc(db, 'payments', p.id), {
        status: 'paid',
        paid: total,
        pendingAmount: 0,
        isRealTimeToday: true
      });
      if (p.memberId) {
        await updateDoc(doc(db, 'members', p.memberId), {
          paymentStatus: 'paid',
          paidAmount: total,
          pendingAmount: 0,
          status: 'active'
        });
      }
      toast.success(`Payment marked as PAID for ${p.memberName}! 🎉`);
      refreshStorePayments();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast.error('Failed to update: ' + msg);
    } finally {
      setMarkingPaid(null);
    }
  };

  // Delete handler — called after confirmation
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const ok = await deletePayment(deleteTarget);
    if (ok) {
      toast.success('Payment deleted successfully.');
      setDeleteTarget(null);
    } else {
      toast.error('Unable to delete payment. Please try again.');
    }
    setDeleting(false);
  };

  const handleShareWhatsApp = (p: any) => {
    const member = members.find((m: any) => m.id === p.memberId);
    const phone = (member?.phone || p.memberPhone || '').replace(/\D/g, '');
    if (!phone || phone.length < 10) {
      toast.error('No valid phone number found for this member.');
      return;
    }
    const total = Number(p.amount) || 0;
    const msg = encodeURIComponent(
      `🏋️ The Warrior Gym — Official Payment Receipt\n\nInvoice No: ${p.invoice || p.invoiceNumber || 'N/A'}\nClient Name: ${p.memberName}\nPlan: ${p.plan || 'Membership'}\nAmount Billed: ₹${total.toLocaleString('en-IN')}\nPayment Method: ${p.method || p.paymentMethod || 'UPI'}\nStatus: ${(p.status || 'paid').toUpperCase()} ✅\nDate: ${p.date || todayStr}\n\nThank you for training with The Warrior Gym! 💪`
    );
    window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank');
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    if (filteredPayments.length === 0) {
      toast.error('No payment records to export.');
      return;
    }
    const headers = ['Invoice #', 'Member Name', 'Phone', 'Plan', 'Amount Billed', 'Amount Paid', 'Pending', 'Payment Method', 'Date', 'Status'];
    const rows = filteredPayments.map(p => [
      `"${p.invoice || p.invoiceNumber || ''}"`,
      `"${p.memberName || ''}"`,
      `"${p.memberPhone || ''}"`,
      `"${p.plan || ''}"`,
      p.amount || 0,
      p.paid || 0,
      p.pendingAmount || 0,
      `"${p.method || p.paymentMethod || ''}"`,
      `"${p.date || p.createdAt || ''}"`,
      `"${(p.status || 'paid').toUpperCase()}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `WarriorGym_Billing_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Billing report exported to CSV! 📥');
  };

  // Filtered Payments Logic
  const filteredPayments = useMemo(() => {
    const now = new Date();
    return payments.filter(p => {
      const name = (p.memberName || '').toLowerCase();
      const inv  = (p.invoice || p.invoiceNumber || '').toLowerCase();
      const phone = (p.memberPhone || '').toLowerCase();
      const q    = search.toLowerCase();
      const matchesSearch = name.includes(q) || inv.includes(q) || phone.includes(q);

      const pStatus = (p.status || 'paid').toLowerCase();
      const matchesStatus = statusFilter === 'all'
        ? true
        : statusFilter === 'paid' ? pStatus === 'paid' : statusFilter === 'pending' ? pStatus === 'pending' : pStatus === 'failed';

      const pMethod = String(p.method || p.paymentMethod || 'UPI');
      const matchesMethod = methodFilter === 'all'
        ? true
        : pMethod.toLowerCase().includes(methodFilter.toLowerCase());

      // Date Range Filter
      let matchesDate = true;
      if (dateFilter !== 'all') {
        const pDate = new Date(p.date || p.createdAt || 0);
        const diffDays = (now.getTime() - pDate.getTime()) / (1000 * 3600 * 24);
        if (dateFilter === 'today') matchesDate = (p.date || '').split('T')[0] === todayStr || diffDays <= 1;
        else if (dateFilter === '7days') matchesDate = diffDays <= 7;
        else if (dateFilter === '30days') matchesDate = diffDays <= 30;
      }

      return matchesSearch && matchesStatus && matchesMethod && matchesDate;
    });
  }, [payments, search, statusFilter, methodFilter, dateFilter, todayStr]);

  const totalPages = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedPayments = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPayments.slice(start, start + pageSize);
  }, [filteredPayments, currentPage, pageSize]);

  return (
    <div className="w-full space-y-5 pb-12 text-left">

      {/* ── 1. COMPACT PAGE HEADER (The Warrior Gym Theme) ── */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] text-[#EA580C] flex items-center justify-center shrink-0 shadow-xs">
            <CreditCard size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight leading-tight">
                Billing &amp; Payments
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-[10px] font-black uppercase tracking-wider text-emerald-700 flex items-center gap-1.5 shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Live Ledger
              </span>
            </div>
            <p className="text-slate-500 text-xs mt-0.5 font-medium">
              Manage membership payments, invoices and receipts.
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowInvoiceModal('Gym')}
          className="w-full sm:w-auto bg-[#EA580C] hover:bg-orange-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all border-none flex items-center justify-center gap-2 cursor-pointer active:scale-95 shrink-0"
        >
          <Plus size={16} /> Collect Payment
        </button>
      </div>

      {/* ── 2. QUICK STATISTICS (KPI CARDS) ── */}
      <motion.div {...fadeUp(0.05)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Today's Collection */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:border-emerald-300 transition-all">
          <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 border border-emerald-100">
            <IndianRupee size={20} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Today's Collection</span>
            <h3 className="text-xl font-black text-emerald-600 mt-0.5 leading-none">
              ₹{todaysRealCollection.toLocaleString('en-IN')}
            </h3>
            <p className="text-[10px] font-semibold text-emerald-600 mt-1">Collected today</p>
          </div>
        </div>

        {/* Total Revenue */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:border-[#EA580C] transition-all">
          <div className="w-11 h-11 rounded-xl bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center shrink-0 border border-[#FED7AA]">
            <TrendingUp size={20} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Total Revenue</span>
            <h3 className="text-xl font-black text-slate-900 mt-0.5 leading-none">
              ₹{totalCollected.toLocaleString('en-IN')}
            </h3>
            <p className="text-[10px] font-semibold text-slate-400 mt-1">All-time recorded payments</p>
          </div>
        </div>

        {/* Average Payment */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:border-indigo-300 transition-all">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 border border-indigo-100">
            <Receipt size={20} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Average Payment</span>
            <h3 className="text-xl font-black text-slate-900 mt-0.5 leading-none">
              ₹{Math.round(avgPayment).toLocaleString('en-IN')}
            </h3>
            <p className="text-[10px] font-semibold text-slate-400 mt-1">All-time average transaction</p>
          </div>
        </div>

        {/* Pending Payments */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs flex items-center gap-3.5 hover:border-amber-300 transition-all">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Pending Payments</span>
            <h3 className="text-xl font-black text-amber-600 mt-0.5 leading-none">
              {pendingCount}
            </h3>
            <p className="text-[10px] font-semibold text-amber-600 mt-1">Requires attention</p>
          </div>
        </div>

      </motion.div>

      {/* ── 3. PAYMENT METHOD BREAKDOWN STRIP ── */}
      <motion.div {...fadeUp(0.1)} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {Object.entries(payMethodsConfig).map(([key, item]) => {
          const stats = methodTotals[key as keyof typeof methodTotals] || { total: 0, count: 0 };
          const IconComp = item.icon;
          const isSelected = methodFilter === key;

          return (
            <button
              key={key}
              onClick={() => setMethodFilter(isSelected ? 'all' : key)}
              className={`p-3.5 rounded-xl border transition-all text-left cursor-pointer flex items-center justify-between ${
                isSelected 
                  ? 'bg-[#EA580C] border-[#EA580C] text-white shadow-sm' 
                  : 'bg-white border-slate-200 hover:border-[#EA580C] text-slate-800'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div 
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ 
                    backgroundColor: isSelected ? 'rgba(255,255,255,0.18)' : item.bg, 
                    color: isSelected ? '#fff' : item.color 
                  }}
                >
                  <IconComp size={18} />
                </div>
                <div>
                  <div className={`text-[10px] font-extrabold uppercase tracking-wider ${isSelected ? 'text-orange-100' : 'text-slate-400'}`}>
                    {item.label}
                  </div>
                  <div className={`text-sm font-black mt-0.5 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                    ₹{stats.total.toLocaleString('en-IN')}
                  </div>
                </div>
              </div>
              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {stats.count}
              </span>
            </button>
          );
        })}
      </motion.div>

      {/* ── 4. TRANSACTION TOOLBAR ── */}
      <motion.div {...fadeUp(0.15)} className="bg-white rounded-2xl p-3.5 border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search member, phone, invoice number..."
            value={localSearch}
            onChange={e => setLocalSearch(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-8 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#EA580C] focus:bg-white transition-all"
          />
          {localSearch && (
            <button onClick={() => { setLocalSearch(''); setSearch(''); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 border-none cursor-pointer bg-transparent">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter Controls & Export */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          
          {/* Status Select */}
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value as any); setPage(1); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#EA580C]"
          >
            <option value="all">All Status</option>
            <option value="paid">Paid</option>
            <option value="pending">Pending</option>
          </select>

          {/* Payment Method Select */}
          <select
            value={methodFilter}
            onChange={e => { setMethodFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#EA580C]"
          >
            <option value="all">All Methods</option>
            <option value="UPI">UPI</option>
            <option value="Cash">Cash</option>
            <option value="Card">Card</option>
            <option value="Net Banking">Net Banking</option>
          </select>

          {/* Date Range Select */}
          <select
            value={dateFilter}
            onChange={e => { setDateFilter(e.target.value); setPage(1); }}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:border-[#EA580C]"
          >
            <option value="all">All Dates</option>
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>

          {/* Export CSV Button */}
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all border border-slate-200 flex items-center gap-1.5 cursor-pointer"
          >
            <Download size={14} /> Export CSV
          </button>

        </div>
      </motion.div>

      {/* ── 5. PAYMENT TRANSACTION TABLE / CARDS ── */}
      <motion.div {...fadeUp(0.2)} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <Receipt size={16} className="text-[#EA580C]" />
            <h3 className="font-extrabold text-xs uppercase tracking-wider text-slate-800">
              Payment Transactions ({filteredPayments.length})
            </h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400">Sorted by Latest</span>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
            <RefreshCw size={16} className="animate-spin text-[#EA580C]" /> Loading payment transactions...
          </div>
        ) : filteredPayments.length === 0 ? (
          /* EMPTY STATE */
          <div className="py-16 px-6 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center mx-auto border border-[#FED7AA]">
              <Receipt size={24} />
            </div>
            <div>
              <h4 className="text-base font-extrabold text-slate-900">No payment transactions yet</h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto mt-1 font-medium">
                Collect your first membership payment to start building your billing history.
              </p>
            </div>
            <button
              onClick={() => setShowInvoiceModal('Gym')}
              className="mt-2 bg-[#EA580C] hover:bg-orange-700 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-md transition-all border-none inline-flex items-center gap-2 cursor-pointer"
            >
              <Plus size={15} /> Collect Payment
            </button>
          </div>
        ) : (
          <>
            {/* DESKTOP TABLE VIEW */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-5">Invoice #</th>
                    <th className="py-3 px-4">Member</th>
                    <th className="py-3 px-4">Plan</th>
                    <th className="py-3 px-4">Amount</th>
                    <th className="py-3 px-4">Payment Method</th>
                    <th className="py-3 px-4">Date &amp; Time</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                  {paginatedPayments.map((p, idx) => {
                    const isPaid = (p.status || 'paid').toLowerCase() === 'paid';
                    const isPending = (p.status || '').toLowerCase() === 'pending';
                    const methodNorm = String(p.method || p.paymentMethod || 'UPI');
                    const MethodIcon = methodNorm.includes('Cash') ? Banknote : methodNorm.includes('Card') ? CreditCard : methodNorm.includes('Net') ? Landmark : Smartphone;

                    return (
                      <tr key={p.id || idx} className="hover:bg-slate-50/80 transition-colors">
                        {/* Invoice # */}
                        <td className="py-3.5 px-5 font-mono text-xs font-bold text-slate-900">
                          <span className="bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80">
                            {p.invoice || p.invoiceNumber || `TWG-INV-${String(idx+1).padStart(6, '0')}`}
                          </span>
                        </td>

                        {/* Member */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-[#FFEDD5] text-[#EA580C] font-black flex items-center justify-center text-xs shrink-0">
                              {getInitials(p.memberName || 'M')}
                            </div>
                            <div>
                              <div className="font-extrabold text-slate-900">{p.memberName || 'Member'}</div>
                              <div className="text-[10px] text-slate-400 font-medium">{p.memberPhone || 'No Phone'}</div>
                            </div>
                          </div>
                        </td>

                        {/* Plan */}
                        <td className="py-3.5 px-4">
                          <span className="font-bold text-slate-800">{p.plan || 'Membership'}</span>
                        </td>

                        {/* Amount */}
                        <td className="py-3.5 px-4 font-black text-slate-900 text-sm">
                          ₹{(Number(p.paid) || Number(p.amount) || 0).toLocaleString('en-IN')}
                        </td>

                        {/* Payment Method */}
                        <td className="py-3.5 px-4">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            <MethodIcon size={13} className="text-[#EA580C]" /> {p.method || p.paymentMethod || 'UPI'}
                          </span>
                        </td>

                        {/* Date & Time */}
                        <td className="py-3.5 px-4 font-mono text-slate-700">
                          <div className="font-bold text-slate-900">{formatDate(p.date || p.createdAt || todayStr)}</div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                            isPaid 
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                              : isPending 
                              ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}>
                            {isPaid ? <CheckCircle2 size={10}/> : isPending ? <Clock size={10}/> : <AlertCircle size={10}/>}
                            {isPaid ? 'PAID' : isPending ? 'PENDING' : 'FAILED'}
                          </span>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isPaid && (
                              <button
                                onClick={() => handleMarkPaid(p)}
                                disabled={markingPaid === p.id}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] border-none cursor-pointer transition-colors"
                              >
                                Mark Paid
                              </button>
                            )}
                            <button
                              onClick={() => setSelectedReceipt(p)}
                              className="px-2.5 py-1 bg-[#EA580C] hover:bg-orange-700 text-white rounded-lg font-bold text-[11px] border-none cursor-pointer transition-colors flex items-center gap-1"
                              title="View Invoice"
                            >
                              <Eye size={12} /> View
                            </button>
                            <button
                              onClick={() => handleShareWhatsApp(p)}
                              className="p-1.5 text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 cursor-pointer transition-colors"
                              title="Share on WhatsApp"
                            >
                              <Share2 size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteTarget(p)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 cursor-pointer transition-colors"
                              title="Delete Payment"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* MOBILE COMPACT CARDS VIEW */}
            <div className="block md:hidden divide-y divide-slate-100">
              {paginatedPayments.map((p, idx) => {
                const isPaid = (p.status || 'paid').toLowerCase() === 'paid';
                const isPending = (p.status || '').toLowerCase() === 'pending';
                const methodNorm = String(p.method || p.paymentMethod || 'UPI');
                const MethodIcon = methodNorm.includes('Cash') ? Banknote : methodNorm.includes('Card') ? CreditCard : methodNorm.includes('Net') ? Landmark : Smartphone;

                return (
                  <div key={p.id || idx} className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                        {p.invoice || p.invoiceNumber || `TWG-INV-${String(idx+1).padStart(6, '0')}`}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isPaid 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                          : isPending 
                          ? 'bg-amber-50 text-amber-700 border border-amber-200' 
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}>
                        {isPaid ? 'PAID' : isPending ? 'PENDING' : 'FAILED'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-extrabold text-sm text-slate-900">{p.memberName || 'Member'}</div>
                        <div className="text-xs text-slate-500 font-medium">{p.plan || 'Membership'}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-black text-slate-900">₹{(Number(p.paid) || Number(p.amount) || 0).toLocaleString('en-IN')}</div>
                        <div className="text-[11px] text-slate-400 font-mono">{formatDate(p.date || p.createdAt || todayStr)}</div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-600">
                        <MethodIcon size={14} className="text-[#EA580C]" /> {p.method || p.paymentMethod || 'UPI'}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setSelectedReceipt(p)}
                          className="px-3 py-1 bg-[#EA580C] text-white rounded-lg font-bold text-xs border-none cursor-pointer"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleShareWhatsApp(p)}
                          className="p-1.5 text-emerald-600 bg-emerald-50 rounded-lg border border-emerald-200 cursor-pointer"
                        >
                          <Share2 size={13} />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(p)}
                          className="p-1.5 text-rose-500 bg-rose-50 rounded-lg border border-rose-200 cursor-pointer"
                          title="Delete Payment"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* ── PAGINATION FOOTER ── */}
        {!loading && filteredPayments.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/50">
            <div>
              Showing {filteredPayments.length === 0 ? 0 : (currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, filteredPayments.length)} of {filteredPayments.length} transactions
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <button 
                  disabled={currentPage <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  className="px-2.5 py-1 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold bg-white"
                >
                  Prev
                </button>
                <span className="px-2 font-bold text-slate-700">
                  {currentPage} / {totalPages}
                </span>
                <button 
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  className="px-2.5 py-1 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer font-bold bg-white"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── COLLECT PAYMENT MODAL ── */}
      <InvoiceBuilderModal 
        isOpen={!!showInvoiceModal}
        type={showInvoiceModal}
        onClose={() => setShowInvoiceModal(null)}
        members={members}
      />

      {/* ── DELETE PAYMENT CONFIRMATION MODAL ── */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => { if (!deleting) setDeleteTarget(null); }}
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
              className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm z-10 p-6 space-y-4"
            >
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 size={18} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Delete Payment?</h3>
                  <p className="text-xs text-slate-500 font-medium">This action cannot be undone.</p>
                </div>
              </div>

              {/* Payment Details */}
              <div className="bg-slate-50 rounded-xl border border-slate-200 divide-y divide-slate-100 text-xs">
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-slate-500 font-semibold">Member</span>
                  <span className="font-extrabold text-slate-900">{deleteTarget.memberName || '—'}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-slate-500 font-semibold">Amount</span>
                  <span className="font-extrabold text-slate-900">₹{(Number(deleteTarget.paid) || Number(deleteTarget.amount) || 0).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-slate-500 font-semibold">Method</span>
                  <span className="font-extrabold text-slate-900">{deleteTarget.method || deleteTarget.paymentMethod || 'UPI'}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-slate-500 font-semibold">Date</span>
                  <span className="font-extrabold text-slate-900">{formatDate(deleteTarget.date || deleteTarget.paymentDate || deleteTarget.createdAt || '')}</span>
                </div>
              </div>

              {/* Warning */}
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 font-semibold leading-relaxed">
                ⚠️ Deleting this payment will remove it from today's collection and payment totals.
              </p>

              {/* Buttons */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={deleting}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs cursor-pointer disabled:opacity-70 flex items-center justify-center gap-1.5 border-none"
                >
                  {deleting ? (
                    <><RefreshCw size={13} className="animate-spin" /> Deleting...</>
                  ) : (
                    <><Trash2 size={13} /> Delete Payment</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── INVOICE RECEIPT MODAL ── */}
      <AnimatePresence>
        {selectedReceipt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm" 
              onClick={() => setSelectedReceipt(null)} 
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.95, opacity: 0 }} 
              className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden text-left z-10 p-5 space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
                  <Receipt size={18} className="text-[#EA580C]" /> Tax Invoice &amp; Official Receipt
                </h3>
                <button 
                  onClick={() => setSelectedReceipt(null)} 
                  className="text-slate-400 hover:text-slate-700 border-none cursor-pointer bg-transparent p-1"
                >
                  <X size={18}/>
                </button>
              </div>

              {/* Official Invoice Template */}
              <OfficialInvoiceReceipt 
                invoice={selectedReceipt} 
                member={members.find((m: any) => m.id === selectedReceipt.memberId || m.memberId === selectedReceipt.memberId) || {
                  name: selectedReceipt.memberName,
                  phone: selectedReceipt.memberPhone,
                  memberId: selectedReceipt.memberId,
                  plan: selectedReceipt.plan,
                  joinDate: selectedReceipt.date
                }}
              />

              <div className="pt-2 flex flex-col sm:flex-row gap-3 max-w-[800px] mx-auto">
                <button 
                  onClick={() => window.print()} 
                  className="flex-1 py-2.5 rounded-xl bg-[#EA580C] hover:bg-orange-700 text-white font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer border-none shadow-md"
                >
                  <Printer size={15} /> Print Receipt
                </button>
                <button 
                  onClick={() => handleShareWhatsApp(selectedReceipt)} 
                  className="py-2.5 px-5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-xs flex items-center justify-center gap-1.5 cursor-pointer border border-emerald-200"
                >
                  <Share2 size={15} /> Share WhatsApp
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
