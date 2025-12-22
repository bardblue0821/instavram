"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Avatar from "../profile/Avatar";
import { listReactorsByAlbumEmoji, Reactor } from "../../lib/repos/reactionRepo";
import { listLikersByAlbum } from "../../lib/repos/likeRepo";
import { listRepostersByAlbum } from "../../lib/repos/repostRepo";
import { getUser } from "../../lib/repos/userRepo";
import { REACTION_CATEGORIES, filterReactionEmojis } from "../../lib/constants/reactions";
import { HeartIcon } from "../icons/HeartIcon";
import { ChatIcon } from "../icons/ChatIcon";
import { Button } from "../ui/Button";
import { RepostIcon } from "../icons/RepostIcon";

type Img = { url: string; thumbUrl?: string; uploaderId?: string };
type LatestComment = { body: string; userId: string } | undefined;
type CommentPreview = {
  body: string;
  userId: string;
  user?: { uid: string; handle: string | null; iconURL?: string | null; displayName?: string };
  createdAt?: any;
};

type ImageAdded = {
  userId: string;
  user?: { uid: string; handle: string | null; iconURL?: string | null; displayName?: string };
  createdAt?: any;
};

export function TimelineItem(props: {
  album: { id: string; ownerId: string; title?: string | null; createdAt?: any };
  images: Img[];
  likeCount: number;
  liked: boolean;
  onLike: () => Promise<void> | void;
  repostCount?: number;
  reposted?: boolean;
  onToggleRepost?: () => Promise<void> | void;
  currentUserId?: string;
  onRequestDelete?: (albumId: string) => void;
  onRequestReport?: (albumId: string) => void;
  commentCount?: number;
  latestComment?: LatestComment;
  commentsPreview?: CommentPreview[];
  onCommentSubmit?: (text: string) => Promise<void>;
  submitting?: boolean;
  reactions?: Array<{ emoji: string; count: number; mine: boolean }>;
  onToggleReaction?: (emoji: string) => void;
  owner?: { uid: string; handle: string | null; iconURL?: string | null; displayName?: string };
  imageAdded?: ImageAdded;
  repostedBy?: { userId: string; user?: { uid: string; handle: string | null; iconURL?: string | null; displayName?: string }; createdAt?: any };
  isFriend?: boolean;
  isWatched?: boolean;
}) {
  const {
    album,
    images,
    likeCount,
    liked,
    onLike,
    repostCount = 0,
    reposted = false,
    onToggleRepost,
    currentUserId,
    onRequestDelete,
    onRequestReport,
    commentCount = 0,
    latestComment,
    commentsPreview = [],
    onCommentSubmit,
    submitting,
    reactions = [],
    onToggleReaction,
    owner,
    imageAdded,
    repostedBy,
    isFriend,
    isWatched,
  } = props;
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuBtnRef = useRef<HTMLButtonElement | null>(null);
  const [hoveredEmoji, setHoveredEmoji] = useState<string | null>(null);
  const [reactorMap, setReactorMap] = useState<Record<string, Reactor[] | undefined>>({});
  const [reactorLoading, setReactorLoading] = useState<Record<string, boolean>>({});
  const [likersOpen, setLikersOpen] = useState(false);
  const [likersLoading, setLikersLoading] = useState(false);
  const [likers, setLikers] = useState<Reactor[] | undefined>(undefined);
  const [repostersOpen, setRepostersOpen] = useState(false);
  const [repostersLoading, setRepostersLoading] = useState(false);
  const [reposters, setReposters] = useState<Reactor[] | undefined>(undefined);
  const [me, setMe] = useState<{ uid: string; displayName?: string | null; handle?: string | null; iconURL?: string | null } | null>(null);

  async function ensureMe() {
    if (!currentUserId || me) return;
    try {
      const u = await getUser(currentUserId);
      setMe(u ? { uid: currentUserId, displayName: u.displayName ?? null, handle: u.handle ?? null, iconURL: u.iconURL ?? null } : { uid: currentUserId });
    } catch {
      // ignore
    }
  }

  // 楽観表示: 直後のホバーでまだ取得前でも、自分のアクションを表示に反映
  const viewLikers = useMemo(() => {
    const base = likers ? [...likers] : [];
    if (liked && currentUserId && !base.some(u => u.uid === currentUserId)) {
      base.unshift({ uid: currentUserId, displayName: me?.displayName || 'あなた', handle: me?.handle ?? null, iconURL: me?.iconURL || undefined });
    }
    return base;
  }, [likers, liked, currentUserId, me]);
  const viewReposters = useMemo(() => {
    const base = reposters ? [...reposters] : [];
    if (reposted && currentUserId && !base.some(u => u.uid === currentUserId)) {
      base.unshift({ uid: currentUserId, displayName: me?.displayName || 'あなた', handle: me?.handle ?? null, iconURL: me?.iconURL || undefined });
    }
    return base;
  }, [reposters, reposted, currentUserId, me]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [emojiQuery, setEmojiQuery] = useState("");
  const [activeCat, setActiveCat] = useState(REACTION_CATEGORIES[0]?.key || 'faces');
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const pickerBtnRef = useRef<HTMLButtonElement | null>(null);
  const filteredEmojis = useMemo(() => filterReactionEmojis(emojiQuery), [emojiQuery]);
  const categoryEmojis = useMemo(() => {
    const cat = REACTION_CATEGORIES.find(c => c.key === activeCat);
    return cat ? cat.emojis : [];
  }, [activeCat]);

  async function submit() {
    if (!onCommentSubmit || !text.trim()) return;
    setBusy(true);
    try {
      await onCommentSubmit(text.trim());
      setText("");
      // 送信後は入力欄を閉じる
      setShowCommentBox(false);
    } finally {
      setBusy(false);
    }
  }

  async function refreshReactorList(emoji: string) {
    if (reactorLoading[emoji]) return;
    setReactorLoading((s) => ({ ...s, [emoji]: true }));
    try {
      const list = await listReactorsByAlbumEmoji(album.id, emoji, 20);
      setReactorMap((m) => ({ ...m, [emoji]: list }));
    } finally {
      setReactorLoading((s) => ({ ...s, [emoji]: false }));
    }
  }

  function onChipEnter(emoji: string) {
    setHoveredEmoji(emoji);
    if (!reactorMap[emoji]) {
      // 初回ホバー時に取得
      refreshReactorList(emoji);
    }
  }
  function onChipLeave() { setHoveredEmoji(null); }

  async function ensureLikers() {
    if (likers || likersLoading) return;
    setLikersLoading(true);
    try {
      const list = await listLikersByAlbum(album.id, 20);
      setLikers(list);
    } finally {
      setLikersLoading(false);
    }
  }

  async function ensureReposters() {
    if (reposters || repostersLoading) return;
    setRepostersLoading(true);
    try {
      const list = await listRepostersByAlbum(album.id, 20);
      setReposters(list);
    } finally {
      setRepostersLoading(false);
    }
  }

  // アクション直後に自分のプロフィールを用意しておく（楽観表示に本名/アイコンを反映）
  useEffect(() => {
    if ((liked || reposted) && currentUserId && !me) {
      ensureMe();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liked, reposted, currentUserId]);

  // ピッカー外クリック/ESCで閉じる
  useEffect(() => {
    if (!pickerOpen) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (pickerRef.current && !pickerRef.current.contains(t) && pickerBtnRef.current && !pickerBtnRef.current.contains(t)) {
        setPickerOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setPickerOpen(false); }
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [pickerOpen]);

  // 開くたびに検索語をクリア
  useEffect(() => { if (pickerOpen) setEmojiQuery(""); }, [pickerOpen]);

  // メニュー外クリック/ESCで閉じる
  useEffect(() => {
    if (!menuOpen) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(t) && menuBtnRef.current && !menuBtnRef.current.contains(t)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setMenuOpen(false); }
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  // リアクション状態が変わったら、ホバー中の絵文字のリストをリフレッシュ（自分の追加/解除を即時反映）
  useEffect(() => {
    if (hoveredEmoji) {
      refreshReactorList(hoveredEmoji);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reactions]);

  function renderGrid(imgs: Img[]) {
    const n = Math.min(imgs.length, 4);
    const list = imgs.slice(0, n);
    if (n === 0) return null;

    // 共通: アスペクト比ボックス（cover トリミング）
    const Box = ({ ratioW, ratioH, src, alt, href }: { ratioW: number; ratioH: number; src: string; alt: string; href?: string }) => (
      <div style={{ position: 'relative', width: '100%', aspectRatio: `${ratioW} / ${ratioH}`, overflow: 'hidden', borderRadius: 6 }}>
        {href ? (
          <a href={href} aria-label="アルバム詳細へ" className="absolute inset-0 block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={alt} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          </a>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        )}
      </div>
    );

    if (n === 1) {
      // 1枚: 正方形
      const src = list[0].thumbUrl || list[0].url;
      return (
        <div className="flex flex-col gap-1">
          <Box ratioW={1} ratioH={1} src={src} alt="image" href={`/album/${album.id}`} />
        </div>
      );
    }

    if (n === 2) {
      // 2枚: 各タイルを 2:1（横長）にして縦に2枚積む → 全体はほぼ正方形
      return (
        <div className="flex flex-col gap-1">
          {list.map((img, i) => (
            <Box key={i} ratioW={2} ratioH={1} src={img.thumbUrl || img.url} alt={`image-${i}`} href={`/album/${album.id}`} />
          ))}
        </div>
      );
    }

    if (n === 3) {
      // 3枚: CSS Gridで左を2行スパン、右は1:1を上下2枚。
      // Gridのrow gapも左の高さに含まれるため、左右で高さが揃う。
      const left = list[0];
      const right = list.slice(1);
      return (
        <div className="grid gap-1" style={{ gridTemplateColumns: '2fr 1fr' }}>
          {/* 左（2行分を占有、セル高に合わせて画像をカバー） */}
          <div className="row-span-2 relative overflow-hidden rounded-md">
            <a href={`/album/${album.id}`} aria-label="アルバム詳細へ" className="absolute inset-0 block">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={left.thumbUrl || left.url}
                alt="image-0"
                loading="lazy"
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </a>
          </div>
          {/* 右上 */}
          <Box ratioW={1} ratioH={1} src={right[0].thumbUrl || right[0].url} alt={`image-1`} href={`/album/${album.id}`} />
          {/* 右下 */}
          <Box ratioW={1} ratioH={1} src={right[1].thumbUrl || right[1].url} alt={`image-2`} href={`/album/${album.id}`} />
        </div>
      );
    }

    // 4枚: 2x2 で全て 1:1
    return (
      <div className="grid grid-cols-2 gap-1">
        {list.map((img, i) => (
          <Box key={i} ratioW={1} ratioH={1} src={img.thumbUrl || img.url} alt={`image-${i}`} href={`/album/${album.id}`} />
        ))}
      </div>
    );
  }

  function toDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value === 'object' && typeof value.seconds === 'number') return new Date(value.seconds * 1000);
    if (typeof value === 'number') return new Date(value > 1e12 ? value : value * 1000);
    return null;
  }

  function fmtDateTime(dt: Date | null): string {
    if (!dt) return '';
    const y = dt.getFullYear();
    const m = String(dt.getMonth() + 1).padStart(2, '0');
    const d = String(dt.getDate()).padStart(2, '0');
    const hh = String(dt.getHours()).padStart(2, '0');
    const mm = String(dt.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${d} ${hh}:${mm}`;
  }

  return (
    <article className="py-4 space-y-3">        
      <header className="space-y-2">
        {repostedBy?.userId && (
          <div className="flex items-center gap-2">
            <a href={`/user/${repostedBy.user?.handle || repostedBy.userId}`} className="shrink-0" aria-label="リポスターのプロフィールへ">
              <Avatar src={repostedBy.user?.iconURL || undefined} size={28} interactive={false} withBorder={false} className="rounded-full" />
            </a>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm truncate">
                  {currentUserId && repostedBy.userId === currentUserId ? (
                    <>
                      <span className="font-medium">あなた</span>
                      <span className="text-muted/80"> がリポストしました</span>
                    </>
                  ) : (
                    <>
                      <span className="font-medium">{repostedBy.user?.displayName || (repostedBy.user?.handle ? `@${repostedBy.user.handle}` : repostedBy.userId.slice(0, 6))}</span>
                      <span className="text-muted/80"> さんがリポストしました</span>
                    </>
                  )}
                </span>
                {fmtDateTime(toDate(repostedBy.createdAt)) && (
                  <span className="text-xs text-muted/80 shrink-0">{fmtDateTime(toDate(repostedBy.createdAt))}</span>
                )}
              </div>
            </div>
          </div>
        )}
        {imageAdded?.userId && (
          <div className="flex items-center gap-2">
            <a href={`/user/${imageAdded.user?.handle || imageAdded.userId}`} className="shrink-0" aria-label="追加者のプロフィールへ">
              <Avatar src={imageAdded.user?.iconURL || undefined} size={28} interactive={false} withBorder={false} className="rounded-full" />
            </a>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm truncate">
                  <span className="font-medium">{imageAdded.user?.displayName || (imageAdded.user?.handle ? `@${imageAdded.user.handle}` : imageAdded.userId.slice(0, 6))}</span>
                  <span className="text-muted/80"> さんが画像を追加しました</span>
                </span>
                {fmtDateTime(toDate(imageAdded.createdAt)) && (
                  <span className="text-xs text-muted/80 shrink-0">{fmtDateTime(toDate(imageAdded.createdAt))}</span>
                )}
              </div>
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <a href={`/user/${owner?.handle || album.ownerId}`} className="shrink-0" aria-label="プロフィールへ">
            <Avatar src={owner?.iconURL || undefined} size={48} interactive={false} withBorder={false} className="rounded-full" />
          </a>
          <div className="min-w-0">
            <a
              href={`/user/${owner?.handle || album.ownerId}`}
              className="flex flex-col leading-tight"
              title={`${owner?.displayName || '名前未設定'} ${owner?.handle ? `@${owner.handle}` : ''}`.trim()}
            >
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold truncate">{owner?.displayName || '名前未設定'}</span>
                {isFriend && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-friend text-white shrink-0" title="フレンド">フレンド</span>
                )}
                {isWatched && (
                  <span className="text-[11px] px-2 py-0.5 rounded bg-watch text-white shrink-0" title="ウォッチ中">ウォッチ中</span>
                )}
              </div>
              <span className="text-sm text-muted/80">{owner?.handle ? `@${owner.handle}` : 'ハンドル未設定'}</span>
              {fmtDateTime(toDate(album.createdAt)) && (
                <span className="text-xs text-muted/80">{fmtDateTime(toDate(album.createdAt))}</span>
              )}
            </a>
          </div>

          <div className="ml-auto relative">
            <button
              ref={menuBtnRef}
              type="button"
              aria-label="メニュー"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="w-8 h-8 rounded border border-line hover:bg-surface-weak text-muted"
              onClick={() => setMenuOpen((o) => !o)}
            >
              ⋯
            </button>
            {menuOpen && (
              <div
                ref={menuRef}
                role="menu"
                className="absolute right-0 top-full mt-2 w-40 rounded border border-line bg-background shadow-lg z-50 overflow-hidden"
              >
                {currentUserId && currentUserId === album.ownerId && (
                  <button
                    type="button"
                    role="menuitem"
                    className="w-full text-left px-3 py-2 text-sm hover:bg-surface-weak"
                    onClick={() => {
                      setMenuOpen(false);
                      onRequestDelete?.(album.id);
                    }}
                  >
                    削除する
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surface-weak"
                  onClick={() => {
                    setMenuOpen(false);
                    onRequestReport?.(album.id);
                  }}
                >
                  通報する
                </button>
              </div>
            )}
          </div>
        </div>
        {album.title && (
          <h3 className="text-base font-semibold flex items-center gap-2">
            <a href={`/album/${album.id}`}>{album.title}</a>
          </h3>
        )}
      </header>

      <div className={`overflow-hidden rounded ${isFriend ? 'bg-friend/10 p-1' : isWatched ? 'bg-watch/10 p-1' : ''}`}>
        {renderGrid(images)}
      </div>

      <div className="flex items-center gap-3">
        {/* Like with hover popover */}
        <div
          className="relative flex items-center gap-1"
          onMouseEnter={() => { setLikersOpen(true); ensureLikers(); ensureMe(); }}
          onMouseLeave={() => setLikersOpen(false)}
        >
          <button
            aria-label={liked ? "いいね済み" : "いいね"}
            aria-pressed={liked}
            className={`${liked ? "text-pink-600" : "text-muted"}`}
            onClick={() => onLike?.()}
          >
            <HeartIcon filled={liked} size={20} />
          </button>
          <span className="text-xs text-muted/80">{likeCount}</span>
          {likersOpen && (
            <div className="absolute left-0 top-full mt-1 w-64 rounded border border-line bg-background shadow-lg z-40">
              <div className="p-2">
                <p className="text-[11px] text-muted/80 mb-1">いいねした人</p>
                {likersLoading && <p className="text-xs text-muted/80">読み込み中...</p>}
                {!likersLoading && (
                  (viewLikers && viewLikers.length > 0) ? (
                    <ul className="max-h-64 overflow-auto divide-y divide-line">
                      {viewLikers.map((u) => {
                        const name = u.displayName || '名前未設定';
                        return (
                        <li key={u.uid}>
                          <a href={`/user/${u.handle || u.uid}`} className="flex items-center gap-2 px-2 py-1 hover:bg-surface-weak">
                            {u.iconURL ? (
                              <img src={u.iconURL} alt="" className="h-5 w-5 rounded-full object-cover" />
                            ) : (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface-weak text-[10px] text-muted">{u.displayName?.[0] || '?'}</span>
                            )}
                            <span className="text-sm font-medium">{name}</span>
                            {u.handle && <span className="text-[11px] text-muted/80">@{u.handle}</span>}
                          </a>
                        </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted/80">まだいません</p>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Repost with hover popover */}
        <div
          className="relative flex items-center gap-1"
          onMouseEnter={() => { setRepostersOpen(true); ensureReposters(); ensureMe(); }}
          onMouseLeave={() => setRepostersOpen(false)}
        >
          <button
            aria-label={reposted ? "リポスト済み" : "リポスト"}
            aria-pressed={reposted}
            className={`${reposted ? "text-green-600" : "text-muted"}`}
            onClick={() => onToggleRepost?.()}
          >
            <RepostIcon filled={reposted} size={20} />
          </button>
          <span className="text-xs text-muted/80">{repostCount}</span>
          {repostersOpen && (
            <div className="absolute left-0 top-full mt-1 w-64 rounded border border-line bg-background shadow-lg z-40">
              <div className="p-2">
                <p className="text-[11px] text-muted/80 mb-1">リポストした人</p>
                {repostersLoading && <p className="text-xs text-muted/80">読み込み中...</p>}
                {!repostersLoading && (
                  (viewReposters && viewReposters.length > 0) ? (
                    <ul className="max-h-64 overflow-auto divide-y divide-line">
                      {viewReposters.map((u) => {
                        const name = u.displayName || '名前未設定';
                        return (
                        <li key={u.uid}>
                          <a href={`/user/${u.handle || u.uid}`} className="flex items-center gap-2 px-2 py-1 hover:bg-surface-weak">
                            {u.iconURL ? (
                              <img src={u.iconURL} alt="" className="h-5 w-5 rounded-full object-cover" />
                            ) : (
                              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface-weak text-[10px] text-muted">{u.displayName?.[0] || '?'}</span>
                            )}
                            <span className="text-sm font-medium">{name}</span>
                            {u.handle && <span className="text-[11px] text-muted/80">@{u.handle}</span>}
                          </a>
                        </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted/80">まだいません</p>
                  )
                )}
              </div>
            </div>
          )}
        </div>
        {onCommentSubmit && (
          <button
            type="button"
            aria-label="コメント入力を開閉"
            className={`text-muted ${showCommentBox ? 'opacity-100' : 'opacity-80'}`}
            onClick={() => setShowCommentBox((v) => !v)}
          >
            <ChatIcon size={20} />
          </button>
        )}
  <span className="text-xs text-muted/80">{commentCount}</span>
      </div>

      {/* リアクション（簡易版：1以上のみ表示、クリックでトグル、ホバーでユーザー一覧） */}
      <div className="flex items-center gap-2 flex-wrap relative">
        {reactions.length > 0 && (
        <>
          {reactions.filter(r => r.count > 0).map((r) => (
            <div key={r.emoji} className="relative" onMouseEnter={() => onChipEnter(r.emoji)} onMouseLeave={onChipLeave}>
              <button
                type="button"
                aria-label={`リアクション ${r.emoji}`}
                aria-pressed={r.mine}
                onClick={() => { 
                  onToggleReaction?.(r.emoji);
                  // 現在ホバー表示中ならリストも更新
                  if (hoveredEmoji === r.emoji) {
                    refreshReactorList(r.emoji);
                  }
                }}
                className={`rounded border px-2 py-1 text-sm ${r.mine ? "border-blue-600 bg-background text-blue-700" : "border-line bg-background text-muted"}`}
              >{r.emoji} <span className="text-xs">{r.count}</span></button>
              {hoveredEmoji === r.emoji && (
                <div className="absolute left-0 top-full mt-1 w-64 rounded border border-line bg-background shadow-lg z-40">
                  <div className="p-2">
                    <p className="text-[11px] text-muted/80 mb-1">このリアクションをした人</p>
                    {reactorLoading[r.emoji] && <p className="text-xs text-muted/80">読み込み中...</p>}
                    {!reactorLoading[r.emoji] && (
                      (reactorMap[r.emoji] && reactorMap[r.emoji]!.length > 0) ? (
                        <ul className="max-h-64 overflow-auto divide-y divide-line">
                          {reactorMap[r.emoji]!.map((u) => {
                            const name = u.displayName || '名前未設定';
                            return (
                              <li key={u.uid}>
                                <a href={`/user/${u.handle || u.uid}`} className="flex items-center gap-2 px-2 py-1 hover:bg-surface-weak">
                                  {u.iconURL ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={u.iconURL} alt="" className="h-5 w-5 rounded-full object-cover" />
                                  ) : (
                                    <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-surface-weak text-[10px] text-muted">{u.displayName?.[0] || '?'}</span>
                                  )}
                                  <span className="text-sm font-medium">{name}</span>
                                  {u.handle && <span className="text-[11px] text-muted/80">@{u.handle}</span>}
                                </a>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <p className="text-xs text-muted/80">まだいません</p>
                      )
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </>
        )}
        {/* 追加用ピッカー */}
        <button
          ref={pickerBtnRef}
          type="button"
          aria-label="リアクションを追加"
          disabled={!onToggleReaction}
          onClick={() => setPickerOpen((o) => !o)}
          className="px-1 text-lg leading-none text-muted disabled:opacity-50"
        >＋</button>
        {pickerOpen && (
          <div ref={pickerRef} className="absolute top-full left-0 mt-2 w-80 bg-background border border-line rounded shadow-lg p-2 z-50">
            <p className="text-xs text-muted mb-2">絵文字を選択してください（再選択で解除）</p>
            <input
              autoFocus
              value={emojiQuery}
              onChange={(e)=> setEmojiQuery(e.target.value)}
              placeholder="検索（例: ハート / fire / 👍 を貼付）"
              className="mb-2 w-full border-b-2 border-blue-500 bg-transparent p-1 text-sm focus:outline-none"
            />
            {/* カテゴリタブ（検索時は非表示） */}
            {!emojiQuery && (
              <div className="mb-2 flex flex-wrap gap-1">
                {REACTION_CATEGORIES.map(cat => (
                  <button
                    key={cat.key}
                    type="button"
                    aria-label={cat.label}
                    title={cat.label}
                    onClick={() => setActiveCat(cat.key)}
                    className={`flex items-center justify-center w-8 h-8 text-lg rounded border ${activeCat===cat.key ? 'bg-blue-600 text-white border-blue-600' : 'bg-background text-muted border-line'}`}
                  >{cat.icon}</button>
                ))}
              </div>
            )}
            <div className="max-h-64 overflow-auto">
              <div className="grid grid-cols-6 gap-2">
              {(emojiQuery ? filteredEmojis : categoryEmojis).map((e) => {
                const rec = reactions.find((x) => x.emoji === e);
                const mine = !!rec?.mine;
                return (
                  <button
                    key={e}
                    type="button"
                    aria-label={`リアクション ${e}`}
                    aria-pressed={mine}
                    onClick={() => { onToggleReaction?.(e); setPickerOpen(false); }}
                    className={`rounded border px-2 py-1 text-sm ${mine ? "border-blue-600 bg-blue-600 text-white" : "border-line bg-background text-muted"}`}
                  >{e}</button>
                );
              })}
              </div>
            </div>
          </div>
        )}
      </div>

      {commentsPreview && commentsPreview.length > 0 && (
  <div className="mt-2 border-l border-line pl-3 space-y-2">
          {commentsPreview.slice(0, 3).map((c, idx) => {
            const u = c.user;
            const name = u?.displayName || '名前未設定';
            const icon = u?.iconURL || undefined;
            const text = (() => {
              const s = (c.body || '').toString();
              return s.length > 30 ? s.slice(0, 30) + '…' : s;
            })();
            function toDate(x: any): Date | null {
              if (!x) return null;
              if (x instanceof Date) return x;
              if (typeof x === 'object' && typeof x.seconds === 'number') return new Date(x.seconds * 1000);
              if (typeof x === 'number') return new Date(x > 1e12 ? x : x * 1000);
              return null;
            }
            function fmt(dt: Date | null): string {
              if (!dt) return '';
              const y = dt.getFullYear();
              const m = String(dt.getMonth() + 1).padStart(2, '0');
              const d = String(dt.getDate()).padStart(2, '0');
              const hh = String(dt.getHours()).padStart(2, '0');
              const mm = String(dt.getMinutes()).padStart(2, '0');
              return `${y}/${m}/${d} ${hh}:${mm}`;
            }
            const timeText = fmt(toDate(c.createdAt));
            return (
              <div key={idx} className="flex items-center gap-3">
                <a href={`/user/${u?.handle || c.userId}`} className="shrink-0" aria-label="プロフィールへ">
                  <Avatar src={icon} size={40} interactive={false} withBorder={false} className="rounded-full" />
                </a>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 truncate">
                    <a href={`/user/${u?.handle || c.userId}`} className="text-sm font-medium truncate">{name}</a>
                    {u?.handle && <span className="text-xs text-muted/80 shrink-0">@{u.handle}</span>}
                    {timeText && <span className="text-xs text-muted/80 shrink-0">{timeText}</span>}
                  </div>
                  <p className="text-sm truncate">{text}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {onCommentSubmit && showCommentBox && (
        <div className="flex items-center gap-2">
          <input
            aria-label="コメント入力"
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="flex-1 input-underline text-sm"
            placeholder="コメントを書く"
          />
          <Button
            type="button"
            variant="accent"
            size="sm"
            onClick={submit}
            disabled={busy || submitting || !text.trim()}
          >
            送信
          </Button>
        </div>
      )}
    </article>
  );
}
