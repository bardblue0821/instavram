"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthUser } from '../lib/hooks/useAuthUser';
import { getUser } from '../lib/repos/userRepo';
import { useNotificationsBadge } from '../lib/hooks/useNotificationsBadge';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import React, { useState, useEffect, useRef } from 'react';
import { Button } from "./ui/Button";

export default function Header() {
  const { user, loading } = useAuthUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const confirmBtnRef = useRef<HTMLButtonElement | null>(null);
  const [userDoc, setUserDoc] = useState<any>(null);
  const unread = useNotificationsBadge();
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

  // user ドキュメント取得 (handle 用)
  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) { if (active) setUserDoc(null); return; }
      try {
        const doc = await getUser(user.uid);
        console.log('[Header] ユーザードキュメント取得:', {
          uid: user.uid,
          handle: doc?.handle,
          displayName: doc?.displayName
        });
        if (active) setUserDoc(doc);
      } catch (e) {
        console.error('[Header] ユーザードキュメント取得エラー:', e);
        if (active) setUserDoc(null);
      }
    })();
    return () => { active = false; };
  }, [user]);

  function toggleTheme() {
    setTheme(t => (t === 'dark' ? 'light' : 'dark'));
  }

  async function handleLogout() {
    await signOut(auth);
    router.push('/');
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
  <Link href="/" className="font-semibold text-lg link-accent" aria-label="トップへ">Virtualbum</Link>
        {open && (
          <div
            ref={menuRef}
            className="absolute top-14 left-4 w-56 surface-alt border border-base rounded shadow-lg py-2 animate-fadeIn"
            role="menu"
          >
            {loading && (
              <p className="px-4 py-2 text-sm fg-subtle" role="status">読み込み中...</p>
            )}
            {!loading && user && (
              <>
                <Link
                  href="/search"
                  onClick={closeMenu}
                  className="block px-4 py-2 text-sm link-accent"
                  role="menuitem"
                >検索</Link>
                <Link
                  href="/timeline"
                  onClick={closeMenu}
                  className="block px-4 py-2 text-sm link-accent"
                  role="menuitem"
                >タイムライン</Link>
                <Link
                  href="/notification"
                  onClick={closeMenu}
                  className="block px-4 py-2 text-sm link-accent relative"
                  role="menuitem"
                  aria-label="通知"
                >通知{unread>0 && <span className="ml-2 inline-block min-w-5 text-center text-[10px] px-1 py-0.5 rounded bg-red-600 text-white" aria-label={`未読通知 ${unread} 件`}>{unread}</span>}</Link>
                <Link
                  href="/album/new"
                  onClick={closeMenu}
                  className="block px-4 py-2 text-sm link-accent"
                  role="menuitem"
                >アルバム作成</Link>
                <Link
                  href={userDoc?.handle ? `/user/${userDoc.handle}` : '#'}
                  onClick={closeMenu}
                  className="block px-4 py-2 text-sm link-accent disabled:opacity-50"
                  role="menuitem"
                  aria-disabled={!userDoc?.handle}
                >プロフィール</Link>
                <button
                  onClick={openLogoutConfirm}
                  className="w-full text-left px-4 py-2 text-sm link-accent"
                  role="menuitem"
                >ログアウト</button>
              </>
            )}
            {!loading && !user && (
              <>
                <Link
                  href="/search"
                  onClick={closeMenu}
                  className="block px-4 py-2 text-sm link-accent"
                  role="menuitem"
                >検索</Link>
                <Link
                  href="/"
                  onClick={closeMenu}
                  className="block px-4 py-2 text-sm link-accent"
                  role="menuitem"
                >ログイン</Link>
              </>
            )}
            <div className="mt-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="md"
                fullWidth
                onClick={() => { toggleTheme(); closeMenu(); }}
                className="justify-start text-left link-accent border-0 hover:opacity-90"
                role="menuitem"
                aria-label="テーマ切替"
              >
                {theme === 'dark' ? 'ライトモードへ' : 'ダークモードへ'}
              </Button>
            </div>
          </div>
        )}
      </div>
      {confirmLogout && (
        <div
          className="fixed inset-0 z-100 flex items-center justify-center"
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
              <Button type="button" variant="ghost" size="md" onClick={cancelLogout}>
                キャンセル
              </Button>
              <Button type="button" variant="accent" size="md" onClick={handleLogout} ref={confirmBtnRef}>
                ログアウト
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
