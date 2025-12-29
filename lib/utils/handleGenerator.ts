import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * 表示名からユニークな handle を生成
 * 既に存在する場合は末尾に数字を追加
 */
export async function generateUniqueHandle(displayName: string): Promise<string> {
  // 表示名を handle 用に正規化
  // - 小文字に変換
  // - スペースをアンダースコアに置換
  // - 英数字とアンダースコア以外を削除
  let baseHandle = displayName
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
  
  // 空文字列または短すぎる場合はデフォルト値
  if (!baseHandle || baseHandle.length < 3) {
    baseHandle = 'user';
  }
  
  // 最大20文字に制限
  baseHandle = baseHandle.substring(0, 20);
  
  // ユニーク性を確認
  let handle = baseHandle;
  let suffix = 1;
  
  while (await handleExists(handle)) {
    handle = `${baseHandle}${suffix}`;
    suffix++;
    
    // 無限ループ防止（最大100回試行）
    if (suffix > 100) {
      // ランダムな文字列を追加
      const randomSuffix = Math.random().toString(36).substring(2, 8);
      handle = `${baseHandle}_${randomSuffix}`;
      break;
    }
  }
  
  return handle;
}

/**
 * handle が既に存在するかチェック
 */
async function handleExists(handle: string): Promise<boolean> {
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('handle', '==', handle));
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

/**
 * Twitter のユーザー名から handle を生成
 * (オプション: Twitter のユーザー名が取得できる場合)
 */
export function sanitizeTwitterUsername(twitterUsername: string): string {
  return twitterUsername
    .replace(/^@/, '') // 先頭の @ を削除
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '');
}
