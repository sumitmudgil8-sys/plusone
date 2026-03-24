import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Get user's emergency contact
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

    const contact = await prisma.emergencyContact.findUnique({
      where: { userId: (payload as any).userId },
    });

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Get emergency contact error:', error);
    return NextResponse.json({ error: 'Failed to fetch emergency contact' }, { status: 500 });
  }
}

// Create or update emergency contact
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

    const { name, phone, relationship } = await req.json();

    if (!name || !phone || !relationship) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const contact = await prisma.emergencyContact.upsert({
      where: { userId: (payload as any).userId },
      update: { name, phone, relationship },
      create: {
        userId: (payload as any).userId,
        name,
        phone,
        relationship,
      },
    });

    return NextResponse.json({ contact });
  } catch (error) {
    console.error('Save emergency contact error:', error);
    return NextResponse.json({ error: 'Failed to save emergency contact' }, { status: 500 });
  }
}

// Delete emergency contact
export async function DELETE(req: NextRequest) {
  try {
    const token = req.cookies.get('token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    await prisma.emergencyContact.delete({
      where: { userId: (payload as any).userId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete emergency contact error:', error);
    return NextResponse.json({ error: 'Failed to delete emergency contact' }, { status: 500 });
  }
}
