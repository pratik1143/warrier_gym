'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, User, Phone, Mail, Calendar, Heart, Shield, Smartphone, 
  CheckCircle2, ArrowRight, ArrowLeft, CreditCard, DollarSign, 
  Printer, Download, Sparkles, Fingerprint, Banknote, Wallet, 
  ChevronRight, Dumbbell, Award, AlertCircle, FileText, Upload, Camera, Trash2, RefreshCw, AlertTriangle, Check, SwitchCamera, Lock
} from 'lucide-react';
import toast from '@/lib/toast';
import { useGymStore } from '@/store';
import OfficialInvoiceReceipt from '@/app/dashboard/components/OfficialInvoiceReceipt';
import API from '@/services/api';
import { membershipEngine } from '@/lib/engines/membershipEngine';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { z } from 'zod';
import { getActiveTrainers } from '@/services/staff.service';

interface AddMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialBiometricId?: string;
  biometricAlreadyOnDevice?: boolean;
  fingerprintDeviceId?: string;
}

// ─── ZOD SCHEMAS ───

const step1Schema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(80, 'Full name is too long'),
  mobile: z
    .string()
    .trim()
    .regex(/^(\+91[\s-]?)?[6-9]\d{9}$/, 'Enter a valid 10-digit Indian mobile number'),
  email: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: 'Enter a valid email address',
    }),
  gender: z.enum(['Male', 'Female', 'Other']).default('Male'),
});

const step2Schema = z.object({
  dob: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const d = new Date(val);
      return !isNaN(d.getTime()) && d <= new Date();
    }, { message: 'Date of birth cannot be in the future' }),
  weight: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, { message: 'Weight must be greater than 0' }),
  height: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, { message: 'Height must be greater than 0' }),
  emergencyContact: z
    .string()
    .optional()
    .refine((val) => {
      if (!val) return true;
      return /^[0-9+\s-]{10,15}$/.test(val);
    }, { message: 'Enter a valid 10-15 digit phone number' }),
  maritalStatus: z.string().optional(),
  anniversaryDate: z.string().optional(),
}).refine((data) => {
  if (data.maritalStatus === 'married') {
    return !!data.anniversaryDate && data.anniversaryDate.trim().length > 0;
  }
  return true;
}, {
  message: 'Anniversary Date is required when Married',
  path: ['anniversaryDate'],
});

const ptStepSchema = z.object({
  ptAmount: z.number().min(0, 'PT amount cannot be negative'),
  ptDiscount: z.number().min(0, 'Discount cannot be negative'),
  ptTax: z.number().min(0, 'Tax cannot be negative'),
  ptStartDate: z.string().min(1, 'Please select PT start date'),
  ptExpiryDate: z.string().min(1, 'Please select PT expiry date'),
}).refine((data) => {
  if (!data.ptStartDate || !data.ptExpiryDate) return true;
  return new Date(data.ptExpiryDate) >= new Date(data.ptStartDate);
}, {
  message: 'PT Expiry Date cannot be before Start Date',
  path: ['ptExpiryDate'],
});

const MAX_PHOTO_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

function deduplicatePackages(rawPlans: any[]) {
  const map = new Map<string, any>();
  rawPlans.forEach((p) => {
    const name = String(p.name || '').trim().toLowerCase();
    const duration = String(p.duration || '').trim().toLowerCase();
    const key = `${name}_${duration}`;
    if (key && !map.has(key)) {
      map.set(key, p);
    }
  });
  return Array.from(map.values());
}

