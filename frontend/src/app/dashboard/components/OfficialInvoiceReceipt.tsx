'use client';

import React from 'react';
import { formatDate, formatPhoneNumber } from '@/lib/utils';

interface OfficialInvoiceProps {
  invoice: any;
  member: any;
  onPrint?: () => void;
  onWhatsApp?: () => void;
}

export default function OfficialInvoiceReceipt({ invoice, member, onPrint, onWhatsApp }: OfficialInvoiceProps) {
  if (!invoice && !member) return null;

  const invNumber = invoice?.invoiceNumber || invoice?.invoice || member?.memberId || '00664';
  const memberId = member?.biometricId || member?.deviceUserId || member?.clientId || member?.customId || member?.memberId || '431';
  const memberName = member?.name || invoice?.memberName || (invoice?.memberId ? 'Unknown / Deleted Member' : 'Member');
  const rawPhone = member?.phone || member?.mobile || invoice?.memberPhone || '';
  const memberPhone = formatPhoneNumber(rawPhone);
  
  const rawDateStr = invoice?.invoiceDate || invoice?.billingDate || invoice?.date || invoice?.paymentDate || invoice?.transactionDate;
  const billDate = rawDateStr ? formatDate(rawDateStr) : formatDate(member?.joinDate || new Date().toISOString());
  const billTime = invoice?.transactionTime || invoice?.paymentTime || invoice?.time || '';
  const createdDateStr = invoice?.createdAt ? formatDate(invoice.createdAt) : null;
  const planName = invoice?.plan || invoice?.packageName || member?.plan || '3 Months';
  
  const rawStartDate = invoice?.startDate || invoice?.membershipStartDate || invoice?.date || invoice?.invoiceDate;
  const startDate = rawStartDate ? formatDate(rawStartDate) : formatDate(member?.startDate || member?.joinDate || new Date().toISOString());
  
  const rawEndDate = invoice?.expiryDate || invoice?.membershipExpiryDate || invoice?.endDate;
  const endDate = rawEndDate ? formatDate(rawEndDate) : formatDate(member?.expiryDate || new Date(Date.now() + 30*24*60*60*1000).toISOString());
  const billedBy = invoice?.billedBy || 'Veer Chand (manager)';

  const discount = Number(invoice?.discountAmount !== undefined ? invoice.discountAmount : (invoice?.discount || 0));
  const tax = Number(invoice?.taxAmount !== undefined ? invoice.taxAmount : (invoice?.tax || invoice?.gst || 0));

  // Package Fees is canonical original price (e.g. Rs. 3,000)
  const packageFees = Number(
    invoice?.originalAmount !== undefined ? invoice.originalAmount :
    invoice?.packagePrice !== undefined ? invoice.packagePrice :
    (invoice?.amount !== undefined ? Number(invoice.amount) + discount - tax : member?.totalBilled || 3000)
  );

  const calculatedNet = Math.max(0, packageFees - discount + tax);
  const netPayable = Number(invoice?.netPayable !== undefined ? invoice.netPayable : calculatedNet);
  const paidAmount = Number(
    invoice?.amountPaid !== undefined ? invoice.amountPaid :
    invoice?.paid !== undefined ? invoice.paid : netPayable
  );
  const pendingAmount = Math.max(0, netPayable - paidAmount);
  const paymentMethod = invoice?.paymentMethod || invoice?.method || member?.paymentMethod || 'UPI';

  const isUpgrade = Boolean(
    invoice?.isUpgrade ||
    invoice?.transactionType === 'membership_upgrade' ||
    invoice?.type === 'UPGRADE' ||
    String(invoice?.invoiceNumber || '').startsWith('INV-UPG')
  );
  const previousInvoiceNumber = invoice?.previousInvoiceNumber || invoice?.originalInvoiceNumber || null;
  const previousInvoiceDate = (invoice?.previousInvoiceDate || invoice?.originalInvoiceDate)
    ? formatDate(invoice?.previousInvoiceDate || invoice?.originalInvoiceDate)
    : null;
  const previousPaidAmount = Number(invoice?.previousPaidAmount || invoice?.adjustedAmount || 0);
  const adjustedAmount = Number(invoice?.adjustedAmount !== undefined ? invoice.adjustedAmount : previousPaidAmount);
  const additionalAmountPaid = Number(
    invoice?.additionalAmountPaid !== undefined ? invoice.additionalAmountPaid : (invoice?.amountPaid || 0)
  );

  const upgradeBaseAmount = Number(
    invoice?.upgradeBaseAmount !== undefined ? invoice.upgradeBaseAmount :
    (invoice?.amountBeforeDiscount !== undefined ? invoice.amountBeforeDiscount : Math.max(0, packageFees - adjustedAmount))
  );
  const netUpgradeAmount = Number(
    invoice?.netPayable !== undefined ? invoice.netPayable : Math.max(0, upgradeBaseAmount - discount)
  );

  const effectivePendingAmount = isUpgrade
    ? (invoice?.pendingAmount !== undefined ? Number(invoice.pendingAmount) : (invoice?.remainingBalance !== undefined ? Number(invoice.remainingBalance) : Math.max(0, netUpgradeAmount - additionalAmountPaid)))
    : pendingAmount;

  return (
    <div id="printable-official-invoice" className="bg-white text-black p-8 rounded-xl max-w-[800px] w-full mx-auto font-sans shadow-lg border border-slate-200 official-invoice-print-area">
      {/* ── TOP HEADER (Logo + Address) ── */}
      <div className="flex justify-between items-start mb-6">
        <div>
          {/* Logo */}
          <div className="flex items-center gap-3 mb-2">
            <div className="w-16 h-16 relative shrink-0">
              <img 
                src="/gymlogo.png" 
                alt="The Warrior Gym Logo" 
                className="w-full h-full object-contain"
                onError={(e: any) => {
                  e.target.onerror = null;
                }}
              />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-black leading-none uppercase font-display">
                The Warrior Gym
              </h1>
              <p className="text-xs font-semibold text-slate-700 mt-1 font-mono">
                Invoice number: {invNumber}
              </p>
              {isUpgrade && (
                <div className="mt-1.5">
                  <span className="px-2.5 py-0.5 bg-purple-100 text-purple-800 text-[10px] font-black uppercase tracking-wider rounded-md border border-purple-300 inline-block shadow-2xs">
                    ⚡ UPGRADED MEMBERSHIP
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Gym Address Info */}
        <div className="text-right text-xs font-medium text-slate-800 leading-relaxed max-w-[340px]">
          <p><span className="font-bold">Address:</span> THE WARRIOR GYM, SCO 30, 31, SECTOR 89,</p>
          <p>MOHALI, PUNJAB, 140308</p>
          <p><span className="font-bold">Phone:</span> +91 98170 23336</p>
          <p><span className="font-bold">Website:</span> thewarriorgym.in</p>
          <p><span className="font-bold">E-Mail:</span> Ramansingh6158@gmail.com</p>
        </div>
      </div>

      {/* ── SECTION 1: Client Detail (Gray Header) ── */}
      <div className="mb-4">
        <div className="bg-[#808080] text-white px-3 py-1 text-sm font-bold tracking-wide rounded-t">
          Client Detail
        </div>
        <div className="border border-t-0 border-slate-300 p-3 bg-white text-xs flex justify-between items-start">
          <div className="space-y-1">
            <p><span className="font-bold">Member ID:</span> {memberId}</p>
            <p><span className="font-bold">Name:</span> {memberName}</p>
            <p><span className="font-bold">Phone:</span> {memberPhone}</p>
            {isUpgrade && previousInvoiceNumber && (
              <div className="pt-1.5 mt-1.5 border-t border-slate-200 font-mono text-[11px] text-purple-900 space-y-0.5">
                <p><span className="font-bold">Original Invoice:</span> {previousInvoiceNumber}</p>
                {previousInvoiceDate && <p><span className="font-bold">Original Payment Date:</span> {previousInvoiceDate}</p>}
              </div>
            )}
          </div>
          <div className="text-right space-y-0.5">
            <p><span className="font-bold">{isUpgrade ? 'Upgrade Invoice Date:' : 'Payment date:'}</span> {billDate}</p>
            {billTime && <p><span className="font-bold">Payment time:</span> {billTime}</p>}
            {createdDateStr && createdDateStr !== billDate && (
              <p className="text-[10px] text-slate-500 font-mono mt-1"><span className="font-bold">Created in system:</span> {createdDateStr}</p>
            )}
          </div>
        </div>
      </div>

      {/* ── SECTION 2: Description (Gray Header) ── */}
      <div className="mb-4">
        <div className="bg-[#808080] text-white px-3 py-1 text-sm font-bold tracking-wide rounded-t">
          Description
        </div>
        <div className="border border-t-0 border-slate-300 p-3 bg-white text-xs flex justify-between items-start">
          <div className="space-y-1">
            <p><span className="font-bold">{isUpgrade ? 'Upgraded Package:' : 'Package name:'}</span> {planName}</p>
            <p><span className="font-bold">End date:</span> {endDate}</p>
          </div>
          <div className="text-right space-y-1">
            <p><span className="font-bold">Start date:</span> {startDate}</p>
            <p><span className="font-bold">Billed by:</span> {billedBy}</p>
          </div>
        </div>
      </div>

      {/* ── SECTION 3: Billing Detail (Gray Header) ── */}
      <div className="mb-4">
        <div className="bg-[#808080] text-white px-3 py-1 text-sm font-bold tracking-wide rounded-t flex items-center justify-between">
          <span>Billing Detail</span>
          {isUpgrade && <span className="text-[10px] uppercase font-mono tracking-widest bg-purple-900 text-purple-100 px-2 py-0.5 rounded">UPGRADE ADJUSTMENT</span>}
        </div>
        <div className="border border-t-0 border-slate-300 p-3 bg-white text-xs space-y-2">
          <div className="flex justify-between border-b border-slate-100 pb-1">
            <span>{isUpgrade ? 'New Package Price:' : 'Package fees:'}</span>
            <span className="font-bold">Rs. {packageFees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
          {isUpgrade ? (
            <>
              {previousPaidAmount > 0 && (
                <div className="flex justify-between border-b border-slate-100 pb-1 text-slate-600">
                  <span>Previous Paid Amount:</span>
                  <span className="font-bold font-mono">Rs. {previousPaidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-slate-100 pb-1 text-emerald-800 font-semibold bg-emerald-50/70 px-1 py-0.5 rounded">
                <span>Adjusted Amount (Carried Forward):</span>
                <span className="font-bold font-mono">- Rs. {adjustedAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              {discount > 0 && (
                <>
                  <div className="flex justify-between border-b border-slate-100 pb-1 text-slate-700">
                    <span>Upgrade Amount Before Discount:</span>
                    <span className="font-bold font-mono">Rs. {upgradeBaseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between border-b border-slate-100 pb-1 text-emerald-700 font-semibold">
                    <span>Discount Applied {invoice?.discountType === 'percentage' && invoice?.discountValue ? `(${invoice.discountValue}%)` : ''}:</span>
                    <span className="font-bold font-mono">- Rs. {discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                  </div>
                </>
              )}
              <div className="flex justify-between border-b border-slate-100 pb-1 font-bold text-slate-900">
                <span>Net Upgrade Amount:</span>
                <span className="font-black font-mono">Rs. {netUpgradeAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between pt-1 font-bold text-slate-900">
                <span>Additional Amount Paid : Via {paymentMethod}</span>
                <span className="font-black font-mono text-emerald-700">Rs. {additionalAmountPaid.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span>Other Charges:</span>
                <span className="font-bold">Rs. 0.00</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span>Discount:</span>
                <span className="font-bold">Rs. {discount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span>TAX :</span>
                <span className="font-bold">Rs. 0.00</span>
              </div>
              <div className="flex justify-between border-b border-slate-100 pb-1">
                <span>Reward Points Redeemed :</span>
                <span className="font-bold">Rs. 0.00</span>
              </div>
              <div className="flex justify-between pt-1">
                <span>First amount paid : Via {paymentMethod}</span>
                <span className="font-bold">Rs. {paidAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── SECTION 4: Pending Amount Box ── */}
      <div className="mb-6 border border-slate-400 bg-[#808080] text-white flex justify-between items-center rounded overflow-hidden">
        <div className="px-4 py-2.5 text-base font-extrabold tracking-wide">
          Pending Amount
        </div>
        <div className="bg-white text-black px-6 py-2.5 text-base font-black border-l border-slate-400 text-right min-w-[140px]">
          Rs. {effectivePendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
        </div>
      </div>

      {/* ── SECTION 5: Terms & Conditions (Red Italic Text) ── */}
      <div className="mb-8 text-[11px] font-semibold text-[#ef4444] italic leading-tight space-y-1">
        <p className="font-bold uppercase not-italic text-slate-900 mb-1">Terms &amp; Condition</p>
        <p>1. Payment once made that will be non-refundable and non-transferable.</p>
        <p>2. Your Package is non-freezable; in any case it will be charge 500/- month.</p>
        <p>3. Members are requested to take care of their belongings, The Warrior Gym will not be liable for any loss/ damage/ theft of items, cell phone, wallet etc.</p>
        <p>4. Members are strongly advised to wear sports shoes and sports outfits while working out.</p>
        <p>5. Dumbell and weight should not be dropped but gently placed on floor.</p>
        <p>6. Guest/ Kids are not allowed in gym area without management approval.</p>
        <p>7. Management has the right to terminate the membership without notice for breach of gym rules.</p>
        <p>8. Eatables such as chewing gums, Chocolates and junk food are not allowed in the Gym.</p>
        <p>9. Membership will Cease to exist if the payment is overdue.</p>
        <p>10. Management is not responsible for ego lifting.</p>
      </div>

      {/* ── SECTION 6: Acceptance & Signature Line ── */}
      <div className="text-center space-y-4 my-8">
        <p className="text-xs font-bold text-slate-800">
          To accept this invoice, sign here and return <span className="font-mono">________________________</span>
        </p>
        <p className="text-sm font-extrabold text-slate-900">
          Thank you for your business and we look forward to coaching you.
        </p>
      </div>

      {/* ── SECTION 7: Bottom Dark Footer Bar ── */}
      <div className="bg-[#1e293b] text-white py-3 px-4 text-center text-[10px] font-bold tracking-wider rounded-b uppercase">
        THE WARRIOR GYM, SCO 30, 31, SECTOR 89, MOHALI, PUNJAB, 140308
      </div>
    </div>
  );
}
