'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Activity, Calendar, CreditCard, ShieldCheck, Dumbbell,
  Clock, MapPin, Zap, User, ChevronDown, AlertCircle
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { formatDate, formatTime, cleanPlanName } from '@/lib/utils';

export default function ActivityTimelineTab({ member }: { member: any }) {
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'memberships' | 'payments'>('all');
  const [displayCount, setDisplayCount] = useState(50);

  const docId = member?.id || member?.uid || member?.memberId;
  const memberCode = member?.memberId || '';

  // 1. Real-time Firestore Listener for member Payments & PT Purchases
  useEffect(() => {
    if (!docId && !memberCode) return;
    setLoading(true);

    const qPayments = query(collection(db, 'payments'), where('memberId', '==', docId));

    const unsubPayments = onSnapshot(qPayments, (snap) => {
      const livePayments = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Deduplicate payments by id or invoice number
      const payMap = new Map<string, any>();
      livePayments.forEach((p: any) => {
        const key = p.id || p.invoiceNumber || p.invoice;
        payMap.set(key, p);
      });

      setPaymentsList(Array.from(payMap.values()));
      setLoading(false);
    }, (err) => {
      console.warn("Timeline payments listener notice:", err);
      setLoading(false);
    });

    return () => unsubPayments();
  }, [docId, memberCode]);

  // 2. Build Combined Real Timeline Events (Financial, PT, Membership, Account)
  const timelineEvents = useMemo(() => {
    if (!member) return [];

    const events: any[] = [];
    const processedInvoiceNums = new Set<string>();

    // A. REAL PAYMENT & PT BILLING EVENTS (Primary single source of truth for billing transactions)
    paymentsList.forEach((p: any) => {
      const invNum = (p.invoiceNumber || p.invoice || p.id || 'INV-000').trim();
      processedInvoiceNums.add(invNum);
      if (p.id) processedInvoiceNums.add(p.id.trim());

      const origAmt = Number(p.originalAmount !== undefined ? p.originalAmount : (p.price || p.amount || 0));
      const discAmt = Number(p.discountAmount !== undefined ? p.discountAmount : (p.discount || 0));
      const taxAmt = Number(p.taxAmount !== undefined ? p.taxAmount : (p.tax || p.gst || 0));
      const othAmt = Number(p.otherCharges || 0);

      const calculatedNet = Math.max(0, origAmt - discAmt + taxAmt + othAmt);
      const netPayable = Number(p.netPayable !== undefined ? p.netPayable : (calculatedNet > 0 ? calculatedNet : Number(p.amount || 0)));
      const paidAmt = Number(p.amountPaid !== undefined ? p.amountPaid : (p.paid !== undefined ? p.paid : netPayable));
      const pendingAmt = Math.max(0, netPayable - paidAmt);

      const rawDate = p.date || p.createdAt || member?.joinDate || new Date().toISOString();
      const isPt = p.billingType === 'pt';

      if (isPt) {
        // SPECIALIZED PT PURCHASE TIMELINE EVENT
        events.push({
          id: `pt_pay_${p.id || invNum}`,
          category: 'payments',
          subCategory: 'pt',
          type: 'PERSONAL TRAINING PURCHASE',
          title: p.package || p.plan || 'Personal Training',
          trainerName: p.trainerName || member?.trainer || 'Assigned Trainer',
          sessionCount: p.sessionCount || 12,
          usedSessions: p.usedSessions || 0,
          remainingSessions: p.remainingSessions || p.sessionCount || 12,
          date: rawDate,
          time: p.createdAt ? formatTime(p.createdAt) : '11:00 AM',
          invoice: invNum,
          startDate: p.ptStartDate || p.startDate || 'N/A',
          expiryDate: p.ptEndDate || p.expiryDate || 'N/A',
          originalAmount: origAmt,
          discountAmount: discAmt,
          taxAmount: taxAmt,
          netPayable,
          amountPaid: paidAmt,
          pendingAmount: pendingAmt,
          paymentMethod: p.method || p.paymentMethod || 'UPI',
          status: pendingAmt <= 0 ? 'PAID' : (paidAmt > 0 ? 'PARTIAL' : 'PENDING'),
          icon: Dumbbell,
          color: 'bg-amber-600 text-white',
          badgeBg: 'bg-amber-100 text-amber-900 border-amber-300',
          rawTimestamp: new Date(rawDate).getTime(),
        });
      } else {
        // STANDARD MEMBERSHIP PAYMENT TIMELINE EVENT
        const planTitle = cleanPlanName(p.plan || member?.plan || 'Gym Membership');
        events.push({
          id: `pay_${p.id || invNum}`,
          category: 'payments',
          subCategory: 'membership',
          type: 'PAYMENT RECEIVED',
          title: planTitle,
          date: rawDate,
          time: p.createdAt ? formatTime(p.createdAt) : '10:30 AM',
          invoice: invNum,
          startDate: p.startDate || member?.startDate || 'N/A',
          expiryDate: p.expiryDate || member?.expiryDate || 'N/A',
          originalAmount: origAmt,
          discountAmount: discAmt,
          taxAmount: taxAmt,
          netPayable,
          amountPaid: paidAmt,
          pendingAmount: pendingAmt,
          paymentMethod: p.method || p.paymentMethod || 'UPI',
          status: pendingAmt <= 0 ? 'PAID' : (paidAmt > 0 ? 'PARTIAL' : 'PENDING'),
          icon: CreditCard,
          color: 'bg-emerald-500 text-white',
          badgeBg: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          rawTimestamp: new Date(rawDate).getTime(),
        });
      }
    });

    // B. NON-PAYMENT MEMBERSHIP EVENTS (Deduplicate against payments to prevent duplicate INITIAL MEMBERSHIP events)
    const historyItems = Array.isArray(member?.membershipHistory) ? member.membershipHistory : [];
    historyItems.forEach((h: any, idx: number) => {
      const invNum = (h.invoiceId || h.invoiceNumber || h.id || '').trim();

      // STRICT RULE: If this transaction already has a payment event generated above, DO NOT generate a duplicate membership history card!
      if (invNum && processedInvoiceNums.has(invNum)) {
        return;
      }

      const planTitle = cleanPlanName(h.plan || h.packageName || member?.plan);
      const rawDate = h.createdAt || h.startDate || member?.joinDate || new Date().toISOString();

      events.push({
        id: `mem_hist_${h.id || idx}`,
        category: 'memberships',
        type: h.type || (idx === 0 ? 'INITIAL MEMBERSHIP' : 'MEMBERSHIP RENEWAL'),
        title: planTitle,
        date: rawDate,
        time: h.createdAt ? formatTime(h.createdAt) : '10:00 AM',
        invoice: invNum || `INV-HIST-${idx + 1}`,
        startDate: h.startDate || 'N/A',
        expiryDate: h.expiryDate || 'N/A',
        amountPaid: Number(h.amountPaid || h.amount || 0),
        status: h.status || 'ACTIVE',
        icon: ShieldCheck,
        color: 'bg-purple-600 text-white',
        badgeBg: 'bg-purple-100 text-purple-800 border-purple-300',
        rawTimestamp: new Date(rawDate).getTime(),
      });
    });

    // C. ACCOUNT CREATION EVENT
    if (member?.joinDate || member?.createdAt) {
      const joinDateStr = member.joinDate || member.createdAt;
      events.push({
        id: 'account_created_evt',
        category: 'memberships',
        type: 'ACCOUNT CREATED',
        title: 'Joined The Warrior Gym OS',
        date: joinDateStr,
        time: '09:00 AM',
        status: 'COMPLETED',
        description: `Registered at branch ${member.branch || 'Mohali, Punjab'}`,
        icon: User,
        color: 'bg-slate-700 text-white',
        badgeBg: 'bg-slate-100 text-slate-800 border-slate-300',
        rawTimestamp: new Date(joinDateStr).getTime() || 0,
      });
    }

    // Deduplicate timeline events by ID
    const eventMap = new Map<string, any>();
    events.forEach(e => eventMap.set(e.id, e));

    // Sort chronologically descending (newest first)
    return Array.from(eventMap.values()).sort((a, b) => b.rawTimestamp - a.rawTimestamp);
  }, [member, paymentsList]);

  // Filter events by selected category
  const filteredEvents = useMemo(() => {
    if (filter === 'all') return timelineEvents;
    return timelineEvents.filter((e) => e.category === filter || (filter === 'memberships' && e.subCategory === 'membership'));
  }, [timelineEvents, filter]);

  const visibleEvents = filteredEvents.slice(0, displayCount);

  return (
    <div className="w-full bg-white rounded-[32px] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-slate-100 p-8 space-y-6 text-slate-900 text-left font-sans">
      {/* ── HEADER & CATEGORY FILTERS ────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
              <Activity size={22} />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">Activity Timeline &amp; Audit Logs</h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Deduplicated real-time audit log of payments, PT purchases, membership renewals, and account events.
          </p>
        </div>

        {/* Category Filters (Memberships & Payments) */}
        <div className="flex items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl shrink-0">
          {(['all', 'memberships', 'payments'] as const).map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setFilter(cat);
                setDisplayCount(50);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all uppercase tracking-wider border-none cursor-pointer ${
                filter === cat
                  ? 'bg-white text-slate-900 shadow-md'
                  : 'text-slate-500 hover:text-slate-800 bg-transparent'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── TIMELINE STREAM ─────────────────────────────────────────────────── */}
      {visibleEvents.length > 0 ? (
        <div className="relative pl-6 sm:pl-10 space-y-6 before:absolute before:left-3 sm:before:left-5 before:top-4 before:bottom-4 before:w-0.5 before:bg-slate-200">
          {visibleEvents.map((evt, idx) => {
            const Icon = evt.icon || Activity;
            return (
              <motion.div
                key={evt.id || idx}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.02 }}
                className="relative group"
              >
                {/* Timeline Node Icon Circle */}
                <div className={`absolute -left-6 sm:-left-10 top-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full ${evt.color} flex items-center justify-center shadow-md ring-4 ring-white z-10`}>
                  <Icon size={14} className="sm:w-4 sm:h-4" />
                </div>

                {/* Event Card */}
                <div className="bg-slate-50 hover:bg-slate-100/80 transition-all rounded-2xl border border-slate-200/80 p-5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${evt.badgeBg}`}>
                        {evt.type}
                      </span>
                      {evt.status && (
                        <span className="px-2 py-0.5 bg-slate-200/60 text-slate-700 text-[10px] font-black uppercase rounded-full">
                          {evt.status}
                        </span>
                      )}
                      {evt.invoice && (
                        <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md">
                          {evt.invoice}
                        </span>
                      )}
                    </div>

                    <div className="text-[11px] font-bold text-slate-400 flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {formatDate(evt.date)}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} /> {evt.time}
                      </span>
                    </div>
                  </div>

                  {/* Event Title */}
                  <h3 className="text-base font-black text-slate-900 tracking-tight">{evt.title}</h3>

                  {/* Financial & Detailed Transaction Breakdown Card */}
                  {evt.category === 'payments' && (
                    <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Validity Period</span>
                        <span className="font-bold text-slate-800 text-[11px]">
                          {evt.startDate !== 'N/A' ? formatDate(evt.startDate) : 'N/A'} → {evt.expiryDate !== 'N/A' ? formatDate(evt.expiryDate) : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Net Payable</span>
                        <span className="font-black text-slate-900 font-mono">₹{(evt.netPayable || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Amount Paid</span>
                        <span className="font-black text-emerald-600 font-mono">₹{(evt.amountPaid || 0).toLocaleString('en-IN')}</span>
                      </div>
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Payment Method</span>
                        <span className="font-black text-slate-800 uppercase">{evt.paymentMethod}</span>
                      </div>
                    </div>
                  )}

                  {/* Account / Membership Details */}
                  {evt.category === 'memberships' && (
                    <div className="bg-white rounded-xl border border-slate-200 p-3 text-xs flex justify-between items-center">
                      <div>
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">Validity Range</span>
                        <span className="font-bold text-slate-800">
                          {evt.startDate !== 'N/A' ? formatDate(evt.startDate) : 'N/A'} → {evt.expiryDate !== 'N/A' ? formatDate(evt.expiryDate) : 'N/A'}
                        </span>
                      </div>
                      {evt.amountPaid > 0 && (
                        <div className="text-right">
                          <span className="text-[10px] font-bold text-slate-400 uppercase block">Amount Billed</span>
                          <span className="font-black text-slate-900 font-mono">₹{evt.amountPaid.toLocaleString('en-IN')}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="py-16 text-center text-slate-400 space-y-2">
          <Activity size={32} className="mx-auto text-slate-300" />
          <p className="text-sm font-bold text-slate-500">No timeline audit events found for this filter</p>
        </div>
      )}

      {/* Show More Pagination */}
      {filteredEvents.length > displayCount && (
        <div className="pt-4 text-center">
          <button
            type="button"
            onClick={() => setDisplayCount(prev => prev + 50)}
            className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-black transition-all border-none cursor-pointer inline-flex items-center gap-1.5"
          >
            <span>Load More Timeline Events ({filteredEvents.length - displayCount} remaining)</span>
            <ChevronDown size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
