"use client";
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuthUser } from '../../lib/hooks/useAuthUser';
import { getLatestAlbums } from '../../lib/repos/albumRepo';
import { listAcceptedFriends } from '../../lib/repos/friendRepo';
import { listWatchedOwnerIds } from '../../lib/repos/watchRepo';
import { translateError } from '../../lib/errors';
import { collection, query, where, limit } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { COL } from '../../lib/paths';

interface TimelineAlbum {
  id: string;
  ownerId: string;
  title: string | null;
  createdAt: any;
  firstImageUrl?: string;
}

export default function TimelinePage() {
  const { user } = useAuthUser();
  const [albums, setAlbums] = useState<TimelineAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        // 1. 最新アルバム取得
  const raw: any[] = await getLatestAlbums(50);
        // 2. フィルタ対象 ownerId セット作成
        let allowed: Set<string> | null = null;
        if (user) {
          try {
            const friends = await listAcceptedFriends(user.uid);
            const watched = await listWatchedOwnerIds(user.uid);
            allowed = new Set<string>();
            allowed.add(user.uid);
            friends.forEach(f => {
              // friendDoc は userId->targetId/逆方向の両面 accepted を含む
              if (f.userId === user.uid) allowed!.add(f.targetId);
              if (f.targetId === user.uid) allowed!.add(f.userId);
            });
            watched.forEach(o => allowed!.add(o));
          } catch (e:any) {
            // friends / watches 取得失敗時は allowed=null として全件表示
            console.warn('friend/watch fetch failed, fallback to all', e);
            allowed = null;
          }
        }
  const filtered = allowed ? raw.filter(a => allowed!.has((a as any).ownerId)) : raw;

        // 3. 先頭画像を取得 (各 album ごとに 1件) 並列
        const enriched: TimelineAlbum[] = await Promise.all(filtered.map(async (a:any) => {
          let firstImageUrl: string | undefined;
          try {
            const q = query(collection(db, COL.albumImages), where('albumId', '==', a.id), limit(1));
            const { getDocs } = await import('firebase/firestore');
            const snap = await getDocs(q);
            snap.forEach(d => { const data = d.data() as any; if (data.url) firstImageUrl = data.url; });
          } catch (e) {
            // 失敗時はプレースホルダー利用
            firstImageUrl = undefined;
          }
          return {
            id: a.id,
            ownerId: a.ownerId,
            title: a.title ?? null,
            createdAt: a.createdAt,
            firstImageUrl,
          };
        }));
        if (active) setAlbums(enriched);
      } catch (e:any) {
        if (active) setError(translateError(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user, retryKey]);

  function retry() { setRetryKey(k => k + 1); }

  return (
    <div className="max-w-3xl mx-auto p-4 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold">タイムライン</h1>
        <p className="text-sm text-gray-600">最新アルバムを統合表示（フレンド/ウォッチ/自分）。</p>
        {!user && <p className="text-xs text-gray-500">ログインすると絞り込みが有効になります。</p>}
      </header>
      {loading && (
        <div className="text-sm text-gray-500">読み込み中...</div>
      )}
      {error && (
        <div className="space-y-2">
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={retry} className="text-xs px-2 py-1 rounded bg-red-600 text-white">再試行</button>
        </div>
      )}
      {!loading && !error && albums.length === 0 && (
        <p className="text-sm text-gray-700">対象アルバムがありません。</p>
      )}
      <ul className="grid gap-4 sm:grid-cols-2">
        {albums.map(a => (
          <li key={a.id} className="border rounded shadow-sm overflow-hidden bg-white dark:bg-gray-900">
            <Link href={`/album/${a.id}`} aria-label={`アルバム: ${a.title || '無題'}`} className="block group">
              <div className="aspect-video w-full bg-gray-100 flex items-center justify-center overflow-hidden">
                {a.firstImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.firstImageUrl} alt="thumbnail" className="w-full h-full object-cover group-hover:opacity-90 transition" />
                ) : (
                  <span className="text-xs text-gray-400">No Image</span>
                )}
              </div>
              <div className="p-3 space-y-1">
                <h2 className="text-sm font-medium truncate">{a.title || '無題'}</h2>
                <p className="text-[11px] text-gray-500">owner: {a.ownerId}</p>
                {a.createdAt && (
                  <p className="text-[11px] text-gray-400">{formatDate(a.createdAt)}</p>
                )}
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatDate(v: any) {
  try {
    if (!v) return '';
    // Firestore Timestamp なら toDate()
    if (typeof v.toDate === 'function') v = v.toDate();
    const d = v instanceof Date ? v : new Date(v);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
}
function pad(n: number) { return n < 10 ? '0'+n : ''+n; }