'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle,
  RefreshCw, Zap, ShieldAlert, ArrowRight, Download, Printer,
  FileText, Check, Cpu, Clock, Terminal, Filter, Eye, Info, Trash2, X, Search, Table
} from 'lucide-react';
import { useGymStore, useDeviceStore } from '@/store';
import toast from '@/lib/toast';
import API from '@/services/api';
import * as XLSX from 'xlsx';
import PhotoRepairTool from './PhotoRepairTool';

// Auto-mapping header aliases
const FIELD_MAP: Record<string, string[]> = {
  clientId:   ['client id', 'clientid', 'id', 'biometric id', 'biometricid', 'member id', 'memberid'],
  name:       ['client name', 'name', 'full name', 'fullname', 'member name', 'member'],
  phone:      ['number', 'phone', 'mobile', 'contact', 'phone number', 'mobile number'],
  gender:     ['gender', 'sex'],
  registrationDate: ['registration', 'registration date', 'registrationdate', 'join date', 'joining date', 'start date'],
  membershipPackage: ['package', 'membershippackage', 'plan', 'membership', 'membership plan'],
  membershipExpiry: ['expiration', 'expiry', 'expiry date', 'expirydate', 'membershipexpiry', 'expiration date'],
  amount:     ['amount', 'fee', 'price', 'cost', 'paid', 'amount paid', 'paid amount', 'total', 'amt', 'amount (₹)', 'fees'],
  photoUrl:   ['photo (url)', 'photo', 'photo url', 'photourl', 'avatar', 'avatarurl', 'avatar url', 'image', 'image url', 'imageurl', 'picture', 'client photo', 'member photo', 'profile photo', 'photo link', 'url']
};

function detectColumnField(header: string): string {
  const h = header.toLowerCase().trim();
  for (const [field, aliases] of Object.entries(FIELD_MAP)) {
    if (aliases.some(a => h.includes(a))) return field;
  }
  return '';
}

function parseCSVString(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g, '').trim());
  const rows = lines.slice(1).map(line => {
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQuotes = !inQuotes; }
      else if (c === ',' && !inQuotes) { cells.push(current.trim()); current = ''; }
      else { current += c; }
    }
    cells.push(current.trim());
    return cells;
  });
  return { headers, rows };
}

export interface SmartStagedFile {
  fileName: string;
  sheetName: string;
  uploadTime: string;
  headers: string[];
  columnMap: Record<number, string>;
  rawRows: string[][];
  payload: Record<string, string>[];
  totalRows: number;
}

