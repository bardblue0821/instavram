declare module 'react-photo-album' {
  import * as React from 'react';

  export interface Photo {
    src: string;
    width: number;
    height: number;
    alt?: string;
  }

  export interface RenderPhotoProps {
    photo: Photo;
    imageProps: { sizes?: string };
    wrapperStyle?: React.CSSProperties;
    index?: number;
  }

  export interface ClickHandlerProps {
    index: number;
    photo: Photo;
    event: React.MouseEvent;
  }

  export interface PhotoAlbumProps {
    photos: Photo[];
    layout?: 'rows' | 'masonry' | 'columns';
    targetRowHeight?: number;
    spacing?: number;
    renderPhoto?: (props: RenderPhotoProps) => React.ReactNode;
    onClick?: (props: ClickHandlerProps) => void;
  }

  const PhotoAlbum: React.ComponentType<PhotoAlbumProps>;
  export default PhotoAlbum;
  export type { RenderPhotoProps };
}
