"use client";
import React from "react";

export interface LinksFieldProps {
  profile: any;
  editingField: string | null;
  editingValue: string;
  editingLinkIndex: number | null;
  beginEdit: (f: string, cur: string, idx?: number) => void;
  onChange: (v: string) => void;
  onBlur: () => void;
  onKey: (e: React.KeyboardEvent) => void;
  isMe: boolean;
  saving: boolean;
  onSave: () => void;
  setSkipDiscard: (v: boolean) => void;
}

export default function LinksField(p: LinksFieldProps) {
  const {
    profile,
    editingField,
    editingValue,
    editingLinkIndex,
    beginEdit,
    onChange,
    onBlur,
    onKey,
    isMe,
    saving,
    onSave,
    setSkipDiscard,
  } = p;

  const links: string[] = (profile.links || []).slice(0, 3);
  const active = editingField === "link";

  return (
    <div className="text-sm space-y-1">
      <span className="font-semibold text-gray-700">その他URL:</span>
      <ul className="list-disc ml-5 space-y-1">
        {links.map((l, i) => (
          <li key={i} className={isMe ? "cursor-pointer" : ""} onClick={() => isMe && beginEdit("link", l, i)}>
            {active && editingLinkIndex === i ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  className="flex-1 border-b-2 border-blue-500 bg-transparent p-1 text-xs focus:outline-none"
                  value={editingValue}
                  disabled={saving}
                  onChange={(e) => onChange(e.target.value)}
                  onBlur={onBlur}
                  onKeyDown={onKey}
                />
                <button
                  type="button"
                  disabled={saving}
                  className="text-[10px] px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
                  onMouseDown={() => setSkipDiscard(true)}
                  onClick={onSave}
                >
                  保存
                </button>
              </div>
            ) : (
              <a href={l} className="link-accent" target="_blank" rel="noreferrer">
                {l}
              </a>
            )}
          </li>
        ))}
        {links.length === 0 && <li className="text-gray-500">未設定</li>}
        {isMe && links.length < 3 && !active && (
          <li>
            <button
              type="button"
              className="text-xs text-blue-600 underline"
              onClick={() => beginEdit("link", "", links.length)}
            >
              + 追加
            </button>
          </li>
        )}
        {active && editingLinkIndex === links.length && (
          <li>
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="flex-1 border-b-2 border-blue-500 bg-transparent p-1 text-xs focus:outline-none"
                value={editingValue}
                disabled={saving}
                onChange={(e) => onChange(e.target.value)}
                onBlur={onBlur}
                onKeyDown={onKey}
              />
              <button
                type="button"
                disabled={saving}
                className="text-[10px] px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
                onMouseDown={() => setSkipDiscard(true)}
                onClick={onSave}
              >
                保存
              </button>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
