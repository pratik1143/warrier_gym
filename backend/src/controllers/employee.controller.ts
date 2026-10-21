import { Request, Response } from 'express';
import { admin, isFirebaseInitialized } from '../firebase';
import { getNextAvailableBiometricId, isDeviceBiometricIdInUse, isValidDeviceBiometricId } from '../services/biometricId.service';
import { isHikvisionProvider, queueHikvisionMemberSync } from '../services/biometricQueue.service';

const defaultEmployeesList = [
  {
    name: 'Sourav Arora',
    phone: '7973649709',
    email: '',
    role: 'Trainer',
    branch: 'The Warrior Gym',
    emergencyContact: '',
    address: '',
    biometricId: 10021,
    todayStatus: 'Absent',
    currentStatus: 'Outside',
    lastPunch: null,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Deepak',
    phone: '8196852386',
    email: '',
    role: 'Trainer',
    branch: 'The Warrior Gym',
    emergencyContact: '',
    address: '',
    biometricId: 10012,
    todayStatus: 'Absent',
    currentStatus: 'Outside',
    lastPunch: null,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Kuldeep',
    phone: '8629841471',
    email: 'kuldeep86298@gmail.com',
    role: 'Trainer',
    branch: 'The Warrior Gym',
    emergencyContact: '',
    address: '',
    biometricId: 10009,
    todayStatus: 'Absent',
    currentStatus: 'Outside',
    lastPunch: null,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Arshdeep Singh',
    phone: '9915866576',
    email: '',
    role: 'Trainer',
    branch: 'The Warrior Gym',
    emergencyContact: '',
    address: '',
    biometricId: 10008,
    todayStatus: 'Absent',
    currentStatus: 'Outside',
    lastPunch: null,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Achhar Pal',
    phone: '9592691190',
    email: '',
    role: 'Trainer',
    branch: 'The Warrior Gym',
    emergencyContact: '',
    address: 'kaimbwala chd',
    biometricId: 10005,
    todayStatus: 'Absent',
    currentStatus: 'Outside',
    lastPunch: null,
    createdAt: new Date().toISOString()
  },
  {
    name: 'Abc',
    phone: '7884977777',
    email: '',
    role: 'Trainer',
    branch: 'The Warrior Gym',
    emergencyContact: '',
    address: '',
    biometricId: 10003,
    todayStatus: 'Absent',
    currentStatus: 'Outside',
    lastPunch: null,
    createdAt: new Date().toISOString()
  }
];

export const getEmployees = async (req: Request, res: Response) => {
  try {
    if (!isFirebaseInitialized || !admin) {
      return res.status(500).json({ error: 'Firebase is not initialized' });
    }
    const firestore = admin.firestore();
    const snap = await firestore.collection('employees').get();
    if (snap.empty) return res.json([]); // no auto-seeding of default employees
    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const createEmployee = async (req: Request, res: Response) => {
  try {
    if (!isFirebaseInitialized || !admin) {
      return res.status(500).json({ error: 'Firebase is not initialized' });
    }
    const firestore = admin.firestore();
    const employeeData = {
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    // Same shared biometric ID namespace as members: auto-assign when missing / 'auto' so enrollment never lacks an ID.
    const requestedBioId = String(employeeData.biometricId ?? '').trim();
    let assignedBioId = requestedBioId;
    if (!requestedBioId || requestedBioId.toLowerCase() === 'auto') {
      try {
        assignedBioId = String(await getNextAvailableBiometricId());
      } catch (allocationError: any) {
        return res.status(503).json({ error: `Could not assign a valid biometric ID: ${allocationError.message}` });
      }
    } else {
      if (!isValidDeviceBiometricId(requestedBioId)) {
        return res.status(400).json({ error: 'Biometric ID must be a whole number between 1 and 65535.' });
      }
      try {
        if (await isDeviceBiometricIdInUse(requestedBioId, isHikvisionProvider())) {
          return res.status(409).json({ error: `Biometric ID ${requestedBioId} is already assigned. Choose another ID or leave it on auto.` });
        }
      } catch (availabilityError: any) {
        return res.status(503).json({ error: `Could not verify biometric ID availability: ${availabilityError.message}` });
      }
    }
    employeeData.biometricId = assignedBioId;
    employeeData.deviceUserId = assignedBioId;

    const ref = await firestore.collection('employees').add(employeeData);

    // Server-side fallback: provision the employee on the Hikvision terminal (user + photo-as-face) via the agent queue.
    let biometricSync: any = null;
    try {
      biometricSync = await queueHikvisionMemberSync({
        collection: 'employees',
        recordId: ref.id,
        biometricId: assignedBioId,
        name: String(employeeData.name || employeeData.fullName || 'Employee'),
        source: 'create_employee_server_fallback',
      });
    } catch (syncErr: any) {
      console.warn('[Biometric Sync] Could not queue employee sync:', syncErr.message);
    }
    res.status(201).json({ id: ref.id, ...employeeData, biometricSync });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const updateEmployee = async (req: Request, res: Response) => {
  try {
    if (!isFirebaseInitialized || !admin) {
      return res.status(500).json({ error: 'Firebase is not initialized' });
    }
    const { id } = req.params;
    const firestore = admin.firestore();
    
    const updates = {
      ...req.body,
      updatedAt: new Date().toISOString()
    };
    if (updates.biometricId) {
      updates.biometricId = Number(updates.biometricId);
    }

    await firestore.collection('employees').doc(id).update(updates);
    const updatedDoc = await firestore.collection('employees').doc(id).get();
    res.json({ id: updatedDoc.id, ...updatedDoc.data() });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteEmployee = async (req: Request, res: Response) => {
  try {
    if (!isFirebaseInitialized || !admin) {
      return res.status(500).json({ error: 'Firebase is not initialized' });
    }
    const { id } = req.params;
    const firestore = admin.firestore();
    await firestore.collection('employees').doc(id).delete();
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getEmployeeAttendance = async (req: Request, res: Response) => {
  try {
    if (!isFirebaseInitialized || !admin) {
      return res.status(500).json({ error: 'Firebase is not initialized' });
    }
    const firestore = admin.firestore();
    const snap = await firestore.collection('employeeAttendance').orderBy('timestamp', 'desc').get();
    const list = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json(list);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
