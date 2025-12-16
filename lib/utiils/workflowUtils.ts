import type {
  EventNodeType,
  EventGroupNodeType,
  NarrationGroupNodeType,
  NarrativeNodeType,
  PerspectiveNodeType,
  WorkflowNode,
  WorkflowEdge,
} from "@/lib/types/workflow";

// ============================================================================
// DATA UTILITIES
// ============================================================================

/**
 * Deep clone data using JSON serialization
 * Safe for most data types but will lose functions, symbols, and undefined values
 * @param data Data to clone
 * @returns Cloned data or original if cloning fails
 */
export function cloneData<DataType>(data: DataType): DataType {
  if (data == null) {
    return data;
  }

  try {
    return JSON.parse(JSON.stringify(data)) as DataType;
  } catch {
    return data;
  }
}

// ============================================================================
// TIMELINE UTILITIES
// ============================================================================

/**
 * Parse timeline string to extract numeric index
 * @param timeline Timeline string (e.g., "Event 1", "1", etc.)
 * @returns Numeric index or null if not found
 */
export const parseEventTimelineIndex = (
  timeline?: string | null,
): number | null => {
  if (!timeline) {
    return null;
  }

  const match = timeline.match(/(\d+)/);
  if (!match) {
    return null;
  }

  return Number.parseInt(match[1] ?? "", 10);
};

/**
 * Format event timeline with index
 * @param index Timeline index number
 * @returns Formatted timeline string
 */
export const formatEventTimeline = (index: number): string => `Event ${index}`;

// ============================================================================
// SORTING UTILITIES
// ============================================================================

/**
 * Sort event nodes by timeline index and position
 * @param eventNodes Array of event nodes to sort
 * @returns Sorted array of event nodes
 */
export const sortEventsByTimeline = (
  eventNodes: EventNodeType[],
): EventNodeType[] => {
  return [...eventNodes].sort((nodeA, nodeB) => {
    const indexA = parseEventTimelineIndex(nodeA.data?.timeline);
    const indexB = parseEventTimelineIndex(nodeB.data?.timeline);

    if (indexA != null && indexB != null && indexA !== indexB) {
      return indexA - indexB;
    }

    if (indexA != null) return -1;
    if (indexB != null) return 1;

    return nodeA.position.x - nodeB.position.x;
  });
};

/**
 * Sort workflow nodes (generic) by timeline index and position
 * Used for sorting mixed node types that may contain event data
 * @param nodes Array of workflow nodes to sort
 * @returns Sorted array of workflow nodes
 */
