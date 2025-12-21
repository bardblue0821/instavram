"use client";
import React from "react";
import { Button } from "../ui/Button";

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
      <span className="font-semibold fg-muted">その他URL:</span>
      <ul className="list-disc ml-5 space-y-1">
        {links.map((l, i) => (
          <li key={i} className={isMe ? "cursor-pointer" : ""} onClick={() => isMe && beginEdit("link", l, i)}>
            {active && editingLinkIndex === i ? (
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  className="flex-1 border-b-2 border-[--accent] bg-transparent p-1 text-xs focus:outline-none"
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
            ) : (
              <a href={l} className="link-accent" target="_blank" rel="noreferrer">
                {l}
              </a>
            )}
          </li>
        ))}
        {links.length === 0 && <li className="fg-subtle">未設定</li>}
        {isMe && links.length < 3 && !active && (
          <li>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="border-0 bg-transparent hover:bg-transparent px-0! py-0! text-xs link-accent underline"
              onClick={() => beginEdit("link", "", links.length)}
            >
              + 追加
            </Button>
          </li>
        )}
        {active && editingLinkIndex === links.length && (
          <li>
            <div className="flex items-center gap-2">
              <input
                autoFocus
                className="flex-1 border-b-2 border-[--accent] bg-transparent p-1 text-xs focus:outline-none"
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
          </li>
        )}
      </ul>
    </div>
  );
}
