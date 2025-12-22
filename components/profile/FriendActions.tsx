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
      {state === "none" && (
        <Button disabled={busy} onClick={onSend} variant="ghost" size="sm" className="text-foreground min-w-[7rem] h-8">
          フレンド申請
        </Button>
      )}
      {state === "sent" && (
        <div className="flex gap-2 items-center">
          <span className="text-sm fg-muted">申請中...</span>
          <Button disabled={busy} onClick={onCancel} variant="ghost" size="sm" className="text-foreground min-w-[7rem] h-8">
            キャンセル
          </Button>
        </div>
      )}
      {state === "received" && (
        <div className="flex gap-2">
          <Button disabled={busy} onClick={onAccept} variant="ghost" size="sm" className="text-foreground min-w-[7rem] h-8">
            承認
          </Button>
          <Button disabled={busy} onClick={onCancel} variant="danger" size="sm" className="min-w-[7rem] h-8">
            拒否
          </Button>
        </div>
      )}
      {state === "accepted" && (
        <div className="flex gap-2 items-center">
          <Button disabled={true} variant="accent" size="sm" className="text-foreground border border-[--accent] min-w-[7rem] h-8">
            フレンド
          </Button>
          <Button disabled={busy} onClick={onRemove} variant="danger" size="sm" className="min-w-[7rem] h-8">
            解除
          </Button>
        </div>
      )}
    </section>
  );
}