export const sortNodesByTimeline = (nodes: WorkflowNode[]): WorkflowNode[] => {
  return [...nodes].sort((a, b) => {
    const indexA = parseEventTimelineIndex(
      (a.data as EventNodeType["data"] | undefined)?.timeline,
    );
    const indexB = parseEventTimelineIndex(
      (b.data as EventNodeType["data"] | undefined)?.timeline,
    );

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
};

// ============================================================================
// ID GENERATION UTILITIES
// ============================================================================

/**
 * Generate a unique ID with incremental suffix
 * Creates IDs in format: baseId, baseId-copy, baseId-copy-2, baseId-copy-3, etc.
 * @param baseId Base ID to use
 * @param existingIds Set of existing IDs to check against
 * @returns Unique ID that doesn't exist in the set
 */
export const generateUniqueIncrementalId = (
  baseId: string,
  existingIds: Set<string>,
): string => {
  const copyBaseId = `${baseId}-copy`;
  let candidateId = copyBaseId;
  let attempt = 1;

  while (existingIds.has(candidateId)) {
    attempt += 1;
    candidateId = `${copyBaseId}-${attempt}`;
  }

  return candidateId;
};

/**
 * Generate a random suffix for unique IDs
 * Uses crypto.randomUUID if available, otherwise falls back to timestamp + random
 * @returns Random suffix string
 */
const randomSuffix = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

/**
 * Generate a unique ID with UUID-based suffix
 * Creates IDs in format: prefix-uuid
 * @param prefix Prefix for the ID
 * @param existingIds Set of existing IDs to check against
 * @returns Unique ID that doesn't exist in the set
 */
export const generateUniqueUuidId = (
  prefix: string,
  existingIds: Set<string>,
): string => {
  let candidate = `${prefix}-${randomSuffix()}`;
  while (existingIds.has(candidate)) {
    candidate = `${prefix}-${randomSuffix()}`;
  }
  return candidate;
};

// ============================================================================
// NODE MANIPULATION UTILITIES
// ============================================================================

/**
 * Duplicate a workflow node with a new ID and offset position
 * @param node Node to duplicate
 * @param existingIds Set of existing node IDs
 * @param offset Position offset for the duplicated node (default: 40)
 * @returns Duplicated node with new ID and offset position
 */
export const duplicateWorkflowNode = (
  node: WorkflowNode,
  existingIds: Set<string>,
  offset: number = 40,
): WorkflowNode => {
  const newId = generateUniqueIncrementalId(node.id, existingIds);

  return {
    ...node,
    id: newId,
    data: cloneData(node.data),
    position: {
      x: node.position.x + offset,
      y: node.position.y + offset,
    },
    selected: false,
    dragging: false,
  } as WorkflowNode;
};

/**
 * Delete a node and its associated edges
 * @param nodeId ID of the node to delete
 * @param nodes Array of all nodes
 * @param edges Array of all edges
 * @returns Object with filtered nodes and edges
 */
export const deleteNodeWithEdges = (
  nodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } => {
  return {
    nodes: nodes.filter((node) => node.id !== nodeId),
    edges: edges.filter(
      (edge) => edge.source !== nodeId && edge.target !== nodeId,
    ),
  };
};

/**
 * Delete a node cluster (parent and all children) and associated edges
 * @param parentNodeId ID of the parent node
 * @param nodes Array of all nodes
 * @param edges Array of all edges
 * @returns Object with filtered nodes and edges
 */
export const deleteNodeCluster = (
  parentNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } => {
  const clusterNodeIds = new Set<string>();

  nodes.forEach((node) => {
    if (
      node.id === parentNodeId ||
      (node as { parentId?: string }).parentId === parentNodeId
    ) {
      clusterNodeIds.add(node.id);
    }
  });

  if (clusterNodeIds.size === 0) {
    return { nodes, edges };
  }

  return {
    nodes: nodes.filter((node) => !clusterNodeIds.has(node.id)),
    edges: edges.filter(
      (edge) =>
        !clusterNodeIds.has(edge.source) && !clusterNodeIds.has(edge.target),
    ),
  };
};

// ============================================================================
// STYLE UTILITIES
// ============================================================================

/**
 * Get color for a workflow node based on its type
 * @param node Workflow node
 * @returns Color string for the node
 */
export function nodeColor(node: WorkflowNode) {
  switch (node.type) {
    case "eventGroup":
      return "oklch(97.1% 0.014 343.198)";
    case "perspectiveGroup":
      return "oklch(97% 0.014 254.604)";
    case "narrativeGroup":
      return "oklch(97% 0.014 300)";
    case "event":
      return "oklch(89.9% 0.061 343.231)";
    case "perspective":
      return "oklch(88.2% 0.059 254.128)";
    case "narrative":
      return "oklch(98.2% 0.018 155.826)";
    case "character":
      return "oklch(95.4% 0.038 75.164)";
    default:
      return "#67cc8a";
  }
}

// ============================================================================
// CLUSTER CREATION UTILITIES
// ============================================================================

export type CreateStoryOutlineClusterOptions = {
  eventCount?: number;
};

/**
 * Create a story outline cluster (event group with event nodes)
 * @param currentNodes Array of existing workflow nodes
 * @param options Configuration options for the cluster
 * @returns Object with new nodes and edges to add
 */
export function createStoryOutlineCluster(
  currentNodes: WorkflowNode[],
  options: CreateStoryOutlineClusterOptions = {},
): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
} {
  const { eventCount = 4 } = options;

  const eventGroups = currentNodes.filter(
    (node): node is EventGroupNodeType => node.type === "eventGroup",
  );
  const highestEventGroupId = eventGroups.reduce((accumulator, group) => {
    const groupId = group.data?.eventGroupId ?? 0;
    return groupId > accumulator ? groupId : accumulator;
  }, 0);
  const nextEventGroupId = highestEventGroupId + 1;

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

  const clusterSuffix = randomSuffix();
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
      eventGroupId: nextEventGroupId,
    },
    style: {
      ...DEFAULT_GROUP_STYLE,
      ...(baselineGroupStyle ?? {}),
      width: baselineWidth,
      height: baselineHeight,
    },
  };

  // Create event nodes
  const EVENT_HORIZONTAL_SPACING = 300;
  const EVENT_START_X = 20;
  const EVENT_START_Y = 60;

  const newEventNodes: WorkflowNode[] = Array.from(
    { length: eventCount },
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

  const sequentialEdges = newEventNodes.slice(0, -1).map((node, index) => ({
    id: `edge-${node.id}-${newEventNodes[index + 1]!.id}`,
    source: node.id,
    target: newEventNodes[index + 1]!.id,
    sourceHandle: "event-next",
    targetHandle: "event-prev",
    type: "eventEdge",
    animated: true,
  }));

  return {
    nodes: [newGroupNode, ...newEventNodes],
    edges: sequentialEdges,
  };
}

