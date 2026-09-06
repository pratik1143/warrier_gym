'use client';

import React, { useState, useEffect } from 'react';
import { Trophy, Award, Users, Share2, ArrowUpRight, Flame, Target, Gift } from 'lucide-react';
import { useGymStore } from '@/store';
import { getInitials } from '@/lib/utils';
import toast from '@/lib/toast';

export default function LeaderboardPage() {
  const { members, fetchMembers } = useGymStore();

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Sort members for leaderboard
  const consistencyList = [...members].sort((a, b) => (b.attendancePercent || 80) - (a.attendancePercent || 80));
  const streaksList = [...members].sort((a, b) => (b.streak || 0) - (a.streak || 0));

  // Referrals statistics (real data via invite campaigns)
  const referralRoster: any[] = [];

  return (
    <div className="space-y-6 pb-12">
      
      {/* Header */}
      <div className="border-b border-brand-border/60 pb-5">
        <h1 className="text-3xl font-black text-brand-text-primary tracking-tight font-display">Leaderboards & Referrals</h1>
        <p className="text-xs text-brand-text-secondary mt-0.5">Track attendance streaks, athlete transformations, and referral free months.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Consistency Leaderboard */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Trophy className="text-amber-500" size={16} />
            <h3 className="font-bold text-sm text-brand-text-primary font-display">Consistency Index</h3>
          </div>
          <p className="text-[10px] text-brand-text-secondary">Members with highest biometric turnstile gate entry percentages.</p>

          <div className="space-y-2.5">
            {consistencyList.length > 0 ? (
                consistencyList.slice(0, 5).map((m, idx) => {
                const rankColor = idx === 0 ? 'text-amber-500 font-extrabold' : idx === 1 ? 'text-slate-400 font-bold' : idx === 2 ? 'text-amber-700 font-bold' : 'text-slate-500 font-semibold';
                return (
                  <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-brand-bg-card/40 border border-brand-border/40">
                    <div className="flex items-center gap-2.5">
                      <div className={`text-xs w-5 text-center ${rankColor}`}>#{idx + 1}</div>
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-xxs text-brand-text-primary">
                        {getInitials(m.name)}
                      </div>
                      <div>
                        <div className="text-xs font-bold text-brand-text-primary">{m.name}</div>
                        <div className="text-[9px] text-brand-text-muted">{m.branch} location</div>
                      </div>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF7ED] text-[#C2410C] border border-[#FED7AA]">{m.attendancePercent || 80}%</span>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-6 text-xs text-brand-text-muted">
                No active members tracked yet
              </div>
            )}
          </div>
        </div>

        {/* Streaks Leaderboard */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Flame className="text-brand-purple" size={16} />
            <h3 className="font-bold text-sm text-brand-text-primary font-display">Attendance Streaks</h3>
          </div>
          <p className="text-[10px] text-brand-text-secondary">Members with consecutive daily biometric gate check-ins.</p>

          <div className="space-y-2.5">
            {streaksList.length > 0 ? (
              streaksList.slice(0, 5).map((m, idx) => (
                <div key={m.id} className="flex items-center justify-between p-3 rounded-xl bg-brand-bg-card/40 border border-brand-border/40">
                  <div className="flex items-center gap-2.5">
                    <div className="text-xs font-black text-brand-purple w-5 text-center">#{idx + 1}</div>
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center font-bold text-xxs text-brand-text-primary">
                      {getInitials(m.name)}
                    </div>
                    <div>
                      <div className="text-xs font-bold text-brand-text-primary">{m.name}</div>
                      <div className="text-[9px] text-brand-text-muted">{m.plan.split(' ')[0]} plan</div>
                    </div>
                  </div>
                  <span className="badge-purple text-[10px] font-bold flex items-center gap-1">
                    🔥 {m.streak || 0} days
                  </span>
                </div>
              ))
            ) : (
              <div className="text-center py-6 text-xs text-brand-text-muted">
                No streaks recorded yet
              </div>
            )}
          </div>
        </div>

        {/* Referral System Ledger */}
        <div className="glass-card p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Gift className="text-brand-success" size={16} />
              <h3 className="font-bold text-sm text-brand-text-primary font-display">Referral Program Logs</h3>
            </div>
            <p className="text-[10px] text-brand-text-secondary leading-relaxed">
              Whenever a referred friend completes their first gate entry check-in, the inviter automatically receives a 1-month contract extension reward.
            </p>

            <div className="space-y-2 pt-2">
              {referralRoster.length > 0 ? (
                referralRoster.map((ref, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-brand-border bg-slate-50 text-xxs space-y-1.5">
                    <div className="flex justify-between font-bold">
                      <span className="text-brand-text-primary">{ref.name}</span>
                      <span className="text-brand-success font-mono text-[9px]">{ref.reward}</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-brand-text-secondary">
                      <span>Invited: {ref.invited}</span>
                      <span>Status: {ref.status}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-xs text-brand-text-muted bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  No referral invites logged yet
                </div>
              )}
            </div>
          </div>

          <button 
            onClick={() => toast.success('Open Member App view to share your referral code!')}
            className="w-full py-2.5 rounded-xl btn-cyber-cyan text-xs font-bold text-white cursor-pointer mt-4"
          >
            <Share2 size={13} className="text-white" /> Generate Share Campaign Link
          </button>
        </div>

      </div>

    </div>
  );
}
