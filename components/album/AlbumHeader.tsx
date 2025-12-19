import React from "react";

type Album = { ownerId: string; title?: string; placeUrl?: string; links?: string[] } | null;

export interface AlbumHeaderProps {
  album: Album;
  isOwner: boolean;
  editTitle: string;
  editPlaceUrl: string;
  savingAlbum: boolean;
  albumSavedMsg: string;
  onTitleChange: (v: string) => void;
  onPlaceUrlChange: (v: string) => void;
  onTitleBlur: () => void;
  onPlaceUrlBlur: () => void;
  onInputKeyDownBlurOnEnter?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function AlbumHeader(props: AlbumHeaderProps) {
  const { album, isOwner, editTitle, editPlaceUrl, savingAlbum, albumSavedMsg,
    onTitleChange, onPlaceUrlChange, onTitleBlur, onPlaceUrlBlur, onInputKeyDownBlurOnEnter } = props;

  const displayTitle = (() => {
    const t = album?.title ?? "";
    const s = (t + "").trim();
    return s.length > 0 ? s : "無題";
  })();

  return (
    <div>
      {!isOwner && (
        <h1 className="font-bold text-2xl">{displayTitle}</h1>
      )}

      {isOwner && (
        <div className="mt-2 space-y-3">
          <div>
            <input
              value={editTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={onTitleBlur}
              onKeyDown={onInputKeyDownBlurOnEnter}
              className="mt-1 input-underline font-bold text-2xl"
              placeholder="タイトル"
            />
          </div>
          <div>
            <input
              value={editPlaceUrl}
              onChange={(e) => onPlaceUrlChange(e.target.value)}
              onBlur={onPlaceUrlBlur}
              onKeyDown={onInputKeyDownBlurOnEnter}
              className="mt-1 input-underline text-sm"
              placeholder="https://vrchat.com/..."
            />
          </div>
          {albumSavedMsg && <p className="text-xs text-green-600">{albumSavedMsg}</p>}
        </div>
      )}

      {!isOwner && album?.placeUrl && (
        <a
          href={album.placeUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-1 inline-block text-sm link-accent"
        >撮影場所</a>
      )}

      {!isOwner && Array.isArray(album?.links) && (album?.links?.length ?? 0) > 0 && (
        <div className="mt-1 space-y-1">
          {(album!.links as string[]).slice(0, 3).map((url, i) => (
            (typeof url === 'string' && /^https?:\/\//.test(url)) ? (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="block text-sm link-accent"
              >関連リンク {i + 1}</a>
            ) : null
          ))}
        </div>
      )}
    </div>
  );
}
