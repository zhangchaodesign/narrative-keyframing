"use client";

import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { TbCopy, TbTrash } from "react-icons/tb";

import type { WorkflowEdge, WorkflowNode } from "@/lib/types/workflow";
import {
  deleteNodeWithEdges,
  duplicateWorkflowNode,
} from "@/lib/utils/workflowUtils";

type CharacterMenuProps = {
  nodeId: string;
  nodeType: WorkflowNode["type"];
};

export function CharacterMenu({ nodeId, nodeType }: CharacterMenuProps) {
  const { setNodes, setEdges } = useReactFlow<WorkflowNode, WorkflowEdge>();

  const handleDelete = useCallback(() => {
    setNodes((nodes) => {
      setEdges((edges) => {
        const result = deleteNodeWithEdges(nodeId, nodes, edges);
        setNodes(result.nodes);
        return result.edges;
      });
      return nodes;
    });
  }, [nodeId, setEdges, setNodes]);

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

  return (
    <div className="pointer-events-none absolute -top-9 right-0 flex items-center gap-1 rounded-lg border border-zinc-200 bg-white p-1 text-zinc-500 shadow-sm opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100">
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
