import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { verifyOkycStatus } from '@/lib/setu';

export const runtime = 'nodejs';

// GET /api/auth/okyc/status
// Checks the Setu OKYC verification status for the current user.
// If the OKYC is successful the setuOkycRefId is updated with a verified marker;
// clientStatus stays PENDING_REVIEW — admin does the final approval.
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  try {
    const dbUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { setuOkycRefId: true, clientStatus: true },
    });

    if (!dbUser.setuOkycRefId) {
      return NextResponse.json({
        success: true,
        data: { status: 'NOT_STARTED' },
      });
    }

    // Strip a trailing ":verified" marker we add on success (idempotency)
    const refId = dbUser.setuOkycRefId.replace(/:verified$/, '');
    const result = await verifyOkycStatus(refId);

    // On success, mark the refId so we know OKYC has been completed
    if (
      result.status === 'SUCCESS' &&
      !dbUser.setuOkycRefId.endsWith(':verified')
    ) {
      await prisma.user.update({
        where: { id: user.id },
        data: { setuOkycRefId: `${refId}:verified` },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        status: result.status,
        maskedAadhaar: result.maskedAadhaar ?? null,
        clientStatus: dbUser.clientStatus,
      },
    });
  } catch (error) {
    console.error('OKYC status error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to check verification status' },
      { status: 500 }
    );
  }
}
