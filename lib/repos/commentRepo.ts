import { db } from '../firebase'
import { collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore'
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
