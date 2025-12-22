"use client";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "../../lib/hooks/useAuthUser";
import { TimelineItem } from "../../components/timeline/TimelineItem";
import { listLatestAlbumsVMLimited } from "@/src/services/timeline/listLatestAlbums";
import type { TimelineItemVM, UserRef } from "@/src/models/timeline";
import { getUser } from "../../lib/repos/userRepo";
import { subscribeComments } from "../../lib/repos/commentRepo";
import { toggleLike, subscribeLikes } from "../../lib/repos/likeRepo";
import { toggleReaction } from "../../lib/repos/reactionRepo";
import { addNotification } from "../../lib/repos/notificationRepo";
import { toggleRepost, subscribeReposts } from "../../lib/repos/repostRepo";
import { translateError } from "../../lib/errors";
import { notifications } from "@mantine/notifications";
import DeleteConfirmModal from "../../components/album/DeleteConfirmModal";
import ReportConfirmModal from "../../components/album/ReportConfirmModal";
import { deleteAlbum } from "../../lib/repos/albumRepo";
import { listAcceptedFriends } from "../../lib/repos/friendRepo";
import { listWatchedOwnerIds } from "../../lib/repos/watchRepo";


export default function TimelinePage() {
  const { user } = useAuthUser();
  const router = useRouter();
  const [rows, setRows] = useState<TimelineItemVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [deleteTargetAlbumId, setDeleteTargetAlbumId] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [reportTargetAlbumId, setReportTargetAlbumId] = useState<string | null>(null);
  const [reportBusy, setReportBusy] = useState(false);
  const [undoRepostTargetAlbumId, setUndoRepostTargetAlbumId] = useState<string | null>(null);
  const [undoRepostBusy, setUndoRepostBusy] = useState(false);

  const PAGE_SIZE = 20;

  const rowsRef = useRef<TimelineItemVM[]>([]);
  const hasMoreRef = useRef(true);
  const inFlightRef = useRef(false);
  const unsubsByAlbumIdRef = useRef<Map<string, (() => void)[]>>(new Map());
  const userCacheRef = useRef<Map<string, UserRef | null>>(new Map());
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreRef = useRef<() => void>(() => {});
  const [friendSet, setFriendSet] = useState<Set<string>>(new Set());
  const [watchSet, setWatchSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  function toMillis(v: any): number {
    if (!v) return 0;
    if (v instanceof Date) return v.getTime();
    if (typeof v?.toDate === 'function') return v.toDate().getTime();
    if (typeof v === 'object' && typeof v.seconds === 'number') return v.seconds * 1000;
    if (typeof v === 'number') return v > 1e12 ? v : v * 1000;
    return 0;
  }

  function resortTimeline() {
    setRows((prev) => {
      const sorted = prev.slice().sort((a, b) => {
        const ak = toMillis(a.repostedBy?.createdAt) || toMillis(a.album.createdAt) || 0;
        const bk = toMillis(b.repostedBy?.createdAt) || toMillis(b.album.createdAt) || 0;
        return bk - ak;
      });
      return sorted;
    });
  }

  useEffect(() => {
    hasMoreRef.current = hasMore;
  }, [hasMore]);

  function cleanupSubscriptions() {
    const map = unsubsByAlbumIdRef.current;
    for (const list of map.values()) {
      for (const fn of list) {
        try { fn(); } catch {}
      }
    }
    map.clear();
  }

  function cleanupSubscriptionForAlbum(albumId: string) {
    const map = unsubsByAlbumIdRef.current;
    const list = map.get(albumId);
    if (!list) return;
    for (const fn of list) {
      try { fn(); } catch {}
    }
    map.delete(albumId);
  }

  function updateRowByAlbumId(albumId: string, updater: (row: TimelineItemVM) => TimelineItemVM) {
    setRows((prev) => {
      const idx = prev.findIndex((r) => r.album.id === albumId);
      if (idx < 0) return prev;
      const next = [...prev];
      next[idx] = updater(next[idx]);
      return next;
    });
  }

  async function subscribeForRow(row: TimelineItemVM, currentUid: string) {
    const albumId = row.album.id;
    if (!albumId) return;

    // comments: 最新コメントのみ更新
    const cUnsub = await subscribeComments(albumId, (list) => {
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
        updateRowByAlbumId(albumId, (r) => ({
          ...r,
          latestComment: latest ? { body: latest.body, userId: latest.userId } : undefined,
          commentsPreview: preview,
          commentCount: list.length,
        } as any));
      })().catch(() => {
        updateRowByAlbumId(albumId, (r) => ({
          ...r,
          latestComment: latest ? { body: latest.body, userId: latest.userId } : undefined,
          commentsPreview: previewRawDesc.map(c => ({ body: c.body, userId: c.userId, createdAt: c.createdAt })),
          commentCount: list.length,
        } as any));
      });
    }, (err) => console.warn("comments subscribe error", err));
    {
      const map = unsubsByAlbumIdRef.current;
      const list = map.get(albumId) ?? [];
      list.push(cUnsub);
      map.set(albumId, list);
    }

    // likes: 件数と自分の liked を更新
    const lUnsub = await subscribeLikes(albumId, (list) => {
      const cnt = list.length;
      const meLiked = list.some(x => x.userId === currentUid);
      updateRowByAlbumId(albumId, (r) => ({ ...r, likeCount: cnt, liked: meLiked }));
    }, (err) => console.warn("likes subscribe error", err));
    {
      const map = unsubsByAlbumIdRef.current;
      const list = map.get(albumId) ?? [];
      list.push(lUnsub);
      map.set(albumId, list);
    }

    // reposts: 件数と自分の reposted を更新
    const rpUnsub = await subscribeReposts(albumId, (list) => {
      const cnt = list.length;
      const me = list.some(x => x.userId === currentUid);
      updateRowByAlbumId(albumId, (r) => ({ ...r, repostCount: cnt, reposted: me } as any));
    }, (err) => console.warn("reposts subscribe error", err));
    {
      const map = unsubsByAlbumIdRef.current;
      const list = map.get(albumId) ?? [];
      list.push(rpUnsub);
      map.set(albumId, list);
    }
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
          await subscribeForRow(enriched[i], currentUid);
        }
        // 初回にフレンド/ウォッチの関係をまとめて取得
        try {
          const [friends, watchedOwners] = await Promise.all([
            listAcceptedFriends(currentUid),
            listWatchedOwnerIds(currentUid),
          ]);
          const fset = new Set<string>();
          for (const fd of friends) {
            const otherId = fd.userId === currentUid ? fd.targetId : fd.userId;
            if (otherId) fset.add(otherId);
          }
          setFriendSet(fset);
          setWatchSet(new Set(watchedOwners || []));
        } catch {}
      } else {
        const existingIds = new Set(prev.map(r => r.album.id));
        const appended = enriched.filter(r => r?.album?.id && !existingIds.has(r.album.id));
        if (appended.length > 0) {
          setRows(p => [...p, ...appended]);
          for (let j = 0; j < appended.length; j++) {
            await subscribeForRow(appended[j], currentUid);
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

  async function handleToggleRepost(albumId: string) {
    if (!user) return;
    const row = rowsRef.current.find(r => r.album.id === albumId);
    const currentlyReposted = !!row?.reposted;

    // 取り消し時は確認モーダル
    if (currentlyReposted) {
      setUndoRepostTargetAlbumId(albumId);
      return;
    }

    // 楽観更新（追加）
    updateRowByAlbumId(albumId, (r) => ({
      ...r,
      reposted: true,
      repostCount: (r.repostCount || 0) + 1,
      // バナーも即時反映（ユーザー情報は省略可）
      repostedBy: { userId: user.uid, createdAt: new Date() },
    } as any));
    // 並び順も即時反映（最新リポスト優先）
    resortTimeline();

    // バナー内のユーザー情報（アイコン/表示名）を即時補完
    (async () => {
      try {
        let cu = userCacheRef.current.get(user.uid);
        if (cu === undefined) {
          const u = await getUser(user.uid);
          cu = u ? { uid: u.uid, handle: u.handle || null, iconURL: u.iconURL || null, displayName: u.displayName } : null;
          userCacheRef.current.set(user.uid, cu);
        }
        const fallbackIcon = (user as any).photoURL || undefined;
        const enriched = cu || { uid: user.uid, handle: null, iconURL: (fallbackIcon || null) as any, displayName: user.displayName || undefined };
        updateRowByAlbumId(albumId, (r) => ({
          ...r,
          repostedBy: { ...(r.repostedBy as any), user: enriched },
        } as any));
      } catch { /* noop */ }
    })();
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/reposts/toggle', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
        body: JSON.stringify({ albumId, userId: user.uid }),
      });
      if (!res.ok) {
        await toggleRepost(albumId, user.uid);
      }
    } catch {
      // rollback
      updateRowByAlbumId(albumId, (r) => ({ ...r, reposted: false, repostCount: Math.max(0, (r.repostCount || 0) - 1) } as any));
      resortTimeline();
    }
  }

  async function handleConfirmUndoRepost() {
    const albumId = undoRepostTargetAlbumId;
    if (!albumId) return;
    if (!user) return;
    setUndoRepostBusy(true);
    // 楽観反転（取り消し）
    updateRowByAlbumId(albumId, (r) => ({
      ...r,
      reposted: false,
      repostCount: Math.max(0, (r.repostCount || 0) - 1),
      repostedBy: (r.repostedBy && (r.repostedBy as any).userId === user.uid) ? undefined : r.repostedBy,
    } as any));
    resortTimeline();
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/reposts/toggle', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
        body: JSON.stringify({ albumId, userId: user.uid }),
      });
      if (!res.ok) {
        await toggleRepost(albumId, user.uid);
      }
      setUndoRepostTargetAlbumId(null);
    } catch {
      // rollback（戻して閉じる）
      updateRowByAlbumId(albumId, (r) => ({ ...r, reposted: true, repostCount: (r.repostCount || 0) + 1 } as any));
      resortTimeline();
      setUndoRepostTargetAlbumId(null);
    } finally {
      setUndoRepostBusy(false);
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

  async function handleToggleLike(albumId: string) {
    if (!user) return;
    updateRowByAlbumId(albumId, (row) => {
      const likedPrev = row.liked;
      return { ...row, liked: !likedPrev, likeCount: likedPrev ? row.likeCount - 1 : row.likeCount + 1 };
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
      updateRowByAlbumId(albumId, (row) => {
        const likedNow = !row.liked;
        // 直前の反転を戻す
        return { ...row, liked: likedNow, likeCount: likedNow ? row.likeCount + 1 : row.likeCount - 1 };
      });
    }
  }

  function handleToggleReaction(albumId: string, emoji: string) {
    if (!user) return;
    // 楽観更新
    updateRowByAlbumId(albumId, (row) => {
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
      return { ...row, reactions: list };
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
        const row = rowsRef.current.find((r) => r.album.id === albumId);
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
      updateRowByAlbumId(albumId, (row) => {
        const list = row.reactions.slice();
        const idx = list.findIndex((x) => x.emoji === emoji);
        if (idx >= 0) {
          const item = { ...list[idx] };
          if (item.mine) {
            item.mine = false;
            item.count = Math.max(0, item.count - 1);
          } else {
            item.mine = true;
            item.count += 1;
          }
          list[idx] = item;
        }
        return { ...row, reactions: list };
      });
      }
    })();
  }

  async function handleConfirmDelete() {
    const albumId = deleteTargetAlbumId;
    if (!albumId) return;
    if (!user?.uid) return;
    setDeleteBusy(true);
    try {
      await deleteAlbum(albumId);
      cleanupSubscriptionForAlbum(albumId);
      setRows((prev) => prev.filter((r) => r.album.id !== albumId));
      setDeleteTargetAlbumId(null);
      router.push('/timeline');
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setDeleteBusy(false);
    }
  }

  async function handleConfirmReport() {
    const albumId = reportTargetAlbumId;
    if (!albumId) return;
    if (!user) return;
    setReportBusy(true);
    try {
      const token = await user.getIdToken();
      const albumUrl = `${window.location.origin}/album/${encodeURIComponent(albumId)}`;
      const res = await fetch('/api/reports/album', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
        body: JSON.stringify({ albumId, albumUrl }),
      });
      if (!res.ok) {
        const json = await res.json().catch(() => ({} as any));
        const err = (json as any)?.error || 'REPORT_FAILED';
        const hint = (json as any)?.hint as string | undefined;
        const missingEnv = (json as any)?.missingEnv as string | undefined;

        let msg = err;
        if (typeof err === 'string' && err.startsWith('MISSING_ENV:')) {
          msg = `通報メール送信の設定が未完了です（${missingEnv || err.slice('MISSING_ENV:'.length)}）`;
        }
        if (hint) msg = `${msg} / ${hint}`;
        throw new Error(msg);
      }
      setReportTargetAlbumId(null);
    } catch (e: any) {
      const msg = translateError(e);
      setError(msg);
      notifications.show({ color: 'red', message: msg });
    } finally {
      setReportBusy(false);
    }
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

  if (loading && rows.length === 0) return <div className="text-sm text-muted/80">読み込み中...</div>;
  if (error && rows.length === 0) return <div className="text-sm text-red-600">{error}</div>;

  return (
    <div className="max-w-2xl mx-auto p-4">
    <h1 className="text-xl font-semibold mb-4">タイムライン</h1>
  {rows.length === 0 && <p className="text-sm text-muted/80">対象アルバムがありません</p>}
      {rows.length > 0 && (
  <div className="divide-y divide-line *:pb-12">
          {rows.map((row, i) => (
            <TimelineItem
              key={row.album.id}
              album={row.album}
              images={row.images}
              likeCount={row.likeCount}
              liked={row.liked}
              onLike={() => handleToggleLike(row.album.id)}
              repostCount={row.repostCount}
              reposted={row.reposted}
              onToggleRepost={() => handleToggleRepost(row.album.id)}
              currentUserId={user?.uid || undefined}
              onRequestDelete={(albumId) => setDeleteTargetAlbumId(albumId)}
              onRequestReport={(albumId) => setReportTargetAlbumId(albumId)}
              commentCount={row.commentCount}
              latestComment={row.latestComment}
              commentsPreview={row.commentsPreview}
              onCommentSubmit={user ? (text) => handleSubmitComment(row.album.id, text) : undefined}
              reactions={row.reactions}
              onToggleReaction={(emoji) => handleToggleReaction(row.album.id, emoji)}
              owner={row.owner ?? undefined}
              imageAdded={row.imageAdded}
              repostedBy={row.repostedBy}
              isFriend={!!(row.owner?.uid && friendSet.has(row.owner.uid))}
              isWatched={!!(row.owner?.uid && watchSet.has(row.owner.uid))}
            />
          ))}
        </div>
      )}

      {error && rows.length > 0 && (
        <div className="mt-4 text-sm text-red-600">{error}</div>
      )}
      {loadingMore && (
        <div className="mt-4 text-sm text-muted/80">読み込み中...</div>
      )}
      <div ref={sentinelRef} className="h-px" />

      <DeleteConfirmModal
        open={!!deleteTargetAlbumId}
        busy={deleteBusy}
        onCancel={() => { if (!deleteBusy) setDeleteTargetAlbumId(null); }}
        onConfirm={() => { if (!deleteBusy) handleConfirmDelete(); }}
      />
      <ReportConfirmModal
        open={!!reportTargetAlbumId}
        busy={reportBusy}
        onCancel={() => { if (!reportBusy) setReportTargetAlbumId(null); }}
        onConfirm={() => { if (!reportBusy) handleConfirmReport(); }}
      />
      {/* リポスト取り消し確認モーダル */}
      {undoRepostTargetAlbumId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-80 rounded bg-background border border-line p-4 shadow-lg">
            <h3 className="text-sm font-semibold">リポストを取り消しますか？</h3>
            <p className="mt-2 text-xs text-muted/80">この操作はいつでもやり直せます。</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded bg-surface-weak border border-line px-3 py-1 text-xs"
                onClick={() => { if (!undoRepostBusy) setUndoRepostTargetAlbumId(null); }}
                disabled={undoRepostBusy}
              >キャンセル</button>
              <button
                type="button"
                className="rounded bg-emerald-600 px-3 py-1 text-xs text-white disabled:opacity-50"
                onClick={() => { if (!undoRepostBusy) handleConfirmUndoRepost(); }}
                disabled={undoRepostBusy}
              >{undoRepostBusy ? "処理中..." : "取り消す"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}