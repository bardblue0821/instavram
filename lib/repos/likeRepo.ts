import { db } from '../firebase'
import { doc, getDoc, setDoc, deleteDoc, collection, query, where } from 'firebase/firestore'
import { COL } from '../paths'

export async function toggleLike(albumId: string, userId: string) {
  const id = `${albumId}_${userId}`
  const ref = doc(db, COL.likes, id)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    await deleteDoc(ref)
  } else {
    await setDoc(ref, { albumId, userId, createdAt: new Date() })
    // 通知: アルバムオーナーへ（自分自身へのいいねは通知不要）
    try {
      const albumSnap = await getDoc(doc(db, COL.albums, albumId))
      const ownerId = (albumSnap.data() as any)?.ownerId
      if (ownerId && ownerId !== userId) {
        const { addNotification } = await import('./notificationRepo')
        await addNotification({ userId: ownerId, actorId: userId, type: 'like', albumId })
      }
    } catch (e) {
      console.warn('addNotification failed (like -> notification)', e)
    }
  }
}

// いいね済みか判定
export async function hasLiked(albumId: string, userId: string): Promise<boolean> {
  const id = `${albumId}_${userId}`
  const snap = await getDoc(doc(db, COL.likes, id))
  return snap.exists()
}

// 件数取得（大量になると負荷→後で集計キャッシュ化検討）
export async function countLikes(albumId: string): Promise<number> {
  const q = query(collection(db, COL.likes), where('albumId', '==', albumId))
  const { getDocs } = await import('firebase/firestore')
  const snap = await getDocs(q)
  return snap.size
}

// タイムライン等でのリアルタイム更新用購読API
export async function subscribeLikes(
  albumId: string,
  onNext: (rows: Array<{ userId?: string }>) => void,
  onError?: (err: unknown) => void,
): Promise<() => void> {
  const { db } = await import('../firebase')
  const { collection, onSnapshot, query, where } = await import('firebase/firestore')
  const { COL } = await import('../paths')
  const q = query(collection(db, COL.likes), where('albumId', '==', albumId))
  const unsub = onSnapshot(
    q,
    (snapshot: any) => {
      const list: Array<{ userId?: string }> = []
      snapshot.forEach((docSnap: any) => list.push({ userId: (docSnap.data() as any).userId }))
      onNext(list)
    },
    (err: unknown) => onError?.(err),
  )
  return () => unsub()
}
