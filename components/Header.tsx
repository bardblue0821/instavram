"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthUser } from '../lib/hooks/useAuthUser';
import { auth } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import React from 'react';

export default function Header() {
  const { user, loading } = useAuthUser();
  const router = useRouter();

  async function handleLogout() {
    await signOut(auth);
    router.push('/login');
  }

  return (
    <nav className="sticky top-0 bg-white border-b z-50 shadow-sm">
      <div className="max-w-5xl mx-auto flex items-center gap-4 px-4 h-14">
        <Link href="/" className="font-semibold text-lg" aria-label="トップへ">Instavram</Link>
        <div className="ml-auto flex items-center gap-3">
          {loading && <span className="text-sm text-gray-500">読み込み中...</span>}
          {!loading && user && (
            <>
              <Link href={`/user/${user.uid}`} className="text-sm text-gray-700 hover:underline" aria-label="プロフィール">{user.displayName || 'ユーザー'}</Link>
              <Link
                href="/album/new"
                className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
              >アルバム作成</Link>
              <button
                onClick={handleLogout}
                className="text-sm border rounded px-3 py-1 hover:bg-gray-50"
              >ログアウト</button>
            </>
          )}
          {!loading && !user && (
            <Link
              href="/login"
              className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
            >ログイン</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
