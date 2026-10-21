import { Request, Response } from 'express';
import { db, admin, isFirebaseInitialized } from '../firebase';
import { triggerWelcomeEmail, triggerPaymentEmail, triggerPtWelcomeEmail } from '../services/automation.service';
import { resolveStaleRenewalFollowups } from '../services/followupAutomation.service';
import { isHikvisionProvider, queueHikvisionMemberSync } from '../services/biometricQueue.service';
import { getNextAvailableBiometricId, isDeviceBiometricIdInUse, isValidDeviceBiometricId } from '../services/biometricId.service';

export const getMembers = async (req: Request, res: Response) => {
  try {
    const list = await db.getMembers();
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMembersPaginated = async (req: Request, res: Response) => {
  try {
    const { page, limit, search, status } = req.query;
    const result = await db.getMembersPaginated({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 50,
      search: typeof search === 'string' ? search : '',
      status: typeof status === 'string' ? status : 'all'
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getMemberById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const member = await db.getMemberById(id);
    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }
    res.json(member);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

function calculateBackendPlanExpiry(planOrObject: any, startDateStr?: string, plansList: any[] = []): string {
  const startDate = startDateStr ? new Date(startDateStr) : new Date();
  const validStart = isNaN(startDate.getTime()) ? new Date() : startDate;
  
  let planName = typeof planOrObject === 'string' ? planOrObject : (planOrObject?.name || planOrObject?.plan || '');
  let durationDays: number | null = null;

  // Stage 1: Check direct plan object properties
  if (typeof planOrObject === 'object' && planOrObject !== null) {
    if (typeof planOrObject.durationDays === 'number' && planOrObject.durationDays > 0) {
      durationDays = planOrObject.durationDays;
    } else if (planOrObject.duration) {
      const dMatch = String(planOrObject.duration).match(/(\d+)\s*(?:day|days|d)\b/i);
      if (dMatch) durationDays = parseInt(dMatch[1], 10);
    }
  }

  const p = String(planName || '').trim().toLowerCase();

  // Stage 2: Direct string regex parsing (e.g. "10 days", "2 months", "1 year", "quarterly", "semi", "annual")
  if (durationDays === null && p) {
    const dayMatch = p.match(/(\d+)\s*(?:day|days|d)\b/i);
    const monthMatch = p.match(/(\d+)\s*(?:month|months|m)\b/i);
    const yearMatch = p.match(/(\d+)\s*(?:year|years|y)\b/i);

    if (dayMatch) {
      durationDays = parseInt(dayMatch[1], 10);
    } else if (monthMatch) {
      durationDays = parseInt(monthMatch[1], 10) * 30;
    } else if (yearMatch) {
      durationDays = parseInt(yearMatch[1], 10) * 365;
    } else if (p.includes('quarterly')) {
      durationDays = 90;
    } else if (p.includes('semi') || p.includes('half year')) {
      durationDays = 180;
    } else if (p.includes('annual') || p.includes('yearly')) {
      durationDays = 365;
    } else if (p.includes('lifetime')) {
      durationDays = 3650;
    }
  }

  // Stage 3: Exact lookup in plansList if provided
  if (durationDays === null && plansList && plansList.length > 0) {
    const matched = plansList.find((item: any) => {
      const name = String(item.name || '').trim().toLowerCase();
      const id = String(item.id || '').trim().toLowerCase();
      return name === p || id === p;
    });
    if (matched) {
      if (typeof matched.durationDays === 'number' && matched.durationDays > 0) {
        durationDays = matched.durationDays;
      } else if (matched.duration) {
        const dMatch = String(matched.duration).match(/(\d+)\s*(?:day|days|d)\b/i);
        if (dMatch) durationDays = parseInt(dMatch[1], 10);
      }
    }
  }

  // Fallback if unresolved
  if (durationDays === null || isNaN(durationDays) || durationDays <= 0) {
    durationDays = 30;
  }

  const expiryDate = new Date(validStart.getTime() + durationDays * 24 * 60 * 60 * 1000);
  return expiryDate.toISOString().split('T')[0];
}

export const createMember = async (req: Request, res: Response) => {
  try {
    const { 
      name, phone, email, plan, branch, trainer, gender, age, weight, height, bmi, 
      joinDate, expiryDate, bloodGroup, emergencyContact, maritalStatus, anniversaryDate, 
      birthdayDate, medicalConditions, fitnessGoal, occupation, address, password, avatarUrl,
      biometricId,
      paymentStatus, paymentMethod,
      price, amount, totalBilled, totalPaid
    } = req.body;

    if (!name || !phone) {
      return res.status(400).json({ error: 'Name and Phone are required' });
    }

    const requestedBioId = String(biometricId ?? '').trim();
    let assignedBioId = requestedBioId || String(req.body.memberId || '').trim();
    if (requestedBioId && !isValidDeviceBiometricId(requestedBioId)) {
      return res.status(400).json({ error: 'Biometric ID must be a whole number between 1 and 65535.' });
    }
    if (!isValidDeviceBiometricId(assignedBioId)) {
      try {
        assignedBioId = String(await getNextAvailableBiometricId());
      } catch (allocationError: any) {
        return res.status(503).json({ error: `Could not assign a valid EasyBio ID: ${allocationError.message}` });
      }
    }
    try {
      if (await isDeviceBiometricIdInUse(assignedBioId, Boolean(req.body.fingerprintDeviceId) || isHikvisionProvider())) {
        return res.status(409).json({ error: `Biometric ID ${assignedBioId} is already assigned. Choose another ID or use Next available.` });
      }
    } catch (availabilityError: any) {
      return res.status(503).json({ error: `Could not verify EasyBio ID availability: ${availabilityError.message}` });
    }

    // Face capture can finish just before or after this request. Prefer the agent's terminal
    // portrait if it has already synced for this biometric ID.
    let capturedFacePhotoUrl = '';
    if (isFirebaseInitialized && admin) {
      try {
        const photoSnap = await admin.firestore().collection('biometric_photos').doc(String(assignedBioId).trim()).get();
        capturedFacePhotoUrl = String(photoSnap.data()?.photoUrl || '').trim();
      } catch (photoErr: any) {
        console.warn('[Member Photo] Could not read synced biometric portrait:', photoErr.message);
      }
    }
    const memberPhotoUrl = capturedFacePhotoUrl || String(req.body.photo || avatarUrl || req.body.photoUrl || req.body.avatar || req.body.profilePhotoUrl || '');

    let uid = 'm' + Date.now();
    const loginEmail = email || `${phone}@thewarriorgym.in`;

    if (isFirebaseInitialized && admin) {
      const authAdmin = admin.auth();
      const firestoreAdmin = admin.firestore();
      
      let userRecord;
      try {
        userRecord = await authAdmin.getUserByEmail(loginEmail);
        uid = userRecord.uid;
      } catch (err: any) {
        if (err.code === 'auth/user-not-found') {
          userRecord = await authAdmin.createUser({
            email: loginEmail,
            password: password || '1234567',
            displayName: name,
            emailVerified: true
          });
          uid = userRecord.uid;
        } else {
          throw err;
        }
      }

      // Ensure profile exists in users collection
      await firestoreAdmin.collection('users').doc(uid).set({
        uid,
        name,
        email: loginEmail,
        role: 'member',
        branch: branch || 'Mohali, Punjab',
        gymId: 'gym_001',
        createdAt: new Date().toISOString()
      }, { merge: true });
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const invoiceDate = req.body.invoiceDate || req.body.billingDate || req.body.date || todayStr;
    const startJoinDate = joinDate || todayStr;
    const memStartDate = req.body.startDate || startJoinDate;
    const plansList = await db.getPlans();
    
    let finalExpiry = expiryDate;
    if (!finalExpiry || finalExpiry === startJoinDate) {
      finalExpiry = calculateBackendPlanExpiry(plan || 'Monthly', memStartDate, plansList);
    }

    const reqPlanId = String(req.body.planId || req.body.packageId || '').trim().toLowerCase();
    const reqPlanName = String(plan || req.body.packageName || '').trim().toLowerCase();

    const matchedPlan = plansList.find(p => {
      const dbName = String(p.name || '').trim().toLowerCase();
      const dbId = String(p.id || '').trim().toLowerCase();
      return (reqPlanId && dbId === reqPlanId) ||
             (reqPlanName && (dbName === reqPlanName || dbId === reqPlanName));
    });

    // Authoritative package catalog price: Single source of truth from package catalog
    let origAmount: number;
    if (matchedPlan && typeof matchedPlan.price === 'number') {
      origAmount = Number(matchedPlan.price);
    } else {
      // Fallback only if plan is not configured in catalog
      origAmount = Number(req.body.originalAmount !== undefined ? req.body.originalAmount : (price || amount || 2500));
    }

    const discType = req.body.discountType || 'amount';
    const discVal = Number(req.body.discountValue !== undefined ? req.body.discountValue : (req.body.discountAmount !== undefined ? req.body.discountAmount : (req.body.discount || 0)));
    let discAmount = 0;
    if (discType === 'percentage') {
      discAmount = Math.min(origAmount, (origAmount * discVal) / 100);
    } else {
      discAmount = Math.min(origAmount, discVal);
    }
    const taxAmount = Math.max(0, Number(req.body.taxAmount !== undefined ? req.body.taxAmount : (req.body.tax || req.body.gst || 0)));
    const othCharges = Math.max(0, Number(req.body.otherCharges || 0));

    // Authoritative calculation: baseAmount - discount + tax = finalPayable
    const calculatedNet = Math.max(0, origAmount - discAmount + taxAmount + othCharges);
    const netPayable = calculatedNet; // Client-provided baseAmount / netPayable is NEVER trusted
    const rawPaid = totalPaid !== undefined ? totalPaid : (req.body.paid !== undefined ? req.body.paid : (req.body.amountPaid !== undefined ? req.body.amountPaid : netPayable));
    const amountPaid = Math.min(netPayable, Math.max(0, Number(rawPaid)));
    const outstandingAmount = Math.max(0, netPayable - amountPaid);
    const finalPaymentStatus = paymentStatus || (outstandingAmount <= 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'pending'));
    const initialStatus = memStartDate > todayStr ? 'upcoming' : (req.body.status || 'active');

    const idempotencyKey = req.body.idempotencyKey || `mem_${phone}_${plan || 'Monthly'}_${invoiceDate}`;

    const member = await db.addMember({
      uid, // align document ID with Auth UID
      name, phone, email: loginEmail, plan: plan || 'Monthly',
      price: origAmount,
      amount: netPayable,
      originalAmount: origAmount,
      discountType: discType,
      discountValue: discVal,
      discountAmount: discAmount,
      discount: discAmount,
      taxAmount: taxAmount,
      tax: taxAmount,
      netPayable: netPayable,
      totalBilled: netPayable,
      totalPaid: amountPaid,
      outstandingBalance: outstandingAmount,
      invoiceDate: invoiceDate,
      joinDate: startJoinDate,
      startDate: memStartDate,
      createdAt: new Date().toISOString(),
      expiryDate: finalExpiry,
      status: initialStatus, branch: branch || 'Mohali, Punjab', trainer: trainer || '',
      gender: gender || 'Male', age: Number(age) || 25,
      weight: Number(weight) || 70, height: Number(height) || 170,
      bmi: Number(bmi) || 24.2,
      bloodGroup: bloodGroup || 'O+',
      emergencyContact: emergencyContact || '',
      maritalStatus: maritalStatus || 'Single',
      anniversaryDate: anniversaryDate || '',
      birthdayDate: birthdayDate || '',
      medicalConditions: medicalConditions || '',
      fitnessGoal: fitnessGoal || 'General Fitness',
      occupation: occupation || '',
      address: address || '',
      photo: memberPhotoUrl,
      photoUrl: memberPhotoUrl,
      avatar: memberPhotoUrl,
      avatarUrl: memberPhotoUrl,
      profilePhotoUrl: memberPhotoUrl,
      photoSource: capturedFacePhotoUrl ? 'HIKVISION' : (req.body.photoSource || ''),
      facePhotoAvailable: Boolean(capturedFacePhotoUrl || req.body.facePhotoAvailable),
      facePhotoSource: capturedFacePhotoUrl ? 'HIKVISION' : (req.body.facePhotoSource || ''),
      biometricUserId: req.body.biometricUserId || assignedBioId,
      faceEnrollmentStatus: req.body.faceEnrollmentStatus || (req.body.faceEnrolled === true ? 'ENROLLED' : 'PENDING'),
      fingerprintEnrollmentStatus: req.body.fingerprintEnrollmentStatus || (req.body.fingerprintEnrolled === true ? 'ENROLLED' : 'PENDING'),
      faceEnrolledAt: req.body.faceEnrolledAt || null,
      biometricDeviceId: isHikvisionProvider() ? 'hikvision-main-gate' : (req.body.biometricDeviceId || ''),
      biometricDeviceType: isHikvisionProvider() ? 'Hikvision DS-K1T320EFWX' : (req.body.biometricDeviceType || ''),
      biometricId: assignedBioId,
      deviceUserId: assignedBioId,
      fingerprintStatus: req.body.fingerprintStatus || (req.body.fingerprintEnrolled ? 'ENROLLED' : 'NOT_ENROLLED'),
      fingerprintEnrolled: req.body.fingerprintEnrolled === true || req.body.fingerprintStatus === 'ENROLLED',
      fingerprintDeviceId: req.body.fingerprintDeviceId || null,
      fingerprintEnrolledAt: req.body.fingerprintEnrolledAt || null,
      fingerprintTemplateId: req.body.fingerprintTemplateId || null,
      faceStatus: req.body.faceStatus || 'NOT_ENROLLED',
      faceEnrolled: req.body.faceEnrolled === true,
      paymentStatus: finalPaymentStatus
    });
    db.invalidateMembersCache();

    // 1. Generate ONE authoritative MEMBERSHIP invoice for new member
    const invoiceNumber = req.body.invoiceNumber || `INV-${Math.floor(100000 + Math.random() * 900000)}`;
    const payment = await db.addPayment({
      memberId: member.id,
      memberName: member.name,
      memberPhone: member.phone,
      invoiceType: 'MEMBERSHIP',
      billingType: 'MEMBERSHIP',
      packageId: matchedPlan ? (matchedPlan.id || matchedPlan.name) : 'p_mon',
      packageName: plan || 'Monthly Standard',
      packagePrice: origAmount,
      originalAmount: origAmount,
      discountType: discType,
      discountValue: discVal,
      discountAmount: discAmount,
      discount: discAmount,
      taxAmount: taxAmount,
      tax: taxAmount,
      otherCharges: othCharges,
      netPayable: netPayable,
      amount: netPayable,
      amountPaid: amountPaid,
      paid: amountPaid,
      outstandingAmount: outstandingAmount,
      pendingAmount: outstandingAmount,
      plan: plan || 'Monthly Standard',
      paymentMethod: paymentMethod || 'UPI',
      method: paymentMethod || 'UPI',
      transactionType: 'membership_payment',
      isHistorical: false,
      imported: false,
      paymentDate: invoiceDate,
      status: finalPaymentStatus,
      invoiceNumber: invoiceNumber,
      invoice: invoiceNumber,
      billingDate: invoiceDate,
      date: invoiceDate,
      startDate: memStartDate,
      endDate: finalExpiry,
      expiryDate: finalExpiry,
      idempotencyKey: idempotencyKey
    });

    // 2. Generate SEPARATE PT invoice if Personal Trainer is selected
    let ptPayment = null;
    const ptData = req.body.ptBilling || req.body.pt;
    if (ptData && (ptData.enabled || ptData.trainerId || ptData.trainerName)) {
      const ptAmt = Number(ptData.originalAmount !== undefined ? ptData.originalAmount : (ptData.amount || ptData.price || 6000));
      const ptDisc = Number(ptData.discountAmount !== undefined ? ptData.discountAmount : (ptData.discount || 0));
      const ptTax = Number(ptData.taxAmount !== undefined ? ptData.taxAmount : (ptData.tax || 0));
      const ptNet = Math.max(0, ptAmt - ptDisc + ptTax);
      const ptPaid = Number(ptData.amountPaid !== undefined ? ptData.amountPaid : (ptData.paid !== undefined ? ptData.paid : ptNet));
      const ptPending = Math.max(0, ptNet - ptPaid);
      const ptInvNo = ptData.invoiceNo || ptData.invoiceNumber || `INV-PT-${Math.floor(100000 + Math.random() * 900000)}`;
      const ptStart = ptData.startDate || ptData.ptStartDate || startJoinDate;
      const ptEnd = ptData.expiryDate || ptData.ptEndDate || ptData.ptExpiryDate || calculateBackendPlanExpiry(ptData.duration || '3 Months', ptStart, []);

      ptPayment = await db.addPayment({
        memberId: member.id,
        memberName: member.name,
        memberPhone: member.phone,
        invoiceType: 'PT',
        billingType: 'PT',
        transactionType: 'pt_payment',
        isHistorical: false,
        imported: false,
        paymentDate: ptStart,
        trainerId: ptData.trainerId || req.body.trainerId || '',
        trainerName: ptData.trainerName || req.body.trainer || 'Personal Trainer',
        packageId: ptData.packageId || `pt_${ptData.duration || '3_months'}`,
        packageName: ptData.packageName || `Personal Training (${ptData.duration || '3 Months'})`,
        packagePrice: ptAmt,
        originalAmount: ptAmt,
        discountAmount: ptDisc,
        discount: ptDisc,
        taxAmount: ptTax,
        tax: ptTax,
        netPayable: ptNet,
        amount: ptNet,
        amountPaid: ptPaid,
        paid: ptPaid,
        outstandingAmount: ptPending,
        pendingAmount: ptPending,
        plan: `PT - ${ptData.duration || '3 Months'}`,
        paymentMethod: ptData.paymentMethod || ptData.method || paymentMethod || 'UPI',
        method: ptData.paymentMethod || ptData.method || paymentMethod || 'UPI',
        status: ptPending <= 0 ? 'paid' : (ptPaid > 0 ? 'partial' : 'pending'),
        invoiceNumber: ptInvNo,
        invoice: ptInvNo,
        billingDate: ptStart,
        date: ptStart,
        startDate: ptStart,
        endDate: ptEnd,
        expiryDate: ptEnd,
        idempotencyKey: `pt_${idempotencyKey}`
      });
    }

    console.log(`[Credentials Notification] Credentials prepared for ${name} (${loginEmail}) via simulated SMS & WhatsApp.`);

    // Trigger Automated Emails
    triggerWelcomeEmail(member).catch(err => console.error('[Automation] Welcome email failed:', err));
    if (payment.status === 'paid') {
      triggerPaymentEmail(payment).catch(err => console.error('[Automation] Payment email failed:', err));
    }

    // Server-side biometric fallback: whether the UI skipped or only partly finished face/fingerprint
    // enrollment, the server provisions the terminal user itself (user + photo-as-face) via the agent queue.
    let biometricSync: any = null;
    try {
      biometricSync = await queueHikvisionMemberSync({
        collection: 'members',
        recordId: String(member.id),
        biometricId: assignedBioId,
        name: String(name),
        source: (req.body.skipBiometric === true || req.body.biometricSetup === 'skipped') ? 'create_member_skipped' : 'create_member_server_fallback',
      });
    } catch (syncErr: any) {
      console.warn('[Biometric Sync] Could not queue server-side sync:', syncErr.message);
      biometricSync = { queued: false, reason: syncErr.message };
    }

    res.status(201).json({ ...member, invoice: payment, ptInvoice: ptPayment, biometricSync });
  } catch (error: any) {
    console.error('Failed to create member:', error);
    res.status(500).json({ error: error.message });
  }
};

export const updateMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Fetch old member details using multi-field matching
    const members = await db.getMembers();
    const cleanId = String(id || '').trim().toLowerCase();

    const oldMember = members.find(item => {
      const itemDocId = String(item.id || '').trim().toLowerCase();
      const itemUid = String(item.uid || '').trim().toLowerCase();
      const itemMemberId = String(item.memberId || '').trim().toLowerCase();
      return itemDocId === cleanId || itemUid === cleanId || itemMemberId === cleanId || itemDocId.endsWith(cleanId) || itemUid.endsWith(cleanId) || cleanId.endsWith(itemDocId) || cleanId.endsWith(itemUid);
    });

    const targetId = oldMember ? oldMember.id : id;

    const updated = await db.updateMember(targetId, req.body);
    if (!updated) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Trigger email if PT status switched from falsy/false to true
    const wasPt = oldMember?.isPt === true;
    const isNowPt = req.body.isPt === true;

    if (isNowPt && !wasPt) {
      triggerPtWelcomeEmail(updated).catch((err: any) => console.error('[Automation] PT welcome email trigger failed:', err));
    }

    if (req.body.expiryDate && req.body.expiryDate !== oldMember?.expiryDate) {
      resolveStaleRenewalFollowups(targetId, 'MEMBERSHIP', req.body.expiryDate).catch(() => {});
    }

    if (req.body.ptExpiryDate && req.body.ptExpiryDate !== oldMember?.ptExpiryDate) {
      resolveStaleRenewalFollowups(targetId, 'PT', req.body.ptExpiryDate).catch(() => {});
    }

    const currentBal = Number(req.body.outstandingBalance ?? req.body.balance ?? 0);
    if (req.body.outstandingBalance !== undefined && currentBal <= 0) {
      resolveStaleRenewalFollowups(targetId, 'BALANCE').catch(() => {});
    }

    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Fetch member details first to see if they have biometric data enrolled
    const members = await db.getMembers();
    const member = members.find(item => item.id === id);

    if (member && member.biometricId && isFirebaseInitialized && admin) {
      const firestore = admin.firestore();
      const docId = `del_${id}_${Date.now()}`;
      
      await firestore.collection('biometric_enrollment').doc(docId).set({
        docId,
        command: 'delete_biometric',
        status: 'pending',
        memberId: id,
        memberName: member.name || 'Member',
        biometricId: Number(member.biometricId),
        message: 'Deletion queued due to member removal...',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`[Biometric Sync] Queued fingerprint deletion for member ${member.name} (biometric ID: ${member.biometricId})`);
    }

    await db.deleteMember(id);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};


export const toggleFreezeMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const members = await db.getMembers();
    const m = members.find(item => item.id === id);
    if (!m) {
      return res.status(404).json({ error: 'Member not found' });
    }
    const newStatus = m.status === 'frozen' ? 'active' : 'frozen';
    const updated = await db.updateMember(id, { status: newStatus });
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const resetMemberPassword = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ error: 'Password is required' });
    }
    
    if (isFirebaseInitialized && admin) {
      await admin.auth().updateUser(id, { password });
      console.log(`[Credentials Notification] Password reset for member uid ${id}.`);
    } else {
      console.log(`[Mock Mode] Password reset for member ${id}.`);
    }

    res.json({ success: true, message: 'Password reset successful' });
  } catch (error: any) {
    console.error('Failed to reset password:', error);
    res.status(500).json({ error: error.message });
  }
};

