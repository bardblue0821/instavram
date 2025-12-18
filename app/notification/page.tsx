"use client";
import React, { useEffect, useState } from 'react';
import { useAuthUser } from '../../lib/hooks/useAuthUser';
import { listNotifications, markAllRead, subscribeNotifications } from '../../lib/repos/notificationRepo';
import { getUser } from '../../lib/repos/userRepo';
import { getFriendStatus, acceptFriend, cancelFriendRequest } from '../../lib/repos/friendRepo';
import { useToast } from '../../components/ui/Toast';
import Link from 'next/link';

interface NotificationRow {
  id: string;
  type: string;
  actorId: string;
  userId: string; // 受信者
  message: string;
  createdAt?: any;
  readAt?: any;
  albumId?: string;
  commentId?: string;
  imageId?: string;
  friendRequestId?: string;
}

export default function NotificationsPage(){
  const { user } = useAuthUser();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [actors, setActors] = useState<Record<string, { handle?: string|null; displayName?: string|null }>>({});
  const [friendState, setFriendState] = useState<Record<string, 'pending'|'accepted'|'none'>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);
  const { show } = useToast();

  // フレンド申請承認/拒否アクション（即時UI反映）
  async function handleAccept(actorId: string){
    if (!user) return;
    try {
      await acceptFriend(actorId, user.uid); // 送信元(actorId) -> 受信者(user.uid)
      setFriendState(prev => ({ ...prev, [actorId]: 'accepted' }));
      show({ message: 'フレンド申請を承認しました', variant: 'success' });
    } catch (e:any){
      show({ message: '承認に失敗: ' + (e.message||'error'), variant: 'error' });
    }
  }
  async function handleDecline(actorId: string){
    if (!user) return;
    try {
      await cancelFriendRequest(actorId, user.uid);
      setFriendState(prev => ({ ...prev, [actorId]: 'none' }));
      show({ message: 'フレンド申請を拒否しました', variant: 'info' });
      // 既存通知は残すが状態は更新。必要なら rows から除去も検討。
    } catch (e:any){
      show({ message: '拒否に失敗: ' + (e.message||'error'), variant: 'error' });
    }
  }

  useEffect(() => {
    let active = true;
    if (!user){ setRows([]); setLoading(false); return; }
    (async () => {
      try {
        setLoading(true); setError(null);
        const initial = await listNotifications(user.uid, 100);
        if (!active) return;
        setRows(initial as NotificationRow[]);
        // 全通知の actor 情報を取得（重複排除）。友達申請はステータスも取得。
        const allActorIds = Array.from(new Set(initial.map(r => r.actorId))).filter(a => !!a);
        const actorProfiles: Record<string, { handle?: string|null; displayName?: string|null }> = {};
        for (const aid of allActorIds) {
          try {
            const u = await getUser(aid);
            actorProfiles[aid] = { handle: u?.handle || null, displayName: u?.displayName || null };
            // friend_request ステータスのみ取得
            if (user && aid) {
              const st = await getFriendStatus(aid, user.uid);
              friendState[aid] = st === 'accepted' ? 'accepted' : (st === 'pending' ? 'pending' : 'none');
            }
          } catch {}
        }
        if (active) {
          setActors(actorProfiles);
          setFriendState({ ...friendState });
        }
        // 既読化（未読のみ）
        markAllRead(user.uid).catch(()=>{});
        const unsub = await subscribeNotifications(user.uid, (list) => {
          if (!active) return;
          setRows(list as NotificationRow[]);
          // 差分で追加された actor を取得
          const newActors = Array.from(new Set(list.map(r => r.actorId))).filter(a => !actors[a]);
          if (newActors.length) {
            (async () => {
              const addProfiles: Record<string, { handle?: string|null; displayName?: string|null }> = {};
              for (const aid of newActors) {
                try {
                  const u = await getUser(aid);
                  addProfiles[aid] = { handle: u?.handle || null, displayName: u?.displayName || null };
                  const st = await getFriendStatus(aid, user.uid);
                  friendState[aid] = st === 'accepted' ? 'accepted' : (st === 'pending' ? 'pending' : 'none');
                } catch {}
              }
              if (active) {
                setActors(prev => ({ ...prev, ...addProfiles }));
                setFriendState({ ...friendState });
              }
            })();
          }
        });
        return () => unsub();
      } catch(e:any){
        if (!active) return;
        setError(e.message || 'failed');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active=false; };
  }, [user]);

  if (!user) return <div className="max-w-3xl mx-auto p-6"><p className="text-sm text-gray-600">ログインしてください。</p></div>;

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-4">通知</h1>
      {loading && <p className="text-sm text-gray-500">読み込み中...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-gray-500">通知はありません。</p>}
      <ul className="divide-y divide-base">
        {rows.map(r => {
          const isUnread = !r.readAt;
          const targetHref = r.albumId ? `/album/${r.albumId}` : undefined;
          const actor = actors[r.actorId];
          const fState = r.type === 'friend_request' ? friendState[r.actorId] : undefined;
          const canActOnFriend = r.type === 'friend_request' && fState === 'pending';
          return (
            <li key={r.id} className={`py-3 text-sm ${isUnread ? 'bg-yellow-50 dark:bg-gray-800' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p>{r.message}</p>
                  {r.type === 'friend_request' && (
                    <div className="text-xs text-gray-700 flex flex-wrap items-center gap-2">
                      <span>申請元: {formatActor(actor, r.actorId)}</span>
                      {canActOnFriend && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleAccept(r.actorId)}
                            className="rounded bg-blue-600 px-2 py-0.5 text-[11px] text-white"
                          >承認</button>
                          <button
                            type="button"
                            onClick={() => handleDecline(r.actorId)}
                            className="rounded bg-red-600 px-2 py-0.5 text-[11px] text-white"
                          >拒否</button>
                        </>
                      )}
                      {fState === 'accepted' && <span className="text-green-600">承認済み</span>}
                      {fState === 'none' && <span className="text-gray-500">状態: 不明</span>}
                    </div>
                  )}
                  {r.type !== 'friend_request' && actor && (
                    <p className="text-xs text-gray-600">発信者: {formatActor(actor, r.actorId)}</p>
                  )}
                  {r.albumId && <Link href={targetHref!} className="text-xs link-accent">アルバムを見る</Link>}
                  <p className="text-[11px] text-gray-500">{formatDate(r.createdAt)}</p>
                </div>
                <span className="text-[10px] uppercase tracking-wide text-gray-400">{r.type}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

async function doAccept(actorId: string){
  try {
    const { auth } = await import('../../lib/firebase');
    const me = auth.currentUser?.uid;
    if (!me) return;
    await acceptFriend(actorId, me);
    // 状態更新: friendState はクロージャ内なので再取得が必要 (簡易リフレッシュで十分)
    // トースト表示
    const { useToast } = await import('../../components/ui/Toast');
  } catch {}
}

async function doDecline(actorId: string){
  try {
    const { auth } = await import('../../lib/firebase');
    const me = auth.currentUser?.uid;
    if (!me) return;
    await cancelFriendRequest(actorId, me);
    // トーストはページ側の show を使うため noop (上記実装では直接は使えない)
  } catch {}
}

function formatDate(v:any){
  try {
    if (!v) return '';
    if (typeof v.toDate === 'function') v = v.toDate();
    const d = v instanceof Date ? v : new Date(v);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
}
function pad(n:number){ return n<10 ? '0'+n : ''+n; }

function formatActor(a?: { handle?: string|null; displayName?: string|null }, fallbackId?: string){
  const handle = (a?.handle || '').trim();
  const name = (a?.displayName || '').trim();
  if (name && handle) return `${name} @${handle}`;
  if (name) return name;
  if (handle) return `@${handle}`;
  return fallbackId || '';
}
