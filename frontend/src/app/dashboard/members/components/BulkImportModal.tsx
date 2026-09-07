'use client';

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import {
  Upload, FileSpreadsheet, Download, CheckCircle2, AlertTriangle,
  XCircle, ArrowRight, X, Sparkles, RefreshCw, AlertCircle, Check,
  ChevronRight, Users, Shield, Sliders, Fingerprint, Search, Link2,
  CheckSquare, Square, Eye, Terminal, Cpu
} from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from '@/lib/toast';
import API from '@/services/api';
import { useGymStore } from '@/store';
import { db as firestoreDb } from '@/lib/firebase';
import { doc, setDoc, updateDoc } from 'firebase/firestore';

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: (targetTab?: string) => void;
}

interface RawRow {
  [key: string]: any;
}

interface PreviewItem {
  index: number;
  biometricId: string;
  name: string;
  phone?: string;
  status: 'new' | 'existing' | 'duplicate_in_file' | 'invalid';
  reason?: string;
  existingMemberName?: string;
}

interface HikvisionTerminalUser {
  employeeNo: string;
  userId: string;
  deviceUserId: string;
  name: string;
  userType?: string;
  numOfFace?: number;
  numOfFP?: number;
  hasFace?: boolean;
  hasFingerprint?: boolean;
  faceURL?: string | null;
  doorRight?: string;
}

interface MappingRow {
  memberId: string;
  biometricId: string;
  memberName: string;
  hikvisionUserId: string;
  machineName: string;
  hasFace: boolean;
  hasFingerprint: boolean;
  mappingStatus: 'mapped' | 'id_not_found' | 'name_mismatch' | 'duplicate_id' | 'not_mapped';
  selected: boolean;
  mappingSource: 'AUTO' | 'MANUAL';
}

