"use client";
import React, { useState } from "react";

export interface ProfileTabConfig {
  key: string;
  label: string;
  count?: number;
  render: () => React.ReactNode;
}

interface ProfileTabsProps {
  tabs: ProfileTabConfig[];
}

export function ProfileTabs({ tabs }: ProfileTabsProps) {
  const [active, setActive] = useState(tabs[0]?.key);

  return (
    <div className="space-y-4">
      <div role="tablist" className="flex gap-2 overflow-x-auto rounded border bg-white p-1 dark:bg-gray-900">
        {tabs.map((tab) => {
          const isActive = tab.key === active;
          return (
            <button
              key={tab.key}
              role="tab"
              aria-selected={isActive}
              aria-controls={`panel-${tab.key}`}
              className={`min-w-[120px] rounded px-3 py-2 text-sm transition ${isActive ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
              onClick={() => setActive(tab.key)}
            >
              <span>{tab.label}</span>
              {typeof tab.count === "number" && <span className="ml-2 text-xs">({tab.count})</span>}
            </button>
          );
        })}
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.key}
          id={`panel-${tab.key}`}
          role="tabpanel"
          hidden={tab.key !== active}
          className="space-y-3"
        >
          {tab.render()}
        </div>
      ))}
    </div>
  );
}
