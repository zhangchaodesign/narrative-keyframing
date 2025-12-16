"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Header } from "@/components/Header";
import { DynamicTextEditor } from "@/components/TextEditor/DynamicTextEditor";
import { WorkflowCanvas } from "@/components/WorkflowCanvas/WorkflowCanvas";
import { TimelineView } from "@/components/TrackView/TimelineView";
import {
  ViewSwitcher,
  type ViewMode,
} from "@/components/ViewSwitcher/ViewSwitcher";

export default function Page() {
  const [viewMode, setViewMode] = useState<ViewMode>("workflow");
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(false);

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      {/* <div className="shrink-0">
        <Header />
      </div> */}

      <div className="flex-1 overflow-hidden">
        <div className="h-full">
          <div className="flex h-full items-stretch overflow-hidden">
            <div
              className={clsx(
                "relative h-full transition-all duration-300 ease-in-out shrink-0",
                isEditorCollapsed ? "w-0" : "w-[600px]",
              )}
            >
              <div
                className={clsx(
                  "absolute inset-y-0 left-0 w-[600px] h-full transition-transform duration-300 ease-in-out",
                  isEditorCollapsed ? "-translate-x-full" : "translate-x-0",
                )}
              >
                <div className="h-full overflow-y-auto">
                  <DynamicTextEditor conflictHighlight={null} />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsEditorCollapsed((prev) => !prev)}
                aria-label={
                  isEditorCollapsed ? "Show text editor" : "Hide text editor"
                }
                className="absolute top-1/2 left-full z-10 flex h-12 w-6 -translate-y-1/2 items-center justify-center rounded-l-none rounded-r-full border border-gray-200 border-l-0 bg-white text-gray-600 hover:bg-gray-50"
              >
                {isEditorCollapsed ? (
                  <ChevronRight className="h-5 w-5 mr-1" />
                ) : (
                  <ChevronLeft className="h-5 w-5 mr-1" />
                )}
              </button>
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
