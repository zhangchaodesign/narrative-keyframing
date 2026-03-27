import type {
  WorkflowNode,
  WorkflowEdge,
  EventNodeData,
  PerspectiveNodeData,
  CharacterNodeData,
  NarrativeNodeData,
  GroupNodeData,
} from "@/lib/types/workflow";
import type {
  TimelineData,
  TimelineItem,
  TimelineTrack,
  StoryOutlineCluster,
  NarrativeCluster,
} from "@/lib/types/timeline";
import { getNodeByIndex } from "@/lib/utiils/workflowUtils";

const sortByXPosition = (
  a: Pick<WorkflowNode, "position" | "id">,
  b: Pick<WorkflowNode, "position" | "id">,
) => {
  const ax = a.position?.x ?? 0;
  const bx = b.position?.x ?? 0;
  if (ax === bx) {
    return a.id.localeCompare(b.id);
  }
  return ax - bx;
};

const buildEventTrack = (
  nodes: WorkflowNode[],
): { track: TimelineTrack | null; eventPositionMap: Map<string, number> } => {
  const eventGroups = nodes.filter((node) => node.type === "eventGroup");
  const storyItems: TimelineItem[] = [];
  const eventPositionMap = new Map<string, number>();

  eventGroups.forEach((group) => {
    const groupEvents = nodes
      .filter((node) => node.type === "event" && node.parentId === group.id)
      .sort(sortByXPosition);

    groupEvents.forEach((event, index) => {
      const position = storyItems.length;
      const eventData = event.data as EventNodeData | undefined;

      storyItems.push({
        id: `story-${event.id}`,
        content:
          eventData?.description || eventData?.timeline || `Plot ${index + 1}`,
        position,
        nodeId: event.id,
        nodeType: "event",
      });

      eventPositionMap.set(event.id, position);
    });
  });

  const track: TimelineTrack | null =
    storyItems.length > 0
      ? {
          id: "story-track",
          label: "Outline",
          type: "story",
          items: storyItems,
        }
      : null;

  return { track, eventPositionMap };
};

const buildPerspectiveTracks = (nodes: WorkflowNode[]) => {
  const perspectiveGroups = nodes.filter(
    (node) => node.type === "perspectiveGroup",
  );
  const tracks: TimelineTrack[] = [];

  perspectiveGroups.forEach((group) => {
    const characterName = (group.data as { characterName?: string } | undefined)
      ?.characterName;
    const resolvedCharacterName = characterName ?? "Unknown";

    const perspectiveNodes = nodes
      .filter(
        (node) => node.type === "perspective" && node.parentId === group.id,
      )
      .sort(sortByXPosition);

    const perspectiveItems: TimelineItem[] = perspectiveNodes.map(
      (node, index) => {
        const perspectiveData = node.data as PerspectiveNodeData | undefined;
        // Use index-based position matching
        const position = index;

        return {
          id: `perspective-${node.id}`,
          content:
            perspectiveData?.reflection ||
            perspectiveData?.snippets?.[0] ||
            "Perspective",
          position,
          nodeId: node.id,
          nodeType: "perspective",
        };
      },
    );

    const perspectivePositionMap = new Map(
      perspectiveItems.map((item) => [item.nodeId, item.position]),
    );

    const characterNodes = nodes
      .filter((node) => node.type === "character" && node.parentId === group.id)
      .sort(sortByXPosition);

    const characterItems: TimelineItem[] = characterNodes.map((node) => {
      const characterData = node.data as CharacterNodeData | undefined;
      const perspectiveId = characterData?.perspectiveId;
      const position =
        (perspectiveId
          ? perspectivePositionMap.get(perspectiveId)
          : undefined) ?? 0;

      const traits = characterData?.traits;
      const allTraits = traits
        ? [
            ...(traits.physiology || []),
            ...(traits.psychology || []),
            ...(traits.sociology || []),
          ]
            .filter(Boolean)
            .join(", ")
        : "";

      return {
        id: `character-${node.id}`,
        content: `${characterData?.name || "Character"}${
          allTraits ? `: ${allTraits}` : ""
        }`,
        position,
        nodeId: node.id,
        nodeType: "character",
      };
    });

    if (perspectiveItems.length > 0) {
      tracks.push({
        id: `${group.id}-perspective`,
        label: `${resolvedCharacterName} - Perspective`,
        type: "perspective",
        items: perspectiveItems,
        characterName: resolvedCharacterName,
        parentTrackId: group.id,
      });
    }

    if (characterItems.length > 0) {
      tracks.push({
        id: `${group.id}-character`,
        label: `${resolvedCharacterName} - Character`,
        type: "character",
        items: characterItems,
        characterName: resolvedCharacterName,
        parentTrackId: group.id,
      });
    }
  });

  return tracks;
};

const buildNarrativeTrack = (nodes: WorkflowNode[]) => {
  const narrativeGroups = nodes.filter(
    (node) => node.type === "narrativeGroup",
  );
  const narrativeItems: TimelineItem[] = [];

  narrativeGroups.forEach((group) => {
    const narratives = nodes
      .filter((node) => node.type === "narrative" && node.parentId === group.id)
      .sort(sortByXPosition);

    narratives.forEach((node, index) => {
      const narrativeData = node.data as NarrativeNodeData | undefined;
      // Use index-based position matching
      const position = index;

      narrativeItems.push({
        id: `narrative-${node.id}`,
        content:
          narrativeData?.content || narrativeData?.narration || "Narrative",
        position,
        nodeId: node.id,
        nodeType: "narrative",
      });
    });
  });

  const track: TimelineTrack | null =
    narrativeItems.length > 0
      ? {
          id: "narrative-track",
          label: "Narrative Cluster",
          type: "narrative",
          items: narrativeItems,
        }
      : null;

  return track;
};

