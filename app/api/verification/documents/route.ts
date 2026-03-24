import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

// Get user's verification documents
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

    const documents = await prisma.verificationDocument.findMany({
      where: { userId: (payload as any).userId },
      orderBy: { submittedAt: 'desc' },
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Get documents error:', error);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

// Upload a verification document
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

    const { type, documentUrl } = await req.json();

    if (!type || !documentUrl) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const document = await prisma.verificationDocument.create({
      data: {
        userId: (payload as any).userId,
        type,
        documentUrl,
        status: 'PENDING',
      },
    });

    // Update companion verification status
    await prisma.companionProfile.update({
      where: { userId: (payload as any).userId },
      data: { verificationStatus: 'PENDING' },
    });

    return NextResponse.json({ document });
  } catch (error) {
    console.error('Upload document error:', error);
    return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
  }
}
