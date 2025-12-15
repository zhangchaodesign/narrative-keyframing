import type { TimelineItem } from "@/lib/types/timeline";
import type {
  NarrativeNodeType,
  PerspectiveNodeType,
  WorkflowEdge,
  WorkflowNode,
  EventNodeType,
} from "@/lib/types/workflow";
import { cloneData, generateUniqueUuidId } from "@/lib/utiils/workflowUtils";

const CLONE_OFFSET = 80;

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

type DuplicateNarrativeGroupResult = {
  newNodes: WorkflowNode[];
  newEdges: WorkflowEdge[];
};

export const duplicateNarrativeGroupCluster = ({
  groupId,
  nodes,
  edges,
}: {
  groupId: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}): DuplicateNarrativeGroupResult | null => {
  const groupNode = nodes.find(
    (node) => node.id === groupId && node.type === "narrativeGroup",
  );
  if (!groupNode) {
    return null;
  }

  const childNodes = nodes.filter((node) => node.parentId === groupId);
  const clusterNodeIds = new Set<string>([
    groupId,
    ...childNodes.map((n) => n.id),
  ]);

  const existingNodeIds = new Set(nodes.map((node) => node.id));
  const existingEdgeIds = new Set(edges.map((edge) => edge.id));
  const idMap = new Map<string, string>();

  const newGroupId = generateUniqueUuidId("narration-group", existingNodeIds);
  existingNodeIds.add(newGroupId);
  idMap.set(groupId, newGroupId);

  const newGroupNode: WorkflowNode = {
    ...groupNode,
    id: newGroupId,
    position: {
      x: groupNode.position.x + CLONE_OFFSET,
      y: groupNode.position.y + CLONE_OFFSET,
    },
    data: {
      ...cloneData(groupNode.data),
      isActiveInEditor: false,
    },
    selected: false,
    dragging: false,
  } as WorkflowNode;

  const newChildNodes: WorkflowNode[] = childNodes.map((original) => {
    const prefix =
      original.type === "narrative" ? "narrative" : original.type ?? "node";
    const newId = generateUniqueUuidId(prefix, existingNodeIds);
    existingNodeIds.add(newId);
    idMap.set(original.id, newId);

    return {
      ...original,
      id: newId,
      parentId: newGroupId,
      position: {
        x: original.position.x,
        y: original.position.y,
      },
      data: cloneData(original.data),
      selected: false,
      dragging: false,
    } as WorkflowNode;
  });

  const newNodes = [newGroupNode, ...newChildNodes];

  const internalEdges = edges.filter(
    (edge) =>
      clusterNodeIds.has(edge.source) && clusterNodeIds.has(edge.target),
  );

  const clonedInternalEdges = internalEdges.map((edge) => {
    const newId = generateUniqueUuidId("edge", existingEdgeIds);
    existingEdgeIds.add(newId);

    return {
      ...edge,
      id: newId,
      source: idMap.get(edge.source) ?? edge.source,
      target: idMap.get(edge.target) ?? edge.target,
      data: cloneData(edge.data),
      selected: false,
    };
  });

  const bridgingEdges = edges.filter(
    (edge) => edge.target === groupId && edge.targetHandle === "group-bridge",
  );

  const duplicatedBridges = bridgingEdges.map((edge) => {
    const newId = generateUniqueUuidId("edge", existingEdgeIds);
    existingEdgeIds.add(newId);
    return {
      ...edge,
      id: newId,
      target: newGroupId,
      data: cloneData(edge.data),
      selected: false,
    };
  });

  return {
    newNodes,
    newEdges: [...clonedInternalEdges, ...duplicatedBridges],
  };
};

export type NarrativeEventData = {
  narrativeNodeId: string;
  eventId?: string;
  eventDescription: string;
  eventTimeline: string;
  snippets: Array<{
    perspectiveNodeId: string;
    text: string;
    characterId: string;
    characterName: string;
    attributes: string[];
  }>;
  perspectives: Array<{
    narrator: string;
    reflection: string;
  }>;
  narration?: string;
  snippetUsages?: Array<{
    originalSnippet: string;
    verbatimInNarrative: string;
  }>;
};

export const buildNarrativeEventsData = (
  groupId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): NarrativeEventData[] => {
  const narrativeNodes = nodes.filter(
    (node) => node.type === "narrative" && node.parentId === groupId,
  ) as NarrativeNodeType[];
  if (narrativeNodes.length === 0) {
    return [];
  }

  const connectedPerspectiveGroupIds = edges
    .filter((edge) => edge.target === groupId)
    .map((edge) => edge.source)
    .filter((sourceId) => {
      const sourceNode = nodes.find((n) => n.id === sourceId);
      return sourceNode?.type === "perspectiveGroup";
    });

  const linkedPerspectiveNodes = nodes.filter(
    (node) =>
      node.type === "perspective" &&
      node.parentId &&
      connectedPerspectiveGroupIds.includes(node.parentId),
  ) as PerspectiveNodeType[];

  return narrativeNodes.map((narrativeNode) => {
    const eventId = narrativeNode.data?.eventId;
    let eventDescription = "";
    let eventTimeline = "";

    if (eventId) {
      const eventNode = nodes.find(
        (node): node is EventNodeType =>
          node.id === eventId && node.type === "event",
      );
      if (eventNode) {
        eventDescription = eventNode.data?.description ?? "";
        eventTimeline = eventNode.data?.timeline ?? "";
      }
    }

    const perspectiveNodesForEvent = linkedPerspectiveNodes.filter(
      (pNode) => pNode.data?.eventId === eventId,
    );

    const snippetsForEvent: NarrativeEventData["snippets"] = [];
    perspectiveNodesForEvent.forEach((pNode) => {
      const evidence = pNode.data?.analysisEvidence || [];
      evidence.forEach((evidenceItem) => {
        evidenceItem.items.forEach((item) => {
          snippetsForEvent.push({
            perspectiveNodeId: pNode.id,
            text: item.text,
            characterId: evidenceItem.characterId,
            characterName: evidenceItem.characterName,
            attributes: item.attributes,
          });
        });
      });
    });

    const perspectivesForEvent = perspectiveNodesForEvent.map((pNode) => ({
      narrator: pNode.data?.narrator || "Unknown narrator",
      reflection: pNode.data?.reflection || "",
    }));

    return {
      narrativeNodeId: narrativeNode.id,
      eventId,
      eventDescription,
      eventTimeline,
      snippets: snippetsForEvent,
      perspectives: perspectivesForEvent,
      narration: narrativeNode.data?.narration,
      snippetUsages: narrativeNode.data?.snippetUsages,
    };
  });
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
