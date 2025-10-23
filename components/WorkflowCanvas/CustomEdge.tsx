import React, { useCallback, useMemo, useState } from "react";
import { TbPlus, TbX } from "react-icons/tb";
import {
  BezierEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  useReactFlow,
} from "@xyflow/react";

import type {
  EventNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "./workflow.constants";

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

const EVENT_HORIZONTAL_GAP = 300;
const NARRATION_HORIZONTAL_GAP = 300;

export const CustomEdge: React.FC<EdgeProps<WorkflowEdge>> = (props) => {
  const [isHovered, setIsHovered] = useState(false);

  const {
    id,
    source,
    target,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    type,
    animated,
  } = props;

  const { setEdges, setNodes, getNode } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const isEventEdge = useMemo(() => {
    const sourceNode = getNode(source);
    const targetNode = getNode(target);

    if (!sourceNode || !targetNode) {
      return false;
    }

    return sourceNode.type === "event" && targetNode.type === "event";
  }, [getNode, source, target]);

  const isEventNarrationEdge = useMemo(() => {
    const sourceNode = getNode(source);
    const targetNode = getNode(target);

    if (!sourceNode || !targetNode) {
      return false;
    }

    return (
      (sourceNode.type === "event" && targetNode.type === "narration") ||
      (sourceNode.type === "narration" && targetNode.type === "event")
    );
  }, [getNode, source, target]);

  const isNarrationEdge = useMemo(() => {
    const sourceNode = getNode(source);
    const targetNode = getNode(target);

    if (!sourceNode || !targetNode) {
      return false;
    }

    return sourceNode.type === "narration" && targetNode.type === "narration";
  }, [getNode, source, target]);

  const handleDeleteEdge = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      setEdges((prevEdges) => prevEdges.filter((edge) => edge.id !== id));
      setIsHovered(false);
    },
    [id, setEdges],
  );

  const handleInsertNode = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();

      const sourceNode = getNode(source);
      const targetNode = getNode(target);

      if (!sourceNode || !targetNode) {
        return;
      }

      const isEventEdge =
        sourceNode.type === "event" && targetNode.type === "event";

      if (!isEventEdge) {
        return;
      }

      const timestamp = Date.now();
      const newEventId = `event-${timestamp}`;
      const newNarrationId = `narration-${timestamp}`;

      const sourceTimelineIndex = parseEventTimelineIndex(
        (sourceNode.data as EventNodeType["data"])?.timeline,
      );
      const targetTimelineIndex = parseEventTimelineIndex(
        (targetNode.data as EventNodeType["data"])?.timeline,
      );

      let eventSequence: string[] = [];
      let narrationSequence: string[] = [];

      setNodes((nodesState) => {
        const eventCount = nodesState.filter(
          (nodeState) => nodeState.type === "event",
        ).length;
        const narrationCount = nodesState.filter(
          (nodeState) => nodeState.type === "narration",
        ).length;

        const eventRowY = sourceNode.position.y;
        const narrationRowY =
          nodesState.find((node) => node.type === "narration")?.position.y ??
          eventRowY + 160;
        const startPositionX = targetNode.position.x;

        const insertTimelineIndex =
          targetTimelineIndex ??
          (sourceTimelineIndex != null
            ? sourceTimelineIndex + 1
            : eventCount + 1);

        const newEventNode: WorkflowNode = {
          id: newEventId,
          type: "event",
          position: {
            x: startPositionX,
            y: eventRowY,
          },
          data: {
            timeline: formatEventTimeline(insertTimelineIndex),
            description: "",
          },
          draggable: false,
        };

        const newNarrationNode: WorkflowNode = {
          id: newNarrationId,
          type: "narration",
          position: {
            x: startPositionX,
            y: narrationRowY,
          },
          data: {
            narrator: `Narrator ${narrationCount + 1}`,
            reflection: "Write the next reflection...",
          },
          draggable: false,
        };

        const updatedNodes: WorkflowNode[] = nodesState.map((nodeState) => {
          if (nodeState.type !== "event") {
            return nodeState;
          }

          const currentTimelineIndex = parseEventTimelineIndex(
            (nodeState.data as EventNodeType["data"])?.timeline,
          );
          if (
            currentTimelineIndex != null &&
            currentTimelineIndex >= insertTimelineIndex
          ) {
            const eventData = (nodeState.data as EventNodeType["data"]) ?? {
              timeline: "",
              description: "",
            };
            return {
              ...nodeState,
              data: {
                ...eventData,
                timeline: formatEventTimeline(currentTimelineIndex + 1),
              },
            } as WorkflowNode;
          }

          return nodeState;
        });

        const nodesWithNew = [...updatedNodes, newEventNode, newNarrationNode];

        const eventRowNodes = nodesWithNew.filter(
          (node) => node.type === "event",
        );

        if (eventRowNodes.length === 0) {
          return nodesWithNew;
        }

        const startX = Math.min(
          ...eventRowNodes.map((node) => node.position.x),
        );

        const sortedEventRowNodes = [...eventRowNodes].sort((a, b) => {
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
        sortedEventRowNodes.forEach((node, index) => {
          eventPositionMap.set(node.id, {
            x: startX + index * EVENT_HORIZONTAL_GAP,
            y: eventRowY,
          });
        });
        eventSequence = sortedEventRowNodes.map((node) => node.id);

        const narrationRowNodes = nodesWithNew.filter(
          (node) => node.type === "narration",
        );
        const narrationPositionMap = new Map<
          string,
          { x: number; y: number }
        >();

        if (narrationRowNodes.length > 0) {
          const sortedNarrationNodes = [...narrationRowNodes].sort(
            (a, b) => a.position.x - b.position.x,
          );

          const newEventIndex = sortedEventRowNodes.findIndex(
            (node) => node.id === newEventId,
          );
          const newNarrationIndex = sortedNarrationNodes.findIndex(
            (node) => node.id === newNarrationId,
          );

          if (
            newEventIndex >= 0 &&
            newNarrationIndex >= 0 &&
            newNarrationIndex !== newEventIndex
          ) {
            const [newNarration] = sortedNarrationNodes.splice(
              newNarrationIndex,
              1,
            );
            const targetIndex = Math.min(
              sortedNarrationNodes.length,
              newEventIndex,
            );
            sortedNarrationNodes.splice(targetIndex, 0, newNarration);
          }

          sortedNarrationNodes.forEach((node, index) => {
            const relatedEvent = sortedEventRowNodes[index];
            const fallbackX = startX + index * NARRATION_HORIZONTAL_GAP;
            const targetPosition = relatedEvent
              ? eventPositionMap.get(relatedEvent.id)
              : undefined;

            narrationPositionMap.set(node.id, {
              x: targetPosition?.x ?? fallbackX,
              y: narrationRowY,
            });
          });
          narrationSequence = sortedNarrationNodes.map((node) => node.id);
        }

        return nodesWithNew.map((node) => {
          if (node.type === "event") {
            const newPosition = eventPositionMap.get(node.id);
            if (newPosition) {
              return {
                ...node,
                position: {
                  ...node.position,
                  ...newPosition,
                },
              };
            }
          }

          if (node.type === "narration") {
            const newPosition = narrationPositionMap.get(node.id);
            if (newPosition) {
              return {
                ...node,
                position: {
                  ...node.position,
                  ...newPosition,
                },
              };
            }
          }

          return node;
        });
      });

      setEdges((edgesState) => {
        const baseEdgeId = `edge-${timestamp}`;
        const preservedEdges = edgesState.filter(
          (edge) =>
            !(
              edge.id === id ||
              (edge.sourceHandle === "event-next" &&
                edge.targetHandle === "event-prev") ||
              (edge.sourceHandle === "narration" &&
                edge.targetHandle === "event") ||
              (edge.sourceHandle === "narration-next" &&
                edge.targetHandle === "narration-prev")
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
            type: type ?? "customEdge",
            animated,
          });
        }

        const pairCount = Math.min(
          eventSequence.length,
          narrationSequence.length,
        );
        for (let index = 0; index < pairCount; index += 1) {
          rebuiltEdges.push({
            id: `${baseEdgeId}-event-narration-${index}`,
            source: eventSequence[index]!,
            target: narrationSequence[index]!,
            sourceHandle: "narration",
            targetHandle: "event",
            type: type ?? "customEdge",
            animated,
          });
        }

        for (let index = 0; index < narrationSequence.length - 1; index += 1) {
          rebuiltEdges.push({
            id: `${baseEdgeId}-narration-${index}`,
            source: narrationSequence[index]!,
            target: narrationSequence[index + 1]!,
            sourceHandle: "narration-next",
            targetHandle: "narration-prev",
            type: type ?? "customEdge",
            animated,
          });
        }

        return [...preservedEdges, ...rebuiltEdges];
      });

      setIsHovered(false);
    },
    [animated, getNode, id, setEdges, setNodes, source, target, type],
  );

  return (
    <>
      <g
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <BezierEdge {...props} />
        <EdgeLabelRenderer>
          {isHovered && (
            <div
              className="absolute flex items-center gap-1"
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                pointerEvents: "all",
              }}
            >
              {isEventEdge && (
                <button
                  type="button"
                  aria-label="Insert node"
                  className="btn btn-circle btn-xs bg-transparent shadow-none border-0 text-indigo-500 hover:bg-indigo-500 hover:text-white hover:border-white rounded-full"
                  onClick={handleInsertNode}
                >
                  <TbPlus />
                </button>
              )}
              {!isEventEdge && !isEventNarrationEdge && !isNarrationEdge && (
                <button
                  type="button"
                  aria-label="Delete edge"
                  className="btn btn-circle btn-xs bg-transparent shadow-none border-0 text-red-500 hover:bg-red-500 hover:text-white hover:border-white rounded-full"
                  onClick={handleDeleteEdge}
                >
                  <TbX />
                </button>
              )}
            </div>
          )}
        </EdgeLabelRenderer>
      </g>
    </>
  );
};
