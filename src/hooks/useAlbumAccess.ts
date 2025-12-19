import { useEffect, useState } from "react";
import { getFriendStatus } from "../../lib/repos/friendRepo";
import { isWatched } from "../../lib/repos/watchRepo";

/**
 * 判定: 現在のユーザーがアルバムオーナーに対してフレンド/ウォッチャーかどうか。
 * 与えるのは ownerId と currentUserId。片方が欠けていれば false を返す。
 */
export function useAlbumAccess(ownerId?: string, currentUserId?: string) {
  const [isFriend, setIsFriend] = useState(false);
  const [isWatcher, setIsWatcher] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ownerId || !currentUserId) {
        if (!cancelled) { setIsFriend(false); setIsWatcher(false); }
        return;
      }
      try {
        const [forward, backward, watched] = await Promise.all([
          getFriendStatus(currentUserId, ownerId),
          getFriendStatus(ownerId, currentUserId),
          isWatched(currentUserId, ownerId),
        ]);
        if (!cancelled) {
          const f = (forward === 'accepted') || (backward === 'accepted');
          setIsFriend(!!f);
          setIsWatcher(!!watched);
        }
      } catch {
        if (!cancelled) { setIsFriend(false); setIsWatcher(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [ownerId, currentUserId]);

  return { isFriend, isWatcher };
}
