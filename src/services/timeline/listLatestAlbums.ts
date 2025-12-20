import { TimelineItemVM, UserRef } from "@/src/models/timeline";
import { fetchLatestAlbums } from "@/lib/repos/timelineRepo";
import { listAcceptedFriends } from "@/lib/repos/friendRepo";
import { listWatchedOwnerIds } from "@/lib/repos/watchRepo";
import { getUser } from "@/lib/repos/userRepo";
import { listImages } from "@/lib/repos/imageRepo";
import { listComments } from "@/lib/repos/commentRepo";
import { countLikes, hasLiked } from "@/lib/repos/likeRepo";
import { listReactionsByAlbum } from "@/lib/repos/reactionRepo";

function toMillis(v: any): number | null {
  if (!v) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v?.toDate === 'function') return v.toDate().getTime();
  if (typeof v === 'object' && typeof v.seconds === 'number') return v.seconds * 1000;
  if (typeof v === 'number') return v > 1e12 ? v : v * 1000;
  return null;
}

function toUserRef(u: any | null): UserRef | null {
  if (!u) return null;
  return { uid: u.uid, handle: u.handle || null, iconURL: u.iconURL || null, displayName: u.displayName };
}

export async function listLatestAlbumsVM(currentUserId: string, userCache?: Map<string, UserRef | null>): Promise<TimelineItemVM[]> {
  return await listLatestAlbumsVMLimited(currentUserId, 50, userCache);
}

export async function listLatestAlbumsVMLimited(
  currentUserId: string,
  limitCount: number,
  userCache?: Map<string, UserRef | null>
): Promise<TimelineItemVM[]> {
  // 既存呼び出し互換のため別関数で提供（timeline の無限ロードで使用）
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
    console.warn("friend/watch fetch error", e);
  }

  const ownerIds = Array.from(ownerSet);
  const albums = await fetchLatestAlbums(Math.max(1, limitCount), ownerIds);
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

      // 「誰かが画像を追加しました」表示用: 最新画像の uploader が owner 以外のときに表示
      let imageAdded: any = undefined;
      try {
        const latestImg = (imgs || [])
          .filter((x: any) => x && (x.createdAt || x.updatedAt) && x.uploaderId)
          .sort((a: any, b: any) => {
            const am = toMillis(a.createdAt || a.updatedAt) || 0;
            const bm = toMillis(b.createdAt || b.updatedAt) || 0;
            return bm - am;
          })[0];

        if (latestImg?.uploaderId && latestImg.uploaderId !== album.ownerId) {
          let au = cache.get(latestImg.uploaderId);
          if (au === undefined) {
            const u = await getUser(latestImg.uploaderId);
            au = toUserRef(u);
            cache.set(latestImg.uploaderId, au);
          }
          imageAdded = { userId: latestImg.uploaderId, user: au || undefined, createdAt: latestImg.createdAt || latestImg.updatedAt };
        }
      } catch {
        imageAdded = undefined;
      }
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
        imageAdded,
      } as TimelineItemVM;
    })
  );

  return enriched;
}
