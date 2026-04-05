import webpush from 'web-push';
import { prisma } from '@/lib/prisma';

webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function sendPushToUser(
  userId: string,
  payload: { title: string; body: string; url?: string; icon?: string }
): Promise<void> {
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
