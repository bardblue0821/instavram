import React from "react";

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
          <button
            type="button"
            className="rounded surface-alt px-3 py-1 text-xs"
            onClick={onCancel}
            disabled={busy}
          >キャンセル</button>
          <button
            type="button"
            className="rounded btn-accent px-3 py-1 text-xs disabled:opacity-50"
            onClick={onConfirm}
            disabled={busy}
          >{busy ? "通報中..." : "通報する"}</button>
        </div>
      </div>
    </div>
  );
}
