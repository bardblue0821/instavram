"use client";
import React from "react";

export function HandshakeIcon({ size = 18, className, title = "フレンド" }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label={title}
      className={className}
    >
      {/* stylized handshake: two hands meeting */}
      <path d="M8 12l3-3a3 3 0 014 0l3 3" />
      <path d="M5 15l3 3a3 3 0 004 0l2-2" />
      <path d="M19 9l-2-2" />
      <path d="M5 9l2-2" />
    </svg>
  );
}
