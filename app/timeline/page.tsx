"use client";
import React, { useEffect, useRef, useState } from "react";
import { useAuthUser } from "../../lib/hooks/useAuthUser";
import { TimelineItem } from "../../components/timeline/TimelineItem";
import { listLatestAlbumsVMLimited } from "@/src/services/timeline/listLatestAlbums";
import type { TimelineItemVM, UserRef } from "@/src/models/timeline";
import { getUser } from "../../lib/repos/userRepo";
import { subscribeComments } from "../../lib/repos/commentRepo";
import { toggleLike, subscribeLikes } from "../../lib/repos/likeRepo";
import { toggleReaction } from "../../lib/repos/reactionRepo";
import { addNotification } from "../../lib/repos/notificationRepo";
import { translateError } from "../../lib/errors";


export default function TimelinePage() {
  const { user } = useAuthUser();
  const [rows, setRows] = useState<TimelineItemVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PAGE_SIZE = 20;

  const rowsRef = useRef<TimelineItemVM[]>([]);
  const hasMoreRef = useRef(true);
  const inFlightRef = useRef(false);
  const unsubsRef = useRef<(() => void)[]>([]);
  const userCacheRef = useRef<Map<string, UserRef | null>>(new Map());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<() => void>(() => {});

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  function cleanupSubscriptions() {
    const list = unsubsRef.current;
    unsubsRef.current = [];
    for (const fn of list) {
      try { fn(); } catch {}
    }
  }

  async function subscribeForRow(row: TimelineItemVM, index: number, currentUid: string) {
    // comments: 最新コメントのみ更新
    const cUnsub = await subscribeComments(row.album.id, (list) => {
      const sorted = [...list]
        .sort((a, b) => (a.createdAt?.seconds || a.createdAt || 0) - (b.createdAt?.seconds || b.createdAt || 0));
      const latest = sorted.slice(-1)[0];
      const previewRawDesc = sorted.slice(-3).reverse();
      const userCache = userCacheRef.current;

      (async () => {
        const preview = await Promise.all(previewRawDesc.map(async (c) => {
          let cu = userCache.get(c.userId);
          if (cu === undefined) {
            const u = await getUser(c.userId);
            cu = u ? { uid: u.uid, handle: u.handle || null, iconURL: u.iconURL || null, displayName: u.displayName } : null;
            userCache.set(c.userId, cu);
          }
          return { body: c.body, userId: c.userId, user: cu || undefined, createdAt: c.createdAt };
        }));
        setRows(prev => {
          if (!prev[index]) return prev;
          const next = [...prev];
          next[index] = {
            ...next[index],
            latestComment: latest ? { body: latest.body, userId: latest.userId } : undefined,
            commentsPreview: preview,
            commentCount: list.length,
          } as any;
          return next;
        });
      })().catch(() => {
        setRows(prev => {
          if (!prev[index]) return prev;
          const next = [...prev];
          next[index] = {
            ...next[index],
            latestComment: latest ? { body: latest.body, userId: latest.userId } : undefined,
            commentsPreview: previewRawDesc.map(c => ({ body: c.body, userId: c.userId, createdAt: c.createdAt })),
            commentCount: list.length,
          } as any;
          return next;
        });
      });
    }, (err) => console.warn("comments subscribe error", err));
    unsubsRef.current.push(cUnsub);

    // likes: 件数と自分の liked を更新
    const lUnsub = await subscribeLikes(row.album.id, (list) => {
      const cnt = list.length;
      const meLiked = list.some(x => x.userId === currentUid);
      setRows(prev => {
        if (!prev[index]) return prev;
        const next = [...prev];
        next[index] = { ...next[index], likeCount: cnt, liked: meLiked };
        return next;
      });
    }, (err) => console.warn("likes subscribe error", err));
    unsubsRef.current.push(lUnsub);
  }

  async function loadMore() {
    const currentUid = user?.uid;
    if (!currentUid) return;
    if (inFlightRef.current) return;
    if (!hasMoreRef.current) return;

    inFlightRef.current = true;
    setError(null);

    const prev = rowsRef.current;
    const nextLimit = prev.length === 0 ? PAGE_SIZE : prev.length + PAGE_SIZE;
    if (prev.length === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const enriched = await listLatestAlbumsVMLimited(currentUid, nextLimit, userCacheRef.current);

      if (prev.length === 0) {
        setRows(enriched);
        // 初回は全件購読
        for (let i = 0; i < enriched.length; i++) {
          await subscribeForRow(enriched[i], i, currentUid);
        }
      } else {
        const existingIds = new Set(prev.map(r => r.album.id));
        const appended = enriched.filter(r => r?.album?.id && !existingIds.has(r.album.id));
        if (appended.length > 0) {
          const startIndex = prev.length;
          setRows(p => [...p, ...appended]);
          for (let j = 0; j < appended.length; j++) {
            await subscribeForRow(appended[j], startIndex + j, currentUid);
          }
        }
      }

      setHasMore(enriched.length > prev.length);
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setLoading(false);
      setLoadingMore(false);
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    cleanupSubscriptions();
    userCacheRef.current = new Map();
    setRows([]);
    setHasMore(true);
    setError(null);

    if (!user?.uid) {
      setLoading(false);
      return;
    }

    // 初回ロード
    loadMore().catch(() => {});

    return () => {
      cleanupSubscriptions();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid]);

  useEffect(() => {
    loadMoreRef.current = loadMore;
  });

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          loadMoreRef.current();
        }
      },
      { rootMargin: '400px' }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  async function handleToggleLike(albumId: string, index: number) {
    if (!user) return;
    setRows((prev) => {
      const next = [...prev];
      const row = next[index];
      if (!row) return prev;
      const likedPrev = row.liked;
      row.liked = !likedPrev;
      row.likeCount = likedPrev ? row.likeCount - 1 : row.likeCount + 1;
      return next;
    });
    try {
      // まずはサーバーの Route Handler 経由でトグル（失敗時は従来のリポジトリをフォールバック）
      const token = await user.getIdToken();
      const res = await fetch('/api/likes/toggle', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
        body: JSON.stringify({ albumId, userId: user.uid }),
      });
      if (!res.ok) {
        await toggleLike(albumId, user.uid);
      }
    } catch (e) {
      // rollback
      setRows((prev) => {
        const next = [...prev];
        const row = next[index];
        if (!row) return prev;
        row.liked = !row.liked;
        row.likeCount = row.liked ? row.likeCount + 1 : row.likeCount - 1;
        return next;
      });
    }
  }

  function handleToggleReaction(albumId: string, index: number, emoji: string) {
    if (!user) return;
    // 楽観更新
    setRows((prev) => {
      const next = [...prev];
      const row = next[index];
      if (!row) return prev;
      const list = row.reactions.slice();
      const idx = list.findIndex((x) => x.emoji === emoji);
      if (idx >= 0) {
        const item = { ...list[idx] };
        if (item.mine) { item.mine = false; item.count = Math.max(0, item.count - 1); }
        else { item.mine = true; item.count += 1; }
        list[idx] = item;
      } else {
        list.push({ emoji, count: 1, mine: true });
      }
      row.reactions = list;
      next[index] = { ...row };
      return next;
    });
    (async () => {
      try {
      const token = await user.getIdToken();
      const res = await fetch('/api/reactions/toggle', {
          method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
          body: JSON.stringify({ albumId, userId: user.uid, emoji }),
        });
        let added = false;
        if (res.ok) {
          const data = await res.json().catch(()=>({}));
          added = !!data?.added;
        } else {
          const result = await toggleReaction(albumId, user.uid, emoji);
          added = !!(result as any)?.added;
        }
        const row = rowsRef.current[index];
        if (added && row && row.album.ownerId !== user.uid) {
          addNotification({
            userId: row.album.ownerId,
            actorId: user.uid,
            type: 'reaction',
            albumId,
            message: 'アルバムにリアクション: ' + emoji,
          }).catch(()=>{});
        }
      } catch {
      // 失敗時ロールバック: 再取得のコストを避け簡易ロールバック
      setRows((prev) => {
        const next = [...prev];
        const row = next[index];
        if (!row) return prev;
        const list = row.reactions.slice();
        const idx = list.findIndex((x) => x.emoji === emoji);
        if (idx >= 0) {
          const item = { ...list[idx] };
          if (item.mine) { // 失敗=前操作無効なので反転
            item.mine = false; item.count = Math.max(0, item.count - 1);
          } else {
            item.mine = true; item.count += 1;
          }
          list[idx] = item;
        }
        row.reactions = list;
        next[index] = { ...row };
        return next;
      });
      }
    })();
  }

  async function handleSubmitComment(albumId: string, text: string) {
    if (!user) return;
    const { addComment } = await import("../../lib/repos/commentRepo");
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/comments/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
        body: JSON.stringify({ albumId, userId: user.uid, body: text }),
      });
      if (!res.ok) {
        await addComment(albumId, user.uid, text);
      }
    } catch {
      await addComment(albumId, user.uid, text);
    }
  }

  if (loading && rows.length === 0) return <div className="text-sm fg-subtle">読み込み中...</div>;
  if (error && rows.length === 0) return <div className="text-sm text-red-600">{error}</div>;

  return (
    <div className="max-w-2xl mx-auto p-4">
      <h1 className="text-xl font-semibold mb-4">タイムライン</h1>
  {rows.length === 0 && <p className="text-sm fg-subtle">対象アルバムがありません</p>}
      {rows.length > 0 && (
        <div className="divide-y divide-base *:pb-12">
          {rows.map((row, i) => (
            <TimelineItem
              key={row.album.id}
              album={row.album}
              images={row.images}
              likeCount={row.likeCount}
              liked={row.liked}
              onLike={() => handleToggleLike(row.album.id, i)}
              commentCount={row.commentCount}
              latestComment={row.latestComment}
              commentsPreview={row.commentsPreview}
              onCommentSubmit={user ? (text) => handleSubmitComment(row.album.id, text) : undefined}
              reactions={row.reactions}
              onToggleReaction={(emoji) => handleToggleReaction(row.album.id, i, emoji)}
              owner={row.owner ?? undefined}
            />
          ))}
        </div>
      )}

      {error && rows.length > 0 && (
        <div className="mt-4 text-sm text-red-600">{error}</div>
      )}
      {loadingMore && (
        <div className="mt-4 text-sm fg-subtle">読み込み中...</div>
      )}
      <div ref={sentinelRef} className="h-px" />
    </div>
  );
}