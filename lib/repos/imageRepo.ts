import { db } from '../firebase'
import { collection, addDoc, query, where } from 'firebase/firestore'
import { COL } from '../paths'

// 動的 import で getDocs を遅延 (SSR 環境回避 & バンドル最適化軽微)
async function countUserImages(albumId: string, uploaderId: string) {
  const q = query(collection(db, COL.albumImages), where('albumId', '==', albumId), where('uploaderId', '==', uploaderId))
  const { getDocs } = await import('firebase/firestore')
  const snap = await getDocs(q)
  return snap.size
}

export async function addImage(albumId: string, uploaderId: string, url: string) {
  const current = await countUserImages(albumId, uploaderId)
  if (current >= 4) throw new Error('LIMIT_4_PER_USER')
  await addDoc(collection(db, COL.albumImages), { albumId, uploaderId, url, createdAt: new Date() })
}
