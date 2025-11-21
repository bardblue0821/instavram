"use client";
import React from "react";

interface StatItem {
  label: string;
  value: number | string;
  description?: string;
}

interface ProfileStatsProps {
  stats: StatItem[];
}

export function ProfileStats({ stats }: ProfileStatsProps) {
  if (!stats || stats.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((stat) => (
        <div key={stat.label} className="rounded bg-gray-100 p-3 text-center dark:bg-gray-800">
          <p className="text-xs text-gray-600 dark:text-gray-400">{stat.label}</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-gray-50">{stat.value}</p>
          {stat.description && <p className="text-[11px] text-gray-500">{stat.description}</p>}
        </div>
      ))}
    </div>
  );
}
