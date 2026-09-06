/**
 * staff.service.ts
 * ─────────────────────────────────────────────────────────────────
 * Unified Staff & Trainer Master Directory Architecture
 *
 * Core Principles:
 *  1. Employee is the MASTER staff/person record.
 *  2. Trainer is a ROLE / CAPABILITY of an Employee (role = "TRAINER").
 *  3. Stable identity: employeeId / biometricId / docId.
 *  4. Single source of truth with bidirectional sync between
 *     `employees` and `trainers` collections.
 *  5. Never duplicates person records.
 *  6. Soft-delete support (isDeleted, deletedAt).
 * ─────────────────────────────────────────────────────────────────
 */

import API from './api';
import { db } from '@/lib/firebase';
import { collection, doc, getDocs, setDoc, updateDoc, deleteDoc, query, addDoc } from 'firebase/firestore';

export interface UnifiedStaff {
  id: string;
  employeeId: string;
  biometricId: number | string;
  name: string;
  phone: string;
  email: string;
  address?: string;
  branch?: string;
  role: string;
  specialization?: string;
  experience?: number;
  rating?: number;
  salary?: number;
  status: 'Active' | 'Inactive' | string;
  todayStatus?: 'Present' | 'Absent' | string;
  currentStatus?: 'Inside' | 'Outside' | string;
  lastPunch?: string | null;
  photo?: string;
  profilePhotoUrl?: string;
  avatarUrl?: string;
  gender?: string;
  bio?: string;
  joiningDate?: string;
  instagram?: string;
  achievements?: string;
  certifications?: string[];
  assignedMembers?: string[];
  isDeleted?: boolean;
  deletedAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export const BASELINE_MANAGER: UnifiedStaff = {
  id: 'emp_manager_001',
  employeeId: 'TWG-EMP-0001',
  biometricId: 10001,
  name: 'Manager',
  phone: '9876543210',
  email: 'manager@thewarriorgym.in',
  address: 'The Warrior Gym Headquarters',
  branch: 'The Warrior Gym',
  role: 'MANAGER',
  specialization: 'General Manager',
  status: 'Active',
  todayStatus: 'Present',
  currentStatus: 'Inside',
  experience: 5,
  joiningDate: '2026-01-01',
  isDeleted: false
};

export const BASELINE_REAL_TRAINERS: UnifiedStaff[] = [];

class StaffDirectoryService {
  private hasReconciled = false;

  /**
   * Helper: Normalize clean phone number (last 10 digits)
   */
  private cleanPhone(phone?: string): string {
    if (!phone) return '';
    return phone.replace(/\D/g, '').slice(-10);
  }

  /**
   * Helper: Checks if record is a fake demo record that must be pruned
   */
  private isFakeStaff(item: any): boolean {
    const name = String(item.name || '').trim().toLowerCase();
    const phone = this.cleanPhone(item.phone);
    const bioId = String(item.biometricId || '').trim();
    const id = String(item.id || '').trim();

    if (name.includes('ramesh kumar') || name.includes('priya singh')) return true;
    if (bioId === '501' || bioId === '504') return true;
    if (id === 'emp_501' || id === 'emp_504') return true;
    if (phone === '9876543210' || phone === '9877407661') return true;
    return false;
  }

  /**
   * Helper: Generate stable key for deduplication
   */
  public getStaffKey(item: any): string {
    if (item.biometricId && String(item.biometricId).trim() !== '') {
      return `bio_${String(item.biometricId).trim()}`;
    }
    if (item.employeeId && String(item.employeeId).trim() !== '') {
      return `empid_${String(item.employeeId).trim().toUpperCase()}`;
    }
    const cp = this.cleanPhone(item.phone);
    if (cp) {
      return `phone_${cp}`;
    }
    return `id_${item.id}`;
  }

