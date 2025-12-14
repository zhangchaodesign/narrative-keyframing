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
import { EventEdge } from "@/components/WorkflowCanvas/EventNode/EventEdge";
import { CharacterNode } from "@/components/WorkflowCanvas/CharacterNode/CharacterNode";
import { EventNode } from "@/components/WorkflowCanvas/EventNode/EventNode";
import { PerspectiveNode } from "@/components/WorkflowCanvas/PerspectiveNode/PerspectiveNode";
import { NarrativeNode } from "@/components/WorkflowCanvas/NarrativeNode/NarrativeNode";
import { EventGroupNode } from "@/components/WorkflowCanvas/EventNode/EventGroupNode";
import { PerspectiveGroupNode } from "@/components/WorkflowCanvas/PerspectiveNode/PerspectiveGroupNode";
import { NarrativeGroupNode } from "@/components/WorkflowCanvas/NarrativeNode/NarrativeGroupNode";
import { WorkflowCanvasMenu } from "@/components/WorkflowCanvas/WorkflowCanvasMenu";
import {
  type EventNodeType,
  type EventGroupNodeType,
  type NarrationGroupNodeType,
  type NarrativeNodeType,
  type PerspectiveNodeType,
  type WorkflowNode,
} from "@/lib/types/workflow";
import { nodeColor } from "@/lib/workflow/workflowUtils";

const nodeTypes: NodeTypes = {
  event: EventNode,
  perspective: PerspectiveNode,
  narrative: NarrativeNode,
  character: CharacterNode,
  eventGroup: EventGroupNode,
  perspectiveGroup: PerspectiveGroupNode,
  narrativeGroup: NarrativeGroupNode,
};

