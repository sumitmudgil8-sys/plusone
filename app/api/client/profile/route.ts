import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

export const runtime = 'nodejs';

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  phone: z.string().regex(/^[6-9]\d{9}$/, 'Invalid Indian mobile number').optional().or(z.literal('')),
  city: z.string().max(100).optional(),
  occupation: z.string().max(100).optional(),
  bio: z.string().max(300).optional(),
}).strict();

// PUT /api/client/profile — update client profile fields
export async function PUT(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: parsed.error.issues[0].message }, { status: 400 });
  }

  const { name, phone, city, occupation, bio } = parsed.data;

  try {
    const profileUpdate: Record<string, unknown> = {};
    if (name !== undefined) profileUpdate.name = name;
    if (city !== undefined) profileUpdate.city = city;
    if (occupation !== undefined) profileUpdate.occupation = occupation;
    if (bio !== undefined) profileUpdate.bio = bio;

    const userUpdate: Record<string, unknown> = {};
    if (phone !== undefined) userUpdate.phone = phone || null;

    await prisma.$transaction(async (tx) => {
      if (Object.keys(profileUpdate).length > 0) {
        await tx.clientProfile.update({
          where: { userId: user.id },
          data: profileUpdate,
        });
      }
      if (Object.keys(userUpdate).length > 0) {
        await tx.user.update({
          where: { id: user.id },
          data: userUpdate,
        });
      }
    });

    const updated = await prisma.clientProfile.findUnique({
      where: { userId: user.id },
    });
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { phone: true, email: true, linkedInUrl: true, createdAt: true, subscriptionStatus: true, subscriptionExpiresAt: true },
    });

    return NextResponse.json({ success: true, data: { profile: updated, user: updatedUser } });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ success: false, error: 'Failed to update profile' }, { status: 500 });
  }
}
