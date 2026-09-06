'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, Play, Fingerprint, AlertTriangle, CheckCircle, Info, Ban, Zap, Clock, Key,
  Shield, Lock, Unlock, Wifi, WifiOff, RefreshCw, User, Database, ArrowLeft, Terminal, Users, ListCollapse, Check, X, Server, AlertCircle, Cpu, Upload
} from 'lucide-react';
import API from '@/services/api';
import toast from '@/lib/toast';
import { useRouter } from 'next/navigation';

interface UserInfo {
  userId: string;
  name: string;
  privilege: number;
  enrollmentStatus: string;
}

interface AttendanceLog {
  userId: string;
  timestamp: string;
  punchType: number;
}

interface PunchDetails {
  biometricId: string;
  timestamp: string;
  device: string;
  syncResult: string;
}

interface ImportStats {
  total: number;
  imported: number;
  skipped: number;
  duplicates: number;
}

interface TestControl {
  ip: string;
  port: number;
  status: string; // Connected / Disconnected
  pingStatus?: string; // Success / Failed
  tcpStatus?: string; // Success / Failed
  usersCount?: number;
  attendanceCount?: number;
  firebaseSyncStatus?: string; // Success / Failed
  lastPunch?: string;
  lastUserRead?: string;
  lastError?: string | null;
  lastPunchDetails?: PunchDetails | null;
  testLogs?: string[];
  usersList?: UserInfo[];
  attendanceLogs?: AttendanceLog[];
  deviceName?: string;
  firmwareVersion?: string;
  serialNumber?: string;
  platform?: string;
  deviceTime?: string;
  lastSyncTime?: string | null;
  importUsersPending?: boolean;
  importStatus?: 'idle' | 'processing' | 'completed' | 'failed';
  importProgress?: number;
  importStats?: ImportStats;
}

