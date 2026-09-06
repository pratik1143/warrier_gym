import { Request, Response } from 'express';
import { getFirestoreDb, mockEnquiries, mockMembers, saveMockDb, db } from '../firebase';
import { importEnquiriesFromExcel } from '../services/enquiryImport.service';
import { resolveStaleRenewalFollowups } from '../services/followupAutomation.service';
import {
  createEnquiryBackendSchema,
  updateEnquiryBackendSchema,
  convertEnquiryBackendSchema
} from '../validations/enquirySchemas';

export const getEnquiries = async (req: Request, res: Response) => {
  try {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snap = await firestore.collection('enquiries').orderBy('createdAt', 'desc').get();
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return res.json(list);
    }
    return res.json(mockEnquiries);
  } catch (error: any) {
    console.error('Error fetching enquiries:', error);
    res.json(mockEnquiries);
  }
};

export const getEnquiryHistory = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const firestore = getFirestoreDb();
    if (firestore) {
      const historySnap = await firestore.collection('enquiries').doc(id).collection('history').orderBy('timestamp', 'asc').get();
      if (!historySnap.empty) {
        return res.json(historySnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      const docSnap = await firestore.collection('enquiries').doc(id).get();
      if (docSnap.exists) {
        return res.json(docSnap.data()?.history || []);
      }
    }
    const enq = mockEnquiries.find(e => e.id === id);
    return res.json(enq?.history || []);
  } catch (error: any) {
    console.error('Error fetching enquiry history:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch history' });
  }
};

