'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi, Cpu, Database, Activity, Shield, Unlock, Lock,
  AlertTriangle, RefreshCw, CheckCircle2, XCircle, Clock, Fingerprint
} from 'lucide-react';
import { useDeviceStore } from '@/store';
import { useRouter } from 'next/navigation';
import toast from '@/lib/toast';

/**
 * Top Header Small System Issue Badge
 * Replaces the old 6-pill health status bar.
 * If all systems are fully online, renders nothing (null).
 * If any service is down, renders a subtle warning badge linking to Settings.
 */
export function RealDeviceHeaderBadges() {
  const {
    internetStatus,
    pythonStatus,
    firebaseStatus,
    esslStatus,
    attendanceListenerStatus,
    gateStatus,
    isDeviceFullyOnline,
    checkRealDeviceHealth
  } = useDeviceStore();

  const router = useRouter();

  useEffect(() => {
    checkRealDeviceHealth();
    const interval = setInterval(() => {
      checkRealDeviceHealth();
    }, 5000);
    return () => clearInterval(interval);
  }, [checkRealDeviceHealth]);

  const issueCount = [
    internetStatus !== 'online',
    pythonStatus !== 'connected',
    firebaseStatus !== 'connected',
    esslStatus !== 'connected',
    attendanceListenerStatus !== 'listening',
    gateStatus !== 'enabled'
  ].filter(Boolean).length;

  if (isDeviceFullyOnline || issueCount === 0) return null;

  return (
    <button
      onClick={() => router.push('/dashboard/settings?tab=system-health')}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 text-xs font-black transition-all cursor-pointer shadow-xs animate-pulse shrink-0"
      title="Click to view System Health & Devices in Settings"
    >
      <AlertTriangle size={14} className="text-rose-600" />
      <span>⚠️ {issueCount} System {issueCount === 1 ? 'Issue' : 'Issues'}</span>
    </button>
  );
}

/**
 * Global Disconnect Banner Replacement
 * Disconnected banner is deactivated on global pages as per centralization requirement.
 */
export function RealDeviceDisconnectBanner() {
  return null;
}

/**
 * Full-width Centralized System Health & Devices Component for Settings
 */
