'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, ChevronDown, Search, Check, UserMinus, Sparkles, Shield, BadgeCheck, Dumbbell, AlertTriangle } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import toast from '@/lib/toast';
import API from '@/services/api';
import PtBillingModal from './PtBillingModal';
import { resolveAvatarUrl, MALE_DEFAULT_AVATAR, FEMALE_DEFAULT_AVATAR } from '@/lib/avatar';

// Deduplicate real trainers from employees collection (NO FAKE DATA)
function deduplicateTrainers(rawList: any[]) {
  const map = new Map<string, any>();
  rawList.forEach((t) => {
    const r = String(t.role || t.type || '').toLowerCase();
    if (!r.includes('trainer') && !r.includes('coach') && !t.isTrainer) return;

    const key = (t.phone && String(t.phone).trim().length >= 8)
      ? String(t.phone).trim()
      : (t.email && String(t.email).trim().length > 3)
      ? String(t.email).trim().toLowerCase()
      : (t.employeeId && !t.employeeId.includes('EMP-AUTO') && String(t.employeeId).trim().length > 0)
      ? String(t.employeeId).trim()
      : String(t.id).trim();

    if (!map.has(key)) {
      map.set(key, t);
    } else {
      const existing = map.get(key);
      const existingEmpId = String(existing.employeeId || '');
      const newEmpId = String(t.employeeId || '');
      if (existingEmpId.includes('AUTO') && !newEmpId.includes('AUTO')) {
        map.set(key, t);
      }
    }
  });
  return Array.from(map.values());
}

