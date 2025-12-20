export const runtime = 'nodejs';

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { verifyIdToken } from '@/src/libs/firebaseAdmin';

// very simple in-memory rate limit (per IP): 5 req / 60s
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
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

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`MISSING_ENV:${name}`);
  return v;
}

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    if (!rateLimit(`report:${ip}`)) {
      return NextResponse.json({ error: 'RATE_LIMITED' }, { status: 429 });
    }

    const auth = req.headers.get('authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    if (!token) {
      if (process.env.NODE_ENV !== 'production') {
        return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
      }
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const decoded = await verifyIdToken(token);
    const reporterUid = decoded?.uid;
    if (!reporterUid) {
      return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
    }

    const json = await req.json().catch(() => null);
    const albumId = json?.albumId as string | undefined;
    const albumUrl = json?.albumUrl as string | undefined;
    if (!albumId || !albumUrl) {
      return NextResponse.json({ error: 'INVALID_INPUT' }, { status: 400 });
    }

    const host = requiredEnv('REPORT_SMTP_HOST');
    const port = Number(process.env.REPORT_SMTP_PORT || '587');
    const secure = String(process.env.REPORT_SMTP_SECURE || '').toLowerCase() === 'true';
    const user = requiredEnv('REPORT_SMTP_USER');
    const pass = requiredEnv('REPORT_SMTP_PASS');
    const to = process.env.REPORT_TO || 'bardblue0821@gmail.com';
    const from = process.env.REPORT_FROM || user;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });

    const subject = `【通報】アルバム ${albumId}`;
    const text = [
      'アルバム通報を受け取りました。',
      '',
      `albumId: ${albumId}`,
      `url: ${albumUrl}`,
      `reporterUid: ${reporterUid}`,
      `reportedAt: ${new Date().toISOString()}`,
      '',
      'このメールはアプリから自動送信されました。',
    ].join('\n');

    await transporter.sendMail({
      to,
      from,
      subject,
      text,
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    // ログに残して原因特定しやすくする（秘密情報は含めないよう注意）
    console.error('[reports/album] error', {
      message: e?.message,
      code: e?.code,
      name: e?.name,
    });
    if (e?.stack) console.error(e.stack);

    const msg = typeof e?.message === 'string' && e.message ? e.message : 'UNKNOWN';

    // 典型: .env 未設定
    if (msg.startsWith('MISSING_ENV:')) {
      const missing = msg.slice('MISSING_ENV:'.length);
      return NextResponse.json(
        {
          error: msg,
          hint: '通報メール送信の環境変数が未設定です。.env.local を設定して dev サーバーを再起動してください。',
          missingEnv: missing,
          requiredEnvs: ['REPORT_SMTP_HOST', 'REPORT_SMTP_PORT', 'REPORT_SMTP_SECURE', 'REPORT_SMTP_USER', 'REPORT_SMTP_PASS', 'REPORT_TO', 'REPORT_FROM'],
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
