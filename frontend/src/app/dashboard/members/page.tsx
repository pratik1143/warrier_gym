"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Plus,
  Filter,
  MoreHorizontal,
  Phone,
  Mail,
  RefreshCw,
  Download,
  Edit,
  Snowflake,
  X,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Camera,
  Calendar,
  User,
  Info,
  Ban,
  Key,
  Fingerprint,
  Scan,
  Wifi,
  WifiOff,
  Trash2,
  RotateCcw,
  Shield,
  Activity,
  Clock,
  CheckCheck,
  Cpu,
  Sparkles,
  Star,
  Trophy,
  Dumbbell,
  Zap,
  Upload
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useGymStore } from "@/store";
import {
  formatDate,
  getInitials,
  getRandomColor,
  formatCurrency,
} from "@/lib/utils";
import { membershipEngine } from '@/lib/engines/membershipEngine';
import toast from '@/lib/toast';
import {
  collection,
  doc,
  onSnapshot,
  getDocs,
  query,
  where,
  addDoc,
  setDoc,
} from "firebase/firestore";
import MembersKPI from "./components/MembersKPI";
import MembersTable from "./components/MembersTable";
import AddMemberModal from "./components/AddMemberModal";
import RenewalCenterModal from "./components/RenewalCenterModal";
import RenewalWizardModal from "./components/RenewalWizardModal";
import SmartPhotoCapture from "../components/SmartPhotoCapture";
import { db as fDb, isFirebaseReady } from "@/lib/firebase";
import API from "@/services/api";

const statusCfg = {
  active: { label: "Active", cls: "badge-green", dot: "#22C55E" },
  expiring: { label: "Expiring Soon", cls: "badge-yellow", dot: "#F59E0B" },
  expired: { label: "Expired", cls: "badge-red", dot: "#EF4444" },
  frozen: { label: "Frozen", cls: "badge-gray", dot: "#9CA3AF" },
};

const getPlanTheme = (planName: string) => {
  const name = (planName || "").toLowerCase();
  if (name.includes("monthly")) {
    return {
      color: "#3b82f6", // Indigo/Blue
      bg: "rgba(59,130,246,0.05)",
      border: "rgba(59,130,246,0.2)",
      textLight: "#eff6ff",
      textDark: "#1e3a8a",
    };
  }
  if (name.includes("quarterly")) {
    return {
      color: "#8b5cf6", // Violet
      bg: "rgba(139,92,246,0.05)",
      border: "rgba(139,92,246,0.2)",
      textLight: "#f5f3ff",
      textDark: "#4c1d95",
    };
  }
  if (name.includes("semi")) {
    return {
      color: "#10b981", // Emerald
      bg: "rgba(16,185,129,0.05)",
      border: "rgba(16,185,129,0.2)",
      textLight: "#ecfdf5",
      textDark: "#064e3b",
    };
  }
  // Annual or fallback
  return {
    color: "#f59e0b", // Gold/Amber
    bg: "rgba(245,158,11,0.05)",
    border: "rgba(245,158,11,0.25)",
    textLight: "#fef3c7",
    textDark: "#78350f",
  };
};

