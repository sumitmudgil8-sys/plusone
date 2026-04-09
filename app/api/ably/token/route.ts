import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getUserChannelName } from '@/lib/ably';
import Ably from 'ably';

export const runtime = 'nodejs';

// GET /api/ably/token — issue a signed token for the authenticated user.
// Returns a raw Ably TokenRequest object (no wrapper) so Ably's authUrl
// handler can parse it directly.
//
// Capability grants:
//   - subscribe on their own private channel (session events)
//   - publish on any private:user-* channel (outbound typing indicators)
//   - full access on chat room channels (chat-*)
//   - companions-feed subscribe
export async function GET(request: NextRequest) {
  const auth = requireAuth(request, ['CLIENT', 'COMPANION', 'ADMIN']);
  if (auth.user === null) return auth.response;

  const { user } = auth;

  const apiKey = process.env.ABLY_API_KEY;
  if (!apiKey) {
    console.error('[ably/token] ABLY_API_KEY is not set in environment variables');
    return NextResponse.json(
      { success: false, error: 'Ably API key not configured' },
      { status: 500 }
    );
  }

  try {
    // Always instantiate fresh Rest client here — avoids stale singleton issues
    // in serverless environments and makes the key check per-request.
    const rest = new Ably.Rest({ key: apiKey });

    const tokenRequest = await rest.auth.createTokenRequest({
      clientId: user.id,
      capability: {
        [getUserChannelName(user.id)]: ['subscribe'],
        'private:user-*': ['publish'],
        'companions-feed': ['subscribe'],
        'chat-*': ['publish', 'subscribe', 'history', 'presence'],
        '*': ['publish', 'subscribe', 'history', 'presence'],
      },
    });

    console.log(`[ably/token] token issued for clientId=${user.id}`);

    // Return the raw TokenRequest — Ably's authUrl expects the token request
    // at the top level, NOT wrapped in { success, data }.
    return NextResponse.json(tokenRequest);
  } catch (error) {
    console.error('[ably/token] createTokenRequest failed:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to generate token' },
      { status: 500 }
    );
  }
}
