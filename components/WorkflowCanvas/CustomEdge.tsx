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
} from "@/lib/types/workflow";

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

  const isEventPerspectiveEdge = useMemo(() => {
    const sourceNode = getNode(source);
    const targetNode = getNode(target);

    if (!sourceNode || !targetNode) {
      return false;
    }

    return (
      (sourceNode.type === "event" && targetNode.type === "perspective") ||
      (sourceNode.type === "perspective" && targetNode.type === "event")
    );
  }, [getNode, source, target]);

  const isPerspectiveEdge = useMemo(() => {
    const sourceNode = getNode(source);
    const targetNode = getNode(target);

    if (!sourceNode || !targetNode) {
      return false;
    }

    return (
      sourceNode.type === "perspective" && targetNode.type === "perspective"
    );
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
      const newPerspectiveId = `perspective-${timestamp}`;

      const sourceTimelineIndex = parseEventTimelineIndex(
        (sourceNode.data as EventNodeType["data"])?.timeline,
      );
      const targetTimelineIndex = parseEventTimelineIndex(
        (targetNode.data as EventNodeType["data"])?.timeline,
      );

      let eventSequence: string[] = [];
      let perspectiveSequence: string[] = [];

      setNodes((nodesState) => {
        const eventCount = nodesState.filter(
          (nodeState) => nodeState.type === "event",
        ).length;
        const perspectiveCount = nodesState.filter(
          (nodeState) => nodeState.type === "perspective",
        ).length;

        const eventRowY = sourceNode.position.y;
        const perspectiveRowY =
          nodesState.find((node) => node.type === "perspective")?.position.y ??
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

        const newPerspectiveNode: WorkflowNode = {
          id: newPerspectiveId,
          type: "perspective",
          position: {
            x: startPositionX,
            y: perspectiveRowY,
          },
          data: {
            narrator: `Narrator ${perspectiveCount + 1}`,
            reflection: "",
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

        const nodesWithNew = [
          ...updatedNodes,
          newEventNode,
          newPerspectiveNode,
        ];

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

        const perspectiveRowNodes = nodesWithNew.filter(
          (node) => node.type === "perspective",
        );
        const perspectivePositionMap = new Map<
          string,
          { x: number; y: number }
        >();

        if (perspectiveRowNodes.length > 0) {
          const sortedPerspectiveNodes = [...perspectiveRowNodes].sort(
            (a, b) => a.position.x - b.position.x,
          );

          const newEventIndex = sortedEventRowNodes.findIndex(
            (node) => node.id === newEventId,
          );
          const newPerspectiveIndex = sortedPerspectiveNodes.findIndex(
            (node) => node.id === newPerspectiveId,
          );

          if (
            newEventIndex >= 0 &&
            newPerspectiveIndex >= 0 &&
            newPerspectiveIndex !== newEventIndex
          ) {
            const [newPerspective] = sortedPerspectiveNodes.splice(
              newPerspectiveIndex,
              1,
            );
            const targetIndex = Math.min(
              sortedPerspectiveNodes.length,
              newEventIndex,
            );
            sortedPerspectiveNodes.splice(targetIndex, 0, newPerspective);
          }

          sortedPerspectiveNodes.forEach((node, index) => {
            const relatedEvent = sortedEventRowNodes[index];
            const fallbackX = startX + index * NARRATION_HORIZONTAL_GAP;
            const targetPosition = relatedEvent
              ? eventPositionMap.get(relatedEvent.id)
              : undefined;

            perspectivePositionMap.set(node.id, {
              x: targetPosition?.x ?? fallbackX,
              y: perspectiveRowY,
            });
          });
          perspectiveSequence = sortedPerspectiveNodes.map((node) => node.id);
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

          if (node.type === "perspective") {
            const newPosition = perspectivePositionMap.get(node.id);
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
            type: type ?? "customEdge",
            animated,
          });
        }

        const pairCount = Math.min(
          eventSequence.length,
          perspectiveSequence.length,
        );
        for (let index = 0; index < pairCount; index += 1) {
          rebuiltEdges.push({
            id: `${baseEdgeId}-event-perspective-${index}`,
            source: eventSequence[index]!,
            target: perspectiveSequence[index]!,
            sourceHandle: "perspective",
            targetHandle: "event",
            type: type ?? "customEdge",
            animated,
          });
        }

        for (
          let index = 0;
          index < perspectiveSequence.length - 1;
          index += 1
        ) {
          rebuiltEdges.push({
            id: `${baseEdgeId}-perspective-${index}`,
            source: perspectiveSequence[index]!,
            target: perspectiveSequence[index + 1]!,
            sourceHandle: "perspective-next",
            targetHandle: "perspective-prev",
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
              {!isEventEdge &&
                !isEventPerspectiveEdge &&
                !isPerspectiveEdge && (
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
