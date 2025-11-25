"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../../lib/firebase';
import { ensureUser } from '../../lib/authUser';
import { GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';

function mapAuthError(code: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return '既に登録済みのメールアドレスです';
    case 'auth/invalid-email':
      return 'メールアドレス形式が正しくありません';
    case 'auth/user-not-found':
    case 'auth/wrong-password':
      return 'メールまたはパスワードが違います';
    case 'auth/weak-password':
      return 'パスワードが弱すぎます (6文字以上推奨)';
    case 'auth/popup-closed-by-user':
      return 'ポップアップが閉じられました';
    default:
      return `エラー: ${code}`;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        router.replace('/');
      }
    });
    return () => unsub();
  }, [router]);

  function validate(): boolean {
    if (!/@.+\./.test(email)) {
      setError('メールアドレスが不正です');
      return false;
    }
    if (password.length < 6) {
      setError('パスワードは6文字以上にしてください');
      return false;
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    if (!validate()) return;
    setLoading(true);
    try {
      if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await ensureUser(cred.user.uid, cred.user.displayName, cred.user.email);
        setInfo('登録完了しました');
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await ensureUser(cred.user.uid, cred.user.displayName, cred.user.email);
        setInfo('ログイン成功');
      }
      router.push('/');
    } catch (err: any) {
      setError(mapAuthError(err.code || 'unknown'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await ensureUser(cred.user.uid, cred.user.displayName, cred.user.email);
      setInfo('Google ログイン成功');
      router.push('/');
    } catch (err: any) {
      setError(mapAuthError(err.code || 'unknown'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">{mode === 'login' ? 'ログイン' : '新規登録'}</h1>
      <div className="flex gap-2 mb-4">
        <button
          className={`${mode === 'login' ? 'btn-accent' : 'px-3 py-1 rounded border'} transition-colors`}
          onClick={() => setMode('login')}
          disabled={loading}
        >ログイン</button>
        <button
          className={`${mode === 'register' ? 'btn-accent' : 'px-3 py-1 rounded border'} transition-colors`}
          onClick={() => setMode('register')}
          disabled={loading}
        >新規登録</button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4" aria-live="polite">
        <div>
          <label className="block text-sm font-medium mb-1">メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
            autoComplete="email"
            disabled={loading}
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">パスワード</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full border rounded px-3 py-2"
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            disabled={loading}
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {info && <p className="text-green-600 text-sm">{info}</p>}
        <button
          type="submit"
          className="w-full btn-accent justify-center disabled:opacity-50"
          disabled={loading}
        >{loading ? '処理中...' : (mode === 'login' ? 'ログイン' : '登録')}</button>
      </form>
      <div className="mt-6 space-y-2">
        <button
          onClick={handleGoogle}
          className="w-full bg-gray-800 text-white rounded py-2 disabled:opacity-50"
          disabled={loading}
        >{loading ? '...' : 'Google で続行'}</button>
        <button
          onClick={() => router.push('/')}
          className="w-full border rounded py-2 link-accent"
          disabled={loading}
        >TOPへ戻る</button>
      </div>
      <p className="mt-4 text-xs text-gray-500">開発用簡易フォーム: 本番では reCAPTCHA / MFA 追加予定</p>
    </div>
  );
}
