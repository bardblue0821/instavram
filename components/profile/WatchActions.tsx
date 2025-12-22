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
      <Button
        type="button"
        onClick={onToggle}
        disabled={busy || disabled}
        size="sm"
        variant={watching ? "accentSky" : "ghostWatch"}
        className={"min-w-[7rem] h-8"}
      >
        {busy ? "処理中..." : watching ? "ウォッチ中" : "未ウォッチ"}
      </Button>
    </div>
  );
}
