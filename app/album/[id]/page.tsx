"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { db } from '../../../lib/firebase';
import { COL } from '../../../lib/paths';
import { doc, getDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { useAuthUser } from '../../../lib/hooks/useAuthUser';
import { addImage } from '../../../lib/repos/imageRepo';
import { addComment } from '../../../lib/repos/commentRepo';
import { translateError } from '../../../lib/errors';

export default function AlbumDetailPage() {
  const params = useParams();
  const albumId = params?.id as string | undefined;
  const { user } = useAuthUser();
  const [album, setAlbum] = useState<any>(null);
  const [images, setImages] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
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
        if (albumSnap.exists()) setAlbum(albumSnap.data());
        const imgQ = query(collection(db, COL.albumImages), where('albumId', '==', albumId));
        const imgSnap = await getDocs(imgQ);
        const imgs: any[] = [];
        imgSnap.forEach(d => imgs.push(d.data()));
        const cQ = query(collection(db, COL.comments), where('albumId', '==', albumId));
        const cSnap = await getDocs(cQ);
        const comm: any[] = [];
        cSnap.forEach(d => comm.push(d.data()));
        if (active) {
          setImages(imgs.sort((a,b)=> (b.createdAt?.seconds||0)-(a.createdAt?.seconds||0)));
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
      // 再読込
      const imgQ = query(collection(db, COL.albumImages), where('albumId', '==', albumId));
      const imgSnap = await getDocs(imgQ);
      const imgs: any[] = [];
      imgSnap.forEach(d => imgs.push(d.data()));
      setImages(imgs);
      setFile(null);
    } catch (e:any) {
      setError(translateError(e));
    } finally {
      setUploading(false);
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold mb-2">アルバム詳細</h1>
        <p className="text-sm text-gray-700">ID: {album.id}</p>
        {album.title && <p className="mt-1 text-lg">{album.title}</p>}
        {album.placeUrl && <a href={album.placeUrl} target="_blank" rel="noreferrer" className="text-blue-600 text-sm underline">撮影場所</a>}
      </div>
      <section>
        <h2 className="text-lg font-medium mb-2">画像一覧 ({images.length})</h2>
        {images.length === 0 && <p className="text-sm text-gray-500">まだ画像がありません</p>}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {images.map((img, i) => (
            <figure key={i} className="border rounded p-1">
              {/* DataURL または Storage URL */}
              <img src={img.url} alt={img.id || 'image'} className="w-full h-auto object-cover" />
              <figcaption className="text-[10px] text-gray-500 mt-1">uploader: {img.uploaderId}</figcaption>
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
          {comments.map((c, i) => (
            <li key={i} className="border rounded px-3 py-2 text-sm">
              <p className="whitespace-pre-line break-words">{c.body}</p>
              <p className="text-[10px] text-gray-500 mt-1">by {c.userId}</p>
            </li>
          ))}
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
