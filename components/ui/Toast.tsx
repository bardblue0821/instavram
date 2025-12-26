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
  
  // ErrorHandler との統合用のヘルパーメソッドを追加
  return {
    ...ctx,
    error: (message: string, duration?: number) => ctx.show({ message, variant: 'error', duration }),
    warning: (message: string, duration?: number) => ctx.show({ message, variant: 'warning', duration }),
    info: (message: string, duration?: number) => ctx.show({ message, variant: 'info', duration }),
    success: (message: string, duration?: number) => ctx.show({ message, variant: 'success', duration }),
  };
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
      {/* コンテナ: 右上にスタイリッシュな通知を表示 */}
      <div className="pointer-events-none fixed top-4 right-4 z-1000 flex flex-col items-end gap-3 px-3">
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
  const icon = variantIcon(variant || "info");
  
  return (
    <div
      role="status"
      className={[
        "pointer-events-auto max-w-sm rounded-lg shadow-xl",
        "border",
        "animate-slide-right-fade",
        color.bg,
        color.border,
      ].join(" ")}
    >
      <div className={["flex items-start gap-3 px-4 py-3", color.text].join(" ")}>
        <span className={["mt-0.5 text-lg", color.icon].join(" ")} aria-hidden="true">
          {icon}
        </span>
        <p className="text-sm flex-1 leading-relaxed">{message}</p>
        <button
          type="button"
          onClick={onClose}
          className="ml-1 text-muted hover:text-foreground text-lg leading-none -mt-0.5"
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
      return { 
        bg: "bg-green-900/20", 
        border: "border-green-600", 
        text: "text-foreground", 
        icon: "text-green-500" 
      };
    case "warning":
      return { 
        bg: "bg-yellow-900/20", 
        border: "border-yellow-600", 
        text: "text-foreground", 
        icon: "text-yellow-500" 
      };
    case "error":
      return { 
        bg: "bg-red-900/20", 
        border: "border-red-600", 
        text: "text-foreground", 
        icon: "text-red-500" 
      };
    default:
      return { 
        bg: "bg-surface-weak", 
        border: "border-line", 
        text: "text-foreground", 
        icon: "text-muted" 
      };
  }
}

function variantIcon(v: ToastVariant) {
  switch (v) {
    case "success":
      return "✓";
    case "warning":
      return "⚠";
    case "error":
      return "✕";
    default:
      return "ℹ";
  }
}

// 簡易アニメーション（Tailwind v4 環境向け、globals.cssでkeyframes定義があれば利用）
// v4でも任意のクラス名利用を想定
// ここではユーティリティクラス前提のためCSSはglobals.css側に任意で追加可
