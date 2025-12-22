import { TimelineItemVM, UserRef } from "@/src/models/timeline";
import { fetchLatestAlbums } from "@/lib/repos/timelineRepo";
import { listAcceptedFriends } from "@/lib/repos/friendRepo";
import { listWatchedOwnerIds } from "@/lib/repos/watchRepo";
import { getUser } from "@/lib/repos/userRepo";
import { listImages } from "@/lib/repos/imageRepo";
import { listComments } from "@/lib/repos/commentRepo";
import { countLikes, hasLiked } from "@/lib/repos/likeRepo";
import { listReactionsByAlbum } from "@/lib/repos/reactionRepo";
import { countReposts, hasReposted, listRecentRepostsByUsers, getRepost } from "@/lib/repos/repostRepo";
import { getAlbum } from "@/lib/repos/albumRepo";

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

  // Reposts: collect recent reposts by friends & watched users
  let recentReposts: Array<{ albumId: string; userId: string; createdAt: any }> = [];
  try {
    // 自分自身のリポストもタイムラインに反映するため、self 除外をやめる
    const actorIds = Array.from(new Set<string>(ownerIds));
    if (actorIds.length > 0) {
      recentReposts = await listRecentRepostsByUsers(actorIds, 50);
    }
  } catch (e) {
    console.warn("listRecentReposts error", e);
  }
  // Map albumId -> latest repost info by those actors
  const latestRepostByAlbum = new Map<string, { userId: string; createdAt: any }>();
  for (const r of recentReposts) {
    const prev = latestRepostByAlbum.get(r.albumId);
    // pick latest
    const prevMs = toMillis(prev?.createdAt) || 0;
    const curMs = toMillis(r.createdAt) || 0;
    if (!prev || curMs > prevMs) latestRepostByAlbum.set(r.albumId, { userId: r.userId, createdAt: r.createdAt });
  }

  // Ensure albums referenced only by reposts are included as well
  const albumIdSet = new Set(albums.map((a: any) => a.id));
  const missingIds = Array.from(latestRepostByAlbum.keys()).filter(id => !albumIdSet.has(id));
  const missingAlbums = await Promise.all(missingIds.map(id => getAlbum(id)));
  const mergedAlbums = [...albums, ...missingAlbums.filter(a => !!a)];

  const enriched: TimelineItemVM[] = await Promise.all(
    mergedAlbums.map(async (album: any) => {
      let owner = cache.get(album.ownerId);
      if (owner === undefined) {
        const u = await getUser(album.ownerId);
        owner = toUserRef(u);
        cache.set(album.ownerId, owner);
      }
      // reposts 系はルール未反映などで permission-denied の可能性があるため、
      // タイムライン全体を落とさないように安全にフォールバックする
      const safeCountReposts = countReposts(album.id).catch((e) => { console.warn('countReposts failed', e); return 0; });
      const safeHasReposted = hasReposted(album.id, currentUserId).catch((e) => { console.warn('hasReposted failed', e); return false; });
      const [imgs, cmts, likeCnt, likedFlag, reactions, repostCnt, repostedFlag] = await Promise.all([
        listImages(album.id),
        listComments(album.id),
        countLikes(album.id),
        hasLiked(album.id, currentUserId),
        listReactionsByAlbum(album.id, currentUserId),
        safeCountReposts,
        safeHasReposted,
      ]);

      // 「誰かが画像を追加しました」表示用: 最新画像の uploader が owner 以外のときに表示
      let imageAdded: any = undefined;
      try {
        const latestImg = ((imgs as any[]) || [])
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
      // Reposted banner: 優先は「友人/ウォッチ（含む自分）の最新リポスター」。
      // それが無いが自分はリポスト済みのときは、自分のリポストでバナーを補完（createdAt を取得）。
      let repostedBy: any = undefined;
      const lr = latestRepostByAlbum.get(album.id);
      if (lr) {
        let ru = cache.get(lr.userId);
        if (ru === undefined) {
          const u = await getUser(lr.userId);
          ru = toUserRef(u);
          cache.set(lr.userId, ru);
        }
        repostedBy = { userId: lr.userId, user: ru || undefined, createdAt: lr.createdAt };
      } else if (repostedFlag) {
        try {
          const mine = await getRepost(album.id, currentUserId);
          if (mine) {
            let ru = cache.get(currentUserId);
            if (ru === undefined) {
              const u = await getUser(currentUserId);
              ru = toUserRef(u);
              cache.set(currentUserId, ru);
            }
            repostedBy = { userId: currentUserId, user: ru || undefined, createdAt: mine.createdAt };
          }
        } catch (e) {
          // 失敗時は無視
        }
      }

      return {
        album,
        images: imgRows,
        likeCount: likeCnt,
        liked: !!likedFlag,
        repostCount: repostCnt,
        reposted: !!repostedFlag,
        commentCount: (cmts || []).length,
        latestComment: latest ? { body: latest.body, userId: latest.userId } : undefined,
        commentsPreview,
        reactions,
        owner,
        imageAdded,
        repostedBy,
      } as TimelineItemVM;
    })
  );

  // Sort by latest activity: prefer latest repost time if exists, else album.createdAt
  const sorted = enriched.slice().sort((a, b) => {
    const aKey = toMillis(a.repostedBy?.createdAt) || toMillis(a.album.createdAt) || 0;
    const bKey = toMillis(b.repostedBy?.createdAt) || toMillis(b.album.createdAt) || 0;
    return bKey - aKey;
  });

  return sorted;
}
