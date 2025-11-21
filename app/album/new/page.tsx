"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthUser } from '../../../lib/hooks/useAuthUser';
import { createAlbum } from '../../../lib/repos/albumRepo';

export default function NewAlbumPage() {
  const { user } = useAuthUser();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [placeUrl, setPlaceUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!user) {
    return <div className="text-sm text-gray-600">ログインが必要です。</div>;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
  // user チェック済みのため non-null assertion
  const ref = await createAlbum(user!.uid, { title: title || undefined, placeUrl: placeUrl || undefined });
      router.push(`/album/${ref.id}`); // 詳細ページ未作成：後で対応
    } catch (err: any) {
      setError(err.message || '作成に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">新規アルバム</h1>
      <form onSubmit={handleSubmit} className="space-y-4 max-w-lg" aria-live="polite">
        <div>
          <label className="block text-sm font-medium mb-1">タイトル (任意)</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="例: VRChat 集合写真"
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">撮影場所URL (任意)</label>
          <input
            value={placeUrl}
            onChange={e => setPlaceUrl(e.target.value)}
            className="w-full border rounded px-3 py-2"
            placeholder="https://vrc.world/..."
            disabled={loading}
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button
          type="submit"
          className="bg-blue-600 text-white rounded px-4 py-2 disabled:opacity-50"
          disabled={loading}
        >{loading ? '作成中...' : '作成'}</button>
      </form>
      <p className="mt-4 text-xs text-gray-500">画像アップロードやコメント機能は後で詳細ページに統合予定。</p>
    </div>
  );
}
