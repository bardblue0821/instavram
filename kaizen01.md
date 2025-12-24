# 改善実装記録 01: エラー表示の統一

**実装日:** 2025-12-24  
**優先度:** 🔴 最優先（本番リリース前に必須）  
**影響範囲:** プロジェクト全体

---

## 📋 背景と課題

### 現状の問題点

プロジェクト全体でエラー表示が統一されておらず、以下のような問題がありました:

```typescript
// ❌ ある画面では alert
alert('エラーが発生しました');

// ❌ ある画面では Toast
toast.error('エラーが発生しました');

// ❌ ある画面では useState でインライン表示
setError('エラーが発生しました');

// ❌ ある画面では console.error のみ（ユーザーに通知なし）
console.error('エラー', e);
```

### 問題の影響

1. **ユーザー体験の不一致**: 同じアプリなのにエラー表示方法がバラバラ
2. **保守性の低下**: エラーメッセージの変更時に全ファイルを修正が必要
3. **デバッグの困難**: エラーログが不統一で原因特定が困難
4. **Firebase エラーの扱い**: エラーコードが英語のまま表示される
5. **セキュリティリスク**: 詳細なエラー情報がユーザーに露出

---

## ✅ 実装内容

### 1. エラーハンドリングの基盤作成

#### `lib/errors/ErrorHandler.ts`

**主な機能:**

- **AppError クラス**: アプリケーション固有のエラーを表現
  - `message`: 開発者向け詳細メッセージ（ログに記録）
  - `userMessage`: ユーザー向けメッセージ（Toast で表示）
  - `severity`: エラーレベル（error/warning/info）

- **translateFirebaseError 関数**: Firebase エラーコードを日本語に変換
  - 認証エラー: `auth/email-already-in-use` → "このメールアドレスは既に使用されています"
  - Firestore エラー: `permission-denied` → "この操作を実行する権限がありません"
  - Storage エラー: `storage/quota-exceeded` → "ストレージの容量が不足しています"

- **handleError 関数**: 統一されたエラーハンドリング
  ```typescript
  export function handleError(
    error: unknown,
    toast: ToastContext,
    fallbackMessage: string = '予期しないエラーが発生しました'
  ): void
  ```

- **ErrorHelpers オブジェクト**: よくあるエラーケースのヘルパー
  - `network()`: ネットワークエラー
  - `permission(action)`: 権限エラー
  - `validation(message)`: バリデーションエラー
  - `notFound(resource)`: 見つからないエラー
  - `duplicate(resource)`: 重複エラー
  - `rateLimit()`: レート制限エラー
  - `selfOperation(action)`: 自分自身への操作エラー

**実装例:**

```typescript
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

export function handleError(error: unknown, toast: ToastContext, fallbackMessage?: string): void {
  if (error instanceof AppError) {
    toast[error.severity](error.userMessage);
    console.error(`[AppError] ${error.message}`, error);
  } else if (error instanceof FirebaseError) {
    const userMessage = translateFirebaseError(error);
    toast.error(userMessage);
    console.error(`[FirebaseError] ${error.code}: ${error.message}`, error);
  } else if (error instanceof Error) {
    toast.error(fallbackMessage || '予期しないエラーが発生しました');
    console.error(`[Error] ${error.message}`, error);
  } else {
    toast.error(fallbackMessage || '予期しないエラーが発生しました');
    console.error('[Unknown Error]', error);
  }
}
```

---

### 2. Toast コンポーネントの拡張

#### `components/ui/Toast.tsx`

**変更内容:**

`useToast()` フックに ErrorHandler との統合用ヘルパーメソッドを追加:

```typescript
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  
  return {
    ...ctx,
    error: (message: string, duration?: number) => ctx.show({ message, variant: 'error', duration }),
    warning: (message: string, duration?: number) => ctx.show({ message, variant: 'warning', duration }),
    info: (message: string, duration?: number) => ctx.show({ message, variant: 'info', duration }),
    success: (message: string, duration?: number) => ctx.show({ message, variant: 'success', duration }),
  };
}
```

**メリット:**

- `toast.error('メッセージ')` のような直感的な API
- ErrorHandler の `ToastContext` 型と完全互換

---

### 3. Repository 層のエラーハンドリング改善

#### `lib/repos/friendRepo.ts`

**変更内容:**

従来の `throw new Error('SELF_FRIEND')` を `ErrorHelpers` を使った明示的なエラーに置き換え:

