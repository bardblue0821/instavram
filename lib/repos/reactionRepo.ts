import { db } from "../firebase";
import { COL } from "../paths";
import { collection, deleteDoc, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { getUser } from "./userRepo";

export type ReactionCount = { emoji: string; count: number; mine: boolean };

export function reactionDocId(albumId: string, userId: string, emoji: string) {
  return `${albumId}:${userId}:${emoji}`;
}

export async function toggleReaction(albumId: string, userId: string, emoji: string) {
  const id = reactionDocId(albumId, userId, emoji);
  const ref = doc(db, COL.reactions || "reactions", id); // COL に無い場合の保険
  const snap = await getDoc(ref);
  if (snap.exists()) {
    await deleteDoc(ref);
    return { removed: true } as const;
  } else {
    await import("firebase/firestore").then(async ({ setDoc, serverTimestamp }) => {
      await setDoc(ref, { albumId, userId, emoji, createdAt: serverTimestamp?.() ?? new Date() });
    });
    return { added: true } as const;
  }
}

export async function listReactionsByAlbum(albumId: string, currentUserId?: string): Promise<ReactionCount[]> {
  const q = query(collection(db, COL.reactions || "reactions"), where("albumId", "==", albumId));
  const snap = await getDocs(q);
  const map = new Map<string, { count: number; mine: boolean }>();
  snap.forEach((d) => {
    const v: any = d.data();
    const key = v.emoji || "";
    const cur = map.get(key) || { count: 0, mine: false };
    cur.count += 1;
    if (currentUserId && v.userId === currentUserId) cur.mine = true;
    map.set(key, cur);
  });
  return Array.from(map.entries()).map(([emoji, v]) => ({ emoji, count: v.count, mine: v.mine }));
}

export type Reactor = { uid: string; displayName: string; handle?: string | null; iconURL?: string };

// 指定アルバムの指定絵文字にリアクションしたユーザー一覧（最大 limit 件）
export async function listReactorsByAlbumEmoji(albumId: string, emoji: string, limitCount = 20): Promise<Reactor[]> {
  const q = query(
    collection(db, COL.reactions || "reactions"),
    where("albumId", "==", albumId),
    where("emoji", "==", emoji)
  );
  const snap = await getDocs(q);
  const userIds: string[] = [];
  snap.forEach((d) => {
    const v: any = d.data();
    const uid = v.userId as string;
    if (uid && !userIds.includes(uid)) userIds.push(uid);
  });
  const picked = userIds.slice(0, limitCount);
  const users = await Promise.all(picked.map((uid) => getUser(uid)));
  return users
    .filter((u): u is NonNullable<typeof u> => !!u)
    .map((u) => ({ uid: u.uid, displayName: u.displayName, handle: (u as any).handle ?? null, iconURL: (u as any).iconURL }));
}
