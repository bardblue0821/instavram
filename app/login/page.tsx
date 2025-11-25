"use client";
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '../../lib/firebase';
import { ensureUser } from '../../lib/authUser';
import { GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged } from 'firebase/auth';

// セキュリティ方針: アカウント存在可否を推測されないため、認証失敗は統一メッセージにまとめる。
// ただし UI/UX 維持のためフォーマット不正・弱いパスワードなど入力検証系は区別。
function mapAuthError(code: string): string {
  switch (code) {
    // 入力バリデーション系は詳細を返す
    case 'auth/invalid-email':
      return 'メールアドレス形式が正しくありません';
    case 'auth/weak-password':
      return 'パスワードは6文字以上にしてください';
    case 'auth/popup-closed-by-user':
      return 'ポップアップが閉じられました';

    // 存在可否を悟らせる恐れのあるコード群は統一
    case 'auth/email-already-in-use':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-login-credentials':
    case 'auth/invalid-credential':
    case 'auth/too-many-requests': // レート制限も詳細非表示
      return '認証に失敗しました';
    default:
      return '認証に失敗しました';
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdStrength, setPwdStrength] = useState<{score:number; label:string; percent:number; cls:string}>({score:0,label:'',percent:0,cls:''});
  const [mismatch, setMismatch] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) {
        router.replace('/');
      }
    });
    return () => unsub();
  }, [router]);

  function evaluateStrength(pw: string){
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
    // map
    const levels = [
      { min:0, label:'弱い', cls:'pw-strength-weak', percent:20 },
      { min:2, label:'普通', cls:'pw-strength-fair', percent:40 },
      { min:3, label:'良い', cls:'pw-strength-good', percent:70 },
      { min:4, label:'強い', cls:'pw-strength-strong', percent:100 }
    ];
    let picked = levels[0];
    for(const l of levels){ if(score >= l.min) picked = l; }
    return { score, label: pw ? picked.label : '', percent: pw ? picked.percent : 0, cls: pw ? picked.cls : '' };
  }

  useEffect(()=>{ setPwdStrength(evaluateStrength(password)); }, [password]);
  useEffect(()=>{ if(mode==='register'){ setMismatch(confirmPassword && password !== confirmPassword ? '確認用パスワードが一致しません' : null); } else { setMismatch(null); } }, [confirmPassword, password, mode]);

  function validate(): boolean {
    if (!/@.+\./.test(email)) {
      setError('メールアドレスが不正です');
      return false;
    }
    if (password.length < 6) {
      setError('パスワードは6文字以上にしてください');
      return false;
    }
    if (mode === 'register') {
      if (confirmPassword !== password) {
        setError('確認用パスワードが一致しません');
        return false;
      }
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
    <div className="fixed inset-0 flex items-center justify-center overflow-hidden">
      <div className="max-w-md w-full mx-auto p-6">
      <h1 className="text-4xl font-bold my-8 text-teal-500 text-center">instaVRam</h1>
      <div className="flex gap-2 mb-4">
        <button
          className={`${mode === 'login' ? 'btn-accent' : 'px-3 py-1 rounded border'} transition-colors`}
          onClick={() => { setMode('login'); setConfirmPassword(''); setError(null); }}
          disabled={loading}
        >ログイン</button>
        <button
          className={`${mode === 'register' ? 'btn-accent' : 'px-3 py-1 rounded border'} transition-colors`}
          onClick={() => { setMode('register'); setConfirmPassword(''); setError(null); }}
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
          className="input-underline"
          required
          autoComplete="email"
          disabled={loading}
        />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">パスワード</label>
          <div className="flex items-center gap-2">
            <input
              type={showPwd ? 'text':'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="input-underline flex-1"
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              disabled={loading}
            />
            <button type="button" onClick={()=>setShowPwd(s=>!s)} className="text-xs link-accent w-16" aria-label="パスワード表示切替">{showPwd?'隠す':'表示'}</button>
          </div>
          {mode==='register' && (
            <div className="mt-2 pw-strength-wrapper" aria-live="polite">
              <div className={`pw-strength-bar ${pwdStrength.cls}`}> <span style={{width: pwdStrength.percent+'%'}}></span> </div>
              {pwdStrength.label && <p className="pw-strength-label">強度: {pwdStrength.label}</p>}
            </div>
          )}
        </div>
        {mode === 'register' && (
          <div>
            <label className="block text-sm font-medium mb-1">パスワード（確認）</label>
            <div className="flex items-center gap-2">
              <input
                type={showConfirm ? 'text':'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className={`input-underline flex-1 ${mismatch ? 'error':''}`}
                required
                autoComplete="new-password"
                disabled={loading}
                aria-invalid={!!mismatch}
              />
              <button type="button" onClick={()=>setShowConfirm(s=>!s)} className="text-xs link-accent w-16" aria-label="確認パスワード表示切替">{showConfirm?'隠す':'表示'}</button>
            </div>
            {mismatch && <p className="text-xs text-red-600 mt-1" role="alert">{mismatch}</p>}
          </div>
        )}
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
      </div>
      </div>
    </div>
  );
}
