'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Phone, MessageSquare, Plus, CheckCircle, RefreshCw, X, CreditCard } from 'lucide-react';
import { useGymStore } from '@/store';
import { formatDate, getInitials } from '@/lib/utils';
import toast from '@/lib/toast';

export default function NewFollowUpPage() {
  const { members, fetchMembers, addPayment, updateMember } = useGymStore();
  const [search, setSearch] = useState('');
  
  // Upgrade Modal states
  const [selectedMember, setSelectedMember] = useState<any | null>(null);
  const [selectedPlan, setSelectedPlan] = useState('Monthly');
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Compute days since registration (joinDate)
  const getDaysSinceRegistration = (joinDateString: string): number => {
    if (!joinDateString) return 0;
    const join = new Date(joinDateString);
    const today = new Date();
    const diffTime = today.getTime() - join.getTime();
    return Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
  };

  // Filter: registered >= 2 days ago AND plan is 'Trial', 'None', or status is 'inactive' / 'pending'
  const newFollowUps = members.filter(m => {
    const daysSinceReg = getDaysSinceRegistration(m.joinDate);
    const isNewTrial = daysSinceReg >= 2;
    const hasNoPaidPlan = !m.plan || 
                           m.plan.toLowerCase() === 'trial' || 
                           m.plan.toLowerCase() === 'none' || 
                           m.status === 'inactive' || 
                           m.status === 'pending';

    if (!isNewTrial || !hasNoPaidPlan) return false;

    return m.name?.toLowerCase().includes(search.toLowerCase()) || 
           m.phone?.includes(search) || 
           m.memberId?.toLowerCase().includes(search.toLowerCase());
  });

  const handleUpgradeMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setIsUpgrading(true);

    const planPrices: Record<string, number> = {
      'Monthly': 2500, 'Quarterly': 6500, 'Semi-Annual': 11500, 'Annual Premium': 18000
    };
    const daysMap: Record<string, number> = {
      'Monthly': 30, 'Quarterly': 90, 'Semi-Annual': 180, 'Annual Premium': 365
    };

    const amt = planPrices[selectedPlan] || 2500;
    const expiry = new Date(Date.now() + (daysMap[selectedPlan] || 30) * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    try {
      // Step 1: Update member status and plan details
      await updateMember(selectedMember.id, {
        plan: selectedPlan,
        status: 'active',
        expiryDate: expiry
      });

      // Step 2: Add payment transaction/invoice
      await addPayment({
        memberId: selectedMember.id,
        amount: amt,
        plan: selectedPlan,
        method: 'UPI',
        status: 'paid'
      });

      toast.success(`Membership package activated for ${selectedMember.name}!`);
      setSelectedMember(null);
      fetchMembers();
    } catch (err) {
      toast.error('Failed to activate package');
    } finally {
      setIsUpgrading(false);
    }
  };

  const getWhatsAppLink = (m: any) => {
    const days = getDaysSinceRegistration(m.joinDate);
    const message = `Hi ${m.name}, welcome to The Warrior Gym! We noticed you signed up ${days} days ago but haven't started your membership plan yet. Would you like to select a package and activate your biometric gate access today? Let us know if you need help. Thank you!`;
    return `https://wa.me/91${m.phone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="border-b border-brand-border/60 pb-5">
        <h1 className="text-3xl font-black text-brand-text-primary tracking-tight font-display">New Registration Follow-ups</h1>
        <p className="text-xs text-brand-text-secondary mt-0.5">
          Follow up with newly registered accounts who have signed up but have not purchased a membership package for 2+ days.
        </p>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-text-muted" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone, or member ID..."
          className="glass-input pl-9 py-2.5 text-xs"
        />
      </div>

      {/* Table Container */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="cyber-table">
            <thead>
              <tr>
                <th>Member Info</th>
                <th>Registration Date</th>
                <th>Days Since Registration</th>
                <th>Active Plan</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {newFollowUps.map((m, i) => {
                const days = getDaysSinceRegistration(m.joinDate);
                return (
                  <motion.tr 
                    key={m.id}
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-xs font-bold text-brand-cyan">
                          {getInitials(m.name)}
                        </div>
                        <div>
                          <div className="font-bold text-xs text-brand-text-primary">{m.name}</div>
                          <div className="text-[10px] text-brand-text-secondary">{m.phone}</div>
                        </div>
                      </div>
                    </td>
                    <td className="text-xs">{formatDate(m.joinDate)}</td>
                    <td>
                      <span className="font-mono font-bold text-xs text-brand-cyan">
                        {days} days ago
                      </span>
                    </td>
                    <td className="text-xs font-semibold text-slate-400">
                      {m.plan || 'Trial (Free)'}
                    </td>
                    <td>
                      <span className="badge-gray" style={{ fontSize: '0.65rem' }}>
                        <span className="w-1.5 h-1.5 rounded-full inline-block mr-1 bg-slate-400" />
                        Pending Package
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center justify-end gap-2">
                        <a 
                          href={`tel:${m.phone}`}
                          className="px-2.5 py-1.5 rounded-lg border border-brand-border bg-slate-50 text-brand-text-secondary hover:bg-slate-100 hover:text-black transition-all text-xxs font-bold"
                        >
                          <Phone size={11} className="inline mr-1" /> Call
                        </a>
                        <a 
                          href={getWhatsAppLink(m)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1.5 rounded-lg border border-brand-border bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-all text-xxs font-bold"
                        >
                          <MessageSquare size={11} className="inline mr-1" /> WhatsApp
                        </a>
                        <button
                          onClick={() => setSelectedMember(m)}
                          className="px-3 py-1.5 rounded-lg bg-brand-cyan hover:bg-brand-cyan/90 text-white transition-all text-xxs font-bold flex items-center gap-1"
                        >
                          <Plus size={11} /> Upgrade Package
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                );
              })}

              {newFollowUps.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-brand-text-muted italic">
                    No new registrations require package follow-up.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Package Upgrade Modal popup */}
      <AnimatePresence>
        {selectedMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md p-6 rounded-3xl bg-brand-bg-card border border-brand-border shadow-2xl space-y-4 text-left"
            >
              <div className="flex items-center justify-between pb-2 border-b border-brand-border">
                <h3 className="text-sm font-black text-brand-text-primary uppercase tracking-wider font-display">Upgrade Membership</h3>
                <button 
                  onClick={() => setSelectedMember(null)}
                  className="text-brand-text-muted hover:text-brand-text-primary text-sm cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-brand-bg border border-brand-border flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-[#D4FF00]/10 text-black flex items-center justify-center font-black text-xs">
                  {getInitials(selectedMember.name)}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-brand-text-primary">{selectedMember.name}</h4>
                  <p className="text-[10px] text-brand-text-secondary">Phone: {selectedMember.phone}</p>
                </div>
              </div>

              <form onSubmit={handleUpgradeMember} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-brand-text-secondary uppercase tracking-wider mb-1">Select Membership Plan</label>
                  <select
                    value={selectedPlan}
                    onChange={e => setSelectedPlan(e.target.value)}
                    className="w-full text-xs bg-brand-bg-card border border-brand-border rounded-xl px-3 py-2.5 text-brand-text-primary focus:outline-none focus:border-brand-cyan"
                  >
                    <option value="Monthly">Monthly Plan (₹2,500)</option>
                    <option value="Quarterly">Quarterly Plan (₹6,500)</option>
                    <option value="Semi-Annual">Semi-Annual Plan (₹11,500)</option>
                    <option value="Annual Premium">Annual Premium Plan (₹18,000)</option>
                  </select>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMember(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[10px] font-black uppercase tracking-wider text-center text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUpgrading}
                    className="flex-1 py-2.5 rounded-xl bg-brand-cyan text-white text-[10px] font-black uppercase tracking-wider text-center transition-colors cursor-pointer disabled:opacity-40"
                  >
                    {isUpgrading ? 'Activating Plan...' : 'Activate & Pay'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
