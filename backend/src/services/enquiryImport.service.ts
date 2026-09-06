import * as XLSX from 'xlsx';
import { db, getFirestoreDb, mockEnquiries, mockFollowups, saveMockDb } from '../firebase';

export interface NormalizedEnquiryRow {
  name: string;
  phone: string;
  duration: string;
  interestedPlan: string;
  nextFollowUpDate: string;
  assignedTo: string;
  status: 'pending' | 'closed' | 'contacted' | 'converted';
  source: string;
}

export interface ImportReport {
  totalRows: number;
  imported: number;
  pending: number;
  closed: number;
  duplicatesPrevented: number;
  invalid: number;
  historicalRecordsLinked: number;
  followupsGenerated: number;
  errors: Array<{ row: number; name: string; reason: string }>;
}

/**
 * Normalizes phone numbers to standard 10-digit Indian mobile format.
 * Strips non-digits, country code (+91/91), spaces, hyphens, brackets.
 */
export function normalizePhoneNumber(phone: any): string {
  if (!phone) return '';
  let s = String(phone).replace(/\D/g, '');
  if (s.length === 12 && s.startsWith('91')) {
    s = s.slice(2);
  } else if (s.length > 10) {
    s = s.slice(-10);
  }
  return s;
}

/**
 * Converts Excel dates (serial numbers, timestamps, or date strings) to 'YYYY-MM-DD'.
 */
