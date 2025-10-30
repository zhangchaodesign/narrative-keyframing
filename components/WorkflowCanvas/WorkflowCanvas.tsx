"use client";

import { useCallback } from "react";
import {
  addEdge,
  Background,
  Connection,
  Controls,
  MiniMap,
  ReactFlow,
  type EdgeTypes,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useWorkflowStore } from "@/lib/stores/workflowStore";
import { CustomEdge } from "@/components/WorkflowCanvas/CustomEdge";
import { CharacterNode } from "@/components/WorkflowCanvas/CharacterNode/CharacterNode";
import { EventNode } from "@/components/WorkflowCanvas/EventNode/EventNode";
import { PerspectiveNode } from "@/components/WorkflowCanvas/PerspectiveNode/PerspectiveNode";
import { EventGroupNode } from "@/components/WorkflowCanvas/EventNode/EventGroupNode";
import { PerspectiveGroupNode } from "@/components/WorkflowCanvas/PerspectiveNode/PerspectiveGroupNode";
import {
  type EventNodeType,
  type EventGroupNodeType,
  type NarrationGroupNodeType,
  type PerspectiveNodeType,
  type WorkflowNode,
} from "@/lib/types/workflow";

const nodeTypes: NodeTypes = {
  event: EventNode,
  perspective: PerspectiveNode,
  character: CharacterNode,
  eventGroup: EventGroupNode,
  perspectiveGroup: PerspectiveGroupNode,
};

const edgeTypes: EdgeTypes = {
  customEdge: CustomEdge,
};

export function WorkflowCanvas() {
  const proOptions = { hideAttribution: true };

  const nodes = useWorkflowStore((state) => state.nodes);
  const edges = useWorkflowStore((state) => state.edges);
  const onNodesChange = useWorkflowStore((state) => state.onNodesChange);
  const onEdgesChange = useWorkflowStore((state) => state.onEdgesChange);
  const setNodes = useWorkflowStore((state) => state.setNodes);
  const setEdges = useWorkflowStore((state) => state.setEdges);

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((prevEdges) =>
        addEdge(
          {
            ...connection,
            id: `edge-${prevEdges.length}-${Date.now()}`,
            animated: true,
            type: "customEdge",
          },
          prevEdges,
        ),
      );
    },
    [setEdges],
  );

  const handleAddFirstPersonCluster = useCallback(() => {
    const eventNodes = nodes.filter(
      (node): node is EventNodeType => node.type === "event",
    );
    if (eventNodes.length === 0) {
      return;
    }

    const sortedEvents = [...eventNodes].sort(
      (nodeA, nodeB) => nodeA.position.x - nodeB.position.x,
    );
    const perspectiveGroups = nodes.filter(
      (node): node is NarrationGroupNodeType =>
        node.type === "perspectiveGroup",
    );
    const eventGroup = nodes.find(
      (node): node is EventGroupNodeType => node.type === "eventGroup",
    );

    const DEFAULT_GROUP_STYLE = {
      width: 1200,
      height: 640,
      backgroundColor: "transparent",
      border: "none",
      padding: 0,
      boxShadow: "none",
    } as const;

    const baselineGroupStyle =
      perspectiveGroups[0]?.style ?? DEFAULT_GROUP_STYLE;
    const baselineWidth =
      typeof baselineGroupStyle?.width === "number"
        ? baselineGroupStyle.width
        : DEFAULT_GROUP_STYLE.width;
    const baselineHeight =
      typeof baselineGroupStyle?.height === "number"
        ? baselineGroupStyle.height
        : DEFAULT_GROUP_STYLE.height;
    const eventGroupWidth =
      typeof eventGroup?.style?.width === "number"
        ? eventGroup.style.width
        : baselineWidth;
    const clusterWidth = Math.max(baselineWidth, eventGroupWidth);

    const HORIZONTAL_GAP = 80;
    const baseGroupY =
      perspectiveGroups.length > 0
        ? perspectiveGroups[0]!.position.y
        : eventGroup?.position.y ?? 250;
    const rightmostEdge = perspectiveGroups.reduce((accumulator, group) => {
      const groupWidth =
        typeof group.style?.width === "number"
          ? group.style.width
          : baselineWidth;
      return Math.max(accumulator, group.position.x + groupWidth);
    }, Number.NEGATIVE_INFINITY);
    const newGroupX =
      perspectiveGroups.length === 0
        ? eventGroup?.position.x ?? 100
        : (rightmostEdge === Number.NEGATIVE_INFINITY
            ? perspectiveGroups[0]!.position.x + baselineWidth
            : rightmostEdge) + HORIZONTAL_GAP;
    const newGroupY = baseGroupY;

    const clusterSuffix =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const newGroupId = `perspective-group-${clusterSuffix}`;
    const perspectiveRowY =
      perspectiveGroups.length > 0
        ? nodes.find(
            (node): node is PerspectiveNodeType =>
              node.type === "perspective" &&
              node.parentId === perspectiveGroups[0]?.id,
          )?.position.y ?? 50
        : 50;

    const newPerspectiveNodes: WorkflowNode[] = sortedEvents.map(
      (eventNode, indexPosition) => ({
        id: `perspective-${clusterSuffix}-${indexPosition + 1}`,
        type: "perspective",
        position: {
          x: eventNode.position.x,
          y: perspectiveRowY,
        },
        data: {
          narrator: "",
          reflection: "",
          isLoading: false,
          eventId: eventNode.id,
        },
        draggable: false,
        parentId: newGroupId,
        extent: "parent",
      }),
    );

    const newGroupNode: WorkflowNode = {
      id: newGroupId,
      type: "perspectiveGroup",
      position: {
        x: newGroupX,
        y: newGroupY,
      },
      data: {
        label: "First-Person Limited Cluster",
        characterName: "",
      },
      style: {
        ...DEFAULT_GROUP_STYLE,
        ...(baselineGroupStyle ?? {}),
        width: clusterWidth,
        height: baselineHeight,
      },
    };

    setNodes((currentNodes) => [
      ...currentNodes,
      newGroupNode,
      ...newPerspectiveNodes,
    ]);

    setEdges((currentEdges) => {
      const sequentialEdges = newPerspectiveNodes
        .slice(0, -1)
        .map((node, indexPosition) => ({
          id: `edge-${node.id}-${newPerspectiveNodes[indexPosition + 1]!.id}`,
          source: node.id,
          target: newPerspectiveNodes[indexPosition + 1]!.id,
          sourceHandle: "perspective-next",
          targetHandle: "perspective-prev",
          type: "customEdge",
          animated: true,
        }));

      const eventGroupId = eventGroup?.id ?? "event-group";
      const bridgingEdge = {
        id: `edge-${eventGroupId}-${newGroupId}`,
        source: eventGroupId,
        target: newGroupId,
        sourceHandle: "group-bridge",
        targetHandle: "group-bridge",
        type: "customEdge",
        animated: true,
      };

      return [...currentEdges, bridgingEdge, ...sequentialEdges];
    });
  }, [nodes, setEdges, setNodes]);

  return (
    <div className="h-full min-h-0 w-full relative">
      <div className="absolute left-3 top-3 z-20 flex flex-col gap-2">
        <button
          type="button"
          className="btn btn-xs"
          onClick={handleAddFirstPersonCluster}
        >
          Add a First-Person Limited Cluster
        </button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        proOptions={proOptions}
        // snapToGrid
        // snapGrid={[4, 4]}
        fitView
        minZoom={0.1}
        maxZoom={4}
      >
        <Background />
        <Controls position="bottom-left" />
        <MiniMap zoomable pannable />
      </ReactFlow>
    </div>
  );
}
