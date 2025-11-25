"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthUser } from '../lib/hooks/useAuthUser';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import React, { useState, useEffect } from 'react';

export default function Header() {
  const { user, loading } = useAuthUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'light'|'dark'>(() => {
    if (typeof window === 'undefined') return 'light';
    const stored = window.localStorage.getItem('theme');
    if (stored === 'dark' || stored === 'light') return stored;
    // OS設定の初期反映 (stored なしの場合)
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  // 初期適用 & 変更反映
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(theme === 'dark' ? 'theme-dark' : 'theme-light');
    window.localStorage.setItem('theme', theme);
  }, [theme]);

  function toggleTheme() {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }

  async function handleLogout() {
    await signOut(auth);
    router.push('/login');
    setOpen(false);
  }

  function toggleMenu() {
    setOpen(o => !o);
  }

  function closeMenu() { setOpen(false); }

  return (
    <nav className="sticky top-0 surface border-b border-base z-50 shadow-sm">
      <div className="max-w-5xl mx-auto h-14 flex items-center justify-center relative px-4">
        {/* ハンバーガー 左配置 */}
        <button
          aria-label="メニュー"
          aria-expanded={open}
          onClick={toggleMenu}
          className="absolute left-4 inline-flex items-center justify-center w-9 h-9 rounded border border-base hover-surface-alt"
        >
          <span className="sr-only">メニュー</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="7" x2="21" y2="7" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="17" x2="21" y2="17" />
          </svg>
        </button>
        {/* ブランド中央配置 */}
  <Link href="/" className="font-semibold text-lg link-accent" aria-label="トップへ">instaVRam</Link>
        {open && (
          <div
            className="absolute top-14 left-4 w-56 surface-alt border border-base rounded shadow-lg py-2 animate-fadeIn"
            role="menu"
          >
            {loading && (
              <p className="px-4 py-2 text-sm text-gray-500" role="status">読み込み中...</p>
            )}
            {!loading && user && (
              <>
                <Link
                  href="/album/new"
                  onClick={closeMenu}
                  className="block px-4 py-2 text-sm link-accent"
                  role="menuitem"
                >アルバム作成</Link>
                <Link
                  href={`/user/${user.uid}`}
                  onClick={closeMenu}
                  className="block px-4 py-2 text-sm link-accent"
                  role="menuitem"
                >プロフィール</Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm link-accent"
                  role="menuitem"
                >ログアウト</button>
              </>
            )}
            {!loading && !user && (
              <Link
                href="/login"
                onClick={closeMenu}
                className="block px-4 py-2 text-sm link-accent"
                role="menuitem"
              >ログイン</Link>
            )}
            <div className="mt-2 pt-2">
              <button
                onClick={() => { toggleTheme(); closeMenu(); }}
                className="w-full text-left px-4 py-2 text-sm link-accent"
                role="menuitem"
                aria-label="テーマ切替"
              >{theme === 'dark' ? 'ライトモードへ' : 'ダークモードへ'}</button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
