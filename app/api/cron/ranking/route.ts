import { NextRequest, NextResponse } from 'next/server';
import { recomputeAllRankings } from '@/lib/ranking';

export const runtime = 'nodejs';
export const maxDuration = 60; // allow up to 60s for large companion pools

// POST /api/cron/ranking
// Recomputes ranking scores and badges for all active companions.
// Called by Vercel Cron every 5 minutes.
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await recomputeAllRankings();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error('Ranking cron error:', error);
    return NextResponse.json({ success: false, error: 'Ranking computation failed' }, { status: 500 });
  }
}

// Also allow GET for Vercel Cron (which uses GET by default)
export async function GET(request: NextRequest) {
  return POST(request);
}
