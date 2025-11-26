"use client";
import React, { useEffect } from 'react';
import { useAuthUser } from '../lib/hooks/useAuthUser';
import { usePathname, useRouter } from 'next/navigation';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthUser();
  const pathname = usePathname();
  const router = useRouter();
  // 公開パスはログイン画面のみ（未確認ユーザーはトップも不可）
  const publicPaths = new Set<string>(['/login']);
  const isPublic = publicPaths.has(pathname);

  useEffect(() => {
    if (loading) return;
    // 未ログイン または 未確認ユーザー は /login 以外へアクセス不可
    if ((!user || (user && !user.emailVerified)) && !isPublic) {
      router.replace('/login');
    }
  }, [user, loading, isPublic, router]);

  if ((loading && !isPublic) || (!loading && (!user || (user && !user.emailVerified)) && !isPublic)) {
    return null; 
  }

  return <>{children}</>;
}

export default AuthGate;
