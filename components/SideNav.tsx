"use client";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAuthUser } from '@/lib/hooks/useAuthUser';
import { useNotificationsBadge } from '@/lib/hooks/useNotificationsBadge';
import { getUser } from '@/lib/repos/userRepo';
import Avatar from '@/components/profile/Avatar';
import React from 'react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

type Item = { key: string; href: string; label: string; icon: React.ReactNode; badge?: boolean };

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 10.5L12 3l9 7.5"/>
      <path d="M5 10.5V21h14V10.5"/>
    </svg>
  );
}
function IconSearch() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7"/>
      <path d="M20 20l-3.5-3.5"/>
    </svg>
  );
}
function IconBell() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 9a6 6 0 1112 0c0 4 1.5 5.5 1.5 5.5H4.5S6 13 6 9z"/>
      <path d="M10 20a2 2 0 004 0"/>
    </svg>
  );
}
function IconPlus() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 5v14"/>
      <path d="M5 12h14"/>
    </svg>
  );
}
function IconKey() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="8" cy="11" r="3"/>
      <path d="M11 11h10l-2 2 2 2"/>
    </svg>
  );
}
function IconGear() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 0010 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 005.4 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 005.4 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 5.4a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09c0 .67.39 1.28 1 1.51a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0018.6 9c.67 0 1.28.39 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

function makeItems(authed: boolean): Item[] {
  const arr: Item[] = [
    { key: 'home', href: '/timeline', label: 'タイムライン', icon: <IconHome /> },
    { key: 'search', href: '/search', label: '検索', icon: <IconSearch /> },
    { key: 'notification', href: '/notification', label: '通知', icon: <IconBell />, badge: true },
    { key: 'new', href: '/album/new', label: '作成', icon: <IconPlus /> },
  ];
  if (!authed) {
    arr.push({ key: 'login', href: '/login', label: 'ログイン', icon: <IconKey /> });
  }
  return arr;
}

export default function SideNav() {
  const path = usePathname();
  const { user } = useAuthUser();
  const unread = useNotificationsBadge();
  const [profileDoc, setProfileDoc] = useState<any | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const gearBtnRef = useRef<HTMLButtonElement | null>(null);
  const hide = path === '/' || path === '/login';
  const [mounted, setMounted] = useState(false);
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

  // theme handling
  const theme = useMemo(() => {
    if (typeof window === 'undefined') return 'light';
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }, []);
  const [currentTheme, setCurrentTheme] = useState<string>(theme);
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.classList.remove('theme-light', 'theme-dark');
    root.classList.add(currentTheme === 'dark' ? 'theme-dark' : 'theme-light');
    try { localStorage.setItem('theme', currentTheme); } catch {}
  }, [currentTheme]);

  const toggleTheme = () => setCurrentTheme(t => t === 'dark' ? 'light' : 'dark');

  const handle = profileDoc?.handle as string | undefined;
  const items = makeItems(!!user);

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

  if (!mounted || hide) return null;

  const iconColorClass = currentTheme === 'dark' ? 'text-white' : 'text-black';

  return (
    <nav aria-label="メインナビ" className="hidden sm:flex w-16 shrink-0 flex-col items-center gap-3 py-3 border-r border-base sticky top-0 h-dvh sidenav-bg">
      {/* Profile on top */}
      <div className="mt-1 mb-1">
        <Link
          href={user && handle ? `/user/${handle}` : (user ? `/user/${user.uid}` : '/login')}
          title="プロフィール"
          aria-label="プロフィール"
          className="flex items-center justify-center w-12 h-12 rounded-lg hover-surface-alt focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent]"
        >
          <Avatar size={40} src={profileDoc?.iconURL || undefined} alt="プロフィール" interactive={false} withBorder={false} />
        </Link>
      </div>
      {items.map((it) => {
        const active = path?.startsWith(it.href);
        const isNew = it.key === 'new';
        const iconClass = isNew ? 'text-white' : iconColorClass;
        return (
          <Link
            key={it.key}
            href={it.href}
            title={it.label}
            aria-label={it.label}
            className={`relative flex items-center justify-center w-12 h-12 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[--accent] ${isNew ? 'btn-accent-square' : 'hover-surface-alt'} ${!isNew && active ? 'surface-alt' : ''}`}
          >
            <span className={`text-xl leading-none ${iconClass}`} aria-hidden>
              {it.icon}
            </span>
            {it.badge && unread > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-600 text-white text-[10px] leading-none rounded-full px-1.5 py-0.5">
                {unread}
              </span>
            )}
          </Link>
        );
      })}
      {/* Spacer to push settings to bottom */}
      <div className="flex-1" />
      {/* Settings (gear) */}
      <div className="relative">
        <button
          type="button"
          ref={gearBtnRef}
          className="relative flex items-center justify-center w-12 h-12 rounded-lg hover-surface-alt"
          aria-label="設定"
          title="設定"
          onClick={() => setMenuOpen(o => !o)}
        >
          <span className={`text-xl ${iconColorClass}`} aria-hidden><IconGear /></span>
        </button>
        {menuOpen && (
          <div ref={menuRef} className="absolute bottom-14 left-0 z-50 surface border border-base rounded-md shadow-md min-w-40 p-2">
            <button type="button" className="w-full text-left px-2 py-1 rounded hover-surface-alt" onClick={toggleTheme}>
              {currentTheme === 'dark' ? 'ライトモードへ' : 'ダークモードへ'}
            </button>
            {user && (
              <button type="button" className="w-full text-left px-2 py-1 rounded hover-surface-alt text-red-600" onClick={() => { signOut(auth).catch(()=>{}); setMenuOpen(false); }}>
                ログアウト
              </button>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