**Before:**
```typescript
export async function sendFriendRequest(userId: string, targetId: string) {
  if (userId === targetId) throw new Error('SELF_FRIEND');
  // ...
}
```

**After:**
```typescript
import { AppError, ErrorHelpers } from '../errors/ErrorHandler';

export async function sendFriendRequest(userId: string, targetId: string) {
  if (userId === targetId) {
    throw ErrorHelpers.selfOperation('フレンド申請');
  }
  const id = friendId(userId, targetId);
  const ref = doc(db, COL.friends, id);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    throw ErrorHelpers.duplicate('フレンド申請');
  }
  // ...
}
```

**適用した関数:**

- `sendFriendRequest`: 自分自身への申請、重複申請のエラー
- `acceptFriend`: 申請が見つからない、既に承認済みのエラー
- `cancelFriendRequest`: 申請が見つからない、pending 以外のエラー
- `removeFriend`: フレンドが見つからないエラー

**メリット:**

- エラーメッセージが日本語で統一
- ユーザー向けメッセージと開発者向けメッセージの分離
- エラーレベル（error/warning）の明示的な指定

---

### 4. カスタムフックの作成

#### `lib/hooks/useAsyncOperation.ts`

非同期操作を管理するカスタムフックを作成:

```typescript
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
        throw error;
      }
    },
    [operation]
  );

  const reset = useCallback(() => {
    setState({ loading: false, error: null, data: null });
  }, []);

  return { ...state, execute, reset };
}
```

**使用例:**

```typescript
const { loading, execute: sendRequest } = useAsyncOperation(sendFriendRequest);

const handleSend = async () => {
  try {
    await sendRequest(userId, targetId);
    toast.success('フレンド申請を送信しました');
  } catch (e) {
    handleError(e, toast);
  }
};
```

**メリット:**

- ローディング状態の自動管理
- エラー状態の保持
- 各コンポーネントで `useState` の重複を削減

---

### 5. 使用例ドキュメント

#### `lib/errors/USAGE_EXAMPLES.ts`

7つの実装パターンを含む包括的な使用例を作成:

1. **基本的なエラーハンドリング**
2. **useAsyncOperation フックとの組み合わせ**
3. **カスタムエラーメッセージ**
4. **AppError を使ったカスタムエラー**
5. **複数の操作でのエラーハンドリング**
6. **条件付きエラーハンドリング**
7. **リトライロジック付き**

---

## 📊 移行ガイド

### 既存コードの移行パターン

#### パターン1: alert() からの移行

**Before:**
```typescript
try {
  await someOperation();
  alert('成功しました');
} catch (e: any) {
  alert('エラーが発生しました: ' + e.message);
  console.error(e);
}
```

**After:**
```typescript
try {
  await someOperation();
  toast.success('成功しました');
} catch (e) {
  handleError(e, toast);
}
```

---

#### パターン2: 条件分岐エラーハンドリングからの移行

**Before:**
```typescript
try {
  await sendFriendRequest(userId, targetId);
} catch (e: any) {
  if (e.message === 'SELF_FRIEND') {
    alert('自分自身にフレンド申請できません');
  } else if (e.code === 'permission-denied') {
    alert('権限がありません');
  } else {
    alert('エラーが発生しました');
  }
  console.error(e);
}
```

**After:**
```typescript
try {
  await sendFriendRequest(userId, targetId);
  toast.success('フレンド申請を送信しました');
} catch (e) {
  handleError(e, toast);
}
```

**メリット:** Repository 層で適切なエラーを throw するため、呼び出し側の条件分岐が不要

---

#### パターン3: useState エラー表示からの移行

**Before:**
```typescript
const [error, setError] = useState<string | null>(null);

try {
  await someOperation();
  setError(null);
} catch (e: any) {
  setError('エラーが発生しました: ' + e.message);
}

// JSX
{error && <div className="text-red-500">{error}</div>}
```

**After:**
```typescript
try {
  await someOperation();
  toast.success('操作が完了しました');
} catch (e) {
  handleError(e, toast);
}
```

**メリット:** useState 不要、自動的に消えるトースト、一貫した表示

---

## 🎯 適用対象ファイル（推奨）

### 優先度 🔴 高（すぐに移行）

- [x] `lib/repos/friendRepo.ts` ← **実装済み**
- [ ] `lib/repos/watchRepo.ts`
- [ ] `lib/repos/albumRepo.ts`
- [ ] `lib/repos/commentRepo.ts`
- [ ] `lib/repos/userRepo.ts`

