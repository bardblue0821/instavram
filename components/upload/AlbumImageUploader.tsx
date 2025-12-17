"use client";

import { useState } from "react";
import { Group, Button, Progress, Text, Stack, Paper } from "@mantine/core";
import { Dropzone, IMAGE_MIME_TYPE } from "@mantine/dropzone";
import { notifications } from "@mantine/notifications";
import { storage } from "@/lib/firebase";
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { addImage, canUploadMoreImages, listImages } from "@/lib/repos/imageRepo";

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
  const [progress, setProgress] = useState(0);

  async function handleDrop(files: File[]) {
    if (!files || files.length === 0) return;
    if (remaining <= 0) {
      notifications.show({ color: "red", message: "これ以上追加できません" });
      return;
    }

    const file = files[0];
    try {
      setBusy(true);
      setProgress(0);

      const allow = await canUploadMoreImages(albumId, userId);
      if (!allow) {
        notifications.show({ color: "red", message: "アップロード上限に達しています" });
        return;
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9_.-]/g, "_");
      const path = `albums/${albumId}/${userId}/${Date.now()}_${safeName}`;
      const storageRef = ref(storage, path);
      const task = uploadBytesResumable(storageRef, file, { cacheControl: "public, max-age=31536000, immutable" });

      task.on("state_changed", (snap) => {
        const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        setProgress(pct);
      });

      await task;
      const url = await getDownloadURL(storageRef);
      await addImage(albumId, userId, url);

      notifications.show({ color: "teal", message: "画像を追加しました" });
      setProgress(100);
      onUploaded?.();
    } catch (e: any) {
      console.error(e);
      notifications.show({ color: "red", message: "アップロードに失敗しました" });
    } finally {
      setBusy(false);
      setTimeout(() => setProgress(0), 800);
    }
  }

  return (
    <Paper withBorder p="md" radius="md" className="surface">
      <Stack gap="xs">
        <Text size="sm" c="dimmed">画像追加（残り {remaining} 枚）</Text>
        <Dropzone
          onDrop={handleDrop}
          accept={IMAGE_MIME_TYPE}
          disabled={busy || remaining <= 0}
          maxFiles={1}
          maxSize={5 * 1024 * 1024}
        >
          <Group justify="center" mih={120} className="text-center">
            <div>
              <Text fw={600}>ここにドラッグ＆ドロップ、またはクリックして選択</Text>
              <Text size="xs" c="dimmed">PNG / JPEG / GIF、最大 5MB</Text>
            </div>
          </Group>
        </Dropzone>
        {busy && (
          <div>
            <Progress value={progress} animated color="teal" />
            <Text size="xs" c="dimmed" mt={4}>{progress}%</Text>
          </div>
        )}
        <Group justify="end">
          <Button size="sm" disabled>アップロード</Button>
        </Group>
      </Stack>
    </Paper>
  );
}
