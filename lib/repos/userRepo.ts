import { db } from '../firebase'
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit } from 'firebase/firestore'
import { COL } from '../paths'

export async function getUser(uid: string) {
  const snap = await getDoc(doc(db, COL.users, uid))
  return snap.exists() ? snap.data() : null
}

export async function createUser(uid: string, displayName: string, handle?: string) {
  const now = new Date()
  await setDoc(doc(db, COL.users, uid), { uid, displayName, handle: handle || null, createdAt: now })
}

// 重複チェック用: handle(ユーザーID) が既に使われているか
export async function isHandleTaken(handle: string): Promise<boolean> {
  const h = handle.trim()
  if (!h) return false
  // インデックス最適化は後工程。現状は単純 where クエリ。
  const q = query(collection(db, COL.users), where('handle', '==', h))
  const snap = await getDocs(q)
  return !snap.empty
}

// handle からユーザードキュメントを取得（存在しない場合 null）
export async function getUserByHandle(handle: string) {
  const h = handle.trim().toLowerCase()
  if (!h) return null
  // 一意前提なので limit(1)
  const q = query(collection(db, COL.users), where('handle', '==', h), limit(1))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return snap.docs[0].data()
}
