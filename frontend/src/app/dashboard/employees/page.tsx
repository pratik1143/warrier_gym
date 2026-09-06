'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, Search, Plus, Filter, UserCheck, Briefcase, 
  Trash2, Edit, X, Check, ArrowRight, UserPlus, Phone, 
  Mail, MapPin, Shield, Cpu, RefreshCw, Eye, Sparkles, Clock, AlertCircle,
  MoreHorizontal, Fingerprint, MessageSquare
} from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, addDoc, updateDoc, deleteDoc, where, getDocs } from 'firebase/firestore';
import { formatDate } from '@/lib/utils';
import { resolveAvatarUrl, normalizeStatus, MALE_DEFAULT_AVATAR, FEMALE_DEFAULT_AVATAR, AccountStatus } from '@/lib/avatar';
import API from '@/services/api';
import toast from '@/lib/toast';
import SmartPhotoCapture from '../components/SmartPhotoCapture';
import SendWhatsAppModal from '../components/SendWhatsAppModal';
import { z } from 'zod';
import staffDirectoryService, { BASELINE_MANAGER } from '@/services/staff.service';

function deduplicateAllEmployees(rawList: any[]) {
  const map = new Map<string, any>();
  rawList.forEach((e) => {
    const key = (e.phone && String(e.phone).trim().length >= 8)
      ? String(e.phone).trim()
      : (e.email && String(e.email).trim().length > 3)
      ? String(e.email).trim().toLowerCase()
      : (e.employeeId && !e.employeeId.includes('EMP-AUTO'))
      ? String(e.employeeId).trim()
      : String(e.id).trim();

    if (!map.has(key)) {
      map.set(key, e);
    } else {
      const existing = map.get(key);
      const existingEmpId = String(existing.employeeId || '');
      const newEmpId = String(e.employeeId || '');
      if (existingEmpId.includes('AUTO') && !newEmpId.includes('AUTO')) {
        map.set(key, e);
      }
    }
  });
  return Array.from(map.values());
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search (Branch filter removed from UI per specification)
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals & Drawers
  const [showAddWizard, setShowAddWizard] = useState(false);
  const [activeProfile, setActiveProfile] = useState<any | null>(null);
  const [editingEmployee, setEditingEmployee] = useState<any | null>(null);
  const [whatsAppModalEmployee, setWhatsAppModalEmployee] = useState<any | null>(null);

  // Actions Dropdown & Delete Confirmation Modal State
  const [actionsMenu, setActionsMenu] = useState<{ employee: any; rect: DOMRect } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<any | null>(null);
  const [deletingEmployee, setDeletingEmployee] = useState(false);

  // Close floating actions menu on outside click or scroll
  useEffect(() => {
    if (!actionsMenu) return;
    const handleClose = (e: MouseEvent | Event) => {
      const target = e.target as HTMLElement;
      if (target?.closest('.employee-actions-portal-menu')) return;
      setActionsMenu(null);
    };
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    window.addEventListener('mousedown', handleClose);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
      window.removeEventListener('mousedown', handleClose);
    };
  }, [actionsMenu]);

  // Deep-linking support from Universal Search (?id=...)
  useEffect(() => {
    if (typeof window === 'undefined' || employees.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get('id');
    if (targetId) {
      const match = employees.find(e => e.id === targetId || e.employeeId === targetId || String(e.biometricId) === targetId);
      if (match) {
        setActiveProfile(match);
      }
    }
  }, [employees]);

  // Fetch & Realtime Firestore listeners
  const fetchEmployeesList = async () => {
    try {
      const staffList = await staffDirectoryService.getStaffDirectory();
      if (staffList && staffList.length > 0) {
        setEmployees(staffList);
      }
    } catch (err) {
      console.error('Failed to fetch staff directory:', err);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchEmployeesList().finally(() => setLoading(false));

    const qEmp = query(collection(db, 'employees'));
    const unsubEmp = onSnapshot(qEmp, async () => {
      try {
        const staffList = await staffDirectoryService.getStaffDirectory();
        setEmployees(staffList);
      } catch (err) {
        console.warn('Staff directory refresh notice:', err);
      }
      setLoading(false);
    }, (err) => {
      console.error(err);
      setLoading(false);
    });

    const qAtt = query(collection(db, 'employeeAttendance'), orderBy('timestamp', 'desc'));
    const unsubAtt = onSnapshot(qAtt, (snap) => {
      setAttendance(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (err) => {
      console.error(err);
    });

    return () => {
      unsubEmp();
      unsubAtt();
    };
  }, []);

  const rawEmployeesList = employees && employees.length > 0 ? employees : [BASELINE_MANAGER];
  const activeEmployeesList = deduplicateAllEmployees(rawEmployeesList);

  // Stats
  const totalEmployees = activeEmployeesList.length;
  const presentToday = activeEmployeesList.filter(e => e.todayStatus === 'Present').length;
  const absentToday = Math.max(0, totalEmployees - presentToday);
  const currentlyInside = activeEmployeesList.filter(e => e.currentStatus === 'Inside').length;

  // Filter lists
  const filteredEmployees = activeEmployeesList.filter(e => {
    const matchesSearch = 
      e.name?.toLowerCase().includes(search.toLowerCase()) ||
      String(e.biometricId)?.includes(search) ||
      e.email?.toLowerCase().includes(search.toLowerCase()) ||
      e.phone?.includes(search);
    
    const matchesRole = roleFilter === 'all' || 
      (e.role && e.role.toLowerCase() === roleFilter.toLowerCase()) ||
      (e.role && roleFilter.toLowerCase() === 'trainer' && e.role.toLowerCase().includes('trainer'));
    
    const accStatus = normalizeStatus(e.status);
    
    let matchesStatus = true;
    if (statusFilter === 'Active') matchesStatus = accStatus === 'Active';
    else if (statusFilter === 'Inactive') matchesStatus = accStatus === 'Inactive';

    return matchesSearch && matchesRole && matchesStatus;
  });

  // Custom Delete Handler (API + Firestore + Local State)
  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingEmployee(true);
    const id = deleteTarget.id;
    try {
      try {
        await API.delete(`/employees/${id}`);
      } catch (apiErr) {
        console.warn('API delete employee failed, continuing direct Firestore delete:', apiErr);
      }
      try {
        await deleteDoc(doc(db, 'employees', id));
      } catch (fsErr) {
        console.warn('Firestore direct delete employee failed:', fsErr);
      }

      setEmployees(prev => prev.filter((e: any) => e.id !== id && e.biometricId !== id));
      toast.success('Employee deleted successfully.');
      setDeleteTarget(null);
      await fetchEmployeesList();
    } catch (err: any) {
      console.error('Failed to delete employee:', err);
      toast.error('Failed to delete employee: ' + (err.message || 'Unknown error'));
    } finally {
      setDeletingEmployee(false);
    }
  };

  // Toggle Active / Inactive Status
  const handleToggleStatus = async (emp: any) => {
    const current = normalizeStatus(emp.status);
    const nextStatus = current === 'Active' ? 'Inactive' : 'Active';
    try {
      if (emp.id) {
        await updateDoc(doc(db, 'employees', emp.id), {
          status: nextStatus,
          updatedAt: new Date().toISOString()
        });
      }
      try {
        await API.put(`/employees/${emp.id}`, { status: nextStatus });
      } catch (e) {}

      setEmployees(prev => prev.map(e => e.id === emp.id ? { ...e, status: nextStatus } : e));
      toast.success(`${emp.name} marked as ${nextStatus}`);
      fetchEmployeesList();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update status');
    }
  };

  const getRoleBadgeStyle = (role: string) => {
    const r = (role || '').toLowerCase();
    if (r.includes('manager')) return 'bg-indigo-50 text-indigo-700 border-indigo-200/60';
    if (r.includes('trainer')) return 'bg-[#FFF7ED] text-[#C2410C] border-orange-200/60';
    if (r.includes('reception')) return 'bg-emerald-50 text-emerald-700 border-emerald-200/60';
    if (r.includes('owner')) return 'bg-purple-50 text-purple-700 border-purple-200/60';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="space-y-6 pb-12 w-full text-slate-800 text-left font-sans">
      
      {/* Page Header */}
      <div className="bg-white rounded-3xl p-6 lg:p-8 border border-slate-100 shadow-[0_4px_25px_rgba(0,0,0,0.03)] flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3" />
        
        <div>
          <div className="flex items-center gap-2.5 mb-2">
            <span className="px-3 py-1 bg-gradient-to-r from-[#F97316] via-[#EA580C] to-[#C2410C] text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow-sm">
              Staff Management Engine
            </span>
            <span className="text-xs text-slate-400 font-mono font-bold">TWG-EMP-v4.0</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-slate-900 font-display">Staff & Employees</h1>
          <p className="text-xs text-slate-500 font-medium mt-1">Manage gym trainers, receptionists, cleaners, and security workspace roster.</p>
        </div>
        
        <button 
          onClick={() => setShowAddWizard(true)}
          className="px-6 py-3.5 bg-gradient-to-r from-[#EA580C] to-[#FB923C] hover:from-[#C2410C] hover:to-[#EA580C] text-white rounded-2xl text-xs font-black uppercase tracking-wider border-none cursor-pointer flex items-center justify-center gap-2 shadow-[0_10px_25px_rgba(234,88,12,0.25)] transition-all hover:scale-[1.02] active:scale-95 shrink-0"
        >
          <Plus size={16} /> Register New Employee
        </button>
      </div>

      {/* Summary Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Employees', value: totalEmployees, sub: 'Registered Staff', icon: Users },
          { label: 'Present Today', value: presentToday, sub: 'Checked In Today', icon: UserCheck },
          { label: 'Absent Today', value: absentToday, sub: 'Not Punched Yet', icon: AlertCircle },
          { label: 'Currently Inside', value: currentlyInside, sub: 'Active inside Gym', icon: Shield }
        ].map((stat, i) => (
          <div key={i} className="bg-white border border-[#FED7AA] rounded-3xl p-5 flex flex-col justify-between shadow-[0_4px_20px_rgba(234,88,12,0.03)] relative overflow-hidden group transition-all hover:border-[#EA580C] hover:shadow-md">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{stat.label}</span>
              <div className="p-2.5 rounded-2xl bg-[#FFF7ED] border border-[#FED7AA] text-[#EA580C]">
                <stat.icon size={16} />
              </div>
            </div>
            <div className="mt-4">
              <div className="text-3xl font-black text-[#10233f] leading-none font-mono tracking-tight">{stat.value}</div>
              <span className="text-[10px] font-bold text-slate-400 mt-1 block">{stat.sub}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar (Cleaned: All Roles & All Statuses, No All Branches) */}
      <div className="bg-white border border-[#FED7AA] rounded-3xl p-4 flex flex-wrap gap-4 items-center shadow-[0_4px_20px_rgba(234,88,12,0.02)]">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search staff by name, phone, email or biometric ID..."
            className="w-full text-xs bg-[#fdfdfd] border border-[#FED7AA] rounded-2xl pl-11 pr-4 py-3 focus:outline-none focus:border-[#EA580C] focus:bg-white transition-all text-[#10233f] font-semibold placeholder:text-slate-400"
          />
        </div>

        <div className="flex flex-wrap gap-2.5">
          <select 
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="text-xs bg-[#fdfdfd] border border-[#FED7AA] rounded-2xl px-4 py-3 text-[#10233f] focus:outline-none font-bold cursor-pointer hover:bg-white transition-all"
          >
            <option value="all">All Roles</option>
            {['Trainer', 'Reception', 'Manager', 'Owner', 'Cleaner', 'Security', 'Nutritionist', 'Sales', 'Custom'].map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select 
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-xs bg-[#fdfdfd] border border-[#FED7AA] rounded-2xl px-4 py-3 text-[#10233f] focus:outline-none font-bold cursor-pointer hover:bg-white transition-all"
          >
            <option value="all">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Redesigned Employee Table Grid (Members Table Visual Language) */}
      <div className="bg-white border border-[#FED7AA] rounded-3xl overflow-hidden shadow-[0_4px_25px_rgba(234,88,12,0.03)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs whitespace-nowrap">
            <thead className="bg-[#EA580C] text-[#fdfdfd] font-extrabold uppercase tracking-wider text-[9.5px] border-b border-[#C2410C]">
              <tr>
                <th className="px-5 py-4 w-[24%] text-[#fdfdfd]">Employee</th>
                <th className="px-5 py-4 w-[18%] text-[#fdfdfd]">Contact</th>
                <th className="px-5 py-4 w-[12%] text-[#fdfdfd]">Role</th>
                <th className="px-5 py-4 w-[12%] text-center text-[#fdfdfd]">Biometric ID</th>
                <th className="px-5 py-4 w-[12%] text-center text-[#fdfdfd]">Account Status</th>
                <th className="px-5 py-4 w-[12%] text-center text-[#fdfdfd]">Today's Status</th>
                <th className="px-5 py-4 w-[10%] text-[#fdfdfd]">Last Punch</th>
                <th className="px-5 py-4 w-[10%] text-right text-[#fdfdfd]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {filteredEmployees.map(emp => {
                const avatar = resolveAvatarUrl(emp);
                const isInside = emp.currentStatus === 'Inside';
                const accStatus = normalizeStatus(emp.status);
                
                return (
                  <tr key={emp.id} className="hover:bg-slate-50/60 transition-colors">
                    {/* 1. Merged Photo + Employee Column */}
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0">
                          <img 
                            src={avatar} 
                            onError={(e) => {
                              const target = e.currentTarget;
                              const g = String(emp.gender || '').trim().toLowerCase();
                              target.src = (g === 'female' || g === 'f') ? FEMALE_DEFAULT_AVATAR : MALE_DEFAULT_AVATAR;
                            }}
                            className="w-11 h-11 rounded-full bg-slate-100 border-2 border-white shadow-xs object-cover" 
                            alt={emp.name} 
                          />
                          <span 
                            className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${
                              isInside ? 'bg-emerald-500' : 'bg-slate-300'
                            }`}
                            title={isInside ? 'Currently Inside Gym' : 'Currently Outside'}
                          />
                        </div>
                        <div className="min-w-0">
                          <div className="font-extrabold text-slate-900 text-sm leading-tight truncate">{emp.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono font-bold mt-0.5">
                            EMP-{String(emp.biometricId || emp.employeeId || emp.id).slice(-6).toUpperCase()}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* 2. Contact Column (Phone + Email) */}
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-slate-800 text-xs flex items-center gap-1">
                        <span>📞</span> {emp.phone || '—'}
                      </div>
                      {emp.email && (
                        <div className="text-[11px] text-slate-400 font-medium truncate max-w-[200px] mt-0.5">
                          {emp.email}
                        </div>
                      )}
                    </td>

                    {/* 3. Role */}
                    <td className="px-5 py-3.5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${getRoleBadgeStyle(emp.role)}`}>
                        {emp.role}
                      </span>
                    </td>

                    {/* 4. Biometric ID */}
                    <td className="px-5 py-3.5 text-center">
                      <span className="font-mono font-black text-slate-900 bg-slate-50 border border-slate-200/60 px-2.5 py-1 rounded-xl text-xs">
                        {emp.biometricId ? `#${emp.biometricId}` : '—'}
                      </span>
                    </td>

                    {/* 5. Account Status */}
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-black text-[9.5px] uppercase tracking-wider border ${
                        accStatus === 'Active'
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border-slate-200'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${accStatus === 'Active' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        {accStatus}
                      </span>
                    </td>

                    {/* 6. Today's Status */}
                    <td className="px-5 py-3.5 text-center">
                      <span className={`px-2.5 py-1 rounded-full font-black text-[9.5px] uppercase tracking-wider border ${
                        emp.todayStatus === 'Present' 
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200/60' 
                          : 'bg-rose-50 text-rose-600 border-rose-200/60'
                      }`}>
                        {emp.todayStatus || 'Absent'}
                      </span>
                    </td>

                    {/* 7. Last Punch */}
                    <td className="px-5 py-3.5 text-slate-500 font-semibold font-mono text-[11px]">
                      {emp.lastPunch ? new Date(emp.lastPunch).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Never'}
                    </td>

                    {/* 8. Single Actions Button (Members Page Style) */}
                    <td className="px-5 py-3.5 text-right">
                      <button 
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const rect = e.currentTarget.getBoundingClientRect();
                          setActionsMenu({ employee: emp, rect });
                        }}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-[#FFF7ED] hover:text-[#EA580C] hover:border-[#FED7AA] text-slate-700 text-xs font-black uppercase tracking-wider transition-all border border-slate-200 cursor-pointer shadow-2xs active:scale-95"
                        title="Employee Actions"
                      >
                        <MoreHorizontal size={14} />
                        <span>Actions</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
              {filteredEmployees.length === 0 && (
                <tr>
                  <td colSpan={8} className="text-center py-16 text-slate-400 italic">
                    <div className="max-w-xs mx-auto text-center space-y-2">
                      <Users size={32} className="mx-auto text-slate-300" />
                      <p className="font-bold text-slate-600 text-sm">No employees match your filter</p>
                      <p className="text-xs text-slate-400">Try adjusting your search criteria or register a new staff member.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Floating Actions Portal Dropdown (Never Clipped by Table Container) */}
      {actionsMenu && typeof document !== 'undefined' && createPortal(
        <div
          className="employee-actions-portal-menu fixed z-[99999] bg-white border border-slate-200 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.18)] py-1.5 w-52 text-left text-xs font-semibold text-slate-800 animate-in fade-in select-none"
          style={{
            top: (window.innerHeight - actionsMenu.rect.bottom < 260)
              ? Math.max(10, actionsMenu.rect.top - 250)
              : actionsMenu.rect.bottom + 4,
            left: Math.max(10, Math.min(window.innerWidth - 220, actionsMenu.rect.right - 195)),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* View Profile */}
          <button
            type="button"
            onClick={() => {
              const emp = actionsMenu.employee;
              setActionsMenu(null);
              setActiveProfile(emp);
            }}
            className="w-full px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-700 transition-colors font-bold"
          >
            <Eye size={14} className="text-slate-500" />
            <span>View Profile</span>
          </button>

          {/* Edit Employee */}
          <button
            type="button"
            onClick={() => {
              const emp = actionsMenu.employee;
              setActionsMenu(null);
              setEditingEmployee(emp);
            }}
            className="w-full px-3.5 py-2 hover:bg-orange-50 hover:text-[#C2410C] flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-700 transition-colors font-bold"
          >
            <Edit size={14} className="text-[#EA580C]" />
            <span>Edit Employee</span>
          </button>

          {/* Attendance Log */}
          <button
            type="button"
            onClick={() => {
              const emp = actionsMenu.employee;
              setActionsMenu(null);
              setActiveProfile(emp);
            }}
            className="w-full px-3.5 py-2 hover:bg-indigo-50 hover:text-indigo-700 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-700 transition-colors font-bold"
          >
            <Clock size={14} className="text-indigo-600" />
            <span>Attendance History</span>
          </button>

          {/* Call Staff */}
          <button
            type="button"
            onClick={() => {
              const emp = actionsMenu.employee;
              setActionsMenu(null);
              if (emp.phone) window.open(`tel:${emp.phone}`);
              else toast.error('No phone number recorded');
            }}
            className="w-full px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-700 transition-colors font-bold"
          >
            <Phone size={14} className="text-slate-500" />
            <span>Call Staff</span>
          </button>

          {/* WhatsApp */}
          <button
            type="button"
            onClick={() => {
              const emp = actionsMenu.employee;
              setActionsMenu(null);
              setWhatsAppModalEmployee(emp);
            }}
            className="w-full px-3.5 py-2 hover:bg-emerald-50 hover:text-emerald-700 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-700 transition-colors font-bold"
          >
            <MessageSquare size={14} className="text-emerald-600" />
            <span>WhatsApp Message</span>
          </button>

          {/* Change / Toggle Status */}
          <button
            type="button"
            onClick={() => {
              const emp = actionsMenu.employee;
              setActionsMenu(null);
              handleToggleStatus(emp);
            }}
            className="w-full px-3.5 py-2 hover:bg-amber-50 hover:text-amber-700 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-700 transition-colors font-bold"
          >
            <Shield size={14} className="text-amber-600" />
            <span>{normalizeStatus(actionsMenu.employee.status) === 'Active' ? 'Deactivate Employee' : 'Activate Employee'}</span>
          </button>

          {/* Manage Biometric */}
          <button
            type="button"
            onClick={() => {
              const emp = actionsMenu.employee;
              setActionsMenu(null);
              setEditingEmployee(emp);
            }}
            className="w-full px-3.5 py-2 hover:bg-slate-50 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-slate-700 transition-colors font-bold"
          >
            <Fingerprint size={14} className="text-slate-500" />
            <span>Biometric Setup</span>
          </button>

          <div className="h-px bg-slate-100 my-1" />

          {/* Delete Employee (Destructive) */}
          <button
            type="button"
            onClick={() => {
              const emp = actionsMenu.employee;
              setActionsMenu(null);
              setDeleteTarget(emp);
            }}
            className="w-full px-3.5 py-2 hover:bg-rose-50 flex items-center gap-2.5 text-left border-none bg-transparent cursor-pointer text-rose-600 transition-colors font-bold"
          >
            <Trash2 size={14} className="text-rose-600" />
            <span>Delete Employee</span>
          </button>
        </div>,
        document.body
      )}

      {/* Custom Delete Confirmation Modal (NO window.confirm) */}
      <AnimatePresence>
        {deleteTarget && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-slate-900 relative space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center text-rose-600 shrink-0">
                  <Trash2 size={22} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-lg">Delete Employee?</h3>
                  <p className="text-xs text-slate-400 font-medium">This action cannot be undone.</p>
                </div>
              </div>

              <div className="bg-rose-50/50 border border-rose-100 rounded-2xl p-4 text-xs font-semibold text-rose-800 space-y-1.5">
                <p>
                  You are about to permanently remove <span className="font-black text-rose-950 font-sans">"{deleteTarget.name}"</span> from the staff directory.
                </p>
                <p className="text-[11px] text-rose-700 font-normal">
                  If this employee is a trainer, their trainer profile and trainer assignments will also be affected.
                </p>
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deletingEmployee}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingEmployee}
                  onClick={handleConfirmDelete}
                  className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs cursor-pointer disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5 border-none shadow-sm"
                >
                  {deletingEmployee ? (
                    <><RefreshCw size={13} className="animate-spin" /> Deleting...</>
                  ) : (
                    <><Trash2 size={13} /> Delete Employee</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Employee wizard popup */}
      {showAddWizard && <AddEmployeeWizard onClose={() => setShowAddWizard(false)} onSuccess={fetchEmployeesList} />}

      {/* Edit Employee popup */}
      {editingEmployee && <EditEmployeeModal employee={editingEmployee} onClose={() => setEditingEmployee(null)} onSuccess={fetchEmployeesList} />}

      {/* Profile Drawer */}
      <AnimatePresence>
        {activeProfile && (
          <EmployeeProfileDrawer 
            employee={activeProfile} 
            attendance={attendance.filter(a => a.employeeId === activeProfile.id)}
            onClose={() => setActiveProfile(null)} 
            onWhatsApp={(emp) => {
              setWhatsAppModalEmployee(emp);
              setActiveProfile(null);
            }}
          />
        )}
      </AnimatePresence>

      <SendWhatsAppModal
        isOpen={!!whatsAppModalEmployee}
        onClose={() => setWhatsAppModalEmployee(null)}
        phone={whatsAppModalEmployee?.phone || ''}
        memberName={whatsAppModalEmployee?.name || ''}
        plan="Staff"
        expiryDate="N/A"
        trainer="N/A"
      />

    </div>
  );
}

// ─── ADD EMPLOYEE WIZARD COMPONENT ───
const employeeValidationSchema = z.object({
  name: z.string().trim().min(2, 'Full name must be at least 2 characters'),
  phone: z.string().trim().regex(/^[0-9+\s-]{10,15}$/, 'Enter valid phone number (at least 10 digits)'),
  email: z.string().trim().email('Enter valid email address'),
  role: z.string().min(1, 'Role is required'),
  branch: z.string().min(1, 'Branch location is required'),
  emergencyContact: z.string().trim().optional().refine(val => !val || /^[0-9+\s-]{10,15}$/.test(val), {
    message: 'Emergency contact must be valid phone number'
  }),
});

function AddEmployeeWizard({ onClose, onSuccess }: { onClose: () => void; onSuccess?: () => void }) {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Form Fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Reception');
  const [branch, setBranch] = useState('Mohali, Punjab');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [address, setAddress] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');

  // Trainer Specific Fields
  const [specialization, setSpecialization] = useState('Personal Trainer & Strength');
  const [experience, setExperience] = useState('3 Years');
  const [certifications, setCertifications] = useState('ACE Certified, CPR');
  const [bio, setBio] = useState('');

  // Biometric details
  const [device, setDevice] = useState('Hikvision DS-K1T320EFWX');
  const [biometricIdType, setBiometricIdType] = useState<'auto' | 'manual'>('auto');
  const [manualBiometricId, setManualBiometricId] = useState('');
  const [enrollStatus, setEnrollStatus] = useState<'idle' | 'scanning' | 'success'>('idle');

  const validateForm = () => {
    if (role === 'Trainer') {
      toast.error('Please register trainers from the dedicated Trainers module.');
      return false;
    }
    const res = employeeValidationSchema.safeParse({
      name,
      phone,
      email,
      role,
      branch,
      emergencyContact,
    });

    if (!res.success) {
      const fieldErrors: Record<string, string> = {};
      res.error.issues.forEach((err: z.ZodIssue) => {
        if (err.path[0]) fieldErrors[err.path[0] as string] = err.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleNext = () => {
    if (validateForm()) {
      setStep(2);
    } else {
      toast.error('Please fix errors highlighted in red');
    }
  };

  const handleEnrollFingerprint = () => {
    setEnrollStatus('scanning');
    setTimeout(() => {
      setEnrollStatus('success');
      toast.success('Fingerprint enrolled successfully!');
    }, 2500);
  };

  const handleSubmit = async () => {
    if (step === 1 && !validateForm()) return;
    setSubmitting(true);
    try {
      const payload = {
        name,
        phone,
        email,
        role,
        type: role.toLowerCase(),
        branch,
        emergencyContact,
        address,
        avatarUrl,
        device,
        specialization: role === 'Trainer' ? specialization : '',
        experience: role === 'Trainer' ? experience : '',
        certifications: role === 'Trainer' ? certifications : '',
        bio: role === 'Trainer' ? bio : '',
        biometricId: biometricIdType === 'auto' ? 'auto' : manualBiometricId,
        deviceUserId: biometricIdType === 'auto' ? '' : manualBiometricId,
        todayStatus: 'Absent',
        currentStatus: 'Outside',
        lastPunch: null
      };

      let existingDocId: string | null = null;
      try {
        if (phone) {
          const qPhone = query(collection(db, 'employees'), where('phone', '==', phone));
          const snapPhone = await getDocs(qPhone);
          if (!snapPhone.empty) existingDocId = snapPhone.docs[0].id;
        }
        if (!existingDocId && email) {
          const qEmail = query(collection(db, 'employees'), where('email', '==', email));
          const snapEmail = await getDocs(qEmail);
          if (!snapEmail.empty) existingDocId = snapEmail.docs[0].id;
        }
      } catch (checkErr) {
        console.warn('Error checking existing employee doc:', checkErr);
      }

      try {
        await API.post('/employees', payload);
      } catch (apiErr) {
        console.warn('API employee creation failed:', apiErr);
      }

      try {
        if (existingDocId) {
          await updateDoc(doc(db, 'employees', existingDocId), {
            ...payload,
            updatedAt: new Date().toISOString()
          });
        } else {
          await addDoc(collection(db, 'employees'), {
            ...payload,
            createdAt: new Date().toISOString()
          });
        }
      } catch (fsErr) {
        console.warn('Direct Firestore employee save failed:', fsErr);
      }

      toast.success(existingDocId ? 'Employee updated successfully!' : 'Employee created successfully!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to register employee');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fade-in" onClick={onClose} />
      
      <div className="relative w-full max-w-lg bg-white rounded-3xl z-10 shadow-[0_30px_70px_rgba(0,0,0,0.12)] overflow-hidden border border-slate-100 flex flex-col max-h-[85vh] text-slate-800 text-left font-display">
        {/* Top Accent bar */}
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 to-[#d4ff00] shrink-0" />

        {/* Close button */}
        <button onClick={onClose} className="absolute top-4 right-4 w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-250 flex items-center justify-center cursor-pointer z-20">
          <X size={12} />
        </button>

        {/* Wizard Header */}
        <div className="p-5 sm:p-6 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex justify-between items-center pr-6">
            <div>
              <h3 className="font-black text-base text-slate-900 leading-none">Register Gym Employee</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">Step {step} of 2: {step === 1 ? 'Personal Profile' : 'Biometric Link'}</p>
            </div>
            {/* Progress indicators */}
            <div className="flex gap-1.5">
              <span className={`w-4 h-1.5 rounded-full ${step >= 1 ? 'bg-[#EA580C]' : 'bg-slate-200'}`} />
              <span className={`w-4 h-1.5 rounded-full ${step >= 2 ? 'bg-[#EA580C]' : 'bg-slate-200'}`} />
            </div>
          </div>
        </div>

        {/* Scrollable Wizard content */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 custom-scrollbar">
          {step === 1 ? (
            <div className="space-y-4 text-xs font-semibold">
              <div className="w-full">
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Employee Photo</label>
                <SmartPhotoCapture 
                  value={avatarUrl || undefined}
                  onCaptureComplete={(urls) => {
                    setAvatarUrl(urls.photoURL);
                  }}
                  label="Employee"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Full Name *</label>
                  <input 
                    type="text" 
                    placeholder="e.g. Ramesh Kumar" 
                    value={name}
                    onChange={e => {
                      setName(e.target.value);
                      if (errors.name) setErrors(prev => ({ ...prev, name: '' }));
                    }}
                    className={`w-full text-xs bg-slate-50 border rounded-xl px-3 py-2.5 focus:outline-none transition-all text-slate-800 font-medium ${
                      errors.name ? 'border-red-500 bg-red-50/20' : 'border-slate-200 focus:border-indigo-500 focus:bg-white'
                    }`}
                  />
                  {errors.name && (
                    <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle size={11} /> {errors.name}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Phone Number *</label>
                  <input 
                    type="tel" 
                    placeholder="e.g. 9876543210" 
                    value={phone}
                    onChange={e => {
                      setPhone(e.target.value);
                      if (errors.phone) setErrors(prev => ({ ...prev, phone: '' }));
                    }}
                    className={`w-full text-xs bg-slate-50 border rounded-xl px-3 py-2.5 focus:outline-none transition-all text-slate-800 font-medium ${
                      errors.phone ? 'border-red-500 bg-red-50/20' : 'border-slate-200 focus:border-indigo-500 focus:bg-white'
                    }`}
                  />
                  {errors.phone && (
                    <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle size={11} /> {errors.phone}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Email ID *</label>
                  <input 
                    type="email" 
                    placeholder="e.g. ramesh@thewarriorgym.in" 
                    value={email}
                    onChange={e => {
                      setEmail(e.target.value);
                      if (errors.email) setErrors(prev => ({ ...prev, email: '' }));
                    }}
                    className={`w-full text-xs bg-slate-50 border rounded-xl px-3 py-2.5 focus:outline-none transition-all text-slate-800 font-medium ${
                      errors.email ? 'border-red-500 bg-red-50/20' : 'border-slate-200 focus:border-indigo-500 focus:bg-white'
                    }`}
                  />
                  {errors.email && (
                    <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle size={11} /> {errors.email}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Role *</label>
                  <select 
                    value={role} 
                    onChange={e => setRole(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800 font-semibold cursor-pointer"
                  >
                    {['Reception', 'Manager', 'Accountant', 'Cleaner', 'Security', 'Staff', 'Other', 'Trainer'].map(r => (
                      <option key={r} value={r}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* TRAINER SEPARATION REDIRECT NOTICE */}
              {role === 'Trainer' && (
                <div className="bg-[#FFF7ED] border border-[#FED7AA] rounded-2xl p-4 space-y-2 text-blue-900">
                  <div className="flex items-center gap-2 text-xs font-black">
                    <Sparkles size={16} className="text-[#EA580C] shrink-0" />
                    <span>Trainers are managed from the Trainers Module</span>
                  </div>
                  <p className="text-[11px] text-[#C2410C] font-medium leading-relaxed">
                    To maintain clean records, create trainer profiles with specializations and client limits in the Trainers module. They will automatically sync to Employees.
                  </p>
                  <button
                    type="button"
                    onClick={() => { window.location.href = '/dashboard/trainers'; }}
                    className="mt-1 px-4 py-2 bg-[#EA580C] hover:bg-orange-700 text-white rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer shadow-sm transition-all"
                  >
                    <ArrowRight size={14} /> Go to Trainers Module
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Branch Location *</label>
                  <select 
                    value={branch} 
                    onChange={e => setBranch(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800 font-semibold cursor-pointer"
                  >
                    <option value="Mohali, Punjab">Mohali, Punjab</option>
                    <option value="Chandigarh">Chandigarh</option>
                    <option value="Panchkula">Panchkula</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Emergency Contact (Optional)</label>
                  <input 
                    type="tel" 
                    placeholder="e.g. +91 99999 88888" 
                    value={emergencyContact}
                    onChange={e => {
                      setEmergencyContact(e.target.value);
                      if (errors.emergencyContact) setErrors(prev => ({ ...prev, emergencyContact: '' }));
                    }}
                    className={`w-full text-xs bg-slate-50 border rounded-xl px-3 py-2.5 focus:outline-none transition-all text-slate-800 font-medium ${
                      errors.emergencyContact ? 'border-red-500 bg-red-50/20' : 'border-slate-200 focus:border-indigo-500 focus:bg-white'
                    }`}
                  />
                  {errors.emergencyContact && (
                    <p className="text-[10px] font-bold text-red-500 mt-1 flex items-center gap-1">
                      <AlertCircle size={11} /> {errors.emergencyContact}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Residential Address (Optional)</label>
                <input 
                  type="text" 
                  placeholder="e.g. H.No 1234, Phase 3B2, Mohali" 
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-800 font-medium"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-4 text-xs font-semibold">
              <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 space-y-3">
                <h4 className="text-[10px] font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Cpu size={13} className="text-[#EA580C] animate-pulse" /> Hikvision Biometric Integration
                </h4>
                <p className="text-[10px] text-slate-500 font-medium leading-relaxed">
                  Connect employee account directly to the physical biometric lock. Employees punch biometric ID to log attendance and unlock the gate.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Assign Device</label>
                  <select 
                    value={device} 
                    onChange={e => setDevice(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-800 font-semibold cursor-pointer"
                  >
                    <option value="Hikvision DS-K1T320EFWX">Hikvision DS-K1T320EFWX (Mohali Front Gate)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Biometric ID Assignment</label>
                  <div className="flex gap-2">
                    <button 
                      type="button" 
                      onClick={() => setBiometricIdType('auto')}
                      className={`flex-1 py-2 text-center rounded-xl border text-[10px] font-extrabold cursor-pointer transition-all ${biometricIdType === 'auto' ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100'}`}
                    >
                      Auto Generate
                    </button>
                    <button 
                      type="button" 
                      onClick={() => setBiometricIdType('manual')}
                      className={`flex-1 py-2 text-center rounded-xl border text-[10px] font-extrabold cursor-pointer transition-all ${biometricIdType === 'manual' ? 'bg-[#EA580C] text-white border-[#EA580C] shadow-xs' : 'bg-slate-50 border-slate-200 text-slate-650 hover:bg-slate-100'}`}
                    >
                      Manual ID
                    </button>
                  </div>
                </div>
              </div>

              {biometricIdType === 'manual' && (
                <div>
                  <label className="block text-[9px] font-black uppercase tracking-wider text-slate-500 mb-1">Biometric ID Number</label>
                  <input 
                    type="number" 
                    placeholder="Enter device user slot (e.g. 501)" 
                    value={manualBiometricId}
                    onChange={e => setManualBiometricId(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:bg-white transition-all text-slate-800 font-medium"
                  />
                </div>
              )}

              {/* Fingerprint Enrollment Simulation */}
              <div className="border border-slate-150 rounded-2xl p-4 flex justify-between items-center bg-slate-50/50">
                <div>
                  <h4 className="text-[10px] font-extrabold text-slate-800 uppercase tracking-wider">Enroll Fingerprint</h4>
                  <p className="text-[9px] text-slate-400 font-semibold mt-0.5">Initialize biometric hardware enrollment scan</p>
                </div>
                {enrollStatus === 'idle' && (
                  <button 
                    type="button" 
                    onClick={handleEnrollFingerprint}
                    className="px-3 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 border border-slate-300 rounded-xl text-[10px] font-bold cursor-pointer"
                  >
                    Start Scan
                  </button>
                )}
                {enrollStatus === 'scanning' && (
                  <div className="flex items-center gap-2 text-[10px] font-extrabold text-[#EA580C]">
                    <div className="w-4 h-4 border-2 border-[#EA580C] border-t-transparent rounded-full animate-spin" />
                    Scanning Finger...
                  </div>
                )}
                {enrollStatus === 'success' && (
                  <span className="text-[9px] font-black text-emerald-600 uppercase bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-full flex items-center gap-1">
                    ✓ Enrolled
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Fixed Wizard Footer */}
        <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
          {step === 1 ? (
            <>
              <button onClick={onClose} className="px-4 py-2 text-slate-500 hover:text-slate-700 text-xs font-black uppercase tracking-wider bg-transparent border-none cursor-pointer">Cancel</button>
              <button 
                onClick={handleNext}
                className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs font-black uppercase tracking-wider border-none cursor-pointer flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                Next Step <ArrowRight size={13} />
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setStep(1)} className="px-4 py-2 text-slate-600 hover:text-slate-800 text-xs font-black uppercase tracking-wider bg-transparent border-none cursor-pointer">Back</button>
              <div className="flex gap-2">
                <button 
                  onClick={handleSubmit}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider border border-slate-300 cursor-pointer"
                >
                  Skip Biometric
                </button>
                <button 
                  onClick={handleSubmit}
                  disabled={submitting}
                  className="px-5 py-2.5 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white rounded-xl text-xs font-black uppercase tracking-wider border-none cursor-pointer flex items-center gap-1 shadow-md shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Registering...' : 'Finish Registration'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── EDIT EMPLOYEE MODAL ───
function EditEmployeeModal({ employee, onClose, onSuccess }: { employee: any, onClose: () => void, onSuccess?: () => void }) {
  const [submitting, setSubmitting] = useState(false);

  // Form Fields
  const [name, setName] = useState(employee.name || '');
  const [gender, setGender] = useState(employee.gender || 'Male');
  const [phone, setPhone] = useState(employee.phone || '');
  const [email, setEmail] = useState(employee.email || '');
  const [role, setRole] = useState(employee.role || 'Trainer');
  const [department, setDepartment] = useState(employee.department || (String(employee.role).toLowerCase().includes('trainer') ? 'Fitness & Training' : 'Operations'));
  const [branch, setBranch] = useState(employee.branch || 'Mohali, Punjab');
  const [joiningDate, setJoiningDate] = useState(employee.joiningDate || employee.joinDate || '');
  const [salary, setSalary] = useState(employee.salary || employee.monthlySalary || '');
  const [status, setStatus] = useState<AccountStatus>(normalizeStatus(employee.status));
  const [emergencyContact, setEmergencyContact] = useState(employee.emergencyContact || '');
  const [address, setAddress] = useState(employee.address || '');
  const [biometricId, setBiometricId] = useState(employee.biometricId || '');
  const [avatarUrl, setAvatarUrl] = useState(employee.avatarUrl || employee.profilePhotoUrl || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const updates = {
        name,
        gender,
        phone,
        email,
        role,
        department,
        branch,
        joiningDate,
        salary: salary ? Number(salary) : 0,
        status: normalizeStatus(status),
        emergencyContact,
        address,
        biometricId: biometricId ? Number(biometricId) : 0,
        avatarUrl,
        profilePhotoUrl: avatarUrl || undefined,
        updatedAt: new Date().toISOString()
      };
      try {
        await API.put(`/employees/${employee.id}`, updates);
      } catch (apiErr) {
        console.warn('API update employee failed, trying direct Firestore:', apiErr);
      }
      try {
        await updateDoc(doc(db, 'employees', employee.id), updates);
      } catch (fsErr) {}

      toast.success('Employee profile updated successfully!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update employee');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      
      <form 
        onSubmit={handleSubmit} 
        className="relative w-full max-w-lg bg-white rounded-3xl z-10 shadow-[0_30px_70px_rgba(0,0,0,0.15)] overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] sm:max-h-[85vh] text-slate-800 text-left font-display"
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 to-[#d4ff00] shrink-0" />
        
        {/* Sticky Header */}
        <div className="sticky top-0 bg-white z-20 px-5 sm:px-6 py-4 border-b border-slate-100 shrink-0 flex items-center justify-between">
          <div>
            <h3 className="font-black text-sm text-slate-900 leading-tight">Edit Staff Profile</h3>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
              Update personal, role &amp; biometric records
            </p>
          </div>
          <button 
            type="button" 
            onClick={onClose} 
            className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-250 flex items-center justify-center cursor-pointer"
          >
            <X size={12} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs font-semibold custom-scrollbar">
          <div className="w-full">
            <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Staff Photo</label>
            <SmartPhotoCapture 
              value={avatarUrl || undefined}
              onCaptureComplete={(urls) => {
                setAvatarUrl(urls.photoURL);
              }}
              label="Employee"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1">Full Name *</label>
              <input 
                type="text" 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required 
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-700" 
              />
            </div>

            <div>
              <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1">Gender *</label>
              <select 
                value={gender} 
                onChange={e => setGender(e.target.value)} 
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none text-slate-700 font-semibold cursor-pointer"
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1">Phone Number *</label>
              <input 
                type="tel" 
                value={phone} 
                onChange={e => setPhone(e.target.value)} 
                required 
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-700" 
              />
            </div>
            <div>
              <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1">Email Address *</label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-700" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1">Role *</label>
              <select 
                value={role} 
                onChange={e => setRole(e.target.value)} 
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none text-slate-700 font-semibold cursor-pointer"
              >
                {['Trainer', 'Reception', 'Manager', 'Accountant', 'Cleaner', 'Security', 'Nutritionist', 'Sales', 'Staff', 'Other'].map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1">Department</label>
              <input 
                type="text" 
                value={department} 
                onChange={e => setDepartment(e.target.value)} 
                placeholder="e.g. Fitness & Training"
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-700" 
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1">Joining Date</label>
              <input 
                type="date" 
                value={joiningDate} 
                onChange={e => setJoiningDate(e.target.value)} 
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-700" 
              />
            </div>
            <div>
              <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1">Monthly Salary (₹)</label>
              <input 
                type="number" 
                value={salary} 
                onChange={e => setSalary(e.target.value)} 
                placeholder="₹ Amount"
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-700" 
              />
            </div>
            <div>
              <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1">Account Status</label>
              <select 
                value={status} 
                onChange={e => setStatus(normalizeStatus(e.target.value))} 
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none text-slate-700 font-semibold cursor-pointer"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1">Biometric ID *</label>
              <input 
                type="number" 
                value={biometricId} 
                onChange={e => setBiometricId(Number(e.target.value))} 
                required 
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:border-indigo-500 focus:bg-white text-slate-700" 
              />
            </div>
            <div>
              <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1">Branch Location</label>
              <select 
                value={branch} 
                onChange={e => setBranch(e.target.value)} 
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none text-slate-700 font-semibold cursor-pointer"
              >
                <option value="Mohali, Punjab">Mohali, Punjab</option>
                <option value="Chandigarh">Chandigarh</option>
                <option value="Panchkula">Panchkula</option>
                <option value="Main Branch">Main Branch</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1">Emergency Contact</label>
            <input 
              type="tel" 
              value={emergencyContact} 
              onChange={e => setEmergencyContact(e.target.value)} 
              placeholder="e.g. +91 99999 88888"
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none text-slate-700" 
            />
          </div>

          <div>
            <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400 mb-1">Residential Address</label>
            <input 
              type="text" 
              value={address} 
              onChange={e => setAddress(e.target.value)} 
              placeholder="Complete residential address"
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none text-slate-700" 
            />
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="sticky bottom-0 bg-slate-50 border-t border-slate-100 z-20 px-5 sm:px-6 py-4 flex justify-end items-center gap-3 shrink-0">
          <button 
            type="button" 
            onClick={onClose} 
            className="px-4 py-2.5 text-slate-500 hover:text-slate-700 text-xs font-black uppercase tracking-wider bg-transparent border-none cursor-pointer"
          >
            Cancel
          </button>
          <button 
            type="submit" 
            disabled={submitting} 
            className="px-5 py-2.5 bg-gradient-to-r from-[#FB923C] to-[#EA580C] hover:from-[#F97316] hover:to-[#C2410C] text-white rounded-xl text-xs font-black uppercase tracking-wider border-none cursor-pointer flex items-center gap-1 shadow-md shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50"
          >
            {submitting ? 'Saving...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── TRAINER PROFILE CARD COMPONENT ───
function TrainerProfileCard({ employee }: { employee: any }) {
  const [assignedMembers, setAssignedMembers] = useState<any[]>([]);
  const [ptPayments, setPtPayments] = useState<any[]>([]);

  const empId = employee.id || employee.employeeId;
  const empName = String(employee.name || '').trim().toLowerCase();

  useEffect(() => {
    const qMem = collection(db, 'members');
    const unsubMem = onSnapshot(qMem, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const assigned = list.filter((m: any) => {
        const mTrainerId = m.trainerId || m.ptTrainerId;
        const mTrainerName = String(m.trainerName || m.trainer || '').trim().toLowerCase();
        if (empId && mTrainerId === empId) return true;
        if (empName && mTrainerName === empName) return true;
        return false;
      });
      setAssignedMembers(assigned);
    });

    const qPay = query(collection(db, 'payments'), where('billingType', '==', 'pt'));
    const unsubPay = onSnapshot(qPay, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const trainerPt = list.filter((p: any) => {
        const pTrainerId = p.trainerId;
        const pTrainerName = String(p.trainerName || '').trim().toLowerCase();
        if (empId && pTrainerId === empId) return true;
        if (empName && pTrainerName === empName) return true;
        return false;
      });
      setPtPayments(trainerPt);
    });

    return () => {
      unsubMem();
      unsubPay();
    };
  }, [empId, empName]);

  const totalPtRevenue = ptPayments.reduce((s, p) => s + (Number(p.amountPaid || p.paid || 0)), 0);

  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthRevenue = ptPayments
    .filter(p => (p.date || p.createdAt || '').startsWith(currentMonthStr))
    .reduce((s, p) => s + (Number(p.amountPaid || p.paid || 0)), 0);

  const activePtClients = assignedMembers.filter(m => (m.ptHistory && m.ptHistory.length > 0) || (m.plan && String(m.plan).toLowerCase().includes('pt')));

  return (
    <div className="space-y-4 text-xs font-semibold bg-amber-50/60 border border-amber-200/80 rounded-3xl p-4">
      <div className="flex items-center justify-between">
        <h4 className="text-[10px] font-black text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
          <Sparkles size={13} className="text-amber-600" /> Personal Trainer Metrics
        </h4>
        <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-[9px] font-bold">
          {employee.specialization || 'PT Trainer'}
        </span>
      </div>

      {/* Professional Specs */}
      <div className="grid grid-cols-2 gap-2 text-[10px]">
        <div className="bg-white/80 p-2 rounded-xl border border-amber-100">
          <span className="text-slate-400 font-bold block">Experience</span>
          <span className="text-slate-800 font-black">{employee.experience || '3 Years'}</span>
        </div>
        <div className="bg-white/80 p-2 rounded-xl border border-amber-100">
          <span className="text-slate-400 font-bold block">Certifications</span>
          <span className="text-slate-800 font-black">{employee.certifications || 'ACE Certified'}</span>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-2 gap-2 font-mono">
        <div className="bg-white p-3 rounded-2xl border border-amber-200 shadow-sm">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Assigned Members</span>
          <span className="text-lg font-black text-slate-900">{assignedMembers.length}</span>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-amber-200 shadow-sm">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Active PT Clients</span>
          <span className="text-lg font-black text-indigo-600">{activePtClients.length}</span>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-amber-200 shadow-sm">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Total PT Revenue</span>
          <span className="text-sm font-black text-emerald-600">₹{totalPtRevenue.toLocaleString('en-IN')}</span>
        </div>
        <div className="bg-white p-3 rounded-2xl border border-amber-200 shadow-sm">
          <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">This Month PT</span>
          <span className="text-sm font-black text-amber-700">₹{currentMonthRevenue.toLocaleString('en-IN')}</span>
        </div>
      </div>

      {/* Assigned Members List */}
      <div>
        <span className="text-[10px] font-black text-amber-900 uppercase tracking-wider block mb-2">
          Assigned Gym Members ({assignedMembers.length})
        </span>
        <div className="max-h-40 overflow-y-auto space-y-1.5 custom-scrollbar">
          {assignedMembers.length === 0 ? (
            <div className="p-3 text-center text-slate-400 font-medium text-[11px] bg-white/60 rounded-xl">
              No members currently assigned to this trainer.
            </div>
          ) : (
            assignedMembers.map((m) => (
              <a
                key={m.id}
                href={`/dashboard/members/${m.id}`}
                className="flex items-center justify-between p-2 bg-white hover:bg-amber-100/50 rounded-xl border border-amber-100 transition-colors text-slate-800 no-underline"
              >
                <div>
                  <div className="font-bold text-xs">{m.name}</div>
                  <div className="text-[10px] text-slate-400 font-mono">Plan: {m.plan || 'Standard'}</div>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                    View Profile →
                  </span>
                </div>
              </a>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── EMPLOYEE PROFILE DRAWER COMPONENT ───
function EmployeeProfileDrawer({ employee, attendance, onClose, onWhatsApp }: { employee: any, attendance: any[], onClose: () => void, onWhatsApp?: (emp: any) => void }) {
  const avatar = resolveAvatarUrl(employee);

  return (
    <>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[45]" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white z-[50] shadow-2xl p-6 overflow-y-auto flex flex-col justify-between border-l border-slate-100 text-left"
      >
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-1.5">
              <Briefcase size={14} className="text-[#EA580C]" /> Employee Profile
            </h3>
            <button onClick={onClose} className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 border border-slate-250 flex items-center justify-center cursor-pointer">
              <X size={12} />
            </button>
          </div>

          {/* Profile Header Card */}
          <div className="flex gap-4 items-center bg-slate-50 border border-slate-100 rounded-3xl p-5">
            <img 
              src={avatar} 
              onError={(e) => {
                const target = e.currentTarget;
                const g = String(employee?.gender || '').trim().toLowerCase();
                target.src = (g === 'female' || g === 'f') ? FEMALE_DEFAULT_AVATAR : MALE_DEFAULT_AVATAR;
              }}
              className="w-14 h-14 rounded-full bg-white border border-slate-200 shadow-sm object-cover" 
              alt={employee.name} 
            />
            <div>
              <h4 className="text-base font-black text-slate-800 leading-tight">{employee.name}</h4>
              <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1 flex items-center gap-1.5">
                <span>{employee.role}</span>
                <span>·</span>
                <span className={`px-2 py-0.2 rounded-full font-black text-[9px] uppercase ${
                  normalizeStatus(employee.status) === 'Active' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {normalizeStatus(employee.status)}
                </span>
              </div>
              <div className="text-[9px] text-slate-500 mt-0.5 font-semibold">Biometric ID: <b className="text-slate-850 font-mono">{employee.biometricId || '—'}</b></div>
            </div>
          </div>

          {/* Personal Details */}
          <div className="space-y-3.5 text-xs">
            <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">Staff Contact Details</h4>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 font-semibold block text-[9.5px]">Phone Number</span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-slate-800 font-bold">{employee.phone}</span>
                  <button 
                    onClick={() => onWhatsApp?.(employee)}
                    className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg border border-slate-100 cursor-pointer"
                    title="Send WhatsApp"
                  >
                    <MessageSquare size={12} />
                  </button>
                </div>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[9.5px]">Email ID</span>
                <span className="text-slate-800 font-bold truncate block">{employee.email}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-slate-400 font-semibold block text-[9.5px]">Branch Location</span>
                <span className="text-slate-800 font-bold">{employee.branch}</span>
              </div>
              <div>
                <span className="text-slate-400 font-semibold block text-[9.5px]">Emergency Phone</span>
                <span className="text-slate-800 font-bold">{employee.emergencyContact || '—'}</span>
              </div>
            </div>

            <div>
              <span className="text-slate-400 font-semibold block text-[9.5px]">Residential Address</span>
              <span className="text-slate-800 font-bold">{employee.address || '—'}</span>
            </div>
          </div>

          {/* ── TRAINER PROFILE SECTION (For Trainer Employees) ── */}
          {(String(employee.role || '').toLowerCase().includes('trainer') || String(employee.type || '').toLowerCase().includes('trainer')) && (
            <TrainerProfileCard employee={employee} />
          )}

          {/* Today's Status Banner */}
          <div className="space-y-3.5 text-xs">
            <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">Today's Attendance Status</h4>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center">
              <div>
                <span className="text-slate-400 block text-[9px] font-bold">CURRENT STATUS</span>
                <span className="text-slate-800 font-black text-sm">{employee.currentStatus === 'Inside' ? 'Inside Gym' : 'Outside'}</span>
              </div>
              <span className={`px-2.5 py-1 rounded font-black text-[10px] uppercase tracking-wider border ${
                employee.todayStatus === 'Present' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100'
              }`}>
                {employee.todayStatus || 'Absent'}
              </span>
            </div>
          </div>

          {/* Biometric Punch History Logs */}
          <div className="space-y-3.5 text-xs">
            <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-400 border-b border-slate-100 pb-1">Punch Log Timeline</h4>
            <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
              {attendance.map((log: any, idx: number) => {
                const clockIn = log.checkIn ? new Date(log.checkIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '—';
                const clockOut = log.checkOut ? new Date(log.checkOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'Active Inside';
                
                return (
                  <div key={idx} className="border border-slate-100 rounded-xl p-3 bg-slate-50/50 flex justify-between items-center">
                    <div>
                      <div className="text-[10px] font-black text-slate-800">{new Date(log.timestamp).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</div>
                      <div className="text-[9px] text-slate-400 mt-0.5">Device: {log.deviceName || 'Front Gate'}</div>
                    </div>
                    <div className="text-right text-[10px] font-bold">
                      <div className="text-emerald-600 font-black">In: {clockIn}</div>
                      <div className="text-slate-500 font-black mt-0.5">Out: {clockOut}</div>
                    </div>
                  </div>
                );
              })}
              {attendance.length === 0 && (
                <div className="text-center py-6 text-slate-400 italic">No biometric logs logged for this employee.</div>
              )}
            </div>
          </div>
        </div>

        <button 
          onClick={onClose}
          className="w-full mt-6 py-2.5 bg-slate-900 hover:bg-black text-white text-xs font-black uppercase tracking-widest rounded-xl border-none cursor-pointer text-center"
        >
          Close Drawer
        </button>
      </motion.div>
    </>
  );
}
