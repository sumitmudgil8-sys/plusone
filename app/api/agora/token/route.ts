import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateAgoraToken, getCallChannelName, getAgoraAppId } from '@/lib/agora';

export const runtime = 'nodejs';

const querySchema = z.object({
  sessionId: z.string().min(1),
});

// GET /api/agora/token?sessionId={id}
// Returns an Agora RTC token for the authenticated user to join the voice call.
// Both client and companion can call this endpoint.
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({ sessionId: searchParams.get('sessionId') });
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0].message },
      { status: 400 }
    );
  }

  const { sessionId } = parsed.data;

  try {
    const session = await prisma.billingSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    // Only participants of this session may get a token
    if (session.clientId !== user.id && session.companionId !== user.id) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }

    if (session.type !== 'VOICE') {
      return NextResponse.json(
        { success: false, error: 'Session is not a voice call' },
        { status: 409 }
      );
    }

    if (session.status !== 'ACTIVE') {
      return NextResponse.json(
        { success: false, error: 'Session is not active', data: { status: session.status } },
        { status: 409 }
      );
    }

    const channelName = getCallChannelName(session.id);
    const token = generateAgoraToken(channelName, user.id, 'publisher');

    return NextResponse.json({
      success: true,
      data: {
        token,
        channelName,
        appId: getAgoraAppId(),
        uid: user.id,
      },
    });
  } catch (error) {
    console.error('Agora token error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate call token' },
      { status: 500 }
    );
  }
}
