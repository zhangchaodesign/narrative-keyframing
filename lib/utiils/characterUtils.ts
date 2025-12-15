import type {
  CharacterNodeType,
  CharacterTraits,
  EventNodeType,
  PerspectiveEvidenceItem,
  PerspectiveNodeType,
  WorkflowNode,
} from "@/lib/types/workflow";

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
    titleClass: "text-blue-700",
    chipClass:
      "border-blue-200 bg-blue-50 text-blue-900 hover:bg-blue-500 hover:text-white focus-visible:ring focus-visible:ring-blue-200",
    emptyClass: "border-blue-200 text-blue-700",
    selectedClass: "border-transparent bg-blue-500 text-white",
  },
  {
    key: "psychology",
    label: "Psychology",
    titleClass: "text-purple-700",
    chipClass:
      "border-purple-200 bg-purple-50 text-purple-900 hover:bg-purple-500 hover:text-white focus-visible:ring focus-visible:ring-purple-200",
    emptyClass: "border-purple-200 text-purple-700",
    selectedClass: "border-transparent bg-purple-500 text-white",
  },
  {
    key: "sociology",
    label: "Sociology",
    titleClass: "text-green-700",
    chipClass:
      "border-green-200 bg-green-50 text-green-900 hover:bg-green-500 hover:text-white focus-visible:ring focus-visible:ring-green-200",
    emptyClass: "border-green-200 text-green-700",
    selectedClass: "border-transparent bg-green-500 text-white",
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

  const eventNode = nodes.find(
    (node): node is EventNodeType =>
      node.type === "event" && node.id === perspectiveNode.data?.eventId,
  );

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
