import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Since the 240 frames are static assets, generating the URLs dynamically 
    // prevents Vercel from tracking and bundling the 410MB public/alpha directory 
    // into this Serverless Function, which exceeds Vercel's 250MB limit.
    const images: string[] = [];
    for (let i = 1; i <= 240; i++) {
      const frameNum = String(i).padStart(3, '0');
      images.push(`/alpha/ezgif-frame-${frameNum}.png`);
    }
    
    return NextResponse.json({ images });
  } catch (error) {
    console.error('Error generating alpha images list:', error);
    return NextResponse.json({ error: 'Failed to read images' }, { status: 500 });
  }
}

