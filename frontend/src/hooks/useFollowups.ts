"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { followupService, FollowUpItem } from '@/services/followup.service';
import { getTodayInIndia, isTodayInIndia, isOverdueInIndia, isUpcomingInIndia } from '@/lib/dateUtils';

let autoGenerationTriggeredDate = '';

/**
 * Shared helper function to query pending follow-ups due today in Asia/Kolkata timezone.
 * Single source of truth for Dashboard and Follow-Up Manager.
 */
export function getTodayPendingFollowUps(list: FollowUpItem[]): FollowUpItem[] {
  if (!Array.isArray(list)) return [];
  const todayStr = getTodayInIndia();
  return list.filter((f) => {
    if (!f || f.status !== 'Pending') return false;
    const itemDueDate = String(f.dueDate || f.scheduledDate || f.date || '').split('T')[0];
    return itemDueDate === todayStr;
  });
}

export function useFollowups() {
  const [dbFollowups, setDbFollowups] = useState<FollowUpItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const todayStr = getTodayInIndia();
    // Run automated generation check once per calendar day on hook mount
    if (autoGenerationTriggeredDate !== todayStr) {
      autoGenerationTriggeredDate = todayStr;
      followupService.generateAutomatedFollowups(todayStr).catch(() => {});
    }

    const unsubscribe = followupService.subscribe(
      (data) => {
        setDbFollowups(data);
        setLoading(false);
      },
      () => {
        setLoading(false);
      }
    );
    return () => unsubscribe();
  }, []);

  // Filter out any legacy auto trigger tasks and sort strictly date-wise (ascending)
  const followups = useMemo(() => {
    const cleanList = dbFollowups.filter((f) => {
      const notesLower = (f.notes || '').toLowerCase();
      const titleLower = (f.title || '').toLowerCase();
      const descLower = (f.description || '').toLowerCase();
      return (
        !notesLower.includes('auto trigger') &&
        !titleLower.includes('auto trigger') &&
        !descLower.includes('auto trigger')
      );
    });

    cleanList.sort((a, b) => {
      const tsA = a.scheduledTimestamp || (a.scheduledDate ? new Date(`${a.scheduledDate}T${a.scheduledTime || '10:00'}`).getTime() : 0);
      const tsB = b.scheduledTimestamp || (b.scheduledDate ? new Date(`${b.scheduledDate}T${b.scheduledTime || '10:00'}`).getTime() : 0);
      return tsA - tsB;
    });

    return cleanList;
  }, [dbFollowups]);

  // Today's Follow-ups: pending + dueDate is EXACTLY today in Asia/Kolkata
  const todaysFollowups = useMemo(() => {
    return getTodayPendingFollowUps(followups);
  }, [followups]);

  const todaysCount = useMemo(() => {
    return todaysFollowups.length;
  }, [todaysFollowups]);

  // Overdue Tasks: pending + dueDate < today
  const overdueFollowups = useMemo(() => {
    return followups.filter((f) => {
      if (f.status !== 'Pending') return false;
      const d = f.dueDate || f.scheduledDate || f.date || '';
      return isOverdueInIndia(d);
    });
  }, [followups]);

  const overdueCount = useMemo(() => {
    return overdueFollowups.length;
  }, [overdueFollowups]);

  // Upcoming Tasks: pending + dueDate > today
  const upcomingFollowups = useMemo(() => {
    return followups.filter((f) => {
      if (f.status !== 'Pending') return false;
      const d = f.dueDate || f.scheduledDate || f.date || '';
      return isUpcomingInIndia(d);
    });
  }, [followups]);

  const upcomingCount = useMemo(() => {
    return upcomingFollowups.length;
  }, [upcomingFollowups]);

  // Completed Today: status Completed + completedAt (or dueDate) is today
  const completedTodayFollowups = useMemo(() => {
    return followups.filter((f) => {
      if (f.status !== 'Completed') return false;
      const completedDate = f.completedAt ? f.completedAt.split('T')[0] : (f.dueDate || f.scheduledDate || '');
      return isTodayInIndia(completedDate);
    });
  }, [followups]);

  const completedTodayCount = useMemo(() => {
    return completedTodayFollowups.length;
  }, [completedTodayFollowups]);

  // All Active Tasks: status is Pending
  const activeFollowups = useMemo(() => {
    return followups.filter((f) => f.status === 'Pending');
  }, [followups]);

  const totalActiveCount = useMemo(() => {
    return activeFollowups.length;
  }, [activeFollowups]);

  const dueNowCount = useMemo(() => {
    const now = Date.now();
    const todayStr = getTodayInIndia();
    return followups.filter(
      (f) =>
        f.status === 'Pending' &&
        (f.dueDate === todayStr || f.scheduledDate === todayStr) &&
        f.scheduledTimestamp <= now
    ).length;
  }, [followups]);

  const nextHourCount = useMemo(() => {
    const now = Date.now();
    const oneHourLater = now + 60 * 60 * 1000;
    const todayStr = getTodayInIndia();
    return followups.filter(
      (f) =>
        f.status === 'Pending' &&
        (f.dueDate === todayStr || f.scheduledDate === todayStr) &&
        f.scheduledTimestamp > now &&
        f.scheduledTimestamp <= oneHourLater
    ).length;
  }, [followups]);

  const createFollowup = useCallback(async (data: Partial<FollowUpItem>) => {
    const item = await followupService.create(data);
    return item;
  }, []);

  const completeFollowup = useCallback(
    async (
      id: string,
      remarks: string,
      outcome: string,
      memberId?: string | null,
      enquiryId?: string | null,
      taskObj?: FollowUpItem,
      performedBy?: string
    ) => {
      await followupService.complete(id, remarks, outcome, memberId, enquiryId, taskObj, performedBy);
      setDbFollowups((prev) =>
        prev.map((f) =>
          f.id === id
            ? {
                ...f,
                status: 'Completed',
                remarks,
                outcome,
                lastNote: remarks ? `Completed: ${remarks}` : (outcome || 'Completed'),
                completedAt: new Date().toISOString(),
              }
            : f
        )
      );
    },
    []
  );

  const rescheduleFollowup = useCallback(
    async (
      task: FollowUpItem,
      newDate: string,
      newTime: string,
      reason?: string,
      note?: string,
      performedBy?: string
    ) => {
      await followupService.reschedule(task, newDate, newTime, reason, note, performedBy);
      const cleanDate = newDate.split('T')[0];
      const cleanTime = newTime || '10:00';
      setDbFollowups((prev) =>
        prev.map((f) =>
          f.id === task.id
            ? {
                ...f,
                dueDate: cleanDate,
                scheduledDate: cleanDate,
                scheduledTime: cleanTime,
                scheduledTimestamp: new Date(`${cleanDate}T${cleanTime}:00+05:30`).getTime() || Date.now(),
                date: cleanDate,
                status: 'Pending',
                lastNote: note || reason || f.lastNote,
                updatedAt: new Date().toISOString(),
              }
            : f
        )
      );
    },
    []
  );

  const addFollowupNote = useCallback(
    async (
      task: FollowUpItem,
      noteText: string,
      nextDate?: string,
      nextTime?: string,
      performedBy?: string
    ) => {
      await followupService.addNote(task, noteText, nextDate, nextTime, performedBy);
      setDbFollowups((prev) =>
        prev.map((f) =>
          f.id === task.id
            ? {
                ...f,
                lastNote: noteText.trim(),
                ...(nextDate ? {
                  dueDate: nextDate.split('T')[0],
                  scheduledDate: nextDate.split('T')[0],
                  scheduledTime: nextTime || f.scheduledTime,
                  date: nextDate.split('T')[0],
                } : {}),
                updatedAt: new Date().toISOString(),
              }
            : f
        )
      );
    },
    []
  );

  const markFollowupLost = useCallback(
    async (task: FollowUpItem, reason: string, performedBy?: string) => {
      await followupService.markLost(task, reason, performedBy);
      setDbFollowups((prev) =>
        prev.map((f) =>
          f.id === task.id
            ? {
                ...f,
                status: 'Lost',
                remarks: reason.trim(),
                outcome: 'Lost',
                lastNote: `Marked Lost: ${reason.trim()}`,
                completedAt: new Date().toISOString(),
              }
            : f
        )
      );
    },
    []
  );

  const snoozeFollowup = useCallback(async (task: FollowUpItem) => {
    const res = await followupService.snooze(task);
    setDbFollowups((prev) =>
      prev.map((f) =>
        f.id === task.id
          ? {
              ...f,
              scheduledTime: res.nextHourStr,
              scheduledTimestamp: Date.now() + 3600000,
            }
          : f
      )
    );
    return res;
  }, []);

  const cancelFollowup = useCallback(async (id: string) => {
    await followupService.cancel(id);
    setDbFollowups((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: 'Cancelled' } : f))
    );
  }, []);

  const removeFollowup = useCallback(async (id: string) => {
    await followupService.remove(id);
    setDbFollowups((prev) => prev.filter((f) => f.id !== id));
  }, []);

  return {
    followups,
    todaysFollowups,
    overdueFollowups,
    upcomingFollowups,
    completedTodayFollowups,
    activeFollowups,
    loading,
    pendingCount: totalActiveCount,
    totalActiveCount,
    todaysCount,
    overdueCount,
    upcomingCount,
    completedTodayCount,
    dueNowCount,
    nextHourCount,
    getTodayPendingFollowUps: () => todaysFollowups,
    createFollowup,
    completeFollowup,
    rescheduleFollowup,
    addFollowupNote,
    markFollowupLost,
    snoozeFollowup,
    cancelFollowup,
    removeFollowup,
  };
}
