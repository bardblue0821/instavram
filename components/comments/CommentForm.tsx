"use client";
import React from "react";
import { Button } from "../ui/Button";

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
  const isSubmitDisabled = !value.trim() || busy || disabled;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (isSubmitDisabled) return;
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
        className="w-full rounded border border-base bg-page px-3 py-2 text-sm placeholder:text-(--subtle) focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--accent-ring)"
        aria-label="コメント入力"
      />
      <div className="flex items-center justify-between text-xs fg-subtle">
        <span>
          {remaining}/{maxLength}
        </span>
        <Button type="submit" variant="accent" size="sm" disabled={isSubmitDisabled} isLoading={busy}>
          送信
        </Button>
      </div>
    </form>
  );
}
