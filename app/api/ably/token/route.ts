import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getAblyClient, getUserChannelName } from '@/lib/ably';

export const runtime = 'nodejs';

// GET /api/ably/token — issue a signed token for the authenticated user.
// Grants:
//   - subscribe on their own private channel (incoming messages + typing)
//   - publish on any private:user-* channel (for outbound typing indicators)
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION', 'ADMIN']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  try {
    const ably = getAblyClient();

    const tokenRequest = await ably.auth.createTokenRequest({
      clientId: user.id,
      capability: {
        [getUserChannelName(user.id)]: ['subscribe'],
        'private:user-*': ['publish'],
        'companions-feed': ['subscribe'],
      },
    });

    return NextResponse.json({ success: true, data: tokenRequest });
  } catch (error) {
    console.error('Ably token error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
