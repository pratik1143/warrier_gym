'use client';

import React, { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, IndianRupee, Receipt, Plus, Download, Search,
  TrendingUp, X, RefreshCw, Printer, Share2, CheckCircle2,
  Smartphone, Banknote, Landmark, Clock, AlertCircle, ArrowLeft,
  Sparkles, ShieldCheck, UserCheck, Calendar, ChevronRight, Check,
  Percent, Tag, DollarSign, Dumbbell, User, Award, ArrowRight, Eye, FileText
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, addDoc, arrayUnion, doc, updateDoc, getDocs, getDoc, query, where, writeBatch } from 'firebase/firestore';
import { useGymStore } from '@/store';
import toast from '@/lib/toast';
import { formatDate, formatPhoneNumber, cleanPlanName } from '@/lib/utils';
import OfficialInvoiceReceipt from '../../components/OfficialInvoiceReceipt';
import { calculateUpgradeBill, extractPriceFromPlanString, getDefaultPriceForPlan, isInvoiceMatchingMember, normalizeBillingTransaction, resolveMemberIdentifierKeys } from '@/services/billingService';
import { getCanonicalISTDate } from '@/hooks/useTodaysPayments';

// ─── CRM Blue Design Tokens ──────────────────────────────────────────
const BLUE_PRIMARY = '#EA580C';
const BLUE_GRADIENT = 'bg-gradient-to-r from-[#EA580C] via-[#C2410C] to-[#C2410C]';
const BLUE_GRADIENT_HOVER = 'hover:from-[#C2410C] hover:to-[#043775]';

type BillingMode = 'new' | 'renew' | 'upgrade' | 'pt' | 'collect' | 'edit';

const MODE_METADATA: Record<BillingMode, { title: string; subtitle: string }> = {
  upgrade: { title: 'BILLING TERMINAL', subtitle: 'Membership Upgrade & Payment' },
  renew: { title: 'BILLING TERMINAL', subtitle: 'Membership Renewal & Extension' },
  new: { title: 'BILLING TERMINAL', subtitle: 'New Membership Enrollment' },
  pt: { title: 'BILLING TERMINAL', subtitle: 'Personal Training Session Billing' },
  collect: { title: 'BILLING TERMINAL', subtitle: 'Pending Payment & Balance Settlement' },
  edit: { title: 'BILLING TERMINAL', subtitle: 'Invoice Revision & Adjustment' },
};

function UniversalBillingTerminalContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const modeParam = (searchParams.get('mode') as BillingMode) || 'upgrade';
  const memberIdParam = searchParams.get('id') || searchParams.get('memberId') || searchParams.get('member') || '';

  const { members, plans, payments, fetchMembers, fetchPlans, fetchPayments } = useGymStore();

  const [activeMode, setActiveMode] = useState<BillingMode>(modeParam);
  const [selectedMemberId, setSelectedMemberId] = useState<string>(memberIdParam);
  const [memberSearch, setMemberSearch] = useState('');
  const [showMemberDropdown, setShowMemberDropdown] = useState(false);
  const [billingLedgerReady, setBillingLedgerReady] = useState(false);
  const memberDropdownRef = useRef<HTMLDivElement>(null);

  // Sync mode URL param
  useEffect(() => {
    if (modeParam && MODE_METADATA[modeParam]) {
      setActiveMode(modeParam);
    }
  }, [modeParam]);

  // Click outside to close member search dropdown
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (memberDropdownRef.current && !memberDropdownRef.current.contains(e.target as Node)) {
        setShowMemberDropdown(false);
      }
    };
    if (showMemberDropdown) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [showMemberDropdown]);

  // Selected Member Object (Multi-field Resilient Matching)
  const selectedMember = useMemo(() => {
    if (!selectedMemberId) return null;
    const target = selectedMemberId.trim().toLowerCase();
    const cleanNum = target.replace(/^(az-2026-|az-)/i, '');

    return members.find((m: any) => {
      if (!m) return false;
      const mId = String(m.id || '').toLowerCase();
      const mUid = String(m.uid || '').toLowerCase();
      const mDocId = String(m.docId || '').toLowerCase();
      const mMemberId = String(m.memberId || '').toLowerCase();
      const mClientId = String(m.clientId || '').toLowerCase();
      const mCode = String(m.memberCode || '').toLowerCase();

      if (mId === target || mUid === target || mDocId === target || mMemberId === target || mClientId === target || mCode === target) {
        return true;
      }
      if (cleanNum && cleanNum.length >= 2) {
        const mCleanMember = mMemberId.replace(/^(az-2026-|az-)/i, '');
        const mCleanClient = mClientId.replace(/^(az-2026-|az-)/i, '');
        if (mCleanMember === cleanNum || mCleanClient === cleanNum) return true;
      }
      return false;
    }) || null;
  }, [members, selectedMemberId]);

  // Sync initial member search label only when selectedMemberId changes
  useEffect(() => {
    if (selectedMember) {
      setMemberSearch(`${selectedMember.name} (${selectedMember.memberId || selectedMember.id})`);
    } else if (selectedMemberId && !selectedMember) {
      fetchMembers(true);
      (async () => {
        try {
          const memCol = collection(db, 'members');
          const qFields = ['memberId', 'clientId', 'uid', 'docId', 'memberCode'];
          for (const field of qFields) {
            const snap = await getDocs(query(memCol, where(field, '==', selectedMemberId)));
            if (!snap.empty) {
              const d = snap.docs[0];
              setSelectedMemberId(d.id);
              break;
            }
          }
        } catch (e) {
          // direct lookup notice
        }
      })();
    } else if (!selectedMemberId) {
      setMemberSearch('');
    }
  }, [selectedMemberId]);

  useEffect(() => {
    if (plans.length === 0) fetchPlans();
  }, []);

  useEffect(() => {
    let active = true;
    fetchPayments(true).finally(() => {
      if (active) setBillingLedgerReady(true);
    });
    return () => { active = false; };
  }, [fetchPayments]);

  // ── FIXATION OF AUTO-GENERATED INVOICE NUMBER BEFORE CONFIRMATION ───────
  const fixedInvoiceNo = useMemo(() => {
    const today = new Date();
    const YMD = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
    const randomSeq = String(Math.floor(100 + Math.random() * 900));
    const prefix = activeMode === 'pt' ? 'INV-PT' : (activeMode === 'upgrade' ? 'INV-UPG' : (activeMode === 'renew' ? 'INV-REN' : 'INV-MEM'));
    return `${prefix}-${YMD}-${randomSeq}`;
  }, [activeMode, selectedMemberId]);

  // ── DATE CALCULATIONS ──────────────────────────────────────────────────
  const todayYMD = useMemo(() => getCanonicalISTDate(), []);

  const [billDate, setBillDate] = useState(todayYMD); // Actual transaction date
  const [startDate, setStartDate] = useState(todayYMD); // Membership start date

  // Dynamic Catalog of Packages
  const activePackages = useMemo(() => {
    if (plans.length > 0) {
      return plans.filter((p: any) => {
        if (String(p.status || 'Active').toLowerCase() === 'inactive') return false;
        const type = String(p.type || p.planType || p.packageType || '').toLowerCase();
        const isPt = type.includes('pt') || type.includes('personal training') ||
          String(p.name || '').toLowerCase().includes('pt') || String(p.badge || '').toLowerCase().includes('personal training');
        return activeMode === 'pt' ? isPt : !isPt;
      }).map((p: any) => ({
        ...p,
        id: p.id,
        name: p.name,
        durationMonths: Number(p.durationMonths || p.months) || 0,
        durationDays: Number(p.durationDays) || 0,
        duration: p.duration || '',
        price: Number(p.price) || 0,
        tag: p.badge || p.tag || (activeMode === 'pt' ? 'Personal Training' : 'Popular')
      }));
    }
    if (activeMode === 'pt') return [];
    return [
      { id: 'p1', name: '1 Month Standard', durationMonths: 1, price: 3000, tag: 'Standard' },
      { id: 'p2', name: '3 Months Prime', durationMonths: 3, price: 6500, tag: 'Popular' },
      { id: 'p3', name: '3+1 Months Offer', durationMonths: 4, price: 7500, tag: 'Best Value' },
      { id: 'p4', name: '6 Months Executive', durationMonths: 6, price: 9500, tag: 'Saver' },
      { id: 'p5', name: '12 Months VIP', durationMonths: 12, price: 14000, tag: 'Annual Pro' },
    ];
  }, [plans, activeMode]);

  const [selectedPackage, setSelectedPackage] = useState<any>(activePackages[1] || activePackages[0]);
  const [packagePrice, setPackagePrice] = useState<number>(activePackages[1]?.price || 6500);

  useEffect(() => {
    const currentChoice = activePackages.find((pkg: any) => pkg.id === selectedPackage?.id);
    const nextChoice = currentChoice || activePackages[0] || null;
    setSelectedPackage(nextChoice);
    setPackagePrice(nextChoice ? Number(nextChoice.price) || 0 : 0);
  }, [activePackages]);

  // Auto set start date based on continuation rules
  useEffect(() => {
    if (selectedMember) {
      if (activeMode === 'pt') {
        setStartDate(todayYMD);
      } else if (activeMode === 'renew' || activeMode === 'upgrade') {
        const curExpStr = selectedMember.expiryDate;
        const curExp = curExpStr ? new Date(curExpStr) : null;
        if (curExp && curExp.getTime() > Date.now()) {
          setStartDate(curExpStr);
        } else {
          setStartDate(todayYMD);
        }
      } else {
        setStartDate(selectedMember.startDate || selectedMember.joinDate || todayYMD);
      }
    }
  }, [selectedMember, activeMode, todayYMD]);

  // Recalculate Expiry Date
  const calculatedExpiryDate = useMemo(() => {
    const baseDate = new Date(startDate || todayYMD);
    if (isNaN(baseDate.getTime())) return todayYMD;

    if (activeMode === 'pt') {
      const durationText = String(selectedPackage?.duration || selectedPackage?.name || '').toLowerCase();
      const durationMatch = durationText.match(/(\d+)\s*(day|days|month|months|year|years)/);
      const durationDays = Number(selectedPackage?.durationDays) || (durationMatch
        ? Number(durationMatch[1]) * (durationMatch[2].startsWith('year') ? 365 : durationMatch[2].startsWith('month') ? 30 : 1)
        : (Number(selectedPackage?.durationMonths) || 1) * 30);
      baseDate.setDate(baseDate.getDate() + durationDays);
    } else {
      const monthsToAdd = selectedPackage?.durationMonths || 3;
      baseDate.setMonth(baseDate.getMonth() + monthsToAdd);
    }
    return baseDate.toISOString().split('T')[0];
  }, [activeMode, startDate, selectedPackage, todayYMD]);

  // ── PREVIOUS MEMBERSHIP FINANCIAL SNAPSHOT & CARRY FORWARD ─────────────
  const currentMembershipSnapshot = useMemo(() => {
    if (!selectedMember) {
      return {
        package: '3 Months',
        startDate: todayYMD,
        expiryDate: todayYMD,
        originalBill: 6500,
        alreadyPaid: 2000,
        currentPending: 4500,
        previousInvoiceNo: 'INV-MEM-355612'
      };
    }

    const embeddedHistory = [
      ...(Array.isArray(selectedMember.billingHistory) ? selectedMember.billingHistory : []),
      ...(Array.isArray(selectedMember.payments) ? selectedMember.payments : []),
      ...(Array.isArray(selectedMember.membershipHistory) ? selectedMember.membershipHistory : [])
    ];

    // Prefer the canonical payments ledger over denormalized member balance fields.
    // Older imports can leave stale member.balanceAmount/outstandingBalance values even
    // when the historical invoice is fully paid; carrying that stale value forward
    // makes a discounted bill look like it has an unexplained extra charge.
    const memberInfo = resolveMemberIdentifierKeys(selectedMember);
    const ledgerHistory = payments
      .filter((invoice: any) => isInvoiceMatchingMember(invoice, memberInfo))
      .map((invoice: any) => normalizeBillingTransaction(invoice, selectedMember))
      .filter((invoice: any) => invoice.billingType !== 'pt' && invoice.status !== 'void' && !invoice.isAutoGenerated)
      .sort((a: any, b: any) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime());

    if (ledgerHistory.length > 0) {
      const latestInvoice = ledgerHistory[0];
      const ledgerPending = ledgerHistory.reduce((sum: number, invoice: any) => {
        return sum + Math.max(0, Number(invoice.netPayable || 0) - Number(invoice.amountPaid || 0));
      }, 0);
      return {
        package: latestInvoice.plan || selectedMember.plan || '3 Months Standard',
        startDate: latestInvoice.startDate || selectedMember.startDate || selectedMember.joinDate || todayYMD,
        expiryDate: latestInvoice.expiryDate || selectedMember.expiryDate || todayYMD,
        originalBill: Number(latestInvoice.originalAmount) || getDefaultPriceForPlan(latestInvoice.plan),
        alreadyPaid: Number(latestInvoice.amountPaid) || 0,
        currentPending: ledgerPending,
        previousInvoiceNo: latestInvoice.invoiceNumber || selectedMember.lastInvoiceNo || 'INV-LEGACY',
      };
    }

    const lastInv = embeddedHistory.length > 0 ? embeddedHistory[embeddedHistory.length - 1] : null;

    const rawPaid = lastInv?.amountPaid ?? lastInv?.paid ?? selectedMember.amountPaid ?? selectedMember.paid ?? selectedMember.totalPaid ?? selectedMember.paidAmount ?? selectedMember.amountPaidToday ?? 0;
    const rawBalance = lastInv?.pendingAmount ?? lastInv?.balanceAmount ?? selectedMember.balanceAmount ?? selectedMember.outstandingBalance ?? selectedMember.balance ?? selectedMember.dueAmount ?? selectedMember.pendingAmount ?? selectedMember.balanceDue ?? selectedMember.remainingBalance;
    const fallbackPrice = getDefaultPriceForPlan(selectedMember.plan || selectedMember.packageName);
    const rawPrice = lastInv?.netPayable ?? lastInv?.originalAmount ?? lastInv?.amount ?? selectedMember.price ?? selectedMember.totalBilled ?? selectedMember.packagePrice ?? selectedMember.amount ?? selectedMember.netPayable ?? fallbackPrice;

    let parsedPrice = Number(rawPrice) || fallbackPrice;
    let paid = Number(rawPaid) || 0;

    let pending = 0;
    if (rawBalance !== undefined && rawBalance !== null && !isNaN(Number(rawBalance)) && Number(rawBalance) > 0) {
      pending = Number(rawBalance);
    } else if (parsedPrice > paid) {
      pending = Math.max(0, parsedPrice - paid);
    } else if (Number(selectedMember.outstandingBalance || 0) > 0) {
      pending = Number(selectedMember.outstandingBalance);
    }

    if (paid === 0 && pending > 0 && parsedPrice > pending) {
      paid = parsedPrice - pending;
    } else if (paid === 0 && pending === 0) {
      paid = parsedPrice;
    }

    const prevInvNo = lastInv?.invoiceNumber || lastInv?.invoice || selectedMember.lastInvoiceNo || (selectedMember.clientId ? `INV-LEG-${selectedMember.clientId}` : `INV-LEG-${String(selectedMember.id || '355').slice(0, 6)}`);

    return {
      package: selectedMember.plan || selectedMember.packageName || '3 Months Standard',
      startDate: selectedMember.startDate || selectedMember.joinDate || todayYMD,
      expiryDate: selectedMember.expiryDate || todayYMD,
      originalBill: parsedPrice,
      alreadyPaid: paid,
      currentPending: pending,
      previousInvoiceNo: prevInvNo
    };
  }, [selectedMember, payments, todayYMD]);

  // Carry Forward Amount (For standard renewal/new: pending balance; For upgrade: credit adjustment)
  const carryForwardAmount = activeMode === 'pt' ? 0 : (activeMode === 'upgrade' ? currentMembershipSnapshot.alreadyPaid : currentMembershipSnapshot.currentPending);

  // ── DISCOUNT & ACCOUNTING ENGINE ───────────────────────────────────────
  const [discountType, setDiscountType] = useState<'flat' | 'percent'>('flat');
  const [discountValue, setDiscountValue] = useState<number>(0);

  const discountAmount = useMemo(() => {
    if (discountType === 'percent') {
      return Math.round((packagePrice * Math.min(100, discountValue)) / 100);
    }
    return Math.min(packagePrice, Math.max(0, discountValue));
  }, [packagePrice, discountType, discountValue]);

  // Centralized Amount Payable Calculation Engine
  const upgradeCalc = useMemo(() => {
    return calculateUpgradeBill({
      previousPackageAmount: currentMembershipSnapshot.originalBill,
      previousAmountPaid: currentMembershipSnapshot.alreadyPaid,
      previousOutstanding: currentMembershipSnapshot.currentPending,
      newPackageAmount: packagePrice,
      discount: discountAmount
    });
  }, [currentMembershipSnapshot, packagePrice, discountAmount]);

  const finalPayable = useMemo(() => {
    if (activeMode === 'pt') {
      return Math.max(0, packagePrice - discountAmount);
    }
    if (activeMode === 'upgrade') {
      return upgradeCalc.finalPayable;
    }
    const netCurrentPackage = Math.max(0, packagePrice - discountAmount);
    return netCurrentPackage + currentMembershipSnapshot.currentPending;
  }, [activeMode, upgradeCalc, packagePrice, discountAmount, currentMembershipSnapshot]);

  // ── AMOUNT PAID & REMAINING PENDING ───────────────────────────────────
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Cash' | 'Card' | 'Bank Transfer' | 'QR' | 'Split'>('UPI');
  const [amountPaidToday, setAmountPaidToday] = useState<number>(0);
  const [userEditedPaid, setUserEditedPaid] = useState<boolean>(false);

  // Auto set amount paid today to finalPayable if manager hasn't touched it
  useEffect(() => {
    if (!userEditedPaid) {
      setAmountPaidToday(finalPayable);
    }
  }, [finalPayable, userEditedPaid]);

  const remainingPending = useMemo(() => {
    return Math.max(0, finalPayable - amountPaidToday);
  }, [finalPayable, amountPaidToday]);

  const paymentStatusLabel = useMemo(() => {
    if (remainingPending <= 0) return 'PAID IN FULL';
    if (amountPaidToday > 0) return 'PARTIAL PAYMENT';
    return 'PENDING';
  }, [remainingPending, amountPaidToday]);

  // ── MODALS & INVOICE EXECUTION ─────────────────────────────────────────
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successInvoice, setSuccessInvoice] = useState<any | null>(null);

  const handleSelectPackageCard = (pkg: any) => {
    setSelectedPackage(pkg);
    setPackagePrice(pkg.price);
  };

  const handleConfirmBill = async () => {
    if (!billingLedgerReady) {
      toast.error('Please wait while the member billing history loads.');
      return;
    }
    if (!selectedMember) {
      toast.error(`Please select a member for this ${activeMode}.`);
      return;
    }
    if (!selectedPackage) {
      toast.error(activeMode === 'pt' ? 'No active PT plans are available. Add a PT plan first.' : 'No active packages are available.');
      return;
    }
    if (submitting) return; // Prevent double click
    setSubmitting(true);

    const isRenew = activeMode === 'renew';
    const isPtBill = activeMode === 'pt';
    const normalizedPaymentDate = getCanonicalISTDate(billDate);
    const newPaymentRef = doc(collection(db, 'payments'));
    const transactionId = `TXN-${normalizedPaymentDate.replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const payStatus = remainingPending <= 0 ? 'paid' : (amountPaidToday > 0 ? 'partial' : 'pending');

    // PHASE 2: TEMPORARY TRANSACTION TRACE (CREATE)
    console.log('[BILLING CREATE]', {
      memberId: selectedMember.id,
      invoiceId: fixedInvoiceNo,
      transactionId: transactionId,
      originalAmount: packagePrice,
      discount: discountAmount,
      tax: 0,
      netPayable: finalPayable,
      amountPaid: amountPaidToday,
      pendingAmount: remainingPending,
      paymentMethod: paymentMethod,
      paymentStatus: payStatus,
      billDate: billDate,
      paymentDate: normalizedPaymentDate,
      createdAt: new Date().toISOString(),
      collectionTarget: 'payments',
    });

    const billPayload = {
      id: newPaymentRef.id,
      transactionId: transactionId,
      invoiceNumber: fixedInvoiceNo,
      invoice: fixedInvoiceNo,
      memberId: selectedMember.id,
      memberName: selectedMember.name,
      memberPhone: selectedMember.phone || '',
      mode: activeMode.toUpperCase(),
      transactionType: isPtBill ? 'pt_payment' : (isRenew ? 'membership_renewal' : 'membership_upgrade'),
      billingType: isPtBill ? 'PT' : 'membership',
      ...(isPtBill ? { invoiceType: 'PT', packageType: 'PT' } : {}),
      plan: selectedPackage?.name || (isRenew ? 'Renewed Membership' : 'Upgraded Membership'),
      packageName: selectedPackage?.name || (isRenew ? 'Renewed Membership' : 'Upgraded Membership'),
      ...(isPtBill ? {
        packageId: selectedPackage.id,
        duration: selectedPackage.duration || selectedPackage.name,
        durationDays: selectedPackage.durationDays || undefined,
        trainerId: selectedMember.trainerId || '',
        trainerName: selectedMember.trainerName || selectedMember.trainer || 'Personal Trainer',
      } : {}),

      // Previous Billing Relationship
      ...(!isPtBill ? {
        previousInvoiceNumber: currentMembershipSnapshot.previousInvoiceNo,
        previousPackage: currentMembershipSnapshot.package,
        previousBillAmount: currentMembershipSnapshot.originalBill,
        previousAmountPaid: currentMembershipSnapshot.alreadyPaid,
        previousPending: currentMembershipSnapshot.currentPending,
        carryForwardCredit: activeMode === 'upgrade' ? upgradeCalc.carryForwardCredit : 0,
        upgradeAmountBeforeDiscount: activeMode === 'upgrade' ? upgradeCalc.upgradeAmountBeforeDiscount : packagePrice,
      } : {}),

      // Financial Ledger
      packagePrice: packagePrice,
      originalAmount: packagePrice,
      discountAmount: discountAmount,
      discount: discountAmount,
      discountType: discountType,
      netPayable: finalPayable,
      amount: finalPayable,
      amountPaid: amountPaidToday,
      paid: amountPaidToday,
      pendingAmount: remainingPending,
      balanceAmount: remainingPending,
      outstandingAmount: remainingPending,

      // Meta & Canonical Dates
      method: paymentMethod,
      paymentMethod: paymentMethod,
      status: payStatus,
      paymentStatus: payStatus,
      paymentDate: normalizedPaymentDate,
      invoiceDate: normalizedPaymentDate,
      date: normalizedPaymentDate,
      billingDate: normalizedPaymentDate,
      transactionDate: normalizedPaymentDate,
      startDate: startDate,
      expiryDate: calculatedExpiryDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isHistorical: false,
      imported: false,
      notes: isPtBill
        ? `Personal Training package ${selectedPackage?.name} from ${startDate} to ${calculatedExpiryDate}`
        : isRenew
          ? `Membership renewed to ${selectedPackage?.name} from ${startDate} to ${calculatedExpiryDate}`
          : `Membership upgraded to ${selectedPackage?.name}. Credit adjustment: -₹${upgradeCalc.carryForwardCredit}`,
    };

    try {
      // PHASE 14: ATOMIC BATCH WRITE
      const batch = writeBatch(db);

      // 1. Add canonical payment document to payments collection
      batch.set(newPaymentRef, billPayload);

      // 2. Update Member Record atomically
      const memberRef = doc(db, 'members', selectedMember.id);
      if (isPtBill) {
        const ptDuration = selectedPackage.duration || selectedPackage.name;
        const trainerName = selectedMember.trainerName || selectedMember.trainer || 'Personal Trainer';
        const ptDetails = {
          id: fixedInvoiceNo,
          invoiceNo: fixedInvoiceNo,
          invoiceNumber: fixedInvoiceNo,
          packageId: selectedPackage.id,
          packageName: selectedPackage.name,
          duration: ptDuration,
          durationDays: selectedPackage.durationDays || null,
          durationMonths: selectedPackage.durationMonths || null,
          amount: packagePrice,
          startDate,
          expiryDate: calculatedExpiryDate,
          trainerId: selectedMember.trainerId || '',
          trainerName,
          status: 'ACTIVE',
          paymentStatus: payStatus,
          paymentMode: paymentMethod,
          updatedAt: new Date().toISOString(),
        };

        batch.update(memberRef, {
          pt: { ...(selectedMember.pt || {}), ...ptDetails, enabled: true },
          ptMembership: { ...(selectedMember.ptMembership || {}), ...ptDetails },
          ptPlan: selectedPackage.name,
          ptStartDate: startDate,
          ptExpiryDate: calculatedExpiryDate,
          ptDuration: ptDuration,
          ptAmount: packagePrice,
          ptHistory: arrayUnion({ ...billPayload, trainerName }),
          updatedAt: new Date().toISOString(),
        });
      } else {
        const newTotalPaid = (Number(selectedMember.totalPaid) || 0) + amountPaidToday;
        const newTotalBilled = (Number(selectedMember.totalBilled) || 0) + finalPayable;

        batch.update(memberRef, {
          plan: selectedPackage?.name || selectedMember.plan,
          price: packagePrice,
          startDate: startDate,
          expiryDate: calculatedExpiryDate,
          status: calculatedExpiryDate >= todayYMD ? 'active' : 'expired',
          paymentStatus: payStatus,
          totalBilled: newTotalBilled,
          totalPaid: newTotalPaid,
          outstandingBalance: remainingPending,
          updatedAt: new Date().toISOString(),
        });
      }

      await batch.commit();

      // PHASE 2: WRITE SUCCESS & READBACK TRACE
      console.log('[BILLING WRITE SUCCESS]', {
        collection: 'payments',
        documentId: newPaymentRef.id,
      });

      const readbackSnap = await getDoc(newPaymentRef);
      console.log('[BILLING READBACK]', {
        collection: 'payments',
        documentId: newPaymentRef.id,
        data: readbackSnap.data(),
      });

      const savedInvoice = { ...billPayload };

      // 3. Refresh store state
      await fetchMembers(true);
      await fetchPayments(true);

      setSuccessInvoice(savedInvoice);
      toast.success(`${isPtBill ? 'PT bill' : (isRenew ? 'Renewal' : 'Upgrade')} ${fixedInvoiceNo} created! 🎉`);
    } catch (err: any) {
      console.error('Billing execution error:', err);
      toast.error(`Failed to create ${activeMode} invoice: ` + (err?.message || err));
    } finally {
      setSubmitting(false);
    }
  };

  const meta = MODE_METADATA[activeMode] || MODE_METADATA.upgrade;

  return (
    <div className="w-full bg-[#F8FAFC] pb-12 text-left font-sans">
      
      {/* ── 1. DEDICATED HEADER: BILLING TERMINAL ────────────────────────── */}
      <div className="bg-white border-b border-slate-200/90 sticky top-0 z-20 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-all border-none cursor-pointer"
              title="Go Back"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  {meta.title}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full bg-orange-50 border border-orange-200 text-[10px] font-black uppercase text-[#EA580C]">
                  {activeMode.toUpperCase()}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                {meta.subtitle}
              </p>
            </div>
          </div>

          {/* FIXATED INVOICE NUMBER BADGE */}
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2">
            <Receipt size={16} className="text-[#EA580C]" />
            <div className="text-right">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Invoice No</span>
              <span className="font-mono text-xs font-black text-slate-900">{fixedInvoiceNo}</span>
            </div>
          </div>

        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        
        {successInvoice ? (
          /* ── 17. SUCCESS SCREEN ───────────────────────────────────────────────── */
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xl max-w-3xl mx-auto text-center space-y-6"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={38} />
            </div>

            <div>
              <h2 className="text-2xl font-black text-slate-900">
                {activeMode === 'pt' ? 'PT BILL CREATED ✓' : activeMode === 'renew' ? 'RENEWAL SUCCESSFUL ✓' : 'UPGRADE SUCCESSFUL ✓'}
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-1">
                Transaction <code className="font-mono bg-slate-100 px-2 py-0.5 rounded text-slate-800 font-bold">{successInvoice.invoiceNumber}</code> has been confirmed.
              </p>
            </div>

            <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-4 text-left text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Member</span>
                <p className="font-black text-slate-900 mt-0.5">{selectedMember?.name}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">
                  {activeMode === 'pt' ? 'PT Package' : activeMode === 'renew' ? 'Renewed Package' : 'Upgraded To'}
                </span>
                <p className="font-black text-[#EA580C] mt-0.5">{successInvoice.plan}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase">Paid Today</span>
                <p className="font-black text-emerald-700 font-mono mt-0.5">₹{successInvoice.amountPaid.toLocaleString('en-IN')}</p>
              </div>
              <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">{activeMode === 'pt' ? 'PT Expires' : 'New Expiry'}</span>
                <p className="font-black text-slate-900 font-mono mt-0.5">{formatDate(successInvoice.expiryDate)}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-slate-100">
              <button
                onClick={() => setShowPreviewModal(true)}
                className="px-4 py-2.5 bg-orange-50 text-[#EA580C] border border-orange-200 rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1.5"
              >
                <Eye size={15} /> VIEW INVOICE
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1.5"
              >
                <Printer size={15} /> PRINT INVOICE
              </button>
              <button
                onClick={() => {
                  setSuccessInvoice(null);
                  router.push('/dashboard/billing');
                }}
                className={`px-5 py-2.5 ${BLUE_GRADIENT} ${BLUE_GRADIENT_HOVER} text-white rounded-xl font-bold text-xs shadow-md border-none cursor-pointer flex items-center gap-1.5`}
              >
                DONE
              </button>
            </div>
          </motion.div>
        ) : (
          /* ── MAIN BILLING TERMINAL ENGINE ─────────────────────────────────────── */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

            {/* LEFT 7 COLS: STEP 1 TO STEP 5 */}
            <div className="lg:col-span-7 space-y-6">

              {/* ── STEP 1: MEMBER PROFILE & CURRENT MEMBERSHIP SNAPSHOT ───────── */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#EA580C] block">
                  STEP 1 — {activeMode === 'pt' ? 'MEMBER & PT PLAN' : activeMode === 'renew' ? 'RENEW MEMBER PROFILE' : 'UPGRADE MEMBER PROFILE'}
                </span>

                {/* Search / Select Member Dropdown */}
                <div className="relative" ref={memberDropdownRef}>
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 focus-within:border-[#EA580C] focus-within:bg-white transition-all">
                    <Search size={16} className="text-slate-400 shrink-0" />
                    <input
                      type="text"
                      placeholder="Type member name, phone, or Member ID..."
                      value={memberSearch}
                      onChange={(e) => {
                        setMemberSearch(e.target.value);
                        setShowMemberDropdown(true);
                      }}
                      onFocus={() => setShowMemberDropdown(true)}
                      className="w-full bg-transparent text-xs font-bold text-slate-900 outline-none"
                    />
                    {(selectedMember || memberSearch) && (
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMemberId('');
                          setMemberSearch('');
                          setShowMemberDropdown(true);
                          router.replace(`/dashboard/billing/create?mode=${activeMode}`);
                        }}
                        className="text-slate-400 hover:text-slate-600 border-none bg-transparent cursor-pointer px-1 py-0.5"
                        title="Clear & Change Member"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {showMemberDropdown && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-slate-200 shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-slate-100">
                      {(() => {
                        const rawQ = memberSearch.trim().toLowerCase();
                        const isMatchSelected = selectedMember && memberSearch.includes(selectedMember.name);
                        const q = isMatchSelected ? '' : rawQ;

                        const filtered = members.filter((m: any) => {
                          if (!m) return false;
                          if (!q) return true;
                          const name = String(m.name || '').toLowerCase();
                          const phone = String(m.phone || '').replace(/\D/g, '');
                          const mId = String(m.memberId || m.id || '').toLowerCase();
                          const cId = String(m.clientId || '').toLowerCase();
                          const bioId = String(m.biometricId || m.deviceUserId || '').toLowerCase();
                          return name.includes(q) || phone.includes(q) || mId.includes(q) || cId.includes(q) || bioId.includes(q);
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="p-4 text-center text-xs text-slate-400 font-bold">
                              No members found matching "{memberSearch}"
                            </div>
                          );
                        }

                        return filtered.slice(0, 12).map((m: any) => (
                          <div
                            key={m.id}
                            onClick={() => {
                              setSelectedMemberId(m.id);
                              setMemberSearch(`${m.name} (${m.memberId || m.id})`);
                              setShowMemberDropdown(false);
                              router.replace(`/dashboard/billing/create?mode=${activeMode}&id=${m.id}`);
                            }}
                            className="p-3 hover:bg-orange-50/60 cursor-pointer flex items-center justify-between transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-orange-100 text-[#EA580C] font-black text-xs flex items-center justify-center">
                                {m.name?.[0] || 'M'}
                              </div>
                              <div>
                                <div className="text-xs font-extrabold text-slate-900">{m.name}</div>
                                <div className="text-[10px] text-slate-400 font-medium">{m.memberId || m.id} • {m.phone}</div>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold text-slate-500 uppercase">{m.status || 'Active'}</span>
                          </div>
                        ));
                      })()}
                    </div>
                  )}
                </div>

                {/* MEMBER DETAILS CARD */}
                {selectedMember ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 border border-slate-200">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-full bg-orange-100 text-[#EA580C] font-black text-sm flex items-center justify-center border border-orange-200">
                          {selectedMember.name?.[0] || 'M'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-black text-slate-900">{selectedMember.name}</h3>
                            <span className="px-2 py-0.5 rounded bg-orange-100 text-[#EA580C] text-[10px] font-black">
                              {selectedMember.memberId || selectedMember.id}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 font-semibold mt-0.5">
                            BIO-{selectedMember.biometricId || selectedMember.deviceUserId || '221'} • Status: <span className="text-emerald-700 font-bold uppercase">{selectedMember.status || 'ACTIVE'}</span>
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMemberId('');
                          setMemberSearch('');
                          setShowMemberDropdown(true);
                          router.replace(`/dashboard/billing/create?mode=${activeMode}`);
                        }}
                        className="px-3 py-1.5 bg-white hover:bg-slate-100 text-[#EA580C] border border-orange-200 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                      >
                        Change Member
                      </button>
                    </div>

                {activeMode === 'pt' ? (
                  <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
                    <span className="text-[10px] font-black uppercase text-amber-800 block tracking-wider">CURRENT PT PLAN</span>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                      <div><span className="text-[10px] text-slate-500 font-bold block uppercase">Package</span><span className="font-extrabold text-slate-900">{selectedMember.ptMembership?.packageName || selectedMember.pt?.packageName || selectedMember.ptPlan || 'No PT plan yet'}</span></div>
                      <div><span className="text-[10px] text-slate-500 font-bold block uppercase">Trainer</span><span className="font-bold text-slate-700">{selectedMember.ptMembership?.trainerName || selectedMember.pt?.trainerName || selectedMember.trainerName || selectedMember.trainer || 'Unassigned'}</span></div>
                      <div><span className="text-[10px] text-slate-500 font-bold block uppercase">PT Expires</span><span className="font-bold text-slate-700">{formatDate(selectedMember.ptExpiryDate || selectedMember.ptMembership?.expiryDate || selectedMember.pt?.expiryDate || '')}</span></div>
                    </div>
                  </div>
                ) : (
                    <div className="p-4 rounded-xl bg-orange-50/60 border border-orange-200 space-y-2.5">
                      <span className="text-[10px] font-black uppercase text-[#EA580C] block tracking-wider">
                        CURRENT MEMBERSHIP SNAPSHOT
                      </span>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block uppercase">Current Package</span>
                          <span className="font-extrabold text-slate-900">{currentMembershipSnapshot.package}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block uppercase">Start Date</span>
                          <span className="font-bold text-slate-700">{formatDate(currentMembershipSnapshot.startDate)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block uppercase">Expiry Date</span>
                          <span className="font-bold text-slate-700">{formatDate(currentMembershipSnapshot.expiryDate)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block uppercase">Original Bill</span>
                          <span className="font-mono font-bold text-slate-800">₹{currentMembershipSnapshot.originalBill.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block uppercase">Already Paid</span>
                          <span className="font-mono font-bold text-emerald-700">₹{currentMembershipSnapshot.alreadyPaid.toLocaleString('en-IN')}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-bold block uppercase">Current Pending</span>
                          <span className="font-mono font-black text-red-600">₹{currentMembershipSnapshot.currentPending.toLocaleString('en-IN')}</span>
                        </div>
                      </div>
                    </div>
                )}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 text-center text-xs text-slate-400">
                    {activeMode === 'pt' ? 'Select a member above to load PT plan details' : 'Select a member above to load membership snapshot'}
                  </div>
                )}
              </div>

              {/* ── STEP 2: SELECT MEMBERSHIP PACKAGE ──────────────────────── */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#EA580C] block">
                  STEP 2 — {activeMode === 'pt' ? 'SELECT PT PLAN' : activeMode === 'renew' ? 'SELECT RENEWAL PACKAGE' : 'SELECT NEW MEMBERSHIP PACKAGE'}
                </span>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {activePackages.length === 0 && (
                    <div className="col-span-full rounded-xl border border-dashed border-amber-300 bg-amber-50 p-5 text-center text-xs font-bold text-amber-800">
                      No active PT plans found. Add or activate a PT plan in Memberships first.
                    </div>
                  )}
                  {activePackages.map((pkg) => {
                    const isSelected = selectedPackage?.id === pkg.id;
                    return (
                      <div
                        key={pkg.id}
                        onClick={() => handleSelectPackageCard(pkg)}
                        className={`p-3.5 rounded-xl border transition-all cursor-pointer text-left relative flex flex-col justify-between ${
                          isSelected
                            ? `${BLUE_GRADIENT} text-white border-none shadow-md`
                            : 'bg-white border-slate-200 hover:border-orange-200 text-slate-800'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white text-[#EA580C] flex items-center justify-center font-bold">
                            <Check size={12} />
                          </div>
                        )}
                        <div>
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded inline-block ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-orange-100 text-[#EA580C]'
                          }`}>
                            {pkg.tag}
                          </span>
                          <div className={`text-xs font-black mt-1.5 ${isSelected ? 'text-white' : 'text-slate-900'}`}>
                            {pkg.name}
                          </div>
                        </div>
                        <div className={`text-base font-black font-mono mt-2 ${isSelected ? 'text-white' : 'text-[#EA580C]'}`}>
                          ₹{pkg.price.toLocaleString('en-IN')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ── STEP 3: MEMBERSHIP DATES & START OPTION ─────────────────────────── */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-3">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#EA580C] block">
                  STEP 3 — {activeMode === 'pt' ? 'PT PLAN DATES' : activeMode === 'renew' ? 'RENEWAL DATES & START OPTION' : 'UPGRADE DATES'}
                </span>

                {activeMode === 'renew' && (
                  <div className="flex flex-wrap items-center gap-2 mb-2 p-3 bg-orange-50/60 rounded-xl border border-orange-100">
                    <span className="text-[10px] font-black text-[#EA580C] uppercase w-full block">Quick Renewal Start Date:</span>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedMember?.expiryDate) setStartDate(selectedMember.expiryDate);
                        else setStartDate(todayYMD);
                      }}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        startDate === selectedMember?.expiryDate
                          ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      🗓️ From Expiry Date ({selectedMember?.expiryDate ? formatDate(selectedMember.expiryDate) : 'Today'})
                    </button>
                    <button
                      type="button"
                      onClick={() => setStartDate(todayYMD)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                        startDate === todayYMD && startDate !== selectedMember?.expiryDate
                          ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      ⚡ Starting Today ({formatDate(todayYMD)})
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#EA580C]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Bill Date (Transaction)</label>
                    <input
                      type="date"
                      value={billDate}
                      onChange={(e) => setBillDate(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#EA580C]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">{activeMode === 'pt' ? 'PT Expiry' : 'Calculated Expiry'}</label>
                    <div className="w-full bg-orange-50 border border-orange-100 rounded-xl px-3 py-2 text-xs font-black text-[#EA580C] font-mono">
                      {formatDate(calculatedExpiryDate)}
                    </div>
                  </div>
                </div>
              </div>

              {activeMode !== 'pt' && (
              <>
              {/* ── STEP 4: CARRY FORWARD / UPGRADE CREDIT ────────────────────── */}
              <div className="bg-amber-50/70 rounded-2xl p-5 border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={16} className="text-amber-600" />
                    <span className="text-xs font-black uppercase tracking-wider text-amber-900">
                      {activeMode === 'upgrade'
                        ? 'PREVIOUS PAID CREDIT (UPGRADE ADJUSTMENT)'
                        : 'CARRY FORWARD (PREVIOUS PENDING BALANCE)'}
                    </span>
                  </div>
                  <span className={`font-mono font-black text-sm ${activeMode === 'upgrade' ? 'text-emerald-700' : 'text-red-600'}`}>
                    {activeMode === 'upgrade' ? `-₹${currentMembershipSnapshot.alreadyPaid.toLocaleString('en-IN')}` : `₹${carryForwardAmount.toLocaleString('en-IN')}`}
                  </span>
                </div>

                <div className="bg-white rounded-xl p-3.5 border border-amber-200 text-xs space-y-1.5 text-slate-700">
                  <div className="flex justify-between">
                    <span>Previous Invoice No:</span>
                    <span className="font-mono font-bold">{currentMembershipSnapshot.previousInvoiceNo}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Previous Bill Amount:</span>
                    <span className="font-mono font-bold">₹{currentMembershipSnapshot.originalBill.toLocaleString('en-IN')}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Already Paid (Credit Adjustment):</span>
                    <span className="font-mono font-bold text-emerald-700">₹{currentMembershipSnapshot.alreadyPaid.toLocaleString('en-IN')}</span>
                  </div>
                  {activeMode === 'upgrade' ? (
                    <div className="flex justify-between pt-1 border-t border-slate-100 font-bold">
                      <span>Upgrade Credit Subtracted:</span>
                      <span className="font-mono text-emerald-600 font-black">-₹{currentMembershipSnapshot.alreadyPaid.toLocaleString('en-IN')}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between pt-1 border-t border-slate-100 font-bold">
                      <span>Previous Pending (Carry Forward):</span>
                      <span className="font-mono text-red-600 font-black">₹{carryForwardAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}
                </div>
              </div>
              </>
              )}

              {/* ── STEP 5: DISCOUNT & AMOUNT PAYABLE ─────────────────────────── */}
              <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-xs space-y-4">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#EA580C] block">
                  STEP {activeMode === 'pt' ? '4' : '5'} — {activeMode === 'pt' ? 'PT PAYMENT SETTLEMENT' : 'DISCOUNT & PAYMENT SETTLEMENT'}
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Discount</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={discountType}
                        onChange={(e) => setDiscountType(e.target.value as any)}
                        className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 outline-none"
                      >
                        <option value="flat">₹ Flat</option>
                        <option value="percent">% Percent</option>
                      </select>
                      <input
                        type="number"
                        placeholder="0"
                        value={discountValue || ''}
                        onChange={(e) => setDiscountValue(Number(e.target.value) || 0)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-[#EA580C]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value as any)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none focus:border-[#EA580C]"
                    >
                      <option value="UPI">UPI / QR Code</option>
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                  </div>
                </div>

                {/* HIGHLIGHTED AMOUNT PAYABLE CARD */}
                <div className="p-4 rounded-xl bg-orange-50/70 border border-orange-200 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-[#EA580C] tracking-wider block">FINAL AMOUNT PAYABLE</span>
                    <p className="text-xs text-slate-500 font-medium">
                      {activeMode === 'pt'
                        ? `PT Plan (₹${packagePrice}) - Discount (₹${discountAmount})`
                        : activeMode === 'upgrade'
                        ? `New Package (₹${packagePrice}) - Paid Credit (₹${currentMembershipSnapshot.alreadyPaid}) - Discount (₹${discountAmount})`
                        : `Package (₹${packagePrice}) + Carry (₹${carryForwardAmount}) - Discount (₹${discountAmount})`}
                    </p>
                  </div>
                  <span className="text-2xl font-black text-[#EA580C] font-mono">
                    ₹{finalPayable.toLocaleString('en-IN')}
                  </span>
                </div>

                {/* AMOUNT PAID & REMAINING PENDING */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Amount Paid Today (₹)</label>
                    <input
                      type="number"
                      value={amountPaidToday}
                      onChange={(e) => {
                        setUserEditedPaid(true);
                        setAmountPaidToday(Number(e.target.value) || 0);
                      }}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-black text-slate-900 outline-none focus:border-[#EA580C] font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Remaining Pending</label>
                    <div className={`p-2.5 rounded-xl border text-xs font-black font-mono flex items-center justify-between ${
                      remainingPending > 0 ? 'bg-red-50 text-red-600 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    }`}>
                      <span>₹{remainingPending.toLocaleString('en-IN')}</span>
                      <span className="text-[10px] uppercase">{paymentStatusLabel}</span>
                    </div>
                  </div>
                </div>
              </div>

            </div>

            {/* RIGHT 5 COLS: STICKY UPGRADE SUMMARY PANEL */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-md sticky top-24 space-y-5">
                
                <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={18} className="text-[#EA580C]" />
                    <h3 className="font-extrabold text-sm text-slate-900">
                      {activeMode === 'pt' ? 'PT BILL SUMMARY' : activeMode === 'renew' ? 'RENEWAL SUMMARY' : 'UPGRADE SUMMARY'}
                    </h3>
                  </div>
                  <span className="text-[10px] font-mono font-bold bg-orange-50 text-[#EA580C] px-2 py-0.5 rounded border border-orange-100">
                    LIVE
                  </span>
                </div>

                {/* SUMMARY ROWS */}
                <div className="space-y-2.5 text-xs text-slate-600 font-medium">
                  
                  <div className="flex justify-between">
                    <span>Member:</span>
                    <span className="font-extrabold text-slate-900">{selectedMember?.name || 'Not Selected'}</span>
                  </div>

                  {activeMode !== 'pt' && (
                    <div className="flex justify-between">
                      <span>Current Package:</span>
                      <span className="font-bold text-slate-700">{currentMembershipSnapshot.package}</span>
                    </div>
                  )}

                  <div className="flex justify-between text-[#EA580C] font-bold">
                    <span>{activeMode === 'pt' ? 'PT Plan:' : 'New Package:'}</span>
                    <span>{selectedPackage?.name}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>Bill Date (Transaction):</span>
                    <span className="font-mono font-bold text-slate-800">{formatDate(billDate)}</span>
                  </div>

                  <div className="flex justify-between">
                    <span>{activeMode === 'pt' ? 'PT Expiry Date:' : 'New Expiry Date:'}</span>
                    <span className="font-mono font-bold text-[#EA580C]">{formatDate(calculatedExpiryDate)}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-between">
                    <span>{activeMode === 'pt' ? 'PT Plan Amount:' : 'New Package Amount:'}</span>
                    <span className="font-mono font-bold text-slate-900">₹{packagePrice.toLocaleString('en-IN')}</span>
                  </div>

                  {activeMode === 'upgrade' ? (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Less: Previous Paid Credit:</span>
                      <span className="font-mono">-₹{currentMembershipSnapshot.alreadyPaid.toLocaleString('en-IN')}</span>
                    </div>
                  ) : (
                    carryForwardAmount > 0 && (
                      <div className="flex justify-between text-amber-700 font-bold">
                        <span>Carry Forward:</span>
                        <span className="font-mono">+₹{carryForwardAmount.toLocaleString('en-IN')}</span>
                      </div>
                    )
                  )}

                  {discountAmount > 0 && (
                    <div className="flex justify-between text-emerald-600 font-bold">
                      <span>Less: Discount:</span>
                      <span className="font-mono">-₹{discountAmount.toLocaleString('en-IN')}</span>
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center">
                    <span className="font-black text-slate-900 text-sm">Final Payable</span>
                    <span className="font-black text-lg text-[#EA580C] font-mono">
                      ₹{finalPayable.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="flex justify-between text-emerald-700 font-bold bg-emerald-50/60 p-2 rounded-xl">
                    <span>Paid Today</span>
                    <span className="font-mono">₹{amountPaidToday.toLocaleString('en-IN')}</span>
                  </div>

                  <div className="flex justify-between text-red-600 font-bold bg-red-50/60 p-2 rounded-xl">
                    <span>Remaining Pending</span>
                    <span className="font-mono">₹{remainingPending.toLocaleString('en-IN')}</span>
                  </div>

                </div>

                {/* ACTION BUTTONS */}
                <div className="space-y-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowPreviewModal(true)}
                    className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all border border-slate-200 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Eye size={15} /> PREVIEW INVOICE
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmBill}
                    disabled={submitting || !selectedMember || !selectedPackage || !billingLedgerReady}
                    className={`w-full py-3.5 px-4 ${BLUE_GRADIENT} ${BLUE_GRADIENT_HOVER} text-white font-black text-xs rounded-xl shadow-lg transition-all border-none cursor-pointer flex items-center justify-center gap-2 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    {submitting ? (
                      <>
                        <RefreshCw size={16} className="animate-spin" /> {activeMode === 'pt' ? 'GENERATING PT BILL...' : activeMode === 'renew' ? 'GENERATING RENEWAL BILL...' : 'GENERATING UPGRADE BILL...'}
                      </>
                    ) : (
                      <>
                        <ShieldCheck size={18} /> {!billingLedgerReady ? 'LOADING BILLING HISTORY...' : activeMode === 'pt' ? 'GENERATE PT BILL' : activeMode === 'renew' ? 'GENERATE RENEWAL BILL' : 'GENERATE UPGRADE BILL'}
                      </>
                    )}
                  </button>
                </div>

              </div>
            </div>

          </div>
        )}

      </div>

      {/* ── 13. INVOICE PREVIEW MODAL BEFORE CONFIRMATION ──────────────────── */}
      <AnimatePresence>
        {showPreviewModal && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto relative space-y-4"
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Receipt size={18} className="text-[#EA580C]" />
                  <h3 className="font-extrabold text-sm text-slate-900">Official Invoice Preview</h3>
                </div>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center border-none cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              <OfficialInvoiceReceipt
                invoice={{
                  invoiceNumber: fixedInvoiceNo,
                  invoiceDate: billDate,
                  plan: selectedPackage?.name,
                  originalAmount: packagePrice,
                  discountAmount: discountAmount,
                  carryForward: carryForwardAmount,
                  netPayable: finalPayable,
                  amountPaid: amountPaidToday,
                  pendingAmount: remainingPending,
                  paymentMethod: paymentMethod,
                  startDate: startDate,
                  expiryDate: calculatedExpiryDate,
                  isUpgrade: activeMode === 'upgrade',
                  previousInvoiceNumber: currentMembershipSnapshot.previousInvoiceNo,
                  previousPaidAmount: currentMembershipSnapshot.alreadyPaid,
                }}
                member={selectedMember || { name: 'Sample Member', memberId: 'AZ-2026-0029' }}
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold text-xs border border-slate-200 cursor-pointer"
                >
                  Close Preview
                </button>
                <button
                  onClick={() => {
                    setShowPreviewModal(false);
                    handleConfirmBill();
                  }}
                  className={`px-5 py-2 ${BLUE_GRADIENT} ${BLUE_GRADIENT_HOVER} text-white rounded-xl font-bold text-xs shadow-md border-none cursor-pointer flex items-center gap-1.5`}
                >
                  <ShieldCheck size={15} /> Confirm &amp; Generate Bill
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default function UniversalBillingTerminalPage() {
  return (
    <Suspense fallback={
      <div className="p-12 text-center text-slate-400 text-xs flex items-center justify-center gap-2">
        <RefreshCw size={16} className="animate-spin text-[#EA580C]" /> Loading Billing Terminal...
      </div>
    }>
      <UniversalBillingTerminalContent />
    </Suspense>
  );
}
