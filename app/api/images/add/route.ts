export const runtime = 'nodejs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { canUploadMoreImages } from '@/lib/repos/imageRepo';
import { adminAddImage } from '@/src/repositories/admin/firestore';
import { getAlbumSafe } from '@/lib/repos/albumRepo';
import { getFriendStatus } from '@/lib/repos/friendRepo';
import { verifyIdToken } from '@/src/libs/firebaseAdmin';

// simple rate limit per IP: 10 req / 60s
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const buckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_LIMIT_MAX) return false;
  b.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!rateLimit(`image:add:${ip}`)) {
      return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
    }
    const auth = req.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('images:add no token; allowing in dev');
      } else {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }
    const decoded = token ? await verifyIdToken(token) : null;

    const json = await req.json().catch(() => null);
    const albumId = json?.albumId as string | undefined;
    const userId = json?.userId as string | undefined;
    const url = json?.url as string | undefined;
    if (!albumId || !userId || !url) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }
    if (decoded && decoded.uid !== userId) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    const album = await getAlbumSafe(albumId);
    if (!album) return NextResponse.json({ error: 'ALBUM_NOT_FOUND' }, { status: 404 });
    const isOwner = album.ownerId === userId;
    let isFriend = false;
    try {
      const [forward, backward] = await Promise.all([
        getFriendStatus(userId, album.ownerId),
        getFriendStatus(album.ownerId, userId),
      ]);
      isFriend = (forward === 'accepted') || (backward === 'accepted');
    } catch {}

    if (!(isOwner || isFriend)) {
      return NextResponse.json({ error: 'NO_PERMISSION' }, { status: 403 });
    }

    const allow = await canUploadMoreImages(albumId, userId);
    if (!allow) {
      return NextResponse.json({ error: 'LIMIT_EXCEEDED' }, { status: 400 });
    }

  await adminAddImage(albumId, userId, url);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'UNKNOWN' }, { status: 500 });
  }
}