export default function AddMemberModal({ isOpen, onClose, initialBiometricId = '', biometricAlreadyOnDevice = false, fingerprintDeviceId = '' }: AddMemberModalProps) {
  const { plans, fetchPlans, addMember, fetchPayments, members, fetchNextBiometricId } = useGymStore();

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Field Errors State
  const [step1Errors, setStep1Errors] = useState<Record<string, string>>({});
  const [step2Errors, setStep2Errors] = useState<Record<string, string>>({});
  const [ptErrors, setPtErrors] = useState<Record<string, string>>({});
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Step 1: Basic Bio Information (NO payment/billing fields here!)
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState('Male');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  // Live Camera Capture Modal State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const rawPlans = plans && plans.length > 0 ? plans : [
    { id: 'p_mon', name: '1 MONTH', price: 3000, duration: '30 Days' },
    { id: 'p_qrt', name: '3 MONTHS', price: 6500, duration: '90 Days' },
    { id: 'p_semi', name: '6 MONTHS', price: 9500, duration: '180 Days' },
    { id: 'p_plus', name: '3+1 MONTH', price: 7500, duration: '120 Days' },
    { id: 'p_ann', name: 'ANNUAL PREMIUM', price: 14000, duration: '365 Days' },
    { id: 'p_day', name: '10 DAYS', price: 1000, duration: '10 Days' },
  ];

  const activePlans = deduplicatePackages(rawPlans);
  const [selectedPlan, setSelectedPlan] = useState<any>(activePlans[0]);

  // Canonical Active Trainers Query for Personal Trainer Selection
  const [trainersList, setTrainersList] = useState<any[]>([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const fetchActiveTrainers = async () => {
      try {
        const activeTrns = await getActiveTrainers();
        setTrainersList(activeTrns);
      } catch (err) {
        console.warn("Failed to fetch active trainers via service:", err);
      }
    };

    fetchActiveTrainers();

    const qEmp = query(collection(db, 'employees'));
    const unsub = onSnapshot(qEmp, async () => {
      try {
        const activeTrns = await getActiveTrainers();
        setTrainersList(activeTrns);
      } catch (err) {
        console.warn("Realtime active trainers sync notice:", err);
      }
    }, (err) => {
      console.warn("Employees query listener notice in AddMemberModal:", err);
    });

    return () => unsub();
  }, [isOpen]);

  const selectedTrainerObj = useMemo(() => {
    if (!selectedTrainerId) return null;
    return trainersList.find(t => String(t.id || t.employeeId) === String(selectedTrainerId)) || null;
  }, [selectedTrainerId, trainersList]);

  const hasPt = Boolean(selectedTrainerId);

  // Step 2: Personal & Health Details
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [dob, setDob] = useState('');
  const [maritalStatus, setMaritalStatus] = useState<'single' | 'married'>('single');
  const [anniversaryDate, setAnniversaryDate] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [occupation, setOccupation] = useState('');
  const [address, setAddress] = useState('');

  // Step 3: Biometric Fingerprint Enrollment
  const [biometricId, setBiometricId] = useState('');
  const [isRefreshingBiometricId, setIsRefreshingBiometricId] = useState(false);
  const [enrollStatus, setEnrollStatus] = useState<'idle' | 'enrolling' | 'success' | 'failed'>('idle');
  const [enrollMsg, setEnrollMsg] = useState('');
  // Hikvision DS-K1T320EFWX terminal state
  const [hikvisionOnline, setHikvisionOnline] = useState<boolean | null>(null);
  const [faceEnrolled, setFaceEnrolled] = useState(false);
  const [fingerEnrolled, setFingerEnrolled] = useState(false);
  const [enrollPhase, setEnrollPhase] = useState<'FACE' | 'FINGERPRINT' | null>(null);

  // Step 4: Membership Billing & Payment Section
  const [invoiceDate, setInvoiceDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [startDate, setStartDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [expiryDate, setExpiryDate] = useState<string>('');
  const [isExpiryManuallyEdited, setIsExpiryManuallyEdited] = useState(false);

  const [originalAmount, setOriginalAmount] = useState<string>('3000');
  const [discountType, setDiscountType] = useState<'amount' | 'percentage'>('amount');
  const [discountValue, setDiscountValue] = useState<string>('0');
  const [taxAmount, setTaxAmount] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'NetBanking'>('UPI');
  const [paymentStatus, setPaymentStatus] = useState<'paid' | 'partial' | 'pending'>('paid');
  const [amountPaid, setAmountPaid] = useState<string>('3000');

  // Step 5 (If PT Selected): PT Billing Details
  const [ptDuration, setPtDuration] = useState('3 Months');
  const [ptAmount, setPtAmount] = useState('6000');
  const [ptDiscount, setPtDiscount] = useState('0');
  const [ptTax, setPtTax] = useState('0');
  const [ptPaymentMethod, setPtPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'NetBanking'>('UPI');
  const [ptStartDate, setPtStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [ptExpiryDate, setPtExpiryDate] = useState('');
  const [ptAmountPaid, setPtAmountPaid] = useState('6000');

  // Lock body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Update default package pricing & auto-calculate expiry date when plan or start date changes
  useEffect(() => {
    if (selectedPlan) {
      const pPrice = (Number(selectedPlan.price) || 3000).toString();
      setOriginalAmount(pPrice);

      if (!isExpiryManuallyEdited) {
        const calculatedExp = membershipEngine.calculateMembershipExpiry(startDate, selectedPlan.duration || selectedPlan.name || '1 Month');
        setExpiryDate(calculatedExp);
      }
    }
  }, [selectedPlan, startDate, isExpiryManuallyEdited]);

  // Calculate dynamic discount, tax, net payable and pending amounts
  const basePriceNum = Number(originalAmount) || 0;
  const discValNum = Number(discountValue) || 0;
  const computedDiscAmt = discountType === 'percentage'
    ? Math.min(basePriceNum, (basePriceNum * discValNum) / 100)
    : Math.min(basePriceNum, discValNum);
  const taxAmtNum = Number(taxAmount) || 0;
  const finalPayableNum = Math.max(0, basePriceNum - computedDiscAmt + taxAmtNum);

  // Sync amountPaid when paymentStatus or finalPayableNum changes
  useEffect(() => {
    if (paymentStatus === 'paid') {
      setAmountPaid(finalPayableNum.toString());
    } else if (paymentStatus === 'pending') {
      setAmountPaid('0');
    }
  }, [paymentStatus, finalPayableNum]);

  const paidAmtNum = paymentStatus === 'paid'
    ? finalPayableNum
    : (paymentStatus === 'pending' ? (amountPaid ? Number(amountPaid) : 0) : Number(amountPaid) || 0);
  const pendingAmtNum = Math.max(0, finalPayableNum - paidAmtNum);

  // Auto-calculate PT Expiry Date
  useEffect(() => {
    if (!ptStartDate) return;
    const start = new Date(ptStartDate);
    if (isNaN(start.getTime())) return;

    const expiry = new Date(start);
    if (ptDuration === '1 Month') {
      expiry.setMonth(expiry.getMonth() + 1);
      expiry.setDate(expiry.getDate() - 1);
    } else if (ptDuration === '3 Months') {
      expiry.setMonth(expiry.getMonth() + 3);
      expiry.setDate(expiry.getDate() - 1);
    } else if (ptDuration === '6 Months') {
      expiry.setMonth(expiry.getMonth() + 6);
      expiry.setDate(expiry.getDate() - 1);
    } else if (ptDuration === '12 Months') {
      expiry.setFullYear(expiry.getFullYear() + 1);
      expiry.setDate(expiry.getDate() - 1);
    }
    setPtExpiryDate(expiry.toISOString().split('T')[0]);
  }, [ptStartDate, ptDuration]);

  // Update default PT price when duration changes
  useEffect(() => {
    let base = 6000;
    if (ptDuration === '1 Month') base = 2500;
    else if (ptDuration === '3 Months') base = 6000;
    else if (ptDuration === '6 Months') base = 11000;
    else if (ptDuration === '12 Months') base = 20000;
    setPtAmount(base.toString());
    const disc = Number(ptDiscount) || 0;
    const tax = Number(ptTax) || 0;
    const net = Math.max(0, base - disc + tax);
    setPtAmountPaid(net.toString());
  }, [ptDuration]);

  // Update PT Amount Paid
  useEffect(() => {
    const amt = Number(ptAmount) || 0;
    const disc = Number(ptDiscount) || 0;
    const tax = Number(ptTax) || 0;
    const net = Math.max(0, amt - disc + tax);
    setPtAmountPaid(net.toString());
  }, [ptAmount, ptDiscount, ptTax]);

  // Final Invoices
  const [createdInvoice, setCreatedInvoice] = useState<any | null>(null);
  const [createdPtInvoice, setCreatedPtInvoice] = useState<any | null>(null);
  const [createdMember, setCreatedMember] = useState<any | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Auto-generate permanent sequential Biometric ID
  useEffect(() => {
    let active = true;
    if (isOpen) {
      if (/^\d{1,5}$/.test(initialBiometricId) && Number(initialBiometricId) > 0) {
        setBiometricId(initialBiometricId);
      } else {
        fetchNextBiometricId().then((nextId) => {
          if (active && nextId) setBiometricId(nextId);
        }).catch(() => {});
      }
      if (activePlans.length > 0 && !selectedPlan) {
        setSelectedPlan(activePlans[0]);
      }
    }
    return () => { active = false; };
  }, [isOpen, fetchNextBiometricId, initialBiometricId]);

  // Check duplicate phone
  const duplicateMember = useMemo(() => {
    if (!mobile || mobile.trim().length < 10) return null;
    const rawDigits = mobile.replace(/\D/g, '').slice(-10);
    return members.find((m: any) => {
      const mDigits = String(m.phone || '').replace(/\D/g, '').slice(-10);
      return mDigits === rawDigits;
    });
  }, [mobile, members]);

  // Photo File Upload Handler
  const handlePhotoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoError(null);
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      setPhotoError('Only JPG, PNG, and WEBP formats are allowed.');
      return;
    }
    if (file.size > MAX_PHOTO_SIZE_BYTES) {
      setPhotoError('File size must be less than 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Webcam Camera Stream Handlers
  const startCameraCapture = async () => {
    setCameraError(null);
    setIsCameraOpen(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 720 }, height: { ideal: 720 } },
        audio: false
      });
      setCameraStream(stream);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err: any) {
      setCameraError('Camera access denied or unavailable. Please upload a photo instead.');
    }
  };

  const stopCameraCapture = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    setIsCameraOpen(false);
  };

  const takeSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight) || 400;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const startX = (video.videoWidth - size) / 2;
      const startY = (video.videoHeight - size) / 2;
      ctx.drawImage(video, startX, startY, size, size, 0, 0, size, size);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      setPhotoPreview(dataUrl);
      setPhotoError(null);
      stopCameraCapture();
      toast.success('Photo captured successfully!');
    }
  };

  // Step 1 Validation Trigger
  const validateStep1 = () => {
    const parseRes = step1Schema.safeParse({
      fullName,
      gender: gender as any,
      mobile,
      email: email || undefined,
    });

    if (!parseRes.success) {
      const errors: Record<string, string> = {};
      parseRes.error.issues.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      setStep1Errors(errors);
      return false;
    }

    setStep1Errors({});
    return true;
  };

  // Step 2 Validation Trigger
  const validateStep2 = () => {
    const parseRes = step2Schema.safeParse({
      dob: dob || undefined,
      weight: weight || undefined,
      height: height || undefined,
      emergencyContact: emergencyContact || undefined,
      maritalStatus,
      anniversaryDate: anniversaryDate || undefined,
    });

    if (!parseRes.success) {
      const errors: Record<string, string> = {};
      parseRes.error.issues.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      setStep2Errors(errors);
      return false;
    }

    setStep2Errors({});
    return true;
  };

  // Step 4 Membership & Billing Validation Trigger
  const validateStep4 = () => {
    if (!selectedPlan) {
      toast.error('Please select a membership package');
      return false;
    }
    if (!invoiceDate) {
      toast.error('Invoice Date is required');
      return false;
    }
    if (!startDate) {
      toast.error('Membership Start Date is required');
      return false;
    }
    if (!expiryDate) {
      toast.error('Membership Expiry Date is required');
      return false;
    } else if (startDate && new Date(expiryDate) < new Date(startDate)) {
      toast.error('Expiry date cannot be before start date');
      return false;
    }
    if (discValNum < 0) {
      toast.error('Discount value cannot be negative');
      return false;
    }
    if (computedDiscAmt > basePriceNum) {
      toast.error('Discount cannot exceed original package amount');
      return false;
    }
    if (paidAmtNum > finalPayableNum) {
      toast.error('Amount paid cannot exceed final payable amount');
      return false;
    }
    if (paidAmtNum < 0) {
      toast.error('Amount paid cannot be negative');
      return false;
    }
    return true;
  };

  // PT Step Validation
  const validatePtStep = () => {
    const parseRes = ptStepSchema.safeParse({
      ptAmount: Number(ptAmount) || 0,
      ptDiscount: Number(ptDiscount) || 0,
      ptTax: Number(ptTax) || 0,
      ptStartDate,
      ptExpiryDate,
    });

    if (!parseRes.success) {
      const errors: Record<string, string> = {};
      parseRes.error.issues.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0].toString()] = err.message;
        }
      });
      setPtErrors(errors);
      return false;
    }

    setPtErrors({});
    return true;
  };

  // ── Hikvision helpers ──
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const checkHikvisionStatus = async (notify = true) => {
    try {
      const resp = await API.post('/devices/hikvision/test-connection');
      const online = resp.data?.success === true || resp.data?.online === true || resp.data?.status === 'ONLINE';
      setHikvisionOnline(online);
      if (notify) (online ? toast.success('Hikvision terminal connected ✓') : toast.error('Hikvision terminal unreachable'));
      return online;
    } catch {
      setHikvisionOnline(false);
      if (notify) toast.error('Could not reach Hikvision terminal');
      return false;
    }
  };

  useEffect(() => {
    if (!isOpen || step !== 3 || biometricAlreadyOnDevice) return;
    void checkHikvisionStatus(false);
    const timer = window.setInterval(() => void checkHikvisionStatus(false), 8000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, step, biometricAlreadyOnDevice]);

  const queryDeviceStatus = async (bioId: string) => {
    try {
      const resp = await API.get(`/devices/hikvision/enrollment-status/${bioId}`);
      return resp.data?.success ? resp.data : null;
    } catch {
      return null;
    }
  };

  // Runs one enrollment phase on the terminal and polls until the device confirms it.
  const runHikvisionPhase = async (type: 'FACE' | 'FINGERPRINT'): Promise<boolean> => {
    setEnrollPhase(type);
    setEnrollMsg(type === 'FACE'
      ? `Face enrollment started. Look at the Hikvision terminal camera (ID #${biometricId})...`
      : `Fingerprint enrollment started. Place the finger on the terminal scanner (ID #${biometricId})...`);
    try {
      const response = await API.post('/devices/hikvision/enroll', {
        memberId: 'new_' + Date.now(),
        memberName: fullName || 'New Member',
        biometricId,
        employeeNo: biometricId,
        deviceId: 'hikvision-main-gate',
        enrollmentType: type,
        flow: type === 'FACE' ? 'FACE_ONLY' : 'FINGERPRINT_ONLY',
      });
      if (response.data?.success !== true) {
        throw new Error(response.data?.error || response.data?.message || 'The local agent did not accept the command.');
      }
    } catch (e: any) {
      setEnrollMsg(e.response?.data?.error || e.message || 'Enrollment command failed.');
      return false;
    }
    const maxAttempts = 36; // ~54s
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await sleep(1500);
      const dev = await queryDeviceStatus(biometricId);
      if (dev?.enrollmentStatus === 'terminal_action_required') {
        setEnrollMsg('Agent reached the terminal. Complete the capture on the terminal screen and keep this window open.');
      }
      if (dev?.enrollmentStatus === 'failed' || dev?.enrollmentStatus === 'timed_out') {
        setEnrollMsg(dev.error || 'The terminal did not complete enrollment.');
        return false;
      }
      const done = type === 'FACE'
        ? !!(dev && (dev.hasFace || (dev.numOfFace && dev.numOfFace > 0)))
        : !!(dev && (dev.hasFingerprint || (dev.numOfFP && dev.numOfFP > 0)));
      if (done) {
        if (type === 'FACE' && dev?.photoUrl) setPhotoPreview(dev.photoUrl);
        return true;
      }
    }
    setEnrollMsg(`${type === 'FACE' ? 'Face' : 'Fingerprint'} was not confirmed by the terminal in time.`);
    return false;
  };

  // Biometric Enrollment Trigger (Hikvision): FACE, FINGERPRINT or BOTH
  const handleStartBiometricEnrollment = async (type: 'FACE' | 'FINGERPRINT' | 'BOTH' = 'FACE') => {
    if (!validateBiometricId()) return;
    setEnrollStatus('enrolling');
    setEnrollMsg('Checking Hikvision terminal connection...');
    const online = await checkHikvisionStatus(false);
    if (!online) {
      setEnrollStatus('failed');
      setEnrollMsg('Hikvision terminal is offline. You can skip: the server will set up face & fingerprint automatically once the terminal is back.');
      return;
    }
    let faceOk = faceEnrolled;
    let fpOk = fingerEnrolled;
    if (type === 'FACE' || type === 'BOTH') {
      faceOk = await runHikvisionPhase('FACE');
      setFaceEnrolled(faceOk);
    }
    if (type === 'FINGERPRINT' || (type === 'BOTH' && faceOk)) {
      fpOk = await runHikvisionPhase('FINGERPRINT');
      setFingerEnrolled(fpOk);
    }
    setEnrollPhase(null);
    const wanted = type === 'BOTH' ? (faceOk && fpOk) : type === 'FACE' ? faceOk : fpOk;
    if (wanted) {
      setEnrollStatus('success');
      setEnrollMsg(`✓ ${type === 'BOTH' ? 'Face & fingerprint' : type === 'FACE' ? 'Face' : 'Fingerprint'} enrolled for ID #${biometricId}`);
      toast.success('Biometric enrolled on Hikvision terminal');
      if (type !== 'BOTH' || (faceOk && fpOk)) setTimeout(() => setStep(4), 900);
    } else {
      setEnrollStatus('failed');
      toast.error('Enrollment incomplete. Retry, or skip and let the server finish it.');
    }
  };

  const validateBiometricId = () => {
    const value = biometricId.trim();
    if (!/^\d{1,5}$/.test(value) || Number(value) < 1 || Number(value) > 65535) {
      toast.error('Biometric ID must be a number from 1 to 65535.');
      return false;
    }
    const duplicate = members.find((m: any) => {
      const ids = [m.biometricId, m.deviceUserId].filter(Boolean).map((id: any) => Number(id));
      return ids.includes(Number(value));
    });
    if (duplicate) {
      toast.error(`Biometric ID ${value} is already linked to ${duplicate.name || 'another member'}.`);
      return false;
    }
    return true;
  };

  const handleUseNextBiometricId = async () => {
    setIsRefreshingBiometricId(true);
    try {
      const nextId = await fetchNextBiometricId();
      if (nextId) {
        setBiometricId(String(nextId));
        setEnrollStatus('idle');
        setEnrollMsg('');
      } else {
        toast.error('Could not load the next available biometric ID. Check the server connection.');
      }
    } catch {
      toast.error('Could not load the next available biometric ID. Check the server connection.');
    } finally {
      setIsRefreshingBiometricId(false);
    }
  };

  // Next Step Action
  const handleNextStep = () => {
    if (step === 1) {
      if (!validateStep1()) {
        toast.error('Please complete required demographic details');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!validateStep2()) {
        toast.error('Please fix the validation errors on Step 2');
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      setStep(4);
      return;
    }

    if (step === 4) {
      if (!validateStep4()) {
        return;
      }
      if (hasPt) {
        setStep(5);
      } else {
        handleSubmitFinal();
      }
      return;
    }

    if (step === 5 && hasPt) {
      if (!validatePtStep()) {
        toast.error('Please review PT billing details');
        return;
      }
      handleSubmitFinal();
      return;
    }
  };

  // Submit Final Member Creation
  const handleSubmitFinal = async () => {
    if (isSubmitting) return;
    if (!validateBiometricId()) {
      setStep(3);
      return;
    }
    setIsSubmitting(true);
    setBackendError(null);

    try {
      const cleanMobile = mobile.replace(/\D/g, '');
      const normalizedPhone = cleanMobile.length === 12 && cleanMobile.startsWith('91') 
        ? cleanMobile.slice(2) 
        : cleanMobile.slice(-10);

      const normalizedEmail = (email || `${normalizedPhone}@thewarriorgym.in`).toLowerCase().trim();

      const todayStr = new Date().toISOString().split('T')[0];
      const invDate = invoiceDate || todayStr;
      const memStartDate = startDate || todayStr;
      const planName = selectedPlan?.name || '1 Month';
      const planDuration = selectedPlan?.duration || planName;
      const expiryStr = expiryDate || membershipEngine.calculateMembershipExpiry(memStartDate, planDuration);

      const computedStatus = membershipEngine.calculateMembershipStatus(expiryStr, memStartDate);

      const memInvoiceNo = `INV-MEM-${Date.now().toString().slice(-6)}`;
      const ptInvoiceNo = hasPt ? `INV-PT-${Date.now().toString().slice(-6)}` : '';
      const onboardingUuid = `add_mem_${normalizedPhone}_${invDate}_${Math.floor(1000 + Math.random() * 9000)}`;
      const trnName = selectedTrainerObj?.name || (selectedTrainerId ? 'Assigned Trainer' : 'Unassigned');

      const memberPayload: any = {
        name: fullName.trim(),
        phone: normalizedPhone,
        email: normalizedEmail,
        photo: photoPreview || '',
        plan: planName,
        planId: selectedPlan?.id || selectedPlan?.name,
        packageId: selectedPlan?.id || selectedPlan?.name,
        packageName: planName,
        price: basePriceNum,
        originalAmount: basePriceNum,
        packagePrice: basePriceNum,
        discountType: discountType,
        discountValue: discValNum,
        discountAmount: computedDiscAmt,
        discount: computedDiscAmt,
        taxAmount: taxAmtNum,
        tax: taxAmtNum,
        netPayable: finalPayableNum,
        amount: finalPayableNum,
        amountPaid: paidAmtNum,
        paid: paidAmtNum,
        pendingAmount: pendingAmtNum,
        outstandingBalance: pendingAmtNum,
        invoiceDate: invDate,
        joinDate: invDate,
        startDate: memStartDate,
        createdAt: new Date().toISOString(),
        expiryDate: expiryStr,
        status: computedStatus,
        paymentStatus: paymentStatus === 'paid' ? 'paid' : (paidAmtNum > 0 ? 'partial' : 'pending'),
        totalBilled: finalPayableNum,
        totalPaid: paidAmtNum,
        biometricId: biometricId,
        deviceUserId: biometricId,
        fingerprintDeviceId: biometricAlreadyOnDevice ? (fingerprintDeviceId || 'hikvision-main-gate') : null,
        hikvisionUserId: biometricId,
        faceEnrollmentStatus: faceEnrolled ? 'ENROLLED' : 'NOT ENROLLED',
        fingerprintEnrollmentStatus: fingerEnrolled ? 'ENROLLED' : 'NOT ENROLLED',
        // If face/finger were skipped or incomplete, the SERVER finishes terminal setup (user + photo sync).
        skipBiometric: !(faceEnrolled && fingerEnrolled) && !biometricAlreadyOnDevice,
        biometricSetup: biometricAlreadyOnDevice ? 'linked' : (faceEnrolled && fingerEnrolled) ? 'complete' : (faceEnrolled || fingerEnrolled) ? 'partial' : 'skipped',
        trainerId: selectedTrainerId || 'null',
        trainer: trnName,
        trainerName: trnName,
        gender,
        isRealTimeToday: true,
        paymentMethod: paymentMethod,
        idempotencyKey: onboardingUuid,
        invoiceNumber: memInvoiceNo,
        age, height, weight, dob, maritalStatus,
        anniversaryDate: maritalStatus === 'married' ? anniversaryDate : null,
        emergencyContact, occupation, address
      };

      if (hasPt && selectedTrainerObj) {
        const amtNum = Number(ptAmount) || 6000;
        const discNum = Number(ptDiscount) || 0;
        const taxNum = Number(ptTax) || 0;
        const netNum = Math.max(0, amtNum - discNum + taxNum);
        const pAmtPaid = Number(ptAmountPaid) || netNum;

        memberPayload.ptBilling = {
          enabled: true,
          trainerId: selectedTrainerObj.id || selectedTrainerObj.employeeId,
          trainerName: selectedTrainerObj.name,
          trainerRole: selectedTrainerObj.role || 'Personal Trainer',
          packageName: `Personal Training (${ptDuration})`,
          duration: ptDuration,
          originalAmount: amtNum,
          packagePrice: amtNum,
          discountAmount: discNum,
          discount: discNum,
          taxAmount: taxNum,
          netPayable: netNum,
          amount: netNum,
          amountPaid: pAmtPaid,
          paid: pAmtPaid,
          paymentMethod: ptPaymentMethod,
          startDate: ptStartDate,
          expiryDate: ptExpiryDate,
          invoiceNo: ptInvoiceNo,
          status: 'ACTIVE'
        };

        memberPayload.pt = {
          enabled: true,
          trainerId: selectedTrainerObj.id || selectedTrainerObj.employeeId,
          trainerName: selectedTrainerObj.name,
          trainerRole: selectedTrainerObj.role || 'Personal Trainer',
          trainerAvatar: selectedTrainerObj.photo || selectedTrainerObj.avatarUrl || '',
          packageName: ptDuration,
          duration: ptDuration,
          amount: netNum,
          startDate: ptStartDate,
          expiryDate: ptExpiryDate,
          invoiceNo: ptInvoiceNo,
          status: 'ACTIVE'
        };
      }

      const resData: any = await addMember(memberPayload);

      const createdMem = resData || memberPayload;
      const memInv = resData?.invoice || {
        invoiceNumber: memInvoiceNo,
        invoiceType: 'MEMBERSHIP',
        billingType: 'MEMBERSHIP',
        packageName: planName,
        plan: planName,
        originalAmount: basePriceNum,
        packagePrice: basePriceNum,
        discountType: discountType,
        discountValue: discValNum,
        discountAmount: computedDiscAmt,
        discount: computedDiscAmt,
        taxAmount: taxAmtNum,
        tax: taxAmtNum,
        netPayable: finalPayableNum,
        amount: finalPayableNum,
        amountPaid: paidAmtNum,
        paid: paidAmtNum,
        pendingAmount: pendingAmtNum,
        method: paymentMethod,
        paymentMethod: paymentMethod,
        status: paymentStatus === 'paid' ? 'paid' : (paidAmtNum > 0 ? 'partial' : 'pending'),
        date: invDate,
        invoiceDate: invDate,
        startDate: memStartDate,
        expiryDate: expiryStr
      };

      setCreatedMember(createdMem);
      setCreatedInvoice(memInv);

      if (hasPt && selectedTrainerObj) {
        const amtNum = Number(ptAmount) || 6000;
        const discNum = Number(ptDiscount) || 0;
        const taxNum = Number(ptTax) || 0;
        const netNum = Math.max(0, amtNum - discNum + taxNum);
        const pAmtPaid = Number(ptAmountPaid) || netNum;

        const ptInv = resData?.ptInvoice || {
          invoiceNumber: ptInvoiceNo,
          invoiceType: 'PT',
          billingType: 'PT',
          packageName: `Personal Training (${ptDuration})`,
          plan: `PT - ${ptDuration}`,
          originalAmount: amtNum,
          packagePrice: amtNum,
          discountAmount: discNum,
          discount: discNum,
          taxAmount: taxNum,
          tax: taxNum,
          netPayable: netNum,
          amount: netNum,
          amountPaid: pAmtPaid,
          paid: pAmtPaid,
          pendingAmount: Math.max(0, netNum - pAmtPaid),
          method: ptPaymentMethod,
          paymentMethod: ptPaymentMethod,
          status: pAmtPaid >= netNum ? 'paid' : 'partial',
          date: invDate,
          invoiceDate: invDate,
          startDate: ptStartDate,
          expiryDate: ptExpiryDate
        };
        setCreatedPtInvoice(ptInv);
      }

      await fetchPayments();

      // Advance step to receipt screen
      setStep(hasPt ? 6 : 5);
      toast.success(`Member onboarding complete for ${fullName.trim()}!`);
    } catch (err: any) {
      console.error('Member creation failed:', err);
      setBackendError(err.message || 'Failed to create member record. Please try again.');
      toast.error(err.message || 'Failed to complete member onboarding.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const handleAttemptClose = () => {
    const finalStepIndex = hasPt ? 6 : 5;
    if (step === finalStepIndex) {
      onClose();
      return;
    }
    if (fullName || mobile || email || photoPreview) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  if (!isOpen || typeof document === 'undefined') return null;

  const totalStepCount = hasPt ? 6 : 5;

  return createPortal((
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center overflow-y-auto overscroll-contain bg-slate-950/45 p-3 sm:p-5">
        
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs"
          onClick={handleAttemptClose}
        />

        {/* Modal Window — Max 1050px, Max 90vh */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 15 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="w-full max-w-6xl bg-white text-slate-900 rounded-[28px] shadow-2xl border border-slate-200 relative overflow-hidden flex flex-col h-[90dvh] max-h-[900px] min-h-0 z-10 font-sans text-left"
        >
          {/* Header Bar */}
          <div className="px-6 sm:px-8 py-4 sm:py-5 bg-gradient-to-r from-orange-600 via-orange-700 to-amber-800 text-white flex justify-between items-center shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center text-white shadow-inner shrink-0">
                <User size={20} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black tracking-tight text-white leading-tight">New Member Onboarding</h2>
                <p className="text-xs text-orange-100 font-medium">Create a complete member profile, membership and biometric record.</p>
              </div>
            </div>

            <button 
              onClick={handleAttemptClose}
              className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-all flex items-center justify-center border-none cursor-pointer shrink-0"
              title="Close Onboarding"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modern Step Progress Header */}
          <div className="px-6 sm:px-8 py-3.5 bg-slate-50 border-b border-slate-200 shrink-0 select-none">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-black uppercase tracking-wider text-orange-600">
                Step {step} of {totalStepCount}
              </span>
              <span className="text-[11px] font-bold text-slate-500">
                {step === 1 && 'Profile & Plan'}
                {step === 2 && 'Health & Personal'}
                {step === 3 && 'Biometrics'}
                {step === 4 && 'Membership Payment'}
                {step === 5 && (hasPt ? 'PT Billing' : 'Invoice & Print')}
                {step === 6 && 'Invoice & Print'}
              </span>
            </div>

            <div className="flex items-center justify-between relative max-w-3xl mx-auto pt-1">
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-1 bg-slate-200 rounded-full z-0 overflow-hidden">
                <motion.div 
                  className="h-full bg-orange-600" 
                  initial={{ width: 0 }}
                  animate={{ width: `${((step - 1) / (totalStepCount - 1)) * 100}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>

              {[
                { s: 1, l: 'Profile & Plan' },
                { s: 2, l: 'Health & Personal' },
                { s: 3, l: 'Biometrics' },
                { s: 4, l: 'Payment' },
                ...(hasPt ? [{ s: 5, l: 'PT Billing' }, { s: 6, l: 'Invoice' }] : [{ s: 5, l: 'Invoice' }])
              ].map((st) => {
                const isPassed = step > st.s;
                const isCurrent = step === st.s;

                return (
                  <div key={st.s} className="relative z-10 flex flex-col items-center">
                    <div 
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                        isPassed 
                          ? 'bg-orange-600 text-white shadow-md shadow-orange-600/30' 
                          : isCurrent 
                          ? 'bg-orange-600 text-white ring-4 ring-orange-100 shadow-md'
                          : 'bg-white border-2 border-slate-300 text-slate-400'
                      }`}
                    >
                      {isPassed ? <Check size={14} strokeWidth={3} /> : st.s}
                    </div>
                    <span className={`text-[9px] font-black tracking-wider uppercase mt-1 hidden sm:block ${
                      isCurrent ? 'text-orange-700 font-extrabold' : isPassed ? 'text-slate-700 font-bold' : 'text-slate-400'
                    }`}>
                      {st.l}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scrollable Form Body */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8">
            
            {/* ── STEP 1: Profile Photo & Demographic Bio Info ONLY ── */}
            {step === 1 && (
              <motion.div 
                initial={{ opacity: 0, x: 15 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -15 }}
                className="max-w-4xl mx-auto space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8 items-start">
                  
                  {/* ── LEFT COLUMN: UNIFIED PROFILE PHOTO SYSTEM ── */}
                  <div className="md:col-span-1 bg-slate-50 p-6 rounded-3xl border border-slate-200/80 flex flex-col items-center text-center space-y-4 shadow-xs">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Profile Photo</span>

                    {/* Single Avatar Circle */}
                    <div className="w-32 h-32 rounded-full bg-white border-4 border-slate-200 shadow-md overflow-hidden flex flex-col items-center justify-center relative group shrink-0">
                      {photoPreview ? (
                        <img 
                          src={photoPreview} 
                          alt="Member preview" 
                          className="w-full h-full object-cover" 
                        />
                      ) : (
                        <div className="flex flex-col items-center text-slate-300">
                          <User size={52} strokeWidth={1.5} />
                          <span className="text-[10px] font-bold text-slate-400 mt-1">No Photo</span>
                        </div>
                      )}
                    </div>

                    <input 
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handlePhotoFileChange}
                      className="hidden"
                      id="member-photo-file-input"
                    />

                    {/* Unified Actions: Upload / Camera */}
                    <div className="w-full space-y-2">
                      {!photoPreview ? (
                        <div className="grid grid-cols-2 gap-2 w-full">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="py-2.5 px-3 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs border-none cursor-pointer"
                          >
                            <Upload size={14} /> Upload
                          </button>
                          <button
                            type="button"
                            onClick={startCameraCapture}
                            className="py-2.5 px-3 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 border-none cursor-pointer"
                          >
                            <Camera size={14} /> Camera
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2 w-full">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all border-none cursor-pointer flex items-center justify-center gap-1"
                          >
                            <RefreshCw size={12} /> Change Photo
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setPhotoPreview(null);
                              setPhotoError(null);
                            }}
                            className="px-3 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl text-xs font-bold transition-all border-none cursor-pointer"
                            title="Remove Photo"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>

                    <p className="text-[10px] font-bold text-slate-400 leading-tight">
                      JPG / PNG / WEBP • Max 5 MB
                    </p>

                    {photoError && (
                      <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center justify-center gap-1 bg-red-50 p-2 rounded-xl border border-red-200 w-full">
                        <AlertCircle size={12} /> {photoError}
                      </p>
                    )}
                  </div>

                  {/* ── RIGHT COLUMN: DEMOGRAPHIC / PERSONAL BIO DATA ── */}
                  <div className="md:col-span-2 space-y-4">
                    <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/80 mb-2">
                      <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Demographic Profile Information</h4>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">Basic member bio details. Membership & Billing details are configured in Step 4.</p>
                    </div>

                    {/* Full Name & Gender */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Full Name *</label>
                        <input 
                          type="text" 
                          value={fullName} 
                          onChange={(e) => {
                            setFullName(e.target.value);
                            if (step1Errors.fullName) setStep1Errors(prev => ({ ...prev, fullName: '' }));
                          }}
                          placeholder="e.g. Rahul Sharma"
                          className={`w-full h-11 bg-slate-50 border rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none transition-all ${
                            step1Errors.fullName ? 'border-red-500 bg-red-50/20' : 'border-slate-300 focus:border-orange-600 focus:bg-white'
                          }`}
                        />
                        {step1Errors.fullName && (
                          <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle size={11} /> {step1Errors.fullName}
                          </p>
                        )}
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Gender *</label>
                        <div className="flex h-11 bg-slate-100/80 border border-slate-300 rounded-xl p-1 gap-1">
                          {(['Male', 'Female', 'Other'] as const).map((g) => (
                            <button
                              key={g}
                              type="button"
                              onClick={() => setGender(g)}
                              className={`flex-1 rounded-lg text-xs font-black transition-all border-none cursor-pointer ${
                                gender === g
                                  ? 'bg-orange-600 text-white shadow-xs'
                                  : 'bg-transparent text-slate-600 hover:bg-slate-200/60'
                              }`}
                            >
                              {g}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Mobile Number & Email */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Mobile Number *</label>
                        <div className="relative flex items-center">
                          <span className="absolute left-3 font-mono font-black text-xs text-slate-500 border-r border-slate-300 pr-2 pointer-events-none">
                            +91
                          </span>
                          <input 
                            type="tel" 
                            value={mobile} 
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                              setMobile(val);
                              if (step1Errors.mobile) setStep1Errors(prev => ({ ...prev, mobile: '' }));
                            }}
                            placeholder="9876543210"
                            className={`w-full h-11 pl-14 bg-slate-50 border rounded-xl pr-3 text-xs font-mono font-black text-slate-900 focus:outline-none transition-all ${
                              step1Errors.mobile ? 'border-red-500 bg-red-50/20' : 'border-slate-300 focus:border-orange-600 focus:bg-white'
                            }`}
                          />
                        </div>
                        {step1Errors.mobile ? (
                          <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle size={11} /> {step1Errors.mobile}
                          </p>
                        ) : (
                          <span className="text-[9px] font-bold text-slate-400 mt-1 block">10 digits required</span>
                        )}

                        {duplicateMember && (
                          <div className="mt-2 p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[10px] font-bold flex items-center justify-between gap-1">
                            <div className="flex items-center gap-1">
                              <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                              <span>Member already exists with this phone!</span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Email Address */}
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Email Address (Optional)</label>
                        <input 
                          type="email" 
                          value={email} 
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (step1Errors.email) setStep1Errors(prev => ({ ...prev, email: '' }));
                          }}
                          placeholder="rahul@example.com"
                          className={`w-full h-11 bg-slate-50 border rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none transition-all ${
                            step1Errors.email ? 'border-red-500 bg-red-50/20' : 'border-slate-300 focus:border-orange-600 focus:bg-white'
                          }`}
                        />
                        {step1Errors.email && (
                          <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle size={11} /> {step1Errors.email}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Optional Personal Trainer Selection */}
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Personal Trainer (Optional)</label>
                      <select 
                        value={selectedTrainerId} 
                        onChange={(e) => setSelectedTrainerId(e.target.value)}
                        className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-600 focus:bg-white transition-all cursor-pointer"
                      >
                        <option value="">No Personal Trainer Assigned</option>
                        {trainersList.map((t: any) => (
                          <option key={t.employeeId || t.id} value={t.employeeId || t.id}>
                            {t.name} ({t.employeeId || (t.biometricId ? `#${t.biometricId}` : 'EMP-TRN')}) — {t.specialization || t.role || 'Trainer'}
                          </option>
                        ))}
                      </select>
                    </div>

                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 2: Health & Personal Details ── */}
            {step === 2 && (
              <motion.div 
                initial={{ opacity: 0, x: 15 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -15 }}
                className="max-w-2xl mx-auto space-y-6"
              >
                <div className="text-center mb-4">
                  <span className="px-3 py-1 bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-extrabold uppercase tracking-widest rounded-full inline-block mb-1">
                    Personal & Physical Parameters
                  </span>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Personal & Physical Health Details</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Fill physical metrics for workout & diet customization, or proceed to next step</p>
                </div>

                {/* Section 1: Personal Information */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Personal Information</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Gender</label>
                      <select 
                        value={gender} 
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-600 transition-all cursor-pointer"
                      >
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Date of Birth</label>
                      <input 
                        type="date" 
                        value={dob} 
                        onChange={(e) => {
                          setDob(e.target.value);
                          if (step2Errors.dob) setStep2Errors(prev => ({ ...prev, dob: '' }));
                        }}
                        className={`w-full h-11 bg-white border rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none transition-all cursor-pointer ${
                          step2Errors.dob ? 'border-red-500 bg-red-50/20' : 'border-slate-300 focus:border-orange-600'
                        }`}
                      />
                      {step2Errors.dob && (
                        <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle size={11} /> {step2Errors.dob}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Occupation</label>
                      <input 
                        type="text" 
                        value={occupation} 
                        onChange={(e) => setOccupation(e.target.value)}
                        placeholder="e.g. Software Engineer, Doctor"
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-600 transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Marital Status</label>
                      <select 
                        value={maritalStatus} 
                        onChange={(e) => setMaritalStatus(e.target.value as any)}
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-600 transition-all cursor-pointer"
                      >
                        <option value="single">Single</option>
                        <option value="married">Married</option>
                      </select>
                    </div>
                  </div>

                  {maritalStatus === 'married' && (
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Anniversary Date *</label>
                      <input 
                        type="date"
                        value={anniversaryDate}
                        onChange={(e) => {
                          setAnniversaryDate(e.target.value);
                          if (step2Errors.anniversaryDate) setStep2Errors(prev => ({ ...prev, anniversaryDate: '' }));
                        }}
                        className={`w-full h-11 bg-white border rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none transition-all cursor-pointer ${
                          step2Errors.anniversaryDate ? 'border-red-500 bg-red-50/20' : 'border-slate-300 focus:border-orange-600'
                        }`}
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Residential Address</label>
                    <input 
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Street, City, Pin code"
                      className="w-full h-11 bg-white border border-slate-300 rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-600 transition-all"
                    />
                  </div>
                </div>

                {/* Section 2: Physical Parameters */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <h4 className="text-xs font-black uppercase text-slate-700 tracking-wider">Physical & Health Parameters</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Body Weight (kg)</label>
                      <input 
                        type="number" 
                        value={weight} 
                        onChange={(e) => {
                          setWeight(e.target.value);
                          if (step2Errors.weight) setStep2Errors(prev => ({ ...prev, weight: '' }));
                        }}
                        placeholder="72"
                        className={`w-full h-11 bg-white border rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none transition-all ${
                          step2Errors.weight ? 'border-red-500 bg-red-50/20' : 'border-slate-300 focus:border-orange-600'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Height (cm)</label>
                      <input 
                        type="number" 
                        value={height} 
                        onChange={(e) => {
                          setHeight(e.target.value);
                          if (step2Errors.height) setStep2Errors(prev => ({ ...prev, height: '' }));
                        }}
                        placeholder="175"
                        className={`w-full h-11 bg-white border rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none transition-all ${
                          step2Errors.height ? 'border-red-500 bg-red-50/20' : 'border-slate-300 focus:border-orange-600'
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Emergency Phone</label>
                      <input 
                        type="tel" 
                        value={emergencyContact} 
                        onChange={(e) => {
                          setEmergencyContact(e.target.value);
                          if (step2Errors.emergencyContact) setStep2Errors(prev => ({ ...prev, emergencyContact: '' }));
                        }}
                        placeholder="9876543210"
                        className={`w-full h-11 bg-white border rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none transition-all ${
                          step2Errors.emergencyContact ? 'border-red-500 bg-red-50/20' : 'border-slate-300 focus:border-orange-600'
                        }`}
                      />
                    </div>
                  </div>
                </div>

              </motion.div>
            )}

            {/* ── STEP 3: Hikvision Biometric Enrollment ── */}
            {step === 3 && (
              <motion.div 
                initial={{ opacity: 0, x: 15 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -15 }}
                className="max-w-xl mx-auto space-y-6 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-orange-50 border border-orange-200 text-orange-600 flex items-center justify-center mx-auto shadow-md">
                  <Fingerprint size={32} />
                </div>

                <div>
                  <span className="px-3 py-1 bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-extrabold uppercase tracking-widest rounded-full inline-block mb-1">
                    Hikvision Hardware Integration
                  </span>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Biometric Gate ID Enrollment</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    {biometricAlreadyOnDevice
                      ? `Biometric ID #${biometricId} was read from the Hikvision terminal. Saving this member will link the existing device user; no second fingerprint scan is needed.`
                      : 'Assign a unique numeric Biometric User ID and enroll face / fingerprint on the Hikvision gate terminal'}
                  </p>
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200/80 space-y-4">
                  <div className="flex flex-wrap items-center justify-center gap-3">
                    <label htmlFor="new-member-biometric-id" className="text-xs font-black uppercase tracking-wider text-slate-500">Biometric User ID:</label>
                    <input
                      id="new-member-biometric-id"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={5}
                      value={biometricId}
                      readOnly={biometricAlreadyOnDevice}
                      onChange={(event) => {
                        const nextValue = event.target.value.replace(/\D/g, '').slice(0, 5);
                        setBiometricId(nextValue);
                        setEnrollStatus('idle');
                        setEnrollMsg('');
                      }}
                      aria-label="Biometric user ID"
                      className={`w-36 h-11 border rounded-xl text-center font-mono text-base font-black text-orange-700 shadow-xs ${biometricAlreadyOnDevice ? 'bg-slate-100 border-slate-300 cursor-not-allowed' : 'bg-white border-orange-300 focus:outline-none focus:ring-4 focus:ring-orange-100'}`}
                    />
                    {!biometricAlreadyOnDevice && (
                      <button
                        type="button"
                        onClick={handleUseNextBiometricId}
                        disabled={isRefreshingBiometricId}
                        className="h-10 px-3 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 text-xs font-bold inline-flex items-center gap-2 hover:bg-orange-100 disabled:opacity-60"
                      >
                        <RefreshCw size={14} className={isRefreshingBiometricId ? 'animate-spin' : ''} />
                        {isRefreshingBiometricId ? 'Loading…' : 'Next available'}
                      </button>
                    )}
                  </div>

                  <p className="text-[11px] text-slate-500 font-medium max-w-md mx-auto">
                    {biometricAlreadyOnDevice ? 'Existing terminal ID ' : 'Choose a unique ID or keep the suggested sequence number. '}<strong className="text-orange-700 font-bold">#{biometricId || '—'}</strong>{biometricAlreadyOnDevice ? ' will stay mapped to this member.' : '. IDs must be 1–65535 and cannot already belong to a member, employee, or device user.'}
                  </p>

                  {!biometricAlreadyOnDevice && (
                    <div className="flex items-center justify-center gap-2 text-[11px] font-bold">
                      <span className={`inline-block w-2.5 h-2.5 rounded-full ${hikvisionOnline === null ? 'bg-slate-300' : hikvisionOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                      <span className="text-slate-600">
                        Hikvision terminal: {hikvisionOnline === null ? 'checking…' : hikvisionOnline ? 'Online' : 'Offline'}
                      </span>
                      <button type="button" onClick={() => void checkHikvisionStatus(true)} className="underline text-orange-700 bg-transparent border-none cursor-pointer">Ping</button>
                    </div>
                  )}
                  {!biometricAlreadyOnDevice && (faceEnrolled || fingerEnrolled) && (
                    <p className="text-[11px] font-bold text-green-700">
                      {faceEnrolled ? '✓ Face enrolled ' : ''}{fingerEnrolled ? '✓ Fingerprint enrolled' : ''}
                    </p>
                  )}

                  <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
                    {biometricAlreadyOnDevice ? (
                      <button
                        type="button"
                        onClick={() => setStep(4)}
                        className="px-5 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-xs font-black transition-all shadow-md border-none cursor-pointer inline-flex items-center gap-2"
                      >
                        <Fingerprint size={16} />
                        <span>LINK EXISTING ID & CONTINUE</span>
                      </button>
                    ) : (
                      <>
                        {([['FACE', 'ENROLL FACE'], ['FINGERPRINT', 'ENROLL FINGER'], ['BOTH', 'FACE + FINGER']] as const).map(([t, label]) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => void handleStartBiometricEnrollment(t)}
                            disabled={enrollStatus === 'enrolling'}
                            className="px-4 py-3 bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white rounded-2xl text-xs font-black transition-all shadow-md border-none cursor-pointer inline-flex items-center gap-2"
                          >
                            <Fingerprint size={16} />
                            <span>{enrollStatus === 'enrolling' && enrollPhase ? (t === 'BOTH' || t === enrollPhase ? 'Working…' : label) : label}</span>
                          </button>
                        ))}
                        <button
                          type="button"
                          onClick={() => {
                            toast.info('Skipped. The server will set up face & fingerprint on the terminal automatically.');
                            setStep(4);
                          }}
                          className="px-5 py-3 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-2xl text-xs font-black transition-all border-none cursor-pointer inline-flex items-center gap-1.5"
                        >
                          <span>SKIP FOR NOW</span>
                          <ChevronRight size={14} />
                        </button>
                      </>
                    )}
                  </div>
                  {!biometricAlreadyOnDevice && (
                    <p className="text-[10px] text-slate-500 font-medium">Skip karne par server khud terminal par user + photo sync queue kar dega.</p>
                  )}

                  {enrollMsg && (
                    <div className="p-3 bg-orange-50 border border-orange-200 rounded-2xl text-orange-800 text-xs font-bold animate-pulse">
                      {enrollMsg}
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── STEP 4: Membership Package, Billing & Payment ── */}
            {step === 4 && (
              <motion.div 
                initial={{ opacity: 0, x: 15 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -15 }}
                className="max-w-3xl mx-auto space-y-6"
              >
                <div className="text-center mb-2">
                  <span className="px-3 py-1 bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-extrabold uppercase tracking-widest rounded-full inline-block mb-1">
                    Step 4 of {totalStepCount}
                  </span>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Membership Package & Billing Details</h3>
                  <p className="text-xs text-slate-500">Configure membership duration, invoice date, discounts, and payment settlement</p>
                </div>

                {/* ── SECTION 1: MEMBERSHIP PACKAGE & DATES ── */}
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200/80 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">1. Select Membership Package</h4>

                  {/* Package Cards Selector Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {activePlans.map((p: any) => {
                      const isSelected = selectedPlan?.name === p.name || selectedPlan?.id === p.id;
                      return (
                        <div 
                          key={p.id || p.name}
                          onClick={() => {
                            setSelectedPlan(p);
                          }}
                          className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                            isSelected 
                              ? 'bg-orange-50 border-orange-600 text-orange-900 shadow-md ring-2 ring-orange-600/20' 
                              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-black uppercase">{p.name}</span>
                          </div>
                          <div className="text-sm font-mono font-black text-orange-700 mt-1">
                            ₹{(p.price || 0).toLocaleString('en-IN')}
                          </div>
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-[10px] text-slate-500 font-bold">{p.duration || '30 Days'} Validity</span>
                            {isSelected && (
                              <span className="text-[9px] font-black uppercase bg-orange-600 text-white px-2 py-0.5 rounded-full">
                                ✓ Active
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Dates Configuration Grid: Invoice Date, Start Date, Expiry Date */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                        Invoice Date *
                      </label>
                      <input 
                        type="date"
                        value={invoiceDate}
                        onChange={(e) => setInvoiceDate(e.target.value)}
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-600 cursor-pointer"
                      />
                      <span className="text-[9px] text-slate-400 font-bold mt-1 block">Date invoice is generated</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                        Membership Start Date *
                      </label>
                      <input 
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-600 cursor-pointer"
                      />
                      <span className="text-[9px] text-slate-400 font-bold mt-1 block">Date access begins</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">
                        Membership Expiry Date *
                      </label>
                      <input 
                        type="date"
                        value={expiryDate}
                        onChange={(e) => {
                          setExpiryDate(e.target.value);
                          setIsExpiryManuallyEdited(true);
                        }}
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-600 cursor-pointer"
                      />
                      <span className="text-[9px] text-slate-400 font-bold mt-1 block">
                        {isExpiryManuallyEdited ? 'Manually modified' : 'Auto-calculated'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── SECTION 2: BILLING & PAYMENT CALCULATIONS ── */}
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200/80 space-y-4">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-700">2. Billing & Discount Calculation</h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Original Package Price (LOCKED to configured package catalog) */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                          Original Package Amount (₹)
                        </label>
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                          <Lock size={10} /> Locked to Catalog
                        </span>
                      </div>
                      <div className="relative">
                        <input 
                          type="number"
                          value={originalAmount}
                          readOnly
                          tabIndex={-1}
                          onKeyDown={(e) => e.preventDefault()}
                          onPaste={(e) => e.preventDefault()}
                          className="w-full h-11 bg-slate-100/90 border border-slate-300 rounded-xl px-4 font-mono font-black text-xs text-slate-700 cursor-not-allowed select-none focus:outline-none"
                          title="Package amount is authoritative from the package catalog and cannot be manually modified."
                        />
                      </div>
                      <span className="text-[9px] text-slate-400 font-bold mt-1 block">
                        Authoritative price from catalog (use Discount to adjust net payable)
                      </span>
                    </div>

                    {/* Discount Type & Value */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] font-black uppercase tracking-wider text-slate-500">Discount</label>
                        <div className="flex bg-slate-200/70 p-0.5 rounded-lg gap-0.5">
                          <button
                            type="button"
                            onClick={() => setDiscountType('amount')}
                            className={`px-2 py-0.5 text-[9px] font-black rounded-md transition-all border-none cursor-pointer ${
                              discountType === 'amount' ? 'bg-orange-600 text-white' : 'bg-transparent text-slate-600'
                            }`}
                          >
                            ₹ Amount
                          </button>
                          <button
                            type="button"
                            onClick={() => setDiscountType('percentage')}
                            className={`px-2 py-0.5 text-[9px] font-black rounded-md transition-all border-none cursor-pointer ${
                              discountType === 'percentage' ? 'bg-orange-600 text-white' : 'bg-transparent text-slate-600'
                            }`}
                          >
                            % Percent
                          </button>
                        </div>
                      </div>

                      <div className="relative">
                        <input 
                          type="number"
                          min="0"
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          placeholder={discountType === 'percentage' ? 'e.g. 10' : 'e.g. 500'}
                          className="w-full h-11 bg-white border border-slate-300 rounded-xl px-4 font-mono font-bold text-xs text-slate-900 focus:outline-none focus:border-orange-600"
                        />
                      </div>
                      <span className="text-[9px] font-bold text-slate-500 mt-1 block">
                        Discount Applied: - ₹{computedDiscAmt.toLocaleString('en-IN')} {discountType === 'percentage' ? `(${discValNum}%)` : ''}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Tax / GST */}
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Tax / GST (₹)</label>
                      <input 
                        type="number"
                        min="0"
                        value={taxAmount}
                        onChange={(e) => setTaxAmount(e.target.value)}
                        placeholder="0"
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-4 font-mono font-bold text-xs text-slate-900 focus:outline-none focus:border-orange-600"
                      />
                    </div>

                    {/* Final Net Payable */}
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Final Payable Amount (₹)</label>
                      <div className="w-full h-11 bg-orange-50 border border-orange-300 rounded-xl px-4 font-mono font-black text-sm text-orange-700 flex items-center justify-between">
                        <span>₹{finalPayableNum.toLocaleString('en-IN')}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest text-orange-600 bg-orange-100 px-2 py-0.5 rounded-md">Calculated Net</span>
                      </div>
                    </div>
                  </div>

                  {/* ── SECTION 3: PAYMENT METHOD & STATUS ── */}
                  <div className="pt-2 border-t border-slate-200/80">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 mb-3">3. Payment Settlement</h4>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      {/* Payment Method */}
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Payment Method *</label>
                        <select
                          value={paymentMethod}
                          onChange={(e) => setPaymentMethod(e.target.value as any)}
                          className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-600 cursor-pointer"
                        >
                          <option value="UPI">UPI</option>
                          <option value="Cash">Cash</option>
                          <option value="Card">Card</option>
                          <option value="NetBanking">Net Banking</option>
                        </select>
                      </div>

                      {/* Payment Status */}
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Payment Status *</label>
                        <select
                          value={paymentStatus}
                          onChange={(e) => setPaymentStatus(e.target.value as any)}
                          className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-600 cursor-pointer"
                        >
                          <option value="paid">Paid (Fully Paid)</option>
                          <option value="partial">Partial Payment</option>
                          <option value="pending">Pending (Unpaid)</option>
                        </select>
                      </div>

                      {/* Amount Paid */}
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Amount Paid (₹)</label>
                        <input 
                          type="number"
                          min="0"
                          max={finalPayableNum}
                          value={amountPaid}
                          disabled={paymentStatus === 'paid'}
                          onChange={(e) => setAmountPaid(e.target.value)}
                          className={`w-full h-11 border rounded-xl px-4 font-mono font-bold text-xs text-slate-900 focus:outline-none ${
                            paymentStatus === 'paid' ? 'bg-slate-100 border-slate-300 text-slate-500' : 'bg-white border-slate-300 focus:border-orange-600'
                          }`}
                        />
                      </div>
                    </div>

                    <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-200 text-xs font-bold text-slate-600">
                      <span>Pending Balance: <strong className="font-mono text-red-600">₹{pendingAmtNum.toLocaleString('en-IN')}</strong></span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${
                        paymentStatus === 'paid' ? 'bg-emerald-100 text-emerald-800' : paymentStatus === 'partial' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                      }`}>
                        Status: {paymentStatus.toUpperCase()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── LIVE INVOICE SUMMARY PREVIEW BOX ── */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950 text-white p-5 rounded-3xl border border-slate-800 shadow-xl space-y-4">
                  <div className="flex justify-between items-center border-b border-white/10 pb-3">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-orange-400">Live Billing Summary</span>
                      <h4 className="text-sm font-black text-white">{selectedPlan?.name || '1 MONTH'}</h4>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${
                      paymentStatus === 'paid' ? 'bg-emerald-500 text-white' : paymentStatus === 'partial' ? 'bg-amber-500 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {paymentStatus.toUpperCase()}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Invoice Date</span>
                      <span className="font-mono font-bold text-slate-200">{invoiceDate}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Start Date</span>
                      <span className="font-mono font-bold text-slate-200">{startDate}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Expiry Date</span>
                      <span className="font-mono font-bold text-slate-200">{expiryDate}</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-slate-400 block">Method</span>
                      <span className="font-bold text-slate-200">{paymentMethod}</span>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-white/10 flex flex-wrap justify-between items-center gap-2 text-xs">
                    <div className="flex gap-4">
                      <span>Package: <strong className="font-mono">₹{basePriceNum.toLocaleString('en-IN')}</strong></span>
                      <span>Discount: <strong className="font-mono text-emerald-400">-₹{computedDiscAmt.toLocaleString('en-IN')}</strong></span>
                      {taxAmtNum > 0 && <span>Tax: <strong className="font-mono">₹{taxAmtNum.toLocaleString('en-IN')}</strong></span>}
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] uppercase text-slate-400 block">Final Payable</span>
                      <span className="text-lg font-mono font-black text-emerald-400">
                        ₹{finalPayableNum.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}

            {/* ── STEP 5 (PT BILLING — ONLY IF TRAINER SELECTED) ── */}
            {step === 5 && hasPt && (
              <motion.div 
                initial={{ opacity: 0, x: 15 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -15 }}
                className="max-w-xl mx-auto space-y-6"
              >
                <div className="text-center mb-2">
                  <span className="px-3 py-1 bg-orange-50 border border-orange-200 text-orange-700 text-[10px] font-extrabold uppercase tracking-widest rounded-full inline-block mb-1">
                    Step 5 of 6
                  </span>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Personal Training Billing</h3>
                  <p className="text-xs text-slate-500">Configure separate PT package duration, price, and payment terms</p>
                </div>

                <div className="bg-gradient-to-r from-orange-900 via-amber-900 to-slate-900 text-white p-5 rounded-3xl border border-orange-800 shadow-md flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-400/30 flex items-center justify-center text-orange-300 shrink-0">
                      <Dumbbell size={24} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-orange-300 block">Assigned Personal Trainer</span>
                      <h4 className="text-base font-black text-white">{selectedTrainerObj?.name || 'Assigned Trainer'}</h4>
                      <span className="text-[10px] text-slate-300 font-bold">{selectedTrainerObj?.role || 'Fitness Trainer'}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200/80 space-y-4 text-left">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">PT Duration *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {['1 Month', '3 Months', '6 Months', '12 Months'].map((dur) => (
                        <button
                          key={dur}
                          type="button"
                          onClick={() => setPtDuration(dur)}
                          className={`py-2.5 px-2 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                            ptDuration === dur
                              ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {dur}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">PT Start Date *</label>
                      <input 
                        type="date"
                        value={ptStartDate}
                        onChange={(e) => setPtStartDate(e.target.value)}
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-600 cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">PT Expiry Date (Auto)</label>
                      <input 
                        type="date"
                        value={ptExpiryDate}
                        onChange={(e) => setPtExpiryDate(e.target.value)}
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-600 cursor-pointer"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Price (₹)</label>
                      <input 
                        type="number"
                        min="0"
                        value={ptAmount}
                        onChange={(e) => setPtAmount(e.target.value)}
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3 font-mono font-bold text-xs text-slate-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Discount (₹)</label>
                      <input 
                        type="number"
                        min="0"
                        value={ptDiscount}
                        onChange={(e) => setPtDiscount(e.target.value)}
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3 font-mono font-bold text-xs text-slate-900 focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Tax (₹)</label>
                      <input 
                        type="number"
                        min="0"
                        value={ptTax}
                        onChange={(e) => setPtTax(e.target.value)}
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3 font-mono font-bold text-xs text-slate-900 focus:outline-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Net PT Amount (₹)</label>
                      <input 
                        type="number"
                        readOnly
                        value={ptAmountPaid}
                        className="w-full h-11 bg-slate-100 border border-slate-300 rounded-xl px-4 font-mono font-black text-xs text-orange-700"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Payment Mode *</label>
                      <select
                        value={ptPaymentMethod}
                        onChange={(e) => setPtPaymentMethod(e.target.value as any)}
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none focus:border-orange-600 cursor-pointer"
                      >
                        <option value="UPI">UPI</option>
                        <option value="Cash">Cash</option>
                        <option value="Card">Card</option>
                        <option value="NetBanking">Net Banking</option>
                      </select>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {/* ── STEP 5/6: INVOICE RECEIPT & PRINT ── */}
            {((step === 5 && !hasPt) || (step === 6 && hasPt)) && createdInvoice && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }} 
                animate={{ opacity: 1, scale: 1 }} 
                className="max-w-3xl mx-auto space-y-6 text-center"
              >
                <div className="w-16 h-16 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 size={36} />
                </div>

                <div>
                  <span className="px-3 py-1 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-extrabold uppercase tracking-widest rounded-full inline-block mb-1">
                    Onboarding Complete 🎉
                  </span>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Member Registered & Invoices Generated!</h3>
                  <p className="text-xs text-slate-500 mt-1">
                    Member profile is now active. You can print the official receipt or complete onboarding.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 text-left">
                  <OfficialInvoiceReceipt 
                    invoice={createdInvoice}
                    member={createdMember}
                  />

                  {createdPtInvoice && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <h4 className="text-xs font-black text-orange-700 uppercase tracking-wider mb-2">Personal Training Invoice</h4>
                      <OfficialInvoiceReceipt 
                        invoice={createdPtInvoice}
                        member={createdMember}
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={handlePrintReceipt}
                    className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white rounded-2xl text-xs font-black transition-all shadow-md border-none cursor-pointer flex items-center gap-2"
                  >
                    <Printer size={16} /> Print Invoices
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-6 py-3 bg-slate-900 hover:bg-black text-white rounded-2xl text-xs font-black transition-all border-none cursor-pointer"
                  >
                    Close & Finish
                  </button>
                </div>
              </motion.div>
            )}

            {backendError && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{backendError}</span>
              </div>
            )}

          </div>

          {/* Sticky Footer Controls */}
          {((step < 5 && !hasPt) || (step < 6 && hasPt)) && (
            <div className="px-6 sm:px-8 py-4 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (step > 1) setStep(step - 1);
                  else handleAttemptClose();
                }}
                className="px-5 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-bold transition-all border-none cursor-pointer flex items-center gap-1.5"
              >
                <ArrowLeft size={14} /> {step === 1 ? 'Cancel' : 'Back'}
              </button>

              <button
                type="button"
                onClick={handleNextStep}
                disabled={isSubmitting}
                className="px-6 py-2.5 bg-orange-600 hover:bg-orange-700 text-white rounded-xl text-xs font-black transition-all shadow-md border-none cursor-pointer flex items-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <span>
                  {step === 4 && !hasPt ? (isSubmitting ? 'Creating Member...' : 'Create Member ✓') : ''}
                  {step === 5 && hasPt ? (isSubmitting ? 'Creating Member...' : 'Create Member & Bills ✓') : ''}
                  {((step < 4 && !hasPt) || (step < 5 && hasPt)) ? 'Next Step' : ''}
                </span>
                <ArrowRight size={14} />
              </button>
            </div>
          )}

        </motion.div>
      </div>

      {/* ── LIVE CAMERA CAPTURE MODAL ── */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 text-white rounded-3xl p-6 max-w-md w-full space-y-4 text-center border border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-black flex items-center gap-2">
                <Camera size={16} className="text-orange-400" /> Take Member Photo
              </h3>
              <button onClick={stopCameraCapture} className="text-slate-400 hover:text-white bg-transparent border-none cursor-pointer p-1">
                ✕
              </button>
            </div>

            {cameraError ? (
              <div className="p-4 bg-red-950/50 border border-red-800 text-red-300 text-xs rounded-2xl">
                {cameraError}
              </div>
            ) : (
              <div className="relative w-64 h-64 mx-auto rounded-full overflow-hidden border-4 border-orange-500 shadow-2xl bg-black">
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  className="w-full h-full object-cover"
                />
              </div>
            )}

            <canvas ref={canvasRef} className="hidden" />

            <div className="flex justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={stopCameraCapture}
                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl border-none cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={takeSnapshot}
                disabled={Boolean(cameraError)}
                className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 text-white text-xs font-black rounded-xl border-none cursor-pointer flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                <Camera size={16} /> Capture Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Confirmation Modal */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 text-center shadow-2xl border border-slate-200">
            <AlertCircle size={36} className="text-amber-500 mx-auto" />
            <h3 className="text-base font-black text-slate-900">Discard Member Registration?</h3>
            <p className="text-xs text-slate-500 font-medium">You have unsaved form data. Are you sure you want to exit without saving?</p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="flex-1 py-2.5 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 border-none cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onClose();
                }}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700 border-none cursor-pointer"
              >
                Discard & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </AnimatePresence>
  ), document.body);
}
