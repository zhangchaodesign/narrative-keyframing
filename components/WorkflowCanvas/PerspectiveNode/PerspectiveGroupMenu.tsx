"use client";

import { useCallback } from "react";
import { TbCopy, TbTrash } from "react-icons/tb";

import type {
  WorkflowEdge,
  WorkflowNode,
  PerspectiveNodeType,
} from "@/lib/types/workflow";
import {
  cloneData,
  deleteNodeCluster,
  generateUniqueUuidId,
} from "@/lib/utiils/workflowUtils";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { PerspectiveActionsMenu } from "@/components/shared/PerspectiveActionsMenu";
import { ZoomInvariantWrapper } from "@/components/WorkflowCanvas/ZoomInvariantWrapper";
import { eventTracker } from "@/lib/utils";
import type { PerspectiveGroupNodeType } from "@/lib/types/workflow";

type PerspectiveGroupMenuProps = {
  nodeId: string;
};

const CLONE_OFFSET = 80;

export function PerspectiveGroupMenu({ nodeId }: PerspectiveGroupMenuProps) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const setEdges = useWorkflowStore((state) => state.setEdges);
  const perspectiveNodeIds = nodes
    .filter((node) => node.type === "perspective" && node.parentId === nodeId)
    .map((node) => node.id);

  const handleDelete = useCallback(() => {
    const groupNode = nodes.find(
      (node): node is PerspectiveGroupNodeType =>
        node.id === nodeId && node.type === "perspectiveGroup",
    );

    const childNodes = nodes.filter((node) => node.parentId === nodeId);
    const perspectiveNodes = childNodes.filter(
      (node) => node.type === "perspective",
    );
    const characterNodes = childNodes.filter(
      (node) => node.type === "character",
    );

    eventTracker({
      action: "delete_perspective_cluster",
      data: {
        clusterLabel: groupNode?.data?.label || "Untitled",
        characterName: groupNode?.data?.characterName || "",
        totalNodes: childNodes.length,
        perspectiveCount: perspectiveNodes.length,
        characterCount: characterNodes.length,
        nodeTypes: childNodes.reduce(
          (acc, node) => {
            const type = node.type || "unknown";
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
        childrenData: childNodes.map((node) => ({
          id: node.id,
          type: node.type,
          data: node.data,
          position: node.position,
        })),
      },
    });

    const result = deleteNodeCluster(nodeId, nodes, edges);

    setNodes(result.nodes);
    setEdges(result.edges);
  }, [edges, nodeId, nodes, setEdges, setNodes]);

  const handleDuplicate = useCallback(() => {
    const currentNodes = nodes;
    const currentEdges = edges;

    const groupNode = currentNodes.find(
      (node): node is PerspectiveGroupNodeType =>
        node.id === nodeId && node.type === "perspectiveGroup",
    );

    if (!groupNode) {
      return;
    }

    const childNodes = currentNodes.filter((node) => node.parentId === nodeId);
    const perspectiveNodes = childNodes.filter(
      (node) => node.type === "perspective",
    );
    const characterNodes = childNodes.filter(
      (node) => node.type === "character",
    );

    eventTracker({
      action: "duplicate_perspective_cluster",
      data: {
        clusterLabel: groupNode.data?.label || "Untitled",
        characterName: groupNode.data?.characterName || "",
        totalNodes: childNodes.length,
        perspectiveCount: perspectiveNodes.length,
        characterCount: characterNodes.length,
        nodeTypes: childNodes.reduce(
          (acc, node) => {
            const type = node.type || "unknown";
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        ),
        childrenData: childNodes.map((node) => ({
          id: node.id,
          type: node.type,
          data: node.data,
          position: node.position,
        })),
      },
    });
    const clusterNodeIds = new Set<string>([
      nodeId,
      ...childNodes.map((n) => n.id),
    ]);

    const existingNodeIds = new Set(currentNodes.map((node) => node.id));
    const existingEdgeIds = new Set(currentEdges.map((edge) => edge.id));
    const idMap = new Map<string, string>();

    const newGroupId = generateUniqueUuidId(
      "perspective-group",
      existingNodeIds,
    );
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

    // First pass: Generate new IDs for all child nodes and build the complete ID map
    const childNodesWithNewIds = childNodes.map((original) => {
      const prefix =
        original.type === "perspective"
          ? "perspective"
          : original.type === "character"
          ? "character"
          : original.type ?? "node";
      const newId = generateUniqueUuidId(prefix, existingNodeIds);
      existingNodeIds.add(newId);
      idMap.set(original.id, newId);
      return { original, newId };
    });

    // Second pass: Create new nodes with updated data, now that all IDs are mapped
    const newChildNodes: WorkflowNode[] = childNodesWithNewIds.map(
      ({ original, newId }) => {
        let clonedData = cloneData(original.data);

        // Update analysisEvidence characterId references for perspective nodes
        if (original.type === "perspective") {
          const perspectiveData = original.data as PerspectiveNodeType["data"];
          if (
            perspectiveData?.analysisEvidence &&
            perspectiveData.analysisEvidence.length > 0
          ) {
            clonedData = {
              ...clonedData,
              analysisEvidence: perspectiveData.analysisEvidence.map(
                (evidence) => {
                  // Map old character ID to new character ID using the complete idMap
                  const newCharacterId =
                    idMap.get(evidence.characterId) ?? evidence.characterId;
                  return {
                    characterId: newCharacterId,
                    characterName: evidence.characterName,
                    items: evidence.items.map((item) => ({
                      text: item.text,
                      category: item.category,
                      attributes: [...item.attributes],
                    })),
                  };
                },
              ),
            };
          }
        }

        return {
          ...original,
          id: newId,
          parentId: newGroupId,
          position: {
            x: original.position.x,
            y: original.position.y,
          },
          data: clonedData,
          selected: false,
          dragging: false,
        } as WorkflowNode;
      },
    );

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

    setNodes((nodes) => [...nodes, ...newNodes]);
    setEdges((edges) => [...edges, ...newEdges]);
  }, [edges, nodeId, nodes, setEdges, setNodes]);

  return (
    <ZoomInvariantWrapper className="pointer-events-none absolute -top-16 right-0 flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 text-gray-500 shadow-md opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 after:absolute after:left-0 after:top-full after:h-5 after:w-full after:content-['']">
      <PerspectiveActionsMenu
        targetNodeIds={perspectiveNodeIds}
        label="this perspective group"
        wrapperClassName="flex items-center gap-2"
        buttonPadding="p-2"
        iconSize={18}
      />
      <button
        type="button"
        onClick={handleDuplicate}
        className="pointer-events-auto rounded-full p-2 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500 cursor-pointer"
        title="Duplicate cluster"
        aria-label="Duplicate cluster"
      >
        <TbCopy size={18} />
      </button>
      <button
        type="button"
        onClick={handleDelete}
        className="pointer-events-auto rounded-full p-2 text-red-500 transition hover:bg-red-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-red-500 cursor-pointer"
        title="Delete cluster"
        aria-label="Delete cluster"
      >
        <TbTrash size={18} />
      </button>
    </ZoomInvariantWrapper>
  );
}
