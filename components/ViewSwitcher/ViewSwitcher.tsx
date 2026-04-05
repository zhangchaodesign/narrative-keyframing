"use client";

import { cn } from "@/lib/utiils/sharedUtils";
import { TbLayoutGrid, TbTable, TbTimeline } from "react-icons/tb";
import type { ViewMode as UiViewMode } from "@/lib/stores/uiStore";
import { eventTracker } from "@/lib/utils";

export type ViewMode = UiViewMode;

interface ViewSwitcherProps {
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

export function ViewSwitcher({ currentView, onViewChange }: ViewSwitcherProps) {
  const getViewDisplayName = (view: ViewMode): string => {
    const nameMap: Record<ViewMode, string> = {
      workflow: "canvas",
      timeline: "track",
      table: "table",
    };
    return nameMap[view] || view;
  };

  const handleViewChange = (view: ViewMode) => {
    eventTracker({
      action: "switch_view",
      data: {
        from: getViewDisplayName(currentView),
        to: getViewDisplayName(view),
      },
    });
    onViewChange(view);
  };

  return (
    <div className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-0.5">
      <button
        onClick={() => handleViewChange("workflow")}
        className={cn(
          "flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition-colors w-24 justify-center",
          currentView === "workflow"
            ? "bg-blue-500 text-white shadow-sm"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        )}
      >
        <TbLayoutGrid size={16} />
        Canvas
      </button>

      <button
        onClick={() => handleViewChange("timeline")}
        className={cn(
          "flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition-colors w-24 justify-center",
          currentView === "timeline"
            ? "bg-blue-500 text-white shadow-sm"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        )}
      >
        <TbTimeline size={16} />
        Track
      </button>

      <button
        onClick={() => handleViewChange("table")}
        className={cn(
          "flex items-center gap-2 rounded px-3 py-1.5 text-xs font-medium transition-colors w-24 justify-center",
          currentView === "table"
            ? "bg-blue-500 text-white shadow-sm"
            : "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
        )}
      >
        <TbTable size={16} />
        Table
      </button>
    </div>
  );
}
