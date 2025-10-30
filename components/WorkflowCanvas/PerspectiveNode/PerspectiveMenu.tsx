"use client";

import { useCallback, useContext, useMemo } from "react";
import { useReactFlow } from "@xyflow/react";
import { TbCopy, TbPlayerPlay, TbTrash } from "react-icons/tb";

import { RunPerspectiveContext } from "@/components/WorkflowCanvas/RunPerspectiveContext";
import type { WorkflowEdge, WorkflowNode } from "@/lib/types/workflow";
import { duplicateWorkflowNode } from "@/lib/utils/workflowUtils";

type PerspectiveMenuProps = {
  nodeId: string;
  nodeType: WorkflowNode["type"];
};

const PERSPECTIVE_NODE_WIDTH = 256;
const NARRATION_GROUP_RIGHT_PADDING = 24;
const DEFAULT_NARRATION_GROUP_WIDTH = 1200;

export function PerspectiveMenu({ nodeId, nodeType }: PerspectiveMenuProps) {
  const { setNodes, setEdges, getNode, getNodes } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();
  const runPerspectives = useContext(RunPerspectiveContext);

  const handleDelete = useCallback(() => {
    const nodesSnapshot = getNodes();
    const targetNode = nodesSnapshot.find(
      (node) => node.id === nodeId && node.type === "perspective",
    );
    if (!targetNode) {
      return;
    }

    const parentId = (targetNode as { parentId?: string }).parentId ?? null;

    const nodesWithoutTarget = nodesSnapshot.filter(
      (node) => node.id !== nodeId,
    );

    let clusterSequence: string[] = [];
    let adjustedNodes: WorkflowNode[] = nodesWithoutTarget;

    if (parentId) {
      const clusterNodes = nodesWithoutTarget
        .filter(
          (node): node is WorkflowNode & { parentId?: string } =>
            node.type === "perspective" && node.parentId === parentId,
        )
        .sort((nodeA, nodeB) => nodeA.position.x - nodeB.position.x);

      clusterSequence = clusterNodes.map((node) => node.id);

      let nextWidth = DEFAULT_NARRATION_GROUP_WIDTH;
      if (clusterNodes.length > 0) {
        let rightmostEdge = 0;
        clusterNodes.forEach((node) => {
          rightmostEdge = Math.max(
            rightmostEdge,
            node.position.x + PERSPECTIVE_NODE_WIDTH,
          );
        });
        nextWidth = Math.max(
          DEFAULT_NARRATION_GROUP_WIDTH,
          rightmostEdge + NARRATION_GROUP_RIGHT_PADDING,
        );
      }

      adjustedNodes = nodesWithoutTarget.map((node) => {
        if (node.type === "perspectiveGroup" && node.id === parentId) {
          return {
            ...node,
            style: {
              ...node.style,
              width: nextWidth,
            },
          } as WorkflowNode;
        }
        return node;
      });
    }

    setNodes(() => adjustedNodes);

    setEdges((edges) => {
      const clusterSet = new Set(clusterSequence);
      const preservedEdges = edges.filter((edge) => {
        if (edge.source === nodeId || edge.target === nodeId) {
          return false;
        }

        const isClusterChainEdge =
          edge.sourceHandle === "perspective-next" &&
          edge.targetHandle === "perspective-prev" &&
          clusterSet.has(edge.source) &&
          clusterSet.has(edge.target);
        if (isClusterChainEdge) {
          return false;
        }

        return true;
      });

      if (!parentId || clusterSequence.length < 2) {
        return preservedEdges;
      }

      const baseEdgeId = `edge-${parentId}-${Date.now()}`;
      const rebuiltEdges: WorkflowEdge[] = clusterSequence
        .slice(0, -1)
        .map((sourceId, indexPosition) => ({
          id: `${baseEdgeId}-${indexPosition}`,
          source: sourceId,
          target: clusterSequence[indexPosition + 1]!,
          sourceHandle: "perspective-next",
          targetHandle: "perspective-prev",
          type: "customEdge",
          animated: true,
        }));

      return [...preservedEdges, ...rebuiltEdges];
    });
  }, [getNodes, nodeId, setEdges, setNodes]);

  const handleDuplicate = useCallback(() => {
    setNodes((nodes) => {
      const original = nodes.find((node) => node.id === nodeId);
      if (!original) {
        return nodes;
      }

      const existingIds = new Set(nodes.map((node) => node.id));
      const duplicatedNode = duplicateWorkflowNode(original, existingIds);

      return [...nodes, duplicatedNode];
    });
  }, [nodeId, setNodes]);

  const handleRun = useCallback(() => {
    if (!runPerspectives) {
      return;
    }

    const currentNode = getNode(nodeId);
    if (!currentNode) {
      runPerspectives();
      return;
    }

    const parentId = (currentNode as { parentId?: string }).parentId;

    if (!parentId) {
      runPerspectives([nodeId]);
      return;
    }

    const siblingPerspectiveIds = getNodes()
      .filter(
        (node) => node.type === "perspective" && node.parentId === parentId,
      )
      .map((node) => node.id);

    if (siblingPerspectiveIds.length === 0) {
      runPerspectives([nodeId]);
      return;
    }

    runPerspectives(siblingPerspectiveIds);
  }, [getNode, getNodes, nodeId, runPerspectives]);

  return (
    <div className="pointer-events-none absolute -top-9 right-0 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-zinc-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
      <button
        type="button"
        onClick={handleRun}
        className="pointer-events-auto rounded-full p-1 transition hover:bg-green-50 hover:text-green-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-green-500 cursor-pointer"
        title="Run perspective"
        aria-label="Run perspective"
      >
        <TbPlayerPlay size={12} />
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