export const sendMemberCredentials = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const list = await db.getMembers();
    const m = list.find(item => item.id === id);
    if (!m) {
      return res.status(404).json({ error: 'Member not found' });
    }

    const email = m.email || `${m.phone}@thewarriorgym.in`;
    console.log(`[Credentials Notification] Resent credentials to ${m.name} (${email}) via simulated Email, SMS & WhatsApp.`);

    res.json({ success: true, message: 'Credentials sent successfully' });
  } catch (error: any) {
    console.error('Failed to send credentials:', error);
    res.status(500).json({ error: error.message });
  }
};

/**
 * POST /members/:id/renew
 * Atomic membership renewal: writes billing record FIRST, then updates member.
 * If billing write fails, the member record is never touched → no half-state.
 * invoiceDate is the staff-selected business date (≠ createdAt which is DB timestamp).
 */
export const renewMembership = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const {
      plan,
      startDate,
      expiryDate,
      packagePrice,
      baseAmount,
      discountType,
      discountValue,
      discountAmount,
      taxAmount,
      netPayable,
      amountPaidToday,
      amountPaid,
      pendingAmount,
      paymentMethod,
      paymentStatus,
      invoiceDate,
      notes,
      invoiceNumber: providedInvoiceNumber,
    } = req.body;

    // ── Validation ──────────────────────────────────────────────
    if (!plan) return res.status(400).json({ error: 'Plan is required' });
    if (!startDate) return res.status(400).json({ error: 'Start date is required' });
    if (!expiryDate) return res.status(400).json({ error: 'Expiry date is required' });
    if (!paymentMethod) return res.status(400).json({ error: 'Payment method is required' });
    if (expiryDate <= startDate) return res.status(400).json({ error: 'Expiry date must be after start date' });

    const numPkgPrice = Math.max(0, Number(packagePrice !== undefined ? packagePrice : baseAmount) || 0);
    const rawDiscountType = String(discountType || 'fixed').toLowerCase() === 'percentage' ? 'percentage' : 'fixed';
    const numDiscountValue = Number(discountValue !== undefined ? discountValue : (discountAmount !== undefined ? discountAmount : 0)) || 0;

    // Strict Validation
    if (numDiscountValue < 0) {
      return res.status(400).json({ error: 'Discount cannot be negative.' });
    }

    if (rawDiscountType === 'fixed' && numDiscountValue > numPkgPrice) {
      return res.status(400).json({ error: 'Discount cannot exceed package amount.' });
    }

    if (rawDiscountType === 'percentage' && numDiscountValue > 100) {
      return res.status(400).json({ error: 'Discount percentage cannot exceed 100%.' });
    }

    let numDiscountAmount = 0;
    if (rawDiscountType === 'percentage') {
      const clampedPercent = Math.min(100, Math.max(0, numDiscountValue));
      numDiscountAmount = Math.round((numPkgPrice * clampedPercent) / 100);
    } else {
      numDiscountAmount = Math.min(numPkgPrice, Math.max(0, numDiscountValue));
    }

    const numTax = Math.max(0, Number(taxAmount) || 0);
    const numNetPayable = Math.max(0, numPkgPrice - numDiscountAmount + numTax);

    const rawAmountPaid = Number(amountPaidToday !== undefined ? amountPaidToday : (amountPaid !== undefined ? amountPaid : numNetPayable));
    if (rawAmountPaid < 0) {
      return res.status(400).json({ error: 'Amount paid today cannot be negative.' });
    }

    const numAmountPaid = Math.max(0, isNaN(rawAmountPaid) ? 0 : rawAmountPaid);
    if (numAmountPaid > numNetPayable) {
      return res.status(400).json({ error: 'Amount paid today cannot exceed Net Payable.' });
    }

    const numPending = Math.max(0, numNetPayable - numAmountPaid);
    const calculatedPaymentStatus = numPending <= 0 ? 'paid' : (numAmountPaid > 0 ? 'partial' : 'pending');

    const canonicalInvoiceDate = invoiceDate || new Date().toISOString().split('T')[0];
    const invoiceNumber = providedInvoiceNumber || `INV-${Math.floor(100000 + Math.random() * 900000)}`;
    const nowIso = new Date().toISOString();

    // ── Fetch existing member ────────────────────────────────────
    const existingMember = await db.getMemberById(id);
    if (!existingMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // ── STEP 1: Create billing/payment record ────────────────────
    // This MUST succeed before we touch the member record.
    let paymentRecord: any;
    try {
      paymentRecord = await db.addPayment({
        memberId: id,
        memberName: existingMember.name,
        memberPhone: existingMember.phone || '',
        invoiceType: 'MEMBERSHIP',
        billingType: 'MEMBERSHIP',
        transactionType: 'membership_renewal',
        plan,
        packageName: plan,
        originalAmount: numPkgPrice,
        packagePrice: numPkgPrice,
        baseAmount: numPkgPrice,
        discountType: rawDiscountType,
        discountValue: numDiscountValue,
        discountAmount: numDiscountAmount,
        discount: numDiscountAmount,
        taxAmount: numTax,
        tax: numTax,
        netPayable: numNetPayable,
        amount: numPkgPrice,
        amountPaidToday: numAmountPaid,
        // Crucial for Today's Collection: amountPaid is ONLY actual cash received
        amountPaid: numAmountPaid,
        paid: numAmountPaid,
        pendingAmount: numPending,
        outstandingAmount: numPending,
        remainingBalance: numPending,
        paymentMethod,
        method: paymentMethod,
        paymentStatus: calculatedPaymentStatus,
        status: calculatedPaymentStatus,
        // Canonical date fields — invoiceDate is the business date
        invoiceDate: canonicalInvoiceDate,
        billingDate: canonicalInvoiceDate,
        date: canonicalInvoiceDate,
        paymentDate: canonicalInvoiceDate,
        transactionDate: canonicalInvoiceDate,
        membershipStartDate: startDate,
        startDate,
        membershipExpiryDate: expiryDate,
        expiryDate,
        invoiceNumber,
        invoice: invoiceNumber,
        notes: notes || '',
        isHistorical: false,
        imported: false,
        isRenewal: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      });
    } catch (billingErr: any) {
      console.error('[Renewal] Billing write failed — member NOT updated:', billingErr.message);
      return res.status(500).json({
        error: 'Renewal could not be completed. No changes were saved. (Billing write failed: ' + billingErr.message + ')',
      });
    }

    // ── STEP 2: Update member record (only runs if billing succeeded) ──
    const existingHistory = Array.isArray(existingMember.membershipHistory)
      ? existingMember.membershipHistory
      : [];

    const historyEntry = {
      packageName: plan,
      startDate,
      expiryDate,
      amount: numNetPayable,
      amountPaid: numAmountPaid,
      pendingAmount: numPending,
      paymentMethod,
      paymentStatus: calculatedPaymentStatus,
      discount: numDiscountAmount,
      tax: numTax,
      invoiceNumber,
      invoiceDate: canonicalInvoiceDate,
      renewedAt: nowIso,
      notes: notes || '',
    };

    const updatedHistory = [historyEntry, ...existingHistory];

    let updatedMember: any;
    try {
      updatedMember = await db.updateMember(id, {
        plan,
        price: numPkgPrice,
        amount: numNetPayable,
        totalBilled: (Number(existingMember.totalBilled) || 0) + numNetPayable,
        totalPaid: (Number(existingMember.totalPaid) || 0) + numAmountPaid,
        outstandingBalance: numPending,
        startDate,
        expiryDate,
        status: 'active',
        paymentStatus: calculatedPaymentStatus,
        membershipHistory: updatedHistory,
        updatedAt: nowIso,
      });
    } catch (memberErr: any) {
      // Billing was written but member update failed — log for manual reconciliation
      console.error('[Renewal] Member update failed after billing write. Invoice:', invoiceNumber, memberErr.message);
      return res.status(500).json({
        error: 'Billing record was created but member profile update failed. Please contact support. Invoice: ' + invoiceNumber,
        invoiceNumber,
        partialSuccess: true,
      });
    }

    // ── STEP 3: Side-effects (non-blocking) ──────────────────────
    resolveStaleRenewalFollowups(id, 'MEMBERSHIP', expiryDate).catch(() => {});
    if (numPending <= 0) {
      resolveStaleRenewalFollowups(id, 'BALANCE').catch(() => {});
    }
    triggerPaymentEmail(paymentRecord).catch((err: any) => {
      console.error('[Renewal] Payment email trigger failed:', err.message);
    });

    res.json({
      success: true,
      member: updatedMember,
      payment: paymentRecord,
      invoiceNumber,
    });
  } catch (error: any) {
    console.error('[Renewal] Unexpected error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const upgradeMembership = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      plan,
      startDate,
      expiryDate,
      packagePrice,
      previousInvoiceId,
      previousInvoiceNumber,
      previousInvoiceDate,
      previousPlan,
      previousPaidAmount,
      adjustedAmount,
      discountType,
      discountValue,
      discountAmount,
      additionalAmountDue,
      additionalAmountPaid,
      paymentMethod,
      paymentStatus,
      invoiceDate,
      notes,
      invoiceNumber: providedInvoiceNumber,
    } = req.body;

    // Validation
    if (!plan) return res.status(400).json({ error: 'New plan is required' });
    if (!startDate) return res.status(400).json({ error: 'Start date is required' });
    if (!expiryDate) return res.status(400).json({ error: 'Expiry date is required' });
    if (!paymentMethod) return res.status(400).json({ error: 'Payment method is required' });

    const numPkgPrice = Math.max(0, Number(packagePrice) || 0);
    const numPrevPaid = Math.max(0, Number(previousPaidAmount) || 0);
    const numAdjusted = Math.max(0, Number(adjustedAmount !== undefined ? adjustedAmount : numPrevPaid));

    // 1. Authoritative base upgrade amount before discount
    const upgradeBaseAmount = Math.max(0, numPkgPrice - numAdjusted);

    // 2. Authoritative discount calculation & validation
    const rawDiscountType = String(discountType || 'fixed').toLowerCase() === 'percentage' ? 'percentage' : 'fixed';
    const numDiscountValue = Number(discountValue) || 0;

    if (numDiscountValue < 0) {
      return res.status(400).json({ error: 'Discount cannot be negative.' });
    }

    if (rawDiscountType === 'fixed' && numDiscountValue > upgradeBaseAmount) {
      return res.status(400).json({ error: 'Discount cannot exceed upgrade amount.' });
    }

    if (rawDiscountType === 'percentage' && numDiscountValue > 100) {
      return res.status(400).json({ error: 'Discount percentage cannot exceed 100%.' });
    }

    let numDiscountAmount = 0;
    if (rawDiscountType === 'percentage') {
      const clampedPercent = Math.min(100, Math.max(0, numDiscountValue));
      numDiscountAmount = Math.round((upgradeBaseAmount * clampedPercent) / 100);
    } else {
      numDiscountAmount = Math.min(upgradeBaseAmount, Math.max(0, numDiscountValue));
    }

    // 3. Authoritative net upgrade payable
    const netUpgradePayable = Math.max(0, upgradeBaseAmount - numDiscountAmount);

    // 4. Authoritative amount paid today & remaining balance
    const rawAddPaid = Number(additionalAmountPaid !== undefined ? additionalAmountPaid : netUpgradePayable);
    if (rawAddPaid < 0) {
      return res.status(400).json({ error: 'Amount Paid Today cannot be negative.' });
    }

    const numAddPaid = Math.max(0, isNaN(rawAddPaid) ? 0 : rawAddPaid);
    if (numAddPaid > netUpgradePayable) {
      return res.status(400).json({ error: 'Amount Paid Today cannot exceed Net Payable.' });
    }

    // Never allow remaining balance to become negative
    const numPending = Math.max(0, netUpgradePayable - numAddPaid);
    const calculatedStatus = numPending <= 0 ? 'paid' : (numAddPaid > 0 ? 'partial' : 'pending');

    const canonicalInvoiceDate = invoiceDate || new Date().toISOString().split('T')[0];
    const invoiceNumber = providedInvoiceNumber || `INV-UPG-${Math.floor(100000 + Math.random() * 900000)}`;
    const nowIso = new Date().toISOString();

    const existingMember = await db.getMemberById(id);
    if (!existingMember) {
      return res.status(404).json({ error: 'Member not found' });
    }

    // Step 1: Create the Upgraded Payment record in `payments` collection
    let paymentRecord: any;
    try {
      paymentRecord = await db.addPayment({
        memberId: id,
        memberName: existingMember.name,
        memberPhone: existingMember.phone || '',
        invoiceType: 'MEMBERSHIP',
        billingType: 'MEMBERSHIP',
        transactionType: 'membership_upgrade',
        isUpgrade: true,
        plan,
        packageName: plan,
        previousPlan: previousPlan || existingMember.plan || '',
        previousBillId: previousInvoiceId || '',
        oldInvoiceId: previousInvoiceId || '',
        previousInvoiceId: previousInvoiceId || '',
        previousInvoiceNumber: previousInvoiceNumber || '',
        previousInvoiceDate: previousInvoiceDate || '',
        previousPaidAmount: numPrevPaid,
        previousAdjustedAmount: numAdjusted,
        adjustedAmount: numAdjusted,
        originalAmount: numPkgPrice,
        packagePrice: numPkgPrice,
        baseAmount: numPkgPrice,
        amountBeforeDiscount: upgradeBaseAmount,
        upgradeDifference: upgradeBaseAmount,
        upgradeBaseAmount: upgradeBaseAmount,
        discountType: rawDiscountType,
        discountValue: numDiscountValue,
        discountAmount: numDiscountAmount,
        discount: numDiscountAmount,
        netPayable: netUpgradePayable,
        additionalAmountDue: netUpgradePayable,
        amount: numPkgPrice,
        additionalAmountPaid: numAddPaid,
        amountPaidToday: numAddPaid,
        // Crucial for Today's Collection: amountPaid is the actual additional cash collected today
        amountPaid: numAddPaid,
        paid: numAddPaid,
        totalAmountPaid: numAdjusted + numAddPaid,
        pendingAmount: numPending,
        outstandingAmount: numPending,
        remainingBalance: numPending,
        paymentMethod,
        method: paymentMethod,
        paymentStatus: calculatedStatus,
        status: calculatedStatus,
        invoiceDate: canonicalInvoiceDate,
        billingDate: canonicalInvoiceDate,
        date: canonicalInvoiceDate,
        paymentDate: canonicalInvoiceDate,
        transactionDate: canonicalInvoiceDate,
        membershipStartDate: startDate,
        startDate,
        membershipExpiryDate: expiryDate,
        expiryDate,
        invoiceNumber,
        invoice: invoiceNumber,
        notes: notes || `Membership Upgrade from ${previousPlan || existingMember.plan || 'previous package'} (${previousInvoiceNumber || 'INV-PREV'}). Adjusted: ₹${numAdjusted}, Discount: ₹${numDiscountAmount}, Additional Paid: ₹${numAddPaid}`,
        isHistorical: false,
        imported: false,
        createdAt: nowIso,
      });
    } catch (billingErr: any) {
      console.error('[Upgrade] Billing write failed:', billingErr.message);
      return res.status(500).json({
        error: 'Upgrade could not be completed. No changes were saved. (Billing write failed: ' + billingErr.message + ')',
      });
    }

    // Step 2: Mark previous invoice as upgraded if previousInvoiceId or previousInvoiceNumber is provided
    if (previousInvoiceId || previousInvoiceNumber) {
      try {
        const payments = await db.getPayments({ memberId: id });
        const targetOld = payments.find((p: any) => 
          (previousInvoiceId && (p.id === previousInvoiceId || p.invoice === previousInvoiceId || p.invoiceNumber === previousInvoiceId)) ||
          (previousInvoiceNumber && (p.invoiceNumber === previousInvoiceNumber || p.invoice === previousInvoiceNumber))
        );
        if (targetOld && targetOld.id) {
          await db.updatePayment(targetOld.id, {
            isUpgraded: true,
            upgradedToInvoice: invoiceNumber,
            upgradedAt: nowIso,
            // Keep original date, paymentDate, amount, and paid intact!
          });
        }
      } catch (oldInvErr: any) {
        console.warn('[Upgrade] Note: Link to previous invoice updated with warning:', oldInvErr.message);
      }
    }

    // Step 3: Update member profile
    const existingHistory = Array.isArray(existingMember.membershipHistory)
      ? existingMember.membershipHistory
      : [];

    const historyEntry = {
      packageName: plan,
      previousPackageName: previousPlan || existingMember.plan || '',
      type: 'UPGRADE',
      startDate,
      expiryDate,
      amount: numPkgPrice,
      packagePrice: numPkgPrice,
      previousPaidAdjusted: numAdjusted,
      upgradeBaseAmount,
      discountType: rawDiscountType,
      discountValue: numDiscountValue,
      discountAmount: numDiscountAmount,
      discount: numDiscountAmount,
      netPayable: netUpgradePayable,
      additionalAmountPaid: numAddPaid,
      pendingAmount: numPending,
      paymentMethod,
      paymentStatus: calculatedStatus,
      invoiceNumber,
      previousInvoiceNumber: previousInvoiceNumber || '',
      invoiceDate: canonicalInvoiceDate,
      upgradedAt: nowIso,
      notes: notes || '',
    };

    const updatedHistory = [historyEntry, ...existingHistory];

    const currentTotalBilled = Number(existingMember.totalBilled) || Number(existingMember.amount) || numPrevPaid;
    const currentTotalPaid = Number(existingMember.totalPaid) || Number(existingMember.paid) || numPrevPaid;

    const newTotalBilled = currentTotalBilled + netUpgradePayable;
    const newTotalPaid = currentTotalPaid + numAddPaid;

    let updatedMember: any;
    try {
      updatedMember = await db.updateMember(id, {
        plan,
        packageName: plan,
        price: numPkgPrice,
        amount: numPkgPrice,
        totalBilled: newTotalBilled,
        totalPaid: newTotalPaid,
        outstandingBalance: numPending,
        startDate,
        expiryDate,
        status: 'active',
        paymentStatus: calculatedStatus,
        membershipHistory: updatedHistory,
        updatedAt: nowIso,
      });
    } catch (memberErr: any) {
      console.error('[Upgrade] Member update failed after billing write. Invoice:', invoiceNumber, memberErr.message);
      return res.status(500).json({
        error: 'Billing record was created but member profile update failed. Invoice: ' + invoiceNumber,
        invoiceNumber,
        partialSuccess: true,
      });
    }

    // Step 4: Side effects (non-blocking)
    resolveStaleRenewalFollowups(id, 'MEMBERSHIP', expiryDate).catch(() => {});
    if (numPending <= 0) {
      resolveStaleRenewalFollowups(id, 'BALANCE').catch(() => {});
    }
    triggerPaymentEmail(paymentRecord).catch(() => {});

    res.json({
      success: true,
      member: updatedMember,
      payment: paymentRecord,
      invoiceNumber,
    });
  } catch (error: any) {
    console.error('[Upgrade] Unexpected error:', error.message);
    res.status(500).json({ error: error.message });
  }
};

