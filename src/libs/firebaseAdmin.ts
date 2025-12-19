import * as admin from 'firebase-admin';

let _initialized = false;

function init() {
  if (_initialized) return;
  try {
    if (!admin.apps.length) {
      // Try application default credentials; optionally support JSON in env
      const creds = process.env.FIREBASE_ADMIN_CREDENTIALS;
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
      if (creds) {
        const json = JSON.parse(creds);
        admin.initializeApp({ credential: admin.credential.cert(json), projectId: projectId || json.project_id });
      } else {
        admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
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

export function getAdminDb() {
  init();
  try {
    return admin.firestore();
  } catch (e) {
    throw new Error('ADMIN_DB_NOT_INITIALIZED');
  }
}
