"use client";
import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "accent";
type Size = "sm" | "md" | "lg";

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  isLoading?: boolean;
  fullWidth?: boolean;
};

const base = "inline-flex items-center justify-center rounded-md font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

const variantClass: Record<Variant, string> = {
  primary: "btn-accent", // legacy primary -> accent
  accent: "btn-accent",
  secondary: "bg-gray-900 text-white hover:bg-gray-800 focus-visible:ring-gray-500",
  ghost: "border border-base text-gray-700 hover:bg-gray-100 focus-visible:ring-gray-300",
};

const sizeClass: Record<Size, string> = {
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
      {isLoading && <span className="mr-2 h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />}
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
