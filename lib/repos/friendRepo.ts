import { db } from '../firebase';
import { COL } from '../paths';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import type { FriendDoc } from '../../types/models';

// ドキュメントID: userId_targetId （申請方向）
function friendId(userId: string, targetId: string) {
  return `${userId}_${targetId}`;
}

export async function sendFriendRequest(userId: string, targetId: string) {
  if (userId === targetId) throw new Error('SELF_FRIEND');
  const id = friendId(userId, targetId);
  const ref = doc(db, COL.friends, id);
  const snap = await getDoc(ref);
  if (snap.exists()) return; // 既に存在→何もしない（再送抑止）
  const now = new Date();
  await setDoc(ref, { id, userId, targetId, status: 'pending', createdAt: now } satisfies FriendDoc);
}

export async function acceptFriend(userId: string, targetId: string) {
  // 受信側（targetId）が承認: ドキュメントは userId->targetId の方向に作成されている前提
  const id = friendId(userId, targetId);
  const ref = doc(db, COL.friends, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error('REQUEST_NOT_FOUND');
  const data = snap.data() as FriendDoc;
  if (data.status === 'accepted') return; // 既に承認済み
  await updateDoc(ref, { status: 'accepted' });
}

export async function getFriendStatus(userId: string, targetId: string) {
  const id = friendId(userId, targetId);
  const snap = await getDoc(doc(db, COL.friends, id));
  if (!snap.exists()) return null;
  return (snap.data() as FriendDoc).status;
}

// 自分が関わる accepted フレンド一覧（方向性に依存しない簡易集計）
export async function listAcceptedFriends(userId: string): Promise<FriendDoc[]> {
  // 1) 自分が userId の accepted
  const q1 = query(collection(db, COL.friends), where('userId', '==', userId), where('status', '==', 'accepted'));
  // 2) 自分が targetId の accepted（逆方向）
  const q2 = query(collection(db, COL.friends), where('targetId', '==', userId), where('status', '==', 'accepted'));
  const [r1, r2] = await Promise.all([getDocs(q1), getDocs(q2)]);
  const a: FriendDoc[] = [];
  r1.forEach(d => a.push(d.data() as FriendDoc));
  r2.forEach(d => a.push(d.data() as FriendDoc));
  return a;
}
