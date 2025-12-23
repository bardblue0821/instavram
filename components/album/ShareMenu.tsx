"use client";
import React, { useEffect, useRef, useState } from "react";

interface Props {
  albumId: string;
  albumTitle?: string | null;
  disabled?: boolean;
}

export default function ShareMenu({ albumId, albumTitle, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [discordOpen, setDiscordOpen] = useState(false);
  const [discordBusy, setDiscordBusy] = useState(false);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState("");
  const [discordMessage, setDiscordMessage] = useState("");
  const [discordError, setDiscordError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  const albumUrl = typeof window !== 'undefined' ? `${window.location.origin}/album/${encodeURIComponent(albumId)}` : `/album/${encodeURIComponent(albumId)}`;
  const title = (albumTitle || 'アルバム') as string;

  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      const t = e.target as Node;
      if (menuRef.current && !menuRef.current.contains(t) && btnRef.current && !btnRef.current.contains(t)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setOpen(false); }
    window.addEventListener('mousedown', onMouseDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function copyLink() {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(albumUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }).catch(() => {});
    } else {
      // fallback
      const a = document.createElement('a'); a.href = albumUrl; a.click();
    }
  }

  function shareTwitter() {
    const text = encodeURIComponent(`${title}を共有します`);
    const url = encodeURIComponent(albumUrl);
    const intent = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
    window.open(intent, '_blank', 'noopener,noreferrer');
    setOpen(false);
  }

  async function submitDiscordShare() {
    setDiscordBusy(true); setDiscordError(null);
    try {
      const body = { webhookUrl: discordWebhookUrl, albumUrl, message: discordMessage || `${title}を共有します` };
      const res = await fetch('/api/share/discord', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      if (!res.ok) {
        const data = await res.json().catch(()=>({}));
        throw new Error(data?.error || 'DISCORD_SHARE_FAILED');
      }
      setDiscordOpen(false);
      setDiscordWebhookUrl("");
      setDiscordMessage("");
    } catch (e:any) {
      setDiscordError(e?.message || String(e));
    } finally {
      setDiscordBusy(false);
    }
  }

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        aria-label="共有"
        aria-haspopup="menu"
        aria-expanded={open}
        className={`w-8 h-8 rounded border border-line ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-surface-weak text-muted'}`}
        onClick={() => {
          if (disabled) return;
          // Prefer Web Share API when available
          try {
            const nav: any = typeof navigator !== 'undefined' ? navigator : null;
            if (nav && typeof nav.share === 'function') {
              nav.share({ title, text: `${title}を共有します`, url: albumUrl })
                .then(() => {})
                .catch((err: any) => {
                  // Abort → 無視。それ以外のエラーはフォールバックメニューを開く
                  const code = err?.name || err?.code || '';
                  if (code === 'AbortError') return;
                  setOpen(true);
                });
              return;
            }
          } catch {}
          // Fallback to custom menu
          setOpen(o => !o);
        }}
        title="共有"
      >
        ↗
      </button>
      {open && (
        <div
          ref={menuRef}
          role="menu"
          className="absolute right-0 top-full mt-2 w-44 rounded border border-line bg-background shadow-lg z-50 overflow-hidden"
        >
          <button type="button" role="menuitem" className="w-full text-left px-3 py-2 text-sm hover:bg-surface-weak" onClick={copyLink}>
            リンクをコピー {copied && <span className="text-[10px] text-muted">(コピー済み)</span>}
          </button>
          <button type="button" role="menuitem" className="w-full text-left px-3 py-2 text-sm hover:bg-surface-weak" onClick={shareTwitter}>
            Twitter に投稿
          </button>
          <button type="button" role="menuitem" className="w-full text-left px-3 py-2 text-sm hover:bg-surface-weak" onClick={() => { setDiscordOpen(true); setOpen(false); }}>
            Discord に投稿
          </button>
        </div>
      )}

      {discordOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-96 rounded bg-background border border-line p-4 shadow-lg" role="dialog" aria-modal="true" aria-label="Discord 共有">
            <h3 className="text-sm font-semibold">Discord に共有</h3>
            <p className="mt-1 text-xs text-muted">Webhook URL を貼り付けてください（サーバー設定 → 連携サービス → Webhook）。</p>
            <label className="block text-xs text-muted mt-2">Webhook URL</label>
            <input value={discordWebhookUrl} onChange={(e)=> setDiscordWebhookUrl(e.target.value)} className="w-full border-b-2 border-[--accent] bg-transparent p-1 text-sm focus:outline-none" placeholder="https://discord.com/api/webhooks/..." />
            <label className="block text-xs text-muted mt-3">メッセージ（任意）</label>
            <input value={discordMessage} onChange={(e)=> setDiscordMessage(e.target.value)} className="w-full border-b-2 border-[--accent] bg-transparent p-1 text-sm focus:outline-none" placeholder={`${title}を共有します`} />
            {discordError && <p className="mt-2 text-xs text-red-600">{discordError}</p>}
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" className="rounded bg-surface-weak border border-line px-3 py-1 text-xs" onClick={() => setDiscordOpen(false)} disabled={discordBusy}>キャンセル</button>
              <button type="button" className="rounded bg-indigo-600 px-3 py-1 text-xs text-white disabled:opacity-50" onClick={submitDiscordShare} disabled={discordBusy || !discordWebhookUrl}>{discordBusy ? '送信中...' : '送信'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
