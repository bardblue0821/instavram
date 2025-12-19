import { db } from "../firebase";
import { COL } from "../paths";
import { collection, doc, getDoc, getDocs, limit, orderBy, query, startAt, endAt, where } from "firebase/firestore";

function prefixQuery(col: string, field: string, q: string, take = 20) {
  return query(
    collection(db, col),
    orderBy(field),
    startAt(q),
    endAt(q + "\uf8ff"),
    limit(take)
  );
}

export type UserHit = { uid: string; displayName?: string; handle?: string; iconURL?: string };
export type AlbumHit = { id: string; title?: string; description?: string };

export async function searchUsersPrefix(qRaw: string, take = 20): Promise<UserHit[]> {
  const q = qRaw.trim().toLowerCase();
  if (!q) return [];
  const hits: Record<string, UserHit> = {};
  // handle 優先
  try {
    const snap = await getDocs(prefixQuery(COL.users, "handle", q, take));
    snap.forEach((d) => {
      const v: any = d.data();
      hits[v.handle || v.uid || d.id] = { uid: v.uid || d.id, displayName: v.displayName, handle: v.handle, iconURL: v.iconURL };
    });
  } catch {}
  // displayName 補完
  try {
    const snap = await getDocs(prefixQuery(COL.users, "displayName", q, take));
    snap.forEach((d) => {
      const v: any = d.data();
      const key = v.handle || v.uid || d.id;
      if (!hits[key]) hits[key] = { uid: v.uid || d.id, displayName: v.displayName, handle: v.handle, iconURL: v.iconURL };
    });
  } catch {}
  return Object.values(hits).slice(0, take);
}

export async function searchAlbumsPrefix(qRaw: string, take = 20): Promise<AlbumHit[]> {
  const q = qRaw.trim().toLowerCase();
  if (!q) return [];
  const byId: Record<string, AlbumHit> = {};
  // title
  try {
    const snap = await getDocs(prefixQuery(COL.albums, "title", q, take));
    snap.forEach((d) => {
      const v: any = d.data();
      byId[d.id] = { id: d.id, title: v.title, description: v.description };
    });
  } catch {}
  // description
  try {
    const snap = await getDocs(prefixQuery(COL.albums, "description", q, take));
    snap.forEach((d) => {
      const v: any = d.data();
      if (!byId[d.id]) byId[d.id] = { id: d.id, title: v.title, description: v.description };
    });
  } catch {}
  return Object.values(byId).slice(0, take);
}

export async function searchAlbumsByCommentPrefix(qRaw: string, takeComments = 20): Promise<AlbumHit[]> {
  const q = qRaw.trim().toLowerCase();
  if (!q) return [];
  const albumIds = new Set<string>();
  try {
    const snap = await getDocs(prefixQuery(COL.comments, "body", q, takeComments));
    snap.forEach((d) => {
      const v: any = d.data();
      if (v.albumId) albumIds.add(v.albumId);
    });
  } catch {}
  const results: AlbumHit[] = [];
  // まとめて取得（個別 getDoc。将来 batched 改善可）
  await Promise.all(
    Array.from(albumIds).map(async (id) => {
      try {
        const ref = doc(db, COL.albums, id);
        const s = await getDoc(ref);
        if (s.exists()) {
          const v: any = s.data();
          results.push({ id, title: v.title, description: v.description });
        }
      } catch {}
    })
  );
  return results;
}