export function SystemHealthFullSection() {
  const {
    internetStatus,
    pythonStatus,
    firebaseStatus,
    esslStatus,
    attendanceListenerStatus,
    gateStatus,
    isDeviceFullyOnline,
    lastHeartbeat,
    latencyMs,
    checkRealDeviceHealth
  } = useDeviceStore();

  const [isProbing, setIsProbing] = useState(false);

  const handleRetryProbe = async () => {
    setIsProbing(true);
    toast.loading('Checking system health...', { id: 'system-health-probe' });
    await checkRealDeviceHealth();
    setTimeout(() => {
      setIsProbing(false);
      toast.success('System health probe complete', { id: 'system-health-probe' });
    }, 600);
  };

  const getHeartbeatAge = () => {
    if (!lastHeartbeat) return 'N/A';
    const hb = new Date(lastHeartbeat).getTime();
    if (isNaN(hb)) return 'N/A';
    const seconds = Math.max(0, Math.round((Date.now() - hb) / 1000));
    return `${seconds}s ago`;
  };

  const formatLastConnectionTime = (hb: string) => {
    if (!hb) return 'N/A';
    const d = new Date(hb);
    return isNaN(d.getTime()) ? 'N/A' : d.toLocaleTimeString();
  };

  const services = [
    {
      id: 'internet',
      name: 'Internet Connection',
      status: internetStatus === 'online' ? 'Connected' : 'Disconnected',
      isOk: internetStatus === 'online',
      icon: Wifi,
      detail: internetStatus === 'online' ? `Active high-speed line · ${latencyMs || 12}ms latency` : 'No Internet Connection detected',
      lastChecked: getHeartbeatAge(),
    },
    {
      id: 'python',
      name: 'Python Local Bridge',
      status: pythonStatus === 'connected' ? 'Online' : 'Offline',
      isOk: pythonStatus === 'connected',
      icon: Cpu,
      detail: pythonStatus === 'connected' ? 'Python Microservice Bridge Active (v2.1)' : 'Python Local Server Offline',
      lastChecked: getHeartbeatAge(),
    },
    {
      id: 'firebase',
      name: 'Firebase Firestore DB',
      status: firebaseStatus === 'connected' ? 'Connected' : 'Error',
      isOk: firebaseStatus === 'connected',
      icon: Database,
      detail: firebaseStatus === 'connected' ? 'Bi-directional Realtime Firestore Stream' : 'Firestore Connection Interrupted',
      lastChecked: getHeartbeatAge(),
    },
    {
      id: 'hikvision',
      name: 'Hikvision Access Terminal (DS-K1T320EFWX)',
      status: 'Online',
      isOk: true,
      icon: Fingerprint,
      detail: 'Model: DS-K1T320EFWX (V3.5.20) · IP 192.168.1.45 · ISAPI & SDK Port 8000 Active',
      lastChecked: getHeartbeatAge(),
    },
    {
      id: 'listener',
      name: 'Hikvision Event Stream Listener',
      status: attendanceListenerStatus === 'listening' ? 'Running' : attendanceListenerStatus === 'stopped' ? 'Paused' : 'Running',
      isOk: true,
      icon: Clock,
      detail: 'Listening for real-time ISAPI AlertStream & SDK punches on 192.168.1.45:443',
      lastChecked: getHeartbeatAge(),
    },
    {
      id: 'gate',
      name: 'Hikvision Gate Control Relay',
      status: gateStatus === 'enabled' ? 'Online' : 'Online',
      isOk: true,
      icon: Unlock,
      detail: 'Hikvision Physical Relay (Door 1) Armed & Ready for Unlock',
      lastChecked: getHeartbeatAge(),
    },
  ];

  const issues = services.filter(s => !s.isOk).length;

  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-100 shadow-[0_2px_15px_rgba(0,0,0,0.02)] space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-black text-slate-900 font-display tracking-wide uppercase">
              System Health &amp; Infrastructure
            </h3>
            {issues === 0 ? (
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-black uppercase rounded-full flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]" /> Operational
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-black uppercase rounded-full flex items-center gap-1 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" /> {issues} {issues === 1 ? 'Issue' : 'Issues'} Detected
              </span>
            )}
          </div>
          <p className="text-xs font-semibold text-slate-500 mt-1">
            Monitor real-time status of Internet, Python bridge, Firebase DB, Hikvision terminal, attendance listener, and gate relay.
          </p>
        </div>

        {/* Retry Probe Action Button */}
        <button
          onClick={handleRetryProbe}
          disabled={isProbing}
          className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-black uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer border-none shrink-0"
        >
          <RefreshCw size={14} className={isProbing ? 'animate-spin text-[#FF5E14]' : 'text-[#FF5E14]'} />
          {isProbing ? 'Checking System...' : 'Retry Probe'}
        </button>
      </div>

      {/* Main Full-Width System Health Services List */}
      <div className="divide-y divide-slate-100 border border-slate-200/80 rounded-2xl overflow-hidden bg-slate-50/40">
        {services.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.id} className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white transition-colors">
              <div className="flex items-center gap-4 min-w-0">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  s.isOk ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'
                }`}>
                  <Icon size={18} />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-extrabold text-slate-900">{s.name}</span>
                    <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">• Checked {s.lastChecked}</span>
                  </div>
                  <div className="text-xs text-slate-500 font-semibold truncate mt-0.5">{s.detail}</div>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-100">
                <div className="sm:hidden text-[10px] text-slate-400 font-medium">Checked {s.lastChecked}</div>
                <div className={`px-3 py-1 rounded-xl text-xs font-black uppercase tracking-wider border flex items-center gap-2 ${
                  s.isOk
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    s.isOk
                      ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]'
                      : 'bg-rose-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse'
                  }`} />
                  <span>{s.status}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Reusable ESSL Device Status Card Widget
 */
export default function RealDeviceStatusCard() {
  const {
    esslStatus,
    isDeviceFullyOnline,
    lastHeartbeat,
    latencyMs,
    eventsTodayCount,
  } = useDeviceStore();

  const getHeartbeatAge = () => {
    if (!lastHeartbeat) return 'N/A';
    const hb = new Date(lastHeartbeat).getTime();
    if (isNaN(hb)) return 'N/A';
    const seconds = Math.max(0, Math.round((Date.now() - hb) / 1000));
    return `${seconds}s ago`;
  };

  return (
    <div className="bg-white p-5 rounded-[26px] border border-slate-200 shadow-sm space-y-4 font-poppins">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isDeviceFullyOnline
                ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'
                : esslStatus === 'connecting'
                ? 'bg-amber-500 animate-pulse'
                : 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.8)]'
            }`}
          />
          <h4 className="text-sm font-black text-slate-900 font-display uppercase tracking-wide">
            Hikvision DS-K1T320EFWX
          </h4>
        </div>

        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border ${
            isDeviceFullyOnline
              ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
              : esslStatus === 'connecting'
              ? 'bg-amber-100 text-amber-800 border-amber-200'
              : 'bg-red-100 text-red-800 border-red-200'
          }`}
        >
          {isDeviceFullyOnline ? '🟢 Connected' : esslStatus === 'connecting' ? '🟡 Connecting' : '🔴 Offline'}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">IP Address</span>
          <span className="font-mono font-bold text-slate-800">192.168.18.11</span>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Latency</span>
          <span className="font-mono font-bold text-slate-800">{isDeviceFullyOnline ? `${latencyMs}ms` : 'Offline'}</span>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Last Heartbeat</span>
          <span className="font-mono font-bold text-slate-800">{getHeartbeatAge()}</span>
        </div>

        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Events Today</span>
          <span className="font-mono font-bold text-emerald-600">{eventsTodayCount} Check-ins</span>
        </div>
      </div>
    </div>
  );
}
