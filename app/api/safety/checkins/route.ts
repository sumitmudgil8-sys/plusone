import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendEmail, emailTemplates } from '@/lib/email';

export const runtime = 'nodejs';

// Get user's check-ins
export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const checkIns = await prisma.checkIn.findMany({
      where: {
        userId: (payload as any).userId,
      },
      orderBy: { scheduledAt: 'desc' },
      include: {
        companion: {
          select: {
            companionProfile: {
              select: { name: true, avatarUrl: true },
            },
          },
        },
      },
    });

    return NextResponse.json({ checkIns });
  } catch (error) {
    console.error('Get check-ins error:', error);
    return NextResponse.json({ error: 'Failed to fetch check-ins' }, { status: 500 });
  }
}

// Create a check-in
export async function POST(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { companionId, bookingId, scheduledAt, location, notes } = await req.json();

    if (!companionId || !scheduledAt) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const checkIn = await prisma.checkIn.create({
      data: {
        userId: (payload as any).userId,
        companionId,
        bookingId: bookingId || null,
        scheduledAt: new Date(scheduledAt),
        location: location || '',
        notes: notes || '',
        status: 'SCHEDULED',
      },
    });

    // Send email notification
    const user = await prisma.user.findUnique({
      where: { id: (payload as any).userId },
      include: { clientProfile: true },
    });

    if (user?.email) {
      const template = emailTemplates.safetyCheckIn(
        user.clientProfile?.name || '',
        new Date(scheduledAt).toLocaleString()
      );
      await sendEmail(user.email, template.subject, template.html);
    }

    return NextResponse.json({ checkIn });
  } catch (error) {
    console.error('Create check-in error:', error);
    return NextResponse.json({ error: 'Failed to create check-in' }, { status: 500 });
  }
}

// Complete a check-in
export async function PATCH(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { checkInId } = await req.json();

    const checkIn = await prisma.checkIn.update({
      where: { id: checkInId },
      data: {
        checkedInAt: new Date(),
        status: 'COMPLETED',
      },
    });

    return NextResponse.json({ checkIn });
  } catch (error) {
    console.error('Complete check-in error:', error);
    return NextResponse.json({ error: 'Failed to complete check-in' }, { status: 500 });
  }
}
