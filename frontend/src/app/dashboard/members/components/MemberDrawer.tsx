'use client';

import React from 'react';
import { X, Phone, MessageSquare, MapPin, MoreHorizontal, Crown, CheckSquare, Flame, Clock, Dumbbell, Shield, Fingerprint, RotateCcw, Trash2, Wifi, Download, RefreshCw, Snowflake, Play, Pause, Edit, Activity } from 'lucide-react';
import { formatDate, getInitials } from '@/lib/utils';
import { membershipEngine } from '@/lib/engines/membershipEngine';
import { motion, AnimatePresence } from 'framer-motion';
import { useGymStore } from '@/store';
import toast from '@/lib/toast';
import MemberAvatar from '../../components/MemberAvatar';
import { resolveAvatarUrl, MALE_DEFAULT_AVATAR } from '@/lib/avatar';

interface MemberDrawerProps {
  member: any;
  onClose: () => void;
  onCall?: (m: any) => void;
  onMessage?: (m: any) => void;
  onCheckIn?: (m: any) => void;
  onViewProfile?: (m: any) => void;
  onEdit?: (m: any) => void;
  onRenew?: (m: any) => void;
  onDelete?: (m: any) => void;
}

import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';

export default function MemberDrawer({ member, onClose, onCall, onMessage, onCheckIn, onViewProfile, onEdit, onRenew, onDelete }: MemberDrawerProps) {
  const { toggleFreeze, resetPassword, sendCredentials, triggerGateUnlock, enrollFingerprint, deleteBiometric, syncMemberBiometric, deleteMember } = useGymStore();
  const daysLeft = member ? membershipEngine.calculateDaysLeft(member.expiryDate) : 0;
  const isExpiring = daysLeft <= 15 && daysLeft > 0;
  const isExpired = daysLeft <= 0;
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Real biometric profile (no dummy data)
  const biometricProfile = member?.biometricProfile || {
    fingerprintStatus: 'not_enrolled',
    biometricId: member?.biometricId || 'N/A',
    fingerprintCount: 0,
    enrollmentDate: null,
    deviceName: 'None',
    lastSync: null
  };

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {member && (
        <div className="fixed inset-0 z-[60]">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }} 
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm"
          />
          
          {/* Drawer Panel */}
          <motion.div 
            initial={{ x: 500 }} 
            animate={{ x: 0 }} 
            exit={{ x: 500 }} 
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="absolute right-0 top-0 bottom-0 bg-white h-full shadow-2xl flex flex-col z-[61] border-l border-slate-100 overflow-y-auto"
            style={{ width: '420px', maxWidth: '100vw' }}
          >
            {/* Header Profile Info */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/50 sticky top-0 z-10">
              <button onClick={onClose} className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200 transition-colors bg-slate-100">
                <X size={16} />
              </button>

              <div className="flex items-center gap-4">
                <div className="relative">
                  <MemberAvatar member={member} className="w-16 h-16 rounded-full object-cover border-2 border-white shadow-sm" size={64} />
                  <div className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${member.status === 'active' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 leading-tight">{member.name}</h2>
                  <p className="text-xs font-bold text-indigo-600 font-mono mt-0.5 tracking-wider flex items-center gap-1.5">
                    <span>Bio ID:</span>
                    <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded text-[11px] font-black">
                      #{member.biometricId || member.deviceUserId || member.clientId || member.customId || member.memberId || member.id}
                    </span>
                  </p>
                  <div className="flex items-center gap-2 mt-1.5">
                    <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-md uppercase tracking-wider flex items-center gap-1">
                      <Crown size={10} /> {member.plan || 'Premium Gold'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="grid grid-cols-4 gap-2 w-full mt-5">
                <button onClick={() => onCall?.(member)} className="flex flex-col items-center gap-1 group">
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-indigo-600 group-hover:bg-indigo-50 transition-colors">
                    <Phone size={14} />
                  </div>
                  <span className="text-[9px] font-bold text-slate-500">Call</span>
                </button>
                <button onClick={() => onMessage?.(member)} className="flex flex-col items-center gap-1 group">
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-green-600 group-hover:bg-green-50 transition-colors">
                    <MessageSquare size={14} />
                  </div>
                  <span className="text-[9px] font-bold text-slate-500">WhatsApp</span>
                </button>
                <button onClick={() => onCheckIn?.(member)} className="flex flex-col items-center gap-1 group">
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-orange-600 group-hover:bg-orange-50 transition-colors">
                    <MapPin size={14} />
                  </div>
                  <span className="text-[9px] font-bold text-slate-500">Check-In</span>
                </button>
                <button onClick={() => onEdit?.(member)} className="flex flex-col items-center gap-1 group">
                  <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center text-[#EA580C] group-hover:bg-orange-50 transition-colors">
                    <Edit size={14} />
                  </div>
                  <span className="text-[9px] font-bold text-slate-500">Edit</span>
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              
              {/* Contract Parameters */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 flex items-center gap-1.5">
                  <CheckSquare size={12} /> Contract Details
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="text-xs font-bold text-slate-800">{member.plan || 'Standard'}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">Membership Plan</div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className={`text-xs font-bold ${isExpired ? 'text-red-600' : isExpiring ? 'text-orange-600' : 'text-emerald-600'}`}>
                      {daysLeft > 0 ? `${daysLeft} Days Left` : 'Expired'}
                    </div>
                    <div className="text-[9px] text-slate-500 mt-0.5">Expires: {member.expiryDate ? formatDate(member.expiryDate) : 'N/A'}</div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="text-xs font-bold text-slate-800">{member.joinDate ? formatDate(member.joinDate) : 'N/A'}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">Joining Date</div>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="text-xs font-bold text-slate-800">{member.branch || 'Mohali'}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">Branch Location</div>
                  </div>
                </div>
              </div>

              {/* Membership History */}
              {member.membershipHistory && member.membershipHistory.length > 0 && (
                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 flex items-center gap-1.5">
                    <Crown size={12} /> Membership History ({member.membershipHistory.length})
                  </h4>
                  <div className="space-y-2 max-h-[180px] overflow-y-auto pr-1">
                    {member.membershipHistory.map((h: any, idx: number) => (
                      <div key={idx} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex justify-between items-center text-xs">
                        <div>
                          <div className="font-bold text-slate-800">{h.packageName}</div>
                          <div className="text-[10px] text-slate-500">{h.startDate} → {h.expiryDate || 'Active'}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-black text-indigo-600">₹{(h.amount || 0).toLocaleString('en-IN')}</div>
                          <div className="text-[9px] uppercase font-bold text-emerald-600">{h.invoiceNumber || 'Paid'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Physical Parameters */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 flex items-center gap-1.5">
                  <Flame size={12} /> Physical Parameters
                </h4>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="text-sm font-black text-slate-800">{member.weight ? `${member.weight}kg` : 'N/A'}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">Weight</div>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="text-sm font-black text-slate-800">{member.height ? `${member.height}cm` : 'N/A'}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">Height</div>
                  </div>
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                    <div className="text-sm font-black text-slate-800">{member.bmi || 'N/A'}</div>
                    <div className="text-[9px] text-slate-500 mt-0.5">BMI</div>
                  </div>
                </div>
              </div>

              {/* Assigned Trainer */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 flex items-center gap-1.5">
                  <Dumbbell size={12} /> Assigned Trainer
                </h4>
                {member.trainer ? (
                  <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden">
                        <img 
                          src={member.trainerAvatar || resolveAvatarUrl({ name: member.trainer, role: 'Trainer' })} 
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.src = MALE_DEFAULT_AVATAR;
                          }}
                          alt="trainer" 
                          className="w-full h-full object-cover" 
                        />
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900">{member.trainer}</div>
                        <div className="text-[10px] text-slate-500">Fitness Coach</div>
                      </div>
                    </div>
                    <button className="px-3 py-1.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-lg uppercase tracking-wider">
                      View
                    </button>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-center">
                    <div className="text-xs font-bold text-slate-500">No Personal Trainer Assigned</div>
                  </div>
                )}
              </div>

              {/* Activity & Engagement */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 flex items-center gap-1.5">
                  <Clock size={12} /> Activity Metrics
                </h4>
                <div className="grid grid-cols-2 gap-3 text-center">
                  <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-xl">
                    <div className="text-2xl font-black text-indigo-600">{member.attendanceCount || 0}</div>
                    <div className="text-[9px] text-indigo-400 font-bold uppercase mt-1">Total Check-Ins</div>
                  </div>
                  <div className="p-4 bg-orange-50/50 border border-orange-100 rounded-xl">
                    <div className="text-2xl font-black text-orange-500">{member.streak || 0} Days</div>
                    <div className="text-[9px] text-orange-400 font-bold uppercase mt-1">Active Streak 🔥</div>
                  </div>
                </div>
              </div>

              {/* Biometric Status Panel */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 flex items-center gap-1.5">
                  <Shield size={12} /> Biometric Setup
                </h4>
                <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4 space-y-4">
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`p-2.5 rounded-xl border ${biometricProfile.fingerprintStatus === 'enrolled' ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Cloud Access</div>
                      <div className={`text-xs font-black mt-0.5 ${biometricProfile.fingerprintStatus === 'enrolled' ? 'text-emerald-600' : 'text-slate-600'}`}>
                        {biometricProfile.fingerprintStatus === 'enrolled' ? 'Active' : 'Suspended'}
                      </div>
                    </div>
                    <div className={`p-2.5 rounded-xl border ${biometricProfile.fingerprintStatus === 'enrolled' ? 'bg-emerald-50 border-emerald-100' : 'bg-slate-50 border-slate-100'}`}>
                      <div className="text-[9px] text-slate-500 font-bold uppercase">Fingerprint</div>
                      <div className={`text-xs font-black mt-0.5 ${biometricProfile.fingerprintStatus === 'enrolled' ? 'text-emerald-600' : 'text-slate-600'}`}>
                        {biometricProfile.fingerprintStatus === 'enrolled' ? 'Enrolled' : 'Not Enrolled'}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-y-3 text-[10px]">
                    <div>
                      <span className="text-slate-400 block font-bold">Biometric ID</span>
                      <span className="font-bold text-slate-800">{biometricProfile.biometricId}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-bold">Fingerprints</span>
                      <span className="font-bold text-slate-800">{biometricProfile.fingerprintCount} Templates</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-bold">Device</span>
                      <span className="font-bold text-slate-800">{biometricProfile.deviceName}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-bold">Last Sync</span>
                      <span className="font-bold text-slate-800">
                        {biometricProfile.lastSync ? new Date(biometricProfile.lastSync).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Never'}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <button 
                      onClick={() => {
                        toast.loading('Starting fingerprint enrollment...', { id: 'enroll' });
                        enrollFingerprint(member.id)
                          .then(() => toast.success(`Enrollment triggered for ${member.name} on Hikvision DS-K1T320EFWX.`, { id: 'enroll' }))
                          .catch(() => toast.error('Failed to trigger enrollment.', { id: 'enroll' }));
                      }}
                      className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 text-[9px] font-black uppercase tracking-wider transition-colors border border-emerald-100"
                    >
                      <Fingerprint size={12} /> Enroll
                    </button>
                    <button 
                      onClick={() => {
                        toast.loading('Deleting biometric data...', { id: 'del-bio' });
                        deleteBiometric(member.id)
                          .then(() => toast.success(`Biometric templates deleted for ${member.name}.`, { id: 'del-bio' }))
                          .catch(() => toast.error('Failed to delete templates.', { id: 'del-bio' }));
                      }}
                      className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg bg-red-50 text-red-600 hover:bg-red-100 text-[9px] font-black uppercase tracking-wider transition-colors border border-red-100"
                    >
                      <Trash2 size={12} /> Delete
                    </button>
                    <button 
                      onClick={() => {
                        toast.loading('Syncing device...', { id: 'sync' });
                        syncMemberBiometric(member.id)
                          .then(() => toast.success('Sync completed successfully!', { id: 'sync' }))
                          .catch(() => toast.error('Failed to sync device.', { id: 'sync' }));
                      }}
                      className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg bg-amber-50 text-amber-600 hover:bg-amber-100 text-[9px] font-black uppercase tracking-wider transition-colors border border-amber-100"
                    >
                      <Wifi size={12} /> Sync Device
                    </button>
                    <button 
                      onClick={() => {
                        toast.loading('Restarting enrollment...', { id: 're-enroll' });
                        enrollFingerprint(member.id)
                          .then(() => toast.success(`Re-enrollment sent to device for ${member.name}.`, { id: 're-enroll' }))
                          .catch(() => toast.error('Failed to trigger re-enrollment.', { id: 're-enroll' }));
                      }}
                      className="flex items-center justify-center gap-1.5 py-2 px-1 rounded-lg bg-[#FFF7ED] text-[#EA580C] hover:bg-orange-100 text-[9px] font-black uppercase tracking-wider transition-colors border border-[#FED7AA]"
                    >
                      <RotateCcw size={12} /> Re-Enroll
                    </button>
                  </div>
                </div>
              </div>

              {/* Membership Timeline */}
              <div className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 flex items-center gap-1.5">
                  <Activity size={12} className="text-indigo-600" /> Membership Timeline
                </h4>
                <div className="bg-slate-50 rounded-xl border border-slate-100 p-4 space-y-4 max-h-[220px] overflow-y-auto">
                  {(() => {
                    const timeline = member.timeline || [
                      { type: 'Joined', date: member.joinDate || new Date().toISOString().split('T')[0], details: 'Joined The Warrior Gym' }
                    ];
                    
                    return (
                      <div className="relative pl-6 border-l border-slate-200 space-y-4 text-xs">
                        {timeline.map((item: any, idx: number) => {
                          return (
                            <div key={idx} className="relative">
                              {/* Timeline Dot */}
                              <div className={`absolute -left-[29px] top-0.5 w-3.5 h-3.5 rounded-full border-2 border-white flex items-center justify-center shadow-sm ${
                                item.type === 'Joined' ? 'bg-emerald-500' :
                                item.type === 'Renewed' ? 'bg-indigo-600' :
                                item.type === 'Freeze' ? 'bg-purple-500' :
                                item.type === 'Resume' ? 'bg-[#F97316]' :
                                item.type === 'Expired' ? 'bg-slate-400' : 'bg-red-500'
                              }`}>
                                <div className="w-1 h-1 rounded-full bg-white" />
                              </div>
                              
                              <div>
                                <div className="font-bold text-slate-800 flex items-center justify-between">
                                  <span>{item.type}</span>
                                  <span className="text-[9px] text-slate-400 font-mono font-semibold">
                                    {item.date ? new Date(item.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : ''}
                                  </span>
                                </div>
                                <p className="text-[10px] text-slate-500 mt-0.5">
                                  {item.details || `${item.type} status recorded`}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-4">
                <div className="flex gap-2">
                  <button 
                    onClick={() => onRenew?.(member)}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    <RefreshCw size={14} /> Renew Contract
                  </button>
                  <button 
                    onClick={() => toggleFreeze(member.id)}
                    className="flex-1 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2"
                  >
                    {member.status === 'frozen' ? <Play size={14} /> : <Pause size={14} />} 
                    {member.status === 'frozen' ? 'Unfreeze' : 'Freeze'}
                  </button>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => {
                      toast.loading('Resetting password...', { id: 'reset' });
                      resetPassword(member.id, 'warrior123')
                        .then(() => toast.success('Password reset to default (warrior123).', { id: 'reset' }))
                        .catch(() => toast.error('Failed to reset password.', { id: 'reset' }));
                    }}
                    className="flex-1 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-[11px] font-bold transition-colors"
                  >
                    Reset Password
                  </button>
                  <button 
                    onClick={() => {
                      toast.loading('Sending credentials...', { id: 'creds' });
                      sendCredentials(member.id)
                        .then(() => toast.success('Credentials sent via WhatsApp/SMS.', { id: 'creds' }))
                        .catch(() => toast.error('Failed to send credentials.', { id: 'creds' }));
                    }}
                    className="flex-1 py-2.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-[11px] font-bold transition-colors"
                  >
                    Send Credentials
                  </button>
                </div>
                <button 
                  onClick={() => {
                    if (onDelete) {
                      onDelete(member);
                    } else {
                      deleteMember(member.id)
                        .then(() => {
                          toast.success('Member deleted successfully.');
                          onClose();
                        })
                        .catch(() => toast.error('Failed to delete member.'));
                    }
                  }}
                  className="w-full py-3 mt-2 bg-red-50 text-red-600 hover:bg-red-100 border border-red-100 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Trash2 size={14} /> Delete Member Account
                </button>
              </div>

            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body
  );
}
