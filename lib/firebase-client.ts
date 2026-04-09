import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { getMessaging, isSupported, type Messaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '',
};

// Only initialize Firebase if required config values are present
const hasConfig = !!firebaseConfig.apiKey && !!firebaseConfig.projectId;

export const firebaseApp: FirebaseApp | null = hasConfig
  ? getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp()
  : null;

let messagingInstance: Messaging | null = null;

/**
 * Returns the Firebase Messaging instance, or null if not supported
 * (e.g. Safari without Push API, SSR, or missing config).
 */
export async function getFirebaseMessaging(): Promise<Messaging | null> {
  if (typeof window === 'undefined') return null;
  if (!firebaseApp) return null;
  if (messagingInstance) return messagingInstance;

  const supported = await isSupported();
  if (!supported) return null;

  messagingInstance = getMessaging(firebaseApp);
  return messagingInstance;
}
