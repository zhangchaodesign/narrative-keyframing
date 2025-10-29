import { useCallback } from "react";
import { useReactFlow, useStore } from "@xyflow/react";

import type {
  EventNodeType,
  PerspectiveNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";
import {
  parseEventTimelineIndex,
  sortNodesByTimeline,
} from "@/lib/utils/workflowUtils";

const EVENT_HORIZONTAL_GAP = 300;
const EVENT_ROW_START_X = 20;
const EVENT_NODE_WIDTH = 256;
const EVENT_GROUP_RIGHT_PADDING = 24;
const DEFAULT_EVENT_GROUP_WIDTH = 1200;
const DEFAULT_EVENT_GROUP_ID = "event-group";
const PERSPECTIVE_NODE_WIDTH = 256;
const NARRATION_GROUP_RIGHT_PADDING = 24;
const DEFAULT_NARRATION_GROUP_WIDTH = 1200;

type Position = { x: number; y: number };

// React Flow nodes only expose parentId when they actually have one; fall back when absent.
const getParentId = (node: WorkflowNode, fallbackId: string): string =>
  (node as { parentId?: string }).parentId ?? fallbackId;

interface EventLayoutParams {
  sortedEvents: WorkflowNode[];
  eventRowY: number;
  normalizedStartX: number;
}

interface EventLayoutResult {
  eventPositionMap: Map<string, Position>;
  eventSequence: string[];
  fallbackBaseX: number;
  rightmostEventEdge: number;
  eventPositions: Position[];
}

// Normalize event X positions so the row stays anchored and report the derived layout metadata.
const buildEventLayout = ({
  sortedEvents,
  eventRowY,
  normalizedStartX,
}: EventLayoutParams): EventLayoutResult => {
  const eventPositionMap = new Map<string, Position>();

  sortedEvents.forEach((nodeState, indexPosition) => {
    eventPositionMap.set(nodeState.id, {
      x: normalizedStartX + indexPosition * EVENT_HORIZONTAL_GAP,
      y: eventRowY,
    });
  });

  let leftmostEventX = Number.POSITIVE_INFINITY;
  sortedEvents.forEach((nodeState) => {
    const position = eventPositionMap.get(nodeState.id);
    if (position) {
      leftmostEventX = Math.min(leftmostEventX, position.x);
    }
  });

  const shiftOffset =
    leftmostEventX !== Number.POSITIVE_INFINITY &&
    leftmostEventX > EVENT_ROW_START_X
      ? leftmostEventX - EVENT_ROW_START_X
      : 0;

  if (shiftOffset > 0) {
    sortedEvents.forEach((nodeState) => {
      const position = eventPositionMap.get(nodeState.id);
      if (!position) {
        return;
      }

      eventPositionMap.set(nodeState.id, {
        x: position.x - shiftOffset,
        y: position.y,
      });
    });
  }

  const eventPositions = sortedEvents
    .map((nodeState) => eventPositionMap.get(nodeState.id))
    .filter((position): position is Position => position != null);

  const eventStartX =
    eventPositions.length > 0
      ? Math.min(...eventPositions.map((position) => position.x))
      : normalizedStartX;

  const rightmostEventEdge =
    eventPositions.length > 0
      ? Math.max(
          ...eventPositions.map((position) => position.x + EVENT_NODE_WIDTH),
        )
      : eventStartX + EVENT_NODE_WIDTH;

  return {
    eventPositionMap,
    eventSequence: sortedEvents.map((nodeState) => nodeState.id),
    fallbackBaseX: eventStartX,
    rightmostEventEdge,
    eventPositions,
  };
};

const getPerspectiveEventIndex = (
  nodeState: WorkflowNode,
  eventIndexMap: Map<string, number>,
) => {
  const perspectiveData =
    (nodeState.data as PerspectiveNodeType["data"] | undefined) ?? null;
  const eventId = perspectiveData?.event?.trim();
  if (!eventId) {
    return null;
  }

  const index = eventIndexMap.get(eventId);
  return index ?? null;
};

const sortPerspectiveNodes = (
  nodes: WorkflowNode[],
  eventIndexMap: Map<string, number>,
) =>
  [...nodes].sort((a, b) => {
    const indexA = getPerspectiveEventIndex(a, eventIndexMap);
    const indexB = getPerspectiveEventIndex(b, eventIndexMap);

    if (indexA != null && indexB != null) {
      if (indexA === indexB) {
        return a.position.x - b.position.x;
      }
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

interface PerspectiveLayoutParams {
  perspectiveGroups: WorkflowNode[];
  nodes: WorkflowNode[];
  eventSequence: string[];
  eventPositionMap: Map<string, Position>;
  fallbackBaseX: number;
  eventIndexMap: Map<string, number>;
}

interface PerspectiveLayoutResult {
  positionMapsByGroup: Map<string, Map<string, Position>>;
  sequences: Map<string, string[]>;
  widthUpdates: Map<string, number>;
  eventAssignments: Map<string, string>;
}

// Align perspective nodes with their events and track width adjustments per group.
const buildPerspectiveLayout = ({
  perspectiveGroups,
  nodes,
  eventSequence,
  eventPositionMap,
  fallbackBaseX,
  eventIndexMap,
}: PerspectiveLayoutParams): PerspectiveLayoutResult => {
  const positionMapsByGroup = new Map<string, Map<string, Position>>();
  const sequences = new Map<string, string[]>();
  const widthUpdates = new Map<string, number>();
  const eventAssignments = new Map<string, string>();

  perspectiveGroups.forEach((groupNode) => {
    const groupId = groupNode.id;
    const groupPerspectiveNodes = nodes.filter((nodeState) => {
      if (nodeState.type !== "perspective") {
        return false;
      }
      return getParentId(nodeState, "") === groupId;
    });

    if (groupPerspectiveNodes.length === 0) {
      sequences.set(groupId, []);
      widthUpdates.set(groupId, DEFAULT_NARRATION_GROUP_WIDTH);
      return;
    }

    const sortedPerspectiveNodes = sortPerspectiveNodes(
      groupPerspectiveNodes,
      eventIndexMap,
    );
    const positionMap = new Map<string, Position>();

    sortedPerspectiveNodes.forEach((nodeState, indexPosition) => {
      const perspectiveIndex = getPerspectiveEventIndex(
        nodeState,
        eventIndexMap,
      );
      const fallbackIndex =
        perspectiveIndex != null
          ? perspectiveIndex
          : eventSequence.length > 0
          ? Math.min(indexPosition, eventSequence.length - 1)
          : indexPosition;
      const fallbackEventId =
        eventSequence.length > 0
          ? eventSequence[fallbackIndex] ?? eventSequence[0]
          : null;
      const eventPosition = fallbackEventId
        ? eventPositionMap.get(fallbackEventId)
        : undefined;
      const fallbackX = fallbackBaseX + fallbackIndex * EVENT_HORIZONTAL_GAP;

      positionMap.set(nodeState.id, {
        x: eventPosition?.x ?? fallbackX,
        y: nodeState.position.y,
      });

      if (fallbackEventId) {
        eventAssignments.set(nodeState.id, fallbackEventId);
      }
    });

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

    widthUpdates.set(
      groupId,
      Math.max(DEFAULT_NARRATION_GROUP_WIDTH, computedWidth),
    );
    positionMapsByGroup.set(groupId, positionMap);
    sequences.set(
      groupId,
      sortedPerspectiveNodes.map((nodeState) => nodeState.id),
    );
  });

  return {
    positionMapsByGroup,
    sequences,
    widthUpdates,
    eventAssignments,
  };
};

const formatEventTimeline = (index: number) => `Event ${index}`;

const ensureEventData = (
  data: EventNodeType["data"] | undefined,
): EventNodeType["data"] => ({
  timeline: data?.timeline ?? "",
  description: data?.description ?? "",
});

interface RebuildEdgesParams {
  baseEdgeId: string;
  eventSequence: string[];
  perspectiveSequences: Map<string, string[]>;
}

// Rebuild event chain and perspective chain edges from sequences
const rebuildChainEdges = ({
  baseEdgeId,
  eventSequence,
  perspectiveSequences,
}: RebuildEdgesParams): WorkflowEdge[] => {
  const rebuiltEdges: WorkflowEdge[] = [];

  // Event chain edges
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

  // Perspective chain edges
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

  return rebuiltEdges;
};

interface UpdatePerspectiveNodeParams {
  nodeState: WorkflowNode;
  perspectivePositionMapsByGroup: Map<string, Map<string, Position>>;
  perspectiveEventAssignments: Map<string, string>;
}

// Update a perspective node with new position and event assignment
const updatePerspectiveNode = ({
  nodeState,
  perspectivePositionMapsByGroup,
  perspectiveEventAssignments,
}: UpdatePerspectiveNodeParams): WorkflowNode => {
  const parentId = (nodeState as { parentId?: string }).parentId;
  const positionMap = parentId
    ? perspectivePositionMapsByGroup.get(parentId)
    : null;
  const newPosition = positionMap?.get(nodeState.id);
  const existingData = (nodeState.data as PerspectiveNodeType["data"]) ?? {
    narrator: "",
    reflection: "",
    event: "",
  };
  const assignedEventId =
    perspectiveEventAssignments.get(nodeState.id) ?? existingData.event ?? "";
  const dataWithEvent =
    assignedEventId === existingData.event
      ? existingData
      : {
          ...existingData,
          event: assignedEventId,
        };

  return {
    ...nodeState,
    position: newPosition
      ? {
          ...nodeState.position,
          ...newPosition,
        }
      : nodeState.position,
    data: dataWithEvent,
    parentId,
    extent: "parent",
  } as WorkflowNode;
};

interface UpdateGroupWidthsParams {
  nodeState: WorkflowNode;
  eventGroupId: string;
  nextGroupWidth: number;
  narrationWidthUpdates: Map<string, number>;
}

// Update event group or perspective group widths
const updateGroupWidths = ({
  nodeState,
  eventGroupId,
  nextGroupWidth,
  narrationWidthUpdates,
}: UpdateGroupWidthsParams): WorkflowNode | null => {
  if (nodeState.type === "eventGroup" && nodeState.id === eventGroupId) {
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

  return null;
};

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
        // Snapshot existing perspectives by group so we can derive fallbacks.
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
            (
              groupNode.data as { characterName?: string } | undefined
            )?.characterName?.trim() ??
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
              event: newEventId,
            },
            draggable: false,
            parentId: groupId,
            extent: "parent",
          });
        });

        // Add the freshly created nodes before running the layout pass.
        const nodesWithNew = [
          ...updatedNodes,
          newEventNode,
          ...newPerspectiveNodes,
        ];

        const eventRowNodesWithNew = nodesWithNew.filter(
          (nodeState) =>
            nodeState.type === "event" &&
            getParentId(nodeState, DEFAULT_EVENT_GROUP_ID) === eventGroupId,
        );
        if (eventRowNodesWithNew.length === 0) {
          return nodesWithNew;
        }

        const minEventX = Math.min(
          ...eventRowNodesWithNew.map((nodeState) => nodeState.position.x),
        );
        const normalizedStartX = Math.max(EVENT_ROW_START_X, minEventX);
        const sortedEventNodes = sortNodesByTimeline(eventRowNodesWithNew);
        const eventLayout = buildEventLayout({
          sortedEvents: sortedEventNodes,
          eventRowY,
          normalizedStartX,
        });

        eventSequence = eventLayout.eventSequence;
        const eventIndexMap = new Map<string, number>();
        eventSequence.forEach((eventId, indexPosition) => {
          eventIndexMap.set(eventId, indexPosition);
        });

        // Use the shared helpers to normalize event spacing and align perspectives.
        const perspectiveLayout = buildPerspectiveLayout({
          perspectiveGroups,
          nodes: nodesWithNew,
          eventSequence,
          eventPositionMap: eventLayout.eventPositionMap,
          fallbackBaseX: eventLayout.fallbackBaseX,
          eventIndexMap,
        });

        const perspectivePositionMapsByGroup =
          perspectiveLayout.positionMapsByGroup;
        const perspectiveEventAssignments = perspectiveLayout.eventAssignments;
        const narrationWidthUpdates = perspectiveLayout.widthUpdates;
        perspectiveSequences = perspectiveLayout.sequences;

        const computedGroupWidth =
          eventLayout.eventPositions.length > 0
            ? eventLayout.rightmostEventEdge + EVENT_GROUP_RIGHT_PADDING
            : DEFAULT_EVENT_GROUP_WIDTH;
        const nextGroupWidth = Math.max(
          DEFAULT_EVENT_GROUP_WIDTH,
          computedGroupWidth,
        );

        return nodesWithNew.map((nodeState) => {
          if (nodeState.type === "event") {
            const newPosition = eventLayout.eventPositionMap.get(nodeState.id);
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
            return updatePerspectiveNode({
              nodeState,
              perspectivePositionMapsByGroup,
              perspectiveEventAssignments,
            });
          }

          const groupUpdate = updateGroupWidths({
            nodeState,
            eventGroupId,
            nextGroupWidth,
            narrationWidthUpdates,
          });
          if (groupUpdate) {
            return groupUpdate;
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

        const rebuiltEdges = rebuildChainEdges({
          baseEdgeId,
          eventSequence,
          perspectiveSequences,
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

      const sortedEventNodes = sortNodesByTimeline(eventRowNodes);

      const referenceIndex = sortedEventNodes.findIndex(
        (nodeState) => nodeState.id === nodeId,
      );
      if (referenceIndex === -1) {
        return nodesState.filter((node) => node.id !== nodeId);
      }

      const nodesToRemove = new Set<string>([nodeId]);

      // Mirror event deletions for each perspective group so rows stay aligned.
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
      });

      removedNodeIds = Array.from(nodesToRemove);

      const remainingNodes = nodesState.filter(
        (nodeState) => !nodesToRemove.has(nodeState.id),
      );

      const remainingEventNodes = remainingNodes.filter(
        (nodeState) =>
          nodeState.type === "event" &&
          getParentId(nodeState, DEFAULT_EVENT_GROUP_ID) === eventGroupId,
      );

      const sortedRemainingEvents = sortNodesByTimeline(remainingEventNodes);

      const eventRowY = referenceNode.position.y;
      const minEventX =
        sortedRemainingEvents.length > 0
          ? Math.min(
              ...sortedRemainingEvents.map((nodeState) => nodeState.position.x),
            )
          : referenceNode.position.x;
      const normalizedStartX = Math.max(EVENT_ROW_START_X, minEventX);

      const eventLayout = buildEventLayout({
        sortedEvents: sortedRemainingEvents,
        eventRowY,
        normalizedStartX,
      });

      eventSequence = eventLayout.eventSequence;
      const eventIndexMap = new Map<string, number>();
      eventSequence.forEach((eventId, indexPosition) => {
        eventIndexMap.set(eventId, indexPosition);
      });

      // Re-run the shared layout helpers to compress the remaining grid.
      const perspectiveLayout = buildPerspectiveLayout({
        perspectiveGroups,
        nodes: remainingNodes,
        eventSequence,
        eventPositionMap: eventLayout.eventPositionMap,
        fallbackBaseX: eventLayout.fallbackBaseX,
        eventIndexMap,
      });

      const perspectivePositionMapsByGroup =
        perspectiveLayout.positionMapsByGroup;
      const perspectiveEventAssignments = perspectiveLayout.eventAssignments;
      const narrationWidthUpdates = perspectiveLayout.widthUpdates;
      perspectiveSequences = perspectiveLayout.sequences;

      const nextGroupWidth =
        eventLayout.eventPositions.length === 0
          ? DEFAULT_EVENT_GROUP_WIDTH
          : Math.max(
              DEFAULT_EVENT_GROUP_WIDTH,
              eventLayout.rightmostEventEdge + EVENT_GROUP_RIGHT_PADDING,
            );

      return remainingNodes.map((nodeState) => {
        if (nodeState.type === "event") {
          const newPosition = eventLayout.eventPositionMap.get(nodeState.id);
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
              timeline:
                nextTimeline ??
                (nodeState.data as EventNodeType["data"])?.timeline ??
                "",
            },
            parentId: eventGroupId,
            extent: "parent",
          } as WorkflowNode;
        }

        if (nodeState.type === "perspective") {
          return updatePerspectiveNode({
            nodeState,
            perspectivePositionMapsByGroup,
            perspectiveEventAssignments,
          });
        }

        const groupUpdate = updateGroupWidths({
          nodeState,
          eventGroupId,
          nextGroupWidth,
          narrationWidthUpdates,
        });
        if (groupUpdate) {
          return groupUpdate;
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

      const rebuiltEdges = rebuildChainEdges({
        baseEdgeId,
        eventSequence,
        perspectiveSequences,
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