  /**
   * Master Reconciliation: Idempotently ensures real master staff records
   * are synced to Firestore 'employees' collection, and prunes any fake accounts.
   */
  async reconcileStaffAndTrainers(): Promise<void> {
    if (this.hasReconciled) return;
    this.hasReconciled = true;

    try {
      const snap = await getDocs(collection(db, 'employees'));
      const existingDocKeys = new Set<string>();

      for (const docSnap of snap.docs) {
        const d = docSnap.data();
        if (this.isFakeStaff({ id: docSnap.id, ...d })) {
          // Permanently delete fake accounts from Firestore
          await deleteDoc(doc(db, 'employees', docSnap.id)).catch(() => {});
          continue;
        }

        const key = this.getStaffKey({ id: docSnap.id, ...d });
        existingDocKeys.add(key);
      }

      // Ensure baseline Manager account exists in Firestore
      const mgrKey = this.getStaffKey(BASELINE_MANAGER);
      if (!existingDocKeys.has(mgrKey)) {
        const docRef = doc(db, 'employees', BASELINE_MANAGER.id);
        await setDoc(docRef, {
          ...BASELINE_MANAGER,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }).catch(() => {});
      }

      // Check baseline real trainers and write any missing records to Firestore
      for (const staff of BASELINE_REAL_TRAINERS) {
        const key = this.getStaffKey(staff);
        if (!existingDocKeys.has(key)) {
          const docRef = doc(db, 'employees', staff.id);
          await setDoc(docRef, {
            ...staff,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
      }
    } catch (err) {
      console.warn('[StaffService] Reconciliation sync notice:', err);
    }
  }

  /**
   * Master function: Get all staff members from employees & trainers collections
   * Unifies and deduplicates records into a single staff array (excluding fake demo accounts).
   */
  async getStaffDirectory(): Promise<UnifiedStaff[]> {
    // Run reconciliation in the background
    this.reconcileStaffAndTrainers().catch(() => {});

    const directoryMap = new Map<string, UnifiedStaff>();

    const mgrKey = this.getStaffKey(BASELINE_MANAGER);
    directoryMap.set(mgrKey, { ...BASELINE_MANAGER });

    // 2. Fetch from /api/employees & Firestore 'employees' collection
    try {
      const snap = await getDocs(collection(db, 'employees'));
      snap.forEach(docSnap => {
        const d = docSnap.data();
        if (d.isDeleted === true || d.deletedAt) return;
        if (this.isFakeStaff({ id: docSnap.id, ...d })) return; // Exclude fake demo accounts

        const staffItem: UnifiedStaff = {
          id: docSnap.id,
          employeeId: d.employeeId || (d.biometricId ? `EMP-${d.biometricId}` : `EMP-${docSnap.id.slice(-4).toUpperCase()}`),
          biometricId: d.biometricId || d.biometricID || '',
          name: d.name || 'Unnamed Staff',
          phone: d.phone || '',
          email: d.email || '',
          address: d.address || '',
          branch: d.branch || 'The Warrior Gym',
          role: d.role || 'Staff',
          specialization: d.specialization || (String(d.role || '').toLowerCase().includes('trainer') ? 'Fitness Trainer' : ''),
          experience: Number(d.experience) || 0,
          rating: Number(d.rating) || 0,
          salary: Number(d.salary) || 0,
          status: (d.status === 'inactive' || d.status === 'Inactive') ? 'Inactive' : 'Active',
          todayStatus: d.todayStatus || 'Absent',
          currentStatus: d.currentStatus || 'Outside',
          lastPunch: d.lastPunch || null,
          photo: d.profilePhotoUrl || d.photo || d.photoURL || d.avatarUrl || '',
          profilePhotoUrl: d.profilePhotoUrl || d.photo || d.photoURL || d.avatarUrl || '',
          avatarUrl: d.avatarUrl || d.profilePhotoUrl || d.photo || '',
          bio: d.bio || '',
          joiningDate: d.joiningDate || d.createdAt?.split('T')[0] || '',
          instagram: d.instagram || '',
          achievements: d.achievements || '',
          certifications: Array.isArray(d.certifications) ? d.certifications : [],
          isDeleted: false,
          createdAt: d.createdAt,
          updatedAt: d.updatedAt
        };

        const key = this.getStaffKey(staffItem);
        directoryMap.set(key, staffItem);
      });
    } catch (err) {
      console.warn('[StaffService] Firestore employees fetch failed, checking API:', err);
      try {
        const res = await API.get('/employees');
        if (Array.isArray(res.data)) {
          res.data.forEach((d: any) => {
            if (d.isDeleted === true || d.deletedAt) return;
            if (this.isFakeStaff(d)) return;

            const staffItem: UnifiedStaff = {
              id: d.id,
              employeeId: d.employeeId || (d.biometricId ? `EMP-${d.biometricId}` : `EMP-${d.id}`),
              biometricId: d.biometricId || '',
              name: d.name || 'Unnamed Staff',
              phone: d.phone || '',
              email: d.email || '',
              address: d.address || '',
              branch: d.branch || 'The Warrior Gym',
              role: d.role || 'Staff',
              specialization: d.specialization || '',
              experience: Number(d.experience) || 0,
              salary: Number(d.salary) || 0,
              status: d.status || 'Active',
              todayStatus: d.todayStatus || 'Absent',
              currentStatus: d.currentStatus || 'Outside',
              lastPunch: d.lastPunch || null,
              photo: d.photo || d.profilePhotoUrl || '',
              isDeleted: false
            };
            const key = this.getStaffKey(staffItem);
            directoryMap.set(key, staffItem);
          });
        }
      } catch (apiErr) {
        console.warn('[StaffService] API employees fetch fallback failed:', apiErr);
      }
    }

    // 3. Fetch from Firestore 'trainers' collection to merge any standalone trainer records
    try {
      const snapTrainers = await getDocs(collection(db, 'trainers'));
      snapTrainers.forEach(docSnap => {
        const d = docSnap.data();
        if (d.isDeleted === true || d.deletedAt) return;
        if (this.isFakeStaff({ id: docSnap.id, ...d })) return;

        const key = this.getStaffKey({ id: docSnap.id, ...d });
        const existing = directoryMap.get(key);

        if (existing) {
          existing.role = 'Trainer';
          if (d.specialization) existing.specialization = d.specialization;
          if (d.experience) existing.experience = Number(d.experience);
          if (d.rating) existing.rating = Number(d.rating);
          if (d.salary && !existing.salary) existing.salary = Number(d.salary);
          if (d.photo && !existing.photo) {
            existing.photo = d.photo;
            existing.profilePhotoUrl = d.photo;
          }
          if (d.certifications && existing.certifications?.length === 0) {
            existing.certifications = d.certifications;
          }
          directoryMap.set(key, existing);
        } else {
          const newStaff: UnifiedStaff = {
            id: docSnap.id,
            employeeId: d.employeeId || (d.biometricId ? `EMP-${d.biometricId}` : `EMP-${docSnap.id.slice(-4).toUpperCase()}`),
            biometricId: d.biometricId || '',
            name: d.name || 'Unnamed Trainer',
            phone: d.phone || '',
            email: d.email || '',
            address: d.address || '',
            branch: d.branch || 'The Warrior Gym',
            role: 'Trainer',
            specialization: d.specialization || 'Fitness Trainer',
            experience: Number(d.experience) || 0,
            rating: Number(d.rating) || 0,
            salary: Number(d.salary) || 0,
            status: (d.status === 'inactive' || d.status === 'Inactive') ? 'Inactive' : 'Active',
            todayStatus: 'Absent',
            currentStatus: 'Outside',
            lastPunch: null,
            photo: d.profilePhotoUrl || d.photo || '',
            profilePhotoUrl: d.profilePhotoUrl || d.photo || '',
            bio: d.bio || '',
            joiningDate: d.joiningDate || d.createdAt?.split('T')[0] || '',
            isDeleted: false
          };
          directoryMap.set(key, newStaff);
        }
      });
    } catch (err) {
      console.warn('[StaffService] Firestore trainers fetch warning:', err);
    }

    return Array.from(directoryMap.values()).filter(item => !item.isDeleted && !this.isFakeStaff(item));
  }

  /**
   * Master function: Get all trainers from unified staff directory (Active & Inactive)
   */
  async getAllTrainers(): Promise<UnifiedStaff[]> {
    const allStaff = await this.getStaffDirectory();
    return allStaff.filter(staff => {
      const r = String(staff.role || '').trim().toLowerCase();
      return r.includes('trainer');
    });
  }

  /**
   * Master function: Get only ACTIVE trainers from unified staff directory
   * Used in Personal Trainer dropdowns across Member Onboarding & Member Edit.
   */
  async getActiveTrainers(): Promise<UnifiedStaff[]> {
    const allTrainers = await this.getAllTrainers();
    return allTrainers.filter(t => {
      const s = String(t.status || 'Active').toLowerCase();
      return s === 'active' || s === 'employed';
    });
  }

  /**
   * Create or Promote an Employee to Trainer
   */
  async saveTrainer(payload: {
    existingEmployeeId?: string;
    name: string;
    phone: string;
    email?: string;
    specialization: string;
    biometricId?: number | string;
    status: 'Active' | 'Inactive';
    address?: string;
    salary?: number;
    experience?: number;
    photo?: string;
  }): Promise<UnifiedStaff> {
    const bioId = payload.biometricId ? Number(payload.biometricId) : (10000 + Math.floor(Math.random() * 9000));
    const empId = `EMP-${bioId}`;

    const staffData: Partial<UnifiedStaff> = {
      employeeId: empId,
      name: payload.name.trim(),
      phone: payload.phone.trim().replace(/\D/g, ''),
      email: payload.email?.trim() || '',
      role: 'Trainer',
      specialization: payload.specialization || 'Fitness Trainer',
      biometricId: bioId,
      branch: 'The Warrior Gym',
      status: payload.status || 'Active',
      address: payload.address?.trim() || '',
      salary: Number(payload.salary) || 0,
      experience: Number(payload.experience) || 0,
      photo: payload.photo || '',
      profilePhotoUrl: payload.photo || '',
      avatarUrl: payload.photo || '',
      isDeleted: false,
      updatedAt: new Date().toISOString()
    };

    if (payload.existingEmployeeId) {
      // 1. Promote existing employee
      const docRef = doc(db, 'employees', payload.existingEmployeeId);
      await updateDoc(docRef, staffData);
      try {
        await API.put(`/employees/${payload.existingEmployeeId}`, staffData);
      } catch (e) {}
      return { id: payload.existingEmployeeId, ...staffData } as UnifiedStaff;
    } else {
      // 2. Create new master employee record
      staffData.createdAt = new Date().toISOString();
      const docRef = await addDoc(collection(db, 'employees'), staffData);
      try {
        await API.post('/employees', { id: docRef.id, ...staffData });
      } catch (e) {}
      return { id: docRef.id, ...staffData } as UnifiedStaff;
    }
  }

  /**
   * Deactivate or Remove Trainer Role (DOES NOT delete the master employee record)
   */
  async deactivateTrainerProfile(staffId: string): Promise<void> {
    try {
      const docRef = doc(db, 'employees', staffId);
      await updateDoc(docRef, {
        status: 'Inactive',
        updatedAt: new Date().toISOString()
      });
      try {
        await API.put(`/employees/${staffId}`, { status: 'Inactive' });
      } catch (e) {}
    } catch (err) {
      console.error('[StaffService] Failed to deactivate trainer profile:', err);
      throw err;
    }
  }

  /**
   * Soft-delete an Employee Permanently (Only from Employees Page)
   */
  async softDeleteEmployee(staffId: string): Promise<void> {
    const now = new Date().toISOString();
    try {
      const docRef = doc(db, 'employees', staffId);
      await updateDoc(docRef, {
        isDeleted: true,
        deletedAt: now,
        status: 'Inactive',
        updatedAt: now
      });
      try {
        await API.delete(`/employees/${staffId}`);
      } catch (e) {}
    } catch (err) {
      console.error('[StaffService] Soft delete employee failed:', err);
      throw err;
    }
  }
}

export const staffDirectoryService = new StaffDirectoryService();

// Standalone Helper functions for direct UI consumption:
export const getActiveTrainers = () => staffDirectoryService.getActiveTrainers();
export const getAllTrainers = () => staffDirectoryService.getAllTrainers();
export const getStaffDirectory = () => staffDirectoryService.getStaffDirectory();

export default staffDirectoryService;
