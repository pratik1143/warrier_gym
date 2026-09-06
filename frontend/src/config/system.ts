/**
 * Centralized System Configuration for The Warrior Gym OS
 * Software live date: 23-Aug-2026
 */
export const SYSTEM_CONFIG = {
  startDate: '2026-08-23', // Format: YYYY-MM-DD
  timezone: 'Asia/Kolkata',
  gymName: 'The Warrior Gym',
  branch: 'Mohali, Punjab',
} as const;

export const SYSTEM_START_DATE = SYSTEM_CONFIG.startDate;
