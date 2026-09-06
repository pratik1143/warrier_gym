'use client';

import React, { useState, useEffect } from 'react';
import { Phone, Mail, MessageSquare, StickyNote, Filter, CheckCircle2, XCircle, Search, Clock, Plus, Zap, Calendar, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import toast from '@/lib/toast';

export default function CommunicationTab({ member }: { member: any }) {
  const [communications, setCommunications] = useState<any[]>([]);
  const [filter, setFilter] = useState('All');
  
  const [showNewModal, setShowNewModal] = useState(false);
  const [newType, setNewType] = useState('Note');
  const [newContent, setNewContent] = useState('');
  const [newOutcome, setNewOutcome] = useState('Pending');

  // Follow-up state
  const [showFollowupModal, setShowFollowupModal] = useState(false);
  const [fType, setFType] = useState('Renewal');
  const [fRequired, setFRequired] = useState('Yes');
  const [fDate, setFDate] = useState('');
  const [fTime, setFTime] = useState('');
  const [fFeedback, setFFeedback] = useState('');
  const [fMethod, setFMethod] = useState('Manual');

  useEffect(() => {
    if (!member?.id) return;
    const q = query(
      collection(db, 'communications'),
      where('memberId', '==', member.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a: any, b: any) => {
        const tA = a.timestamp?.toMillis?.() || 0;
        const tB = b.timestamp?.toMillis?.() || 0;
        return tB - tA;
      });
      setCommunications(docs);
    });
    return () => unsub();
  }, [member?.id]);

  const handleSaveComm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent) return;
    
    await addDoc(collection(db, 'communications'), {
      memberId: member.id,
      type: newType,
      content: newContent,
      outcome: newOutcome,
      timestamp: serverTimestamp(),
      author: 'Admin'
    });
    
    setShowNewModal(false);
    setNewContent('');
  };

  const handleSaveFollowup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      // 1. Log communication history
      await addDoc(collection(db, 'communications'), {
        memberId: member.id,
        type: fType,
        method: fMethod,
        content: fFeedback,
        outcome: fRequired === 'Yes' ? 'Follow-up Scheduled' : 'Completed',
        timestamp: serverTimestamp(),
        author: 'Admin'
      });

      // 2. Schedule follow-up if required
      if (fRequired === 'Yes' && fDate && fTime) {
        const scheduledTimestamp = new Date(`${fDate}T${fTime}`).getTime();
        await addDoc(collection(db, 'followups'), {
          memberId: member.id,
          enquiryId: null,
          employeeId: null,
          type: fType,
          priority: 'Medium',
          title: `${fType} Follow-up: ${member.name}`,
          description: fFeedback,
          assignedTo: 'Admin',
          method: fMethod,
          phone: member.phone || '',
          scheduledDate: fDate,
          scheduledTime: fTime,
          scheduledTimestamp: scheduledTimestamp,
          status: 'Pending',
          notificationSent: false,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
      }
      
      toast.success('Follow-up saved successfully!');
      setShowFollowupModal(false);
      setFFeedback('');
      setFDate('');
      setFTime('');
      setFMethod('Manual');
    } catch (error) {
      toast.error('Failed to save follow-up');
    }
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'WhatsApp': return <MessageSquare size={16} className="text-emerald-500" />;
      case 'Call': return <Phone size={16} className="text-[#F97316]" />;
      case 'Email': return <Mail size={16} className="text-rose-500" />;
      case 'SMS': return <MessageSquare size={16} className="text-amber-500" />;
      case 'Renewal': return <Clock size={16} className="text-[#F97316]" />;
      case 'Feedback': return <MessageSquare size={16} className="text-purple-500" />;
      default: return <StickyNote size={16} className="text-slate-500" />;
    }
  };

  const filtered = filter === 'All' ? communications : communications.filter(c => c.type === filter || c.method === filter);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-[32px] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-slate-100">
        <div>
          <h3 className="text-xl font-black text-slate-900 tracking-tight">Communication Hub</h3>
          <p className="text-xs font-semibold text-slate-500 mt-1">Single timeline for all member interactions</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => setShowNewModal(true)}
            className="px-6 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-black shadow-sm flex items-center justify-center gap-2 transition-all"
          >
            <StickyNote size={14} /> Log Note
          </button>
          <button 
            onClick={() => setShowFollowupModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white rounded-xl text-xs font-black shadow-md shadow-orange-500/20 flex items-center justify-center gap-2 transition-all"
          >
            <Calendar size={14} /> Add Follow-up
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-2">
          {['All', 'WhatsApp', 'Call', 'Email', 'SMS', 'Note'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-xs font-bold transition-all ${filter === f ? 'bg-[#EA580C] text-white shadow-md border border-[#EA580C]' : 'bg-white border border-slate-100 text-slate-600 hover:bg-slate-50'}`}
            >
              {f === 'All' ? <Filter size={14} /> : getIcon(f)}
              {f}
              <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${filter === f ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {f === 'All' ? communications.length : communications.filter(c => c.type === f || c.method === f).length}
              </span>
            </button>
          ))}

          <div className="mt-8 bg-[#FFF7ED] border border-[#FED7AA] rounded-[24px] p-5">
             <div className="flex items-center gap-2 mb-2 text-[#EA580C]">
               <Zap size={16} />
               <h4 className="text-xs font-black uppercase tracking-wider">Priority Actions</h4>
             </div>
             <p className="text-[10px] text-[#9A3412] font-semibold mb-4 leading-relaxed">Ensure timely follow-ups and reminders are scheduled.</p>
             <button onClick={() => setShowFollowupModal(true)} className="w-full py-2.5 bg-[#EA580C] text-white rounded-xl text-xs font-black hover:bg-orange-700 transition-all flex justify-center items-center gap-2 mb-3">
               <Calendar size={14} /> Schedule Follow-up
             </button>
             <button className="w-full py-2.5 bg-emerald-500 text-white rounded-xl text-xs font-black hover:bg-emerald-600 transition-all flex justify-center items-center gap-2">
               <MessageSquare size={14} /> Auto-Reminder
             </button>
          </div>
        </div>

        <div className="lg:col-span-3 bg-white rounded-[32px] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-slate-100 p-8">
          <div className="relative border-l-2 border-slate-100 ml-4 space-y-8 pb-4">
            {filtered.length === 0 ? (
               <div className="pl-8 py-12 text-center text-slate-400 font-semibold text-sm">
                 No communication history found for {member.name}.
               </div>
            ) : filtered.map((comm) => (
              <div key={comm.id} className="relative pl-8 group">
                <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-white border-[3px] border-slate-100 flex items-center justify-center shadow-sm">
                  {getIcon(comm.type)}
                </div>

                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-5 hover:bg-white hover:shadow-md transition-all">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-black text-slate-800 uppercase tracking-widest bg-white border border-slate-200 px-2 py-1 rounded-md">
                        {comm.type}
                      </span>
                      {comm.outcome === 'Connected' || comm.outcome === 'Delivered' || comm.outcome === 'Resolved' || comm.outcome === 'Follow-up Scheduled' ? (
                        <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md flex items-center gap-1"><CheckCircle2 size={10} /> {comm.outcome}</span>
                      ) : comm.outcome === 'Failed' || comm.outcome === 'No Answer' ? (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded-md flex items-center gap-1"><XCircle size={10} /> {comm.outcome}</span>
                      ) : (
                        <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-1 rounded-md">{comm.outcome || 'Logged'}</span>
                      )}
                    </div>
                    <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5">
                      <Clock size={12} />
                      {comm.timestamp ? new Date(comm.timestamp.toDate()).toLocaleString() : 'Just now'}
                    </div>
                  </div>
                  
                  <p className="text-sm font-semibold text-slate-700 leading-relaxed">
                    {comm.content}
                  </p>
                  
                  <div className="mt-4 pt-4 border-t border-slate-200/60 flex items-center gap-2 text-[10px] font-bold text-slate-400">
                    <span>Logged by: <span className="text-slate-700">{comm.author || 'System'}</span></span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add Followup Modal */}
      {showFollowupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowFollowupModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className="relative bg-white rounded-t-xl rounded-b-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col"
          >
            <div className="bg-[#EA580C] px-6 py-4 flex justify-between items-center text-white">
              <h2 className="text-lg font-black">Add followup</h2>
              <button onClick={() => setShowFollowupModal(false)} className="hover:bg-white/20 p-1 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <form onSubmit={handleSaveFollowup} className="p-6 space-y-6">
              
              <div className="flex gap-6 items-center">
                <div className="flex-1">
                  <label className="text-sm font-semibold text-slate-500 block mb-2">Followup type :</label>
                  <select 
                    value={fType}
                    onChange={(e) => setFType(e.target.value)}
                    className="w-full sm:w-64 bg-white border border-slate-300 rounded-full px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#F97316] transition-colors"
                  >
                    <option value="Renewal">Renewal</option>
                    <option value="General">General</option>
                    <option value="Feedback">Feedback</option>
                    <option value="Attendance">Attendance</option>
                    <option value="Payment">Payment</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-semibold text-slate-500 block mb-2">Followup method :</label>
                  <select 
                    value={fMethod}
                    onChange={(e) => setFMethod(e.target.value)}
                    className="w-full sm:w-64 bg-white border border-slate-300 rounded-full px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#F97316] transition-colors"
                  >
                    <option value="Manual">Manual (Popup)</option>
                    <option value="WhatsApp">WhatsApp (Auto-Send)</option>
                    <option value="Call">Call</option>
                    <option value="SMS">SMS</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <label className="text-sm font-semibold text-slate-500">Schedule followup required :</label>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-800">
                    <input type="radio" name="freq" value="Yes" checked={fRequired === 'Yes'} onChange={() => setFRequired('Yes')} className="w-4 h-4 text-[#EA580C] border-slate-300 focus:ring-orange-200" /> Yes
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-800">
                    <input type="radio" name="freq" value="No" checked={fRequired === 'No'} onChange={() => setFRequired('No')} className="w-4 h-4 text-[#EA580C] border-slate-300 focus:ring-orange-200" /> No
                  </label>
                </div>
              </div>

              {fRequired === 'Yes' && (
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-semibold text-slate-500 block mb-2">Schedule followup date :</label>
                    <input 
                      type="date" 
                      required
                      value={fDate}
                      onChange={(e) => setFDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-full px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#F97316] transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-500 block mb-2">Schedule followup time :</label>
                    <input 
                      type="time"
                      required
                      value={fTime}
                      onChange={(e) => setFTime(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-full px-4 py-2 text-sm text-slate-700 outline-none focus:border-[#F97316] transition-colors"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-semibold text-slate-500 block mb-2">Response / feedback :</label>
                <textarea 
                  required
                  rows={4}
                  value={fFeedback}
                  onChange={(e) => setFFeedback(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-lg p-4 text-sm text-slate-700 outline-none focus:border-[#F97316] transition-colors resize-none"
                />
              </div>

              <div className="flex flex-wrap gap-3">
                {['FOLLOWUP AGAIN', 'SUCCESSFUL FOLLOWUP', 'RATE TO HIGH', 'WRONG NUMBER', 'OTHER'].map(tag => (
                  <button 
                    key={tag}
                    type="button"
                    onClick={() => setFFeedback(prev => prev ? `${prev} | ${tag}` : tag)}
                    className="bg-rose-500 hover:bg-rose-600 text-white px-4 py-2 rounded text-xs font-bold transition-colors"
                  >
                    {tag}
                  </button>
                ))}
              </div>

              <div className="bg-[#EA580C] -mx-6 -mb-6 px-6 py-4 flex justify-end mt-8">
                <button 
                  type="submit"
                  className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-2.5 rounded font-bold text-sm shadow-md transition-colors"
                >
                  ADD FOLLOWUP
                </button>
              </div>

            </form>
          </motion.div>
        </div>
      )}

      {/* Log Communication Modal (legacy small note) */}
      {showNewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-md" onClick={() => setShowNewModal(false)} />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative bg-white rounded-[32px] shadow-2xl w-full max-w-lg p-8"
          >
            <h3 className="text-xl font-black text-slate-900 mb-6">Log Communication</h3>
            <form onSubmit={handleSaveComm} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Type</label>
                  <select value={newType} onChange={e => setNewType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:border-[#F97316] font-bold text-slate-800">
                    <option value="Call">Call</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Email">Email</option>
                    <option value="SMS">SMS</option>
                    <option value="Note">Internal Note</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Outcome</label>
                  <select value={newOutcome} onChange={e => setNewOutcome(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:border-[#F97316] font-bold text-slate-800">
                    <option value="Connected">Connected / Resolved</option>
                    <option value="No Answer">No Answer / Failed</option>
                    <option value="Left Message">Left Message</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">Details / Message *</label>
                <textarea
                  required
                  rows={4}
                  value={newContent}
                  onChange={e => setNewContent(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:border-[#F97316] font-semibold text-slate-700 resize-none"
                  placeholder="Enter notes or message content..."
                />
              </div>
              <div className="flex justify-end gap-3 pt-4 mt-2">
                <button type="button" onClick={() => setShowNewModal(false)} className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl text-xs font-bold transition-all">
                  Cancel
                </button>
                <button type="submit" className="px-6 py-3 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white rounded-xl text-xs font-black shadow-md transition-all">
                  Save Record
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
}
