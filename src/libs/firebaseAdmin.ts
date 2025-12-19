import * as admin from 'firebase-admin';

let _initialized = false;

function init() {
  if (_initialized) return;
  try {
    if (!admin.apps.length) {
      // Try application default credentials; optionally support JSON in env
      const creds = process.env.FIREBASE_ADMIN_CREDENTIALS;
      if (creds) {
        const json = JSON.parse(creds);
        admin.initializeApp({ credential: admin.credential.cert(json) });
      } else {
        admin.initializeApp({ credential: admin.credential.applicationDefault() });
      }
    }
    _initialized = true;
  } catch (e) {
    // Leave uninitialized; verification will fail fast
    console.warn('firebase-admin init failed', e);
  }
}

export async function verifyIdToken(token: string): Promise<any | null> {
  init();
  try {
    return await admin.auth().verifyIdToken(token);
  } catch {
    return null;
  }
}