export type CreatePerspectiveGroupOptions = {
  characterName?: string;
  eventGroupId?: string;
};

/**
 * Create a perspective group cluster (perspective group with perspective nodes and character nodes)
 * @param currentNodes Array of existing workflow nodes
 * @param currentEdges Array of existing workflow edges
 * @param options Configuration options for the cluster
 * @returns Object with new nodes and edges to add
 */
export function createPerspectiveGroup(
  currentNodes: WorkflowNode[],
  currentEdges: WorkflowEdge[],
  options: CreatePerspectiveGroupOptions = {},
): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
} {
  const { characterName = "", eventGroupId } = options;

  // Find event nodes to base the cluster on
  const eventNodes = currentNodes.filter((node): node is EventNodeType => {
    if (eventGroupId) {
      return node.type === "event" && node.parentId === eventGroupId;
    }
    return node.type === "event";
  });

  if (eventNodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const sortedEvents = [...eventNodes].sort(
    (nodeA, nodeB) => nodeA.position.x - nodeB.position.x,
  );

  const perspectiveGroups = currentNodes.filter(
    (node): node is NarrationGroupNodeType => node.type === "perspectiveGroup",
  );

  const eventGroup = eventGroupId
    ? currentNodes.find(
        (node): node is EventGroupNodeType =>
          node.id === eventGroupId && node.type === "eventGroup",
      )
    : currentNodes.find(
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

  const baselineGroupStyle = perspectiveGroups[0]?.style ?? DEFAULT_GROUP_STYLE;
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
  const VERTICAL_GAP = 80;

  // Calculate Y position: below event group or aligned with existing perspective groups
  const eventGroupHeight =
    typeof eventGroup?.style?.height === "number"
      ? eventGroup.style.height
      : 220; // Default event group height

  const baseGroupY =
    perspectiveGroups.length > 0
      ? perspectiveGroups[0]!.position.y
      : (eventGroup?.position.y ?? 20) + eventGroupHeight + VERTICAL_GAP;
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

  const clusterSuffix = randomSuffix();
  const newGroupId = `perspective-group-${clusterSuffix}`;
  const perspectiveRowY =
    perspectiveGroups.length > 0
      ? currentNodes.find(
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
        narrator: characterName,
        reflection: "",
        isLoading: false,
        eventId: eventNode.id,
      },
      draggable: false,
      parentId: newGroupId,
      extent: "parent",
    }),
  );

  const label = characterName
    ? `${characterName}'s Perspective`
    : "First-Person Limited Cluster";

  const newGroupNode: WorkflowNode = {
    id: newGroupId,
    type: "perspectiveGroup",
    position: {
      x: newGroupX,
      y: newGroupY,
    },
    data: {
      label,
      characterName,
    },
    style: {
      ...DEFAULT_GROUP_STYLE,
      ...(baselineGroupStyle ?? {}),
      width: clusterWidth,
      height: baselineHeight,
    },
  };

  // Create character nodes for first and last perspective nodes
  const firstPerspective = newPerspectiveNodes[0];
  const lastPerspective = newPerspectiveNodes[newPerspectiveNodes.length - 1];
  const characterNodes: WorkflowNode[] = [];
  const characterEdges: WorkflowEdge[] = [];

  if (firstPerspective) {
    const firstCharacterId = `character-${clusterSuffix}-1`;
    characterNodes.push({
      id: firstCharacterId,
      type: "character",
      position: {
        x: firstPerspective.position.x,
        y: 280,
      },
      draggable: false,
      data: {
        name: characterName || "",
        traits: {
          physiology: [],
          psychology: [],
          sociology: [],
        },
        perspectiveId: firstPerspective.id,
      },
      parentId: newGroupId,
      extent: "parent",
    });

    characterEdges.push({
      id: `edge-${firstCharacterId}-${firstPerspective.id}`,
      source: firstCharacterId,
      target: firstPerspective.id,
      sourceHandle: "perspective",
      targetHandle: "character",
      type: "customEdge",
      animated: true,
    });
  }

  if (lastPerspective && lastPerspective.id !== firstPerspective?.id) {
    const lastCharacterId = `character-${clusterSuffix}-${newPerspectiveNodes.length}`;
    characterNodes.push({
      id: lastCharacterId,
      type: "character",
      position: {
        x: lastPerspective.position.x,
        y: 280,
      },
      draggable: false,
      data: {
        name: characterName || "",
        traits: {
          physiology: [],
          psychology: [],
          sociology: [],
        },
        perspectiveId: lastPerspective.id,
      },
      parentId: newGroupId,
      extent: "parent",
    });

    characterEdges.push({
      id: `edge-${lastCharacterId}-${lastPerspective.id}`,
      source: lastCharacterId,
      target: lastPerspective.id,
      sourceHandle: "perspective",
      targetHandle: "character",
      type: "customEdge",
      animated: true,
    });
  }

  const newNodes = [newGroupNode, ...newPerspectiveNodes, ...characterNodes];

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

  const eventGroupIdForBridge = eventGroup?.id ?? eventGroupId ?? "event-group";
  const bridgingEdge = {
    id: `edge-${eventGroupIdForBridge}-${newGroupId}`,
    source: eventGroupIdForBridge,
    target: newGroupId,
    sourceHandle: "group-bridge",
    targetHandle: "group-bridge",
    type: "customEdge",
    animated: true,
  };

  const newEdges = [bridgingEdge, ...sequentialEdges, ...characterEdges];

  return { nodes: newNodes, edges: newEdges };
}

