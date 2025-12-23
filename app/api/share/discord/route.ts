import { NextResponse } from 'next/server';

// Simple in-memory rate limit per IP
const limits = new Map<string, { count: number; ts: number }>();

function checkRate(ip: string | undefined): boolean {
  if (!ip) return true;
  const now = Date.now();
  const rec = limits.get(ip);
  if (!rec || now - rec.ts > 60_000) {
    limits.set(ip, { count: 1, ts: now });
    return true;
  }
  if (rec.count < 10) { rec.count += 1; return true; }
  return false;
}

export async function POST(req: Request) {
  try {
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0]?.trim() || undefined;
    if (!checkRate(ip)) {
      return NextResponse.json({ error: 'RATE_LIMIT' }, { status: 429 });
    }

    const body = await req.json().catch(() => null) as any;
    const webhookUrl = String(body?.webhookUrl || '').trim();
    const albumUrl = String(body?.albumUrl || '').trim();
    const message = String(body?.message || '').trim() || 'アルバムを共有します';

    if (!webhookUrl || !/^https:\/\/discord\.com\/api\/webhooks\//.test(webhookUrl)) {
      return NextResponse.json({ error: 'INVALID_WEBHOOK_URL' }, { status: 400 });
    }
    if (!albumUrl || !/^https?:\/\//.test(albumUrl)) {
      return NextResponse.json({ error: 'INVALID_ALBUM_URL' }, { status: 400 });
    }

    const payload = { content: `${message}\n${albumUrl}` };
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(()=> '');
      return NextResponse.json({ error: 'WEBHOOK_POST_FAILED', hint: text.slice(0, 300) }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'UNKNOWN_ERROR' }, { status: 500 });
  }
}
