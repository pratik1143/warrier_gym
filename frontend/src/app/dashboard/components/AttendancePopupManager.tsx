'use client';

import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db as fDb, isFirebaseReady } from '@/lib/firebase';
import API from '@/services/api';
import { useGymStore } from '@/store';
import { membershipEngine } from '@/lib/engines/membershipEngine';
import toast from '@/lib/toast';
import { useRouter } from 'next/navigation';

import SuccessPopup from './popups/SuccessPopup';
import UnknownPopup from './popups/UnknownPopup';
import DuplicatePopup from './popups/DuplicatePopup';
import ExpiredPopup from './popups/ExpiredPopup';
import FrozenPopup from './popups/FrozenPopup';
import BlacklistedPopup from './popups/BlacklistedPopup';

interface PopupData {
  id: string;
  type: 'success' | 'unknown' | 'duplicate' | 'expired' | 'frozen' | 'blacklisted' | 'blocked';
  data: any;
}

export default function AttendancePopupManager() {
  const router = useRouter();
  const [queue, setQueue] = useState<PopupData[]>([]);
  const [activePopup, setActivePopup] = useState<PopupData | null>(null);
  const processedDocIds = useRef<Set<string>>(new Set());

  // Audio elements / chime player
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

    // Suppress popups for punches older than 20 seconds
    const rawTimeStr = data.checkIn || data.timestamp || data.eventTime || data.receivedAt || data.createdAt;
    if (rawTimeStr) {
      const punchMs = new Date(rawTimeStr).getTime();
      const nowMs = Date.now();
      const ageSec = (nowMs - punchMs) / 1000;
      if (ageSec > 20 || ageSec < -5) {
        return;
      }
    }

    // Hikvision events may carry the terminal user number as employeeNo / deviceUserId
    const punchBioId = String(data.biometricId || data.employeeNo || data.deviceUserId || data.hikvisionUserId || '').trim();
    const statusLower = String(data.status || data.accessResult || '').toLowerCase();

    const members = useGymStore.getState().members;
    const match = members.find((m: any) =>
      (m.biometricId && punchBioId && String(m.biometricId).trim() === String(punchBioId).trim()) ||
      (m.deviceUserId && punchBioId && String(m.deviceUserId).trim() === String(punchBioId).trim()) ||
      (m.clientId && punchBioId && String(m.clientId).trim() === String(punchBioId).trim()) ||
      (m.customId && punchBioId && String(m.customId).trim() === String(punchBioId).trim()) ||
      (m.id && data.memberId && m.id === data.memberId) ||
      (m.uid && data.memberId && m.uid === data.memberId) ||
      (m.memberId && data.memberId && m.memberId === data.memberId) ||
      (m.memberId && data.memberCode && m.memberId === data.memberCode) ||
      (m.phone && data.phone && String(m.phone).replace(/\D/g, '') === String(data.phone).replace(/\D/g, '')) ||
      (m.name && data.memberName && m.name.trim().toLowerCase() === String(data.memberName).trim().toLowerCase())
    );

    let type: PopupData['type'] = 'success';

    if (statusLower === 'duplicate' || statusLower === 'already_inside' || data.punchType === 'REPEAT_TAP' || data.method === 'duplicate' || data.isDuplicate) {
      type = 'duplicate';
    } else if (statusLower === 'unknown' || statusLower === 'unmapped' || data.punchType === 'UNKNOWN_PUNCH' || (data.memberName && String(data.memberName).toLowerCase().includes('unmapped')) || (!match && data.unmapped)) {
      type = 'unknown';
    } else if (statusLower === 'hold' || statusLower === 'frozen') {
      type = 'frozen';
    } else if (statusLower === 'blocked') {
      type = 'blocked';
    } else if (statusLower === 'expired') {
      type = 'expired';
    } else if (statusLower === 'denied') {
      if (data.reason?.toLowerCase().includes('biometric') || match?.biometricBlocked === true) type = 'blocked';
      else if (data.reason?.toLowerCase().includes('blacklisted')) type = 'blacklisted';
      else if (data.reason?.toLowerCase().includes('frozen') || match?.status === 'frozen') type = 'frozen';
      else type = 'expired';
    }

    const days = match?.expiryDate
      ? membershipEngine.calculateDaysLeft(match.expiryDate)
      : 30;

    if (type === 'success' && days <= 0 && match) {
      type = 'expired';
    }

    const rawTime = data.checkIn || data.timestamp || data.eventTime || data.receivedAt || data.createdAt;
    const formattedTime = rawTime
      ? new Date(rawTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
      : new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });

    const formattedDate = rawTime
      ? new Date(rawTime).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
      : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    // Birthday & Anniversary Check
    const dobStr = match?.dob || match?.dateOfBirth;
    let isBirthday = false;
    if (dobStr) {
      try {
        const d = new Date(dobStr);
        const today = new Date();
        isBirthday = d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
      } catch (e) {}
    }

    const joinStr = match?.joinDate || match?.startDate || match?.createdAt;
    let isAnniversary = false;
    let anniversaryYears = 0;
    if (joinStr) {
      try {
        const j = new Date(joinStr);
        const today = new Date();
        if (j.getMonth() === today.getMonth() && j.getDate() === today.getDate()) {
          anniversaryYears = today.getFullYear() - j.getFullYear();
          if (anniversaryYears > 0) isAnniversary = true;
        }
      } catch (e) {}
    }

    // Payment Status calculation
    const rawPaid = Number(match?.amountPaid ?? match?.paid ?? match?.totalPaid ?? 0);
    const rawPending = Number(match?.pendingAmount ?? match?.balanceAmount ?? match?.outstandingBalance ?? 0);
    const payStatus = rawPending <= 0 ? 'FULLY PAID' : (rawPaid > 0 ? 'PARTIAL' : 'PENDING');

    const popupData: PopupData = {
      id: docId,
      type,
      data: {
        rawId: match?.id || data.memberId,
        memberName: match?.name || data.memberName || 'Athlete',
        memberCode: match?.memberId || match?.clientId || match?.customId || data.memberCode || data.memberId || '#TWG-2026-0001',
        biometricId: punchBioId || match?.biometricId || match?.deviceUserId || '1',
        timestamp: formattedTime,
        dateStr: formattedDate,
        deviceName: data.deviceName || 'Hikvision DS-K1T320EFWX',
        method: data.verificationMode || data.verificationMethod || data.method || 'Face / Fingerprint',
        branch: match?.branch || data.branch || 'Mohali, Punjab',
        avatarUrl: match?.photo || match?.avatarUrl || match?.avatar || match?.profilePhotoUrl || data.avatarUrl || data.memberPhotoUrl || data.photo || '',
        plan: match?.plan || match?.packageName || 'Monthly Standard',
        status: (match?.status || 'active').toUpperCase(),
        startDate: match?.startDate || match?.joinDate || 'N/A',
        expiryDate: match?.expiryDate || 'N/A',
        remainingDays: days > 0 ? days : 0,
        expiredDays: days < 0 ? Math.abs(days) : 0,
        payStatus,
        phone: match?.phone || data.phone || '',
        dob: dobStr || '',
        gender: match?.gender || '',
        isBirthday,
        isAnniversary,
        anniversaryYears,
        trainer: match?.trainer || '',
        workout: 'Push Day',
        reason: data.reason || 'Attendance Recorded',
        biometricBlocked: type === 'blocked'
      }
    };

    const memberName = match?.name || data.memberName || `Biometric User #${punchBioId || data.memberId || '1'}`;
    const isDenied = ['expired', 'frozen', 'blacklisted', 'blocked'].includes(type);
    const toastTitle = type === 'unknown' ? 'Unmapped Biometric Punch' : (type === 'duplicate' ? 'Already Checked In' : isDenied ? `Access Denied${data.reason ? `: ${data.reason}` : ''}` : 'Attendance Marked');
    toast(`⚡ ${toastTitle}: ${memberName}`, {
      icon: type === 'success' ? '🟢' : type === 'duplicate' ? '🔵' : type === 'unknown' ? '🟡' : '🔴',
      duration: 5000,
      style: { background: '#0F172A', color: '#fff', border: type === 'success' ? '1px solid #22C55E' : type === 'duplicate' ? '1px solid #F97316' : type === 'unknown' ? '1px solid #F59E0B' : '1px solid #EF4444', borderRadius: '16px', fontWeight: 'bold', fontSize: '13px' }
    });

    setQueue(prev => [...prev, popupData]);
  };

  // REST API Polling for latest punch event
  useEffect(() => {
    let isMounted = true;
    
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

  // Auto Close Manager (7 seconds)
  useEffect(() => {
    if (activePopup) {
      const timer = setTimeout(() => {
        setActivePopup(null);
      }, 7000);

      return () => clearTimeout(timer);
    }
  }, [activePopup]);

  const handleClose = () => {
    setActivePopup(null);
  };

  const handleViewMember = (memberId?: string) => {
    handleClose();
    if (memberId) {
      router.push(`/dashboard/members/${memberId}`);
    } else {
      router.push('/dashboard/members');
    }
  };

  const handleRenewMember = (memberId?: string) => {
    handleClose();
    if (memberId) {
      router.push(`/dashboard/billing/create?mode=renew&id=${encodeURIComponent(memberId)}`);
    } else {
      router.push('/dashboard/billing/create');
    }
  };

  if (!activePopup) return null;

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-md pointer-events-none">
      <AnimatePresence>
        {activePopup && (
          <div className="pointer-events-auto">
            {activePopup.type === 'success' && <SuccessPopup data={activePopup.data} onClose={handleClose} onViewMember={() => handleViewMember(activePopup.data.rawId)} />}
            {activePopup.type === 'unknown' && <UnknownPopup data={activePopup.data} onClose={handleClose} onRegister={() => handleViewMember()} onMap={() => handleViewMember()} />}
            {activePopup.type === 'duplicate' && <DuplicatePopup data={activePopup.data} onClose={handleClose} />}
            {activePopup.type === 'expired' && <ExpiredPopup data={activePopup.data} onClose={handleClose} onRenew={() => handleRenewMember(activePopup.data.rawId)} />}
            {activePopup.type === 'frozen' && <FrozenPopup data={activePopup.data} onClose={handleClose} onResume={() => handleViewMember(activePopup.data.rawId)} />}
            {activePopup.type === 'blacklisted' && <BlacklistedPopup data={activePopup.data} onClose={handleClose} />}
            {activePopup.type === 'blocked' && <BlacklistedPopup data={activePopup.data} onClose={handleClose} />}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
