import { db } from '../firebase';
import { collection, query, where, getDocs, documentId } from 'firebase/firestore';

/**
 * Firestore のバッチクエリユーティリティ
 * N+1問題を解決するために、複数のドキュメントを効率的に取得する
 */

/**
 * 配列を指定サイズのチャンクに分割
 * Firestore の `in` クエリは最大10件までの制限があるため使用
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/**
 * 複数のユーザーを一括取得
 * 
 * @param uids - 取得するユーザーIDの配列
 * @returns ユーザー情報の Map (uid → user data)
 * 
 * @example
 * ```typescript
 * const userIds = ['user1', 'user2', 'user3'];
 * const users = await batchGetUsers(userIds);
 * const user1 = users.get('user1');
 * ```
 */
export async function batchGetUsers(uids: string[]): Promise<Map<string, any>> {
  if (uids.length === 0) return new Map();

  // 重複を除去
  const uniqueUids = Array.from(new Set(uids));
  const result = new Map<string, any>();

  // Firestore の `in` クエリは最大10件まで
  const chunks = chunkArray(uniqueUids, 10);

  await Promise.all(
    chunks.map(async (chunk) => {
      try {
        const q = query(
          collection(db, 'users'),
          where(documentId(), 'in', chunk)
        );
        const snapshot = await getDocs(q);
        snapshot.forEach((doc) => {
          result.set(doc.id, { uid: doc.id, ...doc.data() });
        });
      } catch (e) {
        console.warn('batchGetUsers chunk failed', e);
        // チャンクが失敗しても他のチャンクは続行
      }
    })
  );

  return result;
}

/**
 * 複数のアルバムの画像を一括取得
 * 
 * @param albumIds - アルバムIDの配列
 * @returns アルバムIDをキーとした画像配列の Map
 */
export async function batchGetAlbumImages(albumIds: string[]): Promise<Map<string, any[]>> {
  if (albumIds.length === 0) return new Map();

  const uniqueAlbumIds = Array.from(new Set(albumIds));
  const result = new Map<string, any[]>();

  // 各アルバムIDを初期化
  uniqueAlbumIds.forEach((id) => result.set(id, []));

  // アルバムIDごとにクエリ（並列実行）
  await Promise.all(
    uniqueAlbumIds.map(async (albumId) => {
      try {
        const q = query(
          collection(db, 'albumImages'),
          where('albumId', '==', albumId)
        );
        const snapshot = await getDocs(q);
        const images: any[] = [];
        snapshot.forEach((doc) => {
          images.push({ id: doc.id, ...doc.data() });
        });
        result.set(albumId, images);
      } catch (e) {
        console.warn(`batchGetAlbumImages failed for ${albumId}`, e);
        // 失敗しても空配列で続行
      }
    })
  );

  return result;
}

/**
 * 複数のアルバムのコメントを一括取得
 * 
 * @param albumIds - アルバムIDの配列
 * @param limitPerAlbum - 各アルバムごとの最大コメント数（デフォルト: 50）
 * @returns アルバムIDをキーとしたコメント配列の Map
 */
export async function batchGetAlbumComments(
  albumIds: string[],
  limitPerAlbum: number = 50
): Promise<Map<string, any[]>> {
  if (albumIds.length === 0) return new Map();

  const uniqueAlbumIds = Array.from(new Set(albumIds));
  const result = new Map<string, any[]>();

  uniqueAlbumIds.forEach((id) => result.set(id, []));

  await Promise.all(
    uniqueAlbumIds.map(async (albumId) => {
      try {
        const q = query(
          collection(db, 'comments'),
          where('albumId', '==', albumId)
        );
        const snapshot = await getDocs(q);
        const comments: any[] = [];
        snapshot.forEach((doc) => {
          comments.push({ id: doc.id, ...doc.data() });
        });
        result.set(albumId, comments);
      } catch (e) {
        console.warn(`batchGetAlbumComments failed for ${albumId}`, e);
      }
    })
  );

  return result;
}

/**
 * 複数のアルバムのいいね数を一括取得
 * 
 * @param albumIds - アルバムIDの配列
 * @returns アルバムIDをキーとしたいいね数の Map
 */
