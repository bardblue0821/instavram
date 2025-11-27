"use client";
import React, { useState } from "react";

type Img = { url: string; uploaderId?: string };
type LatestComment = { body: string; userId: string } | undefined;

export function TimelineItem(props: {
  album: { id: string; ownerId: string; title?: string | null; createdAt?: any };
  images: Img[];
  likeCount: number;
  liked: boolean;
  onLike: () => Promise<void> | void;
  latestComment?: LatestComment;
  onCommentSubmit?: (text: string) => Promise<void>;
  submitting?: boolean;
}) {
  const { album, images, likeCount, liked, onLike, latestComment, onCommentSubmit, submitting } = props;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!onCommentSubmit || !text.trim()) return;
    setBusy(true);
    try {
      await onCommentSubmit(text.trim());
      setText("");
    } finally {
      setBusy(false);
    }
  }

  function renderGrid(imgs: Img[]) {
    const n = Math.min(imgs.length, 4);
    const list = imgs.slice(0, n);
    if (n === 0) return null;
    if (n === 1) {
      return (
        <div className="grid grid-cols-1 gap-1">
          <img src={list[0].url} alt="image" className="w-full h-auto object-cover rounded" />
        </div>
      );
    }
    if (n === 2) {
      return (
        <div className="grid grid-cols-2 gap-1">
          {list.map((img, i) => (
            <img key={i} src={img.url} alt={`image-${i}`} className="w-full h-auto object-cover rounded" />
          ))}
        </div>
      );
    }
    if (n === 3) {
      // 左大1枚、右に上下2枚
      return (
        <div className="grid grid-cols-3 gap-1">
          <img src={list[0].url} alt="image-0" className="col-span-2 row-span-2 w-full h-full object-cover rounded" />
          <img src={list[1].url} alt="image-1" className="w-full h-auto object-cover rounded" />
          <img src={list[2].url} alt="image-2" className="w-full h-auto object-cover rounded" />
        </div>
      );
    }
    // 4枚: 2x2
    return (
      <div className="grid grid-cols-2 gap-1">
        {list.map((img, i) => (
          <img key={i} src={img.url} alt={`image-${i}`} className="w-full h-auto object-cover rounded" />
        ))}
      </div>
    );
  }

  return (
    <article className="rounded border p-3 space-y-3">
      <header className="space-y-1">
        {album.title && <h3 className="text-base font-semibold">{album.title}</h3>}
        <p className="text-xs text-gray-500">owner: {album.ownerId}</p>
      </header>

      <div className="overflow-hidden rounded">
        {renderGrid(images)}
      </div>

      <div className="flex items-center gap-2">
        <button
          aria-pressed={liked}
          className={`rounded border px-2 py-1 text-sm ${liked ? "border-pink-600 bg-pink-600 text-white" : "border-gray-300 bg-white text-gray-700"}`}
          onClick={() => onLike?.()}
        >{liked ? "♥ いいね済み" : "♡ いいね"}</button>
        <span className="text-xs text-gray-600">{likeCount}</span>
      </div>

      {onCommentSubmit && (
        <div className="flex items-center gap-2">
          <input
            aria-label="コメント入力"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 input-underline text-sm"
            placeholder="コメントを書く"
          />
          <button
            className="btn-accent text-sm disabled:opacity-50"
            onClick={submit}
            disabled={busy || submitting || !text.trim()}
          >送信</button>
        </div>
      )}

      {latestComment?.body && (
        <div className="text-xs text-gray-600">
          最新コメント: {latestComment.body}
        </div>
      )}
    </article>
  );
}
