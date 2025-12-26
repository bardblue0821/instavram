"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { useNotificationsBadge } from '@/lib/hooks/useNotificationsBadge';
import { getUser } from '@/lib/repos/userRepo';
import Avatar from '@/components/profile/Avatar';
import { Button } from '@/components/ui/Button';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

function IconHome() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5L12 3l9 7.5"/>
      <path d="M5 10.5V21h14V10.5"/>
    </svg>
  );
}

function IconSearch() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7"/>
      <path d="M20 20l-3.5-3.5"/>
    </svg>
  );
}

function IconBell() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9a6 6 0 1112 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9z"/>
      <path d="M10 20a2 2 0 004 0"/>
    </svg>
  );
}

function IconPlus() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14"/>
      <path d="M5 12h14"/>
    </svg>
  );
}

function IconGear() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 0010 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 005.4 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 005.4 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 5.4a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09c0 .67.39 1.28 1 1.51a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0018.6 9c.67 0 1.28.39 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

export default function MobileTopNav() {
  const { user } = useAuthUser();
  const unread = useNotificationsBadge();
  const [profileDoc, setProfileDoc] = useState<any | null>(null);
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const gearBtnRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!user) { setProfileDoc(null); return; }
      const doc = await getUser(user.uid);
      if (active) setProfileDoc(doc);
    })();
    return () => { active = false; };
  }, [user?.uid]);

  // Close gear menu on outside click or Escape
  useEffect(() => {
    if (!menuOpen) return;
    function handleMouseDown(e: MouseEvent) {
      const target = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(target) && gearBtnRef.current && !gearBtnRef.current.contains(target)) {
        setMenuOpen(false);
      }
    }
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') setMenuOpen(false); }
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  // 公開ページでは非表示
  const publicPaths = new Set<string>(['/', '/login', '/register', '/forgot-password', '/reset-password']);
  const isPublicPage = publicPaths.has(pathname) || pathname.startsWith('/register/');

  if (!mounted || !user || isPublicPage) return null;

  const handle = profileDoc?.handle as string | undefined;

  // 左から: アルバム作成、ホーム、検索、通知、設定
  const navItems = [
    { key: 'new', href: '/album/new', label: '作成', icon: <IconPlus />, isAccent: true },
    { key: 'home', href: '/timeline', label: 'タイムライン', icon: <IconHome /> },
    { key: 'search', href: '/search', label: '検索', icon: <IconSearch /> },
    { key: 'notification', href: '/notification', label: '通知', icon: <IconBell />, hasBadge: true },
  ];

  return (
    <nav 
      className="sm:hidden fixed bottom-0 left-0 right-0 z-50 sidenav-bg border-t border-line"
      aria-label="モバイルナビゲーション"
    >
      <div className="flex items-center justify-between px-2 py-2">
        {/* ナビゲーション項目とプロフィールを均等配置 */}
        <div className="flex items-center justify-around flex-1 gap-1">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                title={item.label}
                aria-label={item.label}
                className={`relative flex items-center justify-center w-12 h-12 rounded-lg transition-colors ${
                  item.isAccent 
                    ? 'btn-accent-square text-white' 
                    : isActive 
                      ? 'bg-surface-weak' 
                      : 'hover:bg-surface-weak'
                }`}
              >
                <span className="text-xl" aria-hidden>
                  {item.icon}
                </span>
                {item.hasBadge && unread > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] leading-none rounded-full px-1.5 py-0.5 min-w-[18px] text-center">
                    {unread > 99 ? '99+' : unread}
                  </span>
                )}
              </Link>
            );
          })}
          
          {/* 設定アイコン */}
          <div className="relative">
            <button
              type="button"
              ref={gearBtnRef}
              className={`relative flex items-center justify-center w-12 h-12 rounded-lg transition-colors ${
                pathname.startsWith('/user/') ? 'bg-surface-weak' : 'hover:bg-surface-weak'
              }`}
              aria-label="設定"
              title="設定"
              onClick={() => setMenuOpen(o => !o)}
            >
              <span className="text-xl" aria-hidden>
                <IconGear />
              </span>
            </button>
            {menuOpen && (
              <div ref={menuRef} className="absolute bottom-16 right-0 z-50 bg-background border border-line rounded-md shadow-md min-w-40 p-2">
                {user && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    fullWidth
                    className="border-0 bg-transparent hover:bg-transparent justify-start text-red-600"
                    onClick={() => {
                      signOut(auth).catch(() => {});
                      setMenuOpen(false);
                    }}
                  >
                    ログアウト
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* ユーザーアバター */}
          <Link
            href={handle ? `/user/${handle}` : `/user/${user.uid}`}
            title="プロフィール"
            aria-label="プロフィール"
            className="flex items-center justify-center"
          >
            <Avatar 
              size={40} 
              src={profileDoc?.iconURL || undefined} 
              alt="プロフィール" 
              interactive={true}
              withBorder={true}
            />
          </Link>
        </div>
      </div>
    </nav>
  );
}
