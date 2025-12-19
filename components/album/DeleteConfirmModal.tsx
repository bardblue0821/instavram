import React from "react";

export interface DeleteConfirmModalProps {
  open: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteConfirmModal({ open, busy, onCancel, onConfirm }: DeleteConfirmModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-80 rounded bg-white p-4 shadow-lg">
        <h3 className="text-sm font-semibold">本当に削除しますか？</h3>
        <p className="mt-2 text-xs text-gray-600">この操作は取り消せません。アルバムを削除します。</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="rounded bg-gray-200 px-3 py-1 text-xs"
            onClick={onCancel}
            disabled={busy}
          >キャンセル</button>
          <button
            type="button"
            className="rounded bg-red-600 px-3 py-1 text-xs text-white disabled:opacity-50"
            onClick={onConfirm}
            disabled={busy}
          >{busy ? "削除中..." : "削除"}</button>
        </div>
      </div>
    </div>
  );
}