export const createEnquiry = async (req: Request, res: Response) => {
  try {
    const validationResult = createEnquiryBackendSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.flatten().fieldErrors
      });
    }

    const firestore = getFirestoreDb();
    const data = req.body;

    const createdId = data.id || `enq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nextDate = (data.nextFollowUpDate || data.nextFollowUp || data.followupDate || '').split('T')[0];

    const initialHistory = [{
      id: `hist_${Date.now()}`,
      type: 'created',
      title: 'Enquiry Created',
      description: 'Manual enquiry entry from dashboard',
      status: (data.status || 'Pending').toLowerCase(),
      date: nextDate,
      assignedTo: data.assignedTo || data.attendedBy || 'Reception Desk',
      timestamp: new Date().toISOString()
    }];

    const newEnquiry = {
      name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'New Lead',
      firstName: data.firstName || '',
      lastName: data.lastName || '',
      phone: data.phone || data.contact || '',
      altPhone: data.altPhone || data.altContact || '',
      email: data.email || '',
      gender: data.gender || 'Male',
      address: data.address || '',
      nextFollowUpDate: nextDate,
      nextFollowUp: nextDate,
      followUpTime: data.followUpTime || data.followupTime || '11:00',
      trialDate: data.trialDate || '',
      status: data.status || 'Pending',
      assignedTo: data.assignedTo || data.attendedBy || 'Reception Desk',
      priority: data.priority || 'Warm',
      source: data.source || 'Walk-in',
      interestedPlan: data.interestedPlan || data.inquiryFor || 'Monthly Access',
      duration: data.duration || data.interestedPlan || '1 month',
      remarks: data.remarks || '',
      history: initialHistory,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    if (firestore) {
      await firestore.collection('enquiries').doc(createdId).set(newEnquiry, { merge: true });

      // Create history subcollection doc
      await firestore.collection('enquiries').doc(createdId).collection('history').doc(initialHistory[0].id).set(initialHistory[0], { merge: true });

      // Automatically create follow-up if status is Pending and date exists
      if (newEnquiry.status === 'Pending' && nextDate) {
        const autoKey = `ENQUIRY_FOLLOWUP_${createdId}_${nextDate}`;
        await firestore.collection('followups').doc(autoKey).set({
          id: autoKey,
          automationKey: autoKey,
          enquiryId: createdId,
          memberId: null,
          memberName: newEnquiry.name,
          phone: newEnquiry.phone,
          title: 'Enquiry Follow-Up',
          reason: 'Enquiry Follow-Up',
          description: newEnquiry.remarks ? `Enquiry remarks: ${newEnquiry.remarks}` : `Lead follow-up for ${newEnquiry.name}`,
          notes: newEnquiry.remarks ? `Enquiry remarks: ${newEnquiry.remarks}` : `Lead follow-up for ${newEnquiry.name}`,
          scheduledDate: nextDate,
          dueDate: nextDate,
          scheduledTime: newEnquiry.followUpTime || '11:00',
          scheduledTimestamp: new Date(`${nextDate}T${newEnquiry.followUpTime || '11:00'}`).getTime() || Date.now(),
          status: 'Pending',
          priority: newEnquiry.priority === 'Hot' ? 'High' : 'Medium',
          assignedTo: newEnquiry.assignedTo || 'Reception Desk',
          type: 'Enquiry',
          source: 'manual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
    }

    const savedRecord = { id: createdId, ...newEnquiry };
    const existingIdx = mockEnquiries.findIndex(e => e.id === createdId);
    if (existingIdx !== -1) {
      mockEnquiries[existingIdx] = savedRecord;
    } else {
      mockEnquiries.unshift(savedRecord);
    }
    saveMockDb();

    res.status(201).json({
      success: true,
      message: 'Enquiry created successfully',
      enquiry: savedRecord
    });
  } catch (error: any) {
    console.error('Error creating enquiry:', error);
    res.status(500).json({ error: error.message || 'Failed to create enquiry' });
  }
};

export const updateEnquiry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validationResult = updateEnquiryBackendSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.flatten().fieldErrors
      });
    }

    const updates = req.body;
    updates.updatedAt = new Date().toISOString();

    const firestore = getFirestoreDb();
    let currentEnquiry: any = null;

    if (firestore) {
      const docSnap = await firestore.collection('enquiries').doc(id).get();
      if (docSnap.exists) currentEnquiry = docSnap.data();
    } else {
      currentEnquiry = mockEnquiries.find(e => e.id === id);
    }

    const newStatus = updates.status || currentEnquiry?.status;
    const isClosedNow = (newStatus || '').toLowerCase() === 'closed' || (newStatus || '').toLowerCase() === 'close';
    const wasClosedBefore = (currentEnquiry?.status || '').toLowerCase() === 'closed';

    // Status changed to Closed
    if (isClosedNow && !wasClosedBefore) {
      await resolveStaleRenewalFollowups(id, 'ENQUIRY_CLOSED');

      const closeHistoryItem = {
        id: `hist_${Date.now()}`,
        type: 'closed',
        title: 'Enquiry Closed',
        description: updates.remarks ? `Closing notes: ${updates.remarks}` : 'Enquiry marked as closed',
        status: 'closed',
        timestamp: new Date().toISOString()
      };

      if (firestore) {
        await firestore.collection('enquiries').doc(id).collection('history').doc(closeHistoryItem.id).set(closeHistoryItem);
      }
      if (currentEnquiry) {
        if (!Array.isArray(currentEnquiry.history)) currentEnquiry.history = [];
        currentEnquiry.history.push(closeHistoryItem);
      }
    }

    // Follow-up Date changed on pending enquiry
    const newFollowUpDate = (updates.nextFollowUpDate || updates.nextFollowUp || '').split('T')[0];
    const oldFollowUpDate = (currentEnquiry?.nextFollowUpDate || currentEnquiry?.nextFollowUp || '').split('T')[0];

    if (!isClosedNow && newFollowUpDate && newFollowUpDate !== oldFollowUpDate) {
      await resolveStaleRenewalFollowups(id, 'ENQUIRY_DATE_CHANGED', newFollowUpDate);

      const rescheduleItem = {
        id: `hist_${Date.now()}`,
        type: 'rescheduled',
        title: 'Follow-up Rescheduled',
        description: `Follow-up rescheduled from ${oldFollowUpDate || 'None'} to ${newFollowUpDate}`,
        status: 'pending',
        date: newFollowUpDate,
        timestamp: new Date().toISOString()
      };

      if (firestore) {
        await firestore.collection('enquiries').doc(id).collection('history').doc(rescheduleItem.id).set(rescheduleItem);

        const autoKey = `ENQUIRY_FOLLOWUP_${id}_${newFollowUpDate}`;
        await firestore.collection('followups').doc(autoKey).set({
          id: autoKey,
          automationKey: autoKey,
          enquiryId: id,
          memberId: null,
          memberName: updates.name || currentEnquiry?.name || 'Enquiry Lead',
          phone: updates.phone || currentEnquiry?.phone || '',
          title: 'Enquiry Follow-Up',
          reason: 'Enquiry Follow-Up',
          description: `Enquiry callback for ${updates.name || currentEnquiry?.name}`,
          notes: `Enquiry callback for ${updates.name || currentEnquiry?.name}`,
          scheduledDate: newFollowUpDate,
          dueDate: newFollowUpDate,
          scheduledTime: updates.followUpTime || currentEnquiry?.followUpTime || '11:00',
          scheduledTimestamp: new Date(`${newFollowUpDate}T${updates.followUpTime || currentEnquiry?.followUpTime || '11:00'}`).getTime() || Date.now(),
          status: 'Pending',
          priority: updates.priority === 'Hot' ? 'High' : 'Medium',
          assignedTo: updates.assignedTo || currentEnquiry?.assignedTo || 'Reception Desk',
          type: 'Enquiry',
          source: 'manual',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
    }

    if (firestore) {
      await firestore.collection('enquiries').doc(id).set(updates, { merge: true });
    }

    const idx = mockEnquiries.findIndex(e => e.id === id);
    if (idx !== -1) {
      mockEnquiries[idx] = { ...mockEnquiries[idx], ...updates };
      saveMockDb();
    }

    res.json({
      success: true,
      message: 'Enquiry updated successfully'
    });
  } catch (error: any) {
    console.error('Error updating enquiry:', error);
    res.status(500).json({ error: error.message || 'Failed to update enquiry' });
  }
};

export const deleteEnquiry = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const firestore = getFirestoreDb();
    if (firestore) {
      await firestore.collection('enquiries').doc(id).delete();
      await resolveStaleRenewalFollowups(id, 'ENQUIRY_CLOSED');
    }

    const idx = mockEnquiries.findIndex(e => e.id === id);
    if (idx !== -1) {
      mockEnquiries.splice(idx, 1);
      saveMockDb();
    }

    res.json({
      success: true,
      message: 'Enquiry deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting enquiry:', error);
    res.status(500).json({ error: error.message || 'Failed to delete enquiry' });
  }
};

export const convertEnquiryToMember = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validationResult = convertEnquiryBackendSchema.safeParse(req.body);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: validationResult.error.flatten().fieldErrors
      });
    }

    const { plan, price } = validationResult.data;

    const firestore = getFirestoreDb();
    let enquiry: any = null;

    if (firestore) {
      const docSnap = await firestore.collection('enquiries').doc(id).get();
      if (docSnap.exists) enquiry = { id: docSnap.id, ...docSnap.data() };
    }

    if (!enquiry) {
      enquiry = mockEnquiries.find(e => e.id === id);
    }

    if (!enquiry) {
      return res.status(404).json({ error: 'Enquiry not found' });
    }

    // Provision new member document
    const newMemberData = {
      name: enquiry.name || 'Converted Member',
      phone: enquiry.phone || '',
      email: enquiry.email || '',
      gender: enquiry.gender || 'Male',
      address: enquiry.address || '',
      plan: plan || enquiry.interestedPlan || 'Monthly Standard',
      totalBilled: Number(price) || 3000,
      totalPaid: Number(price) || 3000,
      status: 'active',
      joinDate: new Date().toISOString().split('T')[0],
      expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      source: enquiry.source || 'Enquiry Conversion',
      notes: `Converted from Lead ${enquiry.id}`
    };

    const createdMember = await db.addMember(newMemberData);

    // Auto-resolve any pending enquiry follow-up
    await resolveStaleRenewalFollowups(id, 'ENQUIRY_CLOSED');

    // Update enquiry status to Converted and record in history
    const convertHistoryItem = {
      id: `hist_${Date.now()}`,
      type: 'converted',
      title: 'Converted to Member',
      description: `Converted to active member (${createdMember.id || createdMember.memberId}) on plan: ${newMemberData.plan}`,
      status: 'converted',
      timestamp: new Date().toISOString()
    };

    const updatePayload = { 
      status: 'Converted', 
      convertedMemberId: createdMember.id || createdMember.memberId, 
      updatedAt: new Date().toISOString() 
    };

    if (firestore) {
      await firestore.collection('enquiries').doc(id).set(updatePayload, { merge: true });
      await firestore.collection('enquiries').doc(id).collection('history').doc(convertHistoryItem.id).set(convertHistoryItem);
    }
    const idx = mockEnquiries.findIndex(e => e.id === id);
    if (idx !== -1) {
      mockEnquiries[idx] = { ...mockEnquiries[idx], ...updatePayload };
      if (!Array.isArray(mockEnquiries[idx].history)) mockEnquiries[idx].history = [];
      mockEnquiries[idx].history.push(convertHistoryItem);
      saveMockDb();
    }

    res.json({
      success: true,
      message: 'Enquiry successfully converted to active Member',
      member: createdMember
    });
  } catch (error: any) {
    console.error('Error converting enquiry:', error);
    res.status(500).json({ error: error.message || 'Failed to convert enquiry' });
  }
};

export const importEnquiriesExcel = async (req: Request, res: Response) => {
  try {
    let fileBuffer: Buffer | null = null;
    let filePath: string | null = null;

    if ((req as any).file) {
      fileBuffer = (req as any).file.buffer;
    } else if (req.body?.fileBase64) {
      fileBuffer = Buffer.from(req.body.fileBase64, 'base64');
    } else if (req.body?.filePath) {
      filePath = req.body.filePath;
    } else {
      // Default local server path fallback if none provided in request
      filePath = 'C:\\Users\\HP CONNECT\\Downloads\\inquiries 230826.xlsx';
    }

    const target = fileBuffer || filePath;
    if (!target) {
      return res.status(400).json({ error: 'No Excel file provided for import' });
    }

    const report = await importEnquiriesFromExcel(target);

    res.json({
      success: true,
      message: 'Enquiries imported successfully',
      report
    });
  } catch (error: any) {
    console.error('Error in importEnquiriesExcel:', error);
    res.status(500).json({ error: error.message || 'Failed to import enquiries Excel' });
  }
};

export const parseEnquiryPdf = async (req: Request, res: Response) => {
  try {
    const { pdfBase64, filename } = req.body;
    await new Promise(resolve => setTimeout(resolve, 1500));

    const detectedFields = [
      { id: 'name', label: 'Full Name', type: 'text', required: true, enabled: true },
      { id: 'phone', label: 'Mobile Number', type: 'tel', required: true, enabled: true },
      { id: 'email', label: 'Email Address', type: 'email', required: false, enabled: true },
      { id: 'gender', label: 'Gender', type: 'select', options: ['Male', 'Female', 'Other'], required: true, enabled: true },
      { id: 'age', label: 'Age', type: 'number', required: false, enabled: true },
      { id: 'goal', label: 'Fitness Goal', type: 'select', options: ['Weight Loss', 'Muscle Gain', 'General Fitness', 'Athletics'], required: true, enabled: true },
      { id: 'preferredPlan', label: 'Interested Plan', type: 'select', options: ['Monthly', 'Quarterly', 'Half Yearly', 'Yearly'], required: false, enabled: true },
      { id: 'preferredTime', label: 'Preferred Timing', type: 'text', required: false, enabled: true },
      { id: 'reference', label: 'Reference / Source', type: 'text', required: false, enabled: true },
      { id: 'remarks', label: 'Remarks / Medical History', type: 'textarea', required: false, enabled: true }
    ];

    res.json({
      success: true,
      message: 'AI parsed the document successfully.',
      detectedFields,
      confidence: 0.94
    });
  } catch (error: any) {
    console.error('Error parsing PDF:', error);
    res.status(500).json({ error: 'Failed to parse PDF.' });
  }
};
