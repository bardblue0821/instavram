import { db } from '../firebase'
import { collection, addDoc, doc, updateDoc, deleteDoc, query, where, orderBy, limit } from 'firebase/firestore'
import { COL } from '../paths'

export async function addComment(albumId: string, userId: string, body: string) {
  if (!body.trim()) throw new Error('EMPTY')
  if (body.length > 200) throw new Error('TOO_LONG')
  const ref = await addDoc(collection(db, COL.comments), { albumId, userId, body, createdAt: new Date() })
  await updateDoc(ref, { id: ref.id })
}

export async function updateComment(commentId: string, body: string) {
  if (!body.trim()) throw new Error('EMPTY')
  if (body.length > 200) throw new Error('TOO_LONG')
  await updateDoc(doc(db, COL.comments, commentId), { body })
}

export async function deleteComment(commentId: string) {
  await deleteDoc(doc(db, COL.comments, commentId))
}

// ユーザーのコメント一覧（プロフィール用）
export async function listCommentsByUser(userId: string, limitCount = 50) {
  const q = query(
    collection(db, COL.comments),
    where('userId', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  )
  try {
    const { getDocs } = await import('firebase/firestore')
    const snap = await getDocs(q)
    return snap.docs.map(d => {
      const data: any = d.data()
      return { id: d.id, ...data }
    })
  } catch (e: any) {
    if (String(e.message || '').includes('index') || String(e).includes('FAILED_PRECONDITION')) {
      // フォールバック: orderBy なしで取得し手動ソート
      const q2 = query(collection(db, COL.comments), where('userId', '==', userId))
      const { getDocs } = await import('firebase/firestore')
      const snap2 = await getDocs(q2)
      return snap2.docs
        .map(d => {
          const data: any = d.data()
          return { id: d.id, ...data }
        })
        .sort((a: any, b: any) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        .slice(0, limitCount)
    }
    throw e
  }
}

// アルバムのコメント一覧（ページでの初期表示用）
export async function listComments(albumId: string): Promise<Array<{ id: string; [k: string]: any }>> {
  const q = query(collection(db, COL.comments), where('albumId', '==', albumId))
  const { getDocs } = await import('firebase/firestore')
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
}

// コメント購読（ページでのリアルタイム更新用）
export async function subscribeComments(
  albumId: string,
  onNext: (rows: Array<{ id: string; [k: string]: any }>) => void,
  onError?: (err: unknown) => void,
): Promise<() => void> {
  const { onSnapshot } = await import('firebase/firestore')
  const q = query(collection(db, COL.comments), where('albumId', '==', albumId))
  const unsub = onSnapshot(
    q,
    (snapshot: any) => {
      const list: Array<{ id: string; [k: string]: any }> = []
      snapshot.forEach((docSnap: any) => list.push({ id: docSnap.id, ...(docSnap.data() as any) }))
      onNext(list)
    },
    (err: unknown) => onError?.(err),
  )
  return () => unsub()
}
