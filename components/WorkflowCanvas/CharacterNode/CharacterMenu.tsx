"use client";

import { useCallback } from "react";
import { TbCopy } from "react-icons/tb";

import { duplicateWorkflowNode } from "@/lib/utiils/workflowUtils";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { CharacterRefreshMenu } from "@/components/shared/CharacterActionsMenu";
import { eventTracker } from "@/lib/utils";
import type { CharacterNodeType } from "@/lib/types/workflow";

export function CharacterMenu({ nodeId }: { nodeId: string }) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const setNodes = useWorkflowStore((state) => state.setNodes);

  const handleDuplicate = useCallback(() => {
    const original = nodes.find(
      (node): node is CharacterNodeType =>
        node.id === nodeId && node.type === "character",
    );

    if (original) {
      const perspectiveNode = nodes.find(
        (node) =>
          node.id === original.data?.perspectiveId &&
          node.type === "perspective",
      );

      eventTracker({
        action: "duplicate_character",
        data: {
          originalCharacterId: original.id,
          characterName: original.data?.name || "Unnamed",
          characterTraits: original.data?.traits,
          perspectiveId: original.data?.perspectiveId,
          perspectiveNarrator:
            perspectiveNode?.type === "perspective"
              ? perspectiveNode.data?.narrator
              : undefined,
          perspectiveReflection:
            perspectiveNode?.type === "perspective"
              ? perspectiveNode.data?.reflection
              : undefined,
        },
      });
    }

    setNodes((currentNodes) => {
      const original = currentNodes.find((node) => node.id === nodeId);
      if (!original) {
        return currentNodes;
      }

      const existingIds = new Set(currentNodes.map((node) => node.id));
      const duplicatedNode = duplicateWorkflowNode(original, existingIds);

      return [...currentNodes, duplicatedNode];
    });
  }, [nodeId, nodes, setNodes]);

  return (
    <CharacterRefreshMenu
      nodeId={nodeId}
      extraButtons={
        <>
          <button
            type="button"
            onClick={handleDuplicate}
            className="pointer-events-auto rounded-full p-1 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500 cursor-pointer"
            title="Duplicate node"
            aria-label="Duplicate node"
          >
            <TbCopy size={12} />
          </button>
        </>
      }
      classes="-top-10"
    />
  );
}
