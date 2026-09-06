import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, doc, updateDoc, setDoc, addDoc, deleteDoc, getDocs } from 'firebase/firestore';
import API from '@/services/api';
import { getTodayInIndia, getCalendarDaysDiff, isTodayInIndia } from '@/lib/dateUtils';

export interface FollowUpHistoryEvent {
  id?: string;
  eventType: 'CREATED' | 'RESCHEDULED' | 'NOTE_ADDED' | 'ASSIGNED' | 'REASSIGNED' | 'COMPLETED' | 'LOST' | 'REOPENED' | string;
  timestamp: string;
  performedBy?: string;
  oldValue?: string;
  newValue?: string;
  note?: string;
  reason?: string;
}

export interface FollowUpItem {
  id: string;
  memberId?: string | null;
  memberName?: string;
  phone?: string;
  enquiryId?: string | null;
  employeeId?: string | null;
  assignedEmployeeId?: string | null;
  assignedEmployeeName?: string;
  assignedTo?: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low' | string;
  type: 'GYM MEMBERSHIP RENEWAL' | 'PT RENEWAL' | 'PENDING BALANCE' | 'Renewal' | 'PT' | 'Payment' | 'Enquiry' | 'General' | 'Diet' | 'Trainer' | 'Attendance' | 'Birthday' | 'Custom' | string;
  status: 'Pending' | 'In Progress' | 'Completed' | 'Missed' | 'Cancelled' | 'Lost' | string;
  createdAt: string;
  createdBy?: string;
  dueDate: string;
  scheduledDate: string;
  scheduledTime: string;
  scheduledTimestamp: number;
  completedAt?: string | null;
  notes?: string;
  description?: string;
  title?: string;
  reason?: string;
  communicationType?: 'call' | 'whatsapp' | 'visit' | 'email';
  source?: 'automatic' | 'manual' | 'enquiry' | 'renewal' | 'system' | 'auto';
  automationKey?: string | null;
  pendingAmount?: number | null;
  plan?: string;
  expiryDate?: string;
  ptExpiryDate?: string;
  paymentDueDate?: string;
  outcome?: string;
  remarks?: string;
  date?: string;
  lastNote?: string;
  history?: FollowUpHistoryEvent[];
}

