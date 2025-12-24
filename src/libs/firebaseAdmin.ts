import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

let _initialized = false;

function init() {
  if (_initialized) return;
  try {
    if (!admin.apps.length) {
      // Try service account key file path first
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      const creds = process.env.FIREBASE_ADMIN_CREDENTIALS;
      const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
      
      console.log('[firebaseAdmin] initializing with projectId:', projectId, 'hasCreds:', !!creds, 'hasCredPath:', !!credPath);
      
      if (credPath) {
        // Use service account key file
        const absolutePath = path.resolve(process.cwd(), credPath);
        console.log('[firebaseAdmin] reading service account from:', absolutePath);
        const serviceAccountJson = fs.readFileSync(absolutePath, 'utf8');
        const serviceAccount = JSON.parse(serviceAccountJson);
        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          projectId: projectId || serviceAccount.project_id
        });
        console.log('[firebaseAdmin] initialized with service account file:', credPath);
      } else if (creds) {
        // Use credentials from environment variable
        const json = JSON.parse(creds);
        admin.initializeApp({ credential: admin.credential.cert(json), projectId: projectId || json.project_id });
        console.log('[firebaseAdmin] initialized with credentials from env');
      } else {
        // Fallback to application default credentials
        admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId });
        console.log('[firebaseAdmin] initialized with application default');
      }
    }
    _initialized = true;
    console.log('[firebaseAdmin] initialization complete');
  } catch (e) {
    // Leave uninitialized; verification will fail fast
    console.error('[firebaseAdmin] init failed:', e);
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
    const db = admin.firestore();
    if (!db) {
      console.error('[getAdminDb] firestore is null');
      throw new Error('ADMIN_DB_NOT_INITIALIZED');
    }
    return db;
  } catch (e) {
    console.error('[getAdminDb] error:', e);
    throw new Error('ADMIN_DB_NOT_INITIALIZED');
  }
}
