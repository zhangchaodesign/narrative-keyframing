"use client";

import { useCallback } from "react";
import { TbCopy, TbTrash } from "react-icons/tb";

import { deleteNodeCluster } from "@/lib/utiils/workflowUtils";
import { duplicateNarrativeGroupCluster } from "@/lib/utiils/narrativeUtils";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { NarrativeActionsMenu } from "@/components/shared/NarrativeActionsMenu";

type NarrativeGroupMenuProps = {
  nodeId: string;
};

export function NarrativeGroupMenu({ nodeId }: NarrativeGroupMenuProps) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const setEdges = useWorkflowStore((state) => state.setEdges);

  const handleDelete = useCallback(() => {
    const result = deleteNodeCluster(nodeId, nodes, edges);

    setNodes(result.nodes);
    setEdges(result.edges);
  }, [edges, nodeId, nodes, setEdges, setNodes]);

  const handleDuplicate = useCallback(() => {
    const result = duplicateNarrativeGroupCluster({
      groupId: nodeId,
      nodes,
      edges,
    });

    if (!result) {
      return;
    }

    setNodes((existing) => [...existing, ...result.newNodes]);
    setEdges((existing) => [...existing, ...result.newEdges]);
  }, [edges, nodeId, nodes, setEdges, setNodes]);

  return (
    <NarrativeActionsMenu
      nodeId={nodeId}
      wrapperClassName="pointer-events-none absolute -top-16 right-0 flex items-center gap-2 rounded-lg border border-zinc-200 bg-white p-2 text-zinc-500 shadow-md opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100"
      extraButtons={
        <>
          <button
            type="button"
            onClick={handleDuplicate}
            className="pointer-events-auto rounded-full p-2 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-indigo-500 cursor-pointer"
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
        </>
      }
    />
  );
}
