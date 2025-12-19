import { getAdminDb } from '@/src/libs/firebaseAdmin';
import { COL } from '@/lib/paths';
import * as admin from 'firebase-admin';

export async function adminAddImage(albumId: string, uploaderId: string, url: string, thumbUrl?: string) {
  const db = getAdminDb();
  const data: any = { albumId, uploaderId, url, createdAt: admin.firestore.FieldValue.serverTimestamp() };
  if (thumbUrl) data.thumbUrl = thumbUrl;
  const ref = await db.collection(COL.albumImages).add(data);
  await ref.update({ id: ref.id });
}

export async function adminDeleteImage(imageId: string) {
  const db = getAdminDb();
  await db.collection(COL.albumImages).doc(imageId).delete();
}

export async function adminAddComment(albumId: string, userId: string, body: string) {
  const db = getAdminDb();
  const ref = await db.collection(COL.comments).add({ albumId, userId, body, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  await ref.update({ id: ref.id });
}

export async function adminToggleLike(albumId: string, userId: string) {
  const db = getAdminDb();
  const id = `${albumId}_${userId}`;
  const ref = db.collection(COL.likes).doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.delete();
  } else {
    await ref.set({ albumId, userId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  }
}

export async function adminToggleReaction(albumId: string, userId: string, emoji: string): Promise<{ added?: boolean; removed?: boolean }> {
  const db = getAdminDb();
  const id = `${albumId}:${userId}:${emoji}`;
  const ref = db.collection(COL.reactions).doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.delete();
    return { removed: true };
  } else {
    await ref.set({ albumId, userId, emoji, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    return { added: true };
  }
}
