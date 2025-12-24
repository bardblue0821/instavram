export const runtime = 'nodejs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { canUploadMoreImages } from '@/lib/repos/imageRepo';
import { adminAddImage } from '@/src/repositories/admin/firestore';
import { getAlbumSafe } from '@/lib/repos/albumRepo';
import { getFriendStatus } from '@/lib/repos/friendRepo';
import { verifyIdToken } from '@/src/libs/firebaseAdmin';

// simple rate limit per IP: 20 req / 60s (higher than add endpoint due to batch uploads)
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
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

/**
 * POST /api/images/register
 * 既に Storage にアップロード済みの画像を Firestore に登録する
 * AlbumImageUploader から呼ばれる
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!rateLimit(`image:register:${ip}`)) {
      console.warn('[images:register] rate limited:', ip);
      return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
    }
    
    const auth = req.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      if (process.env.NODE_ENV !== 'production') {
        console.warn('images:register no token; allowing in dev');
      } else {
        console.warn('[images:register] unauthorized: no token');
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
    }
    const decoded = token ? await verifyIdToken(token) : null;
    console.log('[images:register] decoded user:', decoded?.uid);

    const json = await req.json().catch(() => null);
    const albumId = json?.albumId as string | undefined;
    const userId = json?.userId as string | undefined;
    const url = json?.url as string | undefined;
    const thumbUrl = json?.thumbUrl as string | undefined;
    
    console.log('[images:register] request:', { albumId, userId, hasUrl: !!url, hasThumbUrl: !!thumbUrl });
    
    if (!albumId || !userId || !url) {
      console.warn('[images:register] invalid input:', { albumId, userId, hasUrl: !!url });
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }
    if (decoded && decoded.uid !== userId) {
      console.warn('[images:register] forbidden: uid mismatch:', { decoded: decoded.uid, userId });
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }

    // アルバムの存在と権限をチェック
    const album = await getAlbumSafe(albumId);
    if (!album) {
      console.warn('[images:register] album not found:', albumId);
      return NextResponse.json({ error: 'ALBUM_NOT_FOUND' }, { status: 404 });
    }
    
    const isOwner = album.ownerId === userId;
    let isFriend = false;
    try {
      const [forward, backward] = await Promise.all([
        getFriendStatus(userId, album.ownerId),
        getFriendStatus(album.ownerId, userId),
      ]);
      isFriend = (forward === 'accepted') || (backward === 'accepted');
    } catch (e) {
      console.warn('[images:register] friend status check failed:', e);
    }

    console.log('[images:register] permissions:', { isOwner, isFriend, albumOwnerId: album.ownerId });

    if (!(isOwner || isFriend)) {
      console.warn('[images:register] no permission');
      return NextResponse.json({ error: 'NO_PERMISSION' }, { status: 403 });
    }

    // アップロード上限チェック
    const allow = await canUploadMoreImages(albumId, userId);
    if (!allow) {
      console.warn('[images:register] limit exceeded');
      return NextResponse.json({ error: 'LIMIT_EXCEEDED' }, { status: 400 });
    }

    // Admin SDK で Firestore に登録
    console.log('[images:register] calling adminAddImage');
    await adminAddImage(albumId, userId, url, thumbUrl);
    
    console.log('[images:register] success');
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error('[images:register] error:', e);
    return NextResponse.json({ error: e?.message || 'UNKNOWN' }, { status: 500 });
  }
}
