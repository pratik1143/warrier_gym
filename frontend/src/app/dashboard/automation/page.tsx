'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Server, Key, Eye, EyeOff, Save, Play, RefreshCw,
  CheckCircle2, AlertTriangle, Zap, Send, Settings, FileText, Download
} from 'lucide-react';
import toast from '@/lib/toast';
import API from '@/services/api';

// ── Default HTML Templates ──────────────────────────────────────────
const TEMPLATES: Record<string, { subject: string; html: string }> = {
  welcome: {
    subject: 'Welcome to The Warrior Gym! 🎉',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><style>
  body { font-family: 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
  .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 32px rgba(0,0,0,0.08); }
  .hero { background: #000; padding: 40px 32px; text-align: center; }
  .hero h1 { color: #d4ff00; font-size: 28px; font-weight: 900; margin: 0; letter-spacing: -0.5px; }
  .hero p { color: rgba(255,255,255,0.6); font-size: 13px; margin: 8px 0 0; }
  .body { padding: 32px; }
  .body h2 { font-size: 20px; font-weight: 800; color: #0f172a; }
  .body p { color: #64748b; font-size: 14px; line-height: 1.7; }
  .info-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; margin: 20px 0; }
  .info-row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
  .info-row:last-child { border: none; }
  .label { color: #94a3b8; font-weight: 600; }
  .value { color: #0f172a; font-weight: 700; }
  .btn { display: block; background: #000; color: #d4ff00; text-decoration: none; text-align: center; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 13px; margin: 24px 0 0; }
  .footer { background: #f8fafc; padding: 20px 32px; text-align: center; color: #94a3b8; font-size: 11px; }
</style></head>
<body>
  <div class="wrapper">
    <div class="hero">
      <h1>⚡ THE WARRIOR GYM</h1>
      <p>Beyond Strength. Beyond Limits.</p>
    </div>
    <div class="body">
      <h2>Welcome, {{memberName}}! 🎉</h2>
      <p>Your membership has been activated. Here are your details:</p>
      <div class="info-box">
        <div class="info-row"><span class="label">Plan</span><span class="value">{{plan}}</span></div>
        <div class="info-row"><span class="label">Start Date</span><span class="value">{{startDate}}</span></div>
        <div class="info-row"><span class="label">Expiry Date</span><span class="value">{{expiryDate}}</span></div>
        <div class="info-row"><span class="label">Branch</span><span class="value">{{branch}}</span></div>
      </div>
      <p>Head to the gym and scan your ID at the biometric gate to start your fitness journey.</p>
      <a class="btn" href="#">View My Membership Portal</a>
    </div>
    <div class="footer">The Warrior Gym · SCO 30, 31, Sector 89, Mohali · +91 98170 23336</div>
  </div>
</body>
</html>`,
  },
  expiry: {
    subject: 'Your The Warrior Gym Membership Expires Soon ⚠️',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><style>
  body { font-family: 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
  .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 32px rgba(0,0,0,0.08); }
  .hero { background: linear-gradient(135deg, #ef4444, #dc2626); padding: 40px 32px; text-align: center; }
  .hero h1 { color: #fff; font-size: 24px; font-weight: 900; margin: 0; }
  .hero .badge { background: rgba(255,255,255,0.2); color: #fff; font-size: 13px; font-weight: 700; padding: 6px 16px; border-radius: 99px; display: inline-block; margin-top: 10px; }
  .body { padding: 32px; }
  .countdown { background: #fef2f2; border: 2px solid #ef4444; border-radius: 12px; padding: 20px; text-align: center; margin: 20px 0; }
  .countdown .days { font-size: 48px; font-weight: 900; color: #ef4444; }
  .countdown p { color: #64748b; font-size: 13px; margin: 4px 0 0; }
  .btn { display: block; background: #ef4444; color: #fff; text-decoration: none; text-align: center; padding: 14px 28px; border-radius: 12px; font-weight: 800; font-size: 13px; margin: 24px 0 0; }
  .footer { background: #f8fafc; padding: 20px 32px; text-align: center; color: #94a3b8; font-size: 11px; }
</style></head>
<body>
  <div class="wrapper">
    <div class="hero">
      <h1>Membership Expiring Soon!</h1>
      <div class="badge">Action Required</div>
    </div>
    <div class="body">
      <p style="color:#0f172a;font-size:16px;font-weight:700">Hi {{memberName}},</p>
      <p style="color:#64748b;font-size:14px">Your <strong>{{plan}}</strong> membership is expiring soon. Renew now to keep your gym access uninterrupted.</p>
      <div class="countdown">
        <div class="days">{{daysLeft}}</div>
        <p>Days remaining · Expires on <strong>{{expiryDate}}</strong></p>
      </div>
      <a class="btn" href="#">Renew My Membership Now →</a>
    </div>
    <div class="footer">The Warrior Gym · Mohali, Punjab</div>
  </div>
</body>
</html>`,
  },
  receipt: {
    subject: 'Payment Received — Invoice #{{invoice}} ✅',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><style>
  body { font-family: 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
  .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 32px rgba(0,0,0,0.08); }
  .hero { background: #10b981; padding: 32px; text-align: center; }
  .hero h1 { color: #fff; font-size: 22px; font-weight: 900; margin: 0; }
  .hero p { color: rgba(255,255,255,0.8); font-size: 13px; margin: 6px 0 0; }
  .body { padding: 32px; }
  .invoice-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
  .invoice-table th { background: #f8fafc; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; color: #94a3b8; letter-spacing: 0.5px; }
  .invoice-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; color: #0f172a; font-weight: 600; }
  .total-row td { font-size: 16px; font-weight: 900; background: #f8fafc; border-radius: 8px; }
  .footer { background: #f8fafc; padding: 20px 32px; text-align: center; color: #94a3b8; font-size: 11px; }
</style></head>
<body>
  <div class="wrapper">
    <div class="hero">
      <h1>✅ Payment Received</h1>
      <p>Invoice #{{invoice}}</p>
    </div>
    <div class="body">
      <p style="color:#0f172a;font-weight:700">Dear {{memberName}},</p>
      <p style="color:#64748b;font-size:14px">Thank you for your payment. Your membership is now active.</p>
      <table class="invoice-table">
        <tr><th>Description</th><th>Amount</th></tr>
        <tr><td>{{plan}} Membership</td><td>₹{{amount}}</td></tr>
        <tr><td>GST (18%)</td><td>₹{{gst}}</td></tr>
        <tr class="total-row"><td><strong>Total Paid</strong></td><td><strong>₹{{total}}</strong></td></tr>
      </table>
      <p style="color:#64748b;font-size:12px">Payment Method: {{method}} · Date: {{date}}</p>
    </div>
    <div class="footer">The Warrior Gym · Mohali, Punjab · GSTIN: 27AAAAA0000A1Z5</div>
  </div>
</body>
</html>`,
  },
  renewal: {
    subject: 'Renew Your The Warrior Gym Membership & Keep Crushing It! 💪',
    html: `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8" /><style>
  body { font-family: 'Segoe UI', sans-serif; background: #f8fafc; margin: 0; padding: 0; }
  .wrapper { max-width: 560px; margin: 40px auto; background: #fff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 32px rgba(0,0,0,0.08); }
  .hero { background: #000; padding: 40px 32px; text-align: center; }
  .hero h1 { color: #d4ff00; font-size: 26px; font-weight: 900; margin: 0; }
  .hero p { color: rgba(255,255,255,0.6); font-size: 13px; margin: 8px 0 0; }
  .body { padding: 32px; }
  .plans { display: grid; gap: 12px; margin: 20px 0; }
  .plan-card { border: 2px solid #e2e8f0; border-radius: 12px; padding: 16px; display: flex; justify-content: space-between; align-items: center; }
  .plan-card.highlight { border-color: #d4ff00; background: #fafff0; }
  .plan-name { font-weight: 800; color: #0f172a; font-size: 14px; }
  .plan-price { font-weight: 900; color: #0052FF; font-size: 16px; }
  .btn { display: block; background: #d4ff00; color: #000; text-decoration: none; text-align: center; padding: 16px 28px; border-radius: 12px; font-weight: 900; font-size: 14px; margin: 24px 0 0; }
  .footer { background: #f8fafc; padding: 20px 32px; text-align: center; color: #94a3b8; font-size: 11px; }
</style></head>
<body>
  <div class="wrapper">
    <div class="hero">
      <h1>Keep the Momentum! 💪</h1>
      <p>Your membership expired. Come back stronger!</p>
    </div>
    <div class="body">
      <p style="color:#0f172a;font-size:16px;font-weight:700">Hey {{memberName}},</p>
      <p style="color:#64748b;font-size:14px">Don't let your progress stop. Renew today and get back to crushing your goals.</p>
      <div class="plans">
        <div class="plan-card"><div class="plan-name">Monthly Access</div><div class="plan-price">₹2,500</div></div>
        <div class="plan-card highlight"><div class="plan-name">⭐ Quarterly Plan</div><div class="plan-price">₹6,500</div></div>
        <div class="plan-card"><div class="plan-name">Annual VIP Pass</div><div class="plan-price">₹18,000</div></div>
      </div>
      <a class="btn" href="#">Renew Now & Save →</a>
    </div>
    <div class="footer">The Warrior Gym · Mohali, Punjab · Unsubscribe</div>
  </div>
</body>
</html>`,
  },
};

// ── SMTP Settings ───────────────────────────────────────────────────
interface SmtpConfig {
  host: string;
  port: string;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
}

export default function AutomationPage() {
  const [activeTab, setActiveTab] = useState<'smtp' | 'templates' | 'invoice-pdf'>('smtp');
  const [activeTemplate, setActiveTemplate] = useState<keyof typeof TEMPLATES>('welcome');
  const [showPass, setShowPass] = useState(false);
  const [previewMode, setPreviewMode] = useState<'code' | 'preview'>('preview');
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [savingSmtp, setSavingSmtp] = useState(false);

  // PDF Preview states
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [loadingPdf, setLoadingPdf] = useState(false);

  const [smtp, setSmtp] = useState<SmtpConfig>({
    host: 'smtp.gmail.com',
    port: '587',
    secure: false,
    user: '',
    pass: '',
    fromName: 'The Warrior Gym',
    fromEmail: 'noreply@thewarriorgym.in',
  });

  const [triggers, setTriggers] = useState({
    welcome: true,
    expiry7: true,
    expiry3: true,
    payment: true,
    expired: false
  });

  const [templates, setTemplates] = useState({ ...TEMPLATES });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const smtpRes = await API.get('/automation/smtp');
        if (smtpRes.data) {
          setSmtp({
            host: smtpRes.data.host || 'smtp.gmail.com',
            port: smtpRes.data.port || '587',
            secure: !!smtpRes.data.secure,
            user: smtpRes.data.user || '',
            pass: smtpRes.data.pass || '',
            fromName: smtpRes.data.fromName || 'The Warrior Gym',
            fromEmail: smtpRes.data.fromEmail || 'noreply@thewarriorgym.in',
          });
          if (smtpRes.data.triggers) {
            setTriggers(smtpRes.data.triggers);
          }
        }

        const templatesRes = await API.get('/automation/templates');
        if (templatesRes.data) {
          setTemplates(templatesRes.data);
        }
      } catch (err) {
        console.error('Failed to load automation settings:', err);
      }
    };
    loadSettings();
  }, []);

  const fetchPdfPreview = async () => {
    setLoadingPdf(true);
    try {
      const res = await API.get('/automation/invoice/preview', {
        responseType: 'blob'
      });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      // Clean up previous URL if any
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (err) {
      console.error('Failed to load PDF preview:', err);
      toast.error('Failed to load invoice PDF preview.');
    } finally {
      setLoadingPdf(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'invoice-pdf') {
      fetchPdfPreview();
    }
    // Cleanup URL on unmount
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [activeTab]);

  const handleDownloadPdf = () => {
    if (!pdfUrl) return;
    const link = document.createElement('a');
    link.href = pdfUrl;
    link.download = 'The_Warrior_Gym_Invoice_Template.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Downloaded Invoice PDF Template!');
  };

  const handleSmtpSave = async () => {
    if (!smtp.host || !smtp.user || !smtp.pass) {
      toast.error('Please fill Host, Username and Password');
      return;
    }
    setSavingSmtp(true);
    try {
      await API.post('/automation/smtp', {
        ...smtp,
        triggers
      });
      toast.success('SMTP settings saved successfully!');
    } catch (e) {
      toast.error('Failed to save SMTP settings.');
    } finally {
      setSavingSmtp(false);
    }
  };

  const handleToggleTrigger = async (key: string) => {
    const updatedTriggers = { ...triggers, [key]: !triggers[key as keyof typeof triggers] };
    setTriggers(updatedTriggers);
    try {
      await API.post('/automation/smtp', {
        ...smtp,
        triggers: updatedTriggers
      });
      toast.success('Trigger settings updated!');
    } catch (err) {
      toast.error('Failed to update trigger settings');
    }
  };

  const handleTestEmail = async () => {
    if (!testEmail) { toast.error('Enter a test email address'); return; }
    setSendingTest(true);
    try {
      await API.post('/automation/smtp/test', {
        to: testEmail,
        subject: 'The Warrior Gym Test Email ⚡',
        body: `
          <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 8px; max-width: 500px; margin: auto;">
            <h2 style="color: #0f172a; border-bottom: 2px solid #d4ff00; padding-bottom: 8px;">The Warrior Gym SMTP Test</h2>
            <p>Your SMTP configurations are correct! Mail was sent successfully.</p>
            <p style="color: #94a3b8; font-size: 12px; margin-top: 20px;">Sent at: ${new Date().toLocaleString()}</p>
          </div>
        `
      });
      toast.success(`Test email sent to ${testEmail}!`);
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to send test email. Check SMTP settings.');
    } finally {
      setSendingTest(false);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      await API.post('/automation/templates', templates);
      toast.success(`${TEMPLATE_TABS.find(t => t.key === activeTemplate)?.label} template saved!`);
    } catch (e) {
      toast.error('Failed to save template');
    }
  };

  const TEMPLATE_TABS = [
    { key: 'welcome', label: 'Welcome Mail', icon: '👋', color: '#10b981' },
    { key: 'expiry', label: 'Expiry Alert', icon: '⚠️', color: '#ef4444' },
    { key: 'receipt', label: 'Invoice & Receipt', icon: '📄', color: '#0052FF' },
    { key: 'renewal', label: 'Renewal Prompt', icon: '💪', color: '#f59e0b' },
  ] as const;

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm"
      >
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-lg font-black text-black flex items-center gap-2">
              <Zap size={20} />
              Automation Center
            </h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              SMTP Configuration · Email Templates · Auto Trigger Rules
            </p>
          </div>
          <div className="flex items-center gap-2 text-[10px]">
            <span className="flex items-center gap-1.5 bg-amber-50 text-amber-600 font-black px-3 py-1.5 rounded-lg border border-amber-200">
              <AlertTriangle size={11} />
              Configure SMTP first to send emails
            </span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 mt-4 bg-slate-100 rounded-xl p-1 w-fit">
          {[
            { key: 'smtp', label: 'SMTP Settings', icon: Server },
            { key: 'templates', label: 'Email Templates', icon: Mail },
            { key: 'invoice-pdf', label: 'Invoice PDF Template', icon: FileText },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key as any)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                activeTab === key ? 'bg-black text-white shadow' : 'text-slate-400 hover:text-black'
              }`}
            >
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>
      </motion.div>

      <AnimatePresence mode="wait">
        {/* ── SMTP Settings Panel ── */}
        {activeTab === 'smtp' && (
          <motion.div
            key="smtp"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4"
          >
            {/* SMTP Form */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-5">
              <h3 className="text-sm font-black text-black flex items-center gap-2">
                <Server size={16} /> SMTP Server Configuration
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">SMTP Host</label>
                  <input
                    value={smtp.host}
                    onChange={e => setSmtp(s => ({ ...s, host: e.target.value }))}
                    placeholder="smtp.gmail.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-bold text-black outline-none focus:border-black transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Port</label>
                  <input
                    value={smtp.port}
                    onChange={e => setSmtp(s => ({ ...s, port: e.target.value }))}
                    placeholder="587"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-bold text-black outline-none focus:border-black transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Username / Email</label>
                <input
                  type="email"
                  value={smtp.user}
                  onChange={e => setSmtp(s => ({ ...s, user: e.target.value }))}
                  placeholder="your@gmail.com"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-bold text-black outline-none focus:border-black transition-colors"
                />
              </div>

              <div>
                <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Password / App Password</label>
                <div className="relative">
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={smtp.pass}
                    onChange={e => setSmtp(s => ({ ...s, pass: e.target.value }))}
                    placeholder="App-specific password"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 pr-10 text-[11px] font-bold text-black outline-none focus:border-black transition-colors"
                  />
                  <button
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-black"
                  >
                    {showPass ? <EyeOff size={13} /> : <Eye size={13} />}
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Sender Name</label>
                  <input
                    value={smtp.fromName}
                    onChange={e => setSmtp(s => ({ ...s, fromName: e.target.value }))}
                    placeholder="The Warrior Gym"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-bold text-black outline-none focus:border-black transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Sender Email</label>
                  <input
                    type="email"
                    value={smtp.fromEmail}
                    onChange={e => setSmtp(s => ({ ...s, fromEmail: e.target.value }))}
                    placeholder="noreply@thewarriorgym.in"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-bold text-black outline-none focus:border-black transition-colors"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <div
                    onClick={() => setSmtp(s => ({ ...s, secure: !s.secure }))}
                    className={`w-9 h-5 rounded-full transition-all relative ${smtp.secure ? 'bg-black' : 'bg-slate-200'}`}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${smtp.secure ? 'left-4' : 'left-0.5'}`} />
                  </div>
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Use SSL/TLS (Port 465)</span>
                </label>
              </div>

              <button
                onClick={handleSmtpSave}
                disabled={savingSmtp}
                className="w-full bg-black text-white rounded-xl py-3 text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-slate-800 transition-colors disabled:opacity-50"
              >
                {savingSmtp ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                {savingSmtp ? 'Saving...' : 'Save SMTP Configuration'}
              </button>
            </div>

            {/* Right: Test + Automation Rules */}
            <div className="flex flex-col gap-4">
              {/* Test Email */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                <h3 className="text-sm font-black text-black flex items-center gap-2">
                  <Send size={16} /> Send Test Email
                </h3>
                <div>
                  <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Test Recipient</label>
                  <input
                    type="email"
                    value={testEmail}
                    onChange={e => setTestEmail(e.target.value)}
                    placeholder="test@example.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-bold text-black outline-none focus:border-black transition-colors"
                  />
                </div>
                <button
                  onClick={handleTestEmail}
                  disabled={sendingTest}
                  className="w-full bg-[#d4ff00] text-black rounded-xl py-3 text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-yellow-300 transition-colors disabled:opacity-50"
                >
                  {sendingTest ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                  {sendingTest ? 'Sending...' : 'Send Test Email'}
                </button>
              </div>

              {/* Auto-trigger Rules */}
              <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm">
                <h3 className="text-sm font-black text-black mb-4 flex items-center gap-2">
                  <Settings size={16} /> Automation Triggers
                </h3>
                <div className="space-y-3">
                  {[
                    { key: 'welcome', label: 'New Member Joins', template: 'Welcome Email', color: '#10b981' },
                    { key: 'expiry7', label: 'Membership Expiring (7 days)', template: 'Expiry Alert', color: '#f59e0b' },
                    { key: 'expiry3', label: 'Membership Expiring (3 days)', template: 'Expiry Alert', color: '#ef4444' },
                    { key: 'payment', label: 'Payment Received', template: 'Receipt + Invoice', color: '#0052FF' },
                    { key: 'expired', label: 'Membership Expired', template: 'Renewal Prompt', color: '#8b5cf6' },
                  ].map((rule, i) => {
                    const isActive = triggers[rule.key as keyof typeof triggers] ?? false;
                    return (
                      <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div>
                          <p className="text-[10px] font-black text-black">{rule.label}</p>
                          <p className="text-[9px] text-slate-400 font-bold mt-0.5">→ Sends {rule.template}</p>
                        </div>
                        <div
                          onClick={() => handleToggleTrigger(rule.key)}
                          className={`w-8 h-4.5 rounded-full transition-all relative cursor-pointer ${isActive ? 'bg-black' : 'bg-slate-200'}`}
                        >
                          <span className={`absolute top-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-all ${isActive ? 'left-[18px]' : 'left-0.5'}`} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Gmail Tip */}
              <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-2xl p-4">
                <p className="text-[10px] font-black text-[#C2410C] mb-1">💡 Gmail Setup Tip</p>
                <p className="text-[9px] text-[#EA580C] leading-relaxed">
                  For Gmail: Use <strong>smtp.gmail.com</strong> port <strong>587</strong>. Generate an <strong>App Password</strong> from your Google Account → Security → 2-Step Verification → App Passwords. Use that as your password.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Email Templates Panel ── */}
        {activeTab === 'templates' && (
          <motion.div
            key="templates"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="flex flex-col gap-4"
          >
            {/* Template selector */}
            <div className="flex gap-2 flex-wrap">
              {TEMPLATE_TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => setActiveTemplate(t.key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider border transition-all ${
                    activeTemplate === t.key
                      ? 'bg-black text-white border-black shadow'
                      : 'bg-white text-slate-500 border-slate-200 hover:border-black hover:text-black'
                  }`}
                >
                  <span>{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Subject editor */}
            <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
              <label className="block text-[9px] font-black text-slate-400 uppercase tracking-wider mb-1.5">Email Subject</label>
              <input
                value={templates[activeTemplate].subject}
                onChange={e => setTemplates(prev => ({
                  ...prev,
                  [activeTemplate]: { ...prev[activeTemplate], subject: e.target.value }
                }))}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-[11px] font-bold text-black outline-none focus:border-black transition-colors"
              />
            </div>

            {/* Editor + Preview side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Code Editor */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <FileText size={11} /> HTML Template
                  </span>
                  <span className="text-[8px] font-bold text-slate-400">Edit the HTML below</span>
                </div>
                <textarea
                  value={templates[activeTemplate].html}
                  onChange={e => setTemplates(prev => ({
                    ...prev,
                    [activeTemplate]: { ...prev[activeTemplate], html: e.target.value }
                  }))}
                  className="flex-1 w-full p-4 text-[10px] font-mono text-slate-700 bg-white outline-none resize-none min-h-[400px] leading-relaxed"
                  spellCheck={false}
                />
              </div>

              {/* Live Preview */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Eye size={11} /> Live Preview
                  </span>
                  <span className="text-[8px] font-bold text-emerald-500 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                    Auto-updates
                  </span>
                </div>
                <div className="flex-1 overflow-auto bg-slate-100 p-3">
                  <iframe
                    srcDoc={templates[activeTemplate].html}
                    className="w-full h-full min-h-[400px] rounded-xl border-0 bg-white shadow-sm"
                    title="Email Preview"
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </div>

            {/* Save Template button */}
            <div className="flex gap-3">
              <button
                onClick={handleSaveTemplate}
                className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-800 transition-colors"
              >
                <Save size={13} />
                Save Template
              </button>
              <button
                onClick={() => {
                  setTemplates(prev => ({
                    ...prev,
                    [activeTemplate]: TEMPLATES[activeTemplate]
                  }));
                  toast.success('Template reset to default');
                }}
                className="flex items-center gap-2 bg-slate-100 text-slate-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-200 transition-colors"
              >
                <RefreshCw size={13} />
                Reset to Default
              </button>
            </div>

            {/* Variables reference */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
              <p className="text-[10px] font-black text-slate-600 mb-2 uppercase tracking-wider">Available Template Variables</p>
              <div className="flex flex-wrap gap-2">
                {['{{memberName}}', '{{plan}}', '{{startDate}}', '{{expiryDate}}', '{{branch}}', '{{daysLeft}}', '{{invoice}}', '{{amount}}', '{{gst}}', '{{total}}', '{{method}}', '{{date}}'].map(v => (
                  <code key={v} className="text-[9px] bg-white border border-slate-200 text-slate-600 px-2 py-1 rounded-lg font-mono font-bold">{v}</code>
                ))}
              </div>
            </div>

            {activeTemplate === 'receipt' && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <p className="text-[10px] font-black text-emerald-700 mb-1">📄 Automated PDF Invoice Attachment</p>
                <p className="text-[9px] text-emerald-600 leading-relaxed">
                  When sending this email, the system automatically compiles a premium next-level PDF invoice using the client's membership details and your gym's logo (<code className="font-mono bg-white px-1.5 py-0.5 rounded text-emerald-800">gym_logo.png</code>). The PDF contains complete billing entries, GST (18%) taxation layout, and a "PAID" stamp, attached directly as a document file.
                </p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── Invoice PDF Template Panel ── */}
        {activeTab === 'invoice-pdf' && (
          <motion.div
            key="invoice-pdf"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
            className="flex flex-col gap-4"
          >
            {/* Header info */}
            <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h3 className="text-sm font-black text-black flex items-center gap-2">
                  <FileText size={16} /> Automated Invoice PDF Template
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                  High-fidelity PDFKit Generator · Dynamic Billing Entries · Print-Ready Layout
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={fetchPdfPreview}
                  disabled={loadingPdf}
                  className="flex items-center gap-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={12} className={loadingPdf ? 'animate-spin' : ''} />
                  Refresh Preview
                </button>
                <button
                  onClick={handleDownloadPdf}
                  disabled={!pdfUrl || loadingPdf}
                  className="flex items-center gap-1.5 bg-black text-white hover:bg-slate-800 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                  <Download size={12} />
                  Download Sample PDF
                </button>
              </div>
            </div>

            {/* Preview and details side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* PDF Preview Frame (8 cols on lg) */}
              <div className="lg:col-span-8 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col min-h-[600px]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 bg-slate-50">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Eye size={11} /> Live PDF Document Viewer
                  </span>
                  {loadingPdf && (
                    <span className="text-[9px] text-slate-400 flex items-center gap-1.5">
                      <RefreshCw size={10} className="animate-spin" /> Rendering PDF...
                    </span>
                  )}
                </div>
                <div className="flex-1 bg-slate-100 p-4 flex items-center justify-center relative">
                  {loadingPdf ? (
                    <div className="flex flex-col items-center gap-2">
                      <RefreshCw size={24} className="animate-spin text-slate-400" />
                      <p className="text-[11px] font-bold text-slate-400">Compiling Premium Layout...</p>
                    </div>
                  ) : pdfUrl ? (
                    <iframe
                      src={pdfUrl}
                      className="w-full h-full min-h-[600px] rounded-xl border-0 bg-white shadow-sm"
                      title="Invoice PDF Preview"
                    />
                  ) : (
                    <p className="text-[11px] font-bold text-slate-400">Failed to render PDF preview.</p>
                  )}
                </div>
              </div>

              {/* Design Breakdown & Info (4 cols on lg) */}
              <div className="lg:col-span-4 flex flex-col gap-4">
                {/* Highlights Card */}
                <div className="bg-white rounded-2xl p-6 border border-slate-100 shadow-sm space-y-4">
                  <h4 className="text-[10px] font-black text-black uppercase tracking-wider border-b border-slate-100 pb-2">
                    ✨ Premium Layout Specs
                  </h4>
                  <div className="space-y-3">
                    {[
                      { title: 'Corporate Shield Logo', desc: 'Auto-embeds the high-res gym brand asset.' },
                      { title: 'Structured Info Cards', desc: 'Displays Billed To and Billed By details inside distinct clean card layout panels.' },
                      { title: 'Tax-Itemized Table', desc: 'Neat grid rows for memberships with exact validity periods and subtotal rows.' },
                      { title: 'GST Calculation', desc: 'Automatically splits 18% tax into CGST (9%) and SGST (9%) rows.' },
                      { title: 'Tilted Digital Stamp', desc: 'Tilted PAID stamp in emerald green (-10 degrees) for authentic receipt validation.' },
                      { title: 'Gym Tagline Footer', desc: 'Elegant dark bar at the bottom with tracking-spaced branding motto.' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex gap-2">
                        <span className="text-emerald-500 font-bold text-xs">✓</span>
                        <div>
                          <p className="text-[10px] font-black text-slate-800 leading-tight">{item.title}</p>
                          <p className="text-[9px] text-slate-400 font-bold mt-0.5 leading-normal">{item.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Automation Tip */}
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 space-y-2">
                  <p className="text-[10px] font-black text-emerald-800 flex items-center gap-1">
                    ⚡ Automation Rules
                  </p>
                  <p className="text-[9px] text-emerald-600 leading-relaxed font-bold font-sans">
                    This PDF invoice compiles dynamically and attaches instantly to receipt emails whenever a payment is registered or plan is purchased. It guarantees that athletes receive zero-lag receipts right in their email inbox.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
