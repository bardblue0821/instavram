"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { type PhotoItem } from "@/components/gallery/GalleryGrid";
import AlbumHeader from "@/components/album/AlbumHeader";
import ReactionsBar from "@/components/album/ReactionsBar";
import GallerySection from "@/components/album/GallerySection";
import CommentsSection from "@/components/album/CommentsSection";
import DeleteConfirmModal from "@/components/album/DeleteConfirmModal";
import { useParams, useRouter } from "next/navigation";
import { useAuthUser } from "../../../lib/hooks/useAuthUser";
import {
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
  subscribeLikes,
} from "../../../lib/repos/likeRepo";
import { translateError } from "../../../lib/errors";
import { CommentList } from "../../../components/comments/CommentList";
import { listComments, subscribeComments } from "../../../lib/repos/commentRepo";
import { CommentForm } from "../../../components/comments/CommentForm";
import { ERR } from "../../../types/models";
import { listReactionsByAlbum, toggleReaction, listReactorsByAlbumEmoji, Reactor } from "../../../lib/repos/reactionRepo";
// サムネイル自動生成・アクセス判定のフックへ分離
import { useThumbBackfill } from "@/src/hooks/useThumbBackfill";
import { useAlbumAccess } from "@/src/hooks/useAlbumAccess";
import { addNotification } from "../../../lib/repos/notificationRepo";
import { REACTION_EMOJIS, REACTION_CATEGORIES, filterReactionEmojis } from "../../../lib/constants/reactions";
import Avatar from "../../../components/profile/Avatar";
// アクセス判定はフックで実施
// いいねアイコンは ReactionsBar 内で使用
import { getAlbumDetailVM } from "@/src/services/album/getAlbumDetail";
import type { AlbumDetailVM, UserRef } from "@/src/models/album";
import { batchGetUsers } from "../../../lib/utils/batchQuery";

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
  const [showDeleteImageConfirm, setShowDeleteImageConfirm] = useState(false);
  const [deletingImageId, setDeletingImageId] = useState<string | null>(null);
  const [deletingImage, setDeletingImage] = useState(false);
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
  // 一覧の初期表示件数（早期 return より前に hook を宣言しておく）
  const [visibleCount, setVisibleCount] = useState(16);
  // 画像の投稿者（アイコン表示用）キャッシュ
  const [uploaderMap, setUploaderMap] = useState<Record<string, { iconURL: string | null; handle: string | null }>>({});
  // アクセス権限（フックに分離）
  const { isFriend, isWatcher } = useAlbumAccess(album?.ownerId, user?.uid);

  useEffect(() => {
    if (!albumId) return;

    let cancelled = false;
    let unsubComments: (() => void) | undefined;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const userCache = new Map<string, UserRef | null>();
        const vm = await getAlbumDetailVM(albumId, user?.uid, userCache);
        if (!vm) {
          if (!cancelled) {
            setAlbum(null);
            setImages([]);
            setComments([]);
            setError("アルバムが見つかりません");
          }
          return;
        }
        if (cancelled) return;
        setAlbum(vm.album as any);
        setEditTitle(vm.album.title ?? "");
        setEditPlaceUrl(vm.album.placeUrl ?? "");
        setImages(vm.images as any[]);
        setComments(vm.commentsAsc as CommentRecord[]);
  setReactions(vm.reactions);

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
        // リアクションは VM セット済み（購読は個別に必要なら後で実装）
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

    (async () => {
      try {
        // 初期値はクエリで即時反映
        const cnt = await countLikes(albumId);
        if (!cancelled) setLikeCount(cnt);
        if (user?.uid) {
          const likedFlag = await hasLiked(albumId, user.uid);
          if (!cancelled) setLiked(likedFlag);
        } else {
          if (!cancelled) setLiked(false);
        }
      } catch (e: any) {
        if (!cancelled) setError(translateError(e));
      }
      // リアルタイム購読で常に同期
      try {
        unsubLikes = await subscribeLikes(
          albumId,
          (list) => {
            const cnt2 = list.length;
            const meLiked = !!(user?.uid && list.some(x => x.userId === user.uid));
            setLikeCount(cnt2);
            setLiked(meLiked);
          },
          (err) => console.warn("likes subscribe error", err)
        );
      } catch (e) {
        // 購読失敗は致命的ではない
        console.warn('subscribeLikes failed', e);
      }
    })();

    return () => {
      cancelled = true;
      if (unsubLikes) try { unsubLikes(); } catch {}
    };
  }, [albumId, user?.uid]);

  // アクセス権限の判定は useAlbumAccess へ分離

  // 既存画像のサムネイル不足分はフックで自動生成
  useThumbBackfill(albumId, images, visibleCount, setImages);

  // 投稿者アイコンの取得（バッチクエリで一括取得）
  useEffect(() => {
    const ids = Array.from(new Set(images.map((img) => img.uploaderId).filter(Boolean)));
    if (ids.length === 0) return;
    let cancelled = false;
    (async () => {
      // ========================================
      // N+1 問題解決: バッチクエリで一括取得
      // ========================================
      try {
        const batchedUsers = await batchGetUsers(ids);
        const next: Record<string, { iconURL: string | null; handle: string | null }> = {};
        
        ids.forEach((uid) => {
          const u = batchedUsers.get(uid);
          next[uid] = { 
            iconURL: u?.iconURL || null, 
            handle: u?.handle || null 
          };
        });
        
        if (!cancelled) setUploaderMap(next);
      } catch (e) {
        console.warn('Failed to batch get uploaders', e);
        // フォールバック: 空のマップをセット
        if (!cancelled) setUploaderMap({});
      }
    })();
    return () => { cancelled = true; };
  }, [images]);

  async function handleAddImage() {
    if (!user || !albumId || !file) return;
    // 権限チェック: オーナー/フレンドのみ
    if (!(isOwner || isFriend)) {
      setError('画像を追加する権限がありません');
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const url = await fileToDataUrl(file);
      const token = await user.getIdToken();
      console.log('[album:addImage] uploading image');
      const res = await fetch('/api/images/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
        body: JSON.stringify({ albumId, userId: user.uid, url }),
      });
      if (!res.ok) {
        const data = await res.json().catch(()=>({}));
        console.error('[album:addImage] API error:', data);
        setError(translateError(data?.error || 'UNKNOWN'));
        return;
      }
      console.log('[album:addImage] upload successful, refreshing image list');
      
      // ★ 画像リストを再取得（エラーが発生しても無視）
      try {
        const imgs = await listImages(albumId);
        console.log('[album:addImage] image list refreshed', imgs.length);
        imgs.sort(
          (a: any, b: any) =>
            (b.createdAt?.seconds || b.createdAt || 0) -
            (a.createdAt?.seconds || a.createdAt || 0),
        );
        setImages(imgs);
        setFile(null);
        console.log('[album:addImage] complete');
      } catch (listError: any) {
        // listImages でエラーが発生してもアップロードは成功しているので無視
        console.warn('[album:addImage] failed to refresh image list, but upload succeeded:', listError);
        // 楽観的更新: 新しい画像を手動で追加
        const newImage = {
          id: Date.now().toString(), // 仮のID
          albumId,
          uploaderId: user.uid,
          url,
          createdAt: new Date(),
        };
        setImages((prev) => [newImage, ...prev]);
        setFile(null);
        // エラーメッセージは表示しない（アップロードは成功）
      }
    } catch (e: any) {
      console.error('[album:addImage] error:', e);
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
      const token = await user.getIdToken();
      const res = await fetch('/api/likes/toggle', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
        body: JSON.stringify({ albumId, userId: user.uid }),
      });
      if (!res.ok) {
        await toggleLike(albumId, user.uid);
      }
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
      if (added && album && album.ownerId !== user.uid) {
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

  function askDeleteImage(id: string) {
    setDeletingImageId(id);
    setShowDeleteImageConfirm(true);
  }

  async function confirmDeleteImage() {
    const id = deletingImageId;
    if (!id) return;
    
    setDeletingImage(true);
    try {
      // 権限チェック: オーナーは全て、フレンドは自分の画像のみ、ウォッチャー不可
      const target = images.find((img) => img.id === id);
      if (!target) return;
      if (!(isOwner || (isFriend && target.uploaderId === user?.uid))) {
        setError('この画像を削除する権限がありません');
        return;
      }
      const token = await user!.getIdToken();
      const res = await fetch('/api/images/delete', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
        body: JSON.stringify({ albumId, userId: user!.uid, imageId: id }),
      });
      if (!res.ok) {
        const data = await res.json().catch(()=>({}));
        setError(translateError(data?.error || 'UNKNOWN'));
        return;
      }
      const imgs = await listImages(albumId!);
      imgs.sort(
        (a: any, b: any) =>
          (b.createdAt?.seconds || b.createdAt || 0) -
          (a.createdAt?.seconds || a.createdAt || 0),
      );
      setImages(imgs);
      setShowDeleteImageConfirm(false);
      setDeletingImageId(null);
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setDeletingImage(false);
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

  async function handleChangeVisibility(v: 'public' | 'friends') {
    if (!albumId || !album) return;
    setSavingAlbum(true);
    setAlbumSavedMsg("");
    setError(null);
    try {
      await updateAlbum(albumId, { visibility: v });
  // 公開→フレンド限定へ切り替え時は既存のリポストを無効化（削除）
      if (v === 'friends') {
        try {
          const { deleteRepostsByAlbum } = await import("../../../lib/repos/repostRepo");
          await deleteRepostsByAlbum(albumId);
        } catch (e) {
          console.warn('deleteRepostsByAlbum failed', e);
        }
      }
      const updated = await getAlbumSafe(albumId);
      if (updated) setAlbum(updated as AlbumRecord);
      setAlbumSavedMsg("保存しました");
      setTimeout(() => setAlbumSavedMsg(""), 2500);
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setSavingAlbum(false);
    }
  }

  // 入力フィールドのオートセーブ（フォーカスアウトで保存）
  async function saveTitleIfChanged() {
    if (!albumId) return;
    const current = (album?.title ?? "");
    const next = (editTitle ?? "").trim();
    if (next === current) return;
    setSavingAlbum(true);
    setAlbumSavedMsg("");
    setError(null);
    try {
      await updateAlbum(albumId, { title: next });
      setAlbum((prev) => (prev ? { ...prev, title: next } : prev));
      setAlbumSavedMsg("保存しました");
      setTimeout(() => setAlbumSavedMsg(""), 2500);
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setSavingAlbum(false);
    }
  }

  async function savePlaceUrlIfChanged() {
    if (!albumId) return;
    const current = (album?.placeUrl ?? "");
    const next = (editPlaceUrl ?? "").trim();
    if (next === current) return;
    setSavingAlbum(true);
    setAlbumSavedMsg("");
    setError(null);
    try {
      await updateAlbum(albumId, { placeUrl: next });
      setAlbum((prev) => (prev ? { ...prev, placeUrl: next } : prev));
      setAlbumSavedMsg("保存しました");
      setTimeout(() => setAlbumSavedMsg(""), 2500);
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setSavingAlbum(false);
    }
  }

  function handleInputKeyDownBlurOnEnter(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      (e.currentTarget as HTMLInputElement).blur();
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
      // 削除後の遷移（タイムラインへ）
      try {
        sessionStorage.setItem(
          'app:toast',
          JSON.stringify({ message: 'アルバムを削除しました', variant: 'success', duration: 3000 })
        );
      } catch {}
      // 削除済みページに戻れないよう replace を使用
      router.replace('/timeline');
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
    if (!(isOwner || isFriend || isWatcher)) {
      setError('コメントする権限がありません');
      return;
    }
    setCommenting(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/comments/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
        body: JSON.stringify({ albumId, userId: user.uid, body: commentText.trim() }),
      });
      if (!res.ok) {
        await addComment(albumId, user.uid, commentText.trim());
      }
      setCommentText("");
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setCommenting(false);
    }
  }

  // ギャラリー表示用データ（フックはトップレベルで常に実行し、早期returnの前に置く）
  const photos: PhotoItem[] = useMemo(() => {
    return images.map((img) => ({
      id: img.id,
      src: img.url,
      thumbSrc: img.thumbUrl || img.url,
      width: 1200,
      height: 1200,
      alt: img.id || "image",
      uploaderId: img.uploaderId,
      uploaderIconURL: img.uploaderId ? (uploaderMap[img.uploaderId]?.iconURL || null) : null,
      uploaderHandle: img.uploaderId ? (uploaderMap[img.uploaderId]?.handle || null) : null,
    }));
  }, [images, uploaderMap]);

  if (!albumId) {
    return <div className="text-sm fg-subtle">アルバムIDが指定されていません。</div>;
  }

  if (loading) return <div className="text-sm fg-subtle">読み込み中...</div>;

  if (!album) {
    return (
      <div className="text-sm fg-muted">
        {error ?? "アルバムが見つかりません"}
      </div>
    );
  }

  const isOwner = !!(user && album.ownerId === user.uid);
  const myCount = images.filter((img) => img.uploaderId === user?.uid).length;
  const remaining = 4 - myCount;
  // 権限: 画像追加はオーナー/フレンドのみ。コメントはオーナー/フレンド/ウォッチャー。
  const canAddImages = !!user && (isOwner || isFriend);
  const isPrivate = (album as any)?.visibility === 'friends';
  const canPostComment = !!user && (isOwner || isFriend || (!isPrivate && isWatcher));
  // タイトル表示（null/空文字の場合は「タイトルなし」）
  const displayTitle = (album.title && (album.title + '').trim().length > 0) ? (album.title as string) : '無題';

  return (
    <div className="space-y-6">
      <AlbumHeader
        album={album as any}
        isOwner={isOwner}
        editTitle={editTitle}
        editPlaceUrl={editPlaceUrl}
        savingAlbum={savingAlbum}
        albumSavedMsg={albumSavedMsg}
        onTitleChange={setEditTitle}
        onPlaceUrlChange={setEditPlaceUrl}
        onTitleBlur={saveTitleIfChanged}
        onPlaceUrlBlur={savePlaceUrlIfChanged}
        onInputKeyDownBlurOnEnter={handleInputKeyDownBlurOnEnter}
        onVisibilityChange={handleChangeVisibility}
      />

      {/* 参加ユーザーのアイコン一覧（タイトル・URLブロックの下） */}
      {images.length > 0 && (
        (() => {
          const ids = Array.from(new Set(images.map(img => img.uploaderId).filter(Boolean)));
          if (ids.length === 0) return null;
          return (
            <section aria-label="参加ユーザー" className="-mt-2">
              <div className="flex flex-wrap items-center gap-2">
                {ids.map((uid) => {
                  const icon = uploaderMap[uid!]?.iconURL || null;
                  const handle = uploaderMap[uid!]?.handle || null;
                  const href = `/user/${handle || uid}`;
                  return (
                    <a key={uid as string} href={href} aria-label="プロフィールへ" className="shrink-0">
                      <Avatar src={icon || undefined} size={28} interactive={false} withBorder={false} className="rounded-full" />
                    </a>
                  );
                })}
              </div>
            </section>
          );
        })()
      )}

      <ReactionsBar
        liked={liked}
        likeCount={likeCount}
        likeBusy={!user || likeBusy}
        onToggleLike={handleToggleLike}
        reactions={reactions}
        hoveredEmoji={hoveredEmoji}
        onChipEnter={onChipEnter}
        onChipLeave={onChipLeave}
        reactorMap={reactorMap}
        reactorLoading={reactorLoading}
        pickerOpen={pickerOpen}
        onTogglePicker={() => setPickerOpen((o) => !o)}
        emojiQuery={emojiQuery}
        onEmojiQueryChange={setEmojiQuery}
        activeCat={activeCat}
  onActiveCatChange={(key) => setActiveCat(key as any)}
        filteredEmojis={filteredEmojis}
        categoryEmojis={categoryEmojis}
        categories={REACTION_CATEGORIES}
        onPickEmoji={(e) => handleToggleReaction(e)}
      />

      <GallerySection
        photos={photos}
        imagesLength={images.length}
        visibleCount={visibleCount}
        onSeeMore={() => setVisibleCount((n) => Math.min(images.length, n + 16))}
        canDelete={(p) => {
          if (isOwner) return true;
          if (isFriend) return p.uploaderId === user?.uid;
          return false;
        }}
        onDelete={(p) => { if (p.id) askDeleteImage(p.id); }}
        showUploader={!!(user && canAddImages)}
        albumId={albumId!}
        userId={user?.uid || ''}
        remaining={remaining}
        onUploaded={async () => {
          const imgs = await listImages(albumId!);
          imgs.sort(
            (a: any, b: any) =>
              (b.createdAt?.seconds || b.createdAt || 0) -
              (a.createdAt?.seconds || a.createdAt || 0),
          );
          setImages(imgs);
        }}
      />

      <CommentsSection
        comments={comments as any}
        currentUserId={user?.uid ?? ''}
        albumOwnerId={album.ownerId}
        canPostComment={!!(user && canPostComment)}
        editingCommentId={editingCommentId}
        editingValue={editingCommentBody}
        commentText={commentText}
        commenting={commenting}
        onEditRequest={beginEditComment}
        onEditChange={(_, value) => setEditingCommentBody(value)}
        onEditSave={saveEditComment}
        onEditCancel={cancelEditComment}
        onDelete={handleDeleteComment}
        onSubmit={submitComment}
        onChangeText={setCommentText}
      />

      {isOwner && (
        <section>
          <div className="pt-3 mt-2">
            <button
              type="button"
              onClick={askDeleteAlbum}
              className="rounded bg-red-600 px-3 py-1.5 text-sm text-white"
            >アルバムを削除</button>
          </div>
        </section>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {/* ログイン必須の注意文は非表示に変更 */}

      <DeleteConfirmModal
        open={showDeleteConfirm}
        busy={deleting}
        onCancel={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDeleteAlbum}
      />

      <DeleteConfirmModal
        open={showDeleteImageConfirm}
        busy={deletingImage}
        onCancel={() => { setShowDeleteImageConfirm(false); setDeletingImageId(null); }}
        onConfirm={confirmDeleteImage}
        message="この画像を削除しますか？"
        description="この操作は取り消せません。画像を削除します。"
      />
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
