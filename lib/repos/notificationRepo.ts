import { db } from '../firebase'
import { COL } from '../paths'
import { collection, addDoc, query, where, orderBy, limit, writeBatch, doc, setDoc } from 'firebase/firestore'

export type NotificationType = 'comment'|'like'|'image'|'friend_request'|'watch'|'repost'|'reaction'

export interface NotificationInput {
  userId: string          // 受信者
  actorId: string         // 行為者
  type: NotificationType
  albumId?: string
  imageId?: string
  commentId?: string
  friendRequestId?: string
  watchId?: string
  message?: string        // 渡されなければ自動生成
}

function buildMessage(p: NotificationInput): string {
  // 最低限の簡易テンプレ。後で actor の handle 取得ロジック追加可。
  switch(p.type){
    case 'comment': return 'コメントが追加されました'
    case 'like': return 'アルバムにいいねが付きました'
    case 'image': return 'アルバムに画像が追加されました'
    case 'friend_request': return 'フレンド申請が届きました'
    case 'watch': return 'あなたがウォッチされました'
    case 'repost': return 'あなたの投稿がリポストされました'
    case 'reaction': return 'リアクションが付きました'
    default: return '新しい通知'
  }
}

export async function addNotification(p: NotificationInput) {
  const message = p.message || buildMessage(p)
  const createdAt = new Date()
  // 生成 ID を先に確定させ、作成時に id を同時書き込み（ルールの update 制限を回避）
  const ref = doc(collection(db, COL.notifications))
  await setDoc(ref, { ...p, id: ref.id, message, createdAt, readAt: null })
}

export async function listNotifications(userId: string, limitCount = 100){
  const q = query(
    collection(db, COL.notifications),
    where('userId','==', userId),
    orderBy('createdAt','desc'),
    limit(limitCount)
  )
  const { getDocs } = await import('firebase/firestore')
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
}

export async function markAllRead(userId: string){
  const q = query(collection(db, COL.notifications), where('userId','==', userId), where('readAt','==', null))
  const { getDocs } = await import('firebase/firestore')
  const snap = await getDocs(q)
  if (snap.empty) return
  const batch = writeBatch(db)
  const now = new Date()
  snap.forEach(docSnap => batch.update(doc(db, COL.notifications, docSnap.id), { readAt: now }))
  await batch.commit()
}

export async function subscribeNotifications(userId: string, onNext: (rows: any[]) => void, onError?: (e:any)=>void){
  const { onSnapshot } = await import('firebase/firestore')
  const q = query(collection(db, COL.notifications), where('userId','==', userId), orderBy('createdAt','desc'), limit(100))
  const unsub = onSnapshot(q, (snap:any) => {
    const list:any[] = []
    snap.forEach((d:any)=> list.push({ id: d.id, ...(d.data() as any) }))
    onNext(list)
  }, (err:any)=> onError?.(err))
  return () => unsub()
}

export async function countUnread(userId: string){
  const q = query(collection(db, COL.notifications), where('userId','==', userId), where('readAt','==', null))
  const { getDocs } = await import('firebase/firestore')
  const snap = await getDocs(q)
  return snap.size
}
