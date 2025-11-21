import { db } from '../firebase'
import { collection, addDoc } from 'firebase/firestore'
import { COL } from '../paths'

export async function addComment(albumId: string, userId: string, body: string) {
  if (!body.trim()) throw new Error('EMPTY')
  if (body.length > 200) throw new Error('TOO_LONG')
  await addDoc(collection(db, COL.comments), { albumId, userId, body, createdAt: new Date() })
}
