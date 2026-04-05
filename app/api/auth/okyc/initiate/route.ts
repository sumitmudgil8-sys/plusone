import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { initiateOkyc } from '@/lib/setu';

export const runtime = 'nodejs';

// POST /api/auth/okyc/initiate
// Creates a Setu OKYC session and returns the URL to redirect the client to.
// Requires the client to be logged in (any clientStatus — PENDING_REVIEW may call this).
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
    const redirectUrl = `${appUrl}/client/verify/callback`;

    const result = await initiateOkyc(user.id, redirectUrl);

    // Persist the refId so the callback can look up status
    await prisma.user.update({
      where: { id: user.id },
      data: { setuOkycRefId: result.refId },
    });

    return NextResponse.json({
      success: true,
      data: { okycUrl: result.okycUrl, refId: result.refId },
    });
  } catch (error) {
    console.error('OKYC initiate error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to initiate identity verification' },
      { status: 500 }
    );
  }
}
