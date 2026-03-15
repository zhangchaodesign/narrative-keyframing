"use client";

import { useCallback } from "react";
import { TbCopy, TbTrash } from "react-icons/tb";

import { deleteNodeCluster } from "@/lib/utiils/workflowUtils";
import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { NarrativeActionsMenu } from "@/components/shared/NarrativeActionsMenu";
import { ZoomInvariantWrapper } from "@/components/WorkflowCanvas/ZoomInvariantWrapper";
import { eventTracker } from "@/lib/utils";
import type { NarrationGroupNodeType } from "@/lib/types/workflow";

type NarrativeGroupMenuProps = {
  nodeId: string;
};

export function NarrativeGroupMenu({ nodeId }: NarrativeGroupMenuProps) {
  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const setEdges = useWorkflowStore((state) => state.setEdges);
  const duplicateNarrativeGroup = useWorkflowStore(
    (state) => state.duplicateNarrativeGroup,
  );

  const handleDelete = useCallback(() => {
    const groupNode = nodes.find(
      (node): node is NarrationGroupNodeType =>
        node.id === nodeId && node.type === "narrativeGroup",
    );

    const childNodes = nodes.filter((node) => node.parentId === nodeId);
    const narrativeNodes = childNodes.filter(
      (node) => node.type === "narrative",
    );

    eventTracker({
      action: "delete_narrative_cluster",
      data: {
        clusterLabel: groupNode?.data?.label || "Untitled",
        narrativeGroupNumber: groupNode?.data?.narrativeGroupId || 0,
        totalNodes: childNodes.length,
        narrativeCount: narrativeNodes.length,
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
    const groupNode = nodes.find(
      (node): node is NarrationGroupNodeType =>
        node.id === nodeId && node.type === "narrativeGroup",
    );

    const childNodes = nodes.filter((node) => node.parentId === nodeId);
    const narrativeNodes = childNodes.filter(
      (node) => node.type === "narrative",
    );

    eventTracker({
      action: "duplicate_narrative_cluster",
      data: {
        clusterLabel: groupNode?.data?.label || "Untitled",
        narrativeGroupNumber: groupNode?.data?.narrativeGroupId || 0,
        totalNodes: childNodes.length,
        narrativeCount: narrativeNodes.length,
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

    duplicateNarrativeGroup(nodeId);
  }, [duplicateNarrativeGroup, nodeId, nodes]);

  return (
    <ZoomInvariantWrapper className="pointer-events-none absolute -top-16 right-0 rounded-lg border border-gray-200 bg-white p-2 text-gray-500 shadow-md opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 after:absolute after:left-0 after:top-full after:h-5 after:w-full after:content-['']">
      <NarrativeActionsMenu
        nodeId={nodeId}
        wrapperClassName="flex items-center gap-2"
        extraButtons={
          <>
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
          </>
        }
      />
    </ZoomInvariantWrapper>
  );
}
