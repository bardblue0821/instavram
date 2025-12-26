// デバッグ用の一時ファイル（確認後は削除してください）
// components/profile/FriendActionsDebug.tsx
"use client";
import { useFriendship } from '@/lib/hooks/useFriendship';
import { useEffect } from 'react';

export function FriendActionsDebug({ viewerUid, profileUid }: { viewerUid: string | null; profileUid: string }) {
  const friendship = useFriendship({ viewerUid, profileUid });

  useEffect(() => {
    console.log('[FriendActionsDebug] 状態変化:', {
      state: friendship.state,
      loading: friendship.loading,
      error: friendship.error,
    });
  }, [friendship.state, friendship.loading, friendship.error]);

  return null;
}
