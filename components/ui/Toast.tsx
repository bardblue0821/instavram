"use client";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

type ToastVariant = "info" | "success" | "warning" | "error";

export type ToastOptions = {
  message: string;
  variant?: ToastVariant;
  duration?: number; // ms
};

type ToastItem = ToastOptions & { id: number };

type ToastContextType = {
  show: (opts: ToastOptions) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within <ToastProvider>");
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(1);
  const pathname = usePathname();

  const show = useCallback((opts: ToastOptions) => {
    const id = idRef.current++;
    const item: ToastItem = {
      id,
      message: opts.message,
      variant: opts.variant || "info",
      duration: opts.duration ?? 3000,
    };
    setToasts((prev) => [...prev, item]);
    if (item.duration && item.duration > 0) {
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, item.duration);
    }
  }, []);

  // 画面遷移越しの一時メッセージを sessionStorage から拾う（パス変化ごとにチェック）
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("app:toast");
      if (raw) {
        const parsed = JSON.parse(raw) as ToastOptions;
        if (parsed && parsed.message) show(parsed);
        sessionStorage.removeItem("app:toast");
      }
    } catch {}
  }, [pathname, show]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* コンテナ: 上部に iOS 風の通知を重ねる */}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-1000 flex flex-col items-center gap-2 px-3">
        {toasts.map((t) => (
          <ToastBubble key={t.id} item={t} onClose={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastBubble({ item, onClose }: { item: ToastItem; onClose: () => void }) {
  const { message, variant } = item;
  const color = variantColor(variant || "info");
  return (
    <div
      role="status"
      className={[
        "pointer-events-auto w-full max-w-md rounded-md shadow-lg",
        "backdrop-blur bg-white/90 border",
        "animate-slide-down-fade",
        color.border,
      ].join(" ")}
      style={{}}
    >
      <div className={["flex items-start gap-2 px-4 py-3", color.text].join(" ")}>
        <span className={["mt-0.5 inline-block h-2.5 w-2.5 rounded-full", color.dot].join(" ")} aria-hidden="true" />
        <p className="text-sm flex-1">{message}</p>
        <button
          type="button"
          className="ml-2 text-xs text-gray-500 hover:text-gray-700"
          onClick={onClose}
          aria-label="閉じる"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function variantColor(v: ToastVariant) {
  switch (v) {
    case "success":
      return { border: "border-green-300", text: "text-green-900", dot: "bg-green-500" };
    case "warning":
      return { border: "border-yellow-300", text: "text-yellow-900", dot: "bg-yellow-500" };
    case "error":
      return { border: "border-red-300", text: "text-red-900", dot: "bg-red-500" };
    default:
      return { border: "border-gray-300", text: "text-gray-900", dot: "bg-gray-500" };
  }
}

// 簡易アニメーション（Tailwind v4 環境向け、globals.cssでkeyframes定義があれば利用）
// v4でも任意のクラス名利用を想定
// ここではユーティリティクラス前提のためCSSはglobals.css側に任意で追加可
