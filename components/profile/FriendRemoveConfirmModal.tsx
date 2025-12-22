import React from "react";

export interface FriendRemoveConfirmModalProps {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function FriendRemoveConfirmModal({ open, busy, onCancel, onConfirm }: FriendRemoveConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-80 rounded bg-background border border-line p-4 shadow-lg">
        <h3 className="text-sm font-semibold">フレンドを外しますか？</h3>
        <p className="mt-2 text-xs fg-muted">いつでも再度フレンド申請できます。</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded surface-alt px-3 py-1 text-xs"
            onClick={onCancel}
            disabled={busy}
          >キャンセル</button>
          <button
            type="button"
            className="rounded bg-red-600 px-3 py-1 text-xs text-white disabled:opacity-50"
            onClick={onConfirm}
            disabled={busy}
          >{busy ? "処理中..." : "外す"}</button>
        </div>
      </div>
    </div>
  );
}
