"use client";
import React from "react";

export type FriendState = "none" | "sent" | "received" | "accepted";

interface FriendActionsProps {
  state: FriendState;
  busy?: boolean;
  onSend?: () => void;
  onCancel?: () => void;
  onAccept?: () => void;
  onRemove?: () => void;
}

export default function FriendActions({ state, busy = false, onSend, onCancel, onAccept, onRemove }: FriendActionsProps) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-medium">フレンド</h2>
      {state === "none" && (
        <button disabled={busy} onClick={onSend} className="btn-accent text-sm disabled:opacity-50">
          フレンド申請
        </button>
      )}
      {state === "sent" && (
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-600">申請中...</span>
          <button disabled={busy} onClick={onCancel} className="bg-gray-500 text-white text-xs px-2 py-1 rounded disabled:opacity-50">
            キャンセル
          </button>
        </div>
      )}
      {state === "received" && (
        <div className="flex gap-2">
          <button disabled={busy} onClick={onAccept} className="btn-accent text-sm disabled:opacity-50">
            承認
          </button>
          <button disabled={busy} onClick={onCancel} className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-50">
            拒否
          </button>
        </div>
      )}
      {state === "accepted" && (
        <div className="flex gap-3 items-center">
          <span className="text-sm text-green-700">フレンドです</span>
          <button disabled={busy} onClick={onRemove} className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50">
            解除
          </button>
        </div>
      )}
    </section>
  );
}
