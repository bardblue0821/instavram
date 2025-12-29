"use client";
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '../lib/firebase';
import { ensureUser } from '../lib/authUser';
import { Button } from './ui/Button';
import { isHandleTaken } from '../lib/repos/userRepo';
import { getHandleBlockReason, getDisplayNameBlockReason } from '../lib/constants/userFilters';
import { GoogleAuthProvider, signInWithPopup, createUserWithEmailAndPassword, signInWithEmailAndPassword, onAuthStateChanged, sendEmailVerification, signOut } from 'firebase/auth';
import { signInWithTwitter, handleTwitterRedirectResult, translateTwitterAuthError } from '../lib/auth/twitterAuth';

function hasNonAscii(input: string): boolean {
  // Treat any non-ASCII character (e.g. 全角英数/記号、日本語、絵文字) as invalid for login password input.
  // ASCII printable range: 0x20 (space) .. 0x7E (~)
  return /[^\x20-\x7E]/.test(input);
}

function mapAuthError(code: string): string {
  switch (code) {
    case 'auth/invalid-email':
      return 'メールアドレス形式が正しくありません';
    case 'auth/weak-password':
      return 'パスワードは6文字以上にしてください';
    case 'auth/popup-closed-by-user':
      return 'ポップアップが閉じられました';
    case 'auth/email-already-in-use':
    case 'auth/user-not-found':
    case 'auth/wrong-password':
    case 'auth/invalid-login-credentials':
    case 'auth/invalid-credential':
    case 'auth/too-many-requests':
      return '認証に失敗しました';
    default:
      return '認証に失敗しました';
  }
}

