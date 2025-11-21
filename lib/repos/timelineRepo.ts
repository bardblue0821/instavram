import { db } from '../firebase';
import { COL } from '../paths';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import type { AlbumDoc } from '../../types/models';

// ownerIds が指定されない場合は最新アルバム全体（暫定）
// Firestore の where in は最大10件なので分割して結合
export async function fetchLatestAlbums(max: number = 50, ownerIds?: string[]): Promise<AlbumDoc[]> {
  if (!ownerIds || ownerIds.length === 0) {
    const q = query(collection(db, COL.albums), orderBy('createdAt', 'desc'), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as AlbumDoc);
  }

  const chunks: string[][] = [];
  for (let i = 0; i < ownerIds.length; i += 10) chunks.push(ownerIds.slice(i, i + 10));
  const results: AlbumDoc[] = [];
  await Promise.all(chunks.map(async (chunk) => {
    const q = query(collection(db, COL.albums), where('ownerId', 'in', chunk), orderBy('createdAt', 'desc'), limit(max));
    const snap = await getDocs(q);
    snap.forEach(d => results.push(d.data() as AlbumDoc));
  }));
  // 作成日時降順で全体を再ソートし最大 max に絞る
  results.sort((a, b) => (b.createdAt as any) - (a.createdAt as any));
  return results.slice(0, max);
}
