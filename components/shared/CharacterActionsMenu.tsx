"use client";

import { useCallback, useMemo, type ReactNode } from "react";
import { TbRefresh, TbTrash } from "react-icons/tb";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import type {
  CharacterNodeType,
  PerspectiveNodeType,
} from "@/lib/types/workflow";
import {
  refreshCharacterSnapshotFromPerspective,
  type WorkflowNodesSetter,
} from "@/lib/utiils/characterUtils";
import { cn } from "@/lib/utiils/sharedUtils";
import { deleteNodeWithEdges } from "@/lib/utiils/workflowUtils";

type CharacterRefreshMenuProps = {
  nodeId: string;
  buttonPadding?: string;
  iconSize?: number;
  linkedTooltip?: string;
  unlinkedTooltip?: string;
  ariaLabelLinked?: string;
  ariaLabelUnlinked?: string;
  extraButtons?: ReactNode;
};

export function CharacterRefreshMenu({
  nodeId,
  buttonPadding = "p-1",
  iconSize = 12,
  linkedTooltip = "Refresh snapshot from perspective narration",
  unlinkedTooltip = "Link this character to a perspective with text to refresh",
  ariaLabelLinked = "Refresh snapshot from perspective narration",
  ariaLabelUnlinked = "Link this character to a perspective with text to refresh",
  extraButtons,
}: CharacterRefreshMenuProps) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const setEdges = useWorkflowStore((state) => state.setEdges);

  const { characterNode, perspectiveNode } = useMemo(() => {
    const foundCharacter = nodes.find(
      (node): node is CharacterNodeType =>
        node.id === nodeId && node.type === "character",
    );
    const perspectiveId = foundCharacter?.data?.perspectiveId;
    const foundPerspective = perspectiveId
      ? nodes.find(
          (node): node is PerspectiveNodeType =>
            node.id === perspectiveId && node.type === "perspective",
        )
      : undefined;
    return { characterNode: foundCharacter, perspectiveNode: foundPerspective };
  }, [nodeId, nodes]);

  const hasPerspectiveLink = Boolean(
    characterNode?.data?.perspectiveId &&
      perspectiveNode?.data?.reflection?.trim(),
  );
  const isRefreshing = Boolean(characterNode?.data?.isRefreshing);

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

  const handleRefresh = useCallback(async () => {
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
    setNodes,
    updateRefreshingState,
  ]);

  const tooltipText = hasPerspectiveLink ? linkedTooltip : unlinkedTooltip;
  const ariaLabel = hasPerspectiveLink ? ariaLabelLinked : ariaLabelUnlinked;

  const handleDelete = useCallback(() => {
    const result = deleteNodeWithEdges(nodeId, nodes, edges);
    setNodes(result.nodes);
    setEdges(result.edges);
  }, [edges, nodeId, nodes, setEdges, setNodes]);

  return (
    <div className="pointer-events-none absolute -top-9 right-0 flex items-center gap-1 rounded-lg border border-gray-200 bg-white p-1 text-gray-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
      <button
        type="button"
        onClick={handleRefresh}
        className={cn(
          "pointer-events-auto rounded-full transition hover:bg-green-50 hover:text-green-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-500 disabled:cursor-not-allowed disabled:opacity-60",
          buttonPadding,
        )}
        title={tooltipText}
        aria-label={ariaLabel}
        disabled={!hasPerspectiveLink || isRefreshing}
      >
        {isRefreshing ? (
          <span
            className="block animate-spin rounded-full border-2 border-green-600 border-t-transparent align-middle"
            style={{
              width: iconSize,
              height: iconSize,
            }}
          />
        ) : (
          <TbRefresh size={iconSize} />
        )}
      </button>
      {extraButtons}
      <button
        type="button"
        onClick={handleDelete}
        className={cn(
          "pointer-events-auto rounded-full text-red-500 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-500 cursor-pointer",
          buttonPadding,
        )}
        title="Delete node"
        aria-label="Delete node"
      >
        <TbTrash size={iconSize} />
      </button>
    </div>
  );
}
