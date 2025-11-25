"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthUser } from '../lib/hooks/useAuthUser';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import React, { useState, useEffect, useRef } from 'react';

export default function Header() {
  const { user, loading } = useAuthUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const [userDoc, setUserDoc] = useState<any>(null);
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
    setConfirmLogout(false);
  }

  function toggleMenu() { setOpen(o => !o); }

  function closeMenu() { setOpen(false); }

  // メニュー外クリック & Escape で閉じる
  useEffect(() => {
    if (!open) return; // 開いている時のみリスナ登録
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target) && buttonRef.current && !buttonRef.current.contains(target)) {
        setOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKey);
    };
  }, [open]);

  // Logout確認モーダル: Escape で閉じる & 初期フォーカス
  useEffect(() => {
    if (!confirmLogout) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setConfirmLogout(false);
    }
    window.addEventListener('keydown', handleKey);
    // 初期フォーカス
    confirmBtnRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', handleKey);
    };
  }, [confirmLogout]);

  function openLogoutConfirm() {
    setConfirmLogout(true);
  }
  function cancelLogout() {
    setConfirmLogout(false);
  }

  return (
    <nav className="sticky top-0 surface border-b border-base z-50 shadow-sm">
      <div className="max-w-5xl mx-auto h-14 flex items-center justify-center relative px-4">
        {/* ハンバーガー 左配置 */}
        <button
          ref={buttonRef}
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
            ref={menuRef}
            className="absolute top-14 left-4 w-56 surface-alt border border-base rounded shadow-lg py-2 animate-fadeIn"
            role="menu"
          >
            {loading && (
              <p className="px-4 py-2 text-sm text-gray-500" role="status">読み込み中...</p>
            )}
            {!loading && user && (
              <>
                <Link
                  href="/timeline"
                  onClick={closeMenu}
                  className="block px-4 py-2 text-sm link-accent"
                  role="menuitem"
                >タイムライン</Link>
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
                  onClick={openLogoutConfirm}
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
      {confirmLogout && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          aria-labelledby="logout-dialog-title"
          role="dialog"
          aria-modal="true"
        >
          {/* オーバーレイ */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={cancelLogout}
          />
          <div className="relative surface-alt border border-base rounded shadow-lg max-w-sm w-[90%] p-5 animate-fadeIn">
            <h2 id="logout-dialog-title" className="font-semibold mb-2">ログアウトしますか？</h2>
            <p className="text-sm mb-4 text-muted">現在のセッションが終了し、再度ログインが必要になります。</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={cancelLogout}
                className="px-3 py-2 text-sm rounded border border-base hover-surface-alt"
              >キャンセル</button>
              <button
                ref={confirmBtnRef}
                onClick={handleLogout}
                className="px-3 py-2 text-sm rounded btn-accent"
              >ログアウト</button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
