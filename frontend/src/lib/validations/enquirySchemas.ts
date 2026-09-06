import { z } from 'zod';

/**
 * enquirySchemas.ts
 * ─────────────────────────────────────────────────────────────────
 * Centralized Zod Validation Schemas for Enquiries / Leads Module
 * ─────────────────────────────────────────────────────────────────
 */

// Name regex: Letters, spaces, apostrophes, hyphens only
export const NAME_REGEX = /^[A-Za-z\s'\-]+$/;

// Indian 10-digit mobile number regex (starts with 6, 7, 8, or 9)
export const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

// Clean phone digits helper
export const cleanPhoneDigits = (phone?: string): string => {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
};

// Available Plans
export const ENQUIRY_PLANS = [
  '1 month',
  '2 months',
  '3 months',
  '6 months',
  '12 months',
  'Day Pass',
  'Monthly Standard',
  'Quarterly Prime',
  'Annual VIP'
] as const;

// Available Sources
export const ENQUIRY_SOURCES = [
  'Walk-in',
  'Instagram',
  'Facebook',
  'Google Ad',
  'Referral',
  'Phone Inquiry',
  'Excel Import',
  'Other'
] as const;

// Available Statuses
export const ENQUIRY_STATUSES = [
  'Pending',
  'Hot',
  'Warm',
  'Cold',
  'Converted',
  'Closed',
  'Lost'
] as const;

// Available Priorities
export const ENQUIRY_PRIORITIES = ['Hot', 'Warm', 'Cold'] as const;

/**
 * 1. Create New Enquiry Schema
 */
export const createEnquirySchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(2, 'First name must contain at least 2 characters')
    .max(50, 'First name cannot exceed 50 characters')
    .regex(NAME_REGEX, 'First name can only contain letters and spaces'),
  
  lastName: z
    .string()
    .trim()
    .max(50, 'Last name cannot exceed 50 characters')
    .optional()
    .refine((val) => !val || val.length >= 2, {
      message: 'Last name must contain at least 2 characters if entered'
    })
    .refine((val) => !val || NAME_REGEX.test(val), {
      message: 'Last name can only contain letters and spaces'
    }),

  contact: z
    .string()
    .trim()
    .transform((val) => val.replace(/\D/g, ''))
    .pipe(
      z
        .string()
        .min(10, 'Mobile number must be exactly 10 digits')
        .max(10, 'Mobile number cannot exceed 10 digits')
        .regex(INDIAN_MOBILE_REGEX, 'Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9')
    ),

  altContact: z
    .string()
    .trim()
    .optional()
    .transform((val) => (val ? val.replace(/\D/g, '') : ''))
    .refine((val) => !val || (val.length === 10 && INDIAN_MOBILE_REGEX.test(val)), {
      message: 'Alternate contact must be a valid 10-digit Indian mobile number'
    }),

  email: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Enter a valid email address (e.g. rahul@example.com)'
    }),

  gender: z.enum(['Male', 'Female', 'Other']).default('Male'),

  address: z
    .string()
    .trim()
    .max(300, 'Address cannot exceed 300 characters')
    .optional(),

  inquiryFor: z
    .string()
    .trim()
    .min(1, 'Please select an interested plan')
    .refine((val) => val !== 'Select Plan...', {
      message: 'Please select an interested plan'
    }),

  followupDate: z
    .string()
    .trim()
    .min(1, 'Please select a valid follow-up date')
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Enter a valid calendar date (YYYY-MM-DD)'
    }),

  followupTime: z.string().trim().default('11:00'),

  attendedBy: z
    .string()
    .trim()
    .min(1, 'Please select an assigned representative')
    .refine((val) => val !== 'Select Representative...', {
      message: 'Please select an assigned representative'
    }),

  priority: z.enum(['Hot', 'Warm', 'Cold']).default('Warm'),

  source: z.string().trim().min(1, 'Please select a source').default('Walk-in'),

  remarks: z
    .string()
    .trim()
    .max(1000, 'Remarks cannot exceed 1000 characters')
    .optional()
});

