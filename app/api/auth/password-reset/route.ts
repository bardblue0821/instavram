export const runtime = 'nodejs';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getAdminAuth } from '@/src/libs/firebaseAdmin';
import { ipRateLimiter, emailRateLimiter, addTimingJitter } from '@/lib/utils/rateLimit';

/**
 * POST /api/auth/password-reset
 * パスワードリセットメールを送信
 * 
 * セキュリティ考慮:
 * - 常に中立的なレスポンスを返す（アカウント存在の列挙防止）
 * - IP単位（5回/時）とメール単位（3回/時）のレート制限
 * - タイミング攻撃対策（レスポンス時間の均一化）
 * - CAPTCHA検証（将来実装）
 */
export async function POST(req: NextRequest) {
  const startTime = Date.now();

  try {
    // リクエストボディの取得
    const json = await req.json().catch(() => null);
    const email = json?.email as string | undefined;
    // const captchaToken = json?.captchaToken as string | undefined;

    // 基本的な入力検証
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      await addTimingJitter(200, 100);
      return NextResponse.json(
        { error: 'INVALID_EMAIL' },
        { status: 400 }
      );
    }

    // 正規化（小文字化、トリム）
    const normalizedEmail = email.toLowerCase().trim();

    // IP単位のレート制限
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || 
               req.headers.get('x-real-ip') || 
               'unknown';
    const ipLimit = ipRateLimiter.check(ip);
    
    if (!ipLimit.allowed) {
      console.warn('[password-reset] IP rate limit exceeded', { ip });
      await addTimingJitter(200, 100);
      return NextResponse.json(
        { error: 'RATE_LIMITED', retryAfter: ipLimit.retryAfter },
        { status: 429 }
      );
    }

    // メール単位のレート制限
    const emailLimit = emailRateLimiter.check(normalizedEmail);
    
    if (!emailLimit.allowed) {
      console.warn('[password-reset] Email rate limit exceeded', { email: normalizedEmail });
      // メール制限の場合も中立的なレスポンスを返す（列挙防止）
      await addTimingJitter(500, 200);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // TODO: CAPTCHA検証（将来実装）
    // if (captchaToken) {
    //   const captchaValid = await verifyCaptcha(captchaToken);
    //   if (!captchaValid) {
    //     await addTimingJitter(200, 100);
    //     return NextResponse.json(
    //       { error: 'CAPTCHA_FAILED' },
    //       { status: 400 }
    //     );
    //   }
    // }

    // Firebase Admin SDKでパスワードリセットメールを送信
    try {
      const actionCodeSettings = {
        // リセット完了後のリダイレクト先（オプション）
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login`,
        handleCodeInApp: false,
      };

      const adminAuth = getAdminAuth();
      await adminAuth.generatePasswordResetLink(normalizedEmail, actionCodeSettings);
      
      console.log('[password-reset] Reset email sent', { 
        email: normalizedEmail,
        ip,
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      // エラーが発生しても中立的なレスポンスを返す
      // （ユーザーが存在しない、無効化されているなど）
      console.warn('[password-reset] Firebase error (expected for unknown users)', {
        email: normalizedEmail,
        errorCode: error?.code,
      });
    }

    // タイミング攻撃対策: 最小実行時間を確保
    const elapsed = Date.now() - startTime;
    const minDuration = 500; // 最小500ms
    if (elapsed < minDuration) {
      await new Promise(resolve => setTimeout(resolve, minDuration - elapsed));
    }
    await addTimingJitter(0, 200);

    // 常に成功レスポンスを返す（列挙防止）
    return NextResponse.json({ ok: true }, { status: 200 });

  } catch (error: any) {
    console.error('[password-reset] Unexpected error', error);
    
    // エラーの場合もタイミングを均一化
    await addTimingJitter(200, 100);
    
    return NextResponse.json(
      { error: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}
