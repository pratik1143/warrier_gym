'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, X, User, Phone, MessageSquare, Crown, Sparkles,
  ChevronRight, ArrowRight, UserPlus, Shield, Activity, Clock, 
  Command, MapPin, Calendar, Hash, Users, Briefcase, Dumbbell,
  RefreshCw, CheckCircle2, AlertCircle
} from 'lucide-react';
import { globalSearchService, GlobalSearchResults, SearchResultItem } from '@/services/globalSearch.service';
import toast from '@/lib/toast';

export default function UniversalSearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [results, setResults] = useState<GlobalSearchResults>({
    query: '',
    members: [],
    employees: [],
    trainers: [],
    enquiries: [],
    followUps: [],
    total: 0
  });

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keyboard shortcut Ctrl+K or Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        setIsFocused(true);
      }
      if (e.key === 'Escape') {
        setIsFocused(false);
        inputRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Debounced search trigger across all CRM modules
  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults({
        query: '',
        members: [],
        employees: [],
        trainers: [],
        enquiries: [],
        followUps: [],
        total: 0
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await globalSearchService.search(trimmed);
        setResults(res);
      } catch (err) {
        console.warn('[UniversalSearchBar] Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [query]);

  // Flatten top results for keyboard navigation (max 3 per category)
  const flattenedTopItems = useMemo(() => {
    const items: SearchResultItem[] = [
      ...results.members.slice(0, 3),
      ...results.employees.slice(0, 3),
      ...results.trainers.slice(0, 3),
      ...results.enquiries.slice(0, 3),
      ...results.followUps.slice(0, 3)
    ];
    return items;
  }, [results]);

  // Reset keyboard index on query change
  useEffect(() => {
    setSelectedIndex(-1);
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isFocused) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < flattenedTopItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : flattenedTopItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && selectedIndex < flattenedTopItems.length) {
        handleItemClick(flattenedTopItems[selectedIndex]);
      } else if (query.trim()) {
        handleViewAll();
      }
    }
  };

  const handleItemClick = (item: SearchResultItem) => {
    setIsFocused(false);
    setQuery('');
    router.push(item.url);
  };

  const handleViewAll = () => {
    if (!query.trim()) return;
    const targetQ = query.trim();
    setIsFocused(false);
    setQuery('');
    router.push(`/dashboard/search?q=${encodeURIComponent(targetQ)}`);
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl z-40">
      {/* Search Bar Input Box */}
      <div
        className={`relative flex items-center w-full rounded-2xl transition-all duration-200 border bg-white/90 backdrop-blur-md shadow-xs ${
          isFocused
            ? 'border-[#F97316] ring-4 ring-orange-500/10 shadow-lg bg-white'
            : 'border-stone-200/80 hover:border-orange-300 hover:bg-white'
        }`}
      >
        <div className="pl-4 text-slate-400 flex items-center justify-center pointer-events-none">
          {loading ? (
            <RefreshCw size={17} className="animate-spin text-[#EA580C]" />
          ) : (
            <Search size={18} className={isFocused ? 'text-[#EA580C]' : 'text-slate-400'} />
          )}
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search Warrior Gym OS (Name, Phone, Member/Employee/Enquiry ID)..."
          className="w-full py-2.5 pl-2.5 pr-20 bg-transparent text-xs font-bold text-slate-800 placeholder:text-slate-400 placeholder:font-medium focus:outline-none"
        />

        <div className="absolute right-3 flex items-center gap-2">
          {query ? (
            <button
              onClick={() => {
                setQuery('');
                setResults({
                  query: '',
                  members: [],
                  employees: [],
                  trainers: [],
                  enquiries: [],
                  followUps: [],
                  total: 0
                });
                inputRef.current?.focus();
              }}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors border-none cursor-pointer"
            >
              <X size={15} />
            </button>
          ) : (
            <div className="hidden sm:flex items-center gap-1 px-2 py-1 rounded-md bg-stone-100 border border-stone-200 text-[10px] font-bold text-slate-400 select-none">
              <Command size={10} />
              <span>K</span>
            </div>
          )}
        </div>
      </div>

      {/* Dynamic Results Dropdown (Command Palette) */}
      <AnimatePresence>
        {isFocused && query.trim().length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden z-50 divide-y divide-stone-100 max-h-[500px] overflow-y-auto custom-scrollbar"
          >
            {/* Header info bar */}
            <div className="px-4 py-2.5 bg-stone-50/90 flex items-center justify-between text-xs text-slate-500 font-semibold border-b border-stone-100">
              <span className="flex items-center gap-1.5 font-bold text-slate-700">
                <Sparkles size={13} className="text-[#EA580C]" />
                {loading ? 'Searching Warrior Gym OS...' : `Global Search Results (${results.total})`}
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Use ↑ ↓ to navigate, Enter to open</span>
            </div>

            {/* Results Sections or Empty State */}
            {results.total === 0 && !loading ? (
              <div className="p-8 text-center space-y-2 text-left">
                <div className="w-10 h-10 rounded-full bg-stone-100 text-slate-400 flex items-center justify-center mx-auto font-bold mb-2">
                  <Search size={18} />
                </div>
                <p className="text-xs font-bold text-slate-800 text-center">No matching records found for "{query}"</p>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200/70 text-[11px] text-slate-500 space-y-1">
                  <span className="font-bold text-slate-700 block">Try searching by:</span>
                  <div className="grid grid-cols-2 gap-1 text-[10.5px]">
                    <span>• Full or partial Name</span>
                    <span>• 10-digit Phone Number</span>
                    <span>• Member ID (TWG-2026-...)</span>
                    <span>• Employee ID (EMP-10011)</span>
                    <span>• Biometric ID (#10011)</span>
                    <span>• Enquiry ID (ENQ-2054)</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-stone-100">
                
                {/* 1. MEMBERS SECTION */}
                {results.members.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-1 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-orange-600 flex items-center gap-1.5">
                        <Users size={12} /> Members ({results.members.length})
                      </span>
                    </div>
                    {results.members.slice(0, 3).map((item) => (
                      <SearchResultRow 
                        key={`mem_${item.id}`} 
                        item={item} 
                        onClick={() => handleItemClick(item)} 
                      />
                    ))}
                  </div>
                )}

                {/* 2. EMPLOYEES SECTION */}
                {results.employees.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-1 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 flex items-center gap-1.5">
                        <Briefcase size={12} /> Employees ({results.employees.length})
                      </span>
                    </div>
                    {results.employees.slice(0, 3).map((item) => (
                      <SearchResultRow 
                        key={`emp_${item.id}`} 
                        item={item} 
                        onClick={() => handleItemClick(item)} 
                      />
                    ))}
                  </div>
                )}

                {/* 3. TRAINERS SECTION */}
                {results.trainers.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-1 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-orange-700 flex items-center gap-1.5">
                        <Dumbbell size={12} /> Trainers ({results.trainers.length})
                      </span>
                    </div>
                    {results.trainers.slice(0, 3).map((item) => (
                      <SearchResultRow 
                        key={`trn_${item.id}`} 
                        item={item} 
                        onClick={() => handleItemClick(item)} 
                      />
                    ))}
                  </div>
                )}

                {/* 4. ENQUIRIES SECTION */}
                {results.enquiries.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-1 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                        <MessageSquare size={12} /> Enquiries & Leads ({results.enquiries.length})
                      </span>
                    </div>
                    {results.enquiries.slice(0, 3).map((item) => (
                      <SearchResultRow 
                        key={`enq_${item.id}`} 
                        item={item} 
                        onClick={() => handleItemClick(item)} 
                      />
                    ))}
                  </div>
                )}

                {/* 5. FOLLOW-UPS SECTION */}
                {results.followUps.length > 0 && (
                  <div className="py-2">
                    <div className="px-4 py-1 flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-600 flex items-center gap-1.5">
                        <Phone size={12} /> Follow-Up Tasks ({results.followUps.length})
                      </span>
                    </div>
                    {results.followUps.slice(0, 3).map((item) => (
                      <SearchResultRow 
                        key={`fol_${item.id}`} 
                        item={item} 
                        onClick={() => handleItemClick(item)} 
                      />
                    ))}
                  </div>
                )}

              </div>
            )}

            {/* Bottom Bar: View all results */}
            {results.total > 0 && (
              <div 
                onClick={handleViewAll}
                className="px-4 py-3 bg-stone-50 hover:bg-orange-50/80 border-t border-stone-100 flex items-center justify-between cursor-pointer transition-colors text-xs font-bold text-[#EA580C]"
              >
                <span>View all {results.total} results for "{query}"</span>
                <span className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                  Full Search Page →
                </span>
              </div>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Subcomponent: Individual result row
function SearchResultRow({ item, onClick }: { item: SearchResultItem; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="px-4 py-2.5 flex items-center justify-between cursor-pointer hover:bg-orange-50/50 transition-colors group text-left"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-xl bg-stone-100 border border-stone-200 flex items-center justify-center font-extrabold text-slate-700 text-[11px] shrink-0 group-hover:bg-[#EA580C] group-hover:text-white group-hover:border-[#EA580C] transition-all">
          {item.avatarText || 'WG'}
        </div>

        {/* Title + Subtitle */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-900 truncate group-hover:text-[#EA580C] transition-colors">
              {item.title}
            </span>
            {item.phone && (
              <span className="text-[10.5px] font-medium text-slate-400 shrink-0">
                {item.phone}
              </span>
            )}
          </div>
          <p className="text-[11px] font-semibold text-slate-500 truncate">
            {item.subtitle}
          </p>
        </div>
      </div>

      {/* Right Action & Status */}
      <div className="flex items-center gap-2.5 shrink-0 ml-2">
        {item.status && (
          <span className={`text-[9.5px] font-bold px-2 py-0.5 rounded-md border ${item.statusClass || 'bg-stone-100 text-slate-700'}`}>
            {item.status}
          </span>
        )}
        <span className="text-[11px] font-bold text-[#EA580C] opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
          Open →
        </span>
      </div>
    </div>
  );
}
