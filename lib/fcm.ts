import { prisma } from '@/lib/prisma';

let adminMessaging: import('firebase-admin').messaging.Messaging | null = null;

async function getMessaging() {
  if (adminMessaging) return adminMessaging;

  // Only import firebase-admin on the server and only when FCM is configured
  if (
    !process.env.FIREBASE_SERVICE_ACCOUNT &&
    !process.env.FIREBASE_CLIENT_EMAIL
  ) {
    return null;
  }

  try {
    const { messaging } = await import('@/lib/firebase-admin');
    if (!messaging) return null;
    adminMessaging = messaging;
    return adminMessaging;
  } catch (err) {
    console.error('Firebase Admin init failed:', err);
    return null;
  }
}

export interface FcmPayload {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  type?: 'CHAT_MESSAGE' | 'INCOMING_CALL' | 'CHAT_REQUEST' | 'PAYMENT' | 'DEFAULT';
  tag?: string;
  /** Extra data fields merged into the FCM data payload */
  extra?: Record<string, string>;
}

/**
 * Send a data-only FCM notification to all devices registered for a user.
 * Data-only payloads give us full control over notification display in the SW.
 * Returns silently if Firebase is not configured.
 */
export async function sendFcmToUser(
  userId: string,
  payload: FcmPayload
): Promise<void> {
  const fcm = await getMessaging();
  if (!fcm) return;

  const tokens = await prisma.fcmToken.findMany({
    where: { userId },
    select: { token: true },
  });

  if (tokens.length === 0) return;

  const dataPayload: Record<string, string> = {
    title: payload.title,
    body: payload.body,
    url: payload.url ?? '/',
    icon: payload.icon ?? '/icons/icon-192.png',
    type: payload.type ?? 'DEFAULT',
    tag: payload.tag ?? `plusone-${payload.type ?? 'default'}-${Date.now()}`,
    ...(payload.extra ?? {}),
  };

  // Use sendEachForMulticast for batch sending with individual error handling
  const response = await fcm.sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    // Data-only: no "notification" key — SW handles display
    data: dataPayload,
    // Android: high priority ensures delivery even in doze mode
    android: { priority: 'high' },
    // Web push: set urgency to high
    webpush: {
      headers: { Urgency: 'high' },
    },
  });

  // Clean up stale tokens (unregistered / expired)
  if (response.failureCount > 0) {
    const staleTokens: string[] = [];
    response.responses.forEach((res, idx) => {
      if (res.error) {
        const code = res.error.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          staleTokens.push(tokens[idx].token);
        }
      }
    });

    if (staleTokens.length > 0) {
      await prisma.fcmToken
        .deleteMany({ where: { token: { in: staleTokens } } })
        .catch(() => {});
    }
  }
}
