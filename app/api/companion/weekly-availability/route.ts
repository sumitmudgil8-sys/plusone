import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const VALID_DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const;
const VALID_SLOTS = ['MORNING', 'AFTERNOON', 'EVENING', 'NIGHT'] as const;

type DayKey = (typeof VALID_DAYS)[number];
type SlotKey = (typeof VALID_SLOTS)[number];
type WeeklySchedule = Record<DayKey, SlotKey[]>;

function isValidSchedule(obj: unknown): obj is WeeklySchedule {
  if (typeof obj !== 'object' || obj === null) return false;
  const record = obj as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!(VALID_DAYS as readonly string[]).includes(key)) return false;
    const val = record[key];
    if (!Array.isArray(val)) return false;
    for (const slot of val) {
      if (!(VALID_SLOTS as readonly string[]).includes(slot)) return false;
    }
  }
  return true;
}

/**
 * GET /api/companion/weekly-availability
 * Returns the companion's weekly schedule + availableNow flag.
 */
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (!auth.user) return auth.response;

  const profile = await prisma.companionProfile.findUnique({
    where: { userId: auth.user.id },
    select: { weeklyAvailability: true, availableNow: true },
  });

  if (!profile) {
    return NextResponse.json(
      { success: false, error: 'Profile not found' },
      { status: 404 }
    );
  }

  let schedule: WeeklySchedule;
  try {
    schedule = JSON.parse(profile.weeklyAvailability || '{}');
  } catch {
    schedule = {} as WeeklySchedule;
  }

  return NextResponse.json({
    success: true,
    data: {
      schedule,
      availableNow: profile.availableNow,
    },
  });
}

/**
 * PUT /api/companion/weekly-availability
 * Saves the companion's weekly schedule.
 * Body: { schedule: { mon: ["MORNING","AFTERNOON"], ... }, availableNow?: boolean }
 */
export async function PUT(request: NextRequest) {
  const auth = requireAuth(request, ['COMPANION']);
  if (!auth.user) return auth.response;

  let body: { schedule?: unknown; availableNow?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid request body' },
      { status: 400 }
    );
  }

  const updateData: { weeklyAvailability?: string; availableNow?: boolean } = {};

  if (body.schedule !== undefined) {
    if (!isValidSchedule(body.schedule)) {
      return NextResponse.json(
        { success: false, error: 'Invalid schedule format. Use day keys (mon-sun) with slot arrays (MORNING/AFTERNOON/EVENING/NIGHT).' },
        { status: 400 }
      );
    }
    updateData.weeklyAvailability = JSON.stringify(body.schedule);
  }

  if (typeof body.availableNow === 'boolean') {
    updateData.availableNow = body.availableNow;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { success: false, error: 'Nothing to update' },
      { status: 400 }
    );
  }

  await prisma.companionProfile.update({
    where: { userId: auth.user.id },
    data: updateData,
  });

  return NextResponse.json({ success: true });
}
