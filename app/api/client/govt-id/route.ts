import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

const bodySchema = z.object({
  govtIdUrl: z.string().url('Invalid URL').optional(),
  additionalNotes: z.string().max(1000).optional(),
});

// POST /api/client/govt-id — update government ID and/or additional notes
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const body = await request.json();
  const parsed = bodySchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { govtIdUrl, additionalNotes } = parsed.data;

  if (!govtIdUrl && !additionalNotes) {
    return NextResponse.json(
      { success: false, error: 'Provide a new ID or additional notes' },
      { status: 400 }
    );
  }

  try {
    // Update client profile fields
    const profileData: Record<string, string> = {};
    if (govtIdUrl) profileData.govtIdUrl = govtIdUrl;
    if (additionalNotes) profileData.additionalNotes = additionalNotes;

    await prisma.$transaction([
      prisma.clientProfile.update({
        where: { userId: auth.user.id },
        data: profileData,
      }),
      // Clear the info request flag so admin sees it as a fresh response
      prisma.user.update({
        where: { id: auth.user.id },
        data: { rejectionReason: null },
      }),
    ]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save govt ID error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save details' },
      { status: 500 }
    );
  }
}
