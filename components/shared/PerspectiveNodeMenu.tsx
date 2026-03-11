"use client";

import { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { TbListSearch, TbRefresh } from "react-icons/tb";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import type { PerspectiveNodeType } from "@/lib/types/workflow";
import {
  analyzeSinglePerspectiveEvidence,
  regenerateSinglePerspective,
  PERSPECTIVE_MESSAGES,
} from "@/lib/utiils/perspectiveUtils";
import { cn } from "@/lib/utiils/sharedUtils";
import { TbPencil, TbCheck } from "react-icons/tb";
import { eventTracker } from "@/lib/utils";

type PerspectiveSingleActionsMenuProps = {
  nodeId: string;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  wrapperClassName?: string;
  buttonPadding?: string;
  iconSize?: number;
};

export function PerspectiveSingleActionsMenu({
  nodeId,
  isEditing = false,
  onToggleEdit,
  wrapperClassName = "flex items-center gap-1",
  buttonPadding = "p-1",
  iconSize = 12,
}: PerspectiveSingleActionsMenuProps) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const getPerspectiveEvidenceTarget = useWorkflowStore(
    (state) => state.getPerspectiveEvidenceTarget,
  );
  const preparePerspectiveGeneration = useWorkflowStore(
    (state) => state.preparePerspectiveGeneration,
  );
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");

  const perspectiveNode = nodes.find(
    (node): node is PerspectiveNodeType =>
      node.id === nodeId && node.type === "perspective",
  );
  const perspectiveData = perspectiveNode?.data;

  const handleToggleEdit = useCallback(() => {
    eventTracker({
      action: isEditing ? "save_perspective_edit" : "start_perspective_edit",
      data: {
        narrator: perspectiveData?.narrator,
        reflection: perspectiveData?.reflection,
      },
    });
    onToggleEdit?.();
  }, [isEditing, onToggleEdit, perspectiveData]);

  const hasCharacterConnection = useMemo(
    () =>
      edges.some(
        (edge) =>
          edge.target === nodeId &&
          edge.targetHandle === "character" &&
          edge.sourceHandle === "perspective",
      ),
    [edges, nodeId],
  );

  const isAnalyzingEvidence = perspectiveData?.isAnalyzingEvidence ?? false;
  const isRegenerating = perspectiveData?.isLoading ?? false;
  const hasReflection = Boolean(perspectiveData?.reflection?.trim());

  const updateAnalysisState = useCallback(
    (patch: Partial<PerspectiveNodeType["data"]>) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== nodeId || node.type !== "perspective") {
            return node;
          }
          const existingData = node.data as PerspectiveNodeType["data"];
          return {
            ...node,
            data: {
              ...existingData,
              ...patch,
            },
          };
        }),
      );
    },
    [nodeId, setNodes],
  );

  const handleAnalyzeEvidence = useCallback(async () => {
    if (isAnalyzingEvidence) {
      return;
    }

    eventTracker({
      action: "analyze_single_perspective_evidence",
      data: {
        narrator: perspectiveData?.narrator,
        reflection: perspectiveData?.reflection,
        analysisStatus: perspectiveData?.analysisStatus,
      },
    });

    updateAnalysisState({
      isAnalyzingEvidence: true,
      analysisStatus: "running",
      analysisStatusMessage: PERSPECTIVE_MESSAGES.ANALYZING,
      analysisEvidence: [],
    });

    const target = getPerspectiveEvidenceTarget(nodeId);
    const result = await analyzeSinglePerspectiveEvidence(target);

    updateAnalysisState({
      isAnalyzingEvidence: false,
      analysisStatus: result.success ? "success" : "idle",
      analysisStatusMessage: result.message,
      analysisEvidence: result.evidence,
    });
  }, [
    getPerspectiveEvidenceTarget,
    isAnalyzingEvidence,
    nodeId,
    perspectiveData,
    updateAnalysisState,
  ]);

  const computeNeighborReflections = useCallback(() => {
    const perspectiveNode = nodes.find(
      (node): node is PerspectiveNodeType =>
        node.id === nodeId && node.type === "perspective",
    );

    if (!perspectiveNode?.parentId) {
      return { previousPerspective: undefined, nextPerspective: undefined };
    }

    const siblings = nodes.filter(
      (node): node is PerspectiveNodeType =>
        node.type === "perspective" &&
        node.parentId === perspectiveNode.parentId,
    );
    const sortedSiblings = [...siblings].sort(
      (a, b) => a.position.x - b.position.x || a.position.y - b.position.y,
    );
    const currentIndex = sortedSiblings.findIndex(
      (node) => node.id === perspectiveNode.id,
    );

    let previousPerspective: string | undefined;
    let nextPerspective: string | undefined;

    if (currentIndex > 0) {
      const content =
        sortedSiblings[currentIndex - 1].data?.reflection?.trim() ?? "";
      if (content.length > 0) {
        previousPerspective = content;
      }
    }

    if (currentIndex >= 0 && currentIndex < sortedSiblings.length - 1) {
      const content =
        sortedSiblings[currentIndex + 1].data?.reflection?.trim() ?? "";
      if (content.length > 0) {
        nextPerspective = content;
      }
    }

    return { previousPerspective, nextPerspective };
  }, [nodeId, nodes]);

  const handleRegeneratePerspective = useCallback(
    async (prompt?: string) => {
    if (isRegenerating || isEditing || !hasCharacterConnection) {
      return;
    }

    eventTracker({
      action: "regenerate_single_perspective",
      data: {
        perspectiveId: nodeId,
        narrator: perspectiveData?.narrator,
        reflection: perspectiveData?.reflection,
        customPrompt: prompt || "",
      },
    });

    setNodes((currentNodes) =>
      currentNodes.map((node) => {
        if (node.id !== nodeId || node.type !== "perspective") {
          return node;
        }
        const existingData = node.data as PerspectiveNodeType["data"];
        return {
          ...node,
          data: {
            ...existingData,
            isLoading: true,
          },
        };
      }),
    );

    try {
      const preparation = preparePerspectiveGeneration([nodeId]);
      if (!preparation) {
        throw new Error("Unable to prepare regeneration payload");
      }

      const { previousPerspective, nextPerspective } =
        computeNeighborReflections();

      const reflection = await regenerateSinglePerspective({
        preparation,
        previousPerspective,
        nextPerspective,
        customPrompt: prompt,
      });
      const hasContent = reflection.trim().length > 0;

      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== nodeId || node.type !== "perspective") {
            return node;
          }

          const existingData = node.data as PerspectiveNodeType["data"];
          return {
            ...node,
            data: {
              ...existingData,
              reflection,
              isLoading: false,
              isAnalyzingEvidence: false,
              analysisStatus: "idle",
              analysisStatusMessage: hasContent
                ? undefined
                : PERSPECTIVE_MESSAGES.NEED_REFLECTION,
              analysisEvidence: hasContent ? [] : undefined,
            },
          };
        }),
      );
    } catch (error) {
      console.error("Error regenerating perspective:", error);
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== nodeId || node.type !== "perspective") {
            return node;
          }

          const existingData = node.data as PerspectiveNodeType["data"];
          return {
            ...node,
            data: {
              ...existingData,
              isLoading: false,
            },
          };
        }),
      );
    }
    },
    [
      computeNeighborReflections,
      hasCharacterConnection,
      isEditing,
      isRegenerating,
      nodeId,
      perspectiveData,
      preparePerspectiveGeneration,
      setNodes,
    ],
  );

  const handleRegenerateAndAnalyze = useCallback(
    async (prompt?: string) => {
    if (isRegenerating || isAnalyzingEvidence || isEditing) {
      return;
    }

      await handleRegeneratePerspective(prompt);
      await handleAnalyzeEvidence();
    },
    [
      handleAnalyzeEvidence,
      handleRegeneratePerspective,
      isAnalyzingEvidence,
      isEditing,
      isRegenerating,
    ],
  );

  const handleClosePromptDialog = useCallback(() => {
    setShowPromptDialog(false);
    setCustomPrompt("");
  }, []);

  const handleConfirmRegenerate = useCallback(async () => {
    const trimmedPrompt = customPrompt.trim();
    setShowPromptDialog(false);
    setCustomPrompt("");
    await handleRegenerateAndAnalyze(
      trimmedPrompt.length > 0 ? trimmedPrompt : undefined,
    );
  }, [customPrompt, handleRegenerateAndAnalyze]);

  const promptDialogContent = showPromptDialog && (
    <div className="fixed inset-0 z-10000 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded bg-white p-4">
        <fieldset className="fieldset">
          <legend className="fieldset-legend">Custom Prompt (Optional)</legend>
          <textarea
            value={customPrompt}
            onChange={(event) => setCustomPrompt(event.target.value)}
            placeholder="E.g., Emphasize tension, keep the tone subdued..."
            rows={4}
            className="textarea w-full text-xs rounded"
          ></textarea>
        </fieldset>
        <div className="mt-4 flex justify-end gap-3">
          <button onClick={handleClosePromptDialog} className="btn btn-sm">
            Cancel
          </button>
          <button
            onClick={handleConfirmRegenerate}
            disabled={isRegenerating || isAnalyzingEvidence}
            className="btn btn-sm btn-neutral"
          >
            {isRegenerating ? "Regenerating..." : "Regenerate"}
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div className={cn(wrapperClassName)}>
        <button
          type="button"
          onClick={handleToggleEdit}
          className={cn(
            "pointer-events-auto rounded-full transition hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-purple-500 disabled:cursor-not-allowed disabled:opacity-60",
            buttonPadding,
          )}
          title={
            isEditing ? "Save and finish editing" : "Edit perspective text"
          }
          aria-label={
            isEditing ? "Save and finish editing" : "Edit perspective text"
          }
          disabled={!hasReflection}
        >
          {isEditing ? (
            <TbCheck size={iconSize} />
          ) : (
            <TbPencil size={iconSize} />
          )}
        </button>
        <button
          type="button"
          onClick={handleAnalyzeEvidence}
          className={cn(
            "pointer-events-auto rounded-full transition hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60",
            buttonPadding,
          )}
          title="Analyze textual evidence that supports character attributes"
          aria-label="Analyze textual evidence that supports character attributes"
          disabled={isAnalyzingEvidence || !hasReflection || isEditing}
        >
          {isAnalyzingEvidence ? (
            <span
              className="block animate-spin rounded-full border-2 border-blue-600 border-t-transparent align-middle"
              style={{ width: iconSize, height: iconSize }}
            />
          ) : (
            <TbListSearch size={iconSize} />
          )}
        </button>
        <button
          type="button"
          onClick={() => setShowPromptDialog(true)}
          className={cn(
            "pointer-events-auto rounded-full transition hover:bg-green-50 hover:text-green-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-500 disabled:cursor-not-allowed disabled:opacity-60",
            buttonPadding,
          )}
          title={
            hasCharacterConnection
              ? "Regenerate this perspective from its character snapshot"
              : "Connect a character to regenerate this perspective"
          }
          aria-label={
            hasCharacterConnection
              ? "Regenerate this perspective from its character snapshot"
              : "Connect a character to regenerate this perspective"
          }
          disabled={isRegenerating || isEditing || !hasCharacterConnection}
        >
          <TbRefresh
            size={iconSize}
            className={isRegenerating ? "animate-spin" : undefined}
          />
        </button>
      </div>
      {promptDialogContent && createPortal(promptDialogContent, document.body)}
    </>
  );
}
