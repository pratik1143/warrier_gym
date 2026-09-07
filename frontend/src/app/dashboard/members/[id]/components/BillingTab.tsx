'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Receipt, CreditCard, AlertCircle, CheckCircle, Clock, Download, MessageSquare,
  RefreshCw, Plus, Eye, Printer, Mail, ArrowUpRight, Edit3, X, Calendar, Shield,
  FileText, Sparkles, Check, ChevronDown, FileSpreadsheet, FileCode, Trash2
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, updateDoc, doc, setDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import { membershipEngine } from '@/lib/engines/membershipEngine';
import { paymentEngine } from '@/lib/engines/paymentEngine';
import { cleanPlanName, formatDate } from '@/lib/utils';
import { useGymStore } from '@/store';
import toast from '@/lib/toast';
import API from '@/services/api';
import RenewalWizardModal from '../../components/RenewalWizardModal';
import OfficialInvoiceReceipt from '@/app/dashboard/components/OfficialInvoiceReceipt';
import EditBillingModal from './EditBillingModal';
import CreateNewBillModal from '../../components/CreateNewBillModal';

export default function BillingTab({ member: initialMember, onOpenCreateBill }: { member: any; onOpenCreateBill?: () => void }) {
  const { fetchMembers } = useGymStore();
  const [member, setMember] = useState(initialMember);
  const isHold = String(member?.status || member?.membershipStatus || '').trim().toUpperCase() === 'HOLD' || member?.activationStatus === 'PENDING_ACTIVATION';
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);

  // Floating portal dropdown state
  const [openDropdown, setOpenDropdown] = useState<{ invoice: any; anchorRect: DOMRect } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Modals state
  const [viewInvoice, setViewInvoice] = useState<any | null>(null);
  const [selectedInvoiceForEdit, setSelectedInvoiceForEdit] = useState<any | null>(null);
  const [invoiceToDelete, setInvoiceToDelete] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [showNewBillModal, setShowNewBillModal] = useState(false);

  useEffect(() => {
    setMember(initialMember);
  }, [initialMember]);

  // Click outside and Escape key handler for portal dropdown
  useEffect(() => {
    if (!openDropdown) return;

    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenDropdown(null);
      }
    };

    const handleScrollOrResize = () => {
      setOpenDropdown(null);
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [openDropdown]);

  // Real-time listener for member invoices
  useEffect(() => {
    if (!member) return;
    setLoading(true);

    const fallbackInvoices = Array.isArray(member.billingHistory) && member.billingHistory.length > 0
      ? member.billingHistory
      : (Array.isArray(member.payments) && member.payments.length > 0 ? member.payments : []);

    const candidateIds = new Set([member.id, member.uid, member.memberId, member.docId].filter(Boolean));
    const cleanPhone = (member.phone || '').replace(/\D/g, '');

    const unsub = onSnapshot(collection(db, 'payments'), (snap) => {
      const allDocs = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      const liveData = allDocs.filter((p: any) => {
        if (!p) return false;
        if (p.memberId && candidateIds.has(p.memberId)) return true;
        if (p.memberPhone && cleanPhone && p.memberPhone.replace(/\D/g, '') === cleanPhone) return true;
        return false;
      });
      const combinedMap = new Map<string, any>();

      if (liveData.length > 0) {
        liveData.forEach((inv: any) => {
          // If member is on HOLD, filter out fake zero-amount legacy invoices
          if (isHold && Number(inv.amount || inv.netPayable || 0) === 0 && Number(inv.amountPaid || inv.paid || 0) === 0) {
            return;
          }
          const key = inv.id || inv.invoiceNumber || inv.invoice;
          combinedMap.set(key, inv);
        });
      } else if (!isHold && fallbackInvoices.length > 0) {
        fallbackInvoices.forEach((inv: any, idx: number) => {
          const key = inv.id || inv.invoiceNumber || inv.invoice || `inv_${idx}`;
          combinedMap.set(key, inv);
        });
      } else if (!isHold && member) {
        const amountPaid = Number(member.amountPaid !== undefined ? member.amountPaid : (member.paid ?? member.totalPaid ?? member.amount ?? member.price ?? 0));
        const balanceAmount = Number(member.balanceAmount !== undefined ? member.balanceAmount : (member.balance ?? member.outstandingBalance ?? 0));
        const totalBilled = Number(member.totalBilled !== undefined ? member.totalBilled : (amountPaid + balanceAmount));
        if (totalBilled > 0 || amountPaid > 0) {
          const autoInv = {
            id: `inv_auto_${member.id || Date.now()}`,
            invoiceNumber: member.clientId ? `INV-LEG-${member.clientId}` : (member.memberId ? member.memberId.replace('TWG-2026-', '') : '670'),
            invoice: member.clientId ? `INV-LEG-${member.clientId}` : (member.memberId ? member.memberId.replace('TWG-2026-', '') : '670'),
            plan: member.packageName || member.plan || 'General Membership',
            packageName: member.packageName || member.plan || 'General Membership',
            amount: totalBilled,
            totalBilled: totalBilled,
            packagePrice: totalBilled,
            paid: amountPaid,
            amountPaid: amountPaid,
            pendingAmount: balanceAmount,
            balanceAmount: balanceAmount,
            discount: 0,
            method: member.paymentMethod || member.method || 'Imported',
            status: balanceAmount === 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'pending'),
            paymentStatus: balanceAmount === 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'pending'),
            date: member.startDate || member.joinDate || new Date().toISOString().split('T')[0],
            startDate: member.startDate || member.joinDate || new Date().toISOString().split('T')[0],
            expiryDate: member.expiryDate || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          };
          combinedMap.set(autoInv.id, autoInv);
        }
      }

      const sorted = Array.from(combinedMap.values()).sort((a: any, b: any) =>
        new Date(b.date || b.createdAt || b.startDate || 0).getTime() -
        new Date(a.date || a.createdAt || a.startDate || 0).getTime()
      );

      setInvoices(sorted);
      setLoading(false);
    }, (err) => {
      console.warn("Firestore payments listener notice:", err);
      setInvoices(fallbackInvoices);
      setLoading(false);
    });

    return () => unsub();
  }, [member]);

  // Filter for billing types: ALL, MEMBERSHIP, PT
  const [billingTypeFilter, setBillingTypeFilter] = useState<'all' | 'membership' | 'pt'>('all');

  // Filtered invoices array
  const filteredInvoices = useMemo(() => {
    if (billingTypeFilter === 'all') return invoices;
    if (billingTypeFilter === 'pt') return invoices.filter((inv: any) => inv.billingType === 'pt');
    return invoices.filter((inv: any) => inv.billingType !== 'pt');
  }, [invoices, billingTypeFilter]);

  // Execute Delete Bill (Atomic WriteBatch + Timeline Rebuild)
  const handleExecuteDeleteBill = async () => {
    if (!invoiceToDelete) return;
    setIsDeleting(true);
    try {
      const invId = invoiceToDelete.id;
      const targetInvNum = invoiceToDelete.invoiceNumber || invoiceToDelete.invoice;
      const isPtBill = invoiceToDelete.billingType === 'pt';

      // 1. Filter out deleted bill from remaining invoices
      const remainingInvoices = invoices.filter((inv: any) => {
        const iNum = inv.invoiceNumber || inv.invoice;
        return (inv.id && inv.id !== invId) && (!targetInvNum || iNum !== targetInvNum);
      });

      // 2. Perform Atomic Firestore Batch Operation
      const batch = writeBatch(db);

      if (invId) {
        batch.delete(doc(db, 'payments', invId));
      }

      if (member.id) {
        if (isPtBill) {
          // CRITICAL SAFETY RULE: Deleting a PT bill MUST NEVER affect membership expiryDate, startDate, or plan!
          const updatedPtHistory = (Array.isArray(member.ptHistory) ? member.ptHistory : []).filter((h: any) => {
            const hNum = h.invoiceNumber || h.invoice || h.id;
            return hNum !== targetInvNum && h.id !== invId;
          });

          const netPay = Number(invoiceToDelete.netPayable || invoiceToDelete.amount || 0);
          const paidAmt = Number(invoiceToDelete.amountPaid !== undefined ? invoiceToDelete.amountPaid : (invoiceToDelete.paid || 0));

          const newTotalBilled = Math.max(0, (Number(member.totalBilled) || 0) - netPay);
          const newTotalPaid = Math.max(0, (Number(member.totalPaid) || 0) - paidAmt);

          batch.update(doc(db, 'members', member.id), {
            ptHistory: updatedPtHistory,
            totalBilled: newTotalBilled,
            totalPaid: newTotalPaid,
            outstandingBalance: Math.max(0, newTotalBilled - newTotalPaid),
            updatedAt: new Date().toISOString(),
          });
        } else {
          // Deleting a membership bill recalculates membership history
          const remainingMembershipInvoices = remainingInvoices.filter((inv: any) => inv.billingType !== 'pt');
          const timeline = membershipEngine.rebuildMemberMembershipTimeline(member, remainingMembershipInvoices);

          batch.update(doc(db, 'members', member.id), {
            membershipHistory: timeline.recalculatedHistory,
            startDate: timeline.startDate,
            expiryDate: timeline.expiryDate,
            plan: timeline.plan,
            daysLeft: timeline.daysLeft,
            status: timeline.status,
            totalBilled: timeline.totalBilled,
            totalPaid: timeline.totalPaid,
            outstandingBalance: timeline.outstandingBalance,
            amount: timeline.totalBilled,
            paidAmount: timeline.totalPaid,
            paymentStatus: timeline.outstandingBalance <= 0 ? 'paid' : (timeline.totalPaid > 0 ? 'partial' : 'pending'),
            'ai.daysLeft': timeline.daysLeft,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      await batch.commit();

      // 3. Optional Backend API sync fallback
      try {
        if (targetInvNum) {
          await API.delete(`/billing/${targetInvNum}`);
        }
      } catch (e) {
        // Backend API fallback notice
      }

      // 4. Update local state immediately
      setInvoices(remainingInvoices);

      toast.success(`${isPtBill ? 'Personal Training' : 'Billing'} transaction deleted permanently.`);
      setInvoiceToDelete(null);

      // 5. Invalidate store cache and refresh all pages
      const { fetchPayments, fetchMembers } = useGymStore.getState();
      await fetchPayments(true);
      await fetchMembers(true);
    } catch (err: any) {
      toast.error('Failed to delete billing transaction: ' + (err?.message || err));
    } finally {
      setIsDeleting(false);
    }
  };

  // Valid active invoices (ignoring VOID / duplicates)
  const validInvoices = useMemo(() => invoices.filter((inv: any) => inv.status !== 'VOID' && inv.status !== 'void' && !inv.isDuplicate), [invoices]);

  // Separate Membership vs PT Invoices
  const membershipInvoices = useMemo(() => validInvoices.filter((inv: any) => inv.billingType !== 'pt' && inv.billingType !== 'PT' && inv.invoiceType !== 'PT'), [validInvoices]);
  const ptInvoices = useMemo(() => validInvoices.filter((inv: any) => inv.billingType === 'pt' || inv.billingType === 'PT' || inv.invoiceType === 'PT'), [validInvoices]);
  const hasPtData = useMemo(() => ptInvoices.length > 0 || Boolean(member?.pt?.enabled || (member?.trainerId && member?.trainerId !== 'null' && member?.trainer !== 'Unassigned')), [ptInvoices, member]);

  const calcStats = (invList: any[]) => {
    const billed = invList.reduce((s: number, inv: any) => {
      const origAmt = Number(inv.originalAmount !== undefined ? inv.originalAmount : (inv.packagePrice || inv.price || inv.amount || 0));
      const discAmt = Number(inv.discountAmount !== undefined ? inv.discountAmount : (inv.discount || 0));
      const taxAmt = Number(inv.taxAmount !== undefined ? inv.taxAmount : (inv.tax || inv.gst || 0));
      const othAmt = Number(inv.otherCharges || 0);

      const calculatedNet = Math.max(0, origAmt - discAmt + taxAmt + othAmt);
      const net = Number(inv.netPayable !== undefined ? inv.netPayable : (calculatedNet > 0 ? calculatedNet : Number(inv.amount || 0)));
      return s + (isNaN(net) ? 0 : net);
    }, 0);

    const paid = invList.reduce((s: number, inv: any) => {
      const p = Number(inv.amountPaid !== undefined ? inv.amountPaid : (inv.paid !== undefined ? inv.paid : Number(inv.amount || 0)));
      return s + (isNaN(p) ? 0 : p);
    }, 0);

    const outstanding = Math.max(0, billed - paid);
    return { billed, paid, outstanding };
  };

  const memStats = useMemo(() => calcStats(membershipInvoices), [membershipInvoices]);
  const ptStats = useMemo(() => calcStats(ptInvoices), [ptInvoices]);

  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;

  // Print Action
  const handlePrint = (inv: any) => {
    setViewInvoice(inv);
    setTimeout(() => {
      window.print();
    }, 400);
  };

  // WhatsApp Bill
  const handleWhatsApp = (inv: any) => {
    const rawPhone = (member.phone || '').replace(/\D/g, '');
    const cleanPhone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
    const total = Number(inv.netPayable || inv.amount || 0);
    const invNum = inv.invoiceNumber || inv.invoice || 'INV-001';
    const planTitle = cleanPlanName(inv.plan || member.plan);
    const billDate = inv.date ? formatDate(inv.date) : formatDate(new Date().toISOString());
    const startDate = inv.startDate ? formatDate(inv.startDate) : formatDate(member.joinDate);
    const expiryDate = inv.expiryDate ? formatDate(inv.expiryDate) : formatDate(member.expiryDate);

    const msg = encodeURIComponent(
      `🏋️ *THE WARRIOR GYM — OFFICIAL INVOICE RECEIPT*\n\n` +
      `👤 *Member Name*: ${member.name}\n` +
      `📄 *Invoice No*: ${invNum}\n` +
      `📦 *Package*: ${planTitle}\n` +
      `📅 *Billing Date*: ${billDate}\n` +
      `🚀 *Start Date*: ${startDate}\n` +
      `🏁 *Expiry Date*: ${expiryDate}\n` +
      `💰 *Total Amount*: ₹${total.toLocaleString('en-IN')}\n` +
      `✅ *Payment Status*: ${(inv.status || 'paid').toUpperCase()}\n` +
      `💳 *Payment Mode*: ${inv.method || 'UPI'}\n\n` +
      `Thank you for training with The Warrior Gym! 💪`
    );
    window.open(`https://wa.me/${cleanPhone}?text=${msg}`, '_blank');
  };

  // Export Excel CSV
  const handleExportCSV = () => {
    if (invoices.length === 0) {
      toast.error('No invoice records to export!');
      return;
    }
    const headers = ['Date', 'Invoice No', 'Item Description', 'Item Amount', 'Discount', 'Net Payable', 'Amount Paid', 'Pending', 'Payment Method', 'Status'];
    const rows = invoices.map(inv => [
      inv.date || member.joinDate,
      inv.invoiceNumber || inv.invoice || '670',
      `Gym membership : ${inv.plan || member.plan}`,
      inv.originalAmount || inv.amount || 0,
      inv.discountAmount || inv.discount || 0,
      inv.netPayable || inv.amount || 0,
      inv.amountPaid || inv.paid || inv.amount || 0,
      Math.max(0, (Number(inv.netPayable || inv.amount) || 0) - (Number(inv.amountPaid || inv.paid) || 0)),
      inv.method || 'First payment',
      inv.status || 'paid'
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Billing_Statement_${member.name.replace(/\s+/g, '_')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Excel CSV Statement exported!');
  };

  // Export PDF Statement
  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* ── KPI Cards Header (Separate Membership & PT Totals) ───────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-7 gap-3">
        
        {/* MEMBERSHIP STATS GROUP */}
        <div className={`${hasPtData ? 'lg:col-span-3' : 'lg:col-span-6'} bg-orange-50/60 p-3.5 rounded-3xl border border-orange-200/60 space-y-2`}>
          <span className="text-[10px] font-black uppercase tracking-widest text-[#EA580C] block">MEMBERSHIP FINANCIALS</span>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white rounded-2xl p-3 border border-[#FED7AA]">
              <p className="text-[9px] font-bold text-slate-500 uppercase">Billed</p>
              <p className="text-base font-black text-[#10233f] font-mono">{fmt(memStats.billed)}</p>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-[#FED7AA]">
              <p className="text-[9px] font-bold text-[#EA580C] uppercase">Collected</p>
              <p className="text-base font-black text-[#EA580C] font-mono">{fmt(memStats.paid)}</p>
            </div>
            <div className="bg-white rounded-2xl p-3 border border-slate-200">
              <p className="text-[9px] font-bold text-slate-500 uppercase">Pending</p>
              <p className={`text-base font-black font-mono ${memStats.outstanding > 0 ? 'text-red-600' : 'text-[#EA580C]'}`}>{fmt(memStats.outstanding)}</p>
            </div>
          </div>
        </div>

        {/* PT STATS GROUP (Only rendered if PT exists for member) */}
        {hasPtData && (
          <div className="lg:col-span-3 bg-amber-50/50 p-3.5 rounded-3xl border border-amber-200/80 space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-800 block">PERSONAL TRAINING (PT) FINANCIALS</span>
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded-2xl p-3 border border-amber-200">
                <p className="text-[9px] font-bold text-slate-500 uppercase">PT Billed</p>
                <p className="text-base font-black text-[#10233f] font-mono">{fmt(ptStats.billed)}</p>
              </div>
              <div className="bg-white rounded-2xl p-3 border border-amber-300">
                <p className="text-[9px] font-bold text-amber-800 uppercase">PT Collected</p>
                <p className="text-base font-black text-amber-700 font-mono">{fmt(ptStats.paid)}</p>
              </div>
              <div className="bg-white rounded-2xl p-3 border border-slate-200">
                <p className="text-[9px] font-bold text-slate-500 uppercase">PT Pending</p>
                <p className={`text-base font-black font-mono ${ptStats.outstanding > 0 ? 'text-red-600' : 'text-amber-800'}`}>{fmt(ptStats.outstanding)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Create New Bill Action Card (1 Card) */}
        <div className="lg:col-span-1 bg-gradient-to-br from-[#EA580C] to-[#FB923C] rounded-3xl p-3.5 text-white shadow-md flex flex-col justify-between">
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-orange-100 block">ACTIONS</span>
            <p className="text-xs font-black mt-0.5">New Invoice</p>
          </div>
          <button
            onClick={() => {
              if (onOpenCreateBill) onOpenCreateBill();
              else setShowNewBillModal(true);
            }}
            className="mt-2 py-2 px-3 bg-white text-[#EA580C] hover:bg-[#FFF7ED] rounded-xl text-[11px] font-black transition-all flex items-center justify-center gap-1 shadow-xs border-none cursor-pointer"
          >
            <Plus size={14} /> + New Bill
          </button>
        </div>

      </div>

      {/* ── Official Billing History Table Module (Spacious & Clean Layout) ── */}
      <div className="bg-white rounded-3xl border border-slate-300 shadow-md relative min-h-[480px] overflow-hidden">
        {/* Table Top Header */}
        <div className="bg-[#EA580C] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Receipt size={22} className="text-orange-100" />
            <div>
              <h3 className="font-extrabold text-base tracking-wide">Billing History</h3>
              <p className="text-[11px] text-orange-100 font-medium">Complete payment records, invoices, and transaction breakdown</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Filter Tabs: ALL, MEMBERSHIP, PT */}
            <div className="flex items-center gap-1 bg-blue-900/50 p-1 rounded-xl border border-white/20">
              {(['all', 'membership', 'pt'] as const).map((bType) => (
                <button
                  key={bType}
                  type="button"
                  onClick={() => setBillingTypeFilter(bType)}
                  className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider transition-all border-none cursor-pointer ${
                    billingTypeFilter === bType
                      ? 'bg-white text-blue-900 shadow-sm'
                      : 'text-orange-100 hover:text-white bg-transparent'
                  }`}
                >
                  {bType === 'all' ? 'ALL' : bType === 'membership' ? 'MEMBERSHIP' : 'PT'}
                </button>
              ))}
            </div>

            <span className="text-xs bg-white/20 text-white font-black px-3.5 py-1.5 rounded-full border border-white/20">
              {member.name} ({filteredInvoices.length} Entries)
            </span>
          </div>
        </div>

        {/* Scrollable Container with Extra Bottom Padding to Prevent Dropdown Clipping */}
        <div className="overflow-x-auto custom-scrollbar pb-24">
          <table className="w-full text-left text-xs border-collapse min-w-[1200px]">
            <thead>
              <tr className="bg-[#0e68d6] text-white font-extrabold text-[11px] uppercase tracking-wider border-b border-blue-700">
                <th className="px-4 py-4 whitespace-nowrap">Date</th>
                <th className="px-4 py-4 whitespace-nowrap">Invoice No</th>
                <th className="px-4 py-4 whitespace-nowrap min-w-[250px]">Package / Description</th>
                <th className="px-4 py-4 text-right whitespace-nowrap">Original Amount</th>
                <th className="px-4 py-4 text-right whitespace-nowrap">Discount</th>
                <th className="px-4 py-4 text-right whitespace-nowrap">Tax</th>
                <th className="px-4 py-4 text-right whitespace-nowrap font-black">Net Payable</th>
                <th className="px-4 py-4 text-right whitespace-nowrap font-black">Amount Paid</th>
                <th className="px-4 py-4 text-right whitespace-nowrap">Pending</th>
                <th className="px-4 py-4 whitespace-nowrap">Method</th>
                <th className="px-4 py-4 text-center whitespace-nowrap">Status</th>
                <th className="px-4 py-4 text-center whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 text-slate-800 font-medium">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-16 text-center text-slate-400 font-bold text-sm">
                    {isHold ? (
                      <div className="flex flex-col items-center justify-center gap-3 py-6">
                        <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
                          <Receipt size={24} />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-black text-slate-800">No invoices yet</h4>
                          <p className="text-xs text-slate-500 font-medium max-w-sm">
                            This member is on HOLD waiting for membership billing. Create an official bill to activate their membership.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            if (onOpenCreateBill) onOpenCreateBill();
                            else setShowNewBillModal(true);
                          }}
                          className="mt-2 py-2.5 px-5 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all border-none cursor-pointer shadow-md flex items-center gap-1.5"
                        >
                          <Plus size={14} /> + Create Bill
                        </button>
                      </div>
                    ) : (
                      `No ${billingTypeFilter === 'all' ? 'billing' : billingTypeFilter.toUpperCase()} history recorded yet. Click "Create New Bill" or "+ Add PT Bill" to add an entry.`
                    )}
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv: any, idx: number) => {
                  const invNum = inv.invoiceNumber || inv.invoice || '670';
                  const origItemAmt = Number(inv.originalAmount !== undefined ? inv.originalAmount : (inv.price || inv.amount || 0));
                  const discountAmt = Number(inv.discountAmount !== undefined ? inv.discountAmount : (inv.discount || 0));
                  const taxAmt = Number(inv.taxAmount !== undefined ? inv.taxAmount : (inv.tax || inv.gst || 0));
                  const otherAmt = Number(inv.otherCharges || 0);

                  const computedNet = Math.max(0, origItemAmt - discountAmt + taxAmt + otherAmt);
                  const netPayable = Number(inv.netPayable !== undefined ? inv.netPayable : (computedNet > 0 ? computedNet : Number(inv.amount || 0)));
                  const paidAmt = Number(inv.amountPaid !== undefined ? inv.amountPaid : (inv.paid !== undefined ? inv.paid : netPayable));
                  const pendingAmt = Math.max(0, netPayable - paidAmt);
                  const startDate = inv.startDate || member.joinDate || '20-08-2026';
                  const expiryDate = inv.expiryDate || member.expiryDate || '19-10-2026';
                  const planTitle = inv.plan || member.plan || 'Gym membership';

                  const displayStatus = pendingAmt <= 0 ? 'PAID' : (paidAmt > 0 ? 'PARTIAL' : 'PENDING');
                  const isPt = inv.billingType === 'pt';

                  return (
                    <tr key={inv.id || idx} className="hover:bg-orange-50/60 transition-colors border-b border-slate-100">
                      {/* Date */}
                      <td className="px-4 py-4 whitespace-nowrap font-mono text-slate-700 font-bold">
                        {inv.date || formatDate(member.joinDate)}
                      </td>

                      {/* Invoice No */}
                      <td className="px-4 py-4 whitespace-nowrap font-mono font-black text-[#C2410C]">
                        {invNum}
                      </td>

                      {/* Item Description & Validity Period */}
                      <td className="px-4 py-4 min-w-[250px]">
                        <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider border ${
                            isPt
                              ? 'bg-amber-100 text-amber-900 border-amber-300'
                              : 'bg-[#FFEDD5] text-[#9A3412] border-[#FDBA74]'
                          }`}>
                            {isPt ? 'PERSONAL TRAINING' : 'MEMBERSHIP'}
                          </span>
                          {isPt && (inv.trainerName || member.trainer) && (
                            <span className="text-[10px] font-extrabold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Trainer: {inv.trainerName || member.trainer}
                            </span>
                          )}
                        </div>
                        <div className="font-extrabold text-slate-900">{planTitle}</div>
                        <div className="text-[11px] text-slate-500 font-mono mt-0.5">({startDate} to {expiryDate})</div>
                      </td>

                      {/* Original Amount */}
                      <td className="px-4 py-4 text-right font-mono font-bold text-slate-900">₹{origItemAmt.toLocaleString('en-IN')}</td>

                      {/* Discount */}
                      <td className="px-4 py-4 text-right font-mono text-emerald-600 font-bold">{discountAmt > 0 ? `- ₹${discountAmt.toLocaleString('en-IN')}` : '₹0'}</td>

                      {/* Tax */}
                      <td className="px-4 py-4 text-right font-mono text-slate-500">{taxAmt > 0 ? `₹${taxAmt.toLocaleString('en-IN')}` : '₹0'}</td>

                      {/* Net payable */}
                      <td className="px-4 py-4 text-right font-mono font-black text-slate-900">₹{netPayable.toLocaleString('en-IN')}</td>

                      {/* Amount paid */}
                      <td className="px-4 py-4 text-right font-mono font-black text-emerald-600">₹{paidAmt.toLocaleString('en-IN')}</td>

                      {/* Pending */}
                      <td className="px-4 py-4 text-right font-mono font-bold text-red-500">{pendingAmt > 0 ? `₹${pendingAmt.toLocaleString('en-IN')}` : '₹0'}</td>

                      {/* Payment type */}
                      <td className="px-4 py-4 whitespace-nowrap font-bold text-slate-700">
                        <span className="px-2 py-1 bg-slate-100 rounded text-[11px] font-bold text-slate-700">
                          {inv.method || 'Cash'}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 whitespace-nowrap text-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider inline-block ${
                          displayStatus === 'PAID' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' :
                          displayStatus === 'PARTIAL' ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          'bg-red-100 text-red-800 border border-red-300'
                        }`}>
                          {displayStatus}
                        </span>
                      </td>

                      {/* Actions & Dropdown (ONLY ACTION button, no standalone icons) */}
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 relative">
                          {/* ACTION Dropdown Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              if (openDropdown?.invoice?.id === (inv.id || inv.invoiceNumber)) {
                                setOpenDropdown(null);
                              } else {
                                setOpenDropdown({ invoice: inv, anchorRect: rect });
                              }
                            }}
                            className="px-3.5 py-1.5 bg-[#d32f2f] hover:bg-[#c62828] text-white font-black rounded-lg text-xs uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer border-none shadow-md active:scale-95"
                          >
                            <span>ACTION</span>
                            <ChevronDown size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Bottom Export Bar (EXCEL & PDF Buttons) */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500 font-bold">
            Showing <span className="font-extrabold text-slate-800">{invoices.length}</span> billing transactions
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportCSV}
              className="px-5 py-2.5 bg-[#d32f2f] hover:bg-[#c62828] text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border-none shadow-md active:scale-95"
            >
              <FileSpreadsheet size={15} />
              <span>EXCEL</span>
            </button>

            <button
              type="button"
              onClick={handleExportPDF}
              className="px-5 py-2.5 bg-[#d32f2f] hover:bg-[#c62828] text-white font-black rounded-xl text-xs uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer border-none shadow-md active:scale-95"
            >
              <FileCode size={15} />
              <span>PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* ── 1. VIEW INVOICE MODAL (Official Document View) ───────────────────── */}
      {viewInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-6 space-y-6 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-[#EA580C]" />
                <h3 className="text-lg font-black text-slate-900">Official Tax Invoice &amp; Receipt</h3>
              </div>
              <button onClick={() => setViewInvoice(null)} className="p-2 rounded-full text-slate-400 hover:bg-slate-100 border-none bg-transparent cursor-pointer">
                <X size={18} />
              </button>
            </div>

            {/* Universal Official Invoice Receipt Template */}
            <OfficialInvoiceReceipt invoice={viewInvoice} member={member} />

            <div className="flex items-center gap-3 max-w-[800px] mx-auto">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3.5 bg-[#EA580C] text-white rounded-xl text-xs font-black hover:bg-orange-700 transition-all flex items-center justify-center gap-2 border-none cursor-pointer shadow-md"
              >
                <Printer size={16} /> Print Official Invoice
              </button>
              <button
                onClick={() => setViewInvoice(null)}
                className="py-3.5 px-6 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-all border-none cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. CREATE NEW BILL MODAL ─────────────────────────────────────────── */}
      <CreateNewBillModal
        isOpen={showNewBillModal}
        member={member}
        onClose={() => setShowNewBillModal(false)}
        onSaved={() => fetchMembers()}
      />

      {/* ── 3. RENEWAL / UPGRADE WIZARD MODAL ─────────────────────────────────── */}
      {showUpgradeModal && (
        <RenewalWizardModal
          isOpen={showUpgradeModal}
          member={member}
          onClose={() => {
            setShowUpgradeModal(false);
            fetchMembers();
          }}
        />
      )}

      {/* ── 4. PORTAL FLOATING ACTION DROPDOWN (NEVER CLIPPED) ──────────────── */}
      {openDropdown && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            left: Math.max(12, Math.min(window.innerWidth - 220, openDropdown.anchorRect.right - 200)),
            top: window.innerHeight - openDropdown.anchorRect.bottom >= 300
              ? openDropdown.anchorRect.bottom + 6
              : Math.max(12, openDropdown.anchorRect.top - 300),
            zIndex: 99999
          }}
          className="bg-white border border-slate-200 rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-52 py-2 text-left text-xs font-bold text-slate-800 animate-in fade-in select-none"
        >
          <button
            type="button"
            onClick={() => {
              setViewInvoice(openDropdown.invoice);
              setOpenDropdown(null);
            }}
            className="w-full px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-800 transition-colors"
          >
            <Eye size={15} className="text-[#EA580C]" />
            <span>View Bill</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedInvoiceForEdit(openDropdown.invoice);
              setOpenDropdown(null);
            }}
            className="w-full px-4 py-2.5 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-800 transition-colors font-extrabold"
          >
            <Edit3 size={15} className="text-indigo-600" />
            <span>Edit Bill</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handlePrint(openDropdown.invoice);
              setOpenDropdown(null);
            }}
            className="w-full px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-800 transition-colors"
          >
            <Printer size={15} className="text-slate-600" />
            <span>Print Bill</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleExportPDF();
              setOpenDropdown(null);
            }}
            className="w-full px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-800 transition-colors"
          >
            <FileCode size={15} className="text-rose-600" />
            <span>Download PDF</span>
          </button>

          <button
            type="button"
            onClick={() => {
              handleExportCSV();
              setOpenDropdown(null);
            }}
            className="w-full px-4 py-2.5 hover:bg-slate-50 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-800 transition-colors"
          >
            <FileSpreadsheet size={15} className="text-emerald-600" />
            <span>Download Excel</span>
          </button>

          <div className="border-t border-slate-100 my-1"></div>

          <button
            type="button"
            onClick={() => {
              handleWhatsApp(openDropdown.invoice);
              setOpenDropdown(null);
            }}
            className="w-full px-4 py-2.5 hover:bg-emerald-50 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-emerald-700 font-extrabold transition-colors"
          >
            <MessageSquare size={15} className="text-emerald-600" />
            <span>WhatsApp Bill</span>
          </button>

          <div className="border-t border-slate-100 my-1"></div>

          <button
            type="button"
            onClick={() => {
              setInvoiceToDelete(openDropdown.invoice);
              setOpenDropdown(null);
            }}
            className="w-full px-4 py-2.5 hover:bg-red-50 text-red-600 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer font-extrabold transition-colors"
          >
            <Trash2 size={15} className="text-red-500" />
            <span>Delete Bill</span>
          </button>
        </div>,
        document.body
      )}

      {/* ── 5. DELETE BILL CONFIRMATION MODAL ───────────────────────────────── */}
      {invoiceToDelete && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 space-y-4 border border-slate-100 text-left">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center font-black">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900">Delete Billing Transaction?</h3>
                <p className="text-xs text-slate-500 font-medium">This action cannot be undone.</p>
              </div>
            </div>

            <div className="bg-slate-50 rounded-2xl p-3.5 space-y-2 text-xs border border-slate-200/80">
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Member Name:</span>
                <span className="font-extrabold text-slate-800">{member.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Invoice Number:</span>
                <span className="font-mono font-extrabold text-[#EA580C]">{invoiceToDelete.invoiceNumber || invoiceToDelete.invoice || 'INV-000'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Package:</span>
                <span className="font-extrabold text-slate-800">{invoiceToDelete.plan || member.plan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Amount Billed / Paid:</span>
                <span className="font-mono font-extrabold text-emerald-600">
                  ₹{Number(invoiceToDelete.netPayable || invoiceToDelete.amount || 0).toLocaleString('en-IN')} / ₹{Number(invoiceToDelete.amountPaid !== undefined ? invoiceToDelete.amountPaid : (invoiceToDelete.paid || 0)).toLocaleString('en-IN')}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-bold">Payment Date:</span>
                <span className="font-mono font-bold text-slate-700">{invoiceToDelete.date || 'N/A'}</span>
              </div>
            </div>

            <p className="text-[11px] text-amber-800 font-bold bg-amber-50 p-2.5 rounded-xl border border-amber-200 leading-snug">
              ⚠️ Deleting this billing document permanently removes it from Firestore and updates member totals, today's collection, and active membership dates.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleExecuteDeleteBill}
                className="flex-1 py-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 text-white rounded-xl text-xs font-black transition-all border-none cursor-pointer shadow-md flex items-center justify-center gap-1.5"
              >
                {isDeleting ? 'Deleting...' : 'Delete Bill'}
              </button>
              <button
                type="button"
                onClick={() => setInvoiceToDelete(null)}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all border-none cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 5. EDIT BILLING MODAL (FULL PRODUCTION FLOW) ────────────────────── */}
      {selectedInvoiceForEdit && (
        <EditBillingModal
          isOpen={!!selectedInvoiceForEdit}
          invoice={selectedInvoiceForEdit}
          member={member}
          onClose={() => setSelectedInvoiceForEdit(null)}
          onSaved={(updatedInv, updatedMem, shouldGenerateReceipt) => {
            setInvoices((prev: any[]) => prev.map(inv => {
              const matches = (inv.id && inv.id === updatedInv.id) ||
                (inv.invoiceNumber && inv.invoiceNumber === updatedInv.invoiceNumber) ||
                (inv.invoice && inv.invoice === updatedInv.invoice);
              return matches ? { ...inv, ...updatedInv } : inv;
            }));
            if (updatedMem) {
              setMember((prev: any) => ({ ...prev, ...updatedMem }));
            }
            if (shouldGenerateReceipt) {
              setViewInvoice(updatedInv);
            }
            fetchMembers(true);
          }}
        />
      )}
    </div>
  );
}
