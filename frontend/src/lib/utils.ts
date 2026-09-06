export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(value);
};

export const formatDate = (dateString: string): string => {
  if (!dateString) return '—';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

export const formatTime = (timeString: string): string => {
  if (!timeString) return '—';
  const d = new Date(timeString);
  return d.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// ────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH: delegates to membershipEngine
// Every page that calls daysUntilExpiry() automatically gets the
// canonical value — no duplicate logic anywhere.
// ────────────────────────────────────────────────────────────────
import { membershipEngine } from '@/lib/engines/membershipEngine';

export const daysUntilExpiry = (expiryDateString: string): number => {
  return membershipEngine.calculateDaysLeft(expiryDateString);
};

export const formatDaysLeft = (expiryDateString: string): string => {
  if (!expiryDateString) return 'No Expiry';
  const days = daysUntilExpiry(expiryDateString);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days > 1) return `${days} Days`;
  
  const absDays = Math.abs(days);
  if (absDays === 1) return 'Expired Yesterday';
  if (absDays < 30) return `Expired ${absDays} Days Ago`;
  
  const months = Math.round(absDays / 30);
  if (months === 1) return 'Expired 1 Month Ago';
  return `Expired ${months} Months Ago`;
};

export const getInitials = (name: string): string => {
  if (!name) return 'AZ';
  const parts = name.trim().split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return parts[0].substring(0, 2).toUpperCase();
};

export const getRandomColor = (name: string): string => {
  const colors = [
    '#00E5FF', // Cyan
    '#7C3AED', // Purple
    '#22C55E', // Green
    '#EC4899', // Pink
    '#F59E0B', // Amber
    '#3B82F6', // Blue
  ];
  let sum = 0;
  for (let i = 0; i < name.length; i++) {
    sum += name.charCodeAt(i);
  }
  return colors[sum % colors.length];
};

export const calculateRealAttendance = (joinDateString: string, attendanceCount: number): number => {
  if (!attendanceCount || attendanceCount <= 0) return 0;
  if (!joinDateString) return 0;
  
  const joinDate = new Date(joinDateString);
  const today = new Date();
  
  // Cap at 0 if join date is in the future
  if (joinDate > today) return 0;

  const diffTime = today.getTime() - joinDate.getTime();
  const elapsedDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
  
  // Calculate percentage (can't be over 100%)
  const percentage = Math.round((attendanceCount / elapsedDays) * 100);
  return Math.min(100, percentage);
};

export const formatCanonicalPlanName = (planStr: string): string => {
  if (!planStr) return 'Standard Membership';
  const p = planStr.trim().toLowerCase();
  if (p.includes('12 month') || p.includes('1 year') || p.includes('annual') || p.includes('yearly') || p.includes('365 day')) {
    return '12 Months (Annual)';
  }
  if (p.includes('6 month') || p.includes('semi') || p.includes('180 day')) {
    return '6 Months (Semi-Annual)';
  }
  if (p.includes('3 month') || p.includes('quarter') || p.includes('90 day') || p.includes('3+1') || p.includes('3 + 1')) {
    return '3 Months (Quarterly)';
  }
  if (p.includes('1 month') || p.includes('monthly') || p.includes('30 day')) {
    return '1 Month Standard';
  }
  if (p.includes('lifetime')) return 'Lifetime Membership';
  if (p.includes('pt') || p.includes('personal training')) return 'Personal Training';
  if (p.includes('vip') || p.includes('premium')) return 'Premium VIP';
  return planStr.trim();
};

export const cleanPlanName = (rawPlan?: string | null): string => {
  if (!rawPlan || typeof rawPlan !== 'string') return 'Standard Membership';
  const trimmed = rawPlan.trim();
  if (!trimmed) return 'Standard Membership';

  const planPattern = /(?:\d+\s*\+\s*\d+|\d+\s*(?:month|months|m|day|days|d|year|years|y)|quarterly|semi-annual|annual|yearly|monthly|lifetime|pt|personal training|vip|premium)/gi;
  const matches = trimmed.match(planPattern);

  if (matches && matches.length > 0) {
    const lastMatch = matches[matches.length - 1].trim();
    return formatCanonicalPlanName(lastMatch);
  }

  return formatCanonicalPlanName(trimmed);
};

export const parsePlanSegments = (rawPlan?: string | null): string[] => {
  if (!rawPlan || typeof rawPlan !== 'string') return ['Standard Membership'];
  const trimmed = rawPlan.trim();
  if (!trimmed) return ['Standard Membership'];

  const planPattern = /(?:\d+\s*\+\s*\d+|\d+\s*(?:month|months|m|day|days|d|year|years|y)|quarterly|semi-annual|annual|yearly|monthly|lifetime|pt|personal training|vip|premium)/gi;
  const matches = trimmed.match(planPattern);

  if (matches && matches.length > 1) {
    return matches.map(m => formatCanonicalPlanName(m.trim()));
  }

  return [formatCanonicalPlanName(trimmed)];
};

export const getMembershipName = (planName: string): string => {
  return cleanPlanName(planName);
};

export const calculateAge = (dobString?: string | Date | null): number | null => {
  if (!dobString) return null;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 && age < 120 ? age : null;
};

export { resolveAvatarUrl, normalizeStatus, MALE_DEFAULT_AVATAR, FEMALE_DEFAULT_AVATAR } from './avatar';