export type CreateEnquiryInput = z.infer<typeof createEnquirySchema>;

/**
 * 2. Edit Enquiry Schema
 */
export const editEnquirySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Name must contain at least 2 characters')
    .max(100, 'Name cannot exceed 100 characters')
    .regex(NAME_REGEX, 'Name can only contain letters and spaces'),

  phone: z
    .string()
    .trim()
    .transform((val) => val.replace(/\D/g, ''))
    .pipe(
      z
        .string()
        .min(10, 'Mobile number must be exactly 10 digits')
        .max(10, 'Mobile number cannot exceed 10 digits')
        .regex(INDIAN_MOBILE_REGEX, 'Enter a valid 10-digit mobile number starting with 6, 7, 8, or 9')
    ),

  email: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Enter a valid email address'
    }),

  duration: z
    .string()
    .trim()
    .min(1, 'Please select an interested plan'),

  assignedTo: z
    .string()
    .trim()
    .min(1, 'Please select an assigned representative'),

  nextFollowUpDate: z
    .string()
    .trim()
    .min(1, 'Please select a valid follow-up date')
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Enter a valid calendar date'
    }),

  status: z.enum(['Pending', 'Hot', 'Warm', 'Cold', 'Converted', 'Closed', 'Lost']).default('Pending'),

  remarks: z
    .string()
    .trim()
    .max(1000, 'Remarks cannot exceed 1000 characters')
    .optional()
});

export type EditEnquiryInput = z.infer<typeof editEnquirySchema>;

/**
 * 3. Schedule / Reschedule Follow-up Schema
 */
export const scheduleFollowUpSchema = z.object({
  followUpDate: z
    .string()
    .trim()
    .min(1, 'Please select a follow-up date')
    .refine((val) => !isNaN(Date.parse(val)), {
      message: 'Enter a valid calendar date (YYYY-MM-DD)'
    }),
  
  followUpTime: z.string().trim().default('11:00'),
  
  assignedTo: z.string().trim().optional(),

  notes: z
    .string()
    .trim()
    .max(500, 'Notes cannot exceed 500 characters')
    .optional()
});

export type ScheduleFollowUpInput = z.infer<typeof scheduleFollowUpSchema>;

/**
 * 4. Convert Enquiry to Member Schema
 */
export const convertEnquirySchema = z.object({
  plan: z.string().trim().min(1, 'Please select a membership package'),
  price: z
    .number({ message: 'Package price must be a valid number' })
    .min(0, 'Price cannot be negative'),
  startDate: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Enter a valid start date'
    })
});

export type ConvertEnquiryInput = z.infer<typeof convertEnquirySchema>;

/**
 * 5. Add Communication Log / History Note Schema
 */
export const addCommunicationLogSchema = z.object({
  type: z.enum(['Call', 'WhatsApp', 'Visit', 'Email', 'Note'], {
    message: 'Select a valid communication type'
  }),
  outcome: z.string().trim().min(1, 'Please select an interaction outcome'),
  notes: z
    .string()
    .trim()
    .min(2, 'Notes must be at least 2 characters')
    .max(1000, 'Notes cannot exceed 1000 characters')
});

export type AddCommunicationLogInput = z.infer<typeof addCommunicationLogSchema>;

/**
 * 6. Update Status Schema
 */
export const updateEnquiryStatusSchema = z.object({
  status: z.enum(['Pending', 'Hot', 'Warm', 'Cold', 'Converted', 'Closed', 'Lost'], {
    message: 'Please select a valid enquiry status'
  })
});

/**
 * 7. Assign Representative Schema
 */
export const assignRepresentativeSchema = z.object({
  assignedTo: z
    .string()
    .trim()
    .min(1, 'Representative name/ID cannot be empty')
});

/**
 * 8. Update Priority Schema
 */
export const updatePrioritySchema = z.object({
  priority: z.enum(['Hot', 'Warm', 'Cold'], {
    message: 'Select a valid priority level'
  })
});
