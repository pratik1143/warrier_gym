'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Users, Fingerprint, Clock, ExternalLink, Download } from 'lucide-react';
import { useRouter } from 'next/navigation';
import toast from '@/lib/toast';

interface PresentMembersModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceLogs: any[];
  members: any[];
}

export default function PresentMembersModal({ isOpen, onClose, attendanceLogs, members }: PresentMembersModalProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMethod, setFilterMethod] = useState<'all' | 'biometric' | 'manual'>('all');

  const todayStr = useMemo(() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }, []);
  const todayDateStr = useMemo(() => new Date().toDateString(), []);

  // Filter today's attendance logs and resolve member profile objects
  const todayPresentList = useMemo(() => {
    if (!attendanceLogs) return [];

    // Filter logs for today
    const rawTodayLogs = attendanceLogs.filter(log => {
      const checkInStr = String(log.checkIn || log.timestamp || log.createdAt || '');
      if (!checkInStr) return false;
      const checkInYMD = checkInStr.includes('T') ? checkInStr.split('T')[0] : checkInStr;
      return checkInYMD === todayStr;
    });

    // Group by unique member to show clean list of present members
    const seenMembers = new Map<string, any>();

    rawTodayLogs.forEach(log => {
      // Find matching member object from CRM members list
      const matchedMember = members?.find((m: any) =>
        (m.id && log.memberId && m.id === log.memberId) ||
        (m.uid && log.memberId && m.uid === log.memberId) ||
        (m.memberId && log.memberId && m.memberId === log.memberId) ||
        (m.memberId && log.memberCode && m.memberId === log.memberCode) ||
        (m.biometricId && log.biometricId && m.biometricId === log.biometricId) ||
        (m.deviceUserId && log.biometricId && m.deviceUserId === log.biometricId) ||
        (m.phone && log.phone && String(m.phone).replace(/\D/g, '') === String(log.phone).replace(/\D/g, '')) ||
        (m.name && log.memberName && m.name.trim().toLowerCase() === String(log.memberName).trim().toLowerCase())
      );

      const memberIdKey = matchedMember?.id || log.memberId || log.biometricId || log.memberName;
      if (!memberIdKey) return;

      if (!seenMembers.has(memberIdKey)) {
        const rawTime = log.checkIn || log.timestamp || log.createdAt;
        const timeStr = rawTime
          ? new Date(rawTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
          : 'Just now';

        seenMembers.set(memberIdKey, {
          logId: log.id || `log_${Math.random()}`,
          memberId: matchedMember?.id || log.memberId || '',
          memberCode: matchedMember?.memberId || log.memberCode || `TWG-2026-${log.biometricId || '0000'}`,
          name: matchedMember?.name || log.memberName || 'Athlete',
          avatarUrl: matchedMember?.photo || matchedMember?.avatarUrl || matchedMember?.avatar || log.avatarUrl || '',
          phone: matchedMember?.phone || log.phone || '',
          plan: matchedMember?.plan || log.membership || log.plan || 'Monthly Standard',
          expiryDate: matchedMember?.expiryDate || '',
          status: matchedMember?.status || 'active',
          checkInTime: timeStr,
          method: log.method || 'Biometric (Hikvision DS-K1T320EFWX)',
          deviceName: log.deviceName || log.deviceId || 'Main Gate',
          biometricId: matchedMember?.biometricId || log.biometricId || log.deviceUserId || ''
        });
      }
    });

    return Array.from(seenMembers.values());
  }, [attendanceLogs, members, todayStr, todayDateStr]);

  // Filtered list by search term and method
  const filteredList = useMemo(() => {
    return todayPresentList.filter(item => {
      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q ||
        item.name.toLowerCase().includes(q) ||
        item.memberCode.toLowerCase().includes(q) ||
        item.phone.includes(q) ||
        item.plan.toLowerCase().includes(q) ||
        item.biometricId.includes(q);

      const matchesMethod = filterMethod === 'all' ||
        (filterMethod === 'biometric' && item.method.toLowerCase().includes('biometric')) ||
        (filterMethod === 'manual' && !item.method.toLowerCase().includes('biometric'));

      return matchesSearch && matchesMethod;
    });
  }, [todayPresentList, searchTerm, filterMethod]);

  const handleExportCSV = () => {
    if (filteredList.length === 0) {
      toast.error('No present members to export!');
      return;
    }
    const headers = ['Member Name', 'Member Code', 'Biometric ID', 'Check-in Time', 'Method', 'Plan', 'Phone'];
    const rows = filteredList.map(m => [
      `"${m.name}"`,
      `"${m.memberCode}"`,
      `"${m.biometricId}"`,
      `"${m.checkInTime}"`,
      `"${m.method}"`,
      `"${m.plan}"`,
      `"${m.phone}"`
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Present_Members_${todayStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Present members list exported to CSV! 📊');
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl shadow-2xl border border-slate-200 p-6 max-w-4xl w-full relative space-y-4 text-slate-900 z-10 max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-stone-100 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center border border-[#FED7AA] shadow-xs">
                <Users size={24} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-slate-900 text-xl tracking-tight">Today's Present Members Roster</h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#FFF7ED] text-[#EA580C] border border-[#FED7AA] text-xs font-black">
                    {todayPresentList.length} Present Today
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-semibold mt-0.5 flex items-center gap-2">
                  <span>📅 {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  <span>•</span>
                  <span className="text-[#EA580C] font-bold">Real-time Biometric Check-in Log</span>
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="px-3.5 py-2 bg-stone-100 hover:bg-stone-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all border-none cursor-pointer"
              >
                <Download size={14} /> Export CSV
              </button>
              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl bg-stone-100 hover:bg-stone-200 text-slate-500 hover:text-slate-900 flex items-center justify-center transition-all border-none cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Search & Filter Controls */}
          <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-stone-50 p-3 rounded-2xl border border-stone-100">
            <div className="relative flex-1 w-full">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search present member by Name, Phone, Ref Code, or Bio ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-stone-200 rounded-xl pl-10 pr-4 py-2 text-xs font-bold text-slate-800 placeholder-slate-400 outline-none focus:border-[#F97316] transition-all"
              />
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {[
                { id: 'all', label: `All (${todayPresentList.length})` },
                { id: 'biometric', label: '⚡ Biometric' },
                { id: 'manual', label: '✋ Manual' }
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setFilterMethod(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-extrabold transition-all border cursor-pointer ${
                    filterMethod === tab.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Roster List */}
          <div className="flex-1 overflow-y-auto max-h-[480px] space-y-2.5 pr-1 custom-scrollbar">
            {filteredList.map((item, idx) => {
              const avatar = item.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(item.name)}`;

              return (
                <div
                  key={item.logId || idx}
                  className="bg-white border border-slate-100 hover:border-slate-300 p-4 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all shadow-sm hover:shadow-md"
                >
                  {/* Left: Member Identity */}
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={avatar}
                      alt={item.name}
                      className="w-12 h-12 rounded-2xl bg-slate-100 border border-slate-200 object-cover shrink-0 shadow-sm"
                      onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${idx}` }}
                    />
                    <div className="truncate">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-slate-900 text-sm truncate">{item.name}</h4>
                        <span className="px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 text-[10px] font-black font-mono border border-teal-200">
                          {item.memberCode}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[11px] text-slate-500 font-semibold mt-1 flex-wrap">
                        {item.biometricId && (
                          <span className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-mono text-[10px] font-bold border border-indigo-100">
                            <Fingerprint size={12} /> Bio #{item.biometricId}
                          </span>
                        )}
                        <span>Plan: <strong className="text-slate-800">{item.plan}</strong></span>
                        {item.phone && <span>· 📞 {item.phone}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Right: Check-in Time & Action Button */}
                  <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                    <div className="text-right">
                      <div className="text-xs font-black text-slate-900 flex items-center gap-1 justify-end font-mono">
                        <Clock size={13} className="text-teal-600" /> {item.checkInTime}
                      </div>
                      <div className="text-[10px] font-bold text-slate-400 mt-0.5">
                        {item.method}
                      </div>
                    </div>

                    {item.memberId && (
                      <button
                        onClick={() => {
                          onClose();
                          router.push(`/dashboard/members/${item.memberId}`);
                        }}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border-none cursor-pointer shadow-sm"
                      >
                        <span>Profile</span>
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredList.length === 0 && (
              <div className="py-16 text-center text-slate-400 space-y-3">
                <Users size={36} className="mx-auto text-slate-300 animate-pulse" />
                <p className="text-sm font-bold text-slate-600">No present members found for this filter</p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {searchTerm ? `No checked-in member matches "${searchTerm}".` : 'No member check-in logs recorded for today yet.'}
                </p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-xs font-semibold text-slate-500">
            <span>Showing {filteredList.length} of {todayPresentList.length} present members</span>
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs border-none cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
