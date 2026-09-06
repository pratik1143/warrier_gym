"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Database, Filter, Layers, FileText, CheckCircle } from "lucide-react";

interface KPIInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  kpiTitle: string;
  sourceCollection: string;
  dateRange: string;
  recordsCount: number;
  rawSum?: string | number;
  items: Array<{ id: string; title: string; subtitle?: string; date?: string; amount?: number | string }>;
}

export default function KPIInspectorModal({
  isOpen,
  onClose,
  kpiTitle,
  sourceCollection,
  dateRange,
  recordsCount,
  rawSum,
  items,
}: KPIInspectorModalProps) {
  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />

        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden text-left z-10 text-white"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 px-6 py-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Database size={18} className="text-indigo-400" />
              <h3 className="font-black text-sm uppercase tracking-wider text-white">
                KPI Audit Inspector: <span className="text-amber-400">{kpiTitle}</span>
              </h3>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white border-none cursor-pointer bg-transparent"
            >
              <X size={18} />
            </button>
          </div>

          {/* Details Bar */}
          <div className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800 text-xs font-semibold">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Source Collection</span>
                <span className="text-indigo-300 font-mono font-bold flex items-center gap-1 mt-0.5">
                  <Layers size={12} /> {sourceCollection}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Date Filter</span>
                <span className="text-emerald-300 font-bold flex items-center gap-1 mt-0.5">
                  <Filter size={12} /> {dateRange}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Unique Records</span>
                <span className="text-amber-300 font-mono font-bold mt-0.5">{recordsCount} Docs</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Computed Metric</span>
                <span className="text-white font-mono font-black mt-0.5">{rawSum !== undefined ? rawSum : recordsCount}</span>
              </div>
            </div>

            {/* Document Breakdown List */}
            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <FileText size={13} /> Ground-Truth Source Records ({items.length})
              </div>

              {items.length === 0 ? (
                <div className="bg-slate-950/50 rounded-2xl p-6 text-center border border-slate-800/80 space-y-1">
                  <CheckCircle size={24} className="mx-auto text-slate-600 mb-2" />
                  <p className="text-xs font-bold text-slate-300">Zero Source Records Found</p>
                  <p className="text-[11px] text-slate-500">
                    No matching documents in Firestore for the selected range. Metric correctly shows 0 / ₹0.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {items.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="bg-slate-950/60 p-3 rounded-xl border border-slate-800 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-white flex items-center gap-2">
                          <span>{item.title}</span>
                          <span className="text-[10px] font-mono text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                            ID: {item.id}
                          </span>
                        </div>
                        {item.subtitle && <div className="text-[11px] text-slate-400">{item.subtitle}</div>}
                      </div>
                      <div className="text-right">
                        {item.amount !== undefined && (
                          <div className="font-mono font-black text-emerald-400 text-sm">
                            ₹{Number(item.amount).toLocaleString('en-IN')}
                          </div>
                        )}
                        {item.date && <div className="text-[10px] text-slate-400 font-mono">{item.date}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
