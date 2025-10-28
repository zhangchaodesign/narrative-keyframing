"use client";

import { useCallback, type ChangeEvent } from "react";
import {
  Position,
  type NodeProps,
  useReactFlow,
  useStore,
} from "@xyflow/react";
import { CustomHandle } from "../CustomHandle";
import { EventHandle } from "./EventHandle";
import { NodeActionMenu } from "../NodeActionMenu";
import type {
  EventNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "../workflow.constants";

const EVENT_HORIZONTAL_GAP = 300;

const parseEventTimelineIndex = (timeline?: string | null) => {
  if (!timeline) {
    return null;
  }

  const match = timeline.match(/(\d+)/);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1], 10);
};

const formatEventTimeline = (index: number) => `Event ${index}`;

export function EventNode({ id, data }: NodeProps<EventNodeType>) {
  const { setNodes, setEdges, getNode } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();
  const edges = useStore((store) => store.edges);

  const hasPreviousEvent = edges.some(
    (edge) => edge.target === id && edge.targetHandle === "event-prev",
  );
  const hasNextEvent = edges.some(
    (edge) => edge.source === id && edge.sourceHandle === "event-next",
  );

  const handleAddAdjacentEvent = useCallback(
    (direction: "before" | "after") => {
      const referenceNode = getNode(id);
      if (!referenceNode) {
        return;
      }

      const timestamp = Date.now();
      const newEventId = `event-${timestamp}`;
      const newNarrationId = `perspective-${timestamp}`;
      let eventSequence: string[] = [];
      let narrationSequence: string[] = [];

      setNodes((nodesState) => {
        const eventNodes = nodesState.filter(
          (nodeState) => nodeState.type === "event",
        );
        const narrationNodes = nodesState.filter(
          (nodeState) => nodeState.type === "perspective",
        );

        const eventRowY = referenceNode.position.y;
        const narrationRowY = narrationNodes[0]?.position.y ?? eventRowY + 160;
        const startPositionX =
          direction === "before"
            ? referenceNode.position.x - EVENT_HORIZONTAL_GAP
            : referenceNode.position.x + EVENT_HORIZONTAL_GAP;

        const existingIndices = eventNodes
          .map((nodeState) =>
            parseEventTimelineIndex(
              (nodeState.data as EventNodeType["data"])?.timeline,
            ),
          )
          .filter((value): value is number => value != null);
        const highestIndex =
          existingIndices.length > 0
            ? Math.max(...existingIndices)
            : eventNodes.length;
        const newTimelineIndex = direction === "before" ? 1 : highestIndex + 1;

        const updatedNodes: WorkflowNode[] = nodesState.map((nodeState) => {
          if (nodeState.type !== "event" || direction !== "before") {
            return nodeState;
          }

          const currentIndex = parseEventTimelineIndex(
            (nodeState.data as EventNodeType["data"])?.timeline,
          );
          if (currentIndex == null) {
            return nodeState;
          }

          const eventData = (nodeState.data as EventNodeType["data"]) ?? {
            timeline: "",
            description: "",
          };

          return {
            ...nodeState,
            data: {
              ...eventData,
              timeline: formatEventTimeline(currentIndex + 1),
            },
          } as WorkflowNode;
        });

        const newEventNode: WorkflowNode = {
          id: newEventId,
          type: "event",
          position: {
            x: startPositionX,
            y: eventRowY,
          },
          data: {
            timeline: formatEventTimeline(newTimelineIndex),
            description: "",
          },
          draggable: false,
        };

        const newNarrationNode: WorkflowNode = {
          id: newNarrationId,
          type: "perspective",
          position: {
            x: startPositionX,
            y: narrationRowY,
          },
          data: {
            narrator: `Narrator ${narrationNodes.length + 1}`,
            reflection: "",
            isLoading: false,
          },
          draggable: false,
        };

        const nodesWithNew = [...updatedNodes, newEventNode, newNarrationNode];

        const eventRowNodesWithNew = nodesWithNew.filter(
          (nodeState) => nodeState.type === "event",
        );
        if (eventRowNodesWithNew.length === 0) {
          return nodesWithNew;
        }

        const startX = Math.min(
          ...eventRowNodesWithNew.map((nodeState) => nodeState.position.x),
        );

        const sortedEventNodes = [...eventRowNodesWithNew].sort((a, b) => {
          const indexA = parseEventTimelineIndex(
            (a.data as EventNodeType["data"])?.timeline,
          );
          const indexB = parseEventTimelineIndex(
            (b.data as EventNodeType["data"])?.timeline,
          );

          if (indexA != null && indexB != null) {
            return indexA - indexB;
          }
          if (indexA != null) {
            return -1;
          }
          if (indexB != null) {
            return 1;
          }
          return a.position.x - b.position.x;
        });

        const eventPositionMap = new Map<string, { x: number; y: number }>();
        sortedEventNodes.forEach((nodeState, indexPosition) => {
          eventPositionMap.set(nodeState.id, {
            x: startX + indexPosition * EVENT_HORIZONTAL_GAP,
            y: eventRowY,
          });
        });
        eventSequence = sortedEventNodes.map((nodeState) => nodeState.id);

        const narrationRowNodesWithNew = nodesWithNew.filter(
          (nodeState) => nodeState.type === "perspective",
        );
        const narrationPositionMap = new Map<
          string,
          { x: number; y: number }
        >();

        if (narrationRowNodesWithNew.length > 0) {
          const sortedNarrationNodes = [...narrationRowNodesWithNew].sort(
            (a, b) => a.position.x - b.position.x,
          );

          sortedNarrationNodes.forEach((nodeState, indexPosition) => {
            const relatedEvent = sortedEventNodes[indexPosition];
            const fallbackX = startX + indexPosition * EVENT_HORIZONTAL_GAP;
            const eventPosition = relatedEvent
              ? eventPositionMap.get(relatedEvent.id)
              : undefined;

            narrationPositionMap.set(nodeState.id, {
              x: eventPosition?.x ?? fallbackX,
              y: narrationRowY,
            });
          });
          narrationSequence = sortedNarrationNodes.map(
            (nodeState) => nodeState.id,
          );
        }

        return nodesWithNew.map((nodeState) => {
          if (nodeState.type === "event") {
            const newPosition = eventPositionMap.get(nodeState.id);
            if (newPosition) {
              return {
                ...nodeState,
                position: {
                  ...nodeState.position,
                  ...newPosition,
                },
              };
            }
          }

          if (nodeState.type === "perspective") {
            const newPosition = narrationPositionMap.get(nodeState.id);
            if (newPosition) {
              return {
                ...nodeState,
                position: {
                  ...nodeState.position,
                  ...newPosition,
                },
              };
            }
          }

          return nodeState;
        });
      });

      setEdges((edgesState) => {
        const baseEdgeId = `edge-${timestamp}`;
        const preservedEdges = edgesState.filter(
          (edge) =>
            !(
              (edge.sourceHandle === "event-next" &&
                edge.targetHandle === "event-prev") ||
              (edge.sourceHandle === "perspective" &&
                edge.targetHandle === "event") ||
              (edge.sourceHandle === "perspective-next" &&
                edge.targetHandle === "perspective-prev")
            ),
        );

        const rebuiltEdges: WorkflowEdge[] = [];

        for (let index = 0; index < eventSequence.length - 1; index += 1) {
          rebuiltEdges.push({
            id: `${baseEdgeId}-event-${index}`,
            source: eventSequence[index]!,
            target: eventSequence[index + 1]!,
            sourceHandle: "event-next",
            targetHandle: "event-prev",
            type: "customEdge",
            animated: true,
          });
        }

        const pairCount = Math.min(
          eventSequence.length,
          narrationSequence.length,
        );
        for (let index = 0; index < pairCount; index += 1) {
          rebuiltEdges.push({
            id: `${baseEdgeId}-event-perspective-${index}`,
            source: eventSequence[index]!,
            target: narrationSequence[index]!,
            sourceHandle: "perspective",
            targetHandle: "event",
            type: "customEdge",
            animated: true,
          });
        }

        for (let index = 0; index < narrationSequence.length - 1; index += 1) {
          rebuiltEdges.push({
            id: `${baseEdgeId}-perspective-${index}`,
            source: narrationSequence[index]!,
            target: narrationSequence[index + 1]!,
            sourceHandle: "perspective-next",
            targetHandle: "perspective-prev",
            type: "customEdge",
            animated: true,
          });
        }

        return [...preservedEdges, ...rebuiltEdges];
      });
    },
    [getNode, id, setEdges, setNodes],
  );

  const handleDescriptionChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      const updatedDescription = event.target.value;
      setNodes(
        (nodes) =>
          nodes.map((node) =>
            node.id === id && node.type === "event"
              ? {
                  ...node,
                  data: {
                    ...node.data,
                    description: updatedDescription,
                  },
                }
              : node,
          ) as WorkflowNode[],
      );
    },
    [id, setNodes],
  );

  return (
    <div className="group relative w-64 rounded-lg border-2 border-zinc-500 bg-white p-3 text-xs hover:shadow-lg">
      {!hasPreviousEvent && (
        <button
          type="button"
          onClick={() => handleAddAdjacentEvent("before")}
          className="absolute -left-80 top-1/2 z-10 flex h-full w-full -translate-y-1/2 flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-100/70 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 opacity-0 transition hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 group-hover:opacity-100"
          title="Add event before"
          aria-label="Add event before"
        >
          <span className="text-lg leading-none">＋</span>
          <span>Add Event</span>
        </button>
      )}
      {!hasNextEvent && (
        <button
          type="button"
          onClick={() => handleAddAdjacentEvent("after")}
          className="absolute -right-80 top-1/2 z-10 flex h-full w-full -translate-y-1/2 flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-100/70 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 opacity-0 transition hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500 group-hover:opacity-100"
          title="Add event after"
          aria-label="Add event after"
        >
          <span className="text-lg leading-none">＋</span>
          <span>Add Event</span>
        </button>
      )}
      <NodeActionMenu nodeId={id} nodeType="event" />
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-800">
        📜 {data?.timeline}
      </div>
      <textarea
        value={data?.description ?? ""}
        onChange={handleDescriptionChange}
        placeholder="Describe the event..."
        rows={4}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
        onWheel={(event) => {
          if (event.ctrlKey || event.metaKey) {
            return;
          }
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation?.();
        }}
        onWheelCapture={(event) => {
          if (event.ctrlKey || event.metaKey) {
            return;
          }
          event.stopPropagation();
          event.nativeEvent.stopImmediatePropagation?.();
        }}
        className="mt-2 w-full resize-none rounded border border-zinc-300 bg-white/70 px-2 py-1 text-[10px] leading-snug text-zinc-800 outline-none focus:border-zinc-500 focus:bg-white focus:ring-1 focus:ring-zinc-400 nodrag nopan"
      />
      <EventHandle type="target" position={Position.Left} id="event-prev" />
      <EventHandle type="source" position={Position.Right} id="event-next" />
      <CustomHandle type="source" position={Position.Bottom} id="perspective" />
    </div>
  );
}
