"use client";

import { useCallback } from "react";
import { TbCopy, TbTrash } from "react-icons/tb";

import {
  deleteNodeWithEdges,
  duplicateWorkflowNode,
} from "@/lib/utiils/workflowUtils";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { CharacterRefreshMenu } from "@/components/shared/CharacterActionsMenu";

export function CharacterMenu({ nodeId }: { nodeId: string }) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const setEdges = useWorkflowStore((state) => state.setEdges);
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

  return (
    <CharacterRefreshMenu
      nodeId={nodeId}
      wrapperClassName="pointer-events-none absolute -top-9 right-0 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-zinc-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
      extraButtons={
        <>
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
        </>
      }
    />
  );
}
