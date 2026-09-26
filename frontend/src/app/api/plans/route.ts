import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/serverFirebase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const firestore = getAdminFirestore();
    const snap = await firestore.collection('plans').get();
    const plans = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json(plans);
  } catch (err: any) {
    console.error('API /api/plans error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
