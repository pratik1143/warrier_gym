import { Request, Response } from 'express';
import { getFirestoreDb } from '../firebase';
import { generateAutomatedFollowups } from '../services/followupAutomation.service';

export const getFollowups = async (req: Request, res: Response) => {
  try {
    const firestore = getFirestoreDb();
    if (firestore) {
      const snap = await firestore.collection('followups').orderBy('scheduledTimestamp', 'asc').get();
      const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return res.json(list);
    }
    return res.json([]);
  } catch (error: any) {
    console.error('Error fetching followups:', error);
    return res.json([]);
  }
};

export const createFollowup = async (req: Request, res: Response) => {
  try {
    const firestore = getFirestoreDb();
    const data = req.body;

    const scheduledDate = data.scheduledDate || data.dueDate || new Date().toISOString().split('T')[0];
    const scheduledTime = data.scheduledTime || '10:00';
    const scheduledTimestamp = data.scheduledTimestamp || new Date(`${scheduledDate}T${scheduledTime}`).getTime() || Date.now();

    const payload = {
      memberId: data.memberId || null,
      enquiryId: data.enquiryId || null,
      employeeId: data.employeeId || null,
      memberName: data.memberName || data.name || '',
      memberPhone: data.memberPhone || data.phone || '',
      name: data.name || data.memberName || '',
      phone: data.phone || data.memberPhone || '',
      title: data.title || data.reason || data.notes || 'Follow-up Task',
      reason: data.reason || data.title || data.notes || 'Follow-up Task',
      description: data.description || data.notes || '',
      notes: data.notes || data.description || '',
      type: data.type || 'General',
      priority: data.priority || 'Medium',
      assignedTo: data.assignedTo || 'Receptionist',
      scheduledDate,
      dueDate: data.dueDate || scheduledDate,
      scheduledTime,
      scheduledTimestamp,
      status: data.status || 'pending',
      source: data.source || 'manual',
      automationKey: data.automationKey || null,
      plan: data.plan || '',
      pendingAmount: data.pendingAmount !== undefined ? data.pendingAmount : null,
      createdAt: data.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    let createdId = data.id || (data.automationKey ? data.automationKey : `fol_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

    if (firestore) {
      if (data.id || data.automationKey) {
        createdId = data.id || data.automationKey;
        await firestore.collection('followups').doc(createdId).set(payload, { merge: true });
      } else {
        const docRef = await firestore.collection('followups').add(payload);
        createdId = docRef.id;
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Follow-up created successfully',
      followup: { id: createdId, ...payload }
    });
  } catch (error: any) {
    console.error('Error creating followup:', error);
    return res.status(500).json({ error: error.message || 'Failed to create follow-up' });
  }
};

export const updateFollowup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const firestore = getFirestoreDb();

    if (firestore) {
      await firestore.collection('followups').doc(id).update({
        ...updates,
        updatedAt: new Date().toISOString()
      });
    }

    return res.json({ success: true, message: 'Follow-up updated successfully' });
  } catch (error: any) {
    console.error('Error updating followup:', error);
    return res.status(500).json({ error: error.message || 'Failed to update follow-up' });
  }
};

export const deleteFollowup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const firestore = getFirestoreDb();

    if (firestore) {
      await firestore.collection('followups').doc(id).delete();
    }

    return res.json({ success: true, message: 'Follow-up deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting followup:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete follow-up' });
  }
};

export const triggerAutomatedFollowups = async (req: Request, res: Response) => {
  try {
    const { dateOverride } = req.body || {};
    const result = await generateAutomatedFollowups(dateOverride);
    return res.json({
      success: true,
      message: 'Automated follow-up generation completed',
      ...result
    });
  } catch (error: any) {
    console.error('Error in triggerAutomatedFollowups:', error);
    return res.status(500).json({ error: error.message || 'Failed to generate automated follow-ups' });
  }
};
