import { TimelineItemVM, UserRef } from "@/src/models/timeline";
import { fetchLatestAlbums } from "@/lib/repos/timelineRepo";
import { listAcceptedFriends } from "@/lib/repos/friendRepo";
import { listWatchedOwnerIds } from "@/lib/repos/watchRepo";
import { getUser } from "@/lib/repos/userRepo";
import { listImages } from "@/lib/repos/imageRepo";
import { listComments } from "@/lib/repos/commentRepo";
import { countLikes, hasLiked } from "@/lib/repos/likeRepo";
import { listReactionsByAlbum } from "@/lib/repos/reactionRepo";

function toUserRef(u: any | null): UserRef | null {
  if (!u) return null;
  return { uid: u.uid, handle: u.handle || null, iconURL: u.iconURL || null, displayName: u.displayName };
}

export async function listLatestAlbumsVM(currentUserId: string, userCache?: Map<string, UserRef | null>): Promise<TimelineItemVM[]> {
  // 対象オーナーIDsを構築（自分 + フレンド + ウォッチ）
  const ownerSet = new Set<string>();
  ownerSet.add(currentUserId);
  try {
    const [friends, watched] = await Promise.all([
      listAcceptedFriends(currentUserId),
      listWatchedOwnerIds(currentUserId),
    ]);
    for (const f of friends) {
      const other = f.userId === currentUserId ? f.targetId : f.userId;
      if (other) ownerSet.add(other);
    }
    for (const w of watched) ownerSet.add(w);
  } catch (e) {
    // フレンド/ウォッチ取得失敗時は対象なし（後で全表示に緩和したければここを変更）
    console.warn("friend/watch fetch error", e);
  }

  const ownerIds = Array.from(ownerSet);
  const albums = await fetchLatestAlbums(50, ownerIds);
  const cache = userCache ?? new Map<string, UserRef | null>();

  const enriched: TimelineItemVM[] = await Promise.all(
    albums.map(async (album: any) => {
      let owner = cache.get(album.ownerId);
      if (owner === undefined) {
        const u = await getUser(album.ownerId);
        owner = toUserRef(u);
        cache.set(album.ownerId, owner);
      }
      const [imgs, cmts, likeCnt, likedFlag, reactions] = await Promise.all([
        listImages(album.id),
        listComments(album.id),
        countLikes(album.id),
        hasLiked(album.id, currentUserId),
        listReactionsByAlbum(album.id, currentUserId),
      ]);
      const cAsc = [...cmts]
        .sort((a, b) => (a.createdAt?.seconds || a.createdAt || 0) - (b.createdAt?.seconds || b.createdAt || 0));
      const latest = cAsc.slice(-1)[0];
      const previewDesc = cAsc.slice(-3).reverse();
      const commentsPreview = await Promise.all(previewDesc.map(async (c) => {
        let cu = cache.get(c.userId);
        if (cu === undefined) {
          const u = await getUser(c.userId);
          cu = toUserRef(u);
          cache.set(c.userId, cu);
        }
        return { body: c.body, userId: c.userId, user: cu || undefined, createdAt: c.createdAt };
      }));
      const imgRows = (imgs || [])
        .map((x: any) => ({
          url: x.url || x.downloadUrl || "",
          thumbUrl: x.thumbUrl || x.url || x.downloadUrl || "",
          uploaderId: x.uploaderId,
        }))
        .filter((x: any) => x.url);
      return {
        album,
        images: imgRows,
        likeCount: likeCnt,
        liked: !!likedFlag,
        commentCount: (cmts || []).length,
        latestComment: latest ? { body: latest.body, userId: latest.userId } : undefined,
        commentsPreview,
        reactions,
        owner,
      } as TimelineItemVM;
    })
  );

  return enriched;
}
