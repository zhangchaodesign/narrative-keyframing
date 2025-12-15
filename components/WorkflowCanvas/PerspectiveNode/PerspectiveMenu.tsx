"use client";

import { useCallback } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { TbListSearch, TbPencil, TbCheck, TbRefresh } from "react-icons/tb";

import type {
  PerspectiveNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";
import {
  updatePerspectiveAnalysisState,
  analyzeSinglePerspectiveEvidence,
  regenerateSinglePerspective,
  PERSPECTIVE_MESSAGES,
} from "@/lib/utiils/perspectiveUtils";

type PerspectiveMenuProps = {
  nodeId: string;
  isEditing?: boolean;
  onToggleEdit?: () => void;
};

export function PerspectiveMenu({
  nodeId,
  isEditing = false,
  onToggleEdit,
}: PerspectiveMenuProps) {
  const { setNodes, getNodes, getEdges } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();
  const perspectiveData = useStore((store) => {
    const node = store.nodes.find(
      (candidate): candidate is PerspectiveNodeType =>
        candidate.id === nodeId && candidate.type === "perspective",
    );
    return node?.data as PerspectiveNodeType["data"] | undefined;
  });
  const hasCharacterConnection = useStore((store) =>
    store.edges.some(
      (edge) =>
        edge.target === nodeId &&
        edge.targetHandle === "character" &&
        edge.sourceHandle === "perspective",
    ),
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

    const nodes = getNodes();
    const edges = getEdges();

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
  }, [getEdges, getNodes, isAnalyzingEvidence, nodeId, updateAnalysisState]);

  const handleRegeneratePerspective = useCallback(async () => {
    if (isRegenerating || isEditing || !hasCharacterConnection) {
      return;
    }

    const nodes = getNodes();
    const edges = getEdges();

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
    getEdges,
    getNodes,
    hasCharacterConnection,
    isEditing,
    isRegenerating,
    nodeId,
    setNodes,
  ]);

  return (
    <div className="pointer-events-none absolute -top-9 right-0 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-zinc-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
      <button
        type="button"
        onClick={onToggleEdit}
        className="pointer-events-auto rounded-full p-1 transition hover:bg-purple-50 hover:text-purple-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-purple-500 disabled:cursor-not-allowed disabled:opacity-60"
        title={isEditing ? "Save and finish editing" : "Edit perspective text"}
        aria-label={
          isEditing ? "Save and finish editing" : "Edit perspective text"
        }
        disabled={!hasReflection}
      >
        {isEditing ? <TbCheck size={12} /> : <TbPencil size={12} />}
      </button>
      <button
        type="button"
        onClick={handleAnalyzeEvidence}
        className="pointer-events-auto rounded-full p-1 transition hover:bg-blue-50 hover:text-blue-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
        title="Analyze textual evidence that supports character attributes"
        aria-label="Analyze textual evidence that supports character attributes"
        disabled={isAnalyzingEvidence || !hasReflection || isEditing}
      >
        {isAnalyzingEvidence ? (
          <span className="block h-3 w-3 animate-spin rounded-full border-2 border-blue-600 border-t-transparent align-middle" />
        ) : (
          <TbListSearch size={12} />
        )}
      </button>
      <button
        type="button"
        onClick={handleRegeneratePerspective}
        className="pointer-events-auto rounded-full p-1 transition hover:bg-green-50 hover:text-green-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-500 disabled:cursor-not-allowed disabled:opacity-60"
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
          size={12}
          className={isRegenerating ? "animate-spin" : undefined}
        />
      </button>
    </div>
  );
}
