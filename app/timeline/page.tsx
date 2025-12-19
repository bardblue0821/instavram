"use client";
import React, { useEffect, useState } from "react";
import { useAuthUser } from "../../lib/hooks/useAuthUser";
import { TimelineItem } from "../../components/timeline/TimelineItem";
// フィードはフレンド/ウォッチ対象のみ
import { fetchLatestAlbums } from "../../lib/repos/timelineRepo"; 
import { listAcceptedFriends } from "../../lib/repos/friendRepo"; 
import { listWatchedOwnerIds } from "../../lib/repos/watchRepo"; 
import { listLatestAlbumsVM } from "@/src/services/timeline/listLatestAlbums"; 
import type { TimelineItemVM, UserRef } from "@/src/models/timeline"; 
import { getUser, type UserDoc } from "../../lib/repos/userRepo";
import { listImages } from "../../lib/repos/imageRepo";
import { listComments, subscribeComments } from "../../lib/repos/commentRepo";
import { countLikes, hasLiked, toggleLike, subscribeLikes } from "../../lib/repos/likeRepo";
import { listReactionsByAlbum, toggleReaction } from "../../lib/repos/reactionRepo";
import { addNotification } from "../../lib/repos/notificationRepo";
import { translateError } from "../../lib/errors";

type AlbumRow = { id: string; ownerId: string; title?: string | null; createdAt?: any };

export default function TimelinePage() {
  const { user } = useAuthUser();
  const [unsubs, setUnsubs] = useState<(() => void)[]>([]);
  const [rows, setRows] = useState<TimelineItemVM[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        // 未ログイン時はタイムラインを表示しない（要件: フレンド/ウォッチのみ）
        if (!user?.uid) {
          if (!cancelled) {
            setRows([]);
            setLoading(false);
          }
          return;
        }
        // 対象オーナーIDsを構築（自分 + フレンド + ウォッチ）
        const ownerSet = new Set<string>();
        ownerSet.add(user.uid);
        try {
          const [friends, watched] = await Promise.all([
            listAcceptedFriends(user.uid),
            listWatchedOwnerIds(user.uid),
          ]);
          // フレンド方向に依存せず相手UIDを追加
          for (const f of friends) {
            const other = f.userId === user.uid ? f.targetId : f.userId;
            if (other) ownerSet.add(other);
          }
          for (const w of watched) ownerSet.add(w);
        } catch (e) {
          // フレンド/ウォッチ取得失敗時は対象なし（後で全表示に緩和したければここを変更）
          console.warn("friend/watch fetch error", e);
        }

        const ownerIds = Array.from(ownerSet);
        const userCache = new Map<string, UserRef | null>();
        const enriched = await listLatestAlbumsVM(user.uid, userCache);
        if (!cancelled) setRows(enriched);
        // コメント/いいねのリアルタイム購読をセット
        if (!cancelled) {
          const localUnsubs: (() => void)[] = [];
          for (let i = 0; i < enriched.length; i++) {
            const row = enriched[i];
            // comments: 最新コメントのみ更新
            const cUnsub = await subscribeComments(row.album.id, (list) => {
              const sorted = [...list]
                .sort((a, b) => (a.createdAt?.seconds || a.createdAt || 0) - (b.createdAt?.seconds || b.createdAt || 0));
              const latest = sorted.slice(-1)[0];
              // 最新が上に来るように表示順を降順に
              const previewRawDesc = sorted.slice(-3).reverse();
              // ユーザー情報を補完（必要に応じて非同期で更新）
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
                  const next = [...prev];
                  if (!next[i]) return prev;
                  next[i] = { ...next[i], latestComment: latest ? { body: latest.body, userId: latest.userId } : undefined, commentsPreview: preview };
                  return next;
                });
              })().catch(()=>{
                // ユーザー取得失敗時は最低限の本文のみ更新
                setRows(prev => {
                  const next = [...prev];
                  if (!next[i]) return prev;
                  next[i] = { ...next[i], latestComment: latest ? { body: latest.body, userId: latest.userId } : undefined, commentsPreview: previewRawDesc.map(c => ({ body: c.body, userId: c.userId, createdAt: c.createdAt })) } as any;
                  return next;
                });
              });
            }, (err) => console.warn("comments subscribe error", err));
            localUnsubs.push(cUnsub);

            // likes: 件数と自分の liked を更新
            const lUnsub = await subscribeLikes(row.album.id, (list) => {
              const cnt = list.length;
              const meLiked = !!(user && list.some(x => x.userId === user.uid));
              setRows(prev => {
                const next = [...prev];
                if (!next[i]) return prev;
                next[i] = { ...next[i], likeCount: cnt, liked: meLiked };
                return next;
              });
            }, (err) => console.warn("likes subscribe error", err));
            localUnsubs.push(lUnsub);
          }
          setUnsubs(prev => {
            // 既存購読を解放してから置き換え
            prev.forEach(fn => { try { fn(); } catch {} });
            return localUnsubs;
          });
        }
      } catch (e: any) {
        if (!cancelled) setError(translateError(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.uid]);

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
      await toggleLike(albumId, user.uid);
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
    toggleReaction(albumId, user.uid, emoji).then(result => {
      const row = rows[index];
      if (result.added && row && row.album.ownerId !== user.uid) {
        addNotification({
          userId: row.album.ownerId,
          actorId: user.uid,
          type: 'reaction',
          albumId,
          message: 'アルバムにリアクション: ' + emoji,
        }).catch(()=>{});
      }
    }).catch(() => {
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
    });
  }

  async function handleSubmitComment(albumId: string, text: string) {
    if (!user) return;
    const { addComment } = await import("../../lib/repos/commentRepo");
    await addComment(albumId, user.uid, text);
  }

  if (loading) return <div className="text-sm text-gray-500">読み込み中...</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-xl font-semibold mb-4">タイムライン</h1>
      {rows.length === 0 && <p className="text-sm text-gray-500">対象アルバムがありません</p>}
      {rows.length > 0 && (
        <div className="divide-y divide-base">
          {rows.map((row, i) => (
            <TimelineItem
              key={row.album.id}
              album={row.album}
              images={row.images}
              likeCount={row.likeCount}
              liked={row.liked}
              onLike={() => handleToggleLike(row.album.id, i)}
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
    </div>
  );
}