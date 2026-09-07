import { z } from 'zod';
import * as XLSX from 'xlsx';

/**
 * Normalizes any date value (Date object, Excel serial number, or date string like '01-Sept-26' or '22-Aug-2026')
 * into standard ISO date string 'YYYY-MM-DD'.
 */
export function normalizeDate(val: any): string {
  if (!val && val !== 0) return '';

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return '';
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof val === 'number') {
    try {
      const d = XLSX.SSF.parse_date_code(val);
      if (!d) return '';
      const y = d.y;
      const m = String(d.m).padStart(2, '0');
      const day = String(d.d).padStart(2, '0');
      return `${y}-${m}-${day}`;
    } catch (_) {
      return '';
    }
  }

  if (typeof val === 'string') {
    const s = val.trim();
    if (!s) return '';

    // Match patterns like '01-Sept-26', '22-Aug-2026', '1-Sep-2026', '01/09/2026'
    const monthNames: Record<string, number> = {
      jan: 1, january: 1,
      feb: 2, february: 2,
      mar: 3, march: 3,
      apr: 4, april: 4,
      may: 5,
      jun: 6, june: 6,
      jul: 7, july: 7,
      aug: 8, august: 8,
      sep: 9, sept: 9, september: 9,
      oct: 10, october: 10,
      nov: 11, november: 11,
      dec: 12, december: 12
    };

    const textMatch = s.match(/^(\d{1,2})[-/ ]([A-Za-z]+)[-/ ](\d{2,4})$/);
    if (textMatch) {
      const day = parseInt(textMatch[1], 10);
      const monStr = textMatch[2].toLowerCase();
      let year = parseInt(textMatch[3], 10);
      if (year < 100) year += 2000;
      const mon = monthNames[monStr];
      if (mon && day >= 1 && day <= 31) {
        return `${year}-${String(mon).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      }
    }

    // Match standard ISO YYYY-MM-DD
    const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
      const y = parseInt(isoMatch[1], 10);
      const m = parseInt(isoMatch[2], 10);
      const d = parseInt(isoMatch[3], 10);
      return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }

    // Fallback standard Date parsing
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      const y = parsed.getFullYear();
      const m = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    }
  }

  return '';
}

/**
 * Normalize spelling and casing of package name ONLY for display consistency.
 * Preserves the package meaning exactly.
 */
export function normalizePackageName(pkg: string | undefined | null): string {
  if (!pkg) return 'General Membership';
  const str = String(pkg).trim();
  const lower = str.toLowerCase();

  if (/^1\s*day$/i.test(lower) || lower === '1day') return '1 Day';
  if (/^10\s*days?$/i.test(lower)) return '10 Days';
  if (/^15\s*days?$/i.test(lower)) return '15 Days';
  if (/^1\s*months?$/i.test(lower)) return '1 Month';
  if (/^2\s*months?$/i.test(lower)) return '2 Months';
  if (/^3\s*months?$/i.test(lower)) return '3 Months';
  if (/^6\s*months?$/i.test(lower)) return '6 Months';
  if (/^12\s*months?$/i.test(lower) || /^1\s*year$/i.test(lower)) return '12 Months';
  if (/^3\s*\+\s*1\s*months?$/i.test(lower)) return '3+1 Months';
  if (/^3\s*\+\s*2\s*months?$/i.test(lower)) return '3+2 Months';
  if (/^6\s*\+\s*1\s*months?$/i.test(lower)) return '6+1 Months';
  if (/^6\s*\+\s*2\s*months?$/i.test(lower)) return '6+2 Months';

  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Calculates dynamic membership status based on expiryDate compared to today.
 * NEVER modifies stored expiryDate.
 */
export function calculateDynamicStatus(expiryDateStr?: string, isHold?: boolean): {
  status: 'active' | 'expiring_soon' | 'expiring_today' | 'expired' | 'hold';
  label: string;
  daysLeft: number;
  badgeClass: string;
} {
  if (isHold || !expiryDateStr || expiryDateStr === '—' || expiryDateStr === 'N/A' || expiryDateStr.trim() === '') {
    return { status: 'hold', label: 'HOLD (NO PLAN)', daysLeft: 0, badgeClass: 'bg-amber-100 text-amber-800 border-amber-300' };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const exp = new Date(expiryDateStr);
  exp.setHours(0, 0, 0, 0);

  if (isNaN(exp.getTime())) {
    return { status: 'expired', label: 'Expired', daysLeft: 0, badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' };
  }

  const diffMs = exp.getTime() - today.getTime();
  const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) {
    return { status: 'expired', label: 'Expired', daysLeft, badgeClass: 'bg-slate-100 text-slate-600 border-slate-200' };
  }
  if (daysLeft === 0) {
    return { status: 'expiring_today', label: 'Expiring Today', daysLeft: 0, badgeClass: 'bg-amber-50 text-amber-700 border-amber-300' };
  }
  if (daysLeft <= 7) {
    return { status: 'expiring_soon', label: 'Expiring Soon', daysLeft, badgeClass: 'bg-orange-50 text-orange-700 border-orange-200' };
  }

  return { status: 'active', label: 'Active', daysLeft, badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
}

function getFlexibleValue(raw: Record<string, any>, candidateKeys: string[]): any {
  for (const k of candidateKeys) {
    if (raw[k] !== undefined && raw[k] !== null && String(raw[k]).trim() !== '') {
      return raw[k];
    }
  }
  const rawKeys = Object.keys(raw);
  for (const k of candidateKeys) {
    const targetNorm = k.toLowerCase().replace(/[\s_\-.]/g, '');
    const matchedKey = rawKeys.find(rk => rk.toLowerCase().replace(/[\s_\-.]/g, '') === targetNorm);
    if (matchedKey && raw[matchedKey] !== undefined && raw[matchedKey] !== null && String(raw[matchedKey]).trim() !== '') {
      return raw[matchedKey];
    }
  }
  return '';
}

/**
 * Zod Schema for Member Row Validation
 */
export const ImportedMemberRowSchema = z.object({
  clientId: z.string().trim().min(1, 'ID is required'),
  name: z.string().trim().min(1, 'Name is required'),
  phone: z.string().trim().optional().default(''),
  gender: z.enum(['Male', 'Female', 'Unknown']).default('Unknown'),
  startDate: z.string().optional().default(() => new Date().toISOString().split('T')[0]),
  packageName: z.string().trim().optional().default('General Membership'),
  originalPackageName: z.string().optional(),
  expiryDate: z.string().optional().default(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().split('T')[0];
  }),
  amountPaid: z.number().min(0).optional().default(0),
  balanceAmount: z.number().min(0).optional().default(0),
  photoUrl: z.string().nullable().optional(),
});

export type ImportedMemberRow = z.infer<typeof ImportedMemberRowSchema>;

export interface ParsedImportRow {
  rowNumber: number;
  clientId: string;
  name: string;
  phone: string;
  gender: 'Male' | 'Female' | 'Unknown';
  startDate: string;
  packageName: string;
  originalPackageName: string;
  expiryDate: string;
  amountPaid: number;
  balanceAmount: number;
  photoUrl: string | null;
  warnings: string[];
  errors: string[];
  isValid: boolean;
  dynamicStatus: ReturnType<typeof calculateDynamicStatus>;
  rawRow: Record<string, any>;
  isMinimalTwoColumn?: boolean;
}

/**
 * Parses and validates an Excel row into a normalized ParsedImportRow.
 * Fully supports minimal 2-column sheets (ID + Name only) as well as rich 10-column sheets.
 */
export function parseAndValidateMemberRow(raw: Record<string, any>, rowNumber: number): ParsedImportRow | null {
  const rawClientId = getFlexibleValue(raw, [
    'Client ID', 'clientId', 'ClientID', 'client_id',
    'Employee ID', 'employeeId', 'EmployeeID', 'employee_id',
    'Emp ID', 'empId', 'Biometric ID', 'biometricId', 'biometric_id',
    'User ID', 'userId', 'user_id', 'ID', 'id', 'Id',
    'No', 'No.', 'S.No', 'Sr. No', 'Member ID', 'memberId', 'member_id'
  ]);

  const rawName = getFlexibleValue(raw, [
    'Client name', 'ClientName', 'client_name', 'name', 'Name',
    'Member Name', 'memberName', 'MemberName', 'member_name',
    'Employee Name', 'employeeName', 'User Name', 'userName',
    'Full Name', 'fullName', 'member', 'Person Name', 'personName'
  ]);

  const rawPhone = getFlexibleValue(raw, [
    'Number', 'number', 'phone', 'Phone', 'mobile', 'Mobile',
    'Contact', 'contact', 'cell', 'Cell', 'Telephone'
  ]);

  const rawGender = getFlexibleValue(raw, ['Gender', 'gender', 'Sex', 'sex']);
  const rawStartDate = getFlexibleValue(raw, ['Start Date', 'startDate', 'Registration', 'joinDate', 'Join Date', 'DOJ', 'Date of Joining']);
  const rawPackage = getFlexibleValue(raw, ['Package', 'package', 'plan', 'Plan', 'Membership', 'membership', 'Package Name']);
  const rawExpiryDate = getFlexibleValue(raw, ['Expiry Date', 'expiryDate', 'Expiration', 'Expiry', 'End Date', 'endDate', 'validTill']);
  const rawAmount = getFlexibleValue(raw, ['Amount', 'amount', 'paid', 'Paid', 'AmountPaid', 'Fee', 'fee', 'Total']);
  const rawBalance = getFlexibleValue(raw, ['Balance', 'balance', 'BalanceAmount', 'Due', 'due', 'Pending']);
  const rawPhoto = getFlexibleValue(raw, ['Photo', 'photo', 'photoUrl', 'avatar', 'avatarUrl', 'Image', 'image']);

  const isEmpty = (
    String(rawClientId).trim() === '' &&
    String(rawName).trim() === '' &&
    String(rawPhone).trim() === '' &&
    String(rawPackage).trim() === '' &&
    String(rawStartDate).trim() === '' &&
    String(rawExpiryDate).trim() === '' &&
    rawAmount === '' &&
    rawBalance === ''
  );

  if (isEmpty) {
    return null; // Skip completely blank row
  }

  const clientId = String(rawClientId).trim();
  const name = String(rawName).trim();
  const phone = String(rawPhone).trim();
  
  let gender: 'Male' | 'Female' | 'Unknown' = 'Unknown';
  const gStr = String(rawGender).trim().toLowerCase();
  if (gStr === 'male' || gStr === 'm') gender = 'Male';
  else if (gStr === 'female' || gStr === 'f') gender = 'Female';

  const todayStr = new Date().toISOString().split('T')[0];
  const isMinimalTwoColumn = !rawPhone && !rawPackage && !rawStartDate && !rawExpiryDate;
  const isHold = isMinimalTwoColumn || (!rawPackage && !rawExpiryDate);

  const startDate = isHold ? '' : (normalizeDate(rawStartDate) || todayStr);
  const expiryDate = isHold ? '' : normalizeDate(rawExpiryDate);

  const originalPackageName = isHold ? '' : String(rawPackage || '').trim();
  const packageName = isHold ? '' : normalizePackageName(rawPackage);

  const amountPaid = isHold ? 0 : (typeof rawAmount === 'number' ? rawAmount : (parseFloat(String(rawAmount).replace(/[^0-9.]/g, '')) || 0));
  const balanceAmount = isHold ? 0 : (typeof rawBalance === 'number' ? rawBalance : (parseFloat(String(rawBalance).replace(/[^0-9.]/g, '')) || 0));
  
  const photoTrimmed = String(rawPhoto).trim();
  const photoUrl = photoTrimmed && (photoTrimmed.startsWith('http://') || photoTrimmed.startsWith('https://')) ? photoTrimmed : null;

  const warnings: string[] = [];
  const errors: string[] = [];

  // Validation Rules: Strictly require ID and Name
  if (!clientId) errors.push('ID (Client/Employee/Biometric ID) is required');
  if (!name) errors.push('Member Name is required');
  if (amountPaid < 0) errors.push('Amount paid must be >= 0');
  if (balanceAmount < 0) errors.push('Balance amount must be >= 0');

  // Source Data Warnings (Preserve values, flag for inspection)
  if (balanceAmount > amountPaid && amountPaid > 0) {
    warnings.push(`⚠️ Source data warning: Balance (₹${balanceAmount.toLocaleString('en-IN')}) is greater than Amount Paid (₹${amountPaid.toLocaleString('en-IN')})`);
  }

  if (startDate && expiryDate && expiryDate < startDate) {
    warnings.push(`⚠️ Expiry date (${expiryDate}) is before start date (${startDate})`);
  }

  const dynamicStatus = calculateDynamicStatus(expiryDate, isHold);

  return {
    rowNumber,
    clientId,
    name,
    phone,
    gender,
    startDate,
    packageName,
    originalPackageName,
    expiryDate,
    amountPaid,
    balanceAmount,
    photoUrl,
    warnings,
    errors,
    isValid: errors.length === 0,
    dynamicStatus,
    rawRow: raw,
    isMinimalTwoColumn
  };
}
