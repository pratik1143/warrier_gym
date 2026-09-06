import { z } from 'zod';

export const NAME_REGEX = /^[A-Za-z\s'\-]+$/;
export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export const createEnquiryBackendSchema = z.object({
  name: z.string().trim().min(2, 'Name must contain at least 2 characters').max(100).optional(),
  firstName: z.string().trim().min(2, 'First Name must contain at least 2 characters').max(50).optional(),
  lastName: z.string().trim().max(50).optional(),
  phone: z.string().trim().optional(),
  contact: z.string().trim().optional(),
  altPhone: z.string().trim().optional(),
  altContact: z.string().trim().optional(),
  email: z.string().trim().optional().refine(val => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), 'Invalid email format'),
  gender: z.string().optional().default('Male'),
  address: z.string().trim().max(300).optional(),
  nextFollowUpDate: z.string().trim().optional(),
  nextFollowUp: z.string().trim().optional(),
  followupDate: z.string().trim().optional(),
  followUpTime: z.string().trim().optional().default('11:00'),
  status: z.string().optional().default('Pending'),
  assignedTo: z.string().trim().optional(),
  attendedBy: z.string().trim().optional(),
  priority: z.string().optional().default('Warm'),
  source: z.string().optional().default('Walk-in'),
  interestedPlan: z.string().optional(),
  inquiryFor: z.string().optional(),
  duration: z.string().optional(),
  remarks: z.string().trim().max(1000).optional()
}).refine(data => {
  const rawPhone = (data.phone || data.contact || '').replace(/\D/g, '');
  return rawPhone.length === 10 && INDIAN_MOBILE_REGEX.test(rawPhone);
}, {
  message: 'Enter a valid 10-digit Indian mobile number',
  path: ['phone']
});

export const updateEnquiryBackendSchema = z.object({
  name: z.string().trim().min(2, 'Name must contain at least 2 characters').max(100).optional(),
  phone: z.string().trim().optional().refine(val => {
    if (!val) return true;
    const clean = val.replace(/\D/g, '');
    return clean.length === 10 && INDIAN_MOBILE_REGEX.test(clean);
  }, 'Enter a valid 10-digit Indian mobile number'),
  email: z.string().trim().optional().refine(val => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), 'Invalid email format'),
  duration: z.string().optional(),
  interestedPlan: z.string().optional(),
  assignedTo: z.string().optional(),
  nextFollowUpDate: z.string().optional(),
  nextFollowUp: z.string().optional(),
  status: z.string().optional(),
  remarks: z.string().trim().max(1000).optional()
});

export const convertEnquiryBackendSchema = z.object({
  plan: z.string().trim().min(1, 'Membership plan is required'),
  price: z.union([z.string(), z.number()]).transform(val => Number(val)).refine(val => !isNaN(val) && val >= 0, 'Price must be a valid positive number')
});