export async function batchCountLikes(albumIds: string[]): Promise<Map<string, number>> {
  if (albumIds.length === 0) return new Map();

  const uniqueAlbumIds = Array.from(new Set(albumIds));
  const result = new Map<string, number>();

  uniqueAlbumIds.forEach((id) => result.set(id, 0));

  await Promise.all(
    uniqueAlbumIds.map(async (albumId) => {
      try {
        const q = query(
          collection(db, 'likes'),
          where('albumId', '==', albumId)
        );
        const snapshot = await getDocs(q);
        result.set(albumId, snapshot.size);
      } catch (e) {
        console.warn(`batchCountLikes failed for ${albumId}`, e);
      }
    })
  );

  return result;
}

/**
 * 複数のアルバムのリポスト数を一括取得
 * 
 * @param albumIds - アルバムIDの配列
 * @returns アルバムIDをキーとしたリポスト数の Map
 */
export async function batchCountReposts(albumIds: string[]): Promise<Map<string, number>> {
  if (albumIds.length === 0) return new Map();

  const uniqueAlbumIds = Array.from(new Set(albumIds));
  const result = new Map<string, number>();

  uniqueAlbumIds.forEach((id) => result.set(id, 0));

  await Promise.all(
    uniqueAlbumIds.map(async (albumId) => {
      try {
        const q = query(
          collection(db, 'reposts'),
          where('albumId', '==', albumId)
        );
        const snapshot = await getDocs(q);
        result.set(albumId, snapshot.size);
      } catch (e) {
        console.warn(`batchCountReposts failed for ${albumId}`, e);
      }
    })
  );

  return result;
}

/**
 * 複数のアルバムのリアクションを一括取得
 * 
 * @param albumIds - アルバムIDの配列
 * @returns アルバムIDをキーとしたリアクション配列の Map
 */
export async function batchGetAlbumReactions(albumIds: string[]): Promise<Map<string, any[]>> {
  if (albumIds.length === 0) return new Map();

  const uniqueAlbumIds = Array.from(new Set(albumIds));
  const result = new Map<string, any[]>();

  uniqueAlbumIds.forEach((id) => result.set(id, []));

  await Promise.all(
    uniqueAlbumIds.map(async (albumId) => {
      try {
        const q = query(
          collection(db, 'reactions'),
          where('albumId', '==', albumId)
        );
        const snapshot = await getDocs(q);
        const reactions: any[] = [];
        snapshot.forEach((doc) => {
          reactions.push({ id: doc.id, ...doc.data() });
        });
        result.set(albumId, reactions);
      } catch (e) {
        console.warn(`batchGetAlbumReactions failed for ${albumId}`, e);
      }
    })
  );

  return result;
}

/**
 * ユーザーの複数アルバムへのいいね状態を一括取得
 * 
 * @param albumIds - アルバムIDの配列
 * @param userId - ユーザーID
 * @returns アルバムIDをキーとしたいいね状態の Map
 */
export async function batchCheckUserLikes(
  albumIds: string[],
  userId: string
): Promise<Map<string, boolean>> {
  if (albumIds.length === 0) return new Map();

  const uniqueAlbumIds = Array.from(new Set(albumIds));
  const result = new Map<string, boolean>();

  uniqueAlbumIds.forEach((id) => result.set(id, false));

  try {
    // userId でフィルタして、該当するいいねを一括取得
    const q = query(
      collection(db, 'likes'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const albumId = data.albumId;
      if (albumId && uniqueAlbumIds.includes(albumId)) {
        result.set(albumId, true);
      }
    });
  } catch (e) {
    console.warn('batchCheckUserLikes failed', e);
  }

  return result;
}

/**
 * ユーザーの複数アルバムへのリポスト状態を一括取得
 * 
 * @param albumIds - アルバムIDの配列
 * @param userId - ユーザーID
 * @returns アルバムIDをキーとしたリポスト状態の Map
 */
export async function batchCheckUserReposts(
  albumIds: string[],
  userId: string
): Promise<Map<string, boolean>> {
  if (albumIds.length === 0) return new Map();

  const uniqueAlbumIds = Array.from(new Set(albumIds));
  const result = new Map<string, boolean>();

  uniqueAlbumIds.forEach((id) => result.set(id, false));

  try {
    const q = query(
      collection(db, 'reposts'),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const albumId = data.albumId;
      if (albumId && uniqueAlbumIds.includes(albumId)) {
        result.set(albumId, true);
      }
    });
  } catch (e) {
    console.warn('batchCheckUserReposts failed', e);
  }

  return result;
}
