import { useEffect, useRef } from 'react';
import { useInView } from 'react-intersection-observer';

/**
 * タイムラインアイテムの可視状態を管理するフック
 * 
 * Intersection Observer を使用して、アイテムが画面内に表示されているかを検出
 * 購読の開始/停止を制御するために使用
 * 
 * @param albumId - アルバムID
 * @param onVisibilityChange - 可視状態が変わった時のコールバック
 * @returns ref（要素にアタッチ）と inView（可視状態）
 */
export function useTimelineItemVisibility(
  albumId: string,
  onVisibilityChange?: (albumId: string, isVisible: boolean) => void
) {
  const { ref, inView } = useInView({
    threshold: 0.1, // 10%以上表示されたら可視と判定
    rootMargin: '300px 0px', // 画面外 300px の範囲も監視（早めに購読開始）
    triggerOnce: false, // 何度も発火させる
  });

  const prevInViewRef = useRef(inView);

  useEffect(() => {
    // 可視状態が変化した時のみコールバック実行
    if (prevInViewRef.current !== inView) {
      prevInViewRef.current = inView;
      onVisibilityChange?.(albumId, inView);
    }
  }, [albumId, inView, onVisibilityChange]);

  return { ref, inView };
}
