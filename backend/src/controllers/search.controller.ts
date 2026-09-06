import { Request, Response } from 'express';
import { db, getFirestoreDb } from '../firebase';

// Helper: Normalize phone numbers by extracting digits only
function normalizePhone(phone: any): string {
  if (!phone) return '';
  return String(phone).replace(/\D/g, '');
}

// Helper: Calculate search score based on match priority
function calculateScore(queryText: string, digitsOnly: string, item: any, nameField = 'name'): number {
  const q = queryText.toLowerCase();
  const name = String(item[nameField] || item.fullName || item.title || '').toLowerCase();
  const phone = normalizePhone(item.phone || item.mobile || item.contact);
  const email = String(item.email || '').toLowerCase();
  
  const idFields = [
    item.id,
    item.memberId,
    item.employeeId,
    item.enquiryId,
    item.biometricId,
    item.customId,
    item.clientId,
    item.code,
    item.automationKey
  ].filter(Boolean).map(String).map(s => s.toLowerCase());

  // 1. Exact Name match
  if (name === q) return 100;

  // 2. Exact ID match
  if (idFields.some(id => id === q || (id.startsWith('az-') && id === q) || (id.startsWith('emp-') && id === q) || (id.startsWith('enq-') && id === q))) {
    return 95;
  }

  // 3. Exact Phone match
  if (digitsOnly && digitsOnly.length >= 7 && (phone === digitsOnly || phone.endsWith(digitsOnly))) {
    return 90;
  }

  // 4. Exact Email match
  if (email && email === q) return 85;

  // 5. Name starts with query
  if (name.startsWith(q)) return 75;

  // 6. ID starts with or contains query
  if (idFields.some(id => id.includes(q))) return 70;

  // 7. Phone partial match
  if (digitsOnly && digitsOnly.length >= 3 && phone.includes(digitsOnly)) return 65;

  // 8. Name contains query
  if (name.includes(q)) return 60;

  // 9. Email contains query
  if (email && email.includes(q)) return 50;

  // 10. Address / Plan / Notes / Remarks partial match
  const secondaryText = `${item.address || ''} ${item.plan || ''} ${item.role || ''} ${item.specialization || ''} ${item.remarks || ''} ${item.notes || ''}`.toLowerCase();
  if (secondaryText.includes(q)) return 40;

  return 0;
}

