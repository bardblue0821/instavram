import { db } from '../firebase'
import { doc, getDoc, setDoc, deleteDoc } from 'firebase/firestore'
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
