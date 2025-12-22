import { db } from '../firebase'
import { doc, getDoc, setDoc, deleteDoc, collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore'
import { COL } from '../paths'
import { getUser } from './userRepo'
import type { Reactor } from './reactionRepo'

// Toggle repost state and send notifications when adding
export async function toggleRepost(albumId: string, userId: string) {
  const id = `${albumId}_${userId}`
  const ref = doc(db, COL.reposts, id)
  const snap = await getDoc(ref)
  if (snap.exists()) {
    await deleteDoc(ref)
    return { added: false }
  } else {
    await setDoc(ref, { albumId, userId, createdAt: new Date() })
    // Notifications: owner + participants (excluding owner and actor)
    try {
      const albumSnap = await getDoc(doc(db, COL.albums, albumId))
      const ownerId = (albumSnap.data() as any)?.ownerId as string | undefined
      const { addNotification } = await import('./notificationRepo')
      if (ownerId && ownerId !== userId) {
        await addNotification({ userId: ownerId, actorId: userId, type: 'repost', albumId, message: 'あなたのアルバムがリポストされました' })
      }
      // participants = image uploaders
      const { listUploaderIdsByAlbum } = await import('./imageRepo')
      const uploaderIds = await listUploaderIdsByAlbum(albumId)
      const participants = uploaderIds.filter(uid => uid && uid !== ownerId && uid !== userId)
      await Promise.all(participants.map(pid => addNotification({ userId: pid, actorId: userId, type: 'repost', albumId, message: 'あなたが参加しているアルバムがリポストされました' })))
    } catch (e) {
      console.warn('addNotification failed (repost)', e)
    }
    return { added: true }
  }
}

export async function hasReposted(albumId: string, userId: string): Promise<boolean> {
  const id = `${albumId}_${userId}`
  const snap = await getDoc(doc(db, COL.reposts, id))
  return snap.exists()
}

export async function getRepost(albumId: string, userId: string): Promise<{ albumId: string; userId: string; createdAt: any } | null> {
  const id = `${albumId}_${userId}`
  const ref = doc(db, COL.reposts, id)
  const snap = await getDoc(ref)
  if (!snap.exists()) return null
  const data: any = snap.data()
  return { albumId: data.albumId, userId: data.userId, createdAt: data.createdAt }
}

export async function countReposts(albumId: string): Promise<number> {
  const q = query(collection(db, COL.reposts), where('albumId', '==', albumId))
  const { getDocs } = await import('firebase/firestore')
  const snap = await getDocs(q)
  return snap.size
}

export async function subscribeReposts(
  albumId: string,
  onNext: (rows: Array<{ userId?: string; createdAt?: any }>) => void,
  onError?: (err: unknown) => void,
): Promise<() => void> {
  const { db } = await import('../firebase')
  const { collection, onSnapshot, query, where } = await import('firebase/firestore')
  const { COL } = await import('../paths')
  const q = query(collection(db, COL.reposts), where('albumId', '==', albumId))
  const unsub = onSnapshot(
    q,
    (snapshot: any) => {
      const list: Array<{ userId?: string; createdAt?: any }> = []
      snapshot.forEach((docSnap: any) => list.push({ userId: (docSnap.data() as any).userId, createdAt: (docSnap.data() as any).createdAt }))
      onNext(list)
    },
    (err: unknown) => onError?.(err),
  )
  return () => unsub()
}

// List latest reposts by specific users (friends/watch). Note: Firestore `in` is limited to 10 per query.
export async function listRecentRepostsByUsers(userIds: string[], maxPerUser = 20): Promise<Array<{ albumId: string; userId: string; createdAt: any }>> {
  const { getDocs } = await import('firebase/firestore')
  const uniq = Array.from(new Set(userIds)).filter(Boolean)
  const results: Array<{ albumId: string; userId: string; createdAt: any }> = []
  for (const uid of uniq) {
    try {
      // 各ユーザーごとに createdAt 降順で取得（複合インデックス不要化と最新性の担保）
      const q = query(collection(db, COL.reposts), where('userId', '==', uid), orderBy('createdAt', 'desc'), limit(maxPerUser))
      const snap = await getDocs(q)
      snap.forEach(d => {
        const data: any = d.data()
        if (data?.albumId && data?.userId) results.push({ albumId: data.albumId, userId: data.userId, createdAt: data.createdAt })
      })
    } catch (e) {
      console.warn('listRecentRepostsByUsers: per-user query failed', uid, e)
    }
  }
  // 全体を createdAt 降順で統合ソート
  results.sort((a, b) => {
    const ta = (a.createdAt?.toDate?.() || (typeof a.createdAt?.seconds === 'number' ? new Date(a.createdAt.seconds * 1000) : a.createdAt) || 0)?.getTime?.() || 0
    const tb = (b.createdAt?.toDate?.() || (typeof b.createdAt?.seconds === 'number' ? new Date(b.createdAt.seconds * 1000) : b.createdAt) || 0)?.getTime?.() || 0
    return tb - ta
  })
  return results
}

// 指定アルバムをリポストしたユーザー一覧（最大 limit 件、作成日の新しい順）
export async function listRepostersByAlbum(albumId: string, limitCount = 20): Promise<Reactor[]> {
  // orderBy を使わずに取得し、クライアント側で createdAt 降順にソート（複合インデックス回避）
  const q = query(collection(db, COL.reposts), where('albumId', '==', albumId), limit(500))
  const snap = await getDocs(q)
  const byUser = new Map<string, any>()
  snap.forEach((d:any) => {
    const v: any = d.data()
    const uid = v.userId as string
    if (!uid) return
    const prev = byUser.get(uid)
    const createdAt = v.createdAt
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
  const byId = new Map(users.filter(Boolean).map((u:any)=>[u.uid,u]))
  return pickedUids
    .map(uid => byId.get(uid))
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map((u) => ({ uid: u.uid, displayName: u.displayName, handle: (u as any).handle ?? null, iconURL: (u as any).iconURL }))
}
