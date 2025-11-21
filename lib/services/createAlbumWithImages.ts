import { db, storage } from '../../lib/firebase';
import { COL } from '../../lib/paths';
import { doc, setDoc, collection } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { addImage } from '../repos/imageRepo';
import { addComment } from '../repos/commentRepo';

interface CreateAlbumOptions { title?: string; placeUrl?: string; firstComment?: string }
export interface AlbumCreateProgress {
  fileIndex: number; // 0-based
  total: number; // 総ファイル数
  percent: number; // このファイル単体の進捗 0-100
  overallPercent: number; // 全ファイル bytes 基準の総合進捗 0-100
  state: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

/**
 * アルバム作成フロー: 画像アップロード → albumImages 保存 → album 作成 → 初回コメント
 * 画像は最大4枚。firstComment が空または空白のみならコメント追加しない。
 */
export async function createAlbumWithImages(
  ownerId: string,
  opts: CreateAlbumOptions,
  files: File[],
  onProgress?: (p: AlbumCreateProgress) => void,
): Promise<string> {
  if (files.length > 4) throw new Error('LIMIT_4_PER_USER');
  if (opts.firstComment && opts.firstComment.length > 200) throw new Error('TOO_LONG');

  // 事前にアルバムIDを確保
  const albumRef = doc(collection(db, COL.albums));
  const albumId = albumRef.id;
  const now = new Date();

  // 全体進捗のため bytes 合計
  const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  let completedBytes = 0;
  const perFileBytesTransferred: number[] = files.map(() => 0);

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = extractExt(file.name);
    const path = `albums/${albumId}/${ownerId}/${Date.now()}_${i}.${ext}`;
    const storageRef = ref(storage, path);
    const task = uploadBytesResumable(storageRef, file);

    await new Promise<void>((resolve, reject) => {
      task.on('state_changed', (snap) => {
        // 差分 bytes を更新
        perFileBytesTransferred[i] = snap.bytesTransferred;
        const percent = snap.totalBytes > 0 ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
        const aggregateTransferred = perFileBytesTransferred.reduce((a, b) => a + b, 0);
        const overallPercent = totalBytes > 0 ? Math.min(100, Math.round((aggregateTransferred / totalBytes) * 100)) : percent;
        onProgress?.({ fileIndex: i, total: files.length, percent, overallPercent, state: 'uploading' });
      }, (err) => {
        onProgress?.({ fileIndex: i, total: files.length, percent: 0, overallPercent: Math.round((completedBytes / totalBytes) * 100), state: 'error', error: err.code || err.message });
        reject(err);
      }, async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          await addImage(albumId, ownerId, url);
          perFileBytesTransferred[i] = snapSafeBytes(task);
          completedBytes = perFileBytesTransferred.reduce((a, b) => a + b, 0);
          const overallPercent = totalBytes > 0 ? Math.min(100, Math.round((completedBytes / totalBytes) * 100)) : 100;
          onProgress?.({ fileIndex: i, total: files.length, percent: 100, overallPercent, state: 'success' });
          resolve();
        } catch (e: any) {
          onProgress?.({ fileIndex: i, total: files.length, percent: 100, overallPercent: Math.round((completedBytes / totalBytes) * 100), state: 'error', error: e.message });
          reject(e);
        }
      });
    });
  }

  // アルバム作成
  await setDoc(albumRef, {
    id: albumId,
    ownerId,
    title: opts.title || null,
    placeUrl: opts.placeUrl || null,
    createdAt: now,
    updatedAt: now,
  });

  // 初回コメント
  if (opts.firstComment && opts.firstComment.trim()) {
    await addComment(albumId, ownerId, opts.firstComment.trim());
  }

  return albumId;
}

function extractExt(name: string): string {
  const m = name.match(/\.([a-zA-Z0-9]+)$/);
  if (!m) return 'bin';
  return m[1].toLowerCase();
}

function snapSafeBytes(task: ReturnType<typeof uploadBytesResumable>): number {
  try {
    return task.snapshot.totalBytes; // 完了後は totalBytes == bytesTransferred
  } catch {
    return 0;
  }
}
