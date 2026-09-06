import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, setLogLevel } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyC6ac08ZuxkKK6DMbAq7TV6z1x2o1nHU7Q",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "thewarriergym.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "thewarriergym",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "thewarriergym.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "939171214881",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:939171214881:web:cf890446adc866b3285560",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-769XM4BFQY"
};

// Initialize Firebase (singleton pattern for Next.js)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// Suppress Firestore internal connection warning log noise
try {
  setLogLevel('silent');
} catch (_) {}

if (typeof window !== 'undefined') {
  const originalError = console.error;
  console.error = (...args: any[]) => {
    const msg = String(args[0] || '') + ' ' + String((args[0] && (args[0] as any).message) || '') + ' ' + String((args[1] && (args[1] as any).message) || '');
    if (
      msg.includes('Could not reach Cloud Firestore backend') ||
      msg.includes('code=unavailable') ||
      msg.includes('Missing or insufficient permissions') ||
      msg.includes('permission-denied') ||
      msg.includes('FirebaseError')
    ) {
      console.warn('[Firestore Fallback Warning]', ...args);
      return;
    }
    originalError.apply(console, args);
  };
}

const isFirebaseReady = true;

export { app, auth, db, storage, isFirebaseReady };
