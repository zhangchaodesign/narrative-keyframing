"use client";

import { useCallback, useState } from "react";
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
import { RunPerspectiveContext } from "@/components/WorkflowCanvas/RunPerspectiveContext";
import {
  type EventNodeType,
  type EventGroupNodeType,
  type NarrationGroupNodeType,
  type PerspectiveNodeType,
  type WorkflowNode,
} from "@/lib/types/workflow";
import {
  preparePerspectiveRequest,
  type GeneratePerspectiveResponse,
} from "@/lib/perspective";

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
  const [isGenerating, setIsGenerating] = useState(false);
  const [runStatus, setRunStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

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

  const handleGeneratePerspectives = useCallback(
    async (targetNodeIds?: string[]) => {
      if (isGenerating) {
        return;
      }

      setRunStatus(null);
      setIsGenerating(true);
      let loadingNodeIds: Set<string> | null = null;

      try {
        const preparation = preparePerspectiveRequest({
          nodes,
          edges,
          targetNodeIds,
        });

        if (!preparation) {
          setRunStatus({
            type: "error",
            message: "No perspective nodes were eligible for generation.",
          });
          return;
        }

        const { eventSequence, tasks } = preparation;

        loadingNodeIds = new Set(tasks.map((task) => task.id));
        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.type !== "perspective") {
              return node;
            }

            const existingData = node.data as PerspectiveNodeType["data"];
            return {
              ...node,
              data: {
                ...existingData,
                isLoading: loadingNodeIds?.has(node.id) ?? false,
              },
            };
          }),
        );

        const response = await fetch("/api/perspective", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            eventSequence,
            perspectives: tasks,
          }),
        });

        if (!response.ok) {
          const errorBody = await response.json().catch(() => null);
          const errorMessage =
            (errorBody && errorBody.error) ||
            `Failed to generate perspectives (${response.status}).`;
          throw new Error(errorMessage);
        }

        const data = (await response.json()) as GeneratePerspectiveResponse;
        const perspectives = data?.perspectives ?? [];

        const orderedUpdates = perspectives
          .map((item, index) => {
            const task = tasks[index];
            if (!task) {
              return null;
            }
            return [task.id, item.reflection] as const;
          })
          .filter((entry): entry is readonly [string, string] => entry != null);

        if (orderedUpdates.length === 0) {
          setRunStatus({
            type: "error",
            message: "No perspective updates were returned.",
          });
          return;
        }

        if (perspectives.length !== tasks.length) {
          console.warn(
            "Perspective response count did not match requested tasks.",
            {
              requested: tasks.length,
              received: perspectives.length,
            },
          );
        }

        const updateMap = new Map<string, string>(orderedUpdates);

        setNodes((currentNodes) =>
          currentNodes.map((node) => {
            if (node.type === "perspective" && updateMap.has(node.id)) {
              const reflection = updateMap.get(node.id) ?? "";
              const existingData = node.data as PerspectiveNodeType["data"];
              return {
                ...node,
                data: {
                  ...existingData,
                  reflection,
                },
              };
            }
            return node;
          }),
        );

        setRunStatus(null);
      } catch (error) {
        console.error("Error generating perspectives:", error);
        setRunStatus({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unexpected error generating perspectives.",
        });
      } finally {
        if (loadingNodeIds) {
          setNodes((currentNodes) =>
            currentNodes.map((node) => {
              if (node.type !== "perspective") {
                return node;
              }
              if (!loadingNodeIds?.has(node.id)) {
                return node;
              }

              const existingData = node.data as PerspectiveNodeType["data"];
              return {
                ...node,
                data: {
                  ...existingData,
                  isLoading: false,
                },
              };
            }),
          );
        }
        setIsGenerating(false);
      }
    },
    [edges, isGenerating, nodes, setNodes],
  );

  return (
    <RunPerspectiveContext.Provider value={handleGeneratePerspectives}>
      <div className="h-full min-h-0 w-full relative">
        <div className="absolute left-3 top-3 z-20 flex flex-col gap-2">
          <button
            type="button"
            className="btn btn-neutral btn-xs"
            onClick={handleAddFirstPersonCluster}
          >
            Add a First-Person Limited Cluster
          </button>
          {runStatus && (
            <p className="text-[11px] text-red-500">{runStatus.message}</p>
          )}
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
          <MiniMap pannable zoomable />
        </ReactFlow>
      </div>
    </RunPerspectiveContext.Provider>
  );
}