export default function SmartAutoMappingEngine({
  onMigrationComplete
}: {
  onMigrationComplete?: () => void;
}) {
  const { fetchMembers } = useGymStore();
  const { isDeviceFullyOnline } = useDeviceStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [stagedFile, setStagedFile] = useState<SmartStagedFile | null>(null);
  const [processingStatus, setProcessingStatus] = useState<'idle' | 'waiting' | 'processing' | 'completed' | 'failed'>('idle');
  const [validationSummary, setValidationSummary] = useState<any | null>(null);
  const [rowExceptions, setRowExceptions] = useState<any[]>([]);
  
  // Execution state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [executionLogs, setExecutionLogs] = useState<string[]>([]);
  const [reportData, setReportData] = useState<any | null>(null);
  const [isPurging, setIsPurging] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewSearch, setPreviewSearch] = useState('');

  const handlePurgeAll = async () => {
    if (!window.confirm('⚠️ WARNING: Are you sure you want to DELETE ALL MEMBERS AND MIGRATED DATA?\n\nThis will purge all imported members, history, and invoices to give you a clean slate.')) {
      return;
    }

    setIsPurging(true);
    toast.loading('Deleting all CRM member data...', { id: 'purge-data' });

    try {
      await API.post('/members/purge-all');
      localStorage.removeItem('warrior_gym_staged_import');
      setStagedFile(null);
      setValidationSummary(null);
      setRowExceptions([]);
      setReportData(null);
      toast.success('All member data and migration records deleted successfully!', { id: 'purge-data' });
      await fetchMembers();
    } catch (err: any) {
      toast.error('Failed to purge data: ' + (err.response?.data?.error || err.message), { id: 'purge-data' });
    } finally {
      setIsPurging(false);
    }
  };

  // Restore staged file from localStorage if available
  useEffect(() => {
    try {
      const saved = localStorage.getItem('warrior_gym_staged_import');
      if (saved) {
        const parsed = JSON.parse(saved);
        setStagedFile(parsed);
        setProcessingStatus('waiting');
      }
    } catch (e) {
      console.warn('Failed to load staged import cache:', e);
    }
  }, []);

  // Parse Excel ArrayBuffer or CSV
  const parseFileToStaged = async (file: File): Promise<SmartStagedFile> => {
    const isExcel = file.name.endsWith('.xlsx') || file.name.endsWith('.xls');
    let sheetName = 'Sheet1';
    let headers: string[] = [];
    let rows: string[][] = [];

    if (isExcel) {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('INVALID EXCEL PARSER: No sheets found.');
      }
      sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const rawMatrix: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '', raw: false });
      
      if (!rawMatrix || rawMatrix.length === 0) {
        throw new Error('INVALID EXCEL PARSER: Worksheet is empty.');
      }

      let headerIdx = 0;
      while (headerIdx < rawMatrix.length && (!rawMatrix[headerIdx] || rawMatrix[headerIdx].every((c: any) => String(c).trim() === ''))) {
        headerIdx++;
      }

      const rawHeaders = (rawMatrix[headerIdx] || []).map((h: any) => String(h).trim());
      const zipArtifacts = ['[content_types].xml', '_rels', 'docprops', 'xl/', 'theme/'];
      if (rawHeaders.some(h => zipArtifacts.some(z => h.toLowerCase().includes(z)))) {
        throw new Error('INVALID EXCEL PARSER: Detected raw ZIP metadata ([Content_Types].xml). Do not parse binary Excel files using text readers.');
      }

      headers = rawHeaders.filter(h => h !== '');
      const dataRows = rawMatrix.slice(headerIdx + 1);
      dataRows.forEach(r => {
        if (!r || !Array.isArray(r)) return;
        const strRow = rawHeaders.map((_, cIdx) => String(r[cIdx] || '').trim());
        if (strRow.some(cell => cell !== '')) {
          rows.push(strRow);
        }
      });
    } else {
      const text = await file.text();
      const parsed = parseCSVString(text);
      headers = parsed.headers;
      rows = parsed.rows.filter(r => r.some(c => c.trim() !== ''));
    }

    // Zero-Manual Auto Column Mapping
    const columnMap: Record<number, string> = {};
    headers.forEach((h, i) => {
      const detected = detectColumnField(h);
      if (detected) columnMap[i] = detected;
    });

    // Build payload array
    const payload = rows.map(r => {
      const record: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (h && r[i] !== undefined) {
          record[h] = r[i]?.trim() || '';
        }
      });
      Object.entries(columnMap).forEach(([cIdx, field]) => {
        if (field) record[field] = r[Number(cIdx)]?.trim() || '';
      });
      return record;
    });

    return {
      fileName: file.name,
      sheetName,
      uploadTime: new Date().toLocaleTimeString(),
      headers,
      columnMap,
      rawRows: rows,
      payload,
      totalRows: rows.length
    };
  };

  // Run Auto Validation & Row-Level Exception Diagnostics
  const runAutoProcessing = useCallback(async (staged: SmartStagedFile) => {
    setProcessingStatus('processing');

    const exceptions: any[] = [];
    const seenPhones = new Set<string>();
    let readyCount = 0;
    let missingPhotoCount = 0;
    let invalidPackageCount = 0;
    let missingRegDateCount = 0;
    let missingExpiryDateCount = 0;
    let duplicatePhoneCount = 0;
    let failedCount = 0;

    staged.payload.forEach((record, idx) => {
      const rowNum = idx + 1;
      const name = record.name || '';
      const phone = record.phone || '';
      const clientId = record.clientId || '';
      const pkg = record.membershipPackage || '';
      const regDate = record.registrationDate || '';
      const expiry = record.membershipExpiry || '';
      const photo = record.photoUrl || '';

      const rowIssues: string[] = [];

      if (!name || !phone || !clientId) {
        failedCount++;
        rowIssues.push('Missing Name, Phone, or Client ID');
        exceptions.push({
          rowNumber: rowNum,
          name: name || 'Unknown',
          phone: phone || 'N/A',
          clientId: clientId || 'N/A',
          issue: 'Missing Critical Identifiers',
          severity: 'fatal',
          action: 'Cannot be imported'
        });
        return;
      }

      if (!phone) {
        rowIssues.push('Phone Missing');
      } else if (seenPhones.has(phone)) {
        duplicatePhoneCount++;
        rowIssues.push('Duplicate Phone Number');
        exceptions.push({
          rowNumber: rowNum,
          name,
          phone,
          clientId,
          issue: 'Duplicate Phone Number',
          severity: 'warning',
          action: 'Will merge with existing record'
        });
      } else {
        seenPhones.add(phone);
      }

      if (!regDate) {
        missingRegDateCount++;
        rowIssues.push('Missing Registration Date');
      }

      if (!expiry) {
        missingExpiryDateCount++;
        rowIssues.push('Missing Expiry Date');
        exceptions.push({
          rowNumber: rowNum,
          name,
          phone,
          clientId,
          issue: 'Invalid Expiry Date',
          severity: 'warning',
          action: 'Defaulted to 30 days active'
        });
      }

      if (!pkg) {
        invalidPackageCount++;
        rowIssues.push('Invalid / Blank Package');
      }

      if (!photo) {
        missingPhotoCount++;
      }

      readyCount++;
    });

    try {
      // Backend dry-run check
      const res = await API.post('/members/dry-run-migration', { members: staged.payload });
      const dryRes = res.data;

      setValidationSummary({
        totalRows: staged.totalRows,
        membersReady: readyCount,
        historyRecords: dryRes.historyCount || staged.totalRows,
        billingRecords: dryRes.invoicesCount || staged.totalRows,
        photosReady: dryRes.photosCount || 0,
        missingPhotoCount,
        invalidPackageCount,
        duplicatePhoneCount,
        missingRegDateCount,
        missingExpiryDateCount,
        failedCount,
        conflictsCount: dryRes.duplicateConflictsCount || 0
      });

      setRowExceptions(exceptions);
      setProcessingStatus('completed');
      toast.success(`Auto Mapping Completed! ${readyCount} Members Ready.`);
    } catch (err: any) {
      setProcessingStatus('completed');
      setValidationSummary({
        totalRows: staged.totalRows,
        membersReady: readyCount,
        historyRecords: staged.totalRows,
        billingRecords: staged.totalRows,
        photosReady: 0,
        missingPhotoCount,
        invalidPackageCount,
        duplicatePhoneCount,
        missingRegDateCount,
        missingExpiryDateCount,
        failedCount,
        conflictsCount: 0
      });
      setRowExceptions(exceptions);
    }
  }, []);

  // Handle Initial File Selection
  const handleSelectFile = async (file: File) => {
    try {
      const staged = await parseFileToStaged(file);
      setStagedFile(staged);
      localStorage.setItem('warrior_gym_staged_import', JSON.stringify(staged));
      toast.success(`File uploaded! Sheet: "${staged.sheetName}" (${staged.totalRows} Rows).`);
      
      // Auto Start Processing
      runAutoProcessing(staged);
    } catch (err: any) {
      toast.error(err.message || 'File Upload Failed');
    }
  };

  // Re-run Auto Mapping (for button click)
  const handleAutoMapClick = () => {
    if (!stagedFile) {
      fileInputRef.current?.click();
      return;
    }
    runAutoProcessing(stagedFile);
  };

  // Execute Production Migration (Chunked Batches)
  const handleExecuteMigration = async () => {
    if (!stagedFile || !stagedFile.payload) return;

    setIsExecuting(true);
    setExecutionProgress(5);
    setExecutionLogs(['[Auto Engine] Starting chunked atomic production import...']);

    const allMembers = stagedFile.payload;
    const chunkSize = 100;
    const totalBatches = Math.ceil(allMembers.length / chunkSize);
    let combinedStats = {
      importedMembers: 0,
      skippedIdempotent: 0,
      duplicateMembers: 0,
      totalRows: allMembers.length,
      photosImported: 0,
      sessionId: `auto_mig_${Date.now()}`
    };

    try {
      for (let i = 0; i < totalBatches; i++) {
        const batch = allMembers.slice(i * chunkSize, (i + 1) * chunkSize);
        const progressPct = Math.round(((i + 1) / totalBatches) * 80);
        setExecutionProgress(progressPct);
        setExecutionLogs(prev => [
          ...prev,
          `[Batch ${i + 1}/${totalBatches}] Processing ${batch.length} members (${i * chunkSize + 1} - ${Math.min((i + 1) * chunkSize, allMembers.length)})...`
        ]);

        const res = await API.post('/members/migrate', {
          members: batch,
          dryRun: false,
          excelFileName: stagedFile.fileName,
          sessionId: combinedStats.sessionId
        });

        const s = res.data.stats || res.data;
        if (s) {
          combinedStats.importedMembers += (s.importedMembers || 0);
          combinedStats.skippedIdempotent += (s.skippedIdempotent || 0);
          combinedStats.duplicateMembers += (s.duplicateMembers || 0);
          combinedStats.photosImported += (s.photosImported || 0);
        }
      }

      setExecutionProgress(90);
      setExecutionLogs(prev => [...prev, '[Stage Final] Rebuilding Universal Search & Revenue Index...']);
      await API.post('/members/rebuild-analytics');

      setExecutionProgress(100);
      setReportData(combinedStats);
      setIsExecuting(false);
      fetchMembers();
      if (onMigrationComplete) onMigrationComplete();
      toast.success(`Legacy Data Auto Migration Completed! ${combinedStats.importedMembers} Members Imported 🎉`);
    } catch (err: any) {
      setIsExecuting(false);
      toast.error('Migration failed: ' + (err.response?.data?.error || err.message));
    }
  };

  return (
    <div className="space-y-6 font-poppins text-slate-800">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx,.xls"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleSelectFile(e.target.files[0]);
          }
        }}
      />

      {/* Top Banner & Auto Map Action Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-6 rounded-[28px] text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#d4ff00] text-black font-black text-[9px] uppercase tracking-widest">
              Zero-Manual Smart Auto Mapping
            </span>
            <span className="text-xs text-slate-400 font-mono">Build 2026.07</span>
          </div>
          <h2 className="text-xl font-black tracking-tight font-display">
            Legacy Data Auto Import Engine
          </h2>
          <p className="text-xs text-slate-300 max-w-xl font-medium">
            Upload file once. Automatically detects headers, parses dates/packages, checks duplicates, and builds History & Billing ledger.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-slate-900 font-black text-xs hover:bg-slate-100 transition-all cursor-pointer shadow-md border-none"
          >
            <Upload size={14} />
            <span>Upload New Excel</span>
          </button>

          <button
            onClick={handlePurgeAll}
            disabled={isPurging}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white font-extrabold text-xs hover:bg-rose-700 transition-all cursor-pointer shadow-md border-none disabled:opacity-50"
          >
            <Trash2 size={14} />
            <span>{isPurging ? 'Deleting All Data...' : 'Delete All Data'}</span>
          </button>

          {stagedFile && (
            <button
              onClick={handleAutoMapClick}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#0052FF] text-white font-extrabold text-xs hover:bg-orange-700 transition-all cursor-pointer shadow-md border-none"
            >
              <Zap size={14} />
              <span>Auto Map Legacy Data</span>
            </button>
          )}
        </div>
      </div>

      {/* PHOTO REPAIR & HEALTH REPORT TOOL */}
      <PhotoRepairTool />

      {/* STAGED MIGRATION STATUS CARD */}
      {stagedFile && (
        <div className="bg-white p-6 rounded-[28px] border border-slate-200 shadow-sm space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-4 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center font-black">
                <FileSpreadsheet size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900">{stagedFile.fileName}</h3>
                <p className="text-[11px] text-slate-400 font-medium">
                  Sheet: <span className="font-bold text-slate-700">{stagedFile.sheetName}</span> • Uploaded at {stagedFile.uploadTime}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border ${
                  processingStatus === 'completed'
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : processingStatus === 'processing'
                    ? 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse'
                    : 'bg-[#FFEDD5] text-[#9A3412] border-[#FED7AA]'
                }`}
              >
                {processingStatus === 'completed'
                  ? '🟢 Auto Mapping Complete'
                  : processingStatus === 'processing'
                  ? '🟡 Processing Auto Mapping...'
                  : '🔵 Waiting for Processing'}
              </span>
            </div>
          </div>

          {/* Metric Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200 text-center">
              <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Rows Found</span>
              <div className="text-lg font-black text-slate-900 mt-0.5">{stagedFile.totalRows}</div>
            </div>
            <div className="bg-emerald-50 p-3 rounded-2xl border border-emerald-200 text-center">
              <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Members Ready</span>
              <div className="text-lg font-black text-emerald-700 mt-0.5">{validationSummary?.membersReady || stagedFile.totalRows}</div>
            </div>
            <div className="bg-[#FFF7ED] p-3 rounded-2xl border border-[#FED7AA] text-center">
              <span className="text-[9px] font-black text-[#EA580C] uppercase tracking-wider">History Records</span>
              <div className="text-lg font-black text-[#C2410C] mt-0.5">{validationSummary?.historyRecords || stagedFile.totalRows}</div>
            </div>
            <div className="bg-purple-50 p-3 rounded-2xl border border-purple-200 text-center">
              <span className="text-[9px] font-black text-purple-600 uppercase tracking-wider">Billing Records</span>
              <div className="text-lg font-black text-purple-700 mt-0.5">{validationSummary?.billingRecords || stagedFile.totalRows}</div>
            </div>
            <div className="bg-teal-50 p-3 rounded-2xl border border-teal-200 text-center">
              <span className="text-[9px] font-black text-teal-600 uppercase tracking-wider">Photos Ready</span>
              <div className="text-lg font-black text-teal-700 mt-0.5">{validationSummary?.photosReady || 0}</div>
            </div>
            <div className="bg-amber-50 p-3 rounded-2xl border border-amber-200 text-center">
              <span className="text-[9px] font-black text-amber-600 uppercase tracking-wider">Warnings</span>
              <div className="text-lg font-black text-amber-700 mt-0.5">{rowExceptions.length}</div>
            </div>
            <div className="bg-red-50 p-3 rounded-2xl border border-red-200 text-center">
              <span className="text-[9px] font-black text-red-600 uppercase tracking-wider">Cannot Import</span>
              <div className="text-lg font-black text-red-700 mt-0.5">{validationSummary?.failedCount || 0}</div>
            </div>
          </div>

          {/* Validation Diagnostics Checklist */}
          {validationSummary && (
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs font-semibold text-slate-700">
              <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider mb-1">Auto Mapping Quality Report</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="flex items-center gap-2 text-emerald-700">
                  <CheckCircle2 size={14} />
                  <span>{validationSummary.membersReady} Profiles Validated</span>
                </div>
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle size={14} />
                  <span>{validationSummary.missingPhotoCount} Missing Member Photos</span>
                </div>
                <div className="flex items-center gap-2 text-[#C2410C]">
                  <Info size={14} />
                  <span>{validationSummary.duplicatePhoneCount} Phone Collisions (Auto Merged)</span>
                </div>
              </div>
            </div>
          )}

          {/* ROW-LEVEL EXCEPTION TABLE */}
          {rowExceptions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500" />
                Row Exception Diagnostics ({rowExceptions.length} Items Requiring Attention)
              </h4>

              <div className="overflow-x-auto rounded-xl border border-slate-200 max-h-48 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-extrabold uppercase text-[10px] sticky top-0">
                    <tr>
                      <th className="p-2.5 border-b border-slate-200">Row</th>
                      <th className="p-2.5 border-b border-slate-200">Name</th>
                      <th className="p-2.5 border-b border-slate-200">Phone</th>
                      <th className="p-2.5 border-b border-slate-200">Client ID</th>
                      <th className="p-2.5 border-b border-slate-200">Detected Issue</th>
                      <th className="p-2.5 border-b border-slate-200">Action Taken</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {rowExceptions.map((ex, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-mono font-bold text-slate-500">Row {ex.rowNumber}</td>
                        <td className="p-2.5 font-bold text-slate-900">{ex.name}</td>
                        <td className="p-2.5 font-mono">{ex.phone}</td>
                        <td className="p-2.5 font-mono">{ex.clientId}</td>
                        <td className="p-2.5">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${ex.severity === 'fatal' ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>
                            {ex.issue}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-600">{ex.action}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Trigger Row */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  localStorage.removeItem('warrior_gym_staged_import');
                  setStagedFile(null);
                  setValidationSummary(null);
                }}
                className="px-4 py-2.5 rounded-xl bg-slate-100 text-slate-600 text-xs font-bold hover:bg-slate-200 cursor-pointer border-none"
              >
                Clear Staged File
              </button>

              <button
                onClick={() => setShowPreviewModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-black shadow-md hover:bg-indigo-700 transition-all cursor-pointer border-none"
              >
                <Eye size={15} />
                <span>Preview Recorded Columns & Data</span>
              </button>
            </div>

            <button
              onClick={handleExecuteMigration}
              disabled={isExecuting || processingStatus !== 'completed'}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-xl bg-emerald-600 text-white text-xs font-black shadow-lg hover:bg-emerald-700 transition-all cursor-pointer border-none disabled:opacity-50"
            >
              {isExecuting ? <RefreshCw size={16} className="animate-spin" /> : <Zap size={16} />}
              <span>Start Production Migration ({validationSummary?.membersReady || stagedFile.totalRows} Members)</span>
            </button>
          </div>
        </div>
      )}

      {/* PREVIEW MODAL FOR EXCEL PARSED COLUMNS & DATA */}
      <AnimatePresence>
        {showPreviewModal && stagedFile && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[28px] max-w-5xl w-full max-h-[90vh] overflow-hidden shadow-2xl flex flex-col border border-slate-200"
            >
              {/* Modal Header */}
              <div className="bg-slate-900 text-white p-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-600 rounded-2xl text-white">
                    <Eye size={22} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black tracking-tight font-display">System Parsed Data & Column Mapping Preview</h3>
                    <p className="text-xs text-slate-300 font-mono">File: {stagedFile.fileName} • Sheet: {stagedFile.sheetName} • Total Rows: {stagedFile.totalRows}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-all cursor-pointer border-none"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
                {/* Detected Columns Grid */}
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider mb-3 flex items-center gap-2">
                    <Cpu size={14} className="text-indigo-600" /> Detected Header Mapping ({stagedFile.headers.length} Columns)
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    {stagedFile.headers.map((h, i) => {
                      const mappedField = stagedFile.columnMap[i] || 'unmapped';
                      return (
                        <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-between gap-1 shadow-sm">
                          <span className="font-black text-slate-800 text-[11px] truncate" title={h}>{h}</span>
                          <div className="flex items-center justify-between mt-1">
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                              mappedField !== 'unmapped' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-amber-100 text-amber-700 border border-amber-200'
                            }`}>
                              {mappedField}
                            </span>
                            {mappedField !== 'unmapped' ? (
                              <CheckCircle2 size={13} className="text-emerald-500" />
                            ) : (
                              <span className="text-[9px] text-slate-400">Raw Header</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Parsed Rows Search & Table */}
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <h4 className="text-xs font-black uppercase text-slate-500 tracking-wider flex items-center gap-2">
                      <FileSpreadsheet size={14} className="text-indigo-600" /> Parsed Staged Payload Preview ({stagedFile.payload.length} Records)
                    </h4>
                    <div className="relative w-72">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Search preview by name, phone, amount..."
                        value={previewSearch}
                        onChange={(e) => setPreviewSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-x-auto max-h-[380px] shadow-inner">
                    <table className="w-full text-left text-xs whitespace-nowrap">
                      <thead className="bg-slate-900 text-white font-bold sticky top-0">
                        <tr>
                          <th className="px-3 py-2.5 text-center">#</th>
                          <th className="px-3 py-2.5">Client ID</th>
                          <th className="px-3 py-2.5">Name</th>
                          <th className="px-3 py-2.5">Phone</th>
                          <th className="px-3 py-2.5">Gender</th>
                          <th className="px-3 py-2.5">Package</th>
                          <th className="px-3 py-2.5">Reg Date</th>
                          <th className="px-3 py-2.5">Expiry Date</th>
                          <th className="px-3 py-2.5 text-amber-300">Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {stagedFile.payload
                          .filter(r => {
                            if (!previewSearch.trim()) return true;
                            const query = previewSearch.toLowerCase();
                            return (
                              (r.name || '').toLowerCase().includes(query) ||
                              (r.phone || '').includes(query) ||
                              (r.clientId || '').toLowerCase().includes(query) ||
                              (r.amount || r.Amount || '').toLowerCase().includes(query) ||
                              (r.membershipPackage || r.Package || '').toLowerCase().includes(query)
                            );
                          })
                          .slice(0, 50)
                          .map((row, idx) => {
                            const amt = row.amount || row.Amount || row.Fee || row.Price || '0';
                            return (
                              <tr key={idx} className="hover:bg-indigo-50/50 transition-colors">
                                <td className="px-3 py-2 text-center text-slate-400 font-mono text-[10px]">{idx + 1}</td>
                                <td className="px-3 py-2 font-mono font-bold text-slate-700">{row.clientId || row['Client ID'] || 'N/A'}</td>
                                <td className="px-3 py-2 font-extrabold text-slate-900">{row.name || row['Client Name'] || 'Unknown'}</td>
                                <td className="px-3 py-2 font-mono text-slate-600">{row.phone || row.Number || 'N/A'}</td>
                                <td className="px-3 py-2 capitalize">{row.gender || row.Gender || 'N/A'}</td>
                                <td className="px-3 py-2">
                                  <span className="px-2 py-0.5 rounded-full bg-[#FFF7ED] text-[#C2410C] font-bold text-[10px]">
                                    {row.membershipPackage || row.Package || 'N/A'}
                                  </span>
                                </td>
                                <td className="px-3 py-2 font-mono text-slate-500">{row.registrationDate || row.Registration || 'N/A'}</td>
                                <td className="px-3 py-2 font-mono text-slate-500">{row.membershipExpiry || row.Expiration || 'N/A'}</td>
                                <td className="px-3 py-2 font-mono font-black text-emerald-600 bg-emerald-50/40">
                                  ₹{amt}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">Showing up to 50 preview records</span>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-black transition-all cursor-pointer border-none"
                >
                  Close Preview
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* POST MIGRATION REPORT & DOWNLOADS */}
      {reportData && (
        <div className="bg-white p-6 rounded-[28px] border border-emerald-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2 text-emerald-800 font-black text-sm">
              <CheckCircle2 size={20} className="text-emerald-600" />
              <span>Migration Report Summary</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `migration_report_${reportData.sessionId || 'summary'}.json`;
                  a.click();
                  toast.success('Downloaded Migration Report!');
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200 cursor-pointer border-none"
              >
                <Download size={13} />
                <span>Download Report</span>
              </button>
              <button
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-bold cursor-pointer border-none"
              >
                <Printer size={13} />
                <span>Print PDF</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center text-xs">
            <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200">
              <span className="text-[9px] font-black text-emerald-600 uppercase">Imported</span>
              <div className="text-lg font-black text-emerald-700">{reportData.importedMembers || 0}</div>
            </div>
            <div className="bg-[#FFF7ED] p-3 rounded-xl border border-[#FED7AA]">
              <span className="text-[9px] font-black text-[#EA580C] uppercase">Skipped (Idempotent)</span>
              <div className="text-lg font-black text-[#C2410C]">{reportData.skippedIdempotent || 0}</div>
            </div>
            <div className="bg-amber-50 p-3 rounded-xl border border-amber-200">
              <span className="text-[9px] font-black text-amber-600 uppercase">Merged Conflicts</span>
              <div className="text-lg font-black text-amber-700">{reportData.duplicateMembers || 0}</div>
            </div>
            <div className="bg-purple-50 p-3 rounded-xl border border-purple-200">
              <span className="text-[9px] font-black text-purple-600 uppercase">Invoices Created</span>
              <div className="text-lg font-black text-purple-700">{reportData.totalRows || 0}</div>
            </div>
            <div className="bg-teal-50 p-3 rounded-xl border border-teal-200">
              <span className="text-[9px] font-black text-teal-600 uppercase">Photos Uploaded</span>
              <div className="text-lg font-black text-teal-700">{reportData.photosImported || 0}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
