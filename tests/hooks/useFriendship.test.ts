// tests/hooks/useFriendship.test.ts
// 参考: useAsyncOperation を使った useFriendship のテスト例

import { renderHook, act, waitFor } from '@testing-library/react';
import { useFriendship } from '@/lib/hooks/useFriendship';
import * as friendRepo from '@/lib/repos/friendRepo';

// モック
jest.mock('@/lib/repos/friendRepo');

describe('useFriendship with useAsyncOperation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('フレンド申請中はloadingがtrueになる', async () => {
    const mockSendRequest = jest.spyOn(friendRepo, 'sendFriendRequest')
      .mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    const { result } = renderHook(() => 
      useFriendship({ viewerUid: 'user1', profileUid: 'user2' })
    );

    // 初期状態
    expect(result.current.loading).toBe(false);

    // 申請実行
    act(() => {
      result.current.send();
    });

    // ローディング中
    await waitFor(() => {
      expect(result.current.loading).toBe(true);
    });

    // 完了後
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.state).toBe('sent');
    });
  });

  it('エラー時でもloadingが正しくfalseになる', async () => {
    jest.spyOn(friendRepo, 'sendFriendRequest')
      .mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => 
      useFriendship({ viewerUid: 'user1', profileUid: 'user2' })
    );

    await act(async () => {
      try {
        await result.current.send();
      } catch (e) {
        // エラーを握りつぶす
      }
    });

    // エラー後もloadingはfalseになっている
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeTruthy();
  });
});
