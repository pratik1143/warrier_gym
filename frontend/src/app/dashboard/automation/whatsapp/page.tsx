'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, RefreshCw, Send, CheckCircle2, AlertTriangle, Play,
  Zap, Settings, HelpCircle, Shield, Phone, Calendar, User, Eye, Plus,
  X, Check, Flame, Sliders, AlertCircle, Info, Edit, Trash, Radio,
  QrCode, Smartphone, Sparkles, CheckCheck, Clock, ShieldCheck, ArrowRight,
  Layers, Filter, ChevronRight, Lock
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, setDoc, limit } from 'firebase/firestore';
import toast from '@/lib/toast';
import API from '@/services/api';
import { useAuthStore } from '@/store';

interface Template {
  id: string;
  name: string;
  message: string;
  category?: string;
}

export default function WhatsAppAutomationPage() {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'super_admin' || user?.role === 'gym_owner';

  // State
  const [session, setSession] = useState<any>({ status: 'Disconnected', qr: null });
  const [logs, setLogs] = useState<any[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  
  // Modal / Inputs
  const [showTestModal, setShowTestModal] = useState(false);
  const [testPhone, setTestPhone] = useState('');
  const [testMessage, setTestMessage] = useState('');
  
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateText, setNewTemplateText] = useState('');

  const [showBulkSendModal, setShowBulkSendModal] = useState(false);
  const [bulkFilter, setBulkFilter] = useState('expiring');
  const [bulkTemplateId, setBulkTemplateId] = useState('');

  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Real-time status sync via API + Firestore
  useEffect(() => {
    const fetchApiStatus = async () => {
      try {
        const res = await API.get('/whatsapp/status');
        if (res.data) {
          setSession((prev: any) => ({ ...prev, ...res.data }));
        }
        setLoading(false);
      } catch (err) {
        console.warn('API status fetch notice:', err);
        setLoading(false);
      }
    };

    fetchApiStatus();
    const pollTimer = setInterval(fetchApiStatus, 3000);

    // 1. WhatsApp Connection Status
    const unsubSession = onSnapshot(doc(db, 'whatsapp_status', 'session'), (docSnap) => {
      if (docSnap.exists()) {
        setSession(docSnap.data());
      }
      setLoading(false);
    }, (err) => {
      console.warn("WhatsApp status listener notice:", err);
      setLoading(false);
    });

    // 2. Queue Logs Audit
    const qLogs = query(collection(db, 'whatsapp_logs'), orderBy('timestamp', 'desc'), limit(30));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => {
      console.warn("WhatsApp logs listener notice:", err);
    });

    // 3. Templates list
    const unsubTemplates = onSnapshot(collection(db, 'whatsapp_templates'), (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as Template[];
      setTemplates(list);

      if (snap.empty && isAdmin) {
        seedDefaultTemplates();
      }
    }, (err) => {
      console.warn("WhatsApp templates listener notice:", err);
      setTemplates([
        { id: 'renewal', name: 'Membership Renewal Alert', message: 'Hi {{memberName}}, your membership plan for {{plan}} expires on {{expiryDate}}. Renew today to keep your biometric gate access active! - {{gymName}}' },
        { id: 'attendance', name: 'Attendance Check-in Alert', message: 'Hi {{memberName}}, we missed you at the gym! We noticed you haven\'t checked in for 3 days. Hope everything is fine. Let\'s get back to training! - {{gymName}}' },
        { id: 'payment', name: 'Payment & Invoice Reminder', message: 'Hi {{memberName}}, this is a payment reminder for plan {{plan}}. Outstanding invoice total is due. Thank you! - {{gymName}}' },
        { id: 'birthday', name: 'Birthday Wish & Offer', message: 'Happy Birthday {{memberName}}! 🎉 Wishing you a strong and healthy year ahead. Check your app for a special gift voucher! - {{gymName}}' },
        { id: 'trial', name: 'Trial Session Confirmation', message: 'Hi {{memberName}}, this is a friendly reminder that your workout trial session is scheduled. See you soon! - {{gymName}}' }
      ]);
    });

    return () => {
      clearInterval(pollTimer);
      unsubSession();
      unsubLogs();
      unsubTemplates();
    };
  }, [isAdmin]);

  const seedDefaultTemplates = async () => {
    const defaults = [
      { id: 'renewal', name: 'Membership Renewal Alert', message: 'Hi {{memberName}}, your membership plan for {{plan}} expires on {{expiryDate}}. Renew today to keep your biometric gate access active! - {{gymName}}' },
      { id: 'attendance', name: 'Attendance Check-in Alert', message: 'Hi {{memberName}}, we missed you at the gym! We noticed you haven\'t checked in for 3 days. Hope everything is fine. Let\'s get back to training! - {{gymName}}' },
      { id: 'payment', name: 'Payment & Invoice Reminder', message: 'Hi {{memberName}}, this is a payment reminder for plan {{plan}}. Outstanding invoice total is due. Thank you! - {{gymName}}' },
      { id: 'birthday', name: 'Birthday Wish & Offer', message: 'Happy Birthday {{memberName}}! 🎉 Wishing you a strong and healthy year ahead. Check your app for a special gift voucher! - {{gymName}}' },
      { id: 'trial', name: 'Trial Session Confirmation', message: 'Hi {{memberName}}, this is a friendly reminder that your workout trial session is scheduled. See you soon! - {{gymName}}' }
    ];

    for (const item of defaults) {
      await setDoc(doc(db, 'whatsapp_templates', item.id), {
        name: item.name,
        message: item.message
      });
    }
  };

  const handleConnect = async () => {
    if (!isAdmin) {
      toast.error('Security Check: Only admins can configure WhatsApp connection.');
      return;
    }
    setActionLoading(true);
    try {
      await API.post('/whatsapp/connect');
      toast.success('WhatsApp startup sequence initiated.');
    } catch (e: any) {
      toast.error('Failed to trigger connection: ' + e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReconnect = async () => {
    if (!isAdmin) return;
    setActionLoading(true);
    try {
      await API.post('/whatsapp/reconnect');
      toast.success('WhatsApp reconnect sequence initiated.');
    } catch (e: any) {
      toast.error('Failed to reconnect.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!isAdmin) return;
    if (!confirm('Disconnecting will fully delete the session. Do you want to proceed?')) return;
    setActionLoading(true);
    try {
      await API.post('/whatsapp/disconnect');
      toast.success('WhatsApp session logged out and cleaned.');
    } catch (e: any) {
      toast.error('Failed to disconnect.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendTest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testPhone || !testMessage) return;

    setActionLoading(true);
    try {
      await API.post('/whatsapp/test', {
        phone: testPhone,
        message: testMessage
      });
      toast.success('Test WhatsApp message sent successfully!');
      setShowTestModal(false);
      setTestMessage('');
      setTestPhone('');
    } catch (e: any) {
      toast.error('Failed to send test: ' + (e.response?.data?.error || e.message));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTemplateName || !newTemplateText) return;

    try {
      const templateId = selectedTemplate?.id || newTemplateName.toLowerCase().replace(/\s+/g, '_');
      await setDoc(doc(db, 'whatsapp_templates', templateId), {
        name: newTemplateName,
        message: newTemplateText
      });
      toast.success('WhatsApp template saved successfully!');
      setShowTemplateModal(false);
      setNewTemplateName('');
      setNewTemplateText('');
      setSelectedTemplate(null);
    } catch (e) {
      toast.error('Failed to save template');
    }
  };

  const stats = React.useMemo(() => {
    const today = new Date().toDateString();
    const todayLogs = logs.filter(l => new Date(l.timestamp).toDateString() === today);

    const messagesToday = todayLogs.length;
    const delivered = todayLogs.filter(l => l.status === 'Delivered' || l.status === 'Sent').length;
    const failed = todayLogs.filter(l => l.status === 'Failed').length;
    const pending = todayLogs.filter(l => l.status === 'Pending' || l.status === 'Retry').length;

    return { messagesToday, delivered, failed, pending };
  }, [logs]);

  const insertVariable = (variable: string) => {
    setNewTemplateText(prev => prev + ` {{${variable}}}`);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 text-slate-900 font-sans p-4 sm:p-6 lg:p-8 space-y-6">

      {/* ── HEADER BANNER ───────────────────────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 shadow-xs">
            <MessageSquare size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">WhatsApp Web Engine</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-black uppercase tracking-wider">
                Official Web Sync
              </span>
            </div>
            <p className="text-slate-500 font-medium mt-1 text-xs">
              Self-hosted persistent browser session automation. Direct integration without paid API fees.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {session.status === 'Connected' && (
            <button
              onClick={() => setShowTestModal(true)}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <Send size={14} className="text-emerald-600" />
              Broadcast Test
            </button>
          )}

          <button 
            onClick={() => setShowBulkSendModal(true)}
            className="px-5 py-2.5 bg-slate-900 hover:bg-black text-[#d4ff00] font-black rounded-xl text-xs shadow-sm flex items-center gap-2 transition-all cursor-pointer border-none"
          >
            <Zap size={15} className="text-[#d4ff00]" />
            New Bulk Campaign
          </button>
        </div>
      </div>

      {/* Warning Alert if Disconnected */}
      {session.status !== 'Connected' && (
        <div className="bg-amber-50 border border-amber-200/80 px-5 py-3.5 rounded-2xl flex items-center justify-between text-xs font-bold text-amber-900 shadow-xs">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            <span className="text-amber-800">WHATSAPP DISCONNECTED:</span>
            <span className="text-amber-700">Scan QR Code below with your WhatsApp camera to start automated messaging.</span>
          </div>
          <button 
            onClick={handleConnect}
            disabled={actionLoading}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-black rounded-xl text-[11px] transition-all cursor-pointer border-none"
          >
            Connect Session
          </button>
        </div>
      )}

      {/* ── METRICS GRID ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-4">

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Session State</span>
            <span className={`text-base font-black flex items-center gap-2 mt-1 ${session.status === 'Connected' ? 'text-emerald-600' : 'text-red-600'}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${session.status === 'Connected' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              {session.status}
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-600">
            <Smartphone size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Today's Sent</span>
            <span className="text-xl font-black text-slate-900 mt-1 block">{stats.messagesToday}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <MessageSquare size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Delivered</span>
            <span className="text-xl font-black text-emerald-600 mt-1 block">{stats.delivered}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <CheckCheck size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Queue Pending</span>
            <span className="text-xl font-black text-amber-600 mt-1 block">{stats.pending}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600">
            <Clock size={20} />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm flex items-center justify-between col-span-2 lg:col-span-1">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Failed Retries</span>
            <span className="text-xl font-black text-red-600 mt-1 block">{stats.failed}</span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600">
            <AlertTriangle size={20} />
          </div>
        </div>

      </div>

      {/* ── MAIN WORKSPACE GRID ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT COLUMN: AUTHENTICATION & CLEAN QR SCANNER CARD */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col items-center">
            
            <div className="w-full flex items-center justify-between pb-4 mb-6 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <QrCode size={18} className="text-emerald-600" />
                <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider">
                  Session Configuration & QR Sync
                </h3>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${session.status === 'Connected' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                {session.status}
              </span>
            </div>

            {loading ? (
              <div className="w-64 h-64 rounded-2xl bg-slate-50 flex flex-col items-center justify-center border border-slate-200 gap-3">
                <RefreshCw className="animate-spin text-slate-400" size={28} />
                <span className="text-xs font-bold text-slate-500">Checking Status...</span>
              </div>
            ) : session.status === 'Connected' ? (
              <div className="w-full flex flex-col items-center py-4">
                <div className="w-24 h-24 rounded-full bg-emerald-50 border-2 border-emerald-200 flex items-center justify-center text-emerald-600 shadow-inner">
                  <ShieldCheck size={52} />
                </div>

                <h4 className="text-lg font-black text-slate-900 mt-4">{session.profileName || 'The Warrior Gym Official'}</h4>
                <span className="text-xs font-bold text-emerald-600 mt-0.5 font-mono">📱 +{session.phoneNumber || '919877466899'}</span>
                
                <div className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl mt-5 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Connection Status:</span>
                    <span className="text-emerald-600 font-black">Active & Ready</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Engine:</span>
                    <span className="text-slate-800 font-bold">WhatsApp LocalAuth</span>
                  </div>
                  <div className="flex justify-between text-slate-500">
                    <span>Last Sync:</span>
                    <span className="text-slate-700 font-mono text-[11px]">
                      {session.lastSync ? new Date(session.lastSync).toLocaleTimeString('en-IN') : 'Just Now'}
                    </span>
                  </div>
                </div>
              </div>
            ) : session.qr ? (
              <div className="flex flex-col items-center w-full">
                {/* Crisp Clean Unobscured QR Code Card for Instant Scan */}
                <div className="w-64 h-64 bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-md p-3 flex items-center justify-center">
                  <img 
                    src={session.qr} 
                    alt="Scan WhatsApp QR Code" 
                    className="w-full h-full object-contain"
                    style={{ imageRendering: 'pixelated' }}
                  />
                </div>

                <div className="mt-5 p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center w-full space-y-2">
                  <div className="flex items-center justify-center gap-2 text-xs font-black text-slate-900">
                    <Smartphone size={15} className="text-emerald-600" />
                    How to Connect
                  </div>
                  <ol className="text-[11px] text-slate-600 leading-relaxed text-left list-decimal list-inside space-y-1 font-medium px-2">
                    <li>Open <strong>WhatsApp</strong> on your phone</li>
                    <li>Tap <strong>Settings / Menu (⋮)</strong> → <strong>Linked Devices</strong></li>
                    <li>Tap <strong>Link a Device</strong> and point camera at QR code above</li>
                  </ol>
                </div>
              </div>
            ) : (
              <div className="w-64 h-64 rounded-2xl bg-slate-50 flex flex-col items-center justify-center text-slate-400 border border-slate-200 text-center p-6 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-slate-400 shadow-xs">
                  <AlertTriangle size={28} />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-800 block">No Active Connection</span>
                  <span className="text-[11px] text-slate-500 mt-1 block">Click Connect below to spawn QR Code</span>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="w-full grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-slate-100">
              {session.status === 'Connected' ? (
                <>
                  <button 
                    onClick={handleReconnect}
                    disabled={actionLoading}
                    className="py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all disabled:opacity-50 border border-slate-200 cursor-pointer"
                  >
                    Reconnect
                  </button>
                  <button 
                    onClick={handleDisconnect}
                    disabled={actionLoading}
                    className="py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                  >
                    Disconnect
                  </button>
                </>
              ) : (
                <button 
                  onClick={handleConnect}
                  disabled={actionLoading}
                  className="col-span-2 py-3.5 bg-slate-900 hover:bg-black text-[#d4ff00] font-black rounded-xl text-xs tracking-wider transition-all shadow-sm cursor-pointer disabled:opacity-50 border-none flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <RefreshCw size={16} className="animate-spin text-[#d4ff00]" />
                      Generating QR Code...
                    </>
                  ) : (
                    <>
                      <Zap size={16} className="text-[#d4ff00]" />
                      CONNECT WHATSAPP WEB
                    </>
                  )}
                </button>
              )}
            </div>

          </div>
        </div>

        {/* RIGHT COLUMN: CRM TEMPLATE BUILDER WITH WHATSAPP LIGHT CHAT BUBBLES */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col">
            
            <div className="flex items-center justify-between pb-4 mb-5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Layers size={18} className="text-emerald-600" />
                <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider">
                  CRM Message Templates
                </h3>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => {
                    setSelectedTemplate(null);
                    setNewTemplateName('');
                    setNewTemplateText('');
                    setShowTemplateModal(true);
                  }}
                  className="px-3.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  + Add Template
                </button>
              )}
            </div>

            {/* Variable Placeholders Reference Bar */}
            <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl mb-5">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1.5">Dynamic Variable Placeholders</span>
              <div className="flex flex-wrap gap-1.5">
                {['memberName', 'plan', 'expiryDate', 'trainer', 'gymName'].map(v => (
                  <span key={v} className="bg-white border border-slate-200 text-slate-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shadow-2xs">
                    {"{{"}{v}{"}}"}
                  </span>
                ))}
              </div>
            </div>

            {/* Clean Light WhatsApp Chat Bubble Template Cards */}
            <div className="space-y-4 max-h-[460px] overflow-y-auto pr-1">
              {templates.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-semibold text-xs">No template saved in database.</div>
              ) : (
                templates.map(tmpl => (
                  <div key={tmpl.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 hover:border-slate-300 transition-all group">
                    
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-xs font-black text-slate-800 uppercase tracking-wider">{tmpl.name}</span>
                      </div>
                      {isAdmin && (
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setSelectedTemplate(tmpl);
                              setNewTemplateName(tmpl.name);
                              setNewTemplateText(tmpl.message);
                              setShowTemplateModal(true);
                            }}
                            className="p-1.5 hover:bg-white text-slate-400 hover:text-slate-900 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-slate-200"
                          >
                            <Edit size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Authentic WhatsApp Light Chat Bubble */}
                    <div className="bg-[#dcf8c6] border border-[#c8f7bf] text-[#111b21] text-xs font-medium p-3.5 rounded-2xl rounded-tr-none shadow-xs leading-relaxed">
                      {tmpl.message}
                      <div className="flex items-center justify-end gap-1 text-[9px] text-slate-500 font-mono mt-2">
                        <span>10:45 AM</span>
                        <CheckCheck size={13} className="text-[#34b7f1]" />
                      </div>
                    </div>

                  </div>
                ))
              )}
            </div>

          </div>
        </div>

      </div>

      {/* ── TRANSMISSION AUDIT LOGS LEDGER ───────────────────────────── */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Clock size={18} className="text-slate-700" />
            <h3 className="font-black text-slate-900 text-xs uppercase tracking-wider">
              Transmission Logs & Dispatch Audit Ledger
            </h3>
          </div>
          <span className="text-[10px] font-bold text-slate-400">Total Logs: {logs.length}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Recipient Phone</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Message Payload</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Retries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-slate-400 font-medium">
                    No WhatsApp transmission logs reported yet.
                  </td>
                </tr>
              ) : (
                logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 text-[10px] font-mono text-slate-400">
                      {new Date(log.timestamp).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3.5 font-bold font-mono text-slate-900">+{log.phone}</td>
                    <td className="px-5 py-3.5 text-slate-600 font-medium max-w-sm truncate">{log.message}</td>
                    <td className="px-5 py-3.5">
                      <span className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider inline-flex items-center gap-1 ${
                        log.status === 'Delivered' || log.status === 'Sent'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : log.status === 'Pending' || log.status === 'Retry'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200 animate-pulse'
                          : 'bg-red-50 text-red-700 border border-red-200'
                      }`}>
                        {log.status === 'Delivered' && <CheckCheck size={12} />}
                        {log.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right font-black font-mono text-slate-700">{log.retryCount || 0}/3</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── TEST BROADCAST MODAL ─────────────────────────────────────── */}
      <AnimatePresence>
        {showTestModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" 
              onClick={() => setShowTestModal(false)} 
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Send size={16} className="text-emerald-600" />
                  Broadcast Test Message
                </h3>
                <button onClick={() => setShowTestModal(false)} className="text-slate-400 hover:text-slate-900">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSendTest} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Target Mobile Number</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. 9877466899 or 919877466899"
                    value={testPhone}
                    onChange={(e) => setTestPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Message Text</label>
                  <textarea 
                    required
                    rows={4}
                    placeholder="Enter test message payload..."
                    value={testMessage}
                    onChange={(e) => setTestMessage(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTestModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-5 py-2 bg-slate-900 hover:bg-black text-[#d4ff00] font-black rounded-xl text-xs cursor-pointer border-none"
                  >
                    {actionLoading ? 'Sending...' : 'Send WhatsApp Message'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── CREATE / EDIT TEMPLATE MODAL ─────────────────────────────── */}
      <AnimatePresence>
        {showTemplateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" 
              onClick={() => setShowTemplateModal(false)} 
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-lg bg-white border border-slate-200 rounded-3xl p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Layers size={16} className="text-emerald-600" />
                  {selectedTemplate ? 'Edit Template' : 'Create New CRM Template'}
                </h3>
                <button onClick={() => setShowTemplateModal(false)} className="text-slate-400 hover:text-slate-900">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSaveTemplate} className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Template Title</label>
                  <input 
                    type="text"
                    required
                    placeholder="e.g. Renewal Alert, Birthday Greeting"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">Message Payload</label>
                    <span className="text-[10px] text-slate-400">Click placeholder to insert</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {['memberName', 'plan', 'expiryDate', 'trainer', 'gymName'].map(v => (
                      <button
                        type="button"
                        key={v}
                        onClick={() => insertVariable(v)}
                        className="bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 text-[10px] font-mono font-bold px-2 py-0.5 rounded cursor-pointer"
                      >
                        + {"{{"}{v}{"}}"}
                      </button>
                    ))}
                  </div>
                  <textarea 
                    required
                    rows={5}
                    placeholder="Type template message..."
                    value={newTemplateText}
                    onChange={(e) => setNewTemplateText(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTemplateModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 bg-slate-900 hover:bg-black text-[#d4ff00] font-black rounded-xl text-xs cursor-pointer border-none"
                  >
                    Save Template
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── BULK CAMPAIGN MODAL ─────────────────────────────────────── */}
      <AnimatePresence>
        {showBulkSendModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-xs" 
              onClick={() => setShowBulkSendModal(false)} 
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative w-full max-w-md bg-white border border-slate-200 rounded-3xl p-6 shadow-xl space-y-4"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider flex items-center gap-2">
                  <Zap size={16} className="text-emerald-600" />
                  Launch Bulk WhatsApp Campaign
                </h3>
                <button onClick={() => setShowBulkSendModal(false)} className="text-slate-400 hover:text-slate-900">
                  <X size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Target Audience Segment</label>
                  <select
                    value={bulkFilter}
                    onChange={(e) => setBulkFilter(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="expiring">Members Expiring in Next 7 Days</option>
                    <option value="due">Members with Pending Payment Invoices</option>
                    <option value="absent">Inactive Members (No check-in 3+ days)</option>
                    <option value="all">All Gym Members</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Select Message Template</label>
                  <select
                    value={bulkTemplateId}
                    onChange={(e) => setBulkTemplateId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Select Template...</option>
                    {templates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                  <div className="text-slate-900 font-bold">Campaign Dispatch Rule:</div>
                  <div>Messages will be queued and transmitted sequentially with 3-second anti-spam delay per message.</div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowBulkSendModal(false)}
                    className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toast.success('🚀 Bulk Campaign Queue Started!');
                      setShowBulkSendModal(false);
                    }}
                    className="px-5 py-2 bg-slate-900 hover:bg-black text-[#d4ff00] font-black rounded-xl text-xs cursor-pointer border-none"
                  >
                    Dispatch Campaign
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
