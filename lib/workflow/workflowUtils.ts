import type {
  EventNodeType,
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
