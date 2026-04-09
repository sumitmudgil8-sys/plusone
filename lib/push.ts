import webpush from 'web-push';
import { prisma } from '@/lib/prisma';
import { sendFcmToUser, type FcmPayload } from '@/lib/fcm';

let vapidInitialized = false;

function initVapid() {
  if (vapidInitialized) return true;
  const subject = process.env.VAPID_SUBJECT;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!subject || !publicKey || !privateKey) return false;
  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidInitialized = true;
  return true;
}

/**
 * Send a push notification to a user.
 * Tries FCM first (reliable on Android PWAs), then falls back to VAPID Web Push.
 * Both channels run in parallel — the user gets whichever arrives first.
 * Duplicate prevention is handled by notification tags.
 */
export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; icon?: string; type?: FcmPayload['type']; tag?: string; extra?: Record<string, string> }
): Promise<void> {
  const tag = payload.tag ?? `plusone-${Date.now()}`;

  // ── FCM channel ─────────────────────────────────────────────────────────
  const fcmPromise = sendFcmToUser(userId, {
    title: payload.title,
    body: payload.body,
    url: payload.url,
    icon: payload.icon,
    type: payload.type,
    tag,
    extra: payload.extra,
  }).catch((err) => {
    console.error('FCM send error (non-fatal):', err);
  });

  // ── VAPID Web Push fallback ─────────────────────────────────────────────
  let vapidPromise: Promise<void> = Promise.resolve();
  if (initVapid()) {
    const subs = await prisma.pushSubscription.findMany({ where: { userId } });
    if (subs.length > 0) {
      vapidPromise = Promise.allSettled(
        subs.map((sub) =>
          webpush
            .sendNotification(
              { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
              JSON.stringify({
                title: payload.title,
                body: payload.body,
                url: payload.url ?? '/',
                icon: payload.icon ?? '/icons/icon-192.png',
                badge: '/icons/icon-192.png',
                tag,
              })
            )
            .catch(async (err: { statusCode?: number }) => {
              if (err.statusCode === 410 || err.statusCode === 404) {
                await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } }).catch(() => {});
              }
            })
        )
      ).then(() => {});
    }
  }

  await Promise.all([fcmPromise, vapidPromise]);
}
