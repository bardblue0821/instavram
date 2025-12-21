import { db } from '../firebase';
import { COL } from '../paths';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import type { AlbumDoc } from '../../types/models';

// ownerIds が指定されない場合は最新アルバム全体（暫定）
// NOTE: ownerIds 絞り込みは "in + orderBy" の複合インデックス問題を避けるため、
// 各 ownerId ごとに最新を取得してマージする（ウォッチした相手の投稿が落ちないようにする）。
export async function fetchLatestAlbums(max: number = 50, ownerIds?: string[]): Promise<AlbumDoc[]> {
  if (!ownerIds || ownerIds.length === 0) {
    const q = query(collection(db, COL.albums), orderBy('createdAt', 'desc'), limit(max));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...(d.data() as any) } as AlbumDoc));
  }

  function toMillis(v: any): number {
    if (!v) return 0;
    if (v instanceof Date) return v.getTime();
    if (typeof v?.toDate === 'function') return v.toDate().getTime();
    if (typeof v === 'object' && typeof v.seconds === 'number') return v.seconds * 1000;
    if (typeof v === 'number') return v > 1e12 ? v : v * 1000;
    return 0;
  }

  const perOwnerLimit = Math.max(1, Math.min(10, max));
  const results: AlbumDoc[] = [];

  await Promise.all(
    ownerIds.map(async (ownerId) => {
      try {
        // 正攻法: ownerId== + createdAt orderBy（複合インデックスが必要な場合あり）
        const q = query(
          collection(db, COL.albums),
          where('ownerId', '==', ownerId),
          orderBy('createdAt', 'desc'),
          limit(perOwnerLimit),
        );
        const snap = await getDocs(q);
        snap.forEach((d) => {
          results.push({ id: d.id, ...(d.data() as any) } as AlbumDoc);
        });
      } catch (e: any) {
        // インデックス不足などで FAILED_PRECONDITION が出る場合はフォールバック
        const msg = String(e?.message || e || '');
        const isIndex = msg.includes('FAILED_PRECONDITION') || msg.toLowerCase().includes('index');
        if (!isIndex) throw e;

        const q2 = query(
          collection(db, COL.albums),
          where('ownerId', '==', ownerId),
        );
        const snap2 = await getDocs(q2);
        const rows = snap2.docs
          .map((d) => ({ id: d.id, ...(d.data() as any) } as AlbumDoc))
          .sort((a, b) => toMillis((b as any).createdAt) - toMillis((a as any).createdAt))
          .slice(0, perOwnerLimit);
        results.push(...rows);
      }
    })
  );

  // createdAt 降順で全体をソートし最大 max に絞る
  results.sort((a, b) => toMillis((b as any).createdAt) - toMillis((a as any).createdAt));
  const seen = new Set<string>();
  const deduped: AlbumDoc[] = [];
  for (const a of results) {
    if (!a?.id) continue;
    if (seen.has(a.id)) continue;
    seen.add(a.id);
    deduped.push(a);
    if (deduped.length >= max) break;
  }
  return deduped;
}
