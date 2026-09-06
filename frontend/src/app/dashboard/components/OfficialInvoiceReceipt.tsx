'use client';

import React from 'react';
import { formatDate } from '@/lib/utils';

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
  const memberName = member?.name || invoice?.memberName || 'Charu Sharma';
  const memberPhone = member?.phone || invoice?.memberPhone || '9896240939';
  
  const billDate = invoice?.date ? formatDate(invoice.date) : formatDate(member?.joinDate || new Date().toISOString());
  const planName = invoice?.plan || member?.plan || '3 Months';
  const startDate = invoice?.startDate ? formatDate(invoice.startDate) : formatDate(member?.joinDate || new Date().toISOString());
  const endDate = invoice?.expiryDate ? formatDate(invoice.expiryDate) : formatDate(member?.expiryDate || new Date(Date.now() + 90*24*60*60*1000).toISOString());
  const billedBy = invoice?.billedBy || 'Manager';

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
                  e.target.src = 'https://i.ibb.co/vzG7CgD/warrior-gym-logo.png';
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
            </div>
          </div>
        </div>

        {/* Gym Address Info */}
        <div className="text-right text-xs font-medium text-slate-800 leading-relaxed max-w-[340px]">
          <p><span className="font-bold">Address:</span> MNB GROUP, SCO 16-17, 2ND FLOOR, LANDRAN, ROAD,</p>
          <p>SOHANA, MOHALI, 140308</p>
          <p><span className="font-bold">Phone:</span> +919779333155</p>
          <p><span className="font-bold">Website:</span> thewarriorgym.in</p>
          <p><span className="font-bold">E-Mail:</span> thewarriorgym@gmail.com</p>
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
          </div>
          <div className="text-right">
            <p><span className="font-bold">Billing date:</span> {billDate}</p>
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
            <p><span className="font-bold">Package name:</span> {planName}</p>
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
        <div className="bg-[#808080] text-white px-3 py-1 text-sm font-bold tracking-wide rounded-t">
          Billing Detail
        </div>
        <div className="border border-t-0 border-slate-300 p-3 bg-white text-xs space-y-2">
          <div className="flex justify-between border-b border-slate-100 pb-1">
            <span>Package fees:</span>
            <span className="font-bold">Rs. {packageFees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
          </div>
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
        </div>
      </div>

      {/* ── SECTION 4: Pending Amount Box ── */}
      <div className="mb-6 border border-slate-400 bg-[#808080] text-white flex justify-between items-center rounded overflow-hidden">
        <div className="px-4 py-2.5 text-base font-extrabold tracking-wide">
          Pending Amount
        </div>
        <div className="bg-white text-black px-6 py-2.5 text-base font-black border-l border-slate-400 text-right min-w-[140px]">
          Rs. {pendingAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
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
        MNB GROUP, SCO 16-17, 2ND FLOOR, LANDRAN, ROAD, SOHANA, MOHALI, 140308
      </div>
    </div>
  );
}