export default function TrainerSelectorDropdown({
  member,
  onTrainerUpdated,
}: {
  member: any;
  onTrainerUpdated?: (updatedTrainer: { trainerId: string | null; trainerName: string; trainerRole?: string; trainerAvatar?: string }) => void;
}) {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // PT Billing Modal & Reassignment Modal States
  const [showPtBillingModal, setShowPtBillingModal] = useState(false);
  const [pendingTrainer, setPendingTrainer] = useState<any | null>(null);
  const [showReassignConfirmModal, setShowReassignConfirmModal] = useState(false);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 320 });
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Fetch & deduplicate real trainers only
  useEffect(() => {
    setLoading(true);
    const q = query(collection(db, 'employees'));
    const unsub = onSnapshot(q, (snap) => {
      let rawList = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      let deduped = deduplicateTrainers(rawList);

      if (deduped.length > 0) {
        setTrainers(deduped);
        setLoading(false);
      } else {
        API.get('/employees').then(res => {
          const apiDeduped = deduplicateTrainers(res.data || []);
          setTrainers(apiDeduped);
        }).catch(() => {
          setTrainers([]);
        }).finally(() => setLoading(false));
      }
    }, (err) => {
      console.warn("Trainers listener warning:", err);
      API.get('/employees').then(res => {
        const apiDeduped = deduplicateTrainers(res.data || []);
        setTrainers(apiDeduped);
      }).catch(() => {
        setTrainers([]);
      }).finally(() => setLoading(false));
    });

    return () => unsub();
  }, []);

  // Recalculate position when dropdown opens or window resizes/scrolls
  const updateCoords = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 6,
        left: Math.max(10, Math.min(rect.left + window.scrollX, window.innerWidth - 330)),
        width: 320,
      });
    }
  };

  const handleToggleOpen = () => {
    if (!isOpen) {
      updateCoords();
    }
    setIsOpen(!isOpen);
  };

  // Close dropdown on click outside
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        buttonRef.current && !buttonRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutside);
      window.addEventListener('resize', updateCoords);
      window.addEventListener('scroll', updateCoords, true);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      window.removeEventListener('resize', updateCoords);
      window.removeEventListener('scroll', updateCoords, true);
    };
  }, [isOpen]);

  const currentTrainerName = member?.trainerName || member?.trainer || 'Unassigned';
  const currentTrainerId = member?.trainerId || null;
  const isAssigned = currentTrainerId && currentTrainerId !== 'null' && currentTrainerName !== 'Unassigned';

  const filteredTrainers = trainers.filter((t) => {
    const name = String(t.name || '').toLowerCase();
    const empId = String(t.employeeId || t.id || '').toLowerCase();
    const spec = String(t.specialization || '').toLowerCase();
    const s = search.toLowerCase();
    return name.includes(s) || empId.includes(s) || spec.includes(s);
  });

  // Unassign Trainer
  const handleUnassignTrainer = async () => {
    if (!member || !member.id) return;
    setSaving(true);
    try {
      const updateData = {
        trainerId: null,
        trainerName: 'Unassigned',
        trainer: 'Unassigned',
        trainerRole: null,
        trainerAvatar: null,
        'pt.enabled': false,
        'pt.status': 'INACTIVE',
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'members', member.id), updateData);

      member.trainerId = null;
      member.trainerName = 'Unassigned';
      member.trainer = 'Unassigned';
      member.trainerRole = null;
      member.trainerAvatar = null;
      if (member.pt) member.pt.enabled = false;

      if (onTrainerUpdated) {
        onTrainerUpdated({ trainerId: null, trainerName: 'Unassigned' });
      }

      toast.success('Trainer unassigned');
      setIsOpen(false);
    } catch (err: any) {
      toast.error('Failed to unassign trainer: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  // Direct Reassign Without New Bill (for trainer swap)
  const handleKeepBillingReassign = async () => {
    if (!member || !member.id || !pendingTrainer) return;
    setSaving(true);
    try {
      const newTrainerId = pendingTrainer.employeeId || pendingTrainer.id;
      const newTrainerName = pendingTrainer.name;
      const newTrainerRole = pendingTrainer.specialization || pendingTrainer.role || 'Personal Trainer & Strength';
      const newTrainerAvatar = pendingTrainer.avatarUrl || `https://i.pravatar.cc/150?u=${encodeURIComponent(newTrainerName)}`;

      const updateData = {
        trainerId: newTrainerId,
        trainerName: newTrainerName,
        trainer: newTrainerName,
        trainerRole: newTrainerRole,
        trainerAvatar: newTrainerAvatar,
        'pt.trainerId': newTrainerId,
        'pt.trainerName': newTrainerName,
        'pt.trainerRole': newTrainerRole,
        'pt.trainerAvatar': newTrainerAvatar,
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, 'members', member.id), updateData);

      Object.assign(member, updateData);
      if (member.pt) {
        member.pt.trainerId = newTrainerId;
        member.pt.trainerName = newTrainerName;
      }

      if (onTrainerUpdated) {
        onTrainerUpdated({
          trainerId: newTrainerId,
          trainerName: newTrainerName,
          trainerRole: newTrainerRole,
          trainerAvatar: newTrainerAvatar,
        });
      }

      toast.success(`Assigned trainer: ${newTrainerName}`);
      setShowReassignConfirmModal(false);
      setIsOpen(false);
    } catch (err: any) {
      toast.error('Failed to update trainer: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  // Trigger when a trainer is selected from dropdown
  const handleSelectTrainerOption = (trainer: any) => {
    setIsOpen(false);
    setPendingTrainer(trainer);

    if (isAssigned) {
      // Member already has an assigned trainer -> Ask reassign confirmation
      setShowReassignConfirmModal(true);
    } else {
      // First-time trainer assignment -> Open PT Billing Modal
      setShowPtBillingModal(true);
    }
  };

  return (
    <>
      <div className="relative inline-block text-left">
        <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">
          Assigned Trainer
        </span>

        <button
          ref={buttonRef}
          type="button"
          disabled={saving}
          onClick={handleToggleOpen}
          className={`px-3.5 py-2 border rounded-xl text-xs font-black transition-all flex items-center gap-2 cursor-pointer shadow-sm active:scale-95 disabled:opacity-50 ${
            isAssigned
              ? 'bg-indigo-50 border-indigo-200 text-indigo-900 hover:bg-indigo-100'
              : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
          }`}
        >
          <User size={15} className={isAssigned ? 'text-indigo-600' : 'text-slate-400'} />
          <span>{saving ? 'Updating...' : currentTrainerName}</span>
          <ChevronDown size={14} className="text-slate-400" />
        </button>
      </div>

      {/* PORTAL DROPDOWN MENU — Rendered at root document.body with fixed z-[9999] */}
      {isMounted && isOpen && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            top: `${coords.top}px`,
            left: `${coords.left}px`,
            width: `${coords.width}px`,
          }}
          className="bg-white rounded-2xl shadow-[0_25px_60px_rgba(0,0,0,0.22)] border border-slate-200 p-3 z-[9999] animate-in fade-in select-none font-display text-left"
        >
          {/* Search bar */}
          <div className="relative mb-2">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trainer name, ID..."
              className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Unassign option */}
          <button
            type="button"
            onClick={handleUnassignTrainer}
            className="w-full px-3 py-2.5 text-left hover:bg-rose-50 rounded-xl flex items-center justify-between text-xs font-extrabold text-rose-600 transition-colors border-none bg-transparent cursor-pointer mb-1"
          >
            <div className="flex items-center gap-2">
              <UserMinus size={15} />
              <span>Unassign Trainer</span>
            </div>
            {!isAssigned && <Check size={15} className="text-rose-600" />}
          </button>

          <div className="border-t border-slate-100 my-1.5" />

          {/* Unique Trainers List */}
          <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
            {loading ? (
              <div className="p-4 text-center text-xs font-bold text-slate-400">Loading trainers...</div>
            ) : filteredTrainers.length === 0 ? (
              <div className="p-4 text-center text-xs font-bold text-slate-400">
                {search ? 'No trainers match search' : 'No active trainers available'}
              </div>
            ) : (
              filteredTrainers.map((t) => {
                const isSelected = (currentTrainerId && (currentTrainerId === t.id || currentTrainerId === t.employeeId)) || (currentTrainerName === t.name);
                let empIdBadge = t.employeeId;
                if (!empIdBadge || empIdBadge.length > 15 || empIdBadge.includes('AUTO')) {
                  empIdBadge = `EMP-${t.id ? t.id.slice(0, 5).toUpperCase() : '101'}`;
                }
                const spec = t.specialization || 'Personal Trainer & Strength';
                const avatar = resolveAvatarUrl(t);

                return (
                  <button
                    key={t.id || t.employeeId || t.name}
                    type="button"
                    onClick={() => handleSelectTrainerOption(t)}
                    className={`w-full p-2.5 rounded-xl text-left transition-all border-none cursor-pointer flex items-center justify-between gap-2 ${
                      isSelected ? 'bg-indigo-50/90 text-indigo-900 font-black border border-indigo-200' : 'hover:bg-slate-50 text-slate-800 font-bold'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
                        <img 
                          src={avatar} 
                          onError={(e) => {
                            const target = e.currentTarget;
                            const g = String(t?.gender || '').trim().toLowerCase();
                            target.src = (g === 'female' || g === 'f') ? FEMALE_DEFAULT_AVATAR : MALE_DEFAULT_AVATAR;
                          }}
                          alt={t.name} 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs truncate font-extrabold">{t.name}</span>
                          <span className="text-[9px] font-mono font-black bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
                            {empIdBadge}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">{spec}</div>
                      </div>
                    </div>

                    {isSelected && <Check size={15} className="text-indigo-600 shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>,
        document.body
      )}

      {/* PT BILLING MODAL (Reusable) */}
      {showPtBillingModal && (
        <PtBillingModal
          isOpen={showPtBillingModal}
          onClose={() => setShowPtBillingModal(false)}
          member={member}
          preselectedTrainer={pendingTrainer}
          onSuccess={(updatedMem: any) => {
            if (onTrainerUpdated && updatedMem) {
              onTrainerUpdated({
                trainerId: updatedMem.trainerId,
                trainerName: updatedMem.trainerName,
                trainerRole: updatedMem.trainerRole,
                trainerAvatar: updatedMem.trainerAvatar,
              });
            }
          }}
        />
      )}

      {/* REASSIGN CONFIRMATION MODAL */}
      {showReassignConfirmModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 font-display">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowReassignConfirmModal(false)} />
          <div className="relative bg-white rounded-3xl p-6 shadow-2xl border border-slate-200 max-w-md w-full z-10 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center mx-auto">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-lg">CHANGE PERSONAL TRAINER?</h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Current: <span className="font-black text-slate-800">{currentTrainerName}</span> → New: <span className="font-black text-amber-700">{pendingTrainer?.name}</span>
              </p>
              <p className="text-[11px] text-slate-400 mt-2">
                Choose whether to keep existing PT billing or create a new PT bill.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowReassignConfirmModal(false);
                  setShowPtBillingModal(true);
                }}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl text-xs font-black transition-all border-none cursor-pointer shadow-md"
              >
                + Create New PT Bill
              </button>
              <button
                type="button"
                onClick={handleKeepBillingReassign}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-extrabold transition-all border-none cursor-pointer"
              >
                Keep Existing PT Billing
              </button>
              <button
                type="button"
                onClick={() => setShowReassignConfirmModal(false)}
                className="w-full py-2 text-slate-400 hover:text-slate-700 text-xs font-bold border-none bg-transparent cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
