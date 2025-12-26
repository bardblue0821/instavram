"use client";

import { useEffect, useRef, useState } from "react";
import { Group, Button, Progress, Text, Stack, Paper, Image as MantineImage } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { useToast } from "../ui/Toast";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { canUploadMoreImages } from "@/lib/repos/imageRepo";
import { useAuthUser } from "@/lib/hooks/useAuthUser";
import AlbumImageCropper from "./AlbumImageCropper";
import { getCroppedBlobSized } from "@/lib/services/avatar";

type ItemState = {
  file: File;
  previewUrl: string;
  croppedFile?: File;
  croppedPreviewUrl?: string;
  uploading: boolean;
  progress: number; // 0-100
  error?: string;
};

export default function AlbumImageUploader({
  albumId,
  userId,
  remaining,
  onUploaded,
}: {
  albumId: string;
  userId: string;
  remaining: number;
  onUploaded?: () => void;
}) {
  const { user } = useAuthUser();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<ItemState[]>([]);
  const [overall, setOverall] = useState(0);
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const [cropping, setCropping] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const itemsRef = useRef<ItemState[]>([]);
  const cropSrcRef = useRef<string | null>(null);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);
  useEffect(() => {
    cropSrcRef.current = cropSrc;
  }, [cropSrc]);

  function clearSelection() {
    setItems((prev) => {
      prev.forEach((it) => {
        URL.revokeObjectURL(it.previewUrl);
        if (it.croppedPreviewUrl) URL.revokeObjectURL(it.croppedPreviewUrl);
      });
      return [];
    });
    setOverall(0);

    setCropIndex(null);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  function removeOne(idx: number) {
    if (busy) return;

    setItems((prev) => {
      const target = prev[idx];
      if (!target) return prev;

      URL.revokeObjectURL(target.previewUrl);
      if (target.croppedPreviewUrl) URL.revokeObjectURL(target.croppedPreviewUrl);

      const next = prev.filter((_, i) => i !== idx);
      return next;
    });

    // cropIndex の整合性を維持
    setCropIndex((cur) => {
      if (cur === null) return null;
      if (cur === idx) return null;
      if (cur > idx) return cur - 1;
      return cur;
    });
  }

  function handleDrop(files: File[]) {
    if (!files || files.length === 0) return;
    if (remaining <= 0) {
      toast.error("これ以上追加できません");
      return;
    }
    const allowCount = Math.min(remaining, files.length);
    const accepted = files.slice(0, allowCount);
    const rejected = files.slice(allowCount);
    if (rejected.length > 0) {
      toast.warning(`${rejected.length} 件は上限のためスキップされました`);
    }
    clearSelection();
    const next: ItemState[] = [];
    for (const f of accepted) {
      if (f.size > 5 * 1024 * 1024) {
        toast.error(`${f.name}: サイズ上限 5MB を超えています`);
        continue;
      }
      try {
        const url = URL.createObjectURL(f);
        next.push({ file: f, previewUrl: url, uploading: false, progress: 0 });
      } catch {}
    }
    setItems(next);
  }

  function handleReject(fileRejections: any[]) {
    // Dropzone の maxSize 超過など、onDrop に来ないケースでもユーザーに伝える
    const rejected = Array.isArray(fileRejections) ? fileRejections : [];
    const tooLarge = rejected
      .map((r) => r?.file as File | undefined)
      .filter((f): f is File => !!f)
      .filter((f) => f.size > 5 * 1024 * 1024);

    if (tooLarge.length > 0) {
      const names = tooLarge.slice(0, 3).map((f) => f.name).join("、");
      const more = tooLarge.length > 3 ? ` ほか${tooLarge.length - 3}件` : "";
      toast.error(`サイズ上限 5MB を超えています: ${names}${more}`);
    } else if (rejected.length > 0) {
      toast.error("追加できないファイルがあります（画像のみ / 1枚 5MB まで）");
    }
  }

  useEffect(() => {
    return () => {
      itemsRef.current.forEach((it) => {
        URL.revokeObjectURL(it.previewUrl);
        if (it.croppedPreviewUrl) URL.revokeObjectURL(it.croppedPreviewUrl);
      });
      if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCrop(idx: number) {
    if (busy) return;
    const it = items[idx];
    if (!it) return;
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(it.file));
    setCropIndex(idx);
  }

  function closeCrop() {
    if (cropping) return;
    setCropIndex(null);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  async function applyCrop(
    idx: number,
    area: { x: number; y: number; width: number; height: number },
    aspect: "square" | "rect"
  ) {
    const it = items[idx];
    if (!it) return;

    setCropping(true);
    try {
      const output = aspect === "square" ? { width: 1024, height: 1024 } : { width: 1280, height: 960 };
      const blob = await getCroppedBlobSized(cropSrc ?? it.previewUrl, area, output, "image/jpeg", 0.9);
      const nextFile = new File([blob], it.file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      const nextUrl = URL.createObjectURL(nextFile);

      setItems((prev) =>
        prev.map((x, i) => {
          if (i !== idx) return x;
          if (x.croppedPreviewUrl) URL.revokeObjectURL(x.croppedPreviewUrl);
          return { ...x, croppedFile: nextFile, croppedPreviewUrl: nextUrl };
        })
      );
    } catch (e: any) {
      const msg = e?.message || "切り抜きに失敗しました";
      toast.error(msg);
      setItems((prev) => prev.map((x, i) => (i === idx ? { ...x, error: msg } : x)));
    } finally {
      setCropping(false);
      setCropIndex(null);
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }
  }

  async function fileToCanvasBlob(file: File, maxEdge: number, quality = 0.8): Promise<Blob> {
    const imgUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("IMAGE_LOAD_ERROR"));
        image.src = imgUrl;
      });
      const { width, height } = img;
      const scale = Math.min(1, maxEdge / Math.max(width, height));
      const dstW = Math.max(1, Math.round(width * scale));
      const dstH = Math.max(1, Math.round(height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = dstW;
      canvas.height = dstH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("CANVAS_CONTEXT_ERROR");
      ctx.drawImage(img, 0, 0, dstW, dstH);
      const blob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("CANVAS_TO_BLOB_ERROR"))), "image/jpeg", quality);
      });
      return blob;
    } finally {
      URL.revokeObjectURL(imgUrl);
    }
  }

  function fmtBytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  function explainError(e: any): string {
    const code = e?.code || e?.message || "";
    if (!navigator.onLine) return "ネットワークに接続できません。接続を確認してください。";
    if (typeof code === "string") {
      // API エラーコード
      if (code === "NO_PERMISSION") return "このアルバムに画像を追加する権限がありません";
      if (code === "LIMIT_EXCEEDED") return "アップロード上限に達しています（1アルバムにつき4枚まで）";
      if (code === "ALBUM_NOT_FOUND") return "アルバムが見つかりません";
      if (code === "FORBIDDEN") return "権限がありません";
      if (code === "UNAUTHORIZED" || code === "NOT_AUTHENTICATED") return "ログインが必要です";
      if (code === "RATE_LIMITED") return "リクエストが多すぎます。しばらくしてから再試行してください";
      
      // Firebase Storage エラー
      if (code.includes("unauthorized") || code.includes("permission-denied")) return "権限がありません（ログインまたは権限設定をご確認ください）";
      if (code.includes("quota-exceeded")) return "容量制限を超えました。管理者にお問い合わせください。";
      if (code.includes("retry-limit-exceeded") || code.includes("network")) return "ネットワークエラーが発生しました。しばらくして再試行してください。";
    }
    return "アップロードに失敗しました";
  }

  async function handleUploadAll() {
    if (items.length === 0) return;
    try {
      setBusy(true);
      setOverall(0);

      const allow = await canUploadMoreImages(albumId, userId);
      if (!allow) {
        toast.error("アップロード上限に達しています");
        return;
      }

      const concurrency = 2;
      let active = 0;
      let index = 0;

      const prepared = await Promise.all(
        items.map(async (it) => {
          const srcFile = it.croppedFile ?? it.file;
          const mainBlob = await fileToCanvasBlob(srcFile, 1600, 0.8);
          const thumbBlob = await fileToCanvasBlob(srcFile, 512, 0.7);
          return { it, mainBlob, thumbBlob };
        })
      );

      const totalBytes = prepared.reduce((sum, p) => sum + p.mainBlob.size + p.thumbBlob.size, 0);
      setItems((prev) => prev.map((x) => ({ ...x, uploading: true, progress: 0, error: undefined })));

      async function runOne(p: (typeof prepared)[number]) {
        const f = p.it.file;
        const base = f.name.replace(/[^a-zA-Z0-9_.-]/g, "_").replace(/\.[^.]+$/, "");
        const ts = Date.now();
        const mainRef = ref(storage, `albums/${albumId}/${userId}/${ts}_${base}.jpg`);
        const thumbRef = ref(storage, `albums/${albumId}/${userId}/${ts}_${base}_thumb.jpg`);
        const mainTask = uploadBytesResumable(mainRef, p.mainBlob, { cacheControl: "public, max-age=31536000, immutable", contentType: "image/jpeg" });
        const thumbTask = uploadBytesResumable(thumbRef, p.thumbBlob, { cacheControl: "public, max-age=31536000, immutable", contentType: "image/jpeg" });

        await new Promise<void>((resolve, reject) => {
          function onProgress() {
            const bytes = mainTask.snapshot.bytesTransferred + thumbTask.snapshot.bytesTransferred;
            const total = (mainTask.snapshot.totalBytes || p.mainBlob.size) + (thumbTask.snapshot.totalBytes || p.thumbBlob.size);
            const pct = Math.min(100, Math.round((bytes / total) * 100));
            setItems((prev) => prev.map((x) => (x.file === f ? { ...x, progress: pct } : x)));
            const allTransferred = prepared.reduce((sum, q) => {
              const mt = q === p ? mainTask : (undefined as any);
              const tt = q === p ? thumbTask : (undefined as any);
              return sum + (mt?.snapshot?.bytesTransferred || 0) + (tt?.snapshot?.bytesTransferred || 0);
            }, 0);
            setOverall(Math.min(100, Math.round((allTransferred / totalBytes) * 100)));
          }

          mainTask.on("state_changed", onProgress, (e) => reject(e));
          thumbTask.on("state_changed", onProgress, (e) => reject(e));

          Promise.all([mainTask, thumbTask])
            .then(async () => {
              const [mainUrl, thumbDownloadUrl] = await Promise.all([getDownloadURL(mainRef), getDownloadURL(thumbRef)]);
              
              // API 経由で Firestore に登録
              if (!user) throw new Error('NOT_AUTHENTICATED');
              const token = await user.getIdToken();
              console.log('[AlbumImageUploader] Registering image via API:', { albumId, userId, mainUrl, thumbDownloadUrl });
              
              const res = await fetch('/api/images/register', {
                method: 'POST',
                headers: { 
                  'content-type': 'application/json',
                  'authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ albumId, userId, url: mainUrl, thumbUrl: thumbDownloadUrl }),
              });
              
              console.log('[AlbumImageUploader] API response status:', res.status);
              
              if (!res.ok) {
                let data: any = {};
                const text = await res.text();
                console.log('[AlbumImageUploader] API response text:', text);
                try {
                  data = JSON.parse(text);
                } catch (e) {
                  console.error('[AlbumImageUploader] failed to parse response:', e);
                }
                console.error('[AlbumImageUploader] API error:', { status: res.status, error: data?.error, data });
                throw new Error(data?.error || 'UPLOAD_FAILED');
              }
              
              console.log('[AlbumImageUploader] Image registered successfully');
              resolve();
            })
            .catch(reject);
        });
      }

      const results: Array<Promise<void>> = [];
      const errors: any[] = [];

      async function schedule(): Promise<void> {
        while (active < concurrency && index < prepared.length) {
          const cur = prepared[index++];
          active++;
          const p = runOne(cur)
            .catch((e) => {
              errors.push(e);
              const msg = explainError(e);
              setItems((prev) => prev.map((x) => (x.file === cur.it.file ? { ...x, error: msg } : x)));
              toast.error(`${cur.it.file.name}: ${msg}`);
            })
            .finally(() => {
              active--;
            });
          results.push(p);
        }
        if (index < prepared.length) {
          await Promise.race(results);
          await schedule();
        }
      }

      await schedule();
      await Promise.allSettled(results);

      if (errors.length === 0) {
        toast.success(`${prepared.length} 件の画像を追加しました`);
      }
      clearSelection();
      onUploaded?.();
    } catch (e: any) {
      console.error(e);
      toast.error(explainError(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Paper withBorder p="md" radius="md" className="surface">
        <Stack gap="xs">
          
          <Dropzone
            onDrop={handleDrop}
            onReject={handleReject}
            accept={IMAGE_MIME_TYPE}
            disabled={busy || remaining <= 0}
            multiple
            maxSize={5 * 1024 * 1024}
            className="rounded-md border-2 border-dashed border-base hover:border-(--accent) hover-surface-alt transition-colors cursor-pointer py-10"
          >
            <Group justify="center" mih={120} className="text-center px-2">
              <Dropzone.Accept>
                <div>
                  <Text fw={700}>ここにドロップして追加</Text>
                  <Text size="xs" c="dimmed">最大 {remaining} 件 / 1枚 5MB まで</Text>
                </div>
              </Dropzone.Accept>
              <Dropzone.Reject>
                <div>
                  <Text fw={700} c="red">このファイルは追加できません</Text>
                  <Text size="xs" c="dimmed">画像のみ（PNG / JPEG / GIF）・1枚 5MB まで</Text>
                </div>
              </Dropzone.Reject>
              <Dropzone.Idle>
                <div>
                  <Text fw={700}>画像をここにドラッグ＆ドロップ</Text>
                  <Text size="xs" c="dimmed">またはクリックして選択（最大 {remaining} 件 / 1枚 5MB）</Text>
                </div>
              </Dropzone.Idle>
            </Group>
          </Dropzone>

          {items.length > 0 && (
            <Stack gap="xs" mt="sm">
              <Group justify="space-between" align="center">
                <Text size="xs" c="dimmed">
                  選択中: {items.length} / {Math.max(0, remaining)}
                </Text>
                <Button variant="default" size="xs" onClick={clearSelection} disabled={busy}>
                  すべて外す
                </Button>
              </Group>

              <div className="grid grid-cols-2 gap-2">
                {items.map((it, idx) => (
                  <div key={it.previewUrl} className="relative rounded-md border border-base surface-alt p-2">
                    <button
                      type="button"
                      aria-label={`${it.file.name} を削除`}
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600 text-white text-lg leading-none flex items-center justify-center hover:bg-red-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeOne(idx);
                      }}
                      disabled={busy}
                    >
                      ×
                    </button>

                    <div
                      className="cursor-pointer"
                      onClick={() => openCrop(idx)}
                      role="button"
                      aria-label={`${it.file.name} を切り抜く`}
                    >
                      <MantineImage
                        src={it.croppedPreviewUrl ?? it.previewUrl}
                        alt={it.file.name}
                        radius="sm"
                        fit="cover"
                        className="overflow-hidden"
                        style={{ height: 120, width: "100%", objectFit: "cover" }}
                      />
                    </div>

                    <div className="mt-2 min-w-0">
                      <Text size="xs" fw={600} className="truncate">
                        {it.file.name}
                      </Text>
                      <Text size="xs" c="dimmed">
                        {fmtBytes((it.croppedFile ?? it.file).size)}
                      </Text>
                      <Text size="xs" c="dimmed">
                        クリックで切り抜き
                      </Text>
                      {it.error && (
                        <Text size="xs" c="red">
                          {it.error}
                        </Text>
                      )}
                    </div>

                    {(it.uploading || it.progress > 0) && (
                      <div className="mt-2">
                        <Progress value={it.progress} color={it.error ? "red" : "teal"} animated={!it.error && it.uploading} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <Group justify="space-between" align="center">
                <Text size="sm" c="dimmed">
                  全体進捗
                </Text>
                <div style={{ minWidth: 220 }}>
                  <Progress value={overall} color="teal" animated={busy} />
                </div>
              </Group>
              <Group justify="end">
                <Button size="sm" color="teal" onClick={handleUploadAll} loading={busy} disabled={items.length === 0 || remaining <= 0}>
                  まとめてアップロード
                </Button>
              </Group>
            </Stack>
          )}
        </Stack>
      </Paper>

      {cropIndex !== null && items[cropIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeCrop}
        >
          <div
            className="surface-alt border border-base rounded shadow-lg w-[min(96vw,720px)] p-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              className="absolute top-2 right-2 fg-muted hover-surface-alt rounded px-2 py-1 cursor-pointer disabled:cursor-not-allowed"
              onClick={closeCrop}
              aria-label="閉じる"
              disabled={cropping}
            >
              ✕
            </button>
            <h2 className="text-sm font-semibold mb-3">画像を切り抜く</h2>
            <AlbumImageCropper
              src={cropSrc ?? items[cropIndex].previewUrl}
              onCancel={closeCrop}
              onConfirm={(area, _zoom, aspect) => applyCrop(cropIndex, area, aspect)}
            />
            {cropping && <p className="text-xs fg-muted mt-2">切り抜き中...</p>}
          </div>
        </div>
      )}
    </>
  );
}
