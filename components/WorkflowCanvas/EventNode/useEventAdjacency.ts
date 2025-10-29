import { useCallback } from "react";
import { useReactFlow, useStore } from "@xyflow/react";

import type {
  EventNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";

const EVENT_HORIZONTAL_GAP = 300;
const EVENT_ROW_START_X = 20;
const EVENT_NODE_WIDTH = 256;
const EVENT_GROUP_RIGHT_PADDING = 24;
const DEFAULT_EVENT_GROUP_WIDTH = 1200;
const DEFAULT_EVENT_GROUP_ID = "event-group";
const DEFAULT_NARRATION_GROUP_ID = "narration-group";
const PERSPECTIVE_NODE_WIDTH = 256;
const NARRATION_GROUP_RIGHT_PADDING = 24;
const DEFAULT_NARRATION_GROUP_WIDTH = 1200;

const parseEventTimelineIndex = (timeline?: string | null) => {
  if (!timeline) {
    return null;
  }

  const match = timeline.match(/(\d+)/);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1]!, 10);
};

const formatEventTimeline = (index: number) => `Event ${index}`;

const ensureEventData = (
  data: EventNodeType["data"] | undefined,
): EventNodeType["data"] => ({
  timeline: data?.timeline ?? "",
  description: data?.description ?? "",
});

