import { RtcTokenBuilder, RtcRole } from 'agora-token';

// Keep this tight — clients re-request via /api/agora/token if they need
// to re-join, and that re-validates session ownership + ACTIVE status.
// A stale leaked token can only be used inside this window.
const TOKEN_TTL_SECONDS = 1800; // 30 minutes

function getAgoraCredentials() {
  const appId = process.env.AGORA_APP_ID;
  const appCertificate = process.env.AGORA_APP_CERTIFICATE;
  if (!appId || !appCertificate) {
    throw new Error('AGORA_APP_ID and AGORA_APP_CERTIFICATE environment variables are not set');
  }
  return { appId, appCertificate };
}

/** Channel name for a billing session voice call. */
export function getCallChannelName(sessionId: string): string {
  return `call-${sessionId}`;
}

/**
 * Generates an Agora RTC token for a user joining a channel.
 * @param channelName  Agora channel name (use getCallChannelName)
 * @param userId       String user account (used as Agora UID)
 * @param role         'publisher' for active speaker, 'subscriber' for listener
 */
export function generateAgoraToken(
  channelName: string,
  userId: string,
  role: 'publisher' | 'subscriber'
): string {
  const { appId, appCertificate } = getAgoraCredentials();
  const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;
  const expiredTs = Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS;

  return RtcTokenBuilder.buildTokenWithUserAccount(
    appId,
    appCertificate,
    channelName,
    userId,
    agoraRole,
    expiredTs,
    expiredTs
  );
}

/** Returns only the App ID (safe to expose to the client). */
export function getAgoraAppId(): string {
  const { appId } = getAgoraCredentials();
  return appId;
}
