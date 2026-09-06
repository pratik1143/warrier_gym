import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, doc, updateDoc, setDoc, deleteDoc, getDocs } from 'firebase/firestore';
import API from '@/services/api';

export interface EnquiryHistoryItem {
  id?: string;
  type?: string;
  title?: string;
  description?: string;
  status?: string;
  date?: string;
  assignedTo?: string;
  duration?: string;
  source?: string;
  timestamp?: string;
  importedAt?: string;
}

export interface EnquiryItem {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  phone: string;
  altPhone?: string;
  email?: string;
  gender?: string;
  address?: string;
  nextFollowUp?: string;
  nextFollowUpDate?: string;
  followUpTime?: string;
  trialDate?: string;
  status: 'Pending' | 'Closed' | 'Contacted' | 'Trial Scheduled' | 'Converted' | 'Lost' | string;
  assignedTo?: string;
  priority: 'Hot' | 'Warm' | 'Cold' | string;
  source?: string;
  interestedPlan?: string;
  duration?: string;
  remarks?: string;
  history?: EnquiryHistoryItem[];
  createdAt: string;
  updatedAt?: string;
}

export const enquiryService = {
  // Real-time listener with deduplication and API fallback
  subscribe: (onData: (items: EnquiryItem[]) => void, onError?: (err: Error) => void) => {
    let firestoreLoaded = false;

    // Initial fetch via API fallback
    API.get('/enquiries')
      .then((res) => {
        if (Array.isArray(res.data) && res.data.length > 0 && !firestoreLoaded) {
          const list: EnquiryItem[] = res.data.map((d: any) => {
            const rawStatus = (d.status || 'Pending').trim().toLowerCase();
            const normStatus = rawStatus === 'close' || rawStatus === 'closed' ? 'Closed' : rawStatus === 'converted' ? 'Converted' : 'Pending';
            const cleanDate = (d.nextFollowUpDate || d.nextFollowUp || d.followupDate || '').split('T')[0];

            return {
              ...d,
              status: normStatus,
              priority: d.priority || 'Warm',
              name: d.name || `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Enquiry Lead',
              phone: d.phone || d.contact || '',
              duration: d.duration || d.interestedPlan || d.inquiryFor || '1 month',
              interestedPlan: d.interestedPlan || d.duration || '1 month',
              nextFollowUpDate: cleanDate,
              nextFollowUp: cleanDate,
              history: Array.isArray(d.history) ? d.history : []
            };
          });
          onData(list);
        }
      })
      .catch(() => {});

    const q = query(collection(db, 'enquiries'));
    return onSnapshot(
      q,
      (snapshot) => {
        firestoreLoaded = true;
        const itemMap = new Map<string, EnquiryItem>();

        snapshot.docs.forEach((docSnap) => {
          const d = docSnap.data();
          const rawStatus = (d.status || 'Pending').trim().toLowerCase();
          const normStatus = rawStatus === 'close' || rawStatus === 'closed' ? 'Closed' : rawStatus === 'converted' ? 'Converted' : 'Pending';
          const cleanDate = (d.nextFollowUpDate || d.nextFollowUp || d.followupDate || '').split('T')[0];

          const item: EnquiryItem = {
            id: docSnap.id,
            name: d.name || `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Enquiry Lead',
            firstName: d.firstName || '',
            lastName: d.lastName || '',
            phone: d.phone || d.contact || '',
            altPhone: d.altPhone || d.altContact || '',
            email: d.email || '',
            gender: d.gender || 'Male',
            address: d.address || '',
            nextFollowUp: cleanDate,
            nextFollowUpDate: cleanDate,
            followUpTime: d.followUpTime || d.followupTime || '11:00',
            trialDate: d.trialDate || '',
            status: normStatus,
            assignedTo: d.assignedTo || d.attendedBy || 'Reception Desk',
            priority: d.priority || (normStatus === 'Closed' ? 'Cold' : 'Warm'),
            source: d.source || 'Walk-in',
            interestedPlan: d.interestedPlan || d.duration || d.inquiryFor || '1 month',
            duration: d.duration || d.interestedPlan || '1 month',
            remarks: d.remarks || '',
            history: Array.isArray(d.history) ? d.history : [],
            createdAt: d.createdAt || new Date().toISOString(),
            updatedAt: d.updatedAt || d.createdAt || new Date().toISOString()
          };

          itemMap.set(docSnap.id, item);
        });

        const list = Array.from(itemMap.values());
        onData(list);
      },
      (err) => {
        console.warn('Enquiries listener warning:', err.message);
        if (onError) onError(err);
      }
    );
  },

  // Import Excel File via API
  importExcel: async (fileOrBase64: File | string): Promise<any> => {
    let payload: any = {};
    if (typeof fileOrBase64 === 'string') {
      payload.fileBase64 = fileOrBase64;
    } else {
      const buffer = await fileOrBase64.arrayBuffer();
      const base64 = Buffer.from(buffer).toString('base64');
      payload.fileBase64 = base64;
    }

    const res = await API.post('/enquiries/import-excel', payload);
    return res.data;
  },

  // Fetch Enquiry History Timeline
  getHistory: async (enquiryId: string): Promise<EnquiryHistoryItem[]> => {
    try {
      const snap = await getDocs(collection(db, 'enquiries', enquiryId, 'history'));
      if (!snap.empty) {
        const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        list.sort((a: any, b: any) => new Date(a.timestamp || a.importedAt || 0).getTime() - new Date(b.timestamp || b.importedAt || 0).getTime());
        return list;
      }
    } catch (_) {}

    try {
      const res = await API.get(`/enquiries/${enquiryId}/history`);
      return res.data || [];
    } catch (_) {
      return [];
    }
  },

  // Create new enquiry
  create: async (data: Partial<EnquiryItem>): Promise<EnquiryItem> => {
    const createdId = data.id || `enq_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const nextDate = (data.nextFollowUpDate || data.nextFollowUp || '').split('T')[0];

    const payload = {
      ...data,
      id: createdId,
      name: data.name || `${data.firstName || ''} ${data.lastName || ''}`.trim() || 'New Lead',
      phone: (data.phone || '').replace(/\D/g, '').slice(-10),
      status: data.status || 'Pending',
      nextFollowUpDate: nextDate,
      nextFollowUp: nextDate,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'enquiries', createdId), payload);
    } catch (_) {}

    try {
      await API.post('/enquiries', payload);
    } catch (_) {}

    return payload as EnquiryItem;
  },

  // Update enquiry
  update: async (id: string, updates: Partial<EnquiryItem>): Promise<void> => {
    const payload = {
      ...updates,
      updatedAt: new Date().toISOString()
    };

    try {
      await updateDoc(doc(db, 'enquiries', id), payload);
    } catch (_) {}

    try {
      await API.put(`/enquiries/${id}`, payload);
    } catch (_) {}
  },

  // Delete enquiry
  remove: async (id: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, 'enquiries', id));
    } catch (_) {}

    try {
      await API.delete(`/enquiries/${id}`);
    } catch (_) {}
  },

  // Convert enquiry to active member
  convertToMember: async (id: string, plan: string, price: number | string): Promise<any> => {
    const res = await API.post(`/enquiries/${id}/convert`, { plan, price });
    return res.data;
  }
};
