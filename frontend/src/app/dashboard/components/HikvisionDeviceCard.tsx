'use client';

import React, { useState, useEffect } from 'react';
import { 
  Server, Wifi, Shield, Unlock, Lock, RefreshCw, AlertTriangle, 
  CheckCircle2, Users, ArrowRight, ExternalLink, KeyRound 
} from 'lucide-react';
import API from '@/services/api';
import toast from '@/lib/toast';
import { useGymStore } from '@/store';

interface HikvisionStatus {
  deviceId: string;
  deviceName: string;
  provider: string;
  ip: string;
  port: number;
  protocol: string;
  online: boolean;
  apiStatus: string;
  authentication: string;
  model: string;
  firmwareVersion: string;
  serialNumber: string;
  doorControl: string;
  unmappedUsersCount: number;
  lastSync: string;
  lastEvent: string | null;
}

interface UnmappedUser {
  id: string;
  deviceUserId: string;
  deviceId: string;
  nameOnDevice?: string;
  lastSeen?: string;
  count?: number;
}

export default function HikvisionDeviceCard() {
  const [status, setStatus] = useState<HikvisionStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingConnection, setTestingConnection] = useState(false);
  const [showDoorConfirm, setShowDoorConfirm] = useState(false);
  const [triggeringDoor, setTriggeringDoor] = useState(false);
  const [showUnmappedModal, setShowUnmappedModal] = useState(false);
  const [unmappedList, setUnmappedList] = useState<UnmappedUser[]>([]);
  const [selectedMapping, setSelectedMapping] = useState<{ [devId: string]: string }>({});
  const [mappingLoading, setMappingLoading] = useState(false);

  const members = useGymStore((s) => s.members || []);

  const fetchStatus = async () => {
    try {
      const res = await API.get('/devices/hikvision/status');
      if (res.data) {
        setStatus(res.data);
      }
    } catch (e) {
      console.warn('Error loading Hikvision status:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnmapped = async () => {
    try {
      const res = await API.get('/devices/hikvision/unmapped-users');
      setUnmappedList(res.data || []);
    } catch (e) {
      console.warn('Error loading unmapped users:', e);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleTestConnection = async () => {
    setTestingConnection(true);
    toast.loading('Testing connection to Hikvision terminal...', { id: 'hik-test' });
    try {
      const res = await API.get('/devices/hikvision/status');
      setStatus(res.data);
      if (res.data?.online) {
        toast.success(`Connected! Model: ${res.data.model} (Firmware ${res.data.firmwareVersion})`, { id: 'hik-test' });
      } else {
        toast.error(`Terminal offline at ${res.data?.ip}:${res.data?.port}`, { id: 'hik-test' });
      }
    } catch (err: any) {
      toast.error('Connection test failed: ' + (err.message || 'Error'), { id: 'hik-test' });
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSyncUsers = async () => {
    toast.loading('Syncing device users with member roster...', { id: 'hik-sync-users' });
    try {
      const res = await API.post('/devices/hikvision/sync-users');
      if (res.data?.success) {
        toast.success(res.data.message || 'Device users synced successfully!', { id: 'hik-sync-users' });
        await fetchStatus();
      } else {
        toast.error('Sync failed', { id: 'hik-sync-users' });
      }
    } catch (err: any) {
      toast.error('User sync failed: ' + (err.message || 'Error'), { id: 'hik-sync-users' });
    }
  };

  const handleSyncEvents = async () => {
    toast.loading('Syncing access control events...', { id: 'hik-sync-events' });
    try {
      const res = await API.post('/devices/hikvision/sync-events');
      if (res.data?.success) {
        toast.success(res.data.message || 'Access Control events synced!', { id: 'hik-sync-events' });
        await fetchStatus();
      } else {
        toast.error('Events sync failed', { id: 'hik-sync-events' });
      }
    } catch (err: any) {
      toast.error('Event sync failed: ' + (err.message || 'Error'), { id: 'hik-sync-events' });
    }
  };

  const handleTestDoorConfirmed = async () => {
    setTriggeringDoor(true);
    toast.loading('Sending unlock pulse to Hikvision relay...', { id: 'hik-door' });
    try {
      const res = await API.post('/devices/hikvision/door/open', { doorId: 1, requestedBy: 'Admin' });
      if (res.data?.success) {
        toast.success('Gate unlock command dispatched to terminal relay!', { id: 'hik-door' });
      } else {
        toast.error('Failed to trigger door: ' + (res.data?.error || 'Unknown error'), { id: 'hik-door' });
      }
    } catch (err: any) {
      toast.error('Error opening door: ' + (err.message || 'Error'), { id: 'hik-door' });
    } finally {
      setTriggeringDoor(false);
      setShowDoorConfirm(false);
    }
  };

  const handleOpenUnmapped = async () => {
    await fetchUnmapped();
    setShowUnmappedModal(true);
  };

  const handleMapUser = async (deviceUserId: string) => {
    const memberId = selectedMapping[deviceUserId];
    if (!memberId) {
      toast.error('Please select a member to map');
      return;
    }

    setMappingLoading(true);
    try {
      const res = await API.post('/devices/hikvision/map-user', { deviceUserId, memberId });
      if (res.data?.success) {
        toast.success(res.data.message || 'Member mapped successfully!');
        await fetchUnmapped();
        await fetchStatus();
      } else {
        toast.error('Mapping failed');
      }
    } catch (e: any) {
      toast.error('Mapping failed: ' + (e.message || 'Error'));
    } finally {
      setMappingLoading(false);
    }
  };

  const isOnline = status?.online ?? false;

  return (
    <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-200/80 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-100">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
            isOnline ? 'bg-orange-50 text-[#FF5E14] border-orange-200 shadow-sm' : 'bg-slate-100 text-slate-500 border-slate-200'
          }`}>
            <Server size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">
                {status?.deviceName || 'Hikvision DS-K1T320EFWX'}
              </h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 ${
                isOnline 
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
                {isOnline ? 'ONLINE / CONNECTED' : 'OFFLINE'}
              </span>
              <span className="px-2 py-0.5 bg-orange-50 text-[#FF5E14] border border-orange-200 text-[10px] font-black uppercase rounded-full">
                Provider: Hikvision
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-1">
              Active Biometric Terminal · Face, Fingerprint, Card &amp; Door Relay Access Control
            </p>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleTestConnection}
            disabled={testingConnection}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw size={14} className={testingConnection ? 'animate-spin text-[#FF5E14]' : 'text-slate-500'} />
            {testingConnection ? 'Probing...' : 'Test Connection'}
          </button>

          <button
            onClick={() => setShowDoorConfirm(true)}
            disabled={triggeringDoor}
            className="px-3.5 py-2 bg-orange-50 hover:bg-orange-100 text-[#FF5E14] border border-orange-200 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <KeyRound size={14} />
            Test Remote Unlock
          </button>

          <button
            onClick={handleSyncUsers}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Users size={14} className="text-[#FF5E14]" />
            Sync Users
          </button>

          <button
            onClick={handleSyncEvents}
            className="px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <ArrowRight size={14} className="text-slate-500" />
            Sync Events
          </button>

          <button
            onClick={() => setShowDoorConfirm(true)}
            className="px-4 py-2 bg-gradient-to-r from-[#FF5E14] to-[#FF7A00] hover:from-[#EA580C] hover:to-[#FF5E14] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer border-none"
          >
            <Unlock size={14} /> Open Gate
          </button>
        </div>
      </div>

      {/* Specifications & Hardware Info Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-3.5 bg-slate-50/70 border border-slate-100 rounded-2xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Terminal IP &amp; Port</div>
          <div className="text-sm font-extrabold text-slate-900 mt-0.5 font-mono">
            {status?.ip || '192.168.1.45'}:{status?.port || 443} ({status?.protocol?.toUpperCase() || 'HTTPS'})
          </div>
        </div>

        <div className="p-3.5 bg-slate-50/70 border border-slate-100 rounded-2xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hardware Model</div>
          <div className="text-sm font-extrabold text-slate-900 mt-0.5">
            {status?.model || 'DS-K1T320EFWX'}
          </div>
        </div>

        <div className="p-3.5 bg-slate-50/70 border border-slate-100 rounded-2xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Firmware Build</div>
          <div className="text-sm font-extrabold text-slate-900 mt-0.5 font-mono">
            {status?.firmwareVersion || 'V3.5.20'}
          </div>
        </div>

        <div className="p-3.5 bg-slate-50/70 border border-slate-100 rounded-2xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Door Control Status</div>
          <div className="text-sm font-extrabold text-emerald-600 mt-0.5 flex items-center gap-1">
            <CheckCircle2 size={14} /> Supported (Relay Door 1)
          </div>
        </div>
      </div>

      {/* Live Operational Status Bar */}
      <div className="p-4 bg-orange-50/40 border border-orange-100 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-100/70 text-[#FF5E14] flex items-center justify-center shrink-0">
            <Wifi size={18} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">
              Live ISAPI Alert Stream &amp; Biometric Ingestion
            </div>
            <div className="text-[11px] text-slate-500">
              Pushes Face, Fingerprint &amp; Card punches in real-time · Last Sync:{' '}
              <span className="font-mono text-slate-700">
                {status?.lastSync ? new Date(status.lastSync).toLocaleTimeString() : 'Active'}
              </span>
            </div>
          </div>
        </div>

        {/* Unmapped Users Shortcut */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right">
            <div className="text-xs font-bold text-slate-900">
              {status?.unmappedUsersCount || 0} Unmapped Device {status?.unmappedUsersCount === 1 ? 'User' : 'Users'}
            </div>
            <div className="text-[10px] text-slate-400">Punches logged without CRM member ID</div>
          </div>
          <button
            onClick={handleOpenUnmapped}
            className="px-3.5 py-1.5 bg-white hover:bg-orange-50 border border-orange-200 text-[#FF5E14] text-xs font-bold rounded-xl transition-all cursor-pointer shadow-xs flex items-center gap-1"
          >
            <Users size={13} /> View &amp; Map
          </button>
        </div>
      </div>

      {/* Confirmation Modal for Test Door */}
      {showDoorConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full border border-slate-200 shadow-2xl space-y-6">
            <div className="w-14 h-14 rounded-2xl bg-orange-50 text-[#FF5E14] border border-orange-200 flex items-center justify-center mx-auto shadow-xs">
              <KeyRound size={28} />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-slate-900 uppercase">
                Confirm Gate Unlock
              </h3>
              <p className="text-xs md:text-sm text-slate-600 leading-relaxed">
                Send an unlock command to the configured gate on <strong>Door 1</strong>? This will pulse the terminal physical relay for 3 seconds.
              </p>
            </div>

            <div className="p-3.5 bg-amber-50 border border-amber-200/80 rounded-2xl flex items-start gap-2.5 text-xs text-amber-800">
              <AlertTriangle size={16} className="shrink-0 mt-0.5 text-amber-600" />
              <span>Safety notice: Please verify the turnstile or gate swing area is clear of obstructions.</span>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowDoorConfirm(false)}
                disabled={triggeringDoor}
                className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleTestDoorConfirmed}
                disabled={triggeringDoor}
                className="flex-1 py-3 bg-gradient-to-r from-[#FF5E14] to-[#FF7A00] hover:from-[#EA580C] hover:to-[#FF5E14] text-white rounded-2xl text-xs font-bold transition-all shadow-md cursor-pointer flex items-center justify-center gap-1.5"
              >
                {triggeringDoor ? <RefreshCw size={14} className="animate-spin" /> : <Unlock size={14} />}
                {triggeringDoor ? 'Unlocking...' : 'Yes, Send Unlock'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unmapped Users Management Modal */}
      {showUnmappedModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-2xl w-full border border-slate-200 shadow-2xl space-y-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase flex items-center gap-2">
                  <Users size={18} className="text-[#FF5E14]" /> Unmapped Device Users
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Link hardware user slots on Hikvision to registered Warrior Gym members.
                </p>
              </div>
              <button
                onClick={() => setShowUnmappedModal(false)}
                className="p-2 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-xl cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {unmappedList.length === 0 ? (
                <div className="p-8 text-center text-slate-500 space-y-2">
                  <CheckCircle2 size={32} className="mx-auto text-emerald-500" />
                  <div className="text-sm font-bold text-slate-800">All Device Users Mapped!</div>
                  <p className="text-xs text-slate-400">No unknown punches or unmapped hardware IDs found.</p>
                </div>
              ) : (
                unmappedList.map((u) => (
                  <div
                    key={u.deviceUserId}
                    className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-[#FF5E14] bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-lg">
                          Slot #{u.deviceUserId}
                        </span>
                        <span className="text-sm font-bold text-slate-900">
                          {u.nameOnDevice || `User ${u.deviceUserId}`}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Punches logged: <strong>{u.count || 1}</strong> · Last seen:{' '}
                        {u.lastSeen ? new Date(u.lastSeen).toLocaleString() : 'N/A'}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <select
                        value={selectedMapping[u.deviceUserId] || ''}
                        onChange={(e) => setSelectedMapping({ ...selectedMapping, [u.deviceUserId]: e.target.value })}
                        className="text-xs font-medium bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-800 outline-none focus:border-[#FF5E14]"
                      >
                        <option value="">Select Member...</option>
                        {members.map((m: any) => (
                          <option key={m.id} value={m.id}>
                            {m.name} ({m.memberId || m.phone})
                          </option>
                        ))}
                      </select>

                      <button
                        onClick={() => handleMapUser(u.deviceUserId)}
                        disabled={mappingLoading || !selectedMapping[u.deviceUserId]}
                        className="px-3.5 py-2 bg-gradient-to-r from-[#FF5E14] to-[#FF7A00] text-white rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                      >
                        Map
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setShowUnmappedModal(false)}
                className="px-5 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
