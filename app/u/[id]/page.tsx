"use client";
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { getUser } from '../../../lib/repos/userRepo';

export default function UserProfilePage() {
  const params = useParams();
  const id = params?.id as string | undefined;
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const u = await getUser(id);
        if (active) setUser(u || null);
      } catch (e: any) {
        if (active) setError(e.message || '取得失敗');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [id]);

  if (loading) return <div className="text-sm text-gray-500">読み込み中...</div>;
  if (error) return <div className="text-sm text-red-600">{error}</div>;
  if (!user) return <div className="text-sm text-gray-600">ユーザーが見つかりません</div>;

  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">{user.displayName}</h1>
      {user.bio && <p className="mb-4 text-sm text-gray-700">{user.bio}</p>}
      <p className="text-xs text-gray-500">UID: {user.uid}</p>
      {/* 後で: アルバム一覧 / 参加アルバム / コメント一覧 をここにタブで追加 */}
    </div>
  );
}
