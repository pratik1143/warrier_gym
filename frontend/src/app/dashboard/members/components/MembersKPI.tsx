'use client';

import React, { useMemo } from 'react';
import { Users, UserCheck, PauseCircle, AlertTriangle, IndianRupee, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { useGymStore } from '@/store';
import { SYSTEM_CONFIG } from '@/config/system';
import { useTodaysPayments } from '@/hooks/useTodaysPayments';
import { membershipEngine } from '@/lib/engines/membershipEngine';

export default function MembersKPI() {
  const { members, attendance } = useGymStore();
  const { allPayments } = useTodaysPayments();

  const stats = useMemo(() => {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: SYSTEM_CONFIG.timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    const todayStr = formatter.format(now);
    const currentYearMonth = todayStr.substring(0, 7);

    let activeCount = 0;
    let holdCount = 0;
    let expiringCount = 0;

    (members || []).forEach((m: any) => {
      const st = String(m.status || m.membershipStatus || '').toLowerCase();
      const isHold = st === 'hold' || m.activationStatus === 'PENDING_ACTIVATION';

      if (isHold) {
        holdCount++;
      } else {
        const daysLeft = m.expiryDate ? membershipEngine.calculateDaysLeft(m.expiryDate) : 0;
        if (daysLeft <= 0) {
          // expired
        } else if (daysLeft <= 15) {
          expiringCount++;
          activeCount++;
        } else {
          activeCount++;
        }
      }
    });

    // Real monthly revenue from live payments
    const seenPaymentKeys = new Set<string>();
    let revenueThisMonth = 0;

    (allPayments || []).forEach((p: any) => {
      if (!p || p.isSample || p.isMock) return;
      const isHist = p.isHistorical === true || p.imported === true || p.isLegacyImport === true || p.transactionType === 'historical_import';
      if (isHist) return;

      const status = String(p.status || p.paymentStatus || 'paid').toLowerCase();
      if (status !== 'paid' && status !== 'partial') return;

      const pDate = String(p.paymentDate || p.date || '').split('T')[0];
      if (!pDate || !pDate.startsWith(currentYearMonth) || pDate > todayStr) return;

      const key = String(p.id || p.paymentId || p.invoiceNumber || p.invoice || p.idempotencyKey || '').trim();
      if (key && seenPaymentKeys.has(key)) return;
      if (key) seenPaymentKeys.add(key);

      const val = Number(p.amountPaid !== undefined ? p.amountPaid : (p.paid !== undefined ? p.paid : (p.amount || 0)));
      revenueThisMonth += (isNaN(val) ? 0 : val);
    });

    return {
      total: (members || []).length,
      active: activeCount,
      hold: holdCount,
      expiring: expiringCount,
      revenue: revenueThisMonth
    };
  }, [members, allPayments]);

  const cards = [
    {
      id: 'total',
      title: 'TOTAL MEMBERS',
      value: stats.total,
      subtext: 'Registered members',
      icon: Users,
      iconBg: 'bg-orange-50 text-[#EA580C] border border-orange-100',
      badge: 'All-time',
      badgeColor: 'bg-stone-100 text-stone-600',
      sparkline: 'M0,15 Q25,8 50,14 T100,5',
      strokeColor: '#EA580C',
    },
    {
      id: 'active',
      title: 'ACTIVE MEMBERS',
      value: stats.active,
      subtext: 'Currently active',
      icon: UserCheck,
      iconBg: 'bg-emerald-50 text-emerald-600 border border-emerald-100',
      badge: 'Valid',
      badgeColor: 'bg-emerald-50 text-emerald-700',
      sparkline: 'M0,16 Q30,10 60,12 T100,4',
      strokeColor: '#10B981',
    },
    {
      id: 'hold',
      title: 'ON HOLD',
      value: stats.hold,
      subtext: 'Pending activation',
      icon: PauseCircle,
      iconBg: 'bg-amber-50 text-amber-600 border border-amber-100',
      badge: 'Action Needed',
      badgeColor: 'bg-amber-50 text-amber-700',
      sparkline: 'M0,10 Q35,16 70,8 T100,12',
      strokeColor: '#F59E0B',
    },
    {
      id: 'expiring',
      title: 'EXPIRING SOON',
      value: stats.expiring,
      subtext: 'Renewal required',
      icon: AlertTriangle,
      iconBg: 'bg-rose-50 text-rose-600 border border-rose-100',
      badge: '≤ 15 Days',
      badgeColor: 'bg-rose-50 text-rose-700',
      sparkline: 'M0,8 Q30,14 65,10 T100,16',
      strokeColor: '#EF4444',
    },
    {
      id: 'revenue',
      title: 'MONTHLY REVENUE',
      value: `₹${stats.revenue.toLocaleString('en-IN')}`,
      subtext: 'Actual payments collected',
      icon: IndianRupee,
      iconBg: 'bg-gradient-to-br from-orange-50 to-amber-50 text-[#EA580C] border border-orange-200',
      badge: 'This Month',
      badgeColor: 'bg-orange-50 text-[#EA580C]',
      sparkline: 'M0,18 Q20,12 45,15 T75,8 T100,2',
      strokeColor: '#F04400',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mb-6">
      {cards.map((c, i) => {
        const Icon = c.icon;
        return (
          <motion.div
            key={c.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: i * 0.04 }}
            className="group relative bg-white rounded-2xl p-4 sm:p-4.5 border border-stone-200 hover:border-orange-300 hover:shadow-md transition-all duration-200 flex flex-col justify-between"
          >
            {/* Top Bar: Title & Icon */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="text-[10px] font-bold tracking-wider text-stone-500 uppercase block">
                  {c.title}
                </span>
                <div className="flex items-baseline gap-1.5 mt-1.5">
                  <h3 className="text-2xl font-black tracking-tight text-stone-900 group-hover:text-[#EA580C] transition-colors">
                    {c.value}
                  </h3>
                </div>
              </div>
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${c.iconBg} shadow-xs`}>
                <Icon className="w-4 h-4" />
              </div>
            </div>

            {/* Bottom Row: Subtext & Mini Sparkline */}
            <div className="mt-3 pt-3 border-t border-stone-100 flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-stone-500 truncate">
                {c.subtext}
              </span>

              {/* Sparkline */}
              <div className="w-16 h-5 opacity-70 group-hover:opacity-100 transition-opacity shrink-0">
                <svg viewBox="0 0 100 20" className="w-full h-full overflow-visible">
                  <path
                    d={c.sparkline}
                    fill="none"
                    stroke={c.strokeColor}
                    strokeWidth="2.2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
