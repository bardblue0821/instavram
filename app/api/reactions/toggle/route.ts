export const runtime = 'nodejs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
// import { toggleReaction } from '@/lib/repos/reactionRepo';
import { adminToggleReaction } from '@/src/repositories/admin/firestore';
import { verifyIdToken } from '@/src/libs/firebaseAdmin';

// very simple in-memory rate limit (per IP): 20 req / 60s
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

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!rateLimit(`reaction:${ip}`)) {
      return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
    }
    const json = await req.json().catch(() => null);
    const albumId = json?.albumId as string | undefined;
    const userId = json?.userId as string | undefined;
    const emoji = json?.emoji as string | undefined;
    if (!albumId || !userId || !emoji) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }
    const auth = req.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }
    const decoded = await verifyIdToken(token);
    if (!decoded || decoded.uid !== userId) {
      return NextResponse.json({ error: 'FORBIDDEN' }, { status: 403 });
    }
  const result = await adminToggleReaction(albumId, userId, emoji);
    // result has shape { added: boolean } in repo
    return NextResponse.json({ ok: true, added: !!(result as any)?.added });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'UNKNOWN' }, { status: 500 });
  }
}
