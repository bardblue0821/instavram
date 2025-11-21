import { db } from '../firebase'
import { collection, addDoc, doc, getDoc, updateDoc, orderBy, limit, query } from 'firebase/firestore'
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

// タイムライン暫定取得（フィルタは呼び出し側で）
export async function getLatestAlbums(limitCount = 50) {
  const q = query(collection(db, COL.albums), orderBy('createdAt', 'desc'), limit(limitCount))
  const snap = await getDocsCompat(q)
  return snap.docs.map(d => d.data())
}

// Firestore v9で getDocs を後から import する都合の軽いラッパ（treeshake回避用）
async function getDocsCompat(q: any) {
  const { getDocs } = await import('firebase/firestore')
  return await getDocs(q)
}