const buildStoryOutlineClusters = (
  nodes: WorkflowNode[],
): {
  clusters: StoryOutlineCluster[];
  eventPositionMapByGroup: Map<string, Map<string, number>>;
} => {
  const eventGroups = nodes.filter((node) => node.type === "eventGroup");
  const clusters: StoryOutlineCluster[] = [];
  const eventPositionMapByGroup = new Map<string, Map<string, number>>();

  eventGroups.forEach((group) => {
    const groupData = group.data as GroupNodeData | undefined;
    const groupEvents = nodes
      .filter((node) => node.type === "event" && node.parentId === group.id)
      .sort(sortByXPosition);

    const storyItems: TimelineItem[] = [];
    const eventPositionMap = new Map<string, number>();

    groupEvents.forEach((event, index) => {
      const position = storyItems.length;
      const eventData = event.data as EventNodeData | undefined;

      storyItems.push({
        id: `story-${event.id}`,
        content:
          eventData?.description || eventData?.timeline || `Plot ${index + 1}`,
        position,
        nodeId: event.id,
        nodeType: "event",
      });

      eventPositionMap.set(event.id, position);
    });

    if (storyItems.length > 0) {
      clusters.push({
        id: group.id,
        label: groupData?.label || "Outline",
        track: {
          id: `story-track-${group.id}`,
          label: groupData?.label || "Outline",
          type: "story",
          items: storyItems,
        },
        eventGroupId: group.id,
        eventGroupNumber: groupData?.eventGroupId,
      });
      eventPositionMapByGroup.set(group.id, eventPositionMap);
    }
  });

  return { clusters, eventPositionMapByGroup };
};

const sortNodesByXPosition = <T extends WorkflowNode>(nodes: T[]) =>
  [...nodes].sort(sortByXPosition);

const findLinkedEventGroupIdFromPerspectives = (
  narrativeGroupId: string,
  nodesById: Map<string, WorkflowNode>,
  edges: WorkflowEdge[],
) => {
  const connectedPerspectiveNodes = edges
    .filter(
      (edge) =>
        edge.target === narrativeGroupId &&
        edge.targetHandle === "group-bridge",
    )
    .map((edge) => nodesById.get(edge.source))
    .filter((node): node is WorkflowNode => node?.type === "perspectiveGroup");

  const orderedPerspectiveNodes = sortNodesByXPosition(
    connectedPerspectiveNodes,
  );

  for (const perspectiveNode of orderedPerspectiveNodes) {
    const connectedEventGroup = edges
      .filter(
        (edge) =>
          edge.target === perspectiveNode.id &&
          edge.targetHandle === "group-bridge",
      )
      .map((edge) => nodesById.get(edge.source))
      .filter((node): node is WorkflowNode => node?.type === "eventGroup")
      .sort(sortByXPosition)[0];

    if (connectedEventGroup) {
      return connectedEventGroup.id;
    }
  }

  return undefined;
};

const buildNarrativeClusters = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): NarrativeCluster[] => {
  const narrativeGroups = nodes.filter(
    (node) => node.type === "narrativeGroup",
  );
  const clusters: NarrativeCluster[] = [];
  const nodesById = new Map(nodes.map((node) => [node.id, node]));

  narrativeGroups.forEach((group) => {
    const groupData = group.data as GroupNodeData | undefined;
    const narratives = nodes
      .filter((node) => node.type === "narrative" && node.parentId === group.id)
      .sort(sortByXPosition);

    const narrativeItems: TimelineItem[] = [];
    const linkedEventGroupId = findLinkedEventGroupIdFromPerspectives(
      group.id,
      nodesById,
      edges,
    );

    narratives.forEach((node, index) => {
      const narrativeData = node.data as NarrativeNodeData | undefined;
      // Use index-based position matching
      const position = index;

      narrativeItems.push({
        id: `narrative-${node.id}`,
        content:
          narrativeData?.content || narrativeData?.narration || "Narrative",
        position,
        nodeId: node.id,
        nodeType: "narrative",
      });
    });

    if (narrativeItems.length > 0) {
      clusters.push({
        id: group.id,
        label: groupData?.label || "Narrative Cluster",
        track: {
          id: `narrative-track-${group.id}`,
          label: groupData?.label || "Narrative Cluster",
          type: "narrative",
          items: narrativeItems,
        },
        narrativeGroupId: group.id,
        narrativeGroupNumber: groupData?.narrativeGroupId,
        linkedEventGroupId,
      });
    }
  });

  return clusters;
};

export const buildTimelineData = (
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): TimelineData => {
  const { track: storyTrack } = buildEventTrack(nodes);
  const characterTracks = buildPerspectiveTracks(nodes);
  const narrativeTrack = buildNarrativeTrack(nodes);

  // Build cluster data
  const { clusters: storyOutlineClusters } = buildStoryOutlineClusters(nodes);
  const narrativeClusters = buildNarrativeClusters(nodes, edges);

  const maxPosition =
    storyTrack && storyTrack.items.length > 0
      ? Math.max(...storyTrack.items.map((item) => item.position))
      : 5;

  return {
    storyTrack,
    characterTracks,
    narrativeTrack,
    maxPosition,
    storyOutlineClusters,
    narrativeClusters,
  };
};
