import { db } from '../firebase'
import { collection, addDoc, doc, getDoc, updateDoc, orderBy, limit, query, where, deleteDoc } from 'firebase/firestore'
import { COL } from '../paths'

export async function createAlbum(ownerId: string, data: { title?: string; placeUrl?: string }) {
  const now = new Date()
  return await addDoc(collection(db, COL.albums), {
    ownerId,
    title: data.title || null,
    placeUrl: data.placeUrl || null,
    createdAt: now,
    updatedAt: now,
  })
}

export async function getAlbum(id: string) {
  const snap = await getDoc(doc(db, COL.albums, id))
  return snap.exists() ? snap.data() : null
}

export async function touchAlbum(id: string) {
  await updateDoc(doc(db, COL.albums, id), { updatedAt: new Date() })
}

// 部分更新 (title, placeUrl) - 空文字は null へ。オーナー権限チェックは Firestore ルール側で担保。
export async function updateAlbum(id: string, data: { title?: string; placeUrl?: string }) {
  const patch: any = {}
  if (data.title !== undefined) patch.title = data.title.trim() === '' ? null : data.title
  if (data.placeUrl !== undefined) patch.placeUrl = data.placeUrl.trim() === '' ? null : data.placeUrl
  patch.updatedAt = new Date()
  await updateDoc(doc(db, COL.albums, id), patch)
}

// アルバム削除（オーナー本人のみルールで許可）
export async function deleteAlbum(id: string) {
  await deleteDoc(doc(db, COL.albums, id))
}

// Firebase 直接依存をページから排除するための薄いラッパー
export async function getAlbumSafe(albumId: string): Promise<{ id: string; [k: string]: any } | null> {
  try {
    const { db } = await import("../firebase");
    const { doc, getDoc } = await import("firebase/firestore");
    const { COL } = await import("../paths");
    const ref = doc(db, COL.albums, albumId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...(snap.data() as any) };
  } catch (e) {
    throw e;
  }
}

// タイムライン暫定取得（フィルタは呼び出し側で）
export async function getLatestAlbums(limitCount = 50) {
  const q = query(collection(db, COL.albums), orderBy('createdAt', 'desc'), limit(limitCount))
  const snap = await getDocsCompat(q)
  return snap.docs.map(d => d.data())
}

// オーナー別アルバム一覧（プロフィール用）
export async function listAlbumsByOwner(ownerId: string, limitCount = 100) {
  const q = query(
    collection(db, COL.albums),
    where('ownerId', '==', ownerId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  )
  try {
    const snap = await getDocsCompat(q)
    return snap.docs.map(d => {
      const data: any = d.data()
      return { id: d.id, ...data }
    })
  } catch (e: any) {
    // インデックス不足時のフォールバック: orderBy を外して手動ソート
    if (String(e.message || '').includes('index') || String(e).includes('FAILED_PRECONDITION')) {
      const q2 = query(collection(db, COL.albums), where('ownerId', '==', ownerId))
      const snap2 = await getDocsCompat(q2)
      return snap2.docs
        .map(d => {
          const data: any = d.data()
          return { id: d.id, ...data }
        })
        .sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
    }
    throw e
  }
}

// Firestore v9で getDocs を後から import する都合の軽いラッパ（treeshake回避用）
async function getDocsCompat(q: any) {
  const { getDocs } = await import('firebase/firestore')
  return await getDocs(q)
}
