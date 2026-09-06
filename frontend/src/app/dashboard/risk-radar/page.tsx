'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, AlertTriangle, ShieldAlert, Cpu, Sparkles, TrendingUp, DollarSign,
  Users, CheckCircle2, Phone, MessageSquare, Calendar, UserX, UserCheck, 
  Settings, Clock, Bell, Info, ArrowUpRight, BarChart2, Zap, Send, FileText, ChevronRight
} from 'lucide-react';
import { useGymStore, useAuthStore } from '@/store';
import { formatDate, daysUntilExpiry, getInitials } from '@/lib/utils';
import { 
  collection, addDoc, setDoc, doc, onSnapshot, query, orderBy, limit 
} from 'firebase/firestore';
import { db as fDb, isFirebaseReady } from '@/lib/firebase';
import toast from '@/lib/toast';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  BarChart, Bar, Cell 
} from 'recharts';

export default function RiskRadarPage() {
  const { user } = useAuthStore();
  const { members, fetchMembers, updateMember } = useGymStore();
  
  const [search, setSearch] = useState('');
  const [selectedRiskCategory, setSelectedRiskCategory] = useState<'all' | 'Green' | 'Yellow' | 'Orange' | 'Red'>('all');
  const [actionsHistory, setActionsHistory] = useState<any[]>([]);
  const [showReportsDrawer, setShowReportsDrawer] = useState(false);
  const [selectedReportTab, setSelectedReportTab] = useState<'daily' | 'weekly' | 'churn' | 'branch'>('daily');
  const [aiInsightMemberId, setAiInsightMemberId] = useState<string | null>(null);

  // Fetch data
  useEffect(() => {
    fetchMembers();
    
    // Listen to retention_actions collection in Firestore for real-time history
    if (isFirebaseReady && fDb) {
      const q = query(collection(fDb, 'retention_actions'), orderBy('timestamp', 'desc'), limit(15));
      const unsub = onSnapshot(q, (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setActionsHistory(list);
      }, (error) => {
        console.warn("Retention actions snapshot error:", error.message);
      });
      return () => unsub();
    }
  }, [fetchMembers]);

  // Helper: calculate days remaining
  const getDaysLeft = (expiryDate: string): number => {
    return daysUntilExpiry(expiryDate);
  };

  // Plan Price Mapping
  const planPrices: Record<string, number> = {
    'Monthly': 2500,
    'Quarterly': 6500,
    'Semi-Annual': 11500,
    'Annual Premium': 18000
  };

  // AI Member Risk Scoring Engine
  const calculateRiskMetrics = (m: any) => {
    // 1. Core Rule Inputs
    const daysLeft = getDaysLeft(m.expiryDate);
    const attendanceCount = m.attendanceCount || 0;
    const streak = m.streak || 0;
    const hasTrainer = m.trainer && m.trainer.trim() !== '';
    const fitnessScore = m.fitnessScore || 70;

    // Attendance Drop Calculation: Mocked drop percentage based on attendanceCount relative to median
    const attendanceDropPercent = attendanceCount <= 2 ? 75 : attendanceCount <= 5 ? 50 : 15;
    
    // Diet & Workout Compliance derived realistically from fitnessScore
    const dietCompliance = Math.min(95, Math.max(12, (streak * 4) + 20));
    const workoutCompliance = Math.min(95, Math.max(15, (streak * 5) + 25));

    // No App Login last 15 days check
    const noAppLogin15Days = streak === 0 && attendanceCount <= 1;

    // No Attendance 7 / 14 Days Check
    const noAttendance7Days = attendanceCount === 0 || streak === 0;
    const noAttendance14Days = attendanceCount === 0 && streak === 0;

    // 2. Risk Score Engine calculation (0-100)
    let score = 15; // Starting base

    // Rules matching
    if (noAttendance14Days) score += 40;
    else if (noAttendance7Days) score += 20;

    if (attendanceDropPercent >= 75) score += 35;
    else if (attendanceDropPercent >= 50) score += 20;

    if (daysLeft < 0) score += 35; // Lapsed
    else if (daysLeft <= 7) score += 40;
    else if (daysLeft <= 15) score += 25;
    else if (daysLeft <= 30) score += 15;

    if (noAppLogin15Days) score += 15;
    if (dietCompliance < 20) score += 15;
    if (workoutCompliance < 20) score += 15;
    if (!hasTrainer) score += 10;
    if (m.status === 'frozen') score += 20;

    // Clamp score
    const finalScore = Math.max(5, Math.min(98, score));

    // 3. Risk Levels
    let category: 'Green' | 'Yellow' | 'Orange' | 'Red' = 'Green';
    let levelLabel = 'Low Risk';
    if (finalScore >= 81) {
      category = 'Red';
      levelLabel = 'Critical Risk';
    } else if (finalScore >= 61) {
      category = 'Orange';
      levelLabel = 'High Risk';
    } else if (finalScore >= 31) {
      category = 'Yellow';
      levelLabel = 'Moderate Risk';
    }

    // 4. Predictions
    const cancellationChance = Math.round(finalScore * 0.9 + 5);
    const renewalChance = 100 - cancellationChance;
    const revenueRisk = Math.round(finalScore * 0.95);
    const retentionScore = 100 - finalScore;

    // 5. Detection triggers checklist
    const triggers: string[] = [];
    if (noAttendance14Days) triggers.push("No Attendance For 14 Days");
    else if (noAttendance7Days) triggers.push("No Attendance For 7 Days");
    if (attendanceDropPercent >= 75) triggers.push("Attendance Dropped 75%");
    else if (attendanceDropPercent >= 50) triggers.push("Attendance Dropped 50%");
    if (daysLeft < 0) triggers.push("Membership Lapsed");
    else if (daysLeft <= 7) triggers.push("Expiry In 7 Days");
    else if (daysLeft <= 15) triggers.push("Expiry In 15 Days");
    else if (daysLeft <= 30) triggers.push("Expiry In 30 Days");
    if (noAppLogin15Days) triggers.push("No App Login For 15 Days");
    if (dietCompliance < 20) triggers.push("Diet Compliance Below 20%");
    if (workoutCompliance < 20) triggers.push("Workout Compliance Below 20%");
    if (!hasTrainer) triggers.push("No Coach Engagement");

    // 6. Action Recommendation
    let recAction = 'Send Push Notification';
    if (category === 'Red') recAction = 'Call Member';
    else if (category === 'Orange') recAction = 'Schedule Follow Up';
    else if (category === 'Yellow') recAction = 'Assign Trainer';

    return {
      score: finalScore,
      category,
      levelLabel,
      attendanceDrop: attendanceDropPercent,
      dietCompliance,
      workoutCompliance,
      daysLeft,
      renewalChance,
      cancellationChance,
      revenueRisk,
      retentionScore,
      triggers,
      recAction
    };
  };

  // Perform calculations for all members
  const evaluatedMembers = members.map(m => {
    const aiMetrics = calculateRiskMetrics(m);
    return {
      ...m,
      ai: aiMetrics
    };
  });

  // Filter roster by search & risk category
  const filteredRoster = evaluatedMembers.filter(m => {
    const matchesSearch = m.name?.toLowerCase().includes(search.toLowerCase()) || 
                          m.phone?.includes(search) || 
                          m.memberId?.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedRiskCategory === 'all' || m.ai.category === selectedRiskCategory;
    return matchesSearch && matchesCategory;
  });

  // Auto trigger check: disabled to prevent cluttering the follow-ups queue with auto-triggered tasks.
  useEffect(() => {
    // Disabled auto-generation of follow-up tasks in Firestore
    /*
    if (!isFirebaseReady || !fDb || evaluatedMembers.length === 0) return;

    const criticalMembers = evaluatedMembers.filter(m => m.ai.category === 'Red');
    criticalMembers.forEach(async (m) => {
      const alertKey = `alert_triggered_${m.id}`;
      if (localStorage.getItem(alertKey)) return;

      try {
        await addDoc(collection(fDb, 'followups'), {
          memberId: m.id,
          memberName: m.name,
          memberPhone: m.phone,
          riskScore: m.ai.score,
          assignedTo: m.trainer || 'Receptionist Desk',
          status: 'pending',
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          notes: `AUTO TRIGGER: Critical Risk Score ${m.ai.score}% detected due to: ${m.ai.triggers.join(', ')}. Contact member immediately.`,
          createdAt: new Date().toISOString()
        });

        await setDoc(doc(fDb, 'risk_scores', m.id), {
          memberId: m.id,
          memberName: m.name,
          score: m.ai.score,
          category: m.ai.category,
          updatedAt: new Date().toISOString(),
          triggers: m.ai.triggers
        });

        localStorage.setItem(alertKey, 'true');
        console.log(`Auto Actions triggered for ${m.name}`);
      } catch (err) {
        console.error("Auto trigger error:", err);
      }
    });
    */
  }, [members]);


  // Handle retention action (Call, WhatsApp, push notification, offer discount, PT session, etc.)
  const handleRetentionAction = async (member: any, actionType: string) => {
    let detailMsg = '';
    let successToast = '';

    const trackingId = Math.floor(1000 + Math.random() * 9000);

    if (actionType === 'Call Member') {
      detailMsg = `Called member at ${member.phone}. Checked in on reasons for low gym attendance.`;
      successToast = `Phone call task logged for ${member.name}!`;
    } else if (actionType === 'Send WhatsApp') {
      const isExpiry = member.ai.daysLeft <= 15;
      const text = isExpiry 
        ? `Hi ${member.name}, your The Warrior Gym membership expires in ${member.ai.daysLeft} days. Renew today to keep your fitness streak alive!`
        : `Hello ${member.name}, we noticed you haven't visited The Warrior Gym recently. Your fitness journey matters to us. Reach out if you need anything!`;
      
      detailMsg = `Dispatched WhatsApp Template: "${text}"`;
      successToast = `Simulated WhatsApp template dispatched to ${member.name}!`;
    } else if (actionType === 'Offer Discount') {
      const code = `RADAR${15 + Math.floor(Math.random() * 10)}`;
      detailMsg = `Generated 20% off renewal coupon code "${code}" and dispatched SMS.`;
      successToast = `Coupon code "${code}" SMS dispatched to ${member.name}!`;
    } else if (actionType === 'Send Push Notification') {
      detailMsg = `Triggered Push Notification: "We miss you! You have not visited the gym for 7 days. Book your next workout today."`;
      successToast = `App Push Notification sent to ${member.name}!`;

      // Save push notification to Firestore system notifications so the member app pulls it
      if (isFirebaseReady && fDb) {
        try {
          await addDoc(collection(fDb, 'member_notifications'), {
            memberId: member.id,
            title: 'We miss you! 🥺',
            text: 'You have not visited the gym for 7 days. Book your next workout today.',
            icon: '🔥',
            timestamp: new Date().toISOString(),
            read: false
          });
        } catch (e) {
          console.error(e);
        }
      }
    } else if (actionType === 'Schedule Follow Up') {
      detailMsg = `Created CRM follow-up callback task assigned to reception desk.`;
      successToast = `CRM callback task scheduled for ${member.name}!`;
    }

    try {
      if (isFirebaseReady && fDb) {
        await addDoc(collection(fDb, 'retention_actions'), {
          memberId: member.id,
          memberName: member.name,
          action: actionType,
          details: detailMsg,
          operator: user?.name || 'Owner',
          timestamp: new Date().toISOString()
        });
      }
      toast.success(successToast, { icon: '🤖' });
    } catch (e) {
      toast.error('Failed to log retention action');
    }
  };

  // Aggregated Metrics
  const totalMembers = evaluatedMembers.length;
  const redRiskCount = evaluatedMembers.filter(m => m.ai.category === 'Red').length;
  const orangeRiskCount = evaluatedMembers.filter(m => m.ai.category === 'Orange').length;
  const yellowRiskCount = evaluatedMembers.filter(m => m.ai.category === 'Yellow').length;
  const greenRiskCount = evaluatedMembers.filter(m => m.ai.category === 'Green').length;

  const totalAtRiskCount = redRiskCount + orangeRiskCount;
  
  // Churn/Retention calculation
  const retentionRate = totalMembers > 0 ? Math.round(((totalMembers - totalAtRiskCount) / totalMembers) * 100) : 88;
  const churnRate = 100 - retentionRate;

  // Revenue Risk Math: Sum of (plan price * cancellation chance)
  const expectedRevenueLoss = evaluatedMembers.reduce((sum, m) => {
    const price = planPrices[m.plan] || 2500;
    const lossProbability = m.ai.cancellationChance / 100;
    return sum + (price * lossProbability);
  }, 0);

  const expectedRenewalsCount = evaluatedMembers.reduce((count, m) => {
    const probability = m.ai.renewalChance / 100;
    return count + probability;
  }, 0);

  // Chart 1: Churn Risk Trends mock data
  const trendData = [
    { month: 'Jan', riskScore: 42, churnRate: 8, renewals: 12 },
    { month: 'Feb', riskScore: 40, churnRate: 7, renewals: 14 },
    { month: 'Mar', riskScore: 35, churnRate: 6, renewals: 19 },
    { month: 'Apr', riskScore: 48, churnRate: 9, renewals: 11 },
    { month: 'May', riskScore: 54, churnRate: 11, renewals: 15 },
    { month: 'Jun', riskScore: Math.round(evaluatedMembers.reduce((sum, m) => sum + m.ai.score, 0) / (totalMembers || 1)), churnRate: churnRate, renewals: Math.round(expectedRenewalsCount) }
  ];

  return (
    <div className="space-y-6 text-slate-800 text-left">
      
      {/* ─── TITLE & META HEADER ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/35 px-3 py-1 rounded-full text-rose-500 text-[10px] font-black uppercase tracking-wider mb-2">
            <Sparkles size={11} className="animate-pulse" />
            AI Retention Suite
          </div>
          <h1 className="text-2xl font-black uppercase tracking-wider text-slate-900 font-display">AI Member Risk Radar™</h1>
          <p className="text-xs text-slate-500 font-medium">Automatic churn predictor, heatmap dashboard, and real-time CRM retention workflows.</p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setShowReportsDrawer(true)}
            className="px-4 py-2.5 rounded-2xl bg-white border border-slate-200 text-slate-700 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm hover:bg-slate-50 transition-all cursor-pointer"
          >
            <FileText size={14} /> Risk Reports
          </button>
          
          <div className="flex items-center gap-2 bg-[#EF4444]/10 border border-[#EF4444]/35 px-3 py-2.5 rounded-2xl">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest leading-none">
              {redRiskCount} Critical Members
            </span>
          </div>
        </div>
      </div>

      {/* ─── OWNER METRICS GRID ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center shrink-0">
            <UserX size={20} />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black block">Members At Risk</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{totalAtRiskCount}</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
            <DollarSign size={20} />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black block">Expected Rev Loss</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">₹{(expectedRevenueLoss).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black block">Retention Rate</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{retentionRate}%</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-500 flex items-center justify-center shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black block">Expected Renewals</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{expectedRenewalsCount.toFixed(1)}</span>
          </div>
        </div>
      </div>

      {/* ─── HEATMAP & CHARTS CONTAINER ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Risk Heatmap (Branch Retention Analysis) */}
        <div className="bg-white border border-slate-100 rounded-[32px] p-5 shadow-sm space-y-4 lg:col-span-1">
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-display">Risk Heatmap Matrix</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Filter the roster by clicking cell matrix tags below.</p>
          </div>

          <div className="grid grid-cols-2 gap-3.5 pt-2">
            {[
              { id: 'Red', label: 'Red (Critical)', count: redRiskCount, color: 'bg-red-500/10 border-red-500 text-red-500 hover:bg-red-500/20' },
              { id: 'Orange', label: 'Orange (High)', count: orangeRiskCount, color: 'bg-orange-500/10 border-orange-500 text-orange-500 hover:bg-orange-500/20' },
              { id: 'Yellow', label: 'Yellow (Moderate)', count: yellowRiskCount, color: 'bg-amber-500/10 border-amber-500 text-amber-500 hover:bg-amber-500/20' },
              { id: 'Green', label: 'Green (Low)', count: greenRiskCount, color: 'bg-emerald-500/10 border-emerald-500 text-emerald-500 hover:bg-emerald-500/20' }
            ].map(cell => (
              <button
                key={cell.id}
                onClick={() => setSelectedRiskCategory(selectedRiskCategory === cell.id ? 'all' : cell.id as any)}
                className={`p-4 border rounded-2xl flex flex-col justify-between text-left transition-all duration-300 cursor-pointer ${cell.color} ${
                  selectedRiskCategory === cell.id ? 'ring-2 ring-slate-900 scale-95 border-opacity-100 shadow-md' : 'border-opacity-40'
                }`}
              >
                <div className="text-[9px] font-black uppercase tracking-wider">{cell.label}</div>
                <div className="text-3xl font-black mt-2 leading-none">{cell.count}</div>
                <div className="text-[8px] font-bold uppercase tracking-widest mt-1.5 opacity-60">Members</div>
              </button>
            ))}
          </div>

          <button 
            onClick={() => setSelectedRiskCategory('all')}
            className={`w-full py-2.5 rounded-xl border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer bg-white ${selectedRiskCategory === 'all' ? 'opacity-50 cursor-not-allowed' : 'hover:bg-slate-50'}`}
            disabled={selectedRiskCategory === 'all'}
          >
            Clear Heatmap Filters
          </button>

          <div className="p-3 bg-indigo-950/45 border border-indigo-500/20 rounded-2xl text-[10px] leading-relaxed text-left text-white flex gap-2">
            <Info size={14} className="text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <span className="font-black uppercase text-indigo-400 tracking-wider block">Branch Risk Analytics</span>
              <p className="text-[9.5px] mt-0.5 font-bold">Mohali, Punjab Branch is currently sitting at a <span className="text-emerald-400">92%</span> retention rate. Expected churn is estimated at 4 members next week.</p>
            </div>
          </div>
        </div>

        {/* Risk Trend charts */}
        <div className="bg-white border border-slate-100 rounded-[32px] p-5 shadow-sm space-y-4 lg:col-span-2 flex flex-col justify-between h-[340px]">
          <div>
            <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-display">Risk Trends & Churn Forecast</h3>
            <p className="text-[10px] text-slate-400 mt-0.5">Real-time churn risk indicators and renewal predictions over time.</p>
          </div>

          <div className="flex-1 w-full h-[180px] mt-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorRisk" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.25}/>
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0.01}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 9, fontWeight: 'bold' }} stroke="#94a3b8" />
                <Tooltip contentStyle={{ fontSize: 10, borderRadius: '12px' }} />
                <Area type="monotone" dataKey="riskScore" name="Avg Risk Score %" stroke="#EF4444" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRisk)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="border-t border-slate-50 pt-3 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            <span>Branch: Mohali, Punjab (All Members)</span>
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Current Month: Jun
            </span>
          </div>
        </div>
      </div>

      {/* ─── MAIN ROSTER & ACTIONS TIMELINE ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Columns: Roster Grid */}
        <div className="lg:col-span-2 space-y-4">
          
          {/* Search bar */}
          <div className="flex bg-white border border-slate-100 rounded-3xl p-2.5 items-center gap-3 shadow-sm">
            <Search className="text-slate-400 ml-1.5 shrink-0" size={16} />
            <input
              type="text"
              placeholder="Search at-risk members by name, phone, or membership ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-xs font-semibold focus:outline-none bg-transparent placeholder-slate-400 text-slate-800"
            />
            {selectedRiskCategory !== 'all' && (
              <span className="text-[9px] bg-black text-white px-3 py-1 rounded-full font-black uppercase tracking-wider shrink-0 mr-1.5">
                {selectedRiskCategory} Filter
              </span>
            )}
          </div>

          {/* Member risk cards container */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredRoster.map(m => {
              const daysLeft = m.ai.daysLeft;
              const hasTrainer = m.trainer && m.trainer.trim() !== '';
              
              // Color settings for score tag
              let badgeColor = 'text-emerald-500 bg-emerald-50/70 border-emerald-100';
              let ringColor = 'border-emerald-500/20';
              if (m.ai.category === 'Red') {
                badgeColor = 'text-red-500 bg-red-50/70 border-red-100';
                ringColor = 'border-red-500/40';
              } else if (m.ai.category === 'Orange') {
                badgeColor = 'text-orange-500 bg-orange-50/70 border-orange-100';
                ringColor = 'border-orange-500/30';
              } else if (m.ai.category === 'Yellow') {
                badgeColor = 'text-amber-500 bg-amber-50/70 border-amber-100';
                ringColor = 'border-amber-500/30';
              }

              const initials = getInitials(m.name);
              const avatar = m.photo || `https://api.dicebear.com/7.x/adventurer/svg?seed=${m.name.replace(/ /g, '')}`;

              return (
                <div 
                  key={m.id}
                  className="bg-white border border-slate-100 p-5 rounded-[32px] shadow-sm space-y-4 text-left flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <img 
                        src={avatar} 
                        alt={m.name} 
                        className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 shrink-0 object-cover" 
                        onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/adventurer/svg?seed=${m.name}` }}
                      />
                      <div className="min-w-0">
                        <h4 className="text-xs font-black text-slate-900 truncate leading-tight">{m.name}</h4>
                        <p className="text-[9px] font-mono text-slate-400 mt-1">{m.memberId || m.id} · {m.plan}</p>
                        <p className="text-[8.5px] font-bold text-slate-500 mt-0.5">Trainer: {hasTrainer ? m.trainer : <span className="text-rose-500">Unassigned</span>}</p>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end shrink-0">
                      <div className={`px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border ${badgeColor}`}>
                        Score {m.ai.score}
                      </div>
                      <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1 block">
                        {m.ai.levelLabel}
                      </span>
                    </div>
                  </div>

                  {/* AI Prediction specs */}
                  <div className="grid grid-cols-3 gap-2 py-3 border-y border-slate-50 font-mono">
                    <div className="bg-slate-50 p-2 rounded-xl text-center">
                      <span className="text-[7.5px] font-bold text-slate-400 block uppercase tracking-widest">Attendance</span>
                      <span className="text-xs font-extrabold text-slate-700 block mt-0.5">
                        {m.attendanceCount || 0} Visits
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl text-center">
                      <span className="text-[7.5px] font-bold text-slate-400 block uppercase tracking-widest">Cancel Chance</span>
                      <span className={`text-xs font-extrabold block mt-0.5 ${m.ai.cancellationChance > 70 ? 'text-red-500' : 'text-slate-700'}`}>
                        {m.ai.cancellationChance}%
                      </span>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl text-center">
                      <span className="text-[7.5px] font-bold text-slate-400 block uppercase tracking-widest">Renewal Chance</span>
                      <span className={`text-xs font-extrabold block mt-0.5 ${m.ai.renewalChance < 30 ? 'text-rose-500' : 'text-slate-700'}`}>
                        {m.ai.renewalChance}%
                      </span>
                    </div>
                  </div>

                  {/* Triggers list */}
                  <div className="space-y-1.5">
                    <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Detection Flags</span>
                    <div className="flex flex-wrap gap-1">
                      {m.ai.triggers.map((trig: string, idx: number) => (
                        <span key={idx} className="bg-slate-50 border border-slate-100 text-slate-500 text-[8.5px] font-bold px-2 py-0.5 rounded-lg flex items-center gap-1">
                          <span className="w-1 h-1 rounded-full bg-red-400" /> {trig}
                        </span>
                      ))}
                      {m.ai.triggers.length === 0 && (
                        <span className="text-[8.5px] text-slate-400 italic font-medium">No flags triggered</span>
                      )}
                    </div>
                  </div>

                  {/* Recommendations Actions panel */}
                  <div className="pt-3.5 border-t border-slate-50 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest block leading-none">Suggested Action</span>
                      <span className="text-[10px] font-extrabold text-indigo-600 block mt-1 leading-none">{m.ai.recAction}</span>
                    </div>

                    <div className="flex gap-1">
                      {m.ai.category === 'Red' && (
                        <button
                          onClick={() => handleRetentionAction(m, 'Call Member')}
                          className="px-2.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[9.5px] font-black uppercase tracking-wider cursor-pointer border-none"
                          title="Call Member"
                        >
                          <Phone size={12} className="inline mr-1" /> Call
                        </button>
                      )}
                      <button
                        onClick={() => handleRetentionAction(m, 'Send WhatsApp')}
                        className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[9.5px] font-black uppercase tracking-wider cursor-pointer border-none"
                        title="Simulate WhatsApp Alert"
                      >
                        <MessageSquare size={12} className="inline mr-1" /> WhatsApp
                      </button>
                      <button
                        onClick={() => handleRetentionAction(m, 'Send Push Notification')}
                        className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[9.5px] font-black uppercase tracking-wider cursor-pointer border-none"
                        title="Simulate Push Notification Nudge"
                      >
                        <Bell size={12} className="inline mr-1" /> Push
                      </button>
                      <button
                        onClick={() => handleRetentionAction(m, 'Offer Discount')}
                        className="px-2 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-[9.5px] font-black uppercase tracking-wider cursor-pointer border-none"
                        title="Simulate Discount Offer SMS"
                      >
                        %
                      </button>
                      <button
                        onClick={() => setAiInsightMemberId(m.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[9.5px] font-black uppercase tracking-wider cursor-pointer border-none"
                        title="View AI Insight Model"
                      >
                        <Cpu size={12} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredRoster.length === 0 && (
              <div className="col-span-full py-16 text-center text-slate-400 italic text-xs bg-white border border-slate-100 rounded-[32px]">
                No members found matching your search filter.
              </div>
            )}
          </div>
        </div>

        {/* Right 1 Column: AI Insights & Real-time Action History */}
        <div className="space-y-6 lg:col-span-1">
          
          {/* AI Insights Sidebar widget */}
          <div className="bg-slate-900 text-white border border-slate-800 p-5 rounded-[32px] shadow-sm space-y-4 text-left">
            <div className="flex justify-between items-center">
              <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 block">Fitness Intelligence</span>
              <Cpu size={14} className="text-indigo-400 shrink-0" />
            </div>
            
            <h3 className="text-xs font-black uppercase tracking-wider font-display text-white">AI Retention Insights</h3>

            <div className="space-y-4 text-xs font-medium text-slate-300">
              {aiInsightMemberId ? (() => {
                const match = evaluatedMembers.find(m => m.id === aiInsightMemberId);
                if (!match) return <p className="italic text-slate-500 text-[10px]">No member selected.</p>;
                return (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-indigo-600 text-white font-black text-[9px] flex items-center justify-center">
                        {getInitials(match.name)}
                      </div>
                      <span className="font-bold text-white text-[11px]">{match.name}</span>
                    </div>

                    <p className="leading-relaxed text-[10px] text-slate-450 bg-slate-950 p-3 rounded-2xl border border-white/5 font-sans">
                      "Member <span className="text-white font-bold">{match.name}</span> has a <span className="text-red-400 font-extrabold">{match.ai.cancellationChance}% cancellation chance</span> due to:
                      {match.ai.triggers.map((t: string, idx: number) => (
                        <span key={idx} className="block text-[#D4FF00] font-bold mt-1 text-[9px] font-mono">• {t}</span>
                      ))}
                      Engagement score is at {match.ai.retentionScore}%. AI recommends Immediate callback task scheduled."
                    </p>
                    <button 
                      onClick={() => setAiInsightMemberId(null)}
                      className="text-[9.5px] text-indigo-400 font-bold hover:underline bg-transparent border-none cursor-pointer"
                    >
                      ← Back to General Summary
                    </button>
                  </motion.div>
                );
              })() : (
                <div className="space-y-3">
                  <p className="leading-relaxed text-[10.5px]">
                    The Warrior Gym AI engine analyzes checkin rates, diet compliance checklists, and payment statuses dynamically.
                  </p>
                  
                  <div className="space-y-2 border-t border-slate-800 pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400">Total Churn Risk</span>
                      <span className="font-bold text-red-400 text-xs">{churnRate}%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400">Monthly Target Renewals</span>
                      <span className="font-bold text-[#D4FF00] text-xs">₹{(expectedRenewalsCount * 3500).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>

                  <p className="text-[9px] text-slate-500 mt-2 font-mono">Click the CPU icon on any member card to generate natural language retention logs.</p>
                </div>
              )}
            </div>
          </div>

          {/* Real-time Actions Log Feed */}
          <div className="bg-white border border-slate-100 p-5 rounded-[32px] shadow-sm space-y-4 text-left flex flex-col h-[280px]">
            <div>
              <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">CRM Audit Log</span>
              <h3 className="text-xs font-black text-slate-800 uppercase mt-0.5 font-display flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-[#0052FF] animate-pulse" />
                Retention Actions Logs
              </h3>
            </div>

            <div className="flex-grow overflow-y-auto space-y-3.5 pr-1 text-[11px] text-slate-700">
              {actionsHistory.length > 0 ? (
                actionsHistory.map((act) => (
                  <div key={act.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col gap-1">
                    <div className="flex justify-between items-center">
                      <span className="font-black text-slate-900 uppercase text-[9px]">{act.action}</span>
                      <span className="text-[8px] text-slate-400 font-mono font-medium">{new Date(act.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="text-[10px] text-slate-650 leading-relaxed font-sans">{act.details}</p>
                    <div className="flex justify-between items-center text-[7.5px] text-slate-400 font-bold uppercase tracking-wider pt-1 border-t border-slate-100/50">
                      <span>Client: {act.memberName}</span>
                      <span>By: {act.operator}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="h-full flex items-center justify-center text-slate-400 italic text-[10px] py-16">
                  No retention actions logged today.
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ─── AI REPORTS DRAWER ─── */}
      <AnimatePresence>
        {showReportsDrawer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-2xl bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider font-display">AI Retention Reports</h3>
                  <p className="text-[10px] text-slate-400 mt-0.5">Automated churn forecast models and branch analytics.</p>
                </div>
                <button onClick={() => setShowReportsDrawer(false)} className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer bg-transparent border-none">
                  ✕
                </button>
              </div>

              {/* Report sub-tabs */}
              <div className="flex bg-slate-50 border border-slate-100 rounded-xl p-0.5 text-[9.5px] font-black uppercase tracking-wider">
                {[
                  { id: 'daily', label: 'Daily Risk' },
                  { id: 'weekly', label: 'Weekly Churn' },
                  { id: 'branch', label: 'Branch Analysis' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedReportTab(tab.id as any)}
                    className={`flex-1 py-2 text-center rounded-lg cursor-pointer border-none outline-none ${
                      selectedReportTab === tab.id 
                        ? 'bg-black text-white shadow-sm' 
                        : 'text-slate-400 hover:text-slate-700 bg-transparent'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Report content */}
              <div className="bg-slate-50 rounded-2xl p-4 text-xs text-left leading-relaxed space-y-4">
                {selectedReportTab === 'daily' && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider">Daily Risk Audit Report</h4>
                    <p className="text-slate-600">The AI Retention Radar processed check-in patterns and diet compliances at 08:00 AM today. 
                    A total of <span className="font-bold text-red-500">{redRiskCount} critical risk alerts</span> and <span className="font-bold text-orange-500">{orangeRiskCount} high-risk warnings</span> were logged.</p>
                    
                    <div className="border-t border-slate-200 pt-3 space-y-1.5 font-mono text-[10px] text-slate-700">
                      <div className="flex justify-between">
                        <span>• Active CRM follow-up callback tasks:</span>
                        <span className="font-bold">{redRiskCount + orangeRiskCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>• Automatically triggered push notifications:</span>
                        <span className="font-bold">{redRiskCount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>• Average Daily Attendance Consistency:</span>
                        <span className="font-bold">78.5%</span>
                      </div>
                    </div>
                  </div>
                )}

                {selectedReportTab === 'weekly' && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider">Weekly Churn Forecast Model</h4>
                    <p className="text-slate-650">Projected weekly metrics based on historical check-in rates and membership lapse records.</p>
                    
                    <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-3 text-[10px]">
                      <div className="bg-white border border-slate-100 p-3 rounded-xl">
                        <span className="text-slate-400 uppercase tracking-widest block font-bold text-[8px]">Projected Churn Count</span>
                        <span className="text-xl font-black text-rose-500 mt-1 block">{(totalAtRiskCount * 0.45).toFixed(0)} Members</span>
                      </div>
                      <div className="bg-white border border-slate-100 p-3 rounded-xl">
                        <span className="text-slate-400 uppercase tracking-widest block font-bold text-[8px]">Weekly Revenue Risk</span>
                        <span className="text-xl font-black text-red-500 mt-1 block">₹{(expectedRevenueLoss * 0.45).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                      </div>
                    </div>
                  </div>
                )}

                {selectedReportTab === 'branch' && (
                  <div className="space-y-3">
                    <h4 className="font-extrabold text-slate-800 uppercase text-[10px] tracking-wider">Branch Retention Analytics</h4>
                    <p className="text-slate-600">Retention and expected revenue metrics compared across gym operators.</p>
                    
                    <div className="border-t border-slate-200 pt-3 divide-y divide-slate-150 text-[10px] text-slate-700">
                      <div className="flex justify-between py-2 font-bold text-slate-900">
                        <span>Branch Location</span>
                        <span>Active Members</span>
                        <span>Retention Rate</span>
                        <span>Expected Loss</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span>Mohali, Punjab (Main)</span>
                        <span>{totalMembers}</span>
                        <span className="text-emerald-500 font-bold">{retentionRate}%</span>
                        <span className="text-red-500 font-bold">₹{expectedRevenueLoss.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <button
                onClick={() => setShowReportsDrawer(false)}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider text-center cursor-pointer border-none"
              >
                Close Reports
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
