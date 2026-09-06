import { Request, Response } from 'express';
import { db, admin, isFirebaseInitialized } from '../firebase';
import { triggerWelcomeEmail, triggerPaymentEmail, triggerPtWelcomeEmail } from '../services/automation.service';
import { resolveStaleRenewalFollowups } from '../services/followupAutomation.service';

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

    let uid = 'm' + Date.now();
    const loginEmail = email || `${phone}@thewarriorgym.in`;

    if (isFirebaseInitialized && admin) {
      const authAdmin = admin.auth();
      const firestoreAdmin = admin.firestore();
      
      try {
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
            console.warn('[Firebase Auth Warning] Auth lookup skipped:', err.message);
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
        }, { merge: true }).catch(() => {});
      } catch (authErr: any) {
        console.warn('[Firebase Auth Warning] User provisioning skipped:', authErr.message);
      }
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const startJoinDate = joinDate || todayStr;
    const memStartDate = req.body.startDate || startJoinDate;
    const plansList = await db.getPlans();
    
    let finalExpiry = expiryDate;
    if (!finalExpiry || finalExpiry === startJoinDate) {
      finalExpiry = calculateBackendPlanExpiry(plan || 'Monthly', memStartDate, plansList);
    }

    const matchedPlan = plansList.find(p => {
      const dbName = String(p.name || '').toLowerCase();
      const dbId = String(p.id || '').toLowerCase();
      const reqName = String(plan || '').toLowerCase();
      return dbName === reqName || dbId === reqName;
    });

    const origAmount = Number(req.body.originalAmount !== undefined ? req.body.originalAmount : (price || amount || (matchedPlan ? matchedPlan.price : 2500)));
    const discAmount = Number(req.body.discountAmount !== undefined ? req.body.discountAmount : (req.body.discount || 0));
    const taxAmount = Number(req.body.taxAmount !== undefined ? req.body.taxAmount : (req.body.tax || req.body.gst || 0));
    const othCharges = Number(req.body.otherCharges || 0);

    const calculatedNet = Math.max(0, origAmount - discAmount + taxAmount + othCharges);
    const netPayable = Number(req.body.netPayable !== undefined ? req.body.netPayable : (req.body.totalBilled !== undefined ? req.body.totalBilled : calculatedNet));
    const amountPaid = Number(totalPaid !== undefined ? totalPaid : (req.body.paid !== undefined ? req.body.paid : netPayable));
    const outstandingAmount = Math.max(0, netPayable - amountPaid);
    const finalPaymentStatus = paymentStatus || (outstandingAmount <= 0 ? 'paid' : (amountPaid > 0 ? 'partial' : 'pending'));
    const initialStatus = memStartDate > todayStr ? 'upcoming' : (req.body.status || 'active');

    const idempotencyKey = req.body.idempotencyKey || `mem_${phone}_${plan || 'Monthly'}_${startJoinDate}`;

    const member = await db.addMember({
      uid, // align document ID with Auth UID
      name, phone, email: loginEmail, plan: plan || 'Monthly',
      price: origAmount,
      amount: netPayable,
      originalAmount: origAmount,
      discountAmount: discAmount,
      discount: discAmount,
      netPayable: netPayable,
      totalBilled: netPayable,
      totalPaid: amountPaid,
      outstandingBalance: outstandingAmount,
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
      avatarUrl: avatarUrl || '',
      biometricId: biometricId || '',
      biometricUserId: req.body.biometricUserId || biometricId || '',
      faceEnrollmentStatus: req.body.faceEnrollmentStatus || 'PENDING',
      fingerprintEnrollmentStatus: req.body.fingerprintEnrollmentStatus || 'PENDING',
      faceEnrolledAt: req.body.faceEnrolledAt || null,
      fingerprintEnrolledAt: req.body.fingerprintEnrolledAt || null,
      biometricDeviceId: 'hikvision-main-gate',
      biometricDeviceType: 'Hikvision DS-K1T320EFWX',
      paymentStatus: finalPaymentStatus
    });

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
      paymentDate: startJoinDate,
      status: finalPaymentStatus,
      invoiceNumber: invoiceNumber,
      invoice: invoiceNumber,
      billingDate: startJoinDate,
      date: startJoinDate,
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

    console.log(`[Credentials Notification] Sent credentials to ${name} (${loginEmail}) via simulated SMS & WhatsApp. Password: ${password || '1234567'}`);

    // Trigger Automated Emails
    triggerWelcomeEmail(member).catch(err => console.error('[Automation] Welcome email failed:', err));
    if (payment.status === 'paid') {
      triggerPaymentEmail(payment).catch(err => console.error('[Automation] Payment email failed:', err));
    }

    res.status(201).json({ ...member, invoice: payment, ptInvoice: ptPayment });
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
      console.log(`[Credentials Notification] Reset password for member uid ${id} to ${password}`);
    } else {
      console.log(`[Mock Mode] Reset password for member ${id} to ${password}`);
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
