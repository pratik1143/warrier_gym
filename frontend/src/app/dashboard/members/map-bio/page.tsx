'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Search, ScanFace, Fingerprint, ShieldCheck,
  RefreshCw, CheckCircle2, AlertTriangle, X, Info,
  ChevronRight,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useGymStore } from '@/store';
import { getInitials, getRandomColor } from '@/lib/utils';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import API from '@/services/api';
import toast from '@/lib/toast';
import { getBiometricReadiness } from '@/lib/biometricStatus';
import styles from './map-bio.module.css';

type BiometricMachineState =
  | 'IDLE' | 'CREATING_USER' | 'USER_READY'
  | 'FACE_STARTING' | 'FACE_ENROLLING' | 'FACE_SAVED'
  | 'FINGERPRINT_STARTING' | 'FINGERPRINT_ENROLLING' | 'FINGERPRINT_SAVED'
  | 'BIOMETRIC_COMPLETE' | 'FAILED' | 'CANCELLED';

export default function MapBioPage() {
  const router = useRouter();
  const { members, fetchMembers } = useGymStore();
  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const [search, setSearch] = useState('');
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [showAll, setShowAll] = useState(false);
  const autoSelectedMember = useRef(false);

  // The route's selected-member query is applied after the member store hydrates.
  useEffect(() => {
    if (autoSelectedMember.current || members.length === 0) return;
    const memberId = new URLSearchParams(window.location.search).get('memberId');
    if (!memberId) return;
    const target = members.find((member: any) => String(member.id) === memberId);
    if (!target) return;
    autoSelectedMember.current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShowAll(true);
    setSelectedMember(target);
    router.replace('/dashboard/members/map-bio', { scroll: false });
  }, [members, router]);

  const missingBioMembers = useMemo(() =>
    (members || []).filter((m: any) => {
      return getBiometricReadiness(m).needsMapping;
    }), [members]);

  const displayMembers = showAll ? (members || []) : missingBioMembers;

  const filteredMembers = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return displayMembers;
    return displayMembers.filter((m: any) =>
      String(m.name || '').toLowerCase().includes(q) ||
      String(m.phone || '').includes(q) ||
      String(m.biometricId || m.deviceUserId || m.biometricUserId || '').includes(q)
    );
  }, [displayMembers, search]);

  const [biometricId, setBiometricId] = useState('');
  const [machineStep, setMachineStep] = useState<BiometricMachineState>('IDLE');
  const [enrollStatus, setEnrollStatus] = useState<'idle' | 'enrolling' | 'success' | 'failed'>('idle');
  const [enrollMsg, setEnrollMsg] = useState('');
  const [enrollDetailLog, setEnrollDetailLog] = useState('');
  const [selectedEnrollType, setSelectedEnrollType] = useState<'FACE' | 'FINGERPRINT' | 'BOTH'>('FACE');
  const [faceStatus, setFaceStatus] = useState('NOT ENROLLED');
  const [fpStatus, setFpStatus] = useState('NOT ENROLLED');
  const [fpScanCount, setFpScanCount] = useState<1|2|3>(1);
  const [hikvisionOnline, setHikvisionOnline] = useState(true);
  const [isTestingConn, setIsTestingConn] = useState(false);
  const cancelRef = useRef(false);
  const faceEnrolledAtRef = useRef<string|null>(null);
  const fpEnrolledAtRef = useRef<string|null>(null);
  const fpStatusRef = useRef('NOT ENROLLED');
  const faceStatusRef = useRef('NOT ENROLLED');

  const isBusy = ['CREATING_USER','FACE_STARTING','FACE_ENROLLING','FINGERPRINT_STARTING','FINGERPRINT_ENROLLING'].includes(machineStep);

  // Reset device controls when the operator selects a different member.
  useEffect(() => {
    if (!selectedMember) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setBiometricId(String(selectedMember.biometricId || selectedMember.biometricUserId || selectedMember.deviceUserId || selectedMember.hikvisionUserId || ''));
    setMachineStep('IDLE'); setEnrollStatus('idle');
    setEnrollMsg(''); setEnrollDetailLog('');
    const savedFaceStatus = String(selectedMember.faceEnrollmentStatus || selectedMember.biometric?.face?.status || '').toUpperCase();
    const savedFingerprintStatus = String(selectedMember.fingerprintEnrollmentStatus || selectedMember.biometric?.fingerprint?.status || '').toUpperCase();
    setFaceStatus(savedFaceStatus === 'ENROLLED' ? 'ENROLLED' : 'NOT ENROLLED');
    setFpStatus(savedFingerprintStatus === 'ENROLLED' ? 'ENROLLED' : 'NOT ENROLLED');
    faceEnrolledAtRef.current = null; fpEnrolledAtRef.current = null;
    fpStatusRef.current = savedFingerprintStatus === 'ENROLLED' ? 'ENROLLED' : 'NOT ENROLLED';
    faceStatusRef.current = savedFaceStatus === 'ENROLLED' ? 'ENROLLED' : 'NOT ENROLLED';
    cancelRef.current = false;
    // eslint-enable react-hooks/set-state-in-effect
  }, [selectedMember?.id]);

  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

  const checkHikvision = async () => {
    setIsTestingConn(true);
    try {
      const r = await API.post('/devices/hikvision/test-connection');
      setHikvisionOnline(!!r.data?.online);
      r.data?.online ? toast.success('Terminal Connected') : toast.error('Terminal unreachable');
    } catch { setHikvisionOnline(false); toast.error('Connection error'); }
    finally { setIsTestingConn(false); }
  };

  const queryDevice = async (bioId: string) => {
    try { const r = await API.get(`/devices/hikvision/enrollment-status/${bioId}`); return r.data?.success ? r.data : null; }
    catch { return null; }
  };

  const persist = async (bioId: string, faceSt: string, fpSt: string) => {
    if (!selectedMember?.id) return;
    const now = new Date().toISOString();
    const isComplete = faceSt === 'ENROLLED' && fpSt === 'ENROLLED';
    const isPartial = (faceSt === 'ENROLLED' || fpSt === 'ENROLLED') && !isComplete;
    const payload: any = {
      biometricId: bioId, deviceUserId: bioId, hikvisionUserId: bioId,
      faceEnrollmentStatus: faceSt, fingerprintEnrollmentStatus: fpSt,
      biometricStatus: isComplete ? 'COMPLETE' : isPartial ? 'PARTIAL' : 'NOT_ENROLLED',
      biometric: {
        biometricId: bioId, hikvisionUserId: bioId,
        face: { status: faceSt, enrolledAt: faceSt === 'ENROLLED' ? (faceEnrolledAtRef.current || now) : null },
        fingerprint: { status: fpSt, enrolledAt: fpSt === 'ENROLLED' ? (fpEnrolledAtRef.current || now) : null },
        enrollmentFlow: selectedEnrollType,
        enrollmentStatus: isComplete ? 'COMPLETE' : isPartial ? 'PARTIAL' : 'NOT_ENROLLED',
        updatedAt: now,
      },
    };
    try { await updateDoc(doc(db, 'members', selectedMember.id), payload); fetchMembers(); }
    catch (e) { console.warn('Persist error:', e); }
  };

  const executeFace = async (bioId: string, memName: string): Promise<boolean> => {
    setMachineStep('FACE_ENROLLING'); setFaceStatus('REQUESTING');
    setEnrollMsg('Activating terminal camera. Look at the Hikvision screen...');
    try {
      await API.post('/devices/hikvision/enroll', {
        memberId: selectedMember?.id || 'map_' + Date.now(), memberName: memName,
        biometricId: bioId, employeeNo: bioId, deviceId: 'hikvision-main-gate',
        flow: selectedEnrollType, enrollmentType: 'FACE',
      });
    } catch (e: any) { console.warn(e.message); }
    setFaceStatus('WAITING FOR TERMINAL');
    setEnrollMsg(`Camera active. Look at terminal (ID #${bioId})...`);
    for (let i = 1; i <= 30; i++) {
      if (cancelRef.current) return false;
      await sleep(1500);
      if (cancelRef.current) return false;
      const d = await queryDevice(bioId);
      if (d && (d.hasFace || d.numOfFace > 0)) {
        const now = new Date().toISOString();
        setFaceStatus('ENROLLED'); faceStatusRef.current = 'ENROLLED';
        faceEnrolledAtRef.current = now; setMachineStep('FACE_SAVED');
        return true;
      }
      setEnrollMsg(`Looking for face... (${Math.round((30 - i) * 1.5)}s remaining)`);
    }
    setFaceStatus('FAILED'); return false;
  };

  const executeFp = async (bioId: string, memName: string, isSeq: boolean): Promise<boolean> => {
    setMachineStep('FINGERPRINT_ENROLLING'); setFpScanCount(1); setFpStatus('REQUESTING');
    setEnrollMsg('Sending fingerprint command...');
    let resp: any = null;
    try {
      resp = await API.post('/devices/hikvision/enroll', {
        memberId: selectedMember?.id || 'map_' + Date.now(), memberName: memName,
        biometricId: bioId, employeeNo: bioId, deviceId: 'hikvision-main-gate',
        flow: isSeq ? 'FACE_AND_FINGERPRINT' : 'FINGERPRINT_ONLY', enrollmentType: 'FINGERPRINT',
      });
    } catch (e: any) {
      setMachineStep('FAILED'); setFpStatus('FAILED'); setEnrollStatus('failed');
      setEnrollMsg(e.message); return false;
    }
    if (!resp?.data?.success && resp?.data?.status !== 'ENROLLING') {
      setMachineStep('FAILED'); setFpStatus('FAILED'); setEnrollStatus('failed');
      setEnrollMsg(resp?.data?.error || 'Device could not start enrollment.'); return false;
    }
    setFpStatus('WAITING FOR TERMINAL');
    setEnrollMsg('Scanner active: Place finger 3 times...');
    for (let i = 1; i <= 35; i++) {
      if (cancelRef.current) return false;
      await sleep(1500);
      if (cancelRef.current) return false;
      if (i >= 3 && fpScanCount === 1) setFpScanCount(2);
      if (i >= 7 && fpScanCount === 2) setFpScanCount(3);
      const d = await queryDevice(bioId);
      if (d && (d.hasFingerprint || d.numOfFP > 0)) {
        const now = new Date().toISOString();
        setFpScanCount(3); setFpStatus('ENROLLED'); fpStatusRef.current = 'ENROLLED';
        fpEnrolledAtRef.current = now; setMachineStep('FINGERPRINT_SAVED'); return true;
      }
      setEnrollMsg(`Scanner active... (${Math.round((35 - i) * 1.5)}s remaining)`);
    }
    setFpStatus('FAILED'); setMachineStep('FAILED'); return false;
  };

  const handleEnroll = async (type: 'FACE' | 'FINGERPRINT' | 'BOTH') => {
    if (isBusy || !selectedMember) return;
    const bioId = biometricId.trim() || String(selectedMember.biometricId || '101');
    const memName = String(selectedMember.name || 'Member').trim();
    cancelRef.current = false;
    setSelectedEnrollType(type); setEnrollDetailLog('');
    setMachineStep('CREATING_USER'); setEnrollStatus('enrolling');
    setEnrollMsg(`Provisioning user #${bioId}...`);
    try { await API.post('/devices/hikvision/create-user', { biometricId: bioId, memberName: memName }); }
    catch (e: any) { console.warn(e.message); }
    if (cancelRef.current) return;
    setMachineStep('USER_READY');

    if (type === 'FACE') {
      setMachineStep('FACE_STARTING');
      const ok = await executeFace(bioId, memName);
      if (ok) {
        setMachineStep('BIOMETRIC_COMPLETE'); setEnrollStatus('success');
        await persist(bioId, 'ENROLLED', fpStatusRef.current);
        toast.success('Face enrolled & saved to device + CRM!');
      } else { setMachineStep('FAILED'); setEnrollStatus('failed'); }
    } else if (type === 'FINGERPRINT') {
      setMachineStep('FINGERPRINT_STARTING');
      const ok = await executeFp(bioId, memName, false);
      if (ok) {
        setMachineStep('BIOMETRIC_COMPLETE'); setEnrollStatus('success');
        await persist(bioId, faceStatusRef.current, 'ENROLLED');
        toast.success('Fingerprint enrolled & saved!');
      } else { setMachineStep('FAILED'); setEnrollStatus('failed'); }
    } else {
      setMachineStep('FACE_STARTING');
      const faceOk = await executeFace(bioId, memName);
      if (cancelRef.current) return;
      if (!faceOk) { setMachineStep('FAILED'); setEnrollStatus('failed'); toast.error('Face failed.'); return; }
      setFaceStatus('ENROLLED'); faceStatusRef.current = 'ENROLLED';
      const fn = new Date().toISOString(); faceEnrolledAtRef.current = fn;
      await persist(bioId, 'ENROLLED', fpStatusRef.current);
      toast.success('Face captured! Starting fingerprint...');
      await sleep(1200);
      if (cancelRef.current) return;
      setMachineStep('FINGERPRINT_STARTING');
      const fpOk = await executeFp(bioId, memName, true);
      if (cancelRef.current) return;
      if (fpOk) {
        setMachineStep('BIOMETRIC_COMPLETE'); setEnrollStatus('success');
        await persist(bioId, 'ENROLLED', 'ENROLLED');
        toast.success('Face & Fingerprint enrolled & saved!');
      } else {
        setMachineStep('FAILED'); setEnrollStatus('failed');
        setFpStatus('FAILED'); fpStatusRef.current = 'FAILED';
        await persist(bioId, 'ENROLLED', 'FAILED');
        toast.error('Fingerprint failed.');
      }
    }
  };

  const handleMarkSkipped = async () => {
    if (!selectedMember?.id) return;
    try {
      await updateDoc(doc(db, 'members', selectedMember.id), {
        biometricStatus: 'SKIPPED', faceEnrollmentStatus: 'NOT_ENROLLED', fingerprintEnrollmentStatus: 'NOT_ENROLLED',
      });
      toast.success(`Marked ${selectedMember.name} as skipped`);
      fetchMembers(); setSelectedMember(null);
    } catch { toast.error('Failed'); }
  };

  const getBadge = (m: any) => {
    const bio = String(m.biometricStatus || '').toUpperCase();
    const readiness = getBiometricReadiness(m);
    if (!readiness.needsMapping) return { label: 'Ready', cls: 'bg-emerald-100 text-emerald-800' };
    if (bio === 'SKIPPED') return { label: 'Skipped', cls: 'bg-amber-100 text-amber-800' };
    const missing = [!readiness.hasBiometricId && 'Bio ID', !readiness.faceEnrolled && 'Face', !readiness.fingerprintEnrolled && 'Fingerprint'].filter(Boolean);
    return { label: `Missing ${missing.join(' + ')}`, cls: 'bg-orange-100 text-orange-800' };
  };

  const faceIsEnrolling = machineStep === 'FACE_STARTING' || machineStep === 'FACE_ENROLLING';
  const fpIsEnrolling = machineStep === 'FINGERPRINT_STARTING' || machineStep === 'FINGERPRINT_ENROLLING';

  return (
    <div className={`${styles.mapBio} min-h-screen text-slate-800 font-sans`}>
      <div className={`${styles.header} sticky top-0 z-20 border-b border-stone-200 px-5 py-3.5 flex items-center justify-between shadow-sm`}>
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => router.push('/dashboard/members')} className="p-2 rounded-xl hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-stone-900">Map Biometrics</h1>
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 border border-violet-200">Enrollment Console</span>
            </div>
            <p className="text-[11px] text-stone-500">Select a member and enroll their face/fingerprint on the Hikvision terminal</p>
          </div>
        </div>
        <span className="text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-lg border border-red-200">{missingBioMembers.length} missing bio</span>
      </div>

      <div className={`${styles.layout} flex`}>
        <div className={`${styles.sidebar} border-r border-stone-200 bg-white flex flex-col overflow-hidden shrink-0`}>
          <div className="p-3 border-b border-stone-100 space-y-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
              <input type="text" placeholder="Search members..." value={search} onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-stone-50 rounded-xl border border-stone-200 focus:border-violet-400 focus:outline-none focus:ring-2 focus:ring-violet-100 transition-all" />
            </div>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => setShowAll(false)}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${!showAll ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                Missing ({missingBioMembers.length})
              </button>
              <button type="button" onClick={() => setShowAll(true)}
                className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all ${showAll ? 'bg-stone-200 text-stone-800 border border-stone-300' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}>
                All Members
              </button>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {filteredMembers.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-12 text-stone-400 px-4 text-center">
                <ScanFace className="w-8 h-8 mb-2 opacity-30" />
                <p className="text-xs font-medium">{showAll ? 'No members found' : 'All members enrolled!'}</p>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredMembers.map((m: any) => {
                  const badge = getBadge(m);
                  const isSelected = selectedMember?.id === m.id;
                  const color = getRandomColor(m.name);
                  const initials = getInitials(m.name);
                  return (
                    <button key={m.id} type="button" onClick={() => setSelectedMember(m)}
                      className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center gap-2.5 ${isSelected ? 'bg-violet-50 border border-violet-200 shadow-sm' : 'hover:bg-stone-50 border border-transparent'}`}>
                      <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-stone-100">
                        {m.photo ? <img src={m.photo} alt={m.name} className="w-full h-full object-cover" />
                          : <div className="w-full h-full flex items-center justify-center text-white text-xs font-black" style={{ background: color }}>{initials}</div>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-stone-900 truncate">{m.name}</p>
                        <p className="text-[10px] text-stone-500 truncate">{m.phone}</p>
                        {m.biometricId && <p className="text-[10px] text-stone-400 font-mono">ID #{m.biometricId}</p>}
                      </div>
                      <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded shrink-0 ${badge.cls}`}>{badge.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {!selectedMember ? (
            <div className="flex flex-col items-center justify-center h-full text-stone-400 space-y-3">
              <div className="w-16 h-16 rounded-2xl bg-violet-50 border border-violet-100 flex items-center justify-center">
                <ScanFace className="w-8 h-8 text-violet-300" />
              </div>
              <p className="text-sm font-bold text-stone-500">Select a member from the left panel</p>
              <p className="text-xs text-stone-400">to start biometric enrollment</p>
            </div>
          ) : (
            <div className="p-6 space-y-5 max-w-3xl mx-auto">
              <div className="flex items-center gap-4 p-4 bg-white rounded-2xl border border-stone-200 shadow-sm">
                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-violet-200 shrink-0">
                  {selectedMember.photo ? <img src={selectedMember.photo} alt={selectedMember.name} className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center text-white text-sm font-black" style={{ background: getRandomColor(selectedMember.name) }}>{getInitials(selectedMember.name)}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-black text-stone-900 truncate">{selectedMember.name}</h2>
                  <p className="text-xs text-stone-500">{selectedMember.phone} · {selectedMember.plan}</p>
                  <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${getBadge(selectedMember).cls}`}>{getBadge(selectedMember).label}</span>
                </div>
                <button type="button" onClick={() => setSelectedMember(null)} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-4 bg-white rounded-2xl border border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
                <div>
                  <label className="block text-[11px] font-bold text-stone-600 uppercase tracking-wider mb-1">Hikvision User ID</label>
                  <div className="flex items-center gap-2">
                    <input type="text" value={biometricId} onChange={e => setBiometricId(e.target.value.replace(/\D/g, ''))} placeholder="e.g. 101"
                      className="w-28 px-3 py-1.5 text-base font-mono font-bold bg-stone-50 rounded-xl border border-stone-200 focus:border-violet-400 focus:outline-none" />
                    <span className="text-xs text-stone-400">(device slot ID)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 bg-stone-50 px-3.5 py-2 rounded-xl border border-stone-200">
                  <div className={`w-2.5 h-2.5 rounded-full ${hikvisionOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                  <div>
                    <span className="text-[11px] font-bold text-stone-800 block leading-tight">Hikvision DS-K1T342MFWX</span>
                    <span className="text-[10px] text-stone-500">192.168.1.45 · {hikvisionOnline ? 'Online' : 'Offline'}</span>
                  </div>
                  <button type="button" onClick={checkHikvision} disabled={isTestingConn} className="ml-1 p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors">
                    <RefreshCw className={`w-3.5 h-3.5 ${isTestingConn ? 'animate-spin text-violet-500' : ''}`} />
                  </button>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">Select Enrollment Action</h3>
                  {isBusy && (
                    <button type="button" onClick={() => { cancelRef.current = true; setMachineStep('CANCELLED'); setEnrollStatus('idle'); toast.info('Cancelled.'); }}
                      className="px-2.5 py-1 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg border border-red-200 flex items-center gap-1">
                      <X className="w-3.5 h-3.5" /> Cancel
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button type="button" disabled={isBusy} onClick={() => handleEnroll('FACE')}
                    className={`text-left p-4 rounded-2xl border-2 transition-all flex flex-col justify-between ${isBusy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-violet-300'} ${selectedEnrollType === 'FACE' && machineStep !== 'IDLE' && machineStep !== 'CANCELLED' ? 'border-violet-400 bg-violet-50/60 shadow-sm' : 'border-stone-200 bg-white'}`}>
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center mb-3"><ScanFace className="w-5 h-5" /></div>
                      <h4 className="text-sm font-bold text-stone-900">Register Face</h4>
                      <p className="text-[11px] text-stone-500 mt-1">Triggers terminal camera to capture 3D facial profile.</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${faceStatus === 'ENROLLED' ? 'bg-emerald-100 text-emerald-800' : faceStatus === 'FAILED' ? 'bg-red-100 text-red-800' : faceStatus !== 'NOT ENROLLED' ? 'bg-violet-100 text-violet-800 animate-pulse' : 'bg-stone-100 text-stone-600'}`}>
                        {faceStatus === 'ENROLLED' ? 'ENROLLED' : faceStatus}
                      </span>
                      <ChevronRight className="w-4 h-4 text-stone-400" />
                    </div>
                  </button>
                  <button type="button" disabled={isBusy} onClick={() => handleEnroll('FINGERPRINT')}
                    className={`text-left p-4 rounded-2xl border-2 transition-all flex flex-col justify-between ${isBusy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-violet-300'} ${selectedEnrollType === 'FINGERPRINT' && machineStep !== 'IDLE' && machineStep !== 'CANCELLED' ? 'border-violet-400 bg-violet-50/60 shadow-sm' : 'border-stone-200 bg-white'}`}>
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center mb-3"><Fingerprint className="w-5 h-5" /></div>
                      <h4 className="text-sm font-bold text-stone-900">Register Fingerprint</h4>
                      <p className="text-[11px] text-stone-500 mt-1">Enrolls fingerprint template on optical scanner.</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                      <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${fpStatus === 'ENROLLED' ? 'bg-emerald-100 text-emerald-800' : fpStatus === 'FAILED' ? 'bg-red-100 text-red-800' : fpStatus !== 'NOT ENROLLED' ? 'bg-violet-100 text-violet-800 animate-pulse' : 'bg-stone-100 text-stone-600'}`}>
                        {fpStatus === 'ENROLLED' ? 'ENROLLED' : fpStatus}
                      </span>
                      <ChevronRight className="w-4 h-4 text-stone-400" />
                    </div>
                  </button>
                  <button type="button" disabled={isBusy} onClick={() => handleEnroll('BOTH')}
                    className={`text-left p-4 rounded-2xl border-2 transition-all flex flex-col justify-between ${isBusy ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-violet-300'} ${selectedEnrollType === 'BOTH' && machineStep !== 'IDLE' && machineStep !== 'CANCELLED' ? 'border-violet-400 bg-violet-50/60 shadow-sm' : 'border-stone-200 bg-white'}`}>
                    <div>
                      <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3"><ShieldCheck className="w-5 h-5" /></div>
                      <h4 className="text-sm font-bold text-stone-900">Face + Fingerprint</h4>
                      <p className="text-[11px] text-stone-500 mt-1">Dual sequential enrollment for highest security.</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                      <span className="text-[10px] font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded">Sequential Flow</span>
                      <ChevronRight className="w-4 h-4 text-stone-400" />
                    </div>
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {faceIsEnrolling && (
                  <motion.div key="face" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="p-5 rounded-2xl border-2 border-violet-400 bg-violet-50/90 shadow-sm space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 font-bold text-violet-950 text-sm">
                        <ScanFace className="w-5 h-5 text-violet-600 animate-bounce" /><span>FACE ENROLLMENT ACTIVE</span>
                      </div>
                      <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-full animate-pulse">ENROLLING...</span>
                    </div>
                    <p className="text-xs text-violet-900 font-medium">Look directly at the Hikvision camera on the terminal.</p>
                    <div className="flex items-center gap-2 text-xs text-violet-900 bg-white/80 p-3 rounded-xl border border-violet-200">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                      <span>Terminal camera active. Capturing 3D face structure...</span>
                    </div>
                  </motion.div>
                )}
                {machineStep === 'FACE_SAVED' && (
                  <motion.div key="face-saved" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="p-3.5 rounded-2xl border border-emerald-300 bg-emerald-50 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-950 font-bold text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" /><span>FACE: Captured. Starting fingerprint...</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">SAVED</span>
                  </motion.div>
                )}
                {fpIsEnrolling && (
                  <motion.div key="fp" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="p-5 rounded-2xl border-2 border-violet-400 bg-violet-50/90 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5 font-bold text-violet-950 text-sm">
                        <Fingerprint className="w-5 h-5 text-violet-600 animate-pulse" /><span>FINGERPRINT ENROLLMENT</span>
                      </div>
                      <span className="text-[10px] font-bold text-violet-700 bg-violet-100 px-2.5 py-0.5 rounded-full font-mono">Scan {fpScanCount} of 3</span>
                    </div>
                    <p className="text-xs text-violet-900 font-medium">Place your finger on the Hikvision optical scanner.</p>
                    <div className="grid grid-cols-3 gap-3">
                      {([1, 2, 3] as const).map(n => (
                        <div key={n} className={`p-3 rounded-xl border text-center ${fpScanCount >= n ? 'bg-white border-violet-300 shadow-sm' : 'bg-violet-100/40 border-violet-200 opacity-60'}`}>
                          <div className="text-[11px] font-bold text-stone-800">Scan {n} of 3</div>
                          <div className="flex items-center justify-center gap-1 mt-2">
                            {([1, 2, 3] as const).map(dot => (
                              <span key={dot} className={`w-2.5 h-2.5 rounded-full ${dot < n ? 'bg-violet-600' : (dot === n && fpScanCount >= n) ? 'bg-violet-600 animate-pulse' : 'bg-stone-200'}`} />
                            ))}
                          </div>
                          <div className="text-[10px] text-stone-500 mt-1">{n === 1 ? 'Place finger' : n === 2 ? 'Lift & place' : 'Verify'}</div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
                {machineStep === 'BIOMETRIC_COMPLETE' && (
                  <motion.div key="complete" initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                    className="p-5 rounded-2xl border-2 border-emerald-400 bg-emerald-50 shadow-sm space-y-3">
                    <div className="flex items-center gap-2.5 font-bold text-emerald-950 text-sm">
                      <CheckCircle2 className="w-6 h-6 text-emerald-600" /><span>BIOMETRICS SAVED - Device + CRM Updated</span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="p-3 bg-white rounded-xl border border-emerald-200 flex items-center justify-between">
                        <span className="font-bold text-stone-700">Face</span>
                        <span className={`font-black ${faceStatus === 'ENROLLED' ? 'text-emerald-700' : 'text-stone-400'}`}>{faceStatus === 'ENROLLED' ? 'ENROLLED' : 'NOT SET'}</span>
                      </div>
                      <div className="p-3 bg-white rounded-xl border border-emerald-200 flex items-center justify-between">
                        <span className="font-bold text-stone-700">Fingerprint</span>
                        <span className={`font-black ${fpStatus === 'ENROLLED' ? 'text-emerald-700' : 'text-stone-400'}`}>{fpStatus === 'ENROLLED' ? 'ENROLLED' : 'NOT SET'}</span>
                      </div>
                    </div>
                    <button type="button" onClick={() => { setSelectedMember(null); setMachineStep('IDLE'); }}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition-all">
                      Select Next Member
                    </button>
                  </motion.div>
                )}
                {machineStep === 'FAILED' && (
                  <motion.div key="failed" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                    className="p-4 rounded-2xl border-2 border-red-300 bg-red-50 space-y-2">
                    <div className="flex items-center gap-2 font-bold text-red-950 text-sm">
                      <AlertTriangle className="w-5 h-5 text-red-600" /><span>Enrollment Failed or Timed Out</span>
                    </div>
                    <p className="text-xs text-red-700">Ensure the member is in front of the terminal and try again.</p>
                    <button type="button" onClick={() => { setMachineStep('IDLE'); setEnrollStatus('idle'); setEnrollMsg(''); }}
                      className="px-4 py-2 bg-red-600 text-white rounded-xl font-bold text-xs hover:bg-red-700 flex items-center gap-1.5">
                      <RefreshCw className="w-3.5 h-3.5" /> Retry
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {enrollMsg && machineStep !== 'IDLE' && machineStep !== 'BIOMETRIC_COMPLETE' && machineStep !== 'CANCELLED' && (
                <div className={`p-3.5 rounded-xl border text-xs ${enrollStatus === 'failed' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-violet-50 border-violet-200 text-violet-900'}`}>
                  <div className="flex items-center gap-2 font-bold mb-1">
                    {isBusy && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>Terminal Feedback</span>
                  </div>
                  <p className="font-medium">{enrollMsg}</p>
                </div>
              )}

              {!isBusy && machineStep !== 'BIOMETRIC_COMPLETE' && (
                <div className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-200">
                  <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-stone-400 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-stone-700">Not enrolling now?</p>
                      <p className="text-[11px] text-stone-500 mt-0.5">Mark this member as skipped for now.</p>
                    </div>
                  </div>
                  <button type="button" onClick={handleMarkSkipped}
                    className="px-3 py-1.5 bg-white border border-stone-200 hover:border-amber-300 text-stone-600 hover:text-amber-700 text-xs font-bold rounded-xl transition-all shrink-0 ml-3">
                    Mark as Skipped
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
