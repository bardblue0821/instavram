import { getUser, createUser } from './repos/userRepo';

/**
 * Ensure user document exists after authentication.
 * displayName が無い場合は email の @ 前を fallback とし、さらに無ければ 'user'.
 */
export async function ensureUser(uid: string, displayName?: string | null, email?: string | null) {
  const existing = await getUser(uid);
  if (existing) return existing;
  const baseName = (displayName && displayName.trim()) || (email ? email.split('@')[0] : '') || 'user';
  return await createUser(uid, baseName);
}
