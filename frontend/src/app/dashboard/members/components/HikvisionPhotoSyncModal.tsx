'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, Camera, RefreshCw, CheckCircle2, AlertTriangle, 
  Search, ShieldCheck, Cpu, ArrowRight, User, Sparkles, 
  HardDrive, Zap, Eye, Download, Image as ImageIcon
} from 'lucide-react';
import API from '@/services/api';
import toast from '@/lib/toast';
import { useGymStore } from '@/store';
import { resolveAvatarUrl } from '@/lib/avatar';

interface HikvisionPhotoSyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: () => void;
}

interface ManifestRow {
  memberId: string;
  memberName: string;
  biometricId: string;
  status: string;
  membershipStatus: string;
  existingPhotoUrl: string | null;
  photoSource: string | null;
  photoSyncedAt: string | null;
  machineEmployeeNo: string | null;
  machineName: string | null;
  machinePhotoAvailable: boolean;
  machineFaceURL: string | null;
  syncStatus: 'SYNCED' | 'ALREADY_EXISTS' | 'AVAILABLE_TO_SYNC' | 'NO_PHOTO' | 'ID_NOT_FOUND' | 'FAILED';
}

interface ManifestCounts {
  machineUsersFound: number;
  crmMembersFound: number;
  idMatched: number;
  photosAvailable: number;
  photosSynced: number;
  noPhoto: number;
  idNotFound: number;
  failed: number;
}

