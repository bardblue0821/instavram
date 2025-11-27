"use client";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthUser } from "../../../lib/hooks/useAuthUser";
import { useVerificationGuard } from "../../../lib/hooks/useVerificationGuard";
import { translateError } from "../../../lib/errors";

export default function RegisterCompletePage() {
  // 未検証ユーザー以外はここに来ない想定だが、ガードで最低限の保護
  useVerificationGuard(false);
  const router = useRouter();
  const { user } = useAuthUser();

  const [displayName, setDisplayName] = useState("");
  const [handle, setHandle] = useState("");
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [checking, setChecking] = useState(false);
  const [handleState, setHandleState] = useState<"idle"|"checking"|"ok"|"taken"|"invalid">("idle");
  const [error, setError] = useState<string| null>(null);
  const [saving, setSaving] = useState(false);

  const validHandle = useMemo(() => /^[a-zA-Z0-9_]{3,20}$/.test(handle), [handle]);
  const pwMatch = pw1 === pw2 && pw1.length >= 6;

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      if (!handle) { setHandleState("idle"); return; }
      if (!validHandle) { setHandleState("invalid"); return; }
      setHandleState("checking");
      try {
        const { listUsersByHandle } = await import("../../../lib/repos/userRepo");
        const rows = await listUsersByHandle(handle);
        if (!active) return;
        setHandleState(rows.length === 0 ? "ok" : "taken");
      } catch {
        if (!active) return;
        setHandleState("invalid");
      }
    }, 450);
    return () => { active = false; clearTimeout(timer); };
  }, [handle, validHandle]);

  async function submit() {
    if (!user) return;
    setSaving(true); setError(null);
    try {
      // 表示名更新
      const { updateProfile, updatePassword } = await import("firebase/auth");
      await updateProfile(user, { displayName });

      // users ドキュメント更新/作成
      const { ensureUserWithHandle } = await import("../../../lib/repos/userRepo");
      await ensureUserWithHandle(user.uid, displayName, handle);

      // パスワード更新
      if (pwMatch) {
        await updatePassword(user, pw1);
      }

      // 完了後プロフィールへ
      router.push(`/user/${handle}`);
    } catch (e: any) {
      setError(translateError(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md mx-auto space-y-4">
      <h1 className="text-xl font-semibold">本登録の完了</h1>
      <p className="text-sm text-gray-600">表示名・ユーザーID・パスワードを設定してください。</p>

      <div>
        <label className="block text-xs fg-muted">表示名</label>
        <input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} className="input-underline w-full" placeholder="表示名"/>
      </div>

      <div>
        <label className="block text-xs fg-muted">ユーザーID (handle)</label>
        <input value={handle} onChange={(e)=>setHandle(e.target.value)} className="input-underline w-full" placeholder="example_user"/>
        <p className="text-xs mt-1">
          {handleState === "idle" && "未入力"}
          {handleState === "checking" && "確認中..."}
          {handleState === "ok" && <span className="text-green-600">利用可能です</span>}
          {handleState === "taken" && <span className="text-red-600">使用不可（重複）</span>}
          {handleState === "invalid" && <span className="text-red-600">形式が不正です（英数字と_、3〜20文字）</span>}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-xs fg-muted">新パスワード</label>
          <input type="password" value={pw1} onChange={(e)=>setPw1(e.target.value)} className="input-underline w-full"/>
        </div>
        <div>
          <label className="block text-xs fg-muted">確認</label>
          <input type="password" value={pw2} onChange={(e)=>setPw2(e.target.value)} className="input-underline w-full"/>
          {!pwMatch && <p className="text-xs text-red-600">6文字以上・一致が必要です</p>}
        </div>
      </div>

      <button
        className="btn-accent disabled:opacity-50"
        disabled={!displayName.trim() || handleState !== "ok" || !pwMatch || saving}
        onClick={submit}
      >{saving ? "保存中..." : "保存して完了"}</button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
