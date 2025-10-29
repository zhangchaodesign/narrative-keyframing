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
      let eventSequence: string[] = [];
      let perspectiveSequences = new Map<string, string[]>();

      setNodes((nodesState) => {
        perspectiveSequences = new Map<string, string[]>();

        const eventNodes = nodesState.filter(
          (nodeState) => nodeState.type === "event",
        );
        const perspectiveNodes = nodesState.filter(
          (nodeState) => nodeState.type === "perspective",
        );
        const perspectiveGroups = nodesState.filter(
          (nodeState) => nodeState.type === "perspectiveGroup",
        );

        const perspectiveNodesByGroup = new Map<string, WorkflowNode[]>();
        perspectiveGroups.forEach((groupNode) => {
          const groupId = groupNode.id;
          const children = perspectiveNodes.filter(
            (nodeState) =>
              nodeState.type === "perspective" &&
              (nodeState as { parentId?: string }).parentId === groupId,
          );
          perspectiveNodesByGroup.set(groupId, children);
        });

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

        const newPerspectiveNodes: WorkflowNode[] = [];
        perspectiveGroups.forEach((groupNode) => {
          const groupId = groupNode.id;
          const existingGroupPerspectives =
            perspectiveNodesByGroup.get(groupId) ?? [];
          const rowY =
            existingGroupPerspectives[0]?.position.y ??
            groupNode.position.y + 60;
          const narratorFallback =
            (groupNode.data as { characterName?: string } | undefined)
              ?.characterName?.trim() ??
            `Narrator ${existingGroupPerspectives.length + 1}`;
          const newPerspectiveId = `${groupId}-perspective-${timestamp}`;

          newPerspectiveNodes.push({
            id: newPerspectiveId,
            type: "perspective",
            position: {
              x: startPositionX,
              y: rowY,
            },
            data: {
              narrator: narratorFallback,
              reflection: "",
              isLoading: false,
            },
            draggable: false,
            parentId: groupId,
            extent: "parent",
          });
        });

        const nodesWithNew = [
          ...updatedNodes,
          newEventNode,
          ...newPerspectiveNodes,
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

        const perspectivePositionMapsByGroup = new Map<
          string,
          Map<string, { x: number; y: number }>
        >();

        perspectiveGroups.forEach((groupNode) => {
          const groupId = groupNode.id;
          const groupPerspectiveNodes = nodesWithNew.filter((nodeState) => {
            if (nodeState.type !== "perspective") {
              return false;
            }
            const parentId = (nodeState as { parentId?: string }).parentId;
            return parentId === groupId;
          });

          if (groupPerspectiveNodes.length === 0) {
            narrationWidthUpdates.set(
              groupId,
              DEFAULT_NARRATION_GROUP_WIDTH,
            );
            return;
          }

          const sortedPerspectiveNodes = [...groupPerspectiveNodes].sort(
            (a, b) => a.position.x - b.position.x,
          );

          const positionMap = new Map<string, { x: number; y: number }>();
          sortedPerspectiveNodes.forEach((nodeState, indexPosition) => {
            const relatedEvent = sortedEventNodes[indexPosition];
            const fallbackX =
              normalizedStartX + indexPosition * EVENT_HORIZONTAL_GAP;
            const eventPosition = relatedEvent
              ? eventPositionMap.get(relatedEvent.id)
              : undefined;

            positionMap.set(nodeState.id, {
              x: eventPosition?.x ?? fallbackX,
              y: nodeState.position.y,
            });
          });

          perspectivePositionMapsByGroup.set(groupId, positionMap);
          perspectiveSequences.set(
            groupId,
            sortedPerspectiveNodes.map((nodeState) => nodeState.id),
          );
        });

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
          computedGroupWidth,
        );

        const narrationWidthUpdates = new Map<string, number>();
        perspectiveGroups.forEach((groupNode) => {
          const groupId = groupNode.id;
          const positionMap = perspectivePositionMapsByGroup.get(groupId);
          if (!positionMap) {
            return;
          }

          const groupPerspectiveNodes = nodesWithNew.filter((nodeState) => {
            if (nodeState.type !== "perspective") {
              return false;
            }
            const parentId = (nodeState as { parentId?: string }).parentId;
            return parentId === groupId;
          });

          if (groupPerspectiveNodes.length === 0) {
            narrationWidthUpdates.set(
              groupId,
              DEFAULT_NARRATION_GROUP_WIDTH,
            );
            return;
          }

          let rightmostEdge = 0;
          groupPerspectiveNodes.forEach((nodeState) => {
            const mappedPosition = positionMap.get(nodeState.id);
            const positionX = mappedPosition?.x ?? nodeState.position.x;
            rightmostEdge = Math.max(
              rightmostEdge,
              positionX + PERSPECTIVE_NODE_WIDTH,
            );
          });

          const computedWidth =
            rightmostEdge > 0
              ? rightmostEdge + NARRATION_GROUP_RIGHT_PADDING
              : DEFAULT_NARRATION_GROUP_WIDTH;

          narrationWidthUpdates.set(
            groupId,
            Math.max(DEFAULT_NARRATION_GROUP_WIDTH, computedWidth),
          );
        });

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
            const parentId = (nodeState as { parentId?: string }).parentId;
            const positionMap = parentId
              ? perspectivePositionMapsByGroup.get(parentId)
              : null;
            const newPosition = positionMap?.get(nodeState.id);

            if (newPosition) {
              return {
                ...nodeState,
                position: {
                  ...nodeState.position,
                  ...newPosition,
                },
                parentId,
                extent: "parent",
              };
            }

            return nodeState;
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

          if (nodeState.type === "perspectiveGroup") {
            const nextWidth = narrationWidthUpdates.get(nodeState.id);
            if (nextWidth != null) {
              return {
                ...nodeState,
                style: {
                  ...nodeState.style,
                  width: nextWidth,
                },
              };
            }
            return nodeState;
          }

          return nodeState;
        });
      });

      setEdges((edgesState) => {
        const baseEdgeId = `edge-${timestamp}`;
        const eventIdSet = new Set(eventSequence);
        const perspectiveIdSet = new Set<string>();
        perspectiveSequences.forEach((sequence) => {
          sequence.forEach((id) => perspectiveIdSet.add(id));
        });

        const preservedEdges = edgesState.filter((edge) => {
          const isEventChainEdge =
            edge.sourceHandle === "event-next" &&
            edge.targetHandle === "event-prev" &&
            eventIdSet.has(edge.source) &&
            eventIdSet.has(edge.target);
          if (isEventChainEdge) {
            return false;
          }

          const isPerspectiveChainEdge =
            edge.sourceHandle === "perspective-next" &&
            edge.targetHandle === "perspective-prev" &&
            perspectiveIdSet.has(edge.source) &&
            perspectiveIdSet.has(edge.target);
          if (isPerspectiveChainEdge) {
            return false;
          }

          return true;
        });

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

        let groupIndex = 0;
        perspectiveSequences.forEach((sequence) => {
          for (let index = 0; index < sequence.length - 1; index += 1) {
            rebuiltEdges.push({
              id: `${baseEdgeId}-perspective-${groupIndex}-${index}`,
              source: sequence[index]!,
              target: sequence[index + 1]!,
              sourceHandle: "perspective-next",
              targetHandle: "perspective-prev",
              type: "customEdge",
              animated: true,
            });
          }
          groupIndex += 1;
        });

        return [...preservedEdges, ...rebuiltEdges];
      });
    },
    [getNode, nodeId, setEdges, setNodes],
  );

  const handleRemoveEvent = useCallback(() => {
    const referenceNode = getNode(nodeId);
    if (!referenceNode) {
      return;
    }

    const eventGroupId =
      (referenceNode as { parentId?: string }).parentId ??
      DEFAULT_EVENT_GROUP_ID;

    const timestamp = Date.now();
    let eventSequence: string[] = [];
    let perspectiveSequences = new Map<string, string[]>();
    let removedNodeIds: string[] = [];

    setNodes((nodesState) => {
      perspectiveSequences = new Map<string, string[]>();

      const eventNodes = nodesState.filter(
        (nodeState) => nodeState.type === "event",
      );
      const perspectiveNodes = nodesState.filter(
        (nodeState) => nodeState.type === "perspective",
      );
      const perspectiveGroups = nodesState.filter(
        (nodeState) => nodeState.type === "perspectiveGroup",
      );

      const eventRowNodes = eventNodes.filter((nodeState) => {
        const parentId =
          (nodeState as { parentId?: string }).parentId ??
          DEFAULT_EVENT_GROUP_ID;
        return parentId === eventGroupId;
      });

      const sortedEventNodes = [...eventRowNodes].sort((a, b) => {
        const indexA = parseEventTimelineIndex(
          (a.data as EventNodeType["data"])?.timeline,
        );
        const indexB = parseEventTimelineIndex(
          (b.data as EventNodeType["data"])?.timeline,
        );

        if (indexA != null && indexB != null && indexA !== indexB) {
          return indexA - indexB;
        }

        if (indexA != null) return -1;
        if (indexB != null) return 1;

        return a.position.x - b.position.x;
      });

      const referenceIndex = sortedEventNodes.findIndex(
        (nodeState) => nodeState.id === nodeId,
      );
      if (referenceIndex === -1) {
        return nodesState.filter((node) => node.id !== nodeId);
      }

      const nodesToRemove = new Set<string>([nodeId]);

      const perspectiveNodesByGroup = new Map<string, WorkflowNode[]>();
      perspectiveGroups.forEach((groupNode) => {
        const groupId = groupNode.id;
        const children = perspectiveNodes.filter(
          (nodeState) =>
            nodeState.type === "perspective" &&
            (nodeState as { parentId?: string }).parentId === groupId,
        );
        const sortedChildren = [...children].sort(
          (a, b) => a.position.x - b.position.x,
        );
        const perspectiveToRemove = sortedChildren[referenceIndex];
        if (perspectiveToRemove) {
          nodesToRemove.add(perspectiveToRemove.id);
        }
        perspectiveNodesByGroup.set(groupId, sortedChildren);
      });

      removedNodeIds = Array.from(nodesToRemove);

      const remainingNodes = nodesState.filter(
        (nodeState) => !nodesToRemove.has(nodeState.id),
      );

      const remainingEventNodes = remainingNodes.filter((nodeState) => {
        if (nodeState.type !== "event") {
          return false;
        }
        const parentId =
          (nodeState as { parentId?: string }).parentId ??
          DEFAULT_EVENT_GROUP_ID;
        return parentId === eventGroupId;
      });

      const sortedRemainingEvents = [...remainingEventNodes].sort((a, b) => {
        const indexA = parseEventTimelineIndex(
          (a.data as EventNodeType["data"])?.timeline,
        );
        const indexB = parseEventTimelineIndex(
          (b.data as EventNodeType["data"])?.timeline,
        );

        if (indexA != null && indexB != null && indexA !== indexB) {
          return indexA - indexB;
        }

        if (indexA != null) return -1;
        if (indexB != null) return 1;

        return a.position.x - b.position.x;
      });

      const eventRowY = referenceNode.position.y;
      const minEventX =
        sortedRemainingEvents.length > 0
          ? Math.min(...sortedRemainingEvents.map((nodeState) => nodeState.position.x))
          : referenceNode.position.x;
      const normalizedStartX = Math.max(EVENT_ROW_START_X, minEventX);

      const eventPositionMap = new Map<string, { x: number; y: number }>();
      sortedRemainingEvents.forEach((nodeState, indexPosition) => {
        eventPositionMap.set(nodeState.id, {
          x: normalizedStartX + indexPosition * EVENT_HORIZONTAL_GAP,
          y: eventRowY,
        });
      });
      eventSequence = sortedRemainingEvents.map((nodeState) => nodeState.id);

      const narrationWidthUpdates = new Map<string, number>();
      const perspectivePositionMapsByGroup = new Map<
        string,
        Map<string, { x: number; y: number }>
      >();

      perspectiveGroups.forEach((groupNode) => {
        const groupId = groupNode.id;
        const remainingPerspectiveNodes = remainingNodes.filter((nodeState) => {
          if (nodeState.type !== "perspective") {
            return false;
          }
          const parentId = (nodeState as { parentId?: string }).parentId;
          return parentId === groupId;
        });

        if (remainingPerspectiveNodes.length === 0) {
          perspectiveSequences.set(groupId, []);
          narrationWidthUpdates.set(
            groupId,
            DEFAULT_NARRATION_GROUP_WIDTH,
          );
          return;
        }

        const sortedPerspectiveNodes = [...remainingPerspectiveNodes].sort(
          (a, b) => a.position.x - b.position.x,
        );

        const positionMap = new Map<string, { x: number; y: number }>();
        sortedPerspectiveNodes.forEach((nodeState, indexPosition) => {
          const relatedEvent = sortedRemainingEvents[indexPosition];
          const fallbackX =
            normalizedStartX + indexPosition * EVENT_HORIZONTAL_GAP;
          const eventPosition = relatedEvent
            ? eventPositionMap.get(relatedEvent.id)
            : undefined;

          positionMap.set(nodeState.id, {
            x: eventPosition?.x ?? fallbackX,
            y: nodeState.position.y,
          });
        });

        perspectivePositionMapsByGroup.set(groupId, positionMap);
        perspectiveSequences.set(
          groupId,
          sortedPerspectiveNodes.map((nodeState) => nodeState.id),
        );

        let rightmostEdge = 0;
        sortedPerspectiveNodes.forEach((nodeState) => {
          const mappedPosition = positionMap.get(nodeState.id);
          const positionX = mappedPosition?.x ?? nodeState.position.x;
          rightmostEdge = Math.max(
            rightmostEdge,
            positionX + PERSPECTIVE_NODE_WIDTH,
          );
        });

        const computedWidth =
          rightmostEdge > 0
            ? rightmostEdge + NARRATION_GROUP_RIGHT_PADDING
            : DEFAULT_NARRATION_GROUP_WIDTH;

        narrationWidthUpdates.set(
          groupId,
          Math.max(DEFAULT_NARRATION_GROUP_WIDTH, computedWidth),
        );
      });

      const nextGroupWidth = (() => {
        if (sortedRemainingEvents.length === 0) {
          return DEFAULT_EVENT_GROUP_WIDTH;
        }

        const rightmostEventEdge =
          normalizedStartX +
          (sortedRemainingEvents.length - 1) * EVENT_HORIZONTAL_GAP +
          EVENT_NODE_WIDTH;
        const computedGroupWidth =
          rightmostEventEdge + EVENT_GROUP_RIGHT_PADDING;

        return Math.max(DEFAULT_EVENT_GROUP_WIDTH, computedGroupWidth);
      })();

      return remainingNodes.map((nodeState) => {
        if (nodeState.type === "event") {
          const newPosition = eventPositionMap.get(nodeState.id);
          if (!newPosition) {
            return nodeState;
          }

          const orderIndex = eventSequence.findIndex(
            (eventId) => eventId === nodeState.id,
          );
          const nextTimeline =
            orderIndex >= 0 ? formatEventTimeline(orderIndex + 1) : null;

          return {
            ...nodeState,
            position: {
              ...nodeState.position,
              ...newPosition,
            },
            data: {
              ...(nodeState.data as EventNodeType["data"]),
              timeline: nextTimeline ?? (nodeState.data as EventNodeType["data"])?.timeline ?? "",
            },
            parentId: eventGroupId,
            extent: "parent",
          } as WorkflowNode;
        }

        if (nodeState.type === "perspective") {
          const parentId = (nodeState as { parentId?: string }).parentId;
          const positionMap = parentId
            ? perspectivePositionMapsByGroup.get(parentId)
            : null;
          const newPosition = positionMap?.get(nodeState.id);
          if (!newPosition) {
            return nodeState;
          }

          return {
            ...nodeState,
            position: {
              ...nodeState.position,
              ...newPosition,
            },
            parentId,
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

        if (nodeState.type === "perspectiveGroup") {
          const nextWidth = narrationWidthUpdates.get(nodeState.id);
          if (nextWidth != null) {
            return {
              ...nodeState,
              style: {
                ...nodeState.style,
                width: nextWidth,
              },
            };
          }
        }

        return nodeState;
      });
    });

    setEdges((edgesState) => {
      const baseEdgeId = `edge-${timestamp}`;
      const removedIdSet = new Set(removedNodeIds);
      const eventIdSet = new Set(eventSequence);
      const perspectiveIdSet = new Set<string>();
      perspectiveSequences.forEach((sequence) => {
        sequence.forEach((id) => perspectiveIdSet.add(id));
      });

      const preservedEdges = edgesState.filter((edge) => {
        if (removedIdSet.has(edge.source) || removedIdSet.has(edge.target)) {
          return false;
        }

        const isEventChainEdge =
          edge.sourceHandle === "event-next" &&
          edge.targetHandle === "event-prev" &&
          eventIdSet.has(edge.source) &&
          eventIdSet.has(edge.target);
        if (isEventChainEdge) {
          return false;
        }

        const isPerspectiveChainEdge =
          edge.sourceHandle === "perspective-next" &&
          edge.targetHandle === "perspective-prev" &&
          perspectiveIdSet.has(edge.source) &&
          perspectiveIdSet.has(edge.target);
        if (isPerspectiveChainEdge) {
          return false;
        }

        return true;
      });

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

      let groupIndex = 0;
      perspectiveSequences.forEach((sequence) => {
        for (let index = 0; index < sequence.length - 1; index += 1) {
          rebuiltEdges.push({
            id: `${baseEdgeId}-perspective-${groupIndex}-${index}`,
            source: sequence[index]!,
            target: sequence[index + 1]!,
            sourceHandle: "perspective-next",
            targetHandle: "perspective-prev",
            type: "customEdge",
            animated: true,
          });
        }
        groupIndex += 1;
      });

      return [...preservedEdges, ...rebuiltEdges];
    });
  }, [getNode, nodeId, setEdges, setNodes]);

  return {
    hasPreviousEvent,
    hasNextEvent,
    handleAddAdjacentEvent,
    handleRemoveEvent,
  };
}
