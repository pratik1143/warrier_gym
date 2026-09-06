'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Apple, Sparkles, Upload, FileText, Check, Plus, Trash, Copy, 
  Archive, AlertCircle, RefreshCw, Droplet, Clock, User, Award, 
  Search, Calculator, FileCheck, ShieldAlert
} from 'lucide-react';
import { useGymStore, useTrainerStore, useAuthStore } from '@/store';
import { getInitials } from '@/lib/utils';
import toast from '@/lib/toast';
import API from '@/services/api';

export default function DietManagementPage() {
  const { user } = useAuthStore();
  const { members, fetchMembers } = useGymStore();
  const { 
    dietPlan, fetchDiet, saveDiet,
    generateAIDiet, approveDiet, duplicateDiet, archiveDiet
  } = useTrainerStore();

  const [selectedClient, setSelectedClient] = useState<any | null>(null);
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [isEditingMember, setIsEditingMember] = useState(false);
  const [editedMember, setEditedMember] = useState<any>({});

  // Diet builder targets
  const [dietName, setDietName] = useState('Standard Balanced Plan');
  const [calories, setCalories] = useState(2000);
  const [protein, setProtein] = useState(130);
  const [carbs, setCarbs] = useState(190);
  const [fats, setFats] = useState(55);
  const [waterGoal, setWaterGoal] = useState(3.0);
  const [breakfast, setBreakfast] = useState('');
  const [lunch, setLunch] = useState('');
  const [dinner, setDinner] = useState('');
  const [snacks, setSnacks] = useState('');

  // AI & Upload actions
  const [generatingAI, setGeneratingAI] = useState(false);
  const [cloningMemberId, setCloningMemberId] = useState('');
  
  // File Upload Simulation
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; status: string } | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isParsing, setIsParsing] = useState(false);
  const { updateMember } = useGymStore();

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  // Load client's diet once selected
  useEffect(() => {
    if (selectedClient) {
      fetchDiet(selectedClient.id);
    }
  }, [selectedClient, fetchDiet]);

  // Sync state to form values when dietPlan is loaded or updated
  useEffect(() => {
    if (dietPlan) {
      setDietName(dietPlan.name || 'Standard Balanced Plan');
      setCalories(dietPlan.calories || 2000);
      setProtein(dietPlan.protein || 130);
      setCarbs(dietPlan.carbs || 190);
      setFats(dietPlan.fats || 55);
      setWaterGoal(dietPlan.waterGoal || 3.0);
      
      if (Array.isArray(dietPlan.meals)) {
        const bf = dietPlan.meals.find((m: any) => m.name.toLowerCase() === 'breakfast')?.foods || '';
        const ln = dietPlan.meals.find((m: any) => m.name.toLowerCase() === 'lunch')?.foods || '';
        const dn = dietPlan.meals.find((m: any) => m.name.toLowerCase() === 'dinner')?.foods || '';
        const sn = dietPlan.meals.find((m: any) => m.name.toLowerCase().includes('snack'))?.foods || '';
        setBreakfast(bf);
        setLunch(ln);
        setDinner(dn);
        setSnacks(sn);
      } else {
        setBreakfast(dietPlan.meals?.breakfast || '');
        setLunch(dietPlan.meals?.lunch || '');
        setDinner(dietPlan.meals?.dinner || '');
        setSnacks(dietPlan.meals?.snacks || '');
      }
    } else {
      // Defaults
      setDietName('Standard Balanced Plan');
      setCalories(2000);
      setProtein(130);
      setCarbs(190);
      setFats(55);
      setWaterGoal(3.0);
      setBreakfast('');
      setLunch('');
      setDinner('');
      setSnacks('');
    }
  }, [dietPlan]);

  // Save manual diet targets
  const handleSaveDiet = async () => {
    if (!selectedClient) return;
    try {
      const targetIds = selectedClient.id === 'ALL' ? members.map(m => m.id) : [selectedClient.id];
      for (const tId of targetIds) {
        await saveDiet({
          memberId: tId,
          name: dietName,
          calories,
          protein,
          carbs,
          fats,
          waterGoal,
          meals: { breakfast, lunch, dinner, snacks },
          status: dietPlan?.status || 'draft'
        });
      }
      toast.success(selectedClient.id === 'ALL' ? `Diet plan assigned to ${targetIds.length} members!` : 'Diet plan assigned & updated successfully!');
    } catch (err) {
      toast.error('Failed to save diet plan');
    }
  };

  // Generate AI Diet Plan
  const handleGenerateAI = async () => {
    if (!selectedClient) return;
    setGeneratingAI(true);
    try {
      const targetIds = selectedClient.id === 'ALL' ? members.map(m => m.id) : [selectedClient.id];
      for (const tId of targetIds) {
         await generateAIDiet(tId);
      }
      toast.success(selectedClient.id === 'ALL' ? `AI Diet targets generated for ${targetIds.length} members!` : 'AI Diet targets generated! Status set to Draft.');
    } catch (err) {
      toast.error('Failed to generate AI diet');
    } finally {
      setGeneratingAI(false);
    }
  };

  // Approve & Push to Client App (Instant Sync via Firebase)
  const handleApprovePlan = async () => {
    if (!dietPlan || !selectedClient) return;
    try {
      await approveDiet(dietPlan.id);
      toast.success('Diet Plan Approved! Instantly synchronized with Client App 📱');
    } catch (err) {
      toast.error('Failed to approve diet plan');
    }
  };

  // Duplicate to another member
  const handleDuplicatePlan = async () => {
    if (!dietPlan || !selectedClient || !cloningMemberId) {
      toast.error('Please select a target member and verify plan exists');
      return;
    }
    try {
      await duplicateDiet(dietPlan.id, cloningMemberId);
      toast.success('Diet plan successfully copied to target member!');
      setCloningMemberId('');
    } catch (err) {
      toast.error('Failed to duplicate plan');
    }
  };

  // Archive Plan
  const handleArchivePlan = async () => {
    if (!dietPlan || !selectedClient) return;
    try {
      await archiveDiet(dietPlan.id);
      toast.success('Diet plan archived.');
    } catch (err) {
      toast.error('Failed to archive plan');
    }
  };

  // Document Uploadation & Simulation
  const triggerFileSelector = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile({
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      status: 'Uploading...'
    });

    setUploadProgress(0);

    // Simulate upload progress
    const interval = setInterval(() => {
      setUploadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          simulateOcrParsing(file.name);
          return 100;
        }
        return prev + 20;
      });
    }, 150);
  };

  const simulateOcrParsing = (fileName: string) => {
    setUploadedFile(prev => prev ? { ...prev, status: 'Parsing PDF via AI OCR...' } : null);
    setIsParsing(true);

    setTimeout(() => {
      setIsParsing(false);
      setUploadedFile(prev => prev ? { ...prev, status: 'Completed' } : null);
      
      // Auto-extract simulated details based on the name or just mock
      const isGain = fileName.toLowerCase().includes('gain') || fileName.toLowerCase().includes('bulking');
      const isLoss = fileName.toLowerCase().includes('loss') || fileName.toLowerCase().includes('shred');

      if (isGain) {
        setDietName('Bulk & Mass Plan (Uploaded File)');
        setCalories(2950);
        setProtein(165);
        setCarbs(320);
        setFats(80);
        setBreakfast('4 Whole Eggs, 100g Oats, 2 Bananas, Handful Almonds');
        setLunch('150g Grilled Chicken Breast, 150g Basmati Rice, Broccoli');
        setDinner('200g Fish or Paneer, 150g Rice, Sweet Potato, Mixed Salad');
        setSnacks('Protein Shake, Peanut Butter Sandwich, 2 Apples');
      } else if (isLoss) {
        setDietName('Extreme Shred Diet (Uploaded File)');
        setCalories(1700);
        setProtein(145);
        setCarbs(120);
        setFats(45);
        setBreakfast('6 Egg Whites, Spinach, 1 Toast, Green Tea');
        setLunch('150g Salmon or Tofu, Broccoli, 80g Brown Rice');
        setDinner('150g Chicken Breast, Mixed Green Salad, Olive Oil dressing');
        setSnacks('Whey Isolate Shake, Handful Roasted Chickpeas, Cucumber sticks');
      } else {
        setDietName('High Protein Balanced Diet (Uploaded File)');
        setCalories(2150);
        setProtein(150);
        setCarbs(200);
        setFats(60);
        setBreakfast('3 Egg Whites, 1 Whole Egg, Oats with Chia Seeds');
        setLunch('150g Grilled Chicken or Tofu, Rice, Salad');
        setDinner('Grilled Fish or Paneer, Steamed Asparagus, Sweet Potato');
        setSnacks('Greek Yogurt, Almonds, Protein Bar');
      }

      toast.success('Diet document uploaded & smart parsed via AI OCR successfully!');
    }, 1800);
  };

  // Filter roster list
  const filteredMembers = members.filter(m => 
    m.name?.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
    m.memberId?.toLowerCase().includes(memberSearchQuery.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-6 py-6 min-h-screen w-full max-w-6xl mx-auto px-4">
      
      {/* Page Header */}
      <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6 text-left">
        <div>
          <h1 className="text-xl font-black text-slate-900 tracking-wider uppercase font-display flex items-center gap-2">
            <Apple className="text-emerald-500 fill-emerald-500/10" size={24} />
            Diet Center & AI Planner
          </h1>
          <p className="text-xs text-slate-500 mt-1">Assign custom macro targets, generate diets with AI, or upload client diet sheets with smart OCR parsing.</p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 w-full items-stretch">
        
        {/* Left Column: Client Roster List */}
        <div className="w-full lg:w-[280px] bg-white rounded-3xl shadow-sm border border-slate-100 p-5 flex flex-col h-fit shrink-0">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <User size={16} className="text-slate-700" />
            <h2 className="text-xs font-black text-slate-900 uppercase tracking-wider font-display">Client Roster</h2>
          </div>

          <div className="relative my-3.5">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search member..."
              value={memberSearchQuery}
              onChange={e => setMemberSearchQuery(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white transition-all"
            />
          </div>

          <div className="mb-2">
            <button 
              onClick={() => setSelectedClient({ id: 'ALL', name: 'All Members', gender: 'Mixed', age: 'N/A', weight: '-', height: '-', foodPreference: 'Mixed', allergies: 'Various', goal: 'Various' })}
              className={`w-full py-2 px-3 rounded-xl text-left text-xs font-bold flex items-center justify-between border transition-colors ${
                selectedClient?.id === 'ALL' ? 'bg-emerald-50 text-emerald-700 border-emerald-500' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span>Assign to All Members</span>
              <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full">{members.length}</span>
            </button>
          </div>

          <div className="max-h-[350px] overflow-y-auto divide-y divide-slate-100 pr-1 text-left">
            {filteredMembers.map(m => (
              <button
                key={m.id}
                onClick={() => { setSelectedClient(m); setIsEditingMember(false); }}
                className={`w-full py-2.5 px-2 rounded-xl text-left text-xs flex items-center justify-between hover:bg-slate-50 transition-colors ${
                  selectedClient?.id === m.id ? 'bg-emerald-50 text-emerald-700 font-bold border-l-4 border-emerald-500' : 'text-slate-750'
                }`}
              >
                <div className="truncate pr-2">
                  <div className="font-semibold text-slate-800">{m.name}</div>
                  <div className="text-[9px] text-slate-400 font-mono mt-0.5">{m.memberId || m.id}</div>
                </div>
                <span className="text-[9px] font-bold bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full capitalize shrink-0">
                  {m.goal || 'Fitness'}
                </span>
              </button>
            ))}
            {filteredMembers.length === 0 && (
              <div className="text-center py-6 text-xs text-slate-400 italic">No members found</div>
            )}
          </div>
        </div>

        {/* Right Column: Work Desk */}
        <div className="flex-1 min-w-0">
          {selectedClient ? (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-6 space-y-6">
              
              {/* Member Summary Banner */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl grid grid-cols-2 md:grid-cols-6 gap-4 text-left items-center relative">
                {selectedClient.id !== 'ALL' && (
                   <button 
                     onClick={() => {
                       if (isEditingMember) {
                         // Save
                         updateMember(selectedClient.id, editedMember);
                         setSelectedClient({ ...selectedClient, ...editedMember });
                         toast.success('Member details updated!');
                       } else {
                         setEditedMember({
                           gender: selectedClient.gender,
                           age: selectedClient.age,
                           weight: selectedClient.weight,
                           height: selectedClient.height,
                           foodPreference: selectedClient.foodPreference,
                           allergies: selectedClient.allergies,
                           goal: selectedClient.goal
                         });
                       }
                       setIsEditingMember(!isEditingMember);
                     }}
                     className="absolute top-3 right-3 text-[10px] bg-white border border-slate-200 px-2 py-1 rounded shadow-sm hover:bg-slate-50 text-slate-700 font-bold z-10"
                   >
                     {isEditingMember ? 'Save Details' : 'Edit Details'}
                   </button>
                )}

                <div className="space-y-0.5">
                  <span className="text-[8px] font-bold text-slate-450 uppercase block">Member</span>
                  <span className="text-xs font-bold text-slate-800">{selectedClient.name}</span>
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8px] font-bold text-slate-450 uppercase block">Gender & Age</span>
                  {isEditingMember ? (
                    <div className="flex gap-1">
                      <input type="text" className="w-12 text-xs border rounded px-1" value={editedMember.gender || ''} onChange={e => setEditedMember({...editedMember, gender: e.target.value})} placeholder="Gender" />
                      <input type="number" className="w-10 text-xs border rounded px-1" value={editedMember.age || ''} onChange={e => setEditedMember({...editedMember, age: Number(e.target.value)})} placeholder="Age" />
                    </div>
                  ) : (
                    <span className="text-xs font-semibold text-slate-600">{selectedClient.gender || 'Male'}, {selectedClient.age || 26} yrs</span>
                  )}
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8px] font-bold text-slate-450 uppercase block">Specs</span>
                  {isEditingMember ? (
                     <div className="flex gap-1">
                       <input type="number" className="w-12 text-xs border rounded px-1" value={editedMember.weight || ''} onChange={e => setEditedMember({...editedMember, weight: Number(e.target.value)})} placeholder="Kg" />
                       <input type="number" className="w-12 text-xs border rounded px-1" value={editedMember.height || ''} onChange={e => setEditedMember({...editedMember, height: Number(e.target.value)})} placeholder="Cm" />
                     </div>
                  ) : (
                     <span className="text-xs font-semibold text-slate-600">{selectedClient.weight || 75} kg / {selectedClient.height || 175} cm</span>
                  )}
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8px] font-bold text-slate-450 uppercase block">Allergies / Preference</span>
                  {isEditingMember ? (
                    <div className="flex flex-col gap-1">
                       <input type="text" className="w-full text-xs border rounded px-1 py-0.5" value={editedMember.foodPreference || ''} onChange={e => setEditedMember({...editedMember, foodPreference: e.target.value})} placeholder="Pref" />
                       <input type="text" className="w-full text-xs border rounded px-1 py-0.5" value={editedMember.allergies || ''} onChange={e => setEditedMember({...editedMember, allergies: e.target.value})} placeholder="Allergies" />
                    </div>
                  ) : (
                     <span className="text-xs font-bold text-emerald-600">{selectedClient.foodPreference || 'Veg'} ({selectedClient.allergies || 'None'})</span>
                  )}
                </div>
                <div className="space-y-0.5">
                  <span className="text-[8px] font-bold text-slate-450 uppercase block">Main Goal</span>
                  {isEditingMember ? (
                    <input type="text" className="w-full text-xs border rounded px-1 py-0.5" value={editedMember.goal || ''} onChange={e => setEditedMember({...editedMember, goal: e.target.value})} placeholder="Goal" />
                  ) : (
                    <span className="text-xs font-black text-rose-500 uppercase">{selectedClient.goal || 'Fat Loss'}</span>
                  )}
                </div>
              </div>

              {/* ACTION LAYERS: AI GENERATOR & FILE UPLOAD */}
              <div className="grid md:grid-cols-2 gap-4">
                
                {/* AI Planner */}
                <div className="p-5 border border-emerald-100 bg-emerald-50/20 rounded-3xl flex flex-col justify-between text-left space-y-3.5">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-emerald-600 uppercase tracking-widest block font-mono flex items-center gap-1">
                      <Sparkles size={11} className="fill-current" />
                      Smart AI Engine
                    </span>
                    <h3 className="text-xs font-bold text-slate-800">Generate AI Diet Program</h3>
                    <p className="text-[10px] text-slate-500 leading-normal">AI parses calorie BMR multipliers based on target goals, allergies and activity level to build structural plans.</p>
                  </div>
                  
                  <button
                    onClick={handleGenerateAI}
                    disabled={generatingAI}
                    className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-emerald-600/10 border-none transition-all"
                  >
                    {generatingAI ? (
                      <>
                        <RefreshCw className="animate-spin text-white" size={13} />
                        AI Generating Plan...
                      </>
                    ) : (
                      <>
                        <Sparkles size={13} className="text-white fill-current" />
                        Generate AI Diet Plan
                      </>
                    )}
                  </button>
                </div>

                {/* PDF/Image Diet Upload with simulated Smart OCR parser */}
                <div className="p-5 border border-slate-200 bg-slate-50/30 rounded-3xl flex flex-col justify-between text-left space-y-3.5">
                  <div className="space-y-1">
                    <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest block font-mono flex items-center gap-1">
                      <Upload size={11} />
                      OCR PDF/Image Reader
                    </span>
                    <h3 className="text-xs font-bold text-slate-800">Upload Existing Diet Sheet</h3>
                    <p className="text-[10px] text-slate-500 leading-normal">Select a diet document to analyze. Our system will extract food items and populate macro levels instantly.</p>
                  </div>

                  <div className="space-y-2">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileUpload} 
                      accept=".pdf,.png,.jpg,.jpeg" 
                      className="hidden" 
                    />
                    
                    {uploadedFile ? (
                      <div className="p-2.5 bg-white border border-slate-200 rounded-xl space-y-1 text-xs">
                        <div className="flex items-center justify-between font-mono text-[9px] text-slate-400">
                          <span className="truncate max-w-[150px]">{uploadedFile.name}</span>
                          <span>{uploadedFile.size}</span>
                        </div>
                        {uploadedFile.status !== 'Completed' ? (
                          <div className="space-y-1">
                            <div className="flex justify-between items-center text-[9px] text-emerald-600 font-bold">
                              <span>{uploadedFile.status}</span>
                              <span>{uploadProgress}%</span>
                            </div>
                            <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500 transition-all duration-150" style={{ width: `${uploadProgress}%` }} />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-[9px] text-emerald-600 font-bold uppercase tracking-wider mt-0.5">
                            <FileCheck size={11} />
                            OCR Parsing Successful & Applied!
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={triggerFileSelector}
                        className="w-full py-2.5 rounded-xl border border-dashed border-slate-300 hover:border-slate-400 text-slate-600 hover:text-slate-800 text-xs font-bold flex items-center justify-center gap-2 cursor-pointer bg-white transition-all"
                      >
                        <Upload size={13} />
                        Select / Drop Diet File
                      </button>
                    )}
                  </div>
                </div>

              </div>

              {/* DIET targets DISPLAY */}
              {dietPlan ? (
                <div className="space-y-5 border-t border-slate-100 pt-5 text-left">
                  
                  {/* Title and statuses */}
                  <div className="flex flex-wrap justify-between items-center gap-4">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-black text-slate-800">{dietPlan.name}</h4>
                        <span className={`px-2 py-0.5 text-[8.5px] font-bold rounded-full uppercase tracking-wider ${
                          dietPlan.status === 'approved' 
                            ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' 
                            : 'bg-amber-100 text-amber-700 border border-amber-200 animate-pulse'
                        }`}>
                          {dietPlan.status}
                        </span>
                      </div>
                      <p className="text-[9px] text-slate-400">Sync status: Instantly synced with database (Realtime Firebase)</p>
                    </div>

                    <div className="flex items-center gap-2">
                      {dietPlan.status !== 'approved' && (
                        <button
                          onClick={handleApprovePlan}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold flex items-center gap-1 border-none cursor-pointer transition-all"
                        >
                          <Check size={13} /> Approve & Sync Plan
                        </button>
                      )}
                      <button
                        onClick={handleArchivePlan}
                        className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
                      >
                        <Archive size={13} /> Archive
                      </button>
                    </div>
                  </div>

                  {/* Macros grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center space-y-1">
                      <span className="text-[9px] font-bold text-slate-450 uppercase">Calories</span>
                      <div className="text-base font-black text-slate-800">{dietPlan.calories} <span className="text-[10px] text-slate-400 font-normal">kcal</span></div>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center space-y-1">
                      <span className="text-[9px] font-bold text-slate-450 uppercase">Protein</span>
                      <div className="text-base font-black text-rose-600">{dietPlan.protein}g</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center space-y-1">
                      <span className="text-[9px] font-bold text-slate-450 uppercase">Carbohydrates</span>
                      <div className="text-base font-black text-slate-800">{dietPlan.carbs}g</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center space-y-1">
                      <span className="text-[9px] font-bold text-slate-450 uppercase">Fats</span>
                      <div className="text-base font-black text-amber-600">{dietPlan.fats}g</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-3 text-center space-y-1">
                      <span className="text-[9px] font-bold text-slate-450 uppercase">Water Intake</span>
                      <div className="text-base font-black text-sky-500">{dietPlan.waterGoal}L</div>
                    </div>
                  </div>

                  {/* Timeline Meals List */}
                  {Array.isArray(dietPlan.meals) && dietPlan.meals.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Diet Timing Program</h5>
                      <div className="space-y-2">
                        {dietPlan.meals.map((meal: any, idx: number) => (
                          <div key={idx} className="p-3.5 bg-slate-50 border border-slate-100 rounded-2xl flex gap-3 items-start">
                            <div className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-[10px] font-bold text-slate-600 font-mono flex items-center gap-1.5 shrink-0">
                              <Clock size={11} className="text-sky-500" />
                              {meal.time}
                            </div>
                            <div className="space-y-1 min-w-0 flex-grow">
                              <div className="flex justify-between items-center">
                                <span className="font-extrabold text-xs text-slate-800">{meal.name}</span>
                                <span className="text-[9px] font-bold text-slate-400">Portion: {meal.portion}</span>
                              </div>
                              <p className="text-xs text-slate-600 leading-normal">{meal.foods}</p>
                              <div className="flex items-center gap-2 pt-0.5 text-[8.5px] font-mono text-slate-450">
                                <span>🔥 {meal.calories} kcal</span>
                                <span>·</span>
                                <span>🥩 P: {meal.protein}g</span>
                                <span>·</span>
                                <span>🥑 F: {meal.fats}g</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Grocery list */}
                  {dietPlan.weeklyGroceryList && dietPlan.weeklyGroceryList.length > 0 && (
                    <div className="space-y-3">
                      <h5 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Auto-Generated Groceries</h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                        {dietPlan.weeklyGroceryList.map((item: any, idx: number) => (
                          <div key={idx} className="p-2.5 bg-slate-50 border border-slate-150 rounded-xl flex items-center justify-between text-xs">
                            <span className="font-semibold text-slate-700 truncate">{item.name}</span>
                            <span className="text-[9px] font-bold text-sky-600 bg-sky-50 px-2 py-0.5 rounded-full font-mono">{item.quantity}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Duplication Controls */}
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-2xl space-y-3">
                    <span className="text-[10px] font-bold text-slate-800 uppercase tracking-wider block">Duplicate Plan to Another Client</span>
                    <div className="flex gap-2">
                      <select
                        value={cloningMemberId}
                        onChange={e => setCloningMemberId(e.target.value)}
                        className="flex-grow text-xs bg-white border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value="">-- Select Member --</option>
                        {members
                          .filter(m => m.id !== selectedClient.id)
                          .map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))
                        }
                      </select>
                      <button
                        onClick={handleDuplicatePlan}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold border-none cursor-pointer flex items-center gap-1.5 transition-all"
                      >
                        <Copy size={13} /> Duplicate
                      </button>
                    </div>
                  </div>

                </div>
              ) : (
                <div className="p-12 border border-dashed border-slate-200 rounded-3xl text-center space-y-4">
                  <Apple size={36} className="mx-auto text-slate-300 stroke-1" />
                  <div className="space-y-1">
                    <h4 className="font-bold text-xs text-slate-700">No Active Diet Plan</h4>
                    <p className="text-[10px] text-slate-400">Generate a custom AI diet plan or upload a PDF/Image sheet above.</p>
                  </div>
                </div>
              )}

              {/* MANUAL BUILDER ADJUSTMENT */}
              <div className="border-t border-slate-100 pt-5 space-y-4 text-left">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider font-display">Manual Adjustment / Creation</h4>
                
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
                  <div>
                    <label className="block text-[8px] font-bold text-slate-450 uppercase mb-1">Plan Title</label>
                    <input 
                      type="text" 
                      value={dietName} 
                      onChange={e => setDietName(e.target.value)} 
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white" 
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-450 uppercase mb-1">Calories (kcal)</label>
                    <input 
                      type="number" 
                      value={calories} 
                      onChange={e => setCalories(Number(e.target.value))} 
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white" 
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-450 uppercase mb-1">Protein (g)</label>
                    <input 
                      type="number" 
                      value={protein} 
                      onChange={e => setProtein(Number(e.target.value))} 
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white" 
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-450 uppercase mb-1">Carbs (g)</label>
                    <input 
                      type="number" 
                      value={carbs} 
                      onChange={e => setCarbs(Number(e.target.value))} 
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white" 
                    />
                  </div>
                  <div>
                    <label className="block text-[8px] font-bold text-slate-450 uppercase mb-1">Fats (g)</label>
                    <input 
                      type="number" 
                      value={fats} 
                      onChange={e => setFats(Number(e.target.value))} 
                      className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white" 
                    />
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[8px] font-bold text-slate-455 uppercase mb-1">Breakfast Foods</label>
                      <textarea 
                        rows={2} 
                        value={breakfast} 
                        onChange={e => setBreakfast(e.target.value)} 
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white resize-none" 
                        placeholder="Oats, peanut butter..." 
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-455 uppercase mb-1">Lunch Foods</label>
                      <textarea 
                        rows={2} 
                        value={lunch} 
                        onChange={e => setLunch(e.target.value)} 
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white resize-none" 
                        placeholder="Chicken, rice, spinach..." 
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[8px] font-bold text-slate-455 uppercase mb-1">Dinner Foods</label>
                      <textarea 
                        rows={2} 
                        value={dinner} 
                        onChange={e => setDinner(e.target.value)} 
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white resize-none" 
                        placeholder="Fish, salad, broccoli..." 
                      />
                    </div>
                    <div>
                      <label className="block text-[8px] font-bold text-slate-455 uppercase mb-1">Snacks & Supplements</label>
                      <textarea 
                        rows={2} 
                        value={snacks} 
                        onChange={e => setSnacks(e.target.value)} 
                        className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white resize-none" 
                        placeholder="Whey protein, almonds, seeds..." 
                      />
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap justify-between items-center gap-4">
                  <div>
                    <label className="block text-[8px] font-bold text-slate-450 uppercase mb-1">Water Goal Target (Litres)</label>
                    <input 
                      type="number" 
                      step="0.5" 
                      value={waterGoal} 
                      onChange={e => setWaterGoal(Number(e.target.value))} 
                      className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:border-emerald-500 focus:bg-white font-mono w-24" 
                    />
                  </div>
                  <button 
                    onClick={handleSaveDiet}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold border-none cursor-pointer flex items-center gap-1.5 transition-all shadow-md shadow-emerald-600/10"
                  >
                    <Check size={14} /> Assign & Sync Diet Plan
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 p-16 text-center text-xs text-slate-400">
              <Apple size={30} className="mx-auto mb-3 text-slate-350 animate-pulse" />
              Select a member from the roster list on the left to open the Diet Builder workspace.
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