export default function MembersPage() {
  const router = useRouter();
  const {
    members: rawMembers,
    plans,
    fetchMembers,
    fetchPlans,
    addMember,
    updateMember,
    deleteMember,
    toggleFreeze,
    addPayment,
    resetPassword,
    sendCredentials,
  } = useGymStore();

  const members = useMemo(() => {
    const seenKeys = new Set<string>();
    const uniqueRaw = (rawMembers || []).filter((m: any) => {
      const key = m.clientId
        ? `cid_${String(m.clientId).trim()}`
        : (m.memberId && m.memberId !== 'TWG-2026-0000')
          ? `mid_${String(m.memberId).trim()}`
          : (m.id ? `id_${String(m.id).trim()}` : (m.phone ? `phone_${m.phone.replace(/\D/g, '')}` : `rnd_${Math.random()}`));
      if (seenKeys.has(key)) return false;
      seenKeys.add(key);
      return true;
    });

    return uniqueRaw.map((m: any) => {
      let expiryDate = typeof m.expiryDate === 'string' ? m.expiryDate : (m.expiryDate ? new Date(m.expiryDate).toISOString().split('T')[0] : '');
      const todayStr = new Date().toISOString().split('T')[0];
      const rawJoin = m.startDate || m.joinDate || m.createdAt;
      const joinStr = typeof rawJoin === 'string'
        ? (rawJoin.includes('T') ? rawJoin.split('T')[0] : rawJoin)
        : (rawJoin && typeof rawJoin === 'object' && typeof rawJoin.seconds === 'number'
            ? new Date(rawJoin.seconds * 1000).toISOString().split('T')[0]
            : todayStr);

      const daysLeft = membershipEngine.calculateDaysLeft(expiryDate);
      let derivedStatus = membershipEngine.calculateMembershipStatus(daysLeft, m.status).toLowerCase();
      // Merge expiring into active per user request
      if (derivedStatus === 'expiring soon' || derivedStatus === 'expiring') {
        derivedStatus = 'active';
      }
      return {
        ...m,
        expiryDate,
        daysLeft,
        status: derivedStatus
      };
    });
  }, [rawMembers, plans]);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showAddModal, setShowAddModal] = useState(false);
  const [activeProfile, setActiveProfile] = useState<any | null>(null);
  const [editingMember, setEditingMember] = useState<any | null>(null);
  const [addStep, setAddStep] = useState(1);
  const [newCreatedMember, setNewCreatedMember] = useState<any | null>(null);
  const [showRenewalCenter, setShowRenewalCenter] = useState(false);
  const [renewWizardMember, setRenewWizardMember] = useState<any | null>(null);

  // Delete Member modal state
  const [deleteMemberTarget, setDeleteMemberTarget] = useState<any | null>(null);
  const [deletingMember, setDeletingMember] = useState(false);

  // Form states for new member
  const [newName, setNewName] = useState("");
  const [newReferralCode, setNewReferralCode] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newGender, setNewGender] = useState("Male");
  const [newAge, setNewAge] = useState(25);
  const [newWeight, setNewWeight] = useState(70);
  const [newHeight, setNewHeight] = useState(172);
  const [newPlan, setNewPlan] = useState("Monthly");
  const [newBranch, setNewBranch] = useState("Mohali, Punjab");
  const [newTrainer, setNewTrainer] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [newPassword, setNewPassword] = useState("1234567");
  const [newBloodGroup, setNewBloodGroup] = useState("O+");
  const [newEmergencyContact, setNewEmergencyContact] = useState("");
  const [newMaritalStatus, setNewMaritalStatus] = useState("Single");
  const [newAnniversaryDate, setNewAnniversaryDate] = useState("");
  const [newBirthdayDate, setNewBirthdayDate] = useState("");
  const [newMedicalConditions, setNewMedicalConditions] = useState("");
  const [newFitnessGoal, setNewFitnessGoal] = useState("General Fitness");
  const [newOccupation, setNewOccupation] = useState("");
  const [newJoiningDate, setNewJoiningDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [newAvatarUrl, setNewAvatarUrl] = useState("");
  const [newBiometricId, setNewBiometricId] = useState("");

  const [trainers, setTrainers] = useState<any[]>([]);
  const [selectedTrainerForView, setSelectedTrainerForView] = useState<
    any | null
  >(null);

  useEffect(() => {
    API.get("/trainers")
      .then((res) => setTrainers(res.data))
      .catch((err) =>
        console.error("Failed to load trainers in members directory:", err),
      );
  }, []);

  useEffect(() => {
    fetchMembers();
    fetchPlans();
    if (typeof window !== 'undefined' && window.location.search.includes('action=add')) {
      setShowAddModal(true);
    }
  }, [fetchMembers, fetchPlans]);

  // ── Biometric Enrollment State ──────────────────────────────────────────────
  const [enrollModalOpen, setEnrollModalOpen] = useState(false);
  const [enrollAction, setEnrollAction] = useState<
    "fingerprint" | "face" | "sync" | "delete" | null
  >(null);
  const [enrollDocId, setEnrollDocId] = useState<string | null>(null);
  const [enrollStatus, setEnrollStatus] = useState<{
    status: string;
    message: string;
    scan: number;
    totalScans: number;
    biometricId?: string;
  }>({ status: "idle", message: "", scan: 0, totalScans: 3 });
  const [biometricProfile, setBiometricProfile] = useState<any>(null);
  const enrollUnsubRef = useRef<(() => void) | null>(null);

  // Load biometric profile when drawer opens OR during registration wizard Step 3
  useEffect(() => {
    const targetId =
      activeProfile?.id || (addStep >= 3 ? newCreatedMember?.id : null);
    if (!targetId || !isFirebaseReady || !fDb) {
      setBiometricProfile(null);
      return;
    }
    const profRef = doc(fDb, "biometric_profiles", targetId);
    const unsub = onSnapshot(profRef, (snap) => {
      setBiometricProfile(snap.exists() ? snap.data() : null);
    }, (error) => {
      console.warn("Biometric profiles snapshot error:", error.message);
    });
    return () => unsub();
  }, [activeProfile?.id, newCreatedMember?.id, addStep, isFirebaseReady]);

  // Listen to enrollment doc for live progress
  useEffect(() => {
    if (!enrollDocId || !isFirebaseReady || !fDb) return;
    if (enrollUnsubRef.current) enrollUnsubRef.current();
    const enrollRef = doc(fDb, "biometric_enrollment", enrollDocId);
    const unsub = onSnapshot(enrollRef, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data()!;
      setEnrollStatus({
        status: d.status || "pending",
        message: d.message || "",
        scan: d.scan || 0,
        totalScans: d.totalScans || 3,
        biometricId: d.biometricId,
      });
    }, (error) => {
      console.warn("Biometric enrollment snapshot error:", error.message);
    });
    enrollUnsubRef.current = unsub;
    return () => unsub();
  }, [enrollDocId, isFirebaseReady]);

  const openEnrollModal = (
    action: "fingerprint" | "face" | "sync" | "delete",
  ) => {
    setEnrollAction(action);
    setEnrollStatus({
      status: "idle",
      message: "Waiting to start...",
      scan: 0,
      totalScans: 3,
    });
    setEnrollDocId(null);
    setEnrollModalOpen(true);
  };

  const closeEnrollModal = () => {
    setEnrollModalOpen(false);
    setEnrollAction(null);
    setEnrollDocId(null);
    if (enrollUnsubRef.current) {
      enrollUnsubRef.current();
      enrollUnsubRef.current = null;
    }
  };

  const BACKEND_URL =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000/api";

  // Get Firebase ID token — always fresh from Firebase Auth
  const getToken = async (): Promise<string> => {
    if (typeof window === "undefined") return "";
    try {
      // 1. Try fresh token from active Firebase session (most reliable)
      const { auth } = await import("@/lib/firebase");
      if (auth.currentUser) {
        return await auth.currentUser.getIdToken();
      }
    } catch (e) {
      console.warn(
        "Firebase token fetch failed, falling back to localStorage",
        e,
      );
    }
    // 2. Fallback: stored token in warrior_gym_user (may be slightly old)
    try {
      const userJson = localStorage.getItem("warrior_gym_user");
      if (userJson) {
        const user = JSON.parse(userJson);
        return user.token || "";
      }
    } catch (e) {
      /* ignore */
    }
    return "";
  };

  const getActiveTarget = () => {
    return addStep >= 3 ? newCreatedMember : activeProfile;
  };

  const handleEnrollFingerprint = async () => {
    const target = getActiveTarget();
    if (!target) return;
    const biometricId =
      target.biometricId ||
      newBiometricId ||
      prompt("Enter Biometric ID (device slot number, e.g. 257):", "");
    if (!biometricId) return;

    if (addStep >= 3) {
      setNewBiometricId(biometricId);
    }

    if (addStep < 3) {
      openEnrollModal("fingerprint");
    } else {
      setEnrollAction("fingerprint");
      setEnrollStatus({
        status: "idle",
        message: "Waiting to start...",
        scan: 0,
        totalScans: 3,
      });
      setEnrollDocId(null);
    }

    try {
      const token = await getToken();
      const res = await fetch(
        `${BACKEND_URL}/devices/biometric/enroll-fingerprint`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            memberId: target.id,
            memberName: target.name,
            biometricId,
            fingerIndex: 0,
          }),
        },
      );
      const data = await res.json();
      if (data.enrollmentDocId) {
        setEnrollDocId(data.enrollmentDocId);
        // Update member biometric ID in store
        await updateMember(target.id, { biometricId });
        await fetchMembers();
        const fresh = useGymStore
          .getState()
          .members.find((m: any) => m.id === target.id);
        if (addStep >= 3) {
          setNewCreatedMember(fresh);
        } else {
          setActiveProfile(fresh);
        }
      } else {
        setEnrollStatus((s) => ({
          ...s,
          status: "failed",
          message: data.error || "Failed to queue enrollment",
        }));
      }
    } catch (e: any) {
      setEnrollStatus((s) => ({ ...s, status: "failed", message: e.message }));
    }
  };

  const handleEnrollFace = () => {
    openEnrollModal("face");
    setEnrollStatus({
      status: "info",
      message:
        "Face enrollment requires device firmware v6.60+. Check device manual for remote face enrollment support.",
      scan: 0,
      totalScans: 1,
    });
  };

  const handleSyncDevice = async () => {
    const target = getActiveTarget();
    if (!target) return;
    const biometricId =
      target.biometricId ||
      newBiometricId ||
      prompt("Enter Biometric ID to sync:", "");
    if (!biometricId) return;

    if (addStep < 3) {
      openEnrollModal("sync");
    } else {
      setEnrollAction("sync");
      setEnrollStatus({
        status: "idle",
        message: "Syncing with hardware...",
        scan: 0,
        totalScans: 1,
      });
      setEnrollDocId(null);
    }

    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/devices/biometric/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          memberId: target.id,
          memberName: target.name,
          biometricId,
        }),
      });
      const data = await res.json();
      if (data.enrollmentDocId) setEnrollDocId(data.enrollmentDocId);
    } catch (e: any) {
      setEnrollStatus((s) => ({ ...s, status: "failed", message: e.message }));
    }
  };

  const handleDeleteBiometric = async () => {
    const target = getActiveTarget();
    if (!target) return;
    const bioId = target.biometricId || newBiometricId;
    if (!bioId) {
      toast.error("No biometric ID linked to this member");
      return;
    }
    if (
      !confirm(
        `Delete biometric for ${target.name}? This will remove fingerprint from device.`,
      )
    )
      return;

    if (addStep < 3) {
      openEnrollModal("delete");
    } else {
      setEnrollAction("delete");
      setEnrollStatus({
        status: "idle",
        message: "Deleting fingerprint from hardware...",
        scan: 0,
        totalScans: 1,
      });
      setEnrollDocId(null);
    }

    try {
      const token = await getToken();
      const res = await fetch(`${BACKEND_URL}/devices/biometric/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          memberId: target.id,
          memberName: target.name,
          biometricId: bioId,
        }),
      });
      const data = await res.json();
      if (data.enrollmentDocId) setEnrollDocId(data.enrollmentDocId);
    } catch (e: any) {
      setEnrollStatus((s) => ({ ...s, status: "failed", message: e.message }));
    }
  };

  const handleImportDeviceUsers = async () => {
    if (addStep >= 3) {
      setEnrollAction("sync");
      setEnrollStatus({
        status: "pending",
        message: "Importing device users list...",
        scan: 0,
        totalScans: 1,
      });
    } else {
      openEnrollModal("sync");
    }
    try {
      const token = await getToken();
      await fetch(`${BACKEND_URL}/devices/testing/import-users`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (addStep >= 3) {
        setEnrollStatus({
          status: "success",
          message: "Device users roster import instruction sent successfully!",
          scan: 1,
          totalScans: 1,
        });
      }
      toast.success("Roster import instruction dispatched to device service!");
    } catch (e: any) {
      setEnrollStatus((s) => ({ ...s, status: "failed", message: e.message }));
    }
  };
  // ────────────────────────────────────────────────────────────────────────────

  const handleCreateMember = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newName || !newPhone) {
      toast.error("Name and Phone are required fields");
      return;
    }

    const joinDateStr = newJoiningDate || new Date().toISOString().split('T')[0];
    const expiry = membershipEngine.calculatePlanExpiryDate(newPlan, joinDateStr, plans);

    try {
      await addMember({
        name: newName,
        phone: newPhone,
        email: newEmail,
        gender: newGender,
        age: Number(newAge),
        weight: Number(newWeight),
        height: Number(newHeight),
        plan: newPlan,
        branch: newBranch,
        trainer: newTrainer,
        address: newAddress,
        password: newPassword,
        bloodGroup: newBloodGroup,
        emergencyContact: newEmergencyContact,
        maritalStatus: newMaritalStatus,
        anniversaryDate: newAnniversaryDate,
        birthdayDate: newBirthdayDate,
        medicalConditions: newMedicalConditions,
        fitnessGoal: newFitnessGoal,
        occupation: newOccupation,
        joinDate: newJoiningDate,
        avatarUrl: newAvatarUrl,
        expiryDate: expiry,
        biometricId: newBiometricId,
        paymentStatus: 'paid',
        paymentMethod: 'UPI',
      });

      // Fetch the newly created member from the store
      await fetchMembers();
      const freshMembers = useGymStore.getState().members;
      const newMember = freshMembers.find((m: any) => m.phone === newPhone);

      // Link referral code if provided
      if (newReferralCode && fDb && isFirebaseReady && newMember) {
        const refQuery = query(
          collection(fDb, "referrals"),
          where("friendPhone", "==", newPhone),
        );
        const refSnap = await getDocs(refQuery);

        if (!refSnap.empty) {
          // If invite was sent, update it to Registered/Purchased
          const refDoc = refSnap.docs[0];
          await setDoc(
            doc(fDb, "referrals", refDoc.id),
            {
              friendId: newMember.id,
              status: "Membership Purchased",
              currentStep: 4,
              joinPlan: newPlan,
              referralCode: newReferralCode,
              updatedAt: new Date().toISOString(),
            },
            { merge: true },
          );
        } else {
          // If no invite was sent, create a new referral document starting at step 4
          const referrerMember = freshMembers.find(
            (m: any) =>
              m.name.toUpperCase() + "2026" === newReferralCode.toUpperCase() ||
              (m.memberId &&
                m.memberId.toUpperCase() === newReferralCode.toUpperCase()),
          );
          await addDoc(collection(fDb, "referrals"), {
            referrerId: referrerMember ? referrerMember.id : "m1",
            referrerName: referrerMember ? referrerMember.name : "Pratik",
            referrerPhone: referrerMember ? referrerMember.phone || "" : "",
            friendId: newMember.id,
            friendName: newName,
            friendPhone: newPhone,
            referralCode: newReferralCode,
            status: "Membership Purchased",
            currentStep: 4,
            joinPlan: newPlan,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      if (newMember) {
        setNewCreatedMember(newMember);
        setAddStep(3); // Advance to Fingerprint enrollment workflow step
        toast.success(
          "Step 1 & 2 Complete: Profile registered & membership assigned!",
        );
      } else {
        toast.success("Member registered successfully!");
        setShowAddModal(false);
      }

      // Clear forms
      setNewName("");
      setNewPhone("");
      setNewEmail("");
      setNewAddress("");
      setNewPassword("1234567");
      setNewEmergencyContact("");
      setNewAnniversaryDate("");
      setNewBirthdayDate("");
      setNewMedicalConditions("");
      setNewOccupation("");
      setNewAvatarUrl("");
      setNewBiometricId("");
      setNewReferralCode("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add member");
    }
  };

  const handleEditSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;
    try {
      await updateMember(editingMember.id, {
        name: editingMember.name,
        phone: editingMember.phone,
        email: editingMember.email,
        plan: editingMember.plan,
        branch: editingMember.branch,
        trainer: editingMember.trainer,
        age: editingMember.age ? Number(editingMember.age) : null,
        gender: editingMember.gender || "Male",
        weight: editingMember.weight ? Number(editingMember.weight) : null,
        height: editingMember.height ? Number(editingMember.height) : null,
        address: editingMember.address || "",
        bloodGroup: editingMember.bloodGroup || "",
        emergencyContact: editingMember.emergencyContact || "",
        isPt: editingMember.isPt === true,
        expiryDate: editingMember.expiryDate || "",
        avatar: editingMember.avatar || null,
        avatarUrl: editingMember.avatar || null,
      });
      toast.success("Member updated successfully!");
      setEditingMember(null);
      fetchMembers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update member");
    }
  };

  const handleRenew = async (member: any) => {
    const renewAmountMap: Record<string, number> = {
      Monthly: 2500,
      Quarterly: 6500,
      "Semi-Annual": 11500,
      "Annual Premium": 18000,
    };
    const amt = renewAmountMap[member.plan] || 2500;

    try {
      await addPayment({
        memberId: member.id,
        amount: amt,
        plan: member.plan,
        method: "UPI",
      });
      toast.success(`Membership renewed for ${member.name}! extended expiry.`);
      if (activeProfile?.id === member.id) {
        // refresh selected profile drawer
        const updatedMembers = useGymStore.getState().members;
        const fresh = updatedMembers.find((m) => m.id === member.id);
        setActiveProfile(fresh || null);
      }
    } catch (err) {
      toast.error("Failed to renew plan");
    }
  };

  const handleToggleFreeze = async (member: any) => {
    try {
      await toggleFreeze(member.id);
      toast.success(`Membership status updated for ${member.name}`);
      // update active drawer
      const updatedMembers = useGymStore.getState().members;
      const fresh = updatedMembers.find((m) => m.id === member.id);
      setActiveProfile(fresh || null);
    } catch (err) {
      toast.error("Failed to toggle freeze status");
    }
  };

  const handleDeleteMember = (member: any) => {
    setDeleteMemberTarget(member);
    setActiveProfile(null);
  };

  const handleResetPassword = async (member: any) => {
    const newPass = prompt(`Enter new password for ${member.name}:`, "1234567");
    if (newPass === null) return;
    if (newPass.trim().length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    try {
      await resetPassword(member.id, newPass.trim());
      toast.success(`Password reset successfully for ${member.name}!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to reset password");
    }
  };

  const handleSendCredentials = async (member: any) => {
    try {
      await sendCredentials(member.id);
      toast.success(`Credentials dispatch triggered for ${member.name}!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send credentials");
    }
  };

  const filtered = members.filter((m) => {
    const ms =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.phone.includes(search);
    const st = statusFilter === "all" || m.status === statusFilter;
    return ms && st;
  });

  const counts = {
    all: members.length,
    active: members.filter((m) => m.status === "active").length,
    expiring: members.filter((m) => m.status === "expiring").length,
    expired: members.filter((m) => m.status === "expired").length,
    frozen: members.filter((m) => m.status === "frozen").length,
  };

  const handleExportCSV = () => {
    if (members.length === 0) {
      toast.error("No members to export");
      return;
    }
    const HEADERS = [
      "ID",
      "Name",
      "Phone",
      "Email",
      "Gender",
      "Age",
      "Plan",
      "Branch",
      "Trainer",
      "Status",
      "Join Date",
      "Expiry Date",
      "Address",
    ];
    const escape = (val: any) => String(val ?? "").replace(/"/g, '""');
    const rows = members.map((m: any) =>
      [
        escape(m.id),
        escape(m.name),
        escape(m.phone),
        escape(m.email),
        escape(m.gender),
        escape(m.age),
        escape(m.plan),
        escape(m.branch || "Mohali, Punjab"),
        escape(m.trainer),
        escape(m.status),
        escape(
          m.joinDate ? new Date(m.joinDate).toLocaleDateString("en-IN") : "",
        ),
        escape(
          m.expiryDate
            ? new Date(m.expiryDate).toLocaleDateString("en-IN")
            : "",
        ),
        escape((m.address || "").replace(/,/g, ";")),
      ]
        .map((v) => String('"') + v + String('"'))
        .join(","),
    );
    const csv = [HEADERS.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download =
      "warrior-gym-members-" + new Date().toISOString().split("T")[0] + ".csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Exported " + members.length + " members to CSV!");
  };

  const expiredMembers = members.filter(m => {
    if (m.status === 'blocked' || m.status === 'blacklisted') return false;
    return membershipEngine.calculateDaysLeft(m.expiryDate) < 0;
  });

  const urgentMembers = members.filter(m => {
    if (m.status === 'blocked' || m.status === 'blacklisted') return false;
    const days = membershipEngine.calculateDaysLeft(m.expiryDate);
    return days >= 0 && days <= 7;
  });

  return (
    <div className="space-y-6 pb-12 w-full text-slate-800 text-left">
      {/* Clean Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight font-display">
            Members
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage your gym members, track attendance, and monitor renewals.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            className="flex items-center gap-2 px-4 py-2.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all shadow-2xs cursor-pointer active:scale-95"
            onClick={() => router.push('/dashboard/import')}
          >
            <Upload size={15} className="text-[#0052FF]" />
            <span>Import Members</span>
          </button>
          <button
            className="flex items-center gap-2 px-5 py-2.5 bg-[#0052FF] hover:bg-orange-600 text-white rounded-xl text-xs font-black transition-all shadow-md cursor-pointer border-none active:scale-95"
            onClick={() => setShowAddModal(true)}
          >
            <Plus size={16} /> Add Member
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <MembersKPI />

      {/* Main Table */}
      <MembersTable
        members={members}
        search={search}
        setSearch={setSearch}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        selectedMemberId={null}
        onSelectMember={(m) => router.push(`/dashboard/members/${encodeURIComponent(m.id)}`)}
        onEdit={(m) => setEditingMember(m)}
        onRenew={(m) => setRenewWizardMember(m)}
        onFreeze={async (m) => {
          try {
            await toggleFreeze(m.id);
            toast.success(`Status updated for ${m.name}`);
            fetchMembers();
          } catch {
            toast.error('Failed to update status');
          }
        }}
        onDelete={(m) => {
          setDeleteMemberTarget(m);
        }}
      />

      {/* Renewal Center Modal */}
      <RenewalCenterModal
        isOpen={showRenewalCenter}
        onClose={() => setShowRenewalCenter(false)}
        onOpenRenewWizard={(m) => {
          setRenewWizardMember(m);
          setShowRenewalCenter(false);
        }}
      />

      {/* Renewal Wizard Modal */}
      <RenewalWizardModal
        isOpen={!!renewWizardMember}
        member={renewWizardMember}
        onClose={() => setRenewWizardMember(null)}
      />

      {/* ─── Edit Member Modal ─── */}
      {editingMember && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
            onClick={() => setEditingMember(null)}
          />
          <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl z-10 p-6 max-h-[90vh] overflow-y-auto border border-slate-100 flex flex-col gap-4 text-slate-800 text-left">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xl font-black text-slate-900 tracking-tight font-display animate-fade-in">Edit Member Profile</h2>
                <p className="text-xs text-slate-500 mt-0.5">Modify member details, physical metrics, and trainer status.</p>
              </div>
              <button 
                onClick={() => setEditingMember(null)}
                className="w-8 h-8 rounded-full flex items-center justify-center bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 border border-slate-200 cursor-pointer"
              >
                <X size={14} />
              </button>
            </div>
            
            <form onSubmit={handleEditSave} className="space-y-5">
              <div className="w-full">
                <label className="block text-[8px] font-black uppercase tracking-wider text-slate-400 mb-2">Member Photo</label>
                <SmartPhotoCapture 
                  value={editingMember.avatar || undefined}
                  onCaptureComplete={(urls) => {
                    setEditingMember({ ...editingMember, avatar: urls.photoURL });
                  }}
                  label="Member"
                />
              </div>

              {/* Personal Details */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Personal Details</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Name</label>
                    <input
                      type="text"
                      className="w-full mt-1 p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-bold bg-white"
                      value={editingMember.name || ""}
                      onChange={(e) => setEditingMember({ ...editingMember, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Phone</label>
                    <input
                      type="text"
                      className="w-full mt-1 p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-bold bg-white"
                      value={editingMember.phone || ""}
                      onChange={(e) => setEditingMember({ ...editingMember, phone: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Email</label>
                    <input
                      type="email"
                      className="w-full mt-1 p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-bold bg-white"
                      value={editingMember.email || ""}
                      onChange={(e) => setEditingMember({ ...editingMember, email: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Membership & Branch */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Membership & Trainer</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Plan</label>
                    <select
                      className="w-full mt-1 p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-white font-bold"
                      value={editingMember.plan || ""}
                      onChange={(e) => setEditingMember({ ...editingMember, plan: e.target.value })}
                    >
                      {(plans && plans.length > 0 ? plans : [
                        { id: 'p_mon', name: 'Monthly Standard' },
                        { id: 'p_qrt', name: 'Quarterly Prime' },
                        { id: 'p_semi', name: 'Semi-Annual Pro' },
                        { id: 'p_ann', name: 'Annual Premium' }
                      ]).map((p: any) => (
                        <option key={p.id || p.name} value={p.name}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Branch</label>
                    <input
                      type="text"
                      className="w-full mt-1 p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-bold bg-white"
                      value={editingMember.branch || "Mohali, Punjab"}
                      onChange={(e) => setEditingMember({ ...editingMember, branch: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Trainer</label>
                    <select
                      className="w-full mt-1 p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-white font-bold text-slate-700"
                      value={editingMember.trainer || ""}
                      onChange={(e) => setEditingMember({ ...editingMember, trainer: e.target.value })}
                    >
                      <option value="">No Trainer / Unassigned</option>
                      {trainers.map(t => (
                        <option key={t.id} value={t.name}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Expiry Date</label>
                    <input
                      type="date"
                      className="w-full mt-1 p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-bold bg-white"
                      value={editingMember.expiryDate || ""}
                      onChange={(e) => setEditingMember({ ...editingMember, expiryDate: e.target.value })}
                    />
                    {/* \u2500\u2500 Auto-fix Expiry from Plan \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}
                    <button
                      type="button"
                      onClick={() => {
                        const PLAN_DURATION_MAP: Record<string, number> = {
                          '1 month': 30, 'monthly': 30,
                          '2 month': 60, '2 months': 60,
                          '3 month': 90, '3 months': 90, 'quarterly': 90,
                          '6 month': 180, '6 months': 180, 'semi': 180,
                          '12 month': 365, '12 months': 365, 'annual': 365, 'yearly': 365, '1 year': 365,
                          'lifetime': 3650,
                        };
                        const planLower = (editingMember.plan || '').toLowerCase();
                        let days = 30;
                        for (const [key, d] of Object.entries(PLAN_DURATION_MAP)) {
                          if (planLower.includes(key)) { days = d; break; }
                        }
                        const start = editingMember.joinDate ? new Date(editingMember.joinDate) : new Date();
                        const newExpiry = new Date(start.getTime() + days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
                        setEditingMember({ ...editingMember, expiryDate: newExpiry });
                        toast.success(`\u2705 Auto-fixed: ${editingMember.plan} = ${days} days from join date`);
                      }}
                      className="mt-1.5 w-full text-[9px] font-black text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg py-1.5 transition-all"
                    >
                      \u26a1 Auto-fix from Plan + Join Date
                    </button>
                  </div>
                </div>
              </div>

              {/* Physical Parameters */}
              <div className="space-y-3">
                <h3 className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">Physical & Health Metrics</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Age</label>
                    <input
                      type="number"
                      className="w-full mt-1 p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-bold bg-white"
                      value={editingMember.age || ""}
                      onChange={(e) => setEditingMember({ ...editingMember, age: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Gender</label>
                    <select
                      className="w-full mt-1 p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 bg-white font-bold text-slate-700"
                      value={editingMember.gender || "Male"}
                      onChange={(e) => setEditingMember({ ...editingMember, gender: e.target.value })}
                    >
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Blood Group</label>
                    <input
                      type="text"
                      className="w-full mt-1 p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-bold bg-white"
                      value={editingMember.bloodGroup || ""}
                      onChange={(e) => setEditingMember({ ...editingMember, bloodGroup: e.target.value })}
                      placeholder="e.g. O+"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Weight (kg)</label>
                    <input
                      type="number"
                      className="w-full mt-1 p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-bold bg-white"
                      value={editingMember.weight || ""}
                      onChange={(e) => setEditingMember({ ...editingMember, weight: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Height (cm)</label>
                    <input
                      type="number"
                      className="w-full mt-1 p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-bold bg-white"
                      value={editingMember.height || ""}
                      onChange={(e) => setEditingMember({ ...editingMember, height: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Emergency Contact</label>
                    <input
                      type="text"
                      className="w-full mt-1 p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-bold bg-white"
                      value={editingMember.emergencyContact || ""}
                      onChange={(e) => setEditingMember({ ...editingMember, emergencyContact: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase">Address</label>
                <textarea
                  className="w-full mt-1 p-2 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-indigo-500 font-bold bg-white animate-fade-in"
                  value={editingMember.address || ""}
                  onChange={(e) => setEditingMember({ ...editingMember, address: e.target.value })}
                  rows={2}
                />
              </div>

              {/* PT Toggle */}
              <div className="p-3.5 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Dumbbell size={16} />
                  </div>
                  <div>
                    <span className="text-xs font-black text-slate-900 block">Personal Training (PT) Member</span>
                    <span className="text-[10px] text-slate-500">Enable personal training services & assignments for this client.</span>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={editingMember.isPt === true}
                    onChange={(e) => setEditingMember({ ...editingMember, isPt: e.target.checked })}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 text-slate-500 bg-slate-100 rounded-xl text-xs font-bold transition-all border border-slate-200 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl text-xs font-bold transition-all shadow-sm cursor-pointer border-none"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* ─── Add Member Modal — Premium White Theme ─── */}
      <AddMemberModal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setNewCreatedMember(null);
        }}
      />

      {/* ═══ Biometric Enrollment Modal ═══════════════════════════════════════ */}
      <AnimatePresence>
        {enrollModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] flex items-center justify-center p-4"
          >
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
              onClick={
                enrollStatus.status === "success" ||
                enrollStatus.status === "failed" ||
                enrollStatus.status === "info"
                  ? closeEnrollModal
                  : undefined
              }
            />

            <motion.div
              initial={{ scale: 0.9, y: 20, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 20, opacity: 0 }}
              transition={{ type: "spring", damping: 22, stiffness: 200 }}
              className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 rounded-[32px] p-8 shadow-[0_30px_80px_rgba(0,0,0,0.6)] z-10 overflow-hidden"
            >
              {/* Glow BG */}
              <div
                className={`absolute inset-0 opacity-20 pointer-events-none transition-all duration-700 ${
                  enrollStatus.status === "success"
                    ? "bg-emerald-500"
                    : enrollStatus.status === "failed"
                      ? "bg-red-500"
                      : enrollStatus.status === "scanning"
                        ? "bg-[#F97316]"
                        : "bg-amber-500"
                } blur-3xl`}
              />

              {/* Close Button */}
              {(enrollStatus.status === "success" ||
                enrollStatus.status === "failed" ||
                enrollStatus.status === "info") && (
                <button
                  onClick={closeEnrollModal}
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white cursor-pointer border-none"
                >
                  <X size={14} />
                </button>
              )}

              {/* Header */}
              <div className="text-center mb-8 relative">
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">
                  {enrollAction === "fingerprint"
                    ? "Fingerprint Enrollment"
                    : enrollAction === "face"
                      ? "Face Enrollment"
                      : enrollAction === "sync"
                        ? "Device Sync"
                        : "Delete Biometric"}
                </div>
                <h3 className="text-xl font-black text-white">
                  {activeProfile?.name}
                </h3>
              </div>

              {/* Animated Scan Ring + Icon */}
              <div className="flex items-center justify-center mb-8">
                <div className="relative w-32 h-32">
                  {/* Outer pulsing ring */}
                  {(enrollStatus.status === "scanning" ||
                    enrollStatus.status === "ready" ||
                    enrollStatus.status === "connecting") && (
                    <>
                      <div className="absolute inset-0 rounded-full border-2 border-blue-500/30 animate-ping" />
                      <div className="absolute inset-2 rounded-full border border-blue-500/20 animate-pulse" />
                    </>
                  )}
                  {enrollStatus.status === "success" && (
                    <div className="absolute inset-0 rounded-full border-2 border-emerald-500/40 animate-pulse" />
                  )}

                  {/* Progress arc SVG */}
                  <svg
                    className="absolute inset-0 w-full h-full -rotate-90"
                    viewBox="0 0 120 120"
                  >
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="4"
                    />
                    <circle
                      cx="60"
                      cy="60"
                      r="54"
                      fill="none"
                      stroke={
                        enrollStatus.status === "success"
                          ? "#10b981"
                          : enrollStatus.status === "failed"
                            ? "#ef4444"
                            : "#3b82f6"
                      }
                      strokeWidth="4"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 54}`}
                      strokeDashoffset={`${2 * Math.PI * 54 * (1 - enrollStatus.scan / (enrollStatus.totalScans || 3))}`}
                      className="transition-all duration-700"
                    />
                  </svg>

                  {/* Center Icon */}
                  <div
                    className={`absolute inset-0 flex items-center justify-center rounded-full ${
                      enrollStatus.status === "success"
                        ? "bg-emerald-500/20"
                        : enrollStatus.status === "failed"
                          ? "bg-red-500/20"
                          : "bg-blue-500/10"
                    }`}
                  >
                    {enrollStatus.status === "success" ? (
                      <CheckCheck size={36} className="text-emerald-400" />
                    ) : enrollStatus.status === "failed" ? (
                      <XCircle size={36} className="text-red-400" />
                    ) : enrollStatus.status === "info" ? (
                      <AlertTriangle size={36} className="text-amber-400" />
                    ) : enrollAction === "face" ? (
                      <Scan size={36} className="text-[#FB923C] animate-pulse" />
                    ) : enrollAction === "sync" ? (
                      <Wifi
                        size={36}
                        className="text-amber-400 animate-pulse"
                      />
                    ) : enrollAction === "delete" ? (
                      <Trash2
                        size={36}
                        className="text-red-400 animate-pulse"
                      />
                    ) : (
                      <Fingerprint
                        size={36}
                        className={`${enrollStatus.status === "scanning" ? "text-[#FB923C] animate-pulse" : "text-slate-400"}`}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Scan Steps (only for fingerprint enrollment) */}
              {enrollAction === "fingerprint" && (
                <div className="flex justify-center gap-3 mb-6">
                  {[1, 2, 3].map((step) => (
                    <div
                      key={step}
                      className={`flex flex-col items-center gap-1.5 transition-all duration-500 ${enrollStatus.scan >= step ? "opacity-100" : "opacity-30"}`}
                    >
                      <div
                        className={`w-10 h-10 rounded-2xl flex items-center justify-center text-xs font-black border-2 transition-all duration-500 ${
                          enrollStatus.scan > step
                            ? "bg-emerald-500 border-emerald-400 text-white"
                            : enrollStatus.scan === step
                              ? "bg-blue-500/20 border-[#F97316] text-[#FB923C] animate-pulse"
                              : "bg-white/5 border-white/10 text-slate-500"
                        }`}
                      >
                        {enrollStatus.scan > step ? "✓" : step}
                      </div>
                      <span
                        className={`text-[8px] font-bold uppercase tracking-wider ${enrollStatus.scan >= step ? "text-slate-300" : "text-slate-600"}`}
                      >
                        Scan {step}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Status Message */}
              <div
                className={`text-center px-4 py-3 rounded-2xl mb-4 ${
                  enrollStatus.status === "success"
                    ? "bg-emerald-500/10 border border-emerald-500/20"
                    : enrollStatus.status === "failed"
                      ? "bg-red-500/10 border border-red-500/20"
                      : enrollStatus.status === "info"
                        ? "bg-amber-500/10 border border-amber-500/20"
                        : "bg-white/5 border border-white/10"
                }`}
              >
                <p
                  className={`text-[11px] font-bold leading-relaxed ${
                    enrollStatus.status === "success"
                      ? "text-emerald-400"
                      : enrollStatus.status === "failed"
                        ? "text-red-400"
                        : enrollStatus.status === "info"
                          ? "text-amber-400"
                          : "text-slate-300"
                  }`}
                >
                  {enrollStatus.message || "Initializing..."}
                </p>
              </div>

              {/* Success: Show assigned biometric ID */}
              {enrollStatus.status === "success" &&
                enrollStatus.biometricId && (
                  <div className="text-center mb-4">
                    <div className="inline-flex items-center gap-2 bg-[#d4ff00]/10 border border-[#d4ff00]/30 px-4 py-2 rounded-full">
                      <Shield size={12} className="text-[#d4ff00]" />
                      <span className="text-[11px] font-black text-[#d4ff00] uppercase tracking-widest">
                        Biometric ID: {enrollStatus.biometricId}
                      </span>
                    </div>
                  </div>
                )}

              {/* Loading bar */}
              {(enrollStatus.status === "pending" ||
                enrollStatus.status === "connecting" ||
                enrollStatus.status === "scanning" ||
                enrollStatus.status === "processing" ||
                enrollStatus.status === "ready") && (
                <div className="h-0.5 bg-white/10 rounded-full overflow-hidden mb-4">
                  <div
                    className="h-full bg-[#F97316] rounded-full animate-[loading_2s_ease-in-out_infinite]"
                    style={{
                      width: `${enrollStatus.scan > 0 ? (enrollStatus.scan / enrollStatus.totalScans) * 100 : 30}%`,
                      transition: "width 0.7s ease",
                    }}
                  />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3">
                {(enrollStatus.status === "success" ||
                  enrollStatus.status === "failed" ||
                  enrollStatus.status === "info") && (
                  <button
                    onClick={closeEnrollModal}
                    className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-none"
                  >
                    {enrollStatus.status === "success" ? "Done ✓" : "Close"}
                  </button>
                )}
                {enrollStatus.status === "failed" && (
                  <button
                    onClick={
                      enrollAction === "fingerprint"
                        ? handleEnrollFingerprint
                        : enrollAction === "sync"
                          ? handleSyncDevice
                          : closeEnrollModal
                    }
                    className="flex-1 py-3 rounded-xl bg-[#EA580C] hover:bg-orange-500 text-white text-xs font-black uppercase tracking-wider transition-all cursor-pointer border-none"
                  >
                    <RotateCcw size={12} className="inline mr-1" /> Retry
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Quick View Trainer Modal */}
      <AnimatePresence>
        {selectedTrainerForView && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-sm bg-white border border-slate-100 rounded-3xl p-6 shadow-2xl space-y-4 text-left relative overflow-hidden text-slate-800"
            >
              <button
                onClick={() => setSelectedTrainerForView(null)}
                className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 text-sm cursor-pointer p-1 rounded-full hover:bg-slate-50 border-none bg-transparent"
              >
                <X size={16} />
              </button>

              <div className="flex flex-col items-center text-center space-y-3 pb-3 border-b border-slate-150">
                <img
                  src={selectedTrainerForView.photo}
                  alt={selectedTrainerForView.name}
                  className="w-16 h-16 rounded-2xl object-cover border border-slate-100 shadow-md"
                />
                <div>
                  <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-full font-black tracking-wider uppercase inline-block">
                    {selectedTrainerForView.specialization}
                  </span>
                  <h3 className="text-sm font-black text-slate-900 mt-1.5">
                    {selectedTrainerForView.name}
                  </h3>
                  <p className="text-[9px] text-slate-500 mt-0.5 font-semibold font-mono">
                    Mobile: {selectedTrainerForView.phone} · Exp:{" "}
                    {selectedTrainerForView.experience} Yrs
                  </p>
                </div>
              </div>

              <div className="space-y-3 text-xs font-semibold text-slate-700">
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">
                    Bio Biography
                  </span>
                  <p className="text-[10px] text-slate-500 leading-relaxed italic mt-0.5">
                    "
                    {selectedTrainerForView.bio ||
                      "Dedicated professional trainer."}
                    "
                  </p>
                </div>
                <div>
                  <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">
                    Certifications
                  </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {selectedTrainerForView.certifications?.map(
                      (c: string, idx: number) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-slate-600 text-[8px] font-black uppercase"
                        >
                          {c}
                        </span>
                      ),
                    )}
                  </div>
                </div>
                {selectedTrainerForView.achievements && (
                  <div>
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block">
                      Achievements
                    </span>
                    <p className="text-[10px] text-slate-700 mt-0.5 flex items-center gap-1.5 font-bold">
                      <Trophy size={12} className="text-amber-500 shrink-0" />
                      <span>{selectedTrainerForView.achievements}</span>
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setSelectedTrainerForView(null)}
                className="w-full py-2.5 bg-black hover:bg-black/90 text-white rounded-xl text-[10px] font-black uppercase tracking-wider text-center transition-colors cursor-pointer border-none"
              >
                Close Detail View
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── DELETE MEMBER CONFIRMATION MODAL ── */}
      <AnimatePresence>
        {deleteMemberTarget && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/70 backdrop-blur-sm"
              onClick={() => { if (!deletingMember) setDeleteMemberTarget(null); }}
            />

            {/* Modal Card */}
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 12 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 12 }}
              transition={{ type: 'spring', duration: 0.3 }}
              className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md z-10 overflow-hidden"
              onKeyDown={(e) => { if (e.key === 'Escape' && !deletingMember) setDeleteMemberTarget(null); }}
            >
              {/* Danger Header Strip */}
              <div className="bg-rose-50 border-b border-rose-100 px-6 pt-6 pb-5 flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
                  <Trash2 size={20} />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base leading-tight">Delete Member?</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1 leading-relaxed">
                    This will permanently remove the member from the active directory. This action cannot be undone.
                  </p>
                </div>
              </div>

              {/* Member Details Summary */}
              <div className="px-6 py-4 space-y-3">
                <div className="bg-slate-50 rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100 text-xs">
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-500 font-semibold">Member Name</span>
                    <span className="font-extrabold text-slate-900">{deleteMemberTarget.name || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-500 font-semibold">Member ID</span>
                    <span className="font-extrabold text-slate-900 font-mono">
                      #{deleteMemberTarget.clientId || deleteMemberTarget.memberId || deleteMemberTarget.id}
                    </span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-500 font-semibold">Phone</span>
                    <span className="font-bold text-slate-800">{deleteMemberTarget.phone || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-2.5">
                    <span className="text-slate-500 font-semibold">Membership</span>
                    <span className="font-bold text-slate-800">{deleteMemberTarget.plan || '—'}</span>
                  </div>
                </div>

                {/* Info note */}
                <div className="flex items-start gap-2.5 bg-amber-50 border border-amber-200 rounded-xl px-3.5 py-3 text-[11px] text-amber-800 font-semibold leading-relaxed">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                  Payment history and attendance records will be preserved for audit purposes. Only the member profile will be removed.
                </div>
              </div>

              {/* Action Buttons */}
              <div className="px-6 pb-6 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => setDeleteMemberTarget(null)}
                  disabled={deletingMember}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-bold text-xs hover:bg-slate-50 cursor-pointer disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={deletingMember}
                  onClick={async () => {
                    const m = deleteMemberTarget;
                    setDeletingMember(true);
                    try {
                      await deleteMember(m.id);
                      setDeleteMemberTarget(null);
                      toast.success(`✓ ${m.name} has been removed successfully.`);
                      fetchMembers(true); // force=true: bypass stale cache, always re-fetch from server
                    } catch (err: unknown) {
                      console.error('[DeleteMember] Firebase error:', err);
                      toast.error('Unable to delete member. Please try again.');
                    } finally {
                      setDeletingMember(false);
                    }
                  }}
                  className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold text-xs cursor-pointer disabled:opacity-60 transition-colors flex items-center justify-center gap-1.5 border-none shadow-sm"
                >
                  {deletingMember ? (
                    <><RefreshCw size={13} className="animate-spin" /> Deleting...</>
                  ) : (
                    <><Trash2 size={13} /> Delete Member</>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
