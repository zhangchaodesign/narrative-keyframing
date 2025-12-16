import type { TimelineItem } from "@/lib/types/timeline";
import type { NarrativeNodeType, WorkflowNode } from "@/lib/types/workflow";

export const findNarrativeGroupIdFromTrackItems = (
  items: TimelineItem[],
  nodes: WorkflowNode[],
): string | null => {
  for (const item of items) {
    const narrativeNode = nodes.find(
      (node): node is NarrativeNodeType =>
        node.id === item.nodeId && node.type === "narrative",
    );
    if (narrativeNode?.parentId) {
      return narrativeNode.parentId;
    }
  }
  return null;
};

export const combineNarrativeTextsInGroup = (
  groupId: string,
  nodes: WorkflowNode[],
): string => {
  const narrativeNodes = nodes.filter(
    (node): node is NarrativeNodeType =>
      node.type === "narrative" && node.parentId === groupId,
  );
  if (narrativeNodes.length === 0) {
    return "";
  }

  const sortedNarratives = narrativeNodes.sort((a, b) => {
    if (Math.abs(a.position.y - b.position.y) > 50) {
      return a.position.y - b.position.y;
    }
    return a.position.x - b.position.x;
  });

  return sortedNarratives
    .map((node) => node.data?.narration || "")
    .filter((text) => text.trim().length > 0)
    .join("\n\n");
};
