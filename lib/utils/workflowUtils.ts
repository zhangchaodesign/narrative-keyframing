import type { EventNodeType } from "@/lib/types/workflow";
import { parseEventTimelineIndex } from "@/lib/workflow/perspective";

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
