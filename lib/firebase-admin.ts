import admin from 'firebase-admin';

function initFirebaseAdmin(): admin.app.App | null {
  if (admin.apps.length > 0) return admin.apps[0]!;

  // Option 1: FIREBASE_SERVICE_ACCOUNT env (full JSON string)
  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (serviceAccountJson) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (err) {
      console.error('[firebase-admin] Failed to parse FIREBASE_SERVICE_ACCOUNT:', err);
      return null;
    }
  }

  // Option 2: Individual env vars
  const projectId =
    process.env.FIREBASE_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    try {
      return admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    } catch (err) {
      console.error('[firebase-admin] Failed to init with individual creds:', err);
      return null;
    }
  }

  // No credentials available — FCM will be disabled
  console.warn('[firebase-admin] No credentials found — FCM disabled');
  return null;
}

const firebaseAdmin = initFirebaseAdmin();

/**
 * Firebase Admin Messaging instance, or null if credentials are missing.
 * Callers must check for null before use.
 */
export const messaging = firebaseAdmin ? firebaseAdmin.messaging() : null;
