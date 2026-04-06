import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const profileSchema = z.object({
  // Section 1 — Basic Info
  name: z.string().min(1).max(100).optional(),
  bio: z.string().max(1000).optional(),
  tagline: z.string().max(100).optional(),
  age: z.number().int().min(18).max(99).optional(),
  gender: z.string().max(30).optional(),
  city: z.string().max(100).optional(),
  languages: z.array(z.string()).optional(),
  education: z.string().max(200).optional(),
  occupation: z.string().max(200).optional(),

  // Section 2 — Physical & Lifestyle
  height: z.string().max(20).optional(),
  weight: z.string().max(20).optional(),
  bodyType: z.enum(['Slim', 'Athletic', 'Average', 'Curvy', 'Heavy']).optional(),
  hairColor: z.string().max(50).optional(),
  eyeColor: z.string().max(50).optional(),
  ethnicity: z.string().max(100).optional(),
  foodPreference: z.enum(['Veg', 'Non-veg', 'Vegan', 'No preference']).optional(),
  drinking: z.enum(['Never', 'Socially', 'Regularly']).optional(),
  smoking: z.enum(['Never', 'Socially', 'Regularly']).optional(),

  // Section 3 — Personality
  personalityTags: z.array(z.string()).max(5).optional(),

  // Section 4 — Rates (rupees, converted to paise)
  chatRatePerMinute: z.number().int().min(0).optional(),  // paise
  callRatePerMinute: z.number().int().min(0).optional(),  // paise
  hourlyRate: z.number().int().min(0).optional(),          // paise
});

// PUT /api/companion/profile — update any profile fields
export async function PUT(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (auth.user === null) return auth.response;

  const body = await request.json().catch(() => ({}));
  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const updateData: Record<string, unknown> = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.bio !== undefined) updateData.bio = data.bio;
  if (data.tagline !== undefined) updateData.tagline = data.tagline;
  if (data.age !== undefined) updateData.age = data.age;
  if (data.gender !== undefined) updateData.gender = data.gender;
  if (data.city !== undefined) updateData.city = data.city;
  if (data.languages !== undefined) updateData.languages = JSON.stringify(data.languages);
  if (data.education !== undefined) updateData.education = data.education;
  if (data.occupation !== undefined) updateData.occupation = data.occupation;
  if (data.height !== undefined) updateData.height = data.height;
  if (data.weight !== undefined) updateData.weight = data.weight;
  if (data.bodyType !== undefined) updateData.bodyType = data.bodyType;
  if (data.hairColor !== undefined) updateData.hairColor = data.hairColor;
  if (data.eyeColor !== undefined) updateData.eyeColor = data.eyeColor;
  if (data.ethnicity !== undefined) updateData.ethnicity = data.ethnicity;
  if (data.foodPreference !== undefined) updateData.foodPreference = data.foodPreference;
  if (data.drinking !== undefined) updateData.drinking = data.drinking;
  if (data.smoking !== undefined) updateData.smoking = data.smoking;
  if (data.personalityTags !== undefined) updateData.personalityTags = JSON.stringify(data.personalityTags);
  if (data.chatRatePerMinute !== undefined) updateData.chatRatePerMinute = data.chatRatePerMinute;
  if (data.callRatePerMinute !== undefined) updateData.callRatePerMinute = data.callRatePerMinute;
  if (data.hourlyRate !== undefined) updateData.hourlyRate = data.hourlyRate;

  try {
    const profile = await prisma.companionProfile.update({
      where: { userId: auth.user.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, data: { profile } });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}
