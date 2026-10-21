import { Request, Response, NextFunction } from 'express';
import * as admin from 'firebase-admin';
import { isFirebaseInitialized, getFirestoreDb, disableFirestore } from '../firebase';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    role: string;
    name: string;
    branch?: string;
    gymId?: string;
  };
}

// Real owner accounts (never lose admin access if their /users profile doc is missing).
export const KNOWN_OWNER_EMAILS = ['owner@warrier.com', 'owner@thewarriorgym.in'];

const DEMO_FALLBACK_USER = {
  uid: 'demo_owner_001',
  email: 'owner@thewarriorgym.in',
  role: 'gym_owner',
  name: 'Gym Owner',
  branch: 'Mohali, Punjab',
  gymId: 'gym_001'
};

export const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const firestore = getFirestoreDb();
  if (!isFirebaseInitialized || !firestore) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(503).json({ error: 'Authentication service is unavailable.' });
    }
    req.user = DEMO_FALLBACK_USER;
    return next();
  }

  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Demo authentication is only available in local development.
  if (!token || token.startsWith('demo_')) {
    if (process.env.NODE_ENV !== 'production') {
      req.user = DEMO_FALLBACK_USER;
      return next();
    }
    return res.status(401).json({ error: 'Authentication required.' });
  }

  try {
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Retrieve user profile from Firestore
    try {
      const userDoc = await firestore.collection('users').doc(decodedToken.uid).get();

      if (!userDoc.exists) {
        const defaultUser = {
          uid: decodedToken.uid,
          email: decodedToken.email,
          name: decodedToken.name || decodedToken.email?.split('@')[0] || 'Gym Member',
          role: KNOWN_OWNER_EMAILS.includes(String(decodedToken.email || '').toLowerCase()) ? 'gym_owner' : 'member',
          branch: 'Mohali, Punjab',
          gymId: 'gym_001',
          createdAt: new Date().toISOString()
        };
        await firestore.collection('users').doc(decodedToken.uid).set(defaultUser).catch(() => {});
        req.user = defaultUser;
      } else {
        req.user = { uid: decodedToken.uid, ...userDoc.data() } as any;
      }
    } catch (fErr: any) {
      if (fErr?.message?.includes('PERMISSION_DENIED') || fErr?.message?.includes('disabled')) {
        disableFirestore();
      }
      console.error('[Auth] Failed to load the authenticated user profile:', fErr);
      return res.status(503).json({ error: 'Could not load the authenticated user profile.' });
    }

    return next();
  } catch (error: any) {
    console.warn('[Auth] Token verification failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
};

export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'You do not have permission to perform this action.' });
    }
    return next();
  };
};
