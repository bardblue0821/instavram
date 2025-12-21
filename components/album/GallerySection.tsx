import React from "react";
import GalleryGrid, { type PhotoItem } from "../gallery/GalleryGrid";
import AlbumImageUploader from "../upload/AlbumImageUploader";

export interface GallerySectionProps {
  photos: PhotoItem[];
  imagesLength: number;
  visibleCount: number;
  onSeeMore: () => void;
  canDelete: (p: PhotoItem) => boolean;
  onDelete: (p: PhotoItem) => void;
  showUploader: boolean;
  albumId: string;
  userId: string;
  remaining: number;
  onUploaded: () => void;
  rowHeight?: number;
  margin?: number;
  columns?: number;
}

export default function GallerySection(props: GallerySectionProps) {
  const { photos, imagesLength, visibleCount, onSeeMore, canDelete, onDelete, showUploader, albumId, userId, remaining, onUploaded, rowHeight = 240, margin = 6 } = props;

  return (
    <section>
  {imagesLength === 0 && <p className="text-sm fg-subtle">まだ画像がありません</p>}
      {imagesLength > 0 && (
        <GalleryGrid
          photos={photos}
          rowHeight={rowHeight}
          margin={margin}
          layoutType="grid"
          columns={3}
          visibleCount={visibleCount}
          canDelete={canDelete}
          onDelete={onDelete}
        />
      )}
      {imagesLength > visibleCount && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            className="rounded border border-base px-3 py-1.5 text-sm hover-surface-alt"
            onClick={onSeeMore}
          >もっと見る</button>
        </div>
      )}
      {showUploader && (
        <div className="mt-4">
          <AlbumImageUploader
            albumId={albumId}
            userId={userId}
            remaining={remaining}
            onUploaded={onUploaded}
          />
        </div>
      )}
    </section>
  );
}
