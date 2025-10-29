import type { EventNodeType, WorkflowNode } from "@/lib/types/workflow";

/**
 * Parse timeline string to extract numeric index
 * @param timeline Timeline string (e.g., "Event 1", "1", etc.)
 * @returns Numeric index or null if not found
 */
export const parseEventTimelineIndex = (timeline?: string | null): number | null => {
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
