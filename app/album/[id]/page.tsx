"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthUser } from "../../../lib/hooks/useAuthUser";
import {
  addImage,
  listImages,
  deleteImage,
  canUploadMoreImages,
} from "../../../lib/repos/imageRepo";
import {
  addComment,
  updateComment,
  deleteComment,
} from "../../../lib/repos/commentRepo";
import { updateAlbum, getAlbumSafe, deleteAlbum } from "../../../lib/repos/albumRepo";
import { getUser } from "../../../lib/repos/userRepo";
import {
  toggleLike,
  hasLiked,
  countLikes,
} from "../../../lib/repos/likeRepo";
import { translateError } from "../../../lib/errors";
import { CommentList } from "../../../components/comments/CommentList";
import { listComments, subscribeComments } from "../../../lib/repos/commentRepo";
import { CommentForm } from "../../../components/comments/CommentForm";
import { ERR } from "../../../types/models";
import { listReactionsByAlbum, toggleReaction, listReactorsByAlbumEmoji, Reactor } from "../../../lib/repos/reactionRepo";
import { addNotification } from "../../../lib/repos/notificationRepo";
import { REACTION_EMOJIS, REACTION_CATEGORIES, filterReactionEmojis } from "../../../lib/constants/reactions";

type CommentRecord = {
  id: string;
  body: string;
  userId: string;
  createdAt?: any;
  [key: string]: any;
};

type AlbumRecord = {
  id: string;
  ownerId: string;
  title?: string;
  placeUrl?: string;
  [key: string]: any;
};

