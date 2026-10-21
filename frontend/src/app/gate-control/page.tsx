'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Shield, Unlock, CheckCircle2, AlertTriangle, RefreshCw, Server, Cpu, Search, Fingerprint, Lock, User, Phone, Filter, Check, ArrowRight, Activity } from 'lucide-react';
import API from '@/services/api';
import { useGymStore } from '@/store';
import toast from '@/lib/toast';

type EnrollmentState = 
  | 'NOT_ENROLLED'
  | 'SELECTED'
  | 'ENROLLMENT_REQUESTED'
  | 'DEVICE_READY'
  | 'SCANNING_1'
  | 'SCANNING_2'
  | 'SCANNING_3'
  | 'VERIFYING'
  | 'ENROLLMENT_SUCCESS'
  | 'SAVING_TO_CRM'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

const isFaceEnrolled = (item: any) =>
  String(item?.faceEnrollmentStatus || item?.faceStatus || '').toUpperCase() === 'ENROLLED'
  || item?.faceEnrolled === true
  || item?.hasFace === true
  || item?.face?.enrolled === true;

const isFingerprintEnrolled = (item: any) =>
  String(item?.fingerprintStatus || item?.fingerprintEnrollmentStatus || '').toUpperCase() === 'ENROLLED'
  || item?.fingerprintEnrolled === true
  || item?.fingerprint?.enrolled === true
  || String(item?.fingerprint?.status || '').toUpperCase() === 'ENROLLED';

