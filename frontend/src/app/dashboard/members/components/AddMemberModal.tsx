'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, User, Phone, Mail, Calendar, Heart, Shield, Smartphone, 
  CheckCircle2, ArrowRight, ArrowLeft, CreditCard, DollarSign, 
  Printer, Download, Sparkles, Fingerprint, Banknote, Wallet, 
  ChevronRight, Dumbbell, Award, AlertCircle, FileText, Upload, Camera, Trash2, RefreshCw, AlertTriangle, Check, SwitchCamera,
  Cpu, ScanFace, Activity, UserCheck, ShieldCheck
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
  membershipPackageId: z.string().min(1, 'Please select a membership package'),
  startDate: z.string().min(1, 'Please select a start date'),
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

export default function AddMemberModal({ isOpen, onClose }: AddMemberModalProps) {
  const { plans, fetchPlans, addMember, fetchPayments, members } = useGymStore();

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

  // Step 1: Basic Info & Package
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
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

  // Step 2: Personal & Health
  const [gender, setGender] = useState('Male');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [dob, setDob] = useState('');
  const [maritalStatus, setMaritalStatus] = useState<'single' | 'married'>('single');
  const [anniversaryDate, setAnniversaryDate] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [occupation, setOccupation] = useState('');
  const [address, setAddress] = useState('');

  // Step 3: Hikvision Biometric Enrollment
  const [biometricId, setBiometricId] = useState('');
  const [enrollStatus, setEnrollStatus] = useState<'idle' | 'enrolling' | 'success' | 'failed' | 'waiting_terminal'>('idle');
  const [enrollMsg, setEnrollMsg] = useState('');
  const [enrollDetailLog, setEnrollDetailLog] = useState('');
  const [selectedEnrollType, setSelectedEnrollType] = useState<'FACE' | 'FINGERPRINT' | 'BOTH'>('FACE');
  const [faceStatus, setFaceStatus] = useState<'NOT ENROLLED' | 'REQUESTING' | 'WAITING FOR TERMINAL' | 'ENROLLED' | 'FAILED' | 'TERMINAL_ENROLLMENT_REQUIRED'>('NOT ENROLLED');
  const [fpStatus, setFpStatus] = useState<'NOT ENROLLED' | 'REQUESTING' | 'WAITING FOR TERMINAL' | 'ENROLLED' | 'FAILED'>('NOT ENROLLED');
  const [userCreatedOnHikvision, setUserCreatedOnHikvision] = useState<boolean>(false);
  const [isCreatingUser, setIsCreatingUser] = useState<boolean>(false);
  const [hikvisionOnline, setHikvisionOnline] = useState<boolean>(true);
  const [lastCheckedTime, setLastCheckedTime] = useState<string>('');
  const [isTestingConn, setIsTestingConn] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);
  const [diagnosticsData, setDiagnosticsData] = useState<any>(null);
  const [isLoadingDiagnostics, setIsLoadingDiagnostics] = useState<boolean>(false);
  const [connectionMatrix, setConnectionMatrix] = useState<any>({
    network: true,
    http: true,
    auth: true,
    userApi: true,
    faceApi: true,
    fingerprintApi: false
  });

  // Step 4: Membership Billing & Payment Method
  const [discount, setDiscount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'UPI' | 'Card' | 'NetBanking'>('UPI');
  const [amountPaid, setAmountPaid] = useState('');

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

  // Auto-generate sequential Biometric ID
  useEffect(() => {
    if (isOpen) {
      const nextId = (members.length + 101).toString();
      setBiometricId(nextId);
      if (activePlans.length > 0 && !selectedPlan) {
        setSelectedPlan(activePlans[0]);
      }
    }
  }, [isOpen, members.length]);

  // Update Membership amount paid when plan or discount changes
  useEffect(() => {
    if (selectedPlan) {
      const basePrice = Number(selectedPlan.price) || 2500;
      const disc = Number(discount) || 0;
      const finalAmt = Math.max(0, basePrice - disc);
      setAmountPaid(finalAmt.toString());
    }
  }, [selectedPlan, discount]);

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
      membershipPackageId: selectedPlan?.id || selectedPlan?.name || '',
      startDate,
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

  // Hikvision Biometric Handlers
  const checkHikvisionStatus = async () => {
    setIsTestingConn(true);
    try {
      const resp = await API.post('/devices/hikvision/test-connection');
      if (resp.data && resp.data.online) {
        setHikvisionOnline(true);
        if (resp.data.matrix) {
          setConnectionMatrix(resp.data.matrix);
        }
        toast.success('Hikvision 7-Point Health Check Passed ✓');
      } else {
        setHikvisionOnline(false);
        toast.error('Hikvision terminal unreachable on 192.168.1.45');
      }
    } catch (e) {
      setHikvisionOnline(false);
      toast.error('Error testing Hikvision 7-point health matrix');
    } finally {
      setIsTestingConn(false);
      setLastCheckedTime(new Date().toLocaleTimeString());
    }
  };

  const handleTestUserCreation = async () => {
    setIsCreatingUser(true);
    setEnrollDetailLog('');
    try {
      const bioId = biometricId || '101';
      const nameStr = fullName || 'TEST MEMBER';
      toast.loading(`Creating user #${bioId} on Hikvision terminal...`, { id: 'test-user-create' });

      const resp = await API.post('/devices/hikvision/test-user-creation', {
        biometricId: bioId,
        memberName: nameStr
      });

      if (resp.data && resp.data.success) {
        setUserCreatedOnHikvision(true);
        toast.success(`Person #${bioId} (${nameStr}) created successfully on Hikvision terminal!`, { id: 'test-user-create' });
        setEnrollMsg(`✓ Person created on terminal (ID: ${bioId}, Method: ${resp.data.httpMethod || 'POST'})`);
        setEnrollDetailLog(
          `Endpoint: ${resp.data.url || '/ISAPI/AccessControl/UserInfo/Record?format=json'}\nMethod: ${resp.data.httpMethod || 'POST'}\nStatus: ${resp.data.httpStatus || 200}\nHikvision Response: ${JSON.stringify(resp.data.parsedResponse || resp.data.hikvisionResponse, null, 2)}`
        );
      } else {
        setUserCreatedOnHikvision(false);
        const errMsg = resp.data?.errorMessage || 'User creation returned HTTP failure';
        toast.error(`User creation failed: ${errMsg}`, { id: 'test-user-create' });
        setEnrollMsg(`User Creation Failed: ${errMsg}`);
        setEnrollDetailLog(
          `Endpoint: ${resp.data?.url || '/ISAPI/AccessControl/UserInfo/Record?format=json'}\nMethod: ${resp.data?.httpMethod || 'POST'}\nStatus: ${resp.data?.httpStatus || 400}\nHikvision Response: ${JSON.stringify(resp.data?.parsedResponse || resp.data?.hikvisionResponse, null, 2)}`
        );
      }
    } catch (e: any) {
      setUserCreatedOnHikvision(false);
      const errMsg = e.response?.data?.errorMessage || e.message || 'Connection error';
      toast.error(`User creation error: ${errMsg}`, { id: 'test-user-create' });
      setEnrollMsg(`User Creation Error: ${errMsg}`);
      setEnrollDetailLog(`Error: ${errMsg}`);
    } finally {
      setIsCreatingUser(false);
    }
  };

  const fetchDiagnostics = async () => {
    setIsLoadingDiagnostics(true);
    try {
      const resp = await API.get('/devices/hikvision/diagnostics');
      if (resp.data) {
        setDiagnosticsData(resp.data);
        if (resp.data.reachability === 'REACHABLE') setHikvisionOnline(true);
        if (resp.data.connectionMatrix) setConnectionMatrix(resp.data.connectionMatrix);
      }
    } catch (e) {
      console.warn("Diagnostics fetch failed:", e);
    } finally {
      setIsLoadingDiagnostics(false);
    }
  };

  const handleExecuteEnrollment = async (type: 'FACE' | 'FINGERPRINT' | 'BOTH') => {
    setSelectedEnrollType(type);
    setEnrollStatus('enrolling');
    setEnrollDetailLog('');

    if (type === 'FACE') {
      setFaceStatus('REQUESTING');
      setEnrollMsg('Sending request... Registering user & checking face capabilities');
    } else if (type === 'FINGERPRINT') {
      setFpStatus('REQUESTING');
      setEnrollMsg('Sending request... Registering user & checking fingerprint scanner');
    } else {
      setFaceStatus('REQUESTING');
      setFpStatus('REQUESTING');
      setEnrollMsg('Sending request... Provisioning user & checking biometric capabilities');
    }

    try {
      const resp = await API.post('/devices/hikvision/enroll', {
        memberId: 'new_' + Date.now(),
        memberName: fullName || 'New Member',
        biometricId: biometricId || '101',
        enrollmentType: type
      });

      if (resp.data && resp.data.success) {
        setEnrollStatus('success');
        setUserCreatedOnHikvision(true);
        if (type === 'FACE' || type === 'BOTH') setFaceStatus('ENROLLED');
        if (type === 'FINGERPRINT' || type === 'BOTH') setFpStatus('ENROLLED');

        const successText = `✓ ${type} enrollment completed on Hikvision terminal (Biometric ID #${biometricId || '101'})`;
        setEnrollMsg(successText);
        toast.success(`${type} enrolled successfully on Hikvision terminal`);
      } else if (resp.data && resp.data.requiresTerminalAction) {
        setEnrollStatus('waiting_terminal');
        setUserCreatedOnHikvision(true);
        if (type === 'FACE' || type === 'BOTH') setFaceStatus('TERMINAL_ENROLLMENT_REQUIRED');
        if (type === 'FINGERPRINT' || type === 'BOTH') setFpStatus('WAITING FOR TERMINAL');

        const terminalMsg = resp.data.message || `User #${biometricId || '101'} created on terminal. Please complete enrollment directly on physical Hikvision terminal.`;
        setEnrollMsg(terminalMsg);
        setEnrollDetailLog(
          `Endpoint: ${resp.data?.deviceResult?.endpoint || '/ISAPI/AccessControl/UserInfo/Record?format=json'}\nMethod: ${resp.data?.deviceResult?.httpMethod || 'POST'}\nStatus: ${resp.data?.deviceResult?.httpStatus || 200}\nAction Required: Send member to Hikvision terminal to touch fingerprint scanner or capture face.`
        );
        toast.success(`User #${biometricId || '101'} created on terminal! Please complete enrollment on physical device.`);
      } else {
        setEnrollStatus('failed');
        if (type === 'FACE' || type === 'BOTH') setFaceStatus('FAILED');
        if (type === 'FINGERPRINT' || type === 'BOTH') setFpStatus('FAILED');

        const errReason = resp.data?.error || 'Hikvision request failed.';
        setEnrollMsg(`Hikvision API Error: ${errReason}`);
        setEnrollDetailLog(
          `Endpoint: ${resp.data?.apiEndpoint || '/ISAPI/AccessControl/UserInfo/Record?format=json'}\nMethod: ${resp.data?.httpMethod || 'POST'}\nStatus: ${resp.data?.httpStatus || 400}\nHikvision Response: ${JSON.stringify(resp.data?.parsedResponse || resp.data?.hikvisionResponse || errReason, null, 2)}`
        );
        toast.error(`Hikvision API Error: ${errReason}`);
      }
    } catch (e: any) {
      setEnrollStatus('failed');
      if (type === 'FACE' || type === 'BOTH') setFaceStatus('FAILED');
      if (type === 'FINGERPRINT' || type === 'BOTH') setFpStatus('FAILED');

      const errMsg = e.response?.data?.error || e.message || 'Hikvision request failed.';
      setEnrollMsg(`Hikvision API Error: ${errMsg}`);
      setEnrollDetailLog(
        `Endpoint: ${e.response?.data?.apiEndpoint || '/ISAPI/AccessControl/UserInfo/Record?format=json'}\nMethod: POST\nStatus: ${e.response?.status || 500}\nHikvision Response: ${JSON.stringify(e.response?.data?.parsedResponse || e.response?.data || errMsg, null, 2)}`
      );
      toast.error(`Hikvision API Error: ${errMsg}`);
    }
  };

  // Next Step Action
  const handleNextStep = () => {
    if (step === 1) {
      if (!validateStep1()) {
        toast.error('Please complete all required fields on Step 1');
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
    setIsSubmitting(true);
    setBackendError(null);

    try {
      const cleanMobile = mobile.replace(/\D/g, '');
      const normalizedPhone = cleanMobile.length === 12 && cleanMobile.startsWith('91') 
        ? cleanMobile.slice(2) 
        : cleanMobile.slice(-10);

      const normalizedEmail = (email || `${normalizedPhone}@thewarriorgym.in`).toLowerCase().trim();

      const todayStr = new Date().toISOString().split('T')[0];
      const memStartDate = startDate || todayStr;
      const planName = selectedPlan?.name || '1 Month';
      const planDuration = selectedPlan?.duration || planName;
      const expiryStr = membershipEngine.calculateMembershipExpiry(memStartDate, planDuration);

      const basePrice = Number(selectedPlan?.price) || 2500;
      const disc = Number(discount) || 0;
      const finalBilled = Math.max(0, basePrice - disc);
      const paidAmt = Number(amountPaid) || finalBilled;

      const computedStatus = membershipEngine.calculateMembershipStatus(expiryStr, memStartDate);

      const memInvoiceNo = `INV-MEM-${Date.now().toString().slice(-6)}`;
      const ptInvoiceNo = hasPt ? `INV-PT-${Date.now().toString().slice(-6)}` : '';
      const onboardingUuid = `add_mem_${normalizedPhone}_${todayStr}_${Math.floor(1000 + Math.random() * 9000)}`;
      const trnName = selectedTrainerObj?.name || (selectedTrainerId ? 'Assigned Trainer' : 'Unassigned');

      const memberPayload: any = {
        name: fullName.trim(),
        phone: normalizedPhone,
        email: normalizedEmail,
        photo: photoPreview || '',
        plan: planName,
        price: basePrice,
        originalAmount: basePrice,
        packagePrice: basePrice,
        discountAmount: disc,
        discount: disc,
        netPayable: finalBilled,
        amount: finalBilled,
        amountPaid: paidAmt,
        paid: paidAmt,
        joinDate: todayStr,
        startDate: memStartDate,
        createdAt: new Date().toISOString(),
        expiryDate: expiryStr,
        status: computedStatus,
        paymentStatus: paidAmt >= finalBilled ? 'paid' : 'partial',
        totalBilled: finalBilled,
        totalPaid: paidAmt,
        biometricId: biometricId,
        deviceUserId: biometricId,
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
        originalAmount: basePrice,
        packagePrice: basePrice,
        discountAmount: disc,
        discount: disc,
        netPayable: finalBilled,
        amount: finalBilled,
        amountPaid: paidAmt,
        paid: paidAmt,
        pendingAmount: Math.max(0, finalBilled - paidAmt),
        method: paymentMethod,
        paymentMethod: paymentMethod,
        status: paidAmt >= finalBilled ? 'paid' : 'partial',
        date: todayStr,
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
          invoiceNumber: memberPayload.ptBilling?.invoiceNo || ptInvoiceNo,
          invoiceType: 'PT',
          billingType: 'PT',
          packageName: `Personal Training (${ptDuration})`,
          plan: `Personal Training (${ptDuration})`,
          trainerName: selectedTrainerObj.name,
          originalAmount: amtNum,
          packagePrice: amtNum,
          discountAmount: discNum,
          discount: discNum,
          netPayable: netNum,
          amount: netNum,
          amountPaid: pAmtPaid,
          paid: pAmtPaid,
          pendingAmount: Math.max(0, netNum - pAmtPaid),
          method: ptPaymentMethod,
          paymentMethod: ptPaymentMethod,
          status: (netNum - pAmtPaid) <= 0 ? 'paid' : 'partial',
          date: todayStr,
          startDate: ptStartDate,
          expiryDate: ptExpiryDate
        };
        setCreatedPtInvoice(ptInv);
      }

      setStep(hasPt ? 6 : 5);
      toast.success('Member created successfully 🎉');
    } catch (err: any) {
      const errMsg = err.message || 'Failed to complete member registration. Please try again.';
      setBackendError(errMsg);
      toast.error(errMsg);
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

  if (!isOpen) return null;

  const totalStepCount = hasPt ? 6 : 5;

  return (
    <>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4">
        
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
          className="w-full max-w-[1050px] bg-white text-slate-900 rounded-[32px] shadow-2xl border border-slate-200 relative overflow-hidden flex flex-col h-[90vh] z-10 font-sans text-left"
        >
          {/* Header Bar */}
          <div className="px-6 sm:px-8 py-4 sm:py-5 bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#9A3412] text-white flex justify-between items-center shrink-0">
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
              <span className="text-[11px] font-black uppercase tracking-wider text-[#EA580C]">
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
                  className="h-full bg-[#EA580C]" 
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
                          ? 'bg-[#EA580C] text-white shadow-md shadow-orange-500/20' 
                          : isCurrent 
                          ? 'bg-[#EA580C] text-white ring-4 ring-orange-100 shadow-md'
                          : 'bg-white border-2 border-slate-300 text-slate-400'
                      }`}
                    >
                      {isPassed ? <Check size={14} strokeWidth={3} /> : st.s}
                    </div>
                    <span className={`text-[9px] font-black tracking-wider uppercase mt-1 hidden sm:block ${
                      isCurrent ? 'text-[#C2410C] font-extrabold' : isPassed ? 'text-slate-700 font-bold' : 'text-slate-400'
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
            
            {/* ── STEP 1: Profile Photo & Basic Information & Plan ── */}
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

                    {/* Unified Actions: Either Upload/Camera buttons OR Change/Remove buttons */}
                    <div className="w-full space-y-2">
                      {!photoPreview ? (
                        <div className="grid grid-cols-2 gap-2 w-full">
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="py-2.5 px-3 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs border-none cursor-pointer"
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

                  {/* ── RIGHT COLUMN: BASIC INFO & MEMBERSHIP PACKAGE ── */}
                  <div className="md:col-span-2 space-y-4">
                    
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
                            step1Errors.fullName ? 'border-red-500 bg-red-50/20' : 'border-slate-300 focus:border-[#F97316] focus:bg-white'
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
                                  ? 'bg-[#EA580C] text-white shadow-xs'
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
                              step1Errors.mobile ? 'border-red-500 bg-red-50/20' : 'border-slate-300 focus:border-[#F97316] focus:bg-white'
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
                            step1Errors.email ? 'border-red-500 bg-red-50/20' : 'border-slate-300 focus:border-[#F97316] focus:bg-white'
                          }`}
                        />
                        {step1Errors.email && (
                          <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle size={11} /> {step1Errors.email}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Membership Packages Selection Grid */}
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1.5">Select Membership Package *</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {activePlans.map((p: any, pIdx: number) => {
                          const isSelected = selectedPlan?.name === p.name || selectedPlan?.id === p.id;
                          return (
                            <div 
                              key={p.id || p.name || `plan-${pIdx}`}
                              onClick={() => {
                                setSelectedPlan(p);
                                if (step1Errors.membershipPackageId) setStep1Errors(prev => ({ ...prev, membershipPackageId: '' }));
                              }}
                                className={`p-3.5 rounded-2xl border-2 cursor-pointer transition-all ${
                                  isSelected 
                                    ? 'bg-[#FFF7ED] border-[#EA580C] text-slate-900 shadow-md ring-2 ring-orange-500/15' 
                                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700 hover:bg-slate-50'
                                }`}
                            >
                              <div className="flex justify-between items-start">
                                <span className="text-xs font-black uppercase">{p.name}</span>
                                <span className="text-xs font-mono font-black text-[#C2410C]">₹{(p.price || 0).toLocaleString('en-IN')}</span>
                              </div>
                              <div className="flex justify-between items-center mt-2">
                                <span className="text-[10px] text-slate-500 font-bold">{p.duration || '30 Days'} Validity</span>
                                {isSelected && (
                                  <span className="text-[9px] font-black uppercase bg-[#EA580C] text-white px-2 py-0.5 rounded-full flex items-center gap-1">
                                    ✓ Selected
                                  </span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      {step1Errors.membershipPackageId && (
                        <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                          <AlertCircle size={11} /> {step1Errors.membershipPackageId}
                        </p>
                      )}
                    </div>

                    {/* Start Date & Optional Trainer */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Membership Start Date *</label>
                        <input 
                          type="date"
                          value={startDate}
                          onChange={(e) => setStartDate(e.target.value)}
                          className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#F97316] focus:bg-white transition-all cursor-pointer"
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Personal Trainer (Optional)</label>
                        <select 
                          value={selectedTrainerId} 
                          onChange={(e) => setSelectedTrainerId(e.target.value)}
                          className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#F97316] focus:bg-white transition-all cursor-pointer"
                        >
                          <option value="">No PT Assigned</option>
                          {trainersList.map((t: any, tIdx: number) => (
                            <option key={t.employeeId || t.id || `trainer-${tIdx}`} value={t.employeeId || t.id || `trainer-${tIdx}`}>
                              {t.name} ({t.employeeId || (t.biometricId ? `#${t.biometricId}` : 'EMP-TRN')}) — {t.specialization || t.role || 'Trainer'}
                            </option>
                          ))}
                        </select>
                      </div>
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
                  <span className="px-3 py-1 bg-[#FFF7ED] border border-[#FED7AA] text-[#C2410C] text-[10px] font-extrabold uppercase tracking-widest rounded-full inline-block mb-1">
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
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#F97316] transition-all cursor-pointer"
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
                          step2Errors.dob ? 'border-red-500 bg-red-50/20' : 'border-slate-300 focus:border-[#F97316]'
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
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#F97316] transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Marital Status</label>
                      <select 
                        value={maritalStatus} 
                        onChange={(e) => setMaritalStatus(e.target.value as any)}
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#F97316] transition-all cursor-pointer"
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
                          step2Errors.anniversaryDate ? 'border-red-500 bg-red-50/20' : 'border-slate-300 focus:border-[#F97316]'
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
                      className="w-full h-11 bg-white border border-slate-300 rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#F97316] transition-all"
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
                          step2Errors.weight ? 'border-red-500 bg-red-50/20' : 'border-slate-300 focus:border-[#F97316]'
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
                          step2Errors.height ? 'border-red-500 bg-red-50/20' : 'border-slate-300 focus:border-[#F97316]'
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
                          step2Errors.emergencyContact ? 'border-red-500 bg-red-50/20' : 'border-slate-300 focus:border-[#F97316]'
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
                className="max-w-2xl mx-auto space-y-5 text-center"
              >
                {/* Title Header */}
                <div>
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-[#FFF7ED] to-[#FFEDD5] border border-[#FED7AA] text-[#EA580C] flex items-center justify-center mx-auto shadow-md mb-2">
                    <ScanFace size={28} />
                  </div>
                  <span className="px-3 py-0.5 bg-orange-100 border border-orange-200 text-[#C2410C] text-[10px] font-extrabold uppercase tracking-widest rounded-full inline-block mb-1">
                    Hikvision Terminal Integration
                  </span>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Biometric Enrollment</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Register member face & fingerprint biometrics directly on Hikvision terminal
                  </p>
                </div>

                {/* Device Status Card */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
                  <div className="flex items-center gap-3 text-left">
                    <div className="w-10 h-10 rounded-xl bg-orange-50 border border-orange-200 flex items-center justify-center text-[#EA580C] shrink-0">
                      <Cpu size={20} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-black text-slate-900">Hikvision Terminal</h4>
                        <span className={`px-2 py-0.5 text-[10px] font-black rounded-full uppercase tracking-wider ${
                          hikvisionOnline ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-red-100 text-red-700 border border-red-300'
                        }`}>
                          {hikvisionOnline ? 'Connected' : 'Offline'}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                        Model: <span className="font-bold text-slate-800">DS-K1T320EFWX</span> · IP: <span className="font-bold text-slate-800">192.168.1.45</span>
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Last checked: {lastCheckedTime || 'Just now'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={checkHikvisionStatus}
                    disabled={isTestingConn}
                    className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <RefreshCw size={13} className={isTestingConn ? 'animate-spin' : ''} />
                    <span>{isTestingConn ? 'Testing...' : 'Test Connection'}</span>
                  </button>
                </div>

                {/* Biometric User ID & Enrollment Options Container */}
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-extrabold uppercase tracking-wider text-slate-600">Biometric User ID:</span>
                      <input 
                        type="number"
                        value={biometricId}
                        onChange={(e) => setBiometricId(e.target.value)}
                        className="w-28 h-10 bg-white border-2 border-[#F97316] rounded-xl text-center font-mono text-lg font-black text-[#C2410C] focus:outline-none shadow-xs"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleTestUserCreation}
                      disabled={isCreatingUser}
                      className="px-3.5 py-2 bg-[#EA580C] hover:bg-[#C2410C] text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border-none shadow-xs"
                    >
                      <RefreshCw size={13} className={isCreatingUser ? 'animate-spin' : ''} />
                      <span>{isCreatingUser ? 'Creating...' : `Test User Creation (POST /UserInfo/Record)`}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-slate-500 font-medium text-left">
                    This ID must be the same ID used when creating the person on the Hikvision terminal.
                  </p>

                  {/* 3 Enrollment Option Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    {/* Option 1: Face */}
                    <button
                      type="button"
                      onClick={() => handleExecuteEnrollment('FACE')}
                      disabled={enrollStatus === 'enrolling'}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                        selectedEnrollType === 'FACE' 
                          ? 'border-[#EA580C] bg-orange-50/70 shadow-sm' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#EA580C] flex items-center justify-center mb-2">
                          <Camera size={16} />
                        </div>
                        <h5 className="text-xs font-black text-slate-900">Register Face</h5>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                          Provision person & check face capture
                        </p>
                      </div>
                      <span className={`mt-3 px-2 py-0.5 text-[9px] font-black uppercase rounded-md self-start ${
                        faceStatus === 'ENROLLED' ? 'bg-emerald-600 text-white' : 
                        faceStatus === 'TERMINAL_ENROLLMENT_REQUIRED' ? 'bg-amber-500 text-white' :
                        faceStatus === 'REQUESTING' ? 'bg-blue-500 text-white animate-pulse' :
                        faceStatus === 'FAILED' ? 'bg-red-600 text-white' : 'bg-slate-500 text-white'
                      }`}>
                        {faceStatus === 'ENROLLED' ? 'Enrolled ✓' : 
                         faceStatus === 'TERMINAL_ENROLLMENT_REQUIRED' ? 'Terminal Capture Required' :
                         faceStatus === 'REQUESTING' ? 'Requesting...' :
                         faceStatus === 'FAILED' ? 'Failed ✕' : 'Not Enrolled'}
                      </span>
                    </button>

                    {/* Option 2: Fingerprint */}
                    <button
                      type="button"
                      onClick={() => handleExecuteEnrollment('FINGERPRINT')}
                      disabled={enrollStatus === 'enrolling'}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                        selectedEnrollType === 'FINGERPRINT' 
                          ? 'border-[#EA580C] bg-orange-50/70 shadow-sm' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#EA580C] flex items-center justify-center mb-2">
                          <Fingerprint size={16} />
                        </div>
                        <h5 className="text-xs font-black text-slate-900">Register Fingerprint</h5>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                          Provision person & initiate scanner
                        </p>
                      </div>
                      <span className={`mt-3 px-2 py-0.5 text-[9px] font-black uppercase rounded-md self-start ${
                        fpStatus === 'ENROLLED' ? 'bg-emerald-600 text-white' : 
                        fpStatus === 'WAITING FOR TERMINAL' ? 'bg-amber-500 text-white' :
                        fpStatus === 'REQUESTING' ? 'bg-blue-500 text-white animate-pulse' :
                        fpStatus === 'FAILED' ? 'bg-red-600 text-white' : 'bg-slate-500 text-white'
                      }`}>
                        {fpStatus === 'ENROLLED' ? 'Enrolled ✓' : 
                         fpStatus === 'WAITING FOR TERMINAL' ? 'Waiting for Terminal Touch' :
                         fpStatus === 'REQUESTING' ? 'Requesting...' :
                         fpStatus === 'FAILED' ? 'Failed ✕' : 'Not Enrolled'}
                      </span>
                    </button>

                    {/* Option 3: Both */}
                    <button
                      type="button"
                      onClick={() => handleExecuteEnrollment('BOTH')}
                      disabled={enrollStatus === 'enrolling'}
                      className={`p-3.5 rounded-2xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                        selectedEnrollType === 'BOTH' 
                          ? 'border-[#EA580C] bg-orange-50/70 shadow-sm' 
                          : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="w-8 h-8 rounded-xl bg-orange-100 text-[#EA580C] flex items-center justify-center mb-2">
                          <Sparkles size={16} />
                        </div>
                        <h5 className="text-xs font-black text-slate-900">Face + Fingerprint</h5>
                        <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                          Provision person & run both biometrics
                        </p>
                      </div>
                      <span className="mt-3 px-2 py-0.5 text-[9px] font-black uppercase rounded-md bg-purple-600 text-white self-start">
                        Both Options
                      </span>
                    </button>
                  </div>

                  {/* Live Enrollment Progress Status Box */}
                  {enrollMsg && (
                    <div className={`p-4 rounded-2xl border text-xs font-bold text-left space-y-1.5 transition-all ${
                      enrollStatus === 'success' 
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-900' 
                        : enrollStatus === 'waiting_terminal'
                        ? 'bg-amber-50 border-amber-300 text-amber-900'
                        : enrollStatus === 'failed' 
                        ? 'bg-red-50 border-red-300 text-red-900' 
                        : 'bg-orange-50 border-orange-300 text-orange-900 animate-pulse'
                    }`}>
                      <div className="flex items-center gap-2">
                        {enrollStatus === 'enrolling' && <RefreshCw size={15} className="animate-spin text-[#EA580C]" />}
                        {enrollStatus === 'success' && <CheckCircle2 size={15} className="text-emerald-600 shrink-0" />}
                        {enrollStatus === 'waiting_terminal' && <AlertCircle size={15} className="text-amber-600 shrink-0" />}
                        {enrollStatus === 'failed' && <AlertCircle size={15} className="text-red-600 shrink-0" />}
                        <span className="font-extrabold">{enrollMsg}</span>
                      </div>
                      {enrollDetailLog && (
                        <div className="mt-2 text-[10px] font-mono bg-black/5 p-2.5 rounded-xl border border-black/10 overflow-x-auto whitespace-pre-wrap leading-relaxed">
                          {enrollDetailLog}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Expandable Hikvision Connection Diagnostics Section */}
                <div className="bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden text-left">
                  <button
                    type="button"
                    onClick={() => {
                      setShowDiagnostics(!showDiagnostics);
                      if (!showDiagnostics && !diagnosticsData) fetchDiagnostics();
                    }}
                    className="w-full px-4 py-3 flex items-center justify-between text-xs font-black text-slate-700 hover:bg-slate-100 transition-all cursor-pointer border-none bg-transparent"
                  >
                    <div className="flex items-center gap-2">
                      <Activity size={15} className="text-[#EA580C]" />
                      <span>Hikvision Connection Diagnostics (7-Point Matrix)</span>
                    </div>
                    <ChevronRight size={15} className={`transition-transform ${showDiagnostics ? 'rotate-90' : ''}`} />
                  </button>

                  {showDiagnostics && (
                    <div className="p-4 border-t border-slate-200 space-y-3 bg-white">
                      {/* 7-Point Health Matrix Badges */}
                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center text-[10px] font-bold">
                        <div className={`p-2 rounded-xl border ${connectionMatrix.network ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
                          NETWORK <br /><span className="text-xs">{connectionMatrix.network ? '✓' : '✕'}</span>
                        </div>
                        <div className={`p-2 rounded-xl border ${connectionMatrix.http ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
                          HTTP <br /><span className="text-xs">{connectionMatrix.http ? '✓' : '✕'}</span>
                        </div>
                        <div className={`p-2 rounded-xl border ${connectionMatrix.auth ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
                          AUTH <br /><span className="text-xs">{connectionMatrix.auth ? '✓' : '✕'}</span>
                        </div>
                        <div className={`p-2 rounded-xl border ${connectionMatrix.userApi ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-red-50 border-red-300 text-red-800'}`}>
                          USER API <br /><span className="text-xs">{connectionMatrix.userApi ? '✓' : '✕'}</span>
                        </div>
                        <div className={`p-2 rounded-xl border ${connectionMatrix.faceApi ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-amber-50 border-amber-300 text-amber-800'}`}>
                          FACE API <br /><span className="text-xs">{connectionMatrix.faceApi ? '✓' : 'Terminal'}</span>
                        </div>
                        <div className={`p-2 rounded-xl border ${connectionMatrix.fingerprintApi ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-amber-50 border-amber-300 text-amber-800'}`}>
                          FINGERPRINT <br /><span className="text-xs">{connectionMatrix.fingerprintApi ? '✓' : 'Terminal'}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Device IP</span>
                          <span className="font-mono font-bold text-slate-900">192.168.1.45</span>
                        </div>
                        <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Ports & Protocol</span>
                          <span className="font-mono font-bold text-slate-900">HTTP: 80 | HTTPS: 443 (Digest)</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span>Last Checked: {lastCheckedTime || new Date().toLocaleTimeString()}</span>
                        <button
                          type="button"
                          onClick={fetchDiagnostics}
                          disabled={isLoadingDiagnostics}
                          className="px-3 py-1.5 bg-[#EA580C] text-white rounded-lg font-bold text-xs hover:bg-[#C2410C] transition-all border-none cursor-pointer"
                        >
                          {isLoadingDiagnostics ? 'Testing...' : 'Refresh Diagnostics'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ── STEP 4: Membership Payment ── */}
            {step === 4 && (
              <motion.div 
                initial={{ opacity: 0, x: 15 }} 
                animate={{ opacity: 1, x: 0 }} 
                exit={{ opacity: 0, x: -15 }}
                className="max-w-xl mx-auto space-y-6"
              >
                <div className="text-center mb-2">
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Membership Payment Details</h3>
                  <p className="text-xs text-slate-500">Confirm price breakdown and select payment method for Gym Membership</p>
                </div>

                {/* Package Summary Card */}
                <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white p-5 rounded-3xl border border-slate-800 shadow-xl space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-300">Selected Package</span>
                      <h4 className="text-lg font-black">{selectedPlan?.name || '1 MONTH'}</h4>
                    </div>
                    <span className="text-xl font-mono font-black text-emerald-400">
                      ₹{(selectedPlan?.price || 3000).toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-slate-300 pt-2 border-t border-white/10">
                    <span>Duration: {selectedPlan?.duration || '30 Days'}</span>
                    <span>Start Date: {startDate}</span>
                  </div>
                </div>

                {/* Pricing Calculation Form */}
                <div className="bg-slate-50 p-6 rounded-3xl border border-slate-200/80 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Discount (₹)</label>
                      <input 
                        type="number"
                        min="0"
                        value={discount}
                        onChange={(e) => setDiscount(e.target.value)}
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-4 font-mono font-bold text-xs text-slate-900 focus:outline-none focus:border-[#F97316]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Net Billed Amount (₹)</label>
                      <input 
                        type="number"
                        readOnly
                        value={amountPaid}
                        className="w-full h-11 bg-slate-100 border border-slate-300 rounded-xl px-4 font-mono font-black text-xs text-[#C2410C]"
                      />
                    </div>
                  </div>

                  {/* Payment Mode Selection */}
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-2">Select Payment Method *</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {(['UPI', 'Cash', 'Card', 'NetBanking'] as const).map((method) => (
                        <button
                          key={method}
                          type="button"
                          onClick={() => setPaymentMethod(method)}
                          className={`py-3 px-3 rounded-2xl text-xs font-black transition-all flex flex-col items-center gap-1 border cursor-pointer ${
                            paymentMethod === method
                              ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-md scale-[1.02]'
                              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {method === 'UPI' && <Smartphone size={16} />}
                          {method === 'Cash' && <Banknote size={16} />}
                          {method === 'Card' && <CreditCard size={16} />}
                          {method === 'NetBanking' && <Wallet size={16} />}
                          <span>{method}</span>
                        </button>
                      ))}
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
                  <span className="px-3 py-1 bg-[#FFF7ED] border border-[#FED7AA] text-[#C2410C] text-[10px] font-extrabold uppercase tracking-widest rounded-full inline-block mb-1">
                    Step 5 of 6
                  </span>
                  <h3 className="text-xl font-black text-slate-900 tracking-tight">Personal Training Billing</h3>
                  <p className="text-xs text-slate-500">Configure separate PT package duration, price, and payment terms</p>
                </div>

                <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white p-5 rounded-3xl border border-blue-800 shadow-md flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-blue-500/20 border border-orange-400/30 flex items-center justify-center text-orange-200 shrink-0">
                      <Dumbbell size={24} />
                    </div>
                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-orange-200 block">Assigned Personal Trainer</span>
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
                              ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-sm'
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
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#F97316] cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">PT Expiry Date (Auto)</label>
                      <input 
                        type="date"
                        value={ptExpiryDate}
                        onChange={(e) => setPtExpiryDate(e.target.value)}
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#F97316] cursor-pointer"
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
                        className="w-full h-11 bg-slate-100 border border-slate-300 rounded-xl px-4 font-mono font-black text-xs text-[#C2410C]"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-black uppercase tracking-wider text-slate-500 mb-1">Payment Mode *</label>
                      <select
                        value={ptPaymentMethod}
                        onChange={(e) => setPtPaymentMethod(e.target.value as any)}
                        className="w-full h-11 bg-white border border-slate-300 rounded-xl px-4 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#F97316] cursor-pointer"
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
                      <h4 className="text-xs font-black text-[#C2410C] uppercase tracking-wider mb-2">Personal Training Invoice</h4>
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
                    className="px-6 py-3 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white rounded-2xl text-xs font-black transition-all shadow-md border-none cursor-pointer flex items-center gap-2"
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

              <div className="flex items-center gap-2">
                {step === 3 && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.info('Biometric enrollment skipped. Statuses marked as Pending.');
                      setStep(4);
                    }}
                    className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all border-none cursor-pointer"
                  >
                    Skip for now
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleNextStep}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white rounded-xl text-xs font-black transition-all shadow-md border-none cursor-pointer flex items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <span>
                    {step === 4 && !hasPt ? (isSubmitting ? 'Creating Member...' : 'Create Member ✓') : ''}
                    {step === 5 && hasPt ? (isSubmitting ? 'Creating Member...' : 'Create Member & Bills ✓') : ''}
                    {((step < 4 && !hasPt) || (step < 5 && hasPt)) ? 'Next Step' : ''}
                  </span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

        </motion.div>
      </div>

      {/* ── LIVE CAMERA CAPTURE MODAL ── */}
      {isCameraOpen && (
        <div key="live-camera-capture-modal" className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 text-white rounded-3xl p-6 max-w-md w-full space-y-4 text-center border border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-black flex items-center gap-2">
                <Camera size={16} className="text-[#FB923C]" /> Take Member Photo
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
              <div className="relative w-64 h-64 mx-auto rounded-full overflow-hidden border-4 border-[#F97316] shadow-2xl bg-black">
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
                className="px-6 py-2.5 bg-[#EA580C] hover:bg-orange-500 text-white text-xs font-black rounded-xl border-none cursor-pointer flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                <Camera size={16} /> Capture Photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Confirmation Modal */}
      {showDiscardConfirm && (
        <div key="discard-confirmation-modal" className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
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
    </>
  );
}