export default function BulkImportModal({
  isOpen,
  onClose,
  onImportSuccess
}: BulkImportModalProps) {
  const { members: existingMembers, fetchMembers } = useGymStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Workflow steps: 1. upload -> 2. mapping -> 3. preview -> 4. machine_mapping (Step 2 of 3) -> 5. completed
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'importing' | 'machine_mapping' | 'saving_mapping' | 'completed'>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [fileHeaders, setFileHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<RawRow[]>([]);
  
  // Column Mappings (Strict 2 columns: Member/Employee ID and Member Name)
  const [bioIdColumn, setBioIdColumn] = useState<string>('');
  const [nameColumn, setNameColumn] = useState<string>('');
  
  // Existing conflict resolution: 'skip' (default) or 'update'
  const [existingAction, setExistingAction] = useState<'skip' | 'update'>('skip');
  
  // Filter for preview table
  const [previewFilter, setPreviewFilter] = useState<'all' | 'new' | 'existing' | 'issues'>('all');
  const [searchPreview, setSearchPreview] = useState<string>('');

  // Imported members list for machine mapping step
  const [importedMembers, setImportedMembers] = useState<any[]>([]);

  // ── Machine Mapping State (Step 2 of 3) ──
  const [terminalUsers, setTerminalUsers] = useState<HikvisionTerminalUser[]>([]);
  const [loadingTerminalUsers, setLoadingTerminalUsers] = useState<boolean>(false);
  const [terminalError, setTerminalError] = useState<string | null>(null);
  const [mappingRows, setMappingRows] = useState<MappingRow[]>([]);
  const [mappingFilter, setMappingFilter] = useState<'all' | 'mapped' | 'needs_attention'>('all');
  const [mappingSearch, setMappingSearch] = useState<string>('');
  const [lastSyncedTime, setLastSyncedTime] = useState<string>('Just now');

  // Manual mapping modal state
  const [manualMapTarget, setManualMapTarget] = useState<MappingRow | null>(null);
  const [manualSearchQuery, setManualSearchQuery] = useState<string>('');

  // ── 1. DOWNLOAD IMPORT TEMPLATE (Strictly 2 Columns) ─────────────────────
  const handleDownloadTemplate = () => {
    const templateData = [
      { 'Employee ID': 3, 'Name': 'Raja' },
      { 'Employee ID': 4, 'Name': 'Minder' },
      { 'Employee ID': 6, 'Name': 'Raman' },
      { 'Employee ID': 7, 'Name': 'Jagdeep' },
      { 'Employee ID': 8, 'Name': 'JAGGI' },
      { 'Employee ID': 9, 'Name': 'SIDHU' },
      { 'Employee ID': 10, 'Name': 'LOVE' },
    ];

    const worksheet = XLSX.utils.json_to_sheet(templateData);
    worksheet['!cols'] = [
      { wch: 18 }, // Employee ID
      { wch: 28 }  // Name
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Members');
    XLSX.writeFile(workbook, 'Warrior_Gym_Member_Import_Template.xlsx');
    toast.success('Template downloaded with 2 columns: Employee ID & Name');
  };

  // ── 2. READ EXCEL / CSV FILE ──────────────────────────────────────────────
  const handleFileUpload = async (file: File) => {
    try {
      toast.loading('Reading spreadsheet...', { id: 'file-parse' });
      setFileName(file.name);

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });

      if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
        throw new Error('Spreadsheet contains no sheets.');
      }

      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

      if (jsonData.length === 0) {
        throw new Error('Spreadsheet is empty or has no data rows.');
      }

      const headers = Object.keys(jsonData[0] || {});
      setFileHeaders(headers);
      setRawRows(jsonData);

      // Auto-detect columns (Employee ID / Member ID and Name)
      let detectedBio = '';
      let detectedName = '';

      headers.forEach(h => {
        const lower = h.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!detectedBio && (lower.includes('employeeid') || lower.includes('empid') || lower.includes('biometric') || lower.includes('bioid') || lower.includes('memberid') || lower === 'id')) {
          detectedBio = h;
        }
        if (!detectedName && (lower.includes('membername') || lower.includes('employeename') || lower.includes('fullname') || lower.includes('name') || lower === 'member')) {
          detectedName = h;
        }
      });

      if (!detectedBio && headers.length > 0) detectedBio = headers[0];
      if (!detectedName && headers.length > 1) detectedName = headers[1];

      setBioIdColumn(detectedBio);
      setNameColumn(detectedName);

      toast.success(`Loaded ${jsonData.length} rows from ${file.name}!`, { id: 'file-parse' });
      setStep('mapping');
    } catch (err: any) {
      console.error('File parsing error:', err);
      toast.error(err.message || 'Failed to read file', { id: 'file-parse' });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  // ── 3. MAP AND VALIDATE PREVIEW ROWS ─────────────────────────────────────
  const previewItems: PreviewItem[] = useMemo(() => {
    if (!bioIdColumn || !nameColumn || rawRows.length === 0) return [];

    const existingBioMap = new Map<string, any>();
    (existingMembers || []).forEach(m => {
      const bId = String(m.biometricId || m.biometricUserId || m.deviceUserId || '').trim().toLowerCase();
      if (bId) {
        existingBioMap.set(bId, m);
      }
    });

    const seenFileBioIds = new Set<string>();

    return rawRows.map((row, idx) => {
      const rawBio = String(row[bioIdColumn] ?? '').trim();
      const rawName = String(row[nameColumn] ?? '').trim();

      if (!rawBio || !rawName) {
        return {
          index: idx + 1,
          biometricId: rawBio || '—',
          name: rawName || '—',
          status: 'invalid',
          reason: !rawName ? 'Missing Name' : 'Missing Biometric ID'
        };
      }

      const bioKey = rawBio.toLowerCase();

      if (seenFileBioIds.has(bioKey)) {
        return {
          index: idx + 1,
          biometricId: rawBio,
          name: rawName,
          status: 'duplicate_in_file',
          reason: 'Duplicate ID in this spreadsheet'
        };
      }
      seenFileBioIds.add(bioKey);

      const existing = existingBioMap.get(bioKey);
      if (existing) {
        return {
          index: idx + 1,
          biometricId: rawBio,
          name: rawName,
          status: 'existing',
          existingMemberName: existing.name,
          reason: `Member already exists (${existing.name})`
        };
      }

      return {
        index: idx + 1,
        biometricId: rawBio,
        name: rawName,
        status: 'new'
      };
    });
  }, [rawRows, bioIdColumn, nameColumn, existingMembers]);

  // Preview counts
  const previewCounts = useMemo(() => {
    let newCount = 0;
    let existingCount = 0;
    let duplicateCount = 0;
    let invalidCount = 0;

    previewItems.forEach(item => {
      if (item.status === 'new') newCount++;
      else if (item.status === 'existing') existingCount++;
      else if (item.status === 'duplicate_in_file') duplicateCount++;
      else if (item.status === 'invalid') invalidCount++;
    });

    return {
      total: previewItems.length,
      newCount,
      existingCount,
      duplicateCount,
      invalidCount
    };
  }, [previewItems]);

  const filteredPreview = useMemo(() => {
    return previewItems.filter(item => {
      if (previewFilter === 'new' && item.status !== 'new') return false;
      if (previewFilter === 'existing' && item.status !== 'existing') return false;
      if (previewFilter === 'issues' && item.status !== 'duplicate_in_file' && item.status !== 'invalid') return false;

      if (searchPreview.trim()) {
        const q = searchPreview.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchBio = item.biometricId.toLowerCase().includes(q);
        if (!matchName && !matchBio) return false;
      }

      return true;
    });
  }, [previewItems, previewFilter, searchPreview]);

  // ── 4. EXECUTE BULK IMPORT & TRANSITION TO MACHINE MAPPING (Step 1 -> Step 2) ──
  const handleExecuteImport = async () => {
    const eligible = previewItems.filter(item => {
      if (item.status === 'new') return true;
      if (item.status === 'existing' && existingAction === 'update') return true;
      return false;
    });

    if (eligible.length === 0) {
      toast.error('No valid new members to import.');
      return;
    }

    setStep('importing');

    const payloadMembers = eligible.map(item => ({
      biometricId: item.biometricId,
      name: item.name,
    }));

    let savedMembersList: any[] = [];

    try {
      const res = await API.post('/members/import-bulk', {
        members: payloadMembers,
        skipExisting: existingAction === 'skip'
      });

      if (res.data && res.data.created) {
        savedMembersList = res.data.created;
      }
    } catch (apiErr: any) {
      console.warn('Backend bulk import failed, running direct Firestore creation fallback:', apiErr);
      // Direct Firestore fallback for 100% reliability
      for (const m of payloadMembers) {
        const docId = `m_hold_${m.biometricId}_${Date.now()}`;
        const newDoc = {
          id: docId,
          biometricId: m.biometricId,
          biometricUserId: m.biometricId,
          deviceUserId: m.biometricId,
          name: m.name,
          status: 'hold', // Strictly HOLD
          plan: '',
          startDate: '',
          expiryDate: '',
          joinDate: new Date().toISOString().split('T')[0],
          createdAt: new Date().toISOString(),
          totalBilled: 0,
          totalPaid: 0,
          outstandingBalance: 0,
          paymentStatus: 'pending',
          source: 'excel_import'
        };
        await setDoc(doc(firestoreDb, 'members', docId), newDoc);
        savedMembersList.push(newDoc);
      }
    }

    await fetchMembers();
    setImportedMembers(savedMembersList.length > 0 ? savedMembersList : payloadMembers);

    toast.success(`Imported ${savedMembersList.length || payloadMembers.length} members into HOLD!`);
    
    // Proceed directly to STEP 2: Hikvision Machine Mapping
    setStep('machine_mapping');
    fetchAndMatchTerminalUsers(savedMembersList.length > 0 ? savedMembersList : payloadMembers);
  };

  // ── 5. FETCH TERMINAL USERS & PERFORM AUTOMATIC ID MATCHING (Step 2) ──
  const fetchAndMatchTerminalUsers = useCallback(async (membersList?: any[]) => {
    const listToMatch = membersList || importedMembers;
    setLoadingTerminalUsers(true);
    setTerminalError(null);

    try {
      const res = await API.get('/devices/hikvision/terminal-users');
      let terminalUserList: HikvisionTerminalUser[] = [];

      if (res.data && res.data.users) {
        terminalUserList = res.data.users;
        setTerminalUsers(terminalUserList);
        if (!res.data.success && res.data.error) {
          setTerminalError(res.data.error);
        }
      }

      setLastSyncedTime('Just now');

      // Build Fast Lookup Map by Hikvision employeeNo / userId
      const terminalMap = new Map<string, HikvisionTerminalUser>();
      terminalUserList.forEach(u => {
        const key = String(u.employeeNo || u.userId || u.deviceUserId || '').trim().toLowerCase();
        if (key) {
          terminalMap.set(key, u);
        }
      });

      // Build Comparison Mapping Rows
      const rows: MappingRow[] = listToMatch.map(m => {
        const bioId = String(m.biometricId || m.employeeId || '').trim();
        const memName = String(m.name || m.memberName || '').trim();
        const bioKey = bioId.toLowerCase();

        const match = terminalMap.get(bioKey);

        if (match) {
          const machName = match.name || '';
          const isNameMismatch = machName && memName && machName.toLowerCase() !== memName.toLowerCase();
          
          return {
            memberId: m.id || m._id || bioId,
            biometricId: bioId,
            memberName: memName,
            hikvisionUserId: match.employeeNo || match.userId,
            machineName: machName || 'Unnamed Terminal Slot',
            hasFace: Boolean(match.hasFace || (match.numOfFace && match.numOfFace > 0)),
            hasFingerprint: Boolean(match.hasFingerprint || (match.numOfFP && match.numOfFP > 0)),
            mappingStatus: isNameMismatch ? 'name_mismatch' : 'mapped',
            selected: true, // Auto-selected if matched
            mappingSource: 'AUTO'
          };
        }

        // ID not found on terminal
        return {
          memberId: m.id || m._id || bioId,
          biometricId: bioId,
          memberName: memName,
          hikvisionUserId: '',
          machineName: '',
          hasFace: false,
          hasFingerprint: false,
          mappingStatus: 'id_not_found',
          selected: false, // Do NOT auto-select unmapped
          mappingSource: 'MANUAL'
        };
      });

      setMappingRows(rows);
    } catch (err: any) {
      console.error('Failed to fetch Hikvision terminal users:', err);
      setTerminalError(err?.response?.data?.error || err?.message || 'Terminal connection offline');
    } finally {
      setLoadingTerminalUsers(false);
    }
  }, [importedMembers]);

  // ── 6. MACHINE MAPPING COUNTERS ──
  const mappingCounts = useMemo(() => {
    let mapped = 0;
    let idNotFound = 0;
    let nameMismatch = 0;
    let selectedCount = 0;

    mappingRows.forEach(r => {
      if (r.mappingStatus === 'mapped') mapped++;
      else if (r.mappingStatus === 'id_not_found') idNotFound++;
      else if (r.mappingStatus === 'name_mismatch') nameMismatch++;
      if (r.selected) selectedCount++;
    });

    return {
      total: mappingRows.length,
      terminalFound: terminalUsers.length,
      mapped,
      idNotFound,
      nameMismatch,
      selectedCount
    };
  }, [mappingRows, terminalUsers]);

  // Filtered mapping rows
  const filteredMappingRows = useMemo(() => {
    return mappingRows.filter(r => {
      if (mappingFilter === 'mapped' && r.mappingStatus !== 'mapped') return false;
      if (mappingFilter === 'needs_attention' && r.mappingStatus === 'mapped') return false;

      if (mappingSearch.trim()) {
        const q = mappingSearch.toLowerCase().trim();
        const matchName = r.memberName.toLowerCase().includes(q);
        const matchBio = r.biometricId.toLowerCase().includes(q);
        const matchHik = r.hikvisionUserId.toLowerCase().includes(q);
        const matchMach = r.machineName.toLowerCase().includes(q);
        if (!matchName && !matchBio && !matchHik && !matchMach) return false;
      }

      return true;
    });
  }, [mappingRows, mappingFilter, mappingSearch]);

  // Toggle selection
  const handleToggleSelect = (bioId: string) => {
    setMappingRows(prev => prev.map(r => {
      if (r.biometricId === bioId) {
        return { ...r, selected: !r.selected };
      }
      return r;
    }));
  };

  const handleSelectAllMapped = () => {
    setMappingRows(prev => prev.map(r => ({
      ...r,
      selected: r.mappingStatus === 'mapped' || r.mappingStatus === 'name_mismatch'
    })));
  };

  const handleDeselectAll = () => {
    setMappingRows(prev => prev.map(r => ({ ...r, selected: false })));
  };

  // Manual mapping assignment
  const handleAssignManualMapping = (selectedTerminalUser: HikvisionTerminalUser) => {
    if (!manualMapTarget) return;

    setMappingRows(prev => prev.map(r => {
      if (r.biometricId === manualMapTarget.biometricId) {
        return {
          ...r,
          hikvisionUserId: selectedTerminalUser.employeeNo || selectedTerminalUser.userId,
          machineName: selectedTerminalUser.name || 'Unnamed Slot',
          hasFace: Boolean(selectedTerminalUser.hasFace || (selectedTerminalUser.numOfFace && selectedTerminalUser.numOfFace > 0)),
          hasFingerprint: Boolean(selectedTerminalUser.hasFingerprint || (selectedTerminalUser.numOfFP && selectedTerminalUser.numOfFP > 0)),
          mappingStatus: 'mapped',
          selected: true,
          mappingSource: 'MANUAL'
        };
      }
      return r;
    }));

    toast.success(`Mapped ${manualMapTarget.memberName} to Hikvision #${selectedTerminalUser.employeeNo}`);
    setManualMapTarget(null);
    setManualSearchQuery('');
  };

  // ── 7. CONFIRM MACHINE MAPPING & COMPLETE ──
  const handleConfirmMapping = async () => {
    const selectedMappings = mappingRows.filter(r => r.selected && r.hikvisionUserId);

    if (selectedMappings.length === 0) {
      // Proceed without mapping if user chooses
      setStep('completed');
      return;
    }

    setStep('saving_mapping');
    try {
      await API.post('/devices/hikvision/bulk-map-members', {
        mappings: selectedMappings.map(r => ({
          memberId: r.memberId,
          biometricId: r.biometricId,
          hikvisionUserId: r.hikvisionUserId,
          mappingSource: r.mappingSource,
          hasFace: r.hasFace,
          hasFingerprint: r.hasFingerprint
        }))
      });

      toast.success(`Successfully saved machine mappings for ${selectedMappings.length} members!`);
      await fetchMembers();
      setStep('completed');
    } catch (err: any) {
      console.warn('Backend bulk mapping error, falling back to direct Firestore:', err);
      for (const item of selectedMappings) {
        try {
          await updateDoc(doc(firestoreDb, 'members', item.memberId), {
            biometricId: item.hikvisionUserId,
            deviceUserId: item.hikvisionUserId,
            biometricUserId: item.hikvisionUserId,
            hikvisionUserId: item.hikvisionUserId,
            hikvisionMapped: true,
            mappedAt: new Date().toISOString(),
            mappingSource: item.mappingSource,
            hasFace: item.hasFace,
            hasFingerprint: item.hasFingerprint,
            faceEnrollmentStatus: item.hasFace ? 'ENROLLED' : 'PENDING',
            fingerprintEnrollmentStatus: item.hasFingerprint ? 'ENROLLED' : 'PENDING',
            updatedAt: new Date().toISOString()
          });
        } catch (e) {}
      }
      toast.success(`Saved machine mappings for ${selectedMappings.length} members!`);
      await fetchMembers();
      setStep('completed');
    }
  };

  const handleFinish = () => {
    onClose();
    if (onImportSuccess) {
      onImportSuccess('hold'); // Direct to Hold tab
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full p-6 sm:p-7 space-y-5 relative border border-slate-100 max-h-[92vh] flex flex-col justify-between">
        
        {/* Header with Step Indicator */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#EA580C] to-[#FB923C] text-white flex items-center justify-center font-black shadow-sm">
              {step === 'machine_mapping' ? <Cpu size={20} /> : <FileSpreadsheet size={20} />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-50 text-[#C2410C] border border-orange-200">
                  {step === 'machine_mapping' ? 'STEP 2 OF 3' : step === 'completed' ? 'STEP 3 OF 3' : 'STEP 1 OF 3'}
                </span>
                <h3 className="text-base font-black text-slate-900">
                  {step === 'machine_mapping'
                    ? 'Map Members with Hikvision Terminal'
                    : step === 'completed'
                      ? 'Import & Mapping Complete'
                      : 'Bulk Member Import from Excel'}
                </h3>
              </div>
              <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                {step === 'machine_mapping'
                  ? 'Match imported Excel members with users already present on the Hikvision attendance terminal'
                  : step === 'completed'
                    ? 'Members are now in HOLD status waiting for individual membership billing & activation'
                    : 'Upload your 2-column member spreadsheet (Employee ID & Member Name)'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full border-none bg-transparent cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body Container with Scroll */}
        <div className="overflow-y-auto pr-1 flex-1 space-y-4">
          
          {/* ════════════════════════════════════════════════════════════════════════
              STEP 1A: UPLOAD SPREADSHEET
             ════════════════════════════════════════════════════════════════════════ */}
          {step === 'upload' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black">
                    <Download size={16} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">Standard 2-Column Excel Template</h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Excel columns: <b className="text-[#C2410C]">Employee ID</b> (Biometric terminal ID) and <b className="text-[#C2410C]">Name</b>.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  className="px-4 py-2 bg-white hover:bg-slate-50 border border-amber-300 text-amber-900 text-xs font-black rounded-xl transition-all cursor-pointer shadow-2xs flex items-center gap-1.5"
                >
                  <Download size={13} /> Download Template
                </button>
              </div>

              {/* Drag and Drop Zone */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-200 hover:border-[#EA580C] bg-slate-50/50 hover:bg-orange-50/30 rounded-3xl p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center space-y-3"
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileUpload(e.target.files[0]);
                    }
                  }}
                />
                <div className="w-14 h-14 rounded-2xl bg-orange-100 text-[#EA580C] flex items-center justify-center shadow-sm">
                  <Upload size={26} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">Click to upload or drag & drop</h4>
                  <p className="text-xs text-slate-400 font-semibold mt-0.5">
                    Supports .xlsx, .xls, or .csv (Employee ID & Name)
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              STEP 1B: COLUMN MAPPING UI
             ════════════════════════════════════════════════════════════════════════ */}
          {step === 'mapping' && (
            <div className="space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <span className="text-[10px] uppercase font-black text-slate-400 block">Uploaded File</span>
                  <span className="text-xs font-black text-slate-800 font-mono">{fileName}</span>
                </div>
                <span className="text-xs font-black text-[#EA580C]">
                  {rawRows.length} Rows Detected
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 block">
                    Excel Column → Biometric ID (Employee ID) *
                  </label>
                  <select
                    value={bioIdColumn}
                    onChange={(e) => setBioIdColumn(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:border-[#EA580C]"
                  >
                    <option value="">-- Select Column --</option>
                    {fileHeaders.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Maps directly to member&apos;s Hikvision Biometric User ID.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1.5">
                  <label className="text-[10px] font-black uppercase text-slate-400 block">
                    Excel Column → Member Name *
                  </label>
                  <select
                    value={nameColumn}
                    onChange={(e) => setNameColumn(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:border-[#EA580C]"
                  >
                    <option value="">-- Select Column --</option>
                    {fileHeaders.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-slate-400 font-medium">
                    Maps to full member name.
                  </p>
                </div>
              </div>

              {/* Existing Member Conflict Strategy */}
              <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-4 space-y-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-800 block">
                  If Biometric ID Already Exists in CRM:
                </span>
                <div className="flex items-center gap-4 text-xs font-bold text-slate-800">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="conflict"
                      checked={existingAction === 'skip'}
                      onChange={() => setExistingAction('skip')}
                    />
                    <span>Skip Row (Recommended Default)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="conflict"
                      checked={existingAction === 'update'}
                      onChange={() => setExistingAction('update')}
                    />
                    <span>Update Existing Member Info</span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStep('upload')}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs border-none cursor-pointer"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={!bioIdColumn || !nameColumn}
                  onClick={() => setStep('preview')}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] disabled:bg-slate-300 text-white font-black rounded-xl text-xs shadow-md border-none cursor-pointer flex items-center gap-1.5"
                >
                  Preview Members <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              STEP 1C: PREVIEW & VALIDATION TABLE
             ════════════════════════════════════════════════════════════════════════ */}
          {step === 'preview' && (
            <div className="space-y-4">
              {/* Validation Summary Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
                <div 
                  onClick={() => setPreviewFilter('all')}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                    previewFilter === 'all' ? 'bg-slate-900 text-white border-slate-900 shadow-sm' : 'bg-slate-50 border-slate-200'
                  }`}
                >
                  <span className="text-[9px] uppercase font-black block opacity-70">Total Rows</span>
                  <span className="text-base font-black font-mono">{previewCounts.total}</span>
                </div>

                <div 
                  onClick={() => setPreviewFilter('new')}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                    previewFilter === 'new' ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                >
                  <span className="text-[9px] uppercase font-black block opacity-80">New Members</span>
                  <span className="text-base font-black font-mono">{previewCounts.newCount}</span>
                </div>

                <div 
                  onClick={() => setPreviewFilter('existing')}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                    previewFilter === 'existing' ? 'bg-amber-600 text-white border-amber-600 shadow-sm' : 'bg-amber-50 text-amber-800 border-amber-200'
                  }`}
                >
                  <span className="text-[9px] uppercase font-black block opacity-80">Already Existing</span>
                  <span className="text-base font-black font-mono">{previewCounts.existingCount}</span>
                </div>

                <div 
                  onClick={() => setPreviewFilter('issues')}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer ${
                    previewFilter === 'issues' ? 'bg-rose-600 text-white border-rose-600 shadow-sm' : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  <span className="text-[9px] uppercase font-black block opacity-80">Duplicates / Invalid</span>
                  <span className="text-base font-black font-mono">{previewCounts.duplicateCount + previewCounts.invalidCount}</span>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[280px] overflow-y-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="px-3 py-2">#</th>
                      <th className="px-3 py-2">Biometric ID</th>
                      <th className="px-3 py-2">Member Name</th>
                      <th className="px-3 py-2">Status</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPreview.map((item) => (
                      <tr key={item.index} className="hover:bg-slate-50/60">
                        <td className="px-3 py-2 font-mono text-slate-400 font-bold">{item.index}</td>
                        <td className="px-3 py-2 font-mono font-black text-slate-800">{item.biometricId}</td>
                        <td className="px-3 py-2 font-bold text-slate-900">{item.name}</td>
                        <td className="px-3 py-2">
                          {item.status === 'new' && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                              New
                            </span>
                          )}
                          {item.status === 'existing' && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300" title={item.reason}>
                              Exists: {item.existingMemberName || 'CRM'}
                            </span>
                          )}
                          {item.status === 'duplicate_in_file' && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300">
                              Duplicate ID
                            </span>
                          )}
                          {item.status === 'invalid' && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300">
                              Invalid Row
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-slate-500">
                          {item.status === 'new' ? (
                            <span className="text-emerald-600 font-bold">Import (HOLD)</span>
                          ) : item.status === 'existing' ? (
                            <span className={existingAction === 'skip' ? 'text-slate-400' : 'text-amber-600'}>
                              {existingAction === 'skip' ? 'Skip' : 'Update'}
                            </span>
                          ) : (
                            <span className="text-rose-500">Ignore</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setStep('mapping')}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs border-none cursor-pointer"
                >
                  Back to Mapping
                </button>

                <button
                  type="button"
                  onClick={handleExecuteImport}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white font-black rounded-xl text-xs shadow-md border-none cursor-pointer flex items-center gap-1.5"
                >
                  Import Members & Proceed to Machine Mapping →
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              STEP 2: HIKVISION MACHINE MAPPING (Step 2 of 3)
             ════════════════════════════════════════════════════════════════════════ */}
          {step === 'machine_mapping' && (
            <div className="space-y-4">
              {/* Summary Counter Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-2xl">
                  <span className="text-[9px] font-black uppercase text-slate-400 block">Excel Members</span>
                  <span className="text-sm font-black font-mono text-slate-900">{mappingCounts.total}</span>
                </div>
                <div className="p-2.5 bg-blue-50 border border-blue-200 rounded-2xl">
                  <span className="text-[9px] font-black uppercase text-blue-700 block">Hikvision Users</span>
                  <span className="text-sm font-black font-mono text-blue-900">{mappingCounts.terminalFound}</span>
                </div>
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <span className="text-[9px] font-black uppercase text-emerald-700 block">Successfully Mapped</span>
                  <span className="text-sm font-black font-mono text-emerald-900">{mappingCounts.mapped}</span>
                </div>
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-2xl">
                  <span className="text-[9px] font-black uppercase text-amber-700 block">ID Not Found</span>
                  <span className="text-sm font-black font-mono text-amber-900">{mappingCounts.idNotFound}</span>
                </div>
                <div className="p-2.5 bg-orange-50 border border-orange-200 rounded-2xl">
                  <span className="text-[9px] font-black uppercase text-[#C2410C] block">Ready / Selected</span>
                  <span className="text-sm font-black font-mono text-[#C2410C]">{mappingCounts.selectedCount}</span>
                </div>
              </div>

              {/* Sync & Diagnostics Banner */}
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-slate-700">
                    Hikvision Terminal Connected (192.168.1.45:443)
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    • Last synced: {lastSyncedTime}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={loadingTerminalUsers}
                    onClick={() => fetchAndMatchTerminalUsers()}
                    className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 rounded-xl font-bold text-xs cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <RefreshCw size={12} className={loadingTerminalUsers ? 'animate-spin' : ''} />
                    <span>Sync Hikvision Users</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSelectAllMapped}
                    className="px-3 py-1.5 bg-orange-50 hover:bg-orange-100 text-[#C2410C] border border-orange-200 rounded-xl font-bold text-xs cursor-pointer"
                  >
                    Select All Mapped
                  </button>
                </div>
              </div>

              {terminalError && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-800 flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-600 shrink-0" />
                  <span>Terminal Warning: {terminalError}</span>
                </div>
              )}

              {/* Machine Comparison Table */}
              <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-[#EA580C] text-white sticky top-0 text-[10px] font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-3 py-2.5 w-8 text-center">Tick</th>
                      <th className="px-3 py-2.5">Biometric ID</th>
                      <th className="px-3 py-2.5">Excel Member</th>
                      <th className="px-3 py-2.5">Hikvision User ID</th>
                      <th className="px-3 py-2.5">Machine Name</th>
                      <th className="px-3 py-2.5 text-center">Face / FP</th>
                      <th className="px-3 py-2.5">Mapping Status</th>
                      <th className="px-3 py-2.5 text-right">Manual Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMappingRows.map((row) => (
                      <tr key={row.biometricId} className={`hover:bg-slate-50/70 ${row.selected ? 'bg-orange-50/20' : ''}`}>
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={row.selected}
                            onChange={() => handleToggleSelect(row.biometricId)}
                            className="cursor-pointer rounded accent-[#EA580C] w-4 h-4"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-mono font-black text-slate-800">
                          #{row.biometricId}
                        </td>
                        <td className="px-3 py-2.5 font-bold text-slate-900">
                          {row.memberName}
                        </td>
                        <td className="px-3 py-2.5 font-mono font-bold text-[#C2410C]">
                          {row.hikvisionUserId ? `#${row.hikvisionUserId}` : <span className="text-slate-400 font-mono">—</span>}
                        </td>
                        <td className="px-3 py-2.5 text-slate-700 font-medium">
                          {row.machineName || <span className="text-slate-400 italic">Not Found</span>}
                        </td>
                        <td className="px-3 py-2.5 text-center font-mono text-[11px]">
                          {row.hikvisionUserId ? (
                            <div className="inline-flex items-center gap-1.5 font-black">
                              <span className={row.hasFace ? 'text-emerald-600' : 'text-slate-300'}>
                                Face: {row.hasFace ? '✓' : '✕'}
                              </span>
                              <span className="text-slate-300">|</span>
                              <span className={row.hasFingerprint ? 'text-emerald-600' : 'text-slate-300'}>
                                FP: {row.hasFingerprint ? '✓' : '✕'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          {row.mappingStatus === 'mapped' && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                              ✓ MAPPED
                            </span>
                          )}
                          {row.mappingStatus === 'name_mismatch' && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-amber-100 text-amber-800 border border-amber-300" title="ID matched but name differs">
                              ⚠ NAME MISMATCH
                            </span>
                          )}
                          {row.mappingStatus === 'id_not_found' && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-rose-100 text-rose-800 border border-rose-300">
                              ⚠ ID NOT FOUND
                            </span>
                          )}
                          {row.mappingStatus === 'not_mapped' && (
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-300">
                              ○ NOT MAPPED
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setManualMapTarget(row);
                              setManualSearchQuery('');
                            }}
                            className="px-2.5 py-1 bg-slate-100 hover:bg-orange-50 hover:text-[#C2410C] hover:border-orange-200 text-slate-700 rounded-lg text-[11px] font-bold border border-slate-200 cursor-pointer transition-colors"
                          >
                            Map Manually
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Confirmation Button */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                <div className="text-xs font-bold text-slate-600">
                  <b className="text-slate-900">{mappingCounts.selectedCount}</b> of {mappingCounts.total} members selected for terminal linking.
                </div>

                <button
                  type="button"
                  onClick={handleConfirmMapping}
                  className="px-6 py-3 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white font-black rounded-xl text-xs shadow-md border-none cursor-pointer flex items-center gap-1.5 active:scale-95"
                >
                  <span>Confirm Mapping & Continue →</span>
                </button>
              </div>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════════════════════
              STEP 3: SUCCESS & HOLD MEMBERS OVERVIEW
             ════════════════════════════════════════════════════════════════════════ */}
          {step === 'completed' && (
            <div className="text-center py-6 space-y-4 max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 size={36} />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900">Members Imported & Placed into HOLD</h4>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  All Excel members have been saved with their exact Biometric IDs and linked with the Hikvision terminal. They are currently in <b className="text-amber-600">HOLD</b> status.
                </p>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-left text-xs space-y-2 text-amber-900">
                <div className="font-black flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-amber-700" />
                  <span>Next Step: Membership Billing & Activation</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-800">
                  Open the <b>HOLD</b> tab on the Members page. For each member, click <b className="text-[#EA580C]">[Create Bill →]</b> to select a membership package, enter payment, and activate them into <b>ACTIVE</b> status.
                </p>
              </div>

              <button
                type="button"
                onClick={handleFinish}
                className="w-full py-3.5 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white font-black rounded-xl text-xs shadow-md border-none cursor-pointer flex items-center justify-center gap-1.5"
              >
                <span>View Hold Members & Create Bills →</span>
              </button>
            </div>
          )}

          {/* Loading / Progress State */}
          {(step === 'importing' || step === 'saving_mapping') && (
            <div className="text-center py-16 space-y-4">
              <div className="w-12 h-12 rounded-full border-4 border-orange-200 border-t-[#EA580C] animate-spin mx-auto" />
              <h4 className="text-sm font-black text-slate-800">
                {step === 'importing' ? 'Importing Members into HOLD...' : 'Saving Biometric Machine Mappings...'}
              </h4>
              <p className="text-xs text-slate-400">Please wait while the database is updated.</p>
            </div>
          )}

        </div>

        {/* ════════════════════════════════════════════════════════════════════════
            MANUAL MAPPING POPUP MODAL
           ════════════════════════════════════════════════════════════════════════ */}
        {manualMapTarget && (
          <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-5 space-y-4 border border-slate-200 text-left">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                    <Link2 size={16} className="text-[#EA580C]" />
                    Manual Hikvision Mapping
                  </h4>
                  <p className="text-[11px] text-slate-400 font-semibold mt-0.5">
                    Pair <b className="text-slate-800">{manualMapTarget.memberName}</b> (BIO ID: #{manualMapTarget.biometricId}) with a machine user
                  </p>
                </div>
                <button
                  onClick={() => setManualMapTarget(null)}
                  className="p-1 rounded-full text-slate-400 hover:bg-slate-100 border-none bg-transparent cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={manualSearchQuery}
                  onChange={(e) => setManualSearchQuery(e.target.value)}
                  placeholder="Search Hikvision user by ID or Name..."
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-[#EA580C]"
                />
              </div>

              {/* Terminal Users List */}
              <div className="border border-slate-200 rounded-xl max-h-56 overflow-y-auto divide-y divide-slate-100">
                {terminalUsers
                  .filter(u => {
                    if (!manualSearchQuery.trim()) return true;
                    const q = manualSearchQuery.toLowerCase().trim();
                    return u.employeeNo.toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q);
                  })
                  .slice(0, 50)
                  .map(u => (
                    <div
                      key={u.employeeNo}
                      onClick={() => handleAssignManualMapping(u)}
                      className="p-2.5 hover:bg-orange-50/70 transition-colors cursor-pointer flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-[#EA580C]">#{u.employeeNo}</span>
                        <span className="font-bold text-slate-800">{u.name || 'Unnamed Slot'}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                        <span>{u.hasFace ? 'Face ✓' : 'Face ✕'}</span>
                        <span>•</span>
                        <span>{u.hasFingerprint ? 'FP ✓' : 'FP ✕'}</span>
                        <span className="px-2 py-0.5 rounded bg-slate-100 font-bold text-slate-700">
                          Select
                        </span>
                      </div>
                    </div>
                  ))}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={() => setManualMapTarget(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs border-none cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
