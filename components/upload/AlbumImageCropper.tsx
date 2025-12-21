"use client";

import React, { useMemo, useRef, useState } from "react";
import { Button } from "../ui/Button";
import ReactCrop, {
  type Crop,
  type PixelCrop,
  centerCrop,
  makeAspectCrop,
} from "react-image-crop";

import styles from "./AlbumImageCropper.module.css";

type AspectKey = "square" | "rect";

type Props = {
  src: string;
  onCancel: () => void;
  onConfirm: (areaPixels: { x: number; y: number; width: number; height: number }, zoom: number, aspect: AspectKey) => void;
};

export default function AlbumImageCropper({ src, onCancel, onConfirm }: Props) {
  const [aspectKey, setAspectKey] = useState<AspectKey>("square");
  const imgRef = useRef<HTMLImageElement | null>(null);

  const [crop, setCrop] = useState<Crop>({ unit: "%", x: 10, y: 10, width: 80, height: 80 });
  const [completedCrop, setCompletedCrop] = useState<PixelCrop | null>(null);

  const aspect = useMemo(() => {
    // 正方形は固定。長方形は自由（Twitter風に縦横比を変えられる）
    if (aspectKey === "square") return 1;
    return undefined;
  }, [aspectKey]);

  function recenterForAspect(nextAspect: number) {
    const img = imgRef.current;
    if (!img) return;

    const { width, height } = img;
    const baseWidth = typeof crop.width === "number" && crop.width > 0 ? crop.width : 80;
    const next = centerCrop(
      makeAspectCrop({ unit: "%", width: baseWidth }, nextAspect, width, height),
      width,
      height
    );
    setCrop(next);
  }

  function recenterFree() {
    // 比率自由の初期枠: 画面内に収まる大きめ長方形
    const width = 80;
    const height = 60;
    setCrop({
      unit: "%",
      width,
      height,
      x: (100 - width) / 2,
      y: (100 - height) / 2,
    });
  }

  function onImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    imgRef.current = e.currentTarget;
    if (aspectKey === "square") {
      recenterForAspect(1);
    } else {
      recenterFree();
    }
  }

  function applyAspect(nextKey: AspectKey) {
    setAspectKey(nextKey);
    if (nextKey === "square") {
      recenterForAspect(1);
    } else {
      recenterFree();
    }
  }

  function confirm() {
    const img = imgRef.current;
    if (!img) return;
    if (!completedCrop || completedCrop.width <= 0 || completedCrop.height <= 0) return;

    // react-image-crop の PixelCrop は「表示中の img 要素のpx」基準。
    // 切り抜き処理は元画像（natural）基準で扱えるように変換して渡す。
    const scaleX = img.naturalWidth / img.width;
    const scaleY = img.naturalHeight / img.height;

    onConfirm(
      {
        x: Math.round(completedCrop.x * scaleX),
        y: Math.round(completedCrop.y * scaleY),
        width: Math.round(completedCrop.width * scaleX),
        height: Math.round(completedCrop.height * scaleY),
      },
      1,
      aspectKey
    );
  }

  return (
    <div className={`space-y-3 ${styles.wrapper ?? ""}`.trim()}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button type="button" size="xs" variant={aspectKey === "square" ? "accent" : "ghost"} onClick={() => applyAspect("square")}>
            正方形
          </Button>
          <Button type="button" size="xs" variant={aspectKey === "rect" ? "accent" : "ghost"} onClick={() => applyAspect("rect")}>
            長方形
          </Button>
        </div>
        <p className="text-xs fg-muted">枠をドラッグ/リサイズできます</p>
      </div>

      <div className="flex justify-center">
        <ReactCrop
          className="ReactCrop--no-animate"
          crop={crop}
          onChange={(_pixelCrop: PixelCrop, percentCrop: Crop) => setCrop(percentCrop)}
          onComplete={(c: PixelCrop) => setCompletedCrop(c)}
          aspect={aspect}
          minWidth={40}
          minHeight={40}
          keepSelection
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="crop" className="ReactCrop__image" onLoad={onImageLoad} />
        </ReactCrop>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="subtle" size="sm" onClick={onCancel}>
          キャンセル
        </Button>
        <Button
          type="button"
          variant="accent"
          size="sm"
          onClick={confirm}
          disabled={!completedCrop || completedCrop.width <= 0 || completedCrop.height <= 0}
        >
          切り抜いて反映
        </Button>
      </div>
    </div>
  );
}
