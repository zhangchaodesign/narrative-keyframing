"use client";

import { useState } from "react";
import { Header } from "@/components/Header";
import { DynamicTextEditor } from "@/components/TextEditor/DynamicTextEditor";
import { WorkflowCanvas } from "@/components/WorkflowCanvas/WorkflowCanvas";
import { TimelineView } from "@/components/TimelineView/TimelineView";
import {
  ViewSwitcher,
  type ViewMode,
} from "@/components/ViewSwitcher/ViewSwitcher";

export default function Page() {
  const [viewMode, setViewMode] = useState<ViewMode>("workflow");

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="shrink-0">
        <Header />
      </div>

      <div className="flex-1 overflow-hidden">
        <div className="h-full">
          <div className="flex h-full items-stretch overflow-hidden">
            <div className="w-[600px] shrink-0 h-full overflow-y-auto">
              <DynamicTextEditor conflictHighlight={null} />
            </div>

            <div className="flex-1 min-w-0 overflow-hidden h-full flex flex-col">
              {/* View Switcher */}
              <div className="shrink-0 bg-gray-50 border-b border-gray-200 px-2 py-2 flex items-center justify-between">
                <ViewSwitcher
                  currentView={viewMode}
                  onViewChange={setViewMode}
                />
              </div>

              {/* View Content */}
              <div className="flex-1 overflow-hidden">
                {viewMode === "workflow" ? (
                  <WorkflowCanvas />
                ) : (
                  <TimelineView />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
