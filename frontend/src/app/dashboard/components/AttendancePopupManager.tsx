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

    // Strictly suppress popups for punches older than 15 seconds
    const rawTimeStr = data.checkIn || data.timestamp || data.createdAt;
    if (rawTimeStr) {
      const punchMs = new Date(rawTimeStr).getTime();
      const nowMs = Date.now();
      const ageSec = (nowMs - punchMs) / 1000;
      if (ageSec > 15 || ageSec < -5) {
        return;
      }
    }

    const members = useGymStore.getState().members;
    const match = members.find((m: any) =>
      (m.id && data.memberId && m.id === data.memberId) ||
      (m.uid && data.memberId && m.uid === data.memberId) ||
      (m.memberId && data.memberId && m.memberId === data.memberId) ||
      (m.memberId && data.memberCode && m.memberId === data.memberCode) ||
      (m.biometricId && data.biometricId && m.biometricId === data.biometricId) ||
      (m.biometricId && data.deviceUserId && m.biometricId === data.deviceUserId) ||
      (m.deviceUserId && data.biometricId && m.deviceUserId === data.biometricId) ||
      (m.phone && data.phone && String(m.phone).replace(/\D/g, '') === String(data.phone).replace(/\D/g, '')) ||
      (m.name && data.memberName && m.name.trim().toLowerCase() === String(data.memberName).trim().toLowerCase())
    );

    let type: PopupData['type'] = 'success';

    if (data.status === 'duplicate' || data.method === 'duplicate' || data.isDuplicate) {
      type = 'duplicate';
    } else if (data.status === 'unknown' || (data.memberName && String(data.memberName).toLowerCase().includes('unmapped'))) {
      type = 'unknown';
    } else if (data.status === 'denied') {
      if (data.reason?.toLowerCase().includes('blacklisted')) type = 'blacklisted';
      else if (data.reason?.toLowerCase().includes('frozen') || match?.status === 'frozen') type = 'frozen';
      else type = 'expired';
    }

    const days = match?.expiryDate
      ? membershipEngine.calculateDaysLeft(match.expiryDate)
      : 30;

    if (type === 'success' && days <= 0 && match) {
      type = 'expired';
    }

    const rawTime = data.checkIn || data.timestamp || data.createdAt;
    const formattedTime = rawTime
      ? new Date(rawTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const popupData: PopupData = {
      id: docId,
      type,
      data: {
        memberName: match?.name || data.memberName || 'Athlete',
        memberCode: match?.biometricId || match?.deviceUserId || match?.clientId || match?.customId || match?.memberId || data.memberCode || data.memberId || 'TWG-2026-0001',
        timestamp: formattedTime,
        deviceName: data.deviceName || data.method || 'Hikvision DS-K1T320EFWX',
        branch: match?.branch || data.branch || 'Mohali, Punjab',
        avatarUrl: match?.photo || match?.avatarUrl || match?.avatar || data.avatarUrl || data.photo || '',
        plan: match?.plan || 'Monthly Standard',
        trainer: match?.trainer || 'No PT Assigned',
        remainingDays: days > 0 ? days : 0,
        expiredDays: days < 0 ? Math.abs(days) : 0,
        workout: 'Push Day',
        reason: data.reason
      }
    };

    const memberName = match?.name || data.memberName || `ID #${data.biometricId || data.memberId || '1145'}`;
    const toastTitle = type === 'unknown' ? 'Unmapped Biometric Punch' : (type === 'duplicate' ? 'Already Inside' : 'Attendance Marked');
    toast(`⚡ ${toastTitle}: ${memberName}`, {
      icon: type === 'success' ? '🟢' : type === 'duplicate' ? '🔵' : type === 'unknown' ? '🟡' : '🔴',
      duration: 5000,
      style: { background: '#0F172A', color: '#fff', border: type === 'success' ? '1px solid #22C55E' : type === 'duplicate' ? '1px solid #3B82F6' : type === 'unknown' ? '1px solid #F59E0B' : '1px solid #EF4444', borderRadius: '16px', fontWeight: 'bold', fontSize: '13px' }
    });

    setQueue(prev => [...prev, popupData]);
  };

  // REST API Polling for latest punch event
  useEffect(() => {
    let isMounted = true;
    
    // Set initial baseline punch on mount to prevent stale popups
    API.get('/attendance/latest-punch').then(res => {
      const latest = res.data?.latestPunch;
      if (latest && isMounted) {
        const id = latest.id || `${latest.memberId}_${latest.checkIn || latest.createdAt}`;
        processedDocIds.current.add(id);
      }
    }).catch(() => {});

    const pollLatestPunch = async () => {
      try {
        const res = await API.get('/attendance/latest-punch');
        const latest = res.data?.latestPunch;
        if (latest && isMounted) {
          const docId = latest.id || `${latest.memberId}_${latest.checkIn || latest.createdAt}`;
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

  // Firestore Realtime Listener (when Firebase ready)
  useEffect(() => {
    if (!isFirebaseReady || !fDb) return;

    const attCollection = collection(fDb, 'attendance_logs');
    const qPop = query(attCollection, orderBy('createdAt', 'desc'), limit(15));
    let isInitialLoad = true;

    const unsubscribe = onSnapshot(
      qPop,
      (snapshot) => {
        if (isInitialLoad) {
          isInitialLoad = false;
          // Baseline: mark all historical docs in snapshot as already processed
          snapshot.docs.forEach(doc => processedDocIds.current.add(doc.id));
          return;
        }
        snapshot.docChanges().forEach((change) => {
          if (change.type !== 'added') return;
          const data = change.doc.data();
          const docId = change.doc.id;
          if (data.status === 'auto_checkout') return;

          processPunchItem(data, docId);
        });
      },
      (error) => {
        console.warn('[AttendancePopupManager] Firestore listener error:', error);
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
