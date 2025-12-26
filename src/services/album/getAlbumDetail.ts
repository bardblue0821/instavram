import type { AlbumDetailVM, AlbumVM, ImgVM, CommentVM, ReactionVM, UserRef } from "@/src/models/album";
import { getAlbumSafe } from "@/lib/repos/albumRepo";
import { listImages } from "@/lib/repos/imageRepo";
import { listComments } from "@/lib/repos/commentRepo";
import { listReactionsByAlbum } from "@/lib/repos/reactionRepo";
import { hasLiked, countLikes } from "@/lib/repos/likeRepo";
import { getUser } from "@/lib/repos/userRepo";
import { getFriendStatus } from "@/lib/repos/friendRepo";
import { isWatched } from "@/lib/repos/watchRepo";

export async function getAlbumDetailVM(albumId: string, currentUserId?: string, userCache?: Map<string, UserRef | null>): Promise<AlbumDetailVM | null> {
  const snap = await getAlbumSafe(albumId);
  if (!snap) return null;
  const album: AlbumVM = {
    id: snap.id,
    ownerId: snap.ownerId,
    title: snap.title ?? null,
    placeUrl: snap.placeUrl ?? null,
    visibility: (snap.visibility === 'friends' ? 'friends' : 'public'),
  };
  const imgsRaw = await listImages(albumId);
  const images: ImgVM[] = (imgsRaw || [])
    .map((x: any) => ({ id: x.id, url: x.url || x.downloadUrl || "", thumbUrl: x.thumbUrl || null, uploaderId: x.uploaderId ?? null, createdAt: x.createdAt }))
    .filter((x) => !!x.url)
    .sort((a, b) => (b.createdAt?.seconds || b.createdAt || 0) - (a.createdAt?.seconds || a.createdAt || 0));

  const cmtsRaw = await listComments(albumId);
  const commentsAsc: CommentVM[] = (cmtsRaw || [])
    .map((c: any) => ({ id: c.id, body: c.body, userId: c.userId, createdAt: c.createdAt }))
    .sort((a, b) => (a.createdAt?.seconds || a.createdAt || 0) - (b.createdAt?.seconds || b.createdAt || 0));

  const [likedFlag, likeCnt] = await Promise.all([
    currentUserId ? hasLiked(albumId, currentUserId) : Promise.resolve(false),
    countLikes(albumId),
  ]);

  const reactions: ReactionVM[] = await listReactionsByAlbum(albumId, currentUserId);

  let owner: UserRef | null | undefined = undefined;
  if (userCache) {
    owner = userCache.get(album.ownerId);
  }
  if (owner === undefined) {
    const u = await getUser(album.ownerId);
    owner = u ? { uid: u.uid, handle: u.handle || null, iconURL: u.iconURL || null, displayName: u.displayName } : null;
    if (userCache) userCache.set(album.ownerId, owner);
  }

  // 権限判定
  const isOwner = !!(currentUserId && currentUserId === album.ownerId);
  
  let isFriend = false;
  let isWatcher = false;
  if (currentUserId) {
    try {
      const [forward, backward, watched] = await Promise.all([
        getFriendStatus(currentUserId, album.ownerId),
        getFriendStatus(album.ownerId, currentUserId),
        isWatched(currentUserId, album.ownerId),
      ]);
      isFriend = (forward === 'accepted') || (backward === 'accepted');
      isWatcher = !!watched;
    } catch {
      isFriend = false;
      isWatcher = false;
    }
  }

  // フレンド限定の場合、オーナーまたはフレンド以外は閲覧不可（404相当）
  if (album.visibility === 'friends' && !(isOwner || isFriend)) {
    return null;
  }

  return {
    album,
    images,
    commentsAsc,
    likeCount: likeCnt,
    liked: likedFlag,
    reactions,
    owner,
    isOwner,
    isFriend,
    isWatcher,
  };
}
