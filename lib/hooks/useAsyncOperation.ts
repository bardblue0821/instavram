import { useState, useCallback } from 'react';

export interface AsyncOperationState<T> {
  loading: boolean;
  error: Error | null;
  data: T | null;
}

export interface UseAsyncOperationReturn<T extends any[], R> extends AsyncOperationState<R> {
  execute: (...args: T) => Promise<R>;
  reset: () => void;
}

/**
 * 非同期操作を管理するカスタムフック
 * ローディング状態、エラー、結果を一元管理する
 * 
 * @param operation - 実行する非同期関数
 * @returns ローディング状態、エラー、結果、実行関数、リセット関数
 * 
 * @example
 * ```typescript
 * const { loading, error, data, execute } = useAsyncOperation(sendFriendRequest);
 * 
 * const handleSend = async () => {
 *   try {
 *     await execute(userId, targetId);
 *     toast.success('フレンド申請を送信しました');
 *   } catch (e) {
 *     handleError(e, toast);
 *   }
 * };
 * ```
 */
export function useAsyncOperation<T extends any[], R>(
  operation: (...args: T) => Promise<R>
): UseAsyncOperationReturn<T, R> {
  const [state, setState] = useState<AsyncOperationState<R>>({
    loading: false,
    error: null,
    data: null,
  });

  const execute = useCallback(
    async (...args: T): Promise<R> => {
      setState({ loading: true, error: null, data: null });
      try {
        const result = await operation(...args);
        setState({ loading: false, error: null, data: result });
        return result;
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        setState({ loading: false, error: err, data: null });
        throw error; // 呼び出し側でハンドリングできるように再スロー
      }
    },
    [operation]
  );

  const reset = useCallback(() => {
    setState({ loading: false, error: null, data: null });
  }, []);

  return {
    ...state,
    execute,
    reset,
  };
}
