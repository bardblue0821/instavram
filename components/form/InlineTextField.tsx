"use client";
import React from "react";

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
            className="flex-1 border-b-2 border-blue-500 bg-transparent p-1 text-sm focus:outline-none"
            value={editingValue}
            disabled={saving}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onBlur}
            onKeyDown={onKey}
          />
          <button
            type="button"
            disabled={saving}
            className="text-xs px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
            onMouseDown={() => setSkipDiscard(true)}
            onClick={onSave}
          >
            保存
          </button>
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
