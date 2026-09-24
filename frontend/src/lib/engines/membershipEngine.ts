// No top-level firebase import here — avoids circular dependency with utils.ts
// Firebase is used only inside selfHealMemberData() via lazy import

const IST_TIME_ZONE = 'Asia/Kolkata';
const DAY_MS = 24 * 60 * 60 * 1000;

const getISTDateString = (date: Date = new Date()): string => {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const parseMembershipDay = (value: string | Date | null | undefined): Date | null => {
  if (!value) return null;
  if (typeof value === 'string') {
    const dateOnly = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (dateOnly) {
      const [, year, month, day] = dateOnly;
      const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
      if (parsed.toISOString().slice(0, 10) !== value.trim()) return null;
      return parsed;
    }
  }

  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  const [year, month, day] = getISTDateString(instant).split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatMembershipDay = (date: Date): string => date.toISOString().slice(0, 10);

export const membershipEngine = {
  calculateDaysLeft: (expiryDate: string | null | undefined): number => {
    if (!expiryDate || expiryDate === 'N/A' || expiryDate === '—') return 0;
    const expiryDay = parseMembershipDay(expiryDate);
    const todayDay = parseMembershipDay(getISTDateString());
    if (!expiryDay || !todayDay) return 0;
    return Math.round((expiryDay.getTime() - todayDay.getTime()) / DAY_MS);
  },

  calculateDurationDays: (expiryDate: string | null | undefined, startDate?: string | null | undefined): number => {
    if (!expiryDate || expiryDate === 'N/A' || expiryDate === '—') return 30;
    const expiryDay = parseMembershipDay(expiryDate);
    if (!expiryDay) return 30;
    const startDay = startDate && startDate !== 'N/A' && startDate !== '—'
      ? parseMembershipDay(startDate) || parseMembershipDay(getISTDateString())
      : parseMembershipDay(getISTDateString());
    if (!startDay) return 30;
    return Math.max(0, Math.round((expiryDay.getTime() - startDay.getTime()) / DAY_MS));
  },

  calculateDaysUntilStart: (startDate: string | null | undefined): number => {
    if (!startDate || startDate === 'N/A' || startDate === '—') return 0;
    const startDay = parseMembershipDay(startDate);
    const todayDay = parseMembershipDay(getISTDateString());
    if (!startDay || !todayDay) return 0;
    return Math.round((startDay.getTime() - todayDay.getTime()) / DAY_MS);
  },

  calculateMembershipStatus: (daysLeftOrExpiry: number | string | null | undefined, startDateOrManual?: string | null, manualStatus?: string): string => {
    const statusVal = (typeof startDateOrManual === 'string' && ['Blocked', 'Frozen', 'Hold', 'Inactive', 'active', 'expired', 'frozen', 'blocked', 'hold', 'inactive', 'upcoming'].includes(startDateOrManual))
      ? startDateOrManual 
      : manualStatus;

    const cleanStatus = String(statusVal || '').trim().toLowerCase();
    if (cleanStatus === 'blocked') return 'Blocked';
    if (cleanStatus === 'frozen') return 'Frozen';
    if (cleanStatus === 'hold') return 'Hold';
    if (cleanStatus === 'inactive') return 'Inactive';

    const todayStr = getISTDateString();
    let startStr = '';

    if (typeof startDateOrManual === 'string' && startDateOrManual.match(/^\d{4}-\d{2}-\d{2}/)) {
      startStr = startDateOrManual.split('T')[0];
    }

    if (startStr && startStr > todayStr) {
      return 'Upcoming';
    }

    let daysLeft = 0;
    if (typeof daysLeftOrExpiry === 'number') {
      daysLeft = daysLeftOrExpiry;
    } else {
      daysLeft = membershipEngine.calculateDaysLeft(daysLeftOrExpiry);
    }

    if (daysLeft <= 0) return 'Expired';
    if (daysLeft <= 15) return 'Expiring Soon';
    return 'Active';
  },

  calculateAccessStatus: (startDateStr?: string | null, expiryDateStr?: string | null, manualStatus?: string): { granted: boolean; status: string; reason: string; daysUntilStart: number } => {
    if (manualStatus === 'Blocked' || manualStatus === 'blocked') {
      return { granted: false, status: 'Blocked', reason: 'Member account is blocked', daysUntilStart: 0 };
    }
    if (manualStatus === 'Frozen' || manualStatus === 'frozen') {
      return { granted: false, status: 'Frozen', reason: 'Membership is currently frozen', daysUntilStart: 0 };
    }
    if (manualStatus === 'Hold' || manualStatus === 'hold') {
      return { granted: false, status: 'Hold', reason: 'Member is on HOLD awaiting billing and activation', daysUntilStart: 0 };
    }
    if (manualStatus === 'Inactive' || manualStatus === 'inactive') {
      return { granted: false, status: 'Inactive', reason: 'Member account is inactive', daysUntilStart: 0 };
    }

    const todayStr = getISTDateString();
    const startStr = startDateStr ? startDateStr.split('T')[0] : todayStr;
    const expiryStr = expiryDateStr ? expiryDateStr.split('T')[0] : '';

    if (startStr > todayStr) {
      const daysUntilStart = membershipEngine.calculateDaysUntilStart(startStr);
      return { 
        granted: false, 
        status: 'Upcoming', 
        reason: `Membership starts on ${startStr} (Starts in ${daysUntilStart} ${daysUntilStart === 1 ? 'day' : 'days'})`,
        daysUntilStart
      };
    }

    if (expiryStr && expiryStr < todayStr) {
      return { granted: false, status: 'Expired', reason: 'Membership has expired', daysUntilStart: 0 };
    }

    return { granted: true, status: 'Active', reason: 'Access Granted', daysUntilStart: 0 };
  },

  calculateRenewalRisk: (daysLeft: number): 'Critical' | 'High' | 'Medium' | 'Low' => {
    if (daysLeft <= 3) return 'Critical';
    if (daysLeft <= 7) return 'High';
    if (daysLeft <= 15) return 'Medium';
    return 'Low';
  },

  calculateHealthScore: (daysLeft: number, attendancePercentage: number): number => {
    let score = 0;
    if (daysLeft < 0) score += 35;
    else if (daysLeft <= 7) score += 40;
    else if (daysLeft <= 15) score += 25;
    else if (daysLeft <= 30) score += 15;
    
    if (attendancePercentage < 20) score += 40;
    else if (attendancePercentage < 40) score += 25;
    else if (attendancePercentage < 60) score += 10;
    
    return Math.min(100, score);
  },

  calculateMembershipExpiry: (startDateInput: string | Date | null | undefined, packageDuration: string | number): string => {
    const start = parseMembershipDay(startDateInput) || parseMembershipDay(getISTDateString());
    if (!start) return getISTDateString();

    let months = 0;
    let days = 0;

    if (typeof packageDuration === 'number') {
      months = packageDuration;
    } else {
      const p = String(packageDuration || '').trim().toLowerCase();
      const monthMatch = p.match(/(\d+)\s*(?:month|months|m)\b/i);
      const yearMatch = p.match(/(\d+)\s*(?:year|years|y)\b/i);
      const dayMatch = p.match(/(\d+)\s*(?:day|days|d)\b/i);

      if (monthMatch) {
        months = parseInt(monthMatch[1], 10);
      } else if (yearMatch) {
        months = parseInt(yearMatch[1], 10) * 12;
      } else if (dayMatch) {
        days = parseInt(dayMatch[1], 10);
      } else if (p.includes('quarterly') || p.includes('3 month')) {
        months = 3;
      } else if (p.includes('semi') || p.includes('6 month') || p.includes('half year')) {
        months = 6;
      } else if (p.includes('annual') || p.includes('12 month') || p.includes('1 year') || p.includes('yearly')) {
        months = 12;
      } else if (p.includes('1 month') || p.includes('monthly') || p.includes('standard')) {
        months = 1;
      } else {
        months = 1;
      }
    }

    let result = new Date(start.getTime());
    if (months > 0) {
      const startYear = start.getUTCFullYear();
      const startMonth = start.getUTCMonth();
      const startDay = start.getUTCDate();
      const targetMonthStart = new Date(Date.UTC(startYear, startMonth + months, 1));
      const targetYear = targetMonthStart.getUTCFullYear();
      const targetMonth = targetMonthStart.getUTCMonth();
      const targetLastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
      // Keep the same day where possible; clamp month-end dates before applying
      // the inclusive expiry rule (Jan 31 + one month ends on Feb 27/28).
      result = new Date(Date.UTC(targetYear, targetMonth, Math.min(startDay, targetLastDay) - 1));
    } else if (days > 0) {
      result = new Date(result.getTime() + (days - 1) * DAY_MS);
    }

    return formatMembershipDay(result);
  },

  calculateAutoStartDate: (member: any): string => {
    const todayStr = getISTDateString();
    if (!member || !member.expiryDate) return todayStr;

    const eDay = parseMembershipDay(member.expiryDate);
    const tDay = parseMembershipDay(todayStr);
    if (!eDay || !tDay) return todayStr;

    // If active member (expiry >= today), next membership start date is existing expiryDate + 1 day
    if (eDay.getTime() >= tDay.getTime()) {
      return formatMembershipDay(new Date(eDay.getTime() + DAY_MS));
    }

    return todayStr;
  },

  calculatePlanExpiryDate: (planOrObject: any, startDateVal?: any, plansList: any[] = []): string => {
    const planName = typeof planOrObject === 'string' ? planOrObject : (planOrObject?.name || planOrObject?.plan || '');
    return membershipEngine.calculateMembershipExpiry(startDateVal, planName);
  },

  rebuildMemberMembershipTimeline: (member: any, remainingBills: any[]) => {
    const initialJoinDate = member?.joinDate || member?.createdAt?.split('T')[0] || new Date().toISOString().split('T')[0];

    if (!remainingBills || remainingBills.length === 0) {
      const todayStr = new Date().toISOString().split('T')[0];
      const expDate = member?.joinDate || todayStr;
      const days = membershipEngine.calculateDaysLeft(expDate);
      const status = days > 0 ? 'active' : 'expired';

      return {
        recalculatedHistory: [],
        startDate: initialJoinDate,
        expiryDate: expDate,
        plan: 'Standard',
        daysLeft: days,
        status: status,
        totalBilled: 0,
        totalPaid: 0,
        outstandingBalance: 0,
      };
    }

    // Sort remaining bills chronologically by startDate or date
    const sortedBills = [...remainingBills].sort((a, b) => {
      const dateA = new Date(a.startDate || a.date || a.createdAt || 0).getTime();
      const dateB = new Date(b.startDate || b.date || b.createdAt || 0).getTime();
      return dateA - dateB;
    });

    const recalculatedHistory: any[] = [];
    let currentExpiry = '';
    let overallStartDate = '';
    let latestPlan = '';
    let runningBilled = 0;
    let runningPaid = 0;

    sortedBills.forEach((bill: any, index: number) => {
      const planName = bill.plan || bill.package || member?.plan || '3 Months (Quarterly)';
      let itemStart = bill.startDate || bill.date || initialJoinDate;

      // If contiguous extension of previous item, extend from previous expiry date + 1 day
      if (index > 0 && currentExpiry) {
        const prevExp = new Date(currentExpiry);
        const originalStart = new Date(itemStart);
        const dayDiff = (originalStart.getTime() - prevExp.getTime()) / (1000 * 3600 * 24);
        if (dayDiff <= 2 && dayDiff >= -30) {
          const nextStart = new Date(prevExp);
          nextStart.setDate(nextStart.getDate() + 1);
          const y = nextStart.getFullYear();
          const m = String(nextStart.getMonth() + 1).padStart(2, '0');
          const d = String(nextStart.getDate()).padStart(2, '0');
          itemStart = `${y}-${m}-${d}`;
        }
      }

      if (index === 0) {
        overallStartDate = itemStart;
      }

      const itemExpiry = membershipEngine.calculateMembershipExpiry(itemStart, planName);
      currentExpiry = itemExpiry;
      latestPlan = planName;

      const netPay = Number(bill.netPayable !== undefined ? bill.netPayable : (bill.amount || 0));
      const paidAmt = Number(bill.amountPaid !== undefined ? bill.amountPaid : (bill.paid !== undefined ? bill.paid : netPay));

      runningBilled += isNaN(netPay) ? 0 : netPay;
      runningPaid += isNaN(paidAmt) ? 0 : paidAmt;

      recalculatedHistory.push({
        id: bill.id || `hist_${index}`,
        invoiceId: bill.invoiceNumber || bill.invoice || bill.id || `INV-${index}`,
        plan: planName,
        startDate: itemStart,
        expiryDate: itemExpiry,
        amount: netPay,
        amountPaid: paidAmt,
        createdAt: bill.createdAt || new Date().toISOString(),
      });
    });

    const today = new Date().toISOString().split('T')[0];
    const finalDaysLeft = membershipEngine.calculateDaysLeft(currentExpiry);
    const finalStatus = finalDaysLeft > 0 || currentExpiry >= today ? 'active' : 'expired';
    const outstanding = Math.max(0, runningBilled - runningPaid);

    return {
      recalculatedHistory,
      startDate: overallStartDate || initialJoinDate,
      expiryDate: currentExpiry,
      plan: latestPlan,
      daysLeft: finalDaysLeft,
      status: finalStatus,
      totalBilled: runningBilled,
      totalPaid: runningPaid,
      outstandingBalance: outstanding,
    };
  },

  selfHealMemberData: async (member: any) => {
    if (!member || !member.id) return member;
    if (String(member.status || '').trim().toUpperCase() === 'HOLD') {
      return member;
    }
    
    let needsUpdate = false;
    const updates: any = {};

    // Check if expiryDate is missing or same as joinDate for a plan that has non-zero duration
    if (member.plan && (!member.expiryDate || member.expiryDate === member.joinDate)) {
      const join = member.joinDate || member.createdAt || new Date().toISOString().split('T')[0];
      const correctExpiry = membershipEngine.calculatePlanExpiryDate(member.plan, join);
      if (correctExpiry !== member.expiryDate) {
        updates.expiryDate = correctExpiry;
        needsUpdate = true;
      }
    }

    const effectiveExpiry = updates.expiryDate || member.expiryDate;
    const computedDaysLeft = membershipEngine.calculateDaysLeft(effectiveExpiry);
    const computedStatus = membershipEngine.calculateMembershipStatus(effectiveExpiry, member.startDate || member.joinDate, member.status);

    if (!member.ai || member.ai.daysLeft !== computedDaysLeft) {
      if (!updates.ai) updates.ai = { ...(member.ai || {}) };
      updates.ai.daysLeft = computedDaysLeft;
      needsUpdate = true;
    }

    if (member.status !== computedStatus && member.status !== 'Blocked' && member.status !== 'Frozen') {
      updates.status = computedStatus;
      needsUpdate = true;
    }

    if (needsUpdate) {
      try {
        // Dynamic imports to avoid circular dependency with utils.ts
        const { db } = await import('@/lib/firebase');
        const { updateDoc, doc } = await import('firebase/firestore');
        await updateDoc(doc(db, 'members', member.id), updates);
        console.log(`[Self-Heal] Repaired membership data for ${member.id}`, updates);
        return { ...member, ...updates };
      } catch(e: any) {
        if (e?.code !== 'permission-denied' && !e?.message?.includes('permissions')) {
          console.warn('[Self-Heal] Firestore update notice:', e?.message || e);
        }
        return { ...member, ...updates };
      }
    }
    
    return member;
  }
};
