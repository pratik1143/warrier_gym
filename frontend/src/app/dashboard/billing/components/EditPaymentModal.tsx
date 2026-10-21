'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, Clock, X, Save, RefreshCw, Receipt, CheckCircle2, User, CreditCard, AlertCircle, DollarSign, Tag, Percent, Banknote, Smartphone, Landmark } from 'lucide-react';
import { db } from '@/lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { PaymentRecord, getISTDateStr } from '@/hooks/useTodaysPayments';
import { paymentEngine } from '@/lib/engines/paymentEngine';
import { formatDate } from '@/lib/utils';
import toast from '@/lib/toast';

interface EditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: PaymentRecord | null;
  onSaved?: () => void;
}

export default function EditPaymentModal({
  isOpen,
  onClose,
  payment,
  onSaved,
}: EditPaymentModalProps) {
  const [transactionDate, setTransactionDate] = useState<string>('');
  const [transactionTime, setTransactionTime] = useState<string>('');
  const [packagePrice, setPackagePrice] = useState<number>(0);
  const [discount, setDiscount] = useState<number>(0);
  const [amountPaid, setAmountPaid] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<string>('Cash');

  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  useEffect(() => {
    if (payment) {
      // Resolve initial date (YYYY-MM-DD)
      const rawDate = String(payment.transactionDate || payment.paymentDate || payment.date || payment.createdAt || getISTDateStr()).split('T')[0];
      setTransactionDate(rawDate);

      // Resolve initial time (12-hour or 24-hour time format)
      let rawTime = String(payment.transactionTime || payment.paymentTime || payment.time || '');
      if (!rawTime && payment.createdAt && payment.createdAt.includes('T')) {
        try {
          const d = new Date(payment.createdAt);
          if (!isNaN(d.getTime())) {
            rawTime = d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
          }
        } catch (e) {
          // ignore
        }
      }
      if (!rawTime) {
        rawTime = '05:30 PM';
      }
      setTransactionTime(rawTime);

      const initDisc = Number(payment.discountAmount !== undefined ? payment.discountAmount : (payment.discount || 0));
      const initPaid = Number(payment.amountPaid !== undefined ? payment.amountPaid : (payment.paid !== undefined ? payment.paid : 0));
      const initOrig = Number(
        payment.originalAmount !== undefined ? payment.originalAmount :
        (payment.packagePrice !== undefined ? payment.packagePrice :
        (payment.amount !== undefined ? Number(payment.amount) + initDisc : 2500))
      );

      setPackagePrice(initOrig);
      setDiscount(initDisc);
      setAmountPaid(initPaid || Math.max(0, initOrig - initDisc));
      setPaymentMethod(String(payment.method || payment.paymentMethod || 'Cash'));
      setErrorMsg('');
    }
  }, [payment]);

  if (!isOpen || !payment) return null;

  const netPayable = Math.max(0, packagePrice - discount);
  const pendingAmount = Math.max(0, netPayable - amountPaid);
  const calculatedStatus = pendingAmount <= 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'pending');

  const handleSave = async () => {
    if (!transactionDate) {
      setErrorMsg('Transaction Date is required.');
      return;
    }
    if (packagePrice < 0) {
      setErrorMsg('Package Fee cannot be negative.');
      return;
    }
    if (discount > packagePrice) {
      setErrorMsg('Discount cannot exceed Package Fee.');
      return;
    }

    setIsSaving(true);
    setErrorMsg('');

    try {
      const payload: Record<string, any> = {
        originalAmount: packagePrice,
        packagePrice: packagePrice,
        discountAmount: discount,
        discount: discount,
        netPayable: netPayable,
        amount: netPayable,
        amountPaid: amountPaid,
        paid: amountPaid,
        amountPaidToday: amountPaid,
        pendingAmount: pendingAmount,
        balanceAmount: pendingAmount,
        outstandingAmount: pendingAmount,
        remainingBalance: pendingAmount,
        paymentMethod: paymentMethod,
        method: paymentMethod,
        status: calculatedStatus,
        paymentStatus: calculatedStatus,
        transactionDate,
        paymentDate: transactionDate,
        date: transactionDate,
        transactionTime: transactionTime || '05:30 PM',
        paymentTime: transactionTime || '05:30 PM',
        time: transactionTime || '05:30 PM',
        updatedAt: new Date().toISOString(),
      };

      // 1. Update Payment Document in Firestore
      if (payment.id) {
        await updateDoc(doc(db, 'payments', payment.id), payload);
      }

      // 2. Atomic Date Update Sync
      try {
        await paymentEngine.updateTransactionDateAtomic({
          paymentId: payment.id,
          memberId: payment.memberId || (payment as any).memberUid,
          invoiceNumber: payment.invoiceNumber || payment.invoice,
          transactionDate,
          transactionTime: transactionTime || '05:30 PM',
        });
      } catch (atomicErr) {
        console.warn('Atomic date update notice:', atomicErr);
      }

      // 3. Update Member Document if available
      const memId = payment.memberId || (payment as any).memberUid;
      if (memId) {
        try {
          await updateDoc(doc(db, 'members', String(memId)), {
            price: packagePrice,
            packagePrice: packagePrice,
            discount: discount,
            discountAmount: discount,
            amount: netPayable,
            amountPaid: amountPaid,
            paid: amountPaid,
            paidAmount: amountPaid,
            outstandingBalance: pendingAmount,
            pendingAmount: pendingAmount,
            balanceAmount: pendingAmount,
            paymentMethod: paymentMethod,
            paymentStatus: calculatedStatus,
            status: calculatedStatus === 'paid' ? 'active' : 'active',
            updatedAt: new Date().toISOString(),
          });
        } catch (memErr) {
          console.warn('Member sync notice:', memErr);
        }
      }

      toast.success('Bill details updated successfully! 🎉');
      if (onSaved) onSaved();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setErrorMsg('Failed to update transaction: ' + msg);
      toast.error('Failed to update bill details: ' + msg);
    } finally {
      setIsSaving(false);
    }
  };

  const invNum = payment.invoice || payment.invoiceNumber || 'AZ-INV-000000';
  const memberName = payment.memberName || 'Member';
  const planName = payment.plan || 'Membership';

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={() => { if (!isSaving) onClose(); }}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ scale: 0.94, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.94, opacity: 0, y: 10 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg z-10 overflow-hidden text-left"
        >
          {/* Header */}
          <div className="bg-slate-50/80 px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-100 text-[#EA580C] flex items-center justify-center shrink-0">
                <Receipt size={20} />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900 tracking-tight leading-tight">
                  Edit Payment & Bill Details
                </h3>
                <p className="text-slate-500 text-xs mt-0.5 font-medium">
                  Correct package price, discount, payment method & date for {memberName}.
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="text-slate-400 hover:text-slate-600 bg-transparent border-none cursor-pointer p-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">

            {/* Read-Only Transaction Banner */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 flex items-center justify-between">
              <div>
                <span className="font-mono text-xs font-black text-[#EA580C] bg-orange-50 px-2.5 py-0.5 rounded-md border border-orange-100">
                  {invNum}
                </span>
                <div className="text-xs font-bold text-slate-800 mt-1">{memberName} ({planName})</div>
              </div>
              <div className="text-right">
                <span className="text-xs font-black text-slate-900">Net: ₹{netPayable.toLocaleString('en-IN')}</span>
                <div className="text-[10px] text-emerald-700 font-bold">Paid: ₹{amountPaid.toLocaleString('en-IN')}</div>
              </div>
            </div>

            {/* Error Message */}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Editable Financial & Date Inputs */}
            <div className="space-y-3.5">
              
              {/* PACKAGE FEE & DISCOUNT */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 block mb-1">
                    Package Fee (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={packagePrice || ''}
                    onChange={(e) => setPackagePrice(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-[#EA580C] focus:bg-white font-mono"
                    placeholder="e.g. 2500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 block mb-1">
                    Discount (₹)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={packagePrice}
                    value={discount || ''}
                    onChange={(e) => setDiscount(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-[#EA580C] focus:bg-white font-mono"
                    placeholder="e.g. 500"
                  />
                </div>
              </div>

              {/* AMOUNT PAID & PAYMENT METHOD */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 block mb-1">
                    Amount Paid Today (₹) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={netPayable}
                    value={amountPaid || ''}
                    onChange={(e) => setAmountPaid(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-[#EA580C] focus:bg-white font-mono"
                    placeholder="e.g. 2000"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 block mb-1">
                    Payment Method
                  </label>
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-[#EA580C] focus:bg-white cursor-pointer"
                  >
                    <option value="Cash">Cash</option>
                    <option value="UPI">UPI</option>
                    <option value="Card">Card</option>
                    <option value="Net Banking">Net Banking</option>
                  </select>
                </div>
              </div>

              {/* TRANSACTION DATE & TIME */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 block mb-1">
                    Payment Date <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={transactionDate}
                    onChange={(e) => setTransactionDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-[#EA580C] focus:bg-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-700 block mb-1">
                    Payment Time
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 05:30 PM"
                    value={transactionTime}
                    onChange={(e) => setTransactionTime(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 outline-none focus:border-[#EA580C] focus:bg-white font-mono"
                  />
                </div>
              </div>

              {/* LIVE SUMMARY CALCULATOR PREVIEW */}
              <div className="bg-orange-50/70 border border-orange-100 rounded-xl p-3 text-xs font-semibold text-orange-900 space-y-1">
                <div className="flex justify-between">
                  <span>Package Fee:</span>
                  <span className="font-bold font-mono">₹{packagePrice.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-emerald-700">
                  <span>Less: Discount:</span>
                  <span className="font-bold font-mono">- ₹{discount.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-orange-200/60 pt-1 text-slate-900">
                  <span>Final Payable:</span>
                  <span className="font-black font-mono">₹{netPayable.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between text-emerald-800 font-bold">
                  <span>Amount Paid:</span>
                  <span className="font-black font-mono">₹{amountPaid.toLocaleString('en-IN')}</span>
                </div>
                {pendingAmount > 0 && (
                  <div className="flex justify-between text-rose-700 font-bold">
                    <span>Remaining Balance:</span>
                    <span className="font-black font-mono">₹{pendingAmount.toLocaleString('en-IN')}</span>
                  </div>
                )}
              </div>

            </div>

          </div>

          {/* Footer Actions */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-100 transition-colors cursor-pointer bg-white"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-[#EA580C] hover:bg-orange-700 text-white font-extrabold text-xs transition-all cursor-pointer shadow-md flex items-center gap-2 border-none active:scale-95 disabled:opacity-60"
            >
              {isSaving ? (
                <><RefreshCw size={14} className="animate-spin" /> Saving Changes...</>
              ) : (
                <><Save size={14} /> Save Changes</>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
