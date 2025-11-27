import { updateEmail, sendEmailVerification, User } from 'firebase/auth'

/**
 * 開発用途: 検証メールの宛先を固定の開発アドレスへ切り替えて送信します。
 * 注意: 本番では使用しないでください。NODE_ENV==='production' の場合はユーザーの現在メールへ送信します。
 */
export async function sendVerificationDev(user: User, devEmail?: string) {
  const target = devEmail || process.env.NEXT_PUBLIC_DEV_VERIFICATION_EMAIL || 'bardblue0821@gmail.com'
  // 本番はユーザーの既存メールへ送信
  const isProd = process.env.NODE_ENV === 'production'
  if (!isProd) {
    // 開発時のみ一時的にメールアドレスを上書きして送信
    await updateEmail(user, String(target))
  }
  await sendEmailVerification(user)
}
