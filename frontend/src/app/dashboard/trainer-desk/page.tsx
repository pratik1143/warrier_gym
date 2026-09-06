'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Dumbbell, Apple, Send, User, Calendar, MessageSquare, LineChart, 
  Sparkles, CheckCircle2, AlertTriangle, Users, Clock, CreditCard, 
  TrendingUp, Award, ClipboardList, BookOpen, ChevronRight, X, DollarSign,
  Fingerprint, CheckCheck, XCircle, Scan, Wifi, Shield, Plus
} from 'lucide-react';
import { useGymStore, useTrainerStore, useChatStore, useAuthStore, useProgressStore } from '@/store';
import { getInitials, formatDate, formatCurrency } from '@/lib/utils';
import toast from '@/lib/toast';
import API from '@/services/api';
import { collection, doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db as fDb, isFirebaseReady } from '@/lib/firebase';

interface Trainer {
  id: string;
  name: string;
  specialization: string;
  experience: number;
  rating: number;
  status: string;
  salary: number;
  phone: string;
  email?: string;
  biometricId?: number;
}

export default function TrainerDeskPage() {
  const { user } = useAuthStore();
  const { members, fetchMembers } = useGymStore();
  const { 
    workoutPlan, dietPlan, fetchWorkout, saveWorkout, fetchDiet, saveDiet,
    generateAIDiet, approveDiet, duplicateDiet, archiveDiet,
    cheatMeals, fetchCheatMeals, handleCheatMeal
  } = useTrainerStore();
  const { messages, fetchChatHistory, sendMsg } = useChatStore();
  const { progressTimeline, fetchTimeline } = useProgressStore();

  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>('t1');
  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'workout' | 'diet' | 'chat'>('overview');
  const [followups, setFollowups] = useState<any[]>([]);

  // Add Trainer Modals & Forms state
  const [showAddTrainerModal, setShowAddTrainerModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formSpecialization, setFormSpecialization] = useState('Weight Loss Specialist');
  const [formExperience, setFormExperience] = useState(5);
  const [formSalary, setFormSalary] = useState(40000);
  const [formStatus, setFormStatus] = useState<'active' | 'inactive'>('active');
  const [formCertifications, setFormCertifications] = useState('');
  const [formPhoto, setFormPhoto] = useState('');
  const [formBio, setFormBio] = useState('');
  const [formJoiningDate, setFormJoiningDate] = useState(new Date().toISOString().split('T')[0]);
  const [formInstagram, setFormInstagram] = useState('');
  const [formAchievements, setFormAchievements] = useState('');
  const [formBiometricId, setFormBiometricId] = useState('');
  const [enrollFingerprintAfterSave, setEnrollFingerprintAfterSave] = useState(true);

  // Biometric Enrollment State
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollAction, setEnrollAction] = useState<'fingerprint' | 'face' | 'sync' | 'delete' | null>(null);
  const [enrollDocId, setEnrollDocId] = useState<string | null>(null);
  const [enrollStatus, setEnrollStatus] = useState<{
    status: 'idle' | 'connecting' | 'scanning' | 'processing' | 'ready' | 'success' | 'failed' | 'info';
    message: string;
    scan: number;
    totalScans: number;
    biometricId?: number;
  }>({ status: 'idle', message: 'Waiting to start...', scan: 0, totalScans: 3 });

  const enrollUnsubRef = useRef<(() => void) | null>(null);

  // Workout Builder local states
  const [workoutName, setWorkoutName] = useState('Daily Conditioning');
  const [workoutType, setWorkoutType] = useState('Strength');
  const [workoutDuration, setWorkoutDuration] = useState('45 mins');
  const [exercises, setExercises] = useState<any[]>([]);
  const [newExName, setNewExName] = useState('');
  const [newExSets, setNewExSets] = useState(4);
  const [newExReps, setNewExReps] = useState('12');
  const [newExWeight, setNewExWeight] = useState('12kg');
  const [newExRest, setNewExRest] = useState('45s');

  // Diet Builder local states
  const [dietName, setDietName] = useState('Fat Loss Diet Plan');
  const [calories, setCalories] = useState(2000);
  const [protein, setProtein] = useState(140);
  const [carbs, setCarbs] = useState(180);
  const [fats, setFats] = useState(60);
  const [waterGoal, setWaterGoal] = useState(3.0);
  const [breakfast, setBreakfast] = useState('');
  const [lunch, setLunch] = useState('');
  const [dinner, setDinner] = useState('');
  const [snacks, setSnacks] = useState('');

  // AI & Chat states
  const [generatingAI, setGeneratingAI] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [loadingTrainers, setLoadingTrainers] = useState(true);

  const loadTrainersList = async () => {
    try {
      setLoadingTrainers(true);
      const res = await API.get('/trainers');
      setTrainers(res.data);
      return res.data;
    } catch (err) {
      console.error('Failed to load trainers:', err);
    } finally {
      setLoadingTrainers(false);
    }
  };

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000/api';
  
  const getToken = async (): Promise<string> => {
    if (typeof window === 'undefined') return '';
    try {
      const { auth } = await import('@/lib/firebase');
      if (auth.currentUser) return await auth.currentUser.getIdToken();
    } catch (e) { /* ignore */ }
    try {
      const userJson = localStorage.getItem('warrior_gym_user');
      if (userJson) { const u = JSON.parse(userJson); return u.token || ''; }
    } catch (e) { /* ignore */ }
    return '';
  };

  // Listen to enrollment doc for live progress
  useEffect(() => {
    if (!enrollDocId || !isFirebaseReady || !fDb) return;
    if (enrollUnsubRef.current) enrollUnsubRef.current();
    const enrollRef = doc(fDb, 'biometric_enrollment', enrollDocId);
    const unsub = onSnapshot(enrollRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      setEnrollStatus({
        status: data.status,
        message: data.message,
        scan: data.scan || 0,
        totalScans: data.totalScans || 3,
        biometricId: data.biometricId
      });
      
      if (data.status === 'success' && data.biometricId) {
        loadTrainersList();
      }
    }, (error) => {
      console.warn("Trainer biometric enrollment snapshot error:", error.message);
    });
    enrollUnsubRef.current = unsub;
    return () => {
      if (enrollUnsubRef.current) {
        enrollUnsubRef.current();
        enrollUnsubRef.current = null;
      }
    };
  }, [enrollDocId, isFirebaseReady]);

  // Listen to followups collection
  useEffect(() => {
    if (isFirebaseReady && fDb) {
      const q = collection(fDb, 'followups');
      const unsub = onSnapshot(q, (snap) => {
        const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        setFollowups(list);
      }, (error) => {
        console.warn("Followups list snapshot error:", error.message);
      });
      return () => unsub();
    }
  }, []);

  const daysUntilExpiry = (dateStr: string) => {
    if (!dateStr) return 0;
    const diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  const getRiskScore = (m: any) => {
    const daysLeft = daysUntilExpiry(m.expiryDate);
    const count = m.attendanceCount || 0;
    const streak = m.streak || 0;
    let score = 20;
    if (daysLeft < 0) score += 35;
    else if (daysLeft <= 7) score += 40;
    else if (daysLeft <= 15) score += 20;
    if (count <= 2) score += 35;
    else if (count <= 5) score += 15;
    if (streak === 0) score += 15;
    return Math.max(5, Math.min(95, score));
  };

  const closeEnrollModal = () => {
    setEnrollModalOpen(false);
    setEnrollAction(null);
    setEnrollDocId(null);
    if (enrollUnsubRef.current) { enrollUnsubRef.current(); enrollUnsubRef.current = null; }
  };

  const handleEnrollTrainerFingerprint = async (trainer: Trainer) => {
    if (!trainer) return;
    const biometricId = trainer.biometricId || prompt('Enter Biometric ID (device slot number, e.g. 500):', '');
    if (!biometricId) return;

    setEnrollAction('fingerprint');
    setEnrollStatus({ status: 'idle', message: 'Waiting to start...', scan: 0, totalScans: 3 });
    setEnrollDocId(null);
    setEnrollModalOpen(true);

    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/devices/biometric/enroll-fingerprint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ memberId: trainer.id, memberName: trainer.name, biometricId: Number(biometricId), fingerIndex: 0 }),
      });
      const data = await res.json();
      if (data.enrollmentDocId) {
        setEnrollDocId(data.enrollmentDocId);
        await API.put(`/trainers/${trainer.id}`, { biometricId: Number(biometricId) });
        loadTrainersList();
      } else {
        setEnrollStatus(s => ({ ...s, status: 'failed', message: data.error || 'Failed to queue enrollment' }));
      }
    } catch (e: any) {
      setEnrollStatus(s => ({ ...s, status: 'failed', message: e.message }));
    }
  };

  const handleAddTrainerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName || !formPhone) {
      toast.error('Trainer name and contact mobile are required.');
      return;
    }

    const payload = {
      name: formName,
      email: formEmail || `${formPhone}@thewarriorgym.in`,
      phone: formPhone,
      specialization: formSpecialization,
      experience: Number(formExperience) || 1,
      salary: Number(formSalary) || 30000,
      status: formStatus,
      certifications: formCertifications.split(',').map(c => c.trim()).filter(Boolean),
      photo: formPhoto || '/gym_images/Personal Training in Mohali.jpeg',
      bio: formBio,
      joiningDate: formJoiningDate,
      instagram: formInstagram,
      achievements: formAchievements,
      biometricId: formBiometricId ? Number(formBiometricId) : null
    };

    try {
      const res = await API.post('/trainers', payload);
      toast.success('New trainer successfully registered!');
      setShowAddTrainerModal(false);
      
      // Reset form
      setFormName('');
      setFormEmail('');
      setFormPhone('');
      setFormSpecialization('Weight Loss Specialist');
      setFormExperience(5);
      setFormSalary(40000);
      setFormStatus('active');
      setFormCertifications('');
      setFormPhoto('');
      setFormBio('');
      setFormJoiningDate(new Date().toISOString().split('T')[0]);
      setFormInstagram('');
      setFormAchievements('');
      setFormBiometricId('');
      setEnrollFingerprintAfterSave(true);

      const loadedList = await loadTrainersList();
      
      // Auto-select newly added trainer
      const newTrainer = res.data;
      const shouldEnroll = enrollFingerprintAfterSave;
      if (newTrainer) {
        setSelectedTrainerId(newTrainer.id);
        if (shouldEnroll) {
          setTimeout(() => {
            handleEnrollTrainerFingerprint(newTrainer);
          }, 300);
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to add trainer.');
    }
  };

  // Fetch trainers, members, and cheat meals
  useEffect(() => {
    fetchMembers();
    fetchCheatMeals();
    const initLoad = async () => {
      const list = await loadTrainersList();
      if (list && list.length > 0) {
        // Auto-select trainer matching logged-in user name
        const match = list.find((t: any) => t.name.toLowerCase() === user?.name?.toLowerCase() || t.email?.toLowerCase() === user?.email?.toLowerCase());
        if (match) {
          setSelectedTrainerId(match.id);
        } else {
          setSelectedTrainerId(list[0].id);
        }
      }
    };
    initLoad();
  }, [fetchMembers, fetchCheatMeals, user]);

  // Load client details when switched
  useEffect(() => {
    if (selectedClient) {
      fetchWorkout(selectedClient.id);
      fetchDiet(selectedClient.id);
      fetchTimeline(selectedClient.id);
      if (user) {
        fetchChatHistory(user.uid, selectedClient.id);
      }
    }
  }, [selectedClient, fetchWorkout, fetchDiet, fetchTimeline, fetchChatHistory, user]);

  // Sync workout fields
  useEffect(() => {
    if (workoutPlan) {
      setWorkoutName(workoutPlan.name);
      setWorkoutType(workoutPlan.type);
      setWorkoutDuration(workoutPlan.duration);
      setExercises(workoutPlan.exercises || []);
    } else {
      setExercises([]);
    }
  }, [workoutPlan]);

  // Sync diet fields
  useEffect(() => {
    if (dietPlan) {
      setDietName(dietPlan.name);
      setCalories(dietPlan.calories);
      setProtein(dietPlan.protein);
      setCarbs(dietPlan.carbs);
      setFats(dietPlan.fats);
      setWaterGoal(dietPlan.waterGoal);
      
      if (Array.isArray(dietPlan.meals)) {
        setBreakfast(dietPlan.meals.find((m: any) => m.name.toLowerCase() === 'breakfast')?.foods || '');
        setLunch(dietPlan.meals.find((m: any) => m.name.toLowerCase() === 'lunch')?.foods || '');
        setDinner(dietPlan.meals.find((m: any) => m.name.toLowerCase() === 'dinner')?.foods || '');
        setSnacks(dietPlan.meals.find((m: any) => m.name.toLowerCase() === 'snack')?.foods || '');
      } else {
        setBreakfast(dietPlan.breakfast || '');
        setLunch(dietPlan.lunch || '');
        setDinner(dietPlan.dinner || '');
        setSnacks(dietPlan.snacks || '');
      }
    } else {
      setBreakfast('');
      setLunch('');
      setDinner('');
      setSnacks('');
    }
  }, [dietPlan]);

  const activeTrainer = trainers.find(t => t.id === selectedTrainerId) || trainers[0];

  // Derive metrics for the selected trainer
  const assignedClients = members.filter(m => m.trainerId === selectedTrainerId || m.trainer === activeTrainer?.name);
  const totalMembers = assignedClients.length;
  const activeMembers = assignedClients.filter(m => m.status === 'active').length;
  
  // Today's attendance (simulated based on checked-in members matching trainer)
  const todayAttendance = assignedClients.filter(m => m.attendanceCount > 0).length || Math.min(activeMembers, 2);
  
  // Expiring memberships for follow ups
  const pendingFollowups = assignedClients.filter(m => {
    const diff = (new Date(m.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    return diff <= 10;
  }).length;

  // Trainer desk evaluations
  const activeTrainerFollowups = followups.filter(f => 
    f.status === 'pending' && 
    (f.assignedTo?.toLowerCase() === activeTrainer?.name?.toLowerCase() || 
     assignedClients.some(c => c.id === f.memberId))
  );

  const highRiskClients = assignedClients.filter(m => getRiskScore(m) >= 61);
  const inactiveClients = assignedClients.filter(m => m.streak === 0 || m.attendanceCount <= 1);
  const expiringClients = assignedClients.filter(m => {
    const days = daysUntilExpiry(m.expiryDate);
    return days > 0 && days <= 15;
  });

  // Diet / Workout configurations count
  const dietPlansAssignedCount = assignedClients.filter(m => m.plan).length; // Simulated
  const workoutPlansAssignedCount = assignedClients.filter(m => m.streak > 2).length; // Simulated
  
  // Financial metrics
  const revenueContribution = assignedClients.reduce((acc, m) => {
    const planPrices: Record<string, number> = { Monthly: 2500, Quarterly: 6500, 'Semi-Annual': 11500, 'Annual Premium': 18000 };
    return acc + (planPrices[m.plan] || 2500);
  }, 0);
  
  const renewalRate = totalMembers > 0 ? 92 : 0; // Default premium renewal rate

  // Add exercise to builder
  const handleAddExercise = () => {
    if (!newExName) return;
    setExercises([...exercises, {
      name: newExName,
      sets: Number(newExSets) || 4,
      reps: newExReps,
      weight: newExWeight,
      rest: newExRest
    }]);
    setNewExName('');
  };

  const handleSaveWorkoutPlan = async () => {
    if (!selectedClient) return;
    try {
      await saveWorkout({
        memberId: selectedClient.id,
        name: workoutName,
        type: workoutType,
        duration: workoutDuration,
        exercises
      });
      toast.success('Workout program successfully saved and synced!');
    } catch (err) {
      toast.error('Failed to save workout program.');
    }
  };

  const handleSaveDietPlan = async () => {
    if (!selectedClient) return;
    const meals = [
      { name: 'Breakfast', foods: breakfast, time: '08:00 AM' },
      { name: 'Lunch', foods: lunch, time: '01:30 PM' },
      { name: 'Snack', foods: snacks, time: '05:30 PM' },
      { name: 'Dinner', foods: dinner, time: '08:30 PM' }
    ];
    try {
      await saveDiet({
        memberId: selectedClient.id,
        name: dietName,
        calories,
        protein,
        carbs,
        fats,
        waterGoal,
        meals,
        status: 'draft'
      });
      toast.success('Diet plan successfully saved!');
    } catch (err) {
      toast.error('Failed to save diet plan.');
    }
  };

  const handleGenerateAIDietPlan = async () => {
    if (!selectedClient) return;
    setGeneratingAI(true);
    try {
      await generateAIDiet(selectedClient.id);
      toast.success('AI Engine generated customized macros & meal splits successfully!');
    } catch (err) {
      toast.error('AI generation failed.');
    } finally {
      setGeneratingAI(false);
    }
  };

  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !selectedClient || !user) return;
    try {
      await sendMsg({
        from: user.uid,
        to: selectedClient.id,
        text: chatInput.trim()
      });
      setChatInput('');
      fetchChatHistory(user.uid, selectedClient.id);
    } catch (err) {
      toast.error('Failed to deliver message.');
    }
  };

  return (
    <div className="space-y-6 text-slate-800 text-left">
      
      {/* Top Section / Title bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black tracking-wider uppercase font-display text-slate-900">Trainer Command Desk</h1>
          <p className="text-xs text-slate-500 font-medium">Analytics dashboard and program builders for professional coaches.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Add New Trainer Button */}
          <button
            onClick={() => {
              setFormName('');
              setFormEmail('');
              setFormPhone('');
              setFormSpecialization('Weight Loss Specialist');
              setFormExperience(5);
              setFormSalary(40000);
              setFormStatus('active');
              setFormCertifications('');
              setFormPhoto('');
              setFormBio('');
              setFormJoiningDate(new Date().toISOString().split('T')[0]);
              setFormInstagram('');
              setFormAchievements('');
              setShowAddTrainerModal(true);
            }}
            className="px-4 py-2.5 rounded-2xl bg-black text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 shadow-md hover:scale-105 active:scale-95 transition-all cursor-pointer border-none"
          >
            <Plus size={14} /> Add Trainer
          </button>

          {/* Dropdown for Admins to view different Trainer Desks */}
          {trainers.length >= 1 && (
            <div className="flex items-center gap-2 bg-white border border-slate-100 p-2 rounded-2xl shadow-sm">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest pl-2">Viewing Coach:</span>
              <select
                value={selectedTrainerId}
                onChange={e => {
                  setSelectedTrainerId(e.target.value);
                  setSelectedClient(null);
                  setActiveTab('overview');
                }}
                className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 focus:outline-none focus:border-black cursor-pointer text-slate-800"
              >
                {trainers.map(t => (
                  <option key={t.id} value={t.id}>{t.name} ({t.specialization})</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {activeTrainer && (
        <div className="p-4 rounded-3xl bg-slate-900 border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-white shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-600 text-white flex items-center justify-center font-black text-sm">
              {getInitials(activeTrainer.name)}
            </div>
            <div>
              <span className="text-[9px] font-bold uppercase tracking-wider text-indigo-400">{activeTrainer.specialization}</span>
              <h3 className="text-sm font-black tracking-wide leading-tight">{activeTrainer.name}</h3>
              <p className="text-[9px] text-slate-400 font-medium mt-0.5">Rating: {activeTrainer.rating || '4.8'} ⭐ · experience: {activeTrainer.experience} years</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono font-bold bg-slate-950/60 px-4 py-2.5 rounded-2xl border border-slate-800">
            <div>
              <span className="text-[8px] text-slate-500 uppercase block tracking-wider">Base Salary</span>
              <span className="text-slate-200">{formatCurrency(activeTrainer.salary || 30000)}</span>
            </div>
            <div className="w-px h-6 bg-slate-800" />
            <div>
              <span className="text-[8px] text-slate-500 uppercase block tracking-wider">Contact Mobile</span>
              <span className="text-slate-200">{activeTrainer.phone}</span>
            </div>
            <div className="w-px h-6 bg-slate-800" />
            <button
              onClick={() => handleEnrollTrainerFingerprint(activeTrainer)}
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer border-none transition-all shadow-md active:scale-95 shrink-0"
            >
              <Fingerprint size={12} className="text-indigo-400 animate-pulse" />
              <span>Finger ({activeTrainer.biometricId ? `#${activeTrainer.biometricId}` : 'None'})</span>
            </button>
          </div>
        </div>
      )}

      {/* ─── 8 PERFORMANCE METRIC CARDS ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        
        {/* Card 1: Total Members */}
        <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-[#FFF7ED] text-[#EA580C] flex items-center justify-center shrink-0">
            <Users size={20} />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black block">Total Members</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{totalMembers}</span>
          </div>
        </div>

        {/* Card 2: Active Members */}
        <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={20} />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black block">Active Members</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{activeMembers}</span>
          </div>
        </div>

        {/* Card 3: Today's Attendance */}
        <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Clock size={20} />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black block">Today's Entry</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{todayAttendance}</span>
          </div>
        </div>

        {/* Card 4: Pending Follow Ups */}
        <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black block">Expiring Cards</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{pendingFollowups}</span>
          </div>
        </div>

        {/* Card 5: Diet Plans Assigned */}
        <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Apple size={20} />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black block">Diets Assigned</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{dietPlansAssignedCount}</span>
          </div>
        </div>

        {/* Card 6: Workout Plans Assigned */}
        <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
            <Dumbbell size={20} />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black block">Workouts Assigned</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{workoutPlansAssignedCount}</span>
          </div>
        </div>

        {/* Card 7: Revenue Contribution */}
        <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shrink-0">
            <DollarSign size={20} />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black block">Revenue Share</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{formatCurrency(revenueContribution)}</span>
          </div>
        </div>

        {/* Card 8: Renewal Rate */}
        <div className="p-4 bg-white border border-slate-100 rounded-3xl shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0">
            <TrendingUp size={20} />
          </div>
          <div>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-black block">Renewal Rate</span>
            <span className="text-lg font-black text-slate-900 mt-0.5 block">{renewalRate}%</span>
          </div>
        </div>

      </div>

      {/* Roster & Workspace Layout */}
      {/* Roster & Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Roster & Alerts */}
        <div className="col-span-1 flex flex-col gap-6">
          {/* Assigned Clients Card */}
          <div className="bg-white border border-slate-100 rounded-[32px] p-5 shadow-sm space-y-4 h-[350px] flex flex-col">
            <div>
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-display">Assigned Clients</h3>
              <p className="text-[10px] text-slate-400 mt-0.5">Select a member to manage programs and chat.</p>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-50 pr-1">
              {assignedClients.map(c => {
                const isSelected = selectedClient?.id === c.id;
                const initials = getInitials(c.name);
                return (
                  <button
                    key={c.id}
                    onClick={() => { setSelectedClient(c); setActiveTab('workout'); }}
                    className={`w-full py-3 px-3.5 rounded-2xl text-left transition-all flex items-center justify-between border group mt-1.5 cursor-pointer ${
                      isSelected 
                        ? 'bg-slate-900 text-white border-slate-900 shadow-md' 
                        : 'bg-white text-slate-700 border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                        isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600'
                      }`}>
                        {initials}
                      </div>
                      <div className="min-w-0">
                        <h4 className={`text-xs font-black truncate leading-tight ${isSelected ? 'text-white' : 'text-slate-950'}`}>
                          {c.name}
                        </h4>
                        <p className={`text-[9px] font-mono mt-0.5 ${isSelected ? 'text-slate-400' : 'text-slate-400'}`}>
                          {c.memberId || c.id} · {c.plan?.split(' ')[0]}
                        </p>
                      </div>
                    </div>
                    <ChevronRight size={14} className={isSelected ? 'text-indigo-400' : 'text-slate-300 group-hover:text-slate-500'} />
                  </button>
                );
              })}
              
              {assignedClients.length === 0 && (
                <div className="text-center py-10 text-xs text-slate-400 italic">
                  No clients assigned to this trainer yet.
                </div>
              )}
            </div>
          </div>

          {/* Retention Alerts Card */}
          <div className="bg-white border border-slate-100 rounded-[32px] p-5 shadow-sm h-[320px] flex flex-col justify-between">
            <div className="flex justify-between items-center border-b border-slate-50 pb-2 shrink-0">
              <div className="flex items-center gap-2">
                <Shield size={16} className="text-indigo-600 animate-pulse" />
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider font-display">Retention Alerts</h3>
              </div>
              <span className="text-[9px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-black">
                {highRiskClients.length + inactiveClients.length + expiringClients.length + activeTrainerFollowups.length} Alerts
              </span>
            </div>

            <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1">
              {/* 1. High Risk Members */}
              {highRiskClients.map(c => (
                <div key={`hr-${c.id}`} className="flex justify-between items-center bg-red-50/50 border border-red-100/50 p-2.5 rounded-xl">
                  <div className="min-w-0">
                    <span className="text-[7.5px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider">Critical Risk</span>
                    <div className="text-xs font-black text-slate-800 truncate mt-1">{c.name}</div>
                    <div className="text-[8.5px] text-slate-400 font-semibold">Risk Score: {getRiskScore(c)}%</div>
                  </div>
                  <button
                    onClick={() => { setSelectedClient(c); setActiveTab('chat'); }}
                    className="px-2 py-1 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-all text-[8px] font-black uppercase tracking-wider border-none cursor-pointer shrink-0"
                  >
                    Chat
                  </button>
                </div>
              ))}

              {/* 2. Inactive Members */}
              {inactiveClients.map(c => (
                <div key={`in-${c.id}`} className="flex justify-between items-center bg-amber-50/50 border border-amber-100/50 p-2.5 rounded-xl">
                  <div className="min-w-0">
                    <span className="text-[7.5px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider">Inactive</span>
                    <div className="text-xs font-black text-slate-800 truncate mt-1">{c.name}</div>
                    <div className="text-[8.5px] text-slate-400 font-semibold">No visits &gt; 7 days</div>
                  </div>
                  <button
                    onClick={() => { setSelectedClient(c); setActiveTab('workout'); }}
                    className="px-2 py-1 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition-all text-[8px] font-black uppercase tracking-wider border-none cursor-pointer shrink-0"
                  >
                    Nudge
                  </button>
                </div>
              ))}

              {/* 3. Expiring Members */}
              {expiringClients.map(c => (
                <div key={`ex-${c.id}`} className="flex justify-between items-center bg-orange-50/50 border border-orange-100/50 p-2.5 rounded-xl">
                  <div className="min-w-0">
                    <span className="text-[7.5px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider">Expiring</span>
                    <div className="text-xs font-black text-slate-800 truncate mt-1">{c.name}</div>
                    <div className="text-[8.5px] text-slate-400 font-semibold">{daysUntilExpiry(c.expiryDate)} days remaining</div>
                  </div>
                  <button
                    onClick={() => { setSelectedClient(c); setActiveTab('chat'); }}
                    className="px-2 py-1 rounded-lg bg-orange-500 text-white hover:bg-orange-600 transition-all text-[8px] font-black uppercase tracking-wider border-none cursor-pointer shrink-0"
                  >
                    Alert
                  </button>
                </div>
              ))}

              {/* 4. Active Trainer Followups */}
              {activeTrainerFollowups.map(f => (
                <div key={`f-${f.id}`} className="flex justify-between items-center bg-indigo-50/50 border border-indigo-100/50 p-2.5 rounded-xl">
                  <div className="min-w-0">
                    <span className="text-[7.5px] bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-md font-black uppercase tracking-wider">Follow Up Task</span>
                    <div className="text-xs font-black text-slate-800 truncate mt-1">{f.memberName}</div>
                    <div className="text-[8.5px] text-slate-400 font-semibold truncate max-w-[150px]">{f.notes}</div>
                  </div>
                  <button
                    onClick={async () => {
                      if (isFirebaseReady && fDb) {
                        try {
                          await setDoc(doc(fDb, 'followups', f.id), { status: 'completed' }, { merge: true });
                          toast.success('Follow-up task marked as complete!');
                        } catch (e) {
                          toast.error('Failed to update task status');
                        }
                      }
                    }}
                    className="px-2 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all text-[8px] font-black uppercase tracking-wider border-none cursor-pointer shrink-0"
                  >
                    Done
                  </button>
                </div>
              ))}

              {highRiskClients.length === 0 && inactiveClients.length === 0 && expiringClients.length === 0 && activeTrainerFollowups.length === 0 && (
                <div className="text-center py-20 text-[10px] text-slate-400 italic">No retention alerts at this time.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Workspace: Client Detail Tab Panels */}
        <div className="lg:col-span-2 bg-white border border-slate-100 rounded-[32px] p-6 shadow-sm flex flex-col justify-between min-h-[550px]">
          {selectedClient ? (
            <div className="flex-1 flex flex-col justify-between h-full space-y-4">
              
              {/* Header selection info */}
              <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-xs">
                    {getInitials(selectedClient.name)}
                  </div>
                  <div>
                    <h3 className="text-xs font-black text-slate-900 leading-tight">{selectedClient.name}</h3>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Active Workspace · Goal: {selectedClient.fitnessGoal || 'General Fitness'}</p>
                  </div>
                </div>
                
                {/* Tab Pill Toggles */}
                <div className="flex bg-slate-50 border border-slate-100 rounded-xl p-0.5">
                  {[
                    { id: 'workout', label: 'Workout Builder', icon: Dumbbell },
                    { id: 'diet', label: 'Diet Planner', icon: Apple },
                    { id: 'chat', label: 'Client Chat', icon: MessageSquare }
                  ].map(tab => {
                    const Icon = tab.icon;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer border-none outline-none ${
                          activeTab === tab.id 
                            ? 'bg-black text-white shadow-sm' 
                            : 'text-slate-400 hover:text-slate-700 bg-transparent'
                        }`}
                      >
                        <Icon size={12} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Workspace Content Panels */}
              <div className="flex-grow overflow-y-auto max-h-[360px] pr-1 py-1 text-xs">
                
                {/* TAB 1: WORKOUT BUILDER */}
                {activeTab === 'workout' && (
                  <div className="space-y-4 text-left">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[8px] text-slate-400 uppercase tracking-widest font-black mb-1">Routine Name</label>
                        <input
                          type="text"
                          value={workoutName}
                          onChange={e => setWorkoutName(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-black font-semibold"
                        />
                      </div>
                      <div>
                        <label className="block text-[8px] text-slate-400 uppercase tracking-widest font-black mb-1">Routine Target / Type</label>
                        <input
                          type="text"
                          value={workoutType}
                          onChange={e => setWorkoutType(e.target.value)}
                          className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none focus:border-black font-semibold"
                        />
                      </div>
                    </div>

                    {/* Exercises checklist table */}
                    <div className="space-y-2">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Exercises Program List</span>
                      <div className="space-y-1.5 max-h-[140px] overflow-y-auto border border-slate-100 rounded-2xl p-2 bg-slate-50/50">
                        {exercises.map((ex, idx) => (
                          <div key={idx} className="flex justify-between items-center bg-white border border-slate-100 p-2 rounded-xl">
                            <div>
                              <div className="font-bold text-slate-800 text-[11px]">{ex.name}</div>
                              <div className="text-[9px] text-slate-400 font-semibold">{ex.sets} sets · {ex.reps} reps · {ex.weight || 'Bodyweight'} · Rest: {ex.rest}</div>
                            </div>
                            <button
                              onClick={() => setExercises(exercises.filter((_, i) => i !== idx))}
                              className="text-red-500 hover:text-red-700 bg-transparent border-none cursor-pointer p-1"
                            >
                              ✕
                            </button>
                          </div>
                        ))}
                        {exercises.length === 0 && (
                          <div className="text-center py-6 text-slate-400 italic">No exercises added. Construct program below:</div>
                        )}
                      </div>
                    </div>

                    {/* Add exercise subform */}
                    <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="text"
                          placeholder="Exercise Name (e.g. Squats)"
                          value={newExName}
                          onChange={e => setNewExName(e.target.value)}
                          className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
                        />
                        <div className="grid grid-cols-2 gap-1.5">
                          <input
                            type="number"
                            placeholder="Sets"
                            value={newExSets}
                            onChange={e => setNewExSets(Number(e.target.value))}
                            className="text-xs bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-center focus:outline-none"
                          />
                          <input
                            type="text"
                            placeholder="Reps"
                            value={newExReps}
                            onChange={e => setNewExReps(e.target.value)}
                            className="text-xs bg-white border border-slate-200 rounded-xl px-2 py-1.5 text-center focus:outline-none"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <input
                          type="text"
                          placeholder="Weight (e.g. 60kg)"
                          value={newExWeight}
                          onChange={e => setNewExWeight(e.target.value)}
                          className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
                        />
                        <input
                          type="text"
                          placeholder="Rest (e.g. 60s)"
                          value={newExRest}
                          onChange={e => setNewExRest(e.target.value)}
                          className="text-xs bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddExercise}
                          className="bg-black hover:bg-black/90 text-white rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer border-none"
                        >
                          + Append
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={handleSaveWorkoutPlan}
                      className="w-full py-2.5 bg-black hover:bg-black/90 text-white font-black uppercase tracking-wider rounded-xl transition-all border-none cursor-pointer text-center"
                    >
                      Save Workout Program
                    </button>
                  </div>
                )}

                {/* TAB 2: DIET PLANNER WITH ANALYTICS */}
                {activeTab === 'diet' && (() => {
                  const weightProgressStr = (() => {
                    if (progressTimeline && progressTimeline.length >= 2) {
                      const sortedTimeline = [...progressTimeline].sort((a,b) => new Date(a.createdAt || '').getTime() - new Date(b.createdAt || '').getTime());
                      const first = sortedTimeline[0].weight;
                      const last = sortedTimeline[sortedTimeline.length - 1].weight;
                      const diff = last - first;
                      return diff <= 0 ? `${diff.toFixed(1)} kg` : `+${diff.toFixed(1)} kg`;
                    }
                    return "-4.2 kg"; 
                  })();

                  const clientCompliancePercent = selectedClient ? Math.min(95, Math.round((selectedClient.streak || 5) * 5 + 50)) : 81;
                  const successRatePercent = selectedClient ? Math.min(98, Math.round((selectedClient.streak || 5) * 6 + 45)) : 78;
                  const aiSuggestionText = (() => {
                    if (clientCompliancePercent > 80) {
                      return "Excellent adherence! Progress is consistent. Duplicate this template for other fat-loss athletes.";
                    } else if (clientCompliancePercent > 65) {
                      return "Steady performance. Advise client to improve water hydration checklist completion rate.";
                    } else {
                      return "Warning: low meal log activity. Nudge client via re-engagement WhatsApp campaign.";
                    }
                  })();

                  return (
                    <div className="space-y-4 text-left animate-fade-in">
                      {/* Compliance & Progress Dashboard Panel */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-100 p-4 rounded-3xl mb-2">
                        <div className="bg-white border border-slate-100 p-3 rounded-2xl flex flex-col justify-between">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Diet Success Rate</span>
                          <div className="flex items-baseline gap-1.5 mt-2">
                            <span className="text-xl font-black text-slate-900">{successRatePercent}%</span>
                            <span className="text-[9px] text-emerald-500 font-bold">Good</span>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-100 p-3 rounded-2xl flex flex-col justify-between">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Compliance %</span>
                          <div className="flex items-baseline gap-1.5 mt-2">
                            <span className="text-xl font-black text-slate-900">{clientCompliancePercent}%</span>
                            <span className="text-[9px] text-[#0052FF] font-bold">Weekly</span>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-100 p-3 rounded-2xl flex flex-col justify-between">
                          <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest block">Weight Change</span>
                          <div className="flex items-baseline gap-1.5 mt-2">
                            <span className="text-xl font-black text-rose-500">{weightProgressStr}</span>
                            <span className="text-[9px] text-slate-400 font-bold">Total</span>
                          </div>
                        </div>

                        <div className="bg-white border border-slate-100 p-3 rounded-2xl flex flex-col justify-between">
                          <span className="text-[8px] font-bold text-indigo-500 uppercase tracking-widest block flex items-center gap-1 font-mono">
                            <Sparkles size={9} className="fill-current" />
                            AI Suggestion
                          </span>
                          <p className="text-[9.5px] text-slate-600 leading-snug mt-1.5 font-medium">{aiSuggestionText}</p>
                        </div>
                      </div>

                      <div className="flex gap-2 justify-end mb-2">
                        <button
                          onClick={handleGenerateAIDietPlan}
                          disabled={generatingAI}
                          className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase tracking-wider rounded-xl flex items-center justify-center gap-1.5 cursor-pointer border-none shadow-sm"
                        >
                          <Sparkles size={12} />
                          <span>{generatingAI ? 'AI Running...' : 'Generate AI Diet Plan'}</span>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-center font-bold">
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                          <label className="block text-[8px] text-slate-400 uppercase tracking-widest block mb-0.5">Calories (kcal)</label>
                          <input
                            type="number"
                            value={calories}
                            onChange={e => setCalories(Number(e.target.value))}
                            className="w-full text-center text-xs bg-white border border-slate-200 rounded-lg p-1 focus:outline-none"
                          />
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                          <label className="block text-[8px] text-slate-400 uppercase tracking-widest block mb-0.5">Protein (g)</label>
                          <input
                            type="number"
                            value={protein}
                            onChange={e => setProtein(Number(e.target.value))}
                            className="w-full text-center text-xs bg-white border border-slate-200 rounded-lg p-1 focus:outline-none"
                          />
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                          <label className="block text-[8px] text-slate-400 uppercase tracking-widest block mb-0.5">Carbs (g)</label>
                          <input
                            type="number"
                            value={carbs}
                            onChange={e => setCarbs(Number(e.target.value))}
                            className="w-full text-center text-xs bg-white border border-slate-200 rounded-lg p-1 focus:outline-none"
                          />
                        </div>
                        <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-xl">
                          <label className="block text-[8px] text-slate-400 uppercase tracking-widest block mb-0.5">Fats (g)</label>
                          <input
                            type="number"
                            value={fats}
                            onChange={e => setFats(Number(e.target.value))}
                            className="w-full text-center text-xs bg-white border border-slate-200 rounded-lg p-1 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[8px] text-slate-400 uppercase tracking-widest font-black mb-1">Breakfast Meal</label>
                          <input
                            type="text"
                            placeholder="Oats, protein powder, almonds"
                            value={breakfast}
                            onChange={e => setBreakfast(e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] text-slate-400 uppercase tracking-widest font-black mb-1">Lunch Meal</label>
                          <input
                            type="text"
                            placeholder="Grilled chicken/tofu, rice, broccoli"
                            value={lunch}
                            onChange={e => setLunch(e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] text-slate-400 uppercase tracking-widest font-black mb-1">Evening Snack</label>
                          <input
                            type="text"
                            placeholder="Greek yogurt, walnuts, apple"
                            value={snacks}
                            onChange={e => setSnacks(e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[8px] text-slate-400 uppercase tracking-widest font-black mb-1">Dinner Meal</label>
                          <input
                            type="text"
                            placeholder="Fish/lentils, salad, sweet potato"
                            value={dinner}
                            onChange={e => setDinner(e.target.value)}
                            className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 focus:outline-none"
                          />
                        </div>
                      </div>

                      <button
                        onClick={handleSaveDietPlan}
                        className="w-full py-2.5 bg-black hover:bg-black/90 text-white font-black uppercase tracking-wider rounded-xl transition-all border-none cursor-pointer text-center"
                      >
                        Save Diet Planner
                      </button>
                    </div>
                  );
                })()}

                {/* TAB 3: CLIENT REALTIME CHAT */}
                {activeTab === 'chat' && (
                  <div className="flex flex-col h-[280px] justify-between space-y-3">
                    <div className="flex-grow overflow-y-auto space-y-2 p-2 bg-slate-50 border border-slate-100 rounded-2xl pr-1 text-[11px] text-left">
                      {messages.map((m, idx) => {
                        const isTrainerMsg = m.from === user?.uid;
                        return (
                          <div key={idx} className={`flex ${isTrainerMsg ? 'justify-end' : 'justify-start'}`}>
                            <div className={`p-2.5 max-w-[80%] rounded-2xl leading-relaxed ${
                              isTrainerMsg 
                                ? 'bg-indigo-600 text-white rounded-tr-none' 
                                : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none shadow-sm'
                            }`}>
                              {m.text}
                            </div>
                          </div>
                        );
                      })}
                      {messages.length === 0 && (
                        <div className="text-center py-20 text-slate-400 italic">No messages found. Start the conversation below:</div>
                      )}
                    </div>

                    <form onSubmit={handleSendChatMessage} className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Type message to client..."
                        value={chatInput}
                        onChange={e => setChatInput(e.target.value)}
                        className="w-full text-xs bg-slate-50 border border-slate-200 focus:border-black rounded-xl px-3 py-2 outline-none font-semibold text-slate-800"
                      />
                      <button
                        type="submit"
                        className="px-4 bg-black hover:bg-black/90 text-white font-black rounded-xl cursor-pointer border-none flex items-center justify-center"
                      >
                        <Send size={14} />
                      </button>
                    </form>
                  </div>
                )}

              </div>

              {/* Bottom detail row */}
              <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider pt-3 border-t border-slate-100">
                <span>Trainer: {activeTrainer?.name}</span>
                <span>Active Plan: {selectedClient.plan}</span>
              </div>

            </div>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center text-center space-y-3.5 py-12">
              <ClipboardList size={40} className="text-slate-300 stroke-1" />
              <div className="space-y-1">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">No client workspace selected</h4>
                <p className="text-[10px] text-slate-400 max-w-[240px] leading-relaxed">
                  Select a registered client from the left roster to view performance metrics, assign diet/workouts, and check messages.
                </p>
              </div>
            </div>
          )}
      </div>

      {/* ─── ADD TRAINER MODAL ─── */}
      <AnimatePresence>
        {showAddTrainerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-xl bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto text-left"
            >
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider font-display">Add Professional Trainer</h3>
                <button onClick={() => setShowAddTrainerModal(false)} className="text-slate-400 hover:text-slate-600 text-sm cursor-pointer bg-transparent border-none">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddTrainerSubmit} className="space-y-4 text-xs font-semibold">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Trainer Photo URL</label>
                    <input
                      type="text"
                      placeholder="https://example.com/photo.jpg"
                      value={formPhoto}
                      onChange={e => setFormPhoto(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Full Name *</label>
                    <input
                      type="text"
                      placeholder="e.g. Rohit Sharma"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-black"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Mobile Number *</label>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210"
                      value={formPhone}
                      onChange={e => setFormPhone(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-black"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Email Address</label>
                    <input
                      type="email"
                      placeholder="e.g. rohit@thewarriorgym.in"
                      value={formEmail}
                      onChange={e => setFormEmail(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Specialization *</label>
                    <select
                      value={formSpecialization}
                      onChange={e => setFormSpecialization(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-black"
                    >
                      <option value="Weight Loss Specialist">Weight Loss Specialist</option>
                      <option value="Strength & Conditioning">Strength & Conditioning</option>
                      <option value="CrossFit & HIIT">CrossFit & HIIT</option>
                      <option value="Yoga & Flexibility">Yoga & Flexibility</option>
                      <option value="Bodybuilding">Bodybuilding</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Experience (Years) *</label>
                    <input
                      type="number"
                      value={formExperience}
                      onChange={e => setFormExperience(Number(e.target.value))}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-black"
                      min={0}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Monthly Salary (INR)</label>
                    <input
                      type="number"
                      value={formSalary}
                      onChange={e => setFormSalary(Number(e.target.value))}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-black"
                      min={0}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Instagram Handler</label>
                    <input
                      type="text"
                      placeholder="rohit_sharma_coach"
                      value={formInstagram}
                      onChange={e => setFormInstagram(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Joining Date</label>
                    <input
                      type="date"
                      value={formJoiningDate}
                      onChange={e => setFormJoiningDate(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-black"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Staff Status</label>
                    <select
                      value={formStatus}
                      onChange={e => setFormStatus(e.target.value as any)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-black"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Certifications (Comma Separated)</label>
                  <input
                    type="text"
                    placeholder="e.g. ACE, CSCS, CPR"
                    value={formCertifications}
                    onChange={e => setFormCertifications(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Trainer Achievements</label>
                  <input
                    type="text"
                    placeholder="e.g. Trained 100+ clients for fat loss success"
                    value={formAchievements}
                    onChange={e => setFormAchievements(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-black"
                  />
                </div>

                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Biography Profile</label>
                  <textarea
                    rows={2}
                    placeholder="Provide a short bio description..."
                    value={formBio}
                    onChange={e => setFormBio(e.target.value)}
                    className="w-full p-2.5 border border-slate-200 rounded-xl resize-none focus:outline-none focus:border-black"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-100 pt-3">
                  <div>
                    <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1 font-bold">Biometric Slot ID (Optional)</label>
                    <input
                      type="number"
                      placeholder="e.g. 500"
                      value={formBiometricId}
                      onChange={e => setFormBiometricId(e.target.value)}
                      className="w-full p-2.5 border border-slate-200 rounded-xl focus:outline-none focus:border-black"
                    />
                  </div>
                  <div className="flex items-center gap-2 pt-5">
                    <input
                      type="checkbox"
                      id="enrollFingerprintAfterSaveDesk"
                      checked={enrollFingerprintAfterSave}
                      onChange={e => setEnrollFingerprintAfterSave(e.target.checked)}
                      className="w-4 h-4 rounded text-black border-slate-300 focus:ring-black cursor-pointer"
                    />
                    <label htmlFor="enrollFingerprintAfterSaveDesk" className="text-xs text-slate-700 font-bold select-none cursor-pointer flex items-center gap-1.5">
                      <Fingerprint size={14} className="text-slate-600" />
                      Enroll Fingerprint Now
                    </label>
                  </div>
                </div>

                <div className="flex gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAddTrainerModal(false)}
                    className="flex-1 py-3 border border-slate-200 rounded-xl text-slate-700 hover:bg-slate-50 transition-colors uppercase tracking-wider text-[10px] font-black cursor-pointer bg-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-3 bg-black hover:bg-black/90 text-white rounded-xl transition-all uppercase tracking-wider text-[10px] font-black cursor-pointer border-none"
                  >
                    Save Trainer
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ═══ Biometric Enrollment Modal ═══════════════════════════════════════ */}
      <AnimatePresence>
        {enrollModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={enrollStatus.status === 'success' || enrollStatus.status === 'failed' || enrollStatus.status === 'info' ? closeEnrollModal : undefined} />

            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: 'spring', damping: 22, stiffness: 200 }}
              className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 rounded-[32px] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.6)] z-10 overflow-hidden text-left"
            >
              {/* Glow BG */}
              <div className={`absolute inset-0 opacity-20 pointer-events-none transition-all duration-700 ${
                enrollStatus.status === 'success' ? 'bg-emerald-500' :
                enrollStatus.status === 'failed' ? 'bg-red-500' :
                enrollStatus.status === 'scanning' ? 'bg-[#F97316]' : 'bg-amber-500'
              } blur-3xl`} />

              {/* Close Button */}
              {(enrollStatus.status === 'success' || enrollStatus.status === 'failed' || enrollStatus.status === 'info') && (
                <button onClick={closeEnrollModal} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer border-none">
                  <X size={14} />
                </button>
              )}

              {/* Header */}
              <div className="text-center mb-8 relative">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                  Trainer Fingerprint Enrollment
                </div>
                <h3 className="text-xl font-black text-white">
                  {activeTrainer?.name}
                </h3>
              </div>

              {/* Animated Scan Ring + Icon */}
              <div className="flex items-center justify-center mb-8">
                <div className="relative w-32 h-32">
                  {/* Outer pulsing ring */}
                  {(enrollStatus.status === 'scanning' || enrollStatus.status === 'ready' || enrollStatus.status === 'connecting') && (
                    <>
                      <div className="absolute inset-0 rounded-full border-2 border-blue-500/30 animate-ping" />
                      <div className="absolute inset-2 rounded-full border border-blue-500/20 animate-pulse" />
                    </>
                  )}
                  {enrollStatus.status === 'success' && (
                    <div className="absolute inset-0 rounded-full border-2 border-emerald-500/40 animate-pulse" />
                  )}

                  {/* Progress arc SVG */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
                    <circle
                      cx="60" cy="60" r="54"
                      fill="none"
                      stroke={enrollStatus.status === 'success' ? '#10b981' : enrollStatus.status === 'failed' ? '#ef4444' : '#3b82f6'}
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 54}`}
                      strokeDashoffset={`${2 * Math.PI * 54 * (1 - (enrollStatus.scan / (enrollStatus.totalScans || 3)))}`}
                      className="transition-all duration-700"
                    />
                  </svg>

                  {/* Center Icon */}
                  <div className={`absolute inset-0 flex items-center justify-center rounded-full ${
                    enrollStatus.status === 'success' ? 'bg-emerald-500/20' :
                    enrollStatus.status === 'failed' ? 'bg-red-500/20' :
                    'bg-blue-500/10'
                  }`}>
                    {enrollStatus.status === 'success' ? (
                      <CheckCheck size={36} className="text-emerald-400" />
                    ) : enrollStatus.status === 'failed' ? (
                      <XCircle size={36} className="text-red-400" />
                    ) : enrollStatus.status === 'info' ? (
                      <AlertTriangle size={36} className="text-amber-400" />
                    ) : (
                      <Fingerprint size={36} className={`${enrollStatus.status === 'scanning' ? 'text-[#FB923C] animate-pulse' : 'text-slate-400'}`} />
                    )}
                  </div>
                </div>
              </div>

              {/* Scan Steps */}
              <div className="flex justify-center gap-3 mb-6">
                {[1, 2, 3].map((step) => (
                  <div key={step} className={`flex flex-col items-center gap-1.5 transition-all duration-500 ${enrollStatus.scan >= step ? 'opacity-100' : 'opacity-30'}`}>
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black border-2 transition-all duration-500 ${
                      enrollStatus.scan > step
                        ? 'bg-emerald-500 border-emerald-400 text-white'
                        : enrollStatus.scan === step
                        ? 'bg-blue-500/20 border-[#F97316] text-[#FB923C] animate-pulse'
                        : 'bg-white/5 border-white/10 text-slate-500'
                    }`}>
                      {enrollStatus.scan > step ? '✓' : step}
                    </div>
                    <span className={`text-[8px] font-bold uppercase tracking-wider ${enrollStatus.scan >= step ? 'text-slate-300' : 'text-slate-600'}`}>
                      Scan {step}
                    </span>
                  </div>
                ))}
              </div>

              {/* Status Message */}
              <div className={`text-center px-4 py-3 rounded-2xl mb-4 ${
                enrollStatus.status === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20' :
                enrollStatus.status === 'failed' ? 'bg-red-500/10 border border-red-500/20' :
                enrollStatus.status === 'info' ? 'bg-amber-500/10 border border-amber-500/20' :
                'bg-white/5 border border-white/10'
              }`}>
                <p className={`text-[11px] font-bold leading-relaxed ${
                  enrollStatus.status === 'success' ? 'text-emerald-400' :
                  enrollStatus.status === 'failed' ? 'text-red-400' :
                  enrollStatus.status === 'info' ? 'text-amber-400' :
                  'text-slate-300'
                }`}>
                  {enrollStatus.message || 'Initializing...'}
                </p>
              </div>

              {/* Success: Show assigned biometric ID */}
              {enrollStatus.status === 'success' && enrollStatus.biometricId && (
                <div className="text-center mb-4">
                  <div className="inline-flex items-center gap-2 bg-[#d4ff00]/10 border border-[#d4ff00]/30 px-4 py-2 rounded-full">
                    <Shield size={12} className="text-[#d4ff00]" />
                    <span className="text-[11px] font-black text-[#d4ff00] uppercase tracking-widest">
                      Biometric ID: {enrollStatus.biometricId}
                    </span>
                  </div>
                </div>
              )}

              {/* Loading bar */}
              {(enrollStatus.status === 'connecting' || enrollStatus.status === 'scanning' || enrollStatus.status === 'processing' || enrollStatus.status === 'ready') && (
                <div className="h-0.5 bg-white/10 rounded-full overflow-hidden mb-4">
                  <div className="h-full bg-[#F97316] rounded-full animate-pulse" style={{ width: `${enrollStatus.scan > 0 ? (enrollStatus.scan / enrollStatus.totalScans) * 100 : 30}%`, transition: 'width 0.7s ease' }} />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                {(enrollStatus.status === 'success' || enrollStatus.status === 'failed' || enrollStatus.status === 'info') && (
                  <button
                    onClick={closeEnrollModal}
                    className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-none"
                  >
                    Close
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      </div>

    </div>
  );
}
