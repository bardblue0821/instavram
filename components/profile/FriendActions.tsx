"use client";
import React from "react";
import { Button } from "../ui/Button";

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
        <Button disabled={busy} onClick={onSend} variant="accent" size="sm">
          フレンド申請
        </Button>
      )}
      {state === "sent" && (
        <div className="flex gap-2 items-center">
          <span className="text-sm fg-muted">申請中...</span>
          <Button disabled={busy} onClick={onCancel} variant="ghost" size="xs">
            キャンセル
          </Button>
        </div>
      )}
      {state === "received" && (
        <div className="flex gap-2">
          <Button disabled={busy} onClick={onAccept} variant="accent" size="sm">
            承認
          </Button>
          <Button disabled={busy} onClick={onCancel} variant="danger" size="sm">
            拒否
          </Button>
        </div>
      )}
      {state === "accepted" && (
        <div className="flex gap-3 items-center">
          <span className="text-sm text-green-700">フレンドです</span>
          <Button disabled={busy} onClick={onRemove} variant="danger" size="xs">
            解除
          </Button>
        </div>
      )}
    </section>
  );
}
