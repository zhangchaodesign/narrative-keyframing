import type { TimelineItem } from "@/lib/types/timeline";
import type {
  NarrativeNodeType,
  PerspectiveNodeType,
  WorkflowEdge,
  WorkflowNode,
  EventNodeType,
  GroupNodeData,
  ThirdPersonGroupNodeType,
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

  const narrativeGroups = nodes.filter(
    (node) => node.type === "narrativeGroup",
  );
  const highestNarrativeGroupId = narrativeGroups.reduce(
    (accumulator, node) => {
      const groupId = node.data?.narrativeGroupId ?? 0;
      return groupId > accumulator ? groupId : accumulator;
    },
    0,
  );
  const nextNarrativeGroupId = highestNarrativeGroupId + 1;

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

  const clonedGroupData = cloneData(groupNode.data) as GroupNodeData;
  const nextGroupData: GroupNodeData = {
    ...clonedGroupData,
    isActiveInEditor: false,
    narrativeGroupId: nextNarrativeGroupId,
  };

  const newGroupNode: WorkflowNode = {
    ...groupNode,
    id: newGroupId,
    position: {
      x: groupNode.position.x + CLONE_OFFSET,
      y: groupNode.position.y + CLONE_OFFSET,
    },
    data: nextGroupData,
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

  return {
    newNodes,
    newEdges: [...clonedInternalEdges],
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

  const narrativeGroupNode = nodes.find(
    (node): node is ThirdPersonGroupNodeType =>
      node.id === groupId && node.type === "narrativeGroup",
  );
  const connectedEventGroupId =
    narrativeGroupNode?.data?.connectedEventGroup?.id;

  const eventNodes = nodes.filter(
    (node): node is EventNodeType => node.type === "event",
  );
  const eventNodeMap = new Map(
    eventNodes.map((eventNode) => [eventNode.id, eventNode]),
  );
  const eventNodesByGroup = new Map<string, EventNodeType[]>();
  eventNodes.forEach((eventNode) => {
    if (!eventNode.parentId) {
      return;
    }
    const existing = eventNodesByGroup.get(eventNode.parentId) ?? [];
    existing.push(eventNode);
    eventNodesByGroup.set(eventNode.parentId, existing);
  });
  eventNodesByGroup.forEach((events) => {
    events.sort(
      (a, b) =>
        (a.position.x ?? 0) - (b.position.x ?? 0) ||
        (a.position.y ?? 0) - (b.position.y ?? 0),
    );
  });

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
  const perspectiveNodesByGroup = new Map<string, PerspectiveNodeType[]>();
  connectedPerspectiveGroupIds.forEach((perspectiveGroupId) => {
    const groupNodes = linkedPerspectiveNodes
      .filter((node) => node.parentId === perspectiveGroupId)
      .sort(
        (a, b) =>
          (a.position.x ?? 0) - (b.position.x ?? 0) ||
          (a.position.y ?? 0) - (b.position.y ?? 0),
      );
    perspectiveNodesByGroup.set(perspectiveGroupId, groupNodes);
  });

  const orderedNarratives = [...narrativeNodes].sort(
    (a, b) =>
      (a.position.x ?? 0) - (b.position.x ?? 0) ||
      (a.position.y ?? 0) - (b.position.y ?? 0),
  );
  const narrativeIndexMap = new Map<string, number>();
  orderedNarratives.forEach((node, index) => {
    narrativeIndexMap.set(node.id, index);
  });

  const groupedEvents = connectedEventGroupId
    ? eventNodesByGroup.get(connectedEventGroupId)
    : undefined;

  return narrativeNodes.map((narrativeNode) => {
    const narrativeIndex = narrativeIndexMap.get(narrativeNode.id) ?? 0;
    let eventNodeForNarrative: EventNodeType | undefined;
    if (groupedEvents && groupedEvents.length > 0) {
      eventNodeForNarrative =
        groupedEvents[Math.min(narrativeIndex, groupedEvents.length - 1)];
    }

    const fallbackEventId = narrativeNode.data?.eventId;
    if (!eventNodeForNarrative && fallbackEventId) {
      eventNodeForNarrative = eventNodeMap.get(fallbackEventId);
    }

    const resolvedEventId = eventNodeForNarrative?.id ?? fallbackEventId;
    const eventDescription = eventNodeForNarrative?.data?.description ?? "";
    const eventTimeline = eventNodeForNarrative?.data?.timeline ?? "";

    let perspectiveNodesForEvent: PerspectiveNodeType[] = [];
    connectedPerspectiveGroupIds.forEach((groupId) => {
      const groupNodes = perspectiveNodesByGroup.get(groupId);
      if (!groupNodes || groupNodes.length === 0) {
        return;
      }
      const targetIndex = Math.min(narrativeIndex, groupNodes.length - 1);
      const candidate = groupNodes[targetIndex];
      if (candidate) {
        perspectiveNodesForEvent.push(candidate);
      }
    });

    if (perspectiveNodesForEvent.length === 0 && resolvedEventId) {
      perspectiveNodesForEvent = linkedPerspectiveNodes.filter(
        (pNode) => pNode.data?.eventId === resolvedEventId,
      );
    }

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
      eventId: resolvedEventId,
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
