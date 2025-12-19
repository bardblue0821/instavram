"use client";
import React, { useEffect, useState } from 'react';
import { useAuthUser } from '../lib/hooks/useAuthUser';
import { createAlbumWithImages, AlbumCreateProgress } from '../lib/services/createAlbumWithImages';
import { useRouter } from 'next/navigation';
import { translateError } from '../lib/errors';
import { Paper, Stack, Group, Text, Image as MantineImage, Button, Progress } from '@mantine/core';
import { Dropzone, IMAGE_MIME_TYPE } from '@mantine/dropzone';

interface Props { onCreated?: (albumId: string) => void }

export default function AlbumCreateModal({ onCreated }: Props) {
  const { user } = useAuthUser();
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [placeUrl, setPlaceUrl] = useState('');
  const [comment, setComment] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ file: File; url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [fileProgress, setFileProgress] = useState<AlbumCreateProgress[]>([]);
  const [loading, setLoading] = useState(false);

  // 選択クリア時に Object URL を開放
  useEffect(() => {
    return () => {
      previews.forEach((p) => URL.revokeObjectURL(p.url));
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
    const nextPreviews = accepted.map((f) => ({ file: f, url: URL.createObjectURL(f) }));
    setPreviews(nextPreviews);
    setFiles(accepted);
  }

  function removeOne(target: File) {
    const next = previews.filter((p) => p.file !== target);
    const removed = previews.find((p) => p.file === target);
    if (removed) URL.revokeObjectURL(removed.url);
    setPreviews(next);
    setFiles(next.map((p) => p.file));
  }

  function clearAll() {
    previews.forEach((p) => URL.revokeObjectURL(p.url));
    setPreviews([]);
    setFiles([]);
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
    if (files.length > 4) {
      setError('画像は最大4枚までです');
      return;
    }
    setError(null);
    setLoading(true);
    setProgress(0);
    try {
      // 逐次進捗: files.length が0ならそのまま
      console.log('[AlbumCreateModal] submit start', { uid: user.uid, files: files.map(f=>({name:f.name,size:f.size})) });
      const albumId = await createAlbumWithImages(
        user.uid,
        { title: title || undefined, placeUrl: placeUrl || undefined, firstComment: comment || undefined },
        files,
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
          <label className="block text-sm font-medium mb-1" aria-label="画像選択">画像 (最大4枚)</label>
          <Paper withBorder p="md" radius="md" className="surface">
            <Stack gap="xs">
              <Dropzone
                onDrop={handleDrop}
                accept={IMAGE_MIME_TYPE}
                disabled={loading || !user}
                multiple
                maxSize={5 * 1024 * 1024}
              >
                <Group justify="center" mih={120} className="text-center">
                  <div>
                    <Text fw={600}>ここにドラッグ＆ドロップ、またはクリックして選択</Text>
                    <Text size="xs" c="dimmed">PNG / JPEG / GIF、1ファイル最大 5MB（最大 4 件）</Text>
                  </div>
                </Group>
              </Dropzone>

              {previews.length > 0 && (
                <Stack gap="xs" mt="sm">
                  {previews.map((p) => (
                    <Group key={p.url} justify="space-between" align="center">
                      <Group>
                        <MantineImage src={p.url} alt={p.file.name} radius="sm" fit="cover" style={{ height: 80, width: 80, objectFit: 'cover' }} />
                        <div>
                          <Text size="sm" fw={500}>{p.file.name}</Text>
                          <Text size="xs" c="dimmed">{fmtBytes(p.file.size)}</Text>
                        </div>
                      </Group>
                      <Button size="xs" variant="default" onClick={() => removeOne(p.file)} disabled={loading}>削除</Button>
                    </Group>
                  ))}
                  <Group justify="end">
                    <Button size="sm" variant="default" onClick={clearAll} disabled={loading}>クリア</Button>
                  </Group>
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
        <button
          type="submit"
          className="btn-accent disabled:opacity-50"
          disabled={loading || !user}
        >{loading ? '処理中...' : '作成'}</button>
      </form>
    </div>
  );
}
