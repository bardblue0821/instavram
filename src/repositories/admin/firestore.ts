import { getAdminDb } from '@/src/libs/firebaseAdmin';
import { COL } from '@/lib/paths';
import * as admin from 'firebase-admin';

export async function adminAddImage(albumId: string, uploaderId: string, url: string, thumbUrl?: string) {
  try {
    const db = getAdminDb();
    const data: any = { albumId, uploaderId, url, createdAt: admin.firestore.FieldValue.serverTimestamp() };
    if (thumbUrl) data.thumbUrl = thumbUrl;
    console.log('[adminAddImage] adding image:', { albumId, uploaderId, hasUrl: !!url, hasThumbUrl: !!thumbUrl });
    const ref = await db.collection(COL.albumImages).add(data);
    console.log('[adminAddImage] image added, id:', ref.id);
    await ref.update({ id: ref.id });
    console.log('[adminAddImage] success');
  } catch (e) {
    console.error('[adminAddImage] error:', e);
    throw e;
  }
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

export async function adminToggleRepost(albumId: string, userId: string): Promise<{ added?: boolean; removed?: boolean }> {
  const db = getAdminDb();
  const id = `${albumId}_${userId}`;
  const ref = db.collection(COL.reposts).doc(id);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.delete();
    return { removed: true };
  } else {
    await ref.set({ albumId, userId, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    // 通知: オーナー + 参加者（オーナーと行為者を除外）
    try {
      const albumSnap = await db.collection(COL.albums).doc(albumId).get();
      const ownerId = (albumSnap.data() as any)?.ownerId as string | undefined;
      const addNotif = async (p: { userId: string; actorId: string; type: string; albumId: string; message: string }) => {
        const nref = await db.collection(COL.notifications).add({ ...p, createdAt: admin.firestore.FieldValue.serverTimestamp(), readAt: null });
        await nref.update({ id: nref.id });
      };
      if (ownerId && ownerId !== userId) {
        await addNotif({ userId: ownerId, actorId: userId, type: 'repost', albumId, message: 'あなたのアルバムがリポストされました' });
      }
      // 参加者 = アップローダー
  const imgsSnap = await db.collection(COL.albumImages).where('albumId', '==', albumId).get();
  const uploaderIds = new Set<string>();
  imgsSnap.forEach((d: FirebaseFirestore.QueryDocumentSnapshot) => { const v = d.data() as any; if (v?.uploaderId) uploaderIds.add(v.uploaderId as string); });
      for (const pid of uploaderIds) {
        if (!pid || pid === userId || pid === ownerId) continue;
        await addNotif({ userId: pid, actorId: userId, type: 'repost', albumId, message: 'あなたが参加しているアルバムがリポストされました' });
      }
    } catch (e) {
      console.warn('adminToggleRepost: notification failed', e);
    }
    return { added: true };
  }
}
