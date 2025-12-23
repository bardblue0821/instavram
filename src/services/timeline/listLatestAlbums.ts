import { TimelineItemVM, UserRef } from "@/src/models/timeline";
import { fetchLatestAlbums } from "@/lib/repos/timelineRepo";
import { listAcceptedFriends } from "@/lib/repos/friendRepo";
import { listWatchedOwnerIds } from "@/lib/repos/watchRepo";
import { getUser } from "@/lib/repos/userRepo";
import { listImages } from "@/lib/repos/imageRepo";
import { listComments } from "@/lib/repos/commentRepo";
import { countLikes, hasLiked } from "@/lib/repos/likeRepo";
import { listReactionsByAlbum } from "@/lib/repos/reactionRepo";
import { countReposts, hasReposted, getRepost, listRepostsByAlbumRaw } from "@/lib/repos/repostRepo";
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
  const friendOwnerSet = new Set<string>();
  try {
    const [friends, watched] = await Promise.all([
      listAcceptedFriends(currentUserId),
      listWatchedOwnerIds(currentUserId),
    ]);
    for (const f of friends) {
      const other = f.userId === currentUserId ? f.targetId : f.userId;
      if (other) { ownerSet.add(other); friendOwnerSet.add(other); }
    }
    for (const w of watched) ownerSet.add(w);
  } catch (e) {
    console.warn("friend/watch fetch error", e);
  }

  const ownerIds = Array.from(ownerSet);
  // フレンドでない（ウォッチのみ等）オーナーは公開アルバムのみ取得するように制約
  const publicOnlyOwners = new Set<string>(
    ownerIds.filter((oid) => oid !== currentUserId && !friendOwnerSet.has(oid))
  );
  const albums = await fetchLatestAlbums(Math.max(1, limitCount), ownerIds, publicOnlyOwners);
  const cache = userCache ?? new Map<string, UserRef | null>();

  // Map albumId -> latest repost info by friends/watchers/self（アルバム単位で取得：ルールと整合）
  const latestRepostByAlbum = new Map<string, { userId: string; createdAt: any }>();

  // Ensure albums referenced only by reposts are included as well
  const albumIdSet = new Set(albums.map((a: any) => a.id));
  const missingIds = Array.from(latestRepostByAlbum.keys()).filter(id => !albumIdSet.has(id));
  const missingAlbums = await Promise.all(missingIds.map(id => getAlbum(id)));
  const mergedAlbums = [...albums, ...missingAlbums.filter(a => !!a)];
  // Filter private albums: only owner or friends can see
  const filteredAlbums = mergedAlbums.filter((a: any) => {
    const vis = a?.visibility;
    if (vis === 'friends') {
      return (a.ownerId === currentUserId) || friendOwnerSet.has(a.ownerId);
    }
    return true; // default public
  });

  // ここでアルバムごとにリポスト行を取得し、友人/ウォッチ（含む自分）の最新を採用
  try {
    const actorIds = Array.from(new Set<string>(ownerIds));
    await Promise.all(filteredAlbums.map(async (album: any) => {
      try {
        const rows = await listRepostsByAlbumRaw(album.id, 200);
        let best: { userId: string; createdAt: any } | null = null;
        for (const r of rows) {
          if (!actorIds.includes(r.userId)) continue;
          const prevMs = toMillis(best?.createdAt) || 0;
          const curMs = toMillis(r.createdAt) || 0;
          if (!best || curMs > prevMs) best = { userId: r.userId, createdAt: r.createdAt };
        }
        if (best) latestRepostByAlbum.set(album.id, best);
      } catch (e) {
        console.warn('listRepostsByAlbumRaw error', album.id, e);
      }
    }));
  } catch (e) {
    console.warn('build latestRepostByAlbum failed', e);
  }

  const perAlbumRows: TimelineItemVM[][] = await Promise.all(
    filteredAlbums.map(async (album: any) => {
      // 個別クエリで permission-denied 等が出てもタイムライン全体が落ちないように、
      // 小さなフォールバックで防御するユーティリティ
      async function safe<T>(label: string, p: Promise<T>, fallback: T): Promise<T> {
        try {
          return await p;
        } catch (e) {
          console.warn(`[timeline] ${label} failed for album ${album?.id}`, e);
          return fallback;
        }
      }

      let owner = cache.get(album.ownerId);
      if (owner === undefined) {
        const u = await getUser(album.ownerId);
        owner = toUserRef(u);
        cache.set(album.ownerId, owner);
      }
      // reposts 系はルール未反映などで permission-denied の可能性があるため、
      // タイムライン全体を落とさないように安全にフォールバックする
      const [imgs, cmts, likeCnt, likedFlag, reactions, repostCnt, repostedFlag] = await Promise.all([
        safe('listImages', listImages(album.id), [] as any[]),
        safe('listComments', listComments(album.id), [] as any[]),
        safe('countLikes', countLikes(album.id), 0),
        safe('hasLiked', hasLiked(album.id, currentUserId), false),
        safe('listReactionsByAlbum', listReactionsByAlbum(album.id, currentUserId), [] as any[]),
        safe('countReposts', countReposts(album.id), 0),
        safe('hasReposted', hasReposted(album.id, currentUserId), false),
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

      const base: Omit<TimelineItemVM, 'imageAdded'|'repostedBy'> & { imageAdded?: any; repostedBy?: any } = {
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
      } as any;

      const rows: TimelineItemVM[] = [];
      // 画像追加エントリ
      if (imageAdded) {
        rows.push({ ...base, imageAdded, repostedBy: undefined } as TimelineItemVM);
      }
      // リポストエントリ
      if (repostedBy) {
        rows.push({ ...base, repostedBy, imageAdded: undefined } as TimelineItemVM);
      }
      // どちらも無い場合のみベースを追加
      if (!imageAdded && !repostedBy) {
        rows.push({ ...base, imageAdded: undefined, repostedBy: undefined } as TimelineItemVM);
      }
      return rows;
    })
  );
  const enriched: TimelineItemVM[] = ([] as TimelineItemVM[]).concat(...perAlbumRows);

  // Sort by latest activity: prefer repost time, then image-added time, else album.createdAt
  const sorted = enriched.slice().sort((a, b) => {
    const aKey = toMillis(a.repostedBy?.createdAt) || toMillis((a as any).imageAdded?.createdAt) || toMillis(a.album.createdAt) || 0;
    const bKey = toMillis(b.repostedBy?.createdAt) || toMillis((b as any).imageAdded?.createdAt) || toMillis(b.album.createdAt) || 0;
    return bKey - aKey;
  });

  return sorted;
}
