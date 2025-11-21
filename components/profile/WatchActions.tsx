"use client";
import React from "react";
import { Button } from "../ui/Button";

interface WatchActionsProps {
  watching: boolean;
  busy?: boolean;
  onToggle?: () => void;
  disabled?: boolean;
}

export function WatchActions({ watching, busy = false, onToggle, disabled = false }: WatchActionsProps) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-medium">ウォッチ</h3>
      <Button
        onClick={onToggle}
        disabled={busy || disabled}
        variant={watching ? "ghost" : "secondary"}
        size="sm"
      >
        {busy ? "処理中..." : watching ? "ウォッチ解除" : "ウォッチ"}
      </Button>
    </div>
  );
}
