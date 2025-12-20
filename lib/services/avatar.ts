export async function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

export async function getCroppedBlob(
  imageSrc: string,
  cropAreaPixels: { x: number; y: number; width: number; height: number },
  outputSize = 512,
  mime: 'image/jpeg' | 'image/webp' = 'image/jpeg',
  quality = 0.9,
): Promise<Blob> {
  return getCroppedBlobSized(imageSrc, cropAreaPixels, { width: outputSize, height: outputSize }, mime, quality);
}

export async function getCroppedBlobSized(
  imageSrc: string,
  cropAreaPixels: { x: number; y: number; width: number; height: number },
  output: { width: number; height: number },
  mime: 'image/jpeg' | 'image/webp' = 'image/jpeg',
  quality = 0.9,
): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not supported');

  canvas.width = output.width;
  canvas.height = output.height;

  const scaleX = image.naturalWidth / image.width;
  const scaleY = image.naturalHeight / image.height;

  const sx = cropAreaPixels.x * scaleX;
  const sy = cropAreaPixels.y * scaleY;
  const sWidth = cropAreaPixels.width * scaleX;
  const sHeight = cropAreaPixels.height * scaleY;

  // 背景塗りつぶし（JPEG用の白）
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, output.width, output.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Failed to create blob'));
      resolve(blob);
    }, mime, quality);
  });
}
