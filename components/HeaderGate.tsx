"use client";
import { usePathname } from 'next/navigation';
import Header from './Header';

export default function HeaderGate() {
  const pathname = usePathname();
  if (pathname === '/') return null; // Hide header on login page
  return <Header />;
}
