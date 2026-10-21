'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Users, Plus, CreditCard, Menu, X, Clock,
  ClipboardList, Briefcase, UserX, AlertTriangle, Settings, Mail,
  MessageSquare, ShieldCheck, LogOut, Award, Smartphone, KeyRound, Unlock,
  UserCheck, Gift, Apple, Upload, BarChart3, Sparkles, MessageCircle
} from 'lucide-react';
import { useAuthStore } from '@/store';
import toast from '@/lib/toast';
import PwaInstallButton from '@/components/PwaInstallButton';

interface MobileBottomNavProps {
  onOpenAddMember: () => void;
}

export default function MobileBottomNav({ onOpenAddMember }: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout, user } = useAuthStore();
  const [isMoreOpen, setIsMoreOpen] = useState(false);

  const navItems = [
    { label: 'Home', href: '/dashboard/overview', icon: LayoutDashboard },
    { label: 'Members', href: '/dashboard/members', icon: Users },
    { label: 'ADD', isAction: true, icon: Plus },
    { label: 'Billing', href: '/dashboard/billing', icon: CreditCard },
    { label: 'More', isMore: true, icon: Menu },
  ];

  const moreLinks = [
    { label: 'Attendance', href: '/dashboard/attendance', icon: Clock, desc: 'Member check-ins' },
    { label: 'Enquiries', href: '/dashboard/enquiries', icon: ClipboardList, desc: 'Leads and follow-ups' },
    { label: 'Employees', href: '/dashboard/employees', icon: Briefcase, desc: 'Staff management' },
    { label: 'Trainers', href: '/dashboard/trainers', icon: UserCheck, desc: 'Trainer management' },
    { label: 'Follow Up', href: '/dashboard/follow-up', icon: AlertTriangle, desc: 'Pending renewals' },
    { label: 'Expired', href: '/dashboard/expired', icon: UserX, desc: 'Expired memberships' },
    { label: 'Inconsistent', href: '/dashboard/inconsistent', icon: ShieldCheck, desc: 'Member data checks' },
    { label: 'Memberships', href: '/dashboard/memberships', icon: Award, desc: 'Packages and pricing' },
    { label: 'Diet Plans', href: '/dashboard/diet-management', icon: Apple, desc: 'Member nutrition plans' },
    { label: 'Referrals', href: '/dashboard/referrals', icon: Gift, desc: 'Referral rewards' },
    { label: 'Web Messages', href: '/dashboard/messages', icon: MessageCircle, desc: 'Website messages' },
    { label: 'Gate Control', href: '/dashboard/gate-control', icon: Unlock, desc: 'Door access control' },
    { label: 'Device Access', href: '/dashboard/access-control', icon: KeyRound, desc: 'Biometric device setup' },
    { label: 'WhatsApp', href: '/dashboard/automation/whatsapp', icon: MessageSquare, desc: 'WhatsApp automation' },
    { label: 'Email Automation', href: '/dashboard/automation', icon: Mail, desc: 'Email reminders' },
    { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, desc: 'Gym performance' },
    { label: 'Risk Radar', href: '/dashboard/risk-radar', icon: Sparkles, desc: 'Members needing attention' },
    { label: 'Trainer Desk', href: '/dashboard/trainer-desk', icon: UserCheck, desc: 'Trainer operations' },
    { label: 'Leaderboard', href: '/dashboard/leaderboard', icon: Award, desc: 'Member activity' },
    { label: 'Import Data', href: '/dashboard/import', icon: Upload, desc: 'Import members and leads' },
    { label: 'Member App', href: '/dashboard/member-app', icon: Smartphone, desc: 'Member app access' },
    { label: 'Settings', href: '/dashboard/settings', icon: Settings, desc: 'Gym configuration' },
  ];

  const handleSignOut = () => {
    setIsMoreOpen(false);
    logout();
    toast.success('Signed out successfully');
    router.push('/');
  };

  return (
    <>
      {/* Mobile Bottom Navigation Bar (Visible <768px) */}
      <nav
        className="crm-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-xl border-t border-slate-200 shadow-[0_-8px_28px_rgba(15,23,42,0.10)] font-sans"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-16 px-2 max-w-md mx-auto relative">
          {navItems.map((item, idx) => {
            if (item.isAction) {
              return (
                <div key={idx} className="relative -top-4 flex items-center justify-center">
                  <button
                    type="button"
                    onClick={onOpenAddMember}
                    className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#EA580C] to-[#C2410C] text-white shadow-[0_8px_20px_rgba(234, 88, 12,0.34)] hover:brightness-105 active:scale-95 transition-all flex flex-col items-center justify-center border-4 border-white cursor-pointer"
                    aria-label="Add Member"
                  >
                    <Plus size={26} strokeWidth={3} />
                  </button>
                </div>
              );
            }

            if (item.isMore) {
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setIsMoreOpen(true)}
                  className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full cursor-pointer bg-transparent border-none ${
                    isMoreOpen ? 'text-[#EA580C]' : 'text-slate-500 hover:text-[#EA580C]'
                  }`}
                >
                  <item.icon size={20} />
                  <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
                </button>
              );
            }

            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href!));

            return (
              <Link
                key={idx}
                href={item.href!}
                onClick={() => setIsMoreOpen(false)}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full cursor-pointer no-underline transition-colors ${
                  isActive ? 'text-[#EA580C] font-bold' : 'text-slate-500 hover:text-[#EA580C]'
                }`}
              >
                <item.icon size={20} className={isActive ? 'text-[#EA580C]' : ''} />
                <span className="text-[10px] font-black uppercase tracking-wider">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* MORE Bottom Sheet Drawer */}
      <AnimatePresence>
        {isMoreOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMoreOpen(false)}
              className="md:hidden fixed inset-0 bg-slate-950/45 backdrop-blur-sm z-[60]"
            />

            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="md:hidden fixed bottom-0 left-0 right-0 z-[65] bg-white border-t border-slate-200 rounded-t-3xl shadow-2xl max-h-[88dvh] flex flex-col font-sans overflow-hidden text-slate-900"
              style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 70px)' }}
            >
              {/* Drawer Handle & Header */}
              <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-orange-50 text-[#EA580C] font-black text-xs flex items-center justify-center border border-orange-100">
                    AZ
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">Warrior CRM Modules</h3>
                    <p className="text-[10px] text-slate-500 font-bold">Logged in as {user?.name || 'Admin'}</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsMoreOpen(false)}
                  className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 border-none cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>

              {/* PWA Install Banner inside Drawer */}
              <div className="p-4 border-b border-slate-100 bg-gradient-to-r from-orange-50 to-white flex items-center justify-between gap-3 shrink-0">
                <div className="space-y-0.5">
                  <div className="text-xs font-black text-slate-900 uppercase">Install App on Phone</div>
                  <div className="text-[10px] text-slate-400">Standalone PWA app experience</div>
                </div>
                <PwaInstallButton variant="compact" label="INSTALL APP" />
              </div>

              {/* Grid of Links */}
              <div className="p-4 overflow-y-auto grid grid-cols-2 gap-2.5 scrollbar-thin">
                {moreLinks.map((link, idx) => {
                  const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                  return (
                    <Link
                      key={idx}
                      href={link.href}
                      onClick={() => setIsMoreOpen(false)}
                      className={`p-3 rounded-2xl border transition-all no-underline text-left flex flex-col justify-between ${
                        isActive
                          ? 'bg-orange-50 border-orange-200 text-[#EA580C]'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <link.icon size={16} className={isActive ? 'text-[#EA580C]' : 'text-slate-400'} />
                        <span className={`text-xs font-black uppercase tracking-wide ${isActive ? 'text-[#EA580C]' : 'text-slate-800'}`}>{link.label}</span>
                      </div>
                      <span className="text-[9px] text-slate-500 font-medium leading-tight">{link.desc}</span>
                    </Link>
                  );
                })}
              </div>

              {/* Sign Out Footer */}
              <div className="p-4 border-t border-slate-100 bg-white shrink-0">
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="w-full py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-2xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
