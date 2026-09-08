'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  X, User, Phone, Mail, Calendar, Heart, Shield, Smartphone, 
  CheckCircle2, ArrowRight, ArrowLeft, CreditCard, DollarSign, 
  Printer, Download, Sparkles, Fingerprint, Banknote, Wallet, 
  ChevronRight, Dumbbell, Award, AlertCircle, FileText, Upload, Camera, Trash2, RefreshCw, AlertTriangle, Check, SwitchCamera,
  Cpu, ScanFace, Activity, UserCheck, ShieldCheck, Tag, Info, ExternalLink, MessageCircle, Clock, Percent, Zap, ChevronDown
} from 'lucide-react';
import { useRouter } from 'next/navigation';
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

const STEPS = [
  { id: 1, title: 'Profile', desc: 'Basic info & photo' },
  { id: 2, title: 'Personal & Health', desc: 'Fitness & contact' },
  { id: 3, title: 'Membership', desc: 'Package & trainer' },
  { id: 4, title: 'Biometrics', desc: 'Hikvision access' },
  { id: 5, title: 'Payment', desc: 'Discount & billing' },
  { id: 6, title: 'Invoice', desc: 'Receipt & access' },
];

export default function AddMemberModal({ isOpen, onClose }: AddMemberModalProps) {
  const router = useRouter();
  const { plans, fetchPlans, addMember, fetchPayments, members } = useGymStore();

  useEffect(() => {
    if (isOpen) {
      fetchPlans();
    }
  }, [isOpen, fetchPlans]);

  // Current Step: 1 to 6
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [backendError, setBackendError] = useState<string | null>(null);

  // Field Errors State
  const [step1Errors, setStep1Errors] = useState<Record<string, string>>({});
  const [step2Errors, setStep2Errors] = useState<Record<string, string>>({});
  const [photoError, setPhotoError] = useState<string | null>(null);

  // ── Step 1: Profile & Identity ──
  const [fullName, setFullName] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'Male' | 'Female' | 'Other'>('Male');
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isDraggingPhoto, setIsDraggingPhoto] = useState(false);

  // Live Camera Capture Modal State
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Step 2: Personal & Health ──
  const [dob, setDob] = useState('');
  const [occupation, setOccupation] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [age, setAge] = useState('');
  const [maritalStatus, setMaritalStatus] = useState<'single' | 'married'>('single');
  const [anniversaryDate, setAnniversaryDate] = useState('');
  const [address, setAddress] = useState('');
  const [fitnessGoal, setFitnessGoal] = useState('General Fitness');
  const [medicalNotes, setMedicalNotes] = useState('');

  // ── Step 3: Membership Selection ──
  const rawPlans = plans && plans.length > 0 ? plans : [
    { id: 'p_mon', name: '1 MONTH', price: 3000, duration: '30 Days', popular: false },
    { id: 'p_qrt', name: '3 MONTHS', price: 6500, duration: '90 Days', popular: true },
    { id: 'p_semi', name: '6 MONTHS', price: 9500, duration: '180 Days', popular: false },
    { id: 'p_plus', name: '3+1 MONTH', price: 7500, duration: '120 Days', popular: false },
    { id: 'p_ann', name: 'ANNUAL PREMIUM', price: 14000, duration: '365 Days', popular: true },
    { id: 'p_day', name: '10 DAYS', price: 1000, duration: '10 Days', popular: false },
  ];

  const activePlans = deduplicatePackages(rawPlans);
  const [selectedPlan, setSelectedPlan] = useState<any>(activePlans[1] || activePlans[0]);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [referralSource, setReferralSource] = useState('Walk-in');

  // Trainers List for Personal Trainer Option
  const [trainersList, setTrainersList] = useState<any[]>([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState('');

  useEffect(() => {
    if (!isOpen) return;

    const fetchActiveTrainers = async () => {
      try {
        const activeTrns = await getActiveTrainers();
        setTrainersList(activeTrns);
      } catch (err) {
        console.warn("Failed to fetch active trainers:", err);
      }
    };

    fetchActiveTrainers();

    const qEmp = query(collection(db, 'employees'));
    const unsub = onSnapshot(qEmp, async () => {
      try {
        const activeTrns = await getActiveTrainers();
        setTrainersList(activeTrns);
      } catch (err) {
        console.warn("Realtime active trainers sync:", err);
      }
    }, (err) => {
      console.warn("Employees query listener error:", err);
    });

    return () => unsub();
  }, [isOpen]);

  const selectedTrainerObj = useMemo(() => {
    if (!selectedTrainerId) return null;
    return trainersList.find(t => String(t.id || t.employeeId) === String(selectedTrainerId)) || null;
  }, [selectedTrainerId, trainersList]);

  const hasPt = Boolean(selectedTrainerId);

  // Optional PT Details
  const [ptDuration, setPtDuration] = useState('3 Months');
  const [ptAmount, setPtAmount] = useState('6000');
  const [ptDiscount, setPtDiscount] = useState('0');
  const [ptAmountPaid, setPtAmountPaid] = useState('6000');

  // ── Step 4: Hikvision Biometrics ──
  const [biometricId, setBiometricId] = useState('');
  const [enrollStatus, setEnrollStatus] = useState<'idle' | 'enrolling' | 'success' | 'failed' | 'waiting_terminal'>('idle');
  const [enrollMsg, setEnrollMsg] = useState('');
  const [enrollDetailLog, setEnrollDetailLog] = useState('');
  const [selectedEnrollType, setSelectedEnrollType] = useState<'FACE' | 'FINGERPRINT' | 'BOTH'>('FACE');
  const [faceStatus, setFaceStatus] = useState<'NOT ENROLLED' | 'REQUESTING' | 'WAITING FOR TERMINAL' | 'ENROLLED' | 'FAILED' | 'TERMINAL_ENROLLMENT_REQUIRED'>('NOT ENROLLED');
  const [fpStatus, setFpStatus] = useState<'NOT ENROLLED' | 'REQUESTING' | 'WAITING FOR TERMINAL' | 'ENROLLED' | 'FAILED'>('NOT ENROLLED');
  const [hikvisionOnline, setHikvisionOnline] = useState<boolean>(true);
  const [isTestingConn, setIsTestingConn] = useState<boolean>(false);
  const [showDiagnostics, setShowDiagnostics] = useState<boolean>(false);

  // ── Step 5: Payment & Discount ──
  const [discount, setDiscount] = useState('0');
  const [previousBalance, setPreviousBalance] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'Cash' | 'Card' | 'Bank Transfer' | 'Other'>('UPI');
  const [amountPaid, setAmountPaid] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentNotes, setPaymentNotes] = useState('');

  // ── Step 6: Created Invoices ──
  const [createdInvoice, setCreatedInvoice] = useState<any | null>(null);
  const [createdPtInvoice, setCreatedPtInvoice] = useState<any | null>(null);
  const [createdMember, setCreatedMember] = useState<any | null>(null);

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

  // Auto-generate sequential Biometric ID
  useEffect(() => {
    if (isOpen) {
      const nextId = (members.length + 101).toString();
      setBiometricId(nextId);
      if (activePlans.length > 0 && !selectedPlan) {
        setSelectedPlan(activePlans[1] || activePlans[0]);
      }
    }
  }, [isOpen, members.length]);

  // Derived Membership Expiry Date
  const expiryDate = useMemo(() => {
    if (!startDate || !selectedPlan) return '';
    const planDuration = selectedPlan.duration || selectedPlan.name || '30 Days';
    return membershipEngine.calculateMembershipExpiry(startDate, planDuration);
  }, [startDate, selectedPlan]);

  // Financial Calculations
  const packagePrice = Number(selectedPlan?.price) || 2500;
  const discountNum = Math.max(0, Number(discount) || 0);
  const prevCreditNum = Number(previousBalance) || 0;
  const netPayable = Math.max(0, packagePrice - discountNum + prevCreditNum);

  // Auto sync amountPaid with netPayable
  useEffect(() => {
    setAmountPaid(netPayable.toString());
  }, [netPayable]);

  const amountPaidNum = Number(amountPaid) || 0;
  const remainingBalance = Math.max(0, netPayable - amountPaidNum);

  // Check duplicate phone
  const duplicateMember = useMemo(() => {
    if (!mobile || mobile.trim().length < 10) return null;
    const rawDigits = mobile.replace(/\D/g, '').slice(-10);
    return members.find((m: any) => {
      const mDigits = String(m.phone || '').replace(/\D/g, '').slice(-10);
      return mDigits === rawDigits;
    });
  }, [mobile, members]);

  // Check duplicate biometric ID
  const duplicateBioMember = useMemo(() => {
    if (!biometricId || biometricId.trim().length === 0) return null;
    const cleanId = biometricId.trim();
    return members.find((m: any) => {
      const mId = String(m.biometricId || m.deviceUserId || '').trim();
      return mId === cleanId;
    });
  }, [biometricId, members]);

  // Photo File Handlers
  const handlePhotoFile = (file: File) => {
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

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingPhoto(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingPhoto(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingPhoto(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handlePhotoFile(e.dataTransfer.files[0]);
    }
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

  const switchCamera = () => {
    stopCameraCapture();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
    setTimeout(() => {
      startCameraCapture();
    }, 200);
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

  // Step 1 Validation
  const validateStep1 = () => {
    const parseRes = step1Schema.safeParse({
      fullName,
      mobile,
      email: email || undefined,
      gender,
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

  // Step 2 Validation
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

  // Hikvision Health Check
  const checkHikvisionStatus = async () => {
    setIsTestingConn(true);
    try {
      const resp = await API.post('/devices/hikvision/test-connection');
      if (resp.data && resp.data.online) {
        setHikvisionOnline(true);
        toast.success('Hikvision Terminal Connected ✓ (192.168.1.45)');
      } else {
        setHikvisionOnline(false);
        toast.error('Hikvision terminal unreachable on 192.168.1.45');
      }
    } catch (e) {
      setHikvisionOnline(false);
      toast.error('Error connecting to Hikvision biometric terminal');
    } finally {
      setIsTestingConn(false);
    }
  };

  // Hikvision Enrollment Trigger
  const handleExecuteEnrollment = async (type: 'FACE' | 'FINGERPRINT' | 'BOTH') => {
    setSelectedEnrollType(type);
    setEnrollStatus('enrolling');
    setEnrollDetailLog('');

    if (type === 'FACE') {
      setFaceStatus('REQUESTING');
      setEnrollMsg('Sending face registration request to terminal...');
    } else if (type === 'FINGERPRINT') {
      setFpStatus('REQUESTING');
      setEnrollMsg('Sending fingerprint enrollment command to scanner...');
    } else {
      setFaceStatus('REQUESTING');
      setFpStatus('REQUESTING');
      setEnrollMsg('Initiating face + fingerprint enrollment sequence...');
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
        if (type === 'FACE' || type === 'BOTH') setFaceStatus('ENROLLED');
        if (type === 'FINGERPRINT' || type === 'BOTH') setFpStatus('ENROLLED');
        setEnrollMsg(`✓ ${type} enrolled on Hikvision terminal (ID #${biometricId || '101'})`);
        toast.success(`${type} enrolled successfully on Hikvision terminal`);
      } else if (resp.data && resp.data.requiresTerminalAction) {
        setEnrollStatus('waiting_terminal');
        if (type === 'FACE' || type === 'BOTH') setFaceStatus('TERMINAL_ENROLLMENT_REQUIRED');
        if (type === 'FINGERPRINT' || type === 'BOTH') setFpStatus('WAITING FOR TERMINAL');
        const terminalMsg = resp.data.message || `User #${biometricId || '101'} created. Complete scan on physical device.`;
        setEnrollMsg(terminalMsg);
        setEnrollDetailLog(
          `Status: 200 OK\nAction: Ask member to place finger or look into camera on terminal #192.168.1.45.`
        );
        toast.success(`User #${biometricId || '101'} created on terminal! Complete scan on device.`);
      } else {
        setEnrollStatus('failed');
        if (type === 'FACE' || type === 'BOTH') setFaceStatus('FAILED');
        if (type === 'FINGERPRINT' || type === 'BOTH') setFpStatus('FAILED');
        const errReason = resp.data?.error || 'Hikvision request failed.';
        setEnrollMsg(`Error: ${errReason}`);
        setEnrollDetailLog(`API Error: ${JSON.stringify(resp.data, null, 2)}`);
        toast.error(`Terminal error: ${errReason}`);
      }
    } catch (e: any) {
      setEnrollStatus('failed');
      if (type === 'FACE' || type === 'BOTH') setFaceStatus('FAILED');
      if (type === 'FINGERPRINT' || type === 'BOTH') setFpStatus('FAILED');
      const errMsg = e.response?.data?.error || e.message || 'Connection error';
      setEnrollMsg(`Hikvision Error: ${errMsg}`);
      setEnrollDetailLog(`Exception: ${errMsg}`);
      toast.error(`Hikvision Error: ${errMsg}`);
    }
  };

  // Step Navigation Handlers
  const handleNextStep = () => {
    if (step === 1) {
      if (!validateStep1()) {
        toast.error('Please fix the required fields in Profile');
        return;
      }
      setStep(2);
      return;
    }

    if (step === 2) {
      if (!validateStep2()) {
        toast.error('Please fix the validation errors in Personal & Health');
        return;
      }
      setStep(3);
      return;
    }

    if (step === 3) {
      if (!selectedPlan) {
        toast.error('Please select a membership package');
        return;
      }
      setStep(4);
      return;
    }

    if (step === 4) {
      setStep(5);
      return;
    }

    if (step === 5) {
      handleSubmitFinal();
      return;
    }
  };

  const handlePrevStep = () => {
    if (step > 1) {
      setStep(step - 1);
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
        price: packagePrice,
        originalAmount: packagePrice,
        packagePrice: packagePrice,
        discountAmount: discountNum,
        discount: discountNum,
        netPayable: netPayable,
        amount: netPayable,
        amountPaid: amountPaidNum,
        paid: amountPaidNum,
        joinDate: todayStr,
        startDate: memStartDate,
        createdAt: new Date().toISOString(),
        expiryDate: expiryStr,
        status: computedStatus,
        paymentStatus: amountPaidNum >= netPayable ? 'paid' : (amountPaidNum > 0 ? 'partial' : 'pending'),
        totalBilled: netPayable,
        totalPaid: amountPaidNum,
        biometricId: biometricId || '101',
        deviceUserId: biometricId || '101',
        trainerId: selectedTrainerId || 'null',
        trainer: trnName,
        trainerName: trnName,
        gender,
        isRealTimeToday: true,
        paymentMethod: paymentMethod,
        paymentDate: paymentDate,
        paymentNotes: paymentNotes,
        idempotencyKey: onboardingUuid,
        invoiceNumber: memInvoiceNo,
        referralSource,
        dob, occupation, emergencyContact,
        height, weight, age, maritalStatus,
        anniversaryDate: maritalStatus === 'married' ? anniversaryDate : null,
        address, fitnessGoal, medicalNotes
      };

      if (hasPt && selectedTrainerObj) {
        const ptAmtNum = Number(ptAmount) || 6000;
        const ptDiscNum = Number(ptDiscount) || 0;
        const ptNetNum = Math.max(0, ptAmtNum - ptDiscNum);
        const ptPaidNum = Number(ptAmountPaid) || ptNetNum;

        memberPayload.ptBilling = {
          enabled: true,
          trainerId: selectedTrainerObj.id || selectedTrainerObj.employeeId,
          trainerName: selectedTrainerObj.name,
          trainerRole: selectedTrainerObj.role || 'Personal Trainer',
          packageName: `Personal Training (${ptDuration})`,
          duration: ptDuration,
          originalAmount: ptAmtNum,
          packagePrice: ptAmtNum,
          discountAmount: ptDiscNum,
          discount: ptDiscNum,
          netPayable: ptNetNum,
          amount: ptNetNum,
          amountPaid: ptPaidNum,
          paid: ptPaidNum,
          paymentMethod: paymentMethod,
          startDate: memStartDate,
          expiryDate: expiryStr,
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
        originalAmount: packagePrice,
        packagePrice: packagePrice,
        discountAmount: discountNum,
        discount: discountNum,
        netPayable: netPayable,
        amount: netPayable,
        amountPaid: amountPaidNum,
        paid: amountPaidNum,
        pendingAmount: remainingBalance,
        method: paymentMethod,
        paymentMethod: paymentMethod,
        status: amountPaidNum >= netPayable ? 'paid' : (amountPaidNum > 0 ? 'partial' : 'pending'),
        date: todayStr,
        startDate: memStartDate,
        expiryDate: expiryStr
      };

      setCreatedMember(createdMem);
      setCreatedInvoice(memInv);
      setStep(6);
      toast.success('Member onboarded & invoice issued! 🚀');
    } catch (err: any) {
      const errMsg = err.message || 'Failed to complete member onboarding.';
      setBackendError(errMsg);
      toast.error(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseModal = () => {
    if (step === 6) {
      onClose();
      return;
    }
    if (fullName || mobile || photoPreview) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  };

  const resetForm = () => {
    setStep(1);
    setFullName('');
    setMobile('');
    setEmail('');
    setPhotoPreview(null);
    setGender('Male');
    setDob('');
    setOccupation('');
    setEmergencyContact('');
    setHeight('');
    setWeight('');
    setAge('');
    setAddress('');
    setMedicalNotes('');
    setDiscount('0');
    setPreviousBalance('0');
    setCreatedMember(null);
    setCreatedInvoice(null);
    setStep1Errors({});
    setStep2Errors({});
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-4xl bg-white rounded-2xl md:rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[92vh] my-auto"
        >
          {/* ══════════════════════════════════════════════════════════════════
              1. PREMIUM WARRIOR HEADER
             ══════════════════════════════════════════════════════════════════ */}
          <div className="relative px-6 py-5 bg-gradient-to-r from-[#FF7A00] via-[#F04400] to-[#C23500] text-white shrink-0 overflow-hidden">
            {/* Background geometric accents */}
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-2xl pointer-events-none -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-1/3 w-48 h-48 bg-black/10 rounded-full blur-xl pointer-events-none" />

            <div className="relative flex items-center justify-between z-10">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-inner">
                  <UserCheck className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black tracking-widest uppercase px-2 py-0.5 rounded-full bg-black/20 text-white/90 border border-white/10">
                      The Warrior Gym CRM
                    </span>
                    <span className="text-[11px] font-medium text-orange-100 hidden sm:inline">
                      • Step {step} of 6
                    </span>
                  </div>
                  <h2 className="text-xl font-bold tracking-tight text-white mt-0.5">
                    {step === 6 ? 'Member Onboarding Complete' : 'New Member Onboarding'}
                  </h2>
                  <p className="text-xs text-orange-100/90 font-normal">
                    {step === 6 ? 'Official invoice generated and account active' : 'Create a complete member profile, membership and biometric record.'}
                  </p>
                </div>
              </div>

              {/* Right: Progress Pill & Close */}
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex flex-col items-end text-right">
                  <span className="text-[11px] font-bold text-white tracking-wide">
                    {Math.round((step / 6) * 100)}% Complete
                  </span>
                  <div className="w-24 h-1.5 bg-black/20 rounded-full mt-1 overflow-hidden">
                    <motion.div
                      className="h-full bg-white rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${(step / 6) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCloseModal}
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-all duration-150 border border-white/20"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              2. SMART PROGRESS STEPPER
             ══════════════════════════════════════════════════════════════════ */}
          <div className="px-6 py-2.5 bg-stone-50 border-b border-stone-200 shrink-0 overflow-x-auto no-scrollbar">
            <div className="flex items-center justify-between min-w-[540px] gap-2">
              {STEPS.map((s, idx) => {
                const isActive = step === s.id;
                const isCompleted = step > s.id;
                const isClickable = step > s.id && step !== 6;

                return (
                  <React.Fragment key={s.id}>
                    <button
                      type="button"
                      disabled={!isClickable}
                      onClick={() => isClickable && setStep(s.id)}
                      className={`flex items-center gap-2 text-left py-1 px-2 rounded-lg transition-all ${
                        isActive
                          ? 'bg-orange-100/80 text-[#EA580C] font-semibold'
                          : isCompleted
                          ? 'text-stone-700 hover:text-stone-900 cursor-pointer'
                          : 'text-stone-400 cursor-default opacity-60'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 transition-colors ${
                          isActive
                            ? 'bg-[#F04400] text-white shadow-sm'
                            : isCompleted
                            ? 'bg-emerald-600 text-white'
                            : 'bg-stone-200 text-stone-500'
                        }`}
                      >
                        {isCompleted ? <Check className="w-3 h-3 stroke-[3]" /> : s.id}
                      </div>
                      <div className="text-xs whitespace-nowrap">
                        <span className={isActive ? 'font-bold text-[#EA580C]' : 'font-medium'}>
                          {s.title}
                        </span>
                      </div>
                    </button>

                    {idx < STEPS.length - 1 && (
                      <div
                        className={`h-0.5 flex-1 mx-1 rounded-full transition-colors ${
                          step > idx + 1 ? 'bg-emerald-500' : 'bg-stone-200'
                        }`}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              3. SCROLLABLE STEP BODY
             ══════════════════════════════════════════════════════════════════ */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 text-slate-800">
            {backendError && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2.5">
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-500" />
                <span>{backendError}</span>
              </div>
            )}

            <AnimatePresence mode="wait">
              {/* ─────────────────────────────────────────────────────────────
                  STEP 01: PROFILE
                 ───────────────────────────────────────────────────────────── */}
              {step === 1 && (
                <motion.div
                  key="step-1"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.18 }}
                  className="grid grid-cols-1 md:grid-cols-12 gap-6"
                >
                  {/* Left Column: Photo Uploader */}
                  <div className="md:col-span-4 flex flex-col items-center justify-start p-5 bg-stone-50 rounded-2xl border border-stone-200 text-center">
                    <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider mb-3">
                      Member Photo
                    </span>

                    {/* Circular Preview / Dropzone */}
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`relative w-36 h-36 rounded-full overflow-hidden border-2 border-dashed flex items-center justify-center transition-all group ${
                        isDraggingPhoto
                          ? 'border-[#F04400] bg-orange-50'
                          : photoPreview
                          ? 'border-emerald-500 bg-white shadow-md'
                          : 'border-stone-300 bg-white hover:border-orange-400'
                      }`}
                    >
                      {photoPreview ? (
                        <img
                          src={photoPreview}
                          alt="Member Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center p-3 text-stone-400">
                          <User className="w-10 h-10 stroke-[1.5] mb-1 text-stone-300 group-hover:text-orange-400 transition-colors" />
                          <span className="text-[10px] font-medium text-stone-500 leading-tight">
                            Drop photo here
                          </span>
                        </div>
                      )}

                      {photoPreview && (
                        <button
                          type="button"
                          onClick={() => setPhotoPreview(null)}
                          className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-5 h-5 mb-1 text-red-300" />
                          <span className="text-[10px] font-bold">Remove</span>
                        </button>
                      )}
                    </div>

                    {photoError && (
                      <span className="text-[10px] text-red-600 font-medium mt-2">
                        {photoError}
                      </span>
                    )}

                    {/* Upload / Camera Action Buttons */}
                    <div className="flex items-center gap-2 mt-4 w-full">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            handlePhotoFile(e.target.files[0]);
                          }
                        }}
                        className="hidden"
                      />
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex-1 py-2 px-2.5 bg-white border border-stone-200 hover:border-orange-300 text-stone-700 hover:text-[#EA580C] text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-xs"
                      >
                        <Upload className="w-3.5 h-3.5 text-stone-500" />
                        <span>Upload</span>
                      </button>

                      <button
                        type="button"
                        onClick={startCameraCapture}
                        className="flex-1 py-2 px-2.5 bg-gradient-to-r from-[#FF7A00] to-[#F04400] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 hover:brightness-105 transition-all shadow-xs"
                      >
                        <Camera className="w-3.5 h-3.5" />
                        <span>Webcam</span>
                      </button>
                    </div>

                    <p className="text-[10px] text-stone-400 mt-3">
                      JPG, PNG or WEBP (Max 5 MB)
                    </p>
                  </div>

                  {/* Right Column: Identity Fields */}
                  <div className="md:col-span-8 space-y-4">
                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Full Name <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => {
                            setFullName(e.target.value);
                            if (step1Errors.fullName) setStep1Errors(prev => ({ ...prev, fullName: '' }));
                          }}
                          placeholder="e.g. Vikram Singh"
                          className={`w-full pl-10 pr-4 py-2.5 text-sm bg-white rounded-xl border ${
                            step1Errors.fullName
                              ? 'border-red-500 focus:ring-red-200'
                              : 'border-stone-200 focus:border-[#F04400] focus:ring-orange-100'
                          } focus:outline-hidden focus:ring-3 transition-all`}
                        />
                      </div>
                      {step1Errors.fullName && (
                        <p className="text-[11px] text-red-500 font-medium mt-1">
                          {step1Errors.fullName}
                        </p>
                      )}
                    </div>

                    {/* Mobile Number & Duplicate Check */}
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Mobile Number <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute left-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-stone-400 text-xs font-bold">
                          <span>+91</span>
                        </div>
                        <input
                          type="tel"
                          maxLength={10}
                          value={mobile}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').slice(0, 10);
                            setMobile(val);
                            if (step1Errors.mobile) setStep1Errors(prev => ({ ...prev, mobile: '' }));
                          }}
                          placeholder="9876543210"
                          className={`w-full pl-12 pr-4 py-2.5 text-sm bg-white rounded-xl border ${
                            step1Errors.mobile
                              ? 'border-red-500 focus:ring-red-200'
                              : 'border-stone-200 focus:border-[#F04400] focus:ring-orange-100'
                          } focus:outline-hidden focus:ring-3 transition-all font-mono`}
                        />
                      </div>
                      {step1Errors.mobile && (
                        <p className="text-[11px] text-red-500 font-medium mt-1">
                          {step1Errors.mobile}
                        </p>
                      )}
                      {duplicateMember && (
                        <div className="mt-1.5 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span>
                            Member already exists with this phone: <strong>{duplicateMember.name}</strong> ({duplicateMember.status})
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Email Address */}
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Email Address <span className="text-stone-400 text-[10px] lowercase">(optional)</span>
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => {
                            setEmail(e.target.value);
                            if (step1Errors.email) setStep1Errors(prev => ({ ...prev, email: '' }));
                          }}
                          placeholder="vikram.singh@gmail.com"
                          className="w-full pl-10 pr-4 py-2.5 text-sm bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:ring-3 focus:ring-orange-100 focus:outline-hidden transition-all"
                        />
                      </div>
                      {step1Errors.email && (
                        <p className="text-[11px] text-red-500 font-medium mt-1">
                          {step1Errors.email}
                        </p>
                      )}
                    </div>

                    {/* Gender Segmented Control */}
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Gender
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {(['Male', 'Female', 'Other'] as const).map((g) => (
                          <button
                            key={g}
                            type="button"
                            onClick={() => setGender(g)}
                            className={`py-2 px-3 text-xs font-bold rounded-xl border transition-all ${
                              gender === g
                                ? 'bg-orange-50 border-[#F04400] text-[#EA580C] shadow-xs'
                                : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                            }`}
                          >
                            {g}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* DOB & Emergency Contact */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                          Date of Birth
                        </label>
                        <input
                          type="date"
                          value={dob}
                          max={new Date().toISOString().split('T')[0]}
                          onChange={(e) => setDob(e.target.value)}
                          className="w-full px-3.5 py-2 text-sm bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:ring-3 focus:ring-orange-100 focus:outline-hidden transition-all"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                          Emergency Contact
                        </label>
                        <input
                          type="tel"
                          value={emergencyContact}
                          onChange={(e) => setEmergencyContact(e.target.value)}
                          placeholder="e.g. 9811002233"
                          className="w-full px-3.5 py-2 text-sm bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:ring-3 focus:ring-orange-100 focus:outline-hidden transition-all font-mono"
                        />
                      </div>
                    </div>

                    {/* Occupation */}
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Occupation
                      </label>
                      <input
                        type="text"
                        value={occupation}
                        onChange={(e) => setOccupation(e.target.value)}
                        placeholder="e.g. IT Professional, Entrepreneur, Student"
                        className="w-full px-3.5 py-2 text-sm bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:ring-3 focus:ring-orange-100 focus:outline-hidden transition-all"
                      />
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  STEP 02: PERSONAL & HEALTH
                 ───────────────────────────────────────────────────────────── */}
              {step === 2 && (
                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-6"
                >
                  <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 space-y-4">
                    <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider flex items-center gap-2">
                      <Heart className="w-4 h-4 text-[#F04400]" /> Physical Attributes & Health
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-stone-600 mb-1">
                          Height (cm)
                        </label>
                        <input
                          type="number"
                          value={height}
                          onChange={(e) => setHeight(e.target.value)}
                          placeholder="e.g. 175"
                          className="w-full px-3.5 py-2 text-sm bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:ring-3 focus:ring-orange-100 focus:outline-hidden transition-all"
                        />
                        {step2Errors.height && (
                          <p className="text-[10px] text-red-500 mt-1">{step2Errors.height}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-600 mb-1">
                          Weight (kg)
                        </label>
                        <input
                          type="number"
                          value={weight}
                          onChange={(e) => setWeight(e.target.value)}
                          placeholder="e.g. 72"
                          className="w-full px-3.5 py-2 text-sm bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:ring-3 focus:ring-orange-100 focus:outline-hidden transition-all"
                        />
                        {step2Errors.weight && (
                          <p className="text-[10px] text-red-500 mt-1">{step2Errors.weight}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-stone-600 mb-1">
                          Age (Years)
                        </label>
                        <input
                          type="number"
                          value={age}
                          onChange={(e) => setAge(e.target.value)}
                          placeholder="e.g. 26"
                          className="w-full px-3.5 py-2 text-sm bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:ring-3 focus:ring-orange-100 focus:outline-hidden transition-all"
                        />
                      </div>
                    </div>

                    {/* Calculated BMI Badge */}
                    {height && weight && Number(height) > 0 && Number(weight) > 0 && (
                      <div className="p-3 bg-white rounded-xl border border-stone-200 flex items-center justify-between text-xs">
                        <span className="font-medium text-stone-600">Estimated Body Mass Index (BMI):</span>
                        <span className="font-black text-[#EA580C]">
                          {(Number(weight) / Math.pow(Number(height) / 100, 2)).toFixed(1)} kg/m²
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Marital Status & Anniversary */}
                  <div className="bg-stone-50 p-5 rounded-2xl border border-stone-200 space-y-4">
                    <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                      Marital Status & Milestones
                    </h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                          Status
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {(['single', 'married'] as const).map((ms) => (
                            <button
                              key={ms}
                              type="button"
                              onClick={() => setMaritalStatus(ms)}
                              className={`py-2 px-3 text-xs font-bold rounded-xl border capitalize transition-all ${
                                maritalStatus === ms
                                  ? 'bg-orange-50 border-[#F04400] text-[#EA580C]'
                                  : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                              }`}
                            >
                              {ms}
                            </button>
                          ))}
                        </div>
                      </div>

                      {maritalStatus === 'married' && (
                        <div>
                          <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                            Anniversary Date <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="date"
                            value={anniversaryDate}
                            onChange={(e) => setAnniversaryDate(e.target.value)}
                            className="w-full px-3.5 py-2 text-sm bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:ring-3 focus:ring-orange-100 focus:outline-hidden transition-all"
                          />
                          {step2Errors.anniversaryDate && (
                            <p className="text-[10px] text-red-500 mt-1">
                              {step2Errors.anniversaryDate}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Residential Address & Fitness Goals */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Residential Address
                      </label>
                      <textarea
                        rows={2}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="House / Flat No., Society, Landmark, City"
                        className="w-full px-3.5 py-2 text-sm bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:ring-3 focus:ring-orange-100 focus:outline-hidden transition-all resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Primary Fitness Goal
                      </label>
                      <select
                        value={fitnessGoal}
                        onChange={(e) => setFitnessGoal(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:ring-3 focus:ring-orange-100 focus:outline-hidden transition-all"
                      >
                        <option value="General Fitness">General Fitness & Endurance</option>
                        <option value="Weight Loss">Weight Loss & Fat Burn</option>
                        <option value="Muscle Hypertrophy">Muscle Hypertrophy & Bodybuilding</option>
                        <option value="Strength Training">Powerlifting & Strength</option>
                        <option value="Athletic Conditioning">Athletic Conditioning</option>
                        <option value="Rehabilitation">Rehabilitation & Posture</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  STEP 03: MEMBERSHIP PACKAGES
                 ───────────────────────────────────────────────────────────── */}
              {step === 3 && (
                <motion.div
                  key="step-3"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-6"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="text-sm font-bold text-stone-900 tracking-tight">
                          Select Membership Package
                        </h3>
                        <p className="text-xs text-stone-500">
                          Choose package tier and duration for the member
                        </p>
                      </div>
                      <span className="text-xs font-bold text-[#EA580C] bg-orange-50 px-2.5 py-1 rounded-full border border-orange-200">
                        {activePlans.length} Plans Available
                      </span>
                    </div>

                    {/* Membership Cards Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                      {activePlans.map((p) => {
                        const isSelected = selectedPlan?.id === p.id || selectedPlan?.name === p.name;
                        const isPopular = p.popular || String(p.name).includes('3 MONTH') || String(p.name).includes('ANNUAL');

                        return (
                          <div
                            key={p.id || p.name}
                            onClick={() => setSelectedPlan(p)}
                            className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                              isSelected
                                ? 'border-[#F04400] bg-gradient-to-b from-orange-50/80 to-white shadow-md shadow-orange-500/10'
                                : 'border-stone-200 bg-white hover:border-orange-300 hover:shadow-xs'
                            }`}
                          >
                            {/* Popular / Best Value Badge */}
                            {isPopular && (
                              <div className="absolute -top-2.5 right-3 bg-gradient-to-r from-[#FF7A00] to-[#F04400] text-white text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" /> Popular
                              </div>
                            )}

                            <div>
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-black tracking-wide text-stone-900 uppercase">
                                  {p.name}
                                </span>
                                {isSelected && (
                                  <div className="w-5 h-5 rounded-full bg-[#F04400] text-white flex items-center justify-center">
                                    <Check className="w-3 h-3 stroke-[3]" />
                                  </div>
                                )}
                              </div>
                              <span className="text-[11px] text-stone-500 font-medium">
                                Validity: {p.duration || '30 Days'}
                              </span>
                            </div>

                            <div className="mt-4 pt-3 border-t border-stone-100 flex items-baseline justify-between">
                              <span className="text-lg font-black text-stone-900">
                                ₹{Number(p.price || 0).toLocaleString('en-IN')}
                              </span>
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                                Official Rate
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Start Date & Expiry Calculation */}
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Membership Start Date
                      </label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:ring-3 focus:ring-orange-100 focus:outline-hidden transition-all"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Auto-Calculated Expiry Date
                      </label>
                      <div className="w-full px-3.5 py-2 text-sm bg-white rounded-xl border border-stone-200 font-bold text-stone-800 flex items-center justify-between">
                        <span>{expiryDate || '—'}</span>
                        <span className="text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 px-2 py-0.5 rounded">
                          Active Until
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Personal Trainer & Referral Source */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Assign Personal Trainer <span className="text-stone-400 text-[10px] lowercase">(optional)</span>
                      </label>
                      <select
                        value={selectedTrainerId}
                        onChange={(e) => setSelectedTrainerId(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:ring-3 focus:ring-orange-100 focus:outline-hidden transition-all"
                      >
                        <option value="">No Trainer (General Gym Access)</option>
                        {trainersList.map((t) => (
                          <option key={t.id || t.employeeId} value={t.id || t.employeeId}>
                            {t.name} ({t.role || 'Fitness Trainer'})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                        Referral Source
                      </label>
                      <select
                        value={referralSource}
                        onChange={(e) => setReferralSource(e.target.value)}
                        className="w-full px-3.5 py-2 text-sm bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:ring-3 focus:ring-orange-100 focus:outline-hidden transition-all"
                      >
                        <option value="Walk-in">Direct Walk-in</option>
                        <option value="Google / Maps">Google Search / Maps</option>
                        <option value="Instagram / Social">Instagram / Social Media</option>
                        <option value="Friend / Member Referral">Friend / Member Referral</option>
                        <option value="Gym Hoarding / Banner">Gym Banner / Hoarding</option>
                        <option value="Corporate Partner">Corporate Partner</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  STEP 04: BIOMETRICS (HIKVISION INTEGRATION)
                 ───────────────────────────────────────────────────────────── */}
              {step === 4 && (
                <motion.div
                  key="step-4"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-6"
                >
                  {/* Top Bar: Biometric User ID & Terminal Telemetry */}
                  <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                        Biometric Machine User ID <span className="text-red-500">*</span>
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={biometricId}
                          onChange={(e) => setBiometricId(e.target.value.replace(/\D/g, ''))}
                          placeholder="e.g. 101"
                          className="w-32 px-3 py-1.5 text-base font-mono font-bold bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:outline-hidden"
                        />
                        <span className="text-xs text-stone-500">
                          (Used on turnstile / Hikvision reader)
                        </span>
                      </div>
                      {duplicateBioMember && (
                        <p className="text-[11px] text-amber-600 font-medium mt-1">
                          ⚠️ ID #{biometricId} is already assigned to {duplicateBioMember.name}
                        </p>
                      )}
                    </div>

                    {/* Hardware Terminal Status */}
                    <div className="flex items-center gap-2.5 bg-white px-3.5 py-2 rounded-xl border border-stone-200">
                      <div className={`w-2.5 h-2.5 rounded-full ${hikvisionOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                      <div className="text-left">
                        <span className="text-[11px] font-bold text-stone-800 block leading-tight">
                          Hikvision DS-K1T342MFWX
                        </span>
                        <span className="text-[10px] text-stone-500">
                          IP: 192.168.1.45 • {hikvisionOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={checkHikvisionStatus}
                        disabled={isTestingConn}
                        className="ml-2 p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100 transition-colors"
                        title="Check Terminal Connection"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isTestingConn ? 'animate-spin text-orange-500' : ''}`} />
                      </button>
                    </div>
                  </div>

                  {/* Three Premium Enrollment Action Cards */}
                  <div>
                    <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider mb-3">
                      Select Enrollment Action
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                      {/* 1. Register Face */}
                      <div
                        onClick={() => handleExecuteEnrollment('FACE')}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          selectedEnrollType === 'FACE' && enrollStatus !== 'idle'
                            ? 'border-[#F04400] bg-orange-50/60 shadow-sm'
                            : 'border-stone-200 bg-white hover:border-orange-300'
                        }`}
                      >
                        <div>
                          <div className="w-10 h-10 rounded-xl bg-orange-100 text-[#EA580C] flex items-center justify-center mb-3">
                            <ScanFace className="w-5 h-5" />
                          </div>
                          <h4 className="text-sm font-bold text-stone-900">
                            Register Face
                          </h4>
                          <p className="text-[11px] text-stone-500 mt-1">
                            Sends command to terminal camera to capture 3D facial profile.
                          </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            faceStatus === 'ENROLLED' ? 'bg-emerald-100 text-emerald-800' :
                            faceStatus === 'FAILED' ? 'bg-red-100 text-red-800' :
                            faceStatus === 'REQUESTING' ? 'bg-orange-100 text-orange-800 animate-pulse' :
                            faceStatus === 'TERMINAL_ENROLLMENT_REQUIRED' ? 'bg-amber-100 text-amber-800' :
                            'bg-stone-100 text-stone-600'
                          }`}>
                            {faceStatus}
                          </span>
                          <ChevronRight className="w-4 h-4 text-stone-400" />
                        </div>
                      </div>

                      {/* 2. Register Fingerprint */}
                      <div
                        onClick={() => handleExecuteEnrollment('FINGERPRINT')}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          selectedEnrollType === 'FINGERPRINT' && enrollStatus !== 'idle'
                            ? 'border-[#F04400] bg-orange-50/60 shadow-sm'
                            : 'border-stone-200 bg-white hover:border-orange-300'
                        }`}
                      >
                        <div>
                          <div className="w-10 h-10 rounded-xl bg-stone-100 text-stone-700 flex items-center justify-center mb-3">
                            <Fingerprint className="w-5 h-5" />
                          </div>
                          <h4 className="text-sm font-bold text-stone-900">
                            Register Fingerprint
                          </h4>
                          <p className="text-[11px] text-stone-500 mt-1">
                            Enrolls biometric fingerprint template on scanner.
                          </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                          <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                            fpStatus === 'ENROLLED' ? 'bg-emerald-100 text-emerald-800' :
                            fpStatus === 'FAILED' ? 'bg-red-100 text-red-800' :
                            fpStatus === 'REQUESTING' ? 'bg-orange-100 text-orange-800 animate-pulse' :
                            fpStatus === 'WAITING FOR TERMINAL' ? 'bg-amber-100 text-amber-800' :
                            'bg-stone-100 text-stone-600'
                          }`}>
                            {fpStatus}
                          </span>
                          <ChevronRight className="w-4 h-4 text-stone-400" />
                        </div>
                      </div>

                      {/* 3. Face + Fingerprint */}
                      <div
                        onClick={() => handleExecuteEnrollment('BOTH')}
                        className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                          selectedEnrollType === 'BOTH' && enrollStatus !== 'idle'
                            ? 'border-[#F04400] bg-orange-50/60 shadow-sm'
                            : 'border-stone-200 bg-white hover:border-orange-300'
                        }`}
                      >
                        <div>
                          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center mb-3">
                            <ShieldCheck className="w-5 h-5" />
                          </div>
                          <h4 className="text-sm font-bold text-stone-900">
                            Face + Fingerprint
                          </h4>
                          <p className="text-[11px] text-stone-500 mt-1">
                            Dual sequential enrollment for highest turnstile security.
                          </p>
                        </div>
                        <div className="mt-4 pt-3 border-t border-stone-100 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-[#EA580C] bg-orange-50 px-2 py-0.5 rounded">
                            Sequential
                          </span>
                          <ChevronRight className="w-4 h-4 text-stone-400" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Live Status Response Log */}
                  {enrollMsg && (
                    <div className={`p-4 rounded-2xl border text-xs ${
                      enrollStatus === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-900' :
                      enrollStatus === 'failed' ? 'bg-red-50 border-red-200 text-red-900' :
                      enrollStatus === 'waiting_terminal' ? 'bg-amber-50 border-amber-200 text-amber-900' :
                      'bg-orange-50 border-orange-200 text-orange-900'
                    }`}>
                      <div className="flex items-center gap-2 font-bold mb-1">
                        {enrollStatus === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        {enrollStatus === 'failed' && <AlertTriangle className="w-4 h-4 text-red-600" />}
                        {enrollStatus === 'waiting_terminal' && <Info className="w-4 h-4 text-amber-600" />}
                        {enrollStatus === 'enrolling' && <RefreshCw className="w-4 h-4 text-orange-600 animate-spin" />}
                        <span>Terminal Feedback</span>
                      </div>
                      <p className="font-medium">{enrollMsg}</p>
                      {enrollDetailLog && (
                        <pre className="mt-2 p-2 bg-black/5 rounded-lg text-[10px] font-mono whitespace-pre-wrap overflow-x-auto">
                          {enrollDetailLog}
                        </pre>
                      )}
                    </div>
                  )}

                  <div className="p-3.5 bg-stone-50 rounded-xl border border-stone-200 text-xs text-stone-600 flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-stone-400 shrink-0" />
                      Biometrics can also be assigned or re-synced anytime from the member profile.
                    </span>
                  </div>
                </motion.div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  STEP 05: PAYMENT & FINANCIAL ADJUSTMENTS
                 ───────────────────────────────────────────────────────────── */}
              {step === 5 && (
                <motion.div
                  key="step-5"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  transition={{ duration: 0.18 }}
                  className="space-y-6"
                >
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    {/* Left: Input Fields */}
                    <div className="md:col-span-7 space-y-4">
                      <h3 className="text-xs font-bold text-stone-700 uppercase tracking-wider">
                        Payment & Adjustment Breakdown
                      </h3>

                      {/* Financial Discount (Financial Adjustment) */}
                      <div>
                        <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                          <span>Financial Discount (₹)</span>
                          <span className="text-[10px] font-medium text-stone-500 lowercase">
                            (financial adjustment, not payment)
                          </span>
                        </label>
                        <div className="relative">
                          <Percent className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <input
                            type="number"
                            min="0"
                            value={discount}
                            onChange={(e) => setDiscount(e.target.value)}
                            placeholder="0"
                            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:ring-3 focus:ring-orange-100 focus:outline-hidden transition-all font-mono"
                          />
                        </div>
                      </div>

                      {/* Previous Balance / Credit */}
                      <div>
                        <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                          Previous Balance / Credit Adjustment (₹)
                        </label>
                        <div className="relative">
                          <Wallet className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <input
                            type="number"
                            value={previousBalance}
                            onChange={(e) => setPreviousBalance(e.target.value)}
                            placeholder="0"
                            className="w-full pl-10 pr-4 py-2.5 text-sm bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:ring-3 focus:ring-orange-100 focus:outline-hidden transition-all font-mono"
                          />
                        </div>
                      </div>

                      {/* Amount Paid */}
                      <div>
                        <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                          Amount Paid Today (₹) <span className="text-red-500">*</span>
                        </label>
                        <div className="relative">
                          <Banknote className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                          <input
                            type="number"
                            min="0"
                            value={amountPaid}
                            onChange={(e) => setAmountPaid(e.target.value)}
                            placeholder={netPayable.toString()}
                            className="w-full pl-10 pr-4 py-2.5 text-base font-bold bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:ring-3 focus:ring-orange-100 focus:outline-hidden transition-all font-mono"
                          />
                        </div>
                      </div>

                      {/* Payment Method Segmented Buttons */}
                      <div>
                        <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1.5">
                          Payment Method
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {(['UPI', 'Cash', 'Card', 'Bank Transfer', 'Other'] as const).map((m) => (
                            <button
                              key={m}
                              type="button"
                              onClick={() => setPaymentMethod(m)}
                              className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all truncate ${
                                paymentMethod === m
                                  ? 'bg-orange-50 border-[#F04400] text-[#EA580C] shadow-xs'
                                  : 'bg-white border-stone-200 text-stone-600 hover:border-stone-300'
                              }`}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Payment Date & Notes */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div>
                          <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                            Payment Date
                          </label>
                          <input
                            type="date"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:outline-hidden"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider mb-1">
                            Notes / Reference
                          </label>
                          <input
                            type="text"
                            value={paymentNotes}
                            onChange={(e) => setPaymentNotes(e.target.value)}
                            placeholder="e.g. Google Pay UTR #..."
                            className="w-full px-3 py-2 text-xs bg-white rounded-xl border border-stone-200 focus:border-[#F04400] focus:outline-hidden"
                          />
                        </div>
                      </div>
                    </div>

                    {/* Right: Modern Financial Calculation Card */}
                    <div className="md:col-span-5 flex flex-col justify-between p-5 bg-stone-50 rounded-2xl border border-stone-200">
                      <div>
                        <div className="flex items-center justify-between pb-3 border-b border-stone-200">
                          <span className="text-xs font-bold text-stone-500 uppercase tracking-wider">
                            Financial Summary
                          </span>
                          <span className="text-[11px] font-bold text-[#EA580C] bg-orange-100 px-2 py-0.5 rounded">
                            {selectedPlan?.name}
                          </span>
                        </div>

                        <div className="space-y-2.5 py-4 text-xs">
                          <div className="flex justify-between text-stone-600">
                            <span>Package Base Price:</span>
                            <span className="font-semibold text-stone-900">
                              ₹{packagePrice.toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div className="flex justify-between text-stone-600">
                            <span>Financial Discount:</span>
                            <span className="font-semibold text-emerald-600">
                              -₹{discountNum.toLocaleString('en-IN')}
                            </span>
                          </div>

                          {prevCreditNum !== 0 && (
                            <div className="flex justify-between text-stone-600">
                              <span>Previous Adjustment:</span>
                              <span className="font-semibold text-stone-900">
                                {prevCreditNum > 0 ? `+₹${prevCreditNum}` : `-₹${Math.abs(prevCreditNum)}`}
                              </span>
                            </div>
                          )}

                          <div className="pt-2 border-t border-dashed border-stone-200 flex justify-between text-sm font-bold text-stone-900">
                            <span>Net Payable:</span>
                            <span className="text-base text-[#EA580C]">
                              ₹{netPayable.toLocaleString('en-IN')}
                            </span>
                          </div>

                          <div className="flex justify-between text-xs text-stone-600">
                            <span>Amount Paid ({paymentMethod}):</span>
                            <span className="font-bold text-stone-900">
                              ₹{amountPaidNum.toLocaleString('en-IN')}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Remaining Balance Pill */}
                      <div className={`p-3.5 rounded-xl border flex items-center justify-between ${
                        remainingBalance === 0
                          ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                          : 'bg-amber-50 border-amber-200 text-amber-800'
                      }`}>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider block">
                            Remaining Balance
                          </span>
                          <span className="text-base font-black">
                            ₹{remainingBalance.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${
                          remainingBalance === 0 ? 'bg-emerald-200 text-emerald-900' : 'bg-amber-200 text-amber-900'
                        }`}>
                          {remainingBalance === 0 ? 'PAID IN FULL ✓' : 'PARTIAL DUE'}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─────────────────────────────────────────────────────────────
                  STEP 06: OFFICIAL INVOICE & RECEIPT
                 ───────────────────────────────────────────────────────────── */}
              {step === 6 && (
                <motion.div
                  key="step-6"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  className="space-y-6 text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-sm">
                    <Check className="w-7 h-7 stroke-[3]" />
                  </div>

                  <div>
                    <h3 className="text-xl font-black text-stone-900 tracking-tight">
                      Member Onboarded Successfully!
                    </h3>
                    <p className="text-xs text-stone-500 mt-1">
                      Account activated, biometric ID assigned, and official invoice generated.
                    </p>
                  </div>

                  {/* Actions Strip */}
                  <div className="flex flex-wrap items-center justify-center gap-2.5 pt-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="py-2 px-4 bg-stone-900 hover:bg-black text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-xs"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Print Official Receipt</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        const cleanPhone = mobile.replace(/\D/g, '').slice(-10);
                        const msg = `Hello ${fullName}! Welcome to The Warrior Gym. Your membership for ${selectedPlan?.name} has been activated. Invoice #${createdInvoice?.invoiceNumber || 'INV-001'} is generated.`;
                        window.open(`https://wa.me/91${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
                      }}
                      className="py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all shadow-xs"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                      <span>Share on WhatsApp</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        if (createdMember?.id) {
                          router.push(`/dashboard/members/${createdMember.id}`);
                        }
                      }}
                      className="py-2 px-4 bg-orange-50 hover:bg-orange-100 text-[#EA580C] text-xs font-bold rounded-xl border border-orange-200 flex items-center gap-2 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Member Profile</span>
                    </button>

                    <button
                      type="button"
                      onClick={resetForm}
                      className="py-2 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl flex items-center gap-2 transition-all"
                    >
                      <span>+ Onboard Another</span>
                    </button>
                  </div>

                  {/* Rendered Official Invoice Component */}
                  <div className="mt-4 border border-stone-200 rounded-2xl overflow-hidden shadow-sm text-left">
                    <OfficialInvoiceReceipt
                      invoice={createdInvoice}
                      member={createdMember}
                      onPrint={() => window.print()}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* ══════════════════════════════════════════════════════════════════
              4. STICKY FOOTER ACTION BAR
             ══════════════════════════════════════════════════════════════════ */}
          {step < 6 && (
            <div className="px-6 py-4 bg-white border-t border-stone-200 flex items-center justify-between shrink-0">
              <button
                type="button"
                disabled={step === 1 || isSubmitting}
                onClick={handlePrevStep}
                className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
                  step === 1
                    ? 'opacity-0 pointer-events-none'
                    : 'bg-stone-100 hover:bg-stone-200 text-stone-700'
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <div className="flex items-center gap-3">
                <span className="text-[11px] text-stone-400 font-medium hidden sm:inline">
                  Step {step} of 6
                </span>

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleNextStep}
                  className="py-2.5 px-6 bg-gradient-to-r from-[#FF7A00] to-[#F04400] hover:brightness-105 active:scale-98 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-md shadow-orange-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Issuing Membership...</span>
                    </>
                  ) : step === 5 ? (
                    <>
                      <span>Create Member & Issue Invoice</span>
                      <Zap className="w-3.5 h-3.5 fill-white" />
                    </>
                  ) : (
                    <>
                      <span>Next Step</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          LIVE WEBCAM CAPTURE MODAL
         ══════════════════════════════════════════════════════════════════ */}
      {isCameraOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
          <div className="bg-slate-900 text-white rounded-3xl p-6 max-w-md w-full space-y-4 text-center border border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <h3 className="text-sm font-black flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#FF7A00]" /> Take Member Photo
              </h3>
              <button
                type="button"
                onClick={stopCameraCapture}
                className="text-slate-400 hover:text-white p-1"
              >
                ✕
              </button>
            </div>

            {cameraError ? (
              <div className="p-4 bg-red-950/50 border border-red-800 text-red-300 text-xs rounded-2xl">
                {cameraError}
              </div>
            ) : (
              <div className="relative w-64 h-64 mx-auto rounded-full overflow-hidden border-4 border-[#F04400] shadow-2xl bg-black">
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
                onClick={switchCamera}
                className="px-3.5 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5"
              >
                <SwitchCamera className="w-3.5 h-3.5" />
                <span>Flip</span>
              </button>

              <button
                type="button"
                onClick={takeSnapshot}
                disabled={Boolean(cameraError)}
                className="px-6 py-2.5 bg-[#F04400] hover:bg-orange-500 text-white text-xs font-black rounded-xl flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                <Camera className="w-4 h-4" />
                <span>Capture Snapshot</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          DISCARD CONFIRMATION MODAL
         ══════════════════════════════════════════════════════════════════ */}
      {showDiscardConfirm && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 text-center shadow-2xl border border-stone-200">
            <AlertCircle className="w-9 h-9 text-amber-500 mx-auto" />
            <h3 className="text-base font-black text-stone-900">Discard Member Registration?</h3>
            <p className="text-xs text-stone-500 font-medium">
              You have entered member details. Are you sure you want to discard this onboarding?
            </p>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowDiscardConfirm(false)}
                className="flex-1 py-2.5 bg-stone-100 text-stone-700 rounded-xl text-xs font-bold hover:bg-stone-200"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDiscardConfirm(false);
                  onClose();
                }}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl text-xs font-bold hover:bg-red-700"
              >
                Discard & Exit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
