import { db, storage } from '../../lib/firebase';
import { COL } from '../../lib/paths';
import { doc, setDoc, addDoc, collection } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { addImage } from '../repos/imageRepo';
import { addComment } from '../repos/commentRepo';

interface CreateAlbumOptions { title?: string; placeUrl?: string; firstComment?: string }

/**
 * アルバム作成フロー: 画像アップロード → albumImages 保存 → album 作成 → 初回コメント
 * 画像は最大4枚。firstComment が空または空白のみならコメント追加しない。
 */
export async function createAlbumWithImages(ownerId: string, opts: CreateAlbumOptions, files: File[]): Promise<string> {
  if (files.length > 4) throw new Error('LIMIT_4_PER_USER');
  if (opts.firstComment && opts.firstComment.length > 200) throw new Error('TOO_LONG');

  // 事前にアルバムIDを確保
  const albumRef = doc(collection(db, COL.albums));
  const albumId = albumRef.id;
  const now = new Date();

  // 逐次アップロード
  let index = 0;
  for (const file of files) {
    const ext = extractExt(file.name);
    const path = `albums/${albumId}/${ownerId}/${Date.now()}_${index}.${ext}`;
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    const url = await getDownloadURL(storageRef);
    await addImage(albumId, ownerId, url); // 4枚制限内部でも確認
    index++;
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
