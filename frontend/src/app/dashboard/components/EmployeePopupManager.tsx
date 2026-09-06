'use client';

import React, { useEffect, useState, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db as fDb, isFirebaseReady } from '@/lib/firebase';
import { UserCheck, LogOut, ShieldAlert, X } from 'lucide-react';

export default function EmployeePopupManager() {
  const [activePopup, setActivePopup] = useState<any | null>(null);
  const lastDocId = useRef<string>('');

  useEffect(() => {
    if (!isFirebaseReady || !fDb) return;

    const notifCollection = collection(fDb, 'employeeNotifications');
    const qPop = query(notifCollection, orderBy('createdAt', 'desc'), limit(1));
    let isInitialLoad = true;

    const unsubscribe = onSnapshot(qPop, (snapshot) => {
      if (isInitialLoad) {
        isInitialLoad = false;
        return;
      }

      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const docId = change.doc.id;

          if (docId !== lastDocId.current) {
            lastDocId.current = docId;
            setActivePopup(data);

            // Audio Synthesis voice trigger
            if (data.type === 'checkin' && data.employeeName) {
              try {
                const utterance = new SpeechSynthesisUtterance(`Welcome ${data.employeeName}`);
                window.speechSynthesis.speak(utterance);
              } catch (err) {
                console.warn('Voice synthesis failed', err);
              }
            } else if (data.type === 'checkout' && data.employeeName) {
              try {
                const utterance = new SpeechSynthesisUtterance(`Goodbye ${data.employeeName}`);
                window.speechSynthesis.speak(utterance);
              } catch (err) {
                console.warn('Voice synthesis failed', err);
              }
            }

            // Auto dismiss after 4 seconds
            setTimeout(() => {
              setActivePopup((prev: any) => (prev?.createdAt === data.createdAt ? null : prev));
            }, 4000);
          }
        }
      });
    }, (err) => {
      console.warn("Firestore employeeNotifications query error:", err);
    });

    return () => unsubscribe();
  }, []);

  if (!activePopup) return null;

  // Determine popup color based on role
  let themeColor = 'from-emerald-600 to-teal-500'; // Default Green for Trainer
  let borderColor = 'border-emerald-200';
  let badgeColor = 'bg-emerald-50 text-emerald-600';
  
  if (activePopup.type === 'checkout') {
    themeColor = 'from-orange-500 to-amber-500'; // Orange for checkout
    borderColor = 'border-orange-200';
    badgeColor = 'bg-orange-50 text-orange-600';
  } else if (activePopup.type === 'unknown') {
    themeColor = 'from-rose-600 to-red-500'; // Red for unknown
    borderColor = 'border-rose-250';
    badgeColor = 'bg-rose-50 text-rose-600';
  } else {
    // Role-specific check-ins
    const role = (activePopup.role || '').toLowerCase();
    if (role.includes('trainer')) {
      themeColor = 'from-emerald-600 to-teal-500'; // Green
      borderColor = 'border-emerald-200';
      badgeColor = 'bg-emerald-50 text-emerald-600';
    } else if (role.includes('reception')) {
      themeColor = 'from-blue-600 to-cyan-500'; // Blue
      borderColor = 'border-[#FED7AA]';
      badgeColor = 'bg-[#FFF7ED] text-[#EA580C]';
    } else if (role.includes('manager')) {
      themeColor = 'from-purple-600 to-indigo-500'; // Purple
      borderColor = 'border-purple-200';
      badgeColor = 'bg-purple-50 text-purple-600';
    } else if (role.includes('cleaner') || role.includes('security')) {
      themeColor = 'from-orange-500 to-amber-500'; // Orange
      borderColor = 'border-orange-200';
      badgeColor = 'bg-orange-50 text-orange-600';
    }
  }

  const avatar = activePopup.avatarUrl || `https://api.dicebear.com/7.x/adventurer/svg?seed=${activePopup.employeeName?.replace(/ /g, '')}`;

  return (
    <div className="fixed top-8 right-8 z-[100] w-full max-w-sm">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          className={`bg-white border rounded-[28px] overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.12)] ${borderColor}`}
        >
          {/* Accent Header */}
          <div className={`bg-gradient-to-r ${themeColor} px-5 py-4 text-white flex items-center justify-between`}>
            <div className="flex items-center gap-2">
              {activePopup.type === 'checkout' ? (
                <>
                  <LogOut size={16} />
                  <span className="text-[10px] font-black uppercase tracking-wider">👋 Employee Check-Out</span>
                </>
              ) : activePopup.type === 'unknown' ? (
                <>
                  <ShieldAlert size={16} />
                  <span className="text-[10px] font-black uppercase tracking-wider">🚨 Access Denied</span>
                </>
              ) : (
                <>
                  <UserCheck size={16} />
                  <span className="text-[10px] font-black uppercase tracking-wider">✅ Employee Check-In</span>
                </>
              )}
            </div>
            <button 
              onClick={() => setActivePopup(null)} 
              className="text-white/80 hover:text-white bg-transparent border-none cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>

          {/* Details Content */}
          <div className="p-5 flex gap-4 items-center">
            {activePopup.type === 'unknown' ? (
              <div className="w-12 h-12 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-500 shrink-0">
                <ShieldAlert size={24} />
              </div>
            ) : (
              <img src={avatar} className="w-12 h-12 rounded-full bg-slate-50 border border-slate-100 shrink-0" alt="" />
            )}

            <div className="text-left min-w-0 flex-1">
              {activePopup.type === 'unknown' ? (
                <>
                  <h4 className="text-xs font-black text-slate-900 leading-tight">UNKNOWN BIOMETRIC PUNCH</h4>
                  <div className="text-[9px] text-slate-400 font-bold mt-1">Biometric ID: {activePopup.biometricId}</div>
                  <div className="text-[9px] text-red-500 font-bold mt-0.5">Unknown mapping configuration</div>
                </>
              ) : (
                <>
                  <h4 className="text-xs font-black text-slate-900 leading-tight truncate">{activePopup.employeeName}</h4>
                  <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-wider border ${badgeColor}`}>
                      {activePopup.role}
                    </span>
                    <span className="text-[9.5px] text-slate-400 font-bold font-mono">ID: {activePopup.biometricId}</span>
                  </div>
                </>
              )}

              {/* Extra punch details */}
              <div className="mt-3.5 pt-3.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-[9px] text-slate-400 font-semibold leading-none">
                <div>
                  <span className="block opacity-60">PUNCH TIME</span>
                  <span className="text-slate-800 font-black mt-1 block font-mono">{activePopup.punchTime}</span>
                </div>
                <div>
                  {activePopup.type === 'checkout' ? (
                    <>
                      <span className="block opacity-60">WORKED TODAY</span>
                      <span className="text-orange-600 font-black mt-1 block font-mono">{activePopup.workedToday || '8.0 hrs'}</span>
                    </>
                  ) : (
                    <>
                      <span className="block opacity-60">LOCATION</span>
                      <span className="text-slate-800 font-black mt-1 block">{activePopup.branch || 'Mohali Gate'}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer suggestion line */}
          <div className="bg-slate-50 py-2.5 text-center text-[9px] text-slate-400 font-bold uppercase tracking-wider border-t border-slate-100">
            {activePopup.type === 'checkout' ? 'See you tomorrow!' : activePopup.type === 'unknown' ? 'ACCESS DENIED' : 'Authorized Access'}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
