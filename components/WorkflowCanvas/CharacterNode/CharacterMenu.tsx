"use client";

import { useCallback } from "react";
import { TbCopy } from "react-icons/tb";

import { duplicateWorkflowNode } from "@/lib/utiils/workflowUtils";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { CharacterRefreshMenu } from "@/components/shared/CharacterActionsMenu";

export function CharacterMenu({ nodeId }: { nodeId: string }) {
  const setNodes = useWorkflowStore((state) => state.setNodes);

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
        </>
      }
    />
  );
}
