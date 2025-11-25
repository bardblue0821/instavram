"use client";
import React, { useEffect } from 'react';
import { useAuthUser } from '../lib/hooks/useAuthUser';
import { usePathname, useRouter } from 'next/navigation';

/**
 * グローバル認証ガード:
 * - 未ログイン時は `/` と `/login` 以外のページへアクセスした場合 `/login` へリダイレクト。
 * - Firebase Auth 状態確定 (loading=false) 後に判定。
 * - ルート `/` は既存で `/timeline` に redirect されるため、結果的に未ログインなら `/login` へ再リダイレクトされる。
 *   必要であればホームの挙動を分岐 (例: 未ログインならランディング表示) へ後で変更可能。
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthUser();
  const pathname = usePathname();
  const router = useRouter();
  const publicPaths = new Set<string>(['/', '/login']);
  const isPublic = publicPaths.has(pathname);

  useEffect(() => {
    if (loading) return; // 状態未確定
    if (!user && !isPublic) {
      router.replace('/login');
    }
  }, [user, loading, isPublic, router]);

  // フラッシュ抑止: 未ログインかつ保護ページ & 認証未確定 or 既に未ログイン確定 → 子を描画しない
  if ((loading && !isPublic) || (!loading && !user && !isPublic)) {
    return null; // 何も表示せずリダイレクト待ち (必要ならローディング骨組みを後で追加)
  }

  // 公開ページ または ログイン済みユーザの場合のみ子要素表示
  return <>{children}</>;
}

export default AuthGate;
