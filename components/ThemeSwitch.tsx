"use client";
import { useEffect, useState } from 'react';

export default function ThemeSwitch() {
  const [theme, setTheme] = useState<'light'|'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = window.localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  return (
    <button
      onClick={() => setTheme(t => (t === 'dark' ? 'light' : 'dark'))}
      className="w-full text-center px-3 py-2 text-sm rounded border border-base hover-surface-alt"
      aria-label="テーマ切替"
    >
      {theme === 'dark' ? 'ライトモードへ' : 'ダークモードへ'}
    </button>
  );
}
