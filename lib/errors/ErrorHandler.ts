import { FirebaseError } from 'firebase/app';

/**
 * アプリケーション固有のエラークラス
 * ユーザーに表示するメッセージと、ログに記録する詳細メッセージを分離
 */
export class AppError extends Error {
  constructor(
    message: string,
    public userMessage: string,
    public severity: 'error' | 'warning' | 'info' = 'error'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Firebase エラーコードを日本語メッセージに変換
 */
export function translateFirebaseError(error: FirebaseError): string {
  const errorMessages: Record<string, string> = {
    // 認証エラー
    'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
    'auth/invalid-email': 'メールアドレスの形式が正しくありません',
    'auth/operation-not-allowed': 'この操作は許可されていません',
    'auth/weak-password': 'パスワードは6文字以上で設定してください',
    'auth/user-disabled': 'このアカウントは無効化されています',
    'auth/user-not-found': 'メールアドレスまたはパスワードが正しくありません',
    'auth/wrong-password': 'メールアドレスまたはパスワードが正しくありません',
    'auth/invalid-credential': 'メールアドレスまたはパスワードが正しくありません',
    'auth/too-many-requests': 'リクエストが多すぎます。しばらくしてから再試行してください',
    'auth/network-request-failed': 'ネットワークエラーが発生しました',
    
    // Firestore エラー
    'permission-denied': 'この操作を実行する権限がありません',
    'not-found': '指定されたデータが見つかりません',
    'already-exists': 'データは既に存在します',
    'resource-exhausted': 'リソースの上限に達しました。しばらくしてから再試行してください',
    'failed-precondition': '前提条件を満たしていません',
    'aborted': '操作が中断されました',
    'out-of-range': '指定された範囲が不正です',
    'unimplemented': 'この機能は実装されていません',
    'internal': 'サーバー内部エラーが発生しました',
    'unavailable': 'サービスが一時的に利用できません',
    'data-loss': 'データの損失が検出されました',
    'unauthenticated': '認証が必要です',
    
    // Storage エラー
    'storage/unauthorized': 'ストレージへのアクセス権限がありません',
    'storage/canceled': 'アップロードがキャンセルされました',
    'storage/unknown': 'ストレージで不明なエラーが発生しました',
    'storage/object-not-found': 'ファイルが見つかりません',
    'storage/quota-exceeded': 'ストレージの容量が不足しています',
    'storage/unauthenticated': '認証が必要です',
    'storage/retry-limit-exceeded': 'リトライ回数の上限に達しました',
  };

  const code = error.code || 'unknown';
  return errorMessages[code] || `エラーが発生しました (${code})`;
}

/**
 * Toast コンテキストの型定義
 */
export interface ToastContext {
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
  success: (message: string) => void;
}

/**
 * 統一されたエラーハンドリング関数
 * 
 * @param error - キャッチされたエラー
 * @param toast - Toast コンテキスト
 * @param fallbackMessage - デフォルトのユーザー向けメッセージ
 * 
 * @example
 * ```typescript
 * try {
 *   await sendFriendRequest(userId, targetId);
 * } catch (e) {
 *   handleError(e, toast);
 * }
 * ```
 */
export function handleError(
  error: unknown,
  toast: ToastContext,
  fallbackMessage: string = '予期しないエラーが発生しました'
): void {
  if (error instanceof AppError) {
    // アプリケーション固有のエラー
    toast[error.severity](error.userMessage);
    console.error(`[AppError] ${error.message}`, error);
  } else if (error instanceof FirebaseError) {
    // Firebase エラー
    const userMessage = translateFirebaseError(error);
    toast.error(userMessage);
    console.error(`[FirebaseError] ${error.code}: ${error.message}`, error);
  } else if (error instanceof Error) {
    // 標準 Error
    toast.error(fallbackMessage);
    console.error(`[Error] ${error.message}`, error);
  } else {
    // その他（文字列など）
    toast.error(fallbackMessage);
    console.error('[Unknown Error]', error);
  }
}

/**
 * よくあるエラーケースのヘルパー関数
 */
export const ErrorHelpers = {
  /**
   * ネットワークエラー
   */
  network: () => new AppError(
    'Network error',
    'ネットワークエラーが発生しました。接続を確認してください',
    'error'
  ),

  /**
   * 権限エラー
   */
  permission: (action: string = 'この操作') => new AppError(
    'Permission denied',
    `${action}を実行する権限がありません`,
    'error'
  ),

  /**
   * バリデーションエラー
   */
  validation: (message: string) => new AppError(
    'Validation error',
    message,
    'warning'
  ),

  /**
   * 見つからないエラー
   */
  notFound: (resource: string = 'データ') => new AppError(
    'Not found',
    `${resource}が見つかりません`,
    'error'
  ),

  /**
   * 重複エラー
   */
  duplicate: (resource: string = 'データ') => new AppError(
    'Already exists',
    `${resource}は既に存在します`,
    'warning'
  ),

  /**
   * レート制限エラー
   */
  rateLimit: () => new AppError(
    'Rate limit exceeded',
    'リクエストが多すぎます。しばらくしてから再試行してください',
    'warning'
  ),

  /**
   * 自分自身への操作エラー
   */
  selfOperation: (action: string) => new AppError(
    'Self operation not allowed',
    `自分自身に${action}することはできません`,
    'warning'
  ),
};
