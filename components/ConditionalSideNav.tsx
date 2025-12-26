"use client";
import { usePathname } from 'next/navigation';
import SideNav from './SideNav';

export default function ConditionalSideNav() {
  const pathname = usePathname();
  
  // 公開ページ（認証不要ページ）ではSideNavを非表示
  // register ページも追加
  const publicPaths = new Set<string>(['/', '/login', '/register', '/forgot-password', '/reset-password']);
  const isPublicPage = publicPaths.has(pathname) || pathname.startsWith('/register/');
  
  if (isPublicPage) {
    return null;
  }
  
  return <SideNav />;
}
