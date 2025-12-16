"use client";

import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { TbArrowLeft, TbArrowRight, TbCopy, TbTrash } from "react-icons/tb";

import type { WorkflowEdge, WorkflowNode } from "@/lib/types/workflow";
import { duplicateWorkflowNode } from "@/lib/utiils/workflowUtils";

type EventMenuProps = {
  nodeId: string;
  nodeType: WorkflowNode["type"];
};

export function EventMenu({ nodeId, nodeType }: EventMenuProps) {
  const { setNodes } = useReactFlow<WorkflowNode, WorkflowEdge>();

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
    </div>
  );
}
