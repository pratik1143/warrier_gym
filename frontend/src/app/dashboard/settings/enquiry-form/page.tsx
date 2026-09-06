'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Sparkles, Settings, FileText, QrCode, Link as LinkIcon, Plus, Trash2, GripVertical, CheckCircle2, AlertCircle } from 'lucide-react';
import { db, storage } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import toast from '@/lib/toast';
import API from '@/services/api';

interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  enabled: boolean;
  options?: string[];
}

const defaultFields: FormField[] = [
  { id: 'name', label: 'Full Name', type: 'text', required: true, enabled: true },
  { id: 'phone', label: 'Mobile Number', type: 'tel', required: true, enabled: true },
  { id: 'email', label: 'Email Address', type: 'email', required: false, enabled: true },
];

export default function EnquiryFormSettings() {
  const [fields, setFields] = useState<FormField[]>(defaultFields);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const docRef = doc(db, 'settings', 'enquiry_form');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().fields) {
        setFields(docSnap.data().fields);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'enquiry_form'), {
        fields,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      toast.success('Form settings saved successfully!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setUploadedFile(file);

    // Simulate AI parsing by calling our backend
    setIsParsing(true);
    const loadingToast = toast.loading('AI is reading the PDF to auto-generate fields...');

    try {
      // In a real app we'd convert the file to base64 to send to backend or send via multipart formData
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const response = await API.post('/enquiries/parse-pdf', {
            pdfBase64: base64,
            filename: file.name
          });
          
          if (response.data && response.data.detectedFields) {
            setFields(response.data.detectedFields);
            toast.success(`AI generated ${response.data.detectedFields.length} fields!`, { id: loadingToast });
          } else {
            toast.error('Failed to parse PDF.', { id: loadingToast });
          }
        } catch (error) {
           toast.error('Failed to call AI parser API.', { id: loadingToast });
        } finally {
           setIsParsing(false);
        }
      };
      reader.readAsDataURL(file);

    } catch (error) {
      console.error(error);
      toast.error('Error processing file', { id: loadingToast });
      setIsParsing(false);
    }
  };

  const toggleField = (id: string, prop: keyof FormField) => {
    setFields(fields.map(f => {
      if (f.id === id) {
        return { ...f, [prop]: !f[prop] };
      }
      return f;
    }));
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            <Settings className="w-8 h-8 text-brand-primary" />
            Enquiry Form Builder
          </h1>
          <p className="text-slate-400 mt-2 text-sm">
            Design your public enquiry form. Use our AI to instantly parse your existing physical forms!
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={saveSettings}
            disabled={isSaving}
            className="px-6 py-2.5 bg-brand-primary hover:bg-brand-primary/90 text-black font-semibold rounded-xl flex items-center gap-2 transition-all disabled:opacity-50"
          >
            {isSaving ? <span className="animate-spin text-xl">↻</span> : <CheckCircle2 className="w-5 h-5" />}
            Save Settings
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Col: Upload & AI */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-slate-900/50 border border-white/5 backdrop-blur-xl rounded-2xl p-6 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-4 opacity-10">
               <Sparkles className="w-24 h-24 text-brand-primary" />
             </div>
             <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4 relative z-10">
               <FileText className="w-5 h-5 text-fuchsia-400" />
               AI PDF Parsing
             </h2>
             <p className="text-sm text-slate-400 mb-6 relative z-10">
               Upload your physical enquiry form or brochure (PDF). Our AI will automatically identify all fields and generate a beautiful digital form for you.
             </p>
             
             <label className="relative flex flex-col items-center justify-center w-full h-40 border-2 border-dashed border-white/10 rounded-xl hover:bg-white/5 hover:border-brand-primary/50 transition-all cursor-pointer group z-10">
                <input type="file" className="hidden" accept=".pdf" onChange={handleFileUpload} disabled={isParsing} />
                {isParsing ? (
                  <div className="flex flex-col items-center gap-3 text-brand-primary">
                     <Sparkles className="w-8 h-8 animate-pulse" />
                     <span className="text-sm font-medium animate-pulse">AI is thinking...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-3 text-slate-400 group-hover:text-white transition-colors">
                     <Upload className="w-8 h-8" />
                     <span className="text-sm font-medium">Click to upload PDF</span>
                     {uploadedFile && <span className="text-xs text-brand-primary text-center px-4">{uploadedFile.name}</span>}
                  </div>
                )}
             </label>
          </div>

          <div className="bg-slate-900/50 border border-white/5 backdrop-blur-xl rounded-2xl p-6">
             <h2 className="text-xl font-bold text-white flex items-center gap-2 mb-4">
               <QrCode className="w-5 h-5 text-[#FB923C]" />
               Share Form
             </h2>
             <p className="text-sm text-slate-400 mb-6">
               Share this link or QR code anywhere. Submissions will automatically appear in your Enquiries Dashboard.
             </p>
             
             <div className="space-y-4">
               <div className="flex items-center gap-2 bg-black/40 p-3 rounded-lg border border-white/5">
                 <LinkIcon className="w-4 h-4 text-slate-400 shrink-0" />
                 <input 
                   readOnly 
                   value={`${typeof window !== 'undefined' ? window.location.origin : ''}/enquiry`}
                   className="bg-transparent text-sm text-white w-full outline-none"
                 />
                 <button 
                   onClick={() => {
                     navigator.clipboard.writeText(`${window.location.origin}/enquiry`);
                     toast.success('Link copied!');
                   }}
                   className="text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-md text-white transition-colors"
                 >
                   Copy
                 </button>
               </div>
               
               <div className="aspect-square bg-white rounded-xl flex items-center justify-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center gap-2 opacity-0 hover:opacity-100 transition-opacity">
                    <button className="px-4 py-2 bg-brand-primary text-black text-sm font-bold rounded-lg">Download QR</button>
                  </div>
                  <QrCode className="w-32 h-32 text-black" />
               </div>
             </div>
          </div>
        </div>

        {/* Right Col: Form Builder */}
        <div className="lg:col-span-2">
          <div className="bg-slate-900/50 border border-white/5 backdrop-blur-xl rounded-2xl p-6 min-h-[600px]">
             <div className="flex items-center justify-between mb-8">
               <h2 className="text-xl font-bold text-white">Form Fields</h2>
               <button className="flex items-center gap-2 text-sm text-brand-primary hover:text-white transition-colors">
                 <Plus className="w-4 h-4" />
                 Add Custom Field
               </button>
             </div>

             <div className="space-y-3">
               <AnimatePresence>
                 {fields.map((field, index) => (
                   <motion.div 
                     key={field.id}
                     layout
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, scale: 0.95 }}
                     className={`flex items-center gap-4 p-4 rounded-xl border transition-all ${
                       field.enabled ? 'bg-slate-800/50 border-white/10' : 'bg-black/20 border-white/5 opacity-50'
                     }`}
                   >
                     <GripVertical className="w-5 h-5 text-slate-500 cursor-grab active:cursor-grabbing shrink-0" />
                     
                     <div className="flex-1 grid grid-cols-3 gap-4 items-center">
                       <input 
                         value={field.label}
                         onChange={(e) => {
                           const newFields = [...fields];
                           newFields[index].label = e.target.value;
                           setFields(newFields);
                         }}
                         className="bg-transparent text-white font-medium outline-none border-b border-transparent focus:border-brand-primary/50 py-1"
                       />
                       
                       <div className="flex items-center gap-2 text-sm text-slate-400">
                         <span className="px-2 py-1 bg-black/40 rounded-md border border-white/5 capitalize">{field.type}</span>
                       </div>

                       <div className="flex items-center justify-end gap-6">
                         <label className="flex items-center gap-2 text-sm cursor-pointer">
                           <input 
                             type="checkbox" 
                             checked={field.required}
                             onChange={() => toggleField(field.id, 'required')}
                             className="accent-brand-primary w-4 h-4"
                           />
                           <span className="text-slate-300">Required</span>
                         </label>

                         <label className="flex items-center gap-2 text-sm cursor-pointer">
                           <input 
                             type="checkbox" 
                             checked={field.enabled}
                             onChange={() => toggleField(field.id, 'enabled')}
                             className="accent-brand-primary w-4 h-4"
                           />
                           <span className="text-slate-300">Visible</span>
                         </label>
                       </div>
                     </div>
                   </motion.div>
                 ))}
               </AnimatePresence>
             </div>
          </div>
        </div>

      </div>
    </div>
  );
}
