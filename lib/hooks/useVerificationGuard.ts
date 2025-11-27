"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthUser } from "../hooks/useAuthUser";

/**
 * 未ログイン or 未検証ユーザーを /login へ誘導するクライアントガード。
 * allowRoot が true の場合、トップ（/）では弾かない。
 */
export function useVerificationGuard(allowRoot = false) {
  const router = useRouter();
  const { user, loading } = useAuthUser();

  useEffect(() => {
    if (loading) return;
    // 未ログイン → /login
    if (!user) {
      router.replace("/login");
      return;
    }
    // 未検証（emailVerified=false）→ /login
    if (!user.emailVerified) {
      if (!allowRoot) router.replace("/login");
    }
  }, [user?.uid, user?.emailVerified, loading]);
}
