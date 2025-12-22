import { db } from '../firebase'
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, getDocs, limit } from 'firebase/firestore'
import { COL } from '../paths'
import { getUser } from './userRepo'
import type { Reactor } from './reactionRepo'

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

// いいねしたユーザーの一覧（最大 limit 件）
export async function listLikersByAlbum(albumId: string, limitCount = 20): Promise<Reactor[]> {
  // orderBy を使わずに取得し、クライアント側で createdAt 降順にソートして上位を返す（複合インデックス回避）
  const q = query(collection(db, COL.likes), where('albumId', '==', albumId), limit(500))
  const snap = await getDocs(q)
  const byUser = new Map<string, any>()
  snap.forEach((d:any) => {
    const v: any = d.data()
    const uid = v.userId as string
    if (!uid) return
    const prev = byUser.get(uid)
    const createdAt = v.createdAt
    // 同一ユーザーが複数ある場合は最新を保持
    if (!prev) byUser.set(uid, v)
    else {
      const a = (prev?.createdAt?.toDate?.() || (typeof prev?.createdAt?.seconds === 'number' ? new Date(prev.createdAt.seconds * 1000) : prev?.createdAt) || 0)?.getTime?.() || 0
      const b = (createdAt?.toDate?.() || (typeof createdAt?.seconds === 'number' ? new Date(createdAt.seconds * 1000) : createdAt) || 0)?.getTime?.() || 0
      if (b > a) byUser.set(uid, v)
    }
  })
  const sorted = Array.from(byUser.entries()).sort(([,a],[,b]) => {
    const ta = (a?.createdAt?.toDate?.() || (typeof a?.createdAt?.seconds === 'number' ? new Date(a.createdAt.seconds * 1000) : a?.createdAt) || 0)?.getTime?.() || 0
    const tb = (b?.createdAt?.toDate?.() || (typeof b?.createdAt?.seconds === 'number' ? new Date(b.createdAt.seconds * 1000) : b?.createdAt) || 0)?.getTime?.() || 0
    return tb - ta
  })
  const pickedUids = sorted.map(([uid]) => uid).slice(0, limitCount)
  const users = await Promise.all(pickedUids.map((uid) => getUser(uid)))
  // 順序を保って整形
  const byId = new Map(users.filter(Boolean).map((u:any)=>[u.uid,u]))
  return pickedUids
    .map(uid => byId.get(uid))
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map((u) => ({ uid: u.uid, displayName: u.displayName, handle: (u as any).handle ?? null, iconURL: (u as any).iconURL }))
}
