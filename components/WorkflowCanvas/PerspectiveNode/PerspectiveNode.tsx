"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Position, type NodeProps } from "@xyflow/react";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import { PerspectiveHandle } from "@/components/WorkflowCanvas/PerspectiveNode/PerspectiveHandle";
import { PerspectiveSingleActionsMenu } from "@/components/shared/PerspectiveNodeMenu";
import { AddCharacterButton } from "@/components/shared/CharacterSnapshotButton";
import { PerspectiveContent } from "@/components/shared/PerspectiveContent";
import { PerspectiveStatusLabel } from "@/components/shared/PerspectiveStatusLabel";
import type {
  CharacterNodeType,
  EventNodeType,
  PerspectiveGroupNodeType,
  PerspectiveNodeType,
  WorkflowNode,
} from "@/lib/types/workflow";
import { cn } from "@/lib/utiils/sharedUtils";
import { getCharacterColors } from "@/components/shared/colors.constants";
import { createCharacterSnapshotFromPerspective } from "@/lib/utiils/characterUtils";
import { geistMono } from "@/app/fonts";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import {
  analyzeSinglePerspectiveEvidence,
  PERSPECTIVE_MESSAGES,
  regenerateSinglePerspective,
} from "@/lib/utiils/perspectiveUtils";

export function PerspectiveNode({ id, data }: NodeProps<PerspectiveNodeType>) {
  const colors = getCharacterColors(data?.narrator ?? id);
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const setEdges = useWorkflowStore((state) => state.setEdges);
  const isLoading = data?.isLoading ?? false;
  const isAnalyzingEvidence = data?.isAnalyzingEvidence ?? false;
  const analysisStatus = data?.analysisStatus ?? "idle";
  const analysisStatusMessage = data?.analysisStatusMessage?.trim();
  const hasReflectionContent = Boolean(data?.reflection?.trim());

  const [isEditing, setIsEditing] = useState(false);
  const [editedReflection, setEditedReflection] = useState(
    data?.reflection ?? "",
  );
  const isInterpolatingCharacter = data?.isCreatingSnapshot ?? false;

  const hasDirectCharacter = useMemo(() => {
    const characterNode = nodes.find(
      (node): node is CharacterNodeType =>
        node.type === "character" &&
        (node.data as CharacterNodeType["data"])?.perspectiveId === id,
    );
    return Boolean(characterNode);
  }, [id, nodes]);

  // Calculate perspective sequence number based on position
  const perspectiveSequence = useMemo(() => {
    const currentNode = nodes.find((node) => node.id === id);
    if (!currentNode) return 1;

    const perspectiveNodes = nodes
      .filter((node) => node.type === "perspective")
      .filter((node) => node.parentId === currentNode.parentId)
      .sort((a, b) => a.position.x - b.position.x);
    const index = perspectiveNodes.findIndex((node) => node.id === id);
    return index >= 0 ? index + 1 : 1;
  }, [id, nodes]);

  // Determine which event group (story draft) this perspective group is linked to
  const connectedEventGroup = useMemo(() => {
    const perspectiveNode = nodes.find(
      (node): node is PerspectiveNodeType =>
        node.id === id && node.type === "perspective",
    );
    if (!perspectiveNode?.parentId) {
      return undefined;
    }
    const perspectiveGroup = nodes.find(
      (node): node is PerspectiveGroupNodeType =>
        node.id === perspectiveNode.parentId &&
        node.type === "perspectiveGroup",
    );
    return perspectiveGroup?.data?.connectedEventGroup;
  }, [id, nodes]);

  // Find the event node and related metadata for display using index-based matching
  const eventMetadata = useMemo(() => {
    const perspectiveNode = nodes.find(
      (node): node is PerspectiveNodeType =>
        node.id === id && node.type === "perspective",
    );
    if (!perspectiveNode) {
      return null;
    }

    const parentGroupId = perspectiveNode.parentId;
    if (!parentGroupId) {
      return null;
    }

    // Get all perspectives in the same group, sorted by position
    const siblingPerspectives = nodes
      .filter(
        (node): node is PerspectiveNodeType =>
          node.type === "perspective" && node.parentId === parentGroupId,
      )
      .sort((a, b) => (a.position.x ?? 0) - (b.position.x ?? 0));

    // Find index of current perspective
    const perspectiveIndex = siblingPerspectives.findIndex(
      (node) => node.id === id,
    );

    if (perspectiveIndex < 0) {
      return null;
    }

    // Get all event nodes sorted by position
    const eventNodes = nodes
      .filter((node): node is EventNodeType => node.type === "event")
      .sort((a, b) => (a.position.x ?? 0) - (b.position.x ?? 0));

    // Get event at the same index
    const eventNode =
      eventNodes[Math.min(perspectiveIndex, eventNodes.length - 1)];

    const timelineLabel =
      eventNode?.data?.timeline ?? `Plot ${perspectiveIndex + 1}`;
    const clusterLabel = connectedEventGroup?.label?.trim() ?? "";
    const clusterId = connectedEventGroup?.eventGroupId;
    const assembledDisplay = [clusterLabel, clusterId]
      .filter((value) => value !== undefined && value !== "")
      .join(" ")
      .trim();
    const clusterDisplay =
      assembledDisplay.length > 0 ? assembledDisplay : undefined;

    return {
      timelineLabel,
      clusterDisplay,
    };
  }, [connectedEventGroup, id, nodes]);

  // keep character nodes aligned with perspective node
  useEffect(() => {
    const perspectiveNode = nodes.find(
      (node): node is PerspectiveNodeType =>
        node.id === id && node.type === "perspective",
    );
    if (!perspectiveNode) {
      return;
    }

    const connectedCharacterIds = edges
      .filter(
        (edge) =>
          edge.target === id &&
          edge.targetHandle === "character" &&
          edge.sourceHandle === "perspective",
      )
      .map((edge) => edge.source);
    if (connectedCharacterIds.length === 0) {
      return;
    }

    const uniqueCharacterIds = new Set(connectedCharacterIds);
    const connectedCharacters = nodes.filter(
      (node): node is CharacterNodeType =>
        node.type === "character" && uniqueCharacterIds.has(node.id),
    );
    if (connectedCharacters.length === 0) {
      return;
    }

    const targetX = perspectiveNode.position.x;
    const needsAlignment = connectedCharacters.some(
      (characterNode) => Math.abs(characterNode.position.x - targetX) > 0.5,
    );
    if (!needsAlignment) {
      return;
    }

    setNodes((nodesState) =>
      nodesState.map((nodeState) => {
        if (
          nodeState.type === "character" &&
          uniqueCharacterIds.has(nodeState.id)
        ) {
          return {
            ...nodeState,
            position: {
              ...nodeState.position,
              x: targetX,
            },
          } as WorkflowNode;
        }
        return nodeState;
      }),
    );
  }, [edges, id, nodes, setNodes]);

  const getPerspectiveEvidenceTarget = useWorkflowStore(
    (state) => state.getPerspectiveEvidenceTarget,
  );
  const preparePerspectiveGeneration = useWorkflowStore(
    (state) => state.preparePerspectiveGeneration,
  );
  const syncSelectedSnippetsFromEvidence = useWorkflowStore(
    (state) => state.syncSelectedSnippetsFromEvidence,
  );

  const computeNeighborReflections = useCallback(() => {
    const perspectiveNode = nodes.find(
      (node): node is PerspectiveNodeType =>
        node.id === id && node.type === "perspective",
    );
    if (!perspectiveNode || !perspectiveNode.parentId) {
      return {};
    }

    const sortedSiblings = nodes
      .filter(
        (node): node is PerspectiveNodeType =>
          node.type === "perspective" &&
          node.parentId === perspectiveNode.parentId,
      )
      .sort((a, b) => a.position.x - b.position.x);

    const currentIndex = sortedSiblings.findIndex((node) => node.id === id);
    if (currentIndex < 0) {
      return {};
    }

    let previousPerspective: string | undefined;
    let nextPerspective: string | undefined;

    if (currentIndex > 0) {
      const content =
        sortedSiblings[currentIndex - 1]?.data?.reflection?.trim() ?? "";
      if (content.length > 0) {
        previousPerspective = content;
      }
    }

    if (currentIndex < sortedSiblings.length - 1) {
      const content =
        sortedSiblings[currentIndex + 1]?.data?.reflection?.trim() ?? "";
      if (content.length > 0) {
        nextPerspective = content;
      }
    }

    return { previousPerspective, nextPerspective };
  }, [id, nodes]);

  const handleDismissUpdatePrompt = useCallback(() => {
    setNodes((nodesState) =>
      nodesState.map((node) => {
        if (node.id !== id || node.type !== "perspective") {
          return node;
        }
        const existingData = node.data as PerspectiveNodeType["data"];
        return {
          ...node,
          data: {
            ...existingData,
            showUpdatePrompt: false,
          },
        };
      }),
    );
  }, [id, setNodes]);

  const handleConfirmUpdatePrompt = useCallback(async () => {
    if (isAnalyzingEvidence) {
      return;
    }

    // Dismiss the prompt and start regeneration + analysis.
    setNodes((nodesState) =>
      nodesState.map((node) => {
        if (node.id !== id || node.type !== "perspective") {
          return node;
        }
        const existingData = node.data as PerspectiveNodeType["data"];
        return {
          ...node,
          data: {
            ...existingData,
            showUpdatePrompt: false,
            isLoading: true,
            isAnalyzingEvidence: true,
            analysisStatus: "running",
            analysisStatusMessage: PERSPECTIVE_MESSAGES.ANALYZING,
            analysisEvidence: [],
          },
        };
      }),
    );

    try {
      const preparation = preparePerspectiveGeneration([id]);
      const { previousPerspective, nextPerspective } =
        computeNeighborReflections();
      const reflection = await regenerateSinglePerspective({
        preparation,
        previousPerspective,
        nextPerspective,
      });

      const target = getPerspectiveEvidenceTarget(id);
      const result = await analyzeSinglePerspectiveEvidence(
        target ? { ...target, reflection } : target,
      );
      const hasContent = reflection.trim().length > 0;

      setNodes((nodesState) =>
        nodesState.map((node) => {
          if (node.id !== id || node.type !== "perspective") {
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
              analysisStatus: result.success ? "success" : "idle",
              analysisStatusMessage: hasContent
                ? result.message
                : PERSPECTIVE_MESSAGES.NEED_REFLECTION,
              analysisEvidence: hasContent ? result.evidence : [],
            },
          };
        }),
      );
      syncSelectedSnippetsFromEvidence();
    } catch (error) {
      console.error("Error regenerating perspective:", error);
      setNodes((nodesState) =>
        nodesState.map((node) => {
          if (node.id !== id || node.type !== "perspective") {
            return node;
          }
          const existingData = node.data as PerspectiveNodeType["data"];
          return {
            ...node,
            data: {
              ...existingData,
              isLoading: false,
              isAnalyzingEvidence: false,
            },
          };
        }),
      );
    }
  }, [
    computeNeighborReflections,
    getPerspectiveEvidenceTarget,
    isAnalyzingEvidence,
    id,
    preparePerspectiveGeneration,
    setNodes,
    syncSelectedSnippetsFromEvidence,
  ]);

  const handleToggleEdit = useCallback(() => {
    if (isEditing) {
      // Save the edited reflection
      setNodes((nodesState) =>
        nodesState.map((node) => {
          if (node.id === id && node.type === "perspective") {
            const existingData = node.data as PerspectiveNodeType["data"];
            return {
              ...node,
              data: {
                ...existingData,
                reflection: editedReflection,
                // Clear evidence analysis when reflection is edited
                analysisEvidence: [],
                analysisStatus: "idle",
                analysisStatusMessage: undefined,
              },
            };
          }

          if (
            node.type === "character" &&
            (node.data as CharacterNodeType["data"])?.perspectiveId === id
          ) {
            const existingData = node.data as CharacterNodeType["data"];
            return {
              ...node,
              data: {
                ...existingData,
                showUpdatePrompt: true,
              },
            };
          }

          return node;
        }),
      );
      setIsEditing(false);
    } else {
      // Enter edit mode
      setEditedReflection(data?.reflection ?? "");
      setIsEditing(true);
    }
  }, [isEditing, editedReflection, data?.reflection, id, setNodes]);

  const handleReflectionChange = useCallback((newReflection: string) => {
    setEditedReflection(newReflection);
  }, []);

  // function to create a new character node linked to this perspective
  const handleCreateCharacterSnapshot = useCallback(async () => {
    if (isInterpolatingCharacter) {
      return;
    }

    const hasCharacterEdge = edges.some(
      (edge) => edge.target === id && edge.targetHandle === "character",
    );
    if (hasCharacterEdge) {
      return;
    }

    const workflowNodes = nodes as WorkflowNode[];
    const perspectiveNode = workflowNodes.find(
      (node): node is PerspectiveNodeType =>
        node.id === id && node.type === "perspective",
    );
    if (!perspectiveNode) {
      return;
    }

    const perspectiveData = perspectiveNode.data as PerspectiveNodeType["data"];
    const fallbackNarratorName =
      perspectiveData?.narrator?.trim() || "New Character";

    setNodes((nodesState) =>
      nodesState.map((node) => {
        if (node.id !== id || node.type !== "perspective") {
          return node;
        }
        const existingData = node.data as PerspectiveNodeType["data"];
        return {
          ...node,
          data: {
            ...existingData,
            isCreatingSnapshot: true,
          },
        };
      }),
    );
    try {
      await createCharacterSnapshotFromPerspective({
        perspectiveNodeId: id,
        nodes: workflowNodes,
        fallbackNarratorName,
        setNodes,
        setEdges,
      });
    } catch (error) {
      console.error("Error creating character keyframe:", error);
    } finally {
      setNodes((nodesState) =>
        nodesState.map((node) => {
          if (node.id !== id || node.type !== "perspective") {
            return node;
          }
          const existingData = node.data as PerspectiveNodeType["data"];
          return {
            ...node,
            data: {
              ...existingData,
              isCreatingSnapshot: false,
            },
          };
        }),
      );
    }
  }, [edges, id, isInterpolatingCharacter, nodes, setEdges, setNodes]);

  return (
    <div
      className={cn(
        "group relative flex gap-2 h-48 w-64 flex-col rounded-lg border-2 bg-white p-3 text-xs hover:shadow-lg",
        colors.border,
      )}
    >
      {data?.showUpdatePrompt && !isAnalyzingEvidence && (
        <div className="absolute inset-0 z-30 flex items-center justify-center rounded-lg bg-black/10 p-3 text-center text-white backdrop-blur-xs">
          <div className="w-full max-w-xs rounded-lg bg-white/90 p-3 text-gray-900 shadow-lg">
            <p className="text-xs font-medium">
              Regenerate perspective and re-analyze with latest character
              traits?
            </p>
            <div className="mt-3 flex justify-center gap-2">
              <button
                type="button"
                onClick={handleDismissUpdatePrompt}
                className="btn btn-xs"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={handleConfirmUpdatePrompt}
                className="btn btn-xs btn-neutral"
              >
                Regenerate
              </button>
            </div>
          </div>
        </div>
      )}
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-white/80 backdrop-blur-sm">
          <span className="loading loading-spinner text-secondary"></span>
          <span className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-secondary">
            Preparing perspective...
          </span>
        </div>
      )}
      <PerspectiveSingleActionsMenu
        nodeId={id}
        isEditing={isEditing}
        onToggleEdit={handleToggleEdit}
        wrapperClassName="pointer-events-none absolute -top-9 right-0 flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 text-gray-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
      />
      <div
        className={cn(
          geistMono.className,
          "flex flex-col w-full gap-1 text-[10px] font-semibold tracking-wide text-gray-800 uppercase",
        )}
      >
        <span className="flex items-center">
          💬 Perspective {perspectiveSequence}
        </span>
        <PerspectiveStatusLabel
          isAnalyzingEvidence={isAnalyzingEvidence}
          analysisStatus={analysisStatus}
          analysisStatusMessage={analysisStatusMessage}
          hasReflectionContent={hasReflectionContent}
        />
      </div>

      <PerspectiveContent
        perspectiveNodeId={id}
        reflection={data?.reflection ?? ""}
        analysisEvidence={data?.analysisEvidence}
        isEditing={isEditing}
        onReflectionChange={handleReflectionChange}
        classes="text-[10px]"
      />
      {eventMetadata && (
        <div className="mt-1 flex justify-end gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded text-[9px] font-semibold tracking-wide text-gray-500",
            )}
            title={`Plot: ${eventMetadata.timelineLabel}`}
          >
            {eventMetadata.clusterDisplay
              ? `${eventMetadata.clusterDisplay} / ${eventMetadata.timelineLabel}`
              : eventMetadata.timelineLabel}
          </span>
        </div>
      )}
      <PerspectiveHandle
        type="target"
        position={Position.Left}
        id="perspective-prev"
      />
      <PerspectiveHandle
        type="source"
        position={Position.Right}
        id="perspective-next"
      />
      {!hasDirectCharacter && (
        <AddCharacterButton
          onClick={handleCreateCharacterSnapshot}
          disabled={isLoading || isInterpolatingCharacter}
          isProcessing={isInterpolatingCharacter}
        />
      )}
      <CustomHandle
        type="target"
        position={Position.Bottom}
        id="character"
        style={{
          background: "lightgray",
        }}
      />
    </div>
  );
}
