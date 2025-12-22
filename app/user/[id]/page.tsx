"use client";
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuthUser } from '../../../lib/hooks/useAuthUser';
import { getUserByHandle, updateUser } from '../../../lib/repos/userRepo';
import { listAlbumsByOwner } from '../../../lib/repos/albumRepo';
import { listAlbumIdsByUploader } from '../../../lib/repos/imageRepo';
import { listCommentsByUser } from '../../../lib/repos/commentRepo';
import { getAlbum } from '../../../lib/repos/albumRepo';
import { getFriendStatus, sendFriendRequest, acceptFriend, cancelFriendRequest, removeFriend, listAcceptedFriends } from '../../../lib/repos/friendRepo';
import { isWatched, addWatch, removeWatch, listWatchers } from '../../../lib/repos/watchRepo';
import { translateError } from '../../../lib/errors';
import { useToast } from '../../../components/ui/Toast';
import { deleteAccountData } from '../../../lib/services/deleteAccount';
import { auth } from '../../../lib/firebase';
import { deleteUser, reauthenticateWithCredential, EmailAuthProvider, reauthenticateWithPopup, GoogleAuthProvider } from 'firebase/auth';
import Avatar from '../../../components/profile/Avatar';
import AvatarModal from '../../../components/profile/AvatarModal';
import InlineTextField from '../../../components/form/InlineTextField';
import InlineTextareaField from '../../../components/form/InlineTextareaField';
import LinksField from '../../../components/form/LinksField';
import FriendActions from '../../../components/profile/FriendActions';
import WatchActions from '../../../components/profile/WatchActions';
import { buildProfilePatch } from '../../../src/services/profile/buildPatch';
import { TimelineItem } from '../../../components/timeline/TimelineItem';
import GalleryGrid, { type PhotoItem } from '../../../components/gallery/GalleryGrid';
import { listImages, listImagesByUploaderPage } from '../../../lib/repos/imageRepo';
import { listComments } from '../../../lib/repos/commentRepo';
import { countLikes, hasLiked, toggleLike } from '../../../lib/repos/likeRepo';
import { listReactionsByAlbum, toggleReaction } from '../../../lib/repos/reactionRepo';
import { addNotification } from '../../../lib/repos/notificationRepo';
import { getUser } from '../../../lib/repos/userRepo';
import { Button } from '../../../components/ui/Button';

