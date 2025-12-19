export type UserRef = {
  uid: string;
  displayName: string;
  handle: string | null;
  iconURL: string | null;
};

export type AlbumVM = {
  id: string;
  ownerId: string;
  title?: string | null;
  placeUrl?: string | null;
};

export type ImgVM = {
  id: string;
  url: string;
  thumbUrl?: string | null;
  uploaderId?: string | null;
  createdAt?: any;
};

export type CommentVM = {
  id: string;
  body: string;
  userId: string;
  createdAt?: any;
};

export type ReactionVM = {
  emoji: string;
  count: number;
  mine: boolean;
};

export type AlbumDetailVM = {
  album: AlbumVM;
  images: ImgVM[];
  commentsAsc: CommentVM[];
  likeCount: number;
  liked: boolean;
  reactions: ReactionVM[];
  owner?: UserRef | null;
  isOwner: boolean;
  isFriend: boolean;
  isWatcher: boolean;
};
