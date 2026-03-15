"use client";

import { useRef, useState } from "react";
import { useStudyStore } from "@/lib/stores/studyStore";
import { useEditorStore } from "@/lib/stores/editorStore";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { SlateUtils } from "@/lib/utiils/slateUtils";
import { combineNarrativeTextsInGroup } from "@/lib/utiils/narrativeUtils";
import { TbInfoCircleFilled } from "react-icons/tb";
import { eventTracker } from "@/lib/utils";

export function StudyManager() {
  const [showPanel, setShowPanel] = useState(false);
  const [userIdInput, setUserIdInput] = useState("");
  const { user, setUser, task, setTask, ifTracking, setIfTracking } =
    useStudyStore();
  const panelRef = useRef<HTMLDivElement>(null);

  const canStart = userIdInput.trim() !== "" && task !== "" && !ifTracking;
  const canEnd = ifTracking;

  return (
    <div className="relative z-1000001" ref={panelRef}>
      <button
        onClick={() => {
          setShowPanel((v) => !v);
          setUserIdInput(user === "annonymous" ? "" : user);
        }}
        className="p-1.5 rounded-full hover:bg-gray-100 transition-colors text-gray-400 hover:text-gray-700"
        title="Set user ID"
      >
        <TbInfoCircleFilled className="w-5 h-5" />
      </button>
      {showPanel && (
        <div className="absolute top-10 right-0 bg-white border border-gray-200 rounded-lg shadow-lg p-4 w-64">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            User ID
          </label>
          <input
            type="text"
            value={userIdInput}
            onChange={(e) => setUserIdInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && userIdInput.trim() && !ifTracking) {
                setUser(userIdInput.trim());
                setShowPanel(false);
              }
            }}
            placeholder="Enter your user ID"
            disabled={ifTracking}
            className={`w-full px-3 py-1.5 text-sm border rounded-md focus:outline-none ${
              ifTracking
                ? "bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                : "border-gray-300 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
            }`}
            autoFocus={!ifTracking}
          />
          <label className="block text-sm font-medium text-gray-700 mb-2 mt-4">
            Task
          </label>
          <div className="flex gap-2">
            {["shapeshifter", "bee"].map((t) => (
              <button
                key={t}
                onClick={() => !ifTracking && setTask(t)}
                disabled={ifTracking}
                className={`flex-1 px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  ifTracking
                    ? "border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed"
                    : task === t
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-300 text-gray-600 hover:border-gray-400"
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              onClick={() => {
                const editorState = useEditorStore.getState().value;
                const editorText = SlateUtils.stateToText(editorState);
                const { nodes, edges } = useWorkflowStore.getState();
                const narrativeGroups = nodes.filter(
                  (node) => node.type === "narrativeGroup",
                );
                const narrativeClusters = narrativeGroups.map((group) => ({
                  groupId: group.id,
                  label: (group.data as { label?: string })?.label ?? "",
                  narrativeGroupId:
                    (group.data as { narrativeGroupId?: number })
                      ?.narrativeGroupId ?? 0,
                  combinedNarrative: combineNarrativeTextsInGroup(
                    group.id,
                    nodes,
                  ),
                }));
                eventTracker({
                  action: "end_study",
                  data: {
                    user,
                    task,
                    editorContent: editorText,
                    workflowNodes: nodes,
                    workflowEdges: edges,
                    narrativeClusters,
                  },
                });
                setIfTracking(false);
                setShowPanel(false);
              }}
              disabled={!canEnd}
              className={`px-3 py-1.5 text-sm transition-colors ${
                canEnd
                  ? "text-gray-600 hover:text-gray-800 cursor-pointer"
                  : "text-gray-400 cursor-not-allowed"
              }`}
            >
              End
            </button>
            <button
              onClick={() => {
                if (canStart) {
                  setUser(userIdInput.trim());
                  setIfTracking(true);
                  setShowPanel(false);
                  eventTracker({
                    action: "start_study",
                    data: { user: userIdInput.trim(), task },
                  });
                }
              }}
              disabled={!canStart}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                canStart
                  ? "bg-gray-900 text-white hover:bg-gray-700 cursor-pointer"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              Start
            </button>
          </div>
          {user !== "annonymous" && (
            <p className="mt-2 text-xs text-gray-400 truncate">
              Current: {user}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
