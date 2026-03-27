"use client";

import { useState } from "react";
import { useStudyStore } from "@/lib/stores/studyStore";
import { useEditorStore } from "@/lib/stores/editorStore";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { SlateUtils } from "@/lib/utiils/slateUtils";
import { combineNarrativeTextsInGroup } from "@/lib/utiils/narrativeUtils";
import { eventTracker } from "@/lib/utils";

/**
 * Full-screen entry panel shown before the user starts a study session.
 * Once "Start" is clicked, the main app panels are revealed.
 */
export function StudyEntryPanel() {
  const [userIdInput, setUserIdInput] = useState("");
  const { setUser, task, setTask, setStarted } = useStudyStore();

  const canStart = userIdInput.trim() !== "" && task !== "";

  const handleStart = () => {
    if (!canStart) return;
    setUser(userIdInput.trim());
    setStarted(true);
    eventTracker({
      action: "start_study",
      data: { user: userIdInput.trim(), task },
    });
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center">
      <div className="w-full max-w-md rounded-2xl bg-white p-8">
        <h1 className="text-2xl font-semibold text-gray-900 text-center mb-2">
          Welcome!
        </h1>
        <p className="text-sm text-gray-500 text-center mb-8">
          Enter your details to begin the study session.
        </p>

        {/* User ID */}
        <label className="block text-sm font-medium text-gray-700 mb-1.5">
          User ID
        </label>
        <input
          type="text"
          value={userIdInput}
          onChange={(e) => setUserIdInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleStart();
          }}
          placeholder="Enter your user ID"
          className="w-full px-4 py-2.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-gray-900 transition-shadow"
          autoFocus
        />

        {/* Task Selection */}
        <label className="block text-sm font-medium text-gray-700 mb-1.5 mt-6">
          Task
        </label>
        <div className="flex gap-3">
          {["partnership", "secret"].map((t) => (
            <button
              key={t}
              onClick={() => setTask(t)}
              className={`flex-1 px-4 py-2.5 text-sm rounded-lg border-2 transition-all font-medium ${
                task === t
                  ? "border-gray-900 bg-gray-900 text-white"
                  : "border-gray-200 text-gray-600 hover:border-gray-400 hover:bg-gray-50"
              }`}
            >
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </button>
          ))}
        </div>

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={!canStart}
          className={`w-full mt-8 px-4 py-3 text-sm font-medium rounded-lg transition-all ${
            canStart
              ? "bg-gray-900 text-white hover:bg-gray-700 cursor-pointer shadow-sm hover:shadow"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          Start Study
        </button>
      </div>
    </div>
  );
}

/**
 * Small inline button shown in the toolbar to end the current study session.
 * Shows a thank-you modal with a survey link after ending.
 */
export function EndStudyButton() {
  const { user, task } = useStudyStore();
  const [showThankYou, setShowThankYou] = useState(false);

  const handleEnd = () => {
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
        (group.data as { narrativeGroupId?: number })?.narrativeGroupId ?? 0,
      combinedNarrative: combineNarrativeTextsInGroup(group.id, nodes),
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
    setShowThankYou(true);
  };

  return (
    <>
      {/* <button
        onClick={handleEnd}
        className="px-3 py-1.5 text-xs font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
      >
        End Study
      </button> */}

      {showThankYou && (
        <div className="fixed inset-0 z-100000 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl text-center">
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              Thank you!
            </h2>
            <p className="text-sm text-gray-500 mb-6">
              Your session has been saved. Please take a moment to fill out our
              survey.
            </p>
            <a
              href="https://cornell.ca1.qualtrics.com/jfe/form/SV_0TFt6Iqg0vLFazI"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block w-full px-4 py-3 text-sm font-medium rounded-lg bg-gray-900 text-white hover:bg-gray-700 transition-colors"
            >
              Take Survey
            </a>
            <button
              onClick={() => setShowThankYou(false)}
              className="mt-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
