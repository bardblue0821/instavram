"use client";
import React, { useState } from 'react';
import { useAuthUser } from '../lib/hooks/useAuthUser';
import { createAlbumWithImages, AlbumCreateProgress } from '../lib/services/createAlbumWithImages';
import { useRouter } from 'next/navigation';
import { translateError } from '../lib/errors';

interface Props { onCreated?: (albumId: string) => void }

export default function AlbumCreateModal({ onCreated }: Props) {
  const { user } = useAuthUser();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [placeUrl, setPlaceUrl] = useState('');
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [fileProgress, setFileProgress] = useState<AlbumCreateProgress[]>([]);
  const [loading, setLoading] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files || []);
    if (list.length > 4) {
      setError('画像は最大4枚までです');
      return;
    }
    setFiles(list);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setError('ログインが必要です');
      return;
    }
    setError(null);
    setLoading(true);
    setProgress(0);
    try {
      // 逐次進捗: files.length が0ならそのまま
      const albumId = await createAlbumWithImages(
        user.uid,
        { title: title || undefined, placeUrl: placeUrl || undefined, firstComment: comment || undefined },
        files,
        (p) => {
          setProgress(p.overallPercent);
          setFileProgress(prev => {
            const copy = [...prev];
            copy[p.fileIndex] = p;
            return copy;
          });
        }
      );
      setProgress(100);
      if (onCreated) onCreated(albumId);
      router.push(`/album/${albumId}`); // 詳細ページは後で
    } catch (err: any) {
      setError(translateError(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h2 className="text-xl font-semibold mb-4">アルバム作成</h2>
      {!user && <p className="text-sm text-gray-600 mb-4">ログインすると作成できます。</p>}
      <form onSubmit={handleSubmit} className="space-y-4" aria-live="polite">
        <div>
          <label className="block text-sm font-medium mb-1">タイトル (任意)</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full border rounded px-3 py-2"
            disabled={loading || !user}
            placeholder="なんのアルバム？"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">撮影場所URL (任意)</label>
          <input
            value={placeUrl}
            onChange={e => setPlaceUrl(e.target.value)}
            className="w-full border rounded px-3 py-2"
            disabled={loading || !user}

            placeholder="https://vrchat.com/..."
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">初回コメント (200文字以内 任意)</label>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm"
            disabled={loading || !user}
            maxLength={200}
            rows={3}
            placeholder="どうだった？"
          />
          <p className="text-xs text-gray-500 text-right">{comment.length}/200</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" aria-label="画像選択">画像 (最大4枚)</label>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            disabled={loading || !user}
          />
          {files.length > 0 && (
            <ul className="mt-2 text-xs text-gray-600 list-disc pl-5">
              {files.map(f => <li key={f.name}>{f.name}</li>)}
            </ul>
          )}
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {loading && (
          <div role="status" className="space-y-2">
            <p className="text-sm text-blue-600">アップロード中... {progress}%</p>
            <ul className="text-xs text-gray-600 space-y-1">
              {fileProgress.map((fp,i)=>(
                <li key={i}>
                  画像{i+1}: {fp.percent}% {fp.state==='error' && <span className="text-red-600">(失敗 {fp.error})</span>} {fp.state==='success' && <span className="text-green-600">OK</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        <button
          type="submit"
            className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
          disabled={loading || !user}
        >{loading ? '処理中...' : '作成'}</button>
      </form>
    </div>
  );
}
