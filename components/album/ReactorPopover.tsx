import React from "react";
import type { Reactor } from "../../lib/repos/reactionRepo";

export interface ReactorPopoverProps {
  emoji: string;
  users?: Reactor[];
  loading?: boolean;
}

export default function ReactorPopover({ emoji, users, loading }: ReactorPopoverProps) {
  return (
    <div className="absolute left-0 top-full mt-1 w-64 rounded border border-base bg-page shadow-lg z-50">
      <div className="p-2">
        <p className="text-[11px] fg-subtle mb-1">このリアクションをした人</p>
        {loading && <p className="text-xs fg-subtle">読み込み中...</p>}
        {!loading && (
          (users && users.length > 0) ? (
            <ul className="max-h-64 overflow-auto divide-y divide-base">
              {users.map((u) => (
                <li key={u.uid}>
                  <a href={`/user/${u.handle || u.uid}`} className="flex items-center gap-2 px-2 py-1 hover-surface-alt">
                    {u.iconURL ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.iconURL} alt="" className="h-5 w-5 rounded-full object-cover" />
                    ) : (
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-full surface-alt text-[10px] fg-muted">{u.displayName?.[0] || '?'}</span>
                    )}
                    <span className="text-sm font-medium">{u.displayName}</span>
                    <span className="text-[11px] fg-subtle">@{u.handle || u.uid.slice(0,6)}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs fg-subtle">まだいません</p>
          )
        )}
      </div>
    </div>
  );
}
