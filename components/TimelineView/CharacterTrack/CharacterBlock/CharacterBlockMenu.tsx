"use client";

import { useCallback, useMemo } from "react";
import { TbRefresh } from "react-icons/tb";
import {
  refreshCharacterSnapshotFromPerspective,
  type WorkflowNodesSetter,
} from "@/lib/utiils/characterUtils";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import type {
  CharacterNodeType,
  PerspectiveNodeType,
} from "@/lib/types/workflow";
import type { TimelineItem } from "@/lib/types/timeline";

interface CharacterBlockMenuProps {
  item: TimelineItem;
  characterName: string;
}

export function CharacterBlockMenu({
  item,
  characterName,
}: CharacterBlockMenuProps) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const setNodes = useWorkflowStore((state) => state.setNodes);

  const characterNode = useMemo(
    () =>
      nodes.find(
        (node): node is CharacterNodeType =>
          node.id === item.nodeId && node.type === "character",
      ),
    [item.nodeId, nodes],
  );
  const perspectiveId = characterNode?.data?.perspectiveId;
  const perspectiveNode = perspectiveId
    ? nodes.find(
        (node): node is PerspectiveNodeType =>
          node.id === perspectiveId && node.type === "perspective",
      )
    : undefined;
  const hasPerspectiveLink = Boolean(perspectiveNode?.data?.reflection?.trim());
  const isRefreshing = Boolean(characterNode?.data?.isRefreshing);

  const updateRefreshingState = useCallback(
    (nextState: boolean) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => {
          if (node.id !== item.nodeId || node.type !== "character") {
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
    [item.nodeId, setNodes],
  );

  const handleRefreshSnapshot = useCallback(async () => {
    if (isRefreshing || !hasPerspectiveLink) {
      return;
    }

    updateRefreshingState(true);
    try {
      await refreshCharacterSnapshotFromPerspective({
        nodeId: item.nodeId,
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
    item.nodeId,
    nodes,
    setNodes,
    updateRefreshingState,
  ]);

  return (
    <div className="pointer-events-none absolute -top-9 right-0 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-zinc-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
      <button
        type="button"
        onClick={handleRefreshSnapshot}
        className="pointer-events-auto rounded-full p-1 transition hover:bg-green-50 hover:text-green-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-500 disabled:cursor-not-allowed disabled:opacity-60"
        title={
          hasPerspectiveLink
            ? `Refresh ${characterName || "character"} from perspective`
            : "Link this character to a perspective with text to refresh"
        }
        aria-label="Refresh character snapshot"
        disabled={!hasPerspectiveLink || isRefreshing}
      >
        {isRefreshing ? (
          <span className="block h-3 w-3 animate-spin rounded-full border-2 border-green-600 border-t-transparent align-middle" />
        ) : (
          <TbRefresh size={12} />
        )}
      </button>
    </div>
  );
}
