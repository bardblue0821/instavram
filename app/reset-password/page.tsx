"use client";
import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { Button } from '@/components/ui/Button';

function ResetPasswordContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const oobCode = searchParams.get('oobCode');
  
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [email, setEmail] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [codeInvalid, setCodeInvalid] = useState(false);

  // oobCodeの検証
  useEffect(() => {
    if (!oobCode) {
      setCodeInvalid(true);
      setVerifying(false);
      return;
    }

    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        setEmail(email);
        setVerifying(false);
      })
      .catch((err) => {
        console.error('[reset-password] Code verification failed:', err);
        setCodeInvalid(true);
        setVerifying(false);
      });
  }, [oobCode]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!oobCode) {
      setError('無効なリセットコードです');
      return;
    }

    if (password.length < 6) {
      setError('パスワードは6文字以上で入力してください');
      return;
    }

    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await confirmPasswordReset(auth, oobCode, password);
      setSuccess(true);
      
      // 3秒後にログインページへリダイレクト
      setTimeout(() => {
        router.push('/login');
      }, 3000);

    } catch (err: any) {
      console.error('[reset-password] Reset failed:', err);
      
      if (err.code === 'auth/expired-action-code') {
        setError('リセットリンクの有効期限が切れています。再度リセットを申請してください。');
      } else if (err.code === 'auth/invalid-action-code') {
        setError('無効なリセットコードです。リンクが正しいか確認してください。');
      } else if (err.code === 'auth/weak-password') {
        setError('パスワードが弱すぎます。より強力なパスワードを設定してください。');
      } else {
        setError('パスワードの再設定に失敗しました。もう一度お試しください。');
      }
    } finally {
      setLoading(false);
    }
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page px-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-sm fg-secondary">リセットコードを検証しています...</p>
        </div>
      </div>
    );
  }

  if (codeInvalid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-page px-4">
        <div className="w-full max-w-md">
          <div className="bg-surface rounded-lg shadow-md p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold fg-primary mb-2">無効なリンクです</h1>
            </div>

            <div className="space-y-4 text-sm fg-secondary">
              <p>
                このパスワードリセットリンクは無効か、期限切れです。
              </p>
              <p>
                パスワードをリセットするには、新しいリセットリンクを申請してください。
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-3">
              <Link href="/forgot-password">
                <Button variant="accent" fullWidth>
                  パスワードリセットを申請
                </Button>
              </Link>
              <Link 
                href="/login"
                className="w-full text-center text-sm link-accent hover:underline"
              >
                ログインページに戻る
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
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
              <h1 className="text-2xl font-bold fg-primary mb-2">パスワードを変更しました</h1>
            </div>

            <div className="space-y-4 text-sm fg-secondary text-center">
              <p>
                パスワードの再設定が完了しました。
              </p>
              <p>
                新しいパスワードでログインしてください。
              </p>
              <p className="text-xs fg-subtle">
                3秒後にログインページへ自動的にリダイレクトします...
              </p>
            </div>

            <div className="mt-6">
              <Link href="/login">
                <Button variant="accent" fullWidth>
                  ログインページへ
                </Button>
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
            <h1 className="text-2xl font-bold fg-primary">新しいパスワードを設定</h1>
            {email && (
              <p className="text-sm fg-secondary mt-2">
                {email}
              </p>
            )}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium fg-primary mb-1">
                新しいパスワード
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6文字以上"
                required
                minLength={6}
                disabled={loading}
                className="w-full px-3 py-2 border border-line rounded-md bg-background fg-primary placeholder-subtle focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium fg-primary mb-1">
                パスワード（確認）
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="もう一度入力"
                required
                minLength={6}
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
              パスワードを変更
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Link 
              href="/login"
              className="text-sm link-accent hover:underline"
            >
              ログインページに戻る
            </Link>
          </div>

          <div className="mt-8 pt-6 border-t border-line">
            <div className="text-xs fg-subtle space-y-2">
              <p>
                <strong>パスワードのヒント:</strong>
              </p>
              <ul className="list-disc list-inside space-y-1 ml-2">
                <li>6文字以上で設定してください</li>
                <li>大文字・小文字・数字・記号を組み合わせると安全です</li>
                <li>他のサービスと同じパスワードは使用しないでください</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-page px-4">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-sm fg-secondary">読み込み中...</p>
        </div>
      </div>
    }>
      <ResetPasswordContent />
    </Suspense>
  );
}
