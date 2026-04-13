import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

const bodySchema = z.object({
  govtIdUrl: z.string().url('Invalid URL'),
});

// POST /api/client/govt-id — save government ID URL to client profile
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

  try {
    await prisma.clientProfile.update({
      where: { userId: auth.user.id },
      data: { govtIdUrl: parsed.data.govtIdUrl },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Save govt ID error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save government ID' },
      { status: 500 }
    );
  }
}
