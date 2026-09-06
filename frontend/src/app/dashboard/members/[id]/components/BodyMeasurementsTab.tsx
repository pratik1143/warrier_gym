'use client';

import React, { useState } from 'react';
import { Plus, Filter, Download, Printer, Smartphone, Mail, Activity, ArrowUpRight, ArrowDownRight, Minus, Save } from 'lucide-react';

export default function BodyMeasurementsTab({ member }: { member: any }) {
  const [fromDate, setFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  
  const [measurements, setMeasurements] = useState([
    { id: 'weight', name: 'Weight', unit: 'kg', trend: 'down', value: '' },
    { id: 'height', name: 'Height', unit: 'cm', trend: 'same', value: '' },
    { id: 'chest', name: 'Chest', unit: 'in', trend: 'up', value: '' },
    { id: 'arms', name: 'Arms', unit: 'in', trend: 'same', value: '' },
    { id: 'waist', name: 'Waist', unit: 'in', trend: 'down', value: '' },
    { id: 'thighs', name: 'Thighs', unit: 'in', trend: 'same', value: '' },
  ]);

  const handleValueChange = (id: string, val: string) => {
    setMeasurements(prev => prev.map(m => m.id === id ? { ...m, value: val } : m));
  };

  const TrendIcon = ({ trend }: { trend: string }) => {
    if (trend === 'up') return <ArrowUpRight size={16} className="text-rose-500" />;
    if (trend === 'down') return <ArrowDownRight size={16} className="text-emerald-500" />;
    return <Minus size={16} className="text-slate-400" />;
  };

  return (
    <div className="bg-white rounded-[32px] shadow-[0_2px_20px_rgba(0,0,0,0.02)] border border-slate-100 overflow-hidden">
      
      {/* Header */}
      <div className="bg-[#EA580C] px-8 py-5 flex items-center justify-between text-white">
        <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
          <Activity size={18} /> Anthropometrics
        </h2>
        <button className="text-xs font-bold bg-white/20 hover:bg-white/30 transition-colors px-4 py-2 rounded-xl flex items-center gap-2 backdrop-blur-sm">
          <Plus size={14} /> Add more fields
        </button>
      </div>

      <div className="p-8 space-y-8">
        
        {/* Filters and Actions */}
        <div className="flex flex-wrap gap-6 items-end justify-between">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">From Date</label>
              <div className="relative">
                <input 
                  type="date" 
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-[#F97316]" 
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">To Date</label>
              <div className="relative">
                <input 
                  type="date" 
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-[#F97316]" 
                />
              </div>
            </div>
            <button className="bg-rose-500 hover:bg-rose-600 text-white px-6 py-2.5 rounded-xl font-bold text-sm transition-colors shadow-lg shadow-rose-500/20">
              FILTER
            </button>
          </div>

          <div className="flex items-center gap-4">
            <button className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-emerald-600 transition-colors">
              <Download size={14} /> Excel
            </button>
            <button className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#EA580C] transition-colors">
              <Printer size={14} /> Print
            </button>
            <button className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-green-500 transition-colors">
              <Smartphone size={14} /> WhatsApp
            </button>
            <button className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-rose-500 transition-colors">
              <Mail size={14} /> E-Mail
            </button>
          </div>
        </div>

        {/* Data Table */}
        <div className="border border-slate-200 rounded-[24px] overflow-hidden">
          {/* Table Header */}
          <div className="bg-[#F97316] px-6 py-4 flex items-center justify-between text-white">
            <div className="flex-1 grid grid-cols-12 gap-4 items-center">
              <div className="col-span-4 text-sm font-black tracking-wide">Measurement Name</div>
              <div className="col-span-2 text-sm font-black tracking-wide text-center">Trend</div>
              <div className="col-span-6 flex items-center gap-3">
                <input 
                  type="date" 
                  value={entryDate}
                  onChange={(e) => setEntryDate(e.target.value)}
                  className="bg-white/20 text-white placeholder-white border border-white/30 rounded-lg px-3 py-1.5 text-sm font-bold outline-none focus:bg-white focus:text-slate-900 transition-all cursor-pointer" 
                />
              </div>
            </div>
            <button className="bg-rose-500 hover:bg-rose-600 text-white px-5 py-1.5 rounded-lg font-bold text-xs transition-colors shadow-md ml-4">
              SAVE
            </button>
          </div>

          {/* Table Body */}
          <div className="divide-y divide-slate-100 bg-slate-50/50">
            {measurements.map((m) => (
              <div key={m.id} className="px-6 py-3 flex items-center justify-between hover:bg-white transition-colors group">
                <div className="flex-1 grid grid-cols-12 gap-4 items-center">
                  <div className="col-span-4 text-sm font-bold text-slate-700">{m.name}</div>
                  <div className="col-span-2 flex justify-center">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center group-hover:bg-orange-50 transition-colors">
                      <TrendIcon trend={m.trend} />
                    </div>
                  </div>
                  <div className="col-span-6">
                    <div className="relative flex items-center">
                      <input 
                        type="number" 
                        value={m.value}
                        onChange={(e) => handleValueChange(m.id, e.target.value)}
                        placeholder={`Enter ${m.name.toLowerCase()}`}
                        className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm font-semibold text-slate-800 outline-none focus:border-[#F97316] focus:ring-4 focus:ring-orange-500/20 transition-all pr-12"
                      />
                      <span className="absolute right-4 text-xs font-bold text-slate-400">{m.unit}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Table Footer Actions */}
          <div className="bg-white px-6 py-4 border-t border-slate-100 flex justify-end">
            <button className="bg-rose-500 hover:bg-rose-600 text-white px-8 py-3 rounded-xl font-black text-sm transition-colors shadow-lg shadow-rose-500/20 flex items-center gap-2">
              <Save size={16} /> SAVE MEASUREMENTS
            </button>
          </div>
        </div>
        
      </div>
    </div>
  );
}
