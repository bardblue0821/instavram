"use client";
import React, { useEffect, useState } from 'react';
import { useAuthUser } from '../../lib/hooks/useAuthUser';
import { listNotifications, markAllRead, subscribeNotifications } from '../../lib/repos/notificationRepo';
import Link from 'next/link';

interface NotificationRow {
  id: string;
  type: string;
  actorId: string;
  message: string;
  createdAt?: any;
  readAt?: any;
  albumId?: string;
  commentId?: string;
  imageId?: string;
}

export default function NotificationsPage(){
  const { user } = useAuthUser();
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string|null>(null);

  useEffect(() => {
    let active = true;
    if (!user){ setRows([]); setLoading(false); return; }
    (async () => {
      try {
        setLoading(true); setError(null);
        const initial = await listNotifications(user.uid, 100);
        if (!active) return;
        setRows(initial as NotificationRow[]);
        // 既読化（未読のみ）
        markAllRead(user.uid).catch(()=>{});
        const unsub = await subscribeNotifications(user.uid, (list) => {
          if (!active) return;
          setRows(list as NotificationRow[]);
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
      <ul className="space-y-2">
        {rows.map(r => {
          const isUnread = !r.readAt;
          const targetHref = r.albumId ? `/album/${r.albumId}` : undefined;
          return (
            <li key={r.id} className={`border rounded p-3 text-sm bg-white dark:bg-gray-900 ${isUnread ? 'bg-yellow-50 dark:bg-gray-800' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <p>{r.message}</p>
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

function formatDate(v:any){
  try {
    if (!v) return '';
    if (typeof v.toDate === 'function') v = v.toDate();
    const d = v instanceof Date ? v : new Date(v);
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch { return ''; }
}
function pad(n:number){ return n<10 ? '0'+n : ''+n; }
