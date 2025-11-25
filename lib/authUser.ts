import { getUser, createUser } from './repos/userRepo';
import { isHandleTaken } from './repos/userRepo';
import { isHandleBlocked } from './constants/userFilters';

export async function ensureUser(uid: string, displayName?: string | null, email?: string | null, handle?: string | null) {
  const existing = await getUser(uid);
  if (existing) return existing;
  const baseName = (displayName && displayName.trim()) || (email ? email.split('@')[0] : '') || 'user';
  let finalHandle: string | undefined = undefined;
  if (handle && handle.trim()) {
    finalHandle = handle.trim();
  } else {
    // 自動生成 (Google ログインなど). 競合したら suffix を付与して最大3回試行。
    const base = (baseName || 'user').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 15) || 'user';
    let candidate = base;
    for (let i = 0; i < 4; i++) {
      const taken = await isHandleTaken(candidate);
      const blocked = isHandleBlocked(candidate);
      if (!taken && !blocked) { finalHandle = candidate; break; }
      candidate = base + '_' + Math.random().toString(36).slice(2, 5);
    }
    if (!finalHandle) {
      let fallback = base + '_' + Date.now().toString(36).slice(-4);
      if (isHandleBlocked(fallback)) fallback = base + '_' + Math.random().toString(36).slice(2, 6);
      finalHandle = fallback;
    }
  }
  await createUser(uid, baseName, finalHandle);
  return await getUser(uid);
}
