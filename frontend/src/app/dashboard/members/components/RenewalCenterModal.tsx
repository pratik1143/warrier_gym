'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Phone, MessageSquare, Mail, RefreshCw, Ban, User, AlertCircle } from 'lucide-react';
import { formatDaysLeft, getInitials, formatCurrency } from '@/lib/utils';
import { membershipEngine } from '@/lib/engines/membershipEngine';
import { useGymStore } from '@/store';
import toast from '@/lib/toast';
import MemberAvatar from '../../components/MemberAvatar';

interface RenewalCenterProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenRenewWizard: (member: any) => void;
}

export default function RenewalCenterModal({ isOpen, onClose, onOpenRenewWizard }: RenewalCenterProps) {
  const { members, updateMember, fetchMembers } = useGymStore();
  const [searchQuery, setSearchQuery] = useState('');

  // Filter for expired members
  const expiredMembers = members.filter(m => {
    if (m.status === 'blocked' || m.status === 'blacklisted') return false;
    const days = membershipEngine.calculateDaysLeft(m.expiryDate);
    return days < 0;
  });

  const filteredExpired = expiredMembers.filter(m => 
    m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    m.phone.includes(searchQuery) ||
    (m.memberId || m.id).toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleBlockAccess = async (m: any) => {
    if (confirm(`Are you sure you want to BLOCK facility access for ${m.name}? This will update their status to Blocked.`)) {
      try {
        await updateMember(m.id, { 
          status: 'blocked',
          timeline: [...(m.timeline || []), { type: 'Blocked', date: new Date().toISOString().split('T')[0], details: 'Access blocked due to non-renewal' }]
        });
        toast.success(`${m.name}'s access is now BLOCKED!`);
        fetchMembers();
      } catch (err) {
        toast.error('Failed to block access');
      }
    }
  };

  const handleWhatsApp = (m: any) => {
    const text = encodeURIComponent(`Hello ${m.name} 👋,\n\nYour membership for ${m.plan || 'Gym Access'} at The Warrior Gym has expired. Please renew your plan soon to continue facility access.\n\nThank you for choosing The Warrior Gym 💪`);
    window.open(`https://wa.me/91${m.phone}?text=${text}`, '_blank');
  };

  const handleEmail = (m: any) => {
    const subject = encodeURIComponent('Membership Expiry Notice - The Warrior Gym');
    const body = encodeURIComponent(`Hello ${m.name},\n\nWe would like to remind you that your The Warrior Gym membership expired on ${new Date(m.expiryDate).toLocaleDateString('en-GB')}.\n\nPlease renew your plan at the front desk or via the member portal.\n\nRegards,\nThe Warrior Gym Management`);
    window.open(`mailto:${m.email}?subject=${subject}&body=${body}`);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/50 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal Wrapper */}
        <motion.div 
          initial={{ scale: 0.95, y: 20, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 20, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="relative w-full max-w-5xl bg-white/70 backdrop-blur-3xl border border-white/80 rounded-[32px] shadow-[0_30px_70px_rgba(0,0,0,0.12)] z-10 overflow-hidden flex flex-col max-h-[85vh] text-slate-800"
        >
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white/40">
            <div>
              <div className="flex items-center gap-2">
                <span className="p-2 bg-red-50 text-red-500 rounded-xl">
                  <AlertCircle size={20} />
                </span>
                <div>
                  <h2 className="text-xl font-black tracking-tight text-slate-900 font-display">Membership Renewal Center</h2>
                  <p className="text-xs text-slate-500">Review outstanding expirations and handle renew operations.</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search expired members..." 
                  className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 transition-colors w-[220px]"
                />
              </div>

              <button 
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-full bg-white/80 hover:bg-slate-100 text-slate-500 transition-all border border-slate-200"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* List Area */}
          <div className="flex-1 overflow-y-auto p-6">
            {filteredExpired.length === 0 ? (
              <div className="py-16 text-center space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-350 mx-auto">
                  <User size={32} />
                </div>
                <h3 className="font-bold text-slate-800 text-sm">No Expired Members Found</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">Either all members have healthy contracts, or your search query did not return any matches.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50/50 text-slate-500 font-bold border-b border-slate-100">
                    <tr>
                      <th className="px-4 py-3">Member Details</th>
                      <th className="px-4 py-3">Membership Plan</th>
                      <th className="px-4 py-3">Assigned Trainer</th>
                      <th className="px-4 py-3 text-center">Days Since Expiry</th>
                      <th className="px-4 py-3 text-right">Outstanding Bal</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100/50">
                    {filteredExpired.map(m => {
                      const days = membershipEngine.calculateDaysLeft(m.expiryDate);
                      const absDays = Math.abs(days);
                      
                      return (
                        <tr key={m.id} className="hover:bg-white/40 transition-colors">
                          <td className="px-4 py-4">
                            <div className="flex items-center gap-3">
                              <MemberAvatar member={m} className="w-9 h-9 rounded-full object-cover border border-slate-100" size={36} />
                              <div>
                                <div className="font-bold text-slate-900">{m.name}</div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">{m.phone}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 text-[9px] font-bold rounded uppercase">
                              {m.plan || 'Standard'}
                            </span>
                            <div className="text-[10px] text-slate-400 mt-1">Exp: {new Date(m.expiryDate).toLocaleDateString('en-GB')}</div>
                          </td>
                          <td className="px-4 py-4 font-semibold text-slate-700">
                            {m.trainer ? (
                              <div className="flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                {m.trainer}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Unassigned</span>
                            )}
                          </td>
                          <td className="px-4 py-4 text-center">
                            <div className="font-extrabold text-red-500">{absDays} Days</div>
                            <div className="text-[9px] text-slate-400 font-semibold mt-0.5">{formatDaysLeft(m.expiryDate)}</div>
                          </td>
                          <td className="px-4 py-4 text-right font-bold text-slate-900">
                            {formatCurrency(m.outstandingBalance || 0)}
                          </td>
                          <td className="px-4 py-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Contact Row */}
                              <button 
                                onClick={() => window.open(`tel:${m.phone}`)}
                                className="p-1.5 bg-slate-50 hover:bg-slate-100 rounded-lg text-slate-600 border border-slate-200 transition-colors"
                                title="Call Member"
                              >
                                <Phone size={12} />
                              </button>
                              <button 
                                onClick={() => handleWhatsApp(m)}
                                className="p-1.5 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-emerald-600 border border-emerald-100 transition-colors"
                                title="WhatsApp Notice"
                              >
                                <MessageSquare size={12} />
                              </button>
                              <button 
                                onClick={() => handleEmail(m)}
                                className="p-1.5 bg-[#FFF7ED] hover:bg-orange-100 rounded-lg text-[#EA580C] border border-[#FED7AA] transition-colors"
                                title="Email Invoice"
                              >
                                <Mail size={12} />
                              </button>

                              <div className="w-px h-6 bg-slate-200 mx-1" />

                              {/* Operations */}
                              <button 
                                onClick={() => handleBlockAccess(m)}
                                className="px-2.5 py-1.5 bg-slate-900 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-black transition-colors flex items-center gap-1 shadow-sm"
                                title="Block Access"
                              >
                                <Ban size={10} /> Block
                              </button>
                              
                              <button 
                                onClick={() => onOpenRenewWizard(m)}
                                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-indigo-700 transition-colors flex items-center gap-1 shadow-sm"
                              >
                                <RefreshCw size={10} /> Renew
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer stats */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-between items-center text-[10px] text-slate-500 font-bold">
            <div>Showing {filteredExpired.length} of {expiredMembers.length} expired memberships</div>
            <div>The Warrior Gym CRM Portal v1.2</div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
