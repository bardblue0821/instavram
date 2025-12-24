import { db, storage } from '../../lib/firebase';
import { COL } from '../../lib/paths';
import { doc, setDoc, collection, deleteDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { addImage, canUploadMoreImages } from '../repos/imageRepo';
import { addComment } from '../repos/commentRepo';

interface CreateAlbumOptions { title?: string; placeUrl?: string; firstComment?: string; visibility?: 'public' | 'friends' }
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
  console.log('[album:create] start', { ownerId, files: files.map(f => ({ name: f.name, size: f.size })) , opts });
  if (files.length === 0) throw new Error('ALBUM_REQUIRES_IMAGE');
  if (files.length > 4) throw new Error('LIMIT_4_PER_USER');
  if (opts.firstComment && opts.firstComment.length > 200) throw new Error('TOO_LONG');

  // 事前にアルバムIDを確保
  const albumRef = doc(collection(db, COL.albums));
  const albumId = albumRef.id;
  const now = new Date();

  // ★ アルバムドキュメントを先に作成（セキュリティルールのため）
  await setDoc(albumRef, {
    id: albumId,
    ownerId,
    title: opts.title || null,
    placeUrl: opts.placeUrl || null,
    visibility: (opts.visibility === 'friends' ? 'friends' : 'public'),
    createdAt: now,
    updatedAt: now,
  });
  console.log('[album:create] album doc created first', { albumId, ownerId });

  try {
    // 全体進捗のため bytes 合計
    const totalBytes = files.reduce((sum, f) => sum + (f.size || 0), 0);
  let completedBytes = 0;
  const perFileBytesTransferred: number[] = files.map(() => 0);

  for (let i = 0; i < files.length; i++) {
    const canUpload = await canUploadMoreImages(albumId, ownerId);
    if (!canUpload) {
      throw new Error('LIMIT_4_PER_USER');
    }
    const file = files[i];
    const ext = extractExt(file.name);
    const path = `albums/${albumId}/${ownerId}/${Date.now()}_${i}.${ext}`;
    const storageRef = ref(storage, path);
    console.log('[album:create] upload start', { index: i, name: file.name, size: file.size, path });
    const task = uploadBytesResumable(storageRef, file);

    await new Promise<void>((resolve, reject) => {
      task.on('state_changed', (snap) => {
        // 差分 bytes を更新
        perFileBytesTransferred[i] = snap.bytesTransferred;
        const percent = snap.totalBytes > 0 ? Math.round((snap.bytesTransferred / snap.totalBytes) * 100) : 0;
        const aggregateTransferred = perFileBytesTransferred.reduce((a, b) => a + b, 0);
        const overallPercent = totalBytes > 0 ? Math.min(100, Math.round((aggregateTransferred / totalBytes) * 100)) : percent;
        onProgress?.({ fileIndex: i, total: files.length, percent, overallPercent, state: 'uploading' });
        if (i === 0 || percent % 25 === 0) {
          console.log('[album:create] uploading', { index: i, percent, overallPercent, bytes: snap.bytesTransferred, totalBytes: snap.totalBytes });
        }
      }, (err) => {
        console.error('[album:create] upload error', { index: i, error: err });
        onProgress?.({ fileIndex: i, total: files.length, percent: 0, overallPercent: Math.round((completedBytes / totalBytes) * 100), state: 'error', error: err.code || err.message });
        reject(err);
      }, async () => {
        try {
          const url = await getDownloadURL(task.snapshot.ref);
          console.log('[album:create] upload success', { index: i, url });
          await addImage(albumId, ownerId, url);
          console.log('[album:create] image doc added', { index: i, albumId, ownerId });
          perFileBytesTransferred[i] = snapSafeBytes(task);
          completedBytes = perFileBytesTransferred.reduce((a, b) => a + b, 0);
          const overallPercent = totalBytes > 0 ? Math.min(100, Math.round((completedBytes / totalBytes) * 100)) : 100;
          onProgress?.({ fileIndex: i, total: files.length, percent: 100, overallPercent, state: 'success' });
          resolve();
        } catch (e: any) {
          console.error('[album:create] post-upload processing error', { index: i, error: e });
          onProgress?.({ fileIndex: i, total: files.length, percent: 100, overallPercent: Math.round((completedBytes / totalBytes) * 100), state: 'error', error: e.message });
          reject(e);
        }
      });
    });
  }

  // 初回コメント
  if (opts.firstComment && opts.firstComment.trim()) {
    console.log('[album:create] adding first comment');
    await addComment(albumId, ownerId, opts.firstComment.trim());
    console.log('[album:create] first comment added');
  }

  console.log('[album:create] done', { albumId });
  return albumId;
  } catch (error) {
    // エラー時はアルバムドキュメントを削除（クリーンアップ）
    console.error('[album:create] error occurred, cleaning up album doc', { albumId, error });
    try {
      await deleteDoc(albumRef);
      console.log('[album:create] album doc deleted', { albumId });
    } catch (cleanupError) {
      console.error('[album:create] cleanup failed', { albumId, cleanupError });
    }
    throw error;
  }
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
