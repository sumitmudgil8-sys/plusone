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

    // NOTE: Do NOT add a wildcard '*' entry here — it overrides all scoped
    // capabilities below and grants any signed-in user full access to every
    // channel on the account (including other users' private channels).
    const tokenRequest = await rest.auth.createTokenRequest({
      clientId: user.id,
      capability: {
        // Own private user channel — receive session events, chat requests, etc.
        [getUserChannelName(user.id)]: ['subscribe'],
        // Publish-only on other users' private channels — used for typing
        // indicators and other outbound signals. Cannot subscribe.
        'private:user-*': ['publish'],
        // Public companions feed — clients see newly-added companions.
        'companions-feed': ['subscribe'],
        // Chat rooms — both parties need full pub/sub/history/presence.
        // Server-side authorization ensures only session participants
        // are permitted to fetch the token at all.
        'chat-*': ['publish', 'subscribe', 'history', 'presence'],
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
