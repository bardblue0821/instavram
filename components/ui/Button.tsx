"use client";
import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "accent" | "subtle" | "danger";
type Size = "xs" | "sm" | "md" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  fullWidth?: boolean;
};

const base = "inline-flex items-center justify-center rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const variantClass: Record<Variant, string> = {
  primary: "btn-accent", // legacy primary -> accent
  accent: "btn-accent",
  secondary: "surface text-white hover:opacity-90",
  ghost: "border border-base fg-muted hover-surface-alt",
  subtle: "surface-alt border border-base fg-muted hover:opacity-90",
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
