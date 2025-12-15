"use client";

import { useCallback } from "react";
import { TbCopy, TbTrash, TbRefresh } from "react-icons/tb";

import type {
  CharacterNodeType,
  PerspectiveNodeType,
} from "@/lib/types/workflow";
import {
  deleteNodeWithEdges,
  duplicateWorkflowNode,
} from "@/lib/utiils/workflowUtils";
import {
  refreshCharacterSnapshotFromPerspective,
  type WorkflowNodesSetter,
} from "@/lib/utiils/characterUtils";
import { useWorkflowStore } from "@/lib/stores/workflowStore";

export function CharacterMenu({ nodeId }: { nodeId: string }) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const setEdges = useWorkflowStore((state) => state.setEdges);
  const characterNode = nodes.find(
    (candidate): candidate is CharacterNodeType =>
      candidate.id === nodeId && candidate.type === "character",
  );
  const perspectiveId = characterNode?.data?.perspectiveId;
  const perspectiveNode = perspectiveId
    ? nodes.find(
        (candidate): candidate is PerspectiveNodeType =>
          candidate.id === perspectiveId && candidate.type === "perspective",
      )
    : undefined;
  const characterData = characterNode?.data;
  const perspectiveData = perspectiveNode?.data;
  const hasPerspectiveLink =
    Boolean(characterData?.perspectiveId) &&
    Boolean(perspectiveData?.reflection?.trim());
  const isRefreshing = Boolean(characterData?.isRefreshing);

  const updateRefreshingState = useCallback(
    (nextState: boolean) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== nodeId || node.type !== "character") {
            return node;
          }
          const existingData = node.data as CharacterNodeType["data"];
          return {
            ...node,
            data: {
              ...existingData,
              isRefreshing: nextState,
            },
          };
        }),
      );
    },
    [nodeId, setNodes],
  );

  const handleDelete = useCallback(() => {
    const result = deleteNodeWithEdges(nodeId, nodes, edges);
    setNodes(result.nodes);
    setEdges(result.edges);
  }, [edges, nodeId, nodes, setEdges, setNodes]);

  const handleDuplicate = useCallback(() => {
    setNodes((currentNodes) => {
      const original = currentNodes.find((node) => node.id === nodeId);
      if (!original) {
        return currentNodes;
      }

      const existingIds = new Set(currentNodes.map((node) => node.id));
      const duplicatedNode = duplicateWorkflowNode(original, existingIds);

      return [...currentNodes, duplicatedNode];
    });
  }, [nodeId, setNodes]);

  const handleRefreshCharacter = useCallback(async () => {
    if (isRefreshing || !hasPerspectiveLink) {
      return;
    }

    updateRefreshingState(true);
    try {
      await refreshCharacterSnapshotFromPerspective({
        nodeId,
        nodes,
        setNodes: setNodes as WorkflowNodesSetter,
      });
    } catch (error) {
      console.error("Error refreshing character snapshot:", error);
    } finally {
      updateRefreshingState(false);
    }
  }, [
    hasPerspectiveLink,
    isRefreshing,
    nodeId,
    nodes,
    updateRefreshingState,
    setNodes,
  ]);

  return (
    <div className="pointer-events-none absolute -top-9 right-0 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-zinc-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
      <button
        type="button"
        onClick={handleRefreshCharacter}
        className="pointer-events-auto rounded-full p-1 transition hover:bg-green-50 hover:text-green-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-500 disabled:cursor-not-allowed disabled:opacity-60"
        title={
          hasPerspectiveLink
            ? "Refresh snapshot from perspective narration"
            : "Link this character to a perspective with text to refresh"
        }
        aria-label="Refresh snapshot from perspective narration"
        disabled={!hasPerspectiveLink || isRefreshing}
      >
        {isRefreshing ? (
          <span className="block h-3 w-3 animate-spin rounded-full border-2 border-green-600 border-t-transparent align-middle" />
        ) : (
          <TbRefresh size={12} />
        )}
      </button>
      <button
        type="button"
        onClick={handleDuplicate}
        className="pointer-events-auto rounded-full p-1 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500 cursor-pointer"
        title="Duplicate node"
        aria-label="Duplicate node"
      >
        <TbCopy size={12} />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        className="pointer-events-auto rounded-full p-1 text-red-500 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-500 cursor-pointer"
        title="Delete node"
        aria-label="Delete node"
      >
        <TbTrash size={12} />
      </button>
    </div>
  );
}