export default function HikvisionPhotoSyncModal({
  isOpen,
  onClose,
  onSyncComplete
}: HikvisionPhotoSyncModalProps) {
  const { fetchMembers } = useGymStore();

  const [loading, setLoading] = useState<boolean>(true);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncProgress, setSyncProgress] = useState<number>(0);
  const [syncStatusText, setSyncStatusText] = useState<string>('');

  const [deviceInfo, setDeviceInfo] = useState({
    model: 'DS-K1T320EFWX',
    ip: '192.168.1.45',
    status: 'CONNECTED',
    firmware: 'V3.5.20 Build 20241227'
  });

  const [counts, setCounts] = useState<ManifestCounts>({
    machineUsersFound: 0,
    crmMembersFound: 0,
    idMatched: 0,
    photosAvailable: 0,
    photosSynced: 0,
    noPhoto: 0,
    idNotFound: 0,
    failed: 0
  });

  const [rows, setRows] = useState<ManifestRow[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterTab, setFilterTab] = useState<'all' | 'synced' | 'available' | 'exists' | 'no_photo' | 'not_found'>('all');
  const [forceOverwrite, setForceOverwrite] = useState<boolean>(false);

  // Conflict Modal State for single member
  const [conflictMember, setConflictMember] = useState<ManifestRow | null>(null);

  // 1. Fetch Manifest
  const fetchManifest = useCallback(async () => {
    setLoading(true);
    try {
      const res = await API.get('/devices/hikvision/photo-manifest');
      if (res.data && res.data.counts) {
        setCounts(res.data.counts);
        setRows(res.data.rows || []);
        if (res.data.device) {
          setDeviceInfo(res.data.device);
        }
      }
    } catch (err: any) {
      console.error('Failed to load photo manifest:', err);
      toast.error('Unable to fetch Hikvision photo manifest');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchManifest();
    }
  }, [isOpen, fetchManifest]);

  // 2. Filtered Rows
  const filteredRows = useMemo(() => {
    return rows.filter(r => {
      // Tab filter
      if (filterTab === 'synced' && r.syncStatus !== 'SYNCED') return false;
      if (filterTab === 'available' && r.syncStatus !== 'AVAILABLE_TO_SYNC') return false;
      if (filterTab === 'exists' && r.syncStatus !== 'ALREADY_EXISTS') return false;
      if (filterTab === 'no_photo' && r.syncStatus !== 'NO_PHOTO') return false;
      if (filterTab === 'not_found' && r.syncStatus !== 'ID_NOT_FOUND') return false;

      // Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.memberName.toLowerCase().includes(q) ||
        r.biometricId.toLowerCase().includes(q) ||
        (r.machineEmployeeNo && r.machineEmployeeNo.toLowerCase().includes(q)) ||
        (r.machineName && r.machineName.toLowerCase().includes(q))
      );
    });
  }, [rows, filterTab, searchQuery]);

  // 3. Execute Photo Sync
  const handleStartSync = async (specificMemberIds?: string[], overwrite: boolean = forceOverwrite) => {
    setSyncing(true);
    setSyncProgress(10);
    setSyncStatusText('Connecting to Hikvision DS-K1T320EFWX (192.168.1.45)...');

    try {
      const progressTimer = setInterval(() => {
        setSyncProgress(prev => (prev < 90 ? prev + 15 : prev));
      }, 400);

      setSyncStatusText('Fetching face photos via DigestAuth & writing to Warrior Storage...');

      const res = await API.post('/devices/hikvision/sync-photos', {
        memberIds: specificMemberIds,
        forceOverwrite: overwrite
      });

      clearInterval(progressTimer);
      setSyncProgress(100);
      setSyncStatusText('Photo sync complete!');

      if (res.data && res.data.summary) {
        setCounts(prev => ({
          ...prev,
          photosSynced: (prev.photosSynced || 0) + (res.data.summary.photosSynced || 0),
          failed: res.data.summary.failed || 0
        }));

        toast.success(`Successfully synced ${res.data.summary.photosSynced} member photos from Hikvision!`);
      }

      await fetchMembers();
      await fetchManifest();
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      console.error('Photo sync error:', err);
      toast.error(err?.response?.data?.error || 'Failed to sync photos from Hikvision');
    } finally {
      setTimeout(() => {
        setSyncing(false);
        setSyncProgress(0);
        setSyncStatusText('');
      }, 800);
    }
  };

  // 4. Combined 1-Click Sync (Machine Users + Photos)
  const handleSyncUsersAndPhotos = async () => {
    setSyncing(true);
    setSyncProgress(25);
    setSyncStatusText('Mapping machine users & syncing face photos...');

    try {
      const res = await API.post('/devices/hikvision/sync-users-and-photos');
      setSyncProgress(100);
      toast.success(res.data.message || 'Combined Machine Users & Photos synced!');
      await fetchMembers();
      await fetchManifest();
      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      toast.error('Failed running combined sync');
    } finally {
      setTimeout(() => {
        setSyncing(false);
        setSyncProgress(0);
      }, 800);
    }
  };

  // 5. Conflict Resolution: Keep CRM Photo vs Use Hikvision Photo
  const handleResolveConflict = async (useHikvision: boolean) => {
    if (!conflictMember) return;
    if (useHikvision) {
      await handleStartSync([conflictMember.biometricId], true);
      toast.success(`Replaced with Hikvision photo for ${conflictMember.memberName}`);
    } else {
      toast.info(`Preserved existing CRM photo for ${conflictMember.memberName}`);
    }
    setConflictMember(null);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-5">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-950/70 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 320 }}
          className="w-full max-w-5xl bg-slate-900 text-white rounded-3xl shadow-2xl border border-white/10 relative overflow-hidden flex flex-col z-10 max-h-[92vh]"
        >
          {/* Header */}
          <div className="px-6 sm:px-8 py-5 border-b border-white/10 bg-slate-900/90 backdrop-blur-md flex flex-wrap justify-between items-center gap-4 shrink-0">
            <div className="flex items-center gap-3.5">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#EA580C] to-[#FB923C] text-white flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Camera size={22} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-black tracking-wide text-white uppercase font-display">
                    Hikvision Photo Sync
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    ISAPI V3.5.20
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-400 font-medium pt-0.5">
                  <span>Device: <strong className="text-slate-200">{deviceInfo.model}</strong></span>
                  <span>•</span>
                  <span>IP: <strong className="text-slate-200">{deviceInfo.ip}</strong></span>
                  <span>•</span>
                  <span className="flex items-center gap-1.5 text-emerald-400 font-bold">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    {deviceInfo.status}
                  </span>
                </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all flex items-center justify-center border-none cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body Content */}
          <div className="p-6 sm:p-8 space-y-6 overflow-y-auto custom-scrollbar">

            {/* 8 Metric KPI Badges */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
              <div className="bg-slate-800/80 p-3 rounded-2xl border border-white/5 text-center">
                <span className="text-[9px] font-black uppercase text-slate-400 block truncate">Machine Users</span>
                <span className="text-lg font-black text-white font-mono">{counts.machineUsersFound}</span>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-2xl border border-white/5 text-center">
                <span className="text-[9px] font-black uppercase text-slate-400 block truncate">CRM Members</span>
                <span className="text-lg font-black text-white font-mono">{counts.crmMembersFound}</span>
              </div>
              <div className="bg-blue-500/10 p-3 rounded-2xl border border-blue-500/20 text-center">
                <span className="text-[9px] font-black uppercase text-blue-400 block truncate">ID Matched</span>
                <span className="text-lg font-black text-blue-400 font-mono">{counts.idMatched}</span>
              </div>
              <div className="bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20 text-center">
                <span className="text-[9px] font-black uppercase text-amber-400 block truncate">Photos Available</span>
                <span className="text-lg font-black text-amber-400 font-mono">{counts.photosAvailable}</span>
              </div>
              <div className="bg-emerald-500/10 p-3 rounded-2xl border border-emerald-500/20 text-center">
                <span className="text-[9px] font-black uppercase text-emerald-400 block truncate">Photos Synced</span>
                <span className="text-lg font-black text-emerald-400 font-mono">{counts.photosSynced}</span>
              </div>
              <div className="bg-slate-800/80 p-3 rounded-2xl border border-white/5 text-center">
                <span className="text-[9px] font-black uppercase text-slate-400 block truncate">No Photo</span>
                <span className="text-lg font-black text-slate-400 font-mono">{counts.noPhoto}</span>
              </div>
              <div className="bg-rose-500/10 p-3 rounded-2xl border border-rose-500/20 text-center">
                <span className="text-[9px] font-black uppercase text-rose-400 block truncate">ID Not Found</span>
                <span className="text-lg font-black text-rose-400 font-mono">{counts.idNotFound}</span>
              </div>
              <div className="bg-red-500/10 p-3 rounded-2xl border border-red-500/20 text-center">
                <span className="text-[9px] font-black uppercase text-red-400 block truncate">Failed</span>
                <span className="text-lg font-black text-red-400 font-mono">{counts.failed}</span>
              </div>
            </div>

            {/* Sync Progress Bar */}
            {syncing && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-4 rounded-2xl bg-orange-500/10 border border-[#EA580C]/30 space-y-2">
                <div className="flex justify-between items-center text-xs font-bold">
                  <span className="text-[#FB923C] flex items-center gap-2">
                    <RefreshCw size={14} className="animate-spin" />
                    {syncStatusText || 'Syncing Photos...'}
                  </span>
                  <span className="font-mono text-white font-black">{syncProgress}%</span>
                </div>
                <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden relative">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#EA580C] to-[#FB923C] rounded-full"
                    style={{ width: `${syncProgress}%` }}
                    transition={{ ease: 'linear' }}
                  />
                </div>
              </motion.div>
            )}

            {/* Action Buttons & Option Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-slate-800/40 border border-white/5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => handleStartSync()}
                  disabled={syncing || loading}
                  className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#EA580C] to-[#FB923C] hover:brightness-110 active:scale-98 text-white font-black uppercase text-xs transition-all shadow-md shadow-orange-500/20 cursor-pointer border-none flex items-center gap-2 disabled:opacity-50"
                >
                  <Camera size={15} />
                  <span>Sync Photos From Hikvision</span>
                </button>

                <button
                  type="button"
                  onClick={handleSyncUsersAndPhotos}
                  disabled={syncing || loading}
                  className="px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all border border-white/10 cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  <Zap size={14} className="text-amber-400" />
                  <span>Sync Machine Users + Photos</span>
                </button>

                <button
                  type="button"
                  onClick={() => fetchManifest()}
                  disabled={syncing || loading}
                  className="px-3.5 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs transition-all border border-white/10 cursor-pointer flex items-center gap-1.5"
                  title="Refresh status without downloading"
                >
                  <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
                  <span>Sync Again</span>
                </button>
              </div>

              {/* Overwrite Toggle */}
              <label className="flex items-center gap-2.5 text-xs text-slate-300 font-semibold cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={forceOverwrite}
                  onChange={(e) => setForceOverwrite(e.target.checked)}
                  className="w-4 h-4 rounded text-[#EA580C] bg-slate-800 border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <span>Replace Existing Photos</span>
              </label>
            </div>

            {/* Filter Tabs & Search Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              {/* Tab Pills */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800/60 border border-white/5 text-xs">
                <button
                  onClick={() => setFilterTab('all')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all border-none cursor-pointer ${
                    filterTab === 'all' ? 'bg-[#EA580C] text-white' : 'text-slate-400 hover:text-white bg-transparent'
                  }`}
                >
                  All ({rows.length})
                </button>
                <button
                  onClick={() => setFilterTab('synced')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all border-none cursor-pointer ${
                    filterTab === 'synced' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white bg-transparent'
                  }`}
                >
                  Synced ({counts.photosSynced})
                </button>
                <button
                  onClick={() => setFilterTab('available')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all border-none cursor-pointer ${
                    filterTab === 'available' ? 'bg-amber-600 text-white' : 'text-slate-400 hover:text-white bg-transparent'
                  }`}
                >
                  Available ({counts.photosAvailable - counts.photosSynced})
                </button>
                <button
                  onClick={() => setFilterTab('exists')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all border-none cursor-pointer ${
                    filterTab === 'exists' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white bg-transparent'
                  }`}
                >
                  CRM Photo
                </button>
                <button
                  onClick={() => setFilterTab('no_photo')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all border-none cursor-pointer ${
                    filterTab === 'no_photo' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-white bg-transparent'
                  }`}
                >
                  No Photo ({counts.noPhoto})
                </button>
              </div>

              {/* Search input */}
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Member or BIO ID..."
                  className="w-full h-9 bg-slate-800 border border-white/10 rounded-xl pl-9 pr-3 text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-[#EA580C]"
                />
              </div>
            </div>

            {/* Member-by-Member Results Table */}
            <div className="border border-white/10 rounded-2xl overflow-hidden bg-slate-950/40">
              <div className="max-h-[380px] overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-800/80 sticky top-0 z-10 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <tr>
                      <th className="py-3 px-4">PHOTO</th>
                      <th className="py-3 px-3">BIO ID</th>
                      <th className="py-3 px-4">CRM MEMBER</th>
                      <th className="py-3 px-4">MACHINE USER</th>
                      <th className="py-3 px-3">PHOTO</th>
                      <th className="py-3 px-4">STATUS</th>
                      <th className="py-3 px-3 text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-medium">
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400">
                          <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#EA580C]" />
                          <span>Reading Hikvision user photo manifest...</span>
                        </td>
                      </tr>
                    ) : filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-10 text-center text-slate-400">
                          No member records matching current filter
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((r) => {
                        const avatarSrc = resolveAvatarUrl({
                          photoUrl: r.existingPhotoUrl,
                          name: r.memberName
                        });

                        return (
                          <tr key={r.memberId} className="hover:bg-white/[0.02] transition-colors">
                            {/* Photo Thumbnail */}
                            <td className="py-2.5 px-4">
                              <div className="w-9 h-9 rounded-xl overflow-hidden bg-slate-800 border border-white/10 flex items-center justify-center shrink-0">
                                {r.existingPhotoUrl ? (
                                  <img 
                                    src={r.existingPhotoUrl} 
                                    alt={r.memberName} 
                                    className="w-full h-full object-cover" 
                                    onError={(e: any) => { e.target.src = avatarSrc; }}
                                  />
                                ) : (
                                  <span className="text-[11px] font-bold text-slate-500">—</span>
                                )}
                              </div>
                            </td>

                            {/* Biometric ID */}
                            <td className="py-2.5 px-3">
                              <span className="px-2 py-1 rounded-md bg-blue-500/10 text-blue-300 font-mono font-bold text-xs border border-blue-500/20">
                                {r.biometricId}
                              </span>
                            </td>

                            {/* CRM Member Name & Status */}
                            <td className="py-2.5 px-4">
                              <div className="font-bold text-white flex items-center gap-1.5">
                                <span>{r.memberName}</span>
                                {r.status === 'hold' || r.status === 'HOLD' ? (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-300">
                                    HOLD
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded text-[9px] font-black uppercase bg-emerald-500/20 text-emerald-300">
                                    ACTIVE
                                  </span>
                                )}
                              </div>
                              {r.photoSyncedAt && (
                                <span className="text-[10px] text-slate-400 block">
                                  Synced: {new Date(r.photoSyncedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </td>

                            {/* Machine User */}
                            <td className="py-2.5 px-4">
                              {r.machineEmployeeNo ? (
                                <div>
                                  <span className="font-bold text-slate-200">#{r.machineEmployeeNo}</span>
                                  <span className="text-[10px] text-slate-400 block">{r.machineName || 'Unnamed Slot'}</span>
                                </div>
                              ) : (
                                <span className="text-slate-500 italic text-[11px]">Not Found</span>
                              )}
                            </td>

                            {/* Machine Photo Availability */}
                            <td className="py-2.5 px-3">
                              {r.machinePhotoAvailable ? (
                                <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-[11px]">
                                  <CheckCircle2 size={12} /> Available
                                </span>
                              ) : (
                                <span className="text-slate-500 text-[11px]">None</span>
                              )}
                            </td>

                            {/* Sync Status Badge */}
                            <td className="py-2.5 px-4">
                              {r.syncStatus === 'SYNCED' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                  ✓ SYNCED
                                </span>
                              )}
                              {r.syncStatus === 'ALREADY_EXISTS' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                  ✓ ALREADY EXISTS
                                </span>
                              )}
                              {r.syncStatus === 'AVAILABLE_TO_SYNC' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                  READY TO SYNC
                                </span>
                              )}
                              {r.syncStatus === 'NO_PHOTO' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-slate-800 text-slate-400 border border-white/5">
                                  ⚠ NO PHOTO
                                </span>
                              )}
                              {r.syncStatus === 'ID_NOT_FOUND' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-rose-500/20 text-rose-400 border border-rose-500/30">
                                  ⚠ ID NOT FOUND
                                </span>
                              )}
                              {r.syncStatus === 'FAILED' && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-red-500/20 text-red-400 border border-red-500/30">
                                  ⚠ FAILED
                                </span>
                              )}
                            </td>

                            {/* Row Action */}
                            <td className="py-2.5 px-3 text-right">
                              {r.machinePhotoAvailable && (
                                <div className="flex items-center justify-end gap-1.5">
                                  {r.existingPhotoUrl && r.photoSource !== 'HIKVISION' ? (
                                    <button
                                      type="button"
                                      onClick={() => setConflictMember(r)}
                                      className="px-2 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 text-[10px] font-bold transition-all border border-blue-500/30 cursor-pointer"
                                    >
                                      Compare
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleStartSync([r.biometricId], true)}
                                      disabled={syncing}
                                      className="px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[10px] font-bold transition-all border border-white/10 cursor-pointer"
                                    >
                                      Sync
                                    </button>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* Footer Bar */}
          <div className="px-6 sm:px-8 py-4 bg-slate-950 border-t border-white/10 flex items-center justify-between shrink-0">
            <div className="text-xs text-slate-400 flex items-center gap-2">
              <ShieldCheck size={16} className="text-emerald-400" />
              <span>Machine matching strictly by <strong>Biometric ID</strong>. Status preserved.</span>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all border border-white/10 cursor-pointer"
            >
              Close
            </button>
          </div>

          {/* Conflict Resolution Modal (CRM Photo vs Hikvision Photo) */}
          {conflictMember && (
            <div className="absolute inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4">
              <div className="w-full max-w-md bg-slate-900 border border-white/15 rounded-3xl p-6 space-y-5 shadow-2xl text-center">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-400 flex items-center justify-center mx-auto">
                  <Camera size={24} />
                </div>
                <div>
                  <h3 className="text-base font-black text-white uppercase">Profile Photo Conflict</h3>
                  <p className="text-xs text-slate-400 font-medium pt-1">
                    {conflictMember.memberName} (BIO ID: #{conflictMember.biometricId}) already has an existing photo.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-2">
                  {/* Current CRM Photo */}
                  <div className="bg-slate-800/80 p-3 rounded-2xl border border-white/10 space-y-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Existing CRM Photo</span>
                    <div className="w-20 h-20 rounded-xl overflow-hidden mx-auto bg-slate-900 border border-white/10">
                      <img 
                        src={conflictMember.existingPhotoUrl || ''} 
                        alt="Existing" 
                        className="w-full h-full object-cover" 
                      />
                    </div>
                    <span className="text-[9px] font-bold text-blue-300 block">Source: Manual Upload</span>
                  </div>

                  {/* Hikvision Photo */}
                  <div className="bg-slate-800/80 p-3 rounded-2xl border border-white/10 space-y-2">
                    <span className="text-[10px] font-black uppercase text-slate-400 block">Hikvision Terminal</span>
                    <div className="w-20 h-20 rounded-xl overflow-hidden mx-auto bg-slate-900 border border-white/10 flex items-center justify-center">
                      <Camera size={24} className="text-[#EA580C]" />
                    </div>
                    <span className="text-[9px] font-bold text-emerald-400 block">Available on Device</span>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => handleResolveConflict(false)}
                    className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-all border border-white/10 cursor-pointer"
                  >
                    Keep CRM Photo
                  </button>
                  <button
                    type="button"
                    onClick={() => handleResolveConflict(true)}
                    className="flex-1 py-3 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-black text-xs uppercase transition-all shadow-md border-none cursor-pointer"
                  >
                    Use Hikvision Photo
                  </button>
                </div>
              </div>
            </div>
          )}

        </motion.div>
      </div>
    </AnimatePresence>
  );
}
