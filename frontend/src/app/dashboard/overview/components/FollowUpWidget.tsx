"use client";

import React, { useState, useEffect } from "react";
import { collection, query, onSnapshot, updateDoc, doc } from "firebase/firestore";
import { db as fDb, isFirebaseReady } from "@/lib/firebase";
import { motion } from "framer-motion";
import { Phone, MessageCircle, CheckCircle, Clock, Calendar, MoreHorizontal } from "lucide-react";
import toast from '@/lib/toast';

import { useFollowups } from "@/hooks/useFollowups";
import { getTodayInIndia } from "@/lib/dateUtils";

export default function FollowUpWidget() {
  const { followups, completeFollowup } = useFollowups();

  const markCompleted = async (id: string, memberId?: string, enquiryId?: string) => {
    try {
      await completeFollowup(id, "Completed via Overview Kanban Widget", "Connected", memberId, enquiryId);
      toast.success("Follow-up marked as completed");
    } catch (e) {
      toast.error("Error updating follow-up");
    }
  };

  // Grouping logic
  const todayStr = getTodayInIndia();
  const grouped = {
    dueNow: [] as any[],
    upcomingToday: [] as any[],
    completed: [] as any[],
    overdue: [] as any[]
  };

  followups.forEach(f => {
    if (f.status === 'Completed') {
      grouped.completed.push(f);
      return;
    }

    const itemDate = (f.dueDate || f.scheduledDate || f.date || '').split('T')[0];
    
    if (f.status === 'Pending') {
      if (itemDate < todayStr) {
        grouped.overdue.push(f);
      } else if (itemDate === todayStr) {
        grouped.dueNow.push(f);
      } else {
        grouped.upcomingToday.push(f);
      }
    }
  });

  const KanbanColumn = ({ title, items, color, countColor }: { title: string, items: any[], color: string, countColor: string }) => (
    <div className={`bg-slate-50/50 rounded-2xl p-4 border border-slate-100 flex-1 min-w-[250px] flex flex-col h-[500px]`}>
      <div className="flex justify-between items-center mb-4">
        <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest">{title}</h4>
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${countColor}`}>
          {items.length}
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1">
        {items.map(item => (
          <motion.div 
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            key={item.id} 
            className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow group relative"
            style={{ borderTop: `3px solid ${color}` }}
          >
            <div className="flex justify-between items-start mb-2">
              <div className="flex items-center gap-2">
                <img 
                  src={`https://api.dicebear.com/7.x/adventurer/svg?seed=${item.memberName?.replace(/ /g,'') || item.id}`}
                  className="w-7 h-7 rounded-full bg-slate-100"
                />
                <div>
                  <h5 className="text-[11px] font-black text-slate-800 truncate max-w-[100px]">{item.memberName || 'Unknown'}</h5>
                  <p className="text-[9px] font-bold text-slate-400">{item.phone || 'No phone'}</p>
                </div>
              </div>
              <span className="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                {item.time || 'N/A'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span className="text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider bg-slate-100 text-slate-700">
                {item.type || 'Follow-up'}
              </span>
              {item.priority === 'High' && (
                <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
                  High
                </span>
              )}
            </div>

            <p className="text-[10px] text-slate-700 font-semibold mb-3 line-clamp-2 leading-relaxed">
              {item.reason || item.notes || item.description || 'Follow-up task'}
            </p>

            <div className="flex items-center justify-between gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex gap-1.5">
                <a href={`tel:${item.phone}`} className="w-6 h-6 rounded bg-slate-100 text-slate-600 hover:bg-emerald-100 hover:text-emerald-600 flex items-center justify-center transition-colors">
                  <Phone size={10} />
                </a>
                <a href={`https://wa.me/${item.phone}`} target="_blank" className="w-6 h-6 rounded bg-slate-100 text-slate-600 hover:bg-green-100 hover:text-green-600 flex items-center justify-center transition-colors">
                  <MessageCircle size={10} />
                </a>
              </div>
              
              {item.status !== 'Completed' && (
                <button 
                  onClick={() => markCompleted(item.id)}
                  className="w-6 h-6 rounded bg-slate-100 text-slate-600 hover:bg-indigo-100 hover:text-indigo-600 flex items-center justify-center transition-colors"
                >
                  <CheckCircle size={10} />
                </button>
              )}
            </div>
          </motion.div>
        ))}
        {items.length === 0 && (
          <div className="text-center py-10 opacity-50">
            <span className="text-[10px] font-bold text-slate-400">No items</span>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mt-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
            Today's Follow-ups
          </h2>
          <p className="text-xs text-slate-500 font-medium">Kanban board for daily calls</p>
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar">
        <KanbanColumn 
          title="Overdue" 
          items={grouped.overdue} 
          color="#ef4444" 
          countColor="bg-red-100 text-red-600" 
        />
        <KanbanColumn 
          title="Due Now" 
          items={grouped.dueNow} 
          color="#f59e0b" 
          countColor="bg-amber-100 text-amber-600" 
        />
        <KanbanColumn 
          title="Upcoming Today" 
          items={grouped.upcomingToday} 
          color="#3b82f6" 
          countColor="bg-[#FFEDD5] text-[#EA580C]" 
        />
        <KanbanColumn 
          title="Completed" 
          items={grouped.completed} 
          color="#10b981" 
          countColor="bg-emerald-100 text-emerald-600" 
        />
      </div>
    </div>
  );
}
