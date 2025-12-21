"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useAuthUser } from "../hooks/useAuthUser";

/**
 * 未ログイン or 未検証ユーザーをトップ（/）へ誘導するクライアントガード。
 * allowRoot が true の場合、トップ（/）では弾かない。
 */
export function useVerificationGuard(allowRoot = false) {
  const router = useRouter();
  const { user, loading } = useAuthUser();

  useEffect(() => {
    if (loading) return;
    // 未ログイン → /
    if (!user) {
      router.replace("/");
      return;
    }
    // 未検証（emailVerified=false）→ /
    if (!user.emailVerified) {
      if (!allowRoot) router.replace("/");
    }
  }, [user?.uid, user?.emailVerified, loading]);
}
