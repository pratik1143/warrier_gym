'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Send, MessageSquare, FileText } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import toast from '@/lib/toast';
import API from '@/services/api';

interface SendWhatsAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  phone: string;
  memberName: string;
  plan?: string;
  expiryDate?: string;
  trainer?: string;
}

export default function SendWhatsAppModal({
  isOpen,
  onClose,
  phone,
  memberName,
  plan = 'Standard Monthly',
  expiryDate = '2026-12-31',
  trainer = 'Karan Verma'
}: SendWhatsAppModalProps) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const fetchTemplates = async () => {
      try {
        const snap = await getDocs(collection(db, 'whatsapp_templates'));
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() })) as any[];
        setTemplates(list);

        // Pre-select first template if exists
        if (list.length > 0) {
          applyTemplate(list[0].message);
          setSelectedTemplateId(list[0].id);
        } else {
          setMessageText(`Hi ${memberName}, hope you are doing well!`);
        }
      } catch (err) {
        console.error('Failed to load templates:', err);
      }
    };

    fetchTemplates();
  }, [isOpen, memberName, plan, expiryDate, trainer]);

  const applyTemplate = (rawMessage: string) => {
    const formatted = rawMessage
      .replace(/\{\{memberName\}\}/g, memberName)
      .replace(/\{\{plan\}\}/g, plan)
      .replace(/\{\{expiryDate\}\}/g, expiryDate)
      .replace(/\{\{trainer\}\}/g, trainer)
      .replace(/\{\{gymName\}\}/g, 'The Warrior Gym');
    setMessageText(formatted);
  };

  const handleTemplateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedTemplateId(id);
    const tmpl = templates.find(t => t.id === id);
    if (tmpl) {
      applyTemplate(tmpl.message);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!messageText.trim()) return;

    setSending(true);
    try {
      await API.post('/whatsapp/test', {
        phone,
        message: messageText
      });
      
      // Also add a log in firebase queue manually for immediate delivery tracking
      toast.success('Message sent via WhatsApp Web!');
      onClose();
    } catch (err: any) {
      toast.error('Failed to send message: ' + (err.response?.data?.error || err.message));
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/40 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Modal content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="relative bg-white border border-slate-200 rounded-[28px] shadow-2xl w-full max-w-md overflow-hidden flex flex-col z-[101]"
        >
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
              <MessageSquare className="text-emerald-500" size={18} />
              Send WhatsApp Message
            </h2>
            <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSend} className="p-6 space-y-4">
            
            {/* Header info */}
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100/50 flex flex-col text-[11px] font-semibold text-slate-500">
              <div>To: <span className="font-bold text-slate-900">{memberName}</span></div>
              <div>Phone: <span className="font-bold text-slate-900">{phone}</span></div>
            </div>

            {/* Template Selector */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Choose Template</label>
              <select
                value={selectedTemplateId}
                onChange={handleTemplateChange}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-[#F97316] font-bold text-slate-700"
              >
                <option value="">Custom Message (No Template)</option>
                {templates.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            {/* Preview / Edit Textarea */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Message Preview (Editable)</label>
              <textarea
                rows={5}
                required
                value={messageText}
                onChange={e => setMessageText(e.target.value)}
                placeholder="Type your message content..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs outline-none focus:border-[#F97316] font-semibold text-slate-700 resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-5 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-lg text-[10px] hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={sending}
                className="px-5 py-2.5 bg-[#EA580C] text-white font-black rounded-lg text-[10px] hover:bg-orange-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                <Send size={12} />
                {sending ? 'Sending...' : 'Send Immediately'}
              </button>
            </div>

          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
