"use client";

import { useCallback, useState } from "react";
import { useReactFlow, useStore } from "@xyflow/react";
import { TbListSearch, TbPlayerPlay, TbPencil, TbCheck } from "react-icons/tb";

import type {
  PerspectiveNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";
import {
  preparePerspectiveRequest,
  type GeneratePerspectiveResponse,
} from "@/lib/workflow/workflowPerspective";
import {
  prepareEvidenceAnalysis,
  type EvidenceAnalysisResponse,
} from "@/lib/workflow/workflowEvidence";

type PerspectiveMenuProps = {
  nodeId: string;
  isEditing?: boolean;
  onToggleEdit?: () => void;
};

const READY_TO_ANALYZE_MESSAGE = "Ready to analyze evidence.";
const NEED_REFLECTION_MESSAGE = "Add a reflection to analyze evidence.";
const ANALYZING_EVIDENCE_MESSAGE = "Analyzing evidence...";
const ANALYSIS_FAILED_MESSAGE = "Evidence analysis failed. Try again.";
const NO_CHARACTERS_MESSAGE = "No characters available to analyze.";
const NO_EVIDENCE_FOUND_MESSAGE = "No supporting evidence found.";

export function PerspectiveMenu({
  nodeId,
  isEditing = false,
  onToggleEdit,
}: PerspectiveMenuProps) {
  const { setNodes, getNode, getNodes, getEdges } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();
  const [isGenerating, setIsGenerating] = useState(false);
  const perspectiveData = useStore((store) => {
    const node = store.nodes.find(
      (candidate): candidate is PerspectiveNodeType =>
        candidate.id === nodeId && candidate.type === "perspective",
    );
    return node?.data as PerspectiveNodeType["data"] | undefined;
  });
  const isAnalyzingEvidence = perspectiveData?.isAnalyzingEvidence ?? false;
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

  const handleGeneratePerspectives = useCallback(
    async (targetNodeIds?: string[]) => {
      if (isGenerating) {
        return;
      }

      const nodes = getNodes();
      const edges = getEdges();

      setIsGenerating(true);
      let loadingNodeIds: Set<string> | null = null;

      try {
        const preparation = preparePerspectiveRequest({
          nodes,
          edges,
          targetNodeIds,
        });

        if (!preparation) {
          return;
        }

        const { eventSequence, tasks } = preparation;

        loadingNodeIds = new Set(tasks.map((task) => task.id));
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.type !== "perspective") {
              return node;
            }

            const existingData = node.data as PerspectiveNodeType["data"];
            return {
              ...node,
              data: {
                ...existingData,
                isLoading: loadingNodeIds?.has(node.id) ?? false,
              },
            };
          }),
        );

        const response = await fetch("/api/perspective", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventSequence,
            perspectives: tasks,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          const errorMessage =
            (errorBody && errorBody.error) ||
            `Failed to generate perspectives (${response.status}).`;
          throw new Error(errorMessage);
        }

        const data = (await response.json()) as GeneratePerspectiveResponse;
        const perspectives = data?.perspectives ?? [];

        const orderedUpdates = perspectives
          .map((item, index) => {
            const task = tasks[index];
            if (!task) {
              return null;
            }
            return [task.id, item.reflection] as const;
          })
          .filter((entry): entry is readonly [string, string] => entry != null);

        if (orderedUpdates.length === 0) {
          return;
        }

        if (perspectives.length !== tasks.length) {
          console.warn(
            "Perspective response count did not match requested tasks.",
            {
              requested: tasks.length,
              received: perspectives.length,
            },
          );
        }

        const updateMap = new Map<string, string>(orderedUpdates);

        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.type === "perspective" && updateMap.has(node.id)) {
              const reflection = updateMap.get(node.id) ?? "";
              const existingData = node.data as PerspectiveNodeType["data"];
              const hasContent = reflection.trim().length > 0;
              return {
                ...node,
                data: {
                  ...existingData,
                  reflection,
                  isAnalyzingEvidence: false,
                  analysisStatus: "idle",
                  analysisStatusMessage: hasContent
                    ? undefined
                    : NEED_REFLECTION_MESSAGE,
                  analysisEvidence: hasContent ? [] : undefined,
                },
              };
            }
            return node;
          }),
        );
      } catch (error) {
        console.error("Error generating perspectives:", error);
      } finally {
        if (loadingNodeIds) {
          setNodes((currentNodes) =>
            currentNodes.map((node) => {
              if (node.type !== "perspective") {
                return node;
              }
              if (!loadingNodeIds?.has(node.id)) {
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
        setIsGenerating(false);
      }
    },
    [isGenerating, getNodes, getEdges, setNodes],
  );

  const handleAnalyzeEvidence = useCallback(async () => {
    if (isAnalyzingEvidence) {
      return;
    }

    const nodes = getNodes();
    const edges = getEdges();
    const target = prepareEvidenceAnalysis({
      perspectiveId: nodeId,
      nodes,
      edges,
    });

    if (!target) {
      console.warn(
        "No evidence analysis targets found for perspective:",
        nodeId,
      );
      updateAnalysisState({
        isAnalyzingEvidence: false,
        analysisStatus: "idle",
        analysisStatusMessage: hasReflection
          ? NO_CHARACTERS_MESSAGE
          : NEED_REFLECTION_MESSAGE,
        analysisEvidence: [],
      });
      return;
    }

    if (!target.reflection.trim()) {
      console.warn("Cannot analyze evidence for an empty reflection:", nodeId);
      updateAnalysisState({
        isAnalyzingEvidence: false,
        analysisStatus: "idle",
        analysisStatusMessage: NEED_REFLECTION_MESSAGE,
        analysisEvidence: [],
      });
      return;
    }

    const hasCharacterAttributes = target.characters.some((character) =>
      character.attributes.some(
        (attribute) => attribute.value.trim().length > 0,
      ),
    );

    if (!hasCharacterAttributes) {
      updateAnalysisState({
        isAnalyzingEvidence: false,
        analysisStatus: "idle",
        analysisStatusMessage: NO_CHARACTERS_MESSAGE,
        analysisEvidence: [],
      });
      return;
    }

    updateAnalysisState({
      isAnalyzingEvidence: true,
      analysisStatus: "running",
      analysisStatusMessage: ANALYZING_EVIDENCE_MESSAGE,
      analysisEvidence: [],
    });

    try {
      const response = await fetch("/api/evidence", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(target),
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        const errorMessage =
          (errorBody && errorBody.error) ||
          `Failed to analyze evidence (${response.status}).`;
        throw new Error(errorMessage);
      }

      const data = (await response.json()) as EvidenceAnalysisResponse | null;
      console.log("Evidence analysis result:", data);
      const evidence = data?.characterEvidence ?? [];
      const supportedCharacters = evidence.filter(
        (entry) => entry.items.length > 0,
      );
      const uniqueCharacterNames = [
        ...new Set(supportedCharacters.map((entry) => entry.characterName)),
      ];
      const successMessage =
        uniqueCharacterNames.length > 0
          ? uniqueCharacterNames
              .map((name) => `Found evidence for ${name}`)
              .join(", ")
          : NO_EVIDENCE_FOUND_MESSAGE;
      updateAnalysisState({
        isAnalyzingEvidence: false,
        analysisStatus: "success",
        analysisStatusMessage: successMessage,
        analysisEvidence: evidence,
      });
    } catch (error) {
      console.error("Error analyzing character evidence:", error);
      updateAnalysisState({
        isAnalyzingEvidence: false,
        analysisStatus: "error",
        analysisStatusMessage: ANALYSIS_FAILED_MESSAGE,
        analysisEvidence: [],
      });
    }
  }, [
    getEdges,
    getNodes,
    hasReflection,
    isAnalyzingEvidence,
    nodeId,
    updateAnalysisState,
  ]);

  const handleRun = useCallback(() => {
    const currentNode = getNode(nodeId);
    const parentId = (currentNode as { parentId?: string }).parentId;
    const siblingPerspectiveIds = getNodes()
      .filter(
        (node) => node.type === "perspective" && node.parentId === parentId,
      )
      .map((node) => node.id);

    if (!parentId || !currentNode || siblingPerspectiveIds.length === 0) {
      return;
    }

    handleGeneratePerspectives(siblingPerspectiveIds);
  }, [getNode, getNodes, nodeId, handleGeneratePerspectives]);

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
        onClick={handleRun}
        className="pointer-events-auto rounded-full p-1 transition hover:bg-green-50 hover:text-green-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-500 disabled:cursor-not-allowed disabled:opacity-60"
        title="Generate first-person limited narration"
        aria-label="Generate first-person limited narration"
        disabled={isGenerating || isEditing}
      >
        <TbPlayerPlay size={12} />
      </button>
    </div>
  );
}