export const globalSearch = async (req: Request, res: Response) => {
  try {
    const rawQuery = String(req.query.q || req.query.query || '').trim();
    if (!rawQuery) {
      return res.json({
        query: '',
        members: [],
        employees: [],
        trainers: [],
        enquiries: [],
        followUps: [],
        total: 0
      });
    }

    const q = rawQuery.toLowerCase();
    const digitsOnly = q.replace(/\D/g, '');

    // 1. Fetch data from DB / Firestore
    const firestore = getFirestoreDb();
    let allStaff: any[] = [];
    if (firestore) {
      try {
        const snap = await firestore.collection('employees').get();
        if (snap && !snap.empty) {
          allStaff = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
      } catch (_) {}
    }

    const [allMembers, allEnquiries, allFollowups] = await Promise.all([
      db.getMembers().catch(() => []),
      db.getEnquiries().catch(() => []),
      db.getFollowups().catch(() => [])
    ]);

    // ─── 2. Search & Score Members ───
    const membersResults = (allMembers || [])
      .map((m: any) => ({
        id: m.id || m.memberId,
        category: 'member',
        title: m.name || m.fullName || 'Member',
        subtitle: m.memberId || m.plan || 'Standard Member',
        phone: m.phone || m.mobile || '',
        email: m.email || '',
        status: m.status || 'active',
        plan: m.plan || 'Membership',
        expiryDate: m.expiryDate || '',
        biometricId: m.biometricId || null,
        url: `/dashboard/members/${m.id || m.memberId}`,
        score: calculateScore(q, digitsOnly, m, 'name'),
        raw: m
      }))
      .filter((m: any) => m.score > 0)
      .sort((a: any, b: any) => b.score - a.score);

    // ─── 3. Search & Score Employees & Trainers ───
    const employeesResults: any[] = [];
    const trainersResults: any[] = [];

    (allStaff || []).forEach((s: any) => {
      const score = calculateScore(q, digitsOnly, s, 'name');
      if (score <= 0) return;

      const roleStr = String(s.role || '').toLowerCase();
      const isTrainer = roleStr.includes('trainer') || roleStr.includes('coach') || !!s.specialization;

      const baseItem = {
        id: s.id || s.employeeId,
        title: s.name || s.fullName || 'Staff Member',
        phone: s.phone || '',
        email: s.email || '',
        status: s.status || 'Active',
        biometricId: s.biometricId || null,
        score,
        raw: s
      };

      if (isTrainer) {
        trainersResults.push({
          ...baseItem,
          category: 'trainer',
          subtitle: s.specialization || s.role || 'Fitness Trainer',
          url: `/dashboard/trainers?id=${s.id || s.employeeId}`
        });
      }

      employeesResults.push({
        ...baseItem,
        category: 'employee',
        subtitle: s.employeeId ? `${s.employeeId} · ${s.role || 'Staff'}` : (s.role || 'Staff Member'),
        url: `/dashboard/employees?id=${s.id || s.employeeId}`
      });
    });

    employeesResults.sort((a, b) => b.score - a.score);
    trainersResults.sort((a, b) => b.score - a.score);

    // ─── 4. Search & Score Enquiries ───
    const enquiriesResults = (allEnquiries || [])
      .map((e: any) => ({
        id: e.id,
        category: 'enquiry',
        title: e.name || `${e.firstName || ''} ${e.lastName || ''}`.trim() || 'Enquiry Lead',
        subtitle: e.interestedPlan || e.duration || 'Gym Lead',
        phone: e.phone || e.contact || '',
        email: e.email || '',
        status: e.status || 'Pending',
        priority: e.priority || 'Warm',
        nextFollowUpDate: e.nextFollowUpDate || e.nextFollowUp || '',
        url: `/dashboard/enquiries?id=${e.id}`,
        score: calculateScore(q, digitsOnly, e, 'name'),
        raw: e
      }))
      .filter((e: any) => e.score > 0)
      .sort((a: any, b: any) => b.score - a.score);

    // ─── 5. Search & Score Follow-Ups (including connected relations) ───
    const followUpsResults = (allFollowups || [])
      .map((f: any) => {
        let score = calculateScore(q, digitsOnly, f, 'memberName');
        if (score === 0) {
          score = calculateScore(q, digitsOnly, f, 'title');
        }

        const cleanDueDate = (f.dueDate || f.scheduledDate || '').split('T')[0];
        return {
          id: f.id,
          category: 'followup',
          title: f.memberName || f.title || 'Follow-Up Task',
          subtitle: f.type || 'Follow-Up',
          phone: f.phone || '',
          status: f.status || 'Pending',
          priority: f.priority || 'Medium',
          dueDate: cleanDueDate,
          scheduledTime: f.scheduledTime || '',
          source: f.source || (f.automationKey ? 'auto' : 'manual'),
          url: `/dashboard/follow-up?search=${encodeURIComponent(f.phone || f.memberName || f.id)}`,
          score,
          raw: f
        };
      })
      .filter((f: any) => f.score > 0)
      .sort((a: any, b: any) => b.score - a.score);

    const total = membersResults.length + employeesResults.length + trainersResults.length + enquiriesResults.length + followUpsResults.length;

    return res.json({
      query: rawQuery,
      members: membersResults,
      employees: employeesResults,
      trainers: trainersResults,
      enquiries: enquiriesResults,
      followUps: followUpsResults,
      total
    });
  } catch (error: any) {
    console.error('[globalSearch] Error performing search:', error);
    return res.status(500).json({ error: 'Search failed', message: error.message });
  }
};
