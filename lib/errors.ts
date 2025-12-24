import { ERR } from '../types/models';

// アプリ内統一メッセージ（必要に応じて i18n 切替想定）
const messages: Record<string, string> = {
  [ERR.LIMIT_4_PER_USER]: '画像は1アルバムにつきユーザー毎4枚までです',
  [ERR.TOO_LONG]: '文字数が制限を超えています',
  [ERR.EMPTY]: '内容が空です',
  SELF_FRIEND: '自分自身をフレンドにはできません',
  REQUEST_NOT_FOUND: 'フレンド申請が見つかりません',
  SELF_WATCH: '自分自身をウォッチする必要はありません',
  ALBUM_REQUIRES_IMAGE: 'アルバムには少なくとも1枚の画像が必要です',

  // Firebase Auth
  'auth/invalid-credential': '認証に失敗しました（パスワードが違うか、再ログインが必要です）',
  'auth/wrong-password': 'パスワードが違います',
  'auth/user-mismatch': '別のアカウントでログインしている可能性があります。再ログインしてください。',
  'auth/requires-recent-login': '安全のため再ログインが必要です。一度ログアウトしてログインし直してください。',
  MISSING_PASSWORD: 'パスワードを入力してください',
  MISSING_EMAIL: 'メールアドレスが取得できません。再ログインしてください。',
  // Firestore
  'permission-denied': '権限がありません（アルバムの公開範囲・フレンド関係をご確認ください）',
};

export function translateError(e: unknown): string {
  if (typeof e === 'string') return messages[e] || e;
  if (e && typeof e === 'object') {
    const code = (e as any).code || (e as any).message;
    if (typeof code === 'string') return messages[code] || code;
  }
  return '不明なエラー';
}
