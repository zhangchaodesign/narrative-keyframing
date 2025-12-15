import type {
  CharacterNodeType,
  CharacterTraits,
  EventNodeType,
  PerspectiveNodeType,
  WorkflowNode,
} from "@/lib/types/workflow";

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
