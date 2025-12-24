/**
 * レート制限ユーティリティ
 * IP単位とメール単位の制限を提供
 */

interface RateLimitBucket {
  count: number;
  resetAt: number;
  backoffUntil?: number; // 指数バックオフ用
}

interface RateLimitConfig {
  windowMs: number; // 制限期間（ミリ秒）
  maxRequests: number; // 期間内の最大リクエスト数
  enableBackoff?: boolean; // 指数バックオフを有効にするか
}

class RateLimiter {
  private buckets = new Map<string, RateLimitBucket>();
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * レート制限をチェックして、許可するかどうかを判定
   * @param key - 制限対象のキー（IP, email など）
   * @returns 許可された場合 true、制限された場合 false
   */
  check(key: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const bucket = this.buckets.get(key);

    // バックオフ期間中の場合
    if (bucket?.backoffUntil && now < bucket.backoffUntil) {
      return {
        allowed: false,
        retryAfter: Math.ceil((bucket.backoffUntil - now) / 1000),
      };
    }

    // バケットが存在しないか、リセット時刻を過ぎている場合
    if (!bucket || now > bucket.resetAt) {
      this.buckets.set(key, {
        count: 1,
        resetAt: now + this.config.windowMs,
      });
      return { allowed: true };
    }

    // 制限数に達している場合
    if (bucket.count >= this.config.maxRequests) {
      // 指数バックオフを適用
      if (this.config.enableBackoff) {
        const backoffMultiplier = Math.min(bucket.count - this.config.maxRequests + 1, 10);
        const backoffMs = this.config.windowMs * Math.pow(2, backoffMultiplier - 1);
        bucket.backoffUntil = now + backoffMs;
        
        return {
          allowed: false,
          retryAfter: Math.ceil(backoffMs / 1000),
        };
      }

      return {
        allowed: false,
        retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
      };
    }

    // カウントを増やして許可
    bucket.count += 1;
    return { allowed: true };
  }

  /**
   * 定期的にクリーンアップ（メモリリーク防止）
   */
  cleanup() {
    const now = Date.now();
    for (const [key, bucket] of this.buckets.entries()) {
      if (now > bucket.resetAt && (!bucket.backoffUntil || now > bucket.backoffUntil)) {
        this.buckets.delete(key);
      }
    }
  }
}

// IP単位のレート制限（5回/時間）
export const ipRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1時間
  maxRequests: 5,
  enableBackoff: true,
});

// メール単位のレート制限（3回/時間）
export const emailRateLimiter = new RateLimiter({
  windowMs: 60 * 60 * 1000, // 1時間
  maxRequests: 3,
  enableBackoff: false,
});

// 定期クリーンアップ（10分ごと）
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    ipRateLimiter.cleanup();
    emailRateLimiter.cleanup();
  }, 10 * 60 * 1000);
}

/**
 * タイミング攻撃対策: 最小待ち時間とジッタを追加
 */
export async function addTimingJitter(minDelayMs = 100, maxJitterMs = 200): Promise<void> {
  const delay = minDelayMs + Math.random() * maxJitterMs;
  await new Promise(resolve => setTimeout(resolve, delay));
}
