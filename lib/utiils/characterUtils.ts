import type {
  CharacterNodeType,
  CharacterTraits,
  EventNodeType,
  PerspectiveGroupNodeType,
  PerspectiveEvidenceItem,
  PerspectiveNodeType,
  WorkflowEdge,
  WorkflowNode,
} from "@/lib/types/workflow";
import { getNodeByIndex } from "@/lib/utiils/workflowUtils";

export type TraitCategory = keyof CharacterTraits;

export type TraitCategoryDefinition = {
  key: TraitCategory;
  label: string;
  titleClass: string;
  chipClass: string;
  emptyClass: string;
  selectedClass: string;
};

export const CHARACTER_TRAIT_CATEGORIES: TraitCategoryDefinition[] = [
  {
    key: "physiology",
    label: "Physiology",
    titleClass: "text-gray-700",
    chipClass: "border-transparent bg-gray-100 text-gray-900",
    emptyClass: "border-transparent text-gray-700",
    selectedClass: "border-transparent bg-blue-100 text-gray-900",
  },
  {
    key: "psychology",
    label: "Psychology",
    titleClass: "text-gray-700",
    chipClass: "border-transparent bg-gray-100 text-gray-900",
    emptyClass: "border-transparent text-gray-700",
    selectedClass: "border-transparent bg-blue-100 text-gray-900",
  },
  {
    key: "sociology",
    label: "Sociology",
    titleClass: "text-gray-700",
    chipClass: "border-transparent bg-gray-100 text-gray-900",
    emptyClass: "border-transparent text-gray-700",
    selectedClass: "border-transparent bg-blue-100 text-gray-900",
  },
];

export const normalizeCharacterTraits = (
  traits?: CharacterTraits | null,
): CharacterTraits => ({
  physiology: [...(traits?.physiology ?? [])],
  psychology: [...(traits?.psychology ?? [])],
  sociology: [...(traits?.sociology ?? [])],
});

export type WorkflowNodesSetter = (
  updater: (nodes: WorkflowNode[]) => WorkflowNode[],
) => void;

export type StoryOutlineEvent = {
  label: string;
  description: string;
};

export type CharacterBrainstormContext = {
  baselineStoryText: string;
  baselineActText: string;
  characterName: string;
};

const formatStoryOutlineText = (events: StoryOutlineEvent[]) =>
  events.map((event, index) => `${event.description}`).join("\n");

const formatActText = (event: StoryOutlineEvent) => `${event.description}`;

type NearbySnapshot = {
  name: string;
  traits: CharacterTraits;
  position: "before" | "after";
};

export type CharacterInterpolationContext = {
  perspectiveText: string;
  fullPerspectiveText: string;
  narratorName: string;
  nearbySnapshots: NearbySnapshot[];
  eventDescription?: string;
};

