"use client";
import React from "react";
import { Button } from "../ui/Button";

export interface ReportConfirmModalProps {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function ReportConfirmModal({ open, busy, onCancel, onConfirm }: ReportConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-80 rounded surface p-4 shadow-lg">
        <h3 className="text-sm font-semibold">このアルバムを通報しますか？</h3>
        <p className="mt-2 text-xs fg-muted">内容を確認するため、投稿へのリンクを管理者に送信します。</p>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="subtle" size="xs" onClick={onCancel} disabled={busy}>
            キャンセル
          </Button>
          <Button type="button" variant="accent" size="xs" onClick={onConfirm} disabled={busy} isLoading={busy}>
            {busy ? "通報中..." : "通報する"}
          </Button>
        </div>
      </div>
    </div>
  );
}
