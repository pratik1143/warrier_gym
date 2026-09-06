'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Check, Info, AlertTriangle, Gift, DollarSign, Dumbbell, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, updateDoc, doc } from 'firebase/firestore';

export default function NotificationCenter({ hideIcon = false }: { hideIcon?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const q = query(collection(db, 'notifications'), orderBy('timestamp', 'desc'), limit(15));
    const unsub = onSnapshot(q, (snap) => {
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() } as any));
      if (notifs.length > 0) {
        setNotifications(notifs);
        setUnreadCount(notifs.filter((n: any) => !n.read).length);
      } else {
        loadDemoNotifications();
      }
    }, (err) => {
      console.warn("Firestore NotificationCenter notifications query error:", err);
      loadDemoNotifications();
    });
    return () => unsub();
  }, []);

  const loadDemoNotifications = () => {
    const demos = [
      { id: 'n1', title: 'Member Check-in Verified', message: 'Rahul Sharma checked in via Main Gate Terminal', type: 'pt', read: false, timestamp: new Date().toISOString() },
      { id: 'n2', title: 'New Lead Enquiry Captured', message: 'Priya Verma requested Quarterly Membership details', type: 'expiry', read: false, timestamp: new Date(Date.now() - 900000).toISOString() },
      { id: 'n3', title: 'Hardware Gate Online', message: 'Hikvision DS-K1T320EFWX Turnstile controller synced & 100% operational', type: 'payment', read: true, timestamp: new Date(Date.now() - 3600000).toISOString() }
    ];
    setNotifications(demos);
    setUnreadCount(demos.filter(n => !n.read).length);
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getIcon = (type: string) => {
    switch (type) {
      case 'expiry': return <AlertTriangle size={14} className="text-red-500" />;
      case 'birthday': return <Gift size={14} className="text-purple-500" />;
      case 'payment': return <DollarSign size={14} className="text-orange-500" />;
      case 'pt': return <Dumbbell size={14} className="text-[#F97316]" />;
      default: return <Info size={14} className="text-slate-500" />;
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (_) {}
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    const unread = notifications.filter(n => !n.read);
    for (const n of unread) {
      try {
        await updateDoc(doc(db, 'notifications', n.id), { read: true });
      } catch (_) {}
    }
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  if (hideIcon) {
    return null;
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative w-10 h-10 rounded-xl bg-white hover:bg-slate-50 text-slate-600 flex items-center justify-center shadow-xs cursor-pointer border border-slate-200 transition-colors"
      >
        <Bell size={15} />
        {unreadCount > 0 && (
          <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-red-500 rounded-full animate-pulse border border-white" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-0 mt-3 w-80 max-w-[calc(100vw-32px)] bg-white rounded-3xl shadow-[0_20px_60px_rgba(0,0,0,0.18)] border border-slate-200/80 overflow-hidden z-[9999] flex flex-col"
          >
            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-sm font-black text-slate-800">Notifications</h3>
              {unreadCount > 0 && (
                <button onClick={markAllAsRead} className="text-[10px] font-bold text-[#EA580C] hover:text-[#9A3412] border-none bg-transparent cursor-pointer">
                  Mark all read
                </button>
              )}
            </div>

            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs font-semibold">
                  No new notifications
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {notifications.map((notif) => (
                    <div 
                      key={notif.id} 
                      className={`p-4 hover:bg-slate-50 transition-colors cursor-pointer flex gap-3 ${!notif.read ? 'bg-orange-50/60' : ''}`}
                      onClick={() => {
                        if (!notif.read) markAsRead(notif.id);
                      }}
                    >
                      <div className={`mt-0.5 w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${!notif.read ? 'bg-white shadow-xs border border-slate-100' : 'bg-slate-100'}`}>
                        {getIcon(notif.type)}
                      </div>
                      <div className="flex-1">
                        <h4 className={`text-xs ${!notif.read ? 'font-black text-slate-900' : 'font-semibold text-slate-600'}`}>
                          {notif.title}
                        </h4>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{notif.message}</p>
                        <span className="text-[9px] font-bold text-slate-400 mt-1 block">
                          {notif.timestamp ? (
                            typeof notif.timestamp.toDate === 'function' 
                              ? notif.timestamp.toDate().toLocaleString() 
                              : new Date(notif.timestamp).toLocaleString()
                          ) : 'Just now'}
                        </span>
                      </div>
                      {!notif.read && <div className="w-1.5 h-1.5 rounded-full bg-[#F97316] mt-1 shrink-0" />}
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="p-3 border-t border-slate-100 bg-slate-50/50 text-center">
              <button 
                onClick={() => setIsOpen(false)}
                className="text-[10px] font-black text-slate-500 hover:text-slate-800 uppercase tracking-wider border-none bg-transparent cursor-pointer"
              >
                Close
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
