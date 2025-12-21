"use client";
import React from "react";
import { Button } from "../ui/Button";

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
      <Button
        type="button"
        onClick={onToggle}
        disabled={busy || disabled}
        size="xs"
        variant={watching ? "ghost" : "accent"}
        className={watching ? "bg-gray-600 text-white hover:bg-gray-700 border-transparent" : undefined}
      >
        {busy ? "処理中..." : watching ? "ウォッチ解除" : "ウォッチ"}
      </Button>
    </div>
  );
}
