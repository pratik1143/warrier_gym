'use client';

import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  CheckCircle2, AlertTriangle, XCircle, User, Shield, Unlock, Lock, Volume2, VolumeX, X, ScanFace, Fingerprint, CreditCard, Activity, Filter
} from 'lucide-react';
import API from '@/services/api';

export interface LatestPunchEvent {
  id?: string;
  status: 'granted' | 'already_inside' | 'expired' | 'frozen' | 'unmapped' | 'denied' | string;
  memberName: string;
  memberId?: string | null;
  memberCode?: string;
  biometricId?: string;
  hikvisionUserId?: string | number;
  deviceUserId?: string;
  avatarUrl?: string;
  verificationMethod?: string;
  authenticationType?: string;
  accessResult?: string;
  timestamp: string;
  gateOpened?: boolean;
  doorNo?: number;
  deviceId?: string;
  rawEventId?: string;
  source?: string;
  [key: string]: any;
}

// Synthetic Web Audio API Sound Synthesizer (No external MP3 dependencies)
function playTone(type: 'granted' | 'warning') {
  if (typeof window === 'undefined') return;
  try {
    const soundEnabled = localStorage.getItem('hik_event_sound_enabled') !== 'false';
    if (!soundEnabled) return;

    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();

    if (type === 'granted') {
      // Pleasant dual high chime (C5 -> E5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc1.frequency.exponentialRampToValueAtTime(659.25, ctx.currentTime + 0.15);
      gain1.gain.setValueAtTime(0.2, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start();
      osc1.stop(ctx.currentTime + 0.4);
    } else {
      // Double warning buzz
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sawtooth';
      osc2.frequency.setValueAtTime(220, ctx.currentTime);
      osc2.frequency.setValueAtTime(165, ctx.currentTime + 0.12);
      gain2.gain.setValueAtTime(0.25, ctx.currentTime);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start();
      osc2.stop(ctx.currentTime + 0.4);
    }
  } catch (e) {
    // Graceful silence if browser audio context blocked
  }
}

export function HikvisionEventPopupEngine() {
  const [activePunch, setActivePunch] = useState<LatestPunchEvent | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const seenFingerprints = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('hik_event_sound_enabled');
      setSoundEnabled(stored !== 'false');
    }
  }, []);

  const toggleSound = () => {
    const nextState = !soundEnabled;
    setSoundEnabled(nextState);
    if (typeof window !== 'undefined') {
      localStorage.setItem('hik_event_sound_enabled', String(nextState));
    }
  };

  useEffect(() => {
    const pollLatestPunch = async () => {
      try {
        const res = await API.get('/attendance/latest-punch');
        const punch: LatestPunchEvent = res.data?.latestPunch;
        if (!punch || !punch.timestamp) return;

        const fingerprint = `${punch.biometricId}_${punch.rawEventId || ''}_${punch.timestamp}`;
        if (!seenFingerprints.current.has(fingerprint)) {
          seenFingerprints.current.add(fingerprint);
          if (seenFingerprints.current.size > 200) {
            seenFingerprints.current.clear();
            seenFingerprints.current.add(fingerprint);
          }

          setActivePunch(punch);

          if (punch.status === 'granted' || punch.status === 'already_inside') {
            playTone('granted');
          } else {
            playTone('warning');
          }

          // Auto dismiss after 6 seconds
          setTimeout(() => {
            setActivePunch((current) => (current === punch ? null : current));
          }, 6000);
        }
      } catch (e) {
        // Silent catch for background polling
      }
    };

    pollLatestPunch();
    const interval = setInterval(pollLatestPunch, 1500);
    return () => clearInterval(interval);
  }, []);

  if (!activePunch) return null;

  const isGranted = activePunch.status === 'granted' || activePunch.status === 'already_inside';
  const isUnmapped = activePunch.status === 'unmapped';
  const isDenied = !isGranted && !isUnmapped;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -40, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -20, scale: 0.95 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="fixed top-6 right-6 z-50 max-w-sm w-full shadow-2xl rounded-3xl overflow-hidden border border-white/20 backdrop-blur-md"
      >
        {/* Header Badge */}
        <div className={`p-4 text-white flex items-center justify-between font-black uppercase tracking-wider text-xs ${
          isGranted
            ? 'bg-gradient-to-r from-emerald-600 to-teal-500'
            : isUnmapped
            ? 'bg-gradient-to-r from-[#FF5E14] to-amber-500'
            : 'bg-gradient-to-r from-rose-700 to-red-600'
        }`}>
          <div className="flex items-center gap-2">
            {isGranted ? (
              <>
                <CheckCircle2 size={18} />
                <span>✓ ACCESS GRANTED</span>
              </>
            ) : isUnmapped ? (
              <>
                <AlertTriangle size={18} />
                <span>⚠️ UNKNOWN ACCESS</span>
              </>
            ) : (
              <>
                <XCircle size={18} />
                <span>✕ ACCESS DENIED</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleSound}
              className="p-1 hover:bg-white/20 rounded-lg transition-all cursor-pointer"
              title={soundEnabled ? 'Mute notification sound' : 'Unmute notification sound'}
            >
              {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
            <button
              onClick={() => setActivePunch(null)}
              className="p-1 hover:bg-white/20 rounded-lg transition-all cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div className="bg-white p-5 space-y-4">
          <div className="flex items-center gap-4">
            {/* Avatar / Member Photo */}
            <div className="w-16 h-16 rounded-2xl overflow-hidden shrink-0 border border-slate-200 shadow-sm bg-slate-100 flex items-center justify-center">
              {activePunch.avatarUrl ? (
                <img
                  src={activePunch.avatarUrl}
                  alt={activePunch.memberName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className={`w-full h-full flex items-center justify-center ${
                  isGranted ? 'bg-emerald-50 text-emerald-600' : isUnmapped ? 'bg-orange-50 text-[#FF5E14]' : 'bg-rose-50 text-rose-600'
                }`}>
                  <User size={32} />
                </div>
              )}
            </div>

            {/* Details */}
            <div className="space-y-1">
              <h4 className="text-base font-black text-slate-900 leading-tight">
                {activePunch.memberName}
              </h4>
              <div className="text-xs font-bold text-slate-500">
                {activePunch.memberCode || `User ID: #${activePunch.biometricId || 'N/A'}`}
              </div>
              <div className="text-[11px] font-medium text-slate-400 flex items-center gap-1">
                <ScanFace size={13} className="text-[#FF5E14]" />
                <span>{activePunch.verificationMethod || 'Face Recognition'}</span>
              </div>
            </div>
          </div>

          {/* Door / Relay Operation Status Badge */}
          <div className={`p-3 rounded-2xl border text-xs font-black flex items-center justify-between ${
            activePunch.gateOpened
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-slate-50 text-slate-700 border-slate-200'
          }`}>
            <div className="flex items-center gap-1.5">
              {activePunch.gateOpened ? <Unlock size={14} className="text-emerald-600" /> : <Lock size={14} className="text-slate-500" />}
              <span>{activePunch.gateOpened ? 'TURNSTILE UNLOCKED' : 'DOOR LOCKED'}</span>
            </div>
            <span className="font-mono text-[10px] text-slate-400">
              {new Date(activePunch.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

/**
 * Live Access Activity Section Component for Dashboard Page
 */
export function LiveAccessActivityFeed() {
  const [events, setEvents] = useState<LatestPunchEvent[]>([]);
  const [filter, setFilter] = useState<string>('All');
  const [loading, setLoading] = useState(true);

  const fetchEvents = async () => {
    try {
      const res = await API.get('/devices/hikvision/events');
      if (Array.isArray(res.data)) {
        setEvents(res.data);
      }
    } catch (e) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 3000);
    return () => clearInterval(interval);
  }, []);

  const filtered = events.filter((ev) => {
    if (filter === 'All') return true;
    if (filter === 'Granted') return ev.accessResult === 'GRANTED' || ev.status === 'granted';
    if (filter === 'Denied') return ev.accessResult === 'DENIED' || ev.status === 'denied';
    if (filter === 'Unknown') return ev.status === 'unmapped' || !ev.memberId;
    if (filter === 'Face') return (ev.authenticationType || ev.verificationMethod || '').toLowerCase().includes('face');
    if (filter === 'Fingerprint') return (ev.authenticationType || ev.verificationMethod || '').toLowerCase().includes('fingerprint') || (ev.authenticationType || '').includes('FP');
    if (filter === 'Card') return (ev.authenticationType || ev.verificationMethod || '').toLowerCase().includes('card');
    return true;
  });

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-200/80 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
            <Activity size={18} className="text-[#FF5E14]" /> Live Access Activity
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Real-time biometric punch stream from Hikvision terminal.
          </p>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {['All', 'Granted', 'Denied', 'Unknown', 'Face', 'Fingerprint', 'Card'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                filter === f
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Activity List */}
      <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-slate-400 text-xs font-medium">
            No events found for filter "{filter}".
          </div>
        ) : (
          filtered.map((ev, idx) => {
            const isOk = ev.accessResult === 'GRANTED' || ev.status === 'granted';
            return (
              <div
                key={ev.id || idx}
                className="p-3 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3">
                  <span className={`w-2.5 h-2.5 rounded-full ${isOk ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <div>
                    <div className="font-extrabold text-slate-900">
                      {ev.memberName || `User #${ev.hikvisionUserId || ev.biometricId}`}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      {ev.authenticationType || ev.verificationMethod || 'Biometric'} · Slot #{ev.hikvisionUserId || ev.biometricId}
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                    isOk ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {isOk ? 'Access Granted' : 'Access Denied'}
                  </span>
                  <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                    {new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
