import { db } from '../firebase'
import { doc, getDoc, setDoc, collection, query, where, getDocs, limit, updateDoc } from 'firebase/firestore'
import { COL } from '../paths'

// 拡張ユーザー型 (後方互換: 既存ドキュメントに無いフィールドは undefined/null 扱い)
export interface UserDoc {
  uid: string;
  displayName: string;
  handle: string | null;
  bio?: string | null;            // 最大500文字 (保存時サニタイズ)
  vrchatUrl?: string | null;      // VRChat関連URL 1件 (http/https, "vrchat" を含む簡易チェック推奨)
  links?: string[];               // その他URL 最大3件 (http/https)
  language?: string | null;       // 言語コード/名称
  gender?: string | null;         // 'male' | 'female' | 'other' | 'unspecified' 等
  age?: number | null;            // 0〜150 (任意 / birthDate からの自動算出は後工程)
  location?: string | null;       // 住んでいる場所 (自由入力)
  birthDate?: string | null;      // YYYY-MM-DD 形式 (表示用)
  createdAt?: Date;               // 初期作成時
  updatedAt?: Date;               // updateUser 実行時設定
}

export async function getUser(uid: string): Promise<UserDoc | null> {
  const snap = await getDoc(doc(db, COL.users, uid))
  return snap.exists() ? (snap.data() as UserDoc) : null
}

export async function createUser(uid: string, displayName: string, handle?: string) {
  const now = new Date()
  await setDoc(doc(db, COL.users, uid), { uid, displayName, handle: handle || null, createdAt: now })
}

// 部分更新 (未指定フィールドは変更しない)。不要な空文字は除去。
export async function updateUser(uid: string, patch: Partial<UserDoc>) {
  const ref = doc(db, COL.users, uid)
  const now = new Date()
  // links 正規化 (最大3件 / trim / 空除去)
  let links = patch.links
  if (links) {
    links = links.map(l => l.trim()).filter(l => !!l).slice(0, 3)
  }
  // bio サニタイズ: 改行除去 -> 全角スペース除去 -> 複数半角スペース縮約 -> 100文字制限
  let bio = patch.bio
  if (typeof bio === 'string') {
    let b = bio
      .replace(/[\r\n]+/g, ' ')      // 改行をスペースへ
      .replace(/[\u3000]+/g, '')      // 全角スペース除去
      .replace(/ {2,}/g, ' ')          // 連続半角スペース縮約
      .trim()
    if (b.length > 100) b = b.slice(0, 100)
    bio = b
  }
  const vrchatUrl = typeof patch.vrchatUrl === 'string' ? patch.vrchatUrl.trim() : patch.vrchatUrl
  const birthDate = typeof patch.birthDate === 'string' ? patch.birthDate.trim() : patch.birthDate
  const displayName = typeof patch.displayName === 'string' ? patch.displayName.trim() : patch.displayName
  const handle = typeof patch.handle === 'string' ? patch.handle.trim().toLowerCase() : patch.handle
  await updateDoc(ref, {
    ...(bio !== undefined ? { bio: bio || null } : {}),
    ...(vrchatUrl !== undefined ? { vrchatUrl: vrchatUrl || null } : {}),
    ...(links !== undefined ? { links } : {}),
    ...(patch.language !== undefined ? { language: (patch.language || '').trim() || null } : {}),
    ...(patch.gender !== undefined ? { gender: patch.gender || null } : {}),
    ...(patch.age !== undefined ? { age: (patch.age === null ? null : patch.age) } : {}),
    ...(patch.location !== undefined ? { location: (patch.location || '').trim() || null } : {}),
    ...(birthDate !== undefined ? { birthDate: birthDate || null } : {}),
    ...(displayName !== undefined ? { displayName: displayName || '' } : {}),
    ...(handle !== undefined ? { handle: handle || null } : {}),
    updatedAt: now
  })
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
export async function getUserByHandle(handle: string): Promise<UserDoc | null> {
  const h = handle.trim().toLowerCase()
  if (!h) return null
  const q = query(collection(db, COL.users), where('handle', '==', h), limit(1))
  const snap = await getDocs(q)
  if (snap.empty) return null
  return snap.docs[0].data() as UserDoc
}

// handle に一致するユーザー一覧（重複チェック用：通常は0件か1件）
export async function listUsersByHandle(handle: string): Promise<UserDoc[]> {
  const h = handle.trim().toLowerCase()
  if (!h) return []
  const q = query(collection(db, COL.users), where('handle', '==', h))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data() as UserDoc)
}

// ensure ユーザーの作成/更新（displayName + handle）
export async function ensureUserWithHandle(uid: string, displayName: string, handle: string) {
  const now = new Date()
  const h = (handle || '').trim().toLowerCase()
  const ref = doc(db, COL.users, uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, { uid, displayName: displayName.trim(), handle: h || null, createdAt: now })
  } else {
    await updateDoc(ref, { displayName: displayName.trim(), handle: h || null, updatedAt: now })
  }
}
