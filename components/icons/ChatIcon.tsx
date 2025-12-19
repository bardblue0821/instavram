"use client";
import React from "react";

export function ChatIcon({
  size = 20,
  className,
  filled = false,
}: {
  size?: number;
  className?: string;
  filled?: boolean;
}) {
  // Simple chat bubble icon using currentColor
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M20 3H4a2 2 0 0 0-2 2v12l4-4h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z"
        fill={filled ? "currentColor" : "none"}
        stroke={filled ? "none" : "currentColor"}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default ChatIcon;
