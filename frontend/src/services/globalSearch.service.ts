import { useGymStore } from '@/store';
import staffDirectoryService, { UnifiedStaff, BASELINE_REAL_TRAINERS } from './staff.service';
import { enquiryService, EnquiryItem } from './enquiry.service';
import { followupService, FollowUpItem } from './followup.service';
import API from './api';
import { calculateAge } from '@/lib/utils';
import { membershipEngine } from '@/lib/engines/membershipEngine';

export interface SearchResultItem {
  id: string;
  category: 'member' | 'employee' | 'trainer' | 'enquiry' | 'followup';
  categoryLabel: string;
  title: string;
  subtitle: string;
  phone?: string;
  email?: string;
  status?: string;
  statusClass?: string;
  meta?: string;
  avatarText?: string;
  url: string;
  score: number;
  raw: any;
}

export interface GlobalSearchResults {
  query: string;
  members: SearchResultItem[];
  employees: SearchResultItem[];
  trainers: SearchResultItem[];
  enquiries: SearchResultItem[];
  followUps: SearchResultItem[];
  total: number;
}

// In-memory cache buffers for instant non-blocking search
let _cachedEnquiries: EnquiryItem[] = [];
let _cachedFollowups: FollowUpItem[] = [];
let _isSubscribed = false;

function ensureSubscriptions() {
  if (_isSubscribed || typeof window === 'undefined') return;
  _isSubscribed = true;

  // Real-time sync for enquiries
  try {
    enquiryService.subscribe((items) => {
      _cachedEnquiries = items;
    });
  } catch (_) {}

  // Real-time sync for followups
  try {
    followupService.subscribe((items) => {
      _cachedFollowups = items;
    });
  } catch (_) {}
}

