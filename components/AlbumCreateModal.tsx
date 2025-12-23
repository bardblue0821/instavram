"use client";
import React, { useEffect, useRef, useState } from 'react';
import { useAuthUser } from '../lib/hooks/useAuthUser';
import { createAlbumWithImages, AlbumCreateProgress } from '../lib/services/createAlbumWithImages';
import { useRouter } from 'next/navigation';
import { translateError } from '../lib/errors';
import { Paper, Stack, Group, Text, Image as MantineImage, Button, Progress } from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';
import { notifications } from '@mantine/notifications';
import AlbumImageCropper from './upload/AlbumImageCropper';
import { getCroppedBlobSized } from '../lib/services/avatar';
import { Button as AppButton, IconButton as AppIconButton } from './ui/Button';

interface Props { onCreated?: (albumId: string) => void }

export default function AlbumCreateModal({ onCreated }: Props) {
  const { user } = useAuthUser();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [placeUrl, setPlaceUrl] = useState('');
  const [comment, setComment] = useState('');
  const [visibility, setVisibility] = useState<'public' | 'friends'>('public');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const [croppedPreviews, setCroppedPreviews] = useState<({ file: File; url: string } | null)[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [fileProgress, setFileProgress] = useState<AlbumCreateProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [cropIndex, setCropIndex] = useState<number | null>(null);
  const [cropping, setCropping] = useState(false);
  const [cropSrc, setCropSrc] = useState<string | null>(null);

  const previewsRef = useRef(previews);
  const croppedPreviewsRef = useRef(croppedPreviews);
  useEffect(() => { previewsRef.current = previews; }, [previews]);
  useEffect(() => { croppedPreviewsRef.current = croppedPreviews; }, [croppedPreviews]);

  // 選択クリア時に Object URL を開放
  useEffect(() => {
    return () => {
      previewsRef.current.forEach((p) => URL.revokeObjectURL(p.url));
      croppedPreviewsRef.current.forEach((p) => p && URL.revokeObjectURL(p.url));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleDrop(dropped: File[]) {
    setError(null);
    if (!dropped || dropped.length === 0) return;
    const allow = 4;
    const accepted = dropped.slice(0, allow);
    if (dropped.length > allow) {
      setError('画像は最大4枚までです');
    }
    // 既存のプレビューを解放
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    croppedPreviews.forEach((p) => p && URL.revokeObjectURL(p.url));
    const nextPreviews = accepted.map((f) => ({ file: f, url: URL.createObjectURL(f) }));
    setPreviews(nextPreviews);
    setCroppedPreviews(new Array(nextPreviews.length).fill(null));
    setFiles(accepted);
  }

  function handleReject(fileRejections: any[]) {
    // maxSize 超過などで onDrop に来ない場合も、理由を伝える
    const rejected = Array.isArray(fileRejections) ? fileRejections : [];
    const tooLarge = rejected
      .map((r) => r?.file as File | undefined)
      .filter((f): f is File => !!f)
      .filter((f) => f.size > 5 * 1024 * 1024);

    if (tooLarge.length > 0) {
      const names = tooLarge.slice(0, 3).map((f) => f.name).join('、');
      const more = tooLarge.length > 3 ? ` ほか${tooLarge.length - 3}件` : '';
      const msg = `サイズ上限 5MB を超えています: ${names}${more}`;
      setError(msg);
      notifications.show({ color: 'red', message: msg });
    } else if (rejected.length > 0) {
      const msg = '追加できないファイルがあります（画像のみ / 1枚 5MB まで）';
      setError(msg);
      notifications.show({ color: 'red', message: msg });
    }
  }

  function removeOne(target: File) {
    const idx = previews.findIndex((p) => p.file === target);
    const next = previews.filter((p) => p.file !== target);
    const removed = idx >= 0 ? previews[idx] : undefined;
    if (removed) URL.revokeObjectURL(removed.url);
    if (idx >= 0 && croppedPreviews[idx]) URL.revokeObjectURL(croppedPreviews[idx]!.url);
    setPreviews(next);
    setCroppedPreviews((prev) => prev.filter((_, i) => i !== idx));
    setFiles(next.map((p) => p.file));
  }

  function clearAll() {
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    croppedPreviews.forEach((p) => p && URL.revokeObjectURL(p.url));
    setPreviews([]);
    setCroppedPreviews([]);
    setFiles([]);
  }

  async function applyCrop(
    idx: number,
    area: { x: number; y: number; width: number; height: number },
    aspect: 'square' | 'rect'
  ) {
    const p = previews[idx];
    if (!p) return;

    setCropping(true);
    try {
      // 最小要件: 正方形(1:1) / 長方形(4:3)
      const output = aspect === 'square' ? { width: 1024, height: 1024 } : { width: 1280, height: 960 };
      // 再編集でも必ず元画像から切り抜けるよう、cropSrc（元File由来）を優先
      const blob = await getCroppedBlobSized(cropSrc ?? p.url, area, output, 'image/jpeg', 0.9);
      const nextFile = new File([blob], p.file.name.replace(/\.[^.]+$/, '') + '.jpg', { type: 'image/jpeg' });
      const nextUrl = URL.createObjectURL(nextFile);

      setCroppedPreviews((prev) => {
        const copy = [...prev];
        if (copy[idx]) URL.revokeObjectURL(copy[idx]!.url);
        copy[idx] = { file: nextFile, url: nextUrl };
        return copy;
      });
    } catch (e: any) {
      setError(e?.message || '切り抜きに失敗しました');
    } finally {
      setCropping(false);
      setCropIndex(null);
      if (cropSrc) URL.revokeObjectURL(cropSrc);
      setCropSrc(null);
    }
  }

  function openCrop(idx: number) {
    if (loading) return;
    const f = files[idx];
    if (!f) return;
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(URL.createObjectURL(f));
    setCropIndex(idx);
  }

  function closeCrop() {
    if (cropping) return;
    setCropIndex(null);
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  }

  function fmtBytes(n: number) {
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1024 / 1024).toFixed(1)} MB`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) {
      setError('ログインが必要です');
      return;
    }
    if (previews.length > 4) {
      setError('画像は最大4枚までです');
      return;
    }
    const uploadFiles = previews.map((p, idx) => croppedPreviews[idx]?.file ?? p.file);
    setError(null);
    setLoading(true);
    setProgress(0);
    try {
      // 逐次進捗: files.length が0ならそのまま
      console.log('[AlbumCreateModal] submit start', { uid: user.uid, files: uploadFiles.map(f=>({name:f.name,size:f.size})) });
      const albumId = await createAlbumWithImages(
        user.uid,
        { title: title || undefined, placeUrl: placeUrl || undefined, firstComment: comment || undefined, visibility },
        uploadFiles,
        (p) => {
          setProgress(p.overallPercent);
          setFileProgress(prev => {
            const copy = [...prev];
            copy[p.fileIndex] = p;
            return copy;
          });
          if (p.state === 'error') {
            console.error('[AlbumCreateModal] file progress error', p);
          }
        }
      );
      setProgress(100);
      if (onCreated) onCreated(albumId);
      console.log('[AlbumCreateModal] success', { albumId });
      router.push(`/album/${albumId}`); // 詳細ページは後で
    } catch (err: any) {
      console.error('[AlbumCreateModal] submit error', err);
      setError(translateError(err));
    } finally {
      setLoading(false);
      console.log('[AlbumCreateModal] submit end');
    }
  }

  return (
    <div className="w-full">
      <h1 className="text-xl font-semibold mb-4">アルバム作成</h1>
      {!user && <p className="text-sm text-gray-600 mb-4">ログインすると作成できます。</p>}
      <form onSubmit={handleSubmit} className="space-y-4" aria-live="polite">
        <div>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="input-underline"
            disabled={loading || !user}
            placeholder="なんのアルバム？"
          />
        </div>
        <div>
          <input
            value={placeUrl}
            onChange={e => setPlaceUrl(e.target.value)}
            className="input-underline"
            disabled={loading || !user}

            placeholder="https://vrchat.com/..."
          />
        </div>
        <div>
          <textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            className="input-underline text-sm"
            disabled={loading || !user}
            maxLength={200}
            rows={3}
            placeholder="どうだった？(200文字まで)"
          />
          <p className="text-xs text-gray-500 text-right">{comment.length}/200</p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">公開範囲</label>
          <div className="flex items-center gap-3 text-sm">
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="visibility"
                value="public"
                checked={visibility === 'public'}
                onChange={() => setVisibility('public')}
                disabled={loading || !user}
              />
              <span>公開（全員に表示）</span>
            </label>
            <label className="inline-flex items-center gap-2">
              <input
                type="radio"
                name="visibility"
                value="friends"
                checked={visibility === 'friends'}
                onChange={() => setVisibility('friends')}
                disabled={loading || !user}
              />
              <span>フレンド限定</span>
            </label>
          </div>
          <p className="text-xs text-muted mt-1">
            フレンド限定にすると、ウォッチャーや非フレンドには完全に表示されません。共有・リポストも無効になります。
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1" aria-label="画像選択">画像 (最大4枚)</label>
          <Paper withBorder p="md" radius="md" className="surface">
            <Stack gap="xs">
              <Dropzone
                onDrop={handleDrop}
                onReject={handleReject}
                accept={IMAGE_MIME_TYPE}
                disabled={loading || !user}
                multiple
                maxSize={5 * 1024 * 1024}
                className="rounded-md border-2 border-dashed border-base hover:border-(--accent) hover-surface-alt transition-colors cursor-pointer py-12"
              >
                <Group justify="center" mih={140} className="text-center px-2">
                  <Dropzone.Accept>
                    <div>
                      <Text fw={700}>ここにドロップして追加</Text>
                      <Text size="xs" c="dimmed">最大 4 枚 / 1枚 5MB まで</Text>
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
                      <Text size="xs" c="dimmed">またはクリックして選択（最大 4 枚 / 1枚 5MB）</Text>
                    </div>
                  </Dropzone.Idle>
                </Group>
              </Dropzone>

              {previews.length > 0 && (
                <Stack gap="xs" mt="sm">
                  <Group justify="space-between" align="center">
                    <Text size="xs" c="dimmed">選択中: {previews.length} / 4</Text>
                    <Button type="button" size="xs" variant="default" onClick={clearAll} disabled={loading} className="cursor-pointer disabled:cursor-not-allowed">すべて外す</Button>
                  </Group>

                  <div className="grid grid-cols-2 gap-2">
                    {previews.map((p, idx) => (
                      <div key={p.url} className="relative rounded-md border border-base surface-alt p-2">
                        <button
                          type="button"
                          aria-label={`${p.file.name} を削除`}
                          className="absolute top-2 right-2 w-7 h-7 rounded-full bg-red-600 text-white text-lg leading-none flex items-center justify-center hover:bg-red-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          onClick={(e) => { e.stopPropagation(); removeOne(p.file); }}
                          disabled={loading}
                        >
                          ×
                        </button>

                        <div
                          className="cursor-pointer"
                          onClick={() => openCrop(idx)}
                          role="button"
                          aria-label={`${p.file.name} を切り抜く`}
                        >
                          <MantineImage
                            src={croppedPreviews[idx]?.url ?? p.url}
                            alt={p.file.name}
                            radius="sm"
                            fit="cover"
                            className="overflow-hidden"
                            style={{ height: 120, width: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <div className="mt-2 min-w-0">
                          <Text size="xs" fw={600} className="truncate">
                            {p.file.name}
                          </Text>
                          <Text size="xs" c="dimmed">{fmtBytes((croppedPreviews[idx]?.file ?? p.file).size)}</Text>
                        </div>
                      </div>
                    ))}
                  </div>
                </Stack>
              )}
            </Stack>
          </Paper>
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {loading && (
          <div role="status" className="space-y-2">
            <Group justify="space-between" align="center">
              <Text size="sm">アップロード中...</Text>
              <div style={{ minWidth: 220 }}><Progress value={progress} color="teal" animated /></div>
            </Group>
            <ul className="text-xs text-gray-600 space-y-1">
              {fileProgress.map((fp,i)=>(
                <li key={i}>
                  画像{i+1}: {fp.percent}% {fp.state==='error' && <span className="text-red-600">(失敗 {fp.error})</span>} {fp.state==='success' && <span className="text-green-600">OK</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
        <AppButton
          type="submit"
          variant="accent"
          isLoading={loading}
          disabled={loading || !user}
        >
          {loading ? '処理中...' : '作成'}
        </AppButton>
      </form>

      {cropIndex !== null && previews[cropIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={closeCrop}
        >
          <div
            className="surface-alt border border-base rounded shadow-lg w-[min(96vw,720px)] p-4 relative"
            onClick={(e) => e.stopPropagation()}
          >
            <AppIconButton
              type="button"
              variant="ghost"
              size="xs"
              className="absolute top-2 right-2 fg-muted hover-surface-alt cursor-pointer disabled:cursor-not-allowed"
              onClick={closeCrop}
              aria-label="閉じる"
              disabled={cropping}
            >
              ✕
            </AppIconButton>
            <h2 className="text-sm font-semibold mb-3">画像を切り抜く</h2>
            <AlbumImageCropper
              src={cropSrc ?? previews[cropIndex].url}
              onCancel={closeCrop}
              onConfirm={(area, _zoom, aspect) => applyCrop(cropIndex, area, aspect)}
            />
            {cropping && <p className="text-xs fg-muted mt-2">切り抜き中...</p>}
          </div>
        </div>
      )}
    </div>
  );
}
