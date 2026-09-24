import { Request, Response } from 'express';
import { db } from '../firebase';
import { triggerPaymentEmail } from '../services/automation.service';
import { resolveStaleRenewalFollowups } from '../services/followupAutomation.service';

export const getInvoices = async (req: Request, res: Response) => {
  try {
    const { memberId, limit } = req.query || {};
    const list = await db.getPayments({
      memberId: typeof memberId === 'string' ? memberId : undefined,
      limit: limit ? Number(limit) : undefined
    });
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createInvoice = async (req: Request, res: Response) => {
  try {
    const {
      memberId, originalAmount, discountAmount, discount, taxAmount, gst, tax, otherCharges,
      netPayable, amount, paid, amountPaid, plan, method, memberName, memberPhone, date, notes, idempotencyKey
    } = req.body;

    const origAmt = Number(originalAmount !== undefined ? originalAmount : (amount || 0));
    const discAmt = Number(discountAmount !== undefined ? discountAmount : (discount || 0));
    const taxAmt = Number(taxAmount !== undefined ? taxAmount : (gst || tax || 0));
    const othAmt = Number(otherCharges || 0);

    const calculatedNet = Math.max(0, origAmt - discAmt + taxAmt + othAmt);
    const finalNet = Number(netPayable !== undefined ? netPayable : (calculatedNet > 0 ? calculatedNet : (amount || 0)));
    const finalPaid = Number(amountPaid !== undefined ? amountPaid : (paid !== undefined ? paid : finalNet));

    if (!finalPaid && !finalNet) {
      return res.status(400).json({ error: 'Payment amount is required' });
    }

    const members = await db.getMembers();
    const m = members.find(item => 
      item.id === memberId || 
      item.memberId === memberId || 
      (memberPhone && item.phone === memberPhone) ||
      (memberName && item.name?.toLowerCase().trim() === memberName.toLowerCase().trim())
    );

    const now = new Date();
    const todayYMD = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
    }).format(now);
    const txType = req.body.transactionType || (req.body.billingType === 'PT' || req.body.invoiceType === 'PT' ? 'pt_payment' : (req.body.type === 'POS' ? 'other_payment' : 'membership_payment'));
    const isHist = req.body.isHistorical ?? (txType === 'historical_import' || req.body.imported || false);
    const invoiceDate = date || todayYMD;

    const invoice = await db.addPayment({
      memberId: m?.id || memberId || `m_${Date.now()}`,
      memberName: m?.name || memberName || 'Gym Member',
      memberPhone: m?.phone || memberPhone || '',
      originalAmount: origAmt,
      discountAmount: discAmt,
      discount: discAmt,
      taxAmount: taxAmt,
      otherCharges: othAmt,
      netPayable: finalNet,
      amount: finalNet,
      amountPaid: finalPaid,
      paid: finalPaid,
      outstandingAmount: Math.max(0, finalNet - finalPaid),
      pendingAmount: Math.max(0, finalNet - finalPaid),
      plan: plan || m?.plan || 'Monthly Standard',
      method: method || 'Cash',
      status: Math.max(0, finalNet - finalPaid) <= 0 ? 'paid' : (finalPaid > 0 ? 'partial' : 'pending'),
      date: invoiceDate,
      paymentDate: req.body.paymentDate || invoiceDate,
      transactionType: txType,
      isHistorical: isHist,
      imported: Boolean(req.body.imported || isHist),
      idempotencyKey: idempotencyKey || `pay_${m?.id || memberId}_${plan}_${invoiceDate}`,
      isRealTimeToday: !isHist && invoiceDate === todayYMD,
      notes: notes || 'Member Payment Invoice'
    });

    // Trigger Payment Invoice & Receipt Email
    triggerPaymentEmail(invoice).catch(err => console.error('[Automation] Payment email failed:', err));

    // Automatically extend membership expiry if member exists
    if (m) {
      let newExpiryString = '';
      if (req.body.newExpiryDate || req.body.expiryDate) {
        newExpiryString = req.body.newExpiryDate || req.body.expiryDate;
      } else {
        let daysToAdd = 30;
        if (plan === 'Quarterly' || plan === '3 Months') daysToAdd = 90;
        if (plan === 'Semi-Annual' || plan === '6 Months') daysToAdd = 180;
        if (plan === 'Annual Premium' || plan === 'Annual' || plan === '12 Months') daysToAdd = 365;

        const currentExpiry = m.expiryDate && new Date(m.expiryDate).getTime() > Date.now() 
          ? new Date(m.expiryDate) 
          : new Date();
        const newExpiry = new Date(currentExpiry.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
        newExpiryString = newExpiry.toISOString().split('T')[0];
      }

      const existingHistory = Array.isArray(m.membershipHistory) ? m.membershipHistory : [];
      const newHistoryEntry = {
        transactionId: invoice.id,
        plan: plan || m.plan || 'Standard',
        startDate: req.body.startDate || m.startDate || todayYMD,
        expiryDate: newExpiryString,
        amount: finalNet,
        paid: finalPaid,
        invoiceId: invoice.invoiceNumber || invoice.id,
        createdAt: new Date().toISOString(),
      };

      const canonicalTx = {
        transactionId: invoice.id,
        memberId: m.id,
        memberCode: m.memberId || '',
        biometricId: m.biometricId || m.deviceUserId || '',
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoiceNumber || invoice.invoice || `INV-${invoice.id.slice(-6)}`,
        packageId: req.body.packageId || 'pkg_standard',
        packageName: plan || m.plan || 'General Membership',
        billingDate: invoiceDate,
        paymentDate: req.body.paymentDate || invoiceDate,
        startDate: req.body.startDate || m.startDate || todayYMD,
        expiryDate: newExpiryString,
        originalAmount: origAmt,
        discount: discAmt,
        tax: taxAmt,
        otherCharges: othAmt,
        netPayable: finalNet,
        amountPaid: finalPaid,
        pendingAmount: 0,
        paymentMethod: method || 'UPI',
        paymentStatus: 'PAID',
        billingType: txType === 'pt_payment' ? 'PT' : 'MEMBERSHIP',
        isHistorical: isHist,
        createdAt: invoice.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const existingBillingHistory = Array.isArray(m.billingHistory) ? m.billingHistory : [];
      const updatedBillingHistory = [canonicalTx, ...existingBillingHistory.filter((b: any) => b.transactionId !== invoice.id && b.invoiceNumber !== canonicalTx.invoiceNumber)];

      // Canonical recalculation: derive totalPaid and totalBilled from unique billing history
      const newTotalPaid = updatedBillingHistory.reduce((sum: number, b: any) => sum + (Number(b.amountPaid || b.paid || 0)), 0);
      const totalBilled = updatedBillingHistory.reduce((sum: number, b: any) => sum + (Number(b.netPayable || b.amount || 0)), 0);
      const newOutstanding = Math.max(0, totalBilled - newTotalPaid);
      const newPaymentStatus = newOutstanding <= 0 ? 'paid' : (newTotalPaid > 0 ? 'partial' : 'pending');
      canonicalTx.pendingAmount = newOutstanding;
      canonicalTx.paymentStatus = newOutstanding <= 0 ? 'PAID' : (finalPaid > 0 ? 'PARTIAL' : 'UNPAID');

      const expiryTime = new Date(`${newExpiryString}T23:59:59.999+05:30`).getTime();
      const nextStatus = newExpiryString >= todayYMD ? 'active' : 'expired';

      await db.updateMember(m.id, {
        plan: plan || m.plan || 'Standard',
        startDate: m.startDate || req.body.startDate || todayYMD,
        expiryDate: newExpiryString,
        status: nextStatus,
        membershipStatus: nextStatus.toUpperCase(),
        activationStatus: nextStatus.toUpperCase(),
        paymentStatus: newPaymentStatus,
        totalBilled: totalBilled,
        totalPaid: newTotalPaid,
        amountPaid: newTotalPaid,
        paid: newTotalPaid,
        outstandingBalance: newOutstanding,
        pendingBalance: newOutstanding,
        balanceAmount: newOutstanding,
        daysLeft: Math.ceil((expiryTime - Date.now()) / (1000 * 60 * 60 * 24)),
        membershipHistory: [...existingHistory, newHistoryEntry],
        billingHistory: updatedBillingHistory,
        payments: updatedBillingHistory,
        updatedAt: new Date().toISOString()
      });

      // Auto-resolve old stale renewal follow-ups
      if (txType === 'pt_payment' || req.body.billingType === 'PT') {
        resolveStaleRenewalFollowups(m.id, 'PT', req.body.ptExpiryDate || req.body.expiryDate || newExpiryString).catch(() => {});
      } else {
        resolveStaleRenewalFollowups(m.id, 'MEMBERSHIP', newExpiryString).catch(() => {});
      }

      if (newOutstanding <= 0) {
        resolveStaleRenewalFollowups(m.id, 'BALANCE').catch(() => {});
      }
    }

    res.status(201).json(invoice);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const markPaymentPaid = async (req: Request, res: Response) => {
  try {
    const { memberId } = req.params;
    const members = await db.getMembers();
    const m = members.find(item => item.id === memberId);
    if (!m) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Update member payment status
    await db.updateMember(memberId, { paymentStatus: 'paid' });

    // Find plan price
    const plansList = await db.getPlans();
    const matchedPlan = plansList.find(p => p.name?.toLowerCase() === (m.plan || '').toLowerCase());
    const amount = matchedPlan ? matchedPlan.price : 2500;
    const todayYMD = new Date().toISOString().split('T')[0];

    // Generate Invoice
    const invoice = await db.addPayment({
      memberId: m.id,
      memberName: m.name,
      originalAmount: Number(amount),
      discountAmount: 0,
      netPayable: Number(amount),
      amount: Number(amount),
      amountPaid: Number(amount),
      paid: Number(amount),
      outstandingAmount: 0,
      plan: m.plan || 'Monthly',
      method: 'UPI',
      status: 'paid',
      date: todayYMD,
      paymentDate: todayYMD,
      transactionType: 'membership_payment',
      isHistorical: false,
      imported: false,
      isRealTimeToday: true
    });

    // Trigger Email
    triggerPaymentEmail(invoice).catch(err => console.error('[Automation] Payment email failed:', err));

    // Auto-resolve pending balance followups
    resolveStaleRenewalFollowups(m.id, 'BALANCE').catch(() => {});

    res.json({ message: 'Payment marked as paid and invoice sent', invoice });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const updatedInvoice = await db.updatePayment(id, updates);
    res.json({ success: true, message: 'Invoice updated successfully', invoice: updatedInvoice });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const memberIdQuery = (req.query.memberId as string) || req.body?.memberId;

    // 1. Mark payment as deleted in payments collection
    await db.deletePayment(id);

    // 2. Find associated member to synchronize member financials and status
    const members = await db.getMembers();
    let m = memberIdQuery ? members.find(item => item.id === memberIdQuery || item.memberId === memberIdQuery) : null;

    if (!m) {
      m = members.find(item => {
        const bHist = Array.isArray(item.billingHistory) ? item.billingHistory : [];
        const mHist = Array.isArray(item.membershipHistory) ? item.membershipHistory : [];
        const pHist = Array.isArray(item.payments) ? item.payments : [];
        return (
          bHist.some((b: any) => b.transactionId === id || b.invoiceId === id || b.invoiceNumber === id || b.invoice === id) ||
          mHist.some((h: any) => h.transactionId === id || h.invoiceId === id) ||
          pHist.some((p: any) => p.transactionId === id || p.invoiceId === id || p.invoiceNumber === id || p.id === id)
        );
      }) || null;
    }

    if (m) {
      const now = new Date();
      const todayYMD = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(now);

      const existingBilling = Array.isArray(m.billingHistory) ? m.billingHistory : [];
      const updatedBillingHistory = existingBilling.filter((b: any) =>
        b.transactionId !== id && b.invoiceId !== id && b.invoiceNumber !== id && b.invoice !== id && b.id !== id
      );

      const existingMembership = Array.isArray(m.membershipHistory) ? m.membershipHistory : [];
      const updatedMembershipHistory = existingMembership.filter((h: any) =>
        h.transactionId !== id && h.invoiceId !== id && h.invoiceNumber !== id && h.id !== id
      );

      const existingPt = Array.isArray(m.ptHistory) ? m.ptHistory : [];
      const updatedPtHistory = existingPt.filter((p: any) =>
        p.transactionId !== id && p.invoiceId !== id && p.invoiceNumber !== id && p.id !== id
      );

      const newTotalBilled = updatedBillingHistory.reduce((sum: number, b: any) => sum + (Number(b.netPayable || b.amount || 0)), 0);
      const newTotalPaid = updatedBillingHistory.reduce((sum: number, b: any) => sum + (Number(b.amountPaid || b.paid || 0)), 0);
      const newOutstanding = Math.max(0, newTotalBilled - newTotalPaid);
      const newPaymentStatus = newOutstanding <= 0 ? (newTotalPaid > 0 ? 'paid' : 'pending') : (newTotalPaid > 0 ? 'partial' : 'pending');

      const updates: any = {
        billingHistory: updatedBillingHistory,
        payments: updatedBillingHistory,
        membershipHistory: updatedMembershipHistory,
        ptHistory: updatedPtHistory,
        totalBilled: newTotalBilled,
        amount: newTotalBilled,
        price: newTotalBilled,
        totalPaid: newTotalPaid,
        amountPaid: newTotalPaid,
        paid: newTotalPaid,
        outstandingBalance: newOutstanding,
        pendingBalance: newOutstanding,
        balance: newOutstanding,
        balanceAmount: newOutstanding,
        paymentStatus: newPaymentStatus,
        updatedAt: now.toISOString()
      };

      if (updatedMembershipHistory.length === 0 && updatedBillingHistory.length === 0) {
        const isExcelImport = m.source === 'excel_import' || !m.phone;
        const revertStatus = isExcelImport ? 'hold' : 'inactive';
        updates.status = revertStatus;
        updates.membershipStatus = revertStatus.toUpperCase();
        updates.activationStatus = revertStatus.toUpperCase();
        updates.plan = '';
        updates.packageName = '';
        updates.membershipPlan = '';
        updates.expiryDate = '';
        updates.membershipExpiryDate = '';
        updates.daysLeft = 0;
      } else if (updatedMembershipHistory.length > 0) {
        const sorted = [...updatedMembershipHistory].sort((a: any, b: any) =>
          new Date(b.expiryDate || 0).getTime() - new Date(a.expiryDate || 0).getTime()
        );
        const latest = sorted[0];
        const latestExpiry = latest.expiryDate || '';
        const expiryTime = latestExpiry ? new Date(`${latestExpiry}T23:59:59.999+05:30`).getTime() : 0;
        const nextStatus = latestExpiry >= todayYMD ? 'active' : 'expired';

        updates.plan = latest.plan || m.plan;
        updates.startDate = latest.startDate || m.startDate;
        updates.expiryDate = latestExpiry;
        updates.status = nextStatus;
        updates.membershipStatus = nextStatus.toUpperCase();
        updates.activationStatus = nextStatus.toUpperCase();
        updates.daysLeft = expiryTime ? Math.ceil((expiryTime - Date.now()) / (1000 * 60 * 60 * 24)) : 0;
      }

      await db.updateMember(m.id, updates);
    }

    res.json({ success: true, message: 'Payment deleted and member synchronized successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const cleanupDuplicateInvoicesController = async (req: Request, res: Response) => {
  try {
    const report = await db.cleanupDuplicateInvoices();
    res.json({ success: true, message: `Deduplicated ${report.length} duplicate invoice pairs.`, report });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

