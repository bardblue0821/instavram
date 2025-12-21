"use client";
import React from "react";
import { Button } from "../ui/Button";

// Props aligned with existing FieldText usage in app/user/[id]/page.tsx
export interface InlineTextFieldProps {
  label: string;
  value: string;
  placeholder: string;
  field: string;
  editingField: string | null;
  editingValue: string;
  beginEdit: (f: string, cur: string) => void;
  onChange: (v: string) => void;
  onBlur: () => void;
  onKey?: (e: React.KeyboardEvent) => void;
  isMe: boolean;
  saving: boolean;
  prefix?: string;
  isLink?: boolean;
  numeric?: boolean;
  date?: boolean;
  onSave: () => void;
  setSkipDiscard: (v: boolean) => void;
}

export default function InlineTextField(p: InlineTextFieldProps) {
  const {
    label,
    value,
    placeholder,
    field,
    editingField,
    editingValue,
    beginEdit,
    onChange,
    onBlur,
    onKey,
    isMe,
    saving,
    prefix,
    isLink,
    numeric,
    date,
    onSave,
    setSkipDiscard,
  } = p;

  const active = editingField === field;
  if (active)
    return (
      <div className="text-sm space-y-1">
        <label className="text-xs fg-subtle">{label}</label>
        <div className="flex items-start gap-2">
          <input
            autoFocus
            type={numeric ? "number" : date ? "date" : "text"}
            className="flex-1 border-b-2 border-[--accent] bg-transparent p-1 text-sm focus:outline-none"
            value={editingValue}
            disabled={saving}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={onKey}
          />
          <Button
            type="button"
            disabled={saving}
            variant="accent"
            size="xs"
            onMouseDown={() => setSkipDiscard(true)}
            onClick={onSave}
          >
            保存
          </Button>
        </div>
      </div>
    );

  const shown = value ? (prefix ? prefix + value : value) : placeholder;
  return (
    <p
      className={isMe ? "cursor-pointer text-sm" : "text-sm"}
      onClick={() => isMe && beginEdit(field, value)}
    >
      <span className="font-semibold fg-muted">{label}:</span>{" "}
      {value && isLink ? (
        <a className="link-accent" href={value} target="_blank" rel="noreferrer">
          {shown}
        </a>
      ) : (
        shown
      )}
    </p>
  );
}