export const importBulkHoldMembers = async (req: Request, res: Response) => {
  try {
    const { members: incomingMembers, skipExisting = true } = req.body;

    if (!Array.isArray(incomingMembers) || incomingMembers.length === 0) {
      return res.status(400).json({ error: 'No members provided for import' });
    }

    const existingMembers = await db.getMembers();
    const existingBioMap = new Map<string, any>();
    const existingPhoneMap = new Map<string, any>();

    existingMembers.forEach((m: any) => {
      const bioId = String(m.biometricId || m.employeeId || m.hikvisionUserId || m.biometricUserId || m.deviceUserId || '').trim().toLowerCase();
      if (bioId) {
        existingBioMap.set(bioId, m);
      }
      const cleanPhone = String(m.phone || '').replace(/\D/g, '');
      if (cleanPhone && cleanPhone.length >= 7) {
        existingPhoneMap.set(cleanPhone, m);
      }
    });

    const created: any[] = [];
    const skipped: any[] = [];
    const updated: any[] = [];
    const invalid: any[] = [];

    // Track duplicates inside the incoming batch itself
    const batchSeenBioIds = new Set<string>();

    for (let i = 0; i < incomingMembers.length; i++) {
      const row = incomingMembers[i];
      const rawName = String(row.name || row.memberName || '').trim();
      const rawBioId = String(row.biometricId !== undefined ? row.biometricId : (row.employeeId !== undefined ? row.employeeId : (row.userId || row.id || ''))).trim();
      const rawPhone = String(row.phone || row.mobile || '').trim();
      const cleanPhone = rawPhone.replace(/\D/g, '');

      if (!rawName || !rawBioId) {
        invalid.push({ index: i + 1, row, reason: !rawName ? 'Missing Name' : 'Missing Biometric ID' });
        continue;
      }

      const bioKey = rawBioId.toLowerCase();

      // Check duplicate within incoming file
      if (batchSeenBioIds.has(bioKey)) {
        skipped.push({
          biometricId: rawBioId,
          name: rawName,
          reason: 'Duplicate Biometric ID within spreadsheet batch'
        });
        continue;
      }
      batchSeenBioIds.add(bioKey);

      // Check existing in database
      const existingMember = existingBioMap.get(bioKey);

      if (existingMember) {
        if (skipExisting) {
          skipped.push({
            biometricId: rawBioId,
            name: rawName,
            existingName: existingMember.name,
            reason: `Member with Biometric ID ${rawBioId} already exists in CRM (${existingMember.name})`
          });
          continue;
        } else {
          // Update existing member basic fields without touching membership/billing
          const updatedDoc = await db.updateMember(existingMember.id, {
            name: rawName,
            biometricId: rawBioId,
            employeeId: rawBioId,
            hikvisionUserId: rawBioId,
            ...(rawPhone ? { phone: rawPhone } : {}),
            ...(row.gender ? { gender: row.gender } : {}),
            ...(row.address ? { address: row.address } : {}),
            updatedAt: new Date().toISOString()
          });
          updated.push({
            id: existingMember.id,
            biometricId: rawBioId,
            name: rawName
          });
          continue;
        }
      }

      // Create new HOLD member
      // Note: NO membership, NO invoice, NO payment, status is strictly 'HOLD' / 'PENDING_ACTIVATION'
      const todayStr = new Date().toISOString().split('T')[0];
      const newMemberPayload = {
        name: rawName,
        biometricId: rawBioId,
        employeeId: rawBioId,
        hikvisionUserId: rawBioId,
        biometricUserId: rawBioId,
        deviceUserId: rawBioId,
        status: 'HOLD',
        membershipStatus: 'HOLD',
        activationStatus: 'PENDING_ACTIVATION',
        phone: rawPhone || '',
        email: row.email || (rawPhone ? `${cleanPhone}@thewarriorgym.in` : ''),
        gender: row.gender || 'Male',
        branch: row.branch || 'Mohali, Punjab',
        address: row.address || '',
        plan: null,
        packageName: null,
        membershipPlan: null,
        originalPackageName: null,
        startDate: null,
        expiryDate: null,
        membershipStartDate: null,
        membershipExpiryDate: null,
        daysLeft: null,
        joinDate: todayStr,
        createdAt: new Date().toISOString(),
        totalPackageAmount: 0,
        totalBilled: 0,
        price: 0,
        amount: 0,
        totalPaid: 0,
        amountPaid: 0,
        paid: 0,
        balance: 0,
        balanceAmount: 0,
        outstandingBalance: 0,
        pendingBalance: 0,
        paymentStatus: 'NOT_BILLED',
        source: 'excel_import',
        importedAt: new Date().toISOString(),
        membershipHistory: [],
        payments: []
      };

      const added = await db.addMember(newMemberPayload);
      existingBioMap.set(bioKey, added);
      created.push({
        id: added.id,
        memberId: added.memberId,
        biometricId: rawBioId,
        name: rawName,
        status: 'hold'
      });
    }

    res.status(200).json({
      success: true,
      message: `Successfully processed ${incomingMembers.length} rows: ${created.length} created in HOLD status, ${skipped.length} skipped, ${updated.length} updated.`,
      createdCount: created.length,
      skippedCount: skipped.length,
      updatedCount: updated.length,
      invalidCount: invalid.length,
      created,
      skipped,
      updated,
      invalid
    });
  } catch (error: any) {
    console.error('Failed to bulk import hold members:', error);
    res.status(500).json({ error: error.message || 'Bulk import failed' });
  }
};
