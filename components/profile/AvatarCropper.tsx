"use client";
import React, { useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';

type Props = {
  src: string;
  onCancel: () => void;
  onConfirm: (area: Area, zoom: number) => void;
};

export default function AvatarCropper({ src, onCancel, onConfirm }: Props) {
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<Area | null>(null);

  return (
    <div className="space-y-3">
      <div className="relative w-full h-80 bg-black">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={1}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={(area: Area, areaPixels: Area) => setArea(areaPixels)}
          showGrid={false}
          restrictPosition={false}
        />
      </div>
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full"
          aria-label="ズーム"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button type="button" className="px-3 py-1.5 text-sm rounded surface-alt" onClick={onCancel}>キャンセル</button>
        <button
          type="button"
          className="px-3 py-1.5 text-sm rounded btn-accent disabled:opacity-50"
          onClick={() => area && onConfirm(area, zoom)}
          disabled={!area}
        >
          切り抜いて保存
        </button>
      </div>
    </div>
  );
}
