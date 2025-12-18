"use client";
import React, { useEffect, useState } from "react";
import { useAuthUser } from "../../lib/hooks/useAuthUser";
import { TimelineItem } from "../../components/timeline/TimelineItem";
import { getLatestAlbums } from "../../lib/repos/albumRepo";
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
  const [rows, setRows] = useState<Array<{
    album: AlbumRow;
    images: { url: string; thumbUrl?: string; uploaderId?: string }[];
    likeCount: number;
    liked: boolean;
    latestComment?: { body: string; userId: string };
    reactions: { emoji: string; count: number; mine: boolean }[];
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const albums = await getLatestAlbums(50);
        const enriched = await Promise.all(
          albums.map(async (album: any) => {
            const [imgs, cmts, likeCnt, likedFlag, reactions] = await Promise.all([
              listImages(album.id),
              listComments(album.id),
              countLikes(album.id),
              user ? hasLiked(album.id, user.uid) : Promise.resolve(false),
              listReactionsByAlbum(album.id, user?.uid),
            ]);
            const latest = [...cmts]
              .sort((a, b) => (a.createdAt?.seconds || a.createdAt || 0) - (b.createdAt?.seconds || b.createdAt || 0))
              .slice(-1)[0];
            const imgRows = (imgs || [])
              .map((x: any) => ({
                url: x.url || x.downloadUrl || "",
                thumbUrl: x.thumbUrl || x.url || x.downloadUrl || "",
                uploaderId: x.uploaderId,
              }))
              .filter((x: any) => x.url);
            return {
              album,
              images: imgRows,
              likeCount: likeCnt,
              liked: likedFlag,
              latestComment: latest ? { body: latest.body, userId: latest.userId } : undefined,
                reactions,
            };
          })
        );
        if (!cancelled) setRows(enriched);
        // コメント/いいねのリアルタイム購読をセット
        if (!cancelled) {
          const localUnsubs: (() => void)[] = [];
          for (let i = 0; i < enriched.length; i++) {
            const row = enriched[i];
            // comments: 最新コメントのみ更新
            const cUnsub = await subscribeComments(row.album.id, (list) => {
              const latest = [...list]
                .sort((a, b) => (a.createdAt?.seconds || a.createdAt || 0) - (b.createdAt?.seconds || b.createdAt || 0))
                .slice(-1)[0];
              setRows(prev => {
                const next = [...prev];
                if (!next[i]) return prev;
                next[i] = { ...next[i], latestComment: latest ? { body: latest.body, userId: latest.userId } : undefined };
                return next;
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
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold">タイムライン</h1>
      {rows.length === 0 && <p className="text-sm text-gray-500">対象アルバムがありません</p>}
      {rows.map((row, i) => (
        <TimelineItem
          key={row.album.id}
          album={row.album}
          images={row.images}
          likeCount={row.likeCount}
          liked={row.liked}
          onLike={() => handleToggleLike(row.album.id, i)}
          latestComment={row.latestComment}
          onCommentSubmit={user ? (text) => handleSubmitComment(row.album.id, text) : undefined}
          reactions={row.reactions}
          onToggleReaction={(emoji) => handleToggleReaction(row.album.id, i, emoji)}
        />
      ))}
    </div>
  );
}