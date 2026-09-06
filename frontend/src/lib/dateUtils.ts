/**
 * Centralized Date Utilities for Asia/Kolkata Timezone
 */

export function getTodayInIndia(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
    return formatter.format(date); // returns 'YYYY-MM-DD'
  } catch (_) {
    const tzOffset = 5.5 * 60 * 60 * 1000;
    const kolkataTime = new Date(date.getTime() + tzOffset);
    return kolkataTime.toISOString().split('T')[0];
  }
}

export function getCalendarDaysDiff(targetDateStr: string, baseDateStr?: string): number {
  if (!targetDateStr) return NaN;
  const base = baseDateStr || getTodayInIndia();
  
  const cleanTarget = targetDateStr.split('T')[0];
  const cleanBase = base.split('T')[0];
  
  const [tY, tM, tD] = cleanTarget.split('-').map(Number);
  const [bY, bM, bD] = cleanBase.split('-').map(Number);
  
  if (!tY || !tM || !tD || !bY || !bM || !bD) return NaN;
  
  const targetUtc = Date.UTC(tY, tM - 1, tD);
  const baseUtc = Date.UTC(bY, bM - 1, bD);
  
  return Math.round((targetUtc - baseUtc) / (1000 * 60 * 60 * 24));
}

export function isTodayInIndia(dateStr: string): boolean {
  if (!dateStr) return false;
  return dateStr.split('T')[0] === getTodayInIndia();
}

export function isOverdueInIndia(dateStr: string): boolean {
  if (!dateStr) return false;
  return dateStr.split('T')[0] < getTodayInIndia();
}

export function isUpcomingInIndia(dateStr: string): boolean {
  if (!dateStr) return false;
  return dateStr.split('T')[0] > getTodayInIndia();
}

export function formatIndianDate(dateStr: string): string {
  if (!dateStr) return '';
  const clean = dateStr.split('T')[0];
  const [y, m, d] = clean.split('-').map(Number);
  if (!y || !m || !d) return dateStr;
  
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dd = String(d).padStart(2, '0');
  const mm = months[m - 1] || String(m).padStart(2, '0');
  return `${dd}-${mm}-${y}`;
}
