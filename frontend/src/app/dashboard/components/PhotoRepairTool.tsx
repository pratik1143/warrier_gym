'use client';

import React, { useState } from 'react';
import {
  Wrench,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Download,
  RefreshCw,
  Image as ImageIcon,
  CloudCheck,
  ShieldAlert,
  FileSpreadsheet
} from 'lucide-react';
import API from '@/services/api';
import toast from '@/lib/toast';
import { useGymStore } from '@/store';

interface RepairStats {
  totalMembers: number;
  photosRepaired: number;
  photosFailed: number;
  photosAlreadyOk: number;
  missingPhotoCount: number;
}

interface ReportItem {
  id: string;
  memberId: string;
  name: string;
  phone: string;
  status: 'ok' | 'repaired' | 'failed' | 'missing';
  legacyPhotoUrl: string | null;
  firebasePhotoUrl: string | null;
  profilePhotoUrl: string | null;
  details: string;
}

export default function PhotoRepairTool() {
  const { fetchMembers } = useGymStore();
  const [isRepairing, setIsRepairing] = useState(false);
  const [stats, setStats] = useState<RepairStats | null>(null);
  const [report, setReport] = useState<ReportItem[] | null>(null);

  const handleRepair = async () => {
    setIsRepairing(true);
    toast.loading('Scanning & repairing imported photos...', { id: 'photo-repair' });

    try {
      const res = await API.post('/members/repair-photos');
      const data = res.data;

      setStats(data.stats);
      setReport(data.report || []);

      toast.success(
        `Photo Repair Completed! Repaired: ${data.stats.photosRepaired}, Already OK: ${data.stats.photosAlreadyOk}`,
        { id: 'photo-repair', duration: 5000 }
      );

      // Refresh frontend members state
      await fetchMembers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to repair photos', {
        id: 'photo-repair'
      });
    } finally {
      setIsRepairing(false);
    }
  };

  const handleDownloadCSVReport = () => {
    if (!report || report.length === 0) {
      toast.error('No repair report data available. Please run repair scan first.');
      return;
    }

    const headers = [
      'Member ID',
      'Name',
      'Phone',
      'Status',
      'Legacy Photo URL',
      'Firebase Photo URL',
      'Profile Photo URL',
      'Audit Details'
    ];

    const escapeVal = (v: any) => String(v ?? '').replace(/"/g, '""');

    const rows = report.map(r => [
      escapeVal(r.memberId),
      escapeVal(r.name),
      escapeVal(r.phone),
      escapeVal(r.status.toUpperCase()),
      escapeVal(r.legacyPhotoUrl),
      escapeVal(r.firebasePhotoUrl),
      escapeVal(r.profilePhotoUrl),
      escapeVal(r.details)
    ].map(v => `"${v}"`).join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `photo-health-report-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success('Downloaded Photo Health Report CSV!');
  };

  const [isRepairingBilling, setIsRepairingBilling] = useState(false);

  const handleRepairBilling = async () => {
    setIsRepairingBilling(true);
    toast.loading('Repairing billing history & invoices for imported members...', { id: 'billing-repair' });

    try {
      const res = await API.post('/members/repair-billing');
      const data = res.data;

      toast.success(
        `Billing Repair Completed! ${data.stats.membersRepaired} Members Repaired, ${data.stats.billingRecordsGenerated} Invoices Generated (Total: ₹${data.stats.totalRevenueCalculated.toLocaleString('en-IN')})`,
        { id: 'billing-repair', duration: 6000 }
      );

      await fetchMembers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to repair billing', {
        id: 'billing-repair'
      });
    } finally {
      setIsRepairingBilling(false);
    }
  };

  const [isMarkingPaid, setIsMarkingPaid] = useState(false);

  const handleMarkAllPaid = async () => {
    if (!window.confirm('Are you sure you want to mark ALL member bills and invoices as PAID (Fully Cleared)?')) {
      return;
    }

    setIsMarkingPaid(true);
    toast.loading('Marking all bills & invoices as PAID...', { id: 'mark-all-paid' });

    try {
      const res = await API.post('/members/mark-all-paid');
      toast.success(res.data.message || 'All member bills marked as PAID successfully!', { id: 'mark-all-paid', duration: 5000 });
      await fetchMembers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to mark bills as paid', { id: 'mark-all-paid' });
    } finally {
      setIsMarkingPaid(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-xs">
            <Wrench size={24} />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              Repair & Sync Imported Data (Photos & Billing)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Fix missing photos and generate official billing history for existing imported members without re-uploading Excel files.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleMarkAllPaid}
            disabled={isMarkingPaid}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-black rounded-xl text-sm hover:bg-indigo-700 transition-all shadow-sm cursor-pointer disabled:opacity-50 border-none"
          >
            {isMarkingPaid ? (
              <>
                <RefreshCw size={16} className="animate-spin text-white" />
                Updating All Bills...
              </>
            ) : (
              <>
                <CheckCircle2 size={16} />
                Mark All Bills Paid
              </>
            )}
          </button>

          <button
            onClick={handleRepairBilling}
            disabled={isRepairingBilling}
            className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-bold rounded-xl text-sm hover:bg-emerald-700 transition-all shadow-sm cursor-pointer disabled:opacity-50 border-none"
          >
            {isRepairingBilling ? (
              <>
                <RefreshCw size={16} className="animate-spin text-white" />
                Generating Invoices...
              </>
            ) : (
              <>
                <FileSpreadsheet size={16} />
                Repair Billing Ledger
              </>
            )}
          </button>

          <button
            onClick={handleRepair}
            disabled={isRepairing}
            className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-[#d4ff00] font-bold rounded-xl text-sm hover:bg-black transition-all shadow-sm cursor-pointer disabled:opacity-50 border-none"
          >
            {isRepairing ? (
              <>
                <RefreshCw size={16} className="animate-spin text-[#d4ff00]" />
                Scanning Photos...
              </>
            ) : (
              <>
                <Wrench size={16} />
                Repair Imported Photos
              </>
            )}
          </button>

          {report && report.length > 0 && (
            <button
              onClick={handleDownloadCSVReport}
              className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 text-slate-700 font-bold rounded-xl text-sm hover:bg-slate-200 transition-all border border-slate-200 shadow-xs cursor-pointer"
            >
              <Download size={16} />
              Export Report CSV
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats Grid */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80">
            <div className="text-xs font-semibold text-slate-500">Total Members</div>
            <div className="text-2xl font-black text-slate-900 mt-1">{stats.totalMembers}</div>
          </div>
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
            <div className="text-xs font-semibold text-emerald-700">Photos Already OK</div>
            <div className="text-2xl font-black text-emerald-800 mt-1">{stats.photosAlreadyOk}</div>
          </div>
          <div className="p-4 rounded-xl bg-teal-50 border border-teal-200">
            <div className="text-xs font-semibold text-teal-700">Photos Repaired</div>
            <div className="text-2xl font-black text-teal-800 mt-1">{stats.photosRepaired}</div>
          </div>
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200">
            <div className="text-xs font-semibold text-amber-700">Missing Photos</div>
            <div className="text-2xl font-black text-amber-800 mt-1">{stats.missingPhotoCount}</div>
          </div>
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200">
            <div className="text-xs font-semibold text-rose-700">Photos Failed</div>
            <div className="text-2xl font-black text-rose-800 mt-1">{stats.photosFailed}</div>
          </div>
        </div>
      )}

      {/* Image Health Report */}
      {report && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <CloudCheck size={18} className="text-teal-600" />
              Image Health Report
            </h3>
            <span className="text-xs text-slate-500 font-medium">
              Showing {report.length} audited member records
            </span>
          </div>

          <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-xl divide-y divide-slate-100">
            {report.map((item) => (
              <div
                key={item.id}
                className="p-3 text-xs flex items-center justify-between hover:bg-slate-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span
                    className={`inline-flex items-center justify-center px-2 py-0.5 rounded-md font-bold text-[10px] uppercase ${
                      item.status === 'ok'
                        ? 'bg-emerald-100 text-emerald-800'
                        : item.status === 'repaired'
                        ? 'bg-teal-100 text-teal-800'
                        : item.status === 'missing'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {item.status === 'ok' && '✅ OK'}
                    {item.status === 'repaired' && '🛠 Repaired'}
                    {item.status === 'missing' && '⚠ Missing'}
                    {item.status === 'failed' && '❌ Failed'}
                  </span>
                  <div>
                    <span className="font-bold text-slate-900">{item.name}</span>
                    <span className="text-slate-400 ml-2">({item.memberId})</span>
                  </div>
                </div>

                <div className="text-slate-500 font-mono text-[11px] truncate max-w-xs">
                  {item.details}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
