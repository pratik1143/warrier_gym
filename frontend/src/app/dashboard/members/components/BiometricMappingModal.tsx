'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Fingerprint, Search, CheckCircle2, User, Sparkles, RefreshCw, Zap, AlertTriangle, Cpu, ArrowRight } from 'lucide-react';
import toast from '@/lib/toast';
import { useGymStore } from '@/store';
import API from '@/services/api';

interface BiometricMappingModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetMember?: any | null;
}

export default function BiometricMappingModal({ isOpen, onClose, targetMember }: BiometricMappingModalProps) {
  const { members, updateMember, fetchMembers } = useGymStore();

  const [selectedMemberId, setSelectedMemberId] = useState<string>('');
  const [biometricIdInput, setBiometricIdInput] = useState<string>('');
  const [searchMember, setSearchMember] = useState<string>('');
  const [unmappedPunches, setUnmappedPunches] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Auto Batch Mapping States
  const [isAutoMapping, setIsAutoMapping] = useState<boolean>(false);
  const [autoMapResult, setAutoMapResult] = useState<any | null>(null);

  useEffect(() => {
    if (targetMember) {
      setSelectedMemberId(targetMember.id || targetMember.memberId);
      setBiometricIdInput(targetMember.biometricId || targetMember.deviceUserId || '');
    } else if (members && members.length > 0 && !selectedMemberId) {
      setSelectedMemberId(members[0].id);
    }
  }, [targetMember, members, isOpen]);

  // Fetch recent unmapped attendance punches from backend
  useEffect(() => {
    if (isOpen) {
      API.get('/attendance').then(res => {
        const logs = res.data || [];
        const unmapped = logs.filter((l: any) => 
          l.status === 'unknown' || 
          (l.memberName && l.memberName.includes('Unmapped')) ||
          (l.reason && l.reason.includes('mapping'))
        ).slice(0, 5);
        setUnmappedPunches(unmapped);
      }).catch(() => {});
    }
  }, [isOpen]);

  const filteredMembers = members.filter((m: any) => {
    if (!searchMember.trim()) return true;
    const q = searchMember.toLowerCase();
    return (m.name && m.name.toLowerCase().includes(q)) || 
           (m.memberId && m.memberId.toLowerCase().includes(q)) ||
           (m.phone && m.phone.includes(q));
  });

  // 1-Click Auto Batch Mapping
  const handleAutoMapAll = async () => {
    setIsAutoMapping(true);
    setAutoMapResult(null);
    try {
      const res = await API.post('/devices/biometric/auto-map-all');
      if (res.data?.success) {
        setAutoMapResult(res.data);
        fetchMembers();
        toast.success(res.data.message || 'Auto-mapping complete!');
      } else {
        toast.error('Failed to auto-map biometric IDs');
      }
    } catch (err: any) {
      toast.error('Error connecting to Hikvision terminal for auto-mapping');
    } finally {
      setIsAutoMapping(false);
    }
  };

  const handleSaveMapping = async () => {
    if (!selectedMemberId) {
      toast.error('Please select a member profile!');
      return;
    }
    if (!biometricIdInput.trim()) {
      toast.error('Please enter the Biometric Machine User ID!');
      return;
    }

    setIsSubmitting(true);
    try {
      const bioIdClean = biometricIdInput.trim();
      await updateMember(selectedMemberId, {
        biometricId: bioIdClean,
        deviceUserId: bioIdClean
      });

      const memberObj = members.find((m: any) => m.id === selectedMemberId);
      const memberName = memberObj?.name || 'Member';

      toast.success(`Biometric ID #${bioIdClean} successfully mapped to ${memberName}!`);
      fetchMembers();
      onClose();
    } catch (err: any) {
      toast.error('Failed to map biometric ID');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-950/60 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-[720px] bg-slate-900 text-white rounded-[32px] shadow-2xl border border-white/10 relative overflow-hidden flex flex-col z-10 max-h-[90vh]"
        >
          {/* Header */}
          <div className="px-8 py-5 border-b border-white/10 bg-slate-900/80 backdrop-blur-md flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#EA580C]/20 border border-[#EA580C]/40 flex items-center justify-center text-[#EA580C]">
                <Fingerprint size={22} />
              </div>
              <div>
                <h2 className="text-lg font-black tracking-wide text-white uppercase font-display">Biometric ID Hardware Mapping</h2>
                <p className="text-xs text-slate-400 font-medium">Auto-Sync all members with Hikvision DS-K1T320EFWX terminal users</p>
              </div>
            </div>

            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all flex items-center justify-center border-none cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body */}
          <div className="p-8 space-y-6 overflow-y-auto custom-scrollbar">

            {/* ⚡ 1-Click Auto Batch Mapping Hero Banner */}
            <div className="bg-gradient-to-br from-blue-900/60 to-indigo-900/60 border border-blue-500/30 p-5 rounded-3xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#EA580C] text-white flex items-center justify-center font-black">
                    <Zap size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black uppercase text-white tracking-wide">1-Click Auto Map All Members</h3>
                    <p className="text-[10px] text-slate-300 font-medium">Scans Hikvision terminal users and matches names/IDs automatically</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAutoMapAll}
                  disabled={isAutoMapping}
                  className="px-6 py-3 rounded-2xl bg-[#EA580C] text-white font-black uppercase text-xs hover:bg-[#9A3412] transition-all border-none cursor-pointer shadow-lg disabled:opacity-50 flex items-center gap-2"
                >
                  <Cpu size={16} className={isAutoMapping ? 'animate-spin' : ''} />
                  <span>{isAutoMapping ? 'Scanning Terminal...' : 'Auto-Map All Members'}</span>
                </button>
              </div>

              {/* Auto Map Result Stats Banner */}
              {autoMapResult && (
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 pt-2">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-white/10 text-center">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Total Mapped</span>
                      <span className="text-lg font-black text-emerald-400 font-mono">{autoMapResult.mappedCount}</span>
                    </div>
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-white/10 text-center">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Newly Mapped</span>
                      <span className="text-lg font-black text-orange-200 font-mono">+{autoMapResult.newlyMapped}</span>
                    </div>
                    <div className="bg-slate-900/80 p-3 rounded-xl border border-white/10 text-center">
                      <span className="text-[9px] font-black uppercase text-slate-400 block">Missing on Machine</span>
                      <span className="text-lg font-black text-rose-400 font-mono">{autoMapResult.missingCount}</span>
                    </div>
                  </div>

                  {/* Missing Members List Alert */}
                  {autoMapResult.missingCount > 0 && (
                    <div className="bg-rose-500/10 border border-rose-500/30 p-4 rounded-2xl space-y-2">
                      <div className="text-[10px] font-black uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                        <AlertTriangle size={14} />
                        {autoMapResult.missingCount} Members Not Found on Machine Scanner (Fingerprint Enrollment Needed):
                      </div>
                      <div className="max-h-36 overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
                        {autoMapResult.missingMembers?.map((m: any) => (
                          <div key={m.id} className="flex justify-between items-center bg-slate-900/90 p-2.5 rounded-xl text-xs border border-white/5">
                            <div>
                              <span className="font-bold text-white">{m.name}</span>
                              <span className="text-[10px] text-slate-400 block">{m.phone || m.memberId}</span>
                            </div>
                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-blue-500/20 text-orange-100">
                              Missing Scanner FP
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {/* Unmapped Recent Punch Suggestions */}
            {unmappedPunches.length > 0 && (
              <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl space-y-2">
                <div className="text-[10px] font-black uppercase tracking-wider text-orange-200 flex items-center gap-1.5">
                  <Zap size={13} />
                  Recent Unmapped Machine Swipes (Click to Auto-Fill)
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                  {unmappedPunches.map((punch, idx) => {
                    const bioId = punch.biometricId || punch.memberId?.replace('unmapped_bio_', '');
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setBiometricIdInput(bioId)}
                        className="px-3 py-1.5 rounded-xl bg-blue-500/20 hover:bg-orange-500/30 text-orange-100 text-xs font-mono font-bold transition-all border border-blue-500/30 cursor-pointer flex items-center gap-1.5"
                      >
                        <Fingerprint size={12} />
                        <span>Machine ID #{bioId}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Manual Single Mapping Section */}
            <div className="border-t border-white/10 pt-4 space-y-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Manual Single Member Mapping</h4>

              {/* Member Selector */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  1. Select Member Profile
                </label>
                
                <div className="relative mb-2">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input 
                    type="text" 
                    value={searchMember}
                    onChange={(e) => setSearchMember(e.target.value)}
                    placeholder="Search member name, phone or ID..."
                    className="w-full h-10 bg-slate-800/80 border border-white/10 rounded-xl pl-10 pr-4 text-xs font-medium text-white focus:outline-none focus:border-[#EA580C]"
                  />
                </div>

                <select 
                  value={selectedMemberId}
                  onChange={(e) => setSelectedMemberId(e.target.value)}
                  className="w-full h-12 bg-slate-800 border border-white/10 rounded-xl px-4 text-sm font-bold text-white focus:outline-none focus:border-[#EA580C]"
                >
                  {filteredMembers.map((m: any) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.memberId || m.phone}) {m.biometricId ? `[Current Bio ID: #${m.biometricId}]` : '[Unmapped]'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Biometric Machine ID Input */}
              <div className="space-y-2">
                <label className="block text-[10px] font-black uppercase text-orange-200 tracking-wider">
                  2. Enter Machine Biometric User ID (Finger / Card ID)
                </label>
                <div className="relative">
                  <input 
                    type="text" 
                    value={biometricIdInput}
                    onChange={(e) => setBiometricIdInput(e.target.value)}
                    placeholder="e.g. 1, 2, 5, 250"
                    className="w-full h-14 bg-slate-800 border-2 border-blue-500/40 rounded-2xl px-4 font-mono font-black text-xl text-orange-200 focus:outline-none focus:border-[#EA580C]"
                  />
                </div>
              </div>
            </div>

          </div>

          {/* Footer Bar */}
          <div className="px-8 py-5 bg-slate-950 border-t border-white/10 flex items-center justify-between shrink-0">
            <button 
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl font-bold text-xs text-slate-400 hover:text-white transition-colors cursor-pointer border-none bg-transparent"
            >
              Cancel
            </button>

            <button 
              type="button"
              onClick={handleSaveMapping}
              disabled={isSubmitting}
              className="px-8 py-3.5 rounded-xl bg-[#EA580C] text-white font-black text-xs uppercase hover:bg-[#9A3412] transition-all flex items-center gap-2 border-none cursor-pointer shadow-lg disabled:opacity-50"
            >
              <CheckCircle2 size={16} />
              <span>{isSubmitting ? 'Linking...' : 'Save Single Mapping'}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