const edgeTypes: EdgeTypes = {
  customEdge: CustomEdge,
  eventEdge: EventEdge,
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

  const handleAddStoryOutlineCluster = useCallback(() => {
    const eventGroups = nodes.filter(
      (node): node is EventGroupNodeType => node.type === "eventGroup",
    );

    const DEFAULT_GROUP_STYLE = {
      width: 1200,
      height: 220,
      backgroundColor: "transparent",
      border: "none",
      padding: 0,
      boxShadow: "none",
    } as const;

    const baselineGroupStyle = eventGroups[0]?.style ?? DEFAULT_GROUP_STYLE;
    const baselineWidth =
      typeof baselineGroupStyle?.width === "number"
        ? baselineGroupStyle.width
        : DEFAULT_GROUP_STYLE.width;
    const baselineHeight =
      typeof baselineGroupStyle?.height === "number"
        ? baselineGroupStyle.height
        : DEFAULT_GROUP_STYLE.height;

    const VERTICAL_GAP = 80;
    const bottomMostEdge = eventGroups.reduce((accumulator, group) => {
      const groupHeight =
        typeof group.style?.height === "number"
          ? group.style.height
          : baselineHeight;
      return Math.max(accumulator, group.position.y + groupHeight);
    }, Number.NEGATIVE_INFINITY);

    const newGroupX = eventGroups[0]?.position.x ?? 200;
    const newGroupY =
      eventGroups.length === 0
        ? 20
        : (bottomMostEdge === Number.NEGATIVE_INFINITY
            ? eventGroups[0]!.position.y + baselineHeight
            : bottomMostEdge) + VERTICAL_GAP;

    const clusterSuffix =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const newGroupId = `event-group-${clusterSuffix}`;

    const newGroupNode: WorkflowNode = {
      id: newGroupId,
      type: "eventGroup",
      position: {
        x: newGroupX,
        y: newGroupY,
      },
      data: {
        label: "Story Outline",
      },
      style: {
        ...DEFAULT_GROUP_STYLE,
        ...(baselineGroupStyle ?? {}),
        width: baselineWidth,
        height: baselineHeight,
      },
    };

    // Create four empty event nodes
    const EVENT_HORIZONTAL_SPACING = 300;
    const EVENT_START_X = 20;
    const EVENT_START_Y = 60;
    const DEFAULT_EVENT_COUNT = 4;

    const newEventNodes: WorkflowNode[] = Array.from(
      { length: DEFAULT_EVENT_COUNT },
      (_, index) => ({
        id: `event-${clusterSuffix}-${index + 1}`,
        type: "event",
        position: {
          x: EVENT_START_X + index * EVENT_HORIZONTAL_SPACING,
          y: EVENT_START_Y,
        },
        draggable: false,
        data: {
          description: "",
          timeline: `Event ${index + 1}`,
        },
        parentId: newGroupId,
        extent: "parent",
      }),
    );

    setNodes((currentNodes) => [
      ...currentNodes,
      newGroupNode,
      ...newEventNodes,
    ]);

    // Create edges connecting the event nodes sequentially
    setEdges((currentEdges) => {
      const sequentialEdges = newEventNodes
        .slice(0, -1)
        .map((node, index) => ({
          id: `edge-${node.id}-${newEventNodes[index + 1]!.id}`,
          source: node.id,
          target: newEventNodes[index + 1]!.id,
          sourceHandle: "event-next",
          targetHandle: "event-prev",
          type: "eventEdge",
          animated: true,
        }));

      return [...currentEdges, ...sequentialEdges];
    });
  }, [nodes, setNodes, setEdges]);

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

  const handleAddThirdPersonCluster = useCallback(() => {
    const eventNodes = nodes.filter(
      (node): node is EventNodeType => node.type === "event",
    );
    if (eventNodes.length === 0) {
      return;
    }

    const sortedEvents = [...eventNodes].sort(
      (nodeA, nodeB) => nodeA.position.x - nodeB.position.x,
    );
    const narrativeGroups = nodes.filter(
      (node): node is NarrationGroupNodeType => node.type === "narrativeGroup",
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

    const baselineGroupStyle = narrativeGroups[0]?.style ?? DEFAULT_GROUP_STYLE;
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
      narrativeGroups.length > 0
        ? narrativeGroups[0]!.position.y
        : eventGroup?.position.y ?? 1020;
    const rightmostEdge = narrativeGroups.reduce((accumulator, group) => {
      const groupWidth =
        typeof group.style?.width === "number"
          ? group.style.width
          : baselineWidth;
      return Math.max(accumulator, group.position.x + groupWidth);
    }, Number.NEGATIVE_INFINITY);
    const newGroupX =
      narrativeGroups.length === 0
        ? eventGroup?.position.x ?? 100
        : (rightmostEdge === Number.NEGATIVE_INFINITY
            ? narrativeGroups[0]!.position.x + baselineWidth
            : rightmostEdge) + HORIZONTAL_GAP;
    const newGroupY = baseGroupY;

    const clusterSuffix =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const newGroupId = `narrative-group-${clusterSuffix}`;
    const narrativeRowY =
      narrativeGroups.length > 0
        ? nodes.find(
            (node): node is NarrativeNodeType =>
              node.type === "narrative" &&
              node.parentId === narrativeGroups[0]?.id,
          )?.position.y ?? 50
        : 50;

    const newNarrativeNodes: WorkflowNode[] = sortedEvents.map(
      (eventNode, indexPosition) => ({
        id: `narrative-${clusterSuffix}-${indexPosition + 1}`,
        type: "narrative",
        position: {
          x: eventNode.position.x,
          y: narrativeRowY,
        },
        data: {
          narration: "",
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
      type: "narrativeGroup",
      position: {
        x: newGroupX,
        y: newGroupY,
      },
      data: {
        label: "Third-Person Omniscient Cluster",
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
      ...newNarrativeNodes,
    ]);

    setEdges((currentEdges) => {
      const sequentialEdges = newNarrativeNodes
        .slice(0, -1)
        .map((node, indexPosition) => ({
          id: `edge-${node.id}-${newNarrativeNodes[indexPosition + 1]!.id}`,
          source: node.id,
          target: newNarrativeNodes[indexPosition + 1]!.id,
          sourceHandle: "narrative-next",
          targetHandle: "narrative-prev",
          type: "customEdge",
          animated: true,
        }));

      return [...currentEdges, ...sequentialEdges];
    });
  }, [nodes, setEdges, setNodes]);

  return (
    <div className="h-full min-h-0 w-full relative">
      <WorkflowCanvasMenu
        onAddStoryOutlineCluster={handleAddStoryOutlineCluster}
        onAddFirstPersonCluster={handleAddFirstPersonCluster}
        onAddThirdPersonCluster={handleAddThirdPersonCluster}
      />
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
        <MiniMap zoomable pannable nodeColor={nodeColor} />
      </ReactFlow>
    </div>
  );
}
