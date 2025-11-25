"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuthUser } from '../../../lib/hooks/useAuthUser';
import { getUserByHandle } from '../../../lib/repos/userRepo';
import { listAlbumsByOwner } from '../../../lib/repos/albumRepo';
import { listAlbumIdsByUploader } from '../../../lib/repos/imageRepo';
import { listCommentsByUser } from '../../../lib/repos/commentRepo';
import { getAlbum } from '../../../lib/repos/albumRepo';
import { getFriendStatus, sendFriendRequest, acceptFriend, cancelFriendRequest, removeFriend } from '../../../lib/repos/friendRepo';
import { isWatched, addWatch, removeWatch } from '../../../lib/repos/watchRepo';
import { translateError } from '../../../lib/errors';

export default function ProfilePage() {
  const params = useParams();
  const handleParam = params?.id as string | undefined; // /user/{handle} のみ許可
  const { user } = useAuthUser();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [friendState, setFriendState] = useState<'none'|'sent'|'received'|'accepted'>('none');
  const [busy, setBusy] = useState(false);
  const [watching, setWatching] = useState(false);
  const [watchBusy, setWatchBusy] = useState(false);
  // プロフィール拡張データ
  const [ownAlbums, setOwnAlbums] = useState<any[] | null>(null);
  const [joinedAlbums, setJoinedAlbums] = useState<any[] | null>(null);
  const [userComments, setUserComments] = useState<any[] | null>(null);
  const [stats, setStats] = useState<{ ownCount: number; joinedCount: number; commentCount: number } | null>(null);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [extraError, setExtraError] = useState<string | null>(null);

  useEffect(() => {
    if (!handleParam) return;
    let active = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const p = await getUserByHandle(handleParam);
        if (active) setProfile(p);
        let watchedFlag = false;
        if (user && p && p.uid !== user.uid) {
          const forward = await getFriendStatus(user.uid, p.uid);
          const backward = await getFriendStatus(p.uid, user.uid);
          let st: 'none'|'sent'|'received'|'accepted' = 'none';
          if (forward === 'accepted' || backward === 'accepted') st = 'accepted';
          else if (forward === 'pending') st = 'sent';
          else if (backward === 'pending') st = 'received';
          if (active) setFriendState(st);
          watchedFlag = await isWatched(user.uid, p.uid);
        } else {
          if (active) setFriendState('none');
        }
        if (active) setWatching(watchedFlag);
      } catch (e:any) {
        if (active) setError(translateError(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [handleParam, user]);

  // 拡張情報ロード
  useEffect(() => {
    if (!profile?.uid) return;
    let active = true;
    (async () => {
      setLoadingExtra(true); setExtraError(null);
      try {
        const own = await listAlbumsByOwner(profile.uid);
        const joinedIds = await listAlbumIdsByUploader(profile.uid);
        const filteredIds = joinedIds.filter(id => !own.some(a => a.id === id));
        const joined = await Promise.all(filteredIds.map(id => getAlbum(id)));
        const comments = await listCommentsByUser(profile.uid, 50);
        if (active) {
          setOwnAlbums(own);
          setJoinedAlbums(joined.filter(a => !!a));
          setUserComments(comments);
          setStats({
            ownCount: own.length,
            joinedCount: filteredIds.length,
            commentCount: comments.length,
          });
        }
      } catch (e:any) {
        if (active) setExtraError(translateError(e));
      } finally {
        if (active) setLoadingExtra(false);
      }
    })();
    return () => { active = false; };
  }, [profile?.uid]);

  async function doSend() {
    if (!user || !profile?.uid) return;
    setBusy(true); setError(null);
    try {
      await sendFriendRequest(user.uid, profile.uid);
      setFriendState('sent');
    } catch (e:any) { setError(translateError(e)); }
    finally { setBusy(false); }
  }
  async function doAccept() {
    if (!user || !profile?.uid) return;
    setBusy(true); setError(null);
    try {
      await acceptFriend(profile.uid, user.uid);
      setFriendState('accepted');
    } catch (e:any) { setError(translateError(e)); }
    finally { setBusy(false); }
  }
  async function doCancel() {
    if (!user || !profile?.uid) return;
    setBusy(true); setError(null);
    try {
      await cancelFriendRequest(user.uid, profile.uid);
      setFriendState('none');
    } catch (e:any) { setError(translateError(e)); }
    finally { setBusy(false); }
  }
  async function doRemove() {
    if (!user || !profile?.uid) return;
    if (!confirm('フレンドを解除しますか？')) return;
    setBusy(true); setError(null);
    try {
      await removeFriend(user.uid, profile.uid);
      setFriendState('none');
    } catch (e:any) { setError(translateError(e)); }
    finally { setBusy(false); }
  }

  async function doWatchToggle() {
    if (!user || !profile?.uid || user.uid === profile.uid) return;
    setWatchBusy(true); setError(null);
    try {
      if (watching) {
        await removeWatch(user.uid, profile.uid);
        setWatching(false);
      } else {
        await addWatch(user.uid, profile.uid);
        setWatching(true);
      }
    } catch (e:any) {
      setError(translateError(e));
    } finally {
      setWatchBusy(false);
    }
  }

  if (loading) return <div className="p-4 text-sm text-gray-500">読み込み中...</div>;
  if (!profile) return <div className="p-4 text-sm text-gray-600">ユーザーが見つかりません (handle)</div>;

  const isMe = user && profile && user.uid === profile.uid;

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">プロフィール</h1>
    <p className="text-sm text-gray-700">UID: {profile.uid}</p>
    {profile.handle && <p className="text-sm text-gray-600">@{profile.handle}</p>}
    {profile.displayName && <p className="text-lg">{profile.displayName}</p>}
        {profile.bio && <p className="text-sm whitespace-pre-line">{profile.bio}</p>}
      </header>
      {!isMe && user && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">フレンド</h2>
          {friendState === 'none' && (
            <button disabled={busy} onClick={doSend} className="btn-accent text-sm disabled:opacity-50">フレンド申請</button>
          )}
          {friendState === 'sent' && (
            <div className="flex gap-2 items-center">
              <span className="text-sm text-gray-600">申請中...</span>
              <button disabled={busy} onClick={doCancel} className="bg-gray-500 text-white text-xs px-2 py-1 rounded disabled:opacity-50">キャンセル</button>
            </div>
          )}
          {friendState === 'received' && (
            <div className="flex gap-2">
              <button disabled={busy} onClick={doAccept} className="btn-accent text-sm disabled:opacity-50">承認</button>
              <button disabled={busy} onClick={doCancel} className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-50">拒否</button>
            </div>
          )}
          {friendState === 'accepted' && (
            <div className="flex gap-3 items-center">
              <span className="text-sm text-green-700">フレンドです</span>
              <button disabled={busy} onClick={doRemove} className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50">解除</button>
            </div>
          )}
          <div className="pt-2 border-t mt-3">
            <h3 className="text-sm font-medium mb-1">ウォッチ</h3>
            {!watching && (
              <button disabled={watchBusy} onClick={doWatchToggle} className="btn-accent text-xs disabled:opacity-50">ウォッチ</button>
            )}
            {watching && (
              <button disabled={watchBusy} onClick={doWatchToggle} className="bg-gray-600 text-white text-xs px-2 py-1 rounded disabled:opacity-50">ウォッチ解除</button>
            )}
          </div>
          {!user && <p className="text-sm text-gray-600">ログインすると操作できます</p>}
        </section>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-lg font-medium">活動概要</h2>
        {loadingExtra && <p className="text-sm text-gray-500">読み込み中...</p>}
        {extraError && <p className="text-sm text-red-600">{extraError}</p>}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded bg-gray-100">
              <p className="text-xs text-gray-600">作成アルバム</p>
              <p className="text-lg font-semibold">{stats.ownCount}</p>
            </div>
            <div className="p-3 rounded bg-gray-100">
              <p className="text-xs text-gray-600">参加アルバム</p>
              <p className="text-lg font-semibold">{stats.joinedCount}</p>
            </div>
            <div className="p-3 rounded bg-gray-100">
              <p className="text-xs text-gray-600">コメント</p>
              <p className="text-lg font-semibold">{stats.commentCount}</p>
            </div>
            {/* いいねしたアルバム数は後工程で */}
          </div>
        )}
        <div className="space-y-6 mt-4">
          <div>
            <h3 className="font-medium mb-2">作成アルバム</h3>
            {!ownAlbums && <p className="text-sm text-gray-500">-</p>}
            {ownAlbums && ownAlbums.length === 0 && <p className="text-sm text-gray-500">まだアルバムがありません</p>}
            <ul className="space-y-2">
              {ownAlbums && ownAlbums.map(a => (
                <li key={a.id} className="p-2 border rounded">
                  <a href={`/album/${a.id}`} className="link-accent text-sm font-medium">{a.title || '無題'}</a>
                  <p className="text-xs text-gray-500">{a.createdAt?.toDate?.().toLocaleString?.() || ''}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">参加アルバム</h3>
            {!joinedAlbums && <p className="text-sm text-gray-500">-</p>}
            {joinedAlbums && joinedAlbums.length === 0 && <p className="text-sm text-gray-500">参加アルバムはまだありません</p>}
            <ul className="space-y-2">
              {joinedAlbums && joinedAlbums.map((a: any, i: number) => (
                <li key={i} className="p-2 border rounded">
                  <a href={`/album/${a.id}`} className="link-accent text-sm font-medium">{a.title || '無題'}</a>
                  <p className="text-xs text-gray-500">{a.createdAt?.toDate?.().toLocaleString?.() || ''}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">投稿コメント (最大50件)</h3>
            {!userComments && <p className="text-sm text-gray-500">-</p>}
            {userComments && userComments.length === 0 && <p className="text-sm text-gray-500">コメントはまだありません</p>}
            <ul className="space-y-2">
              {userComments && userComments.map(c => (
                <li key={c.id} className="p-2 border rounded text-sm">
                  <p className="whitespace-pre-line">{c.body}</p>
                  <a href={`/album/${c.albumId}`} className="text-xs link-accent">アルバムへ</a>
                  <p className="text-[10px] text-gray-500">{c.createdAt?.toDate?.().toLocaleString?.() || ''}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}
