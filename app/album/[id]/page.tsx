"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { COL } from '../../../lib/paths';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useAuthUser } from '../../../lib/hooks/useAuthUser';
import { addImage, listImages, deleteImage } from '../../../lib/repos/imageRepo';
import { addComment, updateComment, deleteComment } from '../../../lib/repos/commentRepo';
import { updateAlbum } from '../../../lib/repos/albumRepo';
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
        const cQ = query(collection(db, COL.comments), where('albumId', '==', albumId));
        const cSnap = await getDocs(cQ);
        const comm: any[] = [];
        cSnap.forEach(d => comm.push({ id: d.id, ...d.data() }));
        if (active) {
          // createdAt がない古いデータでも並び替えが壊れないようにフォールバック
          setImages(imgs.sort((a:any,b:any)=> ((b.createdAt?.seconds||b.createdAt||0) - (a.createdAt?.seconds||a.createdAt||0))));
          setComments(comm.sort((a,b)=> (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));
        }
      } catch (e:any) {
        if (active) setError(e.message || '取得に失敗しました');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [albumId]);

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
      const cQ = query(collection(db, COL.comments), where('albumId', '==', albumId));
      const cSnap = await getDocs(cQ);
      const comm: any[] = [];
      cSnap.forEach(d => comm.push({ id: d.id, ...d.data() }));
      setComments(comm);
      cancelEditComment();
    } catch (e:any) {
      setError(translateError(e));
    }
  }
  async function handleDeleteComment(id: string) {
    if (!confirm('コメントを削除しますか？')) return;
    try {
      await deleteComment(id);
      const cQ = query(collection(db, COL.comments), where('albumId', '==', albumId));
      const cSnap = await getDocs(cQ);
      const comm: any[] = [];
      cSnap.forEach(d => comm.push({ id: d.id, ...d.data() }));
      setComments(comm);
    } catch (e:any) {
      setError(translateError(e));
    }
  }

  async function handleAddComment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !albumId || !commentText.trim()) return;
    setCommenting(true);
    setError(null);
    try {
      await addComment(albumId, user.uid, commentText.trim());
      setCommentText('');
      const cQ = query(collection(db, COL.comments), where('albumId', '==', albumId));
      const cSnap = await getDocs(cQ);
      const comm: any[] = [];
      cSnap.forEach(d => comm.push(d.data()));
      setComments(comm);
    } catch (e:any) {
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

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FILE_READ_ERROR'));
    reader.readAsDataURL(file);
  });
}
