export const RESERVED_HANDLES: string[] = [
  'admin','root','system','support','help','owner','moderator','mod','staff','official','security','test','api','bot',
  // ルーティング競合防止 (既存トップレベル固定パス)
  'login','timeline','album','user','handle'
];

export const RESERVED_DISPLAY_SUBSTRINGS: string[] = [
  // 表示名に含まれていると紛らわしい語 (ブランド/権限偽装防止)
  '公式','オフィシャル','運営','管理','moderator','admin'
];

// 不適切語パターン (必要に応じて本番環境で差し替え)
// 例: /badword/i など。現在は空テンプレまたはダミー。必ずプロジェクト判断で更新してください。
export const BLOCKED_PATTERNS: RegExp[] = [
  // /badword1/i,
  // /badword2/i,
];

// ハンドル文字列が予約語か / 不適切語か判定
export function isHandleBlocked(handle: string): boolean {
  const h = handle.toLowerCase();
  if (RESERVED_HANDLES.includes(h)) return true;
  for (const re of BLOCKED_PATTERNS) { if (re.test(h)) return true; }
  return false;
}

// 表示名が不適切または禁止サブストリングを含むか
export function isDisplayNameBlocked(name: string): boolean {
  const lower = name.toLowerCase();
  for (const sub of RESERVED_DISPLAY_SUBSTRINGS) {
    if (lower.includes(sub.toLowerCase())) return true;
  }
  for (const re of BLOCKED_PATTERNS) { if (re.test(lower)) return true; }
  return false;
}

// フィルタ理由取得 (UI 用)
export function getHandleBlockReason(handle: string): string | null {
  if (!handle.trim()) return null;
  const h = handle.toLowerCase();
  if (RESERVED_HANDLES.includes(h)) return '予約語は使用できません';
  for (const re of BLOCKED_PATTERNS) if (re.test(h)) return '不適切な語が含まれています';
  return null;
}

export function getDisplayNameBlockReason(name: string): string | null {
  if (!name.trim()) return null;
  const lower = name.toLowerCase();
  for (const sub of RESERVED_DISPLAY_SUBSTRINGS) if (lower.includes(sub.toLowerCase())) return '権限を誤認させる語句が含まれています';
  for (const re of BLOCKED_PATTERNS) if (re.test(lower)) return '不適切な語が含まれています';
  return null;
}