export default function AuthForm() {
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
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [handleStatus, setHandleStatus] = useState<'idle'|'checking'|'ok'|'taken'|'invalid'>('idle');
  const [handleError, setHandleError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      if (u) router.replace('/timeline');
    });
    return () => unsub();
  }, [router]);

  // Twitter リダイレクト認証の結果を処理
  useEffect(() => {
    let mounted = true;
    
    async function checkRedirectResult() {
      try {
        const result = await handleTwitterRedirectResult();
        
        if (result && mounted) {
          setInfo('X (Twitter) ログイン成功');
          router.push('/timeline');
        }
      } catch (err: any) {
        if (mounted) {
          setError(translateTwitterAuthError(err));
        }
      }
    }
    
    checkRedirectResult();
    
    return () => {
      mounted = false;
    };
  }, [router]);

  function evaluateStrength(pw: string){
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
    if (/\d/.test(pw)) score++;
    if (/[^a-zA-Z0-9]/.test(pw)) score++;
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

  function basicHandleValid(h:string){ return /^[a-z0-9_]{3,20}$/i.test(h); }

  function validate(): boolean {
    if (!/@.+\./.test(email )) { setError('メールアドレスが不正です'); return false; }
    if (mode === 'login' && hasNonAscii(password)) {
      setError('パスワードは半角で入力してください');
      return false;
    }
    if (password.length < 6) { setError('パスワードは6文字以上にしてください'); return false; }
    if (mode === 'register') {
      if (!displayName.trim()) { setError('ユーザー名を入力してください'); return false; }
      const dnReason = getDisplayNameBlockReason(displayName);
      if (dnReason) { setError(dnReason); return false; }
      if (!basicHandleValid(handle)) { setError('ユーザーIDは英数字と_で3〜20文字'); return false; }
      if (handleStatus === 'taken') { setError('このユーザーIDは既に使用されています'); return false; }
      const hReason = getHandleBlockReason(handle);
      if (hReason) { setError(hReason); return false; }
      if (confirmPassword !== password) { setError('確認用パスワードが一致しません'); return false; }
    }
    return true;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); setError(null); setInfo(null);
    if (!validate()) return; setLoading(true);
    try {
      if (mode === 'register') {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await ensureUser(cred.user.uid, displayName, cred.user.email, handle);
        await sendEmailVerification(cred.user);
        await signOut(auth);
        setInfo('仮登録です。メール内のリンクをクリックして本登録を完了してください。');
      } else {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        await ensureUser(cred.user.uid, cred.user.displayName, cred.user.email);
        setInfo('ログイン成功');
        router.push('/timeline');
      }
    } catch (err: any) {
      setError(mapAuthError(err.code || 'unknown'));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    setError(null); setInfo(null); setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await ensureUser(cred.user.uid, cred.user.displayName, cred.user.email);
      setInfo('Google ログイン成功');
      router.push('/timeline');
    } catch (err: any) {
      setError(mapAuthError(err.code || 'unknown'));
    } finally {
      setLoading(false);
    }
  }

  async function handleTwitter() {
    setError(null); setInfo(null); setLoading(true);
    try {
      const result = await signInWithTwitter();
      
      // ポップアップ成功の場合
      if (result) {
        setInfo('X (Twitter) ログイン成功');
        router.push('/timeline');
      } else {
        // リダイレクトにフォールバックした場合
        setInfo('認証ページにリダイレクトしています...');
      }
    } catch (err: any) {
      setError(translateTwitterAuthError(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(()=>{
    if (mode !== 'register') return;
    setHandleError(null);
    if (!handle) { setHandleStatus('idle'); return; }
    if (!basicHandleValid(handle)) { setHandleStatus('invalid'); setHandleError('形式: 英数字と_ 3〜20文字'); return; }
    const blockedReason = getHandleBlockReason(handle);
    if (blockedReason) { setHandleStatus('invalid'); setHandleError(blockedReason); return; }
    let active = true;
    setHandleStatus('checking');
    const t = setTimeout(async ()=>{
      try {
        const taken = await isHandleTaken(handle);
        if (!active) return;
        setHandleStatus(taken ? 'taken':'ok');
        setHandleError(taken ? '既に使われています':'');
      } catch (e:any){
        if (!active) return;
        setHandleStatus('invalid');
        setHandleError('チェック失敗');
      }
    }, 450);
    return ()=>{ active=false; clearTimeout(t); };
  }, [handle, mode]);

  return (
    <div className="w-full max-w-md mx-auto p-6">
      <h1 className="text-3xl font-bold my-6 text-teal-500 text-center">Virtualbum</h1>
      <div className="flex gap-2 mb-4">
        <Button
          type="button"
          size="sm"
          variant={mode === 'login' ? 'accent' : 'ghost'}
          onClick={() => { setMode('login'); setConfirmPassword(''); setError(null); setDisplayName(''); setHandle(''); setHandleStatus('idle'); setHandleError(null); }}
          disabled={loading}
        >
          ログイン
        </Button>
        <Button
          type="button"
          size="sm"
          variant={mode === 'register' ? 'accent' : 'ghost'}
          onClick={() => { setMode('register'); setConfirmPassword(''); setError(null); setDisplayName(''); setHandle(''); setHandleStatus('idle'); setHandleError(null); }}
          disabled={loading}
        >
          新規登録
        </Button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4" aria-live="polite">
        {mode==='register' && (
          <div>
            <label className="block text-sm font-medium mb-1">ユーザー名 (表示名 / 重複可)</label>
            <input type="text" value={displayName} onChange={e=>setDisplayName(e.target.value.slice(0,40))} className="input-underline" disabled={loading} placeholder="例: VR太郎" />
            {getDisplayNameBlockReason(displayName) && <p className="text-xs text-red-600 mt-1" role="alert">{getDisplayNameBlockReason(displayName)}</p>}
          </div>
        )}
        {mode==='register' && (
          <div>
            <label className="block text-sm font-medium mb-1">ユーザーID (@無し / 一意)</label>
            <div className="flex items-center gap-2">
              <input type="text" value={handle} onChange={e=>setHandle(e.target.value.toLowerCase())} className={`input-underline flex-1 ${(handleStatus==='taken'||handleStatus==='invalid')?'error':''}`} disabled={loading} placeholder="例: taro_vr" aria-invalid={handleStatus==='taken'||handleStatus==='invalid'} />
              <span className="text-xs fg-subtle w-16">
                {handleStatus==='idle' && ''}
                {handleStatus==='checking' && '確認中'}
                {handleStatus==='ok' && '利用可'}
                {handleStatus==='taken' && '使用不可'}
                {handleStatus==='invalid' && '形式'}
              </span>
            </div>
            {handleError && <p className="text-xs text-red-600 mt-1" role="alert">{handleError}</p>}
          </div>
        )}
        <div>
          <label className="block text-sm font-medium mb-1">メールアドレス</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="input-underline" required autoComplete="email" disabled={loading} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">パスワード</label>
          <div className="flex items-center gap-2">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className={`input-underline flex-1 ${(mode === 'login' && hasNonAscii(password)) ? 'error' : ''}`}
              required
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              disabled={loading}
              aria-invalid={mode === 'login' && hasNonAscii(password)}
            />
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setShowPwd((s) => !s)}
              className="border-0 bg-transparent hover:bg-transparent px-0! py-0! text-xs link-accent w-16"
              aria-label="パスワード表示切替"
            >
              {showPwd ? '隠す' : '表示'}
            </Button>
          </div>
          {mode === 'login' && hasNonAscii(password) && (
            <p className="text-xs text-red-600 mt-1" role="alert">パスワードは半角で入力してください</p>
          )}
          {mode === 'login' && (
            <div className="mt-2">
              <Link href="/forgot-password" className="text-xs link-accent">
                パスワードを忘れた方
              </Link>
            </div>
          )}
          {mode==='register' && (
            <div className="mt-2 pw-strength-wrapper" aria-live="polite">
              <div className={`pw-strength-bar ${pwdStrength.cls}`}><span style={{width: pwdStrength.percent+'%'}}></span> </div>
              {pwdStrength.label && <p className="pw-strength-label">強度: {pwdStrength.label}</p>}
            </div>
          )}
        </div>
        {mode === 'register' && (
          <div>
            <label className="block text-sm font-medium mb-1">パスワード（確認）</label>
            <div className="flex items-center gap-2">
              <input type={showConfirm ? 'text':'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={`input-underline flex-1 ${mismatch ? 'error':''}`} required autoComplete="new-password" disabled={loading} aria-invalid={!!mismatch} />
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setShowConfirm((s) => !s)}
                className="border-0 bg-transparent hover:bg-transparent px-0! py-0! text-xs link-accent w-16"
                aria-label="確認パスワード表示切替"
              >
                {showConfirm ? '隠す' : '表示'}
              </Button>
            </div>
            {mismatch && <p className="text-xs text-red-600 mt-1" role="alert">{mismatch}</p>}
          </div>
        )}
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {info && (
          <div className="text-xs fg-muted surface-alt border border-base rounded p-2">
            <p>{info}</p>
          </div>
        )}
        <Button type="submit" variant="accent" fullWidth isLoading={loading} disabled={loading}>
          {loading ? '処理中...' : (mode === 'login' ? 'ログイン' : '登録')}
        </Button>
      </form>
      <div className="mt-6 space-y-2">
        <Button type="button" variant="ghost" fullWidth isLoading={loading} onClick={handleGoogle} disabled={loading}>
          {loading ? '...' : 'Google で続行'}
        </Button>
        <Button type="button" variant="ghost" fullWidth isLoading={loading} onClick={handleTwitter} disabled={loading}>
          {loading ? '...' : 'X で続行'}
        </Button>
      </div>
    </div>
  );
}
