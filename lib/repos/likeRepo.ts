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
