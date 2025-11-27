"use client";
import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { COL } from "../../../lib/paths";
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
import { updateAlbum } from "../../../lib/repos/albumRepo";
import {
  toggleLike,
  hasLiked,
  countLikes,
} from "../../../lib/repos/likeRepo";
import { getFriendStatus } from "../../../lib/repos/friendRepo";
import { isWatched } from "../../../lib/repos/watchRepo";
import { translateError } from "../../../lib/errors";
import { CommentList } from "../../../components/comments/CommentList";
import { CommentForm } from "../../../components/comments/CommentForm";
import { ERR } from "../../../types/models";

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
  const [accessLoading, setAccessLoading] = useState(true);
  const [isFriend, setIsFriend] = useState(false);
  const [isWatcher, setIsWatcher] = useState(false);
  const [accessError, setAccessError] = useState<string | null>(null);

  useEffect(() => {
  if (!albumId) return;

    let cancelled = false;
    let unsubComments: (() => void) | undefined;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const albumRef = doc(db, COL.albums, albumId);
        const albumSnap = await getDoc(albumRef);
        if (!albumSnap.exists()) {
          if (!cancelled) {
            setAlbum(null);
            setImages([]);
            setComments([]);
            setAccessLoading(false);
            setError("アルバムが見つかりません");
          }
          return;
        }

        const albumData = { id: albumSnap.id, ...(albumSnap.data() as any) } as AlbumRecord;
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

        const initialComments = await getDocs(
          query(collection(db, COL.comments), where("albumId", "==", albumId)),
        );
        if (!cancelled) {
          const list: CommentRecord[] = [];
          initialComments.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...(docSnap.data() as any) });
          });
          list.sort(
            (a, b) =>
              (a.createdAt?.seconds || a.createdAt || 0) -
              (b.createdAt?.seconds || b.createdAt || 0),
          );
          setComments(list);
        }

        unsubComments = onSnapshot(
          query(collection(db, COL.comments), where("albumId", "==", albumId)),
          (snapshot) => {
            if (cancelled) return;
            const list: CommentRecord[] = [];
            snapshot.forEach((docSnap) => {
              list.push({ id: docSnap.id, ...(docSnap.data() as any) });
            });
            list.sort(
              (a, b) =>
                (a.createdAt?.seconds || a.createdAt || 0) -
                (b.createdAt?.seconds || b.createdAt || 0),
            );
            setComments(list);
          },
          (err) => {
            console.warn("comments subscribe error", err);
          },
        );
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

        unsubLikes = onSnapshot(
          query(collection(db, COL.likes), where("albumId", "==", albumId)),
          (snap) => {
            if (cancelled) return;
            const likedUsers = new Set<string>();
            snap.forEach((docSnap) => {
              const data = docSnap.data() as any;
              if (data.userId) likedUsers.add(data.userId);
            });
            setLikeCount(snap.size);
            setLiked(likedUsers.has(user.uid));
          },
          (err) => console.warn("likes subscribe error", err),
        );
      } catch (e: any) {
        if (!cancelled) setError(translateError(e));
      }
    })();

    return () => {
      cancelled = true;
      if (unsubLikes) unsubLikes();
    };
  }, [albumId, user?.uid]);

  useEffect(() => {
    if (!albumId) return;

    let cancelled = false;

    (async () => {
      setAccessLoading(true);
      setAccessError(null);
      try {
        if (!album) {
          return;
        }
        // 未ログインでも閲覧は可能（権限チェックは投稿/参加操作に限定）
        if (!user) {
          setIsFriend(false);
          setIsWatcher(false);
          setAccessError(null);
          setAccessLoading(false);
          return;
        }
        if (album.ownerId === user.uid) {
          setIsFriend(false);
          setIsWatcher(false);
          setAccessError(null);
          return;
        }

        const [status, watched] = await Promise.all([
          getFriendStatus(user.uid, album.ownerId),
          isWatched(user.uid, album.ownerId),
        ]);
        if (cancelled) return;
        setIsFriend(status === "accepted");
        setIsWatcher(watched);
        setAccessError(null);
      } catch (e: any) {
        if (!cancelled) setAccessError(translateError(e));
      } finally {
        if (!cancelled) setAccessLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [albumId, album, user]);

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
      const albumSnap = await getDoc(doc(db, COL.albums, albumId));
      if (albumSnap.exists()) setAlbum({ id: albumSnap.id, ...(albumSnap.data() as any) });
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setSavingAlbum(false);
      setTimeout(() => setAlbumSavedMsg(""), 2500);
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
  // 公開閲覧を許可（ルールが allow read: if true のため）
  const canView = true;
  const myCount = images.filter((img) => img.uploaderId === user?.uid).length;
  const remaining = 4 - myCount;
  const canAddImages = isOwner || isFriend;
  const canPostComment = isOwner || isFriend;

  // 未ログインでも閲覧は許可。操作はボタン側で disable 済み。

  if (accessLoading) {
    return <div className="text-sm text-gray-500">権限確認中...</div>;
  }

  if (!canView) {
    return (
      <div className="space-y-2 p-4">
        <h1 className="text-lg font-semibold">アルバム</h1>
        <p className="text-sm text-red-600">閲覧権限がありません。</p>
        {accessError && <p className="text-xs text-gray-500">{accessError}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2 text-2xl font-semibold">アルバム詳細</h1>
        <p className="text-sm text-gray-700">ID: {album.id}</p>
        {!isOwner && album.title && <p className="mt-1 text-lg">{album.title}</p>}
        <div className="mt-2 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              aria-pressed={liked}
              disabled={!user || likeBusy}
              onClick={handleToggleLike}
              className={`rounded border px-2 py-1 text-sm ${liked ? "border-pink-600 bg-pink-600 text-white" : "border-gray-300 bg-white text-gray-700"} disabled:opacity-50`}
            >{liked ? "♥ いいね済み" : "♡ いいね"}</button>
            <span className="text-xs text-gray-600">{likeCount}</span>
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
        <p>権限: {isOwner ? "オーナー" : isFriend ? "フレンド" : isWatcher ? "ウォッチャー" : "その他"}</p>
        {!canAddImages && <p>※ 画像追加はオーナーまたはフレンドのみ。</p>}
        {!canPostComment && <p>※ コメント投稿はオーナーまたはフレンドのみ。</p>}
      </div>
      <p className="text-xs text-gray-500">※ 簡易版: 画像追加は DataURL 保存。本番は Firebase Storage 経由へ差し替え予定。</p>
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
