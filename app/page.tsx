"use client";

import { useState, useEffect, useRef } from "react";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Header } from "@/components/Header";
import { DynamicTextEditor } from "@/components/TextEditor/DynamicTextEditor";
import { WorkflowCanvas } from "@/components/WorkflowCanvas/WorkflowCanvas";
import { TimelineView } from "@/components/TrackView/TimelineView";
import { ViewSwitcher } from "@/components/ViewSwitcher/ViewSwitcher";
import { NarrativeTableView } from "@/components/TableView/NarrativeTableView";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { adjustEventCountForAllClusters } from "@/lib/utiils/workflowUtils";
import { useUiStore } from "@/lib/stores/uiStore";
import { StudyManager } from "@/components/StudyManager";
import { eventTracker } from "@/lib/utils";
import { exampleEventDescriptions } from "@/components/WorkflowCanvas/workflow.constants";

export default function Page() {
  const viewMode = useUiStore((state) => state.viewMode);
  const setViewMode = useUiStore((state) => state.setViewMode);
  const eventCount = useUiStore((state) => state.eventCount);
  const setEventCountStore = useUiStore((state) => state.setEventCount);
  const [isEditorCollapsed, setIsEditorCollapsed] = useState(true);
  const isInitialMount = useRef(true);

  const setNodes = useWorkflowStore((state) => state.setNodes);
  const setEdges = useWorkflowStore((state) => state.setEdges);

  const handleEventCountChange = (newCount: number) => {
    eventTracker({
      action: "change_event_count",
      data: { from: eventCount, to: newCount },
    });
    setEventCountStore(newCount);
  };

  const handleLoadExamples = () => {
    eventTracker({ action: "load_examples", data: null });
    const currentNodes = useWorkflowStore.getState().nodes;
    const updatedNodes = currentNodes.map((node) => {
      if (node.type !== "event") return node;
      const match = node.id.match(/event-(\d+)$/);
      if (!match) return node;
      const index = parseInt(match[1], 10) - 1;
      if (index < exampleEventDescriptions.length) {
        return {
          ...node,
          data: { ...node.data, description: exampleEventDescriptions[index] },
        };
      }
      return node;
    });
    setNodes(updatedNodes as typeof currentNodes);
  };

  const handleEditorToggle = () => {
    eventTracker({
      action: isEditorCollapsed ? "click_chevron_right" : "click_chevron_left",
      data: {
        isEditorCollapsedBeforeClick: isEditorCollapsed,
      },
    });
    setIsEditorCollapsed((prev) => !prev);
  };

  useEffect(() => {
    // Skip the initial mount to avoid triggering adjustment on page load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Get current state directly from the store to avoid stale closures
    const currentNodes = useWorkflowStore.getState().nodes;
    const currentEdges = useWorkflowStore.getState().edges;

    const result = adjustEventCountForAllClusters(
      currentNodes,
      currentEdges,
      eventCount,
    );

    setNodes(result.nodes);
    setEdges(result.edges);
  }, [eventCount, setNodes, setEdges]);

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
                "relative z-30 h-full transition-all duration-300 ease-in-out shrink-0",
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
                onClick={handleEditorToggle}
                aria-label={
                  isEditorCollapsed ? "Show text editor" : "Hide text editor"
                }
                className="absolute top-1/2 left-full z-50 flex h-12 w-6 -translate-y-1/2 items-center justify-center rounded-l-none rounded-r-full border border-gray-200 border-l-0 bg-white text-gray-600 hover:bg-gray-50"
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
                <div className="flex items-center gap-3">
                  <ViewSwitcher
                    currentView={viewMode}
                    onViewChange={setViewMode}
                  />
                  <div className="form-control">
                    <label className="label py-0 px-1 mr-1">
                      <span className="label-text text-xs">Events</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={eventCount}
                      onChange={(e) =>
                        handleEventCountChange(Number(e.target.value))
                      }
                      className="input input-sm input-bordered w-16 rounded"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleLoadExamples}
                    className="btn btn-sm btn-soft"
                  >
                    Load Examples
                  </button>
                </div>
                <StudyManager />
              </div>

              {/* View Content */}
              <div className="flex-1 overflow-hidden">
                {viewMode === "workflow" ? (
                  <WorkflowCanvas eventCount={eventCount} />
                ) : viewMode === "timeline" ? (
                  <TimelineView />
                ) : (
                  <NarrativeTableView />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