export default function GateControlPage() {
  const [activeTab, setActiveTab] = useState<'gate' | 'enroll' | 'employee'>('gate');
  const [deviceIp, setDeviceIp] = useState('192.168.1.45');
  const [devicePort, setDevicePort] = useState('443');
  const [serverIp, setServerIp] = useState('Localhost');
  const [serverPort, setServerPort] = useState('8000');
  const [accessUrl, setAccessUrl] = useState('http://192.168.1.45:8000/gate-control');
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [checkingStatus, setCheckingStatus] = useState<boolean>(false);

  // Gate execution states
  const [isOpening, setIsOpening] = useState<boolean>(false);
  const [lastResult, setLastResult] = useState<{
    success: boolean;
    title: string;
    message: string;
    timestamp: string;
    deviceIp: string;
  } | null>(null);

  // Enroll Client state
  const { members, fetchMembers } = useGymStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshingMembers, setRefreshingMembers] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'pending' | 'enrolled' | 'all'>('pending');
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [enrollingMemberId, setEnrollingMemberId] = useState<string | null>(null);

  // Enroll Employee state
  const [employees, setEmployees] = useState<any[]>([]);
  const [empSearchQuery, setEmpSearchQuery] = useState('');
  const [empStatusFilter, setEmpStatusFilter] = useState<'pending' | 'enrolled' | 'all'>('pending');
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);

  // Fingerprint State Machine
  const [enrollState, setEnrollState] = useState<EnrollmentState>('NOT_ENROLLED');
  const [enrollMsg, setEnrollMsg] = useState('');
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  // Hikvision terminal supports both face and fingerprint templates
  const [enrollKind, setEnrollKind] = useState<'FACE' | 'FINGERPRINT'>('FACE');

  // Fetch staff/employees
  const fetchEmployees = async () => {
    try {
      const res = await API.get('/employees');
      if (Array.isArray(res.data)) {
        setEmployees(res.data);
      }
    } catch (err) {
      console.warn('Failed to fetch employees:', err);
    }
  };

  // Fetch gate & server status
  const fetchStatus = async () => {
    setCheckingStatus(true);
    try {
      const res = await API.get('/gate/status');
      if (res.data) {
        setDeviceIp(res.data.ip || '192.168.1.45');
        setDevicePort(res.data.port || '443');
        setServerIp(res.data.serverIp || window.location.hostname);
        setServerPort(res.data.serverPort || window.location.port || '8000');
        setAccessUrl(res.data.accessUrl || `http://${window.location.hostname}:${window.location.port || '8000'}/gate-control`);
        setIsConnected(res.data.connected !== false);
      }
    } catch (err) {
      console.warn('[Gate Control] Status probe notice:', err);
      setIsConnected(false);
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    fetchMembers(true);
    fetchEmployees();
    const interval = setInterval(() => {
      fetchStatus();
      fetchMembers(true);
      fetchEmployees();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchMembers]);

  const refreshMembers = async () => {
    setRefreshingMembers(true);
    try {
      await fetchMembers(true);
      toast.success('Member list refreshed');
    } finally {
      setRefreshingMembers(false);
    }
  };

  // Clean Numeric Biometric ID extractor
  const getCleanNumericId = (item: any): string => {
    const biometricId = item?.biometricId;
    if (biometricId === undefined || biometricId === null || biometricId === '') return '';
    const bioId = String(biometricId).trim();
    return /^\d{1,5}$/.test(bioId) && Number(bioId) > 0 ? bioId : '';
  };

  // Filter CRM members for enrollment
  const filteredMembers = useMemo(() => {
    const getCreatedTime = (member: any) => {
      const value = member?.createdAt || member?.joinDate || member?.startDate;
      if (value?.seconds) return value.seconds * 1000;
      const parsed = value ? new Date(value).getTime() : 0;
      return Number.isFinite(parsed) ? parsed : 0;
    };
    const q = searchQuery.trim().toLowerCase().replace(/^#/, '');
    return (members || []).filter((m: any) => {
      const searchable = [m.biometricId, m.deviceUserId, m.memberId, m.clientId, m.customId, m.id, m.uid, m.name, m.fullName, m.phone]
        .filter(value => value !== undefined && value !== null)
        .map(value => String(value).toLowerCase());
      const matchesSearch = !q || searchable.some(value => value.includes(q));
      const isEnrolled = enrollKind === 'FACE' ? isFaceEnrolled(m) : isFingerprintEnrolled(m);

      if (!matchesSearch) return false;
      if (statusFilter === 'pending') return !isEnrolled;
      if (statusFilter === 'enrolled') return isEnrolled;
      return true;
    }).sort((a: any, b: any) => getCreatedTime(b) - getCreatedTime(a));
  }, [members, searchQuery, statusFilter, enrollKind]);

  // Filter Employees for enrollment
  const filteredEmployees = useMemo(() => {
    return (employees || []).filter((e: any) => {
      const bioId = getCleanNumericId(e);
      const name = String(e.name || '').toLowerCase();
      const role = String(e.role || '').toLowerCase();
      const phone = String(e.phone || '');
      const q = empSearchQuery.trim().toLowerCase();

      const matchesSearch = !q || bioId.includes(q) || name.includes(q) || role.includes(q) || phone.includes(q);
      const isEnrolled = enrollKind === 'FACE' ? isFaceEnrolled(e) : isFingerprintEnrolled(e);

      if (!matchesSearch) return false;
      if (empStatusFilter === 'pending') return !isEnrolled;
      if (empStatusFilter === 'enrolled') return isEnrolled;
      return true;
    });
  }, [employees, empSearchQuery, empStatusFilter, enrollKind]);

  // Handle Open Gate Button Click
  const handleOpenGate = async () => {
    if (isOpening) return;
    setIsOpening(true);
    setLastResult(null);
    const startTime = new Date().toLocaleTimeString('en-IN', { hour12: false });

    try {
      const res = await API.post('/gate/open', {
        deviceId: 'hikvision-main-gate',
        source: 'LAN_WEB_INTERFACE'
      });

      if (res.data && res.data.success) {
        setLastResult({
          success: true,
          title: '✓ GATE OPENED',
          message: res.data.message || 'Door unlocked for 15 seconds',
          timestamp: res.data.timestamp || startTime,
          deviceIp: res.data.deviceIp || deviceIp,
        });
      } else {
        setLastResult({
          success: false,
          title: '✕ GATE OPEN FAILED',
          message: res.data?.message || 'Physical device relay did not unlock',
          timestamp: startTime,
          deviceIp,
        });
      }
    } catch (err: any) {
      const errorMsg = err?.response?.data?.message || err?.message || 'Device communication error';
      setLastResult({
        success: false,
        title: '✕ GATE OPEN FAILED',
        message: errorMsg,
        timestamp: startTime,
        deviceIp,
      });
    } finally {
      setTimeout(() => setIsOpening(false), 3000);
    }
  };

  // Handle Fingerprint Enrollment Trigger
  const handleStartEnrollment = async (member: any) => {
    if (enrollingMemberId) return;
    const bioId = getCleanNumericId(member);
    const sessionId = `sess_${bioId}_${Date.now()}`;
    
    setSelectedMember(member);
    setActiveSessionId(sessionId);
    if (!bioId) {
      setEnrollState('FAILED');
      setEnrollMsg('This member does not have a permanent numeric biometric ID yet. Refresh the list, then assign an ID before enrolling.');
      toast.error('Biometric ID is missing. Assign an ID first.');
      return;
    }
    setEnrollingMemberId(String(member.id));
    setEnrollState('ENROLLMENT_REQUESTED');
    setEnrollMsg(`Connecting to Hikvision terminal at ${deviceIp} for User #${bioId}...`);

    try {
      setEnrollMsg('Enrollment request submitted. Follow the physical terminal prompts; waiting for device template verification.');

      const res = await API.post('/devices/biometric/enroll-fingerprint', {
        memberId: member.id,
        memberName: member.name,
        biometricId: bioId,
        userId: bioId,
        enrollmentType: enrollKind,
        enrollmentSessionId: sessionId
      }, { timeout: 330000 });

      if (res.data && res.data.success) {
        setEnrollState('ENROLLMENT_SUCCESS');
        setEnrollMsg(`✓ ${enrollKind === 'FACE' ? 'Face' : 'Fingerprint'} template captured & mapped to Member #${bioId} (${member.name})`);
        toast.success(`Fingerprint successfully enrolled for ${member.name} (ID #${bioId})!`);
        
        // Refresh member roster
        await fetchMembers(true);
        setTimeout(() => {
          setEnrollState('COMPLETED');
        }, 2500);
      } else {
        setEnrollState('FAILED');
        setEnrollMsg(res.data?.error || res.data?.message || 'Device did not confirm a saved fingerprint template.');
        toast.error(res.data?.error || 'Enrollment failed. Device template was not confirmed.');
      }
    } catch (err: any) {
      setEnrollState('FAILED');
      const errorMessage = err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Device socket communication error.';
      setEnrollMsg(errorMessage);
      toast.error(errorMessage);
    } finally {
      setEnrollingMemberId(null);
    }
  };

  // Handle Employee Fingerprint Enrollment Trigger
  const handleStartEmployeeEnrollment = async (emp: any) => {
    const bioId = getCleanNumericId(emp);
    const sessionId = `sess_${bioId}_${Date.now()}`;
    
    setSelectedEmployee(emp);
    setActiveSessionId(sessionId);
    setEnrollState('ENROLLMENT_REQUESTED');
    setEnrollMsg(`Connecting to Hikvision terminal at ${deviceIp} for Staff #${bioId} (${emp.name})...`);

    try {
      setEnrollMsg('Enrollment request submitted. Follow the physical terminal prompts; waiting for device template verification.');

      const res = await API.post('/devices/biometric/enroll-fingerprint', {
        employeeId: emp.id,
        isEmployee: true,
        memberName: emp.name,
        name: emp.name,
        biometricId: bioId,
        userId: bioId,
        enrollmentType: enrollKind,
        enrollmentSessionId: sessionId
      }, { timeout: 330000 });

      if (res.data && res.data.success) {
        setEnrollState('ENROLLMENT_SUCCESS');
        setEnrollMsg(`✓ ${enrollKind === 'FACE' ? 'Face' : 'Fingerprint'} template captured & mapped to Staff #${bioId} (${emp.name})`);
        toast.success(`Fingerprint enrolled for staff ${emp.name} (ID #${bioId})!`);
        
        fetchEmployees();
        setTimeout(() => {
          setEnrollState('COMPLETED');
        }, 2500);
      } else {
        setEnrollState('FAILED');
        setEnrollMsg(res.data?.error || res.data?.message || 'Device did not confirm a saved fingerprint template.');
        toast.error('Enrollment failed. Device template was not confirmed.');
      }
    } catch (err: any) {
      setEnrollState('FAILED');
      setEnrollMsg(err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Device socket communication error.');
      toast.error('Device error during fingerprint enrollment.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-start p-4 font-sans selection:bg-orange-600 selection:text-white">
      
      {/* BACKGROUND DECORATIVE GLOWS */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-emerald-600/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-5xl space-y-5 z-10 py-4">

        {/* PAGE HEADER */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/80 rounded-3xl p-6 text-center shadow-2xl space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-orange-500/10 border border-orange-500/20 text-orange-400 mb-1 shadow-inner">
            <Shield size={28} />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase">
            THE WARRIOR GYM
          </h1>
          <p className="text-xs font-bold text-orange-400 tracking-widest uppercase">
            Hikvision Local LAN Terminal & Hardware Enrollment Engine
          </p>

          {/* TAB NAVIGATION */}
          <div className="pt-3 flex items-center justify-center gap-2">
            <button
              onClick={() => setActiveTab('gate')}
              className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-2 ${
                activeTab === 'gate'
                  ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-900/40'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/80 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Unlock size={15} />
              <span>Gate Control</span>
            </button>

            <button
              onClick={() => setActiveTab('enroll')}
              className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-2 ${
                activeTab === 'enroll'
                  ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-900/40'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/80 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Fingerprint size={15} />
              <span>Enroll Client</span>
            </button>

            <button
              onClick={() => setActiveTab('employee')}
              className={`px-4 py-2 rounded-2xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer flex items-center gap-2 ${
                activeTab === 'employee'
                  ? 'bg-orange-600 text-white border-orange-500 shadow-lg shadow-orange-900/40'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/80 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <User size={15} />
              <span>Enroll Employee</span>
            </button>
          </div>
        </div>

        {/* STATUS CARDS GRID */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Server size={14} className="text-orange-400" /> Server
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-extrabold bg-emerald-950/60 border border-emerald-800/50 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                ONLINE
              </span>
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-slate-200">IP: {serverIp}</div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">Port: {serverPort}</div>
            </div>
          </div>

          <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 flex flex-col justify-between space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-400 uppercase tracking-wider">
              <span className="flex items-center gap-1.5">
                <Cpu size={14} className="text-purple-400" /> Hikvision Device
              </span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                isConnected
                  ? 'text-emerald-400 bg-emerald-950/60 border-emerald-800/50'
                  : 'text-amber-400 bg-amber-950/60 border-amber-800/50'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                {isConnected ? 'CONNECTED' : 'OFFLINE'}
              </span>
            </div>
            <div>
              <div className="text-xs font-mono font-bold text-slate-200">{deviceIp}</div>
              <div className="text-[11px] text-slate-400 font-mono mt-0.5">Port: {devicePort}</div>
            </div>
          </div>
        </div>

        {/* ── TAB 1: GATE CONTROL CONTROLLER ── */}
        {/* ENROLLMENT TYPE (Hikvision: face or fingerprint) */}
        {(activeTab === 'enroll' || activeTab === 'employee') && (
          <div className="flex items-center justify-center gap-2">
            {(['FACE', 'FINGERPRINT'] as const).map(k => (
              <button
                key={k}
                onClick={() => setEnrollKind(k)}
                className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase border-none cursor-pointer transition-all ${enrollKind === k ? 'bg-orange-500 text-white' : 'bg-slate-800 text-slate-300 hover:text-white'}`}
              >
                {k === 'FACE' ? 'Face' : 'Fingerprint'}
              </button>
            ))}
          </div>
        )}

        {activeTab === 'gate' && (
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-6 text-center shadow-2xl space-y-6">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-slate-400 uppercase tracking-wider">
                Physical Gate Actuator
              </h2>
              <p className="text-xs text-slate-500">
                Sends direct hardware relay unlock command to Hikvision terminal ({deviceIp})
              </p>
            </div>

            <button
              onClick={handleOpenGate}
              disabled={isOpening}
              className={`w-full py-8 px-6 rounded-2xl font-black text-xl tracking-wide uppercase shadow-2xl transition-all duration-200 border-none cursor-pointer flex flex-col items-center justify-center gap-3 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
                isOpening
                  ? 'bg-amber-600 text-white shadow-amber-900/40 animate-pulse'
                  : 'bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white shadow-orange-900/50'
              }`}
            >
              <div className={`w-16 h-16 rounded-full bg-white/10 flex items-center justify-center ${isOpening ? 'animate-spin' : ''}`}>
                <Unlock size={36} />
              </div>
              <span>{isOpening ? 'Opening Gate...' : '🔓 OPEN GATE'}</span>
            </button>

            {lastResult && (
              <div className={`p-4 rounded-2xl text-left border space-y-1.5 ${
                lastResult.success
                  ? 'bg-emerald-950/40 border-emerald-600/40 text-emerald-200'
                  : 'bg-rose-950/40 border-rose-600/40 text-rose-200'
              }`}>
                <div className="flex items-center justify-between">
                  <div className="font-extrabold text-sm flex items-center gap-2">
                    {lastResult.success ? <CheckCircle2 className="text-emerald-400 shrink-0" size={18} /> : <AlertTriangle className="text-rose-400 shrink-0" size={18} />}
                    {lastResult.title}
                  </div>
                  <span className="font-mono text-[11px] opacity-75">{lastResult.timestamp}</span>
                </div>
                <div className="text-xs opacity-90 pl-6 font-medium">{lastResult.message}</div>
                <div className="text-[10px] opacity-60 font-mono pl-6 pt-1">Device Target: {lastResult.deviceIp}</div>
              </div>
            )}
          </div>
        )}

        {/* ── TAB 2: ENROLL CLIENT MODULE ── */}
        {activeTab === 'enroll' && (
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-6 shadow-2xl space-y-5">
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                <Fingerprint className="text-orange-400" size={20} /> Enroll Client Fingerprint
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Select a CRM member to map their permanent Biometric ID to physical scanner
              </p>
            </div>

            {/* SEARCH & FILTER CONTROLS */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by member ID, biometric ID, name, or phone..."
                  className="w-full h-11 bg-slate-800/90 border border-slate-700 rounded-2xl pl-10 pr-4 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                />
              </div>

                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 bg-slate-800/60 p-1 rounded-xl border border-slate-700/60">
                  <button
                      onClick={() => setStatusFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all border-none cursor-pointer ${
                      statusFilter === 'pending'
                        ? 'bg-amber-500 text-slate-950 font-extrabold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Pending ({members.filter((m: any) => !isFingerprintEnrolled(m)).length})
                  </button>

                  <button
                    onClick={() => setStatusFilter('enrolled')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all border-none cursor-pointer ${
                      statusFilter === 'enrolled'
                        ? 'bg-emerald-500 text-slate-950 font-extrabold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Enrolled ({members.filter((m: any) => isFingerprintEnrolled(m)).length})
                  </button>

                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all border-none cursor-pointer ${
                      statusFilter === 'all'
                        ? 'bg-orange-600 text-white font-extrabold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({members.length})
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400 font-mono">Showing {filteredMembers.length} members</span>
                  <button
                    type="button"
                    onClick={refreshMembers}
                    disabled={refreshingMembers}
                    className="px-3 py-1.5 rounded-lg text-[11px] font-black uppercase bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700 disabled:opacity-50 inline-flex items-center gap-1.5"
                  >
                    <RefreshCw size={12} className={refreshingMembers ? 'animate-spin' : ''} />
                    {refreshingMembers ? 'Refreshing' : 'Refresh'}
                  </button>
                </div>
              </div>
            </div>

            {/* FINGERPRINT ENROLLMENT PROGRESS & STATE MACHINE BANNER */}
            {enrollState !== 'NOT_ENROLLED' && selectedMember && (
              <div className="p-4 bg-slate-800 border border-orange-500/40 rounded-2xl space-y-3 animate-in fade-in duration-300">
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping" />
                    <span className="text-xs font-black uppercase text-white tracking-wider">
                      Selected Member: #{selectedMember.biometricId || selectedMember.memberId} — {selectedMember.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-orange-400 bg-orange-950 border border-orange-800 px-2 py-0.5 rounded-md">
                    STATE: {enrollState}
                  </span>
                </div>

                <div className="text-xs font-semibold text-slate-300">
                  {enrollMsg}
                </div>

                {/* VISUAL SCAN STEP INDICATORS */}
                <div className="grid grid-cols-4 gap-2 pt-1 text-center text-[10px] font-mono font-bold">
                  <div className={`p-2 rounded-xl border ${enrollState === 'SCANNING_1' || enrollState === 'SCANNING_2' || enrollState === 'SCANNING_3' || enrollState === 'ENROLLMENT_SUCCESS' || enrollState === 'COMPLETED' ? 'bg-orange-900/60 border-orange-500 text-orange-300' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                    SCAN 1
                  </div>
                  <div className={`p-2 rounded-xl border ${enrollState === 'SCANNING_2' || enrollState === 'SCANNING_3' || enrollState === 'ENROLLMENT_SUCCESS' || enrollState === 'COMPLETED' ? 'bg-orange-900/60 border-orange-500 text-orange-300' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                    SCAN 2
                  </div>
                  <div className={`p-2 rounded-xl border ${enrollState === 'SCANNING_3' || enrollState === 'ENROLLMENT_SUCCESS' || enrollState === 'COMPLETED' ? 'bg-orange-900/60 border-orange-500 text-orange-300' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                    DEVICE
                  </div>
                  <div className={`p-2 rounded-xl border ${enrollState === 'ENROLLMENT_SUCCESS' || enrollState === 'COMPLETED' ? 'bg-emerald-900/60 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                    MAPPED ✓
                  </div>
                </div>
              </div>
            )}

            {/* MEMBERS LIST TABLE */}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {filteredMembers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-800/40 rounded-2xl border border-slate-800">
                  No members found matching selected status & search keyword.
                </div>
              ) : (
                filteredMembers.map((m: any) => {
                  const bioId = getCleanNumericId(m);
                  const isEnrolled = enrollKind === 'FACE' ? isFaceEnrolled(m) : isFingerprintEnrolled(m);
                  const isSelected = selectedMember?.id === m.id;

                  return (
                    <div
                      key={m.id || bioId}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-orange-950/40 border-orange-500/80 shadow-md'
                          : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center font-mono text-sm font-black text-orange-400 shrink-0">
                          #{bioId}
                        </div>
                        <div>
                          <div className="text-xs font-black text-white flex items-center gap-2">
                            <span>{m.name}</span>
                            <span className="text-[10px] font-mono text-slate-400">({m.phone})</span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>{m.plan || 'Standard'}</span>
                            <span>•</span>
                            <span className={isEnrolled ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                              {isEnrolled ? '✓ Fingerprint Enrolled' : 'Fingerprint Pending'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleStartEnrollment(m)}
                        disabled={!!enrollingMemberId}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer inline-flex items-center gap-1.5 active:scale-95 disabled:opacity-50 ${
                          isEnrolled
                            ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                            : 'bg-orange-600 hover:bg-orange-500 text-white border-orange-500 shadow-md shadow-orange-900/40'
                        }`}
                      >
                        <Fingerprint size={14} />
                        <span>{enrollingMemberId === String(m.id) ? 'Enrolling...' : isEnrolled ? 'Re-Enroll' : 'Start Enroll'}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: ENROLL EMPLOYEE MODULE ── */}
        {activeTab === 'employee' && (
          <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-3xl p-6 shadow-2xl space-y-5">
            <div>
              <h2 className="text-lg font-black text-white uppercase tracking-tight flex items-center gap-2">
                <User className="text-purple-400" size={20} /> Enroll Employee Biometric
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Select staff member to map their biometric ID to physical scanner
              </p>
            </div>

            {/* SEARCH & FILTER CONTROLS */}
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input
                  type="text"
                  value={empSearchQuery}
                  onChange={(e) => setEmpSearchQuery(e.target.value)}
                  placeholder="Search staff by Biometric ID, Name, Role, or Phone..."
                  className="w-full h-11 bg-slate-800/90 border border-slate-700 rounded-2xl pl-10 pr-4 text-xs font-bold text-white placeholder-slate-500 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 bg-slate-800/60 p-1 rounded-xl border border-slate-700/60">
                  <button
                    onClick={() => setEmpStatusFilter('pending')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all border-none cursor-pointer ${
                      empStatusFilter === 'pending'
                        ? 'bg-amber-500 text-slate-950 font-extrabold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Pending ({employees.filter((e: any) => !(enrollKind === 'FACE' ? isFaceEnrolled(e) : isFingerprintEnrolled(e))).length})
                  </button>

                  <button
                    onClick={() => setEmpStatusFilter('enrolled')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all border-none cursor-pointer ${
                      empStatusFilter === 'enrolled'
                        ? 'bg-emerald-500 text-slate-950 font-extrabold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Enrolled ({employees.filter((e: any) => (enrollKind === 'FACE' ? isFaceEnrolled(e) : isFingerprintEnrolled(e))).length})
                  </button>

                  <button
                    onClick={() => setEmpStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-black uppercase transition-all border-none cursor-pointer ${
                      empStatusFilter === 'all'
                        ? 'bg-purple-600 text-white font-extrabold'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    All ({employees.length})
                  </button>
                </div>

                <span className="text-[11px] text-slate-400 font-mono">
                  Showing {filteredEmployees.length} staff
                </span>
              </div>
            </div>

            {/* FINGERPRINT ENROLLMENT PROGRESS & STATE MACHINE BANNER */}
            {enrollState !== 'NOT_ENROLLED' && selectedEmployee && (
              <div className="p-4 bg-slate-800 border border-purple-500/40 rounded-2xl space-y-3 animate-in fade-in duration-300">
                <div className="flex items-center justify-between border-b border-slate-700 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500 animate-ping" />
                    <span className="text-xs font-black uppercase text-white tracking-wider">
                      Selected Staff: #{selectedEmployee.biometricId || selectedEmployee.id} — {selectedEmployee.name}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-950 border border-purple-800 px-2 py-0.5 rounded-md">
                    STATE: {enrollState}
                  </span>
                </div>

                <div className="text-xs font-semibold text-slate-300">
                  {enrollMsg}
                </div>

                {/* VISUAL SCAN STEP INDICATORS */}
                <div className="grid grid-cols-4 gap-2 pt-1 text-center text-[10px] font-mono font-bold">
                  <div className={`p-2 rounded-xl border ${enrollState === 'SCANNING_1' || enrollState === 'SCANNING_2' || enrollState === 'SCANNING_3' || enrollState === 'ENROLLMENT_SUCCESS' || enrollState === 'COMPLETED' ? 'bg-purple-900/60 border-purple-500 text-purple-300' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                    SCAN 1
                  </div>
                  <div className={`p-2 rounded-xl border ${enrollState === 'SCANNING_2' || enrollState === 'SCANNING_3' || enrollState === 'ENROLLMENT_SUCCESS' || enrollState === 'COMPLETED' ? 'bg-purple-900/60 border-purple-500 text-purple-300' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                    SCAN 2
                  </div>
                  <div className={`p-2 rounded-xl border ${enrollState === 'SCANNING_3' || enrollState === 'ENROLLMENT_SUCCESS' || enrollState === 'COMPLETED' ? 'bg-purple-900/60 border-purple-500 text-purple-300' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                    SCAN 3
                  </div>
                  <div className={`p-2 rounded-xl border ${enrollState === 'ENROLLMENT_SUCCESS' || enrollState === 'COMPLETED' ? 'bg-emerald-900/60 border-emerald-500 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-600'}`}>
                    MAPPED ✓
                  </div>
                </div>
              </div>
            )}

            {/* EMPLOYEES LIST TABLE */}
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {filteredEmployees.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-500 bg-slate-800/40 rounded-2xl border border-slate-800">
                  No staff members found matching selected status & search keyword.
                </div>
              ) : (
                filteredEmployees.map((e: any) => {
                  const bioId = getCleanNumericId(e);
                  const isEnrolled = enrollKind === 'FACE' ? isFaceEnrolled(e) : isFingerprintEnrolled(e);
                  const isSelected = selectedEmployee?.id === e.id;

                  return (
                    <div
                      key={e.id || bioId}
                      className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                        isSelected
                          ? 'bg-purple-950/40 border-purple-500/80 shadow-md'
                          : 'bg-slate-800/60 border-slate-700/60 hover:bg-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-700 flex items-center justify-center font-mono text-sm font-black text-purple-400 shrink-0">
                          #{bioId}
                        </div>
                        <div>
                          <div className="text-xs font-black text-white flex items-center gap-2">
                            <span>{e.name}</span>
                            <span className="text-[10px] font-mono text-purple-300">({e.role || 'Staff'})</span>
                          </div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                            <span>{e.phone || 'No phone'}</span>
                            <span>•</span>
                            <span className={isEnrolled ? 'text-emerald-400 font-bold' : 'text-amber-400 font-bold'}>
                              {isEnrolled ? '✓ Fingerprint Enrolled' : 'Fingerprint Pending'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => handleStartEmployeeEnrollment(e)}
                        disabled={enrollState === 'ENROLLMENT_REQUESTED' || enrollState === 'SCANNING_1' || enrollState === 'SCANNING_2' || enrollState === 'SCANNING_3'}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all border cursor-pointer inline-flex items-center gap-1.5 active:scale-95 disabled:opacity-50 ${
                          isEnrolled
                            ? 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                            : 'bg-purple-600 hover:bg-purple-500 text-white border-purple-500 shadow-md shadow-purple-900/40'
                        }`}
                      >
                        <Fingerprint size={14} />
                        <span>{isEnrolled ? 'Re-Enroll' : 'Start Enroll'}</span>
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* FOOTER & ACCESS URL */}
        <div className="text-center text-[11px] text-slate-500 font-mono space-y-1">
          <div>Gym LAN Access URL: <span className="text-orange-400 font-bold">{accessUrl}</span></div>
          <div>Target Hardware: Hikvision {deviceIp}:{devicePort}</div>
        </div>

      </div>

    </div>
  );
}
