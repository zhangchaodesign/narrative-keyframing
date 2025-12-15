"use client";

import { useCallback, useMemo } from "react";
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

  const perspectiveNode = nodes.find(
    (node): node is PerspectiveNodeType =>
      node.id === nodeId && node.type === "perspective",
  );
  const perspectiveData = perspectiveNode?.data;

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

    updateAnalysisState({
      isAnalyzingEvidence: true,
      analysisStatus: "running",
      analysisStatusMessage: PERSPECTIVE_MESSAGES.ANALYZING,
      analysisEvidence: [],
    });

    const result = await analyzeSinglePerspectiveEvidence(nodeId, nodes, edges);

    updateAnalysisState({
      isAnalyzingEvidence: false,
      analysisStatus: result.success ? "success" : "idle",
      analysisStatusMessage: result.message,
      analysisEvidence: result.evidence,
    });
  }, [edges, isAnalyzingEvidence, nodeId, nodes, updateAnalysisState]);

  const handleRegeneratePerspective = useCallback(async () => {
    if (isRegenerating || isEditing || !hasCharacterConnection) {
      return;
    }

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
      const reflection = await regenerateSinglePerspective(
        nodeId,
        nodes,
        edges,
      );
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
  }, [
    edges,
    hasCharacterConnection,
    isEditing,
    isRegenerating,
    nodeId,
    nodes,
    setNodes,
  ]);

  return (
    <div className={cn(wrapperClassName)}>
      <button
        type="button"
        onClick={onToggleEdit}
        className={cn(
          "pointer-events-auto rounded-full transition hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-purple-500 disabled:cursor-not-allowed disabled:opacity-60",
          buttonPadding,
        )}
        title={isEditing ? "Save and finish editing" : "Edit perspective text"}
        aria-label={
          isEditing ? "Save and finish editing" : "Edit perspective text"
        }
        disabled={!hasReflection}
      >
        {isEditing ? <TbCheck size={iconSize} /> : <TbPencil size={iconSize} />}
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
        onClick={handleRegeneratePerspective}
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
  );
}
