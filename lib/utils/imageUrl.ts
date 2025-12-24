/**
 * 画像URL最適化ユーティリティ
 * 
 * Firebase Storage Resize Images Extension により生成された
 * リサイズ版画像のURLを取得する
 */

export type ImageSize = 'thumb' | 'medium' | 'large' | 'original';

/**
 * 画像URLを最適化されたサイズのURLに変換
 * 
 * @param originalUrl - 元の画像URL
 * @param size - 取得したいサイズ ('thumb' | 'medium' | 'large' | 'original')
 * @returns 最適化されたURL
 * 
 * @example
 * ```typescript
 * // サムネイル (200x200)
 * getOptimizedImageUrl('https://...abc123.jpg', 'thumb')
 * // => 'https://...abc123_200x200.jpg'
 * 
 * // 中サイズ (400x400)
 * getOptimizedImageUrl('https://...abc123.jpg', 'medium')
 * // => 'https://...abc123_400x400.jpg'
 * ```
 */
export function getOptimizedImageUrl(
  originalUrl: string | null | undefined,
  size: ImageSize = 'medium'
): string {
  // null/undefined チェック
  if (!originalUrl) return '/placeholder-image.png';
  
  // data URL はそのまま返す
  if (originalUrl.startsWith('data:')) return originalUrl;
  
  // original サイズが指定された場合はそのまま返す
  if (size === 'original') return originalUrl;
  
  // サイズマッピング
  const sizeMap: Record<Exclude<ImageSize, 'original'>, string> = {
    thumb: '200x200',
    medium: '400x400',
    large: '800x800',
  };
  
  const targetSize = sizeMap[size];
  
  // Firebase Storage のURL判定
  const isFirebaseStorage = 
    originalUrl.includes('firebasestorage.googleapis.com') ||
    originalUrl.includes('storage.googleapis.com');
  
  if (!isFirebaseStorage) {
    // Firebase Storage以外のURLはそのまま返す
    return originalUrl;
  }
  
  // 拡張子の前にサイズサフィックスを挿入
  // 例: image.jpg → image_400x400.jpg
  const optimizedUrl = originalUrl.replace(
    /(\.[^./?#]+)(\?|#|$)/,
    `_${targetSize}$1$2`
  );
  
  return optimizedUrl;
}

/**
 * 複数の画像URLを一括で最適化
 * 
 * @param urls - 画像URLの配列
 * @param size - 取得したいサイズ
 * @returns 最適化されたURLの配列
 */
export function batchOptimizeImageUrls(
  urls: (string | null | undefined)[],
  size: ImageSize = 'medium'
): string[] {
  return urls.map(url => getOptimizedImageUrl(url, size));
}

/**
 * 画像URLが最適化可能かチェック
 * 
 * @param url - チェックする画像URL
 * @returns 最適化可能な場合 true
 */
export function isOptimizableImage(url: string | null | undefined): boolean {
  if (!url) return false;
  if (url.startsWith('data:')) return false;
  
  return (
    url.includes('firebasestorage.googleapis.com') ||
    url.includes('storage.googleapis.com')
  );
}
