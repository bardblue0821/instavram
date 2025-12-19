"use client";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { searchUsersPrefix, searchAlbumsPrefix, searchAlbumsByCommentPrefix, UserHit, AlbumHit } from "../../lib/repos/searchRepo";
import { translateError } from "../../lib/errors";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [users, setUsers] = useState<UserHit[]>([]);
  const [albums, setAlbums] = useState<AlbumHit[]>([]);
  const [suggest, setSuggest] = useState<Array<{ type: "user" | "album"; label: string; href: string }>>([]);
  const [history, setHistory] = useState<string[]>([]);
  const timer = useRef<number | null>(null);
  const normalized = useMemo(() => q.trim(), [q]);

  useEffect(() => {
    // 履歴ロード
    try {
      const raw = localStorage.getItem("app:search-history");
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setHistory(arr.filter((x) => typeof x === "string"));
      }
    } catch {}
  }, []);

  function saveHistory(term: string) {
    const base = term.trim();
    if (!base) return;
    const v = base.startsWith("@") ? base : base; // そのまま保存（表示/再検索に利用）
    setHistory((prev) => {
      const next = [v, ...prev.filter((x) => x !== v)].slice(0, 10);
      try { localStorage.setItem("app:search-history", JSON.stringify(next)); } catch {}
      return next;
    });
  }
  function clearHistory() {
    setHistory([]);
    try { localStorage.removeItem("app:search-history"); } catch {}
  }

  useEffect(() => {
    if (timer.current) window.clearTimeout(timer.current);
    if (!normalized) {
      setUsers([]); setAlbums([]); setSuggest([]); setErr(null); return;
    }
    const delay = normalized.startsWith("@") ? 120 : 250;
    timer.current = window.setTimeout(async () => {
      const base = normalized.startsWith("@") ? normalized.slice(1) : normalized;
      setLoading(true); setErr(null);
      try {
        const [u, a, comm] = await Promise.all([
          searchUsersPrefix(base, 20),
          searchAlbumsPrefix(base, 20),
          searchAlbumsByCommentPrefix(base, 20),
        ]);
        // アルバム: 本文/説明とコメント由来をマージ
        const byId: Record<string, AlbumHit> = {};
        a.forEach((x) => (byId[x.id] = x));
        comm.forEach((x) => { if (!byId[x.id]) byId[x.id] = x; });
        const albumsMerged = Object.values(byId);
        setUsers(u);
        setAlbums(albumsMerged);
        // サジェスト: 上位5件（ユーザー優先→アルバム）
        const s: Array<{ type: "user" | "album"; label: string; href: string }> = [];
        for (const x of u.slice(0, 5)) {
          const label = `${x.displayName || ""}${x.displayName ? " " : ""}${x.handle ? `@${x.handle}` : ""}`.trim() || x.uid;
          if (x.handle) s.push({ type: "user", label, href: `/user/${x.handle}` });
        }
        for (const x of albumsMerged.slice(0, Math.max(0, 5 - s.length))) {
          const label = `${x.title || "無題"}`;
          s.push({ type: "album", label, href: `/album/${x.id}` });
        }
        setSuggest(s);
      } catch (e: any) {
        setErr(translateError(e));
      } finally {
        setLoading(false);
      }
    }, delay) as unknown as number;
    // cleanup
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [normalized]);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      const base = normalized.startsWith("@") ? normalized : normalized; // 表示通り保存
      if (base) saveHistory(base);
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-5">
      <h1 className="text-xl font-semibold">検索</h1>
      <div>
        <input
          autoFocus
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="ユーザー名 / @ハンドル / アルバム名 / 説明 / コメント"
          className="w-full input-underline text-sm"
        />
        {!normalized && history.length > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs fg-muted">最近の検索</p>
              <button type="button" onClick={clearHistory} className="text-[11px] fg-subtle">クリア</button>
            </div>
            <ul className="border border-base rounded divide-y divide-base">
              {history.map((h, i) => (
                <li key={i} className="text-sm">
                  <button
                    type="button"
                    className="w-full text-left px-3 py-2 hover-surface-alt truncate"
                    onClick={() => setQ(h)}
                  >{h}</button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {/* 入力中の候補表示は廃止（UI簡素化） */}
        {loading && <p className="text-xs fg-subtle mt-2">検索中...</p>}
        {err && <p className="text-xs text-red-600 mt-2">{err}</p>}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <section>
          <h2 className="font-medium mb-2">ユーザー {users.length ? `(${users.length})` : ""}</h2>
          {!normalized && <p className="text-sm fg-subtle">キーワードを入力してください</p>}
          {normalized && users.length === 0 && !loading && (<p className="text-sm fg-subtle">該当なし</p>)}
          <ul className="space-y-1">
            {users.map((u) => (
              <li key={u.uid} className="text-sm truncate">
                <Link href={u.handle ? `/user/${u.handle}` : "#"}>
                  {u.displayName || ""}{u.displayName ? " " : ""}{u.handle ? `@${u.handle}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="font-medium mb-2">アルバム {albums.length ? `(${albums.length})` : ""}</h2>
          {!normalized && <p className="text-sm fg-subtle">キーワードを入力してください</p>}
          {normalized && albums.length === 0 && !loading && (<p className="text-sm fg-subtle">該当なし</p>)}
          <ul className="space-y-1">
            {albums.map((a) => (
              <li key={a.id} className="text-sm truncate">
                <Link href={`/album/${a.id}`}>
                  {a.title || "無題"}{a.description ? ` — ${a.description}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
