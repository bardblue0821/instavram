"use client";
import React from "react";

interface WatchActionsProps {
  watching: boolean;
  busy?: boolean;
  onToggle?: () => void;
  disabled?: boolean;
}

export default function WatchActions({ watching, busy = false, onToggle, disabled = false }: WatchActionsProps) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium">ウォッチ</h3>
      <button
        onClick={onToggle}
        disabled={busy || disabled}
        className={watching ? 'bg-gray-600 text-white text-xs px-2 py-1 rounded disabled:opacity-50' : 'btn-accent text-xs disabled:opacity-50'}
      >
        {busy ? "処理中..." : watching ? "ウォッチ解除" : "ウォッチ"}
      </button>
    </div>
  );
}
