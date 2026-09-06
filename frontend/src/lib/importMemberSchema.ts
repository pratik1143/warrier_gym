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
export function calculateDynamicStatus(expiryDateStr: string): {
  status: 'active' | 'expiring_soon' | 'expiring_today' | 'expired';
  label: string;
  daysLeft: number;
  badgeClass: string;
} {
  if (!expiryDateStr) {
    return { status: 'expired', label: 'Expired', daysLeft: 0, badgeClass: 'bg-rose-50 text-rose-700 border-rose-200' };
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

/**
 * Zod Schema for Member Row Validation
 */
export const ImportedMemberRowSchema = z.object({
  clientId: z.string().trim().min(1, 'Client ID is required'),
  name: z.string().trim().min(1, 'Client name is required'),
  phone: z.string().trim().min(5, 'Valid phone number is required'),
  gender: z.enum(['Male', 'Female', 'Unknown']).default('Unknown'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid Start Date (YYYY-MM-DD) is required'),
  packageName: z.string().trim().min(1, 'Package is required'),
  originalPackageName: z.string().optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Valid Expiry Date (YYYY-MM-DD) is required'),
  amountPaid: z.number().min(0, 'Amount paid must be >= 0'),
  balanceAmount: z.number().min(0, 'Balance amount must be >= 0'),
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
}

/**
 * Parses and validates an Excel row into a normalized ParsedImportRow.
 */
export function parseAndValidateMemberRow(raw: Record<string, any>, rowNumber: number): ParsedImportRow | null {
  // Check if row is completely blank
  const rawClientId = raw['Client ID'] ?? raw['clientId'] ?? raw['id'] ?? raw['ClientID'] ?? '';
  const rawName = raw['Client name'] ?? raw['name'] ?? raw['ClientName'] ?? raw['member'] ?? '';
  const rawPhone = raw['Number'] ?? raw['phone'] ?? raw['mobile'] ?? raw['Phone'] ?? '';
  const rawGender = raw['Gender'] ?? raw['gender'] ?? raw['Sex'] ?? '';
  const rawStartDate = raw['Start Date'] ?? raw['startDate'] ?? raw['Registration'] ?? raw['joinDate'] ?? '';
  const rawPackage = raw['Package'] ?? raw['package'] ?? raw['plan'] ?? '';
  const rawExpiryDate = raw['Expiry Date'] ?? raw['expiryDate'] ?? raw['Expiration'] ?? '';
  const rawAmount = raw['Amount'] ?? raw['amount'] ?? raw['paid'] ?? raw['AmountPaid'] ?? '';
  const rawBalance = raw['Balance'] ?? raw['balance'] ?? raw['BalanceAmount'] ?? '';
  const rawPhoto = raw['Photo'] ?? raw['photo'] ?? raw['photoUrl'] ?? raw['avatar'] ?? '';

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

  const startDate = normalizeDate(rawStartDate);
  const expiryDate = normalizeDate(rawExpiryDate);
  const originalPackageName = String(rawPackage).trim();
  const packageName = normalizePackageName(rawPackage);

  const amountPaid = typeof rawAmount === 'number' ? rawAmount : (parseFloat(String(rawAmount).replace(/[^0-9.]/g, '')) || 0);
  const balanceAmount = typeof rawBalance === 'number' ? rawBalance : (parseFloat(String(rawBalance).replace(/[^0-9.]/g, '')) || 0);
  
  const photoTrimmed = String(rawPhoto).trim();
  const photoUrl = photoTrimmed && (photoTrimmed.startsWith('http://') || photoTrimmed.startsWith('https://')) ? photoTrimmed : null;

  const warnings: string[] = [];
  const errors: string[] = [];

  // Validation Rules
  if (!clientId) errors.push('Client ID is required');
  if (!name) errors.push('Client Name is required');
  if (!phone) errors.push('Phone Number is required');
  if (!packageName) errors.push('Package Name is required');
  if (!startDate) errors.push('Invalid Start Date format');
  if (!expiryDate) errors.push('Invalid Expiry Date format');
  if (amountPaid < 0) errors.push('Amount paid must be >= 0');
  if (balanceAmount < 0) errors.push('Balance amount must be >= 0');

  // Source Data Warnings (Preserve values, flag for inspection)
  if (balanceAmount > amountPaid && amountPaid > 0) {
    warnings.push(`⚠️ Source data warning: Balance (₹${balanceAmount.toLocaleString('en-IN')}) is greater than Amount Paid (₹${amountPaid.toLocaleString('en-IN')})`);
  }

  if (startDate && expiryDate && expiryDate < startDate) {
    warnings.push(`⚠️ Expiry date (${expiryDate}) is before start date (${startDate})`);
  }

  const dynamicStatus = calculateDynamicStatus(expiryDate);

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
    rawRow: raw
  };
}
