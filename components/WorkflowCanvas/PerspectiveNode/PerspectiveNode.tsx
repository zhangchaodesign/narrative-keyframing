"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Position, type NodeProps } from "@xyflow/react";
import { CustomHandle } from "@/components/WorkflowCanvas/CustomHandle";
import { PerspectiveHandle } from "@/components/WorkflowCanvas/PerspectiveNode/PerspectiveHandle";
import { PerspectiveSingleActionsMenu } from "@/components/shared/PerspectiveNodeMenu";
import { AddCharacterButton } from "@/components/shared/AddCharacterButton";
import { PerspectiveContent } from "@/components/shared/PerspectiveContent";
import { PerspectiveStatusLabel } from "@/components/shared/PerspectiveStatusLabel";
import type {
  CharacterNodeType,
  EventNodeType,
  PerspectiveNodeType,
  WorkflowNode,
} from "@/lib/types/workflow";
import { cn } from "@/lib/utiils/sharedUtils";
import { createCharacterSnapshotFromPerspective } from "@/lib/utiils/characterUtils";
import { geistMono } from "@/app/fonts";
import { useWorkflowStore } from "@/lib/stores/workflowStore";

export function PerspectiveNode({ id, data }: NodeProps<PerspectiveNodeType>) {
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

  // Find the event node and its timeline
  const eventTimeline = useMemo(() => {
    if (!data?.eventId) {
      return null;
    }
    const eventNode = nodes.find(
      (node) => node.id === data.eventId && node.type === "event",
    ) as EventNodeType | undefined;
    return eventNode?.data?.timeline ?? data.eventId;
  }, [data?.eventId, nodes]);

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

  const handleToggleEdit = useCallback(() => {
    if (isEditing) {
      // Save the edited reflection
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
              reflection: editedReflection,
              // Clear evidence analysis when reflection is edited
              analysisEvidence: [],
              analysisStatus: "idle",
              analysisStatusMessage: undefined,
            },
          };
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
      console.error("Error creating character snapshot:", error);
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
    <div className="group relative flex gap-2 h-48 w-64 flex-col rounded-lg border-2 border-secondary bg-white p-3 text-xs hover:shadow-lg">
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
        wrapperClassName="pointer-events-none absolute -top-9 right-0 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-zinc-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
      />
      <div
        className={cn(
          geistMono.className,
          "flex flex-col w-full gap-1 text-[10px] font-semibold tracking-wide text-zinc-800 uppercase",
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
      />
      {eventTimeline && (
        <div className="mt-1 flex gap-2">
          <span
            className={cn(
              geistMono.className,
              "inline-flex items-center rounded bg-pink-500 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-white",
            )}
            title={`Event: ${data?.eventId}`}
          >
            {eventTimeline}
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
