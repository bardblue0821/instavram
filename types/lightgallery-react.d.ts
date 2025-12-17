declare module 'lightgallery/react' {
  import * as React from 'react';
  type Plugin = any;
  interface LightGalleryProps {
    children?: React.ReactNode;
    plugins?: Plugin[];
    selector?: string;
    speed?: number;
    elementClassNames?: string;
    download?: boolean;
    licenseKey?: string;
    dynamic?: boolean;
    dynamicEl?: Array<{ src: string; thumb?: string; subHtml?: string }>;
    onInit?: (detail: { instance: any }) => void;
    // thumbnail plugin options (subset)
    thumbnail?: boolean;
    showThumbByDefault?: boolean;
  }
  const LightGallery: React.ComponentType<LightGalleryProps>;
  export default LightGallery;
}

declare module 'lightgallery/plugins/zoom' {
  const plugin: any;
  export default plugin;
}

declare module 'lightgallery/plugins/thumbnail' {
  const plugin: any;
  export default plugin;
}