export function useEventAdjacency(nodeId: string) {
  const { getNode, setNodes, setEdges } = useReactFlow<
    WorkflowNode,
    WorkflowEdge
  >();
  const hasPreviousEvent = useStore(
    useCallback(
      (store) =>
        store.edges.some(
          (edge) =>
            edge.target === nodeId && edge.targetHandle === "event-prev",
        ),
      [nodeId],
    ),
  );
  const hasNextEvent = useStore(
    useCallback(
      (store) =>
        store.edges.some(
          (edge) =>
            edge.source === nodeId && edge.sourceHandle === "event-next",
        ),
      [nodeId],
    ),
  );

  const handleAddAdjacentEvent = useCallback(
    (direction: "before" | "after") => {
      const referenceNode = getNode(nodeId);
      if (!referenceNode) {
        return;
      }

      const eventGroupId =
        (referenceNode as { parentId?: string }).parentId ??
        DEFAULT_EVENT_GROUP_ID;

      const timestamp = Date.now();
      const newEventId = `event-${timestamp}`;
      const newPerspectiveId = `perspective-${timestamp}`;
      let eventSequence: string[] = [];
      let perspectiveSequence: string[] = [];

      setNodes((nodesState) => {
        const eventNodes = nodesState.filter(
          (nodeState) => nodeState.type === "event",
        );
        const perspectiveNodes = nodesState.filter(
          (nodeState) => nodeState.type === "perspective",
        );

        const eventRowNodes = eventNodes.filter((nodeState) => {
          const parentId =
            (nodeState as { parentId?: string }).parentId ??
            DEFAULT_EVENT_GROUP_ID;
          return parentId === eventGroupId;
        });

        const sortedEventByPosition = [...eventRowNodes].sort(
          (a, b) => a.position.x - b.position.x,
        );
        const eventOrderMap = new Map<string, number>();
        sortedEventByPosition.forEach((nodeState, orderIndex) => {
          eventOrderMap.set(nodeState.id, orderIndex);
        });

        const referenceOrderIndex =
          eventOrderMap.get(referenceNode.id) ?? sortedEventByPosition.length;

        const referenceEventData = ensureEventData(
          referenceNode.data as EventNodeType["data"] | undefined,
        );
        let referenceTimelineIndex = parseEventTimelineIndex(
          referenceEventData.timeline,
        );
        if (referenceTimelineIndex == null) {
          referenceTimelineIndex = referenceOrderIndex + 1;
        }

        const targetTimelineIndex =
          direction === "before"
            ? Math.max(1, referenceTimelineIndex)
            : referenceTimelineIndex + 1;
        const targetOrderIndex =
          direction === "before"
            ? referenceOrderIndex
            : referenceOrderIndex + 1;

        const updatedNodes: WorkflowNode[] = nodesState.map((nodeState) => {
          if (nodeState.type !== "event") {
            return nodeState;
          }

          const parentId =
            (nodeState as { parentId?: string }).parentId ??
            DEFAULT_EVENT_GROUP_ID;
          if (parentId !== eventGroupId) {
            return nodeState;
          }

          const eventData = ensureEventData(
            nodeState.data as EventNodeType["data"] | undefined,
          );
          const currentIndex = parseEventTimelineIndex(eventData.timeline);
          const orderIndex = eventOrderMap.get(nodeState.id);
          const shouldShift =
            (currentIndex != null && currentIndex >= targetTimelineIndex) ||
            (currentIndex == null &&
              orderIndex != null &&
              orderIndex >= targetOrderIndex);

          if (!shouldShift) {
            return nodeState;
          }

          const nextIndex =
            currentIndex != null && currentIndex >= targetTimelineIndex
              ? currentIndex + 1
              : targetTimelineIndex +
                ((orderIndex ?? targetOrderIndex) - targetOrderIndex) +
                1;

          return {
            ...nodeState,
            data: {
              ...eventData,
              timeline: formatEventTimeline(nextIndex),
            },
          } as WorkflowNode;
        });

        const eventRowY = referenceNode.position.y;
        const perspectiveRowY =
          perspectiveNodes[0]?.position.y ?? eventRowY + 160;
        const startPositionX =
          direction === "before"
            ? referenceNode.position.x - EVENT_HORIZONTAL_GAP
            : referenceNode.position.x + EVENT_HORIZONTAL_GAP;

        const newEventNode: WorkflowNode = {
          id: newEventId,
          type: "event",
          position: {
            x: startPositionX,
            y: eventRowY,
          },
          data: {
            timeline: formatEventTimeline(targetTimelineIndex),
            description: "",
          },
          draggable: false,
          parentId: eventGroupId,
          extent: "parent",
        };

        const newPerspectiveNode: WorkflowNode = {
          id: newPerspectiveId,
          type: "perspective",
          position: {
            x: startPositionX,
            y: perspectiveRowY,
          },
          data: {
            narrator: `Narrator ${perspectiveNodes.length + 1}`,
            reflection: "",
            isLoading: false,
          },
          draggable: false,
          parentId: DEFAULT_NARRATION_GROUP_ID,
          extent: "parent",
        };

        const nodesWithNew = [
          ...updatedNodes,
          newEventNode,
          newPerspectiveNode,
        ];

        const eventRowNodesWithNew = nodesWithNew.filter((nodeState) => {
          if (nodeState.type !== "event") {
            return false;
          }
          const parentId =
            (nodeState as { parentId?: string }).parentId ??
            DEFAULT_EVENT_GROUP_ID;
          return parentId === eventGroupId;
        });
        if (eventRowNodesWithNew.length === 0) {
          return nodesWithNew;
        }

        const minEventX = Math.min(
          ...eventRowNodesWithNew.map((nodeState) => nodeState.position.x),
        );
        const normalizedStartX = Math.max(EVENT_ROW_START_X, minEventX);

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
            x: normalizedStartX + indexPosition * EVENT_HORIZONTAL_GAP,
            y: eventRowY,
          });
        });
        eventSequence = sortedEventNodes.map((nodeState) => nodeState.id);

        const perspectiveRowNodesWithNew = nodesWithNew.filter(
          (nodeState) => nodeState.type === "perspective",
        );
        const perspectivePositionMap = new Map<
          string,
          { x: number; y: number }
        >();

        if (perspectiveRowNodesWithNew.length > 0) {
          const sortedPerspectiveNodes = [...perspectiveRowNodesWithNew].sort(
            (a, b) => a.position.x - b.position.x,
          );

          sortedPerspectiveNodes.forEach((nodeState, indexPosition) => {
            const relatedEvent = sortedEventNodes[indexPosition];
            const fallbackX =
              normalizedStartX + indexPosition * EVENT_HORIZONTAL_GAP;
            const eventPosition = relatedEvent
              ? eventPositionMap.get(relatedEvent.id)
              : undefined;

            perspectivePositionMap.set(nodeState.id, {
              x: eventPosition?.x ?? fallbackX,
              y: perspectiveRowY,
            });
          });
          perspectiveSequence = sortedPerspectiveNodes.map(
            (nodeState) => nodeState.id,
          );
        }

        const currentGroupNode = nodesWithNew.find(
          (nodeState) =>
            nodeState.type === "eventGroup" && nodeState.id === eventGroupId,
        );
        const currentGroupWidth =
          typeof currentGroupNode?.style?.width === "number"
            ? currentGroupNode.style.width
            : DEFAULT_EVENT_GROUP_WIDTH;

        const rightmostEventEdge =
          normalizedStartX +
          (sortedEventNodes.length - 1) * EVENT_HORIZONTAL_GAP +
          EVENT_NODE_WIDTH;
        const computedGroupWidth =
          sortedEventNodes.length > 0
            ? rightmostEventEdge + EVENT_GROUP_RIGHT_PADDING
            : DEFAULT_EVENT_GROUP_WIDTH;
        const nextGroupWidth = Math.max(
          DEFAULT_EVENT_GROUP_WIDTH,
          currentGroupWidth,
          computedGroupWidth,
        );

        const narrationGroupNode = nodesWithNew.find(
          (nodeState) =>
            nodeState.type === "narrationGroup" &&
            nodeState.id === DEFAULT_NARRATION_GROUP_ID,
        );
        const currentNarrationWidth =
          typeof narrationGroupNode?.style?.width === "number"
            ? narrationGroupNode.style.width
            : DEFAULT_NARRATION_GROUP_WIDTH;
        let computedNarrationWidth = DEFAULT_NARRATION_GROUP_WIDTH;
        if (perspectiveRowNodesWithNew.length > 0) {
          let rightmostPerspectiveEdge = 0;
          perspectiveRowNodesWithNew.forEach((nodeState) => {
            const mappedPosition = perspectivePositionMap.get(nodeState.id);
            const positionX = mappedPosition?.x ?? nodeState.position.x;
            rightmostPerspectiveEdge = Math.max(
              rightmostPerspectiveEdge,
              positionX + PERSPECTIVE_NODE_WIDTH,
            );
          });
          if (rightmostPerspectiveEdge > 0) {
            computedNarrationWidth =
              rightmostPerspectiveEdge + NARRATION_GROUP_RIGHT_PADDING;
          }
        }
        const nextNarrationWidth = Math.max(
          DEFAULT_NARRATION_GROUP_WIDTH,
          currentNarrationWidth,
          computedNarrationWidth,
        );

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
                parentId: eventGroupId,
                extent: "parent",
              };
            }

            return {
              ...nodeState,
              parentId: eventGroupId,
              extent: "parent",
            };
          }

          if (nodeState.type === "perspective") {
            const newPosition = perspectivePositionMap.get(nodeState.id);
            if (newPosition) {
              return {
                ...nodeState,
                position: {
                  ...nodeState.position,
                  ...newPosition,
                },
                parentId: DEFAULT_NARRATION_GROUP_ID,
                extent: "parent",
              };
            }

            return {
              ...nodeState,
              parentId: DEFAULT_NARRATION_GROUP_ID,
              extent: "parent",
            };
          }

          if (
            nodeState.type === "eventGroup" &&
            nodeState.id === eventGroupId
          ) {
            return {
              ...nodeState,
              style: {
                ...nodeState.style,
                width: nextGroupWidth,
              },
            };
          }

          if (
            nodeState.type === "narrationGroup" &&
            nodeState.id === DEFAULT_NARRATION_GROUP_ID
          ) {
            return {
              ...nodeState,
              style: {
                ...nodeState.style,
                width: nextNarrationWidth,
              },
            };
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
            type: "customEdge",
            animated: true,
          });
        }

        return [...preservedEdges, ...rebuiltEdges];
      });
    },
    [getNode, nodeId, setEdges, setNodes],
  );

  return { hasPreviousEvent, hasNextEvent, handleAddAdjacentEvent };
}
