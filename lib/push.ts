import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

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

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; icon?: string }
): Promise<void> {
  if (!initVapid()) return; // VAPID not configured — skip silently

  const subs = await prisma.pushSubscription.findMany({ where: { userId } });

  await Promise.allSettled(
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
          })
        )
        .catch(async (err: { statusCode?: number }) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await prisma.pushSubscription.delete({ where: { endpoint: sub.endpoint } });
          }
        })
    )
  );
}
