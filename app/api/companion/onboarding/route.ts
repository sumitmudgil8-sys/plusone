import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { GENDERS, LANGUAGES, INTERESTS } from '@/lib/constants';

export const runtime = 'nodejs';

const onboardingSchema = z.object({
  bio: z.string().max(1000).optional(),
  age: z.number().int().min(18).max(99).optional(),
  gender: z.enum(GENDERS as [string, ...string[]]).optional(),
  city: z.string().max(100).optional(),
  hourlyRate: z.number().min(100).max(100000).optional(),
  languages: z.array(z.enum(LANGUAGES as [string, ...string[]])).optional(),
  interests: z.array(z.enum(INTERESTS as [string, ...string[]])).optional(),
});

// POST /api/companion/onboarding
// Saves rich profile data for the authenticated companion.
// Idempotent — can be called multiple times as the wizard progresses.
export async function POST(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  const body = await request.json();
  const parsed = onboardingSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { bio, age, gender, city, hourlyRate, languages, interests } = parsed.data;

  try {
    const updateData: Record<string, unknown> = {};
    if (bio !== undefined) updateData.bio = bio;
    if (age !== undefined) updateData.age = age;
    if (gender !== undefined) updateData.gender = gender;
    if (city !== undefined) updateData.city = city;
    if (hourlyRate !== undefined) updateData.hourlyRate = hourlyRate;
    if (languages !== undefined) updateData.languages = JSON.stringify(languages);
    if (interests !== undefined) updateData.interests = JSON.stringify(interests);

    const profile = await prisma.companionProfile.update({
      where: { userId: user.id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      data: { profile },
    });
  } catch (error) {
    console.error('Companion onboarding error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to save profile' },
      { status: 500 }
    );
  }
}

// GET /api/companion/onboarding — fetch current onboarding state
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  try {
    const profile = await prisma.companionProfile.findUnique({
      where: { userId: user.id },
    });

    if (!profile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        name: profile.name,
        bio: profile.bio,
        age: profile.age,
        gender: profile.gender,
        city: profile.city,
        hourlyRate: profile.hourlyRate,
        avatarUrl: profile.avatarUrl,
        images: JSON.parse(profile.images),
        languages: JSON.parse(profile.languages),
        interests: JSON.parse(profile.interests),
        isApproved: profile.isApproved,
        verificationStatus: profile.verificationStatus,
      },
    });
  } catch (error) {
    console.error('Companion onboarding fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch profile' },
      { status: 500 }
    );
  }
}
