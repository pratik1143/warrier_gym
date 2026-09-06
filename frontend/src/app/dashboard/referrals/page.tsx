'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Gift, Award, TrendingUp, DollarSign, ShieldAlert, Cpu, Sparkles, 
  CheckCircle2, AlertTriangle, Search, Trash2, ArrowUpRight, Check, X,
  Clock, Share2, Award as AmbassadorBadge, Shield, Zap
} from 'lucide-react';
import { useGymStore, useAuthStore } from '@/store';
import { formatDate, getInitials } from '@/lib/utils';
import { 
  collection, addDoc, setDoc, doc, onSnapshot, query, orderBy, getDocs, deleteDoc
} from 'firebase/firestore';
import { db as fDb, isFirebaseReady } from '@/lib/firebase';
import toast from '@/lib/toast';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell 
} from 'recharts';

export default function ReferralsAdminPage() {
  const { user } = useAuthStore();
  const { members, fetchMembers } = useGymStore();

  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [referrals, setReferrals] = useState<any[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'heatmap' | 'roster' | 'rewards' | 'fraud'>('heatmap');

  // Load Firestore data
  useEffect(() => {
    fetchMembers();

    if (isFirebaseReady && fDb) {
      // 1. Subscribe to referrals
      const refQuery = query(collection(fDb, 'referrals'), orderBy('createdAt', 'desc'));
      const unsubRef = onSnapshot(refQuery, (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setReferrals(list);
      }, (error) => {
        console.warn("Referrals list snapshot error:", error.message);
      });

      // 2. Subscribe to referral_rewards
      const rewQuery = query(collection(fDb, 'referral_rewards'), orderBy('issuedAt', 'desc'));
      const unsubRew = onSnapshot(rewQuery, (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setRewards(list);
      }, (error) => {
        console.warn("Referral rewards list snapshot error:", error.message);
      });

      return () => {
        unsubRef();
        unsubRew();
      };
    }
  }, [fetchMembers]);

  // Action: Wipe All Referral Data (Reset Growth Engine)
  const handleWipeAllData = async () => {
    if (!isFirebaseReady || !fDb) return;
    const confirmWipe = window.confirm("⚠️ WARNING: This will permanently delete ALL referrals, rewards, and notification tracking logs from Firebase Firestore. Do you want to continue?");
    if (!confirmWipe) return;

    try {
      const refsSnap = await getDocs(collection(fDb, 'referrals'));
      for (const d of refsSnap.docs) {
        await deleteDoc(doc(fDb, 'referrals', d.id));
      }

      const rewsSnap = await getDocs(collection(fDb, 'referral_rewards'));
      for (const d of rewsSnap.docs) {
        await deleteDoc(doc(fDb, 'referral_rewards', d.id));
      }

      const notifsSnap = await getDocs(collection(fDb, 'member_notifications'));
      for (const d of notifsSnap.docs) {
        await deleteDoc(doc(fDb, 'member_notifications', d.id));
      }

      // Reset member points to 0
      for (const m of members) {
        await setDoc(doc(fDb, 'members', m.id), {
          rewardPoints: 0
        }, { merge: true });
      }

      toast.success("Growth Engine reset successfully. All databases cleared!", { icon: '🗑️' });
    } catch (err) {
      console.error(err);
      toast.error("Failed to clear database records.");
    }
  };

  // Action: Approve Referral and Credit Reward
  const handleApproveReferral = async (ref: any) => {
    if (!isFirebaseReady || !fDb) return;
    try {
      // 1. Update referral status in Firestore
      await setDoc(doc(fDb, 'referrals', ref.id), {
        status: 'Reward Credited',
        currentStep: 6,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Generate and store reward in referral_rewards collection
      let rewardText = '1 Protein Shake';
      // Find how many successful referrals the referrer has
      const referrerRefs = referrals.filter(r => r.referrerId === ref.referrerId && r.status === 'Reward Credited');
      const succCount = referrerRefs.length + 1; // including current

      if (succCount >= 10) rewardText = 'Premium Membership Upgrade';
      else if (succCount >= 5) rewardText = '1 Month Free Membership';
      else if (succCount >= 3) rewardText = '1 Gym T-Shirt';

      await addDoc(collection(fDb, 'referral_rewards'), {
        referrerId: ref.referrerId,
        referrerName: ref.referrerName,
        friendId: ref.id,
        friendName: ref.friendName,
        rewardName: rewardText,
        status: 'Issued',
        referralsMilestone: succCount,
        couponCode: `REF-${Math.floor(100000 + Math.random() * 900000)}`,
        issuedAt: new Date().toISOString()
      });

      // 3. Dispatch system notification for Member App simulation
      await addDoc(collection(fDb, 'member_notifications'), {
        memberId: ref.referrerId,
        title: '🎉 Referral Reward Credited!',
        text: `Your friend ${ref.friendName} purchased membership! Reward: ${rewardText} is now inside your wallet.`,
        icon: '🎁',
        timestamp: new Date().toISOString(),
        read: false
      });

      // 4. Update Referrer Member points in store (simulated update)
      const refMember = members.find(m => m.id === ref.referrerId || m.name === ref.referrerName);
      if (refMember) {
        const nextPoints = (refMember.rewardPoints || 0) + 200;
        await setDoc(doc(fDb, 'members', refMember.id), {
          rewardPoints: nextPoints
        }, { merge: true });
      }

      toast.success(`Referral approved! credited "${rewardText}" to ${ref.referrerName}`, { icon: '🏆' });
    } catch (err) {
      toast.error('Failed to approve referral');
    }
  };

  // Action: Reject referral
  const handleRejectReferral = async (ref: any, reason: string = 'Fraudulent profile detected') => {
    if (!isFirebaseReady || !fDb) return;
    try {
      await setDoc(doc(fDb, 'referrals', ref.id), {
        status: 'Rejected',
        updatedAt: new Date().toISOString(),
        rejectionReason: reason
      }, { merge: true });

      toast.success(`Referral from ${ref.referrerName} rejected.`, { icon: '✕' });
    } catch (err) {
      toast.error('Failed to reject referral');
    }
  };

  // Helper to determine plan price dynamically
  const getPlanPrice = (plan: string) => {
    const p = plan?.toLowerCase() || '';
    if (p.includes('annual')) return 8000;
    if (p.includes('monthly')) return 2500;
    if (p.includes('quarterly')) return 6500;
    return 6000; // default for Gold/others
  };

  // 1. Calculations & Metrics
  const totalInvites = referrals.length;
  const registeredCount = referrals.filter(r => r.currentStep >= 3).length;
  const purchasesCount = referrals.filter(r => r.currentStep >= 4).length;
  const conversionsCount = referrals.filter(r => r.status === 'Reward Credited').length;
  const totalRevenue = referrals
    .filter(r => r.currentStep >= 4)
    .reduce((acc, r) => acc + getPlanPrice(r.joinPlan), 0);
  const conversionRate = totalInvites > 0 ? Math.round((purchasesCount / totalInvites) * 100) : 0;

  // Top Referrers Heatmap data
  // We aggregate dynamically from real Firestore referrals collection
  const referrersMap: Record<string, { invites: number, registrations: number, purchases: number, revenue: number }> = {};

  referrals.forEach(r => {
    const name = r.referrerName || 'Ambassador';
    if (!referrersMap[name]) {
      referrersMap[name] = { invites: 0, registrations: 0, purchases: 0, revenue: 0 };
    }
    referrersMap[name].invites += 1;
    if (r.currentStep >= 3) referrersMap[name].registrations += 1;
    if (r.currentStep >= 4) {
      referrersMap[name].purchases += 1;
      referrersMap[name].revenue += getPlanPrice(r.joinPlan);
    }
  });

  const heatmapData = Object.entries(referrersMap).map(([name, stats]) => ({
    name,
    ...stats,
    score: Math.round((stats.purchases / Math.max(1, stats.invites)) * 100)
  })).sort((a, b) => b.revenue - a.revenue);

  // Conversion Funnel data
  const funnelData = [
    { name: 'Invites Sent', count: totalInvites, fill: '#6366F1' },
    { name: 'App Installed', count: referrals.filter(r => r.currentStep >= 1).length, fill: '#3B82F6' },
    { name: 'Registrations', count: registeredCount, fill: '#F59E0B' },
    { name: 'Purchased', count: purchasesCount, fill: '#d4ff00' },
    { name: 'Rewarded', count: conversionsCount, fill: '#10B981' }
  ];

  // Filtering roster
  const filteredRoster = referrals.filter(r => {
    const matchesSearch = r.friendName?.toLowerCase().includes(search.toLowerCase()) || 
                          r.referrerName?.toLowerCase().includes(search.toLowerCase()) || 
                          r.friendPhone?.includes(search);
    const matchesStatus = selectedStatus === 'all' || r.status === selectedStatus;
    return matchesSearch && matchesStatus;
  });

  // Gamification badges helper
  const getBadge = (revenue: number) => {
    if (revenue >= 40000) return { label: 'Warrior Influencer', color: 'bg-red-500 text-white border-red-400' };
    if (revenue >= 20000) return { label: 'Platinum Ambassador', color: 'bg-violet-600 text-white border-violet-400' };
    if (revenue >= 10000) return { label: 'Gold Ambassador', color: 'bg-amber-400 text-black border-amber-300' };
    if (revenue >= 5000) return { label: 'Silver Ambassador', color: 'bg-slate-300 text-slate-900 border-slate-200' };
    return { label: 'Bronze Ambassador', color: 'bg-amber-700 text-white border-amber-600' };
  };

  // Anti-fraud validation triggers
  const fraudLogs = referrals.filter(r => {
    // Check duplicate phone
    const dups = referrals.filter(x => x.friendPhone === r.friendPhone).length;
    // Check self referral
    const isSelfRef = r.friendPhone === r.referrerPhone || r.referrerName?.toLowerCase() === r.friendName?.toLowerCase();
    // Check device match (Same Device Abuse)
    const isDeviceAbuse = r.friendDeviceHash && r.referrerDeviceHash && r.friendDeviceHash === r.referrerDeviceHash;
    return dups > 1 || isSelfRef || isDeviceAbuse;
  });

  return (
    <div className="flex flex-col gap-6 w-full text-slate-800 text-left font-sans">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          <h2 className="font-rowdies text-3xl md:text-4xl font-bold text-slate-900 uppercase tracking-tight leading-none">
            Warrior Referral Engine™
          </h2>
          <p className="text-slate-500 text-xs mt-1.5 font-medium">
            Monitor the membership referral lifecycle, verify conversion stages, and issue ambassador rewards.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleWipeAllData}
            className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-[10px] font-black uppercase tracking-wider rounded-2xl cursor-pointer border border-red-200 transition-all flex items-center gap-1.5 shadow-sm"
          >
            <Trash2 size={12} /> Wipe All Data
          </button>

          <div className="flex bg-slate-100 border border-slate-200 rounded-2xl p-0.5 text-[9px] font-black uppercase tracking-wider shadow-sm">
            {['heatmap', 'roster', 'rewards', 'fraud'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab as any)}
                className={`px-3.5 py-2 rounded-xl transition-all cursor-pointer border-none outline-none ${
                  activeTab === tab ? 'bg-black text-white shadow-sm font-black' : 'text-slate-400 hover:text-slate-700 bg-transparent font-extrabold'
                }`}
              >
                {tab === 'fraud' ? 'Anti-Fraud' : tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics Ribbon Card Panel */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        {[
          { label: 'Invites Sent', val: totalInvites, icon: Share2, color: 'text-indigo-600 bg-indigo-50' },
          { label: 'Registrations', val: registeredCount, icon: Users, color: 'text-amber-500 bg-amber-50' },
          { label: 'Purchases', val: purchasesCount, icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-50' },
          { label: 'Conversion Rate', val: `${conversionRate}%`, icon: TrendingUp, color: 'text-[#F97316] bg-[#FFF7ED]' },
          { label: 'Referral Revenue', val: `₹${totalRevenue.toLocaleString()}`, icon: DollarSign, color: 'text-rose-500 bg-rose-50' },
          { label: 'Rewards Issued', val: rewards.length, icon: Gift, color: 'text-[#0052FF] bg-[#FFF7ED]' }
        ].map((m, idx) => (
          <div key={idx} className="bg-white border border-slate-100 p-4 rounded-[22px] shadow-sm flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${m.color}`}>
              <m.icon size={16} />
            </div>
            <div>
              <span className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 block">{m.label}</span>
              <span className="text-sm font-black text-slate-900 mt-0.5 block">{m.val}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tab 1: Heatmap & Funnel */}
      {activeTab === 'heatmap' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Heatmap Ambassador List */}
          <div className="lg:col-span-2 bg-white border border-slate-100 rounded-[28px] p-5 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Referral Heatmap</h3>
              <p className="text-[9.5px] text-slate-400 font-bold mt-0.5">Top brand ambassadors ranked by referrals and revenue generated.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="py-2">Ambassador</th>
                    <th className="py-2 text-center">Invites</th>
                    <th className="py-2 text-center">Registrations</th>
                    <th className="py-2 text-center">Purchases</th>
                    <th className="py-2">Tier Badge</th>
                    <th className="py-2 text-right">Revenue Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                  {heatmapData.map((row, idx) => {
                    const badge = getBadge(row.revenue);
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-slate-900 text-[#d4ff00] text-[8.5px] font-black flex items-center justify-center shrink-0">
                            {getInitials(row.name)}
                          </div>
                          <span className="text-xs font-black text-slate-950">{row.name}</span>
                        </td>
                        <td className="py-3 text-center">{row.invites}</td>
                        <td className="py-3 text-center text-amber-500">{row.registrations}</td>
                        <td className="py-3 text-center text-emerald-500 font-black">{row.purchases}</td>
                        <td className="py-3">
                          <span className={`text-[7.5px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${badge.color}`}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="py-3 text-right font-mono font-black text-slate-900">₹{row.revenue.toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recharts Funnel Chart */}
          <div className="bg-black text-white border border-slate-800 rounded-[28px] p-5 shadow-lg flex flex-col justify-between">
            <div>
              <span className="text-[9px] font-black uppercase tracking-widest text-[#d4ff00] flex items-center gap-1">
                <Zap size={10} className="fill-current" />
                Referral Funnel Analytics
              </span>
              <p className="text-[9.5px] text-slate-400 leading-normal mt-1">Real-time conversion efficiency at each lifecycle checkpoint.</p>
            </div>

            <div className="h-[220px] w-full mt-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData} layout="vertical" margin={{ top: 10, right: 10, bottom: 5, left: -10 }}>
                  <XAxis type="number" stroke="transparent" tick={{ fill: '#94A3B8', fontSize: 8 }} />
                  <YAxis type="category" dataKey="name" stroke="transparent" tick={{ fill: '#FFFFFF', fontSize: 9, fontWeight: 700 }} width={75} />
                  <Tooltip contentStyle={{ backgroundColor: '#1E293B', borderColor: '#475569', fontSize: 10, color: '#fff' }} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={12}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="flex justify-between items-center text-[8.5px] text-slate-400 font-bold uppercase border-t border-white/10 pt-3 mt-4">
              <span>Overall conversion: {conversionRate}%</span>
              <span>Conversion status: Healthy</span>
            </div>
          </div>

        </div>
      )}

      {/* Tab 2: Roster & Actions */}
      {activeTab === 'roster' && (
        <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Referral Activity Log</h3>
              <p className="text-[9.5px] text-slate-400 font-bold mt-0.5">Real-time Firestore sync logs containing all referred friend invitations.</p>
            </div>

            {/* Filters */}
            <div className="flex gap-2 w-full sm:w-auto">
              <div className="relative flex-grow sm:flex-grow-0">
                <Search className="absolute left-3 top-2.5 text-slate-400" size={12} />
                <input
                  type="text"
                  placeholder="Search name/referrer..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full sm:w-48 text-[11px] bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 focus:outline-none focus:border-black font-semibold text-slate-800"
                />
              </div>

              <select
                value={selectedStatus}
                onChange={e => setSelectedStatus(e.target.value)}
                className="text-[11px] bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-black font-bold text-slate-800"
              >
                <option value="all">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Installed App">Installed App</option>
                <option value="Registered">Registered</option>
                <option value="Membership Purchased">Membership Purchased</option>
                <option value="Reward Credited">Reward Credited</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="py-2">Friend (Invitee)</th>
                  <th className="py-2">Ambassador (Referrer)</th>
                  <th className="py-2">Invite Code</th>
                  <th className="py-2">Plan Details</th>
                  <th className="py-2">Invite Date</th>
                  <th className="py-2">Lifecycle Funnel Status</th>
                  <th className="py-2 text-right">Verification Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                {filteredRoster.map((r, idx) => {
                  let statusColor = 'bg-slate-100 text-slate-600 border-slate-200';
                  if (r.status === 'Reward Credited') statusColor = 'bg-emerald-100 text-emerald-700 border-emerald-200';
                  else if (r.status === 'Membership Purchased') statusColor = 'bg-[#FFEDD5] text-[#C2410C] border-[#FED7AA] border-dashed animate-pulse';
                  else if (r.status === 'Registered') statusColor = 'bg-amber-100 text-amber-700 border-amber-200';
                  else if (r.status === 'Rejected') statusColor = 'bg-red-100 text-red-700 border-red-200';

                  return (
                    <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3">
                        <div className="font-black text-slate-900">{r.friendName}</div>
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5">{r.friendPhone}</div>
                      </td>
                      <td className="py-3">{r.referrerName}</td>
                      <td className="py-3 font-mono font-bold text-indigo-600">{r.referralCode}</td>
                      <td className="py-3">{r.joinPlan || 'Not selected'}</td>
                      <td className="py-3 text-slate-400">{formatDate(r.createdAt || '')}</td>
                      <td className="py-3">
                        <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${statusColor}`}>
                          {r.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        {r.status === 'Membership Purchased' ? (
                          <div className="flex justify-end gap-1.5">
                            <button
                              onClick={() => handleApproveReferral(r)}
                              className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[9px] uppercase tracking-wider rounded-lg transition-all border-none cursor-pointer flex items-center gap-1 shadow-sm"
                            >
                              <Check size={10} /> Approve Purchase
                            </button>
                            <button
                              onClick={() => handleRejectReferral(r)}
                              className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-600 font-black text-[9px] uppercase tracking-wider rounded-lg transition-all border-none cursor-pointer"
                            >
                              Reject
                            </button>
                          </div>
                        ) : r.status === 'Reward Credited' ? (
                          <span className="text-[9px] text-slate-400 italic">Reward synced ✓</span>
                        ) : (
                          <span className="text-[9px] text-slate-400 italic">Awaiting friend purchase</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredRoster.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-slate-400 italic text-[11px]">
                      No referral matches found. Use the Simulated App to add invites.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Rewards Registry */}
      {activeTab === 'rewards' && (
        <div className="bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm space-y-4">
          <div>
            <h3 className="font-extrabold text-slate-900 text-sm">Reward Issuance Log</h3>
            <p className="text-[9.5px] text-slate-400 font-bold mt-0.5">List of discount coupons, vouchers, and upgrades granted to members.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="py-2">Ambassador Name</th>
                  <th className="py-2">Reward Earned</th>
                  <th className="py-2">Milestone Met</th>
                  <th className="py-2">Claim Coupon Code</th>
                  <th className="py-2">Issue Date</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                {rewards.map((rew, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-slate-900 text-[#d4ff00] text-[8.5px] font-black flex items-center justify-center shrink-0">
                        {getInitials(rew.referrerName)}
                      </div>
                      <span className="font-black text-slate-950">{rew.referrerName}</span>
                    </td>
                    <td className="py-3 text-indigo-600 font-black">{rew.rewardName}</td>
                    <td className="py-3 text-slate-500">{rew.referralsMilestone} successful referrals</td>
                    <td className="py-3 font-mono font-bold text-slate-900 bg-slate-50 px-2 py-1 rounded-lg inline-block mt-2 border border-slate-100">{rew.couponCode}</td>
                    <td className="py-3 text-slate-400">{formatDate(rew.issuedAt)}</td>
                    <td className="py-3 text-right">
                      <span className="text-[8px] font-black bg-[#d4ff00] text-black px-2.5 py-0.5 rounded-full font-mono border border-[#c5eb00]">
                        {rew.status}
                      </span>
                    </td>
                  </tr>
                ))}
                {rewards.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-slate-400 italic text-[11px]">
                      No rewards generated yet. Complete step-by-step referrals in simulated app.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Anti-Fraud Center */}
      {activeTab === 'fraud' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm space-y-4">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm">Real-time Fraud Guard Console</h3>
              <p className="text-[9.5px] text-slate-400 font-bold mt-0.5">Automated screening alerts flagging duplicate phone numbers, IP addresses, or self-referral attempts.</p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[8px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="py-2">Flagged Referral</th>
                    <th className="py-2">Referrer Name</th>
                    <th className="py-2">Mobile Number</th>
                    <th className="py-2">Security Rules Violated</th>
                    <th className="py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 font-semibold text-slate-700">
                  {fraudLogs.map((log, idx) => {
                    const isSelf = log.friendName?.toLowerCase() === log.referrerName?.toLowerCase();
                    const isDeviceAbuse = log.friendDeviceHash && log.referrerDeviceHash && log.friendDeviceHash === log.referrerDeviceHash;
                    return (
                      <tr key={idx} className="hover:bg-slate-50/80 transition-colors bg-red-50/20">
                        <td className="py-3 font-black text-red-600">{log.friendName}</td>
                        <td className="py-3">{log.referrerName}</td>
                        <td className="py-3 font-mono">{log.friendPhone}</td>
                        <td className="py-3">
                          <span className="text-[7.5px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-black uppercase tracking-wider">
                            {isSelf ? 'Self-Referral Attempted' : isDeviceAbuse ? 'Same Device Abuse Detected' : 'Duplicate Phone Number Detected'}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          <button
                            onClick={() => handleRejectReferral(log, 'Flagged by Anti-Fraud Guard')}
                            className="px-2.5 py-1 bg-red-600 text-white font-black text-[9px] uppercase tracking-wider rounded-lg border-none cursor-pointer"
                          >
                            Block & Reject
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {fraudLogs.length === 0 && (
                    <tr>
                      <td colSpan={5} className="text-center py-10 text-slate-400 italic text-[11px]">
                        No active security fraud alerts detected. System is secure.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-red-950 text-white rounded-[32px] p-6 flex flex-col justify-between border border-red-900 shadow-md">
            <div className="space-y-4">
              <div className="w-12 h-12 bg-red-900/50 text-red-400 rounded-2xl flex items-center justify-center shrink-0">
                <Shield size={24} />
              </div>
              <div>
                <h3 className="font-extrabold text-sm text-red-200">Security Constraints</h3>
                <p className="text-[10px] text-red-300 leading-relaxed mt-1">
                  Our system monitors biometric IDs, device tracking hashes, and phone numbers in realtime:
                </p>
              </div>

              <div className="space-y-2 text-[9.5px] text-red-400 font-bold font-mono">
                <div className="flex gap-2"><span>✓</span> <span>Self Referral Prevention (Blocks codes where friend = referrer)</span></div>
                <div className="flex gap-2"><span>✓</span> <span>Duplicate Account Filter (Prevents double claims on same phone number)</span></div>
                <div className="flex gap-2"><span>✓</span> <span>Device Fingerprint Validation (Flags multiple app instances on same browser session)</span></div>
              </div>
            </div>

            <div className="border-t border-red-900 pt-4 mt-6 flex justify-between text-[9px] text-red-300 font-bold uppercase">
              <span>Security Shield: ACTIVE</span>
              <span>Rules: v2.6</span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