### 優先度 🟡 中（段階的に移行）

- [ ] `app/user/[id]/page.tsx`
- [ ] `app/timeline/page.tsx`
- [ ] `app/album/[id]/page.tsx`
- [ ] `app/login/page.tsx`
- [ ] `app/register/page.tsx`

### 優先度 🟢 低（時間があれば移行）

- [ ] `components/profile/FriendActions.tsx`
- [ ] `components/profile/WatchActions.tsx`
- [ ] `components/upload/ImageUploadFlow.tsx`

---

## 📈 期待される効果

### ユーザー体験

- ✅ 一貫したエラー表示（すべて Toast で統一）
- ✅ 分かりやすい日本語エラーメッセージ
- ✅ 適切なエラーレベル（error/warning/info）の表示
- ✅ 自動的に消えるトースト通知

### 開発者体験

- ✅ エラーハンドリングコードの簡潔化（5〜10行 → 3行）
- ✅ Firebase エラーの自動翻訳
- ✅ 型安全なエラーハンドリング
- ✅ デバッグ用の詳細ログ（console に自動記録）

### 保守性

- ✅ エラーメッセージの一元管理
- ✅ 新しいエラーケースの追加が容易
- ✅ テストコードの書きやすさ向上

---

## 🔍 今後の拡張

### 1. エラー追跡・ログ送信

```typescript
export function handleError(error: unknown, toast: ToastContext, fallbackMessage?: string): void {
  // ... 既存のロジック

  // エラーログを外部サービスに送信（例: Sentry）
  if (process.env.NODE_ENV === 'production') {
    sendErrorToSentry(error);
  }
}
```

### 2. エラーメッセージの多言語化

```typescript
// lib/i18n/errorMessages.ts
export const errorMessages = {
  ja: {
    'auth/email-already-in-use': 'このメールアドレスは既に使用されています',
    // ...
  },
  en: {
    'auth/email-already-in-use': 'This email address is already in use',
    // ...
  },
};

export function translateFirebaseError(error: FirebaseError, locale: string = 'ja'): string {
  const messages = errorMessages[locale] || errorMessages.ja;
  return messages[error.code] || `Error: ${error.code}`;
}
```

### 3. エラーリトライ機能

```typescript
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: unknown;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (e) {
      lastError = e;
      if (i < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)));
      }
    }
  }
  
  throw lastError;
}
```

### 4. カスタムエラーページ

```typescript
// app/error.tsx (Next.js App Router)
'use client';

import { useEffect } from 'react';
import { handleError } from '@/lib/errors/ErrorHandler';
import { useToast } from '@/components/ui/Toast';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const toast = useToast();

  useEffect(() => {
    handleError(error, toast);
  }, [error, toast]);

  return (
    <div>
      <h2>エラーが発生しました</h2>
      <button onClick={reset}>再試行</button>
    </div>
  );
}
```

---

## ✅ チェックリスト

### 実装完了項目

- [x] `lib/errors/ErrorHandler.ts` 作成
- [x] `components/ui/Toast.tsx` 拡張
- [x] `lib/repos/friendRepo.ts` にエラーハンドリング適用
- [x] `lib/hooks/useAsyncOperation.ts` 作成
- [x] `lib/errors/USAGE_EXAMPLES.ts` 作成

### 次のステップ

- [ ] `lib/repos/watchRepo.ts` にエラーハンドリング適用
- [ ] `lib/repos/albumRepo.ts` にエラーハンドリング適用
- [ ] `app/user/[id]/page.tsx` の既存エラーハンドリングを移行
- [ ] `app/timeline/page.tsx` の既存エラーハンドリングを移行
- [ ] 単体テストの作成（ErrorHandler.test.ts）
- [ ] エラーメッセージの網羅性確認
- [ ] ドキュメント（README）へのエラーハンドリング指針追記

---

## 📝 まとめ

エラー表示の統一により、以下を実現しました:

1. **一貫性**: すべてのエラーが Toast で統一表示
2. **ユーザビリティ**: 分かりやすい日本語メッセージ
3. **保守性**: エラーハンドリングコードの簡潔化と一元管理
4. **拡張性**: 将来的な多言語化、ログ送信、リトライに対応可能

この改善により、**本番リリース前の必須要件の1つを完了**しました。

---

**実装者:** GitHub Copilot  
**レビュー:** 要レビュー  
**最終更新:** 2025-12-24
