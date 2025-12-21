"use client";
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useMantineColorScheme, useComputedColorScheme } from '@mantine/core';
import { Button } from './ui/Button';

export default function ThemeSwitch() {
  const pathname = usePathname();
  // Mantine のカラースキームに統一し、SSR/CSR 初期値の不一致を防ぐ
  const { setColorScheme } = useMantineColorScheme();
  // SSR 時は 'light' を返し、クライアントマウント後に実際の値へ同期（Hydration ずれ防止）
  const computed = useComputedColorScheme('light', { getInitialValueInEffect: true });

  // 既存の CSS 変数切り替え（:root.theme-light / :root.theme-dark）を Mantine の値に追従
  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(computed === 'dark' ? 'theme-dark' : 'theme-light');
  }, [computed]);

  const isDark = computed === 'dark';

  // トップ（/）では「ライトモードへ」ボタンは表示しない
  if (pathname === '/' && isDark) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      fullWidth
      onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
      aria-label="テーマ切替"
    >
      {isDark ? 'ライトモードへ' : 'ダークモードへ'}
    </Button>
  );
}
