"use client";

import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { TbCopy, TbTrash } from "react-icons/tb";

import type { WorkflowEdge, WorkflowNode } from "@/lib/types/workflow";
import {
  cloneData,
  deleteNodeCluster,
  generateUniqueUuidId,
} from "@/lib/utils/workflowUtils";

type PerspectiveGroupMenuProps = {
  nodeId: string;
};

const CLONE_OFFSET = 80;

export function PerspectiveGroupMenu({ nodeId }: PerspectiveGroupMenuProps) {
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();

  const handleDelete = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();
    const result = deleteNodeCluster(nodeId, nodes, edges);

    setNodes(result.nodes);
    setEdges(result.edges);
  }, [getNodes, getEdges, nodeId, setEdges, setNodes]);

  const handleDuplicate = useCallback(() => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();

    const groupNode = currentNodes.find(
      (node) => node.id === nodeId && node.type === "perspectiveGroup",
    );

    if (!groupNode) {
      return;
    }

    const childNodes = currentNodes.filter((node) => node.parentId === nodeId);
    const clusterNodeIds = new Set<string>([
      nodeId,
      ...childNodes.map((n) => n.id),
    ]);

    const existingNodeIds = new Set(currentNodes.map((node) => node.id));
    const existingEdgeIds = new Set(currentEdges.map((edge) => edge.id));
    const idMap = new Map<string, string>();

    const newGroupId = generateUniqueUuidId("perspective-group", existingNodeIds);
    existingNodeIds.add(newGroupId);
    idMap.set(nodeId, newGroupId);

    const newGroupNode: WorkflowNode = {
      ...groupNode,
      id: newGroupId,
      position: {
        x: groupNode.position.x + CLONE_OFFSET,
        y: groupNode.position.y + CLONE_OFFSET,
      },
      data: cloneData(groupNode.data),
      selected: false,
      dragging: false,
    } as WorkflowNode;

    const newChildNodes: WorkflowNode[] = childNodes.map((original) => {
      const prefix =
        original.type === "perspective"
          ? "perspective"
          : original.type === "character"
          ? "character"
          : original.type ?? "node";
      const newId = generateUniqueUuidId(prefix, existingNodeIds);
      existingNodeIds.add(newId);
      idMap.set(original.id, newId);

      return {
        ...original,
        id: newId,
        parentId: newGroupId,
        position: {
          x: original.position.x + CLONE_OFFSET,
          y: original.position.y + CLONE_OFFSET,
        },
        data: cloneData(original.data),
        selected: false,
        dragging: false,
      } as WorkflowNode;
    });

    const newNodes = [newGroupNode, ...newChildNodes];

    const internalEdges = currentEdges.filter(
      (edge) =>
        clusterNodeIds.has(edge.source) && clusterNodeIds.has(edge.target),
    );

    const newEdges = internalEdges.map((edge) => {
      const newId = generateUniqueUuidId("edge", existingEdgeIds);
      existingEdgeIds.add(newId);

      return {
        ...edge,
        id: newId,
        source: idMap.get(edge.source) ?? edge.source,
        target: idMap.get(edge.target) ?? edge.target,
        data: cloneData(edge.data),
        selected: false,
      };
    });

    const bridgingEdges = currentEdges.filter(
      (edge) => edge.target === nodeId && edge.targetHandle === "group-bridge",
    );

    const duplicatedBridges = bridgingEdges.map((edge) => {
      const newId = generateUniqueUuidId("edge", existingEdgeIds);
      existingEdgeIds.add(newId);
      return {
        ...edge,
        id: newId,
        target: newGroupId,
        data: cloneData(edge.data),
        selected: false,
      };
    });

    const fallbackBridge: WorkflowEdge[] = [];
    if (duplicatedBridges.length === 0) {
      const eventGroupNode = currentNodes.find(
        (node) => node.type === "eventGroup",
      );
      if (eventGroupNode) {
        const newId = generateUniqueUuidId("edge", existingEdgeIds);
        existingEdgeIds.add(newId);
        fallbackBridge.push({
          id: newId,
          source: eventGroupNode.id,
          target: newGroupId,
          sourceHandle: "group-bridge",
          targetHandle: "group-bridge",
          type: "customEdge",
          animated: true,
        });
      }
    }

    setNodes((nodes) => [...nodes, ...newNodes]);
    setEdges((edges) => [
      ...edges,
      ...newEdges,
      ...duplicatedBridges,
      ...fallbackBridge,
    ]);
  }, [getEdges, getNodes, nodeId, setEdges, setNodes]);

  return (
    <div className="pointer-events-none absolute -top-10 right-0 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-zinc-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
      <button
        type="button"
        onClick={handleDuplicate}
        className="pointer-events-auto rounded-full p-1 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500 cursor-pointer"
        title="Duplicate cluster"
        aria-label="Duplicate cluster"
      >
        <TbCopy size={12} />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        className="pointer-events-auto rounded-full p-1 text-red-500 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-500 cursor-pointer"
        title="Delete cluster"
        aria-label="Delete cluster"
      >
        <TbTrash size={12} />
      </button>
    </div>
  );
}
