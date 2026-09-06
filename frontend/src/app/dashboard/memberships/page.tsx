'use client';

import React, { useState, useEffect } from 'react';
import { Snowflake, RefreshCw, Send, ShieldAlert, Plus, CheckCircle, Star, Zap, Crown, Shield, Search } from 'lucide-react';
import { useGymStore } from '@/store';
import { formatDate, daysUntilExpiry } from '@/lib/utils';
import toast from '@/lib/toast';

const IconMap: Record<string, any> = {
  Shield,
  Zap,
  Star,
  Crown
};

// Official 14 Client Master Packages strictly adhering to Warrior Gym OS (#EA580C) theme
const defaultPlansData = [
  {
    id: 'pkg_15d',
    name: '15 days',
    price: 2000,
    duration: '15 days',
    durationDays: 15,
    rewardPoints: 0,
    status: 'Active',
    icon: 'Shield',
    accent: '#EA580C',
    badge: null,
    features: ['15-Day Full Gym Access', 'Biometric Roster Access', 'Locker Room Facilities'],
  },
  {
    id: 'pkg_1d',
    name: '1 day',
    price: 500,
    duration: '1 day',
    durationDays: 1,
    rewardPoints: 0,
    status: 'Active',
    icon: 'Shield',
    accent: '#EA580C',
    badge: null,
    features: ['Single Day Pass Access', 'Facility Check-in', 'Locker Room Access'],
  },
  {
    id: 'pkg_1m_pt',
    name: '1 month pt',
    price: 12000,
    duration: '30 days',
    durationDays: 30,
    rewardPoints: 0,
    status: 'Active',
    type: 'PT',
    icon: 'Crown',
    accent: '#EA580C',
    badge: 'Personal Training',
    features: ['1-on-1 Personal Coach', 'Custom Diet & Workout Plan', 'Priority Locker'],
  },
  {
    id: 'pkg_10d',
    name: '10 days',
    price: 2000,
    duration: '10 days',
    durationDays: 10,
    rewardPoints: 0,
    status: 'Active',
    icon: 'Shield',
    accent: '#EA580C',
    badge: null,
    features: ['10-Day Short Term Pass', 'Biometric Access', 'Standard Floor Access'],
  },
  {
    id: 'pkg_3m_std',
    name: '3 months',
    price: 7000,
    duration: '90 days',
    durationDays: 90,
    rewardPoints: 0,
    status: 'Active',
    icon: 'Zap',
    accent: '#EA580C',
    badge: 'Popular',
    features: ['90-Day Full Gym Access', 'Steam Bath Access', 'Fitness Evaluation'],
  },
  {
    id: 'pkg_6_plus_2m',
    name: '6+2 months',
    price: 10000,
    duration: '240 days',
    durationDays: 240,
    rewardPoints: 0,
    status: 'Active',
    icon: 'Star',
    accent: '#EA580C',
    badge: 'Special Offer',
    features: ['6 Months + 2 Bonus Months', 'Total 8 Months Access', 'Free Diet Consultation'],
  },
  {
    id: 'pkg_6_plus_1m',
    name: '6+1 months',
    price: 9000,
    duration: '210 days',
    durationDays: 210,
    rewardPoints: 0,
    status: 'Active',
    icon: 'Star',
    accent: '#EA580C',
    badge: null,
    features: ['6 Months + 1 Bonus Month', 'Total 7 Months Access', 'Complete Facility Access'],
  },
  {
    id: 'pkg_3_plus_1m',
    name: '3+1 months',
    price: 7500,
    duration: '120 days',
    durationDays: 120,
    rewardPoints: 0,
    status: 'Active',
    icon: 'Zap',
    accent: '#EA580C',
    badge: 'Value Pack',
    features: ['3 Months + 1 Bonus Month', 'Total 4 Months Access', 'Full Gym Equipment Access'],
  },
  {
    id: 'pkg_3_plus_2m',
    name: '3+2 months',
    price: 8000,
    duration: '150 days',
    durationDays: 150,
    rewardPoints: 0,
    status: 'Active',
    icon: 'Zap',
    accent: '#EA580C',
    badge: 'Popular Deal',
    features: ['3 Months + 2 Bonus Months', 'Total 5 Months Access', 'Locker & Biometric Roster'],
  },
  {
    id: 'pkg_1m_std',
    name: '1 month',
    price: 3000,
    duration: '30 days',
    durationDays: 30,
    rewardPoints: 0,
    status: 'Active',
    icon: 'Shield',
    accent: '#EA580C',
    badge: null,
    features: ['Monthly Gym Membership', 'Biometric Check-in Roster', 'Cardio & Strength Area'],
  },
  {
    id: 'pkg_2m',
    name: '2 months',
    price: 4500,
    duration: '60 days',
    durationDays: 60,
    rewardPoints: 0,
    status: 'Active',
    icon: 'Shield',
    accent: '#EA580C',
    badge: null,
    features: ['60 Days Gym Access', 'General Trainer Guidance', 'Locker Room Access'],
  },
  {
    id: 'pkg_12m',
    name: '12 months',
    price: 15000,
    duration: '365 days',
    durationDays: 365,
    rewardPoints: 0,
    status: 'Active',
    icon: 'Crown',
    accent: '#EA580C',
    badge: 'Elite',
    features: ['Full Year Unlimited Access', 'Free Guest Passes (5/month)', 'Personal Locker & Steam Bath'],
  },
  {
    id: 'pkg_6m',
    name: '6 months',
    price: 9000,
    duration: '180 days',
    durationDays: 180,
    rewardPoints: 0,
    status: 'Active',
    icon: 'Star',
    accent: '#10b981',
    badge: 'Best Value',
    features: ['180 Days Gym Membership', 'Body Fat Analysis & Diet Plan', 'Steam Bath Access'],
  },
  {
    id: 'pkg_3m_inactive',
    name: '3 months',
    price: 6500,
    duration: '90 days',
    durationDays: 90,
    rewardPoints: 0,
    status: 'Inactive',
    icon: 'Zap',
    accent: '#64748b',
    badge: 'Inactive',
    features: ['Legacy Tier (₹6,500)', 'Inactive Membership Package'],
  },
];

