"use client";
import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "ghostFriend" | "ghostWatch" | "accent" | "accentSky" | "accentOrange" | "subtle" | "danger";
type Size = "xs" | "sm" | "md" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  fullWidth?: boolean;
};

const base = "inline-flex items-center justify-center rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const variantClass: Record<Variant, string> = {
  primary: "btn-accent", // legacy primary -> accent
  accent: "btn-accent",
  // Feature accents
  accentSky: "bg-watch text-white hover:bg-watch/90",
  accentOrange: "bg-friend text-white hover:bg-friend/90",
  // Secondary: 落ち着いた面 + 前景色、ホバーで弱い面
  secondary: "bg-background text-foreground hover:bg-surface-weak",
  // Ghost: 枠線 + muted テキスト + ホバーで弱い面
  ghost: "border border-line text-muted hover:bg-surface-weak",
  // Ghost (feature-specific borders)
  ghostFriend: "border border-friend text-foreground hover:bg-surface-weak",
  ghostWatch: "border border-watch text-foreground hover:bg-surface-weak",
  // Subtle: 弱い面 + 枠線 + muted テキスト
  subtle: "bg-surface-weak border border-line text-muted hover:opacity-90",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

const sizeClass: Record<Size, string> = {
  xs: "px-2 py-1 text-xs",
  sm: "px-3 py-1 text-sm",
  md: "px-4 py-2 text-sm",
  lg: "px-5 py-3 text-base",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", isLoading = false, fullWidth = false, className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
  className={cn(base, variantClass[variant], sizeClass[size], fullWidth && "w-full", className)}
      {...rest}
    >
      {isLoading && <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden="true" />}
      <span>{children}</span>
    </button>
  );
});

export const IconButton = React.forwardRef<HTMLButtonElement, ButtonProps>(function IconButton(
  { variant = "ghost", size = "sm", className, children, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
  className={cn(base, variantClass[variant], sizeClass[size], "px-2", className)}
      {...rest}
    >
      {children}
    </button>
  );
});
