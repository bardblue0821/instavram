import { auth } from '../firebase';
import { 
  TwitterAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  UserCredential 
} from 'firebase/auth';
import { ensureUserInFirestore } from './ensureUser';

/**
 * X (Twitter) でログインする
 * まずポップアップを試行し、失敗した場合はリダイレクトにフォールバック
 */
export async function signInWithTwitter(): Promise<UserCredential | null> {
  const provider = new TwitterAuthProvider();
  
  console.log('[Twitter Auth] ログイン開始');
  
  try {
    // まずポップアップを試行
    console.log('[Twitter Auth] ポップアップ認証を試行');
    const result = await signInWithPopup(auth, provider);
    
    console.log('[Twitter Auth] ポップアップ認証成功:', result.user.uid);
    
    // 認証成功後、Firestoreにユーザーを登録
    if (result.user) {
      await ensureUserInFirestore(result.user);
    }
    
    return result;
  } catch (error: any) {
    const errorCode = error?.code;
    const errorMessage = error?.message;
    
    console.error('[Twitter Auth] 認証エラー:', {
      code: errorCode,
      message: errorMessage,
      fullError: error
    });
    
    // ポップアップがブロックされた場合、リダイレクトにフォールバック
    if (errorCode === 'auth/popup-blocked' || errorCode === 'auth/popup-closed-by-user') {
      console.log('[Twitter Auth] ポップアップがブロックされたため、リダイレクトにフォールバック');
      await signInWithRedirect(auth, provider);
      return null; // リダイレクト後は別の処理で結果を取得
    }
    
    // その他のエラーは再スロー
    throw error;
  }
}

/**
 * リダイレクト後の認証結果を処理する
 * アプリの初期化時に一度だけ呼び出す
 */
export async function handleTwitterRedirectResult(): Promise<UserCredential | null> {
  try {
    const result = await getRedirectResult(auth);
    
    if (result && result.user) {
      console.log('[Twitter Auth] リダイレクト認証成功:', result.user.uid);
      
      // Firestoreにユーザーを登録
      await ensureUserInFirestore(result.user);
      
      return result;
    }
    
    return null;
  } catch (error: any) {
    console.error('[Twitter Auth] リダイレクト認証エラー:', error);
    throw error;
  }
}

/**
 * Twitter認証エラーを日本語メッセージに変換
 */
export function translateTwitterAuthError(error: any): string {
  const errorCode = error?.code;
  
  switch (errorCode) {
    case 'auth/popup-blocked':
      return 'ポップアップがブロックされました。ブラウザの設定を確認してください。';
    case 'auth/popup-closed-by-user':
      return 'ログインがキャンセルされました。';
    case 'auth/cancelled-popup-request':
      return 'ログインがキャンセルされました。';
    case 'auth/operation-not-allowed':
      return 'Twitter ログインが有効になっていません。管理者に連絡してください。';
    case 'auth/unauthorized-domain':
      return 'このドメインは認証が許可されていません。';
    case 'auth/account-exists-with-different-credential':
      return 'このメールアドレスは既に別の方法で登録されています。';
    case 'auth/network-request-failed':
      return 'ネットワークエラーが発生しました。接続を確認してください。';
    default:
      return error?.message || 'ログインに失敗しました。もう一度お試しください。';
  }
}