export default function MembershipsPage() {
  const { 
    members, fetchMembers, addPayment, toggleFreeze,
    plans, fetchPlans, addPlan, updatePlan, deletePlan
  } = useGymStore();

  const [expiringMembers, setExpiringMembers] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Form states
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState(2500);
  const [planDuration, setPlanDuration] = useState('30 Days');
  const [planDurationDays, setPlanDurationDays] = useState(30);
  const [planBadge, setPlanBadge] = useState('');
  const [planStatus, setPlanStatus] = useState('Active');
  const [planAccent, setPlanAccent] = useState('#EA580C');
  const [planIcon, setPlanIcon] = useState('Shield');
  const [planFeatures, setPlanFeatures] = useState<string[]>(['']);

  useEffect(() => {
    fetchMembers();
    fetchPlans();
  }, [fetchMembers, fetchPlans]);

  useEffect(() => {
    setExpiringMembers(members.filter(m => daysUntilExpiry(m.expiryDate) <= 15));
  }, [members]);

  const rawActivePlans = plans && plans.length > 0 ? plans : defaultPlansData;

  // Deduplicate plans strictly by normalized name, price, and durationDays
  const uniquePlansMap = new Map();
  rawActivePlans.forEach(p => {
    const key = `${(p.name || '').trim().toLowerCase()}_${p.price}_${p.durationDays}`;
    if (!uniquePlansMap.has(key)) {
      uniquePlansMap.set(key, p);
    }
  });
  const activePlans = Array.from(uniquePlansMap.values());

  const filteredPlans = activePlans.filter(p => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.duration?.toLowerCase().includes(q) ||
      p.price?.toString().includes(q) ||
      (p.badge && p.badge.toLowerCase().includes(q)) ||
      (p.status && p.status.toLowerCase().includes(q))
    );
  });

  const handleRenew = async (member: any) => {
    const matchedPlan = activePlans.find(p => p.name === member.plan || p.id === member.plan);
    const amount = matchedPlan ? matchedPlan.price : 2500;
    try {
      await addPayment({ memberId: member.id, amount, plan: member.plan, method: 'UPI' });
      toast.success(`Contract renewed for ${member.name}!`);
      fetchMembers();
    } catch { toast.error('Failed to renew'); }
  };

  const handleToggleFreeze = async (member: any) => {
    try {
      await toggleFreeze(member.id);
      toast.success(`Status updated for ${member.name}`);
      fetchMembers();
    } catch { toast.error('Failed to update status'); }
  };

  const openCreateModal = () => {
    setEditingPlan(null);
    setPlanName('');
    setPlanPrice(2500);
    setPlanDuration('30 Days');
    setPlanDurationDays(30);
    setPlanBadge('');
    setPlanStatus('Active');
    setPlanAccent('#EA580C');
    setPlanIcon('Shield');
    setPlanFeatures(['']);
    setShowModal(true);
  };

  const openEditModal = (plan: any) => {
    setEditingPlan(plan);
    setPlanName(plan.name || '');
    setPlanPrice(plan.price || 0);
    setPlanDuration(plan.duration || '');
    setPlanDurationDays(plan.durationDays || 30);
    setPlanBadge(plan.badge || '');
    setPlanStatus(plan.status || 'Active');
    setPlanAccent(plan.accent || '#EA580C');
    setPlanIcon(plan.icon || 'Shield');
    setPlanFeatures(plan.features || ['']);
    setShowModal(true);
  };

  const handleFeatureChange = (index: number, value: string) => {
    const updated = [...planFeatures];
    updated[index] = value;
    setPlanFeatures(updated);
  };

  const addFeatureRow = () => setPlanFeatures([...planFeatures, '']);
  const removeFeatureRow = (index: number) => setPlanFeatures(planFeatures.filter((_, i) => i !== index));

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName || !planPrice || !planDurationDays) {
      toast.error('Name, Price, and Duration in Days are required.');
      return;
    }

    const accentBg = (planIcon === 'Crown' || (planBadge && planBadge.toLowerCase().includes('elite')))
      ? 'linear-gradient(135deg, #EFF6FF 0%, #FFFFFF 100%)'
      : '#ffffff'; 
    const border = (planIcon === 'Crown' || (planBadge && planBadge.toLowerCase().includes('elite')))
      ? '1px solid rgba(191, 217, 245, 0.9)'
      : '1px solid rgba(226, 232, 240, 0.9)';

    const planPayload = {
      name: planName,
      price: Number(planPrice),
      duration: planDuration || `${planDurationDays} Days`,
      durationDays: Number(planDurationDays),
      rewardPoints: 0,
      status: planStatus,
      features: planFeatures.filter(f => f.trim() !== ''),
      badge: planBadge || (planStatus === 'Inactive' ? 'Inactive' : null),
      accent: planAccent || '#EA580C',
      accentBg,
      border,
      icon: planIcon
    };

    try {
      if (editingPlan) {
        await updatePlan(editingPlan.id, planPayload);
        toast.success(`Plan '${planName}' updated!`);
      } else {
        await addPlan({
          id: 'p_' + Date.now(),
          ...planPayload
        });
        toast.success(`Plan '${planName}' created successfully!`);
      }
      setShowModal(false);
      fetchPlans();
    } catch (err) {
      toast.error('Failed to save plan');
    }
  };

  const handleDeletePlan = async (id: string) => {
    if (confirm('Are you sure you want to delete this membership plan? This action cannot be undone.')) {
      try {
        await deletePlan(id);
        toast.success('Plan deleted successfully');
        setShowModal(false);
        fetchPlans();
      } catch (err) {
        toast.error('Failed to delete plan');
      }
    }
  };

  return (
    <div className="space-y-5 pb-10 max-w-7xl mx-auto px-1 sm:px-2">

      {/* ─── PAGE HEADER & ACTIONS ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight font-display">
            Membership Plans
          </h1>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">
            Manage official 14 subscription packages, contract renewals, and freezes.
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="h-11 px-5 bg-[#EA580C] hover:bg-orange-700 text-white font-bold text-xs rounded-xl shadow-md shadow-orange-500/20 transition-all cursor-pointer flex items-center justify-center gap-2 border-none shrink-0"
        >
          <Plus size={16} /> Create Package
        </button>
      </div>

      {/* ─── GLOBAL SEARCH BAR ─── */}
      <div className="relative max-w-[720px] w-full">
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search by package name, duration, price, or status..."
          className="w-full h-11 pl-10 pr-4 bg-white border border-slate-200 focus:border-[#EA580C] focus:ring-2 focus:ring-orange-500/20 rounded-xl text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none transition-all shadow-2xs"
        />
      </div>

      {/* ─── COMPACT PLAN GRID (Responsive 4 -> 3 -> 2 -> 1) ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4.5 lg:gap-5">
        {filteredPlans.map(plan => {
          const Icon = IconMap[plan.icon] || Shield;
          const isElite = plan.icon === 'Crown' || plan.id === 'pkg_12m' || (plan.badge && plan.badge.toLowerCase().includes('elite'));
          const isInactive = plan.status === 'Inactive';

          // Badge theme logic: No purple/yellow/orange
          let badgeBg = 'bg-[#FFF7ED] text-[#EA580C] border-orange-200/60';
          let badgeText = plan.badge || (isInactive ? 'Inactive' : null);

          if (isInactive) {
            badgeBg = 'bg-slate-100 text-slate-500 border-slate-200';
          } else if (plan.badge) {
            const bLower = plan.badge.toLowerCase();
            if (bLower.includes('elite') || bLower.includes('crown')) {
              badgeBg = 'bg-[#EA580C] text-white border-transparent shadow-xs shadow-orange-500/20';
            } else if (bLower.includes('best value')) {
              badgeBg = 'bg-emerald-50 text-emerald-700 border-emerald-200/80';
            } else if (bLower.includes('personal training') || bLower.includes('pt')) {
              badgeBg = 'bg-indigo-50 text-indigo-700 border-indigo-200/80';
            }
          }

          return (
            <div
              key={plan.id || plan.name}
              className={`relative rounded-2xl p-4.5 sm:p-5 flex flex-col justify-between transition-all duration-200 hover:-translate-y-0.5 min-h-[310px] ${
                isInactive
                  ? 'bg-slate-50/70 border border-slate-200/80 opacity-80'
                  : isElite
                  ? 'bg-gradient-to-br from-blue-50/90 via-white to-blue-50/50 border border-orange-200/60 shadow-sm shadow-orange-500/20 hover:border-[#EA580C]'
                  : 'bg-white border border-slate-200/90 shadow-xs hover:shadow-md hover:shadow-orange-500/20 hover:border-[#EA580C]'
              }`}
            >
              {/* Top Row: Icon + Badge */}
              <div className="flex items-start justify-between gap-2 mb-3">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                  isInactive ? 'bg-slate-200 text-slate-500 border border-slate-300' : 'bg-[#FFF7ED] border border-[#FED7AA] text-[#EA580C]'
                }`}>
                  <Icon size={20} className={isInactive ? 'text-slate-500' : 'text-[#EA580C]'} />
                </div>
                {badgeText && (
                  <span className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${badgeBg}`}>
                    {badgeText}
                  </span>
                )}
              </div>

              {/* Package Meta: Duration & Title */}
              <div className="text-left mb-3">
                <div className={`text-[10px] font-black uppercase tracking-widest mb-0.5 ${
                  isInactive ? 'text-slate-400' : 'text-[#EA580C]'
                }`}>
                  {plan.duration || `${plan.durationDays} Days`}
                </div>
                <h3 className="text-[18px] font-extrabold text-slate-900 leading-tight">
                  {plan.name}
                </h3>
              </div>

              {/* Price Display */}
              <div className="flex items-baseline gap-1.5 mb-3">
                <span className="text-[30px] sm:text-[32px] font-black text-slate-900 leading-none tracking-tight">
                  ₹{plan.price.toLocaleString('en-IN')}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">
                  GST incl.
                </span>
              </div>

              {/* Compact Features List */}
              {plan.features && plan.features.length > 0 && (
                <ul className="space-y-1.5 my-2 text-left flex-1">
                  {plan.features.slice(0, 3).map((feat: string, idx: number) => (
                    <li key={idx} className="flex items-center gap-2 text-[11px] text-slate-600 font-medium leading-tight">
                      <CheckCircle size={13} className={isInactive ? 'text-slate-400 shrink-0' : 'text-[#EA580C] shrink-0'} />
                      <span className="truncate">{feat}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* CTA Action Button */}
              <button
                onClick={() => openEditModal(plan)}
                className={`w-full h-11 mt-3 text-white font-bold text-xs rounded-xl shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 border-none ${
                  isInactive 
                    ? 'bg-slate-500 hover:bg-slate-600' 
                    : 'bg-[#EA580C] hover:bg-orange-700 active:bg-blue-800'
                }`}
              >
                {isInactive ? 'Edit Inactive Plan' : isElite ? 'Configure Elite Plan' : 'Configure Plan'}
              </button>
            </div>
          );
        })}
      </div>

      {filteredPlans.length === 0 && (
        <div className="text-center py-12 bg-white rounded-2xl border border-slate-200">
          <p className="text-sm font-bold text-slate-700">No membership plans match your search.</p>
          <p className="text-xs text-slate-400 mt-1">Try clearing the search bar filter.</p>
        </div>
      )}

      {/* ─── MEMBERSHIP EXPIRY ALERTS TABLE ─── */}
      <div className="rounded-2xl overflow-hidden bg-white border border-slate-200/90 shadow-xs mt-6">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center">
              <ShieldAlert size={15} className="text-red-500" />
            </div>
            <div>
              <h3 className="font-extrabold text-xs text-slate-900 uppercase tracking-wide">
                Membership Expiry Alerts
              </h3>
              <p className="text-[10px] text-slate-400 font-medium">
                Members expiring within 15 days
              </p>
            </div>
          </div>
          <span className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full bg-red-50 text-red-600 border border-red-100">
            {expiringMembers.length} At Risk
          </span>
        </div>

        <div className="overflow-x-auto">
          {expiringMembers.length > 0 ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-extrabold text-slate-400 uppercase tracking-wider bg-slate-50/30">
                  <th className="py-3 px-5">Member Name</th>
                  <th className="py-3 px-5">Contract Plan</th>
                  <th className="py-3 px-5">Expiry Date</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
                {expiringMembers.map(m => {
                  const days = daysUntilExpiry(m.expiryDate);
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-5 font-bold text-slate-900">{m.name}</td>
                      <td className="py-3 px-5 text-slate-500">{m.plan}</td>
                      <td className="py-3 px-5 text-slate-400 font-mono text-[11px]">{formatDate(m.expiryDate)}</td>
                      <td className="py-3 px-5">
                        <span
                          className={`text-[9px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                            days > 0
                              ? 'bg-amber-50 text-amber-700 border-amber-200/80'
                              : 'bg-red-50 text-red-700 border-red-200/80'
                          }`}
                        >
                          {days > 0 ? `${days}d left` : `${Math.abs(days)}d expired`}
                        </span>
                      </td>
                      <td className="py-3 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleRenew(m)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all"
                          >
                            <RefreshCw size={10} /> Quick Renew
                          </button>
                          <button
                            onClick={() => handleToggleFreeze(m)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold cursor-pointer border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-all"
                          >
                            <Snowflake size={10} /> {m.status === 'frozen' ? 'Unfreeze' : 'Freeze'}
                          </button>
                          <button
                            onClick={() => toast.success(`WhatsApp alert sent to ${m.name}`)}
                            className="p-1.5 rounded-lg text-[10px] font-bold cursor-pointer border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-all"
                            title="Send WhatsApp"
                          >
                            <Send size={11} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center mx-auto mb-2 text-emerald-600">
                <CheckCircle size={20} />
              </div>
              <p className="text-xs font-bold text-slate-800">All memberships are active and healthy!</p>
              <p className="text-[11px] text-slate-400 mt-0.5">No members expiring within the next 15 days.</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── CREATE / EDIT PLAN MODAL ─── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-xs" onClick={() => setShowModal(false)} />
          <div className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl z-10 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#C2410C] text-white">
              <div className="text-left">
                <h3 className="font-extrabold text-sm uppercase tracking-wide flex items-center gap-2">
                  <Shield size={18} /> {editingPlan ? 'Edit Membership Plan' : 'Create New Package'}
                </h3>
                <p className="text-[10px] text-orange-100 mt-0.5 font-medium">
                  Configure subscription details, pricing, and features
                </p>
              </div>
              <button 
                onClick={() => setShowModal(false)} 
                className="text-white/80 hover:text-white font-bold border-none bg-transparent cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSavePlan} className="p-6 space-y-4 overflow-y-auto flex-1 text-left">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Plan Name *</label>
                  <input
                    type="text"
                    required
                    value={planName}
                    onChange={e => setPlanName(e.target.value)}
                    placeholder="e.g. Monthly Standard"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-[#EA580C] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Price (INR) *</label>
                  <input
                    type="number"
                    required
                    value={planPrice}
                    onChange={e => setPlanPrice(Number(e.target.value))}
                    placeholder="2500"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-[#EA580C] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Duration (Days) *</label>
                  <input
                    type="number"
                    required
                    value={planDurationDays}
                    onChange={e => {
                      const d = Number(e.target.value);
                      setPlanDurationDays(d);
                      setPlanDuration(`${d} Days`);
                    }}
                    placeholder="30"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-[#EA580C] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Status</label>
                  <select
                    value={planStatus}
                    onChange={e => setPlanStatus(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-[#EA580C] transition-all cursor-pointer"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Badge (Optional)</label>
                  <input
                    type="text"
                    value={planBadge}
                    onChange={e => setPlanBadge(e.target.value)}
                    placeholder="e.g. Popular or Elite"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-[#EA580C] transition-all"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider mb-1">Icon Symbol</label>
                  <select
                    value={planIcon}
                    onChange={e => setPlanIcon(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-[#EA580C] transition-all cursor-pointer"
                  >
                    <option value="Shield">🛡️ Shield</option>
                    <option value="Zap">⚡ Zap</option>
                    <option value="Star">⭐ Star</option>
                    <option value="Crown">👑 Crown</option>
                  </select>
                </div>
              </div>

              {/* Feature bullet rows */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="block text-[10px] font-black text-slate-600 uppercase tracking-wider">Plan Highlights & Features</label>
                  <button
                    type="button"
                    onClick={addFeatureRow}
                    className="text-[10px] font-bold uppercase text-[#EA580C] hover:underline border-none bg-transparent cursor-pointer"
                  >
                    + Add Feature
                  </button>
                </div>
                <div className="space-y-2">
                  {planFeatures.map((feat, idx) => (
                    <div key={idx} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={feat}
                        onChange={e => handleFeatureChange(idx, e.target.value)}
                        placeholder="e.g. Locker Room access"
                        className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:border-[#EA580C] transition-all"
                      />
                      {planFeatures.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeFeatureRow(idx)}
                          className="p-2 text-red-500 hover:bg-red-50 rounded-xl border-none bg-transparent cursor-pointer font-bold text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-2">
                {editingPlan ? (
                  <button
                    type="button"
                    onClick={() => handleDeletePlan(editingPlan.id)}
                    className="px-4 py-2.5 border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold rounded-xl transition-all cursor-pointer bg-white"
                  >
                    Delete Plan
                  </button>
                ) : (
                  <div />
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2.5 border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-bold rounded-xl transition-all cursor-pointer bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-[#EA580C] hover:bg-orange-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer border-none shadow-sm"
                  >
                    {editingPlan ? 'Save Changes' : 'Create Package'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
