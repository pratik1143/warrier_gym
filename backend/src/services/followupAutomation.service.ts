import { db, getFirestoreDb } from '../firebase';

/**
 * Returns today's date in 'YYYY-MM-DD' format using Asia/Kolkata timezone.
 */
export function getKolkataDateString(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date); // returns 'YYYY-MM-DD'
  } catch (_) {
    // Fallback in case of environment timezone issue
    const tzOffset = 5.5 * 60 * 60 * 1000; // Asia/Kolkata is UTC+5:30
    const kolkataTime = new Date(date.getTime() + tzOffset);
    return kolkataTime.toISOString().split('T')[0];
  }
}

/**
 * Calculates calendar days difference between targetDate and baseDate (targetDate - baseDate).
 * Handles month boundaries, leap years, and year boundaries accurately.
 */
export function getCalendarDaysDiff(targetDateStr: string, baseDateStr: string): number {
  if (!targetDateStr || !baseDateStr) return NaN;
  
  const cleanTarget = targetDateStr.split('T')[0];
  const cleanBase = baseDateStr.split('T')[0];
  
  const [tY, tM, tD] = cleanTarget.split('-').map(Number);
  const [bY, bM, bD] = cleanBase.split('-').map(Number);
  
  if (!tY || !tM || !tD || !bY || !bM || !bD) return NaN;
  
  const targetUtc = Date.UTC(tY, tM - 1, tD);
  const baseUtc = Date.UTC(bY, bM - 1, bD);
  
  return Math.round((targetUtc - baseUtc) / (1000 * 60 * 60 * 24));
}

export interface AutomatedFollowupResult {
  generatedCount: number;
  skippedCount: number;
  resolvedCount: number;
  generatedKeys: string[];
}

/**
 * Main Automated Follow-Up Generation Engine.
 * Checks:
 * 1. UPCOMING GYM MEMBERSHIP RENEWAL (7 days before expiry)
 * 2. PT RENEWAL (4 days before PT expiry)
 * 3. PENDING BALANCE (2 days before payment due date when balance > 0)
 * 4. PENDING ENQUIRIES (creates idempotent follow-up for every pending enquiry with nextFollowUpDate)
 */