export const followupService = {
  // Trigger automated generation on backend engine and Firestore client fallback
  generateAutomatedFollowups: async (dateOverride?: string) => {
    const todayStr = dateOverride || getTodayInIndia();

    // 1. Trigger backend API
    try {
      await API.post('/followups/generate-automated', { dateOverride: todayStr });
    } catch (_) {}

    // 2. Direct client-side Firestore scanner (guarantees real-time execution even if backend is sleeping)
    try {
      const [membersSnap, followupsSnap] = await Promise.all([
        getDocs(collection(db, 'members')).catch(() => null),
        getDocs(collection(db, 'followups')).catch(() => null)
      ]);

      if (!membersSnap || membersSnap.empty) return;

      const existingKeySet = new Set<string>();
      if (followupsSnap && !followupsSnap.empty) {
        followupsSnap.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.automationKey) existingKeySet.add(data.automationKey);
          existingKeySet.add(docSnap.id);
        });
      }

      for (const memberDoc of membersSnap.docs) {
        const member = memberDoc.data();
        const memberId = memberDoc.id || member.id || member.memberId;
        if (!memberId) continue;

        const memberName = member.name || 'Member';
        const memberPhone = member.phone || '';
        const memberStatus = (member.status || '').toLowerCase();
        const assignedStaff = member.trainer || member.assignedStaff || 'Receptionist';

        // RULE 1: GYM MEMBERSHIP RENEWAL (7 days before expiry)
        const membershipExpiry = member.expiryDate ? member.expiryDate.split('T')[0] : null;
        if (membershipExpiry && (memberStatus === 'active' || memberStatus === 'upcoming' || memberStatus === 'frozen')) {
          const daysToExpiry = getCalendarDaysDiff(membershipExpiry, todayStr);
          if (daysToExpiry === 7) {
            const key = `AUTO_RENEWAL_${memberId}_${membershipExpiry}`;
            if (!existingKeySet.has(key)) {
              existingKeySet.add(key);
              const payload = {
                id: key,
                automationKey: key,
                memberId,
                memberName,
                phone: memberPhone,
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
                status: 'Pending',
                source: 'auto',
                plan: member.plan || 'Monthly Standard',
                expiryDate: membershipExpiry,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              await setDoc(doc(db, 'followups', key), payload, { merge: true }).catch(() => {});
            }
          }
        }

        // RULE 2: PT RENEWAL (4 days before PT expiry)
        const ptExpiryDate = (member.ptExpiryDate || member.ptEndDate || '').split('T')[0];
        if (ptExpiryDate) {
          const daysToPtExpiry = getCalendarDaysDiff(ptExpiryDate, todayStr);
          if (daysToPtExpiry === 4) {
            const key = `AUTO_PT_RENEWAL_${memberId}_${ptExpiryDate}`;
            if (!existingKeySet.has(key)) {
              existingKeySet.add(key);
              const payload = {
                id: key,
                automationKey: key,
                memberId,
                memberName,
                phone: memberPhone,
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
                status: 'Pending',
                source: 'auto',
                plan: 'Personal Training',
                ptExpiryDate,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              await setDoc(doc(db, 'followups', key), payload, { merge: true }).catch(() => {});
            }
          }
        }

        // RULE 3: PENDING BALANCE (2 days before payment due date)
        const rawBalance = Number(member.outstandingBalance ?? member.balance ?? member.balanceAmount ?? 0);
        const calculatedBalance = Math.max(0, (Number(member.totalBilled) || 0) - (Number(member.totalPaid) || 0));
        const pendingBalance = Math.max(rawBalance, member.paymentStatus === 'partial' || member.paymentStatus === 'pending' ? calculatedBalance : 0);
        const paymentDueDate = (member.paymentDueDate || member.balanceDueDate || member.dueDate || '').split('T')[0];

        if (pendingBalance > 0 && paymentDueDate) {
          const daysToDueDate = getCalendarDaysDiff(paymentDueDate, todayStr);
          if (daysToDueDate === 2) {
            const key = `AUTO_BALANCE_${memberId}_${paymentDueDate}`;
            if (!existingKeySet.has(key)) {
              existingKeySet.add(key);
              const formattedAmt = `₹${pendingBalance.toLocaleString('en-IN')}`;
              const payload = {
                id: key,
                automationKey: key,
                memberId,
                memberName,
                phone: memberPhone,
                type: 'PENDING BALANCE',
                reason: 'Pending membership balance',
                title: 'PENDING BALANCE',
                description: `Member ${memberName} has ${formattedAmt} pending due on ${paymentDueDate}`,
                notes: `${formattedAmt} pending`,
                pendingAmount: pendingBalance,
                priority: 'High',
                dueDate: todayStr,
                scheduledDate: todayStr,
                scheduledTime: '10:00',
                scheduledTimestamp: new Date(`${todayStr}T10:00:00+05:30`).getTime() || Date.now(),
                assignedTo: assignedStaff,
                status: 'Pending',
                source: 'auto',
                plan: member.plan || 'Membership',
                paymentDueDate,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              await setDoc(doc(db, 'followups', key), payload, { merge: true }).catch(() => {});
            }
          }
        }
      }

      // RULE 4: PENDING ENQUIRIES EVALUATION
      const enqSnap = await getDocs(collection(db, 'enquiries')).catch(() => null);
      if (enqSnap && !enqSnap.empty) {
        for (const docSnap of enqSnap.docs) {
          const enq = docSnap.data();
          const enqId = docSnap.id;
          const enqStatus = (enq.status || '').toLowerCase();
          const followUpDate = (enq.nextFollowUpDate || enq.nextFollowUp || enq.followupDate || '').split('T')[0];
          const isNotClosed = enqStatus !== 'converted' && enqStatus !== 'closed' && enqStatus !== 'lost' && enqStatus !== 'cancelled';
          if (isNotClosed && followUpDate) {
            const key = `ENQUIRY_FOLLOWUP_${enqId}_${followUpDate}`;
            if (!existingKeySet.has(key)) {
              existingKeySet.add(key);
              const payload = {
                id: key,
                automationKey: key,
                enquiryId: enqId,
                memberId: null,
                memberName: enq.name || 'Enquiry Lead',
                phone: enq.phone || enq.contact || '',
                type: 'Enquiry',
                title: `Enquiry Follow-Up: ${enq.name || 'Client'}`,
                reason: 'Enquiry callback',
                description: `Enquiry callback for ${enq.name || 'Client'}${enq.duration ? ` (${enq.duration})` : ''}`,
                notes: enq.remarks || `Enquiry callback for ${enq.name || 'Client'}`,
                priority: enq.priority === 'Hot' ? 'High' : 'Medium',
                dueDate: followUpDate,
                scheduledDate: followUpDate,
                scheduledTime: enq.followUpTime || '11:00',
                scheduledTimestamp: new Date(`${followUpDate}T${enq.followUpTime || '11:00'}:00+05:30`).getTime() || Date.now(),
                assignedTo: enq.assignedTo || enq.attendedBy || 'Manager',
                status: 'Pending',
                source: 'auto',
                plan: enq.duration || enq.interestedPlan || '',
                createdAt: enq.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
              await setDoc(doc(db, 'followups', key), payload, { merge: true }).catch(() => {});
            }
          }
        }
      }
    } catch (err) {
      console.warn('[followupService] Direct Firestore check warning:', err);
    }
  },

  // Real-time listener for followups with API fallback
  subscribe: (onData: (items: FollowUpItem[]) => void, onError?: (err: Error) => void) => {
    let firestoreLoaded = false;
    const todayStr = getTodayInIndia();

    // Initial fetch via API to avoid empty state latency
    API.get('/followups')
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0 && !firestoreLoaded) {
          const list = res.data.map(d => ({
            ...d,
            status: d.status ? (d.status.charAt(0).toUpperCase() + d.status.slice(1)) : 'Pending',
            dueDate: d.dueDate || d.scheduledDate || todayStr,
            scheduledDate: d.scheduledDate || d.dueDate || todayStr,
            scheduledTime: d.scheduledTime || '10:00',
            scheduledTimestamp: d.scheduledTimestamp || Date.now()
          }));
          list.sort((a: any, b: any) => a.scheduledTimestamp - b.scheduledTimestamp);
          onData(list);
        }
      })
      .catch(() => {});

    const q = query(collection(db, 'followups'));
    return onSnapshot(
      q,
      (snapshot) => {
        firestoreLoaded = true;
        const itemMap = new Map<string, FollowUpItem>();

        snapshot.docs.forEach((docSnap) => {
          const d = docSnap.data();
          const scheduledDate = d.dueDate || d.scheduledDate || d.date || d.createdAt?.split('T')[0] || todayStr;
          const scheduledTime = d.scheduledTime || '10:00';
          const scheduledTimestamp = d.scheduledTimestamp || (scheduledDate ? new Date(`${scheduledDate}T${scheduledTime}`).getTime() : Date.now());

          const normStatus = (d.status || 'Pending').toLowerCase();
          const status = normStatus === 'completed' 
            ? 'Completed' 
            : normStatus === 'cancelled' 
            ? 'Cancelled' 
            : normStatus === 'in progress' 
            ? 'In Progress' 
            : normStatus === 'missed' 
            ? 'Missed' 
            : 'Pending';

          let itemType = d.type || 'General';
          if (itemType === 'Renewal') itemType = 'GYM MEMBERSHIP RENEWAL';
          else if (itemType === 'PT') itemType = 'PT RENEWAL';
          else if (itemType === 'Payment') itemType = 'PENDING BALANCE';

          const item: FollowUpItem = {
            id: docSnap.id,
            memberId: d.memberId || null,
            memberName: d.memberName || d.name || 'Member',
            phone: d.phone || d.memberPhone || d.clientPhone || '',
            enquiryId: d.enquiryId || null,
            employeeId: d.employeeId || null,
            assignedEmployeeId: d.assignedEmployeeId || d.employeeId || null,
            assignedEmployeeName: d.assignedEmployeeName || d.assignedTo || 'Receptionist',
            assignedTo: d.assignedTo || 'Receptionist',
            priority: d.priority || 'Medium',
            type: itemType,
            status,
            createdAt: d.createdAt || new Date().toISOString(),
            createdBy: d.createdBy || 'System',
            dueDate: d.dueDate || scheduledDate,
            scheduledDate,
            scheduledTime,
            scheduledTimestamp,
            date: scheduledDate,
            completedAt: d.completedAt || null,
            notes: d.notes || d.description || d.reason || '',
            description: d.description || d.notes || d.reason || '',
            reason: d.reason || d.title || d.notes || '',
            title: d.title || d.reason || d.notes || 'Follow-up Task',
            communicationType: d.communicationType || 'call',
            source: d.source || (d.automationKey ? 'automatic' : 'manual'),
            automationKey: d.automationKey || null,
            pendingAmount: d.pendingAmount !== undefined ? d.pendingAmount : null,
            plan: d.plan || '',
            expiryDate: d.expiryDate || '',
            ptExpiryDate: d.ptExpiryDate || '',
            paymentDueDate: d.paymentDueDate || '',
            outcome: d.outcome || '',
            remarks: d.remarks || '',
            lastNote: d.lastNote || d.remarks || d.notes || d.description || '',
            history: Array.isArray(d.history) ? d.history : []
          };

          itemMap.set(docSnap.id, item);
        });

        const list = Array.from(itemMap.values());

        // Deduplicate any existing duplicate documents in database (same automationKey or signature)
        const uniqueList: FollowUpItem[] = [];
        const seenSigMap = new Map<string, FollowUpItem>();

        for (const item of list) {
          const sigKey = item.automationKey 
            ? item.automationKey 
            : `${item.memberId || item.memberName}_${item.dueDate}_${item.scheduledTime}_${item.title || item.notes}_${item.status}`;
          
          const existing = seenSigMap.get(sigKey);

          if (existing) {
            const timeA = new Date(item.createdAt || 0).getTime();
            const timeB = new Date(existing.createdAt || 0).getTime();
            if (Math.abs(timeA - timeB) < 120_000 || !item.createdAt || !existing.createdAt) {
              continue;
            }
          }

          seenSigMap.set(sigKey, item);
          uniqueList.push(item);
        }

        uniqueList.sort((a, b) => a.scheduledTimestamp - b.scheduledTimestamp);
        onData(uniqueList);
      },
      (err) => {
        console.warn('[followupService] Snapshot warning:', err.message);
        if (onError) onError(err);
      }
    );
  },

  // Create follow-up via Express Backend API & Firestore
  create: async (data: Partial<FollowUpItem>): Promise<FollowUpItem> => {
    const todayStr = getTodayInIndia();
    const scheduledDate = data.dueDate || data.scheduledDate || todayStr;
    const scheduledTime = data.scheduledTime || '10:00';
    const scheduledTimestamp = data.scheduledTimestamp || new Date(`${scheduledDate}T${scheduledTime}`).getTime() || Date.now();

    const createdId = data.id || (data.automationKey ? data.automationKey : `fol_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

    const payload = {
      memberId: data.memberId || null,
      memberName: data.memberName || data.title?.replace('Renewal:', '').trim() || '',
      phone: data.phone || '',
      enquiryId: data.enquiryId || null,
      employeeId: data.employeeId || null,
      assignedEmployeeId: data.assignedEmployeeId || null,
      assignedEmployeeName: data.assignedEmployeeName || data.assignedTo || 'Receptionist',
      assignedTo: data.assignedTo || 'Receptionist',
      priority: data.priority || 'Medium',
      type: data.type || 'General',
      status: 'Pending',
      createdAt: new Date().toISOString(),
      createdBy: data.createdBy || 'Receptionist',
      dueDate: data.dueDate || scheduledDate,
      scheduledDate,
      scheduledTime,
      scheduledTimestamp,
      title: data.title || `Follow-up: ${data.memberName || 'Client'}`,
      reason: data.reason || data.title || '',
      description: data.description || data.notes || '',
      notes: data.notes || data.description || '',
      communicationType: data.communicationType || 'call',
      source: data.source || (data.automationKey ? 'auto' : 'manual'),
      automationKey: data.automationKey || null,
      pendingAmount: data.pendingAmount !== undefined ? data.pendingAmount : null,
      plan: data.plan || ''
    };

    try {
      await setDoc(doc(db, 'followups', createdId), payload);
    } catch (err: any) {
      console.warn('[followupService] Direct Firestore setDoc warning:', err);
    }

    try {
      await API.post('/followups', { ...payload, id: createdId });
    } catch (_) {}

    return { id: createdId, ...payload } as FollowUpItem;
  },

  // Reschedule existing follow-up task (updates SAME document and appends to history)
  reschedule: async (
    task: FollowUpItem,
    newDate: string,
    newTime: string,
    reason?: string,
    note?: string,
    performedBy?: string
  ): Promise<void> => {
    const now = new Date().toISOString();
    const cleanDate = newDate.split('T')[0];
    const cleanTime = newTime || '10:00';
    const scheduledTimestamp = new Date(`${cleanDate}T${cleanTime}:00+05:30`).getTime() || Date.now();

    const oldDateStr = `${task.scheduledDate || task.dueDate} · ${task.scheduledTime || '10:00'}`;
    const newDateStr = `${cleanDate} · ${cleanTime}`;

    const newHistoryEvent: FollowUpHistoryEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      eventType: 'RESCHEDULED',
      timestamp: now,
      performedBy: performedBy || 'Staff',
      oldValue: oldDateStr,
      newValue: newDateStr,
      reason: reason || 'Rescheduled callback',
      note: note || ''
    };

    const existingHistory = Array.isArray(task.history) ? [...task.history] : [];
    // If no initial CREATED event exists, prepend synthetic created event
    if (existingHistory.length === 0) {
      existingHistory.push({
        id: `evt_init_${task.id}`,
        eventType: 'CREATED',
        timestamp: task.createdAt || now,
        performedBy: task.createdBy || (task.source === 'auto' || task.source === 'automatic' ? 'System Engine' : 'Staff'),
        note: task.notes || task.description || task.reason || 'Follow-up created'
      });
    }
    existingHistory.push(newHistoryEvent);

    const updates: any = {
      dueDate: cleanDate,
      scheduledDate: cleanDate,
      scheduledTime: cleanTime,
      scheduledTimestamp,
      date: cleanDate,
      status: 'Pending',
      updatedAt: now,
      history: existingHistory
    };

    if (note && note.trim()) {
      updates.lastNote = note.trim();
    } else if (reason && reason.trim()) {
      updates.lastNote = reason.trim();
    }

    try {
      await updateDoc(doc(db, 'followups', task.id), updates);
    } catch (_) {
      try {
        await API.put(`/followups/${task.id}`, updates);
      } catch (_) {}
    }
  },

  // Add conversation note to follow-up task
  addNote: async (
    task: FollowUpItem,
    noteText: string,
    nextDate?: string,
    nextTime?: string,
    performedBy?: string
  ): Promise<void> => {
    const now = new Date().toISOString();
    const newHistoryEvent: FollowUpHistoryEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      eventType: 'NOTE_ADDED',
      timestamp: now,
      performedBy: performedBy || 'Staff',
      note: noteText.trim()
    };

    const existingHistory = Array.isArray(task.history) ? [...task.history] : [];
    if (existingHistory.length === 0) {
      existingHistory.push({
        id: `evt_init_${task.id}`,
        eventType: 'CREATED',
        timestamp: task.createdAt || now,
        performedBy: task.createdBy || 'Staff',
        note: task.notes || task.description || task.reason || 'Follow-up created'
      });
    }
    existingHistory.push(newHistoryEvent);

    const updates: any = {
      lastNote: noteText.trim(),
      updatedAt: now,
      history: existingHistory
    };

    if (nextDate) {
      const cleanDate = nextDate.split('T')[0];
      const cleanTime = nextTime || task.scheduledTime || '10:00';
      updates.dueDate = cleanDate;
      updates.scheduledDate = cleanDate;
      updates.scheduledTime = cleanTime;
      updates.scheduledTimestamp = new Date(`${cleanDate}T${cleanTime}:00+05:30`).getTime() || Date.now();
      updates.date = cleanDate;
    }

    try {
      await updateDoc(doc(db, 'followups', task.id), updates);
    } catch (_) {
      try {
        await API.put(`/followups/${task.id}`, updates);
      } catch (_) {}
    }
  },

  // Mark task as Lost
  markLost: async (
    task: FollowUpItem,
    reason: string,
    performedBy?: string
  ): Promise<void> => {
    const now = new Date().toISOString();
    const newHistoryEvent: FollowUpHistoryEvent = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      eventType: 'LOST',
      timestamp: now,
      performedBy: performedBy || 'Staff',
      reason: reason.trim()
    };

    const existingHistory = Array.isArray(task.history) ? [...task.history] : [];
    existingHistory.push(newHistoryEvent);

    const updates: any = {
      status: 'Lost',
      completedAt: now,
      remarks: reason.trim(),
      outcome: 'Lost',
      lastNote: `Marked Lost: ${reason.trim()}`,
      updatedAt: now,
      history: existingHistory
    };

    try {
      await updateDoc(doc(db, 'followups', task.id), updates);
    } catch (_) {
      try {
        await API.put(`/followups/${task.id}`, updates);
      } catch (_) {}
    }
  },

  // Update follow-up status to Completed & log history event & communication record
  complete: async (
    id: string,
    remarks: string,
    outcome: string,
    memberId?: string | null,
    enquiryId?: string | null,
    taskObj?: FollowUpItem,
    performedBy?: string
  ): Promise<void> => {
    const now = new Date().toISOString();
    const existingHistory = taskObj && Array.isArray(taskObj.history) ? [...taskObj.history] : [];
    
    existingHistory.push({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      eventType: 'COMPLETED',
      timestamp: now,
      performedBy: performedBy || 'Staff',
      note: remarks || '',
      reason: outcome || 'Completed'
    });

    const updates = {
      status: 'Completed',
      completedAt: now,
      remarks,
      outcome,
      lastNote: remarks ? `Completed: ${remarks}` : (outcome || 'Completed'),
      updatedAt: now,
      history: existingHistory
    };

    try {
      await updateDoc(doc(db, 'followups', id), updates);
    } catch (_) {
      try {
        await API.put(`/followups/${id}`, updates);
      } catch (_) {}
    }

    if (memberId || enquiryId) {
      try {
        await addDoc(collection(db, 'communications'), {
          memberId: memberId || null,
          enquiryId: enquiryId || null,
          type: 'Follow-up',
          content: remarks || 'Completed follow-up task',
          outcome: outcome || 'Connected',
          timestamp: new Date().toISOString(),
          author: performedBy || 'Receptionist Desk'
        });
      } catch (_) {}
    }
  },

  // Snooze task by 1 hour
  snooze: async (task: FollowUpItem): Promise<{ nextHourStr: string }> => {
    const nextHour = new Date(Date.now() + 60 * 60 * 1000);
    const nextHourStr = nextHour.toLocaleTimeString('en-US', { hour12: false }).substring(0, 5);
    const now = new Date().toISOString();

    const existingHistory = Array.isArray(task.history) ? [...task.history] : [];
    existingHistory.push({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      eventType: 'RESCHEDULED',
      timestamp: now,
      performedBy: 'Staff',
      oldValue: `${task.scheduledTime}`,
      newValue: nextHourStr,
      reason: 'Snoozed by 1 hour'
    });

    const updates = {
      scheduledTime: nextHourStr,
      scheduledTimestamp: nextHour.getTime(),
      updatedAt: now,
      history: existingHistory
    };

    try {
      await updateDoc(doc(db, 'followups', task.id), updates);
    } catch (_) {
      try {
        await API.put(`/followups/${task.id}`, updates);
      } catch (_) {}
    }

    return { nextHourStr };
  },

  // Cancel task
  cancel: async (id: string, performedBy?: string): Promise<void> => {
    const now = new Date().toISOString();
    const updates = { status: 'Cancelled', completedAt: now, updatedAt: now };

    try {
      await updateDoc(doc(db, 'followups', id), updates);
    } catch (_) {
      try {
        await API.put(`/followups/${id}`, updates);
      } catch (_) {}
    }
  },

  // Delete task
  remove: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'followups', id));
    } catch (_) {
      try {
        await API.delete(`/followups/${id}`);
      } catch (_) {}
    }
  }
};
