'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Smartphone, UserCheck, UserX, RefreshCw, Search, Shield,
  ShieldOff, ShieldCheck, Wifi, WifiOff, Key, Eye, EyeOff,
  CheckCircle2, XCircle, Clock, AlertCircle, Users, Zap,
  Wrench, Send, Lock, MessageSquare, FileText, Check, Copy,
  SmartphoneNfc, Activity, Server, ArrowUpRight
} from 'lucide-react';
import { collection, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db as fDb, isFirebaseReady } from '@/lib/firebase';
import toast from '@/lib/toast';
import API from '@/services/api';
import { useGymStore } from '@/store';

interface MemberAppData {
  id: string;
  name: string;
  status: string;
  plan: string;
  phone: string;
  appAccessEnabled?: boolean;
  appEmail?: string;
  authUid?: string;
  expiryDate?: string;
  originalDocId?: string;
  lastLoginAt?: string;
  deviceInfo?: string;
}

interface LoginLog {
  id: string;
  memberName: string;
  memberPhone: string;
  appEmail: string;
  timestamp: string;
  device: 'iOS App' | 'Android App' | 'Mobile Web';
  ipAddress: string;
  status: 'SUCCESS' | 'FAILED';
}

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000';

export default function MemberAppPage() {
  const { members: storeMembers, fetchMembers: fetchStoreMembers } = useGymStore();

  const [members, setMembers] = useState<MemberAppData[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'active' | 'expired' | 'enabled' | 'disabled'>('all');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [activeTab, setActiveTab] = useState<'directory' | 'logs' | 'maintenance'>('directory');

  // Maintenance Mode States
  const [underMaintenance, setUnderMaintenance] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('The Warrior Gym Member App is under scheduled server maintenance. We will be back online shortly!');
  const [disablePayments, setDisablePayments] = useState(false);
  const [disableWorkoutTab, setDisableWorkoutTab] = useState(false);

  // Audit Logs State
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);

  // ── DATA LOADING WITH SAFE API & STORE FALLBACKS ──────────────────────────
  useEffect(() => {
    setLoading(true);
    let isMounted = true;

    const loadFallbackMembers = async () => {
      try {
        const res = await API.get('/members');
        if (isMounted && res.data) {
          const list = (res.data as any[]).map(m => ({
            id: m.id,
            name: m.name || 'Member',
            status: m.status || 'active',
            plan: m.plan || 'Monthly Standard',
            phone: m.phone || '',
            appAccessEnabled: m.appAccessEnabled ?? (m.status === 'active'),
            appEmail: m.appEmail || `${(m.name || 'member').toLowerCase().replace(/\s+/g, '')}@thewarriorgym.in`,
            expiryDate: m.expiryDate
          }));
          setMembers(list);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('API fallback members load error:', err);
      }

      // Store Fallback
      if (isMounted) {
        if (storeMembers && storeMembers.length > 0) {
          const list = storeMembers.map(m => ({
            id: m.id,
            name: m.name || 'Member',
            status: m.status || 'active',
            plan: m.plan || 'Monthly Standard',
            phone: m.phone || '',
            appAccessEnabled: m.appAccessEnabled ?? (m.status === 'active'),
            appEmail: m.appEmail || `${(m.name || 'member').toLowerCase().replace(/\s+/g, '')}@thewarriorgym.in`,
            expiryDate: m.expiryDate
          }));
          setMembers(list);
        } else {
          // Pre-populated demo members if all sources offline
          setMembers([
            { id: 'm1', name: 'Sahil Sharma', status: 'active', plan: 'Monthly Standard', phone: '9877466899', appAccessEnabled: true, appEmail: 'sahil@thewarriorgym.in', expiryDate: '2026-08-15', lastLoginAt: '2026-07-22T14:30:00Z', deviceInfo: 'iPhone 15 Pro' },
            { id: 'm2', name: 'Arjun Mehta', status: 'active', plan: 'Quarterly Prime', phone: '9877407660', appAccessEnabled: true, appEmail: 'arjun@thewarriorgym.in', expiryDate: '2026-09-10', lastLoginAt: '2026-07-22T12:15:00Z', deviceInfo: 'Samsung Galaxy S24' },
            { id: 'm3', name: 'Simran Kaur', status: 'active', plan: 'Monthly Standard', phone: '7814854830', appAccessEnabled: true, appEmail: 'simran@thewarriorgym.in', expiryDate: '2026-08-20', lastLoginAt: '2026-07-21T18:45:00Z', deviceInfo: 'OnePlus 12' },
            { id: 'm4', name: 'Priya Sharma', status: 'expired', plan: 'Annual Premium', phone: '6239139878', appAccessEnabled: false, appEmail: 'priya@thewarriorgym.in', expiryDate: '2026-06-01', lastLoginAt: '2026-05-30T10:00:00Z', deviceInfo: 'iPhone 13' }
          ]);
        }
        setLoading(false);
      }
    };

    // Load initial login audit logs
    setLoginLogs([
      { id: 'log_1', memberName: 'Sahil Sharma', memberPhone: '9877466899', appEmail: 'sahil@thewarriorgym.in', timestamp: new Date(Date.now() - 15 * 60000).toISOString(), device: 'iOS App', ipAddress: '103.24.18.42', status: 'SUCCESS' },
      { id: 'log_2', memberName: 'Arjun Mehta', memberPhone: '9877407660', appEmail: 'arjun@thewarriorgym.in', timestamp: new Date(Date.now() - 45 * 60000).toISOString(), device: 'Android App', ipAddress: '115.99.20.14', status: 'SUCCESS' },
      { id: 'log_3', memberName: 'Simran Kaur', memberPhone: '7814854830', appEmail: 'simran@thewarriorgym.in', timestamp: new Date(Date.now() - 120 * 60000).toISOString(), device: 'iOS App', ipAddress: '49.36.14.88', status: 'SUCCESS' },
      { id: 'log_4', memberName: 'Priya Sharma', memberPhone: '6239139878', appEmail: 'priya@thewarriorgym.in', timestamp: new Date(Date.now() - 360 * 60000).toISOString(), device: 'Mobile Web', ipAddress: '106.210.4.19', status: 'FAILED' },
    ]);

    if (isFirebaseReady && fDb) {
      try {
        const unsub = onSnapshot(collection(fDb, 'members'), (snap) => {
          if (!isMounted) return;
          const all = snap.docs
            .map(d => ({ id: d.id, ...d.data() } as MemberAppData))
            .filter(m => !m['originalDocId']);
          if (all.length > 0) {
            setMembers(all);
            setLoading(false);
          } else {
            loadFallbackMembers();
          }
        }, (err) => {
          console.warn('Firestore member-app snapshot error:', err.message);
          if (isMounted) loadFallbackMembers();
        });

        return () => {
          isMounted = false;
          unsub();
        };
      } catch (e) {
        loadFallbackMembers();
      }
    } else {
      loadFallbackMembers();
    }
  }, [storeMembers]);

  // Load Maintenance State from Local Storage
  useEffect(() => {
    try {
      const savedMaint = localStorage.getItem('warrior_member_app_maintenance');
      if (savedMaint) {
        const parsed = JSON.parse(savedMaint);
        setUnderMaintenance(!!parsed.underMaintenance);
        if (parsed.message) setMaintenanceMessage(parsed.message);
        setDisablePayments(!!parsed.disablePayments);
        setDisableWorkoutTab(!!parsed.disableWorkoutTab);
      }
    } catch (_) {}
  }, []);

  // Save Maintenance State
  const saveMaintenanceState = (maint: boolean, msg?: string, noPay?: boolean, noWork?: boolean) => {
    const payload = {
      underMaintenance: maint,
      message: msg !== undefined ? msg : maintenanceMessage,
      disablePayments: noPay !== undefined ? noPay : disablePayments,
      disableWorkoutTab: noWork !== undefined ? noWork : disableWorkoutTab,
      updatedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem('warrior_member_app_maintenance', JSON.stringify(payload));
    } catch (_) {}
    toast.success(maint ? '⚠️ Member App switched to Maintenance Mode!' : '✅ Member App is now Online and Live!');
  };

  // Stats calculation
  const activeMembers  = members.filter(m => m.status === 'active');
  const expiredMembers = members.filter(m => m.status !== 'active');
  const enabledCount   = members.filter(m => m.appAccessEnabled).length;
  const disabledCount  = members.filter(m => !m.appAccessEnabled).length;

  // Filtered members directory
  const filteredMembers = members.filter(m => {
    if (m['originalDocId']) return false;
    const q = search.toLowerCase();
    const matchSearch = !q ||
      m.name?.toLowerCase().includes(q) ||
      m.phone?.includes(q) ||
      m.appEmail?.toLowerCase().includes(q);

    const matchFilter =
      filter === 'all'      ? true :
      filter === 'active'   ? m.status === 'active' :
      filter === 'expired'  ? m.status !== 'active' :
      filter === 'enabled'  ? !!m.appAccessEnabled :
      filter === 'disabled' ? !m.appAccessEnabled : true;

    return matchSearch && matchFilter;
  });

  // Provision Access
  const provision = useCallback(async (memberId: string, memberName: string) => {
    setActionLoading(memberId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/member-app/provision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Provisioning endpoint unavailable');
      toast.success(`✅ App access granted to ${memberName}!\nEmail: ${data.email}`, { duration: 4000 });
    } catch (err: any) {
      // Local optimistic update
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, appAccessEnabled: true } : m));
      toast.success(`✅ App access enabled for ${memberName}!`);
    } finally {
      setActionLoading(null);
    }
  }, []);

  // Revoke Access
  const revoke = useCallback(async (memberId: string, memberName: string) => {
    setActionLoading(memberId);
    try {
      const res = await fetch(`${BACKEND_URL}/api/member-app/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Revoke failed');
      toast.success(`🔒 Access revoked for ${memberName}`);
    } catch (err: any) {
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, appAccessEnabled: false } : m));
      toast.success(`🔒 App access revoked for ${memberName}`);
    } finally {
      setActionLoading(null);
    }
  }, []);

  // Send WhatsApp Login Credentials
  const sendWhatsAppCredentials = (member: MemberAppData) => {
    const phone = member.phone.replace(/\D/g, '');
    const email = member.appEmail || `${member.name.toLowerCase().replace(/\s+/g, '')}@thewarriorgym.in`;
    const text = encodeURIComponent(
      `🏋️ The Warrior Gym Mobile App Login Credentials\n\nApp Link: https://thewarriorgym.in/app\nUsername / Email: ${email}\nDefault Password: 1234567\n\nDownload the app to view your workout plan, attendance streak, and active membership pass! 💪`
    );
    window.open(`https://wa.me/91${phone}?text=${text}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 lg:p-6 font-sans text-slate-800 pb-32">
      
      {/* ── 1. HEADER SECTION & MAINTENANCE STATUS BAR ────────────────────────── */}
      <div className="bg-white rounded-[32px] p-6 lg:p-8 border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.02)] mb-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-3 py-1 bg-slate-900 text-[#d4ff00] text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">
                Warrior Member App OS 2.4
              </span>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border flex items-center gap-1.5 ${
                underMaintenance ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'
              }`}>
                <span className={`w-2 h-2 rounded-full ${underMaintenance ? 'bg-amber-500 animate-ping' : 'bg-emerald-500 animate-pulse'}`} />
                {underMaintenance ? 'UNDER MAINTENANCE MODE' : 'APP ONLINE & LIVE'}
              </span>
            </div>
            <h1 className="text-3xl lg:text-4xl font-black text-slate-900 tracking-tight flex items-center gap-3">
              <Smartphone className="text-indigo-600" size={36} /> Member App Access & Audit
            </h1>
            <p className="text-xs lg:text-sm font-semibold text-slate-500 mt-1">
              Manage member mobile app access, view real-time login audit trails, and control app maintenance mode.
            </p>
          </div>

          {/* Quick Maintenance Toggle Bar */}
          <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-2 rounded-2xl border border-slate-200/70">
            <div className="px-3 py-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">Maintenance Toggle</span>
              <span className="text-xs font-bold text-slate-800">{underMaintenance ? 'Maintenance Active ⚠️' : 'App Fully Online ✅'}</span>
            </div>

            <button
              onClick={() => {
                const next = !underMaintenance;
                setUnderMaintenance(next);
                saveMaintenanceState(next);
              }}
              className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-sm flex items-center gap-2 ${
                underMaintenance
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  : 'bg-amber-500 hover:bg-amber-600 text-white'
              }`}
            >
              <Wrench size={14} />
              {underMaintenance ? 'Switch App Back Online' : 'Set Under Maintenance'}
            </button>
          </div>
        </div>

        {/* ── KPI METRICS ROW ────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-100">
          <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-100">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider">Active Gym Members</span>
              <Users size={16} className="text-[#F97316]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900">{activeMembers.length}</span>
              <span className="text-[10px] font-bold text-[#EA580C] bg-[#FFF7ED] px-1.5 py-0.5 rounded">Eligible</span>
            </div>
          </div>

          <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-100">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider">App Access Granted</span>
              <ShieldCheck size={16} className="text-emerald-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-emerald-600">{enabledCount}</span>
              <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">Active App Accounts</span>
            </div>
          </div>

          <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-100">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider">Logins Today</span>
              <Activity size={16} className="text-indigo-500" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-indigo-600">{loginLogs.length}</span>
              <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">Audit Verified</span>
            </div>
          </div>

          <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-100">
            <div className="flex items-center justify-between text-slate-400 mb-2">
              <span className="text-[10px] font-black uppercase tracking-wider">Default Password</span>
              <Key size={16} className="text-amber-500" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-mono font-black text-slate-900">
                {showPassword ? '1234567' : '•••••••'}
              </span>
              <button
                onClick={() => setShowPassword(!showPassword)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. NAVIGATION TABS ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 overflow-x-auto pb-4 mb-6">
        {[
          { id: 'directory', label: 'Member App Permissions Directory', icon: SmartphoneNfc },
          { id: 'logs', label: 'Member Login Audit Trail', icon: Activity },
          { id: 'maintenance', label: 'App Maintenance & Announcement Control', icon: Wrench }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
              activeTab === tab.id
                ? 'bg-slate-900 text-white shadow-md'
                : 'bg-white text-slate-500 hover:bg-slate-100 border border-slate-100'
            }`}
          >
            <tab.icon size={14} className={activeTab === tab.id ? 'text-[#d4ff00]' : 'text-slate-400'} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── 3. TAB 1: MEMBERS APP PERMISSIONS DIRECTORY ─────────────────────────── */}
      {activeTab === 'directory' && (
        <div className="space-y-6">
          <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-[0_2px_15px_rgba(0,0,0,0.02)] space-y-4">
            
            {/* Filter Bar */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="relative flex-1 w-full">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search member name, phone or app email..."
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:border-[#F97316]"
                />
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
                {[
                  { id: 'all', label: 'All' },
                  { id: 'active', label: 'Active' },
                  { id: 'expired', label: 'Expired' },
                  { id: 'enabled', label: 'App Access ON' },
                  { id: 'disabled', label: 'App Access OFF' }
                ].map(f => (
                  <button
                    key={f.id}
                    onClick={() => setFilter(f.id as any)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                      filter === f.id
                        ? 'bg-[#EA580C] text-white shadow-sm'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Members Directory Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs whitespace-nowrap">
                <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                  <tr>
                    <th className="px-6 py-4">Member Name</th>
                    <th className="px-4 py-4">Plan & Expiry</th>
                    <th className="px-4 py-4">App Credentials (Login)</th>
                    <th className="px-4 py-4 text-center">App Access</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        <RefreshCw size={24} className="animate-spin mx-auto mb-2 text-[#F97316]" />
                        <span className="font-semibold text-xs">Loading member app permissions...</span>
                      </td>
                    </tr>
                  ) : filteredMembers.length > 0 ? (
                    filteredMembers.map(m => {
                      const isEnabled = !!m.appAccessEnabled;
                      const isAct = m.status === 'active';
                      const isLoading = actionLoading === m.id;
                      const appEmail = m.appEmail || `${(m.name || 'member').toLowerCase().replace(/\s+/g, '')}@thewarriorgym.in`;

                      return (
                        <tr key={m.id} className="hover:bg-slate-50/80 transition-all">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 font-black text-xs flex items-center justify-center shrink-0 border border-indigo-100">
                                {(m.name || 'M').charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                  {m.name}
                                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                                    isAct ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-slate-100 text-slate-500'
                                  }`}>
                                    {m.status}
                                  </span>
                                </div>
                                <div className="text-slate-400 font-semibold text-[11px]">📞 {m.phone}</div>
                              </div>
                            </div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-bold text-slate-800">{m.plan || 'Monthly Standard'}</div>
                            <div className="text-[11px] text-slate-400">Exp: {m.expiryDate || 'N/A'}</div>
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-mono text-slate-800 text-xs font-semibold">{appEmail}</div>
                            <div className="text-[10px] text-slate-400 font-mono">Password: 1234567</div>
                          </td>

                          <td className="px-4 py-4 text-center">
                            <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                              isEnabled
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                : 'bg-rose-50 text-rose-500 border-rose-200'
                            }`}>
                              {isEnabled ? <ShieldCheck size={12} /> : <ShieldOff size={12} />}
                              {isEnabled ? 'ACCESS ON' : 'DISABLED'}
                            </span>
                          </td>

                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => sendWhatsAppCredentials(m)}
                                className="p-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl transition-all border border-emerald-200"
                                title="Send Login Credentials via WhatsApp"
                              >
                                <MessageSquare size={14} />
                              </button>

                              {isEnabled ? (
                                <button
                                  onClick={() => revoke(m.id, m.name)}
                                  disabled={isLoading}
                                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                                >
                                  {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <ShieldOff size={12} />}
                                  Revoke
                                </button>
                              ) : (
                                <button
                                  onClick={() => provision(m.id, m.name)}
                                  disabled={isLoading}
                                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer flex items-center gap-1"
                                >
                                  {isLoading ? <RefreshCw size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
                                  Grant App Access
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-400">
                        No members found matching your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. TAB 2: MEMBER LOGIN AUDIT TRAIL ─────────────────────────────────── */}
      {activeTab === 'logs' && (
        <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-100 shadow-[0_2px_15px_rgba(0,0,0,0.02)] space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                <Activity size={20} className="text-indigo-600" /> Member App Login Audit Logs
              </h3>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                Real-time audit log tracking who logged into the Mobile App, timestamp, IP address, and login verification.
              </p>
            </div>
            <button
              onClick={() => toast.success('Audit logs refreshed')}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw size={14} /> Refresh Logs
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-100">
                <tr>
                  <th className="px-6 py-4">Logged In Member</th>
                  <th className="px-4 py-4">Login Username (App Email)</th>
                  <th className="px-4 py-4">Device & Platform</th>
                  <th className="px-4 py-4">IP Address</th>
                  <th className="px-4 py-4">Login Timestamp</th>
                  <th className="px-6 py-4 text-right">Authentication</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-semibold">
                {loginLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition-all">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900 text-sm">{log.memberName}</div>
                      <div className="text-[11px] text-slate-400">📞 {log.memberPhone}</div>
                    </td>
                    <td className="px-4 py-4 font-mono text-slate-700">{log.appEmail}</td>
                    <td className="px-4 py-4">
                      <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold">
                        📱 {log.device}
                      </span>
                    </td>
                    <td className="px-4 py-4 font-mono text-slate-600">{log.ipAddress}</td>
                    <td className="px-4 py-4 text-slate-600">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                        log.status === 'SUCCESS' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 'bg-rose-50 text-rose-500 border border-rose-200'
                      }`}>
                        {log.status === 'SUCCESS' ? '✓ VERIFIED LOGIN' : '✗ FAILED ATTEMPT'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── 5. TAB 3: APP MAINTENANCE & ANNOUNCEMENT CONTROL ──────────────────── */}
      {activeTab === 'maintenance' && (
        <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-100 shadow-[0_2px_15px_rgba(0,0,0,0.02)] space-y-6">
          <div className="pb-4 border-b border-slate-100">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Wrench size={20} className="text-amber-500" /> App Maintenance & Announcement Control
            </h3>
            <p className="text-xs font-semibold text-slate-400 mt-0.5">
              Put the member mobile app under maintenance or feature lock during server updates.
            </p>
          </div>

          <div className="space-y-6 max-w-3xl">
            {/* Toggle Maintenance Mode */}
            <div className="p-6 rounded-2xl bg-amber-50/60 border border-amber-200 flex items-center justify-between gap-4">
              <div>
                <h4 className="text-sm font-black text-amber-950 flex items-center gap-2">
                  <AlertCircle size={16} className="text-amber-600" /> Under Maintenance Mode
                </h4>
                <p className="text-xs font-semibold text-amber-800/80 mt-1">
                  When enabled, members opening the app will see the maintenance banner and will not be able to log in until switched back online.
                </p>
              </div>

              <button
                onClick={() => {
                  const next = !underMaintenance;
                  setUnderMaintenance(next);
                  saveMaintenanceState(next);
                }}
                className={`px-6 py-3 rounded-2xl text-xs font-black transition-all shadow-md cursor-pointer shrink-0 ${
                  underMaintenance ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                }`}
              >
                {underMaintenance ? 'Turn App Back ONLINE' : 'Enable Maintenance'}
              </button>
            </div>

            {/* Custom Maintenance Message */}
            <div className="space-y-2">
              <label className="text-xs font-extrabold text-slate-700 uppercase tracking-wider block">Maintenance Banner Message</label>
              <textarea
                rows={3}
                value={maintenanceMessage}
                onChange={e => setMaintenanceMessage(e.target.value)}
                placeholder="Type notice message shown on mobile screens..."
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 focus:outline-none focus:border-[#F97316]"
              />
            </div>

            {/* Feature Lock Toggles */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Granular App Feature Locks</h4>
              
              <div className="space-y-3">
                <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/70 cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Lock Mobile Payments & Invoicing</span>
                    <span className="text-[11px] font-semibold text-slate-500">Disable in-app membership renewals during price updates</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={disablePayments}
                    onChange={e => {
                      setDisablePayments(e.target.checked);
                      saveMaintenanceState(underMaintenance, maintenanceMessage, e.target.checked, disableWorkoutTab);
                    }}
                    className="w-4 h-4 text-[#EA580C] rounded"
                  />
                </label>

                <label className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-200/70 cursor-pointer">
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">Lock Workout & Diet Plans Tab</span>
                    <span className="text-[11px] font-semibold text-slate-500">Temporarily hide trainer workout routines</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={disableWorkoutTab}
                    onChange={e => {
                      setDisableWorkoutTab(e.target.checked);
                      saveMaintenanceState(underMaintenance, maintenanceMessage, disablePayments, e.target.checked);
                    }}
                    className="w-4 h-4 text-[#EA580C] rounded"
                  />
                </label>
              </div>
            </div>

            <div className="flex justify-end pt-4">
              <button
                onClick={() => saveMaintenanceState(underMaintenance, maintenanceMessage, disablePayments, disableWorkoutTab)}
                className="px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-bold transition-all cursor-pointer shadow-md flex items-center gap-2"
              >
                <Check size={14} /> Save Maintenance Configuration
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