export const buildCharacterInterpolationContext = ({
  nodes,
  perspectiveNode,
  fallbackNarratorName = "Character",
}: {
  nodes: WorkflowNode[];
  perspectiveNode?: PerspectiveNodeType;
  fallbackNarratorName?: string;
}): CharacterInterpolationContext | null => {
  if (!perspectiveNode) {
    return null;
  }

  const perspectiveText = perspectiveNode.data?.reflection?.trim();
  if (!perspectiveText) {
    return null;
  }

  const narratorName =
    perspectiveNode.data?.narrator?.trim() || fallbackNarratorName;
  const groupId = perspectiveNode.parentId;

  const fullPerspectiveText = (() => {
    if (!groupId) {
      return perspectiveText;
    }

    const groupReflections = nodes
      .filter(
        (node): node is PerspectiveNodeType =>
          node.type === "perspective" && node.parentId === groupId,
      )
      .sort(
        (a, b) => a.position.x - b.position.x || a.position.y - b.position.y,
      )
      .map((node) => (node.data?.reflection ?? "").trim())
      .filter((text) => text.length > 0)
      .join("\n\n");

    return groupReflections || perspectiveText;
  })();

  const nearbySnapshots: NearbySnapshot[] = (() => {
    if (!groupId) {
      return [];
    }

    const perspectivesInGroup = nodes.filter(
      (node): node is PerspectiveNodeType =>
        node.type === "perspective" && node.parentId === groupId,
    );

    const sortedPerspectives = [...perspectivesInGroup].sort(
      (a, b) => a.position.x - b.position.x || a.position.y - b.position.y,
    );

    const currentIndex = sortedPerspectives.findIndex(
      (node) => node.id === perspectiveNode.id,
    );

    const snapshots: NearbySnapshot[] = [];

    if (currentIndex > 0) {
      const prevPerspective = sortedPerspectives[currentIndex - 1];
      const prevCharacter = nodes.find(
        (node): node is CharacterNodeType =>
          node.type === "character" &&
          node.data?.perspectiveId === prevPerspective.id,
      );

      if (prevCharacter?.data) {
        snapshots.push({
          name: prevCharacter.data.name,
          traits: prevCharacter.data.traits,
          position: "before",
        });
      }
    }

    if (currentIndex >= 0 && currentIndex < sortedPerspectives.length - 1) {
      const nextPerspective = sortedPerspectives[currentIndex + 1];
      const nextCharacter = nodes.find(
        (node): node is CharacterNodeType =>
          node.type === "character" &&
          node.data?.perspectiveId === nextPerspective.id,
      );

      if (nextCharacter?.data) {
        snapshots.push({
          name: nextCharacter.data.name,
          traits: nextCharacter.data.traits,
          position: "after",
        });
      }
    }

    return snapshots;
  })();

  // Find the matching event node by index
  const perspectiveGroupId = perspectiveNode.parentId;
  let eventNode: EventNodeType | undefined;

  if (perspectiveGroupId) {
    // Get all perspectives in the same group, sorted by position
    const siblingPerspectives = nodes
      .filter(
        (node): node is PerspectiveNodeType =>
          node.type === "perspective" && node.parentId === perspectiveGroupId,
      )
      .sort((a, b) => (a.position.x ?? 0) - (b.position.x ?? 0));

    // Find index of current perspective
    const perspectiveIndex = siblingPerspectives.findIndex(
      (node) => node.id === perspectiveNode.id,
    );

    if (perspectiveIndex >= 0) {
      // Get all event nodes sorted by position
      const eventNodes = nodes
        .filter((node): node is EventNodeType => node.type === "event")
        .sort((a, b) => (a.position.x ?? 0) - (b.position.x ?? 0));

      // Get event at the same index
      eventNode = getNodeByIndex(eventNodes, perspectiveIndex);
    }
  }

  return {
    perspectiveText,
    fullPerspectiveText,
    narratorName,
    nearbySnapshots,
    eventDescription: eventNode?.data?.description,
  };
};

type TraitEvidencePayload = {
  traitCategory: keyof CharacterTraits;
  trait: string;
  evidenceText: string;
};

type InterpolateCharacterResponse = {
  characterSnapshot?: {
    name: string;
    traits: CharacterTraits;
  };
  traitEvidence?: TraitEvidencePayload[];
};

export type InterpolateCharacterResult = {
  characterName: string;
  characterTraits: CharacterTraits;
  evidenceItems: Array<{
    text: string;
    category: keyof CharacterTraits;
    attributes: string[];
  }>;
};

export type InterpolateCharacterSnapshotParams = {
  nodes: WorkflowNode[];
  perspectiveNode: PerspectiveNodeType;
  fallbackNarratorName?: string;
};

const sortByNodePosition = (
  a: Pick<WorkflowNode, "position" | "id">,
  b: Pick<WorkflowNode, "position" | "id">,
) => {
  const ax = a.position?.x ?? 0;
  const bx = b.position?.x ?? 0;
  if (ax === bx) {
    const ay = a.position?.y ?? 0;
    const by = b.position?.y ?? 0;
    if (ay === by) {
      return a.id.localeCompare(b.id);
    }
    return ay - by;
  }
  return ax - bx;
};

const buildStoryOutlineEvent = (
  eventNode: EventNodeType,
): StoryOutlineEvent => {
  const timeline = eventNode.data?.timeline?.trim();
  const description = eventNode.data?.description?.trim();
  const resolvedDescription =
    description && description.length > 0
      ? description
      : timeline && timeline.length > 0
        ? timeline
        : "No description provided.";

  const label =
    timeline && timeline.length > 0
      ? timeline
      : description && description.length > 0
        ? description
        : eventNode.id;

  return {
    label,
    description: resolvedDescription,
  };
};

