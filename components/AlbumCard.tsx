"use client";
import Link from "next/link";
import Image from "next/image";
import React from "react";

interface AlbumCardProps {
  id: string;
  title?: string | null;
  ownerId: string;
  createdAt?: Date | string | number | null;
  firstImageUrl?: string;
  placeUrl?: string | null;
  likeCount?: number;
  commentCount?: number;
}

function formatDate(value?: Date | string | number | null) {
  if (!value) return "";
  try {
    let d: Date;
    if (typeof value === "string" || typeof value === "number") {
      d = new Date(value);
    } else if (value instanceof Date) {
      d = value;
    } else if ((value as any)?.toDate) {
      d = (value as any).toDate();
    } else {
      return "";
    }
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return "";
  }
}

export function AlbumCard({ id, title, ownerId, createdAt, firstImageUrl, placeUrl, likeCount, commentCount }: AlbumCardProps) {
  const displayTitle = title?.trim() || "無題";
  const formattedDate = formatDate(createdAt);

  return (
    <article className="overflow-hidden rounded-lg border bg-white shadow-sm transition hover:shadow-md dark:bg-gray-900">
      <Link href={`/album/${id}`} aria-label={`アルバム: ${displayTitle}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400">
        <div className="relative aspect-video w-full bg-gray-100">
          {firstImageUrl ? (
            <Image src={firstImageUrl} alt={displayTitle} fill className="object-cover" sizes="(min-width: 768px) 50vw, 100vw" priority={false} />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">No Image</div>
          )}
        </div>
        <div className="space-y-2 p-4">
          <header className="space-y-1">
            <h3 className="truncate text-base font-semibold text-gray-900 dark:text-gray-100">{displayTitle}</h3>
            <p className="text-xs text-gray-500">owner: {ownerId}</p>
            {formattedDate && <p className="text-[11px] text-gray-400">{formattedDate}</p>}
          </header>
          {placeUrl && (
            <p className="truncate text-xs link-accent">
              撮影場所: <span className="underline">{placeUrl}</span>
            </p>
          )}
          {(typeof likeCount === "number" || typeof commentCount === "number") && (
            <footer className="flex items-center gap-3 text-[11px] text-gray-500">
              {typeof likeCount === "number" && <span>♥ {likeCount}</span>}
              {typeof commentCount === "number" && <span>💬 {commentCount}</span>}
            </footer>
          )}
        </div>
      </Link>
    </article>
  );
}

export function AlbumCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-lg border bg-white">
      <div className="aspect-video w-full bg-gray-200" />
      <div className="space-y-3 p-4">
        <div className="h-4 w-3/4 rounded bg-gray-200" />
        <div className="h-3 w-1/2 rounded bg-gray-200" />
        <div className="h-3 w-1/3 rounded bg-gray-100" />
      </div>
    </div>
  );
}
