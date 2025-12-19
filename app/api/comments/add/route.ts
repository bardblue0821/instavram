import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { addComment } from '@/lib/repos/commentRepo';

// very simple in-memory rate limit (per IP): 10 req / 60s
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 10;
const commentBuckets = new Map<string, { count: number; resetAt: number }>();

function rateLimit(key: string): boolean {
  const now = Date.now();
  const b = commentBuckets.get(key);
  if (!b || now > b.resetAt) {
    commentBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (b.count >= RATE_LIMIT_MAX) return false;
  b.count += 1;
  return true;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!rateLimit(`comment:${ip}`)) {
      return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
    }
    const json = await req.json().catch(() => null);
    const albumId = json?.albumId as string | undefined;
    const userId = json?.userId as string | undefined;
    const body = (json?.body as string | undefined)?.trim();
    if (!albumId || !userId || !body) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }
    if (body.length > 1000) {
      return NextResponse.json({ error: 'COMMENT_TOO_LONG' }, { status: 400 });
    }
    await addComment(albumId, userId, body);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'UNKNOWN' }, { status: 500 });
  }
}
