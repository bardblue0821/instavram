import { db } from '../firebase'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { COL } from '../paths'

export async function getUser(uid: string) {
  const snap = await getDoc(doc(db, COL.users, uid))
  return snap.exists() ? snap.data() : null
}

export async function createUser(uid: string, displayName: string) {
  const now = new Date()
  await setDoc(doc(db, COL.users, uid), { uid, displayName, createdAt: now })
}
