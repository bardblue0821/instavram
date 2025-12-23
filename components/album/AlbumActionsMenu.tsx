"use client";
import React, { useEffect, useRef, useState } from "react";

interface Props {
  albumId: string;
  albumOwnerId: string;
  currentUserId?: string;
  onRequestDelete?: (albumId: string) => void;
  onRequestReport?: (albumId: string) => void;
}

export default function AlbumActionsMenu({ albumId, albumOwnerId, currentUserId, onRequestDelete, onRequestReport }: Props) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(t) && btnRef.current && !btnRef.current.contains(t)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const canDelete = !!currentUserId && currentUserId === albumOwnerId;

  return (
    <div className="ml-auto relative">
      <button
        ref={btnRef}
        type="button"
        aria-label="メニュー"
        aria-haspopup="menu"
        aria-expanded={open}
        className="w-8 h-8 rounded border border-line hover:bg-surface-weak text-muted"
        onClick={() => setOpen((o) => !o)}
      >
        ⋯
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full mt-2 w-40 rounded border border-line bg-background shadow-lg z-50 overflow-hidden"
        >
          {canDelete && (
            <button
              type="button"
              role="menuitem"
              className="w-full text-left px-3 py-2 text-sm hover:bg-surface-weak"
              onClick={() => { setOpen(false); onRequestDelete?.(albumId); }}
            >
              削除する
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            className="w-full text-left px-3 py-2 text-sm hover:bg-surface-weak"
            onClick={() => { setOpen(false); onRequestReport?.(albumId); }}
          >
            通報する
          </button>
        </div>
      )}
    </div>
  );
}
