"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthUser } from '../lib/hooks/useAuthUser';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import React, { useState } from 'react';

export default function Header() {
  const { user, loading } = useAuthUser();
  const router = useRouter();
  const [open, setOpen] = useState(false);

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
    <nav className="sticky top-0 bg-white border-b z-50 shadow-sm">
      <div className="max-w-5xl mx-auto h-14 flex items-center justify-center relative px-4">
        {/* ハンバーガー 左配置 */}
        <button
          aria-label="メニュー"
          aria-expanded={open}
          onClick={toggleMenu}
          className="absolute left-4 inline-flex items-center justify-center w-9 h-9 rounded hover:bg-gray-100 border border-gray-300"
        >
          <span className="sr-only">メニュー</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="7" x2="21" y2="7" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="17" x2="21" y2="17" />
          </svg>
        </button>
        {/* ブランド中央配置 */}
        <Link href="/" className="font-semibold text-lg" aria-label="トップへ">Instavram</Link>
        {open && (
          <div
            className="absolute top-14 left-4 w-56 bg-white border border-gray-200 rounded shadow-lg py-2 animate-fadeIn"
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
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  role="menuitem"
                >アルバム作成</Link>
                <Link
                  href={`/user/${user.uid}`}
                  onClick={closeMenu}
                  className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  role="menuitem"
                >プロフィール</Link>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  role="menuitem"
                >ログアウト</button>
              </>
            )}
            {!loading && !user && (
              <Link
                href="/login"
                onClick={closeMenu}
                className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                role="menuitem"
              >ログイン</Link>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
