"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import { useMemo, useRef } from "react";
import type { CSSProperties } from "react";
import PhotoAlbum, { type RenderPhotoProps } from "react-photo-album";

// lightGallery はクライアント側のみで読み込む
const LightGallery = dynamic(() => import("lightgallery/react"), { ssr: false });
// Plugins（クライアント側・use client ファイルなので直 import でOK）
import lgZoom from "lightgallery/plugins/zoom";
import lgThumbnail from "lightgallery/plugins/thumbnail";

export type PhotoItem = {
  id?: string;
  src: string; // /public 直下なら /path 形式 または外部URL / dataURL
  thumbSrc?: string; // 軽量サムネイルURL（省略時は src を使用）
  width: number;
  height: number;
  alt?: string;
  subHtml?: string; // Lightbox 下部に表示する説明（HTML）
  uploaderId?: string;
  uploaderIconURL?: string | null;
  uploaderHandle?: string | null;
};

function escapeHtml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export type GalleryGridProps = {
  photos: PhotoItem[];
  rowHeight?: number; // 目安の行の高さ（px）
  margin?: number; // 画像間のマージン（px）
  canDelete?: (item: PhotoItem) => boolean;
  onDelete?: (item: PhotoItem) => void;
  layoutType?: 'rows' | 'grid';
  columns?: number; // grid の列数（layoutType='grid' のとき使用）
  visibleCount?: number; // 先頭からこの件数のみ表示
  enableLightbox?: boolean;
  lightboxPlugins?: any[];
  lightboxThumbnail?: boolean;
  lightboxShowThumbByDefault?: boolean;
};

// react-photo-album のカスタムレンダラー
function PhotoRenderer({ photo, imageProps, wrapperStyle, canDelete, onDelete, onOpen }: RenderPhotoProps & { canDelete?: (p: PhotoItem) => boolean; onDelete?: (p: PhotoItem) => void; onOpen: () => void; }) {
  const { src, thumbSrc, width, height, uploaderIconURL, uploaderHandle, uploaderId } = photo as PhotoItem;
  const alt = (photo as any).alt || "photo";
  const style: CSSProperties = { ...wrapperStyle, position: "relative", borderRadius: 8 };
  const displaySrc = thumbSrc || src;
  const isRemote = /^https?:\/\//i.test(displaySrc);

  return (
    <div
      role="button"
      tabIndex={0}
      className="cursor-pointer"
      style={style}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {displaySrc.startsWith("data:") || isRemote ? (
        // data URL / リモートURL は next/image の制約や設定差分を避けるためネイティブ img を使用
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displaySrc}
          alt={alt}
          width={width}
          height={height}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
          loading="lazy"
        />
      ) : (
        <Image
          src={displaySrc}
          alt={alt}
          width={width}
          height={height}
          sizes={imageProps.sizes || "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
        />
      )}
      {canDelete && onDelete && canDelete(photo as PhotoItem) && (
        <button
          type="button"
          aria-label="画像を削除"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(photo as PhotoItem); }}
          className="absolute right-1 top-1 rounded bg-red-600 p-1 text-white opacity-80 hover:opacity-100"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18" />
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
            <path d="M10 11v6" />
            <path d="M14 11v6" />
          </svg>
        </button>
      )}
      {/* 投稿者アイコン（左下） */}
      {uploaderIconURL && (
        uploaderHandle ? (
          <a
            href={`/user/${uploaderHandle}`}
            aria-label="投稿者プロフィールへ"
            className="absolute left-1 bottom-1"
            onClick={(e) => { e.stopPropagation(); }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={uploaderIconURL}
              alt="uploader"
              className="h-7 w-7 rounded-full "
              loading="lazy"
            />
          </a>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={uploaderIconURL}
            alt="uploader"
            className="absolute left-1 bottom-1 h-7 w-7 rounded-full "
            loading="lazy"
          />
        )
      )}
    </div>
  );
}

