'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, Users, Briefcase, Dumbbell, MessageSquare, Phone, 
  ArrowRight, Mail, MapPin, Calendar, Clock, CheckCircle2, 
  AlertCircle, Sparkles, Filter, ChevronRight, ExternalLink, RefreshCw
} from 'lucide-react';
import { globalSearchService, GlobalSearchResults, SearchResultItem } from '@/services/globalSearch.service';
import toast from '@/lib/toast';

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const queryParam = searchParams?.get('q') || '';
  
  const [searchTerm, setSearchTerm] = useState(queryParam);
  const [activeTab, setActiveTab] = useState<'all' | 'members' | 'employees' | 'trainers' | 'enquiries' | 'followups'>('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<GlobalSearchResults>({
    query: '',
    members: [],
    employees: [],
    trainers: [],
    enquiries: [],
    followUps: [],
    total: 0
  });

  useEffect(() => {
    setSearchTerm(queryParam);
  }, [queryParam]);

  const executeSearch = async (term: string) => {
    if (!term.trim()) {
      setResults({
        query: '',
        members: [],
        employees: [],
        trainers: [],
        enquiries: [],
        followUps: [],
        total: 0
      });
      return;
    }

    setLoading(true);
    try {
      const res = await globalSearchService.search(term);
      setResults(res);
    } catch (err: any) {
      toast.error('Unable to complete search. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = setTimeout(() => {
      executeSearch(searchTerm);
    }, 250);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  const handleItemClick = (item: SearchResultItem) => {
    router.push(item.url);
  };

  // Grouped items according to active tab
  const displayedItems = useMemo(() => {
    if (activeTab === 'members') return results.members;
    if (activeTab === 'employees') return results.employees;
    if (activeTab === 'trainers') return results.trainers;
    if (activeTab === 'enquiries') return results.enquiries;
    if (activeTab === 'followups') return results.followUps;

    // All combined and ranked by score
    const all = [
      ...results.members,
      ...results.employees,
      ...results.trainers,
      ...results.enquiries,
      ...results.followUps
    ];
    return all.sort((a, b) => b.score - a.score);
  }, [activeTab, results]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'member': return <Users size={16} className="text-[#EA580C]" />;
      case 'employee': return <Briefcase size={16} className="text-indigo-600" />;
      case 'trainer': return <Dumbbell size={16} className="text-purple-600" />;
      case 'enquiry': return <MessageSquare size={16} className="text-amber-600" />;
      case 'followup': return <Phone size={16} className="text-emerald-600" />;
      default: return <Search size={16} className="text-slate-600" />;
    }
  };

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'member':
        return 'bg-[#FFF7ED] text-[#C2410C] border-[#FED7AA]';
      case 'employee':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'trainer':
        return 'bg-purple-50 text-purple-700 border-purple-200';
      case 'enquiry':
        return 'bg-amber-50 text-amber-800 border-amber-200';
      case 'followup':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-6 pb-12 w-full text-slate-800 text-left font-sans">
      
      {/* ── 1. HEADER ── */}
      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
        
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-3 py-1 bg-gradient-to-r from-[#EA580C] to-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-2xs">
              Universal Search
            </span>
            <span className="text-xs text-slate-400 font-mono font-bold">TWG-OS-v4.0</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900 font-display">
            {searchTerm ? `Search Results for "${searchTerm}"` : 'Global OS Search'}
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Showing {results.total} matching records across Members, Employees, Trainers, Enquiries and Follow-Ups
          </p>
        </div>

        {/* Search Box on Page */}
        <div className="w-full md:w-80 relative shrink-0">
          <Search size={15} className="absolute left-3.5 top-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search Name, Phone, ID, Email..."
            className="w-full pl-9 pr-4 py-2.5 bg-slate-50 text-xs font-bold text-slate-800 rounded-2xl border border-slate-200 outline-none focus:border-[#F97316] focus:bg-white transition-all shadow-2xs"
          />
        </div>
      </div>

      {/* ── 2. CATEGORY TABS ── */}
      <div className="bg-white p-2 rounded-3xl border border-slate-200/80 shadow-2xs flex items-center gap-1.5 overflow-x-auto custom-scrollbar">
        {[
          { id: 'all', label: 'All Results', count: results.total, icon: Sparkles },
          { id: 'members', label: 'Members', count: results.members.length, icon: Users },
          { id: 'employees', label: 'Employees', count: results.employees.length, icon: Briefcase },
          { id: 'trainers', label: 'Trainers', count: results.trainers.length, icon: Dumbbell },
          { id: 'enquiries', label: 'Enquiries', count: results.enquiries.length, icon: MessageSquare },
          { id: 'followups', label: 'Follow-Ups', count: results.followUps.length, icon: Phone },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 border-none cursor-pointer shrink-0 ${
                isActive
                  ? 'bg-[#EA580C] text-white shadow-sm'
                  : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              <Icon size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
              <span>{tab.label}</span>
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
              }`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── 3. RESULTS GRID ── */}
      {loading ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3">
          <RefreshCw size={24} className="animate-spin text-[#EA580C] mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">Searching Warrior Gym OS...</h3>
          <p className="text-xs text-slate-400">Scanning Members, Staff, Inquiries and Follow-up records</p>
        </div>
      ) : displayedItems.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200/80 shadow-xs space-y-3 max-w-xl mx-auto">
          <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto font-bold">
            <Search size={24} />
          </div>
          <h3 className="text-base font-bold text-slate-800">No results found for "{searchTerm}"</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Try searching by: <strong>Full Name</strong>, <strong>10-digit Phone Number</strong>, <strong>Member ID</strong> (e.g. TWG-2026-0012), <strong>Employee ID</strong> (EMP-10011), <strong>Biometric ID</strong> (#10011), or <strong>Enquiry ID</strong> (ENQ-2054).
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedItems.map((item) => (
            <motion.div
              key={`${item.category}_${item.id}`}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onClick={() => handleItemClick(item)}
              className="bg-white rounded-3xl p-5 border border-slate-200/80 shadow-xs hover:shadow-md hover:border-[#EA580C] transition-all cursor-pointer flex flex-col justify-between group text-left relative overflow-hidden"
            >
              <div className="space-y-3">
                {/* Header: Category Badge + Status */}
                <div className="flex items-center justify-between gap-2">
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-xl border flex items-center gap-1.5 uppercase tracking-wider ${getCategoryBadge(item.category)}`}>
                    {getCategoryIcon(item.category)}
                    <span>{item.categoryLabel}</span>
                  </span>

                  {item.status && (
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${item.statusClass || 'bg-slate-100 text-slate-700'}`}>
                      {item.status}
                    </span>
                  )}
                </div>

                {/* Avatar & Title */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center font-black text-slate-700 text-xs shrink-0 shadow-2xs group-hover:bg-orange-50 group-hover:text-[#C2410C] transition-colors">
                    {item.avatarText || 'AZ'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-black text-slate-900 truncate group-hover:text-[#EA580C] transition-colors">
                      {item.title}
                    </h3>
                    <p className="text-xs font-semibold text-slate-500 truncate mt-0.5">
                      {item.subtitle}
                    </p>
                  </div>
                </div>

                {/* Info Fields */}
                <div className="space-y-1.5 pt-1 text-xs text-slate-600">
                  {item.phone && (
                    <div className="flex items-center gap-2 font-medium">
                      <Phone size={12} className="text-slate-400 shrink-0" />
                      <span>{item.phone}</span>
                    </div>
                  )}
                  {item.email && (
                    <div className="flex items-center gap-2 font-medium truncate">
                      <Mail size={12} className="text-slate-400 shrink-0" />
                      <span className="truncate">{item.email}</span>
                    </div>
                  )}
                  {item.meta && (
                    <div className="flex items-center gap-2 font-medium text-[#C2410C]">
                      <Calendar size={12} className="text-[#F97316] shrink-0" />
                      <span>{item.meta}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Action Indicator */}
              <div className="pt-4 mt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-[#EA580C] group-hover:text-[#C2410C]">
                <span>Open {item.categoryLabel} Record</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </div>
            </motion.div>
          ))}
        </div>
      )}

    </div>
  );
}

export default function GlobalSearchPage() {
  return (
    <Suspense fallback={
      <div className="p-8 text-center text-slate-500 font-bold">
        Loading The Warrior Gym Search...
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}
