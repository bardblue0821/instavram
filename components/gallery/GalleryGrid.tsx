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
  width: number;
  height: number;
  alt?: string;
  uploaderId?: string;
};

export type GalleryGridProps = {
  photos: PhotoItem[];
  rowHeight?: number; // 目安の行の高さ（px）
  margin?: number; // 画像間のマージン（px）
  canDelete?: (item: PhotoItem) => boolean;
  onDelete?: (item: PhotoItem) => void;
};

// react-photo-album のカスタムレンダラー
function PhotoRenderer({ photo, imageProps, wrapperStyle, canDelete, onDelete, onOpen }: RenderPhotoProps & { canDelete?: (p: PhotoItem) => boolean; onDelete?: (p: PhotoItem) => void; onOpen: () => void; }) {
  const { src, width, height } = photo as PhotoItem;
  const alt = (photo as any).alt || "photo";
  const style: CSSProperties = { ...wrapperStyle, position: "relative", borderRadius: 8 };

  const isRemote = /^https?:\/\//i.test(src);

  return (
    <div
      role="button"
      tabIndex={0}
      style={style}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      {src.startsWith("data:") ? (
        // data URL は next/image が制限するためネイティブ img を使用
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          width={width}
          height={height}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
          loading="lazy"
        />
      ) : (
        <Image
          src={src}
          alt={alt}
          width={width}
          height={height}
          sizes={imageProps.sizes || "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
          style={{ display: "block", width: "100%", height: "100%", objectFit: "cover", borderRadius: 8 }}
          // Firebase Storage など一部のリモートで Next の最適化が失敗するケースに備え回避
          unoptimized={isRemote}
        />
      )}
      {canDelete && onDelete && canDelete(photo as PhotoItem) && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); onDelete(photo as PhotoItem); }}
          className="absolute right-1 top-1 rounded bg-red-600 px-2 py-0.5 text-[10px] text-white opacity-80 hover:opacity-100"
        >削除</button>
      )}
    </div>
  );
}

export default function GalleryGrid({ photos, rowHeight = 260, margin = 4, canDelete, onDelete }: GalleryGridProps) {
  const items = useMemo(() => photos, [photos]);
  const lgRef = useRef<any>(null);
  const dynamicEl = useMemo(
    () =>
      items.map((p) => ({
        src: p.src,
        thumb: p.src, // サムネイル一覧用に明示（未指定だと空白になることがある）
        subHtml: p.alt ? `<p>${p.alt}</p>` : undefined,
      })),
    [items]
  );

  return (
    <div className="relative">
      {/* LightGallery は dynamic モードで利用し、クリック時に index を指定して開く */}
      <LightGallery
        plugins={[lgZoom, lgThumbnail]}
        dynamic
        dynamicEl={dynamicEl}
        thumbnail={true}
        showThumbByDefault={true}
        speed={300}
        elementClassNames="block"
        download={false}
        licenseKey="0000-0000-000-0000"
        onInit={({ instance }: any) => { lgRef.current = instance; }}
      >
        {/* サムネイルは任意の要素でOK。クリックで openGallery(index) する */}
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
      </LightGallery>
    </div>
  );
}
