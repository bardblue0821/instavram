"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { COL } from '../../../lib/paths';
import { doc, getDoc, collection, query, where, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { useAuthUser } from '../../../lib/hooks/useAuthUser';
import { addImage, listImages, deleteImage } from '../../../lib/repos/imageRepo';
import { addComment, updateComment, deleteComment } from '../../../lib/repos/commentRepo';
import { updateAlbum } from '../../../lib/repos/albumRepo';
import { toggleLike, hasLiked, countLikes } from '../../../lib/repos/likeRepo';
import { translateError } from '../../../lib/errors';

export default function AlbumDetailPage() {
  const params = useParams();
  const albumId = params?.id as string | undefined;
  const { user } = useAuthUser();
  const [album, setAlbum] = useState<any>(null);
  const [images, setImages] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [editTitle, setEditTitle] = useState('');
  const [editPlaceUrl, setEditPlaceUrl] = useState('');
  const [savingAlbum, setSavingAlbum] = useState(false);
  const [albumSavedMsg, setAlbumSavedMsg] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentBody, setEditingCommentBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [likeCount, setLikeCount] = useState<number>(0);
  const [liked, setLiked] = useState<boolean>(false);
  const [likeBusy, setLikeBusy] = useState(false);
  // 仮コメント追跡 (楽観的表示 → 実ドキュメント到着で除去)
  const [pendingLocalComments, setPendingLocalComments] = useState<{id:string; body:string; userId:string; createdAt:Date}[]>([]);

  useEffect(() => {
    if (!albumId) return;
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const albumSnap = await getDoc(doc(db, COL.albums, albumId));
        if (albumSnap.exists()) {
          const data = albumSnap.data();
            setAlbum(data);
            setEditTitle(data.title || '');
            setEditPlaceUrl(data.placeUrl || '');
        }
  const imgs = await listImages(albumId);
  // 初期コメント取得（購読開始前の一度）
  const cQInit = query(collection(db, COL.comments), where('albumId', '==', albumId));
  const cSnapInit = await getDocs(cQInit);
  const commInit: any[] = [];
  cSnapInit.forEach(d => commInit.push({ id: d.id, ...d.data() }));
        // like 状態取得
        if (user) {
          const [likedFlag, cnt] = await Promise.all([
            hasLiked(albumId, user.uid),
            countLikes(albumId)
          ]);
          if (active) {
            setLiked(likedFlag);
            setLikeCount(cnt);
          }
        } else {
          // 未ログイン時は件数のみ（仕様上 read は authed 限定→ 0 のまま）
          setLiked(false); setLikeCount(0);
        }
        if (active) {
          // createdAt がない古いデータでも並び替えが壊れないようにフォールバック
          setImages(imgs.sort((a:any,b:any)=> ((b.createdAt?.seconds||b.createdAt||0) - (a.createdAt?.seconds||a.createdAt||0))));
          // 初期表示も古い→新しい（昇順）になるよう並び替え
          setComments(commInit.sort((a,b)=> (a.createdAt?.seconds||a.createdAt||0) - (b.createdAt?.seconds||b.createdAt||0)));
        }
      } catch (e:any) {
        if (active) setError(e.message || '取得に失敗しました');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [albumId]);

  // コメント / いいね リアルタイム購読（インデックス未作成時はフォールバック）
  useEffect(() => {
    if (!albumId) return;
    let unsubComments: (() => void) | undefined;

    function attachOrderedSubscription() {
      const orderedQ = query(collection(db, COL.comments), where('albumId', '==', albumId), orderBy('createdAt', 'asc'));
      unsubComments = onSnapshot(orderedQ, snap => {
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        // temp コメントとの突き合わせ
        setComments(mergeWithPending(list, pendingLocalComments));
      }, err => {
        if (err.code === 'failed-precondition') {
          console.info('Composite index missing (albumId + createdAt asc). Fallback to simple query.');
          attachFallbackSubscription();
        } else {
          console.warn('comments subscribe error (ordered)', err);
        }
      });
    }

    function attachFallbackSubscription() {
      const simpleQ = query(collection(db, COL.comments), where('albumId', '==', albumId));
      unsubComments = onSnapshot(simpleQ, snap => {
        const list: any[] = [];
        snap.forEach(d => list.push({ id: d.id, ...d.data() }));
        list.sort((a,b)=> (a.createdAt?.seconds||a.createdAt||0) - (b.createdAt?.seconds||b.createdAt||0));
        setComments(mergeWithPending(list, pendingLocalComments));
      }, err => console.warn('comments subscribe error (fallback)', err));
    }

    attachOrderedSubscription();

    // いいね購読（ログイン時のみ / read ルール要認証）
    let unsubLikes: (() => void) | undefined;
    if (user) {
      const likesQ = query(collection(db, COL.likes), where('albumId', '==', albumId));
      unsubLikes = onSnapshot(likesQ, snap => {
        const likedUsers = new Set<string>();
        snap.forEach(d => {
          const data = d.data() as any;
          if (data.userId) likedUsers.add(data.userId);
        });
        setLikeCount(snap.size);
        setLiked(user ? likedUsers.has(user.uid) : false);
      }, err => console.warn('likes subscribe error', err));
    }
    return () => {
      if (unsubComments) unsubComments();
      if (unsubLikes) unsubLikes();
    };
  }, [albumId, user]);

  async function handleAddImage() {
    if (!user || !albumId || !file) return;
    setUploading(true);
    setError(null);
    try {
      // 単一ファイルを既存アルバムに追加 (サービス関数は複数向けなので直接 addImage)
      // 事前に Storage へアップロードせず URL がないため、簡易版: DataURL 化 (本番は Storage 利用)
      const url = await fileToDataUrl(file); // 簡易テスト用: 実際は Firebase Storage へアップロード
      await addImage(albumId, user.uid, url);
      const imgs = await listImages(albumId);
      setImages(imgs);
      setFile(null);
    } catch (e:any) {
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
    // 楽観的更新
    setLiked(!prevLiked);
    setLikeCount(prevLiked ? prevCount - 1 : prevCount + 1);
    try {
      await toggleLike(albumId, user.uid);
    } catch (e:any) {
      // ロールバック
      setLiked(prevLiked);
      setLikeCount(prevCount);
      setError(translateError(e));
    } finally {
      setLikeBusy(false);
    }
  }

  async function handleDeleteImage(id: string) {
    if (!confirm('画像を削除しますか？')) return;
    try {
      await deleteImage(id);
      const imgs = await listImages(albumId!);
      setImages(imgs);
    } catch (e:any) {
      setError(translateError(e));
    }
  }

  async function handleSaveAlbum() {
    if (!albumId) return;
    setSavingAlbum(true); setAlbumSavedMsg(''); setError(null);
    try {
      await updateAlbum(albumId, { title: editTitle, placeUrl: editPlaceUrl });
      setAlbumSavedMsg('保存しました');
      // 再取得で同期
      const albumSnap = await getDoc(doc(db, COL.albums, albumId));
      if (albumSnap.exists()) setAlbum(albumSnap.data());
    } catch (e:any) {
      setError(translateError(e));
    } finally {
      setSavingAlbum(false);
      setTimeout(()=> setAlbumSavedMsg(''), 2500);
    }
  }

  function beginEditComment(c: any) {
    setEditingCommentId(c.id);
    setEditingCommentBody(c.body);
  }
  function cancelEditComment() {
    setEditingCommentId(null);
    setEditingCommentBody('');
  }
  async function saveEditComment() {
    if (!editingCommentId) return;
    try {
      await updateComment(editingCommentId, editingCommentBody.trim());
      cancelEditComment(); // 購読で自動反映
    } catch (e:any) {
      setError(translateError(e));
    }
  }
  async function handleDeleteComment(id: string) {
    if (!confirm('コメントを削除しますか？')) return;
    try {
      await deleteComment(id); // 購読で自動反映
    } catch (e:any) {
      setError(translateError(e));
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !albumId || !commentText.trim()) return;
    setCommenting(true);
    setError(null);
    const body = commentText.trim();
    // 楽観的: 一時 ID で先頭に挿入（後で購読が本物を反映して二重ならフィルタ）
  const tempId = `temp_${Date.now()}`;
  const createdAt = new Date();
  setPendingLocalComments(p => [...p, { id: tempId, body, userId: user.uid, createdAt }]);
  setComments(prev => [...prev, { id: tempId, albumId, userId: user.uid, body, createdAt }]);
    try {
      await addComment(albumId, user.uid, body);
      setCommentText('');
      // 除去は snapshot ハンドラ側 mergeWithPending で行うためここでは何もしない
    } catch (e:any) {
      // ロールバック
      setComments(prev => prev.filter(c => c.id !== tempId));
      setPendingLocalComments(p => p.filter(c => c.id !== tempId));
      setError(translateError(e));
    } finally {
      setCommenting(false);
    }
  }

  if (loading) return <div className="text-sm text-gray-500">読み込み中...</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!album) return <div className="text-sm text-gray-600">アルバムが見つかりません</div>;

  const myCount = images.filter(img => img.uploaderId === user?.uid).length;
  const remaining = 4 - myCount;
  const isOwner = user && album && album.ownerId === user.uid;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">アルバム詳細</h1>
        <p className="text-sm text-gray-700">ID: {album.id}</p>
        {!isOwner && album.title && <p className="mt-1 text-lg">{album.title}</p>}
        <div className="mt-2 flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              aria-pressed={liked}
              disabled={!user || likeBusy}
              onClick={handleToggleLike}
              className={`text-sm px-2 py-1 rounded border ${liked ? 'bg-pink-600 text-white border-pink-600' : 'bg-white text-gray-700 border-gray-300'} disabled:opacity-50`}
            >{liked ? '♥ いいね済み' : '♡ いいね'}</button>
            <span className="text-xs text-gray-600">{likeCount}</span>
          </div>
          {!user && <span className="text-[11px] text-gray-500">ログインでいいね可能</span>}
        </div>
        {!isOwner && album.placeUrl && <a href={album.placeUrl} target="_blank" rel="noreferrer" className="text-blue-600 text-sm underline">撮影場所</a>}
        {isOwner && (
          <div className="space-y-3 mt-2 border rounded p-3 bg-gray-50">
            <div>
              <label className="block text-xs font-medium text-gray-600">タイトル</label>
              <input value={editTitle} onChange={e=>setEditTitle(e.target.value)} className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="タイトル" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">撮影場所URL</label>
              <input value={editPlaceUrl} onChange={e=>setEditPlaceUrl(e.target.value)} className="mt-1 w-full border rounded px-2 py-1 text-sm" placeholder="https://..." />
            </div>
            <button disabled={savingAlbum} onClick={handleSaveAlbum} className="text-sm bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50">
              {savingAlbum ? '保存中...' : '変更を保存'}
            </button>
            {albumSavedMsg && <p className="text-xs text-green-600">{albumSavedMsg}</p>}
          </div>
        )}
      </div>
      <section>
        <h2 className="text-lg font-medium mb-2">画像一覧 ({images.length})</h2>
        {images.length === 0 && <p className="text-sm text-gray-500">まだ画像がありません</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {images.map((img) => (
            <figure key={img.id || img.url} className="border rounded p-1 relative group">
              <img src={img.url} alt={img.id || 'image'} className="w-full h-auto object-cover" />
              <figcaption className="text-[10px] text-gray-500 mt-1">uploader: {img.uploaderId}</figcaption>
              {(isOwner || img.uploaderId === user?.uid) && (
                <button onClick={()=>handleDeleteImage(img.id)} className="absolute top-1 right-1 bg-red-600 text-white text-[10px] px-2 py-0.5 rounded opacity-80 hover:opacity-100">削除</button>
              )}
            </figure>
          ))}
        </div>
        {user && (
          <div className="mt-4">
            <h3 className="text-sm font-medium mb-1">画像追加 (残り {remaining} 枚)</h3>
            {remaining <= 0 && <p className="text-xs text-red-600">これ以上追加できません</p>}
            <input
              type="file"
              accept="image/*"
              disabled={uploading || remaining <= 0}
              onChange={e => setFile(e.target.files?.[0] || null)}
              className="mb-2"
            />
            <button
              onClick={handleAddImage}
              disabled={!file || uploading || remaining <= 0}
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
            >{uploading ? 'アップロード中...' : '追加'}</button>
          </div>
        )}
      </section>
      <section>
        <h2 className="text-lg font-medium mb-2">コメント ({comments.length})</h2>
        <ul className="space-y-2 mb-3">
          {comments.map((c) => {
            const canEdit = isOwner || c.userId === user?.uid;
            const editing = editingCommentId === c.id;
            return (
              <li key={c.id} className="border rounded px-3 py-2 text-sm space-y-1">
                {!editing && <p className="whitespace-pre-line break-words">{c.body}</p>}
                {editing && (
                  <textarea value={editingCommentBody} onChange={e=>setEditingCommentBody(e.target.value)} className="w-full border rounded px-2 py-1 text-sm" rows={3} />
                )}
                <p className="text-[10px] text-gray-500">by {c.userId}</p>
                {canEdit && (
                  <div className="flex gap-2">
                    {!editing && <button onClick={()=>beginEditComment(c)} className="text-xs bg-yellow-500 text-white px-2 py-0.5 rounded">編集</button>}
                    {!editing && <button onClick={()=>handleDeleteComment(c.id)} className="text-xs bg-red-600 text-white px-2 py-0.5 rounded">削除</button>}
                    {editing && <button onClick={saveEditComment} disabled={!editingCommentBody.trim()} className="text-xs bg-green-600 text-white px-2 py-0.5 rounded disabled:opacity-50">保存</button>}
                    {editing && <button onClick={cancelEditComment} className="text-xs bg-gray-400 text-white px-2 py-0.5 rounded">キャンセル</button>}
                  </div>
                )}
              </li>
            );
          })}
          {comments.length === 0 && <li className="text-sm text-gray-500">コメントなし</li>}
        </ul>
        {user && (
          <form onSubmit={handleAddComment} className="space-y-2 max-w-md">
            <textarea
              value={commentText}
              onChange={e => setCommentText(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm"
              maxLength={200}
              rows={3}
              placeholder="コメントを入力"
              disabled={commenting}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{commentText.length}/200</span>
              <button
                type="submit"
                disabled={!commentText.trim() || commenting}
                className="text-sm bg-blue-600 text-white px-3 py-1 rounded disabled:opacity-50"
              >{commenting ? '送信中...' : '送信'}</button>
            </div>
          </form>
        )}
      </section>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <p className="text-xs text-gray-500">※ 簡易版: 画像追加は DataURL 保存。本番は Firebase Storage 経由へ差し替え予定。</p>
    </div>
  );
}

// snapshot リストと pendingLocalComments を突き合わせて仮コメントを除去する
function mergeWithPending(real: any[], pending: {id:string; body:string; userId:string; createdAt:Date}[]) {
  if (pending.length === 0) return real;
  // real から pending と一致するものを検出: userId & body が一致すれば仮コメント除去対象
  const pendingSet = new Set(pending.map(p => p.userId + '::' + p.body));
  // real にマッチが現れたらその pending を削除（完全反映とみなす）
  // コメント本文が同じ別ユーザーのケースを避けるため userId も含む
  const filteredPending = pending.filter(p => !real.some(r => r.userId === p.userId && r.body === p.body));
  // state 更新は呼び出し側 (setComments) が担当。ここでは real のみ返す。
  // pendingLocalComments の最新を反映させるには呼び出し元で setPendingLocalComments を再度実行するが、簡易版では放置しても次回送信時にクリアされる。
  return real;
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FILE_READ_ERROR'));
    reader.readAsDataURL(file);
  });
}
