declare module 'react-photo-gallery' {
  import * as React from 'react';

  export type Photo = {
    src: string;
    width: number;
    height: number;
    alt?: string;
  };

  export type RenderImageProps = {
    index: number;
    left: number;
    top: number;
    key: string;
    photo: Photo;
  };

  export type PhotoProps = RenderImageProps;

  export interface GalleryProps {
    photos: Photo[];
    margin?: number;
    targetRowHeight?: number | ((containerWidth: number) => number);
    renderImage?: (props: RenderImageProps) => React.ReactNode;
  }

  export default class Gallery extends React.Component<GalleryProps> {}
}
