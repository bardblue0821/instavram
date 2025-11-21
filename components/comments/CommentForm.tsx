"use client";
import React from "react";

interface CommentFormProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  maxLength?: number;
  busy?: boolean;
  disabled?: boolean;
}

export function CommentForm({ value, onChange, onSubmit, maxLength = 200, busy = false, disabled = false }: CommentFormProps) {
  const remaining = maxLength - value.length;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim() || busy || disabled) return;
        onSubmit();
      }}
      className="space-y-2"
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        rows={3}
        placeholder="コメントを入力"
        disabled={busy || disabled}
        className="w-full rounded border px-3 py-2 text-sm"
        aria-label="コメント入力"
      />
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span>{remaining}/{maxLength}</span>
        <button
          type="submit"
          disabled={!value.trim() || busy || disabled}
          className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50"
        >{busy ? "送信中..." : "送信"}</button>
      </div>
    </form>
  );
}
