import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/serverFirebase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const firestore = getAdminFirestore();
    const snap = await firestore.collection('employees').where('role', '==', 'trainer').get();
    let trainers = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    if (trainers.length === 0) {
      const allEmpSnap = await firestore.collection('employees').get();
      trainers = allEmpSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    }
    return NextResponse.json(trainers);
  } catch (err: any) {
    console.error('API /api/trainers error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
