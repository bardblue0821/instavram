import { db } from '../firebase'
import { collection, addDoc, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { COL } from '../paths'

// 動的 import で getDocs を遅延 (SSR 環境回避 & バンドル最適化軽微)
async function countUserImages(albumId: string, uploaderId: string) {
  const q = query(collection(db, COL.albumImages), where('albumId', '==', albumId), where('uploaderId', '==', uploaderId))
  const { getDocs } = await import('firebase/firestore')
  const snap = await getDocs(q)
  return snap.size
}

export async function canUploadMoreImages(albumId: string, uploaderId: string) {
  const current = await countUserImages(albumId, uploaderId)
  return current < 4
}

export async function addImage(albumId: string, uploaderId: string, url: string) {
  const current = await countUserImages(albumId, uploaderId)
  if (current >= 4) throw new Error('LIMIT_4_PER_USER')
  const ref = await addDoc(collection(db, COL.albumImages), { albumId, uploaderId, url, createdAt: new Date() })
  // id フィールドを後から追加して UI 側で doc.id を持てるようにする
  await updateDoc(ref, { id: ref.id })
}

export async function listImages(albumId: string) {
  const q = query(collection(db, COL.albumImages), where('albumId', '==', albumId))
  const { getDocs } = await import('firebase/firestore')
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// ユーザーが画像を投稿したアルバムID一覧（重複除去）
export async function listAlbumIdsByUploader(userId: string, limitCount = 500) {
  // limitCount は将来 where + orderBy で制御するための予約。現状は全件取得後に slice
  const q = query(collection(db, COL.albumImages), where('uploaderId', '==', userId))
  const { getDocs } = await import('firebase/firestore')
  const snap = await getDocs(q)
  const set = new Set<string>()
  for (const d of snap.docs) {
    const data: any = d.data()
    if (data.albumId) set.add(data.albumId)
  }
  return Array.from(set).slice(0, limitCount)
}

export async function deleteImage(imageId: string) {
  // ルール側で uploader または owner を許可。ここでは単純削除。
  await deleteDoc(doc(db, COL.albumImages, imageId))
}
