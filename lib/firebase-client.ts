// Lazy-loaded Firebase client — none of firebase/app or firebase/messaging
// is imported at module level, so it's tree-shaken from the initial bundle
// and only loaded when getFirebaseMessaging() is first called (~200KB saved).

import type { FirebaseApp } from 'firebase/app';
import type { Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};

const hasConfig = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

let appInstance: FirebaseApp | null = null;
let messagingInstance: Messaging | null = null;

async function getApp(): Promise<FirebaseApp | null> {
  if (!hasConfig) return null;
  if (appInstance) return appInstance;

  const { initializeApp, getApps, getApp: getExisting } = await import('firebase/app');
  appInstance = getApps().length === 0 ? initializeApp(firebaseConfig) : getExisting();
  return appInstance;
}

/**
 * Returns the Firebase Messaging instance, or null if not supported
 * (e.g. Safari without Push API, SSR, or missing config).
 * Firebase SDK is loaded lazily on first call.
 */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  if (messagingInstance) return messagingInstance;

  const app = await getApp();
  if (!app) return null;

  const { getMessaging, isSupported } = await import('firebase/messaging');
  const supported = await isSupported();
  if (!supported) return null;

  messagingInstance = getMessaging(app);
  return messagingInstance;
}

// Re-export for backward compat — but lazily resolved
export { appInstance as firebaseApp };
