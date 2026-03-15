"use client";

import { useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { TbCopy, TbTrash } from "react-icons/tb";

import type {
  EventGroupNodeType,
  GroupNodeData,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";
import {
  cloneData,
  deleteNodeCluster,
  generateUniqueUuidId,
} from "@/lib/utiils/workflowUtils";
import { ZoomInvariantWrapper } from "@/components/WorkflowCanvas/ZoomInvariantWrapper";
import { EventActionsMenu } from "@/components/shared/EventActionsMenu";
import { eventTracker } from "@/lib/utils";

type EventGroupMenuProps = {
  nodeId: string;
};

const CLONE_OFFSET = 80;

export function EventGroupMenu({ nodeId }: EventGroupMenuProps) {
  const { setNodes, setEdges, getNodes, getEdges } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();

  const handleDelete = useCallback(() => {
    const nodes = getNodes();
    const edges = getEdges();

    const groupNode = nodes.find(
      (node): node is EventGroupNodeType =>
        node.id === nodeId && node.type === "eventGroup",
    );

    const childNodes = nodes.filter((node) => node.parentId === nodeId);
    const eventNodes = childNodes.filter((node) => node.type === "event");

    eventTracker({
      action: "delete_event_cluster",
      data: {
        clusterLabel: groupNode?.data?.label || "Untitled",
        eventGroupNumber: groupNode?.data?.eventGroupId || 0,
        totalNodes: childNodes.length,
        eventCount: eventNodes.length,
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
  }, [getNodes, getEdges, nodeId, setEdges, setNodes]);

  const handleDuplicate = useCallback(() => {
    const currentNodes = getNodes();
    const currentEdges = getEdges();

    const groupNode = currentNodes.find(
      (node): node is EventGroupNodeType =>
        node.id === nodeId && node.type === "eventGroup",
    );

    if (!groupNode) {
      return;
    }

    const eventGroupNodes = currentNodes.filter(
      (node): node is EventGroupNodeType => node.type === "eventGroup",
    );
    const highestEventGroupId = eventGroupNodes.reduce((accumulator, node) => {
      const eventGroupId = node.data?.eventGroupId ?? 0;
      return eventGroupId > accumulator ? eventGroupId : accumulator;
    }, 0);
    const nextEventGroupId = highestEventGroupId + 1;

    const childNodes = currentNodes.filter((node) => node.parentId === nodeId);
    const eventNodes = childNodes.filter((node) => node.type === "event");

    eventTracker({
      action: "duplicate_event_cluster",
      data: {
        clusterLabel: groupNode.data?.label || "Untitled",
        eventGroupNumber: groupNode.data?.eventGroupId || 0,
        totalNodes: childNodes.length,
        eventCount: eventNodes.length,
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

    const newGroupId = generateUniqueUuidId("event-group", existingNodeIds);
    existingNodeIds.add(newGroupId);
    idMap.set(nodeId, newGroupId);

    const clonedGroupData = cloneData(groupNode.data) as GroupNodeData;
    const nextGroupData: GroupNodeData = {
      ...clonedGroupData,
      label: clonedGroupData?.label || "Outline",
      eventGroupId: nextEventGroupId,
    };

    const newGroupNode: WorkflowNode = {
      ...groupNode,
      id: newGroupId,
      position: {
        x: groupNode.position.x,
        y: groupNode.position.y + CLONE_OFFSET,
      },
      data: nextGroupData,
      selected: false,
      dragging: false,
    } as WorkflowNode;

    // Generate new IDs for all child nodes and build the complete ID map
    const childNodesWithNewIds = childNodes.map((original) => {
      const prefix =
        original.type === "event" ? "event" : (original.type ?? "node");
      const newId = generateUniqueUuidId(prefix, existingNodeIds);
      existingNodeIds.add(newId);
      idMap.set(original.id, newId);
      return { original, newId };
    });

    // Create new nodes with updated data
    const newChildNodes: WorkflowNode[] = childNodesWithNewIds.map(
      ({ original, newId }) => {
        return {
          ...original,
          id: newId,
          parentId: newGroupId,
          position: {
            x: original.position.x,
            y: original.position.y,
          },
          data: cloneData(original.data),
          selected: false,
          dragging: false,
        } as WorkflowNode;
      },
    );

    const newNodes = [newGroupNode, ...newChildNodes];

    // Clone internal edges (edges between nodes in the cluster)
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
  }, [getEdges, getNodes, nodeId, setEdges, setNodes]);

  return (
    <ZoomInvariantWrapper className="pointer-events-none absolute -top-16 right-0 flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-2 text-gray-500 shadow-md opacity-0 transition group-focus-within:pointer-events-auto group-focus-within:opacity-100 group-hover:pointer-events-auto group-hover:opacity-100 after:absolute after:left-0 after:top-full after:h-5 after:w-full after:content-['']">
      <EventActionsMenu
        eventGroupId={nodeId}
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
