'use client';

import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db as fDb, isFirebaseReady } from '@/lib/firebase';
import API from '@/services/api';
import { useGymStore } from '@/store';
import { membershipEngine } from '@/lib/engines/membershipEngine';
import toast from '@/lib/toast';

import SuccessPopup from './popups/SuccessPopup';
import UnknownPopup from './popups/UnknownPopup';
import DuplicatePopup from './popups/DuplicatePopup';
import ExpiredPopup from './popups/ExpiredPopup';
import FrozenPopup from './popups/FrozenPopup';
import BlacklistedPopup from './popups/BlacklistedPopup';

interface PopupData {
  id: string;
  type: 'success' | 'unknown' | 'duplicate' | 'expired' | 'frozen' | 'blacklisted';
  data: any;
}

export default function AttendancePopupManager() {
  const [queue, setQueue] = useState<PopupData[]>([]);
  const [activePopup, setActivePopup] = useState<PopupData | null>(null);
  const processedDocIds = useRef<Set<string>>(new Set());

  // Audio elements or synthesized sounds can be triggered here
  const playSound = (type: string) => {
    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContext) return;
      const ctx = new AudioContext();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      if (type === 'success') {
         osc.frequency.setValueAtTime(880, ctx.currentTime);
         osc.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.1);
      } else if (type === 'unknown' || type === 'expired') {
         osc.type = 'square';
         osc.frequency.setValueAtTime(300, ctx.currentTime);
         osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
      } else if (type === 'duplicate') {
         osc.frequency.setValueAtTime(600, ctx.currentTime);
         osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.2);
      } else {
         osc.frequency.setValueAtTime(400, ctx.currentTime);
      }
      
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    } catch (err) {
      console.warn("Sound blocked or unavailable", err);
    }
  };

  const processPunchItem = (data: any, docId: string) => {
    if (!docId || processedDocIds.current.has(docId)) return;
    processedDocIds.current.add(docId);

    // Realtime guard: allow punches received in the last 45 seconds to prevent stale popups on load
    const rawTimeStr = data.receivedAt || data.eventTime || data.createdAt || data.timestamp || data.checkIn;
    if (rawTimeStr) {
      const punchMs = new Date(rawTimeStr).getTime();
      const nowMs = Date.now();
      const ageSec = (nowMs - punchMs) / 1000;
      if (ageSec > 45 || ageSec < -30) {
        return;
      }
    }

    const members = useGymStore.getState().members;
    const bioId = String(data.biometricId || data.employeeNo || data.deviceUserId || '').trim();

    // Strictly resolve member by biometricId, employeeId, or memberId (Requirement 8)
    const match = bioId
      ? members.find((m: any) =>
          String(m.biometricId || '').trim() === bioId ||
          String(m.employeeId || '').trim() === bioId ||
          String(m.deviceUserId || '').trim() === bioId ||
          (data.memberId && (m.id === data.memberId || m.memberId === data.memberId))
        )
      : null;

    let type: PopupData['type'] = 'success';
    const statusUpper = String(data.status || '').toUpperCase();

    if (statusUpper === 'UNKNOWN' || String(data.punchType || '').toUpperCase() === 'UNKNOWN_PUNCH' || !match && !data.memberName) {
      type = 'unknown';
    } else if (statusUpper === 'ALREADY_INSIDE' || statusUpper === 'DUPLICATE' || data.punchType === 'REPEAT_TAP') {
      type = 'duplicate';
    } else if (statusUpper === 'HOLD_MEMBER' || match?.status?.toLowerCase() === 'hold') {
      type = 'frozen';
    } else if (statusUpper === 'EXPIRED' || statusUpper === 'DENIED') {
      type = 'expired';
    } else if (match) {
      type = 'success';
    } else {
      type = 'unknown';
    }

    const days = match?.expiryDate
      ? membershipEngine.calculateDaysLeft(match.expiryDate)
      : (match?.status?.toLowerCase() === 'hold' ? 0 : 30);

    if (type === 'success' && days <= 0 && match) {
      type = 'expired';
    }

    const rawTime = data.eventTime || data.receivedAt || data.checkIn || data.timestamp || data.createdAt;
    const formattedTime = rawTime
      ? new Date(rawTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
      : new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true });

    const memberName = match?.name || data.memberName || (type === 'unknown' ? `Unknown Person #${bioId}` : 'Warrior Member');
    const photoUrl = data.memberPhotoUrl || match?.photoUrl || match?.photo || match?.avatar || match?.avatarUrl || '';
    const verifyMode = data.verificationMode || data.method || 'Face';

    const popupData: PopupData = {
      id: docId,
      type,
      data: {
        memberName,
        memberCode: match?.memberId || (bioId ? `BIO #${bioId}` : 'TWG-2026-0001'),
        biometricId: bioId,
        timestamp: formattedTime,
        deviceName: data.deviceName || 'Hikvision DS-K1T320EFWX',
        branch: match?.branch || data.branch || 'Mohali, Punjab',
        avatarUrl: photoUrl,
        plan: match?.plan || (type === 'unknown' ? 'Unknown Person' : (match?.status?.toLowerCase() === 'hold' ? 'Account on HOLD' : 'Monthly Standard')),
        trainer: match?.trainer || 'No PT Assigned',
        remainingDays: days > 0 ? days : 0,
        expiredDays: days < 0 ? Math.abs(days) : 0,
        workout: verifyMode,
        reason: data.reason || (type === 'unknown' ? 'Member not found in CRM' : '')
      }
    };

    // Toast notification for instant visual & sound cue (Requirement 13)
    let toastTitle = 'Attendance Marked';
    let toastIcon = '🟢';
    if (type === 'unknown') {
      toastTitle = 'Unknown Punch Detected';
      toastIcon = '🟡';
    } else if (type === 'duplicate') {
      toastTitle = 'Punch Detected — Already Inside';
      toastIcon = '🔵';
    } else if (type === 'frozen') {
      toastTitle = 'HOLD Member Punch';
      toastIcon = '⏸️';
    } else if (type === 'expired') {
      toastTitle = 'Membership Expired';
      toastIcon = '🔴';
    }

    toast(`${toastIcon} ${toastTitle}: ${memberName} (BIO: ${bioId || 'N/A'}) · ${verifyMode}`, {
      duration: 5000,
      style: {
        background: '#0F172A',
        color: '#fff',
        border: type === 'success' ? '1px solid #22C55E' : type === 'duplicate' ? '1px solid #3B82F6' : type === 'unknown' ? '1px solid #F59E0B' : '1px solid #EF4444',
        borderRadius: '16px',
        fontWeight: 'bold',
        fontSize: '13px'
      }
    });

    setQueue(prev => [...prev, popupData]);
  };

  // REST API Polling for latest punch event (safety backup)
  useEffect(() => {
    let isMounted = true;
    
    // Set initial baseline punch on mount to prevent stale popups
    API.get('/attendance/latest-punch').then(res => {
      const latest = res.data?.latestPunch;
      if (latest && isMounted) {
        const id = latest.eventId || latest.id || `${latest.memberId}_${latest.checkIn || latest.createdAt}`;
        processedDocIds.current.add(id);
      }
    }).catch(() => {});

    const pollLatestPunch = async () => {
      try {
        const res = await API.get('/attendance/latest-punch');
        const latest = res.data?.latestPunch;
        if (latest && isMounted) {
          const docId = latest.eventId || latest.id || `${latest.memberId}_${latest.checkIn || latest.createdAt}`;
          processPunchItem(latest, docId);
        }
      } catch (err) {}
    };

    const interval = setInterval(pollLatestPunch, 2500);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Firestore Realtime Listener for raw device punch events (Requirement 11 & 12)
  useEffect(() => {
    if (!isFirebaseReady || !fDb) return;

    // Listen directly to attendanceEvents collection
    const eventsCollection = collection(fDb, 'attendanceEvents');
    const qPop = query(eventsCollection, orderBy('receivedAt', 'desc'), limit(20));
    let isInitialLoad = true;

    const unsubscribe = onSnapshot(
      qPop,
      (snapshot) => {
        if (isInitialLoad) {
          isInitialLoad = false;
          // Mark historical docs as already seen so reopening page doesn't flood popups
          snapshot.docs.forEach(doc => processedDocIds.current.add(doc.id));
          return;
        }
        snapshot.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const data = change.doc.data();
          const docId = change.doc.id;
          processPunchItem(data, docId);
        });
      },
      (error) => {
        console.warn('[AttendancePopupManager] Firestore attendanceEvents listener error:', error);
      }
    );

    return () => unsubscribe();
  }, []);

  // Queue Dequeue Manager
  useEffect(() => {
    if (!activePopup && queue.length > 0) {
      const nextPopup = queue[0];
      setActivePopup(nextPopup);
      setQueue(prev => prev.slice(1));
      playSound(nextPopup.type);
    }
  }, [queue, activePopup]);

  // Auto Close Manager (4 seconds)
  useEffect(() => {
    if (activePopup) {
      const timer = setTimeout(() => {
        setActivePopup(null);
      }, 4000);

      return () => clearTimeout(timer);
    }
  }, [activePopup]);

  const handleClose = () => {
    setActivePopup(null);
  };

  const handleRegister = () => {
    handleClose();
    toast('Open Add Member Wizard here...');
  };

  const handleMap = () => {
    handleClose();
    toast('Open Map Existing Member here...');
  };

  return (
    <div className="fixed top-6 right-6 z-[9999] flex flex-col gap-4 pointer-events-none">
      <AnimatePresence>
        {activePopup && (
          <div className="pointer-events-auto">
            {activePopup.type === 'success' && <SuccessPopup data={activePopup.data} onClose={handleClose} />}
            {activePopup.type === 'unknown' && <UnknownPopup data={activePopup.data} onClose={handleClose} onRegister={handleRegister} onMap={handleMap} />}
            {activePopup.type === 'duplicate' && <DuplicatePopup data={activePopup.data} onClose={handleClose} />}
            {activePopup.type === 'expired' && <ExpiredPopup data={activePopup.data} onClose={handleClose} onRenew={() => { handleClose(); toast('Open Renew'); }} />}
            {activePopup.type === 'frozen' && <FrozenPopup data={activePopup.data} onClose={handleClose} onResume={() => { handleClose(); toast('Resume'); }} />}
            {activePopup.type === 'blacklisted' && <BlacklistedPopup data={activePopup.data} onClose={handleClose} />}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
