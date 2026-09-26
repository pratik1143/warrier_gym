import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/serverFirebase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const firestore = getAdminFirestore();
    const snap = await firestore.collection('members').get();
    const rawList = snap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

    const activeList = rawList.filter((m: any) => !m.isDeleted && !m.deletedAt);

    const seen = new Set<string>();
    const deduplicated = activeList.filter((m: any) => {
      const key = m.id
        ? `id_${String(m.id).trim()}`
        : (m.clientId
          ? `cid_${String(m.clientId).trim()}`
          : (m.memberId && m.memberId !== 'TWG-2026-0000' && String(m.memberId).trim() !== '')
            ? `mid_${String(m.memberId).trim()}`
            : (m.biometricId ? `bio_${String(m.biometricId).trim()}` : (m.phone && String(m.phone).replace(/\D/g, '') ? `phone_${String(m.phone).replace(/\D/g, '')}` : `rnd_${Math.random()}`)));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return NextResponse.json(deduplicated);
  } catch (err: any) {
    console.error('API /api/members error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
