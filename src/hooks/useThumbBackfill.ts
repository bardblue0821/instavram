import { useEffect, useRef } from "react";
import { storage } from "../../lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { setThumbUrl } from "../../lib/repos/imageRepo";

/**
 * 既存画像の thumbUrl が無いものに対して、軽量サムネイルをバックグラウンド生成して登録する。
 * images: 画像配列（id, url, thumbUrl, uploaderId）
 * visibleCount: 可視件数（生成対象の上限に利用）
 * setImages: UI側ステート更新関数
 */
export function useThumbBackfill(
  albumId: string | undefined,
  images: any[],
  visibleCount: number,
  setImages: (updater: (prev: any[]) => any[]) => void,
) {
  const thumbGenRef = useRef<{ running: boolean; processed: Set<string> }>({ running: false, processed: new Set() });

  useEffect(() => {
    if (!albumId) return;
    if (thumbGenRef.current.running) return;
    const missing: any[] = images.filter((img) => !img.thumbUrl && !!img.url && !thumbGenRef.current.processed.has(img.id));
    if (missing.length === 0) return;
    const targets = missing.slice(0, Math.min(visibleCount, 24));

    thumbGenRef.current.running = true;
    (async () => {
      try {
        const concurrency = 2;
        let index = 0;

        async function runOne(img: any) {
          try {
            const blob = await (async () => {
              try {
                const res = await fetch(img.url, { mode: 'cors' });
                return await res.blob();
              } catch {
                return await new Promise<Blob>((resolve, reject) => {
                  const image = new Image();
                  image.crossOrigin = 'anonymous';
                  image.onload = () => {
                    try {
                      const canvas = document.createElement('canvas');
                      const maxEdge = 360;
                      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
                      canvas.width = Math.max(1, Math.round(image.width * scale));
                      canvas.height = Math.max(1, Math.round(image.height * scale));
                      const ctx = canvas.getContext('2d');
                      if (!ctx) throw new Error('CANVAS_CONTEXT_ERROR');
                      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
                      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('CANVAS_TO_BLOB_ERROR'))), 'image/jpeg', 0.7);
                    } catch (e) { reject(e as any); }
                  };
                  image.onerror = () => reject(new Error('IMAGE_LOAD_ERROR'));
                  image.src = img.url;
                });
              }
            })();

            const thumbBlob = await (async () => {
              const url = URL.createObjectURL(blob);
              try {
                const image = await new Promise<HTMLImageElement>((resolve, reject) => {
                  const im = new Image();
                  im.onload = () => resolve(im);
                  im.onerror = () => reject(new Error('IMAGE_LOAD_ERROR'));
                  im.src = url;
                });
                const maxEdge = 360;
                const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
                const w = Math.max(1, Math.round(image.width * scale));
                const h = Math.max(1, Math.round(image.height * scale));
                const canvas = document.createElement('canvas');
                canvas.width = w; canvas.height = h;
                const ctx = canvas.getContext('2d');
                if (!ctx) throw new Error('CANVAS_CONTEXT_ERROR');
                ctx.drawImage(image, 0, 0, w, h);
                return await new Promise<Blob>((resolve, reject) => {
                  canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('CANVAS_TO_BLOB_ERROR'))), 'image/jpeg', 0.7);
                });
              } finally {
                URL.revokeObjectURL(url);
              }
            })();

            const base = (img.id || 'image').toString().replace(/[^a-zA-Z0-9_.-]/g, '_');
            const userPart = (img.uploaderId || 'unknown').toString().replace(/[^a-zA-Z0-9_.-]/g, '_');
            const ts = Date.now();
            const thumbRef = ref(storage, `albums/${albumId}/${userPart}/${ts}_${base}_thumb.jpg`);
            await uploadBytes(thumbRef, thumbBlob, { cacheControl: 'public, max-age=31536000, immutable', contentType: 'image/jpeg' });
            const thumbUrl = await getDownloadURL(thumbRef);

            await setThumbUrl(img.id, thumbUrl);
            setImages((prev) => prev.map((x) => (x.id === img.id ? { ...x, thumbUrl } : x)));
          } finally {
            thumbGenRef.current.processed.add(img.id);
          }
        }

        async function schedule(): Promise<void> {
          while (index < targets.length) {
            const running: Promise<void>[] = [];
            for (let i = 0; i < concurrency && index < targets.length; i++) {
              running.push(runOne(targets[index++]));
            }
            await Promise.allSettled(running);
          }
        }

        await schedule();
      } catch (e) {
        console.warn('thumbnail backfill failed', e);
      } finally {
        thumbGenRef.current.running = false;
      }
    })();
  }, [albumId, images, visibleCount, setImages]);
}