export default function ProfilePage() {
  const params = useParams();
  const handleParam = params?.id as string | undefined;
  const { user } = useAuthUser();

  // Base state
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Social state
  const [friendState, setFriendState] = useState<'none'|'sent'|'received'|'accepted'>('none');
  const [busy, setBusy] = useState(false);
  const [watching, setWatching] = useState(false);
  const [watchBusy, setWatchBusy] = useState(false);

  // Extra info
  const [ownAlbums, setOwnAlbums] = useState<any[] | null>(null);
  const [joinedAlbums, setJoinedAlbums] = useState<any[] | null>(null);
  const [userComments, setUserComments] = useState<any[] | null>(null);
  const [stats, setStats] = useState<{ ownCount: number; joinedCount: number; commentCount: number } | null>(null);
  // Social counts & lists
  const [watchersCount, setWatchersCount] = useState<number>(0);
  const [friendsCount, setFriendsCount] = useState<number>(0);
  const watchersIdsRef = useRef<string[] | null>(null);
  const friendsOtherIdsRef = useRef<string[] | null>(null);
  const [watchersOpen, setWatchersOpen] = useState(false);
  const [friendsOpen, setFriendsOpen] = useState(false);
  const [watchersLoading, setWatchersLoading] = useState(false);
  const [friendsLoading, setFriendsLoading] = useState(false);
  const [watchersUsers, setWatchersUsers] = useState<any[] | null>(null);
  const [friendsUsers, setFriendsUsers] = useState<any[] | null>(null);
  const [loadingExtra, setLoadingExtra] = useState(false);
  const [extraError, setExtraError] = useState<string | null>(null);
  // Tab state for lists
  const [listTab, setListTab] = useState<'own'|'joined'|'comments'|'images'>('own');
  const [ownRows, setOwnRows] = useState<any[]>([]);

  // Uploaded images tab
  const [uploadedPhotos, setUploadedPhotos] = useState<PhotoItem[] | null>(null);
  const [uploadedLoading, setUploadedLoading] = useState(false);
  const [uploadedError, setUploadedError] = useState<string | null>(null);
  const [uploadedErrorLink, setUploadedErrorLink] = useState<string | null>(null);
  const [uploadedHasMore, setUploadedHasMore] = useState(true);
  const uploadedCursorRef = useRef<any>(null);
  const uploadedInFlightRef = useRef(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const albumMetaRef = useRef(new Map<string, { title: string; ownerIconURL: string | null }>());
  const ownerIconCacheRef = useRef(new Map<string, string | null>());

  // Inline edit state
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState('');
  const [editingLinkIndex, setEditingLinkIndex] = useState<number | null>(null);
  const [editingOriginalValue, setEditingOriginalValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [skipDiscardNextBlur, setSkipDiscardNextBlur] = useState(false);

  // Delete account state
  const [showDeleteAccount, setShowDeleteAccount] = useState(false);
  const [agreeDelete, setAgreeDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteStep, setDeleteStep] = useState<string>('');
  const [pw, setPw] = useState('');
  const { show } = useToast();
  const providerIds = useMemo(() => (user?.providerData || []).map(p => p.providerId).filter(Boolean), [user]);
  const canReauthWithPassword = useMemo(() => {
    // providerData が空のケース（匿名など）で誤って password 扱いしない
    if (!user) return false;
    if (user.isAnonymous) return false;
    return providerIds.includes('password') && !!user.email;
  }, [user, providerIds]);
  const canReauthWithGoogle = useMemo(() => {
    if (!user) return false;
    if (user.isAnonymous) return false;
    return providerIds.includes('google.com');
  }, [user, providerIds]);
  const [avatarOpen, setAvatarOpen] = useState(false);

  // Load profile and social flags
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

  // Load extra info
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
        // watchers/friends counts
        let watcherIds: string[] = [];
        let friendOtherIds: string[] = [];
        try {
          watcherIds = await listWatchers(profile.uid);
        } catch {}
        try {
          const fdocs = await listAcceptedFriends(profile.uid);
          friendOtherIds = fdocs.map(fd => (fd.userId === profile.uid ? fd.targetId : fd.userId)).filter(Boolean);
        } catch {}
        if (active) {
          setOwnAlbums(own);
          setJoinedAlbums(joined.filter(a => !!a));
          setUserComments(comments);
          setStats({ ownCount: own.length, joinedCount: filteredIds.length, commentCount: comments.length });
          setWatchersCount(watcherIds.length);
          setFriendsCount(friendOtherIds.length);
          watchersIdsRef.current = watcherIds;
          friendsOtherIdsRef.current = friendOtherIds;
          // profile が変わったら投稿画像タブは未ロード状態に戻す
          setUploadedPhotos(null);
          setUploadedError(null);
          setUploadedErrorLink(null);
          setUploadedHasMore(true);
          uploadedCursorRef.current = null;
          uploadedInFlightRef.current = false;
          albumMetaRef.current = new Map();
          ownerIconCacheRef.current = new Map();
        }
      } catch (e:any) {
        if (active) setExtraError(translateError(e));
      } finally {
        if (active) setLoadingExtra(false);
      }
    })();
    return () => { active = false; };
  }, [profile?.uid]);

  async function openWatchersModal() {
    setWatchersOpen(true);
    if (watchersUsers !== null) return;
    const ids = watchersIdsRef.current || [];
    setWatchersLoading(true);
    try {
      const users = await Promise.all(ids.map(async (uid) => {
        try { return await getUser(uid); } catch { return null; }
      }));
      setWatchersUsers(users.filter(Boolean));
    } finally {
      setWatchersLoading(false);
    }
  }

  async function openFriendsModal() {
    setFriendsOpen(true);
    if (friendsUsers !== null) return;
    const ids = friendsOtherIdsRef.current || [];
    setFriendsLoading(true);
    try {
      const users = await Promise.all(ids.map(async (uid) => {
        try { return await getUser(uid); } catch { return null; }
      }));
      setFriendsUsers(users.filter(Boolean));
    } finally {
      setFriendsLoading(false);
    }
  }

  function escapeHtml(text: string) {
    return String(text)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function toHalfWidthAscii(text: string): string {
    // 全角英数記号(！〜)と全角スペースを半角へ。
    // それ以外の文字はそのまま（IMEで全角英数になったケースを主に想定）。
    return String(text)
      .replace(/\u3000/g, ' ')
      .replace(/[\uFF01-\uFF5E]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0));
  }

  function toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value === 'object' && typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    if (typeof value === 'number') return new Date(value > 1e12 ? value : value * 1000);
    return null;
  }

  function fmtDateShort(dt: Date | null): string {
    if (!dt) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    return `${y}/${m}/${d}`;
  }

  async function ensureAlbumMeta(albumIds: string[]) {
    const missing = albumIds.filter((id) => id && !albumMetaRef.current.has(id));
    if (missing.length === 0) return;
    await Promise.all(
      missing.map(async (albumId) => {
        try {
          const a: any = await getAlbum(albumId);
          const title = (a?.title || '無題') as string;
          const ownerId = (a?.ownerId || '') as string;
          let ownerIconURL: string | null = null;
          if (ownerId) {
            if (ownerIconCacheRef.current.has(ownerId)) {
              ownerIconURL = ownerIconCacheRef.current.get(ownerId) ?? null;
            } else {
              try {
                const ou: any = await getUser(ownerId);
                ownerIconURL = (ou?.iconURL || null) as string | null;
              } catch {
                ownerIconURL = null;
              }
              ownerIconCacheRef.current.set(ownerId, ownerIconURL);
            }
          }
          albumMetaRef.current.set(albumId, { title, ownerIconURL });
        } catch {
          albumMetaRef.current.set(albumId, { title: '無題', ownerIconURL: null });
        }
      })
    );
  }

  async function loadMoreUploaded(reset: boolean) {
    if (!profile?.uid) return;
    if (uploadedInFlightRef.current) return;
    if (!reset && !uploadedHasMore) return;

    uploadedInFlightRef.current = true;
    setUploadedLoading(true);
    setUploadedError(null);
    setUploadedErrorLink(null);
    try {
      if (reset) {
        uploadedCursorRef.current = null;
        setUploadedHasMore(true);
        setUploadedPhotos([]);
      }

      const pageSize = 48;
      const res = await Promise.race([
        listImagesByUploaderPage(profile.uid, pageSize, uploadedCursorRef.current),
        new Promise<any>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 12000)),
      ]);

      const rows = res?.items || [];
      const albumIds = Array.from(new Set(rows.map((x: any) => x?.albumId).filter(Boolean)));
      await ensureAlbumMeta(albumIds as string[]);

      const newPhotos: PhotoItem[] = rows
        .map((x: any, idx: number) => {
          const src = x.url || x.downloadUrl;
          if (!src) return null;
          const thumbSrc = x.thumbUrl || x.thumb || x.url || x.downloadUrl;
          const albumId = x.albumId as string | undefined;
          const meta = albumId ? albumMetaRef.current.get(albumId) : undefined;
          const title = meta?.title || '無題';
          const ownerIconURL = meta?.ownerIconURL || null;
          const dateText = fmtDateShort(toDate(x.createdAt));

          const safeTitle = escapeHtml(title);
          const safeAlbumId = albumId ? encodeURIComponent(String(albumId)) : '';
          const safeOwnerIconURL = ownerIconURL ? escapeHtml(ownerIconURL) : '';

          const subHtml = albumId
            ? `<span class="inline-flex items-center gap-2">${ownerIconURL ? `<img src="${safeOwnerIconURL}" alt="" class="h-6 w-6 rounded-full object-cover" loading="lazy" />` : ''}<a href="/album/${safeAlbumId}" class="link-accent">${safeTitle}</a>${dateText ? ` <span class=\"text-xs text-muted/80\">${escapeHtml(dateText)}</span>` : ''}</span>`
            : undefined;

          return {
            id: x.id ?? `${src}:${idx}`,
            src,
            thumbSrc,
            width: 1,
            height: 1,
            subHtml,
            uploaderId: x.uploaderId,
          } satisfies PhotoItem;
        })
        .filter(Boolean) as PhotoItem[];

      setUploadedPhotos((prev) => {
        const base = reset ? [] : (prev || []);
        const merged = [...base, ...newPhotos];
        const seen = new Set<string>();
        const unique: PhotoItem[] = [];
        for (const p of merged) {
          const key = (p.id ?? p.src) as string;
          if (seen.has(key)) continue;
          seen.add(key);
          unique.push(p);
        }
        return unique;
      });

      uploadedCursorRef.current = res?.nextCursor || null;
      setUploadedHasMore(!!res?.hasMore && !!res?.nextCursor);
    } catch (e: any) {
      const isTimeout = e && (e.message === 'TIMEOUT' || e.code === 'deadline-exceeded');
      const isIndexMissing = e?.code === 'failed-precondition';
      const rawMessage = typeof e?.message === 'string' ? e.message : '';
      const match = rawMessage.match(/https:\/\/console\.firebase\.google\.com\/[^\s)]+/);
      const indexUrl = match?.[0] || null;

      const msg = isTimeout
        ? '投稿画像の取得に時間がかかっています。しばらく待ってから再度お試しください。'
        : (isIndexMissing
          ? 'Firestore のインデックスが不足しています。下のリンクから作成してください。'
          : translateError(e));

      setUploadedError(msg);
      if (isIndexMissing && indexUrl) setUploadedErrorLink(indexUrl);
      setUploadedHasMore(false);
      if (reset) setUploadedPhotos([]);
    } finally {
      setUploadedLoading(false);
      uploadedInFlightRef.current = false;
    }
  }

  // Initial load when tab opens
  useEffect(() => {
    if (!profile?.uid) return;
    if (listTab !== 'images') return;
    if (uploadedPhotos !== null) return;
    let cancelled = false;
    (async () => {
      await loadMoreUploaded(true);
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.uid, listTab]);

  // Infinite load by IntersectionObserver
  useEffect(() => {
    if (listTab !== 'images') return;
    if (!uploadedHasMore) return;
    if (uploadedLoading) return;
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          loadMoreUploaded(false);
        }
      },
      { root: null, rootMargin: '300px', threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listTab, uploadedHasMore, uploadedLoading, profile?.uid]);

  // Build timeline-like rows for own albums
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!ownAlbums || !profile?.uid) { if (!cancelled) setOwnRows([]); return; }
        const cache = new Map<string, any>();
        const ownerRef = { uid: profile.uid, handle: profile.handle || null, iconURL: profile.iconURL || null, displayName: profile.displayName };
        const rows = await Promise.all(ownAlbums.map(async (album) => {
          const [imgs, cmts, likeCnt, likedFlag, reactions] = await Promise.all([
            listImages(album.id),
            listComments(album.id),
            countLikes(album.id),
            user?.uid ? hasLiked(album.id, user.uid) : Promise.resolve(false),
            listReactionsByAlbum(album.id, user?.uid || ''),
          ]);
          const cAsc = [...cmts]
            .sort((a, b) => (a.createdAt?.seconds || a.createdAt || 0) - (b.createdAt?.seconds || b.createdAt || 0));
          const latest = cAsc.slice(-1)[0];
          const previewDesc = cAsc.slice(-3).reverse();
          const commentsPreview = await Promise.all(previewDesc.map(async (c) => {
            let cu = cache.get(c.userId);
            if (cu === undefined) {
              const u = await getUser(c.userId);
              cu = u ? { uid: u.uid, handle: u.handle || null, iconURL: u.iconURL || null, displayName: u.displayName } : null;
              cache.set(c.userId, cu);
            }
            return { body: c.body, userId: c.userId, user: cu || undefined, createdAt: c.createdAt };
          }));
          const imgRows = (imgs || [])
            .map((x: any) => ({ url: x.url || x.downloadUrl || "", thumbUrl: x.thumbUrl || x.url || x.downloadUrl || "", uploaderId: x.uploaderId }))
            .filter((x: any) => x.url);
          return {
            album,
            images: imgRows,
            likeCount: likeCnt,
            liked: !!likedFlag,
            commentCount: (cmts || []).length,
            latestComment: latest ? { body: latest.body, userId: latest.userId } : undefined,
            commentsPreview,
            reactions,
            owner: ownerRef,
          };
        }));
        if (!cancelled) setOwnRows(rows);
      } catch (e) {
        // 失敗時は簡易フォールバック（タイトルリストのみになるよう、空でセット）
        if (!cancelled) setOwnRows([]);
      }
    })();
    return () => { cancelled = true; };
  }, [ownAlbums, user?.uid, profile?.uid]);

  // Like toggle for own rows (optimistic)
  async function handleToggleLikeOwn(index: number) {
    if (!user) return;
    const albumId = ownRows[index]?.album?.id;
    if (!albumId) return;
    setOwnRows((prev) => {
      const next = [...prev];
      const row = next[index];
      if (!row) return prev;
      const likedPrev = row.liked;
      row.liked = !likedPrev;
      row.likeCount = likedPrev ? row.likeCount - 1 : row.likeCount + 1;
      return next;
    });
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/likes/toggle', {
        method: 'POST', headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
        body: JSON.stringify({ albumId, userId: user.uid }),
      });
      if (!res.ok) {
        await toggleLike(albumId, user.uid);
      }
    } catch {
      // rollback
      setOwnRows((prev) => {
        const next = [...prev];
        const row = next[index];
        if (!row) return prev;
        row.liked = !row.liked;
        row.likeCount = row.liked ? row.likeCount + 1 : row.likeCount - 1;
        return next;
      });
    }
  }

  // Reaction toggle for own rows (optimistic + notification)
  async function handleToggleReactionOwn(index: number, emoji: string) {
    if (!user) return;
    const albumId = ownRows[index]?.album?.id;
    if (!albumId) return;
    // 楽観更新
    setOwnRows((prev) => {
      const next = [...prev];
      const row = next[index];
      if (!row) return prev;
      const list = row.reactions.slice();
      const idx = list.findIndex((x: any) => x.emoji === emoji);
      if (idx >= 0) {
        const item = { ...list[idx] };
        if (item.mine) { item.mine = false; item.count = Math.max(0, item.count - 1); }
        else { item.mine = true; item.count += 1; }
        list[idx] = item;
      } else {
        list.push({ emoji, count: 1, mine: true });
      }
      row.reactions = list;
      next[index] = { ...row };
      return next;
    });
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/reactions/toggle', {
        method: 'POST', headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
        body: JSON.stringify({ albumId, userId: user.uid, emoji }),
      });
      let added = false;
      if (res.ok) {
        const data = await res.json().catch(()=>({}));
        added = !!data?.added;
      } else {
        const result = await toggleReaction(albumId, user.uid, emoji);
        added = !!(result as any)?.added;
      }
      const row = ownRows[index];
      if (added && row && row.album.ownerId !== user.uid) {
        addNotification({ userId: row.album.ownerId, actorId: user.uid, type: 'reaction', albumId, message: 'アルバムにリアクション: ' + emoji }).catch(()=>{});
      }
    } catch {
      // 失敗時ロールバック
      setOwnRows((prev) => {
        const next = [...prev];
        const row = next[index];
        if (!row) return prev;
        const list = row.reactions.slice();
        const idx = list.findIndex((x: any) => x.emoji === emoji);
        if (idx >= 0) {
          const item = { ...list[idx] };
          if (item.mine) { item.mine = false; item.count = Math.max(0, item.count - 1); }
          else { item.mine = true; item.count += 1; }
          list[idx] = item;
        }
        row.reactions = list;
        next[index] = { ...row };
        return next;
      });
    }
  }

  async function handleSubmitCommentOwn(index: number, text: string) {
    if (!user) return;
    const albumId = ownRows[index]?.album?.id;
    if (!albumId) return;
    const { addComment } = await import('../../../lib/repos/commentRepo');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/comments/add', {
        method: 'POST', headers: { 'content-type': 'application/json', 'authorization': `Bearer ${token}` },
        body: JSON.stringify({ albumId, userId: user.uid, body: text }),
      });
      if (!res.ok) { await addComment(albumId, user.uid, text); }
    } catch {
      await addComment(albumId, user.uid, text);
    }
  }

  // Friend actions
  async function doSend() {
    if (!user || !profile?.uid) return;
    setBusy(true); setError(null);
    try { await sendFriendRequest(user.uid, profile.uid); setFriendState('sent'); }
    catch (e:any) { setError(translateError(e)); }
    finally { setBusy(false); }
  }
  async function doAccept() {
    if (!user || !profile?.uid) return;
    setBusy(true); setError(null);
    try { await acceptFriend(profile.uid, user.uid); setFriendState('accepted'); }
    catch (e:any) { setError(translateError(e)); }
    finally { setBusy(false); }
  }
  async function doCancel() {
    if (!user || !profile?.uid) return;
    setBusy(true); setError(null);
    try { await cancelFriendRequest(user.uid, profile.uid); setFriendState('none'); }
    catch (e:any) { setError(translateError(e)); }
    finally { setBusy(false); }
  }
  async function doRemove() {
    if (!user || !profile?.uid) return;
    if (!confirm('フレンドを解除しますか？')) return;
    setBusy(true); setError(null);
    try { await removeFriend(user.uid, profile.uid); setFriendState('none'); }
    catch (e:any) { setError(translateError(e)); }
    finally { setBusy(false); }
  }

  // Watch toggle
  async function doWatchToggle() {
    if (!user || !profile?.uid || user.uid === profile.uid) return;
    setWatchBusy(true); setError(null);
    try {
      if (watching) { await removeWatch(user.uid, profile.uid); setWatching(false); }
      else { await addWatch(user.uid, profile.uid); setWatching(true); }
    } catch (e:any) { setError(translateError(e)); }
    finally { setWatchBusy(false); }
  }

  // Delete account
  async function doDeleteAccount() {
    if (!user) return;
    try {
      setDeleting(true);
      setDeleteStep('再認証中...');

      // プロバイダに応じて再認証（必要なときだけ）
      if (canReauthWithPassword) {
        if (!pw) throw new Error('MISSING_PASSWORD');
        const email = user.email;
        if (!email) throw new Error('MISSING_EMAIL');
        const cred = EmailAuthProvider.credential(email, pw);
        await reauthenticateWithCredential(user, cred);
      } else if (canReauthWithGoogle) {
        const provider = new GoogleAuthProvider();
        await reauthenticateWithPopup(user, provider);
      }

      setDeleteStep('データ削除中...');
      await deleteAccountData(user.uid, (step) => setDeleteStep(`データ削除中: ${step}`));
      setDeleteStep('アカウント削除中...');
      await deleteUser(user);
      try { sessionStorage.setItem('app:toast', JSON.stringify({ message: 'アカウントを削除しました', variant: 'success' })); } catch {}
      window.location.href = '/';
    } catch (e:any) {
      const msg = translateError(e);
      setError(msg);
      try { show({ message: msg, variant: 'error' }); } catch {}
      setDeleting(false);
    }
  }
  async function reauthGoogle() { try { const provider = new GoogleAuthProvider(); await reauthenticateWithPopup(auth.currentUser!, provider); } catch {} }

  // Guard
  if (loading) return <div className="p-4 text-sm text-muted/80">読み込み中...</div>;
  if (!profile) return <div className="p-4 text-sm text-muted">ユーザーが見つかりません (handle)</div>;

  const isMe = user && profile && user.uid === profile.uid;

  // Inline edit helpers
  function beginEdit(field: string, current: any, linkIndex?: number) {
    if (!isMe) return;
    setSaveMsg(null);
    setEditingField(field);
    setEditingOriginalValue(current || '');
    if (field === 'link') { setEditingLinkIndex(linkIndex ?? 0); setEditingValue(current || ''); }
    else if (field === 'age') { setEditingValue(typeof current === 'number' ? String(current) : ''); }
    else { setEditingValue(current || ''); }
  }

  async function commitEdit() {
    if (!editingField || !profile || !isMe) { cancelEdit(); return; }
    const raw = editingValue.trim();
    let patch: any = {};
    try {
      if (editingField === 'link') {
        const links: string[] = (profile.links || []).slice(0, 3);
        const idx = editingLinkIndex ?? 0;
        if (!raw) { links.splice(idx, 1); }
        else {
          if (!/^https?:\/\//.test(raw)) throw new Error('URLはhttp/httpsのみ');
          if (idx < links.length) links[idx] = raw; else links.push(raw);
        }
        patch.links = links;
      } else {
        patch = await buildProfilePatch(editingField, raw, profile);
      }
    } catch (e:any) { setError(e.message || String(e)); return; }

    setSaving(true); setError(null);
    try {
      await updateUser(profile.uid, patch);
      setProfile({ ...profile, ...patch });
      setSaveMsg('保存しました');
      cancelEdit();
    } catch (e:any) { setError(translateError(e)); }
    finally { setSaving(false); }
  }

  function cancelEdit() {
    setEditingField(null);
    setEditingValue('');
    setEditingLinkIndex(null);
    setShowDiscardConfirm(false);
    setSkipDiscardNextBlur(false);
  }
  function handleBlur() {
    if (!editingField) return;
    if (skipDiscardNextBlur) { setSkipDiscardNextBlur(false); return; }
    if (editingValue !== editingOriginalValue) setShowDiscardConfirm(true);
    else cancelEdit();
  }
  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') { e.preventDefault(); cancelEdit(); return; }
    if (e.key === 'Enter' && !(e.shiftKey || (editingField === 'bio'))) { e.preventDefault(); void commitEdit(); }
  }
  function keepEditing() { setShowDiscardConfirm(false); }
  function saveFromModal() { void commitEdit(); }
  function discardChanges() { cancelEdit(); }

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      <header className="space-y-3">
        <div className="flex items-center gap-4">
          <Avatar
            src={profile.iconURL ? `${profile.iconURL}${profile.iconUpdatedAt ? `?v=${new Date((profile.iconUpdatedAt as any)?.seconds ? (profile.iconUpdatedAt as any).toDate?.() : profile.iconUpdatedAt).getTime()}` : ''}` : undefined}
            size={72}
            onClick={()=> setAvatarOpen(true)}
          />
          <div className="min-w-0">
            <div className="flex flex-col">
              {isMe && editingField === 'displayName' ? (
                <input
                  autoFocus
                  type="text"
                  className="border-b-2 border-[--accent] bg-transparent p-0.5 text-2xl font-semibold focus:outline-none"
                  value={editingValue}
                  onChange={(e)=> setEditingValue(e.target.value)}
                  onBlur={handleBlur}
                  onKeyDown={onKey}
                  placeholder="（表示名未設定）"
                />
              ) : (
                <h1
                  className={isMe ? "text-2xl font-semibold truncate cursor-pointer" : "text-2xl font-semibold truncate"}
                  title={profile.displayName || '名前未設定'}
                  onClick={()=> isMe && beginEdit('displayName', profile.displayName || '')}
                >
                  {profile.displayName || '名前未設定'}
                </h1>
              )}

              {isMe && editingField === 'handle' ? (
                <div className="flex items-baseline gap-1">
                  <span className="text-sm text-muted/80">@</span>
                  <input
                    autoFocus
                    type="text"
                    className="flex-1 border-b-2 border-[--accent] bg-transparent p-0.5 text-sm focus:outline-none"
                    value={editingValue}
                    onChange={(e)=> setEditingValue(e.target.value)}
                    onBlur={handleBlur}
                    onKeyDown={onKey}
                    placeholder="ハンドル未設定"
                  />
                </div>
              ) : (
                <span
                  className={isMe ? "text-sm text-muted truncate cursor-pointer" : "text-sm text-muted truncate"}
                  title={profile.handle ? `@${profile.handle}` : 'ハンドル未設定'}
                  onClick={()=> isMe && beginEdit('handle', profile.handle || '')}
                >
                  {profile.handle ? `@${profile.handle}` : 'ハンドル未設定'}
                </span>
              )}
            </div>
            {/* watcher/friend counts */}
            <div className="flex items-center gap-3 mt-1">
              <button
                type="button"
                className="text-xs px-2 py-0.5 rounded bg-sky-500 text-white hover:bg-sky-600 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]/40"
                onClick={openWatchersModal}
              >
                ウォッチャー {watchersCount}
              </button>
              <button
                type="button"
                className="text-xs px-2 py-0.5 rounded bg-orange-500 text-white hover:bg-orange-600 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]/40"
                onClick={openFriendsModal}
              >
                フレンド {friendsCount}
              </button>
            </div>
          </div>
        </div>
        <InlineTextareaField
          label="自己紹介"
          value={profile.bio || ''}
          placeholder="未設定"
          field="bio"
          editingField={editingField}
          editingValue={editingValue}
          beginEdit={beginEdit}
          onChange={setEditingValue}
          onBlur={handleBlur}
          isMe={isMe}
          saving={saving}
          onSave={commitEdit}
          setSkipDiscard={setSkipDiscardNextBlur}
        />
        {!detailsOpen && (
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setDetailsOpen(true)}
            className="border-0 bg-transparent hover:bg-transparent px-0! py-0! text-xs link-accent"
          >
            詳細を表示
          </Button>
        )}
        {detailsOpen && (
          <div className="space-y-2">
            <InlineTextField label="VRChat URL" value={profile.vrchatUrl || ''} placeholder="未設定" field="vrchatUrl" editingField={editingField} editingValue={editingValue} beginEdit={beginEdit} onChange={setEditingValue} onBlur={handleBlur} onKey={onKey} isMe={isMe} saving={saving} isLink onSave={commitEdit} setSkipDiscard={setSkipDiscardNextBlur} />
            <LinksField profile={profile} editingField={editingField} editingValue={editingValue} editingLinkIndex={editingLinkIndex} beginEdit={beginEdit} onChange={setEditingValue} onBlur={handleBlur} onKey={onKey} isMe={isMe} saving={saving} onSave={commitEdit} setSkipDiscard={setSkipDiscardNextBlur} />
            <InlineTextField label="言語" value={profile.language || ''} placeholder="未設定" field="language" editingField={editingField} editingValue={editingValue} beginEdit={beginEdit} onChange={setEditingValue} onBlur={handleBlur} onKey={onKey} isMe={isMe} saving={saving} onSave={commitEdit} setSkipDiscard={setSkipDiscardNextBlur} />
            <InlineTextField label="性別" value={profile.gender || ''} placeholder="未設定" field="gender" editingField={editingField} editingValue={editingValue} beginEdit={beginEdit} onChange={setEditingValue} onBlur={handleBlur} onKey={onKey} isMe={isMe} saving={saving} onSave={commitEdit} setSkipDiscard={setSkipDiscardNextBlur} />
            <InlineTextField label="年齢" value={typeof profile.age === 'number' ? String(profile.age) : ''} placeholder="未設定" field="age" editingField={editingField} editingValue={editingValue} beginEdit={beginEdit} onChange={setEditingValue} onBlur={handleBlur} onKey={onKey} isMe={isMe} saving={saving} numeric onSave={commitEdit} setSkipDiscard={setSkipDiscardNextBlur} />
            <InlineTextField label="場所" value={profile.location || ''} placeholder="未設定" field="location" editingField={editingField} editingValue={editingValue} beginEdit={beginEdit} onChange={setEditingValue} onBlur={handleBlur} onKey={onKey} isMe={isMe} saving={saving} onSave={commitEdit} setSkipDiscard={setSkipDiscardNextBlur} />
            <InlineTextField label="生年月日" value={profile.birthDate || ''} placeholder="未設定" field="birthDate" editingField={editingField} editingValue={editingValue} beginEdit={beginEdit} onChange={setEditingValue} onBlur={handleBlur} onKey={onKey} isMe={isMe} saving={saving} date onSave={commitEdit} setSkipDiscard={setSkipDiscardNextBlur} />
            <Button
              type="button"
              variant="ghost"
              size="xs"
              onClick={() => setDetailsOpen(false)}
              className="border-0 bg-transparent hover:bg-transparent px-0! py-0! text-xs link-accent"
            >
              詳細を隠す
            </Button>
          </div>
        )}
        {/*saveMsg && <p className="text-xs text-green-700">{saveMsg}</p>*/}
        {error && <p className="text-xs text-red-600">{error}</p>}
      </header>

      <AvatarModal
        open={avatarOpen}
        onClose={()=> setAvatarOpen(false)}
        uid={profile.uid}
        src={
          isMe
            ? (profile.iconURL || undefined)
            : (profile.iconFullURL || profile.iconURL || undefined)
        }
        alt={(profile.displayName || profile.handle || 'ユーザー') + 'のアイコン'}
        editable={!!isMe}
        onUpdated={(thumbUrl, fullUrl)=> setProfile((p:any)=> ({ ...p, iconURL: thumbUrl, iconFullURL: fullUrl, iconUpdatedAt: new Date() }))}
      />

      {isMe && (
  <section className="space-y-2 pt-4 border-line">
          <Button type="button" variant="danger" size="sm" onClick={() => setShowDeleteAccount(true)}>
            アカウントを削除
          </Button>
        </section>
      )}

      {!isMe && user && (
        <div className="space-y-2">
          <FriendActions state={friendState} busy={busy} onSend={doSend} onCancel={doCancel} onAccept={doAccept} onRemove={doRemove} />
          <div className="pt-2 border-t border-line mt-3">
            <WatchActions watching={watching} busy={watchBusy} onToggle={doWatchToggle} disabled={!user || (user && profile && user.uid === profile.uid)} />
          </div>
          {!user && <p className="text-sm text-muted">ログインすると操作できます</p>}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

  <section className="space-y-4 pt-4 border-t border-line">
  {loadingExtra && <p className="text-sm text-muted/80">読み込み中...</p>}
        {extraError && <p className="text-sm text-red-600">{extraError}</p>}

        <div className="space-y-4 mt-4">
          {/* Tabs */}
          <div role="tablist" aria-label="コンテンツ切替" className="flex gap-2">
            <button
              type="button"
              role="tab"
              aria-selected={listTab==='own'}
              className={`${listTab==='own' ? 'border-b-2 border-[--accent] text-foreground' : 'text-foreground/70 hover:bg-surface-weak'} px-3 py-2`}
              onClick={()=> setListTab('own')}
            >作成アルバム <span className="text-xs text-muted ml-1">({ownAlbums?.length ?? stats?.ownCount ?? 0})</span></button>
            <button
              type="button"
              role="tab"
              aria-selected={listTab==='joined'}
              className={`${listTab==='joined' ? 'border-b-2 border-[--accent] text-foreground' : 'text-foreground/70 hover:bg-surface-weak'} px-3 py-2`}
              onClick={()=> setListTab('joined')}
            >参加アルバム <span className="text-xs text-muted ml-1">({joinedAlbums?.length ?? stats?.joinedCount ?? 0})</span></button>
            <button
              type="button"
              role="tab"
              aria-selected={listTab==='comments'}
              className={`${listTab==='comments' ? 'border-b-2 border-[--accent] text-foreground' : 'text-foreground/70 hover:bg-surface-weak'} px-3 py-2`}
              onClick={()=> setListTab('comments')}
            >コメント <span className="text-xs text-muted ml-1">({userComments?.length ?? stats?.commentCount ?? 0})</span></button>

            <button
              type="button"
              role="tab"
              aria-selected={listTab==='images'}
              className={`${listTab==='images' ? 'border-b-2 border-[--accent] text-foreground' : 'text-foreground/70 hover:bg-surface-weak'} px-3 py-2`}
              onClick={()=> setListTab('images')}
            >投稿画像 <span className="text-xs text-muted ml-1">({uploadedLoading ? '…' : (uploadedPhotos ? uploadedPhotos.length : '-')})</span></button>
          </div>

          {/* Panels */}
          {listTab==='own' && (
            <div role="tabpanel" aria-label="作成アルバム">
              {!ownAlbums && <p className="text-sm text-muted/80">-</p>}
              {ownAlbums && ownAlbums.length === 0 && <p className="text-sm text-muted/80">まだアルバムがありません</p>}
              {ownRows && ownRows.length > 0 && (
                <div className="divide-y divide-line *:pb-12">
                  {ownRows.map((row, i) => (
                    <TimelineItem
                      key={row.album.id}
                      album={row.album}
                      images={row.images}
                      likeCount={row.likeCount}
                      liked={row.liked}
                      onLike={user ? () => handleToggleLikeOwn(i) : () => {}}
                      commentCount={row.commentCount}
                      latestComment={row.latestComment}
                      commentsPreview={row.commentsPreview}
                      onCommentSubmit={user ? (text) => handleSubmitCommentOwn(i, text) : undefined}
                      reactions={row.reactions}
                      onToggleReaction={user ? (emoji) => handleToggleReactionOwn(i, emoji) : undefined}
                      owner={row.owner}
                      isFriend={friendState==='accepted'}
                      isWatched={watching}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {listTab==='joined' && (
            <div role="tabpanel" aria-label="参加アルバム">
              {!joinedAlbums && <p className="text-sm text-muted/80">-</p>}
              {joinedAlbums && joinedAlbums.length === 0 && <p className="text-sm text-muted/80">参加アルバムはまだありません</p>}
              <ul className="divide-y divide-line">
                {joinedAlbums && joinedAlbums.map((a: any, i: number) => (
                  <li key={i} className="py-2">
                    <a href={`/album/${a.id}`} className="link-accent text-sm font-medium">{a.title || '無題'}</a>
                    <p className="text-xs text-muted/80">{a.createdAt?.toDate?.().toLocaleString?.() || ''}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {listTab==='comments' && (
            <div role="tabpanel" aria-label="コメント">
              {!userComments && <p className="text-sm text-muted/80">-</p>}
              {userComments && userComments.length === 0 && <p className="text-sm text-muted/80">コメントはまだありません</p>}
              <ul className="divide-y divide-line">
                {userComments && userComments.map(c => (
                  <li key={c.id} className="py-2 text-sm">
                    <p className="whitespace-pre-line">{c.body}</p>
                    <a href={`/album/${c.albumId}`} className="text-xs link-accent">アルバムへ</a>
                    <p className="text-[10px] text-muted/80">{c.createdAt?.toDate?.().toLocaleString?.() || ''}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {listTab==='images' && (
            <div role="tabpanel" aria-label="投稿画像" className="space-y-2">
              {uploadedLoading && <p className="text-sm text-muted/80">読み込み中...</p>}
              {uploadedError && (
                <div className="space-y-1">
                  <p className="text-sm text-red-600">{uploadedError}</p>
                  {uploadedErrorLink && (
                    <a
                      href={uploadedErrorLink}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm link-accent"
                    >インデックス作成を開く</a>
                  )}
                </div>
              )}
              {uploadedPhotos && uploadedPhotos.length === 0 && !uploadedLoading && (
                <p className="text-sm text-muted/80">投稿画像はまだありません</p>
              )}
              {uploadedPhotos && uploadedPhotos.length > 0 && (
                <GalleryGrid
                  photos={uploadedPhotos}
                  layoutType="grid"
                  columns={4}
                  margin={6}
                  enableLightbox
                  lightboxPlugins={[]}
                  lightboxThumbnail={false}
                />
              )}
              <div ref={sentinelRef} className="h-10" />
            </div>
          )}
        </div>
      </section>

      {showDeleteAccount && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="relative bg-surface-weak border border-line rounded shadow-lg max-w-sm w-[90%] p-5 space-y-3">
            <h3 className="text-sm font-semibold text-red-600">アカウント削除の確認</h3>
            <p className="text-xs text-muted">この操作は元に戻せません。作成したアルバム/コメント/いいね/フレンド/ウォッチは削除されます（通知は残る場合があります）。</p>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={agreeDelete} onChange={e=> setAgreeDelete(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
              理解しました
            </label>
            {canReauthWithPassword && (
              <div>
                <label className="block text-xs text-muted mb-1">パスワード（再認証）</label>
                <input
                  type="password"
                  value={pw}
                  onChange={(e) => setPw(toHalfWidthAscii(e.target.value))}
                  inputMode="text"
                  lang="en"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  className="w-full border-b-2 border-[--accent] bg-transparent p-1 text-sm focus:outline-none"
                  placeholder="現在のパスワード"
                />
              </div>
            )}
            {deleting && (<p className="text-xs text-muted">処理中: {deleteStep || '...'}</p>)}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="md" disabled={deleting} onClick={()=> setShowDeleteAccount(false)}>キャンセル</Button>
              {canReauthWithGoogle && (
                <Button type="button" variant="ghost" size="md" disabled={deleting} onClick={reauthGoogle}>Googleで再認証</Button>
              )}
              <Button
                type="button"
                variant="danger"
                size="md"
                disabled={!agreeDelete || deleting || (canReauthWithPassword && !pw)}
                onClick={doDeleteAccount}
              >
                削除
              </Button>
            </div>
          </div>
        </div>
      )}

      {showDiscardConfirm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-background rounded shadow-lg p-4 w-80 space-y-4">
            <h3 className="text-sm font-semibold">変更を破棄しますか？</h3>
            <p className="text-xs text-muted">保存せずに編集を終了すると内容は元に戻ります。保存しますか、それとも破棄しますか？</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="subtle" size="xs" onClick={keepEditing}>編集を続ける</Button>
              <Button type="button" variant="accent" size="xs" onClick={saveFromModal}>保存</Button>
              <Button type="button" variant="danger" size="xs" onClick={discardChanges}>破棄</Button>
            </div>
          </div>
        </div>
      )}

      {/* Watchers list modal */}
      {watchersOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={()=> setWatchersOpen(false)}>
          <div className="relative bg-surface-weak border border-line rounded shadow-lg max-w-sm w-[90%] p-5 space-y-3" onClick={(e)=> e.stopPropagation()}>
            <h3 className="text-sm font-semibold">ウォッチャー（{watchersCount}）</h3>
            {watchersLoading && <p className="text-xs text-muted/80">読み込み中...</p>}
            {!watchersLoading && (watchersUsers?.length ? (
              <ul className="max-h-80 overflow-auto divide-y divide-line">
                {watchersUsers!.map((u:any)=> (
                  <li key={u.uid} className="py-2">
                    <a href={`/user/${u.handle || u.uid}`} className="flex items-center gap-2 hover:bg-surface-weak px-1">
                      <Avatar src={u.iconURL || undefined} size={28} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{u.displayName || '名前未設定'}</div>
                        <div className="text-[11px] text-muted/80 truncate">@{u.handle || u.uid.slice(0,6)}</div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted/80">ウォッチャーはいません</p>
            ))}
            <div className="flex justify-end">
              <Button type="button" size="xs" variant="ghost" onClick={()=> setWatchersOpen(false)}>閉じる</Button>
            </div>
          </div>
        </div>
      )}

      {/* Friends list modal */}
      {friendsOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={()=> setFriendsOpen(false)}>
          <div className="relative bg-surface-weak border border-line rounded shadow-lg max-w-sm w-[90%] p-5 space-y-3" onClick={(e)=> e.stopPropagation()}>
            <h3 className="text-sm font-semibold">フレンド（{friendsCount}）</h3>
            {friendsLoading && <p className="text-xs text-muted/80">読み込み中...</p>}
            {!friendsLoading && (friendsUsers?.length ? (
              <ul className="max-h-80 overflow-auto divide-y divide-line">
                {friendsUsers!.map((u:any)=> (
                  <li key={u.uid} className="py-2">
                    <a href={`/user/${u.handle || u.uid}`} className="flex items-center gap-2 hover:bg-surface-weak px-1">
                      <Avatar src={u.iconURL || undefined} size={28} />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{u.displayName || '名前未設定'}</div>
                        <div className="text-[11px] text-muted/80 truncate">@{u.handle || u.uid.slice(0,6)}</div>
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted/80">フレンドはいません</p>
            ))}
            <div className="flex justify-end">
              <Button type="button" size="xs" variant="ghost" onClick={()=> setFriendsOpen(false)}>閉じる</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
