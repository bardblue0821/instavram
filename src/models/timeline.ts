export type UserRef = {
  uid: string;
  handle: string | null;
  iconURL?: string | null;
  displayName?: string;
};

export type AlbumVM = { id: string; ownerId: string; title?: string | null; createdAt?: any };

export type ImgVM = { url: string; thumbUrl?: string; uploaderId?: string };

export type ReactionVM = { emoji: string; count: number; mine: boolean };

export type LatestCommentVM = { body: string; userId: string } | undefined;

export type CommentPreviewVM = {
  body: string;
  userId: string;
  user?: UserRef;
  createdAt?: any;
};

export type ImageAddedVM = {
  userId: string;
  user?: UserRef;
  createdAt?: any;
};

export type TimelineItemVM = {
  album: AlbumVM;
  images: ImgVM[];
  likeCount: number;
  liked: boolean;
  commentCount?: number;
  latestComment?: LatestCommentVM;
  commentsPreview?: CommentPreviewVM[];
  reactions: ReactionVM[];
  owner?: UserRef | null;
  imageAdded?: ImageAddedVM;
};
