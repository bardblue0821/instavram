"use client";
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!email || !email.includes('@')) {
      setError('有効なメールアドレスを入力してください');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Firebase Authentication でパスワードリセットメールを直接送信
      const actionCodeSettings = {
        url: `${window.location.origin}/login`,
        handleCodeInApp: false,
      };

      await sendPasswordResetEmail(auth, email.trim(), actionCodeSettings);
      
      console.log('[forgot-password] Reset email sent', { 
        email: email.trim(),
        timestamp: new Date().toISOString()
      });

      // 成功メッセージを表示
      setSent(true);

    } catch (err: any) {
      console.error('[forgot-password] error:', err);
      
      // Firebase エラーコードに応じたメッセージ
      if (err.code === 'auth/user-not-found') {
        // セキュリティ: ユーザーが存在しない場合も成功メッセージを表示
        setSent(true);
      } else if (err.code === 'auth/invalid-email') {
        setError('有効なメールアドレスを入力してください');
      } else if (err.code === 'auth/too-many-requests') {
        setError('リクエストが多すぎます。しばらくしてから再試行してください。');
      } else {
        setError('エラーが発生しました。しばらくしてから再試行してください。');
      }
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page px-4">
        <div className="w-full max-w-md">
          <div className="bg-surface rounded-lg shadow-md p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold fg-primary mb-2">メールを送信しました</h1>
            </div>

            <div className="space-y-4 text-sm fg-secondary">
              <p>
                パスワード再設定の案内を送信しました。
              </p>
              <div className="bg-blue-50 border border-blue-200 rounded p-3">
                <p className="text-sm text-blue-800">
                  <strong>外部認証をご利用の場合</strong><br />
                  このメールアドレスが Google などの外部認証専用の場合は、パスワードの再設定は不要です。
                  各プロバイダ（例: Google）の復旧手順をご利用ください。
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-center">
              <Link 
                href="/login"
                className="text-sm link-accent hover:underline"
              >
                ログインページに戻る
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-page px-4">
      <div className="w-full max-w-md">
        <div className="bg-surface rounded-lg shadow-md p-8">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold fg-primary">パスワードを忘れた方</h1>
            <p className="text-sm fg-secondary mt-2">
              登録されているメールアドレスを入力してください。
            </p>
            <p className="text-sm fg-secondary mt-2">
              パスワード再設定の案内を送信します。
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium fg-primary mb-1">
                メールアドレス
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                disabled={loading}
                className="w-full px-3 py-2 border border-line rounded-md bg-background fg-primary placeholder-subtle focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              variant="accent"
              fullWidth
              disabled={loading}
              isLoading={loading}
            >
              {loading ? '送信中...' : '再設定メールを送信'}
            </Button>
          </form>

          <div className="mt-6 text-center space-y-2">
            <Link 
              href="/login"
              className="block text-sm link-accent hover:underline"
            >
              ログインページに戻る
            </Link>
            <Link 
              href="/register"
              className="block text-sm fg-secondary hover:fg-primary hover:underline"
            >
              アカウントをお持ちでない方
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-line">
            <div className="text-xs fg-subtle space-y-2">
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>再設定リンクは登録されたメールアドレスにのみ送信されます</li>
                <li>リンクは一度限りで、1時間後に期限切れになります</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
