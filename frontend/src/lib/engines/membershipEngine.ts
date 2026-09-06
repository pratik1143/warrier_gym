// No top-level firebase import here — avoids circular dependency with utils.ts
// Firebase is used only inside selfHealMemberData() via lazy import

export const membershipEngine = {
  calculateDaysLeft: (expiryDate: string | null | undefined): number => {
    if (!expiryDate || expiryDate === 'N/A' || expiryDate === '—') return 999;
    const expiry = new Date(expiryDate);
    if (isNaN(expiry.getTime())) return 999;

    const today = new Date();
    
    const eDay = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
    const tDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffTime = eDay.getTime() - tDay.getTime();
    
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  calculateDurationDays: (expiryDate: string | null | undefined, startDate?: string | null | undefined): number => {
    if (!expiryDate || expiryDate === 'N/A' || expiryDate === '—') return 30;
    const expiry = new Date(expiryDate);
    if (isNaN(expiry.getTime())) return 30;

    let start: Date;
    if (startDate && startDate !== 'N/A' && startDate !== '—') {
      start = new Date(startDate);
      if (isNaN(start.getTime())) start = new Date();
    } else {
      start = new Date();
    }

    const eDay = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
    const sDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const diffTime = eDay.getTime() - sDay.getTime();
    
    return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  },

  calculateDaysUntilStart: (startDate: string | null | undefined): number => {
    if (!startDate || startDate === 'N/A' || startDate === '—') return 0;
    const start = new Date(startDate);
    if (isNaN(start.getTime())) return 0;

    const today = new Date();
    const sDay = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const tDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const diffTime = sDay.getTime() - tDay.getTime();
    
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },

  calculateMembershipStatus: (daysLeftOrExpiry: number | string | null | undefined, startDateOrManual?: string | null, manualStatus?: string): string => {
    const statusVal = (typeof startDateOrManual === 'string' && ['Blocked', 'Frozen', 'active', 'expired', 'frozen', 'blocked', 'upcoming'].includes(startDateOrManual))
      ? startDateOrManual 
      : manualStatus;

    if (statusVal === 'Blocked' || statusVal === 'blocked') return 'Blocked';
    if (statusVal === 'Frozen' || statusVal === 'frozen') return 'Frozen';

    const todayStr = new Date().toISOString().split('T')[0];
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

    const todayStr = new Date().toISOString().split('T')[0];
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
    if (!startDateInput) return new Date().toISOString().split('T')[0];
    let start: Date;
    if (typeof startDateInput === 'string') {
      start = new Date(startDateInput);
    } else if (startDateInput instanceof Date) {
      start = startDateInput;
    } else {
      start = new Date(startDateInput);
    }
    if (isNaN(start.getTime())) return new Date().toISOString().split('T')[0];

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

    const result = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    if (months > 0) {
      const targetMonth = result.getMonth() + months;
      result.setMonth(targetMonth);
      
      // Handle month end overflow e.g. Jan 31 -> Feb 28
      if (result.getDate() !== start.getDate()) {
        result.setDate(0);
      }
      // Subtract 1 day for inclusive subscription period (e.g. 21-11 to 20-05)
      result.setDate(result.getDate() - 1);
    } else if (days > 0) {
      result.setDate(result.getDate() + days - 1);
    }

    const year = result.getFullYear();
    const month = String(result.getMonth() + 1).padStart(2, '0');
    const day = String(result.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  },

  calculateAutoStartDate: (member: any): string => {
    const todayStr = new Date().toISOString().split('T')[0];
    if (!member || !member.expiryDate) return todayStr;

    const expiry = new Date(member.expiryDate);
    if (isNaN(expiry.getTime())) return todayStr;

    const today = new Date();
    const eDay = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
    const tDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // If active member (expiry >= today), next membership start date is existing expiryDate + 1 day
    if (eDay.getTime() >= tDay.getTime()) {
      const nextStart = new Date(eDay);
      nextStart.setDate(nextStart.getDate() + 1);
      const year = nextStart.getFullYear();
      const month = String(nextStart.getMonth() + 1).padStart(2, '0');
      const day = String(nextStart.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
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
