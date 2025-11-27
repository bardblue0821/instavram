import { db } from '../firebase';
import { COL } from '../paths';
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs } from 'firebase/firestore';
import type { WatchDoc } from '../../types/models';

function watchId(userId: string, ownerId: string) {
  return `${userId}_${ownerId}`; // userId が watcher
}

export async function addWatch(userId: string, ownerId: string) {
  if (userId === ownerId) throw new Error('SELF_WATCH');
  const id = watchId(userId, ownerId);
  const ref = doc(db, COL.watches, id);
  const snap = await getDoc(ref);
  if (snap.exists()) return; // 既存なら何もしない
  const now = new Date();
  await setDoc(ref, { id, userId, ownerId, createdAt: now } satisfies WatchDoc);
  // 通知: ウォッチされた側へ
  try {
    if (ownerId !== userId) {
      const { addNotification } = await import('./notificationRepo');
      await addNotification({ userId: ownerId, actorId: userId, type: 'watch', watchId: id });
    }
  } catch (e) { /* ignore */ }
}

export async function removeWatch(userId: string, ownerId: string) {
  const id = watchId(userId, ownerId);
  await deleteDoc(doc(db, COL.watches, id));
}

export async function toggleWatch(userId: string, ownerId: string) {
  const id = watchId(userId, ownerId);
  const ref = doc(db, COL.watches, id);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await deleteDoc(ref);
  } else {
    const now = new Date();
    await setDoc(ref, { id, userId, ownerId, createdAt: now } satisfies WatchDoc);
    try {
      if (ownerId !== userId) {
        const { addNotification } = await import('./notificationRepo');
        await addNotification({ userId: ownerId, actorId: userId, type: 'watch', watchId: id });
      }
    } catch {}
  }
}

export async function listWatchedOwnerIds(userId: string): Promise<string[]> {
  const q = query(collection(db, COL.watches), where('userId', '==', userId));
  const res = await getDocs(q);
  const ids: string[] = [];
  res.forEach(d => ids.push((d.data() as WatchDoc).ownerId));
  return ids;
}

export async function isWatched(userId: string, ownerId: string): Promise<boolean> {
  const id = watchId(userId, ownerId);
  const snap = await getDoc(doc(db, COL.watches, id));
  return snap.exists();
}

export async function listWatchers(ownerId: string): Promise<string[]> {
  const q = query(collection(db, COL.watches), where('ownerId', '==', ownerId));
  const res = await getDocs(q);
  const ids: string[] = [];
  res.forEach(d => ids.push((d.data() as WatchDoc).userId));
  return ids;
}