export function parseExcelDate(val: any): string {
  if (val === null || val === undefined || val === '') return '';

  if (typeof val === 'number') {
    const parsed = XLSX.SSF.parse_date_code(val);
    if (parsed && parsed.y && parsed.m && parsed.d) {
      const mm = String(parsed.m).padStart(2, '0');
      const dd = String(parsed.d).padStart(2, '0');
      return `${parsed.y}-${mm}-${dd}`;
    }
  }

  const str = String(val).trim();
  if (!str) return '';

  // Case: DD-MM-YYYY or DD/MM/YYYY
  const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (dmyMatch) {
    const dd = String(dmyMatch[1]).padStart(2, '0');
    const mm = String(dmyMatch[2]).padStart(2, '0');
    const yyyy = dmyMatch[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // Case: YYYY-MM-DD or YYYY/MM/DD
  const ymdMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (ymdMatch) {
    const yyyy = ymdMatch[1];
    const mm = String(ymdMatch[2]).padStart(2, '0');
    const dd = String(ymdMatch[3]).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  // Case: M/D/YY or M/D/YYYY
  const mdyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
  if (mdyMatch) {
    const mm = String(mdyMatch[1]).padStart(2, '0');
    const dd = String(mdyMatch[2]).padStart(2, '0');
    let yyyy = mdyMatch[3];
    if (yyyy.length === 2) yyyy = `20${yyyy}`;
    return `${yyyy}-${mm}-${dd}`;
  }

  return str;
}

/**
 * Core Production Import Pipeline for Real Client Enquiries Excel.
 */
export async function importEnquiriesFromExcel(fileInput: string | Buffer): Promise<ImportReport> {
  const workbook = typeof fileInput === 'string' 
    ? XLSX.readFile(fileInput) 
    : XLSX.read(fileInput, { type: 'buffer' });

  const report: ImportReport = {
    totalRows: 0,
    imported: 0,
    pending: 0,
    closed: 0,
    duplicatesPrevented: 0,
    invalid: 0,
    historicalRecordsLinked: 0,
    followupsGenerated: 0,
    errors: []
  };

  const sheet1Name = workbook.SheetNames[0] || 'Sheet1';
  const sheet1 = workbook.Sheets[sheet1Name];
  if (!sheet1) {
    throw new Error('Sheet1 not found in Excel workbook');
  }

  // Parse Sheet 1 rows as objects
  const rawSheet1Rows: any[] = XLSX.utils.sheet_to_json(sheet1, { defval: '' });
  report.totalRows = rawSheet1Rows.length;

  // Parse Sheet 2 rows as array of arrays (header: 1)
  let rawSheet2Rows: any[][] = [];
  if (workbook.SheetNames.length > 1) {
    const sheet2Name = workbook.SheetNames[1];
    const sheet2 = workbook.Sheets[sheet2Name];
    if (sheet2) {
      rawSheet2Rows = XLSX.utils.sheet_to_json(sheet2, { header: 1, defval: '' });
    }
  }

  const firestore = getFirestoreDb();

  // Load existing enquiries from database to prevent duplicates
  let existingDbEnquiries: any[] = [];
  if (firestore) {
    const snap = await firestore.collection('enquiries').get();
    existingDbEnquiries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } else {
    existingDbEnquiries = [...mockEnquiries];
  }

  // Index existing enquiries by normalized phone number and ID
  const phoneToEnquiryMap = new Map<string, any>();
  existingDbEnquiries.forEach(e => {
    const p = normalizePhoneNumber(e.phone || e.contact);
    if (p) phoneToEnquiryMap.set(p, e);
  });

  // Prepare master records map from Sheet 1
  const masterEnquiries: Array<{
    id: string;
    enquiryDoc: any;
    isNew: boolean;
  }> = [];

  const seenSheet1Phones = new Set<string>();

  for (let i = 0; i < rawSheet1Rows.length; i++) {
    const row = rawSheet1Rows[i];
    const rowNum = i + 2; // 1-based index including header

    const rawName = String(row['Name'] || row['name'] || '').trim();
    const rawPhone = row['Number'] || row['number'] || row['Phone'] || row['phone'] || '';
    const normPhone = normalizePhoneNumber(rawPhone);
    const rawDuration = String(row['For'] || row['for'] || row['Duration'] || '1 month').trim();
    const rawFollowUpDate = row['Next follow-up'] || row['next follow-up'] || row['FollowUp'] || '';
    const cleanFollowUpDate = parseExcelDate(rawFollowUpDate);
    const rawRep = String(row['Rep.'] || row['rep'] || row['Representative'] || 'Veer Chand (manager)').trim();
    const rawStatus = String(row['Status'] || row['status'] || 'Pending').trim().toLowerCase();

    // Validation
    if (!rawName) {
      report.invalid++;
      report.errors.push({ row: rowNum, name: 'Unknown', reason: 'Missing Name' });
      continue;
    }
    if (!normPhone || normPhone.length < 10) {
      report.invalid++;
      report.errors.push({ row: rowNum, name: rawName, reason: `Invalid phone number: ${rawPhone}` });
      continue;
    }

    // Duplicate detection within Sheet 1
    if (seenSheet1Phones.has(normPhone)) {
      report.duplicatesPrevented++;
      continue;
    }
    seenSheet1Phones.add(normPhone);

    const mappedStatus: 'pending' | 'closed' = rawStatus === 'close' || rawStatus === 'closed' ? 'closed' : 'pending';

    const existingEnquiry = phoneToEnquiryMap.get(normPhone);
    const enquiryId = existingEnquiry?.id || `enq_imp_${normPhone}`;

    const initialHistoryItem = {
      id: `hist_init_${Date.now()}_${i}`,
      type: 'created',
      title: 'Enquiry Imported',
      description: `Imported from Excel master dataset (Status: ${mappedStatus === 'pending' ? 'Pending' : 'Closed'})`,
      status: mappedStatus,
      date: cleanFollowUpDate,
      assignedTo: rawRep,
      duration: rawDuration,
      source: 'excel_import',
      timestamp: new Date().toISOString()
    };

    const enquiryDoc = {
      id: enquiryId,
      name: rawName,
      firstName: rawName.split(' ')[0] || rawName,
      lastName: rawName.split(' ').slice(1).join(' ') || '',
      phone: normPhone,
      duration: rawDuration,
      interestedPlan: rawDuration,
      inquiryFor: rawDuration,
      nextFollowUpDate: cleanFollowUpDate,
      nextFollowUp: cleanFollowUpDate,
      followUpTime: '11:00',
      assignedTo: rawRep,
      attendedBy: rawRep,
      status: mappedStatus === 'pending' ? 'Pending' : 'Closed',
      priority: mappedStatus === 'pending' ? 'Warm' : 'Cold',
      source: 'Excel Import',
      remarks: `Imported from Excel master sheet. Plan: ${rawDuration}`,
      history: existingEnquiry?.history ? [...existingEnquiry.history] : [initialHistoryItem],
      createdAt: existingEnquiry?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    phoneToEnquiryMap.set(normPhone, enquiryDoc);
    masterEnquiries.push({
      id: enquiryId,
      enquiryDoc,
      isNew: !existingEnquiry
    });

    if (mappedStatus === 'pending') {
      report.pending++;
    } else {
      report.closed++;
    }
    report.imported++;
  }

  // -------------------------------------------------------------
  // PROCESS SHEET 2: LINK CLOSED HISTORY (DO NOT CREATE NEW ENQUIRIES)
  // -------------------------------------------------------------
  for (let j = 0; j < rawSheet2Rows.length; j++) {
    const row = rawSheet2Rows[j];
    if (!row || row.length === 0) continue;

    // Structure of Sheet2: [Name, Number, For, Next follow-up, Rep., Status]
    const s2Name = String(row[0] || '').trim();
    const s2Phone = row[1];
    const s2NormPhone = normalizePhoneNumber(s2Phone);
    const s2Duration = String(row[2] || '').trim();
    const s2FollowUpDate = parseExcelDate(row[3]);
    const s2Rep = String(row[4] || '').trim();

    if (!s2NormPhone) continue;

    const matchedMaster = phoneToEnquiryMap.get(s2NormPhone);
    if (matchedMaster) {
      const closedHistoryRecord = {
        id: `hist_closed_${Date.now()}_${j}`,
        type: 'closed_import',
        title: 'Closed Record Linked',
        description: `Linked historical closed enquiry record from Sheet 2`,
        status: 'closed',
        date: s2FollowUpDate,
        assignedTo: s2Rep || matchedMaster.assignedTo,
        duration: s2Duration || matchedMaster.duration,
        source: 'excel_import',
        importedAt: new Date().toISOString()
      };

      if (!Array.isArray(matchedMaster.history)) {
        matchedMaster.history = [];
      }
      
      // Avoid duplicate history item in array while counting linkage
      const alreadyHasClosedHist = matchedMaster.history.some((h: any) => h.type === 'closed_import');
      if (!alreadyHasClosedHist) {
        matchedMaster.history.push(closedHistoryRecord);
      }
      report.historicalRecordsLinked++;
    }
  }

  // -------------------------------------------------------------
  // SAVE MASTER ENQUIRIES TO FIRESTORE / MOCK DB
  // -------------------------------------------------------------
  const followupsToCreate: any[] = [];

  if (firestore) {
    // Batch write to Firestore in chunks of 400
    const chunkSize = 400;
    for (let c = 0; c < masterEnquiries.length; c += chunkSize) {
      const batch = firestore.batch();
      const chunk = masterEnquiries.slice(c, c + chunkSize);

      for (const item of chunk) {
        const docRef = firestore.collection('enquiries').doc(item.id);
        batch.set(docRef, item.enquiryDoc, { merge: true });

        // Also store history subcollection docs
        if (Array.isArray(item.enquiryDoc.history)) {
          for (const hist of item.enquiryDoc.history) {
            const histRef = docRef.collection('history').doc(hist.id || `hist_${Date.now()}`);
            batch.set(histRef, hist, { merge: true });
          }
        }
      }

      await batch.commit();
    }
  } else {
    // Memory / Local mock DB mode
    for (const item of masterEnquiries) {
      const idx = mockEnquiries.findIndex(e => e.id === item.id || normalizePhoneNumber(e.phone) === item.enquiryDoc.phone);
      if (idx !== -1) {
        mockEnquiries[idx] = { ...mockEnquiries[idx], ...item.enquiryDoc };
      } else {
        mockEnquiries.push(item.enquiryDoc);
      }
    }
    saveMockDb();
  }

  // -------------------------------------------------------------
  // GENERATE AUTOMATED FOLLOW-UPS FOR PENDING ENQUIRIES
  // -------------------------------------------------------------
  for (const item of masterEnquiries) {
    const enq = item.enquiryDoc;
    if (enq.status === 'Pending' && enq.nextFollowUpDate && enq.nextFollowUpDate.trim() !== '') {
      const autoKey = `ENQUIRY_FOLLOWUP_${enq.id}_${enq.nextFollowUpDate}`;
      const followUpPayload = {
        id: autoKey,
        automationKey: autoKey,
        enquiryId: enq.id,
        memberId: null,
        memberName: enq.name,
        phone: enq.phone,
        type: 'Enquiry',
        title: 'Enquiry Follow-Up',
        reason: 'Enquiry Follow-Up',
        description: `Enquiry callback for ${enq.name} (${enq.duration})`,
        notes: `Enquiry callback for ${enq.name} (${enq.duration})`,
        priority: 'Medium',
        dueDate: enq.nextFollowUpDate,
        scheduledDate: enq.nextFollowUpDate,
        scheduledTime: '11:00',
        scheduledTimestamp: new Date(`${enq.nextFollowUpDate}T11:00:00+05:30`).getTime() || Date.now(),
        assignedTo: enq.assignedTo || 'Veer Chand (manager)',
        status: 'Pending',
        source: 'automatic',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      followupsToCreate.push(followUpPayload);
      report.followupsGenerated++;
    }
  }

  // Batch insert follow-ups
  for (const fol of followupsToCreate) {
    await db.addFollowup(fol);
  }

  return report;
}