export default function DeviceDiagnosticsPage() {
  const router = useRouter();
  const [controlData, setControlData] = useState<TestControl | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'logs' | 'users' | 'attendance'>('logs');
  const [previousPunchTime, setPreviousPunchTime] = useState<string | null>(null);
  const [highlightPunch, setHighlightPunch] = useState(false);

  const fetchTestingStatus = async () => {
    try {
      const res = await API.get('/devices/testing/status');
      setControlData(res.data);
      setLoading(false);
      
      // Highlight live punch monitor when a new punch comes in
      const currentPunchDetails = res.data.lastPunchDetails;
      if (currentPunchDetails && currentPunchDetails.timestamp) {
        if (previousPunchTime && currentPunchDetails.timestamp !== previousPunchTime) {
          setHighlightPunch(true);
          setTimeout(() => setHighlightPunch(false), 2000);
        }
        setPreviousPunchTime(currentPunchDetails.timestamp);
      }
    } catch (err: any) {
      console.error('Failed to fetch diagnostics status:', err);
    }
  };

  useEffect(() => {
    fetchTestingStatus();
    const interval = setInterval(fetchTestingStatus, 1500); // Poll every 1.5 seconds for snappy updates
    return () => clearInterval(interval);
  }, [previousPunchTime]);

  const triggerAction = async (action: 'connect' | 'read-users' | 'read-attendance' | 'sync-firebase' | 'import-users', label: string) => {
    setRunningAction(action);
    toast.loading(`Triggering ${label} on terminal...`, { id: 'trigger_toast' });
    try {
      await API.post(`/devices/testing/${action}`);
      toast.success(`${label} instruction queued. Python service processing...`, { id: 'trigger_toast' });
      // Refresh status immediately
      fetchTestingStatus();
    } catch (err: any) {
      toast.error(`Failed to trigger ${label}: ` + (err.response?.data?.error || err.message), { id: 'trigger_toast' });
    } finally {
      setTimeout(() => setRunningAction(null), 1000);
    }
  };

  if (loading || !controlData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#0052FF] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-semibold text-zinc-400">Loading Device Diagnostics Panel...</p>
        </div>
      </div>
    );
  }

  // Strict connected status evaluation criteria
  const hasUsers = (controlData.usersCount ?? 0) > 0;
  const hasAttendance = (controlData.attendanceCount ?? 0) > 0;
  const syncSuccessful = controlData.firebaseSyncStatus === 'Success';
  const pingOk = controlData.pingStatus === 'Success';
  const tcpOk = controlData.tcpStatus === 'Success';

  const isVerifiedConnected = hasUsers && hasAttendance && syncSuccessful && pingOk && tcpOk;

  return (
    <div className="space-y-8 pb-12 text-slate-100">
      
      {/* Header and Back Button */}
      <div className="border-b border-zinc-800/80 pb-5">
        <button 
          onClick={() => router.push('/dashboard/settings')}
          className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-all mb-4 cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to Settings
        </button>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black text-white tracking-tight font-display flex items-center gap-2">
              <Cpu className="text-[#EA580C] animate-pulse" size={30} /> Device Diagnostics
            </h1>
            <p className="text-xs text-zinc-400 mt-1">Verify hardware socket handshakes, roster downloads, database audits, and real-time attendance streams.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className={`px-4 py-2 rounded-2xl border flex items-center gap-2 font-display text-sm font-black ${
              isVerifiedConnected 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                : 'bg-red-500/10 text-red-400 border-red-500/30'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${isVerifiedConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500 animate-pulse'}`} />
              Device Status: {isVerifiedConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>
        </div>
      </div>

      {/* Main Stats and Configurations Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Device Information Card */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-5 border border-zinc-800/60 bg-zinc-950/40">
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block font-display mb-3">Hikvision DS-K1T320EFWX Configuration</span>
          <div className="space-y-3 font-mono text-xs">
            <div className="flex justify-between border-b border-zinc-900 pb-1.5">
              <span className="text-zinc-500">Device IP</span>
              <span className="text-white font-bold">{controlData.ip || '192.168.1.45'}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-900 pb-1.5">
              <span className="text-zinc-500">Port</span>
              <span className="text-white font-bold">{controlData.port || 4370}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-900 pb-1.5">
              <span className="text-zinc-500">Name</span>
              <span className="text-zinc-300">{controlData.deviceName || 'Main Gate'}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-900 pb-1.5">
              <span className="text-zinc-500">Firmware</span>
              <span className="text-zinc-300">{controlData.firmwareVersion || 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Serial No</span>
              <span className="text-zinc-300 truncate max-w-[150px]">{controlData.serialNumber || 'N/A'}</span>
            </div>
          </div>
        </motion.div>

        {/* Verification Checkpoints Card */}
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-5 border border-zinc-800/60 bg-zinc-950/40">
          <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block font-display mb-3">Verification Audit Checklist</span>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 flex items-center gap-1.5">
                <Wifi size={13} className="text-zinc-500" /> Ping Test
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                pingOk ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {pingOk ? 'Success' : 'Failed'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 flex items-center gap-1.5">
                <Activity size={13} className="text-zinc-500" /> TCP Port Test
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                tcpOk ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {tcpOk ? 'Success' : 'Failed'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 flex items-center gap-1.5">
                <Users size={13} className="text-zinc-500" /> Read Users
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                hasUsers ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {hasUsers ? `Users Found: ${controlData.usersCount}` : 'Users Found: 0'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 flex items-center gap-1.5">
                <Database size={13} className="text-zinc-500" /> Read Attendance Logs
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                hasAttendance ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {hasAttendance ? `${controlData.attendanceCount} Records Found` : '0 Records Found'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-zinc-300 flex items-center gap-1.5">
                <Zap size={13} className="text-zinc-500" /> Firebase Sync
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                syncSuccessful ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'
              }`}>
                {syncSuccessful ? 'Successful' : 'Failed'}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Live Punch Monitor Card */}
        <motion.div 
          initial={{ opacity: 0, y: 15 }} 
          animate={{ opacity: 1, y: 0 }} 
          transition={{ delay: 0.1 }}
          className={`glass-card p-5 border transition-all duration-300 ${
            highlightPunch 
              ? 'border-emerald-500/80 bg-emerald-950/20 shadow-[0_0_20px_rgba(16,185,129,0.2)]' 
              : 'border-zinc-800/60 bg-zinc-950/40'
          }`}
        >
          <div className="flex justify-between items-center mb-3">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block font-display">Live Punch Monitor</span>
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          
          {controlData.lastPunchDetails ? (
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 font-mono">Biometric ID</span>
                <span className="text-white font-bold font-mono text-sm bg-zinc-900/80 px-2 py-0.5 rounded">
                  {controlData.lastPunchDetails.biometricId}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 font-mono">Timestamp</span>
                <span className="text-zinc-300 font-semibold">{controlData.lastPunchDetails.timestamp}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-zinc-500 font-mono">Device</span>
                <span className="text-zinc-300 font-semibold">{controlData.lastPunchDetails.device}</span>
              </div>
              <div className="flex justify-between text-xs items-center">
                <span className="text-zinc-500 font-mono">Sync Result</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                  controlData.lastPunchDetails.syncResult === 'Success' 
                    ? 'bg-emerald-500/20 text-emerald-400' 
                    : 'bg-red-500/20 text-red-400'
                }`}>
                  Attendance Received
                </span>
              </div>
            </div>
          ) : (
            <div className="h-28 flex flex-col items-center justify-center text-zinc-500 text-xs italic gap-2">
              <Fingerprint size={28} className="text-zinc-600 animate-pulse" />
              <span>Tap device fingerprint sensor...</span>
            </div>
          )}
        </motion.div>
      </div>

      {/* Main Grid: Controls and Outputs */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Buttons and Logs Meta Side Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="glass-card p-5 border border-zinc-800/60 bg-zinc-950/40">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block font-display mb-4">Diagnostics Tools</span>
            
            <div className="space-y-3">
              <button
                onClick={() => triggerAction('connect', 'Test Connection')}
                disabled={runningAction !== null}
                className="w-full py-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <Wifi size={13} className="text-emerald-500" /> Test Connection
              </button>

              <button
                onClick={() => triggerAction('read-users', 'Read Users')}
                disabled={runningAction !== null}
                className="w-full py-3 rounded-2xl bg-brand-cyan text-slate-950 font-black transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 hover:brightness-115"
              >
                <Users size={13} /> Read Users
              </button>

              <button
                onClick={() => triggerAction('read-attendance', 'Read Attendance')}
                disabled={runningAction !== null}
                className="w-full py-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <Database size={13} className="text-brand-purple" /> Read Attendance Logs
              </button>

              <button
                onClick={() => triggerAction('sync-firebase', 'Sync Firebase')}
                disabled={runningAction !== null}
                className="w-full py-3 rounded-2xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-white text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40"
              >
                <Zap size={13} className="text-amber-400" /> Sync Firebase
              </button>
            </div>
            
            <div className="mt-5 border-t border-zinc-900 pt-4 space-y-3 font-mono text-[10px] text-zinc-400">
              <div>
                <div className="text-[9px] font-bold text-zinc-500 uppercase">Last Attendance Time</div>
                <div className="text-zinc-300 font-bold mt-0.5 flex items-center gap-1.5">
                  <Clock size={11} className="text-[#F97316]" />
                  {controlData.lastPunch || 'Not Available'}
                </div>
              </div>
              <div>
                <div className="text-[9px] font-bold text-zinc-500 uppercase">Last User Read</div>
                <div className="text-zinc-300 font-bold mt-0.5 flex items-center gap-1.5">
                  <User size={11} className="text-violet-500" />
                  ID: {controlData.lastUserRead || 'None'}
                </div>
              </div>
            </div>
          </div>

          {/* Import Users Card */}
          <div className="glass-card p-5 border border-zinc-800/60 bg-zinc-950/40">
            <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest block font-display mb-4">Device Roster Import</span>
            
            {controlData.importStatus === 'processing' ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-medium animate-pulse">Importing users...</span>
                  <span className="text-[#EA580C] font-bold">{controlData.importProgress ?? 0}%</span>
                </div>
                {/* Progress bar */}
                <div className="w-full bg-zinc-900 rounded-full h-1.5 overflow-hidden">
                  <motion.div 
                    className="bg-brand-cyan h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${controlData.importProgress ?? 0}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                {/* Stats */}
                <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-zinc-400 mt-2">
                  <div>Total: <span className="text-white">{controlData.importStats?.total ?? 0}</span></div>
                  <div>Imported: <span className="text-emerald-400">{controlData.importStats?.imported ?? 0}</span></div>
                  <div>Duplicates: <span className="text-amber-400">{controlData.importStats?.duplicates ?? 0}</span></div>
                  <div>Skipped: <span className="text-zinc-500">{controlData.importStats?.skipped ?? 0}</span></div>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => triggerAction('import-users', 'User Roster Import')}
                  disabled={runningAction !== null}
                  className="w-full py-3 rounded-2xl bg-white text-black hover:bg-zinc-200 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 animate-pulse border-none shadow-[0_0_10px_rgba(255,255,255,0.1)]"
                >
                  <Upload size={13} /> Import Users From Device
                </button>
                
                {controlData.importStatus === 'completed' && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-400 font-medium">
                    <div className="flex items-center gap-1.5 mb-1 font-bold">
                      <CheckCircle size={12} />
                      <span>Import Completed</span>
                    </div>
                    <p className="leading-snug">
                      Successfully imported {controlData.importStats?.imported ?? 0} members. Duplicates skipped: {controlData.importStats?.duplicates ?? 0}.
                    </p>
                  </div>
                )}
                {controlData.importStatus === 'failed' && (
                  <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-[10px] text-red-400 font-medium">
                    <div className="flex items-center gap-1.5 mb-1 font-bold">
                      <AlertTriangle size={12} />
                      <span>Import Failed</span>
                    </div>
                    <p className="leading-snug">Check diagnostics log for error details.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Last Error Box if exists */}
          {controlData.lastError && (
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-medium">
              <div className="flex gap-1.5 items-center mb-1.5 font-bold">
                <AlertCircle size={14} className="flex-shrink-0" />
                <span>Last Error Logged</span>
              </div>
              <div className="font-mono text-[10px] bg-black/40 p-2 rounded max-h-24 overflow-y-auto break-all">
                {controlData.lastError}
              </div>
            </div>
          )}
        </div>

        {/* Tab content panel */}
        <div className="lg:col-span-3 space-y-4">
          <div className="glass-card p-5 border border-zinc-800/60 bg-zinc-950/40 h-full flex flex-col justify-between">
            <div>
              {/* Tab Selector */}
              <div className="flex border-b border-zinc-900 pb-3 mb-4 justify-between items-center">
                <div className="flex gap-2">
                  {[
                    { id: 'logs', label: 'Terminal Logs', icon: Terminal },
                    { id: 'users', label: 'Device Users Roster', icon: Users },
                    { id: 'attendance', label: 'Attendance logs (First 20)', icon: ListCollapse }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      className={`px-3.5 py-1.5 rounded-xl text-xxs font-black uppercase tracking-wider flex items-center gap-1.5 transition-all border cursor-pointer border-none ${
                        activeTab === tab.id 
                          ? 'bg-brand-cyan text-slate-950 font-black shadow-sm' 
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <tab.icon size={11} />
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab Content */}
              <div className="min-h-[300px]">
                
                {/* 1. Terminal Logs Console */}
                {activeTab === 'logs' && (
                  <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-4 h-96 overflow-y-auto font-mono text-[10px] text-zinc-300 space-y-1.5">
                    {controlData.testLogs && controlData.testLogs.map((log, i) => {
                      let color = "text-zinc-300";
                      if (log.includes("[ERROR]")) color = "text-red-400";
                      if (log.includes("[SUCCESS]")) color = "text-emerald-400";
                      if (log.includes("[WARNING]")) color = "text-amber-400";
                      return (
                        <div key={i} className="flex items-start gap-1">
                          <span className="text-zinc-600 flex-shrink-0">&gt;</span>
                          <span className={color}>{log}</span>
                        </div>
                      );
                    })}
                    {(!controlData.testLogs || controlData.testLogs.length === 0) && (
                      <div className="h-full flex items-center justify-center text-zinc-600 italic">
                        No active testing session logs. Trigger one of the validation buttons to start.
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Device Users List */}
                {activeTab === 'users' && (
                  <div className="border border-zinc-900 bg-zinc-950 rounded-2xl overflow-hidden h-96 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-900 bg-zinc-900/50 text-zinc-400 uppercase text-[9px] tracking-wider">
                          <th className="p-3">User ID</th>
                          <th className="p-3">Name</th>
                          <th className="p-3">Privilege</th>
                          <th className="p-3">Enrollment Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/60">
                        {controlData.usersList && controlData.usersList.map((usr, i) => (
                          <tr key={i} className="hover:bg-zinc-900/40">
                            <td className="p-3 font-mono text-brand-cyan">{usr.userId}</td>
                            <td className="p-3 font-semibold text-white">{usr.name || 'N/A'}</td>
                            <td className="p-3 text-zinc-400">Privilege: {usr.privilege}</td>
                            <td className="p-3">
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                {usr.enrollmentStatus}
                              </span>
                            </td>
                          </tr>
                        ))}
                        {(!controlData.usersList || controlData.usersList.length === 0) && (
                          <tr>
                            <td colSpan={4} className="py-20 text-center text-xs text-zinc-500 italic">
                              No user records fetched yet. Click "Read Users".
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* 3. Attendance Logs */}
                {activeTab === 'attendance' && (
                  <div className="border border-zinc-900 bg-zinc-950 rounded-2xl overflow-hidden h-96 overflow-y-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-900 bg-zinc-900/50 text-zinc-400 uppercase text-[9px] tracking-wider">
                          <th className="p-3">User ID</th>
                          <th className="p-3">Timestamp</th>
                          <th className="p-3">Punch Type</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-900/60">
                        {controlData.attendanceLogs && controlData.attendanceLogs.map((log, i) => (
                          <tr key={i} className="hover:bg-zinc-900/40">
                            <td className="p-3 font-mono text-brand-cyan">{log.userId}</td>
                            <td className="p-3 font-mono text-zinc-300">{log.timestamp}</td>
                            <td className="p-3 text-zinc-400">Type: {log.punchType}</td>
                          </tr>
                        ))}
                        {(!controlData.attendanceLogs || controlData.attendanceLogs.length === 0) && (
                          <tr>
                            <td colSpan={3} className="py-20 text-center text-xs text-zinc-500 italic">
                              No attendance logs extracted yet. Click "Read Attendance Logs".
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

              </div>
            </div>
            
            <div className="pt-3 border-t border-zinc-900 mt-4 text-[9px] text-zinc-500 flex justify-between font-mono">
              <span>Firebase Tester Daemon: Connected (Active Sync)</span>
              <span className={isVerifiedConnected ? "text-emerald-500" : "text-red-500"}>
                {isVerifiedConnected ? "VERIFIED CONNECTED" : "UNVERIFIED STATUS"}
              </span>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
}
