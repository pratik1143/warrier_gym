import { getCalendarDaysDiff } from './dateUtils';

export interface FollowUpTypeStyle {
  key: 'enquiry' | 'renewal' | 'expired' | 'balance' | 'general';
  label: string;
  bgClass: string;
  borderClass: string;
  leftBorderClass: string;
  badgeClass: string;
  dotClass: string;
  avatarBg: string;
  iconColor: string;
  badgeText: string;
}

export function getFollowUpTypeStyle(task: any): FollowUpTypeStyle {
  const rawType = String(task?.type || '').trim().toLowerCase();
  const rawTitle = String(task?.title || '').trim().toLowerCase();
  const rawReason = String(task?.reason || task?.description || '').trim().toLowerCase();

  // 0. EXPIRED MEMBERSHIP CHECK based on task expiryDate
  const taskExpiry = task?.expiryDate || task?.membershipExpiry;
  if (taskExpiry && !rawType.includes('enquiry')) {
    const days = getCalendarDaysDiff(taskExpiry);
    if (!isNaN(days) && days < 0) {
      return {
        key: 'expired',
        label: 'EXPIRED',
        bgClass: 'bg-[#FEF2F2] hover:bg-[#FDE8E8]',
        borderClass: 'border-[#FECACA]',
        leftBorderClass: 'border-l-4 border-l-[#DC2626]',
        badgeClass: 'bg-[#DC2626] text-white shadow-2xs font-extrabold',
        dotClass: 'bg-[#DC2626]',
        avatarBg: 'bg-rose-100 text-[#DC2626] border border-rose-200',
        iconColor: 'text-[#DC2626]',
        badgeText: 'EXPIRED',
      };
    }
  }

  // 1. ENQUIRY → BLUE (#2563EB)
  if (
    rawType.includes('enquiry') ||
    rawTitle.includes('enquiry') ||
    rawReason.includes('enquiry')
  ) {
    return {
      key: 'enquiry',
      label: 'ENQUIRY',
      bgClass: 'bg-[#EFF6FF] hover:bg-[#EBF3FF]',
      borderClass: 'border-[#BFDBFE]',
      leftBorderClass: 'border-l-4 border-l-[#2563EB]',
      badgeClass: 'bg-[#2563EB] text-white shadow-2xs font-extrabold',
      dotClass: 'bg-[#2563EB]',
      avatarBg: 'bg-blue-100 text-[#2563EB] border border-blue-200',
      iconColor: 'text-[#2563EB]',
      badgeText: 'ENQUIRY',
    };
  }

  // 2. EXPIRED → RED (#DC2626)
  if (
    rawType.includes('expired') ||
    rawTitle.includes('expired') ||
    rawReason.includes('expired')
  ) {
    return {
      key: 'expired',
      label: 'EXPIRED',
      bgClass: 'bg-[#FEF2F2] hover:bg-[#FDE8E8]',
      borderClass: 'border-[#FECACA]',
      leftBorderClass: 'border-l-4 border-l-[#DC2626]',
      badgeClass: 'bg-[#DC2626] text-white shadow-2xs font-extrabold',
      dotClass: 'bg-[#DC2626]',
      avatarBg: 'bg-rose-100 text-[#DC2626] border border-rose-200',
      iconColor: 'text-[#DC2626]',
      badgeText: 'EXPIRED',
    };
  }

  // 3. BALANCE / PAYMENT DUE → YELLOW / AMBER (#D97706)
  if (
    rawType.includes('balance') ||
    rawType.includes('payment') ||
    rawType.includes('pending') ||
    rawTitle.includes('balance') ||
    rawReason.includes('balance') ||
    rawReason.includes('pending')
  ) {
    const isOverdue = Boolean(task?.isOverdue) || (task?.dueDate && task.dueDate < new Date().toISOString().split('T')[0] && task.status !== 'Completed' && task.status !== 'completed');

    if (isOverdue) {
      return {
        key: 'balance',
        label: 'BALANCE FOLLOW-UP',
        bgClass: 'bg-[#FEF2F2] hover:bg-[#FDE8E8]',
        borderClass: 'border-[#FECACA]',
        leftBorderClass: 'border-l-4 border-l-[#DC2626]',
        badgeClass: 'bg-[#DC2626] text-white shadow-2xs font-extrabold',
        dotClass: 'bg-[#DC2626]',
        avatarBg: 'bg-rose-100 text-[#DC2626] border border-rose-200',
        iconColor: 'text-[#DC2626]',
        badgeText: 'OVERDUE BALANCE FOLLOW-UP',
      };
    }

    return {
      key: 'balance',
      label: 'BALANCE FOLLOW-UP',
      bgClass: 'bg-[#FFFBEB] hover:bg-[#FEF3C7]',
      borderClass: 'border-[#FDE68A]',
      leftBorderClass: 'border-l-4 border-l-[#D97706]',
      badgeClass: 'bg-[#FEF3C7] text-[#B45309] border border-[#FCD34D] shadow-2xs font-extrabold',
      dotClass: 'bg-[#D97706]',
      avatarBg: 'bg-amber-100 text-[#D97706] border border-amber-200',
      iconColor: 'text-[#D97706]',
      badgeText: 'BALANCE FOLLOW-UP',
    };
  }

  // 4. GYM MEMBERSHIP RENEWAL → GREEN (#16A34A)
  if (
    rawType.includes('renewal') ||
    rawType.includes('membership') ||
    rawType.includes('pt') ||
    rawTitle.includes('renewal') ||
    rawReason.includes('renewal')
  ) {
    return {
      key: 'renewal',
      label: String(task?.type || 'GYM MEMBERSHIP RENEWAL').toUpperCase(),
      bgClass: 'bg-[#F0FDF4] hover:bg-[#DCFCE7]',
      borderClass: 'border-[#BBF7D0]',
      leftBorderClass: 'border-l-4 border-l-[#16A34A]',
      badgeClass: 'bg-[#16A34A] text-white shadow-2xs font-extrabold',
      dotClass: 'bg-[#16A34A]',
      avatarBg: 'bg-emerald-100 text-[#16A34A] border border-emerald-200',
      iconColor: 'text-[#16A34A]',
      badgeText: String(task?.type || 'GYM MEMBERSHIP RENEWAL').toUpperCase(),
    };
  }

  // 5. Default Other / General → PURPLE (#9333EA)
  return {
    key: 'general',
    label: String(task?.type || 'OTHER').toUpperCase(),
    bgClass: 'bg-[#F3E8FF] hover:bg-[#EDE9FE]',
    borderClass: 'border-[#E9D5FF]',
    leftBorderClass: 'border-l-4 border-l-[#9333EA]',
    badgeClass: 'bg-[#9333EA] text-white shadow-2xs font-extrabold',
    dotClass: 'bg-[#9333EA]',
    avatarBg: 'bg-purple-100 text-[#9333EA] border border-purple-200',
    iconColor: 'text-[#9333EA]',
    badgeText: String(task?.type || 'OTHER').toUpperCase(),
  };
}
