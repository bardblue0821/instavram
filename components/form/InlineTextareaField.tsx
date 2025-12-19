"use client";
import React from "react";

export interface InlineTextareaFieldProps {
  label: string;
  value: string;
  placeholder: string;
  field: string;
  editingField: string | null;
  editingValue: string;
  beginEdit: (f: string, cur: string) => void;
  onChange: (v: string) => void;
  onBlur: () => void;
  isMe: boolean;
  saving: boolean;
  onSave: () => void;
  setSkipDiscard: (v: boolean) => void;
}

export default function InlineTextareaField(p: InlineTextareaFieldProps) {
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
    isMe,
    saving,
    onSave,
    setSkipDiscard,
  } = p;

  const active = editingField === field;
  if (active)
    return (
      <div className="text-sm space-y-1">
        <label className="text-xs text-gray-500">{label}</label>
        <div className="flex items-start gap-2">
          <div className="flex-1">
            <textarea
              autoFocus
              rows={5}
              className="w-full border-b-2 border-blue-500 bg-transparent p-1 text-sm focus:outline-none"
              value={editingValue}
              disabled={saving}
              onChange={(e) => onChange(e.target.value)}
              onBlur={onBlur}
            />
            <p className="text-[10px] text-gray-500">
              {editingValue
                .replace(/[\r\n]+/g, " ")
                .replace(/[\u3000]+/g, "")
                .replace(/ {2,}/g, " ")
                .trim().length}
              /100
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            className="text-xs h-8 px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50 mt-1"
            onMouseDown={() => setSkipDiscard(true)}
            onClick={onSave}
          >
            保存
          </button>
        </div>
      </div>
    );

  return (
    <p
      className={isMe ? "cursor-pointer text-sm whitespace-pre-line" : "text-sm whitespace-pre-line"}
      onClick={() => isMe && beginEdit(field, value)}
    >
      <span className="font-semibold text-gray-700">{label}:</span>{" "}
      {value ? value : placeholder}
    </p>
  );
}
