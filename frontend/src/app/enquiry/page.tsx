'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, addDoc, doc, getDoc } from 'firebase/firestore';
import { toast } from '@/lib/toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, ArrowRight, UserPlus, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';

interface FormField {
  id: string;
  label: string;
  type: string;
  required: boolean;
  enabled: boolean;
  options?: string[];
}

export default function PublicEnquiryForm() {
  const [fields, setFields] = useState<FormField[]>([]);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const docRef = doc(db, 'settings', 'enquiry_form');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().fields) {
        setFields(docSnap.data().fields.filter((f: FormField) => f.enabled));
      } else {
        // Fallback to standard fields
        setFields([
          { id: 'name', label: 'Full Name', type: 'text', required: true, enabled: true },
          { id: 'phone', label: 'Mobile Number', type: 'tel', required: true, enabled: true },
        ]);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (id: string, value: any) => {
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    const missingFields = fields.filter(f => f.required && !formData[f.id]);
    if (missingFields.length > 0) {
      toast.error(`Please fill in: ${missingFields.map(f => f.label).join(', ')}`);
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'enquiries'), {
        ...formData,
        status: 'New',
        priority: 'Medium',
        createdAt: new Date().toISOString(),
        timeline: [
          { type: 'created', timestamp: new Date().toISOString(), note: 'Enquiry submitted via public form' }
        ]
      });
      setIsSubmitted(true);
    } catch (error) {
      console.error('Error submitting enquiry:', error);
      toast.error('Failed to submit form. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center">
        <Sparkles className="w-10 h-10 text-brand-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col relative overflow-hidden font-poppins selection:bg-brand-primary/30">
      {/* Background Orbs */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-brand-primary/10 blur-[120px]" />
        <div className="absolute bottom-[0%] -right-[10%] w-[40%] h-[40%] rounded-full bg-fuchsia-500/10 blur-[120px]" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-center p-6 relative z-10">
        <AnimatePresence mode="wait">
          {!isSubmitted ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="w-full max-w-2xl bg-slate-900/40 backdrop-blur-3xl border border-white/10 p-8 sm:p-12 rounded-[2rem] shadow-2xl"
            >
              <div className="text-center mb-10">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-primary/10 mb-4">
                  <UserPlus className="w-8 h-8 text-brand-primary" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-black uppercase tracking-tight">Join The Warrior Gym</h1>
                <p className="text-slate-400 mt-2">Start your fitness journey today. Fill out the details below.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {fields.map((field) => (
                    <div key={field.id} className={`${field.type === 'textarea' ? 'sm:col-span-2' : ''}`}>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      
                      {field.type === 'textarea' ? (
                        <textarea
                          required={field.required}
                          value={formData[field.id] || ''}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-primary/50 transition-colors resize-none h-24"
                        />
                      ) : field.type === 'select' ? (
                        <select
                          required={field.required}
                          value={formData[field.id] || ''}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-primary/50 transition-colors appearance-none"
                        >
                          <option value="">Select...</option>
                          {field.options?.map((opt) => (
                            <option key={opt} value={opt} className="bg-slate-900">{opt}</option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type={field.type}
                          required={field.required}
                          value={formData[field.id] || ''}
                          onChange={(e) => handleInputChange(field.id, e.target.value)}
                          className="w-full bg-black/40 border border-white/5 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-brand-primary/50 transition-colors"
                        />
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-8 bg-brand-primary hover:bg-brand-primary/90 text-black font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span className="animate-pulse">Submitting...</span>
                  ) : (
                    <>
                      Submit Enquiry <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center p-12 bg-slate-900/40 backdrop-blur-3xl border border-emerald-500/20 rounded-[2rem] max-w-lg w-full shadow-[0_0_50px_-12px_rgba(16,185,129,0.3)]"
            >
              <div className="w-24 h-24 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12 text-emerald-500" />
              </div>
              <h2 className="text-3xl font-black mb-4">Request Received!</h2>
              <p className="text-slate-400 mb-8">
                Thank you for your interest in The Warrior Gym. Our team will get back to you shortly.
              </p>
              <button 
                onClick={() => {
                  setFormData({});
                  setIsSubmitted(false);
                }}
                className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-xl transition-colors"
              >
                Submit Another
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      
      <div className="py-6 text-center text-xs text-slate-500 z-10">
        Powered by Warrior Gym OS
      </div>
    </div>
  );
}
