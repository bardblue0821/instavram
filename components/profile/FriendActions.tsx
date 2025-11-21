"use client";
import React from "react";
import { Button } from "../ui/Button";

type FriendState = "none" | "sent" | "received" | "accepted";

interface FriendActionsProps {
  state: FriendState;
  busy?: boolean;
  onSend?: () => void;
  onCancel?: () => void;
  onAccept?: () => void;
  onRemove?: () => void;
}

export function FriendActions({ state, busy = false, onSend, onCancel, onAccept, onRemove }: FriendActionsProps) {
  return (
    <div className="space-y-2" aria-live="polite">
      <h2 className="text-lg font-medium">フレンド</h2>
      {state === "none" && (
        <Button onClick={onSend} disabled={busy} variant="primary" size="sm">
          フレンド申請
        </Button>
      )}
      {state === "sent" && (
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">申請中...</span>
          <Button onClick={onCancel} disabled={busy} variant="ghost" size="sm">
            キャンセル
          </Button>
        </div>
      )}
      {state === "received" && (
        <div className="flex gap-2">
          <Button onClick={onAccept} disabled={busy} variant="primary" size="sm">
            承認
          </Button>
          <Button onClick={onCancel} disabled={busy} variant="ghost" size="sm">
            拒否
          </Button>
        </div>
      )}
      {state === "accepted" && (
        <div className="flex items-center gap-3">
          <span className="text-sm text-green-700">フレンドです</span>
          <Button onClick={onRemove} disabled={busy} variant="ghost" size="sm">
            解除
          </Button>
        </div>
      )}
    </div>
  );
}
