/**
 * エラーハンドリング統一の使用例
 * 
 * このファイルは実際のコンポーネントではなく、
 * 新しいエラーハンドリングパターンの使用方法を示すサンプルです。
 */

import { useToast } from '../../components/ui/Toast';
import { handleError, ErrorHelpers } from '../errors/ErrorHandler';
import { useAsyncOperation } from '../hooks/useAsyncOperation';
import { sendFriendRequest, acceptFriend, removeFriend } from '../repos/friendRepo';
import { addWatch, removeWatch } from '../repos/watchRepo';

/**
 * 例1: 基本的なエラーハンドリング
 */
function Example1_BasicErrorHandling() {
  const toast = useToast();

  const handleSendFriendRequest = async (userId: string, targetId: string) => {
    try {
      await sendFriendRequest(userId, targetId);
      toast.success('フレンド申請を送信しました');
    } catch (e) {
      // 統一されたエラーハンドリング
      handleError(e, toast);
    }
  };

  return null; // サンプルのため実装なし
}

/**
 * 例2: useAsyncOperation フックとの組み合わせ
 */
function Example2_WithAsyncHook() {
  const toast = useToast();
  const { loading, execute: sendRequest } = useAsyncOperation(sendFriendRequest);

  const handleSend = async (userId: string, targetId: string) => {
    try {
      await sendRequest(userId, targetId);
      toast.success('フレンド申請を送信しました');
    } catch (e) {
      handleError(e, toast);
    }
  };

  return null; // サンプルのため実装なし
}

/**
 * 例3: カスタムエラーメッセージ
 */
function Example3_CustomErrorMessage() {
  const toast = useToast();

  const handleWatch = async (userId: string, targetId: string) => {
    try {
      await addWatch(userId, targetId);
      toast.success('ウォッチを追加しました');
    } catch (e) {
      // カスタムフォールバックメッセージ
      handleError(e, toast, 'ウォッチの追加に失敗しました');
    }
  };

  return null; // サンプルのため実装なし
}

/**
 * 例4: AppError を使ったカスタムエラー
 */
function Example4_AppError() {
  const toast = useToast();

  const validateInput = (input: string) => {
    if (input.length < 3) {
      throw ErrorHelpers.validation('3文字以上入力してください');
    }
    if (input.length > 50) {
      throw ErrorHelpers.validation('50文字以内で入力してください');
    }
  };

  const handleSubmit = async (input: string) => {
    try {
      validateInput(input);
      // 処理続行...
      toast.success('保存しました');
    } catch (e) {
      handleError(e, toast);
    }
  };

  return null; // サンプルのため実装なし
}

/**
 * 例5: 複数の操作でのエラーハンドリング
 */
function Example5_MultipleOperations() {
  const toast = useToast();

  const handleAcceptAndWatch = async (userId: string, targetId: string) => {
    try {
      // フレンド申請を承認
      await acceptFriend(userId, targetId);
      toast.success('フレンド申請を承認しました');

      // ウォッチも追加
      try {
        await addWatch(userId, targetId);
        toast.info('ウォッチも追加しました');
      } catch (watchError) {
        // ウォッチ失敗は警告レベル（フレンド承認は成功している）
        handleError(watchError, toast, 'ウォッチの追加に失敗しました');
      }
    } catch (e) {
      // フレンド承認失敗はエラーレベル
      handleError(e, toast, 'フレンド申請の承認に失敗しました');
    }
  };

  return null; // サンプルのため実装なし
}

/**
 * 例6: 条件付きエラーハンドリング
 */
function Example6_ConditionalHandling() {
  const toast = useToast();

  const handleRemoveFriend = async (
    userId: string,
    targetId: string,
    showConfirm: boolean
  ) => {
    try {
      if (showConfirm) {
        // 確認ダイアログの表示は省略
        // const confirmed = await showConfirmDialog();
        // if (!confirmed) return;
      }

      await removeFriend(userId, targetId);
      toast.success('フレンドを解除しました');
    } catch (e) {
      handleError(e, toast);
    }
  };

  return null; // サンプルのため実装なし
}

/**
 * 例7: リトライロジック付き
 */
function Example7_WithRetry() {
  const toast = useToast();

  const handleWithRetry = async (
    operation: () => Promise<void>,
    maxRetries: number = 3
  ) => {
    let lastError: unknown;

    for (let i = 0; i < maxRetries; i++) {
      try {
        await operation();
        toast.success('操作が完了しました');
        return;
      } catch (e) {
        lastError = e;
        if (i < maxRetries - 1) {
          // リトライ前に待機
          await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
        }
      }
    }

    // すべてのリトライが失敗
    handleError(lastError, toast, '操作に失敗しました。時間をおいて再試行してください。');
  };

  return null; // サンプルのため実装なし
}

/**
 * 既存コードの移行例
 * 
 * Before:
 * ```typescript
 * try {
 *   await sendFriendRequest(userId, targetId);
 *   alert('送信しました');
 * } catch (e: any) {
 *   if (e.message === 'SELF_FRIEND') {
 *     alert('自分自身にフレンド申請できません');
 *   } else {
 *     alert('エラーが発生しました');
 *   }
 *   console.error(e);
 * }
 * ```
 * 
 * After:
 * ```typescript
 * try {
 *   await sendFriendRequest(userId, targetId);
 *   toast.success('フレンド申請を送信しました');
 * } catch (e) {
 *   handleError(e, toast);
 * }
 * ```
 */

export {};