function normalizePhone(phone: any): string {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

function calculateScore(queryText: string, digitsOnly: string, item: any, nameField = 'name'): number {
  const q = queryText.toLowerCase();
  const name = String(item[nameField] || item.fullName || item.title || '').toLowerCase();
  const phone = normalizePhone(item.phone || item.mobile || item.contact);
  const email = String(item.email || '').toLowerCase();
  
  const idFields = [
    item.id,
    item.memberId,
    item.employeeId,
    item.enquiryId,
    item.biometricId,
    item.customId,
    item.clientId,
    item.code,
    item.automationKey
  ].filter(Boolean).map(String).map(s => s.toLowerCase());

  // 1. Exact Name match
  if (name === q) return 100;

  // 2. Exact ID match
  if (idFields.some(id => id === q || id.endsWith(q))) return 95;

  // 3. Exact Phone match
  if (digitsOnly && digitsOnly.length >= 7 && (phone === digitsOnly || phone.endsWith(digitsOnly))) {
    return 90;
  }

  // 4. Exact Email match
  if (email && email === q) return 85;

  // 5. Name starts with query
  if (name.startsWith(q)) return 75;

  // 6. ID starts with query
  if (idFields.some(id => id.startsWith(q))) return 70;

  // 7. Phone partial match
  if (digitsOnly && digitsOnly.length >= 3 && phone.includes(digitsOnly)) return 65;

  // 8. Name contains query
  if (name.includes(q)) return 60;

  // 9. ID contains query
  if (idFields.some(id => id.includes(q))) return 55;

  // 10. Email contains query
  if (email && email.includes(q)) return 50;

  // 11. Secondary text match (Address, Plan, Role, Remarks)
  const secondary = `${item.address || ''} ${item.city || ''} ${item.plan || ''} ${item.role || ''} ${item.specialization || ''} ${item.remarks || ''} ${item.notes || ''}`.toLowerCase();
  if (secondary.includes(q)) return 40;

  return 0;
}

export const globalSearchService = {
  // Execute client-side instantaneous multi-module search
  search: async (queryText: string): Promise<GlobalSearchResults> => {
    ensureSubscriptions();

    const raw = queryText.trim();
    if (!raw) {
      return {
        query: '',
        members: [],
        employees: [],
        trainers: [],
        enquiries: [],
        followUps: [],
        total: 0
      };
    }

    const q = raw.toLowerCase();
    const digitsOnly = q.replace(/\D/g, '');

    // 1. Pull current memory stores
    const gymState = useGymStore.getState();
    const membersList = gymState.members || [];
    const staffList = await staffDirectoryService.getStaffDirectory().catch(() => BASELINE_REAL_TRAINERS);
    const enquiriesList = _cachedEnquiries.length > 0 ? _cachedEnquiries : [];
    const followupsList = _cachedFollowups.length > 0 ? _cachedFollowups : [];

    // ─── 2. Filter & Score Members ───
    const matchedMembers: SearchResultItem[] = [];
    const seenMemberKeys = new Set<string>();

    membersList.forEach((m: any) => {
      const score = calculateScore(q, digitsOnly, m, 'name');
      if (score <= 0) return;

      const key = m.id || m.memberId;
      if (seenMemberKeys.has(key)) return;
      seenMemberKeys.add(key);

      const daysLeft = membershipEngine.calculateDaysLeft(m.expiryDate);
      const isExpired = daysLeft <= 0 || m.status === 'expired';
      const isFrozen = m.status === 'frozen';
      
      let statusLabel = 'Active';
      let statusClass = 'bg-emerald-100 text-emerald-800 border-emerald-200';
      if (isFrozen) {
        statusLabel = 'Frozen';
        statusClass = 'bg-blue-100 text-blue-800 border-blue-200';
      } else if (isExpired) {
        statusLabel = 'Expired';
        statusClass = 'bg-red-100 text-red-800 border-red-200';
      } else if (daysLeft <= 15) {
        statusLabel = `${daysLeft}d left`;
        statusClass = 'bg-amber-100 text-amber-800 border-amber-200';
      }

      const displayId = m.memberId || m.clientId || m.customId || `TWG-${String(m.id).slice(-4)}`;
      const safeAge = m.age ?? calculateAge(m.dob || m.dateOfBirth);

      matchedMembers.push({
        id: String(m.id || m.memberId),
        category: 'member',
        categoryLabel: 'Member',
        title: m.name || m.fullName || 'Member',
        subtitle: `${displayId} · ${m.plan || 'Monthly'}`,
        phone: m.phone || m.mobile || '',
        email: m.email || '',
        status: statusLabel,
        statusClass,
        meta: safeAge ? `Age: ${safeAge}` : undefined,
        avatarText: (m.name || 'M').substring(0, 2).toUpperCase(),
        url: `/dashboard/members/${m.id || m.memberId}`,
        score,
        raw: m
      });
    });

    matchedMembers.sort((a, b) => b.score - a.score);

    // ─── 3. Filter & Score Employees & Trainers ───
    const matchedEmployees: SearchResultItem[] = [];
    const matchedTrainers: SearchResultItem[] = [];
    const seenStaffKeys = new Set<string>();

    staffList.forEach((s: UnifiedStaff) => {
      const score = calculateScore(q, digitsOnly, s, 'name');
      if (score <= 0) return;

      const key = s.id || s.employeeId;
      if (seenStaffKeys.has(key)) return;
      seenStaffKeys.add(key);

      const roleStr = String(s.role || '').toLowerCase();
      const isTrainer = roleStr.includes('trainer') || roleStr.includes('coach') || !!s.specialization;
      const isInactive = (s.status || '').toLowerCase() === 'inactive';

      const statusClass = isInactive 
        ? 'bg-slate-100 text-slate-700 border-slate-200' 
        : 'bg-emerald-100 text-emerald-800 border-emerald-200';

      const avatarText = (s.name || 'S').substring(0, 2).toUpperCase();

      if (isTrainer) {
        matchedTrainers.push({
          id: s.id || s.employeeId,
          category: 'trainer',
          categoryLabel: 'Trainer',
          title: s.name,
          subtitle: s.biometricId ? `Biometric #${s.biometricId} · ${s.specialization || s.role}` : (s.specialization || s.role),
          phone: s.phone,
          email: s.email,
          status: s.status || 'Active',
          statusClass,
          meta: s.todayStatus ? `Today: ${s.todayStatus}` : undefined,
          avatarText,
          url: `/dashboard/trainers?id=${s.id || s.employeeId}`,
          score,
          raw: s
        });
      }

      matchedEmployees.push({
        id: s.id || s.employeeId,
        category: 'employee',
        categoryLabel: 'Employee',
        title: s.name,
        subtitle: s.employeeId ? `${s.employeeId} · ${s.role || 'Staff'}` : (s.role || 'Staff'),
        phone: s.phone,
        email: s.email,
        status: s.status || 'Active',
        statusClass,
        meta: s.currentStatus ? `Location: ${s.currentStatus}` : undefined,
        avatarText,
        url: `/dashboard/employees?id=${s.id || s.employeeId}`,
        score,
        raw: s
      });
    });

    matchedEmployees.sort((a, b) => b.score - a.score);
    matchedTrainers.sort((a, b) => b.score - a.score);

    // ─── 4. Filter & Score Enquiries ───
    const matchedEnquiries: SearchResultItem[] = [];
    const seenEnquiryKeys = new Set<string>();

    enquiriesList.forEach((e: EnquiryItem) => {
      const score = calculateScore(q, digitsOnly, e, 'name');
      if (score <= 0) return;

      const key = e.id;
      if (seenEnquiryKeys.has(key)) return;
      seenEnquiryKeys.add(key);

      const statusLower = (e.status || 'Pending').toLowerCase();
      const statusClass = statusLower === 'closed' || statusLower === 'converted'
        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
        : 'bg-amber-100 text-amber-800 border-amber-200';

      const cleanFollowup = (e.nextFollowUpDate || e.nextFollowUp || '').split('T')[0];

      matchedEnquiries.push({
        id: e.id,
        category: 'enquiry',
        categoryLabel: 'Enquiry',
        title: e.name || 'Lead Inquiry',
        subtitle: `ENQ-${e.id.slice(-4)} · ${e.interestedPlan || e.duration || 'Membership'}`,
        phone: e.phone || '',
        email: e.email || '',
        status: e.status || 'Pending',
        statusClass,
        meta: cleanFollowup ? `Follow-up: ${cleanFollowup}` : undefined,
        avatarText: (e.name || 'E').substring(0, 2).toUpperCase(),
        url: `/dashboard/enquiries?id=${e.id}`,
        score,
        raw: e
      });
    });

    matchedEnquiries.sort((a, b) => b.score - a.score);

    // ─── 5. Filter & Score Follow-Ups (including connected relations) ───
    const matchedFollowUps: SearchResultItem[] = [];
    const seenFollowUpKeys = new Set<string>();

    followupsList.forEach((f: FollowUpItem) => {
      let score = calculateScore(q, digitsOnly, f, 'memberName');
      if (score === 0) {
        score = calculateScore(q, digitsOnly, f, 'title');
      }

      // Check if related member or enquiry matched
      if (score === 0) {
        const matchingMember = matchedMembers.find(m => m.id === f.memberId || (m.phone && f.phone && normalizePhone(m.phone) === normalizePhone(f.phone)));
        if (matchingMember) {
          score = Math.max(30, matchingMember.score - 15);
        }
      }

      if (score <= 0) return;

      const key = f.id;
      if (seenFollowUpKeys.has(key)) return;
      seenFollowUpKeys.add(key);

      const cleanDueDate = (f.dueDate || f.scheduledDate || '').split('T')[0];
      const isCompleted = f.status === 'Completed';

      const statusClass = isCompleted
        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
        : 'bg-blue-100 text-[#0b5cbe] border-blue-200';

      matchedFollowUps.push({
        id: f.id,
        category: 'followup',
        categoryLabel: 'Follow-Up',
        title: f.memberName || f.title || 'Follow-Up Task',
        subtitle: `${f.type || 'Renewal'} · Due: ${cleanDueDate || 'Today'}${f.scheduledTime ? ` · ${f.scheduledTime}` : ''}`,
        phone: f.phone || '',
        status: f.status || 'Pending',
        statusClass,
        meta: f.assignedTo ? `Assigned: ${f.assignedTo}` : undefined,
        avatarText: (f.memberName || 'F').substring(0, 2).toUpperCase(),
        url: `/dashboard/follow-up?search=${encodeURIComponent(f.phone || f.memberName || f.id)}`,
        score,
        raw: f
      });
    });

    matchedFollowUps.sort((a, b) => b.score - a.score);

    const total = matchedMembers.length + matchedEmployees.length + matchedTrainers.length + matchedEnquiries.length + matchedFollowUps.length;

    return {
      query: raw,
      members: matchedMembers,
      employees: matchedEmployees,
      trainers: matchedTrainers,
      enquiries: matchedEnquiries,
      followUps: matchedFollowUps,
      total
    };
  }
};
