"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuthUser } from '../../../lib/hooks/useAuthUser';
import { getUserByHandle, updateUser, isHandleTaken } from '../../../lib/repos/userRepo';
import { listAlbumsByOwner } from '../../../lib/repos/albumRepo';
import { listAlbumIdsByUploader } from '../../../lib/repos/imageRepo';
import { listCommentsByUser } from '../../../lib/repos/commentRepo';
import { getAlbum } from '../../../lib/repos/albumRepo';
import { getFriendStatus, sendFriendRequest, acceptFriend, cancelFriendRequest, removeFriend } from '../../../lib/repos/friendRepo';
import { isWatched, addWatch, removeWatch } from '../../../lib/repos/watchRepo';
import { translateError } from '../../../lib/errors';
import { useToast } from '../../../components/ui/Toast';
import { deleteAccountData } from '../../../lib/services/deleteAccount';
import { auth } from '../../../lib/firebase';
import { deleteUser, reauthenticateWithCredential, EmailAuthProvider, reauthenticateWithPopup, GoogleAuthProvider } from 'firebase/auth';

export default function ProfilePage() {
  const params = useParams();
  const handleParam = params?.id as string | undefined; // /user/{handle} のみ許可
  const { user } = useAuthUser();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [friendState, setFriendState] = useState<'none'|'sent'|'received'|'accepted'>('none');
  const [busy, setBusy] = useState(false);
  const [watching, setWatching] = useState(false);
  const [watchBusy, setWatchBusy] = useState(false);
  // プロフィール拡張データ
  const [ownAlbums, setOwnAlbums] = useState<any[] | null>(null);
  const [joinedAlbums, setJoinedAlbums] = useState<any[] | null>(null);
  const [userComments, setUserComments] = useState<any[] | null>(null);
  const [stats, setStats] = useState<{ ownCount: number; joinedCount: number; commentCount: number } | null>(null);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [extraError, setExtraError] = useState<string | null>(null);
  // 個別フィールドインライン編集用ステート
  const [editingField, setEditingField] = useState<string | null>(null); // displayName, handle, bio, vrchatUrl, link, language, gender, age, location, birthDate
  const [editingValue, setEditingValue] = useState('');
  const [editingLinkIndex, setEditingLinkIndex] = useState<number | null>(null);
  const [editingOriginalValue, setEditingOriginalValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false); // 詳細折りたたみ状態
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false); // 破棄確認モーダル
  const [skipDiscardNextBlur, setSkipDiscardNextBlur] = useState(false); // 保存ボタン押下で blur を無視
  // アカウント削除 UI
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [agreeDelete, setAgreeDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<string>("");
  const [pw, setPw] = useState('');
  const { show } = useToast();
  const authProvider = useMemo(() => (user?.providerData?.[0]?.providerId || 'password'), [user?.uid]);

  useEffect(() => {
    if (!handleParam) return;
    let active = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const p = await getUserByHandle(handleParam);
        if (active) setProfile(p);
        let watchedFlag = false;
        if (user && p && p.uid !== user.uid) {
          const forward = await getFriendStatus(user.uid, p.uid);
          const backward = await getFriendStatus(p.uid, user.uid);
          let st: 'none'|'sent'|'received'|'accepted' = 'none';
          if (forward === 'accepted' || backward === 'accepted') st = 'accepted';
          else if (forward === 'pending') st = 'sent';
          else if (backward === 'pending') st = 'received';
          if (active) setFriendState(st);
          watchedFlag = await isWatched(user.uid, p.uid);
        } else {
          if (active) setFriendState('none');
        }
        if (active) setWatching(watchedFlag);
      } catch (e:any) {
        if (active) setError(translateError(e));
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [handleParam, user]);

  // 拡張情報ロード
  useEffect(() => {
    if (!profile?.uid) return;
    let active = true;
    (async () => {
      setLoadingExtra(true); setExtraError(null);
      try {
        const own = await listAlbumsByOwner(profile.uid);
        const joinedIds = await listAlbumIdsByUploader(profile.uid);
        const filteredIds = joinedIds.filter(id => !own.some(a => a.id === id));
        const joined = await Promise.all(filteredIds.map(id => getAlbum(id)));
        const comments = await listCommentsByUser(profile.uid, 50);
        if (active) {
          setOwnAlbums(own);
          setJoinedAlbums(joined.filter(a => !!a));
          setUserComments(comments);
          setStats({
            ownCount: own.length,
            joinedCount: filteredIds.length,
            commentCount: comments.length,
          });
        }
      } catch (e:any) {
        if (active) setExtraError(translateError(e));
      } finally {
        if (active) setLoadingExtra(false);
      }
    })();
    return () => { active = false; };
  }, [profile?.uid]);

  async function doSend() {
    if (!user || !profile?.uid) return;
    setBusy(true); setError(null);
    try {
      await sendFriendRequest(user.uid, profile.uid);
      setFriendState('sent');
    } catch (e:any) { setError(translateError(e)); }
    finally { setBusy(false); }
  }
  async function doAccept() {
    if (!user || !profile?.uid) return;
    setBusy(true); setError(null);
    try {
      await acceptFriend(profile.uid, user.uid);
      setFriendState('accepted');
    } catch (e:any) { setError(translateError(e)); }
    finally { setBusy(false); }
  }
  async function doCancel() {
    if (!user || !profile?.uid) return;
    setBusy(true); setError(null);
    try {
      await cancelFriendRequest(user.uid, profile.uid);
      setFriendState('none');
    } catch (e:any) { setError(translateError(e)); }
    finally { setBusy(false); }
  }
  async function doRemove() {
    if (!user || !profile?.uid) return;
    if (!confirm('フレンドを解除しますか？')) return;
    setBusy(true); setError(null);
    try {
      await removeFriend(user.uid, profile.uid);
      setFriendState('none');
    } catch (e:any) { setError(translateError(e)); }
    finally { setBusy(false); }
  }

  async function doWatchToggle() {
    if (!user || !profile?.uid || user.uid === profile.uid) return;
    setWatchBusy(true); setError(null);
    try {
      if (watching) {
        await removeWatch(user.uid, profile.uid);
        setWatching(false);
      } else {
        await addWatch(user.uid, profile.uid);
        setWatching(true);
      }
    } catch (e:any) {
      setError(translateError(e));
    } finally {
      setWatchBusy(false);
    }
  }

  async function doDeleteAccount() {
    if (!user) return;
    try {
      setDeleting(true);
      setDeleteStep('再認証中...');
      if (authProvider === 'password') {
        const email = user.email || '';
        const cred = EmailAuthProvider.credential(email, pw);
        await reauthenticateWithCredential(user, cred);
      } else if (authProvider === 'google.com') {
        try {
          const provider = new GoogleAuthProvider();
          await reauthenticateWithPopup(user, provider);
        } catch {}
      }
      setDeleteStep('データ削除中...');
      await deleteAccountData(user.uid, (step) => setDeleteStep(`データ削除中: ${step}`));
      setDeleteStep('アカウント削除中...');
      await deleteUser(user);
      try {
        sessionStorage.setItem('app:toast', JSON.stringify({ message: 'アカウントを削除しました', variant: 'success' }));
      } catch {}
      window.location.href = '/';
    } catch (e:any) {
      const msg = translateError(e);
      setError(msg);
      try { show({ message: msg, variant: 'error' }); } catch {}
      setDeleting(false);
    }
  }

  async function reauthGoogle() {
    try {
      const provider = new GoogleAuthProvider();
      await reauthenticateWithPopup(auth.currentUser!, provider);
    } catch {}
  }

  if (loading) return <div className="p-4 text-sm text-gray-500">読み込み中...</div>;
  if (!profile) return <div className="p-4 text-sm text-gray-600">ユーザーが見つかりません (handle)</div>;

  const isMe = user && profile && user.uid === profile.uid;

  function beginEdit(field: string, current: any, linkIndex?: number) {
    if (!isMe) return;
    setSaveMsg(null);
    setEditingField(field);
    setEditingOriginalValue(current || '');
    if (field === 'link') {
      setEditingLinkIndex(linkIndex ?? 0);
      setEditingValue(current || '');
    } else if (field === 'age') {
      setEditingValue(typeof current === 'number' ? String(current) : '');
    } else {
      setEditingValue(current || '');
    }
  }

  async function commitEdit() {
    if (!editingField || !profile || !isMe) { cancelEdit(); return; }
    const raw = editingValue.trim();
    const patch: any = {};
    try {
      if (editingField === 'displayName') {
        if (!raw) throw new Error('表示名は必須');
        if (raw.length > 50) throw new Error('表示名は最大50文字');
        patch.displayName = raw;
      } else if (editingField === 'handle') {
        const h = raw.toLowerCase();
        if (!/^[a-z0-9_]{3,20}$/.test(h)) throw new Error('ハンドルは英数字と_ 3〜20文字');
        if (profile.handle !== h) {
          const taken = await isHandleTaken(h);
          if (taken) throw new Error('そのハンドルは既に使用されています');
        }
        patch.handle = h;
    } else if (editingField === 'bio') {
      // bio: URL禁止 / 不適切語禁止 / 100文字上限 / 改行除去 / 全角スペース除去 / 連続半角スペース縮約
      const banned = ['禁止語']; // 具体的な不適切語は後で拡張 (例: 'badword')
      if (/(https?:\/\/|www\.)/i.test(raw)) throw new Error('bio に URL は含められません');
      if (banned.some(w => raw.toLowerCase().includes(w))) throw new Error('不適切な語句が含まれています');
      let b = raw
        .replace(/[\r\n]+/g, ' ')
        .replace(/[\u3000]+/g, '')
        .replace(/ {2,}/g, ' ')
        .trim();
      if (b.length > 100) throw new Error('bio は最大100文字です');
      patch.bio = b || null;
      } else if (editingField === 'vrchatUrl') {
        if (raw) {
          if (!/^https?:\/\//.test(raw) || !/vrchat/i.test(raw)) throw new Error('VRChat URL 不正');
          patch.vrchatUrl = raw;
        } else patch.vrchatUrl = null;
      } else if (editingField === 'language') {
        patch.language = raw || null;
      } else if (editingField === 'gender') {
        patch.gender = raw || null;
      } else if (editingField === 'age') {
        if (raw) {
          const n = Number(raw);
          if (Number.isNaN(n) || n < 0 || n > 150) throw new Error('年齢は0〜150');
          patch.age = n;
        } else patch.age = null;
      } else if (editingField === 'location') {
        patch.location = raw || null;
      } else if (editingField === 'birthDate') {
        if (raw && !/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error('誕生日はYYYY-MM-DD');
        patch.birthDate = raw || null;
      } else if (editingField === 'link') {
        const links: string[] = (profile.links || []).slice(0,3);
        const idx = editingLinkIndex ?? 0;
        if (!raw) { links.splice(idx,1); }
        else {
          if (!/^https?:\/\//.test(raw)) throw new Error('URLはhttp/httpsのみ');
          if (idx < links.length) links[idx] = raw; else links.push(raw);
        }
        patch.links = links;
      }
    } catch (e:any) {
      setError(e.message || String(e));
      return;
    }
    setSaving(true); setError(null);
    try {
      await updateUser(profile.uid, patch);
      const updated = { ...profile, ...patch };
      setProfile(updated);
      setSaveMsg('保存しました');
      cancelEdit();
    } catch (e:any) {
      setError(translateError(e));
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditingField(null);
    setEditingValue('');
    setEditingLinkIndex(null);
    setEditingOriginalValue('');
    setShowDiscardConfirm(false);
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && editingField !== 'bio') { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); }
  }

  function handleBlur() {
    // 入力コンポーネント外へフォーカス移動した時: 保存せず離脱しようとしている
    if (!editingField) return;
    if (skipDiscardNextBlur) { setSkipDiscardNextBlur(false); return; }
    // 既にモーダルが出ている場合は何もしない
    if (!showDiscardConfirm) setShowDiscardConfirm(true);
  }

  function discardChanges() {
    // 破棄: 元値保持しているが profile は未更新なので cancelEdit で OK
    cancelEdit();
  }
  function keepEditing() {
    // 編集続行: モーダル閉じて再フォーカスは任意 (ユーザが再クリック可)
    setShowDiscardConfirm(false);
  }
  function saveFromModal() {
    commitEdit();
    setShowDiscardConfirm(false);
  }

  return (
    <div className="max-w-xl mx-auto p-4 space-y-6">
      <header className="space-y-3">
        <h1 className="text-2xl font-semibold">プロフィール</h1>
        <p className="text-sm text-gray-700">UID: {profile.uid}</p>
  <FieldText label="表示名" value={profile.displayName || ''} placeholder="（表示名未設定）" field="displayName" editingField={editingField} editingValue={editingValue} beginEdit={beginEdit} onChange={setEditingValue} onBlur={handleBlur} onKey={onKey} isMe={isMe} saving={saving} onSave={commitEdit} setSkipDiscard={setSkipDiscardNextBlur} />
  <FieldText prefix="@" label="ハンドル" value={profile.handle || ''} placeholder="（ハンドル未設定）" field="handle" editingField={editingField} editingValue={editingValue} beginEdit={beginEdit} onChange={setEditingValue} onBlur={handleBlur} onKey={onKey} isMe={isMe} saving={saving} onSave={commitEdit} setSkipDiscard={setSkipDiscardNextBlur} />
  <FieldTextarea label="自己紹介" value={profile.bio || ''} placeholder="未設定" field="bio" editingField={editingField} editingValue={editingValue} beginEdit={beginEdit} onChange={setEditingValue} onBlur={handleBlur} isMe={isMe} saving={saving} onSave={commitEdit} setSkipDiscard={setSkipDiscardNextBlur} />
        {!detailsOpen && (
          <button type="button" onClick={()=> setDetailsOpen(true)} className="text-xs text-blue-600 underline">
            詳細を表示
          </button>
        )}
        {detailsOpen && (
          <div className="space-y-2">
            <FieldText label="VRChat URL" value={profile.vrchatUrl || ''} placeholder="未設定" field="vrchatUrl" editingField={editingField} editingValue={editingValue} beginEdit={beginEdit} onChange={setEditingValue} onBlur={handleBlur} onKey={onKey} isMe={isMe} saving={saving} isLink onSave={commitEdit} setSkipDiscard={setSkipDiscardNextBlur} />
            <LinksField profile={profile} editingField={editingField} editingValue={editingValue} editingLinkIndex={editingLinkIndex} beginEdit={beginEdit} onChange={setEditingValue} onBlur={handleBlur} onKey={onKey} isMe={isMe} saving={saving} onSave={commitEdit} setSkipDiscard={setSkipDiscardNextBlur} />
            <FieldText label="言語" value={profile.language || ''} placeholder="未設定" field="language" editingField={editingField} editingValue={editingValue} beginEdit={beginEdit} onChange={setEditingValue} onBlur={handleBlur} onKey={onKey} isMe={isMe} saving={saving} onSave={commitEdit} setSkipDiscard={setSkipDiscardNextBlur} />
            <FieldText label="性別" value={profile.gender || ''} placeholder="未設定" field="gender" editingField={editingField} editingValue={editingValue} beginEdit={beginEdit} onChange={setEditingValue} onBlur={handleBlur} onKey={onKey} isMe={isMe} saving={saving} onSave={commitEdit} setSkipDiscard={setSkipDiscardNextBlur} />
            <FieldText label="年齢" value={typeof profile.age === 'number' ? String(profile.age) : ''} placeholder="未設定" field="age" editingField={editingField} editingValue={editingValue} beginEdit={beginEdit} onChange={setEditingValue} onBlur={handleBlur} onKey={onKey} isMe={isMe} saving={saving} numeric onSave={commitEdit} setSkipDiscard={setSkipDiscardNextBlur} />
            <FieldText label="場所" value={profile.location || ''} placeholder="未設定" field="location" editingField={editingField} editingValue={editingValue} beginEdit={beginEdit} onChange={setEditingValue} onBlur={handleBlur} onKey={onKey} isMe={isMe} saving={saving} onSave={commitEdit} setSkipDiscard={setSkipDiscardNextBlur} />
            <FieldText label="生年月日" value={profile.birthDate || ''} placeholder="未設定" field="birthDate" editingField={editingField} editingValue={editingValue} beginEdit={beginEdit} onChange={setEditingValue} onBlur={handleBlur} onKey={onKey} isMe={isMe} saving={saving} date onSave={commitEdit} setSkipDiscard={setSkipDiscardNextBlur} />
            <button type="button" onClick={()=> setDetailsOpen(false)} className="text-xs text-gray-600 underline">
              詳細を隠す
            </button>
          </div>
        )}
        {saveMsg && <p className="text-xs text-green-700">{saveMsg}</p>}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </header>
      {isMe && (
        <section className="space-y-2 pt-4 border-t">
          <h2 className="text-lg font-medium text-red-700">危険区域</h2>
          <p className="text-sm text-gray-700">アカウントと関連データを削除します。この操作は取り消せません。</p>
          <button type="button" onClick={()=> setShowDeleteAccount(true)} className="rounded bg-red-600 px-3 py-1.5 text-sm text-white">アカウントを削除</button>
        </section>
      )}
      {!isMe && user && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">フレンド</h2>
          {friendState === 'none' && (
            <button disabled={busy} onClick={doSend} className="btn-accent text-sm disabled:opacity-50">フレンド申請</button>
          )}
          {friendState === 'sent' && (
            <div className="flex gap-2 items-center">
              <span className="text-sm text-gray-600">申請中...</span>
              <button disabled={busy} onClick={doCancel} className="bg-gray-500 text-white text-xs px-2 py-1 rounded disabled:opacity-50">キャンセル</button>
            </div>
          )}
          {friendState === 'received' && (
            <div className="flex gap-2">
              <button disabled={busy} onClick={doAccept} className="btn-accent text-sm disabled:opacity-50">承認</button>
              <button disabled={busy} onClick={doCancel} className="rounded bg-red-600 px-3 py-1 text-sm text-white disabled:opacity-50">拒否</button>
            </div>
          )}
          {friendState === 'accepted' && (
            <div className="flex gap-3 items-center">
              <span className="text-sm text-green-700">フレンドです</span>
              <button disabled={busy} onClick={doRemove} className="rounded bg-red-600 px-2 py-1 text-xs text-white disabled:opacity-50">解除</button>
            </div>
          )}
          <div className="pt-2 border-t mt-3">
            <h3 className="text-sm font-medium mb-1">ウォッチ</h3>
            {!watching && (
              <button disabled={watchBusy} onClick={doWatchToggle} className="btn-accent text-xs disabled:opacity-50">ウォッチ</button>
            )}
            {watching && (
              <button disabled={watchBusy} onClick={doWatchToggle} className="bg-gray-600 text-white text-xs px-2 py-1 rounded disabled:opacity-50">ウォッチ解除</button>
            )}
          </div>
          {!user && <p className="text-sm text-gray-600">ログインすると操作できます</p>}
        </section>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      <section className="space-y-4 pt-4 border-t">
        <h2 className="text-lg font-medium">活動概要</h2>
        {loadingExtra && <p className="text-sm text-gray-500">読み込み中...</p>}
        {extraError && <p className="text-sm text-red-600">{extraError}</p>}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            <div className="p-3 rounded bg-gray-100">
              <p className="text-xs text-gray-600">作成アルバム</p>
              <p className="text-lg font-semibold">{stats.ownCount}</p>
            </div>
            <div className="p-3 rounded bg-gray-100">
              <p className="text-xs text-gray-600">参加アルバム</p>
              <p className="text-lg font-semibold">{stats.joinedCount}</p>
            </div>
            <div className="p-3 rounded bg-gray-100">
              <p className="text-xs text-gray-600">コメント</p>
              <p className="text-lg font-semibold">{stats.commentCount}</p>
            </div>
            {/* いいねしたアルバム数は後工程で */}
          </div>
        )}
        <div className="space-y-6 mt-4">
          <div>
            <h3 className="font-medium mb-2">作成アルバム</h3>
            {!ownAlbums && <p className="text-sm text-gray-500">-</p>}
            {ownAlbums && ownAlbums.length === 0 && <p className="text-sm text-gray-500">まだアルバムがありません</p>}
            <ul className="space-y-2">
              {ownAlbums && ownAlbums.map(a => (
                <li key={a.id} className="p-2 border rounded">
                  <a href={`/album/${a.id}`} className="link-accent text-sm font-medium">{a.title || '無題'}</a>
                  <p className="text-xs text-gray-500">{a.createdAt?.toDate?.().toLocaleString?.() || ''}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">参加アルバム</h3>
            {!joinedAlbums && <p className="text-sm text-gray-500">-</p>}
            {joinedAlbums && joinedAlbums.length === 0 && <p className="text-sm text-gray-500">参加アルバムはまだありません</p>}
            <ul className="space-y-2">
              {joinedAlbums && joinedAlbums.map((a: any, i: number) => (
                <li key={i} className="p-2 border rounded">
                  <a href={`/album/${a.id}`} className="link-accent text-sm font-medium">{a.title || '無題'}</a>
                  <p className="text-xs text-gray-500">{a.createdAt?.toDate?.().toLocaleString?.() || ''}</p>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="font-medium mb-2">投稿コメント (最大50件)</h3>
            {!userComments && <p className="text-sm text-gray-500">-</p>}
            {userComments && userComments.length === 0 && <p className="text-sm text-gray-500">コメントはまだありません</p>}
            <ul className="space-y-2">
              {userComments && userComments.map(c => (
                <li key={c.id} className="p-2 border rounded text-sm">
                  <p className="whitespace-pre-line">{c.body}</p>
                  <a href={`/album/${c.albumId}`} className="text-xs link-accent">アルバムへ</a>
                  <p className="text-[10px] text-gray-500">{c.createdAt?.toDate?.().toLocaleString?.() || ''}</p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>
      {showDeleteAccount && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-4 w-96 space-y-3">
            <h3 className="text-sm font-semibold text-red-700">アカウント削除の確認</h3>
            <p className="text-xs text-gray-700">この操作は元に戻せません。作成したアルバム/コメント/いいね/フレンド/ウォッチは削除されます（通知は残る場合があります）。</p>
            <label className="flex items-center gap-2 text-xs text-gray-700">
              <input type="checkbox" checked={agreeDelete} onChange={e=> setAgreeDelete(e.target.checked)} />
              理解しました
            </label>
            {authProvider === 'password' && (
              <div>
                <label className="block text-xs text-gray-700 mb-1">パスワード（再認証）</label>
                <input type="password" value={pw} onChange={e=> setPw(e.target.value)} className="w-full border-b-2 border-blue-500 bg-transparent p-1 text-sm focus:outline-none" placeholder="現在のパスワード" />
              </div>
            )}
            {deleting && (
              <p className="text-xs text-gray-600">処理中: {deleteStep || '...'}</p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" className="px-2 py-1 text-xs rounded bg-gray-200" disabled={deleting} onClick={()=> setShowDeleteAccount(false)}>キャンセル</button>
              {authProvider === 'google.com' && (
                <button type="button" className="px-2 py-1 text-xs rounded bg-gray-600 text-white" disabled={deleting} onClick={reauthGoogle}>Googleで再認証</button>
              )}
              <button type="button" className="px-2 py-1 text-xs rounded bg-red-600 text-white disabled:opacity-50" disabled={!agreeDelete || deleting || (authProvider==='password' && !pw)} onClick={doDeleteAccount}>削除</button>
            </div>
          </div>
        </div>
      )}
      {showDiscardConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded shadow-lg p-4 w-80 space-y-4">
            <h3 className="text-sm font-semibold">変更を破棄しますか？</h3>
            <p className="text-xs text-gray-600">保存せずに編集を終了すると内容は元に戻ります。保存しますか、それとも破棄しますか？</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="px-2 py-1 text-xs rounded bg-gray-200" onClick={keepEditing}>編集を続ける</button>
              <button type="button" className="px-2 py-1 text-xs rounded bg-blue-600 text-white" onClick={saveFromModal}>保存</button>
              <button type="button" className="px-2 py-1 text-xs rounded bg-red-600 text-white" onClick={discardChanges}>破棄</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 共通フィールド型
interface CommonFieldProps {
  label: string;
  value: string;
  placeholder: string;
  field: string;
  editingField: string | null;
  editingValue: string;
  beginEdit: (f:string, cur:string)=>void;
  onChange: (v:string)=>void;
  onBlur: ()=>void;
  onKey?: (e:React.KeyboardEvent)=>void;
  isMe: boolean;
  saving: boolean;
  prefix?: string;
  isLink?: boolean;
  numeric?: boolean;
  date?: boolean;
  onSave: ()=>void;
  setSkipDiscard: (v:boolean)=>void;
}

function FieldText(p: CommonFieldProps) {
  const { label, value, placeholder, field, editingField, editingValue, beginEdit, onChange, onBlur, onKey, isMe, saving, prefix, isLink, numeric, date, onSave, setSkipDiscard } = p;
  const active = editingField === field;
  if (active) return (
    <div className="text-sm space-y-1">
      <label className="text-xs text-gray-500">{label}</label>
      <div className="flex items-start gap-2">
        <input autoFocus type={numeric ? 'number' : date ? 'date' : 'text'} className="flex-1 border-b-2 border-blue-500 bg-transparent p-1 text-sm focus:outline-none" value={editingValue} disabled={saving} onChange={e=>onChange(e.target.value)} onBlur={onBlur} onKeyDown={onKey} />
        <button type="button" disabled={saving} className="text-xs px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
          onMouseDown={()=> setSkipDiscard(true)}
          onClick={onSave}>保存</button>
      </div>
    </div>
  );
  const shown = value ? (prefix ? prefix + value : value) : placeholder;
  return (
    <p className={isMe ? 'cursor-pointer text-sm' : 'text-sm'} onClick={()=> isMe && beginEdit(field, value)}>
      <span className="font-semibold text-gray-700">{label}:</span>{' '}{value && isLink ? <a className="link-accent" href={value} target="_blank" rel="noreferrer">{shown}</a> : shown}
    </p>
  );
}

function FieldTextarea(p: Omit<CommonFieldProps,'onKey'|'prefix'|'isLink'|'numeric'|'date'> & { onSave: ()=>void; setSkipDiscard:(v:boolean)=>void }) {
  const { label, value, placeholder, field, editingField, editingValue, beginEdit, onChange, onBlur, isMe, saving, onSave, setSkipDiscard } = p;
  const active = editingField === field;
  if (active) return (
    <div className="text-sm space-y-1">
      <label className="text-xs text-gray-500">{label}</label>
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <textarea autoFocus rows={5} className="w-full border-b-2 border-blue-500 bg-transparent p-1 text-sm focus:outline-none" value={editingValue} disabled={saving} onChange={e=>onChange(e.target.value)} onBlur={onBlur} />
          <p className="text-[10px] text-gray-500">{editingValue.replace(/[\r\n]+/g,' ').replace(/[\u3000]+/g,'').replace(/ {2,}/g,' ').trim().length}/100</p>
        </div>
        <button type="button" disabled={saving} className="text-xs h-8 px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50 mt-1"
          onMouseDown={()=> setSkipDiscard(true)}
          onClick={onSave}>保存</button>
      </div>
    </div>
  );
  return (
    <p className={isMe ? 'cursor-pointer text-sm whitespace-pre-line' : 'text-sm whitespace-pre-line'} onClick={()=> isMe && beginEdit(field, value)}>
      <span className="font-semibold text-gray-700">{label}:</span>{' '}{value ? value : placeholder}
    </p>
  );
}

interface LinksFieldProps {
  profile: any;
  editingField: string | null;
  editingValue: string;
  editingLinkIndex: number | null;
  beginEdit: (f:string, cur:string, idx?:number)=>void;
  onChange: (v:string)=>void;
  onBlur: ()=>void;
  onKey: (e:React.KeyboardEvent)=>void;
  isMe: boolean;
  saving: boolean;
  onSave: ()=>void;
  setSkipDiscard: (v:boolean)=>void;
}

function LinksField(p: LinksFieldProps) {
  const { profile, editingField, editingValue, editingLinkIndex, beginEdit, onChange, onBlur, onKey, isMe, saving, onSave, setSkipDiscard } = p;
  const links: string[] = (profile.links || []).slice(0,3);
  const active = editingField === 'link';
  return (
    <div className="text-sm space-y-1">
      <span className="font-semibold text-gray-700">その他URL:</span>
      <ul className="list-disc ml-5 space-y-1">
        {links.map((l,i)=>(
          <li key={i} className={isMe ? 'cursor-pointer' : ''} onClick={()=> isMe && beginEdit('link', l, i)}>
            {active && editingLinkIndex===i ? (
              <div className="flex items-center gap-2">
                <input autoFocus className="flex-1 border-b-2 border-blue-500 bg-transparent p-1 text-xs focus:outline-none" value={editingValue} disabled={saving} onChange={e=>onChange(e.target.value)} onBlur={onBlur} onKeyDown={onKey} />
                <button type="button" disabled={saving} className="text-[10px] px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
                  onMouseDown={()=> setSkipDiscard(true)}
                  onClick={onSave}>保存</button>
              </div>
            ) : <a href={l} className="link-accent" target="_blank" rel="noreferrer">{l}</a>}
          </li>
        ))}
        {links.length === 0 && <li className="text-gray-500">未設定</li>}
        {isMe && links.length < 3 && !active && (
          <li><button type="button" className="text-xs text-blue-600 underline" onClick={()=> beginEdit('link','',links.length)}>+ 追加</button></li>
        )}
        {active && editingLinkIndex === links.length && (
          <li>
            <div className="flex items-center gap-2">
              <input autoFocus className="flex-1 border-b-2 border-blue-500 bg-transparent p-1 text-xs focus:outline-none" value={editingValue} disabled={saving} onChange={e=>onChange(e.target.value)} onBlur={onBlur} onKeyDown={onKey} />
              <button type="button" disabled={saving} className="text-[10px] px-2 py-1 bg-blue-600 text-white rounded disabled:opacity-50"
                onMouseDown={()=> setSkipDiscard(true)}
                onClick={onSave}>保存</button>
            </div>
          </li>
        )}
      </ul>
    </div>
  );
}