export default function AlbumDetailPage() {
  const params = useParams();
  const albumId = params?.id as string | undefined;
  const { user } = useAuthUser();
  const router = useRouter();

  const [album, setAlbum] = useState<AlbumRecord | null>(null);
  const [images, setImages] = useState<any[]>([]);
  const [comments, setComments] = useState<CommentRecord[]>([]);
  const [editTitle, setEditTitle] = useState("");
  const [editPlaceUrl, setEditPlaceUrl] = useState("");
  const [savingAlbum, setSavingAlbum] = useState(false);
  const [albumSavedMsg, setAlbumSavedMsg] = useState("");
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [commenting, setCommenting] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [liked, setLiked] = useState(false);
  const [likeBusy, setLikeBusy] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reactions, setReactions] = useState<{ emoji: string; count: number; mine: boolean }[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState("");
  const [activeCat, setActiveCat] = useState(REACTION_CATEGORIES[0]?.key || 'faces');
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const pickerBtnRef = useRef<HTMLButtonElement | null>(null);
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  const [reactorMap, setReactorMap] = useState<Record<string, Reactor[] | undefined>>({});
  const [reactorLoading, setReactorLoading] = useState<Record<string, boolean>>({});
  const filteredEmojis = useMemo(() => filterReactionEmojis(emojiQuery), [emojiQuery]);
  const categoryEmojis = useMemo(() => {
    const cat = REACTION_CATEGORIES.find(c => c.key === activeCat);
    return cat ? cat.emojis : [];
  }, [activeCat]);

  useEffect(() => {
    if (!albumId) return;

    let cancelled = false;
    let unsubComments: (() => void) | undefined;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const albumSnap = await getAlbumSafe(albumId);
        if (!albumSnap) {
          if (!cancelled) {
            setAlbum(null);
            setImages([]);
            setComments([]);
            setError("アルバムが見つかりません");
          }
          return;
        }
        const albumData = albumSnap as AlbumRecord;
        if (cancelled) return;
        setAlbum(albumData);
        setEditTitle(albumData.title ?? "");
        setEditPlaceUrl(albumData.placeUrl ?? "");

        const imgs = await listImages(albumId);
        if (!cancelled) {
          imgs.sort(
            (a: any, b: any) =>
              (b.createdAt?.seconds || b.createdAt || 0) -
              (a.createdAt?.seconds || a.createdAt || 0),
          );
          setImages(imgs);
        }
        const initialComments = await listComments(albumId);
        if (!cancelled) {
          const list = [...initialComments].sort(
            (a, b) =>
              (a.createdAt?.seconds || a.createdAt || 0) -
              (b.createdAt?.seconds || b.createdAt || 0),
          );
          setComments(list as CommentRecord[]);
        }

        unsubComments = await subscribeComments(
          albumId,
          (snapshotList) => {
            if (cancelled) return;
            const list = [...snapshotList].sort(
              (a, b) =>
                (a.createdAt?.seconds || a.createdAt || 0) -
                (b.createdAt?.seconds || b.createdAt || 0),
            );
            setComments(list as CommentRecord[]);
          },
          (err) => console.warn("comments subscribe error", err),
        );
        // リアクション取得
        const r = await listReactionsByAlbum(albumId, user?.uid);
        if (!cancelled) setReactions(r);
      } catch (e: any) {
        if (!cancelled) {
          setError(translateError(e));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (unsubComments) unsubComments();
    };
  }, [albumId]);

  useEffect(() => {
    if (!albumId) return;

    let cancelled = false;
    let unsubLikes: (() => void) | undefined;

    if (!user) {
      setLiked(false);
      setLikeCount(0);
      return () => {
        cancelled = true;
        if (unsubLikes) unsubLikes();
      };
    }

    (async () => {
      try {
        const [likedFlag, cnt] = await Promise.all([
          hasLiked(albumId, user.uid),
          countLikes(albumId),
        ]);
        if (!cancelled) {
          setLiked(likedFlag);
          setLikeCount(cnt);
        }
      } catch (e: any) {
        if (!cancelled) setError(translateError(e));
      }
    })();

    return () => {
      cancelled = true;
      if (unsubLikes) unsubLikes();
    };
  }, [albumId, user?.uid]);

  async function handleAddImage() {
    if (!user || !albumId || !file) return;
    setUploading(true);
    setError(null);
    try {
      const allowMore = await canUploadMoreImages(albumId, user.uid);
      if (!allowMore) {
        setError(translateError(ERR.LIMIT_4_PER_USER));
        return;
      }
      const url = await fileToDataUrl(file);
      await addImage(albumId, user.uid, url);
      const imgs = await listImages(albumId);
      imgs.sort(
        (a: any, b: any) =>
          (b.createdAt?.seconds || b.createdAt || 0) -
          (a.createdAt?.seconds || a.createdAt || 0),
      );
      setImages(imgs);
      setFile(null);
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setUploading(false);
    }
  }

  // ピッカー外クリック/ESCで閉じる
  useEffect(() => {
    if (!pickerOpen) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (pickerRef.current && !pickerRef.current.contains(t) && pickerBtnRef.current && !pickerBtnRef.current.contains(t)) {
        setPickerOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setPickerOpen(false); }
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  // 開くたびに検索語をクリア
  useEffect(() => { if (pickerOpen) setEmojiQuery(""); }, [pickerOpen]);

  async function handleToggleLike() {
    if (!user || !albumId) return;
    setLikeBusy(true);
    const prevLiked = liked;
    const prevCount = likeCount;
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? prevCount - 1 : prevCount + 1);
    try {
      await toggleLike(albumId, user.uid);
    } catch (e: any) {
      setLiked(prevLiked);
      setLikeCount(prevCount);
      setError(translateError(e));
    } finally {
      setLikeBusy(false);
    }
  }

  async function handleToggleReaction(emoji: string) {
    if (!user || !albumId) return;
    const prev = reactions.slice();
    // 楽観更新
    setReactions((cur) => {
      const idx = cur.findIndex((x) => x.emoji === emoji);
      if (idx >= 0) {
        const item = { ...cur[idx] };
        if (item.mine) { item.mine = false; item.count = Math.max(0, item.count - 1); }
        else { item.mine = true; item.count += 1; }
        const next = cur.slice(); next[idx] = item; return next;
      } else {
        return [...cur, { emoji, count: 1, mine: true }];
      }
    });
    try {
      const result = await toggleReaction(albumId, user.uid, emoji);
      if ((result as any).added && album && album.ownerId !== user.uid) {
        // 通知作成（失敗しても UI には影響させない）
        addNotification({
          userId: album.ownerId,
          actorId: user.uid,
          type: 'reaction',
          albumId,
          message: 'アルバムにリアクション: ' + emoji,
        }).catch(() => {});
      }
    } catch (e:any) {
      // ロールバック
      setReactions(prev);
      setError(translateError(e));
    }
  }

  function onChipEnter(emoji: string) {
    if (!albumId) return;
    setHoveredEmoji(emoji);
    if (!reactorMap[emoji] && !reactorLoading[emoji]) {
      setReactorLoading((s) => ({ ...s, [emoji]: true }));
      listReactorsByAlbumEmoji(albumId, emoji, 20)
        .then((list) => setReactorMap((m) => ({ ...m, [emoji]: list })))
        .catch(() => {})
        .finally(() => setReactorLoading((s) => ({ ...s, [emoji]: false })));
    }
  }
  function onChipLeave() {
    setHoveredEmoji(null);
  }

  async function handleDeleteImage(id: string) {
    if (!confirm("画像を削除しますか？")) return;
    try {
      await deleteImage(id);
      const imgs = await listImages(albumId!);
      imgs.sort(
        (a: any, b: any) =>
          (b.createdAt?.seconds || b.createdAt || 0) -
          (a.createdAt?.seconds || a.createdAt || 0),
      );
      setImages(imgs);
    } catch (e: any) {
      setError(translateError(e));
    }
  }

  async function handleSaveAlbum() {
    if (!albumId) return;
    setSavingAlbum(true);
    setAlbumSavedMsg("");
    setError(null);
    try {
      await updateAlbum(albumId, { title: editTitle, placeUrl: editPlaceUrl });
      setAlbumSavedMsg("保存しました");
      const updated = await getAlbumSafe(albumId);
      if (updated) setAlbum(updated as AlbumRecord);
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setSavingAlbum(false);
      setTimeout(() => setAlbumSavedMsg(""), 2500);
    }
  }

  function askDeleteAlbum() {
    setShowDeleteConfirm(true);
  }

  async function confirmDeleteAlbum() {
    if (!albumId || !user) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteAlbum(albumId);
      // 削除後の遷移（プロフィールへ）
      try {
        sessionStorage.setItem(
          'app:toast',
          JSON.stringify({ message: 'アルバムを削除しました', variant: 'success', duration: 3000 })
        );
      } catch {}
      const profile = await getUser(user.uid);
      const handle = profile?.handle || user.uid;
      router.push(`/user/${handle}`);
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  }

  function beginEditComment(commentId: string) {
    const target = comments.find((c) => c.id === commentId);
    if (!target) return;
    setEditingCommentId(target.id);
    setEditingCommentBody(target.body ?? "");
  }

  function cancelEditComment() {
    setEditingCommentId(null);
    setEditingCommentBody("");
  }

  async function saveEditComment(commentId: string) {
    if (!commentId || !editingCommentBody.trim()) return;
    try {
      await updateComment(commentId, editingCommentBody.trim());
      cancelEditComment();
    } catch (e: any) {
      setError(translateError(e));
    }
  }

  async function handleDeleteComment(id: string) {
    if (!confirm("コメントを削除しますか？")) return;
    try {
      await deleteComment(id);
    } catch (e: any) {
      setError(translateError(e));
    }
  }

  async function submitComment() {
    if (!user || !albumId || !commentText.trim()) return;
    setCommenting(true);
    setError(null);
    try {
      await addComment(albumId, user.uid, commentText.trim());
      setCommentText("");
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setCommenting(false);
    }
  }

  if (!albumId) {
    return <div className="text-sm text-gray-500">アルバムIDが指定されていません。</div>;
  }

  if (loading) return <div className="text-sm text-gray-500">読み込み中...</div>;

  if (!album) {
    return (
      <div className="text-sm text-gray-600">
        {error ?? "アルバムが見つかりません"}
      </div>
    );
  }

  const isOwner = !!(user && album.ownerId === user.uid);
  const myCount = images.filter((img) => img.uploaderId === user?.uid).length;
  const remaining = 4 - myCount;
  const canAddImages = !!user;
  const canPostComment = !!user;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-semibold">アルバム詳細</h1>
        <p className="text-sm text-gray-700">ID: {album.id}</p>
        {!isOwner && album.title && <p className="mt-1 text-lg">{album.title}</p>}
        <div className="mt-2 relative flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              aria-pressed={liked}
              disabled={!user || likeBusy}
              onClick={handleToggleLike}
              className={`rounded border px-2 py-1 text-sm ${liked ? "border-pink-600 bg-pink-600 text-white" : "border-gray-300 bg-white text-gray-700"} disabled:opacity-50`}
            >{liked ? "♥ いいね済み" : "♡ いいね"}</button>
            <span className="text-xs text-gray-600">{likeCount}</span>
          </div>
          {/* リアクション絵文字（ピッカー） */}
          <div className="ml-4 flex items-center gap-2 flex-wrap">
            {/* 現在の集計をチップ表示（1以上のみ表示、クリックでトグル） */}
            {reactions.filter(r => r.count > 0).map((r) => {
              const mine = r.mine;
              const count = r.count;
              return (
                <div key={r.emoji} className="relative" onMouseEnter={() => onChipEnter(r.emoji)} onMouseLeave={onChipLeave}>
                  <button
                    type="button"
                    aria-label={`リアクション ${r.emoji}`}
                    aria-pressed={mine}
                    onClick={() => handleToggleReaction(r.emoji)}
                    className={`rounded border px-2 py-1 text-sm ${mine ? "border-blue-600 bg-blue-50 text-blue-700" : "border-gray-300 bg-white text-gray-700"}`}
                  >{r.emoji} <span className="text-xs">{count}</span></button>
                  {hoveredEmoji === r.emoji && (
                    <div className="absolute left-0 top-full mt-1 w-64 rounded border border-gray-300 bg-white text-gray-800 shadow-lg z-50">
                      <div className="p-2">
                        <p className="text-[11px] text-gray-500 mb-1">このリアクションをした人</p>
                        {reactorLoading[r.emoji] && <p className="text-xs text-gray-500">読み込み中...</p>}
                        {!reactorLoading[r.emoji] && (
                          (reactorMap[r.emoji] && reactorMap[r.emoji]!.length > 0) ? (
                            <ul className="max-h-64 overflow-auto divide-y divide-gray-100">
                              {reactorMap[r.emoji]!.map((u) => (
                                <li key={u.uid}>
                                  <a href={`/user/${u.handle || u.uid}`} className="flex items-center gap-2 px-2 py-1 hover:bg-gray-50">
                                    {u.iconURL ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={u.iconURL} alt="" className="h-5 w-5 rounded-full object-cover" />
                                    ) : (
                                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-gray-200 text-[10px] text-gray-600">{u.displayName?.[0] || '?'}</span>
                                    )}
                                    <span className="text-sm font-medium">{u.displayName}</span>
                                    <span className="text-[11px] text-gray-500">@{u.handle || u.uid.slice(0,6)}</span>
                                  </a>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-gray-500">まだいません</p>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <button
              ref={pickerBtnRef}
              type="button"
              disabled={!user}
              onClick={() => setPickerOpen((o) => !o)}
              className="rounded border px-2 py-1 text-sm border-gray-300 bg-white text-gray-700 disabled:opacity-50"
            >＋リアクション</button>
            {pickerOpen && (
              <div ref={pickerRef} className="absolute top-full left-0 mt-2 w-80 surface-alt border border-base rounded shadow-lg p-2 z-50">
                <p className="text-xs text-gray-600 mb-2">絵文字を選択してください（再選択で解除）</p>
                <input
                  autoFocus
                  value={emojiQuery}
                  onChange={(e)=> setEmojiQuery(e.target.value)}
                  placeholder="検索（例: ハート / fire / 👍 を貼付）"
                  className="mb-2 w-full border-b-2 border-blue-500 bg-transparent p-1 text-sm focus:outline-none"
                />
                {/* カテゴリタブ（検索時は非表示） */}
                {!emojiQuery && (
                  <div className="mb-2 flex flex-wrap gap-1">
                    {REACTION_CATEGORIES.map(cat => (
                      <button
                        key={cat.key}
                        type="button"
                        aria-label={cat.label}
                        title={cat.label}
                        onClick={() => setActiveCat(cat.key)}
                        className={`flex items-center justify-center w-9 h-9 text-lg rounded border ${activeCat===cat.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300'}`}
                      >{cat.icon}</button>
                    ))}
                  </div>
                )}
                <div className="max-h-64 overflow-auto">
                  <div className="grid grid-cols-6 gap-2">
                  {(emojiQuery ? filteredEmojis : categoryEmojis).map((e) => {
                    const rec = reactions.find((x) => x.emoji === e);
                    const mine = !!rec?.mine;
                    return (
                      <button
                        key={e}
                        type="button"
                        aria-label={`リアクション ${e}`}
                        aria-pressed={mine}
                        onClick={() => { handleToggleReaction(e); setPickerOpen(false); }}
                        className={`rounded border px-2 py-1 text-sm ${mine ? "border-blue-600 bg-blue-600 text-white" : "border-gray-300 bg-white text-gray-700"}`}
                      >{e}</button>
                    );
                  })}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {!isOwner && album.placeUrl && (
          <a
            href={album.placeUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-block text-sm link-accent"
          >撮影場所</a>
        )}
        {isOwner && (
          <div className="mt-2 space-y-3 rounded border border-base surface-alt p-3">
            <div>
              <label className="block text-xs font-medium fg-muted">タイトル</label>
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="mt-1 input-underline text-sm"
                placeholder="タイトル"
              />
            </div>
            <div>
              <label className="block text-xs font-medium fg-muted">撮影場所URL</label>
              <input
                value={editPlaceUrl}
                onChange={(e) => setEditPlaceUrl(e.target.value)}
                className="mt-1 input-underline text-sm"
                placeholder="https://..."
              />
            </div>
            <button
              disabled={savingAlbum}
              onClick={handleSaveAlbum}
              className="btn-accent text-sm disabled:opacity-50"
            >{savingAlbum ? "保存中..." : "変更を保存"}</button>
            {albumSavedMsg && <p className="text-xs text-green-600">{albumSavedMsg}</p>}
            <div className="pt-3 border-t mt-2">
              <button
                type="button"
                onClick={askDeleteAlbum}
                className="rounded bg-red-600 px-3 py-1.5 text-sm text-white"
              >アルバムを削除</button>
            </div>
          </div>
        )}
      </div>

      <section>
        <h2 className="mb-2 text-lg font-medium">画像一覧 ({images.length})</h2>
        {images.length === 0 && <p className="text-sm text-gray-500">まだ画像がありません</p>}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {images.map((img) => (
            <figure key={img.id || img.url} className="relative rounded border p-1">
              <img src={img.url} alt={img.id || "image"} className="h-auto w-full object-cover" />
              <figcaption className="mt-1 text-[10px] text-gray-500">uploader: {img.uploaderId}</figcaption>
              {(isOwner || img.uploaderId === user?.uid) && (
                <button
                  onClick={() => handleDeleteImage(img.id)}
                  className="absolute right-1 top-1 rounded bg-red-600 px-2 py-0.5 text-[10px] text-white opacity-80 hover:opacity-100"
                >削除</button>
              )}
            </figure>
          ))}
        </div>
        {user && canAddImages && (
          <div className="mt-4">
            <h3 className="mb-1 text-sm font-medium">画像追加 (残り {remaining} 枚)</h3>
            {remaining <= 0 && <p className="text-xs text-red-600">これ以上追加できません</p>}
            <input
              type="file"
              accept="image/*"
              disabled={uploading || remaining <= 0}
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="mb-2"
            />
            <button
              onClick={handleAddImage}
              disabled={!file || uploading || remaining <= 0}
              className="btn-accent text-sm disabled:opacity-50"
            >{uploading ? "アップロード中..." : "追加"}</button>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">コメント ({comments.length})</h2>
        <CommentList
          comments={comments}
          currentUserId={user?.uid ?? ''}
          albumOwnerId={album.ownerId}
          onEditRequest={beginEditComment}
          onEditChange={(_, value) => setEditingCommentBody(value)}
          onEditSave={saveEditComment}
          onEditCancel={cancelEditComment}
          onDelete={handleDeleteComment}
          editingCommentId={editingCommentId}
          editingValue={editingCommentBody}
        />
        {user && canPostComment && (
          <div className="max-w-md">
            <CommentForm
              value={commentText}
              onChange={setCommentText}
              onSubmit={submitComment}
              busy={commenting}
            />
          </div>
        )}
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="space-y-1 text-xs text-gray-500">
        {!canAddImages && <p>※ 操作にはログインが必要です。</p>}
      </div>
      <p className="text-xs text-gray-500">※ 簡易版: 画像追加は DataURL 保存。本番は Firebase Storage 経由へ差し替え予定。</p>

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-80 rounded bg-white p-4 shadow-lg">
            <h3 className="text-sm font-semibold">本当に削除しますか？</h3>
            <p className="mt-2 text-xs text-gray-600">この操作は取り消せません。アルバムを削除します。</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded bg-gray-200 px-3 py-1 text-xs"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >キャンセル</button>
              <button
                type="button"
                className="rounded bg-red-600 px-3 py-1 text-xs text-white disabled:opacity-50"
                onClick={confirmDeleteAlbum}
                disabled={deleting}
              >{deleting ? "削除中..." : "削除"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("FILE_READ_ERROR"));
    reader.readAsDataURL(file);
  });
}
