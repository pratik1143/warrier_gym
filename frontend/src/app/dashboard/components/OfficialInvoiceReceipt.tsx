'use client';

import React from 'react';
import { formatDate } from '@/lib/utils';

interface OfficialInvoiceProps {
  invoice: any;
  member: any;
  onPrint?: () => void;
  onWhatsApp?: () => void;
  compact?: boolean;
}

const money = (value: number) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

export default function OfficialInvoiceReceipt({ invoice, member, compact = false }: OfficialInvoiceProps) {
  if (!invoice && !member) return null;

  const invNumber = invoice?.invoiceNumber || invoice?.invoice || invoice?.invoiceId || 'INV-00000';
  const memberId = member?.biometricId || member?.deviceUserId || member?.clientId || member?.customId || member?.memberId || invoice?.memberId || '—';
  const memberName = member?.name || invoice?.memberName || 'Member';
  const memberPhone = member?.phone || invoice?.memberPhone || invoice?.phone || '—';
  const billDateRaw = invoice?.billingDate || invoice?.date || invoice?.paymentDate || invoice?.createdAt || member?.joinDate;
  const billDate = billDateRaw ? formatDate(billDateRaw) : formatDate(new Date().toISOString());
  const planName = invoice?.plan || invoice?.packageName || invoice?.package || member?.plan || 'Membership';
  const startDateRaw = invoice?.startDate || member?.joinDate;
  const endDateRaw = invoice?.expiryDate || invoice?.newExpiryDate || member?.expiryDate;
  const startDate = startDateRaw ? formatDate(startDateRaw) : '—';
  const endDate = endDateRaw ? formatDate(endDateRaw) : '—';
  const startTime = startDateRaw ? new Date(startDateRaw).getTime() : NaN;
  const endTime = endDateRaw ? new Date(endDateRaw).getTime() : NaN;
  const durationDays = Number.isFinite(startTime) && Number.isFinite(endTime)
    ? Math.max(0, Math.round((endTime - startTime) / 86400000) + 1)
    : Number(invoice?.durationDays || member?.durationDays || 0);

  const discount = Number(invoice?.discountAmount ?? invoice?.discount ?? 0);
  const tax = Number(invoice?.taxAmount ?? invoice?.tax ?? invoice?.gst ?? 0);
  const otherCharges = Number(invoice?.otherCharges || 0);
  const packageFees = Number(invoice?.originalAmount ?? invoice?.packagePrice ?? (invoice?.amount !== undefined ? Number(invoice.amount) + discount - tax - otherCharges : member?.totalBilled ?? 0));
  const netPayable = Number(invoice?.netPayable ?? Math.max(0, packageFees - discount + tax + otherCharges));
  const paidAmount = Number(invoice?.amountPaid ?? invoice?.paid ?? invoice?.amountPaidToday ?? netPayable);
  const pendingAmount = Number(invoice?.outstandingAmount ?? invoice?.pendingAmount ?? Math.max(0, netPayable - paidAmount));
  const refunded = Number(invoice?.refundedAmount ?? invoice?.refundAmount ?? invoice?.refunded ?? 0);
  const freezeDays = Number(invoice?.freezeDays ?? invoice?.noFreeze ?? invoice?.frozenDays ?? 0);
  const paymentMethod = invoice?.paymentMethod || invoice?.method || member?.paymentMethod || 'UPI';
  const paymentStatus = String(invoice?.status || invoice?.paymentStatus || (pendingAmount > 0 ? 'PARTIAL' : 'PAID')).toUpperCase();

  const rows = [
    { label: 'PACKAGE', detail: planName, amount: money(packageFees), strong: false },
    { label: 'NO. OF DAYS', detail: durationDays ? `${durationDays} Days` : `${startDate} — ${endDate}`, amount: '—', strong: false },
    ...(discount > 0 ? [{ label: 'DISCOUNT', detail: 'Membership offer', amount: `− ${money(discount)}`, strong: false }] : []),
    ...(tax > 0 ? [{ label: 'TAX / GST', detail: 'Applicable tax', amount: money(tax), strong: false }] : []),
    { label: 'TOTAL PAID', detail: paymentMethod, amount: money(paidAmount), strong: true },
    { label: 'NO. REFUNDED', detail: 'Refunded amount', amount: money(refunded), strong: false },
    { label: 'NO. FREEZE', detail: `${freezeDays} Days`, amount: '—', strong: false },
    { label: 'BALANCE', detail: pendingAmount > 0 ? 'Pending' : 'Fully paid', amount: money(pendingAmount), strong: true },
  ];

  return (
    <div
      id={compact ? undefined : 'printable-official-invoice'}
      style={compact ? { position: 'fixed', left: '-12000px', top: 0, width: '1120px' } : undefined}
      className="official-invoice-print-area mx-auto w-full max-w-[1180px] overflow-hidden rounded-[22px] border-[3px] border-[#c99a3b] bg-[#070707] p-3 text-[#f7f1e4] shadow-2xl sm:p-5"
    >
      <div className="rounded-[16px] border border-[#8f6828] p-4 sm:p-6">
        <div className="flex flex-col items-center gap-3 border-b border-[#8f6828] pb-4 text-center md:flex-row md:items-center md:text-left">
          <img src="/gymlogo.png" alt="The Warrior Gym" className="h-[112px] w-[150px] shrink-0 object-contain" />
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-black uppercase leading-none tracking-[0.04em] text-[#e1b85b] sm:text-5xl">The Warrior Gym</h1>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.32em] text-[#e7dfce] sm:text-xs">Building Strength, Building Warriors</p>
          </div>
          <div className="text-center text-[10px] leading-relaxed text-[#d7c79e] md:min-w-[230px] md:text-right">
            <p className="font-bold text-[#efca70]">THE WARRIOR GYM</p>
            <p>SCO 30, 31, Sector 89, Mohali 140308</p>
            <p>+91 98170 23336 · thewarriorgym.in</p>
            <p>Ramansingh6158@gmail.com</p>
          </div>
        </div>

        <div className="my-4 flex items-center justify-center gap-3">
          <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#a47a31]" />
          <div className="border border-[#d2a747] bg-gradient-to-b from-[#3b2b10] to-[#171107] px-5 py-2 text-center text-sm font-black uppercase tracking-[0.14em] text-[#efc65e] shadow-[0_0_18px_rgba(201,154,59,0.14)] sm:px-10 sm:text-xl">Membership Receipt</div>
          <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#a47a31]" />
        </div>

        <div className="grid grid-cols-1 gap-4 border-b border-dotted border-[#9b742f] pb-4 md:grid-cols-2 md:gap-8">
          <div className="space-y-3">
            <div className="flex items-baseline gap-3 border-b border-dotted border-[#725523] pb-2"><span className="w-28 text-[10px] font-bold uppercase tracking-wider text-[#d8ad4d]">Member Name</span><span className="text-sm font-semibold text-white sm:text-base">{memberName}</span></div>
            <div className="flex items-baseline gap-3 border-b border-dotted border-[#725523] pb-2"><span className="w-28 text-[10px] font-bold uppercase tracking-wider text-[#d8ad4d]">Phone</span><span className="text-sm text-[#eee7d8]">{memberPhone}</span></div>
            <div className="flex items-baseline gap-3"><span className="w-28 text-[10px] font-bold uppercase tracking-wider text-[#d8ad4d]">Member ID</span><span className="text-sm text-[#eee7d8]">{memberId}</span></div>
          </div>
          <div className="space-y-3 md:border-l md:border-[#725523] md:pl-8">
            <div className="flex items-baseline justify-between gap-3 border-b border-dotted border-[#725523] pb-2"><span className="text-[10px] font-bold uppercase tracking-wider text-[#d8ad4d]">Join / Billing Date</span><span className="text-sm text-[#eee7d8]">{billDate}</span></div>
            <div className="flex items-baseline justify-between gap-3 border-b border-dotted border-[#725523] pb-2"><span className="text-[10px] font-bold uppercase tracking-wider text-[#d8ad4d]">Member Type</span><span className="text-sm text-[#eee7d8]">{invoice?.memberType || invoice?.billingType || 'Member'}</span></div>
            <div className="flex items-baseline justify-between gap-3"><span className="text-[10px] font-bold uppercase tracking-wider text-[#d8ad4d]">Package</span><span className="text-right text-sm text-[#eee7d8]">{planName}</span></div>
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-[#a98136]">
          <div className="grid grid-cols-[1fr_1.3fr_0.75fr] bg-gradient-to-r from-[#36270d] via-[#17130a] to-[#36270d] text-[10px] font-black uppercase tracking-widest text-[#e9bd56] sm:text-xs">
            <div className="px-3 py-2.5">Description</div><div className="border-x border-[#795b24] px-3 py-2.5 text-center">Details</div><div className="px-3 py-2.5 text-right">Amount</div>
          </div>
          {rows.map((row, index) => (
            <div key={`${row.label}-${index}`} className={`grid grid-cols-[1fr_1.3fr_0.75fr] border-t border-[#5c471f] text-[10px] sm:text-xs ${row.strong ? 'bg-[#15120b]' : 'bg-[#090909]'}`}>
              <div className={`px-3 py-2.5 font-bold tracking-wide ${row.strong ? 'text-[#efc65e]' : 'text-[#eee7d8]'}`}>{row.label}</div>
              <div className="border-x border-[#4a3919] px-2 py-2.5 text-center text-[#d8d0bf] sm:px-3">{row.detail}</div>
              <div className={`px-3 py-2.5 text-right ${row.strong ? 'font-black text-[#f0c85d]' : 'font-semibold text-white'}`}>{row.amount}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-lg border border-[#624a1e] bg-[#100e09] px-3 py-2 text-center"><div className="text-[9px] font-bold uppercase tracking-wider text-[#aa935d]">Net Payable</div><div className="font-black text-white">{money(netPayable)}</div></div>
          <div className="rounded-lg border border-[#765a21] bg-[#171207] px-3 py-2 text-center"><div className="text-[9px] font-bold uppercase tracking-wider text-[#d1ad55]">Payment Status</div><div className="font-black text-[#efc65e]">{paymentStatus}</div></div>
          <div className="rounded-lg border border-[#624a1e] bg-[#100e09] px-3 py-2 text-center"><div className="text-[9px] font-bold uppercase tracking-wider text-[#aa935d]">Payment Mode</div><div className="font-black text-white">{paymentMethod}</div></div>
        </div>

        <div className="mt-5 grid grid-cols-1 items-end gap-4 border-t border-[#8f6828] pt-4 sm:grid-cols-[1fr_auto_1fr]">
          <div className="text-center text-[9px] leading-relaxed text-[#cbbd9c] sm:text-left"><span className="font-bold uppercase tracking-wider text-[#dcb34f]">Address</span><br />SCO 30, 31, Sector 89<br />Mohali, Punjab 140308</div>
          <div className="mx-auto border-x border-[#b18839] px-5 py-2 text-center text-[9px] font-bold uppercase tracking-wider text-[#dcb34f]">★ Thank you for choosing<br /><span className="text-sm text-[#f0c85d]">The Warrior Gym</span> ★</div>
          <div className="text-center sm:text-right"><div className="font-serif text-2xl italic text-[#e1b85b]">Ramandeep Singh</div><div className="mx-auto mt-1 max-w-[210px] border-t border-[#9c772f] pt-1 text-[8px] font-bold uppercase tracking-[0.18em] text-[#cbbd9c] sm:ml-auto">Authorized Signature</div></div>
        </div>
        <div className="mt-4 rounded-full border border-[#7d5e23] bg-gradient-to-r from-[#080808] via-[#1a1408] to-[#080808] px-3 py-2 text-center text-[9px] font-black uppercase tracking-[0.18em] text-[#e0b650] sm:text-xs">Stronger Today <span className="mx-2 text-[#f2d582]">◆</span> Better Tomorrow</div>
        <div className="mt-2 text-center text-[8px] text-[#887852]">Invoice {invNumber} · Start {startDate} · Valid through {endDate}</div>
      </div>
    </div>
  );
}
