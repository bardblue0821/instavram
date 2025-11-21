"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuthUser } from '../../../lib/hooks/useAuthUser';
import { getUser } from '../../../lib/repos/userRepo';
import { getFriendStatus, sendFriendRequest, acceptFriend, cancelFriendRequest, removeFriend } from '../../../lib/repos/friendRepo';
import { isWatched, addWatch, removeWatch } from '../../../lib/repos/watchRepo';
import { translateError } from '../../../lib/errors';

export default function ProfilePage() {
  const params = useParams();
  const profileUid = params?.id as string | undefined;
  const { user } = useAuthUser();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [friendState, setFriendState] = useState<'none'|'sent'|'received'|'accepted'>('none');
  const [busy, setBusy] = useState(false);
  const [watching, setWatching] = useState(false);
  const [watchBusy, setWatchBusy] = useState(false);

  useEffect(() => {
    if (!profileUid) return;
    let active = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const p = await getUser(profileUid);
        if (active) setProfile(p);
        let watchedFlag = false;
        if (user && profileUid !== user.uid) {
          const forward = await getFriendStatus(user.uid, profileUid); // 自分 -> 相手
          const backward = await getFriendStatus(profileUid, user.uid); // 相手 -> 自分
          let st: 'none'|'sent'|'received'|'accepted' = 'none';
          if (forward === 'accepted' || backward === 'accepted') st = 'accepted';
          else if (forward === 'pending') st = 'sent';
          else if (backward === 'pending') st = 'received';
          if (active) setFriendState(st);
          watchedFlag = await isWatched(user.uid, profileUid);
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
  }, [profileUid, user]);

  async function doSend() {
    if (!user || !profileUid) return;
    setBusy(true); setError(null);
    try {
      await sendFriendRequest(user.uid, profileUid);
      setFriendState('sent');
    } catch (e:any) { setError(translateError(e)); }
    finally { setBusy(false); }
  }
  async function doAccept() {
    if (!user || !profileUid) return;
    setBusy(true); setError(null);
    try {
      await acceptFriend(profileUid, user.uid); // 申請者=profileUid, 受信者=user.uid
      setFriendState('accepted');
    } catch (e:any) { setError(translateError(e)); }
    finally { setBusy(false); }
  }
  async function doCancel() {
    if (!user || !profileUid) return;
    setBusy(true); setError(null);
    try {
      await cancelFriendRequest(user.uid, profileUid);
      setFriendState('none');
    } catch (e:any) { setError(translateError(e)); }
    finally { setBusy(false); }
  }
  async function doRemove() {
    if (!user || !profileUid) return;
    if (!confirm('フレンドを解除しますか？')) return;
    setBusy(true); setError(null);
    try {
      await removeFriend(user.uid, profileUid);
      setFriendState('none');
    } catch (e:any) { setError(translateError(e)); }
    finally { setBusy(false); }
  }

  async function doWatchToggle() {
    if (!user || !profileUid || user.uid === profileUid) return;
    setWatchBusy(true); setError(null);
    try {
      if (watching) {
        await removeWatch(user.uid, profileUid);
        setWatching(false);
      } else {
        await addWatch(user.uid, profileUid);
        setWatching(true);
      }
    } catch (e:any) {
      setError(translateError(e));
    } finally {
      setWatchBusy(false);
    }
  }

  if (loading) return <div className="p-4 text-sm text-gray-500">読み込み中...</div>;
  if (!profile) return <div className="p-4 text-sm text-gray-600">ユーザーが見つかりません</div>;

  const isMe = user && user.uid === profileUid;

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">プロフィール</h1>
        <p className="text-sm text-gray-700">UID: {profile.uid}</p>
        {profile.displayName && <p className="text-lg">{profile.displayName}</p>}
        {profile.bio && <p className="text-sm whitespace-pre-line">{profile.bio}</p>}
      </header>
      {!isMe && user && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">フレンド</h2>
          {friendState === 'none' && (
            <button disabled={busy} onClick={doSend} className="bg-blue-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50">フレンド申請</button>
          )}
          {friendState === 'sent' && (
            <div className="flex gap-2 items-center">
              <span className="text-sm text-gray-600">申請中...</span>
              <button disabled={busy} onClick={doCancel} className="bg-gray-500 text-white text-xs px-2 py-1 rounded disabled:opacity-50">キャンセル</button>
            </div>
          )}
          {friendState === 'received' && (
            <div className="flex gap-2">
              <button disabled={busy} onClick={doAccept} className="bg-green-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50">承認</button>
              <button disabled={busy} onClick={doCancel} className="bg-red-600 text-white text-sm px-3 py-1 rounded disabled:opacity-50">拒否</button>
            </div>
          )}
          {friendState === 'accepted' && (
            <div className="flex gap-3 items-center">
              <span className="text-sm text-green-700">フレンドです</span>
              <button disabled={busy} onClick={doRemove} className="bg-red-600 text-white text-xs px-2 py-1 rounded disabled:opacity-50">解除</button>
            </div>
          )}
          <div className="pt-2 border-t mt-3">
            <h3 className="text-sm font-medium mb-1">ウォッチ</h3>
            {!watching && (
              <button disabled={watchBusy} onClick={doWatchToggle} className="bg-indigo-600 text-white text-xs px-2 py-1 rounded disabled:opacity-50">ウォッチ</button>
            )}
            {watching && (
              <button disabled={watchBusy} onClick={doWatchToggle} className="bg-gray-600 text-white text-xs px-2 py-1 rounded disabled:opacity-50">ウォッチ解除</button>
            )}
          </div>
          {!user && <p className="text-sm text-gray-600">ログインすると操作できます</p>}
        </section>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