export type CreateNarrativeGroupOptions = {
  eventGroupId?: string;
};

/**
 * Create a narrative group cluster (narrative group with narrative nodes)
 * @param currentNodes Array of existing workflow nodes
 * @param options Configuration options for the cluster
 * @returns Object with new nodes and edges to add
 */
export function createNarrativeGroup(
  currentNodes: WorkflowNode[],
  options: CreateNarrativeGroupOptions = {},
): {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
} {
  const { eventGroupId } = options;

  const eventNodes = currentNodes.filter((node): node is EventNodeType => {
    if (eventGroupId) {
      return node.type === "event" && node.parentId === eventGroupId;
    }
    return node.type === "event";
  });

  if (eventNodes.length === 0) {
    return { nodes: [], edges: [] };
  }

  const sortedEvents = [...eventNodes].sort(
    (nodeA, nodeB) => nodeA.position.x - nodeB.position.x,
  );

  const narrativeGroups = currentNodes.filter(
    (node): node is NarrationGroupNodeType => node.type === "narrativeGroup",
  );
  const highestNarrativeGroupId = narrativeGroups.reduce(
    (accumulator, group) => {
      const groupId = group.data?.narrativeGroupId ?? 0;
      return groupId > accumulator ? groupId : accumulator;
    },
    0,
  );
  const nextNarrativeGroupId = highestNarrativeGroupId + 1;

  const eventGroup = eventGroupId
    ? currentNodes.find(
        (node): node is EventGroupNodeType =>
          node.id === eventGroupId && node.type === "eventGroup",
      )
    : currentNodes.find(
        (node): node is EventGroupNodeType => node.type === "eventGroup",
      );

  const DEFAULT_GROUP_STYLE = {
    width: 1200,
    height: 420,
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

  const clusterSuffix = randomSuffix();
  const newGroupId = `narrative-group-${clusterSuffix}`;
  const narrativeRowY =
    narrativeGroups.length > 0
      ? currentNodes.find(
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
      narrativeGroupId: nextNarrativeGroupId,
    },
    style: {
      ...DEFAULT_GROUP_STYLE,
      ...(baselineGroupStyle ?? {}),
      width: clusterWidth,
      height: baselineHeight,
    },
  };

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

  return {
    nodes: [newGroupNode, ...newNarrativeNodes],
    edges: sequentialEdges,
  };
}
