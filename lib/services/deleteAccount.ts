import { db } from '../firebase'
import { collection, deleteDoc, doc, getDocs, limit, query, where, writeBatch } from 'firebase/firestore'
import { COL } from '../paths'

type ProgressCb = (step: string, deleted: number) => void

async function deleteByQueries(qs: any[], step: string, onProgress?: ProgressCb) {
  let total = 0
  for (const baseQ of qs) {
    while (true) {
      const ql = query(baseQ, limit(300))
      const snap = await getDocs(ql)
      if (snap.empty) break
      const batch = writeBatch(db)
      snap.forEach(d => batch.delete(d.ref))
      await batch.commit()
      total += snap.size
      onProgress?.(step, total)
      // 小休止でスロットリング回避
      await new Promise(r => setTimeout(r, 10))
    }
  }
  onProgress?.(step, total)
}

export async function deleteAccountData(uid: string, onProgress?: ProgressCb) {
  // 1) likes (自分が押した)
  await deleteByQueries([
    query(collection(db, COL.likes), where('userId', '==', uid)),
  ], 'likes', onProgress)

  // 2) comments (自分が書いた)
  await deleteByQueries([
    query(collection(db, COL.comments), where('userId', '==', uid)),
  ], 'comments', onProgress)

  // 3) watches（自分がウォッチしている）
  await deleteByQueries([
    query(collection(db, COL.watches), where('userId', '==', uid)),
  ], 'watches(user)', onProgress)
  // ownerId 側は現行ルールで本人削除が不可のためスキップ（残置）

  // 4) friends（双方向）
  await deleteByQueries([
    query(collection(db, COL.friends), where('userId', '==', uid)),
    query(collection(db, COL.friends), where('targetId', '==', uid)),
  ], 'friends', onProgress)

  // 5) albumImages（自分がアップした）
  await deleteByQueries([
    query(collection(db, COL.albumImages), where('uploaderId', '==', uid)),
  ], 'albumImages', onProgress)

  // 6) albums（自分がオーナー）
  await deleteByQueries([
    query(collection(db, COL.albums), where('ownerId', '==', uid)),
  ], 'albums', onProgress)

  // 7) users ドキュメント
  await deleteDoc(doc(db, COL.users, uid))
  onProgress?.('users', 1)
}
