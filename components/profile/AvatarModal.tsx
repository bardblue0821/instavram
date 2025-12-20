"use client";
import React, { useRef, useState } from 'react';
import { storage } from '../../lib/firebase';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import AvatarCropper from './AvatarCropper';
import { getCroppedBlob } from '../../lib/services/avatar';
import { updateUserIcon } from '../../lib/repos/userRepo';

interface Props {
  open: boolean;
  onClose: () => void;
  uid: string;
  src?: string | null;
  alt?: string;
  editable?: boolean;
  onUpdated?: (thumbUrl: string, fullUrl: string) => void;
}

export default function AvatarModal({ open, onClose, uid, src, alt = 'ユーザーアイコン', editable, onUpdated }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<'view'|'crop'>('view');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const MAX_AVATAR_FILE_SIZE = 20 * 1024 * 1024; // 20MB（元画像は切り抜き後に512pxへ圧縮して保存）

  if (!open) return null;

  const THUMB_SIZE = 256;
  const FULL_SIZE = 512;
  const pickFile = () => inputRef.current?.click();

  const onFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('画像ファイルを選択してください'); return; }
    if (file.size > MAX_AVATAR_FILE_SIZE) { setError('20MB 以下の画像を選択してください'); return; }
    const url = URL.createObjectURL(file);
    setPreviewSrc(url);
    setStage('crop');
  };

  const onConfirmCrop = async (area: { x: number; y: number; width: number; height: number }, _zoom: number) => {
    if (!previewSrc) return;
    try {
      setBusy(true); setError(null);
      const [thumbBlob, fullBlob] = await Promise.all([
        getCroppedBlob(previewSrc, area, THUMB_SIZE, 'image/jpeg', 0.85),
        getCroppedBlob(previewSrc, area, FULL_SIZE, 'image/jpeg', 0.9),
      ]);

      const thumbPath = `users/${uid}/icon/${THUMB_SIZE}.jpg`;
      const fullPath = `users/${uid}/icon/${FULL_SIZE}.jpg`;
      const [thumbRef, fullRef] = [storageRef(storage, thumbPath), storageRef(storage, fullPath)];

      await Promise.all([
        uploadBytes(thumbRef, thumbBlob, { contentType: 'image/jpeg' }),
        uploadBytes(fullRef, fullBlob, { contentType: 'image/jpeg' }),
      ]);

      const [thumbUrl, fullUrl] = await Promise.all([
        getDownloadURL(thumbRef),
        getDownloadURL(fullRef),
      ]);

      await updateUserIcon(uid, thumbUrl, fullUrl);
      onUpdated?.(thumbUrl, fullUrl);
      onClose();
    } catch (e: any) {
      setError(e.message || '保存に失敗しました');
    } finally {
      setBusy(false);
      setStage('view');
      if (previewSrc) URL.revokeObjectURL(previewSrc);
      setPreviewSrc(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="surface-alt border border-base rounded shadow-lg w-[min(96vw,600px)] p-4 relative" onClick={(e)=>e.stopPropagation()}>
        <button className="absolute top-2 right-2 fg-muted hover-surface-alt rounded px-2 py-1" onClick={onClose} aria-label="閉じる">✕</button>
        {stage === 'view' && (
          <div className="space-y-3">
            <div className="mx-auto w-64 h-64 overflow-hidden border border-base rounded-lg surface">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src || ''} alt={alt} className="object-cover w-full h-full" />
            </div>
            {editable && (
              <div className="flex justify-center">
                <button
                  type="button"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-sm rounded btn-accent"
                  onClick={pickFile}
                  aria-label="アイコンを変更"
                >
                  ✎ アイコンを変更
                </button>
                <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e)=> onFile(e.target.files?.[0] || undefined)} />
              </div>
            )}
            {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
          </div>
        )}
        {stage === 'crop' && previewSrc && (
          <div>
            <AvatarCropper src={previewSrc} onCancel={()=>{ setStage('view'); setPreviewSrc(null); }} onConfirm={onConfirmCrop} />
            {busy && <p className="text-xs fg-muted mt-2">保存中...</p>}
            {error && <p className="text-xs text-red-600" role="alert">{error}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