export default function GalleryGrid({ photos, rowHeight = 260, margin = 4, canDelete, onDelete, layoutType = 'rows', columns = 4, visibleCount, enableLightbox = true, lightboxPlugins, lightboxThumbnail = true, lightboxShowThumbByDefault = true }: GalleryGridProps) {
  const items = useMemo(() => (typeof visibleCount === 'number' ? photos.slice(0, Math.max(0, visibleCount)) : photos), [photos, visibleCount]);
  const lgRef = useRef<any>(null);
  const dynamicEl = useMemo(
    () =>
      items.map((p) => ({
        src: p.src,
        thumb: p.thumbSrc || p.src, // サムネイル一覧用に軽量URLを優先
        subHtml: p.subHtml ?? (p.alt ? `<p>${escapeHtml(p.alt)}</p>` : undefined),
      })),
    [items]
  );

  const pluginsToUse = lightboxPlugins ?? [lgZoom, lgThumbnail];

  // Lightbox を無効化（プロフィールなど、単純に一覧表示したい用途）
  if (!enableLightbox) {
    return (
      <div className="relative">
        {layoutType === 'rows' ? (
          <PhotoAlbum
            layout="rows"
            photos={items}
            targetRowHeight={rowHeight}
            spacing={margin}
            renderPhoto={(props: RenderPhotoProps) => (
              <PhotoRenderer
                {...(props as any)}
                onOpen={() => {}}
                canDelete={canDelete}
                onDelete={onDelete}
              />
            )}
          />
        ) : (
          <div
            className="grid"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.max(1, columns)}, 1fr)`,
              gap: `${margin}px`,
            }}
          >
            {items.map((p, idx) => (
              <div
                key={p.id ?? p.src + ':' + idx}
                style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}
              >
                <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1' }}>
                  {(/^data:/i.test(p.thumbSrc || p.src) || /^https?:\/\//i.test(p.thumbSrc || p.src)) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.thumbSrc || p.src}
                      alt={p.alt || 'photo'}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                  ) : (
                    <Image
                      src={p.thumbSrc || p.src}
                      alt={p.alt || 'photo'}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      style={{ objectFit: 'cover' }}
                    />
                  )}
                </div>
                {canDelete && onDelete && canDelete(p) && (
                  <button
                    type="button"
                    aria-label="画像を削除"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(p); }}
                    className="absolute right-1 top-1 rounded bg-red-600 p-1 text-white opacity-80 hover:opacity-100"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </button>
                )}
                {p.uploaderIconURL && (
                  p.uploaderHandle ? (
                    <a
                      href={`/user/${p.uploaderHandle}`}
                      aria-label="投稿者プロフィールへ"
                      className="absolute left-1 bottom-1"
                      onClick={(e) => { e.stopPropagation(); }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.uploaderIconURL}
                        alt="uploader"
                        className="h-7 w-7 rounded-full object-cover border border-white/50 shadow"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.uploaderIconURL}
                      alt="uploader"
                      className="absolute left-1 bottom-1 h-7 w-7 rounded-full object-cover border border-white/50 shadow"
                      loading="lazy"
                    />
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative">
      {/* LightGallery は dynamic モードで利用し、クリック時に index を指定して開く */}
      <LightGallery
        plugins={pluginsToUse}
        dynamic
        dynamicEl={dynamicEl}
        thumbnail={lightboxThumbnail}
        showThumbByDefault={lightboxThumbnail ? lightboxShowThumbByDefault : false}
        speed={300}
        elementClassNames="block"
        download={false}
        licenseKey="0000-0000-000-0000"
        onInit={({ instance }: any) => { lgRef.current = instance; }}
      >
        {/* サムネイルは任意の要素でOK。クリックで openGallery(index) する */}
        {layoutType === 'rows' ? (
          <PhotoAlbum
            layout="rows"
            photos={items}
            targetRowHeight={rowHeight}
            spacing={margin}
            renderPhoto={(props: RenderPhotoProps & { index?: number }) => (
              <PhotoRenderer
                {...props}
                onOpen={() => {
                  const idx = (props as any).index ?? 0;
                  lgRef.current?.openGallery?.(idx);
                }}
                canDelete={canDelete}
                onDelete={onDelete}
              />
            )}
            onClick={({ index, event }: any) => {
              event?.preventDefault?.();
              lgRef.current?.openGallery?.(index);
            }}
          />
        ) : (
          <div
            className="grid"
            style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${Math.max(1, columns)}, 1fr)`,
              gap: `${margin}px`,
            }}
          >
            {items.map((p, idx) => (
              <div
                key={(p.id ?? p.src) + ':' + idx}
                role="button"
                tabIndex={0}
                className="cursor-pointer"
                onClick={() => lgRef.current?.openGallery?.(idx)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    lgRef.current?.openGallery?.(idx);
                  }
                }}
                style={{ position: 'relative', borderRadius: 8, overflow: 'hidden' }}
              >
                {/* 正方形トリム */}
                <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1' }}>
                  {(/^data:/i.test(p.thumbSrc || p.src) || /^https?:\/\//i.test(p.thumbSrc || p.src)) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.thumbSrc || p.src}
                      alt={p.alt || 'photo'}
                      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                      loading="lazy"
                    />
                  ) : (
                    <Image
                      src={p.thumbSrc || p.src}
                      alt={p.alt || 'photo'}
                      fill
                      sizes="(max-width: 768px) 50vw, 25vw"
                      style={{ objectFit: 'cover' }}
                    />
                  )}
                </div>
                {canDelete && onDelete && canDelete(p) && (
                  <button
                    type="button"
                    aria-label="画像を削除"
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(p); }}
                    className="absolute right-1 top-1 rounded bg-red-600 p-1 text-white opacity-80 hover:opacity-100"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                  </button>
                )}
                {/* 投稿者アイコン（左下） */}
                {p.uploaderIconURL && (
                  p.uploaderHandle ? (
                    <a
                      href={`/user/${p.uploaderHandle}`}
                      aria-label="投稿者プロフィールへ"
                      className="absolute left-1 bottom-1"
                      onClick={(e) => { e.stopPropagation(); }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={p.uploaderIconURL}
                        alt="uploader"
                        className="h-7 w-7 rounded-full object-cover border border-white/50 shadow"
                        loading="lazy"
                      />
                    </a>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.uploaderIconURL}
                      alt="uploader"
                      className="absolute left-1 bottom-1 h-7 w-7 rounded-full object-cover border border-white/50 shadow"
                      loading="lazy"
                    />
                  )
                )}
              </div>
            ))}
          </div>
        )}
      </LightGallery>
    </div>
  );
}