export async function generateAutomatedFollowups(todayStrOverride?: string): Promise<AutomatedFollowupResult> {
  const todayStr = todayStrOverride || getKolkataDateString();

  let members: any[] = [];
  let payments: any[] = [];
  let enquiries: any[] = [];
  let existingFollowups: any[] = [];

  try {
    members = await db.getMembers();
  } catch (err) {
    console.error('[Automation Engine] Error fetching members:', err);
  }

  try {
    payments = await db.getPayments();
  } catch (err) {
    console.error('[Automation Engine] Error fetching payments:', err);
  }

  try {
    enquiries = await db.getEnquiries();
  } catch (err) {
    console.error('[Automation Engine] Error fetching enquiries:', err);
  }

  try {
    existingFollowups = await db.getFollowups();
  } catch (err) {
    console.error('[Automation Engine] Error fetching followups:', err);
  }

  // Create a map of existing followups by automationKey and also by id
  const existingKeyMap = new Map<string, any>();
  for (const fol of existingFollowups) {
    if (fol.automationKey) {
      existingKeyMap.set(fol.automationKey, fol);
    }
    if (fol.id) {
      existingKeyMap.set(fol.id, fol);
    }
  }

  let generatedCount = 0;
  let skippedCount = 0;
  let resolvedCount = 0;
  const generatedKeys: string[] = [];

  const createdFollowups: any[] = [];

  // =============================================================
  // MEMBERS EVALUATION (RULES 1, 2, 3)
  // =============================================================
  for (const member of members) {
    const memberId = member.id || member.uid || member.memberId;
    if (!memberId) continue;

    const memberName = member.name || 'Member';
    const memberPhone = member.phone || '';
    const assignedStaff = member.trainer || member.assignedStaff || 'Receptionist';

    // -------------------------------------------------------------
    // RULE 1: UPCOMING GYM MEMBERSHIP RENEWAL (7 Days Before Expiry)
    // -------------------------------------------------------------
    const membershipExpiry = member.expiryDate ? member.expiryDate.split('T')[0] : null;
    const memberStatus = (member.status || '').toLowerCase();

    // Check only if member is active (not already expired in the past)
    if (membershipExpiry && (memberStatus === 'active' || memberStatus === 'upcoming' || memberStatus === 'frozen')) {
      const daysToExpiry = getCalendarDaysDiff(membershipExpiry, todayStr);

      if (daysToExpiry === 7) {
        const automationKey = `AUTO_RENEWAL_${memberId}_${membershipExpiry}`;

        if (existingKeyMap.has(automationKey)) {
          skippedCount++;
        } else {
          const payload = {
            id: automationKey,
            automationKey,
            memberId,
            memberName,
            phone: memberPhone,
            memberPhone,
            type: 'GYM MEMBERSHIP RENEWAL',
            reason: 'Membership renewal due in 7 days',
            title: 'GYM MEMBERSHIP RENEWAL',
            description: 'Membership renewal due in 7 days',
            notes: 'Membership renewal due in 7 days',
            priority: 'Medium',
            dueDate: todayStr,
            scheduledDate: todayStr,
            scheduledTime: '10:00',
            scheduledTimestamp: new Date(`${todayStr}T10:00:00+05:30`).getTime() || Date.now(),
            assignedTo: assignedStaff,
            status: 'pending',
            source: 'auto',
            plan: member.plan || 'Monthly Standard',
            expiryDate: membershipExpiry,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          createdFollowups.push(payload);
          existingKeyMap.set(automationKey, payload);
          generatedKeys.push(automationKey);
          generatedCount++;
        }
      }
    }

    // -------------------------------------------------------------
    // RULE 2: PT RENEWAL (4 Days Before PT Expiry)
    // -------------------------------------------------------------
    let ptExpiryDate: string | null = member.ptExpiryDate || member.ptEndDate || null;
    const isPtActive = member.isPt === true || !!member.trainer;

    if (!ptExpiryDate && isPtActive) {
      const memberPtPayments = payments.filter((p: any) => 
        (p.memberId === memberId || p.memberName === memberName) &&
        (p.billingType === 'PT' || p.invoiceType === 'PT' || p.transactionType === 'pt_payment' || p.isPt === true)
      );
      if (memberPtPayments.length > 0) {
        memberPtPayments.sort((a, b) => new Date(b.date || b.paymentDate || 0).getTime() - new Date(a.date || a.paymentDate || 0).getTime());
        ptExpiryDate = memberPtPayments[0].expiryDate || memberPtPayments[0].endDate || null;
      }
    }

    if (ptExpiryDate) {
      const cleanPtExpiry = ptExpiryDate.split('T')[0];
      const daysToPtExpiry = getCalendarDaysDiff(cleanPtExpiry, todayStr);

      if (daysToPtExpiry === 4) {
        const automationKey = `AUTO_PT_RENEWAL_${memberId}_${cleanPtExpiry}`;

        if (existingKeyMap.has(automationKey)) {
          skippedCount++;
        } else {
          const payload = {
            id: automationKey,
            automationKey,
            memberId,
            memberName,
            phone: memberPhone,
            memberPhone,
            type: 'PT RENEWAL',
            reason: 'Personal Training renewal due in 4 days',
            title: 'PT RENEWAL',
            description: 'Personal Training renewal due in 4 days',
            notes: 'Personal Training renewal due in 4 days',
            priority: 'High',
            dueDate: todayStr,
            scheduledDate: todayStr,
            scheduledTime: '10:00',
            scheduledTimestamp: new Date(`${todayStr}T10:00:00+05:30`).getTime() || Date.now(),
            assignedTo: member.trainer || 'Personal Trainer',
            status: 'pending',
            source: 'auto',
            plan: 'Personal Training',
            ptExpiryDate: cleanPtExpiry,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          createdFollowups.push(payload);
          existingKeyMap.set(automationKey, payload);
          generatedKeys.push(automationKey);
          generatedCount++;
        }
      }
    }

    // -------------------------------------------------------------
    // RULE 3: PENDING BALANCE (2 Days Before Payment Due Date)
    // -------------------------------------------------------------
    const rawBalance = Number(member.outstandingBalance ?? member.balance ?? member.balanceAmount ?? 0);
    const calculatedBalance = Math.max(0, (Number(member.totalBilled) || 0) - (Number(member.totalPaid) || 0));
    const pendingBalance = Math.max(rawBalance, member.paymentStatus === 'partial' || member.paymentStatus === 'pending' ? calculatedBalance : 0);

    if (pendingBalance > 0) {
      let paymentDueDate: string | null = member.paymentDueDate || member.balanceDueDate || member.dueDate || null;

      if (!paymentDueDate) {
        const pendingPayment = payments.find((p: any) => 
          (p.memberId === memberId || p.memberName === memberName) &&
          (p.status === 'partial' || p.status === 'pending' || Number(p.outstandingAmount || p.pendingAmount) > 0) &&
          (p.dueDate || p.paymentDueDate)
        );
        if (pendingPayment) {
          paymentDueDate = pendingPayment.dueDate || pendingPayment.paymentDueDate;
        }
      }

      if (!paymentDueDate && member.nextPaymentDate) {
        paymentDueDate = member.nextPaymentDate;
      }

      if (paymentDueDate) {
        const cleanDueDate = paymentDueDate.split('T')[0];
        const daysToDueDate = getCalendarDaysDiff(cleanDueDate, todayStr);

        if (daysToDueDate === 2) {
          const automationKey = `AUTO_BALANCE_${memberId}_${cleanDueDate}`;

          if (existingKeyMap.has(automationKey)) {
            skippedCount++;
          } else {
            const formattedAmount = `₹${pendingBalance.toLocaleString('en-IN')}`;

            const payload = {
              id: automationKey,
              automationKey,
              memberId,
              memberName,
              phone: memberPhone,
              memberPhone,
              type: 'PENDING BALANCE',
              reason: 'Pending membership balance',
              title: 'PENDING BALANCE',
              description: `Member ${memberName} has ${formattedAmount} pending due on ${cleanDueDate}`,
              notes: `${formattedAmount} pending`,
              pendingAmount: pendingBalance,
              priority: 'High',
              dueDate: todayStr,
              scheduledDate: todayStr,
              scheduledTime: '10:00',
              scheduledTimestamp: new Date(`${todayStr}T10:00:00+05:30`).getTime() || Date.now(),
              assignedTo: assignedStaff,
              status: 'pending',
              source: 'auto',
              plan: member.plan || 'Membership',
              paymentDueDate: cleanDueDate,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };

            createdFollowups.push(payload);
            existingKeyMap.set(automationKey, payload);
            generatedKeys.push(automationKey);
            generatedCount++;
          }
        }
      }
    }
  }

  // =============================================================
  // RULE 4: ENQUIRIES EVALUATION (Pending Enquiries Follow-Ups)
  // =============================================================
  for (const enquiry of enquiries) {
    const enqId = enquiry.id;
    const enqStatus = (enquiry.status || '').toLowerCase();
    const followUpDate = enquiry.nextFollowUpDate || enquiry.nextFollowUp || enquiry.followupDate;
    const isNotClosed = enqStatus !== 'converted' && enqStatus !== 'closed' && enqStatus !== 'lost' && enqStatus !== 'cancelled';
    if (enqId && isNotClosed && followUpDate && typeof followUpDate === 'string' && followUpDate.trim() !== '') {
      const cleanEnqDate = followUpDate.split('T')[0];
      const autoKey = `ENQUIRY_FOLLOWUP_${enqId}_${cleanEnqDate}`;

      if (existingKeyMap.has(autoKey)) {
        skippedCount++;
      } else {
        const payload = {
          id: autoKey,
          automationKey: autoKey,
          enquiryId: enqId,
          memberId: null,
          memberName: enquiry.name || 'Enquiry Lead',
          phone: enquiry.phone || enquiry.contact || '',
          type: 'Enquiry',
          title: 'Enquiry Follow-Up',
          reason: 'Enquiry Follow-Up',
          description: `Enquiry callback for ${enquiry.name || 'Client'}${enquiry.duration ? ` (${enquiry.duration})` : ''}`,
          notes: `Enquiry callback for ${enquiry.name || 'Client'}${enquiry.duration ? ` (${enquiry.duration})` : ''}`,
          priority: enquiry.priority === 'Hot' ? 'High' : 'Medium',
          dueDate: cleanEnqDate,
          scheduledDate: cleanEnqDate,
          scheduledTime: enquiry.followUpTime || '11:00',
          scheduledTimestamp: new Date(`${cleanEnqDate}T${enquiry.followUpTime || '11:00'}:00+05:30`).getTime() || Date.now(),
          assignedTo: enquiry.assignedTo || enquiry.attendedBy || 'Veer Chand (manager)',
          status: 'pending',
          source: 'auto',
          plan: enquiry.duration || enquiry.interestedPlan || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        createdFollowups.push(payload);
        existingKeyMap.set(autoKey, payload);
        generatedKeys.push(autoKey);
        generatedCount++;
      }
    }
  }

  // -------------------------------------------------------------
  // SAVE ALL NEW FOLLOW-UPS TO DB / FIRESTORE
  // -------------------------------------------------------------
  for (const fol of createdFollowups) {
    await db.addFollowup(fol);
  }

  return {
    generatedCount,
    skippedCount,
    resolvedCount,
    generatedKeys
  };
}

/**
 * Resolves stale automated follow-ups when a member renews or enquiry is closed.
 */
export async function resolveStaleRenewalFollowups(
  entityId: string,
  renewalType: 'MEMBERSHIP' | 'PT' | 'BALANCE' | 'ENQUIRY_CLOSED' | 'ENQUIRY_DATE_CHANGED',
  newExpiryOrDueDate?: string
): Promise<number> {
  if (!entityId) return 0;

  try {
    const allFollowups = await db.getFollowups();
    const matchedFollowups = allFollowups.filter(f => 
      (f.memberId === entityId || f.enquiryId === entityId || f.id?.includes(entityId)) && 
      (f.source === 'automatic' || !!f.automationKey)
    );

    let resolvedCount = 0;

    for (const fol of matchedFollowups) {
      const currentStatus = (fol.status || '').toLowerCase();
      if (currentStatus !== 'pending' && currentStatus !== 'in progress') continue;

      let shouldResolve = false;
      let resolveReason = '';

      if (renewalType === 'MEMBERSHIP' && (fol.type === 'GYM MEMBERSHIP RENEWAL' || fol.type === 'Renewal')) {
        if (newExpiryOrDueDate && fol.automationKey !== `AUTO_RENEWAL_${entityId}_${newExpiryOrDueDate}`) {
          shouldResolve = true;
          resolveReason = `Auto-resolved: Membership renewed to ${newExpiryOrDueDate}`;
        } else if (!newExpiryOrDueDate) {
          shouldResolve = true;
          resolveReason = 'Auto-resolved: Membership renewed';
        }
      } else if (renewalType === 'PT' && (fol.type === 'PT RENEWAL' || fol.type === 'PT')) {
        if (newExpiryOrDueDate && fol.automationKey !== `AUTO_PT_RENEWAL_${entityId}_${newExpiryOrDueDate}`) {
          shouldResolve = true;
          resolveReason = `Auto-resolved: PT renewed to ${newExpiryOrDueDate}`;
        } else if (!newExpiryOrDueDate) {
          shouldResolve = true;
          resolveReason = 'Auto-resolved: PT package renewed';
        }
      } else if (renewalType === 'BALANCE' && (fol.type === 'PENDING BALANCE' || fol.type === 'Payment')) {
        shouldResolve = true;
        resolveReason = 'Auto-resolved: Outstanding balance cleared';
      } else if (renewalType === 'ENQUIRY_CLOSED' && (fol.type === 'Enquiry' || fol.type === 'ENQUIRY' || fol.enquiryId === entityId)) {
        shouldResolve = true;
        resolveReason = 'Auto-resolved: Enquiry closed';
      } else if (renewalType === 'ENQUIRY_DATE_CHANGED' && (fol.type === 'Enquiry' || fol.type === 'ENQUIRY' || fol.enquiryId === entityId)) {
        if (newExpiryOrDueDate && fol.dueDate !== newExpiryOrDueDate) {
          shouldResolve = true;
          resolveReason = `Auto-resolved: Enquiry follow-up rescheduled to ${newExpiryOrDueDate}`;
        }
      }

      if (shouldResolve) {
        await db.updateFollowup(fol.id, {
          status: 'completed',
          completedAt: new Date().toISOString(),
          remarks: resolveReason,
          outcome: 'Auto-Resolved',
          updatedAt: new Date().toISOString()
        });
        resolvedCount++;
      }
    }

    return resolvedCount;
  } catch (err) {
    console.error('[Automation Engine] Error resolving stale follow-ups:', err);
    return 0;
  }
}