const resolveConnectedEventGroupId = ({
  nodes,
  edges,
  perspectiveGroupId,
}: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  perspectiveGroupId: string;
}): string | undefined => {
  const perspectiveGroup = nodes.find(
    (node): node is PerspectiveGroupNodeType =>
      node.id === perspectiveGroupId && node.type === "perspectiveGroup",
  );

  const dataConnected = perspectiveGroup?.data?.connectedEventGroup?.id;
  if (dataConnected) {
    return dataConnected;
  }

  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));

  for (const edge of edges) {
    if (
      edge.sourceHandle !== "group-bridge" ||
      edge.targetHandle !== "group-bridge"
    ) {
      continue;
    }
    const sourceNode = nodeLookup.get(edge.source);
    const targetNode = nodeLookup.get(edge.target);

    if (
      sourceNode?.type === "perspectiveGroup" &&
      targetNode?.type === "eventGroup" &&
      sourceNode.id === perspectiveGroupId
    ) {
      return targetNode.id;
    }

    if (
      targetNode?.type === "perspectiveGroup" &&
      sourceNode?.type === "eventGroup" &&
      targetNode.id === perspectiveGroupId
    ) {
      return sourceNode.id;
    }
  }

  return undefined;
};

export const buildCharacterBrainstormContext = ({
  nodes,
  edges,
  characterNodeId,
}: {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  characterNodeId: string;
}): CharacterBrainstormContext | null => {
  const characterNode = nodes.find(
    (node): node is CharacterNodeType =>
      node.id === characterNodeId && node.type === "character",
  );
  if (!characterNode) {
    return null;
  }

  const perspectiveId = characterNode.data?.perspectiveId?.trim();
  if (!perspectiveId) {
    return null;
  }

  const perspectiveNode = nodes.find(
    (node): node is PerspectiveNodeType =>
      node.id === perspectiveId && node.type === "perspective",
  );
  if (!perspectiveNode) {
    return null;
  }

  const perspectiveGroupId = perspectiveNode.parentId;
  if (!perspectiveGroupId) {
    return null;
  }

  const connectedEventGroupId = resolveConnectedEventGroupId({
    nodes,
    edges,
    perspectiveGroupId,
  });

  if (!connectedEventGroupId) {
    return null;
  }

  const eventNodesInGroup = nodes
    .filter(
      (node): node is EventNodeType =>
        node.type === "event" && node.parentId === connectedEventGroupId,
    )
    .sort(sortByNodePosition);

  if (eventNodesInGroup.length === 0) {
    return null;
  }

  const storyOutline = eventNodesInGroup.map(buildStoryOutlineEvent);

  const siblingPerspectives = nodes
    .filter(
      (node): node is PerspectiveNodeType =>
        node.type === "perspective" && node.parentId === perspectiveGroupId,
    )
    .sort(sortByNodePosition);

  const perspectiveIndex = siblingPerspectives.findIndex(
    (node) => node.id === perspectiveNode.id,
  );

  if (perspectiveIndex < 0) {
    return null;
  }

  const currentEventNode =
    eventNodesInGroup[Math.min(perspectiveIndex, eventNodesInGroup.length - 1)];

  if (!currentEventNode) {
    return null;
  }

  const characterName =
    characterNode.data?.name?.trim() ||
    perspectiveNode.data?.narrator?.trim() ||
    "Character";

  return {
    baselineStoryText: formatStoryOutlineText(storyOutline),
    baselineActText: formatActText(buildStoryOutlineEvent(currentEventNode)),
    characterName,
  };
};

type BrainstormTraitsResponse = {
  traits: string[];
};

