"use client";
"use client";

import { useEffect, useState } from "react";
import { Group, Button, Progress, Text, Stack, Paper, Image as MantineImage } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { notifications } from "@mantine/notifications";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { addImage, canUploadMoreImages } from "@/lib/repos/imageRepo";

type ItemState = {
  file: File;
  previewUrl: string;
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
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<ItemState[]>([]);
  const [overall, setOverall] = useState(0);

  function clearSelection() {
    setItems((prev) => {
      prev.forEach((it) => URL.revokeObjectURL(it.previewUrl));
      return [];
    });
    setOverall(0);
  }

  function handleDrop(files: File[]) {
    if (!files || files.length === 0) return;
    if (remaining <= 0) {
      notifications.show({ color: "red", message: "これ以上追加できません" });
      return;
    }
    const allowCount = Math.min(remaining, files.length);
    const accepted = files.slice(0, allowCount);
    const rejected = files.slice(allowCount);
    if (rejected.length > 0) {
      notifications.show({ color: "yellow", message: `${rejected.length} 件は上限のためスキップされました` });
    }
    clearSelection();
    const next: ItemState[] = [];
    for (const f of accepted) {
      if (f.size > 5 * 1024 * 1024) {
        notifications.show({ color: "red", message: `${f.name}: サイズ上限 5MB を超えています` });
        continue;
      }
      try {
        const url = URL.createObjectURL(f);
        next.push({ file: f, previewUrl: url, uploading: false, progress: 0 });
      } catch {}
    }
    setItems(next);
  }

  useEffect(() => {
    return () => {
      items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
        notifications.show({ color: "red", message: "アップロード上限に達しています" });
        return;
      }

      const concurrency = 2;
      let active = 0;
      let index = 0;

      const prepared = await Promise.all(
        items.map(async (it) => {
          const mainBlob = await fileToCanvasBlob(it.file, 1600, 0.8);
          const thumbBlob = await fileToCanvasBlob(it.file, 512, 0.7);
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
              const [mainUrl, thumbUrl] = await Promise.all([getDownloadURL(mainRef), getDownloadURL(thumbRef)]);
              await addImage(albumId, userId, mainUrl, thumbUrl);
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
              notifications.show({ color: "red", message: `${cur.it.file.name}: ${msg}` });
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
        notifications.show({ color: "teal", message: `${prepared.length} 件の画像を追加しました` });
      }
      clearSelection();
      onUploaded?.();
    } catch (e: any) {
      console.error(e);
      notifications.show({ color: "red", message: explainError(e) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Paper withBorder p="md" radius="md" className="surface">
      <Stack gap="xs">
        <Text size="sm" c="dimmed">
          画像追加（残り {remaining} 枚）
        </Text>
        <Dropzone onDrop={handleDrop} accept={IMAGE_MIME_TYPE} disabled={busy || remaining <= 0} multiple maxSize={5 * 1024 * 1024}>
          <Group justify="center" mih={120} className="text-center">
            <div>
              <Text fw={600}>ここにドラッグ＆ドロップ、またはクリックして選択</Text>
              <Text size="xs" c="dimmed">
                PNG / JPEG / GIF、1ファイル最大 5MB（最大 {remaining} 件）
              </Text>
            </div>
          </Group>
        </Dropzone>

        {items.length > 0 && (
          <Stack gap="xs" mt="sm">
            {items.map((it) => (
              <Group key={it.previewUrl} justify="space-between" align="center">
                <Group>
                  <MantineImage src={it.previewUrl} alt={it.file.name} radius="sm" fit="cover" style={{ height: 80, width: 80, objectFit: "cover" }} />
                  <div>
                    <Text size="sm" fw={500}>
                      {it.file.name}
                    </Text>
                    <Text size="xs" c="dimmed">
                      {fmtBytes(it.file.size)}
                    </Text>
                    {it.error && (
                      <Text size="xs" c="red">
                        {it.error}
                      </Text>
                    )}
                  </div>
                </Group>
                <div style={{ minWidth: 180 }}>
                  <Progress value={it.progress} color={it.error ? "red" : "teal"} animated={!it.error && it.uploading} />
                </div>
              </Group>
            ))}
            <Group justify="space-between" align="center">
              <Text size="sm" c="dimmed">
                全体進捗
              </Text>
              <div style={{ minWidth: 220 }}>
                <Progress value={overall} color="teal" animated={busy} />
              </div>
            </Group>
            <Group justify="end">
              <Button variant="default" size="sm" onClick={clearSelection} disabled={busy}>
                クリア
              </Button>
              <Button size="sm" onClick={handleUploadAll} loading={busy} disabled={items.length === 0 || remaining <= 0}>
                まとめてアップロード
              </Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
