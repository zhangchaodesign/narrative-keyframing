import type {
  WorkflowNode,
  EventNodeData,
  PerspectiveNodeData,
  CharacterNodeData,
  NarrativeNodeData,
} from "@/lib/types/workflow";
import type {
  TimelineData,
  TimelineItem,
  TimelineTrack,
} from "@/lib/types/timeline";

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

const buildStoryTrack = (
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
          eventData?.description || eventData?.timeline || `Event ${index + 1}`,
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
          label: "Story Outline",
          type: "story",
          items: storyItems,
        }
      : null;

  return { track, eventPositionMap };
};

const buildPerspectiveTracks = (
  nodes: WorkflowNode[],
  eventPositionMap: Map<string, number>,
) => {
  const perspectiveGroups = nodes.filter(
    (node) => node.type === "perspectiveGroup",
  );
  const tracks: TimelineTrack[] = [];

  perspectiveGroups.forEach((group) => {
    const characterName = (group.data as { characterName?: string } | undefined)
      ?.characterName;
    const resolvedCharacterName = characterName || "Unknown";

    const perspectiveNodes = nodes
      .filter(
        (node) => node.type === "perspective" && node.parentId === group.id,
      )
      .sort(sortByXPosition);

    const perspectiveItems: TimelineItem[] = perspectiveNodes.map((node) => {
      const perspectiveData = node.data as PerspectiveNodeData | undefined;
      const eventId = perspectiveData?.eventId;
      const position =
        (eventId ? eventPositionMap.get(eventId) : undefined) ?? 0;

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
    });

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

const buildNarrativeTrack = (
  nodes: WorkflowNode[],
  eventPositionMap: Map<string, number>,
) => {
  const narrativeGroups = nodes.filter(
    (node) => node.type === "narrativeGroup",
  );
  const narrativeItems: TimelineItem[] = [];

  narrativeGroups.forEach((group) => {
    const narratives = nodes
      .filter((node) => node.type === "narrative" && node.parentId === group.id)
      .sort(sortByXPosition);

    narratives.forEach((node) => {
      const narrativeData = node.data as NarrativeNodeData | undefined;
      const eventId = narrativeData?.eventId;
      const position =
        (eventId ? eventPositionMap.get(eventId) : undefined) ?? 0;

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

export const buildTimelineData = (nodes: WorkflowNode[]): TimelineData => {
  const { track: storyTrack, eventPositionMap } = buildStoryTrack(nodes);
  const characterTracks = buildPerspectiveTracks(nodes, eventPositionMap);
  const narrativeTrack = buildNarrativeTrack(nodes, eventPositionMap);

  const maxPosition =
    storyTrack && storyTrack.items.length > 0
      ? Math.max(...storyTrack.items.map((item) => item.position))
      : 5;

  return {
    storyTrack,
    characterTracks,
    narrativeTrack,
    maxPosition,
  };
};