export async function brainstormCharacterTraits({
  category,
  context,
  existingTraits = [],
}: {
  category: TraitCategory;
  context: CharacterBrainstormContext;
  existingTraits?: string[];
}): Promise<string[]> {
  const endpointMap: Record<TraitCategory, string> = {
    physiology: "/api/generate-traits/physiology",
    psychology: "/api/generate-traits/psychology",
    sociology: "/api/generate-traits/sociology",
  };

  const response = await fetch(endpointMap[category], {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      baseline_story_text: context.baselineStoryText,
      baseline_act_text: context.baselineActText,
      character_name: context.characterName,
      existing_traits: existingTraits,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Failed to brainstorm traits (${response.status}): ${message}`,
    );
  }

  const result = (await response.json()) as BrainstormTraitsResponse | null;
  const rawTraits = result?.traits ?? [];
  return rawTraits.map((trait) => trait.trim()).filter((trait) => trait.length);
}

/**
 * Call the /api/interpolate-character endpoint and return structured results
 * @param params Parameters for building interpolation context and calling API
 * @returns Interpolated character data and evidence items, or null if no perspective text
 */
export async function interpolateCharacterSnapshot(
  params: InterpolateCharacterSnapshotParams,
): Promise<InterpolateCharacterResult | null> {
  const { nodes, perspectiveNode, fallbackNarratorName = "Character" } = params;

  const interpolationContext = buildCharacterInterpolationContext({
    nodes,
    perspectiveNode,
    fallbackNarratorName,
  });

  if (!interpolationContext) {
    return null;
  }

  const {
    perspectiveText,
    fullPerspectiveText,
    narratorName,
    nearbySnapshots,
    eventDescription,
  } = interpolationContext;

  const response = await fetch("/api/interpolate-character", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      perspectiveText,
      fullPerspectiveText,
      narratorName,
      nearbySnapshots,
      eventDescription,
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(
      `Failed to interpolate character snapshot (${response.status}): ${message}`,
    );
  }

  const result = (await response.json()) as InterpolateCharacterResponse | null;

  const characterTraits = result?.characterSnapshot?.traits ?? {
    physiology: [],
    psychology: [],
    sociology: [],
  };

  const characterName = result?.characterSnapshot?.name?.trim() || narratorName;

  const evidenceItems = (result?.traitEvidence ?? [])
    .map((entry) => {
      const snippet = entry.evidenceText?.trim();
      const traitValue = entry.trait?.trim();
      if (!snippet || !traitValue) {
        return null;
      }
      return {
        text: snippet,
        category: entry.traitCategory,
        attributes: [traitValue],
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return {
    characterName,
    characterTraits,
    evidenceItems,
  };
}

type RefreshCharacterSnapshotParams = {
  nodeId: string;
  nodes: WorkflowNode[];
  setNodes: WorkflowNodesSetter;
};

export async function refreshCharacterSnapshotFromPerspective({
  nodeId,
  nodes,
  setNodes,
}: RefreshCharacterSnapshotParams): Promise<boolean> {
  const characterNode = nodes.find(
    (node): node is CharacterNodeType =>
      node.id === nodeId && node.type === "character",
  );
  if (!characterNode) {
    console.warn("Character node not found for refresh:", nodeId);
    return false;
  }

  const perspectiveId = characterNode.data?.perspectiveId;
  if (!perspectiveId) {
    console.warn("Character is not linked to a perspective:", nodeId);
    return false;
  }

  const perspectiveNode = nodes.find(
    (node): node is PerspectiveNodeType =>
      node.id === perspectiveId && node.type === "perspective",
  );
  if (!perspectiveNode) {
    console.warn("Perspective node missing for character:", nodeId);
    return false;
  }

  if (!perspectiveNode.data?.reflection?.trim()) {
    console.warn("Perspective has no reflection text to refresh character.");
    return false;
  }

  const fallbackNarratorName =
    characterNode.data?.name?.trim() ||
    perspectiveNode.data?.narrator?.trim() ||
    "Character";

  const result = await interpolateCharacterSnapshot({
    nodes,
    perspectiveNode,
    fallbackNarratorName,
  });

  if (!result) {
    console.warn("Cannot refresh character; perspective text is empty.");
    return false;
  }

  const { characterName, characterTraits, evidenceItems } = result;

  setNodes((currentNodes) =>
    currentNodes.map((node) => {
      if (node.id === nodeId && node.type === "character") {
        const existingData = node.data as CharacterNodeType["data"];
        return {
          ...node,
          data: {
            ...existingData,
            traits: characterTraits,
          },
        };
      }

      if (node.id === perspectiveId && node.type === "perspective") {
        const existingData = node.data as PerspectiveNodeType["data"];
        const existingEvidence = Array.isArray(existingData?.analysisEvidence)
          ? (existingData.analysisEvidence as PerspectiveEvidenceItem[])
          : [];
        const filteredEvidence = existingEvidence.filter(
          (entry) => entry.characterId !== nodeId,
        );

        if (evidenceItems.length === 0) {
          return {
            ...node,
            data: {
              ...existingData,
              analysisEvidence: filteredEvidence,
            },
          };
        }

        const evidenceEntry: PerspectiveEvidenceItem = {
          characterId: nodeId,
          characterName,
          items: evidenceItems as PerspectiveEvidenceItem["items"],
        };

        return {
          ...node,
          data: {
            ...existingData,
            analysisEvidence: [...filteredEvidence, evidenceEntry],
          },
        };
      }

      return node;
    }),
  );

  return true;
}

/**
 * Parameters for creating a character snapshot from a perspective
 */
export type CreateCharacterSnapshotParams = {
  perspectiveNodeId: string;
  nodes: WorkflowNode[];
  fallbackNarratorName: string;
  setNodes: (updater: (nodes: WorkflowNode[]) => WorkflowNode[]) => void;
  setEdges: (updater: (edges: any[]) => any[]) => void;
};

/**
 * Creates a character snapshot node linked to a perspective node
 * Handles both node creation and edge connection
 * @param params Parameters for character snapshot creation
 * @returns Promise that resolves when creation is complete
 */
export async function createCharacterSnapshotFromPerspective(
  params: CreateCharacterSnapshotParams,
): Promise<void> {
  const { perspectiveNodeId, nodes, fallbackNarratorName, setNodes, setEdges } =
    params;

  const perspectiveNode = nodes.find(
    (node): node is PerspectiveNodeType =>
      node.id === perspectiveNodeId && node.type === "perspective",
  );

  if (!perspectiveNode) {
    throw new Error(`Perspective node not found: ${perspectiveNodeId}`);
  }

  const CHARACTER_VERTICAL_GAP = 210;
  const DEFAULT_NARRATION_GROUP_ID = "perspective-group";

  const groupId = perspectiveNode.parentId;
  const timestamp = Date.now();
  const newCharacterId = `character-${timestamp}`;
  const newEdgeId = `edge-${newCharacterId}-${perspectiveNodeId}`;

  let resolvedNarratorName = fallbackNarratorName;
  let characterTraits: CharacterTraits = {
    physiology: [],
    psychology: [],
    sociology: [],
  };
  let perspectiveEvidenceItems: Array<{
    text: string;
    category: keyof CharacterTraits;
    attributes: string[];
  }> = [];

  // Interpolate character snapshot from LLM
  try {
    const result = await interpolateCharacterSnapshot({
      nodes,
      perspectiveNode,
      fallbackNarratorName,
    });

    if (result) {
      resolvedNarratorName = result.characterName;
      characterTraits = result.characterTraits;
      perspectiveEvidenceItems = result.evidenceItems;
    }
  } catch (error) {
    console.error("Error calling interpolate-character API:", error);
  }

  // Create character node
  setNodes((nodesState) => {
    const characterNodes = nodesState.filter(
      (nodeState): nodeState is CharacterNodeType =>
        nodeState.type === "character",
    );
    const characterRowY =
      characterNodes[0]?.position.y ??
      perspectiveNode.position.y + CHARACTER_VERTICAL_GAP;

    const newCharacterNode: WorkflowNode = {
      id: newCharacterId,
      type: "character",
      position: {
        x: perspectiveNode.position.x,
        y: characterRowY,
      },
      data: {
        name: resolvedNarratorName,
        traits: characterTraits,
        perspectiveId: perspectiveNodeId,
      },
      draggable: false,
      parentId: groupId ?? DEFAULT_NARRATION_GROUP_ID,
      extent: "parent",
    };

    const nodesWithCharacter = [...nodesState, newCharacterNode];

    if (perspectiveEvidenceItems.length === 0) {
      return nodesWithCharacter;
    }

    // Add evidence to perspective node
    return nodesWithCharacter.map((nodeState) => {
      if (
        nodeState.id !== perspectiveNodeId ||
        nodeState.type !== "perspective"
      ) {
        return nodeState;
      }

      const perspectiveData =
        (nodeState.data as PerspectiveNodeType["data"]) ?? undefined;
      const existingEvidence: PerspectiveEvidenceItem[] = Array.isArray(
        perspectiveData?.analysisEvidence,
      )
        ? (perspectiveData?.analysisEvidence as PerspectiveEvidenceItem[])
        : [];
      const filteredEvidence = existingEvidence.filter(
        (entry) => entry.characterId !== newCharacterId,
      );
      const evidenceEntry: PerspectiveEvidenceItem = {
        characterId: newCharacterId,
        characterName: resolvedNarratorName,
        items: perspectiveEvidenceItems,
      };

      return {
        ...nodeState,
        data: {
          ...(perspectiveData ?? {}),
          analysisEvidence: [...filteredEvidence, evidenceEntry],
        } as PerspectiveNodeType["data"],
      };
    });
  });

  // Create edge connecting character to perspective
  setEdges((edgesState) => [
    ...edgesState,
    {
      id: newEdgeId,
      source: newCharacterId,
      target: perspectiveNodeId,
      sourceHandle: "perspective",
      targetHandle: "character",
      type: "customEdge",
      animated: true,
    },
  ]);
}
